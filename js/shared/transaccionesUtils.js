import { supabase } from '../core/supabase.js';

export function agruparTransaccionesPorPago(transacciones) {
    const grupos = {};
    (transacciones || []).forEach(t => {
        const key = t.grupo_pago_id || ('single_' + t.id);
        if (!grupos[key]) {
            grupos[key] = { ...t, monto: 0, idsIncluidos: [], facturaIdsIncluidas: [] };
        }
        grupos[key].monto += Number(t.monto);
        grupos[key].idsIncluidos.push(t.id);
        if (t.factura_id) grupos[key].facturaIdsIncluidas.push(t.factura_id);
    });
    return Object.values(grupos);
}

export async function anularTransaccion(id) {
    const idInt = parseInt(id, 10);
    if (isNaN(idInt)) throw new Error("ID de transacción inválido");
    
    const { error } = await supabase
        .from('pagos_ingresos')
        .update({ estado: 'anulado' })
        .eq('id', idInt);
        
    if (error) throw error;
}
