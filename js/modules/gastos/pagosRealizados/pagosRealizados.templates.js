import { escapeHtml } from '../../../shared/formatters.js';

function getVendorAvatar(name) {
    if (!name || name === 'Sin proveedor') return { initials: '?', bg: '#f1f5f9', color: '#64748b' };
    const clean = name.trim();
    const parts = clean.split(/\s+/);
    let initials = parts[0][0] || '';
    if (parts.length > 1 && parts[1][0]) initials += parts[1][0];
    initials = initials.toUpperCase();

    const colors = [
        { bg: '#fef2f2', color: '#dc2626' }, // Coral
        { bg: '#fff7ed', color: '#ea580c' }, // Orange
        { bg: '#fef3c7', color: '#d97706' }, // Amber
        { bg: '#f3e8ff', color: '#7e22ce' }, // Purple
        { bg: '#eff6ff', color: '#2563eb' }, // Blue
        { bg: '#f1f5f9', color: '#475569' }  // Slate
    ];
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % colors.length;
    return { initials: initials.substring(0, 2), ...colors[index] };
}

export const PagosRealizadosTemplates = {
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
                .mas-receipt-total-row {
                    display: flex;
                    justify-content: flex-end;
                    align-items: baseline;
                    gap: 10px;
                    padding-top: 14px;
                    border-top: 2px solid #dc2626;
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
                    color: rgba(220, 38, 38, 0.04);
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
                            <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; letter-spacing: -0.5px;">COMPROBANTE DE EGRESO</h2>
                            <div class="d-flex align-items-center justify-content-end gap-3">
                                <span style="font-size: 13px; color: #64748b; font-weight: 500;">Nº <span style="color: #0f172a; font-weight: 700;">${t.grupo_pago_id ? (t.numero_recibo ? String(t.numero_recibo).padStart(4, '0') : t.grupo_pago_id) : (t.numero || t.id)}</span></span>
                                <span class="mas-receipt-status-badge">Pagado</span>
                            </div>
                        </div>
                    </div>

                    <div class="mas-receipt-body position-relative" style="z-index: 1;">
                        <div class="mas-receipt-stamp">PAGO REALIZADO</div>
                        
                        <div class="row mb-3 align-items-start">
                            <div class="col-sm-6 mb-2 mb-sm-0">
                                <div class="mas-receipt-info-label">Pagado a</div>
                                ${(t.contacto_id || t.facturas?.contacto_id) ? `
                                <a href="#/contactos/ver/${t.contacto_id || t.facturas?.contacto_id}" class="mas-receipt-info-value text-decoration-none d-inline-flex align-items-center gap-1" title="${escapeHtml(t.contactos?.nombre || t.facturas?.contactos?.nombre) || 'Proveedor / Tercero'}" style="font-size: 14px; font-weight: 700; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--bs-primary);">
                                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(t.contactos?.nombre || t.facturas?.contactos?.nombre) || 'Proveedor / Tercero'}</span>
                                    <i class="bi bi-box-arrow-up-right" style="font-size: 0.75rem;"></i>
                                </a>
                                ` : `
                                <div class="mas-receipt-info-value" title="${escapeHtml(t.contactos?.nombre || t.facturas?.contactos?.nombre) || 'Proveedor / Tercero'}" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(t.contactos?.nombre || t.facturas?.contactos?.nombre) || 'Proveedor / Tercero'}</div>
                                `}
                                ${(t.contactos?.identificacion || t.facturas?.contactos?.identificacion) ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">NIT/CC: ${escapeHtml(t.contactos?.identificacion || t.facturas?.contactos?.identificacion)}</div>` : ''}
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
                                            ${escapeHtml(t.cuentas_bancarias?.nombre) || 'Efectivo / Caja'}
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
                                ${t.itemsGrupo ? t.itemsGrupo.map(p => `
                                <tr>
                                    <td class="text-start">
                                        <div style="font-weight: 600; color: #0f172a;">${escapeHtml(p.categoria) || 'Abono / Pago de factura'}</div>
                                    </td>
                                    <td class="text-center">
                                        ${p.factura_id ?
                                            `<span style="background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-size: 11px; font-weight: 600; color: #475569;"># ${p.facturas?.numero || p.factura_id}</span>`
                                            : '<span style="color: #94a3b8; font-size: 12px;">N/A</span>'}
                                    </td>
                                    <td class="text-end" style="font-weight: 600; color: #0f172a;">
                                        $${Number(p.monto).toLocaleString('es-CO')}
                                    </td>
                                </tr>
                                `).join('') : `
                                <tr>
                                    <td class="text-start">
                                        <div style="font-weight: 600; color: #0f172a;">${escapeHtml(t.categoria) || 'Abono / Pago de factura'}</div>
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
                                `}
                            </tbody>
                        </table>
                    </div>

                    <div class="mas-receipt-footer position-relative" style="z-index: 1;">
                        <div class="mas-receipt-info-label" style="color: #475569;">Observaciones</div>
                        <p style="font-size: 12px; color: #64748b; line-height: 1.4; margin: 0 0 16px 0; padding-right: 15px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${t.observaciones ? escapeHtml(t.observaciones) : 'Sin notas adicionales.'}
                        </p>
                        <div class="mas-receipt-total-row">
                            <span class="mas-receipt-total-label">Total Pagado</span>
                            <span class="mas-receipt-total-amount">$${Number(t.monto).toLocaleString('es-CO')}</span>
                        </div>
                        
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

    renderComprobanteWrapper(container) {
        const t = this.state.currentComprobanteData;
        container.innerHTML = `
            <div class="py-4 px-4" style="font-family: 'Inter', sans-serif; background-color: var(--bg-main); min-height: 100vh;">
                <div class="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style="max-width: 750px; margin: 0 auto;">
                    <button class="btn btn-link text-decoration-none text-muted p-0 d-flex align-items-center gap-2 fw-medium" id="btn-volver-pagos">
                        <i class="bi bi-arrow-left"></i> Volver a Pagos Realizados
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
                    <h2 class="h3 fw-bold m-0" style="color: var(--text-main);">Pago Realizado</h2>
                </div>
                ${this.getComprobanteHTML(t)}
            </div>
        `;
        this.bindDetailEvents(container);
    },

    renderDrawerContent(t) {
        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        const formatFecha = dateStr => {
            if (!dateStr) return '---';
            const partes = dateStr.split('-');
            return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dateStr;
        };

        const provNombre = t.contactos?.nombre || t.facturas?.contactos?.nombre || 'Proveedor General / Tercero';
        const provNit = t.contactos?.identificacion || t.facturas?.contactos?.identificacion || '';
        const numComprobante = t.grupo_pago_id ? (t.numero_recibo ? String(t.numero_recibo).padStart(4, '0') : t.grupo_pago_id) : (t.numero || t.id);
        const avatar = getVendorAvatar(provNombre);

        return `
            <!-- Header del Egreso -->
            <div class="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
                <div class="d-flex align-items-center gap-3">
                    <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 44px; height: 44px; font-size: 15px;">
                        ${avatar.initials}
                    </div>
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="payment-code-badge" style="border-color: #fecaca; color: #dc2626;">EGRESO #${numComprobante}</span>
                            ${t.estado === 'anulado'
                                ? '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill">Anulado</span>'
                                : '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">Pagado</span>'
                            }
                        </div>
                        <h4 class="fw-bold mb-0 mt-1" style="font-size: 17px; color: #0f172a;">${escapeHtml(provNombre)}</h4>
                        ${provNit ? `<span class="text-muted" style="font-size: 12px;">NIT / CC: ${escapeHtml(provNit)}</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- Banner de Monto de Egreso -->
            <div class="p-3 rounded-3 mb-4 d-flex justify-content-between align-items-center" style="background: linear-gradient(135deg, #fef2f2, #fff1f2); border: 1px solid #fecaca;">
                <div>
                    <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Monto Total Pagado</span>
                    <h2 class="fw-bold text-danger mb-0 tnum" style="letter-spacing: -0.5px;">-${formatMoney(t.monto)}</h2>
                </div>
                <div class="text-end">
                    <span class="badge bg-white text-dark border px-3 py-2 rounded-3 shadow-xs" style="font-size: 12px;">
                        <i class="bi bi-calendar3 me-1 text-danger"></i> ${formatFecha(t.fecha)}
                    </span>
                </div>
            </div>

            <!-- Línea de Tiempo de Trazabilidad del Egreso -->
            <div class="mb-4">
                <h6 class="fw-bold text-uppercase text-muted mb-3" style="font-size: 11px; letter-spacing: 0.5px;">
                    <i class="bi bi-signpost-split me-1 text-danger"></i> Trazabilidad del Desembolso
                </h6>
                <div class="ps-2">
                    <!-- Hito 1: Factura de Compra / Concepto -->
                    <div class="payment-timeline-item">
                        <div class="payment-timeline-dot" style="border-color: #dc2626;">
                            <i class="bi bi-bag-check" style="font-size: 9px; color: #dc2626;"></i>
                        </div>
                        <div class="fw-semibold text-dark" style="font-size: 13px;">Destino del Pago</div>
                        <div class="text-muted" style="font-size: 12px; margin-top: 2px;">
                            ${t.factura_id ? `
                                Vinculado a <a href="#/gastos/compras/ver/${t.factura_id}" class="text-danger fw-medium text-decoration-none">Compra #${t.facturas?.numero || t.factura_id}</a>
                                ${t.facturas?.total ? `<span class="badge bg-light text-secondary border ms-1">Total Compra: ${formatMoney(t.facturas.total)}</span>` : ''}
                            ` : (t.itemsGrupo && t.itemsGrupo.length > 1 ? `
                                Pago agrupado cubriendo <strong>${t.itemsGrupo.length} facturas de compra</strong>
                            ` : 'Egreso operativo directo / Anticipo a proveedor.')}
                        </div>
                    </div>

                    <!-- Hito 2: Cuenta Origen de Salida -->
                    <div class="payment-timeline-item">
                        <div class="payment-timeline-dot">
                            <i class="bi bi-bank" style="font-size: 9px; color: #2563eb;"></i>
                        </div>
                        <div class="fw-semibold text-dark" style="font-size: 13px;">Cuenta de Origen</div>
                        <div class="text-muted" style="font-size: 12px; margin-top: 2px;">
                            Desembolsado desde <strong>${escapeHtml(t.cuentas_bancarias?.nombre || 'Efectivo / Caja')}</strong>
                            ${t.categoria ? `<span class="ms-1 text-secondary">(${escapeHtml(t.categoria)})</span>` : ''}
                        </div>
                    </div>

                    <!-- Hito 3: Conciliación Bancaria -->
                    <div class="payment-timeline-item">
                        <div class="payment-timeline-dot ${t.conciliado_en || t.conciliacion_id ? 'success' : 'warning'}">
                            <i class="bi bi-${t.conciliado_en || t.conciliacion_id ? 'check-circle-fill' : 'clock'}" style="font-size: 9px; color: ${t.conciliado_en || t.conciliacion_id ? '#059669' : '#d97706'};"></i>
                        </div>
                        <div class="fw-semibold text-dark" style="font-size: 13px;">Conciliación en Extracto</div>
                        <div class="text-muted" style="font-size: 12px; margin-top: 2px;">
                            ${t.conciliado_en || t.conciliacion_id
                                ? `<span class="text-success"><i class="bi bi-check-circle me-1"></i> Movimiento verificado y conciliado con el banco.</span>`
                                : `<span class="text-warning-emphasis"><i class="bi bi-clock-history me-1"></i> Pendiente de conciliar en el extracto bancario.</span>`
                            }
                        </div>
                    </div>
                </div>
            </div>

            <!-- Desglose Si es Agrupado -->
            ${t.itemsGrupo && t.itemsGrupo.length > 1 ? `
            <div class="mb-4">
                <h6 class="fw-bold text-uppercase text-muted mb-2" style="font-size: 11px; letter-spacing: 0.5px;">
                    Compras Saldadas en este Egreso (${t.itemsGrupo.length})
                </h6>
                <div class="table-responsive rounded-3 border">
                    <table class="table table-sm align-middle mb-0" style="font-size: 12px;">
                        <thead class="bg-light">
                            <tr>
                                <th class="py-2 ps-3">Compra</th>
                                <th class="py-2">Concepto</th>
                                <th class="py-2 text-end pe-3">Valor Pagado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${t.itemsGrupo.map(p => `
                            <tr>
                                <td class="py-2 ps-3">
                                    ${p.factura_id ? `<a href="#/gastos/compras/ver/${p.factura_id}" class="text-danger fw-medium text-decoration-none"># ${p.facturas?.numero || p.factura_id}</a>` : 'Directo'}
                                </td>
                                <td class="py-2 text-muted">${escapeHtml(p.categoria || 'Abono compra')}</td>
                                <td class="py-2 text-end pe-3 fw-bold text-dark tnum">${formatMoney(p.monto)}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}

            <!-- Observaciones -->
            <div class="mb-4">
                <h6 class="fw-bold text-uppercase text-muted mb-1" style="font-size: 11px; letter-spacing: 0.5px;">Notas y Observaciones</h6>
                <div class="p-3 bg-light rounded-3 text-secondary" style="font-size: 12px; line-height: 1.5;">
                    ${t.observaciones ? escapeHtml(t.observaciones) : 'Sin notas u observaciones adicionales registradas.'}
                </div>
            </div>
        `;
    },

    renderList() {
        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        const kpis = this.state.kpis || {};
        const variacion = kpis.variacion || 0;
        const cuentas = this.state.cuentasBancarias || [];

        this.element.innerHTML = `
            <div class="dash-layout p-4" id="pagos-list-container" style="max-width: 1200px; margin: 0 auto;">
                
                <!-- TOP BAR DE ALTO IMPACTO -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Pagos Realizados</h2>
                            <span class="badge" style="background-color: #fef2f2; color: #dc2626; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #fecaca;">
                                <i class="bi bi-box-arrow-up-right me-1"></i> Gastos & Salidas
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Control de desembolsos, pagos a proveedores y trazabilidad de compras y gastos.
                        </p>
                    </div>
                    
                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Toggle de Vistas -->
                        <div class="btn-group p-1 bg-light border rounded-3" role="group">
                            <button type="button" class="btn btn-sm ${this.state.view !== 'grafico' ? 'btn-white bg-white shadow-xs fw-bold' : 'btn-light border-0 text-muted'}" id="btn-view-lista" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-table me-1"></i> Lista
                            </button>
                            <button type="button" class="btn btn-sm ${this.state.view === 'grafico' ? 'btn-white bg-white shadow-xs fw-bold text-danger' : 'btn-light border-0 text-muted'}" id="btn-view-grafico" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-bar-chart me-1"></i> Analítica
                            </button>
                        </div>

                        <!-- Botón Exportar Excel -->
                        <button id="btn-export-excel" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 600; font-size: 13px; border-radius: 8px;" title="Descargar en Excel">
                            <i class="bi bi-file-earmark-excel text-success me-1"></i> Exportar
                        </button>

                        <!-- Botón Refrescar -->
                        <button id="btn-refresh-pagos" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>

                        <!-- Botones de Acción -->
                        <button id="btn-nuevo-egreso-agrupado" class="btn btn-light bg-white border text-dark shadow-xs" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-collection me-1 text-primary"></i> Pago Agrupado
                        </button>
                        <button id="btn-nuevo-egreso" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-plus-lg"></i> Registrar Egreso
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Total Egresos Este Mes -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Total Egresos (Mes)</span>
                                <div class="payment-kpi-icon out-bg">
                                    <i class="bi bi-arrow-up-right"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-danger tnum" style="font-size: 22px;">
                                ${formatMoney(kpis.total)}
                            </div>
                            <div class="mt-2 d-flex align-items-center gap-2">
                                <span class="payment-kpi-trend ${variacion <= 0 ? 'positive' : 'negative'}">
                                    <i class="bi ${variacion <= 0 ? 'bi-arrow-down-right' : 'bi-arrow-up-right'}"></i>
                                    ${variacion >= 0 ? '+' : ''}${variacion}%
                                </span>
                                <span class="text-muted" style="font-size: 11px;">vs mes anterior</span>
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Egresos de Hoy -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Egresos de Hoy</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-calendar2-minus"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" style="font-size: 22px;">
                                ${formatMoney(kpis.totalHoy)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <i class="bi bi-clock me-1 text-secondary"></i> Salidas del día en curso
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Pendiente por Conciliar -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #d97706;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Por Conciliar en Banco</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-clock-history"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-warning-emphasis tnum" style="font-size: 22px;">
                                ${formatMoney(kpis.montoPendiente)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <strong>${kpis.conteoPendiente}</strong> pagos sin cruzar con extracto
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Conteo Total del Mes -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Comprobantes del Mes</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-receipt"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" style="font-size: 22px;">
                                ${kpis.transaccionesMes || 0}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Comprobantes de egreso generados
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR DE ANALÍTICA GRÁFICA -->
                <div id="analytics-view-container" style="display: ${this.state.view === 'grafico' ? 'block' : 'none'};"></div>

                <!-- CONTENEDOR DE TABLA DE DATOS -->
                <div id="table-view-container" style="display: ${this.state.view !== 'grafico' ? 'block' : 'none'};">
                    <div class="dash-table-container mb-4 shadow-xs" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                        
                        <!-- FILTROS Y TABS -->
                        <div class="p-3 border-bottom bg-white d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                            <div class="payment-tabs-bar">
                                <button type="button" class="payment-tab-btn ${this.state.selectedTab === 'todos' ? 'active' : ''}" data-tab="todos">
                                    Todos
                                </button>
                                <button type="button" class="payment-tab-btn tab-warning ${this.state.selectedTab === 'pendientes' ? 'active' : ''}" data-tab="pendientes">
                                    <i class="bi bi-clock-history text-warning"></i> Por conciliar
                                    ${kpis.conteoPendiente > 0 ? `<span class="payment-tab-badge">${kpis.conteoPendiente}</span>` : ''}
                                </button>
                                <button type="button" class="payment-tab-btn ${this.state.selectedTab === 'conciliados' ? 'active' : ''}" data-tab="conciliados">
                                    <i class="bi bi-patch-check-fill text-success"></i> Conciliados
                                </button>
                                <button type="button" class="payment-tab-btn ${this.state.selectedTab === 'con_factura' ? 'active' : ''}" data-tab="con_factura">
                                    <i class="bi bi-bag-check text-primary"></i> Compras
                                </button>
                                <button type="button" class="payment-tab-btn ${this.state.selectedTab === 'directos' ? 'active' : ''}" data-tab="directos">
                                    <i class="bi bi-lightning-charge"></i> Gastos directos
                                </button>
                                <button type="button" class="payment-tab-btn ${this.state.selectedTab === 'anulados' ? 'active' : ''}" data-tab="anulados">
                                    Anulados
                                </button>
                            </div>

                            <div class="d-flex align-items-center gap-2 flex-grow-1 flex-lg-grow-0">
                                <div class="ds-search-container" style="min-width: 220px; width: 100%;">
                                    <i class="bi bi-search ds-search-icon"></i>
                                    <input type="text" class="ds-search-input" id="search-pagos" autocomplete="off" placeholder="Buscar proveedor, egreso, compra..." value="${escapeHtml(this.state.searchQuery || '')}">
                                </div>

                                <select class="form-select form-select-sm" id="filter-cuenta-bancaria" style="width: auto; min-width: 150px; font-size: 13px; height: 38px; border-radius: 8px;">
                                    <option value="todas" ${this.state.selectedAccount === 'todas' ? 'selected' : ''}>🏦 Todas las cuentas</option>
                                    ${cuentas.map(c => `
                                        <option value="${escapeHtml(c.nombre)}" ${this.state.selectedAccount.toLowerCase() === c.nombre.toLowerCase() ? 'selected' : ''}>
                                            ${escapeHtml(c.nombre)}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <!-- GRILLA DE EGRESOS -->
                        <div id="grid-container" class="position-relative">
                            <!-- Inyectado por renderGrid -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- SLIDE-OVER DRAWER -->
            <div class="payment-drawer-backdrop" id="payment-drawer-backdrop"></div>
            <div class="payment-drawer" id="payment-drawer">
                <div class="payment-drawer-header">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-receipt-cutoff text-danger fs-5"></i>
                        <h5 class="fw-bold mb-0" style="color: #0f172a; font-size: 16px;">Detalle de Egreso</h5>
                    </div>
                    <div class="d-flex align-items-center gap-1">
                        <button type="button" class="btn btn-sm btn-light border" id="btn-drawer-print" title="Imprimir Comprobante">
                            <i class="bi bi-printer"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-light border" id="btn-drawer-preview" title="Vista Previa Oficial">
                            <i class="bi bi-file-earmark-image"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-light border-0 ms-2 text-muted" id="btn-drawer-close" title="Cerrar panel">
                            <i class="bi bi-x-lg fs-6"></i>
                        </button>
                    </div>
                </div>
                <div class="payment-drawer-body" id="payment-drawer-body"></div>
                <div class="payment-drawer-footer">
                    <button type="button" class="btn btn-light border btn-sm px-3 fw-medium" id="btn-drawer-close-bottom">
                        Cerrar
                    </button>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-outline-danger btn-sm px-3 fw-medium" id="btn-drawer-anular">
                            <i class="bi bi-x-circle me-1"></i> Anular
                        </button>
                        <button type="button" class="btn btn-primary btn-sm px-3 fw-medium" id="btn-drawer-editar">
                            <i class="bi bi-pencil me-1"></i> Editar
                        </button>
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

        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
                <div class="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-white bg-opacity-75" style="z-index: 10; min-height: 250px;">
                    <div class="spinner-border text-danger" role="status"><span class="visually-hidden">Cargando...</span></div>
                </div>
            ` : ''}

            <div class="table-responsive">
                <table class="table table-borderless align-middle mb-0 w-100">
                    <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <tr>
                            <th class="py-3 ps-4 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 140px;">Egreso</th>
                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Proveedor / Tercero</th>
                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Trazabilidad / Compra</th>
                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Cuenta Origen</th>
                            <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Conciliación</th>
                            <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Monto Pagado</th>
                            <th class="py-3 pe-4 text-end text-uppercase text-muted fw-bold" style="width: 100px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                    ${this.state.pagos.length > 0 ? this.state.pagos.map(pago => {
                        let provNombre = pago.cliente;
                        if (!provNombre) {
                            const obs = String(pago.observaciones || '').trim();
                            if (obs.includes(' — ')) {
                                provNombre = obs.split(' — ').pop().trim();
                            } else if (obs.length > 0) {
                                provNombre = obs.length > 40 ? obs.substring(0, 37) + '...' : obs;
                            } else {
                                provNombre = pago.referencia || 'Proveedor General';
                            }
                        }

                        const avatar = getVendorAvatar(provNombre);
                        const isAnulado = pago.estado_transaccion === 'anulado';
                        const isConciliado = !!pago.estado_conciliacion;

                        return `
                        <tr class="payment-row row-pago" data-id="${pago.id}">
                            <!-- Columna 1: Egreso & Fecha -->
                            <td class="py-3 ps-4">
                                <div class="payment-code-badge mb-1" style="border-color: #fecaca; color: #b91c1c;"># ${pago.numero}</div>
                                <div class="text-muted" style="font-size: 11px;">
                                    <i class="bi bi-calendar3 me-1"></i> ${formatFecha(pago.fecha)}
                                </div>
                            </td>

                            <!-- Columna 2: Proveedor -->
                            <td class="py-3">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color};">
                                        ${avatar.initials}
                                    </div>
                                    <div class="text-truncate" style="max-width: 220px;">
                                        <div class="fw-bold text-dark text-truncate" style="font-size: 13px;" title="${escapeHtml(provNombre)}">
                                            ${escapeHtml(provNombre)}
                                        </div>
                                        <div class="text-muted" style="font-size: 11px;">
                                            ${pago.categoria ? escapeHtml(pago.categoria) : 'Gasto operativo'}
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <!-- Columna 3: Compra / Factura -->
                            <td class="py-3">
                                ${pago.factura_id ? `
                                    <a href="#/gastos/compras/ver/${pago.factura_id}" class="payment-invoice-tag" style="background-color: #fef2f2; color: #dc2626; border-color: #fecaca;" onclick="event.stopPropagation()" title="Ver compra asociada">
                                        <i class="bi bi-bag-check"></i> Compra #${pago.factura_numero || pago.factura_id}
                                    </a>
                                ` : `
                                    <span class="badge bg-light text-secondary border fw-medium" style="font-size: 11px;">
                                        <i class="bi bi-lightning-charge me-1"></i> Gasto Directo
                                    </span>
                                `}
                            </td>

                            <!-- Columna 4: Cuenta Bancaria -->
                            <td class="py-3">
                                <span class="payment-bank-tag text-truncate" style="max-width: 170px;" title="${escapeHtml(pago.cuenta_bancaria)}">
                                    <i class="bi bi-bank text-secondary"></i> ${escapeHtml(pago.cuenta_bancaria || 'Caja / Efectivo')}
                                </span>
                            </td>

                            <!-- Columna 5: Conciliación -->
                            <td class="py-3 text-center">
                                ${isAnulado ? `
                                    <span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle rounded-pill fw-medium px-2 py-1">Anulado</span>
                                ` : isConciliado ? `
                                    <span class="payment-reconciled-badge">
                                        <i class="bi bi-patch-check-fill"></i> Conciliado
                                    </span>
                                ` : `
                                    <span class="payment-pending-badge">
                                        <i class="bi bi-clock-history"></i> Por conciliar
                                    </span>
                                `}
                            </td>

                            <!-- Columna 6: Monto Pagado -->
                            <td class="py-3 text-end">
                                <div class="fw-bold tnum ${isAnulado ? 'text-muted text-decoration-line-through opacity-50' : 'text-danger'}" style="font-size: 14px;">
                                    -${formatMoney(pago.monto)}
                                </div>
                            </td>

                            <!-- Columna 7: Acciones Rápidas -->
                            <td class="py-3 pe-4 text-end">
                                <div class="payment-row-actions">
                                    <button class="btn btn-sm btn-light border-0 p-1 btn-quick-preview" data-id="${pago.id}" title="Ver Comprobante">
                                        <i class="bi bi-eye text-danger"></i>
                                    </button>
                                    <button class="btn btn-sm btn-light border-0 p-1 btn-quick-print" data-id="${pago.id}" title="Imprimir">
                                        <i class="bi bi-printer text-secondary"></i>
                                    </button>
                                    <button class="btn btn-sm btn-link text-muted p-1 border-0 btn-menu-row" data-id="${pago.id}" data-conciliado="${isConciliado}"
                                        data-factura="${pago.factura_id || ''}" data-anulado="${isAnulado}">
                                        <i class="bi bi-three-dots-vertical"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('') : `
                        <tr>
                            <td colspan="7" class="text-center text-muted py-5">
                                <div class="mb-3"><i class="bi bi-inbox fs-1 text-secondary opacity-50"></i></div>
                                <h6 class="fw-semibold text-dark">No se encontraron pagos realizados</h6>
                                <p class="text-muted mb-0" style="font-size: 13px;">Prueba ajustando los filtros de búsqueda o cambia de pestaña.</p>
                            </td>
                        </tr>
                    `}
                    </tbody>
                </table>
            </div>

            <!-- PAGINADOR -->
            <div class="card-footer bg-white border-top p-3 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2" style="border-radius: 0 0 12px 12px;">
                <div class="d-flex align-items-center gap-3" style="font-size: 13px; color: var(--text-body);">
                    <div class="d-flex align-items-center gap-2">
                        <span>Mostrar:</span>
                        <select class="form-select form-select-sm text-muted" id="select-limit" style="width: 70px;">
                            <option value="10" ${this.state.itemsPerPage===10?'selected':''}>10</option>
                            <option value="20" ${this.state.itemsPerPage===20?'selected':''}>20</option>
                            <option value="50" ${this.state.itemsPerPage===50?'selected':''}>50</option>
                        </select>
                    </div>
                    <span class="text-muted border-start ps-3" id="showing-count">
                        ${this.state.totalItems > 0 ? `<strong>${startItem} - ${endItem}</strong> de <strong>${this.state.totalItems}</strong> egresos` : '0 egresos'}
                    </span>
                </div>

                <div class="d-flex align-items-center gap-2" style="font-size: 13px;">
                    <button class="btn btn-sm btn-light border" id="btn-prev" ${this.state.currentPage <= 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left me-1"></i> Anterior
                    </button>
                    <span class="px-2 text-muted">
                        Página <strong>${this.state.currentPage}</strong> de <strong>${totalPages}</strong>
                    </span>
                    <button class="btn btn-sm btn-light border" id="btn-next" ${this.state.currentPage >= totalPages ? 'disabled' : ''}>
                        Siguiente <i class="bi bi-chevron-right ms-1"></i>
                    </button>
                </div>
            </div>
        `;

        gridContainer.innerHTML = tableHtml;
        this.bindDynamicEvents(gridContainer);
    },

    renderAnalyticsView(container, data) {
        if (!container || !data) return;

        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        container.innerHTML = `
            <div class="row g-3 mb-4">
                <!-- Gráfico de Egresos Diarios -->
                <div class="col-12 col-lg-8">
                    <div class="payment-kpi-card h-100 p-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h6 class="fw-bold mb-0 text-dark">Evolución de Egresos Diarios (Últimos 30 días)</h6>
                                <span class="text-muted" style="font-size: 12px;">Comportamiento de salida de dinero por fecha</span>
                            </div>
                            <span class="badge bg-light text-danger border px-2 py-1" style="font-size: 11px;">
                                <i class="bi bi-graph-down me-1"></i> Salidas
                            </span>
                        </div>
                        <div style="height: 260px; position: relative;">
                            <canvas id="egresosDailyChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Gráfico de Cuentas Emisoras -->
                <div class="col-12 col-lg-4">
                    <div class="payment-kpi-card h-100 p-4">
                        <div class="mb-3">
                            <h6 class="fw-bold mb-0 text-dark">Distribución por Cuenta Emisora</h6>
                            <span class="text-muted" style="font-size: 12px;">Participación según cuenta de origen</span>
                        </div>
                        <div style="height: 180px; position: relative;" class="d-flex justify-content-center">
                            <canvas id="egresosAccountChart"></canvas>
                        </div>
                        <div class="mt-3 border-top pt-2" style="font-size: 12px;">
                            ${data.accountLabels.slice(0, 3).map((lbl, idx) => `
                                <div class="d-flex justify-content-between align-items-center py-1">
                                    <span class="text-muted text-truncate" style="max-width: 150px;">${escapeHtml(lbl)}</span>
                                    <span class="fw-bold text-dark tnum">${formatMoney(data.accountValues[idx])}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Ranking Top 5 Proveedores -->
                <div class="col-12">
                    <div class="payment-kpi-card p-4">
                        <h6 class="fw-bold mb-1 text-dark">Top 5 Proveedores por Desembolso (Últimos 30 días)</h6>
                        <span class="text-muted d-block mb-3" style="font-size: 12px;">Destinatarios con mayor volumen de pago</span>
                        
                        <div class="row g-2">
                            ${data.topVendors.length > 0 ? data.topVendors.map((c, i) => `
                                <div class="col-12 col-sm-6 col-md-4 col-lg">
                                    <div class="p-3 bg-light rounded-3 border d-flex flex-column justify-content-between h-100">
                                        <div class="d-flex align-items-center gap-2 mb-2">
                                            <span class="badge bg-danger text-white rounded-circle" style="width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px;">${i + 1}</span>
                                            <span class="fw-bold text-dark text-truncate" style="font-size: 12px;" title="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</span>
                                        </div>
                                        <div class="fw-bold text-danger tnum" style="font-size: 14px;">${formatMoney(c.total)}</div>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-muted p-2">Sin datos en el período.</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const initCharts = () => {
            if (typeof Chart === 'undefined') return;

            const ctxDaily = document.getElementById('egresosDailyChart');
            if (ctxDaily) {
                if (window.myEgresosDailyChart) window.myEgresosDailyChart.destroy();
                window.myEgresosDailyChart = new Chart(ctxDaily, {
                    type: 'bar',
                    data: {
                        labels: data.dailyLabels.map(l => l.substring(5)),
                        datasets: [{
                            label: 'Egresos ($)',
                            data: data.dailyValues,
                            backgroundColor: '#ef4444',
                            borderRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { grid: { display: false } },
                            y: {
                                ticks: {
                                    callback: v => '$' + (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : (v / 1000).toFixed(0) + 'k')
                                }
                            }
                        }
                    }
                });
            }

            const ctxAccount = document.getElementById('egresosAccountChart');
            if (ctxAccount) {
                if (window.myEgresosAccountChart) window.myEgresosAccountChart.destroy();
                window.myEgresosAccountChart = new Chart(ctxAccount, {
                    type: 'doughnut',
                    data: {
                        labels: data.accountLabels,
                        datasets: [{
                            data: data.accountValues,
                            backgroundColor: ['#dc2626', '#f59e0b', '#2563eb', '#8b5cf6', '#06b6d4', '#64748b']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        cutout: '65%'
                    }
                });
            }
        };

        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = initCharts;
            document.head.appendChild(script);
        } else {
            setTimeout(initCharts, 50);
        }
    }
};
