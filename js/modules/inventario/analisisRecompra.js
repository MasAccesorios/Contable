// js/modules/inventario/analisisRecompra.js
// Módulo de Análisis de Recompra de Productos 360°
// Rediseño Ergonómico Ejecutivo: Estilo Gastos Operativos & Cero Scrollbars

import { escapeHtml } from '../../shared/formatters.js';

let _supabaseClient = null;

// ==========================================
// 1. DATA LAYER
// ==========================================
export const AnalisisRecompraData = {
    setSupabase(client) {
        _supabaseClient = client;
    },

    getSupabase() {
        return _supabaseClient;
    },

    async fetchAnalisis(dias = 90, umbralCobertura = 30) {
        try {
            const client = this.getSupabase() || (await import('../../core/supabase.js').catch(() => ({}))).supabase;
            if (!client) throw new Error('Cliente Supabase no inicializado');

            const { data, error } = await client.rpc('get_analisis_recompra_productos', {
                p_dias: parseInt(dias, 10),
                p_umbral_dias_cobertura: parseInt(umbralCobertura, 10)
            });

            if (error) throw error;
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Error al consultar get_analisis_recompra_productos:', err);
            return [];
        }
    },

    /**
     * Calcula métricas derivadas de toma de decisiones de compra por ítem.
     */
    calcularMetricasItem(item, diasPeriodo = 90, umbralCobertura = 30) {
        const dias = Math.max(1, parseInt(diasPeriodo, 10) || 90);
        const umbral = Math.max(1, parseInt(umbralCobertura, 10) || 30);

        const vendidas = item.unidades_vendidas_periodo != null ? Number(item.unidades_vendidas_periodo) : 0;
        const stockActual = item.stock_actual != null ? Number(item.stock_actual) : 0;
        const rotacionDias = item.rotacion_dias != null ? Number(item.rotacion_dias) : null;
        
        // Ritmo de ventas diarias
        const ventaDiaria = vendidas > 0 ? (vendidas / dias) : 0;

        // Unidades sugeridas para alcanzar el umbral objetivo de cobertura
        let unidadesSugeridas = 0;
        if (rotacionDias != null && rotacionDias < umbral && vendidas >= 2) {
            const objetivoStock = Math.ceil(ventaDiaria * umbral);
            unidadesSugeridas = Math.max(0, objetivoStock - Math.max(0, stockActual));
        } else if (rotacionDias === 0 && vendidas >= 2) {
            unidadesSugeridas = Math.ceil(ventaDiaria * umbral);
        }

        // Costo de referencia para presupuesto
        const costoReferencia = Number(item.ultima_compra_costo || item.costo_base || 0);
        const presupuestoEstimado = unidadesSugeridas * costoReferencia;

        // Clasificación ejecutiva de recompra
        const recLower = String(item.recomendacion || '').toLowerCase();
        let categoriaRecompra = 'saludable';

        const esRevisar = recLower.includes('revisar') || recLower.includes('demand') || recLower.includes('cayendo') || recLower.includes('no recomprar');
        const esUrgente = !esRevisar && (
            item.reponer_urgente === true || 
            (rotacionDias != null && rotacionDias <= 10 && vendidas >= 3 && (item.tendencia_pct == null || Number(item.tendencia_pct) >= -10)) || 
            recLower.includes('urgente')
        );

        if (esUrgente) {
            categoriaRecompra = 'urgente';
        } else if (esRevisar) {
            categoriaRecompra = 'revisar';
        } else if (recLower.startsWith('recomprar')) {
            categoriaRecompra = 'recomprar';
        }

        return {
            ...item,
            venta_diaria: Number(ventaDiaria.toFixed(2)),
            unidades_sugeridas: unidadesSugeridas,
            costo_referencia: costoReferencia,
            presupuesto_estimado: presupuestoEstimado,
            categoria_recompra: categoriaRecompra
        };
    },

    /**
     * Calcula KPIs ejecutivos globales en dinero ($) y conteos por estado.
     */
    calcularKPIs(items = [], umbralCobertura = 30, diasPeriodo = 90) {
        let presupuestoUrgente = 0;
        let presupuestoTotal = 0;
        let conteoUrgentes = 0;
        let conteoRecomprar = 0;
        let conteoRevisar = 0;
        let conteoSaludables = 0;
        let capitalEnRiesgo = 0;

        items.forEach(rawItem => {
            const it = this.calcularMetricasItem(rawItem, diasPeriodo, umbralCobertura);
            presupuestoTotal += it.presupuesto_estimado;

            if (it.categoria_recompra === 'urgente') {
                conteoUrgentes++;
                presupuestoUrgente += it.presupuesto_estimado;
            } else if (it.categoria_recompra === 'recomprar') {
                conteoRecomprar++;
            } else if (it.categoria_recompra === 'revisar') {
                conteoRevisar++;
                capitalEnRiesgo += Math.max(0, (Number(it.stock_actual) || 0) * it.costo_referencia);
            } else {
                conteoSaludables++;
            }
        });

        return {
            totalItems: items.length,
            presupuestoUrgente,
            presupuestoTotal,
            conteoUrgentes,
            conteoRecomprar,
            conteoRevisar,
            conteoSaludables,
            capitalEnRiesgo
        };
    },

    /**
     * Calcula totales consolidados para el tfoot de la tabla.
     */
    calcularTotales(items = []) {
        let totalUnidadesSugeridas = 0;
        let totalPresupuestoSugerido = 0;
        let totalVendidas = 0;
        let totalMargenGenerado = 0;

        items.forEach(it => {
            totalUnidadesSugeridas += Number(it.unidades_sugeridas) || 0;
            totalPresupuestoSugerido += Number(it.presupuesto_estimado) || 0;
            totalVendidas += Number(it.unidades_vendidas_periodo) || 0;
            totalMargenGenerado += Number(it.margen_generado_periodo) || 0;
        });

        return {
            totalItems: items.length,
            totalUnidadesSugeridas,
            totalPresupuestoSugerido,
            totalVendidas,
            totalMargenGenerado
        };
    },

    /**
     * Filtra y ordena los productos enriquecidos.
     */
    filtrarYOrdenar(items = [], options = {}) {
        const {
            searchQuery = '',
            activeTab = 'todos',
            sortColumn = 'score',
            sortDirection = 'desc',
            diasPeriodo = 90,
            umbralCobertura = 30
        } = options;

        // 1. Enriquecer datos con métricas de decisión
        let result = items.map(it => this.calcularMetricasItem(it, diasPeriodo, umbralCobertura));

        // 2. Filtro de búsqueda en tiempo real
        const q = String(searchQuery || '').trim().toLowerCase();
        if (q) {
            result = result.filter(it => 
                String(it.sku || '').toLowerCase().includes(q) ||
                String(it.nombre || '').toLowerCase().includes(q)
            );
        }

        // 3. Filtro por pestaña segmentada (payment-tabs-bar)
        if (activeTab === 'urgentes') {
            result = result.filter(it => it.categoria_recompra === 'urgente');
        } else if (activeTab === 'recomprar') {
            result = result.filter(it => it.categoria_recompra === 'recomprar');
        } else if (activeTab === 'revisar') {
            result = result.filter(it => it.categoria_recompra === 'revisar');
        } else if (activeTab === 'saludables') {
            result = result.filter(it => it.categoria_recompra === 'saludable');
        }

        // 4. Ordenamiento interactivo
        if (sortColumn) {
            const dir = sortDirection === 'asc' ? 1 : -1;
            const numCols = [
                'presupuesto_estimado', 'unidades_sugeridas', 'stock_actual', 'rotacion_dias',
                'unidades_vendidas_periodo', 'tendencia_pct', 'margen_pct', 'precio_venta',
                'precio_venta_real_promedio', 'ultima_compra_costo', 'dias_desde_ultima_compra',
                'score', 'margen_generado_periodo'
            ];

            result.sort((a, b) => {
                let valA = a[sortColumn];
                let valB = b[sortColumn];

                if (sortColumn === 'ultima_compra_fecha') {
                    const tA = valA ? new Date(valA).getTime() : 0;
                    const tB = valB ? new Date(valB).getTime() : 0;
                    return (tA - tB) * dir;
                }

                if (numCols.includes(sortColumn)) {
                    valA = valA != null ? Number(valA) : -Infinity;
                    valB = valB != null ? Number(valB) : -Infinity;
                    return (valA - valB) * dir;
                }

                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
                return valA.localeCompare(valB) * dir;
            });
        }

        return result;
    }
};

