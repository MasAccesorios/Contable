import DB, { getLocalDate } from '../core/db.js';
import { supabase } from '../core/supabase.js';

export const InventarioUtils = {
    /**
     * Valida y descuenta inventario FIFO.
     * @param {Array} detallesOriginales - Detalles de la venta a procesar.
     * @param {Array} [lotesCache] - Opcional. Lotes precargados en memoria para ahorrar cuota.
     * @param {Array} [productosCache] - Opcional. Productos precargados en memoria.
     * @returns {Object} { success, error, costoTotalVenta, detallesActualizados }
     */
    /**
     * Versión "wrapper" para mantener compatibilidad con el resto del sistema.
     * Calcula y ejecuta inmediatamente el descuento físico.
     */
    async procesarSalidaInventario(detallesOriginales, lotesCache = null, productosCache = null) {
        const plan = await this.calcularSalidaInventario(detallesOriginales, lotesCache, productosCache);
        if (!plan.success) return plan;
        
        await this.ejecutarPlanInventario(plan.operacionesDB);
        
        return plan;
    },

    /**
     * FASE 1 (Read-Only): Simula el descuento FIFO, calcula costos, y genera un plan de operaciones DB.
     * Retorna: { success, error, costoTotalVenta, detallesActualizados, operacionesDB }
     */
    async calcularSalidaInventario(detallesOriginales, lotesCache = null, productosCache = null) {
        // Hacemos deep copy de lotesCache para no mutar el cache original si se provee
        const lotesGlobales = lotesCache ? JSON.parse(JSON.stringify(lotesCache)) : await DB.getAll('lotes_fifo');
        const productos = productosCache || await DB.getAll('productos');
        
        let costoTotalVenta = 0;
        const detalles = JSON.parse(JSON.stringify(detallesOriginales));
        const operacionesDB = [];

        // Validación Asíncrona de Sobreventa
        let qtyPedidaPorProducto = {};
        for (const det of detalles) {
            qtyPedidaPorProducto[det.productoId] = (qtyPedidaPorProducto[det.productoId] || 0) + parseFloat(det.cantidad);
        }

        let itemsSinStock = [];
        for (const prodIdStr in qtyPedidaPorProducto) {
            const prodId = String(prodIdStr);
            const qtyPedida = qtyPedidaPorProducto[prodIdStr];
            
            const lotesProd = lotesGlobales.filter(l => String(l.productoId) === prodId && l.cantidadActual > 0);
            const stockDisponible = lotesProd.reduce((sum, l) => sum + parseInt(l.cantidadActual), 0);
            
            if (qtyPedida > stockDisponible) {
                const prod = productos.find(p => String(p.id) === prodId);
                const nombreProd = prod ? prod.nombre : 'Producto ID ' + prodId;
                itemsSinStock.push(`- <b>${nombreProd}</b>: solicitas ${qtyPedida}, hay disponible ${stockDisponible}`);
            }
        }

        if (itemsSinStock.length > 0) {
            const msg = `Los siguientes productos no tienen stock suficiente para completar la transacción:<br><br>${itemsSinStock.join('<br>')}<br><br>¿Deseas continuar y registrar el faltante como inventario negativo?`;
            
            let confirmado = false;
            if (window.CoreActions && window.CoreActions.showConfirmModalAsync) {
                confirmado = await window.CoreActions.showConfirmModalAsync(msg);
            } else {
                confirmado = confirm(msg.replace(/<br>/g, '\n').replace(/<b>|<\/b>/g, ''));
            }
            
            if (!confirmado) {
                return { success: false, error: "Venta cancelada por el usuario (stock insuficiente)." };
            }
        }

        // Simulación Descuento FIFO
        for (const det of detalles) {
            let qtyRestante = det.cantidad;
            let costoLinea = 0;
            const lotesProd = lotesGlobales.filter(l => String(l.productoId) === String(det.productoId) && l.cantidadActual > 0);
            lotesProd.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso));
            
            if (lotesProd.length === 0) {
                // Si no hay lotes, simulamos creación de uno negativo
                const prod = productos.find(p => String(p.id) === String(det.productoId));
                const costoUnitario = prod ? (prod.precio_compra || prod.precioCompra || 0) : 0;
                const nuevoLote = {
                    id: 'lote_neg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    productoId: det.productoId,
                    fechaIngreso: getLocalDate(),
                    cantidadInicial: 0,
                    cantidadActual: -qtyRestante,
                    costoUnitario: costoUnitario
                };
                costoLinea += (qtyRestante * costoUnitario);
                qtyRestante = 0;
                
                lotesGlobales.push(nuevoLote);
                operacionesDB.push({ action: 'insert', data: nuevoLote });
            } else {
                for (let i = 0; i < lotesProd.length; i++) {
                    const lote = lotesProd[i];
                    if (qtyRestante <= 0) break;
                    
                    const isLastLote = (i === lotesProd.length - 1);
                    let aDescontar = 0;
                    
                    if (isLastLote) {
                        aDescontar = qtyRestante;
                    } else {
                        aDescontar = Math.min(Math.max(0, lote.cantidadActual), qtyRestante);
                    }
                    
                    lote.cantidadActual -= aDescontar;
                    qtyRestante -= aDescontar;
                    costoLinea += (aDescontar * lote.costoUnitario);
                    
                    operacionesDB.push({ action: 'update', data: { ...lote } });
                }
            }
            det.costoTotalCalculado = costoLinea;
            costoTotalVenta += costoLinea;
        }

        return { success: true, costoTotalVenta, detallesActualizados: detalles, operacionesDB };
    },

    /**
     * FASE 2 (Write): Toma el plan de operaciones y ejecuta los guardados físicos en base de datos.
     * Implementa rollback interno LIFO en caso de fallos parciales.
     */
    async ejecutarPlanInventario(operacionesDB) {
        if (!operacionesDB || operacionesDB.length === 0) return;
        
        // Pila de instrucciones compensatorias (LIFO)
        const compensaciones = [];
        
        try {
            for (const op of operacionesDB) {
                if (op.action === 'update') {
                    // 1. Snapshot ANTES de pisar el registro existente
                    const snapshotPrevio = await DB.get('lotes_fifo', op.data.id);
                    if (!snapshotPrevio) throw new Error(`El lote ${op.data.id} ya no existe.`);
                    
                    // Instrucción para revertir: Volver a hacer UPDATE con los datos viejos
                    compensaciones.push({ tipo: 'restaurar', data: snapshotPrevio });
                    
                    await DB.save('lotes_fifo', op.data);
                    
                } else if (op.action === 'insert') {
                    // 1. Insertamos y capturamos la fila resultante (con el ID real de Postgres)
                    const loteGuardado = await DB.save('lotes_fifo', op.data);
                    
                    // Instrucción para revertir: ELIMINAR el lote recién creado
                    compensaciones.push({ tipo: 'eliminar', idReal: loteGuardado.id });
                }
            }
        } catch (errorOriginal) {
            console.error("Fallo aplicando lote FIFO. Iniciando rollback interno...", errorOriginal);
            
            // Ejecutar las instrucciones compensatorias en orden INVERSO
            for (let i = compensaciones.length - 1; i >= 0; i--) {
                const comp = compensaciones[i];
                try {
                    if (comp.tipo === 'restaurar') {
                        await DB.save('lotes_fifo', comp.data);
                    } else if (comp.tipo === 'eliminar') {
                        await DB.delete('lotes_fifo', comp.idReal);
                    }
                } catch (errRollback) {
                    console.error("Fallo CRÍTICO compensando lote en BD:", errRollback);
                }
            }
            
            throw new Error("Transacción física fallida. Los lotes tocados fueron revertidos. Error: " + errorOriginal.message);
        }
    },

    /**
     * Valida y revierte los lotes de inventario generados por una factura de compra.
     * Si algún lote ya fue vendido parcialmente, bloquea la operación.
     * @param {string|number} facturaNumero - El número de la factura de compra
     * @returns {Object} { success: boolean, error: string }
     */
    async revertirLotesPorCompra(facturaNumero) {
        // 1. Buscar los lotes asociados a esta factura
        const { data: lotes, error: getError } = await supabase
            .from('lotes_fifo')
            .select('*')
            .eq('referencia', `Factura Compra ${facturaNumero}`);
            
        if (getError) return { success: false, error: getError.message };
        if (!lotes || lotes.length === 0) return { success: true }; // No hay lotes que revertir
        
        // 2. Validación Estricta: Verificar si algún lote ya fue tocado/vendido
        for (const lote of lotes) {
            if (lote.cantidad_actual < lote.cantidad_inicial) {
                return { 
                    success: false, 
                    error: `No se puede anular la compra. La mercancía ya está comprometida en ventas (Producto ID: ${lote.producto_id} tiene ${lote.cantidad_actual} disponibles de los ${lote.cantidad_inicial} originales).` 
                };
            }
        }
        
        // 3. Reversión: Eliminamos los lotes completos de la base de datos
        const lotesIds = lotes.map(l => l.id);
        const { error: deleteError } = await supabase
            .from('lotes_fifo')
            .delete()
            .in('id', lotesIds);
            
        if (deleteError) return { success: false, error: deleteError.message };
        
        await DB.refreshCache('lotes_fifo');
        return { success: true };
    },

    /**
     * Devuelve el inventario (restaurando cantidadActual) de lotes previamente mermados.
     * Se usa al borrar/anular facturas de venta.
     */
    async revertirSalidaInventario(detalles) {
        try {
            const lotesGlobales = await DB.getAll('lotes_fifo');
            const productos = await DB.getAll('productos');
            
            let qtyARevertirPorProducto = {};
            for (const det of detalles) {
                const prodId = String(det.productoId);
                qtyARevertirPorProducto[prodId] = (qtyARevertirPorProducto[prodId] || 0) + parseFloat(det.cantidad);
            }

            for (const prodId in qtyARevertirPorProducto) {
                let qtyToReturn = qtyARevertirPorProducto[prodId];
                
                // Lotes del producto que tienen espacio (fueron mermados o son negativos)
                const lotesProd = lotesGlobales.filter(l => 
                    String(l.productoId) === prodId && 
                    parseFloat(l.cantidadActual) < parseFloat(l.cantidadInicial)
                );
                
                // Ordenar del más antiguo al más nuevo (revertimos rellenando los lotes más viejos primero, que fueron los primeros en ser descontados por FIFO)
                lotesProd.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso));

                for (const lote of lotesProd) {
                    if (qtyToReturn <= 0) break;
                    
                    const espacioDisponible = parseFloat(lote.cantidadInicial) - parseFloat(lote.cantidadActual);
                    if (espacioDisponible > 0) {
                        const add = Math.min(espacioDisponible, qtyToReturn);
                        lote.cantidadActual = parseFloat(lote.cantidadActual) + add;
                        qtyToReturn -= add;
                        await DB.save('lotes_fifo', lote);
                    }
                }

                // Si aún queda por devolver (ej. lotes borrados), crear un lote positivo compensatorio.
                // Usamos 0.0001 para ignorar residuos microscópicos de punto flotante de JS (ej. 1e-15)
                if (qtyToReturn > 0.0001) {
                    const prod = productos.find(p => String(p.id) === prodId);
                    const costoUnitario = prod ? (prod.precio_compra || prod.precioCompra || 0) : 0;
                    
                    const nuevoLote = {
                        id: 'lote_rev_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                        productoId: parseInt(prodId),
                        fechaIngreso: getLocalDate(),
                        cantidadInicial: qtyToReturn,
                        cantidadActual: qtyToReturn,
                        costoUnitario: costoUnitario
                    };
                    await DB.save('lotes_fifo', nuevoLote);
                }
            }
            return { success: true };
        } catch (error) {
            console.error("Error revirtiendo inventario:", error);
            return { success: false, error: "Fallo al revertir el inventario: " + error.message };
        }
    }
};
