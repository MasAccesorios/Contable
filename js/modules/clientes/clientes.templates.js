// js/modules/clientes/clientes.templates.js
// Plantillas ergonómicas y ejecutivas para Gestión & Análisis de Clientes 360°

import { escapeHtml } from '../../shared/formatters.js';

export function getClientAvatar(name) {
    if (!name || name === 'Sin cliente') return { initials: '?', bg: '#f1f5f9', color: '#64748b' };
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
    return { initials: initials.substring(0, 2), ...colors[index] };
}

export const ContactosTemplates = {
    formatMoney(val) {
        return '$ ' + Math.round(parseFloat(val || 0)).toLocaleString('es-CO');
    },

    formatFecha(dateStr) {
        if (!dateStr) return '---';
        const partes = String(dateStr).split('T')[0].split('-');
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dateStr;
    },

    getMoraBadge(dias, saldo = 1) {
        if (saldo <= 0.01) {
            return `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;"><i class="bi bi-check-circle me-1"></i> Al día</span>`;
        }
        if (dias <= 0) {
            return `<span class="badge bg-info-subtle text-primary border border-info-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;"><i class="bi bi-clock me-1"></i> Vigente</span>`;
        }
        if (dias <= 30) {
            return `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;"><i class="bi bi-clock-history me-1"></i> Mora ${dias}d</span>`;
        }
        return `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;"><i class="bi bi-exclamation-triangle me-1"></i> Mora ${dias}d</span>`;
    },

    renderLayout() {
        this.element.innerHTML = `
            <div class="dash-layout p-4" id="contactos-main-layout" style="max-width: 1350px; margin: 0 auto;">
                
                <!-- 1. TOP BAR EJECUTIVA DE ALTO IMPACTO -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Gestión de Contactos</h2>
                            <span class="badge" style="background-color: #ecfdf5; color: #059669; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #a7f3d0;">
                                <i class="bi bi-people-fill me-1"></i> Directorio & Cartera 360°
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Monitorea cartera, volumen de compra, comportamiento de pago y salud comercial en tiempo real.
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Toggle de Vistas: Lista vs Analítica -->
                        <div class="btn-group p-1 bg-light border rounded-3" role="group">
                            <button type="button" class="btn btn-sm ${this.state.view !== 'grafico' ? 'btn-white bg-white shadow-xs fw-bold text-dark' : 'btn-light border-0 text-muted'}" id="btn-view-lista" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-table me-1"></i> Directorio & Cartera
                            </button>
                            <button type="button" class="btn btn-sm ${this.state.view === 'grafico' ? 'btn-white bg-white shadow-xs fw-bold text-primary' : 'btn-light border-0 text-muted'}" id="btn-view-grafico" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-bar-chart me-1"></i> Analítica 360°
                            </button>
                        </div>

                        <!-- Botón Exportar Excel -->
                        <button id="btn-export-excel" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 600; font-size: 13px; border-radius: 8px;" title="Exportar listado de clientes a Excel">
                            <i class="bi bi-file-earmark-excel text-success me-1"></i> Exportar
                        </button>

                        <!-- Botón Refrescar -->
                        <button id="btn-refresh-list" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>

                        <!-- Botón Principal: Nuevo Contacto -->
                        <button id="btn-nuevo-contacto" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-plus-lg"></i> Nuevo contacto
                        </button>
                    </div>
                </div>

                <!-- 2. LAS 4 KPI CARDS DINÁMICAS (DISEÑO PAGOS RECIBIDOS) -->
                <div class="row g-3 mb-4" id="contactos-kpi-row">
                    <!-- KPI 1: Cartera Total Clientes -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Cartera Total Clientes</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-wallet2"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-total-cartera" style="font-size: 22px;">
                                <span class="spinner-border spinner-border-sm text-secondary"></span>
                            </div>
                            <div class="mt-2 d-flex align-items-center gap-2" id="kpi-sub-cartera">
                                <span class="payment-kpi-trend neutral" id="kpi-pct-vigente">---%</span>
                                <span class="text-muted" style="font-size: 11px;">cartera al día / vigente</span>
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Ventas del Mes -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Facturación del Mes</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-graph-up-arrow"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" id="kpi-ventas-mes" style="font-size: 22px;">
                                <span class="spinner-border spinner-border-sm text-secondary"></span>
                            </div>
                            <div class="mt-2 d-flex align-items-center gap-2" id="kpi-sub-ventas">
                                <span class="payment-kpi-trend positive" id="kpi-variacion-ventas">---</span>
                                <span class="text-muted" style="font-size: 11px;">vs mes anterior</span>
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Mora Crítica (>30 días) -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #dc2626;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Mora Crítica (>30 días)</span>
                                <div class="payment-kpi-icon out-bg">
                                    <i class="bi bi-exclamation-triangle"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-danger tnum" id="kpi-mora-critica" style="font-size: 22px;">
                                <span class="spinner-border spinner-border-sm text-secondary"></span>
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;" id="kpi-conteo-mora">
                                <strong>0</strong> clientes en riesgo alto
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Clientes Activos / Recurrencia -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Clientes Activos (60d)</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-people"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-primary tnum" id="kpi-clientes-activos" style="font-size: 22px;">
                                <span class="spinner-border spinner-border-sm text-secondary"></span>
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;" id="kpi-total-base">
                                Base total: <strong>0</strong> clientes
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 3. CONTENEDOR DE ANALÍTICA GRÁFICA (BI) -->
                <div id="contactos-analytics-container" style="display: ${this.state.view === 'grafico' ? 'block' : 'none'};">
                    <!-- Se inyecta dinámicamente por renderAnalyticsView -->
                </div>

                <!-- 4. CONTENEDOR DE GRILLA DE CLIENTES -->
                <div id="contactos-table-view-container" style="display: ${this.state.view !== 'grafico' ? 'block' : 'none'};">
                    <div class="dash-table-container mb-4 shadow-xs" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                        
                        <!-- FILTRO SUPERIOR: SEGMENTED CONTROL TABS + BUSCADOR + ORDEN -->
                        <div class="p-3 border-bottom bg-white d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                            <!-- Tabs de Filtro Rápido (Segmented Control) -->
                            <div class="payment-tabs-bar" id="contactos-segmented-tabs">
                                <button type="button" class="payment-tab-btn ${this.state.currentFilter === 'todos' ? 'active' : ''}" data-filter="todos">
                                    Todos <span class="payment-tab-badge" id="badge-tab-todos">0</span>
                                </button>
                                <button type="button" class="payment-tab-btn ${this.state.currentFilter === 'con_cartera' ? 'active' : ''}" data-filter="con_cartera">
                                    <i class="bi bi-clock-history text-warning"></i> Con Cartera
                                    <span class="payment-tab-badge" id="badge-tab-con-cartera">0</span>
                                </button>
                                <button type="button" class="payment-tab-btn tab-warning ${this.state.currentFilter === 'mora_critica' ? 'active' : ''}" data-filter="mora_critica">
                                    <i class="bi bi-exclamation-octagon text-danger"></i> Mora Crítica
                                    <span class="payment-tab-badge" id="badge-tab-mora-critica">0</span>
                                </button>
                                <button type="button" class="payment-tab-btn ${this.state.currentFilter === 'vip' ? 'active' : ''}" data-filter="vip">
                                    <i class="bi bi-star-fill text-warning"></i> Top VIP (Pareto)
                                </button>
                                <button type="button" class="payment-tab-btn ${this.state.currentFilter === 'inactivos' ? 'active' : ''}" data-filter="inactivos">
                                    <i class="bi bi-moon-stars text-secondary"></i> Inactivos (+60d)
                                </button>
                                <button type="button" class="payment-tab-btn ${this.state.currentFilter === 'proveedor' ? 'active' : ''}" data-filter="proveedor">
                                    <i class="bi bi-truck text-primary"></i> Proveedores
                                </button>
                            </div>

                            <!-- Buscador Universal y Ordenador -->
                            <div class="d-flex align-items-center gap-2 flex-grow-1 flex-lg-grow-0">
                                <div class="ds-search-container" style="min-width: 240px; width: 100%;">
                                    <i class="bi bi-search ds-search-icon"></i>
                                    <input type="text" class="ds-search-input" id="search-contacto" autocomplete="off" placeholder="Buscar cliente, NIT, ciudad..." value="${escapeHtml(this.state.searchQuery || '')}">
                                    <i class="bi bi-x-circle text-muted" id="clearSearchBtnContactos" style="cursor: pointer; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display: ${this.state.searchQuery ? 'block' : 'none'};"></i>
                                </div>

                                <select class="form-select form-select-sm" id="sort-contactos" style="width: auto; min-width: 160px; font-size: 13px; height: 38px; border-radius: 8px;">
                                    <option value="saldo_cartera:desc" ${this.state.sortColumn === 'saldo_cartera' && this.state.sortDirection === 'desc' ? 'selected' : ''}>💰 Mayor Saldo Cartera</option>
                                    <option value="ventas:desc" ${this.state.sortColumn === 'ventas' && this.state.sortDirection === 'desc' ? 'selected' : ''}>📈 Mayor Ventas (LTV)</option>
                                    <option value="mora:desc" ${this.state.sortColumn === 'mora' && this.state.sortDirection === 'desc' ? 'selected' : ''}>⚠️ Mayor Días Mora</option>
                                    <option value="nombre:asc" ${this.state.sortColumn === 'nombre' && this.state.sortDirection === 'asc' ? 'selected' : ''}>🔤 Nombre (A - Z)</option>
                                    <option value="nombre:desc" ${this.state.sortColumn === 'nombre' && this.state.sortDirection === 'desc' ? 'selected' : ''}>🔤 Nombre (Z - A)</option>
                                </select>
                            </div>
                        </div>

                        <!-- TABLA PRINCIPAL DE DATOS -->
                        <div id="grid-contactos-container" class="position-relative">
                            <div class="table-responsive">
                                <table class="table table-borderless align-middle mb-0 w-100">
                                    <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                        <tr>
                                            <th class="py-3 ps-4 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 40px;">
                                                <input type="checkbox" class="form-check-input" id="check-all-contactos">
                                            </th>
                                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Cliente / Razón Social</th>
                                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Contacto & Ciudad</th>
                                            <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Ventas Totales (LTV)</th>
                                            <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Cartera & Cupo</th>
                                            <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 130px;">Semáforo Mora</th>
                                            <th class="py-3 pe-4 text-end text-uppercase text-muted fw-bold" style="width: 170px;">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody id="tbody-contactos">
                                        <!-- Filas inyectadas por renderGrid -->
                                    </tbody>
                                </table>
                            </div>

                            <!-- Paginación Ergonómica Fija -->
                            <div class="p-3 border-top bg-white d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3 text-muted small">
                                <div class="d-flex align-items-center gap-3">
                                    <span>Página <strong id="current-page">1</strong> de <strong id="total-pages">1</strong></span>
                                    <div class="btn-group">
                                        <button class="btn btn-sm btn-light border text-muted" id="btn-prev-page"><i class="bi bi-chevron-left"></i></button>
                                        <button class="btn btn-sm btn-light border text-muted" id="btn-next-page"><i class="bi bi-chevron-right"></i></button>
                                    </div>
                                </div>
                                <div class="d-flex align-items-center gap-3">
                                    <span class="d-flex align-items-center gap-2">
                                        Por página:
                                        <select id="items-per-page" class="form-select form-select-sm border bg-light text-muted fw-bold" style="width: 70px; border-radius: 6px; cursor: pointer;">
                                            <option value="10">10</option>
                                            <option value="25" selected>25</option>
                                            <option value="50">50</option>
                                            <option value="100">100</option>
                                        </select>
                                    </span>
                                    <span id="showing-count">0-0 de 0</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR PARA FORMULARIO DE ACCIÓN / CREACIÓN (OCULTO POR DEFECTO) -->
                <div id="contactos-action-view" class="view-container p-4" style="display: none;"></div>

            </div>

            <!-- SLIDE-OVER DRAWER LATERAL 360° (OFFCANVAS) -->
            <div class="payment-drawer-backdrop" id="cliente-drawer-backdrop"></div>
            <div class="payment-drawer" id="cliente-drawer" style="width: 640px; max-width: 95vw;">
                <div class="payment-drawer-header">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-person-badge-fill text-primary fs-5"></i>
                        <h5 class="fw-bold mb-0" style="color: #0f172a; font-size: 16px;">Perfil Comercial & Cartera 360°</h5>
                    </div>
                    <div class="d-flex align-items-center gap-1">
                        <button type="button" class="btn btn-sm btn-light border-0 text-muted" id="btn-drawer-close" title="Cerrar panel (ESC)">
                            <i class="bi bi-x-lg fs-6"></i>
                        </button>
                    </div>
                </div>
                <div class="payment-drawer-body" id="cliente-drawer-body">
                    <!-- Contenido inyectado dinámicamente -->
                </div>
                <div class="payment-drawer-footer" id="cliente-drawer-footer">
                    <button type="button" class="btn btn-light border btn-sm px-3 fw-medium" id="btn-drawer-close-bottom">
                        Cerrar
                    </button>
                    <div class="d-flex gap-2" id="cliente-drawer-actions">
                        <!-- Botones de acción inyectados dinámicamente -->
                    </div>
                </div>
            </div>
        `;
    },

    renderGridLoading() {
        const tbody = this.element.querySelector('#tbody-contactos');
        if (!tbody) return;
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5">
                    <div class="spinner-border text-primary mb-2" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <div class="text-muted small">Cargando datos contables y cartera...</div>
                </td>
            </tr>
        `;
    },

    renderGrid(rows, totalCount) {
        const tbody = this.element.querySelector('#tbody-contactos');
        if (!tbody) return;

        const { currentPage, itemsPerPage } = this.state;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + rows.length, totalCount);
        const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

        if (rows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        <i class="bi bi-people fs-1 d-block mb-2 text-secondary opacity-50"></i>
                        <span class="fw-medium">No se encontraron contactos que coincidan con los criterios.</span>
                    </td>
                </tr>
            `;
        } else {
            let html = '';
            rows.forEach(c => {
                const avatar = getClientAvatar(c.nombre);
                const saldoCartera = parseFloat(c.saldo_cartera || 0);
                const maxMora = parseInt(c.max_dias_mora || 0);
                const ventasLTV = parseFloat(c.ventas_totales_ltv || 0);
                const cupoCredito = parseFloat(c.cupo_credito || 0);
                const pctCupo = cupoCredito > 0 ? Math.min(100, Math.round((saldoCartera / cupoCredito) * 100)) : 0;

                // Color de la barra de cupo
                let barColor = '#059669'; // verde
                if (pctCupo >= 90) barColor = '#dc2626'; // rojo
                else if (pctCupo >= 70) barColor = '#d97706'; // amarillo

                // Badges de cliente / proveedor / VIP
                let badges = [];
                if (ventasLTV >= 10000000) {
                    badges.push(`<span class="badge bg-warning text-dark border border-warning-subtle rounded-pill fw-bold" style="font-size: 10px; padding: 2px 7px;"><i class="bi bi-star-fill me-1"></i> VIP</span>`);
                }
                if (c.es_cliente !== false) {
                    badges.push(`<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-medium" style="font-size: 10px; padding: 2px 7px;">Cliente</span>`);
                }
                if (c.es_proveedor) {
                    badges.push(`<span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill fw-medium" style="font-size: 10px; padding: 2px 7px;">Proveedor</span>`);
                }
                const badgeHtml = badges.join(' ');

                html += `
                    <tr class="payment-row row-contacto" data-id="${c.id}" style="cursor: pointer;">
                        <!-- Checkbox -->
                        <td class="py-3 ps-4" onclick="event.stopPropagation()">
                            <input type="checkbox" class="form-check-input contact-check" data-id="${c.id}">
                        </td>

                        <!-- Cliente / Razón Social con Avatar Hash -->
                        <td class="py-3">
                            <div class="d-flex align-items-center gap-3">
                                <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color};">
                                    ${avatar.initials}
                                </div>
                                <div class="text-truncate" style="max-width: 280px;">
                                    <div class="fw-bold text-dark text-truncate" title="${escapeHtml(c.nombre)}" style="font-size: 13.5px;">
                                        ${escapeHtml(c.nombre)}
                                    </div>
                                    <div class="text-muted d-flex align-items-center gap-1.5" style="font-size: 11px;">
                                        <span>${c.nit ? `NIT: ${escapeHtml(c.nit)}` : 'Sin NIT'}</span>
                                        ${badgeHtml ? `<span>• ${badgeHtml}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        </td>

                        <!-- Contacto & Ciudad -->
                        <td class="py-3">
                            <div style="font-size: 12.5px;" class="fw-medium text-dark">
                                ${c.telefono ? `<i class="bi bi-telephone text-muted me-1"></i>${escapeHtml(c.telefono)}` : '<span class="text-muted">Sin teléfono</span>'}
                            </div>
                            <div class="text-muted" style="font-size: 11px;">
                                ${c.ciudad ? `<i class="bi bi-geo-alt me-1"></i>${escapeHtml(c.ciudad)}` : ''}
                                ${c.vendedor_nombre ? `<span>• Vend: ${escapeHtml(c.vendedor_nombre)}</span>` : ''}
                            </div>
                        </td>

                        <!-- Ventas Totales LTV -->
                        <td class="py-3 text-end">
                            <div class="fw-bold text-dark tnum" style="font-size: 13.5px;">
                                ${this.formatMoney(ventasLTV)}
                            </div>
                            <div class="text-muted" style="font-size: 11px;">
                                ${c.total_facturas || 0} ${c.total_facturas === 1 ? 'factura' : 'facturas'}
                            </div>
                        </td>

                        <!-- Cartera & Utilización de Cupo -->
                        <td class="py-3 text-end">
                            <div class="fw-bold ${saldoCartera > 0 ? 'text-danger' : 'text-success'} tnum" style="font-size: 14px;">
                                ${saldoCartera > 0 ? this.formatMoney(saldoCartera) : '$ 0'}
                            </div>
                            ${cupoCredito > 0 ? `
                                <div class="d-flex align-items-center justify-content-end gap-1 mt-1" style="font-size: 10px;" title="Cupo utilizado: ${pctCupo}% (${this.formatMoney(saldoCartera)} / ${this.formatMoney(cupoCredito)})">
                                    <span class="text-muted">${pctCupo}% cupo</span>
                                    <div class="progress" style="width: 50px; height: 5px; background-color: #f1f5f9;">
                                        <div class="progress-bar" style="width: ${pctCupo}%; background-color: ${barColor};"></div>
                                    </div>
                                </div>
                            ` : `
                                <div class="text-muted" style="font-size: 10.5px;">
                                    ${c.facturas_pendientes > 0 ? `${c.facturas_pendientes} pendientes` : 'Al día'}
                                </div>
                            `}
                        </td>

                        <!-- Semáforo de Mora -->
                        <td class="py-3 text-center">
                            ${this.getMoraBadge(maxMora, saldoCartera)}
                        </td>

                        <!-- Acciones en Hover / Foco -->
                        <td class="py-3 pe-4 text-end" onclick="event.stopPropagation()">
                            <div class="payment-row-actions">
                                <!-- Botón Ver Ficha 360° -->
                                <button class="btn btn-sm btn-light border btn-ver-drawer shadow-xs" data-id="${c.id}" title="Abrir Ficha 360° & Cartera" style="border-radius: 6px; width: 32px; height: 30px; padding: 0;">
                                    <i class="bi bi-eye text-primary"></i>
                                </button>

                                ${c.telefono ? `
                                <!-- Botón WhatsApp Cobro -->
                                <button class="btn btn-sm btn-light border btn-wpp-cliente shadow-xs" data-id="${c.id}" title="Cobrar por WhatsApp (${escapeHtml(c.telefono)})" style="border-radius: 6px; width: 32px; height: 30px; padding: 0;">
                                    <i class="bi bi-whatsapp text-success"></i>
                                </button>
                                ` : ''}

                                <!-- Botón Facturar -->
                                <a href="#/ingresos/facturas/nueva?clienteId=${c.id}" class="btn btn-sm btn-light border shadow-xs" title="Crear Factura de Venta" style="border-radius: 6px; width: 32px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">
                                    <i class="bi bi-plus-lg text-secondary"></i>
                                </a>

                                <!-- Botón Menú Flotante de Acciones -->
                                <button class="btn btn-sm btn-light border shadow-xs btn-menu-cliente" data-id="${c.id}" title="Más opciones comerciales" style="border-radius: 6px; width: 32px; height: 30px; padding: 0;">
                                    <i class="bi bi-three-dots-vertical text-dark"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }

        // Paginación UI
        const paginasEl = this.element.querySelector('#current-page');
        const totalPagEl = this.element.querySelector('#total-pages');
        const showingCountEl = this.element.querySelector('#showing-count');
        const prevBtn = this.element.querySelector('#btn-prev-page');
        const nextBtn = this.element.querySelector('#btn-next-page');

        if (paginasEl) paginasEl.textContent = currentPage;
        if (totalPagEl) totalPagEl.textContent = totalPages;
        if (showingCountEl) showingCountEl.textContent = totalCount > 0 ? `${startIndex + 1}-${endIndex} de ${totalCount}` : '0-0 de 0';
        if (prevBtn) prevBtn.disabled = (currentPage === 1);
        if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);

        this.bindFilaEvents();
    },

    renderKpis(kpis = {}) {
        const formatMoney = this.formatMoney;

        // KPI 1: Cartera
        const kpiCartera = this.element.querySelector('#kpi-total-cartera');
        const kpiPctVigente = this.element.querySelector('#kpi-pct-vigente');
        if (kpiCartera) kpiCartera.textContent = formatMoney(kpis.total_cartera || 0);
        if (kpiPctVigente) {
            kpiPctVigente.textContent = `${kpis.pct_vigente || 100}% vigente`;
            kpiPctVigente.className = `payment-kpi-trend ${(kpis.pct_vigente || 100) >= 75 ? 'positive' : 'negative'}`;
        }

        // KPI 2: Ventas
        const kpiVentas = this.element.querySelector('#kpi-ventas-mes');
        const kpiVarVentas = this.element.querySelector('#kpi-variacion-ventas');
        if (kpiVentas) kpiVentas.textContent = formatMoney(kpis.ventas_mes_actual || 0);
        if (kpiVarVentas) {
            const v = kpis.variacion_ventas || 0;
            kpiVarVentas.textContent = `${v >= 0 ? '+' : ''}${v}%`;
            kpiVarVentas.className = `payment-kpi-trend ${v >= 0 ? 'positive' : 'negative'}`;
        }

        // KPI 3: Mora Crítica
        const kpiMora = this.element.querySelector('#kpi-mora-critica');
        const kpiConteoMora = this.element.querySelector('#kpi-conteo-mora');
        if (kpiMora) kpiMora.textContent = formatMoney(kpis.mora_critica_saldo || 0);
        if (kpiConteoMora) {
            kpiConteoMora.innerHTML = `<strong>${kpis.clientes_mora_critica || 0}</strong> clientes en mora >30d`;
        }

        // KPI 4: Clientes Activos
        const kpiActivos = this.element.querySelector('#kpi-clientes-activos');
        const kpiBase = this.element.querySelector('#kpi-total-base');
        if (kpiActivos) kpiActivos.textContent = `${kpis.clientes_activos_60d || 0} activos`;
        if (kpiBase) {
            kpiBase.innerHTML = `Base total: <strong>${kpis.total_clientes || 0}</strong> clientes`;
        }

        // Segmented Tabs Badges
        const bTodos = this.element.querySelector('#badge-tab-todos');
        const bCartera = this.element.querySelector('#badge-tab-con-cartera');
        const bMora = this.element.querySelector('#badge-tab-mora-critica');
        if (bTodos) bTodos.textContent = kpis.total_contactos || 0;
        if (bCartera) bCartera.textContent = kpis.conteo_con_cartera || 0;
        if (bMora) bMora.textContent = kpis.clientes_mora_critica || 0;
    },

    renderDrawerContent(data) {
        const { contacto, facturasPendientes, totalSaldoPendiente, maxDiasMora, historialFacturas, historialPagos } = data;
        const avatar = getClientAvatar(contacto.nombre);
        const formatMoney = this.formatMoney;
        const formatFecha = this.formatFecha;

        const cupo = parseFloat(contacto.cupo_credito || contacto.cupoCredito || 0);
        const pctCupo = cupo > 0 ? Math.min(100, Math.round((totalSaldoPendiente / cupo) * 100)) : 0;

        return `
            <!-- HEADER DE IDENTIDAD -->
            <div class="d-flex align-items-center gap-3 p-3 bg-light rounded-3 mb-4 border">
                <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 48px; height: 48px; font-size: 18px; border-radius: 12px;">
                    ${avatar.initials}
                </div>
                <div class="flex-grow-1 text-truncate">
                    <h5 class="fw-bold mb-1 text-dark text-truncate">${escapeHtml(contacto.nombre)}</h5>
                    <div class="text-muted d-flex flex-wrap align-items-center gap-2" style="font-size: 12px;">
                        <span><strong class="text-secondary">NIT:</strong> ${escapeHtml(contacto.nit || contacto.identificacion || 'Sin NIT')}</span>
                        <span>•</span>
                        <span>${escapeHtml(contacto.ciudad || 'Sin ciudad')}</span>
                        <span>•</span>
                        <span class="badge ${contacto.es_cliente !== false ? 'bg-success' : 'bg-secondary'} bg-opacity-10 text-${contacto.es_cliente !== false ? 'success' : 'secondary'} border rounded-pill">
                            ${escapeHtml(contacto.tipo || (contacto.es_cliente !== false ? 'Cliente' : 'Proveedor'))}
                        </span>
                    </div>
                </div>
            </div>

            <!-- SCORECARD FINANCIERO -->
            <div class="row g-2 mb-4">
                <div class="col-4">
                    <div class="p-3 border rounded-3 text-center bg-white">
                        <div class="text-muted text-uppercase fw-bold" style="font-size: 10px; letter-spacing: 0.5px;">Saldo Pendiente</div>
                        <div class="fw-bold tnum ${totalSaldoPendiente > 0 ? 'text-danger' : 'text-success'} mt-1" style="font-size: 16px;">
                            ${formatMoney(totalSaldoPendiente)}
                        </div>
                        <div class="text-muted small" style="font-size: 10px;">
                            ${facturasPendientes.length} ${facturasPendientes.length === 1 ? 'factura' : 'facturas'}
                        </div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="p-3 border rounded-3 text-center bg-white">
                        <div class="text-muted text-uppercase fw-bold" style="font-size: 10px; letter-spacing: 0.5px;">Mora Máxima</div>
                        <div class="fw-bold tnum ${maxDiasMora > 30 ? 'text-danger' : (maxDiasMora > 0 ? 'text-warning-emphasis' : 'text-success')} mt-1" style="font-size: 16px;">
                            ${maxDiasMora > 0 ? `${maxDiasMora} días` : 'Al día'}
                        </div>
                        <div class="text-muted small" style="font-size: 10px;">
                            Plazo: ${contacto.plazos_pago || contacto.plazosPago || 0}d
                        </div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="p-3 border rounded-3 text-center bg-white">
                        <div class="text-muted text-uppercase fw-bold" style="font-size: 10px; letter-spacing: 0.5px;">Cupo Crédito</div>
                        <div class="fw-bold tnum text-dark mt-1" style="font-size: 16px;">
                            ${cupo > 0 ? formatMoney(cupo) : 'Sin cupo'}
                        </div>
                        <div class="text-muted small" style="font-size: 10px;">
                            ${cupo > 0 ? `${pctCupo}% utilizado` : 'Venta de contado'}
                        </div>
                    </div>
                </div>
            </div>

            <!-- TABS INTERNOS DEL DRAWER -->
            <ul class="nav nav-tabs border-bottom mb-3" id="drawer-cliente-tabs">
                <li class="nav-item">
                    <button class="nav-link active fw-medium" data-bs-toggle="tab" data-bs-target="#tab-drawer-facturas" style="font-size: 12.5px;">
                        <i class="bi bi-clock-history me-1"></i> Facturas Pendientes (${facturasPendientes.length})
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link fw-medium text-muted" data-bs-toggle="tab" data-bs-target="#tab-drawer-historial" style="font-size: 12.5px;">
                        <i class="bi bi-receipt me-1"></i> Recibos de Caja (${historialPagos.length})
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link fw-medium text-muted" data-bs-toggle="tab" data-bs-target="#tab-drawer-ficha" style="font-size: 12.5px;">
                        <i class="bi bi-card-text me-1"></i> Ficha Comercial
                    </button>
                </li>
            </ul>

            <div class="tab-content">
                <!-- TAB 1: FACTURAS PENDIENTES -->
                <div class="tab-pane fade show active" id="tab-drawer-facturas">
                    ${facturasPendientes.length > 0 ? `
                        <div class="table-responsive">
                            <table class="table table-sm table-borderless align-middle mb-0" style="font-size: 12px;">
                                <thead class="bg-light text-muted">
                                    <tr>
                                        <th class="py-2">Factura</th>
                                        <th class="py-2">Vence</th>
                                        <th class="py-2 text-end">Total</th>
                                        <th class="py-2 text-end">Saldo</th>
                                        <th class="py-2 text-end">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${facturasPendientes.map(f => `
                                        <tr class="border-bottom">
                                            <td class="py-2">
                                                <a href="#/ingresos/facturas/ver/${f.id}" class="fw-bold text-primary text-decoration-none" title="Ver factura">
                                                    # ${escapeHtml(f.numero || f.id)}
                                                </a>
                                                <div class="text-muted" style="font-size: 10px;">${formatFecha(f.fecha)}</div>
                                            </td>
                                            <td class="py-2">
                                                ${this.getMoraBadge(f.diasMora, parseFloat(f.saldo))}
                                            </td>
                                            <td class="py-2 text-end tnum text-muted">
                                                ${formatMoney(f.total)}
                                            </td>
                                            <td class="py-2 text-end tnum fw-bold text-danger">
                                                ${formatMoney(f.saldo)}
                                            </td>
                                            <td class="py-2 text-end">
                                                <button class="btn btn-sm btn-outline-success btn-abonar-factura-drawer py-0 px-2" data-id="${f.id}" data-saldo="${f.saldo}" style="font-size: 11px; border-radius: 6px;" title="Registrar Abono a esta factura">
                                                    <i class="bi bi-cash-stack me-1"></i> Abonar
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="text-center py-4 text-muted bg-light rounded-3">
                            <i class="bi bi-check2-circle text-success fs-2 d-block mb-1"></i>
                            <span class="fw-medium">Este cliente no tiene facturas pendientes de cobro.</span>
                        </div>
                    `}
                </div>

                <!-- TAB 2: RECIBOS DE CAJA / HISTORIAL PAGOS -->
                <div class="tab-pane fade" id="tab-drawer-historial">
                    ${historialPagos.length > 0 ? `
                        <div class="table-responsive">
                            <table class="table table-sm table-borderless align-middle mb-0" style="font-size: 12px;">
                                <thead class="bg-light text-muted">
                                    <tr>
                                        <th class="py-2">Recibo</th>
                                        <th class="py-2">Fecha</th>
                                        <th class="py-2">Método / Cuenta</th>
                                        <th class="py-2 text-end">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${historialPagos.map(p => `
                                        <tr class="border-bottom">
                                            <td class="py-2">
                                                <span class="payment-code-badge"># ${escapeHtml(p.numero_recibo || p.numero || p.id)}</span>
                                            </td>
                                            <td class="py-2 text-muted">${formatFecha(p.fecha)}</td>
                                            <td class="py-2">
                                                <span class="badge bg-light text-dark border">${escapeHtml(p.metodo_pago || p.categoria || 'Recibo')}</span>
                                            </td>
                                            <td class="py-2 text-end tnum fw-bold text-success">
                                                ${formatMoney(p.monto)}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="text-center py-4 text-muted bg-light rounded-3">
                            <i class="bi bi-receipt text-secondary fs-2 d-block mb-1"></i>
                            <span class="fw-medium">No se registran recibos de caja recientes para este contacto.</span>
                        </div>
                    `}
                </div>

                <!-- TAB 3: FICHA COMERCIAL -->
                <div class="tab-pane fade" id="tab-drawer-ficha">
                    <div class="p-3 bg-light rounded-3 border">
                        <div class="row g-2" style="font-size: 12.5px;">
                            <div class="col-6">
                                <span class="text-muted d-block small">Teléfono / WhatsApp</span>
                                <strong>${escapeHtml(contacto.telefono || 'No registrado')}</strong>
                            </div>
                            <div class="col-6">
                                <span class="text-muted d-block small">Correo Electrónico</span>
                                <strong>${escapeHtml(contacto.email || 'No registrado')}</strong>
                            </div>
                            <div class="col-12 mt-2">
                                <span class="text-muted d-block small">Dirección & Ciudad</span>
                                <strong>${escapeHtml(contacto.direccion || '')} ${contacto.ciudad ? `(${escapeHtml(contacto.ciudad)})` : ''}</strong>
                            </div>
                            <div class="col-6 mt-2">
                                <span class="text-muted d-block small">Régimen Tributario</span>
                                <strong>${escapeHtml(contacto.regimen || 'Regimen Simplificado')}</strong>
                            </div>
                            <div class="col-6 mt-2">
                                <span class="text-muted d-block small">Días de Plazo</span>
                                <strong>${escapeHtml(contacto.plazos_pago || contacto.plazosPago || 0)} días</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async renderAnalyticsView() {
        const container = this.element.querySelector('#contactos-analytics-container');
        if (!container) return;

        container.innerHTML = `
            <div class="dash-table-container p-4 mb-4 shadow-xs" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h4 class="fw-bold mb-1" style="font-size: 18px; color: #0f172a;">Analítica Comercial & Concentración de Clientes</h4>
                        <p class="text-muted mb-0 small">Análisis de la Regla de Pareto (80/20) y envejecimiento de la cartera de clientes.</p>
                    </div>
                </div>

                <div class="row g-4">
                    <!-- Gráfico 1: Top Clientes Pareto -->
                    <div class="col-12 col-lg-7">
                        <div class="p-3 border rounded-3 bg-light h-100">
                            <h6 class="fw-bold text-dark mb-1">Top 10 Clientes por Facturación Acumulada</h6>
                            <span class="text-muted small d-block mb-3">Concentración de ventas por cliente</span>
                            <div style="height: 280px; position: relative;">
                                <canvas id="chart-clientes-pareto"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Gráfico 2: Aging de Cartera -->
                    <div class="col-12 col-lg-5">
                        <div class="p-3 border rounded-3 bg-light h-100">
                            <h6 class="fw-bold text-dark mb-1">Aging de Cartera (Morosidad por Tramos)</h6>
                            <span class="text-muted small d-block mb-3">Distribución del saldo pendiente por antigüedad</span>
                            <div style="height: 280px; position: relative;">
                                <canvas id="chart-cartera-aging"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const { topClients, aging } = await this.fetchAnalyticsData();

        // Cargar Chart.js si no está presente
        if (typeof Chart === 'undefined') {
            await new Promise((resolve) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
                s.onload = resolve;
                document.head.appendChild(s);
            });
        }

        // Gráfico 1: Pareto
        const ctxPareto = document.getElementById('chart-clientes-pareto');
        if (ctxPareto) {
            if (window.myClientesParetoChart) window.myClientesParetoChart.destroy();
            window.myClientesParetoChart = new Chart(ctxPareto, {
                type: 'bar',
                data: {
                    labels: topClients.map(c => c[0].length > 15 ? c[0].substring(0, 13) + '..' : c[0]),
                    datasets: [{
                        label: 'Ventas ($)',
                        data: topClients.map(c => c[1]),
                        backgroundColor: '#2563eb',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false } },
                        y: {
                            ticks: {
                                callback: v => '$' + (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : (v / 1000).toFixed(0) + 'k')
                            }
                        }
                    }
                }
            });
        }

        // Gráfico 2: Aging Donut
        const ctxAging = document.getElementById('chart-cartera-aging');
        if (ctxAging) {
            if (window.myCarteraAgingChart) window.myCarteraAgingChart.destroy();
            window.myCarteraAgingChart = new Chart(ctxAging, {
                type: 'doughnut',
                data: {
                    labels: ['Al día / Vigente', 'Mora 1-30 días', 'Mora 31-60 días', 'Mora >60 días'],
                    datasets: [{
                        data: [aging.vigente, aging.mora1_30, aging.mora31_60, aging.moraMas60],
                        backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#dc2626']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                    },
                    cutout: '65%'
                }
            });
        }
    },

    async renderForm(id = null) {
        const listView = this.element.querySelector('#contactos-main-layout');
        const actionView = this.element.querySelector('#contactos-action-view');
        if (!listView || !actionView) return;

        this.element.querySelector('#contactos-table-view-container').style.display = 'none';
        this.element.querySelector('#contactos-kpi-row').style.display = 'none';
        const analyticsEl = this.element.querySelector('#contactos-analytics-container');
        if (analyticsEl) analyticsEl.style.display = 'none';

        actionView.style.display = 'block';

        let contacto = { nombre: '', nit: '', tipo: 'cliente', telefono: '', email: '', ciudad: '', direccion: '', regimen: 'Regimen Simplificado', cupoCredito: 0, plazosPago: 0 };

        if (id) {
            const db = this.getDB ? await this.getDB() : (typeof window !== 'undefined' ? window.DB : null);
            contacto = db ? (await db.get('contactos', id)) || contacto : contacto;
        }

        const supabase = this.getSupabase ? await this.getSupabase() : null;
        const { data: vendedoresActivos } = supabase
            ? await supabase.from('vendedores').select('id, nombre').eq('estado', 'activo').order('nombre')
            : { data: [] };

        actionView.innerHTML = `
            <div class="form-hoja-completa bg-white rounded p-4 border shadow-xs" style="border-radius: 12px;">
                <div class="d-flex align-items-center mb-3">
                    <button id="btn-cancelar-contacto"
                        class="btn btn-link text-decoration-none p-0 me-3 d-flex align-items-center"
                        style="color: var(--text-body) !important; font-weight: var(--weight-medium); transition: color 0.2s;">
                        <i class="bi bi-arrow-left me-2"></i>Volver a Contactos
                    </button>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                    <h3 class="h5 m-0 fw-bold">${id ? 'Editar Contacto' : 'Crear Nuevo Contacto'}</h3>
                </div>
                <form id="form-contacto-data">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium">Nombre o Razón Social *</label>
                            <input type="text" id="form-nombre" class="form-control form-control-sm" value="${escapeHtml(contacto.nombre || '')}" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium">NIT o Cédula *</label>
                            <input type="text" id="form-nit" class="form-control form-control-sm" value="${escapeHtml(contacto.nit || contacto.identificacion || '')}" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium d-block">Tipo de Contacto <span class="text-danger">*</span></label>
                            <div class="form-check form-check-inline mt-1">
                                <input class="form-check-input" type="checkbox" id="form-es-cliente" ${contacto.es_cliente !== false ? 'checked' : ''}>
                                <label class="form-check-label text-muted small" for="form-es-cliente">Es cliente</label>
                            </div>
                            <div class="form-check form-check-inline mt-1">
                                <input class="form-check-input" type="checkbox" id="form-es-proveedor" ${contacto.es_proveedor ? 'checked' : ''}>
                                <label class="form-check-label text-muted small" for="form-es-proveedor">Es proveedor</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium">Vendedor asignado</label>
                            <select id="form-vendedor" class="form-select form-select-sm">
                                <option value="">Sin vendedor asignado</option>
                                ${(vendedoresActivos || []).map(v => `<option value="${v.id}" ${String(contacto.vendedor_id) === String(v.id) ? 'selected' : ''}>${escapeHtml(v.nombre)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium">Teléfono</label>
                            <input type="text" id="form-telefono" class="form-control form-control-sm" value="${escapeHtml(contacto.telefono) || ''}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium">Correo Electrónico</label>
                            <input type="email" id="form-email" class="form-control form-control-sm" value="${escapeHtml(contacto.email) || ''}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium">Ciudad</label>
                            <input type="text" id="form-ciudad" class="form-control form-control-sm" value="${escapeHtml(contacto.ciudad) || ''}">
                        </div>
                        <div class="col-md-12">
                            <label class="form-label text-muted small fw-medium">Dirección</label>
                            <input type="text" id="form-direccion" class="form-control form-control-sm" value="${escapeHtml(contacto.direccion) || ''}">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label text-muted small fw-medium">Régimen Tributario</label>
                            <select id="form-regimen" class="form-select form-select-sm">
                                <option value="Regimen Simplificado" ${contacto.regimen === 'Regimen Simplificado' ? 'selected' : ''}>Régimen Simplificado (No responsable de IVA)</option>
                                <option value="Regimen Comun" ${contacto.regimen === 'Regimen Comun' ? 'selected' : ''}>Régimen Común (Responsable de IVA)</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label text-muted small fw-medium">Cupo de Crédito ($)</label>
                            <input type="number" id="form-cupo" class="form-control form-control-sm" value="${escapeHtml(contacto.cupoCredito || contacto.cupo_credito) || 0}">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label text-muted small fw-medium">Plazos de Pago (Días)</label>
                            <input type="number" id="form-plazos" class="form-control form-control-sm" value="${escapeHtml(contacto.plazosPago || contacto.plazos_pago) || 0}">
                        </div>
                    </div>
                    <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                        <button type="button" class="btn btn-light" id="btn-cancelar-form">Cancelar</button>
                        <button type="submit" class="btn btn-primary-action">Guardar Contacto</button>
                    </div>
                </form>
            </div>
        `;

        this.element.querySelector('#btn-cancelar-contacto')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.restaurarVistaTabla();
        });

        this.element.querySelector('#btn-cancelar-form')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.restaurarVistaTabla();
        });

        this.element.querySelector('#form-contacto-data')?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const esCliente = this.element.querySelector('#form-es-cliente').checked;
            const esProveedor = this.element.querySelector('#form-es-proveedor').checked;
            if (!esCliente && !esProveedor) {
                CoreActions.showWarningModal("Debe seleccionar al menos un tipo de contacto (Cliente o Proveedor).");
                return;
            }

            const datos = {
                nombre: this.element.querySelector('#form-nombre').value,
                nit: this.element.querySelector('#form-nit').value,
                identificacion: this.element.querySelector('#form-nit').value,
                es_cliente: esCliente,
                es_proveedor: esProveedor,
                tipo: esProveedor && !esCliente ? 'proveedor' : 'cliente',
                vendedor_id: this.element.querySelector('#form-vendedor').value || null,
                telefono: this.element.querySelector('#form-telefono').value,
                email: this.element.querySelector('#form-email').value,
                ciudad: this.element.querySelector('#form-ciudad').value,
                direccion: this.element.querySelector('#form-direccion').value,
                regimen: this.element.querySelector('#form-regimen').value,
                cupo_credito: parseFloat(this.element.querySelector('#form-cupo').value) || 0,
                plazos_pago: parseInt(this.element.querySelector('#form-plazos').value) || 0
            };

            const nuevoContacto = {
                id: id || 'cont_' + Date.now(),
                ...datos
            };
            const db = this.getDB ? await this.getDB() : (typeof window !== 'undefined' ? window.DB : null);
            if (db) await db.save('contactos', nuevoContacto);
            await this.cargarPagina();
            this.restaurarVistaTabla();
        });
    },

    async restaurarVistaTabla() {
        const actionView = this.element.querySelector('#contactos-action-view');
        const tableView = this.element.querySelector('#contactos-table-view-container');
        const kpiRow = this.element.querySelector('#contactos-kpi-row');

        if (actionView) {
            actionView.innerHTML = '';
            actionView.style.display = 'none';
        }
        if (tableView) tableView.style.display = this.state.view !== 'grafico' ? 'block' : 'none';
        if (kpiRow) kpiRow.style.display = 'flex';

        await this.cargarPagina();
    },

    renderQuickModal(query, onSuccessCallback) {
        const existingModal = document.getElementById('quick-contacto-modal');
        if (existingModal) existingModal.remove();

        const isNit = /^[\d-]+$/.test(query);
        const defaultName = isNit ? '' : query;
        const defaultNit = isNit ? query : '';

        const modalHtml = `
            <div class="modal fade" id="quick-contacto-modal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow">
                        <div class="modal-header border-bottom-0 pb-0">
                            <h5 class="modal-title fw-bold">Crear Contacto Rápido</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="quick-contacto-form">
                                <div class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label small fw-bold text-muted mb-1">Nombre / Razón Social <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="quick-nombre" value="${escapeHtml(defaultName)}" required autocomplete="off">
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label small fw-bold text-muted mb-1">NIT / Identificación <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="quick-nit" value="${escapeHtml(defaultNit)}" required autocomplete="off">
                                    </div>
                                    <div class="col-12 col-sm-6">
                                        <label class="form-label small fw-bold text-muted mb-1 d-block">Tipo <span class="text-danger">*</span></label>
                                        <div class="form-check form-check-inline mt-2">
                                            <input class="form-check-input" type="checkbox" id="quick-es-cliente" checked>
                                            <label class="form-check-label small" for="quick-es-cliente">Cliente</label>
                                        </div>
                                        <div class="form-check form-check-inline mt-2">
                                            <input class="form-check-input" type="checkbox" id="quick-es-proveedor">
                                            <label class="form-check-label small" for="quick-es-proveedor">Proveedor</label>
                                        </div>
                                    </div>
                                    <div class="col-12 col-sm-6">
                                        <label class="form-label small fw-bold text-muted mb-1">Teléfono</label>
                                        <input type="text" class="form-control" id="quick-telefono" autocomplete="off">
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer border-top-0 pt-0">
                            <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary-action" id="btn-save-quick-contacto">Guardar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('quick-contacto-modal');
        const modalInstance = new bootstrap.Modal(modalEl);

        modalEl.querySelector('#btn-save-quick-contacto').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const form = modalEl.querySelector('#quick-contacto-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

            const esCliente = modalEl.querySelector('#quick-es-cliente').checked;
            const esProveedor = modalEl.querySelector('#quick-es-proveedor').checked;
            if (!esCliente && !esProveedor) {
                alert("Debe seleccionar al menos un tipo de contacto.");
                btn.disabled = false;
                btn.innerHTML = 'Guardar';
                return;
            }

            const nuevoContacto = {
                nombre: modalEl.querySelector('#quick-nombre').value.trim(),
                nit: modalEl.querySelector('#quick-nit').value.trim(),
                identificacion: modalEl.querySelector('#quick-nit').value.trim(),
                es_cliente: esCliente,
                es_proveedor: esProveedor,
                tipo: esProveedor && !esCliente ? 'proveedor' : 'cliente',
                telefono: modalEl.querySelector('#quick-telefono').value.trim() || null,
                email: null,
                direccion: null,
                ciudad: null,
                regimen: 'Regimen Simplificado',
                cupo_credito: 0,
                plazos_pago: 0
            };

            try {
                let existing = null;
                const supabase = typeof window !== 'undefined' && window.supabase ? window.supabase : (this.getSupabase ? await this.getSupabase() : null);
                if (supabase) {
                    const res = await supabase.from('contactos').select('id').eq('identificacion', nuevoContacto.nit).single();
                    existing = res.data;
                }

                if (existing) throw new Error('Ya existe un contacto con esta identificación');

                const db = typeof window !== 'undefined' ? window.DB : null;
                const savedContacto = db ? await db.save('contactos', nuevoContacto) : nuevoContacto;
                modalInstance.hide();
                if (onSuccessCallback) onSuccessCallback(savedContacto);
            } catch (err) {
                console.error(err);
                alert('Error al guardar contacto: ' + err.message);
                btn.disabled = false;
                btn.innerHTML = 'Guardar';
            }
        });

        modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
        modalInstance.show();
    }
};
