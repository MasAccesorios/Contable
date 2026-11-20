// js/modules/productos/productos.templates.js
// Capa de Presentación HTML, Componentes Visuales y Formateo Ergonómico (Stitch UI)

import { escapeHtml } from '../../shared/formatters.js';

/**
 * Genera un avatar visual determinista con iniciales y paleta cromática armónica
 */
export function getProductAvatar(name) {
    if (!name || typeof name !== 'string' || !name.trim()) {
        return { initials: 'IT', bg: '#f1f5f9', color: '#64748b' };
    }

    const clean = name.trim();
    const parts = clean.split(/\s+/);
    let initials = parts[0][0] || '';
    if (parts.length > 1 && parts[1][0]) initials += parts[1][0];
    initials = initials.toUpperCase();

    const palettes = [
        { bg: '#eff6ff', color: '#1d4ed8' }, // Blue
        { bg: '#ecfdf5', color: '#059669' }, // Emerald
        { bg: '#f5f3ff', color: '#7c3aed' }, // Purple
        { bg: '#fff7ed', color: '#c2410c' }, // Orange
        { bg: '#f0fdfa', color: '#0f766e' }, // Teal
        { bg: '#fdf2f8', color: '#be185d' }, // Pink
        { bg: '#fefce8', color: '#a16207' }, // Amber
        { bg: '#f8fafc', color: '#334155' }  // Slate
    ];

    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
        hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % palettes.length;
    return { initials: initials.substring(0, 2), ...palettes[idx] };
}

