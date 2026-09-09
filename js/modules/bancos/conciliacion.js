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
        ajusteEntradas: 0
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
            this.state.bancoId = urlParams.get('banco_id');

            const hoy = new Date();
            const hace3MesesDate = new Date(hoy);
            hace3MesesDate.setMonth(hace3MesesDate.getMonth() - 3);
            this.state.fechaDesde = getLocalDate(hace3MesesDate);
            this.state.fechaHasta = getLocalDate(hoy);

            await this.loadData();
            this.renderBase();
            await this.cargarDatosRPC();
            this.calcularTotales();
            this.renderTabla();
            this.renderHistorial();
            this.attachEvents();
        }
    },
};

Object.assign(ConciliacionModule, ConciliacionData, ConciliacionTemplates, ConciliacionEvents);
