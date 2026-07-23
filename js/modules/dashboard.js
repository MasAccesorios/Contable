// js/modules/dashboard.js
import DB from '../core/db.js';

export const DashboardModule = {
    async init(element) {
        if (!element) return;

        element.innerHTML = `
            <div class="p-4" style="background-color: transparent; min-height: 100vh;">
                <div class="d-flex justify-content-between align-items-center mb-4" style="max-width: 1100px; margin: 0 auto;">
                    <h3 class="text-title text-dark mb-0">Resumen del negocio</h3>
                    <div class="d-flex gap-2">
                        <select class="form-select form-select-sm shadow-sm border-0 text-dark fw-semibold" style="width:130px; border-radius:6px; font-size:14px; padding: 0.35rem 1.8rem 0.35rem 0.75rem;">
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
                                <h3 class="text-metric text-dark mb-3 mt-2" id="kpi-cxc-total">$2.291.444,00</h3>
                                
                                <div class="progress mb-4" style="height: 6px; border-radius: 3px;" id="kpi-cxc-progress">
                                    <div class="progress-bar" role="progressbar" style="width: 87%; background-color: #2dbda8;" aria-valuenow="87" aria-valuemin="0" aria-valuemax="100"></div>
                                    <div class="progress-bar" role="progressbar" style="width: 13%; background-color: #f06548;" aria-valuenow="13" aria-valuemin="0" aria-valuemax="100"></div>
                                </div>
                                
                                <div class="d-flex gap-4 mt-2">
                                    <div style="border-left: 3px solid #2dbda8; padding-left: 10px; flex: 1;">
                                        <span class="text-muted d-block mb-1 text-subtext">Vigentes</span>
                                        <span class="text-body fw-bold d-block text-dark" id="kpi-cxc-vigentes">$2.006.444,00</span>
                                        <span class="text-muted text-subtext" id="kpi-cxc-vigentes-doc">6 documentos</span>
                                    </div>
                                    <div style="border-left: 3px solid #f06548; padding-left: 10px; flex: 1;">
                                        <span class="text-muted d-block mb-1 text-subtext">Vencidas</span>
                                        <span class="text-body fw-bold d-block text-dark" id="kpi-cxc-vencidas">$285.000,00</span>
                                        <span class="text-muted text-subtext" id="kpi-cxc-vencidas-doc">1 documento</span>
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
                                <h3 class="text-metric text-dark mb-3 mt-2" id="kpi-cxp-total">$0,00</h3>
                                
                                <div class="progress mb-4" style="height: 6px; border-radius: 3px;" id="kpi-cxp-progress">
                                    <div class="progress-bar" role="progressbar" style="width: 100%; background-color: #e9ecef;" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100"></div>
                                </div>
                                
                                <div class="d-flex gap-4 mt-2">
                                    <div style="border-left: 3px solid #ced4da; padding-left: 10px; flex: 1;">
                                        <span class="text-muted d-block mb-1 text-subtext">Vigentes</span>
                                        <span class="text-body fw-bold d-block text-dark" id="kpi-cxp-vigentes">$0,00</span>
                                        <span class="text-muted text-subtext" id="kpi-cxp-vigentes-doc">0 documentos</span>
                                    </div>
                                    <div style="border-left: 3px solid #ced4da; padding-left: 10px; flex: 1;">
                                        <span class="text-muted d-block mb-1 text-subtext">Vencidas</span>
                                        <span class="text-body fw-bold d-block text-dark" id="kpi-cxp-vencidas">$0,00</span>
                                        <span class="text-muted text-subtext" id="kpi-cxp-vencidas-doc">0 documentos</span>
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
                                        <h5 class="text-title mb-0 text-success" id="kpi-utilidad-mes">$0,00</h5>
                                    </div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="card border-0 shadow-sm h-100" style="border-radius:10px;">
                                    <div class="card-body p-3">
                                        <h6 class="text-dark mb-3 text-subtext fw-bold">Productos vendidos</h6>
                                        <div class="d-flex justify-content-between align-items-end">
                                            <h5 class="text-title mb-0 text-dark" id="kpi-productos">0</h5>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="card border-0 shadow-sm h-100" style="border-radius:10px;">
                                    <div class="card-body p-3">
                                        <h6 class="text-dark mb-1 text-subtext fw-bold" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Inventario Valorizado</h6>
                                        <span class="text-muted mb-2 d-block text-subtext">Costo total (Stock Real)</span>
                                        <h5 class="text-title mb-0 text-primary" id="kpi-inventario-valorizado">$0,00</h5>
                                    </div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="card border-0 shadow-sm h-100" style="border-radius:10px;">
                                    <div class="card-body p-3">
                                        <h6 class="text-dark mb-3 text-subtext fw-bold">Saldo Total Bancos</h6>
                                        <h5 class="text-title mb-0 text-info" id="kpi-saldo-bancos">$0,00</h5>
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
                                    <h4 class="text-metric mb-0 text-dark" id="kpi-total-ventas">$0,00</h4>
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
            script.onload = () => this.loadData(element);
            document.head.appendChild(script);
        } else {
            await this.loadData(element);
        }
    },

    async loadData(element) {
        const [facturas, transacciones, lotes] = await Promise.all([
            DB.getAll('facturas'),
            DB.getAll('transacciones'),
            DB.getAll('lotes_fifo')
        ]);

        // Extract KPIs
        let ventasMes = 0;
        let utilidadMes = 0;
        let productosVendidos = 0;
        
        // Inventario Valorizado
        let inventarioValorizado = lotes.reduce((sum, l) => sum + (l.cantidadActual * l.costoUnitario), 0);
        
        // Saldo Total Bancos
        let saldoBancos = transacciones.reduce((sum, t) => sum + (t.tipo === 'ingreso' ? t.monto : -t.monto), 0);

        let cxcTotal = 0, cxcVigentes = 0, cxcVencidas = 0;
        let cxcVigentesDoc = 0, cxcVencidasDoc = 0;

        let cxpTotal = 0, cxpVigentes = 0, cxpVencidas = 0;
        let cxpVigentesDoc = 0, cxpVencidasDoc = 0;

        const hoy = new Date();
        hoy.setHours(0,0,0,0);

        // Ventas del mes actual dinámico
        const currentMonthPrefix = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
        
        // Prepare chart data grouped by day for current month
        const dailySales = {};
        const daysInMonth = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
        for(let i=1; i<=daysInMonth; i++) {
            dailySales[`${currentMonthPrefix}-${String(i).padStart(2, '0')}`] = 0;
        }

        facturas.forEach(f => {
            if (f.tipo === 'venta') {
                if (f.fecha.startsWith(currentMonthPrefix)) {
                    ventasMes += f.total;
                    utilidadMes += (f.utilidad || 0);
                    
                    if (f.detalles) {
                        f.detalles.forEach(d => { productosVendidos += d.cantidad; });
                    }
                    
                    if (dailySales[f.fecha] !== undefined) {
                        dailySales[f.fecha] += f.total;
                    }
                }
            }

            // Calculo de Cartera (CxC y CxP)
            if (f.estado === 'pendiente' || f.estado === 'parcial') {
                const pagos = transacciones
                    .filter(t => t.referenciaId === f.id && t.tipo === (f.tipo === 'venta' ? 'ingreso' : 'egreso'))
                    .reduce((sum, t) => sum + t.monto, 0);
                
                const saldoPendiente = f.total - pagos;
                if (saldoPendiente > 0.01) {
                    const dueDate = new Date(f.fecha);
                    dueDate.setDate(dueDate.getDate() + 30); // 30 días de plazo por defecto
                    const isVencida = dueDate < hoy;

                    if (f.tipo === 'venta') {
                        cxcTotal += saldoPendiente;
                        if (isVencida) { cxcVencidas += saldoPendiente; cxcVencidasDoc++; }
                        else { cxcVigentes += saldoPendiente; cxcVigentesDoc++; }
                    } else if (f.tipo === 'compra') {
                        cxpTotal += saldoPendiente;
                        if (isVencida) { cxpVencidas += saldoPendiente; cxpVencidasDoc++; }
                        else { cxpVigentes += saldoPendiente; cxpVigentesDoc++; }
                    }
                }
            }
        });

        // Update KPI values in DOM
        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2});
        
        const safeSetText = (id, text) => {
            const el = element.querySelector(id);
            if (el) el.textContent = text;
        };

        safeSetText('#kpi-total-ventas', formatMoney(ventasMes));
        safeSetText('#kpi-utilidad-mes', formatMoney(utilidadMes));
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
        this.renderChart(dailySales);
    },

    renderChart(dailySales) {
        const canvas = document.getElementById('ventasChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (window.myVentasChart) {
            window.myVentasChart.destroy();
        }

        const labels = Object.keys(dailySales).map(date => {
            const [y, m, d] = date.split('-');
            return `${parseInt(d)} de jul`;
        });
        
        const dataVentas = Object.values(dailySales);
        
        // Mocking a secondary dashed line like in the screenshot
        const dataAnterior = dataVentas.map(v => v > 0 ? v * (0.3 + Math.random()*0.9) : Math.random() * 500000);

        window.myVentasChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '1 de jul de 2026 - 17 de jul de 2026',
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
                    },
                    {
                        label: '1 de jul de 2025 - 17 de jul de 2025',
                        data: dataAnterior,
                        borderColor: '#2dbda8', // Verde punteado
                        backgroundColor: '#2dbda8',
                        borderWidth: 1.5,
                        tension: 0,
                        pointRadius: 2,
                        pointBackgroundColor: '#2dbda8',
                        borderDash: [5, 5] // Dashed line
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

