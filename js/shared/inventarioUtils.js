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
    async procesarSalidaInventario(detallesOriginales, lotesCache = null, productosCache = null) {
        // Carga condicional (Ahorro de Cuota Firestore)
        const lotesGlobales = lotesCache || await DB.getAll('lotes_fifo');
        const productos = productosCache || await DB.getAll('productos');
        
        let stockError = '';
        let costoTotalVenta = 0;
        
        // Prevención de Mutaciones Indeseadas (Punto Crítico 2)
        const detalles = JSON.parse(JSON.stringify(detallesOriginales));

        // Fase 1: Validación Estricta (Deshabilitada por regla de negocio: se permite inventario negativo)

        // Fase 2: Descuento FIFO Real
        for (const det of detalles) {
            let qtyRestante = det.cantidad;
            let costoLinea = 0;
            const lotesProd = lotesGlobales.filter(l => l.productoId === det.productoId && l.cantidadActual > 0);
            lotesProd.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso)); // FIFO
            
            if (lotesProd.length === 0) {
                // Si no hay lotes de este producto, creamos un lote negativo inicial con el costo de compra del producto
                const prod = productos.find(p => p.id === det.productoId);
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
                    
                    lote.cantidadActual -= aDescontar;
                    qtyRestante -= aDescontar;
                    costoLinea += (aDescontar * lote.costoUnitario);
                    
                    const loteEnCache = lotesGlobales.find(l => l.id === lote.id);
                    if (loteEnCache) loteEnCache.cantidadActual = lote.cantidadActual;

                    await DB.save('lotes_fifo', lote); 
                }
            }
            // Agregamos costoTotalCalculado a nuestra copia clonada
            det.costoTotalCalculado = costoLinea;
            costoTotalVenta += costoLinea;
        }

        return { success: true, costoTotalVenta, detallesActualizados: detalles };
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
    }
};
