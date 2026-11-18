import DB, { getLocalDate } from '../core/db.js';
import { supabase } from '../core/supabase.js';

export const InventarioUtils = {
    /**
     * Valida y descuenta inventario FIFO de forma transaccional mediante RPC en Supabase.
     */
    async procesarSalidaInventario(detallesOriginales, lotesCache = null, productosCache = null) {
        return await this.calcularSalidaInventario(detallesOriginales, lotesCache, productosCache);
    },

    /**
     * Reemplaza la antigua FASE 1 simulada en JS. 
     * Ahora ejecuta directamente el RPC transaccional en PostgreSQL.
     */
    async calcularSalidaInventario(detallesOriginales, lotesCache = null, productosCache = null, origenDocumento = null) {
        let { data: response, error } = await supabase.rpc('procesar_salida_inventario_fifo', {
            p_detalles: detallesOriginales,
            p_origen_movimiento: origenDocumento || 'Venta',
            p_permitir_negativos: false
        });

        if (error) {
            console.error(error);
            return { success: false, error: "Error en base de datos: " + error.message };
        }

        // Si falló por stock insuficiente, pedimos confirmación
        if (!response.success && response.error === 'stock_insuficiente') {
            const pid = response.producto_id || response.productoId || response.id || null;
            let prod = null;
            if (pid && !isNaN(parseInt(pid, 10))) {
                prod = await DB.get('productos', parseInt(pid, 10));
            }
            const nombreProd = prod ? prod.nombre : 'ID ' + (pid || 'Desconocido');
            const msg = `El producto ${nombreProd} no tiene stock suficiente (Solicitado: ${response.cantidad_pedida}, Disponible: ${response.stock_disponible}).\n¿Deseas continuar y registrar el faltante como inventario negativo?`;
            
            let confirmado = false;
            if (window.CoreActions && window.CoreActions.showConfirmModalAsync) {
                confirmado = await window.CoreActions.showConfirmModalAsync(msg);
            } else {
                confirmado = confirm(msg);
            }
            
            if (!confirmado) {
                return { success: false, error: "Venta cancelada por el usuario (stock insuficiente)." };
            }

            // Si el usuario acepta, re-ejecutamos habilitando negativos
            const retry = await supabase.rpc('procesar_salida_inventario_fifo', {
                p_detalles: detallesOriginales,
                p_origen_movimiento: origenDocumento || 'Venta',
                p_permitir_negativos: true
            });
            
            if (retry.error) return { success: false, error: retry.error.message };
            if (!retry.data) return { success: false, error: 'El servidor no devolvió datos al procesar con inventario negativo.' };
            response = retry.data;

            // Si el servidor no retornó detallesActualizados en el path de negativos,
            // usamos los detalles originales — la lista de productos no cambia, solo el stock.
            if (!Array.isArray(response.detallesActualizados) || response.detallesActualizados.length === 0) {
                response = {
                    ...response,
                    detallesActualizados: detallesOriginales
                };
            }
        }

        // Validar que response exista y tenga la estructura esperada antes de retornar
        if (!response) return { success: false, error: 'Respuesta vacía del servidor al procesar inventario.' };

        // Si el RPC devuelve success:false por cualquier motivo distinto a stock_insuficiente
        // (ya manejado arriba), propagar el error en vez de retornar success:true al llamador.
        if (response.success === false) {
            return { success: false, error: response.error || 'Error desconocido al procesar inventario.' };
        }

        return { 
            success: true, 
            costoTotalVenta: response.costoTotalVenta || 0, 
            detallesActualizados: Array.isArray(response.detallesActualizados) && response.detallesActualizados.length > 0
                ? response.detallesActualizados
                : [...detallesOriginales],
            operacionesDB: [] // Las operaciones físicas ya se realizaron en el servidor
        };
    },

    /**
     * Deprecado: Las operaciones ya se ejecutan atómicamente en el servidor en calcularSalidaInventario.
     * Mantenemos la firma para compatibilidad.
     */
    async ejecutarPlanInventario(operacionesDB, origenDocumento = null) {
        return;
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
     * Deprecado: La reversión de inventario se gestiona atómicamente en PostgreSQL mediante RPC.
     * Mantenido para compatibilidad de firma sin descargas masivas de catálogos en memoria.
     */
    async calcularReversionInventario(detalles) {
        return { success: true, operacionesDB: [] };
    }
};
