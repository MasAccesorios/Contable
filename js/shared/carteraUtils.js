// js/shared/carteraUtils.js

/**
 * Motor compartido para cálculo en vivo de saldos y estados de facturas.
 * Se alimenta exclusivamente del historial de transacciones, eliminando la 
 * necesidad de campos estáticos (saldo/estado) propensos a desincronización.
 */

/**
 * Calcula el estado y saldo de una factura dinámicamente.
 * 
 * @param {Object} factura - Objeto factura base.
 * @param {Array} todasLasTransacciones - Lista completa de transacciones del sistema.
 * @returns {Object} Objeto con las métricas en vivo.
 */
export const calcularEstadoFactura = (factura, todasLasTransacciones) => {
    // Si la factura está explícitamente anulada, respetamos ese estado terminal.
    if (factura.estado === 'anulada') {
        return {
            estado: 'anulada',
            saldo: 0,
            totalPagado: 0
        };
    }

    const totalFactura = parseFloat(factura.total) || 0;

    // 1. Filtrar solo las transacciones correspondientes
    // Si la factura es explícitamente 'venta', asume ingreso. Cualquier otro tipo (compra, gasto) asume egreso.
    const tipoTransaccion = factura.tipo === 'venta' ? 'ingreso' : 'egreso';
    const transaccionesFactura = todasLasTransacciones.filter(t => 
        t.referenciaId === factura.id && 
        t.tipo === tipoTransaccion
    );

    // 2. Sumar el total pagado/recaudado
    const totalPagado = transaccionesFactura.reduce((sum, t) => {
        const monto = parseFloat(t.monto) || parseFloat(t.valor) || parseFloat(t.total) || 0;
        return sum + monto;
    }, 0);

    // 3. Calcular el saldo pendiente real
    let saldoPendiente = totalFactura - totalPagado;

    // Prevención de saldos negativos por errores humanos o ajustes (dejar en 0)
    if (saldoPendiente < 0) {
        saldoPendiente = 0; 
    }

    // 4. Determinar estado dinámico
    let estadoDinamico = 'pendiente';
    if (saldoPendiente <= 0) {
        estadoDinamico = 'pagada';
    } else if (totalPagado > 0 && saldoPendiente > 0) {
        estadoDinamico = 'parcial';
    } else {
        estadoDinamico = 'pendiente';
    }

    return {
        estado: estadoDinamico,
        saldo: saldoPendiente,
        totalPagado: totalPagado
    };
};
