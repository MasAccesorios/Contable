/* =====================================================
   MAS Accesorios - Page Templates
   ===================================================== */

const Pages = {
    /* =================================================
       INICIO (DASHBOARD)
       ================================================= */
    dashboard() {
        const m = DB.getDashboardMetrics();
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const fmtN = (n) => new Intl.NumberFormat('es-CO').format(n);

        return `
        <div class="fade-in">
            <div class="kpi-grid">
                <div class="kpi-card card-primary" onclick="App.navigateTo('ventas')" style="cursor:pointer">
                    <div class="kpi-label">
                        <div class="icon-circle"><i class="bi bi-cart-check-fill"></i></div>
                        Ventas del Mes
                    </div>
                    <div class="kpi-value">${fmt(m.ventasMes)}</div>
                    <div class="kpi-sub">
                        <span class="kpi-badge ${parseFloat(m.cambioVentas) >= 0 ? 'up' : 'down'}">
                            <i class="bi bi-arrow-${parseFloat(m.cambioVentas) >= 0 ? 'up' : 'down'}"></i>
                            ${Math.abs(m.cambioVentas)}%
                        </span>
                        vs mes anterior
                    </div>
                </div>
                <div class="kpi-card card-success" onclick="App.navigateTo('reportes')" style="cursor:pointer">
                    <div class="kpi-label">
                        <div class="icon-circle"><i class="bi bi-graph-up"></i></div>
                        Utilidad del Mes
                    </div>
                    <div class="kpi-value">${fmt(m.utilidadMes)}</div>
                    <div class="kpi-sub">${m.ventasCount} ventas realizadas</div>
                </div>
                <div class="kpi-card card-warning" onclick="App.navigateTo('pagos_recibidos')" style="cursor:pointer">
                    <div class="kpi-label">
                        <div class="icon-circle"><i class="bi bi-wallet2"></i></div>
                        Total Cartera
                    </div>
                    <div class="kpi-value">${fmt(m.totalCartera)}</div>
                    <div class="kpi-sub">Vencida: ${fmt(m.carteraVencida)}</div>
                </div>
                <div class="kpi-card card-info" onclick="App.navigateTo('bancos')" style="cursor:pointer">
                    <div class="kpi-label">
                        <div class="icon-circle"><i class="bi bi-bank2"></i></div>
                        Saldo Bancos
                    </div>
                    <div class="kpi-value">${fmt(m.saldoBancos)}</div>
                    <div class="kpi-sub">Total en cuentas</div>
                </div>
                <div class="kpi-card card-danger" onclick="App.navigateTo('productos')" style="cursor:pointer">
                    <div class="kpi-label">
                        <div class="icon-circle"><i class="bi bi-box-seam"></i></div>
                        Inventario
                    </div>
                    <div class="kpi-value">${fmt(m.inventarioValorizado)}</div>
                    <div class="kpi-sub">${m.productosStockBajo > 0 ? `<span class="stock-alert"><i class="bi bi-exclamation-triangle"></i> ${m.productosStockBajo} bajo stock</span>` : `${m.totalProductos} productos`}</div>
                </div>
                <div class="kpi-card card-primary" onclick="App.navigateTo('clientes')" style="cursor:pointer">
                    <div class="kpi-label">
                        <div class="icon-circle"><i class="bi bi-people-fill"></i></div>
                        Clientes
                    </div>
                    <div class="kpi-value">${fmtN(m.totalClientes)}</div>
                    <div class="kpi-sub">Registrados</div>
                </div>
                <div class="kpi-card card-info" onclick="App.navigateTo('cotizaciones')" style="cursor:pointer">
                    <div class="kpi-label">
                        <div class="icon-circle"><i class="bi bi-file-earmark-text"></i></div>
                        Cotizaciones
                    </div>
                    <div class="kpi-value">${fmtN(m.cotizacionesCount)}</div>
                    <div class="kpi-sub">Ver todas <i class="bi bi-arrow-right"></i></div>
                </div>
            </div>

            <div class="dashboard-grid">
                <div class="section-card">
                    <div class="section-header">
                        <div class="section-title"><i class="bi bi-graph-up"></i> Ventas Últimos 7 Días</div>
                    </div>
                    <div class="section-body">
                        <div class="chart-container">
                            <canvas id="salesChart"></canvas>
                        </div>
                    </div>
                </div>

                <div>
                    <div class="section-card mb-4">
                        <div class="section-header">
                            <div class="section-title"><i class="bi bi-file-earmark-text"></i> Cotizaciones Recientes</div>
                            <button class="btn btn-sm btn-outline-primary" onclick="App.navigateTo('cotizaciones')">Ver todas</button>
                        </div>
                        <div class="section-body" style="padding: 0;">
                            <table class="table-modern">
                                <tbody>
                                    ${this._recentCotizacionesRows()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="section-card">
                        <div class="section-header">
                            <div class="section-title"><i class="bi bi-clock-history"></i> Ventas Recientes</div>
                        </div>
                        <div class="section-body" style="padding: 0;">
                            <table class="table-modern">
                                <tbody>
                                    ${this._recentSalesRows()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div>
                    <div class="section-card">
                        <div class="section-header">
                            <div class="section-title"><i class="bi bi-exclamation-triangle"></i> Stock Bajo</div>
                        </div>
                        <div class="section-body" style="padding: 0;">
                            <table class="table-modern">
                                <tbody>
                                    ${this._lowStockRows()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    },

    _recentSalesRows() {
        const sales = DB.getSales().sort((a, b) => {
            const dateA = a && a.fecha ? new Date(a.fecha) : 0;
            const dateB = b && b.fecha ? new Date(b.fecha) : 0;
            return dateB - dateA;
        }).slice(0, 5);
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        if (sales.length === 0) return '<tr><td class="text-center text-muted py-3">Sin ventas recientes</td></tr>';
        return sales.map(s => {
            const client = DB.getClient(s.cliente_id);
            const dateStr = s.fecha ? (s.fecha.includes('T') ? new Date(s.fecha).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : s.fecha) : 'Sin fecha';
            const ref = s.numero || (s.id ? (s.id.toString().length > 6 ? s.id.toString().substr(-6).toUpperCase() : s.id.toString().toUpperCase()) : 'N/A');
            return `<tr>
                <td>
                    <div style="font-weight:600;font-size:13px">${client ? client.nombre : 'N/A'}</div>
                    <div style="font-size:11px;color:var(--gray-400)">${ref} - ${dateStr}</div>
                </td>
                <td class="text-end">
                    <div style="font-weight:700;font-size:14px">${fmt(s.total)}</div>
                    <span class="badge-status badge-${s.tipo_venta}">${s.tipo_venta}</span>
                </td>
            </tr>`;
        }).join('');
    },

    _recentCotizacionesRows() {
        const items = DB.getCotizaciones().sort((a, b) => {
            const dateA = a && a.fecha ? new Date(a.fecha) : 0;
            const dateB = b && b.fecha ? new Date(b.fecha) : 0;
            return dateB - dateA;
        }).slice(0, 5);
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        if (items.length === 0) return '<tr><td class="text-center text-muted py-3">Sin cotizaciones recientes</td></tr>';
        return items.map(c => {
            const client = DB.getClient(c.cliente_id);
            const dateStr = c.fecha ? (c.fecha.includes('T') ? new Date(c.fecha).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : c.fecha) : 'Sin fecha';
            const ref = c.numero || (c.id ? (c.id.toString().length > 6 ? c.id.toString().substr(-6).toUpperCase() : c.id.toString().toUpperCase()) : 'N/A');
            return `<tr style="cursor:pointer" onclick="App.viewInvoice('${c.id}', 'cotizacion')">
                <td>
                    <div style="font-weight:600;font-size:13px">${DB.getClientName(c.cliente_id, c.cliente_nombre_alegra)}</div>
                    <div style="font-size:11px;color:var(--gray-400)">${ref} - ${dateStr}</div>
                </td>
                <td class="text-end">
                    <div style="font-weight:700;font-size:14px">${fmt(c.total)}</div>
                    <span class="badge bg-success text-uppercase" style="font-size:10px">Aceptada</span>
                </td>
            </tr>`;
        }).join('');
    },

    _lowStockRows() {
        const products = DB.getProducts().filter(p => p.stock_actual <= p.stock_minimo).slice(0, 5);
        if (products.length === 0) return '<tr><td class="text-center text-muted py-3">Sin alertas de stock</td></tr>';
        return products.map(p => `<tr>
            <td>
                <div style="font-weight:600;font-size:13px">${p.nombre}</div>
                <div style="font-size:11px;color:var(--gray-400)">${p.codigo}</div>
            </td>
            <td class="text-end">
                <span class="stock-alert"><i class="bi bi-exclamation-triangle"></i> ${p.stock_actual}/${p.stock_minimo}</span>
            </td>
        </tr>`).join('');
    },

    initDashboardChart() {
        const m = DB.getDashboardMetrics();
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: m.last7Days.map(d => d.label),
                datasets: [{
                    label: 'Ventas',
                    data: m.last7Days.map(d => d.total),
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79, 70, 229, 0.08)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 5,
                    pointBackgroundColor: '#4F46E5',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1F2937',
                        titleFont: { family: 'Inter' },
                        bodyFont: { family: 'Inter' },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (ctx) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(ctx.raw)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.04)' },
                        ticks: {
                            font: { family: 'Inter', size: 11 },
                            callback: (v) => '$' + (v / 1000).toFixed(0) + 'K'
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Inter', size: 11 } }
                    }
                }
            }
        });
    },

    initBancosChart() {
        const ctx = document.getElementById('bancosChart');
        if (!ctx) return;
        
        const movements = DB.getAll(DB.KEYS.BANK_MOVEMENTS) || [];
        
        // Agrupar por mes los últimos 6 meses
        const monthsData = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const label = d.toLocaleString('es-CO', { month: 'short' }).charAt(0).toUpperCase() + d.toLocaleString('es-CO', { month: 'short' }).slice(1) + ' ' + d.getFullYear();
            monthsData[key] = { label, in: 0, out: 0 };
        }
        
        movements.forEach(m => {
            const d = new Date(m.fecha || m.created_at);
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            if (monthsData[key]) {
                const amount = parseFloat(m.monto || 0);
                if (m.tipo === 'ingreso') monthsData[key].in += amount;
                else monthsData[key].out += amount;
            }
        });
        
        const labels = Object.values(monthsData).map(v => v.label);
        const dataIn = Object.values(monthsData).map(v => v.in);
        const dataOut = Object.values(monthsData).map(v => v.out);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: dataIn,
                        backgroundColor: '#10B981', // Verde Alegra
                        borderRadius: 4,
                        barPercentage: 0.6
                    },
                    {
                        label: 'Gastos',
                        data: dataOut,
                        backgroundColor: '#EF4444', // Rojo
                        borderRadius: 4,
                        barPercentage: 0.6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { borderDash: [2, 2], drawBorder: false },
                        ticks: { callback: (val) => '$' + val.toLocaleString('es-CO') } 
                    },
                    x: {
                        grid: { display: false, drawBorder: false }
                    }
                },
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }
                }
            }
        });
    },

    /* =================================================
       CLIENTES
       ================================================= */
    /* =================================================
       DETALLE DE CLIENTE (FULL PAGE)
       ================================================= */
    cliente_detail(id) {
        const client = DB.getClient(id);
        if (!client) {
            return `
            <div class="fade-in p-4 text-center">
                <i class="bi bi-person-x text-muted" style="font-size: 3rem;"></i>
                <h4 class="mt-3 text-muted">Cliente no encontrado</h4>
                <button class="btn btn-outline-primary mt-3" onclick="App.navigateTo('clientes')"><i class="bi bi-arrow-left"></i> Volver a contactos</button>
            </div>`;
        }

        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        
        // Calcular Saldo de Cartera
        const carteras = DB.getCartera().filter(c => String(c.cliente_id) === String(id) && c.estado !== 'pagada');
        const saldoCuentasPorCobrar = carteras.reduce((sum, c) => sum + (c.saldo || 0), 0);

        return `
        <div class="fade-in">
            <!-- Header Section -->
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div class="d-flex align-items-center gap-3">
                    <button class="btn btn-light shadow-sm" onclick="App.navigateTo('clientes')" title="Volver">
                        <i class="bi bi-arrow-left"></i>
                    </button>
                    <h2 class="mb-0 fw-bold">${client.nombre}</h2>
                </div>
                <button class="btn btn-primary" onclick="App.editCliente('${client.id}')">
                    <i class="bi bi-pencil me-2"></i>Editar Contacto
                </button>
            </div>

            <!-- Client Info Cards -->
            <div class="row mb-4 g-3">
                <div class="col-md-3">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <p class="text-muted small mb-1">NIT / Cédula</p>
                            <h6 class="mb-0 fw-bold">${client.documento || 'N/A'}</h6>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <p class="text-muted small mb-1">Teléfono</p>
                            <h6 class="mb-0 fw-bold">${client.telefono || 'N/A'}</h6>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <p class="text-muted small mb-1">Correo electrónico</p>
                            <h6 class="mb-0 fw-bold text-truncate" title="${client.email || 'N/A'}">${client.email || 'N/A'}</h6>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card border-0 shadow-sm h-100 bg-primary text-white">
                        <div class="card-body d-flex flex-column justify-content-center">
                            <p class="text-white-50 small mb-1">Cuentas por cobrar</p>
                            <h5 class="mb-0 fw-bold">${fmt(saldoCuentasPorCobrar)}</h5>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabs Navigation -->
            <div class="d-flex align-items-center border-bottom mb-4 position-relative">
                <!-- Scroll Left Button (Optional for JS scrolling if needed) -->
                <!-- <button class="btn btn-link text-muted px-2 position-absolute start-0 h-100 bg-white" style="z-index: 10;"><i class="bi bi-chevron-left"></i></button> -->
                
                <ul class="nav nav-tabs border-0 flex-nowrap overflow-auto hide-scrollbar w-100 gap-3" id="client-tabs-menu" style="white-space: nowrap; -ms-overflow-style: none; scrollbar-width: none;">
                    <li class="nav-item">
                        <a class="nav-link bg-transparent text-muted fw-medium px-1 pb-3 active border-primary text-primary" style="border-bottom: 2px solid transparent; cursor: pointer;" id="cptab-transacciones" onclick="App.loadClientPageTab('${id}', 'transacciones')">Transacciones</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link bg-transparent text-muted fw-medium px-1 pb-3" style="border-bottom: 2px solid transparent; cursor: pointer;" id="cptab-facturas-venta" onclick="App.loadClientPageTab('${id}', 'facturas-venta')">Facturas</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link bg-transparent text-muted fw-medium px-1 pb-3" style="border-bottom: 2px solid transparent; cursor: pointer;" id="cptab-facturas-proveedor" onclick="App.loadClientPageTab('${id}', 'facturas-proveedor')">Facturas de proveedor</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link bg-transparent text-muted fw-medium px-1 pb-3" style="border-bottom: 2px solid transparent; cursor: pointer;" id="cptab-devoluciones" onclick="App.loadClientPageTab('${id}', 'devoluciones')">Devoluciones en ventas</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link bg-transparent text-muted fw-medium px-1 pb-3" style="border-bottom: 2px solid transparent; cursor: pointer;" id="cptab-pagos" onclick="App.loadClientPageTab('${id}', 'pagos')">Pagos / Recibos</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link bg-transparent text-muted fw-medium px-1 pb-3" style="border-bottom: 2px solid transparent; cursor: pointer;" id="cptab-cotizaciones" onclick="App.loadClientPageTab('${id}', 'cotizaciones')">Cotizaciones</a>
                    </li>
                </ul>

                <!-- Scroll Right Button (Optional for JS scrolling if needed) -->
                <!-- <button class="btn btn-link text-muted px-2 position-absolute end-0 h-100 bg-white" style="z-index: 10;"><i class="bi bi-chevron-right"></i></button> -->
            </div>
            
            <style>
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .nav-link.active { color: var(--bs-primary) !important; border-bottom-color: var(--bs-primary) !important; }
            </style>

            <!-- Tab Content Container -->
            <div id="cp-tab-content">
                <div class="text-center text-muted p-5 bg-white rounded shadow-sm">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                </div>
            </div>
        </div>
        `;
    },

    clientes() {
        const clients = DB.getClients();
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        let rows = '';
        if (clients.length === 0) {
            rows = `<tr><td colspan="7" class="text-center text-muted py-4">No hay clientes registrados</td></tr>`;
        } else {
            rows = clients.map(c => {
                const saldo = DB.getClientBalance(c.id);
                return `<tr>
                    <td><a href="#" onclick="event.preventDefault(); App.viewCliente('${c.id}')" class="text-decoration-none fw-bold">${c.nombre}</a></td>
                    <td><span class="badge-status badge-secondary">${c.tipo || 'Cliente'}</span></td>
                    <td>${c.documento}</td>
                    <td>${c.telefono || '-'}</td>
                    <td class="text-end">${fmt(c.cupo_credito)}</td>
                    <td class="text-end">${c.plazo_dias} días</td>
                    <td class="text-end">${saldo > 0 ? `<span class="badge-status badge-vencida">${fmt(saldo)}</span>` : '<span class="badge-status badge-pagada">$0</span>'}</td>
                    <td>
                        <button class="btn-action btn-edit" onclick="App.editCliente('${c.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
                        <button class="btn-action btn-delete" onclick="App.deleteCliente('${c.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-people-fill"></i> Contactos</div>
                    <div class="d-flex gap-2 align-items-center">
                        ${TableSort.renderFilterBar({
                            ctx: 'clientes',
                            placeholder: 'Buscar por nombre o doc...',
                            searchId: 'clientesSearchInput',
                            onSearchInput: 'App.filterClientes ? App.filterClientes(this.value) : App.navigateTo(\'clientes\')',
                            opts: [
                                { value: 'todos', label: 'Todos los tipos' },
                                { value: 'cliente', label: 'Solo Clientes' },
                                { value: 'proveedor', label: 'Solo Proveedores' }
                            ]
                        })}
                        <button class="btn btn-primary-gradient" onclick="App.newCliente()">
                             <i class="bi bi-plus-lg me-1"></i> Nuevo Contacto
                        </button>
                    </div>
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                ${TableSort.renderSortTh('Nombre', 'nombre', 'clientes')}
                                <th>Tipo</th>
                                <th>Documento</th>
                                <th>Teléfono</th>
                                <th class="text-end">Cupo Crédito</th>
                                <th class="text-end">Plazo</th>
                                <th class="text-end">Saldo</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="clientesTableBody">${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },

    /* =================================================
       VENDEDORES
       ================================================= */
    vendedores() {
        const sellers = DB.getSellers();
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(n / 100);

        let rows = '';
        if (sellers.length === 0) {
            rows = `<tr><td colspan="5" class="text-center text-muted py-4">No hay vendedores registrados</td></tr>`;
        } else {
            rows = sellers.map(s => `<tr>
                <td><strong>${s.nombre}</strong></td>
                <td>${s.documento || '-'}</td>
                <td>${s.telefono || '-'}</td>
                <td class="text-end"><span class="badge bg-info text-dark">${fmt(s.comision_porcentaje || 0)}</span></td>
                <td>
                    <button class="btn-action btn-edit" onclick="App.editVendedor('${s.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button class="btn-action btn-delete" onclick="App.deleteVendedor('${s.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`).join('');
        }

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-person-badge"></i> Vendedores</div>
                    <button class="btn btn-primary-gradient" onclick="App.newVendedor()">
                        <i class="bi bi-plus-lg me-1"></i> Nuevo Vendedor
                    </button>
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Documento</th>
                                <th>Teléfono</th>
                                <th class="text-end">Comisión</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },

    /* =================================================
       PRODUCTOS
       ================================================= */
    productos() {
        const products = DB.getProducts();
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        let rows = '';
        if (products.length === 0) {
            rows = `<tr><td colspan="8" class="text-center text-muted py-4">No hay productos registrados</td></tr>`;
        } else {
            rows = products.map(p => {
                const isLow = p.stock_actual <= p.stock_minimo;
                const actionButtons = Auth.isAdmin() ? `
                    <button class="btn-action btn-view" onclick="App.adjustStock('${p.id}')" title="Ajustar stock"><i class="bi bi-box-seam"></i></button>
                    <button class="btn-action btn-edit" onclick="App.editProducto('${p.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button class="btn-action btn-delete" onclick="App.deleteProducto('${p.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                ` : `<span class="badge bg-secondary">Solo lectura</span>`;

                return `<tr>
                    <td><a href="#" onclick="event.preventDefault(); App.viewProducto('${p.id}')" class="text-decoration-none fw-bold">${p.codigo}</a></td>
                    <td><a href="#" onclick="event.preventDefault(); App.viewProducto('${p.id}')" class="text-decoration-none">${p.nombre}</a></td>
                    <td class="text-end">${fmt(p.precio_compra)}</td>
                    <td class="text-end">${fmt(p.precio_venta)}</td>
                    <td class="text-end">${isLow ? `<span class="stock-alert"><i class="bi bi-exclamation-triangle"></i> ${p.stock_actual}</span>` : p.stock_actual}</td>
                    <td class="text-end">${p.stock_minimo}</td>
                    <td class="text-end">${fmt(p.precio_venta - p.precio_compra)}</td>
                    <td>
                        ${actionButtons}
                    </td>
                </tr>`;
            }).join('');
        }

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-box-seam-fill"></i> Productos</div>
                    ${Auth.isAdmin() ? `
                    <div class="d-flex gap-2">
                        <input type="file" id="importExcelInput" accept=".xlsx, .xls" class="d-none" onchange="App.importProductos(event)">
                        <button class="btn btn-outline-primary" onclick="document.getElementById('importExcelInput').click()">
                            <i class="bi bi-upload me-1"></i> Importar Excel
                        </button>
                        <button class="btn btn-primary-gradient" onclick="App.newProducto()">
                            <i class="bi bi-plus-lg me-1"></i> Nuevo Producto
                        </button>
                    </div>
                    ` : ''}
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Nombre</th>
                                <th class="text-end">P. Compra</th>
                                <th class="text-end">P. Venta</th>
                                <th class="text-end">Stock</th>
                                <th class="text-end">Mín.</th>
                                <th class="text-end">Margen</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },

    /* =================================================
       FACTURAS DE VENTA
       ================================================= */
    ventas(searchQuery = '') {
        const allSales = DB.getSales().sort((a, b) => {
            const dateA = a && a.fecha ? new Date(a.fecha) : 0;
            const dateB = b && b.fecha ? new Date(b.fecha) : 0;
            return dateB - dateA;
        });
        const allCartera = DB.getAll(DB.KEYS.CARTERA);
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        // Apply search filter
        const q = (searchQuery || '').toLowerCase().trim();
        const sales = q ? allSales.filter(s => {
            if (!s) return false;
            const client = DB.getClient(s.cliente_id);
        const ref = (s.numero || (s.id ? s.id.toString().substr(-6) : '')).toString().replace('#', '').toLowerCase();
        const clientName = (client ? client.nombre : '').toLowerCase();
        return ref.includes(q) || clientName.includes(q);
    }) : allSales;

        let rows = '';
        if (sales.length === 0) {
            rows = `<tr><td colspan="9" class="text-center text-muted py-4">${q ? `No se encontraron resultados para "<strong>${q}</strong>"` : 'No hay facturas de venta registradas'}</td></tr>`;
        } else {
            rows = sales.map(s => {
                try {
                    if (!s || !s.id) return '';
                    const client = DB.getClient(s.cliente_id);
                    const clientName = DB.getClientName(s.cliente_id, s.cliente_nombre_alegra);
                    const carteraItem = s.tipo_venta === 'credito' ? allCartera.find(c => c.venta_id === s.id) : null;

                    let stateBadge = 'secondary';
                    if (s.estado === 'pagada') stateBadge = 'success';
                    if (s.estado === 'pendiente') stateBadge = 'warning text-dark';
                    if (s.estado === 'parcial') stateBadge = 'info';
                    if (s.estado === 'anulada') stateBadge = 'danger';

                    let abono = 0;
                    let saldo = 0;

                    if (s.tipo_venta === 'contado') {
                        abono = s.total;
                        saldo = 0;
                    } else if (carteraItem) {
                        saldo = parseFloat(carteraItem.saldo);
                        abono = s.total - saldo;
                    } else {
                        abono = s.total;
                        saldo = 0;
                    }

                    const ref = s.numero || s.id.toString().substr(-6).toUpperCase();
                    const fechaStr = s.fecha ? (s.fecha.includes('T') ? new Date(s.fecha).toLocaleDateString('es-CO') : s.fecha) : '-';

                    return `<tr>
                        <td><a href="#" onclick="event.preventDefault(); App.viewInvoice('${s.id}', 'venta')" class="text-decoration-none fw-bold">${ref.replace('#', '')}</a></td>
                        <td>${fechaStr}</td>
                        <td><a href="#" onclick="event.preventDefault(); App.viewCliente('${s.cliente_id}')" class="text-decoration-none fw-bold">${clientName}</a></td>
                        <td><span class="badge-status badge-${s.tipo_venta}">${s.tipo_venta}</span></td>
                        <td><span class="badge bg-${stateBadge} text-uppercase" style="font-size:0.75rem">${s.estado || 'OK'}</span></td>
                        <td class="text-end"><strong class="text-primary">${fmt(s.total)}</strong></td>
                        <td class="text-end text-success">${fmt(abono)}</td>
                        <td class="text-end text-danger fw-bold">${fmt(saldo)}</td>
                        <td>
                            <button class="btn-action btn-view" onclick="App.viewInvoice('${s.id}', 'venta')" title="Ver detalle"><i class="bi bi-eye"></i></button>
                            ${s.estado !== 'pagada' && s.estado !== 'anulada' ? `<button class="btn-action btn-edit" onclick="App.editVenta('${s.id}')" title="Editar Venta"><i class="bi bi-pencil"></i></button>` : ''}
                            <button class="btn-action" style="color:#6c757d" onclick="App.printVenta('${s.id}')" title="Imprimir Factura"><i class="bi bi-printer"></i></button>
                            ${carteraItem && carteraItem.saldo > 0 ? `<button class="btn-action btn-view" style="color: #2e7d32;" onclick="App.registrarAbono('${carteraItem.id}')" title="Registrar Pago"><i class="bi bi-cash-coin"></i></button>` : ''}
                            ${s.estado !== 'anulada' ? `<button class="btn-action btn-delete" onclick="App.promptAnularVenta('${s.id}')" title="Anular Factura"><i class="bi bi-x-circle"></i></button>` : ''}
                        </td>
                    </tr>`;
                } catch(e) {
                    console.error('Error rendering venta row:', s, e);
                    return `<tr><td colspan="9" class="text-danger small"><i class="bi bi-exclamation-triangle"></i> Error en registro #${s?.id || '?'}: ${e.message}</td></tr>`;
                }
            }).join('');
        }

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-receipt"></i> Facturas de Venta
                        <span class="badge bg-light text-dark ms-2" style="font-size: 0.7rem; font-weight: 500;">${allSales.length} documentos</span>
                    </div>
                    <div class="d-flex gap-2 align-items-center">
                        ${TableSort.renderFilterBar({
                            ctx: 'ventas',
                            placeholder: 'Buscar por cliente o #...',
                            searchId: 'ventasSearchInput',
                            onSearchInput: 'App.filterVentas(this.value)',
                            searchValue: searchQuery,
                            opts: [
                                { value: 'todas', label: 'Todos los estados' },
                                { value: 'pendiente', label: 'Pendientes' },
                                { value: 'pagada', label: 'Pagadas' },
                                { value: 'parcial', label: 'Parcial' },
                                { value: 'anulada', label: 'Anuladas' }
                            ]
                        })}
                        <button class="btn btn-primary-gradient" onclick="App.newVenta()">
                            <i class="bi bi-plus-lg me-1"></i> Nueva Factura
                        </button>
                    </div>
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                ${TableSort.renderSortTh('Referencia', 'numero', 'ventas')}
                                ${TableSort.renderSortTh('Fecha', 'fecha', 'ventas')}
                                <th>Cliente</th>
                                <th>Tipo</th>
                                ${TableSort.renderSortTh('Estado', 'estado', 'ventas')}
                                <th class="text-end">Total</th>
                                <th class="text-end">Abono</th>
                                <th class="text-end">Saldo</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="ventasTableBody">${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },


    /* =================================================
       DEVOLUCIONES DE VENTA
       ================================================= */
    devoluciones() {
        const items = DB.getDevoluciones().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        let rows = '';
        if (items.length === 0) {
            rows = `<tr><td colspan="6" class="text-center text-muted py-4">No hay devoluciones registradas</td></tr>`;
        } else {
            rows = items.map(d => {
                const sale = DB.getSale(d.venta_id);
                const client = sale ? DB.getClient(sale.cliente_id) : null;
                return `<tr>
                    <td><strong>${d.id.toString().substr(-6).toUpperCase()}</strong></td>
                    <td>${d.fecha}</td>
                    <td>Factura ${sale ? (sale.numero || sale.id.toString().substr(-6).toUpperCase()) : 'N/A'}</td>
                    <td>${client ? client.nombre : 'N/A'}</td>
                    <td class="text-end"><strong>${fmt(d.total)}</strong></td>
                    <td>
                        <button class="btn-action btn-view" onclick="App.viewDevolucion('${d.id}')" title="Ver detalle"><i class="bi bi-eye"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-arrow-return-left"></i> Devoluciones de Venta</div>
                    <button class="btn btn-primary-gradient" onclick="App.newDevolucion()">
                        <i class="bi bi-plus-lg me-1"></i> Nueva Devolución
                    </button>
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Referencia</th>
                                <th>Fecha</th>
                                <th>Factura Origen</th>
                                <th>Cliente</th>
                                <th class="text-end">Total Devuelto</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },

    /* =================================================
       COMPRAS (ORDENES)
       ================================================= */
    compras() {
        const compras = DB.getCompras();
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        let rows = '';
        if (compras.length === 0) {
            rows = `<tr><td colspan="7" class="text-center text-muted py-4">No hay órdenes de compra registradas</td></tr>`;
        } else {
            rows = compras.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(c => {
                let badgeClass = 'secondary';
                if (c.estado === 'enviada') badgeClass = 'primary';
                if (c.estado === 'recibida') badgeClass = 'success';
                if (c.estado === 'cancelada') badgeClass = 'danger';

                return `<tr>
                    <td><strong>${c.numero || c.id.toString().slice(-6).toUpperCase()}</strong></td>
                    <td>${c.fecha}</td>
                    <td><a href="#" onclick="event.preventDefault(); App.viewCliente('${c.proveedor_id || DB.getClients().find(cl => cl.nombre === c.proveedor)?.id || ''}')" class="text-decoration-none fw-bold">${c.proveedor || 'N/A'}</a></td>
                    <td><span class="badge bg-${badgeClass} text-uppercase" style="font-size:0.75rem">${c.estado || 'borrador'}</span></td>
                    <td>${c.tipo_pago.toUpperCase()}</td>
                    <td class="text-end"><strong>${fmt(c.total)}</strong></td>
                    <td>
                        <button class="btn-action btn-edit" onclick="App.editCompra('${c.id}')" title="Ver / Editar Órden"><i class="bi bi-pencil"></i></button>
                        <button class="btn-action" style="color:#6c757d" onclick="App.printCompra('${c.id}')" title="Imprimir Órden"><i class="bi bi-printer"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-truck"></i> Órdenes de Compra</div>
                    <button class="btn btn-primary-gradient" onclick="App.newCompra()">
                        <i class="bi bi-plus-lg me-1"></i> Nueva Órden
                    </button>
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Referencia</th>
                                <th>Fecha</th>
                                <th>Proveedor</th>
                                <th>Estado</th>
                                <th>Tipo Pago</th>
                                <th class="text-end">Total</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },

    /* =================================================
       CARTERA
       ================================================= */
    cartera(filter = 'todas') {
        const items = DB.getCartera(filter);
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        // Ordenar cronológicamente descendente (más recientes primero)
        const sortedItems = [...items].sort((a, b) => {
            const dateA = a.fecha_emision || a.fecha_vencimiento || a.created_at || '';
            const dateB = b.fecha_emision || b.fecha_vencimiento || b.created_at || '';
            return dateB.localeCompare(dateA);
        });

        // Limitar a 100 si es pagada para evitar congelar el navegador
        const displayedItems = filter === 'pagada' ? sortedItems.slice(0, 100) : sortedItems;

        let rows = '';
        if (displayedItems.length === 0) {
            rows = `<tr><td colspan="7" class="text-center text-muted py-4">No hay registros de cartera</td></tr>`;
        } else {
            rows = displayedItems.map(c => {
                const client = DB.getClient(c.cliente_id);
                const sale = DB.getSale(c.venta_id);
                const ref = sale ? (sale.numero || sale.id.toString().substr(-6).toUpperCase()) : c.venta_id || '-';
                return `<tr>
                    <td><a href="#" onclick="event.preventDefault(); App.viewInvoice('${c.venta_id}', 'venta')" class="text-decoration-none fw-bold">${ref}</a></td>
                    <td><strong>${client ? client.nombre : 'N/A'}</strong></td>
                    <td class="text-end">${fmt(c.total)}</td>
                    <td class="text-end">${fmt(c.saldo)}</td>
                    <td>
                        <span class="${App.getVencimientoStyle(c.fecha_vencimiento, c.estado)}">
                            ${c.fecha_vencimiento || 'N/A'}
                        </span>
                    </td>
                    <td><span class="badge-status badge-${c.estado}">${c.estado}</span></td>
                    <td class="text-end">${fmt(c.total - c.saldo)}</td>
                    <td>
                        ${c.estado !== 'pagada' ? `<button class="btn-action btn-view" onclick="App.registrarAbono('${c.id}')" title="Registrar abono"><i class="bi bi-cash-coin"></i></button>` : ''}
                    </td>
                </tr>`;
            }).join('');
        }

        let noticeHtml = '';
        if (filter === 'pagada' && items.length > 100) {
            noticeHtml = `
            <div class="alert alert-info py-2 px-3 m-3 d-flex align-items-center" style="font-size: 12px; border-radius: 8px;">
                <i class="bi bi-info-circle-fill me-2 fs-6 text-primary"></i>
                <span>Mostrando los <strong>100 registros pagados más recientes</strong> de un total histórico de <strong>${items.length}</strong> facturas conciliadas.</span>
            </div>`;
        }

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-wallet2"></i> Cartera</div>
                    <div class="d-flex gap-2 align-items-center flex-wrap">
                        <div class="filter-pills">
                            <button class="filter-pill ${filter === 'todas' ? 'active' : ''}" onclick="App.loadCartera('todas')">Todas</button>
                            <button class="filter-pill ${filter === 'vigente' ? 'active' : ''}" onclick="App.loadCartera('vigente')">Vigentes</button>
                            <button class="filter-pill ${filter === 'vencida' ? 'active' : ''}" onclick="App.loadCartera('vencida')">Vencidas</button>
                            <button class="filter-pill ${filter === 'pagada' ? 'active' : ''}" onclick="App.loadCartera('pagada')">Pagadas</button>
                        </div>
                        <select class="form-select form-select-sm" style="width:auto;min-width:180px" onchange="TableSort.applyFilter('cartera', this.value); App.loadCartera(this.value)">
                            <option value="todas" ${filter === 'todas' ? 'selected' : ''}>Ordenar: por Defecto</option>
                            <option value="todas">Fecha Venc. ↑ (Urgentes primero)</option>
                        </select>
                    </div>
                </div>
                ${noticeHtml}
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Referencia</th>
                                ${TableSort.renderSortTh('Cliente', 'cliente_nombre', 'cartera')}
                                <th class="text-end">Total</th>
                                <th class="text-end">Saldo</th>
                                ${TableSort.renderSortTh('Vencimiento', 'fecha_vencimiento', 'cartera')}
                                ${TableSort.renderSortTh('Estado', 'estado', 'cartera')}
                                <th class="text-end">Abonado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },

    /* =================================================
       BANCOS
       ================================================= */
    bancos() {
        const banks = DB.getBanks();
        const movements = DB.getAll(DB.KEYS.BANK_MOVEMENTS) || [];
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        let saldoBancosEfectivo = 0;
        let deudaTarjetas = 0;
        let saldoTotal = 0;
        
        // Calcular saldos
        const bankData = banks.map(b => {
            let saldoReal = parseFloat(b.saldo_inicial || 0);
            movements.forEach(m => {
                if (String(m.banco_id) === String(b.id)) {
                    const amount = parseFloat(m.monto || 0);
                    if (m.tipo === 'ingreso') saldoReal += amount;
                    else saldoReal -= amount;
                }
            });
            if (saldoReal > 0) saldoBancosEfectivo += saldoReal;
            if (saldoReal < 0) deudaTarjetas += saldoReal;
            saldoTotal += saldoReal;
            return { ...b, saldoReal };
        });

        // HTML del Gráfico
        const chartHTML = `
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                    <h6 class="text-muted fw-semibold mb-3">Ingresos y gastos</h6>
                    <div style="height: 250px;">
                        <canvas id="bancosChart"></canvas>
                    </div>
                </div>
            </div>
        `;

        // HTML de Tarjetas
        const cardsHTML = `
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body p-4 d-flex flex-column justify-content-center">
                    <div class="mb-4">
                        <div class="text-muted small fw-semibold text-uppercase mb-1">Saldo en bancos y efectivo</div>
                        <h4 class="mb-0 text-success fw-bold">${fmt(saldoBancosEfectivo)}</h4>
                    </div>
                    <div class="mb-4">
                        <div class="text-muted small fw-semibold text-uppercase mb-1">Deuda en tarjetas de crédito</div>
                        <h4 class="mb-0 ${deudaTarjetas < 0 ? 'text-danger' : 'text-dark'} fw-bold">${fmt(deudaTarjetas)}</h4>
                    </div>
                    <hr class="border-secondary opacity-25">
                    <div class="mt-2">
                        <div class="text-muted small fw-semibold text-uppercase mb-1">Saldo total</div>
                        <h3 class="mb-0 fw-bold text-dark">${fmt(saldoTotal)}</h3>
                    </div>
                </div>
            </div>
        `;

        // HTML de la Tabla de Bancos
        let tableRows = '';
        if (bankData.length === 0) {
            tableRows = `<tr><td colspan="5" class="text-center text-muted p-5">No hay bancos registrados</td></tr>`;
        } else {
            tableRows = bankData.map(b => {
                const isNegative = b.saldoReal < 0;
                const displaySaldo = isNegative ? 0 : b.saldoReal;
                const rowStyle = isNegative ? 'opacity: 0.6; background-color: #fcfcfc;' : '';
                const saldoStyle = isNegative ? 'text-muted' : 'text-success fw-bold';
                
                return `
                <tr style="${rowStyle}">
                    <td class="align-middle fw-medium">${b.nombre}</td>
                    <td class="align-middle text-muted">${b.tipo || 'Efectivo / Banco'}</td>
                    <td class="align-middle text-muted">${b.numero_cuenta || 'N/A'}</td>
                    <td class="align-middle text-end ${saldoStyle}">${fmt(displaySaldo)}</td>
                    <td class="align-middle text-end">
                        <div class="d-flex justify-content-end align-items-center gap-2">
                            <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-medium" onclick="App.navigateTo('conciliacion', '${b.id}')">Conciliar</button>
                            <button class="btn btn-sm btn-light text-primary" onclick="App.viewBankMovements('${b.id}')" title="Ver movimientos">
                                <i class="bi bi-eye"></i>
                            </button>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-light" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
                                <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0">
                                    <li><a class="dropdown-item" href="#" onclick="App.editBank('${b.id}')"><i class="bi bi-pencil me-2 text-muted"></i>Editar</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item text-danger" href="#" onclick="App.deleteBank('${b.id}')"><i class="bi bi-trash me-2"></i>Eliminar</a></li>
                                </ul>
                            </div>
                        </div>
                    </td>
                </tr>
                `;
            }).join('');
        }

        return `
        <div class="fade-in">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h3 class="fw-bold mb-0 text-dark"><i class="bi bi-bank2 me-2 text-primary"></i>Bancos</h3>
                <div class="d-flex gap-2">
                    <button class="btn btn-outline-secondary fw-medium shadow-sm bg-white" onclick="App.recalibrateBanks()">
                        <i class="bi bi-arrow-repeat me-1"></i> Recalcular Saldos
                    </button>
                    <button class="btn btn-primary fw-medium shadow-sm" onclick="App.newBanco()">
                        <i class="bi bi-plus-lg me-1"></i> Nuevo Banco
                    </button>
                </div>
            </div>

            <!-- Fila Superior: Gráfico y Resumen -->
            <div class="row g-4 mb-4">
                <div class="col-lg-8">
                    ${chartHTML}
                </div>
                <div class="col-lg-4">
                    ${cardsHTML}
                </div>
            </div>

            <!-- Fila Inferior: Listado de Cuentas -->
            <div class="card border-0 shadow-sm">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="bg-light text-uppercase text-muted" style="font-size: 0.75rem;">
                                <tr>
                                    <th class="ps-4 border-0 py-3">Nombre</th>
                                    <th class="border-0 py-3">Tipo de cuenta</th>
                                    <th class="border-0 py-3">Número de cuenta</th>
                                    <th class="text-end border-0 py-3">Saldo</th>
                                    <th class="text-end pe-4 border-0 py-3">Conciliación</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        `;
    },

    conciliacion(bankId) {
        const bank = DB.getBank(bankId);
        if (!bank) return '<div class="alert alert-danger m-4">Banco no encontrado</div>';
        
        const allMovements = DB.getAll(DB.KEYS.BANK_MOVEMENTS) || [];
        const unconciled = allMovements.filter(m => String(m.banco_id) === String(bankId) && m.estado !== 'conciliado');
        
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        
        // El saldo anterior es el saldo_inicial (o 0) más la sumatoria de todos los movimientos ya conciliados
        let saldoAnterior = parseFloat(bank.saldo_inicial || 0);
        const conciled = allMovements.filter(m => String(m.banco_id) === String(bankId) && m.estado === 'conciliado');
        conciled.forEach(m => {
            const amt = parseFloat(m.monto || 0);
            if (m.tipo === 'ingreso') saldoAnterior += amt;
            else saldoAnterior -= amt;
        });

        // Generar filas
        const rows = unconciled.map(m => {
            const isIngreso = m.tipo === 'ingreso';
            const valClass = isIngreso ? 'text-success' : 'text-danger';
            
            let clientName = 'N/A';
            if (m.cliente_id || m.cliente_id_alegra) {
                clientName = DB.getClientName(m.cliente_id || m.cliente_id_alegra, m.cliente_nombre || m.cliente_nombre_alegra);
            } else if (m.referencia_id) {
                clientName = m.extracted_client_name || 'N/A';
            }
            if (clientName === 'N/A' && m.cliente_nombre_alegra) clientName = m.cliente_nombre_alegra;

            return `
            <tr class="mov-row" data-id="${m.id}" data-type="${m.tipo}" data-monto="${parseFloat(m.monto || 0)}">
                <td class="align-middle ps-4">
                    <div class="form-check">
                        <input class="form-check-input mov-checkbox" type="checkbox" value="${m.id}" onchange="App.recalcConciliacion()" style="cursor:pointer; width: 1.2rem; height: 1.2rem;">
                    </div>
                </td>
                <td class="align-middle text-muted">${new Date(m.fecha || m.created_at).toLocaleDateString('es-CO')}</td>
                <td class="align-middle fw-medium">${clientName}</td>
                <td class="align-middle text-muted text-capitalize">${m.tipo}</td>
                <td class="align-middle text-muted">${m.descripcion || '-'}</td>
                <td class="align-middle text-end fw-bold ${valClass}">${fmt(parseFloat(m.monto || 0))}</td>
                <td class="align-middle text-end pe-4">
                    <button class="btn btn-sm btn-light text-primary" title="Ver detalle">
                        <i class="bi bi-eye"></i>
                    </button>
                </td>
            </tr>
            `;
        }).join('');

        const emptyState = `<tr><td colspan="7" class="text-center text-muted p-5"><i class="bi bi-check-circle fs-2 text-success d-block mb-2"></i>Todo está conciliado en esta cuenta.</td></tr>`;

        return `
        <div class="fade-in pb-5">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h3 class="fw-bold mb-1 text-dark"><i class="bi bi-shield-check me-2 text-primary"></i>Conciliación Bancaria</h3>
                    <div class="text-muted fw-medium fs-5">${bank.nombre} ${bank.numero_cuenta ? '• ' + bank.numero_cuenta : ''}</div>
                </div>
                <button class="btn btn-outline-secondary fw-medium bg-white" onclick="App.navigateTo('bancos')">
                    <i class="bi bi-arrow-left me-1"></i> Volver a Bancos
                </button>
            </div>

            <!-- Panel Superior de Cálculos -->
            <div class="row g-4 mb-4">
                <!-- Tarjeta de Fórmulas -->
                <div class="col-lg-8">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body p-4">
                            <div class="row align-items-center mb-4">
                                <div class="col-sm-3 text-muted fw-bold text-uppercase small">Saldo anterior</div>
                                <div class="col-sm-9 text-dark fw-bold fs-5 text-end" id="concSaldoAnterior" data-val="${saldoAnterior}">${fmt(saldoAnterior)}</div>
                            </div>
                            <div class="row align-items-center mb-3">
                                <div class="col-sm-3 text-muted fw-bold small text-uppercase"><i class="bi bi-plus-circle text-success me-2"></i>Entradas (+)</div>
                                <div class="col-sm-9 text-success fw-bold text-end" id="concEntradas">$0</div>
                            </div>
                            <div class="row align-items-center mb-4">
                                <div class="col-sm-3 text-muted fw-bold small text-uppercase"><i class="bi bi-dash-circle text-danger me-2"></i>Salidas (-)</div>
                                <div class="col-sm-9 text-danger fw-bold text-end" id="concSalidas">$0</div>
                            </div>
                            <hr class="border-secondary opacity-25">
                            <div class="row align-items-center mt-3">
                                <div class="col-sm-3 text-dark fw-bold text-uppercase">Saldo total</div>
                                <div class="col-sm-9 text-dark fw-bold fs-3 text-end" id="concSaldoTotal">${fmt(saldoAnterior)}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Tarjeta de Conciliación -->
                <div class="col-lg-4">
                    <div class="card border-0 shadow-sm h-100 bg-light">
                        <div class="card-body p-4 d-flex flex-column">
                            <div class="mb-4">
                                <label class="form-label text-muted fw-bold small text-uppercase">Saldo bancario (Extracto)</label>
                                <div class="input-group">
                                    <span class="input-group-text bg-white border-end-0 text-muted">$</span>
                                    <input type="number" class="form-control border-start-0 ps-0 fw-bold fs-4 text-end" id="concSaldoBancario" placeholder="0" oninput="App.recalcConciliacion()">
                                </div>
                            </div>
                            <div class="mt-auto">
                                <div class="text-muted fw-bold small text-uppercase mb-2">Diferencia</div>
                                <div class="d-flex align-items-center justify-content-between bg-white p-3 rounded border">
                                    <h3 class="mb-0 fw-bold text-danger" id="concDiferencia">$0</h3>
                                    <i class="bi bi-exclamation-triangle-fill text-danger fs-3" id="concDifIcon"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Ajustes manuales opcionales -->
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body p-4">
                    <h6 class="text-muted fw-bold mb-3 small text-uppercase">Ajustes manuales (Opcional)</h6>
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label class="form-label text-muted small fw-medium">Gastos bancarios (-)</label>
                            <input type="number" class="form-control bg-light" id="concGastos" placeholder="0" oninput="App.recalcConciliacion()">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label text-muted small fw-medium">Impuestos bancarios (-)</label>
                            <input type="number" class="form-control bg-light" id="concImpuestos" placeholder="0" oninput="App.recalcConciliacion()">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label text-muted small fw-medium">Entradas bancarias (+)</label>
                            <input type="number" class="form-control bg-light" id="concEntradasManual" placeholder="0" oninput="App.recalcConciliacion()">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabla de movimientos a conciliar -->
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0" id="concTable">
                            <thead class="bg-light text-uppercase text-muted" style="font-size: 0.75rem;">
                                <tr>
                                    <th class="ps-4 border-0 py-3" style="width: 40px">
                                        <input class="form-check-input" type="checkbox" id="concSelectAll" onchange="App.toggleAllConciliacion(this)">
                                    </th>
                                    <th class="border-0 py-3">Fecha</th>
                                    <th class="border-0 py-3">Tercero</th>
                                    <th class="border-0 py-3">Concepto</th>
                                    <th class="border-0 py-3">Detalle</th>
                                    <th class="text-end border-0 py-3">Valor</th>
                                    <th class="text-end pe-4 border-0 py-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${unconciled.length > 0 ? rows : emptyState}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Footer fijo para acciones -->
            <div class="d-flex justify-content-end gap-3 mt-4 p-4 border-top bg-white rounded-bottom shadow-sm">
                <button id="btn-posponer" class="btn btn-outline-secondary px-5 py-2 fw-medium" onclick="App.navigateTo('bancos')">Posponer</button>
                <button id="btnConciliar" class="btn btn-primary px-5 py-2 fw-bold shadow-sm disabled" onclick="App.execConciliacion('${bankId}')">
                    <i class="bi bi-check-circle me-1"></i> Conciliar
                </button>
            </div>
        </div>
        `;
    },

    /* =================================================
       GASTOS
       ================================================= */
    gastos() {
        const expenses = DB.getExpenses().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        let rows = '';
        if (expenses.length === 0) {
            rows = `<tr><td colspan="6" class="text-center text-muted py-4">No hay gastos registrados</td></tr>`;
        } else {
            rows = expenses.map(e => {
                const bank = DB.getBank(e.banco_id);
                return `<tr>
                    <td>${e.fecha}</td>
                    <td><span class="badge-status badge-credito">${e.categoria}</span></td>
                    <td>${e.descripcion}</td>
                    <td class="text-end text-danger fw-bold">${fmt(e.monto)}</td>
                    <td>${bank ? bank.nombre : '-'}</td>
                    <td>
                        <button class="btn-action btn-edit" onclick="App.editGasto('${e.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
                        <button class="btn-action btn-delete" onclick="App.deleteGasto('${e.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-cash-stack"></i> Gastos</div>
                    <button class="btn btn-primary-gradient" onclick="App.newGasto()">
                        <i class="bi bi-plus-lg me-1"></i> Nuevo Gasto
                    </button>
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Categoría</th>
                                <th>Descripción</th>
                                <th class="text-end">Monto</th>
                                <th>Banco</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },

    /* =================================================
       REPORTES
       ================================================= */
    reportes() {
        return `
        <div class="fade-in">
            <h6 class="fw-bold mb-3 text-muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 10px;">Reportes de Ventas y Utilidad</h6>
            <div class="kpi-grid mb-4" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                <div class="report-card" onclick="App.runReport('ventas')" style="cursor:pointer">
                    <div class="report-icon" style="background:var(--primary-bg);color:var(--primary)"><i class="bi bi-cart-check"></i></div>
                    <div class="report-info">
                        <h6>Ventas por Rango de Fecha</h6>
                        <p>Detalle de ventas con cliente, asesor y totales</p>
                    </div>
                </div>
                <div class="report-card" onclick="App.runReport('utilidad')" style="cursor:pointer">
                    <div class="report-icon" style="background:var(--success-bg);color:var(--success)"><i class="bi bi-graph-up"></i></div>
                    <div class="report-info">
                        <h6>Utilidad por Rango de Fecha</h6>
                        <p>Análisis de margen y rentabilidad por periodo</p>
                    </div>
                </div>
                <div class="report-card" onclick="App.runReport('rentabilidad')" style="cursor:pointer">
                    <div class="report-icon" style="background:rgba(79, 70, 229, 0.1);color:#4f46e5"><i class="bi bi-percent"></i></div>
                    <div class="report-info">
                        <h6>Rentabilidad Detallada</h6>
                        <p>Porcentaje de margen neto por factura</p>
                    </div>
                </div>
                <div class="report-card" onclick="App.runReport('utilidad_producto')" style="cursor:pointer">
                    <div class="report-icon" style="background:var(--success-bg);color:var(--success)"><i class="bi bi-box-seam"></i></div>
                    <div class="report-info">
                        <h6>Utilidad por Producto</h6>
                        <p>Rentabilidad detallada por artículo vendido</p>
                    </div>
                </div>
                <div class="report-card" onclick="App.runReport('utilidad_cliente')" style="cursor:pointer">
                    <div class="report-icon" style="background:var(--info-bg);color:var(--info)"><i class="bi bi-people"></i></div>
                    <div class="report-info">
                        <h6>Utilidad por Cliente</h6>
                        <p>Margen de ganancia agrupado por contacto</p>
                    </div>
                </div>
                <div class="report-card" onclick="App.runReport('utilidad_vendedor')" style="cursor:pointer">
                    <div class="report-icon" style="background:var(--warning-bg);color:var(--warning)"><i class="bi bi-person-badge"></i></div>
                    <div class="report-info">
                        <h6>Utilidad por Vendedor</h6>
                        <p>Ventas y comisiones generadas por asesor</p>
                    </div>
                </div>
            </div>

            <h6 class="fw-bold mb-3 text-muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 15px;">Reportes de Inventario y Rotación</h6>
            <div class="kpi-grid mb-4" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                <div class="report-card" onclick="App.runReport('inventario')" style="cursor:pointer">
                    <div class="report-icon" style="background:var(--danger-bg);color:var(--danger)"><i class="bi bi-box-seam"></i></div>
                    <div class="report-info">
                        <h6>Inventario Actual (Valorizado)</h6>
                        <p>Listado de productos con stock, costo y valorización</p>
                    </div>
                </div>
                <div class="report-card" onclick="App.runReport('productos_mas_vendidos')" style="cursor:pointer">
                    <div class="report-icon" style="background:rgba(16, 185, 129, 0.1);color:#10b981"><i class="bi bi-trophy"></i></div>
                    <div class="report-info">
                        <h6>Productos Más Vendidos</h6>
                        <p>Artículos de mayor salida en el periodo</p>
                    </div>
                </div>
                <div class="report-card" onclick="App.runReport('baja_rotacion')" style="cursor:pointer">
                    <div class="report-icon" style="background:rgba(239, 68, 68, 0.1);color:#ef4444"><i class="bi bi-arrow-down-left-circle"></i></div>
                    <div class="report-info">
                        <h6>Productos de Baja Rotación</h6>
                        <p>Artículos con bajo o nulo movimiento de stock</p>
                    </div>
                </div>
            </div>

            <h6 class="fw-bold mb-3 text-muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 15px;">Reportes Financieros y Cartera</h6>
            <div class="kpi-grid mb-4" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                <div class="report-card" onclick="App.runReport('cartera')" style="cursor:pointer">
                    <div class="report-icon" style="background:var(--warning-bg);color:var(--warning)"><i class="bi bi-wallet2"></i></div>
                    <div class="report-info">
                        <h6>Cartera por Cliente</h6>
                        <p>Saldos de cuentas por cobrar y fechas de vencimiento</p>
                    </div>
                </div>
                <div class="report-card" onclick="App.runReport('gastos')" style="cursor:pointer">
                    <div class="report-icon" style="background:var(--info-bg);color:var(--info)"><i class="bi bi-cash-stack"></i></div>
                    <div class="report-info">
                        <h6>Gastos por Mes</h6>
                        <p>Resumen mensual de gastos categorizados</p>
                    </div>
                </div>
                <div class="report-card" onclick="App.runReport('flujo_caja')" style="cursor:pointer">
                    <div class="report-icon" style="background:rgba(59, 130, 246, 0.1);color:#3b82f6"><i class="bi bi-cash-coin"></i></div>
                    <div class="report-info">
                        <h6>Flujo de Caja (Movimientos)</h6>
                        <p>Consolidado temporal de ingresos y egresos bancarios</p>
                    </div>
                </div>
                <div class="report-card" onclick="App.runReport('estado_resultados')" style="cursor:pointer">
                    <div class="report-icon" style="background:rgba(16, 185, 129, 0.1);color:#10b981"><i class="bi bi-file-earmark-spreadsheet"></i></div>
                    <div class="report-info">
                        <h6>Estado de Resultados</h6>
                        <p>Resumen financiero: Ventas - Costos - Gastos = Utilidad</p>
                    </div>
                </div>
                <div class="report-card" onclick="App.runReport('clientes_mayor_compra')" style="cursor:pointer">
                    <div class="report-icon" style="background:rgba(79, 70, 229, 0.1);color:#4f46e5"><i class="bi bi-star"></i></div>
                    <div class="report-info">
                        <h6>Clientes con Mayor Compra</h6>
                        <p>Ranking de clientes según facturación acumulada</p>
                    </div>
                </div>
            </div>

            <div id="reportFilterArea" class="d-none">
                <div class="section-card">
                    <div class="section-header">
                        <div class="section-title" id="reportTitle"><i class="bi bi-file-earmark-bar-graph"></i> Reporte</div>
                        <button class="btn btn-primary-gradient" onclick="App.exportReport()">
                            <i class="bi bi-file-earmark-excel me-1"></i> Exportar Excel
                        </button>
                    </div>
                    <div class="section-body">
                        <div class="filter-bar mb-3" id="reportFilters"></div>
                        <button class="btn btn-primary-gradient mb-3" onclick="App.generateReport()">
                            <i class="bi bi-play-fill me-1"></i> Generar
                        </button>
                        <div id="reportResults" style="overflow-x:auto"></div>
                    </div>
                </div>
            </div>
        </div>`;
    },

    /* =================================================
       INTEGRACIONES
       ================================================= */
    integraciones() {
        if (!Auth.isAdmin()) {
            return `<div class="fade-in"><div class="empty-state"><i class="bi bi-lock"></i><h5>Acceso Restringido</h5><p>Solo el administrador puede gestionar integraciones</p></div></div>`;
        }

        const config = DB.getAll(DB.KEYS.INTEGRATIONS)?.find(c => c.proveedor === 'alegra') || {};
        const lastSync = config.ultima_sincronizacion ? new Date(config.ultima_sincronizacion).toLocaleString() : 'Nunca';

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-plug-fill"></i> Integración con Alegra</div>
                </div>
                <div class="section-body">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label fw-bold">Correo Electrónico Alegra</label>
                                <input type="email" class="form-control" id="alegraEmail" placeholder="usuario@empresa.com" value="${config.email || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">API Key de Alegra (Token)</label>
                                <input type="password" class="form-control" id="alegraApiKey" placeholder="Ingrese su API Key" value="${config.api_key || ''}">
                                <small class="form-text text-muted">
                                    <i class="bi bi-question-circle"></i> ¿No tienes tu API Key? Entra a Alegra, ve a <strong>Configuración > Empresa > Integraciones > API</strong> para generarla.
                                </small>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Estado</label>
                                <select class="form-select" id="alegraEstado">
                                    <option value="inactivo" ${config.estado === 'inactivo' ? 'selected' : ''}>Inactivo</option>
                                    <option value="activo" ${config.estado === 'activo' ? 'selected' : ''}>Activo</option>
                                </select>
                            </div>
                            <button class="btn btn-primary-gradient" onclick="App.saveIntegration()">
                                <i class="bi bi-save me-1"></i> Guardar Configuración
                            </button>
                        </div>
                        <div class="col-md-6">
                            <div class="kpi-card card-info mb-3">
                                <div class="kpi-label"><div class="icon-circle"><i class="bi bi-arrow-repeat"></i></div> Sincronización</div>
                                <div class="kpi-sub mt-2">Última: <span id="lastSync">${lastSync}</span></div>
                                <button class="btn btn-outline-primary mt-3" onclick="App.syncAlegra()" id="syncBtn">
                                    <i class="bi bi-arrow-clockwise me-1"></i> Sincronizar Ahora
                                </button>
                                <button class="btn btn-outline-success mt-3 ms-2" onclick="App.importFromLocalJSON()" id="importJsonBtn">
                                    <i class="bi bi-file-earmark-arrow-up me-1"></i> Importar desde datos_alegra.json
                                </button>
                            </div>

                            <div class="alert alert-info">
                                <i class="bi bi-info-circle me-1"></i>
                                <strong>Nota:</strong> La integración con Alegra sincroniza clientes, productos, ventas y pagos desde la API de Alegra (solo lectura).
                            </div>
                        </div>
                    </div>

                    <h6 class="fw-bold mb-3"><i class="bi bi-journal-text me-2"></i>Logs de Sincronización</h6>
                    <div id="integrationLogs">
                        <p class="text-muted">No hay logs de sincronización</p>
                    </div>

                    <hr class="my-4 border-danger">
                    <h6 class="fw-bold text-danger mb-3"><i class="bi bi-exclamation-triangle-fill me-2"></i>Zona de Peligro (Reseteo de Fábrica)</h6>
                    <div class="alert alert-danger">
                        <strong>¡Advertencia!</strong> Esta acción borrará todas las ventas, cotizaciones, productos, clientes, compras y movimientos. Solo se conservará tu configuración y usuarios. Úsalo si vas a importar todo desde Alegra.
                    </div>
                    <button class="btn btn-danger" onclick="App.factoryReset()">
                        <i class="bi bi-trash-fill me-1"></i> Borrar Todo el Sistema
                    </button>
                </div>
            </div>
        </div>`;
    },

    /* =================================================
       USUARIOS
       ================================================= */
    usuarios() {
        if (!Auth.isAdmin()) {
            return `<div class="fade-in"><div class="empty-state"><i class="bi bi-lock"></i><h5>Acceso Restringido</h5><p>Solo el administrador puede gestionar usuarios</p></div></div>`;
        }

        const users = DB.getUsers();
        let rows = '';
        if (users.length === 0) {
            rows = `<tr><td colspan="5" class="text-center text-muted py-4">No hay usuarios</td></tr>`;
        } else {
            rows = users.map(u => `<tr>
                <td><strong>${u.nombre}</strong></td>
                <td>${u.email}</td>
                <td><span class="badge-status badge-${u.rol}">${u.rol}</span></td>
                <td><span class="badge-status badge-${u.estado}">${u.estado}</span></td>
                <td>
                    <button class="btn-action btn-edit" onclick="App.editUsuario('${u.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button class="btn-action btn-delete" onclick="App.deleteUsuario('${u.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`).join('');
        }

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-gear-fill"></i> Usuarios</div>
                    <button class="btn btn-primary-gradient" onclick="App.newUsuario()">
                        <i class="bi bi-plus-lg me-1"></i> Nuevo Usuario
                    </button>
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Rol</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },

    /* =================================================
       PLACEDHOLDERS PARA NUEVOS MÓDULOS (FASE 11+)
       ================================================= */
    movimientos() {
        const products = DB.getProducts();
        const today = new Date().toISOString().split('T')[0];
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-arrow-left-right"></i> Kardex / Movimientos de Inventario</div>
                </div>
                <div class="section-body">
                    <div class="row g-2 mb-3">
                        <div class="col-md-3">
                            <label class="form-label mb-1" style="font-size: 11px; font-weight: 600;">Producto</label>
                            <select class="form-select form-select-sm" id="kardexProductoSelect">
                                <option value="">Todos los productos</option>
                                ${products.map(p => `<option value="${p.id}">${p.codigo} - ${p.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label mb-1" style="font-size: 11px; font-weight: 600;">Tipo Movimiento</label>
                            <select class="form-select form-select-sm" id="kardexTipoSelect">
                                <option value="">Todos</option>
                                <option value="Entrada">Entradas</option>
                                <option value="Salida">Salidas</option>
                                <option value="Ajuste">Ajustes</option>
                                <option value="Devolución">Devoluciones</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label mb-1" style="font-size: 11px; font-weight: 600;">Desde</label>
                            <input type="date" class="form-control form-control-sm" id="kardexDesde" value="${monthAgo}">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label mb-1" style="font-size: 11px; font-weight: 600;">Hasta</label>
                            <input type="date" class="form-control form-control-sm" id="kardexHasta" value="${today}">
                        </div>
                        <div class="col-md-1 d-flex align-items-end">
                            <button class="btn btn-primary-gradient btn-sm w-100" onclick="App.filterKardex()" style="height: 31px;">
                                <i class="bi bi-search"></i> Buscar
                            </button>
                        </div>
                    </div>
                    
                    <div id="kardexTableContainer" style="overflow-x:auto;">
                        <!-- Table rendered dynamically -->
                        <p class="text-muted text-center py-4">Cargando movimientos de inventario...</p>
                    </div>
                </div>
            </div>
        </div>`;
    },
    pagos_recibidos() {
        const items = DB.getRecibosCaja();
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        let rows = '';
        if (items.length === 0) {
            rows = `<tr><td colspan="6" class="text-center text-muted py-4">No hay recibos de caja registrados</td></tr>`;
        } else {
            const sorted = [...items].sort((a, b) => new Date(b.created_at || b.fecha) - new Date(a.created_at || a.fecha));
            rows = sorted.map(r => {
                const client = DB.getClient(r.cliente_id);
                const bank = DB.getBank(r.banco_id);
                const badgeClass = r.estado === 'activo' ? 'success' : 'danger';
                const ref = r.id.toString().length > 6 ? r.id.toString().substr(-6).toUpperCase() : r.id.toString().toUpperCase();
                return `<tr>
                    <td><strong>#${ref}</strong></td>
                    <td>${r.fecha || '-'}</td>
                    <td>${client ? client.nombre : 'Consumidor Final'}</td>
                    <td>${bank ? bank.nombre : '-'}</td>
                    <td class="text-end"><strong>${fmt(r.monto_total || 0)}</strong></td>
                    <td><span class="badge bg-${badgeClass} text-uppercase" style="font-size:0.75rem">${r.estado || 'activo'}</span></td>
                    <td>
                        <button class="btn-action btn-view" onclick="App.viewReciboCaja('${r.id}')" title="Ver detalle"><i class="bi bi-eye"></i></button>
                        ${r.estado !== 'anulado' ? `<button class="btn-action btn-delete" onclick="App.anularReciboCaja('${r.id}')" title="Anular"><i class="bi bi-x-circle"></i></button>` : ''}
                    </td>
                </tr>`;
            }).join('');
        }

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title">
                        <i class="bi bi-cash-stack"></i> Pagos Recibidos (Recibos de Caja)
                        <span class="badge bg-light text-dark ms-2" style="font-size: 0.7rem; font-weight: 500;">${items.length} recibos</span>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-primary-gradient" onclick="App.newReciboCaja()">
                            <i class="bi bi-plus-lg me-1"></i> Nuevo Recibo de Caja
                        </button>
                    </div>
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Referencia</th>
                                <th>Fecha</th>
                                <th>Cliente</th>
                                <th>Banco</th>
                                <th class="text-end">Monto</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },

    cotizaciones(searchQuery = '') {
        const allItems = DB.getCotizaciones();
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        // Sort: most recent first
        const sorted = [...allItems].sort((a, b) => {
            const dateA = a && a.fecha ? new Date(a.fecha) : 0;
            const dateB = b && b.fecha ? new Date(b.fecha) : 0;
            return dateB - dateA;
        });

        // Apply search
        const q = (searchQuery || '').toLowerCase().trim();
        const items = q ? sorted.filter(c => {
            if (!c) return false;
            const client = DB.getClient(c.cliente_id);
            const ref = (c.numero || (c.id ? c.id.toString().substr(-6) : '')).toString().replace('#', '').toLowerCase();
            const clientName = (client ? client.nombre : '').toLowerCase();
            return ref.includes(q) || clientName.includes(q);
        }) : sorted;

        let rows = '';

        if (!Array.isArray(items) || items.length === 0) {
            rows = `<tr><td colspan="7" class="text-center text-muted py-4">${q ? `No se encontraron resultados para "<strong>${q}</strong>"` : 'No hay cotizaciones registradas'}</td></tr>`;
        } else {
            rows = items.map(c => {
                try {
                    if (!c || !c.id) return '';
                    const client = DB.getClient(c.cliente_id);
                    const clientName = DB.getClientName(c.cliente_id, c.cliente_nombre_alegra);
                    let badgeClass = 'secondary';
                    if (c.estado === 'enviada') badgeClass = 'info';
                    if (c.estado === 'aceptada') badgeClass = 'success';
                    if (c.estado === 'rechazada') badgeClass = 'danger';
                    if (c.estado === 'vencida') badgeClass = 'warning';
                    if (c.estado === 'convertida') badgeClass = 'primary';

                    const ref = c.numero || (c.id ? (c.id.toString().length > 6 ? c.id.toString().substr(-6).toUpperCase() : c.id.toString().toUpperCase()) : 'N/A');
                    const fechaStr = c.fecha ? (c.fecha.includes('T') ? new Date(c.fecha).toLocaleDateString('es-CO') : c.fecha) : 'Sin fecha';
                    const validezStr = c.validez ? (c.validez.includes('T') ? new Date(c.validez).toLocaleDateString('es-CO') : c.validez) : '-';
                    const yaConvertida = c.estado === 'convertida' || !!c.factura_id;

                    return `<tr>
                        <td><a href="#" onclick="event.preventDefault(); App.editCotizacion('${c.id}')" class="text-decoration-none fw-bold">${ref.replace('#', '')}</a></td>
                        <td>${fechaStr}</td>
                        <td><a href="#" onclick="event.preventDefault(); App.viewCliente('${c.cliente_id}')" class="text-decoration-none fw-bold">${clientName}</a></td>
                        <td>${validezStr}</td>
                        <td><span class="badge bg-${badgeClass} text-uppercase" style="font-size:0.75rem">${c.estado || 'borrador'}</span></td>
                        <td class="text-end"><strong>${fmt(c.total || 0)}</strong></td>
                        <td>
                            <button class="btn-action btn-edit" onclick="App.editCotizacion('${c.id}')" title="Ver / Editar"><i class="bi bi-pencil"></i></button>
                            ${!yaConvertida ? `<button class="btn-action" style="color:#0d6efd" onclick="App.convertFactura('${c.id}')" title="Convertir a Factura"><i class="bi bi-arrow-right-circle"></i></button>` : `<button class="btn-action" style="color:#6c757d; opacity:0.5; cursor:default" title="Ya convertida - Factura #${c.factura_id ? c.factura_id.substr(-6).toUpperCase() : ''}"><i class="bi bi-check-circle"></i></button>`}
                            <button class="btn-action" style="color:#6c757d" onclick="App.printCotizacion('${c.id}')" title="Imprimir Cotización"><i class="bi bi-printer"></i></button>
                            ${!yaConvertida ? `<button class="btn-action btn-delete" onclick="App.deleteCotizacion('${c.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>` : ''}
                        </td>
                    </tr>`;
                } catch (e) {
                    console.error('Error rendering cotizacion row:', c, e);
                    return `<tr><td colspan="7" class="text-danger small"><i class="bi bi-exclamation-triangle"></i> Error en registro #${c?.id || '?'}: ${e.message}</td></tr>`;
                }
            }).join('');
        }

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title">
                        <i class="bi bi-file-earmark-text"></i> Cotizaciones
                        <span class="badge bg-light text-dark ms-2" style="font-size: 0.7rem; font-weight: 500;">${allItems.length} documentos</span>
                    </div>
                    <div class="d-flex gap-2 align-items-center">
                        ${TableSort.renderFilterBar({
                            ctx: 'cotizaciones',
                            placeholder: 'Buscar por cliente o #...',
                            searchId: 'cotizacionesSearchInput',
                            onSearchInput: 'App.filterCotizaciones(this.value)',
                            searchValue: searchQuery,
                            opts: [
                                { value: 'todas', label: 'Todos los estados' },
                                { value: 'borrador', label: 'Borrador' },
                                { value: 'enviada', label: 'Enviadas' },
                                { value: 'aceptada', label: 'Aceptadas' },
                                { value: 'rechazada', label: 'Rechazadas' },
                                { value: 'convertida', label: 'Convertidas' }
                            ]
                        })}
                        <button class="btn btn-primary-gradient" onclick="App.newCotizacion()">
                            <i class="bi bi-plus-lg me-1"></i> Nueva Cotización
                        </button>
                    </div>
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                ${TableSort.renderSortTh('Referencia', 'numero', 'cotizaciones')}
                                ${TableSort.renderSortTh('Fecha', 'fecha', 'cotizaciones')}
                                <th>Cliente</th>
                                <th>Validez</th>
                                ${TableSort.renderSortTh('Estado', 'estado', 'cotizaciones')}
                                <th class="text-end">Total</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="cotizacionesTableBody">${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },

    facturas_compra() {
        // Firm purchase invoices are orders with state 'received'
        const items = DB.getCompras().filter(c => c.estado === 'recibida');
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        let rows = '';
        if (items.length === 0) {
            rows = `<tr><td colspan="6" class="text-center text-muted py-4">No hay facturas de compra en firme</td></tr>`;
        } else {
            rows = items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(c => {
                const ref = c.id.toString().substr(-6).toUpperCase();
                return `<tr>
                    <td><strong>#${ref}</strong></td>
                    <td>${c.fecha}</td>
                    <td>${c.proveedor}</td>
                    <td><span class="badge-status badge-${c.tipo_pago}">${c.tipo_pago}</span></td>
                    <td class="text-end"><strong>${fmt(c.total)}</strong></td>
                    <td>
                        <button class="btn-action btn-view" onclick="App.editCompra('${c.id}')" title="Ver Detalle"><i class="bi bi-eye"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        return `
        <div class="fade-in">
            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-receipt-cutoff"></i> Facturas de Compra (Recibidas)</div>
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Referencia</th>
                                <th>Fecha</th>
                                <th>Proveedor</th>
                                <th>Tipo</th>
                                <th class="text-end">Total</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },
    pagos_realizados(filter = 'todas') {
        const items = DB.getCarteraProveedores(filter);
        const pagosHistory = DB.getPagosProveedores().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        let rows = '';
        if (items.length === 0) {
            rows = `<tr><td colspan="7" class="text-center text-muted py-4">No hay compromisos financieros pendientes</td></tr>`;
        } else {
            rows = items.map(c => {
                return `<tr>
                    <td><strong>${c.proveedor_nombre}</strong></td>
                    <td>#${c.compra_id.substr(-6).toUpperCase()}</td>
                    <td class="text-end">${fmt(c.total)}</td>
                    <td class="text-end text-danger"><strong>${fmt(c.saldo)}</strong></td>
                    <td>${c.fecha_vencimiento}</td>
                    <td><span class="badge-status badge-${c.estado}">${c.estado}</span></td>
                    <td>
                        ${c.saldo > 0 ? `<button class="btn-action btn-view" onclick="App.registrarPagoProveedor('${c.id}')" title="Registrar Pago"><i class="bi bi-cash-coin"></i></button>` : ''}
                    </td>
                </tr>`;
            }).join('');
        }

        let historyRows = '';
        if (pagosHistory.length === 0) {
            historyRows = `<tr><td colspan="5" class="text-center text-muted py-4">No hay pagos registrados</td></tr>`;
        } else {
            historyRows = pagosHistory.map(p => {
                const bank = DB.getBank(p.banco_id);
                const dateStr = p.fecha.includes('T') ? new Date(p.fecha).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : p.fecha;
                return `<tr>
                    <td><strong>#${p.numero || p.id.toString().substr(-6).toUpperCase()}</strong></td>
                    <td>${dateStr}</td>
                    <td>${p.proveedor_nombre}</td>
                    <td>${bank ? bank.nombre : 'N/A'}</td>
                    <td class="text-end"><strong>${fmt(p.monto)}</strong></td>
                </tr>`;
            }).join('');
        }

        return `
        <div class="fade-in">
            <div class="section-card mb-4">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-credit-card"></i> Cartera de Proveedores (Cuentas por Pagar)</div>
                    <div class="filter-pills">
                        <button class="filter-pill ${filter === 'todas' ? 'active' : ''}" onclick="App.navigateTo('pagos_realizados', 'todas')">Todas</button>
                        <button class="filter-pill ${filter === 'vigente' ? 'active' : ''}" onclick="App.navigateTo('pagos_realizados', 'vigente')">Vigentes</button>
                        <button class="filter-pill ${filter === 'vencida' ? 'active' : ''}" onclick="App.navigateTo('pagos_realizados', 'vencida')">Vencidas</button>
                        <button class="filter-pill ${filter === 'pagada' ? 'active' : ''}" onclick="App.navigateTo('pagos_realizados', 'pagada')">Pagadas</button>
                    </div>
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Proveedor</th>
                                <th>Compra</th>
                                <th class="text-end">Total</th>
                                <th class="text-end">Saldo</th>
                                <th>Vencimiento</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>

            <div class="section-card">
                <div class="section-header">
                    <div class="section-title"><i class="bi bi-calendar-check"></i> Historial de Pagos Realizados</div>
                </div>
                <div class="section-body" style="padding:0; overflow-x:auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Ref. Pago</th>
                                <th>Fecha y Hora</th>
                                <th>Proveedor</th>
                                <th>Banco</th>
                                <th class="text-end">Monto</th>
                            </tr>
                        </thead>
                        <tbody>${historyRows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    },

    renderInvoicePrintView(id, type = 'venta') {
        const isCotizacion = type === 'cotizacion';
        const doc = isCotizacion ? DB.getCotizacion(id) : DB.getSale(id);
        if (!doc) return `<div class="p-5 text-center text-danger">Documento no encontrado.</div>`;

        const details = isCotizacion ? DB.getCotizacionDetails(id) : DB.getSaleDetails(id);
        const client = DB.getClient(doc.cliente_id);
        
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO') : '-';
        
        const refNum = doc.numero ? doc.numero.toString().replace('#', '') : doc.id.toString().substr(-6).toUpperCase();

        let saldo = 0;
        if (!isCotizacion && doc.tipo_venta !== 'contado') {
            const allCartera = DB.getAll(DB.KEYS.CARTERA);
            const carteraItem = allCartera.find(c => c.venta_id === doc.id);
            if (carteraItem) saldo = parseFloat(carteraItem.saldo);
        }

        let detailRows = '';
        if (details.length === 0) {
            detailRows = `<tr><td colspan="4" class="text-center text-muted">No hay items</td></tr>`;
        } else {
            detailRows = details.map(d => {
                const product = DB.getProduct(d.producto_id);
                return `<tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.descripcion || (product ? product.nombre : '-')}</td>
                    <td class="text-center" style="padding: 8px; border-bottom: 1px solid #eee;">${d.cantidad}</td>
                    <td class="text-end" style="padding: 8px; border-bottom: 1px solid #eee;">${fmt(d.precio_unitario)}</td>
                    <td class="text-end" style="padding: 8px; border-bottom: 1px solid #eee;">${fmt(d.subtotal)}</td>
                </tr>`;
            }).join('');
        }

        const title = isCotizacion ? 'COTIZACIÓN' : 'FACTURA DE VENTA';
        const badgeState = doc.estado || (isCotizacion ? 'PENDIENTE' : 'OK');
        const badgeColor = ['pagada', 'aprobada', 'facturada'].includes(badgeState) ? 'success' : (['anulada', 'rechazada'].includes(badgeState) ? 'danger' : 'warning text-dark');
        
        const vencimientoStyle = isCotizacion ? App.getVencimientoStyle(doc.validez, doc.estado) : App.getVencimientoStyle(doc.fecha_vencimiento, doc.estado);
        const vencimientoDate = isCotizacion ? doc.validez : doc.fecha_vencimiento;

        return `
        <style>
            @media print {
                /* Ocultar el layout general del software */
                body * {
                    visibility: hidden;
                }
                /* Mostrar UNICAMENTE el contenedor de la hoja de la factura */
                #invoice-print-container, #invoice-print-container * {
                    visibility: visible;
                }
                #invoice-print-container {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    box-shadow: none;
                    background: white;
                }
                /* Evitar saltos de página huérfanos */
                html, body {
                    height: auto;
                    overflow: visible;
                }
                .print\\:hidden {
                    display: none !important;
                }
            }
        </style>
        <div class="bg-light p-3 p-md-5 d-flex justify-content-center" style="min-height: 100vh;">
            <div id="invoice-print-container" class="invoice-paper bg-white p-4 p-md-5 shadow-lg rounded position-relative" style="width: 100%; max-width: 800px; margin: 2rem auto;">
                
                <div class="d-print-none print:hidden mb-4 d-flex justify-content-between align-items-center">
                    <button class="btn btn-outline-secondary" onclick="App.navigateTo('${isCotizacion ? 'cotizaciones' : 'ventas'}')">
                        <i class="bi bi-arrow-left me-1"></i> Volver
                    </button>
                    <button class="btn btn-primary" onclick="window.print()">
                        <i class="bi bi-printer me-2"></i>Imprimir
                    </button>
                </div>

                <div class="row border-bottom pb-4 mb-4 mt-2">
                    <div class="col-sm-6">
                        <h2 class="fw-bold text-primary mb-1">MAS Accesorios</h2>
                        <p class="text-muted mb-0 small">NIT: 900.123.456-7<br>Tel: +57 300 123 4567<br>contacto@masaccesorios.com</p>
                    </div>
                    <div class="col-sm-6 text-sm-end mt-3 mt-sm-0">
                        <h3 class="fw-bold text-dark mb-1">${title}</h3>
                        <p class="fs-5 fw-bold text-primary mb-0">${refNum}</p>
                        <span class="badge bg-${badgeColor} text-uppercase mt-2">${badgeState}</span>
                    </div>
                </div>

                <div class="row mb-4">
                    <div class="col-sm-7">
                        <h6 class="text-uppercase text-muted fw-bold mb-2" style="font-size: 0.75rem;">${isCotizacion ? 'Cotizado' : 'Facturado'} a:</h6>
                        <h5 class="fw-bold mb-1">${client ? client.nombre : 'Consumidor Final'}</h5>
                        <p class="mb-0 text-muted small">
                            ${client && client.documento ? `NIT/CC: ${client.documento}<br>` : ''}
                            ${client && client.telefono ? `Tel: ${client.telefono}<br>` : ''}
                            ${client && client.direccion ? `Dir: ${client.direccion}` : ''}
                        </p>
                    </div>
                    <div class="col-sm-5 text-sm-end mt-3 mt-sm-0">
                        <h6 class="text-uppercase text-muted fw-bold mb-2" style="font-size: 0.75rem;">Detalles:</h6>
                        <p class="mb-1 small"><strong>Fecha Creación:</strong> ${fmtDate(doc.fecha)}</p>
                        <p class="mb-1 small"><strong>Vencimiento:</strong> <span class="${vencimientoStyle}">${fmtDate(vencimientoDate) || '-'}</span></p>
                        ${!isCotizacion && doc.tipo_venta ? `<p class="mb-0 small"><strong>Tipo:</strong> ${doc.tipo_venta.toUpperCase()}</p>` : ''}
                    </div>
                </div>

                <div class="table-responsive mb-4">
                    <table class="table table-borderless mb-0">
                        <thead class="border-bottom border-dark">
                            <tr>
                                <th class="py-2 text-uppercase text-muted" style="font-size: 0.8rem;">Descripción</th>
                                <th class="py-2 text-uppercase text-muted text-center" style="font-size: 0.8rem; width: 10%;">Cant.</th>
                                <th class="py-2 text-uppercase text-muted text-end" style="font-size: 0.8rem; width: 20%;">Precio Unit.</th>
                                <th class="py-2 text-uppercase text-muted text-end" style="font-size: 0.8rem; width: 20%;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${detailRows}
                        </tbody>
                    </table>
                </div>

                <div class="row">
                    <div class="col-sm-7">
                        ${doc.observacion ? `<p class="small text-muted"><strong>Notas:</strong><br>${doc.observacion}</p>` : ''}
                    </div>
                    <div class="col-sm-5">
                        <div class="d-flex justify-content-between mb-2 small">
                            <span>Subtotal</span>
                            <span>${fmt(doc.subtotal || doc.total)}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-3 small">
                            <span>Descuento</span>
                            <span>${fmt(doc.descuento || 0)}</span>
                        </div>
                        <div class="d-flex justify-content-between py-3 border-top border-dark border-2">
                            <strong class="fs-5">TOTAL A PAGAR</strong>
                            <strong class="fs-5 text-primary">${fmt(doc.total)}</strong>
                        </div>
                        ${!isCotizacion && doc.tipo_venta === 'credito' ? `
                        <div class="d-flex justify-content-between mt-2 pt-2 border-top small text-muted">
                            <span>Saldo Pendiente</span>
                            <strong class="text-danger">${fmt(saldo)}</strong>
                        </div>` : ''}
                    </div>
                </div>
                
                <div class="mt-5 pt-4 border-top text-center text-muted small">
                    ${isCotizacion ? '<p class="mt-2 mb-0">Esta cotización no constituye una factura de venta.</p>' : '<p class="mb-0">Firma de Aceptación ___________________________</p>'}
                    <p class="mt-2 mb-0">Documento generado por MAS Accesorios.</p>
                </div>

            </div>
        </div>`;
    }
};
