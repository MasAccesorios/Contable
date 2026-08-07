// js/modules/dashboard.js
import DB from '../core/db.js';
import { supabase } from '../core/supabase.js';

export const DashboardModule = {
    async init(element) {
        if (!element) return;

        element.innerHTML = `
            <div class="p-4" style="background-color: transparent; min-height: 100vh;">
                <div class="d-flex justify-content-between align-items-center mb-4" style="max-width: 1100px; margin: 0 auto;">
                    <h3 class="text-title text-dark mb-0">Resumen del negocio</h3>
                    <div class="d-flex gap-2">
                        <div class="btn-group shadow-sm" role="group" id="dashboard-rango-filtro">
                            <button type="button" class="btn btn-outline-primary btn-sm fw-medium px-3" data-rango="7 Días">7 Días</button>
                            <button type="button" class="btn btn-primary btn-sm fw-medium px-3 active text-white" data-rango="Este Mes" style="background-color: #1877f2; border-color: #1877f2;">Este Mes</button>
                            <button type="button" class="btn btn-outline-primary btn-sm fw-medium px-3" data-rango="Este Año">Este Año</button>
                        </div>
                        <button class="btn btn-sm text-white shadow-sm fw-semibold" style="border-radius:6px; background-color:#2dbda8; border:none; font-size:0.85rem; padding:0.35rem 1rem;">
                            Agregar gráfico <i class="bi bi-chevron-down ms-1" style="font-size:0.7rem;"></i>
                        </button>
                    </div>
                </div>

                <!-- Cards Row -->
                <div class="row g-3 mb-4" style="max-width: 1100px; margin: 0 auto;">
                    <!-- Cuentas por cobrar -->
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm h-100" style="border-radius:10px; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'" onclick="window.location.hash = '#/cartera'">
                            <div class="card-body p-4">
                                <h6 class="text-dark mb-3 text-body">Cuentas por cobrar</h6>
                                <h3 class="text-metric text-dark mb-3 mt-2" id="kpi-cxc-total"><span class="spinner-border spinner-border-sm text-secondary"></span></h3>
                                
                                <div class="progress mb-4" style="height: 6px; border-radius: 3px;" id="kpi-cxc-progress">
                                    <div class="progress-bar" role="progressbar" style="width: 87%; background-color: #2dbda8;" aria-valuenow="87" aria-valuemin="0" aria-valuemax="100"></div>
                                    <div class="progress-bar" role="progressbar" style="width: 13%; background-color: #f06548;" aria-valuenow="13" aria-valuemin="0" aria-valuemax="100"></div>
                                </div>
                                
                                <div class="d-flex gap-4 mt-2">
                                    <div style="border-left: 3px solid #2dbda8; padding-left: 10px; flex: 1;">
                                        <span class="text-muted d-block mb-1 text-subtext">Vigentes</span>
                                        <span class="text-body fw-bold d-block text-dark" id="kpi-cxc-vigentes"><span class="spinner-border spinner-border-sm text-secondary"></span></span>
                                        <span class="text-muted text-subtext" id="kpi-cxc-vigentes-doc">...</span>
                                    </div>
                                    <div style="border-left: 3px solid #f06548; padding-left: 10px; flex: 1;">
                                        <span class="text-muted d-block mb-1 text-subtext">Vencidas</span>
                                        <span class="text-body fw-bold d-block text-dark" id="kpi-cxc-vencidas"><span class="spinner-border spinner-border-sm text-secondary"></span></span>
                                        <span class="text-muted text-subtext" id="kpi-cxc-vencidas-doc">...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Cuentas por pagar -->
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm h-100" style="border-radius:10px;">
                            <div class="card-body p-4">
                                <h6 class="text-dark mb-3 text-body">Cuentas por pagar</h6>
                                <h3 class="text-metric text-dark mb-3 mt-2" id="kpi-cxp-total"><span class="spinner-border spinner-border-sm text-secondary"></span></h3>
                                
                                <div class="progress mb-4" style="height: 6px; border-radius: 3px;" id="kpi-cxp-progress">
                                    <div class="progress-bar" role="progressbar" style="width: 100%; background-color: #e9ecef;" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100"></div>
                                </div>
                                
                                <div class="d-flex gap-4 mt-2">
                                    <div style="border-left: 3px solid #ced4da; padding-left: 10px; flex: 1;">
                                        <span class="text-muted d-block mb-1 text-subtext">Vigentes</span>
                                        <span class="text-body fw-bold d-block text-dark" id="kpi-cxp-vigentes"><span class="spinner-border spinner-border-sm text-secondary"></span></span>
                                        <span class="text-muted text-subtext" id="kpi-cxp-vigentes-doc">...</span>
                                    </div>
                                    <div style="border-left: 3px solid #ced4da; padding-left: 10px; flex: 1;">
                                        <span class="text-muted d-block mb-1 text-subtext">Vencidas</span>
                                        <span class="text-body fw-bold d-block text-dark" id="kpi-cxp-vencidas"><span class="spinner-border spinner-border-sm text-secondary"></span></span>
                                        <span class="text-muted text-subtext" id="kpi-cxp-vencidas-doc">...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 4 Small KPIs -->
                    <div class="col-md-4">
                        <div class="row g-3 h-100">
                            <div class="col-6">
                                <div class="card border-0 shadow-sm h-100 border-start border-4 border-success bg-success bg-opacity-10" style="border-radius:10px;">
                                    <div class="card-body p-3 position-relative">
                                        <i class="bi bi-graph-up-arrow position-absolute top-0 end-0 mt-3 me-3 text-success fs-5 opacity-75"></i>
                                        <h6 class="text-dark mb-3 text-subtext fw-bold pe-4">Utilidad (Mes)</h6>
                                        <h5 class="text-title mb-0 text-success fw-bold" style="font-size: 1.1rem;" id="kpi-utilidad-mes"><span class="spinner-border spinner-border-sm text-secondary"></span></h5>
                                    </div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="card border-0 shadow-sm h-100 border-start border-4 border-dark bg-secondary bg-opacity-10" style="border-radius:10px;">
                                    <div class="card-body p-3 position-relative">
                                        <i class="bi bi-box-seam position-absolute top-0 end-0 mt-3 me-3 text-dark fs-5 opacity-75"></i>
                                        <h6 class="text-dark mb-3 text-subtext fw-bold pe-4">Productos</h6>
                                        <h5 class="text-title mb-0 text-dark fw-bold" style="font-size: 1.1rem;" id="kpi-productos"><span class="spinner-border spinner-border-sm text-secondary"></span></h5>
                                    </div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="card border-0 shadow-sm h-100 border-start border-4 border-primary bg-primary bg-opacity-10" style="border-radius:10px;">
                                    <div class="card-body p-3 position-relative">
                                        <i class="bi bi-boxes position-absolute top-0 end-0 mt-3 me-3 text-primary fs-5 opacity-75"></i>
                                        <h6 class="text-dark mb-1 text-subtext fw-bold pe-4" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Inventario Val.</h6>
                                        <span class="text-muted mb-2 d-block text-subtext">Costo total</span>
                                        <h5 class="text-title mb-0 text-primary fw-bold" style="font-size: 1.1rem;" id="kpi-inventario-valorizado"><span class="spinner-border spinner-border-sm text-secondary"></span></h5>
                                    </div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="card border-0 shadow-sm h-100 border-start border-4 border-info bg-info bg-opacity-10" style="border-radius:10px;">
                                    <div class="card-body p-3 position-relative">
                                        <i class="bi bi-bank position-absolute top-0 end-0 mt-3 me-3 text-info fs-5 opacity-75"></i>
                                        <h6 class="text-dark mb-3 text-subtext fw-bold pe-4">Saldo Bancos</h6>
                                        <h5 class="text-title mb-0 text-info fw-bold" style="font-size: 1.1rem;" id="kpi-saldo-bancos"><span class="spinner-border spinner-border-sm text-secondary"></span></h5>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Chart Section -->
                <div class="card border-0 shadow-sm mb-4" style="max-width: 1100px; margin: 0 auto; border-radius:10px;">
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-start mb-4">
                            <div>
                                <h6 class="text-dark text-body mb-1 fw-bold">Total de ventas <i class="bi bi-info-circle ms-1 text-muted"></i></h6>
                                <div class="d-flex gap-4 mt-3">
                                    <div>
                                        <span class="text-muted d-block text-uppercase fw-semibold" style="font-size: 10px; letter-spacing: 0.5px;">Ticket Promedio</span>
                                        <span class="text-dark fw-bold" id="kpi-ticket-promedio" style="font-size: 14px;"><span class="spinner-border spinner-border-sm text-secondary"></span></span>
                                    </div>
                                    <div>
                                        <span class="text-muted d-block text-uppercase fw-semibold" style="font-size: 10px; letter-spacing: 0.5px;">Promedio Diario</span>
                                        <span class="text-dark fw-bold" id="kpi-promedio-diario" style="font-size: 14px;"><span class="spinner-border spinner-border-sm text-secondary"></span></span>
                                    </div>
                                </div>
                            </div>
                            <div class="text-end">
                                <div class="d-flex align-items-center justify-content-end gap-2 mb-1">
                                    <h3 class="text-metric mb-0 text-dark fw-bold" id="kpi-total-ventas"><span class="spinner-border spinner-border-sm text-secondary"></span></h3>
                                    <span class="badge bg-success bg-opacity-10 text-success fw-bold px-2 py-1" style="font-size: 12px; border-radius: 6px;">
                                        <i class="bi bi-arrow-up-right-circle-fill me-1"></i> +12%
                                    </span>
                                </div>
                                <small class="text-muted fw-medium" style="font-size: 11px;">vs mes anterior</small>
                            </div>
                        </div>
                        
                        <div style="height: 280px; width: 100%; position: relative;">
                            <canvas id="ventasChart"></canvas>
                        </div>
                    </div>
                </div>
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
                    const buttons = filterGroup.querySelectorAll('button');
                    buttons.forEach(btn => {
                        btn.className = 'btn btn-outline-primary btn-sm fw-medium px-3';
                        btn.style.backgroundColor = '';
                        btn.style.borderColor = '';
                    });
                    e.target.className = 'btn btn-primary btn-sm fw-medium px-3 active text-white';
                    e.target.style.backgroundColor = '#1877f2';
                    e.target.style.borderColor = '#1877f2';
                    this.renderDynamicContent(element, e.target.dataset.rango);
                }
            });
        }
    },

    async loadData(element) {
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

        const select = element.querySelector('#dashboard-rango-filtro .active');
        await this.renderDynamicContent(element, select ? select.dataset.rango : 'Este Mes');
    },

    async renderDynamicContent(element, rango) {
        console.time('render-dynamic-content');

        const facturas = this.facturas || [];
        const lotes = this.lotes || [];

        // Extract KPIs
        let ventasMes = 0;
        let utilidadMes = 0;
        let productosVendidos = 0;
        
        // Inventario Valorizado (Lógica unificada con valorizacion.js)
        let inventarioValorizado = 0;
        const productosActivos = (this.productos || []).filter(p => p.estado !== 'inactivo' && p.estado !== 'inactive');
        
        productosActivos.forEach(p => {
            const stockTotal = parseFloat(p.stock) || 0;
            
            const lotesProd = (lotes || []).filter(l => l.productoId === p.id);
            const lotesPositivos = lotesProd.filter(l => l.cantidadActual > 0);
            const stockLotesPos = lotesPositivos.reduce((sum, l) => sum + l.cantidadActual, 0);
            const costoLotes = lotesPositivos.reduce((sum, l) => sum + (l.cantidadActual * (l.costoUnitario || 0)), 0);
            
            const costoPromedio = stockTotal > 0 ? 
                (stockLotesPos > 0 ? costoLotes / stockLotesPos : (parseFloat(p.costoBase) || 0)) 
                : (parseFloat(p.costoBase) || 0);
            
            const valorTotal = stockTotal * costoPromedio;
            const isRollo = p.sku && p.sku.startsWith('500');
            inventarioValorizado += (stockTotal < 0 && !isRollo) ? 0 : valorTotal;
        });
        
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

        if (rango === 'Mes actual' || rango === 'Este Mes') {
            startDate.setDate(1);
            endDate = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0); // Last day of month
        } else if (rango === '7 Días') {
            startDate.setDate(hoy.getDate() - 6);
        } else if (rango === 'Este Año') {
            startDate.setMonth(0, 1);
        } else {
            const months = parseInt(rango.split(' ')[0]) || 1;
            startDate.setMonth(startDate.getMonth() - months);
        }

        const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        
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
        console.time('calc-ventas-utilidad-productos');
        facturas.forEach(f => {
            // Ignorar facturas anuladas para no inflar las ventas ni los productos
            if (f.estado === 'void' || f.estado === 'anulada') return;

            // Blindaje Fase 1: Ignorar compras en el dashboard de ingresos
            if (f.tipo === 'compra') return;

            // Se asume que toda factura es de venta (para el cálculo de ingresos del mes)
            if (f.fecha && f.fecha >= startDateStr && f.fecha <= endDateStr) {
                ventasMes += (f.total || 0);
                utilidadMes += (f.total || 0) - (f.total_costo || 0);
                facturasMesIds.push(f.id);
                
                if (dailySales[f.fecha] !== undefined) {
                    dailySales[f.fecha] += (f.total || 0);
                }
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

        // Update Progress Bars dynamically
        const updateProgress = (total, vigentes, vencidas, barId) => {
            const bar = element.querySelector(barId);
            if (!bar) return;
            if (total <= 0) {
                bar.innerHTML = `<div class="progress-bar" style="width: 100%; background-color: #e9ecef;"></div>`;
                return;
            }
            const pctVigentes = (vigentes / total) * 100;
            const pctVencidas = (vencidas / total) * 100;
            bar.innerHTML = `
                <div class="progress-bar" style="width: ${pctVigentes}%; background-color: #2dbda8;"></div>
                <div class="progress-bar" style="width: ${pctVencidas}%; background-color: #f06548;"></div>
            `;
        };
        updateProgress(cxcTotal, cxcVigentes, cxcVencidas, '#kpi-cxc-progress');
        updateProgress(cxpTotal, cxpVigentes, cxpVencidas, '#kpi-cxp-progress');

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

