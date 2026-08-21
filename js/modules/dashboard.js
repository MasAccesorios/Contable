// js/modules/dashboard.js
import DB from '../core/db.js';
import { supabase } from '../core/supabase.js';

export const DashboardModule = {
    async init(element) {
        if (!element) return;

        element.innerHTML = `
            <div class="p-3 p-md-4" style="background-color: transparent; min-height: 100vh;">
                <div class="dash-layout">

                <!-- ═══ HEADER ═══ -->
                <div class="dash-header">
                    <div>
                        <h3 class="fw-bold mb-0" style="font-size: var(--fs-lg); color: var(--text-main); letter-spacing: -0.3px;">Resumen del negocio</h3>
                        <p class="mb-0 text-muted" style="font-size: var(--fs-sm); margin-top: 2px;">Vista consolidada en tiempo real</p>
                    </div>
                    <div class="dashboard-pill-group" role="group" id="dashboard-rango-filtro">
                        <button type="button" class="dpg-btn" data-rango="7 Días">7 Días</button>
                        <button type="button" class="dpg-btn dpg-btn--active" data-rango="Este Mes">Este Mes</button>
                        <button type="button" class="dpg-btn" data-rango="Este Año">Este Año</button>
                    </div>
                </div>

                <!-- ═══ CxC / CxP ═══ -->
                <div class="dash-grid-top">

                    <!-- Cuentas por cobrar -->
                    <div class="dash-card-premium dash-card-link" onclick="window.location.hash = '#/cartera'" tabindex="0">
                            <div class="d-flex justify-content-between align-items-start mb-1">
                                <div>
                                    <span class="dash-card-label"><i class="bi bi-arrow-down-circle me-1 text-success" style="font-size: var(--fs-sm);"></i>Cuentas por cobrar</span>
                                    <div class="dash-card-metric" id="kpi-cxc-total"><span class="spinner-border spinner-border-sm text-secondary"></span></div>
                                </div>
                                <span class="badge dash-badge-mora" id="kpi-cxc-badge-mora" style="display:none;"></span>
                            </div>
                            <div class="dash-micro-bar" id="kpi-cxc-progress">
                                <div class="dash-micro-fill" style="width: 0%; background:#2dbda8;"></div>
                                <div class="dash-micro-fill" style="width: 0%; background:#f06548;"></div>
                            </div>
                            <div class="d-flex gap-4 mt-3">
                                <div class="dash-sub-item dash-sub-green">
                                    <span class="dash-sub-label">Vigentes</span>
                                    <span class="dash-sub-value" id="kpi-cxc-vigentes"><span class="spinner-border spinner-border-sm text-secondary"></span></span>
                                    <span class="dash-sub-docs" id="kpi-cxc-vigentes-doc">...</span>
                                </div>
                                <div class="dash-sub-item dash-sub-red">
                                    <span class="dash-sub-label">Vencidas</span>
                                    <span class="dash-sub-value" id="kpi-cxc-vencidas"><span class="spinner-border spinner-border-sm text-secondary"></span></span>
                                    <span class="dash-sub-docs" id="kpi-cxc-vencidas-doc">...</span>
                                </div>
                            </div>
                    </div>

                    <!-- Cuentas por pagar -->
                    <div class="dash-card-premium">
                            <div class="d-flex justify-content-between align-items-start mb-1">
                                <div>
                                    <span class="dash-card-label"><i class="bi bi-arrow-up-circle me-1 text-danger" style="font-size: var(--fs-sm);"></i>Cuentas por pagar</span>
                                    <div class="dash-card-metric" id="kpi-cxp-total"><span class="spinner-border spinner-border-sm text-secondary"></span></div>
                                </div>
                                <span class="badge dash-badge-mora dash-badge-mora--warning" id="kpi-cxp-badge-mora" style="display:none;"></span>
                            </div>
                            <div class="dash-micro-bar" id="kpi-cxp-progress">
                                <div class="dash-micro-fill" style="width: 0%; background:#6c757d;"></div>
                                <div class="dash-micro-fill" style="width: 0%; background:#fd7e14;"></div>
                            </div>
                            <div class="d-flex gap-4 mt-3">
                                <div class="dash-sub-item dash-sub-neutral">
                                    <span class="dash-sub-label">Vigentes</span>
                                    <span class="dash-sub-value" id="kpi-cxp-vigentes"><span class="spinner-border spinner-border-sm text-secondary"></span></span>
                                    <span class="dash-sub-docs" id="kpi-cxp-vigentes-doc">...</span>
                                </div>
                                <div class="dash-sub-item dash-sub-orange">
                                    <span class="dash-sub-label">Vencidas</span>
                                    <span class="dash-sub-value" id="kpi-cxp-vencidas"><span class="spinner-border spinner-border-sm text-secondary"></span></span>
                                    <span class="dash-sub-docs" id="kpi-cxp-vencidas-doc">...</span>
                                </div>
                            </div>
                    </div>
                </div>

                <!-- ═══ 4 MICRO-KPIs ═══ -->
                <div class="dash-grid-kpis">

                    <!-- Utilidad -->
                    <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                        <div class="d-flex justify-content-between align-items-start">
                            <span class="dash-kpi-label">Utilidad del mes</span>
                            <div class="dash-icon-box variant-green">
                                <i class="bi bi-graph-up-arrow"></i>
                            </div>
                        </div>
                        <div class="dash-kpi-value" id="kpi-utilidad-mes"><span class="spinner-border spinner-border-sm text-secondary"></span></div>
                    </div>

                    <!-- Productos vendidos -->
                    <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                        <div class="d-flex justify-content-between align-items-start">
                            <span class="dash-kpi-label">Productos vendidos</span>
                            <div class="dash-icon-box variant-blue">
                                <i class="bi bi-box-seam"></i>
                            </div>
                        </div>
                        <div class="dash-kpi-value" id="kpi-productos"><span class="spinner-border spinner-border-sm text-secondary"></span></div>
                    </div>

                    <!-- Inventario Valorizado -->
                    <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                        <div class="d-flex justify-content-between align-items-start">
                            <span class="dash-kpi-label">Inventario val.</span>
                            <div class="dash-icon-box variant-blue">
                                <i class="bi bi-boxes"></i>
                            </div>
                        </div>
                        <div class="dash-kpi-value" id="kpi-inventario-valorizado"><span class="spinner-border spinner-border-sm text-secondary"></span></div>
                    </div>

                    <!-- Saldo Bancos -->
                    <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                        <div class="d-flex justify-content-between align-items-start">
                            <span class="dash-kpi-label">Saldo bancos</span>
                            <div class="dash-icon-box variant-cyan">
                                <i class="bi bi-bank"></i>
                            </div>
                        </div>
                        <div class="dash-kpi-value" id="kpi-saldo-bancos"><span class="spinner-border spinner-border-sm text-secondary"></span></div>
                    </div>

                </div>

                <!-- Chart Section -->
                <div class="card dash-chart-card mb-4">
                    <div class="card-body p-4">
                    <div class="dash-chart-header">
                            <div>
                                <h6 class="text-dark text-body mb-1 fw-bold">Total de ventas <i class="bi bi-info-circle ms-1 text-muted"></i></h6>
                                <div class="d-flex gap-4 mt-3">
                                    <div>
                                        <span class="text-muted d-block text-uppercase fw-semibold" style="font-size: var(--fs-xxs); letter-spacing: 0.5px;">Ticket Promedio</span>
                                        <span class="text-dark fw-bold" id="kpi-ticket-promedio" style="font-size: var(--fs-md);"><span class="spinner-border spinner-border-sm text-secondary"></span></span>
                                    </div>
                                    <div>
                                        <span class="text-muted d-block text-uppercase fw-semibold" style="font-size: var(--fs-xxs); letter-spacing: 0.5px;">Promedio Diario</span>
                                        <span class="text-dark fw-bold" id="kpi-promedio-diario" style="font-size: var(--fs-md);"><span class="spinner-border spinner-border-sm text-secondary"></span></span>
                                    </div>
                                </div>
                            </div>
                            <div class="text-end">
                                <div class="d-flex align-items-center justify-content-end gap-2 mb-1">
                                    <h3 class="text-metric mb-0 text-dark fw-bold" id="kpi-total-ventas"><span class="spinner-border spinner-border-sm text-secondary"></span></h3>
                                    <span id="kpi-ventas-growth-badge" class="badge px-2 py-1" style="font-size: var(--fs-sm); border-radius: 6px; display: none;">
                                        <i id="kpi-ventas-growth-icon" class="bi me-1"></i> <span id="kpi-ventas-growth-text">...</span>
                                    </span>
                                </div>
                                <small id="kpi-ventas-growth-label" class="text-muted fw-medium" style="font-size: var(--fs-xs);">vs periodo anterior</small>
                            </div>
                        </div>
                        
                        <div style="height: 280px; width: 100%; position: relative;">
                            <canvas id="ventasChart"></canvas>
                        </div>
                    </div>
                </div>

                </div><!-- /.dash-layout -->
            </div>
        `;

        // Ensure Chart.js is loaded
        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = async () => {
                await this.loadData(element);
                this.setupFilters(element);
            };
            document.head.appendChild(script);
        } else {
            await this.loadData(element);
            this.setupFilters(element);
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
                    this.renderDynamicContent(element, e.target.dataset.rango);
                }
            });
        }
    },

    async loadData(element) {
        if (this._loading) return;
        this._loading = true;
        try {
            console.time('dashboard-total-load');

            console.time('fetch-parallel');
            const [facturas, lotes, contactos, dbCuentas, productos] = await Promise.all([
                DB.getAll('facturas'),
                DB.getAll('lotes_fifo'),
                DB.getAll('contactos'),
                DB.getAll('cuentas_bancarias'),
                DB.getAll('productos')
            ]);
            this.facturas = facturas;
            this.lotes = lotes;
            this.contactos = contactos;
            this.cuentasActivas = (dbCuentas || []).filter(c => c.estado === 'active' || c.estado === 'activo');
            this.productos = productos;
            console.timeEnd('fetch-parallel');

            const { data: saldosRPC } = await supabase.rpc('get_saldos_por_cuenta');
            this.saldosRPC = saldosRPC;

            console.timeEnd('dashboard-total-load');

            const select = element.querySelector('#dashboard-rango-filtro .dpg-btn--active');
            await this.renderDynamicContent(element, select ? select.dataset.rango : 'Este Mes');
        } finally {
            this._loading = false;
        }
    },

    async renderDynamicContent(element, rango) {
        console.time('render-dynamic-content');
        
        console.log('RANGO REAL:', JSON.stringify(rango));

        const facturas = this.facturas || [];
        const lotes = this.lotes || [];

        // Extract KPIs
        let ventasMes = 0;
        let utilidadMes = 0;
        let productosVendidos = 0;
        
        // Inventario Valorizado (Lógica unificada con valorizacion.js)
        let inventarioValorizado = 0;
        try {
            const { data: dataValorizacion, error: errorValorizacion } = await supabase.rpc('get_inventario_valorizado', {
                p_search: '',
                p_page: 1,
                p_limit: 1,
                p_export_all: false
            });
            if (errorValorizacion) throw errorValorizacion;
            inventarioValorizado = dataValorizacion?.gran_total || 0;
        } catch (e) {
            console.error('Error obteniendo inventario valorizado desde RPC:', e);
            inventarioValorizado = 0;
        }
        
        // Saldo Total Bancos (Usando la fuente de verdad de Supabase)
        let saldoBancos = 0;
        const saldosPorCuenta = {};
        if (this.cuentasActivas) {
            this.cuentasActivas.forEach(c => { saldosPorCuenta[c.id] = 0; });
        }
        if (this.saldosRPC) {
            this.saldosRPC.forEach(s => {
                if (saldosPorCuenta[s.cuenta_id] !== undefined) {
                    saldosPorCuenta[s.cuenta_id] = Number(s.saldo);
                }
            });
        }
        if (this.cuentasActivas) {
            this.cuentasActivas.forEach(c => { saldoBancos += (saldosPorCuenta[c.id] || 0); });
        }

        let cxcTotal = 0, cxcVigentes = 0, cxcVencidas = 0;
        let cxcVigentesDoc = 0, cxcVencidasDoc = 0;

        let cxpTotal = 0, cxpVigentes = 0, cxpVencidas = 0;
        let cxpVigentesDoc = 0, cxpVencidasDoc = 0;

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
        
        // Prepare chart data grouped by day for current month
        const dailySales = {};
        const iterDate = new Date(startDate);
        let elapsedDays = 0;
        while (iterDate <= endDate) {
            const dStr = `${iterDate.getFullYear()}-${String(iterDate.getMonth() + 1).padStart(2, '0')}-${String(iterDate.getDate()).padStart(2, '0')}`;
            if (iterDate <= hoy) {
                dailySales[dStr] = 0;
                elapsedDays++;
            } else {
                dailySales[dStr] = null;
            }
            iterDate.setDate(iterDate.getDate() + 1);
        }

        const facturasMesIds = [];
        let ventasPrev = 0;
        console.time('calc-ventas-utilidad-productos');
        facturas.forEach(f => {
            // Ignorar facturas anuladas para no inflar las ventas ni los productos
            if (f.estado === 'void' || f.estado === 'anulada') return;

            // Blindaje Fase 1: Ignorar compras en el dashboard de ingresos
            if (f.tipo === 'compra') return;

            if (f.fecha && f.fecha >= startDateStr && f.fecha <= endDateStr) {
                ventasMes += (f.total || 0);
                utilidadMes += (f.total || 0) - (f.total_costo || 0);
                facturasMesIds.push(f.id);
                
                if (dailySales[f.fecha] !== undefined) {
                    dailySales[f.fecha] += (f.total || 0);
                }
            }
            
            if (f.fecha && f.fecha >= prevStartDateStr && f.fecha <= prevEndDateStr) {
                ventasPrev += (f.total || 0);
            }
        });
        console.timeEnd('calc-ventas-utilidad-productos');

        console.time('fetch-productos-vendidos');
        if (facturasMesIds.length > 0) {
            const { data: detallesMes } = await supabase
                .from('factura_detalles')
                .select('cantidad')
                .in('factura_id', facturasMesIds);
            
            if (detallesMes) {
                productosVendidos = detallesMes.reduce((sum, d) => sum + (d.cantidad || 0), 0);
            }
        }
        console.timeEnd('fetch-productos-vendidos');

        console.time('fetch-cartera-rpc');
        // Cartera CxC y CxP via RPC — el servidor calcula los saldos, evita traer transacciones completas
        const [{ data: carteraCxC }, { data: carteraCxP }] = await Promise.all([
            supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxc' }),
            supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxp' })
        ]);
        console.timeEnd('fetch-cartera-rpc');
        
        console.time('iteracion-cxc');
        carteraCxC.forEach(f => {
            const isVencida = new Date(f.vencimiento) < hoy;
            cxcTotal += f.saldo;
            if (isVencida) { cxcVencidas += f.saldo; cxcVencidasDoc++; }
            else { cxcVigentes += f.saldo; cxcVigentesDoc++; }
        });
        console.timeEnd('iteracion-cxc');

        console.time('iteracion-cxp');
        carteraCxP.forEach(f => {
            const isVencida = new Date(f.vencimiento) < hoy;
            cxpTotal += f.saldo;
            if (isVencida) { cxpVencidas += f.saldo; cxpVencidasDoc++; }
            else { cxpVigentes += f.saldo; cxpVigentesDoc++; }
        });
        console.timeEnd('iteracion-cxp');

        console.time('render-dom-updates');
        // Update KPI values in DOM
        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        
        const safeSetText = (id, text) => {
            const el = element.querySelector(id);
            if (el) el.textContent = text;
        };

        safeSetText('#kpi-total-ventas', formatMoney(ventasMes));
        const margenPct = ventasMes > 0 ? ((utilidadMes / ventasMes) * 100) : 0;
        safeSetText('#kpi-utilidad-mes', `${margenPct.toFixed(1)}%`);
        safeSetText('#kpi-inventario-valorizado', formatMoney(inventarioValorizado));
        safeSetText('#kpi-saldo-bancos', formatMoney(saldoBancos));
        safeSetText('#kpi-productos', productosVendidos);

        const ticketProm = facturasMesIds.length > 0 ? (ventasMes / facturasMesIds.length) : 0;
        const promDiario = elapsedDays > 0 ? (ventasMes / elapsedDays) : 0;
        safeSetText('#kpi-ticket-promedio', formatMoney(ticketProm));
        safeSetText('#kpi-promedio-diario', formatMoney(promDiario));

        const growthBadge = element.querySelector('#kpi-ventas-growth-badge');
        const growthIcon = element.querySelector('#kpi-ventas-growth-icon');
        const growthText = element.querySelector('#kpi-ventas-growth-text');
        
        console.log('DEBUG DASHBOARD VENTAS PREVIAS:', {
            rango,
            prevStartDateStr,
            prevEndDateStr,
            ventasPrev,
            facturasLength: facturas.length
        });

        if (growthBadge) {
            if (ventasPrev === 0) {
                growthBadge.style.display = 'none';
            } else {
                growthBadge.style.display = 'inline-block';
                const growth = ((ventasMes - ventasPrev) / ventasPrev) * 100;
                const growthAbs = Math.abs(growth).toFixed(1);

                if (growth > 0) {
                    growthBadge.className = 'badge bg-success bg-opacity-10 text-success fw-bold px-2 py-1';
                    growthIcon.className = 'bi bi-arrow-up-right-circle-fill me-1';
                    growthText.textContent = `+${growthAbs}%`;
                } else if (growth < 0) {
                    growthBadge.className = 'badge bg-danger bg-opacity-10 text-danger fw-bold px-2 py-1';
                    growthIcon.className = 'bi bi-arrow-down-right-circle-fill me-1';
                    growthText.textContent = `-${growthAbs}%`;
                } else {
                    growthBadge.className = 'badge bg-secondary bg-opacity-10 text-secondary fw-bold px-2 py-1';
                    growthIcon.className = 'bi bi-dash-circle-fill me-1';
                    growthText.textContent = `0%`;
                }
            }
        }

        // CXC Update
        safeSetText('#kpi-cxc-total', formatMoney(cxcTotal));
        safeSetText('#kpi-cxc-vigentes', formatMoney(cxcVigentes));
        safeSetText('#kpi-cxc-vencidas', formatMoney(cxcVencidas));
        safeSetText('#kpi-cxc-vigentes-doc', `${cxcVigentesDoc} documentos`);
        safeSetText('#kpi-cxc-vencidas-doc', `${cxcVencidasDoc} documentos`);

        // CXP Update
        safeSetText('#kpi-cxp-total', formatMoney(cxpTotal));
        safeSetText('#kpi-cxp-vigentes', formatMoney(cxpVigentes));
        safeSetText('#kpi-cxp-vencidas', formatMoney(cxpVencidas));
        safeSetText('#kpi-cxp-vigentes-doc', `${cxpVigentesDoc} documentos`);
        safeSetText('#kpi-cxp-vencidas-doc', `${cxpVencidasDoc} documentos`);

        // Mora badges — CxC
        const cxcBadge = element.querySelector('#kpi-cxc-badge-mora');
        if (cxcBadge) {
            if (cxcVencidasDoc > 0) {
                cxcBadge.textContent = `${cxcVencidasDoc} vencida${cxcVencidasDoc > 1 ? 's' : ''}`;
                cxcBadge.style.display = '';
            } else {
                cxcBadge.style.display = 'none';
            }
        }
        // Mora badges — CxP
        const cxpBadge = element.querySelector('#kpi-cxp-badge-mora');
        if (cxpBadge) {
            if (cxpVencidasDoc > 0) {
                cxpBadge.textContent = `${cxpVencidasDoc} vencida${cxpVencidasDoc > 1 ? 's' : ''}`;
                cxpBadge.style.display = '';
            } else {
                cxpBadge.style.display = 'none';
            }
        }

        // Update micro-bars
        const updateMicroBar = (total, vigentes, vencidas, barId, colors) => {
            const bar = element.querySelector(barId);
            if (!bar) return;
            const fills = bar.querySelectorAll('.dash-micro-fill');
            if (total <= 0) {
                if (fills[0]) { fills[0].style.width = '100%'; fills[0].style.background = '#e9ecef'; }
                if (fills[1]) fills[1].style.width = '0%';
                return;
            }
            const pctV = Math.max(0, Math.min(100, (vigentes / total) * 100));
            const pctVe = Math.max(0, Math.min(100, (vencidas / total) * 100));
            if (fills[0]) { fills[0].style.width = pctV + '%'; fills[0].style.background = colors[0]; }
            if (fills[1]) { fills[1].style.width = pctVe + '%'; fills[1].style.background = colors[1]; }
        };
        updateMicroBar(cxcTotal, cxcVigentes, cxcVencidas, '#kpi-cxc-progress', ['#2dbda8', '#f06548']);
        updateMicroBar(cxpTotal, cxpVigentes, cxpVencidas, '#kpi-cxp-progress', ['#6c757d', '#fd7e14']);

        // Render Chart
        this.renderChart(dailySales, rango);

        console.timeEnd('render-dom-updates');
        console.timeEnd('render-dynamic-content');
    },

    renderChart(dailySales, rango) {
        const canvas = document.getElementById('ventasChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (window.myVentasChart) {
            window.myVentasChart.destroy();
        }

        const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const currentMonthName = monthNames[new Date().getMonth()];
        const currentYear = new Date().getFullYear();

        const labels = Object.keys(dailySales).map(date => {
            const [y, m, d] = date.split('-');
            return `${parseInt(d)} de ${monthNames[parseInt(m)-1]}`;
        });
        
        const dataVentas = Object.values(dailySales);
        
        // Mocking eliminado temporalmente para evitar datos falsos
        const dataAnterior = dataVentas.map(() => 0); // Todo en 0 temporalmente
        
        const datasetLabel = rango === 'Mes actual' ? `Ventas de ${currentMonthName} de ${currentYear}` : `Ventas últimos ${rango}`;

        window.myVentasChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: datasetLabel,
                        data: dataVentas,
                        borderColor: '#1877f2', // Azul corporativo
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const {ctx, chartArea} = chart;
                            if (!chartArea) return null;
                            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, 'rgba(24, 119, 242, 0.3)');
                            gradient.addColorStop(1, 'rgba(44, 191, 183, 0)');
                            return gradient;
                        },
                        fill: true,
                        borderWidth: 2.5,
                        tension: 0.4, 
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#1877f2',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        borderDash: []
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
                            padding: 20,
                            font: { size: 11, family: "'Inter', sans-serif" }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(context.parsed.y);
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
                            color: '#f0f0f0',
                            drawBorder: false,
                        },
                        ticks: {
                            font: { size: 10, color: '#a0a0a0' },
                            callback: function(value) {
                                if (value >= 1000000) return '$' + (value / 1000000) + 'M';
                                if (value >= 1000) return '$' + (value / 1000) + 'K';
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
                            font: { size: 10, color: '#a0a0a0' },
                            maxTicksLimit: 16
                        }
                    }
                }
            }
        });
    }
};

