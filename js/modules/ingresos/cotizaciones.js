import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions } from '../../shared/crud.js';
import { PrintManager } from '../../shared/printManager.js';
import { ItemEngine } from '../../shared/itemEngine.js';
import { NumberingManager } from '../../shared/numberingManager.js';
import { ContactosModule } from '../clientes/clientes.js';
import { UI } from '../../shared/combobox.js';
import { escapeHtml, getClientAvatar } from '../../shared/formatters.js';

export const CotizacionesModule = {
    async init(element) {
        if (!element) return;

        const [cleanHash, queryString] = window.location.hash.split('?');
        const hashParts = cleanHash.split('/');
        const action = hashParts[3];
        const id = hashParts[4];

        if (action === 'nueva' || action === 'editar') {
            return await this.renderForm(element, id, false);
        } else if (action === 'ver') {
            return await this.renderForm(element, id, true);
        } else {
            return await this.renderList(element);
        }
    },

    async renderList(element) {
        const [cleanHash, queryString] = window.location.hash.split('?');
        const urlParams = new URLSearchParams(queryString || '');
        const initialSearch = urlParams.get('search') || urlParams.get('cliente') || urlParams.get('q') || '';

        let sortColumn = 'numero';
        let sortDirection = 'desc';
        let currentPage = 1;
        let itemsPerPage = 10;
        let searchQuery = initialSearch ? decodeURIComponent(initialSearch) : '';
        let filterCriteria = 'todos';
        let selectedTab = 'todas'; // 'todas', 'pendientes', 'facturadas', 'recientes'
        let view = 'lista'; // 'lista' o 'grafico'
        let currentItems = [];
        let totalItems = 0;
        let kpiDataCotizaciones = null;
        let chartInstanceEvolucion = null;
        let chartInstanceDonut = null;

        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        // 1. INYECTAR SHELL ESTÁTICO
        element.innerHTML = `
            <div class="dash-layout p-4" style="max-width: 1200px; margin: 0 auto;">
                
                <!-- TOP BAR DE ALTO IMPACTO -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <a href="#" onclick="event.preventDefault(); window.history.length > 2 ? window.history.back() : window.location.hash = '#/dashboard';" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body); border-radius: 8px;">
                                <i class="bi bi-arrow-left"></i>
                            </a>
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Cotizaciones</h2>
                            <span class="badge" style="background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #bfdbfe;">
                                <i class="bi bi-file-earmark-text me-1"></i> Ventas & Propuestas
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Crea, gestiona y haz seguimiento comercial a tus ofertas y propuestas para clientes.
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Toggle de Vistas: Lista vs Analítica -->
                        <div class="btn-group p-1 bg-light border rounded-3" role="group">
                            <button type="button" class="btn btn-sm ${view !== 'grafico' ? 'btn-white bg-white shadow-xs fw-bold text-dark' : 'btn-light border-0 text-muted'}" id="btn-view-lista" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-table me-1"></i> Lista
                            </button>
                            <button type="button" class="btn btn-sm ${view === 'grafico' ? 'btn-white bg-white shadow-xs fw-bold text-primary' : 'btn-light border-0 text-muted'}" id="btn-view-grafico" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-bar-chart me-1"></i> Analítica
                            </button>
                        </div>

                        <!-- Botón Exportar Excel -->
                        <button id="btn-export-list" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 600; font-size: 13px; border-radius: 8px;" title="Descargar en Excel">
                            <i class="bi bi-file-earmark-excel text-success me-1"></i> Exportar
                        </button>

                        <!-- Botón Refrescar -->
                        <button id="btn-refresh-list" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>

                        <!-- Botón Nueva Cotización -->
                        <a href="#/ingresos/cotizaciones/nueva" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-plus-lg"></i> Nueva cotización
                        </a>
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Total Cotizado -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Total Cotizado</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-journal-text"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-cotizado" style="font-size: 22px;">$ 0</div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <i class="bi bi-calendar-event me-1"></i> Propuestas del mes actual
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Cotizaciones Facturadas / Aprobadas -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #059669;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Cotizaciones Facturadas</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-check-circle"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" id="kpi-aprobado" style="font-size: 22px;">$ 0</div>
                            <div class="mt-2 d-flex align-items-center gap-2">
                                <span class="payment-kpi-trend positive" id="kpi-tasa-conversion">
                                    <i class="bi bi-arrow-up-right"></i> 0%
                                </span>
                                <span class="text-muted" style="font-size: 11px;">conversión a ventas</span>
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Sin Facturar / Pendientes -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #d97706;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Sin Facturar (Abiertas)</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-hourglass-split"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-warning-emphasis tnum" id="kpi-pendiente" style="font-size: 22px;">$ 0</div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Oportunidades en negociación
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Conteo Total de Cotizaciones -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Volumen Comercial</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-send-check"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-conteo" style="font-size: 22px;">0</div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Total cotizaciones emitidas
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR DE ANALÍTICA GRÁFICA -->
                <div id="cotizaciones-analytics-container" style="display: none;"></div>

                <!-- CONTENEDOR DE TABLA DE DATOS -->
                <div id="cotizaciones-table-view-container" style="display: block;">
                    <div class="dash-table-container mb-4 shadow-xs" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                        
                        <!-- FILTROS Y TABS SUPERIORES -->
                        <div class="p-3 border-bottom bg-white d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                            <!-- Tabs de Filtro Rápido -->
                            <div class="payment-tabs-bar">
                                <button type="button" class="payment-tab-btn active" data-tab="todas">
                                    Todas
                                </button>
                                <button type="button" class="payment-tab-btn tab-warning" data-tab="pendientes">
                                    <i class="bi bi-hourglass-split text-warning"></i> Sin facturar
                                    <span class="payment-tab-badge" id="tab-badge-pendientes" style="display: none;">0</span>
                                </button>
                                <button type="button" class="payment-tab-btn" data-tab="facturadas">
                                    <i class="bi bi-patch-check-fill text-success"></i> Facturadas
                                </button>
                                <button type="button" class="payment-tab-btn" data-tab="recientes">
                                    <i class="bi bi-clock-history"></i> Últimos 30 días
                                </button>
                            </div>

                            <!-- Buscador y Criterio -->
                            <div class="d-flex flex-wrap align-items-center gap-2">
                                <div class="ds-search-container" style="min-width: 220px;">
                                    <i class="bi bi-search ds-search-icon"></i>
                                    <input type="text" class="ds-search-input" id="searchCotizaciones" autocomplete="off" placeholder="Buscar cliente, número..." value="${escapeHtml(searchQuery)}">
                                </div>

                                <div class="dropdown">
                                    <button class="btn btn-light bg-white border dropdown-toggle" data-bs-toggle="dropdown" style="font-size: 13px; height: 38px; border-radius: 8px;">
                                        <i class="bi bi-funnel me-1"></i> <span id="lbl-filtro-actual">Filtro</span>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-end shadow border" style="font-size: 13px; border-radius: 8px;">
                                        <li><a class="dropdown-item filter-opt" href="#" data-criteria="todos">Todos los campos</a></li>
                                        <li><hr class="dropdown-divider my-1"></li>
                                        <li><a class="dropdown-item filter-opt" href="#" data-criteria="numero">Por Número</a></li>
                                        <li><a class="dropdown-item filter-opt" href="#" data-criteria="cliente">Por Cliente</a></li>
                                        <li><a class="dropdown-item filter-opt" href="#" data-criteria="fecha">Por Fecha</a></li>
                                        <li><a class="dropdown-item filter-opt" href="#" data-criteria="monto">Por Monto</a></li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <!-- TABLA DE FILAS INTELIGENTES -->
                        <div class="table-responsive position-relative">
                            <div id="cotizaciones-loading-overlay" class="position-absolute top-0 start-0 w-100 h-100 justify-content-center align-items-center bg-white bg-opacity-75" style="z-index: 10; display: none !important;">
                                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>
                            </div>
                            <table class="table table-borderless align-middle mb-0 w-100">
                                <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                    <tr>
                                        <th class="py-3 ps-4 text-uppercase text-muted fw-bold sortable-header" data-column="numero" style="font-size: 11px; letter-spacing: 0.5px; width: 130px; cursor: pointer; user-select: none;">
                                            Cotización <span id="sort-icon-numero">▼</span>
                                        </th>
                                        <th class="py-3 text-uppercase text-muted fw-bold sortable-header" data-column="cliente" style="font-size: 11px; letter-spacing: 0.5px; cursor: pointer; user-select: none;">
                                            Cliente / Destinatario <span id="sort-icon-cliente"></span>
                                        </th>
                                        <th class="py-3 text-uppercase text-muted fw-bold sortable-header" data-column="fecha" style="font-size: 11px; letter-spacing: 0.5px; width: 140px; cursor: pointer; user-select: none;">
                                            Fechas <span id="sort-icon-fecha"></span>
                                        </th>
                                        <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 130px;">
                                            Total Oferta
                                        </th>
                                        <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 120px;">
                                            Estado
                                        </th>
                                        <th class="py-3 pe-4 text-end text-uppercase text-muted fw-bold" style="width: 100px;">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody id="grid-tbody">
                                    <!-- Filas inyectadas -->
                                </tbody>
                            </table>
                        </div>

                        <!-- PAGINADOR -->
                        <div class="card-footer bg-white border-top p-3 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2" style="border-radius: 0 0 12px 12px;" id="grid-pagination">
                            <!-- Paginación inyectada -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- SLIDE-OVER DRAWER DE COTIZACIÓN -->
            <div class="payment-drawer-backdrop" id="cotizacion-drawer-backdrop"></div>
            <div class="payment-drawer" id="cotizacion-drawer">
                <div class="payment-drawer-header">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-receipt-cutoff text-primary fs-5"></i>
                        <h5 class="fw-bold mb-0" style="color: #0f172a; font-size: 16px;">Detalle de la Cotización</h5>
                    </div>
                    <button type="button" class="btn btn-sm btn-light border-0 text-muted" id="btn-cot-drawer-close" title="Cerrar">
                        <i class="bi bi-x-lg fs-6"></i>
                    </button>
                </div>
                <div class="payment-drawer-body" id="cotizacion-drawer-body">
                    <!-- Contenido dinámico del comprobante -->
                </div>
                <div class="payment-drawer-footer">
                    <button type="button" class="btn btn-light border btn-sm px-3 fw-medium" id="btn-cot-drawer-close-bottom">
                        Cerrar
                    </button>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-light border btn-sm px-3 fw-medium text-secondary" id="btn-cot-drawer-imprimir" title="Imprimir o PDF">
                            <i class="bi bi-printer me-1"></i> Imprimir
                        </button>
                        <button type="button" class="btn btn-outline-primary btn-sm px-3 fw-medium" id="btn-cot-drawer-editar" title="Editar">
                            <i class="bi bi-pencil me-1"></i> Editar
                        </button>
                        <button type="button" class="btn btn-success btn-sm px-3 fw-medium text-white shadow-xs" id="btn-cot-drawer-convertir" title="Convertir a Factura">
                            <i class="bi bi-arrow-right-circle me-1"></i> Facturar
                        </button>
                        <button type="button" class="btn btn-primary btn-sm px-3 fw-medium" id="btn-cot-drawer-ver" title="Ver Pantalla Completa">
                            <i class="bi bi-eye me-1"></i> Ver
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 2. FUNCIÓN DE RENDERIZADO DE TABLA
        const renderGrid = async () => {
            const tbodyEl = element.querySelector('#grid-tbody');
            const pagContainer = element.querySelector('#grid-pagination');
            const overlay = element.querySelector('#cotizaciones-loading-overlay');

            if (overlay) overlay.style.setProperty('display', 'flex', 'important');

            try {
                // A. Cargar KPIs vía RPC si no existen
                if (!kpiDataCotizaciones) {
                    const { data: kpis } = await supabase.rpc('get_cotizaciones_kpis');
                    const { count: totalDocs } = await supabase.from('cotizaciones').select('id', { count: 'exact', head: true });

                    const totalCotizado = parseFloat(kpis?.totalCotizado) || 0;
                    const totalAprobado = parseFloat(kpis?.totalAprobado) || 0;
                    const totalPendiente = parseFloat(kpis?.totalPendiente) || 0;
                    const conversionRate = totalCotizado > 0 ? Math.round((totalAprobado / totalCotizado) * 100) : 0;

                    kpiDataCotizaciones = {
                        totalCotizado,
                        totalAprobado,
                        totalPendiente,
                        totalCount: totalDocs || 0,
                        conversionRate
                    };

                    // Pintar en DOM
                    const kpiCot = element.querySelector('#kpi-cotizado');
                    if (kpiCot) kpiCot.textContent = formatMoney(totalCotizado);
                    const kpiApr = element.querySelector('#kpi-aprobado');
                    if (kpiApr) kpiApr.textContent = formatMoney(totalAprobado);
                    const kpiPen = element.querySelector('#kpi-pendiente');
                    if (kpiPen) kpiPen.textContent = formatMoney(totalPendiente);
                    const kpiCon = element.querySelector('#kpi-conteo');
                    if (kpiCon) kpiCon.textContent = totalDocs || 0;
                    const kpiRate = element.querySelector('#kpi-tasa-conversion');
                    if (kpiRate) kpiRate.innerHTML = `<i class="bi bi-arrow-up-right"></i> ${conversionRate}%`;
                }

                // B. Paginación y Filtros de Datos
                const isTabFiltered = selectedTab !== 'todas' || Boolean(searchQuery);

                let dataToDisplay = [];

                if (!isTabFiltered) {
                    const { data: response, error } = await supabase.rpc('get_cotizaciones_page', {
                        p_page: currentPage,
                        p_limit: itemsPerPage,
                        p_sort_column: sortColumn,
                        p_sort_direction: sortDirection,
                        p_search_query: searchQuery,
                        p_filter_criteria: filterCriteria
                    });
                    if (error) throw error;

                    dataToDisplay = response?.[0]?.data || [];
                    totalItems = parseInt(response?.[0]?.total_count || 0, 10);
                } else {
                    // Consulta lote amplio para filtrado preciso de pestañas
                    const { data: response, error } = await supabase.rpc('get_cotizaciones_page', {
                        p_page: 1,
                        p_limit: 1000,
                        p_sort_column: sortColumn,
                        p_sort_direction: sortDirection,
                        p_search_query: searchQuery,
                        p_filter_criteria: filterCriteria
                    });
                    if (error) throw error;

                    let allRows = response?.[0]?.data || [];

                    // Filtro de Pestañas
                    if (selectedTab === 'pendientes') {
                        allRows = allRows.filter(c => !Boolean(c.convertido_a_factura));
                    } else if (selectedTab === 'facturadas') {
                        allRows = allRows.filter(c => Boolean(c.convertido_a_factura));
                    } else if (selectedTab === 'recientes') {
                        const now = new Date();
                        allRows = allRows.filter(c => {
                            if (!c.fecha) return false;
                            const diffDays = (now - new Date(c.fecha)) / (1000 * 60 * 60 * 24);
                            return diffDays <= 30;
                        });
                    }

                    // Filtro de Búsqueda
                    if (searchQuery) {
                        const q = searchQuery.toLowerCase();
                        allRows = allRows.filter(c => {
                            const numStr = String(c.numero || c.id || '');
                            const cliStr = String(c.cliente_nombre || '').toLowerCase();
                            const fecStr = String(c.fecha || '');
                            const totStr = String(c.total || '');
                            return numStr.includes(q) || cliStr.includes(q) || fecStr.includes(q) || totStr.includes(q);
                        });
                    }

                    totalItems = allRows.length;
                    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
                    if (currentPage > totalPages) currentPage = totalPages;
                    if (currentPage < 1) currentPage = 1;

                    const from = (currentPage - 1) * itemsPerPage;
                    dataToDisplay = allRows.slice(from, from + itemsPerPage);
                }

                currentItems = dataToDisplay;
                const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

                // C. Renderizar Filas de la Tabla
                if (!dataToDisplay || dataToDisplay.length === 0) {
                    tbodyEl.innerHTML = `
                        <tr>
                            <td colspan="6" class="text-center py-5 text-muted">
                                <div class="mb-3"><i class="bi bi-file-earmark-x fs-1 text-secondary opacity-50"></i></div>
                                <h6 class="fw-semibold text-dark">No se encontraron cotizaciones</h6>
                                <p class="text-muted mb-0" style="font-size: 13px;">Prueba cambiando de pestaña o ajustando el criterio de búsqueda.</p>
                            </td>
                        </tr>
                    `;
                } else {
                    tbodyEl.innerHTML = dataToDisplay.map(c => {
                        const isFacturada = Boolean(c.convertido_a_factura);
                        const clienteNombre = c.cliente_nombre || 'Sin Cliente';
                        const avatar = getClientAvatar(clienteNombre);
                        const numDisplay = c.numero || c.id;

                        return `
                            <tr class="payment-row fila-cotizacion" data-id="${c.id}" style="cursor: pointer;">
                                <!-- Columna 1: Número & Código -->
                                <td class="py-3 ps-4">
                                    <div class="payment-code-badge fw-bold" style="font-size: 11px;">
                                        # COT-${numDisplay}
                                    </div>
                                </td>

                                <!-- Columna 2: Cliente con Avatar -->
                                <td class="py-3">
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 34px; height: 34px; font-size: 12px; flex-shrink: 0;">
                                            ${avatar.initials}
                                        </div>
                                        <div class="text-truncate" style="max-width: 250px;">
                                            <div class="fw-bold text-dark text-truncate" style="font-size: 13px;" title="${escapeHtml(clienteNombre)}">
                                                ${escapeHtml(clienteNombre)}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <!-- Columna 3: Fechas -->
                                <td class="py-3">
                                    <div class="fw-semibold text-dark tnum" style="font-size: 13px;">
                                        <i class="bi bi-calendar3 me-1 text-secondary"></i> ${c.fecha || '---'}
                                    </div>
                                    ${c.vencimiento ? `
                                        <div class="text-muted tnum" style="font-size: 11px; margin-top: 2px;">
                                            <i class="bi bi-clock me-1"></i> Vence: ${c.vencimiento}
                                        </div>
                                    ` : ''}
                                </td>

                                <!-- Columna 4: Monto Total -->
                                <td class="py-3 text-end">
                                    <div class="fw-bold text-dark tnum" style="font-size: 14px;">
                                        ${formatMoney(c.total)}
                                    </div>
                                </td>

                                <!-- Columna 5: Estado -->
                                <td class="py-3 text-center">
                                    ${isFacturada ? `
                                        <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-semibold px-2 py-1" style="font-size: 11px;">
                                            <i class="bi bi-patch-check-fill me-1"></i> Facturada
                                        </span>
                                    ` : `
                                        <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill fw-semibold px-2 py-1" style="font-size: 11px;">
                                            <i class="bi bi-hourglass-split me-1"></i> Sin facturar
                                        </span>
                                    `}
                                </td>

                                <!-- Columna 6: Acciones Rápidas -->
                                <td class="py-3 pe-4 text-end">
                                    <div class="payment-row-actions">
                                        <button class="btn btn-sm btn-light border-0 p-1 btn-quick-view-cot" data-id="${c.id}" title="Ver Detalle">
                                            <i class="bi bi-eye text-primary"></i>
                                        </button>
                                        <button class="btn btn-sm btn-light border-0 p-1 btn-imprimir-row" data-id="${c.id}" title="Imprimir">
                                            <i class="bi bi-printer text-secondary"></i>
                                        </button>
                                        <div class="dropdown d-inline-block">
                                            <button class="btn btn-sm btn-link text-muted p-1 border-0" data-bs-toggle="dropdown">
                                                <i class="bi bi-three-dots-vertical"></i>
                                            </button>
                                            <ul class="dropdown-menu dropdown-menu-end shadow border" style="font-size: 13px; border-radius: 8px;">
                                                <li>
                                                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 btn-menu-ver-cot" href="javascript:void(0)" data-id="${c.id}">
                                                        <i class="bi bi-layout-sidebar-inset-reverse text-primary"></i> Ver detalle
                                                    </a>
                                                </li>
                                                <li>
                                                    <a class="dropdown-item py-2 d-flex align-items-center gap-2" href="#/ingresos/cotizaciones/editar/${c.id}">
                                                        <i class="bi bi-pencil text-secondary"></i> Editar
                                                    </a>
                                                </li>
                                                ${!isFacturada ? `
                                                    <li>
                                                        <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-success btn-menu-convertir-cot" href="javascript:void(0)" data-id="${c.id}">
                                                            <i class="bi bi-arrow-right-circle"></i> Convertir a Factura
                                                        </a>
                                                    </li>
                                                ` : ''}
                                                <li><hr class="dropdown-divider my-1"></li>
                                                <li>
                                                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-danger btn-menu-eliminar-cot" href="javascript:void(0)" data-id="${c.id}">
                                                        <i class="bi bi-trash"></i> Eliminar
                                                    </a>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }

                // D. Paginador
                const fromItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
                const toItem = Math.min(currentPage * itemsPerPage, totalItems);

                if (pagContainer) {
                    pagContainer.innerHTML = `
                        <div class="d-flex align-items-center gap-3" style="font-size: 13px; color: var(--text-body);">
                            <div class="d-flex align-items-center gap-2">
                                <span>Mostrar:</span>
                                <select class="form-select form-select-sm text-muted select-per-page" style="width: 70px;">
                                    <option value="10" ${itemsPerPage===10?'selected':''}>10</option>
                                    <option value="20" ${itemsPerPage===20?'selected':''}>20</option>
                                    <option value="50" ${itemsPerPage===50?'selected':''}>50</option>
                                </select>
                            </div>
                            <span class="text-muted border-start ps-3">
                                ${totalItems > 0 ? `<strong>${fromItem} - ${toItem}</strong> de <strong>${totalItems}</strong> cotizaciones` : '0 cotizaciones'}
                            </span>
                        </div>

                        <div class="d-flex align-items-center gap-2" style="font-size: 13px;">
                            <button class="btn btn-sm btn-light border btn-prev-page" ${currentPage <= 1 ? 'disabled' : ''}>
                                <i class="bi bi-chevron-left me-1"></i> Anterior
                            </button>
                            <span class="px-2 text-muted">
                                Página <strong>${currentPage}</strong> de <strong>${totalPages}</strong>
                            </span>
                            <button class="btn btn-sm btn-light border btn-next-page" ${currentPage >= totalPages ? 'disabled' : ''}>
                                Siguiente <i class="bi bi-chevron-right ms-1"></i>
                            </button>
                        </div>
                    `;

                    pagContainer.querySelector('.select-per-page')?.addEventListener('change', (e) => {
                        itemsPerPage = parseInt(e.target.value, 10);
                        currentPage = 1;
                        renderGrid();
                    });
                    pagContainer.querySelector('.btn-prev-page')?.addEventListener('click', () => {
                        if (currentPage > 1) { currentPage--; renderGrid(); }
                    });
                    pagContainer.querySelector('.btn-next-page')?.addEventListener('click', () => {
                        if (currentPage < totalPages) { currentPage++; renderGrid(); }
                    });
                }

                // E. Eventos en Filas
                tbodyEl.querySelectorAll('.fila-cotizacion').forEach(tr => {
                    tr.addEventListener('click', (e) => {
                        if (e.target.closest('.dropdown') || e.target.closest('button') || e.target.closest('a')) return;
                        mostrarDrawer(tr.dataset.id);
                    });
                });

                tbodyEl.querySelectorAll('.btn-quick-view-cot, .btn-menu-ver-cot').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        mostrarDrawer(btn.dataset.id);
                    });
                });

                tbodyEl.querySelectorAll('.btn-imprimir-row').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const id = btn.dataset.id;
                        const doc = await DB.get('cotizaciones', id);
                        if (doc) {
                            const pIds = (doc.detalles || []).map(d => parseInt(d.productoId, 10)).filter(p => !isNaN(p) && p > 0);
                            const [clienteRes, prodsRes] = await Promise.all([
                                doc.clienteId ? supabase.from('contactos').select('*').eq('id', parseInt(doc.clienteId, 10)).single() : Promise.resolve({ data: null }),
                                pIds.length > 0 ? supabase.from('productos').select('*').in('id', pIds) : Promise.resolve({ data: [] })
                            ]);
                            const contactos = clienteRes.data ? [DB._mapToFrontend('contactos', clienteRes.data)] : [];
                            const productos = (prodsRes.data || []).map(p => DB._mapToFrontend('productos', p));
                            PrintManager.printDocument(doc, 'Cotización', contactos, productos);
                        }
                    });
                });

                tbodyEl.querySelectorAll('.btn-menu-convertir-cot').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const id = btn.dataset.id;
                        await CoreActions.convertirCotizacionAFactura(id, () => {
                            kpiDataCotizaciones = null;
                            renderGrid();
                        });
                    });
                });

                tbodyEl.querySelectorAll('.btn-menu-eliminar-cot').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const id = btn.dataset.id;
                        if (confirm('¿Estás seguro de eliminar esta cotización de forma permanente?')) {
                            await DB.delete('cotizaciones', id);
                            kpiDataCotizaciones = null;
                            renderGrid();
                        }
                    });
                });

            } catch (err) {
                console.error("Error renderizando lista de cotizaciones:", err);
                if (tbodyEl) tbodyEl.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-danger">Error al cargar cotizaciones: ${err.message}</td></tr>`;
            } finally {
                if (overlay) overlay.style.setProperty('display', 'none', 'important');
            }
        };

        // 3. SLIDE-OVER DRAWER
        const mostrarDrawer = async (id) => {
            const backdrop = element.querySelector('#cotizacion-drawer-backdrop');
            const drawer = element.querySelector('#cotizacion-drawer');
            const body = element.querySelector('#cotizacion-drawer-body');
            if (!drawer || !body) return;

            if (backdrop) backdrop.classList.add('show');
            drawer.classList.add('show');
            body.innerHTML = `
                <div class="d-flex justify-content-center align-items-center py-5">
                    <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>
                </div>
            `;

            try {
                const { data: cot, error } = await supabase
                    .from('cotizaciones')
                    .select('*, contactos(nombre, identificacion, telefono, email), cotizacion_detalles(*, productos(nombre))')
                    .eq('id', id)
                    .single();

                if (error || !cot) throw error || new Error('Cotización no encontrada');

                const clienteNombre = cot.contactos?.nombre || 'Sin Cliente';
                const avatar = getClientAvatar(clienteNombre);
                const isFacturada = Boolean(cot.estado === 'billed' || cot.facturaDestinoId);

                body.innerHTML = `
                    <!-- Header del Comprobante -->
                    <div class="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
                        <div class="d-flex align-items-center gap-3">
                            <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 44px; height: 44px; font-size: 15px;">
                                ${avatar.initials}
                            </div>
                            <div>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="payment-code-badge" style="border-color: #93c5fd; color: #1d4ed8;">
                                        COT #${cot.numero || cot.id}
                                    </span>
                                    <span class="badge ${isFacturada ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis'} border rounded-pill">
                                        ${isFacturada ? 'Facturada' : 'Sin facturar'}
                                    </span>
                                </div>
                                <h4 class="fw-bold mb-0 mt-1" style="font-size: 17px; color: #0f172a;">${escapeHtml(clienteNombre)}</h4>
                                ${cot.contactos?.identificacion ? `<span class="text-muted" style="font-size: 12px;">NIT / CC: ${escapeHtml(cot.contactos.identificacion)}</span>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Banner de Monto -->
                    <div class="p-3 rounded-3 mb-4 d-flex justify-content-between align-items-center" style="background: linear-gradient(135deg, #eff6ff, #f8fafc); border: 1px solid #bfdbfe;">
                        <div>
                            <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Monto Total Ofertado</span>
                            <h2 class="fw-bold text-primary mb-0 tnum" style="letter-spacing: -0.5px;">
                                ${formatMoney(cot.total)}
                            </h2>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-white text-dark border px-3 py-2 rounded-3 shadow-xs" style="font-size: 12px;">
                                <i class="bi bi-calendar3 me-1 text-primary"></i> ${cot.fecha || 'Sin fecha'}
                            </span>
                            ${cot.vencimiento ? `<div class="text-muted mt-1" style="font-size: 11px;">Válida hasta: <strong>${cot.vencimiento}</strong></div>` : ''}
                        </div>
                    </div>

                    <!-- Trazabilidad Comercial -->
                    <div class="mb-4">
                        <h6 class="fw-bold text-uppercase text-muted mb-3" style="font-size: 11px; letter-spacing: 0.5px;">
                            <i class="bi bi-signpost-split me-1 text-primary"></i> Trazabilidad Comercial
                        </h6>
                        <div class="ps-2">
                            <div class="payment-timeline-item">
                                <div class="payment-timeline-dot success">
                                    <i class="bi bi-file-earmark-text" style="font-size: 9px; color: #059669;"></i>
                                </div>
                                <div class="fw-semibold text-dark" style="font-size: 13px;">Oferta Comercial Emitida</div>
                                <div class="text-muted" style="font-size: 12px;">Fecha de emisión: <strong>${cot.fecha || '---'}</strong></div>
                            </div>
                            <div class="payment-timeline-item">
                                <div class="payment-timeline-dot ${isFacturada ? 'success' : 'warning'}">
                                    <i class="bi bi-${isFacturada ? 'check-circle-fill' : 'hourglass-split'}" style="font-size: 9px; color: ${isFacturada ? '#059669' : '#d97706'};"></i>
                                </div>
                                <div class="fw-semibold text-dark" style="font-size: 13px;">Conversión a Factura de Venta</div>
                                <div class="text-muted" style="font-size: 12px;">
                                    ${isFacturada 
                                        ? `<span class="text-success"><i class="bi bi-check-circle me-1"></i> Aprobada y convertida en factura de venta activa.</span>` 
                                        : `<span class="text-warning-emphasis"><i class="bi bi-clock me-1"></i> Cotización abierta pendiente de cierre/aprobación.</span>`}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tabla de Ítems / Productos -->
                    <div class="mb-4">
                        <h6 class="fw-bold text-uppercase text-muted mb-2" style="font-size: 11px; letter-spacing: 0.5px;">
                            <i class="bi bi-box-seam me-1 text-primary"></i> Ítems Ofertados (${(cot.cotizacion_detalles || []).length})
                        </h6>
                        <div class="table-responsive border rounded-3 bg-white">
                            <table class="table table-sm align-middle mb-0" style="font-size: 12px;">
                                <thead class="bg-light text-muted">
                                    <tr>
                                        <th class="ps-3 py-2">Producto / Concepto</th>
                                        <th class="text-center py-2">Cant</th>
                                        <th class="text-end py-2">Precio</th>
                                        <th class="text-end pe-3 py-2">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(cot.cotizacion_detalles || []).map(d => {
                                        const prodNom = d.productos?.nombre || d.descripcion_personalizada || 'Producto';
                                        return `
                                            <tr>
                                                <td class="ps-3 py-2 fw-medium text-dark">${escapeHtml(prodNom)}</td>
                                                <td class="text-center py-2 tnum">${d.cantidad}</td>
                                                <td class="text-end py-2 tnum">${formatMoney(d.precio_unitario)}</td>
                                                <td class="text-end pe-3 py-2 tnum fw-semibold text-dark">${formatMoney(d.subtotal)}</td>
                                            </tr>
                                        `;
                                    }).join('') || '<tr><td colspan="4" class="text-center text-muted py-3">Sin ítems</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    ${cot.observaciones || cot.notas ? `
                        <div class="mb-3">
                            <h6 class="fw-bold text-uppercase text-muted mb-1" style="font-size: 11px;">Notas y Condiciones</h6>
                            <div class="p-3 bg-light rounded-3 text-secondary" style="font-size: 12px; line-height: 1.5;">
                                ${escapeHtml(cot.observaciones || cot.notas)}
                            </div>
                        </div>
                    ` : ''}
                `;

                // Acciones de los botones del drawer
                const btnDrawerImprimir = element.querySelector('#btn-cot-drawer-imprimir');
                if (btnDrawerImprimir) {
                    btnDrawerImprimir.onclick = async () => {
                        const doc = await DB.get('cotizaciones', id);
                        if (!doc) return;
                        const pIds = (doc.detalles || []).map(d => parseInt(d.productoId, 10)).filter(p => !isNaN(p) && p > 0);
                        const [clienteRes, prodsRes] = await Promise.all([
                            doc.clienteId ? supabase.from('contactos').select('*').eq('id', parseInt(doc.clienteId, 10)).single() : Promise.resolve({ data: null }),
                            pIds.length > 0 ? supabase.from('productos').select('*').in('id', pIds) : Promise.resolve({ data: [] })
                        ]);
                        const contactos = clienteRes.data ? [DB._mapToFrontend('contactos', clienteRes.data)] : [];
                        const productos = (prodsRes.data || []).map(p => DB._mapToFrontend('productos', p));
                        PrintManager.printDocument(doc, 'Cotización', contactos, productos);
                    };
                }

                const btnDrawerEditar = element.querySelector('#btn-cot-drawer-editar');
                if (btnDrawerEditar) {
                    btnDrawerEditar.onclick = () => {
                        cerrarDrawer();
                        window.location.hash = `#/ingresos/cotizaciones/editar/${id}`;
                    };
                }

                const btnDrawerVer = element.querySelector('#btn-cot-drawer-ver');
                if (btnDrawerVer) {
                    btnDrawerVer.onclick = () => {
                        cerrarDrawer();
                        window.location.hash = `#/ingresos/cotizaciones/ver/${id}`;
                    };
                }

                const btnDrawerConvertir = element.querySelector('#btn-cot-drawer-convertir');
                if (btnDrawerConvertir) {
                    if (isFacturada) {
                        btnDrawerConvertir.style.display = 'none';
                    } else {
                        btnDrawerConvertir.style.display = 'inline-block';
                        btnDrawerConvertir.onclick = async () => {
                            cerrarDrawer();
                            await CoreActions.convertirCotizacionAFactura(id, () => {
                                kpiDataCotizaciones = null;
                                renderGrid();
                            });
                        };
                    }
                }
            } catch (err) {
                console.error("Error al cargar cotización en drawer:", err);
                body.innerHTML = `<div class="p-4 text-center text-danger">Error al cargar datos del comprobante.</div>`;
            }
        };

        const cerrarDrawer = () => {
            const backdrop = element.querySelector('#cotizacion-drawer-backdrop');
            const drawer = element.querySelector('#cotizacion-drawer');
            if (backdrop) backdrop.classList.remove('show');
            if (drawer) drawer.classList.remove('show');
        };

        // 4. ANALÍTICA GRÁFICA INTERACTIVA
        const renderAnalyticsView = async () => {
            const container = element.querySelector('#cotizaciones-analytics-container');
            if (!container) return;

            container.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="text-muted mt-2" style="font-size: 13px;">Generando analítica de cotizaciones...</p>
                </div>
            `;

            try {
                const now = new Date();
                const past60 = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

                const { data: cotizacionesData } = await supabase
                    .from('cotizaciones')
                    .select('id, numero, fecha, total, estado, contacto_id, contactos(nombre)')
                    .gte('fecha', past60)
                    .order('fecha', { ascending: true });

                const dailyMap = {};
                const clientMap = {};
                let facturadasCount = 0;
                let pendientesCount = 0;

                (cotizacionesData || []).forEach(c => {
                    const f = c.fecha || 'Sin fecha';
                    const val = Number(c.total) || 0;
                    const cliente = c.contactos?.nombre || 'General / Varios';

                    dailyMap[f] = (dailyMap[f] || 0) + val;
                    clientMap[cliente] = (clientMap[cliente] || 0) + val;

                    if (c.estado === 'billed') {
                        facturadasCount++;
                    } else {
                        pendientesCount++;
                    }
                });

                const topClients = Object.entries(clientMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([nombre, total]) => ({ nombre, total }));

                container.innerHTML = `
                    <div class="row g-3 mb-4">
                        <!-- Evolución de Cotizaciones -->
                        <div class="col-12 col-lg-8">
                            <div class="payment-kpi-card h-100 p-4">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <div>
                                        <h6 class="fw-bold mb-0 text-dark">Evolución de Ofertas Comerciales (Últimos 60 días)</h6>
                                        <span class="text-muted" style="font-size: 12px;">Volumen cotizado en el tiempo</span>
                                    </div>
                                    <span class="badge bg-light text-primary border px-2 py-1" style="font-size: 11px;">
                                        <i class="bi bi-graph-up me-1"></i> Comercial
                                    </span>
                                </div>
                                <div style="height: 260px; position: relative;">
                                    <canvas id="cotizacionesDailyChart"></canvas>
                                </div>
                            </div>
                        </div>

                        <!-- Distribución de Efectividad / Conversión -->
                        <div class="col-12 col-lg-4">
                            <div class="payment-kpi-card h-100 p-4">
                                <div class="mb-3">
                                    <h6 class="fw-bold mb-0 text-dark">Tasa de Conversión</h6>
                                    <span class="text-muted" style="font-size: 12px;">Facturadas vs Pendientes</span>
                                </div>
                                <div style="height: 180px; position: relative;" class="d-flex justify-content-center">
                                    <canvas id="cotizacionesConversionChart"></canvas>
                                </div>
                                <div class="mt-3 border-top pt-2" style="font-size: 12px;">
                                    <div class="d-flex justify-content-between align-items-center py-1">
                                        <span class="text-muted"><i class="bi bi-circle-fill text-success me-1" style="font-size: 9px;"></i> Facturadas</span>
                                        <span class="fw-bold text-success">${facturadasCount}</span>
                                    </div>
                                    <div class="d-flex justify-content-between align-items-center py-1">
                                        <span class="text-muted"><i class="bi bi-circle-fill text-warning me-1" style="font-size: 9px;"></i> Sin facturar</span>
                                        <span class="fw-bold text-warning-emphasis">${pendientesCount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Top 5 Clientes en Cotizaciones -->
                        <div class="col-12">
                            <div class="payment-kpi-card p-4">
                                <h6 class="fw-bold mb-1 text-dark">Top 5 Clientes con Mayor Volumen Cotizado</h6>
                                <span class="text-muted d-block mb-3" style="font-size: 12px;">Principales oportunidades registradas</span>
                                <div class="row g-2">
                                    ${topClients.length > 0 ? topClients.map((c, i) => `
                                        <div class="col-12 col-sm-6 col-md-4 col-lg">
                                            <div class="p-3 bg-light rounded-3 border d-flex flex-column justify-content-between h-100">
                                                <div class="d-flex align-items-center gap-2 mb-2">
                                                    <span class="badge bg-primary text-white rounded-circle" style="width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px;">${i + 1}</span>
                                                    <span class="fw-bold text-dark text-truncate" style="font-size: 12px;" title="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</span>
                                                </div>
                                                <div class="fw-bold text-primary tnum" style="font-size: 14px;">${formatMoney(c.total)}</div>
                                            </div>
                                        </div>
                                    `).join('') : '<p class="text-muted p-2">Sin datos recientes.</p>'}
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const initCharts = () => {
                    if (typeof Chart === 'undefined') return;

                    const ctxDaily = document.getElementById('cotizacionesDailyChart');
                    if (ctxDaily) {
                        if (chartInstanceEvolucion) chartInstanceEvolucion.destroy();
                        chartInstanceEvolucion = new Chart(ctxDaily, {
                            type: 'bar',
                            data: {
                                labels: Object.keys(dailyMap).map(l => l.substring(5)),
                                datasets: [{
                                    label: 'Cotizado ($)',
                                    data: Object.values(dailyMap),
                                    backgroundColor: '#3b82f6',
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

                    const ctxDonut = document.getElementById('cotizacionesConversionChart');
                    if (ctxDonut) {
                        if (chartInstanceDonut) chartInstanceDonut.destroy();
                        chartInstanceDonut = new Chart(ctxDonut, {
                            type: 'doughnut',
                            data: {
                                labels: ['Facturadas', 'Sin facturar'],
                                datasets: [{
                                    data: [facturadasCount, pendientesCount],
                                    backgroundColor: ['#10b981', '#f59e0b']
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                cutout: '65%'
                            }
                        });
                    }
                };

                if (typeof Chart === 'undefined') {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
                    script.onload = initCharts;
                    document.head.appendChild(script);
                } else {
                    setTimeout(initCharts, 50);
                }

            } catch (err) {
                console.error("Error generando analítica de cotizaciones:", err);
                container.innerHTML = `<div class="p-4 text-center text-danger">Error al generar analítica.</div>`;
            }
        };

        // 5. EXPORTACIÓN A EXCEL (.XLSX)
        const exportarExcel = async () => {
            const btn = element.querySelector('#btn-export-list');
            const originalHtml = btn ? btn.innerHTML : '';
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Exportando...`;
            }

            try {
                const { data: response, error } = await supabase.rpc('get_cotizaciones_page', {
                    p_page: 1,
                    p_limit: 10000,
                    p_sort_column: sortColumn,
                    p_sort_direction: sortDirection,
                    p_search_query: searchQuery,
                    p_filter_criteria: filterCriteria
                });
                if (error) throw error;

                let allRows = response?.[0]?.data || [];

                // Aplicar filtros activos
                if (selectedTab === 'pendientes') {
                    allRows = allRows.filter(c => !Boolean(c.convertido_a_factura));
                } else if (selectedTab === 'facturadas') {
                    allRows = allRows.filter(c => Boolean(c.convertido_a_factura));
                } else if (selectedTab === 'recientes') {
                    const now = new Date();
                    allRows = allRows.filter(c => (now - new Date(c.fecha)) / (1000 * 60 * 60 * 24) <= 30);
                }

                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    allRows = allRows.filter(c => {
                        const numStr = String(c.numero || c.id || '');
                        const cliStr = String(c.cliente_nombre || '').toLowerCase();
                        return numStr.includes(q) || cliStr.includes(q);
                    });
                }

                if (allRows.length === 0) {
                    alert('No hay cotizaciones para exportar con los filtros seleccionados.');
                    return;
                }

                const dataToExport = allRows.map(c => ({
                    'Número': c.numero || c.id,
                    'Cliente': c.cliente_nombre || 'Sin Cliente',
                    'Fecha de Creación': c.fecha || '',
                    'Fecha de Vencimiento': c.vencimiento || '',
                    'Total ($)': Number(c.total) || 0,
                    'Estado': c.convertido_a_factura ? 'Facturada' : 'Sin facturar'
                }));

                const dateStr = new Date().toISOString().split('T')[0];

                if (window.XLSX) {
                    const ws = window.XLSX.utils.json_to_sheet(dataToExport);
                    const wb = window.XLSX.utils.book_new();
                    window.XLSX.utils.book_append_sheet(wb, ws, 'Cotizaciones');
                    window.XLSX.writeFile(wb, `Cotizaciones_${dateStr}.xlsx`);
                } else {
                    const headers = Object.keys(dataToExport[0]);
                    let csv = headers.join(';') + '\r\n';
                    dataToExport.forEach(row => {
                        csv += headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(';') + '\r\n';
                    });
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Cotizaciones_${dateStr}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            } catch (err) {
                console.error("Error exportando cotizaciones:", err);
                alert("Error al exportar: " + err.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            }
        };

        // 6. ENLACE DE EVENTOS ESTÁTICOS
        const bindStaticEvents = () => {
            // Buscador con debounce
            const searchInput = element.querySelector('#searchCotizaciones');
            if (searchInput) {
                let debounceTimer;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        searchQuery = e.target.value.trim();
                        currentPage = 1;
                        renderGrid();
                    }, 350);
                });
            }

            // Pestañas Segmentadas
            element.querySelectorAll('.payment-tab-btn').forEach(tabBtn => {
                tabBtn.addEventListener('click', () => {
                    element.querySelectorAll('.payment-tab-btn').forEach(b => b.classList.remove('active'));
                    tabBtn.classList.add('active');
                    selectedTab = tabBtn.dataset.tab || 'todas';
                    currentPage = 1;
                    renderGrid();
                });
            });

            // Criterio de Búsqueda
            element.querySelectorAll('.filter-opt').forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.preventDefault();
                    filterCriteria = e.target.dataset.criteria;
                    const lbl = element.querySelector('#lbl-filtro-actual');
                    if (lbl) lbl.textContent = filterCriteria !== 'todos' ? e.target.textContent : 'Filtro';
                    currentPage = 1;
                    renderGrid();
                });
            });

            // Ordenamiento por Columnas
            element.querySelectorAll('.sortable-header').forEach(header => {
                header.addEventListener('click', (e) => {
                    const col = e.currentTarget.dataset.column;
                    if (sortColumn === col) {
                        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortColumn = col;
                        sortDirection = 'desc';
                    }
                    // Actualizar flechas
                    ['numero', 'cliente', 'fecha'].forEach(c => {
                        const icon = element.querySelector(`#sort-icon-${c}`);
                        if (icon) icon.textContent = sortColumn === c ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : '';
                    });
                    renderGrid();
                });
            });

            // Toggle Vista Lista vs Analítica
            const btnViewLista = element.querySelector('#btn-view-lista');
            const btnViewGrafico = element.querySelector('#btn-view-grafico');
            const containerTable = element.querySelector('#cotizaciones-table-view-container');
            const containerAnalytics = element.querySelector('#cotizaciones-analytics-container');

            if (btnViewLista && btnViewGrafico) {
                btnViewLista.addEventListener('click', () => {
                    view = 'lista';
                    btnViewLista.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold text-dark';
                    btnViewGrafico.className = 'btn btn-sm btn-light border-0 text-muted';
                    if (containerAnalytics) containerAnalytics.style.display = 'none';
                    if (containerTable) containerTable.style.display = 'block';
                    renderGrid();
                });

                btnViewGrafico.addEventListener('click', () => {
                    view = 'grafico';
                    btnViewGrafico.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold text-primary';
                    btnViewLista.className = 'btn btn-sm btn-light border-0 text-muted';
                    if (containerTable) containerTable.style.display = 'none';
                    if (containerAnalytics) {
                        containerAnalytics.style.display = 'block';
                        renderAnalyticsView();
                    }
                });
            }

            // Botón Refrescar
            element.querySelector('#btn-refresh-list')?.addEventListener('click', async (e) => {
                const icon = e.currentTarget.querySelector('i');
                if (icon) icon.classList.add('spinner-border', 'spinner-border-sm');
                kpiDataCotizaciones = null;
                if (view === 'grafico') {
                    await renderAnalyticsView();
                } else {
                    await renderGrid();
                }
                if (icon) icon.classList.remove('spinner-border', 'spinner-border-sm');
            });

            // Botón Exportar
            element.querySelector('#btn-export-list')?.addEventListener('click', exportarExcel);

            // Drawer Cierres
            const btnCloseDrawer = element.querySelector('#btn-cot-drawer-close');
            const btnCloseDrawerB = element.querySelector('#btn-cot-drawer-close-bottom');
            const backdropDrawer = element.querySelector('#cotizacion-drawer-backdrop');
            if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', cerrarDrawer);
            if (btnCloseDrawerB) btnCloseDrawerB.addEventListener('click', cerrarDrawer);
            if (backdropDrawer) backdropDrawer.addEventListener('click', cerrarDrawer);
        };

        // Flujo inicial de montaje
        bindStaticEvents();
        await renderGrid();

        return () => {
            if (chartInstanceEvolucion) {
                try { chartInstanceEvolucion.destroy(); } catch (e) {}
                chartInstanceEvolucion = null;
            }
            if (chartInstanceDonut) {
                try { chartInstanceDonut.destroy(); } catch (e) {}
                chartInstanceDonut = null;
            }
        };
    },
    async renderForm(element, id = null, isViewOnly = false) {
        // Carga de DB
        // Forzar refresh de contactos en modo edición para incluir contactos recién creados
        const contactos = (!id || !isViewOnly)
            ? await DB.refreshCache('contactos')
            : await DB.getAll('contactos');
        
        // Estado por defecto
        let cotizacion = {
            id: 'cot_' + Date.now(),
            numero: undefined,
            fecha: getLocalDate(),
            vencimiento: '',
            clienteId: '',
            detalles: [{ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 }],
            notas: '',
            terminosCondiciones: 'Los valores descritos en esta cotización tienen una validez de 15 días.',
            convertidoAFactura: false,
            total: 0
        };

        if (id) {
            const dbData = await DB.get('cotizaciones', id);
            if (dbData) cotizacion = dbData;
            if (!cotizacion.detalles || cotizacion.detalles.length === 0) {
                cotizacion.detalles = [{ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 }];
            }
            
            // Buscar si esta cotización ya fue convertida a factura dinámicamente
            try {
                const idNum = parseInt(id, 10);
                if (!isNaN(idNum)) {
                    const { data: facturasAsociadas, error: facErr } = await supabase
                        .from('facturas')
                        .select('id, numero, cotizacion_origen_id')
                        .eq('cotizacion_origen_id', idNum)
                        .limit(1);
                        
                    if (facturasAsociadas && facturasAsociadas.length > 0) {
                        cotizacion.convertidoAFactura = true;
                        cotizacion.facturaDestinoId = facturasAsociadas[0].id;
                        cotizacion.facturaDestinoNumero = facturasAsociadas[0].numero;
                    }
                }
            } catch (e) {
                console.error("Error al buscar factura asociada:", e);
            }
        } else {
            const [, queryString] = window.location.hash.split('?');
            const urlParams = new URLSearchParams(queryString || '');
            const rawClienteId = urlParams.get('clienteId');
            if (rawClienteId && /^\d+$/.test(rawClienteId)) {
                cotizacion.clienteId = String(rawClienteId);
            }
        }

        // Cargar solo los productos de los detalles (evita descargar el catálogo completo)
        let productos = [];
        if (id && cotizacion.detalles && cotizacion.detalles.length > 0) {
            const pIds = cotizacion.detalles
                .map(d => parseInt(d.productoId, 10))
                .filter(pId => !isNaN(pId) && pId > 0);
            if (pIds.length > 0) {
                const { data: pData } = await supabase.from('productos').select('*').in('id', pIds);
                if (pData) productos = pData.map(p => DB._mapToFrontend('productos', p));
            }
        }

        const headerHtml = CoreActions.renderDocumentHeader('ingresos/cotizaciones', 'Volver a Cotizaciones');
        const actionsHtml = CoreActions.renderActionButtons(cotizacion, 'cotizacion', isViewOnly, !id);

        // Add legacy fallback for contacts not yet synced to IndexedDB
        const clientes = contactos.filter(c => 
            (c.es_cliente !== undefined ? c.es_cliente : c.tipo !== 'proveedor') 
            && c.estado !== 'inactive'
        );
        const clienteActual = clientes.find(c => String(c.id) === String(cotizacion.clienteId));
        const clienteNombreActual = clienteActual ? clienteActual.nombre : '';

        const isFacturada = cotizacion.convertidoAFactura;
        const badgeClass = isFacturada ? 'bg-success text-success bg-opacity-10 border border-success-subtle' : 'bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle';
        const labelEstado = isFacturada ? 'Facturada' : 'Sin facturar';

        element.innerHTML = `
            <div class="dash-layout p-3 p-md-4" style="max-width: 1350px; margin: 0 auto;">
                
                <!-- TOP BAR DE ALTO IMPACTO (ESTILO GASTOS OPERATIVOS) -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-2 border-bottom">
                    <div>
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <button type="button" class="btn btn-sm btn-light bg-white border text-secondary shadow-xs d-flex align-items-center gap-1 btn-volver-atras" style="border-radius: 8px; font-weight: 500;">
                                <i class="bi bi-arrow-left"></i> Volver
                            </button>
                            <span class="badge" style="background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #bfdbfe;">
                                <i class="bi bi-file-earmark-text me-1"></i> Ventas & Propuestas
                            </span>
                            ${id ? `<span class="badge ${badgeClass} rounded-pill fw-medium" style="font-size: 11px; padding: 4px 10px;">${labelEstado}</span>` : ''}
                        </div>
                        <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                            ${id ? 'Cotización No. ' + (cotizacion.numero || id) : 'Nueva Cotización'}
                        </h2>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Crea, parametriza y haz seguimiento comercial a ofertas para clientes con cálculo dinámico en tiempo real.
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        ${actionsHtml}
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS (ESTILO GASTOS OPERATIVOS) -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Total Cotización -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Total Propuesta</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-wallet2"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-primary tnum" id="kpi-cot-total" style="font-size: 22px;">
                                $0,00
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Valor neto cotizado al cliente
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Ítems y Unidades -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Ítems & Cantidad</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-box-seam"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-cot-items" style="font-size: 22px;">
                                0 líneas
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;" id="kpi-cot-unidades">
                                0 unidades en total
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Descuento Otorgado -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Descuento Global</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-tag"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-warning-emphasis tnum" id="kpi-cot-descuentos" style="font-size: 22px;">
                                $0,00
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;" id="kpi-cot-descuento-pct">
                                0.0% de descuento total
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Vigencia Comercial -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Validez Comercial</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-calendar-check"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-cot-vigencia" style="font-size: 22px;">
                                15 días
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;" id="kpi-cot-vigencia-desc">
                                Plazo de validez de la oferta
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR 70/30 (ESTACIÓN DE TRABAJO FINANCIERA) -->
                <div class="row g-4">
                    <!-- COLUMNA PRINCIPAL (70% - Captura) -->
                    <div class="col-12 col-lg-8">
                        
                        <!-- CARD 1: INFORMACIÓN COMERCIAL Y CLIENTE -->
                        <div class="card border rounded-3 shadow-xs mb-4 bg-white" style="border-color: var(--border-color);">
                            <div class="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="payment-kpi-icon blue-bg" style="width: 32px; height: 32px; font-size: 15px;">
                                        <i class="bi bi-person-badge"></i>
                                    </div>
                                    <h5 class="mb-0 fw-bold" style="color: var(--text-main); font-size: 15px;">
                                        Información de la Propuesta
                                    </h5>
                                </div>
                                <div class="d-flex align-items-center gap-2 text-muted" style="font-size: 12px;">
                                    <span id="lbl-numero">No. <strong style="color: var(--text-main);">${cotizacion.numero || '[Autogenerado al guardar]'}</strong></span>
                                    ${!isViewOnly ? `<i class="bi bi-gear" id="btn-config-num" style="cursor: pointer;" title="Configurar numeración"></i>` : ''}
                                </div>
                            </div>
                            <div class="card-body p-3 p-md-4">
                                <div class="row g-3">
                                    <!-- Cliente -->
                                    <div class="col-12 col-md-6">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Cliente <span class="text-danger">*</span></label>
                                        ${isViewOnly ? `
                                        <a href="#/contactos/ver/${cotizacion.clienteId}" class="form-control form-control-sm text-decoration-none d-flex align-items-center justify-content-between" style="cursor:pointer; color: var(--text-body); background-color: #f8fafc; border-color: var(--border-color); height: 38px; border-radius: 8px;">
                                            <span><i class="bi bi-person me-2 text-primary"></i>${escapeHtml(clienteNombreActual)}</span>
                                            <i class="bi bi-box-arrow-up-right text-muted" style="font-size: 0.75rem;"></i>
                                        </a>
                                        <input type="hidden" id="select-cliente" value="${escapeHtml(cotizacion.clienteId || '')}">
                                        ` : `
                                        <div class="custom-combobox" id="combo-cliente-container">
                                            <input type="text" id="search-cliente" class="form-control form-control-sm text-dark fw-medium" placeholder="Buscar cliente por nombre o NIT..." value="${escapeHtml(clienteNombreActual)}" autocomplete="off" style="border-radius: 8px; height: 38px;">
                                            <input type="hidden" id="select-cliente" value="${escapeHtml(cotizacion.clienteId || '')}">
                                        </div>
                                        `}
                                        <div id="cliente-info-badge" class="mt-2" style="display: ${clienteActual ? 'flex' : 'none'}; align-items: center; gap: 8px;">
                                            <div class="badge-avatar" style="width: 24px; height: 24px; border-radius: 6px; background-color: #eff6ff; color: #1d4ed8; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;">
                                                ${escapeHtml(clienteActual ? (clienteActual.nombre.substring(0, 2).toUpperCase()) : '')}
                                            </div>
                                            <span class="text-muted" style="font-size: 11px;">
                                                ${clienteActual && clienteActual.nit ? `NIT/CC: <strong>${escapeHtml(clienteActual.nit)}</strong>` : 'Cliente Registrado'}
                                                ${clienteActual && clienteActual.telefono ? ` · Tel: ${escapeHtml(clienteActual.telefono)}` : ''}
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Fecha de Creación -->
                                    <div class="col-12 col-sm-6 col-md-3">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Fecha de Creación *</label>
                                        <input type="date" id="input-fecha" class="form-control form-control-sm" value="${cotizacion.fecha}" ${isViewOnly ? 'disabled' : ''} style="border-radius: 8px; height: 38px;">
                                    </div>

                                    <!-- Fecha de Vencimiento -->
                                    <div class="col-12 col-sm-6 col-md-3">
                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                            <label class="form-label text-muted fw-semibold mb-0" style="font-size: 12px;">Vencimiento</label>
                                            ${!isViewOnly ? `
                                            <div class="d-flex gap-1">
                                                <button type="button" class="btn btn-xs btn-light border py-0 px-1 text-primary btn-set-dias" data-dias="15" style="font-size: 10px; border-radius: 4px;">+15d</button>
                                                <button type="button" class="btn btn-xs btn-light border py-0 px-1 text-primary btn-set-dias" data-dias="30" style="font-size: 10px; border-radius: 4px;">+30d</button>
                                            </div>
                                            ` : ''}
                                        </div>
                                        <input type="date" id="input-vencimiento" class="form-control form-control-sm" value="${cotizacion.vencimiento}" ${isViewOnly ? 'disabled' : ''} style="border-radius: 8px; height: 38px;">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- CARD 2: PRODUCTOS Y SERVICIOS -->
                        <div class="card border rounded-3 shadow-xs mb-4 bg-white" style="border-color: var(--border-color);">
                            <div class="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="payment-kpi-icon in-bg" style="width: 32px; height: 32px; font-size: 15px;">
                                        <i class="bi bi-cart-check"></i>
                                    </div>
                                    <h5 class="mb-0 fw-bold" style="color: var(--text-main); font-size: 15px;">
                                        Productos y Servicios
                                    </h5>
                                </div>
                                ${!isViewOnly ? `
                                <button id="btn-agregar-linea" type="button" class="btn btn-sm btn-light bg-white border text-primary shadow-xs d-flex align-items-center gap-1" style="border-radius: 8px; font-weight: 600; font-size: 12px;">
                                    <i class="bi bi-plus-lg"></i> Agregar Línea
                                </button>
                                ` : ''}
                            </div>
                            <div class="card-body p-0">
                                <div class="table-responsive" style="overflow: visible; min-height: 200px;">
                                    <table class="table align-middle mb-0" id="tabla-detalles" style="font-size: 13px;">
                                        <thead class="bg-light" style="border-bottom: 1px solid var(--border-color);">
                                            <tr class="text-muted fw-semibold" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                                                <th style="width: 35px;" class="text-center py-2">#</th>
                                                <th style="min-width: 220px;" class="py-2">Producto o Servicio</th>
                                                <th style="width: 100px;" class="py-2">Cant.</th>
                                                <th style="width: 130px;" class="py-2">Precio Unit.</th>
                                                <th style="width: 90px;" class="py-2">Desc %</th>
                                                <th style="width: 90px;" class="py-2">IVA %</th>
                                                <th style="width: 130px;" class="text-end py-2">Subtotal</th>
                                                <th style="width: 40px;" class="text-center py-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody id="tbody-detalles">
                                            <!-- Líneas inyectadas por JS -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- CARD 3: TÉRMINOS, NOTAS Y CONDICIONES -->
                        <div class="card border rounded-3 shadow-xs mb-4 bg-white" style="border-color: var(--border-color);">
                            <div class="card-header bg-white border-bottom p-3 d-flex align-items-center gap-2">
                                <div class="payment-kpi-icon blue-bg" style="width: 32px; height: 32px; font-size: 15px;">
                                    <i class="bi bi-card-text"></i>
                                </div>
                                <h5 class="mb-0 fw-bold" style="color: var(--text-main); font-size: 15px;">
                                    Observaciones y Condiciones Comerciales
                                </h5>
                            </div>
                            <div class="card-body p-3 p-md-4">
                                <div class="row g-3">
                                    <div class="col-12 col-md-6">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Notas y Comentarios (Visibles al Cliente)</label>
                                        <textarea id="input-notas" class="form-control text-dark" rows="3" style="font-size: 13px; border-radius: 8px; resize: none;" placeholder="Ej. Precios válidos según disponibilidad de inventario..." ${isViewOnly ? 'disabled' : ''}>${escapeHtml(cotizacion.notas)}</textarea>
                                    </div>
                                    <div class="col-12 col-md-6">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Términos y Condiciones de la Oferta</label>
                                        <textarea id="input-terminos" class="form-control text-dark" rows="3" style="font-size: 13px; border-radius: 8px; resize: none;" placeholder="Cláusulas de validez, entregas, garantías..." ${isViewOnly ? 'disabled' : ''}>${escapeHtml(cotizacion.terminosCondiciones)}</textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- DOCUMENTOS RELACIONADOS (Solo Vista) -->
                        ${isViewOnly && cotizacion.convertidoAFactura && cotizacion.facturaDestinoId ? `
                        <div class="card border rounded-3 shadow-xs mb-4 bg-white" style="border-color: var(--border-color);">
                            <div class="card-header bg-white border-bottom p-3 d-flex align-items-center gap-2">
                                <i class="bi bi-link-45deg text-primary fs-5"></i>
                                <h5 class="mb-0 fw-bold" style="color: var(--text-main); font-size: 15px;">Documento Relacionado</h5>
                            </div>
                            <div class="card-body p-3">
                                <div class="card border shadow-xs" style="max-width: 320px; cursor: pointer; border-radius: 10px;" onclick="sessionStorage.setItem('origenVolver', JSON.stringify({hash: '#/ingresos/cotizaciones/ver/${cotizacion.id}', label: 'Volver a la cotización'})); window.location.hash='#/ingresos/facturas/ver/${cotizacion.facturaDestinoId}'">
                                    <div class="card-body p-3 d-flex justify-content-between align-items-center">
                                        <div>
                                            <small class="text-muted d-block" style="font-size: 11px;">Factura emitida a partir de esta oferta</small>
                                            <span class="fw-bold text-primary" style="font-size: 14px;">Factura No. ${cotizacion.facturaDestinoNumero || cotizacion.facturaDestinoId}</span>
                                        </div>
                                        <i class="bi bi-box-arrow-up-right text-primary"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ` : ''}

                    </div>

                    <!-- COLUMNA LATERAL (30% - Sticky Financial Summary) -->
                    <div class="col-12 col-lg-4">
                        <div class="sticky-summary-card">
                            <div class="card border rounded-3 shadow-xs bg-white mb-3" style="border-color: var(--border-color);">
                                <div class="card-header bg-white border-bottom p-3 d-flex align-items-center gap-2">
                                    <div class="payment-kpi-icon blue-bg" style="width: 32px; height: 32px; font-size: 15px;">
                                        <i class="bi bi-receipt-cutoff"></i>
                                    </div>
                                    <h5 class="mb-0 fw-bold" style="color: var(--text-main); font-size: 15px;">
                                        Resumen Financiero
                                    </h5>
                                </div>
                                <div class="card-body p-4">
                                    <div class="d-flex justify-content-between mb-2 text-muted" style="font-size: 13px;">
                                        <span>Subtotal Bruto</span>
                                        <span class="fw-semibold text-dark tnum" id="tot-subtotal">$0,00</span>
                                    </div>
                                    <div class="d-flex justify-content-between mb-2 text-muted" style="font-size: 13px;">
                                        <span>(-) Descuento</span>
                                        <span class="fw-semibold text-danger tnum" id="tot-descuento">$0,00</span>
                                    </div>
                                    <div class="d-flex justify-content-between mb-3 text-muted" style="font-size: 13px;">
                                        <span>Impuestos (IVA)</span>
                                        <span class="fw-semibold text-dark tnum" id="tot-impuestos">$0,00</span>
                                    </div>
                                    <hr style="border-color: var(--border-color); margin: 12px 0;">
                                    <div class="d-flex justify-content-between align-items-baseline mb-2">
                                        <span class="fw-bold text-dark" style="font-size: 16px;">Total Oferta</span>
                                        <span class="fw-bold text-primary tnum fs-4" id="tot-total" data-raw-total="0">$0,00</span>
                                    </div>
                                    <div class="p-2 rounded-2 bg-light text-muted mb-3" style="font-size: 11px; font-style: italic;" id="tot-letras">
                                        Cero Pesos M/CTE.
                                    </div>

                                    ${!isViewOnly ? `
                                    <div class="d-grid gap-2 pt-2">
                                        <button id="btn-guardar" type="button" class="btn btn-primary-action py-2 d-flex align-items-center justify-content-center gap-2 shadow-xs" style="font-weight: 600; border-radius: 8px;">
                                            <i class="bi bi-check-circle"></i> Guardar Cotización
                                        </button>
                                        <button id="btn-cancelar" type="button" class="btn btn-light bg-white border text-secondary py-2" style="font-weight: 500; border-radius: 8px;">
                                            Descartar Cambios
                                        </button>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (id) {
            CoreActions.bindActionEvents(element, cotizacion, 'cotizacion', {
                onConvertSuccess: (nuevaFacturaId) => {
                    try {
                        window.location.hash = `#/ingresos/facturas/ver/${nuevaFacturaId}`;
                    } catch (e) {
                        console.error("Error al redireccionar a la nueva factura:", e);
                    }
                }
            });
        }

        // ==========================================
        // LÓGICA DE INTERACCIÓN (ENGINE DOM)
        // ==========================================

        const tbody = element.querySelector('#tbody-detalles');
        let contadorLineas = 0;

        // Renderizador de fila dinámica unificado con ItemEngine
        const addRow = (detalle) => {
            contadorLineas++;
            ItemEngine.addRow({
                detalle,
                tbody,
                isViewOnly,
                productosFactura: productos,
                contadorLineas,
                calcEngine,
                reindexRows,
                isCompra: false
            });
        };

        // Reindexador de numerales
        const reindexRows = () => {
            contadorLineas = ItemEngine.reindexRows(tbody);
        };

        // Helper de formateo monetario
        const formatMoney = (val) => '$' + Number(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Motor Matemático (Dynamic Pricing, Totals & 4 KPIs Reactivas)
        const calcEngine = () => {
            let sumSubtotal = 0;
            let sumDescuento = 0;
            let sumImpuestos = 0;
            let totalUnits = 0;

            const formRows = Array.from(tbody.querySelectorAll('tr'));
            
            import('../../shared/formatters.js').then(fmt => {
                const round2 = (val) => Math.round((Number(val) + Number.EPSILON) * 100) / 100;

                formRows.forEach(tr => {
                    const qty = parseFloat(tr.querySelector('.input-qty')?.value || 0);
                    const price = fmt.parseCurrencyValue(tr.querySelector('.input-price')?.value || 0);
                    const discPct = parseFloat(tr.querySelector('.input-disc')?.value || 0);
                    const taxPct = parseFloat(tr.querySelector('.input-tax')?.value || 0);

                    const baseLine = round2(qty * price);
                    const discAmount = round2(baseLine * (discPct / 100));
                    const subLine = round2(baseLine - discAmount);
                    const taxAmount = round2(subLine * (taxPct / 100));

                    const subtotalEl = tr.querySelector('.calc-subtotal');
                    if (subtotalEl) subtotalEl.textContent = formatMoney(subLine);

                    sumSubtotal = round2(sumSubtotal + baseLine);
                    sumDescuento = round2(sumDescuento + discAmount);
                    sumImpuestos = round2(sumImpuestos + taxAmount);
                    totalUnits += qty;
                });

                const totalFinal = round2(sumSubtotal - sumDescuento + sumImpuestos);
                
                const elSubtotal = element.querySelector('#tot-subtotal');
                const elDescuento = element.querySelector('#tot-descuento');
                const elImpuestos = element.querySelector('#tot-impuestos');
                const elTotal = element.querySelector('#tot-total');
                const elLetras = element.querySelector('#tot-letras');

                if (elSubtotal) elSubtotal.textContent = formatMoney(sumSubtotal);
                if (elDescuento) elDescuento.textContent = formatMoney(sumDescuento);
                if (elImpuestos) elImpuestos.textContent = formatMoney(sumImpuestos);
                if (elTotal) {
                    elTotal.textContent = formatMoney(totalFinal);
                    elTotal.dataset.rawTotal = totalFinal.toString();
                }

                // Monto en Letras
                if (elLetras) {
                    import('../../shared/numeroALetras.js').then(nl => {
                        elLetras.textContent = nl.numeroALetras(totalFinal);
                    });
                }

                // Reactividad en 4 KPI Cards
                const kpiTotal = element.querySelector('#kpi-cot-total');
                if (kpiTotal) kpiTotal.textContent = formatMoney(totalFinal);

                const kpiItems = element.querySelector('#kpi-cot-items');
                if (kpiItems) kpiItems.textContent = `${formRows.length} ${formRows.length === 1 ? 'línea' : 'líneas'}`;
                const kpiUnds = element.querySelector('#kpi-cot-unidades');
                if (kpiUnds) kpiUnds.textContent = `${totalUnits} ${totalUnits === 1 ? 'unidad' : 'unidades'} en total`;

                const kpiDesc = element.querySelector('#kpi-cot-descuentos');
                if (kpiDesc) kpiDesc.textContent = formatMoney(sumDescuento);
                const kpiDescPct = element.querySelector('#kpi-cot-descuento-pct');
                if (kpiDescPct) {
                    const pct = sumSubtotal > 0 ? (sumDescuento / sumSubtotal) * 100 : 0;
                    kpiDescPct.textContent = `${pct.toFixed(1)}% de descuento total`;
                }

                // Cálculo de Vigencia
                const inpF = element.querySelector('#input-fecha');
                const inpV = element.querySelector('#input-vencimiento');
                const kpiVig = element.querySelector('#kpi-cot-vigencia');
                const kpiVigDesc = element.querySelector('#kpi-cot-vigencia-desc');
                if (kpiVig && inpF && inpV) {
                    if (inpV.value && inpF.value) {
                        const dF = new Date(inpF.value + 'T12:00:00');
                        const dV = new Date(inpV.value + 'T12:00:00');
                        const diffDays = Math.round((dV - dF) / (1000 * 60 * 60 * 24));
                        if (diffDays >= 0) {
                            kpiVig.textContent = `${diffDays} días`;
                            kpiVigDesc.textContent = diffDays === 1 ? 'Válido por 1 día' : `Vence el ${inpV.value}`;
                        } else {
                            kpiVig.textContent = 'Vencida';
                            kpiVigDesc.textContent = 'Fecha anterior a la creación';
                        }
                    } else {
                        kpiVig.textContent = 'Indefinida';
                        kpiVigDesc.textContent = 'Sin fecha de expiración';
                    }
                }
                
                cotizacion.total = totalFinal;
            });
        };

        // Función Helper: Cálculo de Fecha de Vencimiento
        const calcularVencimiento = (cliente) => {
            const plazos = parseInt(cliente.plazosPago || cliente.plazo || 0);
            const inputVencimiento = element.querySelector('#input-vencimiento');
            if (plazos > 0) {
                const fechaCreacion = new Date(element.querySelector('#input-fecha').value + 'T12:00:00');
                fechaCreacion.setDate(fechaCreacion.getDate() + plazos);
                if (inputVencimiento) inputVencimiento.value = getLocalDate(fechaCreacion);
            } else if (!inputVencimiento?.value) {
                // Default 15 días para cotizaciones si no hay plazo explícito
                const fechaCreacion = new Date(element.querySelector('#input-fecha').value + 'T12:00:00');
                fechaCreacion.setDate(fechaCreacion.getDate() + 15);
                if (inputVencimiento) inputVencimiento.value = getLocalDate(fechaCreacion);
            }
            calcEngine();
        };

        const actualizarBadgeCliente = (c) => {
            const badgeEl = element.querySelector('#cliente-info-badge');
            if (!badgeEl) return;
            if (c) {
                badgeEl.style.display = 'flex';
                const av = getClientAvatar(c.nombre || 'Cliente');
                badgeEl.innerHTML = `
                    <div class="badge-avatar" style="width: 24px; height: 24px; border-radius: 6px; background-color: ${av.bg}; color: ${av.color}; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;">
                        ${escapeHtml(av.initials || 'CL')}
                    </div>
                    <span class="text-muted" style="font-size: 11px;">
                        ${c.nit ? `NIT/CC: <strong>${escapeHtml(c.nit)}</strong>` : 'Cliente Registrado'}
                        ${c.telefono ? ` · Tel: ${escapeHtml(c.telefono)}` : ''}
                    </span>
                `;
            } else {
                badgeEl.style.display = 'none';
            }
        };

        // Botón Volver de la Top Bar
        element.querySelector('.btn-volver-atras')?.addEventListener('click', () => {
            const origen = sessionStorage.getItem('origenVolver');
            if (origen) {
                try {
                    const o = JSON.parse(origen);
                    sessionStorage.removeItem('origenVolver');
                    window.location.hash = o.hash;
                    return;
                } catch(e) {}
            }
            window.location.hash = '#/ingresos/cotizaciones';
        });

        // Botones rápidos de incremento de días (+15d, +30d)
        element.querySelectorAll('.btn-set-dias').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dias = parseInt(e.currentTarget.dataset.dias, 10);
                const fCreacion = element.querySelector('#input-fecha')?.value;
                if (fCreacion && dias > 0) {
                    const d = new Date(fCreacion + 'T12:00:00');
                    d.setDate(d.getDate() + dias);
                    const inpVenc = element.querySelector('#input-vencimiento');
                    if (inpVenc) {
                        inpVenc.value = getLocalDate(d);
                        calcEngine();
                    }
                }
            });
        });

        // Escuchadores de cambio en fechas
        element.querySelector('#input-fecha')?.addEventListener('change', () => calcEngine());
        element.querySelector('#input-vencimiento')?.addEventListener('change', () => calcEngine());

        // Inicialización de Combobox Asíncrono de Clientes
        if (!isViewOnly) {
            UI.createAsyncCombobox({
                inputEl: element.querySelector('#search-cliente'),
                hiddenIdEl: element.querySelector('#select-cliente'),
                fetchItems: (query) => UI.fetchContactosCombobox(query, 'cliente'),
                displayProp: 'nombre',
                allowCreate: true,
                onSelect: (selectedItem) => {
                    calcularVencimiento(selectedItem);
                    actualizarBadgeCliente(selectedItem);
                    ItemEngine.actualizarPreciosMercadoLibreEnTabla(tbody, calcEngine);
                },
                onCreate: (query) => {
                    ContactosModule.renderQuickModal(query, (nuevoContacto) => {
                        element.querySelector('#search-cliente').value = nuevoContacto.nombre;
                        const hiddenInput = element.querySelector('#select-cliente');
                        hiddenInput.value = nuevoContacto.id;
                        calcularVencimiento(nuevoContacto);
                        actualizarBadgeCliente(nuevoContacto);
                        ItemEngine.actualizarPreciosMercadoLibreEnTabla(tbody, calcEngine);
                    });
                }
            });
        }

        // Configuración de Numeración (Engranaje)
        element.querySelector('#btn-config-num')?.addEventListener('click', () => {
            NumberingManager.openNumberingModal('cotizacion', cotizacion, (prefijo, numero) => {
                element.querySelector('#lbl-numero').innerHTML = `No. <strong style="color: var(--text-main);">${numero}</strong>`;
            });
        });

        // Evento Agregar Línea
        element.querySelector('#btn-agregar-linea')?.addEventListener('click', () => {
            addRow({ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 });
            calcEngine();
        });

        // Evento Cancelar
        element.querySelector('#btn-cancelar')?.addEventListener('click', () => {
            window.hayCambiosSinGuardar = false;
            window.location.hash = '#/ingresos/cotizaciones';
        });

        // Evento Imprimir Global (Acción Superior)
        element.querySelector('.btn-imprimir')?.addEventListener('click', (e) => {
            if (!isViewOnly) {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
                CoreActions.showWarningModal("Primero debes guardar o finalizar la cotización para poder generar su formato de impresión oficial.");
                if (window._cotizacionesPrintBtnTimeout) clearTimeout(window._cotizacionesPrintBtnTimeout);
                window._cotizacionesPrintBtnTimeout = setTimeout(() => {
                    if (document.body.contains(e.currentTarget)) {
                        e.currentTarget.style.borderColor = '';
                        e.currentTarget.style.color = '';
                    }
                }, 3000);
                return;
            }
            PrintManager.printDocument(cotizacion, 'Cotización', contactos, productos);
        });

        // Evento Vista Previa Global (Acción Superior)
        element.querySelector('.btn-vista-previa')?.addEventListener('click', (e) => {
            if (!isViewOnly) {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
                CoreActions.showWarningModal("Primero debes guardar o finalizar la cotización para poder generar su vista previa.");
                if (window._cotizacionesPreviewBtnTimeout) clearTimeout(window._cotizacionesPreviewBtnTimeout);
                window._cotizacionesPreviewBtnTimeout = setTimeout(() => {
                    if (document.body.contains(e.currentTarget)) {
                        e.currentTarget.style.borderColor = '';
                        e.currentTarget.style.color = '';
                    }
                }, 3000);
                return;
            }
            PrintManager.printDocument(cotizacion, 'Cotización', contactos, productos, 'preview');
        });

        // Evento Editar Global (Acción Superior)
        element.querySelector('.btn-editar')?.addEventListener('click', (e) => {
            const docId = e.currentTarget.dataset.id;
            window.location.hash = `#/ingresos/cotizaciones/editar/${docId}`;
        });

        // Evento Guardar (Captura de Estado DOM a DB)
        element.querySelector('#btn-guardar')?.addEventListener('click', async (e) => {
            const btnGuardar = e.currentTarget;
            if (btnGuardar.disabled) return;
            const originalText = btnGuardar.innerHTML;
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

            import('../../shared/formatters.js').then(async fmt => {
                const parseP = (v) => fmt.parseCurrencyValue(v);

                try {
                    const clienteId = element.querySelector('#select-cliente').value;
                    if (!clienteId) {
                        const searchInput = element.querySelector('#search-cliente');
                        searchInput.style.borderColor = '#ef4444';
                        CoreActions.showWarningModal("Debes seleccionar un cliente válido de la lista.");
                        if (window._cotizaSearchClientTimeout) clearTimeout(window._cotizaSearchClientTimeout);
                        window._cotizaSearchClientTimeout = setTimeout(() => {
                            if (document.body.contains(searchInput)) {
                                searchInput.style.borderColor = '';
                            }
                        }, 3000);
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = originalText;
                        return;
                    }

                    const arrDetalles = Array.from(tbody.querySelectorAll('tr')).map(r => {
                        return {
                            id: r.dataset.uid,
                            productoId: r.querySelector('.input-prod-id').value,
                            descripcion_personalizada: r.querySelector('.input-prod-desc')?.value || '',
                            cantidad: parseFloat(r.querySelector('.input-qty').value || 0),
                            precio: parseP(r.querySelector('.input-price').value),
                            descuento: parseFloat(r.querySelector('.input-disc').value || 0),
                            impuesto: parseFloat(r.querySelector('.input-tax').value || 0)
                        };
                    }).filter(d => d.productoId);

                    if (arrDetalles.length === 0 || parseFloat(element.querySelector('#tot-total').dataset.rawTotal) <= 0) {
                        CoreActions.showWarningModal("Debe agregar al menos un producto válido y con cantidad mayor a cero.");
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = originalText;
                        return;
                    }

                    cotizacion.clienteId = clienteId;
                    cotizacion.fecha = element.querySelector('#input-fecha').value;
                    cotizacion.vencimiento = element.querySelector('#input-vencimiento').value || cotizacion.fecha;
                    cotizacion.notas = element.querySelector('#input-notas').value;
                    cotizacion.terminosCondiciones = element.querySelector('#input-terminos').value;
                    cotizacion.detalles = arrDetalles;

                    if (!cotizacion.numero) {
                        cotizacion = await DB.saveWithNextNumero('cotizaciones', cotizacion);
                    } else {
                        await DB.save('cotizaciones', cotizacion);
                    }
                    
                    window.hayCambiosSinGuardar = false;
                    window.location.hash = `#/ingresos/cotizaciones/ver/${cotizacion.id}`;
                } catch (error) {
                    console.error("Fallo general de guardado:", error);
                    CoreActions.showWarningModal("Error al guardar: " + error.message);
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = originalText;
                } finally {
                    const btnCancelar = element.querySelector('#btn-cancelar');
                    if (btnCancelar) btnCancelar.disabled = false;
                }
            });
        });

        // Inicializar UI
        cotizacion.detalles.forEach(det => addRow(det));
        calcEngine(); // Primer cálculo

        if (!isViewOnly) {
            window.hayCambiosSinGuardar = false;
            element.addEventListener('input', (e) => { 
                window.hayCambiosSinGuardar = true; 
            });
            element.addEventListener('change', (e) => { 
                window.hayCambiosSinGuardar = true; 
            });
        }
    }
};
