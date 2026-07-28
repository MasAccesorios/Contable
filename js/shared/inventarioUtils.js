import DB from '../core/db.js';

export const InventarioUtils = {
    /**
     * Valida y descuenta inventario FIFO.
     * @param {Array} detallesOriginales - Detalles de la venta a procesar.
     * @param {Array} [lotesCache] - Opcional. Lotes precargados en memoria para ahorrar cuota.
     * @param {Array} [productosCache] - Opcional. Productos precargados en memoria.
     * @returns {Object} { success, error, costoTotalVenta, detallesActualizados }
     */
    async procesarSalidaInventario(detallesOriginales, lotesCache = null, productosCache = null) {
        console.log("[FIFO Debug] Iniciando procesarSalidaInventario...", detallesOriginales);
        
        // Carga condicional (Ahorro de Cuota Firestore)
        const lotesGlobales = lotesCache || await DB.getAll('lotes_fifo');
        console.log(`[FIFO Debug] Lotes globales cargados: ${lotesGlobales?.length || 0}`);
        
        const productos = productosCache || await DB.getAll('productos');
        console.log(`[FIFO Debug] Productos cargados: ${productos?.length || 0}`);
        
        let stockError = '';
        let costoTotalVenta = 0;
        
        // Prevención de Mutaciones Indeseadas (Punto Crítico 2)
        const detalles = JSON.parse(JSON.stringify(detallesOriginales));

        // Fase 1: Validación Estricta (Deshabilitada por regla de negocio: se permite inventario negativo)
        console.log("[FIFO Debug] Fase de validación omitida. Se permite inventario negativo.");

        // Fase 2: Descuento FIFO Real
        for (const det of detalles) {
            let qtyRestante = det.cantidad;
            let costoLinea = 0;
            const lotesProd = lotesGlobales.filter(l => l.productoId === det.productoId && l.cantidadActual > 0);
            lotesProd.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso)); // FIFO
            
            console.log(`[FIFO Debug] Lotes candidatos para prodId ${det.productoId}:`, lotesProd);
            
            if (lotesProd.length === 0) {
                // Si no hay lotes de este producto, creamos un lote negativo inicial con el costo de compra del producto
                const prod = productos.find(p => p.id === det.productoId);
                const costoUnitario = prod ? (prod.precio_compra || prod.precioCompra || 0) : 0;
                const nuevoLote = {
                    id: 'lote_neg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    productoId: det.productoId,
                    fechaIngreso: new Date().toISOString().split('T')[0],
                    cantidadInicial: 0,
                    cantidadActual: -qtyRestante,
                    costoUnitario: costoUnitario
                };
                costoLinea += (qtyRestante * costoUnitario);
                qtyRestante = 0;
                
                lotesGlobales.push(nuevoLote);
                console.log(`[FIFO Debug] Creando nuevo lote negativo para producto ${det.productoId} por falta de lotes existentes.`);
                await DB.save('lotes_fifo', nuevoLote);
            } else {
                for (let i = 0; i < lotesProd.length; i++) {
                    const lote = lotesProd[i];
                    if (qtyRestante <= 0) break;
                    
                    const isLastLote = (i === lotesProd.length - 1);
                    let aDescontar = 0;
                    
                    if (isLastLote) {
                        // Si es el último lote disponible, absorbe todo el remanente (pudiendo quedar negativo)
                        aDescontar = qtyRestante;
                    } else {
                        aDescontar = Math.min(Math.max(0, lote.cantidadActual), qtyRestante);
                    }
                    
                    console.log(`[FIFO Debug] Descontando del lote ${lote.id}: aDescontar=${aDescontar}, cantidadActualLote=${lote.cantidadActual}, qtyRestante=${qtyRestante}`);
                    lote.cantidadActual -= aDescontar;
                    qtyRestante -= aDescontar;
                    costoLinea += (aDescontar * lote.costoUnitario);
                    
                    const loteEnCache = lotesGlobales.find(l => l.id === lote.id);
                    if (loteEnCache) loteEnCache.cantidadActual = lote.cantidadActual;

                    console.log(`[FIFO Debug] Guardando lote ${lote.id} en DB...`);
                    await DB.save('lotes_fifo', lote); 
                    console.log(`[FIFO Debug] Guardado exitoso de lote ${lote.id}.`);
                }
            }
            // Agregamos costoTotalCalculado a nuestra copia clonada
            det.costoTotalCalculado = costoLinea;
            costoTotalVenta += costoLinea;
            console.log(`[FIFO Debug] Finalizada línea de producto ${det.productoId}. Costo línea: ${costoLinea}`);
        }

        console.log(`[FIFO Debug] Proceso finalizado con éxito. Costo total venta: ${costoTotalVenta}`);
        return { success: true, costoTotalVenta, detallesActualizados: detalles };
    }
};
