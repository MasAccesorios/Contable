// js/modules/inventario/ajustes.templates.js
// Capa de Presentación HTML (Stitch UI, KPIs, Segmented Tabs, Offcanvas 360°)

import { escapeHtml } from '../../shared/formatters.js';

export const AjustesTemplates = {
    formatMoney(val) {
        if (val === null || val === undefined || val === '') return '$ 0';
        const num = parseFloat(val) || 0;
        return '$ ' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

    formatFecha(str) {
        if (!str || str === '---' || str === 'N/A') return '---';
        const raw = String(str).split('T')[0];
        const partes = raw.split('-');
        const formatted = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : raw;
        return escapeHtml(formatted);
    },

    formatNumero(val) {
        if (val === null || val === undefined || val === '') return '0';
        const num = parseFloat(val) || 0;
        return num.toLocaleString('es-CO');
    },

    getTipoBadge(tipo) {
        if (tipo === 'incremento') {
            return `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 10px;">
                <i class="bi bi-arrow-up-circle me-1"></i> Incremento
            </span>`;
        }
        if (tipo === 'disminucion') {
            return `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 10px;">
                <i class="bi bi-arrow-down-circle me-1"></i> Disminución
            </span>`;
        }
        if (tipo === 'mixto') {
            return `<span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 10px;">
                <i class="bi bi-arrow-left-right me-1"></i> Mixto
            </span>`;
        }
        if (tipo === 'checkpoint') {
            return `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 10px;">
                <i class="bi bi-shield-check me-1"></i> Checkpoint
            </span>`;
        }
        return `<span class="badge bg-light text-muted border rounded-pill" style="font-size: 11px; padding: 4px 10px;">---</span>`;
    },

    renderLayout(state = {}) {
        const kpis = state.kpis || {
            totalAjustes: 0,
            unidadesIncrementadas: 0,
            unidadesDisminuidas: 0,
            balanceNeto: 0,
            totalItems: 0,
            tabCounts: { todas: 0, incrementos: 0, disminuciones: 0, checkpoints: 0 }
        };
        const counts = kpis.tabCounts || { todas: 0, incrementos: 0, disminuciones: 0, checkpoints: 0 };
        const currentTab = state.currentTab || 'todas';

        return `
            <div class="dash-layout p-4" style="max-width: 1240px; margin: 0 auto; font-family: 'Inter', system-ui, -apple-system, sans-serif;">
                
                <!-- BREADCRUMB & TAG -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div style="font-size: var(--fs-sm);" class="text-muted">
                        <span>Inventario</span> &gt; <span class="text-dark fw-bold">Ajustes de Inventario</span>
                    </div>
                    <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1 fw-semibold" style="font-size: 11px;">
                        <i class="bi bi-boxes me-1"></i> Control de Stock & Mermas
                    </span>
                </div>

                <!-- TOP BAR EJECUTIVA -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
                    <div>
                        <h2 class="page-title mb-1 fw-bold text-dark" style="font-size: 24px; letter-spacing: -0.5px;">Ajustes de Inventario</h2>
                        <p class="text-muted mb-0" style="font-size: 13px;">
                            Registra y audita entradas, mermas por daño, garantías y reconciliaciones físicas de stock.
                        </p>
                    </div>
                    
                    <div class="d-flex align-items-center gap-2">
                        <button id="btn-refresh-ajustes" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px; height: 38px; width: 38px; display: inline-flex; align-items: center; justify-content: center;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                        <button id="btn-export-excel" class="btn btn-light bg-white border text-secondary shadow-xs d-flex align-items-center gap-2" style="border-radius: 8px; font-weight: 500; font-size: 13px; height: 38px;">
                            <i class="bi bi-file-earmark-excel text-success"></i>
                            <span>Exportar</span>
                        </button>
                        <button id="btn-nuevo-ajuste" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px; height: 38px;" onclick="window.location.hash='#/inventario/ajustes/nuevo'">
                            <i class="bi bi-plus-lg"></i>
                            <span>Nuevo Ajuste</span>
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS EJECUTIVAS -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Total Ajustes -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card h-100" style="border-left: 3px solid #2563eb;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Total Ajustes</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-clipboard-check"></i>
                                </div>
                            </div>
                            <div id="kpi-total-ajustes" class="payment-kpi-value fw-bold text-dark tnum" style="font-size: 22px;">
                                ${this.formatNumero(kpis.totalAjustes)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <span class="fw-semibold text-primary">${this.formatNumero(kpis.totalItems)}</span> referencias auditadas
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Unidades Incrementadas -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card h-100" style="border-left: 3px solid #059669;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Unidades Entradas (+)</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-arrow-up-circle"></i>
                                </div>
                            </div>
                            <div id="kpi-unidades-incrementadas" class="payment-kpi-value fw-bold text-success tnum" style="font-size: 22px;">
                                +${this.formatNumero(kpis.unidadesIncrementadas)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Sobrantes y garantías ingresadas
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Unidades Disminuidas / Mermas -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card h-100" style="border-left: 3px solid #dc2626;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Mermas y Salidas (-)</span>
                                <div class="payment-kpi-icon out-bg">
                                    <i class="bi bi-arrow-down-circle"></i>
                                </div>
                            </div>
                            <div id="kpi-unidades-disminuidas" class="payment-kpi-value fw-bold text-danger tnum" style="font-size: 22px;">
                                -${this.formatNumero(kpis.unidadesDisminuidas)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Daños, pérdidas y faltantes
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Balance Neto -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card h-100" style="border-left: 3px solid #4f46e5;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Balance Neto Stock</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-arrow-left-right"></i>
                                </div>
                            </div>
                            <div id="kpi-balance-neto" class="payment-kpi-value fw-bold ${kpis.balanceNeto >= 0 ? 'text-primary' : 'text-danger'} tnum" style="font-size: 22px;">
                                ${kpis.balanceNeto > 0 ? '+' : ''}${this.formatNumero(kpis.balanceNeto)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Variación neta de existencias
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTROLES: TABS Y BUSCADOR -->
                <div class="card border-0 shadow-xs mb-3" style="border-radius: 10px; background-color: #fff;">
                    <div class="card-body p-3">
                        <div class="d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-3">
                            
                            <!-- SEGMENTED TABS -->
                            <div class="d-flex flex-wrap gap-2" role="tablist">
                                <button type="button" class="btn btn-sm ${currentTab === 'todas' ? 'btn-dark text-white fw-semibold' : 'btn-light text-secondary'} rounded-pill px-3 py-1 d-flex align-items-center gap-2 tab-filter-btn" data-tab="todas" id="tab-todas">
                                    <span>Todas</span>
                                    <span class="badge ${currentTab === 'todas' ? 'bg-white text-dark' : 'bg-secondary bg-opacity-10 text-secondary'} rounded-pill" style="font-size: 10px;">${counts.todas || 0}</span>
                                </button>
                                <button type="button" class="btn btn-sm ${currentTab === 'incrementos' ? 'btn-dark text-white fw-semibold' : 'btn-light text-secondary'} rounded-pill px-3 py-1 d-flex align-items-center gap-2 tab-filter-btn" data-tab="incrementos" id="tab-incrementos">
                                    <i class="bi bi-arrow-up-circle text-success"></i>
                                    <span>Incrementos</span>
                                    <span class="badge ${currentTab === 'incrementos' ? 'bg-white text-dark' : 'bg-secondary bg-opacity-10 text-secondary'} rounded-pill" style="font-size: 10px;">${counts.incrementos || 0}</span>
                                </button>
                                <button type="button" class="btn btn-sm ${currentTab === 'disminuciones' ? 'btn-dark text-white fw-semibold' : 'btn-light text-secondary'} rounded-pill px-3 py-1 d-flex align-items-center gap-2 tab-filter-btn" data-tab="disminuciones" id="tab-disminuciones">
                                    <i class="bi bi-arrow-down-circle text-danger"></i>
                                    <span>Mermas / Bajas</span>
                                    <span class="badge ${currentTab === 'disminuciones' ? 'bg-white text-dark' : 'bg-secondary bg-opacity-10 text-secondary'} rounded-pill" style="font-size: 10px;">${counts.disminuciones || 0}</span>
                                </button>
                                <button type="button" class="btn btn-sm ${currentTab === 'checkpoints' ? 'btn-dark text-white fw-semibold' : 'btn-light text-secondary'} rounded-pill px-3 py-1 d-flex align-items-center gap-2 tab-filter-btn" data-tab="checkpoints" id="tab-checkpoints">
                                    <i class="bi bi-shield-check text-secondary"></i>
                                    <span>Checkpoints</span>
                                    <span class="badge ${currentTab === 'checkpoints' ? 'bg-white text-dark' : 'bg-secondary bg-opacity-10 text-secondary'} rounded-pill" style="font-size: 10px;">${counts.checkpoints || 0}</span>
                                </button>
                            </div>

                            <!-- BUSCADOR CON DEBOUNCE -->
                            <div class="position-relative" style="min-width: 280px;">
                                <i class="bi bi-search position-absolute text-muted" style="left: 12px; top: 50%; transform: translateY(-50%); font-size: 13px;"></i>
                                <input type="text" id="search-ajustes" class="form-control form-control-sm ps-4 pe-4 bg-light border-0" placeholder="Buscar por #, SKU, producto o nota..." value="${escapeHtml(state.searchQuery || '')}" style="height: 36px; border-radius: 8px; font-size: 13px;">
                                ${state.searchQuery ? `
                                    <button id="btn-clear-search" class="btn btn-link text-muted p-0 position-absolute" style="right: 12px; top: 50%; transform: translateY(-50%); font-size: 12px;">
                                        <i class="bi bi-x-circle-fill"></i>
                                    </button>
                                ` : ''}
                            </div>

                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR DE LA TABLA -->
                <div id="ajustes-grid-container" class="position-relative">
                    <!-- Loading Overlay -->
                    <div id="grid-loading-overlay" class="position-absolute top-0 start-0 w-100 h-100 justify-content-center align-items-center bg-white bg-opacity-75" style="display: none; z-index: 10; border-radius: 10px; min-height: 250px;">
                        <div class="spinner-border text-primary" role="status"></div>
                    </div>
                    
                    <div id="ajustes-table-wrapper">
                        <!-- Renderizado por renderGrid -->
                    </div>
                </div>

                <!-- CONTENEDOR DE PAGINACIÓN -->
                <div id="ajustes-pagination-container" class="mt-3">
                    <!-- Renderizado por renderPagination -->
                </div>

                <!-- DRAWER LATERAL ERGONÓMICO 360° (OFFCANVAS) -->
                <div id="ajustes-drawer" class="offcanvas-drawer" style="display: none;">
                    <div class="offcanvas-backdrop" id="drawer-backdrop"></div>
                    <div class="offcanvas-panel shadow-lg" id="drawer-panel" style="width: 520px; max-width: 95vw;">
                        <div id="drawer-content-container" class="h-100 d-flex flex-column">
                            <!-- Inyectado dinámicamente por renderDrawerContent -->
                        </div>
                    </div>
                </div>

            </div>
        `;
    },

    renderGrid(rows = [], state = {}) {
        if (!Array.isArray(rows) || rows.length === 0) {
            const hasQuery = Boolean(state.searchQuery);
            return `
                <div class="card border-0 shadow-xs text-center py-5" style="border-radius: 10px; background: #fff;">
                    <div class="card-body">
                        <div class="avatar-lg bg-light rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center" style="width: 56px; height: 56px;">
                            <i class="bi bi-boxes text-muted fs-3"></i>
                        </div>
                        <h6 class="fw-bold text-dark mb-1">No se encontraron ajustes de inventario</h6>
                        <p class="text-muted mb-3" style="font-size: 13px;">
                            ${hasQuery ? 'No hay coincidencias para tu búsqueda. Prueba con otro término.' : 'No hay ajustes registrados en esta pestaña.'}
                        </p>
                        ${hasQuery ? `
                            <button id="btn-reset-filters" class="btn btn-sm btn-light border px-3">
                                Limpiar búsqueda
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-primary-action px-3" onclick="window.location.hash='#/inventario/ajustes/nuevo'">
                                <i class="bi bi-plus-lg me-1"></i> Crear primer ajuste
                            </button>
                        `}
                    </div>
                </div>
            `;
        }

        const tbodyHtml = rows.map(a => {
            const unidadesIncHtml = a.unidadesIncrementadas > 0 ? `<span class="text-success fw-semibold">+${this.formatNumero(a.unidadesIncrementadas)}</span>` : '<span class="text-muted">0</span>';
            const unidadesDisHtml = a.unidadesDisminuidas > 0 ? `<span class="text-danger fw-semibold">-${this.formatNumero(a.unidadesDisminuidas)}</span>` : '<span class="text-muted">0</span>';
            const obsSafe = escapeHtml(a.observaciones || 'Sin observaciones');

            return `
                <tr class="hover-bg-light cursor-pointer ajuste-row-item" data-id="${escapeHtml(a.id)}" style="transition: background-color 0.15s ease;">
                    <td class="ps-4 py-3 fw-bold text-dark">
                        #${escapeHtml(a.numero)}
                    </td>
                    <td class="py-3 text-muted" style="font-size: 13px;">
                        ${this.formatFecha(a.fecha)}
                    </td>
                    <td class="py-3">
                        ${this.getTipoBadge(a.tipo)}
                    </td>
                    <td class="py-3 text-center">
                        <span class="badge bg-light text-dark border rounded-pill px-2 py-1" style="font-size: 11px;">
                            ${a.totalItems} ${a.totalItems === 1 ? 'ítem' : 'ítems'}
                        </span>
                    </td>
                    <td class="py-3 text-center" style="font-size: 13px;">
                        ${unidadesIncHtml}
                    </td>
                    <td class="py-3 text-center" style="font-size: 13px;">
                        ${unidadesDisHtml}
                    </td>
                    <td class="py-3 text-truncate text-muted" style="max-width: 240px; font-size: 13px;" title="${obsSafe}">
                        ${obsSafe}
                    </td>
                    <td class="pe-4 py-3 text-end" onclick="event.stopPropagation();">
                        <div class="dropdown d-inline-block">
                            <button class="btn btn-link text-muted p-1 btn-open-drawer" data-id="${escapeHtml(a.id)}" title="Inspección rápida 360°" style="border-radius: 6px;">
                                <i class="bi bi-layout-sidebar-reverse fs-6"></i>
                            </button>
                            <button class="btn btn-link text-muted p-1" onclick="window.location.hash='#/inventario/ajustes/ver/${encodeURIComponent(a.id)}'" title="Ver comprobante completo" style="border-radius: 6px;">
                                <i class="bi bi-eye fs-6"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="card border-0 shadow-xs" style="border-radius: 10px; overflow: hidden; background: #fff;">
                <div class="table-responsive mb-0">
                    <table class="table table-borderless align-middle mb-0" id="ajustes-table">
                        <thead class="bg-light" style="border-bottom: 1px solid var(--border-color, #e2e8f0);">
                            <tr class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">
                                <th class="ps-4 py-3">Número</th>
                                <th class="py-3">Fecha</th>
                                <th class="py-3">Tipo</th>
                                <th class="py-3 text-center">Ítems</th>
                                <th class="py-3 text-center">Entradas (+)</th>
                                <th class="py-3 text-center">Salidas (-)</th>
                                <th class="py-3">Observaciones</th>
                                <th class="pe-4 py-3 text-end">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tbodyHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderDrawerContent(ajuste) {
        if (!ajuste) return '<div class="p-4 text-muted">Ajuste no disponible.</div>';

        const detalles = Array.isArray(ajuste.detalles) ? ajuste.detalles : [];
        const totalItemsCount = detalles.length;
        const isMassive = totalItemsCount > 50;
        const visibleItems = isMassive ? detalles.slice(0, 50) : detalles;

        const itemsRowsHtml = visibleItems.map((d, idx) => {
            if (!d) return '';
            const sku = escapeHtml(d.sku || 'S/N');
            const nombre = escapeHtml(d.nombre || (d.sku ? `SKU: ${d.sku}` : `Ítem #${idx + 1}`));
            const isInc = d.tipo === 'incremento';
            const isDis = d.tipo === 'disminucion';

            let qtyBadge = '';
            if (isInc) {
                qtyBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill">+${this.formatNumero(d.cantidad)}</span>`;
            } else if (isDis) {
                qtyBadge = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">-${this.formatNumero(d.cantidad)}</span>`;
            } else if (d.de !== undefined && d.a !== undefined) {
                const diff = (parseFloat(d.a) || 0) - (parseFloat(d.de) || 0);
                qtyBadge = diff >= 0
                    ? `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill">+${this.formatNumero(diff)}</span>`
                    : `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">${this.formatNumero(diff)}</span>`;
            } else if (d.a !== undefined) {
                qtyBadge = `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill">Stock: ${escapeHtml(this.formatNumero(d.a))}</span>`;
            } else {
                qtyBadge = `<span class="badge bg-light text-muted border rounded-pill">${this.formatNumero(d.cantidad || 0)}</span>`;
            }

            const costoCol = isInc && d.costo_unitario
                ? `<div class="text-muted" style="font-size: 11px;">Costo Uni: ${this.formatMoney(d.costo_unitario)}</div>`
                : '';

            return `
                <tr>
                    <td class="ps-3 py-2">
                        <div class="fw-semibold text-dark text-truncate" style="max-width: 250px;" title="${nombre}">${nombre}</div>
                        <div class="text-muted" style="font-size: 11px;">SKU: ${sku}</div>
                    </td>
                    <td class="py-2 text-center">
                        ${qtyBadge}
                        ${costoCol}
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <!-- HEADER DEL DRAWER -->
            <div class="p-4 border-bottom bg-light bg-opacity-50 d-flex justify-content-between align-items-center">
                <div>
                    <div class="d-flex align-items-center gap-2 mb-1">
                        <h5 class="fw-bold text-dark mb-0">Ajuste #${escapeHtml(ajuste.numero)}</h5>
                        ${this.getTipoBadge(ajuste.tipo)}
                    </div>
                    <div class="text-muted" style="font-size: 12px;">
                        <i class="bi bi-calendar3 me-1"></i> Fecha: <strong>${this.formatFecha(ajuste.fecha)}</strong>
                    </div>
                </div>
                <button type="button" class="btn btn-light bg-white border btn-close-drawer rounded-circle p-2" style="width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;" title="Cerrar">
                    <i class="bi bi-x fs-5"></i>
                </button>
            </div>

            <!-- SCORECARD 4 MÉTRICAS EN DRAWER -->
            <div class="p-4 border-bottom bg-white">
                <div class="row g-2 text-center">
                    <div class="col-3">
                        <div class="p-2 rounded bg-light">
                            <div class="text-muted text-uppercase" style="font-size: 10px; font-weight: 600;">Ítems</div>
                            <div class="fw-bold text-dark fs-6">${this.formatNumero(ajuste.totalItems)}</div>
                        </div>
                    </div>
                    <div class="col-3">
                        <div class="p-2 rounded bg-success-subtle bg-opacity-25">
                            <div class="text-success text-uppercase" style="font-size: 10px; font-weight: 600;">Entradas</div>
                            <div class="fw-bold text-success fs-6">+${this.formatNumero(ajuste.unidadesIncrementadas)}</div>
                        </div>
                    </div>
                    <div class="col-3">
                        <div class="p-2 rounded bg-danger-subtle bg-opacity-25">
                            <div class="text-danger text-uppercase" style="font-size: 10px; font-weight: 600;">Salidas</div>
                            <div class="fw-bold text-danger fs-6">-${this.formatNumero(ajuste.unidadesDisminuidas)}</div>
                        </div>
                    </div>
                    <div class="col-3">
                        <div class="p-2 rounded bg-primary-subtle bg-opacity-25">
                            <div class="text-primary text-uppercase" style="font-size: 10px; font-weight: 600;">Balance</div>
                            <div class="fw-bold text-primary fs-6">${ajuste.balanceNeto > 0 ? '+' : ''}${this.formatNumero(ajuste.balanceNeto)}</div>
                        </div>
                    </div>
                </div>

                <!-- OBSERVACIONES -->
                <div class="mt-3 p-3 rounded bg-light border-0">
                    <div class="text-uppercase text-muted fw-bold mb-1" style="font-size: 10px; letter-spacing: 0.5px;">Observaciones</div>
                    <div class="text-dark" style="font-size: 12px; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(ajuste.observaciones || 'Sin observaciones registradas.')}</div>
                </div>
            </div>

            <!-- TABLA DE ÍTEMS -->
            <div class="p-4 flex-grow-1 overflow-auto bg-white">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="fw-bold text-dark mb-0" style="font-size: 13px;">Ítems Afectados (${totalItemsCount})</h6>
                    ${isMassive ? `
                        <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle" style="font-size: 10px;">
                            Mostrando 50 de ${totalItemsCount} ítems (Corte seguro de auditoría)
                        </span>
                    ` : ''}
                </div>

                ${detalles.length === 0 ? `
                    <div class="text-center py-4 text-muted" style="font-size: 13px;">
                        No hay ítems registrados en los detalles de este ajuste.
                    </div>
                ` : `
                    <div class="table-responsive border rounded" style="max-height: 380px;">
                        <table class="table table-sm table-borderless align-middle mb-0" style="font-size: 12px;">
                            <thead class="bg-light border-bottom">
                                <tr class="text-muted fw-semibold" style="font-size: 11px;">
                                    <th class="ps-3 py-2">Producto / Referencia</th>
                                    <th class="py-2 text-center">Movimiento</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsRowsHtml}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <!-- FOOTER CON BOTONES -->
            <div class="p-3 border-top bg-light bg-opacity-75 d-flex justify-content-between align-items-center">
                <button type="button" class="btn btn-sm btn-light border px-3 btn-close-drawer" style="border-radius: 8px;">
                    Cerrar
                </button>
                <button type="button" class="btn btn-sm btn-primary-action px-3" onclick="window.location.hash='#/inventario/ajustes/ver/${encodeURIComponent(ajuste.id)}'" style="border-radius: 8px;">
                    <i class="bi bi-file-earmark-text me-1"></i> Ver Comprobante Completo
                </button>
            </div>
        `;
    },

    renderPagination(totalCount, currentPage, itemsPerPage) {
        if (!totalCount || totalCount <= itemsPerPage) return '';

        const totalPages = Math.ceil(totalCount / itemsPerPage);
        const from = ((currentPage - 1) * itemsPerPage) + 1;
        const to = Math.min(currentPage * itemsPerPage, totalCount);

        return `
            <div class="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3 px-2 py-3 bg-white rounded border shadow-xs">
                <div class="text-muted" style="font-size: 13px;">
                    Mostrando <strong class="text-dark">${from}</strong> a <strong class="text-dark">${to}</strong> de <strong class="text-dark">${totalCount}</strong> ajustes
                </div>
                
                <div class="d-flex align-items-center gap-1">
                    <button class="btn btn-sm btn-light border btn-pagination-nav" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''} style="border-radius: 6px;">
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    <span class="px-2 text-muted" style="font-size: 13px;">Página <strong>${currentPage}</strong> de <strong>${totalPages}</strong></span>
                    <button class="btn btn-sm btn-light border btn-pagination-nav" data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''} style="border-radius: 6px;">
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }
};
