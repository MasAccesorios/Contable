// js/modules/inventario/analisisNanocarbon.js
// Módulo de Análisis de NanoCarbón (Rollo Madre y Códigos Derivados)

import { supabase } from '../../core/supabase.js';
import { escapeHtml } from '../../shared/formatters.js';

// ==========================================
// 1. DATA LAYER
// ==========================================
export const AnalisisNanocarbonData = {
    async fetchAnalisis(dias = 90, umbralRollo = 30) {
        try {
            const { data, error } = await supabase.rpc('get_analisis_nanocarbon', {
                p_dias: parseInt(dias, 10),
                p_umbral_dias_rollo: parseInt(umbralRollo, 10)
            });

            if (error) throw error;
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error al consultar get_analisis_nanocarbon:', err);
            return [];
        }
    },

    getRolloResumen() {
        return (this.state.rawData || []).find(it => it.tipo === 'resumen_rollo') || null;
    },

    getSkuItems() {
        let items = (this.state.rawData || []).filter(it => it.tipo === 'sku');

        const col = this.state.sortColumn;
        if (!col) return items;

        const dir = this.state.sortDirection === 'asc' ? 1 : -1;

        items.sort((a, b) => {
            let valA = a[col];
            let valB = b[col];

            const numCols = [
                'unidades_vendidas_periodo', 'tendencia_pct', 'metros_por_unidad',
                'metros_consumidos_periodo', 'precio_venta', 'costo_base',
                'margen_pct', 'ingreso_periodo', 'margen_generado_periodo'
            ];

            if (numCols.includes(col)) {
                valA = valA != null ? Number(valA) : -Infinity;
                valB = valB != null ? Number(valB) : -Infinity;
                return (valA - valB) * dir;
            }

            valA = (valA || '').toString().toLowerCase();
            valB = (valB || '').toString().toLowerCase();
            return valA.localeCompare(valB) * dir;
        });

        return items;
    }
};

