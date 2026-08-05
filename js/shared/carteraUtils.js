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
    if (factura.estado === 'anulada' || factura.estado === 'void') {
        return { estado: 'anulada', saldo: 0, totalPagado: 0 };
    }

    // Si la factura fue marcada explícitamente como pagada en BD (ej. por notas de crédito o anticipos sin recibo)
    if (factura.estado === 'pagada' || factura.estado === 'closed') {
        return { estado: 'pagada', saldo: 0, totalPagado: parseFloat(factura.total) || 0 };
    }

    const totalFactura = parseFloat(factura.total) || 0;

    // 1. Filtrar solo las transacciones correspondientes
    const tipoTransaccion = (factura.tipo === 'compra' || factura.tipo === 'gasto') ? 'egreso' : 'ingreso';
    
    const transaccionesFactura = todasLasTransacciones.filter(t => 
        (String(t.referenciaId) === String(factura.id) || String(t.factura_id) === String(factura.id)) && 
        t.tipo === tipoTransaccion
    );

    let startingBalance;
    let paymentsToConsider;

    if (factura.saldo_original !== undefined && factura.saldo_original !== null) {
        startingBalance = parseFloat(factura.saldo_original);
        // FACTURA HISTÓRICA: Solo deducimos pagos genuinamente NUEVOS (creados después del snapshot)
        paymentsToConsider = transaccionesFactura.filter(t => {
            const tId = parseInt(t.id, 10);
            
            // 1. Bloquear pagos que ya existían antes del snapshot de Alegra
            if (tId <= 22669) return false;

            // 2. Prevenir DOBLE DEDUCCIÓN de pagos split (los cuales db.js oculta sus 'observaciones').
            // Usamos la fecha del pago como heurística: si la fecha del recibo es menor al 26 de Julio, 
            // es un saldo que ya estaba consolidado en saldo_original, por tanto NO se resta de nuevo.
            if (t.fecha && new Date(t.fecha) < new Date('2026-07-26')) return false;

            // 3. Salvaguarda original (por si db.js se arregla y envía observaciones)
            if (t.observaciones && String(t.observaciones).includes('Split del pago')) return false;

            return true;
        });
    } else {
        startingBalance = totalFactura;
        paymentsToConsider = transaccionesFactura;
    }

    // 2. Sumar el total pagado/recaudado
    const totalPagadoNuevo = paymentsToConsider.reduce((sum, t) => {
        const monto = parseFloat(t.monto) || parseFloat(t.valor) || parseFloat(t.total) || 0;
        return sum + monto;
    }, 0);

    // 3. Calcular el saldo pendiente real
    let saldoPendiente = startingBalance - totalPagadoNuevo;

    // Prevención de saldos negativos por errores humanos o ajustes (dejar en 0)
    if (saldoPendiente < 0) {
        saldoPendiente = 0; 
    }

    // 4. Determinar estado dinámico
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

/**
 * Filtra y devuelve la cartera estricta (Cuentas por Cobrar o Cuentas por Pagar)
 * aplicando reglas de negocio: excluye pagadas/anuladas, filtra por tipo de contacto,
 * y descarta registros históricos obsoletos.
 * 
 * @param {Array} facturasRaw - Lista cruda de facturas.
 * @param {Array} transacciones - Lista de transacciones para el cálculo en vivo.
 * @param {Array} contactos - Lista de contactos para validar tipo.
 * @param {String} tipoCartera - 'cxc' (Cuentas por Cobrar) o 'cxp' (Cuentas por Pagar).
 * @returns {Array} Array de facturas filtradas y decoradas con saldo/estado.
 */
export const obtenerCarteraFiltrada = (facturasRaw, transacciones, contactos, tipoCartera = 'cxc') => {
    // Optimización O(1): Indexar transacciones por factura_id para evitar filtro iterativo pesado
    const transaccionesPorFactura = new Map();
    for (const t of transacciones) {
        const fId = String(t.referenciaId || t.factura_id);
        if (!fId || fId === 'undefined' || fId === 'null') continue;
        if (!transaccionesPorFactura.has(fId)) {
            transaccionesPorFactura.set(fId, []);
        }
        transaccionesPorFactura.get(fId).push(t);
    }

    // 1. Decorar facturas con métricas en tiempo real
    const facturasDecoradas = facturasRaw.map(f => {
        // En lugar de pasar las 24.000, pasamos solo las suyas (O(1))
        const tFactura = transaccionesPorFactura.get(String(f.id)) || [];
        
        const dinamico = calcularEstadoFactura(f, tFactura);
        return { ...f, estado: dinamico.estado, saldo: dinamico.saldo, totalPagado: dinamico.totalPagado };
    });

    // 2. Filtro estricto de cartera
    const filtrarFactura = (f, buscaCxp) => {
        // Regla 1: Filtro de Estado (excluir cerradas o nulas)
        if (f.estado === 'pagada' || f.estado === 'anulada' || f.estado === 'void' || f.estado === 'closed') return false;

        // Regla 3: Filtro de Vigencia (excluir históricas del 2017)
        const anio = new Date(f.fecha || f.vencimiento || f.created_at || new Date()).getFullYear();
        if (anio <= 2017) return false;

        // Regla 2: Filtro de Tipo de Documento (Venta vs Compra explícito tiene prioridad)
        if (f.tipo) {
            if (!buscaCxp && f.tipo !== 'venta') return false;
            if (buscaCxp && f.tipo !== 'compra') return false;
        } else {
            // Fallback legacy (por tipo de contacto)
            const cId = f.contacto_id || f.clienteId;
            if (cId) {
                const contacto = contactos.find(c => String(c.id) === String(cId));
                if (contacto) {
                    // Si contacto.es_cliente/proveedor no existe (aún no migrado localmente), caer a legacy
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
            // Evaluamos con la misma lógica subyacente
            if (filtrarFactura(f, false)) cxc.push(f);
            if (filtrarFactura(f, true)) cxp.push(f);
        }
        return { cxc, cxp };
    }

    return facturasDecoradas.filter(f => filtrarFactura(f, tipoCartera === 'cxp'));
};
