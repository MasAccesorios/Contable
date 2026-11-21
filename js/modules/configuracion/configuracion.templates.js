// js/modules/configuracion/configuracion.templates.js
// Capa de Presentación HTML y Componentes UI para Configuración 360°

import { escapeHtml } from '../../shared/formatters.js';
import { ConfiguracionData } from './configuracion.data.js';

export const ConfiguracionTemplates = {

    renderLayout(state = {}) {
        const s = state || {};
        const kpis = s.kpis || {
            proximoDoc: 1,
            proximoFactura: 1,
            proximoCotizacion: 1,
            maxActual: 0,
            totalCategorias: 0,
            categoriasActivas: 0,
            categoriasIngreso: 0,
            categoriasEgreso: 0,
            perfilCompleto: false
        };

        const currentTab = s.currentTab || 'consecutivos';
        const razonSocial = escapeHtml(s.empresa?.razonSocial || 'MAS Accesorios');
        const nit = escapeHtml(s.empresa?.nit || '79981638-4');

        return `
            <div class="dash-layout p-4" style="max-width: 1240px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                
                <!-- TOP BAR DE ALTO IMPACTO (LÍNEA GASTOS OPERATIVOS) -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <a href="#" onclick="event.preventDefault(); window.history.length > 2 ? window.history.back() : window.location.hash = '#/dashboard';" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body); border-radius: 8px;" title="Volver">
                                <i class="bi bi-arrow-left"></i>
                            </a>
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Configuración del Sistema</h2>
                            <span class="badge" style="background-color: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #a7f3d0;">
                                <i class="bi bi-shield-check me-1"></i> Parámetros Operativos 360°
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Control de secuencias documentales, plan de cuentas de gastos e ingresos, membrete fiscal y preferencias de la aplicación.
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Botón Auditoría Rápida -->
                        <a href="#/auditoria" class="btn btn-light bg-white border text-secondary shadow-xs d-flex align-items-center gap-1" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-shield-exclamation text-warning"></i> Auditoría
                        </a>

                        <!-- Botón Refrescar -->
                        <button id="btn-refresh-config" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS EJECUTIVAS (.payment-kpi-card) -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Próximo Consecutivo Activo -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Próximo Consecutivo</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-hash"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-proximo-doc" style="font-size: 22px;">
                                #${kpis.proximoDoc}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill fw-bold px-2 py-0">En cola</span> Máximo emitido: #${kpis.maxActual}
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Categorías Contables -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Plan de Categorías</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-tags"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" id="kpi-categorias-activas" style="font-size: 22px;">
                                ${kpis.categoriasActivas} Activas
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <strong>${kpis.categoriasEgreso}</strong> egresos &middot; <strong>${kpis.categoriasIngreso}</strong> ingresos
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Perfil de Empresa -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Perfil Fiscal & Membrete</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-building"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark text-truncate" id="kpi-perfil-empresa" style="font-size: 18px; line-height: 26px;" title="${razonSocial}">
                                ${razonSocial}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                ${kpis.perfilCompleto 
                                    ? `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-bold px-2 py-0">Configurado</span> NIT ${nit}`
                                    : '<span class="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill fw-bold px-2 py-0">Pendiente</span> Requiere revisión'}
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Estado del Sistema -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Infraestructura & Motor</span>
                                <div class="payment-kpi-icon out-bg">
                                    <i class="bi bi-database-check"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark" id="kpi-tema-sistema" style="font-size: 18px; line-height: 26px;">
                                Supabase Cloud
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-bold px-2 py-0">Conectado</span> RLS y Secuencias OK
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TABS SEGMENTADAS (.payment-tabs-bar) -->
                <div class="payment-tabs-bar mb-4">
                    <button class="payment-tab-btn ${currentTab === 'consecutivos' ? 'active' : ''}" data-tab="consecutivos">
                        <i class="bi bi-hash"></i> Consecutivos & Documentos
                    </button>
                    <button class="payment-tab-btn ${currentTab === 'categorias' ? 'active' : ''}" data-tab="categorias">
                        <i class="bi bi-tags"></i> Categorías Contables
                        <span class="payment-tab-badge">${kpis.totalCategorias}</span>
                    </button>
                    <button class="payment-tab-btn ${currentTab === 'empresa' ? 'active' : ''}" data-tab="empresa">
                        <i class="bi bi-building"></i> Empresa & Membrete
                    </button>
                    <button class="payment-tab-btn ${currentTab === 'apariencia' ? 'active' : ''}" data-tab="apariencia">
                        <i class="bi bi-palette"></i> Apariencia & Sistema
                    </button>
                </div>

                <!-- CONTENEDOR DE CONTENIDO REACTIVO -->
                <div id="config-tab-content">
                    <!-- Se inyecta dinámicamente según la pestaña activa -->
                </div>

                <!-- CONTENEDOR MODAL / DRAWER -->
                <div id="drawer-config-container"></div>
            </div>
        `;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Pestaña 1: Consecutivos & Numeración de Documentos
    // ─────────────────────────────────────────────────────────────────────────

    renderConsecutivosTab(data = {}) {
        const proximoFactura = Number(data.proximoFactura) || 1;
        const proximoCotizacion = Number(data.proximoCotizacion) || 1;
        const maxActual = Number(data.maxActual) || 0;

        return `
            <div class="d-flex flex-column gap-4">
                
                <!-- Alerta Preventiva Ergonómica -->
                <div class="p-3 rounded-3 border d-flex align-items-start gap-3" style="background-color: #fffbeb; border-color: #fef3c7;">
                    <div style="font-size: 24px; color: #d97706; line-height: 1;">
                        <i class="bi bi-exclamation-triangle-fill"></i>
                    </div>
                    <div>
                        <h6 class="fw-bold mb-1" style="color: #92400e; font-size: 14px;">Seguridad y Continuidad de Consecutivos</h6>
                        <p class="mb-0 text-muted" style="font-size: 12px; line-height: 1.5;">
                            Modificar el siguiente número afectará la <strong>próxima</strong> factura o cotización que se emita en el sistema.
                            Por integridad fiscal de Postgres, el nuevo valor debe ser <strong>estrictamente mayor al número máximo en uso (#${maxActual})</strong> para impedir sobreescritura de documentos existentes.
                        </p>
                    </div>
                </div>

                <!-- Tarjetas de Consecutivos (Grid 2 Columnas) -->
                <div class="row g-4">
                    <!-- Facturas de Venta -->
                    <div class="col-12 col-md-6">
                        <div class="card border rounded-3 p-4 h-100 shadow-xs" style="background: var(--surface);">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="payment-kpi-icon blue-bg" style="width: 32px; height: 32px; font-size: 16px;">
                                        <i class="bi bi-receipt"></i>
                                    </div>
                                    <h5 class="fw-bold mb-0" style="font-size: 16px; color: var(--text-main);">Próxima Factura</h5>
                                </div>
                                <span class="badge bg-primary text-white rounded-pill px-2 py-1" style="font-size: 11px;">
                                    F-${proximoFactura}
                                </span>
                            </div>

                            <p class="text-muted mb-3" style="font-size: 12px;">
                                Número asignado a la siguiente factura comercial de venta.
                            </p>

                            <div class="mb-3">
                                <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Siguiente número a emitir</label>
                                <div class="input-group">
                                    <span class="input-group-text bg-light fw-bold text-primary">F-</span>
                                    <input type="number" id="input-next-factura" class="form-control form-control-lg fw-bold text-dark tnum" value="${proximoFactura}" min="${maxActual + 1}" step="1">
                                    <button class="btn btn-primary-action px-4 fw-semibold btn-guardar-consecutivo" data-tabla="facturas">
                                        <i class="bi bi-check-lg me-1"></i> Guardar
                                    </button>
                                </div>
                            </div>

                            <div class="mt-auto pt-2 border-top d-flex justify-content-between align-items-center text-muted" style="font-size: 11px;">
                                <span>Máximo en historial: <strong>F-${maxActual}</strong></span>
                                <span class="text-success"><i class="bi bi-shield-lock me-1"></i> Secuencia segura</span>
                            </div>
                        </div>
                    </div>

                    <!-- Cotizaciones Comerciales -->
                    <div class="col-12 col-md-6">
                        <div class="card border rounded-3 p-4 h-100 shadow-xs" style="background: var(--surface);">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="payment-kpi-icon in-bg" style="width: 32px; height: 32px; font-size: 16px;">
                                        <i class="bi bi-file-earmark-text"></i>
                                    </div>
                                    <h5 class="fw-bold mb-0" style="font-size: 16px; color: var(--text-main);">Próxima Cotización</h5>
                                </div>
                                <span class="badge bg-success text-white rounded-pill px-2 py-1" style="font-size: 11px;">
                                    C-${proximoCotizacion}
                                </span>
                            </div>

                            <p class="text-muted mb-3" style="font-size: 12px;">
                                Número asignado a la siguiente propuesta o cotización para clientes.
                            </p>

                            <div class="mb-3">
                                <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Siguiente número a emitir</label>
                                <div class="input-group">
                                    <span class="input-group-text bg-light fw-bold text-success">C-</span>
                                    <input type="number" id="input-next-cotizacion" class="form-control form-control-lg fw-bold text-dark tnum" value="${proximoCotizacion}" min="${maxActual + 1}" step="1">
                                    <button class="btn btn-primary-action px-4 fw-semibold btn-guardar-consecutivo" data-tabla="cotizaciones">
                                        <i class="bi bi-check-lg me-1"></i> Guardar
                                    </button>
                                </div>
                            </div>

                            <div class="mt-auto pt-2 border-top d-flex justify-content-between align-items-center text-muted" style="font-size: 11px;">
                                <span>Máximo en historial: <strong>C-${maxActual}</strong></span>
                                <span class="text-success"><i class="bi bi-shield-lock me-1"></i> Secuencia compartida</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Nota Técnica de Arquitectura -->
                <div class="card border rounded-3 p-3 bg-light text-muted" style="font-size: 12px;">
                    <div class="d-flex align-items-center gap-2 mb-1">
                        <i class="bi bi-info-circle text-primary"></i>
                        <span class="fw-bold text-dark">Arquitectura de Secuencias en Postgres</span>
                    </div>
                    <span>
                        Las facturas y cotizaciones están orquestadas mediante la secuencia unificada <code>documentos_numero_seq</code> y sincronizadas con la tabla <code>contadores_documentos</code>. Al actualizar un consecutivo aquí, el motor aplica un <code>setval()</code> controlado para garantizar unicidad contable entre cotizaciones convertidas a facturas.
                    </span>
                </div>
            </div>
        `;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Pestaña 2: Categorías Contables (Plan de Cuentas)
    // ─────────────────────────────────────────────────────────────────────────

    renderCategoriasTab({ categorias = [], activeTabFilter = 'todas', searchQuery = '' } = {}) {
        const counts = {
            todas: categorias.length,
            egresos: categorias.filter(c => c.tipo_flujo === 'out' && c.estado === 'activa').length,
            ingresos: categorias.filter(c => c.tipo_flujo === 'in' && c.estado === 'activa').length,
            inactivas: categorias.filter(c => c.estado === 'inactiva').length
        };

        return `
            <div class="d-flex flex-column gap-3">
                
                <!-- Barra de Herramientas de Categorías -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 bg-white p-3 border rounded-3 shadow-xs">
                    
                    <div class="d-flex align-items-center gap-2">
                        <span class="fw-bold text-dark" style="font-size: 14px;"><i class="bi bi-tags me-1"></i> Categorías Contables</span>
                    </div>

                    <!-- Sub-filtros por tipo -->
                    <div class="d-flex flex-wrap gap-1">
                        <button class="btn btn-sm ${activeTabFilter === 'todas' ? 'btn-dark' : 'btn-light'} btn-cat-filter" data-cat-filter="todas" style="font-size: 12px; border-radius: 6px;">
                            Todas (${counts.todas})
                        </button>
                        <button class="btn btn-sm ${activeTabFilter === 'egresos' ? 'btn-danger' : 'btn-light text-danger'} btn-cat-filter" data-cat-filter="egresos" style="font-size: 12px; border-radius: 6px;">
                            <i class="bi bi-arrow-up-right me-1"></i> Gastos / Egresos (${counts.egresos})
                        </button>
                        <button class="btn btn-sm ${activeTabFilter === 'ingresos' ? 'btn-success' : 'btn-light text-success'} btn-cat-filter" data-cat-filter="ingresos" style="font-size: 12px; border-radius: 6px;">
                            <i class="bi bi-arrow-down-left me-1"></i> Ingresos (${counts.ingresos})
                        </button>
                        <button class="btn btn-sm ${activeTabFilter === 'inactivas' ? 'btn-secondary' : 'btn-light text-secondary'} btn-cat-filter" data-cat-filter="inactivas" style="font-size: 12px; border-radius: 6px;">
                            Inactivas (${counts.inactivas})
                        </button>
                    </div>

                    <!-- Buscador y Botón Crear -->
                    <div class="d-flex align-items-center gap-2">
                        <div class="input-group input-group-sm" style="max-width: 250px;">
                            <span class="input-group-text bg-light border-end-0"><i class="bi bi-search text-muted"></i></span>
                            <input type="text" id="input-buscar-categoria" class="form-control border-start-0" placeholder="Buscar categoría..." value="${escapeHtml(searchQuery)}">
                        </div>
                        <button id="btn-nueva-categoria" class="btn btn-primary-action btn-sm fw-semibold d-flex align-items-center gap-1" style="border-radius: 6px; white-space: nowrap;">
                            <i class="bi bi-plus-lg"></i> Nueva Categoría
                        </button>
                    </div>
                </div>

                <!-- Tabla Fluida 100% Sin Scrollbar Horizontal -->
                <div class="card border rounded-3 overflow-hidden shadow-xs" style="background: var(--surface);">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0" style="font-size: 13px;">
                            <thead class="bg-light text-secondary text-uppercase fw-semibold" style="font-size: 11px; letter-spacing: 0.5px;">
                                <tr>
                                    <th style="padding: 12px 16px;">Categoría Contable</th>
                                    <th style="padding: 12px 16px; width: 160px;">Tipo de Flujo</th>
                                    <th style="padding: 12px 16px; width: 220px;">Módulos Asociados</th>
                                    <th style="padding: 12px 16px; width: 120px; text-align: center;">Estado</th>
                                    <th style="padding: 12px 16px; width: 110px; text-align: right;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${categorias.length === 0 ? `
                                    <tr>
                                        <td colspan="5" class="text-center py-5 text-muted">
                                            <i class="bi bi-tags display-6 d-block mb-2 text-muted opacity-50"></i>
                                            No se encontraron categorías que coincidan con el filtro.
                                        </td>
                                    </tr>
                                ` : categorias.map(cat => {
                                    const isIngreso = cat.tipo_flujo === 'in';
                                    const isActiva = cat.estado === 'activa';
                                    const flowIcon = isIngreso ? 'bi-arrow-down-left-circle-fill text-success' : 'bi-arrow-up-right-circle-fill text-danger';
                                    const flowBadge = isIngreso 
                                        ? '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1"><i class="bi bi-plus-circle me-1"></i> Ingreso</span>'
                                        : '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2 py-1"><i class="bi bi-dash-circle me-1"></i> Gasto / Egreso</span>';
                                    
                                    const modulosText = isIngreso
                                        ? 'Ingresos Operativos, Recaudo Cartera'
                                        : 'Gastos Operativos, Compras, Caja Menor';

                                    return `
                                        <tr>
                                            <td style="padding: 12px 16px;">
                                                <div class="d-flex align-items-center gap-2">
                                                    <i class="bi ${flowIcon} fs-5"></i>
                                                    <div>
                                                        <div class="fw-semibold text-dark">${escapeHtml(cat.nombre)}</div>
                                                        <div class="text-muted" style="font-size: 11px;">ID #${cat.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style="padding: 12px 16px;">${flowBadge}</td>
                                            <td style="padding: 12px 16px;">
                                                <span class="text-secondary" style="font-size: 12px;">${modulosText}</span>
                                            </td>
                                            <td style="padding: 12px 16px; text-align: center;">
                                                <span class="badge ${isActiva ? 'bg-success' : 'bg-secondary'} rounded-pill px-2 py-1" style="font-size: 10px;">
                                                    ${isActiva ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </td>
                                            <td style="padding: 12px 16px; text-align: right;">
                                                <button class="btn btn-sm ${isActiva ? 'btn-outline-danger' : 'btn-outline-success'} btn-toggle-categoria" data-id="${cat.id}" data-estado="${cat.estado}" title="${isActiva ? 'Desactivar categoría' : 'Activar categoría'}" style="font-size: 11px; border-radius: 6px; padding: 3px 8px;">
                                                    <i class="bi ${isActiva ? 'bi-slash-circle' : 'bi-check-circle'} me-1"></i> ${isActiva ? 'Inactivar' : 'Activar'}
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Pestaña 3: Empresa & Membrete Oficial
    // ─────────────────────────────────────────────────────────────────────────

    renderEmpresaTab(empresa = {}) {
        const emp = ConfiguracionData.sanitizarPerfilEmpresa(empresa || {});

        return `
            <div class="card border rounded-3 p-4 shadow-xs" style="background: var(--surface);">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h5 class="fw-bold mb-1" style="color: var(--text-main);">Perfil Comercial y Datos de Membrete</h5>
                        <p class="text-muted mb-0" style="font-size: 12px;">
                            Esta información se refleja en los encabezados de impresión de Facturas de Venta, Cotizaciones y Estados de Cuenta de Cartera.
                        </p>
                    </div>
                    <button id="btn-restaurar-empresa" class="btn btn-sm btn-light border text-secondary" style="border-radius: 6px;" title="Restaurar valores de fábrica">
                        <i class="bi bi-arrow-counterclockwise me-1"></i> Restaurar Por Defecto
                    </button>
                </div>

                <form id="form-empresa-config" class="row g-3">
                    <!-- Fila 1: Razón Social y Representante -->
                    <div class="col-md-6">
                        <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Razón Social / Nombre Comercial</label>
                        <input type="text" id="empresa-razon-social" class="form-control" value="${escapeHtml(emp.razonSocial || '')}" required>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Titular / Representante Legal</label>
                        <input type="text" id="empresa-titular" class="form-control" value="${escapeHtml(emp.titular || '')}">
                    </div>

                    <!-- Fila 2: NIT y Régimen -->
                    <div class="col-md-6">
                        <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">NIT / Identificación Tributaria</label>
                        <input type="text" id="empresa-nit" class="form-control" value="${escapeHtml(emp.nit || '')}" required>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Régimen Fiscal</label>
                        <input type="text" id="empresa-regimen" class="form-control" value="${escapeHtml(emp.regimen || '')}">
                    </div>

                    <!-- Fila 3: Teléfono y Correo -->
                    <div class="col-md-6">
                        <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Teléfono / WhatsApp de Contacto</label>
                        <div class="input-group">
                            <span class="input-group-text bg-light"><i class="bi bi-whatsapp text-success"></i></span>
                            <input type="text" id="empresa-telefono" class="form-control" value="${escapeHtml(emp.telefono || '')}">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Correo Electrónico</label>
                        <div class="input-group">
                            <span class="input-group-text bg-light"><i class="bi bi-envelope"></i></span>
                            <input type="email" id="empresa-email" class="form-control" value="${escapeHtml(emp.email || '')}">
                        </div>
                    </div>

                    <!-- Fila 4: Ciudad y Dirección -->
                    <div class="col-md-6">
                        <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Ciudad / Municipio</label>
                        <input type="text" id="empresa-ciudad" class="form-control" value="${escapeHtml(emp.ciudad || '')}">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Dirección Comercial</label>
                        <input type="text" id="empresa-direccion" class="form-control" value="${escapeHtml(emp.direccion || '')}">
                    </div>

                    <!-- Fila 5: Textos Legales y Condiciones -->
                    <div class="col-12">
                        <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Términos por Defecto para Cotizaciones</label>
                        <textarea id="empresa-terminos-cotizacion" class="form-control" rows="2" style="font-size: 12px;">${escapeHtml(emp.terminosCotizacion || '')}</textarea>
                    </div>

                    <div class="col-12">
                        <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Leyenda Legal al Pie de Facturas de Venta</label>
                        <textarea id="empresa-notas-factura" class="form-control" rows="2" style="font-size: 12px;">${escapeHtml(emp.notasFactura || '')}</textarea>
                    </div>

                    <!-- Botón de Guardado -->
                    <div class="col-12 pt-3 border-top d-flex justify-content-end">
                        <button type="submit" id="btn-guardar-empresa" class="btn btn-primary-action px-4 fw-semibold shadow-xs">
                            <i class="bi bi-save me-1"></i> Guardar Configuración de Empresa
                        </button>
                    </div>
                </form>
            </div>
        `;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Pestaña 4: Apariencia & Sistema (Limpio y sin textos obsoletos)
    // ─────────────────────────────────────────────────────────────────────────

    renderAparienciaTab(currentTheme = '') {
        const theme = currentTheme || '';

        return `
            <div class="d-flex flex-column gap-4">
                
                <!-- Selector de Tema Visual -->
                <div class="card border rounded-3 p-4 shadow-xs" style="background: var(--surface);">
                    <h5 class="fw-bold mb-1" style="color: var(--text-main);">Tema Visual de la Aplicación</h5>
                    <p class="text-muted mb-3" style="font-size: 12px;">
                        Selecciona el tema estético preferido. La configuración se preserva automáticamente en este navegador.
                    </p>

                    <div class="row g-3" id="theme-options">
                        <!-- Opción 1: Actual Claro -->
                        <div class="col-12 col-md-4">
                            <div class="p-3 border rounded-3 theme-option-card h-100 ${theme === '' ? 'border-primary shadow-xs' : ''}" data-theme-value="" style="cursor: pointer; transition: all 0.2s ease;">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div class="d-flex gap-1">
                                        <span style="width: 18px; height: 18px; border-radius: 4px; background: #f8fafc; border: 1px solid #e2e8f0;"></span>
                                        <span style="width: 18px; height: 18px; border-radius: 4px; background: #2dbda8;"></span>
                                        <span style="width: 18px; height: 18px; border-radius: 4px; background: #ffffff; border: 1px solid #e2e8f0;"></span>
                                    </div>
                                    ${theme === '' ? '<i class="bi bi-check-circle-fill text-primary"></i>' : ''}
                                </div>
                                <div class="fw-bold text-dark" style="font-size: 14px;">Actual</div>
                                <div class="text-muted" style="font-size: 12px;">Claro, verde turquesa institucional</div>
                            </div>
                        </div>

                        <!-- Opción 2: Emerald Dark Ledger -->
                        <div class="col-12 col-md-4">
                            <div class="p-3 border rounded-3 theme-option-card h-100 ${theme === 'dark-green' ? 'border-primary shadow-xs' : ''}" data-theme-value="dark-green" style="cursor: pointer; transition: all 0.2s ease;">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div class="d-flex gap-1">
                                        <span style="width: 18px; height: 18px; border-radius: 4px; background: #141414;"></span>
                                        <span style="width: 18px; height: 18px; border-radius: 4px; background: #44d949;"></span>
                                        <span style="width: 18px; height: 18px; border-radius: 4px; background: #1a1a1a;"></span>
                                    </div>
                                    ${theme === 'dark-green' ? '<i class="bi bi-check-circle-fill text-primary"></i>' : ''}
                                </div>
                                <div class="fw-bold text-dark" style="font-size: 14px;">Emerald Dark Ledger</div>
                                <div class="text-muted" style="font-size: 12px;">Oscuro, verde neón de alto contraste</div>
                            </div>
                        </div>

                        <!-- Opción 3: Mezcla Azul Corporativo -->
                        <div class="col-12 col-md-4">
                            <div class="p-3 border rounded-3 theme-option-card h-100 ${theme === 'dark-blue' ? 'border-primary shadow-xs' : ''}" data-theme-value="dark-blue" style="cursor: pointer; transition: all 0.2s ease;">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div class="d-flex gap-1">
                                        <span style="width: 18px; height: 18px; border-radius: 4px; background: #141414;"></span>
                                        <span style="width: 18px; height: 18px; border-radius: 4px; background: #0094d9;"></span>
                                        <span style="width: 18px; height: 18px; border-radius: 4px; background: #1a1a1a;"></span>
                                    </div>
                                    ${theme === 'dark-blue' ? '<i class="bi bi-check-circle-fill text-primary"></i>' : ''}
                                </div>
                                <div class="fw-bold text-dark" style="font-size: 14px;">Mezcla Azul Corporativo</div>
                                <div class="text-muted" style="font-size: 12px;">Oscuro, azul MAS Accesorios</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tarjeta de Mantenimiento y Caché Local -->
                <div class="card border rounded-3 p-4 shadow-xs" style="background: var(--surface);">
                    <h5 class="fw-bold mb-1" style="color: var(--text-main);">Mantenimiento y Rendimiento del Navegador</h5>
                    <p class="text-muted mb-3" style="font-size: 12px;">
                        Herramientas locales para optimizar la velocidad y refrescar índices temporales de búsqueda.
                    </p>

                    <div class="d-flex flex-wrap gap-2">
                        <button id="btn-limpiar-historial-busqueda" class="btn btn-outline-secondary btn-sm" style="border-radius: 6px;">
                            <i class="bi bi-clock-history me-1"></i> Limpiar Historial de Búsquedas Frecuentes
                        </button>
                        <button id="btn-recargar-spa" class="btn btn-outline-primary btn-sm" style="border-radius: 6px;">
                            <i class="bi bi-arrow-clockwise me-1"></i> Forzar Recarga Limpia de la App
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Modal Ergonómico: Crear Nueva Categoría Contable
    // ─────────────────────────────────────────────────────────────────────────

    renderModalNuevaCategoria() {
        return `
            <div class="modal fade" id="modal-crear-categoria" tabindex="-1" aria-labelledby="modalCrearCatLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg" style="border-radius: 14px;">
                        <div class="modal-header border-bottom pb-3">
                            <div class="d-flex align-items-center gap-2">
                                <div class="payment-kpi-icon in-bg" style="width: 32px; height: 32px; font-size: 16px;">
                                    <i class="bi bi-tag-fill"></i>
                                </div>
                                <h5 class="modal-title fw-bold" id="modalCrearCatLabel" style="font-size: 16px;">Nueva Categoría Contable</h5>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <form id="form-nueva-categoria">
                            <div class="modal-body py-3">
                                <div class="mb-3">
                                    <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Nombre de la Categoría</label>
                                    <input type="text" id="input-cat-nombre" class="form-control" placeholder="Ej: Mantenimiento de Vehículos" required minlength="3">
                                    <div class="form-text" style="font-size: 11px;">Mínimo 3 caracteres. No debe repetirse en el plan de cuentas.</div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label fw-semibold text-secondary" style="font-size: 12px;">Tipo de Flujo Financiero</label>
                                    <div class="d-flex gap-3">
                                        <div class="form-check">
                                            <input class="form-check-input" type="radio" name="tipo_flujo" id="radio-flujo-out" value="out" checked>
                                            <label class="form-check-label fw-medium text-danger" for="radio-flujo-out">
                                                <i class="bi bi-dash-circle me-1"></i> Gasto / Egreso (out)
                                            </label>
                                        </div>
                                        <div class="form-check">
                                            <input class="form-check-input" type="radio" name="tipo_flujo" id="radio-flujo-in" value="in">
                                            <label class="form-check-label fw-medium text-success" for="radio-flujo-in">
                                                <i class="bi bi-plus-circle me-1"></i> Ingreso (in)
                                            </label>
                                        </div>
                                    </div>
                                    <div class="form-text" style="font-size: 11px;">
                                        Los egresos aplican en Gastos Operativos y pagos a proveedores; los ingresos en cobros y ventas.
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer border-top pt-2">
                                <button type="button" class="btn btn-light border text-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
                                <button type="submit" id="btn-submit-categoria" class="btn btn-primary-action btn-sm px-3 fw-semibold">
                                    <i class="bi bi-check-lg me-1"></i> Crear Categoría
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }
};
