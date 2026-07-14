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
        if (DB.initPromise) {
            await DB.initPromise;
        }
        this.setupGlobals();
        
        // Sync with cloud in background - does NOT block app startup
        DB.syncFromCloud().catch(e => console.warn('Cloud sync skipped:', e.message));
        
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
        
        const addVentaRowBtn = document.getElementById('addVentaRowBtn');
        if (addVentaRowBtn) addVentaRowBtn.addEventListener('click', () => this.addVentaRow());
        
        const addCotizacionRowBtn = document.getElementById('addCotizacionRowBtn');
        if (addCotizacionRowBtn) addCotizacionRowBtn.addEventListener('click', () => this.addCotizacionRow());

        document.getElementById('addProductoCompra').addEventListener('click', () => this.addProductoCompra());
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
            const container = document.getElementById('ventaBancoContainer');
            if (container) {
                container.closest('.col-md-3').style.display =
                    e.target.value === 'contado' ? 'block' : 'none';
            }
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
    navigateTo(page, param = null) {
        // Skip auth check for cliente_detail as it inherits from clientes
        const authPage = page === 'cliente_detail' ? 'clientes' : page;
        if (!Auth.canAccess(authPage)) {
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
            const isActive = item.dataset.page === page || (page === 'cliente_detail' && item.dataset.page === 'clientes');
            item.classList.toggle('active', isActive);
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
            vendedores: 'Vendedores',
            cliente_detail: 'Detalle de Contacto'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        // Render page
        const content = document.getElementById('contentArea');
        try {
            if (Pages[page]) {
                content.innerHTML = Pages[page](param);
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
        if (page === 'movimientos') {
            setTimeout(() => this.filterKardex(), 100);
        }
        if (page === 'bancos') {
            setTimeout(() => this.loadAllBankMovements('all', 'all', 1), 50);
        }
        if (page === 'cliente_detail') {
            // Lazy load the first tab dynamically
            setTimeout(() => this.loadClientPageTab(param, 'transacciones', 1), 50);
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
        
        document.getElementById('clienteTipoDoc').value = 'NIT';
        document.getElementById('clienteRegimen').value = 'Simplificado';
        document.getElementById('clienteIdAlegra').value = '';
        
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
        document.getElementById('clienteCupo').value = this.formatNumber(client.cupo_credito || 0);
        document.getElementById('clientePlazo').value = this.formatNumber(client.plazo_dias || 30);
        
        document.getElementById('clienteEmail').value = client.email || '';
        document.getElementById('clienteContacto').value = client.persona_contacto || '';
        document.getElementById('clienteDireccion').value = client.direccion || '';
        document.getElementById('clienteBarrio').value = client.barrio || '';
        document.getElementById('clienteCiudad').value = client.ciudad || '';
        document.getElementById('clienteDepartamento').value = client.departamento || '';
        document.getElementById('clientePais').value = client.pais || 'Colombia';
        document.getElementById('clienteCodigoPostal').value = client.codigo_postal || '';
        
        document.getElementById('clienteTipoDoc').value = client.tipo_doc || 'NIT';
        document.getElementById('clienteRegimen').value = client.regimen || 'Simplificado';
        document.getElementById('clienteIdAlegra').value = client.id_alegra || '';
        
        document.getElementById('clienteEstado').value = client.estado || 'Activo';
        document.getElementById('clienteObservaciones').value = client.observaciones || '';
        
        new bootstrap.Modal(document.getElementById('clienteModal')).show();
    },

    viewCliente(id) {
        // En lugar de abrir el modal, navegamos a la vista completa de la página
        this.navigateTo('cliente_detail', id);
    },

    loadClientPageTab(id, tabName, page = 1) {
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO') : '-';
        const container = document.getElementById(`cp-tab-content`);
        if (!container) return;

        let records = [];

        if (tabName === 'transacciones') {
            const movements = DB.getAll(DB.KEYS.BANK_MOVEMENTS) || [];
            const sales = DB.getSales();
            const compras = DB.getCompras();
            const recibos = DB.getAll(DB.KEYS.RECIBOS_CAJA) || [];
            const pagosProv = DB.getPagosProveedores() || [];
            
            records = movements.filter(m => {
                if (!m.referencia_id) return false;
                const refId = String(m.referencia_id);
                
                const sale = sales.find(s => String(s.id) === String(refId));
                if (sale && String(sale.cliente_id) === String(id)) return true;
                
                const compra = compras.find(c => String(c.id) === String(refId));
                if (compra && String(compra.proveedor_id) === String(id)) return true;
                
                const recibo = recibos.find(r => String(r.id) === String(refId));
                if (recibo && String(recibo.cliente_id) === String(id)) return true;
                
                const pago = pagosProv.find(p => String(p.id) === String(refId));
                if (pago && String(pago.proveedor_id) === String(id)) return true;
                
                return false;
            }).sort((a, b) => new Date(b.fecha || a.created_at) - new Date(a.fecha || b.created_at));
        } else if (tabName === 'facturas-venta') {
            records = DB.getSales().filter(s => String(s.cliente_id) === String(id))
                .sort((a, b) => new Date(b.fecha || a.created_at) - new Date(a.fecha || b.created_at));
        } else if (tabName === 'facturas-proveedor') {
            records = DB.getCompras().filter(s => String(s.proveedor_id) === String(id))
                .sort((a, b) => new Date(b.fecha || a.created_at) - new Date(a.fecha || b.created_at));
        } else if (tabName === 'cotizaciones') {
            records = DB.getCotizaciones().filter(c => String(c.cliente_id) === String(id))
                .sort((a, b) => new Date(b.fecha || a.created_at) - new Date(a.fecha || b.created_at));
        } else if (tabName === 'devoluciones') {
            const dev = DB.getAll(DB.KEYS.DEVOLUCIONES) || [];
            records = dev.filter(d => {
                const sale = DB.getSale(d.venta_id);
                return sale && String(sale.cliente_id) === String(id);
            }).sort((a, b) => new Date(b.fecha || a.created_at) - new Date(a.fecha || b.created_at));
        } else if (tabName === 'cuentas-cobrar') {
            records = DB.getCartera().filter(c => String(c.cliente_id) === String(id) && c.estado !== 'pagada')
                .sort((a, b) => new Date(b.fecha_vencimiento) - new Date(a.fecha_vencimiento));
        } else if (tabName === 'pagos') {
            records = DB.getAll(DB.KEYS.RECIBOS_CAJA).filter(r => String(r.cliente_id) === String(id))
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        }

        const limit = 10;
        const total = records.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const currentPage = Math.max(1, Math.min(page, totalPages));
        const start = (currentPage - 1) * limit;
        const end = Math.min(start + limit, total);
        const paginated = records.slice(start, end);

        let tableHtml = '';
        if (total === 0) {
            tableHtml = `<div class="text-center text-muted p-5 bg-white rounded shadow-sm">
                <i class="bi bi-inbox fs-1 text-light"></i>
                <p class="mt-2 mb-0">No hay registros para mostrar en esta pestaña.</p>
            </div>`;
        } else {
            let thead = `<tr>
                <th style="width: 15%">Fecha <i class="bi bi-arrow-down-short"></i></th>
                <th style="width: 35%">Detalle</th>
                <th style="width: 15%">Estado</th>
                <th class="text-end" style="width: 17.5%">Gastos</th>
                <th class="text-end" style="width: 17.5%">Ingresos</th>
            </tr>`;
            
            let rows = paginated.map(item => {
                let fecha = item.fecha || item.fecha_emision || item.created_at;
                let detalle = '';
                let estado = item.estado || 'completado';
                let gasto = 0;
                let ingreso = 0;
                
                // Mapear lógica por pestaña para homologar columnas
                if (tabName === 'transacciones') {
                    let desc = item.descripcion || 'Movimiento de saldo';
                    const match = desc.match(/#(?:Factura |Venta |[a-zA-Z\s]+)?([a-zA-Z0-9]+)/);
                    if (match && item.referencia_id) {
                        const clickCall = item.tipo === 'ingreso' ? `App.viewVenta('${item.referencia_id}')` : `App.editCompra('${item.referencia_id}')`;
                        desc = desc.replace(match[0], `<a href="#" onclick="event.preventDefault(); ${clickCall}" class="text-primary fw-medium">${match[0]}</a>`);
                    }
                    detalle = desc;
                    if (item.tipo === 'ingreso') ingreso = item.monto;
                    else gasto = item.monto;
                } else if (tabName === 'facturas-venta') {
                    const num = item.numero || item.id.toString().substr(-6).toUpperCase();
                    detalle = `Factura de venta: <a href="#" onclick="event.preventDefault(); App.viewVenta('${item.id}')" class="text-primary fw-medium">#${num.replace('#', '')}</a>`;
                    ingreso = item.total;
                } else if (tabName === 'facturas-proveedor') {
                    const num = item.numero_factura || item.id.toString().substr(-6).toUpperCase();
                    detalle = `Factura de proveedor: <a href="#" onclick="event.preventDefault(); App.editCompra('${item.id}')" class="text-primary fw-medium">#${num.replace('#', '')}</a>`;
                    gasto = item.total;
                } else if (tabName === 'cotizaciones') {
                    const num = item.numero || item.id.toString().substr(-6).toUpperCase();
                    detalle = `Cotización: <a href="#" onclick="event.preventDefault(); App.editCotizacion('${item.id}')" class="text-primary fw-medium">#${num.replace('#', '')}</a>`;
                    ingreso = item.total;
                } else if (tabName === 'devoluciones') {
                    const ref = item.id.toString().substr(-6).toUpperCase();
                    detalle = `Devolución en venta: <strong>#${ref}</strong>`;
                    gasto = item.total;
                } else if (tabName === 'cuentas-cobrar') {
                    const num = item.venta_numero || item.id.toString().substr(-6).toUpperCase();
                    detalle = `Cuenta por cobrar (Factura <a href="#" onclick="event.preventDefault(); App.viewVenta('${item.venta_id}')" class="text-primary fw-medium">#${num}</a>)`;
                    ingreso = item.saldo; // lo que entra
                } else if (tabName === 'pagos') {
                    const num = item.numero || item.id.toString().substr(-6).toUpperCase();
                    detalle = `Pago recibido: <a href="#" onclick="event.preventDefault(); App.printReciboCaja('${item.id}')" class="text-primary fw-medium">RC-${num}</a>`;
                    ingreso = item.monto;
                }

                // Render badge for estado
                let badgeClass = 'secondary';
                const lowerStatus = String(estado).toLowerCase();
                if (['pagada', 'completado', 'aceptada', 'activo'].includes(lowerStatus)) badgeClass = 'success';
                if (['pendiente', 'enviada', 'borrador'].includes(lowerStatus)) badgeClass = 'warning text-dark';
                if (['anulada', 'rechazada', 'vencida'].includes(lowerStatus)) badgeClass = 'danger';
                if (['convertida'].includes(lowerStatus)) badgeClass = 'primary';

                return `<tr>
                    <td class="align-middle">${fmtDate(fecha)}</td>
                    <td class="align-middle text-muted">${detalle}</td>
                    <td class="align-middle"><span class="badge bg-${badgeClass} text-uppercase" style="font-size: 0.75rem;">${estado}</span></td>
                    <td class="align-middle text-end text-danger">${gasto > 0 ? fmt(gasto) : '-'}</td>
                    <td class="align-middle text-end text-success">${ingreso > 0 ? fmt(ingreso) : '-'}</td>
                </tr>`;
            }).join('');

            tableHtml = `
                <div class="table-responsive bg-white rounded shadow-sm">
                    <table class="table table-hover mb-0 align-middle">
                        <thead class="table-light">
                            ${thead}
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        // Paginación UI (esquina inferior derecha)
        let paginationHtml = '';
        if (total > 0) {
            paginationHtml = `
                <div class="d-flex justify-content-end align-items-center mt-3 mb-4">
                    <span class="text-muted me-3" style="font-size: 0.85rem;">${start + 1}-${end} de ${total}</span>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-secondary" ${currentPage === 1 ? 'disabled' : ''} onclick="App.loadClientPageTab('${id}', '${tabName}', ${currentPage - 1})">
                            <i class="bi bi-chevron-left"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" ${currentPage === totalPages ? 'disabled' : ''} onclick="App.loadClientPageTab('${id}', '${tabName}', ${currentPage + 1})">
                            <i class="bi bi-chevron-right"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        container.innerHTML = tableHtml + paginationHtml;
        
        // Actualizar visualmente la pestaña activa
        document.querySelectorAll('#client-tabs-menu .nav-link').forEach(el => el.classList.remove('active', 'border-primary', 'text-primary'));
        const activeTab = document.getElementById(`cptab-${tabName}`);
        if (activeTab) {
            activeTab.classList.add('active', 'border-primary', 'text-primary');
        }
    },

    loadClientTab(id, tabName, page = 1) {
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO') : '-';
        const container = document.getElementById(`c-${tabName}`);
        if (!container) return;

        let records = [];

        if (tabName === 'transacciones') {
            const movements = DB.getAll(DB.KEYS.BANK_MOVEMENTS) || [];
            const sales = DB.getSales();
            const compras = DB.getCompras();
            const recibos = DB.getAll(DB.KEYS.RECIBOS_CAJA) || [];
            const pagosProv = DB.getPagosProveedores() || [];
            
            records = movements.filter(m => {
                if (!m.referencia_id) return false;
                const refId = String(m.referencia_id);
                
                const sale = sales.find(s => String(s.id) === String(refId));
                if (sale && String(sale.cliente_id) === String(id)) return true;
                
                const compra = compras.find(c => String(c.id) === String(refId));
                if (compra && String(compra.proveedor_id) === String(id)) return true;
                
                const recibo = recibos.find(r => String(r.id) === String(refId));
                if (recibo && String(recibo.cliente_id) === String(id)) return true;
                
                const pago = pagosProv.find(p => String(p.id) === String(refId));
                if (pago && String(pago.proveedor_id) === String(id)) return true;
                
                return false;
            }).sort((a, b) => new Date(b.fecha || a.created_at) - new Date(a.fecha || b.created_at));
        } else if (tabName === 'facturas-venta') {
            records = DB.getSales().filter(s => String(s.cliente_id) === String(id))
                .sort((a, b) => new Date(b.fecha || a.created_at) - new Date(a.fecha || b.created_at));
        } else if (tabName === 'cotizaciones') {
            records = DB.getCotizaciones().filter(c => String(c.cliente_id) === String(id))
                .sort((a, b) => new Date(b.fecha || a.created_at) - new Date(a.fecha || b.created_at));
        } else if (tabName === 'devoluciones') {
            const dev = DB.getAll(DB.KEYS.DEVOLUCIONES) || [];
            records = dev.filter(d => {
                const sale = DB.getSale(d.venta_id);
                return sale && String(sale.cliente_id) === String(id);
            }).sort((a, b) => new Date(b.fecha || a.created_at) - new Date(a.fecha || b.created_at));
        } else if (tabName === 'cuentas-cobrar') {
            records = DB.getCartera().filter(c => String(c.cliente_id) === String(id) && c.estado !== 'pagada')
                .sort((a, b) => new Date(b.fecha_vencimiento) - new Date(a.fecha_vencimiento));
        } else if (tabName === 'pagos') {
            records = DB.getAll(DB.KEYS.RECIBOS_CAJA).filter(r => String(r.cliente_id) === String(id))
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        }

        const limit = 10;
        const total = records.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const currentPage = Math.max(1, Math.min(page, totalPages));
        const start = (currentPage - 1) * limit;
        const end = Math.min(start + limit, total);
        const paginated = records.slice(start, end);

        let tableHtml = '';
        if (total === 0) {
            tableHtml = `<div class="text-center text-muted p-4">No se encontraron registros en esta sección.</div>`;
        } else {
            let thead = '';
            let rows = '';

            if (tabName === 'transacciones') {
                thead = `<tr><th>Fecha</th><th>Banco</th><th>Descripción</th><th>Tipo</th><th class="text-end">Monto</th></tr>`;
                rows = paginated.map(m => {
                    const bank = DB.getBank(m.banco_id);
                    let desc = m.descripcion || '';
                    const match = desc.match(/#(?:Factura |Venta |[a-zA-Z\s]+)?([a-zA-Z0-9]+)/);
                    if (match && m.referencia_id) {
                        const clickCall = m.tipo === 'ingreso' ? `App.viewVenta('${m.referencia_id}')` : `App.editCompra('${m.referencia_id}')`;
                        desc = desc.replace(match[0], `<a href="#" onclick="event.preventDefault(); bootstrap.Modal.getInstance(document.getElementById('clienteDetailModal')).hide(); ${clickCall}">${match[0]}</a>`);
                    }
                    return `<tr>
                        <td>${fmtDate(m.fecha)}</td>
                        <td>${bank ? bank.nombre : 'N/A'}</td>
                        <td>${desc}</td>
                        <td><span class="badge ${m.tipo === 'ingreso' ? 'bg-success' : 'bg-danger'}">${m.tipo.toUpperCase()}</span></td>
                        <td class="text-end fw-bold ${m.tipo === 'ingreso' ? 'text-success' : 'text-danger'}">${m.tipo === 'ingreso' ? '+' : '-'}${fmt(m.monto)}</td>
                    </tr>`;
                }).join('');
            } else if (tabName === 'facturas-venta') {
                thead = `<tr><th>Documento</th><th>Fecha</th><th>Tipo</th><th class="text-end">Total</th><th>Estado</th></tr>`;
                rows = paginated.map(s => {
                    const num = s.numero || s.id.toString().substr(-6).toUpperCase();
                    return `<tr>
                        <td><a href="#" onclick="event.preventDefault(); bootstrap.Modal.getInstance(document.getElementById('clienteDetailModal')).hide(); App.viewVenta('${s.id}')" class="text-decoration-none fw-bold">${num.replace('#', '')}</a></td>
                        <td>${fmtDate(s.fecha)}</td>
                        <td><span class="badge-status badge-${s.tipo_venta}">${s.tipo_venta}</span></td>
                        <td class="text-end fw-bold">${fmt(s.total)}</td>
                        <td><span class="badge bg-${s.estado === 'pagada' ? 'success' : (s.estado === 'anulada' ? 'danger' : 'warning text-dark')} text-uppercase">${s.estado || 'OK'}</span></td>
                    </tr>`;
                }).join('');
            } else if (tabName === 'cotizaciones') {
                thead = `<tr><th>Documento</th><th>Fecha</th><th>Validez</th><th class="text-end">Total</th><th>Estado</th></tr>`;
                rows = paginated.map(c => {
                    const num = c.numero || c.id.toString().substr(-6).toUpperCase();
                    return `<tr>
                        <td><a href="#" onclick="event.preventDefault(); bootstrap.Modal.getInstance(document.getElementById('clienteDetailModal')).hide(); App.editCotizacion('${c.id}')" class="text-decoration-none fw-bold">${num.replace('#', '')}</a></td>
                        <td>${fmtDate(c.fecha)}</td>
                        <td>${fmtDate(c.validez)}</td>
                        <td class="text-end fw-bold">${fmt(c.total || 0)}</td>
                        <td><span class="badge bg-${c.estado === 'convertida' ? 'primary' : 'secondary'} text-uppercase">${c.estado || 'borrador'}</span></td>
                    </tr>`;
                }).join('');
            } else if (tabName === 'devoluciones') {
                thead = `<tr><th>Referencia</th><th>Fecha</th><th>Factura Origen</th><th class="text-end">Total Devuelto</th></tr>`;
                rows = paginated.map(d => {
                    const sale = DB.getSale(d.venta_id);
                    const ref = d.id.toString().substr(-6).toUpperCase();
                    return `<tr>
                        <td><strong>#${ref}</strong></td>
                        <td>${fmtDate(d.fecha)}</td>
                        <td>Factura #${sale ? (sale.numero || sale.id.toString().substr(-6).toUpperCase()) : 'N/A'}</td>
                        <td class="text-end fw-bold">${fmt(d.total)}</td>
                    </tr>`;
                }).join('');
            } else if (tabName === 'cuentas-cobrar') {
                thead = `<tr><th>Vencimiento</th><th>Total</th><th class="text-end">Saldo Pendiente</th><th>Estado</th></tr>`;
                rows = paginated.map(c => `
                    <tr>
                        <td>${fmtDate(c.fecha_vencimiento)}</td>
                        <td>${fmt(c.total)}</td>
                        <td class="text-end text-danger fw-bold">${fmt(c.saldo)}</td>
                        <td><span class="badge ${c.estado === 'vencida' ? 'bg-danger' : 'bg-warning text-dark'}">${c.estado.toUpperCase()}</span></td>
                    </tr>
                `).join('');
            } else if (tabName === 'pagos') {
                thead = `<tr><th>Referencia</th><th>Fecha</th><th>Banco</th><th class="text-end">Monto</th><th>Estado</th></tr>`;
                rows = paginated.map(r => {
                    const ref = r.id.toString().length > 6 ? r.id.toString().substr(-6).toUpperCase() : r.id.toString().toUpperCase();
                    const bank = DB.getBank(r.banco_id);
                    return `<tr>
                        <td><strong>#${ref}</strong></td>
                        <td>${fmtDate(r.fecha)}</td>
                        <td>${bank ? bank.nombre : 'N/A'}</td>
                        <td class="text-end fw-bold">${fmt(r.monto_total || 0)}</td>
                        <td><span class="badge bg-${r.estado === 'activo' ? 'success' : 'danger'} text-uppercase">${r.estado || 'activo'}</span></td>
                    </tr>`;
                }).join('');
            }

            tableHtml = `
                <div class="table-responsive">
                    <table class="table table-sm table-hover align-middle">
                        <thead class="table-light">${thead}</thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-2 px-2" style="font-size:12px;">
                    <span class="text-muted">${start + 1}-${end} de ${total}</span>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-secondary" ${currentPage === 1 ? 'disabled' : ''} onclick="App.loadClientTab('${id}', '${tabName}', ${currentPage - 1})">
                            <i class="bi bi-chevron-left"></i> Anterior
                        </button>
                        <button class="btn btn-outline-secondary" ${currentPage === totalPages ? 'disabled' : ''} onclick="App.loadClientTab('${id}', '${tabName}', ${currentPage + 1})">
                            Siguiente <i class="bi bi-chevron-right"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        container.innerHTML = tableHtml;
    },

    saveCliente() {
        const nombre = document.getElementById('clienteNombre').value.trim();
        const documento = document.getElementById('clienteDocumento').value.trim();
        const email = document.getElementById('clienteEmail').value.trim();
        
        if (!nombre || !documento) {
            this.showToast('Nombre y documento son obligatorios', 'Error', 'danger');
            return;
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showToast('El formato del correo electrónico es inválido', 'Error', 'danger');
            return;
        }

        const client = {
            id: document.getElementById('clienteId').value || undefined,
            tipo: document.getElementById('clienteTipo').value,
            nombre,
            documento,
            tipo_doc: document.getElementById('clienteTipoDoc').value,
            regimen: document.getElementById('clienteRegimen').value,
            id_alegra: document.getElementById('clienteIdAlegra').value || '',
            telefono: document.getElementById('clienteTelefono').value.trim(),
            cupo_credito: parseFloat(this.unformatNumber(document.getElementById('clienteCupo').value)) || 0,
            plazo_dias: parseInt(this.unformatNumber(document.getElementById('clientePlazo').value)) || 30,
            email: email,
            persona_contacto: document.getElementById('clienteContacto').value.trim(),
            direccion: document.getElementById('clienteDireccion').value.trim(),
            barrio: document.getElementById('clienteBarrio').value.trim(),
            ciudad: document.getElementById('clienteCiudad').value.trim(),
            departamento: document.getElementById('clienteDepartamento').value.trim(),
            pais: document.getElementById('clientePais').value.trim(),
            codigo_postal: document.getElementById('clienteCodigoPostal').value.trim(),
            estado: document.getElementById('clienteEstado').value,
            observaciones: document.getElementById('clienteObservaciones').value.trim()
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
        document.getElementById('productoIdAlegra').value = '';
        new bootstrap.Modal(document.getElementById('productoModal')).show();
    },

    editProducto(id) {
        const p = DB.getProduct(id);
        if (!p) return;
        document.getElementById('productoModalTitle').textContent = 'Editar Producto';
        document.getElementById('productoId').value = id;
        document.getElementById('productoCodigo').value = p.codigo;
        document.getElementById('productoNombre').value = p.nombre;
        document.getElementById('productoPrecioCompra').value = this.formatNumber(p.precio_compra);
        document.getElementById('productoPrecioVenta').value = this.formatNumber(p.precio_venta);
        document.getElementById('productoStockActual').value = this.formatNumber(p.stock_actual || 0);
        document.getElementById('productoStockMinimo').value = this.formatNumber(p.stock_minimo || 5);
        
        document.getElementById('productoCategoria').value = p.categoria || '';
        document.getElementById('productoUnidadMedida').value = p.unidad_medida || 'Unidad';
        document.getElementById('productoUbicacion').value = p.ubicacion_bodega || '';
        document.getElementById('productoIdAlegra').value = p.id_alegra || '';
        document.getElementById('productoEstado').value = p.estado || 'Activo';
        document.getElementById('productoObservaciones').value = p.observaciones || '';
        
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
            <div class="row">
                <div class="col-md-6">
                    <div class="row mb-3">
                        <div class="col-sm-4 text-muted small">Código/Referencia</div>
                        <div class="col-sm-8 fw-bold">${p.codigo}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-4 text-muted small">Nombre</div>
                        <div class="col-sm-8">${p.nombre}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-4 text-muted small">Categoría</div>
                        <div class="col-sm-8"><span class="badge bg-secondary">${p.categoria || 'Sin Categoría'}</span></div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-4 text-muted small">Precio Compra</div>
                        <div class="col-sm-8">${fmt(p.precio_compra)}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-4 text-muted small">Precio Venta (Público)</div>
                        <div class="col-sm-8 fw-bold text-success">${fmt(p.precio_venta)}</div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="row mb-3">
                        <div class="col-sm-4 text-muted small">Stock Actual</div>
                        <div class="col-sm-8"><span class="badge ${p.stock_actual <= p.stock_minimo ? 'bg-danger' : 'bg-primary'} fs-6">${p.stock_actual}</span></div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-4 text-muted small">Stock Mínimo Alerta</div>
                        <div class="col-sm-8">${p.stock_minimo}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-4 text-muted small">Unidad de Medida</div>
                        <div class="col-sm-8">${p.unidad_medida || 'Unidad'}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-4 text-muted small">Ubicación / Bodega</div>
                        <div class="col-sm-8">${p.ubicacion_bodega || 'N/A'}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-4 text-muted small">ID Alegra</div>
                        <div class="col-sm-8"><code>${p.id_alegra || 'N/A'}</code></div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-4 text-muted small">Estado</div>
                        <div class="col-sm-8"><span class="badge ${p.estado === 'Inactivo' ? 'bg-secondary' : 'bg-success'}">${p.estado || 'Activo'}</span></div>
                    </div>
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-md-12">
                    <div class="p-2 bg-light rounded" style="font-size: 13px;">
                        <strong>Observaciones:</strong> ${p.observaciones || 'Sin observaciones.'}
                    </div>
                </div>
            </div>
        `;
        document.getElementById('p-general').innerHTML = generalHtml;

        // 2. Kardex / Movements Tab using DB.getKardexMovements
        const movements = DB.getKardexMovements(id);
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
                                <th>Contacto</th>
                                <th class="text-end">Cant.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${movements.map(m => `
                                <tr>
                                    <td>${fmtDate(m.fecha)}</td>
                                    <td><span class="badge ${m.cant > 0 ? 'bg-success' : (m.tipo.includes('Salida') ? 'bg-warning text-dark' : 'bg-secondary')}">${m.tipo}</span></td>
                                    <td>${m.ref}</td>
                                    <td>${m.origen}</td>
                                    <td>${m.cliente_proveedor || '-'}</td>
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
            stock_minimo: parseInt(this.unformatNumber(document.getElementById('productoStockMinimo').value)) || 5,
            categoria: document.getElementById('productoCategoria').value.trim(),
            unidad_medida: document.getElementById('productoUnidadMedida').value,
            ubicacion_bodega: document.getElementById('productoUbicacion').value.trim(),
            id_alegra: document.getElementById('productoIdAlegra').value || '',
            estado: document.getElementById('productoEstado').value,
            observaciones: document.getElementById('productoObservaciones').value.trim()
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
        document.getElementById('ventaId').value = '';
        document.getElementById('ventaForm').reset();
        document.getElementById('ventaNumeroHeader').textContent = 'No. ' + DB.getNextNumber('venta');
        document.getElementById('ventaFecha').value = new Date().toISOString().split('T')[0];

        this.selectors.ventaCliente.setData(DB.getClients()
            .filter(c => !c.tipo || c.tipo.toLowerCase() === 'cliente' || c.tipo.toLowerCase() === 'ambos')
            .map(c => ({ id: c.id, text: c.nombre })));
        this.selectors.ventaCliente.clear();

        this.selectors.ventaBanco.setData(DB.getBanks().map(b => ({ id: b.id, text: b.nombre })));
        this.selectors.ventaBanco.clear();

        this.selectors.ventaVendedor.setData(DB.getSellers().map(s => ({ id: s.id, text: s.nombre })));
        this.selectors.ventaVendedor.clear();

        document.getElementById('ventaTipo').value = 'contado';
        document.getElementById('ventaBancoContainer').style.display = 'block';

        // Clear body and add initial row
        document.getElementById('ventaDetalleBody').innerHTML = '';
        this.addVentaRow();

        new bootstrap.Modal(document.getElementById('ventaModal')).show();
    },

    editVenta(id) {
        const v = DB.getSale(id);
        if (!v) return;

        if (v.estado === 'pagada' || v.estado === 'anulada') {
            this.showToast('No se puede editar una factura pagada o anulada', 'Error', 'danger');
            return;
        }

        document.getElementById('ventaId').value = v.id;
        document.getElementById('ventaNumeroHeader').textContent = 'No. ' + (v.numero || v.id.toString().slice(-6).toUpperCase());
        document.getElementById('ventaFecha').value = v.fecha ? v.fecha.split('T')[0] : new Date().toISOString().split('T')[0];
        document.getElementById('ventaTipo').value = v.tipo_venta;
        document.getElementById('ventaObservacion').value = v.observacion || '';

        this.selectors.ventaCliente.setData(DB.getClients()
            .filter(cli => !cli.tipo || ['cliente', 'ambos'].includes(cli.tipo.toLowerCase()) || cli.id === v.cliente_id)
            .map(cli => ({ id: cli.id, text: cli.nombre })));
        this.selectors.ventaCliente.setValue(v.cliente_id);

        this.selectors.ventaVendedor.setData(DB.getSellers().map(s => ({ id: s.id, text: s.nombre })));
        if (v.vendedor_id) this.selectors.ventaVendedor.setValue(v.vendedor_id);
        else this.selectors.ventaVendedor.clear();

        this.selectors.ventaBanco.setData(DB.getBanks().map(b => ({ id: b.id, text: b.nombre })));
        
        const bancoContainer = document.getElementById('ventaBancoContainer');
        if (v.tipo_venta === 'contado') {
            bancoContainer.style.display = 'block';
            const recibo = DB.getAll(DB.KEYS.RECIBOS_CAJA).find(r => (r.observacion || r.observaciones || '').includes(v.numero || v.id.toString().slice(-6)));
            if (recibo) this.selectors.ventaBanco.setValue(recibo.banco_id);
            else this.selectors.ventaBanco.clear();
        } else {
            bancoContainer.style.display = 'none';
            this.selectors.ventaBanco.clear();
        }

        // Render detail rows
        const body = document.getElementById('ventaDetalleBody');
        body.innerHTML = '';
        const details = DB.getSaleDetails(id);
        if (details.length === 0) {
            this.addVentaRow();
        } else {
            details.forEach(d => this.addVentaRow(d));
        }

        new bootstrap.Modal(document.getElementById('ventaModal')).show();
    },

    saveVenta() {
        const clienteId = this.selectors.ventaCliente.getValue();
        const tipoVenta = document.getElementById('ventaTipo').value;
        const bancoId = this.selectors.ventaBanco.getValue();
        const vendedorId = this.selectors.ventaVendedor.getValue();
        const fecha = document.getElementById('ventaFecha').value;
        const observacion = document.getElementById('ventaObservacion').value.trim();

        if (!clienteId) {
            this.showToast('Seleccione un cliente', 'Error', 'danger');
            return;
        }
        if (!fecha) {
            this.showToast('La fecha es obligatoria', 'Error', 'danger');
            return;
        }
        if (tipoVenta === 'contado' && !bancoId) {
            this.showToast('Seleccione banco para venta de contado', 'Error', 'danger');
            return;
        }

        const rows = document.querySelectorAll('#ventaDetalleBody tr.detalle-row');
        if (rows.length === 0) {
            this.showToast('Agregue al menos un producto', 'Error', 'danger');
            return;
        }

        const details = [];
        for (const row of rows) {
            const selectContainer = row.querySelector('[id^="vta-row-product-container-"]');
            const prodId = selectContainer ? selectContainer.dataset.productId : null;
            if (!prodId) {
                this.showToast('Seleccione un producto para todas las líneas', 'Error', 'danger');
                return;
            }

            const cantidad = parseInt(this.unformatNumber(row.querySelector('.row-cantidad').value)) || 0;
            const precioUnitario = parseFloat(this.unformatNumber(row.querySelector('.row-precio').value)) || 0;
            const descuento = parseFloat(this.unformatNumber(row.querySelector('.row-descuento').value)) || 0;
            const impuesto = row.querySelector('.row-impuesto').value;
            const descripcion = row.querySelector('.row-descripcion').value.trim();

            if (cantidad <= 0) {
                this.showToast('La cantidad debe ser mayor a 0', 'Error', 'danger');
                return;
            }

            // Validate stock
            const product = DB.getProduct(prodId);
            if (product && product.stock_actual < cantidad) {
                this.showToast(`Stock insuficiente para ${product.nombre}. Disponible: ${product.stock_actual}`, 'Error', 'danger');
                return;
            }

            const netSubtotal = cantidad * precioUnitario * (1 - descuento / 100);
            const taxRate = impuesto === '19%' ? 0.19 : 0.00;
            const taxAmount = netSubtotal * taxRate;

            details.push({
                producto_id: prodId,
                cantidad: cantidad,
                precio_unitario: precioUnitario,
                descuento: descuento,
                impuesto: impuesto,
                descripcion: descripcion,
                subtotal: netSubtotal + taxAmount
            });
        }

        const id = document.getElementById('ventaId')?.value || undefined;
        const saleData = {
            id: id,
            cliente_id: clienteId,
            tipo_venta: tipoVenta,
            banco_id: bancoId || null,
            vendedor_id: vendedorId,
            fecha: fecha,
            observacion: observacion,
            usuario_id: Auth.currentUser ? Auth.currentUser.id : null
        };

        try {
            DB.registerSale(saleData, details, bancoId);
            bootstrap.Modal.getInstance(document.getElementById('ventaModal')).hide();
            this.showToast('Venta registrada correctamente');
            this.navigateTo('ventas');
        } catch(error) {
            this.showToast(error.message, 'Error', 'danger');
        }
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
                <td class="text-end">${d.cantidad}</td>
                <td class="text-end">${fmt(d.precio_unitario)}</td>
                <td class="text-end">${fmt(d.subtotal)}</td>
            </tr>`;
        }).join('');

        document.getElementById('ventaDetailBody').innerHTML = `
            <div class="row mb-4">
                <div class="col-md-6">
                    <p><strong># Documento:</strong> ${sale.numero || sale.id.toString().substr(-6).toUpperCase()}</p>
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
                    <tr><th>Producto</th><th>Descripción / Modelo</th><th class="text-end">Cant.</th><th class="text-end">P. Venta</th><th class="text-end">Subtotal</th></tr>
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

        const refNum = sale.numero || sale.id.toString().slice(-6).toUpperCase();
        const printWindow = window.open('', '_blank');
        
        let subtotalAccum = 0;
        let discountAccum = 0;
        let taxAccum = 0;
        let totalAccum = 0;
        
        details.forEach(d => {
            const qty = parseInt(d.cantidad) || 0;
            const price = parseFloat(d.precio_unitario) || 0;
            const descPercent = parseFloat(d.descuento) || 0;
            
            const rawSubtotal = qty * price;
            const discountAmt = rawSubtotal * (descPercent / 100);
            const netSubtotal = rawSubtotal - discountAmt;
            const taxRate = d.impuesto === '19%' ? 0.19 : 0.00;
            const taxAmt = netSubtotal * taxRate;
            
            subtotalAccum += rawSubtotal;
            discountAccum += discountAmt;
            taxAccum += taxAmt;
            totalAccum += (netSubtotal + taxAmt);
        });

        const html = `<!DOCTYPE html><html lang="es">
        <head><meta charset="UTF-8"><title>Factura de Venta #${refNum}</title>
        <style>${this._getPrintStyles()}</style></head>
        <body><div class="doc-wrapper">
            <div class="doc-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0d9488; padding-bottom: 15px; margin-bottom: 25px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="LogoMas.png" alt="Logo" style="height: 50px; object-fit: contain;">
                </div>
                <div class="doc-title" style="text-align: right;">
                    <h1 style="font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 0;">FACTURA DE VENTA</h1>
                    <div class="ref" style="color: #0d9488; font-size: 15px; font-weight: 600; margin-top: 4px;">No. ${refNum}</div>
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
                    ${sale.observacion ? `<p><strong>Notas:</strong> ${sale.observacion}</p>` : ''}
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background: #0d9488; color: white;">
                        <th style="padding: 10px 12px; font-size: 11px; text-align: center; width: 50px;">Línea</th>
                        <th style="padding: 10px 12px; font-size: 11px;">Producto o Servicio</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-align: center; width: 80px;">Cant.</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-align: right; width: 110px;">Precio Unit.</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-align: center; width: 80px;">Desc. %</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-align: center; width: 90px;">IVA</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-align: right; width: 130px;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${details.map((d, index) => {
                        const p = DB.getProduct(d.producto_id);
                        const qty = parseInt(d.cantidad) || 0;
                        const price = parseFloat(d.precio_unitario) || 0;
                        const descPercent = parseFloat(d.descuento) || 0;
                        
                        const rawSubtotal = qty * price;
                        const discountAmt = rawSubtotal * (descPercent / 100);
                        const netSubtotal = rawSubtotal - discountAmt;
                        const taxRate = d.impuesto === '19%' ? 0.19 : 0.00;
                        const taxAmt = netSubtotal * taxRate;
                        
                        const subtotalVal = netSubtotal + taxAmt;
                        
                        return `<tr>
                            <td style="padding: 9px 12px; text-align: center; color: #666; border-bottom: 1px solid #e9ecef;">${index + 1}</td>
                            <td style="padding: 9px 12px; border-bottom: 1px solid #e9ecef;">
                                <strong>${p ? p.nombre : 'Producto N/A'}</strong>
                                ${p ? `<br><small style="color: #666">SKU: ${p.codigo}</small>` : ''}
                                ${d.descripcion ? `<br><small style="color: #555; font-style: italic;">${d.descripcion}</small>` : ''}
                            </td>
                            <td style="padding: 9px 12px; text-align: center; border-bottom: 1px solid #e9ecef;">${d.cantidad}</td>
                            <td style="padding: 9px 12px; text-align: right; border-bottom: 1px solid #e9ecef;">${fmt(price)}</td>
                            <td style="padding: 9px 12px; text-align: center; border-bottom: 1px solid #e9ecef;">${descPercent > 0 ? `${descPercent}%` : '-'}</td>
                            <td style="padding: 9px 12px; text-align: center; border-bottom: 1px solid #e9ecef;">${d.impuesto || 'Ninguno'}</td>
                            <td style="padding: 9px 12px; text-align: right; border-bottom: 1px solid #e9ecef;">${fmt(subtotalVal)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            <div class="totals-section" style="display: flex; justify-content: flex-end; margin-top: 10px;">
                <div class="totals-box" style="width: 300px;">
                    <div class="totals-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9ecef;"><span>Subtotal:</span><span>${fmt(subtotalAccum)}</span></div>
                    <div class="totals-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9ecef;"><span>Descuento:</span><span style="color: #dc3545; font-weight: 500;">-${fmt(discountAccum)}</span></div>
                    <div class="totals-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9ecef;"><span>Impuestos (IVA 19%):</span><span>${fmt(taxAccum)}</span></div>
                    <div class="totals-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9ecef;"><span>Total Venta:</span><span>${fmt(totalAccum)}</span></div>
                    ${sale.tipo_venta === 'credito' ? `
                    <div class="totals-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9ecef;"><span>Abonado:</span><span>${fmt(totalAccum - saldo)}</span></div>
                    <div class="totals-row grand" style="display: flex; justify-content: space-between; padding-top: 10px; margin-top: 5px; font-size: 16px; font-weight: 700; color: #0d9488; border-top: 2px solid #0d9488;"><span>SALDO RESTANTE:</span><span>${fmt(saldo)}</span></div>
                    ` : `<div class="totals-row grand" style="display: flex; justify-content: space-between; padding-top: 10px; margin-top: 5px; font-size: 16px; font-weight: 700; color: #0d9488; border-top: 2px solid #0d9488;"><span>TOTAL PAGADO:</span><span>${fmt(totalAccum)}</span></div>`}
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

        document.getElementById('compraModalTitle').textContent = `Órden de Compra #${c.id.toString().substr(-6).toUpperCase()}`;
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
                <td class="text-end">${d.cantidad}</td>
                <td class="text-end">${fmt(d.costo_unitario)}</td>
                <td class="text-end">${d.precio_venta_sugerido ? fmt(d.precio_venta_sugerido) : '-'}</td>
                <td class="text-end">${fmt(d.subtotal)}</td>
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
            proveedor_id: proveedorId,
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
        const refNum = c.numero || c.id.toString().substr(-6).toUpperCase();

        const printWindow = window.open('', '_blank');
        const html = `<!DOCTYPE html><html lang="es">
        <head><meta charset="UTF-8"><title>Orden de Compra #${refNum}</title>
        <style>${this._getPrintStyles()}</style></head>
        <body><div class="doc-wrapper">
            <div class="doc-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0d9488; padding-bottom: 15px; margin-bottom: 25px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="LogoMas.png" alt="Logo" style="height: 50px; object-fit: contain;">
                </div>
                <div class="doc-title" style="text-align: right;">
                    <h1 style="font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 0;">ORDEN DE COMPRA</h1>
                    <div class="ref" style="color: #0d9488; font-size: 15px; font-weight: 600; margin-top: 4px;"># ${refNum}</div>
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
        document.getElementById('cotizacionId').value = '';
        document.getElementById('cotizacionForm').reset();
        document.getElementById('cotizacionNumeroHeader').textContent = 'No. ' + DB.getNextNumber('cotizacion');
        document.getElementById('cotizacionFecha').value = new Date().toISOString().split('T')[0];

        const validez = new Date();
        validez.setDate(validez.getDate() + 15);
        document.getElementById('cotizacionValidez').value = validez.toISOString().split('T')[0];

        this.selectors.cotizacionCliente.setData(DB.getClients()
            .filter(c => !c.tipo || c.tipo.toLowerCase() === 'cliente' || c.tipo.toLowerCase() === 'ambos')
            .map(c => ({ id: c.id, text: c.nombre })));
        this.selectors.cotizacionCliente.clear();

        this.selectors.cotizacionVendedor.setData(DB.getSellers().map(s => ({ id: s.id, text: s.nombre })));
        this.selectors.cotizacionVendedor.clear();

        document.getElementById('printCotizacionBtn').classList.add('d-none');
        document.getElementById('convertFacturaBtn').classList.add('d-none');
        document.getElementById('saveCotizacionBtn').classList.remove('d-none');

        // Clear body and add initial row
        document.getElementById('cotizacionDetalleBody').innerHTML = '';
        this.addCotizacionRow();

        new bootstrap.Modal(document.getElementById('cotizacionModal')).show();
    },

    editCotizacion(id) {
        const c = DB.getCotizacion(id);
        if (!c) return;

        document.getElementById('cotizacionId').value = c.id;
        document.getElementById('cotizacionNumeroHeader').textContent = 'No. ' + (c.numero || c.id.toString().slice(-6).toUpperCase());
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

        const isConverted = !!c.factura_id;
        const convBtn = document.getElementById('convertFacturaBtn');
        const saveBtn = document.getElementById('saveCotizacionBtn');

        // Reset UI state
        saveBtn.classList.remove('d-none');
        convBtn.classList.add('d-none');

        if (isConverted) {
            saveBtn.classList.add('d-none');
            this.showToast('Esta cotización ya fue convertida y no puede editarse.', 'Info', 'info');
        } else {
            convBtn.classList.remove('d-none');
            convBtn.onclick = () => this.convertFactura(c.id);
        }

        // Render detail rows
        const body = document.getElementById('cotizacionDetalleBody');
        body.innerHTML = '';
        const details = DB.getCotizacionDetails(id);
        if (details.length === 0) {
            this.addCotizacionRow();
        } else {
            details.forEach(d => this.addCotizacionRow(d));
        }

        new bootstrap.Modal(document.getElementById('cotizacionModal')).show();
    },

    saveCotizacion() {
        try {
            const id = document.getElementById('cotizacionId').value;
            const clienteId = this.selectors.cotizacionCliente.getValue();
            const vendedorId = this.selectors.cotizacionVendedor.getValue();
            const fecha = document.getElementById('cotizacionFecha').value;
            const validez = document.getElementById('cotizacionValidez').value;
            const observacion = document.getElementById('cotizacionObservacion').value.trim();

            if (!clienteId || !fecha || !validez) {
                this.showToast('Complete todos los campos obligatorios', 'Error', 'danger');
                return;
            }

            const rows = document.querySelectorAll('#cotizacionDetalleBody tr.detalle-row');
            if (rows.length === 0) {
                this.showToast('Agregue al menos un producto', 'Error', 'danger');
                return;
            }

            const details = [];
            for (const row of rows) {
                const selectContainer = row.querySelector('[id^="cot-row-product-container-"]');
                const prodId = selectContainer ? selectContainer.dataset.productId : null;
                if (!prodId) {
                    this.showToast('Seleccione un producto para todas las líneas', 'Error', 'danger');
                    return;
                }

                const cantidad = parseInt(this.unformatNumber(row.querySelector('.row-cantidad').value)) || 0;
                const precioUnitario = parseFloat(this.unformatNumber(row.querySelector('.row-precio').value)) || 0;
                const descuento = parseFloat(this.unformatNumber(row.querySelector('.row-descuento').value)) || 0;
                const impuesto = row.querySelector('.row-impuesto').value;
                const descripcion = row.querySelector('.row-descripcion').value.trim();

                if (cantidad <= 0) {
                    this.showToast('La cantidad debe ser mayor a 0', 'Error', 'danger');
                    return;
                }

                const netSubtotal = cantidad * precioUnitario * (1 - descuento / 100);
                const taxRate = impuesto === '19%' ? 0.19 : 0.00;
                const taxAmount = netSubtotal * taxRate;

                details.push({
                    producto_id: prodId,
                    cantidad: cantidad,
                    precio_unitario: precioUnitario,
                    descuento: descuento,
                    impuesto: impuesto,
                    descripcion: descripcion,
                    subtotal: netSubtotal + taxAmount
                });
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

            DB.registerCotizacion(cotizacionData, details);
            bootstrap.Modal.getInstance(document.getElementById('cotizacionModal')).hide();
            this.showToast('Cotización guardada correctamente');
            this.navigateTo('cotizaciones');
        } catch (error) {
            console.error('Error saving cotizacion:', error);
            this.showToast(error.message, 'Error al guardar', 'danger');
        }
    },

    filterCotizaciones(query) {
        const tbody = document.getElementById('cotizacionesTableBody');
        if (!tbody) { this.navigateTo('cotizaciones'); return; }
        const allItems = DB.getCotizaciones();
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const q = (query || '').toLowerCase().trim();
        const sorted = TableSort.apply([...allItems].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)), 'cotizaciones');
        const statusFilter = TableSort._getState('cotizaciones').filter || 'todas';
        const preFiltered = statusFilter !== 'todas' ? sorted.filter(c => c.estado === statusFilter) : sorted;
        const items = q ? preFiltered.filter(c => {
            if (!c) return false;
            const client = DB.getClient(c.cliente_id);
            const ref = (c.numero || (c.id ? c.id.toString().substr(-6) : '')).toString().replace('#', '').toLowerCase();
            return ref.includes(q) || (client ? client.nombre.toLowerCase().includes(q) : false);
        }) : preFiltered;

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">${q ? `Sin resultados para "<strong>${q}</strong>"` : 'No hay cotizaciones registradas'}</td></tr>`;
            return;
        }
        tbody.innerHTML = items.map(c => {
            if (!c || !c.id) return '';
            const client = DB.getClient(c.cliente_id);
            let badgeClass = 'secondary';
            if (c.estado === 'enviada') badgeClass = 'info';
            if (c.estado === 'aceptada') badgeClass = 'success';
            if (c.estado === 'rechazada') badgeClass = 'danger';
            if (c.estado === 'vencida') badgeClass = 'warning';
            if (c.estado === 'convertida') badgeClass = 'primary';
            const ref = c.numero || c.id.toString().substr(-6).toUpperCase();
            const fechaStr = c.fecha ? (c.fecha.includes('T') ? new Date(c.fecha).toLocaleDateString('es-CO') : c.fecha) : 'Sin fecha';
            const validezStr = c.validez ? (c.validez.includes('T') ? new Date(c.validez).toLocaleDateString('es-CO') : c.validez) : '-';
            const yaConvertida = c.estado === 'convertida' || !!c.factura_id;
            return `<tr>
                <td><a href="#" onclick="event.preventDefault(); App.editCotizacion('${c.id}')" class="text-decoration-none fw-bold">${ref.replace('#', '')}</a></td>
                <td>${fechaStr}</td>
                <td><a href="#" onclick="event.preventDefault(); App.viewCliente('${c.cliente_id}')" class="text-decoration-none fw-bold">${DB.getClientName(c.cliente_id, c.cliente_nombre_alegra)}</a></td>
                <td>${validezStr}</td>
                <td><span class="badge bg-${badgeClass} text-uppercase" style="font-size:0.75rem">${c.estado || 'borrador'}</span></td>
                <td class="text-end"><strong>${fmt(c.total || 0)}</strong></td>
                <td>
                    <button class="btn-action btn-edit" onclick="App.editCotizacion('${c.id}')" title="Ver / Editar"><i class="bi bi-pencil"></i></button>
                    ${!yaConvertida ? `<button class="btn-action" style="color:#0d6efd" onclick="App.convertFactura('${c.id}')" title="Convertir a Factura"><i class="bi bi-arrow-right-circle"></i></button>` : `<button class="btn-action" style="color:#6c757d; opacity:0.5; cursor:default" title="Ya convertida"><i class="bi bi-check-circle"></i></button>`}
                    <button class="btn-action" style="color:#6c757d" onclick="App.printCotizacion('${c.id}')" title="Imprimir"><i class="bi bi-printer"></i></button>
                    ${!yaConvertida ? `<button class="btn-action btn-delete" onclick="App.deleteCotizacion('${c.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>` : ''}
                </td>
            </tr>`;
        }).join('');
    },

    filterVentas(query) {
        const tbody = document.getElementById('ventasTableBody');
        if (!tbody) { this.navigateTo('ventas'); return; }
        const baseSales = DB.getSales().sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
        const allSales = TableSort.apply(baseSales, 'ventas');
        const statusFilterV = TableSort._getState('ventas').filter || 'todas';
        const allCartera = DB.getAll(DB.KEYS.CARTERA);
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const q = (query || '').toLowerCase().trim();
        const preFiltered = statusFilterV !== 'todas' ? allSales.filter(s => s.estado === statusFilterV) : allSales;
        const sales = q ? preFiltered.filter(s => {
            if (!s) return false;
            const client = DB.getClient(s.cliente_id);
            const ref = (s.numero || (s.id ? s.id.toString().substr(-6) : '')).toString().replace('#', '').toLowerCase();
            return ref.includes(q) || (client ? client.nombre.toLowerCase().includes(q) : false);
        }) : preFiltered;

        if (sales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">${q ? `Sin resultados para "<strong>${q}</strong>"` : 'No hay facturas de venta registradas'}</td></tr>`;
            return;
        }
        tbody.innerHTML = sales.map(s => {
            if (!s || !s.id) return '';
            const client = DB.getClient(s.cliente_id);
            const carteraItem = s.tipo_venta === 'credito' ? allCartera.find(c => c.venta_id === s.id) : null;
            let stateBadge = 'secondary';
            if (s.estado === 'pagada') stateBadge = 'success';
            if (s.estado === 'pendiente') stateBadge = 'warning text-dark';
            if (s.estado === 'parcial') stateBadge = 'info';
            if (s.estado === 'anulada') stateBadge = 'danger';
            let abono = 0, saldo = 0;
            if (s.tipo_venta === 'contado') { abono = s.total; }
            else if (carteraItem) { saldo = parseFloat(carteraItem.saldo); abono = s.total - saldo; }
            else { abono = s.total; }
            const ref = s.numero || s.id.toString().substr(-6).toUpperCase();
            const fechaStr = s.fecha ? (s.fecha.includes('T') ? new Date(s.fecha).toLocaleDateString('es-CO') : s.fecha) : '-';
            return `<tr>
                <td><a href="#" onclick="event.preventDefault(); App.viewVenta('${s.id}')" class="text-decoration-none fw-bold">${ref.replace('#', '')}</a></td>
                <td>${fechaStr}</td>
                <td><a href="#" onclick="event.preventDefault(); App.viewCliente('${s.cliente_id}')" class="text-decoration-none fw-bold">${DB.getClientName(s.cliente_id, s.cliente_nombre_alegra)}</a></td>
                <td><span class="badge-status badge-${s.tipo_venta}">${s.tipo_venta}</span></td>
                <td><span class="badge bg-${stateBadge} text-uppercase" style="font-size:0.75rem">${s.estado || 'OK'}</span></td>
                <td class="text-end"><strong class="text-primary">${fmt(s.total)}</strong></td>
                <td class="text-end text-success">${fmt(abono)}</td>
                <td class="text-end text-danger fw-bold">${fmt(saldo)}</td>
                <td>
                    <button class="btn-action btn-view" onclick="App.viewVenta('${s.id}')" title="Ver detalle"><i class="bi bi-eye"></i></button>
                    ${s.estado !== 'pagada' && s.estado !== 'anulada' ? `<button class="btn-action btn-edit" onclick="App.editVenta('${s.id}')" title="Editar"><i class="bi bi-pencil"></i></button>` : ''}
                    <button class="btn-action" style="color:#6c757d" onclick="App.printVenta('${s.id}')" title="Imprimir"><i class="bi bi-printer"></i></button>
                    ${carteraItem && carteraItem.saldo > 0 ? `<button class="btn-action btn-view" style="color:#2e7d32;" onclick="App.registrarAbono('${carteraItem.id}')" title="Registrar Pago"><i class="bi bi-cash-coin"></i></button>` : ''}
                    ${s.estado !== 'anulada' ? `<button class="btn-action btn-delete" onclick="App.promptAnularVenta('${s.id}')" title="Anular"><i class="bi bi-x-circle"></i></button>` : ''}
                </td>
            </tr>`;
        }).join('');
    },

    deleteCotizacion(id) {
        const c = DB.getCotizacion(id);
        if (!c) return;
        if (c.estado === 'convertida' || c.factura_id) {
            this.showToast('No se puede eliminar una cotización ya convertida en factura.', 'Operación no permitida', 'danger');
            return;
        }
        if (!confirm(`¿Está seguro de eliminar la Cotización #${c.numero || id.toString().substr(-6).toUpperCase()}? Esta acción no se puede deshacer.`)) return;
        // Delete header and details
        DB.delete(DB.KEYS.COTIZACIONES, id);
        const allDetails = DB.getAll(DB.KEYS.COTIZACION_DETAILS).filter(d => d.cotizacion_id !== id);
        DB._persist(DB.KEYS.COTIZACION_DETAILS, allDetails);
        this.showToast('Cotización eliminada correctamente.', 'Eliminado', 'success');
        this.navigateTo('cotizaciones');
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
        const refNum = c.numero || c.id.toString().slice(-6).toUpperCase();

        const printWindow = window.open('', '_blank');
        
        let subtotalAccum = 0;
        let discountAccum = 0;
        let taxAccum = 0;
        let totalAccum = 0;
        
        details.forEach(d => {
            const qty = parseInt(d.cantidad) || 0;
            const price = parseFloat(d.precio_unitario) || 0;
            const descPercent = parseFloat(d.descuento) || 0;
            
            const rawSubtotal = qty * price;
            const discountAmt = rawSubtotal * (descPercent / 100);
            const netSubtotal = rawSubtotal - discountAmt;
            const taxRate = d.impuesto === '19%' ? 0.19 : 0.00;
            const taxAmt = netSubtotal * taxRate;
            
            subtotalAccum += rawSubtotal;
            discountAccum += discountAmt;
            taxAccum += taxAmt;
            totalAccum += (netSubtotal + taxAmt);
        });

        const html = `<!DOCTYPE html><html lang="es">
        <head><meta charset="UTF-8"><title>Cotización #${refNum}</title>
        <style>${this._getPrintStyles()}</style></head>
        <body><div class="doc-wrapper">
            <div class="doc-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0d9488; padding-bottom: 15px; margin-bottom: 25px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="LogoMas.png" alt="Logo" style="height: 50px; object-fit: contain;">
                </div>
                <div class="doc-title" style="text-align: right;">
                    <h1 style="font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 0;">COTIZACIÓN</h1>
                    <div class="ref" style="color: #0d9488; font-size: 15px; font-weight: 600; margin-top: 4px;">No. ${refNum}</div>
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
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background: #0d9488; color: white;">
                        <th style="padding: 10px 12px; font-size: 11px; text-align: center; width: 50px;">Línea</th>
                        <th style="padding: 10px 12px; font-size: 11px;">Producto o Servicio</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-align: center; width: 80px;">Cant.</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-align: right; width: 110px;">Precio Unit.</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-align: center; width: 80px;">Desc. %</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-align: center; width: 90px;">IVA</th>
                        <th style="padding: 10px 12px; font-size: 11px; text-align: right; width: 130px;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${details.map((d, index) => {
                        const p = DB.getProduct(d.producto_id);
                        const qty = parseInt(d.cantidad) || 0;
                        const price = parseFloat(d.precio_unitario) || 0;
                        const descPercent = parseFloat(d.descuento) || 0;
                        
                        const rawSubtotal = qty * price;
                        const discountAmt = rawSubtotal * (descPercent / 100);
                        const netSubtotal = rawSubtotal - discountAmt;
                        const taxRate = d.impuesto === '19%' ? 0.19 : 0.00;
                        const taxAmt = netSubtotal * taxRate;
                        
                        const subtotalVal = netSubtotal + taxAmt;
                        
                        return `<tr>
                            <td style="padding: 9px 12px; text-align: center; color: #666; border-bottom: 1px solid #e9ecef;">${index + 1}</td>
                            <td style="padding: 9px 12px; border-bottom: 1px solid #e9ecef;">
                                <strong>${p ? p.nombre : 'Producto N/A'}</strong>
                                ${p ? `<br><small style="color: #666">SKU: ${p.codigo}</small>` : ''}
                                ${d.descripcion ? `<br><small style="color: #555; font-style: italic;">${d.descripcion}</small>` : ''}
                            </td>
                            <td style="padding: 9px 12px; text-align: center; border-bottom: 1px solid #e9ecef;">${d.cantidad}</td>
                            <td style="padding: 9px 12px; text-align: right; border-bottom: 1px solid #e9ecef;">${fmt(price)}</td>
                            <td style="padding: 9px 12px; text-align: center; border-bottom: 1px solid #e9ecef;">${descPercent > 0 ? `${descPercent}%` : '-'}</td>
                            <td style="padding: 9px 12px; text-align: center; border-bottom: 1px solid #e9ecef;">${d.impuesto || 'Ninguno'}</td>
                            <td style="padding: 9px 12px; text-align: right; border-bottom: 1px solid #e9ecef;">${fmt(subtotalVal)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            <div class="totals-section" style="display: flex; justify-content: flex-end; margin-top: 10px;">
                <div class="totals-box" style="width: 300px;">
                    <div class="totals-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9ecef;"><span>Subtotal:</span><span>${fmt(subtotalAccum)}</span></div>
                    <div class="totals-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9ecef;"><span>Descuento:</span><span style="color: #dc3545; font-weight: 500;">-${fmt(discountAccum)}</span></div>
                    <div class="totals-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e9ecef;"><span>Impuestos (IVA 19%):</span><span>${fmt(taxAccum)}</span></div>
                    <div class="totals-row grand" style="display: flex; justify-content: space-between; padding-top: 10px; margin-top: 5px; font-size: 16px; font-weight: 700; color: #0d9488; border-top: 2px solid #0d9488;"><span>TOTAL COTIZACIÓN:</span><span>${fmt(totalAccum)}</span></div>
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

            this.showToast(`Factura #${savedSale.numero || savedSale.id.toString().substr(-6).toUpperCase()} creada correctamente.`);

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

    loadAllBankMovements(bankIdFilter = 'all', clientIdFilter = 'all', page = 1) {
        const area = document.getElementById('bankMovementsTableArea');
        if (!area) return;

        const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO') : '-';
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        
        let movements = DB.getAll(DB.KEYS.BANK_MOVEMENTS) || [];
        
        // Cargar otras tablas para cruzar datos
        const sales = DB.getSales();
        const compras = DB.getCompras();
        const recibos = DB.getAll(DB.KEYS.RECIBOS_CAJA) || [];
        const pagosProv = DB.getPagosProveedores() || [];
        
        // Mapear cliente_id y nombre a los movimientos
        let mappedMovements = movements.map(m => {
            let clientId = null;
            let clientName = 'N/A';
            let detailHtml = m.descripcion || '';
            const refId = String(m.referencia_id);
            
            if (m.referencia_id) {
                const sale = sales.find(s => String(s.id) === refId);
                const compra = compras.find(c => String(c.id) === refId);
                const recibo = recibos.find(r => String(r.id) === refId);
                const pago = pagosProv.find(p => String(p.id) === refId);
                
                if (sale) {
                    clientId = sale.cliente_id;
                    clientName = DB.getClientName(sale.cliente_id, sale.cliente_nombre_alegra);
                } else if (compra) {
                    clientId = compra.proveedor_id;
                    clientName = DB.getClientName(compra.proveedor_id, compra.proveedor_nombre_alegra || compra.cliente_nombre);
                } else if (recibo) {
                    clientId = recibo.cliente_id;
                    clientName = DB.getClientName(recibo.cliente_id, null);
                } else if (pago) {
                    clientId = pago.proveedor_id;
                    clientName = DB.getClientName(pago.proveedor_id, null);
                }
                
                // Formatear enlaces en el detalle
                const match = detailHtml.match(/#(?:Factura |Venta |[a-zA-Z\s]+)?([a-zA-Z0-9]+)/);
                if (match) {
                    const clickCall = m.tipo === 'ingreso' ? `App.viewVenta('${m.referencia_id}')` : `App.editCompra('${m.referencia_id}')`;
                    detailHtml = detailHtml.replace(match[0], `<a href="#" onclick="event.preventDefault(); ${clickCall}" class="text-primary fw-medium">${match[0]}</a>`);
                }
            }
            
            return {
                ...m,
                extracted_client_id: clientId,
                extracted_client_name: clientName,
                detail_html: detailHtml
            };
        });

        // Aplicar filtros
        if (bankIdFilter !== 'all') {
            mappedMovements = mappedMovements.filter(m => String(m.banco_id) === String(bankIdFilter));
        }
        if (clientIdFilter !== 'all') {
            mappedMovements = mappedMovements.filter(m => String(m.extracted_client_id) === String(clientIdFilter));
        }

        // Ordenar por fecha descendente
        mappedMovements.sort((a, b) => new Date(b.fecha || a.created_at) - new Date(a.fecha || b.created_at));

        // Paginación
        const limit = 10;
        const total = mappedMovements.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const currentPage = Math.max(1, Math.min(page, totalPages));
        const start = (currentPage - 1) * limit;
        const end = Math.min(start + limit, total);
        const paginated = mappedMovements.slice(start, end);

        let html = '';
        if (total === 0) {
            html = `<div class="text-center text-muted p-5 bg-light rounded border"><i class="bi bi-inbox fs-1 text-secondary"></i><p class="mt-2 mb-0">No se encontraron movimientos con los filtros aplicados.</p></div>`;
        } else {
            const rows = paginated.map(m => {
                const bank = DB.getBank(m.banco_id);
                const isGasto = m.tipo !== 'ingreso';
                return `<tr>
                    <td class="align-middle">${fmtDate(m.fecha)}</td>
                    <td class="align-middle"><span class="badge bg-light text-dark border"><i class="bi bi-bank me-1"></i>${bank ? bank.nombre : 'N/A'}</span></td>
                    <td class="align-middle fw-medium">${m.extracted_client_name}</td>
                    <td class="align-middle text-muted">${m.detail_html}</td>
                    <td class="align-middle text-end text-danger">${isGasto ? fmt(m.monto) : '-'}</td>
                    <td class="align-middle text-end text-success">${!isGasto ? fmt(m.monto) : '-'}</td>
                </tr>`;
            }).join('');

            html = `
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th style="width: 12%">Fecha <i class="bi bi-arrow-down-short"></i></th>
                                <th style="width: 15%">Cuenta</th>
                                <th style="width: 20%">Cliente/Proveedor</th>
                                <th style="width: 25%">Detalle/Referencia</th>
                                <th class="text-end" style="width: 14%">Egreso / Débito</th>
                                <th class="text-end" style="width: 14%">Ingreso / Crédito</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }

        // Generar controles de paginación
        let paginationHtml = '';
        if (total > 0) {
            paginationHtml = `
                <div class="d-flex justify-content-end align-items-center mt-3 border-top pt-3">
                    <span class="text-muted me-3" style="font-size: 0.85rem;">${start + 1}-${end} de ${total}</span>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-secondary" ${currentPage === 1 ? 'disabled' : ''} onclick="App.loadAllBankMovements('${bankIdFilter}', '${clientIdFilter}', ${currentPage - 1})">
                            <i class="bi bi-chevron-left"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" ${currentPage === totalPages ? 'disabled' : ''} onclick="App.loadAllBankMovements('${bankIdFilter}', '${clientIdFilter}', ${currentPage + 1})">
                            <i class="bi bi-chevron-right"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        area.innerHTML = html + paginationHtml;
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
        document.getElementById('gastoMonto').value = this.formatNumber(e.monto);
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
            inventario: 'Inventario Actual (Valorizado)',
            gastos: 'Gastos por Mes',
            rentabilidad: 'Rentabilidad Detallada',
            productos_mas_vendidos: 'Productos Más Vendidos',
            baja_rotacion: 'Productos de Baja Rotación',
            clientes_mayor_compra: 'Clientes con Mayor Compra',
            flujo_caja: 'Flujo de Caja (Movimientos Bancarios)',
            estado_resultados: 'Estado de Resultados',
            utilidad_producto: 'Utilidad por Producto',
            utilidad_cliente: 'Utilidad por Cliente',
            utilidad_vendedor: 'Utilidad por Vendedor'
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
                <div>
                    <label class="form-label" style="font-size:12px;font-weight:600">Cliente</label>
                    <select class="form-select" id="reportClienteFilter">
                        <option value="">Todos los clientes</option>
                        ${clients.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="form-label" style="font-size:12px;font-weight:600">Desde</label>
                    <input type="date" class="form-control" id="reportDesde" value="2000-01-01">
                </div>
                <div>
                    <label class="form-label" style="font-size:12px;font-weight:600">Hasta</label>
                    <input type="date" class="form-control" id="reportHasta" value="${today}">
                </div>`;
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
                html += '<th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Tipo</th><th>Total</th><th>Costo</th><th>Comisión</th><th>Utilidad</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td>${r.fecha ? r.fecha.split('T')[0] : '-'}</td><td>${r.cliente_nombre}</td><td>${r.vendedor_nombre || 'Sin Asesor'}</td><td>${r.tipo_venta}</td>
                        <td>${fmt(r.total)}</td><td>${fmt(r.total_costo)}</td><td>${fmt(r.comision_monto || 0)}</td><td class="text-success">${fmt(r.utilidad)}</td></tr>`;
                });
                const totalVentas = data.reduce((s, r) => s + parseFloat(r.total), 0);
                const totalComisiones = data.reduce((s, r) => s + parseFloat(r.comision_monto || 0), 0);
                const totalUtilidad = data.reduce((s, r) => s + parseFloat(r.utilidad), 0);
                html += `<tr class="fw-bold"><td colspan="4">TOTAL</td><td>${fmt(totalVentas)}</td><td></td><td>${fmt(totalComisiones)}</td><td class="text-success">${fmt(totalUtilidad)}</td></tr>`;
                break;
            case 'utilidad':
                html += '<th>Fecha</th><th>Venta</th><th>Costo</th><th>Utilidad</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td>${r.fecha ? r.fecha.split('T')[0] : '-'}</td><td>${fmt(r.total)}</td><td>${fmt(r.costo)}</td><td class="text-success">${fmt(r.utilidad)}</td></tr>`;
                });
                html += `<tr class="fw-bold"><td>TOTAL</td><td>${fmt(data.reduce((s, r) => s + parseFloat(r.total), 0))}</td><td>${fmt(data.reduce((s, r) => s + parseFloat(r.costo), 0))}</td><td class="text-success">${fmt(data.reduce((s, r) => s + parseFloat(r.utilidad), 0))}</td></tr>`;
                break;
            case 'cartera': {
                let vencidas30 = 0;
                let vencidas60 = 0;
                let vencidas90 = 0;
                let vencidas91 = 0;
                let noVencidas = 0;

                const todayStr = new Date().toISOString().split('T')[0];
                const todayDate = new Date(todayStr + 'T00:00:00');

                data.forEach(r => {
                    const saldo = parseFloat(r.saldo || 0);
                    if (r.fecha_vencimiento && r.fecha_vencimiento < todayStr) {
                        const vencDate = new Date(r.fecha_vencimiento + 'T00:00:00');
                        const diffTime = todayDate - vencDate;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays <= 30) {
                            r.agingCategory = 'vencidas30';
                            vencidas30 += saldo;
                        } else if (diffDays >= 31 && diffDays <= 60) {
                            r.agingCategory = 'vencidas60';
                            vencidas60 += saldo;
                        } else if (diffDays >= 61 && diffDays <= 90) {
                            r.agingCategory = 'vencidas90';
                            vencidas90 += saldo;
                        } else {
                            r.agingCategory = 'vencidas91';
                            vencidas91 += saldo;
                        }
                    } else {
                        r.agingCategory = 'noVencidas';
                        noVencidas += saldo;
                    }
                });

                const totalSaldo = data.reduce((s, r) => s + parseFloat(r.saldo || 0), 0);
                const totalOriginal = data.reduce((s, r) => s + parseFloat(r.total || 0), 0);
                const totalCobrado = totalOriginal - totalSaldo;

                this.carteraTotals = { totalOriginal, totalCobrado, totalSaldo };
                this.carteraAgingBuckets = { vencidas30, vencidas60, vencidas90, vencidas91, noVencidas };
                this.activeAgingFilter = null;

                this.renderCarteraReportView(data);
                return;
            }
            case 'inventario':
                html += '<th>Código</th><th>Nombre</th><th class="text-end">Stock</th><th class="text-end">Mín.</th><th class="text-end">P. Compra</th><th class="text-end">P. Venta</th><th class="text-end">Valor Inv.</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    const isLow = r.stock_actual <= r.stock_minimo;
                    html += `<tr><td>${r.codigo}</td><td>${r.nombre}</td>
                        <td class="text-end">${isLow ? `<span class="stock-alert">${r.stock_actual}</span>` : r.stock_actual}</td>
                        <td class="text-end">${r.stock_minimo}</td><td class="text-end">${fmt(r.precio_compra)}</td><td class="text-end">${fmt(r.precio_venta)}</td>
                        <td class="text-end">${fmt(r.valor_inventario)}</td></tr>`;
                });
                html += `<tr class="fw-bold"><td colspan="6">TOTAL INVENTARIO</td><td class="text-end">${fmt(data.reduce((s, r) => s + r.valor_inventario, 0))}</td></tr>`;
                break;
            case 'gastos':
                html += '<th>Fecha</th><th>Categoría</th><th>Descripción</th><th class="text-end">Monto</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td>${r.fecha}</td><td>${r.categoria}</td><td>${r.descripcion}</td><td class="text-end text-danger">${fmt(r.monto)}</td></tr>`;
                });
                html += `<tr class="fw-bold"><td colspan="3">TOTAL</td><td class="text-end text-danger">${fmt(data.reduce((s, r) => s + parseFloat(r.monto), 0))}</td></tr>`;
                break;
            case 'rentabilidad':
                html += '<th>Fecha</th><th>Referencia</th><th>Cliente</th><th>Vendedor</th><th class="text-end">Total Factura</th><th class="text-end">Neto sin IVA</th><th class="text-end">Costo FIFO</th><th class="text-end">Utilidad Neta</th><th class="text-end">Margen</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td>${r.fecha}</td><td><code>${r.referencia}</code></td><td>${r.cliente_nombre}</td><td>${r.vendedor_nombre}</td>
                        <td class="text-end">${fmt(r.total)}</td><td class="text-end">${fmt(r.total_neto)}</td><td class="text-end">${fmt(r.total_costo)}</td><td class="text-end text-success">${fmt(r.utilidad)}</td><td class="text-end"><span class="badge bg-info">${r.margen}</span></td></tr>`;
                });
                const rentTotalOriginal = data.reduce((s, r) => s + parseFloat(r.total), 0);
                const rentTotalNeto = data.reduce((s, r) => s + parseFloat(r.total_neto), 0);
                const rentTotalCosto = data.reduce((s, r) => s + parseFloat(r.total_costo), 0);
                const rentTotalUtil = data.reduce((s, r) => s + parseFloat(r.utilidad), 0);
                const rentMargin = rentTotalNeto > 0 ? (rentTotalUtil / rentTotalNeto * 100).toFixed(1) : 0;
                html += `<tr class="fw-bold"><td colspan="4">TOTALES</td><td class="text-end">${fmt(rentTotalOriginal)}</td><td class="text-end">${fmt(rentTotalNeto)}</td><td class="text-end">${fmt(rentTotalCosto)}</td><td class="text-end text-success">${fmt(rentTotalUtil)}</td><td class="text-end"><span class="badge bg-primary">${rentMargin}%</span></td></tr>`;
                break;
            case 'productos_mas_vendidos':
                html += '<th>Código SKU</th><th>Producto</th><th class="text-end">Unidades Vendidas</th><th class="text-end">Ingresos Netos</th><th class="text-end">Costo Total</th><th class="text-end">Utilidad</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td><code>${r.codigo}</code></td><td>${r.nombre}</td>
                        <td class="text-end fw-bold">${r.cantidad_vendida}</td><td class="text-end">${fmt(r.total_ingresos)}</td><td class="text-end">${fmt(r.total_costo)}</td><td class="text-end text-success">${fmt(r.utilidad)}</td></tr>`;
                });
                const pmasCant = data.reduce((s, r) => s + r.cantidad_vendida, 0);
                const pmasIng = data.reduce((s, r) => s + r.total_ingresos, 0);
                const pmasCost = data.reduce((s, r) => s + r.total_costo, 0);
                const pmasUtil = data.reduce((s, r) => s + r.utilidad, 0);
                html += `<tr class="fw-bold"><td colspan="2">TOTALES</td><td class="text-end">${pmasCant}</td><td class="text-end">${fmt(pmasIng)}</td><td class="text-end">${fmt(pmasCost)}</td><td class="text-end text-success">${fmt(pmasUtil)}</td></tr>`;
                break;
            case 'baja_rotacion':
                html += '<th>Código SKU</th><th>Producto</th><th class="text-end">Stock Actual</th><th class="text-end">Unidades Vendidas</th><th class="text-end">Costo Unitario</th><th class="text-end">Valor Inventario</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td><code>${r.codigo}</code></td><td>${r.nombre}</td>
                        <td class="text-end">${r.stock_actual}</td><td class="text-end fw-bold text-danger">${r.cantidad_vendida}</td><td class="text-end">${fmt(r.precio_compra)}</td><td class="text-end">${fmt(r.valor_inventario)}</td></tr>`;
                });
                const protStock = data.reduce((s, r) => s + parseFloat(r.stock_actual || 0), 0);
                const protVend = data.reduce((s, r) => s + r.cantidad_vendida, 0);
                const protVal = data.reduce((s, r) => s + r.valor_inventario, 0);
                html += `<tr class="fw-bold"><td colspan="2">TOTALES</td><td class="text-end">${protStock}</td><td class="text-end text-danger">${protVend}</td><td></td><td class="text-end">${fmt(protVal)}</td></tr>`;
                break;
            case 'clientes_mayor_compra':
                html += '<th>Documento</th><th>Cliente</th><th class="text-end">Nro Compras</th><th class="text-end">Total Comprado (Inc. IVA)</th><th class="text-end">Utilidad Generada</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td><code>${r.documento}</code></td><td>${r.nombre}</td>
                        <td class="text-end">${r.numero_compras}</td><td class="text-end fw-bold text-primary">${fmt(r.total_comprado)}</td><td class="text-end text-success">${fmt(r.total_utilidad)}</td></tr>`;
                });
                const cliNum = data.reduce((s, r) => s + r.numero_compras, 0);
                const cliComp = data.reduce((s, r) => s + r.total_comprado, 0);
                const cliUtil = data.reduce((s, r) => s + r.total_utilidad, 0);
                html += `<tr class="fw-bold"><td colspan="2">TOTALES</td><td class="text-end">${cliNum}</td><td class="text-end text-primary">${fmt(cliComp)}</td><td class="text-end text-success">${fmt(cliUtil)}</td></tr>`;
                break;
            case 'flujo_caja':
                html += '<th>Fecha</th><th>Banco/Caja</th><th>Tipo Mov.</th><th>Descripción</th><th class="text-end">Monto</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td>${r.fecha}</td><td>${r.banco_nombre}</td>
                        <td><span class="badge ${r.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'}">${r.tipo}</span></td><td>${r.descripcion}</td>
                        <td class="text-end fw-bold ${r.tipo === 'Ingreso' ? 'text-success' : 'text-danger'}">${r.tipo === 'Ingreso' ? '+' : '-'}${fmt(r.monto)}</td></tr>`;
                });
                const flowIng = data.filter(r => r.tipo === 'Ingreso').reduce((s, r) => s + r.monto, 0);
                const flowEgr = data.filter(r => r.tipo === 'Egreso').reduce((s, r) => s + r.monto, 0);
                html += `<tr class="fw-bold"><td colspan="3">NETO (Ingresos: ${fmt(flowIng)} | Egresos: ${fmt(flowEgr)})</td><td>SALDO DE FLUJO</td><td class="text-end ${flowIng >= flowEgr ? 'text-success' : 'text-danger'}">${fmt(flowIng - flowEgr)}</td></tr>`;
                break;
            case 'estado_resultados':
                html += '<th>Cuenta Financiera</th><th class="text-end">Monto Neto (COP)</th><th class="text-end">Porcentaje</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    const marginB = r.ventas_totales > 0 ? (r.utilidad_bruta / r.ventas_totales * 100).toFixed(1) : 0;
                    const marginN = r.ventas_totales > 0 ? (r.utilidad_neta / r.ventas_totales * 100).toFixed(1) : 0;
                    html += `
                        <tr><td><strong>(+) Ingresos Operacionales (Ventas antes de IVA)</strong></td><td class="text-end fw-bold text-success">${fmt(r.ventas_totales)}</td><td class="text-end">100.0%</td></tr>
                        <tr><td>(-) Costo de Ventas (COGS - FIFO)</td><td class="text-end text-muted">${fmt(r.costo_ventas)}</td><td class="text-end">-${(r.costo_ventas/r.ventas_totales*100 || 0).toFixed(1)}%</td></tr>
                        <tr class="table-light"><td><strong>(=) UTILIDAD BRUTA</strong></td><td class="text-end fw-bold text-primary">${fmt(r.utilidad_bruta)}</td><td class="text-end fw-bold">${marginB}%</td></tr>
                        <tr><td>(-) Gastos Operativos y Administrativos</td><td class="text-end text-danger">${fmt(r.gastos_operativos)}</td><td class="text-end">-${(r.gastos_operativos/r.ventas_totales*100 || 0).toFixed(1)}%</td></tr>
                        <tr class="table-dark" style="background:#111827;color:#fff;"><td><strong>(=) UTILIDAD OPERATIVA (NETA DEL PERIODO)</strong></td><td class="text-end fw-bold text-success">${fmt(r.utilidad_neta)}</td><td class="text-end fw-bold text-success">${marginN}%</td></tr>
                    `;
                });
                break;
            case 'utilidad_producto':
                html += '<th>Código SKU</th><th>Producto</th><th class="text-end">Cantidad Vendida</th><th class="text-end">Ingresos Netos</th><th class="text-end">Costo de Venta</th><th class="text-end">Utilidad Real</th><th class="text-end">Margen Neto</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    const margin = r.ingresos > 0 ? (r.utilidad / r.ingresos * 100).toFixed(1) : 0;
                    html += `<tr><td><code>${r.codigo}</code></td><td>${r.nombre}</td>
                        <td class="text-end">${r.cantidad}</td><td class="text-end">${fmt(r.ingresos)}</td><td class="text-end">${fmt(r.costo)}</td>
                        <td class="text-end text-success fw-bold">${fmt(r.utilidad)}</td><td class="text-end"><span class="badge bg-success">${margin}%</span></td></tr>`;
                });
                const uprodCant = data.reduce((s, r) => s + r.cantidad, 0);
                const uprodIng = data.reduce((s, r) => s + r.ingresos, 0);
                const uprodCost = data.reduce((s, r) => s + r.costo, 0);
                const uprodUtil = data.reduce((s, r) => s + r.utilidad, 0);
                const uprodMarg = uprodIng > 0 ? (uprodUtil / uprodIng * 100).toFixed(1) : 0;
                html += `<tr class="fw-bold"><td colspan="2">TOTALES</td><td class="text-end">${uprodCant}</td><td class="text-end">${fmt(uprodIng)}</td><td class="text-end">${fmt(uprodCost)}</td><td class="text-end text-success">${fmt(uprodUtil)}</td><td class="text-end"><span class="badge bg-primary">${uprodMarg}%</span></td></tr>`;
                break;
            case 'utilidad_cliente':
                html += '<th>Documento</th><th>Cliente</th><th class="text-end">Ventas Netas</th><th class="text-end">Costo Total</th><th class="text-end">Utilidad</th><th class="text-end">Margen</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    const margin = r.total_ventas > 0 ? (r.utilidad / r.total_ventas * 100).toFixed(1) : 0;
                    html += `<tr><td><code>${r.documento}</code></td><td>${r.cliente_nombre}</td>
                        <td class="text-end">${fmt(r.total_ventas)}</td><td class="text-end">${fmt(r.total_costo)}</td>
                        <td class="text-end text-success fw-bold">${fmt(r.utilidad)}</td><td class="text-end"><span class="badge bg-success">${margin}%</span></td></tr>`;
                });
                const ucliVent = data.reduce((s, r) => s + r.total_ventas, 0);
                const ucliCost = data.reduce((s, r) => s + r.total_costo, 0);
                const ucliUtil = data.reduce((s, r) => s + r.utilidad, 0);
                const ucliMarg = ucliVent > 0 ? (ucliUtil / ucliVent * 100).toFixed(1) : 0;
                html += `<tr class="fw-bold"><td colspan="2">TOTALES</td><td class="text-end">${fmt(ucliVent)}</td><td class="text-end">${fmt(ucliCost)}</td><td class="text-end text-success">${fmt(ucliUtil)}</td><td class="text-end"><span class="badge bg-primary">${ucliMarg}%</span></td></tr>`;
                break;
            case 'utilidad_vendedor':
                html += '<th>Asesor Comercial</th><th class="text-end">Ventas Netas</th><th class="text-end">Comisión Asesor</th><th class="text-end">Utilidad Generada</th>';
                html += '</tr></thead><tbody>';
                data.forEach(r => {
                    html += `<tr><td>${r.vendedor_nombre}</td>
                        <td class="text-end">${fmt(r.total_ventas)}</td><td class="text-end text-danger">${fmt(r.total_comision)}</td>
                        <td class="text-end text-success fw-bold">${fmt(r.utilidad)}</td></tr>`;
                });
                const uvelVent = data.reduce((s, r) => s + r.total_ventas, 0);
                const uvelCom = data.reduce((s, r) => s + r.total_comision, 0);
                const uvelUtil = data.reduce((s, r) => s + r.utilidad, 0);
                html += `<tr class="fw-bold"><td>TOTALES</td><td class="text-end">${fmt(uvelVent)}</td><td class="text-end text-danger">${fmt(uvelCom)}</td><td class="text-end text-success">${fmt(uvelUtil)}</td></tr>`;
                break;
        }

        html += '</tbody></table>';
        results.innerHTML = html;
    },

    renderCarteraReportView(data) {
        const results = document.getElementById('reportResults');
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const fmtDecimal = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

        const { vencidas30, vencidas60, vencidas90, vencidas91, noVencidas } = this.carteraAgingBuckets;
        const { totalOriginal, totalCobrado, totalSaldo } = this.carteraTotals;

        // Dynamic style for active filters
        const activeStyle = 'background: rgba(255, 87, 34, 0.05); border: 2px solid #ff5722 !important; font-weight: bold;';
        const normalStyle = 'background: #ffffff; border: 1px solid #e9ecef;';
        const activeGreenStyle = 'background: rgba(25, 135, 84, 0.05); border: 2px solid #198754 !important; font-weight: bold;';
        const normalGreenStyle = 'background: #ffffff; border: 1px solid #e9ecef;';

        const kpiHtml = `
        <style>
            .interactive-kpi-card {
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
            }
            .interactive-kpi-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
            }
        </style>
        <div class="row g-3 mb-4">
            <div class="col-md-4 col-12">
                <div class="kpi-card interactive-kpi-card p-3 shadow-sm d-flex justify-content-between align-items-center" 
                     onclick="App.filterCarteraByAging(null)"
                     style="${!this.activeAgingFilter ? activeStyle : normalStyle} border-left: 5px solid #ff5722; height: 100%;">
                    <div>
                        <div class="text-muted" style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Total por cobrar</div>
                        <div class="fw-bold mt-1" style="font-size:24px; color:#ff5722;">${fmtDecimal(totalSaldo)}</div>
                    </div>
                    <div style="font-size:28px; color:#ff5722; opacity:0.8;">
                        <i class="bi bi-wallet2"></i>
                    </div>
                </div>
            </div>
            <div class="col-md-8 col-12">
                <div class="row g-2 text-center" style="height: 100%;">
                    <div class="col-6 col-md-3">
                        <div class="kpi-card interactive-kpi-card p-2 shadow-sm d-flex flex-column justify-content-center" 
                             onclick="App.filterCarteraByAging('vencidas30')"
                             style="${this.activeAgingFilter === 'vencidas30' ? activeStyle : normalStyle} height: 100%;">
                            <div class="text-muted mb-1" style="font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.3px; line-height:1.2;">Vencidas ≤30 días</div>
                            <div class="fw-bold fs-6 text-danger">${fmt(vencidas30)}</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="kpi-card interactive-kpi-card p-2 shadow-sm d-flex flex-column justify-content-center" 
                             onclick="App.filterCarteraByAging('vencidas60')"
                             style="${this.activeAgingFilter === 'vencidas60' ? activeStyle : normalStyle} height: 100%;">
                            <div class="text-muted mb-1" style="font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.3px; line-height:1.2;">Vencidas 31-60</div>
                            <div class="fw-bold fs-6 text-danger">${fmt(vencidas60)}</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="kpi-card interactive-kpi-card p-2 shadow-sm d-flex flex-column justify-content-center" 
                             onclick="App.filterCarteraByAging('vencidas90')"
                             style="${this.activeAgingFilter === 'vencidas90' ? activeStyle : normalStyle} height: 100%;">
                            <div class="text-muted mb-1" style="font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.3px; line-height:1.2;">Vencidas 61-90</div>
                            <div class="fw-bold fs-6 text-danger">${fmt(vencidas90)}</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="kpi-card interactive-kpi-card p-2 shadow-sm d-flex flex-column justify-content-center" 
                             onclick="App.filterCarteraByAging('vencidas91')"
                             style="${this.activeAgingFilter === 'vencidas91' ? activeStyle : normalStyle} height: 100%;">
                            <div class="text-muted mb-1" style="font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.3px; line-height:1.2;">Vencidas 91+</div>
                            <div class="fw-bold fs-6 text-danger">${fmt(vencidas91)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="row g-3 mb-4">
            <div class="col-12">
                <div class="kpi-card interactive-kpi-card p-3 shadow-sm d-flex justify-content-between align-items-center" 
                     onclick="App.filterCarteraByAging('noVencidas')"
                     style="${this.activeAgingFilter === 'noVencidas' ? activeGreenStyle : normalGreenStyle} border-left: 5px solid #198754;">
                    <div>
                        <div class="text-muted" style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">No vencidas</div>
                        <div class="fw-bold mt-1 text-success" style="font-size:20px;">${fmt(noVencidas)}</div>
                    </div>
                    <div style="font-size:24px; color:#198754; opacity:0.8;">
                        <i class="bi bi-shield-check"></i>
                    </div>
                </div>
            </div>
        </div>
        <div id="carteraTableContainer"></div>`;

        results.innerHTML = kpiHtml;
        this.renderCarteraTable(data);
    },

    filterCarteraByAging(range) {
        if (this.activeAgingFilter === range) {
            this.activeAgingFilter = null;
        } else {
            this.activeAgingFilter = range;
        }
        this.renderCarteraReportView(this.currentReportData);
    },

    renderCarteraTable(data) {
        const tableContainer = document.getElementById('carteraTableContainer');
        if (!tableContainer) return;

        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const todayStr = new Date().toISOString().split('T')[0];

        let filteredData = data;
        if (this.activeAgingFilter) {
            filteredData = data.filter(r => r.agingCategory === this.activeAgingFilter);
        }

        if (filteredData.length === 0) {
            tableContainer.innerHTML = '<p class="text-muted text-center py-4">No se encontraron facturas para este rango de vencimiento</p>';
            return;
        }

        let html = '<div class="table-responsive"><table class="table-modern"><thead><tr>';
        html += '<th>Número</th><th>Tipo de documento</th><th>Cliente</th><th>Creación</th><th>Vencimiento</th><th>Total</th><th>Cobrado</th><th>Por cobrar</th>';
        html += '</tr></thead><tbody>';

        filteredData.forEach(r => {
            const cobrado = parseFloat(r.total || 0) - parseFloat(r.saldo || 0);
            html += `<tr>
                <td><code>#${r.numero || r.id_alegra_factura || '-'}</code></td>
                <td>Factura de venta</td>
                <td><strong>${r.cliente_nombre}</strong></td>
                <td>${r.fecha_emision || r.fecha || '-'}</td>
                <td class="${r.fecha_vencimiento < todayStr ? 'text-danger fw-bold' : ''}">${r.fecha_vencimiento || '-'}</td>
                <td>${fmt(r.total)}</td>
                <td>${fmt(cobrado)}</td>
                <td class="fw-bold text-primary">${fmt(r.saldo)}</td>
            </tr>`;
        });

        const totalSaldoFiltered = filteredData.reduce((s, r) => s + parseFloat(r.saldo || 0), 0);
        const totalOriginalFiltered = filteredData.reduce((s, r) => s + parseFloat(r.total || 0), 0);
        const totalCobradoFiltered = totalOriginalFiltered - totalSaldoFiltered;

        const totalText = this.activeAgingFilter ? 'TOTAL FILTRADO' : 'TOTALES';
        html += `<tr class="fw-bold"><td colspan="5">${totalText}</td><td>${fmt(totalOriginalFiltered)}</td><td>${fmt(totalCobradoFiltered)}</td><td class="text-primary">${fmt(totalSaldoFiltered)}</td></tr>`;
        html += '</tbody></table></div>';

        tableContainer.innerHTML = html;
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
                'Fecha': r.fecha ? r.fecha.split('T')[0] : '-',
                'Cliente': r.cliente_nombre,
                'Vendedor': r.vendedor_nombre,
                'Tipo': r.tipo_venta,
                'Total': r.total,
                'Costo': r.total_costo,
                'Comision': r.comision_monto,
                'Utilidad': r.utilidad
            }));
        } else if (this.currentReportType === 'cartera') {
            exportData = this.currentReportData.map(r => ({
                'Número': r.numero || r.id_alegra_factura || '-',
                'Tipo de documento': 'Factura de venta',
                'Cliente': r.cliente_nombre,
                'Creación': r.fecha_emision || r.fecha || '-',
                'Vencimiento': r.fecha_vencimiento || '-',
                'Total': r.total,
                'Cobrado': parseFloat(r.total || 0) - parseFloat(r.saldo || 0),
                'Por cobrar': r.saldo
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
                'Fecha': r.fecha ? r.fecha.split('T')[0] : '-',
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
        } else if (this.currentReportType === 'rentabilidad') {
            exportData = this.currentReportData.map(r => ({
                'Fecha': r.fecha,
                'Referencia': r.referencia,
                'Cliente': r.cliente_nombre,
                'Vendedor': r.vendedor_nombre,
                'Total con IVA': r.total,
                'Neto sin IVA': r.total_neto,
                'Costo FIFO': r.total_costo,
                'Utilidad Neta': r.utilidad,
                'Porcentaje Margen': r.margen
            }));
        } else if (this.currentReportType === 'productos_mas_vendidos') {
            exportData = this.currentReportData.map(r => ({
                'Código SKU': r.codigo,
                'Producto': r.nombre,
                'Cantidad Vendida': r.cantidad_vendida,
                'Ingresos Netos': r.total_ingresos,
                'Costo Total': r.total_costo,
                'Utilidad': r.utilidad
            }));
        } else if (this.currentReportType === 'baja_rotacion') {
            exportData = this.currentReportData.map(r => ({
                'Código SKU': r.codigo,
                'Producto': r.nombre,
                'Stock Actual': r.stock_actual,
                'Cantidad Vendida': r.cantidad_vendida,
                'Costo Unitario': r.precio_compra,
                'Valor de Inventario': r.valor_inventario
            }));
        } else if (this.currentReportType === 'clientes_mayor_compra') {
            exportData = this.currentReportData.map(r => ({
                'Documento': r.documento,
                'Cliente': r.nombre,
                'Número Compras': r.numero_compras,
                'Total Comprado (IVA Inc)': r.total_comprado,
                'Utilidad Generada': r.total_utilidad
            }));
        } else if (this.currentReportType === 'flujo_caja') {
            exportData = this.currentReportData.map(r => ({
                'Fecha': r.fecha,
                'Banco/Caja': r.banco_nombre,
                'Tipo Movimiento': r.tipo,
                'Descripción': r.descripcion,
                'Monto': r.monto
            }));
        } else if (this.currentReportType === 'estado_resultados') {
            exportData = this.currentReportData.map(r => ({
                'Ventas Totales Netas': r.ventas_totales,
                'Costo de Ventas (COGS)': r.costo_ventas,
                'Utilidad Bruta': r.utilidad_bruta,
                'Gastos Operativos': r.gastos_operativos,
                'Utilidad Neta del Periodo': r.utilidad_neta
            }));
        } else if (this.currentReportType === 'utilidad_producto') {
            exportData = this.currentReportData.map(r => ({
                'Código SKU': r.codigo,
                'Producto': r.nombre,
                'Cantidad Vendida': r.cantidad,
                'Ingresos Netos': r.ingresos,
                'Costo de Venta': r.costo,
                'Utilidad Real': r.utilidad,
                'Margen Neto': (r.utilidad / r.ingresos * 100 || 0).toFixed(1) + '%'
            }));
        } else if (this.currentReportType === 'utilidad_cliente') {
            exportData = this.currentReportData.map(r => ({
                'Documento': r.documento,
                'Cliente': r.cliente_nombre,
                'Ventas Netas': r.total_ventas,
                'Costo Total': r.total_costo,
                'Utilidad': r.utilidad,
                'Margen': (r.utilidad / r.total_ventas * 100 || 0).toFixed(1) + '%'
            }));
        } else if (this.currentReportType === 'utilidad_vendedor') {
            exportData = this.currentReportData.map(r => ({
                'Asesor Comercial': r.vendedor_nombre,
                'Ventas Netas': r.total_ventas,
                'Comisión Comercial': r.total_comision,
                'Utilidad Generada': r.utilidad
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

    async importFromLocalJSON() {
        const btn = document.getElementById('importJsonBtn');
        btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Importando...';
        btn.disabled = true;

        try {
            const res = await fetch('datos_alegra.json');
            if (!res.ok) throw new Error('No se pudo encontrar o leer el archivo datos_alegra.json. Asegúrese de haber ejecutado los scripts de Python.');
            const data = await res.json();

            // 1. Importar Clientes
            const importedClients = data.clientes || [];
            let clients = DB.getAll(DB.KEYS.CLIENTS) || [];
            let cCount = 0;
            importedClients.forEach(c => {
                const existingIdx = clients.findIndex(cli => 
                    (cli.id_alegra && String(cli.id_alegra) === String(c.id_alegra)) || 
                    (c.nit_rut && String(cli.documento) === String(c.nit_rut))
                );

                const clientData = {
                    nombre: c.nombre,
                    documento: c.nit_rut,
                    tipo_doc: c.tipo_documento || 'NIT',
                    email: c.email || '',
                    telefono: c.telefono || '',
                    direccion: c.direccion || '',
                    ciudad: c.ciudad || '',
                    departamento: c.departamento || '',
                    pais: c.pais || 'Colombia',
                    barrio: c.barrio || '',
                    codigo_postal: c.codigo_postal || '',
                    regimen: c.regimen_tributario || 'Simplificado',
                    id_alegra: String(c.id_alegra),
                    tipo: 'ambos',
                    estado: c.estado || 'Activo',
                    cupo_credito: parseFloat(c.cupo_credito || 0),
                    plazo_pago: parseInt(c.plazo_pago || 30),
                    observaciones: c.observaciones || '',
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

            // 2. Importar Productos
            const importedProducts = data.productos_y_inventario || [];
            let products = DB.getAll(DB.KEYS.PRODUCTS) || [];
            let pCount = 0;
            importedProducts.forEach(p => {
                const existingIdx = products.findIndex(prod => 
                    (prod.id_alegra && String(prod.id_alegra) === String(p.id_alegra)) ||
                    (p.referencia_sku && String(prod.codigo) === String(p.referencia_sku))
                );

                const productData = {
                    codigo: String(p.referencia_sku || p.id_alegra),
                    nombre: p.nombre,
                    precio_compra: parseFloat(p.costo_unitario || 0),
                    precio_venta: parseFloat(p.precio_venta || 0),
                    stock_actual: p.stock_actual === 'No aplica' ? 0 : parseFloat(p.stock_actual || 0),
                    stock_minimo: 5,
                    categoria: p.categoria || '',
                    unidad_medida: p.unidad_medida || 'Unidad',
                    ubicacion_bodega: p.ubicacion_bodega || '',
                    id_alegra: String(p.id_alegra),
                    estado: p.estado || 'Activo',
                    observaciones: p.observaciones || '',
                    updated_at: new Date().toISOString()
                };

                if (existingIdx >= 0) {
                    products[existingIdx] = { ...products[existingIdx], ...productData };
                } else {
                    products.push({ id: DB.genId(), created_at: new Date().toISOString(), ...productData });
                }
                pCount++;
            });
            DB._persist(DB.KEYS.PRODUCTS, products);

            // 3. Importar Cuentas Bancarias
            const importedBanks = data.cuentas_bancarias || [];
            if (importedBanks.length > 0) {
                let banks = DB.getAll(DB.KEYS.BANKS) || [];
                importedBanks.forEach(b => {
                    const existingIdx = banks.findIndex(bank => 
                        (bank.id_alegra && String(bank.id_alegra) === String(b.id)) ||
                        (b.name && bank.nombre.toLowerCase().trim() === b.name.toLowerCase().trim())
                    );
                    const bankData = {
                        nombre: b.name,
                        id_alegra: String(b.id),
                        saldo_actual: parseFloat(b.initialBalance || 0),
                        tipo: b.type,
                        updated_at: new Date().toISOString()
                    };
                    if (existingIdx >= 0) {
                        banks[existingIdx] = { ...banks[existingIdx], ...bankData };
                    } else {
                        banks.push({ id: DB.genId(), ...bankData });
                    }
                });
                DB._persist(DB.KEYS.BANKS, banks);
            }

            // 4. Importar Movimientos Bancarios
            const importedMovements = data.movimientos_bancarios || [];
            if (importedMovements.length > 0) {
                let dbMovements = DB.getAll(DB.KEYS.BANK_MOVEMENTS) || [];
                importedMovements.forEach(m => {
                    const existingIdx = dbMovements.findIndex(mov => String(mov.id_alegra) === String(m.id));
                    const bankAccountName = m.bankAccount ? m.bankAccount.name : 'Caja/Banco';
                    const movData = {
                        id_alegra: String(m.id),
                        fecha: m.date,
                        tipo: m.type === 'in' ? 'ingreso' : 'egreso',
                        monto: parseFloat(m.amount || 0),
                        cuenta: bankAccountName,
                        descripcion: m.observations || 'Importado desde Alegra',
                        referencia: m.paymentMethod || 'Transferencia',
                        updated_at: new Date().toISOString()
                    };
                    if (existingIdx >= 0) {
                        dbMovements[existingIdx] = { ...dbMovements[existingIdx], ...movData };
                    } else {
                        dbMovements.push({ id: DB.genId(), ...movData });
                    }
                });
                DB._persist(DB.KEYS.BANK_MOVEMENTS, dbMovements);
            }

            // 5. Importar Cuentas por Cobrar (Cartera)
            const importedCartera = (data.cuentas_por_cobrar || []).filter(c => c.status !== 'draft' && c.status !== 'void');
            const importedFacturasVenta = (data.facturas_venta || []).filter(f => f.estado !== 'draft' && f.estado !== 'void');
            
            // Unificar cartera con saldo (activa) y facturas pagadas del histórico para poblar el filtro
            const allCarteraItems = [...importedCartera];
            importedFacturasVenta.forEach(f => {
                if (parseFloat(f.saldo || 0) <= 0) {
                    if (!allCarteraItems.some(item => String(item.id_factura) === String(f.id_alegra))) {
                        allCarteraItems.push({
                            id_factura: f.id_alegra,
                            numero: f.numero,
                            fecha_emision: f.fecha_emision,
                            fecha_vencimiento: f.fecha_vencimiento,
                            cliente_id: f.cliente_id_alegra,
                            cliente_nombre: f.cliente_nombre,
                            nit_rut: f.cliente_nit,
                            total: parseFloat(f.total || 0),
                            saldo: parseFloat(f.saldo || 0),
                            status: 'pagada'
                        });
                    }
                }
            });

            if (allCarteraItems.length > 0) {
                let dbCartera = DB.getAll(DB.KEYS.CARTERA) || [];
                
                // Prunar de la base de datos local cualquier factura previa de Alegra que no esté en la lista limpia (eliminando borradores y anulados)
                dbCartera = dbCartera.filter(car => {
                    if (!car.id_alegra_factura) return true;
                    return allCarteraItems.some(item => String(item.id_factura) === String(car.id_alegra_factura));
                });

                allCarteraItems.forEach(c => {
                    const existingIdx = dbCartera.findIndex(car => String(car.id_alegra_factura) === String(c.id_factura));
                    
                    const clients = DB.getAll(DB.KEYS.CLIENTS) || [];
                    const localClient = clients.find(cli => 
                        (cli.id_alegra && String(cli.id_alegra) === String(c.cliente_id)) ||
                        (cli.documento && String(cli.documento) === String(c.nit_rut))
                    );

                    const carteraData = {
                        id_alegra_factura: String(c.id_factura),
                        venta_id: String(c.id_factura),
                        numero: c.numero,
                        cliente_id: localClient ? localClient.id : DB.genId(),
                        fecha_emision: c.fecha_emision,
                        fecha_vencimiento: c.fecha_vencimiento,
                        total: parseFloat(c.total || 0),
                        saldo: parseFloat(c.saldo || 0),
                        estado: c.status || 'abierta',
                        updated_at: new Date().toISOString()
                    };

                    if (existingIdx >= 0) {
                        dbCartera[existingIdx] = { ...dbCartera[existingIdx], ...carteraData };
                    } else {
                        dbCartera.push({ id: DB.genId(), ...carteraData });
                    }
                });
                DB._persist(DB.KEYS.CARTERA, dbCartera);
            }

            // 6. Importar Facturas Completas (Histórico Total Alegra)
            const importedFacturas = (data.facturas_venta || []).filter(f => f.estado !== 'draft' && f.estado !== 'void');
            if (importedFacturas.length > 0) {
                let dbFacturas = DB.getAll(DB.KEYS.FACTURAS_ALEGRA) || [];
                
                // Prunar borradores y anuladas
                dbFacturas = dbFacturas.filter(f => {
                    if (!f.id_alegra) return true;
                    return importedFacturas.some(item => String(item.id_alegra) === String(f.id_alegra));
                });

                importedFacturas.forEach(f => {
                    const existingIdx = dbFacturas.findIndex(r => String(r.id_alegra) === String(f.id_alegra));
                    if (existingIdx >= 0) {
                        dbFacturas[existingIdx] = { ...dbFacturas[existingIdx], ...f, updated_at: new Date().toISOString() };
                    } else {
                        dbFacturas.push({ id: DB.genId(), created_at: new Date().toISOString(), ...f });
                    }
                });
                DB._persist(DB.KEYS.FACTURAS_ALEGRA, dbFacturas);

                // Auto-registrar clientes de facturas que no existen en cg_clients
                let dbClients = DB.getAll(DB.KEYS.CLIENTS) || [];
                let newClientsAdded = 0;
                importedFacturas.forEach(f => {
                    if (!f.cliente_id_alegra || !f.cliente_nombre) return;
                    const exists = dbClients.some(cli =>
                        (cli.id_alegra && String(cli.id_alegra) === String(f.cliente_id_alegra)) ||
                        (cli.documento && f.cliente_nit && String(cli.documento) === String(f.cliente_nit))
                    );
                    if (!exists) {
                        dbClients.push({
                            id: DB.genId(),
                            nombre: f.cliente_nombre,
                            documento: f.cliente_nit || '',
                            tipo_doc: 'NIT',
                            id_alegra: String(f.cliente_id_alegra),
                            tipo: 'cliente',
                            estado: 'Activo',
                            cupo_credito: 0,
                            plazo_dias: 30,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                        newClientsAdded++;
                    }
                });
                if (newClientsAdded > 0) {
                    DB._persist(DB.KEYS.CLIENTS, dbClients);
                    console.log(`Import: ${newClientsAdded} clientes nuevos auto-registrados desde facturas.`);
                }
            }

            // 7. Importar Cotizaciones / Estimaciones
            const importedCotizaciones = data.cotizaciones || [];
            let cotCount = 0;
            if (importedCotizaciones.length > 0) {
                let dbCots = DB.getAll(DB.KEYS.COTIZACIONES_ALEGRA) || [];
                importedCotizaciones.forEach(c => {
                    const existingIdx = dbCots.findIndex(r => String(r.id_alegra) === String(c.id_alegra));
                    if (existingIdx >= 0) {
                        dbCots[existingIdx] = { ...dbCots[existingIdx], ...c, updated_at: new Date().toISOString() };
                    } else {
                        dbCots.push({ id: DB.genId(), created_at: new Date().toISOString(), ...c });
                    }
                    cotCount++;
                });
                DB._persist(DB.KEYS.COTIZACIONES_ALEGRA, dbCots);
            }

            // 8. Importar Vendedores
            const importedVendedores = data.vendedores || [];
            let vCount = 0;
            if (importedVendedores.length > 0) {
                let dbSellers = DB.getAll(DB.KEYS.SELLERS) || [];
                importedVendedores.forEach(v => {
                    const existingIdx = dbSellers.findIndex(s =>
                        (s.id_alegra && String(s.id_alegra) === String(v.id_alegra)) ||
                        (v.nombre && s.nombre && s.nombre.toLowerCase().trim() === v.nombre.toLowerCase().trim())
                    );
                    const sellerData = {
                        nombre: v.nombre,
                        email: v.email || '',
                        identificacion: v.identificacion || '',
                        id_alegra: String(v.id_alegra),
                        estado: v.estado || 'Activo',
                        comision_porcentaje: 0,
                        updated_at: new Date().toISOString()
                    };
                    if (existingIdx >= 0) {
                        dbSellers[existingIdx] = { ...dbSellers[existingIdx], ...sellerData };
                    } else {
                        dbSellers.push({ id: DB.genId(), created_at: new Date().toISOString(), ...sellerData });
                    }
                    vCount++;
                });
                DB._persist(DB.KEYS.SELLERS, dbSellers);
            }

            const logsDiv = document.getElementById('integrationLogs');
            if (logsDiv) {
                logsDiv.innerHTML = `<div class="alert alert-success py-2 mb-2"><i class="bi bi-check-circle me-1"></i> <strong>Éxito Importación Espejo Total:</strong> ${cCount} contactos, ${pCount} productos, ${importedBanks.length} bancos, ${importedMovements.length} movimientos, ${importedCartera.length} CxC, ${importedFacturas.length} facturas históricas, ${cotCount} cotizaciones, ${vCount} vendedores. (${new Date().toLocaleString()})</div>` + (logsDiv.innerHTML.includes('No hay') ? '' : logsDiv.innerHTML);
            }
            this.showToast('Importación espejo total completada con éxito.', 'Éxito', 'success');
        } catch (error) {
            console.error(error);
            this.showToast(error.message, 'Error de Importación', 'danger');
            const logsDiv = document.getElementById('integrationLogs');
            if (logsDiv) {
                logsDiv.innerHTML = `<div class="alert alert-danger py-2 mb-2"><i class="bi bi-x-circle me-1"></i> Error Importación Local: ${error.message} (${new Date().toLocaleString()})</div>` + (logsDiv.innerHTML.includes('No hay') ? '' : logsDiv.innerHTML);
            }
        } finally {
            btn.innerHTML = '<i class="bi bi-file-earmark-arrow-up me-1"></i> Importar desde datos_alegra.json';
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
            const ref = sale ? '#' + (sale.numero || sale.id.toString().substr(-6).toUpperCase()) : f.venta_id || '-';

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
            const ref = sale ? '#' + (sale.numero || sale.id.toString().slice(-6).toUpperCase()) : '-';
            return `<tr>
                <td>${ref}</td>
                <td>${fmt(d.monto_aplicado)}</td>
            </tr>`;
        }).join('');

        const ref = recibo.numero || recibo.id.toString().slice(-6).toUpperCase();
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
                ${(recibo.observacion || recibo.observaciones || recibo.nota) ? `<p class="mb-1"><strong>Observación:</strong> ${recibo.observacion || recibo.observaciones || recibo.nota}</p>` : ''}
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
                return { id: s.id, text: `Factura #${s.numero || s.id.toString().substr(-6).toUpperCase()} - ${client ? client.nombre : 'N/A'}` };
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
                    <p><strong>Factura Origen:</strong> <a href="#" onclick="event.preventDefault(); bootstrap.Modal.getInstance(document.getElementById('devolucionDetailModal')).hide(); App.viewVenta('${sale ? sale.id : ''}')" class="text-decoration-none fw-bold">#${sale ? (sale.numero || sale.id.toString().substr(-6).toUpperCase()) : 'N/A'}</a></p>
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
    },

    /* =================================================
       INLINE EDITABLE DETAILS HELPERS
       ================================================= */
    addCotizacionRow(data = {}) {
        const body = document.getElementById('cotizacionDetalleBody');
        const rowIndex = body.querySelectorAll('tr.detalle-row').length;
        
        const row = document.createElement('tr');
        row.className = 'detalle-row';
        row.dataset.rowIndex = rowIndex;
        
        row.innerHTML = `
            <td class="align-middle text-center" style="width: 40px;">
                <input type="checkbox" class="form-check-input select-row-chk">
                <span class="row-num ms-1">${rowIndex + 1}</span>
            </td>
            <td class="align-middle" style="min-width: 250px;">
                <div id="cot-row-product-container-${rowIndex}"></div>
                <div class="row-sku-description mt-1 d-flex align-items-center gap-2" style="font-size: 11px;">
                    <span class="product-sku text-muted">SKU: -</span>
                    <a href="#" class="add-desc-link text-decoration-none" onclick="event.preventDefault(); App.showRowDescriptionModal(this)">
                        <i class="bi bi-pencil-square"></i> Agregar descripción
                    </a>
                    <input type="hidden" class="row-descripcion" value="${data.descripcion || ''}">
                </div>
            </td>
            <td class="align-middle" style="width: 90px;">
                <input type="text" class="form-control form-control-sm text-end number-format row-cantidad" value="${data.cantidad || 1}" inputmode="numeric">
                <div class="row-stock text-muted text-center mt-1" style="font-size: 10px; display: none;">Disp: <span class="stock-val">0</span></div>
            </td>
            <td class="align-middle" style="width: 140px;">
                <div class="input-group input-group-sm">
                    <span class="input-group-text">$</span>
                    <input type="text" class="form-control text-end number-format row-precio" value="${this.formatNumber(data.precio_unitario || 0)}" inputmode="numeric">
                </div>
            </td>
            <td class="align-middle" style="width: 100px;">
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control text-end number-format row-descuento" value="${this.formatNumber(data.descuento || 0)}" inputmode="numeric">
                    <span class="input-group-text">%</span>
                </div>
            </td>
            <td class="align-middle" style="width: 120px;">
                <select class="form-select form-select-sm row-impuesto">
                    <option value="Ninguno" ${data.impuesto === 'Ninguno' ? 'selected' : ''}>Ninguno</option>
                    <option value="19%" ${data.impuesto === '19%' ? 'selected' : ''}>19% IVA</option>
                </select>
            </td>
            <td class="align-middle text-end fw-bold row-subtotal text-dark" style="width: 140px; font-size: 14px;">
                $0
            </td>
            <td class="align-middle text-center" style="width: 40px;">
                <button type="button" class="btn btn-link text-danger p-0 delete-row-btn" onclick="App.deleteDetailRow(this, 'cotizacion')">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        body.appendChild(row);
        
        const productsData = DB.getProducts().map(p => ({
            id: p.id,
            text: p.nombre,
            reference: p.codigo
        }));
        
        const selectContainerId = `cot-row-product-container-${rowIndex}`;
        const select = new SearchableSelect(selectContainerId, {
            data: productsData,
            placeholder: 'Selecciona un producto',
            onSelect: (val) => {
                const product = DB.getProduct(val);
                if (product) {
                    row.querySelector('.product-sku').textContent = `SKU: ${product.codigo}`;
                    row.querySelector('.row-precio').value = this.formatNumber(product.precio_venta);
                    
                    const stockVal = row.querySelector('.stock-val');
                    stockVal.textContent = product.stock_actual;
                    row.querySelector('.row-stock').style.display = 'block';
                    
                    document.getElementById(selectContainerId).dataset.productId = val;
                    this.recalcRowSubtotal(row, 'cotizacion');
                }
            }
        });
        row.productSelectorInstance = select;
        
        if (data.producto_id) {
            select.setValue(data.producto_id);
            document.getElementById(selectContainerId).dataset.productId = data.producto_id;
            
            const product = DB.getProduct(data.producto_id);
            if (product) {
                row.querySelector('.product-sku').textContent = `SKU: ${product.codigo}`;
                const stockVal = row.querySelector('.stock-val');
                stockVal.textContent = product.stock_actual;
                row.querySelector('.row-stock').style.display = 'block';
            }
            if (data.descripcion) {
                row.querySelector('.add-desc-link').innerHTML = `<i class="bi bi-pencil-fill"></i> Editar descripción`;
            }
        }
        
        row.querySelector('.row-cantidad').addEventListener('input', () => this.recalcRowSubtotal(row, 'cotizacion'));
        row.querySelector('.row-precio').addEventListener('input', () => this.recalcRowSubtotal(row, 'cotizacion'));
        row.querySelector('.row-descuento').addEventListener('input', () => this.recalcRowSubtotal(row, 'cotizacion'));
        row.querySelector('.row-impuesto').addEventListener('change', () => this.recalcRowSubtotal(row, 'cotizacion'));
        
        this.recalcRowSubtotal(row, 'cotizacion');
    },

    addVentaRow(data = {}) {
        const body = document.getElementById('ventaDetalleBody');
        const rowIndex = body.querySelectorAll('tr.detalle-row').length;
        
        const row = document.createElement('tr');
        row.className = 'detalle-row';
        row.dataset.rowIndex = rowIndex;
        
        row.innerHTML = `
            <td class="align-middle text-center" style="width: 40px;">
                <input type="checkbox" class="form-check-input select-row-chk">
                <span class="row-num ms-1">${rowIndex + 1}</span>
            </td>
            <td class="align-middle" style="min-width: 250px;">
                <div id="vta-row-product-container-${rowIndex}"></div>
                <div class="row-sku-description mt-1 d-flex align-items-center gap-2" style="font-size: 11px;">
                    <span class="product-sku text-muted">SKU: -</span>
                    <a href="#" class="add-desc-link text-decoration-none" onclick="event.preventDefault(); App.showRowDescriptionModal(this)">
                        <i class="bi bi-pencil-square"></i> Agregar descripción
                    </a>
                    <input type="hidden" class="row-descripcion" value="${data.descripcion || ''}">
                </div>
            </td>
            <td class="align-middle" style="width: 90px;">
                <input type="text" class="form-control form-control-sm text-end number-format row-cantidad" value="${data.cantidad || 1}" inputmode="numeric">
                <div class="row-stock text-muted text-center mt-1" style="font-size: 10px; display: none;">Disp: <span class="stock-val">0</span></div>
            </td>
            <td class="align-middle" style="width: 140px;">
                <div class="input-group input-group-sm">
                    <span class="input-group-text">$</span>
                    <input type="text" class="form-control text-end number-format row-precio" value="${this.formatNumber(data.precio_unitario || 0)}" inputmode="numeric">
                </div>
            </td>
            <td class="align-middle" style="width: 100px;">
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control text-end number-format row-descuento" value="${this.formatNumber(data.descuento || 0)}" inputmode="numeric">
                    <span class="input-group-text">%</span>
                </div>
            </td>
            <td class="align-middle" style="width: 120px;">
                <select class="form-select form-select-sm row-impuesto">
                    <option value="Ninguno" ${data.impuesto === 'Ninguno' ? 'selected' : ''}>Ninguno</option>
                    <option value="19%" ${data.impuesto === '19%' ? 'selected' : ''}>19% IVA</option>
                </select>
            </td>
            <td class="align-middle text-end fw-bold row-subtotal text-dark" style="width: 140px; font-size: 14px;">
                $0
            </td>
            <td class="align-middle text-center" style="width: 40px;">
                <button type="button" class="btn btn-link text-danger p-0 delete-row-btn" onclick="App.deleteDetailRow(this, 'venta')">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        body.appendChild(row);
        
        const productsData = DB.getProducts().map(p => ({
            id: p.id,
            text: p.nombre,
            reference: p.codigo
        }));
        
        const selectContainerId = `vta-row-product-container-${rowIndex}`;
        const select = new SearchableSelect(selectContainerId, {
            data: productsData,
            placeholder: 'Selecciona un producto',
            onSelect: (val) => {
                const product = DB.getProduct(val);
                if (product) {
                    row.querySelector('.product-sku').textContent = `SKU: ${product.codigo}`;
                    row.querySelector('.row-precio').value = this.formatNumber(product.precio_venta);
                    
                    const stockVal = row.querySelector('.stock-val');
                    stockVal.textContent = product.stock_actual;
                    row.querySelector('.row-stock').style.display = 'block';
                    
                    document.getElementById(selectContainerId).dataset.productId = val;
                    this.recalcRowSubtotal(row, 'venta');
                }
            }
        });
        row.productSelectorInstance = select;
        
        if (data.producto_id) {
            select.setValue(data.producto_id);
            document.getElementById(selectContainerId).dataset.productId = data.producto_id;
            
            const product = DB.getProduct(data.producto_id);
            if (product) {
                row.querySelector('.product-sku').textContent = `SKU: ${product.codigo}`;
                const stockVal = row.querySelector('.stock-val');
                stockVal.textContent = product.stock_actual;
                row.querySelector('.row-stock').style.display = 'block';
            }
            if (data.descripcion) {
                row.querySelector('.add-desc-link').innerHTML = `<i class="bi bi-pencil-fill"></i> Editar descripción`;
            }
        }
        
        row.querySelector('.row-cantidad').addEventListener('input', () => this.recalcRowSubtotal(row, 'venta'));
        row.querySelector('.row-precio').addEventListener('input', () => this.recalcRowSubtotal(row, 'venta'));
        row.querySelector('.row-descuento').addEventListener('input', () => this.recalcRowSubtotal(row, 'venta'));
        row.querySelector('.row-impuesto').addEventListener('change', () => this.recalcRowSubtotal(row, 'venta'));
        
        this.recalcRowSubtotal(row, 'venta');
    },

    recalcRowSubtotal(row, type) {
        const qty = parseFloat(this.unformatNumber(row.querySelector('.row-cantidad').value)) || 0;
        const price = parseFloat(this.unformatNumber(row.querySelector('.row-precio').value)) || 0;
        const desc = parseFloat(this.unformatNumber(row.querySelector('.row-descuento').value)) || 0;
        const taxSelect = row.querySelector('.row-impuesto').value;
        
        const netSubtotal = qty * price * (1 - desc / 100);
        const taxRate = taxSelect === '19%' ? 0.19 : 0.00;
        const taxAmount = netSubtotal * taxRate;
        const total = netSubtotal + taxAmount;
        
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        row.querySelector('.row-subtotal').textContent = fmt(total);
        
        if (type === 'cotizacion') {
            this.recalcCotizacionTotals();
        } else {
            this.recalcVentaTotals();
        }
    },

    recalcCotizacionTotals() {
        const body = document.getElementById('cotizacionDetalleBody');
        const rows = body.querySelectorAll('tr.detalle-row');
        
        let subtotalAccum = 0;
        let discountAccum = 0;
        let taxAccum = 0;
        let totalAccum = 0;
        
        rows.forEach(row => {
            const qty = parseFloat(this.unformatNumber(row.querySelector('.row-cantidad').value)) || 0;
            const price = parseFloat(this.unformatNumber(row.querySelector('.row-precio').value)) || 0;
            const descPercent = parseFloat(this.unformatNumber(row.querySelector('.row-descuento').value)) || 0;
            const taxSelect = row.querySelector('.row-impuesto').value;
            
            const rawSubtotal = qty * price;
            const discountAmt = rawSubtotal * (descPercent / 100);
            const netSubtotal = rawSubtotal - discountAmt;
            const taxRate = taxSelect === '19%' ? 0.19 : 0.00;
            const taxAmt = netSubtotal * taxRate;
            
            subtotalAccum += rawSubtotal;
            discountAccum += discountAmt;
            taxAccum += taxAmt;
            totalAccum += (netSubtotal + taxAmt);
        });
        
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        
        document.getElementById('cotizacionSubtotalVal').textContent = fmt(subtotalAccum);
        document.getElementById('cotizacionDescuentoVal').textContent = fmt(discountAccum);
        document.getElementById('cotizacionImpuestosVal').textContent = fmt(taxAccum);
        document.getElementById('cotizacionTotal').textContent = fmt(totalAccum);
    },

    recalcVentaTotals() {
        const body = document.getElementById('ventaDetalleBody');
        const rows = body.querySelectorAll('tr.detalle-row');
        
        let subtotalAccum = 0;
        let discountAccum = 0;
        let taxAccum = 0;
        let totalAccum = 0;
        
        rows.forEach(row => {
            const qty = parseFloat(this.unformatNumber(row.querySelector('.row-cantidad').value)) || 0;
            const price = parseFloat(this.unformatNumber(row.querySelector('.row-precio').value)) || 0;
            const descPercent = parseFloat(this.unformatNumber(row.querySelector('.row-descuento').value)) || 0;
            const taxSelect = row.querySelector('.row-impuesto').value;
            
            const rawSubtotal = qty * price;
            const discountAmt = rawSubtotal * (descPercent / 100);
            const netSubtotal = rawSubtotal - discountAmt;
            const taxRate = taxSelect === '19%' ? 0.19 : 0.00;
            const taxAmt = netSubtotal * taxRate;
            
            subtotalAccum += rawSubtotal;
            discountAccum += discountAmt;
            taxAccum += taxAmt;
            totalAccum += (netSubtotal + taxAmt);
        });
        
        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        
        document.getElementById('ventaSubtotalVal').textContent = fmt(subtotalAccum);
        document.getElementById('ventaDescuentoVal').textContent = fmt(discountAccum);
        document.getElementById('ventaImpuestosVal').textContent = fmt(taxAccum);
        document.getElementById('ventaTotal').textContent = fmt(totalAccum);
    },

    deleteDetailRow(button, type) {
        const row = button.closest('tr');
        row.remove();
        
        const body = document.getElementById(type === 'cotizacion' ? 'cotizacionDetalleBody' : 'ventaDetalleBody');
        const rows = body.querySelectorAll('tr.detalle-row');
        rows.forEach((r, idx) => {
            r.querySelector('.row-num').textContent = idx + 1;
        });
        
        if (type === 'cotizacion') {
            this.recalcCotizacionTotals();
        } else {
            this.recalcVentaTotals();
        }
    },

    showRowDescriptionModal(link) {
        const row = link.closest('tr');
        const hiddenInput = row.querySelector('.row-descripcion');
        const textarea = document.getElementById('rowDescriptionText');
        textarea.value = hiddenInput.value;
        
        const saveBtn = document.getElementById('saveRowDescriptionBtn');
        saveBtn.onclick = () => {
            hiddenInput.value = textarea.value.trim();
            if (textarea.value.trim()) {
                link.innerHTML = `<i class="bi bi-pencil-fill"></i> Editar descripción`;
            } else {
                link.innerHTML = `<i class="bi bi-pencil-square"></i> Agregar descripción`;
            }
            bootstrap.Modal.getInstance(document.getElementById('rowDescriptionModal')).hide();
        };
        
        new bootstrap.Modal(document.getElementById('rowDescriptionModal')).show();
    },

    filterKardex() {
        const prodId = document.getElementById('kardexProductoSelect')?.value || '';
        const tipo = document.getElementById('kardexTipoSelect')?.value || '';
        const desde = document.getElementById('kardexDesde')?.value || '';
        const hasta = document.getElementById('kardexHasta')?.value || '';

        let movements = DB.getKardexMovements(prodId);

        if (tipo) {
            movements = movements.filter(m => m.tipo.includes(tipo));
        }

        if (desde) {
            movements = movements.filter(m => m.fecha >= desde);
        }
        if (hasta) {
            movements = movements.filter(m => m.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
        }

        const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
        const fmtDate = (d) => new Date(d).toLocaleDateString('es-CO') + ' ' + new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

        let tableHtml = '';
        if (movements.length === 0) {
            tableHtml = `<div class="text-center text-muted py-4">No se encontraron movimientos con los filtros seleccionados.</div>`;
        } else {
            tableHtml = `
            <table class="table-modern">
                <thead>
                    <tr>
                        <th>Fecha y Hora</th>
                        <th>Código SKU</th>
                        <th>Producto</th>
                        <th>Tipo</th>
                        <th>Referencia</th>
                        <th>Origen</th>
                        <th>Contacto</th>
                        <th class="text-end">Cantidad</th>
                        <th class="text-end">Costo Unit.</th>
                        <th class="text-end">Costo Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${movements.map(m => {
                        const p = DB.getProduct(m.producto_id);
                        const costTotal = Math.abs(m.cant) * m.costo_unitario;
                        return `
                        <tr>
                            <td style="font-size: 11px;">${fmtDate(m.fecha)}</td>
                            <td><code>${p ? p.codigo : 'N/A'}</code></td>
                            <td class="fw-bold">${p ? p.nombre : 'Producto N/A'}</td>
                            <td><span class="badge ${m.cant > 0 ? 'bg-success' : (m.tipo.includes('Salida') ? 'bg-warning text-dark' : 'bg-secondary')}">${m.tipo}</span></td>
                            <td><code>${m.ref}</code></td>
                            <td>${m.origen}</td>
                            <td>${m.cliente_proveedor}</td>
                            <td class="text-end fw-bold ${m.cant > 0 ? 'text-success' : 'text-danger'}">${m.cant > 0 ? '+' : ''}${m.cant}</td>
                            <td class="text-end">${fmt(m.costo_unitario)}</td>
                            <td class="text-end fw-bold">${fmt(costTotal)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
        }

        const container = document.getElementById('kardexTableContainer');
        if (container) {
            container.innerHTML = tableHtml;
        }
    },

    unformatNumber(str) {
        if (!str) return '0';
        return str.toString().replace(/\./g, '').replace(/,/g, '.');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
