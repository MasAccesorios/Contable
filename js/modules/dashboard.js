// js/modules/dashboard.js
import DB from '../core/db.js';
import { supabase } from '../core/supabase.js';
import { escapeHtml } from '../shared/formatters.js';

export const DashboardModule = {
    async init(element) {
        if (!element) return;

        element.innerHTML = `
            <div class="p-3 p-md-4" style="background-color: transparent; min-height: 100vh;">
                <div class="dash-layout">

                <!-- ═══ HEADER EJECUTIVO ═══ -->
                <div class="dash-header">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <h2 class="page-title mb-0">Panel Ejecutivo & Finanzas</h2>
                            <span class="dash-badge-chip--live">
                                <span class="pulse-dot-live"></span>
                                En Vivo
                            </span>
                        </div>
                        <p class="mb-0 text-muted" style="font-size: var(--fs-sm); margin-top: 3px;">MAS Accesorios • Monitor financiero y operativo en tiempo real</p>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <div class="dashboard-pill-group" role="group" id="dashboard-rango-filtro">
                            <button type="button" class="dpg-btn" data-rango="7 Días">7 Días</button>
                            <button type="button" class="dpg-btn dpg-btn--active" data-rango="Este Mes">Este Mes</button>
                            <button type="button" class="dpg-btn" data-rango="Este Año">Este Año</button>
                        </div>
                        <button type="button" class="btn-refresh-icon" id="btn-refresh-dashboard" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary d-none d-sm-inline-flex align-items-center gap-1.5" id="btn-exportar-dashboard" title="Imprimir / Exportar vista" style="border-radius: 8px; font-weight: 500;">
                            <i class="bi bi-printer text-[14px]"></i>
                            <span>Imprimir</span>
                        </button>
                    </div>
                </div>

                <!-- ═══ HERO BENTO GRID (4 PILARES ESTRATÉGICOS) ═══ -->
                <div class="dash-grid-kpis">

                    <!-- 1. Liquidez Inmediata -->
                    <div class="dash-kpi-card d-flex flex-column justify-content-between dash-card-link" onclick="window.location.hash = '#/bancos'" tabindex="0" role="link" aria-label="Ir al módulo de Bancos">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <span class="dash-kpi-label">Liquidez Inmediata</span>
                                <span class="d-block text-muted" style="font-size: 11px; margin-top: 1px;">Bancos y Cajas</span>
                            </div>
                            <div class="dash-icon-box variant-cyan">
                                <i class="bi bi-wallet2"></i>
                            </div>
                        </div>
                        <div class="mt-2">
                            <div class="dash-kpi-value text-metric" id="kpi-saldo-bancos"><span class="dash-skeleton"></span></div>
                            <div class="d-flex align-items-center gap-1 mt-1">
                                <span class="dash-badge-chip dash-badge-chip--success" style="font-size: 10.5px;">
                                    <i class="bi bi-check-circle-fill me-1"></i> Disponible neto
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- 2. Facturación del Periodo -->
                    <div class="dash-kpi-card d-flex flex-column justify-content-between dash-card-link" onclick="window.location.hash = '#/ingresos/facturas'" tabindex="0" role="link" aria-label="Ir a Facturas de Venta">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <span class="dash-kpi-label">Facturación Periodo</span>
                                <span class="d-block text-muted" style="font-size: 11px; margin-top: 1px;">Ventas consolidadas</span>
                            </div>
                            <div class="dash-icon-box variant-blue">
                                <i class="bi bi-graph-up-arrow"></i>
                            </div>
                        </div>
                        <div class="mt-2">
                            <div class="dash-kpi-value text-metric" id="kpi-total-ventas"><span class="dash-skeleton"></span></div>
                            <div class="d-flex align-items-center gap-1 mt-1">
                                <span id="kpi-ventas-growth-badge" class="dash-badge-chip dash-badge-chip--success" style="display: none; font-size: 10.5px;">
                                    <i id="kpi-ventas-growth-icon" class="bi me-1"></i> <span id="kpi-ventas-growth-text">...</span>
                                </span>
                                <small id="kpi-ventas-growth-label" class="dash-kpi-subtext" style="font-size: 11px;">vs periodo anterior</small>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Utilidad Operativa -->
                    <div class="dash-kpi-card d-flex flex-column justify-content-between">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <span class="dash-kpi-label">Utilidad Operativa</span>
                                <span class="d-block text-muted" style="font-size: 11px; margin-top: 1px;">Margen bruto neto</span>
                            </div>
                            <div class="dash-icon-box variant-green">
                                <i class="bi bi-cash-stack"></i>
                            </div>
                        </div>
                        <div class="mt-2">
                            <div class="dash-kpi-value text-metric" id="kpi-utilidad-monto"><span class="dash-skeleton"></span></div>
                            <div class="d-flex align-items-center gap-1 mt-1">
                                <span class="dash-badge-chip dash-badge-chip--success" id="kpi-utilidad-margen-badge" style="font-size: 10.5px;">Margen: 0.0%</span>
                            </div>
                        </div>
                    </div>

                    <!-- 4. Activos en Stock -->
                    <div class="dash-kpi-card d-flex flex-column justify-content-between dash-card-link" onclick="window.location.hash = '#/inventario/items'" tabindex="0" role="link" aria-label="Ir a Ítems de Venta e Inventario">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <span class="dash-kpi-label">Activos en Stock</span>
                                <span class="d-block text-muted" style="font-size: 11px; margin-top: 1px;">Existencias bodega</span>
                            </div>
                            <div class="dash-icon-box variant-yellow">
                                <i class="bi bi-box-seam-fill"></i>
                            </div>
                        </div>
                        <div class="mt-2">
                            <div class="dash-kpi-value text-metric" id="kpi-inventario-valorizado"><span class="dash-skeleton"></span></div>
                            <span class="dash-kpi-subtext mt-1 d-block" style="font-size: 11px;">Costo existencias bodega</span>
                        </div>
                    </div>

                </div>

                <!-- ═══ RADAR DE CARTERA Y TESORERÍA (CxC / CxP) ═══ -->
                <div class="dash-grid-top">

                    <!-- Cuentas por cobrar -->
                    <div class="dash-card-premium dash-card-link" onclick="window.location.hash = '#/cartera'" tabindex="0" role="link" aria-label="Ir a cartera de cuentas por cobrar">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <span class="dash-card-label">
                                    <i class="bi bi-arrow-up-right-circle text-success me-1"></i>
                                    Cuentas por cobrar (CxC)
                                </span>
                                <div class="dash-card-metric text-metric" id="kpi-cxc-total"><span class="dash-skeleton"></span></div>
                            </div>
                            <span class="badge dash-badge-mora" id="kpi-cxc-badge-mora" style="display:none;"></span>
                        </div>
                        <div class="dash-micro-bar" id="kpi-cxc-progress" role="progressbar" aria-label="Proporción de cuentas por cobrar vigentes y vencidas">
                            <div class="dash-micro-fill" style="width: 0%; background: var(--success);"></div>
                            <div class="dash-micro-fill" style="width: 0%; background: var(--danger);"></div>
                        </div>
                        <div class="d-flex gap-4 mt-3 pt-1">
                            <div class="dash-sub-item dash-sub-green">
                                <span class="dash-sub-label">Vigentes al día</span>
                                <span class="dash-sub-value text-metric" id="kpi-cxc-vigentes"><span class="dash-skeleton dash-skeleton-sm"></span></span>
                                <span class="dash-sub-docs" id="kpi-cxc-vigentes-doc">...</span>
                            </div>
                            <div class="dash-sub-item dash-sub-red">
                                <span class="dash-sub-label">Vencidas</span>
                                <span class="dash-sub-value text-metric" id="kpi-cxc-vencidas"><span class="dash-skeleton dash-skeleton-sm"></span></span>
                                <span class="dash-sub-docs" id="kpi-cxc-vencidas-doc">...</span>
                            </div>
                        </div>
                    </div>

                    <!-- Cuentas por pagar -->
                    <div class="dash-card-premium dash-card-link" onclick="window.location.hash = '#/gastos/proveedores'" tabindex="0" role="link" aria-label="Ir a cuentas por pagar y proveedores">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <span class="dash-card-label">
                                    <i class="bi bi-arrow-down-left-circle text-warning me-1"></i>
                                    Cuentas por pagar (CxP)
                                </span>
                                <div class="dash-card-metric text-metric" id="kpi-cxp-total"><span class="dash-skeleton"></span></div>
                            </div>
                            <span class="badge dash-badge-mora dash-badge-mora--warning" id="kpi-cxp-badge-mora" style="display:none;"></span>
                        </div>
                        <div class="dash-micro-bar" id="kpi-cxp-progress" role="progressbar" aria-label="Proporción de cuentas por pagar vigentes y vencidas">
                            <div class="dash-micro-fill" style="width: 0%; background: var(--text-muted);"></div>
                            <div class="dash-micro-fill" style="width: 0%; background: var(--warning);"></div>
                        </div>
                        <div class="d-flex gap-4 mt-3 pt-1">
                            <div class="dash-sub-item dash-sub-neutral">
                                <span class="dash-sub-label">Vigentes proveedores</span>
                                <span class="dash-sub-value text-metric" id="kpi-cxp-vigentes"><span class="dash-skeleton dash-skeleton-sm"></span></span>
                                <span class="dash-sub-docs" id="kpi-cxp-vigentes-doc">...</span>
                            </div>
                            <div class="dash-sub-item dash-sub-orange">
                                <span class="dash-sub-label">Por vencer / vencidas</span>
                                <span class="dash-sub-value text-metric" id="kpi-cxp-vencidas"><span class="dash-skeleton dash-skeleton-sm"></span></span>
                                <span class="dash-sub-docs" id="kpi-cxp-vencidas-doc">...</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ═══ PERFORMANCE STUDIO (GRÁFICA INTERACTIVA) ═══ -->
                <div class="card dash-chart-card">
                    <div class="card-body p-3 p-md-4">
                        <div class="dash-chart-header">
                            <div>
                                <h6 class="text-dark text-body mb-1 fw-bold" style="font-size: 15px;">Rendimiento Financiero & Facturación</h6>
                                <span class="text-muted" style="font-size: var(--fs-xs);">Comportamiento cronológico de ventas e ingresos</span>
                            </div>
                            <div class="chart-mode-pill-group" id="chart-mode-group">
                                <button type="button" class="chart-mode-btn chart-mode-btn--active" data-mode="diario">
                                    <i class="bi bi-bar-chart-line me-1"></i> Facturación Diaria
                                </button>
                                <button type="button" class="chart-mode-btn" data-mode="acumulado">
                                    <i class="bi bi-graph-up me-1"></i> Tendencia Acumulada
                                </button>
                            </div>
                        </div>

                        <!-- Micro-métricas del estudio -->
                        <div class="d-flex flex-wrap gap-4 mb-3 pt-1 border-top" style="border-color: var(--border-color) !important;">
                            <div>
                                <span class="text-muted d-block text-uppercase fw-semibold" style="font-size: var(--fs-xxs); letter-spacing: 0.5px;">Ticket Promedio</span>
                                <span class="text-dark fw-bold text-metric" id="kpi-ticket-promedio" style="font-size: var(--fs-md);"><span class="dash-skeleton dash-skeleton-sm"></span></span>
                            </div>
                            <div>
                                <span class="text-muted d-block text-uppercase fw-semibold" style="font-size: var(--fs-xxs); letter-spacing: 0.5px;">Promedio Diario</span>
                                <span class="text-dark fw-bold text-metric" id="kpi-promedio-diario" style="font-size: var(--fs-md);"><span class="dash-skeleton dash-skeleton-sm"></span></span>
                            </div>
                            <div>
                                <span class="text-muted d-block text-uppercase fw-semibold" style="font-size: var(--fs-xxs); letter-spacing: 0.5px;">Pico de Venta</span>
                                <span class="text-dark fw-bold text-metric text-success" id="kpi-pico-diario" style="font-size: var(--fs-md);"><span class="dash-skeleton dash-skeleton-sm"></span></span>
                            </div>
                        </div>
                        
                        <div style="height: 300px; width: 100%; position: relative;">
                            <canvas id="ventasChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- ═══ BENTO INFERIOR DUAL: LEDGER & COCKPIT OPERATIVO ═══ -->
                <div class="dash-grid-bottom">

                    <!-- Columna 1: Ledger de Operaciones Recientes -->
                    <div class="dash-table-container">
                        <div class="card-header bg-white d-flex justify-content-between align-items-center p-3 border-bottom">
                            <div>
                                <h6 class="mb-0 fw-bold" style="font-size: 14px;">Operaciones Recientes</h6>
                                <span class="text-muted" style="font-size: 11px;">Últimas facturaciones con saldo y estado en vivo</span>
                            </div>
                            <button type="button" class="btn btn-sm btn-link text-decoration-none p-0 fw-semibold d-flex align-items-center gap-1" style="font-size: 12px; color: var(--primary);" onclick="window.location.hash = '#/ingresos/facturas'">
                                <span>Ver todas las facturas</span> <i class="bi bi-chevron-right text-[12px]"></i>
                            </button>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0" style="font-size: 13px;">
                                <thead>
                                    <tr>
                                        <th class="py-2.5 px-3">Cliente / Documento</th>
                                        <th class="py-2.5 px-3">Fecha</th>
                                        <th class="py-2.5 px-3 text-end">Total</th>
                                        <th class="py-2.5 px-3 text-end">Saldo</th>
                                        <th class="py-2.5 px-3 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody id="dash-top-clientes-tbody">
                                    <tr>
                                        <td colspan="5" class="py-3 px-3 text-center text-muted">
                                            <span class="dash-skeleton" style="width: 90%; height: 1.2rem;"></span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colspan="5" class="py-3 px-3 text-center text-muted">
                                            <span class="dash-skeleton" style="width: 80%; height: 1.2rem;"></span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colspan="5" class="py-3 px-3 text-center text-muted">
                                            <span class="dash-skeleton" style="width: 85%; height: 1.2rem;"></span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Columna 2: Cockpit Operativo y Accesos de Alta Velocidad -->
                    <div class="dash-card-premium d-flex flex-column justify-content-between">
                        <div>
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h6 class="mb-0 fw-bold" style="font-size: 14px;">Cockpit Operativo</h6>
                                <span class="dash-badge-chip dash-badge-chip--info">Tiempo Real</span>
                            </div>
                            
                            <div class="d-flex flex-column gap-3 mb-4">
                                <div class="d-flex justify-content-between align-items-center p-2.5 rounded" style="background: var(--surface-muted);">
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="bi bi-receipt text-[17px] text-muted"></i>
                                        <span style="font-size: 13px; font-weight: 500;">Facturas emitidas</span>
                                    </div>
                                    <span class="fw-bold text-metric" id="kpi-facturas-conteo"><span class="dash-skeleton dash-skeleton-sm"></span></span>
                                </div>

                                <div class="d-flex justify-content-between align-items-center p-2.5 rounded" style="background: var(--surface-muted);">
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="bi bi-box-seam text-[17px] text-muted"></i>
                                        <span style="font-size: 13px; font-weight: 500;">Unidades despachadas</span>
                                    </div>
                                    <span class="fw-bold text-metric" id="kpi-productos"><span class="dash-skeleton dash-skeleton-sm"></span></span>
                                </div>

                                <div class="d-flex justify-content-between align-items-center p-2.5 rounded" style="background: var(--surface-muted);">
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="bi bi-shield-check text-[17px] text-muted"></i>
                                        <span style="font-size: 13px; font-weight: 500;">Estatus de Cobranza</span>
                                    </div>
                                    <span class="dash-badge-chip dash-badge-chip--success" id="kpi-tasa-cobranza">...</span>
                                </div>
                            </div>
                        </div>

                        <!-- Acciones directas -->
                        <div class="pt-3 border-top" style="border-color: var(--border-color) !important;">
                            <span class="text-muted d-block mb-2" style="font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Acciones Rápidas</span>
                            <div class="d-grid gap-2">
                                <button type="button" class="btn btn-sm btn-primary-action d-flex align-items-center justify-content-center gap-1.5 py-2" onclick="window.location.hash = '#/ingresos/facturas'">
                                    <i class="bi bi-plus-circle me-1"></i>
                                    <span>Nueva Venta</span>
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center gap-1.5 py-1.5" onclick="window.location.hash = '#/ingresos/pagos/nuevo'" style="border-radius: 8px;">
                                    <i class="bi bi-cash-coin me-1"></i>
                                    <span>Registrar Cobro</span>
                                </button>
                            </div>
                        </div>
                    </div>

                </div>

                </div><!-- /.dash-layout -->
            </div>`;

        let isAborted = false;
        const startLoad = async () => {
            if (isAborted) return;
            await this.loadData(element);
            if (isAborted) return;
            this.setupFilters(element);
        };

        // Ensure Chart.js is loaded
        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = startLoad;
            document.head.appendChild(script);
        } else {
            await startLoad();
        }

        return () => {
            isAborted = true;
            if (window.myVentasChart && typeof window.myVentasChart.destroy === 'function') {
                try { window.myVentasChart.destroy(); } catch (e) {}
                window.myVentasChart = null;
            }
        };
    },

    setLoadingSkeletons(element) {
        const metricIds = [
            '#kpi-total-ventas', '#kpi-utilidad-monto', '#kpi-saldo-bancos', 
            '#kpi-inventario-valorizado', '#kpi-cxc-total', '#kpi-cxc-vigentes', 
            '#kpi-cxc-vencidas', '#kpi-cxp-total', '#kpi-cxp-vigentes', 
            '#kpi-cxp-vencidas', '#kpi-ticket-promedio', '#kpi-promedio-diario', 
            '#kpi-pico-diario', '#kpi-facturas-conteo', '#kpi-productos'
        ];
        metricIds.forEach(id => {
            const el = element.querySelector(id);
            if (el) el.innerHTML = '<span class="dash-skeleton"></span>';
        });
        const tbody = element.querySelector('#dash-top-clientes-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr><td colspan="5" class="py-3 px-3 text-center text-muted"><span class="dash-skeleton" style="width: 90%; height: 1.2rem;"></span></td></tr>
                <tr><td colspan="5" class="py-3 px-3 text-center text-muted"><span class="dash-skeleton" style="width: 80%; height: 1.2rem;"></span></td></tr>
                <tr><td colspan="5" class="py-3 px-3 text-center text-muted"><span class="dash-skeleton" style="width: 85%; height: 1.2rem;"></span></td></tr>
            `;
        }
    },

    setupFilters(element) {
        const filterGroup = element.querySelector('#dashboard-rango-filtro');
        if (filterGroup) {
            filterGroup.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    filterGroup.querySelectorAll('.dpg-btn').forEach(btn => {
                        btn.classList.remove('dpg-btn--active');
                    });
                    e.target.classList.add('dpg-btn--active');
                    this.setLoadingSkeletons(element);
                    this.renderDynamicContent(element, e.target.dataset.rango);
                }
            });
        }
        const btnRefresh = element.querySelector('#btn-refresh-dashboard');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', async () => {
                btnRefresh.classList.add('rotating');
                this.setLoadingSkeletons(element);
                const activeBtn = element.querySelector('#dashboard-rango-filtro .dpg-btn--active');
                await this.renderDynamicContent(element, activeBtn ? activeBtn.dataset.rango : 'Este Mes');
                setTimeout(() => btnRefresh.classList.remove('rotating'), 600);
            });
        }
        const btnExport = element.querySelector('#btn-exportar-dashboard');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                window.print();
            });
        }

        const modeGroup = element.querySelector('#chart-mode-group');
        if (modeGroup) {
            modeGroup.addEventListener('click', (e) => {
                const btn = e.target.closest('.chart-mode-btn');
                if (btn && btn.dataset.mode) {
                    modeGroup.querySelectorAll('.chart-mode-btn').forEach(b => b.classList.remove('chart-mode-btn--active'));
                    btn.classList.add('chart-mode-btn--active');
                    this._chartMode = btn.dataset.mode;
                    if (this._dailySales) {
                        this.renderChart(this._dailySales, this._currentRango, this._chartMode);
                    }
                }
            });
        }
    },

    async loadData(element) {
        if (this._loading) return;
        this._loading = true;
        try {
            const select = element.querySelector('#dashboard-rango-filtro .dpg-btn--active');
            await this.renderDynamicContent(element, select ? select.dataset.rango : 'Este Mes');
        } finally {
            this._loading = false;
        }
    },

    async renderDynamicContent(element, rango) {
        await supabase.auth.getSession();

        const hoy = new Date();
        hoy.setHours(0,0,0,0);

        let startDate = new Date(hoy);
        let endDate = new Date(hoy);
        let prevStartDate = new Date(hoy);
        let prevEndDate = new Date(hoy);

        if (rango === 'Mes actual' || rango === 'Este Mes') {
            startDate.setDate(1);
            endDate = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0); // Last day of month
            prevStartDate.setDate(1);
            prevStartDate.setMonth(prevStartDate.getMonth() - 1);
            prevEndDate.setMonth(prevEndDate.getMonth() - 1);
        } else if (rango === '7 Días') {
            startDate.setDate(hoy.getDate() - 6);
            prevStartDate = new Date(startDate);
            prevStartDate.setDate(prevStartDate.getDate() - 7);
            prevEndDate = new Date(startDate);
            prevEndDate.setDate(prevEndDate.getDate() - 1);
        } else if (rango === 'Este Año') {
            startDate.setMonth(0, 1);
            prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
            prevStartDate.setMonth(0, 1);
            prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
        } else {
            const months = parseInt(rango.split(' ')[0]) || 1;
            startDate.setMonth(startDate.getMonth() - months);
            prevStartDate = new Date(startDate);
            prevStartDate.setMonth(prevStartDate.getMonth() - months);
            prevEndDate = new Date(startDate);
            prevEndDate.setDate(prevEndDate.getDate() - 1);
        }

        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return year + '-' + month + '-' + day;
        };

        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);
        const prevStartDateStr = formatDate(prevStartDate);
        const prevEndDateStr = formatDate(prevEndDate);

        const safeSetText = (id, text) => {
            const el = element.querySelector(id);
            if (el) el.textContent = text;
        };
        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0});

        let resolvedKPIs = null;
        let resolvedCartera = null;

        const getClientMonogram = (name) => {
            if (!name) return { initials: 'CF', bg: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' };
            const clean = name.trim();
            const parts = clean.split(/\s+/);
            let initials = 'CF';
            if (parts.length > 1) {
                initials = (parts[0][0] + parts[1][0]).toUpperCase();
            } else if (clean.length > 0) {
                initials = clean.substring(0, 2).toUpperCase();
            }
            const colors = [
                { bg: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' },
                { bg: 'rgba(5, 150, 105, 0.1)', color: '#059669' },
                { bg: 'rgba(147, 51, 234, 0.1)', color: '#9333ea' },
                { bg: 'rgba(234, 88, 12, 0.1)', color: '#ea580c' },
                { bg: 'rgba(13, 148, 136, 0.1)', color: '#0d9488' }
            ];
            let hash = 0;
            for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
            const color = colors[Math.abs(hash) % colors.length];
            return { initials, bg: color.bg, color: color.color };
        };

        // ==========================================
        // PROMESAS PARALELAS CON RENDER PROGRESIVO
        // ==========================================

        // 1. KPIs de Ventas y Gráfica (RPC)
        const pKPIs = supabase.rpc('get_dashboard_kpis', {
            p_fecha_inicio: startDateStr,
            p_fecha_fin: endDateStr,
            p_prev_fecha_inicio: prevStartDateStr,
            p_prev_fecha_fin: prevEndDateStr
        }).then(({ data, error }) => {
            if (error) throw error;
            
            resolvedKPIs = data || {};
            const kpis = resolvedKPIs;
            const ventasMes = kpis.ventas_mes || 0;
            const utilidadMes = kpis.utilidad_mes || 0;
            const ventasPrev = kpis.ventas_prev || 0;
            const productosVendidos = kpis.productos_vendidos || 0;
            const facturasCount = kpis.facturas_count || 0;
            
            // Reconstruir dailySales para la gráfica (rellenando días vacíos)
            const dbDailySales = kpis.daily_sales || {};
            const dailySales = {};
            const iterDate = new Date(startDate);
            let elapsedDays = 0;
            
            while (iterDate <= endDate) {
                const dStr = `${iterDate.getFullYear()}-${String(iterDate.getMonth() + 1).padStart(2, '0')}-${String(iterDate.getDate()).padStart(2, '0')}`;
                if (iterDate <= hoy) {
                    dailySales[dStr] = dbDailySales[dStr] || 0;
                    elapsedDays++;
                } else {
                    dailySales[dStr] = null;
                }
                iterDate.setDate(iterDate.getDate() + 1);
            }

            safeSetText('#kpi-total-ventas', formatMoney(ventasMes));
            
            // Mostrar Utilidad Real ($) y Margen (%)
            safeSetText('#kpi-utilidad-monto', formatMoney(utilidadMes));
            const margenPct = ventasMes > 0 ? ((utilidadMes / ventasMes) * 100) : 0;
            const margenBadge = element.querySelector('#kpi-utilidad-margen-badge');
            if (margenBadge) {
                margenBadge.textContent = `Margen: ${margenPct.toFixed(1)}%`;
                margenBadge.className = `dash-badge-chip ${margenPct >= 0 ? 'dash-badge-chip--success' : 'dash-badge-chip--danger'}`;
            }

            safeSetText('#kpi-productos', productosVendidos);
            safeSetText('#kpi-facturas-conteo', facturasCount);
            
            const ticketProm = facturasCount > 0 ? (ventasMes / facturasCount) : 0;
            const promDiario = elapsedDays > 0 ? (ventasMes / elapsedDays) : 0;
            safeSetText('#kpi-ticket-promedio', formatMoney(ticketProm));
            safeSetText('#kpi-promedio-diario', formatMoney(promDiario));

            const validSales = Object.values(dailySales).filter(v => v !== null && v !== undefined);
            const peakSale = validSales.length > 0 ? Math.max(...validSales) : 0;
            safeSetText('#kpi-pico-diario', formatMoney(peakSale));
            
            const growthBadge = element.querySelector('#kpi-ventas-growth-badge');
            const growthIcon = element.querySelector('#kpi-ventas-growth-icon');
            const growthText = element.querySelector('#kpi-ventas-growth-text');
            if (growthBadge) {
                if (ventasPrev === 0) {
                    growthBadge.style.display = 'none';
                } else {
                    growthBadge.style.display = 'inline-flex';
                    const growth = ((ventasMes - ventasPrev) / ventasPrev) * 100;
                    const growthAbs = Math.abs(growth).toFixed(1);
                    if (growth > 0) {
                        growthBadge.className = 'dash-badge-chip dash-badge-chip--success';
                        growthIcon.className = 'bi bi-arrow-up-right me-1';
                        growthText.textContent = `+${growthAbs}%`;
                    } else if (growth < 0) {
                        growthBadge.className = 'dash-badge-chip dash-badge-chip--danger';
                        growthIcon.className = 'bi bi-arrow-down-right me-1';
                        growthText.textContent = `-${growthAbs}%`;
                    } else {
                        growthBadge.className = 'dash-badge-chip dash-badge-chip--info';
                        growthIcon.className = 'bi bi-dash me-1';
                        growthText.textContent = `0%`;
                    }
                }
            }

            this._dailySales = dailySales;
            this._currentRango = rango;
            this.renderChart(dailySales, rango, this._chartMode || 'diario');
        }).catch(e => console.error('Error fetching KPIs', e));

        // 2. Inventario Valorizado
        const pInventario = supabase.rpc('get_inventario_valorizado', {
            p_search: '', p_page: 1, p_limit: 1, p_export_all: false
        }).then(({ data, error }) => {
            if (error) throw error;
            safeSetText('#kpi-inventario-valorizado', formatMoney(data?.gran_total || 0));
        }).catch(e => console.error('Error fetching inventario', e));

        // 3. Saldo Total Bancos (Cruzado con estado de cuenta activo)
        const pBancos = supabase.rpc('get_saldo_total_bancos')
            .then(({ data }) => {
                safeSetText('#kpi-saldo-bancos', formatMoney(data || 0));
            })
            .catch(e => console.error('Error fetching bancos', e));

        // 4. Cartera CxC & CxP
        const updateMicroBar = (total, vigentes, vencidas, barId, colors) => {
            const bar = element.querySelector(barId);
            if (!bar) return;
            const fills = bar.querySelectorAll('.dash-micro-fill');
            if (total <= 0) {
                if (fills[0]) { fills[0].style.width = '100%'; fills[0].style.background = 'var(--border-color)'; }
                if (fills[1]) fills[1].style.width = '0%';
                return;
            }
            const pctV = Math.max(0, Math.min(100, (vigentes / total) * 100));
            const pctVe = Math.max(0, Math.min(100, (vencidas / total) * 100));
            if (fills[0]) { fills[0].style.width = pctV + '%'; fills[0].style.background = colors[0]; }
            if (fills[1]) { fills[1].style.width = pctVe + '%'; fills[1].style.background = colors[1]; }
        };

        const updateCarteraUI = (kpis, prefix, colors) => {
            const total = kpis[`${prefix}_total`] || 0;
            const vigentes = kpis[`${prefix}_vigentes`] || 0;
            const vencidas = kpis[`${prefix}_vencidas`] || 0;
            const vigentesDoc = kpis[`${prefix}_vigentes_doc`] || 0;
            const vencidasDoc = kpis[`${prefix}_vencidas_doc`] || 0;

            safeSetText(`#kpi-${prefix}-total`, formatMoney(total));
            safeSetText(`#kpi-${prefix}-vigentes`, formatMoney(vigentes));
            safeSetText(`#kpi-${prefix}-vencidas`, formatMoney(vencidas));
            safeSetText(`#kpi-${prefix}-vigentes-doc`, `${vigentesDoc} documentos`);
            safeSetText(`#kpi-${prefix}-vencidas-doc`, `${vencidasDoc} documentos`);
            
            const badge = element.querySelector(`#kpi-${prefix}-badge-mora`);
            if (badge) {
                if (vencidasDoc > 0) {
                    badge.textContent = `${vencidasDoc} vencida${vencidasDoc > 1 ? 's' : ''}`;
                    badge.style.display = '';
                } else {
                    badge.style.display = 'none';
                }
            }
            updateMicroBar(total, vigentes, vencidas, `#kpi-${prefix}-progress`, colors);
        };

        const pCartera = supabase.rpc('get_dashboard_cartera_kpis')
            .then(({ data }) => {
                resolvedCartera = data || {};
                const kpis = resolvedCartera;
                updateCarteraUI(kpis, 'cxc', ['#059669', '#dc2626']);
                updateCarteraUI(kpis, 'cxp', ['#64748b', '#d97706']);

                const cxcTotal = kpis.cxc_total || 0;
                const cxcVigentes = kpis.cxc_vigentes || 0;
                const tasaCobro = cxcTotal > 0 ? ((cxcVigentes / cxcTotal) * 100).toFixed(0) : '100';
                safeSetText('#kpi-tasa-cobranza', `${tasaCobro}% al día`);
            })
            .catch(e => console.error('Error fetching Cartera KPIs', e));

        // 5. Operaciones Recientes y Top Clientes
        const pTopOperaciones = supabase.rpc('get_facturas_con_saldos', {
            p_page: 1,
            p_limit: 5,
            p_sort_col: 'fecha',
            p_sort_dir: 'desc',
            p_search: '',
            p_filter_criteria: 'todos',
            p_tipo: 'venta'
        }).then(async ({ data: facturas, error }) => {
            if (error) throw error;
            const tbody = element.querySelector('#dash-top-clientes-tbody');
            if (!tbody) return;

            if (!facturas || facturas.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No se registran facturas en este periodo.</td></tr>`;
                return;
            }

            const contactoIds = [...new Set(facturas.map(f => f.contacto_id).filter(Boolean))];
            let contactosMap = {};
            if (contactoIds.length > 0) {
                try {
                    const { data: cdata } = await supabase.from('contactos').select('id, nombre, identificacion').in('id', contactoIds);
                    if (cdata) cdata.forEach(c => { contactosMap[c.id] = c; });
                } catch (err) {
                    console.warn('Error fetching contactos for dashboard', err);
                }
            }

            tbody.innerHTML = facturas.map(f => {
                const contacto = contactosMap[f.contacto_id] || { nombre: 'Cliente Consumidor Final', identificacion: '---' };
                const saldo = parseFloat(f.saldo_pendiente || 0);
                const total = parseFloat(f.total || 0);
                const estaPagada = saldo <= 0;
                const esVencida = !estaPagada && f.vencimiento && new Date(f.vencimiento + 'T00:00:00') < hoy;

                let badgeClass = 'status-pill--success';
                let badgeText = 'Al Día';
                if (esVencida) {
                    badgeClass = 'status-pill--danger';
                    badgeText = 'Vencida';
                } else if (!estaPagada) {
                    badgeClass = 'status-pill--warning';
                    badgeText = 'Pendiente';
                }

                const mono = getClientMonogram(contacto.nombre);

                return `
                    <tr>
                        <td class="py-2.5 px-3">
                            <div class="d-flex align-items-center gap-2.5">
                                <div class="client-avatar-monogram" style="background-color: ${mono.bg}; color: ${mono.color};">
                                    ${mono.initials}
                                </div>
                                <div class="d-flex flex-column min-w-0">
                                    <span class="fw-semibold text-main text-truncate" style="max-width: 200px;" title="${escapeHtml(contacto.nombre)}">${escapeHtml(contacto.nombre)}</span>
                                    <span class="text-muted" style="font-size: 11px;">Factura #${f.numero || f.id}</span>
                                </div>
                            </div>
                        </td>
                        <td class="py-2.5 px-3 text-muted" style="font-size: 12px; white-space: nowrap;">${f.fecha || '---'}</td>
                        <td class="py-2.5 px-3 text-end fw-bold text-main tabular-nums">${formatMoney(total)}</td>
                        <td class="py-2.5 px-3 text-end tabular-nums text-muted">${saldo > 0 ? formatMoney(saldo) : '<span class="text-success">$0</span>'}</td>
                        <td class="py-2.5 px-3 text-center">
                            <span class="status-pill ${badgeClass}">
                                <span class="pill-dot"></span>
                                <span>${badgeText}</span>
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        }).catch(e => {
            console.error('Error fetching top operaciones', e);
            const tbody = element.querySelector('#dash-top-clientes-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">No fue posible cargar las operaciones recientes.</td></tr>`;
        });

        // Lanzar TODAS en paralelo y esperar a que terminen para asegurar consistencia
        await Promise.all([pKPIs, pInventario, pBancos, pCartera, pTopOperaciones]);
    },

    renderChart(dailySales, rango, mode = 'diario') {
        const canvas = document.getElementById('ventasChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (window.myVentasChart) {
            window.myVentasChart.destroy();
        }

        const isDark = document.documentElement.getAttribute('data-theme')?.startsWith('dark');
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)';
        const tickColor = isDark ? '#94a3b8' : '#64748b';
        const primaryBlue = isDark ? '#38bdf8' : '#2563eb';

        const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const currentMonthName = monthNames[new Date().getMonth()];
        const currentYear = new Date().getFullYear();

        const labels = Object.keys(dailySales).map(date => {
            const [y, m, d] = date.split('-');
            return `${parseInt(d)} ${monthNames[parseInt(m)-1]}`;
        });
        
        let dataVentas;
        let datasetLabel;

        if (mode === 'acumulado') {
            let runningSum = 0;
            dataVentas = Object.values(dailySales).map(val => {
                if (val === null || val === undefined) return null;
                runningSum += val;
                return runningSum;
            });
            datasetLabel = (rango === 'Mes actual' || rango === 'Este Mes')
                ? `Venta Acumulada ${currentMonthName} ${currentYear}`
                : `Venta Acumulada (${rango})`;
        } else {
            dataVentas = Object.values(dailySales);
            datasetLabel = (rango === 'Mes actual' || rango === 'Este Mes')
                ? `Ventas Diarias ${currentMonthName} ${currentYear}`
                : `Ventas Diarias (${rango})`;
        }

        window.myVentasChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: datasetLabel,
                        data: dataVentas,
                        borderColor: primaryBlue,
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const {ctx, chartArea} = chart;
                            if (!chartArea) return null;
                            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, isDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(37, 99, 235, 0.22)');
                            gradient.addColorStop(1, isDark ? 'rgba(56, 189, 248, 0.0)' : 'rgba(37, 99, 235, 0.0)');
                            return gradient;
                        },
                        fill: true,
                        borderWidth: 2.5,
                        tension: 0.35, 
                        pointRadius: dataVentas.length > 31 ? 0 : 2.5,
                        pointHoverRadius: 6,
                        pointBackgroundColor: primaryBlue,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 16,
                            color: tickColor,
                            font: { size: 11, family: "'Inter', sans-serif" }
                        }
                    },
                    tooltip: {
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(15, 23, 42, 0.92)',
                        titleColor: '#f8fafc',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(255,255,255,0.15)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10,
                        displayColors: false,
                        titleFont: { family: "'Plus Jakarta Sans', 'Inter', sans-serif", size: 12, weight: '600' },
                        bodyFont: { family: "'Inter', sans-serif", size: 13, weight: '700' },
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null && context.parsed.y !== undefined) {
                                    label += new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        border: { display: false },
                        grid: {
                            color: gridColor,
                            drawBorder: false,
                        },
                        ticks: {
                            color: tickColor,
                            font: { size: 10, family: "'Inter', sans-serif" },
                            callback: function(value) {
                                if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
                                if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'K';
                                return '$' + value;
                            }
                        }
                    },
                    x: {
                        border: { display: false },
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: tickColor,
                            font: { size: 10, family: "'Inter', sans-serif" },
                            maxTicksLimit: 14
                        }
                    }
                }
            }
        });
    }
};

