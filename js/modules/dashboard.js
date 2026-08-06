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
                        <select id="dashboard-rango-filtro" class="form-select form-select-sm shadow-sm border-0 text-dark fw-semibold" style="width:130px; border-radius:6px; font-size:14px; padding: 0.35rem 1.8rem 0.35rem 0.75rem;">
                            <option>Mes actual</option>
                            <option>1 mes</option>
                            <option>3 meses</option>
                            <option>6 meses</option>
                            <option>9 meses</option>
                            <option>12 meses</option>
                        </select>
                        <button class="btn btn-sm text-white shadow-sm fw-semibold" style="border-radius:6px; background-color:#2dbda8; border:none; font-size:0.85rem; padding:0.35rem 1rem;">
                            Agregar gráfico <i class="bi bi-chevron-down ms-1" style="font-size:0.7rem;"></i>
                        </button>
                    </div>
                </div>

                <!-- Cards Row -->
                <div class="row g-3 mb-4" style="max-width: 1100px; margin: 0 auto;">
                    <!-- Cuentas por cobrar -->
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm h-100" style="border-radius:10px;">
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
                                <div class="card border-0 shadow-sm h-100" style="border-radius:10px;">
                                    <div class="card-body p-3">
                                        <h6 class="text-dark mb-3 text-subtext fw-bold">Utilidad (Mes Actual)</h6>
                                        <h5 class="text-title mb-0 text-success" id="kpi-utilidad-mes"><span class="spinner-border spinner-border-sm text-secondary"></span></h5>
                                    </div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="card border-0 shadow-sm h-100" style="border-radius:10px;">
                                    <div class="card-body p-3">
                                        <h6 class="text-dark mb-3 text-subtext fw-bold">Productos vendidos</h6>
                                        <div class="d-flex justify-content-between align-items-end">
                                            <h5 class="text-title mb-0 text-dark" id="kpi-productos"><span class="spinner-border spinner-border-sm text-secondary"></span></h5>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="card border-0 shadow-sm h-100" style="border-radius:10px;">
                                    <div class="card-body p-3">
                                        <h6 class="text-dark mb-1 text-subtext fw-bold" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Inventario Valorizado</h6>
                                        <span class="text-muted mb-2 d-block text-subtext">Costo total (Stock Real)</span>
                                        <h5 class="text-title mb-0 text-primary" id="kpi-inventario-valorizado"><span class="spinner-border spinner-border-sm text-secondary"></span></h5>
                                    </div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="card border-0 shadow-sm h-100" style="border-radius:10px;">
                                    <div class="card-body p-3">
                                        <h6 class="text-dark mb-3 text-subtext fw-bold">Saldo Total Bancos</h6>
                                        <h5 class="text-title mb-0 text-info" id="kpi-saldo-bancos"><span class="spinner-border spinner-border-sm text-secondary"></span></h5>
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
                                <h6 class="text-dark text-body mb-1">Total de ventas <i class="bi bi-info-circle ms-1 text-muted"></i></h6>
                                <small class="text-muted text-subtext">La gráfica muestra el valor de las ventas sin impuestos incluidos.</small>
                            </div>
                            <div class="text-end">
                                <div class="d-flex align-items-center justify-content-end">
                                    <h4 class="text-metric mb-0 text-dark" id="kpi-total-ventas"><span class="spinner-border spinner-border-sm text-secondary"></span></h4>
                                </div>
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
        const select = element.querySelector('#dashboard-rango-filtro');
        if (select) {
            select.addEventListener('change', (e) => {
                this.renderDynamicContent(element, e.target.value);
            });
        }
    },

    async loadData(element) {
        console.time('dashboard-total-load');

        console.time('fetch-parallel');
        const [facturas, lotes, contactos, dbCuentas] = await Promise.all([
            DB.getAll('facturas'),
            DB.getAll('lotes_fifo'),
            DB.getAll('contactos'),
            DB.getAll('cuentas_bancarias')
        ]);
        this.facturas = facturas;
        this.lotes = lotes;
        this.contactos = contactos;
        this.cuentasActivas = (dbCuentas || []).filter(c => c.estado === 'active' || c.estado === 'activo');
        console.timeEnd('fetch-parallel');

        const { data: saldosRPC } = await supabase.rpc('get_saldos_por_cuenta');
        this.saldosRPC = saldosRPC;

        console.timeEnd('dashboard-total-load');

        const select = element.querySelector('#dashboard-rango-filtro');
        await this.renderDynamicContent(element, select ? select.value : 'Mes actual');
    },

    async renderDynamicContent(element, rango) {
        console.time('render-dynamic-content');

        const facturas = this.facturas || [];
        const lotes = this.lotes || [];

        // Extract KPIs
        let ventasMes = 0;
        let utilidadMes = 0;
        let productosVendidos = 0;
        
        // Inventario Valorizado
        let inventarioValorizado = lotes.reduce((sum, l) => sum + (l.cantidadActual * l.costoUnitario), 0);
        
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

        if (rango === 'Mes actual') {
            startDate.setDate(1);
            endDate = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0); // Last day of month
        } else {
            const months = parseInt(rango.split(' ')[0]) || 1;
            startDate.setMonth(startDate.getMonth() - months);
        }

        const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        
        // Prepare chart data grouped by day for current month
        const dailySales = {};
        const iterDate = new Date(startDate);
        while (iterDate <= endDate) {
            const dStr = `${iterDate.getFullYear()}-${String(iterDate.getMonth() + 1).padStart(2, '0')}-${String(iterDate.getDate()).padStart(2, '0')}`;
            dailySales[dStr] = 0;
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
        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2});
        
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
                        borderColor: '#1e5dd1', // Azul oscuro de la imagen
                        backgroundColor: '#1e5dd1',
                        borderWidth: 1.5,
                        tension: 0, 
                        pointRadius: 3,
                        pointBackgroundColor: '#1e5dd1',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 1,
                        borderDash: []
                    }
                    /* Dataset de ventas del año pasado oculto temporalmente
                    ,{
                        label: `Ventas de ${currentMonthName} de ${currentYear - 1}`,
                        data: dataAnterior,
                        borderColor: '#2dbda8', // Verde punteado
                        backgroundColor: '#2dbda8',

                        borderWidth: 1.5,
                        tension: 0,
                        pointRadius: 2,
                        pointBackgroundColor: '#2dbda8',
                        borderDash: [5, 5] // Dashed line
                    }
                    */
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
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#333',
                        bodyColor: '#666',
                        borderColor: '#e5e5e5',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: true,
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

