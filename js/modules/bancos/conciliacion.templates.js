// js/modules/bancos/conciliacion.templates.js
// Capa de Presentación HTML y Componentes Ergonómicos de Conciliación Bancaria 360°

import { escapeHtml } from '../../shared/formatters.js';

export const ConciliacionTemplates = {
    formatMoney(val) {
        if (val === null || val === undefined || val === '') return '$ 0';
        const num = parseFloat(val) || 0;
        return '$ ' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

    formatFecha(str) {
        if (!str || str === '---' || str === 'N/A') return '---';
        const raw = String(str).split('T')[0].trim();
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
            const partes = raw.split('-');
            return `${escapeHtml(partes[2])}/${escapeHtml(partes[1])}/${escapeHtml(partes[0])}`;
        }
        return escapeHtml(raw);
    },

    calcularTotales() {
        if (!this.state.bancoId) return;
        const { saldoAnterior, entradas, salidas } = this.state;
        
        const elSaldoAnterior = this.element?.querySelector('#concil-saldo-anterior');
        if (elSaldoAnterior) elSaldoAnterior.textContent = this.formatMoney(saldoAnterior);

        this.state.saldoTotalSistema = Number(saldoAnterior) + Number(entradas) - Number(salidas);
        
        const elSaldoTotal = this.element?.querySelector('#concil-saldo-total');
        if (elSaldoTotal) elSaldoTotal.textContent = this.formatMoney(this.state.saldoTotalSistema);

        this.recalcularDiferenciaPendiente();
    },

    recalcularDiferenciaPendiente() {
        const difEl = this.element?.querySelector('#concil-diferencia');
        const badgeEl = this.element?.querySelector('#concil-semaforo-badge');
        const cardKpiEl = this.element?.querySelector('#kpi-card-diferencia');
        const iconEl = this.element?.querySelector('#icon-semaforo-diferencia');
        const infoMarcadosEl = this.element?.querySelector('#concil-marcados-info');

        const calculo = this.calcularDiferencia({
            saldoAnterior: this.state.saldoAnterior || 0,
            saldoSistema: this.state.saldoTotalSistema || 0,
            saldoBancario: this.state.saldoBancario || 0,
            movimientos: this.state.movimientosRango || [],
            seleccionados: this.state._seleccionados || new Set(),
            ajustes: {
                gastos: this.state.ajusteGastos || 0,
                impuestos: this.state.ajusteImpuestos || 0,
                entradas: this.state.ajusteEntradas || 0
            }
        });

        this.state.diferenciaActual = calculo.diferencia;
        this.state.estadoSemaforo = calculo.estadoSemaforo;

        if (difEl) {
            difEl.textContent = this.formatMoney(calculo.diferencia);
        }

        if (infoMarcadosEl) {
            infoMarcadosEl.innerHTML = `<strong>${calculo.countMarcados}</strong> de <strong>${calculo.totalMovimientos}</strong> transacciones marcadas (${this.formatMoney(calculo.sumaMarcados)})`;
        }

        // Semáforo Trimodal de Cuadre
        if (calculo.estadoSemaforo === 'cuadrado') {
            if (difEl) difEl.style.color = '#059669';
            if (cardKpiEl) cardKpiEl.style.borderLeft = '4px solid #10b981';
            if (iconEl) iconEl.className = 'payment-kpi-icon in-bg';
            if (badgeEl) {
                badgeEl.className = 'badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-bold px-2 py-1';
                badgeEl.innerHTML = '<i class="bi bi-patch-check-fill me-1"></i> Cuadrado Exacto ($0)';
            }
        } else if (calculo.estadoSemaforo === 'tolerancia') {
            if (difEl) difEl.style.color = '#d97706';
            if (cardKpiEl) cardKpiEl.style.borderLeft = '4px solid #f59e0b';
            if (iconEl) iconEl.className = 'payment-kpi-icon pending-bg';
            if (badgeEl) {
                badgeEl.className = 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill fw-bold px-2 py-1';
                badgeEl.innerHTML = '<i class="bi bi-exclamation-circle-fill me-1"></i> Ajuste Menor (< $100)';
            }
        } else {
            if (difEl) difEl.style.color = '#dc2626';
            if (cardKpiEl) cardKpiEl.style.borderLeft = '4px solid #ef4444';
            if (iconEl) iconEl.className = 'payment-kpi-icon out-bg';
            if (badgeEl) {
                badgeEl.className = 'badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill fw-bold px-2 py-1';
                badgeEl.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i> Descuadre Activo';
            }
        }
    },

    renderBase() {
        const currentBancoId = this.state.bancoId ? parseInt(this.state.bancoId, 10) : null;
        const cuentaActual = (this.state.cuentas || []).find(c => parseInt(c.id, 10) === currentBancoId) || this.state.cuentas?.[0] || {};
        const avatar = this.getBankAvatar(cuentaActual);

        const opcionesCuentas = (this.state.cuentas || []).map(c => {
            const safeId = parseInt(c.id, 10);
            return `<option value="${safeId}" ${safeId === currentBancoId ? 'selected' : ''}>${escapeHtml(c.nombre)} ${c.numero && c.numero !== '-' ? '(' + escapeHtml(c.numero) + ')' : ''}</option>`;
        }).join('');

        const cantHistorial = (this.state.historialConciliaciones || []).length;
        const currentTab = this.state.currentTab || 'nueva';

        const html = `
            <div class="dash-layout p-4" style="max-width: 1240px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                
                <!-- TOP BAR DE ALTO IMPACTO (ESTILO GASTOS OPERATIVOS) -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <a href="#/bancos" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body); border-radius: 8px;" title="Volver a Bancos">
                                <i class="bi bi-arrow-left"></i>
                            </a>
                            <h2 class="page-title mb-0" style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Conciliación Bancaria</h2>
                            <span class="badge" style="background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; border-radius: 9999px; padding: 4px 10px; border: 1px solid #bfdbfe;">
                                <i class="bi bi-patch-check me-1"></i> Auditoría & Cuadre 360°
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px; margin-top: 3px;">
                            Compara tus extractos oficiales con los movimientos registrados en libros y garantiza el cuadre al centavo.
                        </p>
                    </div>

                    <!-- SELECTOR DE CUENTA Y ACCIONES SUPERIORES -->
                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Selector de Cuenta Bancaria con Avatar -->
                        <div class="d-flex align-items-center gap-2 bg-white border p-1 ps-2 pe-3 rounded-3 shadow-xs">
                            <div class="payment-avatar" style="width: 28px; height: 28px; font-size: 11px; background-color: ${avatar.bg}; color: ${avatar.color};">
                                ${escapeHtml(avatar.initials)}
                            </div>
                            <select id="concil-cuenta" class="form-select form-select-sm border-0 bg-transparent fw-bold text-dark shadow-none p-0" style="font-size: 13px; min-width: 200px; cursor: pointer;">
                                ${opcionesCuentas}
                            </select>
                        </div>

                        <!-- Botón Refrescar -->
                        <button id="btn-refresh-concil" class="btn btn-light bg-white border text-secondary shadow-xs" style="border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>

                        <!-- Botón Guardar Conciliación -->
                        <button id="btn-guardar-concil" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-check2-circle"></i> Guardar Conciliación
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS (ESTILO GASTOS OPERATIVOS) -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Saldo Anterior -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Saldo Anterior</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-hourglass-split"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="concil-saldo-anterior" style="font-size: 22px;">
                                ${this.formatMoney(this.state.saldoAnterior)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Cierre del periodo anterior en libros
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Saldo Bancario (Extracto) Editable -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #2563eb;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Saldo Extracto (Banco)</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-bank"></i>
                                </div>
                            </div>
                            <div class="input-group input-group-sm mt-1">
                                <span class="input-group-text bg-light border fw-bold text-muted">$</span>
                                <input type="text" id="concil-input-saldo" class="form-control fw-bold fs-5 text-dark tnum" style="border-radius: 0 8px 8px 0; height: 38px;" placeholder="0" value="${this.formatMoney(this.state.saldoBancario).replace('$ ', '')}">
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Digita el saldo final de tu extracto
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Saldo en Sistema (Libros) -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Saldo en Sistema</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-book"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" id="concil-saldo-total" style="font-size: 22px;">
                                ${this.formatMoney(this.state.saldoTotalSistema)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Saldo anterior + entradas - salidas
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Semáforo de Diferencia Contable -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" id="kpi-card-diferencia" style="border-left: 4px solid #10b981;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Diferencia Contable</span>
                                <div class="payment-kpi-icon in-bg" id="icon-semaforo-diferencia">
                                    <i class="bi bi-check2-circle"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold tnum" id="concil-diferencia" style="font-size: 22px; color: #059669;">
                                $ 0
                            </div>
                            <div class="mt-2" id="concil-semaforo-container">
                                <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-bold px-2 py-1" id="concil-semaforo-badge">
                                    <i class="bi bi-patch-check-fill me-1"></i> Cuadrado Exacto ($0)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- PANEL ERGONÓMICO DE AJUSTES DEL EXTRACTO (ACORDEÓN DESPLEGABLE) -->
                <div class="card border rounded-3 shadow-xs mb-4" style="background: #ffffff; border-color: var(--border-color);">
                    <div class="card-header bg-white p-3 d-flex justify-content-between align-items-center" style="cursor: pointer;" id="header-panel-ajustes">
                        <div class="d-flex align-items-center gap-2">
                            <div class="payment-kpi-icon pending-bg" style="width: 32px; height: 32px; font-size: 15px;">
                                <i class="bi bi-sliders2"></i>
                            </div>
                            <div>
                                <h6 class="fw-bold mb-0 text-dark" style="font-size: 14px;">Ajustes Directos de Extracto</h6>
                                <span class="text-muted" style="font-size: 11.5px;">Comisiones bancarias, 4x1000/GMF o rendimientos no contabilizados aún</span>
                            </div>
                        </div>
                        <button type="button" class="btn btn-sm btn-light border-0 text-muted" id="btn-toggle-ajustes">
                            <i class="bi bi-chevron-down" id="icon-toggle-ajustes"></i>
                        </button>
                    </div>
                    <div class="card-body p-4 border-top" id="body-panel-ajustes">
                        <div class="row g-3">
                            <div class="col-12 col-md-4">
                                <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Gastos / Comisiones Bancarias (-)</label>
                                <div class="input-group input-group-sm">
                                    <span class="input-group-text bg-light text-muted">$</span>
                                    <input type="text" id="concil-ajuste-gastos" class="form-control form-control-sm text-dark fw-semibold tnum" placeholder="0" value="${this.state.ajusteGastos || 0}" style="border-radius: 0 8px 8px 0; height: 38px;">
                                </div>
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Impuestos Bancarios (4x1000 / GMF) (-)</label>
                                <div class="input-group input-group-sm">
                                    <span class="input-group-text bg-light text-muted">$</span>
                                    <input type="text" id="concil-ajuste-impuestos" class="form-control form-control-sm text-dark fw-semibold tnum" placeholder="0" value="${this.state.ajusteImpuestos || 0}" style="border-radius: 0 8px 8px 0; height: 38px;">
                                </div>
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Entradas / Rendimientos Financieros (+)</label>
                                <div class="input-group input-group-sm">
                                    <span class="input-group-text bg-light text-muted">$</span>
                                    <input type="text" id="concil-ajuste-entradas" class="form-control form-control-sm text-dark fw-semibold tnum" placeholder="0" value="${this.state.ajusteEntradas || 0}" style="border-radius: 0 8px 8px 0; height: 38px;">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TABS DE NAVEGACIÓN PRINCIPAL (NUEVA CONCILIACIÓN VS HISTORIAL) -->
                <div class="dash-table-container mb-4 shadow-xs" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                    
                    <!-- ENCABEZADO CON TABS Y FILTROS -->
                    <div class="p-3 border-bottom bg-white d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                        <!-- Pestañas Principales (Segmented Control) -->
                        <div class="payment-tabs-bar">
                            <button type="button" class="payment-tab-btn ${currentTab === 'nueva' ? 'active' : ''}" id="tab-nav-nueva" data-tab="nueva">
                                <i class="bi bi-patch-check me-1"></i> Conciliación Activa
                            </button>
                            <button type="button" class="payment-tab-btn ${currentTab === 'historial' ? 'active' : ''}" id="tab-nav-historial" data-tab="historial">
                                <i class="bi bi-clock-history me-1"></i> Historial <span class="payment-tab-badge" id="badge-historial-count">${cantHistorial}</span>
                            </button>
                        </div>

                        <!-- Selector de Fechas Rápido -->
                        <div class="d-flex align-items-center gap-2">
                            <div class="d-flex align-items-center gap-2 bg-light border px-3 rounded-3" style="height: 38px;">
                                <i class="bi bi-calendar3 text-muted" style="font-size: 12px;"></i>
                                <span class="text-muted small fw-medium" style="font-size: 11.5px;">Desde:</span>
                                <input type="date" id="concil-desde" class="form-control border-0 bg-transparent text-dark fw-semibold p-0 shadow-none" style="font-size: 12px; width: 115px;" min="2026-08-01" value="${escapeHtml(this.state.fechaDesde || '')}">
                                <span class="text-muted mx-1">-</span>
                                <span class="text-muted small fw-medium" style="font-size: 11.5px;">Hasta:</span>
                                <input type="date" id="concil-hasta" class="form-control border-0 bg-transparent text-dark fw-semibold p-0 shadow-none" style="font-size: 12px; width: 115px;" value="${escapeHtml(this.state.fechaHasta || '')}">
                            </div>
                        </div>
                    </div>

                    <!-- VISTA 1: CONCILIACIÓN ACTIVA (TABLA DE MOVIMIENTOS) -->
                    <div id="view-concil-activa" style="display: ${currentTab === 'nueva' ? 'block' : 'none'};">
                        <!-- Sub-Barra de Filtros y Búsqueda -->
                        <div class="p-3 bg-light bg-opacity-50 border-bottom d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
                            <!-- Filtros rápidos por tipo -->
                            <div class="btn-group btn-group-sm p-1 bg-white border rounded-3" role="group">
                                <button type="button" class="btn btn-sm btn-white bg-white shadow-xs fw-bold btn-filtro-movs active" data-filter="todos" style="font-size: 11.5px; border-radius: 6px;">Todos</button>
                                <button type="button" class="btn btn-sm btn-light border-0 text-muted btn-filtro-movs" data-filter="ingresos" style="font-size: 11.5px; border-radius: 6px;">Ingresos (+)</button>
                                <button type="button" class="btn btn-sm btn-light border-0 text-muted btn-filtro-movs" data-filter="egresos" style="font-size: 11.5px; border-radius: 6px;">Egresos (-)</button>
                                <button type="button" class="btn btn-sm btn-light border-0 text-muted btn-filtro-movs" data-filter="marcados" style="font-size: 11.5px; border-radius: 6px;">Conciliados</button>
                                <button type="button" class="btn btn-sm btn-light border-0 text-muted btn-filtro-movs" data-filter="pendientes" style="font-size: 11.5px; border-radius: 6px;">Pendientes</button>
                            </div>

                            <!-- Buscador en tiempo real -->
                            <div class="d-flex align-items-center gap-2">
                                <div class="ds-search-container" style="min-width: 240px;">
                                    <i class="bi bi-search ds-search-icon"></i>
                                    <input type="text" class="ds-search-input" id="search-movimientos-concil" placeholder="Buscar detalle o monto...">
                                </div>
                            </div>
                        </div>

                        <!-- Resumen dinámico de selección -->
                        <div class="p-2 px-3 bg-white border-bottom d-flex justify-content-between align-items-center" style="font-size: 12px;">
                            <span class="text-muted" id="concil-marcados-info">
                                <strong>0</strong> movimientos marcados
                            </span>
                            <div class="d-flex gap-2">
                                <button type="button" class="btn btn-link btn-sm text-decoration-none p-0 text-primary fw-semibold" id="btn-marcar-todos-filtro" style="font-size: 12px;">
                                    Marcar todos
                                </button>
                                <span class="text-muted">·</span>
                                <button type="button" class="btn btn-link btn-sm text-decoration-none p-0 text-secondary fw-semibold" id="btn-desmarcar-todos" style="font-size: 12px;">
                                    Desmarcar todos
                                </button>
                            </div>
                        </div>

                        <!-- TABLA DE MOVIMIENTOS A CONCILIAR -->
                        <div class="table-responsive position-relative">
                            <table class="table table-borderless align-middle mb-0 w-100">
                                <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                    <tr>
                                        <th class="py-3 ps-4 text-center" style="width: 48px;">
                                            <input type="checkbox" id="chk-select-all" class="form-check-input" title="Seleccionar visibles" style="cursor: pointer; width: 18px; height: 18px;">
                                        </th>
                                        <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 110px;">Fecha</th>
                                        <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Descripción / Detalle</th>
                                        <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 120px;">Tipo</th>
                                        <th class="py-3 pe-4 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 150px;">Monto</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-conciliacion">
                                    <tr><td colspan="5" class="text-center py-5 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Cargando movimientos del periodo...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- VISTA 2: HISTORIAL DE CONCILIACIONES PREVIAS -->
                    <div id="view-concil-historial" style="display: ${currentTab === 'historial' ? 'block' : 'none'};">
                        <div class="table-responsive position-relative">
                            <table class="table table-borderless align-middle mb-0 w-100">
                                <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                    <tr>
                                        <th class="py-3 ps-4 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Fecha Guardado</th>
                                        <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Cuenta Bancaria</th>
                                        <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Periodo Auditado</th>
                                        <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Saldo Extracto</th>
                                        <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Diferencia</th>
                                        <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Estado</th>
                                        <th class="py-3 text-center text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Partidas</th>
                                        <th class="py-3 pe-4 text-end text-uppercase text-muted fw-bold" style="width: 120px;">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-historial">
                                    <tr><td colspan="8" class="text-center py-5 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Cargando historial...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (this.element) {
            this.element.innerHTML = html;
        }

        return html;
    },

    renderTabla() {
        const tbody = this.element?.querySelector('#tbody-conciliacion');
        if (!tbody) return;

        const currentFilter = this.state.filterTipoMovs || 'todos';
        const searchQuery = this.state.searchMovsQuery || '';
        const seleccionados = this.state._seleccionados || new Set();

        const filtrados = this.filtrarMovimientos(
            this.state.movimientosRango || [],
            currentFilter,
            searchQuery,
            seleccionados
        );

        if (filtrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-5">
                        <div class="mb-2"><i class="bi bi-inbox fs-2 text-secondary opacity-50"></i></div>
                        <h6 class="fw-semibold text-dark mb-1">No se encontraron movimientos</h6>
                        <p class="text-muted mb-0" style="font-size: 12.5px;">Ajusta el rango de fechas o los filtros para visualizar transacciones.</p>
                    </td>
                </tr>
            `;
            return;
        }

        const movimientosOrdenados = [...filtrados].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        tbody.innerHTML = movimientosOrdenados.map(m => {
            const isIngreso = m.tipo === 'ingreso' || m.tipo === 'in';
            const isChecked = seleccionados.has(m.id);

            const badgeBg = isIngreso ? '#ecfdf5' : '#fef2f2';
            const badgeColor = isIngreso ? '#059669' : '#dc2626';
            const tipoLabel = isIngreso ? 'Ingreso (+)' : 'Egreso (-)';
            const iconTipo = isIngreso ? 'bi-arrow-down-left' : 'bi-arrow-up-right';

            return `
                <tr class="payment-row fila-movimiento-concil" data-id="${m.id}" style="cursor: pointer; ${isChecked ? 'background-color: #f0fdf4 !important;' : ''}">
                    <!-- Checkbox de Conciliación -->
                    <td class="py-3 ps-4 text-center">
                        <input class="form-check-input concil-check" type="checkbox" data-id="${m.id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                    </td>

                    <!-- Fecha -->
                    <td class="py-3">
                        <span class="text-muted fw-medium" style="font-size: 12.5px;">
                            ${this.formatFecha(m.fecha)}
                        </span>
                    </td>

                    <!-- Detalle / Descripción -->
                    <td class="py-3">
                        <div class="fw-bold text-dark text-truncate" style="max-width: 480px; font-size: 13px;" title="${escapeHtml(m.detalle || m.descripcion || m.observaciones || '')}">
                            ${escapeHtml(m.detalle || m.descripcion || m.observaciones || 'Sin descripción')}
                        </div>
                        ${m.referencia ? `<span class="payment-code-badge mt-1" style="font-size: 10.5px;">Ref: ${escapeHtml(m.referencia)}</span>` : ''}
                    </td>

                    <!-- Tipo -->
                    <td class="py-3">
                        <span class="badge border rounded-pill fw-medium" style="background-color: ${badgeBg}; color: ${badgeColor}; font-size: 11px; padding: 4px 8px;">
                            <i class="bi ${iconTipo} me-1"></i> ${tipoLabel}
                        </span>
                    </td>

                    <!-- Monto -->
                    <td class="py-3 pe-4 text-end">
                        <div class="fw-bold tnum ${isIngreso ? 'text-success' : 'text-danger'}" style="font-size: 14.5px;">
                            ${isIngreso ? '+' : '-'}${this.formatMoney(m.monto)}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    renderHistorial() {
        const tbody = this.element?.querySelector('#tbody-historial');
        if (!tbody) return;

        const parseDate = (d) => {
            if (!d) return new Date(0);
            if (d instanceof Date) return d;
            const s = String(d).replace(' ', 'T');
            const dt = new Date(s);
            return isNaN(dt.getTime()) ? new Date(d) : dt;
        };

        const currentBancoId = this.state.bancoId !== null && this.state.bancoId !== undefined && this.state.bancoId !== ''
            ? parseInt(this.state.bancoId, 10)
            : null;

        const listaHistorial = [...(this.state.historialConciliaciones || [])]
            .filter(c => {
                if (currentBancoId === null || isNaN(currentBancoId)) return true;
                const cBancoId = (c.banco_id !== null && c.banco_id !== undefined && c.banco_id !== '') ? parseInt(c.banco_id, 10) : null;
                return cBancoId === currentBancoId;
            })
            .sort((a, b) => {
                const diff = parseDate(b.fecha_guardado) - parseDate(a.fecha_guardado);
                if (diff !== 0 && !isNaN(diff)) return diff;
                return (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0);
            });

        if (listaHistorial.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-5">
                        <div class="mb-2"><i class="bi bi-clock-history fs-2 text-secondary opacity-50"></i></div>
                        <h6 class="fw-semibold text-dark mb-1">No hay conciliaciones guardadas</h6>
                        <p class="text-muted mb-0" style="font-size: 12.5px;">Realiza el cuadre de tus cuentas y guarda tu primera conciliación.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = listaHistorial.map(h => {
            const dateObj = parseDate(h.fecha_guardado);
            const fechaGuardadoStr = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleDateString('es-CO') + ' ' + dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                : (h.fecha_guardado || '-');

            const rango = `${this.formatFecha(h.fecha_desde)} - ${this.formatFecha(h.fecha_hasta)}`;
            const isDiferenciaCero = Math.abs(Number(h.diferencia) || 0) < 0.01;
            const difColor = isDiferenciaCero ? '#059669' : '#dc2626';
            const cantMovs = Array.isArray(h.movimientos_conciliados) ? h.movimientos_conciliados.length : 0;
            
            const hBancoId = (h.banco_id !== null && h.banco_id !== undefined && h.banco_id !== '') ? parseInt(h.banco_id, 10) : null;
            const cuenta = (this.state.cuentas || []).find(c => parseInt(c.id, 10) === hBancoId);
            const cuentaNombre = cuenta ? cuenta.nombre : (hBancoId ? `Cuenta #${hBancoId}` : '-');
            const avatar = this.getBankAvatar(cuenta || { nombre: cuentaNombre });

            const estado = h.estado || (isDiferenciaCero ? 'exitosa' : 'pendiente');
            const badgeEstado = estado === 'exitosa'
                ? '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 8px;"><i class="bi bi-patch-check-fill me-1"></i> Exitosa</span>'
                : (estado === 'anulada'
                    ? '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 8px;">Anulada</span>'
                    : '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 8px;"><i class="bi bi-clock-history me-1"></i> Pendiente</span>');

            return `
                <tr class="payment-row row-historial-concil" data-id="${h.id}" style="cursor: pointer;">
                    <!-- Fecha Guardado -->
                    <td class="py-3 ps-4 text-muted fw-medium" style="font-size: 12.5px;">
                        ${fechaGuardadoStr}
                    </td>

                    <!-- Cuenta Bancaria con Avatar -->
                    <td class="py-3">
                        <div class="d-flex align-items-center gap-2">
                            <div class="payment-avatar" style="width: 26px; height: 26px; font-size: 10px; background-color: ${avatar.bg}; color: ${avatar.color};">
                                ${escapeHtml(avatar.initials)}
                            </div>
                            <span class="fw-bold text-dark text-truncate" style="max-width: 180px; font-size: 13px;">
                                ${escapeHtml(cuentaNombre)}
                            </span>
                        </div>
                    </td>

                    <!-- Periodo Auditado -->
                    <td class="py-3 text-muted" style="font-size: 12.5px;">
                        ${rango}
                    </td>

                    <!-- Saldo Extracto -->
                    <td class="py-3 text-end fw-semibold text-dark tnum" style="font-size: 13px;">
                        ${this.formatMoney(h.saldo_bancario)}
                    </td>

                    <!-- Diferencia -->
                    <td class="py-3 text-end fw-bold tnum" style="font-size: 13.5px; color: ${difColor};">
                        ${this.formatMoney(h.diferencia)}
                    </td>

                    <!-- Estado -->
                    <td class="py-3 text-center">
                        ${badgeEstado}
                    </td>

                    <!-- Movimientos Conciliados -->
                    <td class="py-3 text-center">
                        <span class="badge bg-light text-dark border rounded-pill px-2 py-1" style="font-size: 11.5px;">
                            ${cantMovs} items
                        </span>
                    </td>

                    <!-- Acciones -->
                    <td class="py-3 pe-4 text-end">
                        <div class="payment-row-actions">
                            <button class="btn btn-sm btn-light border text-primary p-1 btn-ver-detalle-concil" data-id="${h.id}" title="Ver Comprobante">
                                <i class="bi bi-eye fs-6"></i>
                            </button>
                            <button class="btn btn-sm btn-light border text-secondary p-1 btn-editar-concil" data-id="${h.id}" title="Editar">
                                <i class="bi bi-pencil fs-6"></i>
                            </button>
                            <button class="btn btn-sm btn-light border text-danger p-1 btn-eliminar-concil" data-id="${h.id}" title="Eliminar">
                                <i class="bi bi-trash fs-6"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async renderDetalle(element, id) {
        const targetId = parseInt(id, 10);
        let concil = (this.state.historialConciliaciones || []).find(c => parseInt(c.id, 10) === targetId);
        
        const supabaseClient = await this.getSupabase();
        if (!concil && supabaseClient) {
            const { data } = await supabaseClient.from('conciliaciones').select('*').eq('id', targetId).maybeSingle();
            if (data) concil = data;
        }

        if (!concil) {
            element.innerHTML = `<div class="p-5 text-center text-muted">Conciliación no encontrada.</div>`;
            return;
        }

        const cBancoId = parseInt(concil.banco_id, 10);
        const cuenta = (this.state.cuentas || []).find(c => parseInt(c.id, 10) === cBancoId);
        const bancoNombre = cuenta ? cuenta.nombre : 'Cuenta Desconocida';
        const avatar = this.getBankAvatar(cuenta || { nombre: bancoNombre });

        const ids = (concil.movimientos_conciliados || []).map(i => parseInt(i, 10)).filter(Boolean);
        let movs = [];
        if (ids.length > 0 && supabaseClient) {
            const { data: movsData } = await supabaseClient
                .from('pagos_ingresos')
                .select('id, fecha, observaciones, referencia, tipo, monto')
                .in('id', ids);
            movs = (movsData || []).map(m => ({
                ...m,
                tipo: m.tipo === 'in' ? 'ingreso' : 'egreso',
                detalle: m.observaciones || m.referencia || ''
            }));
        }

        const rawDateStr = String(concil.fecha_guardado || '').replace(' ', 'T');
        const dateObj = new Date(rawDateStr);
        const fechaGuardadoStr = !isNaN(dateObj.getTime())
            ? dateObj.toLocaleDateString('es-CO') + ' ' + dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
            : escapeHtml(String(concil.fecha_guardado || '---'));

        const isDifCero = Math.abs(Number(concil.diferencia)) < 1;
        const difColor = isDifCero ? '#059669' : '#dc2626';

        let htmlRows = '';
        if (movs.length === 0) {
            htmlRows = `<tr><td colspan="4" class="text-center py-5 text-muted">No hay movimientos guardados en esta conciliación.</td></tr>`;
        } else {
            htmlRows = movs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(m => {
                const isIngreso = m.tipo === 'ingreso';
                const badgeBg = isIngreso ? '#ecfdf5' : '#fef2f2';
                const badgeColor = isIngreso ? '#059669' : '#dc2626';

                return `
                    <tr class="payment-row" style="font-size: var(--fs-base);">
                        <td class="py-3 ps-4 text-muted fw-medium">${this.formatFecha(m.fecha)}</td>
                        <td class="py-3 fw-bold text-dark">${escapeHtml(m.detalle || m.referencia || '-')}</td>
                        <td class="py-3">
                            <span class="badge border rounded-pill" style="background-color: ${badgeBg}; color: ${badgeColor}; font-size: 11px;">
                                ${m.tipo.toUpperCase()}
                            </span>
                        </td>
                        <td class="py-3 pe-4 text-end fw-bold tnum ${isIngreso ? 'text-success' : 'text-danger'}">${this.formatMoney(m.monto)}</td>
                    </tr>
                `;
            }).join('');
        }

        element.innerHTML = `
            <div class="dash-layout p-4" style="max-width: 1200px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        <a href="#/bancos/conciliacion?banco_id=${concil.banco_id}" class="btn btn-sm btn-light bg-white border mb-3 text-secondary fw-semibold shadow-xs" style="border-radius: 8px;">
                            <i class="bi bi-arrow-left me-1"></i> Volver a Conciliaciones
                        </a>
                        <div class="d-flex align-items-center gap-2">
                            <div class="payment-avatar" style="width: 36px; height: 36px; background-color: ${avatar.bg}; color: ${avatar.color};">
                                ${escapeHtml(avatar.initials)}
                            </div>
                            <div>
                                <h2 class="page-title mb-0" style="font-size: 22px; font-weight: 800; color: #0f172a;">Detalle de Conciliación Bancaria</h2>
                                <span class="text-muted small">${escapeHtml(bancoNombre)} · Periodo: ${this.formatFecha(concil.fecha_desde)} al ${this.formatFecha(concil.fecha_hasta)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS DEL COMPROBANTE -->
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <span class="ds-kpi-label">Fecha de Guardado</span>
                            <div class="payment-kpi-value text-dark fw-bold" style="font-size: 16px;">${fechaGuardadoStr}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <span class="ds-kpi-label">Saldo Extracto</span>
                            <div class="payment-kpi-value text-dark fw-bold tnum" style="font-size: 20px;">${this.formatMoney(concil.saldo_bancario)}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <span class="ds-kpi-label">Saldo en Libros</span>
                            <div class="payment-kpi-value text-dark fw-bold tnum" style="font-size: 20px;">${this.formatMoney(concil.saldo_sistema)}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 4px solid ${difColor};">
                            <span class="ds-kpi-label">Diferencia Final</span>
                            <div class="payment-kpi-value fw-bold tnum" style="font-size: 20px; color: ${difColor};">${this.formatMoney(concil.diferencia)}</div>
                        </div>
                    </div>
                </div>

                <div class="dash-table-container shadow-xs" style="border-radius: 12px; border: 1px solid var(--border-color); background: #ffffff;">
                    <div class="p-3 border-bottom bg-white d-flex justify-content-between align-items-center">
                        <h6 class="fw-bold mb-0 text-dark">Partidas Conciliadas (${movs.length})</h6>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0 w-100">
                            <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                <tr>
                                    <th class="py-3 ps-4 text-uppercase text-muted fw-bold" style="font-size: 11px;">Fecha</th>
                                    <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px;">Descripción</th>
                                    <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px;">Tipo</th>
                                    <th class="py-3 pe-4 text-end text-uppercase text-muted fw-bold" style="font-size: 11px;">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${htmlRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
};
