/**
 * Módulo de Datos y Lógica Contable de Detalle de Producto
 * Cálculos FIFO, semáforo de inventario, valorización, rotación y cobertura.
 */

export const ProductoDetalleData = {
    _supabase: null,
    _db: null,

    getSupabase() {
        if (this._supabase) return this._supabase;
        if (typeof window !== 'undefined' && window.supabase) return window.supabase;
        return null;
    },

    setSupabase(client) {
        this._supabase = client;
    },

    getDB() {
        if (this._db) return this._db;
        if (typeof window !== 'undefined' && window.DB) return window.DB;
        return null;
    },

    setDB(db) {
        this._db = db;
    },

    /**
     * Mapea un registro de lotes_fifo a la estructura de frontend con compatibilidad camelCase.
     */
    mapLoteToFrontend(l) {
        if (!l) return null;
        return {
            ...l,
            id: l?.id != null ? String(l.id) : '',
            productoId: l.productoId ?? l.producto_id,
            cantidadInicial: parseFloat(l.cantidadInicial ?? l.cantidad_inicial) || 0,
            cantidadActual: parseFloat(l.cantidadActual ?? l.cantidad_actual) || 0,
            costoUnitario: parseFloat(l.costoUnitario ?? l.costo_unitario) || 0,
            fechaIngreso: l.fechaIngreso ?? l.fecha_ingreso,
            referencia: l.referencia ?? l.referencia_lote ?? ''
        };
    },

    /**
     * Calcula el stock disponible sumando lotes FIFO activos o usando fallback de producto.stock.
     * Determina el semáforo de estado de inventario ('optimo', 'recompra', 'critico', 'agotado').
     * @param {Object} producto - Datos maestros del producto.
     * @param {Array} [lotes=[]] - Lista de lotes FIFO.
     * @returns {{ stockTotal: number, stockMinimo: number, estado: string, esFallback: boolean }}
     */
    calcularStockYEstado(producto, lotes = []) {
        const prod = producto || {};
        const stockMinimo = parseFloat(prod.stockMinimo ?? prod.stock_minimo) || 0;

        let stockTotal = 0;
        let esFallback = false;

        if (Array.isArray(lotes) && lotes.length > 0) {
            stockTotal = lotes.reduce((sum, l) => {
                const cant = parseFloat(l.cantidadActual ?? l.cantidad_actual) || 0;
                return cant > 0 ? sum + cant : sum;
            }, 0);
            esFallback = false;
        } else {
            stockTotal = parseFloat(prod.stock ?? prod.cantidad) || 0;
            esFallback = true;
        }

        stockTotal = Math.round(stockTotal * 100) / 100;

        let estado = 'optimo';
        if (stockTotal <= 0) {
            estado = 'agotado';
        } else if (stockMinimo > 0 && stockTotal <= (stockMinimo * 0.5)) {
            estado = 'critico';
        } else if (stockMinimo > 0 && stockTotal <= stockMinimo) {
            estado = 'recompra';
        } else {
            estado = 'optimo';
        }

        return {
            stockTotal,
            stockMinimo,
            estado,
            esFallback
        };
    },

    /**
     * Calcula la valorización FIFO: sumatoria de cantidad_actual * costo_unitario de lotes activos.
     * Compara el Costo Promedio Ponderado real contra el Costo Base fijo del producto.
     * @param {Object} producto 
     * @param {Array} [lotes=[]] 
     * @returns {{ valorTotal: number, costoPromedioPonderado: number, costoBase: number, diferenciaCosto: number, totalUnidades: number }}
     */
    calcularValorizacionFIFO(producto, lotes = []) {
        const prod = producto || {};
        const costoBase = parseFloat(prod.costoBase ?? prod.costo_base) || 0;

        const lotesArr = Array.isArray(lotes) ? lotes : [];
        const lotesActivos = lotesArr.filter(l => (parseFloat(l.cantidadActual ?? l.cantidad_actual) || 0) > 0);

        if (lotesArr.length > 0) {
            if (lotesActivos.length > 0) {
                let valorTotal = 0;
                let totalUnidades = 0;

                for (const l of lotesActivos) {
                    const cant = parseFloat(l.cantidadActual ?? l.cantidad_actual) || 0;
                    const costo = parseFloat(l.costoUnitario ?? l.costo_unitario) || 0;
                    valorTotal += cant * costo;
                    totalUnidades += cant;
                }

                const costoPromedioPonderado = totalUnidades > 0 ? valorTotal / totalUnidades : costoBase;
                const diferenciaCosto = costoPromedioPonderado - costoBase;

                return {
                    valorTotal: Math.round(valorTotal * 100) / 100,
                    costoPromedioPonderado: Math.round(costoPromedioPonderado * 100) / 100,
                    costoBase,
                    diferenciaCosto: Math.round(diferenciaCosto * 100) / 100,
                    totalUnidades
                };
            }

            // Lotes configurados pero todos agotados (existencia real = 0)
            return {
                valorTotal: 0,
                costoPromedioPonderado: costoBase,
                costoBase,
                diferenciaCosto: 0,
                totalUnidades: 0
            };
        }

        // Fallback a stock de producto y costoBase cuando no hay lotes registrados
        const stockFallback = parseFloat(prod.stock ?? prod.cantidad) || 0;
        const valorTotal = stockFallback * costoBase;

        return {
            valorTotal: Math.round(valorTotal * 100) / 100,
            costoPromedioPonderado: costoBase,
            costoBase,
            diferenciaCosto: 0,
            totalUnidades: stockFallback
        };
    },

    /**
     * Calcula el margen comercial monetario ($/und) y porcentual (%) según precio de venta y costo FIFO.
     * @param {Object} producto 
     * @param {number|null} [costoPromedioFIFO] 
     * @returns {{ precioVenta: number, costoUnitario: number, utilidadMonetaria: number, margenPorcentual: number }}
     */
    calcularMargenComercial(producto, costoPromedioFIFO = null) {
        const prod = producto || {};
        const precioVenta = parseFloat(prod.precioVenta ?? prod.precio_venta) || 0;
        
        let costoUnitario = 0;
        if (costoPromedioFIFO !== null && costoPromedioFIFO !== undefined && Number.isFinite(Number(costoPromedioFIFO))) {
            costoUnitario = parseFloat(costoPromedioFIFO);
        } else {
            costoUnitario = parseFloat(prod.costoBase ?? prod.costo_base) || 0;
        }

        const utilidadMonetaria = Math.round((precioVenta - costoUnitario) * 100) / 100;
        const margenPorcentual = precioVenta > 0 
            ? Math.round(((utilidadMonetaria / precioVenta) * 100) * 100) / 100 
            : 0;

        return {
            precioVenta,
            costoUnitario,
            utilidadMonetaria,
            margenPorcentual
        };
    },

    /**
     * Calcula la velocidad diaria de ventas, proyección de días de cobertura y alerta de recompra.
     * @param {number|Object} stockInput - Stock numérico o entidad producto.
     * @param {Array} [ventasOrLotes=[]] - Ventas (si arg1 es número) o lotes (si arg1 es producto).
     * @param {number|Array} [periodoOrVentas=30] - Días del periodo o array de ventas.
     * @param {number} [maybePeriodo=30] - Días del periodo si se pasó producto y lotes.
     * @returns {{ unidadesVendidas: number, velocidadDiaria: number, diasCobertura: number, alertaRecompra: boolean, diasPeriodo: number }}
     */
    calcularRotacionYCobertura(stockInput, ventasOrLotes = [], periodoOrVentas = 30, maybePeriodo = 30) {
        let stockTotal = 0;
        let ventas = [];
        let periodoDias = 30;

        if (typeof stockInput === 'number') {
            stockTotal = Number.isFinite(stockInput) ? stockInput : 0;
            ventas = Array.isArray(ventasOrLotes) ? ventasOrLotes : [];
            periodoDias = typeof periodoOrVentas === 'number' && periodoOrVentas > 0 ? periodoOrVentas : 30;
        } else if (stockInput && typeof stockInput === 'object') {
            if (Array.isArray(ventasOrLotes) && Array.isArray(periodoOrVentas)) {
                // Invocado como (producto, lotes, ventas, dias)
                const stockCalc = this.calcularStockYEstado(stockInput, ventasOrLotes);
                stockTotal = stockCalc.stockTotal;
                ventas = periodoOrVentas;
                periodoDias = typeof maybePeriodo === 'number' && maybePeriodo > 0 ? maybePeriodo : 30;
            } else {
                // Invocado como (producto, ventas, dias)
                stockTotal = parseFloat(stockInput.stock) || 0;
                ventas = Array.isArray(ventasOrLotes) ? ventasOrLotes : [];
                periodoDias = typeof periodoOrVentas === 'number' && periodoOrVentas > 0 ? periodoOrVentas : 30;
            }
        }

        const unidadesVendidas = ventas.reduce((acc, v) => {
            const cant = parseFloat(v.cantidad ?? v.cantidadItem ?? v.cantidad_item ?? v.cant) || 0;
            return acc + cant;
        }, 0);

        const velocidadDiaria = periodoDias > 0 
            ? Math.round((unidadesVendidas / periodoDias) * 100) / 100 
            : 0;

        let diasCobertura = 0;
        if (stockTotal <= 0) {
            diasCobertura = 0;
        } else if (velocidadDiaria > 0) {
            diasCobertura = Math.round(stockTotal / velocidadDiaria);
        } else {
            diasCobertura = 999;
        }

        const alertaRecompra = (stockTotal <= 0) || (diasCobertura <= 15);

        return {
            unidadesVendidas,
            velocidadDiaria,
            diasCobertura,
            alertaRecompra,
            diasPeriodo: periodoDias
        };
    },

    /**
     * Filtra los lotes ('activos', 'agotados', 'todos'), los ordena ascendentemente por fechaIngreso (FIFO)
     * e identifica con bandera `esCapaActiva: true` al primer lote con stock disponible.
     * @param {Array} lotes 
     * @param {string} [filtro='todos'] - 'activos' | 'agotados' | 'todos'
     * @returns {Array} Lotes decorados con `porcentajeConsumo` y `esCapaActiva`.
     */
    filtrarLotes(lotes, filtro = 'todos') {
        if (!Array.isArray(lotes) || lotes.length === 0) return [];

        const copia = [...lotes].sort((a, b) => {
            const timeA = new Date(a.fechaIngreso || a.fecha_ingreso || 0).getTime();
            const timeB = new Date(b.fechaIngreso || b.fecha_ingreso || 0).getTime();
            const fechaA = isNaN(timeA) ? 0 : timeA;
            const fechaB = isNaN(timeB) ? 0 : timeB;
            if (fechaA !== fechaB) return fechaA - fechaB;
            return String(a.id || '').localeCompare(String(b.id || ''));
        });

        let capaActivaAsignada = false;

        const decorados = copia.map(l => {
            const actual = parseFloat(l.cantidadActual ?? l.cantidad_actual) || 0;
            const inicial = parseFloat(l.cantidadInicial ?? l.cantidad_inicial) || 0;
            const calcConsumo = inicial > 0 ? Math.round(((inicial - actual) / inicial) * 100) : 0;
            const porcentajeConsumo = Math.max(0, Math.min(100, calcConsumo));

            let esCapaActiva = false;
            if (!capaActivaAsignada && actual > 0) {
                esCapaActiva = true;
                capaActivaAsignada = true;
            }

            return {
                ...l,
                cantidadActual: actual,
                cantidadInicial: inicial,
                costoUnitario: parseFloat(l.costoUnitario ?? l.costo_unitario) || 0,
                porcentajeConsumo,
                esCapaActiva
            };
        });

        if (filtro === 'activos') {
            return decorados.filter(l => l.cantidadActual > 0);
        }
        if (filtro === 'agotados') {
            return decorados.filter(l => l.cantidadActual === 0);
        }

        return decorados;
    },

    /**
     * Consulta completa a Supabase/DB para cargar producto, lotes, ventas y movimientos.
     * @param {string|number} productoId 
     * @returns {Promise<Object>}
     */
    async cargarDetalle(productoId) {
        const client = this.getSupabase();
        const db = this.getDB();
        
        let producto = null;
        if (db) {
            try {
                producto = await db.get('productos', productoId);
            } catch (e) {
                console.error('Error al obtener producto de DB:', e);
            }
        }

        if (!producto && client) {
            const { data } = await client.from('productos').select('*').eq('id', productoId).single();
            producto = data;
        }

        if (!producto) return null;

        // 1. Cargar lotes FIFO y detalles de factura en paralelo
        let lotes = [];
        let ventas = [];
        let facturasCompra = [];

        if (client) {
            try {
                const [lotesRes, detallesRes] = await Promise.all([
                    client.from('lotes_fifo').select('*').eq('producto_id', productoId),
                    client.from('factura_detalles').select('id, factura_id, producto_id, cantidad, precio_unitario, subtotal').eq('producto_id', productoId)
                ]);

                if (lotesRes?.data) {
                    lotes = lotesRes.data.map(l => db && db._mapToFrontend ? db._mapToFrontend('lotes_fifo', l) : this.mapLoteToFrontend(l));
                }

                const detalles = detallesRes?.data || [];
                if (detalles.length > 0) {
                    const facturaIds = [...new Set(detalles.map(d => d.factura_id).filter(Boolean))];
                    if (facturaIds.length > 0) {
                        const { data: facturas } = await client
                            .from('facturas')
                            .select('id, numero, fecha, tipo, contacto_id, estado, total')
                            .in('id', facturaIds);

                        const facturasMap = {};
                        (facturas || []).forEach(f => { facturasMap[f.id] = f; });

                        const contactIds = [...new Set((facturas || []).map(f => f.contacto_id || f.clienteId || f.proveedorId).filter(Boolean))];
                        let contactosMap = {};
                        if (contactIds.length > 0) {
                            const { data: contactos } = await client.from('contactos').select('id, nombre').in('id', contactIds);
                            (contactos || []).forEach(c => { contactosMap[c.id] = c.nombre; });
                        }

                        detalles.forEach(det => {
                            const f = facturasMap[det.factura_id];
                            if (!f) return;

                            const cant = parseFloat(det.cantidad) || 0;
                            const pu = parseFloat(det.precio_unitario) || 0;
                            const tot = parseFloat(det.subtotal) || (cant * pu);

                            const cid = f.contacto_id || f.clienteId || f.proveedorId;
                            const itemVenta = {
                                id: f.id,
                                numero: f.numero,
                                fecha: f.fecha,
                                tipo: f.tipo || 'venta',
                                clienteNombre: contactosMap[cid] || (f.tipo === 'compra' ? 'Proveedor Varios' : 'Consumidor Final'),
                                cantidadItem: cant,
                                precioUnitarioItem: pu,
                                totalItem: tot,
                                estado: f.estado || 'cobrada'
                            };

                            if (f.tipo === 'compra') {
                                facturasCompra.push(itemVenta);
                            } else {
                                ventas.push(itemVenta);
                            }
                        });

                        // Ordenar cronológicamente descendente
                        ventas.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
                        facturasCompra.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
                    }
                }
            } catch (err) {
                console.error('Error al cargar ventas asociadas:', err);
            }
        }

        // 2. Ventas válidas recientes (30 días) para cálculo de rotación
        const ahora = Date.now();
        const limite30 = new Date(ahora - (30 * 24 * 3600 * 1000)).toISOString().split('T')[0];
        const ventasValidas = ventas.filter(v => v.estado !== 'anulada' && v.estado !== 'void');
        const ventasRecientes = ventasValidas.filter(v => v.fecha && v.fecha >= limite30);
        const ventasParaRotacion = ventasRecientes.length > 0 ? ventasRecientes : ventasValidas;

        // 3. Cálculos de KPIs
        const stockYEstado = this.calcularStockYEstado(producto, lotes);
        const valorizacion = this.calcularValorizacionFIFO(producto, lotes);
        const margen = this.calcularMargenComercial(producto, valorizacion.costoPromedioPonderado);
        const rotacion = this.calcularRotacionYCobertura(stockYEstado.stockTotal, ventasParaRotacion, 30);

        return {
            producto,
            lotes,
            ventas,
            facturasCompra,
            kpis: {
                stock: stockYEstado,
                valorizacion,
                margen,
                rotacion
            }
        };
    },

    /**
     * Guarda un nuevo lote manual en Supabase / DB.
     * @param {Object} nuevoLote 
     */
    async guardarLote(nuevoLote) {
        const db = this.getDB();
        if (db) {
            return await db.save('lotes_fifo', nuevoLote);
        }
        const client = this.getSupabase();
        if (client) {
            const rawPId = nuevoLote.producto_id ?? nuevoLote.productoId;
            const pId = parseInt(rawPId, 10);
            if (!pId || isNaN(pId)) throw new Error('ID de producto inválido.');

            const payload = {
                producto_id: pId,
                cantidad_inicial: parseFloat(nuevoLote.cantidad_inicial ?? nuevoLote.cantidadInicial) || 0,
                cantidad_actual: parseFloat(nuevoLote.cantidad_actual ?? nuevoLote.cantidadActual) || 0,
                costo_unitario: parseFloat(nuevoLote.costo_unitario ?? nuevoLote.costoUnitario) || 0,
                fecha_ingreso: nuevoLote.fecha_ingreso ?? nuevoLote.fechaIngreso,
                referencia: String(nuevoLote.referencia || '').slice(0, 255),
                origen_movimiento: nuevoLote.origen_movimiento ?? nuevoLote.origenMovimiento ?? 'ingreso_manual'
            };
            const { data, error } = await client.from('lotes_fifo').insert(payload).select().single();
            if (error) throw error;
            return data;
        }
        throw new Error('No hay base de datos disponible para guardar el lote.');
    },

    /**
     * Consulta movimientos de Kardex llamando RPC get_kardex_producto.
     * @param {string|number} productoId 
     * @returns {Promise<Array>}
     */
    async cargarKardex(productoId) {
        const client = this.getSupabase();
        if (!client) return [];
        const { data, error } = await client.rpc('get_kardex_producto', { p_producto_id: productoId });
        if (error) {
            console.error('Error al obtener kardex:', error);
            throw error;
        }
        return data || [];
    }
};