// ==========================================
// 2. TEMPLATES LAYER
// ==========================================
export const AnalisisRecompraTemplates = {
    getLayoutHTML(state = {}) {
        const dias = state.diasPeriodo || 90;
        const umbral = state.umbralCobertura || 30;

        return `
            <div class="dash-layout p-3 p-md-4" style="max-width: 1260px; margin: 0 auto;">
                <!-- TOP BAR EJECUTIVA -->
                <div class="d-flex justify-content-between align-items-center mb-3 mb-md-4 flex-wrap gap-2">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-primary text-white rounded-pill px-2.5 py-1" style="font-size: 11px;">
                                <i class="bi bi-cart-check-fill me-1"></i>Inteligencia de Abastecimiento
                            </span>
                            <h2 class="page-title mb-0 fw-bold" style="font-size: 1.45rem;">Análisis de Recompra</h2>
                        </div>
                        <p class="text-muted mb-0 small mt-1">Sugerencias ejecutivas de compra, presupuesto requerido y prevención de rotura de inventario.</p>
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <!-- SELECTOR VENTANA DE TIEMPO -->
                        <div class="d-flex align-items-center bg-white border rounded-3 px-2 py-1 shadow-sm">
                            <span class="text-muted me-2 small fw-medium"><i class="bi bi-clock-history me-1 text-primary"></i>Periodo:</span>
                            <select id="select-periodo-dias" class="form-select form-select-sm border-0 bg-transparent fw-bold text-dark" style="width: 105px; box-shadow: none; cursor: pointer;">
                                <option value="30" ${dias === 30 ? 'selected' : ''}>30 días</option>
                                <option value="60" ${dias === 60 ? 'selected' : ''}>60 días</option>
                                <option value="90" ${dias === 90 ? 'selected' : ''}>90 días</option>
                            </select>
                        </div>
                        <!-- SELECTOR UMBRAL COBERTURA -->
                        <div class="d-flex align-items-center bg-white border rounded-3 px-2 py-1 shadow-sm">
                            <span class="text-muted me-2 small fw-medium"><i class="bi bi-shield-check me-1 text-warning"></i>Umbral:</span>
                            <select id="select-umbral-cobertura" class="form-select form-select-sm border-0 bg-transparent fw-bold text-dark" style="width: 105px; box-shadow: none; cursor: pointer;">
                                <option value="15" ${umbral === 15 ? 'selected' : ''}>15 días</option>
                                <option value="30" ${umbral === 30 ? 'selected' : ''}>30 días</option>
                                <option value="45" ${umbral === 45 ? 'selected' : ''}>45 días</option>
                                <option value="60" ${umbral === 60 ? 'selected' : ''}>60 días</option>
                            </select>
                        </div>
                        <button id="btn-refresh-analisis" class="btn btn-sm btn-light bg-white border shadow-sm px-3 fw-medium" title="Recargar métricas">
                            <i class="bi bi-arrow-clockwise me-1 text-secondary"></i> Actualizar
                        </button>
                        <button id="btn-exportar-recompra" class="btn btn-sm btn-primary-action px-3 fw-medium shadow-sm">
                            <i class="bi bi-download me-1"></i> Exportar
                        </button>
                    </div>
                </div>

                <!-- 4 TARJETAS EJECUTIVAS PAYMENT-KPI-CARD (ESTILO GASTOS OPERATIVOS) -->
                <div class="row g-3 mb-4" id="kpi-cards-row">
                    <!-- KPI 1: Presupuesto Reposición Urgente -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3 shadow-sm" style="border-left: 3px solid #ef4444; background: var(--surface); border-radius: 12px;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Presupuesto Urgente</span>
                                <div class="dash-icon-box variant-red" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: rgba(239, 68, 68, 0.1);">
                                    <i class="bi bi-cash-stack text-danger fs-6"></i>
                                </div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-danger" style="font-size: 22px;" id="kpi-presupuesto-urgente">$0</h3>
                            <span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill" style="font-size: 10px;" id="kpi-urgentes-count">
                                0 SKUs críticos
                            </span>
                        </div>
                    </div>

                    <!-- KPI 2: Rotura / Cobertura Crítica -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3 shadow-sm" style="border-left: 3px solid #f59e0b; background: var(--surface); border-radius: 12px;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">En Quiebre Inminente</span>
                                <div class="dash-icon-box variant-orange" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: rgba(245, 158, 11, 0.1);">
                                    <i class="bi bi-lightning-charge-fill text-warning fs-6"></i>
                                </div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;" id="kpi-quiebre-items">0</h3>
                            <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill" style="font-size: 10px;" id="kpi-quiebre-sub">
                                Cobertura &le; ${umbral} días
                            </span>
                        </div>
                    </div>

                    <!-- KPI 3: Recompra Oportuna -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3 shadow-sm" style="border-left: 3px solid #3b82f6; background: var(--surface); border-radius: 12px;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Recompra Oportuna</span>
                                <div class="dash-icon-box variant-blue" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: rgba(59, 130, 246, 0.1);">
                                    <i class="bi bi-cart-plus-fill text-primary fs-6"></i>
                                </div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-primary" style="font-size: 22px;" id="kpi-recomprar-items">0</h3>
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill" style="font-size: 10px;" id="kpi-recomprar-presupuesto">
                                Presupuesto total: $0
                            </span>
                        </div>
                    </div>

                    <!-- KPI 4: Capital en Riesgo / Revisar -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card p-3 shadow-sm" style="border-left: 3px solid #8b5cf6; background: var(--surface); border-radius: 12px;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">En Observación</span>
                                <div class="dash-icon-box variant-purple" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: rgba(139, 92, 246, 0.1);">
                                    <i class="bi bi-eye-fill text-secondary fs-6"></i>
                                </div>
                            </div>
                            <h3 class="fw-bold mb-1 tnum text-secondary" style="font-size: 22px;" id="kpi-revisar-items">0</h3>
                            <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill" style="font-size: 10px;" id="kpi-revisar-capital">
                                Demanda baja / revisar costo
                            </span>
                        </div>
                    </div>
                </div>

                <!-- BARRA DE HERRAMIENTAS, PESTAÑAS Y BUSCADOR -->
                <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <!-- Segmented Tabs Filter -->
                    <div class="payment-tabs-bar" id="recompra-tabs-container">
                        <button class="payment-tab-btn active recompra-tab-btn" data-tab="todos">
                            <i class="bi bi-grid-fill me-1 text-primary"></i> Todos
                            <span class="payment-tab-badge" id="tab-count-todos">0</span>
                        </button>
                        <button class="payment-tab-btn recompra-tab-btn tab-warning" data-tab="urgentes">
                            <i class="bi bi-lightning-fill me-1 text-danger"></i> Reponer Urgente
                            <span class="payment-tab-badge" id="tab-count-urgentes">0</span>
                        </button>
                        <button class="payment-tab-btn recompra-tab-btn" data-tab="recomprar">
                            <i class="bi bi-cart-check me-1 text-primary"></i> Recomprar
                            <span class="payment-tab-badge" id="tab-count-recomprar">0</span>
                        </button>
                        <button class="payment-tab-btn recompra-tab-btn" data-tab="revisar">
                            <i class="bi bi-exclamation-circle me-1 text-warning"></i> Revisar Demanda
                            <span class="payment-tab-badge" id="tab-count-revisar">0</span>
                        </button>
                        <button class="payment-tab-btn recompra-tab-btn" data-tab="saludables">
                            <i class="bi bi-shield-check me-1 text-success"></i> Stock Saludable
                            <span class="payment-tab-badge" id="tab-count-saludables">0</span>
                        </button>
                    </div>

                    <!-- Buscador & Toggle de Vistas (Tabla / Analítica) -->
                    <div class="d-flex align-items-center gap-2 flex-grow-1 flex-md-grow-0 justify-content-end">
                        <div class="position-relative" style="width: 260px;">
                            <i class="bi bi-search position-absolute text-muted" style="left: 12px; top: 9px; font-size: 13px;"></i>
                            <input type="text" id="search-recompra" class="ds-search-input" placeholder="Buscar por SKU o nombre..." style="height: 34px; font-size: 13px; padding-left: 34px;">
                        </div>
                        <div class="payment-tabs-bar">
                            <button class="payment-tab-btn active recompra-view-btn" data-view="tabla" title="Vista Tabla Compacta">
                                <i class="bi bi-table"></i>
                            </button>
                            <button class="payment-tab-btn recompra-view-btn" data-view="grafico" title="Vista Analítica y Radar">
                                <i class="bi bi-bar-chart-fill"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR PRINCIPAL SIN SCROLLBARS -->
                <div class="dash-table-container" id="recompra-main-container" style="overflow-x: hidden; border-radius: 14px; width: 100%; border: 1px solid var(--border-color); background: var(--surface);">
                    <!-- Se inyecta la tabla o la analítica dinámicamente -->
                </div>

                <!-- BACKDROP Y DRAWER LATERAL 360° -->
                <div class="payment-drawer-backdrop" id="recompra-drawer-backdrop"></div>
                <div class="payment-drawer" id="recompra-drawer" aria-hidden="true">
                    <div class="payment-drawer-header">
                        <div class="d-flex align-items-center gap-2">
                            <span class="payment-code-badge" id="drawer-sku">SKU</span>
                            <h5 class="mb-0 fw-bold text-dark text-truncate" style="max-width: 380px; font-size: 15px;" id="drawer-title">Ficha 360° de Compra</h5>
                        </div>
                        <button type="button" class="btn-close" id="btn-close-drawer" aria-label="Cerrar"></button>
                    </div>
                    <div class="payment-drawer-body" id="drawer-body" style="scrollbar-width: thin;">
                        <!-- Contenido dinámico del simulador de compra -->
                    </div>
                    <div class="payment-drawer-footer">
                        <button type="button" class="btn btn-sm btn-light border px-3" id="btn-drawer-cancel">Cerrar</button>
                        <a href="#/gastos/proveedores/nueva" class="btn btn-sm btn-primary-action px-3" id="btn-drawer-orden">
                            <i class="bi bi-cart-plus me-1"></i>Crear Factura de Compra
                        </a>
                    </div>
                </div>
            </div>
        `;
    },

    // 6 COLUMNAS COMPUESTAS FLUIDAS (ELIMINA AL 100% EL SCROLLBAR HORIZONTAL)
    getTableHeaderHTML(state = {}) {
        const col = state.sortColumn;
        const dir = state.sortDirection;

        const getSortIcon = (targetCol) => {
            if (col !== targetCol) return '<i class="bi bi-arrow-down-up text-muted opacity-25 ms-1" style="font-size: 0.75rem;"></i>';
            return dir === 'asc' 
                ? '<i class="bi bi-arrow-up-short text-primary fw-bold ms-1" style="font-size: 1rem;"></i>' 
                : '<i class="bi bi-arrow-down-short text-primary fw-bold ms-1" style="font-size: 1rem;"></i>';
        };

        return `
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold sort-col" data-col="nombre" style="cursor: pointer; user-select: none; width: 30%;">
                    Producto / Clasificación ${getSortIcon('nombre')}
                </th>
                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end sort-col" data-col="stock_actual" style="cursor: pointer; user-select: none; width: 14%;">
                    Stock & Cobertura ${getSortIcon('stock_actual')}
                </th>
                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end sort-col" data-col="unidades_vendidas_periodo" style="cursor: pointer; user-select: none; width: 14%;">
                    Demanda & Ritmo ${getSortIcon('unidades_vendidas_periodo')}
                </th>
                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end sort-col" data-col="ultima_compra_costo" style="cursor: pointer; user-select: none; width: 16%;">
                    Costos & Precios ${getSortIcon('ultima_compra_costo')}
                </th>
                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end sort-col" data-col="presupuesto_estimado" style="cursor: pointer; user-select: none; width: 18%;">
                    Sugerencia Compra ${getSortIcon('presupuesto_estimado')}
                </th>
                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-center" style="width: 8%;">
                    Acción
                </th>
            </tr>
        `;
    },

    getTableRowsHTML(items = [], state = {}) {
        if (!items || items.length === 0) {
            return `
                <tr>
                    <td colspan="6" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary opacity-50"></i>
                        No se encontraron productos que coincidan con el criterio seleccionado.
                    </td>
                </tr>
            `;
        }

        return items.map(item => {
            const sku = escapeHtml(item.sku || 'S/R');
            const nombre = escapeHtml(item.nombre || 'Sin nombre');
            const stock = item.stock_actual != null ? Math.round(Number(item.stock_actual)).toLocaleString('es-CO') : '0';
            const vendidas = item.unidades_vendidas_periodo != null ? Number(item.unidades_vendidas_periodo).toLocaleString('es-CO') : '0';
            const ventaDiaria = Number(item.venta_diaria || 0).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
            
            // Sugerencia de compra & presupuesto
            const sugeridas = Number(item.unidades_sugeridas || 0);
            const presupuesto = Number(item.presupuesto_estimado || 0);
            const presupuestoStr = presupuesto > 0 ? `$${Math.round(presupuesto).toLocaleString('es-CO')}` : '$0';

            // Cobertura y Rotación
            const rotacionDias = item.rotacion_dias != null ? Number(item.rotacion_dias) : null;
            const coberturaHTML = this.getCoberturaVisualHTML(rotacionDias, state.umbralCobertura || 30);

            // Tendencia y badge
            const tendenciaHTML = this.getTendenciaHTML(item.tendencia_pct);
            const badgeHTML = this.getRecomendacionBadgeHTML(item.recomendacion, item.categoria_recompra);

            // Costos y precios
            const costoCompra = item.ultima_compra_costo != null ? `$${Math.round(Number(item.ultima_compra_costo)).toLocaleString('es-CO')}` : (item.costo_base ? `$${Math.round(Number(item.costo_base)).toLocaleString('es-CO')}` : '$0');
            const pRealNum = item.precio_venta_real_promedio != null ? Number(item.precio_venta_real_promedio) : Number(item.precio_venta || 0);
            const precioVenta = `$${Math.round(pRealNum).toLocaleString('es-CO')}`;

            // Días desde última compra
            const diasCompra = item.dias_desde_ultima_compra != null ? `hace ${Math.round(Number(item.dias_desde_ultima_compra))}d` : 'sin compras';

            // Estilos condicionales de fila
            const esCritico = item.categoria_recompra === 'urgente';
            const rowStyle = esCritico 
                ? 'background-color: rgba(239, 68, 68, 0.03); border-left: 3px solid #ef4444; border-bottom: 1px solid #f1f5f9; font-size: 13px;'
                : 'border-bottom: 1px solid #f1f5f9; font-size: 13px;';

            return `
                <tr class="payment-row" data-id="${item.producto_id || ''}" data-sku="${sku}" style="${rowStyle}">
                    <!-- Columna 1: Producto & Clasificación -->
                    <td class="py-2.5 px-3">
                        <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                            <span class="payment-code-badge">${sku}</span>
                            <span class="fw-bold text-dark text-truncate" title="${nombre}" style="max-width: 220px; font-size: 13px;">${nombre}</span>
                        </div>
                        <div class="d-flex align-items-center gap-1.5 flex-wrap">
                            ${badgeHTML}
                            <span class="badge bg-light text-muted border rounded-pill" style="font-size: 10px;">Score: ${item.score != null ? Number(item.score).toFixed(1) : '0'}</span>
                        </div>
                    </td>

                    <!-- Columna 2: Stock & Cobertura -->
                    <td class="py-2.5 px-3 text-end">
                        <div class="fw-bold tnum ${Number(item.stock_actual) <= 0 ? 'text-danger' : 'text-dark'}" style="font-size: 14px;">
                            ${stock} und
                        </div>
                        <div class="small">${coberturaHTML}</div>
                    </td>

                    <!-- Columna 3: Demanda & Ritmo -->
                    <td class="py-2.5 px-3 text-end">
                        <div class="fw-bold text-dark tnum" style="font-size: 13.5px;">${vendidas} und</div>
                        <div class="text-muted small">${ventaDiaria} und/día ${tendenciaHTML}</div>
                    </td>

                    <!-- Columna 4: Costos & Precios -->
                    <td class="py-2.5 px-3 text-end">
                        <div class="fw-bold text-dark tnum" style="font-size: 13.5px;">${costoCompra}</div>
                        <div class="text-muted small">P. Venta: ${precioVenta} • <span class="text-secondary">${diasCompra}</span></div>
                    </td>

                    <!-- Columna 5: Sugerencia de Compra & Presupuesto -->
                    <td class="py-2.5 px-3 text-end">
                        <div class="fw-bold tnum ${sugeridas > 0 ? 'text-primary' : 'text-muted'}" style="font-size: 14px;">
                            ${sugeridas > 0 ? `+${sugeridas} und a pedir` : 'Sin compra requerida'}
                        </div>
                        <div class="tnum fw-semibold ${presupuesto > 0 ? 'text-success' : 'text-muted'}" style="font-size: 12px;">
                            ${presupuesto > 0 ? `Inversión: ${presupuestoStr}` : '$0'}
                        </div>
                    </td>

                    <!-- Columna 6: Acción / Detalle 360° -->
                    <td class="py-2.5 px-3 text-center">
                        <button type="button" class="btn btn-sm btn-light border p-1 rounded-circle btn-open-drawer" data-sku="${sku}" title="Simular compra y ver ficha 360°" style="width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;">
                            <i class="bi bi-sliders text-secondary" style="font-size: 12px;"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    getTableFooterHTML(items = []) {
        if (!items || items.length === 0) return '';
        const totales = AnalisisRecompraData.calcularTotales(items);
        const presupuestoStr = `$${Math.round(totales.totalPresupuestoSugerido).toLocaleString('es-CO')}`;

        return `
            <tfoot style="background-color: #f8fafc; border-top: 2px solid #cbd5e1; font-size: 12px;">
                <tr class="fw-bold">
                    <td class="py-2.5 px-3 text-dark text-uppercase" style="letter-spacing: 0.5px;">
                        Total Consolidado (${totales.totalItems} SKUs):
                    </td>
                    <td class="py-2.5 px-3 text-end text-muted small">
                        -
                    </td>
                    <td class="py-2.5 px-3 text-end text-dark tnum">
                        ${totales.totalVendidas.toLocaleString('es-CO')} und vendidas
                    </td>
                    <td class="py-2.5 px-3 text-end text-muted small">
                        Presupuesto sugerido filtro activo
                    </td>
                    <td class="py-2.5 px-3 text-end text-primary tnum" style="font-size: 13.5px;">
                        <div>+${totales.totalUnidadesSugeridas.toLocaleString('es-CO')} und a pedir</div>
                        <div class="text-success fw-bold">${presupuestoStr}</div>
                    </td>
                    <td class="py-2.5 px-3 text-center text-muted small">
                        -
                    </td>
                </tr>
            </tfoot>
        `;
    },

    getCoberturaVisualHTML(rotacionDias, umbralCobertura = 30) {
        if (rotacionDias == null || isNaN(rotacionDias)) {
            return '<span class="text-muted">Sin rotación</span>';
        }
        const num = Number(rotacionDias);
        if (num <= 0) {
            return '<span class="text-danger fw-bold"><i class="bi bi-exclamation-octagon-fill me-1"></i>Agotado (0 d)</span>';
        }
        if (num <= 10) {
            return `<span class="text-danger fw-semibold"><i class="bi bi-lightning-fill me-0.5"></i>${Math.round(num)} días de cobertura</span>`;
        }
        if (num <= umbralCobertura) {
            return `<span class="text-warning-emphasis fw-semibold">${Math.round(num)} días de cobertura</span>`;
        }
        return `<span class="text-success">${Math.round(num)} días de cobertura</span>`;
    },

    getTendenciaHTML(val) {
        if (val == null || isNaN(val)) return '<span class="text-muted opacity-50"><i class="bi bi-dash"></i></span>';
        const num = Number(val);
        if (num > 0) {
            return `<span class="text-success fw-medium"><i class="bi bi-arrow-up-right me-0.5"></i>+${num.toFixed(0)}%</span>`;
        }
        if (num < 0) {
            return `<span class="text-danger fw-medium"><i class="bi bi-arrow-down-right me-0.5"></i>${num.toFixed(0)}%</span>`;
        }
        return '<span class="text-muted opacity-50"><i class="bi bi-dash"></i></span>';
    },

    getRecomendacionBadgeHTML(rec, categoria) {
        const recStr = String(rec || 'Sin recomendación').trim();
        if (categoria === 'urgente') {
            return `<span class="badge bg-danger text-white fw-bold px-2 py-0.5 rounded-pill shadow-sm" style="font-size: 10px;"><i class="bi bi-lightning-fill me-1"></i>${escapeHtml(recStr)}</span>`;
        }
        if (categoria === 'recomprar') {
            return `<span class="badge bg-primary-subtle text-primary border border-primary-subtle fw-semibold px-2 py-0.5 rounded-pill" style="font-size: 10px;">${escapeHtml(recStr)}</span>`;
        }
        if (categoria === 'revisar') {
            return `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-semibold px-2 py-0.5 rounded-pill" style="font-size: 10px;">${escapeHtml(recStr)}</span>`;
        }
        return `<span class="badge bg-success-subtle text-success border border-success-subtle fw-medium px-2 py-0.5 rounded-pill" style="font-size: 10px;">${escapeHtml(recStr)}</span>`;
    },

    getDrawerContentHTML(item, options = {}) {
        if (!item) return '<div class="p-4 text-center text-muted">No se seleccionó ningún producto.</div>';

        const sku = escapeHtml(item.sku || 'S/R');
        const nombre = escapeHtml(item.nombre || 'Sin nombre');
        const stock = Number(item.stock_actual || 0);
        const ventaDiaria = Number(item.venta_diaria || 0);
        const rotacionDias = item.rotacion_dias != null ? Math.round(Number(item.rotacion_dias)) : 'N/A';
        const margenPct = item.margen_pct != null ? `${Number(item.margen_pct).toFixed(1)}%` : '0.0%';
        const costoUnit = item.costo_referencia || 0;
        const precioUnit = Number(item.precio_venta || 0);

        const diasPeriodo = options.diasPeriodo || 90;
        const umbralActual = options.umbralCobertura || 30;

        return `
            <div class="d-flex flex-column gap-3">
                <!-- Tarjeta Principal del Producto -->
                <div class="card border-0 shadow-sm p-3" style="background: #f8fafc; border-radius: 12px;">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <span class="payment-code-badge mb-1">${sku}</span>
                            <h6 class="fw-bold mb-0 text-dark">${nombre}</h6>
                        </div>
                        <div>
                            ${this.getRecomendacionBadgeHTML(item.recomendacion, item.categoria_recompra)}
                        </div>
                    </div>
                    <div class="row g-2 mt-2 pt-2 border-top">
                        <div class="col-6 col-sm-3">
                            <span class="text-muted d-block" style="font-size: 10.5px;">Stock Actual</span>
                            <strong class="tnum ${stock <= 0 ? 'text-danger' : 'text-dark'}">${stock} und</strong>
                        </div>
                        <div class="col-6 col-sm-3">
                            <span class="text-muted d-block" style="font-size: 10.5px;">Ritmo Diario</span>
                            <strong class="tnum text-dark">${ventaDiaria.toFixed(2)} und/d</strong>
                        </div>
                        <div class="col-6 col-sm-3">
                            <span class="text-muted d-block" style="font-size: 10.5px;">Cobertura Actual</span>
                            <strong class="tnum text-dark">${rotacionDias} días</strong>
                        </div>
                        <div class="col-6 col-sm-3">
                            <span class="text-muted d-block" style="font-size: 10.5px;">Margen Catálogo</span>
                            <strong class="tnum text-success">${margenPct}</strong>
                        </div>
                    </div>
                </div>

                <!-- SIMULADOR INTERACTIVO DE COMPRA -->
                <div class="card border p-3" style="border-radius: 12px; border-color: #cbd5e1;">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="fw-bold mb-0 text-dark" style="font-size: 13.5px;">
                            <i class="bi bi-sliders me-1.5 text-primary"></i>Simulador de Compra
                        </h6>
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill" style="font-size: 10px;">
                            Costo Ref: $${Math.round(costoUnit).toLocaleString('es-CO')}
                        </span>
                    </div>
                    <p class="text-muted small mb-3">Ajusta los días de inventario que deseas garantizar para calcular las unidades y presupuesto:</p>

                    <div class="mb-3">
                        <label class="form-label text-muted small fw-bold mb-1">Días de Cobertura Objetivo:</label>
                        <div class="btn-group w-100" role="group" id="sim-dias-group">
                            <button type="button" class="btn btn-sm btn-outline-secondary sim-dia-btn ${umbralActual === 15 ? 'active' : ''}" data-dias="15">15 días</button>
                            <button type="button" class="btn btn-sm btn-outline-secondary sim-dia-btn ${umbralActual === 30 ? 'active' : ''}" data-dias="30">30 días</button>
                            <button type="button" class="btn btn-sm btn-outline-secondary sim-dia-btn ${umbralActual === 45 ? 'active' : ''}" data-dias="45">45 días</button>
                            <button type="button" class="btn btn-sm btn-outline-secondary sim-dia-btn ${umbralActual === 60 ? 'active' : ''}" data-dias="60">60 días</button>
                            <button type="button" class="btn btn-sm btn-outline-secondary sim-dia-btn ${umbralActual === 90 ? 'active' : ''}" data-dias="90">90 días</button>
                        </div>
                    </div>

                    <!-- Resultados del Simulador -->
                    <div class="p-3 rounded-3" style="background: #f1f5f9;">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="text-muted small">Unidades sugeridas a pedir:</span>
                            <span class="fw-bold text-primary tnum fs-6" id="sim-unidades-result">
                                +${item.unidades_sugeridas || 0} und
                            </span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="text-muted small">Inversión estimada requerida:</span>
                            <span class="fw-bold text-success tnum fs-6" id="sim-presupuesto-result">
                                $${Math.round(item.presupuesto_estimado || 0).toLocaleString('es-CO')}
                            </span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                            <span class="text-muted small">Ingreso potencial de venta:</span>
                            <span class="fw-bold text-dark tnum small" id="sim-ingreso-result">
                                $${Math.round((item.unidades_sugeridas || 0) * precioUnit).toLocaleString('es-CO')}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Historial de Última Compra -->
                <div class="card border-0 shadow-sm p-3" style="border-radius: 12px; background: var(--surface);">
                    <h6 class="fw-bold mb-2 text-dark" style="font-size: 13px;">
                        <i class="bi bi-clock-history me-1 text-secondary"></i>Historial de Compra
                    </h6>
                    <div class="d-flex justify-content-between align-items-center small py-1 border-bottom">
                        <span class="text-muted">Última fecha de compra:</span>
                        <span class="fw-semibold text-dark">${item.ultima_compra_fecha ? escapeHtml(String(item.ultima_compra_fecha).slice(0, 10)) : 'Sin compras'}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center small py-1 border-bottom">
                        <span class="text-muted">Último costo unitario:</span>
                        <span class="fw-semibold text-dark">${item.ultima_compra_costo ? `$${Math.round(Number(item.ultima_compra_costo)).toLocaleString('es-CO')}` : '-'}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center small py-1">
                        <span class="text-muted">Variación costo vs histórico:</span>
                        <span class="fw-semibold ${Number(item.variacion_costo_pct) > 0 ? 'text-danger' : 'text-success'}">
                            ${item.variacion_costo_pct != null ? `${Number(item.variacion_costo_pct).toFixed(1)}%` : '0.0%'}
                        </span>
                    </div>
                </div>

                <!-- Botón Acción Compra -->
                <div class="pt-1">
                    <a href="#/gastos/proveedores/nueva" class="btn btn-primary-action w-100 py-2.5 fw-semibold d-flex align-items-center justify-content-center gap-2" style="font-size: 13.5px; border-radius: 10px;">
                        <i class="bi bi-cart-plus fs-6"></i>Crear Factura de Compra
                    </a>
                </div>
            </div>
        `;
    },

    getAnalyticsViewHTML(items = [], state = {}) {
        if (!items || items.length === 0) {
            return `
                <div class="card border-0 shadow-sm p-5 text-center text-muted" style="border-radius: 14px;">
                    <i class="bi bi-bar-chart fs-1 d-block mb-2 text-secondary opacity-50"></i>
                    No hay datos analíticos disponibles para graficar en este periodo.
                </div>
            `;
        }

        // Top 8 productos con mayor presupuesto de recompra
        const topPresupuesto = [...items]
            .filter(it => (it.presupuesto_estimado || 0) > 0)
            .sort((a, b) => b.presupuesto_estimado - a.presupuesto_estimado)
            .slice(0, 8);

        const totalPresupuestoTop = topPresupuesto.reduce((sum, it) => sum + (it.presupuesto_estimado || 0), 0) || 1;

        return `
            <div class="row g-4" style="max-width: 100%; overflow-x: hidden;">
                <!-- Tarjeta 1: Radar de Inversión (Top Productos Recompra) -->
                <div class="col-12 col-lg-7">
                    <div class="card border-0 shadow-sm p-3 p-md-4 h-100" style="border-radius: 14px; background: var(--surface);">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold mb-0 text-dark">
                                <i class="bi bi-pie-chart-fill me-1.5 text-primary"></i>Distribución de Inversión de Recompra
                            </h6>
                            <span class="badge bg-light text-secondary border rounded-pill small">Top ${topPresupuesto.length}</span>
                        </div>
                        <p class="text-muted small mb-3">SKUs que concentran la mayor cantidad de capital sugerido para reposición:</p>
                        
                        <div class="d-flex flex-column gap-3">
                            ${topPresupuesto.length === 0 ? '<div class="text-muted small">No hay sugerencias de compra en este filtro.</div>' : topPresupuesto.map(it => {
                                const monto = it.presupuesto_estimado || 0;
                                const pct = Math.min(100, Math.round((monto / totalPresupuestoTop) * 100));
                                return `
                                    <div>
                                        <div class="d-flex justify-content-between align-items-center mb-1 small">
                                            <span class="fw-semibold text-dark text-truncate" style="max-width: 65%;">
                                                <span class="payment-code-badge me-1.5">${escapeHtml(it.sku)}</span>
                                                ${escapeHtml(it.nombre)}
                                            </span>
                                            <span class="fw-bold text-success tnum">$${Math.round(monto).toLocaleString('es-CO')} <span class="text-muted fw-normal">(${pct}%)</span></span>
                                        </div>
                                        <div class="progress" style="height: 6px; background-color: #f1f5f9; border-radius: 999px;">
                                            <div class="progress-bar bg-primary" role="progressbar" style="width: ${pct}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <!-- Tarjeta 2: Matriz Rotación vs Margen (Cuadrante) -->
                <div class="col-12 col-lg-5">
                    <div class="card border-0 shadow-sm p-3 p-md-4 h-100" style="border-radius: 14px; background: var(--surface);">
                        <h6 class="fw-bold mb-2 text-dark">
                            <i class="bi bi-grid-3x3-gap-fill me-1.5 text-success"></i>Matriz de Decisión de Capital
                        </h6>
                        <p class="text-muted small mb-3">Clasificación estratégica para priorizar órdenes de compra:</p>

                        <div class="d-flex flex-column gap-2.5">
                            <div class="p-2.5 rounded-3 border" style="background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.2);">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <strong class="text-success small"><i class="bi bi-star-fill me-1"></i>Productos Estrella</strong>
                                    <span class="badge bg-success text-white rounded-pill">${items.filter(it => it.categoria_recompra === 'urgente' || it.categoria_recompra === 'recomprar').length} SKUs</span>
                                </div>
                                <div class="text-muted" style="font-size: 11.5px;">Alta rotación y buen margen. Prioridad #1 para compra inmediata.</div>
                            </div>

                            <div class="p-2.5 rounded-3 border" style="background: rgba(59, 130, 246, 0.05); border-color: rgba(59, 130, 246, 0.2);">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <strong class="text-primary small"><i class="bi bi-shield-check me-1"></i>Stock Saludable</strong>
                                    <span class="badge bg-primary text-white rounded-pill">${items.filter(it => it.categoria_recompra === 'saludable').length} SKUs</span>
                                </div>
                                <div class="text-muted" style="font-size: 11.5px;">Cobertura suficiente sin riesgo de quiebre en este periodo.</div>
                            </div>

                            <div class="p-2.5 rounded-3 border" style="background: rgba(245, 158, 11, 0.05); border-color: rgba(245, 158, 11, 0.2);">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <strong class="text-warning-emphasis small"><i class="bi bi-exclamation-triangle-fill me-1"></i>En Observación</strong>
                                    <span class="badge bg-warning text-dark rounded-pill">${items.filter(it => it.categoria_recompra === 'revisar').length} SKUs</span>
                                </div>
                                <div class="text-muted" style="font-size: 11.5px;">Demanda cayendo o margen bajo. Evitar sobre-compras.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    getPaginationHTML(totalItems, currentPage, totalPages, itemsPerPage) {
        const start = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
        const end = Math.min(currentPage * itemsPerPage, totalItems);

        return `
            <div class="d-flex align-items-center gap-3">
                <span>Página <span id="current-page" class="fw-semibold text-dark">${currentPage}</span> de <span id="total-pages" class="fw-semibold text-dark">${totalPages}</span></span>
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
                <span id="showing-count" class="text-muted">${start}-${end} de ${totalItems}</span>
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

        // Selector periodo días
        el.querySelector('#select-periodo-dias')?.addEventListener('change', async (e) => {
            this.state.diasPeriodo = parseInt(e.target.value, 10) || 90;
            this.state.currentPage = 1;
            await this.cargarDatos();
        });

        // Selector umbral cobertura
        el.querySelector('#select-umbral-cobertura')?.addEventListener('change', async (e) => {
            this.state.umbralCobertura = parseInt(e.target.value, 10) || 30;
            this.state.currentPage = 1;
            await this.cargarDatos();
        });

        // Botón Actualizar
        el.querySelector('#btn-refresh-analisis')?.addEventListener('click', async () => {
            await this.cargarDatos();
        });

        // Buscador omnibox en tiempo real
        el.querySelector('#search-recompra')?.addEventListener('input', (e) => {
            this.state.searchQuery = e.target.value.trim();
            this.state.currentPage = 1;
            this.renderMainContent();
        });

        // Pestañas segmentadas (payment-tabs-bar)
        el.querySelectorAll('.recompra-tab-btn')?.forEach(btn => {
            btn.addEventListener('click', () => {
                el.querySelectorAll('.recompra-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.activeTab = btn.dataset.tab || 'todos';
                this.state.currentPage = 1;
                this.renderMainContent();
            });
        });

        // Toggle de Vistas (Tabla / Analítica)
        el.querySelectorAll('.recompra-view-btn')?.forEach(btn => {
            btn.addEventListener('click', () => {
                el.querySelectorAll('.recompra-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.currentView = btn.dataset.view || 'tabla';
                this.renderMainContent();
            });
        });

        // Botón Exportar CSV
        el.querySelector('#btn-exportar-recompra')?.addEventListener('click', () => {
            this.exportarCSV();
        });

        // Backdrop y cierre de drawer
        el.querySelector('#recompra-drawer-backdrop')?.addEventListener('click', () => this.cerrarDrawer());
        el.querySelector('#btn-close-drawer')?.addEventListener('click', () => this.cerrarDrawer());
        el.querySelector('#btn-drawer-cancel')?.addEventListener('click', () => this.cerrarDrawer());

        // Eventos de tabla: ordenamiento, click en fila y drawer
        this.bindTableEvents();
    },

    bindTableEvents() {
        const el = this.element;
        if (!el) return;

        // Ordenamiento por cabecera
        el.querySelectorAll('#recompra-thead .sort-col')?.forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (this.state.sortColumn === col) {
                    this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.state.sortColumn = col;
                    this.state.sortDirection = ['nombre', 'sku'].includes(col) ? 'asc' : 'desc';
                }
                this.renderMainContent();
            });
        });

        // Click en fila o botón para abrir drawer 360°
        el.querySelectorAll('.btn-open-drawer')?.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sku = btn.dataset.sku;
                this.abrirDrawer(sku);
            });
        });

        el.querySelectorAll('#recompra-tbody .payment-row')?.forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('a')) return;
                const sku = row.dataset.sku;
                this.abrirDrawer(sku);
            });
        });

        // Paginación
        el.querySelector('#btn-prev-page')?.addEventListener('click', () => {
            if (this.state.currentPage > 1) {
                this.state.currentPage--;
                this.renderMainContent();
            }
        });

        el.querySelector('#btn-next-page')?.addEventListener('click', () => {
            const processed = this.filtrarYOrdenar(this.state.rawData, this.state);
            const totalPages = Math.ceil(processed.length / this.state.itemsPerPage) || 1;
            if (this.state.currentPage < totalPages) {
                this.state.currentPage++;
                this.renderMainContent();
            }
        });

        el.querySelector('#items-per-page')?.addEventListener('change', (e) => {
            this.state.itemsPerPage = parseInt(e.target.value, 10) || 25;
            this.state.currentPage = 1;
            this.renderMainContent();
        });
    },

    bindDrawerSimulatorEvents(item) {
        const drawerBody = this.element.querySelector('#drawer-body');
        if (!drawerBody || !item) return;

        drawerBody.querySelectorAll('.sim-dia-btn')?.forEach(btn => {
            btn.addEventListener('click', () => {
                drawerBody.querySelectorAll('.sim-dia-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const diasObj = parseInt(btn.dataset.dias, 10) || 30;
                const ventaDiaria = Number(item.venta_diaria || 0);
                const stockActual = Math.max(0, Number(item.stock_actual || 0));
                const costoUnit = Number(item.costo_referencia || 0);
                const precioUnit = Number(item.precio_venta || 0);

                const objStock = Math.ceil(ventaDiaria * diasObj);
                const undSugeridas = Math.max(0, objStock - stockActual);
                const presSugerido = undSugeridas * costoUnit;
                const ingSugerido = undSugeridas * precioUnit;

                const elUnd = drawerBody.querySelector('#sim-unidades-result');
                const elPres = drawerBody.querySelector('#sim-presupuesto-result');
                const elIng = drawerBody.querySelector('#sim-ingreso-result');

                if (elUnd) elUnd.textContent = `+${undSugeridas} und`;
                if (elPres) elPres.textContent = `$${Math.round(presSugerido).toLocaleString('es-CO')}`;
                if (elIng) elIng.textContent = `$${Math.round(ingSugerido).toLocaleString('es-CO')}`;
            });
        });
    }
};

// ==========================================
// 4. ORQUESTADOR (MODULE)
// ==========================================
export const AnalisisRecompraModule = {
    state: {
        diasPeriodo: 90,
        umbralCobertura: 30,
        rawData: [],
        searchQuery: '',
        activeTab: 'todos',
        currentView: 'tabla', // 'tabla' o 'grafico'
        sortColumn: 'score',
        sortDirection: 'desc',
        currentPage: 1,
        itemsPerPage: 25,
        isLoading: false,
        activeDrawerSku: null
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        // Reinicio de estado de visualización
        this.state.searchQuery = '';
        this.state.activeTab = 'todos';
        this.state.currentView = 'tabla';
        this.state.currentPage = 1;
        this.state.sortColumn = 'score';
        this.state.sortDirection = 'desc';
        this.state.activeDrawerSku = null;

        // Renderizado del cascarón principal estilo Gastos Operativos
        element.innerHTML = this.getLayoutHTML(this.state);

        // Asociar eventos principales
        this.bindEvents();

        // Cargar datos
        await this.cargarDatos();
    },

    async cargarDatos() {
        this.state.isLoading = true;
        const mainContainer = this.element.querySelector('#recompra-main-container');

        if (mainContainer) {
            mainContainer.innerHTML = `
                <div class="card border-0 shadow-sm p-5 text-center text-muted" style="border-radius: 14px;">
                    <span class="spinner-border spinner-border-sm me-2 text-primary"></span>
                    Analizando inteligencia de compras, rotación y cobertura (${this.state.diasPeriodo} días, umbral ${this.state.umbralCobertura} días)...
                </div>
            `;
        }

        const data = await this.fetchAnalisis(this.state.diasPeriodo, this.state.umbralCobertura);
        this.state.rawData = data;
        this.state.isLoading = false;

        this.actualizarKPIs();
        this.actualizarTabBadges();
        this.renderMainContent();
    },

    actualizarKPIs() {
        const kpis = this.calcularKPIs(this.state.rawData, this.state.umbralCobertura, this.state.diasPeriodo);

        const elPresUrgente = this.element.querySelector('#kpi-presupuesto-urgente');
        const elUrgCount = this.element.querySelector('#kpi-urgentes-count');
        const elQuiebreItems = this.element.querySelector('#kpi-quiebre-items');
        const elRecomprarItems = this.element.querySelector('#kpi-recomprar-items');
        const elRecomprarPresupuesto = this.element.querySelector('#kpi-recomprar-presupuesto');
        const elRevisarItems = this.element.querySelector('#kpi-revisar-items');

        if (elPresUrgente) elPresUrgente.textContent = `$${Math.round(kpis.presupuestoUrgente).toLocaleString('es-CO')}`;
        if (elUrgCount) elUrgCount.textContent = `${kpis.conteoUrgentes} SKUs críticos`;
        if (elQuiebreItems) elQuiebreItems.textContent = kpis.conteoUrgentes.toLocaleString('es-CO');
        if (elRecomprarItems) elRecomprarItems.textContent = kpis.conteoRecomprar.toLocaleString('es-CO');
        if (elRecomprarPresupuesto) elRecomprarPresupuesto.textContent = `Inversión total: $${Math.round(kpis.presupuestoTotal).toLocaleString('es-CO')}`;
        if (elRevisarItems) elRevisarItems.textContent = kpis.conteoRevisar.toLocaleString('es-CO');
    },

    actualizarTabBadges() {
        const kpis = this.calcularKPIs(this.state.rawData, this.state.umbralCobertura, this.state.diasPeriodo);

        const badgeTodos = this.element.querySelector('#tab-count-todos');
        const badgeUrg = this.element.querySelector('#tab-count-urgentes');
        const badgeRec = this.element.querySelector('#tab-count-recomprar');
        const badgeRev = this.element.querySelector('#tab-count-revisar');
        const badgeSal = this.element.querySelector('#tab-count-saludables');

        if (badgeTodos) badgeTodos.textContent = kpis.totalItems;
        if (badgeUrg) badgeUrg.textContent = kpis.conteoUrgentes;
        if (badgeRec) badgeRec.textContent = kpis.conteoRecomprar;
        if (badgeRev) badgeRev.textContent = kpis.conteoRevisar;
        if (badgeSal) badgeSal.textContent = kpis.conteoSaludables;
    },

    renderMainContent() {
        const container = this.element.querySelector('#recompra-main-container');
        if (!container) return;

        const processed = this.filtrarYOrdenar(this.state.rawData, this.state);

        if (this.state.currentView === 'grafico') {
            container.className = '';
            container.style.cssText = 'max-width: 100%; overflow-x: hidden;';
            container.innerHTML = this.getAnalyticsViewHTML(processed, this.state);
            return;
        }

        // Renderizado Vista Tabla (Cero scrollbars, table-layout fixed, 100% fluida)
        container.className = 'dash-table-container';
        container.style.cssText = 'overflow-x: hidden; border-radius: 14px; width: 100%; border: 1px solid var(--border-color); background: var(--surface);';

        const totalItems = processed.length;
        const totalPages = Math.ceil(totalItems / this.state.itemsPerPage) || 1;

        if (this.state.currentPage > totalPages) {
            this.state.currentPage = totalPages;
        }

        const startIdx = (this.state.currentPage - 1) * this.state.itemsPerPage;
        const pageItems = processed.slice(startIdx, startIdx + this.state.itemsPerPage);

        container.innerHTML = `
            <div style="width: 100%; overflow: hidden;">
                <table class="table table-borderless align-middle mb-0" style="table-layout: fixed; width: 100%; border-collapse: separate;">
                    <thead id="recompra-thead">
                        ${this.getTableHeaderHTML(this.state)}
                    </thead>
                    <tbody id="recompra-tbody">
                        ${this.getTableRowsHTML(pageItems, this.state)}
                    </tbody>
                    ${this.getTableFooterHTML(processed)}
                </table>
            </div>
            <!-- PAGINACIÓN -->
            <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center flex-wrap gap-2 text-muted small" id="recompra-pagination">
                ${this.getPaginationHTML(totalItems, this.state.currentPage, totalPages, this.state.itemsPerPage)}
            </div>
        `;

        this.bindTableEvents();
    },

    abrirDrawer(sku) {
        if (!sku) return;
        this.state.activeDrawerSku = sku;

        const rawItem = (this.state.rawData || []).find(it => String(it.sku || '').trim() === String(sku).trim());
        if (!rawItem) return;

        const enriched = this.calcularMetricasItem(rawItem, this.state.diasPeriodo, this.state.umbralCobertura);

        const drawer = this.element.querySelector('#recompra-drawer');
        const backdrop = this.element.querySelector('#recompra-drawer-backdrop');
        const drawerSku = this.element.querySelector('#drawer-sku');
        const drawerTitle = this.element.querySelector('#drawer-title');
        const drawerBody = this.element.querySelector('#drawer-body');

        if (drawerSku) drawerSku.textContent = enriched.sku;
        if (drawerTitle) drawerTitle.textContent = enriched.nombre;
        if (drawerBody) {
            drawerBody.innerHTML = this.getDrawerContentHTML(enriched, this.state);
            this.bindDrawerSimulatorEvents(enriched);
        }

        if (drawer) {
            drawer.classList.add('show');
            drawer.setAttribute('aria-hidden', 'false');
        }
        if (backdrop) backdrop.classList.add('show');
    },

    cerrarDrawer() {
        const drawer = this.element.querySelector('#recompra-drawer');
        const backdrop = this.element.querySelector('#recompra-drawer-backdrop');

        if (drawer) {
            drawer.classList.remove('show');
            drawer.setAttribute('aria-hidden', 'true');
        }
        if (backdrop) backdrop.classList.remove('show');
        this.state.activeDrawerSku = null;
    },

    exportarCSV() {
        const items = this.filtrarYOrdenar(this.state.rawData, this.state);
        if (!items || items.length === 0) {
            alert('No hay datos disponibles para exportar con los filtros actuales.');
            return;
        }

        const encabezados = [
            'SKU',
            'Nombre',
            'Stock Actual',
            'Rotacion Dias',
            'Ventas Periodo',
            'Venta Diaria',
            'Tendencia %',
            'Unidades Sugeridas Pedir',
            'Costo Referencia',
            'Presupuesto Estimado Compra',
            'Precio Venta',
            'Margen %',
            'Recomendacion',
            'Categoria Recompra',
            'Ultima Compra Fecha',
            'Ultimo Costo Compra',
            'Score'
        ];

        const filas = items.map(it => [
            `"${(it.sku || '').toString().replace(/"/g, '""')}"`,
            `"${(it.nombre || '').toString().replace(/"/g, '""')}"`,
            it.stock_actual != null ? it.stock_actual : 0,
            it.rotacion_dias != null ? it.rotacion_dias : '',
            it.unidades_vendidas_periodo != null ? it.unidades_vendidas_periodo : 0,
            it.venta_diaria != null ? it.venta_diaria : 0,
            it.tendencia_pct != null ? it.tendencia_pct : 0,
            it.unidades_sugeridas != null ? it.unidades_sugeridas : 0,
            it.costo_referencia != null ? it.costo_referencia : 0,
            it.presupuesto_estimado != null ? it.presupuesto_estimado : 0,
            it.precio_venta != null ? it.precio_venta : 0,
            it.margen_pct != null ? it.margen_pct : 0,
            `"${(it.recomendacion || '').toString().replace(/"/g, '""')}"`,
            it.categoria_recompra || '',
            it.ultima_compra_fecha ? `"${it.ultima_compra_fecha}"` : '',
            it.ultima_compra_costo != null ? it.ultima_compra_costo : '',
            it.score != null ? it.score : ''
        ]);

        const contenido = [encabezados.join(','), ...filas.map(f => f.join(','))].join('\r\n');
        const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analisis_recompra_${this.state.diasPeriodo}d_umbral${this.state.umbralCobertura}d_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

Object.assign(AnalisisRecompraModule, AnalisisRecompraData, AnalisisRecompraTemplates, AnalisisRecompraEvents);

export default AnalisisRecompraModule;
