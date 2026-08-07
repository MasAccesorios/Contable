import { supabase } from '../../core/supabase.js';
import { CoreActions } from '../../shared/crud.js';
import { AbonoModal } from '../../shared/abonoModal.js';
import { anularTransaccion } from '../../shared/transaccionesUtils.js';

export const PagosRecibidosModule = {
    state: {
        pagos: [],
        currentPage: 1,
        itemsPerPage: 10,
        searchQuery: '',
        totalItems: 0,
        isLoading: false
    },

    async init(element) {
        if (!element) return;
        this.element = element;
        
        window.abrirVistaA4Ingreso = async (id, mode = 'preview') => {
            const { supabase } = await import('../../core/supabase.js');
            const { data: t } = await supabase.from('pagos_ingresos').select('*, contactos(*), cuentas_bancarias(*), facturas(*)').eq('id', id).single();
            if (!t) return;
            
            const htmlContent = `
                <div style="padding: 20px; font-family: 'Inter', sans-serif; color: #333;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #2cbfb7; padding-bottom: 20px; margin-bottom: 30px;">
                        <div>
                            <h1 style="margin: 0; font-size: 24px; color: #0c1a30; font-weight: 800;">DIEGO IZQUIERDO</h1>
                            <p style="margin: 5px 0 0 0; font-size: 13px; color: #6c757d;">NIT: 79981638-4<br>Cra.111A No.148-50 4-1404<br>Tel: +57 3158512091<br><span style="background-color:#f8f9fa; border:1px solid #dee2e6; padding:2px 6px; font-size:10px; border-radius:4px; color:#6c757d;">No responsable de IVA</span></p>
                        </div>
                        <div style="text-align: right;">
                            <h2 style="margin: 0; font-size: 20px; color: #2cbfb7;">COMPROBANTE DE INGRESO</h2>
                            <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold;">Nº ${t.numero || t.id}</p>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 30px; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <div>
                            <p style="margin: 0 0 5px 0; font-size: 12px; color: #6c757d; font-weight: bold;">FECHA</p>
                            <p style="margin: 0; font-size: 14px;">${t.fecha}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 5px 0; font-size: 12px; color: #6c757d; font-weight: bold;">RECIBIDO DE</p>
                            <p style="margin: 0; font-size: 14px;">${t.contactos?.nombre || '---'}</p>
                        </div>
                        <div>
                            <p style="margin: 0 0 5px 0; font-size: 12px; color: #6c757d; font-weight: bold;">CUENTA BANCARIA</p>
                            <p style="margin: 0; font-size: 14px;">${t.cuentas_bancarias?.nombre || '---'}</p>
                        </div>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                        <thead>
                            <tr style="background-color: #0c1a30; color: white;">
                                <th style="padding: 10px; text-align: left; font-size: 13px;">Concepto</th>
                                <th style="padding: 10px; text-align: left; font-size: 13px;">Factura Asociada</th>
                                <th style="padding: 10px; text-align: right; font-size: 13px;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 12px 10px; font-size: 14px;">${t.categoria || 'Abono / Pago'}</td>
                                <td style="padding: 12px 10px; font-size: 14px;">${t.factura_id ? '#' + (t.facturas?.numero || t.factura_id) : 'Ninguna'}</td>
                                <td style="padding: 12px 10px; text-align: right; font-weight: bold; font-size: 14px;">$${Number(t.monto).toLocaleString('es-CO')}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="width: 60%;">
                            <p style="margin: 0 0 5px 0; font-size: 12px; color: #6c757d; font-weight: bold;">OBSERVACIONES</p>
                            <p style="margin: 0; font-size: 13px; font-style: italic;">${t.observaciones || 'Sin observaciones.'}</p>
                        </div>
                        <div style="width: 35%; background-color: #f8f9fa; padding: 15px; border-radius: 8px; text-align: right;">
                            <p style="margin: 0 0 5px 0; font-size: 12px; color: #6c757d; font-weight: bold;">TOTAL PAGADO</p>
                            <p style="margin: 0; font-size: 22px; font-weight: 900; color: #0c1a30;">$${Number(t.monto).toLocaleString('es-CO')}</p>
                        </div>
                    </div>
                    
                    <style>@media print { .no-print { display: none !important; } }</style>
                    ${mode === 'preview' ? `
                    <div class="no-print" style="margin-top: 40px; text-align: center;">
                        <button onclick="window.editarTransaccionGlobalIn(${t.id})" style="background-color: #fff; border: 1px solid #dee2e6; padding: 8px 16px; border-radius: 6px; cursor: pointer; color: #495057;">
                            <i class="bi bi-pencil me-1"></i> Editar este pago
                        </button>
                    </div>` : ''}
                </div>
            `;
            const { PrintManager } = await import('../../shared/crud.js');
            PrintManager._renderPreviewShell(htmlContent, { mode, title: 'Comprobante de Ingreso', fileName: `comprobante_ingreso_${t.numero || t.id}.png` });
        };
        
        window.editarTransaccionGlobalIn = (id) => {
            const printView = document.getElementById('print-view-container');
            if (printView) printView.remove();
            
            import('../../shared/transaccionModal.js').then(async m => {
                const { supabase } = await import('../../core/supabase.js');
                const { data } = await supabase.from('pagos_ingresos').select('*').eq('id', id).single();
                if (data) {
                    m.mostrarDetalleTransaccion(data, () => this.cargarPagos());
                    setTimeout(() => {
                        const btnEdit = document.getElementById('btn-activar-edicion');
                        if (btnEdit) btnEdit.click();
                    }, 200);
                }
            });
        };

        await this.cargarPagos();
    },

    async cargarPagos() {
        this.state.isLoading = true;
        this.render();

        try {
            const { data, error } = await supabase.rpc('get_pagos_lista', {
                p_tipo: 'in',
                p_page: this.state.currentPage,
                p_limit: this.state.itemsPerPage,
                p_search: this.state.searchQuery
            });

            if (error) throw error;

            this.state.pagos = data || [];
            this.state.totalItems = this.state.pagos.length > 0 ? Number(this.state.pagos[0].total_count) : 0;
        } catch (error) {
            console.error('Error cargando pagos recibidos:', error);
            CoreActions.showWarningModal('Error al cargar la lista de pagos: ' + (error.message || error));
        } finally {
            this.state.isLoading = false;
            this.render();
            this.bindEvents();
        }
    },

    render() {
        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formatFecha = dateStr => {
            if (!dateStr) return '---';
            const partes = dateStr.split('-');
            return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dateStr;
        };

        const totalPages = Math.ceil(this.state.totalItems / this.state.itemsPerPage) || 1;
        const startItem = (this.state.currentPage - 1) * this.state.itemsPerPage + 1;
        const endItem = Math.min(this.state.currentPage * this.state.itemsPerPage, this.state.totalItems);

        this.element.innerHTML = `
            <div class="py-3 px-4" style="font-family: 'Inter', sans-serif; background-color: #f8f9fa; min-height: 100vh; font-size: 13px;">
                
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="fw-bold text-dark m-0" style="font-size: 22px; color: #0c1a30 !important;">Pagos Recibidos</h2>
                        <p class="text-muted m-0 mt-1" style="font-size: 13px;">Historial de todos los ingresos de dinero (tipo "Entrada").</p>
                    </div>
                </div>

                <div class="card shadow-sm border border-light-subtle bg-white" style="border-radius: 6px;">
                    <div class="card-header bg-white border-bottom-0 p-3 d-flex justify-content-between align-items-center">
                        <div class="input-group" style="width: 300px;">
                            <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                            <input type="text" class="form-control border-start-0 ps-0" id="search-pagos" placeholder="Buscar por número o cliente..." value="${this.state.searchQuery}" style="font-size: 13px;">
                        </div>
                    </div>

                    <div class="table-responsive position-relative">
                        ${this.state.isLoading ? `
                            <div class="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-white bg-opacity-75" style="z-index: 10;">
                                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>
                            </div>
                        ` : ''}
                        <table class="table align-middle table-hover m-0 text-nowrap">
                            <thead class="table-light text-secondary fw-semibold border-bottom" style="--bs-table-bg: #f9fbfd; font-size: 12px;">
                                <tr>
                                    <th class="ps-4 py-2.5">Número</th>
                                    <th>Cliente</th>
                                    <th>Detalles</th>
                                    <th>Creación</th>
                                    <th>Cuenta bancaria</th>
                                    <th>Estado</th>
                                    <th class="text-end pe-4">Monto</th>
                                    <th style="width: 50px;"></th>
                                </tr>
                            </thead>
                            <tbody style="font-size: 13px; color: #2c3e50;">
                                ${this.state.pagos.length > 0 ? this.state.pagos.map(pago => {
                                    
                                    let detallesHtml = pago.categoria || 'Sin detalle';
                                    if (pago.factura_id) {
                                        detallesHtml = `<a href="#/ingresos/facturas/ver/${pago.factura_id}" class="text-decoration-none text-primary" onclick="event.stopPropagation()">Factura #${pago.factura_numero || pago.factura_id}</a>`;
                                    }

                                    return `
                                        <tr style="cursor: pointer;" onclick="if(!event.target.closest('.btn-menu-row') && !event.target.closest('.dropdown-menu') && !event.target.closest('a')) window.abrirVistaA4Ingreso(${pago.id})">
                                            <td class="ps-4 fw-medium text-dark">${pago.numero}</td>
                                            <td class="text-muted text-truncate" style="max-width: 200px;">${pago.cliente}</td>
                                            <td class="text-truncate" style="max-width: 200px;">${detallesHtml}</td>
                                            <td class="text-muted">${formatFecha(pago.fecha)}</td>
                                            <td class="text-dark fw-medium text-truncate" style="max-width: 150px;">${pago.cuenta_bancaria}</td>
                                            <td>
                                                ${pago.estado_transaccion === 'anulado' 
                                                    ? `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle rounded-pill" style="font-size: 11px;">Anulado</span>`
                                                    : `<span class="d-flex align-items-center gap-1.5">
                                                          <span style="color: ${pago.estado_conciliacion ? '#22c55e' : '#cbd5e1'}; font-size: 14px;">${pago.estado_conciliacion ? '●' : '○'}</span>
                                                          <span class="text-secondary" style="font-size: 12.5px;">${pago.estado_conciliacion ? 'Conciliado' : 'No conciliado'}</span>
                                                       </span>`
                                                }
                                            </td>
                                            <td class="text-end fw-bold pe-4 ${pago.estado_transaccion === 'anulado' ? 'text-muted text-decoration-line-through opacity-50' : 'text-success'}">
                                                + ${formatMoney(pago.monto)}
                                            </td>
                                            <td class="pe-3 position-relative">
                                                <button class="btn btn-sm btn-link text-secondary p-0 border-0 btn-menu-row" data-id="${pago.id}" data-conciliado="${pago.estado_conciliacion}" data-factura="${pago.factura_id || ''}" data-anulado="${pago.estado_transaccion === 'anulado'}" style="text-decoration: none; font-size: 16px;">⋮</button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('') : `
                                    <tr>
                                        <td colspan="8" class="text-center text-muted py-5">
                                            <div class="mb-3"><i class="bi bi-inbox fs-1 text-secondary opacity-50"></i></div>
                                            <p class="mb-0">No se encontraron pagos recibidos.</p>
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>

                    <!-- PAGINADOR SERVER-SIDE -->
                    <div class="card-footer bg-white border-top d-flex justify-content-between align-items-center px-4 py-3 text-muted" style="font-size: 12px;">
                        <div class="d-flex align-items-center gap-2">
                            <span>Ítems por página:</span>
                            <select id="select-limit" class="form-select form-select-sm border-light-subtle" style="width: 65px; font-size: 12px; padding-top: 2px; padding-bottom: 2px;">
                                <option value="10" ${this.state.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                                <option value="20" ${this.state.itemsPerPage === 20 ? 'selected' : ''}>20</option>
                                <option value="50" ${this.state.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                            </select>
                            <span class="ms-2">${this.state.totalItems > 0 ? `${startItem}-${endItem} de ${this.state.totalItems}` : '0-0 de 0'}</span>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <span>Página <input type="number" id="input-page" min="1" max="${totalPages}" value="${this.state.currentPage}" class="form-control form-control-sm d-inline-block text-center" style="width: 45px; font-size: 12px; padding-top: 2px; padding-bottom: 2px;"> de ${totalPages}</span>
                            <div class="d-flex gap-1">
                                <button id="btn-prev" class="btn btn-sm btn-light border py-0 px-2" ${this.state.currentPage <= 1 ? 'disabled' : ''}>❮</button>
                                <button id="btn-next" class="btn btn-sm btn-light border py-0 px-2" ${this.state.currentPage >= totalPages ? 'disabled' : ''}>❯</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    bindEvents() {
        const inputSearch = this.element.querySelector('#search-pagos');
        let searchTimeout;
        if (inputSearch) {
            inputSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.state.searchQuery = e.target.value.trim();
                    this.state.currentPage = 1;
                    this.cargarPagos();
                }, 500);
            });
        }

        const selectLimit = this.element.querySelector('#select-limit');
        if (selectLimit) {
            selectLimit.addEventListener('change', (e) => {
                this.state.itemsPerPage = parseInt(e.target.value, 10);
                this.state.currentPage = 1;
                this.cargarPagos();
            });
        }

        const inputPage = this.element.querySelector('#input-page');
        if (inputPage) {
            inputPage.addEventListener('change', (e) => {
                let p = parseInt(e.target.value, 10);
                const max = parseInt(e.target.max, 10);
                if (p < 1) p = 1;
                if (p > max) p = max;
                this.state.currentPage = p;
                this.cargarPagos();
            });
        }

        const btnPrev = this.element.querySelector('#btn-prev');
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                if (this.state.currentPage > 1) {
                    this.state.currentPage--;
                    this.cargarPagos();
                }
            });
        }

        const btnNext = this.element.querySelector('#btn-next');
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                const max = parseInt(this.element.querySelector('#input-page').max, 10);
                if (this.state.currentPage < max) {
                    this.state.currentPage++;
                    this.cargarPagos();
                }
            });
        }

        this.element.querySelectorAll('.btn-menu-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof window.cleanupFloatingElements === 'function') {
                    window.cleanupFloatingElements();
                }

                const id = btn.getAttribute('data-id');
                const conciliado = btn.getAttribute('data-conciliado') === 'true';
                const anulado = btn.getAttribute('data-anulado') === 'true';
                const facturaId = btn.getAttribute('data-factura');
                const rect = btn.getBoundingClientRect();
                
                const menu = document.createElement('div');
                menu.className = 'dropdown-menu row-action-menu show shadow-sm border border-light-subtle';
                menu.style.position = 'fixed';
                menu.style.top = `${rect.bottom + window.scrollY}px`;
                menu.style.left = `${rect.left - 120}px`;
                menu.style.zIndex = '1050';
                menu.style.minWidth = '140px';
                menu.style.fontSize = '13px';
                menu.style.borderRadius = '6px';
                
                menu.innerHTML = `
                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-ver-${id}">
                        <i class="bi bi-eye text-secondary"></i> Ver detalle
                    </a>
                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-imprimir-${id}">
                        <i class="bi bi-printer text-secondary"></i> Imprimir
                    </a>
                    ${!anulado ? `
                        <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-editar-${id}">
                            <i class="bi bi-pencil text-secondary"></i> Editar
                        </a>
                        ${!conciliado ? `<a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-anular-${id}">
                            <i class="bi bi-x-circle text-secondary"></i> Anular
                        </a>` : `<div class="px-3 py-2 text-muted small fst-italic">No se puede anular un pago conciliado</div>`}
                        <div class="dropdown-divider my-1"></div>
                        <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-danger" href="#" id="action-eliminar-${id}">
                            <i class="bi bi-trash"></i> Eliminar
                        </a>
                    ` : ''}
                `;

                document.body.appendChild(menu);

                const actionVer = document.getElementById(`action-ver-${id}`);
                if (actionVer) {
                    actionVer.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();
                        window.abrirVistaA4Ingreso(id, 'preview');
                    });
                }
                
                const actionImprimir = document.getElementById(`action-imprimir-${id}`);
                if (actionImprimir) {
                    actionImprimir.addEventListener('click', async (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();
                        window.abrirVistaA4Ingreso(id, 'print');
                    });
                }
                
                const actionEditar = document.getElementById(`action-editar-${id}`);
                if (actionEditar) {
                    actionEditar.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();
                        import('../../shared/transaccionModal.js').then(m => {
                            supabase.from('pagos_ingresos').select('*').eq('id', id).single().then(({data}) => {
                                // Pasar un parámetro o usar un evento para abrir en modo edicion directamente
                                if (data) {
                                    m.mostrarDetalleTransaccion(data, () => this.cargarPagos());
                                    // Trigger click on edit button after modal loads
                                    setTimeout(() => {
                                        const btnEdit = document.getElementById('btn-activar-edicion');
                                        if (btnEdit) btnEdit.click();
                                    }, 200);
                                }
                            });
                        });
                    });
                }

                const actionAnular = document.getElementById(`action-anular-${id}`);
                if (actionAnular) {
                    actionAnular.addEventListener('click', async (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();
                        
                        if (confirm('¿Estás seguro de anular este pago? Esta acción no se puede deshacer.')) {
                            const {data: t} = await supabase.from('pagos_ingresos').select('*').eq('id', id).single();
                            if (t) {
                                try {
                                    await anularTransaccion(t);
                                    CoreActions.showWarningModal('Pago anulado con éxito', 'success');
                                    this.cargarPagos();
                                } catch (err) {
                                    CoreActions.showWarningModal('Error al anular: ' + err.message);
                                }
                            }
                        }
                    });
                }
                
                const actionEliminar = document.getElementById(`action-eliminar-${id}`);
                if (actionEliminar) {
                    actionEliminar.addEventListener('click', async (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();
                        
                        const {data: t} = await supabase.from('pagos_ingresos').select('*').eq('id', id).single();
                        if (t.factura_id) {
                            CoreActions.showWarningModal('No se puede eliminar un pago asociado a una factura. Por favor, usa la opción "Anular" en su lugar para mantener la consistencia del saldo.');
                            return;
                        }
                        if (conciliado) {
                            CoreActions.showWarningModal('No se puede eliminar un pago que ya ha sido conciliado. Usa la opción "Anular" en su lugar.');
                            return;
                        }
                        
                        if (confirm('¿Estás seguro de ELIMINAR permanentemente este pago? Esta acción no se puede deshacer.')) {
                            try {
                                await supabase.from('pagos_ingresos').delete().eq('id', id);
                                CoreActions.showWarningModal('Pago eliminado con éxito', 'success');
                                this.cargarPagos();
                            } catch (err) {
                                CoreActions.showWarningModal('Error al eliminar: ' + err.message);
                            }
                        }
                    });
                }
            });
        });
    }
};
