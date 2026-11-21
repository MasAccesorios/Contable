import DB, { getLocalDate } from '../core/db.js';
import { UI } from './combobox.js';
import { supabase } from '../core/supabase.js';
import { anularTransaccion } from './transaccionesUtils.js';
import { applyCurrencyFormatting, parseCurrencyValue, escapeHtml } from './formatters.js';

function getThirdPartyAvatar(name, isIngreso) {
    if (!name || name === '-' || name === 'Sin proveedor' || name === 'General / Sin tercero') {
        return { initials: '?', bg: '#f1f5f9', color: '#64748b' };
    }
    const clean = name.trim();
    const parts = clean.split(/\s+/);
    let initials = parts[0][0] || '';
    if (parts.length > 1 && parts[1][0]) initials += parts[1][0];
    initials = initials.toUpperCase();

    const colorsIngreso = [
        { bg: '#eff6ff', color: '#1d4ed8' },
        { bg: '#ecfdf5', color: '#059669' },
        { bg: '#fef3c7', color: '#d97706' },
        { bg: '#e0f2fe', color: '#0369a1' },
        { bg: '#ccfbf1', color: '#0f766e' }
    ];

    const colorsGasto = [
        { bg: '#fef2f2', color: '#dc2626' },
        { bg: '#fff7ed', color: '#ea580c' },
        { bg: '#fef3c7', color: '#d97706' },
        { bg: '#f3e8ff', color: '#7e22ce' },
        { bg: '#f1f5f9', color: '#475569' }
    ];

    const palette = isIngreso ? colorsIngreso : colorsGasto;
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % palette.length;
    return { initials: initials.substring(0, 2), ...palette[index] };
}

export class CrudFinanciero {
    constructor(config) {
        this.config = config;
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.editingId = null;
        this.isEditing = false;
        this.currentData = [];
        this.searchQuery = '';
        this.selectedTab = 'todos'; // 'todos', 'pendientes', 'conciliados', 'anulados'
        this.selectedCategory = 'todas';
        this.selectedAccount = 'todas';
        this.view = 'lista'; // 'lista' o 'grafico'
        this.kpis = {
            total: 0,
            totalAnterior: 0,
            variacion: 0,
            totalHoy: 0,
            montoPendiente: 0,
            conteoPendiente: 0,
            transaccionesMes: 0
        };
        this.activeDrawerId = null;
    }

    async init(element) {
        this.element = element;
        this.editingId = null;
        this.isEditing = false;
        this.searchQuery = '';
        this.selectedTab = 'todos';
        this.selectedCategory = 'todas';
        this.selectedAccount = 'todas';

        // 1. Cargar contactos, cuentas y categorías
        const [contactos, cuentas, categoriasDB] = await Promise.all([
            DB.getAll('contactos') || [],
            DB.getAll('cuentas_bancarias') || [],
            supabase.from('categorias_contables').select('nombre, tipo_flujo').eq('estado', 'activa')
        ]);

        this.proveedores = contactos || [];
        this.cuentasActivas = cuentas || [];
        this.categorias = categoriasDB?.data || [];

        // 2. Calcular KPIs
        await this.calcularKPIs();

        // 3. Renderizar Layout Principal
        this.renderLayout(element);
        this.setupUI(element);
        await this.renderTabla(element);
    }

