import { PrintManager } from '../../shared/printManager.js';
import { CoreActions } from '../../shared/crud.js';

export const CuentaCobroEvents = {
    bindStaticEvents() {
        if (!this.element) return;

        // 1. Búsqueda con Debounce
        const searchInput = this.element.querySelector('#search-cc');
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
        const btnRefresh = this.element.querySelector('#btn-refresh-cc');
        if (btnRefresh) {
            btnRefresh.onclick = async () => {
                const icon = btnRefresh.querySelector('i');
                if (icon) icon.classList.add('spin-animation');
                try {
                    await this.cargarCuentasCobro();
                    this.renderLayoutActual();
                } catch (err) {
                    console.error('[CuentaCobroEvents] Error al refrescar:', err);
                } finally {
                    if (icon) icon.classList.remove('spin-animation');
                }
            };
        }

        // 4. Cierre del Drawer y Backdrop
        const btnClose = this.element.querySelector('#btn-cc-drawer-close');
        const btnCloseBottom = this.element.querySelector('#btn-cc-drawer-close-bottom');
        const backdrop = this.element.querySelector('#cc-drawer-backdrop');

        if (btnClose) btnClose.onclick = () => this.cerrarDrawer();
        if (btnCloseBottom) btnCloseBottom.onclick = () => this.cerrarDrawer();
        if (backdrop) backdrop.onclick = () => this.cerrarDrawer();

        if (!this._onKeyDown) {
            this._onKeyDown = (e) => {
                if (e.key === 'Escape' && this.state?.activeDrawerId) {
                    this.cerrarDrawer();
                }
            };
        }
        document.removeEventListener('keydown', this._onKeyDown);
        document.addEventListener('keydown', this._onKeyDown);
    },

    bindDynamicEvents(container) {
        if (!container) return;

        // 1. Clic en Fila -> Abrir Drawer Comprobante
        container.querySelectorAll('.row-cuenta-cobro').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
                const id = row.dataset.id;
                if (id) this.mostrarDrawer(id);
            });
        });

        // 2. Botón Ver Detalle (Ojo)
        container.querySelectorAll('.btn-drawer-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (id) this.mostrarDrawer(id);
            });
        });

        // 3. Botón Imprimir
        container.querySelectorAll('.btn-imprimir-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const doc = (this.state?.cuentas || []).find(c => String(c.id) === String(id));
                if (doc) {
                    PrintManager.printCuentaCobro(doc, 'print');
                }
            });
        });

        // 4. Botón Eliminar en fila
        container.querySelectorAll('.btn-eliminar-row').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (!id) return;

                if (confirm('¿Está seguro de que desea eliminar permanentemente esta cuenta de cobro?')) {
                    btn.disabled = true;
                    try {
                        await this.eliminarCuentaCobro(id);
                        CoreActions.showSuccessModal('Cuenta de cobro eliminada.');
                        await this.cargarCuentasCobro();
                        this.renderLayoutActual();
                    } catch (err) {
                        btn.disabled = false;
                        CoreActions.showErrorModal('Error al eliminar: ' + err.message);
                    }
                }
            });
        });

        // 5. Paginación Anterior y Siguiente
        const btnPrev = container.querySelector('.btn-page-prev');
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                if (this.state.currentPage > 1) {
                    this.state.currentPage--;
                    this.aplicarFiltros();
                    this.render();
                }
            });
        }

        const btnNext = container.querySelector('.btn-page-next');
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                if (this.state.currentPage < this.state.totalPages) {
                    this.state.currentPage++;
                    this.aplicarFiltros();
                    this.render();
                }
            });
        }
    },

    bindDrawerActionEvents(doc, container) {
        if (!container || !doc) return;

        const isCobrada = doc.isCobrada;
        const isAnulada = doc.isAnulada;

        container.innerHTML = `
            <button class="btn btn-sm btn-outline-secondary shadow-xs" id="btn-drawer-preview" title="Vista Previa">
                <i class="bi bi-eye me-1"></i>Vista Previa
            </button>
            <button class="btn btn-sm btn-outline-primary shadow-xs" id="btn-drawer-print" title="Imprimir">
                <i class="bi bi-printer me-1"></i>Imprimir
            </button>
            ${!isAnulada ? `
            <button class="btn btn-sm btn-primary shadow-xs" id="btn-drawer-edit" title="Editar">
                <i class="bi bi-pencil me-1"></i>Editar
            </button>
            ` : ''}
            ${!isCobrada && !isAnulada ? `
            <button class="btn btn-sm btn-success shadow-xs text-white" id="btn-drawer-marcar-cobrada" title="Marcar como cobrada">
                <i class="bi bi-check2-circle me-1"></i>Marcar Cobrada
            </button>
            <button class="btn btn-sm btn-outline-warning shadow-xs" id="btn-drawer-anular" title="Anular cuenta de cobro">
                <i class="bi bi-slash-circle me-1"></i>Anular
            </button>
            ` : ''}
            <button class="btn btn-sm btn-outline-danger shadow-xs" id="btn-drawer-delete" title="Eliminar cuenta de cobro">
                <i class="bi bi-trash me-1"></i>Eliminar
            </button>
        `;

        const btnPreview = container.querySelector('#btn-drawer-preview');
        if (btnPreview) {
            btnPreview.addEventListener('click', () => {
                PrintManager.printCuentaCobro(doc, 'preview');
            });
        }

        const btnPrint = container.querySelector('#btn-drawer-print');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                PrintManager.printCuentaCobro(doc, 'print');
            });
        }

        const btnEdit = container.querySelector('#btn-drawer-edit');
        if (btnEdit) {
            btnEdit.addEventListener('click', () => {
                this.cerrarDrawer();
                window.location.hash = `#/ingresos/cuenta-cobro/editar/${encodeURIComponent(doc.id)}`;
            });
        }

        const btnMarcarCobrada = container.querySelector('#btn-drawer-marcar-cobrada');
        if (btnMarcarCobrada) {
            btnMarcarCobrada.addEventListener('click', async () => {
                if (confirm('¿Desea marcar esta cuenta de cobro como cobrada/saldada?')) {
                    btnMarcarCobrada.disabled = true;
                    try {
                        await this.marcarCobradaCuentaCobro(doc.id);
                        CoreActions.showSuccessModal('Cuenta de cobro marcada como cobrada.');
                        this.cerrarDrawer();
                        await this.cargarCuentasCobro();
                        this.renderLayoutActual();
                    } catch (e) {
                        btnMarcarCobrada.disabled = false;
                        CoreActions.showErrorModal('Error: ' + e.message);
                    }
                }
            });
        }

        const btnAnular = container.querySelector('#btn-drawer-anular');
        if (btnAnular) {
            btnAnular.addEventListener('click', async () => {
                if (confirm('¿Está seguro de anular esta cuenta de cobro?')) {
                    btnAnular.disabled = true;
                    try {
                        await this.anularCuentaCobro(doc.id);
                        CoreActions.showSuccessModal('Cuenta de cobro anulada.');
                        this.cerrarDrawer();
                        await this.cargarCuentasCobro();
                        this.renderLayoutActual();
                    } catch (e) {
                        btnAnular.disabled = false;
                        CoreActions.showErrorModal('Error: ' + e.message);
                    }
                }
            });
        }

        const btnDelete = container.querySelector('#btn-drawer-delete');
        if (btnDelete) {
            btnDelete.addEventListener('click', async () => {
                if (confirm('¿Está seguro de eliminar permanentemente esta cuenta de cobro?')) {
                    btnDelete.disabled = true;
                    try {
                        await this.eliminarCuentaCobro(doc.id);
                        CoreActions.showSuccessModal('Cuenta de cobro eliminada.');
                        this.cerrarDrawer();
                        await this.cargarCuentasCobro();
                        this.renderLayoutActual();
                    } catch (e) {
                        btnDelete.disabled = false;
                        CoreActions.showErrorModal('Error: ' + e.message);
                    }
                }
            });
        }
    },

    cleanup() {
        if (this._onKeyDown) {
            document.removeEventListener('keydown', this._onKeyDown);
            this._onKeyDown = null;
        }
        if (this._drawerCloseTimer) {
            clearTimeout(this._drawerCloseTimer);
            this._drawerCloseTimer = null;
        }
    }
};
