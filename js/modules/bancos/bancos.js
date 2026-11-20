// js/modules/bancos/bancos.js
// Orquestador Principal del Módulo de Bancos y Cajas 360° (Homologado con Gastos Operativos y crudFinanciero.js)

import { TesoreriaData } from './bancos.data.js';
import { TesoreriaTemplates } from './bancos.templates.js';
import { TesoreriaEvents } from './bancos.events.js';

export const TesoreriaModule = {
    // Mantener para compatibilidad en caso de referencias externas legacy
    cuentasConfig: [],

    state: {
        todasLasCuentas: [],
        cuentasActivas: [],
        saldos: {},
        totalConsolidado: 0,
        datosGrafica: [],
        chartInstance: null,
        donutInstance: null,
        currentTab: 'todas',
        searchQuery: '',
        currentView: 'lista',
        currentPage: 1,
        itemsPerPage: 10,
        activeDrawerCuentaId: null,
        kpis: {
            totalConsolidado: 0,
            totalBancos: 0,
            bancosCount: 0,
            totalCajas: 0,
            cajasCount: 0,
            movimientosPorConciliar: 0,
            tabCounts: { todas: 0, bancos: 0, cajas: 0, inactivas: 0 }
        }
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        // 1. Reset de estado para montaje limpio
        this.state.currentPage = 1;
        this.state.searchQuery = '';
        this.state.currentTab = 'todas';
        this.state.currentView = 'lista';
        this.state.activeDrawerCuentaId = null;

        // 2. Renderizar Layout Base homologado
        element.innerHTML = this.renderLayout(this.state);

        // 3. Vincular Eventos
        this.bindEvents();

        // 4. Cargar Datos y Saldo
        await this.loadData();
    }
};

Object.assign(TesoreriaModule, TesoreriaData, TesoreriaTemplates, TesoreriaEvents);
