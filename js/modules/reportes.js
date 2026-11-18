import DB, { getLocalDate } from '../core/db.js';
import { supabase } from '../core/supabase.js';
import { CoreActions } from '../shared/crud.js';
import { PrintManager } from '../shared/printManager.js?v=20';
import { escapeHtml, getClientAvatar } from '../shared/formatters.js';

export default {
    async init(element) {
        if (!element) return;

        // Estado del Módulo
        let activeTab = 'ventas_utilidad'; // 'ventas_utilidad', 'cartera_wpp', 'gastos', 'inventario'
        let activeView = 'tabla'; // 'tabla' o 'grafico'
        let datePreset = 'este_mes'; // 'hoy', 'este_mes', 'mes_anterior', 'ultimos_30', 'este_ano', 'personalizado'
        
        // Inicializar fechas por defecto (Este Mes)
        const computeDates = (preset) => {
            const now = new Date();
            let start = new Date(now.getFullYear(), now.getMonth(), 1);
            let end = now;

            if (preset === 'hoy') {
                start = now;
                end = now;
            } else if (preset === 'mes_anterior') {
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
            } else if (preset === 'ultimos_30') {
                start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
                end = now;
            } else if (preset === 'este_ano') {
                start = new Date(now.getFullYear(), 0, 1);
                end = now;
            }
            return {
                inicio: getLocalDate(start),
                fin: getLocalDate(end)
            };
        };

        let { inicio: fechaInicio, fin: fechaFin } = computeDates(datePreset);

        // Variables de datos y paginación
        let searchQuery = '';
        let subFiltroCartera = 'todos'; // 'todos', 'vencidas', 'al_dia'
        let currentPage = 1;
        let itemsPerPage = 15;
        let currentRawData = [];
        let filteredItems = [];

        // Instancias de Chart.js
        let chartInstanceA = null;
        let chartInstanceB = null;

        const formatMoney = (val) => '$ ' + Math.round(Number(val) || 0).toLocaleString('es-CO');

        // 1. INYECTAR SHELL PRINCIPAL
        element.innerHTML = `
            <div class="dash-layout p-4" style="max-width: 1200px; margin: 0 auto;">
                
                <!-- TOP BAR DE ALTO IMPACTO -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <a href="#" onclick="event.preventDefault(); window.history.length > 2 ? window.history.back() : window.location.hash = '#/dashboard';" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body); border-radius: 8px;">
                                <i class="bi bi-arrow-left"></i>
                            </a>
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Reportes & Analítica</h2>
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2.5 py-1 fw-semibold" style="font-size: 11px;">
                                Inteligencia Financiera
                            </span>
                        </div>
                        <p class="text-muted mb-0 mt-1" style="font-size: 13px;">
                            Monitoreo de rentabilidad, márgenes FIFO, cobranza activa por WhatsApp y control operativo.
                        </p>
                    </div>

                    <!-- ACCIONES TOP BAR -->
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <div class="btn-group p-1 bg-light rounded-3 border" role="group">
                            <button type="button" class="btn btn-sm btn-white bg-white shadow-xs fw-bold text-dark" id="btn-view-tabla" style="border-radius: 6px; font-size: 12.5px;">
                                <i class="bi bi-table me-1.5"></i> Tabla
                            </button>
                            <button type="button" class="btn btn-sm btn-light border-0 text-muted" id="btn-view-grafico" style="border-radius: 6px; font-size: 12.5px;">
                                <i class="bi bi-pie-chart-fill me-1.5"></i> Analítica
                            </button>
                        </div>

                        <button id="btn-export-reporte" class="btn btn-light bg-white border d-flex align-items-center gap-2 text-dark shadow-xs" style="font-size: 13px; font-weight: 600; border-radius: 8px; height: 38px;">
                            <i class="bi bi-file-earmark-excel text-success fs-6"></i>
                            <span>Exportar Excel</span>
                        </button>

                        <button id="btn-refresh-reporte" class="btn btn-light bg-white border text-secondary shadow-xs" title="Actualizar datos" style="height: 38px; width: 38px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                </div>

                <!-- SELECTOR DE RANGO TEMPORAL RÁPIDO -->
                <div class="card border-0 shadow-xs mb-4 p-3 bg-white" style="border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <span class="text-muted fw-bold text-uppercase" style="font-size: 11px; letter-spacing: 0.5px;">
                                <i class="bi bi-calendar3 me-1 text-primary"></i> Período:
                            </span>
                            <div class="btn-group btn-group-sm" role="group" id="group-date-presets">
                                <button type="button" class="btn btn-outline-secondary btn-date-preset ${datePreset === 'este_mes' ? 'active' : ''}" data-preset="este_mes" style="font-size: 12px;">Este Mes</button>
                                <button type="button" class="btn btn-outline-secondary btn-date-preset ${datePreset === 'mes_anterior' ? 'active' : ''}" data-preset="mes_anterior" style="font-size: 12px;">Mes Anterior</button>
                                <button type="button" class="btn btn-outline-secondary btn-date-preset ${datePreset === 'ultimos_30' ? 'active' : ''}" data-preset="ultimos_30" style="font-size: 12px;">Últimos 30 días</button>
                                <button type="button" class="btn btn-outline-secondary btn-date-preset ${datePreset === 'este_ano' ? 'active' : ''}" data-preset="este_ano" style="font-size: 12px;">Este Año</button>
                                <button type="button" class="btn btn-outline-secondary btn-date-preset ${datePreset === 'personalizado' ? 'active' : ''}" data-preset="personalizado" style="font-size: 12px;">Personalizado</button>
                            </div>
                        </div>

                        <div class="d-flex align-items-center gap-2" id="custom-date-container" style="display: flex;">
                            <div class="input-group input-group-sm" style="width: auto;">
                                <span class="input-group-text bg-light text-muted border-end-0" style="font-size: 11px;">Desde</span>
                                <input type="date" id="input-date-inicio" class="form-control form-control-sm border-start-0" value="${fechaInicio}" style="font-size: 12px; width: 130px;">
                            </div>
                            <div class="input-group input-group-sm" style="width: auto;">
                                <span class="input-group-text bg-light text-muted border-end-0" style="font-size: 11px;">Hasta</span>
                                <input type="date" id="input-date-fin" class="form-control form-control-sm border-start-0" value="${fechaFin}" style="font-size: 12px; width: 130px;">
                            </div>
                            <button class="btn btn-sm btn-primary px-3 fw-semibold" id="btn-apply-dates" style="border-radius: 6px; font-size: 12px;">
                                Filtrar
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 4 TARJETAS KPI DINÁMICAS -->
                <div class="row g-3 mb-4" id="reportes-kpis-container">
                    <!-- Se inyecta dinámicamente según la pestaña activa -->
                </div>

                <!-- PESTAÑAS DE NAVEGACIÓN DE REPORTES -->
                <div class="payment-tabs mb-4 overflow-auto">
                    <button class="payment-tab-btn active" data-tab="ventas_utilidad">
                        <i class="bi bi-graph-up-arrow me-1.5 text-primary"></i> Ventas & Rentabilidad (FIFO)
                    </button>
                    <button class="payment-tab-btn" data-tab="cartera_wpp">
                        <i class="bi bi-whatsapp me-1.5 text-success"></i> Cartera & Cobranza WhatsApp
                    </button>
                    <button class="payment-tab-btn" data-tab="gastos">
                        <i class="bi bi-cash-stack me-1.5 text-danger"></i> Gastos y Egresos Operativos
                    </button>
                    <button class="payment-tab-btn" data-tab="inventario">
                        <i class="bi bi-box-seam me-1.5 text-warning"></i> Inventario Valorizado
                    </button>
                </div>

                <!-- CONTENEDOR PRINCIPAL: TABLA O ANALÍTICA -->
                <div class="card border-0 shadow-xs mb-4 position-relative" style="border-radius: 12px; border: 1px solid #e2e8f0; background: #fff;">
                    <!-- Loading Spinner Overlay -->
                    <div id="reportes-loading-overlay" class="position-absolute top-0 start-0 w-100 h-100 justify-content-center align-items-center bg-white bg-opacity-75" style="z-index: 20; display: none !important; border-radius: 12px;">
                        <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando reporte...</span></div>
                    </div>

                    <!-- VISTA TABLA -->
                    <div id="reportes-table-view-container" class="p-3 p-md-4">
                        <!-- Barra de Búsqueda y Sub-Filtros -->
                        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3" id="table-toolbar">
                            <div class="d-flex align-items-center gap-2 flex-grow-1" style="max-width: 400px;">
                                <div class="input-group">
                                    <span class="input-group-text bg-white border-end-0 text-muted" style="border-radius: 8px 0 0 8px;">
                                        <i class="bi bi-search"></i>
                                    </span>
                                    <input type="text" id="searchReporte" class="form-control border-start-0 ps-0" placeholder="Buscar en el reporte..." style="border-radius: 0 8px 8px 0; font-size: 13px; height: 38px;">
                                </div>
                            </div>

                            <div class="d-flex align-items-center gap-2" id="sub-filters-container">
                                <!-- Inyectado según la pestaña (e.g. filtros de mora en cartera) -->
                            </div>
                        </div>

                        <!-- Data Grid -->
                        <div class="table-responsive" id="reportes-grid-container">
                            <!-- Inyectado por renderGrid -->
                        </div>

                        <!-- Paginación y Resumen -->
                        <div class="d-flex flex-column flex-sm-row justify-content-between align-items-center mt-3 pt-3 border-top gap-3" id="reportes-pagination-container">
                            <!-- Inyectado dinámicamente -->
                        </div>
                    </div>

                    <!-- VISTA ANALÍTICA (CHART.JS) -->
                    <div id="reportes-analytics-container" class="p-3 p-md-4" style="display: none;">
                        <!-- Inyectado dinámicamente por renderAnalyticsView -->
                    </div>
                </div>

                <!-- SLIDE-OVER DRAWER PARA DETALLE DE CLIENTE / FACTURAS -->
                <div id="reporte-drawer-backdrop" class="modal-backdrop fade" style="display: none; z-index: 1040;"></div>
                <div id="reporte-drawer" class="position-fixed top-0 end-0 h-100 bg-white shadow-lg" style="width: 100%; max-width: 580px; z-index: 1050; transform: translateX(100%); transition: transform 0.28s ease-in-out; display: flex; flex-direction: column;">
                    <div class="p-3 px-4 border-bottom d-flex align-items-center justify-content-between bg-light">
                        <div class="d-flex align-items-center gap-2">
                            <div class="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                <i class="bi bi-journal-text fs-6"></i>
                            </div>
                            <h5 class="mb-0 fw-bold text-dark" style="font-size: 16px;" id="drawer-title">Detalle de Operación</h5>
                        </div>
                        <button type="button" class="btn-close" id="btn-reporte-drawer-close"></button>
                    </div>

                    <div class="p-4 overflow-auto flex-grow-1" id="reporte-drawer-body">
                        <!-- Inyectado al hacer clic -->
                    </div>

                    <div class="p-3 px-4 border-top bg-light d-flex justify-content-between align-items-center" id="reporte-drawer-footer">
                        <button class="btn btn-sm btn-light border" id="btn-reporte-drawer-close-bottom">Cerrar</button>
                        <div class="d-flex gap-2" id="drawer-actions-container"></div>
                    </div>
                </div>

            </div>
        `;

        // 2. MÉTODOS DE CONSULTA Y CÁLCULO
        const loadReportData = async () => {
            const overlay = element.querySelector('#reportes-loading-overlay');
            if (overlay) overlay.style.setProperty('display', 'flex', 'important');

            try {
                if (activeTab === 'ventas_utilidad') {
                    const { data, error } = await supabase.rpc('get_reporte_ventas_utilidad', {
                        p_fecha_inicio: fechaInicio,
                        p_fecha_fin: fechaFin
                    });
                    if (error) throw error;
                    currentRawData = data || [];
                } else if (activeTab === 'cartera_wpp') {
                    const [carteraRes, contactos] = await Promise.all([
                        supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxc' }),
                        DB.getAll('contactos')
                    ]);
                    if (carteraRes.error) throw carteraRes.error;

                    const contactosMap = {};
                    (contactos || []).forEach(c => {
                        contactosMap[c.id] = c;
                    });

                    // Agrupar facturas por contacto
                    const clientesMap = {};
                    const hoy = new Date();
                    hoy.setHours(0, 0, 0, 0);

                    (carteraRes.data || []).forEach(f => {
                        const cid = f.contacto_id;
                        if (!clientesMap[cid]) {
                            const cObj = contactosMap[cid] || {};
                            clientesMap[cid] = {
                                id: cid,
                                nombre: cObj.nombre || 'Cliente Genérico / Sin tercero',
                                identificacion: cObj.identificacion || 'N/A',
                                telefono: cObj.telefono || '',
                                email: cObj.email || '',
                                totalSaldo: 0,
                                totalFacturado: 0,
                                facturas: [],
                                maxDiasMora: 0
                            };
                        }

                        const saldoNum = parseFloat(f.saldo) || 0;
                        const totalNum = parseFloat(f.total) || 0;
                        const vDate = new Date(f.vencimiento || f.fecha);
                        const diasMora = Math.max(0, Math.floor((hoy - vDate) / (1000 * 60 * 60 * 24)));

                        clientesMap[cid].totalSaldo += saldoNum;
                        clientesMap[cid].totalFacturado += totalNum;
                        if (diasMora > clientesMap[cid].maxDiasMora) {
                            clientesMap[cid].maxDiasMora = diasMora;
                        }

                        clientesMap[cid].facturas.push({
                            id: f.id,
                            numero: f.numero || f.id,
                            fecha: f.fecha,
                            vencimiento: f.vencimiento || f.fecha,
                            diasMora,
                            total: totalNum,
                            saldo: saldoNum,
                            estado: f.estado
                        });
                    });

                    // Convertir en lista y ordenar por mayor saldo
                    currentRawData = Object.values(clientesMap)
                        .filter(c => c.totalSaldo > 0)
                        .sort((a, b) => b.totalSaldo - a.totalSaldo);

                } else if (activeTab === 'gastos') {
                    const { data, error } = await supabase.rpc('get_reporte_gastos', {
                        p_fecha_inicio: fechaInicio,
                        p_fecha_fin: fechaFin
                    });
                    if (error) throw error;
                    currentRawData = data || [];
                } else if (activeTab === 'inventario') {
                    const { data, error } = await supabase.rpc('get_inventario_valorizado', {
                        p_search: '',
                        p_page: 1,
                        p_limit: 999999,
                        p_export_all: true
                    });
                    if (error) throw error;
                    currentRawData = (data?.items || []).map(i => ({
                        producto: i.nombre || 'Producto Desconocido',
                        sku: i.sku || 'S/R',
                        stock: parseFloat(i.stock_total) || 0,
                        costoPromedio: parseFloat(i.costo_promedio) || 0,
                        valorTotal: parseFloat(i.valor_total) || 0
                    }));
                }

                applyFiltersAndRender();
            } catch (err) {
                console.error("Error cargando reporte:", err);
                CoreActions.showWarningModal("Error al cargar datos del reporte: " + err.message);
                const grid = element.querySelector('#reportes-grid-container');
                if (grid) grid.innerHTML = `<div class="p-5 text-center text-danger">No se pudieron cargar los datos.</div>`;
            } finally {
                if (overlay) overlay.style.setProperty('display', 'none', 'important');
            }
        };

        // 3. APLICAR FILTROS Y RENDERIZAR
        const applyFiltersAndRender = () => {
            let data = [...currentRawData];

            // Filtro de Búsqueda
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (activeTab === 'ventas_utilidad') {
                    data = data.filter(r => 
                        String(r['Documento'] || '').toLowerCase().includes(q) ||
                        String(r['Cliente'] || '').toLowerCase().includes(q) ||
                        String(r['Estado'] || '').toLowerCase().includes(q)
                    );
                } else if (activeTab === 'cartera_wpp') {
                    data = data.filter(c => 
                        c.nombre.toLowerCase().includes(q) ||
                        c.identificacion.toLowerCase().includes(q) ||
                        c.telefono.toLowerCase().includes(q)
                    );
                } else if (activeTab === 'gastos') {
                    data = data.filter(r => 
                        String(r['Concepto/Detalle'] || '').toLowerCase().includes(q) ||
                        String(r['Cuenta de Salida'] || '').toLowerCase().includes(q) ||
                        String(r['Referencia Documento'] || '').toLowerCase().includes(q)
                    );
                } else if (activeTab === 'inventario') {
                    data = data.filter(i => 
                        i.producto.toLowerCase().includes(q) ||
                        i.sku.toLowerCase().includes(q)
                    );
                }
            }

            // Sub-Filtros específicos (ej. Mora en Cartera)
            if (activeTab === 'cartera_wpp') {
                if (subFiltroCartera === 'vencidas') {
                    data = data.filter(c => c.maxDiasMora > 0);
                } else if (subFiltroCartera === 'al_dia') {
                    data = data.filter(c => c.maxDiasMora === 0);
                }
            }

            filteredItems = data;

            renderKPIs();
            renderToolbar();
            if (activeView === 'tabla') {
                renderGrid();
            } else {
                renderAnalyticsView();
            }
        };

        // 4. RENDERIZAR TARJETAS KPI
        const renderKPIs = () => {
            const container = element.querySelector('#reportes-kpis-container');
            if (!container) return;

            if (activeTab === 'ventas_utilidad') {
                const totalVentas = filteredItems.reduce((acc, r) => acc + (Number(r['Total de Venta']) || 0), 0);
                const totalCosto = filteredItems.reduce((acc, r) => acc + (Number(r['Costo de Venta (FIFO)']) || 0), 0);
                const utilidadBruta = filteredItems.reduce((acc, r) => acc + (Number(r['Utilidad Bruta']) || 0), 0);
                const margenPct = totalVentas > 0 ? ((utilidadBruta / totalVentas) * 100).toFixed(1) : 0;
                const totalFacturas = filteredItems.length;

                container.innerHTML = `
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Ventas Totales</span>
                                <div class="dash-icon-box variant-blue" style="width: 32px; height: 32px;"><i class="bi bi-graph-up text-primary"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${formatMoney(totalVentas)}</h3>
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill" style="font-size: 10px;">Facturación bruta</span>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Costo Mercancía (FIFO)</span>
                                <div class="dash-icon-box variant-yellow" style="width: 32px; height: 32px;"><i class="bi bi-box-arrow-in-down text-warning"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${formatMoney(totalCosto)}</h3>
                            <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill" style="font-size: 10px;">Costo real de ventas</span>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3" style="border-left: 3px solid #10b981;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Utilidad Bruta</span>
                                <div class="dash-icon-box variant-green" style="width: 32px; height: 32px;"><i class="bi bi-currency-dollar text-success"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum ${utilidadBruta >= 0 ? 'text-success' : 'text-danger'}" style="font-size: 22px;">${formatMoney(utilidadBruta)}</h3>
                            <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-bold" style="font-size: 10px;">
                                <i class="bi bi-arrow-up-right me-0.5"></i> ${margenPct}% margen
                            </span>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Facturas Emitidas</span>
                                <div class="dash-icon-box variant-purple" style="width: 32px; height: 32px;"><i class="bi bi-receipt text-secondary"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${totalFacturas}</h3>
                            <span class="badge bg-light text-secondary border rounded-pill" style="font-size: 10px;">En el período seleccionado</span>
                        </div>
                    </div>
                `;
            } else if (activeTab === 'cartera_wpp') {
                const totalCartera = filteredItems.reduce((acc, c) => acc + c.totalSaldo, 0);
                const clientesCount = filteredItems.length;
                const carteraVencida = filteredItems.filter(c => c.maxDiasMora > 0).reduce((acc, c) => acc + c.totalSaldo, 0);
                const pctVencido = totalCartera > 0 ? ((carteraVencida / totalCartera) * 100).toFixed(1) : 0;
                const ticketPromedio = clientesCount > 0 ? Math.round(totalCartera / clientesCount) : 0;

                container.innerHTML = `
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3" style="border-left: 3px solid #ef4444;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Cartera Total Pendiente</span>
                                <div class="dash-icon-box variant-red" style="width: 32px; height: 32px;"><i class="bi bi-journal-x text-danger"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-danger" style="font-size: 22px;">${formatMoney(totalCartera)}</h3>
                            <span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill" style="font-size: 10px;">Cuentas por cobrar</span>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Clientes con Deuda</span>
                                <div class="dash-icon-box variant-blue" style="width: 32px; height: 32px;"><i class="bi bi-people text-primary"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${clientesCount}</h3>
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill" style="font-size: 10px;">Deudores únicos</span>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Saldo Vencido (+30d)</span>
                                <div class="dash-icon-box variant-yellow" style="width: 32px; height: 32px;"><i class="bi bi-exclamation-triangle text-warning"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-warning-emphasis" style="font-size: 22px;">${formatMoney(carteraVencida)}</h3>
                            <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill" style="font-size: 10px;">${pctVencido}% morosidad</span>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Promedio por Deudor</span>
                                <div class="dash-icon-box variant-green" style="width: 32px; height: 32px;"><i class="bi bi-wallet2 text-success"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${formatMoney(ticketPromedio)}</h3>
                            <span class="badge bg-light text-secondary border rounded-pill" style="font-size: 10px;">Ticket promedio de saldo</span>
                        </div>
                    </div>
                `;
            } else if (activeTab === 'gastos') {
                const totalGastos = filteredItems.reduce((acc, r) => acc + (Number(r['Monto ($)']) || 0), 0);
                const countGastos = filteredItems.length;
                const gastoMax = filteredItems.reduce((max, r) => Math.max(max, Number(r['Monto ($)']) || 0), 0);
                const promedio = countGastos > 0 ? Math.round(totalGastos / countGastos) : 0;

                container.innerHTML = `
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3" style="border-left: 3px solid #ef4444;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Total Egresos</span>
                                <div class="dash-icon-box variant-red" style="width: 32px; height: 32px;"><i class="bi bi-cash-stack text-danger"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-danger" style="font-size: 22px;">${formatMoney(totalGastos)}</h3>
                            <span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill" style="font-size: 10px;">Gastos pagados</span>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Operaciones</span>
                                <div class="dash-icon-box variant-blue" style="width: 32px; height: 32px;"><i class="bi bi-receipt text-primary"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${countGastos}</h3>
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill" style="font-size: 10px;">Registros de gasto</span>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Mayor Desembolso</span>
                                <div class="dash-icon-box variant-yellow" style="width: 32px; height: 32px;"><i class="bi bi-arrow-up-right-circle text-warning"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${formatMoney(gastoMax)}</h3>
                            <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill" style="font-size: 10px;">Gasto más alto</span>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Gasto Promedio</span>
                                <div class="dash-icon-box variant-purple" style="width: 32px; height: 32px;"><i class="bi bi-calculator text-secondary"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${formatMoney(promedio)}</h3>
                            <span class="badge bg-light text-secondary border rounded-pill" style="font-size: 10px;">Por comprobante</span>
                        </div>
                    </div>
                `;
            } else if (activeTab === 'inventario') {
                const totalValor = filteredItems.reduce((acc, i) => acc + (Number(i.valorTotal) || 0), 0);
                const totalUnits = filteredItems.reduce((acc, i) => acc + (Number(i.stock) || 0), 0);
                const skuCount = filteredItems.length;
                const costoPromedio = totalUnits > 0 ? Math.round(totalValor / totalUnits) : 0;

                container.innerHTML = `
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3" style="border-left: 3px solid #f59e0b;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Valor Total Bodega</span>
                                <div class="dash-icon-box variant-yellow" style="width: 32px; height: 32px;"><i class="bi bi-box-seam text-warning"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${formatMoney(totalValor)}</h3>
                            <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill" style="font-size: 10px;">Costo inventario activo</span>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Referencias / SKUs</span>
                                <div class="dash-icon-box variant-blue" style="width: 32px; height: 32px;"><i class="bi bi-upc-scan text-primary"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${skuCount}</h3>
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill" style="font-size: 10px;">Catálogo activo</span>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Unidades en Existencia</span>
                                <div class="dash-icon-box variant-green" style="width: 32px; height: 32px;"><i class="bi bi-stack text-success"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${Math.round(totalUnits).toLocaleString('es-CO')}</h3>
                            <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill" style="font-size: 10px;">Stock físico total</span>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Costo Promedio Unitario</span>
                                <div class="dash-icon-box variant-purple" style="width: 32px; height: 32px;"><i class="bi bi-tag text-secondary"></i></div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${formatMoney(costoPromedio)}</h3>
                            <span class="badge bg-light text-secondary border rounded-pill" style="font-size: 10px;">Ponderado de stock</span>
                        </div>
                    </div>
                `;
            }
        };

        // 5. RENDERIZAR BARRA DE HERRAMIENTAS SUB-FILTROS
        const renderToolbar = () => {
            const subContainer = element.querySelector('#sub-filters-container');
            if (!subContainer) return;

            if (activeTab === 'cartera_wpp') {
                subContainer.innerHTML = `
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-secondary btn-subfilter-cartera ${subFiltroCartera === 'todos' ? 'active' : ''}" data-sub="todos">Todos</button>
                        <button type="button" class="btn btn-outline-danger btn-subfilter-cartera ${subFiltroCartera === 'vencidas' ? 'active' : ''}" data-sub="vencidas">🚨 Con Mora</button>
                        <button type="button" class="btn btn-outline-success btn-subfilter-cartera ${subFiltroCartera === 'al_dia' ? 'active' : ''}" data-sub="al_dia">🟢 Al día</button>
                    </div>
                `;
                subContainer.querySelectorAll('.btn-subfilter-cartera').forEach(b => {
                    b.addEventListener('click', (e) => {
                        subFiltroCartera = e.target.dataset.sub;
                        currentPage = 1;
                        applyFiltersAndRender();
                    });
                });
            } else {
                subContainer.innerHTML = `
                    <span class="badge bg-light text-secondary border px-2.5 py-1.5" style="font-size: 12px;">
                        ${filteredItems.length} registros encontrados
                    </span>
                `;
            }
        };

        // 6. RENDERIZAR TABLA DE DATOS
        const renderGrid = () => {
            const gridContainer = element.querySelector('#reportes-grid-container');
            const pagContainer = element.querySelector('#reportes-pagination-container');
            if (!gridContainer) return;

            const total = filteredItems.length;
            const totalPages = Math.ceil(total / itemsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;

            const startIdx = (currentPage - 1) * itemsPerPage;
            const pageData = filteredItems.slice(startIdx, startIdx + itemsPerPage);

            if (pageData.length === 0) {
                gridContainer.innerHTML = `
                    <div class="text-center py-5 text-muted">
                        <i class="bi bi-file-earmark-x fs-1 text-secondary opacity-50 mb-2"></i>
                        <h6 class="fw-semibold text-dark">No se encontraron registros</h6>
                        <p class="text-muted mb-0" style="font-size: 13px;">Prueba ajustando el criterio de búsqueda o el rango de fechas.</p>
                    </div>
                `;
                if (pagContainer) pagContainer.innerHTML = '';
                return;
            }

            // A. Pestaña: Ventas vs Costos / Utilidad FIFO
            if (activeTab === 'ventas_utilidad') {
                const totalVentasPagina = pageData.reduce((acc, r) => acc + (Number(r['Total de Venta']) || 0), 0);
                const totalCostoPagina = pageData.reduce((acc, r) => acc + (Number(r['Costo de Venta (FIFO)']) || 0), 0);
                const totalUtilidadPagina = pageData.reduce((acc, r) => acc + (Number(r['Utilidad Bruta']) || 0), 0);

                gridContainer.innerHTML = `
                    <table class="table table-borderless align-middle mb-0">
                        <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                            <tr>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold" style="font-size: 11px; width: 110px;">Documento</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold" style="font-size: 11px; width: 110px;">Fecha</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold" style="font-size: 11px;">Cliente</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end" style="font-size: 11px; width: 130px;">Total Venta</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end" style="font-size: 11px; width: 130px;">Costo FIFO</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end" style="font-size: 11px; width: 140px;">Utilidad Bruta</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-center" style="font-size: 11px; width: 100px;">Margen %</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-center" style="font-size: 11px; width: 100px;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pageData.map(r => {
                                const venta = Number(r['Total de Venta']) || 0;
                                const costo = Number(r['Costo de Venta (FIFO)']) || 0;
                                const utilidad = Number(r['Utilidad Bruta']) || 0;
                                const pct = venta > 0 ? ((utilidad / venta) * 100).toFixed(1) : 0;
                                const avatar = getClientAvatar(r['Cliente']);
                                const isPositive = utilidad >= 0;

                                return `
                                    <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px;">
                                        <td class="py-2.5 px-3">
                                            <span class="payment-code-badge fw-bold" style="font-size: 11px;"># ${escapeHtml(r['Documento'])}</span>
                                        </td>
                                        <td class="py-2.5 px-3 text-muted tnum" style="white-space: nowrap;">
                                            ${r['Fecha'] || '---'}
                                        </td>
                                        <td class="py-2.5 px-3">
                                            <div class="d-flex align-items-center gap-2">
                                                <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 30px; height: 30px; font-size: 11px; flex-shrink: 0;">
                                                    ${avatar.initials}
                                                </div>
                                                <span class="fw-bold text-dark text-truncate" style="max-width: 250px;" title="${escapeHtml(r['Cliente'])}">
                                                    ${escapeHtml(r['Cliente'])}
                                                </span>
                                            </div>
                                        </td>
                                        <td class="py-2.5 px-3 text-end fw-semibold text-dark tnum">${formatMoney(venta)}</td>
                                        <td class="py-2.5 px-3 text-end text-muted tnum">${formatMoney(costo)}</td>
                                        <td class="py-2.5 px-3 text-end fw-bold tnum ${isPositive ? 'text-success' : 'text-danger'}">
                                            ${formatMoney(utilidad)}
                                        </td>
                                        <td class="py-2.5 px-3 text-center">
                                            <span class="badge ${isPositive ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill fw-semibold" style="font-size: 10.5px; padding: 3px 8px;">
                                                ${pct}%
                                            </span>
                                        </td>
                                        <td class="py-2.5 px-3 text-center">
                                            <span class="badge bg-light text-secondary border rounded-pill" style="font-size: 11px; text-transform: capitalize;">
                                                ${escapeHtml(r['Estado'] || 'Facturada')}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                        <tfoot style="background-color: #f8fafc; border-top: 2px solid #cbd5e1; font-size: 13px;">
                            <tr class="fw-bold">
                                <td colspan="3" class="py-2.5 px-3 text-dark text-uppercase" style="letter-spacing: 0.5px;">Subtotal Página:</td>
                                <td class="py-2.5 px-3 text-end text-primary tnum">${formatMoney(totalVentasPagina)}</td>
                                <td class="py-2.5 px-3 text-end text-muted tnum">${formatMoney(totalCostoPagina)}</td>
                                <td class="py-2.5 px-3 text-end text-success tnum">${formatMoney(totalUtilidadPagina)}</td>
                                <td colspan="2"></td>
                            </tr>
                        </tfoot>
                    </table>
                `;
            }

            // B. Pestaña: Cartera y Cobranza WhatsApp
            else if (activeTab === 'cartera_wpp') {
                gridContainer.innerHTML = `
                    <div class="row g-3">
                        ${pageData.map(c => {
                            const avatar = getClientAvatar(c.nombre);
                            const moraBadgeClass = c.maxDiasMora > 60 ? 'bg-danger text-white' : (c.maxDiasMora > 0 ? 'bg-warning text-dark' : 'bg-success text-white');
                            const moraText = c.maxDiasMora > 0 ? `Vencida (+${c.maxDiasMora} días)` : 'Al día';

                            return `
                                <div class="col-12 col-md-6 col-lg-4">
                                    <div class="card border shadow-xs h-100 p-3" style="border-radius: 12px; transition: transform 0.15s ease;">
                                        <div class="d-flex justify-content-between align-items-start mb-2">
                                            <div class="d-flex align-items-center gap-2.5">
                                                <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 38px; height: 38px; font-size: 13px;">
                                                    ${avatar.initials}
                                                </div>
                                                <div class="text-truncate" style="max-width: 170px;">
                                                    <h6 class="fw-bold text-dark mb-0 text-truncate" title="${escapeHtml(c.nombre)}" style="font-size: 13.5px;">
                                                        ${escapeHtml(c.nombre)}
                                                    </h6>
                                                    <span class="text-muted" style="font-size: 11px;">NIT/CC: ${escapeHtml(c.identificacion)}</span>
                                                </div>
                                            </div>
                                            <span class="badge ${moraBadgeClass} rounded-pill" style="font-size: 10px; padding: 4px 8px;">
                                                ${moraText}
                                            </span>
                                        </div>

                                        <div class="p-2.5 my-2 rounded-3 bg-light border d-flex justify-content-between align-items-center">
                                            <div>
                                                <span class="text-muted text-uppercase d-block" style="font-size: 10px; letter-spacing: 0.5px;">Saldo Pendiente</span>
                                                <span class="fw-bold text-danger tnum" style="font-size: 16px;">${formatMoney(c.totalSaldo)}</span>
                                            </div>
                                            <div class="text-end">
                                                <span class="text-muted text-uppercase d-block" style="font-size: 10px; letter-spacing: 0.5px;">Facturas</span>
                                                <span class="fw-bold text-dark" style="font-size: 14px;">${c.facturas.length}</span>
                                            </div>
                                        </div>

                                        <div class="d-flex gap-2 mt-auto pt-2">
                                            <button class="btn btn-sm btn-success d-flex align-items-center justify-content-center gap-1.5 flex-grow-1 btn-wpp-direct" data-id="${c.id}" style="border-radius: 8px; font-size: 12.5px; font-weight: 600;">
                                                <i class="bi bi-whatsapp"></i> Cobrar
                                            </button>
                                            <button class="btn btn-sm btn-light border d-flex align-items-center justify-content-center btn-print-estado" data-id="${c.id}" title="Imprimir Estado de Cuenta" style="border-radius: 8px; width: 36px;">
                                                <i class="bi bi-printer text-secondary"></i>
                                            </button>
                                            <button class="btn btn-sm btn-light border d-flex align-items-center justify-content-center btn-drawer-cartera" data-id="${c.id}" title="Ver Facturas" style="border-radius: 8px; width: 36px;">
                                                <i class="bi bi-eye text-primary"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;

                // Eventos de botones Cartera
                gridContainer.querySelectorAll('.btn-wpp-direct').forEach(b => {
                    b.addEventListener('click', (e) => {
                        const cid = e.currentTarget.dataset.id;
                        PrintManager.printEstadoCuenta(cid);
                    });
                });

                gridContainer.querySelectorAll('.btn-print-estado').forEach(b => {
                    b.addEventListener('click', (e) => {
                        const cid = e.currentTarget.dataset.id;
                        PrintManager.printEstadoCuenta(cid);
                    });
                });

                gridContainer.querySelectorAll('.btn-drawer-cartera').forEach(b => {
                    b.addEventListener('click', (e) => {
                        const cid = e.currentTarget.dataset.id;
                        const cliente = currentRawData.find(x => String(x.id) === String(cid));
                        if (cliente) mostrarDrawerCliente(cliente);
                    });
                });
            }

            // C. Pestaña: Gastos y Egresos
            else if (activeTab === 'gastos') {
                const totalGastosPagina = pageData.reduce((acc, r) => acc + (Number(r['Monto ($)']) || 0), 0);

                gridContainer.innerHTML = `
                    <table class="table table-borderless align-middle mb-0">
                        <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                            <tr>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold" style="font-size: 11px; width: 110px;">Fecha</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold" style="font-size: 11px; width: 160px;">Cuenta Salida</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold" style="font-size: 11px;">Concepto / Detalle</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold" style="font-size: 11px; width: 130px;">Referencia</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end" style="font-size: 11px; width: 140px;">Monto Pagado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pageData.map(r => `
                                <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px;">
                                    <td class="py-2.5 px-3 text-muted tnum">${r['Fecha'] || '---'}</td>
                                    <td class="py-2.5 px-3 fw-semibold text-dark">
                                        <i class="bi bi-bank me-1.5 text-secondary"></i> ${escapeHtml(r['Cuenta de Salida'] || 'Caja')}
                                    </td>
                                    <td class="py-2.5 px-3 text-dark text-truncate" style="max-width: 300px;">
                                        ${escapeHtml(r['Concepto/Detalle'] || 'Gasto Operativo')}
                                    </td>
                                    <td class="py-2.5 px-3 text-muted">
                                        ${r['Referencia Documento'] ? `<span class="payment-code-badge" style="font-size: 11px;"># ${escapeHtml(r['Referencia Documento'])}</span>` : '---'}
                                    </td>
                                    <td class="py-2.5 px-3 text-end fw-bold text-danger tnum">
                                        ${formatMoney(r['Monto ($)'])}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot style="background-color: #f8fafc; border-top: 2px solid #cbd5e1; font-size: 13px;">
                            <tr class="fw-bold">
                                <td colspan="4" class="py-2.5 px-3 text-dark text-uppercase">Total Página:</td>
                                <td class="py-2.5 px-3 text-end text-danger tnum">${formatMoney(totalGastosPagina)}</td>
                            </tr>
                        </tfoot>
                    </table>
                `;
            }

            // D. Pestaña: Inventario Valorizado
            else if (activeTab === 'inventario') {
                const totalValorPagina = pageData.reduce((acc, i) => acc + (Number(i.valorTotal) || 0), 0);
                const totalStockPagina = pageData.reduce((acc, i) => acc + (Number(i.stock) || 0), 0);

                gridContainer.innerHTML = `
                    <table class="table table-borderless align-middle mb-0">
                        <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                            <tr>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold" style="font-size: 11px;">Producto / Ítem</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold" style="font-size: 11px; width: 140px;">SKU / Ref</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-center" style="font-size: 11px; width: 120px;">Stock Físico</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end" style="font-size: 11px; width: 140px;">Costo Promedio</th>
                                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end" style="font-size: 11px; width: 150px;">Valor Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pageData.map(i => `
                                <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px;">
                                    <td class="py-2.5 px-3 fw-semibold text-dark">
                                        ${escapeHtml(i.producto)}
                                    </td>
                                    <td class="py-2.5 px-3 text-muted">
                                        <span class="payment-code-badge" style="font-size: 11px;">${escapeHtml(i.sku)}</span>
                                    </td>
                                    <td class="py-2.5 px-3 text-center tnum fw-bold ${i.stock <= 5 ? 'text-danger' : 'text-dark'}">
                                        ${i.stock}
                                    </td>
                                    <td class="py-2.5 px-3 text-end text-muted tnum">
                                        ${formatMoney(i.costoPromedio)}
                                    </td>
                                    <td class="py-2.5 px-3 text-end fw-bold text-dark tnum">
                                        ${formatMoney(i.valorTotal)}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot style="background-color: #f8fafc; border-top: 2px solid #cbd5e1; font-size: 13px;">
                            <tr class="fw-bold">
                                <td colspan="2" class="py-2.5 px-3 text-dark text-uppercase">Total Página:</td>
                                <td class="py-2.5 px-3 text-center text-dark tnum">${totalStockPagina}</td>
                                <td></td>
                                <td class="py-2.5 px-3 text-end text-primary tnum">${formatMoney(totalValorPagina)}</td>
                            </tr>
                        </tfoot>
                    </table>
                `;
            }

            // Paginador
            if (pagContainer) {
                const from = (currentPage - 1) * itemsPerPage + 1;
                const to = Math.min(currentPage * itemsPerPage, total);

                pagContainer.innerHTML = `
                    <div class="d-flex align-items-center gap-3" style="font-size: 13px; color: var(--text-body);">
                        <div class="d-flex align-items-center gap-2">
                            <span>Mostrar:</span>
                            <select class="form-select form-select-sm select-per-page" style="width: 70px;">
                                <option value="15" ${itemsPerPage === 15 ? 'selected' : ''}>15</option>
                                <option value="30" ${itemsPerPage === 30 ? 'selected' : ''}>30</option>
                                <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                            </select>
                        </div>
                        <span class="text-muted border-start ps-3">
                            Mostrando <strong>${from} - ${to}</strong> de <strong>${total}</strong> registros
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
        };

        // 7. VISTA ANALÍTICA CON CHART.JS
        const renderAnalyticsView = () => {
            const container = element.querySelector('#reportes-analytics-container');
            if (!container) return;

            // Limpieza previa de instancias activas de Chart.js
            if (chartInstanceA) { try { chartInstanceA.destroy(); } catch (e) {} chartInstanceA = null; }
            if (chartInstanceB) { try { chartInstanceB.destroy(); } catch (e) {} chartInstanceB = null; }

            if (filteredItems.length === 0) {
                container.innerHTML = `<div class="p-5 text-center text-muted">No hay datos suficientes para graficar.</div>`;
                return;
            }

            if (activeTab === 'ventas_utilidad') {
                // Agrupar ventas y costos por fecha
                const dailyMap = {};
                const clientMarginMap = {};

                filteredItems.forEach(r => {
                    const date = r['Fecha'] || 'Sin fecha';
                    if (!dailyMap[date]) dailyMap[date] = { venta: 0, costo: 0, utilidad: 0 };
                    dailyMap[date].venta += (Number(r['Total de Venta']) || 0);
                    dailyMap[date].costo += (Number(r['Costo de Venta (FIFO)']) || 0);
                    dailyMap[date].utilidad += (Number(r['Utilidad Bruta']) || 0);

                    const cli = r['Cliente'] || 'Cliente Genérico';
                    if (!clientMarginMap[cli]) clientMarginMap[cli] = 0;
                    clientMarginMap[cli] += (Number(r['Utilidad Bruta']) || 0);
                });

                const topClients = Object.entries(clientMarginMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);

                const sortedDates = Object.keys(dailyMap).sort().slice(-15); // Últimas 15 fechas

                container.innerHTML = `
                    <div class="row g-4">
                        <div class="col-12 col-lg-8">
                            <div class="p-3 bg-light rounded-3 border h-100">
                                <h6 class="fw-bold mb-1 text-dark">Evolución: Ventas vs Costos FIFO</h6>
                                <span class="text-muted d-block mb-3" style="font-size: 12px;">Comportamiento diario de facturación y costo de mercancía</span>
                                <div style="height: 260px;">
                                    <canvas id="chartReporteVentas"></canvas>
                                </div>
                            </div>
                        </div>

                        <div class="col-12 col-lg-4">
                            <div class="p-3 bg-light rounded-3 border h-100 d-flex flex-column justify-content-between">
                                <div>
                                    <h6 class="fw-bold mb-1 text-dark">Proporción de Margen</h6>
                                    <span class="text-muted d-block mb-3" style="font-size: 12px;">Distribución Costo vs Utilidad Bruta</span>
                                    <div style="height: 190px;" class="d-flex justify-content-center">
                                        <canvas id="chartReporteDona"></canvas>
                                    </div>
                                </div>
                                <div class="border-top pt-2 mt-2" style="font-size: 12px;">
                                    <div class="d-flex justify-content-between py-1">
                                        <span class="text-muted"><i class="bi bi-circle-fill text-warning me-1" style="font-size: 8px;"></i> Costo FIFO</span>
                                        <span class="fw-bold text-dark tnum">${formatMoney(filteredItems.reduce((acc, r) => acc + (Number(r['Costo de Venta (FIFO)']) || 0), 0))}</span>
                                    </div>
                                    <div class="d-flex justify-content-between py-1">
                                        <span class="text-muted"><i class="bi bi-circle-fill text-success me-1" style="font-size: 8px;"></i> Utilidad Bruta</span>
                                        <span class="fw-bold text-success tnum">${formatMoney(filteredItems.reduce((acc, r) => acc + (Number(r['Utilidad Bruta']) || 0), 0))}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="col-12">
                            <div class="p-3 bg-light rounded-3 border">
                                <h6 class="fw-bold mb-1 text-dark">Top 5 Clientes más Rentables</h6>
                                <span class="text-muted d-block mb-3" style="font-size: 12px;">Clientes que más utilidad bruta aportan en el período</span>
                                <div class="row g-2">
                                    ${topClients.map(([name, utilidad], idx) => `
                                        <div class="col-12 col-sm-6 col-md">
                                            <div class="p-3 bg-white rounded-3 border h-100">
                                                <div class="d-flex align-items-center gap-2 mb-1">
                                                    <span class="badge bg-success text-white rounded-circle" style="width: 20px; height: 20px; font-size: 10px; display: inline-flex; align-items: center; justify-content: center;">${idx + 1}</span>
                                                    <span class="fw-bold text-dark text-truncate" style="font-size: 12px;" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                                                </div>
                                                <div class="fw-bold text-success tnum" style="font-size: 15px;">${formatMoney(utilidad)}</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const initCharts = () => {
                    if (typeof Chart === 'undefined') return;

                    const ctxVentas = document.getElementById('chartReporteVentas');
                    if (ctxVentas) {
                        if (chartInstanceA) chartInstanceA.destroy();
                        chartInstanceA = new Chart(ctxVentas, {
                            type: 'bar',
                            data: {
                                labels: sortedDates.map(d => d.substring(5)),
                                datasets: [
                                    {
                                        label: 'Ventas ($)',
                                        data: sortedDates.map(d => dailyMap[d]?.venta || 0),
                                        backgroundColor: '#2563eb',
                                        borderRadius: 4
                                    },
                                    {
                                        label: 'Costo FIFO ($)',
                                        data: sortedDates.map(d => dailyMap[d]?.costo || 0),
                                        backgroundColor: '#f59e0b',
                                        borderRadius: 4
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { position: 'top' } },
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

                    const ctxDona = document.getElementById('chartReporteDona');
                    if (ctxDona) {
                        if (chartInstanceB) chartInstanceB.destroy();
                        const cTotal = filteredItems.reduce((acc, r) => acc + (Number(r['Costo de Venta (FIFO)']) || 0), 0);
                        const uTotal = filteredItems.reduce((acc, r) => acc + (Number(r['Utilidad Bruta']) || 0), 0);

                        chartInstanceB = new Chart(ctxDona, {
                            type: 'doughnut',
                            data: {
                                labels: ['Costo FIFO', 'Utilidad Bruta'],
                                datasets: [{
                                    data: [Math.max(0, cTotal), Math.max(0, uTotal)],
                                    backgroundColor: ['#f59e0b', '#10b981']
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                cutout: '70%',
                                plugins: { legend: { display: false } }
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

            } else if (activeTab === 'cartera_wpp') {
                // Analítica de Cartera (Mora vs Al Día)
                const alDia = filteredItems.filter(c => c.maxDiasMora === 0).reduce((acc, c) => acc + c.totalSaldo, 0);
                const vencido30 = filteredItems.filter(c => c.maxDiasMora > 0 && c.maxDiasMora <= 60).reduce((acc, c) => acc + c.totalSaldo, 0);
                const critica60 = filteredItems.filter(c => c.maxDiasMora > 60).reduce((acc, c) => acc + c.totalSaldo, 0);

                const topDeudores = [...filteredItems].sort((a, b) => b.totalSaldo - a.totalSaldo).slice(0, 5);

                container.innerHTML = `
                    <div class="row g-4">
                        <div class="col-12 col-md-5">
                            <div class="p-3 bg-light rounded-3 border h-100">
                                <h6 class="fw-bold mb-1 text-dark">Antigüedad de Saldos</h6>
                                <span class="text-muted d-block mb-3" style="font-size: 12px;">Composición por vencimiento de deuda</span>
                                <div style="height: 220px;" class="d-flex justify-content-center">
                                    <canvas id="chartCarteraMora"></canvas>
                                </div>
                                <div class="border-top pt-2 mt-3" style="font-size: 12px;">
                                    <div class="d-flex justify-content-between py-1">
                                        <span class="text-muted"><i class="bi bi-circle-fill text-success me-1" style="font-size: 8px;"></i> Al día (&lt;30d)</span>
                                        <span class="fw-bold text-success tnum">${formatMoney(alDia)}</span>
                                    </div>
                                    <div class="d-flex justify-content-between py-1">
                                        <span class="text-muted"><i class="bi bi-circle-fill text-warning me-1" style="font-size: 8px;"></i> Vencida (30-60d)</span>
                                        <span class="fw-bold text-warning-emphasis tnum">${formatMoney(vencido30)}</span>
                                    </div>
                                    <div class="d-flex justify-content-between py-1">
                                        <span class="text-muted"><i class="bi bi-circle-fill text-danger me-1" style="font-size: 8px;"></i> Crítica (&gt;60d)</span>
                                        <span class="fw-bold text-danger tnum">${formatMoney(critica60)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="col-12 col-md-7">
                            <div class="p-3 bg-light rounded-3 border h-100">
                                <h6 class="fw-bold mb-1 text-dark">Top 5 Mayores Deudores</h6>
                                <span class="text-muted d-block mb-3" style="font-size: 12px;">Clientes con mayor saldo pendiente acumulado</span>
                                <div class="d-flex flex-column gap-2">
                                    ${topDeudores.map((c, i) => `
                                        <div class="p-2.5 bg-white rounded-3 border d-flex justify-content-between align-items-center">
                                            <div class="d-flex align-items-center gap-2">
                                                <span class="badge bg-danger-subtle text-danger rounded-circle" style="width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px;">${i + 1}</span>
                                                <div>
                                                    <span class="fw-bold text-dark d-block" style="font-size: 13px;">${escapeHtml(c.nombre)}</span>
                                                    <span class="text-muted" style="font-size: 11px;">${c.facturas.length} facturas pendientes</span>
                                                </div>
                                            </div>
                                            <div class="text-end">
                                                <span class="fw-bold text-danger tnum d-block" style="font-size: 14px;">${formatMoney(c.totalSaldo)}</span>
                                                <button class="btn btn-xs btn-outline-success py-0 px-2 btn-wpp-direct" data-id="${c.id}" style="font-size: 11px;">
                                                    <i class="bi bi-whatsapp"></i> Cobrar
                                                </button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const initCarteraChart = () => {
                    if (typeof Chart === 'undefined') return;
                    const ctx = document.getElementById('chartCarteraMora');
                    if (ctx) {
                        if (chartInstanceA) chartInstanceA.destroy();
                        chartInstanceA = new Chart(ctx, {
                            type: 'doughnut',
                            data: {
                                labels: ['Al día', 'Vencida (30-60d)', 'Crítica (>60d)'],
                                datasets: [{
                                    data: [alDia, vencido30, critica60],
                                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                cutout: '65%',
                                plugins: { legend: { display: false } }
                            }
                        });
                    }
                };

                if (typeof Chart === 'undefined') {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
                    script.onload = initCarteraChart;
                    document.head.appendChild(script);
                } else {
                    setTimeout(initCarteraChart, 50);
                }

                // Eventos de Cobro por WhatsApp en la tarjeta Top Deudores de Analítica
                container.querySelectorAll('.btn-wpp-direct').forEach(b => {
                    b.addEventListener('click', (e) => {
                        const cid = e.currentTarget.dataset.id;
                        PrintManager.printEstadoCuenta(cid);
                    });
                });
            } else {
                container.innerHTML = `<div class="p-5 text-center text-muted">Vista analítica disponible principalmente para Ventas/Utilidad y Cartera.</div>`;
            }
        };

        // 8. COBRANZA PERSONALIZADA POR WHATSAPP
        const enviarWhatsAppCobranza = (cliente) => {
            let tel = String(cliente.telefono || '').replace(/\D/g, '');
            if (!tel) {
                tel = prompt(`El cliente "${cliente.nombre}" no tiene teléfono registrado.\nIngresa el número de WhatsApp (ej: 3001234567):`);
                if (!tel) return;
                tel = tel.replace(/\D/g, '');
            }

            const finalPhone = tel.startsWith('57') ? tel : (tel.length === 10 ? '57' + tel : tel);
            const hoyFecha = typeof getLocalDate === 'function' ? getLocalDate() : new Date().toISOString().split('T')[0];

            let msg = `*ESTADO DE CUENTA - MAS ACCESORIOS*\n`;
            msg += `_Fecha: ${hoyFecha}_\n\n`;
            msg += `Estimado(a) *${cliente.nombre}*, un cordial saludo.\n`;
            msg += `Le compartimos el resumen de su saldo pendiente con nosotros:\n\n`;
            msg += `• *Saldo Total Pendiente:* *${formatMoney(cliente.totalSaldo)}*\n`;
            msg += `• *Facturas Pendientes:* ${cliente.facturas.length}\n`;
            if (cliente.maxDiasMora > 0) {
                msg += `• *Estado:* Presenta saldo en mora (hasta ${cliente.maxDiasMora} días)\n`;
            } else {
                msg += `• *Estado:* Cartera al día\n`;
            }

            msg += `\n*Detalle de Facturas:*\n`;
            cliente.facturas.slice(0, 6).forEach(f => {
                let moraTag = '';
                if (f.diasMora > 0) {
                    moraTag = ` [Vencida +${f.diasMora}d]`;
                } else {
                    moraTag = ` [Al día]`;
                }
                const vStr = f.vencimiento ? String(f.vencimiento).split('T')[0] : f.fecha;
                msg += `• *Fac #${f.numero}* | Vence: ${vStr} | Saldo: *${formatMoney(f.saldo)}*${moraTag}\n`;
            });
            if (cliente.facturas.length > 6) {
                msg += `• _... y ${cliente.facturas.length - 6} factura(s) más._\n`;
            }

            msg += `\n*MEDIOS DE PAGO AUTORIZADOS:*\n`;
            msg += `• *Bancolombia (Ahorros):* 54700050214\n`;
            msg += `  Titular: Diego M Izquierdo\n`;
            msg += `• *Nequi / DaviPlata:* 3158512091\n`;
            msg += `  Titular: Diego M Izquierdo\n`;
            msg += `• *Llave Bre-B / Transfiya:* @izquierdo638\n`;
            msg += `  (Transferencia inmediata desde cualquier banco)\n\n`;
            msg += `*Confirmar Pago:* Favor enviar su comprobante a este WhatsApp (3158512091) indicando el número de factura.\n\n`;
            msg += `Agradecemos regularizar el saldo pendiente a la mayor brevedad. Si ya realizó el pago, por favor compártanos el comprobante.\n¡Muchas gracias!`;

            const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
        };

        // 9. DRAWER PARA VER FACTURAS DE UN CLIENTE
        const mostrarDrawerCliente = (cliente) => {
            const backdrop = element.querySelector('#reporte-drawer-backdrop');
            const drawer = element.querySelector('#reporte-drawer');
            const title = element.querySelector('#drawer-title');
            const body = element.querySelector('#reporte-drawer-body');
            const actions = element.querySelector('#drawer-actions-container');

            if (!drawer || !body) return;

            const avatar = getClientAvatar(cliente.nombre);
            if (title) title.textContent = `Estado de Cuenta: ${cliente.nombre}`;

            body.innerHTML = `
                <!-- Encabezado Cliente -->
                <div class="d-flex align-items-center gap-3 p-3 bg-light rounded-3 border mb-4">
                    <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 44px; height: 44px; font-size: 15px;">
                        ${avatar.initials}
                    </div>
                    <div>
                        <h5 class="fw-bold text-dark mb-0" style="font-size: 16px;">${escapeHtml(cliente.nombre)}</h5>
                        <div class="text-muted" style="font-size: 12px;">NIT / CC: ${escapeHtml(cliente.identificacion)} | Tel: ${escapeHtml(cliente.telefono || 'Sin teléfono')}</div>
                    </div>
                </div>

                <!-- Banner de Saldo -->
                <div class="p-3 rounded-3 mb-4 d-flex justify-content-between align-items-center" style="background: linear-gradient(135deg, #fef2f2, #fff1f2); border: 1px solid #fecdd3;">
                    <div>
                        <span class="text-uppercase fw-semibold text-danger" style="font-size: 10px; letter-spacing: 0.5px;">Saldo Total Adeudado</span>
                        <h2 class="fw-bold text-danger mb-0 tnum">${formatMoney(cliente.totalSaldo)}</h2>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-white text-danger border px-2.5 py-1.5 rounded-pill shadow-xs" style="font-size: 11px;">
                            ${cliente.facturas.length} Factura(s)
                        </span>
                    </div>
                </div>

                <!-- Lista de Facturas Pendientes -->
                <h6 class="fw-bold text-uppercase text-muted mb-2" style="font-size: 11px; letter-spacing: 0.5px;">
                    <i class="bi bi-receipt me-1 text-primary"></i> Facturas por Cobrar
                </h6>
                <div class="table-responsive border rounded-3 bg-white mb-4">
                    <table class="table table-sm align-middle mb-0" style="font-size: 12px;">
                        <thead class="bg-light text-muted">
                            <tr>
                                <th class="ps-3 py-2">Factura</th>
                                <th class="py-2">Emisión</th>
                                <th class="py-2">Vence</th>
                                <th class="py-2 text-center">Mora</th>
                                <th class="pe-3 py-2 text-end">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cliente.facturas.map(f => `
                                <tr>
                                    <td class="ps-3 py-2 fw-bold text-primary"># ${escapeHtml(f.numero)}</td>
                                    <td class="py-2 text-muted tnum">${f.fecha}</td>
                                    <td class="py-2 text-muted tnum">${f.vencimiento}</td>
                                    <td class="py-2 text-center">
                                        <span class="badge ${f.diasMora > 0 ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'} rounded-pill" style="font-size: 10px;">
                                            ${f.diasMora > 0 ? `+${f.diasMora}d` : 'Al día'}
                                        </span>
                                    </td>
                                    <td class="pe-3 py-2 text-end fw-bold text-danger tnum">${formatMoney(f.saldo)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            if (actions) {
                actions.innerHTML = `
                    <button class="btn btn-sm btn-success d-flex align-items-center gap-1.5" id="btn-drawer-wpp">
                        <i class="bi bi-whatsapp"></i> Enviar Cobro
                    </button>
                    <button class="btn btn-sm btn-primary d-flex align-items-center gap-1.5" id="btn-drawer-print">
                        <i class="bi bi-printer"></i> Imprimir Estado
                    </button>
                `;

                actions.querySelector('#btn-drawer-wpp')?.addEventListener('click', () => {
                    PrintManager.printEstadoCuenta(cliente.id);
                });

                actions.querySelector('#btn-drawer-print')?.addEventListener('click', () => {
                    PrintManager.printEstadoCuenta(cliente.id);
                });
            }

            if (backdrop) backdrop.style.display = 'block';
            setTimeout(() => {
                if (backdrop) backdrop.classList.add('show');
                drawer.style.transform = 'translateX(0)';
            }, 10);
        };

        const cerrarDrawer = () => {
            const backdrop = element.querySelector('#reporte-drawer-backdrop');
            const drawer = element.querySelector('#reporte-drawer');
            if (drawer) drawer.style.transform = 'translateX(100%)';
            if (backdrop) {
                backdrop.classList.remove('show');
                setTimeout(() => { backdrop.style.display = 'none'; }, 280);
            }
        };

        // 10. EXPORTACIÓN A EXCEL (.XLSX) PROFESIONAL
        const exportarExcel = async () => {
            const btn = element.querySelector('#btn-export-reporte');
            const originalHtml = btn ? btn.innerHTML : '';
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Exportando...`;
            }

            try {
                if (filteredItems.length === 0) {
                    CoreActions.showWarningModal('No hay datos para exportar con los filtros seleccionados.');
                    return;
                }

                let dataToExport = [];
                let sheetName = 'Reporte';

                if (activeTab === 'ventas_utilidad') {
                    sheetName = 'Ventas_Utilidad';
                    dataToExport = filteredItems.map(r => {
                        const v = Number(r['Total de Venta']) || 0;
                        const c = Number(r['Costo de Venta (FIFO)']) || 0;
                        const u = Number(r['Utilidad Bruta']) || 0;
                        const p = v > 0 ? ((u / v) * 100).toFixed(1) : 0;
                        return {
                            'Documento': r['Documento'],
                            'Fecha': r['Fecha'],
                            'Cliente': r['Cliente'],
                            'Total Venta ($)': v,
                            'Costo FIFO ($)': c,
                            'Utilidad Bruta ($)': u,
                            'Margen (%)': Number(p),
                            'Estado': r['Estado'] || 'Facturada'
                        };
                    });
                } else if (activeTab === 'cartera_wpp') {
                    sheetName = 'Cartera_Clientes';
                    dataToExport = filteredItems.map(c => ({
                        'Cliente': c.nombre,
                        'Identificación': c.identificacion,
                        'Teléfono': c.telefono,
                        'Saldo Pendiente ($)': Math.round(c.totalSaldo),
                        'Facturas Pendientes': c.facturas.length,
                        'Días de Mora': c.maxDiasMora,
                        'Estado': c.maxDiasMora > 0 ? 'Vencida' : 'Al día'
                    }));
                } else if (activeTab === 'gastos') {
                    sheetName = 'Gastos_Operativos';
                    dataToExport = filteredItems.map(r => ({
                        'Fecha': r['Fecha'],
                        'Cuenta de Salida': r['Cuenta de Salida'],
                        'Concepto/Detalle': r['Concepto/Detalle'],
                        'Referencia Documento': r['Referencia Documento'],
                        'Monto ($)': Number(r['Monto ($)']) || 0
                    }));
                } else if (activeTab === 'inventario') {
                    sheetName = 'Inventario_Valorizado';
                    dataToExport = filteredItems.map(i => ({
                        'Producto': i.producto,
                        'SKU': i.sku,
                        'Stock': i.stock,
                        'Costo Promedio ($)': Math.round(i.costoPromedio),
                        'Valor Total ($)': Math.round(i.valorTotal)
                    }));
                }

                const dateStr = getLocalDate();
                const filename = `Reporte_${sheetName}_${dateStr}.xlsx`;

                if (window.XLSX) {
                    const ws = window.XLSX.utils.json_to_sheet(dataToExport);
                    const wb = window.XLSX.utils.book_new();
                    window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
                    window.XLSX.writeFile(wb, filename);
                } else {
                    // Fallback CSV seguro con soporte para números en cero
                    const headers = Object.keys(dataToExport[0]);
                    let csv = headers.join(';') + '\r\n';
                    dataToExport.forEach(row => {
                        csv += headers.map(h => {
                            const val = (row[h] !== null && row[h] !== undefined) ? String(row[h]) : '';
                            return `"${val.replace(/"/g, '""')}"`;
                        }).join(';') + '\r\n';
                    });
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Reporte_${sheetName}_${dateStr}.csv`;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 200);
                }
            } catch (err) {
                console.error("Error exportando reporte:", err);
                CoreActions.showWarningModal("Error al exportar: " + err.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            }
        };

        // 11. ENLACE DE EVENTOS ESTÁTICOS
        const bindStaticEvents = () => {
            // Buscador con debounce
            const searchInput = element.querySelector('#searchReporte');
            if (searchInput) {
                let debounceTimer;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        searchQuery = e.target.value.trim();
                        currentPage = 1;
                        applyFiltersAndRender();
                    }, 300);
                });
            }

            // Pestañas de Reportes Principales
            element.querySelectorAll('.payment-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    element.querySelectorAll('.payment-tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeTab = btn.dataset.tab;
                    currentPage = 1;
                    searchQuery = '';
                    if (searchInput) searchInput.value = '';
                    loadReportData();
                });
            });

            // Presets de Fechas
            element.querySelectorAll('.btn-date-preset').forEach(btn => {
                btn.addEventListener('click', () => {
                    element.querySelectorAll('.btn-date-preset').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    datePreset = btn.dataset.preset;

                    if (datePreset !== 'personalizado') {
                        const computed = computeDates(datePreset);
                        fechaInicio = computed.inicio;
                        fechaFin = computed.fin;
                        element.querySelector('#input-date-inicio').value = fechaInicio;
                        element.querySelector('#input-date-fin').value = fechaFin;
                        loadReportData();
                    }
                });
            });

            // Botón Aplicar Fechas Personalizadas
            element.querySelector('#btn-apply-dates')?.addEventListener('click', () => {
                const ini = element.querySelector('#input-date-inicio')?.value;
                const fin = element.querySelector('#input-date-fin')?.value;
                if (!ini || !fin) {
                    CoreActions.showWarningModal('Por favor selecciona ambas fechas.');
                    return;
                }
                fechaInicio = ini;
                fechaFin = fin;
                element.querySelectorAll('.btn-date-preset').forEach(b => b.classList.remove('active'));
                element.querySelector('[data-preset="personalizado"]')?.classList.add('active');
                loadReportData();
            });

            // Alternar Vista Tabla vs Analítica
            const btnTabla = element.querySelector('#btn-view-tabla');
            const btnGrafico = element.querySelector('#btn-view-grafico');
            const containerTabla = element.querySelector('#reportes-table-view-container');
            const containerGrafico = element.querySelector('#reportes-analytics-container');

            if (btnTabla && btnGrafico) {
                btnTabla.addEventListener('click', () => {
                    activeView = 'tabla';
                    btnTabla.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold text-dark';
                    btnGrafico.className = 'btn btn-sm btn-light border-0 text-muted';
                    if (containerGrafico) containerGrafico.style.display = 'none';
                    if (containerTabla) containerTabla.style.display = 'block';
                    renderGrid();
                });

                btnGrafico.addEventListener('click', () => {
                    activeView = 'grafico';
                    btnGrafico.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold text-primary';
                    btnTabla.className = 'btn btn-sm btn-light border-0 text-muted';
                    if (containerTabla) containerTabla.style.display = 'none';
                    if (containerGrafico) {
                        containerGrafico.style.display = 'block';
                        renderAnalyticsView();
                    }
                });
            }

            // Botón Refrescar
            element.querySelector('#btn-refresh-reporte')?.addEventListener('click', async (e) => {
                const icon = e.currentTarget.querySelector('i');
                if (icon) icon.classList.add('spinner-border', 'spinner-border-sm');
                await loadReportData();
                if (icon) icon.classList.remove('spinner-border', 'spinner-border-sm');
            });

            // Botón Exportar
            element.querySelector('#btn-export-reporte')?.addEventListener('click', exportarExcel);

            // Drawer Cierres
            const btnCloseDrawer = element.querySelector('#btn-reporte-drawer-close');
            const btnCloseDrawerB = element.querySelector('#btn-reporte-drawer-close-bottom');
            const backdropDrawer = element.querySelector('#reporte-drawer-backdrop');
            if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', cerrarDrawer);
            if (btnCloseDrawerB) btnCloseDrawerB.addEventListener('click', cerrarDrawer);
            if (backdropDrawer) backdropDrawer.addEventListener('click', cerrarDrawer);
        };

        // Flujo inicial
        bindStaticEvents();
        await loadReportData();

        // Limpieza de memoria en cambio de ruta
        return () => {
            if (chartInstanceA) {
                try { chartInstanceA.destroy(); } catch (e) {}
                chartInstanceA = null;
            }
            if (chartInstanceB) {
                try { chartInstanceB.destroy(); } catch (e) {}
                chartInstanceB = null;
            }
        };
    }
};