// ==========================================
// 2. TEMPLATES LAYER
// ==========================================
export const AnalisisNanocarbonTemplates = {
    getLayoutHTML() {
        return `
            <div class="dash-layout p-4">
                <!-- TOP BAR -->
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="page-title mb-1">Análisis NanoCarbón</h2>
                        <p class="text-muted mb-0" style="font-size: var(--fs-md);">Control de abastecimiento del rollo madre compartido y rentabilidad de códigos fraccionados.</p>
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <!-- SELECTOR VENTANA DE TIEMPO -->
                        <div class="d-flex align-items-center bg-white border rounded px-2 py-1 shadow-sm">
                            <span class="text-muted me-2 small fw-medium"><i class="bi bi-clock-history me-1"></i>Periodo:</span>
                            <select id="select-periodo-dias" class="form-select form-select-sm border-0 bg-transparent fw-bold" style="width: 110px; box-shadow: none; cursor: pointer;">
                                <option value="30">30 días</option>
                                <option value="60">60 días</option>
                                <option value="90" selected>90 días</option>
                            </select>
                        </div>
                        <!-- SELECTOR UMBRAL ALERTA ROLLO -->
                        <div class="d-flex align-items-center bg-white border rounded px-2 py-1 shadow-sm">
                            <span class="text-muted me-2 small fw-medium"><i class="bi bi-shield-check me-1"></i>Alerta rollo:</span>
                            <select id="select-umbral-rollo" class="form-select form-select-sm border-0 bg-transparent fw-bold" style="width: 110px; box-shadow: none; cursor: pointer;">
                                <option value="15">15 días</option>
                                <option value="30" selected>30 días</option>
                                <option value="45">45 días</option>
                                <option value="60">60 días</option>
                            </select>
                        </div>
                        <button id="btn-refresh-nanocarbon" class="btn btn-light bg-white border shadow-sm" title="Recargar datos">
                            <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
                        </button>
                        <button id="btn-exportar-nanocarbon" class="btn btn-primary-action">
                            <i class="bi bi-download me-1"></i> Exportar
                        </button>
                    </div>
                </div>

                <!-- SECCIÓN TARJETA DESTACADA ROLLO -->
                <div id="section-rollo-container" class="mb-4">
                    <div class="card border-0 shadow-sm p-4 text-center text-muted">
                        <span class="spinner-border spinner-border-sm me-2"></span>Cargando datos del rollo madre...
                    </div>
                </div>

                <!-- TABLA CÓDIGOS HIJOS -->
                <div class="dash-table-container">
                    <div class="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center flex-wrap gap-2" style="border-radius: 8px 8px 0 0;">
                        <div>
                            <h5 class="mb-0 fw-bold" style="color: var(--text-main);">Códigos Hijos Derivados (Corte de Bobina)</h5>
                            <small class="text-muted">Ventas, consumo de metros y margen unitario vs consolidado</small>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-light text-dark border px-3 py-2 rounded-pill fw-medium" id="sku-count-badge">
                                5 SKUs hijos
                            </span>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0">
                            <thead style="border-bottom: 1px solid var(--border-color);" id="nanocarbon-thead">
                                ${this.getTableHeaderHTML()}
                            </thead>
                            <tbody id="nanocarbon-tbody">
                                <tr>
                                    <td colspan="11" class="text-center py-5 text-muted">
                                        <span class="spinner-border spinner-border-sm me-2"></span>Cargando códigos derivados...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    getRolloCardHTML(rollo) {
        if (!rollo) {
            return `
                <div class="card border-0 shadow-sm p-4 text-center text-muted">
                    <i class="bi bi-exclamation-circle fs-3 text-secondary d-block mb-1"></i>
                    No se encontró información del rollo madre compartido (SKU 5000-ROLLO).
                </div>
            `;
        }

        const metrosStock = rollo.metros_stock_actual != null 
            ? `${Number(rollo.metros_stock_actual).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m` 
            : '0 m';

        const valorStock = rollo.valor_stock_actual != null 
            ? `$${Math.round(Number(rollo.valor_stock_actual)).toLocaleString('es-CO')}` 
            : '$0';

        const consumoDiario = rollo.consumo_diario_metros != null 
            ? `${Number(rollo.consumo_diario_metros).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m/día` 
            : '0.00 m/día';

        const diasRestantesNum = rollo.dias_restantes_rollo != null ? Math.round(Number(rollo.dias_restantes_rollo)) : null;
        const diasRestantesStr = diasRestantesNum != null 
            ? `${diasRestantesNum} días` 
            : 'N/A';

        const fechaAgotamiento = rollo.fecha_estimada_agotamiento 
            ? escapeHtml(String(rollo.fecha_estimada_agotamiento).slice(0, 10)) 
            : 'N/A';

        const badgeRollo = this.getBadgeRolloHTML(rollo.recomendacion);

        const isCritico = diasRestantesNum != null && diasRestantesNum <= this.state.umbralRollo;

        return `
            <div class="card border-0 shadow-sm mb-4" id="card-resumen-rollo">
                <div class="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-primary text-white rounded-pill px-2 py-1"><i class="bi bi-bullseye"></i></span>
                        <h5 class="mb-0 fw-bold" style="color: var(--text-main);">Estado del Rollo Madre (NanoCarbón)</h5>
                        <span class="badge bg-light text-secondary border rounded-pill fw-normal">SKU: ${escapeHtml(rollo.sku || '5000-ROLLO')}</span>
                    </div>
                    <div>
                        ${badgeRollo}
                    </div>
                </div>
                <div class="card-body p-4">
                    <div class="row g-3">
                        <div class="col-12 col-sm-6 col-lg-3">
                            <div class="p-3 bg-light rounded-3 border h-100">
                                <span class="text-muted small fw-medium d-block mb-1">Metros en Stock Actual</span>
                                <h3 class="fw-bold mb-1" style="color: var(--text-main);">${metrosStock}</h3>
                                <small class="text-muted">Valor total: <span class="fw-medium">${valorStock}</span></small>
                            </div>
                        </div>
                        <div class="col-12 col-sm-6 col-lg-3">
                            <div class="p-3 bg-light rounded-3 border h-100">
                                <span class="text-muted small fw-medium d-block mb-1">Consumo Diario Promedio</span>
                                <h3 class="fw-bold mb-1 text-primary">${consumoDiario}</h3>
                                <small class="text-muted">Basado en últimos ${this.state.diasPeriodo} días</small>
                            </div>
                        </div>
                        <div class="col-12 col-sm-6 col-lg-3">
                            <div class="p-3 bg-light rounded-3 border h-100">
                                <span class="text-muted small fw-medium d-block mb-1">Días Restantes Estimados</span>
                                <h3 class="fw-bold mb-1 ${isCritico ? 'text-danger' : 'text-success'}">${diasRestantesStr}</h3>
                                <small class="text-muted">Umbral de alerta: &le; ${this.state.umbralRollo} días</small>
                            </div>
                        </div>
                        <div class="col-12 col-sm-6 col-lg-3">
                            <div class="p-3 bg-light rounded-3 border h-100">
                                <span class="text-muted small fw-medium d-block mb-1">Fecha Estimada Agotamiento</span>
                                <h3 class="fw-bold mb-1 text-dark">${fechaAgotamiento}</h3>
                                <small class="text-muted">Proyección según ritmo actual</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    getBadgeRolloHTML(rec) {
        if (!rec) return '<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle fw-medium px-3 py-2 rounded-pill">Sin recomendación</span>';
        const recStr = String(rec).trim();
        const lower = recStr.toLowerCase();

        // Rojo "Comprar rollo urgente"
        if (lower.includes('urgente') || lower.includes('comprar rollo urgente')) {
            return `<span class="badge bg-danger text-white fw-bold px-3 py-2 rounded-pill shadow-sm"><i class="bi bi-lightning-fill me-1"></i>${escapeHtml(recStr)}</span>`;
        }
        // Amarillo "Planificar compra de rollo pronto"
        if (lower.includes('planificar') || lower.includes('pronto')) {
            return `<span class="badge bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle fw-bold px-3 py-2 rounded-pill"><i class="bi bi-exclamation-triangle-fill me-1"></i>${escapeHtml(recStr)}</span>`;
        }
        // Verde "Stock de rollo suficiente"
        if (lower.includes('suficiente')) {
            return `<span class="badge bg-success text-white fw-bold px-3 py-2 rounded-pill shadow-sm"><i class="bi bi-check-circle-fill me-1"></i>${escapeHtml(recStr)}</span>`;
        }
        // Gris "Sin consumo en el periodo"
        if (lower.includes('sin consumo')) {
            return `<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle fw-medium px-3 py-2 rounded-pill"><i class="bi bi-dash-circle me-1"></i>${escapeHtml(recStr)}</span>`;
        }

        return `<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle fw-medium px-3 py-2 rounded-pill">${escapeHtml(recStr)}</span>`;
    },

    getTableHeaderHTML() {
        const col = this.state.sortColumn;
        const dir = this.state.sortDirection;

        const getSortIcon = (targetCol) => {
            if (col !== targetCol) return '<i class="bi bi-arrow-down-up text-muted opacity-25 ms-1" style="font-size: 0.75rem;"></i>';
            return dir === 'asc' 
                ? '<i class="bi bi-arrow-up-short text-primary fw-bold ms-1" style="font-size: 1rem;"></i>' 
                : '<i class="bi bi-arrow-down-short text-primary fw-bold ms-1" style="font-size: 1rem;"></i>';
        };

        return `
            <tr style="color: var(--text-muted); font-size: var(--fs-base); font-weight: var(--weight-medium);">
                <th class="py-3 ps-4 sort-col" data-col="sku" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    SKU ${getSortIcon('sku')}
                </th>
                <th class="py-3 sort-col" data-col="nombre" style="cursor: pointer; user-select: none; min-width: 200px;">
                    Nombre ${getSortIcon('nombre')}
                </th>
                <th class="py-3 text-end sort-col" data-col="unidades_vendidas_periodo" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Vendidas (${this.state.diasPeriodo}d) ${getSortIcon('unidades_vendidas_periodo')}
                </th>
                <th class="py-3 text-end sort-col" data-col="tendencia_pct" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Tendencia % ${getSortIcon('tendencia_pct')}
                </th>
                <th class="py-3 text-end sort-col" data-col="metros_por_unidad" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Metros/und ${getSortIcon('metros_por_unidad')}
                </th>
                <th class="py-3 text-end sort-col" data-col="metros_consumidos_periodo" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Metros consumidos ${getSortIcon('metros_consumidos_periodo')}
                </th>
                <th class="py-3 text-end sort-col" data-col="precio_venta" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Precio venta ${getSortIcon('precio_venta')}
                </th>
                <th class="py-3 text-end sort-col" data-col="costo_base" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Costo base ${getSortIcon('costo_base')}
                </th>
                <th class="py-3 text-end sort-col" data-col="margen_pct" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Margen % ${getSortIcon('margen_pct')}
                </th>
                <th class="py-3 text-end sort-col" data-col="margen_generado_periodo" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Margen generado ${getSortIcon('margen_generado_periodo')}
                </th>
                <th class="py-3 text-center pe-4 sort-col" data-col="recomendacion" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Recomendación ${getSortIcon('recomendacion')}
                </th>
            </tr>
        `;
    },

    getTableRowsHTML(items) {
        if (!items || items.length === 0) {
            return `
                <tr>
                    <td colspan="11" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary opacity-50"></i>
                        No se encontraron códigos derivados de NanoCarbón.
                    </td>
                </tr>
            `;
        }

        return items.map(item => {
            const sku = escapeHtml(item.sku || 'S/R');
            const nombre = escapeHtml(item.nombre || 'Sin nombre');
            const vendidas = item.unidades_vendidas_periodo != null ? Number(item.unidades_vendidas_periodo).toLocaleString('es-CO') : '0';
            const metrosPorUnidad = item.metros_por_unidad != null ? `${Number(item.metros_por_unidad).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m` : '-';
            const metrosConsumidos = item.metros_consumidos_periodo != null ? `${Number(item.metros_consumidos_periodo).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m` : '0 m';
            const precioVenta = item.precio_venta != null ? `$${Math.round(Number(item.precio_venta)).toLocaleString('es-CO')}` : '$0';
            const costoBase = item.costo_base != null ? `$${Math.round(Number(item.costo_base)).toLocaleString('es-CO')}` : '$0';

            const margenNum = item.margen_pct != null ? Number(item.margen_pct) : 0;
            const esMargenNegativo = margenNum < 0;

            const margenGeneradoNum = item.margen_generado_periodo != null ? Number(item.margen_generado_periodo) : 0;
            const margenGeneradoStr = (margenGeneradoNum < 0 ? '-' : '') + '$' + Math.abs(Math.round(margenGeneradoNum)).toLocaleString('es-CO');

            const tendenciaHTML = this.getTendenciaHTML(item.tendencia_pct);
            const badgeHTML = this.getRecomendacionBadgeHTML(item.recomendacion);

            // Alerta visual distintiva para margen negativo: fondo rojizo y borde indicador
            const rowStyle = esMargenNegativo 
                ? 'background-color: rgba(220, 53, 69, 0.08); border-left: 4px solid var(--danger); border-bottom: 1px solid rgba(220, 53, 69, 0.2); font-size: var(--fs-base);' 
                : 'border-bottom: 1px solid var(--border-color); font-size: var(--fs-base);';

            const margenHTML = esMargenNegativo
                ? `<span class="badge bg-danger text-white fw-bold px-2 py-1 shadow-sm"><i class="bi bi-exclamation-triangle-fill me-1"></i>${margenNum.toFixed(1)}%</span>`
                : `<span class="fw-semibold ${margenNum > 30 ? 'text-success' : ''}">${margenNum.toFixed(1)}%</span>`;

            const margenGenHTML = esMargenNegativo
                ? `<span class="text-danger fw-bold">${margenGeneradoStr}</span>`
                : `<span class="fw-medium">${margenGeneradoStr}</span>`;

            return `
                <tr style="${rowStyle}">
                    <td class="py-3 ps-4 text-nowrap fw-bold font-monospace" style="color: var(--text-main);">
                        ${sku}
                    </td>
                    <td class="py-3 fw-medium" style="color: var(--text-main);">
                        ${nombre}
                        ${esMargenNegativo ? '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle ms-2 small">Pérdida por unidad</span>' : ''}
                    </td>
                    <td class="py-3 text-end text-nowrap fw-medium">
                        ${vendidas}
                    </td>
                    <td class="py-3 text-end text-nowrap">
                        ${tendenciaHTML}
                    </td>
                    <td class="py-3 text-end text-nowrap text-muted">
                        ${metrosPorUnidad}
                    </td>
                    <td class="py-3 text-end text-nowrap fw-semibold text-primary">
                        ${metrosConsumidos}
                    </td>
                    <td class="py-3 text-end text-nowrap">
                        ${precioVenta}
                    </td>
                    <td class="py-3 text-end text-nowrap text-muted">
                        ${costoBase}
                    </td>
                    <td class="py-3 text-end text-nowrap">
                        ${margenHTML}
                    </td>
                    <td class="py-3 text-end text-nowrap">
                        ${margenGenHTML}
                    </td>
                    <td class="py-3 text-center pe-4 text-nowrap">
                        ${badgeHTML}
                    </td>
                </tr>
            `;
        }).join('');
    },

    getTendenciaHTML(val) {
        if (val == null || isNaN(val)) return '<span class="text-muted"><i class="bi bi-dash me-1"></i>0.0%</span>';
        const num = Number(val);
        if (num > 0) {
            return `<span class="text-success fw-medium"><i class="bi bi-arrow-up-right me-1"></i>+${num.toFixed(1)}%</span>`;
        }
        if (num < 0) {
            return `<span class="text-danger fw-medium"><i class="bi bi-arrow-down-right me-1"></i>${num.toFixed(1)}%</span>`;
        }
        return '<span class="text-muted"><i class="bi bi-dash me-1"></i>0.0%</span>';
    },

    getRecomendacionBadgeHTML(rec) {
        if (!rec) return '<span class="badge bg-light text-dark border fw-medium px-2 py-1 rounded-pill">Sin recomendación</span>';
        const recStr = String(rec).trim();
        const lower = recStr.toLowerCase();

        if (lower.includes('urgente')) {
            return `<span class="badge bg-success text-white fw-medium px-2 py-1 rounded-pill shadow-sm"><i class="bi bi-lightning-fill me-1"></i>${escapeHtml(recStr)}</span>`;
        }
        if (lower.startsWith('recomprar')) {
            return `<span class="badge bg-success text-success bg-opacity-10 border border-success-subtle fw-medium px-2 py-1 rounded-pill">${escapeHtml(recStr)}</span>`;
        }
        if (lower.includes('mantener')) {
            return `<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle fw-medium px-2 py-1 rounded-pill">${escapeHtml(recStr)}</span>`;
        }
        if (lower.includes('revisar') || lower.includes('demand') || lower.includes('cayendo')) {
            return `<span class="badge bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle fw-medium px-2 py-1 rounded-pill">${escapeHtml(recStr)}</span>`;
        }
        if (lower.includes('no recomprar')) {
            return `<span class="badge bg-danger text-danger bg-opacity-10 border border-danger-subtle fw-medium px-2 py-1 rounded-pill">${escapeHtml(recStr)}</span>`;
        }

        return `<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle fw-medium px-2 py-1 rounded-pill">${escapeHtml(recStr)}</span>`;
    }
};

// ==========================================
// 3. EVENTS LAYER
// ==========================================
export const AnalisisNanocarbonEvents = {
    bindEvents() {
        const el = this.element;
        if (!el) return;

        // Selector periodo días
        el.querySelector('#select-periodo-dias')?.addEventListener('change', async (e) => {
            this.state.diasPeriodo = parseInt(e.target.value, 10) || 90;
            await this.cargarDatos();
        });

        // Selector umbral rollo
        el.querySelector('#select-umbral-rollo')?.addEventListener('change', async (e) => {
            this.state.umbralRollo = parseInt(e.target.value, 10) || 30;
            await this.cargarDatos();
        });

        // Botón Actualizar
        el.querySelector('#btn-refresh-nanocarbon')?.addEventListener('click', async () => {
            await this.cargarDatos();
        });

        // Botón Exportar CSV
        el.querySelector('#btn-exportar-nanocarbon')?.addEventListener('click', () => {
            this.exportarCSV();
        });

        // Click en cabeceras de tabla para ordenamiento
        this.bindSortHeaders();
    },

    bindSortHeaders() {
        const thead = this.element.querySelector('#nanocarbon-thead');
        if (!thead) return;

        thead.querySelectorAll('.sort-col').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (this.state.sortColumn === col) {
                    this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.state.sortColumn = col;
                    if (['sku', 'nombre', 'recomendacion'].includes(col)) {
                        this.state.sortDirection = 'asc';
                    } else {
                        this.state.sortDirection = 'desc';
                    }
                }
                thead.innerHTML = this.getTableHeaderHTML();
                this.bindSortHeaders();
                this.renderGrid();
            });
        });
    }
};

