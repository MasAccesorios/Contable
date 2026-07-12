/* =====================================================
   MAS Accesorios - Main Application Controller
   ===================================================== */

const App = {
    currentPage: 'dashboard',
    currentReportType: null,
    currentReportData: null,
    ventaDetalle: [],
    compraDetalle: [],
    selectors: {},

    /* =================================================
       INIT
       ================================================= */
    async init() {
        this.setupGlobals();
        
        console.log("Iniciando app, sincronizando con Google Sheets...");
        await DB.syncFromCloud();
        
        this.setupAuth();
        this.setupNavigation();
        this.setupEventListeners();
        this.setupSelectors();
        this.setupNumericFormatting();
        
        // Soporta tanto Auth.check como Auth.init dependiendo de la versión original
        const isLoggedIn = (typeof Auth.check === 'function' && Auth.check()) || 
                           (typeof Auth.init === 'function' && Auth.init());
                           
        if (isLoggedIn) this.showApp();
    },

    setupGlobals() {
        // Set current date
        const now = new Date();
        document.getElementById('currentDate').textContent =
            now.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // Close sidebar on mobile when clicking overlay
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('sidebar-overlay')) {
                this.closeSidebar();
            }
        });
    },

    setupAuth() {
        // Auth logic is handled by Auth.init() and Auth.check()
    },

    setupNavigation() {
        // Sidebar navigation
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(item.dataset.page);
            });
        });
        document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
    },

    setupEventListeners() {
        // Save buttons
        document.getElementById('saveClienteBtn').addEventListener('click', () => this.saveCliente());
        document.getElementById('saveProductoBtn').addEventListener('click', () => this.saveProducto());
        document.getElementById('saveVentaBtn').addEventListener('click', () => this.saveVenta());
        document.getElementById('saveAbonoBtn').addEventListener('click', () => this.saveAbono());
        document.getElementById('saveBancoBtn').addEventListener('click', () => this.saveBanco());
        document.getElementById('saveGastoBtn').addEventListener('click', () => this.saveGasto());
        document.getElementById('saveUsuarioBtn').addEventListener('click', () => this.saveUsuario());
        document.getElementById('saveVendedorBtn').addEventListener('click', () => this.saveVendedor());
        document.getElementById('saveAjusteBtn').addEventListener('click', () => this.saveAjuste());
        document.getElementById('addProductoVenta').addEventListener('click', () => this.addProductToSale());
        document.getElementById('addProductoCompra').addEventListener('click', () => this.addProductoCompra());
        document.getElementById('addProductoCotizacion').addEventListener('click', () => this.addProductoCotizacion());
        document.getElementById('saveCompraBtn').addEventListener('click', () => this.saveCompra());
        document.getElementById('saveCotizacionBtn').addEventListener('click', () => this.saveCotizacion());
        document.getElementById('saveReciboCajaBtn').addEventListener('click', () => this.saveReciboCaja());
        document.getElementById('saveDevolucionBtn').addEventListener('click', () => this.saveDevolucion());
        document.getElementById('savePagoProveedorBtn').addEventListener('click', () => this.savePagoProveedor());
        document.getElementById('btnAplicarAntiguedad').addEventListener('click', () => this.applyByAge());
        document.getElementById('reciboCajaMonto').addEventListener('input', () => this.updateReciboCajaTotals());

        // Purchase Row Logic
        document.getElementById('compraCantidad').addEventListener('input', () => this.updateCompraRowTotal());
        document.getElementById('compraCosto').addEventListener('input', () => this.updateCompraRowTotal());

        // Focus flow for purchase row
        document.getElementById('compraCantidad').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); document.getElementById('compraCosto').focus(); }
        });
        document.getElementById('compraCosto').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); document.getElementById('compraPrecioVentaSelect').focus(); }
        });
        document.getElementById('compraPrecioVentaSelect').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addProductoCompra').click(); }
        });

        // Venta tipo change
        document.getElementById('ventaTipo').addEventListener('change', (e) => {
            document.getElementById('ventaBanco').closest('.col-md-4').style.display =
                e.target.value === 'contado' ? 'block' : 'none';
        });

        // Compra tipo change
        document.getElementById('compraTipo').addEventListener('change', (e) => {
            document.getElementById('compraBancoContainer').parentElement.style.display =
                e.target.value === 'contado' ? 'block' : 'none';
        });

        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Global Search
        const globalSearchInput = document.getElementById('globalSearchInput');
        const globalSearchResults = document.getElementById('globalSearchResults');

        if (globalSearchInput) {
            globalSearchInput.addEventListener('input', (e) => this.handleGlobalSearch(e.target.value));
            globalSearchInput.addEventListener('focus', (e) => {
                if (e.target.value.trim().length > 0 && globalSearchResults.innerHTML.trim() !== '') {
                    globalSearchResults.style.display = 'block';
                }
            });
            // Hide on outside click
            document.addEventListener('click', (e) => {
                if (!globalSearchInput.contains(e.target) && !globalSearchResults.contains(e.target)) {
                    globalSearchResults.style.display = 'none';
                }
            });
        }
    },

    handleGlobalSearch(query) {
        const resultsContainer = document.getElementById('globalSearchResults');
        query = query.trim().toLowerCase();

        if (query.length < 2) {
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
            return;
        }

        const products = DB.getProducts();
        const clients = DB.getClients();

        const matchedProducts = products.filter(p =>
            (p.nombre && p.nombre.toLowerCase().includes(query)) ||
            (p.codigo && p.codigo.toLowerCase().includes(query))
        ).slice(0, 5); // Limit to 5

        const matchedClients = clients.filter(c =>
            (c.nombre && c.nombre.toLowerCase().includes(query)) ||
            (c.documento && c.documento.toLowerCase().includes(query))
        ).slice(0, 5); // Limit to 5

        this.renderGlobalSearchResults(matchedProducts, matchedClients, query);
    },

    renderGlobalSearchResults(products, clients, query) {
        const resultsContainer = document.getElementById('globalSearchResults');
        let html = '';

        if (products.length === 0 && clients.length === 0) {
            html = `<div class="p-3 text-center text-muted small">No se encontraron resultados para "${query}"</div>`;
        } else {
            if (products.length > 0) {
                html += `<h6 class="dropdown-header text-uppercase text-muted" style="font-size: 0.7rem; letter-spacing: 0.5px;">Productos</h6>`;
                products.forEach(p => {
                    html += `
                        <a class="dropdown-item py-2 border-bottom text-wrap" href="#" onclick="event.preventDefault(); document.getElementById('globalSearchResults').style.display='none'; App.viewProducto('${p.id}')">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <span class="fw-bold d-block text-truncate" style="max-width: 200px;">${p.nombre}</span>
                                    <small class="text-muted"><i class="bi bi-upc-scan me-1"></i>${p.codigo}</small>
                                </div>
                                <span class="badge bg-light text-dark border">
                                    Stock: ${p.stock_actual}
                                </span>
                            </div>
                        </a>
                    `;
                });
            }

            if (clients.length > 0) {
                html += `<h6 class="dropdown-header text-uppercase text-muted mt-2" style="font-size: 0.7rem; letter-spacing: 0.5px;">Contactos</h6>`;
                clients.forEach(c => {
                    html += `
                        <a class="dropdown-item py-2 ${clients.indexOf(c) !== clients.length - 1 ? 'border-bottom' : ''}" href="#" onclick="event.preventDefault(); document.getElementById('globalSearchResults').style.display='none'; App.viewCliente('${c.id}')">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <span class="fw-bold d-block text-truncate" style="max-width: 200px;">${c.nombre}</span>
                                    <small class="text-muted"><i class="bi bi-person-vcard me-1"></i>${c.documento || 'N/A'}</small>
                                </div>
                                <span class="badge badge-status badge-${c.tipo && c.tipo.toLowerCase() === 'proveedor' ? 'credito' : 'contado'}">${c.tipo || 'Cliente'}</span>
                            </div>
                        </a>
                    `;
                });
            }
        }

        resultsContainer.innerHTML = html;
        resultsContainer.style.display = 'block';
    },

    setupSelectors() {
        this.initSelectors();
    },

    initSelectors() {
        this.selectors.ventaCliente = new SearchableSelect('ventaClienteContainer', { placeholder: 'Buscar contacto...' });
        this.selectors.ventaProducto = new SearchableSelect('ventaProductoContainer', {
            placeholder: 'Referencia o Nombre del Producto...',
            onSelect: (item) => {
                const product = DB.getProducts().find(p => p.id === item.id);
                if (product) {
                    document.getElementById('ventaCantidad').focus();
                }
            }
        });
        this.selectors.ventaBanco = new SearchableSelect('ventaBancoContainer', { placeholder: 'Seleccione banco...' });

        this.selectors.cotizacionCliente = new SearchableSelect('cotizacionClienteContainer', { placeholder: 'Buscar contacto...' });
        this.selectors.cotizacionVendedor = new SearchableSelect('cotizacionVendedorContainer', { placeholder: 'Seleccione vendedor...' });
        this.selectors.cotizacionProducto = new SearchableSelect('cotizacionProductoContainer', {
            placeholder: 'Referencia o Nombre del Producto...',
            onSelect: (item) => {
                const product = DB.getProducts().find(p => p.id === item.id);
                if (product) {
                    document.getElementById('cotizacionPrecioManual').value = Math.round(product.precio_venta || 0);
                    document.getElementById('cotizacionCantidad').focus();
                    document.getElementById('cotizacionCantidad').select();
                }
            }
        });

        this.selectors.ventaVendedor = new SearchableSelect('ventaVendedorContainer', { placeholder: 'Seleccione vendedor...' });

        this.selectors.compraProveedor = new SearchableSelect('compraProveedorContainer', { placeholder: 'Buscar proveedor...' });
        this.selectors.compraProducto = new SearchableSelect('compraProductoContainer', {
            placeholder: 'Referencia o Nombre...',
            onSelect: (item) => {
                const product = DB.getProducts().find(p => p.id === item.id);
                if (product) {
                    document.getElementById('compraRef').value = product.codigo || '';
                    document.getElementById('compraCosto').value = product.precio_compra || 0;
                    document.getElementById('compraPrecioVentaSelect').value = product.precio_venta || 0;
                    this.updateCompraRowTotal();
                    document.getElementById('compraCantidad').focus();
                    document.getElementById('compraCantidad').select();
                }
            }
        });
        this.selectors.compraBanco = new SearchableSelect('compraBancoContainer', { placeholder: 'Seleccione banco...' });

        this.selectors.abonoBanco = new SearchableSelect('abonoBancoContainer', { placeholder: 'Seleccione banco...' });
        this.selectors.gastoBanco = new SearchableSelect('gastoBancoContainer', { placeholder: 'Seleccione banco...' });

        this.selectors.reciboCajaCliente = new SearchableSelect('reciboCajaClienteContainer', {
            placeholder: 'Buscar cliente...',
            onSelect: (item) => this.loadFacturasPendientes(item.id)
        });
        this.selectors.reciboCajaBanco = new SearchableSelect('reciboCajaBancoContainer', { placeholder: 'Seleccione banco...' });
        this.selectors.pagoProveedorBanco = new SearchableSelect('pagoProveedorBancoContainer', { placeholder: 'Seleccione banco...' });

        this.selectors.devolucionVenta = new SearchableSelect('devolucionVentaContainer', {
            placeholder: 'Buscar Factura...',
            onSelect: (item) => this.loadVentaItemsForReturn(item.id)
        });
        this.selectors.devolucionBanco = new SearchableSelect('devBancoSelectContainer', { placeholder: 'Seleccione banco...' });
    },

    /* =================================================
       AUTH
       ================================================= */
    handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        if (Auth.login(email, password)) {
            this.showApp();
        } else {
            const err = document.getElementById('loginError');
            err.classList.remove('d-none');
            err.textContent = 'Credenciales inválidas. Intente de nuevo.';
        }
    },

    handleLogout() {
        Auth.logout();
        this.showLogin();
    },

    showLogin() {
        document.getElementById('loginScreen').classList.remove('d-none');
        document.getElementById('mainApp').classList.add('d-none');
    },

    showApp() {
        document.getElementById('loginScreen').classList.add('d-none');
        document.getElementById('mainApp').classList.remove('d-none');
        document.getElementById('currentUserName').textContent = Auth.getUserName();
        document.getElementById('currentUserRole').textContent = Auth.getUserRole();

        // Update sidebar visibility based on RBAC permissions
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            const page = item.dataset.page;
            if (page && !Auth.canAccess(page)) {
                item.style.display = 'none';
            } else {
                item.style.display = 'block'; // block or flex varies, but Bootstrap default display is returned by removing inline
                item.style.removeProperty('display');
            }
        });

        // Hide admin-only categories for vendedores
        if (!Auth.isAdmin()) {
            document.querySelectorAll('.admin-only-cat').forEach(el => el.style.display = 'none');
            // Hide specific nav-categories manually if they only contain restricted items
            document.querySelectorAll('.nav-category').forEach(cat => {
                const text = cat.textContent.trim().toLowerCase();
                if (text === 'gastos' || text === 'finanzas' || text === 'análisis') {
                    cat.style.display = 'none';
                }
            });
        } else {
            document.querySelectorAll('.admin-only-cat, .nav-category').forEach(el => el.style.removeProperty('display'));
        }

        this.navigateTo('dashboard');
    },

    /* =================================================
       NAVIGATION
       ================================================= */
    navigateTo(page) {
        if (!Auth.canAccess(page)) {
            console.warn(`Intento de acceso denegado a la página: ${page}`);
            showToast('No tienes permisos para acceder a esta sección.', 'danger');
            if (this.currentPage !== 'dashboard') {
                this.navigateTo('dashboard');
            }
            return;
        }

        this.currentPage = page;

        // Update sidebar active state
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            clientes: 'Contactos',
            productos: 'Productos',
            movimientos: 'Movimientos de Inventario',
            ventas: 'Facturas de Venta',
            pagos_recibidos: 'Pagos Recibidos',
            devoluciones: 'Devoluciones de Venta',
            cotizaciones: 'Cotizaciones',
            compras: 'Órdenes de Compra',
            facturas_compra: 'Facturas de Compra',
            pagos_realizados: 'Pagos Realizados',
            bancos: 'Bancos',
            gastos: 'Gastos Operativos',
            reportes: 'Análisis y Reportes',
            integraciones: 'Integraciones',
            usuarios: 'Usuarios',
            vendedores: 'Vendedores'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        // Render page
        const content = document.getElementById('contentArea');
        try {
            if (Pages[page]) {
                content.innerHTML = Pages[page]();
            } else {
                content.innerHTML = `<div class="p-4 text-center text-muted"><i class="bi bi-exclamation-circle me-1"></i> La página "${page}" no está implementada aún.</div>`;
            }
        } catch (error) {
            console.error('Error rendering page:', page, error);
            content.innerHTML = `<div class="p-4 text-center text-danger">
                <i class="bi bi-bug me-1"></i> Error al cargar la página: ${error.message}
            </div>`;
        }

        // Post-render actions
        if (page === 'dashboard') {
            setTimeout(() => Pages.initDashboardChart(), 100);
        }

        // Close sidebar on mobile
        this.closeSidebar();
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('show');

        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }
        overlay.classList.toggle('show', sidebar.classList.contains('show'));
    },

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('show');
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) overlay.classList.remove('show');
    },

    /* =================================================
       TOASTS
       ================================================= */
    showToast(message, title = 'Éxito', type = 'success') {
        const toast = document.getElementById('appToast');
        const icon = document.getElementById('toastIcon');
        document.getElementById('toastTitle').textContent = title;
        document.getElementById('toastMessage').textContent = message;

        icon.className = `bi me-2`;
        if (type === 'success') icon.classList.add('bi-check-circle-fill', 'text-success');
        else if (type === 'danger') icon.classList.add('bi-exclamation-triangle-fill', 'text-danger');
        else if (type === 'warning') icon.classList.add('bi-exclamation-circle-fill', 'text-warning');
        else icon.classList.add('bi-info-circle-fill', 'text-info');

        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    },

    /* =================================================
       CLIENTES CRUD
       ================================================= */
    newCliente() {
        document.getElementById('clienteModalTitle').textContent = 'Nuevo Contacto';
        document.getElementById('clienteId').value = '';
        document.getElementById('clienteForm').reset();
        document.getElementById('clienteTipo').value = 'Cliente';
        document.getElementById('clienteCupo').value = '0';
        document.getElementById('clientePlazo').value = '30';
        new bootstrap.Modal(document.getElementById('clienteModal')).show();
    },

    editCliente(id) {
        const client = DB.getClient(id);
        if (!client) return;
        document.getElementById('clienteModalTitle').textContent = 'Editar Contacto';
        document.getElementById('clienteId').value = id;
        document.getElementById('clienteTipo').value = client.tipo || 'Cliente';
        document.getElementById('clienteNombre').value = client.nombre;
        document.getElementById('clienteDocumento').value = client.documento;
        document.getElementById('clienteTelefono').value = client.telefono || '';
        document.getElementById('clientePlazo').value = client.plazo_dias;
        new bootstrap.Modal(document.getElementById('clienteModal')).show();
    },

    viewCliente(id) {
        const client = DB.getClient(id);
        if (!client) return;
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const fmtDate = (d) => new Date(d).toLocaleDateString('es-CO');

        // Populate modal headers
        document.getElementById('clienteDetailModalTitle').innerHTML = `<i class="bi bi-person-vcard me-2 text-primary"></i>${client.nombre}`;

        // 1. General Tab
        let generalHtml = `
            <div class="row mb-3">
                <div class="col-sm-4 text-muted small">ID Sistema</div>
                <div class="col-sm-8 fw-bold">${client.id}</div>
            </div>
            <div class="row mb-3">
                <div class="col-sm-4 text-muted small">Tipo Contacto</div>
                <div class="col-sm-8"><span class="badge badge-status badge-${client.tipo === 'Proveedor' ? 'credito' : 'contado'}">${client.tipo || 'Cliente'}</span></div>
            </div>
            <div class="row mb-3">
                <div class="col-sm-4 text-muted small">Documento</div>
                <div class="col-sm-8">${client.documento || 'N/A'}</div>
            </div>
            <div class="row mb-3">
                <div class="col-sm-4 text-muted small">Teléfono</div>
                <div class="col-sm-8">${client.telefono || 'N/A'}</div>
            </div>
            <div class="row mb-3">
                <div class="col-sm-4 text-muted small">Cupo de Crédito</div>
                <div class="col-sm-8">${fmt(client.cupo_credito || 0)}</div>
            </div>
            <div class="row mb-3">
                <div class="col-sm-4 text-muted small">Plazo (Días)</div>
                <div class="col-sm-8">${client.plazo_dias || 0}</div>
            </div>
        `;
        document.getElementById('c-general').innerHTML = generalHtml;

        // 2. Ventas Tab (Facturas)
        const allSales = DB.getAll(DB.KEYS.SALES).filter(s => s.cliente_id === id);
        let facturasHtml = '';
        if (allSales.length === 0) {
            facturasHtml = `<div class="text-center text-muted p-3">No hay facturas asociadas a este contacto.</div>`;
        } else {
            facturasHtml = `
                <div class="table-responsive">
                    <table class="table table-sm table-hover align-middle">
                        <thead class="table-light">
                            <tr>
                                <th>Fecha</th>
                                <th>ID Venta</th>
                                <th>Tipo</th>
                                <th class="text-end">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allSales.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(s => `
                                <tr>
                                    <td>${fmtDate(s.created_at)}</td>
                                    <td><a href="#" onclick="event.preventDefault(); bootstrap.Modal.getInstance(document.getElementById('clienteDetailModal')).hide(); App.viewVenta('${s.id}')">#${s.id.substr(-6)}</a></td>
                                    <td><span class="badge ${s.tipo_venta === 'contado' ? 'bg-success' : 'bg-warning text-dark'}">${s.tipo_venta.toUpperCase()}</span></td>
                                    <td class="text-end fw-bold">${fmt(s.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        document.getElementById('c-facturas').innerHTML = facturasHtml;

        // 3. Pagos/Recibos Tab (Cartera and Movements)
        const carteraItems = DB.getAllActive(DB.KEYS.CARTERA).filter(c => c.cliente_id === id);
        let pagosHtml = '';
        if (carteraItems.length === 0) {
            pagosHtml = `<div class="text-center text-muted p-3">No hay saldos pendientes o movimientos en cartera.</div>`;
        } else {
            pagosHtml = `
                <div class="table-responsive">
                    <table class="table table-sm table-hover align-middle">
                        <thead class="table-light">
                            <tr>
                                <th>Vencimiento</th>
                                <th>Venta Ref</th>
                                <th class="text-end">Total Original</th>
                                <th class="text-end">Saldo Pendiente</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${carteraItems.sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento)).map(c => `
                                <tr>
                                    <td>${fmtDate(c.fecha_vencimiento)}</td>
                                    <td><a href="#" onclick="event.preventDefault(); bootstrap.Modal.getInstance(document.getElementById('clienteDetailModal')).hide(); App.viewVenta('${c.venta_id}')">#${c.venta_id.substr(-6)}</a></td>
                                    <td class="text-end">${fmt(c.total)}</td>
                                    <td class="text-end text-danger fw-bold">${fmt(c.saldo)}</td>
                                    <td><span class="badge ${c.estado === 'pagado' ? 'bg-success' : 'bg-danger'}">${c.estado.toUpperCase()}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        document.getElementById('c-pagos').innerHTML = pagosHtml;

        // Setup Edit Button
        const btnEdit = document.getElementById('btnEditClienteFromDetail');
        btnEdit.onclick = () => {
            bootstrap.Modal.getInstance(document.getElementById('clienteDetailModal')).hide();
            this.editCliente(id);
        };

        // Reset tabs
        document.getElementById('c-general-tab').click();

        new bootstrap.Modal(document.getElementById('clienteDetailModal')).show();
    },

    saveCliente() {
        const nombre = document.getElementById('clienteNombre').value.trim();
        const documento = document.getElementById('clienteDocumento').value.trim();
        if (!nombre || !documento) {
            this.showToast('Nombre y documento son obligatorios', 'Error', 'danger');
            return;
        }
        const client = {
            id: document.getElementById('clienteId').value || undefined,
            tipo: document.getElementById('clienteTipo').value,
            nombre,
            documento,
            telefono: document.getElementById('clienteTelefono').value.trim(),
            cupo_credito: parseFloat(this.unformatNumber(document.getElementById('clienteCupo').value)) || 0,
            plazo_dias: parseInt(this.unformatNumber(document.getElementById('clientePlazo').value)) || 30
        };
        try {
            DB.saveClient(client);
            bootstrap.Modal.getInstance(document.getElementById('clienteModal')).hide();
            this.showToast('Contacto guardado correctamente');
            this.navigateTo('clientes');
        } catch (error) {
            this.showToast(error.message, 'Error', 'danger');
        }
    },

    deleteCliente(id) {
        if (!Auth.isAdmin()) {
            this.showToast('No tienes permisos para eliminar contactos.', 'Acceso Denegado', 'danger');
            return;
        }
        if (confirm('¿Está seguro de eliminar este contacto?')) {
            DB.deleteClient(id);
            this.showToast('Contacto eliminado');
            this.navigateTo('clientes');
        }
    },

    /* =================================================
       PRODUCTOS CRUD
       ================================================= */
    importProductos(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (typeof XLSX === 'undefined') {
                    this.showToast('La librería de Excel no ha cargado completamente. Intente de nuevo en un segundo.', 'Error', 'danger');
                    return;
                }
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet);
                
                let count = 0;
                let existingProducts = DB.getAll(DB.KEYS.PRODUCTS);
                
                rows.forEach(row => {
                    const codigo = row.Codigo || row.codigo || row.CODIGO;
                    const nombre = row.Nombre || row.nombre || row.NOMBRE;
                    const costo = parseFloat(row.Costo || row.costo || row.COSTO || 0);
                    const precio = parseFloat(row.Precio || row.precio || row.PRECIO || 0);
                    const stock = parseInt(row.Stock || row.stock || row.STOCK || 0);
                    const stockMin = parseInt(row.StockMinimo || row.stockminimo || row['Stock Minimo'] || 5);
                    
                    if (!codigo || !nombre) return; // Saltar filas sin código o nombre
                    
                    const existingIdx = existingProducts.findIndex(p => String(p.codigo) === String(codigo));
                    if (existingIdx >= 0) {
                        // Update existing
                        existingProducts[existingIdx].nombre = String(nombre);
                        if (row.Costo !== undefined || row.costo !== undefined || row.COSTO !== undefined) existingProducts[existingIdx].precio_compra = costo;
                        if (row.Precio !== undefined || row.precio !== undefined || row.PRECIO !== undefined) existingProducts[existingIdx].precio_venta = precio;
                        if (row.Stock !== undefined || row.stock !== undefined || row.STOCK !== undefined) existingProducts[existingIdx].stock_actual = stock;
                        if (row.StockMinimo !== undefined || row.stockminimo !== undefined || row['Stock Minimo'] !== undefined) existingProducts[existingIdx].stock_minimo = stockMin;
                        existingProducts[existingIdx].updated_at = new Date().toISOString();
                    } else {
                        // Insert new
                        existingProducts.push({
                            id: DB.genId(),
                            codigo: String(codigo),
                            nombre: String(nombre),
                            precio_compra: costo,
                            precio_venta: precio,
                            stock_actual: stock,
                            stock_minimo: stockMin,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                    }
                    count++;
                });
                
                DB._persist(DB.KEYS.PRODUCTS, existingProducts);
                this.showToast(`Se importaron/actualizaron ${count} productos exitosamente.`, 'Éxito', 'success');
                this.navigateTo('productos');
            } catch (err) {
                console.error(err);
                this.showToast('Error al leer el archivo Excel. Asegúrese de que el formato sea correcto.', 'Error', 'danger');
            }
            
            // Clear input
            event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    },
    newProducto() {
        document.getElementById('productoModalTitle').textContent = 'Nuevo Producto';
        document.getElementById('productoId').value = '';
        document.getElementById('productoForm').reset();
        document.getElementById('productoStockActual').value = '0';
        document.getElementById('productoStockMinimo').value = '5';
        new bootstrap.Modal(document.getElementById('productoModal')).show();
    },

    editProducto(id) {
        const p = DB.getProduct(id);
        if (!p) return;
        document.getElementById('productoModalTitle').textContent = 'Editar Producto';
        document.getElementById('productoId').value = id;
        document.getElementById('productoCodigo').value = p.codigo;
        document.getElementById('productoNombre').value = p.nombre;
        document.getElementById('productoPrecioCompra').value = p.precio_compra;
        document.getElementById('productoPrecioVenta').value = p.precio_venta;
        document.getElementById('productoStockActual').value = p.stock_actual;
        document.getElementById('productoStockMinimo').value = p.stock_minimo;
        new bootstrap.Modal(document.getElementById('productoModal')).show();
    },

    viewProducto(id) {
        const p = DB.getProduct(id);
        if (!p) return;
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const fmtDate = (d) => new Date(d).toLocaleDateString('es-CO');

        // Populate modal headers
        document.getElementById('productoDetailModalTitle').innerHTML = `<i class="bi bi-box-seam me-2 text-primary"></i>${p.nombre}`;

        // 1. General Tab
        let generalHtml = `
            <div class="row mb-3">
                <div class="col-sm-4 text-muted small">Código/Referencia</div>
                <div class="col-sm-8 fw-bold">${p.codigo}</div>
            </div>
            <div class="row mb-3">
                <div class="col-sm-4 text-muted small">Nombre</div>
                <div class="col-sm-8">${p.nombre}</div>
            </div>
            <div class="row mb-3">
                <div class="col-sm-4 text-muted small">Precio Compra</div>
                <div class="col-sm-8">${fmt(p.precio_compra)}</div>
            </div>
            <div class="row mb-3">
                <div class="col-sm-4 text-muted small">Precio Venta (Público)</div>
                <div class="col-sm-8 fw-bold text-success">${fmt(p.precio_venta)}</div>
            </div>
            <div class="row mb-3">
                <div class="col-sm-4 text-muted small">Stock Actual</div>
                <div class="col-sm-8"><span class="badge ${p.stock_actual <= p.stock_minimo ? 'bg-danger' : 'bg-primary'} fs-6">${p.stock_actual}</span></div>
            </div>
            <div class="row mb-3">
                <div class="col-sm-4 text-muted small">Stock Mínimo Alerta</div>
                <div class="col-sm-8">${p.stock_minimo}</div>
            </div>
        `;
        document.getElementById('p-general').innerHTML = generalHtml;

        // 2. Kardex / Movements Tab
        // Gather ALL movements for this product: Sales, Purchases, Adjustments
        let movements = [];

        // Get Sales
        const allSaleDetails = DB.getAllActive(DB.KEYS.SALE_DETAILS).filter(d => d.producto_id === id);
        allSaleDetails.forEach(d => {
            const sale = DB.getSale(d.venta_id);
            if (sale) {
                movements.push({
                    fecha: new Date(sale.created_at),
                    tipo: 'Salida (Venta)',
                    ref: sale.id.substr(-6),
                    cant: -d.cantidad,
                    origen: 'Venta ' + sale.tipo_venta
                });
            }
        });

        // Get Purchases (Compras)
        const allCompraDetails = DB.getAllActive(DB.KEYS.COMPRA_DETAILS).filter(d => d.producto_id === id);
        allCompraDetails.forEach(d => {
            const compra = DB.getById(DB.KEYS.COMPRAS, d.compra_id);
            if (compra) {
                movements.push({
                    fecha: new Date(compra.created_at),
                    tipo: 'Entrada (Compra)',
                    ref: compra.id.substr(-6),
                    cant: d.cantidad,
                    origen: 'Compra ' + compra.factura_numero
                });
            }
        });

        // Get Adjustments (Kardex Adjustments)
        const allKardex = DB.getAllActive(DB.KEYS.KARDEX).filter(k => k.producto_id === id);
        allKardex.forEach(k => {
            movements.push({
                fecha: new Date(k.fecha),
                tipo: 'Ajuste Manual',
                ref: 'N/A',
                cant: k.movimiento_cantidad,
                origen: k.motivo || 'Ajuste de Stock'
            });
        });

        // Sort by date descending
        movements.sort((a, b) => b.fecha - a.fecha);

        let kardexHtml = '';
        if (movements.length === 0) {
            kardexHtml = `<div class="text-center text-muted p-3">No hay movimientos registrados para este producto.</div>`;
        } else {
            kardexHtml = `
                <div class="table-responsive">
                    <table class="table table-sm table-hover align-middle">
                        <thead class="table-light">
                            <tr>
                                <th>Fecha</th>
                                <th>Tipo</th>
                                <th>Referencia</th>
                                <th>Origen</th>
                                <th class="text-end">Cant.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${movements.map(m => `
                                <tr>
                                    <td>${fmtDate(m.fecha.toISOString())}</td>
                                    <td><span class="badge ${m.cant > 0 ? 'bg-success' : (m.tipo.includes('Salida') ? 'bg-warning text-dark' : 'bg-secondary')}">${m.tipo}</span></td>
                                    <td>${m.ref}</td>
                                    <td>${m.origen}</td>
                                    <td class="text-end fw-bold ${m.cant > 0 ? 'text-success' : 'text-danger'}">${m.cant > 0 ? '+' : ''}${m.cant}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        document.getElementById('p-kardex').innerHTML = kardexHtml;

        // 3. FIFO Lots Section
        const fifoLots = DB.getInventoryLots(id);
        let lotsHtml = '<h6 class="mt-4 mb-2"><i class="bi bi-layers me-1"></i>Lotes FIFO Disponibles</h6>';
        if (fifoLots.length === 0) {
            lotsHtml += `<div class="text-center text-muted p-2 small">No hay lotes FIFO registrados.</div>`;
        } else {
            lotsHtml += `
                <div class="table-responsive">
                    <table class="table table-sm table-hover align-middle">
                        <thead class="table-light">
                            <tr>
                                <th>Fecha Compra</th>
                                <th class="text-end">Disponible</th>
                                <th class="text-end">Costo Unit.</th>
                                <th class="text-end">Valor Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${fifoLots.map(l => `
                                <tr>
                                    <td>${fmtDate(l.fecha)}</td>
                                    <td class="text-end">${l.cantidad_disponible} / ${l.cantidad_original}</td>
                                    <td class="text-end">${fmt(l.costo_unitario)}</td>
                                    <td class="text-end fw-bold">${fmt(l.cantidad_disponible * l.costo_unitario)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot class="table-light">
                            <tr>
                                <th>Total</th>
                                <th class="text-end">${fifoLots.reduce((s, l) => s + l.cantidad_disponible, 0)}</th>
                                <th></th>
                                <th class="text-end">${fmt(fifoLots.reduce((s, l) => s + l.cantidad_disponible * l.costo_unitario, 0))}</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        }
        document.getElementById('p-kardex').innerHTML += lotsHtml;

        // Setup Edit Button
        const btnEdit = document.getElementById('btnEditProductoFromDetail');
        btnEdit.onclick = () => {
            bootstrap.Modal.getInstance(document.getElementById('productoDetailModal')).hide();
            this.editProducto(id);
        };

        // Reset tabs
        document.getElementById('p-general-tab').click();

        new bootstrap.Modal(document.getElementById('productoDetailModal')).show();
    },

    saveProducto() {
        if (!Auth.isAdmin()) {
            this.showToast('No tienes permisos para modificar productos.', 'Acceso Denegado', 'danger');
            return;
        }
        const codigo = document.getElementById('productoCodigo').value.trim();
        const nombre = document.getElementById('productoNombre').value.trim();
        const precioCompra = parseFloat(this.unformatNumber(document.getElementById('productoPrecioCompra').value));
        const precioVenta = parseFloat(this.unformatNumber(document.getElementById('productoPrecioVenta').value));
        if (!codigo || !nombre || isNaN(precioCompra) || isNaN(precioVenta)) {
            this.showToast('Complete todos los campos obligatorios', 'Error', 'danger');
            return;
        }
        const product = {
            id: document.getElementById('productoId').value || undefined,
            codigo,
            nombre,
            precio_compra: precioCompra,
            precio_venta: precioVenta,
            stock_actual: parseInt(this.unformatNumber(document.getElementById('productoStockActual').value)) || 0,
            stock_minimo: parseInt(this.unformatNumber(document.getElementById('productoStockMinimo').value)) || 5
        };

        try {
            DB.saveProduct(product);
            bootstrap.Modal.getInstance(document.getElementById('productoModal')).hide();
            this.showToast('Producto guardado correctamente');
            this.navigateTo('productos');
        } catch (error) {
            this.showToast(error.message, 'Error', 'danger');
        }
    },

    deleteProducto(id) {
        if (!Auth.isAdmin()) {
            this.showToast('No tienes permisos para eliminar productos.', 'Acceso Denegado', 'danger');
            return;
        }
        if (confirm('¿Está seguro de eliminar este producto?')) {
            DB.deleteProduct(id);
            this.showToast('Producto eliminado');
            this.navigateTo('productos');
        }
    },

    adjustStock(id) {
        if (!Auth.isAdmin()) {
            this.showToast('No tienes permisos para ajustar el inventario.', 'Acceso Denegado', 'danger');
            return;
        }
        const p = DB.getProduct(id);
        if (!p) return;
        document.getElementById('ajusteProductoId').value = id;
        document.getElementById('ajusteProductoNombre').value = p.nombre;
        document.getElementById('ajusteStockActual').value = p.stock_actual;
        document.getElementById('ajusteNuevoStock').value = p.stock_actual;
        new bootstrap.Modal(document.getElementById('ajusteModal')).show();
    },

    saveAjuste() {
        const id = document.getElementById('ajusteProductoId').value;
        const newStock = parseInt(document.getElementById('ajusteNuevoStock').value);
        if (isNaN(newStock) || newStock < 0) {
            this.showToast('Stock inválido', 'Error', 'danger');
            return;
        }
        DB.adjustStock(id, newStock);
        bootstrap.Modal.getInstance(document.getElementById('ajusteModal')).hide();
        this.showToast('Stock ajustado correctamente');
        this.navigateTo('productos');
    },

    /* =================================================
       VENTAS
       ================================================= */
    newVenta() {
        this.ventaDetalle = [];
        document.getElementById('ventaForm').reset();
        document.getElementById('ventaId').value = '';
        document.getElementById('ventaDetalleBody').innerHTML = '';
        document.getElementById('ventaTotal').textContent = '$0';

        // Populate and clear selectors
        this.selectors.ventaCliente.setData(DB.getClients()
            .filter(c => !c.tipo || c.tipo.toLowerCase() === 'cliente' || c.tipo.toLowerCase() === 'ambos')
            .map(c => ({ id: c.id, text: c.nombre })));
        this.selectors.ventaCliente.clear();

        this.selectors.ventaProducto.setData(DB.getProducts().map(p => ({
            id: p.id,
            text: p.nombre,
            reference: p.codigo,
            stock: p.stock_actual
        })));
        this.selectors.ventaProducto.clear();

        this.selectors.ventaBanco.setData(DB.getBanks().map(b => ({ id: b.id, text: b.nombre })));
        this.selectors.ventaBanco.clear();

        this.selectors.ventaVendedor.setData(DB.getSellers().map(s => ({ id: s.id, text: s.nombre })));
        this.selectors.ventaVendedor.clear();

        document.getElementById('ventaTipo').value = 'contado';
        document.getElementById('ventaBancoContainer').style.display = 'block';
        new bootstrap.Modal(document.getElementById('ventaModal')).show();
    },

    editVenta(id) {
        const v = DB.getSale(id);
        if (!v) return;

        if (v.estado === 'pagada' || v.estado === 'anulada') {
            this.showToast('No se puede editar una factura pagada o anulada', 'Error', 'danger');
            return;
        }

        this.ventaDetalle = DB.getSaleDetails(id).map(d => {
            const p = DB.getProduct(d.producto_id);
            return {
                ...d,
                nombre: p ? p.nombre : 'Prod. Eliminado'
            };
        });

        document.getElementById('ventaId').value = v.id;
        document.getElementById('ventaTipo').value = v.tipo_venta;

        this.selectors.ventaCliente.setData(DB.getClients()
            .filter(cli => !cli.tipo || ['cliente', 'ambos'].includes(cli.tipo.toLowerCase()) || cli.id === v.cliente_id)
            .map(cli => ({ id: cli.id, text: cli.nombre })));
        this.selectors.ventaCliente.setValue(v.cliente_id);

        this.selectors.ventaVendedor.setData(DB.getSellers().map(s => ({ id: s.id, text: s.nombre })));
        if (v.vendedor_id) this.selectors.ventaVendedor.setValue(v.vendedor_id);
        else this.selectors.ventaVendedor.clear();

        this.selectors.ventaProducto.setData(DB.getProducts().map(p => ({
            id: p.id,
            text: p.nombre,
            reference: p.codigo,
            stock: p.stock_actual
        })));
        this.selectors.ventaProducto.clear();

        this.selectors.ventaBanco.setData(DB.getBanks().map(b => ({ id: b.id, text: b.nombre })));
        
        const bancoContainer = document.getElementById('ventaBancoContainer');
        if (v.tipo_venta === 'contado') {
            bancoContainer.style.display = 'block';
            // Determine bank if there is a recibo associated
            const recibo = DB.getAll(DB.KEYS.RECIBOS_CAJA).find(r => r.observaciones && r.observaciones.includes(v.numero || v.id.substr(-6)));
            if (recibo) this.selectors.ventaBanco.setValue(recibo.banco_id);
            else this.selectors.ventaBanco.clear();
        } else {
            bancoContainer.style.display = 'none';
            this.selectors.ventaBanco.clear();
        }

        this._renderVentaDetalle();
        new bootstrap.Modal(document.getElementById('ventaModal')).show();
    },

    addProductToSale() {
        const prodId = this.selectors.ventaProducto.getValue();
        const cantidad = parseInt(document.getElementById('ventaCantidad').value);
        if (!prodId || !cantidad || cantidad < 1) {
            this.showToast('Seleccione un producto y cantidad válida', 'Error', 'danger');
            return;
        }

        const product = DB.getProduct(prodId);
        if (!product) return;

        if (product.stock_actual < cantidad) {
            this.showToast(`Stock insuficiente. Disponible: ${product.stock_actual}`, 'Error', 'danger');
            return;
        }

        // Check if product already in list
        const existing = this.ventaDetalle.find(d => d.producto_id === prodId);
        if (existing) {
            existing.cantidad += cantidad;
            existing.subtotal = existing.cantidad * existing.precio_unitario;
        } else {
            this.ventaDetalle.push({
                producto_id: prodId,
                nombre: product.nombre,
                cantidad: cantidad,
                precio_unitario: parseFloat(product.precio_venta),
                subtotal: cantidad * parseFloat(product.precio_venta)
            });
        }

        this._renderVentaDetalle();
    },

    removeFromSale(index) {
        this.ventaDetalle.splice(index, 1);
        this._renderVentaDetalle();
    },

    _renderVentaDetalle() {
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const body = document.getElementById('ventaDetalleBody');
        let total = 0;

        body.innerHTML = this.ventaDetalle.map((d, i) => {
            total += d.subtotal;
            return `<tr>
                <td>${d.nombre}</td>
                <td><input type="text" class="form-control form-control-sm" style="min-width:120px" placeholder="Modelo, color..." value="${d.descripcion || ''}" oninput="App.ventaDetalle[${i}].descripcion=this.value"></td>
                <td>${d.cantidad}</td>
                <td>${fmt(d.precio_unitario)}</td>
                <td>${fmt(d.subtotal)}</td>
                <td><button class="btn-action btn-delete" onclick="App.removeFromSale(${i})"><i class="bi bi-x-lg"></i></button></td>
            </tr>`;
        }).join('');

        document.getElementById('ventaTotal').textContent = fmt(total);
    },

    saveVenta() {
        const clienteId = this.selectors.ventaCliente.getValue();
        const tipoVenta = document.getElementById('ventaTipo').value;
        const bancoId = this.selectors.ventaBanco.getValue();
        const vendedorId = this.selectors.ventaVendedor.getValue();

        if (!clienteId) {
            this.showToast('Seleccione un cliente', 'Error', 'danger');
            return;
        }
        if (this.ventaDetalle.length === 0) {
            this.showToast('Agregue al menos un producto', 'Error', 'danger');
            return;
        }
        if (tipoVenta === 'contado' && !bancoId) {
            this.showToast('Seleccione banco para venta de contado', 'Error', 'danger');
            return;
        }

        // Validate stock for all items
        for (const d of this.ventaDetalle) {
            const product = DB.getProduct(d.producto_id);
            if (product && product.stock_actual < d.cantidad) {
                this.showToast(`Stock insuficiente para ${d.nombre}`, 'Error', 'danger');
                return;
            }
        }

        const id = document.getElementById('ventaId')?.value || undefined;

        const saleData = {
            id: id,
            cliente_id: clienteId,
            tipo_venta: tipoVenta,
            banco_id: bancoId || null,
            vendedor_id: vendedorId,
            usuario_id: Auth.currentUser ? Auth.currentUser.id : null
        };

        const details = this.ventaDetalle.map(d => ({
            producto_id: d.producto_id,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
            descripcion: d.descripcion || ''
        }));

        DB.registerSale(saleData, details, bancoId);
        bootstrap.Modal.getInstance(document.getElementById('ventaModal')).hide();
        this.showToast('Venta registrada correctamente');
        this.navigateTo('ventas');
    },

    viewVenta(id) {
        const sale = DB.getSale(id);
        if (!sale) return;
        const details = DB.getSaleDetails(id);
        const client = DB.getClient(sale.cliente_id);
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        let abono = 0;
        let saldo = 0;
        if (sale.tipo_venta === 'contado') {
            abono = sale.total;
        } else {
            const allCartera = DB.getAll(DB.KEYS.CARTERA);
            const carteraItem = allCartera.find(c => c.venta_id === sale.id);
            if (carteraItem) {
                saldo = parseFloat(carteraItem.saldo);
                abono = sale.total - saldo;
            } else {
                abono = sale.total;
            }
        }

        const detailRows = details.map(d => {
            const product = DB.getProduct(d.producto_id);
            return `<tr>
                <td><a href="#" onclick="event.preventDefault(); bootstrap.Modal.getInstance(document.getElementById('ventaDetailModal')).hide(); App.viewProducto('${product ? product.id : ''}')" class="text-decoration-none">${product ? product.nombre : 'N/A'}</a></td>
                <td>${d.descripcion || '-'}</td>
                <td>${d.cantidad}</td>
                <td>${fmt(d.precio_unitario)}</td>
                <td>${fmt(d.subtotal)}</td>
            </tr>`;
        }).join('');

        document.getElementById('ventaDetailBody').innerHTML = `
            <div class="row mb-4">
                <div class="col-md-6">
                    <p><strong># Documento:</strong> ${sale.numero || sale.id.substr(-6).toUpperCase()}</p>
                    <p><strong>Cliente:</strong> <a href="#" onclick="event.preventDefault(); bootstrap.Modal.getInstance(document.getElementById('ventaDetailModal')).hide(); App.viewCliente('${client ? client.id : ''}')" class="text-decoration-none fw-bold">${client ? client.nombre : 'N/A'}</a></p>
                    <p><strong>Fecha:</strong> ${sale.fecha}</p>
                    <p><strong>Estado:</strong> <span class="badge bg-${sale.estado === 'pagada' ? 'success' : (sale.estado === 'anulada' ? 'danger' : 'warning text-dark')} text-uppercase">${sale.estado || 'OK'}</span></p>
                    <p><strong>Tipo:</strong> <span class="badge-status badge-${sale.tipo_venta}">${sale.tipo_venta}</span></p>
                </div>
                <div class="col-md-6 text-end">
                    <p><strong>Total:</strong> <span class="fs-4 fw-bold text-primary">${fmt(sale.total)}</span></p>
                    <p><strong>Abono:</strong> <span class="text-success">${fmt(abono)}</span></p>
                    <p><strong>Saldo:</strong> <span class="text-danger fw-bold">${fmt(saldo)}</span></p>
                </div>
            </div>
            <table class="table-modern">
                <thead>
                    <tr><th>Producto</th><th>Descripción / Modelo</th><th>Cant.</th><th>P. Venta</th><th>Subtotal</th></tr>
                </thead>
                <tbody>${detailRows}</tbody>
            </table>`;

        new bootstrap.Modal(document.getElementById('ventaDetailModal')).show();
    },

    _getPrintStyles() {
        return `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Inter', Arial, sans-serif; padding: 30px; color: #1a1a2e; background: #fff; font-size: 13px; }
            .doc-wrapper { max-width: 800px; margin: 0 auto; }
            .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4361ee; padding-bottom: 20px; margin-bottom: 25px; }
            .company-name { font-size: 22px; font-weight: 700; color: #4361ee; }
            .company-sub { color: #666; font-size: 12px; margin-top: 4px; }
            .doc-title { text-align: right; }
            .doc-title h1 { font-size: 26px; font-weight: 700; color: #1a1a2e; letter-spacing: -0.5px; }
            .doc-title .ref { color: #4361ee; font-size: 14px; font-weight: 600; margin-top: 4px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
            .info-block { background: #f8f9fa; border-radius: 8px; padding: 15px; }
            .info-block h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6c757d; margin-bottom: 10px; }
            .info-block p { margin: 4px 0; font-size: 13px; }
            .info-block strong { font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            thead tr { background: #4361ee; color: white; }
            th { padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; }
            td { padding: 9px 12px; border-bottom: 1px solid #e9ecef; }
            tbody tr:hover { background: #f8f9fa; }
            .totals-section { display: flex; justify-content: flex-end; margin-top: 10px; }
            .totals-box { width: 280px; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9ecef; font-size: 13px; }
            .totals-row.grand { border-top: 2px solid #4361ee; border-bottom: none; padding-top: 10px; margin-top: 5px; font-size: 16px; font-weight: 700; color: #4361ee; }
            .estado-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: #e9ecef; color: #495057; }
            .estado-badge.pagada, .estado-badge.recibida { background: #d1fae5; color: #065f46; }
            .estado-badge.pendiente, .estado-badge.enviada { background: #fef3c7; color: #92400e; }
            .estado-badge.anulada, .estado-badge.cancelada { background: #fee2e2; color: #991b1b; }
            .footer-note { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e9ecef; text-align: center; color: #9ca3af; font-size: 11px; }
            @media print { body { padding: 10px; } .doc-wrapper { max-width: 100%; } }
        `;
    },

    printVenta(id) {
        const sale = DB.getSale(id);
        if (!sale) return;
        const client = DB.getClient(sale.cliente_id);
        const details = DB.getSaleDetails(id);
        const seller = sale.vendedor_id ? DB.getSeller(sale.vendedor_id) : null;
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        let saldo = 0;
        if (sale.tipo_venta === 'credito') {
            const carteraItem = DB.getAll(DB.KEYS.CARTERA).find(c => c.venta_id === sale.id);
            if (carteraItem) saldo = parseFloat(carteraItem.saldo);
        }

        const refNum = sale.numero || sale.id.substr(-6).toUpperCase();
        const printWindow = window.open('', '_blank');
        const html = `<!DOCTYPE html><html lang="es">
        <head><meta charset="UTF-8"><title>Factura de Venta #${refNum}</title>
        <style>${this._getPrintStyles()}</style></head>
        <body><div class="doc-wrapper">
            <div class="doc-header">
                <div>
                    <div class="company-name">MAS Accesorios</div>
                    <div class="company-sub">Sistema de Facturación</div>
                </div>
                <div class="doc-title">
                    <h1>FACTURA DE VENTA</h1>
                    <div class="ref"># ${refNum}</div>
                </div>
            </div>
            <div class="info-grid">
                <div class="info-block">
                    <h3>Información del Cliente</h3>
                    <p><strong>Nombre:</strong> ${client ? client.nombre : 'N/A'}</p>
                    <p><strong>Documento:</strong> ${client ? (client.documento || '-') : '-'}</p>
                    <p><strong>Teléfono:</strong> ${client ? (client.telefono || '-') : '-'}</p>
                    <p><strong>Dirección:</strong> ${client ? (client.direccion || '-') : '-'}</p>
                </div>
                <div class="info-block">
                    <h3>Detalles del Documento</h3>
                    <p><strong>Fecha:</strong> ${sale.fecha ? sale.fecha.split('T')[0] : '-'}</p>
                    <p><strong>Tipo:</strong> ${sale.tipo_venta ? sale.tipo_venta.toUpperCase() : '-'}</p>
                    <p><strong>Estado:</strong> <span class="estado-badge ${sale.estado}">${sale.estado || 'OK'}</span></p>
                    ${seller ? `<p><strong>Vendedor:</strong> ${seller.nombre}</p>` : ''}
                </div>
            </div>
            <table>
                <thead><tr><th>Ref.</th><th>Descripción</th><th style="text-align:center">Cant.</th><th style="text-align:right">P. Unitario</th><th style="text-align:right">Subtotal</th></tr></thead>
                <tbody>
                    ${details.map(d => {
                        const p = DB.getProduct(d.producto_id);
                        return `<tr>
                            <td style="font-family:monospace;font-size:12px;color:#555;white-space:nowrap">${p ? p.codigo : '-'}</td>
                            <td>${p ? p.nombre : 'Producto N/A'}${d.descripcion ? `<br><small style="color:#666">${d.descripcion}</small>` : ''}</td>
                            <td style="text-align:center">${d.cantidad}</td>
                            <td style="text-align:right">${fmt(d.precio_unitario)}</td>
                            <td style="text-align:right">${fmt(d.subtotal)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            <div class="totals-section">
                <div class="totals-box">
                    ${sale.tipo_venta === 'credito' ? `
                    <div class="totals-row"><span>Total:</span><span>${fmt(sale.total)}</span></div>
                    <div class="totals-row"><span>Abonado:</span><span>${fmt(sale.total - saldo)}</span></div>
                    <div class="totals-row grand"><span>Saldo:</span><span>${fmt(saldo)}</span></div>
                    ` : `<div class="totals-row grand"><span>TOTAL:</span><span>${fmt(sale.total)}</span></div>`}
                </div>
            </div>
            <div class="footer-note">Documento generado electrónicamente • ${new Date().toLocaleDateString('es-CO')}</div>
        </div>
        <script>window.onload = function() { window.print(); }<\/script>
        </body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
    },

    promptAnularVenta(id) {
        if (confirm('¿Está seguro de anular esta factura? Esta acción revertirá el inventario, restablecerá saldos o registrará salida de banco, y no se puede deshacer.')) {
            this.anularVenta(id);
        }
    },

    anularVenta(id) {
        if (!Auth.isAdmin()) {
            this.showToast('Solo los administradores pueden anular ventas.', 'Acceso Denegado', 'danger');
            return;
        }
        const result = DB.anularSale(id);
        if (result.success) {
            this.showToast(result.message, 'Éxito', 'success');
            this.navigateTo('ventas');
        } else {
            this.showToast(result.message, 'Error', 'danger');
        }
    },

    /* =================================================
       COMPRAS (ENTRADAS MASIVAS DE INVENTARIO)
       ================================================= */
    newCompra() {
        this.compraDetalle = [];
        document.getElementById('compraForm').reset();
        document.getElementById('compraId').value = '';
        document.getElementById('compraEstado').value = 'borrador';
        document.getElementById('compraEstado').disabled = true;
        document.getElementById('compraDetalleBody').innerHTML = '';
        document.getElementById('compraTotal').textContent = '$0';
        document.getElementById('compraFecha').value = new Date().toISOString().split('T')[0];
        document.getElementById('compraRef').value = '';
        document.getElementById('compraTotalRow').value = '';
        document.getElementById('printCompraBtn').style.display = 'none';

        this.selectors.compraProducto.setData(DB.getProducts().map(p => ({
            id: p.id,
            text: p.nombre,
            reference: p.codigo,
            stock: p.stock_actual
        })));
        this.selectors.compraProducto.clear();

        this.selectors.compraProveedor.setData(DB.getClients()
            .filter(c => {
                const tipo = (c.tipo || '').toLowerCase();
                return tipo === 'proveedor' || tipo === 'ambos';
            })
            .map(c => ({ id: c.id, text: c.nombre })));
        this.selectors.compraProveedor.clear();

        this.selectors.compraBanco.setData(DB.getBanks().map(b => ({ id: b.id, text: b.nombre })));
        this.selectors.compraBanco.clear();

        document.getElementById('compraTipo').value = 'contado';
        document.getElementById('compraBancoContainer').parentElement.style.display = 'block';
        document.getElementById('compraModalTitle').textContent = 'Nueva Órden de Compra';
        document.getElementById('saveCompraBtn').style.display = 'inline-block';
        new bootstrap.Modal(document.getElementById('compraModal')).show();
    },

    editCompra(id) {
        const c = DB.getCompra(id);
        if (!c) return;

        this.compraDetalle = DB.getCompraDetails(id).map(d => {
            const p = DB.getProduct(d.producto_id);
            return {
                ...d,
                nombre: p ? p.nombre : 'Prod. Eliminado'
            };
        });

        document.getElementById('compraId').value = c.id;
        document.getElementById('compraFecha').value = c.fecha;
        document.getElementById('compraTipo').value = c.tipo_pago;
        document.getElementById('compraObservacion').value = c.observacion || '';
        document.getElementById('compraEstado').value = c.estado || 'borrador';

        // Populate selectors
        this.selectors.compraProducto.setData(DB.getProducts().map(p => ({
            id: p.id,
            text: p.nombre,
            reference: p.codigo,
            stock: p.stock_actual
        })));
        this.selectors.compraProducto.clear();

        this.selectors.compraProveedor.setData(DB.getClients()
            .filter(c => {
                const tipo = (c.tipo || '').toLowerCase();
                return tipo === 'proveedor' || tipo === 'ambos';
            })
            .map(c => ({ id: c.id, text: c.nombre })));

        const prov = DB.getClients().find(cl => cl.nombre === c.proveedor);
        if (prov) this.selectors.compraProveedor.setValue(prov.id);
        else this.selectors.compraProveedor.clear();

        this.selectors.compraBanco.setData(DB.getBanks().map(b => ({ id: b.id, text: b.nombre })));
        this.selectors.compraBanco.setValue(c.banco_id);

        document.getElementById('compraBancoContainer').parentElement.style.display = c.tipo_pago === 'contado' ? 'block' : 'none';

        // If already processed, disable editing
        const isProcessed = c.procesada === true;
        document.getElementById('compraEstado').disabled = isProcessed;
        document.getElementById('saveCompraBtn').style.display = isProcessed ? 'none' : 'inline-block';

        document.getElementById('printCompraBtn').style.display = 'inline-block';
        document.getElementById('printCompraBtn').onclick = () => this.printCompra(c.id);

        document.getElementById('compraModalTitle').textContent = `Órden de Compra #${c.id.substr(-6).toUpperCase()}`;
        this._renderCompraDetalle();
        new bootstrap.Modal(document.getElementById('compraModal')).show();
    },

    addProductoCompra() {
        const prodId = this.selectors.compraProducto.getValue();
        const cantidadStr = document.getElementById('compraCantidad').value;
        const costoStr = document.getElementById('compraCosto').value;
        const pVentaSugStr = document.getElementById('compraPrecioVentaSelect').value;

        const cantidad = parseInt(this.unformatNumber(cantidadStr));
        const costo = parseFloat(this.unformatNumber(costoStr));
        const precioVentaSugerido = pVentaSugStr ? parseFloat(this.unformatNumber(pVentaSugStr)) : null;

        if (!prodId || !cantidad || cantidad < 1 || isNaN(costo) || costo < 0) {
            this.showToast('Seleccione un producto, cantidad válida y costo unitario', 'Error', 'danger');
            return;
        }

        const product = DB.getProduct(prodId);
        if (!product) return;

        const existing = this.compraDetalle.find(d => d.producto_id === prodId);
        if (existing) {
            existing.cantidad += cantidad;
            existing.costo_unitario = costo;
            existing.precio_venta_sugerido = precioVentaSugerido || existing.precio_venta_sugerido;
            existing.subtotal = existing.cantidad * existing.costo_unitario;
        } else {
            this.compraDetalle.push({
                producto_id: prodId,
                nombre: product.nombre,
                cantidad: cantidad,
                costo_unitario: costo,
                precio_venta_sugerido: precioVentaSugerido,
                subtotal: cantidad * costo
            });
        }

        this._renderCompraDetalle();

        // Reset inputs
        this.selectors.compraProducto.clear();
        document.getElementById('compraRef').value = '';
        document.getElementById('compraCantidad').value = '1';
        document.getElementById('compraCosto').value = '';
        document.getElementById('compraTotalRow').value = '';
        document.getElementById('compraPrecioVentaSelect').value = '';
        this.selectors.compraProducto.focus();
    },

    updateCompraRowTotal() {
        const cant = parseFloat(this.unformatNumber(document.getElementById('compraCantidad').value)) || 0;
        const costo = parseFloat(this.unformatNumber(document.getElementById('compraCosto').value)) || 0;
        const total = cant * costo;
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        document.getElementById('compraTotalRow').value = fmt(total);
    },

    removeFromCompra(index) {
        this.compraDetalle.splice(index, 1);
        this._renderCompraDetalle();
    },

    _renderCompraDetalle() {
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const body = document.getElementById('compraDetalleBody');
        let total = 0;

        const isProcessed = document.getElementById('compraId').value && DB.getCompra(document.getElementById('compraId').value)?.procesada;

        body.innerHTML = this.compraDetalle.map((d, i) => {
            total += d.subtotal;
            return `<tr>
                <td>${d.nombre}</td>
                <td>${d.cantidad}</td>
                <td>${fmt(d.costo_unitario)}</td>
                <td>${d.precio_venta_sugerido ? fmt(d.precio_venta_sugerido) : '-'}</td>
                <td>${fmt(d.subtotal)}</td>
                <td>${!isProcessed ? `<button type="button" class="btn-action btn-delete" onclick="App.removeFromCompra(${i})"><i class="bi bi-x-lg"></i></button>` : ''}</td>
            </tr>`;
        }).join('');

        document.getElementById('compraTotal').textContent = fmt(total);
    },

    saveCompra() {
        const id = document.getElementById('compraId').value;
        const tipoPago = document.getElementById('compraTipo').value;
        const bancoId = this.selectors.compraBanco.getValue();
        const fecha = document.getElementById('compraFecha').value;
        const proveedorId = this.selectors.compraProveedor.getValue();
        const proveedor = proveedorId ? DB.getClient(proveedorId)?.nombre || '' : '';
        const observacion = document.getElementById('compraObservacion').value.trim();
        const estado = document.getElementById('compraEstado').disabled ? 'borrador' : document.getElementById('compraEstado').value;

        if (this.compraDetalle.length === 0) {
            this.showToast('Agregue al menos un producto a la orden', 'Error', 'danger');
            return;
        }
        if (tipoPago === 'contado' && !bancoId) {
            this.showToast('Seleccione banco para orden de contado', 'Error', 'danger');
            return;
        }
        if (!fecha) {
            this.showToast('La fecha es obligatoria', 'Error', 'danger');
            return;
        }

        const compraData = {
            id: id || undefined,
            tipo_pago: tipoPago,
            banco_id: bancoId,
            fecha: fecha,
            proveedor: proveedor,
            observacion: observacion,
            estado: estado,
            usuario_id: Auth.currentUser ? Auth.currentUser.id : null
        };

        const details = this.compraDetalle.map(d => ({
            producto_id: d.producto_id,
            cantidad: d.cantidad,
            costo_unitario: d.costo_unitario,
            precio_venta_sugerido: d.precio_venta_sugerido
        }));

        const saved = DB.registerCompra(compraData, details, bancoId);
        bootstrap.Modal.getInstance(document.getElementById('compraModal')).hide();

        if (estado === 'recibida' && !saved.procesada) {
            this.showToast('Órden Recibida: Inventario y saldo actualizados');
        } else {
            this.showToast('Órden de Compra guardada correctamente');
        }

        this.navigateTo('compras');
    },

    printCompra(id) {
        const c = DB.getCompra(id);
        if (!c) return;
        const details = DB.getCompraDetails(id);
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const refNum = c.numero || c.id.substr(-6).toUpperCase();

        const printWindow = window.open('', '_blank');
        const html = `<!DOCTYPE html><html lang="es">
        <head><meta charset="UTF-8"><title>Orden de Compra #${refNum}</title>
        <style>${this._getPrintStyles()}</style></head>
        <body><div class="doc-wrapper">
            <div class="doc-header">
                <div>
                    <div class="company-name">MAS Accesorios</div>
                    <div class="company-sub">Sistema de Compras</div>
                </div>
                <div class="doc-title">
                    <h1>ORDEN DE COMPRA</h1>
                    <div class="ref"># ${refNum}</div>
                </div>
            </div>
            <div class="info-grid">
                <div class="info-block">
                    <h3>Información del Proveedor</h3>
                    <p><strong>Proveedor:</strong> ${c.proveedor || 'N/A'}</p>
                    <p><strong>Observación:</strong> ${c.observacion || 'Ninguna'}</p>
                </div>
                <div class="info-block">
                    <h3>Detalles del Documento</h3>
                    <p><strong>Fecha:</strong> ${c.fecha || '-'}</p>
                    <p><strong>Tipo de Pago:</strong> ${c.tipo_pago ? c.tipo_pago.toUpperCase() : '-'}</p>
                    <p><strong>Estado:</strong> <span class="estado-badge ${c.estado}">${c.estado || 'borrador'}</span></p>
                </div>
            </div>
            <table>
                <thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Costo Unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
                <tbody>
                    ${details.map(d => {
                        const p = DB.getProduct(d.producto_id);
                        return `<tr>
                            <td>${p ? p.nombre : 'Producto ' + d.producto_id}</td>
                            <td style="text-align:center">${d.cantidad}</td>
                            <td style="text-align:right">${fmt(d.costo_unitario)}</td>
                            <td style="text-align:right">${fmt(parseFloat(d.costo_unitario) * parseInt(d.cantidad))}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            <div class="totals-section">
                <div class="totals-box">
                    <div class="totals-row grand"><span>TOTAL:</span><span>${fmt(c.total)}</span></div>
                </div>
            </div>
            <div class="footer-note">Documento generado electrónicamente • ${new Date().toLocaleDateString('es-CO')}</div>
        </div>
        <script>window.onload = function() { window.print(); }<\/script>
        </body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
    },


    /* =================================================
       COTIZACIONES
       ================================================= */
    newCotizacion() {
        this.cotizacionDetalle = [];
        document.getElementById('cotizacionForm').reset();
        document.getElementById('cotizacionId').value = '';
        document.getElementById('cotizacionDetalleBody').innerHTML = '';
        document.getElementById('cotizacionTotal').textContent = '$0';
        document.getElementById('cotizacionFecha').value = new Date().toISOString().split('T')[0];
        document.getElementById('cotizacionPrecioManual').value = '';

        const validez = new Date();
        validez.setDate(validez.getDate() + 15);
        document.getElementById('cotizacionValidez').value = validez.toISOString().split('T')[0];

        this.selectors.cotizacionCliente.setData(DB.getClients()
            .filter(c => !c.tipo || c.tipo.toLowerCase() === 'cliente' || c.tipo.toLowerCase() === 'ambos')
            .map(c => ({ id: c.id, text: c.nombre })));
        this.selectors.cotizacionCliente.clear();

        this.selectors.cotizacionProducto.setData(DB.getProducts().map(p => ({
            id: p.id,
            text: p.nombre,
            reference: p.codigo,
            stock: p.stock_actual
        })));
        this.selectors.cotizacionProducto.clear();

        this.selectors.cotizacionVendedor.setData(DB.getSellers().map(s => ({ id: s.id, text: s.nombre })));
        this.selectors.cotizacionVendedor.clear();

        document.getElementById('cotizacionModalTitle').textContent = 'Nueva Cotización';
        document.getElementById('printCotizacionBtn').classList.add('d-none');
        document.getElementById('convertFacturaBtn').classList.add('d-none');
        
        // BUG FIX: Ensure Add and Save buttons are visible
        document.getElementById('saveCotizacionBtn').classList.remove('d-none');
        document.getElementById('addProductoCotizacion').classList.remove('d-none');

        new bootstrap.Modal(document.getElementById('cotizacionModal')).show();
    },

    editCotizacion(id) {
        const c = DB.getCotizacion(id);
        if (!c) return;

        this.cotizacionDetalle = DB.getCotizacionDetails(id).map(d => {
            const p = DB.getProduct(d.producto_id);
            return {
                ...d,
                nombre: p ? p.nombre : 'Prod. Eliminado'
            };
        });

        document.getElementById('cotizacionId').value = c.id;
        document.getElementById('cotizacionFecha').value = c.fecha ? c.fecha.split('T')[0] : '';
        document.getElementById('cotizacionValidez').value = c.validez ? c.validez.split('T')[0] : '';
        document.getElementById('cotizacionObservacion').value = c.observacion || '';

        this.selectors.cotizacionCliente.setData(DB.getClients()
            .filter(cli => !cli.tipo || ['cliente', 'ambos'].includes(cli.tipo.toLowerCase()) || cli.id === c.cliente_id)
            .map(cli => ({ id: cli.id, text: cli.nombre })));
        this.selectors.cotizacionCliente.setValue(c.cliente_id);

        this.selectors.cotizacionVendedor.setData(DB.getSellers().map(s => ({ id: s.id, text: s.nombre })));
        if (c.vendedor_id) this.selectors.cotizacionVendedor.setValue(c.vendedor_id);
        else this.selectors.cotizacionVendedor.clear();

        this.selectors.cotizacionProducto.setData(DB.getProducts().map(p => ({
            id: p.id,
            text: p.nombre,
            reference: p.codigo
        })));
        this.selectors.cotizacionProducto.clear();

        const isConverted = !!c.factura_id;
        const convBtn = document.getElementById('convertFacturaBtn');
        const saveBtn = document.getElementById('saveCotizacionBtn');
        const addBtn = document.getElementById('addProductoCotizacion');

        // Reset UI state
        saveBtn.classList.remove('d-none');
        addBtn.classList.remove('d-none');
        convBtn.classList.add('d-none');

        if (isConverted) {
            document.getElementById('cotizacionModalTitle').textContent = `Cotización #${c.numero || c.id.substr(-6).toUpperCase()} [CONVERTIDA]`;
            saveBtn.classList.add('d-none');
            addBtn.classList.add('d-none');
            this.showToast('Esta cotización ya fue convertida y no puede editarse.', 'Info', 'info');
        } else {
            document.getElementById('cotizacionModalTitle').textContent = `Cotización #${c.numero || c.id.substr(-6).toUpperCase()}`;
            // Simplified: Always show conversion button for non-converted quotes
            convBtn.classList.remove('d-none');
            convBtn.onclick = () => this.convertFactura(c.id);
        }

        this._renderCotizacionDetalle(isConverted);
        new bootstrap.Modal(document.getElementById('cotizacionModal')).show();
    },

    addProductoCotizacion() {
        const prodId = this.selectors.cotizacionProducto.getValue();
        const cantidadStr = document.getElementById('cotizacionCantidad').value;
        const precioStr = document.getElementById('cotizacionPrecioManual').value;

        const cantidad = parseInt(this.unformatNumber(cantidadStr));
        const precioManual = parseFloat(this.unformatNumber(precioStr));

        if (!prodId || !cantidad || cantidad < 1) {
            this.showToast('Seleccione un producto y cantidad válida', 'Error', 'danger');
            return;
        }

        const product = DB.getProduct(prodId);
        if (!product) return;

        const existing = this.cotizacionDetalle.find(d => d.producto_id === prodId);
        if (existing) {
            existing.cantidad += cantidad;
            existing.subtotal = existing.cantidad * existing.precio_unitario;
        } else {
            const precioVenta = !isNaN(precioManual) ? precioManual : parseFloat(product.precio_venta);
            this.cotizacionDetalle.push({
                producto_id: prodId,
                nombre: product.nombre,
                cantidad: cantidad,
                precio_unitario: precioVenta,
                subtotal: cantidad * precioVenta
            });
        }

        this._renderCotizacionDetalle();
        this.selectors.cotizacionProducto.clear();
        document.getElementById('cotizacionCantidad').value = '1';
    },

    removeFromCotizacion(index) {
        this.cotizacionDetalle.splice(index, 1);
        this._renderCotizacionDetalle();
    },

    _renderCotizacionDetalle(readOnly = false) {
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const body = document.getElementById('cotizacionDetalleBody');
        let total = 0;

        body.innerHTML = this.cotizacionDetalle.map((d, i) => {
            total += d.subtotal;
            return `<tr>
                <td>${d.nombre}</td>
                <td>${readOnly
                    ? (d.descripcion || '-')
                    : `<input type="text" class="form-control form-control-sm" style="min-width:120px" placeholder="Modelo, color..." value="${d.descripcion || ''}" oninput="App.cotizacionDetalle[${i}].descripcion=this.value">`
                }</td>
                <td>${d.cantidad}</td>
                <td>${fmt(d.precio_unitario)}</td>
                <td>${fmt(d.subtotal)}</td>
                <td>
                    ${!readOnly ? `<button type="button" class="btn-action btn-delete" onclick="App.removeFromCotizacion(${i})"><i class="bi bi-x-lg"></i></button>` : ''}
                </td>
            </tr>`;
        }).join('');

        document.getElementById('cotizacionTotal').textContent = fmt(total);
    },

    saveCotizacion() {
        try {
            const id = document.getElementById('cotizacionId').value;
            const clienteId = this.selectors.cotizacionCliente.getValue();
            const vendedorId = this.selectors.cotizacionVendedor.getValue();
            const fecha = document.getElementById('cotizacionFecha').value;
            const validez = document.getElementById('cotizacionValidez').value;
            const observacion = document.getElementById('cotizacionObservacion').value;

            if (!clienteId || !fecha || !validez) {
                this.showToast('Complete todos los campos obligatorios', 'Error', 'danger');
                return;
            }

            if (this.cotizacionDetalle.length === 0) {
                this.showToast('Agregue al menos un producto', 'Error', 'danger');
                return;
            }

            const cotizacionData = {
                id: id || undefined,
                cliente_id: clienteId,
                vendedor_id: vendedorId,
                fecha: fecha,
                validez: validez,
                estado: 'aceptada',
                observacion: observacion,
                usuario_id: Auth.currentUser ? Auth.currentUser.id : 'admin'
            };

            const details = this.cotizacionDetalle.map(d => ({
                producto_id: d.producto_id,
                cantidad: d.cantidad,
                precio_unitario: d.precio_unitario,
                subtotal: d.subtotal,
                descripcion: d.descripcion || ''
            }));

            DB.registerCotizacion(cotizacionData, details);
            bootstrap.Modal.getInstance(document.getElementById('cotizacionModal')).hide();
            this.showToast('Cotización guardada correctamente');
            this.navigateTo('cotizaciones');
        } catch (error) {
            console.error('Error saving cotizacion:', error);
            this.showToast(error.message, 'Error al guardar', 'danger');
        }
    },

    /* =================================================
       VENDEDORES CRUD
       ================================================= */
    newVendedor() {
        document.getElementById('vendedorModalTitle').textContent = 'Nuevo Vendedor';
        document.getElementById('vendedorId').value = '';
        document.getElementById('vendedorForm').reset();
        document.getElementById('vendedorComision').value = '0';
        new bootstrap.Modal(document.getElementById('vendedorModal')).show();
    },

    editVendedor(id) {
        const s = DB.getSeller(id);
        if (!s) return;
        document.getElementById('vendedorModalTitle').textContent = 'Editar Vendedor';
        document.getElementById('vendedorId').value = id;
        document.getElementById('vendedorNombre').value = s.nombre;
        document.getElementById('vendedorDocumento').value = s.documento || '';
        document.getElementById('vendedorTelefono').value = s.telefono || '';
        document.getElementById('vendedorComision').value = s.comision_porcentaje || 0;
        new bootstrap.Modal(document.getElementById('vendedorModal')).show();
    },

    saveVendedor() {
        const nombre = document.getElementById('vendedorNombre').value.trim();
        const comision = parseFloat(document.getElementById('vendedorComision').value);
        if (!nombre || isNaN(comision)) {
            this.showToast('Complete los campos obligatorios', 'Error', 'danger');
            return;
        }
        const seller = {
            id: document.getElementById('vendedorId').value || undefined,
            nombre,
            documento: document.getElementById('vendedorDocumento').value.trim(),
            telefono: document.getElementById('vendedorTelefono').value.trim(),
            comision_porcentaje: comision
        };
        try {
            DB.saveSeller(seller);
            bootstrap.Modal.getInstance(document.getElementById('vendedorModal')).hide();
            this.showToast('Vendedor guardado correctamente');
            this.navigateTo('vendedores');
        } catch (error) {
            this.showToast(error.message, 'Error', 'danger');
        }
    },

    deleteVendedor(id) {
        if (confirm('¿Está seguro de eliminar este vendedor?')) {
            DB.deleteSeller(id);
            this.showToast('Vendedor eliminado');
            this.navigateTo('vendedores');
        }
    },

    printCotizacion(id) {
        const c = DB.getCotizacion(id);
        if (!c) return;
        const client = DB.getClient(c.cliente_id);
        const details = DB.getCotizacionDetails(id);
        const seller = c.vendedor_id ? DB.getSeller(c.vendedor_id) : null;
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const refNum = c.numero || c.id.substr(-6).toUpperCase();

        const printWindow = window.open('', '_blank');
        const html = `<!DOCTYPE html><html lang="es">
        <head><meta charset="UTF-8"><title>Cotización #${refNum}</title>
        <style>${this._getPrintStyles()}</style></head>
        <body><div class="doc-wrapper">
            <div class="doc-header">
                <div>
                    <div class="company-name">MAS Accesorios</div>
                    <div class="company-sub">Sistema de Cotizaciones</div>
                </div>
                <div class="doc-title">
                    <h1>COTIZACIÓN</h1>
                    <div class="ref"># ${refNum}</div>
                </div>
            </div>
            <div class="info-grid">
                <div class="info-block">
                    <h3>Información del Cliente</h3>
                    <p><strong>Nombre:</strong> ${client ? client.nombre : 'N/A'}</p>
                    <p><strong>Documento:</strong> ${client ? (client.documento || '-') : '-'}</p>
                    <p><strong>Teléfono:</strong> ${client ? (client.telefono || '-') : '-'}</p>
                    <p><strong>Dirección:</strong> ${client ? (client.direccion || '-') : '-'}</p>
                </div>
                <div class="info-block">
                    <h3>Detalles del Documento</h3>
                    <p><strong>Fecha:</strong> ${c.fecha || '-'}</p>
                    <p><strong>Válida hasta:</strong> ${c.validez || '-'}</p>
                    <p><strong>Estado:</strong> <span class="estado-badge ${c.estado}">${c.estado || 'borrador'}</span></p>
                    ${seller ? `<p><strong>Asesor:</strong> ${seller.nombre}</p>` : ''}
                    ${c.observacion ? `<p><strong>Observaciones:</strong> ${c.observacion}</p>` : ''}
                </div>
            </div>
            <table>
                <thead><tr><th>Ref.</th><th>Descripción</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio Unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
                <tbody>
                    ${details.map(d => {
                        const p = DB.getProduct(d.producto_id);
                        return `<tr>
                            <td style="font-family:monospace;font-size:12px;color:#555;white-space:nowrap">${p ? p.codigo : '-'}</td>
                            <td>${p ? p.nombre : 'Producto N/A'}${d.descripcion ? `<br><small style="color:#666">${d.descripcion}</small>` : ''}</td>
                            <td style="text-align:center">${d.cantidad}</td>
                            <td style="text-align:right">${fmt(d.precio_unitario)}</td>
                            <td style="text-align:right">${fmt(parseFloat(d.precio_unitario) * parseInt(d.cantidad))}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            <div class="totals-section">
                <div class="totals-box">
                    <div class="totals-row grand"><span>TOTAL:</span><span>${fmt(c.total)}</span></div>
                </div>
            </div>
            <div class="footer-note">Esta cotización es válida hasta ${c.validez || '-'} • Documento generado electrónicamente</div>
        </div>
        <script>window.onload = function() { window.print(); }<\/script>
        </body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
    },

    convertFactura(id) {
        const c = DB.getCotizacion(id);
        if (!c) return;

        // Validation: Must be Aceptada and not already converted
        if (c.estado !== 'aceptada') {
            this.showToast('Solo se pueden convertir cotizaciones en estado "Aceptada"', 'Error', 'danger');
            return;
        }
        if (c.factura_id) {
            this.showToast('Esta cotización ya fue convertida a la factura #' + c.factura_id.substr(-6).toUpperCase(), 'Info', 'info');
            return;
        }

        // Prompt for sale type and bank if needed
        const tipoVenta = confirm('¿Desea convertir esta cotización en una factura a CRÉDITO?\n\n(Cancelar = Venta de contado)') ? 'credito' : 'contado';
        let bancoId = null;

        if (tipoVenta === 'contado') {
            const banks = DB.getBanks();
            if (banks.length === 0) {
                this.showToast('Debe registrar al menos un banco para ventas de contado', 'Error', 'danger');
                return;
            }
            // Use the first bank as default for the quick conversion, or show a simple choice if you want to be more elaborate
            // For now, simplicity:
            bancoId = banks[0].id;
        }

        try {
            const savedSale = DB.convertCotizacionToVenta(id, tipoVenta, bancoId);

            // Hide cotizacion modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('cotizacionModal'));
            if (modal) modal.hide();

            this.showToast(`Factura #${savedSale.numero || savedSale.id.substr(-6).toUpperCase()} creada correctamente.`);

            // Redirect to sales or show the new sale detail
            this.navigateTo('ventas');
        } catch (error) {
            this.showToast(error.message, 'Error en conversión', 'danger');
        }
    },

    /* =================================================
       CARTERA
       ================================================= */
    loadCartera(filter) {
        document.getElementById('contentArea').innerHTML = Pages.cartera(filter);
    },

    registrarAbono(carteraId) {
        const item = DB.getCarteraItem(carteraId);
        if (!item) return;
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        document.getElementById('abonoCarteraId').value = carteraId;
        document.getElementById('abonoSaldoPendiente').value = fmt(item.saldo);
        document.getElementById('abonoMonto').value = '';
        document.getElementById('abonoMonto').max = item.saldo;

        this.selectors.abonoBanco.setData(DB.getBanks().map(b => ({ id: b.id, text: b.nombre })));
        this.selectors.abonoBanco.clear();

        new bootstrap.Modal(document.getElementById('abonoModal')).show();
    },

    saveAbono() {
        const carteraId = document.getElementById('abonoCarteraId').value;
        const monto = parseFloat(this.unformatNumber(document.getElementById('abonoMonto').value));
        const bancoId = this.selectors.abonoBanco.getValue();

        if (!monto || monto <= 0) {
            this.showToast('Ingrese un monto válido', 'Error', 'danger');
            return;
        }
        if (!bancoId) {
            this.showToast('Seleccione un banco', 'Error', 'danger');
            return;
        }

        const item = DB.getCarteraItem(carteraId);
        if (monto > item.saldo) {
            this.showToast('El monto excede el saldo pendiente', 'Error', 'danger');
            return;
        }

        const success = DB.registerAbono(carteraId, monto, bancoId);
        if (success) {
            bootstrap.Modal.getInstance(document.getElementById('abonoModal')).hide();
            this.showToast('Abono registrado correctamente');
            this.navigateTo('pagos_recibidos');
        } else {
            this.showToast('No se pudo registrar el abono. Verifique los datos.', 'Error', 'danger');
        }
    },

    /* =================================================
       BANCOS
       ================================================= */
    newBanco() {
        document.getElementById('bancoModalTitle').textContent = 'Nuevo Banco';
        document.getElementById('bancoId').value = '';
        document.getElementById('bancoForm').reset();
        new bootstrap.Modal(document.getElementById('bancoModal')).show();
    },

    saveBanco() {
        const nombre = document.getElementById('bancoNombre').value.trim();
        if (!nombre) {
            this.showToast('Ingrese el nombre del banco', 'Error', 'danger');
            return;
        }
        DB.saveBank({
            id: document.getElementById('bancoId').value || undefined,
            nombre,
            saldo_actual: 0
        });
        bootstrap.Modal.getInstance(document.getElementById('bancoModal')).hide();
        this.showToast('Banco guardado correctamente');
        this.navigateTo('bancos');
    },

    deleteBank(id) {
        if (confirm('¿Está seguro de eliminar este banco?')) {
            DB.deleteBank(id);
            this.showToast('Banco eliminado');
            this.navigateTo('bancos');
        }
    },

    recalibrateBanks() {
        if (confirm('¿Desea recalcular los saldos de todos los bancos basándose en el historial de movimientos?')) {
            DB.recalibrateAllBanks();
            this.showToast('Saldos recalculados correctamente');
            if (this.currentPage === 'bancos') {
                this.navigateTo('bancos');
            }
        }
    },

    viewBankMovements(bankId) {
        const area = document.getElementById('bankMovementsArea');
        if (area) {
            area.innerHTML = Pages.bankMovements(bankId);
        }
    },

    /* =================================================
       GASTOS
       ================================================= */
    newGasto() {
        document.getElementById('gastoModalTitle').textContent = 'Nuevo Gasto';
        document.getElementById('gastoId').value = '';
        document.getElementById('gastoForm').reset();
        document.getElementById('gastoFecha').value = new Date().toISOString().split('T')[0];

        this.selectors.gastoBanco.setData(DB.getBanks().map(b => ({ id: b.id, text: b.nombre })));
        this.selectors.gastoBanco.clear();

        new bootstrap.Modal(document.getElementById('gastoModal')).show();
    },

    editGasto(id) {
        const e = DB.getExpense(id);
        if (!e) return;
        document.getElementById('gastoModalTitle').textContent = 'Editar Gasto';
        document.getElementById('gastoId').value = id;
        document.getElementById('gastoCategoria').value = e.categoria;
        document.getElementById('gastoDescripcion').value = e.descripcion;
        document.getElementById('gastoMonto').value = e.monto;
        document.getElementById('gastoFecha').value = e.fecha;

        this.selectors.gastoBanco.setData(DB.getBanks().map(b => ({ id: b.id, text: b.nombre })));
        this.selectors.gastoBanco.setValue(e.banco_id);

        new bootstrap.Modal(document.getElementById('gastoModal')).show();
    },

    saveGasto() {
        const descripcion = document.getElementById('gastoDescripcion').value.trim();
        const monto = parseFloat(this.unformatNumber(document.getElementById('gastoMonto').value));
        const bancoId = this.selectors.gastoBanco.getValue();
        const fecha = document.getElementById('gastoFecha').value;

        if (!descripcion || isNaN(monto) || !bancoId || !fecha) {
            this.showToast('Complete todos los campos obligatorios', 'Error', 'danger');
            return;
        }

        const isNew = !document.getElementById('gastoId').value;
        const expense = {
            id: document.getElementById('gastoId').value || undefined,
            categoria: document.getElementById('gastoCategoria').value,
            descripcion,
            monto,
            banco_id: bancoId,
            fecha
        };

        DB.saveExpense(expense, isNew);
        bootstrap.Modal.getInstance(document.getElementById('gastoModal')).hide();
        this.showToast('Gasto guardado correctamente');
        this.navigateTo('gastos');
    },

    deleteGasto(id) {
        if (confirm('¿Está seguro de eliminar este gasto?')) {
            DB.deleteExpense(id);
            this.showToast('Gasto eliminado');
            this.navigateTo('gastos');
        }
    },

    /* =================================================
       USUARIOS
       ================================================= */
    newUsuario() {
        document.getElementById('usuarioModalTitle').textContent = 'Nuevo Usuario';
        document.getElementById('usuarioId').value = '';
        document.getElementById('usuarioForm').reset();
        document.getElementById('usuarioPassword').required = true;
        new bootstrap.Modal(document.getElementById('usuarioModal')).show();
    },

    editUsuario(id) {
        const u = DB.getUser(id);
        if (!u) return;
        document.getElementById('usuarioModalTitle').textContent = 'Editar Usuario';
        document.getElementById('usuarioId').value = id;
        document.getElementById('usuarioNombre').value = u.nombre;
        document.getElementById('usuarioEmail').value = u.email;
        document.getElementById('usuarioPassword').value = '';
        document.getElementById('usuarioPassword').required = false;
        document.getElementById('usuarioRol').value = u.rol;
        document.getElementById('usuarioEstado').value = u.estado;
        new bootstrap.Modal(document.getElementById('usuarioModal')).show();
    },

    saveUsuario() {
        const nombre = document.getElementById('usuarioNombre').value.trim();
        const email = document.getElementById('usuarioEmail').value.trim();
        const password = document.getElementById('usuarioPassword').value;
        const id = document.getElementById('usuarioId').value;

        if (!nombre || !email) {
            this.showToast('Nombre y email son obligatorios', 'Error', 'danger');
            return;
        }
        if (!id && !password) {
            this.showToast('La contraseña es obligatoria para nuevos usuarios', 'Error', 'danger');
            return;
        }

        const user = {
            id: id || undefined,
            nombre,
            email,
            rol: document.getElementById('usuarioRol').value,
            estado: document.getElementById('usuarioEstado').value
        };
        if (password) user.password = password;

        // If editing, preserve existing password if not changed
        if (id && !password) {
            const existing = DB.getUser(id);
            if (existing) user.password = existing.password;
        }

        DB.saveUser(user);
        bootstrap.Modal.getInstance(document.getElementById('usuarioModal')).hide();
        this.showToast('Usuario guardado correctamente');
        this.navigateTo('usuarios');
    },

    deleteUsuario(id) {
        if (id === Auth.currentUser.id) {
            return this.showToast('No puedes eliminar tu propio usuario mientras estés logueado', 'Advertencia', 'warning');
        }

        if (confirm('¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.')) {
            const success = DB.deleteUser(id);
            if (success) {
                this.showToast('Usuario eliminado correctamente');
                this.navigateTo('usuarios');
            } else {
                this.showToast('Error al eliminar el usuario', 'Error', 'danger');
            }
        }
    },

    /* =================================================
       REPORTES
       ================================================= */
    runReport(type) {
        this.currentReportType = type;
        document.getElementById('reportFilterArea').classList.remove('d-none');

        const titles = {
            ventas: 'Ventas por Rango de Fecha',
            utilidad: 'Utilidad por Rango de Fecha',
            cartera: 'Cartera por Cliente',
            inventario: 'Inventario Actual',
            gastos: 'Gastos por Mes'
        };
        document.getElementById('reportTitle').innerHTML = `<i class="bi bi-file-earmark-bar-graph"></i> ${titles[type]}`;

        const filtersArea = document.getElementById('reportFilters');
        const today = new Date().toISOString().split('T')[0];
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (type === 'inventario') {
            filtersArea.innerHTML = '';
            this.generateReport();
        } else if (type === 'cartera') {
            const clients = DB.getClients();
            filtersArea.innerHTML = `
                <select class="form-select" id="reportClienteFilter">
                    <option value="">Todos los clientes</option>
                    ${clients.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                </select>`;
        } else {
            filtersArea.innerHTML = `
                <div>
                    <label class="form-label" style="font-size:12px;font-weight:600">Desde</label>
                    <input type="date" class="form-control" id="reportDesde" value="${monthAgo}">
                </div>
                <div>
                    <label class="form-label" style="font-size:12px;font-weight:600">Hasta</label>
                    <input type="date" class="form-control" id="reportHasta" value="${today}">
                </div>`;
        }

        document.getElementById('reportResults').innerHTML = '';
    },

    generateReport() {
        const filters = {};
        const desdeEl = document.getElementById('reportDesde');
        const hastaEl = document.getElementById('reportHasta');
        const clienteEl = document.getElementById('reportClienteFilter');

        if (desdeEl) filters.desde = desdeEl.value;
        if (hastaEl) filters.hasta = hastaEl.value;
        if (clienteEl) filters.clienteId = clienteEl.value || null;

        const data = DB.getReportData(this.currentReportType, filters);
        this.currentReportData = data;

        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const results = document.getElementById('reportResults');

        if (data.length === 0) {
            results.innerHTML = '<p class="text-muted text-center py-4">No se encontraron registros</p>';
            return;
        }

        let html = '<table class="table-modern"><thead><tr>';

        switch (this.currentReportType) {
            case 'ventas':
                html += '<th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Total</th><th>Costo</th><th>Utilidad</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td>${r.fecha}</td><td>${r.cliente_nombre}</td><td>${r.tipo_venta}</td>
                        <td>${fmt(r.total)}</td><td>${fmt(r.total_costo)}</td><td class="text-success">${fmt(r.utilidad)}</td></tr>`;
                });
                const totalVentas = data.reduce((s, r) => s + parseFloat(r.total), 0);
                html += `<tr class="fw-bold"><td colspan="3">TOTAL</td><td>${fmt(totalVentas)}</td><td></td><td class="text-success">${fmt(data.reduce((s, r) => s + parseFloat(r.utilidad), 0))}</td></tr>`;
                break;
            case 'utilidad':
                html += '<th>Fecha</th><th>Venta</th><th>Costo</th><th>Utilidad</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td>${r.fecha}</td><td>${fmt(r.total)}</td><td>${fmt(r.costo)}</td><td class="text-success">${fmt(r.utilidad)}</td></tr>`;
                });
                html += `<tr class="fw-bold"><td>TOTAL</td><td>${fmt(data.reduce((s, r) => s + parseFloat(r.total), 0))}</td><td>${fmt(data.reduce((s, r) => s + parseFloat(r.costo), 0))}</td><td class="text-success">${fmt(data.reduce((s, r) => s + parseFloat(r.utilidad), 0))}</td></tr>`;
                break;
            case 'cartera':
                html += '<th>Cliente</th><th>Total</th><th>Saldo</th><th>Vencimiento</th><th>Estado</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td>${r.cliente_nombre}</td><td>${fmt(r.total)}</td><td>${fmt(r.saldo)}</td>
                        <td>${r.fecha_vencimiento}</td><td><span class="badge-status badge-${r.estado}">${r.estado}</span></td></tr>`;
                });
                html += `<tr class="fw-bold"><td>TOTAL</td><td></td><td>${fmt(data.reduce((s, r) => s + parseFloat(r.saldo), 0))}</td><td></td><td></td></tr>`;
                break;
            case 'inventario':
                html += '<th>Código</th><th>Nombre</th><th>Stock</th><th>Mín.</th><th>P. Compra</th><th>P. Venta</th><th>Valor Inv.</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    const isLow = r.stock_actual <= r.stock_minimo;
                    html += `<tr><td>${r.codigo}</td><td>${r.nombre}</td>
                        <td>${isLow ? `<span class="stock-alert">${r.stock_actual}</span>` : r.stock_actual}</td>
                        <td>${r.stock_minimo}</td><td>${fmt(r.precio_compra)}</td><td>${fmt(r.precio_venta)}</td>
                        <td>${fmt(r.valor_inventario)}</td></tr>`;
                });
                html += `<tr class="fw-bold"><td colspan="6">TOTAL INVENTARIO</td><td>${fmt(data.reduce((s, r) => s + r.valor_inventario, 0))}</td></tr>`;
                break;
            case 'gastos':
                html += '<th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Monto</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td>${r.fecha}</td><td>${r.categoria}</td><td>${r.descripcion}</td><td class="text-danger">${fmt(r.monto)}</td></tr>`;
                });
                html += `<tr class="fw-bold"><td colspan="3">TOTAL</td><td class="text-danger">${fmt(data.reduce((s, r) => s + parseFloat(r.monto), 0))}</td></tr>`;
                break;
        }

        html += '</tbody></table>';
        results.innerHTML = html;
    },

    exportReport() {
        if (!this.currentReportData || this.currentReportData.length === 0) {
            this.showToast('Genere un reporte primero', 'Aviso', 'warning');
            return;
        }

        let exportData = this.currentReportData;

        // Formatear los datos para que el Excel sea limpio y legible
        if (this.currentReportType === 'ventas') {
            exportData = this.currentReportData.map(r => ({
                'Fecha': r.fecha,
                'Cliente': r.cliente_nombre,
                'Tipo': r.tipo_venta,
                'Total': r.total,
                'Costo': r.total_costo,
                'Utilidad': r.utilidad
            }));
        } else if (this.currentReportType === 'cartera') {
            exportData = this.currentReportData.map(r => ({
                'Cliente': r.cliente_nombre,
                'Total': r.total,
                'Saldo': r.saldo,
                'Fecha Vencimiento': r.fecha_vencimiento,
                'Estado': r.estado
            }));
        } else if (this.currentReportType === 'inventario') {
            exportData = this.currentReportData.map(r => ({
                'Código': r.codigo,
                'Nombre': r.nombre,
                'Stock Actual': r.stock_actual,
                'Stock Mínimo': r.stock_minimo,
                'Precio Compra': r.precio_compra,
                'Precio Venta': r.precio_venta,
                'Valor Inventario': r.valor_inventario
            }));
        } else if (this.currentReportType === 'utilidad') {
            exportData = this.currentReportData.map(r => ({
                'Fecha': r.fecha,
                'Venta Total': r.total,
                'Costo Total': r.costo,
                'Utilidad': r.utilidad
            }));
        } else if (this.currentReportType === 'gastos') {
            exportData = this.currentReportData.map(r => ({
                'Fecha': r.fecha,
                'Categoría': r.categoria,
                'Descripción': r.descripcion,
                'Monto': r.monto
            }));
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
        XLSX.writeFile(wb, `reporte_${this.currentReportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
        this.showToast('Reporte exportado exitosamente');
    },

    /* =================================================
       INTEGRACIONES
       ================================================= */
    saveIntegration() {
        const email = document.getElementById('alegraEmail').value.trim();
        const apiKey = document.getElementById('alegraApiKey').value.trim();
        const estado = document.getElementById('alegraEstado').value;
        if (!email || !apiKey) {
            this.showToast('Ingrese Correo Electrónico y API Key', 'Error', 'danger');
            return;
        }
        const existing = DB.getAll(DB.KEYS.INTEGRATIONS)?.find(c => c.proveedor === 'alegra');
        DB.save(DB.KEYS.INTEGRATIONS, {
            proveedor: 'alegra',
            email: email,
            api_key: apiKey,
            estado: estado,
            ultima_sincronizacion: existing ? existing.ultima_sincronizacion : null
        });
        this.showToast('Configuración guardada');
    },

    async syncAlegra() {
        const configList = DB.getAll(DB.KEYS.INTEGRATIONS) || [];
        const config = configList.find(c => c.proveedor === 'alegra');
        
        if (!config || !config.api_key || !config.email) {
            this.showToast('Configure el correo y la API Key de Alegra primero.', 'Error', 'danger');
            return;
        }
        
        if (config.estado !== 'activo') {
            this.showToast('La integración con Alegra está inactiva.', 'Información', 'info');
            return;
        }

        const btn = document.getElementById('syncBtn');
        btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Sincronizando...';
        btn.disabled = true;

        try {
            const token = btoa(`${config.email}:${config.api_key}`);
            const headers = {
                'Authorization': `Basic ${token}`,
                'Accept': 'application/json'
            };

            this.showToast('Descargando productos...', 'Info', 'info');
            const itemsRes = await fetch('https://api.alegra.com/api/v1/items', { headers });
            if (!itemsRes.ok) throw new Error('Error al conectar con Alegra (Verifique credenciales)');
            const items = await itemsRes.json();

            let products = DB.getAll(DB.KEYS.PRODUCTS) || [];
            let pCount = 0;
            items.forEach(item => {
                if (item.type === 'product' || item.type === 'item') {
                    const existingIdx = products.findIndex(p => String(p.codigo) === String(item.reference || item.id));
                    const productData = {
                        codigo: String(item.reference || item.id),
                        nombre: item.name,
                        precio_compra: item.inventory ? (item.inventory.unitCost || 0) : (item.price ? item.price[0].price : 0),
                        precio_venta: item.price ? item.price[0].price : 0,
                        stock_actual: item.inventory ? item.inventory.availableQuantity : 0,
                        stock_minimo: 5,
                        updated_at: new Date().toISOString()
                    };

                    if (existingIdx >= 0) {
                        products[existingIdx] = { ...products[existingIdx], ...productData };
                    } else {
                        products.push({ id: DB.genId(), created_at: new Date().toISOString(), ...productData });
                    }
                    pCount++;
                }
            });
            DB._persist(DB.KEYS.PRODUCTS, products);

            this.showToast('Descargando contactos...', 'Info', 'info');
            const contactsRes = await fetch('https://api.alegra.com/api/v1/contacts', { headers });
            if (!contactsRes.ok) throw new Error('Error al conectar con Alegra (Contactos)');
            const contacts = await contactsRes.json();

            let clients = DB.getAll(DB.KEYS.CLIENTS) || [];
            let cCount = 0;
            contacts.forEach(c => {
                const existingIdx = clients.findIndex(cli => String(cli.documento) === String(c.identification));
                const clientData = {
                    nombre: c.name,
                    documento: c.identification,
                    telefono: c.phonePrimary || c.mobile,
                    direccion: c.address ? c.address.address : '',
                    email: c.email,
                    tipo: 'ambos',
                    updated_at: new Date().toISOString()
                };

                if (existingIdx >= 0) {
                    clients[existingIdx] = { ...clients[existingIdx], ...clientData };
                } else {
                    clients.push({ id: DB.genId(), created_at: new Date().toISOString(), ...clientData });
                }
                cCount++;
            });
            DB._persist(DB.KEYS.CLIENTS, clients);

            config.ultima_sincronizacion = new Date().toISOString();
            DB._persist(DB.KEYS.INTEGRATIONS, configList); 
            
            const logsDiv = document.getElementById('integrationLogs');
            if (logsDiv) {
                logsDiv.innerHTML = `<div class="alert alert-success py-2 mb-2"><i class="bi bi-check-circle me-1"></i> Éxito: ${pCount} productos, ${cCount} contactos. (${new Date().toLocaleString()})</div>` + (logsDiv.innerHTML.includes('No hay') ? '' : logsDiv.innerHTML);
            }
            const lastSyncSpan = document.getElementById('lastSync');
            if (lastSyncSpan) lastSyncSpan.textContent = new Date().toLocaleString();

            this.showToast(`Sincronización completada: ${pCount} productos y ${cCount} contactos.`, 'Éxito', 'success');
        } catch (error) {
            console.error(error);
            this.showToast(error.message, 'Error de Sincronización', 'danger');
            const logsDiv = document.getElementById('integrationLogs');
            if (logsDiv) {
                logsDiv.innerHTML = `<div class="alert alert-danger py-2 mb-2"><i class="bi bi-x-circle me-1"></i> Error: ${error.message} (${new Date().toLocaleString()})</div>` + (logsDiv.innerHTML.includes('No hay') ? '' : logsDiv.innerHTML);
            }
        } finally {
            btn.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i> Sincronizar Ahora';
            btn.disabled = false;
        }
    },
    
    factoryReset() {
        if (!confirm('¿Estás SEGURO de querer borrar toda la información? Esta acción no se puede deshacer y borrará productos, clientes, ventas y configuraciones (excepto usuarios).')) return;
        
        const keysToClear = [
            DB.KEYS.CLIENTS, DB.KEYS.PRODUCTS, DB.KEYS.SALES, DB.KEYS.SALE_DETAILS, 
            DB.KEYS.CARTERA, DB.KEYS.COMPRAS, DB.KEYS.COMPRA_DETAILS, DB.KEYS.COTIZACIONES, 
            DB.KEYS.COTIZACION_DETAILS, DB.KEYS.RECIBOS_CAJA, DB.KEYS.BANK_MOVEMENTS, 
            DB.KEYS.EXPENSES, DB.KEYS.PAGOS_PROVEEDORES, DB.KEYS.DEVOLUCIONES, 
            DB.KEYS.DEVOLUCION_DETAILS, DB.KEYS.KARDEX, DB.KEYS.INVENTORY_LOTS
        ];
        
        keysToClear.forEach(key => DB._persist(key, []));
        
        DB._persist(DB.KEYS.COUNTERS, {
            cliente: 1, proveedor: 1, product: 1, cotizacion: 1, recibo: 1,
            expense: 1, sale: 1, buy: 1, devolucion: 1, pago_proveedor: 1
        });
        
        this.showToast('La base de datos ha sido reseteada a fábrica exitosamente.', 'Sistema Limpio', 'success');
        setTimeout(() => window.location.reload(), 1500);
    },

    /* =================================================
       RECIBO DE CAJA
       ================================================= */
    reciboCajaFacturas: [],

    newReciboCaja() {
        document.getElementById('reciboCajaModalTitle').textContent = 'Nuevo Recibo de Caja';
        document.getElementById('reciboCajaFecha').value = new Date().toISOString().split('T')[0];
        document.getElementById('reciboCajaMonto').value = '';
        document.getElementById('reciboCajaObservacion').value = '';
        document.getElementById('reciboCajaNoCliente').classList.remove('d-none');
        document.getElementById('reciboCajaFacturasWrapper').classList.add('d-none');
        document.getElementById('reciboCajaFacturasBody').innerHTML = '';
        this.reciboCajaFacturas = [];

        // Populate selectors
        this.selectors.reciboCajaCliente.setData(DB.getClients()
            .filter(c => !c.tipo || ['cliente', 'ambos'].includes((c.tipo || '').toLowerCase()))
            .map(c => ({ id: c.id, text: c.nombre })));
        this.selectors.reciboCajaCliente.clear();

        this.selectors.reciboCajaBanco.setData(DB.getBanks().map(b => ({ id: b.id, text: b.nombre })));
        this.selectors.reciboCajaBanco.clear();

        new bootstrap.Modal(document.getElementById('reciboCajaModal')).show();
    },

    loadFacturasPendientes(clienteId) {
        const facturas = DB.getFacturasPendientesByCliente(clienteId);
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const today = new Date();

        if (facturas.length === 0) {
            document.getElementById('reciboCajaNoCliente').innerHTML = `
                <i class="bi bi-check-circle text-success" style="font-size:2rem"></i>
                <p class="mt-2 mb-0">Este cliente no tiene facturas pendientes</p>`;
            document.getElementById('reciboCajaNoCliente').classList.remove('d-none');
            document.getElementById('reciboCajaFacturasWrapper').classList.add('d-none');
            this.reciboCajaFacturas = [];
            return;
        }

        this.reciboCajaFacturas = facturas;
        document.getElementById('reciboCajaNoCliente').classList.add('d-none');
        document.getElementById('reciboCajaFacturasWrapper').classList.remove('d-none');

        let totalSaldo = 0;
        const body = document.getElementById('reciboCajaFacturasBody');
        body.innerHTML = facturas.map((f, i) => {
            const saldo = parseFloat(f.saldo);
            totalSaldo += saldo;
            const venc = new Date(f.fecha_vencimiento);
            const dias = Math.floor((today - venc) / (1000 * 60 * 60 * 24));
            const diasLabel = dias > 0 ? `<span class="text-danger">${dias}d</span>` : `<span class="text-success">${Math.abs(dias)}d</span>`;
            const sale = f.venta_id ? DB.getSale(f.venta_id) : null;
            const ref = sale ? '#' + (sale.numero || sale.id.substr(-6).toUpperCase()) : f.venta_id || '-';

            return `<tr>
                <td><strong>${ref}</strong></td>
                <td>${f.fecha_vencimiento}</td>
                <td>${fmt(f.total)}</td>
                <td>${fmt(saldo)}</td>
                <td>${diasLabel}</td>
                <td><input type="number" class="form-control form-control-sm" id="rcMonto_${i}"
                    data-index="${i}" min="0" max="${saldo}" step="0.01" value="0"
                    oninput="App.updateReciboCajaTotals()"></td>
            </tr>`;
        }).join('');

        document.getElementById('reciboCajaTotalSaldo').textContent = fmt(totalSaldo);
        this.updateReciboCajaTotals();
    },

    applyByAge() {
        const montoInput = document.getElementById('reciboCajaMonto');
        let remaining = parseFloat(montoInput.value) || 0;

        if (remaining <= 0) {
            this.showToast('Ingrese el monto total recibido antes de aplicar', 'Error', 'danger');
            return;
        }

        if (this.reciboCajaFacturas.length === 0) {
            this.showToast('No hay facturas pendientes para aplicar', 'Error', 'danger');
            return;
        }

        // Apply from oldest to newest (already sorted by date)
        this.reciboCajaFacturas.forEach((f, i) => {
            const input = document.getElementById(`rcMonto_${i}`);
            const saldo = parseFloat(f.saldo);
            if (remaining >= saldo) {
                input.value = saldo;
                remaining -= saldo;
            } else if (remaining > 0) {
                input.value = remaining.toFixed(2);
                remaining = 0;
            } else {
                input.value = 0;
            }
        });

        this.updateReciboCajaTotals();
    },

    updateReciboCajaTotals() {
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        let totalAplicado = 0;

        this.reciboCajaFacturas.forEach((f, i) => {
            const input = document.getElementById(`rcMonto_${i}`);
            if (input) totalAplicado += parseFloat(input.value) || 0;
        });

        document.getElementById('reciboCajaTotalAplicado').textContent = fmt(totalAplicado);

        const montoTotal = parseFloat(this.unformatNumber(document.getElementById('reciboCajaMonto').value)) || 0;
        const diff = montoTotal - totalAplicado;
        const diffRow = document.getElementById('reciboCajaDiffRow');
        const diffCell = document.getElementById('reciboCajaDiff');

        if (Math.abs(diff) > 1 && montoTotal > 0) {
            diffRow.classList.remove('d-none');
            diffCell.textContent = fmt(diff);
            diffCell.className = diff > 0 ? 'text-warning fw-bold' : 'text-danger fw-bold';
        } else {
            diffRow.classList.add('d-none');
        }
    },

    saveReciboCaja() {
        try {
            const clienteId = this.selectors.reciboCajaCliente.getValue();
            const bancoId = this.selectors.reciboCajaBanco.getValue();
            const fecha = document.getElementById('reciboCajaFecha').value;
            const monto = document.getElementById('reciboCajaMonto').value;
            const observacion = document.getElementById('reciboCajaObservacion').value;

            if (!clienteId || !bancoId || !fecha || !monto) {
                this.showToast('Complete todos los campos obligatorios', 'Error', 'danger');
                return;
            }

            // Build details from input fields
            const detalles = [];
            this.reciboCajaFacturas.forEach((f, i) => {
                const input = document.getElementById(`rcMonto_${i}`);
                const val = parseFloat(input.value) || 0;
                if (val > 0) {
                    detalles.push({
                        cartera_id: f.id,
                        factura_id: f.venta_id,
                        monto_aplicado: val
                    });
                }
            });

            const reciboData = {
                cliente_id: clienteId,
                banco_id: bancoId,
                fecha: fecha,
                monto_total: parseFloat(this.unformatNumber(monto)),
                observacion: observacion,
                usuario_id: Auth.currentUser ? Auth.currentUser.id : 'admin'
            };

            DB.registerReciboCaja(reciboData, detalles);
            bootstrap.Modal.getInstance(document.getElementById('reciboCajaModal')).hide();
            this.showToast('Recibo de Caja guardado correctamente');
            this.navigateTo('pagos_recibidos');
        } catch (error) {
            console.error('Error saving recibo:', error);
            this.showToast(error.message, 'Error al guardar', 'danger');
        }
    },

    anularReciboCaja(id) {
        if (!confirm('¿Está seguro de anular este recibo? Se restaurarán los saldos de las facturas afectadas.')) return;
        try {
            const result = DB.anularReciboCaja(id);
            this.showToast(result.message);
            this.navigateTo('pagos_recibidos');
        } catch (error) {
            this.showToast(error.message, 'Error', 'danger');
        }
    },

    viewReciboCaja(id) {
        const recibo = DB.getReciboCaja(id);
        if (!recibo) return;
        const detalles = DB.getReciboCajaDetails(id);
        const client = DB.getClient(recibo.cliente_id);
        const bank = DB.getBank(recibo.banco_id);
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        let detailRows = detalles.map(d => {
            const sale = d.factura_id ? DB.getSale(d.factura_id) : null;
            const ref = sale ? '#' + (sale.numero || sale.id.substr(-6).toUpperCase()) : '-';
            return `<tr>
                <td>${ref}</td>
                <td>${fmt(d.monto_aplicado)}</td>
            </tr>`;
        }).join('');

        const ref = recibo.numero || recibo.id.substr(-6).toUpperCase();
        const estado = recibo.estado === 'activo'
            ? '<span class="badge bg-success">ACTIVO</span>'
            : '<span class="badge bg-danger">ANULADO</span>';

        const content = `
            <div class="mb-3">
                <h6>Recibo de Caja #${ref} ${estado}</h6>
                <p class="mb-1"><strong>Cliente:</strong> ${client ? client.nombre : 'N/A'}</p>
                <p class="mb-1"><strong>Fecha:</strong> ${recibo.fecha}</p>
                <p class="mb-1"><strong>Banco:</strong> ${bank ? bank.nombre : 'N/A'}</p>
                <p class="mb-1"><strong>Monto Total:</strong> ${fmt(recibo.monto_total)}</p>
                ${recibo.observacion ? `<p class="mb-1"><strong>Observación:</strong> ${recibo.observacion}</p>` : ''}
            </div>
            <h6 class="mb-2">Detalle de Aplicación</h6>
            <table class="table table-sm">
                <thead><tr><th>Factura</th><th>Monto Aplicado</th></tr></thead>
                <tbody>${detailRows}</tbody>
                <tfoot><tr class="fw-bold"><td>TOTAL</td><td>${fmt(recibo.monto_total)}</td></tr></tfoot>
            </table>`;

        // Show in a simple alert-like modal (reuse generic approach)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `
            <div class="modal fade" id="viewReciboModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Detalle de Recibo</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">${content}</div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>`;

        // Remove old instance if exists
        const old = document.getElementById('viewReciboModal');
        if (old) old.remove();

        document.body.appendChild(tempDiv.firstElementChild);
        new bootstrap.Modal(document.getElementById('viewReciboModal')).show();
    },

    /* =================================================
       PAGOS A PROVEEDORES
       ================================================= */
    registrarPagoProveedor(carteraId) {
        const item = DB.getAll(DB.KEYS.CARTERA_PROVEEDORES).find(i => i.id === carteraId);
        if (!item) return;

        document.getElementById('pagoProveedorForm').reset();
        document.getElementById('pagoProveedorCarteraId').value = item.id;
        document.getElementById('pagoProveedorNombre').value = item.proveedor_nombre;

        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        document.getElementById('pagoProveedorTotal').value = fmt(item.total);
        document.getElementById('pagoProveedorSaldo').value = fmt(item.saldo);

        document.getElementById('pagoProveedorFecha').value = new Date().toISOString().split('T')[0];
        document.getElementById('pagoProveedorMonto').value = item.saldo;

        this.selectors.pagoProveedorBanco.setData(DB.getBanks().map(b => ({ id: b.id, text: b.nombre })));
        this.selectors.pagoProveedorBanco.clear();

        new bootstrap.Modal(document.getElementById('pagoProveedorModal')).show();
    },

    savePagoProveedor() {
        const carteraId = document.getElementById('pagoProveedorCarteraId').value;
        const bancoId = this.selectors.pagoProveedorBanco.getValue();
        const monto = parseFloat(this.unformatNumber(document.getElementById('pagoProveedorMonto').value));
        const fecha = document.getElementById('pagoProveedorFecha').value;

        if (!bancoId) return this.showToast('Seleccione un banco', 'Error', 'danger');
        if (!monto || monto <= 0) return this.showToast('Ingrese un monto válido', 'Error', 'danger');
        if (!fecha) return this.showToast('Seleccione la fecha del pago', 'Error', 'danger');

        const success = DB.registerPagoProveedor({
            cartera_id: carteraId,
            banco_id: bancoId,
            monto: monto,
            fecha: fecha
        });

        if (success) {
            this.showToast('Pago registrado correctamente');
            bootstrap.Modal.getInstance(document.getElementById('pagoProveedorModal')).hide();
            this.navigateTo('pagos_realizados');
        } else {
            this.showToast('Error al registrar el pago', 'Error', 'danger');
        }
    },

    /* =================================================
       DEVOLUCIONES
       ================================================= */
    newDevolucion() {
        document.getElementById('devolucionForm').reset();
        document.getElementById('devolucionFecha').value = new Date().toISOString().split('T')[0];
        document.getElementById('devolucionNoVenta').classList.remove('d-none');
        document.getElementById('devolucionItemsWrapper').classList.add('d-none');
        document.getElementById('devolucionInfoOriginal').classList.add('d-none');
        document.getElementById('devolucionBancoContainer').classList.add('d-none');
        document.getElementById('devolucionTotal').textContent = '$0';

        this.selectors.devolucionVenta.setData(DB.getSales()
            .filter(s => s.estado !== 'anulada')
            .map(s => {
                const client = DB.getClient(s.cliente_id);
                return { id: s.id, text: `Factura #${s.numero || s.id.substr(-6).toUpperCase()} - ${client ? client.nombre : 'N/A'}` };
            }));
        this.selectors.devolucionVenta.clear();

        this.selectors.devolucionBanco.setData(DB.getBanks().map(b => ({ id: b.id, text: b.nombre })));
        this.selectors.devolucionBanco.clear();

        new bootstrap.Modal(document.getElementById('devolucionModal')).show();
    },

    loadVentaItemsForReturn(ventaId) {
        if (!ventaId) return;
        const sale = DB.getSale(ventaId);
        const details = DB.getSaleDetails(ventaId);
        const client = DB.getClient(sale.cliente_id);
        const format = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        // Show sale info
        document.getElementById('devolucionInfoOriginal').classList.remove('d-none');
        document.getElementById('devOriCliente').textContent = client ? client.nombre : 'N/A';
        document.getElementById('devOriTipo').textContent = sale.tipo_venta.toUpperCase();
        document.getElementById('devOriTotal').textContent = format(sale.total);

        let saldo = 0;
        if (sale.tipo_venta === 'credito') {
            const cartera = DB.getAll(DB.KEYS.CARTERA).find(c => c.venta_id === sale.id);
            saldo = cartera ? parseFloat(cartera.saldo) : 0;
        }
        document.getElementById('devOriSaldo').textContent = format(saldo);

        // Show/Hide Bank selector for cash sales
        if (sale.tipo_venta === 'contado') {
            document.getElementById('devolucionBancoContainer').classList.remove('d-none');
        } else {
            document.getElementById('devolucionBancoContainer').classList.add('d-none');
        }

        // Render items
        document.getElementById('devolucionNoVenta').classList.add('d-none');
        const wrapper = document.getElementById('devolucionItemsWrapper');
        wrapper.classList.remove('d-none');

        const body = document.getElementById('devolucionItemsBody');
        body.innerHTML = details.map(d => {
            const product = DB.getProduct(d.producto_id);
            return `
                <tr>
                    <td>${product ? product.nombre : 'N/A'}</td>
                    <td>${d.cantidad}</td>
                    <td>
                        <input type="number" class="form-control form-control-sm dev-item-qty" 
                               data-id="${d.producto_id}" data-price="${d.precio_unitario}" 
                               value="0" min="0" max="${d.cantidad}" oninput="App.updateDevolucionTotals()">
                    </td>
                    <td>${format(d.precio_unitario)}</td>
                    <td class="dev-item-subtotal">$0</td>
                </tr>`;
        }).join('');
        this.updateDevolucionTotals();
    },

    updateDevolucionTotals() {
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        let total = 0;

        document.querySelectorAll('#devolucionItemsBody tr').forEach(row => {
            const qtyInput = row.querySelector('.dev-item-qty');
            const qty = parseInt(qtyInput.value) || 0;
            const price = parseFloat(qtyInput.dataset.price);
            const subtotal = qty * price;
            total += subtotal;
            row.querySelector('.dev-item-subtotal').textContent = fmt(subtotal);
        });

        document.getElementById('devolucionTotal').textContent = fmt(total);
    },

    saveDevolucion() {
        const ventaId = this.selectors.devolucionVenta.getValue();
        const fecha = document.getElementById('devolucionFecha').value;
        const bancoId = this.selectors.devolucionBanco.getValue();

        if (!ventaId) { this.showToast('Seleccione una factura', 'Error', 'danger'); return; }
        if (!fecha) { this.showToast('Seleccione una fecha', 'Error', 'danger'); return; }

        const sale = DB.getSale(ventaId);
        if (sale.tipo_venta === 'contado' && !bancoId) {
            this.showToast('Seleccione banco para la devolución de dinero', 'Error', 'danger');
            return;
        }

        const details = [];
        document.querySelectorAll('#devolucionItemsBody tr').forEach(row => {
            const qtyInput = row.querySelector('.dev-item-qty');
            const qty = parseInt(qtyInput.value) || 0;
            if (qty > 0) {
                details.push({
                    producto_id: qtyInput.dataset.id,
                    cantidad: qty
                });
            }
        });

        if (details.length === 0) {
            this.showToast('Debe devolver al menos un producto con cantidad mayor a 0', 'Error', 'danger');
            return;
        }

        try {
            DB.registerDevolucion({
                venta_id: ventaId,
                fecha: fecha,
                banco_id: bancoId,
                usuario_id: Auth.currentUser ? Auth.currentUser.id : null
            }, details);

            bootstrap.Modal.getInstance(document.getElementById('devolucionModal')).hide();
            this.showToast('Devolución registrada correctamente');
            this.navigateTo('devoluciones');
        } catch (error) {
            this.showToast(error.message, 'Error', 'danger');
        }
    },

    viewDevolucion(id) {
        const devolucion = DB.getDevolucion(id);
        const details = DB.getDevolucionDetails(id);
        const sale = DB.getSale(devolucion.venta_id);
        const client = sale ? DB.getClient(sale.cliente_id) : null;
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        const detailRows = details.map(d => {
            const product = DB.getProduct(d.producto_id);
            const price = (d.subtotal / d.cantidad) || 0;
            return `<tr>
                <td><a href="#" onclick="event.preventDefault(); bootstrap.Modal.getInstance(document.getElementById('devolucionDetailModal')).hide(); App.viewProducto('${product ? product.id : ''}')" class="text-decoration-none">${product ? product.nombre : 'N/A'}</a></td>
                <td>${d.cantidad}</td>
                <td>${fmt(price)}</td>
                <td>${fmt(d.subtotal)}</td>
            </tr>`;
        }).join('');

        document.getElementById('devolucionDetailBody').innerHTML = `
            <div class="row mb-4">
                <div class="col-md-6">
                    <p><strong>Cliente:</strong> <a href="#" onclick="event.preventDefault(); bootstrap.Modal.getInstance(document.getElementById('devolucionDetailModal')).hide(); App.viewCliente('${client ? client.id : ''}')" class="text-decoration-none fw-bold">${client ? client.nombre : 'N/A'}</a></p>
                    <p><strong>Fecha Dev:</strong> ${devolucion.fecha}</p>
                    <p><strong>Factura Origen:</strong> <a href="#" onclick="event.preventDefault(); bootstrap.Modal.getInstance(document.getElementById('devolucionDetailModal')).hide(); App.viewVenta('${sale ? sale.id : ''}')" class="text-decoration-none fw-bold">#${sale ? (sale.numero || sale.id.substr(-6).toUpperCase()) : 'N/A'}</a></p>
                </div>
                <div class="col-md-6 text-end">
                    <p><strong>Total Devuelto:</strong> <span class="fs-4 fw-bold">${fmt(devolucion.total)}</span></p>
                    <p><strong>Tipo Venta Original:</strong> ${sale ? sale.tipo_venta.toUpperCase() : 'N/A'}</p>
                </div>
            </div>
            <table class="table-modern">
                <thead>
                    <tr><th>Producto</th><th>Cant. Devuelta</th><th>Precio Unit.</th><th>Subtotal</th></tr>
                </thead>
                <tbody>${detailRows}</tbody>
            </table>`;

        new bootstrap.Modal(document.getElementById('devolucionDetailModal')).show();
    },

    /* =================================================
       NUMERIC FORMATTING
       ================================================= */
    setupNumericFormatting() {
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('number-format')) {
                const cursorPosition = e.target.selectionStart;
                const originalLength = e.target.value.length;

                const unformatted = this.unformatNumber(e.target.value);
                const formatted = this.formatNumber(unformatted);

                e.target.value = formatted;

                // Adjust cursor position
                const newLength = formatted.length;
                const lengthDiff = newLength - originalLength;
                e.target.setSelectionRange(cursorPosition + lengthDiff, cursorPosition + lengthDiff);
            }
        });
    },

    formatNumber(n) {
        if (!n && n !== 0) return '';
        const parts = n.toString().split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return parts.join(',');
    },

    unformatNumber(str) {
        if (!str) return '0';
        return str.toString().replace(/\./g, '').replace(/,/g, '.');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
