import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions } from '../../shared/crud.js';
import { PrintManager } from '../../shared/printManager.js';
import { ItemEngine } from '../../shared/itemEngine.js';
import { NumberingManager } from '../../shared/numberingManager.js';
import { renderTablaFacturas } from '../../shared/tablaFacturas.js';
import { mostrarDetalleTransaccion } from '../../shared/transaccionModal.js';
import { ContactosModule } from '../clientes/clientes.js';
import { UI } from '../../shared/combobox.js';
import { calcularEstadoFactura } from '../../shared/carteraUtils.js';
import { AbonoModal } from '../../shared/abonoModal.js';
import { InventarioUtils } from '../../shared/inventarioUtils.js';
import { EstadoUtils } from '../../shared/estadoUtils.js';
import { anularTransaccion } from '../../shared/transaccionesUtils.js';
import { escapeHtml, getClientAvatar } from '../../shared/formatters.js';

export const FacturasModule = {
    cache: { contactos: null, productos: null },
    
    async init(element) {
        if (!element) return;

        // Ya no cargamos catálogos completos (Fase 2)

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
        let searchQuery = (initialSearch || '').trim();
        let filterCriteria = 'todos';
        let selectedTab = 'todas'; // 'todas', 'por_cobrar', 'cobradas', 'vencidas', 'anuladas'
        let view = 'lista'; // 'lista' o 'grafico'
        let contactosMap = {};
        let currentItems = [];
        let totalItems = 0;
        let kpiDataCxc = null;
        let chartInstanceVentas = null;
        let chartInstanceCartera = null;

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
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Facturas de venta</h2>
                            <span class="badge" style="background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #bfdbfe;">
                                <i class="bi bi-receipt me-1"></i> Ventas & Cartera
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Gestiona las facturas generadas por ventas a tus clientes, recaudación y control de saldos.
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

                        <!-- Botón Nueva Factura -->
                        <button id="btn-nueva-factura" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-plus-lg"></i> Nueva factura
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Total Facturado -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Total Facturado</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-receipt"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-facturado" style="font-size: 22px;">$ 0</div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <i class="bi bi-calendar-event me-1"></i> Facturación del mes actual
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Total Cobrado / Recaudado -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #059669;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Total Cobrado</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-cash-stack"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" id="kpi-cobrado" style="font-size: 22px;">$ 0</div>
                            <div class="mt-2 d-flex align-items-center gap-2">
                                <span class="payment-kpi-trend positive" id="kpi-tasa-recaudo">
                                    <i class="bi bi-arrow-up-right"></i> 0%
                                </span>
                                <span class="text-muted" style="font-size: 11px;">recaudo efectivo</span>
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Cartera Pendiente (Por Cobrar) -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #d97706;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Cartera Pendiente</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-clock-history"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-warning-emphasis tnum" id="kpi-pendiente" style="font-size: 22px;">$ 0</div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Saldo en cuentas por cobrar
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Total de Facturas Emitidas -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Facturas Emitidas</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-files"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-total-facturas" style="font-size: 22px;">0</div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Documentos de venta activos
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR DE ANALÍTICA GRÁFICA -->
                <div id="facturas-analytics-container" style="display: none;"></div>

                <!-- CONTENEDOR DE TABLA DE DATOS -->
                <div id="facturas-table-view-container" style="display: block;">
                    <div class="dash-table-container mb-4 shadow-xs" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                        
                        <!-- FILTROS Y TABS SUPERIORES -->
                        <div class="p-3 border-bottom bg-white d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                            <!-- Tabs de Filtro Rápido -->
                            <div class="payment-tabs-bar">
                                <button type="button" class="payment-tab-btn active" data-tab="todas">
                                    Todas
                                </button>
                                <button type="button" class="payment-tab-btn tab-warning" data-tab="por_cobrar">
                                    <i class="bi bi-clock-history text-warning"></i> Por cobrar
                                </button>
                                <button type="button" class="payment-tab-btn tab-danger" data-tab="vencidas">
                                    <i class="bi bi-exclamation-octagon text-danger"></i> Vencidas
                                </button>
                                <button type="button" class="payment-tab-btn" data-tab="cobradas">
                                    <i class="bi bi-patch-check-fill text-success"></i> Cobradas
                                </button>
                                <button type="button" class="payment-tab-btn" data-tab="anuladas">
                                    Anuladas
                                </button>
                            </div>

                            <!-- Buscador y Criterio -->
                            <div class="d-flex flex-wrap align-items-center gap-2">
                                <div class="ds-search-container" style="min-width: 220px;">
                                    <i class="bi bi-search ds-search-icon"></i>
                                    <input type="text" class="ds-search-input" id="searchFacturas" autocomplete="off" placeholder="Buscar cliente, número..." value="${escapeHtml(searchQuery)}">
                                </div>

                                <div class="dropdown">
                                    <button class="btn btn-light bg-white border dropdown-toggle" data-bs-toggle="dropdown" style="font-size: 13px; height: 38px; border-radius: 8px;">
                                        <i class="bi bi-funnel me-1"></i> <span id="lbl-filtro-actual">${filterCriteria !== 'todos' ? filterCriteria : 'Filtro'}</span>
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
                        <div class="position-relative">
                            <div id="facturas-loading-overlay" class="position-absolute top-0 start-0 w-100 h-100 justify-content-center align-items-center bg-white bg-opacity-75" style="z-index: 10; display: none !important;">
                                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>
                            </div>
                            <div id="grid-facturas-container">
                                <!-- Tabla inyectada por renderGrid -->
                            </div>
                        </div>

                        <!-- PAGINADOR -->
                        <div class="card-footer bg-white border-top p-3 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2" style="border-radius: 0 0 12px 12px;" id="grid-pagination">
                            <!-- Paginación inyectada -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- SLIDE-OVER DRAWER DE FACTURA -->
            <div class="payment-drawer-backdrop" id="factura-drawer-backdrop"></div>
            <div class="payment-drawer" id="factura-drawer">
                <div class="payment-drawer-header">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-receipt text-primary fs-5"></i>
                        <h5 class="fw-bold mb-0" style="color: #0f172a; font-size: 16px;">Detalle de la Factura</h5>
                    </div>
                    <button type="button" class="btn btn-sm btn-light border-0 text-muted" id="btn-fac-drawer-close" title="Cerrar">
                        <i class="bi bi-x-lg fs-6"></i>
                    </button>
                </div>
                <div class="payment-drawer-body" id="factura-drawer-body">
                    <!-- Contenido dinámico del comprobante -->
                </div>
                <div class="payment-drawer-footer">
                    <button type="button" class="btn btn-light border btn-sm px-3 fw-medium" id="btn-fac-drawer-close-bottom">
                        Cerrar
                    </button>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-light border btn-sm px-3 fw-medium text-secondary" id="btn-fac-drawer-imprimir" title="Imprimir o PDF">
                            <i class="bi bi-printer me-1"></i> Imprimir
                        </button>
                        <button type="button" class="btn btn-success btn-sm px-3 fw-medium text-white shadow-xs" id="btn-fac-drawer-abonar" title="Registrar Pago / Abono">
                            <i class="bi bi-cash-stack me-1"></i> Registrar Pago
                        </button>
                        <button type="button" class="btn btn-primary btn-sm px-3 fw-medium" id="btn-fac-drawer-ver" title="Ver Pantalla Completa">
                            <i class="bi bi-eye me-1"></i> Ver
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 2. FUNCIÓN DE RENDERIZADO DE TABLA
        const renderGrid = async () => {
            const containerTable = element.querySelector('#grid-facturas-container');
            const pagContainer = element.querySelector('#grid-pagination');
            const overlay = element.querySelector('#facturas-loading-overlay');

            if (overlay) overlay.style.setProperty('display', 'flex', 'important');

            try {
                // A. KPIs vía RPC si no existen
                if (!kpiDataCxc) {
                    const { data: kpis } = await supabase.rpc('get_facturas_kpis', { p_tipo: 'venta' });
                    const { count: totalDocs } = await supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('tipo', 'venta').neq('estado', 'anulada');

                    const facturado = parseFloat(kpis?.facturado) || 0;
                    const cobrado = parseFloat(kpis?.cobrado) || 0;
                    const pendiente = parseFloat(kpis?.pendiente) || 0;
                    const recaudoRate = facturado > 0 ? Math.round((cobrado / facturado) * 100) : 0;

                    kpiDataCxc = { facturado, cobrado, pendiente, totalDocs: totalDocs || 0, recaudoRate };

                    // Pintar en DOM
                    const kpiFac = element.querySelector('#kpi-facturado');
                    if (kpiFac) kpiFac.textContent = formatMoney(facturado);
                    const kpiCob = element.querySelector('#kpi-cobrado');
                    if (kpiCob) kpiCob.textContent = formatMoney(cobrado);
                    const kpiPen = element.querySelector('#kpi-pendiente');
                    if (kpiPen) kpiPen.textContent = formatMoney(pendiente);
                    const kpiTot = element.querySelector('#kpi-total-facturas');
                    if (kpiTot) kpiTot.textContent = totalDocs || 0;
                    const kpiRate = element.querySelector('#kpi-tasa-recaudo');
                    if (kpiRate) kpiRate.innerHTML = `<i class="bi bi-arrow-up-right"></i> ${recaudoRate}%`;
                }

                // B. Paginación y Filtros Server-Side / In-Memory
                const isTabFiltered = selectedTab !== 'todas' || Boolean(searchQuery);

                let pageData = [];

                if (!isTabFiltered) {
                    const { data, error } = await supabase.rpc('get_facturas_con_saldos', {
                        p_page: currentPage,
                        p_limit: itemsPerPage,
                        p_sort_col: sortColumn,
                        p_sort_dir: sortDirection,
                        p_search: searchQuery,
                        p_filter_criteria: filterCriteria,
                        p_tipo: 'venta'
                    });
                    if (error) throw error;

                    pageData = data || [];
                    totalItems = pageData.length > 0 ? parseInt(pageData[0].total_count || 0, 10) : 0;
                } else {
                    // Consulta lote amplio para filtrado preciso de pestañas
                    const { data, error } = await supabase.rpc('get_facturas_con_saldos', {
                        p_page: 1,
                        p_limit: 1000,
                        p_sort_col: sortColumn,
                        p_sort_dir: sortDirection,
                        p_search: searchQuery,
                        p_filter_criteria: filterCriteria,
                        p_tipo: 'venta'
                    });
                    if (error) throw error;

                    let allRows = data || [];

                    // Filtro de Pestañas
                    if (selectedTab === 'por_cobrar') {
                        allRows = allRows.filter(f => Number(f.saldo_pendiente) > 0 && f.estado !== 'anulada' && f.estado !== 'void');
                    } else if (selectedTab === 'cobradas') {
                        allRows = allRows.filter(f => Number(f.saldo_pendiente) <= 0 && f.estado !== 'anulada' && f.estado !== 'void');
                    } else if (selectedTab === 'vencidas') {
                        const hoy = new Date();
                        hoy.setHours(0, 0, 0, 0);
                        allRows = allRows.filter(f => {
                            if (Number(f.saldo_pendiente) <= 0 || f.estado === 'anulada') return false;
                            const vDate = new Date(f.vencimiento || f.fecha);
                            return vDate < hoy;
                        });
                    } else if (selectedTab === 'anuladas') {
                        allRows = allRows.filter(f => f.estado === 'anulada' || f.estado === 'void' || f.estado === 'voided');
                    }

                    totalItems = allRows.length;
                    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
                    if (currentPage > totalPages) currentPage = totalPages;
                    if (currentPage < 1) currentPage = 1;

                    const from = (currentPage - 1) * itemsPerPage;
                    pageData = allRows.slice(from, from + itemsPerPage);
                }

                // Resolver nombres de clientes dinámicamente
                const contactoIds = pageData.map(c => c.clienteId || c.contacto_id || c.contactoId).filter(Boolean);
                if (contactoIds.length > 0) {
                    const { data: cdata } = await supabase.from('contactos').select('id, nombre, identificacion').in('id', contactoIds);
                    if (cdata) cdata.forEach(c => {
                        contactosMap[c.id] = c.nombre;
                        if (c.identificacion) contactosMap[`nit_${c.id}`] = c.identificacion;
                    });
                }

                currentItems = pageData.map(f => ({
                    ...f,
                    estado: f.estado_dinamico || f.estado,
                    saldoPendiente: f.saldo_pendiente,
                    totalPagado: f.total_pagado
                }));

                const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

                // C. Renderizar la Tabla
                if (containerTable) {
                    containerTable.innerHTML = renderTablaFacturas(currentItems, contactosMap, sortColumn, sortDirection, null, 'venta');
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
                                ${totalItems > 0 ? `<strong>${fromItem} - ${toItem}</strong> de <strong>${totalItems}</strong> facturas` : '0 facturas'}
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

                // E. Eventos Dinámicos en la Tabla
                bindDynamicEvents();

            } catch (err) {
                console.error("Error cargando facturas:", err);
                if (containerTable) containerTable.innerHTML = `<div class="p-5 text-center text-danger">Error al cargar datos: ${err.message}</div>`;
            } finally {
                if (overlay) overlay.style.setProperty('display', 'none', 'important');
            }
        };

        // 3. SLIDE-OVER DRAWER DE FACTURA
        const mostrarDrawer = async (id) => {
            const backdrop = element.querySelector('#factura-drawer-backdrop');
            const drawer = element.querySelector('#factura-drawer');
            const body = element.querySelector('#factura-drawer-body');
            if (!drawer || !body) return;

            if (backdrop) backdrop.classList.add('show');
            drawer.classList.add('show');
            body.innerHTML = `
                <div class="d-flex justify-content-center align-items-center py-5">
                    <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>
                </div>
            `;

            try {
                const [facRes, itemsRes, pagosRes] = await Promise.all([
                    supabase.from('facturas').select('*, contactos(nombre, identificacion, email, telefono)').eq('id', id).single(),
                    supabase.from('factura_detalles').select('*, productos(nombre)').eq('factura_id', id),
                    supabase.from('pagos_ingresos').select('id, fecha, monto, observaciones, cuentas_bancarias(nombre), conciliacion_id').eq('factura_id', id).neq('estado', 'anulado').order('fecha', { ascending: false })
                ]);

                if (facRes.error || !facRes.data) throw facRes.error || new Error('Factura no encontrada');

                const fac = facRes.data;
                const items = itemsRes.data || [];
                const pagos = pagosRes.data || [];

                const clienteNombre = fac.contactos?.nombre || contactosMap[fac.contacto_id] || 'Sin Cliente';
                const avatar = getClientAvatar(clienteNombre);
                const isAnulada = fac.estado === 'anulada' || fac.estado === 'void';
                const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto || 0), 0);
                const saldoPendiente = Math.max(0, Number(fac.total || 0) - totalPagado);
                const isCobrada = saldoPendiente <= 0;

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
                                        FAC #${fac.numero || fac.id}
                                    </span>
                                    <span class="badge ${isAnulada ? 'bg-secondary-subtle text-secondary' : isCobrada ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis'} border rounded-pill">
                                        ${isAnulada ? 'Anulada' : isCobrada ? 'Cobrada' : 'Por cobrar'}
                                    </span>
                                </div>
                                <h4 class="fw-bold mb-0 mt-1" style="font-size: 17px; color: #0f172a;">${escapeHtml(clienteNombre)}</h4>
                                ${fac.contactos?.identificacion ? `<span class="text-muted" style="font-size: 12px;">NIT / CC: ${escapeHtml(fac.contactos.identificacion)}</span>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Banner de Monto y Saldos -->
                    <div class="p-3 rounded-3 mb-4" style="background: linear-gradient(135deg, #eff6ff, #f8fafc); border: 1px solid #bfdbfe;">
                        <div class="row g-2 align-items-center">
                            <div class="col-12 col-sm-4">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 10px; letter-spacing: 0.5px;">Total Factura</span>
                                <h3 class="fw-bold text-dark mb-0 tnum" style="font-size: 18px;">${formatMoney(fac.total)}</h3>
                            </div>
                            <div class="col-12 col-sm-4 border-start-sm ps-sm-3">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 10px; letter-spacing: 0.5px;">Total Recaudado</span>
                                <h3 class="fw-bold text-success mb-0 tnum" style="font-size: 18px;">${formatMoney(totalPagado)}</h3>
                            </div>
                            <div class="col-12 col-sm-4 border-start-sm ps-sm-3">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 10px; letter-spacing: 0.5px;">Saldo Pendiente</span>
                                <h3 class="fw-bold ${saldoPendiente > 0 ? 'text-danger' : 'text-success'} mb-0 tnum" style="font-size: 18px;">${formatMoney(saldoPendiente)}</h3>
                            </div>
                        </div>
                    </div>

                    <!-- Trazabilidad de la Factura -->
                    <div class="mb-4">
                        <h6 class="fw-bold text-uppercase text-muted mb-3" style="font-size: 11px; letter-spacing: 0.5px;">
                            <i class="bi bi-signpost-split me-1 text-primary"></i> Trazabilidad & Cartera
                        </h6>
                        <div class="ps-2">
                            <!-- Hito 1: Emisión -->
                            <div class="payment-timeline-item">
                                <div class="payment-timeline-dot success">
                                    <i class="bi bi-file-earmark-check" style="font-size: 9px; color: #059669;"></i>
                                </div>
                                <div class="fw-semibold text-dark" style="font-size: 13px;">Factura Emitida</div>
                                <div class="text-muted" style="font-size: 12px;">
                                    Expedida el <strong>${fac.fecha || '---'}</strong> | Vence el <strong>${fac.vencimiento || fac.fecha || '---'}</strong>
                                </div>
                            </div>

                            <!-- Hito 2: Historial de Abonos -->
                            <div class="payment-timeline-item">
                                <div class="payment-timeline-dot ${pagos.length > 0 ? 'success' : 'warning'}">
                                    <i class="bi bi-cash-stack" style="font-size: 9px; color: ${pagos.length > 0 ? '#059669' : '#d97706'};"></i>
                                </div>
                                <div class="fw-semibold text-dark" style="font-size: 13px;">Recaudos y Abonos (${pagos.length})</div>
                                <div class="text-muted" style="font-size: 12px;">
                                    ${pagos.length > 0 
                                        ? pagos.map(p => `<div>• <strong>${formatMoney(p.monto)}</strong> el ${p.fecha} (${escapeHtml(p.cuentas_bancarias?.nombre || 'Caja')})</div>`).join('')
                                        : 'Aún no se registran pagos asociados a esta factura.'}
                                </div>
                            </div>

                            <!-- Hito 3: Estado de Deuda -->
                            <div class="payment-timeline-item">
                                <div class="payment-timeline-dot ${isCobrada ? 'success' : 'warning'}">
                                    <i class="bi bi-${isCobrada ? 'check-circle-fill' : 'clock'}" style="font-size: 9px; color: ${isCobrada ? '#059669' : '#d97706'};"></i>
                                </div>
                                <div class="fw-semibold text-dark" style="font-size: 13px;">Estado Actual de Cartera</div>
                                <div class="text-muted" style="font-size: 12px;">
                                    ${isCobrada 
                                        ? `<span class="text-success"><i class="bi bi-check-circle me-1"></i> Factura totalmente saldada.</span>` 
                                        : `<span class="text-warning-emphasis"><i class="bi bi-clock-history me-1"></i> Saldo pendiente de cobro: <strong>${formatMoney(saldoPendiente)}</strong></span>`}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tabla de Ítems / Productos -->
                    <div class="mb-4">
                        <h6 class="fw-bold text-uppercase text-muted mb-2" style="font-size: 11px; letter-spacing: 0.5px;">
                            <i class="bi bi-box-seam me-1 text-primary"></i> Ítems Facturados (${items.length})
                        </h6>
                        <div class="table-responsive border rounded-3 bg-white">
                            <table class="table table-sm align-middle mb-0" style="font-size: 12px;">
                                <thead class="bg-light text-muted">
                                    <tr>
                                        <th class="ps-3 py-2">Producto / Servicio</th>
                                        <th class="text-center py-2">Cant</th>
                                        <th class="text-end py-2">Precio</th>
                                        <th class="text-end pe-3 py-2">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map(d => {
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

                    ${fac.observaciones ? `
                        <div class="mb-3">
                            <h6 class="fw-bold text-uppercase text-muted mb-1" style="font-size: 11px;">Notas y Observaciones</h6>
                            <div class="p-3 bg-light rounded-3 text-secondary" style="font-size: 12px; line-height: 1.5;">
                                ${escapeHtml(fac.observaciones)}
                            </div>
                        </div>
                    ` : ''}
                `;

                // Configurar Botones del Drawer
                const btnDrawerImprimir = element.querySelector('#btn-fac-drawer-imprimir');
                if (btnDrawerImprimir) {
                    btnDrawerImprimir.onclick = async () => {
                        const doc = await DB.get('facturas', id);
                        if (!doc) return;
                        const pIds = (doc.detalles || []).map(d => parseInt(d.productoId, 10)).filter(p => !isNaN(p) && p > 0);
                        const [clienteRes, prodsRes] = await Promise.all([
                            doc.clienteId ? supabase.from('contactos').select('*').eq('id', parseInt(doc.clienteId, 10)).single() : Promise.resolve({ data: null }),
                            pIds.length > 0 ? supabase.from('productos').select('*').in('id', pIds) : Promise.resolve({ data: [] })
                        ]);
                        const contactos = clienteRes.data ? [DB._mapToFrontend('contactos', clienteRes.data)] : [];
                        const productos = (prodsRes.data || []).map(p => DB._mapToFrontend('productos', p));
                        PrintManager.printDocument(doc, 'Factura de venta', contactos, productos);
                    };
                }

                const btnDrawerAbonar = element.querySelector('#btn-fac-drawer-abonar');
                if (btnDrawerAbonar) {
                    if (isCobrada || isAnulada) {
                        btnDrawerAbonar.style.display = 'none';
                    } else {
                        btnDrawerAbonar.style.display = 'inline-block';
                        btnDrawerAbonar.onclick = () => {
                            cerrarDrawer();
                            AbonoModal.show(id, async () => {
                                kpiDataCxc = null;
                                await renderGrid();
                            });
                        };
                    }
                }

                const btnDrawerVer = element.querySelector('#btn-fac-drawer-ver');
                if (btnDrawerVer) {
                    btnDrawerVer.onclick = () => {
                        cerrarDrawer();
                        window.location.hash = `#/ingresos/facturas/ver/${id}`;
                    };
                }

            } catch (err) {
                console.error("Error al cargar detalle de factura para drawer:", err);
                body.innerHTML = `<div class="p-4 text-center text-danger">Error al cargar datos del comprobante.</div>`;
            }
        };

        const cerrarDrawer = () => {
            const backdrop = element.querySelector('#factura-drawer-backdrop');
            const drawer = element.querySelector('#factura-drawer');
            if (backdrop) backdrop.classList.remove('show');
            if (drawer) drawer.classList.remove('show');
        };

        // 4. ANALÍTICA GRÁFICA INTERACTIVA
        const renderAnalyticsView = async () => {
            const container = element.querySelector('#facturas-analytics-container');
            if (!container) return;

            container.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="text-muted mt-2" style="font-size: 13px;">Generando analítica de facturación...</p>
                </div>
            `;

            try {
                const now = new Date();
                const past60 = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

                const { data: facturasData } = await supabase
                    .from('facturas')
                    .select('id, numero, fecha, total, estado, contacto_id, contactos(nombre)')
                    .eq('tipo', 'venta')
                    .neq('estado', 'anulada')
                    .gte('fecha', past60)
                    .order('fecha', { ascending: true });

                const dailyMap = {};
                const clientMap = {};

                (facturasData || []).forEach(f => {
                    const fecha = f.fecha || 'Sin fecha';
                    const val = Number(f.total) || 0;
                    const cliente = f.contactos?.nombre || 'General / Varios';

                    dailyMap[fecha] = (dailyMap[fecha] || 0) + val;
                    clientMap[cliente] = (clientMap[cliente] || 0) + val;
                });

                const topClients = Object.entries(clientMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([nombre, total]) => ({ nombre, total }));

                container.innerHTML = `
                    <div class="row g-3 mb-4">
                        <!-- Gráfico de Ventas Diarias -->
                        <div class="col-12 col-lg-8">
                            <div class="payment-kpi-card h-100 p-4">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <div>
                                        <h6 class="fw-bold mb-0 text-dark">Evolución Diaria de Ventas (Últimos 60 días)</h6>
                                        <span class="text-muted" style="font-size: 12px;">Monto facturado por día</span>
                                    </div>
                                    <span class="badge bg-light text-primary border px-2 py-1" style="font-size: 11px;">
                                        <i class="bi bi-graph-up me-1"></i> Facturación
                                    </span>
                                </div>
                                <div style="height: 260px; position: relative;">
                                    <canvas id="facturasDailyChart"></canvas>
                                </div>
                            </div>
                        </div>

                        <!-- Gráfico de Cartera Cobrada vs Pendiente -->
                        <div class="col-12 col-lg-4">
                            <div class="payment-kpi-card h-100 p-4">
                                <div class="mb-3">
                                    <h6 class="fw-bold mb-0 text-dark">Distribución de Cartera</h6>
                                    <span class="text-muted" style="font-size: 12px;">Proporción cobrado vs pendiente</span>
                                </div>
                                <div style="height: 180px; position: relative;" class="d-flex justify-content-center">
                                    <canvas id="facturasCarteraChart"></canvas>
                                </div>
                                <div class="mt-3 border-top pt-2" style="font-size: 12px;">
                                    <div class="d-flex justify-content-between align-items-center py-1">
                                        <span class="text-muted"><i class="bi bi-circle-fill text-success me-1" style="font-size: 9px;"></i> Total Cobrado</span>
                                        <span class="fw-bold text-success tnum">${formatMoney(kpiDataCxc?.cobrado || 0)}</span>
                                    </div>
                                    <div class="d-flex justify-content-between align-items-center py-1">
                                        <span class="text-muted"><i class="bi bi-circle-fill text-warning me-1" style="font-size: 9px;"></i> Por Cobrar</span>
                                        <span class="fw-bold text-warning-emphasis tnum">${formatMoney(kpiDataCxc?.pendiente || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Top 5 Clientes en Facturación -->
                        <div class="col-12">
                            <div class="payment-kpi-card p-4">
                                <h6 class="fw-bold mb-1 text-dark">Top 5 Clientes con Mayor Facturación</h6>
                                <span class="text-muted d-block mb-3" style="font-size: 12px;">Clientes con mayor volumen acumulado</span>
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

                    const ctxDaily = document.getElementById('facturasDailyChart');
                    if (ctxDaily) {
                        if (chartInstanceVentas) chartInstanceVentas.destroy();
                        chartInstanceVentas = new Chart(ctxDaily, {
                            type: 'bar',
                            data: {
                                labels: Object.keys(dailyMap).map(l => l.substring(5)),
                                datasets: [{
                                    label: 'Facturado ($)',
                                    data: Object.values(dailyMap),
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

                    const ctxCartera = document.getElementById('facturasCarteraChart');
                    if (ctxCartera) {
                        if (chartInstanceCartera) chartInstanceCartera.destroy();
                        chartInstanceCartera = new Chart(ctxCartera, {
                            type: 'doughnut',
                            data: {
                                labels: ['Cobrado', 'Pendiente'],
                                datasets: [{
                                    data: [kpiDataCxc?.cobrado || 0, kpiDataCxc?.pendiente || 0],
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
                console.error("Error generando analítica de facturas:", err);
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
                const { data: allFiltered, error } = await supabase.rpc('get_facturas_con_saldos', {
                    p_page: 1,
                    p_limit: 10000,
                    p_sort_col: sortColumn,
                    p_sort_dir: sortDirection,
                    p_search: searchQuery,
                    p_filter_criteria: filterCriteria,
                    p_tipo: 'venta'
                });
                if (error) throw error;

                let allRows = allFiltered || [];

                // Aplicar filtros activos
                if (selectedTab === 'por_cobrar') {
                    allRows = allRows.filter(f => Number(f.saldo_pendiente) > 0 && f.estado !== 'anulada');
                } else if (selectedTab === 'cobradas') {
                    allRows = allRows.filter(f => Number(f.saldo_pendiente) <= 0 && f.estado !== 'anulada');
                } else if (selectedTab === 'vencidas') {
                    const hoy = new Date();
                    hoy.setHours(0, 0, 0, 0);
                    allRows = allRows.filter(f => Number(f.saldo_pendiente) > 0 && f.estado !== 'anulada' && new Date(f.vencimiento || f.fecha) < hoy);
                } else if (selectedTab === 'anuladas') {
                    allRows = allRows.filter(f => f.estado === 'anulada' || f.estado === 'void');
                }

                if (allRows.length === 0) {
                    alert('No hay facturas para exportar con los filtros seleccionados.');
                    return;
                }

                // Cargar nombres de contactos
                const exportIds = allRows.map(c => c.clienteId || c.contacto_id || c.contactoId).filter(Boolean);
                let exportMap = {};
                if (exportIds.length > 0) {
                    const { data: edata } = await supabase.from('contactos').select('id, nombre').in('id', exportIds);
                    if (edata) edata.forEach(c => exportMap[c.id] = c.nombre);
                }

                const dataToExport = allRows.map(f => {
                    const contactId = f.clienteId || f.contacto_id || f.contactoId;
                    return {
                        'Número': f.numero || f.id,
                        'Cliente': exportMap[contactId] || 'Sin Cliente',
                        'Fecha': f.fecha || '',
                        'Vencimiento': f.vencimiento || '',
                        'Total ($)': Number(f.total) || 0,
                        'Cobrado ($)': Number(f.total_pagado) || 0,
                        'Saldo Pendiente ($)': Number(f.saldo_pendiente) || 0,
                        'Estado': f.estado_dinamico || f.estado || 'Por cobrar'
                    };
                });

                const dateStr = new Date().toISOString().split('T')[0];

                if (window.XLSX) {
                    const ws = window.XLSX.utils.json_to_sheet(dataToExport);
                    const wb = window.XLSX.utils.book_new();
                    window.XLSX.utils.book_append_sheet(wb, ws, 'Facturas_Venta');
                    window.XLSX.writeFile(wb, `Facturas_Venta_${dateStr}.xlsx`);
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
                    a.download = `Facturas_Venta_${dateStr}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            } catch (err) {
                console.error("Error exportando facturas:", err);
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
            const searchInput = element.querySelector('#searchFacturas');
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

            // Toggle Vista Lista vs Analítica
            const btnViewLista = element.querySelector('#btn-view-lista');
            const btnViewGrafico = element.querySelector('#btn-view-grafico');
            const containerTable = element.querySelector('#facturas-table-view-container');
            const containerAnalytics = element.querySelector('#facturas-analytics-container');

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
                kpiDataCxc = null;
                if (view === 'grafico') {
                    await renderAnalyticsView();
                } else {
                    await renderGrid();
                }
                if (icon) icon.classList.remove('spinner-border', 'spinner-border-sm');
            });

            // Botón Exportar
            element.querySelector('#btn-export-list')?.addEventListener('click', exportarExcel);

            // Botón Crear Factura
            element.querySelector('#btn-nueva-factura')?.addEventListener('click', () => {
                window.location.hash = '#/ingresos/facturas/nueva';
            });

            // Drawer Cierres
            const btnCloseDrawer = element.querySelector('#btn-fac-drawer-close');
            const btnCloseDrawerB = element.querySelector('#btn-fac-drawer-close-bottom');
            const backdropDrawer = element.querySelector('#factura-drawer-backdrop');
            if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', cerrarDrawer);
            if (btnCloseDrawerB) btnCloseDrawerB.addEventListener('click', cerrarDrawer);
            if (backdropDrawer) backdropDrawer.addEventListener('click', cerrarDrawer);
        };

        // 7. EVENTOS DINÁMICOS EN FILAS Y MENÚS
        const bindDynamicEvents = () => {
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
                    renderGrid();
                });
            });

            // Fila click para abrir drawer
            element.querySelectorAll('.fila-factura').forEach(tr => {
                tr.addEventListener('click', (e) => {
                    if (e.target.closest('.dropdown') || e.target.closest('button') || e.target.closest('a')) return;
                    mostrarDrawer(tr.dataset.id);
                });
            });

            // Quick View Button
            element.querySelectorAll('.btn-quick-view-factura').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    mostrarDrawer(btn.dataset.id);
                });
            });

            // Quick Print Button
            element.querySelectorAll('.btn-imprimir-row').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = e.currentTarget.dataset.id;
                    const doc = await DB.get('facturas', id);
                    if (doc) {
                        const pIds = (doc.detalles || []).map(d => parseInt(d.productoId, 10)).filter(p => !isNaN(p) && p > 0);
                        const [clienteRes, prodsRes] = await Promise.all([
                            doc.clienteId ? supabase.from('contactos').select('*').eq('id', parseInt(doc.clienteId, 10)).single() : Promise.resolve({ data: null }),
                            pIds.length > 0 ? supabase.from('productos').select('*').in('id', pIds) : Promise.resolve({ data: [] })
                        ]);
                        const contactos = clienteRes.data ? [DB._mapToFrontend('contactos', clienteRes.data)] : [];
                        const productos = (prodsRes.data || []).map(p => DB._mapToFrontend('productos', p));
                        PrintManager.printDocument(doc, 'Factura de venta', contactos, productos);
                    }
                });
            });

            // 3-dots Menu Actions
            element.querySelectorAll('.btn-menu-row').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const existing = document.querySelector('.row-action-menu');
                    if (existing) existing.remove();

                    const id = e.currentTarget.dataset.id;
                    const rect = e.currentTarget.getBoundingClientRect();

                    const factData = currentItems.find(f => String(f.id) === String(id));
                    const canAbonar = factData && factData.estado !== 'pagada' && !EstadoUtils.estaAnulado(factData.estado);
                    const isAnulada = factData && EstadoUtils.estaAnulado(factData.estado);

                    const menuHtml = `
                        <div class="row-action-menu position-absolute bg-white shadow rounded border py-2" 
                             style="z-index: 1060; width: 160px; top: ${rect.bottom + window.scrollY}px; left: ${rect.left - 110}px;">
                            ${canAbonar ? `
                            <a href="#" class="d-block px-3 py-1.5 text-decoration-none btn-abonar-factura text-success fw-medium" data-id="${id}" data-saldo="${factData.saldoPendiente}" style="font-size: 13px;">
                                <i class="bi bi-wallet2 me-2"></i> Registrar Pago
                            </a>
                            <hr class="dropdown-divider my-1">` : ''}
                            <a href="#" class="d-block px-3 py-1.5 text-decoration-none btn-ver-drawer-menu text-primary" data-id="${id}" style="font-size: 13px;">
                                <i class="bi bi-layout-sidebar-inset-reverse me-2"></i> Ver detalle
                            </a>
                            ${!isAnulada ? `
                            <a href="#/ingresos/facturas/editar/${id}" class="d-block px-3 py-1.5 text-decoration-none text-dark" style="font-size: 13px;">
                                <i class="bi bi-pencil me-2 text-secondary"></i> Editar
                            </a>
                            ${factData?.totalPagado > 0 ? `
                            <a href="#" class="d-block px-3 py-1.5 text-decoration-none text-danger btn-anular-venta" data-id="${id}" style="font-size: 13px;">
                                <i class="bi bi-x-circle me-2"></i> Anular Venta
                            </a>` : `
                            <a href="#" class="d-block px-3 py-1.5 text-decoration-none text-danger btn-delete-row" data-id="${id}" style="font-size: 13px;">
                                <i class="bi bi-trash me-2"></i> Eliminar
                            </a>`}
                            ` : ''}
                        </div>
                    `;
                    document.body.insertAdjacentHTML('beforeend', menuHtml);

                    const menu = document.querySelector('.row-action-menu');

                    menu.querySelector('.btn-ver-drawer-menu')?.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        menu.remove();
                        mostrarDrawer(id);
                    });

                    if (canAbonar) {
                        menu.querySelector('.btn-abonar-factura')?.addEventListener('click', (ev) => {
                            ev.preventDefault();
                            menu.remove();
                            AbonoModal.show(id, async () => {
                                kpiDataCxc = null;
                                await renderGrid();
                            });
                        });
                    }

                    const btnDeleteRow = menu.querySelector('.btn-delete-row');
                    if (btnDeleteRow) {
                        btnDeleteRow.addEventListener('click', async (ev) => {
                            ev.preventDefault();
                            if (confirm('¿Estás seguro de eliminar esta factura de forma permanente? Se devolverá el inventario asociado.')) {
                                menu.remove();
                                try {
                                    const { error } = await supabase.rpc('eliminar_factura_venta', { 
                                        p_factura_id: parseInt(id, 10) 
                                    });
                                    if (error) throw error;

                                    DB.invalidateCache('facturas');
                                    DB.invalidateCache('lotes_fifo');
                                    kpiDataCxc = null;
                                    await renderGrid();
                                    CoreActions.showSuccessModal('Factura eliminada y stock devuelto exitosamente.');
                                } catch (error) {
                                    console.error("Error al eliminar:", error);
                                    CoreActions.showWarningModal("No se pudo eliminar: " + error.message);
                                }
                            }
                        });
                    }

                    const btnAnularVenta = menu.querySelector('.btn-anular-venta');
                    if (btnAnularVenta) {
                        btnAnularVenta.addEventListener('click', async (ev) => {
                            ev.preventDefault();
                            if (confirm('¿Estás seguro de anular esta venta? Se revertirá el inventario y el pago asociado.')) {
                                menu.remove();
                                try {
                                    const { error } = await supabase.rpc('anular_venta_pagada', { 
                                        p_factura_id: parseInt(id, 10) 
                                    });
                                    if (error) throw error;

                                    DB.invalidateCache('facturas');
                                    DB.invalidateCache('lotes_fifo');
                                    DB.invalidateCache('transacciones');
                                    DB.invalidateCache('pagos_ingresos');
                                    kpiDataCxc = null;
                                    await renderGrid();
                                    CoreActions.showSuccessModal('Venta anulada exitosamente.');
                                } catch (error) {
                                    console.error("Error al anular venta:", error);
                                    CoreActions.showWarningModal("No se pudo anular: " + error.message);
                                }
                            }
                        });
                    }
                });
            });
        };

        // Flujo inicial de montaje
        bindStaticEvents();
        await renderGrid();

        return () => {
            if (chartInstanceVentas) {
                try { chartInstanceVentas.destroy(); } catch (e) {}
                chartInstanceVentas = null;
            }
            if (chartInstanceCartera) {
                try { chartInstanceCartera.destroy(); } catch (e) {}
                chartInstanceCartera = null;
            }
        };
    },

    async renderForm(element, id = null, isViewOnly = false) {
        const facturaIdTransacciones = id ? [id] : [];
        const [transaccionesResult, notasCreditoResult] = facturaIdTransacciones.length > 0
            ? await Promise.all([
                supabase.from('pagos_ingresos').select('*').in('factura_id', facturaIdTransacciones),
                supabase.from('notas_credito').select('*').in('factura_id', facturaIdTransacciones)
              ])
            : [{ data: [] }, { data: [] }];

        // TRADUCCIÓN OBLIGATORIA: El query crudo a Supabase devuelve 'in' / 'out'. 
        // calcularEstadoFactura exige el contrato 'ingreso' / 'egreso'.
        const transacciones = (transaccionesResult.data || []).map(t => ({
            ...t,
            tipo: t.tipo === 'in' ? 'ingreso' : 'egreso'
        }));
        const notasCredito = notasCreditoResult.data || [];
        
        // Estado por defecto
        let factura = {
            id: 'fac_' + Date.now(),
            numero: undefined,
            fecha: getLocalDate(),
            vencimiento: '',
            clienteId: '',
            detalles: [{ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 }],
            notas: '',
            terminosCondiciones: 'Favor realizar los pagos a nuestra cuenta bancaria.',
            estado: 'por_pagar',
            total: 0
        };

        if (id) {
            const dbData = await DB.get('facturas', id);
            if (dbData) {
                factura = dbData;
                // Decorar factura con saldo real al vuelo
                const dinamico = calcularEstadoFactura(factura, transacciones);
                factura.estado = dinamico.estado;
                factura.saldoPendiente = dinamico.saldo;
            }
            
            // Fix backwards compatibility for converted cotizaciones
            if (factura.contactoId && !factura.clienteId) {
                factura.clienteId = factura.contactoId;
            }
            if (!factura.numero) {
                factura.numero = Math.floor(Math.random() * 9000) + 1000;
            }

            if (!factura.detalles || factura.detalles.length === 0) {
                factura.detalles = [{ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 }];
            }
        } else {
            const [, queryString] = window.location.hash.split('?');
            const urlParams = new URLSearchParams(queryString || '');
            const rawClienteId = urlParams.get('clienteId');
            if (rawClienteId && /^\d+$/.test(rawClienteId)) {
                factura.clienteId = String(rawClienteId);
            }
            const rawProductoId = urlParams.get('productoId');
            if (rawProductoId && /^\d+$/.test(rawProductoId) && factura.detalles && factura.detalles[0]) {
                factura.detalles[0].productoId = String(rawProductoId);
                factura.detalles[0].cantidad = 1;
            }
        }

        const headerHtml = CoreActions.renderDocumentHeader('ingresos/facturas', 'Volver a Facturas de venta');
        const actionsHtml = CoreActions.renderActionButtons(factura, 'factura', isViewOnly, !id);

        const pIdsIniciales = (factura.detalles || [])
            .map(d => parseInt(d.productoId, 10))
            .filter(pid => !isNaN(pid) && pid > 0);

        const [contactos, cliDataResult, productosResult, vendedoresResult, dbCuentasResult] = await Promise.all([
            DB.getAll('contactos'),
            factura.clienteId ? supabase.from('contactos').select('id, nombre, nit, telefono').eq('id', factura.clienteId).single() : Promise.resolve({ data: null }),
            pIdsIniciales.length > 0 ? supabase.from('productos').select('*').in('id', pIdsIniciales) : Promise.resolve({ data: [] }),
            supabase.from('vendedores').select('id, nombre').eq('estado', 'activo').order('nombre'),
            DB.getAll('cuentas_bancarias')
        ]);

        let clienteNombreActual = cliDataResult?.data ? cliDataResult.data.nombre : '';
        let productosFactura = (productosResult?.data || []).map(p => DB._mapToFrontend('productos', p));

        const dbContactos = contactos || [];
        const clientes = dbContactos.filter(c => c.estado === 'activo' && (c.es_cliente || c.tipo !== 'proveedor'));
        const { data: vendedoresActivos } = vendedoresResult;
        const dbCuentas = dbCuentasResult || [];
        const cuentasActivas = dbCuentas.filter(c => c.estado === 'active');
        const cuentasMap = {};
        dbCuentas.forEach(c => cuentasMap[c.id] = c.nombre);

        const estadoLabel = factura.estado || 'por_pagar';
        let labelEstado = '';
        let badgeClass = '';
        let isVencida = false;
        
        if (estadoLabel === 'por_pagar' && factura.vencimiento) {
            const today = new Date();
            today.setHours(0,0,0,0);
            const expDate = new Date(factura.vencimiento);
            isVencida = expDate < today;
        }
        
        if (estadoLabel === 'anulada' || estadoLabel === 'voided' || estadoLabel === 'void') {
            labelEstado = 'Anulada';
            badgeClass = 'bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle';
        } else if (factura.saldoPendiente <= 0 && factura.total > 0) {
            labelEstado = 'Cobrada';
            badgeClass = 'bg-primary text-primary bg-opacity-10 border border-primary-subtle';
        } else if (isVencida) {
            labelEstado = 'Vencida';
            badgeClass = 'bg-danger text-danger bg-opacity-10 border border-danger-subtle';
        } else {
            labelEstado = 'Por cobrar';
            badgeClass = 'bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle';
        }

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
                                <i class="bi bi-receipt me-1"></i> Ventas & Facturación Directa
                            </span>
                            ${id ? `<span class="badge ${badgeClass} rounded-pill fw-medium" style="font-size: 11px; padding: 4px 10px;">${labelEstado}</span>` : ''}
                        </div>
                        <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                            ${id ? 'Factura No. ' + (factura.numero || id) : 'Nueva Factura de Venta'}
                        </h2>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Generación de facturas comerciales con descargo FIFO de inventario y trazabilidad contable.
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        ${isViewOnly && id && factura.estado !== 'pagada' && !EstadoUtils.estaAnulado(factura.estado) ? 
                            `<button class="btn btn-primary-action px-3 py-1 btn-sm btn-abonar-detalle d-flex align-items-center gap-1 shadow-xs" data-id="${factura.id}" data-saldo="${factura.saldoPendiente}" style="border-radius: 8px; font-weight: 600;"><i class="bi bi-wallet2"></i> Registrar Pago</button>` 
                            : ''}
                        ${actionsHtml}
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS (ESTILO GASTOS OPERATIVOS) -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Total Factura -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Total a Facturar</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-currency-dollar"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" id="kpi-fac-total" style="font-size: 22px;">
                                $0,00
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Monto total de la venta
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Semáforo de Inventario FIFO -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Disponibilidad Stock</span>
                                <div class="payment-kpi-icon in-bg" id="kpi-fac-stock-icon">
                                    <i class="bi bi-check-circle text-success"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success" id="kpi-fac-stock" style="font-size: 20px;">
                                Disponible
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;" id="kpi-fac-stock-desc">
                                Existencias verificadas en almacén
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Condición de Venta -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Condición de Pago</span>
                                <div class="payment-kpi-icon pending-bg" id="kpi-fac-condicion-icon">
                                    <i class="bi bi-credit-card"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark" id="kpi-fac-condicion" style="font-size: 20px;">
                                ${factura.tipoVenta === 'contado' ? 'De Contado' : 'A Crédito'}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;" id="kpi-fac-condicion-desc">
                                ${factura.tipoVenta === 'contado' ? 'Ingreso directo a caja/banco' : 'Cuenta por cobrar en cartera'}
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Cartera del Cliente -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Cartera del Cliente</span>
                                <div class="payment-kpi-icon blue-bg" id="kpi-fac-cartera-icon">
                                    <i class="bi bi-clock-history"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-fac-cartera" style="font-size: 22px;">
                                $0,00
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;" id="kpi-fac-cartera-desc">
                                Saldo exigible en cartera
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
                                        Parámetros de Facturación
                                    </h5>
                                </div>
                                <div class="d-flex align-items-center gap-2 text-muted" style="font-size: 12px;">
                                    <span id="lbl-numero">No. <strong style="color: var(--text-main);">${factura.numero || '[Autogenerado al guardar]'}</strong></span>
                                    ${!isViewOnly ? `<i class="bi bi-gear" id="btn-config-num" style="cursor: pointer;" title="Configurar numeración"></i>` : ''}
                                </div>
                            </div>
                            <div class="card-body p-3 p-md-4">
                                <div class="row g-3">
                                    <!-- Cliente -->
                                    <div class="col-12 col-md-6">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Cliente <span class="text-danger">*</span></label>
                                        ${isViewOnly ? `
                                        <a href="#/contactos/ver/${factura.clienteId}" class="form-control form-control-sm text-decoration-none d-flex align-items-center justify-content-between" style="cursor:pointer; color: var(--text-body); background-color: #f8fafc; border-color: var(--border-color); height: 38px; border-radius: 8px;">
                                            <span><i class="bi bi-person me-2 text-primary"></i>${escapeHtml(clienteNombreActual)}</span>
                                            <i class="bi bi-box-arrow-up-right text-muted" style="font-size: 0.75rem;"></i>
                                        </a>
                                        <input type="hidden" id="select-cliente" value="${escapeHtml(factura.clienteId || '')}">
                                        ` : `
                                        <div class="custom-combobox" id="combo-cliente-container">
                                            <input type="text" id="search-cliente" class="form-control form-control-sm text-dark fw-medium" placeholder="Buscar cliente por nombre o NIT..." value="${escapeHtml(clienteNombreActual)}" autocomplete="off" style="border-radius: 8px; height: 38px;">
                                            <input type="hidden" id="select-cliente" value="${escapeHtml(factura.clienteId || '')}">
                                        </div>
                                        `}
                                        <div id="cliente-info-badge" class="mt-2" style="display: ${cliDataResult?.data ? 'flex' : 'none'}; align-items: center; gap: 8px;">
                                            <div class="badge-avatar" style="width: 24px; height: 24px; border-radius: 6px; background-color: #eff6ff; color: #1d4ed8; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;">
                                                ${escapeHtml(cliDataResult?.data ? (cliDataResult.data.nombre.substring(0, 2).toUpperCase()) : '')}
                                            </div>
                                            <span class="text-muted" style="font-size: 11px;" id="cliente-info-text">
                                                Cliente Seleccionado
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Tipo de Venta -->
                                    <div class="col-12 col-sm-6 col-md-3">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Tipo de Venta *</label>
                                        <select id="select-tipo-venta" class="form-select form-select-sm" ${isViewOnly ? 'disabled' : ''} style="border-radius: 8px; height: 38px; font-weight: 500;">
                                            <option value="credito" ${factura.tipoVenta === 'credito' || !factura.tipoVenta ? 'selected' : ''}>A Crédito (Cartera)</option>
                                            <option value="contado" ${factura.tipoVenta === 'contado' ? 'selected' : ''}>De Contado (Caja)</option>
                                        </select>
                                    </div>

                                    <!-- Cuenta de Contado -->
                                    <div class="col-12 col-sm-6 col-md-3" id="container-cuenta-venta" style="display: ${factura.tipoVenta === 'contado' ? 'block' : 'none'};">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Cuenta Destino *</label>
                                        <select id="select-cuenta-venta" class="form-select form-select-sm" ${isViewOnly ? 'disabled' : ''} style="border-radius: 8px; height: 38px;">
                                            ${cuentasActivas.map(c => `<option value="${c.id}" ${String(factura.cuentaId) === String(c.id) || factura.cuentaId === c.nombre ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}
                                        </select>
                                    </div>

                                    <!-- Fecha de Creación -->
                                    <div class="col-12 col-sm-6 col-md-3">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Fecha de Creación *</label>
                                        <input type="date" id="input-fecha" class="form-control form-control-sm" value="${factura.fecha}" ${isViewOnly ? 'disabled' : ''} style="border-radius: 8px; height: 38px;">
                                    </div>

                                    <!-- Fecha de Vencimiento -->
                                    <div class="col-12 col-sm-6 col-md-3">
                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                            <label class="form-label text-muted fw-semibold mb-0" style="font-size: 12px;">Vencimiento</label>
                                            ${!isViewOnly ? `
                                            <div class="d-flex gap-1" id="btn-group-plazos">
                                                <button type="button" class="btn btn-xs btn-light border py-0 px-1 text-primary btn-set-dias-fac" data-dias="15" style="font-size: 10px; border-radius: 4px;">+15d</button>
                                                <button type="button" class="btn btn-xs btn-light border py-0 px-1 text-primary btn-set-dias-fac" data-dias="30" style="font-size: 10px; border-radius: 4px;">+30d</button>
                                                <button type="button" class="btn btn-xs btn-light border py-0 px-1 text-primary btn-set-dias-fac" data-dias="60" style="font-size: 10px; border-radius: 4px;">+60d</button>
                                            </div>
                                            ` : ''}
                                        </div>
                                        <input type="date" id="input-vencimiento" class="form-control form-control-sm" value="${factura.vencimiento}" ${isViewOnly ? 'disabled' : ''} style="border-radius: 8px; height: 38px;">
                                    </div>

                                    <!-- Vendedor -->
                                    <div class="col-12 col-sm-6 col-md-3">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Vendedor / Asesor</label>
                                        <select id="select-vendedor" class="form-select form-select-sm" ${isViewOnly ? 'disabled' : ''} style="border-radius: 8px; height: 38px;">
                                            <option value="">Sin vendedor asignado</option>
                                            ${(vendedoresActivos || []).map(v => `<option value="${v.id}" ${String(factura.vendedor_id) === String(v.id) ? 'selected' : ''}>${escapeHtml(v.nombre)}</option>`).join('')}
                                        </select>
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
                                        Productos y Servicios Facturados
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
                            ${!isViewOnly ? `
                            <div class="card-footer bg-white border-top p-2 px-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                                <div class="d-flex align-items-center gap-2">
                                    <button id="btn-agregar-linea-abajo" type="button" class="btn btn-sm btn-light bg-white border text-primary shadow-xs d-flex align-items-center gap-1" style="border-radius: 8px; font-weight: 600; font-size: 12px;">
                                        <i class="bi bi-plus-lg"></i> Agregar Línea
                                    </button>
                                    <div class="btn-group btn-group-sm">
                                        <button id="btn-agregar-5-lineas" type="button" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 500; font-size: 11px;" title="Agregar 5 líneas en blanco">
                                            +5 Líneas
                                        </button>
                                        <button id="btn-agregar-10-lineas" type="button" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 500; font-size: 11px;" title="Agregar 10 líneas en blanco">
                                            +10 Líneas
                                        </button>
                                    </div>
                                </div>
                                <small class="text-muted d-none d-sm-inline" style="font-size: 11px;">
                                    <i class="bi bi-info-circle me-1"></i>Puedes agregar líneas individuales o en lote
                                </small>
                            </div>
                            ` : ''}
                        </div>

                        <!-- CARD 3: OBSERVACIONES Y TÉRMINOS -->
                        <div class="card border rounded-3 shadow-xs mb-4 bg-white" style="border-color: var(--border-color);">
                            <div class="card-header bg-white border-bottom p-3 d-flex align-items-center gap-2">
                                <div class="payment-kpi-icon blue-bg" style="width: 32px; height: 32px; font-size: 15px;">
                                    <i class="bi bi-card-text"></i>
                                </div>
                                <h5 class="mb-0 fw-bold" style="color: var(--text-main); font-size: 15px;">
                                    Observaciones y Términos Comerciales
                                </h5>
                            </div>
                            <div class="card-body p-3 p-md-4">
                                <div class="row g-3">
                                    <div class="col-12 col-md-6">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Notas y Observaciones (Visibles en la Factura)</label>
                                        <textarea id="input-notas" class="form-control text-dark" rows="3" style="font-size: 13px; border-radius: 8px; resize: none;" placeholder="Instrucciones de entrega, comentarios de despacho..." ${isViewOnly ? 'disabled' : ''}>${escapeHtml(factura.notas)}</textarea>
                                    </div>
                                    <div class="col-12 col-md-6">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Términos y Condiciones Legales</label>
                                        <textarea id="input-terminos" class="form-control text-dark" rows="3" style="font-size: 13px; border-radius: 8px; resize: none;" placeholder="Cuentas bancarias para el pago, condiciones de mora..." ${isViewOnly ? 'disabled' : ''}>${escapeHtml(factura.terminosCondiciones)}</textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- DOCUMENTOS RELACIONADOS (Solo Vista) -->
                        ${isViewOnly ? `
                        <div class="card border rounded-3 shadow-xs mb-4 bg-white" style="border-color: var(--border-color);">
                            <div class="card-header bg-white border-bottom p-3">
                                <ul class="nav nav-tabs border-0" role="tablist">
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link active fw-bold text-dark border-0 border-bottom border-primary border-2" data-bs-toggle="tab" data-bs-target="#tab-pagos" type="button" role="tab" style="font-size: 13px;">Pagos Recibidos</button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link text-muted border-0" data-bs-toggle="tab" data-bs-target="#tab-notas-credito" type="button" role="tab" style="font-size: 13px;">Notas de Crédito</button>
                                    </li>
                                    ${factura.cotizacion_origen_id ? `
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link text-muted border-0" data-bs-toggle="tab" data-bs-target="#tab-cotizacion" type="button" role="tab" style="font-size: 13px;">Cotización Origen</button>
                                    </li>` : ''}
                                </ul>
                            </div>
                            <div class="card-body p-0">
                                <div class="tab-content">
                                    <div class="tab-pane fade show active p-3" id="tab-pagos" role="tabpanel">
                                        <div class="table-responsive">
                                            <table class="table table-sm align-middle mb-0" style="font-size: 13px;">
                                                <thead>
                                                    <tr class="text-muted" style="border-bottom: 1px solid var(--border-color);">
                                                        <th class="fw-medium pb-2">Fecha</th>
                                                        <th class="fw-medium pb-2">Cuenta</th>
                                                        <th class="fw-medium pb-2">Método</th>
                                                        <th class="fw-medium pb-2 text-end">Monto</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${(transacciones && transacciones.length > 0) ? transacciones.map((p, idx) => `
                                                    <tr class="fila-pago" data-index="${idx}" style="border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'">
                                                        <td class="py-2 text-muted">${p.fecha || p.created_at?.split('T')[0] || ''}</td>
                                                        <td class="py-2">${cuentasMap[p.cuentaId || p.cuenta_id] || (p.cuentaId || p.cuenta_id || '-')}</td>
                                                        <td class="py-2">${p.metodo_pago || p.metodoPago || '-'}</td>
                                                        <td class="py-2 text-end fw-medium tnum text-success">$${Number(p.monto || p.valor || 0).toLocaleString()}</td>
                                                    </tr>`).join('') : `
                                                    <tr><td colspan="4" class="text-muted text-center py-4">No hay pagos registrados para esta factura</td></tr>
                                                    `}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    
                                    <div class="tab-pane fade p-3" id="tab-notas-credito" role="tabpanel">
                                        <div class="table-responsive">
                                            <table class="table table-sm align-middle mb-0" style="font-size: 13px;">
                                                <thead>
                                                    <tr class="text-muted" style="border-bottom: 1px solid var(--border-color);">
                                                        <th class="fw-medium pb-2">Fecha</th>
                                                        <th class="fw-medium pb-2">Número NC</th>
                                                        <th class="fw-medium pb-2">Motivo</th>
                                                        <th class="fw-medium pb-2 text-center">Estado</th>
                                                        <th class="fw-medium pb-2 text-end">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${(notasCredito && notasCredito.length > 0) ? notasCredito.map(nc => `
                                                    <tr style="border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'" onclick="window.location.hash='#/ingresos/notas-credito/ver/${nc.id}'">
                                                        <td class="py-2 text-muted">${nc.fecha || ''}</td>
                                                        <td class="py-2 fw-semibold">NC-${nc.numero || nc.id}</td>
                                                        <td class="py-2">${escapeHtml(nc.motivo) || '-'}</td>
                                                        <td class="py-2 text-center">${EstadoUtils.estaAnulado(nc.estado) ? '<span class="text-danger fw-bold">Anulada</span>' : '<span class="text-success fw-bold">Activa</span>'}</td>
                                                        <td class="py-2 text-end fw-medium tnum">$${Number(nc.total || 0).toLocaleString()}</td>
                                                    </tr>`).join('') : `
                                                    <tr><td colspan="5" class="text-muted text-center py-4">No hay notas de crédito registradas</td></tr>
                                                    `}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    ${factura.cotizacion_origen_id ? `
                                    <div class="tab-pane fade p-3" id="tab-cotizacion" role="tabpanel">
                                        <div class="card border shadow-xs" style="max-width:320px; cursor:pointer; border-radius: 10px;" onclick="sessionStorage.setItem('origenVolver', JSON.stringify({hash: '#/ingresos/facturas/ver/${factura.id}', label: 'Volver a la factura'})); window.location.hash='#/ingresos/cotizaciones/ver/${factura.cotizacion_origen_id}'">
                                            <div class="card-body p-3 d-flex justify-content-between align-items-center">
                                                <div>
                                                    <small class="text-muted d-block" style="font-size: 11px;">Documento comercial origen</small>
                                                    <span class="fw-bold text-primary" style="font-size: 14px;">Cotización Origen</span>
                                                </div>
                                                <i class="bi bi-box-arrow-up-right text-primary"></i>
                                            </div>
                                        </div>
                                    </div>` : ''}
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
                                    <div class="payment-kpi-icon in-bg" style="width: 32px; height: 32px; font-size: 15px;">
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
                                        <span class="fw-bold text-dark" style="font-size: 16px;">Total Factura</span>
                                        <span class="fw-bold text-success tnum fs-4" id="tot-total" data-raw-total="0">$0,00</span>
                                    </div>
                                    <div class="p-2 rounded-2 bg-light text-muted mb-3" style="font-size: 11px; font-style: italic;" id="tot-letras">
                                        Cero Pesos M/CTE.
                                    </div>

                                    ${!isViewOnly ? `
                                    <div class="d-grid gap-2 pt-2">
                                        <button id="btn-guardar" type="button" class="btn btn-primary-action py-2 d-flex align-items-center justify-content-center gap-2 shadow-xs" style="font-weight: 600; border-radius: 8px;">
                                            <i class="bi bi-check-circle"></i> Emitir Factura de Venta
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
            // Pasamos 'factura' en vez de 'cotizacion' para que evite renderizar "Convertir a Factura"
            CoreActions.bindActionEvents(element, factura, 'factura', {});
            
            element.querySelectorAll('.fila-pago').forEach(row => {
                row.addEventListener('click', () => {
                    const idx = parseInt(row.dataset.index, 10);
                    if (!isNaN(idx) && transacciones && transacciones[idx]) {
                        mostrarDetalleTransaccion(transacciones[idx], () => {
                            this.renderForm(element, id, isViewOnly);
                        });
                    }
                });
            });
        }

        // ==========================================
        // LÓGICA DE INTERACCIÓN (ENGINE DOM)
        // ==========================================

        const tbody = element.querySelector('#tbody-detalles');
        let contadorLineas = 0;

        // Renderizador de fila dinámica
        const addRow = (detalle) => {
            contadorLineas++;
            return ItemEngine.addRow({
                detalle,
                tbody,
                isViewOnly,
                productosFactura,
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

        // Motor Matemático (Dynamic Pricing & Totals & 4 KPIs Reactivas)
        const calcEngine = () => {
            ItemEngine.calcEngine({
                tbody,
                element,
                factura
            });

            // Reactividad en 4 KPI Cards
            const rawTotal = parseFloat(element.querySelector('#tot-total')?.dataset.rawTotal || factura.total || 0);
            const kpiTotal = element.querySelector('#kpi-fac-total');
            if (kpiTotal) kpiTotal.textContent = formatMoney(rawTotal);

            // Monto en letras
            const elLetras = element.querySelector('#tot-letras');
            if (elLetras) {
                import('../../shared/numeroALetras.js').then(nl => {
                    elLetras.textContent = nl.numeroALetras(rawTotal);
                });
            }

            // Semáforo de Inventario FIFO reactivo
            const formRows = Array.from(tbody.querySelectorAll('tr'));
            let stockInsuficiente = false;
            let unidadesFaltantes = 0;

            formRows.forEach(tr => {
                const qty = parseFloat(tr.querySelector('.input-qty')?.value || 0);
                const metaQty = tr.querySelector('.meta-qty');
                const dispMatch = metaQty?.textContent?.match(/Disp:\s*([0-9.]+)/);
                if (dispMatch) {
                    const disp = parseFloat(dispMatch[1]) || 0;
                    if (qty > disp) {
                        stockInsuficiente = true;
                        unidadesFaltantes += (qty - disp);
                    }
                }
            });

            const kpiStock = element.querySelector('#kpi-fac-stock');
            const kpiStockDesc = element.querySelector('#kpi-fac-stock-desc');
            const kpiStockIcon = element.querySelector('#kpi-fac-stock-icon');
            if (kpiStock) {
                if (stockInsuficiente) {
                    kpiStock.textContent = 'Insuficiente';
                    kpiStock.className = 'payment-kpi-value fw-bold text-danger';
                    if (kpiStockDesc) kpiStockDesc.textContent = `Faltan ${unidadesFaltantes} unds en stock`;
                    if (kpiStockIcon) {
                        kpiStockIcon.className = 'payment-kpi-icon out-bg';
                        kpiStockIcon.innerHTML = '<i class="bi bi-exclamation-triangle text-danger"></i>';
                    }
                } else {
                    kpiStock.textContent = 'Disponible';
                    kpiStock.className = 'payment-kpi-value fw-bold text-success';
                    if (kpiStockDesc) kpiStockDesc.textContent = 'Existencias verificadas en almacén';
                    if (kpiStockIcon) {
                        kpiStockIcon.className = 'payment-kpi-icon in-bg';
                        kpiStockIcon.innerHTML = '<i class="bi bi-check-circle text-success"></i>';
                    }
                }
            }
        };

        // Función Helper: Cálculo de Fecha de Vencimiento
        const calcularVencimiento = (cliente) => {
            const plazos = parseInt(cliente.plazosPago || cliente.plazo || 0);
            const inputVencimiento = element.querySelector('#input-vencimiento');
            if (plazos > 0) {
                const fechaCreacion = new Date(element.querySelector('#input-fecha').value + 'T12:00:00');
                fechaCreacion.setDate(fechaCreacion.getDate() + plazos);
                if (inputVencimiento) inputVencimiento.value = getLocalDate(fechaCreacion);
            } else {
                if (inputVencimiento && !inputVencimiento.value) {
                    const fechaCreacion = new Date(element.querySelector('#input-fecha').value + 'T12:00:00');
                    fechaCreacion.setDate(fechaCreacion.getDate() + 30);
                    inputVencimiento.value = getLocalDate(fechaCreacion);
                }
            }
            actualizarCondicionVenta();
        };

        // Consulta reactiva de cartera de cliente
        const actualizarCarteraCliente = async (contactoId) => {
            const kpiVal = element.querySelector('#kpi-fac-cartera');
            const kpiDesc = element.querySelector('#kpi-fac-cartera-desc');
            const kpiIcon = element.querySelector('#kpi-fac-cartera-icon');
            if (!kpiVal) return;

            if (!contactoId) {
                kpiVal.textContent = '$0,00';
                kpiVal.className = 'payment-kpi-value fw-bold text-dark tnum';
                if (kpiDesc) kpiDesc.textContent = 'Seleccione cliente para ver cartera';
                if (kpiIcon) {
                    kpiIcon.className = 'payment-kpi-icon blue-bg';
                    kpiIcon.innerHTML = '<i class="bi bi-clock-history"></i>';
                }
                return;
            }

            try {
                const { data, error } = await supabase.rpc('get_cartera_con_saldos', {
                    p_tipo_cartera: 'cxc',
                    p_contacto_id: String(contactoId)
                });
                // Salvaguarda contra condición de carrera: ignorar si el usuario cambió de cliente
                const currentClienteId = element.querySelector('#select-cliente')?.value;
                if (currentClienteId && String(currentClienteId) !== String(contactoId)) {
                    return;
                }
                if (!error && Array.isArray(data)) {
                    const deuda = data.reduce((sum, f) => sum + Number(f.saldo || 0), 0);
                    if (deuda > 0) {
                        kpiVal.textContent = formatMoney(deuda);
                        kpiVal.className = 'payment-kpi-value fw-bold text-danger tnum';
                        if (kpiDesc) kpiDesc.textContent = `${data.length} ${data.length === 1 ? 'factura pendiente' : 'facturas con saldo'}`;
                        if (kpiIcon) {
                            kpiIcon.className = 'payment-kpi-icon out-bg';
                            kpiIcon.innerHTML = '<i class="bi bi-exclamation-circle text-danger"></i>';
                        }
                    } else {
                        kpiVal.textContent = '$0,00';
                        kpiVal.className = 'payment-kpi-value fw-bold text-success tnum';
                        if (kpiDesc) kpiDesc.textContent = 'Cliente al día sin mora';
                        if (kpiIcon) {
                            kpiIcon.className = 'payment-kpi-icon in-bg';
                            kpiIcon.innerHTML = '<i class="bi bi-check2-circle text-success"></i>';
                        }
                    }
                }
            } catch (e) {
                console.warn("No se pudo cargar cartera de cliente:", e);
            }
        };

        // Actualizar visualmente la condición de venta (Contado vs Crédito)
        const actualizarCondicionVenta = () => {
            const selectTipo = element.querySelector('#select-tipo-venta');
            const kpiCond = element.querySelector('#kpi-fac-condicion');
            const kpiCondDesc = element.querySelector('#kpi-fac-condicion-desc');
            const kpiCondIcon = element.querySelector('#kpi-fac-condicion-icon');
            const containerCuenta = element.querySelector('#container-cuenta-venta');
            const btnGroupPlazos = element.querySelector('#btn-group-plazos');

            const esContado = selectTipo?.value === 'contado';
            if (containerCuenta) containerCuenta.style.display = esContado ? 'block' : 'none';
            if (btnGroupPlazos) btnGroupPlazos.style.display = esContado ? 'none' : 'flex';

            if (kpiCond) {
                kpiCond.textContent = esContado ? 'De Contado' : 'A Crédito';
            }
            if (kpiCondDesc) {
                if (esContado) {
                    const selectCuenta = element.querySelector('#select-cuenta-venta');
                    const selectedText = selectCuenta?.options[selectCuenta.selectedIndex]?.text;
                    kpiCondDesc.textContent = selectedText ? `Caja: ${selectedText}` : 'Ingreso directo a caja/banco';
                } else {
                    const inpVenc = element.querySelector('#input-vencimiento')?.value;
                    kpiCondDesc.textContent = inpVenc ? `Vence: ${inpVenc}` : 'Cuenta por cobrar en cartera';
                }
            }
            if (kpiCondIcon) {
                kpiCondIcon.innerHTML = esContado ? '<i class="bi bi-cash-coin"></i>' : '<i class="bi bi-credit-card"></i>';
            }
        };

        const actualizarBadgeCliente = (c) => {
            const badgeEl = element.querySelector('#cliente-info-badge');
            const textEl = element.querySelector('#cliente-info-text');
            if (!badgeEl) return;
            if (c) {
                badgeEl.style.display = 'flex';
                const av = getClientAvatar(c.nombre || 'Cliente');
                const avatarEl = badgeEl.querySelector('.badge-avatar');
                if (avatarEl) {
                    avatarEl.style.backgroundColor = av.bg;
                    avatarEl.style.color = av.color;
                    avatarEl.textContent = av.initials || 'CL';
                }
                if (textEl) {
                    textEl.innerHTML = `
                        ${c.nit ? `NIT/CC: <strong>${escapeHtml(c.nit)}</strong>` : 'Cliente Registrado'}
                        ${c.telefono ? ` · Tel: ${escapeHtml(c.telefono)}` : ''}
                    `;
                }
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
            window.location.hash = '#/ingresos/facturas';
        });

        // Botones rápidos de incremento de días (+15d, +30d, +60d)
        element.querySelectorAll('.btn-set-dias-fac').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dias = parseInt(e.currentTarget.dataset.dias, 10);
                const fCreacion = element.querySelector('#input-fecha')?.value;
                if (fCreacion && dias > 0) {
                    const d = new Date(fCreacion + 'T12:00:00');
                    d.setDate(d.getDate() + dias);
                    const inpVenc = element.querySelector('#input-vencimiento');
                    if (inpVenc) {
                        inpVenc.value = getLocalDate(d);
                        actualizarCondicionVenta();
                    }
                }
            });
        });

        // Escuchadores de cambio en fechas y tipo de venta
        element.querySelector('#input-fecha')?.addEventListener('change', () => {
            actualizarCondicionVenta();
            calcEngine();
        });
        element.querySelector('#input-vencimiento')?.addEventListener('change', () => {
            actualizarCondicionVenta();
        });
        element.querySelector('#select-tipo-venta')?.addEventListener('change', () => {
            actualizarCondicionVenta();
        });
        element.querySelector('#select-cuenta-venta')?.addEventListener('change', () => {
            actualizarCondicionVenta();
        });

        // Inicialización de Combobox de Clientes y Cálculo de Vencimiento Automatizado
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
                    actualizarCarteraCliente(selectedItem.id);
                    ItemEngine.actualizarPreciosMercadoLibreEnTabla(tbody, calcEngine);
                    const selectVendedor = element.querySelector('#select-vendedor');
                    if (selectVendedor && selectedItem.vendedor_id) {
                        selectVendedor.value = selectedItem.vendedor_id;
                    }
                },
                onCreate: (query) => {
                    ContactosModule.renderQuickModal(query, (nuevoContacto) => {
                        // Al guardar exitosamente, lo autoseleccionamos
                        element.querySelector('#search-cliente').value = nuevoContacto.nombre;
                        const hiddenInput = element.querySelector('#select-cliente');
                        hiddenInput.value = nuevoContacto.id;
                        
                        calcularVencimiento(nuevoContacto);
                        actualizarBadgeCliente(nuevoContacto);
                        actualizarCarteraCliente(nuevoContacto.id);
                        ItemEngine.actualizarPreciosMercadoLibreEnTabla(tbody, calcEngine);
                        
                        const selectVendedor = element.querySelector('#select-vendedor');
                        if (selectVendedor && nuevoContacto.vendedor_id) {
                            selectVendedor.value = nuevoContacto.vendedor_id;
                        }
                    });
                }
            });
        }

        // Configuración de Numeración (Engranaje)
        element.querySelector('#btn-config-num')?.addEventListener('click', () => {
            NumberingManager.openNumberingModal('factura', factura, (prefijo, numero) => {
                element.querySelector('#lbl-numero').innerHTML = `No. <strong style="color: var(--text-main);">${numero}</strong>`;
            });
        });

        // Eventos Agregar Línea (Superior, Inferior y Lotes)
        const handleAddLine = (count = 1) => {
            let lastTr = null;
            let firstNewTr = null;
            for (let i = 0; i < count; i++) {
                const tr = addRow({ id: Date.now() + i + Math.random(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 });
                if (!firstNewTr) firstNewTr = tr;
                lastTr = tr;
            }
            calcEngine();
            if (lastTr) {
                lastTr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                const targetTr = count === 1 ? lastTr : firstNewTr;
                setTimeout(() => {
                    targetTr?.querySelector('.input-prod-search')?.focus();
                }, 50);
            }
        };

        element.querySelector('#btn-agregar-linea')?.addEventListener('click', () => handleAddLine(1));
        element.querySelector('#btn-agregar-linea-abajo')?.addEventListener('click', () => handleAddLine(1));
        element.querySelector('#btn-agregar-5-lineas')?.addEventListener('click', () => handleAddLine(5));
        element.querySelector('#btn-agregar-10-lineas')?.addEventListener('click', () => handleAddLine(10));

        // Evento Cancelar
        element.querySelector('#btn-cancelar')?.addEventListener('click', () => {
            window.hayCambiosSinGuardar = false;
            window.location.hash = '#/ingresos/facturas';
        });

        // Inicialización de estado si ya hay cliente
        if (factura.clienteId) {
            actualizarCarteraCliente(factura.clienteId);
            if (cliDataResult?.data) {
                actualizarBadgeCliente(cliDataResult.data);
            }
        }
        actualizarCondicionVenta();

        // Evento Imprimir Global (Acción Superior)
        element.querySelector('.btn-imprimir')?.addEventListener('click', (e) => {
            if (!isViewOnly) {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
                CoreActions.showWarningModal("Primero debes guardar o finalizar la factura para poder generar su formato de impresión oficial.");
                if (window._ventasPrintBtnTimeout) clearTimeout(window._ventasPrintBtnTimeout);
                window._ventasPrintBtnTimeout = setTimeout(() => {
                    if (document.body.contains(e.currentTarget)) {
                        e.currentTarget.style.borderColor = '';
                        e.currentTarget.style.color = '';
                    }
                }, 3000);
                return;
            }
            PrintManager.printDocument(factura, 'Factura de venta', contactos, productosFactura);
        });

        // Evento Vista Previa Global (Acción Superior)
        element.querySelector('.btn-vista-previa')?.addEventListener('click', (e) => {
            if (!isViewOnly) {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
                CoreActions.showWarningModal("Primero debes guardar o finalizar la factura para poder generar su vista previa.");
                if (window._ventasPreviewBtnTimeout) clearTimeout(window._ventasPreviewBtnTimeout);
                window._ventasPreviewBtnTimeout = setTimeout(() => {
                    if (document.body.contains(e.currentTarget)) {
                        e.currentTarget.style.borderColor = '';
                        e.currentTarget.style.color = '';
                    }
                }, 3000);
                return;
            }
            PrintManager.printDocument(factura, 'Factura de venta', contactos, productosFactura, 'preview');
        });

        // Evento Registrar Pago (Acción Superior - Solo Vista)
        element.querySelector('.btn-abonar-detalle')?.addEventListener('click', (e) => {
            e.preventDefault();
            const facId = e.currentTarget.dataset.id;
            AbonoModal.show(facId, () => {
                this.renderForm(element, facId, true); // Recargar la vista de detalle para reflejar el pago
            });
        });

        // Evento Editar Global (Acción Superior)
        element.querySelector('.btn-editar')?.addEventListener('click', (e) => {
            const docId = e.currentTarget.dataset.id;
            window.location.hash = `#/ingresos/facturas/editar/${docId}`;
        });

        // Evento Guardar (Captura de Estado DOM a DB)
        element.querySelector('#btn-guardar')?.addEventListener('click', async (e) => {
            const btnGuardar = e.currentTarget;
            if (btnGuardar.disabled) return; // Salvaguarda estricta contra doble clic
            
            const originalText = btnGuardar.innerHTML;
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
            
            const btnCancelar = element.querySelector('#btn-cancelar');
            if (btnCancelar) btnCancelar.disabled = true;
            
            import('../../shared/formatters.js').then(async fmt => {
                const parseP = (v) => fmt.parseCurrencyValue(v);

                try {
                    const clienteId = element.querySelector('#select-cliente').value;
                    if (!clienteId) {
                        const searchInput = element.querySelector('#search-cliente');
                        searchInput.style.borderColor = '#ef4444'; // Resalta en rojo
                        CoreActions.showWarningModal("Debes seleccionar un cliente válido de la lista.");
                        if (window._ventasSearchClientTimeout) clearTimeout(window._ventasSearchClientTimeout);
                        window._ventasSearchClientTimeout = setTimeout(() => {
                            if (document.body.contains(searchInput)) {
                                searchInput.style.borderColor = '';
                            }
                        }, 3000);
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = originalText;
                        return;
                    }

                    const tipoVenta = element.querySelector('#select-tipo-venta').value;
                    const isNew = !id; // Si es nueva factura, descargamos inventario

                    // Recolectar detalles
                    const arrDetalles = Array.from(element.querySelectorAll('#tbody-detalles tr')).map(r => {
                        return {
                            id: r.dataset.uid,
                            productoId: parseInt(r.querySelector('.input-prod-id').value),
                            descripcionPersonalizada: r.querySelector('.input-prod-desc')?.value || '',
                            cantidad: parseFloat(r.querySelector('.input-qty').value) || 0,
                            precio: parseP(r.querySelector('.input-price').value),
                            descuento: parseFloat(r.querySelector('.input-disc').value) || 0,
                            impuesto: parseFloat(r.querySelector('.input-tax').value) || 0
                        };
                    });

                    if (arrDetalles.length === 0 || parseFloat(element.querySelector('#tot-total').dataset.rawTotal) <= 0) {
                        CoreActions.showWarningModal("Debe agregar al menos un producto válido y con cantidad mayor a cero.");
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = originalText;
                        return;
                    }

                    // Descargo FIFO de inventario si es nueva
                    let costoTotalVenta = 0;
                    let planInventario = null;
                    if (isNew) {
                        // Bloqueo de Reprocesamiento si viene de una cotización
                        if (factura.cotizacion_origen_id) {
                            const { data: existe } = await supabase
                                .from('facturas')
                                .select('id, numero')
                                .eq('cotizacion_origen_id', factura.cotizacion_origen_id);
                            
                            if (existe && existe.length > 0) {
                                CoreActions.showWarningModal(`La cotización origen ya fue convertida a la factura [No. ${existe[0].numero || existe[0].id}]. No se puede duplicar.`);
                                btnGuardar.disabled = false;
                                btnGuardar.innerHTML = originalText;
                                return;
                            }
                        }

                        planInventario = await InventarioUtils.calcularSalidaInventario(arrDetalles, null, null);
                        if (!planInventario.success) {
                            CoreActions.showWarningModal(planInventario.error);
                            btnGuardar.disabled = false;
                            btnGuardar.innerHTML = originalText;
                            return; // ABORTA LA VENTA
                        }
                        costoTotalVenta = planInventario.costoTotalVenta;
                        arrDetalles.length = 0;
                        arrDetalles.push(...planInventario.detallesActualizados);
                    } else {
                        costoTotalVenta = factura.total_costo || 0;
                    }

                    factura.total_costo = costoTotalVenta;
                    factura.clienteId = clienteId;
                    factura.tipoVenta = tipoVenta;
                    const vendedorSeleccionado = element.querySelector('#select-vendedor')?.value;
                    factura.vendedor_id = vendedorSeleccionado ? parseInt(vendedorSeleccionado, 10) : null;
                    if (tipoVenta === 'contado') {
                        factura.cuentaId = element.querySelector('#select-cuenta-venta').value;
                    }
                    factura.fecha = element.querySelector('#input-fecha').value;
                    factura.vencimiento = element.querySelector('#input-vencimiento').value || factura.fecha;
                    factura.notas = element.querySelector('#input-notas').value;
                    factura.terminosCondiciones = element.querySelector('#input-terminos').value;
                    factura.detalles = arrDetalles;
                    factura.tipo = 'venta'; // Ensure type is venta
                    
                    const rawTotal = parseFloat(element.querySelector('#tot-total').dataset.rawTotal);
                    factura.total = rawTotal;

                    let facturaGuardadaId = null;
                    
                    if (isNew) {
                        const { data: v_result, error } = await supabase.rpc('crear_venta_directa', {
                            p_factura_header: {
                                fecha: factura.fecha,
                                vencimiento: factura.vencimiento,
                                contacto_id: parseInt(clienteId, 10),
                                total: rawTotal,
                                total_costo: costoTotalVenta,
                                estado: tipoVenta === 'contado' ? 'pagada' : 'por_pagar',
                                observaciones: factura.notas,
                                vendedor_id: factura.vendedor_id
                            },
                            p_factura_detalles: arrDetalles.map(det => {
                                const base = det.cantidad * det.precio;
                                const sub = base - (base * (det.descuento / 100));
                                return {
                                    producto_id: parseInt(det.productoId, 10),
                                    cantidad: det.cantidad,
                                    precio_unitario: det.precio,
                                    descuento_porcentaje: det.descuento,
                                    subtotal: sub,
                                    descripcion_personalizada: det.descripcionPersonalizada || det.descripcion_personalizada || ''
                                };
                            }),
                            p_operaciones_fifo: planInventario.operacionesDB.map(op => ({
                                action: op.action,
                                id: op.action === 'update' ? parseInt(op.data.id, 10) : null,
                                producto_id: parseInt(op.data.productoId, 10),
                                fecha_ingreso: op.data.fechaIngreso,
                                cantidad_actual: parseFloat(op.data.cantidadActual),
                                costo_unitario: parseFloat(op.data.costoUnitario)
                            })),
                            p_origen_documento: 'factura directa venta',
                            p_pago_contado: tipoVenta === 'contado' ? (() => {
                                const ctaObj = cuentasActivas.find(c => String(c.id) === String(factura.cuentaId) || c.nombre === factura.cuentaId);
                                const idCuentaNum = ctaObj ? parseInt(ctaObj.id, 10) : parseInt(factura.cuentaId, 10);
                                return {
                                    fecha: factura.fecha,
                                    monto: rawTotal,
                                    cuenta_id: !isNaN(idCuentaNum) ? idCuentaNum : null
                                };
                            })() : null
                        });

                        if (error) throw new Error("Error al guardar la venta: " + error.message);
                        
                        facturaGuardadaId = v_result.id;
                        factura.id = facturaGuardadaId;
                        
                        if (DB.invalidateCache) {
                            DB.invalidateCache('facturas');
                            DB.invalidateCache('lotes_fifo');
                            if (tipoVenta === 'contado') {
                                DB.invalidateCache('transacciones');
                                DB.invalidateCache('pagos_ingresos');
                            }
                        }
                    } else {
                        // ==== NUEVO CÓDIGO PARA EDICIÓN SEGURA (DELTAS) ====
                        const headerPayload = {
                            total: rawTotal,
                            total_costo: costoTotalVenta,
                            vencimiento: factura.vencimiento,
                            observaciones: factura.notas,
                            contacto_id: parseInt(clienteId, 10),
                            vendedor_id: factura.vendedor_id
                        };

                        const detallesPayload = arrDetalles.map(det => {
                            const base = det.cantidad * det.precio;
                            const sub = base - (base * (det.descuento / 100));
                            return {
                                producto_id: parseInt(det.productoId, 10),
                                cantidad: det.cantidad,
                                precio_unitario: det.precio,
                                descuento_porcentaje: det.descuento,
                                subtotal: sub,
                                descripcion_personalizada: det.descripcionPersonalizada || det.descripcion_personalizada || ''
                            };
                        });

                        // Primer intento sin permitir negativos
                        let { data: updateRes, error: updateErr } = await supabase.rpc('editar_factura_inventario_fifo', {
                            p_factura_id: parseInt(id, 10),
                            p_factura_header: headerPayload,
                            p_nuevos_detalles: detallesPayload,
                            p_origen_movimiento: 'Edición Factura ' + (factura.numero || id),
                            p_permitir_negativos: false
                        });

                        if (updateErr) throw new Error("Error en BD al actualizar: " + updateErr.message);

                        if (!updateRes.success && updateRes.error === 'stock_insuficiente') {
                            const prod = await DB.get('productos', updateRes.producto_id);
                            const nombreProd = prod ? prod.nombre : 'ID ' + updateRes.producto_id;
                            const msg = `Al aumentar la cantidad de ${nombreProd}, no hay stock suficiente para cubrir la diferencia (Faltan: ${updateRes.cantidad_pedida - updateRes.stock_disponible}).\n¿Deseas continuar y registrar el faltante como inventario negativo?`;
                            
                            let confirmado = false;
                            if (window.CoreActions && window.CoreActions.showConfirmModalAsync) {
                                confirmado = await window.CoreActions.showConfirmModalAsync(msg);
                            } else {
                                confirmado = confirm(msg);
                            }
                            
                            if (!confirmado) {
                                btnGuardar.disabled = false;
                                btnGuardar.innerHTML = originalText;
                                return; // Abortar
                            }

                            const { data: retryRes, error: retryErr } = await supabase.rpc('editar_factura_inventario_fifo', {
                                p_factura_id: parseInt(id, 10),
                                p_factura_header: headerPayload,
                                p_nuevos_detalles: detallesPayload,
                                p_origen_movimiento: 'Edición Factura ' + (factura.numero || id),
                                p_permitir_negativos: true
                            });

                            if (retryErr) throw new Error("Error en BD al actualizar: " + retryErr.message);
                            updateRes = retryRes;
                        }

                        // Sincronizar el costo final recalculado atómicamente por la BD
                        if (updateRes && updateRes.total_costo !== undefined) {
                            factura.total_costo = updateRes.total_costo;
                        }

                        // Factura y detalles ya actualizados atómicamente por editar_factura_inventario_fifo
                        facturaGuardadaId = factura.id;
                        
                        if (DB.invalidateCache) {
                            DB.invalidateCache('facturas');
                            DB.invalidateCache('lotes_fifo');
                        }
                    }
                    
                    // Navegar a modo lectura para bloquear edición y habilitar impresión final
                    window.hayCambiosSinGuardar = false;
                    window.location.hash = `#/ingresos/facturas/ver/${factura.id}`;
                } catch (error) {
                    console.error("Fallo general de guardado:", error);
                    alert("Error en el sistema al guardar: " + error.message);
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = originalText;
                } finally {
                    if (btnCancelar) btnCancelar.disabled = false;
                }
            });
        });

        // Inicializar UI
        factura.detalles.forEach(det => addRow(det));
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
