// js/core/db.js
// Capa de abstracción de base de datos para MAS Accesorios (Adaptador Supabase)

import { supabase } from './supabase.js';

let _sessionCache = {};

// Utilidad global de zona horaria para prevenir saltos de día por el UTC en Colombia
export const getLocalDate = (d = new Date()) => {
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DB = {
    // Helper interno para mapear nombres de columnas de Supabase a las propiedades esperadas por la UI
    _mapToFrontend(storeName, item) {
        if (!item) return null;
        const adapted = { ...item, id: String(item.id) };

        // Mapeos generales de llaves foráneas a camelCase (UI compatibility)
        if (adapted.contacto_id) adapted.clienteId = String(adapted.contacto_id);
        if (adapted.cuenta_id) adapted.cuentaId = String(adapted.cuenta_id);

        // contactos: identificacion (Postgres) → nit (UI)
        if (storeName === 'contactos') {
            if (adapted.identificacion !== undefined) {
                adapted.nit = adapted.identificacion;
                delete adapted.identificacion;
            }
            if (adapted.cupo_credito !== undefined) {
                adapted.cupoCredito = Number(adapted.cupo_credito);
                delete adapted.cupo_credito;
            }
            if (adapted.plazos_pago !== undefined) {
                adapted.plazosPago = Number(adapted.plazos_pago);
                delete adapted.plazos_pago;
            }
        }

        // cuentas_bancarias: numero_cuenta (Postgres) → numero (UI)
        if (storeName === 'cuentas_bancarias') {
            if (adapted.numero_cuenta !== undefined) {
                adapted.numero = adapted.numero_cuenta;
                delete adapted.numero_cuenta;
            }
        }

        if (storeName === 'lotes_fifo') {
            if (adapted.producto_id) adapted.productoId = String(adapted.producto_id);
            if (adapted.fecha_ingreso) adapted.fechaIngreso = adapted.fecha_ingreso;
            if (adapted.cantidad_inicial !== undefined) adapted.cantidadInicial = Number(adapted.cantidad_inicial);
            if (adapted.cantidad_actual !== undefined) adapted.cantidadActual = Number(adapted.cantidad_actual);
            if (adapted.costo_unitario !== undefined) adapted.costoUnitario = Number(adapted.costo_unitario);
            
            delete adapted.producto_id;
            delete adapted.fecha_ingreso;
            delete adapted.cantidad_inicial;
            delete adapted.cantidad_actual;
            delete adapted.costo_unitario;
        }

        if (storeName === 'productos') {
            if (adapted.precio_venta !== undefined) { adapted.precioVenta = Number(adapted.precio_venta); delete adapted.precio_venta; }
            if (adapted.costo_base !== undefined) { adapted.costoBase = Number(adapted.costo_base); delete adapted.costo_base; }
            if (adapted.stock_minimo !== undefined) { adapted.stockMinimo = Number(adapted.stock_minimo); delete adapted.stock_minimo; }
            
            // Inyectar alias múltiples para que el frontend lea el stock sin importar qué nombre busque
            if (adapted.stock !== undefined) { 
                const val = Number(adapted.stock);
                adapted.stock = val;
                adapted.cantidad = val;
                adapted.stockActual = val;
                adapted.existencias = val;
            }
        }

        // Facturas y Cotizaciones: Extraemos los detalles (JOIN) a un array 'detalles'
        if (storeName === 'facturas' || storeName === 'cotizaciones') {
            // Mapear observaciones → notas para compatibilidad con el template HTML
            adapted.notas = adapted.observaciones || '';
            // terminosCondiciones no existe en Postgres — garantizar string vacío en vez de undefined
            adapted.terminosCondiciones = adapted.terminosCondiciones || '';

            adapted.detalles = (item.items || []).map(detail => ({
                id: String(detail.id),
                productoId: String(detail.producto_id),
                cantidad: detail.cantidad,
                precio: detail.precio_unitario,
                descuento: detail.descuento_porcentaje,
                subtotal: detail.subtotal,
                impuesto: 0 // Si a futuro hay impuestos a nivel de línea
            }));
            delete adapted.items; // Borramos la respuesta cruda de Postgres
        }
        
        return adapted;
    },

    // Helper interno para mapear propiedades de la UI a las columnas reales de Postgres
    _mapToSupabase(storeName, data) {
        const payload = { ...data };
        delete payload.id; // Nunca forzar ID en inserts/updates

        // ── 1. Mapeos universales (aplican a cualquier storeName) ──────────
        
        // clienteId → contacto_id
        if (payload.clienteId !== undefined) {
            if (payload.clienteId !== '') {
                const parsedId = parseInt(payload.clienteId, 10);
                if (!isNaN(parsedId)) payload.contacto_id = parsedId;
            }
            delete payload.clienteId;
        }

        // cuentaId → cuenta_id
        if (payload.cuentaId !== undefined) {
            if (payload.cuentaId !== '') {
                const parsedCuenta = parseInt(payload.cuentaId, 10);
                if (!isNaN(parsedCuenta)) payload.cuenta_id = parsedCuenta;
            }
            delete payload.cuentaId;
        }

        // Fechas vacías → null (Postgres DATE rechaza strings vacíos)
        if (payload.vencimiento === '') payload.vencimiento = null;
        if (payload.fecha === '') payload.fecha = null;

        // notas → observaciones (el esquema Postgres usa 'observaciones')
        if (payload.notas !== undefined) {
            payload.observaciones = payload.notas;
            delete payload.notas;
        }

        // ── 2. Mapeos específicos por storeName ────────────────────────────

        // contactos: nit (UI) → identificacion (Postgres)
        //            cupoCredito → cupo_credito, plazosPago → plazos_pago
        if (storeName === 'contactos') {
            if (payload.nit !== undefined) {
                payload.identificacion = payload.nit;
                delete payload.nit;
            }
            if (payload.cupoCredito !== undefined) {
                payload.cupo_credito = payload.cupoCredito;
                delete payload.cupoCredito;
            }
            if (payload.plazosPago !== undefined) {
                payload.plazos_pago = payload.plazosPago;
                delete payload.plazosPago;
            }
            // Eliminar campos que no existen en el esquema (residuos o calculados)
            const CONTACTO_BASURA = ['estado', 'created_at'];
            CONTACTO_BASURA.forEach(c => delete payload[c]);
        }

        // cuentas_bancarias: numero (UI) → numero_cuenta (Postgres)
        if (storeName === 'cuentas_bancarias') {
            if (payload.numero !== undefined) {
                payload.numero_cuenta = payload.numero;
                delete payload.numero;
            }
        }

        // transacciones / pagos → pagos_ingresos
        if (storeName === 'transacciones' || storeName === 'pagos') {
            if (payload.referenciaId) {
                payload.factura_id = parseInt(payload.referenciaId, 10);
                delete payload.referenciaId;
            }
            if (payload.tipo === 'ingreso') payload.tipo = 'in';
            else if (payload.tipo === 'egreso') payload.tipo = 'out';
            
            // Permitimos que 'observaciones' pase, ya que la tabla sí lo soporta
            // y permitimos 'categoria' (nueva columna).
        }

        // lotes_fifo → traducir camelCase a snake_case
        if (storeName === 'lotes_fifo') {
            if (payload.productoId) {
                payload.producto_id = parseInt(payload.productoId, 10);
                delete payload.productoId;
            }
            if (payload.fechaIngreso !== undefined) { payload.fecha_ingreso = payload.fechaIngreso; delete payload.fechaIngreso; }
            if (payload.cantidadInicial !== undefined) { payload.cantidad_inicial = payload.cantidadInicial; delete payload.cantidadInicial; }
            if (payload.cantidadActual !== undefined) { payload.cantidad_actual = payload.cantidadActual; delete payload.cantidadActual; }
            if (payload.costoUnitario !== undefined) { payload.costo_unitario = payload.costoUnitario; delete payload.costoUnitario; }
        }

        // productos → traducir camelCase a snake_case
        if (storeName === 'productos') {
            if (payload.precioVenta !== undefined) { payload.precio_venta = payload.precioVenta; delete payload.precioVenta; }
            if (payload.costoBase !== undefined) { payload.costo_base = payload.costoBase; delete payload.costoBase; }
            if (payload.stockMinimo !== undefined) { payload.stock_minimo = payload.stockMinimo; delete payload.stockMinimo; }
            const PRODUCTO_BASURA = ['created_at'];
            PRODUCTO_BASURA.forEach(c => delete payload[c]);
        }

        // facturas / cotizaciones → estado por defecto + limpieza de campos basura
        if (storeName === 'facturas' || storeName === 'cotizaciones') {
            if (!payload.estado) {
                payload.estado = storeName === 'facturas' ? 'open' : 'draft';
            }
            // Eliminar campos que no existen en el esquema Postgres
            // (calculados en JS, residuos de Firebase, o de otras capas)
            const CAMPOS_BASURA = [
                'detalles', 'terminosCondiciones', 'convertidoAFactura',
                'tipo', 'total_costo', 'utilidad', 'saldoPendiente',
                'contacto_id_text', 'created_at'
            ];
            CAMPOS_BASURA.forEach(campo => delete payload[campo]);
        }

        return payload;
    },


    /**
     * Obtiene todos los registros de una tabla. Utiliza cache en memoria.
     */
    async getAll(storeName) {
        // Mapeo virtual: 'transacciones' y 'pagos' usan la misma tabla 'pagos_ingresos'
        const table = (storeName === 'pagos' || storeName === 'transacciones') ? 'pagos_ingresos' : storeName;
        // Caché unificada: todos los alias ('transacciones', 'pagos', 'pagos_ingresos') apuntan
        // a la misma entrada para evitar descargas duplicadas de 22.000 filas
        const cacheKey = table;

        try {
            if (_sessionCache[cacheKey]) {
                // Adaptador al vuelo si el caller pide el formato 'transacciones'
                if (storeName === 'transacciones') {
                    console.time('db-cache-map-transacciones');
                    const mapped = _sessionCache[cacheKey].map(item => ({
                        ...item,
                        tipo: item.tipo === 'in' ? 'ingreso' : 'egreso',
                        monto: Number(item.monto),
                        referenciaId: item.factura_id ? String(item.factura_id) : null,
                        cuentaId: item.cuenta_id ? String(item.cuenta_id) : null
                    }));
                    console.timeEnd('db-cache-map-transacciones');
                    return mapped;
                }
                return _sessionCache[cacheKey];
            }

            let allData = [];
            const step = 1000;
            
            // Función auxiliar para construir el query base
            const createQuery = (withCount = false) => {
                let q = supabase.from(table).select('*', withCount ? { count: 'exact' } : undefined);
                if (table === 'lotes_fifo' || table === 'pagos_ingresos' || table === 'facturas' || table === 'cotizaciones') {
                    q = q.order('id', { ascending: false });
                }
                return q;
            };

            // 1. Petición inicial con count para saber el techo
            const { data: firstPage, error, count } = await createQuery(true).range(0, step - 1);
            if (error) throw error;
            allData = allData.concat(firstPage);

            // 2. Si hay más páginas, calcular cuántas faltan y pedirlas en paralelo
            if (count > step) {
                const totalPages = Math.ceil(count / step);
                const promises = [];
                
                // Empezamos desde la página 1 (ya pedimos la 0)
                for (let i = 1; i < totalPages; i++) {
                    const from = i * step;
                    const to = from + step - 1;
                    promises.push(
                        createQuery(false).range(from, to).then(res => {
                            if (res.error) throw res.error;
                            return res.data;
                        })
                    );
                }
                
                // 3. Disparar en paralelo (HTTP/2 multiplexing)
                const remainingPagesData = await Promise.all(promises);
                
                // 4. Unir los resultados asegurando el mismo orden secuencial
                for (const pageData of remainingPagesData) {
                    allData = allData.concat(pageData);
                }
            }

            let adaptedData = allData.map(item => this._mapToFrontend(table, item));
            
            if (storeName === 'productos') {
                try {
                    const { data: lotes } = await supabase.from('lotes_fifo').select('producto_id, cantidad_actual');
                    if (lotes) {
                        const lotesMap = {};
                        lotes.forEach(l => {
                            lotesMap[l.producto_id] = (lotesMap[l.producto_id] || 0) + (parseFloat(l.cantidad_actual) || 0);
                        });
                        adaptedData.forEach(p => {
                            p.stockActual = lotesMap[p.id] || 0;
                        });
                    }
                } catch(e) {
                    console.error("Error loading inventory for products", e);
                }
            }

            // Guardar en caché usando la tabla real como clave unificada
            _sessionCache[cacheKey] = adaptedData;

            // Adaptador al vuelo si el caller pide el formato 'transacciones'
            if (storeName === 'transacciones') {
                return adaptedData.map(item => ({
                    ...item,
                    tipo: item.tipo === 'in' ? 'ingreso' : 'egreso',
                    monto: Number(item.monto),
                    referenciaId: item.factura_id ? String(item.factura_id) : null,
                    cuentaId: item.cuenta_id ? String(item.cuenta_id) : null
                }));
            }

            return adaptedData;
        } catch (error) {
            console.error(`[DB Error] getAll en '${storeName}':`, error);
            throw error;
        }
    },

    /**
     * Fuerza una lectura directa desde la BD y actualiza la caché
     */
    async refreshCache(storeName) {
        delete _sessionCache[storeName];
        return await this.getAll(storeName);
    },

    /**
     * Obtiene un registro por su ID único.
     */
    async get(storeName, id) {
        const table = storeName === 'pagos' ? 'pagos_ingresos' : storeName;
        try {
            let query = supabase.from(table).select('*');
            
            if (table === 'facturas') query = supabase.from(table).select('*, items:factura_detalles(*)');
            if (table === 'cotizaciones') query = supabase.from(table).select('*, items:cotizacion_detalles(*)');
            
            const { data, error } = await query.eq('id', parseInt(id, 10)).single();
            
            if (error) {
                if (error.code === 'PGRST116') return null; // Not found
                throw error;
            }
            
            return this._mapToFrontend(storeName, data);
        } catch (error) {
            console.error(`[DB Error] get en '${storeName}':`, error);
            throw error;
        }
    },

    /**
     * Elimina un registro por ID. Resuelve eliminaciones en cascada.
     */
    async delete(storeName, id) {
        const table = storeName === 'pagos' ? 'pagos_ingresos' : storeName;
        try {
            // El esquema en Postgres usa ON DELETE CASCADE para factura_detalles y cotizacion_detalles,
            // por lo que al borrar el padre, los hijos se borran automáticamente en BD.
            const { error } = await supabase.from(table).delete().eq('id', parseInt(id, 10));
            if (error) throw error;
            
            delete _sessionCache[storeName];
            return true;
        } catch (error) {
            console.error(`[DB Error] delete en '${storeName}':`, error);
            throw error;
        }
    },

    /**
     * Guarda o actualiza un registro.
     */
    async save(storeName, data, forceInsert = false) {
        const table = (storeName === 'pagos' || storeName === 'transacciones') ? 'pagos_ingresos' : storeName;
        // Invalidar caché de todos los alias para evitar datos stale
        delete _sessionCache[storeName];
        delete _sessionCache[table]; // invalida 'pagos_ingresos' cuando se guarda como 'transacciones' o 'pagos'

        try {
            const payload = this._mapToSupabase(storeName, data);
            
            // Determinar si es Update real. En Firebase los IDs nacían en JS (ej. 'cot_1234'). 
            // En Postgres son números puros. Si no es un número válido, es un Insert.
            const isUpdateReal = data.id && !isNaN(Number(data.id)) && !forceInsert;
            
            // Si es update, Postgres necesita el id dentro del payload
            if (isUpdateReal) {
                payload.id = parseInt(data.id, 10);
            }

            // Si es un guardado de cabecera con detalles, delegamos a Postgres para garantizar Atomicidad
            if (table === 'facturas' || table === 'cotizaciones') {
                const detalles = (data.detalles || []).map(d => ({
                    producto_id: parseInt(d.productoId, 10),
                    cantidad: parseFloat(d.cantidad) || 0,
                    precio_unitario: parseFloat(d.precio) || 0,
                    descuento_porcentaje: parseFloat(d.descuento) || 0,
                    subtotal: parseFloat(d.total) || 0
                }));

                const { data: result, error } = await supabase.rpc('save_document_with_details', {
                    p_table: table,
                    p_header: payload,
                    p_details: detalles,
                    p_is_update: isUpdateReal
                });
                
                if (error) throw error;
                if (!result) throw new Error("La base de datos no devolvió el documento guardado (Null Result). Revisa que p_is_update haya sido enviado correctamente.");
                
                return this._mapToFrontend(storeName, result);
            } else {
                // Entidades simples (Contactos, Productos, Pagos)
                if (isUpdateReal) {
                    const { data: updated, error } = await supabase
                        .from(table).update(payload).eq('id', payload.id).select().single();
                    if (error) throw error;
                    return this._mapToFrontend(storeName, updated);
                } else {
                    const { data: inserted, error } = await supabase
                        .from(table).insert([payload]).select().single();
                    if (error) throw error;
                    return this._mapToFrontend(storeName, inserted);
                }
            }
        } catch (error) {
            console.error(`[DB Error] save en '${storeName}':`, error);
            if (error && typeof error === 'object') {
                console.error("Detalles del Error Supabase/PostgREST:", {
                    message: error.message || 'N/A',
                    code: error.code || 'N/A',
                    details: error.details || 'N/A',
                    hint: error.hint || 'N/A'
                });
            }
            throw error;
        }
    },

    /**
     * Reemplaza el complejo sistema de Firestore de asignación de IDs y números.
     * En Supabase, esto simplemente invoca el RPC que se encarga de todo de forma atómica.
     */
    async saveWithNextNumero(storeName, data) {
        return await this.save(storeName, data, true); // forceInsert = true
    }
};

export default DB;
