// js/modules/auditoria/auditoria.templates.js
// Capa de Presentación HTML, Componentes Ergonómicos y Visualización 360°

import { escapeHtml } from '../../shared/formatters.js';

export const AuditoriaTemplates = {
    /**
     * Formateadores numéricos y de moneda
     */
    formatMoney(val) {
        if (val === null || val === undefined || val === '') return '$ 0';
        const num = parseFloat(val) || 0;
        return '$ ' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

    formatNumero(val) {
        if (val === null || val === undefined || val === '') return '0';
        const num = parseFloat(val) || 0;
        return num.toLocaleString('es-CO');
    },

    formatFecha(val) {
        if (!val) return '-';
        try {
            const d = new Date(val);
            if (isNaN(d.getTime())) return String(val);
            return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return String(val);
        }
    },

    getSeverityBadge(severity) {
        if (severity === 'critical') {
            return `
                <span class="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle fw-semibold rounded-pill px-2 py-1" style="font-size: 11px;">
                    <i class="bi bi-shield-fill-exclamation me-1"></i>Crítico
                </span>
            `;
        }
        if (severity === 'warning') {
            return `
                <span class="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning-subtle fw-semibold rounded-pill px-2 py-1" style="font-size: 11px;">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i>Advertencia
                </span>
            `;
        }
        return `
            <span class="badge bg-info bg-opacity-10 text-info-emphasis border border-info-subtle fw-semibold rounded-pill px-2 py-1" style="font-size: 11px;">
                <i class="bi bi-info-circle-fill me-1"></i>Informativo
            </span>
        `;
    },

    getHealthBadge(score) {
        const num = Math.round(score);
        if (num >= 90) {
            return `
                <span class="badge bg-success bg-opacity-10 text-success border border-success-subtle fw-bold rounded-pill px-3 py-1" style="font-size: 12px;">
                    <i class="bi bi-shield-check me-1"></i>Excelente (${num}%)
                </span>
            `;
        }
        if (num >= 70) {
            return `
                <span class="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning-subtle fw-bold rounded-pill px-3 py-1" style="font-size: 12px;">
                    <i class="bi bi-shield-exclamation me-1"></i>Atención (${num}%)
                </span>
            `;
        }
        return `
            <span class="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle fw-bold rounded-pill px-3 py-1" style="font-size: 12px;">
                <i class="bi bi-shield-x me-1"></i>Crítico (${num}%)
            </span>
        `;
    },

    getStatusBadge(check) {
        if (check.isRunning) {
            return `
                <span class="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle rounded-pill px-2 py-1 d-inline-flex align-items-center gap-1" style="font-size: 11px;">
                    <span class="spinner-border spinner-border-sm" style="width: 12px; height: 12px;" role="status"></span>
                    <span>Analizando...</span>
                </span>
            `;
        }

        if (check.error) {
            return `
                <span class="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning-subtle rounded-pill px-2 py-1" style="font-size: 11px;">
                    <i class="bi bi-exclamation-circle-fill me-1"></i>Error de Ejecución
                </span>
            `;
        }

        if (!check.result) {
            return `
                <span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle rounded-pill px-2 py-1" style="font-size: 11px;">
                    <i class="bi bi-clock me-1"></i>Pendiente
                </span>
            `;
        }

        if (check.result.success) {
            return `
                <span class="badge bg-success bg-opacity-10 text-success border border-success-subtle rounded-pill px-2 py-1" style="font-size: 11px;">
                    <i class="bi bi-check-circle-fill me-1"></i>Sin problemas detectados
                </span>
            `;
        }

        const count = check.result.count || 1;
        return `
            <span class="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle rounded-pill px-2 py-1 fw-bold" style="font-size: 11px;">
                <i class="bi bi-x-circle-fill me-1"></i>${count} discrepancia(s)
            </span>
        `;
    },

    /**
     * Renderiza el Layout Principal del Módulo 360°
     */
    renderLayout(state = {}) {
        const kpis = state.kpis || {
            healthScore: 100,
            totalChecks: 0,
            passedChecks: 0,
            failedChecks: 0,
            criticalDiscrepancies: 0,
            warningDiscrepancies: 0,
            totalDiscrepancies: 0,
            categoryCounts: { todas: 0, ventas: 0, cartera: 0, inventario: 0, bancos: 0, seguridad: 0, con_errores: 0 }
        };

        const currentTab = state.currentTab || 'todas';
        const searchQuery = state.searchQuery || '';
        const counts = kpis.categoryCounts || {};
        const isRunning = Boolean(state.isRunning);
        const lastAuditDate = state.lastAuditDate ? this.formatFecha(state.lastAuditDate) + ' ' + new Date(state.lastAuditDate).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : 'No ejecutada';

        return `
            <div class="dash-layout p-4" style="max-width: 1280px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                
                <!-- TOP BAR INSTITUCIONAL -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <a href="#" onclick="event.preventDefault(); window.history.length > 2 ? window.history.back() : window.location.hash = '#/dashboard';" class="btn btn-light bg-white border me-2" style="border-radius: 8px;" title="Volver">
                                <i class="bi bi-arrow-left"></i>
                            </a>
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Auditoría de Integridad</h2>
                            <span class="badge" style="background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #bfdbfe;">
                                <i class="bi bi-shield-check me-1"></i> Motor Contable 360°
                            </span>
                            ${this.getHealthBadge(kpis.healthScore)}
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 4px;">
                            Diagnóstico y reconciliación de datos en tiempo real: ventas, cartera, inventario FIFO, bancos y seguridad relacional.
                            <span class="ms-2 text-secondary fst-italic">Última auditoría: <strong>${lastAuditDate}</strong></span>
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <button id="btn-run-audit" class="btn btn-primary" style="font-weight: 600; font-size: 13px; border-radius: 8px; padding: 8px 16px; background-color: #2563eb; border-color: #2563eb;" ${isRunning ? 'disabled' : ''}>
                            ${isRunning ? `
                                <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                Ejecutando Auditoría...
                            ` : `
                                <i class="bi bi-play-fill me-1"></i> Ejecutar Auditoría Completa
                            `}
                        </button>
                    </div>
                </div>

                <!-- 4 TARJETAS KPI EJECUTIVAS -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Health Score -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="card border-0 shadow-sm p-3 h-100" style="border-radius: 12px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-left: 4px solid ${kpis.healthScore >= 90 ? '#10b981' : (kpis.healthScore >= 70 ? '#f59e0b' : '#ef4444')} !important;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-muted fw-medium" style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Salud del Sistema</span>
                                <i class="bi bi-heart-pulse-fill" style="color: ${kpis.healthScore >= 90 ? '#10b981' : (kpis.healthScore >= 70 ? '#f59e0b' : '#ef4444')}; font-size: 18px;"></i>
                            </div>
                            <div class="d-flex align-items-baseline gap-2">
                                <span class="fw-bolder" style="font-size: 28px; color: #0f172a;">${kpis.healthScore}%</span>
                                <span class="text-muted" style="font-size: 12px;">Health Score</span>
                            </div>
                            <div class="progress mt-2" style="height: 6px; border-radius: 4px; background-color: #e2e8f0;">
                                <div class="progress-bar ${kpis.healthScore >= 90 ? 'bg-success' : (kpis.healthScore >= 70 ? 'bg-warning' : 'bg-danger')}" style="width: ${kpis.healthScore}%;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Chequeos Evaluados -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="card border-0 shadow-sm p-3 h-100" style="border-radius: 12px; background: #ffffff; border-left: 4px solid #3b82f6 !important;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-muted fw-medium" style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Validaciones</span>
                                <i class="bi bi-shield-check text-primary" style="font-size: 18px;"></i>
                            </div>
                            <div class="d-flex align-items-baseline gap-2">
                                <span class="fw-bolder" style="font-size: 28px; color: #0f172a;">${kpis.passedChecks}<span style="font-size: 18px; color: #94a3b8; font-weight: normal;"> / ${kpis.totalChecks}</span></span>
                            </div>
                            <span class="text-muted" style="font-size: 12px;">
                                ${kpis.failedChecks > 0 ? `<span class="text-danger fw-semibold">${kpis.failedChecks} con observación</span>` : '<span class="text-success fw-semibold">100% conformes</span>'}
                            </span>
                        </div>
                    </div>

                    <!-- KPI 3: Discrepancias Críticas -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="card border-0 shadow-sm p-3 h-100" style="border-radius: 12px; background: #ffffff; border-left: 4px solid #ef4444 !important;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-muted fw-medium" style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Atención Crítica</span>
                                <i class="bi bi-exclamation-octagon-fill text-danger" style="font-size: 18px;"></i>
                            </div>
                            <div class="d-flex align-items-baseline gap-2">
                                <span class="fw-bolder" style="font-size: 28px; color: ${kpis.criticalDiscrepancies > 0 ? '#ef4444' : '#0f172a'};">${kpis.criticalDiscrepancies}</span>
                                <span class="text-muted" style="font-size: 12px;">registros</span>
                            </div>
                            <span class="text-muted" style="font-size: 12px;">
                                ${kpis.criticalDiscrepancies > 0 ? 'Inconsistencias que afectan balances' : 'Sin inconsistencias críticas'}
                            </span>
                        </div>
                    </div>

                    <!-- KPI 4: Alertas Preventivas -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="card border-0 shadow-sm p-3 h-100" style="border-radius: 12px; background: #ffffff; border-left: 4px solid #f59e0b !important;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-muted fw-medium" style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Alertas Preventivas</span>
                                <i class="bi bi-bell-fill text-warning" style="font-size: 18px;"></i>
                            </div>
                            <div class="d-flex align-items-baseline gap-2">
                                <span class="fw-bolder" style="font-size: 28px; color: ${kpis.warningDiscrepancies > 0 ? '#d97706' : '#0f172a'};">${kpis.warningDiscrepancies}</span>
                                <span class="text-muted" style="font-size: 12px;">registros</span>
                            </div>
                            <span class="text-muted" style="font-size: 12px;">
                                Margen negativo, duplicados, sin cuenta
                            </span>
                        </div>
                    </div>
                </div>

                <!-- BARRA DE PESTAÑAS (TABS) POR DOMINIO -->
                <div class="card border-0 shadow-sm mb-3" style="border-radius: 12px; background: #ffffff;">
                    <div class="card-body p-2">
                        <ul class="nav nav-pills flex-nowrap overflow-auto gap-1" id="audit-tabs" style="scrollbar-width: thin;">
                            <li class="nav-item">
                                <button class="nav-link py-2 px-3 ${currentTab === 'todas' ? 'active' : ''}" data-tab="todas" style="font-size: 13px; font-weight: 600; border-radius: 8px;">
                                    Todos los Chequeos <span class="badge ms-1 ${currentTab === 'todas' ? 'bg-white text-primary' : 'bg-light text-secondary'}">${counts.todas || 0}</span>
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link py-2 px-3 ${currentTab === 'ventas' ? 'active' : ''}" data-tab="ventas" style="font-size: 13px; font-weight: 600; border-radius: 8px;">
                                    Ventas & Facturación <span class="badge ms-1 ${currentTab === 'ventas' ? 'bg-white text-primary' : 'bg-light text-secondary'}">${counts.ventas || 0}</span>
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link py-2 px-3 ${currentTab === 'cartera' ? 'active' : ''}" data-tab="cartera" style="font-size: 13px; font-weight: 600; border-radius: 8px;">
                                    Cartera & Contactos <span class="badge ms-1 ${currentTab === 'cartera' ? 'bg-white text-primary' : 'bg-light text-secondary'}">${counts.cartera || 0}</span>
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link py-2 px-3 ${currentTab === 'inventario' ? 'active' : ''}" data-tab="inventario" style="font-size: 13px; font-weight: 600; border-radius: 8px;">
                                    Inventario & Lotes FIFO <span class="badge ms-1 ${currentTab === 'inventario' ? 'bg-white text-primary' : 'bg-light text-secondary'}">${counts.inventario || 0}</span>
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link py-2 px-3 ${currentTab === 'bancos' ? 'active' : ''}" data-tab="bancos" style="font-size: 13px; font-weight: 600; border-radius: 8px;">
                                    Bancos & Tesorería <span class="badge ms-1 ${currentTab === 'bancos' ? 'bg-white text-primary' : 'bg-light text-secondary'}">${counts.bancos || 0}</span>
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link py-2 px-3 ${currentTab === 'seguridad' ? 'active' : ''}" data-tab="seguridad" style="font-size: 13px; font-weight: 600; border-radius: 8px;">
                                    Seguridad RLS <span class="badge ms-1 ${currentTab === 'seguridad' ? 'bg-white text-primary' : 'bg-light text-secondary'}">${counts.seguridad || 0}</span>
                                </button>
                            </li>
                            <li class="nav-item ms-auto">
                                <button class="nav-link py-2 px-3 ${currentTab === 'con_errores' ? 'active btn-danger text-white' : 'text-danger bg-danger bg-opacity-10'}" data-tab="con_errores" style="font-size: 13px; font-weight: 700; border-radius: 8px;">
                                    <i class="bi bi-funnel-fill me-1"></i>Solo Inconsistencias <span class="badge ms-1 ${currentTab === 'con_errores' ? 'bg-white text-danger' : 'bg-danger text-white'}">${counts.con_errores || 0}</span>
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- TOOLBAR (BÚSQUEDA Y EXPORTACIÓN) -->
                <div class="card border-0 shadow-sm mb-4" style="border-radius: 12px; background: #ffffff;">
                    <div class="card-body p-3">
                        <div class="row g-2 align-items-center">
                            <div class="col-12 col-md-6 col-lg-7">
                                <div class="input-group">
                                    <span class="input-group-text bg-white border-end-0 text-muted" style="border-radius: 8px 0 0 8px;">
                                        <i class="bi bi-search"></i>
                                    </span>
                                    <input type="text" id="audit-search-input" class="form-control border-start-0" placeholder="Buscar por código (ej. VTA-003), palabras clave o descripción..." value="${escapeHtml(searchQuery)}" style="border-radius: 0 8px 8px 0; font-size: 13px;">
                                </div>
                            </div>
                            <div class="col-12 col-md-6 col-lg-5 d-flex justify-content-md-end gap-2">
                                <button id="btn-copy-report" class="btn btn-light bg-white border" style="font-size: 13px; font-weight: 600; border-radius: 8px;" title="Copiar informe en Markdown al portapapeles">
                                    <i class="bi bi-clipboard me-1"></i> Copiar Informe
                                </button>
                                <button id="btn-export-excel" class="btn btn-outline-success" style="font-size: 13px; font-weight: 600; border-radius: 8px;" title="Descargar informe consolidado a Excel / CSV">
                                    <i class="bi bi-file-earmark-excel me-1"></i> Exportar a Excel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- LISTADO DE CHEQUEOS -->
                <div id="audit-checks-container" class="d-flex flex-column gap-3">
                    <!-- Las tarjetas de chequeos se inyectan aquí -->
                </div>

            </div>
        `;
    },

    /**
     * Renderiza una tarjeta individual de chequeo
     */
    renderCheckCard(check, isExpanded = false) {
        const hasError = check.error || (check.result && !check.result.success);
        const isSuccess = check.result && check.result.success;
        const count = check.result?.count || (hasError ? 1 : 0);

        let borderClass = 'border-0';
        let bgHeader = '#ffffff';
        if (hasError) {
            borderClass = 'border-danger border-opacity-25';
            bgHeader = '#fffafb';
        } else if (isSuccess) {
            borderClass = 'border-success border-opacity-25';
        }

        return `
            <div class="card ${borderClass} shadow-sm overflow-hidden" id="check-card-${check.id}" style="border-radius: 12px; background: #ffffff;">
                <div class="card-body p-3" style="background-color: ${bgHeader};">
                    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                        <div class="d-flex align-items-start gap-3">
                            <div class="d-flex flex-column align-items-center justify-content-center p-2 rounded-3 text-center" style="min-width: 70px; background-color: #f1f5f9;">
                                <span class="fw-bolder" style="font-size: 12px; color: #475569;">${escapeHtml(check.id)}</span>
                                <span class="text-muted" style="font-size: 10px; text-transform: uppercase;">${escapeHtml(check.category)}</span>
                            </div>
                            <div>
                                <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                                    ${this.getSeverityBadge(check.severity)}
                                    <h5 class="card-title mb-0 fw-bold" style="font-size: 15px; color: #0f172a;">
                                        ${escapeHtml(check.title)}
                                    </h5>
                                </div>
                                <p class="card-text text-muted mb-0" style="font-size: 13px;">
                                    ${escapeHtml(check.description || '')}
                                </p>
                            </div>
                        </div>

                        <div class="d-flex align-items-center gap-2 align-self-end align-self-md-center">
                            ${this.getStatusBadge(check)}

                            <!-- Botón de re-ejecutar este chequeo -->
                            <button class="btn btn-sm btn-light border btn-rerun-check" data-id="${check.id}" title="Re-ejecutar este chequeo" style="border-radius: 6px;">
                                <i class="bi bi-arrow-repeat"></i>
                            </button>

                            <!-- Botón de expandir/colapsar -->
                            ${hasError ? `
                                <button class="btn btn-sm ${isExpanded ? 'btn-danger text-white' : 'btn-outline-danger'} btn-toggle-details" data-id="${check.id}" style="border-radius: 6px; font-weight: 600; font-size: 12px;">
                                    <i class="bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} me-1"></i>
                                    ${isExpanded ? 'Ocultar Detalle' : `Ver ${count} Afectado(s)`}
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- DETALLE EXPANDIBLE -->
                ${hasError ? `
                    <div class="card-footer bg-white border-top p-3" id="check-details-${check.id}" style="display: ${isExpanded ? 'block' : 'none'};">
                        ${this.renderCheckDetails(check)}
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Renderiza el contenido de detalles de un chequeo con discrepancias
     */
    renderCheckDetails(check) {
        if (check.error) {
            return `
                <div class="alert alert-warning mb-0" style="font-size: 13px;">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    <strong>Error en la consulta:</strong> ${escapeHtml(check.error.message || String(check.error))}
                </div>
            `;
        }

        if (!check.result || !check.result.data || check.result.data.length === 0) {
            return `<div class="text-muted p-2" style="font-size: 13px;">No hay registros detallados disponibles.</div>`;
        }

        // Renderizado especial para Reconciliación de Inventario (Check INV-004)
        if (check.isSpecialUi && check.result.meta) {
            return this.renderInventarioReconciliacionDetails(check.result);
        }

        const columns = check.result.columns || Object.keys(check.result.data[0] || {});
        const data = check.result.data;

        return `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-danger fw-semibold" style="font-size: 13px;">
                    <i class="bi bi-info-circle me-1"></i> Mostrando ${data.length} registro(s) con discrepancia contable
                </span>
                <span class="text-muted" style="font-size: 12px;">
                    Haz clic en los enlaces para navegar directamente al registro
                </span>
            </div>
            <div class="table-responsive border rounded-3 bg-white" style="max-height: 400px;">
                <table class="table table-sm table-hover align-middle mb-0" style="font-size: 12px;">
                    <thead class="table-light sticky-top">
                        <tr>
                            ${columns.map(col => `<th class="py-2 px-3 text-uppercase fw-bold text-muted" style="font-size: 11px;">${escapeHtml(this.formatearNombreColumna(col))}</th>`).join('')}
                            <th class="py-2 px-3 text-end fw-bold text-muted" style="font-size: 11px;">ACCIÓN</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(row => `
                            <tr>
                                ${columns.map(col => `<td class="py-2 px-3">${this.renderCelda(col, row[col], row, check.entityType)}</td>`).join('')}
                                <td class="py-2 px-3 text-end">${this.renderAccionFila(row, check.entityType)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Renderiza celdas con formateo inteligente según tipo de dato
     */
    renderCelda(colName, val, row, entityType) {
        if (val === null || val === undefined) return '<span class="text-muted fst-italic">null</span>';

        const colLower = colName.toLowerCase();

        // Moneda
        if (colLower.includes('total') || colLower.includes('saldo') || colLower.includes('monto') || colLower.includes('costo') || colLower.includes('precio') || colLower.includes('perdida') || colLower.includes('diferencia') || colLower.includes('suma_detalles')) {
            const num = parseFloat(val);
            if (!isNaN(num)) {
                const color = colLower.includes('diferencia') || colLower.includes('perdida') || colLower.includes('faltante') ? 'text-danger fw-bold' : '';
                return `<span class="${color}">${this.formatMoney(num)}</span>`;
            }
        }

        // Fechas
        if (colLower.includes('fecha')) {
            return `<span>${this.formatFecha(val)}</span>`;
        }

        // Porcentajes
        if (colLower.includes('margen') || colLower.includes('porcentaje')) {
            const num = parseFloat(val);
            return `<span class="${num < 0 ? 'text-danger fw-bold' : ''}">${num.toFixed(1)}%</span>`;
        }

        // Números enteros o SKUs
        if (colLower === 'sku') {
            return `<span class="badge bg-light text-dark border fw-medium px-2 py-1">${escapeHtml(String(val))}</span>`;
        }

        return `<span>${escapeHtml(String(val))}</span>`;
    },

    /**
     * Renderiza enlaces de acción rápida contextuales
     */
    renderAccionFila(row, entityType) {
        if (entityType === 'factura') {
            const num = row.numero || row.factura_numero || row.id;
            return `
                <a href="#/ingresos/facturas" class="btn btn-xs btn-outline-primary py-0 px-2" style="font-size: 11px; border-radius: 4px;" title="Ver en Facturación">
                    <i class="bi bi-box-arrow-up-right me-1"></i>Factura #${num}
                </a>
            `;
        }
        if (entityType === 'producto') {
            const sku = row.sku || row.producto_id;
            return `
                <a href="#/inventario/items" class="btn btn-xs btn-outline-primary py-0 px-2" style="font-size: 11px; border-radius: 4px;" title="Ver en Inventario">
                    <i class="bi bi-box-arrow-up-right me-1"></i>Producto ${sku}
                </a>
            `;
        }
        if (entityType === 'contacto') {
            return `
                <a href="#/contactos" class="btn btn-xs btn-outline-primary py-0 px-2" style="font-size: 11px; border-radius: 4px;" title="Ver en Contactos">
                    <i class="bi bi-box-arrow-up-right me-1"></i>Ver Contactos
                </a>
            `;
        }
        if (entityType === 'pago') {
            return `
                <a href="#/ingresos/pagos-recibidos" class="btn btn-xs btn-outline-primary py-0 px-2" style="font-size: 11px; border-radius: 4px;" title="Ver Pagos">
                    <i class="bi bi-box-arrow-up-right me-1"></i>Ver Pago
                </a>
            `;
        }
        return '-';
    },

    /**
     * Renderiza el componente especial de reconciliación de inventario
     */
    renderInventarioReconciliacionDetails(result) {
        const discrepancias = result.data || [];
        const meta = result.meta || {};

        return `
            <div class="mb-3">
                <div class="d-flex align-items-center gap-2 mb-2">
                    <span class="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle px-2 py-1">
                        <i class="bi bi-exclamation-triangle-fill me-1"></i>${discrepancias.length} con discrepancia
                    </span>
                    <span class="badge bg-success bg-opacity-10 text-success border border-success-subtle px-2 py-1">
                        <i class="bi bi-check-circle-fill me-1"></i>${meta.totalVerificados || 0} conformes
                    </span>
                    <span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle px-2 py-1">
                        <i class="bi bi-info-circle-fill me-1"></i>${meta.sinCheckpoint || 0} sin checkpoint histórico
                    </span>
                </div>
                <p class="text-muted mb-2" style="font-size: 12px;">
                    Productos cuyo stock actual no cuadra con la fórmula: <code>Stock Actual = Checkpoint + Ajustes - Ventas</code>.
                </p>
                <div class="table-responsive border rounded-3 bg-white" style="max-height: 350px;">
                    <table class="table table-sm table-hover align-middle mb-0" style="font-size: 12px;">
                        <thead class="table-light sticky-top">
                            <tr>
                                <th>SKU</th>
                                <th>Nombre</th>
                                <th class="text-center">Checkpoint</th>
                                <th class="text-center">Fecha</th>
                                <th class="text-center">Ventas Posteriores</th>
                                <th class="text-center">Esperado</th>
                                <th class="text-center">Actual</th>
                                <th class="text-danger text-center">Discrepancia</th>
                                <th class="text-end">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${discrepancias.map(d => `
                                <tr>
                                    <td><span class="badge bg-light text-dark border">${escapeHtml(d.sku || '')}</span></td>
                                    <td>${escapeHtml(d.nombre || '')}</td>
                                    <td class="text-center">${d.checkpoint}</td>
                                    <td class="text-center">${this.formatFecha(d.fecha_checkpoint)}</td>
                                    <td class="text-center">${d.vendido_despues}</td>
                                    <td class="text-center fw-medium">${d.esperado}</td>
                                    <td class="text-center fw-bold">${d.actual}</td>
                                    <td class="text-center text-danger fw-bolder">${d.discrepancia}</td>
                                    <td class="text-end">
                                        <a href="#/inventario/items" class="btn btn-xs btn-outline-primary py-0 px-2" style="font-size: 11px;">
                                            <i class="bi bi-box-arrow-up-right me-1"></i>Ajustar
                                        </a>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    formatearNombreColumna(col) {
        return col
            .replace(/_/g, ' ')
            .replace(/\bid\b/gi, 'ID')
            .replace(/\brpc\b/gi, 'RPC');
    }
};
