// js/modules/gastos/compras.events.js
import DB from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions } from '../../shared/crud.js';
import { PrintManager } from '../../shared/printManager.js';
import { AbonoModal } from '../../shared/abonoModal.js';
import { EstadoUtils } from '../../shared/estadoUtils.js';

export const ComprasEvents = {
    _onKeyDown: null,

    /**
     * Enlaza eventos estáticos en el contenedor principal de la vista
     */
    bindStaticEvents(element, moduleInstance) {
        if (!element || !moduleInstance) return;

        // 1. Buscador en tiempo real con debounce
        const searchInput = element.querySelector('#searchCompras');
        const clearBtn = element.querySelector('#clearSearchBtnCompras');
        let debounceTimer;

        if (searchInput && clearBtn) {
            searchInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (val.length > 0) clearBtn.classList.remove('d-none');
                else clearBtn.classList.add('d-none');

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    moduleInstance.state.searchQuery = val.toLowerCase().trim();
                    moduleInstance.state.currentPage = 1;
                    moduleInstance.renderGrid();
                }, 350);
            });

            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                clearBtn.classList.add('d-none');
                searchInput.focus();
                moduleInstance.state.searchQuery = '';
                moduleInstance.state.currentPage = 1;
                moduleInstance.renderGrid();
            });
        }

        // 2. Pestañas Segmentadas
        element.querySelectorAll('.payment-tab-btn').forEach(tabBtn => {
            tabBtn.addEventListener('click', () => {
                element.querySelectorAll('.payment-tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                moduleInstance.state.selectedTab = tabBtn.dataset.tab || 'todas';
                moduleInstance.state.currentPage = 1;
                moduleInstance.renderGrid();
            });
        });

        // 3. Ordenamiento por Columnas
        element.querySelectorAll('.sortable-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const col = e.currentTarget.dataset.column;
                if (moduleInstance.state.sortColumn === col) {
                    moduleInstance.state.sortDirection = moduleInstance.state.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    moduleInstance.state.sortColumn = col;
                    moduleInstance.state.sortDirection = 'desc';
                }
                moduleInstance.renderGrid();
            });
        });

        // 4. Criterio de Búsqueda
        element.querySelectorAll('.filter-opt').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.preventDefault();
                moduleInstance.state.filterCriteria = e.target.dataset.criteria;
                const lbl = element.querySelector('#lbl-filtro-actual');
                if (lbl) {
                    lbl.textContent = moduleInstance.state.filterCriteria !== 'todos' ? `(${e.target.textContent.trim()})` : '';
                }
                moduleInstance.state.currentPage = 1;
                moduleInstance.renderGrid();
            });
        });

        // 5. Botón Actualizar
        const btnRefreshList = element.querySelector('#btn-refresh-list');
        if (btnRefreshList) {
            btnRefreshList.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const originalHtml = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Actualizando...`;

                await moduleInstance.refreshAll();

                btn.innerHTML = originalHtml;
                btn.disabled = false;
            });
        }

        // 6. Botón Exportar a Excel
        const btnExportList = element.querySelector('#btn-export-list');
        if (btnExportList) {
            btnExportList.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const originalHtml = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Generando...`;

                try {
                    await moduleInstance.exportarExcel(btn);
                } catch (err) {
                    console.error('[ComprasEvents] Error exportando:', err);
                } finally {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }
            });
        }

        // 7. Botón Nueva Factura
        const btnNuevaFactura = element.querySelector('#btn-nueva-factura');
        if (btnNuevaFactura) {
            btnNuevaFactura.addEventListener('click', () => {
                window.location.hash = '#/gastos/proveedores/nueva';
            });
        }

        // 8. Control del Drawer (Backdrop, Botón Cerrar y Escape)
        const backdrop = element.querySelector('#compras-drawer-backdrop');
        const btnClose = element.querySelector('#btn-close-drawer');

        if (backdrop) {
            backdrop.addEventListener('click', () => moduleInstance.cerrarDrawer());
        }
        if (btnClose) {
            btnClose.addEventListener('click', () => moduleInstance.cerrarDrawer());
        }

        if (this._onKeyDown) {
            document.removeEventListener('keydown', this._onKeyDown);
        }
        this._onKeyDown = (e) => {
            if (e.key === 'Escape') {
                const drawer = document.getElementById('compras-drawer');
                if (drawer && drawer.classList.contains('show')) {
                    moduleInstance.cerrarDrawer();
                }
            }
        };
        document.addEventListener('keydown', this._onKeyDown);
    },

    /**
     * Enlaza eventos dinámicos en filas y controles tras cada renderizado del grid
     */
    bindDynamicEvents(element, moduleInstance) {
        if (!element || !moduleInstance) return;

        // 1. Clic en Fila -> Abre Drawer de Inspección Rápida
        element.querySelectorAll('.payment-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('a')) return;
                const id = row.dataset.id;
                if (id) moduleInstance.mostrarDrawer(id);
            });
        });

        // 2. Botón de Inspección Rápida (Ojito)
        element.querySelectorAll('.btn-quick-view-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (id) moduleInstance.mostrarDrawer(id);
            });
        });

        // 3. Botón de Impresión Rápida
        element.querySelectorAll('.btn-imprimir-row').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                await moduleInstance.imprimirDocumento(id);
            });
        });

        // 4. Menú de Opciones Flotante (3 puntos)
        element.querySelectorAll('.btn-menu-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const existing = document.querySelector('.row-action-menu');
                if (existing) existing.remove();

                const id = e.currentTarget.dataset.id;
                const rect = e.currentTarget.getBoundingClientRect();
                const factData = moduleInstance.state.currentItems.find(f => String(f.id) === String(id));

                const canAbonar = factData && factData.estado !== 'pagada' && !EstadoUtils.estaAnulado(factData.estado) && Number(factData.saldoPendiente) > 0;
                const isAnulada = factData && EstadoUtils.estaAnulado(factData.estado);

                const menuHtml = `
                    <div class="row-action-menu position-absolute bg-white shadow rounded border py-2" 
                         style="z-index: 1060; width: 160px; top: ${rect.bottom + window.scrollY}px; left: ${rect.left - 110}px; font-family: 'Inter', system-ui, sans-serif;">
                        <a href="#" class="d-flex align-items-center px-3 py-1.5 text-decoration-none btn-inspect-menu" data-id="${id}" style="color: var(--primary); font-size: 13px;">
                            <i class="bi bi-eye me-2"></i> Ver en Drawer
                        </a>
                        ${canAbonar ? `
                        <a href="#" class="d-flex align-items-center px-3 py-1.5 text-decoration-none btn-abonar-factura" data-id="${id}" style="color: var(--success); font-size: 13px;">
                            <i class="bi bi-wallet2 me-2"></i> Registrar Pago
                        </a>
                        <hr class="dropdown-divider my-1">` : ''}
                        ${!isAnulada ? `
                        <a href="#/gastos/proveedores/editar/${id}" class="d-flex align-items-center px-3 py-1.5 text-decoration-none" style="color: var(--text-body); font-size: 13px;">
                            <i class="bi bi-pencil me-2"></i> Editar
                        </a>
                        <a href="#" class="d-flex align-items-center px-3 py-1.5 text-decoration-none mt-1 btn-delete-row text-danger" data-id="${id}" style="font-size: 13px;">
                            <i class="bi bi-x-circle me-2"></i> Anular
                        </a>` : `
                        <a href="#/gastos/proveedores/ver/${id}" class="d-flex align-items-center px-3 py-1.5 text-decoration-none" style="color: var(--text-body); font-size: 13px;">
                            <i class="bi bi-file-earmark-text me-2"></i> Ver Formulario
                        </a>`}
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', menuHtml);

                const menu = document.querySelector('.row-action-menu');

                // Inspect option
                menu.querySelector('.btn-inspect-menu')?.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    menu.remove();
                    moduleInstance.mostrarDrawer(id);
                });

                // Registrar Pago
                if (canAbonar) {
                    menu.querySelector('.btn-abonar-factura')?.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        menu.remove();
                        AbonoModal.show(id, () => {
                            moduleInstance.refreshAll();
                        });
                    });
                }

                // Anular
                if (!isAnulada) {
                    menu.querySelector('.btn-delete-row')?.addEventListener('click', async (ev) => {
                        ev.preventDefault();
                        menu.remove();
                        if (confirm('¿Estás seguro de anular esta factura de compra? Se revertirá automáticamente el stock de inventario ingresado.')) {
                            await moduleInstance.anularFactura(id);
                        }
                    });
                }
            });
        });

        // 5. Paginación
        element.querySelector('#select-per-page')?.addEventListener('change', (e) => {
            moduleInstance.state.itemsPerPage = parseInt(e.target.value, 10);
            moduleInstance.state.currentPage = 1;
            moduleInstance.renderGrid();
        });

        element.querySelector('#input-page')?.addEventListener('change', (e) => {
            let val = parseInt(e.target.value, 10) || 1;
            moduleInstance.state.currentPage = val;
            moduleInstance.renderGrid();
        });

        element.querySelector('#btn-prev-page')?.addEventListener('click', () => {
            if (moduleInstance.state.currentPage > 1) {
                moduleInstance.state.currentPage--;
                moduleInstance.renderGrid();
            }
        });

        element.querySelector('#btn-next-page')?.addEventListener('click', () => {
            if (moduleInstance.state.currentPage < moduleInstance.state.totalPages) {
                moduleInstance.state.currentPage++;
                moduleInstance.renderGrid();
            }
        });
    },

    /**
     * Enlaza eventos del slide-over drawer
     */
    bindDrawerEvents(footerElement, drawerBody, moduleInstance, data) {
        if (!footerElement || !moduleInstance || !data) return;

        const fac = data.fac;

        // Botón Cerrar
        footerElement.querySelector('#btn-drawer-cerrar')?.addEventListener('click', () => {
            moduleInstance.cerrarDrawer();
        });

        // Botón Imprimir
        footerElement.querySelector('#btn-drawer-imprimir')?.addEventListener('click', async () => {
            await moduleInstance.imprimirDocumento(fac.id);
        });

        // Botón Registrar Pago / Abonar
        footerElement.querySelector('#btn-drawer-abonar')?.addEventListener('click', () => {
            moduleInstance.cerrarDrawer();
            AbonoModal.show(fac.id, () => {
                moduleInstance.refreshAll();
            });
        });

        // Botón Anular
        footerElement.querySelector('#btn-drawer-anular')?.addEventListener('click', async () => {
            if (confirm('¿Estás seguro de anular esta factura de compra? Se revertirá automáticamente el stock de inventario ingresado.')) {
                moduleInstance.cerrarDrawer();
                await moduleInstance.anularFactura(fac.id);
            }
        });
    },

    /**
     * Limpia listeners globales al desmontar el módulo
     */
    cleanup() {
        if (this._onKeyDown) {
            document.removeEventListener('keydown', this._onKeyDown);
            this._onKeyDown = null;
        }
        const existing = document.querySelector('.row-action-menu');
        if (existing) existing.remove();
    }
};
