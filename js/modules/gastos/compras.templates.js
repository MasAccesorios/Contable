// js/modules/gastos/compras.templates.js
import { escapeHtml } from '../../shared/formatters.js';

export function getVendorAvatar(name) {
    if (!name || name === 'Sin Proveedor' || name === 'Desconocido') {
        return { initials: '?', bg: '#f1f5f9', color: '#64748b' };
    }
    const clean = name.trim();
    const parts = clean.split(/\s+/);
    let initials = parts[0][0] || '';
    if (parts.length > 1 && parts[1][0]) initials += parts[1][0];
    initials = initials.toUpperCase();

    const colors = [
        { bg: '#eff6ff', color: '#1d4ed8' },
        { bg: '#ecfdf5', color: '#059669' },
        { bg: '#fef3c7', color: '#d97706' },
        { bg: '#f3e8ff', color: '#7e22ce' },
        { bg: '#fce7f3', color: '#be185d' },
        { bg: '#e0f2fe', color: '#0369a1' },
        { bg: '#ccfbf1', color: '#0f766e' }
    ];
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % colors.length;
    return { initials: escapeHtml(initials.substring(0, 2)), ...colors[index] };
}

export const ComprasTemplates = {
    formatMoney(val) {
        return '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    formatFecha(str) {
        if (!str || str === '---' || str === 'N/A') return '---';
        const raw = String(str).split('T')[0];
        const partes = raw.split('-');
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : escapeHtml(raw);
    },

    getEstadoBadge(c) {
        const estado = (c.estado || '').toLowerCase();
        const isAnulada = estado === 'anulada' || estado === 'void' || estado === 'voided';
        const saldo = parseFloat(c.saldoPendiente !== undefined ? c.saldoPendiente : (c.saldo_pendiente !== undefined ? c.saldo_pendiente : c.total)) || 0;

        if (isAnulada) {
            return `<span class="badge badge-stitch-anulado rounded-pill fw-semibold" style="font-size: 11px; padding: 4px 10px;">
                <i class="bi bi-x-circle me-1"></i> Anulada
            </span>`;
        }
        if (saldo <= 0) {
            return `<span class="badge badge-stitch-cobrado rounded-pill fw-semibold" style="font-size: 11px; padding: 4px 10px;">
                <i class="bi bi-check2-circle me-1"></i> Pagada
            </span>`;
        }
        if (c.isVencida) {
            return `<span class="badge badge-stitch-vencido rounded-pill fw-semibold" style="font-size: 11px; padding: 4px 10px;">
                <i class="bi bi-exclamation-triangle me-1"></i> Vencida
            </span>`;
        }
        return `<span class="badge badge-stitch-pendiente rounded-pill fw-semibold" style="font-size: 11px; padding: 4px 10px;">
            <i class="bi bi-clock me-1"></i> Por pagar
        </span>`;
    },

    renderShell(kpis = {}, tabCounts = {}, activeTab = 'todas', searchQuery = '') {
        const fmtMoney = (v) => this.formatMoney(v).replace('$ ', '');

        return `
            <div class="dash-layout p-4" style="max-width: 1200px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                
                <!-- BREADCRUMB & TAG -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div style="font-size: var(--fs-sm);" class="text-muted">
                        <span>Gastos y Proveedores</span> &gt; <span class="text-dark fw-bold">Facturas de Compra</span>
                    </div>
                    <span class="badge" style="background-color: #eff4ff; color: var(--primary); font-size: 11px; font-weight: 600; border-radius: 9999px; padding: 4px 12px; border: 1px solid #dbeafe;">
                        <i class="bi bi-box-arrow-in-down me-1"></i> Trazabilidad de Egresos & Proveedores
                    </span>
                </div>

                <!-- TOP BAR -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <h2 class="page-title mb-0 fw-bold text-dark" style="font-size: 24px; letter-spacing: -0.5px;">Facturas de Compra</h2>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Registro contable, trazabilidad de egresos, inventario y amortización a proveedores.
                        </p>
                    </div>
                    <div class="d-flex flex-wrap gap-2">
                        <a href="#" onclick="event.preventDefault(); window.history.length > 2 ? window.history.back() : window.location.hash = '#/dashboard';" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 500; font-size: 13px; border-radius: 8px;">
                            <span class="material-symbols-outlined text-[17px] me-1" style="vertical-align: text-bottom;">arrow_back</span> Volver
                        </a>
                        <button id="btn-refresh-list" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 500; font-size: 13px; border-radius: 8px;" title="Actualizar datos">
                            <span class="material-symbols-outlined text-[17px] me-1" style="vertical-align: text-bottom;">refresh</span> Actualizar
                        </button>
                        <button id="btn-export-list" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 500; font-size: 13px; border-radius: 8px;">
                            <span class="material-symbols-outlined text-[17px] me-1" style="vertical-align: text-bottom;">download</span> Exportar
                        </button>
                        <button id="btn-nueva-factura" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-1" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <span class="material-symbols-outlined text-[18px]">add</span> Nueva factura
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS EJECUTIVAS -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Total por Pagar -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #d97706;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Total por Pagar (CXP)</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-clock-history"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-warning-emphasis tnum" id="kpi-cxp-por-pagar" style="font-size: 22px;">
                                $ ${fmtMoney(kpis.totalPorPagar)}
                            </div>
                            <div class="mt-2 text-muted" id="kpi-cxp-por-pagar-sub" style="font-size: 11px;">
                                <span class="fw-semibold text-dark">${kpis.conteoPorPagar || 0}</span> facturas pendientes
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Cuentas Vencidas -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #dc2626;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Cuentas Vencidas</span>
                                <div class="payment-kpi-icon out-bg">
                                    <i class="bi bi-exclamation-octagon"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-danger tnum" id="kpi-cxp-vencidas" style="font-size: 22px;">
                                $ ${fmtMoney(kpis.cuentasVencidas)}
                            </div>
                            <div class="mt-2 text-muted" id="kpi-cxp-vencidas-sub" style="font-size: 11px;">
                                ${kpis.cuentasVencidas > 0 ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-1.5 py-0.5 rounded">${kpis.conteoVencidas || 0} en mora</span>` : '<span class="text-success"><i class="bi bi-check-circle me-1"></i>Sin saldos vencidos</span>'}
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Cuentas Vigentes -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #059669;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Cuentas Vigentes</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-shield-check"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" id="kpi-cxp-vigentes" style="font-size: 22px;">
                                $ ${fmtMoney(kpis.cuentasVigentes)}
                            </div>
                            <div class="mt-2 text-muted" id="kpi-cxp-vigentes-sub" style="font-size: 11px;">
                                <span class="fw-semibold text-dark">${kpis.conteoVigentes || 0}</span> facturas al día
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Total Pagado / Amortizado -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #2563eb;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Pagado / Amortizado</span>
                                <div class="payment-kpi-icon default-bg">
                                    <i class="bi bi-cart-check"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-primary tnum" id="kpi-cxp-pagado" style="font-size: 22px;">
                                $ ${fmtMoney(kpis.totalPagado)}
                            </div>
                            <div class="mt-2 text-muted d-flex align-items-center gap-1" id="kpi-cxp-pagado-sub" style="font-size: 11px;">
                                <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-1.5 py-0.5 rounded">
                                    ${kpis.porcentajeAmortizado || 0}% liquidado
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SEGMENTED TABS BAR -->
                <div class="payment-tabs-bar mb-3">
                    <button type="button" class="payment-tab-btn ${activeTab === 'todas' ? 'active' : ''}" data-tab="todas">
                        Todas <span class="payment-tab-badge" id="tab-count-todas">${tabCounts.todas || 0}</span>
                    </button>
                    <button type="button" class="payment-tab-btn tab-warning ${activeTab === 'por_pagar' ? 'active' : ''}" data-tab="por_pagar">
                        <i class="bi bi-clock-history text-warning"></i> Por Pagar <span class="payment-tab-badge" id="tab-count-por-pagar">${tabCounts.por_pagar || 0}</span>
                    </button>
                    <button type="button" class="payment-tab-btn tab-danger ${activeTab === 'vencidas' ? 'active' : ''}" data-tab="vencidas">
                        <i class="bi bi-exclamation-octagon text-danger"></i> Vencidas <span class="payment-tab-badge" id="tab-count-vencidas">${tabCounts.vencidas || 0}</span>
                    </button>
                    <button type="button" class="payment-tab-btn ${activeTab === 'pagadas' ? 'active' : ''}" data-tab="pagadas">
                        <i class="bi bi-patch-check-fill text-success"></i> Pagadas <span class="payment-tab-badge" id="tab-count-pagadas">${tabCounts.pagadas || 0}</span>
                    </button>
                    <button type="button" class="payment-tab-btn ${activeTab === 'anuladas' ? 'active' : ''}" data-tab="anuladas">
                        Anuladas <span class="payment-tab-badge" id="tab-count-anuladas">${tabCounts.anuladas || 0}</span>
                    </button>
                </div>

                <!-- DATA TABLE CARD -->
                <div class="dash-table-container">
                    <!-- SEARCH & FILTER TOOLBAR -->
                    <div class="card-header bg-white border-bottom p-3 d-flex flex-wrap gap-3 align-items-center justify-content-between">
                        <div class="d-flex align-items-center gap-2 flex-grow-1" style="max-width: 450px;">
                            <div class="ds-search-container w-100 position-relative">
                                <i class="bi bi-search ds-search-icon"></i>
                                <input type="text" class="ds-search-input pe-4" id="searchCompras" placeholder="Buscar por número, proveedor o concepto..." value="${escapeHtml(searchQuery || '')}" autocomplete="off">
                                <button type="button" id="clearSearchBtnCompras" class="btn btn-sm btn-link text-muted position-absolute end-0 top-50 translate-middle-y me-1 p-0 ${searchQuery ? '' : 'd-none'}" style="text-decoration: none;">
                                    <i class="bi bi-x-circle-fill"></i>
                                </button>
                            </div>
                        </div>

                        <div class="dropdown">
                            <button class="btn btn-light bg-white border text-secondary shadow-xs dropdown-toggle d-flex align-items-center gap-1.5" data-bs-toggle="dropdown" style="font-size: 13px; font-weight: 500; border-radius: 8px;">
                                <i class="bi bi-funnel"></i> Filtrar <span id="lbl-filtro-actual" style="font-weight: 600; color: var(--primary);"></span>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end shadow border-0" style="font-size: var(--fs-base);">
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="todos">Todos los campos</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="numero">Por Número</a></li>
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="proveedor">Por Proveedor</a></li>
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="fecha">Por Fecha de creación</a></li>
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="estado">Por Estado</a></li>
                            </ul>
                        </div>
                    </div>

                    <!-- GRID -->
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0 text-nowrap">
                            <thead id="compras-thead" style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                                <tr>
                                    <th class="py-2.5 px-3 fw-semibold text-uppercase sortable-header" data-column="numero" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); cursor: pointer; user-select: none;">Número</th>
                                    <th class="py-2.5 px-3 fw-semibold text-uppercase sortable-header" data-column="fecha" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); cursor: pointer; user-select: none;">Creación</th>
                                    <th class="py-2.5 px-3 fw-semibold text-uppercase" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted);">Vencimiento</th>
                                    <th class="py-2.5 px-3 fw-semibold text-uppercase sortable-header" data-column="proveedor" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted); cursor: pointer; user-select: none;">Proveedor</th>
                                    <th class="py-2.5 px-3 fw-semibold text-uppercase text-end" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted);">Total</th>
                                    <th class="py-2.5 px-3 fw-semibold text-uppercase text-end" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted);">Pagado</th>
                                    <th class="py-2.5 px-3 fw-semibold text-uppercase text-end" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted);">Por pagar</th>
                                    <th class="py-2.5 px-3 fw-semibold text-uppercase text-center" style="font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted);">Estado</th>
                                    <th class="py-2.5 px-3 fw-semibold text-uppercase text-end" style="width: 100px; font-size: 11px; letter-spacing: 0.5px; color: var(--text-muted);">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="compras-tbody">
                            </tbody>
                        </table>
                    </div>

                    <!-- PAGINATION FOOTER -->
                    <div class="card-footer bg-white border-top p-3 d-flex flex-wrap justify-content-between align-items-center gap-2" style="border-radius: 0 0 var(--border-radius-sm) var(--border-radius-sm);" id="compras-footer">
                    </div>
                </div>

                <!-- SLIDE-OVER DRAWER DE INSPECCIÓN RÁPIDA (580px) -->
                <div class="payment-drawer-backdrop" id="compras-drawer-backdrop"></div>
                <div class="payment-drawer" id="compras-drawer" style="width: 580px; max-width: 95vw;">
                    <div class="payment-drawer-header d-flex justify-content-between align-items-center p-3 border-bottom bg-light">
                        <div class="d-flex align-items-center gap-2">
                            <span class="material-symbols-outlined text-primary text-[20px]">receipt_long</span>
                            <span class="fw-bold text-dark" style="font-size: 15px;">Detalle de Factura de Compra</span>
                        </div>
                        <button type="button" class="btn-close" id="btn-close-drawer" aria-label="Cerrar"></button>
                    </div>
                    <div class="payment-drawer-body p-4" id="compras-drawer-body" style="overflow-y: auto; max-height: calc(100vh - 140px);">
                        <!-- El contenido dinámico se inyecta aquí -->
                    </div>
                    <div class="payment-drawer-footer p-3 border-top bg-light d-flex justify-content-between align-items-center" id="compras-drawer-footer">
                        <!-- Botones de acción dinámica -->
                    </div>
                </div>

            </div>
        `;
    },

    renderGrid(items, contactosMap = {}, sortColumn = 'numero', sortDirection = 'desc') {
        if (!items || items.length === 0) {
            return `<tr><td colspan="9" class="text-center py-5 text-muted">No se encontraron facturas de compra</td></tr>`;
        }

        return items.map(c => {
            const proveedorNombre = contactosMap[c.proveedorId || c.contacto_id || c.contactoId] || 'Sin Proveedor';
            const avatar = getVendorAvatar(proveedorNombre);
            const numDisplay = c.numero || parseInt(String(c.id).replace(/\D/g, ''), 10) || c.id;
            const badgeHtml = this.getEstadoBadge(c);
            const isAnulada = (c.estado || '').toLowerCase() === 'anulada' || (c.estado || '').toLowerCase() === 'void';
            const rowOpacity = isAnulada ? '0.5' : '1';

            return `
                <tr class="payment-row" data-id="${c.id}" style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13.5px; color: var(--text-body); opacity: ${rowOpacity}; transition: background-color 0.15s ease;">
                    <td class="py-2.5 px-3 fw-bold text-primary tnum" style="white-space: nowrap;">
                        <span class="badge bg-light text-primary border" style="font-family: monospace; font-size: 12px; padding: 4px 8px;">
                            #${escapeHtml(String(numDisplay))}
                        </span>
                    </td>
                    <td class="py-2.5 px-3 tnum text-muted" style="white-space: nowrap;">
                        ${this.formatFecha(c.fecha)}
                    </td>
                    <td class="py-2.5 px-3 tnum ${c.isVencida && c.saldoPendiente > 0 ? 'text-danger fw-semibold' : 'text-muted'}" style="white-space: nowrap;">
                        ${this.formatFecha(c.vencimiento)}
                    </td>
                    <td class="py-2.5 px-3" style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        <div class="d-flex align-items-center gap-2">
                            <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 28px; height: 28px; font-size: 11px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 600;">
                                ${avatar.initials}
                            </div>
                            <span class="fw-medium text-dark text-truncate" title="${escapeHtml(proveedorNombre)}">
                                ${escapeHtml(proveedorNombre)}
                            </span>
                        </div>
                    </td>
                    <td class="py-2.5 px-3 text-end tnum cell-numeric" style="white-space: nowrap;">
                        ${this.formatMoney(c.total)}
                    </td>
                    <td class="py-2.5 px-3 text-end tnum cell-numeric text-muted" style="white-space: nowrap;">
                        ${this.formatMoney(c.totalPagado)}
                    </td>
                    <td class="py-2.5 px-3 text-end tnum cell-numeric fw-bold text-dark" style="white-space: nowrap;">
                        ${this.formatMoney(c.saldoPendiente)}
                    </td>
                    <td class="py-2.5 px-3 text-center">
                        ${badgeHtml}
                    </td>
                    <td class="py-2.5 px-3 text-end" style="position: relative; white-space: nowrap;">
                        <button class="btn btn-link text-muted p-1 me-1 btn-quick-view-row" data-id="${c.id}" title="Inspección Rápida">
                            <span class="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button class="btn btn-link text-muted p-1 me-1 btn-imprimir-row" data-id="${c.id}" title="Imprimir">
                            <span class="material-symbols-outlined text-[18px]">print</span>
                        </button>
                        <button class="btn btn-link text-muted p-1 btn-menu-row" data-id="${c.id}" title="Más opciones">
                            <span class="material-symbols-outlined text-[18px]">more_vert</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    renderPagination(totalItems, currentPage, itemsPerPage, totalPages) {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return `
            <div class="d-flex align-items-center gap-3" style="font-size: var(--fs-base); color: var(--text-body);">
                <div class="d-flex align-items-center gap-2">
                    <span>Resultados por página:</span>
                    <select class="form-select form-select-sm text-muted" id="select-per-page" style="width: 70px;">
                        <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10</option>
                        <option value="20" ${itemsPerPage === 20 ? 'selected' : ''}>20</option>
                        <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
                    </select>
                </div>
                <span class="text-muted border-start ps-3">${totalItems > 0 ? startIndex + 1 : 0}-${Math.min(startIndex + itemsPerPage, totalItems)} de ${totalItems}</span>
            </div>

            <div class="d-flex align-items-center gap-2" style="font-size: var(--fs-base); color: var(--text-body);">
                <span>Página</span>
                <input type="number" id="input-page" class="form-control form-control-sm text-center text-muted" value="${currentPage}" min="1" max="${totalPages}" style="width: 50px;">
                <span>de ${totalPages}</span>
                <div class="ms-2">
                    <button class="btn btn-link text-muted p-0 me-1" id="btn-prev-page" ${currentPage === 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
                    <button class="btn btn-link text-muted p-0" id="btn-next-page" ${currentPage === totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>
                </div>
            </div>
        `;
    },

    renderDrawerContent({ fac, items = [], pagos = [], totalPagado = 0, saldoPendiente = 0 }) {
        const proveedorNombre = fac.contactos?.nombre || 'Sin Proveedor';
        const avatar = getVendorAvatar(proveedorNombre);
        const numDisplay = fac.numero || parseInt(String(fac.id).replace(/\D/g, ''), 10) || fac.id;
        const isAnulada = (fac.estado || '').toLowerCase() === 'anulada' || (fac.estado || '').toLowerCase() === 'void';
        const isPagada = saldoPendiente <= 0;

        return `
            <!-- HEADER PROVEEDOR & FACTURA -->
            <div class="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
                <div class="d-flex align-items-center gap-3">
                    <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 44px; height: 44px; font-size: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                        ${avatar.initials}
                    </div>
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-light text-primary border" style="font-family: monospace; font-size: 13px; padding: 4px 8px;">
                                FAC-C #${escapeHtml(String(numDisplay))}
                            </span>
                            ${isAnulada ? 
                                `<span class="badge bg-secondary-subtle text-secondary border rounded-pill">Anulada</span>` : 
                                isPagada ? 
                                `<span class="badge bg-success-subtle text-success border rounded-pill">Pagada</span>` : 
                                `<span class="badge bg-warning-subtle text-warning-emphasis border rounded-pill">Por pagar</span>`
                            }
                        </div>
                        <h4 class="fw-bold mb-0 mt-1" style="font-size: 17px; color: #0f172a;">${escapeHtml(proveedorNombre)}</h4>
                        ${fac.contactos?.identificacion ? `<span class="text-muted" style="font-size: 12px;">NIT / CC: ${escapeHtml(fac.contactos.identificacion)}</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- BANNER DE MONTOS Y SALDOS -->
            <div class="p-3 rounded-3 mb-4" style="background: linear-gradient(135deg, #eff6ff, #f8fafc); border: 1px solid #bfdbfe;">
                <div class="row g-2 align-items-center text-center text-sm-start">
                    <div class="col-12 col-sm-4">
                        <span class="text-uppercase fw-semibold text-muted" style="font-size: 10px; letter-spacing: 0.5px;">Total Factura</span>
                        <h3 class="fw-bold text-dark mb-0 tnum" style="font-size: 18px;">${this.formatMoney(fac.total)}</h3>
                    </div>
                    <div class="col-12 col-sm-4 border-start-sm ps-sm-3">
                        <span class="text-uppercase fw-semibold text-muted" style="font-size: 10px; letter-spacing: 0.5px;">Total Amortizado</span>
                        <h3 class="fw-bold text-success mb-0 tnum" style="font-size: 18px;">${this.formatMoney(totalPagado)}</h3>
                    </div>
                    <div class="col-12 col-sm-4 border-start-sm ps-sm-3">
                        <span class="text-uppercase fw-semibold text-muted" style="font-size: 10px; letter-spacing: 0.5px;">Saldo Pendiente</span>
                        <h3 class="fw-bold ${saldoPendiente > 0 ? 'text-danger' : 'text-success'} mb-0 tnum" style="font-size: 18px;">${this.formatMoney(saldoPendiente)}</h3>
                    </div>
                </div>
            </div>

            <!-- TRAZABILIDAD Y LÍNEA DE TIEMPO DE PAGOS -->
            <div class="mb-4">
                <h6 class="fw-bold text-uppercase text-muted mb-3" style="font-size: 11px; letter-spacing: 0.5px;">
                    <i class="bi bi-signpost-split me-1 text-primary"></i> Trazabilidad & Amortizaciones
                </h6>
                <div class="ps-2">
                    <!-- Hito 1: Emisión -->
                    <div class="payment-timeline-item mb-2 ps-3 position-relative" style="border-left: 2px solid #e2e8f0;">
                        <div class="fw-semibold text-dark" style="font-size: 13px;">Factura Registrada</div>
                        <div class="text-muted" style="font-size: 12px;">
                            Fecha de compra: <strong>${this.formatFecha(fac.fecha)}</strong> | Vence: <strong>${this.formatFecha(fac.vencimiento)}</strong>
                        </div>
                    </div>

                    <!-- Hito 2: Amortizaciones -->
                    <div class="payment-timeline-item mb-2 ps-3 position-relative" style="border-left: 2px solid #e2e8f0;">
                        <div class="fw-semibold text-dark" style="font-size: 13px;">Pagos Registrados (${pagos.length})</div>
                        <div class="text-muted mt-1" style="font-size: 12px;">
                            ${pagos.length > 0 
                                ? pagos.map(p => `
                                    <div class="p-2 mb-1 rounded bg-light border d-flex justify-content-between align-items-center">
                                        <div>
                                            <span class="fw-bold text-success">${this.formatMoney(p.monto)}</span>
                                            <span class="text-muted ms-1">(${escapeHtml(p.cuentas_bancarias?.nombre || 'Caja Principal')})</span>
                                        </div>
                                        <span class="badge bg-secondary-subtle text-secondary" style="font-size: 10px;">${this.formatFecha(p.fecha)}</span>
                                    </div>
                                `).join('')
                                : '<span class="text-muted fst-italic">No registra abonos o amortizaciones a la fecha.</span>'
                            }
                        </div>
                    </div>

                    <!-- Hito 3: Estado -->
                    <div class="payment-timeline-item ps-3 position-relative" style="border-left: 2px solid ${isPagada ? '#059669' : '#d97706'};">
                        <div class="fw-semibold text-dark" style="font-size: 13px;">Estado Actual</div>
                        <div style="font-size: 12px;">
                            ${isAnulada 
                                ? `<span class="text-danger fw-semibold"><i class="bi bi-x-circle me-1"></i> Factura anulada. Lotes de inventario revertidos.</span>`
                                : isPagada 
                                ? `<span class="text-success fw-semibold"><i class="bi bi-check-circle me-1"></i> Factura 100% amortizada y saldada.</span>`
                                : `<span class="text-warning-emphasis fw-semibold"><i class="bi bi-clock-history me-1"></i> Saldo pendiente por pagar: ${this.formatMoney(saldoPendiente)}</span>`
                            }
                        </div>
                    </div>
                </div>
            </div>

            <!-- ÍTEMS / PRODUCTOS COMPRADOS -->
            <div class="mb-4">
                <h6 class="fw-bold text-uppercase text-muted mb-2" style="font-size: 11px; letter-spacing: 0.5px;">
                    <i class="bi bi-box-seam me-1 text-primary"></i> Ítems Adquiridos (${items.length})
                </h6>
                <div class="table-responsive border rounded-3 bg-white">
                    <table class="table table-sm align-middle mb-0" style="font-size: 12px;">
                        <thead class="bg-light text-muted">
                            <tr>
                                <th class="ps-3 py-2">Producto</th>
                                <th class="text-center py-2">Cant</th>
                                <th class="text-end py-2">Precio</th>
                                <th class="text-end pe-3 py-2">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(d => {
                                const prodNom = d.productos?.nombre || d.descripcion || 'Producto de compra';
                                const sku = d.productos?.sku || d.productos?.codigo || '';
                                return `
                                    <tr>
                                        <td class="ps-3 py-2">
                                            <div class="fw-medium text-dark">${escapeHtml(prodNom)}</div>
                                            ${sku ? `<small class="text-muted">SKU: ${escapeHtml(sku)}</small>` : ''}
                                        </td>
                                        <td class="text-center py-2 tnum">${d.cantidad || 0}</td>
                                        <td class="text-end py-2 tnum">${this.formatMoney(d.precio_unitario || d.precio)}</td>
                                        <td class="text-end pe-3 py-2 tnum fw-semibold text-dark">${this.formatMoney(d.subtotal || ((d.cantidad || 0) * (d.precio_unitario || d.precio || 0)))}</td>
                                    </tr>
                                `;
                            }).join('') || '<tr><td colspan="4" class="text-center text-muted py-3">Sin ítems registrados</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- NOTAS Y OBSERVACIONES -->
            ${fac.observaciones || fac.notas ? `
                <div class="mb-3">
                    <h6 class="fw-bold text-uppercase text-muted mb-1" style="font-size: 11px;">Notas y Observaciones</h6>
                    <div class="p-3 bg-light rounded-3 text-secondary" style="font-size: 12px; line-height: 1.5;">
                        ${escapeHtml(fac.observaciones || fac.notas)}
                    </div>
                </div>
            ` : ''}
        `;
    },

    renderDrawerFooter({ fac, isPagada = false, isAnulada = false, saldoPendiente = 0 }) {
        return `
            <button type="button" class="btn btn-light bg-white border text-secondary" id="btn-drawer-cerrar" style="font-weight: 500; font-size: 13px;">
                Cerrar
            </button>
            <div class="d-flex align-items-center gap-2">
                <button type="button" class="btn btn-light bg-white border text-secondary" id="btn-drawer-imprimir" data-id="${fac.id}" title="Imprimir Comprobante">
                    <i class="bi bi-printer me-1"></i> Imprimir
                </button>
                ${!isAnulada && !isPagada ? `
                    <button type="button" class="btn btn-success fw-semibold shadow-xs" id="btn-drawer-abonar" data-id="${fac.id}" data-saldo="${saldoPendiente}" style="font-size: 13px;">
                        <i class="bi bi-wallet2 me-1"></i> Registrar Pago
                    </button>
                ` : ''}
                ${!isAnulada ? `
                    <button type="button" class="btn btn-outline-danger" id="btn-drawer-anular" data-id="${fac.id}" title="Anular factura y revertir stock">
                        <i class="bi bi-x-circle me-1"></i> Anular
                    </button>
                    <a href="#/gastos/proveedores/editar/${fac.id}" class="btn btn-primary-action" id="btn-drawer-editar" style="font-size: 13px;">
                        <i class="bi bi-pencil me-1"></i> Editar
                    </a>
                ` : `
                    <a href="#/gastos/proveedores/ver/${fac.id}" class="btn btn-outline-secondary" id="btn-drawer-ver" style="font-size: 13px;">
                        <i class="bi bi-eye me-1"></i> Ver Formulario
                    </a>
                `}
            </div>
        `;
    }
};
