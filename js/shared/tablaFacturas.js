export function renderTablaFacturas(facturas, contactosMap, sortColumn = 'fecha', sortDirection = 'desc') {
    const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    const tbodyHtml = facturas.length > 0 ? facturas.map(c => {
        const estado = c.estado || 'por_pagar';
        let textEstadoColor = '';
        let labelEstado = '';
        
        if (estado === 'anulada' || estado === 'voided' || estado === 'void') {
            textEstadoColor = 'color: #ef4444;';
            labelEstado = 'Anulada';
        } else if (c.saldoPendiente <= 0) {
            textEstadoColor = 'color: #2cbfb7;';
            labelEstado = 'Cobrada';
        } else {
            textEstadoColor = 'color: #ef4444;';
            labelEstado = 'Por cobrar';
        }

        const numDisplay = c.numero || parseInt(String(c.id).replace(/\D/g, ''), 10) || c.id;
        
        let vencimientoColor = 'var(--text-body)';
        if (c.vencimiento) {
            const vDate = new Date(c.vencimiento);
            const hoy = new Date();
            hoy.setHours(0,0,0,0);
            if (vDate < hoy && labelEstado === 'Por cobrar') {
                vencimientoColor = '#ef4444';
            }
        }
        
        const rowOpacity = (estado === 'anulada' || estado === 'voided' || estado === 'void') ? '0.5' : '1';
        
        return `
            <tr style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body); opacity: ${rowOpacity}; transition: opacity 0.2s;" onclick="if(!event.target.closest('button')) window.location.hash = '#/ingresos/facturas/ver/${c.id}'">
                <td class="py-3">${numDisplay}</td>
                <td class="py-3">${c.fecha || ''}</td>
                <td class="py-3" style="color: ${vencimientoColor};">${c.vencimiento || ''}</td>
                <td class="py-3" style="color: var(--text-main); font-weight: var(--weight-medium);">${contactosMap[c.clienteId || c.contacto_id || c.contactoId] || 'Sin Cliente'}</td>
                <td class="py-3 text-end">${formatMoney(c.total)}</td>
                <td class="py-3 text-end">${formatMoney(c.totalPagado)}</td>
                <td class="py-3 text-end">${formatMoney(c.saldoPendiente)}</td>
                <td class="py-3 text-center" style="${textEstadoColor} font-weight: 500;">
                    ${labelEstado}
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
