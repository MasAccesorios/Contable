// js/modules/vendedores/vendedores.templates.js
// Capa de Presentación HTML, Componentes Ergonómicos y Reportes Inteligentes 360°
// Homologado 100% con Gastos Operativos y crudFinanciero.js

import { escapeHtml } from '../../shared/formatters.js';
import { VendedoresData } from './vendedores.data.js';

export const VendedoresTemplates = {
    /**
     * Formateadores numéricos y de moneda
     */
    formatMoney(val) {
        if (val === null || val === undefined || val === '') return '$ 0';
        const num = parseFloat(val) || 0;
        return '$ ' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

    formatPercent(val) {
        if (val === null || val === undefined) return '0%';
        const num = parseFloat(val) || 0;
        return (Number.isInteger(num) ? num.toString() : num.toFixed(1)) + '%';
    },

    getEstadoBadge(estado) {
        const esActivo = estado === 'activo';
        return `
            <span class="badge ${esActivo ? 'bg-success text-success bg-opacity-10 border border-success-subtle' : 'bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle'} rounded-pill fw-medium" style="font-size: 11px; padding: 4px 9px;">
                <i class="bi ${esActivo ? 'bi-check-circle-fill' : 'bi-pause-circle-fill'} me-1"></i>${esActivo ? 'Activo' : 'Inactivo'}
            </span>
        `;
    },

    getComisionBadge(montoPendiente) {
        const num = Number(montoPendiente || 0);
        if (num > 0) {
            return `
                <span class="payment-pending-badge" title="Comisión pendiente por pagar">
                    <i class="bi bi-clock-history"></i> Pendiente: ${this.formatMoney(num)}
                </span>
            `;
        }
        return `
            <span class="payment-reconciled-badge" title="Al día, sin comisiones pendientes">
                <i class="bi bi-check-circle-fill"></i> Al día
            </span>
        `;
    },

    /**
     * Renderiza el Layout Principal del Módulo Homologado con Gastos Operativos
     */
    renderLayout(state = {}) {
        const kpis = state.kpis || {
            totalVendido: 0,
            comisionPendiente: 0,
            comisionPagada: 0,
            totalComisiones: 0,
            tasaLiquidacion: 0,
            vendedoresActivos: 0,
            vendedoresInactivos: 0,
            totalVendedores: 0,
            topVendedor: null,
            tabCounts: { todas: 0, pendientes: 0, al_dia: 0, top: 0, inactivos: 0 }
        };

        const counts = kpis.tabCounts || { todas: 0, pendientes: 0, al_dia: 0, top: 0, inactivos: 0 };
        const currentTab = state.currentTab || 'todas';
        const currentView = state.currentView || 'lista';
        const insights = state.insights || { recomendaciones: [] };

        return `
            <div class="dash-layout p-4" style="max-width: 1240px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                
                <!-- TOP BAR INSTITUCIONAL (ESTILO GASTOS OPERATIVOS) -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <a href="#" onclick="event.preventDefault(); window.history.length > 2 ? window.history.back() : window.location.hash = '#/dashboard';" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body); border-radius: 8px;" title="Volver">
                                <i class="bi bi-arrow-left"></i>
                            </a>
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Vendedores y Comisiones</h2>
                            <span class="badge" style="background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #bfdbfe;">
                                <i class="bi bi-briefcase me-1"></i> Fuerza Comercial 360°
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Monitoreo de ventas cobradas, liquidación de comisiones, desempeño y diagnóstico inteligente del equipo comercial.
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Toggle de Vistas: Lista vs Analítica -->
                        <div class="btn-group p-1 bg-light border rounded-3" role="group">
                            <button type="button" class="btn btn-sm ${currentView !== 'grafico' ? 'btn-white bg-white shadow-xs fw-bold' : 'btn-light border-0 text-muted'}" id="btn-view-lista" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-table me-1"></i> Lista
                            </button>
                            <button type="button" class="btn btn-sm ${currentView === 'grafico' ? 'btn-white bg-white shadow-xs fw-bold text-primary' : 'btn-light border-0 text-muted'}" id="btn-view-grafico" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-bar-chart me-1"></i> Analítica
                            </button>
                        </div>

                        <!-- Botón Exportar Excel -->
                        <button id="btn-export-excel" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 600; font-size: 13px; border-radius: 8px;" title="Descargar en Excel">
                            <i class="bi bi-file-earmark-excel text-success me-1"></i> Exportar
                        </button>

                        <!-- Botón Refrescar -->
                        <button id="btn-refresh-vendedores" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>

                        <!-- Botón Nuevo Vendedor -->
                        <button id="btn-nuevo-vendedor-top" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-plus-lg"></i> Nuevo Vendedor
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS (ESTILO GASTOS OPERATIVOS) -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Ventas Totales Pagadas -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Ventas Cobradas</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-cash-stack"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-total-vendido" style="font-size: 22px;">
                                ${this.formatMoney(kpis.totalVendido)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill fw-bold px-2 py-0">Pagadas</span> Base de comisiones
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Comisiones Pendientes por Liquidar -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Comisiones Pendientes</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-clock-history"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold ${kpis.comisionPendiente > 0 ? 'text-warning' : 'text-success'} tnum" id="kpi-comision-pendiente" style="font-size: 22px;">
                                ${this.formatMoney(kpis.comisionPendiente)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <span class="badge ${kpis.comisionPendiente > 0 ? 'bg-warning-subtle text-warning border border-warning-subtle' : 'bg-success-subtle text-success border border-success-subtle'} rounded-pill fw-bold px-2 py-0">
                                    ${counts.pendientes} por liquidar
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Comisiones Pagadas / Desembolsadas -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Comisiones Pagadas</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-check2-circle"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" id="kpi-comision-pagada" style="font-size: 22px;">
                                ${this.formatMoney(kpis.comisionPagada)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <strong>${Math.round(kpis.tasaLiquidacion)}%</strong> tasa de liquidación
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Fuerza de Ventas & Top Performer -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Equipo Comercial</span>
                                <div class="payment-kpi-icon" style="background-color: #f3e8ff; color: #7e22ce;">
                                    <i class="bi bi-people-fill"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-fuerza-ventas" style="font-size: 22px;">
                                ${kpis.vendedoresActivos} <span style="font-size: 13px; font-weight: 500; color: #64748b;">activos</span>
                            </div>
                            <div class="mt-2 text-truncate text-muted" style="font-size: 11px;" title="${kpis.topVendedor ? escapeHtml(kpis.topVendedor.nombre) : 'Sin ventas'}">
                                <i class="bi bi-trophy-fill text-warning me-1"></i> Top: <strong>${kpis.topVendedor ? escapeHtml(kpis.topVendedor.nombre) : 'N/A'}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- BANNER DE INSIGHTS COMERCIALES INTELIGENTES -->
                ${this.renderInsightsBanner(insights)}

                <!-- BARRA DE PESTAÑAS Y BUSCADOR (ESTILO GASTOS OPERATIVOS) -->
                <div class="dash-table-container mb-4">
                    <div class="p-3 border-bottom d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3" style="background-color: #ffffff;">
                        <!-- Segmented Tabs Bar -->
                        <div class="payment-tabs-bar" role="tablist">
                            <button type="button" class="payment-tab-btn ${currentTab === 'todas' ? 'active' : ''}" data-tab="todas">
                                <i class="bi bi-people"></i> Todos <span class="payment-tab-badge">${counts.todas}</span>
                            </button>
                            <button type="button" class="payment-tab-btn tab-warning ${currentTab === 'pendientes' ? 'active' : ''}" data-tab="pendientes">
                                <i class="bi bi-clock-history"></i> Por Liquidar <span class="payment-tab-badge">${counts.pendientes}</span>
                            </button>
                            <button type="button" class="payment-tab-btn ${currentTab === 'al_dia' ? 'active' : ''}" data-tab="al_dia">
                                <i class="bi bi-check-circle"></i> Al Día <span class="payment-tab-badge">${counts.al_dia}</span>
                            </button>
                            <button type="button" class="payment-tab-btn ${currentTab === 'top' ? 'active' : ''}" data-tab="top">
                                <i class="bi bi-trophy"></i> Top Ventas <span class="payment-tab-badge">${counts.top}</span>
                            </button>
                            <button type="button" class="payment-tab-btn ${currentTab === 'inactivos' ? 'active' : ''}" data-tab="inactivos">
                                <i class="bi bi-pause-circle"></i> Inactivos <span class="payment-tab-badge">${counts.inactivos}</span>
                            </button>
                        </div>

                        <!-- Omnibox Search -->
                        <div class="ds-search-container" style="min-width: 280px; max-width: 360px;">
                            <i class="bi bi-search"></i>
                            <input type="text" id="search-vendedores" class="ds-search-input" placeholder="Buscar por vendedor o teléfono..." value="${escapeHtml(state.searchQuery || '')}">
                        </div>
                    </div>

                    <!-- CONTENEDOR DE LA TABLA DE VENDEDORES -->
                    <div id="vendedores-table-container" style="display: ${currentView === 'lista' ? 'block' : 'none'};">
                        ${this.renderTabla(state.vendedoresFiltrados || [], kpis.totalVendido)}
                    </div>

                    <!-- CONTENEDOR DE ANALÍTICA INTELIGENTE -->
                    <div id="vendedores-analytics-container" style="display: ${currentView === 'grafico' ? 'block' : 'none'}; padding: 24px;">
                        ${this.renderAnalitica(state.vendedores || [], insights)}
                    </div>
                </div>

                <!-- SLIDE-OVER DRAWER LATERAL 360° -->
                <div id="vendedor-drawer-backdrop" class="payment-drawer-backdrop"></div>
                <div id="drawer-vendedor-360" class="payment-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-vendedor-title">
                    <div class="payment-drawer-header">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-person-badge text-primary fs-5"></i>
                            <h5 id="drawer-vendedor-title" class="fw-bold mb-0" style="color: #0f172a; font-size: 16px;">Detalle Comercial 360°</h5>
                        </div>
                        <button type="button" class="btn-close" id="btn-close-drawer" aria-label="Cerrar"></button>
                    </div>
                    <div class="payment-drawer-body" id="drawer-vendedor-body">
                        <!-- Contenido dinámico inyectado al abrir -->
                    </div>
                    <div class="payment-drawer-footer">
                        <button type="button" class="btn btn-light border" id="btn-drawer-cerrar-footer" style="font-size: 13px; font-weight: 600;">Cerrar</button>
                        <button type="button" class="btn btn-primary-action" id="btn-drawer-editar-vendedor" style="font-size: 13px; font-weight: 600;">
                            <i class="bi bi-pencil me-1"></i> Editar Vendedor
                        </button>
                    </div>
                </div>

                <!-- CONTENEDORES PARA MODALES -->
                <div id="vendedor-modals-root"></div>
            </div>
        `;
    },

    /**
     * Banner de Diagnóstico Comercial Inteligente
     */
    renderInsightsBanner(insights = {}) {
        const recomendaciones = insights.recomendaciones || [];
        if (recomendaciones.length === 0) return '';

        return `
            <div class="mb-4 p-3 bg-white border rounded-3 shadow-xs" style="border-left: 4px solid #2563eb !important;">
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-stars text-primary fs-5"></i>
                        <span class="fw-bold" style="font-size: 13px; color: #0f172a;">Diagnóstico e Inteligencia Comercial</span>
                    </div>
                    <span class="badge bg-light text-secondary border rounded-pill" style="font-size: 10px;">IA Advisor</span>
                </div>
                <div class="row g-2">
                    ${recomendaciones.map(r => `
                        <div class="col-12 col-md-${recomendaciones.length > 1 ? '6' : '12'}">
                            <div class="p-2 rounded bg-light bg-opacity-50 border border-light-subtle d-flex align-items-start gap-2">
                                <i class="bi ${r.icono} ${r.clase} mt-1 fs-6"></i>
                                <div>
                                    <div class="fw-semibold" style="font-size: 12px; color: #1e293b;">${escapeHtml(r.titulo)}</div>
                                    <div class="text-muted" style="font-size: 11px; line-height: 1.4;">${escapeHtml(r.mensaje)}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Tabla Fluida sin scrollbar horizontal ni desbordamiento
     */
    renderTabla(vendedores = [], totalVentasGlobal = 0) {
        if (!Array.isArray(vendedores) || vendedores.length === 0) {
            return `
                <div class="text-center py-5">
                    <div class="d-inline-flex p-3 rounded-circle bg-light text-muted mb-3">
                        <i class="bi bi-people fs-1"></i>
                    </div>
                    <h6 class="fw-bold text-dark mb-1">No se encontraron vendedores</h6>
                    <p class="text-muted mb-3" style="font-size: 13px;">No hay registros coincidentes con los filtros o término de búsqueda aplicado.</p>
                </div>
            `;
        }

        let sumVendido = 0;
        let sumPagada = 0;
        let sumPendiente = 0;

        const rowsHtml = vendedores.map(v => {
            const avatar = VendedoresData.getVendorAvatar(v.nombre);
            const vendido = Number(v.total_vendido || 0);
            const pagada = Number(v.comision_pagada || 0);
            const pendiente = Number(v.comision_pendiente || 0);
            sumVendido += vendido;
            sumPagada += pagada;
            sumPendiente += pendiente;

            // Porcentaje de cuota respecto al equipo
            const share = totalVentasGlobal > 0 ? Math.round((vendido / totalVentasGlobal) * 100) : 0;
            const tienePendientes = pendiente > 0;

            const telClean = String(v.telefono || '').replace(/\D/g, '');
            const waUrl = telClean.length >= 7 ? `https://wa.me/57${telClean}` : null;

            return `
                <tr class="payment-row align-middle" data-id="${v.id}" style="border-bottom: 1px solid #f1f5f9; cursor: pointer;">
                    <!-- Columna 1: Vendedor & Avatar -->
                    <td class="py-3 ps-3">
                        <div class="d-flex align-items-center gap-3">
                            <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color};">
                                ${avatar.initials}
                            </div>
                            <div>
                                <div class="fw-bold text-dark" style="font-size: 13.5px;">${escapeHtml(v.nombre)}</div>
                                <div class="d-flex align-items-center gap-2 text-muted" style="font-size: 11px;">
                                    ${v.telefono ? `
                                        <span><i class="bi bi-telephone me-1"></i>${escapeHtml(v.telefono)}</span>
                                        ${waUrl ? `
                                            <a href="${waUrl}" target="_blank" rel="noopener" class="text-success text-decoration-none" title="Escribir por WhatsApp" onclick="event.stopPropagation();">
                                                <i class="bi bi-whatsapp"></i>
                                            </a>
                                        ` : ''}
                                    ` : '<span class="text-secondary opacity-75">Sin teléfono</span>'}
                                </div>
                            </div>
                        </div>
                    </td>

                    <!-- Columna 2: Porcentaje de Comisión -->
                    <td class="py-3 text-center">
                        <span class="badge bg-light text-dark border fw-bold" style="font-size: 12px; padding: 5px 10px; border-radius: 6px;">
                            ${this.formatPercent(v.porcentaje_comision)}
                        </span>
                    </td>

                    <!-- Columna 3: Total Vendido Pagado + Barra de participación -->
                    <td class="py-3 text-end">
                        <div class="fw-bold text-dark tnum" style="font-size: 13px;">${this.formatMoney(vendido)}</div>
                        <div class="d-flex align-items-center justify-content-end gap-1 mt-1">
                            <div class="progress" style="width: 50px; height: 4px; background-color: #e2e8f0;">
                                <div class="progress-bar bg-primary" role="progressbar" style="width: ${share}%;" aria-valuenow="${share}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <span class="text-muted" style="font-size: 10px;">${share}%</span>
                        </div>
                    </td>

                    <!-- Columna 4: Comisión Pagada -->
                    <td class="py-3 text-end">
                        <span class="fw-semibold text-success tnum" style="font-size: 13px;">${this.formatMoney(pagada)}</span>
                    </td>

                    <!-- Columna 5: Comisión Pendiente (Semáforo) -->
                    <td class="py-3 text-end">
                        ${this.getComisionBadge(pendiente)}
                    </td>

                    <!-- Columna 6: Estado -->
                    <td class="py-3 text-center">
                        ${this.getEstadoBadge(v.estado)}
                    </td>

                    <!-- Columna 7: Acciones Rápidas -->
                    <td class="py-3 pe-3 text-end" style="width: 140px;">
                        <div class="d-flex align-items-center justify-content-end gap-1">
                            ${tienePendientes ? `
                                <button type="button" class="btn btn-sm btn-outline-warning btn-quick-pagar py-1 px-2 shadow-xs" data-id="${v.id}" data-nombre="${escapeHtml(v.nombre)}" data-pendiente="${pendiente}" title="Liquidar comisiones" style="font-size: 11px; border-radius: 6px;">
                                    <i class="bi bi-wallet2 me-1"></i> Pagar
                                </button>
                            ` : ''}
                            <button type="button" class="btn btn-sm btn-light border py-1 px-2 btn-ver-drawer shadow-xs" data-id="${v.id}" title="Inspección 360°" style="font-size: 11px; border-radius: 6px;">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-light border py-1 px-2 btn-editar-vendedor shadow-xs" data-id="${v.id}" data-nombre="${escapeHtml(v.nombre)}" data-telefono="${escapeHtml(v.telefono || '')}" data-porcentaje="${v.porcentaje_comision}" data-estado="${v.estado}" title="Editar vendedor" style="font-size: 11px; border-radius: 6px;">
                                <i class="bi bi-pencil"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="table-responsive" style="overflow-x: hidden;">
                <table class="table table-hover align-middle mb-0" style="font-size: 13px;">
                    <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <tr class="text-muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                            <th class="py-3 ps-3 fw-bold">Vendedor</th>
                            <th class="py-3 text-center fw-bold">% Comisión</th>
                            <th class="py-3 text-end fw-bold">Total Vendido (Cobrado)</th>
                            <th class="py-3 text-end fw-bold">Comisión Pagada</th>
                            <th class="py-3 text-end fw-bold">Comisión Pendiente</th>
                            <th class="py-3 text-center fw-bold">Estado</th>
                            <th class="py-3 pe-3 text-end fw-bold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot style="background-color: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: 700;">
                        <tr class="align-middle">
                            <td class="py-3 ps-3 text-dark">
                                Consolidado (${vendedores.length} vendedores)
                            </td>
                            <td class="py-3 text-center text-muted">---</td>
                            <td class="py-3 text-end text-dark tnum">${this.formatMoney(sumVendido)}</td>
                            <td class="py-3 text-end text-success tnum">${this.formatMoney(sumPagada)}</td>
                            <td class="py-3 text-end ${sumPendiente > 0 ? 'text-warning' : 'text-success'} tnum">${this.formatMoney(sumPendiente)}</td>
                            <td class="py-3 text-center text-muted">---</td>
                            <td class="py-3 pe-3 text-end text-muted">---</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    /**
     * Renderiza la Sección Analítica Inteligente con Chart.js y Diagnóstico
     */
    renderAnalitica(vendedores = [], insights = {}) {
        return `
            <div class="row g-4">
                <!-- Gráfica 1: Ranking de Ventas por Vendedor -->
                <div class="col-12 col-lg-7">
                    <div class="p-3 bg-white border rounded-3 shadow-xs h-100">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold text-dark mb-0" style="font-size: 14px;">
                                <i class="bi bi-bar-chart-fill text-primary me-2"></i>Ranking de Ventas Cobradas por Vendedor
                            </h6>
                            <span class="badge bg-light text-muted border" style="font-size: 11px;">Moneda: COP</span>
                        </div>
                        <div style="position: relative; height: 260px; width: 100%;">
                            <canvas id="chartVentasVendedores"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Gráfica 2: Desglose de Comisiones (Pagadas vs Pendientes) -->
                <div class="col-12 col-lg-5">
                    <div class="p-3 bg-white border rounded-3 shadow-xs h-100">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold text-dark mb-0" style="font-size: 14px;">
                                <i class="bi bi-pie-chart-fill text-success me-2"></i>Distribución de Comisiones
                            </h6>
                            <span class="badge bg-light text-muted border" style="font-size: 11px;">Pagadas vs Pendientes</span>
                        </div>
                        <div style="position: relative; height: 260px; width: 100%;">
                            <canvas id="chartComisionesVendedores"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Tarjetas de Diagnóstico de Desempeño Comercial -->
                <div class="col-12">
                    <div class="row g-3">
                        <div class="col-12 col-md-4">
                            <div class="p-3 bg-light rounded-3 border">
                                <div class="text-muted mb-1" style="font-size: 11px; text-transform: uppercase; font-weight: 700;">Top Performer</div>
                                <div class="fw-bold text-primary fs-5">${insights.topPerformer ? escapeHtml(insights.topPerformer.nombre) : 'N/A'}</div>
                                <div class="text-muted mt-1" style="font-size: 12px;">
                                    ${insights.topPerformer ? `Aporta el <strong>${insights.topPerformer.porcentajeTotal}%</strong> de las ventas cobradas.` : 'Sin datos comerciales.'}
                                </div>
                            </div>
                        </div>

                        <div class="col-12 col-md-4">
                            <div class="p-3 bg-light rounded-3 border">
                                <div class="text-muted mb-1" style="font-size: 11px; text-transform: uppercase; font-weight: 700;">Tasa de Cumplimiento</div>
                                <div class="fw-bold text-success fs-5">${insights.tasaGlobalCobro || 0}%</div>
                                <div class="text-muted mt-1" style="font-size: 12px;">De las comisiones devengadas ya han sido desembolsadas.</div>
                            </div>
                        </div>

                        <div class="col-12 col-md-4">
                            <div class="p-3 bg-light rounded-3 border">
                                <div class="text-muted mb-1" style="font-size: 11px; text-transform: uppercase; font-weight: 700;">Prioridad de Liquidación</div>
                                <div class="fw-bold ${insights.mayorPendiente ? 'text-warning' : 'text-success'} fs-5">
                                    ${insights.mayorPendiente ? escapeHtml(insights.mayorPendiente.nombre) : 'Todo al día'}
                                </div>
                                <div class="text-muted mt-1" style="font-size: 12px;">
                                    ${insights.mayorPendiente ? `Tiene <strong>${this.formatMoney(insights.mayorPendiente.monto)}</strong> pendientes.` : 'Cero saldos pendientes.'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Renderiza el contenido del Drawer Lateral 360°
     */
    renderDrawerContent(vendedor, comisiones = [], cuentas = []) {
        if (!vendedor) {
            return `
                <div class="text-center py-5">
                    <p class="text-muted">No se pudo cargar la información del vendedor.</p>
                </div>
            `;
        }

        const avatar = VendedoresData.getVendorAvatar(vendedor.nombre);
        const listaComisiones = (Array.isArray(comisiones) ? comisiones : []).filter(c => !c.vendedor_id || String(c.vendedor_id) === String(vendedor.id));
        const pendientes = listaComisiones.filter(c => c.estado === 'pendiente');
        const pagadas = listaComisiones.filter(c => c.estado === 'pagada');

        const totalPendiente = pendientes.reduce((acc, c) => acc + Number(c.monto || 0), 0);
        const totalPagado = pagadas.reduce((acc, c) => acc + Number(c.monto || 0), 0);

        const telClean = String(vendedor.telefono || '').replace(/\D/g, '');
        const waUrl = telClean.length >= 7 ? `https://wa.me/57${telClean}` : null;

        return `
            <!-- HEADER DEL VENDEDOR EN EL DRAWER -->
            <div class="d-flex align-items-center gap-3 pb-3 mb-3 border-bottom">
                <div class="payment-avatar" style="width: 48px; height: 48px; font-size: 18px; background-color: ${avatar.bg}; color: ${avatar.color};">
                    ${avatar.initials}
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex align-items-center justify-content-between">
                        <h5 class="fw-bold text-dark mb-0" style="font-size: 17px;">${escapeHtml(vendedor.nombre)}</h5>
                        ${this.getEstadoBadge(vendedor.estado)}
                    </div>
                    <div class="d-flex flex-wrap align-items-center gap-3 mt-1 text-muted" style="font-size: 12px;">
                        <span><i class="bi bi-percent me-1 text-primary"></i>${this.formatPercent(vendedor.porcentaje_comision)} comisión</span>
                        ${vendedor.telefono ? `
                            <span><i class="bi bi-telephone me-1"></i>${escapeHtml(vendedor.telefono)}</span>
                            ${waUrl ? `
                                <a href="${waUrl}" target="_blank" rel="noopener" class="text-success text-decoration-none fw-semibold">
                                    <i class="bi bi-whatsapp me-1"></i>WhatsApp
                                </a>
                            ` : ''}
                        ` : '<span class="text-secondary opacity-75">Sin teléfono</span>'}
                    </div>
                </div>
            </div>

            <!-- MINI METRIC CARDS -->
            <div class="row g-2 mb-4">
                <div class="col-4">
                    <div class="p-2 rounded bg-light border text-center">
                        <div class="text-muted" style="font-size: 10px; text-transform: uppercase;">Total Vendido</div>
                        <div class="fw-bold text-dark tnum" style="font-size: 13px;">${this.formatMoney(vendedor.total_vendido)}</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="p-2 rounded bg-light border text-center">
                        <div class="text-muted" style="font-size: 10px; text-transform: uppercase;">Pagado</div>
                        <div class="fw-bold text-success tnum" style="font-size: 13px;">${this.formatMoney(totalPagado)}</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="p-2 rounded bg-light border text-center">
                        <div class="text-muted" style="font-size: 10px; text-transform: uppercase;">Pendiente</div>
                        <div class="fw-bold ${totalPendiente > 0 ? 'text-warning' : 'text-success'} tnum" style="font-size: 13px;">${this.formatMoney(totalPendiente)}</div>
                    </div>
                </div>
            </div>

            <!-- BOTÓN ACCIÓN DE LIQUIDACIÓN MASIVA -->
            ${pendientes.length > 0 ? `
                <div class="p-3 mb-4 rounded-3 border bg-warning bg-opacity-10 d-flex align-items-center justify-content-between">
                    <div>
                        <div class="fw-bold text-dark" style="font-size: 13px;">Comisiones acumuladas</div>
                        <div class="text-muted" style="font-size: 11px;">${pendientes.length} facturas por liquidar (${this.formatMoney(totalPendiente)})</div>
                    </div>
                    <button type="button" class="btn btn-sm btn-primary-action shadow-xs btn-liquidar-todo" data-vendedor-id="${vendedor.id}" data-total="${totalPendiente}" style="font-size: 12px; font-weight: 600;">
                        <i class="bi bi-wallet2 me-1"></i> Liquidar Todo
                    </button>
                </div>
            ` : ''}

            <!-- LISTA DETALLADA DE COMISIONES -->
            <div>
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <h6 class="fw-bold text-dark mb-0" style="font-size: 13px;">
                        <i class="bi bi-receipt me-1 text-primary"></i>Historial de Comisiones (${listaComisiones.length})
                    </h6>
                    <span class="text-muted" style="font-size: 11px;">Por ventas pagadas</span>
                </div>

                ${listaComisiones.length > 0 ? `
                    <div class="list-group list-group-flush border rounded-2" style="font-size: 12.5px;">
                        ${listaComisiones.map(c => {
                            const esPendiente = c.estado === 'pendiente';
                            const numFactura = c.facturas?.numero ? `#${c.facturas.numero}` : `#${c.factura_id}`;
                            const fechaFactura = c.facturas?.fecha || '';
                            const clienteNombre = c.facturas?.clientes?.nombre || '';

                            return `
                                <div class="list-group-item d-flex align-items-center justify-content-between p-2.5">
                                    <div>
                                        <div class="d-flex align-items-center gap-2">
                                            <span class="payment-invoice-tag">${escapeHtml(numFactura)}</span>
                                            <span class="fw-bold text-dark tnum">${this.formatMoney(c.monto)}</span>
                                        </div>
                                        <div class="text-muted mt-0.5" style="font-size: 11px;">
                                            ${fechaFactura ? `${escapeHtml(fechaFactura)} • ` : ''}
                                            ${clienteNombre ? `${escapeHtml(clienteNombre)}` : 'Venta directa'}
                                        </div>
                                    </div>
                                    <div class="d-flex align-items-center gap-2">
                                        ${esPendiente ? `
                                            <span class="badge bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle rounded-pill" style="font-size: 10px; padding: 3px 7px;">
                                                Pendiente
                                            </span>
                                            <button type="button" class="btn btn-sm btn-outline-success btn-pagar-comision-single py-1 px-2" data-id="${c.id}" data-monto="${c.monto}" data-factura="${escapeHtml(numFactura)}" style="font-size: 11px; border-radius: 6px;" title="Pagar comisión">
                                                Pagar
                                            </button>
                                        ` : `
                                            <span class="badge bg-success text-success bg-opacity-10 border border-success-subtle rounded-pill" style="font-size: 10px; padding: 3px 7px;">
                                                Pagada
                                            </span>
                                            <span class="text-muted" style="font-size: 10px;">${escapeHtml(c.fecha_pago || '')}</span>
                                        `}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <div class="text-center py-4 bg-light rounded border text-muted" style="font-size: 12px;">
                        Este vendedor aún no registra comisiones generadas.
                    </div>
                `}
            </div>
        `;
    },

    /**
     * Modal para Crear o Editar Vendedor
     */
    renderModalVendedor(vendedor = null) {
        const esEdicion = !!vendedor;
        return `
            <div id="vendedor-modal" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(12, 26, 48, 0.45); z-index: 1055; backdrop-filter: blur(3px);">
                <div class="bg-white p-4 shadow rounded" style="width: 440px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-person-plus text-primary fs-5"></i>
                            <h5 class="fw-bold mb-0" style="color: var(--text-main); font-size: 16px;">
                                ${esEdicion ? 'Editar Vendedor' : 'Nuevo Vendedor'}
                            </h5>
                        </div>
                        <button type="button" class="btn-close" id="btn-close-vendedor-modal" aria-label="Cerrar"></button>
                    </div>

                    <form id="form-vendedor" onsubmit="event.preventDefault();">
                        <div class="mb-3">
                            <label class="form-label text-muted fw-semibold" style="font-size: 12px;">Nombre completo *</label>
                            <input type="text" id="vend-nombre" class="form-control" style="font-size: 13px;" placeholder="Ej. Mauricio Ramos" value="${escapeHtml(vendedor?.nombre || '')}" required>
                        </div>

                        <div class="mb-3">
                            <label class="form-label text-muted fw-semibold" style="font-size: 12px;">Teléfono / WhatsApp (opcional)</label>
                            <input type="text" id="vend-telefono" class="form-control" style="font-size: 13px;" placeholder="Ej. 3104567890" value="${escapeHtml(vendedor?.telefono || '')}">
                        </div>

                        <div class="mb-3">
                            <label class="form-label text-muted fw-semibold" style="font-size: 12px;">% Comisión sobre total cobrado de venta *</label>
                            <div class="input-group">
                                <input type="number" id="vend-porcentaje" class="form-control" style="font-size: 13px;" value="${vendedor?.porcentaje_comision ?? 10}" min="0" max="100" step="0.1" required>
                                <span class="input-group-text" style="font-size: 13px;">%</span>
                            </div>
                            <span class="text-muted" style="font-size: 11px;">Se calcula automáticamente cuando la factura pasa a estado "Pagada".</span>
                        </div>

                        ${esEdicion ? `
                        <div class="mb-3">
                            <label class="form-label text-muted fw-semibold" style="font-size: 12px;">Estado comercial</label>
                            <select id="vend-estado" class="form-select" style="font-size: 13px;">
                                <option value="activo" ${vendedor?.estado === 'activo' ? 'selected' : ''}>Activo (recibe comisiones)</option>
                                <option value="inactivo" ${vendedor?.estado === 'inactivo' ? 'selected' : ''}>Inactivo</option>
                            </select>
                        </div>` : ''}

                        <div id="vend-error" class="alert alert-danger py-2 px-3 mb-3" style="font-size: 12px; display: none;"></div>

                        <div class="d-flex justify-content-end gap-2 pt-2 border-top">
                            <button type="button" class="btn btn-light border" id="btn-cancel-vendedor" style="font-size: 13px; font-weight: 600;">Cancelar</button>
                            <button type="button" class="btn btn-primary-action" id="btn-guardar-vendedor" style="font-size: 13px; font-weight: 600;">
                                <i class="bi bi-check-lg me-1"></i> Guardar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    /**
     * Modal para Pagar una Comisión Individual
     */
    renderModalPagarComision(comision, cuentas = [], vendedorNombre = '') {
        return `
            <div id="pagar-comision-modal" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(12, 26, 48, 0.45); z-index: 1055; backdrop-filter: blur(3px);">
                <div class="bg-white p-4 shadow rounded" style="width: 420px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-wallet2 text-success fs-5"></i>
                            <h5 class="fw-bold mb-0" style="color: var(--text-main); font-size: 16px;">Liquidar Comisión</h5>
                        </div>
                        <button type="button" class="btn-close" id="btn-close-pago-modal" aria-label="Cerrar"></button>
                    </div>

                    <div class="p-3 bg-light rounded-3 mb-3 border">
                        <div class="text-muted" style="font-size: 11px;">VENDEDOR / FACTURA</div>
                        <div class="fw-bold text-dark" style="font-size: 13.5px;">${escapeHtml(vendedorNombre || 'Vendedor')}</div>
                        <div class="mt-2 text-muted" style="font-size: 11px;">VALOR A DESEMBOLSAR</div>
                        <div class="fw-bold text-success fs-4 tnum">${this.formatMoney(comision.monto)}</div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label text-muted fw-semibold" style="font-size: 12px;">Cuenta bancaria o caja de salida *</label>
                        <select id="pago-cuenta" class="form-select" style="font-size: 13px;">
                            ${cuentas.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)} (${c.tipo || 'Banco'})</option>`).join('')}
                        </select>
                        <span class="text-muted" style="font-size: 11px;">Se registrará un egreso automático en Gastos Operativos.</span>
                    </div>

                    <div id="pago-error" class="alert alert-danger py-2 px-3 mb-3" style="font-size: 12px; display: none;"></div>

                    <div class="d-flex justify-content-end gap-2 pt-2 border-top">
                        <button type="button" class="btn btn-light border" id="btn-cancel-pago" style="font-size: 13px; font-weight: 600;">Cancelar</button>
                        <button type="button" class="btn btn-success" id="btn-confirmar-pago" style="font-size: 13px; font-weight: 600;">
                            <i class="bi bi-check-circle me-1"></i> Confirmar Pago
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Modal para Liquidación Masiva Inteligente de Todas las Comisiones Pendientes
     */
    renderModalLiquidacionMasiva(vendedor, comisionesPendientes = [], cuentas = []) {
        const total = comisionesPendientes.reduce((acc, c) => acc + Number(c.monto || 0), 0);

        return `
            <div id="liquidacion-masiva-modal" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(12, 26, 48, 0.45); z-index: 1055; backdrop-filter: blur(3px);">
                <div class="bg-white p-4 shadow rounded" style="width: 440px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-layers-fill text-primary fs-5"></i>
                            <h5 class="fw-bold mb-0" style="color: var(--text-main); font-size: 16px;">Liquidación Masiva</h5>
                        </div>
                        <button type="button" class="btn-close" id="btn-close-masiva-modal" aria-label="Cerrar"></button>
                    </div>

                    <div class="p-3 bg-light rounded-3 mb-3 border">
                        <div class="text-muted" style="font-size: 11px;">VENDEDOR BENEFICIARIO</div>
                        <div class="fw-bold text-dark" style="font-size: 14px;">${escapeHtml(vendedor.nombre)}</div>
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                            <div>
                                <span class="badge bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle rounded-pill">
                                    ${comisionesPendientes.length} comisiones pendientes
                                </span>
                            </div>
                            <div class="text-end">
                                <div class="text-muted" style="font-size: 10px;">TOTAL A LIQUIDAR</div>
                                <div class="fw-bold text-success fs-5 tnum">${this.formatMoney(total)}</div>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label text-muted fw-semibold" style="font-size: 12px;">Cuenta bancaria o caja de desembolso *</label>
                        <select id="pago-masivo-cuenta" class="form-select" style="font-size: 13px;">
                            ${cuentas.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)} (${c.tipo || 'Banco'})</option>`).join('')}
                        </select>
                    </div>

                    <div id="masiva-error" class="alert alert-danger py-2 px-3 mb-3" style="font-size: 12px; display: none;"></div>

                    <div class="d-flex justify-content-end gap-2 pt-2 border-top">
                        <button type="button" class="btn btn-light border" id="btn-cancel-masiva" style="font-size: 13px; font-weight: 600;">Cancelar</button>
                        <button type="button" class="btn btn-primary-action" id="btn-confirmar-masiva" style="font-size: 13px; font-weight: 600;">
                            <i class="bi bi-check-all me-1"></i> Desembolsar Todo
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
};
