// js/modules/bancos/conciliacion.js
// Orquestador Principal del Módulo de Conciliación Bancaria 360° (Homologado con Gastos Operativos y Bancos)

import { getLocalDate } from '../../core/db.js';
import { ConciliacionData } from './conciliacion.data.js';
import { ConciliacionTemplates } from './conciliacion.templates.js';
import { ConciliacionEvents } from './conciliacion.events.js';

export const ConciliacionModule = {
    state: {
        cuentas: [],
        historialConciliaciones: [],
        bancoId: null,
        fechaDesde: '',
        fechaHasta: '',
        saldoAnterior: 0,
        entradas: 0,
        salidas: 0,
        saldoBancario: 0,
        movimientosRango: [],
        editingConciliacionId: null,
        saldoTotalSistema: 0,
        ajusteGastos: 0,
        ajusteImpuestos: 0,
        ajusteEntradas: 0,
        currentTab: 'nueva',
        filterTipoMovs: 'todos',
        searchMovsQuery: '',
        diferenciaActual: 0,
        estadoSemaforo: 'cuadrado',
        _seleccionados: new Set()
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        const hashParts = window.location.hash.split('?')[0].split('/');
        const subAction = hashParts[3];
        const id = hashParts[4];

        if (subAction === 'detalle' && id) {
            await this.loadData();
            await this.renderDetalle(element, id);
        } else {
            const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
            const paramBancoId = urlParams.get('banco_id');
            if (paramBancoId) {
                this.state.bancoId = parseInt(paramBancoId, 10);
            }

            const hoy = new Date();
            const hace3MesesDate = new Date(hoy);
            hace3MesesDate.setMonth(hace3MesesDate.getMonth() - 3);
            this.state.fechaDesde = getLocalDate(hace3MesesDate);
            this.state.fechaHasta = getLocalDate(hoy);
            this.state.currentTab = 'nueva';
            this.state.filterTipoMovs = 'todos';
            this.state.searchMovsQuery = '';
            this.state._seleccionados = new Set();

            await this.loadData();
            this.renderBase();
            await this.cargarDatosRPC();
            this.calcularTotales();
            this.recalcularDiferenciaPendiente();
            this.renderTabla();
            this.renderHistorial();
            this.attachEvents();
        }
    }
};

Object.assign(ConciliacionModule, ConciliacionData, ConciliacionTemplates, ConciliacionEvents);
