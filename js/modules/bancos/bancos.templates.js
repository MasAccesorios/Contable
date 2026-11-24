// js/modules/bancos/bancos.templates.js
// Capa de Presentación HTML y Componentes Gráficos (Homologado 100% con Gastos Operativos y crudFinanciero.js)

import { escapeHtml } from '../../shared/formatters.js';

export const TesoreriaTemplates = {
    formatMoney(val) {
        if (val === null || val === undefined || val === '') return '$ 0';
        const num = parseFloat(val) || 0;
        return '$ ' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

    formatFecha(str) {
        if (!str || str === '---' || str === 'N/A') return '---';
        const raw = String(str).split('T')[0];
        const partes = raw.split('-');
        return partes.length === 3 ? `${escapeHtml(partes[2])}/${escapeHtml(partes[1])}/${escapeHtml(partes[0])}` : escapeHtml(raw);
    },

    renderLayout(state = {}) {
        const kpis = state.kpis || {
            totalConsolidado: 0,
            totalBancos: 0,
            bancosCount: 0,
            totalCajas: 0,
            cajasCount: 0,
            movimientosPorConciliar: 0,
            tabCounts: { todas: 0, bancos: 0, cajas: 0, inactivas: 0 }
        };
        const counts = kpis.tabCounts || { todas: 0, bancos: 0, cajas: 0, inactivas: 0 };
        const currentTab = state.currentTab || 'todas';
        const currentView = state.currentView || 'lista';

        return `
            <div class="dash-layout p-4" style="max-width: 1240px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                
                <!-- TOP BAR DE ALTO IMPACTO (ESTILO GASTOS OPERATIVOS) -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <a href="#" onclick="event.preventDefault(); window.history.length > 2 ? window.history.back() : window.location.hash = '#/dashboard';" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body); border-radius: 8px;" title="Volver">
                                <i class="bi bi-arrow-left"></i>
                            </a>
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Bancos y Cajas</h2>
                            <span class="badge" style="background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #bfdbfe;">
                                <i class="bi bi-bank me-1"></i> Tesorería & Liquidez 360°
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Control unificado de saldos, cuentas de ahorros, corrientes, billeteras y flujo de efectivo.
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
                        <button id="btn-actualizar-bancos" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>

                        <!-- Botón Transferir -->
                        <button id="btn-transferir" class="btn btn-light bg-white border fw-semibold shadow-xs d-flex align-items-center px-3" style="font-size: 13px; border-radius: 8px; color: var(--text-body);">
                            <i class="bi bi-arrow-down-up me-2 text-primary"></i> Transferir
                        </button>

                        <!-- Botón Agregar Cuenta -->
                        <button id="btn-agregar-banco" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-plus-lg"></i> Agregar cuenta
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS (ESTILO GASTOS OPERATIVOS) -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Saldo Consolidado Total -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Saldo Consolidado</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-bank"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-saldo-total" style="font-size: 22px;">
                                ${this.formatMoney(kpis.totalConsolidado)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-bold px-2 py-0">En vivo</span> Liquidez neta total
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Cuentas Bancarias Activas -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Bancos Comerciales</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-credit-card"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" id="kpi-total-bancos" style="font-size: 22px;">
                                ${this.formatMoney(kpis.totalBancos)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;" id="kpi-bancos-activos-sub">
                                <strong>${kpis.bancosCount}</strong> cuentas bancarias activas
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Cajas y Efectivo -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Cajas & Efectivo</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-cash-stack"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="kpi-total-cajas" style="font-size: 22px;">
                                ${this.formatMoney(kpis.totalCajas)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;" id="kpi-cajas-activos-sub">
                                <strong>${kpis.cajasCount}</strong> cajas y billeteras activas
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Movimientos por Conciliar -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #d97706;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Por Conciliar</span>
                                <div class="payment-kpi-icon out-bg">
                                    <i class="bi bi-clock-history"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-warning-emphasis tnum" id="kpi-por-conciliar" style="font-size: 22px;">
                                ${kpis.movimientosPorConciliar}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Transacciones abiertas (desde ago 2026)
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR DE VISTA ANALÍTICA GRÁFICA -->
                <div id="bancos-analytics-container" style="display: ${currentView === 'grafico' ? 'block' : 'none'};">
                    <div class="row g-4 mb-4">
                        <!-- Gráfico 1: Evolución Ingresos y Gastos -->
                        <div class="col-12 col-lg-8">
                            <div class="card border-0 shadow-xs h-100 p-4" style="background: var(--surface); border: 1px solid var(--border-color); border-radius: 12px;">
                                <div class="d-flex justify-content-between align-items-center mb-4">
                                    <div>
                                        <h6 class="fw-bold mb-0 text-dark" style="font-size: 15px;">Flujo Histórico de Ingresos y Gastos</h6>
                                        <span class="text-muted" style="font-size: 12px;">Comportamiento consolidado del flujo de caja</span>
                                    </div>
                                    <div class="d-flex align-items-center gap-2">
                                        <label class="text-muted small fw-medium" style="font-size: 11px;">Rango:</label>
                                        <select id="select-chart-rango" class="form-select form-select-sm border text-muted fw-semibold" style="width: auto; border-radius: 6px; box-shadow: none; font-size: 12px;">
                                            <option value="1">1 mes</option>
                                            <option value="3">3 meses</option>
                                            <option value="6" selected>6 meses</option>
                                            <option value="12">12 meses</option>
                                        </select>
                                    </div>
                                </div>
                                <div style="height: 280px; position: relative;">
                                    <canvas id="chart-ingresos-gastos"></canvas>
                                </div>
                            </div>
                        </div>

                        <!-- Gráfico 2: Concentración de Liquidez (Doughnut) -->
                        <div class="col-12 col-lg-4">
                            <div class="card border-0 shadow-xs h-100 p-4" style="background: var(--surface); border: 1px solid var(--border-color); border-radius: 12px;">
                                <div class="mb-3">
                                    <h6 class="fw-bold mb-0 text-dark" style="font-size: 15px;">Concentración de Fondos</h6>
                                    <span class="text-muted" style="font-size: 12px;">Distribución de saldo por cuenta</span>
                                </div>
                                <div style="height: 220px; position: relative;" class="d-flex justify-content-center align-items-center">
                                    <canvas id="chart-donas-cuentas"></canvas>
                                </div>
                                <div class="mt-3 text-center border-top pt-2">
                                    <span class="text-muted" style="font-size: 11px;">
                                        Ratio Bancos / Efectivo: 
                                        <strong class="text-primary">${kpis.totalConsolidado > 0 ? Math.round((kpis.totalBancos / kpis.totalConsolidado) * 100) : 0}%</strong> / 
                                        <strong class="text-success">${kpis.totalConsolidado > 0 ? Math.round((kpis.totalCajas / kpis.totalConsolidado) * 100) : 0}%</strong>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR DE TABLA DE CUENTAS (VISTA PRINCIPAL) -->
                <div id="bancos-table-view-container" style="display: ${currentView !== 'grafico' ? 'block' : 'none'};">
                    <div class="dash-table-container mb-4 shadow-xs" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                        
                        <!-- FILTROS Y TABS SUPERIORES (ESTILO GASTOS OPERATIVOS) -->
                        <div class="p-3 border-bottom bg-white d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                            <!-- Tabs de Filtro Rápido -->
                            <div class="payment-tabs-bar">
                                <button type="button" class="payment-tab-btn ${currentTab === 'todas' ? 'active' : ''}" data-tab="todas">
                                    Todas <span class="payment-tab-badge" id="tab-count-todas">${counts.todas}</span>
                                </button>
                                <button type="button" class="payment-tab-btn ${currentTab === 'bancos' ? 'active' : ''}" data-tab="bancos">
                                    <i class="bi bi-bank me-1"></i> Bancos <span class="payment-tab-badge" id="tab-count-bancos">${counts.bancos}</span>
                                </button>
                                <button type="button" class="payment-tab-btn ${currentTab === 'cajas' ? 'active' : ''}" data-tab="cajas">
                                    <i class="bi bi-cash me-1"></i> Cajas / Efectivo <span class="payment-tab-badge" id="tab-count-cajas">${counts.cajas}</span>
                                </button>
                                <button type="button" class="payment-tab-btn ${currentTab === 'inactivas' ? 'active' : ''}" data-tab="inactivas">
                                    Inactivas <span class="payment-tab-badge" id="tab-count-inactivas">${counts.inactivas}</span>
                                </button>
                            </div>

                            <!-- Buscador Ergonómico -->
                            <div class="d-flex align-items-center gap-2">
                                <div class="ds-search-container" style="min-width: 260px;">
                                    <i class="bi bi-search ds-search-icon"></i>
                                    <input type="text" class="ds-search-input" id="search-bancos" autocomplete="off" placeholder="Buscar banco, tipo o cuenta..." value="${escapeHtml(state.searchQuery || '')}">
                                </div>
                            </div>
                        </div>

                        <!-- TABLA DE CUENTAS INTELIGENTES -->
                        <div class="table-responsive position-relative">
                            <table class="table table-borderless align-middle mb-0 w-100">
                                <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                    <tr>
                                        <th class="py-3 ps-4 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Entidad / Cuenta</th>
                                        <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Tipo</th>
                                        <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Número</th>
                                        <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Estado</th>
                                        <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Saldo Disponible</th>
                                        <th class="py-3 pe-4 text-end text-uppercase text-muted fw-bold" style="width: 140px;">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-bancos">
                                    <tr>
                                        <td colspan="6" class="text-center py-5 text-muted">
                                            <span class="spinner-border spinner-border-sm me-2"></span>Cargando cuentas bancarias...
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- PAGINADOR INTEGRADO -->
                        <div class="card-footer bg-white border-top p-3 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2" style="border-radius: 0 0 12px 12px;" id="bancos-pagination">
                        </div>
                    </div>
                </div>

                <!-- SLIDE-OVER DRAWER DE INSPECCIÓN 360° -->
                <div class="payment-drawer-backdrop" id="bancos-drawer-backdrop"></div>
                <div class="payment-drawer" id="bancos-drawer">
                    <div class="payment-drawer-header">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-bank text-primary fs-5"></i>
                            <h5 class="fw-bold mb-0" style="color: #0f172a; font-size: 16px;">Detalle 360° de la Cuenta</h5>
                        </div>
                        <button type="button" class="btn btn-sm btn-light border-0 text-muted" id="btn-bancos-drawer-close" title="Cerrar panel">
                            <i class="bi bi-x-lg fs-6"></i>
                        </button>
                    </div>
                    <div class="payment-drawer-body" id="bancos-drawer-body">
                        <!-- Contenido inyectado dinámicamente -->
                    </div>
                    <div class="payment-drawer-footer">
                        <button type="button" class="btn btn-light border btn-sm px-3 fw-medium" id="btn-bancos-drawer-close-bottom">
                            Cerrar
                        </button>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-outline-primary btn-sm px-3 fw-medium" id="btn-drawer-conciliar">
                                <i class="bi bi-patch-check me-1"></i> Conciliar
                            </button>
                            <button type="button" class="btn btn-primary btn-sm px-3 fw-medium" id="btn-drawer-ver-detalle">
                                <i class="bi bi-receipt-cutoff me-1"></i> Ver Movimientos
                            </button>
                        </div>
                    </div>
                </div>

                <!-- MODALES TRANSACCIONALES (PRESERVADOS 100%) -->
                <!-- MODAL TRANSFERIR -->
                <div class="modal fade" id="modal-transferir" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content border-0 shadow" style="border-radius: 12px;">
                            <div class="modal-header border-bottom-0 pb-0">
                                <h5 class="modal-title fw-bold" style="color: var(--text-main);">Transferir entre cuentas</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body p-4">
                                <form id="form-transferir">
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold">Cuenta origen *</label>
                                        <select class="form-select" id="transf-origen" required>
                                            <option value="" disabled selected>Selecciona el origen</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold">Cuenta destino *</label>
                                        <select class="form-select" id="transf-destino" required>
                                            <option value="" disabled selected>Selecciona el destino</option>
                                        </select>
                                    </div>
                                    <div class="row g-3 mb-3">
                                        <div class="col-6">
                                            <label class="form-label text-muted small fw-semibold">Monto *</label>
                                            <input type="text" class="form-control fw-bold fs-5" id="transf-monto" placeholder="$ 0" required>
                                        </div>
                                        <div class="col-6">
                                            <label class="form-label text-muted small fw-semibold">Fecha *</label>
                                            <input type="date" class="form-control" id="transf-fecha" required>
                                        </div>
                                    </div>
                                    <div class="mb-4">
                                        <label class="form-label text-muted small fw-semibold">Nota o referencia (Opcional)</label>
                                        <input type="text" class="form-control" id="transf-nota" placeholder="Ej. Traspaso de fondos para gastos">
                                    </div>
                                    <div class="d-flex gap-2 justify-content-end">
                                        <button type="button" class="btn btn-light border px-4" data-bs-dismiss="modal">Cancelar</button>
                                        <button type="submit" class="btn text-white px-4" style="background-color: var(--primary);" id="btn-confirmar-transf">Transferir</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- MODAL AGREGAR BANCO -->
                <div class="modal fade" id="modal-agregar-banco" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content border-0 shadow" style="border-radius: 12px;">
                            <div class="modal-header border-bottom-0 pb-0">
                                <h5 class="modal-title fw-bold" style="color: var(--text-main);">Agregar cuenta bancaria</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body p-4">
                                <form id="form-agregar-banco">
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold">Nombre *</label>
                                        <input type="text" class="form-control" id="banco-nombre" placeholder="Ej. Bancolombia Ahorros" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold">Tipo *</label>
                                        <input type="text" class="form-control" id="banco-tipo" placeholder="Ej. Banco, Efectivo, Nequi..." required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold">Número de cuenta (Opcional)</label>
                                        <input type="text" class="form-control" id="banco-numero-cuenta" placeholder="Ej. **** 1234">
                                    </div>
                                    <div class="mb-4">
                                        <label class="form-label text-muted small fw-semibold">Saldo inicial</label>
                                        <input type="text" class="form-control fw-bold fs-5" id="banco-saldo-inicial" placeholder="$ 0">
                                    </div>
                                    <div class="d-flex gap-2 justify-content-end">
                                        <button type="button" class="btn btn-light border px-4" data-bs-dismiss="modal">Cancelar</button>
                                        <button type="submit" class="btn text-white px-4" style="background-color: var(--primary);" id="btn-confirmar-agregar-banco">Guardar</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- MODAL EDITAR BANCO -->
                <div class="modal fade" id="modal-editar-banco" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content border-0 shadow" style="border-radius: 12px;">
                            <div class="modal-header border-bottom-0 pb-0">
                                <h5 class="modal-title fw-bold" style="color: var(--text-main);">Editar cuenta bancaria</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body p-4">
                                <form id="form-editar-banco">
                                    <input type="hidden" id="banco-edit-id">
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold">Nombre *</label>
                                        <input type="text" class="form-control" id="banco-edit-nombre" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold">Tipo *</label>
                                        <input type="text" class="form-control" id="banco-edit-tipo" placeholder="Ej. Banco, Efectivo, Nequi..." required>
                                    </div>
                                    <div class="mb-4">
                                        <label class="form-label text-muted small fw-semibold">Número de cuenta (Opcional)</label>
                                        <input type="text" class="form-control" id="banco-edit-numero-cuenta" placeholder="Ej. **** 1234">
                                    </div>
                                    <div class="d-flex gap-2 justify-content-end">
                                        <button type="button" class="btn btn-light border px-4" data-bs-dismiss="modal">Cancelar</button>
                                        <button type="submit" class="btn text-white px-4" style="background-color: var(--primary);" id="btn-confirmar-editar-banco">Guardar cambios</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderResumen() {
        const kpis = this.state.kpis || {
            totalConsolidado: 0,
            totalBancos: 0,
            bancosCount: 0,
            totalCajas: 0,
            cajasCount: 0,
            movimientosPorConciliar: 0,
            tabCounts: { todas: 0, bancos: 0, cajas: 0, inactivas: 0 }
        };

        const elSaldoTotal = this.element?.querySelector('#kpi-saldo-total');
        const elTotalBancos = this.element?.querySelector('#kpi-total-bancos');
        const elBancosSub = this.element?.querySelector('#kpi-bancos-activos-sub');
        const elTotalCajas = this.element?.querySelector('#kpi-total-cajas');
        const elCajasSub = this.element?.querySelector('#kpi-cajas-activos-sub');
        const elPorConciliar = this.element?.querySelector('#kpi-por-conciliar');

        if (elSaldoTotal) elSaldoTotal.textContent = this.formatMoney(kpis.totalConsolidado);
        if (elTotalBancos) elTotalBancos.textContent = this.formatMoney(kpis.totalBancos);
        if (elBancosSub) elBancosSub.innerHTML = `<strong>${kpis.bancosCount}</strong> cuentas bancarias activas`;
        if (elTotalCajas) elTotalCajas.textContent = this.formatMoney(kpis.totalCajas);
        if (elCajasSub) elCajasSub.innerHTML = `<strong>${kpis.cajasCount}</strong> cajas y billeteras activas`;
        if (elPorConciliar) elPorConciliar.textContent = String(kpis.movimientosPorConciliar);

        // Actualizar badges de tabs
        const counts = kpis.tabCounts || {};
        const tabTodas = this.element?.querySelector('#tab-count-todas');
        const tabBancos = this.element?.querySelector('#tab-count-bancos');
        const tabCajas = this.element?.querySelector('#tab-count-cajas');
        const tabInactivas = this.element?.querySelector('#tab-count-inactivas');

        if (tabTodas) tabTodas.textContent = counts.todas || 0;
        if (tabBancos) tabBancos.textContent = counts.bancos || 0;
        if (tabCajas) tabCajas.textContent = counts.cajas || 0;
        if (tabInactivas) tabInactivas.textContent = counts.inactivas || 0;
    },

    renderTabla(searchQuery = '') {
        const container = this.element?.querySelector('#tbody-bancos');
        const pagContainer = this.element?.querySelector('#bancos-pagination');
        if (!container) return;

        const query = searchQuery !== '' ? searchQuery : (this.state.searchQuery || '');
        const currentTab = this.state.currentTab || 'todas';

        const cuentasFiltradas = this.filtrarCuentas(
            this.state.todasLasCuentas || [],
            currentTab,
            query,
            this.state.saldos || {}
        );

        const totalItems = cuentasFiltradas.length;
        const itemsPerPage = this.state.itemsPerPage || 10;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

        if (this.state.currentPage > totalPages) this.state.currentPage = totalPages;
        if (this.state.currentPage < 1) this.state.currentPage = 1;

        const from = (this.state.currentPage - 1) * itemsPerPage;
        const dataPaginada = cuentasFiltradas.slice(from, from + itemsPerPage);

        if (dataPaginada.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-5">
                        <div class="mb-3"><i class="bi bi-inbox fs-1 text-secondary opacity-50"></i></div>
                        <h6 class="fw-semibold text-dark">No se encontraron cuentas</h6>
                        <p class="text-muted mb-0" style="font-size: 13px;">Prueba ajustando los filtros o registra una nueva cuenta.</p>
                    </td>
                </tr>
            `;
            if (pagContainer) pagContainer.innerHTML = '';
            return;
        }

        container.innerHTML = dataPaginada.map(c => {
            const saldo = Number(
                this.state.saldos[c.id] !== undefined 
                    ? this.state.saldos[c.id] 
                    : (this.state.saldos[c.nombre] !== undefined 
                        ? this.state.saldos[c.nombre] 
                        : (c.saldo_inicial || 0))
            );
            const tipoLower = String(c.tipo || '').toLowerCase().trim();
            const nombreLower = String(c.nombre || '').toLowerCase();
            const isEfectivo = tipoLower === 'caja' || tipoLower === 'efectivo' || nombreLower.includes('caja') || nombreLower.includes('efectivo');
            const isInactive = c.estado === 'inactivo' || c.estado === 'inactive';
            const isActivo = !isInactive;
            const avatar = this.getBankAvatar(c);

            const badgeEstado = isActivo 
                ? '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;">Activa</span>' 
                : '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 3px 8px;">Inactiva</span>';

            const tipoBadgeClass = isEfectivo ? 'bg-success-subtle text-success border-success-subtle' : 'bg-primary-subtle text-primary border-primary-subtle';
            const actionBtnIcon = isActivo ? 'bi-pause-circle' : 'bi-play-circle';
            const actionBtnColor = isActivo ? 'text-danger' : 'text-success';
            const actionBtnTitle = isActivo ? 'Desactivar cuenta' : 'Activar cuenta';

            return `
                <tr class="payment-row banco-row" data-id="${c.id}" style="cursor: pointer;">
                    <!-- Columna 1: Entidad / Cuenta con Avatar Institucional -->
                    <td class="py-3 ps-4">
                        <div class="d-flex align-items-center gap-3">
                            <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color};">
                                ${escapeHtml(avatar.initials)}
                            </div>
                            <div class="text-truncate" style="max-width: 280px;">
                                <div class="fw-bold text-dark text-truncate" style="font-size: 13.5px;" title="${escapeHtml(c.nombre)}">
                                    ${escapeHtml(c.nombre)}
                                </div>
                                <div class="text-muted d-flex align-items-center gap-1" style="font-size: 11.5px;">
                                    <i class="bi ${avatar.icon} text-secondary"></i> ${escapeHtml(avatar.brand)}
                                </div>
                            </div>
                        </div>
                    </td>

                    <!-- Columna 2: Tipo -->
                    <td class="py-3">
                        <span class="badge ${tipoBadgeClass} border rounded-pill fw-medium" style="font-size: 11px; padding: 4px 9px;">
                            ${escapeHtml(c.tipo || 'Banco')}
                        </span>
                    </td>

                    <!-- Columna 3: Número de Cuenta -->
                    <td class="py-3">
                        <span class="payment-code-badge">
                            ${escapeHtml(c.numero || '---')}
                        </span>
                    </td>

                    <!-- Columna 4: Estado -->
                    <td class="py-3 text-center">
                        ${badgeEstado}
                    </td>

                    <!-- Columna 5: Saldo Disponible -->
                    <td class="py-3 text-end">
                        <div class="fw-bold tnum ${saldo >= 0 ? 'text-dark' : 'text-danger'}" style="font-size: 15px;">
                            ${this.formatMoney(saldo)}
                        </div>
                    </td>

                    <!-- Columna 6: Acciones Rápidas -->
                    <td class="py-3 pe-4 text-end">
                        <div class="payment-row-actions">
                            <button class="btn btn-sm btn-light border-0 p-1 btn-quick-inspect-banco" data-id="${c.id}" title="Inspección 360°">
                                <i class="bi bi-eye text-primary fs-6"></i>
                            </button>
                            <button class="btn btn-sm btn-light border px-2 py-1 text-muted btn-conciliar-directo" data-id="${c.id}" title="Ir a Conciliación" style="font-size: 11.5px; border-radius: 6px;">
                                <i class="bi bi-patch-check text-success me-1"></i> Conciliar
                            </button>
                            <div class="dropdown d-inline-block">
                                <button class="btn btn-sm btn-link text-muted p-1 border-0" data-bs-toggle="dropdown" aria-expanded="false" title="Más opciones">
                                    <i class="bi bi-three-dots-vertical"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end shadow border" style="font-size: 13px; border-radius: 8px;">
                                    <li><a class="dropdown-item py-2 d-flex align-items-center gap-2 btn-menu-inspect-banco" href="javascript:void(0)" data-id="${c.id}"><i class="bi bi-layout-sidebar-inset-reverse text-primary"></i> Inspección 360°</a></li>
                                    <li><a class="dropdown-item py-2 d-flex align-items-center gap-2" href="#/bancos/detalle?banco_id=${c.id}"><i class="bi bi-receipt text-secondary"></i> Ver Historial Completo</a></li>
                                    <li><a class="dropdown-item py-2 d-flex align-items-center gap-2 btn-editar-cuenta" href="javascript:void(0)" data-id="${c.id}" data-nombre="${escapeHtml(c.nombre)}" data-tipo="${c.tipo}" data-numero="${c.numero || ''}"><i class="bi bi-pencil text-secondary"></i> Editar</a></li>
                                    <li><hr class="dropdown-divider my-1"></li>
                                    <li><a class="dropdown-item py-2 d-flex align-items-center gap-2 ${actionBtnColor} btn-toggle-estado" href="javascript:void(0)" data-id="${c.id}" data-estado="${escapeHtml(c.estado || 'activo')}"><i class="bi ${actionBtnIcon}"></i> ${actionBtnTitle}</a></li>
                                </ul>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Render Paginación
        const fromItem = totalItems > 0 ? from + 1 : 0;
        const toItem = Math.min(from + itemsPerPage, totalItems);

        if (pagContainer) {
            pagContainer.innerHTML = `
                <div class="d-flex align-items-center gap-3" style="font-size: 13px; color: var(--text-body);">
                    <div class="d-flex align-items-center gap-2">
                        <span>Mostrar:</span>
                        <select class="form-select form-select-sm text-muted select-per-page" style="width: 70px; height: 32px; border-radius: 6px;">
                            <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10</option>
                            <option value="20" ${itemsPerPage === 20 ? 'selected' : ''}>20</option>
                            <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                        </select>
                    </div>
                    <span class="text-muted border-start ps-3">
                        ${totalItems > 0 ? `<strong>${fromItem} - ${toItem}</strong> de <strong>${totalItems}</strong> cuentas` : '0 cuentas'}
                    </span>
                </div>

                <div class="d-flex align-items-center gap-2" style="font-size: 13px;">
                    <button class="btn btn-sm btn-light border btn-prev-page" ${this.state.currentPage <= 1 ? 'disabled' : ''} style="border-radius: 6px;">
                        <i class="bi bi-chevron-left me-1"></i> Anterior
                    </button>
                    <span class="px-2 text-muted">
                        Página <strong>${this.state.currentPage}</strong> de <strong>${totalPages}</strong>
                    </span>
                    <button class="btn btn-sm btn-light border btn-next-page" ${this.state.currentPage >= totalPages ? 'disabled' : ''} style="border-radius: 6px;">
                        Siguiente <i class="bi bi-chevron-right ms-1"></i>
                    </button>
                </div>
            `;
        }
    },

    renderDrawerContent(cuenta, movimientos = []) {
        if (!cuenta) return '<div class="text-center text-muted py-5">No se encontró la cuenta.</div>';

        const saldo = Number(
            this.state.saldos[cuenta.id] !== undefined 
                ? this.state.saldos[cuenta.id] 
                : (this.state.saldos[cuenta.nombre] !== undefined 
                    ? this.state.saldos[cuenta.nombre] 
                    : (cuenta.saldo_inicial || 0))
        );
        const avatar = this.getBankAvatar(cuenta);
        const tipoLower = String(cuenta.tipo || '').toLowerCase().trim();
        const nombreLower = String(cuenta.nombre || '').toLowerCase();
        const isEfectivo = tipoLower === 'caja' || tipoLower === 'efectivo' || nombreLower.includes('caja') || nombreLower.includes('efectivo');

        let movsHtml = '';
        if (!movimientos || movimientos.length === 0) {
            movsHtml = `
                <div class="text-center text-muted py-4 border rounded-3 bg-light bg-opacity-50">
                    <i class="bi bi-clock-history fs-3 text-secondary opacity-50"></i>
                    <p class="small mb-0 mt-1">Sin movimientos recientes registrados</p>
                </div>
            `;
        } else {
            movsHtml = movimientos.map(m => {
                const isIngreso = m.tipo === 'in' || m.tipo === 'ingreso';
                const montoStr = (isIngreso ? '+' : '-') + this.formatMoney(m.monto);
                const colorClass = isIngreso ? 'text-success' : 'text-danger';

                return `
                    <div class="d-flex align-items-center justify-content-between p-2 mb-2 border rounded-3 bg-white shadow-xs">
                        <div class="d-flex align-items-center gap-2 text-truncate" style="max-width: 280px;">
                            <div class="payment-avatar" style="width: 30px; height: 30px; font-size: 11px; background-color: ${isIngreso ? '#ecfdf5' : '#fef2f2'}; color: ${isIngreso ? '#059669' : '#dc2626'};">
                                <i class="bi ${isIngreso ? 'bi-arrow-down-left' : 'bi-arrow-up-right'}"></i>
                            </div>
                            <div class="text-truncate">
                                <div class="fw-semibold text-dark text-truncate" style="font-size: 12.5px;">
                                    ${escapeHtml(m.observaciones || m.categoria || 'Movimiento')}
                                </div>
                                <div class="text-muted" style="font-size: 11px;">
                                    ${this.formatFecha(m.fecha)} ${m.tercero_nombre ? '· ' + escapeHtml(m.tercero_nombre) : ''}
                                </div>
                            </div>
                        </div>
                        <div class="text-end">
                            <span class="fw-bold tnum ${colorClass}" style="font-size: 13px;">
                                ${montoStr}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="mb-4">
                <!-- Tarjeta Principal de Cuenta -->
                <div class="p-3 border rounded-3 mb-3" style="background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); border-color: #dbeafe !important;">
                    <div class="d-flex align-items-center gap-3 mb-3">
                        <div class="payment-avatar" style="width: 44px; height: 44px; font-size: 16px; background-color: ${avatar.bg}; color: ${avatar.color};">
                            ${escapeHtml(avatar.initials)}
                        </div>
                        <div>
                            <h5 class="fw-bold text-dark mb-0" style="font-size: 16px;">${escapeHtml(cuenta.nombre)}</h5>
                            <span class="badge ${isEfectivo ? 'bg-success-subtle text-success' : 'bg-primary-subtle text-primary'} border rounded-pill mt-1" style="font-size: 11px;">
                                ${escapeHtml(cuenta.tipo || 'Banco')} ${cuenta.numero ? '· ' + escapeHtml(cuenta.numero) : ''}
                            </span>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-baseline pt-2 border-top">
                        <span class="text-muted small fw-medium">Saldo Actual:</span>
                        <h3 class="fw-bold tnum mb-0 ${saldo >= 0 ? 'text-primary' : 'text-danger'}" style="font-size: 24px;">
                            ${this.formatMoney(saldo)}
                        </h3>
                    </div>
                </div>

                <!-- Últimos 5 Movimientos -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Últimos Movimientos</span>
                    <a href="#/bancos/detalle?banco_id=${encodeURIComponent(cuenta.id)}" class="small text-primary text-decoration-none fw-semibold" style="font-size: 12px;">Ver todos</a>
                </div>
                <div class="movement-list">
                    ${movsHtml}
                </div>
            </div>
        `;
    },

    renderChart(meses = 6) {
        const canvas = document.getElementById('chart-ingresos-gastos');
        const canvasDonas = document.getElementById('chart-donas-cuentas');
        if (!canvas) return;

        // Limpiar instancia previa
        if (this.state.chartInstance) {
            this.state.chartInstance.destroy();
            this.state.chartInstance = null;
        }
        if (this.state.donutInstance) {
            this.state.donutInstance.destroy();
            this.state.donutInstance = null;
        }

        // 1. Gráfico de Barras Ingresos vs Gastos
        const datos = this.state.datosGrafica || [];
        const labels = datos.map(m => m.mes);
        const dataIngresos = datos.map(m => m.ingresos || 0);
        const dataGastos = datos.map(m => m.egresos || 0);

        const ctx = canvas.getContext('2d');
        this.state.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: dataIngresos,
                        backgroundColor: '#10b981', // Verde Esmeralda
                        borderRadius: 6,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    },
                    {
                        label: 'Gastos',
                        data: dataGastos,
                        backgroundColor: '#ef4444', // Rojo Vivo
                        borderRadius: 6,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 15,
                            font: { size: 12, family: "'Inter', sans-serif" }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += '$ ' + Number(context.parsed.y).toLocaleString('es-CO');
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false,
                            borderDash: [5, 5]
                        },
                        ticks: {
                            font: { size: 11 },
                            callback: function(value) {
                                if (value >= 1000000) return '$' + (value / 1000000).toFixed(0) + 'M';
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
        window.currentChartInstance = this.state.chartInstance;

        // 2. Gráfico Donut de Concentración de Saldo por Cuenta
        if (canvasDonas) {
            const ctxDonut = canvasDonas.getContext('2d');
            const cuentasActivas = (this.state.todasLasCuentas || []).filter(c => c.estado !== 'inactivo' && c.estado !== 'inactive');
            const topCuentas = cuentasActivas
                .map(c => ({
                    nombre: c.nombre,
                    saldo: Math.max(0, Number(
                        this.state.saldos[c.id] !== undefined 
                            ? this.state.saldos[c.id] 
                            : (this.state.saldos[c.nombre] !== undefined 
                                ? this.state.saldos[c.nombre] 
                                : (c.saldo_inicial || 0))
                    ))
                }))
                .filter(c => c.saldo > 0)
                .sort((a, b) => b.saldo - a.saldo)
                .slice(0, 5);

            const donutLabels = topCuentas.map(c => c.nombre);
            const donutData = topCuentas.map(c => c.saldo);
            const donutColors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

            this.state.donutInstance = new Chart(ctxDonut, {
                type: 'doughnut',
                data: {
                    labels: donutLabels.length > 0 ? donutLabels : ['Sin saldos'],
                    datasets: [{
                        data: donutData.length > 0 ? donutData : [1],
                        backgroundColor: donutData.length > 0 ? donutColors.slice(0, donutData.length) : ['#e2e8f0'],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const val = context.raw || 0;
                                    return context.label + ': $ ' + Number(val).toLocaleString('es-CO');
                                }
                            }
                        }
                    },
                    cutout: '70%'
                }
            });
            window.myCrudDonutChart = this.state.donutInstance;
        }
    }
};
