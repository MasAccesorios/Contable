import { supabase } from '../../core/supabase.js';
import { CoreActions } from '../../shared/crud.js';
import { AbonoModal } from '../../shared/abonoModal.js';
import { anularTransaccion } from '../../shared/transaccionesUtils.js';

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
        kpis: { total: 0, aplicados: 0, directos: 0 }
    },

    async init(element) {
        if (!element) return;
        this.element = element;
        await this.calcularKPIs();
        await this.cargarPagos();
    },
    
    async calcularKPIs() {
        try {
            const { data } = await supabase.from('pagos_ingresos').select('monto, factura_id, estado').eq('tipo', 'out').neq('estado', 'anulado');
            if (data) {
                let total = 0, aplicados = 0, directos = 0;
                data.forEach(p => {
                    const amt = parseFloat(p.monto) || 0;
                    total += amt;
                    if (p.factura_id) aplicados += amt;
                    else directos += amt;
                });
                this.state.kpis = { total, aplicados, directos };
            }
        } catch (e) {
            console.error('Error calculando KPIs:', e);
        }
    },
    
    async mostrarDetalle(id, mode = 'preview') {
        if (mode === 'print') {
            const { data: t } = await supabase.from('pagos_ingresos').select('*, contactos(*), cuentas_bancarias(*), facturas(*)').eq('id', id).single();
            if (t) {
                const { PrintManager } = await import('../../shared/crud.js');
                PrintManager._renderPreviewShell(this.getComprobanteHTML(t, true), { mode: 'print', title: 'Comprobante de Egreso', fileName: `comprobante_egreso_${t.numero || t.id}.png` });
            }
            return;
        }

        this.state.isLoading = true;
        this.render();
        try {
            const { data: t } = await supabase.from('pagos_ingresos').select('*, contactos(*), cuentas_bancarias(*), facturas(*)').eq('id', id).single();
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
            this.bindEvents();
        }
    },

    async cargarPagos() {
        this.state.isLoading = true;
        this.render();

        try {
            const { data, error } = await supabase.rpc('get_pagos_lista', {
                p_tipo: 'out',
                p_page: this.state.currentPage,
                p_limit: this.state.itemsPerPage,
                p_search: this.state.searchQuery
            });

            if (error) throw error;

            this.state.pagos = data || [];
            this.state.totalItems = this.state.pagos.length > 0 ? Number(this.state.pagos[0].total_count) : 0;
        } catch (error) {
            console.error('Error cargando pagos realizados:', error);
            CoreActions.showWarningModal('Error al cargar la lista de pagos: ' + (error.message || error));
        } finally {
            this.state.isLoading = false;
            this.render();
            this.bindEvents();
        }
    },

    render() {
        if (this.state.view === 'detalle' && this.state.currentComprobanteData) {
            this.renderComprobanteWrapper();
        } else {
            this.renderListaHTML();
        }
    },
    
    getComprobanteHTML(t, isPrintMode = false) {
        return `
            <style>
                @media print {
                    @page { size: 215.9mm 139.7mm; margin: 10mm; } /* Formato Media Carta (Half-Letter) */
                }
            </style>
            <div style="font-family: 'Inter', sans-serif; color: #334155; padding: ${isPrintMode ? '10px' : '0'};">
                <div class="card border-light-subtle rounded-4 ${isPrintMode ? 'border-0' : 'shadow-sm'}" style="max-width: 750px; margin: 0 auto; background: #fff;">
                    <div class="card-body ${isPrintMode ? 'p-0' : 'p-4'}">
                        
                        <div class="d-flex justify-content-between align-items-start mb-3 pb-2 border-bottom">
                            <div>
                                <img src="LogoMas.png" alt="MAS Accesorios" style="max-height: 45px;">
                            </div>
                            <div class="text-end">
                                <div class="text-muted fw-medium mb-1" style="font-size: 13px;">Comprobante de Egreso</div>
                                <div class="d-flex align-items-center justify-content-end gap-2">
                                    <span class="fw-bold" style="font-size: 14px; color: #334155;">Nº ${t.numero || t.id}</span>
                                </div>
                            </div>
                        </div>

                        <div class="row mb-4">
                            <div class="col-4">
                                <label class="form-label text-muted fw-semibold m-0" style="font-size: 12px;">Pagado A</label>
                                <div class="fw-medium text-dark" style="font-size: 13px;">${t.contactos?.nombre || '---'}</div>
                            </div>
                            <div class="col-4">
                                <label class="form-label text-muted fw-semibold m-0" style="font-size: 12px;">Fecha</label>
                                <div class="fw-medium text-dark" style="font-size: 13px;">${t.fecha}</div>
                            </div>
                            <div class="col-4">
                                <label class="form-label text-muted fw-semibold m-0" style="font-size: 12px;">Cuenta</label>
                                <div class="fw-medium text-dark" style="font-size: 13px;">${t.cuentas_bancarias?.nombre || '---'}</div>
                            </div>
                        </div>

                        <div class="mb-4">
                            <table class="table table-borderless table-sm m-0" style="border-bottom: 1px solid #e2e8f0;">
                                <thead style="border-bottom: 2px solid #e2e8f0;">
                                    <tr>
                                        <th class="py-2 px-2 text-muted fw-bold" style="font-size: 12px;">Concepto</th>
                                        <th class="py-2 px-2 text-muted fw-bold" style="font-size: 12px;">Factura asociada</th>
                                        <th class="py-2 px-2 text-end text-muted fw-bold" style="font-size: 12px;">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td class="py-2 px-2 align-middle text-dark" style="font-size: 13px;">${t.categoria || 'Abono / Pago'}</td>
                                        <td class="py-2 px-2 align-middle text-dark" style="font-size: 13px;">${t.factura_id ? '#' + (t.facturas?.numero || t.factura_id) : 'Ninguna'}</td>
                                        <td class="py-2 px-2 align-middle text-end fw-bold text-dark" style="font-size: 13px;">$${Number(t.monto).toLocaleString('es-CO')}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="row align-items-center">
                            <div class="col-7">
                                <div class="p-2 rounded-2 text-muted" style="font-size: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; min-height: 40px;">
                                    <span class="fw-semibold d-block mb-1">Notas:</span>
                                    ${t.observaciones || 'Sin observaciones adicionales.'}
                                </div>
                            </div>
                            <div class="col-5">
                                <div class="d-flex justify-content-between p-2 rounded-2 fw-bold" style="font-size: 15px; background-color: #f1f5f9; border: 1px solid #e2e8f0;">
                                    <span class="text-dark">Total</span>
                                    <span class="text-dark">$${Number(t.monto).toLocaleString('es-CO')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderComprobanteWrapper() {
        const t = this.state.currentComprobanteData;
        this.element.innerHTML = `
            <div class="py-4 px-4" style="font-family: 'Inter', sans-serif; background-color: #f8f9fa; min-height: 100vh;">
                <div class="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style="max-width: 750px; margin: 0 auto;">
                    <button class="btn btn-link text-decoration-none text-muted p-0 d-flex align-items-center gap-2 fw-medium" id="btn-volver-pagos">
                        <i class="bi bi-arrow-left"></i> Volver a Pagos Realizados
                    </button>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-info text-info border-info bg-info bg-opacity-10 fw-medium px-4" id="btn-imprimir-comprobante" data-id="${t.id}">
                            <i class="bi bi-printer me-2"></i> Imprimir
                        </button>
                        <button class="btn fw-medium px-4 text-white" style="background-color: #1877f2; border-color: #1877f2;" id="btn-editar-comprobante" data-id="${t.id}">
                            <i class="bi bi-pencil me-2"></i> Editar
                        </button>
                    </div>
                </div>
                <div class="mb-4" style="max-width: 750px; margin: 0 auto;">
                    <h2 class="h3 fw-bold m-0" style="color: #0f172a;">Pago Realizado</h2>
                </div>
                ${this.getComprobanteHTML(t)}
            </div>
        `;
    },

    renderListaHTML() {
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
                        <h2 class="fw-bold text-dark m-0" style="font-size: 22px; color: #0c1a30 !important;">Pagos Realizados</h2>
                        <p class="text-muted m-0 mt-1" style="font-size: 13px;">Historial de todos los egresos de dinero (tipo "Salida").</p>
                    </div>
                </div>

                <!-- KPI CARDS PAGOS REALIZADOS -->
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="card kpi-card kpi-danger">
                            <div class="kpi-card-body">
                                <i class="bi bi-cash-stack kpi-icon"></i>
                                <h6 class="kpi-label">Total Egresos</h6>
                                <h5 class="kpi-value">$ ${formatMoney(this.state.kpis?.total || 0).replace('$ ', '')}</h5>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="card kpi-card kpi-success">
                            <div class="kpi-card-body">
                                <i class="bi bi-file-earmark-check kpi-icon"></i>
                                <h6 class="kpi-label">Pagos a Proveedores</h6>
                                <h5 class="kpi-value">$ ${formatMoney(this.state.kpis?.aplicados || 0).replace('$ ', '')}</h5>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="card kpi-card kpi-warning">
                            <div class="kpi-card-body">
                                <i class="bi bi-wallet2 kpi-icon"></i>
                                <h6 class="kpi-label">Gastos Directos</h6>
                                <h5 class="kpi-value">$ ${formatMoney(this.state.kpis?.directos || 0).replace('$ ', '')}</h5>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card shadow-sm border border-light-subtle bg-white" style="border-radius: 6px;">
                    <div class="card-header bg-white border-bottom-0 p-3 d-flex justify-content-between align-items-center">
                        <div class="input-group" style="width: 300px;">
                            <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                            <input type="text" class="form-control border-start-0 ps-0" id="search-pagos" placeholder="Buscar por número o proveedor..." value="${this.state.searchQuery}" style="font-size: 13px;">
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
                                    <th>Proveedor</th>
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
                                        detallesHtml = `<a href="#/gastos/compras/ver/${pago.factura_id}" class="text-decoration-none text-primary" onclick="event.stopPropagation()">Compra #${pago.factura_numero || pago.factura_id}</a>`;
                                    }

                                    return `
                                        <tr style="cursor: pointer;" class="row-pago" data-id="${pago.id}">
                                            <td class="ps-4 fw-medium text-dark">${pago.numero}</td>
                                            <td class="text-muted text-truncate" style="max-width: 200px;">${pago.cliente}</td>
                                            <td class="text-truncate" style="max-width: 200px;">${detallesHtml}</td>
                                            <td class="text-muted">${formatFecha(pago.fecha)}</td>
                                            <td class="text-dark fw-medium text-truncate" style="max-width: 150px;">${pago.cuenta_bancaria}</td>
                                            <td>
                                                ${pago.estado_transaccion === 'anulado' 
                                                    ? `<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 5px 10px;">Anulado</span>`
                                                    : pago.estado_conciliacion
                                                        ? `<span class="badge bg-success text-success bg-opacity-10 border border-success-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 5px 10px;">Conciliado</span>`
                                                        : `<span class="badge bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 5px 10px;">No conciliado</span>`
                                                }
                                            </td>
                                            <td class="text-end fw-bold pe-4 ${pago.estado_transaccion === 'anulado' ? 'text-muted text-decoration-line-through opacity-50' : 'text-danger'}">
                                                - ${formatMoney(pago.monto)}
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
                                            <p class="mb-0">No se encontraron pagos realizados.</p>
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
        const btnVolver = this.element.querySelector('#btn-volver-pagos');
        if (btnVolver) {
            btnVolver.addEventListener('click', () => {
                this.state.view = 'lista';
                this.state.currentComprobanteData = null;
                this.render();
                this.bindEvents();
            });
        }
        
        const btnImprimirComprobante = this.element.querySelector('#btn-imprimir-comprobante');
        if (btnImprimirComprobante) {
            btnImprimirComprobante.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.mostrarDetalle(id, 'print');
            });
        }
        
        const btnEditarComprobante = this.element.querySelector('#btn-editar-comprobante');
        if (btnEditarComprobante) {
            btnEditarComprobante.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                import('../../shared/transaccionModal.js').then(async m => {
                    const { data } = await supabase.from('pagos_ingresos').select('*').eq('id', id).single();
                    if (data) {
                        m.mostrarDetalleTransaccion(data, () => this.cargarPagos());
                        setTimeout(() => {
                            const btnEdit = document.getElementById('btn-activar-edicion');
                            if (btnEdit) btnEdit.click();
                        }, 200);
                    }
                });
            });
        }
        
        this.element.querySelectorAll('.row-pago').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.btn-menu-row') || e.target.closest('.dropdown-menu') || e.target.closest('a')) return;
                const id = row.getAttribute('data-id');
                this.mostrarDetalle(id, 'preview');
            });
        });

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
                        this.mostrarDetalle(id, 'preview');
                    });
                }
                
                const actionImprimir = document.getElementById(`action-imprimir-${id}`);
                if (actionImprimir) {
                    actionImprimir.addEventListener('click', async (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();
                        this.mostrarDetalle(id, 'print');
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
                                if (data) {
                                    m.mostrarDetalleTransaccion(data, () => this.cargarPagos());
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
