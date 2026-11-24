// js/modules/inventario/categorias/categorias.templates.js
// Vistas y Componentes UI Modernos para el Módulo de Categorías Contables
// MAS Accesorios - Sistema Contable

/**
 * Escapa cadenas HTML para prevenir vulnerabilidades XSS (OWASP).
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export const CategoriasTemplates = {
    /**
     * Badge visual semántico para el tipo de flujo financiero.
     */
    getFlujoBadge(tipo_flujo) {
        if (tipo_flujo === 'in') {
            return `
                <span class="badge d-inline-flex align-items-center gap-1" style="background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 11px; font-weight: 700; padding: 4px 10px;">
                    <i class="bi bi-arrow-down-left"></i> Ingreso
                </span>
            `;
        }
        return `
            <span class="badge d-inline-flex align-items-center gap-1" style="background-color: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 9999px; font-size: 11px; font-weight: 700; padding: 4px 10px;">
                <i class="bi bi-arrow-up-right"></i> Egreso / Gasto
            </span>
        `;
    },

    /**
     * Badge visual semántico para el estado de la categoría.
     */
    getEstadoBadge(estado) {
        if (estado === 'activa') {
            return `
                <span class="badge bg-success bg-opacity-10 text-success border border-success-subtle rounded-pill fw-medium d-inline-flex align-items-center gap-1" style="font-size: 11px; padding: 4px 10px;">
                    <i class="bi bi-check-circle-fill" style="font-size: 10px;"></i> Activa
                </span>
            `;
        }
        return `
            <span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle rounded-pill fw-medium d-inline-flex align-items-center gap-1" style="font-size: 11px; padding: 4px 10px;">
                <i class="bi bi-dash-circle" style="font-size: 10px;"></i> Inactiva
            </span>
        `;
    },

    /**
     * Badge de movimientos contables asociados.
     */
    getMovimientosBadge(count) {
        const num = Number(count || 0);
        if (num > 0) {
            return `
                <span class="badge bg-light text-dark border border-secondary-subtle rounded-pill px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1" style="font-size: 11px;">
                    <i class="bi bi-receipt text-primary"></i> ${num} ${num === 1 ? 'movimiento' : 'movimientos'}
                </span>
            `;
        }
        return `
            <span class="text-muted d-inline-flex align-items-center gap-1" style="font-size: 12px;">
                <i class="bi bi-dash"></i> Sin movimientos
            </span>
        `;
    },

    /**
     * Renderiza el layout estructural completo de la vista (Top Bar, KPIs, Tabs, Filtros, Contenedor Tabla y Modal).
     */
    renderLayout(kpis = {}, selectedTab = 'todas', searchQuery = '') {
        const total = kpis.total || 0;
        const egresos = kpis.egresos || 0;
        const ingresos = kpis.ingresos || 0;
        const activas = kpis.activas || 0;
        const inactivas = kpis.inactivas || 0;
        const totalMovimientos = kpis.totalMovimientos || 0;

        return `
            <div class="dash-layout p-3 p-md-4" style="max-width: 1260px; margin: 0 auto;">
                
                <!-- TOP BAR DE ALTO IMPACTO -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <a href="#" onclick="event.preventDefault(); window.history.length > 2 ? window.history.back() : window.location.hash = '#/dashboard';" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body); border-radius: 8px;">
                                <i class="bi bi-arrow-left"></i>
                            </a>
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Categorías Contables</h2>
                            <span class="badge" style="background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #bfdbfe;">
                                <i class="bi bi-tags me-1"></i> Catálogo Financiero
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Estructura y clasificación para tus productos, compras, gastos operacionales e ingresos contables.
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Botón Exportar Excel/CSV -->
                        <button id="btn-exportar-categorias" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 600; font-size: 13px; border-radius: 8px;" title="Descargar en Excel/CSV">
                            <i class="bi bi-file-earmark-excel text-success me-1"></i> Exportar
                        </button>

                        <!-- Botón Refrescar -->
                        <button id="btn-actualizar-categorias" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise" id="icon-actualizar-categorias"></i>
                        </button>

                        <!-- Botón Nueva Categoría -->
                        <button id="btn-nueva-categoria" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-plus-lg"></i> Nueva Categoría
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS (Diseño Gastos Operacionales) -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Total Categorías -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Total Categorías</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-tags"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" style="font-size: 24px;">
                                ${total}
                            </div>
                            <div class="mt-2 d-flex align-items-center gap-2 text-muted" style="font-size: 11px;">
                                <span class="text-success fw-semibold"><i class="bi bi-check2-circle"></i> ${activas} activas</span>
                                ${inactivas > 0 ? `<span>• ${inactivas} inactivas</span>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Categorías de Gasto / Egreso -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Gastos / Egresos</span>
                                <div class="payment-kpi-icon out-bg">
                                    <i class="bi bi-arrow-up-right"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-danger tnum" style="font-size: 24px;">
                                ${egresos}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Destinadas a compras y salidas de caja
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Categorías de Ingreso -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Ingresos</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-arrow-down-left"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" style="font-size: 24px;">
                                ${ingresos}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Destinadas a cobros y recaudos directos
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Movimientos Vinculados -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #3b82f6;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Movimientos Vinculados</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-receipt"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-primary tnum" style="font-size: 24px;">
                                ${totalMovimientos}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Transacciones categorizadas en el sistema
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR MODAL / PANEL DE CREACIÓN Y EDICIÓN -->
                <div id="container-modal-categoria"></div>

                <!-- CONTENEDOR DE TABLA DE DATOS -->
                <div class="dash-table-container mb-4 shadow-xs" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                    
                    <!-- FILTROS Y TABS SUPERIORES -->
                    <div class="p-3 border-bottom bg-white d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                        <!-- Tabs de Filtro Rápido -->
                        <div class="payment-tabs-bar">
                            <button type="button" class="payment-tab-btn ${selectedTab === 'todas' ? 'active' : ''}" data-tab="todas">
                                Todas <span class="payment-tab-badge">${total}</span>
                            </button>
                            <button type="button" class="payment-tab-btn ${selectedTab === 'egresos' ? 'active' : ''}" data-tab="egresos">
                                <i class="bi bi-arrow-up-right text-danger"></i> Gastos / Egresos
                                <span class="payment-tab-badge">${egresos}</span>
                            </button>
                            <button type="button" class="payment-tab-btn ${selectedTab === 'ingresos' ? 'active' : ''}" data-tab="ingresos">
                                <i class="bi bi-arrow-down-left text-success"></i> Ingresos
                                <span class="payment-tab-badge">${ingresos}</span>
                            </button>
                            ${inactivas > 0 ? `
                                <button type="button" class="payment-tab-btn ${selectedTab === 'inactivas' ? 'active' : ''}" data-tab="inactivas">
                                    Inactivas <span class="payment-tab-badge">${inactivas}</span>
                                </button>
                            ` : ''}
                        </div>

                        <!-- Buscador en tiempo real -->
                        <div class="d-flex align-items-center gap-2">
                            <div class="ds-search-container" style="min-width: 260px;">
                                <i class="bi bi-search ds-search-icon"></i>
                                <input type="text" class="ds-search-input" id="search-categorias" autocomplete="off" placeholder="Buscar categoría por nombre o flujo..." value="${escapeHtml(searchQuery)}">
                                ${searchQuery ? `<button type="button" id="btn-clear-search" class="btn btn-sm btn-link text-muted p-0 me-2" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%);"><i class="bi bi-x-circle-fill"></i></button>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- TABLA DE CATEGORÍAS -->
                    <div class="table-responsive position-relative">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="table-light">
                                <tr style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
                                    <th class="py-3 px-3" style="min-width: 250px;">Nombre de Categoría</th>
                                    <th class="py-3 px-3 text-center" style="width: 180px;">Flujo Financiero</th>
                                    <th class="py-3 px-3 text-center" style="width: 200px;">Uso en Transacciones</th>
                                    <th class="py-3 px-3 text-center" style="width: 140px;">Estado</th>
                                    <th class="py-3 px-3 text-end" style="width: 90px;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-categorias">
                                <!-- Filas dinámicas -->
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        `;
    },

    /**
     * Renderiza las filas de la tabla de categorías con menú de 3 puntos interactivo.
     */
    renderTabla(categorias = [], conteoMovimientos = {}) {
        if (!Array.isArray(categorias) || categorias.length === 0) {
            return `
                <tr>
                    <td colspan="5" class="text-center py-5">
                        <div class="d-flex flex-column align-items-center justify-content-center text-muted">
                            <div class="payment-kpi-icon blue-bg mb-2" style="width: 48px; height: 48px; font-size: 22px;">
                                <i class="bi bi-tags"></i>
                            </div>
                            <p class="fw-semibold mb-1" style="font-size: 15px; color: var(--text-main);">No se encontraron categorías</p>
                            <span style="font-size: 12px;">Intenta ajustar el filtro de búsqueda o crea una nueva categoría.</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        return categorias.map(c => {
            const count = conteoMovimientos[c.nombre] || 0;
            const esEgreso = c.tipo_flujo === 'out';

            return `
                <tr style="font-size: 13px; color: var(--text-body); transition: background-color 0.15s ease;" class="categoria-row" data-cat-id="${c.id}">
                    <!-- Nombre con Icono Avatar -->
                    <td class="py-3 px-3">
                        <div class="d-flex align-items-center gap-2">
                            <div class="payment-kpi-icon ${esEgreso ? 'out-bg' : 'in-bg'}" style="width: 32px; height: 32px; min-width: 32px; font-size: 13px; border-radius: 8px;">
                                <i class="bi ${esEgreso ? 'bi-arrow-up-right' : 'bi-arrow-down-left'}"></i>
                            </div>
                            <div>
                                <span class="fw-semibold d-block" style="color: #0f172a; font-size: 13.5px;">${escapeHtml(c.nombre)}</span>
                                <span class="text-muted" style="font-size: 11px;">ID #${c.id}</span>
                            </div>
                        </div>
                    </td>

                    <!-- Flujo Financiero -->
                    <td class="py-3 px-3 text-center">
                        ${this.getFlujoBadge(c.tipo_flujo)}
                    </td>

                    <!-- Uso en Transacciones -->
                    <td class="py-3 px-3 text-center">
                        ${this.getMovimientosBadge(count)}
                    </td>

                    <!-- Estado -->
                    <td class="py-3 px-3 text-center">
                        ${this.getEstadoBadge(c.estado)}
                    </td>

                    <!-- Botón de 3 Puntos (Kebab Menu) -->
                    <td class="py-3 px-3 text-end position-relative">
                        <button type="button" class="btn btn-light bg-white border btn-sm p-1 px-2 text-muted btn-cat-action-menu" data-id="${c.id}" data-nombre="${escapeHtml(c.nombre)}" data-flujo="${c.tipo_flujo}" data-estado="${c.estado}" data-count="${count}" title="Acciones de categoría" style="border-radius: 6px;">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Renderiza el Modal interactivo para Crear o Editar una Categoría.
     */
    renderModalForm(cat = null) {
        const isEditing = Boolean(cat && cat.id);
        const title = isEditing ? 'Editar Categoría' : 'Nueva Categoría';
        const submitText = isEditing ? 'Guardar Cambios' : 'Crear Categoría';
        const nombreVal = cat?.nombre ? escapeHtml(cat.nombre) : '';
        const flujoVal = cat?.tipo_flujo || 'out';
        const estadoVal = cat?.estado || 'activa';
        const idVal = cat?.id || '';

        return `
            <div class="modal fade" id="modalCategoriaForm" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered" style="max-width: 480px;">
                    <div class="modal-content shadow-lg border-0" style="border-radius: 16px; overflow: hidden;">
                        
                        <!-- Header del Modal -->
                        <div class="modal-header border-bottom p-3 px-4 bg-light">
                            <div class="d-flex align-items-center gap-2">
                                <div class="payment-kpi-icon ${flujoVal === 'in' ? 'in-bg' : 'out-bg'}" id="modal-cat-icon-badge" style="width: 34px; height: 34px; font-size: 15px; border-radius: 8px;">
                                    <i class="bi ${isEditing ? 'bi-pencil-square' : 'bi-plus-lg'}" id="modal-cat-icon"></i>
                                </div>
                                <div>
                                    <h5 class="modal-title fw-bold mb-0" style="font-size: 16px; color: #0f172a;">${title}</h5>
                                    <span class="text-muted" style="font-size: 11px;">${isEditing ? `Modificando registro #${idVal}` : 'Define la clasificación financiera'}</span>
                                </div>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>

                        <!-- Formulario -->
                        <form id="form-guardar-categoria">
                            <input type="hidden" id="input-cat-id" value="${idVal}">

                            <div class="modal-body p-4">
                                <div id="modal-cat-error" class="alert alert-danger py-2 px-3 d-none mb-3" style="font-size: 12px; border-radius: 8px;"></div>

                                <!-- Campo Nombre -->
                                <div class="mb-3">
                                    <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Nombre de la Categoría *</label>
                                    <input type="text" class="form-control" id="input-cat-nombre" placeholder="Ej. Honorarios Profesionales, Arrendamientos..." value="${nombreVal}" required minlength="2" autocomplete="off" style="border-radius: 8px; height: 40px; font-size: 13.5px;">
                                    <div class="form-text" style="font-size: 11px;">Nombre visible en compras, gastos, ingresos y reportería.</div>
                                </div>

                                <!-- Campo Tipo de Flujo -->
                                <div class="mb-3">
                                    <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Tipo de Flujo Financiero *</label>
                                    <div class="d-flex gap-2">
                                        <label class="flex-grow-1 p-2.5 border rounded-3 d-flex align-items-center gap-2 cursor-pointer ${flujoVal === 'out' ? 'bg-danger bg-opacity-10 border-danger' : 'bg-white'}" style="cursor: pointer;">
                                            <input type="radio" name="radio-cat-flujo" value="out" ${flujoVal === 'out' ? 'checked' : ''} class="form-check-input mt-0">
                                            <div>
                                                <span class="d-block fw-semibold text-danger" style="font-size: 12.5px;"><i class="bi bi-arrow-up-right me-1"></i>Egreso / Gasto</span>
                                                <span class="text-muted" style="font-size: 10px;">Salidas de dinero, compras y costos</span>
                                            </div>
                                        </label>
                                        <label class="flex-grow-1 p-2.5 border rounded-3 d-flex align-items-center gap-2 cursor-pointer ${flujoVal === 'in' ? 'bg-success bg-opacity-10 border-success' : 'bg-white'}" style="cursor: pointer;">
                                            <input type="radio" name="radio-cat-flujo" value="in" ${flujoVal === 'in' ? 'checked' : ''} class="form-check-input mt-0">
                                            <div>
                                                <span class="d-block fw-semibold text-success" style="font-size: 12.5px;"><i class="bi bi-arrow-down-left me-1"></i>Ingreso</span>
                                                <span class="text-muted" style="font-size: 10px;">Entradas directas y recaudos</span>
                                            </div>
                                        </label>
                                    </div>
                                    <!-- Selector oculto para compatibilidad con tests -->
                                    <select class="d-none" id="select-cat-flujo">
                                        <option value="out" ${flujoVal === 'out' ? 'selected' : ''}>out</option>
                                        <option value="in" ${flujoVal === 'in' ? 'selected' : ''}>in</option>
                                    </select>
                                </div>

                                <!-- Campo Estado -->
                                <div class="mb-2">
                                    <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Estado *</label>
                                    <select class="form-select" id="select-cat-estado" style="border-radius: 8px; height: 40px; font-size: 13.5px;">
                                        <option value="activa" ${estadoVal === 'activa' ? 'selected' : ''}>🟢 Activa (Disponible para registrar operaciones)</option>
                                        <option value="inactiva" ${estadoVal === 'inactiva' ? 'selected' : ''}>⚪ Inactiva (Oculta en selectores sin perder historial)</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Footer con Botones -->
                            <div class="modal-footer border-top p-3 px-4 bg-light d-flex justify-content-between">
                                <button type="button" class="btn btn-light border" data-bs-dismiss="modal" style="border-radius: 8px; font-size: 13px; font-weight: 600;">
                                    Cancelar
                                </button>
                                <button type="submit" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" id="btn-submit-cat" style="border-radius: 8px; font-size: 13px; font-weight: 600;">
                                    <span class="spinner-border spinner-border-sm d-none" id="spinner-cat-submit" role="status"></span>
                                    <i class="bi bi-check-lg" id="icon-cat-submit"></i> ${submitText}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Renderiza el menú contextual flotante para una categoría (kebab de 3 puntos).
     */
    renderFloatingMenu({ categoria, count, rect }) {
        const id = categoria.id;
        const nombre = escapeHtml(categoria.nombre);
        const esActiva = categoria.estado === 'activa';
        const esEgreso = categoria.tipo_flujo === 'out';
        const numCount = Number(count || 0);

        return `
            <div class="row-action-menu position-fixed shadow-lg border rounded-3 bg-white" style="z-index: 1060; width: 220px; padding: 6px; border-color: var(--border-color); animation: fadeInMenu 0.12s ease;">
                <div class="px-2 py-1.5 border-bottom mb-1 d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-dark text-truncate" style="font-size: 11px; max-width: 130px;" title="${nombre}">${nombre}</span>
                    <span class="badge ${esActiva ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'} rounded-pill" style="font-size: 9px;">${esActiva ? 'Activa' : 'Inactiva'}</span>
                </div>

                <!-- 1. Editar -->
                <button type="button" class="dropdown-item d-flex align-items-center gap-2 py-1.5 px-2 rounded-2 btn-menu-item btn-menu-editar" data-id="${id}" style="font-size: 12.5px; font-weight: 500;">
                    <i class="bi bi-pencil-square text-primary"></i> Editar Categoría
                </button>

                <!-- 2. Cambiar Estado (Toggle) -->
                <button type="button" class="dropdown-item d-flex align-items-center gap-2 py-1.5 px-2 rounded-2 btn-menu-item btn-menu-toggle-estado" data-id="${id}" data-estado-actual="${categoria.estado}" style="font-size: 12.5px; font-weight: 500;">
                    <i class="bi ${esActiva ? 'bi-toggle-on text-success' : 'bi-toggle-off text-muted'}"></i> ${esActiva ? 'Desactivar' : 'Activar'}
                </button>

                <!-- 3. Ver en Gastos / Ingresos -->
                <a href="${esEgreso ? '#/gastos/pagos' : '#/ingresos/operativos'}" class="dropdown-item d-flex align-items-center gap-2 py-1.5 px-2 rounded-2 btn-menu-item" style="font-size: 12.5px; font-weight: 500; text-decoration: none;">
                    <i class="bi ${esEgreso ? 'bi-arrow-up-right text-danger' : 'bi-arrow-down-left text-success'}"></i> Ver en ${esEgreso ? 'Gastos' : 'Ingresos'}
                </a>

                <div class="dropdown-divider my-1"></div>

                <!-- 4. Eliminar -->
                <button type="button" class="dropdown-item d-flex align-items-center gap-2 py-1.5 px-2 rounded-2 btn-menu-item text-danger btn-menu-eliminar" data-id="${id}" data-nombre="${nombre}" data-count="${numCount}" style="font-size: 12.5px; font-weight: 500;">
                    <i class="bi bi-trash3 text-danger"></i> Eliminar
                </button>
            </div>
        `;
    }
};
