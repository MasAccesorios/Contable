// js/shared/cobranzaUtils.js
// Utilidades centralizadas para cobranza y generación de Estado de Cuenta para WhatsApp
// MAS Accesorios - Sistema Contable

/**
 * Cuentas bancarias oficiales autorizadas (Constantes inmutables)
 */
export const OFICIAL_CUENTAS_BANCARIAS = Object.freeze({
    bancolombia: Object.freeze({
        banco: 'Bancolombia',
        tipo: 'Ahorros',
        numero: '54700050214',
        titular: 'Diego M Izquierdo'
    }),
    billeteras: Object.freeze({
        banco: 'Nequi / DaviPlata',
        tipo: 'Billetera Digital',
        numero: '3158512091',
        titular: 'Diego M Izquierdo'
    }),
    llaveBreB: Object.freeze({
        sistema: 'Llave Bre-B / Transfiya',
        llave: '@izquierdo638',
        descripcion: 'Cualquier banco o app'
    }),
    telefonoConfirmacion: '3158512091'
});

/**
 * Formatea un valor numérico a pesos colombianos ($ 150.000)
 */
export function formatMoneyCOP(val) {
    const num = Math.round(Number(val) || 0);
    return '$ ' + num.toLocaleString('es-CO');
}

/**
 * Normaliza un número telefónico para WhatsApp.
 * - Elimina caracteres no numéricos (+, espacios, guiones, paréntesis).
 * - Antepone el prefijo internacional de Colombia (57) a celulares de 10 dígitos.
 * - Conserva números internacionales de más de 10 dígitos.
 * - Retorna cadena vacía para números con menos de 7 dígitos o inválidos.
 */
export function normalizeWhatsAppPhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length < 7) return '';
    if (digits.length === 10) return '57' + digits;
    return digits;
}

/**
 * Resuelve de forma consistente el identificador de cliente (clienteId) desde un objeto de factura.
 * Prioridad estricta: clienteId > contacto_id > cliente.id > cliente_id
 */
export function resolveClienteIdFromFactura(factura) {
    if (!factura || typeof factura !== 'object') return null;
    const rawId = factura.clienteId ?? factura.contacto_id ?? factura.cliente?.id ?? factura.cliente_id;
    if (rawId === undefined || rawId === null) return null;
    const str = String(rawId).trim();
    return str.length > 0 ? str : null;
}

/**
 * Construye una URL directa de wa.me codificada con seguridad.
 */
