import { supabase } from '../../../core/supabase.js';
import { CoreActions } from '../../../shared/crud.js';
import { PagosRecibidosData } from './pagosRecibidos.data.js';
import { PagosRecibidosTemplates } from './pagosRecibidos.templates.js';
import { PagosRecibidosEvents } from './pagosRecibidos.events.js';

export const PagosRecibidosModule = {
    state: {
        view: 'lista', // 'lista', 'grafico', 'detalle'
        currentComprobanteData: null,
        pagos: [],
        currentPage: 1,
        itemsPerPage: 10,
        searchQuery: '',
        selectedAccount: 'todas',
        selectedTab: 'todos',
        totalItems: 0,
        isLoading: false,
        kpis: {
            total: 0,
            totalAnterior: 0,
            variacion: 0,
            transaccionesMes: 0,
            totalHoy: 0,
            montoPendiente: 0,
            conteoPendiente: 0
        },
        cuentasBancarias: [],
        activeDrawerId: null
    },

    async init(element) {
        if (!element) return;
        this.element = element;
        await this.calcularKPIs();
        this.renderList();
        await this.cargarPagos();
    },

    async mostrarDrawer(id) {
        const backdrop = this.element.querySelector('#payment-drawer-backdrop');
        const drawer = this.element.querySelector('#payment-drawer');
        const body = this.element.querySelector('#payment-drawer-body');
        if (!drawer || !body) return;

        body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center py-5">
                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>
            </div>
        `;
        if (backdrop) backdrop.classList.add('show');
        drawer.classList.add('show');
        this.state.activeDrawerId = id;

        try {
            const t = await this._cargarComprobanteAgrupado(id);
            if (t) {
                this.state.currentComprobanteData = t;
                body.innerHTML = this.renderDrawerContent(t);

                // Configurar eventos del drawer
                const btnEdit = this.element.querySelector('#btn-drawer-editar');
                if (btnEdit) {
                    btnEdit.onclick = () => {
                        this.cerrarDrawer();
                        import('../../../shared/transaccionModal.js').then(m => {
                            m.mostrarDetalleTransaccion(t, async () => {
                                await this.calcularKPIs();
                                await this.cargarPagos();
                            });
                            setTimeout(() => {
                                const btnActivar = document.getElementById('btn-activar-edicion');
                                if (btnActivar) btnActivar.click();
                            }, 200);
                        });
                    };
                }

                const btnAnular = this.element.querySelector('#btn-drawer-anular');
                if (btnAnular) {
                    if (t.estado === 'anulado') {
                        btnAnular.style.display = 'none';
                    } else {
                        btnAnular.style.display = 'inline-block';
                        btnAnular.onclick = async () => {
                            if (confirm('¿Estás seguro de anular este pago? Esta acción no se puede deshacer.')) {
                                try {
                                    if (t.categoria === 'Transferencia') {
                                        const { error } = await supabase.rpc('anular_transferencia_pareja', { p_id: t.id });
                                        if (error) throw error;
                                    } else {
                                        const { anularTransaccion } = await import('../../../shared/transaccionesUtils.js');
                                        await anularTransaccion(t.id, false);
                                    }
                                    CoreActions.showWarningModal('Pago anulado con éxito', 'success');
                                    this.cerrarDrawer();
                                    await this.calcularKPIs();
                                    await this.cargarPagos();
                                } catch (err) {
                                    CoreActions.showWarningModal('Error al anular: ' + err.message);
                                }
                            }
                        };
                    }
                }

                const btnPrint = this.element.querySelector('#btn-drawer-print');
                if (btnPrint) {
                    btnPrint.onclick = () => this.mostrarDetalle(id, 'print');
                }

                const btnPrev = this.element.querySelector('#btn-drawer-preview');
                if (btnPrev) {
                    btnPrev.onclick = () => this.mostrarDetalle(id, 'vista-previa');
                }
            }
        } catch (err) {
            console.error('Error cargando comprobante para drawer:', err);
            body.innerHTML = `<div class="p-4 text-center text-danger">Error al cargar datos del comprobante.</div>`;
        }
    },

    cerrarDrawer() {
        const backdrop = this.element.querySelector('#payment-drawer-backdrop');
        const drawer = this.element.querySelector('#payment-drawer');
        if (backdrop) backdrop.classList.remove('show');
        if (drawer) drawer.classList.remove('show');
        this.state.activeDrawerId = null;
    },

    async mostrarDetalle(id, mode = 'preview') {
        if (mode === 'print' || mode === 'vista-previa') {
            const t = await this._cargarComprobanteAgrupado(id);
            if (t) {
                const { PrintManager } = await import('../../../shared/printManager.js');
                const idVisual = t.grupo_pago_id ? (t.numero_recibo ? String(t.numero_recibo).padStart(4, '0') : t.grupo_pago_id) : (t.numero || t.id);
                PrintManager._renderPreviewShell(this.getComprobanteHTML(t, true), { mode: mode === 'vista-previa' ? 'preview' : 'print', title: 'Comprobante de Ingreso', fileName: `comprobante_ingreso_${idVisual}.png`, printClass: 'formato-media-carta' });
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
    }
};

Object.assign(PagosRecibidosModule, PagosRecibidosData, PagosRecibidosTemplates, PagosRecibidosEvents);
