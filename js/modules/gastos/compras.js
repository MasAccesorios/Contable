import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions } from '../../shared/crud.js';
import { PrintManager } from '../../shared/printManager.js';
import { ExportManager } from '../../shared/exportManager.js';
import { ItemEngine } from '../../shared/itemEngine.js';
import { NumberingManager } from '../../shared/numberingManager.js';
import { ContactosModule } from '../clientes/clientes.js';
import { UI } from '../../shared/combobox.js';
import { calcularEstadoFactura, calcularDiasVencida } from '../../shared/carteraUtils.js';
import { AbonoModal } from '../../shared/abonoModal.js';
import { InventarioUtils } from '../../shared/inventarioUtils.js';
import { EstadoUtils } from '../../shared/estadoUtils.js';
import { escapeHtml } from '../../shared/formatters.js';

import { ComprasData } from './compras.data.js';
import { ComprasTemplates } from './compras.templates.js';
import { ComprasEvents } from './compras.events.js';

export const ComprasModule = {
    cache: { contactos: null, productos: null },
    element: null,

    state: {
        sortColumn: 'numero',
        sortDirection: 'desc',
        currentPage: 1,
        itemsPerPage: 10,
        searchQuery: '',
        filterCriteria: 'todos',
        selectedTab: 'todas',
        currentItems: [],
        contactosMap: {},
        totalItems: 0,
        totalPages: 1,
        kpis: {},
        tabCounts: {},
        activeDrawerId: null
    },
    
    async init(element) {
        if (!element) return;
        this.element = element;
        this.state.searchQuery = '';
        this.state.currentPage = 1;
        this.state.selectedTab = 'todas';

        const hashParts = window.location.hash.split('/');
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
        this.element = element;
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; color: var(--primary);">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;

        try {
            // Cargar en paralelo KPIs y conteos de tabs
            const [kpis, tabCounts] = await Promise.all([
                ComprasData.fetchKpis(),
                ComprasData.fetchTabCounts()
            ]);
            this.state.kpis = kpis;
            this.state.tabCounts = tabCounts;

            // Renderizar Shell Estático
            element.innerHTML = ComprasTemplates.renderShell(this.state.kpis, this.state.tabCounts, this.state.selectedTab, this.state.searchQuery);

            // Enlazar eventos estáticos
            ComprasEvents.bindStaticEvents(element, this);

            // Cargar y renderizar primera página del grid
            await this.renderGrid();

            return () => {
                ComprasEvents.cleanup();
            };
        } catch (err) {
            console.error('[ComprasModule] Error en renderList:', err);
            element.innerHTML = `
                <div class="alert alert-danger m-4" role="alert">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i> Error al cargar Facturas de Compra: ${escapeHtml(err.message)}
                </div>
            `;
        }
    },

    async renderGrid() {
        if (!this.element) return;
        const tbody = this.element.querySelector('#compras-tbody');
        const footer = this.element.querySelector('#compras-footer');
        const thead = this.element.querySelector('#compras-thead');
        if (!tbody) return;

        // Actualizar indicadores visuales de ordenamiento
        if (thead) {
            thead.querySelectorAll('.sortable-header').forEach(th => {
                const col = th.dataset.column;
                let text = th.innerText.replace(' ▲', '').replace(' ▼', '');
                if (this.state.sortColumn === col) {
                    text += this.state.sortDirection === 'asc' ? ' ▲' : ' ▼';
                }
                th.innerText = text;
            });
        }

        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando datos...</td></tr>`;

        try {
            const { items, totalItems, contactosMap } = await ComprasData.fetchComprasPage({
                page: this.state.currentPage,
                limit: this.state.itemsPerPage,
                sortCol: this.state.sortColumn,
                sortDir: this.state.sortDirection,
                search: this.state.searchQuery,
                filterCriteria: this.state.filterCriteria,
                tab: this.state.selectedTab
            });

            this.state.currentItems = items;
            this.state.totalItems = totalItems;
            this.state.totalPages = Math.ceil(totalItems / this.state.itemsPerPage) || 1;
            Object.assign(this.state.contactosMap, contactosMap);

            tbody.innerHTML = ComprasTemplates.renderGrid(
                this.state.currentItems,
                this.state.contactosMap,
                this.state.sortColumn,
                this.state.sortDirection
            );

            if (footer) {
                footer.innerHTML = ComprasTemplates.renderPagination(
                    this.state.totalItems,
                    this.state.currentPage,
                    this.state.itemsPerPage,
                    this.state.totalPages
                );
            }

            // Enlazar eventos dinámicos en filas y paginador
            ComprasEvents.bindDynamicEvents(this.element, this);

        } catch (err) {
            console.error('[ComprasModule] Error en renderGrid:', err);
            tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-danger"><i class="bi bi-exclamation-triangle me-1"></i> Error al cargar facturas</td></tr>`;
        }
    },

    async refreshAll() {
        const [kpis, tabCounts] = await Promise.all([
            ComprasData.fetchKpis(),
            ComprasData.fetchTabCounts()
        ]);
        this.state.kpis = kpis;
        this.state.tabCounts = tabCounts;

        const fmtMoney = (v) => ComprasTemplates.formatMoney(v).replace('$ ', '');

        // Actualizar badges de tabs si existen en el DOM
        if (this.element) {
            const tabTodas = this.element.querySelector('#tab-count-todas');
            if (tabTodas) tabTodas.textContent = tabCounts.todas || 0;
            const tabPorPagar = this.element.querySelector('#tab-count-por-pagar');
            if (tabPorPagar) tabPorPagar.textContent = tabCounts.por_pagar || 0;
            const tabVencidas = this.element.querySelector('#tab-count-vencidas');
            if (tabVencidas) tabVencidas.textContent = tabCounts.vencidas || 0;
            const tabPagadas = this.element.querySelector('#tab-count-pagadas');
            if (tabPagadas) tabPagadas.textContent = tabCounts.pagadas || 0;
            const tabAnuladas = this.element.querySelector('#tab-count-anuladas');
            if (tabAnuladas) tabAnuladas.textContent = tabCounts.anuladas || 0;

            const elPorPagar = this.element.querySelector('#kpi-cxp-por-pagar');
            if (elPorPagar) elPorPagar.textContent = '$ ' + fmtMoney(kpis.totalPorPagar);
            const elPorPagarSub = this.element.querySelector('#kpi-cxp-por-pagar-sub');
            if (elPorPagarSub) elPorPagarSub.innerHTML = `<span class="fw-semibold text-dark">${kpis.conteoPorPagar || 0}</span> facturas pendientes`;

            const elVencidas = this.element.querySelector('#kpi-cxp-vencidas');
            if (elVencidas) elVencidas.textContent = '$ ' + fmtMoney(kpis.cuentasVencidas);
            const elVencidasSub = this.element.querySelector('#kpi-cxp-vencidas-sub');
            if (elVencidasSub) {
                elVencidasSub.innerHTML = kpis.cuentasVencidas > 0 
                    ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-1.5 py-0.5 rounded">${kpis.conteoVencidas || 0} en mora</span>` 
                    : '<span class="text-success"><i class="bi bi-check-circle me-1"></i>Sin saldos vencidos</span>';
            }

            const elVigentes = this.element.querySelector('#kpi-cxp-vigentes');
            if (elVigentes) elVigentes.textContent = '$ ' + fmtMoney(kpis.cuentasVigentes);
            const elVigentesSub = this.element.querySelector('#kpi-cxp-vigentes-sub');
            if (elVigentesSub) elVigentesSub.innerHTML = `<span class="fw-semibold text-dark">${kpis.conteoVigentes || 0}</span> facturas al día`;

            const elPagado = this.element.querySelector('#kpi-cxp-pagado');
            if (elPagado) elPagado.textContent = '$ ' + fmtMoney(kpis.totalPagado);
            const elPagadoSub = this.element.querySelector('#kpi-cxp-pagado-sub');
            if (elPagadoSub) elPagadoSub.innerHTML = `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-1.5 py-0.5 rounded">${kpis.porcentajeAmortizado || 0}% liquidado</span>`;
        }

        await this.renderGrid();
    },

    async mostrarDrawer(id) {
        const drawer = document.getElementById('compras-drawer');
        const backdrop = document.getElementById('compras-drawer-backdrop');
        const drawerBody = document.getElementById('compras-drawer-body');
        const drawerFooter = document.getElementById('compras-drawer-footer');

        if (!drawer || !backdrop || !drawerBody || !drawerFooter) return;

        this.state.activeDrawerId = id;
        backdrop.classList.add('show');
        drawer.classList.add('show');

        // Limpieza defensiva del contenido previo
        drawerBody.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center py-5">
                <div class="spinner-border text-primary mb-2" role="status" style="width: 2.5rem; height: 2.5rem;"></div>
                <span class="text-muted" style="font-size: 13px;">Cargando información contable...</span>
            </div>
        `;
        drawerFooter.innerHTML = '';

        try {
            const data = await ComprasData.fetchFacturaDetalleDrawer(id);

            drawerBody.innerHTML = ComprasTemplates.renderDrawerContent(data);
            drawerFooter.innerHTML = ComprasTemplates.renderDrawerFooter({
                fac: data.fac,
                isPagada: data.saldoPendiente <= 0,
                isAnulada: (data.fac.estado || '').toLowerCase() === 'anulada' || (data.fac.estado || '').toLowerCase() === 'void',
                saldoPendiente: data.saldoPendiente
            });

            ComprasEvents.bindDrawerEvents(drawerFooter, drawerBody, this, data);
        } catch (err) {
            console.error('[ComprasModule] Error al abrir drawer:', err);
            drawerBody.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i> Error al cargar detalle: ${escapeHtml(err.message)}
                </div>
            `;
            drawerFooter.innerHTML = `<button type="button" class="btn btn-light border" onclick="document.getElementById('btn-close-drawer').click()">Cerrar</button>`;
        }
    },

    cerrarDrawer() {
        const drawer = document.getElementById('compras-drawer');
        const backdrop = document.getElementById('compras-drawer-backdrop');
        if (drawer) drawer.classList.remove('show');
        if (backdrop) backdrop.classList.remove('show');
        this.state.activeDrawerId = null;
    },

    async imprimirDocumento(id) {
        try {
            const doc = await DB.get('facturas', id);
            if (!doc) throw new Error('No se pudo encontrar el documento');

            const pIds = (doc.detalles || []).map(d => parseInt(d.productoId, 10)).filter(p => !isNaN(p) && p > 0);
            const contactId = doc.clienteId || doc.proveedorId || doc.contacto_id;

            const [cRes, pRes] = await Promise.all([
                contactId ? supabase.from('contactos').select('*').eq('id', contactId) : Promise.resolve({ data: [] }),
                pIds.length > 0 ? supabase.from('productos').select('*').in('id', pIds) : Promise.resolve({ data: [] })
            ]);

            const cList = (cRes.data || []).map(c => DB._mapToFrontend('contactos', c));
            const pList = (pRes.data || []).map(p => DB._mapToFrontend('productos', p));
            PrintManager.printDocument(doc, 'Factura de Compra', cList, pList);
        } catch (err) {
            console.error('[ComprasModule] Error al imprimir:', err);
            CoreActions.showWarningModal('Error al imprimir factura: ' + err.message);
        }
    },

    async anularFactura(id) {
        try {
            const result = await ComprasData.anularCompra(id);
            if (result && result.alreadyAnnulled) {
                CoreActions.showWarningModal('Esta factura ya se encuentra anulada.');
                return;
            }
            CoreActions.showSuccessModal('Factura de compra anulada e inventario revertido con éxito.');
            await this.refreshAll();
        } catch (error) {
            console.error('[ComprasModule] Error al anular factura de compra:', error);
            CoreActions.showWarningModal('Error crítico al anular: ' + error.message);
        }
    },

    async exportarExcel(btn) {
        await ComprasData.exportarExcel({
            sortCol: this.state.sortColumn,
            sortDir: this.state.sortDirection,
            search: this.state.searchQuery,
            filterCriteria: this.state.filterCriteria,
            tab: this.state.selectedTab,
            btn
        });
    },

    async renderForm(element, id = null, isViewOnly = false) {
        const facturaIdTransacciones = id ? [id] : [];
        const { data: rawTransaccionesData } = facturaIdTransacciones.length > 0
            ? await supabase.from('pagos_ingresos').select('*').in('factura_id', facturaIdTransacciones)
            : { data: [] };
            
        // TRADUCCIÓN OBLIGATORIA: El query crudo a Supabase devuelve 'in' / 'out'. 
        // calcularEstadoFactura exige el contrato 'ingreso' / 'egreso'.
        const transacciones = (rawTransaccionesData || []).map(t => ({
            ...t,
            tipo: t.tipo === 'in' ? 'ingreso' : 'egreso'
        }));
        
        // Estado por defecto
        let factura = {
            id: 'fac_' + Date.now(),
            numero: undefined,
            fecha: getLocalDate(),
            vencimiento: '',
            proveedorId: '',
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
            if (factura.clienteId && !factura.proveedorId) {
                factura.proveedorId = factura.clienteId;
            }
            if (!factura.numero) {
                factura.numero = Math.floor(Math.random() * 9000) + 1000;
            }

            if (!factura.detalles || factura.detalles.length === 0) {
                factura.detalles = [{ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 }];
            }
        }

        const headerHtml = CoreActions.renderDocumentHeader('gastos/proveedores', 'Volver a Facturas de Compra');
        const actionsHtml = CoreActions.renderActionButtons(factura, 'factura', isViewOnly, !id);

        // Fetch initial supplier name
        let proveedorNombreActual = '';
        if (factura.proveedorId) {
            const { data: cliData } = await supabase.from('contactos').select('nombre').eq('id', factura.proveedorId).single();
            if (cliData) proveedorNombreActual = cliData.nombre;
        }

        // Fetch initial products for details
        let productosFactura = [];
        if (factura.detalles && factura.detalles.length > 0) {
            const pIds = factura.detalles
                .map(d => parseInt(d.productoId, 10))
                .filter(id => !isNaN(id) && id > 0);
            if (pIds.length > 0) {
                const { data: pData } = await supabase.from('productos').select('*').in('id', pIds);
                if (pData) productosFactura = pData.map(p => DB._mapToFrontend('productos', p));
            }
        }

        // Fetch full contact/product lists for Print & Preview
        const { data: contactosData } = await supabase.from('contactos').select('*').limit(2000);
        const contactos = contactosData || [];

        const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
        const cuentasActivas = dbCuentas.filter(c => c.estado === 'active' || c.estado === 'activo');

        element.innerHTML = `
            <div class="module-container p-4" style="max-width: 1100px; margin: 0 auto;">
                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        ${headerHtml}
                        <h2 class="h3 fw-bold mb-0" style="color: var(--text-main);">${id ? 'Factura No. ' + escapeHtml(String(factura.numero || '')) : 'Nueva factura'}</h2>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        ${isViewOnly && id && factura.estado !== 'pagada' && !EstadoUtils.estaAnulado(factura.estado) ? 
                            `<button class="btn btn-primary fw-medium px-4 btn-abonar-detalle" data-id="${factura.id}" data-saldo="${factura.saldoPendiente}" style="background-color: var(--primary); border: none; border-radius: var(--border-radius-sm);"><i class="bi bi-wallet2 me-2"></i>Registrar Pago</button>` 
                            : ''}
                        ${actionsHtml}
                    </div>
                </div>

                <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: var(--border-radius-sm);">
                    <div class="card-body p-3 p-md-5">
                        <!-- HEADER DOCUMENTO -->
                        <div class="row mb-4 align-items-center">
                            <div class="col-12 col-md-4 mb-3 mb-md-0 text-center text-md-start">
                                <img src="LogoMas.png" alt="Logo" style="max-height: 80px;">
                            </div>
                            <div class="col-12 col-md-4 text-center mb-3 mb-md-0">
                                <h5 class="fw-bold" style="color: var(--text-main);">Accesorios .</h5>
                            </div>
                            <div class="col-12 col-md-4 text-center text-md-end">
                                <select class="form-select mb-2 bg-light border-0 d-inline-block w-auto">
                                    <option>Factura de Compra</option>
                                </select>
                                <div class="d-flex justify-content-center justify-content-md-end align-items-center text-muted" style="font-size: var(--fs-md);">
                                    <span id="lbl-numero">No. <strong style="color: var(--text-main);">${escapeHtml(String(factura.numero || '[Autogenerado al guardar]'))}</strong></span>
                                    ${!isViewOnly ? `<i class="bi bi-gear ms-2" id="btn-config-num" style="cursor: pointer;"></i>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- INFO FACTURA -->
                        <h6 class="fw-bold mb-3" style="color: var(--text-main);">Información de la factura</h6>
                        <div class="row mb-5 g-3">
                            <div class="col-12 col-sm-6 col-md-3">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Proveedor <span class="text-danger">*</span></label>
                                <input type="text" id="search-proveedor" class="form-control form-control-sm text-muted" placeholder="Buscar proveedor..." value="${escapeHtml(proveedorNombreActual)}" autocomplete="off" ${isViewOnly ? 'disabled' : ''}>
                                <input type="hidden" id="select-proveedor" value="${factura.proveedorId || ''}">
                            </div>
                            <div class="col-12 col-sm-6 col-md-3">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Tipo de Venta</label>
                                <select id="select-tipo-compra" class="form-select form-select-sm text-muted" ${isViewOnly ? 'disabled' : ''}>
                                    <option value="credito" ${factura.tipoCompra === 'credito' || !factura.tipoCompra ? 'selected' : ''}>A Crédito (Cartera)</option>
                                    <option value="contado" ${factura.tipoCompra === 'contado' ? 'selected' : ''}>De Contado (Caja)</option>
                                </select>
                            </div>
                            <div class="col-12 col-sm-6 col-md-3" id="container-cuenta-venta" style="display: ${factura.tipoCompra === 'contado' ? 'block' : 'none'};">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Cuenta (Contado)</label>
                                <select id="select-cuenta-compra" class="form-select form-select-sm text-muted" ${isViewOnly ? 'disabled' : ''}>
                                    ${cuentasActivas.map(c => `<option value="${escapeHtml(c.nombre)}" ${factura.cuentaId === c.nombre ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-6 col-md-3">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Fecha de creación</label>
                                <input type="date" id="input-fecha" class="form-control form-control-sm text-muted" value="${factura.fecha || ''}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-6 col-md-3">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Fecha de vencimiento</label>
                                <input type="date" id="input-vencimiento" class="form-control form-control-sm text-muted" value="${factura.vencimiento || ''}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                        </div>

                        <hr class="mb-5" style="border-color: var(--border-color); opacity: 1;">

                        <!-- PRODUCTOS -->
                        <h6 class="fw-bold mb-3" style="color: var(--text-main);">Productos y servicios</h6>
                        <div class="table-responsive mb-3" style="overflow: visible;">
                            <table class="table table-borderless align-middle mb-0" id="tabla-detalles" style="font-size: var(--fs-base);">
                                <thead style="border-bottom: 1px solid var(--border-color);">
                                    <tr style="color: var(--text-muted); font-weight: var(--weight-regular);">
                                        <th style="width: 40px;"><input type="checkbox" class="form-check-input" disabled></th>
                                        <th style="width: 35%; min-width: 180px;">Producto o servicios</th>
                                        <th style="width: 15%;">Cantidad</th>
                                        <th style="width: 15%;">Precio</th>
                                        <th style="width: 10%;">Desc %</th>
                                        <th style="width: 12%;">Impto %</th>
                                        <th class="text-end" style="width: 13%;">Subtotal</th>
                                        <th style="width: 40px;"></th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-detalles">
                                    <!-- Líneas dinámicas renderizadas por JS -->
                                </tbody>
                            </table>
                        </div>
                        
                        ${!isViewOnly ? `
                        <button id="btn-agregar-linea" class="btn btn-link text-decoration-none p-0 mb-5" style="font-size: var(--fs-md); font-weight: var(--weight-medium); color: var(--primary);">
                            <i class="bi bi-plus-lg me-1"></i>Agregar línea
                        </button>
                        ` : ''}

                        <!-- TOTALES -->
                        <div class="row justify-content-end mb-5">
                            <div class="col-md-4">
                                <div class="d-flex justify-content-between mb-2" style="font-size: var(--fs-md); color: var(--text-body);">
                                    <span>Subtotal</span><span id="tot-subtotal">$0,00</span>
                                </div>
                                <div class="d-flex justify-content-between mb-2" style="font-size: var(--fs-md); color: var(--text-body);">
                                    <span>Descuento</span><span id="tot-descuento">$0,00</span>
                                </div>
                                <div class="d-flex justify-content-between mb-3" style="font-size: var(--fs-md); color: var(--text-body);">
                                    <span>Impuestos</span><span id="tot-impuestos">$0,00</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="fw-bold" style="font-size: var(--fs-lg); color: var(--text-main);">Total</span>
                                    <span class="fw-bold" id="tot-total" style="font-size: var(--fs-lg); color: var(--text-main);" data-raw-total="0">$0,00</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- DOCUMENTOS RELACIONADOS (Solo Vista) -->
                ${isViewOnly ? `
                <div class="mt-5">
                    <h6 class="fw-bold mb-3" style="color: var(--text-main);">Documentos relacionados</h6>
                    <ul class="nav nav-tabs mb-3" role="tablist" style="border-bottom: 2px solid var(--border-color);">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-pagos" type="button" role="tab" style="font-size: var(--fs-base); font-weight: var(--weight-medium); color: var(--text-main); border-bottom-color: transparent;">Pagos recibidos</button>
                        </li>
                        ${factura.cotizacion_origen_id ? `
                        <li class="nav-item" role="presentation">
                            <button class="nav-link text-muted" data-bs-toggle="tab" data-bs-target="#tab-cotizacion" type="button" role="tab" style="font-size: var(--fs-base); font-weight: var(--weight-medium); border-bottom-color: transparent;">Cotización origen</button>
                        </li>` : ''}
                    </ul>
                    
                    <div class="tab-content border-0 p-0">
                        <div class="tab-pane fade show active" id="tab-pagos" role="tabpanel">
                            <div class="table-responsive">
                                <table class="table table-sm align-middle mb-0" style="font-size: var(--fs-base);">
                                    <thead>
                                        <tr class="text-muted" style="border-bottom: 1px solid var(--border-color);">
                                            <th class="fw-medium pb-2">Fecha</th>
                                            <th class="fw-medium pb-2">Cuenta</th>
                                            <th class="fw-medium pb-2">Método</th>
                                            <th class="fw-medium pb-2 text-end">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(transacciones && transacciones.length > 0) ? transacciones.map(p => `
                                        <tr style="border-bottom: 1px solid #f0f0f0;">
                                            <td class="py-2 text-muted">${p.fecha || p.created_at?.split('T')[0] || ''}</td>
                                            <td class="py-2">${escapeHtml(String(p.cuentaId || p.cuenta_id || '-'))}</td>
                                            <td class="py-2">${escapeHtml(String(p.metodo_pago || p.metodoPago || '-'))}</td>
                                            <td class="py-2 text-end fw-medium">$${Number(p.monto || p.valor || 0).toLocaleString()}</td>
                                        </tr>`).join('') : `
                                        <tr><td colspan="4" class="text-muted text-center py-4">No hay pagos registrados para esta factura</td></tr>
                                        `}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        ${factura.cotizacion_origen_id ? `
                        <div class="tab-pane fade" id="tab-cotizacion" role="tabpanel">
                            <div class="card border border-light shadow-sm btn-nav-cotizacion" data-fac-id="${encodeURIComponent(factura.id)}" data-cot-id="${encodeURIComponent(factura.cotizacion_origen_id)}" style="max-width:300px; cursor:pointer;">
                                <div class="card-body py-3 px-3 d-flex justify-content-between align-items-center">
                                    <div>
                                        <small class="text-muted d-block" style="font-size: var(--fs-xs);">Ver documento origen</small>
                                        <span class="fw-medium text-dark" style="font-size: var(--fs-md); color: var(--primary) !important;">Cotización</span>
                                    </div>
                                    <i class="bi bi-box-arrow-up-right text-muted" style="font-size: var(--fs-sm);"></i>
                                </div>
                            </div>
                        </div>` : ''}
                    </div>
                </div>
                ` : ''}

                <!-- FOOTER ACTIONS -->
                ${!isViewOnly ? `
                <div class="d-flex justify-content-end gap-3 mb-5">
                    <button id="btn-cancelar" class="btn btn-outline-secondary px-4 bg-white" style="font-weight: var(--weight-medium); border-color: var(--border-color);">
                        Cancelar
                    </button>
                    <button id="btn-guardar" class="btn btn-primary px-5" style="font-weight: var(--weight-medium);">Guardar</button>
                </div>
                ` : ''}
            </div>
        `;

        if (id) {
            // Pasamos 'factura' en vez de 'cotizacion' para que evite renderizar "Convertir a Factura"
            CoreActions.bindActionEvents(element, factura, 'factura', {});
        }

        // ==========================================
        // LÓGICA DE INTERACCIÓN (ENGINE DOM)
        // ==========================================

        const tbody = element.querySelector('#tbody-detalles');
        let contadorLineas = 0;

        // Renderizador de fila dinámica
        const addRow = (detalle) => {
            contadorLineas++;
            ItemEngine.addRow({
                detalle,
                tbody,
                isViewOnly,
                productosFactura,
                contadorLineas,
                calcEngine,
                reindexRows,
                isCompra: true,
                onCrearProducto: ComprasModule.crearProductoRapido.bind(ComprasModule)
            });
        };

        // Reindexador de numerales
        const reindexRows = () => {
            contadorLineas = ItemEngine.reindexRows(tbody);
        };

        // Motor Matemático (Dynamic Pricing & Totals) — formatMoney vive en ItemEngine.formatMoney
        const calcEngine = () => {
            ItemEngine.calcEngine({
                tbody,
                element,
                factura
            });
        };

        // Función Helper: Cálculo de Fecha de Vencimiento
        const calcularVencimiento = (proveedor) => {
            const plazos = parseInt(proveedor.plazosPago || 0);
            const inputVencimiento = element.querySelector('#input-vencimiento');
            if (plazos > 0) {
                const fechaCreacion = new Date(element.querySelector('#input-fecha').value);
                fechaCreacion.setDate(fechaCreacion.getDate() + plazos);
                if (inputVencimiento) inputVencimiento.value = getLocalDate(fechaCreacion);
            } else {
                if (inputVencimiento) inputVencimiento.value = '';
            }
        };

        // Inicialización de Combobox de Proveedores y Cálculo de Vencimiento Automatizado
        if (!isViewOnly) {
            import('../../shared/combobox.js').then(({ UI }) => {
                UI.createAsyncCombobox({
                    inputEl: element.querySelector('#search-proveedor'),
                    hiddenIdEl: element.querySelector('#select-proveedor'),
                    fetchItems: (query) => UI.fetchContactosCombobox(query, 'proveedor'),
                    displayProp: 'nombre',
                    allowCreate: true,
                    onSelect: (selectedItem) => {
                        calcularVencimiento(selectedItem);
                    },
                    onCreate: (query) => {
                        ContactosModule.renderQuickModal(query, (nuevoContacto) => {
                            // Al guardar exitosamente, lo autoseleccionamos
                            element.querySelector('#search-proveedor').value = nuevoContacto.nombre;
                            const hiddenInput = element.querySelector('#select-proveedor');
                            hiddenInput.value = nuevoContacto.id;
                            
                            // Calculamos vencimiento explícitamente para el nuevo contacto
                            calcularVencimiento(nuevoContacto);
                        });
                    }
                });
            });
        }
        
        // Configuración de Tipo de Compra y Cuenta (Engranaje)
        element.querySelector('#select-tipo-compra')?.addEventListener('change', (e) => {
            const containerCuenta = element.querySelector('#container-cuenta-venta');
            if (containerCuenta) {
                containerCuenta.style.display = e.target.value === 'contado' ? 'block' : 'none';
            }
        });

        // Configuración de Numeración (Engranaje)
        element.querySelector('#btn-config-num')?.addEventListener('click', () => {
            NumberingManager.openNumberingModal('factura', factura, (prefijo, numero) => {
                element.querySelector('#lbl-numero').innerHTML = `No. <strong style="color: var(--text-main);">${numero}</strong>`;
            });
        });

        // Evento Agregar Línea
        element.querySelector('#btn-agregar-linea')?.addEventListener('click', () => {
            addRow({ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 });
            calcEngine();
        });

        // Evento Cancelar
        element.querySelector('#btn-cancelar')?.addEventListener('click', () => {
            window.hayCambiosSinGuardar = false;
            window.location.hash = '#/gastos/proveedores';
        });

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
            PrintManager.printDocument(factura, 'Factura de Compra', contactos, productosFactura);
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
            PrintManager.printDocument(factura, 'Factura de Compra', contactos, productosFactura, 'preview');
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
            window.location.hash = `#/gastos/proveedores/editar/${docId}`;
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
                    const proveedorId = element.querySelector('#select-proveedor').value;
                    if (!proveedorId) {
                        const searchInput = element.querySelector('#search-proveedor');
                        searchInput.style.borderColor = '#ef4444'; // Resalta en rojo
                        CoreActions.showWarningModal("Debes seleccionar un proveedor válido de la lista.");
                        if (window._comprasSearchProveedorTimeout) clearTimeout(window._comprasSearchProveedorTimeout);
                        window._comprasSearchProveedorTimeout = setTimeout(() => {
                            if (document.body.contains(searchInput)) {
                                searchInput.style.borderColor = '';
                            }
                        }, 3000);
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = originalText;
                        return;
                    }

                    const tipoCompra = element.querySelector('#select-tipo-compra').value;
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

                                        factura.contacto_id = element.querySelector('#select-proveedor').value;
                    if (tipoCompra === 'contado') {
                        factura.cuentaId = element.querySelector('#select-cuenta-compra').value;
                    }
                    factura.fecha = element.querySelector('#input-fecha').value;
                    factura.vencimiento = element.querySelector('#input-vencimiento').value || factura.fecha;
                    factura.detalles = arrDetalles;
                    factura.tipo = 'compra'; 
                    
                    const rawTotal = parseFloat(element.querySelector('#tot-total').dataset.rawTotal);
                    factura.total = rawTotal;

                    let savedFactura;
                    if (isNew) {
                        // Compra nueva: RPC atómico (cabecera + detalles + inventario en una sola transacción)
                        const detallesRpc = arrDetalles.map(d => ({
                            producto_id: parseInt(d.productoId, 10),
                            descripcion_personalizada: d.descripcionPersonalizada || '',
                            cantidad: d.cantidad,
                            precio_unitario: d.precio,
                            descuento_porcentaje: d.descuento,
                            subtotal: (d.cantidad * d.precio) - ((d.cantidad * d.precio) * (d.descuento / 100))
                        }));

                        const { data: rpcResult, error: rpcErr } = await supabase.rpc('guardar_factura_compra_con_inventario', {
                            p_header: {
                                fecha: factura.fecha,
                                vencimiento: factura.vencimiento,
                                contacto_id: factura.contacto_id,
                                total: factura.total,
                                estado: factura.estado,
                                observaciones: factura.observaciones
                            },
                            p_detalles: detallesRpc
                        });

                        if (rpcErr) throw new Error("Error al guardar factura de compra: " + rpcErr.message);
                        savedFactura = rpcResult;
                        factura.id = savedFactura.id;
                    } else {
                        // Edición de compra existente: RPC atómico (cabecera + detalles + inventario en una sola transacción)
                        const detallesRpc = arrDetalles.map(d => ({
                            producto_id: parseInt(d.productoId, 10),
                            descripcion_personalizada: d.descripcionPersonalizada || '',
                            cantidad: d.cantidad,
                            precio_unitario: d.precio,
                            descuento_porcentaje: d.descuento,
                            subtotal: (d.cantidad * d.precio) - ((d.cantidad * d.precio) * (d.descuento / 100))
                        }));

                        const { data: rpcResult, error: rpcErr } = await supabase.rpc('editar_factura_compra_con_inventario', {
                            p_factura_id: factura.id,
                            p_factura_header: {
                                total: factura.total,
                                total_costo: factura.total_costo,
                                vencimiento: factura.vencimiento,
                                observaciones: factura.observaciones,
                                contacto_id: factura.contacto_id
                            },
                            p_nuevos_detalles: detallesRpc,
                            p_origen_movimiento: 'Edición Factura Compra ' + factura.numero
                        });

                        if (rpcErr) throw new Error("Error al editar factura de compra: " + rpcErr.message);
                        savedFactura = rpcResult;
                    }

                    // Condicional Contado vs Crédito
                    if (tipoCompra === 'contado') {
                        if (isNew && factura.cuentaId) {
                            const transaccion = {
                                id: 'trx_' + Date.now(),
                                facturaId: factura.id,
                                referenciaId: factura.id,
                                tipo: 'egreso',
                                monto: rawTotal,
                                fecha: factura.fecha,
                                referencia: `Compra al contado Fac. ${factura.numero}`,
                                detalle: `Compra al contado Fac. ${factura.numero}`,
                                cuenta: factura.cuentaId,
                                cuentaId: factura.cuentaId
                            };
                            await DB.save('transacciones', transaccion);
                        }
                    }
                    
                    // Navegar a modo lectura para bloquear edición y habilitar impresión final
                    window.hayCambiosSinGuardar = false;
                    window.location.hash = `#/gastos/proveedores/ver/${factura.id}`;
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
        element.querySelector('.btn-nav-cotizacion')?.addEventListener('click', (e) => {
            const card = e.currentTarget;
            sessionStorage.setItem('origenVolver', JSON.stringify({
                hash: '#/gastos/proveedores/ver/' + card.dataset.facId,
                label: 'Volver a la factura'
            }));
            window.location.hash = '#/ingresos/cotizaciones/ver/' + card.dataset.cotId;
        });


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
, // <-- NOTE THIS COMMA!
    async crearProductoRapido(query, trElement) {
        const modalId = 'modal-crear-prod-rapido';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const html = `
            <div class="modal fade show" id="${modalId}" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Crear Nuevo Producto</h5>
                            <button type="button" class="btn-close" onclick="document.getElementById('${modalId}').remove()"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label text-muted small">Nombre del Producto</label>
                                <input type="text" id="cp-nombre" class="form-control" value="${escapeHtml(query || '')}">
                            </div>
                            <div class="row mb-3">
                                <div class="col-6">
                                    <label class="form-label text-muted small">SKU / Referencia</label>
                                    <input type="text" id="cp-sku" class="form-control">
                                </div>
                                <div class="col-6">
                                    <label class="form-label text-muted small">Costo inicial</label>
                                    <div class="input-group">
                                        <span class="input-group-text">$</span>
                                        <input type="text" id="cp-costo" class="form-control text-end" value="0">
                                    </div>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-6">
                                    <label class="form-label text-muted small">Precio de venta</label>
                                    <div class="input-group">
                                        <span class="input-group-text">$</span>
                                        <input type="text" id="cp-precio" class="form-control text-end" value="0">
                                    </div>
                                </div>
                                <div class="col-6">
                                    <label class="form-label text-muted small">Utilidad</label>
                                    <input type="text" id="cp-utilidad" class="form-control text-end bg-light" readonly disabled value="—">
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="cp-guardar">Guardar y Seleccionar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
        
        // Aplicar formato de moneda y lógica de utilidad
        import('../../shared/formatters.js').then(fmt => {
            const inputCosto  = document.getElementById('cp-costo');
            const inputPrecio = document.getElementById('cp-precio');
            const inputUtil   = document.getElementById('cp-utilidad');

            const recalcUtilidad = () => {
                const costo  = fmt.parseCurrencyValue(inputCosto.value)  || 0;
                const precio = fmt.parseCurrencyValue(inputPrecio.value) || 0;
                if (costo <= 0) {
                    inputUtil.value = '—';
                    return;
                }
                const pct = ((precio - costo) / costo) * 100;
                const abs = precio - costo;
                inputUtil.value = `${pct.toFixed(1)}% ($${abs.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
            };

            // Formato y recálculo para cp-costo
            inputCosto.addEventListener('input', (e) => {
                fmt.applyCurrencyFormatting(e.target);
                recalcUtilidad();
            });
            inputCosto.addEventListener('blur', (e) => {
                if (e.target.value === '') e.target.value = '0';
                fmt.applyCurrencyFormatting(e.target);
                recalcUtilidad();
            });

            // Formato y recálculo para cp-precio
            inputPrecio.addEventListener('input', (e) => {
                fmt.applyCurrencyFormatting(e.target);
                recalcUtilidad();
            });
            inputPrecio.addEventListener('blur', (e) => {
                if (e.target.value === '') e.target.value = '0';
                fmt.applyCurrencyFormatting(e.target);
                recalcUtilidad();
            });
            
            document.getElementById('cp-guardar').addEventListener('click', async (e) => {
                const btn = e.target;
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
                
                try {
                    const nombre = document.getElementById('cp-nombre').value;
                    const sku    = document.getElementById('cp-sku').value;
                    const costo  = fmt.parseCurrencyValue(inputCosto.value);
                    const precio = fmt.parseCurrencyValue(inputPrecio.value);
                    
                    if (!nombre) throw new Error("El nombre es obligatorio");

                    const { supabase } = await import('../../core/supabase.js');

                    // Validar SKU duplicado solo si se ingresó un SKU
                    if (sku) {
                        const { data: existente } = await supabase
                            .from('productos')
                            .select('id')
                            .eq('sku', sku)
                            .maybeSingle();
                        if (existente) {
                            alert("Ya existe un producto con el SKU '" + sku + "'");
                            btn.disabled = false;
                            btn.innerHTML = 'Guardar y Seleccionar';
                            return;
                        }
                    }

                    const { data, error } = await supabase.from('productos').insert([{
                        nombre:      nombre,
                        sku:         sku,
                        costo_base:  costo,
                        precio_venta: precio,
                        estado:      'active'
                    }]).select().single();
                    
                    if (error) throw error;

                    // Cerrar modal
                    document.getElementById(modalId).remove();
                    
                    // Inyectar en la fila
                    if (trElement) {
                        const inpSearch = trElement.querySelector('.input-prod-search');
                        const inpId     = trElement.querySelector('.input-prod-id');
                        
                        inpSearch.value = `[${data.sku || 'S/N'}] - ${data.nombre}`;
                        inpId.value = data.id;
                    }
                } catch (err) {
                    alert("Error al crear producto: " + err.message);
                    btn.disabled = false;
                    btn.innerHTML = 'Guardar y Seleccionar';
                }
            });
        });
    }

};