export function buildWhatsAppUrl(phone, text) {
    const cleanPhone = normalizeWhatsAppPhone(phone);
    if (!cleanPhone) return null;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text || '')}`;
}

/**
 * Genera el texto del saludo oficial para WhatsApp al enviar el Estado de Cuenta / Cuenta de Cobro.
 * Por defecto genera únicamente un saludo cordial y profesional para acompañar el formato visual en hoja en blanco,
 * sin duplicar en texto el desglose de facturas ni los medios de pago (que ya residen en la hoja en blanco).
 *
 * Si se especifica options.detailed: true, genera el desglose estructurado completo.
 * Soporta firma por objeto: { cliente, facturas, fechaCorte, detailed }
 * y firma posicional: (cliente, facturas, options)
 */
export function buildEstadoCuentaWhatsAppText(arg1, arg2, arg3) {
    let cliente = null;
    let facturasRaw = [];
    let options = {};

    if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1) && ('cliente' in arg1 || 'facturas' in arg1)) {
        cliente = arg1.cliente || null;
        facturasRaw = arg1.facturas || [];
        options = arg1;
    } else {
        cliente = arg1 || null;
        facturasRaw = arg2 || [];
        options = arg3 || {};
    }

    const hoy = new Date();
    const hoyStr = options.fechaCorte || (typeof getLocalDate === 'function' ? getLocalDate() : hoy.toISOString().split('T')[0]);
    const nombreCliente = (cliente?.nombre || '').trim() || 'Cliente';

    // Filtrar facturas pendientes con saldo > 0
    const facturas = (Array.isArray(facturasRaw) ? facturasRaw : []).filter(f => (parseFloat(f?.saldo) || 0) > 0);
    const totalSaldo = facturas.reduce((sum, f) => sum + (parseFloat(f.saldo) || 0), 0);

    // CASO 1: Cliente a Paz y Salvo (0 facturas o saldo $0)
    if (totalSaldo <= 0 || facturas.length === 0) {
        let msg = `Estimado(a) *${nombreCliente}*, cordial saludo.\n\n`;
        msg += `Queremos informarle que a la fecha su estado de cuenta se encuentra *al día* y *sin saldos pendientes*.\n\n`;
        msg += `Agradecemos su puntualidad y valiosa preferencia comercial. ¡Muchas gracias!`;
        return msg;
    }

    // Si se solicita el desglose completo en texto mediante opción explícita (e.g. detailed: true)
    if (options.detailed) {
        let msg = `*ESTADO DE CUENTA - MAS ACCESORIOS*\n`;
        msg += `_Fecha de corte: ${hoyStr}_\n\n`;
        msg += `Estimado(a) *${nombreCliente}*, cordial saludo.\n`;
        if (cliente?.identificacion) {
            msg += `NIT / CC: ${cliente.identificacion}\n`;
        }

        msg += `\nLe compartimos el resumen de su estado de cuenta a la fecha:\n\n`;
        msg += `• *Saldo Total Pendiente:* *${formatMoneyCOP(totalSaldo)}*\n`;
        msg += `• *Facturas Pendientes:* ${facturas.length}\n\n`;
        msg += `📌 *Detalle de Facturas:*\n`;

        const MAX_VISIBLES = 15;
        const visibles = facturas.slice(0, MAX_VISIBLES);
        const restantes = facturas.slice(MAX_VISIBLES);

        visibles.forEach(f => {
            const num = f.numero || f.id || 'S/N';
            const fechaCreacion = f.fecha ? String(f.fecha).split('T')[0] : hoyStr;
            const venc = f.vencimiento ? String(f.vencimiento).split('T')[0] : fechaCreacion;

            let diasDespachado = f.diasDespachado;
            if (diasDespachado === undefined || diasDespachado === null) {
                const dCreacion = new Date(fechaCreacion + 'T00:00:00');
                const diffDays = Math.floor((hoy - dCreacion) / (1000 * 60 * 60 * 24));
                diasDespachado = Number.isFinite(diffDays) ? Math.max(0, diffDays) : 0;
            }

            const saldoF = formatMoneyCOP(f.saldo);
            msg += `• *Fac #${num}* | Vence: ${venc} | ${diasDespachado} días despachado | Saldo: *${saldoF}*\n`;
        });

        if (restantes.length > 0) {
            const saldoRestante = restantes.reduce((acc, f) => acc + (parseFloat(f.saldo) || 0), 0);
            msg += `• _... y ${restantes.length} factura(s) más por un saldo adicional de ${formatMoneyCOP(saldoRestante)}._\n`;
        }

        msg += `\n💳 *MEDIOS DE PAGO AUTORIZADOS:*\n`;
        msg += `• *Bancolombia (Ahorros):* ${OFICIAL_CUENTAS_BANCARIAS.bancolombia.numero}\n`;
        msg += `  Titular: ${OFICIAL_CUENTAS_BANCARIAS.bancolombia.titular}\n`;
        msg += `• *Nequi / DaviPlata:* ${OFICIAL_CUENTAS_BANCARIAS.billeteras.numero}\n`;
        msg += `  Titular: ${OFICIAL_CUENTAS_BANCARIAS.billeteras.titular}\n`;
        msg += `• *Llave Bre-B / Transfiya:* ${OFICIAL_CUENTAS_BANCARIAS.llaveBreB.llave}\n`;
        msg += `  (Transferencia inmediata desde cualquier banco o app)\n\n`;

        msg += `*Confirmar Pago:* Favor enviar su comprobante a este WhatsApp (${OFICIAL_CUENTAS_BANCARIAS.telefonoConfirmacion}) indicando el número de factura.\n\n`;
        msg += `Agradecemos regularizar el saldo pendiente a la mayor brevedad. Si ya realizó el pago, por favor compártanos el comprobante.\n¡Muchas gracias!`;

        return msg;
    }

    // CASO 2 (Por Defecto): Saludo cordial limpio y profesional acompañando el formato visual de la hoja en blanco
    let msg = `Estimado(a) *${nombreCliente}*, cordial saludo.\n\n`;
    msg += `Quedamos atentos a cualquier inquietud o a la confirmación de su pago.\n\n`;
    msg += `¡Muchas gracias por su preferencia!`;

    return msg;
}
