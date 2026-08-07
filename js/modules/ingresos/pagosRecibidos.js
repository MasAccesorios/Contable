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
            CoreActions.showWarningModal('Error al cargar la lista de pagos.');
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
                                        detallesHtml = \`<a href="#/ingresos/facturas/ver/\${pago.factura_id}" class="text-decoration-none text-primary" onclick="event.stopPropagation()">Factura #\${pago.factura_numero || pago.factura_id}</a>\`;
                                    }

                                    return \`
                                        <tr>
                                            <td class="ps-4 fw-medium text-dark">\${pago.numero}</td>
                                            <td class="text-muted text-truncate" style="max-width: 200px;">\${pago.cliente}</td>
                                            <td class="text-truncate" style="max-width: 200px;">\${detallesHtml}</td>
                                            <td class="text-muted">\${formatFecha(pago.fecha)}</td>
                                            <td class="text-dark fw-medium text-truncate" style="max-width: 150px;">\${pago.cuenta_bancaria}</td>
                                            <td>
                                                <span class="d-flex align-items-center gap-1.5">
                                                    <span style="color: \${pago.estado_conciliacion ? '#22c55e' : '#cbd5e1'}; font-size: 14px;">\${pago.estado_conciliacion ? '●' : '○'}</span>
                                                    <span class="text-secondary" style="font-size: 12.5px;">\${pago.estado_conciliacion ? 'Conciliado' : 'No conciliado'}</span>
                                                </span>
                                            </td>
                                            <td class="text-end fw-bold pe-4 text-success">
                                                + \${formatMoney(pago.monto)}
                                            </td>
                                            <td class="pe-3 position-relative">
                                                <button class="btn btn-sm btn-link text-secondary p-0 border-0 btn-menu-row" data-id="\${pago.id}" data-conciliado="\${pago.estado_conciliacion}" style="text-decoration: none; font-size: 16px;">⋮</button>
                                            </td>
                                        </tr>
                                    \`;
                                }).join('') : \`
                                    <tr>
                                        <td colspan="8" class="text-center text-muted py-5">
                                            <div class="mb-3"><i class="bi bi-inbox fs-1 text-secondary opacity-50"></i></div>
                                            <p class="mb-0">No se encontraron pagos recibidos.</p>
                                        </td>
                                    </tr>
                                \`}
                            </tbody>
                        </table>
                    </div>

                    <!-- PAGINADOR SERVER-SIDE -->
                    <div class="card-footer bg-white border-top d-flex justify-content-between align-items-center px-4 py-3 text-muted" style="font-size: 12px;">
                        <div class="d-flex align-items-center gap-2">
                            <span>Ítems por página:</span>
                            <select id="select-limit" class="form-select form-select-sm border-light-subtle" style="width: 65px; font-size: 12px; padding-top: 2px; padding-bottom: 2px;">
                                <option value="10" \${this.state.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                                <option value="20" \${this.state.itemsPerPage === 20 ? 'selected' : ''}>20</option>
                                <option value="50" \${this.state.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                            </select>
                            <span class="ms-2">\${this.state.totalItems > 0 ? \`\${startItem}-\${endItem} de \${this.state.totalItems}\` : '0-0 de 0'}</span>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <span>Página <input type="number" id="input-page" min="1" max="\${totalPages}" value="\${this.state.currentPage}" class="form-control form-control-sm d-inline-block text-center" style="width: 45px; font-size: 12px; padding-top: 2px; padding-bottom: 2px;"> de \${totalPages}</span>
                            <div class="d-flex gap-1">
                                <button id="btn-prev" class="btn btn-sm btn-light border py-0 px-2" \${this.state.currentPage <= 1 ? 'disabled' : ''}>❮</button>
                                <button id="btn-next" class="btn btn-sm btn-light border py-0 px-2" \${this.state.currentPage >= totalPages ? 'disabled' : ''}>❯</button>
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
                const rect = btn.getBoundingClientRect();
                
                const menu = document.createElement('div');
                menu.className = 'dropdown-menu row-action-menu show shadow-sm border border-light-subtle';
                menu.style.position = 'fixed';
                menu.style.top = \`\${rect.bottom + window.scrollY}px\`;
                menu.style.left = \`\${rect.left - 120}px\`;
                menu.style.zIndex = '1050';
                menu.style.minWidth = '140px';
                menu.style.fontSize = '13px';
                menu.style.borderRadius = '6px';
                
                menu.innerHTML = \`
                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-ver-\${id}">
                        <i class="bi bi-eye text-secondary"></i> Ver detalle
                    </a>
                    \${!conciliado ? \`<a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-anular-\${id}">
                        <i class="bi bi-x-circle text-secondary"></i> Anular
                    </a>\` : \`<div class="px-3 py-2 text-muted small fst-italic">No se puede anular un pago conciliado</div>\`}
                \`;

                document.body.appendChild(menu);

                const actionVer = document.getElementById(\`action-ver-\${id}\`);
                if (actionVer) {
                    actionVer.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();
                        import('../../shared/transaccionModal.js').then(m => {
                            supabase.from('pagos_ingresos').select('*').eq('id', id).single().then(({data}) => {
                                if (data) m.mostrarDetalleTransaccion(data, () => this.cargarPagos());
                            });
                        });
                    });
                }

                const actionAnular = document.getElementById(\`action-anular-\${id}\`);
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
            });
        });
    }
};
