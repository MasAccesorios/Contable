import { supabase } from '../../core/supabase.js';
import { InventarioUtils } from '../../shared/inventarioUtils.js';

export const NotasCreditoData = {
    async anularNotaCredito(id) {
        // 1. Snapshot del estado previo (Cabecera y Pago Cruzado)
        const { data: snapshotNota, error: errN } = await supabase.from('notas_credito').select('*').eq('id', id).single();
        if (errN || !snapshotNota) throw new Error("No se encontró la nota de crédito");
        
        const { data: pagosCruzados, error: errPago } = await supabase
            .from('pagos_ingresos')
            .select('*')
            .eq('referencia', 'NC-' + snapshotNota.numero);

        if (errPago) throw new Error("Error al consultar el pago cruzado: " + errPago.message);

        let snapshotPago = null;
        if (pagosCruzados && pagosCruzados.length > 0) {
            let candidatos = pagosCruzados;
            if (candidatos.length > 1 && snapshotNota.factura_id) {
                candidatos = candidatos.filter(p => String(p.factura_id) === String(snapshotNota.factura_id));
            }

            if (candidatos.length > 1) {
                throw new Error("No se pudo identificar el pago cruzado de forma única, revisar manualmente.");
            }

            snapshotPago = candidatos[0] || null;
        }

        // 2. Fetch detalles para calcular salida de inventario
        const { data: detalles } = await supabase.from('nota_credito_detalles').select('*').eq('nota_credito_id', id);
        
        // 3. FASE 1: Cálculo en memoria (Read-Only)
        let planSalida = null;
        if (detalles && detalles.length > 0) {
            const outItems = detalles.map(d => ({ productoId: d.producto_id, cantidad: d.cantidad }));
            planSalida = await InventarioUtils.calcularSalidaInventario(outItems);
            if (!planSalida.success) throw new Error("No hay stock suficiente para anular la nota de crédito: " + planSalida.error);
        }

        try {
            // 4. FASE 2: Escritura Documental (Update de estado)
            const { error: updErr1 } = await supabase.from('notas_credito').update({ estado: 'anulada' }).eq('id', id);
            if (updErr1) throw new Error(updErr1.message);

            if (snapshotPago) {
                const { error: updErr2 } = await supabase.from('pagos_ingresos').update({ estado: 'anulado' }).eq('id', snapshotPago.id);
                if (updErr2) throw new Error(updErr2.message);
            }

            // 5. FASE 3: Modificación Física de Inventario con rollback interno
            if (planSalida) {
                const origenDoc = 'anulacion_nota_credito:' + snapshotNota.numero;
                await InventarioUtils.ejecutarPlanInventario(planSalida.operacionesDB, origenDoc);
            }

        } catch (errorTransaccion) {
            console.error("Error crítico anulando nota, revirtiendo base de datos...", errorTransaccion);
            // 6. ROLLBACK COMPENSATORIO EXTERNO
            await supabase.from('notas_credito').update({ estado: snapshotNota.estado }).eq('id', id);
            if (snapshotPago) {
                await supabase.from('pagos_ingresos').update({ estado: snapshotPago.estado }).eq('id', snapshotPago.id);
            }
            throw new Error("Error al anular la nota. Se ha revertido la operación por seguridad.");
        }
    },
};
