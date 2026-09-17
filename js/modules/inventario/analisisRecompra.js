// js/modules/inventario/analisisRecompra.js
// Módulo de Análisis de Recompra de Productos

import { supabase } from '../../core/supabase.js';
import { escapeHtml } from '../../shared/formatters.js';

// ==========================================
// 1. DATA LAYER
// ==========================================
export const AnalisisRecompraData = {
    async fetchAnalisis(dias = 90) {
        try {
            const { data, error } = await supabase.rpc('get_analisis_recompra_productos', {
                p_dias: parseInt(dias, 10)
            });

            if (error) throw error;
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error al consultar get_analisis_recompra_productos:', err);
            return [];
        }
    },

    getProcessedData() {
        let items = [...(this.state.rawData || [])];

        // Filtro por búsqueda (SKU o Nombre)
        if (this.state.searchQuery) {
            const q = this.state.searchQuery.toLowerCase();
            items = items.filter(it => 
                (it.sku && String(it.sku).toLowerCase().includes(q)) ||
                (it.nombre && String(it.nombre).toLowerCase().includes(q))
            );
        }

        // Filtro por Recomendación
        if (this.state.filterRecomendacion && this.state.filterRecomendacion !== 'todas') {
            const fr = this.state.filterRecomendacion.toLowerCase();
            items = items.filter(it => {
                const rec = (it.recomendacion || '').toLowerCase();
                if (fr === 'urgente') return rec.includes('urgente');
                if (fr === 'recomprar') return rec.startsWith('recomprar') && !rec.includes('urgente');
                if (fr === 'mantener') return rec.includes('mantener');
                if (fr === 'revisar') return rec.includes('revisar') || rec.includes('demand') || rec.includes('cayendo');
                if (fr === 'no_recomprar') return rec.includes('no recomprar');
                return true;
            });
        }

        // Ordenamiento
        const col = this.state.sortColumn;
        const dir = this.state.sortDirection === 'asc' ? 1 : -1;

        items.sort((a, b) => {
            let valA = a[col];
            let valB = b[col];

            // Manejo de valores numéricos
            if (['stock_actual', 'margen_pct', 'unidades_vendidas_periodo', 'tendencia_pct', 'rotacion_dias', 'variacion_costo_pct', 'margen_generado_periodo', 'precio_venta', 'costo_base'].includes(col)) {
                valA = valA != null ? Number(valA) : -Infinity;
                valB = valB != null ? Number(valB) : -Infinity;
                return (valA - valB) * dir;
            }

            // Manejo de strings
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
export const AnalisisRecompraTemplates = {
    getLayoutHTML() {
        return `
            <div class="dash-layout p-4">
                <!-- TOP BAR -->
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="page-title mb-1">Análisis de Recompra</h2>
                        <p class="text-muted mb-0" style="font-size: var(--fs-md);">Sugerencias inteligentes de abastecimiento basadas en ventas, rotación y margen.</p>
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <div class="d-flex align-items-center bg-white border rounded px-2 py-1 shadow-sm">
                            <span class="text-muted me-2 small fw-medium"><i class="bi bi-clock-history me-1"></i>Periodo:</span>
                            <select id="select-periodo-dias" class="form-select form-select-sm border-0 bg-transparent fw-bold" style="width: 130px; box-shadow: none; cursor: pointer;">
                                <option value="30">30 días</option>
                                <option value="60">60 días</option>
                                <option value="90" selected>90 días</option>
                            </select>
                        </div>
                        <button id="btn-refresh-analisis" class="btn btn-light bg-white border shadow-sm" title="Recargar datos">
                            <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
                        </button>
                        <button id="btn-exportar-recompra" class="btn btn-primary-action">
                            <i class="bi bi-download me-1"></i> Exportar
                        </button>
                    </div>
                </div>

                <!-- CARDS RESUMEN -->
                <div class="row g-3 mb-4" id="kpi-cards-row">
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="card p-3 shadow-sm border-0 h-100">
                            <span class="text-muted small fw-medium">Total Analizados</span>
                            <h3 class="fw-bold mb-0 mt-2" id="kpi-total-items" style="color: var(--text-main);">-</h3>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="card p-3 shadow-sm border-0 h-100">
                            <span class="text-success small fw-medium"><i class="bi bi-lightning-charge-fill me-1"></i>Recomprar Urgente</span>
                            <h3 class="fw-bold mb-0 mt-2 text-success" id="kpi-urgentes">-</h3>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="card p-3 shadow-sm border-0 h-100">
                            <span class="text-primary small fw-medium"><i class="bi bi-cart-plus me-1"></i>Recomprar Normal</span>
                            <h3 class="fw-bold mb-0 mt-2 text-primary" id="kpi-recomprar">-</h3>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="card p-3 shadow-sm border-0 h-100">
                            <span class="text-warning-emphasis small fw-medium"><i class="bi bi-exclamation-triangle me-1"></i>Revisar / No Recomprar</span>
                            <h3 class="fw-bold mb-0 mt-2 text-warning-emphasis" id="kpi-revisar">-</h3>
                        </div>
                    </div>
                </div>

                <!-- DATA TABLE CONTAINER -->
                <div class="dash-table-container">
                    <!-- FILTROS -->
                    <div class="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center flex-wrap gap-3" style="border-radius: 8px 8px 0 0;">
                        <div class="d-flex align-items-center gap-3 flex-wrap">
                            <div class="input-group input-group-sm" style="width: 280px;">
                                <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                                <input type="text" id="search-recompra" class="form-control border-start-0 ps-0 text-muted" placeholder="Buscar por SKU o nombre..." style="font-size: var(--fs-base); box-shadow: none;">
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="text-muted small">Recomendación:</span>
                                <select id="filter-recomendacion" class="form-select form-select-sm" style="width: 210px;">
                                    <option value="todas">Todas</option>
                                    <option value="urgente">Recomprar urgente</option>
                                    <option value="recomprar">Recomprar</option>
                                    <option value="mantener">Mantener stock actual</option>
                                    <option value="revisar">Revisar - demanda cayendo</option>
                                    <option value="no_recomprar">No recomprar</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- TABLA -->
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0">
                            <thead style="border-bottom: 1px solid var(--border-color);" id="recompra-thead">
                                ${this.getTableHeaderHTML()}
                            </thead>
                            <tbody id="recompra-tbody">
                                <tr>
                                    <td colspan="9" class="text-center py-5 text-muted">
                                        <span class="spinner-border spinner-border-sm me-2"></span>Cargando análisis de recompra...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- PAGINACIÓN -->
                    <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center flex-wrap gap-2 text-muted small" id="recompra-pagination">
                        ${this.getPaginationHTML(0, 0, 1, 25)}
                    </div>
                </div>
            </div>
        `;
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
                <th class="py-3 sort-col" data-col="nombre" style="cursor: pointer; user-select: none; min-width: 220px;">
                    Nombre ${getSortIcon('nombre')}
                </th>
                <th class="py-3 text-end sort-col" data-col="stock_actual" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Stock actual ${getSortIcon('stock_actual')}
                </th>
                <th class="py-3 text-end sort-col" data-col="margen_pct" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Margen % ${getSortIcon('margen_pct')}
                </th>
                <th class="py-3 text-end sort-col" data-col="unidades_vendidas_periodo" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Vendidas (${this.state.diasPeriodo}d) ${getSortIcon('unidades_vendidas_periodo')}
                </th>
                <th class="py-3 text-end sort-col" data-col="tendencia_pct" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Tendencia % ${getSortIcon('tendencia_pct')}
                </th>
                <th class="py-3 text-end sort-col" data-col="rotacion_dias" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Rotación (días) ${getSortIcon('rotacion_dias')}
                </th>
                <th class="py-3 text-end sort-col" data-col="variacion_costo_pct" style="cursor: pointer; user-select: none; white-space: nowrap;">
                    Var. Costo Compra % ${getSortIcon('variacion_costo_pct')}
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
                    <td colspan="9" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary opacity-50"></i>
                        No se encontraron productos para el criterio seleccionado.
                    </td>
                </tr>
            `;
        }

        return items.map(item => {
            const sku = escapeHtml(item.sku || 'S/R');
            const nombre = escapeHtml(item.nombre || 'Sin nombre');
            const stock = item.stock_actual != null ? Number(item.stock_actual).toLocaleString('es-CO') : '0';
            const margen = item.margen_pct != null ? `${Number(item.margen_pct).toFixed(1)}%` : '0.0%';
            const vendidas = item.unidades_vendidas_periodo != null ? Number(item.unidades_vendidas_periodo).toLocaleString('es-CO') : '0';
            
            const tendenciaHTML = this.getTendenciaHTML(item.tendencia_pct);
            const rotacionHTML = this.getRotacionHTML(item.rotacion_dias);
            const varCostoHTML = this.getVariacionCostoHTML(item.variacion_costo_pct);
            const badgeHTML = this.getRecomendacionBadgeHTML(item.recomendacion);

            return `
                <tr style="border-bottom: 1px solid var(--border-color); font-size: var(--fs-base);">
                    <td class="py-3 ps-4 text-nowrap fw-medium" style="color: var(--text-main); font-family: monospace;">
                        ${sku}
                    </td>
                    <td class="py-3 fw-medium" style="color: var(--text-main);">
                        ${nombre}
                    </td>
                    <td class="py-3 text-end text-nowrap fw-medium">
                        ${stock}
                    </td>
                    <td class="py-3 text-end text-nowrap">
                        <span class="fw-semibold">${margen}</span>
                    </td>
                    <td class="py-3 text-end text-nowrap">
                        ${vendidas}
                    </td>
                    <td class="py-3 text-end text-nowrap">
                        ${tendenciaHTML}
                    </td>
                    <td class="py-3 text-end text-nowrap text-muted">
                        ${rotacionHTML}
                    </td>
                    <td class="py-3 text-end text-nowrap">
                        ${varCostoHTML}
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

    getRotacionHTML(val) {
        if (val == null || isNaN(val)) return '<span class="text-muted">N/A</span>';
        const num = Number(val);
        if (num >= 999 || num > 365) return '<span class="text-muted">> 365 días</span>';
        if (num <= 0) return '<span class="text-danger fw-medium">0 días (Agotado)</span>';
        return `<span>${Math.round(num)} días</span>`;
    },

    getVariacionCostoHTML(val) {
        if (val == null || isNaN(val)) return '<span class="text-muted">0.0%</span>';
        const num = Number(val);
        if (num > 0) {
            return `<span class="text-danger fw-medium">+${num.toFixed(1)}%</span>`;
        }
        if (num < 0) {
            return `<span class="text-success fw-medium">${num.toFixed(1)}%</span>`;
        }
        return '<span class="text-muted">0.0%</span>';
    },

    getRecomendacionBadgeHTML(rec) {
        if (!rec) return '<span class="badge bg-light text-dark border fw-medium px-2 py-1 rounded-pill">Sin recomendación</span>';
        const recStr = String(rec).trim();
        const lower = recStr.toLowerCase();

        // 1. "Recomprar urgente" → badge verde fuerte
        if (lower.includes('urgente')) {
            return `<span class="badge bg-success text-white fw-medium px-2 py-1 rounded-pill shadow-sm"><i class="bi bi-lightning-fill me-1"></i>${escapeHtml(recStr)}</span>`;
        }
        // 2. "Recomprar" → badge verde claro
        if (lower.startsWith('recomprar')) {
            return `<span class="badge bg-success text-success bg-opacity-10 border border-success-subtle fw-medium px-2 py-1 rounded-pill">${escapeHtml(recStr)}</span>`;
        }
        // 3. "Mantener stock actual" → badge gris
        if (lower.includes('mantener')) {
            return `<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle fw-medium px-2 py-1 rounded-pill">${escapeHtml(recStr)}</span>`;
        }
        // 4. "Revisar - demanda cayendo" → badge amarillo/naranja
        if (lower.includes('revisar') || lower.includes('demand') || lower.includes('cayendo')) {
            return `<span class="badge bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle fw-medium px-2 py-1 rounded-pill">${escapeHtml(recStr)}</span>`;
        }
        // 5. "No recomprar - margen bajo" / "No recomprar - sin rotación" → badge rojo
        if (lower.includes('no recomprar')) {
            return `<span class="badge bg-danger text-danger bg-opacity-10 border border-danger-subtle fw-medium px-2 py-1 rounded-pill">${escapeHtml(recStr)}</span>`;
        }

        return `<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle fw-medium px-2 py-1 rounded-pill">${escapeHtml(recStr)}</span>`;
    },

    getPaginationHTML(totalItems, currentPage, totalPages, itemsPerPage) {
        const start = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
        const end = Math.min(currentPage * itemsPerPage, totalItems);

        return `
            <div class="d-flex align-items-center gap-3">
                <span>Página <span id="current-page" class="fw-semibold">${currentPage}</span> de <span id="total-pages" class="fw-semibold">${totalPages}</span></span>
                <div class="btn-group">
                    <button class="btn btn-sm btn-light border text-muted" id="btn-prev-page" ${currentPage <= 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    <button class="btn btn-sm btn-light border text-muted" id="btn-next-page" ${currentPage >= totalPages ? 'disabled' : ''}>
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
            <div class="d-flex align-items-center gap-3">
                <span class="d-flex align-items-center gap-2">
                    Mostrar:
                    <select id="items-per-page" class="form-select form-select-sm border-0 bg-transparent text-muted fw-bold" style="width: 70px; box-shadow: none; cursor: pointer;">
                        <option value="25" ${itemsPerPage === 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
                    </select>
                </span>
                <span id="showing-count">${start}-${end} de ${totalItems}</span>
            </div>
        `;
    }
};

// ==========================================
// 3. EVENTS LAYER
// ==========================================
export const AnalisisRecompraEvents = {
    bindEvents() {
        const el = this.element;
        if (!el) return;

        // Selector periodo días (30 / 60 / 90)
        el.querySelector('#select-periodo-dias')?.addEventListener('change', async (e) => {
            this.state.diasPeriodo = parseInt(e.target.value, 10) || 90;
            this.state.currentPage = 1;
            await this.cargarDatos();
        });

        // Botón Actualizar
        el.querySelector('#btn-refresh-analisis')?.addEventListener('click', async () => {
            await this.cargarDatos();
        });

        // Buscador
        el.querySelector('#search-recompra')?.addEventListener('input', (e) => {
            this.state.searchQuery = e.target.value.trim();
            this.state.currentPage = 1;
            this.renderGrid();
        });

        // Filtro recomendación
        el.querySelector('#filter-recomendacion')?.addEventListener('change', (e) => {
            this.state.filterRecomendacion = e.target.value;
            this.state.currentPage = 1;
            this.renderGrid();
        });

        // Botón Exportar CSV
        el.querySelector('#btn-exportar-recompra')?.addEventListener('click', () => {
            this.exportarCSV();
        });

        // Click en cabeceras de tabla para ordenamiento
        this.bindSortHeaders();

        // Paginación
        this.bindPaginationEvents();
    },

    bindSortHeaders() {
        const thead = this.element.querySelector('#recompra-thead');
        if (!thead) return;

        thead.querySelectorAll('.sort-col').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (this.state.sortColumn === col) {
                    this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.state.sortColumn = col;
                    // Por defecto texto en asc, números en desc
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
    },

    bindPaginationEvents() {
        const el = this.element;

        el.querySelector('#btn-prev-page')?.addEventListener('click', () => {
            if (this.state.currentPage > 1) {
                this.state.currentPage--;
                this.renderGrid();
            }
        });

        el.querySelector('#btn-next-page')?.addEventListener('click', () => {
            const processed = this.getProcessedData();
            const totalPages = Math.ceil(processed.length / this.state.itemsPerPage) || 1;
            if (this.state.currentPage < totalPages) {
                this.state.currentPage++;
                this.renderGrid();
            }
        });

        el.querySelector('#items-per-page')?.addEventListener('change', (e) => {
            this.state.itemsPerPage = parseInt(e.target.value, 10) || 25;
            this.state.currentPage = 1;
            this.renderGrid();
        });
    }
};

// ==========================================
// 4. ORQUESTADOR (MODULE)
// ==========================================
export const AnalisisRecompraModule = {
    state: {
        diasPeriodo: 90,
        rawData: [],
        searchQuery: '',
        filterRecomendacion: 'todas',
        sortColumn: 'margen_generado_periodo',
        sortDirection: 'desc',
        currentPage: 1,
        itemsPerPage: 25,
        isLoading: false
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        // Reinicio de estado de visualización
        this.state.searchQuery = '';
        this.state.filterRecomendacion = 'todas';
        this.state.currentPage = 1;
        this.state.sortColumn = 'margen_generado_periodo';
        this.state.sortDirection = 'desc';

        // Renderizado del cascarón principal
        element.innerHTML = this.getLayoutHTML();

        // Asociar eventos
        this.bindEvents();

        // Cargar datos iniciales
        await this.cargarDatos();
    },

    async cargarDatos() {
        this.state.isLoading = true;
        const tbody = this.element.querySelector('#recompra-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-5 text-muted">
                        <span class="spinner-border spinner-border-sm me-2"></span>Analizando datos de compras y ventas (${this.state.diasPeriodo} días)...
                    </td>
                </tr>
            `;
        }

        const data = await this.fetchAnalisis(this.state.diasPeriodo);
        this.state.rawData = data;
        this.state.isLoading = false;

        this.actualizarKPIs();
        this.renderGrid();
    },

    actualizarKPIs() {
        const raw = this.state.rawData || [];
        const total = raw.length;

        let urgentes = 0;
        let normal = 0;
        let revisar = 0;

        raw.forEach(it => {
            const rec = (it.recomendacion || '').toLowerCase();
            if (rec.includes('urgente')) {
                urgentes++;
            } else if (rec.startsWith('recomprar')) {
                normal++;
            } else if (rec.includes('revisar') || rec.includes('demand') || rec.includes('cayendo') || rec.includes('no recomprar')) {
                revisar++;
            }
        });

        const elTotal = this.element.querySelector('#kpi-total-items');
        const elUrg = this.element.querySelector('#kpi-urgentes');
        const elNorm = this.element.querySelector('#kpi-recomprar');
        const elRev = this.element.querySelector('#kpi-revisar');

        if (elTotal) elTotal.textContent = total.toLocaleString('es-CO');
        if (elUrg) elUrg.textContent = urgentes.toLocaleString('es-CO');
        if (elNorm) elNorm.textContent = normal.toLocaleString('es-CO');
        if (elRev) elRev.textContent = revisar.toLocaleString('es-CO');
    },

    renderGrid() {
        const processed = this.getProcessedData();
        const totalItems = processed.length;
        const totalPages = Math.ceil(totalItems / this.state.itemsPerPage) || 1;

        if (this.state.currentPage > totalPages) {
            this.state.currentPage = totalPages;
        }

        const startIdx = (this.state.currentPage - 1) * this.state.itemsPerPage;
        const endIdx = startIdx + this.state.itemsPerPage;
        const pageItems = processed.slice(startIdx, endIdx);

        // Renderizar cuerpo de la tabla
        const tbody = this.element.querySelector('#recompra-tbody');
        if (tbody) {
            tbody.innerHTML = this.getTableRowsHTML(pageItems);
        }

        // Renderizar paginador
        const paginationContainer = this.element.querySelector('#recompra-pagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = this.getPaginationHTML(totalItems, this.state.currentPage, totalPages, this.state.itemsPerPage);
            this.bindPaginationEvents();
        }
    },

    exportarCSV() {
        const items = this.getProcessedData();
        if (!items || items.length === 0) {
            alert('No hay datos disponibles para exportar.');
            return;
        }

        const encabezados = [
            'SKU',
            'Nombre',
            'Stock Actual',
            'Margen %',
            'Vendidas Periodo',
            'Tendencia %',
            'Rotacion Dias',
            'Variacion Costo Compra %',
            'Recomendacion',
            'Margen Generado Periodo'
        ];

        const filas = items.map(it => [
            `"${(it.sku || '').toString().replace(/"/g, '""')}"`,
            `"${(it.nombre || '').toString().replace(/"/g, '""')}"`,
            it.stock_actual != null ? it.stock_actual : '',
            it.margen_pct != null ? it.margen_pct : '',
            it.unidades_vendidas_periodo != null ? it.unidades_vendidas_periodo : '',
            it.tendencia_pct != null ? it.tendencia_pct : '',
            it.rotacion_dias != null ? it.rotacion_dias : '',
            it.variacion_costo_pct != null ? it.variacion_costo_pct : '',
            `"${(it.recomendacion || '').toString().replace(/"/g, '""')}"`,
            it.margen_generado_periodo != null ? it.margen_generado_periodo : ''
        ]);

        const contenido = [encabezados.join(','), ...filas.map(f => f.join(','))].join('\r\n');
        const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analisis_recompra_${this.state.diasPeriodo}d_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

Object.assign(AnalisisRecompraModule, AnalisisRecompraData, AnalisisRecompraTemplates, AnalisisRecompraEvents);
