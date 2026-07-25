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
        // Carga condicional (Ahorro de Cuota Firestore)
        const lotesGlobales = lotesCache || await DB.getAll('lotes_fifo');
        const productos = productosCache || await DB.getAll('productos');
        
        let stockError = '';
        let costoTotalVenta = 0;
        
        // Prevención de Mutaciones Indeseadas (Punto Crítico 2)
        const detalles = JSON.parse(JSON.stringify(detallesOriginales));

        // Fase 1: Validación Estricta
        for (const det of detalles) {
            const prodId = det.productoId;
            const stockTotal = lotesGlobales
                .filter(l => l.productoId === prodId)
                .reduce((sum, l) => sum + l.cantidadActual, 0);
            
            if (stockTotal < det.cantidad) {
                const prod = productos.find(p => p.id === prodId);
                stockError += `Stock insuficiente para ${prod ? prod.nombre : 'el producto'}. Disponible: ${stockTotal}, Requerido: ${det.cantidad}.<br>`;
            }
        }

        if (stockError) {
            return { success: false, error: stockError };
        }

        // Fase 2: Descuento FIFO Real
        for (const det of detalles) {
            let qtyRestante = det.cantidad;
            let costoLinea = 0;
            const lotesProd = lotesGlobales.filter(l => l.productoId === det.productoId && l.cantidadActual > 0);
            lotesProd.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso)); // FIFO
            
            for (const lote of lotesProd) {
                if (qtyRestante <= 0) break;
                const aDescontar = Math.min(lote.cantidadActual, qtyRestante);
                lote.cantidadActual -= aDescontar;
                qtyRestante -= aDescontar;
                costoLinea += (aDescontar * lote.costoUnitario);
                
                // Actualizar caché de memoria también, para que las siguientes líneas lo vean descontado
                const loteEnCache = lotesGlobales.find(l => l.id === lote.id);
                if (loteEnCache) loteEnCache.cantidadActual = lote.cantidadActual;

                // Aquí SÍ vamos a la BD para asentar la bajada real del lote individual.
                await DB.save('lotes_fifo', lote); 
            }
            // Agregamos costoTotalCalculado a nuestra copia clonada
            det.costoTotalCalculado = costoLinea;
            costoTotalVenta += costoLinea;
        }

        return { success: true, costoTotalVenta, detallesActualizados: detalles };
    }
};
