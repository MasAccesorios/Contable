
import { CoreActions } from '../../../shared/crud.js';
import { PagosRealizadosData } from './pagosRealizados.data.js';
import { PagosRealizadosTemplates } from './pagosRealizados.templates.js';
import { PagosRealizadosEvents } from './pagosRealizados.events.js';

export const PagosRealizadosModule = {
    state: {
        view: 'lista',
        currentComprobanteData: null,
        pagos: [],
        currentPage: 1,
        itemsPerPage: 10,
        searchQuery: '',
        totalItems: 0,
        isLoading: false,
        kpis: { total: 0 }
    },

    async init(element) {
        if (!element) return;
        this.element = element;
        await this.calcularKPIs();
        this.renderList();
        await this.cargarPagos();
    },

    async mostrarDetalle(id, mode = 'preview') {
        if (mode === 'print' || mode === 'vista-previa') {
            const t = await this._cargarComprobanteAgrupado(id);
            if (t) {
                const { PrintManager } = await import('../../../shared/printManager.js');
                const idVisual = t.grupo_pago_id ? (t.numero_recibo ? String(t.numero_recibo).padStart(4, '0') : t.grupo_pago_id) : (t.numero || t.id);
                PrintManager._renderPreviewShell(this.getComprobanteHTML(t, true), { mode: mode === 'vista-previa' ? 'preview' : 'print', title: 'Comprobante de Egreso', fileName: `comprobante_egreso_${idVisual}.png`, printClass: 'formato-media-carta' });
            }
            return;
        }

        this.state.isLoading = true;
        this.renderGrid();
        try {
            const t = await this._cargarComprobanteAgrupado(id);
            if (t) {
                this.state.currentComprobanteData = t;
                this.state.view = 'detalle';
            }
        } catch (e) {
            console.error('Error cargando detalle:', e);
            CoreActions.showWarningModal('Error al cargar el detalle del pago.');
        } finally {
            this.state.isLoading = false;
            this.render();
        }
    },

    render() {
        const listContainer = this.element.querySelector('#pagos-list-container');
        const detailContainer = this.element.querySelector('#pagos-detail-container');

        if (this.state.view === 'detalle' && this.state.currentComprobanteData) {
            if (listContainer) listContainer.style.display = 'none';
            if (detailContainer) {
                detailContainer.style.display = 'block';
                this.renderComprobanteWrapper(detailContainer);
            }
        } else {
            if (detailContainer) {
                detailContainer.style.display = 'none';
                detailContainer.innerHTML = '';
            }
            if (listContainer) {
                listContainer.style.display = 'block';
                this.renderGrid();
            }
        }
    },

};

Object.assign(PagosRealizadosModule, PagosRealizadosData, PagosRealizadosTemplates, PagosRealizadosEvents);