export const ProductosTemplates = {
    escapeHtml,

    formatMoney(val) {
        const num = parseFloat(val || 0);
        return '$ ' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

    formatDecimal(val, dec = 2) {
        const num = parseFloat(val || 0);
        return num.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    },

    getMargenBadge(margenPct, utilidadUnitaria) {
        const pct = parseFloat(margenPct || 0);
        const utilStr = this.formatMoney(utilidadUnitaria);

        if (pct >= 25) {
            return `
                <div class="d-flex flex-column align-items-end">
                    <span class="badge badge-stitch-cobrado tnum" style="font-size: 10.5px; font-weight: 700; padding: 2px 7px;">
                        <i class="bi bi-arrow-up-right me-1"></i>${pct.toFixed(1)}%
                    </span>
                    <span class="text-muted tnum" style="font-size: 9.5px; margin-top: 1px;">+${utilStr}</span>
                </div>
            `;
        } else if (pct >= 10) {
            return `
                <div class="d-flex flex-column align-items-end">
                    <span class="badge badge-stitch-pendiente tnum" style="font-size: 10.5px; font-weight: 700; padding: 2px 7px;">
                        <i class="bi bi-dash me-1"></i>${pct.toFixed(1)}%
                    </span>
                    <span class="text-muted tnum" style="font-size: 9.5px; margin-top: 1px;">+${utilStr}</span>
                </div>
            `;
        } else {
            return `
                <div class="d-flex flex-column align-items-end">
                    <span class="badge badge-stitch-vencido tnum" style="font-size: 10.5px; font-weight: 700; padding: 2px 7px;">
                        <i class="bi bi-arrow-down-right me-1"></i>${pct.toFixed(1)}%
                    </span>
                    <span class="text-danger tnum" style="font-size: 9.5px; margin-top: 1px;">+${utilStr}</span>
                </div>
            `;
        }
    },

    getStockBadge(estadoStock, stock, stockMinimo) {
        const s = parseFloat(stock || 0);
        const min = parseFloat(stockMinimo || 5);
        const ratio = min > 0 ? Math.min(Math.round((s / min) * 100), 100) : 100;

        if (estadoStock === 'agotado' || s <= 0) {
            return `
                <div class="d-flex flex-column align-items-end">
                    <span class="badge badge-stitch-vencido tnum" style="font-size: 10.5px; font-weight: 700; padding: 2px 7px;">
                        <i class="bi bi-x-circle me-1"></i>Agotado (0 und)
                    </span>
                    <span class="text-danger" style="font-size: 9.5px; margin-top: 1px;">Min: ${min}</span>
                </div>
            `;
        } else if (estadoStock === 'bajo_stock' || s <= min) {
            return `
                <div class="d-flex flex-column align-items-end">
                    <span class="badge badge-stitch-vencido tnum" style="font-size: 10.5px; font-weight: 700; background-color: #fffbeb; color: #b45309; border-color: #fde68a; padding: 2px 7px;">
                        <i class="bi bi-exclamation-triangle-fill me-1"></i>${s} und (Crítico)
                    </span>
                    <div class="d-flex align-items-center gap-1 mt-1" style="width: 65px;">
                        <div class="progress flex-grow-1" style="height: 3px; background-color: #fef3c7;">
                            <div class="progress-bar bg-warning" role="progressbar" style="width: ${ratio}%;"></div>
                        </div>
                        <span class="text-muted" style="font-size: 9px;">${ratio}%</span>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="d-flex flex-column align-items-end">
                    <span class="badge badge-stitch-cobrado tnum" style="font-size: 10.5px; font-weight: 700; padding: 2px 7px;">
                        <i class="bi bi-check2-circle me-1"></i>${s} und (Óptimo)
                    </span>
                    <span class="text-muted" style="font-size: 9.5px; margin-top: 1px;">Min: ${min}</span>
                </div>
            `;
        }
    },

    renderLayout() {
        const kpis = this.state.kpis || {};
        const tabCounts = this.state.tabCounts || {};

        return `
            <div class="dash-layout p-4" style="max-width: 1400px; margin: 0 auto;">
                
                <!-- 1. TOP BAR DE ALTO IMPACTO -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <a href="#" onclick="event.preventDefault(); window.history.length > 2 ? window.history.back() : window.location.hash = '#/dashboard';" class="btn btn-light bg-white border me-2 shadow-xs" style="font-weight: 500; font-size: 13px; color: var(--text-body); border-radius: 8px;">
                                <i class="bi bi-arrow-left"></i>
                            </a>
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Ítems de Venta</h2>
                            <span class="badge" style="background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #bfdbfe;">
                                <i class="bi bi-box-seam me-1"></i> Catálogo de Inventario
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 4px;">
                            Monitoreo en tiempo real de productos, costeo ponderado bajo capas FIFO y control de disponibilidad.
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Toggle de Vistas: Lista vs Analítica -->
                        <div class="btn-group p-1 bg-light border rounded-3" role="group">
                            <button type="button" class="btn btn-sm ${this.state.view !== 'grafico' ? 'btn-white bg-white shadow-xs fw-bold' : 'btn-light border-0 text-muted'}" id="btn-view-lista" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-table me-1"></i> Lista
                            </button>
                            <button type="button" class="btn btn-sm ${this.state.view === 'grafico' ? 'btn-white bg-white shadow-xs fw-bold text-primary' : 'btn-light border-0 text-muted'}" id="btn-view-grafico" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-bar-chart me-1"></i> Analítica
                            </button>
                        </div>

                        <!-- Botón Exportar Excel -->
                        <button id="btn-export-excel" class="btn btn-light bg-white border text-secondary shadow-xs d-flex align-items-center gap-1" style="font-weight: 600; font-size: 13px; border-radius: 8px;" title="Descargar Catálogo en Excel">
                            <i class="bi bi-file-earmark-excel text-success"></i> Exportar
                        </button>

                        <!-- Botón Refrescar -->
                        <button id="btn-refresh-grid" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>

                        <!-- Botón Desplegar Drawer Nuevo Producto -->
                        <button id="btn-nuevo-producto" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-plus-lg"></i> Nuevo Producto
                        </button>
                    </div>
                </div>

                <!-- 2. CUATRO KPI CARDS EJECUTIVAS DINÁMICAS -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Valorización Total Inventario -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #2563eb;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Valor Total Inventario</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-safe2"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-primary tnum" id="kpi-valor-inventario" style="font-size: 22px;">
                                ${this.formatMoney(kpis.valor_total_inventario)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <i class="bi bi-boxes text-secondary me-1"></i> <strong class="text-dark tnum" id="kpi-unidades-fisicas">${(Math.round(kpis.total_unidades_fisicas || 0)).toLocaleString('es-CO')}</strong> unds físicas (FIFO)
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Catálogo Activo -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Catálogo Activo</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-tags"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-total-items" style="font-size: 22px;">
                                ${(kpis.total_activos || 0).toLocaleString('es-CO')}
                            </div>
                            <div class="mt-2 d-flex align-items-center gap-2">
                                <span class="badge bg-light text-muted border tnum" style="font-size: 10px;">
                                    ${(tabCounts.optimo || 0)} con stock seguro
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Stock Crítico / Reposición -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card cursor-pointer" id="card-kpi-stock-critico" style="border-left: 3px solid #d97706;" title="Clic para filtrar ítems en riesgo">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Puntos de Reorden / Críticos</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-exclamation-diamond-fill"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-warning-emphasis tnum" id="kpi-stock-critico" style="font-size: 22px;">
                                ${(kpis.bajo_stock || 0).toLocaleString('es-CO')}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <span class="text-danger fw-semibold">${(kpis.agotados || 0)} agotados</span> · Reposición urgente
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Margen Estimado Global -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Margen Bruto Global</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-graph-up-arrow"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" id="kpi-margen-promedio" style="font-size: 22px;">
                                ${(kpis.margen_promedio_global || 0).toFixed(1)}%
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Potencial: <span class="text-dark fw-semibold tnum">${this.formatMoney(kpis.valor_venta_potencial)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 3. CONTENEDOR DE ANALÍTICA GRÁFICA (VISTA ALTERNATIVA) -->
                <div id="productos-analytics-container" style="display: ${this.state.view === 'grafico' ? 'block' : 'none'};"></div>

                <!-- 4. CONTENEDOR DE TABLA DE DATOS -->
                <div id="productos-table-view-container" style="display: ${this.state.view !== 'grafico' ? 'block' : 'none'};">
                    <div class="dash-table-container mb-4 shadow-xs" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                        
                        <!-- FILTROS Y TABS SUPERIORES -->
                        <div class="p-3 border-bottom bg-white d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                            <!-- Tabs de Filtro Rápido (Segmented Control) -->
                            <div class="payment-tabs-bar" id="productos-tabs-bar">
                                <button type="button" class="payment-tab-btn ${this.state.currentFilter === 'todos' ? 'active' : ''}" data-tab="todos">
                                    Todos <span class="payment-tab-badge" id="badge-tab-todos">${tabCounts.todos || 0}</span>
                                </button>
                                <button type="button" class="payment-tab-btn tab-warning ${this.state.currentFilter === 'bajo_stock' ? 'active' : ''}" data-tab="bajo_stock">
                                    <i class="bi bi-exclamation-triangle text-warning"></i> Bajo Mínimo
                                    <span class="payment-tab-badge" id="badge-tab-bajo-stock" style="background-color: #fef3c7; color: #b45309;">${tabCounts.bajo_stock || 0}</span>
                                </button>
                                <button type="button" class="payment-tab-btn ${this.state.currentFilter === 'agotado' ? 'active' : ''}" data-tab="agotado">
                                    <i class="bi bi-x-circle text-danger"></i> Agotados
                                    <span class="payment-tab-badge" id="badge-tab-agotado" style="background-color: #fee2e2; color: #dc2626;">${tabCounts.agotado || 0}</span>
                                </button>
                                <button type="button" class="payment-tab-btn ${this.state.currentFilter === 'optimo' ? 'active' : ''}" data-tab="optimo">
                                    <i class="bi bi-check-circle text-success"></i> Con Stock
                                    <span class="payment-tab-badge" id="badge-tab-optimo">${tabCounts.optimo || 0}</span>
                                </button>
                                <button type="button" class="payment-tab-btn ${this.state.currentFilter === 'inactivos' ? 'active' : ''}" data-tab="inactivos">
                                    Inactivos
                                    <span class="payment-tab-badge" id="badge-tab-inactivos">${tabCounts.inactivos || 0}</span>
                                </button>
                            </div>

                            <!-- Buscador y Selectores -->
                            <div class="d-flex flex-wrap align-items-center gap-2">
                                <div class="ds-search-container" style="min-width: 240px; position: relative;">
                                    <i class="bi bi-search ds-search-icon" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 14px;"></i>
                                    <input type="text" class="form-control form-control-sm ds-search-input" id="search-productos" autocomplete="off" placeholder="Buscar por SKU, nombre..." value="${escapeHtml(this.state.searchQuery || '')}" style="padding-left: 34px; height: 38px; border-radius: 8px; font-size: 13px;">
                                    <button type="button" id="btn-clear-search-productos" class="btn btn-sm btn-link text-muted position-absolute end-0 top-50 translate-middle-y me-1 p-0 border-0" style="display: ${this.state.searchQuery ? 'block' : 'none'}; text-decoration: none;">
                                        <i class="bi bi-x-circle-fill"></i>
                                    </button>
                                </div>

                                <select class="form-select form-select-sm" id="sort-productos" style="width: auto; font-size: 13px; height: 38px; border-radius: 8px;">
                                    <option value="nombre:asc" ${this.state.sortColumn === 'nombre' && this.state.sortDirection === 'asc' ? 'selected' : ''}>Nombre (A - Z)</option>
                                    <option value="nombre:desc" ${this.state.sortColumn === 'nombre' && this.state.sortDirection === 'desc' ? 'selected' : ''}>Nombre (Z - A)</option>
                                    <option value="stock:asc" ${this.state.sortColumn === 'stock' && this.state.sortDirection === 'asc' ? 'selected' : ''}>Menor Stock primero</option>
                                    <option value="stock:desc" ${this.state.sortColumn === 'stock' && this.state.sortDirection === 'desc' ? 'selected' : ''}>Mayor Stock primero</option>
                                    <option value="valorTotal:desc" ${this.state.sortColumn === 'valorTotal' && this.state.sortDirection === 'desc' ? 'selected' : ''}>Mayor Valorización</option>
                                    <option value="margen:desc" ${this.state.sortColumn === 'margen' && this.state.sortDirection === 'desc' ? 'selected' : ''}>Mayor Margen (%)</option>
                                </select>
                            </div>
                        </div>

                        <!-- TABLA ERGONÓMICA DE PRODUCTOS -->
                        <div class="table-responsive position-relative">
                            <div id="grid-loading-overlay" class="position-absolute top-0 start-0 w-100 h-100 justify-content-center align-items-center bg-white bg-opacity-75" style="z-index: 10; display: none;">
                                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>
                            </div>

                            <table class="table table-borderless align-middle mb-0 w-100">
                                <thead style="border-bottom: 1px solid var(--border-color); background-color: #f8fafc;" id="grid-thead">
                                    <tr>
                                        <th class="py-2.5 ps-3" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Producto & SKU</th>
                                        <th class="py-2.5 px-2 text-end" style="width: 135px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); white-space: nowrap;">Stock & Estado</th>
                                        <th class="py-2.5 px-2 text-end" style="width: 105px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); white-space: nowrap;">Costo Prom.</th>
                                        <th class="py-2.5 px-2 text-end" style="width: 105px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); white-space: nowrap;">Precio Venta</th>
                                        <th class="py-2.5 px-2 text-end" style="width: 105px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); white-space: nowrap;">Margen Bruto</th>
                                        <th class="py-2.5 px-2 text-end" style="width: 120px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); white-space: nowrap;">Valor Bodega</th>
                                        <th class="py-2.5 pe-3 text-center" style="width: 44px;"></th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-productos">
                                    <!-- Llenado dinámicamente por renderGrid -->
                                </tbody>
                            </table>
                        </div>

                        <!-- PAGINACIÓN -->
                        <div class="card-footer bg-white border-top p-3 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2" style="border-radius: 0 0 12px 12px;" id="grid-pagination">
                            <!-- Inyectado por renderPagination -->
                        </div>
                    </div>
                </div>

                <!-- 5. SLIDE-OVER DRAWER LATERAL (CREACIÓN / EDICIÓN) -->
                <div class="payment-drawer-backdrop" id="producto-drawer-backdrop"></div>
                <div class="payment-drawer" id="producto-drawer" style="max-width: 580px; width: 100%;">
                    <div class="payment-drawer-header d-flex justify-content-between align-items-center p-3 border-bottom">
                        <div class="d-flex align-items-center gap-2">
                            <div class="payment-kpi-icon in-bg" style="width: 32px; height: 32px; font-size: 16px;">
                                <i class="bi bi-box-seam" id="drawer-header-icon"></i>
                            </div>
                            <h5 class="mb-0 fw-bold" style="font-size: 16px;" id="producto-drawer-title">Nuevo Producto</h5>
                        </div>
                        <button type="button" class="btn btn-sm btn-light border-0 text-muted" id="btn-cerrar-drawer" title="Cerrar panel">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div class="payment-drawer-body p-4" id="producto-drawer-body" style="overflow-y: auto;">
                        <!-- Inyectado por renderDrawerContent -->
                    </div>
                </div>

                <!-- 6. CONTENEDOR PARA DETALLE DE PRODUCTO (SUBVISTA RETROCOMPATIBLE) -->
                <div id="productos-view-container" class="view-container mt-4"></div>
            </div>
        `;
    },

    renderGrid(rows = [], totalCount = 0) {
        const tbody = this.element ? this.element.querySelector('#tbody-productos') : null;
        if (!tbody) return;

        if (!rows || rows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <div class="d-flex flex-column align-items-center justify-content-center p-4">
                            <div class="payment-kpi-icon blue-bg mb-3" style="width: 54px; height: 54px; font-size: 26px;">
                                <i class="bi bi-box-seam"></i>
                            </div>
                            <h6 class="fw-bold mb-1" style="color: var(--text-main);">No se encontraron ítems</h6>
                            <p class="text-muted small mb-0" style="max-width: 320px;">
                                No hay productos que coincidan con el filtro actual o criterio de búsqueda.
                            </p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        rows.forEach(p => {
            const avatar = getProductAvatar(p.nombre);
            const stockBadge = this.getStockBadge(p.estadoStock, p.stock, p.stockMinimo);
            const margenBadge = this.getMargenBadge(p.margenPct, p.utilidadUnitaria);
            const valorTotalStr = this.formatMoney(p.valorTotalInventario);
            const costoStr = this.formatMoney(p.costoPromedio);
            const precioStr = this.formatMoney(p.precioVenta);
            const isInactive = p.estado === 'inactivo' || p.estado === 'inactive';

            html += `
                <tr data-id="${escapeHtml(String(p.id))}" class="row-producto-clickable ${isInactive ? 'opacity-75' : ''}" style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; transition: background-color 0.15s ease;">
                    <!-- Producto y SKU -->
                    <td class="py-2.5 ps-3">
                        <div class="d-flex align-items-center gap-2.5">
                            <div style="width: 32px; height: 32px; border-radius: 8px; background-color: ${avatar.bg}; color: ${avatar.color}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                                ${avatar.initials}
                            </div>
                            <div class="d-flex flex-column" style="min-width: 0;">
                                <span class="fw-bold text-truncate" style="color: var(--text-main); font-size: 12.5px; max-width: 250px;" title="${escapeHtml(p.nombre || '')}">
                                    ${escapeHtml(p.nombre || 'Sin nombre')}
                                </span>
                                <div class="d-flex align-items-center gap-1 mt-0.5">
                                    <span class="badge bg-light text-secondary border font-monospace tnum" style="font-size: 9.5px; padding: 1px 5px;">
                                        ${escapeHtml(p.sku || 'SIN-SKU')}
                                    </span>
                                    <button class="btn btn-link p-0 text-muted btn-copy-sku" data-sku="${escapeHtml(p.sku || '')}" title="Copiar SKU" style="font-size: 11px; line-height: 1;">
                                        <i class="bi bi-clipboard"></i>
                                    </button>
                                    ${isInactive ? '<span class="badge bg-secondary text-white" style="font-size: 8.5px; padding: 1px 4px;">Inactivo</span>' : ''}
                                </div>
                            </div>
                        </div>
                    </td>

                    <!-- Stock & Estado -->
                    <td class="py-2.5 px-2 text-end" style="white-space: nowrap;">
                        ${stockBadge}
                    </td>

                    <!-- Costo Promedio -->
                    <td class="py-2.5 px-2 text-end" style="white-space: nowrap;">
                        <span class="fw-semibold text-secondary tnum" style="font-size: 12.5px;">${costoStr}</span>
                        ${(p.lotesActivosCount || 0) > 1 ? `<div class="text-muted" style="font-size: 9.5px;">${p.lotesActivosCount} capas FIFO</div>` : ''}
                    </td>

                    <!-- Precio Venta -->
                    <td class="py-2.5 px-2 text-end" style="white-space: nowrap;">
                        <span class="fw-bold text-dark tnum" style="font-size: 12.5px;">${precioStr}</span>
                    </td>

                    <!-- Margen Bruto -->
                    <td class="py-2.5 px-2 text-end" style="white-space: nowrap;">
                        ${margenBadge}
                    </td>

                    <!-- Valor Total en Bodega -->
                    <td class="py-2.5 px-2 text-end" style="white-space: nowrap;">
                        <span class="fw-bold text-primary tnum" style="font-size: 12.5px;">${valorTotalStr}</span>
                    </td>

                    <!-- Acciones Rápidas (Dropdown 3 Puntos) -->
                    <td class="py-2.5 pe-3 text-center" style="white-space: nowrap;" onclick="event.stopPropagation();">
                        <div class="dropdown">
                            <button class="btn btn-sm btn-light border-0 text-muted p-1 rounded-circle" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="width: 26px; height: 26px; line-height: 1;">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end shadow-sm border" style="font-size: 13px; border-radius: 8px;">
                                <li>
                                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 btn-accion-ver" href="#/inventario/items/ver/${p.id}">
                                        <i class="bi bi-eye text-primary"></i> Ver Detalle & Kardex
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 btn-accion-editar" href="#" data-id="${p.id}">
                                        <i class="bi bi-pencil text-secondary"></i> Editar Producto
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item py-2 d-flex align-items-center gap-2" href="#/inventario/ajustes">
                                        <i class="bi bi-sliders text-info"></i> Ajustar Inventario
                                    </a>
                                </li>
                                <li><hr class="dropdown-divider my-1"></li>
                                <li>
                                    ${isInactive ? `
                                        <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-success btn-accion-activar" href="#" data-id="${p.id}">
                                            <i class="bi bi-check-circle"></i> Reactivar Producto
                                        </a>
                                    ` : `
                                        <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-danger btn-accion-desactivar" href="#" data-id="${p.id}">
                                            <i class="bi bi-slash-circle"></i> Desactivar Producto
                                        </a>
                                    `}
                                </li>
                            </ul>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        if (typeof this.bindFilaEvents === 'function') {
            this.bindFilaEvents();
        }
    },

    renderPagination(totalItems, currentPage, itemsPerPage) {
        const pagination = this.element ? this.element.querySelector('#grid-pagination') : null;
        if (!pagination) return;

        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        const from = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
        const to = Math.min(currentPage * itemsPerPage, totalItems);

        pagination.innerHTML = `
            <div class="d-flex align-items-center gap-3 text-muted" style="font-size: 13px;">
                <span>Mostrando <strong class="text-dark tnum">${from}-${to}</strong> de <strong class="text-dark tnum">${totalItems}</strong> productos</span>
                <div class="d-flex align-items-center gap-2 border-start ps-3">
                    <span>Por página:</span>
                    <select class="form-select form-select-sm select-per-page" style="width: 75px; font-size: 13px; border-radius: 6px;">
                        <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10</option>
                        <option value="25" ${itemsPerPage === 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
                    </select>
                </div>
            </div>

            <div class="d-flex align-items-center gap-2" style="font-size: 13px;">
                <span>Página</span>
                <input type="number" class="form-control form-control-sm text-center input-page tnum" value="${currentPage}" min="1" max="${totalPages}" style="width: 50px; font-size: 13px; border-radius: 6px;">
                <span class="text-muted tnum">de ${totalPages}</span>
                <div class="ms-2 d-inline-flex gap-1">
                    <button class="btn btn-sm btn-light border p-1 d-inline-flex align-items-center justify-content-center btn-prev-page" ${currentPage === 1 ? 'disabled' : ''} style="width: 30px; height: 30px; border-radius: 6px;">
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    <button class="btn btn-sm btn-light border p-1 d-inline-flex align-items-center justify-content-center btn-next-page" ${currentPage >= totalPages ? 'disabled' : ''} style="width: 30px; height: 30px; border-radius: 6px;">
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    },

    renderDrawerContent(prod = null) {
        const isEdit = Boolean(prod && prod.id);
        const p = prod || {
            sku: '',
            nombre: '',
            precioVenta: 0,
            costoBase: 0,
            impuesto: 0,
            stockMinimo: 5,
            cantidadInicial: 0
        };

        const precioStr = p.precioVenta ? this.formatDecimal(p.precioVenta) : '0,00';
        const costoStr = p.costoBase ? this.formatDecimal(p.costoBase) : '0,00';
        const cantIniStr = p.cantidadInicial ? this.formatDecimal(p.cantidadInicial) : '0,00';
        const sMinStr = p.stockMinimo ? this.formatDecimal(p.stockMinimo) : '5,00';
        const impStr = p.impuesto ? this.formatDecimal(p.impuesto) : '0,00';

        return `
            <form id="form-producto-drawer">
                <input type="hidden" id="drawer-producto-id" value="${isEdit ? escapeHtml(String(p.id)) : ''}">

                <div class="alert alert-info py-2 px-3 mb-4 d-flex align-items-center gap-2" style="font-size: 12px; border-radius: 8px;">
                    <i class="bi bi-info-circle-fill text-primary"></i>
                    <span>Los cambios se guardan y reflejan inmediatamente en inventarios y cotizaciones.</span>
                </div>

                <!-- SKU & Nombre -->
                <div class="mb-3">
                    <label class="form-label text-muted fw-semibold small mb-1">SKU / Código Referencia *</label>
                    <div class="input-group">
                        <span class="input-group-text bg-light text-muted font-monospace" style="font-size: 12px;">#</span>
                        <input type="text" id="drawer-sku" class="form-control font-monospace" value="${escapeHtml(p.sku || '')}" placeholder="Ej. ACC-1001" required style="border-radius: 0 8px 8px 0; font-size: 13px;">
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label text-muted fw-semibold small mb-1">Nombre / Descripción del Producto *</label>
                    <input type="text" id="drawer-nombre" class="form-control" value="${escapeHtml(p.nombre || '')}" placeholder="Ej. Cargador Rápido 120W" required style="border-radius: 8px; font-size: 13px;">
                </div>

                <!-- Precios & Costos -->
                <div class="row g-3 mb-3">
                    <div class="col-12 col-sm-6">
                        <label class="form-label text-muted fw-semibold small mb-1">Costo Base / Unitario ($) *</label>
                        <input type="text" id="drawer-costo" class="form-control fw-semibold" value="${costoStr}" required style="border-radius: 8px; font-size: 13px;">
                    </div>
                    <div class="col-12 col-sm-6">
                        <label class="form-label text-muted fw-semibold small mb-1">Precio Venta Base ($) *</label>
                        <input type="text" id="drawer-precio" class="form-control fw-bold text-primary" value="${precioStr}" required style="border-radius: 8px; font-size: 13px;">
                    </div>
                </div>

                <!-- Simulador de Margen en Vivo -->
                <div class="card p-3 mb-3 bg-light border-0 rounded-3">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="text-muted small fw-semibold">Margen Estimado de Ganancia:</span>
                        <span class="fw-bold fs-6" id="drawer-preview-margen-pct">0.0%</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-muted small">Utilidad Bruta Unitaria:</span>
                        <span class="fw-semibold text-success tnum" id="drawer-preview-utilidad">$ 0</span>
                    </div>
                </div>

                <!-- Impuestos & Stock Mínimo -->
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6">
                        <label class="form-label text-muted fw-semibold small mb-1">Impuesto / IVA (%)</label>
                        <input type="text" id="drawer-impuesto" class="form-control" value="${impStr}" style="border-radius: 8px; font-size: 13px;">
                    </div>
                    <div class="col-12 col-sm-6">
                        <label class="form-label text-muted fw-semibold small mb-1">Stock Mínimo (Alerta)</label>
                        <input type="text" id="drawer-minimo" class="form-control" value="${sMinStr}" style="border-radius: 8px; font-size: 13px;">
                    </div>
                </div>

                ${!isEdit ? `
                    <!-- Stock Inicial para Nuevo Producto -->
                    <div class="p-3 mb-4 rounded-3 border bg-white">
                        <label class="form-label text-muted fw-semibold small mb-1">Inventario Inicial (Opcional)</label>
                        <input type="text" id="drawer-cantidad-inicial" class="form-control" value="${cantIniStr}" style="border-radius: 8px; font-size: 13px;">
                        <span class="text-muted" style="font-size: 11px;">Crea automáticamente la primera capa FIFO del producto.</span>
                    </div>
                ` : ''}

                <!-- Botones de Acción -->
                <div class="d-flex gap-2 justify-content-end pt-2 border-top">
                    <button type="button" class="btn btn-light border px-4" id="btn-cancelar-drawer" style="border-radius: 8px; font-size: 13px; font-weight: 500;">Cancelar</button>
                    <button type="submit" class="btn btn-primary-action px-4 shadow-xs" id="btn-guardar-drawer" style="border-radius: 8px; font-size: 13px; font-weight: 600;">
                        <i class="bi bi-check2-circle me-1"></i> Guardar Producto
                    </button>
                </div>
            </form>
        `;
    },

    renderAnalyticsView(kpis = {}, topItems = []) {
        const container = this.element ? this.element.querySelector('#productos-analytics-container') : null;
        if (!container) return;

        const optimos = kpis.optimos || 0;
        const bajo = kpis.bajo_stock || 0;
        const agotados = kpis.agotados || 0;
        const total = (optimos + bajo + agotados) || 1;

        const pctOpt = Math.round((optimos / total) * 100);
        const pctBajo = Math.round((bajo / total) * 100);
        const pctAgot = Math.round((agotados / total) * 100);

        container.innerHTML = `
            <div class="row g-4 mb-4">
                <!-- Gráfico de Salud de Stock -->
                <div class="col-12 col-lg-5">
                    <div class="card p-4 shadow-xs border h-100" style="border-radius: 12px; background: #ffffff;">
                        <h6 class="fw-bold mb-3" style="color: var(--text-main);">
                            <i class="bi bi-pie-chart text-primary me-2"></i>Distribución de Salud del Stock
                        </h6>
                        <p class="text-muted small mb-4">Diagnóstico de disponibilidad de las referencias activas en bodega.</p>

                        <div class="d-flex flex-column gap-3">
                            <div>
                                <div class="d-flex justify-content-between align-items-center mb-1" style="font-size: 13px;">
                                    <span class="fw-semibold text-success"><i class="bi bi-check-circle-fill me-1"></i>Con Stock Saludable</span>
                                    <span class="fw-bold tnum">${optimos} (${pctOpt}%)</span>
                                </div>
                                <div class="progress" style="height: 8px; border-radius: 4px;">
                                    <div class="progress-bar bg-success" style="width: ${pctOpt}%;"></div>
                                </div>
                            </div>

                            <div>
                                <div class="d-flex justify-content-between align-items-center mb-1" style="font-size: 13px;">
                                    <span class="fw-semibold text-warning"><i class="bi bi-exclamation-triangle-fill me-1"></i>Bajo Mínimo (Punto Reorden)</span>
                                    <span class="fw-bold tnum">${bajo} (${pctBajo}%)</span>
                                </div>
                                <div class="progress" style="height: 8px; border-radius: 4px;">
                                    <div class="progress-bar bg-warning" style="width: ${pctBajo}%;"></div>
                                </div>
                            </div>

                            <div>
                                <div class="d-flex justify-content-between align-items-center mb-1" style="font-size: 13px;">
                                    <span class="fw-semibold text-danger"><i class="bi bi-x-circle-fill me-1"></i>Agotados (0 unidades)</span>
                                    <span class="fw-bold tnum">${agotados} (${pctAgot}%)</span>
                                </div>
                                <div class="progress" style="height: 8px; border-radius: 4px;">
                                    <div class="progress-bar bg-danger" style="width: ${pctAgot}%;"></div>
                                </div>
                            </div>
                        </div>

                        <div class="alert alert-warning mt-4 mb-0 py-2 px-3 d-flex align-items-center gap-2" style="font-size: 12px; border-radius: 8px;">
                            <i class="bi bi-lightning-charge-fill text-warning"></i>
                            <span>Hay <strong>${bajo + agotados}</strong> productos que requieren reposición inmediata para evitar pérdida de ventas.</span>
                        </div>
                    </div>
                </div>

                <!-- Pareto de Capital Invertido (Top Referencias) -->
                <div class="col-12 col-lg-7">
                    <div class="card p-4 shadow-xs border h-100" style="border-radius: 12px; background: #ffffff;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold mb-0" style="color: var(--text-main);">
                                <i class="bi bi-trophy text-warning me-2"></i>Top Referencias por Capital Inmovilizado
                            </h6>
                            <span class="badge bg-light text-muted border" style="font-size: 11px;">Concentración de Valor</span>
                        </div>
                        <p class="text-muted small mb-3">Las 5 referencias con mayor valor monetario total en bodega.</p>

                        <div class="table-responsive">
                            <table class="table table-borderless align-middle mb-0" style="font-size: 13px;">
                                <thead style="border-bottom: 1px solid var(--border-color);">
                                    <tr>
                                        <th class="py-2 text-muted small fw-semibold">Producto</th>
                                        <th class="py-2 text-end text-muted small fw-semibold">Stock</th>
                                        <th class="py-2 text-end text-muted small fw-semibold">Costo Prom.</th>
                                        <th class="py-2 text-end text-muted small fw-semibold">Capital Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topItems.length > 0 ? topItems.map(item => `
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td class="py-2">
                                                <div class="fw-semibold text-truncate" style="max-width: 260px;" title="${escapeHtml(item.nombre)}">
                                                    ${escapeHtml(item.nombre)}
                                                </div>
                                                <span class="text-muted font-monospace" style="font-size: 10px;">${escapeHtml(item.sku || '')}</span>
                                            </td>
                                            <td class="py-2 text-end tnum">${item.stock} und</td>
                                            <td class="py-2 text-end tnum text-muted">${this.formatMoney(item.costoPromedio)}</td>
                                            <td class="py-2 text-end tnum fw-bold text-primary">${this.formatMoney(item.valorTotalInventario)}</td>
                                        </tr>
                                    `).join('') : `
                                        <tr><td colspan="4" class="text-center py-3 text-muted">No hay datos de inventario suficientes.</td></tr>
                                    `}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};
