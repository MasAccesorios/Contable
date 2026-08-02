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
