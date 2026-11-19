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

export const CarteraTemplates = {
    formatMoney(val) {
        return '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    },

    formatFecha(str) {
        if (!str || str === '---' || str === 'N/A') return '---';
        const raw = String(str).split('T')[0];
        const partes = raw.split('-');
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : raw;
    },

    getMoraBadge(dias) {
        if (dias <= 0) {
            return `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;">
                <i class="bi bi-check-circle me-1"></i> Al día
            </span>`;
        }
        if (dias <= 30) {
            return `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;">
                <i class="bi bi-clock me-1"></i> Vence hace ${dias}d
            </span>`;
        }
        if (dias <= 60) {
            return `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;">
                <i class="bi bi-exclamation-circle me-1"></i> Mora ${dias}d
            </span>`;
        }
        return `<span class="badge bg-danger text-white rounded-pill fw-bold" style="font-size: 11px; padding: 3px 8px; background-color: #dc2626 !important;">
            <i class="bi bi-exclamation-triangle-fill me-1"></i> Crítica +${dias}d
        </span>`;
    },

    renderLayout() {
        const kpis = this.state.kpis || {};
        const clientes = this.state.clientesAgrupados || [];

        return `
            <div class="dash-layout p-4" style="max-width: 1200px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                
                <!-- BREADCRUMB Y RUTA -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div style="font-size: var(--fs-sm);" class="text-muted">
                        <span>Reportes</span> &gt; <span>Administrativos</span> &gt; <span class="text-dark fw-bold">Cuentas por cobrar</span>
                    </div>
                    <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1 fw-semibold" style="font-size: 11px;">
                        <i class="bi bi-shield-check me-1"></i> Crédito & Cartera
                    </span>
                </div>

                <!-- TÍTULO SUPERIOR Y CONTROLES DE ACCIÓN -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
                    <div>
                        <h2 class="page-title mb-1 fw-bold text-dark" style="font-size: 24px; letter-spacing: -0.5px;">Cuentas por Cobrar</h2>
                        <p class="text-muted mb-0" style="font-size: 13px;">
                            Monitorea la cartera pendiente, semáforo de mora y gestiona cobros en tiempo real.
                        </p>
                    </div>
                    
                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Toggle de Vistas: Facturas vs Clientes vs Analítica -->
                        <div class="btn-group p-1 bg-light border rounded-3" role="group">
                            <button type="button" class="btn btn-sm ${this.state.view === 'facturas' ? 'btn-white bg-white shadow-xs fw-bold text-dark' : 'btn-light border-0 text-muted'}" id="btn-view-facturas" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-receipt me-1"></i> Facturas
                            </button>
                            <button type="button" class="btn btn-sm ${this.state.view === 'clientes' ? 'btn-white bg-white shadow-xs fw-bold text-dark' : 'btn-light border-0 text-muted'}" id="btn-view-clientes" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-people me-1"></i> Por Cliente
                            </button>
                            <button type="button" class="btn btn-sm ${this.state.view === 'analitica' ? 'btn-white bg-white shadow-xs fw-bold text-primary' : 'btn-light border-0 text-muted'}" id="btn-view-analitica" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-pie-chart me-1"></i> Analítica
                            </button>
                        </div>

                        <!-- Botón Exportar Excel -->
                        <button id="btn-exportar-cartera" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 600; font-size: 13px; border-radius: 8px;" title="Descargar reporte en Excel">
                            <i class="bi bi-file-earmark-excel text-success me-1"></i> Exportar
                        </button>

                        <!-- Botón Refrescar -->
                        <button id="btn-refresh-cartera" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS EJECUTIVAS -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Total por Cobrar -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Total por Cobrar</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-wallet2"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" style="font-size: 22px;">
                                ${this.formatMoney(kpis.totalCartera)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <span class="fw-semibold text-primary">${kpis.conteoTotal || 0}</span> facturas pendientes
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Cartera Vigente -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Cartera al Día</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-check-circle"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" style="font-size: 22px;">
                                ${this.formatMoney(kpis.totalVigente)}
                            </div>
                            <div class="mt-2 d-flex align-items-center gap-2">
                                <span class="payment-kpi-trend positive">
                                    <i class="bi bi-shield-check"></i> ${kpis.porcentajeVigente || 0}%
                                </span>
                                <span class="text-muted" style="font-size: 11px;">dentro del plazo</span>
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Mora Crítica (+30 días) -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #dc2626;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Mora Crítica (+30d)</span>
                                <div class="payment-kpi-icon out-bg">
                                    <i class="bi bi-exclamation-triangle"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-danger tnum" style="font-size: 22px;">
                                ${this.formatMoney(kpis.moraCritica)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <span class="fw-semibold text-danger">${(kpis.conteo31a60 || 0) + (kpis.conteo60Plus || 0)}</span> facturas vencidas
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Clientes Deudores & Concentración -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Terceros en Cartera</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-people"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" style="font-size: 22px;">
                                ${kpis.totalDeudores || 0} <span style="font-size: 14px; font-weight: normal; color: #64748b;">clientes</span>
                            </div>
                            <div class="mt-2 text-muted text-truncate" style="font-size: 11px;" title="${escapeHtml(kpis.topDeudor ? kpis.topDeudor.nombre : 'Sin deudores')}">
                                ${kpis.topDeudor 
                                    ? `Top: <strong class="text-dark">${escapeHtml(kpis.topDeudor.nombre.substring(0, 18))}</strong> (${kpis.topDeudor.concentracion}%)` 
                                    : 'Sin saldo deudor activo'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR PRINCIPAL CON FILTROS Y TABLA -->
                <div class="dash-table-container shadow-xs mb-4" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                    
                    <!-- BARRA DE FILTROS SUPERIOR: SEGMENTED TABS + BUSCADOR -->
                    <div class="p-3 border-bottom bg-white d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                        
                        <!-- Segmented Control de Tramos de Mora -->
                        <div class="payment-tabs-bar">
                            <button type="button" class="payment-tab-btn ${this.state.selectedTab === 'todas' ? 'active' : ''}" data-tab="todas">
                                Todas
                                <span class="payment-tab-badge">${kpis.conteoTotal || 0}</span>
                            </button>
                            <button type="button" class="payment-tab-btn ${this.state.selectedTab === 'vigentes' ? 'active' : ''}" data-tab="vigentes">
                                <i class="bi bi-check-circle text-success"></i> Al día
                                <span class="payment-tab-badge">${kpis.conteoVigentes || 0}</span>
                            </button>
                            <button type="button" class="payment-tab-btn ${this.state.selectedTab === 'mora_1_30' ? 'active' : ''}" data-tab="mora_1_30">
                                <i class="bi bi-clock text-warning"></i> 1-30 días
                                <span class="payment-tab-badge">${kpis.conteo1a30 || 0}</span>
                            </button>
                            <button type="button" class="payment-tab-btn ${this.state.selectedTab === 'mora_31_60' ? 'active' : ''}" data-tab="mora_31_60">
                                <i class="bi bi-exclamation-circle text-danger"></i> 31-60 días
                                <span class="payment-tab-badge">${kpis.conteo31a60 || 0}</span>
                            </button>
                            <button type="button" class="payment-tab-btn tab-warning ${this.state.selectedTab === 'mora_mas_60' ? 'active' : ''}" data-tab="mora_mas_60">
                                <i class="bi bi-exclamation-triangle-fill text-danger"></i> +60 días
                                <span class="payment-tab-badge">${kpis.conteo60Plus || 0}</span>
                            </button>
                        </div>

                        <!-- Buscador Universal y Filtro de Cliente -->
                        <div class="d-flex align-items-center gap-2 flex-grow-1 flex-lg-grow-0">
                            <div class="ds-search-container" style="min-width: 220px; width: 100%;">
                                <i class="bi bi-search ds-search-icon"></i>
                                <input type="text" class="ds-search-input" id="search-cartera" autocomplete="off" placeholder="Buscar factura, cliente, NIT o monto..." value="${escapeHtml(this.state.searchQuery || '')}">
                            </div>

                            <select class="form-select form-select-sm" id="filter-cliente-select" style="width: auto; min-width: 170px; font-size: 13px; height: 38px; border-radius: 8px;">
                                <option value="todos" ${this.state.selectedClienteId === 'todos' ? 'selected' : ''}>👥 Todos los clientes</option>
                                ${clientes.map(c => `
                                    <option value="${escapeHtml(c.id)}" ${String(this.state.selectedClienteId) === String(c.id) ? 'selected' : ''}>
                                        ${escapeHtml(c.nombre.substring(0, 25))} (${this.formatMoney(c.totalSaldo)})
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- CONTENEDOR DINÁMICO DE VISTAS (Inyectado por render) -->
                    <div id="cartera-content-container" class="position-relative">
                        <!-- Inyectado dinámicamente -->
                    </div>
                </div>
            </div>

            <!-- SLIDE-OVER DRAWER DE CARTERA (PANEL LATERAL DERECHO) -->
            <div class="payment-drawer-backdrop" id="cartera-drawer-backdrop"></div>
            <div class="payment-drawer" id="cartera-drawer">
                <div class="payment-drawer-header d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-wallet2 text-primary fs-5"></i>
                        <h5 class="fw-bold mb-0" style="color: #0f172a; font-size: 16px;">Gestión de Cobranza</h5>
                    </div>
                    <div class="d-flex align-items-center gap-1">
                        <button type="button" class="btn btn-sm btn-light border-0 text-muted" id="btn-cartera-drawer-close" title="Cerrar panel">
                            <i class="bi bi-x-lg fs-6"></i>
                        </button>
                    </div>
                </div>
                
                <div class="payment-drawer-body" id="cartera-drawer-body">
                    <!-- Contenido dinámico del drawer inyectado por mostrarDrawer -->
                </div>
                
                <div class="payment-drawer-footer d-flex justify-content-between align-items-center">
                    <button type="button" class="btn btn-light border btn-sm px-3 fw-medium" id="btn-cartera-drawer-close-bottom">
                        Cerrar
                    </button>
                    <div class="d-flex gap-2" id="drawer-action-buttons">
                        <!-- Botones de acción dinámicos -->
                    </div>
                </div>
            </div>
        `;
    },

    renderGridFacturas() {
        const facturas = this.state.facturasFiltradas || [];
        const { currentPage, itemsPerPage, totalItems, isLoading } = this.state;

        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);
        const pageItems = facturas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Cliente / Deudor</th>
                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 130px;">Fechas</th>
                            <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 130px;">Mora</th>
                            <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 150px;">Total Factura</th>
                            <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 150px;">Saldo Pendiente</th>
                            <th class="py-3 pe-4 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 160px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                    ${pageItems.length > 0 ? pageItems.map(f => {
                        const clienteNombre = f.cliente?.nombre || 'Cliente General';
                        const avatar = getClientAvatar(clienteNombre);
                        const isVencida = f.diasVencida >= 1;

                        return `
                        <tr class="payment-row row-factura" data-id="${escapeHtml(f.id)}">
                            <!-- Columna 1: Documento -->
                            <td class="py-3 ps-4">
                                <div class="payment-code-badge mb-1"># ${escapeHtml(f.numero || f.id)}</div>
                                <div class="text-muted" style="font-size: 11px;">
                                    Factura de venta
                                </div>
                            </td>

                            <!-- Columna 2: Cliente con Avatar -->
                            <td class="py-3">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 34px; height: 34px; font-size: 12px; flex-shrink: 0;">
                                        ${avatar.initials}
                                    </div>
                                    <div class="text-truncate" style="max-width: 240px;">
                                        <div class="fw-bold text-dark text-truncate" style="font-size: 13px;" title="${escapeHtml(clienteNombre)}">
                                            ${escapeHtml(clienteNombre)}
                                        </div>
                                        <div class="text-muted" style="font-size: 11px;">
                                            ${f.cliente?.identificacion ? `NIT/CC: ${escapeHtml(f.cliente.identificacion)}` : 'Sin documento'}
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <!-- Columna 3: Fechas -->
                            <td class="py-3">
                                <div class="text-muted" style="font-size: 11px;">
                                    <i class="bi bi-calendar3 me-1"></i> ${this.formatFecha(f.fecha)}
                                </div>
                                <div class="${isVencida ? 'text-danger fw-semibold' : 'text-muted'}" style="font-size: 11px;">
                                    <i class="bi bi-clock-history me-1"></i> ${this.formatFecha(f.vencimientoReal)}
                                </div>
                            </td>

                            <!-- Columna 4: Semáforo de Mora -->
                            <td class="py-3 text-center">
                                ${this.getMoraBadge(f.diasVencida)}
                            </td>

                            <!-- Columna 5: Total & Cobrado -->
                            <td class="py-3 text-end">
                                <div class="text-dark fw-medium tnum" style="font-size: 13px;">
                                    ${this.formatMoney(f.total)}
                                </div>
                                <div class="text-muted tnum" style="font-size: 11px;">
                                    Cobrado: ${this.formatMoney(f.cobrado)}
                                </div>
                            </td>

                            <!-- Columna 6: Saldo Pendiente -->
                            <td class="py-3 text-end">
                                <div class="fw-bold text-dark tnum" style="font-size: 14px;">
                                    ${this.formatMoney(f.saldo)}
                                </div>
                                <div class="progress mt-1" style="height: 4px; width: 100px; margin-left: auto; background-color: #f1f5f9;">
                                    <div class="progress-bar bg-success" style="width: ${f.porcentajeCobrado || 0}%;"></div>
                                </div>
                            </td>

                            <!-- Columna 7: Acciones Rápidas -->
                            <td class="py-3 pe-4 text-end" onclick="event.stopPropagation()">
                                <div class="d-inline-flex align-items-center gap-1">
                                    <button class="btn btn-sm text-white btn-abonar-fila shadow-xs" style="background-color: var(--primary); font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px;" data-id="${escapeHtml(f.id)}" data-saldo="${f.saldo}" title="Registrar Pago / Abono">
                                        Abonar
                                    </button>
                                    <button class="btn btn-sm btn-outline-success btn-wpp-fila shadow-xs" style="font-size: 12px; padding: 4px 8px; border-radius: 6px;" data-id="${escapeHtml(f.id)}" title="Cobrar por WhatsApp con Cuentas Bancarias">
                                        <i class="bi bi-whatsapp"></i>
                                    </button>
                                    <button class="btn btn-sm btn-light border btn-estado-fila shadow-xs" style="font-size: 12px; padding: 4px 8px; border-radius: 6px;" data-cliente-id="${escapeHtml(f.clienteId)}" title="Imprimir Estado de Cuenta">
                                        <i class="bi bi-printer text-secondary"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('') : `
                        <tr>
                            <td colspan="7" class="text-center py-5 text-muted">
                                <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                                <span>No se encontraron facturas con saldo pendiente para los filtros seleccionados.</span>
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
                    <span class="text-muted ms-2">• Saldo Filtrado: <strong class="text-dark">${this.formatMoney(this.state.saldoFiltrado)}</strong></span>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <span>Mostrando ${startItem}-${endItem} de ${totalItems}</span>
                    <select class="form-select form-select-sm border-light-subtle py-0" id="select-items-per-page" style="width: 110px; font-size: 12px;">
                        <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10 / pág</option>
                        <option value="20" ${itemsPerPage === 20 ? 'selected' : ''}>20 / pág</option>
                        <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50 / pág</option>
                        <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100 / pág</option>
                    </select>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-light border py-1 px-2" id="btn-prev-page" ${currentPage <= 1 ? 'disabled' : ''}>
                            <i class="bi bi-chevron-left"></i>
                        </button>
                        <button class="btn btn-light border py-1 px-2" id="btn-next-page" ${currentPage >= totalPages ? 'disabled' : ''}>
                            <i class="bi bi-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderVistaClientes() {
        const clientes = this.state.clientesFiltrados || [];
        const { isLoading } = this.state;

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
                            <th class="py-3 ps-4 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Cliente / Deudor</th>
                            <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 140px;">Mora Máxima</th>
                            <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 140px;">Facturas</th>
                            <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 170px;">Total Adeudado</th>
                            <th class="py-3 pe-4 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 220px;">Gestión de Cobro</th>
                        </tr>
                    </thead>
                    <tbody>
                    ${clientes.length > 0 ? clientes.map(c => {
                        const avatar = getClientAvatar(c.nombre);

                        return `
                        <tr class="payment-row row-cliente" data-cliente-id="${escapeHtml(c.id)}">
                            <td class="py-3 ps-4">
                                <div class="d-flex align-items-center gap-2.5">
                                    <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 36px; height: 36px; font-size: 13px; flex-shrink: 0;">
                                        ${avatar.initials}
                                    </div>
                                    <div class="text-truncate" style="max-width: 280px;">
                                        <div class="fw-bold text-dark text-truncate" title="${escapeHtml(c.nombre)}" style="font-size: 13.5px;">
                                            ${escapeHtml(c.nombre)}
                                        </div>
                                        <div class="text-muted d-flex align-items-center gap-2" style="font-size: 11px;">
                                            <span>${c.identificacion ? `NIT/CC: ${escapeHtml(c.identificacion)}` : 'Sin NIT'}</span>
                                            ${c.telefono ? `<span>• Tel: ${escapeHtml(c.telefono)}</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <td class="py-3 text-center">
                                ${this.getMoraBadge(c.maxDiasMora)}
                            </td>

                            <td class="py-3 text-center">
                                <span class="badge bg-light text-secondary border rounded-pill fw-medium" style="font-size: 11px; padding: 4px 8px;">
                                    ${c.facturas.length} ${c.facturas.length === 1 ? 'factura' : 'facturas'}
                                </span>
                            </td>

                            <td class="py-3 text-end fw-bold text-danger tnum" style="font-size: 14.5px;">
                                ${this.formatMoney(c.totalSaldo)}
                            </td>

                            <td class="py-3 pe-4 text-end" onclick="event.stopPropagation()">
                                <div class="d-inline-flex align-items-center gap-1.5">
                                    <button class="btn btn-sm btn-success d-inline-flex align-items-center gap-1.5 btn-wpp-cliente shadow-xs" data-cliente-id="${escapeHtml(c.id)}" title="Cobrar por WhatsApp con Hoja de Estado de Cuenta" style="border-radius: 6px; font-size: 12px; font-weight: 600; padding: 4px 10px;">
                                        <i class="bi bi-whatsapp"></i> Cobrar
                                    </button>
                                    <button class="btn btn-sm btn-light border d-inline-flex align-items-center justify-content-center btn-print-cliente shadow-xs" data-cliente-id="${escapeHtml(c.id)}" title="Imprimir Estado de Cuenta" style="border-radius: 6px; width: 32px; height: 30px; padding: 0;">
                                        <i class="bi bi-printer text-secondary"></i>
                                    </button>
                                    <button class="btn btn-sm btn-light border d-inline-flex align-items-center justify-content-center btn-detalle-cliente shadow-xs" data-cliente-id="${escapeHtml(c.id)}" title="Ver Facturas" style="border-radius: 6px; width: 32px; height: 30px; padding: 0;">
                                        <i class="bi bi-eye text-primary"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('') : `
                        <tr>
                            <td colspan="5" class="text-center py-5 text-muted">
                                <i class="bi bi-people fs-2 d-block mb-2 text-secondary"></i>
                                <span>No se encontraron clientes con cartera pendiente.</span>
                            </td>
                        </tr>
                    `}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderAnalyticsView() {
        const kpis = this.state.kpis || {};
        const clientes = (this.state.clientesAgrupados || []).slice(0, 5);
        const total = kpis.totalCartera || 1;

        const pctVigente = Math.round(((kpis.totalVigente || 0) / total) * 100);
        const pct1a30 = Math.round(((kpis.mora1a30 || 0) / total) * 100);
        const pct31a60 = Math.round(((kpis.mora31a60 || 0) / total) * 100);
        const pct60Plus = Math.round(((kpis.mora60Plus || 0) / total) * 100);

        return `
            <div class="p-4">
                <div class="row g-4">
                    <!-- Envejecimiento de la Cartera (Aging Distribution) -->
                    <div class="col-12 col-lg-6">
                        <div class="p-3 border rounded-3 bg-white h-100">
                            <h6 class="fw-bold text-dark mb-3 d-flex align-items-center gap-2" style="font-size: 14px;">
                                <i class="bi bi-pie-chart text-primary"></i> Distribución de Morosidad (Aging)
                            </h6>
                            <p class="text-muted small mb-4">Composición porcentual de la cartera según los días transcurridos desde el vencimiento.</p>
                            
                            <div class="d-flex flex-column gap-3">
                                <div>
                                    <div class="d-flex justify-content-between mb-1 small">
                                        <span class="fw-medium text-success"><i class="bi bi-circle-fill me-1" style="font-size: 8px;"></i> Al día / Vigente</span>
                                        <span class="fw-bold text-dark tnum">${this.formatMoney(kpis.totalVigente)} (${pctVigente}%)</span>
                                    </div>
                                    <div class="progress" style="height: 8px;">
                                        <div class="progress-bar bg-success" style="width: ${pctVigente}%;"></div>
                                    </div>
                                </div>

                                <div>
                                    <div class="d-flex justify-content-between mb-1 small">
                                        <span class="fw-medium text-warning-emphasis"><i class="bi bi-circle-fill me-1" style="font-size: 8px; color: #d97706;"></i> Mora 1 - 30 días</span>
                                        <span class="fw-bold text-dark tnum">${this.formatMoney(kpis.mora1a30)} (${pct1a30}%)</span>
                                    </div>
                                    <div class="progress" style="height: 8px;">
                                        <div class="progress-bar bg-warning" style="width: ${pct1a30}%;"></div>
                                    </div>
                                </div>

                                <div>
                                    <div class="d-flex justify-content-between mb-1 small">
                                        <span class="fw-medium text-danger"><i class="bi bi-circle-fill me-1" style="font-size: 8px; color: #f43f5e;"></i> Mora 31 - 60 días</span>
                                        <span class="fw-bold text-dark tnum">${this.formatMoney(kpis.mora31a60)} (${pct31a60}%)</span>
                                    </div>
                                    <div class="progress" style="height: 8px;">
                                        <div class="progress-bar bg-danger bg-opacity-75" style="width: ${pct31a60}%;"></div>
                                    </div>
                                </div>

                                <div>
                                    <div class="d-flex justify-content-between mb-1 small">
                                        <span class="fw-bold text-danger"><i class="bi bi-circle-fill me-1" style="font-size: 8px; color: #dc2626;"></i> Mora Crítica (+60 días)</span>
                                        <span class="fw-bold text-danger tnum">${this.formatMoney(kpis.mora60Plus)} (${pct60Plus}%)</span>
                                    </div>
                                    <div class="progress" style="height: 8px;">
                                        <div class="progress-bar bg-danger" style="width: ${pct60Plus}%;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Concentración de Cartera (Top 5 Deudores) -->
                    <div class="col-12 col-lg-6">
                        <div class="p-3 border rounded-3 bg-white h-100">
                            <h6 class="fw-bold text-dark mb-3 d-flex align-items-center gap-2" style="font-size: 14px;">
                                <i class="bi bi-bar-chart-steps text-danger"></i> Concentración de Riesgo (Top 5 Deudores)
                            </h6>
                            <p class="text-muted small mb-4">Los 5 clientes que concentran el mayor volumen de cartera pendiente.</p>

                            <div class="d-flex flex-column gap-3">
                                ${clientes.map(c => {
                                    const pct = Math.round((c.totalSaldo / total) * 100);
                                    const avatar = getClientAvatar(c.nombre);
                                    return `
                                        <div>
                                            <div class="d-flex justify-content-between align-items-center mb-1 small">
                                                <div class="d-flex align-items-center gap-2 text-truncate" style="max-width: 280px;">
                                                    <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 22px; height: 22px; font-size: 10px;">
                                                        ${avatar.initials}
                                                    </div>
                                                    <span class="fw-bold text-dark text-truncate" title="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</span>
                                                </div>
                                                <span class="fw-bold text-danger tnum">${this.formatMoney(c.totalSaldo)} (${pct}%)</span>
                                            </div>
                                            <div class="progress" style="height: 6px;">
                                                <div class="progress-bar bg-danger" style="width: ${pct}%;"></div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderDrawerContent(factura, abonos, cliente, carteraTotalCliente) {
        const avatar = getClientAvatar(cliente?.nombre || factura.cliente?.nombre);
        const dias = factura.diasVencida;

        return `
            <!-- Header del Cliente en Drawer -->
            <div class="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
                <div class="d-flex align-items-center gap-3">
                    <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 44px; height: 44px; font-size: 15px;">
                        ${avatar.initials}
                    </div>
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="payment-code-badge">FACTURA #${escapeHtml(factura.numero || factura.id)}</span>
                            ${this.getMoraBadge(dias)}
                        </div>
                        <h4 class="fw-bold mb-0 mt-1" style="font-size: 17px; color: #0f172a;">${escapeHtml(cliente?.nombre || factura.cliente?.nombre || 'Cliente General')}</h4>
                        ${cliente?.identificacion ? `<span class="text-muted" style="font-size: 12px;">NIT / CC: ${escapeHtml(cliente.identificacion)}</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- Banner de Saldo Pendiente -->
            <div class="p-3 rounded-3 mb-4 d-flex justify-content-between align-items-center" style="background: linear-gradient(135deg, #fef2f2, #fff1f2); border: 1px solid #fecdd3;">
                <div>
                    <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Saldo por Cobrar</span>
                    <h2 class="fw-bold text-danger mb-0 tnum" style="letter-spacing: -0.5px;">${this.formatMoney(factura.saldo)}</h2>
                </div>
                <div class="text-end">
                    <span class="badge bg-white text-dark border px-3 py-2 rounded-3 shadow-xs" style="font-size: 12px;">
                        <i class="bi bi-calendar3 me-1 text-primary"></i> Vence: ${this.formatFecha(factura.vencimientoReal)}
                    </span>
                    <div class="text-muted small mt-1">Total: ${this.formatMoney(factura.total)}</div>
                </div>
            </div>

            <!-- Datos de Contacto y Advertencia de Cartera Consolidada -->
            ${carteraTotalCliente && carteraTotalCliente.facturas.length > 1 ? `
                <div class="alert alert-warning d-flex align-items-center gap-2 p-2.5 rounded-3 mb-4" style="font-size: 12px; border-color: #fde68a; background-color: #fffbeb;">
                    <i class="bi bi-info-circle-fill text-warning fs-5"></i>
                    <div>
                        Este cliente tiene <strong>${carteraTotalCliente.facturas.length} facturas pendientes</strong> por un saldo acumulado de <strong>${this.formatMoney(carteraTotalCliente.totalSaldo)}</strong>.
                    </div>
                </div>
            ` : ''}

            <!-- Línea de Tiempo de Trazabilidad (Abonos) -->
            <div class="mb-4">
                <h6 class="fw-bold text-uppercase text-muted mb-3" style="font-size: 11px; letter-spacing: 0.5px;">
                    <i class="bi bi-signpost-split me-1 text-primary"></i> Trazabilidad de Pagos
                </h6>
                <div class="ps-2">
                    <!-- Hito 1: Factura emitida -->
                    <div class="payment-timeline-item">
                        <div class="payment-timeline-dot success">
                            <i class="bi bi-receipt" style="font-size: 9px; color: #059669;"></i>
                        </div>
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <span class="fw-bold text-dark" style="font-size: 13px;">Factura Emitida</span>
                                <div class="text-muted" style="font-size: 11px;">Monto total facturado</div>
                            </div>
                            <div class="text-end">
                                <span class="fw-bold text-dark tnum" style="font-size: 13px;">${this.formatMoney(factura.total)}</span>
                                <div class="text-muted" style="font-size: 11px;">${this.formatFecha(factura.fecha)}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Hitos 2..N: Abonos -->
                    ${abonos.length > 0 ? abonos.map(a => `
                        <div class="payment-timeline-item">
                            <div class="payment-timeline-dot blue">
                                <i class="bi bi-cash-stack" style="font-size: 9px; color: #2563eb;"></i>
                            </div>
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <span class="fw-bold text-primary" style="font-size: 13px;">Abono Recibido #${escapeHtml(a.numero || a.id)}</span>
                                    <div class="text-muted" style="font-size: 11px;">Ingreso a: ${escapeHtml(a.cuentas_bancarias?.nombre || 'Caja')}</div>
                                </div>
                                <div class="text-end">
                                    <span class="fw-bold text-success tnum" style="font-size: 13px;">+${this.formatMoney(a.monto)}</span>
                                    <div class="text-muted" style="font-size: 11px;">${this.formatFecha(a.fecha)}</div>
                                </div>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="p-3 bg-light rounded-3 text-muted text-center my-2" style="font-size: 12px;">
                            <i class="bi bi-clock-history me-1"></i> Sin abonos previos registrados para esta factura.
                        </div>
                    `}

                    <!-- Hito Final: Saldo Pendiente Actual -->
                    <div class="payment-timeline-item" style="border-left-color: transparent;">
                        <div class="payment-timeline-dot ${factura.saldo > 0 ? 'warning' : 'success'}">
                            <i class="bi ${factura.saldo > 0 ? 'bi-exclamation' : 'bi-check'}" style="font-size: 10px;"></i>
                        </div>
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <span class="fw-bold text-danger" style="font-size: 13px;">Saldo Pendiente</span>
                                <div class="text-muted" style="font-size: 11px;">Por recaudar</div>
                            </div>
                            <div class="text-end">
                                <span class="fw-bold text-danger tnum" style="font-size: 14px;">${this.formatMoney(factura.saldo)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};
