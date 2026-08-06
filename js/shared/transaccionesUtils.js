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
    // 1. Obtener los factura_id afectados antes de anular
    let querySelect = supabase.from('pagos_ingresos').select('factura_id');
    if (esGrupo) {
        querySelect = querySelect.eq('grupo_pago_id', idOGrupo);
    } else {
        querySelect = querySelect.eq('id', parseInt(idOGrupo, 10));
    }
    const { data: filasAfectadas } = await querySelect;
    const facturaIds = [...new Set((filasAfectadas || []).map(f => f.factura_id).filter(Boolean))];

    // 2. Anular la transacción
    let queryUpdate = supabase.from('pagos_ingresos').update({ estado: 'anulado' });
    if (esGrupo) {
        queryUpdate = queryUpdate.eq('grupo_pago_id', idOGrupo);
    } else {
        queryUpdate = queryUpdate.eq('id', parseInt(idOGrupo, 10));
    }
    const { error } = await queryUpdate;
    if (error) throw error;
    
    // 3. Recalcular y actualizar estado de las facturas afectadas
    if (facturaIds.length > 0) {
        const { data: transaccionesRelevantes } = await supabase
            .from('pagos_ingresos')
            .select('*')
            .in('factura_id', facturaIds);
            
        const { data: facturas } = await supabase
            .from('facturas')
            .select('*')
            .in('id', facturaIds);

        if (facturas && transaccionesRelevantes) {
            const { calcularEstadoFactura } = await import('./carteraUtils.js');
            for (let f of facturas) {
                const estadoOriginal = f.estado;
                f.estado = 'pendiente'; // Temporal para forzar recálculo dinámico sin short-circuit
                
                const txMapeadas = transaccionesRelevantes.map(t => ({
                    ...t,
                    tipo: t.tipo === 'in' ? 'ingreso' : 'egreso'
                }));
                
                const metricas = calcularEstadoFactura(f, txMapeadas);
                
                // Actualizamos BD siempre para asegurar que deje de decir 'pagada'/'closed' si ya no lo está
                await supabase.from('facturas').update({ estado: metricas.estado }).eq('id', f.id);
            }
        }
    }

    if (DB.invalidateCache) {
        DB.invalidateCache('transacciones');
        if (facturaIds.length > 0) DB.invalidateCache('facturas');
    }
}
