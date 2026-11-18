import { escapeHtml, getClientAvatar } from './formatters.js';

export function renderTablaFacturas(facturas, contactosMap, sortColumn = 'fecha', sortDirection = 'desc', returnInfo = null, tipo = 'venta') {
    const isCompraTable = tipo === 'compra';
    const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    const tbodyHtml = facturas.length > 0 ? facturas.map(c => {
        const isCompra = c.tipo === 'compra' || isCompraTable;
        const estado = c.estado || 'por_pagar';
        let labelEstado = '';
        let badgeClass = '';
        
        let isVencida = false;
        const vencimiento = c.vencimiento || c.fecha || '';
        if (vencimiento) {
            const vDate = new Date(vencimiento);
            const hoy = new Date();
            hoy.setHours(0,0,0,0);
            if (vDate < hoy) isVencida = true;
        }

        if (estado === 'anulada' || estado === 'voided' || estado === 'void') {
            labelEstado = 'Anulada';
            badgeClass = 'badge-stitch-anulado';
        } else if (c.saldoPendiente <= 0) {
            labelEstado = isCompra ? 'Pagada' : 'Cobrada';
            badgeClass = 'badge-stitch-cobrado';
        } else if (isVencida) {
            labelEstado = 'Vencida';
            badgeClass = 'badge-stitch-vencido';
        } else {
            labelEstado = isCompra ? 'Por pagar' : 'Por cobrar';
            badgeClass = 'badge-stitch-pendiente';
        }

        const numDisplay = c.numero || parseInt(String(c.id).replace(/\D/g, ''), 10) || c.id;
        const rowOpacity = (estado === 'anulada' || estado === 'voided' || estado === 'void') ? '0.5' : '1';
        
        const baseRoute = isCompra ? '#/gastos/proveedores/ver/' : '#/ingresos/facturas/ver/';
        const defaultContactText = isCompra ? 'Sin Proveedor' : 'Sin Cliente';
        const contactId = c.proveedorId || c.clienteId || c.contacto_id || c.contactoId;
        const contactName = contactosMap[contactId] || defaultContactText;
        const avatar = getClientAvatar(contactName);

        const safeHash = returnInfo ? String(returnInfo.hash || "").replace(/['"\\]/g, "") : "";
        const safeLabel = returnInfo ? String(returnInfo.label || "").replace(/['"\\]/g, "") : "";
        const onclickAction = returnInfo 
            ? `if(!event.target.closest('button')) { sessionStorage.setItem('origenVolver', JSON.stringify({hash: '${safeHash}', label: '${safeLabel}'})); window.location.hash = '${baseRoute}${c.id}'; }`
            : ``;
            
        return `
            <tr class="payment-row fila-factura" data-id="${c.id}" style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13.5px; color: var(--text-body); opacity: ${rowOpacity}; transition: background-color 0.15s ease;" onclick="${onclickAction}">
                <td class="py-2.5 px-3" style="white-space: nowrap;">
                    <div class="payment-code-badge fw-bold" style="font-size: 11px;"># ${numDisplay}</div>
                </td>
                <td class="py-2.5 px-3" style="white-space: nowrap;">
                    <div class="fw-semibold text-dark tnum" style="font-size: 13px;">${c.fecha || ''}</div>
                    <div class="text-muted tnum" style="font-size: 11px;">
                        <i class="bi bi-clock me-1"></i>Vence: <span class="${isVencida && c.saldoPendiente > 0 ? 'text-danger fw-bold' : ''}">${vencimiento}</span>
                    </div>
                </td>
                <td class="py-2.5 px-3">
                    <div class="d-flex align-items-center gap-2">
                        <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 32px; height: 32px; font-size: 12px; flex-shrink: 0;">
                            ${avatar.initials}
                        </div>
                        <div class="text-truncate" style="max-width: 220px;">
                            <div class="fw-bold text-dark text-truncate" style="font-size: 13px;" title="${escapeHtml(contactName)}">
                                ${escapeHtml(contactName)}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="py-2.5 px-3 text-end tnum cell-numeric" style="white-space: nowrap; font-size: 13.5px;">${formatMoney(c.total)}</td>
                <td class="py-2.5 px-3 text-end tnum cell-numeric text-muted" style="white-space: nowrap; font-size: 13.5px;">${formatMoney(c.totalPagado)}</td>
                <td class="py-2.5 px-3 text-end tnum cell-numeric fw-bold ${c.saldoPendiente > 0 ? 'text-danger' : 'text-success'}" style="white-space: nowrap; font-size: 14px;">${formatMoney(c.saldoPendiente)}</td>
                <td class="py-2.5 px-3 text-center" style="white-space: nowrap;">
                    <span class="badge ${badgeClass} rounded-pill fw-semibold" style="font-size: 11px; padding: 4px 10px;">${labelEstado}</span>
                </td>
                <td class="py-2.5 px-3 text-end" style="position: relative; white-space: nowrap;">
                    <div class="payment-row-actions">
                        <button class="btn btn-sm btn-light border-0 p-1 btn-quick-view-factura" data-id="${c.id}" title="Ver Detalle">
                            <i class="bi bi-eye text-primary"></i>
                        </button>
                        <button class="btn btn-sm btn-light border-0 p-1 btn-imprimir-row" data-id="${c.id}" title="Imprimir">
                            <i class="bi bi-printer text-secondary"></i>
                        </button>
                        <button class="btn btn-sm btn-light border-0 p-1 btn-menu-row" data-id="${c.id}" title="Opciones">
                            <i class="bi bi-three-dots-vertical text-secondary"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('') : `<tr><td colspan="8" class="text-center py-5 text-muted">No se encontraron facturas</td></tr>`;

    const colContactKey = isCompraTable ? 'proveedor' : 'cliente';
    const colContactLabel = isCompraTable ? 'Proveedor' : 'Cliente';
    const colCobradoLabel = isCompraTable ? 'Pagado' : 'Cobrado';
    const colPendienteLabel = isCompraTable ? 'Por pagar' : 'Por cobrar';

    return `
        <div class="table-responsive">
            <table class="table table-borderless align-middle mb-0">
                <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                    <tr>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase sortable-header" data-column="numero" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); cursor: pointer; user-select: none; white-space: nowrap; width: 110px;">
                            Número ${sortColumn === 'numero' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase sortable-header" data-column="fecha" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); cursor: pointer; user-select: none; min-width: 120px; white-space: nowrap;">
                            Fechas ${sortColumn === 'fecha' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase sortable-header" data-column="${colContactKey}" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); cursor: pointer; user-select: none; width: 100%; min-width: 160px;">
                            ${colContactLabel} ${sortColumn === colContactKey ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase text-end" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); min-width: 110px; white-space: nowrap;">Total</th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase text-end" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); min-width: 110px; white-space: nowrap;">${colCobradoLabel}</th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase text-end" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); min-width: 110px; white-space: nowrap;">${colPendienteLabel}</th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase text-center" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); min-width: 100px; white-space: nowrap;">Estado</th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase text-end" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); width: 90px; white-space: nowrap;"></th>
                    </tr>
                </thead>
                <tbody>
                    ${tbodyHtml}
                </tbody>
            </table>
        </div>
    `;
}
