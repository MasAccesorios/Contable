import { AplicarSaldoNCModal } from './notasCredito.aplicarSaldo.js';
import { CoreActions } from '../../shared/crud.js';

export const NotasCreditoEvents = {
    bindStaticEvents() {
        if (!this.element) return;

        // 1. Búsqueda con Debounce
        const searchInput = this.element.querySelector('#search-nc');
        if (searchInput) {
            let debounceTimer = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.state.searchQuery = e.target.value;
                    this.state.currentPage = 1;
                    this.aplicarFiltros();
                    this.render();
                }, 250);
            });
        }

        // 2. Tabs de Segmented Control
        this.element.querySelectorAll('.payment-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                if (tab && tab !== this.state.selectedTab) {
                    this.state.selectedTab = tab;
                    this.state.currentPage = 1;

                    this.element.querySelectorAll('.payment-tab-btn').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');

                    this.aplicarFiltros();
                    this.render();
                }
            });
        });

        // 3. Botón Refrescar
        const btnRefresh = this.element.querySelector('#btn-refresh-nc');
        if (btnRefresh) {
            btnRefresh.onclick = async () => {
                const icon = btnRefresh.querySelector('i');
                if (icon) icon.classList.add('spin-animation');
                await this.cargarNotasCredito();
                this.renderLayoutActual();
                if (icon) icon.classList.remove('spin-animation');
            };
        }

        // 4. Cierre del Drawer
        const btnClose = this.element.querySelector('#btn-nc-drawer-close');
        const btnCloseBottom = this.element.querySelector('#btn-nc-drawer-close-bottom');
        const backdrop = this.element.querySelector('#nc-drawer-backdrop');

        if (btnClose) btnClose.onclick = () => this.cerrarDrawer();
        if (btnCloseBottom) btnCloseBottom.onclick = () => this.cerrarDrawer();
        if (backdrop) backdrop.onclick = () => this.cerrarDrawer();

        if (!this._onKeyDown) {
            this._onKeyDown = (e) => {
                if (e.key === 'Escape' && this.state.activeDrawerId) {
                    this.cerrarDrawer();
                }
            };
        }
        document.removeEventListener('keydown', this._onKeyDown);
        document.addEventListener('keydown', this._onKeyDown);
    },

    bindDynamicEvents(container) {
        if (!container) return;

        // 1. Clic en Fila de Nota -> Abrir Drawer
        container.querySelectorAll('.row-nota').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
                const id = row.dataset.id;
                if (id) this.mostrarDrawer(id);
            });
        });

        // 2. Botón Cruzar Saldo en la Fila
        container.querySelectorAll('.btn-aplicar-saldo-fila').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const ncId = btn.dataset.id;
                const ncNumero = btn.dataset.numero;
                const contactoId = btn.dataset.contactoId;
                const clienteNombre = btn.dataset.contactoNombre;
                const saldoAFavor = parseFloat(btn.dataset.saldoFavor) || 0;

                AplicarSaldoNCModal.abrir({
                    ncId,
                    ncNumero,
                    contactoId,
                    clienteNombre,
                    saldoAFavor,
                    onSuccess: async () => {
                        await this.cargarNotasCredito();
                        this.renderLayoutActual();
                    }
                });
            });
        });

        // 3. Botón Ver Drawer en Fila
        container.querySelectorAll('.btn-drawer-nc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (id) this.mostrarDrawer(id);
            });
        });

        // 4. Paginador
        const selectLimit = container.querySelector('#select-nc-per-page');
        if (selectLimit) {
            selectLimit.addEventListener('change', (e) => {
                this.state.itemsPerPage = parseInt(e.target.value) || 20;
                this.state.currentPage = 1;
                this.render();
            });
        }

        const btnPrev = container.querySelector('#btn-nc-prev-page');
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                if (this.state.currentPage > 1) {
                    this.state.currentPage--;
                    this.render();
                }
            });
        }

        const btnNext = container.querySelector('#btn-nc-next-page');
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                const totalPages = Math.ceil(this.state.totalItems / this.state.itemsPerPage) || 1;
                if (this.state.currentPage < totalPages) {
                    this.state.currentPage++;
                    this.render();
                }
            });
        }
    },

    bindDrawerActionEvents(notaData, actionsContainer) {
        if (!actionsContainer || !notaData) return;
        const nota = notaData.nota;
        const cliente = notaData.cliente;
        const hasSaldo = nota.saldoAFavor > 0 && nota.estado !== 'anulada';
        const isAnulada = nota.estado === 'anulada' || nota.estado === 'void';

        actionsContainer.innerHTML = `
            ${hasSaldo ? `
                <button type="button" class="btn btn-warning text-dark fw-bold btn-sm px-3 shadow-xs d-flex align-items-center gap-1.5" id="btn-drawer-aplicar-saldo">
                    <i class="bi bi-arrow-left-right"></i> Cruzar Saldo
                </button>
            ` : ''}
            <button type="button" class="btn btn-outline-primary btn-sm px-3 fw-medium d-flex align-items-center gap-1.5" id="btn-drawer-ver-detalle">
                <i class="bi bi-file-earmark-text"></i> Ver Detalle
            </button>
            ${!isAnulada ? `
                <button type="button" class="btn btn-outline-danger btn-sm px-3 fw-medium d-flex align-items-center gap-1.5" id="btn-drawer-anular-nc">
                    <i class="bi bi-x-circle"></i> Anular
                </button>
            ` : ''}
        `;

        const btnAplicar = actionsContainer.querySelector('#btn-drawer-aplicar-saldo');
        if (btnAplicar) {
            btnAplicar.onclick = () => {
                AplicarSaldoNCModal.abrir({
                    ncId: nota.id,
                    ncNumero: nota.numero || nota.id,
                    contactoId: nota.contacto_id,
                    clienteNombre: cliente?.nombre || 'Sin cliente',
                    saldoAFavor: nota.saldoAFavor,
                    onSuccess: async () => {
                        this.cerrarDrawer();
                        await this.cargarNotasCredito();
                        this.renderLayoutActual();
                    }
                });
            };
        }

        const btnVer = actionsContainer.querySelector('#btn-drawer-ver-detalle');
        if (btnVer) {
            btnVer.onclick = () => {
                this.cerrarDrawer();
                window.location.hash = `#/ingresos/notas-credito/ver/${nota.id}`;
            };
        }

        const btnAnular = actionsContainer.querySelector('#btn-drawer-anular-nc');
        if (btnAnular) {
            btnAnular.onclick = async () => {
                if (confirm('¿Estás seguro de anular esta Nota de Crédito? Esto deshará la devolución de inventario y restaurará el saldo pendiente de la factura.')) {
                    btnAnular.disabled = true;
                    try {
                        CoreActions.showLoadingOverlay?.("Anulando nota de crédito...");
                        await this.anularNotaCredito(nota.id);
                        if (CoreActions.hideLoadingOverlay) CoreActions.hideLoadingOverlay();
                        CoreActions.showSuccessModal("Nota de Crédito anulada correctamente.");
                        this.cerrarDrawer();
                        await this.cargarNotasCredito();
                        this.renderLayoutActual();
                    } catch (err) {
                        btnAnular.disabled = false;
                        if (CoreActions.hideLoadingOverlay) CoreActions.hideLoadingOverlay();
                        CoreActions.showErrorModal("Error anulando: " + err.message);
                    }
                }
            };
        }
    }
};
