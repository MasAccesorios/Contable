// js/modules/inventario/ajustes.templates.js
// Capa de Presentación HTML (Stitch UI - Homologado al 100% con Gastos Operativos y crudFinanciero.js)

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
            return `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;">
                <i class="bi bi-arrow-up-circle me-1"></i> Incremento
            </span>`;
        }
        if (tipo === 'disminucion') {
            return `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;">
                <i class="bi bi-arrow-down-circle me-1"></i> Disminución
            </span>`;
        }
        if (tipo === 'mixto') {
            return `<span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;">
                <i class="bi bi-arrow-left-right me-1"></i> Mixto
            </span>`;
        }
        if (tipo === 'checkpoint') {
            return `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;">
                <i class="bi bi-shield-check me-1"></i> Checkpoint
            </span>`;
        }
        return `<span class="badge bg-light text-muted border rounded-pill" style="font-size: 11px; padding: 3px 8px;">---</span>`;
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
            <div class="dash-layout p-4" style="max-width: 1200px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                
                <!-- TOP BAR DE ALTO IMPACTO (ESTILO GASTOS OPERATIVOS) -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <a href="#" onclick="event.preventDefault(); window.history.length > 2 ? window.history.back() : window.location.hash = '#/dashboard';" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body); border-radius: 8px;" title="Volver">
                                <i class="bi bi-arrow-left"></i>
                            </a>
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Ajustes de Inventario</h2>
                            <span class="badge" style="background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #bfdbfe;">
                                <i class="bi bi-boxes me-1"></i> Control de Stock & Mermas
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Registra y audita entradas, mermas por daño, garantías y reconciliaciones físicas de stock.
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Botón Exportar Excel -->
                        <button id="btn-export-excel" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 600; font-size: 13px; border-radius: 8px;" title="Descargar en Excel">
                            <i class="bi bi-file-earmark-excel text-success me-1"></i> Exportar
                        </button>

                        <!-- Botón Refrescar -->
                        <button id="btn-refresh-ajustes" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>

                        <!-- Botón Nuevo Ajuste -->
                        <button id="btn-nuevo-ajuste" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;" onclick="window.location.hash='#/inventario/ajustes/nuevo'">
                            <i class="bi bi-plus-lg"></i> Nuevo Ajuste
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS (ESTILO GASTOS OPERATIVOS) -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Total Ajustes -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Total Ajustes</span>
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

                    <!-- KPI 2: Unidades Entradas (+) -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Unidades Entradas (+)</span>
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

                    <!-- KPI 3: Mermas y Salidas (-) -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #dc2626;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Mermas y Salidas (-)</span>
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

                    <!-- KPI 4: Balance Neto Stock -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Balance Neto Stock</span>
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

                <!-- CONTENEDOR DE TABLA DE DATOS UNIFICADO (DASH-TABLE-CONTAINER) -->
                <div id="ajustes-grid-container" class="position-relative">
                    <!-- Loading Overlay -->
                    <div id="grid-loading-overlay" class="position-absolute top-0 start-0 w-100 h-100 justify-content-center align-items-center bg-white bg-opacity-75" style="display: none; z-index: 10; border-radius: 12px; min-height: 250px;">
                        <div class="spinner-border text-primary" role="status"></div>
                    </div>

                    <div class="dash-table-container mb-4 shadow-xs" style="border-radius: 12px; border: 1px solid var(--border-color, #e2e8f0); background: #ffffff;">
                        
                        <!-- FILTROS Y TABS SUPERIORES UNIFICADOS -->
                        <div class="p-3 border-bottom bg-white d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                            <!-- Tabs de Filtro Rápido (Segmented Control) -->
                            <div class="payment-tabs-bar">
                                <button type="button" class="payment-tab-btn ${currentTab === 'todas' ? 'active' : ''}" data-tab="todas" id="tab-todas">
                                    Todas <span class="payment-tab-badge">${counts.todas || 0}</span>
                                </button>
                                <button type="button" class="payment-tab-btn ${currentTab === 'incrementos' ? 'active' : ''}" data-tab="incrementos" id="tab-incrementos">
                                    <i class="bi bi-arrow-up-circle text-success"></i> Incrementos <span class="payment-tab-badge">${counts.incrementos || 0}</span>
                                </button>
                                <button type="button" class="payment-tab-btn tab-warning ${currentTab === 'disminuciones' ? 'active' : ''}" data-tab="disminuciones" id="tab-disminuciones">
                                    <i class="bi bi-arrow-down-circle text-danger"></i> Mermas / Bajas <span class="payment-tab-badge">${counts.disminuciones || 0}</span>
                                </button>
                                <button type="button" class="payment-tab-btn ${currentTab === 'checkpoints' ? 'active' : ''}" data-tab="checkpoints" id="tab-checkpoints">
                                    <i class="bi bi-shield-check text-secondary"></i> Checkpoints <span class="payment-tab-badge">${counts.checkpoints || 0}</span>
                                </button>
                            </div>

                            <!-- Buscador en Tiempo Real (Design System) -->
                            <div class="d-flex flex-wrap align-items-center gap-2">
                                <div class="ds-search-container" style="min-width: 280px;">
                                    <i class="bi bi-search ds-search-icon"></i>
                                    <input type="text" class="ds-search-input pe-4" id="search-ajustes" placeholder="Buscar por #, SKU, producto o nota..." value="${escapeHtml(state.searchQuery || '')}" autocomplete="off">
                                    ${state.searchQuery ? `
                                        <button id="btn-clear-search" class="btn btn-link text-muted p-0 position-absolute" style="right: 12px; top: 50%; transform: translateY(-50%); font-size: 12px; text-decoration: none;">
                                            <i class="bi bi-x-circle-fill"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- TABLA DINÁMICA -->
                        <div id="ajustes-table-wrapper">
                            <!-- Inyectado por renderGrid -->
                        </div>

                        <!-- PAGINADOR INTEGRADO -->
                        <div id="ajustes-pagination-container">
                            <!-- Inyectado por renderPagination -->
                        </div>
                    </div>
                </div>

                <!-- SLIDE-OVER DRAWER DE TRAZABILIDAD (ESTILO GASTOS OPERATIVOS) -->
                <div class="payment-drawer-backdrop" id="drawer-backdrop"></div>
                <div class="payment-drawer" id="ajustes-drawer" style="width: 540px; max-width: 95vw;">
                    <div id="drawer-content-container" class="h-100 d-flex flex-column">
                        <!-- Inyectado por renderDrawerContent -->
                    </div>
                </div>

            </div>
        `;
    },

    renderGrid(rows = [], state = {}) {
        if (!Array.isArray(rows) || rows.length === 0) {
            const hasQuery = Boolean(state.searchQuery);
            return `
                <div class="text-center py-5">
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
            `;
        }

        const tbodyHtml = rows.map(a => {
            const unidadesIncHtml = a.unidadesIncrementadas > 0 ? `<span class="text-success fw-semibold">+${this.formatNumero(a.unidadesIncrementadas)}</span>` : '<span class="text-muted">0</span>';
            const unidadesDisHtml = a.unidadesDisminuidas > 0 ? `<span class="text-danger fw-semibold">-${this.formatNumero(a.unidadesDisminuidas)}</span>` : '<span class="text-muted">0</span>';
            const obsSafe = escapeHtml(a.observaciones || 'Sin observaciones');

            return `
                <tr class="payment-row ajuste-row-item" data-id="${escapeHtml(a.id)}">
                    <td class="py-3 ps-4 fw-bold text-dark tnum">
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
                    <td class="py-3 text-truncate text-muted" style="max-width: 250px; font-size: 13px;" title="${obsSafe}">
                        ${obsSafe}
                    </td>
                    <td class="py-3 pe-4 text-end" onclick="event.stopPropagation();">
                        <div class="d-inline-flex align-items-center gap-1">
                            <button class="btn btn-sm btn-light border text-secondary btn-open-drawer shadow-2xs" data-id="${escapeHtml(a.id)}" title="Inspección rápida 360°" style="border-radius: 6px; width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">
                                <i class="bi bi-layout-sidebar-reverse"></i>
                            </button>
                            <button class="btn btn-sm btn-light border text-secondary shadow-2xs" onclick="window.location.hash='#/inventario/ajustes/ver/${encodeURIComponent(a.id)}'" title="Ver comprobante completo" style="border-radius: 6px; width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">
                                <i class="bi bi-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="table-responsive">
                <table class="table table-borderless align-middle mb-0 w-100" id="ajustes-table">
                    <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <tr>
                            <th class="py-3 ps-4 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 110px;">Número</th>
                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 120px;">Fecha</th>
                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 140px;">Tipo</th>
                            <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 100px;">Ítems</th>
                            <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 110px;">Entradas (+)</th>
                            <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 110px;">Salidas (-)</th>
                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Observaciones</th>
                            <th class="py-3 pe-4 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 100px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tbodyHtml}
                    </tbody>
                </table>
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
                const diff = (d.a || 0) - (d.de || 0);
                qtyBadge = diff >= 0
                    ? `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill">+${diff}</span>`
                    : `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">${diff}</span>`;
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
            <!-- HEADER DEL DRAWER (ESTILO GASTOS OPERATIVOS) -->
            <div class="payment-drawer-header">
                <div class="d-flex align-items-center gap-2">
                    <div class="payment-kpi-icon blue-bg" style="width: 34px; height: 34px; font-size: 14px;">
                        <i class="bi bi-boxes text-primary"></i>
                    </div>
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <h5 class="fw-bold mb-0" style="color: #0f172a; font-size: 16px;">Ajuste #${escapeHtml(ajuste.numero)}</h5>
                            ${this.getTipoBadge(ajuste.tipo)}
                        </div>
                        <div class="text-muted" style="font-size: 11px;">
                            Fecha: <strong>${this.formatFecha(ajuste.fecha)}</strong>
                        </div>
                    </div>
                </div>
                <button type="button" class="btn btn-sm btn-light border-0 text-muted btn-close-drawer" title="Cerrar panel">
                    <i class="bi bi-x-lg fs-6"></i>
                </button>
            </div>

            <!-- BODY DEL DRAWER -->
            <div class="payment-drawer-body">
                <!-- SCORECARD 4 MÉTRICAS -->
                <div class="row g-2 text-center mb-3">
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
                <div class="p-3 rounded bg-light border-0 mb-4">
                    <div class="text-uppercase text-muted fw-bold mb-1" style="font-size: 10px; letter-spacing: 0.5px;">Observaciones</div>
                    <div class="text-dark" style="font-size: 12px; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(ajuste.observaciones || 'Sin observaciones registradas.')}</div>
                </div>

                <!-- TABLA DE ÍTEMS AFECTADOS -->
                <div class="d-flex justify-content-between align-items-center mb-2">
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

            <!-- FOOTER DEL DRAWER -->
            <div class="payment-drawer-footer">
                <button type="button" class="btn btn-light border btn-sm px-3 fw-medium btn-close-drawer">
                    Cerrar
                </button>
                <button type="button" class="btn btn-primary btn-sm px-3 fw-medium" onclick="window.location.hash='#/inventario/ajustes/ver/${encodeURIComponent(ajuste.id)}'">
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
            <div class="card-footer bg-white border-top p-3 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2" style="border-radius: 0 0 12px 12px;">
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
