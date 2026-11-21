// js/modules/inventario/analisisNanocarbon.js
// Módulo de Análisis de NanoCarbón (Rollo Madre y Códigos Derivados)
// Rediseño Ergonómico Ejecutivo: Estilo Gastos Operativos & Cero Scroll Horizontal

import { escapeHtml } from '../../shared/formatters.js';

let _supabaseClient = null;

// ==========================================
// 1. DATA LAYER
// ==========================================
export const AnalisisNanocarbonData = {
    setSupabase(client) {
        _supabaseClient = client;
    },

    getSupabase() {
        return _supabaseClient;
    },

    async fetchAnalisis(dias = 90, umbralRollo = 30) {
        try {
            const client = this.getSupabase() || (await import('../../core/supabase.js').catch(() => ({}))).supabase;
            if (!client) throw new Error('Cliente Supabase no inicializado');

            const { data, error } = await client.rpc('get_analisis_nanocarbon', {
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

        // 1. Filtro de búsqueda en tiempo real
        const query = (this.state.searchQuery || '').trim().toLowerCase();
        if (query) {
            items = items.filter(it => 
                String(it.sku || '').toLowerCase().includes(query) ||
                String(it.nombre || '').toLowerCase().includes(query) ||
                String(it.recomendacion || '').toLowerCase().includes(query)
            );
        }

        // 2. Filtro de pestañas rápidas
        const tab = this.state.activeTab || 'todos';
        if (tab === 'criticos') {
            items = items.filter(it => Number(it.margen_pct) < 0 || String(it.recomendacion || '').toLowerCase().includes('revisar'));
        } else if (tab === 'alta_rotacion') {
            items = items.filter(it => Number(it.unidades_vendidas_periodo) >= 50 || Number(it.metros_consumidos_periodo) >= 10);
        } else if (tab === 'rentables') {
            items = items.filter(it => Number(it.margen_pct) >= 30);
        }

        // 3. Ordenamiento dinámico
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
    },

    calcularTotales(skus = []) {
        let totalVendidas = 0;
        let totalMetrosConsumidos = 0;
        let totalMargenNeto = 0;
        let totalIngresos = 0;

        skus.forEach(it => {
            totalVendidas += Number(it.unidades_vendidas_periodo) || 0;
            totalMetrosConsumidos += Number(it.metros_consumidos_periodo) || 0;
            totalMargenNeto += Number(it.margen_generado_periodo) || 0;
            totalIngresos += (Number(it.precio_venta) || 0) * (Number(it.unidades_vendidas_periodo) || 0);
        });

        return {
            totalVendidas,
            totalMetrosConsumidos,
            totalMargenNeto,
            totalIngresos,
            margenGlobalPct: totalIngresos > 0 ? (totalMargenNeto / totalIngresos) * 100 : 0
        };
    }
};

// ==========================================
// 2. TEMPLATES LAYER
// ==========================================
export const AnalisisNanocarbonTemplates = {
    getLayoutHTML() {
        return `
            <div class="dash-layout p-3 p-md-4">
                <!-- TOP BAR EJECUTIVA -->
                <div class="d-flex justify-content-between align-items-center mb-3 mb-md-4 flex-wrap gap-2">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-dark text-white rounded-pill px-2.5 py-1" style="font-size: 11px;">
                                <i class="bi bi-layers-half me-1"></i>Bobina Madre
                            </span>
                            <h2 class="page-title mb-0 fw-bold" style="font-size: 1.45rem;">Análisis NanoCarbón</h2>
                        </div>
                        <p class="text-muted mb-0 small mt-1">Control de abastecimiento del rollo madre compartido y rentabilidad de códigos fraccionados.</p>
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <!-- SELECTOR VENTANA DE TIEMPO -->
                        <div class="d-flex align-items-center bg-white border rounded-3 px-2 py-1 shadow-sm">
                            <span class="text-muted me-2 small fw-medium"><i class="bi bi-clock-history me-1 text-primary"></i>Periodo:</span>
                            <select id="select-periodo-dias" class="form-select form-select-sm border-0 bg-transparent fw-bold text-dark" style="width: 105px; box-shadow: none; cursor: pointer;">
                                <option value="30">30 días</option>
                                <option value="60">60 días</option>
                                <option value="90" selected>90 días</option>
                            </select>
                        </div>
                        <!-- SELECTOR UMBRAL ALERTA ROLLO -->
                        <div class="d-flex align-items-center bg-white border rounded-3 px-2 py-1 shadow-sm">
                            <span class="text-muted me-2 small fw-medium"><i class="bi bi-shield-check me-1 text-warning"></i>Alerta:</span>
                            <select id="select-umbral-rollo" class="form-select form-select-sm border-0 bg-transparent fw-bold text-dark" style="width: 105px; box-shadow: none; cursor: pointer;">
                                <option value="15">&le; 15 días</option>
                                <option value="30" selected>&le; 30 días</option>
                                <option value="45">&le; 45 días</option>
                                <option value="60">&le; 60 días</option>
                            </select>
                        </div>
                        <button id="btn-refresh-nanocarbon" class="btn btn-sm btn-light bg-white border shadow-sm px-3 fw-medium" title="Recargar métricas">
                            <i class="bi bi-arrow-clockwise me-1 text-secondary"></i> Actualizar
                        </button>
                        <button id="btn-exportar-nanocarbon" class="btn btn-sm btn-primary-action px-3 fw-medium shadow-sm">
                            <i class="bi bi-download me-1"></i> Exportar
                        </button>
                    </div>
                </div>

                <!-- SECCIÓN TARJETAS EJECUTIVAS ROLLO MADRE (ESTILO GASTOS OPERATIVOS) -->
                <div id="section-rollo-container" class="mb-4">
                    <div class="card border-0 shadow-sm p-4 text-center text-muted">
                        <span class="spinner-border spinner-border-sm me-2"></span>Cargando datos del rollo madre...
                    </div>
                </div>

                <!-- BARRA DE HERRAMIENTAS, FILTROS Y VISTAS -->
                <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <!-- Segmented Tabs Filter -->
                    <div class="payment-tabs-bar" id="nanocarbon-tabs-container">
                        <button class="payment-tab-btn active nanocarbon-tab-btn" data-tab="todos">
                            <i class="bi bi-grid-fill me-1 text-primary"></i> Todos
                            <span class="payment-tab-badge" id="tab-count-todos">0</span>
                        </button>
                        <button class="payment-tab-btn nanocarbon-tab-btn" data-tab="alta_rotacion">
                            <i class="bi bi-fire me-1 text-warning"></i> Alta Rotación
                            <span class="payment-tab-badge" id="tab-count-alta">0</span>
                        </button>
                        <button class="payment-tab-btn nanocarbon-tab-btn tab-warning" data-tab="criticos">
                            <i class="bi bi-exclamation-triangle-fill me-1 text-danger"></i> Margen Crítico
                            <span class="payment-tab-badge" id="tab-count-criticos">0</span>
                        </button>
                        <button class="payment-tab-btn nanocarbon-tab-btn" data-tab="rentables">
                            <i class="bi bi-check-circle-fill me-1 text-success"></i> Rentables
                            <span class="payment-tab-badge" id="tab-count-rentables">0</span>
                        </button>
                    </div>

                    <!-- Buscador & Toggle de Vistas (Tabla / Gráfica) -->
                    <div class="d-flex align-items-center gap-2 flex-grow-1 flex-md-grow-0 justify-content-end">
                        <div class="input-group input-group-sm" style="max-width: 260px;">
                            <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                            <input type="text" id="search-nanocarbon" class="form-control border-start-0 ps-0" placeholder="Buscar corte o SKU...">
                        </div>
                        <div class="payment-tabs-bar">
                            <button class="payment-tab-btn active nanocarbon-view-btn" data-view="tabla" title="Vista Tabla Compacta">
                                <i class="bi bi-table"></i>
                            </button>
                            <button class="payment-tab-btn nanocarbon-view-btn" data-view="grafico" title="Vista Analítica y Gráficas">
                                <i class="bi bi-bar-chart-fill"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR DINÁMICO DE VISTA (TABLA OPTIMIZADA SIN SCROLL O GRÁFICO) -->
                <div id="nanocarbon-view-container">
                    <!-- Inyectado dinámicamente -->
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
            <div class="card border-0 shadow-sm" style="border-radius: 14px; overflow: hidden;">
                <!-- Header con Banner Ejecutivo -->
                <div class="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div class="d-flex align-items-center gap-2.5">
                        <div class="dash-icon-box variant-blue" style="width: 36px; height: 36px;">
                            <i class="bi bi-circle-square text-primary fs-5"></i>
                        </div>
                        <div>
                            <div class="d-flex align-items-center gap-2">
                                <h5 class="mb-0 fw-bold" style="color: var(--text-main); font-size: 15px;">Estado del Rollo Madre (NanoCarbón)</h5>
                                <span class="payment-code-badge" style="font-size: 11px;">${escapeHtml(rollo.sku || '5000-ROLLO')}</span>
                            </div>
                            <small class="text-muted">Bobina base para fraccionamiento de películas y cortes derivados</small>
                        </div>
                    </div>
                    <div>
                        ${badgeRollo}
                    </div>
                </div>

                <!-- 4 Tarjetas Ejecutivas Estilo Gastos Operativos -->
                <div class="card-body p-3 p-md-4">
                    <div class="row g-3">
                        <!-- KPI 1: Metros en Stock -->
                        <div class="col-12 col-sm-6 col-lg-3">
                            <div class="payment-kpi-card p-3" style="border-left: 3px solid #3b82f6;">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Metros en Stock</span>
                                    <div class="dash-icon-box variant-blue" style="width: 32px; height: 32px;">
                                        <i class="bi bi-bullseye text-primary"></i>
                                    </div>
                                </div>
                                <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${metrosStock}</h3>
                                <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill" style="font-size: 10px;">
                                    Valor: ${valorStock}
                                </span>
                            </div>
                        </div>

                        <!-- KPI 2: Consumo Diario -->
                        <div class="col-12 col-sm-6 col-lg-3">
                            <div class="payment-kpi-card p-3" style="border-left: 3px solid #6366f1;">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Consumo Diario</span>
                                    <div class="dash-icon-box variant-purple" style="width: 32px; height: 32px;">
                                        <i class="bi bi-speedometer2 text-secondary"></i>
                                    </div>
                                </div>
                                <h3 class="fw-bold mb-1 tnum text-primary" style="font-size: 22px;">${consumoDiario}</h3>
                                <span class="badge bg-light text-secondary border rounded-pill" style="font-size: 10px;">
                                    Últimos ${this.state.diasPeriodo} días
                                </span>
                            </div>
                        </div>

                        <!-- KPI 3: Días Restantes -->
                        <div class="col-12 col-sm-6 col-lg-3">
                            <div class="payment-kpi-card p-3" style="border-left: 3px solid ${isCritico ? '#ef4444' : '#10b981'};">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Autonomía Estimada</span>
                                    <div class="dash-icon-box ${isCritico ? 'variant-red' : 'variant-green'}" style="width: 32px; height: 32px;">
                                        <i class="bi ${isCritico ? 'bi-exclamation-triangle-fill text-danger' : 'bi-calendar-check text-success'}"></i>
                                    </div>
                                </div>
                                <h3 class="fw-bold mb-1 tnum ${isCritico ? 'text-danger' : 'text-success'}" style="font-size: 22px;">${diasRestantesStr}</h3>
                                <span class="badge ${isCritico ? 'bg-danger-subtle text-danger border-danger-subtle' : 'bg-success-subtle text-success border-success-subtle'} border rounded-pill fw-semibold" style="font-size: 10px;">
                                    Umbral alerta: &le; ${this.state.umbralRollo}d
                                </span>
                            </div>
                        </div>

                        <!-- KPI 4: Fecha Agotamiento -->
                        <div class="col-12 col-sm-6 col-lg-3">
                            <div class="payment-kpi-card p-3" style="border-left: 3px solid #f59e0b;">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <span class="text-uppercase fw-bold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Agotamiento Proyectado</span>
                                    <div class="dash-icon-box variant-yellow" style="width: 32px; height: 32px;">
                                        <i class="bi bi-hourglass-split text-warning"></i>
                                    </div>
                                </div>
                                <h3 class="fw-bold mb-1 tnum text-dark" style="font-size: 22px;">${fechaAgotamiento}</h3>
                                <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill" style="font-size: 10px;">
                                    Proyección ritmo actual
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    getBadgeRolloHTML(rec) {
        if (!rec) return '<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle fw-medium px-3 py-1.5 rounded-pill">Sin recomendación</span>';
        const recStr = String(rec).trim();
        const lower = recStr.toLowerCase();

        if (lower.includes('urgente') || lower.includes('comprar rollo urgente')) {
            return `<span class="badge bg-danger text-white fw-bold px-3 py-1.5 rounded-pill shadow-sm"><i class="bi bi-lightning-fill me-1"></i>${escapeHtml(recStr)}</span>`;
        }
        if (lower.includes('planificar') || lower.includes('pronto')) {
            return `<span class="badge bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle fw-bold px-3 py-1.5 rounded-pill"><i class="bi bi-exclamation-triangle-fill me-1"></i>${escapeHtml(recStr)}</span>`;
        }
        if (lower.includes('suficiente')) {
            return `<span class="badge bg-success text-white fw-bold px-3 py-1.5 rounded-pill shadow-sm"><i class="bi bi-check-circle-fill me-1"></i>${escapeHtml(recStr)}</span>`;
        }
        if (lower.includes('sin consumo')) {
            return `<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle fw-medium px-3 py-1.5 rounded-pill"><i class="bi bi-dash-circle me-1"></i>${escapeHtml(recStr)}</span>`;
        }

        return `<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle fw-medium px-3 py-1.5 rounded-pill">${escapeHtml(recStr)}</span>`;
    },

    // 5 COLUMNAS COMPUESTAS (ELIMINA AL 100% EL SCROLL HORIZONTAL)
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
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold sort-col" data-col="nombre" style="cursor: pointer; user-select: none; width: 32%;">
                    Producto / Corte ${getSortIcon('nombre')}
                </th>
                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end sort-col" data-col="unidades_vendidas_periodo" style="cursor: pointer; user-select: none; width: 16%;">
                    Ventas (${this.state.diasPeriodo}d) ${getSortIcon('unidades_vendidas_periodo')}
                </th>
                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end sort-col" data-col="metros_consumidos_periodo" style="cursor: pointer; user-select: none; width: 17%;">
                    Consumo Bobina ${getSortIcon('metros_consumidos_periodo')}
                </th>
                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end sort-col" data-col="precio_venta" style="cursor: pointer; user-select: none; width: 17%;">
                    Precios (Venta/Costo) ${getSortIcon('precio_venta')}
                </th>
                <th class="py-2.5 px-3 text-uppercase text-muted fw-bold text-end sort-col" data-col="margen_generado_periodo" style="cursor: pointer; user-select: none; width: 18%;">
                    Rentabilidad & Margen ${getSortIcon('margen_generado_periodo')}
                </th>
            </tr>
        `;
    },

    getTableRowsHTML(items) {
        if (!items || items.length === 0) {
            return `
                <tr>
                    <td colspan="5" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary opacity-50"></i>
                        No se encontraron códigos derivados que coincidan con los filtros.
                    </td>
                </tr>
            `;
        }

        return items.map(item => {
            const sku = escapeHtml(item.sku || 'S/R');
            const nombre = escapeHtml(item.nombre || 'Sin nombre');
            const vendidas = item.unidades_vendidas_periodo != null ? Number(item.unidades_vendidas_periodo).toLocaleString('es-CO') : '0';
            const metrosPorUnidad = item.metros_por_unidad != null ? `${Number(item.metros_por_unidad).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m/und` : '-';
            const metrosConsumidos = item.metros_consumidos_periodo != null ? `${Number(item.metros_consumidos_periodo).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m` : '0 m';
            const precioVenta = item.precio_venta != null ? `$${Math.round(Number(item.precio_venta)).toLocaleString('es-CO')}` : '$0';
            const costoBase = item.costo_base != null ? `$${Math.round(Number(item.costo_base)).toLocaleString('es-CO')}` : '$0';

            const margenNum = item.margen_pct != null ? Number(item.margen_pct) : 0;
            const esMargenNegativo = margenNum < 0;

            const margenGeneradoNum = item.margen_generado_periodo != null ? Number(item.margen_generado_periodo) : 0;
            const margenGeneradoStr = (margenGeneradoNum < 0 ? '-' : '') + '$' + Math.abs(Math.round(margenGeneradoNum)).toLocaleString('es-CO');

            const tendenciaHTML = this.getTendenciaHTML(item.tendencia_pct);
            const badgeHTML = this.getRecomendacionBadgeHTML(item.recomendacion);

            const rowStyle = esMargenNegativo 
                ? 'background-color: rgba(220, 53, 69, 0.04); border-left: 3px solid #ef4444; border-bottom: 1px solid #f1f5f9; font-size: 13px;' 
                : 'border-bottom: 1px solid #f1f5f9; font-size: 13px;';

            const margenBadgeHTML = esMargenNegativo
                ? `<span class="badge bg-danger text-white fw-bold px-1.5 py-0.5 rounded-pill" style="font-size: 10.5px;"><i class="bi bi-exclamation-triangle-fill me-1"></i>${margenNum.toFixed(1)}%</span>`
                : `<span class="badge ${margenNum >= 30 ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-light text-dark border'} rounded-pill fw-semibold" style="font-size: 10.5px;">${margenNum.toFixed(1)}%</span>`;

            return `
                <tr class="payment-row" style="${rowStyle}">
                    <!-- Columna 1: Producto & SKU & Recomendación -->
                    <td class="py-2.5 px-3">
                        <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                            <span class="payment-code-badge">${sku}</span>
                            <span class="fw-bold text-dark" style="font-size: 13.5px;">${nombre}</span>
                        </div>
                        <div class="d-flex align-items-center gap-1.5 flex-wrap">
                            ${esMargenNegativo ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill" style="font-size: 10px; padding: 2px 7px;">⚠️ Pérdida por unidad</span>' : ''}
                            ${badgeHTML}
                        </div>
                    </td>

                    <!-- Columna 2: Ventas y Tendencia -->
                    <td class="py-2.5 px-3 text-end">
                        <div class="fw-bold text-dark tnum" style="font-size: 14px;">${vendidas} und</div>
                        <div class="small">${tendenciaHTML}</div>
                    </td>

                    <!-- Columna 3: Consumo de Metros -->
                    <td class="py-2.5 px-3 text-end">
                        <div class="fw-bold text-primary tnum" style="font-size: 14px;">${metrosConsumidos}</div>
                        <div class="text-muted small">${metrosPorUnidad}</div>
                    </td>

                    <!-- Columna 4: Precios (Venta y Costo) -->
                    <td class="py-2.5 px-3 text-end">
                        <div class="fw-bold text-dark tnum" style="font-size: 13.5px;">${precioVenta}</div>
                        <div class="text-muted small">Costo: ${costoBase}</div>
                    </td>

                    <!-- Columna 5: Rentabilidad y Margen -->
                    <td class="py-2.5 px-3 text-end">
                        <div class="fw-bold tnum mb-0.5 ${esMargenNegativo ? 'text-danger' : 'text-success'}" style="font-size: 14px;">
                            ${margenGeneradoStr}
                        </div>
                        <div>${margenBadgeHTML}</div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    getTableFooterHTML(skus) {
        if (!skus || skus.length === 0) return '';
        const totales = AnalisisNanocarbonData.calcularTotales(skus);

        const margenNetoStr = (totales.totalMargenNeto < 0 ? '-' : '') + '$' + Math.abs(Math.round(totales.totalMargenNeto)).toLocaleString('es-CO');
        const esMargenNegativo = totales.totalMargenNeto < 0;

        return `
            <tfoot style="background-color: #f8fafc; border-top: 2px solid #cbd5e1; font-size: 12.5px;">
                <tr class="fw-bold">
                    <td class="py-2.5 px-3 text-dark text-uppercase" style="letter-spacing: 0.5px;">
                        Total Consolidado (${skus.length} SKUs):
                    </td>
                    <td class="py-2.5 px-3 text-end text-dark tnum">
                        ${totales.totalVendidas.toLocaleString('es-CO')} und
                    </td>
                    <td class="py-2.5 px-3 text-end text-primary tnum">
                        ${totales.totalMetrosConsumidos.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m
                    </td>
                    <td class="py-2.5 px-3 text-end text-muted small">
                        Consumo total periodo
                    </td>
                    <td class="py-2.5 px-3 text-end ${esMargenNegativo ? 'text-danger' : 'text-success'} tnum" style="font-size: 14px;">
                        ${margenNetoStr}
                        <div class="small fw-semibold text-muted">${totales.margenGlobalPct.toFixed(1)}% margen global</div>
                    </td>
                </tr>
            </tfoot>
        `;
    },

    getAnalyticsViewHTML(rollo, skus) {
        if (!skus || skus.length === 0) {
            return `
                <div class="card border-0 shadow-sm p-5 text-center text-muted" style="border-radius: 14px;">
                    <i class="bi bi-bar-chart fs-1 d-block mb-2 text-secondary opacity-50"></i>
                    No hay datos analíticos para graficar en este periodo.
                </div>
            `;
        }

        const totales = AnalisisNanocarbonData.calcularTotales(skus);
        const totalMetros = totales.totalMetrosConsumidos > 0 ? totales.totalMetrosConsumidos : 1;

        // Ordenar por consumo para el gráfico de barras
        const sortedByMetros = [...skus].sort((a, b) => (Number(b.metros_consumidos_periodo) || 0) - (Number(a.metros_consumidos_periodo) || 0));

        return `
            <div class="row g-4">
                <!-- Tarjeta 1: Distribución de Consumo de Bobina -->
                <div class="col-12 col-lg-6">
                    <div class="card border-0 shadow-sm p-4 h-100" style="border-radius: 14px;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold mb-0 text-dark">
                                <i class="bi bi-pie-chart-fill me-1.5 text-primary"></i>Distribución de Consumo de Bobina
                            </h6>
                            <span class="badge bg-light text-secondary border rounded-pill small">Total: ${totales.totalMetrosConsumidos.toFixed(2)} m</span>
                        </div>
                        <p class="text-muted small mb-3">Participación porcentual de cada corte derivado sobre los metros totales consumidos.</p>
                        
                        <div class="d-flex flex-column gap-3">
                            ${sortedByMetros.map(item => {
                                const metros = Number(item.metros_consumidos_periodo) || 0;
                                const pct = Math.min(100, (metros / totalMetros) * 100);
                                return `
                                    <div>
                                        <div class="d-flex justify-content-between align-items-center mb-1 small">
                                            <span class="fw-semibold text-dark text-truncate" style="max-width: 65%;">
                                                <span class="payment-code-badge me-1" style="font-size: 10px;">${escapeHtml(item.sku)}</span>
                                                ${escapeHtml(item.nombre)}
                                            </span>
                                            <span class="fw-bold text-primary tnum">${metros.toFixed(2)} m <span class="text-muted fw-normal">(${pct.toFixed(1)}%)</span></span>
                                        </div>
                                        <div class="progress" style="height: 7px; border-radius: 999px; background-color: #f1f5f9;">
                                            <div class="progress-bar bg-primary" role="progressbar" style="width: ${pct}%; border-radius: 999px;"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <!-- Tarjeta 2: Ranking de Generación de Margen ($) -->
                <div class="col-12 col-lg-6">
                    <div class="card border-0 shadow-sm p-4 h-100" style="border-radius: 14px;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold mb-0 text-dark">
                                <i class="bi bi-cash-stack me-1.5 text-success"></i>Ranking de Generación de Margen
                            </h6>
                            <span class="badge ${totales.totalMargenNeto >= 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} border rounded-pill small">
                                Neto: $${Math.round(totales.totalMargenNeto).toLocaleString('es-CO')}
                            </span>
                        </div>
                        <p class="text-muted small mb-3">Aporte neto a la utilidad de la empresa por cada producto derivado.</p>

                        <div class="d-flex flex-column gap-3">
                            ${[...skus].sort((a,b) => (Number(b.margen_generado_periodo) || 0) - (Number(a.margen_generado_periodo) || 0)).map(item => {
                                const margen = Number(item.margen_generado_periodo) || 0;
                                const esNegativo = margen < 0;
                                const margenStr = (esNegativo ? '-' : '') + '$' + Math.abs(Math.round(margen)).toLocaleString('es-CO');
                                return `
                                    <div class="p-2.5 rounded-3 border ${esNegativo ? 'border-danger-subtle bg-danger-subtle bg-opacity-10' : 'bg-light'}">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div class="text-truncate me-2" style="max-width: 60%;">
                                                <span class="payment-code-badge me-1" style="font-size: 10px;">${escapeHtml(item.sku)}</span>
                                                <span class="fw-semibold text-dark small">${escapeHtml(item.nombre)}</span>
                                            </div>
                                            <div class="text-end">
                                                <div class="fw-bold tnum ${esNegativo ? 'text-danger' : 'text-success'}" style="font-size: 13.5px;">${margenStr}</div>
                                                <span class="badge ${esNegativo ? 'bg-danger text-white' : 'bg-success text-white'} rounded-pill" style="font-size: 9.5px;">
                                                    ${(Number(item.margen_pct) || 0).toFixed(1)}% margen
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    getTendenciaHTML(val) {
        if (val == null || isNaN(val)) return '<span class="text-muted"><i class="bi bi-dash me-0.5"></i>0.0%</span>';
        const num = Number(val);
        if (num > 0) {
            return `<span class="text-success fw-semibold"><i class="bi bi-arrow-up-right me-0.5"></i>+${num.toFixed(1)}%</span>`;
        }
        if (num < 0) {
            return `<span class="text-danger fw-semibold"><i class="bi bi-arrow-down-right me-0.5"></i>${num.toFixed(1)}%</span>`;
        }
        return '<span class="text-muted"><i class="bi bi-dash me-0.5"></i>0.0%</span>';
    },

    getRecomendacionBadgeHTML(rec) {
        if (!rec) return '';
        const recStr = String(rec).trim();
        const lower = recStr.toLowerCase();

        if (lower.includes('urgente')) {
            return `<span class="badge bg-success-subtle text-success border border-success-subtle fw-semibold rounded-pill" style="font-size: 10.5px; padding: 2px 7px;"><i class="bi bi-lightning-fill me-1"></i>${escapeHtml(recStr)}</span>`;
        }
        if (lower.startsWith('recomprar')) {
            return `<span class="badge bg-success-subtle text-success border border-success-subtle fw-medium rounded-pill" style="font-size: 10.5px; padding: 2px 7px;">${escapeHtml(recStr)}</span>`;
        }
        if (lower.includes('mantener')) {
            return `<span class="badge bg-light text-secondary border rounded-pill fw-medium" style="font-size: 10.5px; padding: 2px 7px;">${escapeHtml(recStr)}</span>`;
        }
        if (lower.includes('revisar') || lower.includes('demand') || lower.includes('cayendo')) {
            return `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-medium rounded-pill" style="font-size: 10.5px; padding: 2px 7px;"><i class="bi bi-exclamation-circle me-1"></i>${escapeHtml(recStr)}</span>`;
        }
        if (lower.includes('no recomprar')) {
            return `<span class="badge bg-danger-subtle text-danger border border-danger-subtle fw-medium rounded-pill" style="font-size: 10.5px; padding: 2px 7px;">${escapeHtml(recStr)}</span>`;
        }

        return `<span class="badge bg-light text-secondary border rounded-pill fw-medium" style="font-size: 10.5px; padding: 2px 7px;">${escapeHtml(recStr)}</span>`;
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

        // Buscador en tiempo real
        const searchInput = el.querySelector('#search-nanocarbon');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.state.searchQuery = e.target.value;
                this.renderContent();
            });
        }

        // Pestañas de Filtro (Segmented Tabs)
        el.querySelectorAll('.nanocarbon-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.dataset.tab;
                this.state.activeTab = targetTab;

                el.querySelectorAll('.nanocarbon-tab-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                this.renderContent();
            });
        });

        // Toggle de Vistas (Tabla / Gráfico)
        el.querySelectorAll('.nanocarbon-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetView = e.currentTarget.dataset.view;
                this.state.activeView = targetView;

                el.querySelectorAll('.nanocarbon-view-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                this.renderContent();
            });
        });
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
        searchQuery: '',
        activeTab: 'todos',
        activeView: 'tabla',
        isLoading: false
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        this.state.sortColumn = 'margen_generado_periodo';
        this.state.sortDirection = 'desc';
        this.state.searchQuery = '';
        this.state.activeTab = 'todos';
        this.state.activeView = 'tabla';

        // Renderizar estructura base
        element.innerHTML = this.getLayoutHTML();

        // Bind events
        this.bindEvents();

        // Cargar datos
        await this.cargarDatos();
    },

    async cargarDatos() {
        this.state.isLoading = true;

        const rolloContainer = this.element.querySelector('#section-rollo-container');
        const viewContainer = this.element.querySelector('#nanocarbon-view-container');

        if (rolloContainer) {
            rolloContainer.innerHTML = `
                <div class="card border-0 shadow-sm p-4 text-center text-muted" style="border-radius: 14px;">
                    <span class="spinner-border spinner-border-sm me-2"></span>Analizando métricas del rollo madre (${this.state.diasPeriodo} días)...
                </div>
            `;
        }

        if (viewContainer) {
            viewContainer.innerHTML = `
                <div class="card border-0 shadow-sm p-5 text-center text-muted" style="border-radius: 14px;">
                    <span class="spinner-border spinner-border-sm me-2"></span>Calculando consumo y rentabilidad de códigos fraccionados...
                </div>
            `;
        }

        const data = await this.fetchAnalisis(this.state.diasPeriodo, this.state.umbralRollo);
        this.state.rawData = data;
        this.state.isLoading = false;

        this.renderRolloCard();
        this.updateTabCounters();
        this.renderContent();
    },

    renderRolloCard() {
        const rollo = this.getRolloResumen();
        const container = this.element.querySelector('#section-rollo-container');
        if (container) {
            container.innerHTML = this.getRolloCardHTML(rollo);
        }
    },

    updateTabCounters() {
        const allSkus = (this.state.rawData || []).filter(it => it.tipo === 'sku');
        const criticos = allSkus.filter(it => Number(it.margen_pct) < 0 || String(it.recomendacion || '').toLowerCase().includes('revisar'));
        const altaRotacion = allSkus.filter(it => Number(it.unidades_vendidas_periodo) >= 50 || Number(it.metros_consumidos_periodo) >= 10);
        const rentables = allSkus.filter(it => Number(it.margen_pct) >= 30);

        const el = this.element;
        if (!el) return;

        const badgeTodos = el.querySelector('#tab-count-todos');
        const badgeCriticos = el.querySelector('#tab-count-criticos');
        const badgeAlta = el.querySelector('#tab-count-alta');
        const badgeRentables = el.querySelector('#tab-count-rentables');

        if (badgeTodos) badgeTodos.textContent = allSkus.length;
        if (badgeCriticos) badgeCriticos.textContent = criticos.length;
        if (badgeAlta) badgeAlta.textContent = altaRotacion.length;
        if (badgeRentables) badgeRentables.textContent = rentables.length;
    },

    renderContent() {
        const viewContainer = this.element.querySelector('#nanocarbon-view-container');
        if (!viewContainer) return;

        const skus = this.getSkuItems();
        const rollo = this.getRolloResumen();

        if (this.state.activeView === 'grafico') {
            viewContainer.innerHTML = this.getAnalyticsViewHTML(rollo, skus);
        } else {
            // Vista Tabla: 100% fluida, cero scroll horizontal
            viewContainer.innerHTML = `
                <div class="card border-0 shadow-sm" style="border-radius: 14px; overflow: hidden;">
                    <div class="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                            <h6 class="mb-0 fw-bold" style="color: var(--text-main);">Códigos Hijos Derivados (Corte de Bobina)</h6>
                            <small class="text-muted">Ventas, consumo de metros y margen consolidado</small>
                        </div>
                        <span class="badge bg-light text-secondary border rounded-pill fw-medium px-2.5 py-1" style="font-size: 11px;">
                            ${skus.length} de ${(this.state.rawData || []).filter(it => it.tipo === 'sku').length} SKUs
                        </span>
                    </div>
                    <div style="width: 100%; overflow: visible;">
                        <table class="table table-borderless align-middle mb-0" style="width: 100%; table-layout: auto;">
                            <thead id="nanocarbon-thead">
                                ${this.getTableHeaderHTML()}
                            </thead>
                            <tbody id="nanocarbon-tbody">
                                ${this.getTableRowsHTML(skus)}
                            </tbody>
                            <tfoot id="nanocarbon-tfoot">
                                ${this.getTableFooterHTML(skus)}
                            </tfoot>
                        </table>
                    </div>
                </div>
            `;
            this.bindSortHeaders();
        }
    },

    renderGrid() {
        const skus = this.getSkuItems();
        const tbody = this.element.querySelector('#nanocarbon-tbody');
        const tfoot = this.element.querySelector('#nanocarbon-tfoot');

        if (tbody) tbody.innerHTML = this.getTableRowsHTML(skus);
        if (tfoot) tfoot.innerHTML = this.getTableFooterHTML(skus);
    },

    exportarCSV() {
        const raw = this.state.rawData || [];
        if (!raw || raw.length === 0) {
            alert('No hay datos disponibles para exportar.');
            return;
        }

        const encabezados = [
            'Tipo', 'SKU', 'Nombre', 'Vendidas Periodo', 'Tendencia %',
            'Metros Por Unidad', 'Metros Consumidos Periodo', 'Precio Venta',
            'Costo Base', 'Margen %', 'Margen Generado Periodo',
            'Metros Stock Actual', 'Valor Stock Actual', 'Consumo Diario Metros',
            'Dias Restantes Rollo', 'Fecha Estimada Agotamiento', 'Recomendacion'
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
