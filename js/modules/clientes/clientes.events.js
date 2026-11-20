// js/modules/clientes/clientes.events.js

import { escapeHtml } from '../../shared/formatters.js';

const showWarning = async (msg) => {
    if (typeof window !== 'undefined') {
        try {
            const { CoreActions } = await import('../../shared/crud.js');
            CoreActions.showWarningModal(msg);
        } catch {
            alert(msg);
        }
    } else {
        console.warn(msg);
    }
};

export const ContactosEvents = {
    bindEvents() {
        const el = this.element;
        let _searchTimer = null;

        // 1. Switcher de Vistas: Directorio vs Analítica
        const btnViewLista = el.querySelector('#btn-view-lista');
        const btnViewGrafico = el.querySelector('#btn-view-grafico');
        const tableViewContainer = el.querySelector('#contactos-table-view-container');
        const analyticsContainer = el.querySelector('#contactos-analytics-container');

        if (btnViewLista && btnViewGrafico) {
            btnViewLista.addEventListener('click', () => {
                this.state.view = 'lista';
                btnViewLista.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold text-dark';
                btnViewGrafico.className = 'btn btn-sm btn-light border-0 text-muted';
                if (tableViewContainer) tableViewContainer.style.display = 'block';
                if (analyticsContainer) analyticsContainer.style.display = 'none';
            });

            btnViewGrafico.addEventListener('click', async () => {
                this.state.view = 'grafico';
                btnViewGrafico.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold text-primary';
                btnViewLista.className = 'btn btn-sm btn-light border-0 text-muted';
                if (tableViewContainer) tableViewContainer.style.display = 'none';
                if (analyticsContainer) analyticsContainer.style.display = 'block';
                await this.renderAnalyticsView();
            });
        }

        // 2. Botón Nuevo Contacto
        el.querySelector('#btn-nuevo-contacto')?.addEventListener('click', () => this.renderForm());

        // 3. Botón Refrescar
        el.querySelector('#btn-refresh-list')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`;
            await this.cargarPagina();
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        });

        // 4. Botón Exportar Excel
        el.querySelector('#btn-export-excel')?.addEventListener('click', () => {
            this.exportarExcel();
        });

        // 5. Segmented Tabs de Filtro Rápido
        el.querySelectorAll('.payment-tab-btn[data-filter]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                el.querySelectorAll('.payment-tab-btn').forEach(t => t.classList.remove('active'));
                const btn = e.currentTarget;
                btn.classList.add('active');

                this.state.currentFilter = btn.dataset.filter;
                this.state.currentPage = 1;
                this.cargarPagina();
            });
        });

        // 6. Buscador Universal con Debounce 300ms
        const searchInput = el.querySelector('#search-contacto');
        const clearBtn = el.querySelector('#clearSearchBtnContactos');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
                clearTimeout(_searchTimer);
                _searchTimer = setTimeout(() => {
                    this.state.searchQuery = val.toLowerCase();
                    this.state.currentPage = 1;
                    this.cargarPagina();
                }, 300);
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                }
                clearBtn.style.display = 'none';
                this.state.searchQuery = '';
                this.state.currentPage = 1;
                this.cargarPagina();
            });
        }

        // 7. Selector de Ordenamiento
        el.querySelector('#sort-contactos')?.addEventListener('change', (e) => {
            const [col, dir] = e.target.value.split(':');
            this.state.sortColumn = col;
            this.state.sortDirection = dir || 'asc';
            this.state.currentPage = 1;
            this.cargarPagina();
        });

        // 8. Items por Página
        el.querySelector('#items-per-page')?.addEventListener('change', (e) => {
            this.state.itemsPerPage = parseInt(e.target.value, 10) || 25;
            this.state.currentPage = 1;
            this.cargarPagina();
        });

        // 9. Paginación Anterior y Siguiente
        el.querySelector('#btn-prev-page')?.addEventListener('click', () => {
            if (this.state.currentPage > 1) {
                this.state.currentPage--;
                this.cargarPagina();
            }
        });

        el.querySelector('#btn-next-page')?.addEventListener('click', () => {
            const totalPages = Math.ceil(this.state.totalCount / this.state.itemsPerPage) || 1;
            if (this.state.currentPage < totalPages) {
                this.state.currentPage++;
                this.cargarPagina();
            }
        });

        // 10. Check All Checkboxes
        el.querySelector('#check-all-contactos')?.addEventListener('change', (e) => {
            const checked = e.target.checked;
            el.querySelectorAll('.contact-check').forEach(chk => {
                chk.checked = checked;
            });
        });

        // 11. Eventos de Cierre del Drawer Lateral
        el.querySelector('#btn-drawer-close')?.addEventListener('click', () => this.cerrarDrawer());
        el.querySelector('#btn-drawer-close-bottom')?.addEventListener('click', () => this.cerrarDrawer());
        el.querySelector('#cliente-drawer-backdrop')?.addEventListener('click', () => this.cerrarDrawer());

        // Cerrar drawer con tecla ESC (idempotente para evitar listeners redundantes)
        if (this._onKeyDownEsc) {
            window.removeEventListener('keydown', this._onKeyDownEsc);
        }
        this._onKeyDownEsc = (e) => {
            if (e.key === 'Escape' && this.state.activeDrawerId) {
                this.cerrarDrawer();
            }
        };
        window.addEventListener('keydown', this._onKeyDownEsc);
    },

    bindFilaEvents() {
        const tbody = this.element.querySelector('#tbody-contactos');
        if (!tbody) return;

        // Clic en fila para abrir Drawer 360°
        tbody.querySelectorAll('.row-contacto').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
                const id = row.dataset.id;
                if (id) this.mostrarDrawer(id);
            });
        });

        // Botón Ver Ficha 360°
        tbody.querySelectorAll('.btn-ver-drawer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.mostrarDrawer(btn.dataset.id);
            });
        });

        // Botón Cobrar por WhatsApp
        tbody.querySelectorAll('.btn-wpp-cliente').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.enviarCobroWhatsAppCliente(btn.dataset.id);
            });
        });

        // Menú Flotante de Opciones (3 puntos) en Body (Previene overflow/scroll en tabla)
        tbody.querySelectorAll('.btn-menu-cliente').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const existing = document.querySelector('.row-action-menu');
                if (existing) existing.remove();

                const id = btn.dataset.id;
                const c = (this.state.contactos || []).find(item => String(item.id) === String(id));
                if (!c) return;

                const rect = btn.getBoundingClientRect();
                const menuWidth = 230;
                let top = rect.bottom + window.scrollY + 4;
                let left = rect.right - menuWidth + window.scrollX;
                if (left < 10) left = 10;

                // Si se sale de la pantalla por abajo, desplegar hacia arriba
                if (rect.bottom + 320 > window.innerHeight) {
                    top = Math.max(10, rect.top + window.scrollY - 320);
                }

                const menuHtml = `
                    <div class="row-action-menu position-absolute bg-white shadow-lg rounded-3 border py-1" 
                         style="z-index: 1070; width: ${menuWidth}px; top: ${top}px; left: ${left}px; font-family: inherit;">
                        <!-- HEADER RESUMEN -->
                        <div class="px-3 py-2 border-bottom bg-light rounded-top-3">
                            <div class="fw-bold text-dark text-truncate" style="font-size: 13px;">${escapeHtml(c.nombre || 'Contacto')}</div>
                            <div class="text-muted d-flex align-items-center gap-1" style="font-size: 11px;">
                                <span>NIT: ${escapeHtml(c.identificacion || c.nit || 'Sin NIT')}</span>
                                <span>•</span>
                                <span class="badge ${c.es_cliente !== false ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-secondary-subtle text-secondary'} rounded-pill" style="font-size: 9.5px;">
                                    ${c.es_cliente !== false ? 'Cliente' : 'Proveedor'}
                                </span>
                            </div>
                        </div>

                        <!-- GESTIÓN COMERCIAL -->
                        <div class="py-1">
                            <a href="#/ingresos/facturas?search=${encodeURIComponent(c.nombre)}" class="d-flex align-items-center px-3 py-2 text-decoration-none text-dark menu-item-hover btn-item-action" style="font-size: 13px;">
                                <i class="bi bi-receipt text-primary me-2" style="font-size: 15px;"></i> Ver facturas
                            </a>
                            <a href="#/ingresos/facturas/nueva?clienteId=${c.id}" class="d-flex align-items-center px-3 py-2 text-decoration-none text-dark menu-item-hover btn-item-action" style="font-size: 13px;">
                                <i class="bi bi-plus-circle text-success me-2" style="font-size: 15px;"></i> Nueva factura
                            </a>
                            <a href="#/ingresos/pagos/nuevo?clienteId=${c.id}" class="d-flex align-items-center px-3 py-2 text-decoration-none text-dark menu-item-hover btn-item-action" style="font-size: 13px;">
                                <i class="bi bi-cash-coin text-warning me-2" style="font-size: 15px;"></i> Registrar cobro
                            </a>
                            <a href="#/ingresos/cotizaciones/nueva?clienteId=${c.id}" class="d-flex align-items-center px-3 py-2 text-decoration-none text-dark menu-item-hover btn-item-action" style="font-size: 13px;">
                                <i class="bi bi-file-earmark-plus text-info me-2" style="font-size: 15px;"></i> Nueva cotización
                            </a>
                        </div>

                        <div class="border-top my-1"></div>

                        <!-- FICHA Y CONTACTO -->
                        <div class="py-1">
                            <a href="#" class="d-flex align-items-center px-3 py-2 text-decoration-none text-dark menu-item-hover btn-menu-drawer" data-id="${c.id}" style="font-size: 13px;">
                                <i class="bi bi-person-vcard text-secondary me-2" style="font-size: 15px;"></i> Ficha 360° & Cartera
                            </a>
                            ${(c.telefono || '').trim() ? `
                            <a href="#" class="d-flex align-items-center px-3 py-2 text-decoration-none text-dark menu-item-hover btn-menu-wpp" data-id="${c.id}" style="font-size: 13px;">
                                <i class="bi bi-whatsapp text-success me-2" style="font-size: 15px;"></i> Cobrar por WhatsApp
                            </a>` : ''}
                            <a href="#" class="d-flex align-items-center px-3 py-2 text-decoration-none text-dark menu-item-hover btn-menu-edit" data-id="${c.id}" style="font-size: 13px;">
                                <i class="bi bi-pencil text-muted me-2" style="font-size: 15px;"></i> Editar datos
                            </a>
                        </div>

                        <div class="border-top my-1"></div>

                        <!-- ACCIÓN DESTRUCTIVA -->
                        <div class="py-1">
                            <a href="#" class="d-flex align-items-center px-3 py-2 text-decoration-none text-danger menu-item-hover btn-menu-delete" data-id="${c.id}" style="font-size: 13px;">
                                <i class="bi bi-trash me-2" style="font-size: 15px;"></i> Desactivar contacto
                            </a>
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', menuHtml);
                const menu = document.querySelector('.row-action-menu');

                // Cerrar menú al hacer clic en enlaces de navegación
                menu.querySelectorAll('.btn-item-action').forEach(item => {
                    item.addEventListener('click', () => menu.remove());
                });

                menu.querySelector('.btn-menu-drawer')?.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    menu.remove();
                    this.mostrarDrawer(id);
                });

                menu.querySelector('.btn-menu-wpp')?.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    menu.remove();
                    this.enviarCobroWhatsAppCliente(id);
                });

                menu.querySelector('.btn-menu-edit')?.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    menu.remove();
                    this.renderForm(id);
                });

                menu.querySelector('.btn-menu-delete')?.addEventListener('click', async (ev) => {
                    ev.preventDefault();
                    menu.remove();
                    if (confirm('¿Está seguro de desactivar este contacto? No aparecerá en el listado activo pero se conservará su historial contable.')) {
                        const db = this.getDB ? await this.getDB() : (typeof window !== 'undefined' ? window.DB : null);
                        if (db) await db.save('contactos', { id, estado: 'inactive' });
                        await this.cargarPagina();
                    }
                });
            });
        });

        // Botón Editar (accesos directos legacy si existen)
        tbody.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.renderForm(btn.dataset.id);
            });
        });

        // Botón Desactivar (accesos directos legacy si existen)
        tbody.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('¿Está seguro de desactivar este contacto? No aparecerá en el listado activo pero se conservará su historial contable.')) {
                    const db = this.getDB ? await this.getDB() : (typeof window !== 'undefined' ? window.DB : null);
                    if (db) await db.save('contactos', { id: btn.dataset.id, estado: 'inactive' });
                    await this.cargarPagina();
                }
            });
        });
    },

    bindDrawerEvents(data) {
        const drawer = this.element.querySelector('#cliente-drawer');
        if (!drawer) return;

        const { contacto, facturasPendientes, totalSaldoPendiente } = data;

        // Configurar botones del footer del drawer
        const actionsContainer = this.element.querySelector('#cliente-drawer-actions');
        if (actionsContainer) {
            actionsContainer.innerHTML = `
                <button type="button" class="btn btn-outline-success btn-sm px-3 fw-medium" id="btn-drawer-whatsapp">
                    <i class="bi bi-whatsapp me-1"></i> Cobrar por WhatsApp
                </button>
                <a href="#/ingresos/facturas/nueva?cliente=${contacto.id}" class="btn btn-primary-action btn-sm px-3 fw-medium" id="btn-drawer-nueva-factura">
                    <i class="bi bi-plus-lg me-1"></i> Facturar
                </a>
                <button type="button" class="btn btn-light border btn-sm px-3 fw-medium" id="btn-drawer-editar">
                    <i class="bi bi-pencil me-1"></i> Editar
                </button>
            `;

            // Botón WhatsApp
            this.element.querySelector('#btn-drawer-whatsapp')?.addEventListener('click', () => {
                this.enviarCobroWhatsAppCliente(contacto.id, data);
            });

            // Botón Editar
            this.element.querySelector('#btn-drawer-editar')?.addEventListener('click', () => {
                this.cerrarDrawer();
                this.renderForm(contacto.id);
            });
        }

        // Botones de Abono individual a facturas en el drawer
        drawer.querySelectorAll('.btn-abonar-factura-drawer').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const facId = btn.dataset.id;
                const saldo = parseFloat(btn.dataset.saldo || 0);

                const { AbonoModal } = await import('../../shared/abonoModal.js');
                AbonoModal.show(facId, async () => {
                    await this.mostrarDrawer(contacto.id);
                    await this.cargarPagina();
                }, saldo);
            });
        });
    },

    async enviarCobroWhatsAppCliente(contactoId, preloadedData = null) {
        try {
            const { PrintManager } = await import('../../shared/printManager.js');
            await PrintManager.printEstadoCuenta(contactoId);
        } catch (err) {
            console.error('Error abriendo Estado de Cuenta para WhatsApp:', err);
            showWarning('Error al generar el Estado de Cuenta: ' + err.message);
        }
    },

    exportarExcel() {
        try {
            const contactos = this.state.contactos || [];
            if (contactos.length === 0) {
                showWarning('No hay contactos en la lista para exportar.');
                return;
            }

            const dataToExport = contactos.map(c => ({
                'Nombre / Razón Social': c.nombre,
                'NIT': c.nit || '',
                'Tipo': c.es_cliente !== false ? 'Cliente' : 'Proveedor',
                'Teléfono': c.telefono || '',
                'Email': c.email || '',
                'Ciudad': c.ciudad || '',
                'Dirección': c.direccion || '',
                'Ventas Totales (LTV)': parseFloat(c.ventas_totales_ltv || 0),
                'Total Facturas': parseInt(c.total_facturas || 0, 10),
                'Saldo Cartera': parseFloat(c.saldo_cartera || 0),
                'Facturas Pendientes': parseInt(c.facturas_pendientes || 0, 10),
                'Días Mora': parseInt(c.max_dias_mora || 0, 10),
                'Cupo de Crédito': parseFloat(c.cupo_credito || 0),
                'Plazos de Pago (Días)': parseInt(c.plazos_pago || 0, 10),
                'Vendedor Asignado': c.vendedor_nombre || 'Sin asignar'
            }));

            const dateStr = new Date().toISOString().split('T')[0];

            if (window.XLSX) {
                const ws = window.XLSX.utils.json_to_sheet(dataToExport);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, "Contactos_Clientes");
                window.XLSX.writeFile(wb, `Reporte_Clientes_${dateStr}.xlsx`);
            } else {
                const headers = Object.keys(dataToExport[0]);
                let csv = headers.join(';') + '\r\n';
                dataToExport.forEach(row => {
                    csv += headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(';') + '\r\n';
                });
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Reporte_Clientes_${dateStr}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error('Error exportando clientes:', e);
            showWarning('Error al exportar clientes: ' + e.message);
        }
    }
};
