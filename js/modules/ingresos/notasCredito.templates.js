import { escapeHtml } from '../../shared/formatters.js';

export function getClientAvatar(name) {
    if (!name || name === 'Sin cliente' || name === 'Desconocido') {
        return { initials: '?', bg: '#f1f5f9', color: '#64748b' };
    }
    const clean = name.trim();
    const parts = clean.split(/\s+/);
    let initials = parts[0][0] || '';
    if (parts.length > 1 && parts[1][0]) initials += parts[1][0];
    initials = initials.toUpperCase();
    
    const colors = [
        { bg: '#eff6ff', color: '#1d4ed8' },
        { bg: '#ecfdf5', color: '#059669' },
        { bg: '#fef3c7', color: '#d97706' },
        { bg: '#f3e8ff', color: '#7e22ce' },
        { bg: '#fce7f3', color: '#be185d' },
        { bg: '#e0f2fe', color: '#0369a1' },
        { bg: '#ccfbf1', color: '#0f766e' }
    ];
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % colors.length;
    return { initials: initials.substring(0, 2), ...colors[index] };
}

export const NotasCreditoTemplates = {
    formatMoney(val) {
        return '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    },

    formatFecha(str) {
        if (!str || str === '---' || str === 'N/A') return '---';
        const raw = String(str).split('T')[0];
        const partes = raw.split('-');
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : raw;
    },

    getEstadoBadge(estadoReal) {
        if (estadoReal === 'anulada') {
            return `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;">
                <i class="bi bi-x-circle me-1"></i> Anulada
            </span>`;
        }
        if (estadoReal === 'saldo_favor') {
            return `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;">
                <i class="bi bi-clock-history me-1"></i> Saldo a favor
            </span>`;
        }
        return `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;">
            <i class="bi bi-check2-all me-1"></i> Aplicada
        </span>`;
    },

    renderLayout() {
        const kpis = this.state.kpis || {};

        return `
            <div class="dash-layout p-4" style="max-width: 1200px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                
                <!-- BREADCRUMB -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div style="font-size: var(--fs-sm);" class="text-muted">
                        <span>Ingresos</span> &gt; <span class="text-dark fw-bold">Notas de Crédito</span>
                    </div>
                    <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1 fw-semibold" style="font-size: 11px;">
                        <i class="bi bi-arrow-counterclockwise me-1"></i> Devoluciones & Saldos a Favor
                    </span>
                </div>

                <!-- TÍTULO SUPERIOR Y CONTROLES -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
                    <div>
                        <h2 class="page-title mb-1 fw-bold text-dark" style="font-size: 24px; letter-spacing: -0.5px;">Notas de Crédito</h2>
                        <p class="text-muted mb-0" style="font-size: 13px;">
                            Gestiona devoluciones de inventario y saldos a favor pendientes de cruce en facturas.
                        </p>
                    </div>
                    
                    <div class="d-flex align-items-center gap-2">
                        <button id="btn-refresh-nc" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                        <button class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;" onclick="window.location.hash='#/ingresos/notas-credito/nueva'">
                            <i class="bi bi-plus-lg"></i> Nueva Nota
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS EJECUTIVAS -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Saldo a Favor Pendiente -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #d97706;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Saldo a Favor Disponible</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-clock-history"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-warning-emphasis tnum" style="font-size: 22px;">
                                ${this.formatMoney(kpis.saldoFavorPendiente)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <span class="fw-semibold text-dark">${kpis.conteoSaldoFavor || 0}</span> notas pendientes de cruzar
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Notas Aplicadas -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Notas Aplicadas</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-check2-all"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" style="font-size: 22px;">
                                ${this.formatMoney(kpis.totalAplicadasMes > 0 ? kpis.totalAplicadasMes : kpis.totalAplicadoHistorico)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <span class="fw-semibold text-success">${kpis.conteoAplicadas || 0}</span> amortizadas en facturas
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Total Devoluciones Emitidas -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Total Devoluciones</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-arrow-counterclockwise"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" style="font-size: 22px;">
                                ${this.formatMoney(kpis.totalEmitidoMes)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <span class="fw-semibold text-primary">${kpis.conteoTotal || 0}</span> notas emitidas
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Clientes con Saldo a Favor -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Clientes con Saldo</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-people"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" style="font-size: 22px;">
                                ${kpis.clientesConSaldo || 0} <span style="font-size: 14px; font-weight: normal; color: #64748b;">terceros</span>
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Crédito a favor listo para aplicar
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR DE LA TABLA Y FILTROS -->
                <div class="dash-table-container shadow-xs mb-4" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                    
                    <!-- BARRA DE FILTROS SUPERIOR: SEGMENTED TABS + BUSCADOR -->
                    <div class="p-3 border-bottom bg-white d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                        
                        <!-- Segmented Control de Tabs -->
                        <div class="payment-tabs-bar">
                            <button type="button" class="payment-tab-btn ${this.state.selectedTab === 'todas' ? 'active' : ''}" data-tab="todas">
                                Todas
                                <span class="payment-tab-badge">${kpis.conteoTotal || 0}</span>
                            </button>
                            <button type="button" class="payment-tab-btn tab-warning ${this.state.selectedTab === 'saldo_favor' ? 'active' : ''}" data-tab="saldo_favor">
                                <i class="bi bi-clock-history text-warning"></i> Con saldo a favor
                                <span class="payment-tab-badge">${kpis.conteoSaldoFavor || 0}</span>
                            </button>
                            <button type="button" class="payment-tab-btn ${this.state.selectedTab === 'aplicadas' ? 'active' : ''}" data-tab="aplicadas">
                                <i class="bi bi-patch-check-fill text-success"></i> Aplicadas
                                <span class="payment-tab-badge">${kpis.conteoAplicadas || 0}</span>
                            </button>
                            <button type="button" class="payment-tab-btn ${this.state.selectedTab === 'anuladas' ? 'active' : ''}" data-tab="anuladas">
                                <i class="bi bi-x-circle text-muted"></i> Anuladas
                                <span class="payment-tab-badge">${kpis.conteoAnuladas || 0}</span>
                            </button>
                        </div>

                        <!-- Buscador Universal -->
                        <div class="ds-search-container" style="min-width: 250px; width: 100%; max-width: 320px;">
                            <i class="bi bi-search ds-search-icon"></i>
                            <input type="text" class="ds-search-input" id="search-nc" autocomplete="off" placeholder="Buscar por número, cliente, NIT o factura..." value="${escapeHtml(this.state.searchQuery || '')}">
                        </div>
                    </div>

                    <!-- GRILLA DE DATOS -->
                    <div id="nc-grid-container" class="position-relative">
                        <!-- Inyectado por render -->
                    </div>
                </div>
            </div>

            <!-- SLIDE-OVER DRAWER DE NOTA DE CRÉDITO -->
            <div class="payment-drawer-backdrop" id="nc-drawer-backdrop"></div>
            <div class="payment-drawer" id="nc-drawer">
                <div class="payment-drawer-header d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-arrow-counterclockwise text-primary fs-5"></i>
                        <h5 class="fw-bold mb-0" style="color: #0f172a; font-size: 16px;">Detalle de Nota de Crédito</h5>
                    </div>
                    <div class="d-flex align-items-center gap-1">
                        <button type="button" class="btn btn-sm btn-light border-0 text-muted" id="btn-nc-drawer-close" title="Cerrar panel">
                            <i class="bi bi-x-lg fs-6"></i>
                        </button>
                    </div>
                </div>
                
                <div class="payment-drawer-body" id="nc-drawer-body">
                    <!-- Contenido dinámico del drawer inyectado por mostrarDrawer -->
                </div>
                
                <div class="payment-drawer-footer d-flex justify-content-between align-items-center">
                    <button type="button" class="btn btn-light border btn-sm px-3 fw-medium" id="btn-nc-drawer-close-bottom">
                        Cerrar
                    </button>
                    <div class="d-flex gap-2" id="nc-drawer-action-buttons">
                        <!-- Botones de acción dinámicos -->
                    </div>
                </div>
            </div>
        `;
    },

    renderGrid() {
        const notas = this.state.notasFiltradas || [];
        const { currentPage, itemsPerPage, totalItems, isLoading } = this.state;

        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);
        const pageItems = notas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

        return `
            ${isLoading ? `
                <div class="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-white bg-opacity-75" style="z-index: 10; min-height: 250px;">
                    <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>
                </div>
            ` : ''}

            <div class="table-responsive">
                <table class="table table-borderless align-middle mb-0 w-100">
                    <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <tr>
                            <th class="py-3 ps-4 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 140px;">Documento</th>
                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 150px;">Factura Origen</th>
                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Cliente / Tercero</th>
                            <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 140px;">Total Nota</th>
                            <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 150px;">Saldo a Favor</th>
                            <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 130px;">Estado</th>
                            <th class="py-3 pe-4 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 160px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                    ${pageItems.length > 0 ? pageItems.map(n => {
                        const clienteNombre = n.cliente?.nombre || 'Sin cliente';
                        const avatar = getClientAvatar(clienteNombre);
                        const hasSaldo = n.saldoAFavor > 0 && !n.isAnulada;
                        const opacity = n.isAnulada ? '0.5' : '1';

                        return `
                        <tr class="payment-row row-nota" data-id="${escapeHtml(n.id)}" style="opacity: ${opacity};">
                            <!-- Columna 1: Documento -->
                            <td class="py-3 ps-4">
                                <div class="payment-code-badge mb-1"># ${escapeHtml(n.numero || n.id)}</div>
                                <div class="text-muted" style="font-size: 11px;">
                                    <i class="bi bi-calendar3 me-1"></i> ${this.formatFecha(n.fecha)}
                                </div>
                            </td>

                            <!-- Columna 2: Factura Origen -->
                            <td class="py-3">
                                ${n.facturaOrigen ? `
                                    <a href="#/ingresos/facturas/ver/${escapeHtml(n.facturaOrigen.id)}" class="payment-invoice-tag" onclick="event.stopPropagation()" title="Ver factura relacionada #${escapeHtml(n.facturaOrigen.numero || n.facturaOrigen.id)}">
                                        <i class="bi bi-file-earmark-text"></i> #${escapeHtml(n.facturaOrigen.numero || n.facturaOrigen.id)}
                                    </a>
                                ` : (n.factura_id ? `
                                    <a href="#/ingresos/facturas/ver/${escapeHtml(n.factura_id)}" class="payment-invoice-tag" onclick="event.stopPropagation()">
                                        <i class="bi bi-file-earmark-text"></i> #${escapeHtml(n.factura_id)}
                                    </a>
                                ` : '<span class="text-muted" style="font-size: 11px;">Sin factura</span>')}
                            </td>

                            <!-- Columna 3: Cliente con Avatar -->
                            <td class="py-3">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 34px; height: 34px; font-size: 12px; flex-shrink: 0;">
                                        ${escapeHtml(avatar.initials)}
                                    </div>
                                    <div class="text-truncate" style="max-width: 260px;">
                                        <div class="fw-bold text-dark text-truncate" style="font-size: 13px;" title="${escapeHtml(clienteNombre)}">
                                            ${escapeHtml(clienteNombre)}
                                        </div>
                                        <div class="text-muted" style="font-size: 11px;">
                                            ${n.cliente?.identificacion ? `NIT/CC: ${escapeHtml(n.cliente.identificacion)}` : (n.motivo ? escapeHtml(n.motivo) : 'Devolución')}
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <!-- Columna 4: Total Nota -->
                            <td class="py-3 text-end">
                                <div class="text-dark fw-medium tnum" style="font-size: 13.5px;">
                                    ${this.formatMoney(n.total)}
                                </div>
                            </td>

                            <!-- Columna 5: Saldo a Favor -->
                            <td class="py-3 text-end">
                                <div class="${hasSaldo ? 'fw-bold text-warning-emphasis' : 'text-muted'} tnum" style="font-size: 13.5px;">
                                    ${this.formatMoney(n.saldoAFavor)}
                                </div>
                                ${hasSaldo ? `
                                    <span class="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning-subtle" style="font-size: 10px;">
                                        Disponible
                                    </span>
                                ` : ''}
                            </td>

                            <!-- Columna 6: Estado -->
                            <td class="py-3 text-center">
                                ${this.getEstadoBadge(n.estadoReal)}
                            </td>

                            <!-- Columna 7: Acciones -->
                            <td class="py-3 pe-4 text-end" onclick="event.stopPropagation()">
                                <div class="d-inline-flex align-items-center gap-1">
                                    ${hasSaldo ? `
                                        <button class="btn btn-sm btn-outline-warning btn-aplicar-saldo-fila shadow-xs" style="font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px;" data-id="${escapeHtml(n.id)}" data-numero="${escapeHtml(n.numero || n.id)}" data-contacto-id="${escapeHtml(n.contacto_id)}" data-contacto-nombre="${escapeHtml(clienteNombre)}" data-saldo-favor="${n.saldoAFavor}" title="Aplicar Saldo a Facturas Pendientes">
                                            <i class="bi bi-arrow-left-right me-1"></i> Cruzar
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-sm btn-light border btn-drawer-nc shadow-xs" style="font-size: 12px; padding: 4px 8px; border-radius: 6px;" data-id="${escapeHtml(n.id)}" title="Ver en panel lateral">
                                        <i class="bi bi-eye text-primary"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('') : `
                        <tr>
                            <td colspan="7" class="text-center py-5 text-muted">
                                <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                                <span>No se encontraron notas de crédito para los filtros seleccionados.</span>
                            </td>
                        </tr>
                    `}
                    </tbody>
                </table>
            </div>

            <!-- PAGINADOR FIJO INFERIOR -->
            <div class="d-flex flex-column flex-sm-row justify-content-between align-items-center p-3 text-muted border-top bg-white" style="font-size: 12px;">
                <div class="d-flex align-items-center gap-2 mb-2 mb-sm-0">
                    <span>Página <strong>${currentPage}</strong> de <strong>${totalPages}</strong></span>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <span>Mostrando ${startItem}-${endItem} de ${totalItems}</span>
                    <select class="form-select form-select-sm border-light-subtle py-0" id="select-nc-per-page" style="width: 110px; font-size: 12px;">
                        <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10 / pág</option>
                        <option value="20" ${itemsPerPage === 20 ? 'selected' : ''}>20 / pág</option>
                        <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50 / pág</option>
                        <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100 / pág</option>
                    </select>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-light border py-1 px-2" id="btn-nc-prev-page" ${currentPage <= 1 ? 'disabled' : ''}>
                            <i class="bi bi-chevron-left"></i>
                        </button>
                        <button class="btn btn-light border py-1 px-2" id="btn-nc-next-page" ${currentPage >= totalPages ? 'disabled' : ''}>
                            <i class="bi bi-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderDrawerContent({ nota, detalles, facturaOrigen, cliente, cruces }) {
        const clienteNombre = cliente?.nombre || 'Sin cliente';
        const avatar = getClientAvatar(clienteNombre);
        const hasSaldo = nota.saldoAFavor > 0 && nota.estado !== 'anulada';

        return `
            <!-- Header del Cliente en Drawer -->
            <div class="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
                <div class="d-flex align-items-center gap-3">
                    <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 44px; height: 44px; font-size: 15px;">
                        ${escapeHtml(avatar.initials)}
                    </div>
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="payment-code-badge">NOTA CRÉDITO #${escapeHtml(nota.numero || nota.id)}</span>
                            ${this.getEstadoBadge(nota.estado === 'anulada' ? 'anulada' : (hasSaldo ? 'saldo_favor' : 'aplicada'))}
                        </div>
                        <h4 class="fw-bold mb-0 mt-1" style="font-size: 17px; color: #0f172a;">${escapeHtml(clienteNombre)}</h4>
                        ${cliente?.identificacion ? `<span class="text-muted" style="font-size: 12px;">NIT / CC: ${escapeHtml(cliente.identificacion)}</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- Banner de Saldo a Favor -->
            <div class="p-3 rounded-3 mb-4 d-flex justify-content-between align-items-center" style="background: linear-gradient(135deg, ${hasSaldo ? '#fffbeb, #fef3c7' : '#f0fdf4, #ecfdf5'}); border: 1px solid ${hasSaldo ? '#fde68a' : '#a7f3d0'};">
                <div>
                    <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Saldo a Favor Disponible</span>
                    <h2 class="fw-bold ${hasSaldo ? 'text-warning-emphasis' : 'text-success'} mb-0 tnum" style="letter-spacing: -0.5px;">${this.formatMoney(nota.saldoAFavor)}</h2>
                </div>
                <div class="text-end">
                    <span class="badge bg-white text-dark border px-3 py-2 rounded-3 shadow-xs" style="font-size: 12px;">
                        <i class="bi bi-calendar3 me-1 text-primary"></i> ${this.formatFecha(nota.fecha)}
                    </span>
                    <div class="text-muted small mt-1">Total Devolución: ${this.formatMoney(nota.total)}</div>
                </div>
            </div>

            <!-- Ficha de Factura Origen Vinculada -->
            ${facturaOrigen ? `
                <div class="p-3 bg-light rounded-3 border mb-4">
                    <div class="text-uppercase fw-semibold text-muted mb-2" style="font-size: 11px; letter-spacing: 0.5px;">
                        <i class="bi bi-file-earmark-text text-primary me-1"></i> Factura de Venta Origen
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <a href="#/ingresos/facturas/ver/${escapeHtml(facturaOrigen.id)}" class="fw-bold text-primary text-decoration-none" style="font-size: 14px;">
                                Factura #${escapeHtml(facturaOrigen.numero || facturaOrigen.id)}
                            </a>
                            <div class="text-muted" style="font-size: 12px;">
                                Emitida el: ${this.formatFecha(facturaOrigen.fecha)}
                            </div>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold text-dark tnum">${this.formatMoney(facturaOrigen.total)}</div>
                            <span class="badge bg-light text-secondary border rounded-pill" style="font-size: 10px;">
                                ${escapeHtml(facturaOrigen.estado || 'Activa')}
                            </span>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Ítems / Productos Devueltos -->
            <div class="mb-4">
                <h6 class="fw-bold text-uppercase text-muted mb-2" style="font-size: 11px; letter-spacing: 0.5px;">
                    <i class="bi bi-box-seam me-1 text-primary"></i> Productos Devueltos
                </h6>
                ${detalles.length > 0 ? `
                    <div class="border rounded-3 overflow-hidden bg-white">
                        <table class="table table-sm table-borderless mb-0 align-middle" style="font-size: 12px;">
                            <thead class="bg-light border-bottom">
                                <tr>
                                    <th class="ps-3 py-2 text-muted fw-bold">Producto</th>
                                    <th class="text-center py-2 text-muted fw-bold" style="width: 70px;">Cant.</th>
                                    <th class="text-end py-2 text-muted fw-bold" style="width: 100px;">Precio</th>
                                    <th class="text-end pe-3 py-2 text-muted fw-bold" style="width: 100px;">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${detalles.map(d => `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td class="ps-3 py-2">
                                            <div class="fw-medium text-dark text-truncate" style="max-width: 220px;" title="${escapeHtml(d.productos?.nombre || 'Producto')}">
                                                ${escapeHtml(d.productos?.nombre || 'Producto')}
                                            </div>
                                            ${d.productos?.sku ? `<div class="text-muted" style="font-size: 10px;">SKU: ${escapeHtml(d.productos.sku)}</div>` : ''}
                                        </td>
                                        <td class="text-center py-2 fw-medium">${d.cantidad}</td>
                                        <td class="text-end py-2 tnum">${this.formatMoney(d.precio_unitario)}</td>
                                        <td class="text-end pe-3 py-2 fw-bold text-dark tnum">${this.formatMoney(d.subtotal)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="p-3 bg-light rounded-3 text-muted text-center" style="font-size: 12px;">
                        Sin detalle individual de productos devueltos.
                    </div>
                `}
            </div>

            <!-- Trazabilidad de Cruces Realizados -->
            <div class="mb-4">
                <h6 class="fw-bold text-uppercase text-muted mb-3" style="font-size: 11px; letter-spacing: 0.5px;">
                    <i class="bi bi-signpost-split me-1 text-primary"></i> Trazabilidad de Amortización / Cruces
                </h6>
                <div class="ps-2">
                    <!-- Hito 1: Emisión -->
                    <div class="payment-timeline-item">
                        <div class="payment-timeline-dot success">
                            <i class="bi bi-file-earmark-minus" style="font-size: 9px; color: #059669;"></i>
                        </div>
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <span class="fw-bold text-dark" style="font-size: 13px;">Nota de Crédito Emitida</span>
                                <div class="text-muted" style="font-size: 11px;">Monto total de devolución</div>
                            </div>
                            <div class="text-end">
                                <span class="fw-bold text-dark tnum" style="font-size: 13px;">${this.formatMoney(nota.total)}</span>
                                <div class="text-muted" style="font-size: 11px;">${this.formatFecha(nota.fecha)}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Hitos Cruces -->
                    ${cruces.length > 0 ? cruces.map(c => `
                        <div class="payment-timeline-item">
                            <div class="payment-timeline-dot blue">
                                <i class="bi bi-arrow-right-circle" style="font-size: 9px; color: #2563eb;"></i>
                            </div>
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <span class="fw-bold text-primary" style="font-size: 13px;">Cruce aplicado a Factura #${escapeHtml(c.facturas?.numero || c.factura_id)}</span>
                                    <div class="text-muted" style="font-size: 11px;">Recibo de caja #${escapeHtml(c.numero || c.id)}</div>
                                </div>
                                <div class="text-end">
                                    <span class="fw-bold text-success tnum" style="font-size: 13px;">-${this.formatMoney(c.monto)}</span>
                                    <div class="text-muted" style="font-size: 11px;">${this.formatFecha(c.fecha)}</div>
                                </div>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="p-3 bg-light rounded-3 text-muted text-center my-2" style="font-size: 12px;">
                            <i class="bi bi-clock-history me-1"></i> No se han registrado cruces de saldo con otras facturas.
                        </div>
                    `}

                    <!-- Hito Saldo Restante -->
                    <div class="payment-timeline-item" style="border-left-color: transparent;">
                        <div class="payment-timeline-dot ${hasSaldo ? 'warning' : 'success'}">
                            <i class="bi ${hasSaldo ? 'bi-exclamation' : 'bi-check'}" style="font-size: 10px;"></i>
                        </div>
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <span class="fw-bold ${hasSaldo ? 'text-warning-emphasis' : 'text-success'}" style="font-size: 13px;">Saldo a Favor Restante</span>
                                <div class="text-muted" style="font-size: 11px;">${hasSaldo ? 'Disponible para cruzar' : 'Completamente amortizado'}</div>
                            </div>
                            <div class="text-end">
                                <span class="fw-bold ${hasSaldo ? 'text-warning-emphasis' : 'text-success'} tnum" style="font-size: 14px;">${this.formatMoney(nota.saldoAFavor)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};
