import { supabase } from '../../core/supabase.js';
import { CoreActions } from '../../shared/crud.js';
import { AbonoModal } from '../../shared/abonoModal.js';
import { anularTransaccion } from '../../shared/transaccionesUtils.js';

export const PagosRecibidosModule = {
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
    
    async calcularKPIs() {
        try {
            const { data, error } = await supabase.rpc('get_pagos_kpis', { p_tipo: 'in' });
            if (!error && data) {
                this.state.kpis = { total: parseFloat(data.total) || 0 };
            }
        } catch (e) {
            console.error('Error calculando KPIs:', e);
        }
    },
    
    async mostrarDetalle(id, mode = 'preview') {
        if (mode === 'print' || mode === 'vista-previa') {
            const { data: t } = await supabase.from('pagos_ingresos').select('*, contactos(*), cuentas_bancarias(*), facturas(*, contactos(*))').eq('id', id).single();
            if (t) {
                const { PrintManager } = await import('../../shared/printManager.js');
                PrintManager._renderPreviewShell(this.getComprobanteHTML(t, true), { mode: mode === 'vista-previa' ? 'preview' : 'print', title: 'Comprobante de Ingreso', fileName: `comprobante_ingreso_${t.numero || t.id}.png`, printClass: 'formato-media-carta' });
            }
            return;
        }

        this.state.isLoading = true;
        this.renderGrid();
        try {
            const { data: t } = await supabase.from('pagos_ingresos').select('*, contactos(*), cuentas_bancarias(*), facturas(*, contactos(*))').eq('id', id).single();
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

    async cargarPagos() {
        this.state.isLoading = true;
        this.renderGrid();

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
            this.renderGrid();
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
    
    getComprobanteHTML(t, isPrintMode = false) {
        return `
            <style>
                @page { size: 215.9mm 139.7mm; margin: 5mm; } /* Formato Media Carta (Half-Letter) */
                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .mas-receipt-container { padding: 0 !important; margin: 0 auto !important; padding-top: 4mm !important; }
                    .mas-receipt-card { page-break-inside: avoid; }
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
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.05);
                    overflow: hidden;
                    position: relative;
                }
                .mas-receipt-header {
                    background: linear-gradient(to right, #f8fafc, #ffffff);
                    border-bottom: 2px dashed #cbd5e1;
                    padding: 10px 20px;
                }
                .mas-receipt-body {
                    padding: 10px 20px;
                    overflow: hidden;
                }
                .mas-receipt-footer {
                    background: #f8fafc;
                    padding: 10px 20px;
                    border-top: 1px solid #e2e8f0;
                    border-bottom-left-radius: 16px;
                    border-bottom-right-radius: 16px;
                }
                .mas-receipt-status-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    background-color: #ecfdf5;
                    color: #059669;
                    border: 1px solid #a7f3d0;
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
                .mas-receipt-total-row {
                    display: flex;
                    justify-content: flex-end;
                    align-items: baseline;
                    gap: 10px;
                    padding-top: 14px;
                    border-top: 2px solid #059669;
                }
                .mas-receipt-total-label {
                    font-size: 12px;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.6px;
                    font-weight: 600;
                }
                .mas-receipt-total-amount {
                    font-size: 26px;
                    font-weight: 800;
                    color: #0f172a;
                    letter-spacing: -0.6px;
                }
                .mas-receipt-stamp {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-15deg);
                    font-size: 40px;
                    font-weight: 900;
                    color: rgba(5, 150, 105, 0.04);
                    text-transform: uppercase;
                    pointer-events: none;
                    white-space: nowrap;
                    z-index: 0;
                }
            </style>
            <div class="mas-receipt-container" style="padding: 20px;">
                <div class="mas-receipt-card">
                    
                    <div class="mas-receipt-header d-flex justify-content-between align-items-center position-relative" style="z-index: 1;">
                        <div>
                            <img src="LogoMas.png" alt="MAS Accesorios" style="max-height: 40px; object-fit: contain;">
                        </div>
                        <div class="text-end">
                            <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; letter-spacing: -0.5px;">RECIBO DE CAJA</h2>
                            <div class="d-flex align-items-center justify-content-end gap-3">
                                <span style="font-size: 13px; color: #64748b; font-weight: 500;">Nº <span style="color: #0f172a; font-weight: 700;">${t.numero || t.id}</span></span>
                                <span class="mas-receipt-status-badge">Recibido</span>
                            </div>
                        </div>
                    </div>

                    <div class="mas-receipt-body position-relative" style="z-index: 1;">
                        <!-- Marca de agua opcional -->
                        <div class="mas-receipt-stamp">PAGO RECIBIDO</div>
                        
                        <div class="row mb-3 align-items-start">
                            <div class="col-sm-6 mb-2 mb-sm-0">
                                <div class="mas-receipt-info-label">Recibido de</div>
                                ${(t.contacto_id || t.facturas?.contacto_id) ? `
                                <a href="#/contactos/ver/${t.contacto_id || t.facturas?.contacto_id}" class="mas-receipt-info-value text-decoration-none d-inline-flex align-items-center gap-1" title="${t.contactos?.nombre || t.facturas?.contactos?.nombre || 'Cliente Contado'}" style="font-size: 14px; font-weight: 700; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--bs-primary);">
                                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.contactos?.nombre || t.facturas?.contactos?.nombre || 'Cliente Contado'}</span>
                                    <i class="bi bi-box-arrow-up-right" style="font-size: 0.75rem;"></i>
                                </a>
                                ` : `
                                <div class="mas-receipt-info-value" title="${t.contactos?.nombre || t.facturas?.contactos?.nombre || 'Cliente Contado'}" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.contactos?.nombre || t.facturas?.contactos?.nombre || 'Cliente Contado'}</div>
                                `}
                                ${(t.contactos?.identificacion || t.facturas?.contactos?.identificacion) ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">NIT/CC: ${t.contactos?.identificacion || t.facturas?.contactos?.identificacion}</div>` : ''}
                            </div>
                            <div class="col-sm-6 text-sm-end">
                                <div class="row">
                                    <div class="col-6 col-sm-12 mb-2">
                                        <div class="mas-receipt-info-label">Fecha de pago</div>
                                        <div class="mas-receipt-info-value">${t.fecha}</div>
                                    </div>
                                    <div class="col-6 col-sm-12">
                                        <div class="mas-receipt-info-label">Ingresado a</div>
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
                        <div class="mas-receipt-info-label" style="color: #475569;">Observaciones</div>
                        <p style="font-size: 12px; color: #64748b; line-height: 1.4; margin: 0 0 16px 0; padding-right: 15px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${t.observaciones ? t.observaciones : 'Sin notas adicionales.'}
                        </p>
                        <div class="mas-receipt-total-row">
                            <span class="mas-receipt-total-label">Total Recibido</span>
                            <span class="mas-receipt-total-amount">$${Number(t.monto).toLocaleString('es-CO')}</span>
                        </div>
                        
                        <!-- Sección de firmas para impresión -->
                        <div class="mt-2 pt-2 border-top" style="display: ${isPrintMode ? 'flex' : 'none'}; justify-content: space-between; border-color: #cbd5e1 !important;">
                            <div style="width: 45%; text-align: center;">
                                <div style="border-bottom: 1px solid #94a3b8; height: 20px; margin-bottom: 4px;"></div>
                                <div style="font-size: 10px; color: #64748b; font-weight: 500; text-transform: uppercase;">Firma y Sello de la Empresa</div>
                            </div>
                            <div style="width: 45%; text-align: center;">
                                <div style="border-bottom: 1px solid #94a3b8; height: 20px; margin-bottom: 4px;"></div>
                                <div style="font-size: 10px; color: #64748b; font-weight: 500; text-transform: uppercase;">Firma de quien entrega</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderComprobanteWrapper(container) {
        const t = this.state.currentComprobanteData;
        container.innerHTML = `
            <div class="py-4 px-4" style="font-family: 'Inter', sans-serif; background-color: var(--bg-main); min-height: 100vh;">
                <div class="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style="max-width: 750px; margin: 0 auto;">
                    <button class="btn btn-link text-decoration-none text-muted p-0 d-flex align-items-center gap-2 fw-medium" id="btn-volver-pagos">
                        <i class="bi bi-arrow-left"></i> Volver a Pagos Recibidos
                    </button>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-secondary text-secondary border-secondary bg-secondary bg-opacity-10 fw-medium px-4" id="btn-vista-previa-comprobante" data-id="${t.id}">
                            <i class="bi bi-file-earmark-image me-2"></i> Vista Previa
                        </button>
                        <button class="btn btn-outline-info text-info border-info bg-info bg-opacity-10 fw-medium px-4" id="btn-imprimir-comprobante" data-id="${t.id}">
                            <i class="bi bi-printer me-2"></i> Imprimir
                        </button>
                        <button class="btn fw-medium px-4 text-white" style="background-color: var(--primary); border-color: var(--primary);" id="btn-editar-comprobante" data-id="${t.id}">
                            <i class="bi bi-pencil me-2"></i> Editar
                        </button>
                    </div>
                </div>
                <div class="mb-4" style="max-width: 750px; margin: 0 auto;">
                    <h2 class="h3 fw-bold m-0" style="color: var(--text-main);">Pago Recibido</h2>
                </div>
                ${this.getComprobanteHTML(t)}
            </div>
        `;
        this.bindDetailEvents(container);
    },

    renderList() {
        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        this.element.innerHTML = `
            <div class="dash-layout p-4" id="pagos-list-container" style="max-width: 1100px; margin: 0 auto;">
                <!-- TOP BAR -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Pagos Recibidos</h2>
                        <p class="text-muted mb-0" style="font-size: var(--fs-md);">
                            Historial de todos los ingresos de dinero (tipo "Entrada").
                        </p>
                    </div>
                    <div class="d-flex gap-2">
                        <a href="#" onclick="event.preventDefault(); window.history.length > 2 ? window.history.back() : window.location.hash = '#/dashboard';" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body);">
                            <i class="bi bi-arrow-left me-1"></i> Volver
                        </a>
                        <button id="btn-nuevo-pago" class="btn btn-primary-action">
                            <i class="bi bi-plus-lg me-1"></i> Registrar Pago
                        </button>
                    </div>
                </div>

                <!-- KPI CARDS PAGOS RECIBIDOS -->
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Total Recibido (Este mes)</span>
                            <div class="ds-kpi-value text-success">$ ${formatMoney(this.state.kpis?.total || 0).replace('$ ', '')}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Mes Anterior</span>
                            <div class="ds-kpi-value text-muted">$ 0.00</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Transacciones (Mes)</span>
                            <div class="ds-kpi-value text-muted">0</div>
                        </div>
                    </div>
                </div>

                <!-- DATA TABLE CARD -->
                <div class="ds-table-container mb-4">
                    <!-- FILTERS -->
                    <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center">
                        <div class="ds-search-container" style="width: 250px;">
                            <i class="bi bi-search ds-search-icon"></i>
                            <input type="text" class="ds-search-input" id="search-pagos" autocomplete="off" placeholder="Buscar por número o cliente..." value="${this.state.searchQuery}">
                        </div>
                    </div>

                    <!-- GRID -->
                    <div id="grid-container">
                        <!-- La grilla se inyecta aquí -->
                    </div>
                </div>
            </div>
            <div id="pagos-detail-container" style="display: none;"></div>
        `;
        
        this.bindStaticEvents();
    },

    renderGrid() {
        const gridContainer = this.element.querySelector('#grid-container');
        if (!gridContainer) return;
        
        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formatFecha = dateStr => {
            if (!dateStr) return '---';
            const partes = dateStr.split('-');
            return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dateStr;
        };

        const totalPages = Math.ceil(this.state.totalItems / this.state.itemsPerPage) || 1;
        const startItem = (this.state.currentPage - 1) * this.state.itemsPerPage + 1;
        const endItem = Math.min(this.state.currentPage * this.state.itemsPerPage, this.state.totalItems);

        let tableHtml = `
            ${this.state.isLoading ? `
                <div class="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-white bg-opacity-75" style="z-index: 10;">
                    <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>
                </div>
            ` : ''}
            <div class="table-responsive">
                <table class="table table-borderless align-middle mb-0">
                    <thead class="ds-table-header">
                        <tr>
                            <th class="py-3 fw-normal ms-2" style="white-space: nowrap;">Número</th>
                            <th class="py-3 fw-normal" style="white-space: nowrap;">Cliente</th>
                            <th class="py-3 fw-normal" style="white-space: nowrap;">Detalles</th>
                            <th class="py-3 fw-normal" style="white-space: nowrap;">Creación</th>
                            <th class="py-3 fw-normal" style="white-space: nowrap;">Cuenta bancaria</th>
                            <th class="py-3 fw-normal text-center" style="white-space: nowrap;">Estado</th>
                            <th class="py-3 fw-normal text-end" style="white-space: nowrap;">Monto</th>
                            <th class="py-3 fw-normal" style="width: 50px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                    ${this.state.pagos.length > 0 ? this.state.pagos.map(pago => {
                        let detallesHtml = pago.categoria || 'Sin detalle';
                        if (pago.factura_id) {
                            detallesHtml = `<a href="#/ingresos/facturas/ver/${pago.factura_id}" class="text-decoration-none text-primary" onclick="event.stopPropagation()">Factura #${pago.factura_numero || pago.factura_id}</a>`;
                        }
                        
                        let clienteNombre = pago.cliente;
                        if (!clienteNombre) {
                            const obs = String(pago.observaciones || '').trim();
                            if (obs.includes(' — ')) {
                                clienteNombre = obs.split(' — ').pop().trim();
                            } else if (obs.length > 0) {
                                clienteNombre = obs.length > 50 ? obs.substring(0, 47) + '...' : obs;
                            } else {
                                clienteNombre = pago.referencia || 'Sin cliente';
                            }
                        }
                        
                        return `
                        <tr style="cursor: pointer; border-bottom: 1px solid var(--border-color);" class="row-pago" data-id="${pago.id}">
                            <td class="py-3 fw-medium ms-2" style="color: var(--text-main);">${pago.numero}</td>
                            <td class="py-3 text-truncate" style="color: var(--text-body); max-width: 200px;">${clienteNombre}</td>
                            <td class="py-3 text-truncate" style="color: var(--text-body); max-width: 200px;">${detallesHtml}</td>
                            <td class="py-3" style="color: var(--text-muted);">${formatFecha(pago.fecha)}</td>
                            <td class="py-3 text-truncate" style="color: var(--text-body); max-width: 150px;">${pago.cuenta_bancaria}</td>
                            <td class="py-3 text-center">
                                ${pago.estado_transaccion === 'anulado' 
                                    ? `<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle rounded-pill fw-medium px-2 py-1">Anulado</span>`
                                    : pago.estado_conciliacion
                                        ? `<span class="badge bg-success text-success bg-opacity-10 border border-success-subtle rounded-pill fw-medium px-2 py-1">Conciliado</span>`
                                        : `<span class="badge bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle rounded-pill fw-medium px-2 py-1">No conciliado</span>`
                                }
                            </td>
                            <td class="py-3 text-end pe-3 text-success ${pago.estado_transaccion === 'anulado' ? 'text-muted text-decoration-line-through opacity-50' : ''}" style="font-weight: var(--weight-semibold);">
                                ${formatMoney(pago.monto)}
                            </td>
                            <td class="py-3 text-end pe-3 position-relative">
                                <button class="btn btn-sm btn-link text-muted p-0 border-0 btn-menu-row" data-id="${pago.id}" data-conciliado="${pago.estado_conciliacion}" data-factura="${pago.factura_id || ''}" data-anulado="${pago.estado_transaccion === 'anulado'}" style="text-decoration: none; font-size: var(--fs-lg);"><i class="bi bi-three-dots-vertical"></i></button>
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
            
            <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center" style="border-radius: 0 0 var(--border-radius-sm) var(--border-radius-sm);">
                <div class="d-flex align-items-center gap-3" style="font-size: var(--fs-base); color: var(--text-body);">
                    <div class="d-flex align-items-center gap-2">
                        <span>Resultados por página:</span>
                        <select class="form-select form-select-sm text-muted" id="select-limit" style="width: 70px;">
                            <option value="10" ${this.state.itemsPerPage===10?'selected':''}>10</option>
                            <option value="20" ${this.state.itemsPerPage===20?'selected':''}>20</option>
                            <option value="50" ${this.state.itemsPerPage===50?'selected':''}>50</option>
                        </select>
                    </div>
                    <span class="text-muted border-start ps-3" id="showing-count">${this.state.totalItems > 0 ? `${startItem}-${endItem}` : '0'} de ${this.state.totalItems}</span>
                </div>

                <div class="d-flex align-items-center gap-2" style="font-size: var(--fs-base); color: var(--text-body);">
                    <span>Página</span>
                    <span id="current-page" class="fw-medium text-center" style="min-width: 20px;">${this.state.currentPage}</span>
                    <span>de <span id="total-pages">${totalPages}</span></span>
                    <div class="ms-2">
                        <button class="btn btn-link text-muted p-0 me-1" id="btn-prev" ${this.state.currentPage <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
                        <button class="btn btn-link text-muted p-0" id="btn-next" ${this.state.currentPage >= totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>
                    </div>
                </div>
            </div>
        `;
        
        gridContainer.innerHTML = tableHtml;
        this.bindDynamicEvents(gridContainer);
    },

    bindStaticEvents() {
        const btnNuevoPago = this.element.querySelector('#btn-nuevo-pago');
        if (btnNuevoPago) {
            btnNuevoPago.addEventListener('click', () => {
                window.location.hash = '#/ingresos/pagos/nuevo';
            });
        }

        const inputSearch = this.element.querySelector('#search-pagos');
        const clearBtn = this.element.querySelector('#clearSearchBtn');
        let searchTimeout;
        if (inputSearch) {
            inputSearch.addEventListener('input', (e) => {
                const val = e.target.value;
                if (clearBtn) clearBtn.style.display = val ? '' : 'none';
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.state.searchQuery = val.trim();
                    this.state.currentPage = 1;
                    this.cargarPagos();
                }, 400);
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (inputSearch) inputSearch.value = '';
                clearBtn.style.display = 'none';
                this.state.searchQuery = '';
                this.state.currentPage = 1;
                this.cargarPagos();
            });
        }
    },

    bindDetailEvents(container) {
        const btnVolver = container.querySelector('#btn-volver-pagos');
        if (btnVolver) {
            btnVolver.addEventListener('click', () => {
                this.state.view = 'lista';
                this.state.currentComprobanteData = null;
                this.render();
            });
        }
        
        const btnVistaPrevia = container.querySelector('#btn-vista-previa-comprobante');
        if (btnVistaPrevia) {
            btnVistaPrevia.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.mostrarDetalle(id, 'vista-previa');
            });
        }
        
        const btnImprimirComprobante = container.querySelector('#btn-imprimir-comprobante');
        if (btnImprimirComprobante) {
            btnImprimirComprobante.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.mostrarDetalle(id, 'print');
            });
        }
        
        const btnEditarComprobante = container.querySelector('#btn-editar-comprobante');
        if (btnEditarComprobante) {
            btnEditarComprobante.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                import('../../shared/transaccionModal.js').then(async m => {
                    const { data } = await supabase.from('pagos_ingresos').select('*').eq('id', id).single();
                    if (data) {
                        m.mostrarDetalleTransaccion(data, () => {
                            this.state.view = 'lista';
                            this.cargarPagos();
                        });
                        setTimeout(() => {
                            const btnEdit = document.getElementById('btn-activar-edicion');
                            if (btnEdit) btnEdit.click();
                        }, 200);
                    }
                });
            });
        }
    },

    bindDynamicEvents(gridContainer) {
        const selectLimit = gridContainer.querySelector('#select-limit');
        if (selectLimit) {
            selectLimit.addEventListener('change', (e) => {
                this.state.itemsPerPage = parseInt(e.target.value, 10);
                this.state.currentPage = 1;
                this.cargarPagos();
            });
        }

        const inputPage = gridContainer.querySelector('#input-page');
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

        const btnPrev = gridContainer.querySelector('#btn-prev');
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                if (this.state.currentPage > 1) {
                    this.state.currentPage--;
                    this.cargarPagos();
                }
            });
        }

        const btnNext = gridContainer.querySelector('#btn-next');
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                const max = Math.ceil(this.state.totalItems / this.state.itemsPerPage) || 1;
                if (this.state.currentPage < max) {
                    this.state.currentPage++;
                    this.cargarPagos();
                }
            });
        }
        
        const btnRefresh = gridContainer.querySelector('#btn-refresh');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                this.cargarPagos();
            });
        }

        gridContainer.querySelectorAll('.row-pago').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.btn-menu-row') || e.target.closest('.dropdown-menu') || e.target.closest('a')) return;
                const id = row.getAttribute('data-id');
                this.mostrarDetalle(id, 'preview');
            });
        });

        gridContainer.querySelectorAll('.btn-menu-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof window.cleanupFloatingElements === 'function') {
                    window.cleanupFloatingElements();
                }

                const id = btn.getAttribute('data-id');
                const conciliado = btn.getAttribute('data-conciliado') === 'true';
                const anulado = btn.getAttribute('data-anulado') === 'true';
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
