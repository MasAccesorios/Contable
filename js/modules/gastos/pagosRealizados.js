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
        kpis: { total: 0 }
    },

    async init(element) {
        if (!element) return;
        this.element = element;
        await this.calcularKPIs();
        await this.cargarPagos();
    },
    
    async calcularKPIs() {
        try {
            const { data, error } = await supabase.rpc('get_pagos_kpis', { p_tipo: 'out' });
            if (!error && data) {
                this.state.kpis = { total: parseFloat(data.total) || 0 };
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
                    @page { size: 215.9mm 139.7mm !important; margin: 8mm !important; } /* Formato Media Carta (Half-Letter) */
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; }
                    .mas-receipt-container { padding: 0 !important; margin: 0 !important; }
                    .mas-receipt-card { page-break-inside: avoid; border: none; box-shadow: none; border-radius: 0; margin: 0 !important; }
                }
                .mas-receipt-container {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    color: #1e293b;
                    background: #ffffff;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .mas-receipt-card {
                    background: #ffffff;
                    border: ${isPrintMode ? 'none' : '1px solid #e2e8f0'};
                    border-radius: ${isPrintMode ? '0' : '16px'};
                    box-shadow: ${isPrintMode ? 'none' : '0 10px 25px rgba(0,0,0,0.05)'};
                    overflow: hidden;
                    position: relative;
                }
                .mas-receipt-header {
                    background: ${isPrintMode ? 'transparent' : 'linear-gradient(to right, #f8fafc, #ffffff)'};
                    border-bottom: 2px dashed #cbd5e1;
                    padding: 16px 20px;
                }
                .mas-receipt-body {
                    padding: 16px 20px;
                }
                .mas-receipt-footer {
                    background: #f8fafc;
                    padding: 16px 20px;
                    border-top: 1px solid #e2e8f0;
                    border-bottom-left-radius: ${isPrintMode ? '0' : '16px'};
                    border-bottom-right-radius: ${isPrintMode ? '0' : '16px'};
                }
                .mas-receipt-status-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    background-color: #fef2f2;
                    color: #dc2626;
                    border: 1px solid #fecaca;
                    border-radius: 999px;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }
                .mas-receipt-info-label {
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #64748b;
                    font-weight: 600;
                    margin-bottom: 2px;
                }
                .mas-receipt-info-value {
                    font-size: 13px;
                    font-weight: 500;
                    color: #0f172a;
                }
                .mas-receipt-table th {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #64748b;
                    border-bottom: 1px solid #cbd5e1 !important;
                    padding-bottom: 8px;
                    font-weight: 600;
                }
                .mas-receipt-table td {
                    padding: 10px 0;
                    vertical-align: top;
                    font-size: 13px;
                    color: #334155;
                    border-bottom: 1px solid #f1f5f9 !important;
                }
                .mas-receipt-total-box {
                    background-color: #0f172a;
                    color: #ffffff;
                    border-radius: 12px;
                    padding: 16px;
                    text-align: right;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .mas-receipt-total-label {
                    font-size: 11px;
                    color: #94a3b8;
                    margin-bottom: 2px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .mas-receipt-total-amount {
                    font-size: 24px;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                    line-height: 1;
                    color: #ffffff;
                }
                .mas-receipt-stamp {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-15deg);
                    font-size: 50px;
                    font-weight: 900;
                    color: rgba(220, 38, 38, 0.04);
                    text-transform: uppercase;
                    pointer-events: none;
                    white-space: nowrap;
                    z-index: 0;
                }
            </style>
            <div class="mas-receipt-container" style="padding: ${isPrintMode ? '0' : '20px'};">
                <div class="mas-receipt-card">
                    <!-- Marca de agua opcional -->
                    <div class="mas-receipt-stamp">PAGO REALIZADO</div>
                    
                    <div class="mas-receipt-header d-flex justify-content-between align-items-center position-relative" style="z-index: 1;">
                        <div>
                            <img src="LogoMas.png" alt="MAS Accesorios" style="max-height: 40px; object-fit: contain;">
                        </div>
                        <div class="text-end">
                            <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; letter-spacing: -0.5px;">COMPROBANTE DE EGRESO</h2>
                            <div class="d-flex align-items-center justify-content-end gap-3">
                                <span style="font-size: 13px; color: #64748b; font-weight: 500;">Nº <span style="color: #0f172a; font-weight: 700;">${t.numero || t.id}</span></span>
                                <span class="mas-receipt-status-badge">Pagado</span>
                            </div>
                        </div>
                    </div>

                    <div class="mas-receipt-body position-relative" style="z-index: 1;">
                        <div class="row mb-3">
                            <div class="col-sm-6 mb-2 mb-sm-0">
                                <div class="mas-receipt-info-label">Pagado a</div>
                                <div class="mas-receipt-info-value" title="${t.contactos?.nombre || 'Proveedor / Tercero'}" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.contactos?.nombre || 'Proveedor / Tercero'}</div>
                                ${t.contactos?.identificacion ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">NIT/CC: ${t.contactos.identificacion}</div>` : ''}
                            </div>
                            <div class="col-sm-6 text-sm-end">
                                <div class="row">
                                    <div class="col-6 col-sm-12 mb-2">
                                        <div class="mas-receipt-info-label">Fecha de pago</div>
                                        <div class="mas-receipt-info-value">${t.fecha}</div>
                                    </div>
                                    <div class="col-6 col-sm-12">
                                        <div class="mas-receipt-info-label">Pagado desde</div>
                                        <div class="mas-receipt-info-value d-flex align-items-center justify-content-sm-end gap-2">
                                            <i class="bi bi-bank" style="color: #94a3b8;"></i>
                                            ${t.cuentas_bancarias?.nombre || 'Efectivo / Caja'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <table class="table mas-receipt-table table-borderless mb-0 w-100">
                            <thead>
                                <tr>
                                    <th class="text-start" style="width: 50%;">Descripción del pago</th>
                                    <th class="text-center" style="width: 25%;">Referencia</th>
                                    <th class="text-end" style="width: 25%;">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="text-start">
                                        <div style="font-weight: 600; color: #0f172a;">${t.categoria || 'Abono / Pago de factura'}</div>
                                    </td>
                                    <td class="text-center">
                                        ${t.factura_id ? 
                                            `<span style="background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-size: 11px; font-weight: 600; color: #475569;"># ${t.facturas?.numero || t.factura_id}</span>` 
                                            : '<span style="color: #94a3b8; font-size: 12px;">N/A</span>'}
                                    </td>
                                    <td class="text-end" style="font-weight: 600; color: #0f172a;">
                                        $${Number(t.monto).toLocaleString('es-CO')}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="mas-receipt-footer position-relative" style="z-index: 1;">
                        <div class="row align-items-center">
                            <div class="col-sm-7 mb-3 mb-sm-0">
                                <div class="mas-receipt-info-label" style="color: #475569;">Observaciones</div>
                                <p style="font-size: 12px; color: #64748b; line-height: 1.4; margin: 0; padding-right: 15px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                    ${t.observaciones ? t.observaciones : 'Sin notas adicionales.'}
                                </p>
                            </div>
                            <div class="col-sm-5">
                                <div class="mas-receipt-total-box">
                                    <div class="mas-receipt-total-label">Total Pagado</div>
                                    <div class="mas-receipt-total-amount">$${Number(t.monto).toLocaleString('es-CO')}</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Sección de firmas para impresión -->
                        <div class="mt-2 pt-2 border-top" style="display: ${isPrintMode ? 'flex' : 'none'}; justify-content: space-between; border-color: #cbd5e1 !important;">
                            <div style="width: 45%; text-align: center;">
                                <div style="border-bottom: 1px solid #94a3b8; height: 20px; margin-bottom: 4px;"></div>
                                <div style="font-size: 10px; color: #64748b; font-weight: 500; text-transform: uppercase;">Firma y Sello de la Empresa</div>
                            </div>
                            <div style="width: 45%; text-align: center;">
                                <div style="border-bottom: 1px solid #94a3b8; height: 20px; margin-bottom: 4px;"></div>
                                <div style="font-size: 10px; color: #64748b; font-weight: 500; text-transform: uppercase;">Firma de quien recibe</div>
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
            <div class="dash-layout p-4">
                
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1 text-dark">Pagos Realizados</h2>
                        <p class="text-muted small mb-0">Historial de todos los egresos de dinero (tipo "Salida").</p>
                    </div>
                </div>

                <!-- KPI CARDS PAGOS REALIZADOS -->
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Total Egresos (este mes)</span>
                                <div class="dash-icon-box variant-red">
                                    <i class="bi bi-cash-stack"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value">$ ${formatMoney(this.state.kpis?.total || 0).replace('$ ', '')}</div>
                        </div>
                    </div>
                </div>


                <div class="dash-table-container">
                    <div class="card-body p-0">
                        <div class="d-flex justify-content-between mb-3 px-4 pt-4">
                            <div class="input-group" style="max-width: 300px;">
                                <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                                <input type="text" class="form-control border-start-0 ps-0" id="search-pagos" placeholder="Buscar por número o proveedor..." value="${this.state.searchQuery}" style="box-shadow: none;">
                            </div>
                        </div>

                        <div class="view-container p-4 pt-0">
                        ${this.state.isLoading ? `
                            <div class="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-white bg-opacity-75" style="z-index: 10;">
                                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>
                            </div>
                        ` : ''}
                        <table class="table align-middle table-hover m-0 text-nowrap">
                            <thead class="table-light text-muted small text-uppercase border-bottom">
                                <tr>
                                    <th class="ps-4 py-2">Número</th>
                                    <th class="py-2">Proveedor</th>
                                    <th class="py-2">Detalles</th>
                                    <th class="py-2">Creación</th>
                                    <th class="py-2">Cuenta bancaria</th>
                                    <th class="py-2">Estado</th>
                                    <th class="py-2 text-end pe-4">Monto</th>
                                    <th class="py-2" style="width: 50px;"></th>
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
                                            <td class="ps-4 py-1 fw-bold text-dark">${pago.numero}</td>
                                            <td class="py-1 text-dark text-truncate" style="max-width: 200px;">${pago.cliente}</td>
                                            <td class="py-1 text-truncate" style="max-width: 200px;">${detallesHtml}</td>
                                            <td class="py-1 text-muted">${formatFecha(pago.fecha)}</td>
                                            <td class="py-1 text-dark text-truncate" style="max-width: 150px;">${pago.cuenta_bancaria}</td>
                                            <td class="py-1">
                                                ${pago.estado_transaccion === 'anulado' 
                                                    ? `<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle rounded-pill fw-medium" style="font-size: 10px; padding: 3px 8px;">Anulado</span>`
                                                    : pago.estado_conciliacion
                                                        ? `<span class="badge bg-success text-success bg-opacity-10 border border-success-subtle rounded-pill fw-medium" style="font-size: 10px; padding: 3px 8px;">Conciliado</span>`
                                                        : `<span class="badge bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle rounded-pill fw-medium" style="font-size: 10px; padding: 3px 8px;">No conciliado</span>`
                                                }
                                            </td>
                                            <td class="py-1 text-end fw-bold pe-4 ${pago.estado_transaccion === 'anulado' ? 'text-muted text-decoration-line-through opacity-50' : 'text-danger'}">
                                                ${formatMoney(pago.monto)}
                                            </td>
                                            <td class="py-1 pe-3 position-relative">
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
                        <div class="d-flex justify-content-between align-items-center mt-3 text-muted small">
                            <div class="d-flex align-items-center gap-3">
                                <span>Página <span id="current-page">${this.state.currentPage}</span> de <span id="total-pages">${totalPages}</span></span>
                                <div class="btn-group">
                                    <button class="btn btn-sm btn-light border text-muted" id="btn-prev" ${this.state.currentPage <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
                                    <button class="btn btn-sm btn-light border text-muted" id="btn-next" ${this.state.currentPage >= totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>
                                </div>
                            </div>
                            <div class="d-flex align-items-center gap-3">
                                <span class="d-flex align-items-center gap-2">
                                    Pagos por página:
                                    <select id="select-limit" class="form-select form-select-sm border-0 bg-transparent text-muted fw-bold" style="width: 60px; box-shadow: none; cursor: pointer;">
                                        <option value="10" ${this.state.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                                        <option value="20" ${this.state.itemsPerPage === 20 ? 'selected' : ''}>20</option>
                                        <option value="50" ${this.state.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                                    </select>
                                </span>
                                <span id="showing-count">${this.state.totalItems > 0 ? `${startItem}-${endItem} de ${this.state.totalItems}` : '0-0 de 0'}</span>
                                <button id="btn-refresh" class="btn btn-sm btn-light border text-muted rounded-circle" style="width: 30px; height: 30px; padding: 0;"><i class="bi bi-arrow-clockwise"></i></button>
                            </div>
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
                const max = Math.ceil(this.state.totalItems / this.state.itemsPerPage) || 1;
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
                const max = Math.ceil(this.state.totalItems / this.state.itemsPerPage) || 1;
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
