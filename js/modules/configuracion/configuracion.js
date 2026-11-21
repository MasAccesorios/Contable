// js/modules/configuracion/configuracion.js
// Orquestador Principal del Módulo de Configuración 360° (Línea Gastos Operativos)

import { ConfiguracionData } from './configuracion.data.js';
import { ConfiguracionTemplates } from './configuracion.templates.js';
import { ConfiguracionEvents } from './configuracion.events.js';

export const ConfiguracionModule = {
    element: null,

    state: {
        currentTab: 'consecutivos',
        proximoFactura: 1,
        proximoCotizacion: 1,
        maxActual: 0,
        categorias: [],
        catFilter: 'todas',
        catQuery: '',
        empresa: {},
        kpis: {}
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
                    <p class="mt-3 text-muted fw-medium" style="font-size: 14px;">Cargando parámetros del sistema y secuencias...</p>
                </div>
            </div>
        `;

        await this.cargarDatos();
        this.render();
        ConfiguracionEvents.init(this);
    },

    async cargarDatos() {
        const datos = await ConfiguracionData.cargarDatosIniciales();
        this.state.proximoFactura = datos.proximoFactura;
        this.state.proximoCotizacion = datos.proximoCotizacion;
        this.state.maxActual = datos.maxActual;
        this.state.categorias = datos.categorias;
        this.state.empresa = datos.empresa;
        this.state.kpis = ConfiguracionData.calcularKpis(this.state);
    },

    render() {
        if (!this.element) return;
        this.element.innerHTML = ConfiguracionTemplates.renderLayout(this.state);
    },

    async recargar() {
        await this.cargarDatos();
        ConfiguracionEvents.actualizarKpisEnDOM();
        ConfiguracionEvents.renderActiveTab();
    }
};

// Exportación unificada para router SPA
export default ConfiguracionModule;
export const init = (el) => ConfiguracionModule.init(el);
