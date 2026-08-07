export function renderTablaFacturas(facturas, contactosMap, sortColumn = 'fecha', sortDirection = 'desc') {
    const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    const tbodyHtml = facturas.length > 0 ? facturas.map(c => {
        const estado = c.estado || 'por_pagar';
        let labelEstado = '';
        let badgeClass = '';
        
        let isVencida = false;
        if (c.vencimiento) {
            const vDate = new Date(c.vencimiento);
            const hoy = new Date();
            hoy.setHours(0,0,0,0);
            if (vDate < hoy) isVencida = true;
        }

        if (estado === 'anulada' || estado === 'voided' || estado === 'void') {
            labelEstado = 'Anulada';
            badgeClass = 'bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle';
        } else if (c.saldoPendiente <= 0) {
            labelEstado = 'Cobrada';
            badgeClass = 'bg-primary text-primary bg-opacity-10 border border-primary-subtle';
        } else if (isVencida) {
            labelEstado = 'Vencida';
            badgeClass = 'bg-danger text-danger bg-opacity-10 border border-danger-subtle';
        } else {
            labelEstado = 'Por cobrar';
            badgeClass = 'bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle';
        }

        const numDisplay = c.numero || parseInt(String(c.id).replace(/\D/g, ''), 10) || c.id;
        
        const rowOpacity = (estado === 'anulada' || estado === 'voided' || estado === 'void') ? '0.5' : '1';
        
        return `
            <tr style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body); opacity: ${rowOpacity}; transition: opacity 0.2s;" onclick="if(!event.target.closest('button')) window.location.hash = '#/ingresos/facturas/ver/${c.id}'">
                <td class="py-3">${numDisplay}</td>
                <td class="py-3">${c.fecha || ''}</td>
                <td class="py-3 ${isVencida && c.saldoPendiente > 0 ? 'text-danger fw-semibold' : ''}">${c.vencimiento || ''}</td>
                <td class="py-3" style="color: var(--text-main); font-weight: var(--weight-medium);">${contactosMap[c.clienteId || c.contacto_id || c.contactoId] || 'Sin Cliente'}</td>
                <td class="py-3 text-end">${formatMoney(c.total)}</td>
                <td class="py-3 text-end">${formatMoney(c.totalPagado)}</td>
                <td class="py-3 text-end fw-bold text-dark">${formatMoney(c.saldoPendiente)}</td>
                <td class="py-3 text-center">
                    <span class="badge ${badgeClass} rounded-pill fw-medium" style="font-size: 11px; padding: 5px 10px;">${labelEstado}</span>
                </td>
                <td class="py-3 text-end" style="position: relative;">
                    <button class="btn btn-link text-muted p-0 me-2 btn-imprimir-row" data-id="${c.id}">
                        <i class="bi bi-printer"></i>
                    </button>
                    <button class="btn btn-link text-muted p-0 btn-menu-row" data-id="${c.id}">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('') : `<tr><td colspan="9" class="text-center py-5 text-muted">No se encontraron facturas</td></tr>`;

    return `
        <div class="table-responsive">
            <table class="table table-borderless align-middle mb-0">
                <thead style="border-bottom: 1px solid var(--border-color);">
                    <tr style="color: var(--text-muted); font-size: 13px; font-weight: var(--weight-medium);">
                        <th class="py-3 fw-normal sortable-header" data-column="numero" style="cursor: pointer; user-select: none;">
                            Número ${sortColumn === 'numero' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th class="py-3 fw-normal sortable-header" data-column="fecha" style="cursor: pointer; user-select: none;">
                            Creación ${sortColumn === 'fecha' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th class="py-3 fw-normal">Vencimiento</th>
                        <th class="py-3 fw-normal sortable-header" data-column="cliente" style="cursor: pointer; user-select: none;">
                            Cliente ${sortColumn === 'cliente' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th class="py-3 fw-normal text-end">Total</th>
                        <th class="py-3 fw-normal text-end">Cobrado</th>
                        <th class="py-3 fw-normal text-end">Por cobrar</th>
                        <th class="py-3 fw-normal text-center">Estado</th>
                        <th class="py-3 fw-normal text-end" style="width: 80px;"></th>
                    </tr>
                </thead>
                <tbody>
                    ${tbodyHtml}
                </tbody>
            </table>
        </div>
    `;
}
