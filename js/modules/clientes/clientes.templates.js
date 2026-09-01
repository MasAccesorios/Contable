export const ContactosTemplates = {
    renderKpis({ total, clientes, proveedores }) {
        const kpiTotal = this.element.querySelector('#kpi-total-contactos');
        const kpiCli   = this.element.querySelector('#kpi-clientes');
        const kpiProv  = this.element.querySelector('#kpi-proveedores');
        if (kpiTotal)  kpiTotal.textContent  = total;
        if (kpiCli)    kpiCli.textContent    = clientes;
        if (kpiProv)   kpiProv.textContent   = proveedores;
    },

    renderGrid(rows, totalCount) {
        const wrapper = this.element.querySelector('#tabla-contactos-wrapper');
        if (wrapper) wrapper.style.display = 'block';

        const container = this.element.querySelector('#tbody-contactos');
        if (!container) return;

        const { currentPage, itemsPerPage } = this.state;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex   = Math.min(startIndex + rows.length, totalCount);
        const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

        // Renderizado de filas
        if (rows.length === 0) {
            container.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No se encontraron contactos que coincidan con la búsqueda.</td></tr>`;
        } else {
            let html = '';
            rows.forEach(c => {
                const inicial    = c.nombre ? c.nombre.charAt(0).toUpperCase() : '?';
                let badges = [];
                if (c.es_cliente) {
                    badges.push(`<span class="badge bg-success text-success bg-opacity-10 border border-success-subtle rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">Cliente</span>`);
                }
                if (c.es_proveedor) {
                    badges.push(`<span class="badge bg-primary text-primary bg-opacity-10 border border-primary-subtle rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">Proveedor</span>`);
                }
                if (badges.length === 0) {
                    // Fallback
                    const isCliente = (c.tipo || '').toLowerCase() === 'cliente';
                    const isProveedor = (c.tipo || '').toLowerCase() === 'proveedor';
                    if (isCliente) badges.push(`<span class="badge bg-success text-success bg-opacity-10 border border-success-subtle rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">Cliente</span>`);
                    else if (isProveedor) badges.push(`<span class="badge bg-primary text-primary bg-opacity-10 border border-primary-subtle rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">Proveedor</span>`);
                    else badges.push(`<span class="badge bg-light text-dark border rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">${c.tipo || '-'}</span>`);
                }
                const tipoBadge = badges.join('&nbsp;');

                html += `
                    <tr data-id="${c.id}" style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: var(--fs-base); color: var(--text-body);" onclick="if(!event.target.closest('button') && !event.target.closest('input')) window.location.hash = '#/contactos/ver/${c.id}'">
                        <td class="py-2"><input type="checkbox" class="form-check-input contact-check"></td>
                        <td class="py-2">
                            <div class="d-flex align-items-center gap-3">
                                <div class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0" style="width: 32px; height: 32px; background-color: var(--primary); font-size: var(--fs-md);">
                                    ${inicial}
                                </div>
                                <span class="fw-medium text-dark text-capitalize text-truncate" style="max-width: 200px;">${c.nombre ? c.nombre.toLowerCase() : ''}</span>
                            </div>
                        </td>
                        <td class="py-2 text-muted">${c.nit || '-'}</td>
                        <td class="py-2 text-muted">${c.telefono || '-'}</td>
                        <td class="py-2">${tipoBadge}</td>
                        <td class="py-2 text-end">
                            <button class="btn btn-sm btn-light text-muted btn-editar me-1" data-id="${c.id}" title="Editar"><i class="bi bi-pencil"></i></button>
                            <div class="dropdown d-inline-block">
                                <button class="btn btn-sm btn-light text-muted border-0" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
                                <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                                    <li><a class="dropdown-item btn-ver" href="#" data-id="${c.id}">Ver detalles</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item text-danger btn-eliminar" href="#" data-id="${c.id}">Eliminar</a></li>
                                </ul>
                            </div>
                        </td>
                    </tr>
                `;
            });
            container.innerHTML = html;
        }

        // UI Paginación
        const paginasEl      = this.element.querySelector('#current-page');
        const totalPagEl     = this.element.querySelector('#total-pages');
        const showingCountEl = this.element.querySelector('#showing-count');
        const prevBtn        = this.element.querySelector('#btn-prev-page');
        const nextBtn        = this.element.querySelector('#btn-next-page');

        if (paginasEl)      paginasEl.textContent  = currentPage;
        if (totalPagEl)     totalPagEl.textContent  = totalPages;
        if (showingCountEl) showingCountEl.textContent = totalCount > 0
            ? `${startIndex + 1}-${endIndex} de ${totalCount}`
            : '0-0 de 0';
        if (prevBtn) prevBtn.disabled = (currentPage === 1);
        if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);

        this.bindFilaEvents();
    },
};
