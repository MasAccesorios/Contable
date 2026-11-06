import { escapeHtml } from './formatters.js';

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

        const onclickAction = returnInfo 
            ? `if(!event.target.closest('button')) { sessionStorage.setItem('origenVolver', JSON.stringify({hash: '${returnInfo.hash}', label: '${returnInfo.label}'})); window.location.hash = '${baseRoute}${c.id}'; }`
            : `if(!event.target.closest('button')) window.location.hash = '${baseRoute}${c.id}'`;
            
        return `
            <tr style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13.5px; color: var(--text-body); opacity: ${rowOpacity}; transition: background-color 0.15s ease;" onclick="${onclickAction}">
                <td class="py-2.5 px-3 fw-semibold text-primary" style="white-space: nowrap;">${numDisplay}</td>
                <td class="py-2.5 px-3 tnum text-muted" style="white-space: nowrap;">${c.fecha || ''}</td>
                <td class="py-2.5 px-3 tnum ${isVencida && c.saldoPendiente > 0 ? 'text-danger fw-semibold' : 'text-muted'}" style="white-space: nowrap;">${vencimiento}</td>
                <td class="py-2.5 px-3" style="color: var(--text-main); font-weight: var(--weight-medium); max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(contactosMap[contactId]) || defaultContactText}</td>
                <td class="py-2.5 px-3 text-end tnum cell-numeric" style="white-space: nowrap;">${formatMoney(c.total)}</td>
                <td class="py-2.5 px-3 text-end tnum cell-numeric text-muted" style="white-space: nowrap;">${formatMoney(c.totalPagado)}</td>
                <td class="py-2.5 px-3 text-end tnum cell-numeric fw-bold text-dark" style="white-space: nowrap;">${formatMoney(c.saldoPendiente)}</td>
                <td class="py-2.5 px-3 text-center">
                    <span class="badge ${badgeClass} rounded-pill fw-semibold" style="font-size: 11px; padding: 4px 10px;">${labelEstado}</span>
                </td>
                <td class="py-2.5 px-3 text-end" style="position: relative; white-space: nowrap;">
                    <button class="btn btn-link text-muted p-1 me-1 btn-imprimir-row" data-id="${c.id}" title="Imprimir">
                        <span class="material-symbols-outlined text-[18px]">print</span>
                    </button>
                    <button class="btn btn-link text-muted p-1 btn-menu-row" data-id="${c.id}" title="Opciones">
                        <span class="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('') : `<tr><td colspan="9" class="text-center py-5 text-muted">No se encontraron facturas</td></tr>`;

    const colContactKey = isCompraTable ? 'proveedor' : 'cliente';
    const colContactLabel = isCompraTable ? 'Proveedor' : 'Cliente';
    const colCobradoLabel = isCompraTable ? 'Pagado' : 'Cobrado';
    const colPendienteLabel = isCompraTable ? 'Por pagar' : 'Por cobrar';

    return `
        <div class="table-responsive">
            <table class="table table-borderless align-middle mb-0">
                <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                    <tr>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase sortable-header" data-column="numero" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); cursor: pointer; user-select: none; white-space: nowrap;">
                            Número ${sortColumn === 'numero' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase sortable-header" data-column="fecha" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); cursor: pointer; user-select: none; min-width: 105px; white-space: nowrap;">
                            Creación ${sortColumn === 'fecha' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); min-width: 105px; white-space: nowrap;">Vencimiento</th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase sortable-header" data-column="${colContactKey}" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); cursor: pointer; user-select: none; width: 100%; min-width: 150px;">
                            ${colContactLabel} ${sortColumn === colContactKey ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase text-end" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); min-width: 110px; white-space: nowrap;">Total</th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase text-end" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); min-width: 110px; white-space: nowrap;">${colCobradoLabel}</th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase text-end" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); min-width: 110px; white-space: nowrap;">${colPendienteLabel}</th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase text-center" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); min-width: 100px; white-space: nowrap;">Estado</th>
                        <th class="py-2.5 px-3 fw-semibold text-uppercase text-end" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); width: 80px; white-space: nowrap;"></th>
                    </tr>
                </thead>
                <tbody>
                    ${tbodyHtml}
                </tbody>
            </table>
        </div>
    `;
}
