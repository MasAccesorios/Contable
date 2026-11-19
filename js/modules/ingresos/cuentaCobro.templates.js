import { escapeHtml, getClientAvatar as baseGetClientAvatar } from '../../shared/formatters.js';

export function getClientAvatar(name) {
    const clean = String(name || '').trim();
    const lower = clean.toLowerCase();
    if (!clean || lower === '-' || lower === 'sin cliente' || lower === 'sin proveedor' || lower === 'desconocido' || lower === 'general / sin tercero') {
        return { initials: '?', bg: '#f1f5f9', color: '#64748b' };
    }
    return baseGetClientAvatar(clean);
}

export { escapeHtml };

export const CuentaCobroTemplates = {
    escapeHtml,
    getClientAvatar,

    formatMoney(val) {
        if (val === null || val === undefined || val === '') return '$ 0';
        const num = parseFloat(val);
        if (isNaN(num)) return '$ 0';
        return '$ ' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    },

    formatFecha(str) {
        if (!str || str === '---' || str === 'N/A') return '---';
        const raw = String(str).split('T')[0];
        const partes = raw.split('-');
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : escapeHtml(raw);
    },

    getEstadoBadge(doc) {
        if (!doc) return '';
        const estado = doc.estado;

        if (estado === 'anulada') {
            return `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 10px;">
                <i class="bi bi-x-circle me-1"></i>Anulada
            </span>`;
        }

        if (estado === 'cobrada') {
            return `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 10px;">
                <i class="bi bi-check2-circle me-1"></i>Cobrada
            </span>`;
        }

        if (estado === 'vencida') {
            const diasText = doc.diasVencida > 0 ? ` (${doc.diasVencida} d)` : '';
            return `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 10px;">
                <i class="bi bi-exclamation-triangle me-1"></i>Vencida${diasText}
            </span>`;
        }

        return `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 10px;">
            <i class="bi bi-clock-history me-1"></i>Pendiente
        </span>`;
    },

    renderLayout() {
        const kpis = this.state?.kpis || {
            totalEmitido: 0,
            totalCobrado: 0,
            totalPendiente: 0,
            totalVencido: 0,
            conteoTotal: 0,
            conteoCobradas: 0,
            conteoPendientes: 0,
            conteoVencidas: 0,
            conteoAnuladas: 0
        };

        const tabCounts = this.calcularTabCounts ? this.calcularTabCounts(this.state?.cuentas || []) : {
            todas: kpis.conteoTotal || 0,
            pendientes: kpis.conteoPendientes || 0,
            vencidas: kpis.conteoVencidas || 0,
            cobradas: kpis.conteoCobradas || 0,
            anuladas: kpis.conteoAnuladas || 0
        };

        const activeTab = this.state?.selectedTab || 'todas';

        return `
            <div class="dash-layout p-4" style="max-width: 1300px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                
                <!-- BREADCRUMB & HEADER -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div style="font-size: var(--fs-sm);" class="text-muted">
                        <span>Ingresos</span> &gt; <span class="text-dark fw-bold">Cuentas de Cobro</span>
                    </div>
                    <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1 fw-semibold" style="font-size: 11px;">
                        <i class="bi bi-receipt-cutoff me-1"></i> Módulo de Cobranza & Cartera
                    </span>
                </div>

                <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
                    <div>
                        <h2 class="page-title mb-1 fw-bold text-dark" style="font-size: 24px; letter-spacing: -0.5px;">Cuentas de Cobro</h2>
                        <p class="text-muted mb-0" style="font-size: 13px;">
                            Control de cuentas de cobro emitidas, cartera vencida y registro de cobros.
                        </p>
                    </div>
                    
                    <div class="d-flex align-items-center gap-2">
                        <button id="btn-refresh-cc" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                        <a href="#/ingresos/cuenta-cobro/nueva" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-plus-lg"></i> Nueva Cuenta de Cobro
                        </a>
                    </div>
                </div>

                <!-- 4 KPI CARDS EJECUTIVAS -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Total Emitido -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #2563eb;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Total Emitido</span>
                                <div class="payment-kpi-icon total-bg">
                                    <i class="bi bi-receipt"></i>
                                </div>
                            </div>
                            <div class="kpi-value text-dark fw-bold" style="font-size: 22px;">
                                ${this.formatMoney(kpis.totalEmitido)}
                            </div>
                            <div class="text-muted" style="font-size: 12px;">
                                ${kpis.conteoTotal} cuenta(s) en total
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Total Cobrado -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #059669;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Total Cobrado</span>
                                <div class="payment-kpi-icon success-bg">
                                    <i class="bi bi-check-circle"></i>
                                </div>
                            </div>
                            <div class="kpi-value text-success fw-bold" style="font-size: 22px;">
                                ${this.formatMoney(kpis.totalCobrado)}
                            </div>
                            <div class="text-muted" style="font-size: 12px;">
                                ${kpis.conteoCobradas} cuenta(s) saldada(s)
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Cartera Vigente Pendiente -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #d97706;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Saldo Pendiente</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-clock-history"></i>
                                </div>
                            </div>
                            <div class="kpi-value text-warning-emphasis fw-bold" style="font-size: 22px;">
                                ${this.formatMoney(kpis.totalPendiente)}
                            </div>
                            <div class="text-muted" style="font-size: 12px;">
                                ${kpis.conteoPendientes} vigente(s) por recaudar
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Cartera Vencida -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #dc2626;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Cartera Vencida</span>
                                <div class="payment-kpi-icon warning-bg" style="background-color: #fef2f2; color: #dc2626;">
                                    <i class="bi bi-exclamation-octagon"></i>
                                </div>
                            </div>
                            <div class="kpi-value text-danger fw-bold" style="font-size: 22px;">
                                ${this.formatMoney(kpis.totalVencido)}
                            </div>
                            <div class="text-muted" style="font-size: 12px;">
                                ${kpis.conteoVencidas} cuenta(s) en mora
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTROLES: SEGMENTED TABS Y BARRA DE BÚSQUEDA -->
                <div class="card border-0 shadow-sm mb-4" style="border-radius: 12px;">
                    <div class="card-body p-3">
                        <div class="row g-3 align-items-center">
                            
                            <!-- Segmented Control Tabs -->
                            <div class="col-12 col-lg-8">
                                <div class="payment-segmented-control d-flex flex-wrap gap-1">
                                    <button class="payment-tab-btn ${activeTab === 'todas' ? 'active' : ''}" data-tab="todas">
                                        Todas <span class="tab-counter ms-1">${tabCounts.todas}</span>
                                    </button>
                                    <button class="payment-tab-btn ${activeTab === 'pendientes' ? 'active' : ''}" data-tab="pendientes">
                                        Pendientes <span class="tab-counter ms-1">${tabCounts.pendientes}</span>
                                    </button>
                                    <button class="payment-tab-btn ${activeTab === 'vencidas' ? 'active' : ''}" data-tab="vencidas">
                                        Vencidas <span class="tab-counter ms-1 text-danger">${tabCounts.vencidas}</span>
                                    </button>
                                    <button class="payment-tab-btn ${activeTab === 'cobradas' ? 'active' : ''}" data-tab="cobradas">
                                        Cobradas <span class="tab-counter ms-1">${tabCounts.cobradas}</span>
                                    </button>
                                    <button class="payment-tab-btn ${activeTab === 'anuladas' ? 'active' : ''}" data-tab="anuladas">
                                        Anuladas <span class="tab-counter ms-1">${tabCounts.anuladas}</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Search Input -->
                            <div class="col-12 col-lg-4">
                                <div class="input-group">
                                    <span class="input-group-text bg-light border-end-0 text-muted" style="border-radius: 8px 0 0 8px;">
                                        <i class="bi bi-search"></i>
                                    </span>
                                    <input type="text" id="search-cc" class="form-control bg-light border-start-0" 
                                           placeholder="Buscar por cliente, NIT, No. o ítem..." 
                                           value="${escapeHtml(this.state?.searchQuery || '')}"
                                           style="border-radius: 0 8px 8px 0; font-size: 13px;">
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR DE LA TABLA DINÁMICA -->
                <div id="cc-grid-container">
                    ${this.renderGrid()}
                </div>

                <!-- OFFCANVAS SLIDE-OVER DRAWER DETALLE -->
                <div id="cc-drawer-backdrop" class="modal-backdrop fade" style="display: none; z-index: 1040;"></div>
                <div id="cc-drawer" class="offcanvas offcanvas-end shadow-lg" tabindex="-1" style="width: 520px; z-index: 1045; visibility: hidden; transition: transform 0.3s ease-in-out;">
                    <div class="offcanvas-header border-bottom py-3 px-4 bg-light">
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded">
                                <i class="bi bi-receipt-cutoff me-1"></i> Detalle
                            </span>
                            <h5 class="offcanvas-title fw-bold text-dark mb-0" id="cc-drawer-title" style="font-size: 16px;">
                                Cuenta de Cobro
                            </h5>
                        </div>
                        <button type="button" class="btn-close text-reset" id="btn-cc-drawer-close" aria-label="Close"></button>
                    </div>
                    <div class="offcanvas-body p-4" id="cc-drawer-body" style="overflow-y: auto;">
                        <!-- Se inyecta dinámicamente con renderDrawerContent -->
                    </div>
                    <div class="offcanvas-footer border-top p-3 bg-light d-flex justify-content-between align-items-center" id="cc-drawer-footer">
                        <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-cc-drawer-close-bottom">
                            Cerrar
                        </button>
                        <div class="d-flex gap-2" id="cc-drawer-actions">
                            <!-- Acciones dinámicas: Imprimir, Editar, Anular -->
                        </div>
                    </div>
                </div>

            </div>
        `;
    },

    renderGrid() {
        const items = this.state?.cuentasFiltradas || [];
        const totalItems = this.state?.totalItems || 0;
        const currentPage = this.state?.currentPage || 1;
        const totalPages = this.state?.totalPages || 1;

        if (items.length === 0) {
            return `
                <div class="card border-0 shadow-sm p-5 text-center" style="border-radius: 12px;">
                    <div class="mb-3">
                        <i class="bi bi-inbox text-muted" style="font-size: 48px;"></i>
                    </div>
                    <h5 class="fw-bold text-dark mb-1">No se encontraron cuentas de cobro</h5>
                    <p class="text-muted mb-3" style="font-size: 13px;">
                        No hay registros que coincidan con los criterios de búsqueda o pestaña seleccionada.
                    </p>
                    <div>
                        <a href="#/ingresos/cuenta-cobro/nueva" class="btn btn-sm btn-primary-action px-3">
                            <i class="bi bi-plus-lg me-1"></i>Crear primera cuenta de cobro
                        </a>
                    </div>
                </div>
            `;
        }

        const rowsHtml = items.map(c => {
            const avatar = this.getClientAvatar(c.cliente_razon_social);
            const badge = this.getEstadoBadge(c);
            const numDisplay = escapeHtml(String(c.numero || c.id));

            return `
                <tr class="row-cuenta-cobro align-middle" data-id="${c.id}" style="cursor: pointer; border-bottom: 1px solid var(--border-color);">
                    <!-- Número -->
                    <td style="padding: 14px 16px;">
                        <div class="fw-bold text-primary" style="font-size: 13px;">
                            No. ${numDisplay}
                        </div>
                        <div class="text-muted" style="font-size: 11px;">
                            ${escapeHtml(c.medio_pago || 'Medio no definido')}
                        </div>
                    </td>

                    <!-- Fechas -->
                    <td style="padding: 14px 16px;">
                        <div class="text-dark fw-medium" style="font-size: 13px;">
                            ${this.formatFecha(c.fecha)}
                        </div>
                        <div class="text-muted" style="font-size: 11px;" title="Vencimiento">
                            Vence: ${this.formatFecha(c.fecha_vencimiento || c.fecha)}
                        </div>
                    </td>

                    <!-- Cliente -->
                    <td style="padding: 14px 16px;">
                        <div class="d-flex align-items-center gap-2">
                            <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0" 
                                 style="width: 32px; height: 32px; font-size: 11px; background-color: ${avatar.bg}; color: ${avatar.color};">
                                ${escapeHtml(avatar.initials)}
                            </div>
                            <div style="min-width: 0;">
                                <div class="fw-semibold text-dark text-truncate" style="font-size: 13px; max-width: 220px;" title="${escapeHtml(c.cliente_razon_social || '')}">
                                    ${escapeHtml(c.cliente_razon_social || 'Sin cliente')}
                                </div>
                                <div class="text-muted" style="font-size: 11px;">
                                    ${escapeHtml(c.cliente_nit ? 'NIT ' + c.cliente_nit : 'Sin NIT')}
                                </div>
                            </div>
                        </div>
                    </td>

                    <!-- Forma de Pago -->
                    <td style="padding: 14px 16px; font-size: 13px;">
                        <span class="badge ${c.forma_pago === 'Contado' ? 'bg-light text-dark border' : 'bg-info-subtle text-info-emphasis border border-info-subtle'} rounded-pill px-2 py-1" style="font-size: 11px;">
                            ${escapeHtml(c.forma_pago || 'Contado')}
                        </span>
                    </td>

                    <!-- Total -->
                    <td style="padding: 14px 16px; text-align: right;">
                        <div class="fw-bold text-dark" style="font-size: 13px;">
                            ${this.formatMoney(c.total)}
                        </div>
                        <div class="text-muted" style="font-size: 11px;">
                            Saldo: ${this.formatMoney(c.saldo)}
                        </div>
                    </td>

                    <!-- Estado -->
                    <td style="padding: 14px 16px; text-align: center;">
                        ${badge}
                    </td>

                    <!-- Acciones -->
                    <td style="padding: 14px 16px; text-align: right;">
                        <div class="d-flex justify-content-end gap-1">
                            <button class="btn btn-sm btn-light border btn-drawer-row shadow-xs" data-id="${c.id}" title="Ver Comprobante">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-light border btn-imprimir-row shadow-xs" data-id="${c.id}" title="Imprimir Comprobante">
                                <i class="bi bi-printer"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-eliminar-row shadow-xs" data-id="${c.id}" title="Eliminar cuenta de cobro">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="dash-table-container shadow-sm mb-3" style="border-radius: 12px; overflow: hidden; background: #fff;">
                <div class="table-responsive">
                    <table class="table table-hover mb-0" style="width: 100%; border-collapse: collapse;">
                        <thead style="background-color: var(--bg-main, #f8fafc);">
                            <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                                <th style="padding: 12px 16px; font-weight: 600;">Número</th>
                                <th style="padding: 12px 16px; font-weight: 600;">Emisión / Venc.</th>
                                <th style="padding: 12px 16px; font-weight: 600;">Cliente</th>
                                <th style="padding: 12px 16px; font-weight: 600;">Forma de Pago</th>
                                <th style="padding: 12px 16px; text-align: right; font-weight: 600;">Total / Saldo</th>
                                <th style="padding: 12px 16px; text-align: center; font-weight: 600;">Estado</th>
                                <th style="padding: 12px 16px; text-align: right; font-weight: 600;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>

                <!-- Paginación -->
                ${totalPages > 1 ? `
                <div class="p-3 border-top d-flex justify-content-between align-items-center bg-light">
                    <div class="text-muted" style="font-size: 12px;">
                        Mostrando página <b>${currentPage}</b> de <b>${totalPages}</b> (${totalItems} registros)
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-light border btn-page-prev" ${currentPage <= 1 ? 'disabled' : ''}>
                            <i class="bi bi-chevron-left me-1"></i>Anterior
                        </button>
                        <button class="btn btn-light border btn-page-next" ${currentPage >= totalPages ? 'disabled' : ''}>
                            Siguiente<i class="bi bi-chevron-right ms-1"></i>
                        </button>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    },

    renderDrawerContent(doc) {
        if (!doc) return '<div class="p-4 text-center text-muted">No se pudo cargar la información.</div>';

        const avatar = this.getClientAvatar(doc.cliente_razon_social);
        const badge = this.getEstadoBadge(doc);
        const items = doc.detalles || [];

        const itemsHtml = items.map((it, idx) => `
            <tr style="border-bottom: 1px solid #f1f5f9; font-size: 12px;">
                <td style="padding: 8px 10px;">
                    <div class="fw-semibold text-dark">${escapeHtml(it.nombre || 'Ítem sin nombre')}</div>
                    ${it.descripcion_personalizada ? `<div class="text-muted" style="font-size: 11px;">${escapeHtml(it.descripcion_personalizada)}</div>` : ''}
                    ${it.sku ? `<div class="text-muted" style="font-size: 10px;">SKU: ${escapeHtml(it.sku)}</div>` : ''}
                </td>
                <td style="padding: 8px 10px; text-align: center;">${escapeHtml(String(it.cantidad || 1))}</td>
                <td style="padding: 8px 10px; text-align: right;">${this.formatMoney(it.precio_unitario)}</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 600;">${this.formatMoney(it.total)}</td>
            </tr>
        `).join('');

        const cleanPhone = String(doc.cliente_telefono || '').replace(/\D/g, '');
        const fullPhone = cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone;
        const waMsg = `Hola ${doc.cliente_razon_social || ''}, te compartimos el comprobante de la Cuenta de Cobro No. ${doc.numero || doc.id} por valor de ${this.formatMoney(doc.total)}.`;
        const waUrl = cleanPhone.length >= 7 ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(waMsg)}` : null;

        return `
            <div class="drawer-detail-view">
                
                <!-- Encabezado Comprobante -->
                <div class="d-flex justify-content-between align-items-start mb-3 pb-3 border-bottom">
                    <div>
                        <span class="text-muted text-uppercase fw-semibold" style="font-size: 11px; letter-spacing: 0.5px;">Comprobante</span>
                        <h4 class="fw-bold text-dark mb-0">Cuenta de Cobro No. ${escapeHtml(String(doc.numero || doc.id))}</h4>
                        <div class="text-muted" style="font-size: 12px;">Fecha: ${this.formatFecha(doc.fecha)}</div>
                    </div>
                    <div>
                        ${badge}
                    </div>
                </div>

                <!-- Tarjeta Cliente -->
                <div class="card bg-light border-0 p-3 mb-3" style="border-radius: 8px;">
                    <div class="d-flex align-items-center gap-3">
                        <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold" 
                             style="width: 40px; height: 40px; font-size: 14px; background-color: ${avatar.bg}; color: ${avatar.color};">
                            ${escapeHtml(avatar.initials)}
                        </div>
                        <div style="flex-grow: 1;">
                            <div class="fw-bold text-dark" style="font-size: 14px;">${escapeHtml(doc.cliente_razon_social || 'Sin cliente')}</div>
                            <div class="text-muted" style="font-size: 12px;">NIT / CC: ${escapeHtml(doc.cliente_nit || 'N/A')}</div>
                            ${doc.cliente_telefono ? `<div class="text-muted" style="font-size: 11px;"><i class="bi bi-telephone me-1"></i>${escapeHtml(doc.cliente_telefono)}</div>` : ''}
                            ${doc.cliente_email ? `<div class="text-muted" style="font-size: 11px;"><i class="bi bi-envelope me-1"></i>${escapeHtml(doc.cliente_email)}</div>` : ''}
                            ${waUrl ? `
                                <div class="mt-2">
                                    <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-success py-1 px-2 fw-medium shadow-xs" style="font-size: 11px; border-radius: 6px;">
                                        <i class="bi bi-whatsapp me-1"></i>Enviar por WhatsApp
                                    </a>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Parámetros de Pago -->
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <div class="border p-2 rounded bg-white">
                            <span class="text-muted d-block" style="font-size: 10px; text-transform: uppercase;">Forma de Pago</span>
                            <span class="fw-semibold text-dark" style="font-size: 12px;">${escapeHtml(doc.forma_pago || 'Contado')}</span>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="border p-2 rounded bg-white">
                            <span class="text-muted d-block" style="font-size: 10px; text-transform: uppercase;">Vencimiento</span>
                            <span class="fw-semibold text-dark" style="font-size: 12px;">${this.formatFecha(doc.fecha_vencimiento || doc.fecha)}</span>
                        </div>
                    </div>
                </div>

                <!-- Tabla de Productos / Servicios -->
                <div class="mb-3">
                    <h6 class="fw-bold text-dark mb-2" style="font-size: 13px;">Conceptos y Servicios</h6>
                    <div class="border rounded bg-white table-responsive">
                        <table class="table table-sm mb-0">
                            <thead class="bg-light">
                                <tr style="font-size: 11px; text-transform: uppercase;">
                                    <th style="padding: 6px 10px;">Ítem</th>
                                    <th style="padding: 6px 10px; text-align: center;">Cant.</th>
                                    <th style="padding: 6px 10px; text-align: right;">Precio</th>
                                    <th style="padding: 6px 10px; text-align: right;">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml || '<tr><td colspan="4" class="text-center py-2 text-muted">Sin ítems</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Liquidación Financiera -->
                <div class="card border-0 bg-light p-3" style="border-radius: 8px;">
                    <div class="d-flex justify-content-between mb-1" style="font-size: 12px;">
                        <span class="text-muted">Subtotal:</span>
                        <span class="fw-medium">${this.formatMoney(doc.subtotal)}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-2 pb-2 border-bottom" style="font-size: 12px;">
                        <span class="text-muted">Impuestos:</span>
                        <span class="fw-medium">${this.formatMoney(doc.impuestos)}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold text-dark">Total:</span>
                        <span class="fw-bold text-primary fs-5">${this.formatMoney(doc.total)}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center" style="font-size: 12px;">
                        <span class="text-muted">Saldo Pendiente:</span>
                        <span class="fw-bold ${doc.isAnulada ? 'text-muted' : (doc.saldo > 0 ? 'text-danger' : 'text-success')}">${this.formatMoney(doc.saldo)}</span>
                    </div>
                </div>

            </div>
        `;
    }
};