    async calcularKPIs() {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();

            const startCurrentMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const prevMonthDate = new Date(year, month - 1, 1);
            const startPrevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
            const lastPrevMonthDate = new Date(year, month, 0);
            const endPrevMonth = `${lastPrevMonthDate.getFullYear()}-${String(lastPrevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(lastPrevMonthDate.getDate()).padStart(2, '0')}`;
            const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const [
                kpiMesRes,
                prevRes,
                todayRes,
                txCountRes,
                concRes,
                monthMovsRes
            ] = await Promise.all([
                supabase.rpc('get_crud_kpis_mes', { p_tipo: this.config.tipoFiltroDb }),
                supabase.from('pagos_ingresos')
                    .select('monto')
                    .eq('tipo', this.config.tipoFiltroDb)
                    .is('factura_id', null)
                    .neq('estado', 'anulado')
                    .gte('fecha', startPrevMonth)
                    .lte('fecha', endPrevMonth),
                supabase.from('pagos_ingresos')
                    .select('monto')
                    .eq('tipo', this.config.tipoFiltroDb)
                    .is('factura_id', null)
                    .neq('estado', 'anulado')
                    .eq('fecha', todayStr),
                supabase.from('pagos_ingresos')
                    .select('id', { count: 'exact', head: true })
                    .eq('tipo', this.config.tipoFiltroDb)
                    .is('factura_id', null)
                    .neq('estado', 'anulado')
                    .gte('fecha', startCurrentMonth),
                supabase.from('conciliaciones')
                    .select('movimientos_conciliados'),
                supabase.from('pagos_ingresos')
                    .select('id, monto, conciliacion_id')
                    .eq('tipo', this.config.tipoFiltroDb)
                    .is('factura_id', null)
                    .neq('estado', 'anulado')
                    .gte('fecha', startCurrentMonth)
            ]);

            let totalActual = parseFloat(kpiMesRes?.data?.directos);
            if (isNaN(totalActual) || kpiMesRes?.error) {
                totalActual = (monthMovsRes?.data || []).reduce((sum, r) => sum + Number(r.monto || 0), 0);
            }
            const totalAnterior = (prevRes?.data || []).reduce((sum, r) => sum + Number(r.monto || 0), 0);

            let variacion = 0;
            if (totalAnterior > 0) {
                variacion = Math.round(((totalActual - totalAnterior) / totalAnterior) * 100);
            } else if (totalActual > 0) {
                variacion = 100;
            }

            const totalHoy = (todayRes?.data || []).reduce((sum, r) => sum + Number(r.monto || 0), 0);
            const txCount = txCountRes?.count || 0;

            // Conciliación
            let montoPendiente = 0;
            let conteoPendiente = 0;
            const concSet = new Set((concRes?.data || []).flatMap(c => c.movimientos_conciliados || []));
            this.concSet = concSet;

            if (monthMovsRes?.data) {
                monthMovsRes.data.forEach(m => {
                    const isConc = Boolean(m.conciliacion_id || concSet.has(m.id));
                    if (!isConc) {
                        montoPendiente += Number(m.monto || 0);
                        conteoPendiente++;
                    }
                });
            }

            this.kpis = {
                total: totalActual,
                totalAnterior,
                variacion,
                totalHoy,
                montoPendiente,
                conteoPendiente,
                transaccionesMes: txCount
            };
        } catch (e) {
            console.error('Error calculando KPIs en CrudFinanciero:', e);
        }
    }

    renderLayout(element) {
        const esIngreso = this.config.tipoFiltroDb === 'in';
        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        const variacion = this.kpis.variacion || 0;

        element.innerHTML = `
            <div class="dash-layout p-3 p-md-4" style="max-width: 1260px; margin: 0 auto;">
                
                <!-- TOP BAR DE ALTO IMPACTO -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <a href="#" onclick="event.preventDefault(); window.history.length > 2 ? window.history.back() : window.location.hash = '#/dashboard';" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body); border-radius: 8px;">
                                <i class="bi bi-arrow-left"></i>
                            </a>
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">${this.config.titulo}</h2>
                            <span class="badge" style="background-color: ${esIngreso ? '#ecfdf5' : '#fef2f2'}; color: ${esIngreso ? '#059669' : '#dc2626'}; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid ${esIngreso ? '#a7f3d0' : '#fecaca'};">
                                <i class="bi ${esIngreso ? 'bi-arrow-down-left' : 'bi-arrow-up-right'} me-1"></i> ${esIngreso ? 'Ingresos Directos' : 'Gastos Operativos'}
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            ${esIngreso 
                                ? 'Registro y trazabilidad de ingresos no asociados a facturas directas.' 
                                : 'Control y monitoreo de gastos generales, servicios y salidas de caja.'}
                        </p>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Toggle de Vistas: Lista vs Analítica -->
                        <div class="btn-group p-1 bg-light border rounded-3" role="group">
                            <button type="button" class="btn btn-sm ${this.view !== 'grafico' ? 'btn-white bg-white shadow-xs fw-bold' : 'btn-light border-0 text-muted'}" id="btn-view-lista" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-table me-1"></i> Lista
                            </button>
                            <button type="button" class="btn btn-sm ${this.view === 'grafico' ? `btn-white bg-white shadow-xs fw-bold ${esIngreso ? 'text-success' : 'text-danger'}` : 'btn-light border-0 text-muted'}" id="btn-view-grafico" style="font-size: 12px; border-radius: 6px;">
                                <i class="bi bi-bar-chart me-1"></i> Analítica
                            </button>
                        </div>

                        <!-- Botón Exportar Excel -->
                        <button id="btn-export-excel" class="btn btn-light bg-white border text-secondary shadow-xs" style="font-weight: 600; font-size: 13px; border-radius: 8px;" title="Descargar en Excel">
                            <i class="bi bi-file-earmark-excel text-success me-1"></i> Exportar
                        </button>

                        <!-- Botón Refrescar -->
                        <button id="btn-refresh-crud" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>

                        <!-- Botón Desplegar Formulario -->
                        <button id="btn-nuevo-registro-top" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-plus-lg"></i> ${this.config.btnNuevoText}
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Total Mes Actual -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Total del Mes</span>
                                <div class="payment-kpi-icon ${esIngreso ? 'in-bg' : 'out-bg'}">
                                    <i class="bi ${esIngreso ? 'bi-arrow-down-left' : 'bi-arrow-up-right'}"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold ${esIngreso ? 'text-success' : 'text-danger'} tnum" style="font-size: 22px;">
                                ${formatMoney(this.kpis.total)}
                            </div>
                            <div class="mt-2 d-flex align-items-center gap-2">
                                <span class="payment-kpi-trend ${(esIngreso ? variacion >= 0 : variacion <= 0) ? 'positive' : 'negative'}">
                                    <i class="bi ${variacion >= 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right'}"></i>
                                    ${variacion >= 0 ? '+' : ''}${variacion}%
                                </span>
                                <span class="text-muted" style="font-size: 11px;">vs mes anterior</span>
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Movimiento de Hoy -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">${esIngreso ? 'Ingresos de Hoy' : 'Gastos de Hoy'}</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi ${esIngreso ? 'bi-sun' : 'bi-calendar2-minus'}"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" style="font-size: 22px;">
                                ${formatMoney(this.kpis.totalHoy)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <i class="bi bi-clock me-1 text-secondary"></i> Movimientos registrados hoy
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Por Conciliar en Banco -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #d97706;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Por Conciliar en Banco</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-clock-history"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-warning-emphasis tnum" style="font-size: 22px;">
                                ${formatMoney(this.kpis.montoPendiente)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <strong>${this.kpis.conteoPendiente}</strong> transacciones pendientes
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Conteo del Mes -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Operaciones del Mes</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-receipt"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" style="font-size: 22px;">
                                ${this.kpis.transaccionesMes || 0}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Registros directos activos
                            </div>
                        </div>
                    </div>
                </div>

                <!-- PANEL DE FORMULARIO DESPLEGABLE / MODERNO -->
                <div class="card mb-4 border rounded-3 shadow-xs" id="card-form-creacion" style="display: none; background: #ffffff; border-color: var(--border-color);">
                    <div class="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-2">
                            <div class="payment-kpi-icon ${esIngreso ? 'in-bg' : 'out-bg'}" style="width: 32px; height: 32px; font-size: 15px;">
                                <i class="bi ${esIngreso ? 'bi-plus-circle' : 'bi-dash-circle'}"></i>
                            </div>
                            <h5 class="mb-0 fw-bold" style="color: var(--text-main); font-size: 15px;" id="titulo-form-creacion">
                                ${this.config.btnNuevoText}
                            </h5>
                        </div>
                        <button type="button" class="btn btn-sm btn-light border-0 text-muted" id="btn-cerrar-form" title="Ocultar">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div class="card-body p-4">
                        <form id="${this.config.formId}">
                            <!-- Fila 1 -->
                            <div class="row g-3 mb-3">
                                <div class="col-12 col-md-4">
                                    <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Fecha *</label>
                                    <input type="date" class="form-control form-control-sm" id="transaccion-fecha" required style="border-radius: 8px; height: 38px;">
                                </div>
                                <div class="col-12 col-md-4">
                                    <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">${esIngreso ? 'Cliente / Tercero (Opcional)' : 'Proveedor / Tercero (Opcional)'}</label>
                                    <div class="custom-combobox" id="combo-proveedor-container">
                                        <input type="text" class="form-control form-control-sm" id="search-proveedor" placeholder="Buscar tercero..." autocomplete="off" style="border-radius: 8px; height: 38px;">
                                        <input type="hidden" id="select-proveedor-id">
                                    </div>
                                </div>
                                <div class="col-12 col-md-4">
                                    <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Monto ($) *</label>
                                    <input type="text" class="form-control form-control-sm fw-bold ${esIngreso ? 'text-success' : 'text-danger'}" id="transaccion-monto" placeholder="$ 0" required style="border-radius: 8px; height: 38px;">
                                </div>
                            </div>
                            
                            <!-- Fila 2 -->
                            <div class="row g-3 mb-3">
                                <div class="col-12 col-md-4">
                                    <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Categoría Contable *</label>
                                    <select class="form-select form-select-sm" id="transaccion-categoria" required style="border-radius: 8px; height: 38px;">
                                        <option value="">Seleccione categoría...</option>
                                        ${this.categorias.map(c => `<option value="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="col-12 col-md-4">
                                    <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Cuenta Bancaria / Caja *</label>
                                    <div class="custom-combobox" id="combo-cuenta-container">
                                        <input type="text" class="form-control form-control-sm" id="transaccion-cuenta" placeholder="Buscar cuenta..." required autocomplete="off" style="border-radius: 8px; height: 38px;">
                                        <input type="hidden" id="transaccion-cuenta-id" required>
                                    </div>
                                </div>
                                <div class="col-12 col-md-4">
                                    <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Referencia / N° Recibo (Opcional)</label>
                                    <input type="text" class="form-control form-control-sm" id="transaccion-referencia" placeholder="Ej. Factura 1234, Transferencia..." style="border-radius: 8px; height: 38px;">
                                </div>
                            </div>

                            <!-- Fila 3 -->
                            <div class="row g-3 align-items-end">
                                <div class="col-12 col-md-8">
                                    <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Descripción / Concepto *</label>
                                    <input type="text" class="form-control form-control-sm" id="transaccion-descripcion" placeholder="Ej. Pago servicio de energía, Compra de café y suministros..." required minlength="3" style="border-radius: 8px; height: 38px;">
                                </div>
                                <div class="col-12 col-md-4 d-flex gap-2">
                                    <button type="submit" class="btn btn-primary-action flex-grow-1 shadow-xs" id="btn-guardar-transaccion" style="height: 38px; border-radius: 8px; font-weight: 600;">
                                        <i class="bi bi-check-circle me-1"></i>Registrar
                                    </button>
                                    <button type="button" class="btn btn-light border d-none" id="btn-cancelar-edicion" style="height: 38px; border-radius: 8px;">
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- CONTENEDOR DE ANALÍTICA GRÁFICA -->
                <div id="crud-analytics-container" style="display: ${this.view === 'grafico' ? 'block' : 'none'};"></div>

                <!-- CONTENEDOR DE TABLA DE DATOS -->
                <div id="crud-table-view-container" style="display: ${this.view !== 'grafico' ? 'block' : 'none'};">
                    <div class="dash-table-container mb-4 shadow-xs" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                        
                        <!-- FILTROS Y TABS SUPERIORES -->
                        <div class="p-3 border-bottom bg-white d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                            <!-- Tabs de Filtro Rápido -->
                            <div class="payment-tabs-bar">
                                <button type="button" class="payment-tab-btn ${this.selectedTab === 'todos' ? 'active' : ''}" data-tab="todos">
                                    Todos
                                </button>
                                <button type="button" class="payment-tab-btn tab-warning ${this.selectedTab === 'pendientes' ? 'active' : ''}" data-tab="pendientes">
                                    <i class="bi bi-clock-history text-warning"></i> Por conciliar
                                    ${this.kpis.conteoPendiente > 0 ? `<span class="payment-tab-badge">${this.kpis.conteoPendiente}</span>` : ''}
                                </button>
                                <button type="button" class="payment-tab-btn ${this.selectedTab === 'conciliados' ? 'active' : ''}" data-tab="conciliados">
                                    <i class="bi bi-patch-check-fill text-success"></i> Conciliados
                                </button>
                                <button type="button" class="payment-tab-btn ${this.selectedTab === 'anulados' ? 'active' : ''}" data-tab="anulados">
                                    Anulados
                                </button>
                            </div>

                            <!-- Buscador y Selectores -->
                            <div class="d-flex flex-wrap align-items-center gap-2">
                                <div class="ds-search-container" style="min-width: 200px;">
                                    <i class="bi bi-search ds-search-icon"></i>
                                    <input type="text" class="ds-search-input" id="search-crud" autocomplete="off" placeholder="Buscar descripción, tercero..." value="${escapeHtml(this.searchQuery)}">
                                </div>

                                <select class="form-select form-select-sm" id="filtro-categoria" style="width: auto; min-width: 140px; font-size: 13px; height: 38px; border-radius: 8px;">
                                    <option value="todas" ${this.selectedCategory === 'todas' ? 'selected' : ''}>🏷️ Todas las categorías</option>
                                    ${this.categorias.map(c => `<option value="${escapeHtml(c.nombre)}" ${this.selectedCategory === c.nombre ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}
                                </select>

                                <select class="form-select form-select-sm" id="filtro-cuenta" style="width: auto; min-width: 140px; font-size: 13px; height: 38px; border-radius: 8px;">
                                    <option value="todas" ${this.selectedAccount === 'todas' ? 'selected' : ''}>🏦 Todas las cuentas</option>
                                    ${this.cuentasActivas.map(c => `<option value="${c.id}" ${String(this.selectedAccount) === String(c.id) ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <!-- TABLA DE FILAS INTELIGENTES -->
                        <div class="table-responsive position-relative" style="overflow-x: hidden; width: 100%;">
                            <div id="crud-loading-overlay" class="position-absolute top-0 start-0 w-100 h-100 justify-content-center align-items-center bg-white bg-opacity-75" style="z-index: 10; display: none !important;">
                                <div class="spinner-border ${esIngreso ? 'text-primary' : 'text-danger'}" role="status"><span class="visually-hidden">Cargando...</span></div>
                            </div>
                            <table class="table table-hover table-borderless align-middle mb-0 w-100" style="table-layout: auto;">
                                <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                    <tr>
                                        <th class="py-3 ps-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 115px;">Fecha / ID</th>
                                        <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Concepto & Categoría</th>
                                        <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">${esIngreso ? 'Cliente / Tercero' : 'Proveedor / Tercero'}</th>
                                        <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Cuenta Bancaria</th>
                                        <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 120px;">Conciliación</th>
                                        <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 120px;">Monto</th>
                                        <th class="py-3 pe-3 text-end text-uppercase text-muted fw-bold" style="width: 80px;"></th>
                                    </tr>
                                </thead>
                                <tbody id="${this.config.tbodyId}">
                                    <!-- Filas inyectadas por renderTabla -->
                                </tbody>
                            </table>
                        </div>

                        <!-- PAGINADOR -->
                        <div class="card-footer bg-white border-top p-3 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2" style="border-radius: 0 0 12px 12px;" id="${this.config.tbodyId}-pagination">
                        </div>
                    </div>
                </div>
            </div>

            <!-- SLIDE-OVER DRAWER DE TRAZABILIDAD -->
            <div class="payment-drawer-backdrop" id="crud-drawer-backdrop"></div>
            <div class="payment-drawer" id="crud-drawer">
                <div class="payment-drawer-header">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-receipt-cutoff ${esIngreso ? 'text-primary' : 'text-danger'} fs-5"></i>
                        <h5 class="fw-bold mb-0" style="color: #0f172a; font-size: 16px;">Detalle de la Operación</h5>
                    </div>
                    <button type="button" class="btn btn-sm btn-light border-0 text-muted" id="btn-crud-drawer-close" title="Cerrar panel">
                        <i class="bi bi-x-lg fs-6"></i>
                    </button>
                </div>
                <div class="payment-drawer-body" id="crud-drawer-body">
                    <!-- Contenido del comprobante -->
                </div>
                <div class="payment-drawer-footer">
                    <button type="button" class="btn btn-light border btn-sm px-3 fw-medium" id="btn-crud-drawer-close-bottom">
                        Cerrar
                    </button>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-outline-danger btn-sm px-3 fw-medium" id="btn-crud-drawer-anular">
                            <i class="bi bi-x-circle me-1"></i> Anular
                        </button>
                        <button type="button" class="btn btn-primary btn-sm px-3 fw-medium" id="btn-crud-drawer-editar">
                            <i class="bi bi-pencil me-1"></i> Editar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    setupUI(element) {
        // 1. Combobox Proveedor
        UI.createCombobox({
            inputEl: element.querySelector('#search-proveedor'),
            hiddenIdEl: element.querySelector('#select-proveedor-id'),
            items: this.proveedores,
            displayProp: 'nombre',
            searchProps: ['nit', 'email']
        });

        // 2. Combobox Cuenta Bancaria
        const inputCuenta = element.querySelector('#transaccion-cuenta');
        const hiddenCuentaId = element.querySelector('#transaccion-cuenta-id');
        const bancosData = this.cuentasActivas.map(b => ({
            id: b.id, 
            displayNombre: `${b.nombre} ${b.numero && b.numero !== '-' ? '('+b.numero+')' : ''}`
        }));
        UI.createCombobox({
            inputEl: inputCuenta,
            hiddenIdEl: hiddenCuentaId,
            items: bancosData,
            displayProp: 'displayNombre',
            searchProps: ['displayNombre']
        });

        element.querySelector('#transaccion-fecha').value = getLocalDate();
        applyCurrencyFormatting(element.querySelector('#transaccion-monto'));

        // 3. Toggle Formulario de Creación
        const cardForm = element.querySelector('#card-form-creacion');
        const btnNuevoTop = element.querySelector('#btn-nuevo-registro-top');
        const btnCerrarForm = element.querySelector('#btn-cerrar-form');
        const btnCancelarEdicion = element.querySelector('#btn-cancelar-edicion');

        const abrirFormulario = () => {
            if (cardForm) {
                cardForm.style.display = 'block';
                cardForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
                element.querySelector('#transaccion-monto')?.focus();
            }
        };

        const cerrarFormulario = () => {
            if (cardForm) {
                this.cancelarEdicion(element);
                cardForm.style.display = 'none';
            }
        };

        if (btnNuevoTop) btnNuevoTop.addEventListener('click', abrirFormulario);
        if (btnCerrarForm) btnCerrarForm.addEventListener('click', cerrarFormulario);
        if (btnCancelarEdicion) btnCancelarEdicion.addEventListener('click', () => {
            this.cancelarEdicion(element);
            cerrarFormulario();
        });

        // 4. Tabs de Filtro Rápido
        element.querySelectorAll('.payment-tab-btn').forEach(tabBtn => {
            tabBtn.addEventListener('click', () => {
                element.querySelectorAll('.payment-tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                this.selectedTab = tabBtn.dataset.tab || 'todos';
                this.currentPage = 1;
                this.renderTabla(element);
            });
        });

        // 5. Buscador con debounce
        const inputSearch = element.querySelector('#search-crud');
        let searchTimeout;
        if (inputSearch) {
            inputSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchQuery = e.target.value.trim();
                    this.currentPage = 1;
                    this.renderTabla(element);
                }, 350);
            });
        }

        // 6. Selectores de Categoría y Cuenta
        const selCat = element.querySelector('#filtro-categoria');
        if (selCat) {
            selCat.addEventListener('change', (e) => {
                this.selectedCategory = e.target.value;
                this.currentPage = 1;
                this.renderTabla(element);
            });
        }

        const selCta = element.querySelector('#filtro-cuenta');
        if (selCta) {
            selCta.addEventListener('change', (e) => {
                this.selectedAccount = e.target.value;
                this.currentPage = 1;
                this.renderTabla(element);
            });
        }

        // 7. Toggle Vista Lista vs Analítica
        const btnViewLista = element.querySelector('#btn-view-lista');
        const btnViewGrafico = element.querySelector('#btn-view-grafico');
        const containerTable = element.querySelector('#crud-table-view-container');
        const containerAnalytics = element.querySelector('#crud-analytics-container');
        const esIngreso = this.config.tipoFiltroDb === 'in';

        if (btnViewLista && btnViewGrafico) {
            btnViewLista.addEventListener('click', () => {
                this.view = 'lista';
                btnViewLista.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold';
                btnViewGrafico.className = 'btn btn-sm btn-light border-0 text-muted';
                if (containerAnalytics) containerAnalytics.style.display = 'none';
                if (containerTable) containerTable.style.display = 'block';
                this.renderTabla(element);
            });

            btnViewGrafico.addEventListener('click', async () => {
                this.view = 'grafico';
                btnViewGrafico.className = `btn btn-sm btn-white bg-white shadow-xs fw-bold ${esIngreso ? 'text-success' : 'text-danger'}`;
                btnViewLista.className = 'btn btn-sm btn-light border-0 text-muted';
                if (containerTable) containerTable.style.display = 'none';
                if (containerAnalytics) {
                    containerAnalytics.style.display = 'block';
                    containerAnalytics.innerHTML = `
                        <div class="text-center py-5">
                            <div class="spinner-border ${esIngreso ? 'text-primary' : 'text-danger'}" role="status"></div>
                            <p class="text-muted mt-2" style="font-size: 13px;">Generando analítica...</p>
                        </div>
                    `;
                    const data = await this.cargarDatosGrafico();
                    this.renderAnalyticsView(containerAnalytics, data);
                }
            });
        }

        // 8. Botón Exportar Excel
        const btnExport = element.querySelector('#btn-export-excel');
        if (btnExport) btnExport.addEventListener('click', () => this.exportarExcel());

        // 9. Botón Refrescar
        const btnRefresh = element.querySelector('#btn-refresh-crud');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', async () => {
                const icon = btnRefresh.querySelector('i');
                if (icon) icon.classList.add('spinner-border', 'spinner-border-sm');
                await this.refrescarVista(element);
            });
        }

        // 10. Drawer Close Events
        const btnCloseDrawer = element.querySelector('#btn-crud-drawer-close');
        const btnCloseDrawerB = element.querySelector('#btn-crud-drawer-close-bottom');
        const backdropDrawer = element.querySelector('#crud-drawer-backdrop');
        if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', () => this.cerrarDrawer());
        if (btnCloseDrawerB) btnCloseDrawerB.addEventListener('click', () => this.cerrarDrawer());
        if (backdropDrawer) backdropDrawer.addEventListener('click', () => this.cerrarDrawer());

        // 11. Envío del Formulario
        const form = element.querySelector(`#${this.config.formId}`);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = element.querySelector('#btn-guardar-transaccion');
            if (btn && btn.disabled) return;
            const cuentaIdRaw = hiddenCuentaId.value.trim();

            const cuentaValida = this.cuentasActivas.find(b => String(b.id) === cuentaIdRaw);
            if (!cuentaValida) {
                alert("Por favor seleccione una cuenta bancaria válida de la lista.");
                return;
            }

            const isEditMode = Boolean(this.isEditing && this.editingId);
            const targetId = isEditMode ? parseInt(this.editingId, 10) : null;
            const montoRaw = element.querySelector('#transaccion-monto').value;

            const datos = {
                id: targetId,
                fecha: element.querySelector('#transaccion-fecha').value,
                categoria: element.querySelector('#transaccion-categoria').value,
                monto: parseCurrencyValue(String(montoRaw).replace(/[^0-9.,-]/g, '')),
                cuentaId: parseInt(cuentaIdRaw, 10),
                proveedorId: element.querySelector('#select-proveedor-id').value || null,
                referencia: element.querySelector('#transaccion-referencia').value.trim(),
                descripcion: element.querySelector('#transaccion-descripcion').value.trim(),
                estado: 'activo'
            };

            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...';
                
                await this.registrarTransaccion(datos);
                
                this.editingId = null;
                this.isEditing = false;
                this.cancelarEdicion(element);
                if (cardForm) cardForm.style.display = 'none';

                await this.refrescarVista(element);
            } catch (err) {
                alert('Error al guardar: ' + (err?.message || JSON.stringify(err)));
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Registrar';
            }
        });
    }

    async refrescarVista(element) {
        await this.calcularKPIs();
        this.renderLayout(element);
        this.setupUI(element);
        if (this.view === 'grafico') {
            const cAnalytics = element.querySelector('#crud-analytics-container');
            if (cAnalytics) {
                cAnalytics.style.display = 'block';
                const data = await this.cargarDatosGrafico();
                this.renderAnalyticsView(cAnalytics, data);
            }
        } else {
            await this.renderTabla(element);
        }
    }

    async registrarTransaccion(datosPrevios) {
        if (!datosPrevios.cuentaId || datosPrevios.monto <= 0 || !datosPrevios.categoria || !datosPrevios.descripcion) {
            throw new Error("Datos inválidos o incompletos para registrar la transacción.");
        }

        try {
            let transaccion = {
                cuenta_id: parseInt(datosPrevios.cuentaId, 10),
                fecha: datosPrevios.fecha,
                tipo: this.config.tipoTransaccion, 
                monto: datosPrevios.monto,
                categoria: datosPrevios.categoria, 
                referencia: datosPrevios.referencia || null, 
                observaciones: datosPrevios.descripcion, 
                contacto_id: datosPrevios.proveedorId ? parseInt(datosPrevios.proveedorId, 10) : null
            };

            if (datosPrevios.id) {
                const { data: exist, error: errExist } = await supabase
                    .from('pagos_ingresos')
                    .select('*')
                    .eq('id', datosPrevios.id)
                    .single();

                if (errExist || !exist) {
                    throw new Error(`El registro con ID ${datosPrevios.id} no existe.`);
                }
                if (exist) {
                    transaccion = { ...exist, ...transaccion };
                }
                transaccion.id = datosPrevios.id;
            }

            const saved = await DB.save('transacciones', transaccion);
            return saved || transaccion;
        } catch (error) {
            console.error("Fallo al registrar la transacción en pagos_ingresos:", error);
            throw error;
        }
    }

    async renderTabla(element) {
        const tbody = element.querySelector(`#${this.config.tbodyId}`);
        const pagContainer = element.querySelector(`#${this.config.tbodyId}-pagination`);
        const overlay = element.querySelector('#crud-loading-overlay');
        const esIngreso = this.config.tipoFiltroDb === 'in';

        if (overlay) overlay.style.setProperty('display', 'flex', 'important');

        try {
            // 1. Obtener IDs conciliados para estado
            const { data: concData } = await supabase.from('conciliaciones').select('movimientos_conciliados');
            const concSet = new Set((concData || []).flatMap(c => c.movimientos_conciliados || []));

            // 2. Consulta Base
            let query = supabase
                .from('pagos_ingresos')
                .select('*', { count: 'exact' })
                .eq('tipo', this.config.tipoFiltroDb)
                .is('factura_id', null);

            if (this.selectedTab === 'anulados') {
                query = query.eq('estado', 'anulado');
            } else {
                query = query.neq('estado', 'anulado');
            }

            if (this.selectedCategory !== 'todas') {
                query = query.eq('categoria', this.selectedCategory);
            }

            if (this.selectedAccount !== 'todas') {
                query = query.eq('cuenta_id', parseInt(this.selectedAccount, 10));
            }

            query = query.order('fecha', { ascending: false }).order('id', { ascending: false });

            // Manejo de paginación consistente
            const isTabFiltered = this.selectedTab === 'pendientes' || this.selectedTab === 'conciliados' || (this.searchQuery && this.searchQuery !== '');

            let data = [];
            let totalItems = 0;

            if (!isTabFiltered) {
                const from = (this.currentPage - 1) * this.itemsPerPage;
                const to = from + this.itemsPerPage - 1;
                query = query.range(from, to);

                const res = await query;
                data = res.data || [];
                totalItems = res.count || 0;
            } else {
                // Consulta un lote amplio para filtrar con precisión
                const res = await query.limit(1000);
                let filtrados = res.data || [];

                // Filtro de conciliación
                if (this.selectedTab === 'pendientes') {
                    filtrados = filtrados.filter(g => !Boolean(g.conciliacion_id || concSet.has(g.id)));
                } else if (this.selectedTab === 'conciliados') {
                    filtrados = filtrados.filter(g => Boolean(g.conciliacion_id || concSet.has(g.id)));
                }

                // Filtro de búsqueda
                if (this.searchQuery) {
                    const q = this.searchQuery.toLowerCase();
                    filtrados = filtrados.filter(g => {
                        const prov = (this.proveedores || []).find(p => String(p.id) === String(g.contacto_id));
                        const provNombre = prov ? prov.nombre.toLowerCase() : '';
                        return String(g.observaciones || '').toLowerCase().includes(q) ||
                               String(g.categoria || '').toLowerCase().includes(q) ||
                               String(g.referencia || '').toLowerCase().includes(q) ||
                               String(g.monto || '').includes(q) ||
                               provNombre.includes(q);
                    });
                }

                totalItems = filtrados.length;
                const totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;
                if (this.currentPage > totalPages) this.currentPage = totalPages;

                const from = (this.currentPage - 1) * this.itemsPerPage;
                data = filtrados.slice(from, from + this.itemsPerPage);
            }

            this.currentData = data;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;

            if (!data || data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-muted py-5">
                            <div class="mb-3"><i class="bi bi-inbox fs-1 text-secondary opacity-50"></i></div>
                            <h6 class="fw-semibold text-dark">No se encontraron registros</h6>
                            <p class="text-muted mb-0" style="font-size: 13px;">Prueba ajustando los filtros o registra un nuevo movimiento.</p>
                        </td>
                    </tr>
                `;
                if (pagContainer) pagContainer.innerHTML = '';
                return;
            }

            const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            const formatFecha = dateStr => {
                if (!dateStr) return '---';
                const partes = dateStr.split('-');
                return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dateStr;
            };

            tbody.innerHTML = data.map(g => {
                const prov = (this.proveedores || []).find(p => String(p.id) === String(g.contacto_id));
                const provNombre = prov ? prov.nombre : 'General / Sin tercero';
                const cta = (this.cuentasActivas || []).find(c => String(c.id) === String(g.cuenta_id));
                const ctaNombre = cta ? cta.nombre : 'Caja / Efectivo';
                const isConciliado = Boolean(g.conciliacion_id || concSet.has(g.id));
                const isAnulado = g.estado === 'anulado';
                const avatar = getThirdPartyAvatar(provNombre, esIngreso);

                return `
                    <tr class="payment-row fila-crud-registro" data-id="${g.id}">
                        <!-- Columna 1: Fecha & ID -->
                        <td class="py-3 ps-3">
                            <div class="payment-code-badge mb-1"># ${g.id}</div>
                            <div class="text-muted" style="font-size: 11px;">
                                <i class="bi bi-calendar3 me-1"></i> ${formatFecha(g.fecha)}
                            </div>
                        </td>

                        <!-- Columna 2: Concepto & Categoría -->
                        <td class="py-3">
                            <div class="fw-bold text-dark text-truncate" style="max-width: 200px; font-size: 13px;" title="${escapeHtml(g.observaciones || '')}">
                                ${escapeHtml(g.observaciones || 'Sin descripción')}
                            </div>
                            <div class="mt-1 d-flex align-items-center gap-1">
                                <span class="badge bg-light text-secondary border fw-medium text-truncate" style="font-size: 10px; max-width: 130px;">
                                    ${escapeHtml(g.categoria || 'Sin categoría')}
                                </span>
                                ${g.referencia ? `<span class="text-muted text-truncate" style="font-size: 11px; max-width: 90px;">Ref: ${escapeHtml(g.referencia)}</span>` : ''}
                            </div>
                        </td>

                        <!-- Columna 3: Tercero con Avatar -->
                        <td class="py-3">
                            <div class="d-flex align-items-center gap-2">
                                <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color};">
                                    ${avatar.initials}
                                </div>
                                <div class="text-truncate" style="max-width: 155px;">
                                    <div class="fw-semibold text-dark text-truncate" style="font-size: 13px;" title="${escapeHtml(provNombre)}">
                                        ${escapeHtml(provNombre)}
                                    </div>
                                    ${(prov?.identificacion || prov?.nit) ? `<div class="text-muted text-truncate" style="font-size: 11px;">${escapeHtml(prov.identificacion || prov.nit)}</div>` : ''}
                                </div>
                            </div>
                        </td>

                        <!-- Columna 4: Cuenta Bancaria -->
                        <td class="py-3">
                            <span class="payment-bank-tag text-truncate" style="max-width: 140px;" title="${escapeHtml(ctaNombre)}">
                                <i class="bi bi-bank text-secondary"></i> ${escapeHtml(ctaNombre)}
                            </span>
                        </td>

                        <!-- Columna 5: Estado de Conciliación -->
                        <td class="py-3 text-center">
                            ${isAnulado ? `
                                <span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle rounded-pill fw-medium px-2 py-1">Anulado</span>
                            ` : isConciliado ? `
                                <span class="payment-reconciled-badge">
                                    <i class="bi bi-patch-check-fill"></i> Conciliado
                                </span>
                            ` : `
                                <span class="payment-pending-badge">
                                    <i class="bi bi-clock-history"></i> Por conciliar
                                </span>
                            `}
                        </td>

                        <!-- Columna 6: Monto -->
                        <td class="py-3 text-end">
                            <div class="fw-bold tnum ${isAnulado ? 'text-muted text-decoration-line-through opacity-50' : (esIngreso ? 'text-success' : 'text-danger')}" style="font-size: 14px;">
                                ${this.config.prefijoMonto}${formatMoney(g.monto)}
                            </div>
                        </td>

                        <!-- Columna 7: Acciones Rápidas -->
                        <td class="py-3 pe-3 text-end">
                            <div class="payment-row-actions">
                                <button class="btn btn-sm btn-light border-0 p-1 btn-quick-view-crud" data-id="${g.id}" title="Ver Detalle">
                                    <i class="bi bi-eye ${esIngreso ? 'text-primary' : 'text-danger'}"></i>
                                </button>
                                ${!isConciliado && !isAnulado ? `
                                    <button class="btn btn-sm btn-light border-0 p-1 btn-quick-edit-crud" data-id="${g.id}" title="Editar">
                                        <i class="bi bi-pencil text-secondary"></i>
                                    </button>
                                ` : ''}
                                <div class="dropdown d-inline-block">
                                    <button class="btn btn-sm btn-link text-muted p-1 border-0" data-bs-toggle="dropdown">
                                        <i class="bi bi-three-dots-vertical"></i>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-end shadow border" style="font-size: 13px; border-radius: 8px;">
                                        <li><a class="dropdown-item py-2 d-flex align-items-center gap-2 btn-menu-ver-crud" href="javascript:void(0)" data-id="${g.id}"><i class="bi bi-layout-sidebar-inset-reverse ${esIngreso ? 'text-primary' : 'text-danger'}"></i> Ver detalle</a></li>
                                        ${!isConciliado && !isAnulado ? `
                                            <li><a class="dropdown-item py-2 d-flex align-items-center gap-2 btn-menu-edit-crud" href="javascript:void(0)" data-id="${g.id}"><i class="bi bi-pencil text-secondary"></i> Editar</a></li>
                                            <li><hr class="dropdown-divider my-1"></li>
                                            <li><a class="dropdown-item py-2 d-flex align-items-center gap-2 text-danger btn-menu-anular-crud" href="javascript:void(0)" data-id="${g.id}"><i class="bi bi-trash"></i> Anular</a></li>
                                        ` : isConciliado ? `
                                            <li><span class="dropdown-item-text text-muted small fst-italic py-2" style="font-size: 11px;">Movimiento conciliado con el banco.</span></li>
                                        ` : ''}
                                    </ul>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Eventos en Filas
            tbody.querySelectorAll('.fila-crud-registro').forEach(tr => {
                tr.addEventListener('click', (e) => {
                    if (e.target.closest('.dropdown') || e.target.closest('button')) return;
                    const id = tr.dataset.id;
                    this.mostrarDrawer(id, element);
                });
            });

            tbody.querySelectorAll('.btn-quick-view-crud, .btn-menu-ver-crud').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    this.mostrarDrawer(id, element);
                });
            });

            tbody.querySelectorAll('.btn-quick-edit-crud, .btn-menu-edit-crud').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    this.iniciarEdicion(id, element);
                });
            });

            tbody.querySelectorAll('.btn-menu-anular-crud').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    if (confirm('¿Está seguro de anular este registro? Esta acción revertirá el movimiento contable y bancario.')) {
                        try {
                            await this.anularTransaccionObj(id);
                            await this.refrescarVista(element);
                        } catch (err) {
                            alert("Error al anular: " + err.message);
                        }
                    }
                });
            });

            // 3. Render Paginación
            const fromItem = totalItems > 0 ? (this.currentPage - 1) * this.itemsPerPage + 1 : 0;
            const toItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);

            if (pagContainer) {
                pagContainer.innerHTML = `
                    <div class="d-flex align-items-center gap-3" style="font-size: 13px; color: var(--text-body);">
                        <div class="d-flex align-items-center gap-2">
                            <span>Mostrar:</span>
                            <select class="form-select form-select-sm text-muted select-per-page" style="width: 70px;">
                                <option value="10" ${this.itemsPerPage===10?'selected':''}>10</option>
                                <option value="20" ${this.itemsPerPage===20?'selected':''}>20</option>
                                <option value="50" ${this.itemsPerPage===50?'selected':''}>50</option>
                            </select>
                        </div>
                        <span class="text-muted border-start ps-3">
                            ${totalItems > 0 ? `<strong>${fromItem} - ${toItem}</strong> de <strong>${totalItems}</strong> registros` : '0 registros'}
                        </span>
                    </div>

                    <div class="d-flex align-items-center gap-2" style="font-size: 13px;">
                        <button class="btn btn-sm btn-light border btn-prev-page" ${this.currentPage <= 1 ? 'disabled' : ''}>
                            <i class="bi bi-chevron-left me-1"></i> Anterior
                        </button>
                        <span class="px-2 text-muted">
                            Página <strong>${this.currentPage}</strong> de <strong>${totalPages}</strong>
                        </span>
                        <button class="btn btn-sm btn-light border btn-next-page" ${this.currentPage >= totalPages ? 'disabled' : ''}>
                            Siguiente <i class="bi bi-chevron-right ms-1"></i>
                        </button>
                    </div>
                `;

                pagContainer.querySelector('.select-per-page').addEventListener('change', (e) => {
                    this.itemsPerPage = parseInt(e.target.value, 10);
                    this.currentPage = 1;
                    this.renderTabla(element);
                });
                pagContainer.querySelector('.btn-prev-page').addEventListener('click', () => {
                    if (this.currentPage > 1) { this.currentPage--; this.renderTabla(element); }
                });
                pagContainer.querySelector('.btn-next-page').addEventListener('click', () => {
                    if (this.currentPage < totalPages) { this.currentPage++; this.renderTabla(element); }
                });
            }
        } catch (error) {
            console.error("Error cargando tabla en CrudFinanciero:", error);
        } finally {
            if (overlay) overlay.style.setProperty('display', 'none', 'important');
        }
    }

    async mostrarDrawer(id, element) {
        const backdrop = element.querySelector('#crud-drawer-backdrop');
        const drawer = element.querySelector('#crud-drawer');
        const body = element.querySelector('#crud-drawer-body');
        if (!drawer || !body) return;

        const esIngreso = this.config.tipoFiltroDb === 'in';
        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        const formatFecha = dateStr => {
            if (!dateStr) return '---';
            const partes = dateStr.split('-');
            return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dateStr;
        };

        body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center py-5">
                <div class="spinner-border ${esIngreso ? 'text-primary' : 'text-danger'}" role="status"><span class="visually-hidden">Cargando...</span></div>
            </div>
        `;
        if (backdrop) backdrop.classList.add('show');
        drawer.classList.add('show');
        this.activeDrawerId = id;

        try {
            const { data: g } = await supabase.from('pagos_ingresos').select('*, cuentas_bancarias(nombre), contactos(nombre, identificacion)').eq('id', id).single();
            if (!g) throw new Error("Registro no encontrado.");

            const provNombre = g.contactos?.nombre || 'General / Sin tercero';
            const provNit = g.contactos?.identificacion || '';
            const ctaNombre = g.cuentas_bancarias?.nombre || 'Caja / Efectivo';
            const avatar = getThirdPartyAvatar(provNombre, esIngreso);
            const isAnulado = g.estado === 'anulado';

            if (!this.concSet) {
                const { data: concData } = await supabase.from('conciliaciones').select('movimientos_conciliados');
                this.concSet = new Set((concData || []).flatMap(c => c.movimientos_conciliados || []));
            }
            const isConciliado = Boolean(g.conciliacion_id || this.concSet.has(g.id));

            body.innerHTML = `
                <!-- Header del Comprobante -->
                <div class="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
                    <div class="d-flex align-items-center gap-3">
                        <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 44px; height: 44px; font-size: 15px;">
                            ${avatar.initials}
                        </div>
                        <div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="payment-code-badge" style="border-color: ${esIngreso ? '#a7f3d0' : '#fecaca'}; color: ${esIngreso ? '#059669' : '#dc2626'};">
                                    ${esIngreso ? 'INGRESO' : 'GASTO'} #${g.id}
                                </span>
                                ${isAnulado 
                                    ? '<span class="badge bg-secondary-subtle text-secondary border rounded-pill">Anulado</span>'
                                    : `<span class="badge ${esIngreso ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} border rounded-pill">Activo</span>`
                                }
                            </div>
                            <h4 class="fw-bold mb-0 mt-1" style="font-size: 17px; color: #0f172a;">${escapeHtml(provNombre)}</h4>
                            ${provNit ? `<span class="text-muted" style="font-size: 12px;">NIT / CC: ${escapeHtml(provNit)}</span>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Banner de Monto -->
                <div class="p-3 rounded-3 mb-4 d-flex justify-content-between align-items-center" style="background: ${esIngreso ? 'linear-gradient(135deg, #ecfdf5, #f0fdf4)' : 'linear-gradient(135deg, #fef2f2, #fff1f2)'}; border: 1px solid ${esIngreso ? '#a7f3d0' : '#fecaca'};">
                    <div>
                        <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Monto Operativo</span>
                        <h2 class="fw-bold ${esIngreso ? 'text-success' : 'text-danger'} mb-0 tnum" style="letter-spacing: -0.5px;">
                            ${this.config.prefijoMonto}${formatMoney(g.monto)}
                        </h2>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-white text-dark border px-3 py-2 rounded-3 shadow-xs" style="font-size: 12px;">
                            <i class="bi bi-calendar3 me-1 ${esIngreso ? 'text-primary' : 'text-danger'}"></i> ${formatFecha(g.fecha)}
                        </span>
                    </div>
                </div>

                <!-- Línea de Tiempo de Trazabilidad -->
                <div class="mb-4">
                    <h6 class="fw-bold text-uppercase text-muted mb-3" style="font-size: 11px; letter-spacing: 0.5px;">
                        <i class="bi bi-signpost-split me-1 ${esIngreso ? 'text-primary' : 'text-danger'}"></i> Trazabilidad del Movimiento
                    </h6>
                    <div class="ps-2">
                        <!-- Hito 1: Registro -->
                        <div class="payment-timeline-item">
                            <div class="payment-timeline-dot ${esIngreso ? 'success' : ''}" style="${!esIngreso ? 'border-color: #dc2626;' : ''}">
                                <i class="bi bi-tag" style="font-size: 9px; color: ${esIngreso ? '#059669' : '#dc2626'};"></i>
                            </div>
                            <div class="fw-semibold text-dark" style="font-size: 13px;">Concepto y Clasificación</div>
                            <div class="text-muted" style="font-size: 12px; margin-top: 2px;">
                                Categoría: <strong>${escapeHtml(g.categoria || 'Sin categoría')}</strong>
                                ${g.referencia ? ` | Ref: <strong>${escapeHtml(g.referencia)}</strong>` : ''}
                            </div>
                        </div>

                        <!-- Hito 2: Cuenta Bancaria -->
                        <div class="payment-timeline-item">
                            <div class="payment-timeline-dot">
                                <i class="bi bi-bank" style="font-size: 9px; color: #2563eb;"></i>
                            </div>
                            <div class="fw-semibold text-dark" style="font-size: 13px;">${esIngreso ? 'Destino en Tesorería' : 'Origen del Desembolso'}</div>
                            <div class="text-muted" style="font-size: 12px; margin-top: 2px;">
                                Cuenta: <strong>${escapeHtml(ctaNombre)}</strong>
                            </div>
                        </div>

                        <!-- Hito 3: Conciliación -->
                        <div class="payment-timeline-item">
                            <div class="payment-timeline-dot ${isConciliado ? 'success' : 'warning'}">
                                <i class="bi bi-${isConciliado ? 'check-circle-fill' : 'clock'}" style="font-size: 9px; color: ${isConciliado ? '#059669' : '#d97706'};"></i>
                            </div>
                            <div class="fw-semibold text-dark" style="font-size: 13px;">Estado Bancario</div>
                            <div class="text-muted" style="font-size: 12px; margin-top: 2px;">
                                ${isConciliado 
                                    ? `<span class="text-success"><i class="bi bi-check-circle me-1"></i> Verificado y conciliado con el extracto bancario.</span>`
                                    : `<span class="text-warning-emphasis"><i class="bi bi-clock-history me-1"></i> Pendiente de conciliar en Tesorería > Bancos.</span>`
                                }
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Descripción Completa -->
                <div class="mb-4">
                    <h6 class="fw-bold text-uppercase text-muted mb-1" style="font-size: 11px; letter-spacing: 0.5px;">Descripción / Detalle</h6>
                    <div class="p-3 bg-light rounded-3 text-secondary" style="font-size: 12px; line-height: 1.5;">
                        ${g.observaciones ? escapeHtml(g.observaciones) : 'Sin notas u observaciones adicionales registradas.'}
                    </div>
                </div>
            `;

            // Configurar botones del drawer
            const btnDrawerEdit = element.querySelector('#btn-crud-drawer-editar');
            if (btnDrawerEdit) {
                if (isConciliado || isAnulado) {
                    btnDrawerEdit.style.display = 'none';
                } else {
                    btnDrawerEdit.style.display = 'inline-block';
                    btnDrawerEdit.onclick = () => {
                        this.cerrarDrawer();
                        this.iniciarEdicion(id, element);
                    };
                }
            }

            const btnDrawerAnular = element.querySelector('#btn-crud-drawer-anular');
            if (btnDrawerAnular) {
                if (isAnulado || isConciliado) {
                    btnDrawerAnular.style.display = 'none';
                } else {
                    btnDrawerAnular.style.display = 'inline-block';
                    btnDrawerAnular.onclick = async () => {
                        if (confirm('¿Está seguro de anular este registro? Esta acción revertirá el movimiento en bancos y contabilidad.')) {
                            try {
                                await this.anularTransaccionObj(id);
                                this.cerrarDrawer();
                                await this.refrescarVista(element);
                            } catch (err) {
                                alert("Error al anular: " + err.message);
                            }
                        }
                    };
                }
            }
        } catch (err) {
            console.error('Error cargando comprobante para drawer:', err);
            body.innerHTML = `<div class="p-4 text-center text-danger">Error al cargar datos del comprobante.</div>`;
        }
    }

    cerrarDrawer() {
        if (!this.element) return;
        const backdrop = this.element.querySelector('#crud-drawer-backdrop');
        const drawer = this.element.querySelector('#crud-drawer');
        if (backdrop) backdrop.classList.remove('show');
        if (drawer) drawer.classList.remove('show');
        this.activeDrawerId = null;
    }

    iniciarEdicion(id, element) {
        const registro = this.currentData.find(r => String(r.id) === String(id));
        if (!registro) return;

        this.editingId = id;
        this.isEditing = true;

        const cardForm = element.querySelector('#card-form-creacion');
        if (cardForm) {
            cardForm.style.display = 'block';
            cardForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        const tituloForm = element.querySelector('#titulo-form-creacion');
        if (tituloForm) tituloForm.textContent = `Editar Registro #${id}`;

        element.querySelector('#transaccion-fecha').value = registro.fecha;
        element.querySelector('#transaccion-categoria').value = registro.categoria || '';
        const inputMonto = element.querySelector('#transaccion-monto');
        inputMonto.value = String(registro.monto || 0);
        applyCurrencyFormatting(inputMonto);

        element.querySelector('#transaccion-cuenta-id').value = registro.cuenta_id || '';
        const cuenta = this.cuentasActivas.find(c => String(c.id) === String(registro.cuenta_id));
        element.querySelector('#transaccion-cuenta').value = cuenta ? `${cuenta.nombre} ${cuenta.numero && cuenta.numero !== '-' ? '('+cuenta.numero+')' : ''}` : '';

        element.querySelector('#select-proveedor-id').value = registro.contacto_id || '';
        const prov = this.proveedores.find(p => String(p.id) === String(registro.contacto_id));
        element.querySelector('#search-proveedor').value = prov ? prov.nombre : '';

        element.querySelector('#transaccion-referencia').value = registro.referencia || '';
        element.querySelector('#transaccion-descripcion').value = registro.observaciones || '';

        const btnGuardar = element.querySelector('#btn-guardar-transaccion');
        btnGuardar.innerHTML = '<i class="bi bi-save me-1"></i>Actualizar';
        element.querySelector('#btn-cancelar-edicion').classList.remove('d-none');
    }

    cancelarEdicion(element) {
        this.editingId = null;
        this.isEditing = false;
        element.querySelector(`#${this.config.formId}`).reset();
        element.querySelector('#transaccion-fecha').value = getLocalDate();
        element.querySelector('#transaccion-cuenta-id').value = '';
        element.querySelector('#select-proveedor-id').value = '';
        element.querySelector('#search-proveedor').value = '';
        element.querySelector('#transaccion-cuenta').value = '';

        const tituloForm = element.querySelector('#titulo-form-creacion');
        if (tituloForm) tituloForm.textContent = this.config.btnNuevoText;

        const btnGuardar = element.querySelector('#btn-guardar-transaccion');
        btnGuardar.innerHTML = '<i class="bi bi-check-circle me-1"></i>Registrar';
        element.querySelector('#btn-cancelar-edicion').classList.add('d-none');
    }

    async anularTransaccionObj(id) {
        const { data: row } = await supabase.from('pagos_ingresos').select('categoria, conciliacion_id').eq('id', id).single();
        if (row?.conciliacion_id || (this.concSet && this.concSet.has(parseInt(id, 10)))) {
            throw new Error("No se puede anular un movimiento conciliado con el banco. Primero elimine la conciliación en Tesorería.");
        }
        if (row?.categoria === 'Transferencia') {
            const { error } = await supabase.rpc('anular_transferencia_pareja', { p_id: id });
            if (error) throw error;
        } else {
            await anularTransaccion(id);
        }
    }

    async cargarDatosGrafico() {
        try {
            const now = new Date();
            const past30 = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

            const { data } = await supabase
                .from('pagos_ingresos')
                .select('id, fecha, monto, categoria, cuentas_bancarias(nombre), contactos(nombre)')
                .eq('tipo', this.config.tipoFiltroDb)
                .is('factura_id', null)
                .neq('estado', 'anulado')
                .gte('fecha', past30)
                .order('fecha', { ascending: true });

            const dailyMap = {};
            const categoryMap = {};
            const accountMap = {};
            const thirdPartyMap = {};

            (data || []).forEach(p => {
                const f = p.fecha || 'Sin fecha';
                const cat = p.categoria || 'Sin categoría';
                const cta = p.cuentas_bancarias?.nombre || 'Efectivo / Caja';
                const tercero = p.contactos?.nombre || 'General / Varios';
                const val = Number(p.monto) || 0;

                dailyMap[f] = (dailyMap[f] || 0) + val;
                categoryMap[cat] = (categoryMap[cat] || 0) + val;
                accountMap[cta] = (accountMap[cta] || 0) + val;
                thirdPartyMap[tercero] = (thirdPartyMap[tercero] || 0) + val;
            });

            const topThirdParty = Object.entries(thirdPartyMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([nombre, total]) => ({ nombre, total }));

            return {
                dailyLabels: Object.keys(dailyMap),
                dailyValues: Object.values(dailyMap),
                categoryLabels: Object.keys(categoryMap),
                categoryValues: Object.values(categoryMap),
                accountLabels: Object.keys(accountMap),
                accountValues: Object.values(accountMap),
                topThirdParty
            };
        } catch (e) {
            console.error('Error cargando analítica en CrudFinanciero:', e);
            return null;
        }
    }

    renderAnalyticsView(container, data) {
        if (!container || !data) return;

        const esIngreso = this.config.tipoFiltroDb === 'in';
        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        container.innerHTML = `
            <div class="row g-3 mb-4">
                <!-- Gráfico de Evolución Diaria -->
                <div class="col-12 col-lg-8">
                    <div class="payment-kpi-card h-100 p-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h6 class="fw-bold mb-0 text-dark">Evolución Diaria (Últimos 30 días)</h6>
                                <span class="text-muted" style="font-size: 12px;">Comportamiento de ${esIngreso ? 'ingresos' : 'gastos'} por día</span>
                            </div>
                            <span class="badge bg-light ${esIngreso ? 'text-primary' : 'text-danger'} border px-2 py-1" style="font-size: 11px;">
                                <i class="bi bi-graph-up me-1"></i> Histórico
                            </span>
                        </div>
                        <div style="height: 260px; position: relative;">
                            <canvas id="crudDailyChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Gráfico de Categorías Contables -->
                <div class="col-12 col-lg-4">
                    <div class="payment-kpi-card h-100 p-4">
                        <div class="mb-3">
                            <h6 class="fw-bold mb-0 text-dark">Distribución por Categoría</h6>
                            <span class="text-muted" style="font-size: 12px;">Participación de rubros</span>
                        </div>
                        <div style="height: 180px; position: relative;" class="d-flex justify-content-center">
                            <canvas id="crudCategoryChart"></canvas>
                        </div>
                        <div class="mt-3 border-top pt-2" style="font-size: 12px;">
                            ${data.categoryLabels.slice(0, 3).map((lbl, idx) => `
                                <div class="d-flex justify-content-between align-items-center py-1">
                                    <span class="text-muted text-truncate" style="max-width: 150px;">${escapeHtml(lbl)}</span>
                                    <span class="fw-bold text-dark tnum">${formatMoney(data.categoryValues[idx])}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Ranking Top 5 Terceros -->
                <div class="col-12">
                    <div class="payment-kpi-card p-4">
                        <h6 class="fw-bold mb-1 text-dark">Top 5 ${esIngreso ? 'Clientes' : 'Proveedores / Destinatarios'} (Últimos 30 días)</h6>
                        <span class="text-muted d-block mb-3" style="font-size: 12px;">Terceros con mayor volumen acumulado</span>
                        
                        <div class="row g-2">
                            ${data.topThirdParty.length > 0 ? data.topThirdParty.map((c, i) => `
                                <div class="col-12 col-sm-6 col-md-4 col-lg">
                                    <div class="p-3 bg-light rounded-3 border d-flex flex-column justify-content-between h-100">
                                        <div class="d-flex align-items-center gap-2 mb-2">
                                            <span class="badge ${esIngreso ? 'bg-primary' : 'bg-danger'} text-white rounded-circle" style="width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px;">${i + 1}</span>
                                            <span class="fw-bold text-dark text-truncate" style="font-size: 12px;" title="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</span>
                                        </div>
                                        <div class="fw-bold ${esIngreso ? 'text-success' : 'text-danger'} tnum" style="font-size: 14px;">${this.config.prefijoMonto}${formatMoney(c.total)}</div>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-muted p-2">Sin datos en el período.</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const initCharts = () => {
            if (typeof Chart === 'undefined') return;

            const ctxDaily = document.getElementById('crudDailyChart');
            if (ctxDaily) {
                if (window.myCrudDailyChart) window.myCrudDailyChart.destroy();
                window.myCrudDailyChart = new Chart(ctxDaily, {
                    type: 'bar',
                    data: {
                        labels: data.dailyLabels.map(l => l.substring(5)),
                        datasets: [{
                            label: esIngreso ? 'Ingreso ($)' : 'Gasto ($)',
                            data: data.dailyValues,
                            backgroundColor: esIngreso ? '#10b981' : '#ef4444',
                            borderRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { grid: { display: false } },
                            y: {
                                ticks: {
                                    callback: v => '$' + (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : (v / 1000).toFixed(0) + 'k')
                                }
                            }
                        }
                    }
                });
            }

            const ctxCategory = document.getElementById('crudCategoryChart');
            if (ctxCategory) {
                if (window.myCrudCategoryChart) window.myCrudCategoryChart.destroy();
                window.myCrudCategoryChart = new Chart(ctxCategory, {
                    type: 'doughnut',
                    data: {
                        labels: data.categoryLabels,
                        datasets: [{
                            data: data.categoryValues,
                            backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#dc2626', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        cutout: '65%'
                    }
                });
            }
        };

        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = initCharts;
            document.head.appendChild(script);
        } else {
            setTimeout(initCharts, 50);
        }
    }

    async exportarExcel() {
        const btnExport = this.element?.querySelector('#btn-export-excel');
        const originalHtml = btnExport ? btnExport.innerHTML : '';
        try {
            if (btnExport) {
                btnExport.disabled = true;
                btnExport.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Exportando...';
            }

            let query = supabase
                .from('pagos_ingresos')
                .select('*')
                .eq('tipo', this.config.tipoFiltroDb)
                .is('factura_id', null);

            if (this.selectedTab === 'anulados') {
                query = query.eq('estado', 'anulado');
            } else {
                query = query.neq('estado', 'anulado');
            }

            if (this.selectedCategory !== 'todas') {
                query = query.eq('categoria', this.selectedCategory);
            }

            if (this.selectedAccount !== 'todas') {
                query = query.eq('cuenta_id', parseInt(this.selectedAccount, 10));
            }

            query = query.order('fecha', { ascending: false }).order('id', { ascending: false });

            const { data: allRows, error: errAll } = await query;
            if (errAll) throw errAll;

            let items = allRows || [];

            // Filtro de conciliación si aplica
            if (this.selectedTab === 'pendientes' || this.selectedTab === 'conciliados') {
                const concSet = this.concSet || new Set();
                if (this.selectedTab === 'pendientes') {
                    items = items.filter(g => !Boolean(g.conciliacion_id || concSet.has(g.id)));
                } else if (this.selectedTab === 'conciliados') {
                    items = items.filter(g => Boolean(g.conciliacion_id || concSet.has(g.id)));
                }
            }

            // Filtro de búsqueda si aplica
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                items = items.filter(g => {
                    const prov = (this.proveedores || []).find(p => String(p.id) === String(g.contacto_id));
                    const provNombre = prov ? prov.nombre.toLowerCase() : '';
                    return String(g.observaciones || '').toLowerCase().includes(q) ||
                           String(g.categoria || '').toLowerCase().includes(q) ||
                           String(g.referencia || '').toLowerCase().includes(q) ||
                           String(g.monto || '').includes(q) ||
                           provNombre.includes(q);
                });
            }

            if (items.length === 0) {
                alert('No hay registros coincidentes para exportar.');
                return;
            }

            const esIngreso = this.config.tipoFiltroDb === 'in';
            const dataToExport = items.map(g => {
                const prov = (this.proveedores || []).find(p => String(p.id) === String(g.contacto_id));
                const cta = (this.cuentasActivas || []).find(c => String(c.id) === String(g.cuenta_id));
                return {
                    'ID': g.id,
                    'Fecha': g.fecha,
                    'Categoría': g.categoria || 'Sin Categoría',
                    'Descripción': g.observaciones || '-',
                    [esIngreso ? 'Cliente / Tercero' : 'Proveedor / Tercero']: prov ? prov.nombre : 'General / Sin tercero',
                    'NIT / CC': prov ? (prov.identificacion || prov.nit || '') : '',
                    'Cuenta Bancaria': cta ? cta.nombre : (g.cuenta_id || 'Caja / Efectivo'),
                    'Referencia': g.referencia || '-',
                    'Estado': g.estado === 'anulado' ? 'Anulado' : 'Activo',
                    'Monto': Number(g.monto) || 0
                };
            });

            const dateStr = new Date().toISOString().split('T')[0];
            const moduloName = esIngreso ? 'Ingresos_Operativos' : 'Gastos_Operativos';

            if (window.XLSX) {
                const ws = window.XLSX.utils.json_to_sheet(dataToExport);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, moduloName);
                window.XLSX.writeFile(wb, `${moduloName}_${dateStr}.xlsx`);
            } else {
                const headers = Object.keys(dataToExport[0]);
                let csv = headers.join(';') + '\r\n';
                dataToExport.forEach(row => {
                    csv += headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(';') + '\r\n';
                });
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${moduloName}_${dateStr}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error('Error exportando Excel:', e);
            alert('Error al exportar: ' + e.message);
        } finally {
            if (btnExport) {
                btnExport.disabled = false;
                btnExport.innerHTML = originalHtml || '<i class="bi bi-file-earmark-excel text-success me-1"></i> Exportar';
            }
        }
    }
}
