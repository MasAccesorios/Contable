import { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions } from '../../shared/crud.js';
import { ItemEngine } from '../../shared/itemEngine.js';
import { EstadoUtils } from '../../shared/estadoUtils.js';
import { escapeHtml } from '../../shared/formatters.js';

import { NotasCreditoData } from './notasCredito.data.js';
import { NotasCreditoTemplates } from './notasCredito.templates.js';
import { NotasCreditoEvents } from './notasCredito.events.js';
import { AplicarSaldoNCModal } from './notasCredito.aplicarSaldo.js';

export const NotasCreditoModule = {
    state: {
        notas: [],
        notasFiltradas: [],
        currentPage: 1,
        itemsPerPage: 20,
        searchQuery: '',
        selectedTab: 'todas',
        totalItems: 0,
        isLoading: false,
        activeDrawerId: null,
        kpis: {
            saldoFavorPendiente: 0,
            totalAplicadasMes: 0,
            totalEmitidoMes: 0,
            totalAnuladasMes: 0,
            totalEmitidoHistorico: 0,
            conteoTotal: 0,
            conteoSaldoFavor: 0,
            conteoAplicadas: 0,
            conteoAnuladas: 0,
            clientesConSaldo: 0
        }
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        const hashParts = window.location.hash.split('/');
        const action = hashParts[3];
        const id = hashParts[4];

        if (action === 'nueva') {
            await this.renderForm(element, id, false, false);
        } else if (action === 'editar') {
            await this.renderForm(element, id, false, true);
        } else if (action === 'ver') {
            await this.renderForm(element, id, true, false);
        } else {
            return await this.renderList(element);
        }
    },

    async renderList(element) {
        this.element = element;
        this.state.currentPage = 1;
        this.state.searchQuery = '';
        this.state.selectedTab = 'todas';

        this.element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center py-5" style="min-height: 400px;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando notas de crédito...</span>
                </div>
            </div>
        `;

        await this.cargarNotasCredito();
        this.renderLayoutActual();

        return () => {
            if (this._onKeyDown) {
                document.removeEventListener('keydown', this._onKeyDown);
            }
        };
    },

    renderLayoutActual() {
        if (!this.element) return;
        this.element.innerHTML = this.renderLayout();
        this.bindStaticEvents();
        this.render();
    },

    render() {
        const container = this.element.querySelector('#nc-grid-container');
        if (!container) return;

        container.innerHTML = this.renderGrid();
        this.bindDynamicEvents(container);
    },

    async mostrarDrawer(id) {
        const backdrop = this.element.querySelector('#nc-drawer-backdrop');
        const drawer = this.element.querySelector('#nc-drawer');
        const body = this.element.querySelector('#nc-drawer-body');
        const actionsContainer = this.element.querySelector('#nc-drawer-action-buttons');
        if (actionsContainer) actionsContainer.innerHTML = '';
        if (!drawer || !body) return;

        body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando comprobante...</span>
                </div>
            </div>
        `;

        if (backdrop) backdrop.classList.add('show');
        drawer.classList.add('show');
        this.state.activeDrawerId = id;

        try {
            const detalle = await this.cargarDetalleNotaDrawer(id);
            if (!detalle) {
                this.cerrarDrawer();
                return;
            }

            body.innerHTML = this.renderDrawerContent(detalle);
            this.bindDrawerActionEvents(detalle, actionsContainer);
        } catch (err) {
            console.error('[NotasCreditoModule] Error cargando drawer:', err);
            body.innerHTML = `<div class="p-4 text-center text-danger">Error cargando detalle de la nota.</div>`;
        }
    },

    cerrarDrawer() {
        const backdrop = this.element.querySelector('#nc-drawer-backdrop');
        const drawer = this.element.querySelector('#nc-drawer');
        if (backdrop) backdrop.classList.remove('show');
        if (drawer) drawer.classList.remove('show');
        this.state.activeDrawerId = null;
    },

    async renderForm(element, id, isViewOnly, isEditMode = false) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" style="color: var(--primary);" role="status"></div>
            </div>
        `;

        try {
            let nota = null;
            let detallesNota = [];
            let facturaOrigen = null;
            let clienteNombre = '';
            let saldoAFavorNC = 0;

            if (id) {
                // Cargar nota existente
                const { data: nData, error: nErr } = await supabase.from('notas_credito').select('*').eq('id', id).single();
                if (nErr || !nData) {
                    element.innerHTML = `
                        <div class="p-4 text-center">
                            <p class="text-danger mb-2">No se encontró la nota de crédito solicitada.</p>
                            <button class="btn btn-sm btn-outline-secondary" onclick="window.location.hash='#/ingresos/notas-credito'">Volver a Notas de Crédito</button>
                        </div>`;
                    return;
                }
                nota = nData;
                
                const { data: detData } = await supabase.from('nota_credito_detalles').select('*').eq('nota_credito_id', id);
                detallesNota = detData || [];

                if (nota && nota.factura_id) {
                    const { data: fData } = await supabase.from('facturas').select('*').eq('id', nota.factura_id).single();
                    facturaOrigen = fData;

                    if (nota.contacto_id) {
                        const { data: cData } = await supabase.from('contactos').select('nombre').eq('id', nota.contacto_id).single();
                        if (cData) clienteNombre = cData.nombre;
                    }
                }

                const refNC = 'NC-' + String(nota.numero || nota.id).trim();
                const { data: pagosNC } = await supabase.from('pagos_ingresos').select('monto').ilike('referencia', refNC).neq('estado', 'anulado');
                const sumaMontos = (pagosNC || []).reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
                saldoAFavorNC = Math.max(0, Number(nota.total || 0) - sumaMontos);
            } else {
                nota = {
                    fecha: getLocalDate(),
                    motivo: 'Devolución de mercancía',
                    total: 0,
                    observaciones: ''
                };
            }

            let productosMap = {};
            if (detallesNota.length > 0) {
                const pIds = [...new Set(detallesNota.map(d => parseInt(d.producto_id, 10)).filter(id => !isNaN(id) && id > 0))];
                if (pIds.length > 0) {
                    const { data: prods } = await supabase.from('productos').select('id, nombre').in('id', pIds);
                    prods?.forEach(p => productosMap[p.id] = p.nombre);
                }
            }

            let headerTitle = id ? (EstadoUtils.estaAnulado(nota.estado) ? 'Nota de Crédito (ANULADA)' : 'Detalle de Nota de Crédito') : 'Nueva Nota de Crédito';
            let headerSubtitle = id ? 'NC-' + (nota.numero || nota.id) : 'Crear documento de devolución';

            let html = `
                <div class="dash-layout p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <button class="btn btn-link text-muted p-0 text-decoration-none mb-2" onclick="window.location.hash='#/ingresos/notas-credito'">
                                <i class="bi bi-arrow-left me-1"></i>Volver a Notas de Crédito
                            </button>
                            <h2 class="page-title">${headerTitle}</h2>
                            <p class="text-muted mb-0">${headerSubtitle}</p>
                        </div>
                        <div class="d-flex gap-2">
                            ${(id && !EstadoUtils.estaAnulado(nota.estado) && saldoAFavorNC > 0) ? `
                                <button id="btn-aplicar-saldo-nc" class="btn btn-outline-primary bg-white" style="font-weight: 500;">
                                    <i class="bi bi-arrow-left-right me-1"></i> Aplicar saldo a favor
                                </button>
                            ` : ''}
                            ${(id && !isViewOnly && !EstadoUtils.estaAnulado(nota.estado)) ? `
                                <button id="btn-anular-nc" class="btn btn-outline-danger bg-white" style="font-weight: 500;">
                                    <i class="bi bi-x-circle me-1"></i> Anular Nota de Crédito
                                </button>
                            ` : ''}
                        </div>
                    </div>
            `;

            // Form container
            html += `<div class="dash-table-container mb-4" style="overflow: visible;">
                <div class="card-body p-4">`;

            let htmlRecibo = '';

            if (!id || isEditMode) {
                // Modo creación o edición
                html += `
                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <label class="form-label fw-medium text-muted small">${isEditMode ? 'Factura de Venta origen' : 'Buscar Factura de Venta origen'}</label>
                            ${!isEditMode ? `
                            <div class="custom-combobox position-relative" id="combo-factura-container">
                                <div class="input-group">
                                    <span class="input-group-text bg-light border-end-0"><i class="bi bi-search"></i></span>
                                    <input type="text" id="input-buscar-factura" class="form-control border-start-0" placeholder="Buscar por número..." autocomplete="off">
                                    <input type="hidden" id="factura-id-hidden">
                                </div>
                            </div>
                            ` : ''}
                            <div id="factura-search-result" class="mt-2 small">
                                ${isEditMode ? `<span class="text-success fw-bold">Factura asociada: #${facturaOrigen?.numero} - Cliente: ${escapeHtml(clienteNombre)} - Total: ${Number(facturaOrigen?.total || 0).toLocaleString()}</span>` : ''}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-medium text-muted small">Fecha</label>
                            <input type="date" id="nc-fecha" class="form-control" value="${nota.fecha}">
                        </div>
                    </div>
                    <div class="mb-4">
                        <label class="form-label fw-medium text-muted small">Motivo</label>
                        <input type="text" id="nc-motivo" class="form-control" value="${escapeHtml(nota.motivo)}">
                    </div>
                    
                    <div id="items-container" class="${!isEditMode ? 'd-none' : ''}">
                        <h6 class="fw-bold mb-3">Ítems a Devolver</h6>
                        <div class="table-responsive">
                            <table class="table table-borderless align-middle" style="border-spacing: 0; min-width: 600px;">
                                <thead style="border-bottom: 1px solid var(--border-color);">
                                    <tr style="color: var(--text-muted); font-weight: var(--weight-regular); font-size: var(--fs-base);">
                                        <th>Producto o servicio</th>
                                        <th class="text-end" style="width: 150px;">Precio Facturado</th>
                                        <th class="text-center" style="width: 150px;">Cant. a Devolver</th>
                                        <th class="text-end" style="width: 150px;">Subtotal NC</th>
                                    </tr>
                                </thead>
                                <tbody id="nc-tbody"></tbody>
                            </table>
                        </div>
                        <div class="d-flex justify-content-end mb-3">
                            <h5 class="fw-bold">Total NC: $<span id="nc-total-display">0.00</span></h5>
                        </div>
                    </div>
                `;
            } else if (id && isViewOnly) {
                // Modo vista
                let statusBadgeClass = EstadoUtils.estaAnulado(nota.estado) ? 'mas-receipt-status-anulada' : 'mas-receipt-status-aplicada';
                let statusText = EstadoUtils.estaAnulado(nota.estado) ? 'Anulada' : 'Aplicada';
                htmlRecibo = `
                    <style>
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
                            border-radius: 999px;
                            font-size: 11px;
                            font-weight: 600;
                            letter-spacing: 0.5px;
                            text-transform: uppercase;
                        }
                        .mas-receipt-status-aplicada { background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
                        .mas-receipt-status-anulada { background-color: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
                        
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
                            vertical-align: middle;
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
                    </style>
                    <div class="mas-receipt-container" style="padding: 20px;">
                        <div class="mas-receipt-card">
                            <div class="mas-receipt-header d-flex justify-content-between align-items-center">
                                <div><img src="LogoMas.png" alt="MAS Accesorios" style="max-height: 40px; object-fit: contain;"></div>
                                <div class="text-end">
                                    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; letter-spacing: -0.5px;">NOTA DE CRÉDITO</h2>
                                    <div class="d-flex align-items-center justify-content-end gap-3">
                                        <span style="font-size: 13px; color: #64748b; font-weight: 500;">Nº <span style="color: #0f172a; font-weight: 700;">${nota.numero || nota.id}</span></span>
                                        <span class="mas-receipt-status-badge ${statusBadgeClass}">${statusText}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="mas-receipt-body">
                                <div class="row mb-4 mt-2">
                                    <div class="col-6">
                                        <div class="mas-receipt-info-label">CLIENTE</div>
                                        <div class="mas-receipt-info-value">${escapeHtml(clienteNombre) || 'N/A'}</div>
                                    </div>
                                    <div class="col-6 text-end">
                                        <div class="mas-receipt-info-label">FACTURA ORIGEN</div>
                                        <div class="mas-receipt-info-value">#${facturaOrigen?.numero || facturaOrigen?.id || 'N/A'}</div>
                                    </div>
                                    <div class="col-6 mt-3">
                                        <div class="mas-receipt-info-label">FECHA</div>
                                        <div class="mas-receipt-info-value">${nota.fecha}</div>
                                    </div>
                                    <div class="col-6 mt-3 text-end">
                                        <div class="mas-receipt-info-label">MOTIVO</div>
                                        <div class="mas-receipt-info-value">${escapeHtml(nota.motivo) || 'N/A'}</div>
                                    </div>
                                </div>
                                <table class="table table-borderless mas-receipt-table mb-4">
                                    <thead>
                                        <tr>
                                            <th class="text-start">PRODUCTO O SERVICIO</th>
                                            <th class="text-center">CANT. DEVUELTA</th>
                                            <th class="text-end">PRECIO UNIT.</th>
                                            <th class="text-end">SUBTOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${detallesNota.map(d => `
                                            <tr>
                                                <td class="text-start fw-medium text-dark">${escapeHtml(productosMap[d.producto_id] || ('Ítem ' + d.producto_id))}</td>
                                                <td class="text-center">${d.cantidad}</td>
                                                <td class="text-end">$${Number(d.precio_unitario || 0).toLocaleString()}</td>
                                                <td class="text-end fw-bold text-dark">$${Number(d.subtotal || 0).toLocaleString()}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="mas-receipt-footer">
                                <div class="mas-receipt-total-row border-0 pt-0">
                                    <div class="mas-receipt-total-label">TOTAL NC</div>
                                    <div class="mas-receipt-total-amount">$${Number(nota.total || 0).toLocaleString()}</div>
                                </div>
                                <div class="row mt-4 pt-4 border-top" style="border-color: #e2e8f0 !important;">
                                    <div class="col-6">
                                        <div style="border-top: 1px solid #94a3b8; width: 80%; padding-top: 5px; font-size: 11px; color: #64748b; font-weight: 500;">
                                            ELABORADO POR
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div style="border-top: 1px solid #94a3b8; width: 80%; padding-top: 5px; font-size: 11px; color: #64748b; font-weight: 500; margin-left: auto;">
                                            RECIBIDO / ACEPTADO
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            html += `</div></div>`; // End form container

            if (!id || isEditMode) {
                html += `
                    <div class="d-flex justify-content-end gap-3 mb-5">
                        <button class="btn btn-outline-secondary px-4 bg-white" onclick="window.location.hash='#/ingresos/notas-credito'">Cancelar</button>
                        <button id="btn-guardar-nc" class="btn btn-primary-action px-5 ${!isEditMode ? 'd-none' : ''}">${isEditMode ? 'Guardar Cambios' : 'Crear Nota de Crédito'}</button>
                    </div>
                `;
            }

            html += `</div>`;
            element.innerHTML = html;

            if (id && isViewOnly) {
                import('../../shared/printManager.js').then(({ PrintManager }) => {
                    PrintManager._renderPreviewShell(htmlRecibo, { 
                        mode: 'preview', 
                        title: 'Nota de Crédito', 
                        fileName: `NotaCredito_${nota.numero || nota.id}.png`, 
                        printClass: 'formato-media-carta' 
                    });
                    
                    setTimeout(() => {
                        const btnCerrar = document.querySelector('.btn-cerrar-preview');
                        if (btnCerrar) {
                            btnCerrar.addEventListener('click', () => window.location.hash = '#/ingresos/notas-credito');
                        }
                    }, 50);
                });
            }

            // Logica de creación y edición
            if (!id || isEditMode) {
                let currentFactura = isEditMode ? facturaOrigen : null;
                let currentDetalles = [];

                const btnGuardar = element.querySelector('#btn-guardar-nc');
                const tbody = element.querySelector('#nc-tbody');
                const totalDisplay = element.querySelector('#nc-total-display');
                
                
                const updateTotals = () => {
                    let sum = 0;
                    element.querySelectorAll('.nc-input-qty').forEach((input) => {
                        const qty = parseFloat(input.value) || 0;
                        const maxQty = parseFloat(input.dataset.max) || 0;
                        if (qty > maxQty) input.value = maxQty;
                        if (qty < 0) input.value = 0;
                        
                        const finalQty = parseFloat(input.value) || 0;
                        const price = parseFloat(input.dataset.price) || 0;
                        const sub = finalQty * price;
                        sum += sub;
                        
                        input.closest('tr').querySelector('.nc-subtotal').textContent = sub.toLocaleString();
                    });
                    totalDisplay.textContent = sum.toLocaleString();
                    if (sum > 0) btnGuardar.classList.remove('d-none');
                    else if (!isEditMode) btnGuardar.classList.add('d-none');
                };

                const resultDiv = element.querySelector('#factura-search-result');
                
                if (isEditMode) {
                    const loadEditModeData = async () => {
                        try {
                            const { data: fdets } = await supabase.from('factura_detalles').select('*').eq('factura_id', currentFactura.id);
                            currentDetalles = fdets || [];
                            
                            const pIds = [...new Set(currentDetalles.map(d => d.producto_id).filter(Boolean))];
                            let productosFactura = [];
                            if (pIds.length > 0) {
                                const { data: prodsData } = await supabase.from('productos').select('id, sku, nombre').in('id', pIds);
                                if (prodsData) productosFactura = prodsData;
                            }
                            
                            tbody.innerHTML = currentDetalles.map((d, index) => {
                                const price = parseFloat(d.precio_unitario || d.precio) || 0;
                                const detalleMock = { productoId: d.producto_id, descripcion_personalizada: d.descripcion_personalizada || '' };
                                
                                const existingDetalle = detallesNota.find(dn => dn.producto_id === d.producto_id);
                                const returnedQty = existingDetalle ? existingDetalle.cantidad : 0;
                                
                                return `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td class="align-top py-3">${ItemEngine.renderProductSearchBox(detalleMock, productosFactura, true)}</td>
                                        <td class="align-top text-end py-3">
                                            <input type="text" class="form-control form-control-sm border-0 bg-light text-end" value="${price.toLocaleString()}" disabled>
                                        </td>
                                        <td class="align-top py-3">
                                            <div class="d-flex align-items-center gap-2">
                                                <input type="number" class="form-control form-control-sm border-0 bg-light nc-input-qty text-center" 
                                                       data-index="${index}" data-max="${d.cantidad}" data-price="${price}" data-prodid="${d.producto_id}" 
                                                       value="${returnedQty}" min="0" max="${d.cantidad}" step="1">
                                                <span class="text-muted small text-nowrap">/ ${d.cantidad}</span>
                                            </div>
                                        </td>
                                        <td class="text-end align-top py-3 fw-bold">$<span class="nc-subtotal">${(returnedQty * price).toLocaleString()}</span></td>
                                    </tr>
                                `;
                            }).join('');
                            
                            element.querySelectorAll('.nc-input-qty').forEach(inp => {
                                inp.addEventListener('input', updateTotals);
                            });
                            updateTotals();
                        } catch (err) {
                            console.error("Error loading edit mode data:", err);
                        }
                    };
                    loadEditModeData();
                } else {
                    import('../../shared/combobox.js').then(({ UI }) => {
                    UI.createAsyncCombobox({
                        inputEl: element.querySelector('#input-buscar-factura'),
                        hiddenIdEl: element.querySelector('#factura-id-hidden'),
                        fetchItems: (query) => UI.fetchFacturasCombobox(query),
                        displayProp: 'numero',
                        renderItem: (item) => {
                            const total = item.total ? Number(item.total).toLocaleString() : '0';
                            const cliente = item.cliente_nombre ? item.cliente_nombre : 'Sin Cliente';
                            return `
                                <div class="d-flex flex-column">
                                    <span class="fw-bold text-dark">#${item.numero} - ${escapeHtml(cliente)}</span>
                                    <span class="text-muted small">Total: $${total}</span>
                                </div>
                            `;
                        },
                        onSelect: async (selectedItem) => {
                            if (!selectedItem) return;
                            
                            resultDiv.innerHTML = '<span class="text-muted">Cargando detalles...</span>';
                            
                            try {
                        if (selectedItem.estado === 'anulada' || selectedItem.estado === 'void') {
                            resultDiv.innerHTML = '<span class="text-danger fw-medium">Esta factura está anulada, no se puede generar una nota de crédito sobre ella.</span>';
                            currentFactura = null;
                            element.querySelector('#items-container').classList.add('d-none');
                            btnGuardar.classList.add('d-none');
                            return;
                        }
                        
                        currentFactura = selectedItem;
                        
                        // Cargar detalles de la factura
                        const { data: fdets } = await supabase.from('factura_detalles').select('*').eq('factura_id', currentFactura.id);
                        currentDetalles = fdets || [];
                        
                        if (currentDetalles.length === 0) {
                            resultDiv.innerHTML = '<span class="text-warning fw-medium">Factura encontrada pero no tiene ítems guardados.</span>';
                            return;
                        }
                        
                        // Extraer IDs únicos de productos y traer sus nombres y SKUs reales
                        const pIds = [...new Set(currentDetalles.map(d => d.producto_id).filter(Boolean))];
                        let productosFactura = [];
                        if (pIds.length > 0) {
                            const { data: prodsData } = await supabase.from('productos').select('id, sku, nombre').in('id', pIds);
                            if (prodsData) {
                                productosFactura = prodsData;
                            }
                        }

                        let clientName = currentFactura.cliente_nombre || 'Sin Cliente';
                        
                        // Asegurar que currentFactura tenga contacto_id para btnGuardar
                        if (!currentFactura.contacto_id && !currentFactura.clienteId) {
                            const { data: fData } = await supabase.from('facturas').select('contacto_id').eq('id', currentFactura.id).single();
                            if (fData) {
                                currentFactura.contacto_id = fData.contacto_id;
                            }
                        }

                        resultDiv.innerHTML = `<span class="text-success fw-bold">Factura seleccionada: #${currentFactura.numero} - Cliente: ${escapeHtml(clientName)} - Total: ${Number(currentFactura.total).toLocaleString()}</span>`;
                        element.querySelector('#items-container').classList.remove('d-none');
                        
                        tbody.innerHTML = currentDetalles.map((d, index) => {
                            const price = parseFloat(d.precio_unitario || d.precio) || 0; // Se lee precio_unitario, fallback a precio
                            
                            // Mockeamos el objeto detalle para ItemEngine
                            const detalleMock = {
                                productoId: d.producto_id,
                                descripcion_personalizada: d.descripcion_personalizada || ''
                            };
                            
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <td class="align-top py-3">
                                        ${ItemEngine.renderProductSearchBox(detalleMock, productosFactura, true)}
                                    </td>
                                    <td class="align-top text-end py-3">
                                        <input type="text" class="form-control form-control-sm border-0 bg-light text-end" value="$${price.toLocaleString()}" disabled>
                                    </td>
                                    <td class="align-top py-3">
                                        <div class="d-flex align-items-center gap-2">
                                            <input type="number" class="form-control form-control-sm border-0 bg-light nc-input-qty text-center" 
                                                   data-index="${index}" data-max="${d.cantidad}" data-price="${price}" data-prodid="${d.producto_id}" 
                                                   value="0" min="0" max="${d.cantidad}" step="1">
                                            <span class="text-muted small text-nowrap">/ ${d.cantidad}</span>
                                        </div>
                                    </td>
                                    <td class="text-end align-top py-3 fw-bold">
                                        $<span class="nc-subtotal">0</span>
                                    </td>
                                </tr>
                            `;
                        }).join('');

                        element.querySelectorAll('.nc-input-qty').forEach(inp => {
                            inp.addEventListener('input', updateTotals);
                        });
                        updateTotals();

                    } catch (e) {
                        resultDiv.innerHTML = `<span class="text-danger">Error: ${escapeHtml(e.message)}</span>`;
                    }
                        }
                    });
                });
                }

                btnGuardar.addEventListener('click', async () => {
                    btnGuardar.disabled = true;
                    btnGuardar.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Guardando...';

                    try {
                        let totalNC = 0;
                        const selectedItems = [];
                        
                        element.querySelectorAll('.nc-input-qty').forEach(inp => {
                            const qty = parseFloat(inp.value) || 0;
                            if (qty > 0) {
                                const subtotal = qty * parseFloat(inp.dataset.price);
                                totalNC += subtotal;
                                selectedItems.push({
                                    productoId: inp.dataset.prodid,
                                    cantidad: qty,
                                    precio: inp.dataset.price,
                                    subtotal: subtotal
                                });
                            }
                        });

                        
                        if (selectedItems.length === 0) throw new Error("Debe seleccionar al menos un ítem para devolver.");
                        
                        // CREACIÓN y EDICIÓN vía RPC atómicos (validan, escriben NC, detalles, pago cruzado hasta el saldo e inventario en una transacción)
                        const itemsRpc = selectedItems.map(si => ({
                            producto_id: parseInt(si.productoId),
                            cantidad: si.cantidad,
                            precio_unitario: parseFloat(si.precio)
                        }));
                        const fechaNC = element.querySelector('#nc-fecha').value;
                        const motivoNC = element.querySelector('#nc-motivo').value;
                        const { data: res, error: rpcErr } = isEditMode
                            ? await supabase.rpc('editar_nota_credito', { p_nc_id: parseInt(id), p_fecha: fechaNC, p_motivo: motivoNC, p_items: itemsRpc })
                            : await supabase.rpc('crear_nota_credito', { p_factura_id: currentFactura.id, p_fecha: fechaNC, p_motivo: motivoNC, p_items: itemsRpc });
                        if (rpcErr) throw new Error(rpcErr.message);
                        let msg = isEditMode
                            ? `Nota de crédito #${res.numero} actualizada con éxito. Inventario actualizado.`
                            : `Nota de crédito #${res.numero} creada con éxito. Inventario actualizado.`;
                        if (parseFloat(res.saldo_a_favor) > 0) {
                            msg += ` Saldo a favor del cliente: $${parseFloat(res.saldo_a_favor).toLocaleString('es-CO')} (la factura ya estaba pagada o su saldo no alcanzaba).`;
                        }
                        CoreActions.showSuccessModal(msg);
                        window.location.hash = '#/ingresos/notas-credito';

                    } catch (e) {
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = 'Crear Nota de Crédito';
                        CoreActions.showErrorModal(e.message);
                    }
                });
            }

            const btnAplicarSaldo = element.querySelector('#btn-aplicar-saldo-nc');
            if (btnAplicarSaldo) {
                btnAplicarSaldo.addEventListener('click', (e) => {
                    e.preventDefault();
                    AplicarSaldoNCModal.abrir({
                        ncId: id,
                        ncNumero: nota.numero || nota.id,
                        contactoId: nota.contacto_id,
                        clienteNombre: clienteNombre,
                        saldoAFavor: saldoAFavorNC,
                        onSuccess: () => {
                            window.location.hash = '#/ingresos/notas-credito';
                        }
                    });
                });
            }

            const btnAnular = element.querySelector('#btn-anular-nc');
            if (btnAnular) {
                btnAnular.addEventListener('click', async (e) => {
                    e.preventDefault();
                    if (confirm('¿Está seguro que desea anular esta nota de crédito? Esta acción revertirá el saldo y los movimientos de inventario.')) {
                        btnAnular.disabled = true;
                        try {
                            await NotasCreditoModule.anularNotaCredito(id);
                            CoreActions.showSuccessModal("Nota de Crédito anulada correctamente.");
                            window.location.hash = '#/ingresos/notas-credito';
                        } catch (err) {
                            btnAnular.disabled = false;
                            CoreActions.showErrorModal("Error anulando: " + err.message);
                        }
                    }
                });
            }
        } catch (e) {
            console.error(e);
            element.innerHTML = `<div class="p-4 text-danger">Error: ${escapeHtml(e.message)}</div>`;
        }
    }
};

Object.assign(NotasCreditoModule, NotasCreditoData, NotasCreditoTemplates, NotasCreditoEvents);

export default NotasCreditoModule;
