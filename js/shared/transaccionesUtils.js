import { supabase } from '../core/supabase.js';
import DB from '../core/db.js';

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

export async function anularTransaccion(idOGrupo, esGrupo = false) {
    const query = supabase.from('pagos_ingresos').update({ estado: 'anulado' });
    const { error } = esGrupo
        ? await query.eq('grupo_pago_id', idOGrupo)
        : await query.eq('id', parseInt(idOGrupo, 10));
    if (error) throw error;
    if (DB.invalidateCache) DB.invalidateCache('transacciones');
}
