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
    // 1. Obtener las filas afectadas (id, factura_id, grupo_pago_id) antes de anular
    let querySelect = supabase.from('pagos_ingresos').select('id, factura_id, grupo_pago_id');
    if (esGrupo) {
        querySelect = querySelect.eq('grupo_pago_id', idOGrupo);
    } else {
        querySelect = querySelect.eq('id', parseInt(idOGrupo, 10));
    }
    const { data: filasAfectadas } = await querySelect;
    const facturaIds = [...new Set((filasAfectadas || []).map(f => f.factura_id).filter(Boolean))];
    const idsAnulados = new Set((filasAfectadas || []).map(f => String(f.id)));

    let estadosFacturas = [];

    // 2. Recalcular estado de las facturas afectadas, tratando las filas que se van a anular
    //    como ya anuladas en el cálculo local (sin depender de que la escritura ya haya ocurrido)
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
                    tipo: t.tipo === 'in' ? 'ingreso' : 'egreso',
                    estado: idsAnulados.has(String(t.id)) ? 'anulado' : t.estado
                }));

                const metricas = calcularEstadoFactura(f, txMapeadas);
                estadosFacturas.push({ id: f.id, estado: metricas.estado });
            }
        }
    }

    // 3. Anular la(s) transaccion(es) y actualizar las facturas en una sola transaccion atomica
    const { error } = await supabase.rpc('anular_transaccion_y_actualizar_facturas', {
        p_es_grupo: esGrupo,
        p_pago_id: esGrupo ? null : parseInt(idOGrupo, 10),
        p_grupo_pago_id: esGrupo ? idOGrupo : null,
        p_estados_facturas: estadosFacturas
    });
    if (error) throw error;

    if (DB.invalidateCache) {
        DB.invalidateCache('transacciones');
        if (facturaIds.length > 0) DB.invalidateCache('facturas');
    }
}
