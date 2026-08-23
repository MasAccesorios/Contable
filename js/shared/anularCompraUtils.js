export async function anularFacturaCompra(id, { DB, EstadoUtils, InventarioUtils, supabase, CoreActions }) {
    const factura = await DB.get('facturas', id);
    if (!factura) throw new Error("Factura no encontrada.");
    if (EstadoUtils.estaAnulado(factura.estado)) {
        return { alreadyAnnulled: true };
    }

    const revertResult = await InventarioUtils.revertirLotesPorCompra(factura.numero);
    if (!revertResult.success) {
        throw new Error(revertResult.error);
    }

    const { data: pagos, error: pagosErr } = await supabase
        .from('pagos_ingresos')
        .select('id, grupo_pago_id')
        .eq('factura_id', id)
        .neq('estado', 'anulado');

    if (pagosErr) throw new Error("Error al consultar pagos asociados: " + pagosErr.message);

    if (pagos && pagos.length > 0) {
        const { anularTransaccion } = await import('./transaccionesUtils.js');
        const processedGroups = new Set();
        for (const pago of pagos) {
            if (pago.grupo_pago_id) {
                if (!processedGroups.has(pago.grupo_pago_id)) {
                    await anularTransaccion(pago.grupo_pago_id, true);
                    processedGroups.add(pago.grupo_pago_id);
                }
            } else {
                await anularTransaccion(pago.id, false);
            }
        }
    }

    factura.estado = 'anulada';
    await DB.save('facturas', factura);

    return { success: true };
}
