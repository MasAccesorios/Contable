// js/shared/carteraUtils.js

/**
 * Motor compartido para cálculo en vivo de saldos y estados de facturas.
 * Se alimenta exclusivamente del historial de transacciones, eliminando la
 * necesidad de campos estáticos (saldo/estado) propensos a desincronización.
 */

export const calcularEstadoFactura = (factura, todasLasTransacciones) => {
    // Si la factura está explícitamente anulada, respetamos ese estado terminal.
    if (factura.estado === 'anulada' || factura.estado === 'void') {
        return { estado: 'anulada', saldo: 0, totalPagado: 0 };
    }

    const totalFactura = parseFloat(factura.total) || 0;

    // 1. Filtrar solo las transacciones correspondientes, EXCLUYENDO pagos anulados
    const tipoTransaccion = (factura.tipo === 'compra' || factura.tipo === 'gasto') ? 'egreso' : 'ingreso';

    const transaccionesFactura = todasLasTransacciones.filter(t =>
        (String(t.referenciaId) === String(factura.id) || String(t.factura_id) === String(factura.id)) &&
        t.tipo === tipoTransaccion &&
        t.estado !== 'anulado'
    );

    let startingBalance;
    let paymentsToConsider;

    if (factura.saldo_original !== undefined && factura.saldo_original !== null) {
        startingBalance = parseFloat(factura.saldo_original);
        paymentsToConsider = transaccionesFactura.filter(t => {
            const tId = parseInt(t.id, 10);
            if (tId <= 22669) return false;
            if (t.fecha && new Date(t.fecha) < new Date('2026-07-26')) return false;
            if (t.observaciones && String(t.observaciones).includes('Split del pago')) return false;
            return true;
        });
    } else {
        startingBalance = totalFactura;
        paymentsToConsider = transaccionesFactura;
    }

    const totalPagadoNuevo = paymentsToConsider.reduce((sum, t) => {
        const monto = parseFloat(t.monto) || parseFloat(t.valor) || parseFloat(t.total) || 0;
        return sum + monto;
    }, 0);

    let saldoPendiente = startingBalance - totalPagadoNuevo;
    if (saldoPendiente < 0) saldoPendiente = 0;

    let estadoDinamico = 'pendiente';
    if (saldoPendiente <= 0) {
        estadoDinamico = 'pagada';
    } else if (saldoPendiente < totalFactura) {
        estadoDinamico = 'parcial';
    } else {
        estadoDinamico = 'pendiente';
    }

    return {
        estado: estadoDinamico,
        saldo: saldoPendiente,
        totalPagado: totalFactura - saldoPendiente
    };
};

export const obtenerCarteraFiltrada = (facturasRaw, transacciones, contactos, tipoCartera = 'cxc') => {
    const transaccionesPorFactura = new Map();
    for (const t of transacciones) {
        const fId = String(t.referenciaId || t.factura_id);
        if (!fId || fId === 'undefined' || fId === 'null') continue;
        if (!transaccionesPorFactura.has(fId)) {
            transaccionesPorFactura.set(fId, []);
        }
        transaccionesPorFactura.get(fId).push(t);
    }

    const facturasDecoradas = facturasRaw.map(f => {
        const tFactura = transaccionesPorFactura.get(String(f.id)) || [];
        const dinamico = calcularEstadoFactura(f, tFactura);
        return { ...f, estado: dinamico.estado, saldo: dinamico.saldo, totalPagado: dinamico.totalPagado };
    });

    const filtrarFactura = (f, buscaCxp) => {
        if (f.estado === 'pagada' || f.estado === 'anulada' || f.estado === 'void' || f.estado === 'closed') return false;

        const anio = new Date(f.fecha || f.vencimiento || f.created_at || new Date()).getFullYear();
        if (anio <= 2017) return false;

        if (f.tipo) {
            if (!buscaCxp && f.tipo !== 'venta') return false;
            if (buscaCxp && f.tipo !== 'compra') return false;
        } else {
            const cId = f.contacto_id || f.clienteId;
            if (cId) {
                const contacto = contactos.find(c => String(c.id) === String(cId));
                if (contacto) {
                    const esCli = contacto.es_cliente !== undefined ? contacto.es_cliente : contacto.tipo !== 'proveedor';
                    const esProv = contacto.es_proveedor !== undefined ? contacto.es_proveedor : contacto.tipo === 'proveedor';
                    if (!buscaCxp && !esCli) return false;
                    if (buscaCxp && !esProv) return false;
                } else if (buscaCxp) {
                    return false;
                }
            } else if (buscaCxp) {
                return false;
            }
        }

        return true;
    };

    if (tipoCartera === 'ambas') {
        const cxc = [];
        const cxp = [];
        for (const f of facturasDecoradas) {
            if (filtrarFactura(f, false)) cxc.push(f);
            if (filtrarFactura(f, true)) cxp.push(f);
        }
        return { cxc, cxp };
    }

    return facturasDecoradas.filter(f => filtrarFactura(f, tipoCartera === 'cxp'));
};
