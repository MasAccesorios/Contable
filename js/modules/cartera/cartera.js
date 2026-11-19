import { CarteraData } from './cartera.data.js';
import { CarteraTemplates } from './cartera.templates.js';
import { CarteraEvents } from './cartera.events.js';
import { PrintManager } from '../../shared/printManager.js';

export const CarteraModule = {
    state: {
        view: 'facturas', // 'facturas', 'clientes', 'analitica'
        facturas: [],
        facturasFiltradas: [],
        clientesAgrupados: [],
        clientesFiltrados: [],
        contactos: [],
        contactosMap: new Map(),
        currentPage: 1,
        itemsPerPage: 20,
        searchQuery: '',
        selectedTab: 'todas',
        selectedClienteId: 'todos',
        totalItems: 0,
        saldoFiltrado: 0,
        isLoading: false,
        activeDrawerFacturaId: null,
        kpis: {
            totalCartera: 0,
            totalVigente: 0,
            totalVencida: 0,
            mora1a30: 0,
            mora31a60: 0,
            mora60Plus: 0,
            moraCritica: 0,
            porcentajeVigente: 0,
            porcentajeMoraCritica: 0,
            conteoTotal: 0,
            conteoVigentes: 0,
            conteo1a30: 0,
            conteo31a60: 0,
            conteo60Plus: 0,
            totalDeudores: 0,
            topDeudor: null
        }
    },

    async init(element) {
        if (!element) return;
        this.element = element;
        this.state.currentPage = 1;
        this.state.searchQuery = '';
        this.state.selectedTab = 'todas';
        this.state.selectedClienteId = 'todos';

        // Spinner inicial de carga
        this.element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center py-5" style="min-height: 400px;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando cartera...</span>
                </div>
            </div>
        `;

        await this.cargarDatosCartera();
        this.renderLayoutActual();

        return () => {
            if (this._onKeyDown) {
                document.removeEventListener('keydown', this._onKeyDown);
            }
        };
    },

    renderLayoutActual() {
        if (!this.element) return;
        this.element.innerHTML = this.renderLayout();
        this.bindStaticEvents();
        this.render();
    },

    render() {
        const container = this.element.querySelector('#cartera-content-container');
        if (!container) return;

        if (this.state.view === 'facturas') {
            container.innerHTML = this.renderGridFacturas();
        } else if (this.state.view === 'clientes') {
            container.innerHTML = this.renderVistaClientes();
        } else if (this.state.view === 'analitica') {
            container.innerHTML = this.renderAnalyticsView();
        }

        this.bindDynamicEvents(container);
    },

    async mostrarDrawer(facturaId) {
        const backdrop = this.element.querySelector('#cartera-drawer-backdrop');
        const drawer = this.element.querySelector('#cartera-drawer');
        const body = this.element.querySelector('#cartera-drawer-body');
        const actionsContainer = this.element.querySelector('#drawer-action-buttons');
        if (!drawer || !body) return;

        body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando comprobante...</span>
                </div>
            </div>
        `;

        if (backdrop) backdrop.classList.add('show');
        drawer.classList.add('show');
        this.state.activeDrawerFacturaId = facturaId;

        try {
            const factura = this.state.facturas.find(f => String(f.id) === String(facturaId));
            if (!factura) {
                this.cerrarDrawer();
                return;
            }

            const abonos = await this.cargarAbonosFactura(facturaId);
            const cliente = factura.cliente;
            const carteraTotalCliente = this.state.clientesAgrupados.find(c => String(c.id) === String(factura.clienteId));

            body.innerHTML = this.renderDrawerContent(factura, abonos, cliente, carteraTotalCliente);

            // Botones de acción dinámicos en el footer del Drawer
            if (actionsContainer) {
                actionsContainer.innerHTML = `
                    <button type="button" class="btn btn-outline-success btn-sm px-3 fw-medium d-flex align-items-center gap-1.5" id="btn-drawer-wpp">
                        <i class="bi bi-whatsapp"></i> Cobrar
                    </button>
                    <button type="button" class="btn btn-outline-secondary btn-sm px-3 fw-medium d-flex align-items-center gap-1.5" id="btn-drawer-print">
                        <i class="bi bi-printer"></i> Estado Cuenta
                    </button>
                    <button type="button" class="btn btn-primary btn-sm px-3 fw-medium d-flex align-items-center gap-1.5" id="btn-drawer-abonar">
                        <i class="bi bi-plus-lg"></i> Registrar Abono
                    </button>
                `;

                const btnWpp = actionsContainer.querySelector('#btn-drawer-wpp');
                if (btnWpp) {
                    btnWpp.onclick = () => this.enviarCobroWhatsAppFactura(factura);
                }

                const btnPrint = actionsContainer.querySelector('#btn-drawer-print');
                if (btnPrint) {
                    btnPrint.onclick = () => {
                        if (factura.clienteId) PrintManager.printEstadoCuenta(factura.clienteId);
                    };
                }

                const btnAbonar = actionsContainer.querySelector('#btn-drawer-abonar');
                if (btnAbonar) {
                    btnAbonar.onclick = () => this.abrirModalAbono(factura.id, factura.saldo);
                }
            }
        } catch (err) {
            console.error('[CarteraModule] Error cargando drawer:', err);
            body.innerHTML = `<div class="p-4 text-center text-danger">Error al cargar detalle del cobro.</div>`;
        }
    },

    cerrarDrawer() {
        const backdrop = this.element.querySelector('#cartera-drawer-backdrop');
        const drawer = this.element.querySelector('#cartera-drawer');
        if (backdrop) backdrop.classList.remove('show');
        if (drawer) drawer.classList.remove('show');
        this.state.activeDrawerFacturaId = null;
    }
};

Object.assign(CarteraModule, CarteraData, CarteraTemplates, CarteraEvents);

export default CarteraModule;
