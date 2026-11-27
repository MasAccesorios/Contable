// js/modules/vendedores/vendedores.js
// Orquestador Principal y Fachada del Módulo de Vendedores 360° (Línea Gastos Operativos)
// Desacoplado en: vendedores.data.js, vendedores.templates.js, vendedores.events.js y vendedores.js

import { VendedoresData } from './vendedores.data.js';
import { VendedoresTemplates } from './vendedores.templates.js';
import { VendedoresEvents } from './vendedores.events.js';

export const VendedoresModule = {
    element: null,

    state: {
        vendedores: [],
        vendedoresFiltrados: [],
        cuentas: [],
        kpis: {},
        insights: {},
        currentTab: 'todas',
        currentView: 'lista', // 'lista' o 'grafico'
        searchQuery: '',
        activeDrawerVendedorId: null,
        activeDrawerVendedor: null,
        activeDrawerComisiones: [],
        activeDrawerCuentas: []
    },

    async init(element = null) {
        if (!element) {
            element = document.getElementById('view-viewport');
        }
        if (!element) return;
        this.element = element;

        // Renderizar estado de carga elegante
        this.element.innerHTML = `
            <div class="dash-layout p-4 text-center" style="max-width: 1240px; margin: 0 auto;">
                <div class="py-5">
                    <div class="spinner-border text-primary" role="status" style="width: 2.5rem; height: 2.5rem;"></div>
                    <p class="mt-3 text-muted fw-medium" style="font-size: 14px;">Cargando fuerza comercial, comisiones y analítica inteligente...</p>
                </div>
            </div>
        `;

        await this.cargarDatos();
        this.render();
        VendedoresEvents.init(this);

        // Soporte de enlace profundo (deep link) #/vendedores/ver/:id
        const hashParts = window.location.hash.split('?')[0].split('/');
        const action = hashParts[2];
        const id = hashParts[3];
        if (action === 'ver' && id) {
            await VendedoresEvents.abrirDrawer(id);
        }
    },

    async cargarDatos() {
        const { vendedores, cuentas } = await VendedoresData.cargarDatosIniciales();
        this.state.vendedores = vendedores || [];
        this.state.cuentas = cuentas || [];
        this.state.kpis = VendedoresData.calcularKpis(this.state.vendedores);
        this.state.insights = VendedoresData.generarInsightsInteligentes(this.state.vendedores);
        this.state.vendedoresFiltrados = VendedoresData.filtrarYOrdenar(this.state.vendedores, {
            tab: this.state.currentTab,
            search: this.state.searchQuery,
            sortBy: 'total_vendido',
            sortOrder: 'desc'
        });
    },

    render() {
        if (!this.element) return;
        this.element.innerHTML = VendedoresTemplates.renderLayout(this.state);
    },

    async recargar() {
        await this.cargarDatos();
        // Actualizar KPIs en DOM
        const kpis = this.state.kpis || {};
        const elTotal = this.element?.querySelector('#kpi-total-vendido');
        const elPend = this.element?.querySelector('#kpi-comision-pendiente');
        const elPag = this.element?.querySelector('#kpi-comision-pagada');
        const elFuerza = this.element?.querySelector('#kpi-fuerza-ventas');

        if (elTotal) elTotal.textContent = VendedoresTemplates.formatMoney(kpis.totalVendido);
        if (elPend) elPend.textContent = VendedoresTemplates.formatMoney(kpis.comisionPendiente);
        if (elPag) elPag.textContent = VendedoresTemplates.formatMoney(kpis.comisionPagada);
        if (elFuerza) {
            elFuerza.innerHTML = `${kpis.vendedoresActivos} <span style="font-size: 13px; font-weight: 500; color: #64748b;">activos</span>`;
        }

        // Actualizar contadores en pestañas
        const counts = kpis.tabCounts || {};
        const badges = this.element?.querySelectorAll('.payment-tab-badge');
        if (badges && badges.length >= 5) {
            badges[0].textContent = counts.todas || 0;
            badges[1].textContent = counts.pendientes || 0;
            badges[2].textContent = counts.al_dia || 0;
            badges[3].textContent = counts.top || 0;
            badges[4].textContent = counts.inactivos || 0;
        }

        // Renderizar tabla o analítica
        VendedoresEvents.aplicarFiltrosYRenderizar();
    },

    // Métodos de retrocompatibilidad con llamadas legadas
    async renderList(element) {
        await this.init(element);
    },

    async renderDetalle(element, id) {
        await this.init(element);
        if (id) await VendedoresEvents.abrirDrawer(id);
    },

    openVendedorModal(vendedor = null) {
        VendedoresEvents.abrirModalVendedor(vendedor);
    },

    openPagarComisionModal(comisionId, monto, cuentas, vendedorId) {
        VendedoresEvents.abrirModalPagarComision({ id: comisionId, monto }, cuentas);
    }
};

// Exportación unificada para router SPA
export default VendedoresModule;
export const init = (el) => VendedoresModule.init(el);
