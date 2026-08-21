export function renderTablaFacturas(facturas, contactosMap, sortColumn = 'fecha', sortDirection = 'desc', returnInfo = null) {
    const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    const tbodyHtml = facturas.length > 0 ? facturas.map(c => {
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
        
        const onclickAction = returnInfo 
            ? `if(!event.target.closest('button')) { sessionStorage.setItem('origenVolver', JSON.stringify({hash: '${returnInfo.hash}', label: '${returnInfo.label}'})); window.location.hash = '#/ingresos/facturas/ver/${c.id}'; }`
            : `if(!event.target.closest('button')) window.location.hash = '#/ingresos/facturas/ver/${c.id}'`;
            
        return `
            <tr style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body); opacity: ${rowOpacity}; transition: opacity 0.2s;" onclick="${onclickAction}">
                <td class="py-2" style="white-space: nowrap;">${numDisplay}</td>
                <td class="py-2" style="white-space: nowrap;">${c.fecha || ''}</td>
                <td class="py-2 ${isVencida && c.saldoPendiente > 0 ? 'text-danger fw-semibold' : ''}" style="white-space: nowrap;">${vencimiento}</td>
                <td class="py-2" style="color: var(--text-main); font-weight: var(--weight-medium); max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${contactosMap[c.clienteId || c.contacto_id || c.contactoId] || 'Sin Cliente'}</td>
                <td class="py-2 text-end" style="white-space: nowrap;">${formatMoney(c.total)}</td>
                <td class="py-2 text-end" style="white-space: nowrap;">${formatMoney(c.totalPagado)}</td>
                <td class="py-2 text-end fw-bold text-dark" style="white-space: nowrap;">${formatMoney(c.saldoPendiente)}</td>
                <td class="py-2 text-center">
                    <span class="badge ${badgeClass} rounded-pill fw-medium" style="font-size: 11px; padding: 5px 10px;">${labelEstado}</span>
                </td>
                <td class="py-2 text-end" style="position: relative; white-space: nowrap;">
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
                <thead class="ds-table-header">
                    <tr>
                        <th class="py-2 fw-normal sortable-header" data-column="numero" style="cursor: pointer; user-select: none; white-space: nowrap;">
                            Número ${sortColumn === 'numero' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th class="py-2 fw-normal sortable-header" data-column="fecha" style="cursor: pointer; user-select: none; min-width: 105px; white-space: nowrap;">
                            Creación ${sortColumn === 'fecha' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th class="py-2 fw-normal" style="min-width: 105px; white-space: nowrap;">Vencimiento</th>
                        <th class="py-2 fw-normal sortable-header" data-column="cliente" style="cursor: pointer; user-select: none; width: 100%; min-width: 150px;">
                            Cliente ${sortColumn === 'cliente' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th class="py-2 fw-normal text-end" style="min-width: 110px; white-space: nowrap;">Total</th>
                        <th class="py-2 fw-normal text-end" style="min-width: 110px; white-space: nowrap;">Cobrado</th>
                        <th class="py-2 fw-normal text-end" style="min-width: 110px; white-space: nowrap;">Por cobrar</th>
                        <th class="py-2 fw-normal text-center" style="min-width: 100px; white-space: nowrap;">Estado</th>
                        <th class="py-2 fw-normal text-end" style="width: 80px; white-space: nowrap;"></th>
                    </tr>
                </thead>
                <tbody>
                    ${tbodyHtml}
                </tbody>
            </table>
        </div>
    `;
}