// ==========================================
// 4. ORQUESTADOR (MODULE)
// ==========================================
export const AnalisisNanocarbonModule = {
    state: {
        diasPeriodo: 90,
        umbralRollo: 30,
        rawData: [],
        sortColumn: 'margen_generado_periodo',
        sortDirection: 'desc',
        isLoading: false
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        this.state.sortColumn = 'margen_generado_periodo';
        this.state.sortDirection = 'desc';

        // Renderizar cascarón
        element.innerHTML = this.getLayoutHTML();

        // Bind events
        this.bindEvents();

        // Cargar datos
        await this.cargarDatos();
    },

    async cargarDatos() {
        this.state.isLoading = true;

        const rolloContainer = this.element.querySelector('#section-rollo-container');
        const tbody = this.element.querySelector('#nanocarbon-tbody');

        if (rolloContainer) {
            rolloContainer.innerHTML = `
                <div class="card border-0 shadow-sm p-4 text-center text-muted">
                    <span class="spinner-border spinner-border-sm me-2"></span>Analizando métricas del rollo madre (${this.state.diasPeriodo} días)...
                </div>
            `;
        }

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-5 text-muted">
                        <span class="spinner-border spinner-border-sm me-2"></span>Calculando consumo y rentabilidad de códigos fraccionados...
                    </td>
                </tr>
            `;
        }

        const data = await this.fetchAnalisis(this.state.diasPeriodo, this.state.umbralRollo);
        this.state.rawData = data;
        this.state.isLoading = false;

        this.renderRolloCard();
        this.renderGrid();
    },

    renderRolloCard() {
        const rollo = this.getRolloResumen();
        const container = this.element.querySelector('#section-rollo-container');
        if (container) {
            container.innerHTML = this.getRolloCardHTML(rollo);
        }
    },

    renderGrid() {
        const skus = this.getSkuItems();
        const tbody = this.element.querySelector('#nanocarbon-tbody');
        const badgeCount = this.element.querySelector('#sku-count-badge');

        if (badgeCount) {
            badgeCount.textContent = `${skus.length} SKUs analizados`;
        }

        if (tbody) {
            tbody.innerHTML = this.getTableRowsHTML(skus);
        }
    },

    exportarCSV() {
        const raw = this.state.rawData || [];
        if (!raw || raw.length === 0) {
            alert('No hay datos disponibles para exportar.');
            return;
        }

        const encabezados = [
            'Tipo',
            'SKU',
            'Nombre',
            'Vendidas Periodo',
            'Tendencia %',
            'Metros Por Unidad',
            'Metros Consumidos Periodo',
            'Precio Venta',
            'Costo Base',
            'Margen %',
            'Margen Generado Periodo',
            'Metros Stock Actual',
            'Valor Stock Actual',
            'Consumo Diario Metros',
            'Dias Restantes Rollo',
            'Fecha Estimada Agotamiento',
            'Recomendacion'
        ];

        const filas = raw.map(it => [
            `"${it.tipo || ''}"`,
            `"${(it.sku || '').toString().replace(/"/g, '""')}"`,
            `"${(it.nombre || '').toString().replace(/"/g, '""')}"`,
            it.unidades_vendidas_periodo != null ? it.unidades_vendidas_periodo : '',
            it.tendencia_pct != null ? it.tendencia_pct : '',
            it.metros_por_unidad != null ? it.metros_por_unidad : '',
            it.metros_consumidos_periodo != null ? it.metros_consumidos_periodo : '',
            it.precio_venta != null ? it.precio_venta : '',
            it.costo_base != null ? it.costo_base : '',
            it.margen_pct != null ? it.margen_pct : '',
            it.margen_generado_periodo != null ? it.margen_generado_periodo : '',
            it.metros_stock_actual != null ? it.metros_stock_actual : '',
            it.valor_stock_actual != null ? it.valor_stock_actual : '',
            it.consumo_diario_metros != null ? it.consumo_diario_metros : '',
            it.dias_restantes_rollo != null ? it.dias_restantes_rollo : '',
            it.fecha_estimada_agotamiento ? `"${it.fecha_estimada_agotamiento}"` : '',
            `"${(it.recomendacion || '').toString().replace(/"/g, '""')}"`
        ]);

        const contenido = [encabezados.join(','), ...filas.map(f => f.join(','))].join('\r\n');
        const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analisis_nanocarbon_${this.state.diasPeriodo}d_alerta${this.state.umbralRollo}d_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

Object.assign(AnalisisNanocarbonModule, AnalisisNanocarbonData, AnalisisNanocarbonTemplates, AnalisisNanocarbonEvents);
