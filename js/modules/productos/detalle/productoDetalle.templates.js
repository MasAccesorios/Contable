/**
 * Módulo de Plantillas y Componentes Visuales del Detalle de Producto
 * Renderizado de KPIs ejecutivos (.payment-kpi-card), tabla FIFO de lotes, Kardex y ventas.
 */

import { escapeHtml } from '../../../shared/formatters.js';

export { escapeHtml };

export const ProductoDetalleTemplates = {
    escapeHtml,

    /**
     * Formatea valores numéricos en formato de moneda colombiana.
     * @param {number|string|null} val 
     * @returns {string} Ej: "$ 1.500.000"
     */
    formatMoney(val) {
        if (val === null || val === undefined || val === '') return '$ 0';
        const num = parseFloat(val);
        if (isNaN(num)) return '$ 0';
        return '$ ' + Math.round(num).toLocaleString('es-CO');
    },

    /**
     * Formatea cadenas de fecha a formato DD/MM/YYYY.
     * @param {string|null} str 
     * @returns {string}
     */
    formatFecha(str) {
        if (!str || str === '---' || str === 'N/A') return '---';
        const raw = String(str).split('T')[0];
        const partes = raw.split('-');
        if (partes.length === 3 && /^\d{4}$/.test(partes[0]) && /^\d{2}$/.test(partes[1]) && /^\d{2}$/.test(partes[2])) {
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        return escapeHtml(raw);
    },

    /**
     * Renderiza las 4 tarjetas KPI con clase `.payment-kpi-card`.
     * 1. Stock Disponible (Semáforo)
     * 2. Valorización FIFO (Costo Promedio Real vs Base)
     * 3. Margen Comercial (Utilidad $/und y %)
     * 4. Rotación y Cobertura (Velocidad diaria y días de cobertura)
     * @param {Object} kpis 
     * @returns {string}
     */
    renderKpiCards(kpis = {}) {
        const stock = kpis.stock || { stockTotal: 0, stockMinimo: 0, estado: 'agotado' };
        const valorizacion = kpis.valorizacion || { valorTotal: 0, costoPromedioPonderado: 0, costoBase: 0, diferenciaCosto: 0 };
        const margen = kpis.margen || { precioVenta: 0, costoUnitario: 0, utilidadMonetaria: 0, margenPorcentual: 0 };
        const rotacion = kpis.rotacion || { unidadesVendidas: 0, velocidadDiaria: 0, diasCobertura: 0, alertaRecompra: true };

        // 1. Configuración de Semáforo Stock
        let stockBadge = '';
        let stockBorderColor = '#059669';
        let stockIconBg = '#ecfdf5';
        let stockIconColor = '#059669';

        switch (stock.estado) {
            case 'optimo':
                stockBorderColor = '#059669';
                stockIconBg = '#ecfdf5';
                stockIconColor = '#059669';
                stockBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1"><i class="bi bi-check-circle me-1"></i>Óptimo</span>';
                break;
            case 'recompra':
                stockBorderColor = '#d97706';
                stockIconBg = '#fef3c7';
                stockIconColor = '#d97706';
                stockBadge = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-2 py-1"><i class="bi bi-clock-history me-1"></i>Recompra</span>';
                break;
            case 'critico':
                stockBorderColor = '#dc2626';
                stockIconBg = '#fef2f2';
                stockIconColor = '#dc2626';
                stockBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2 py-1"><i class="bi bi-exclamation-triangle me-1"></i>Crítico</span>';
                break;
            case 'agotado':
            default:
                stockBorderColor = '#64748b';
                stockIconBg = '#f1f5f9';
                stockIconColor = '#64748b';
                stockBadge = '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill px-2 py-1"><i class="bi bi-x-circle me-1"></i>Agotado</span>';
                break;
        }

        // 2. Delta de Costo
        const diffCosto = valorizacion.diferenciaCosto || 0;
        let diffBadge = '';
        if (diffCosto > 0) {
            diffBadge = `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle ms-1" style="font-size: 10px;">+${this.formatMoney(diffCosto)} vs base</span>`;
        } else if (diffCosto < 0) {
            diffBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle ms-1" style="font-size: 10px;">${this.formatMoney(diffCosto)} vs base</span>`;
        } else {
            diffBadge = `<span class="badge bg-light text-muted border ms-1" style="font-size: 10px;">Alineado con base</span>`;
        }

        // 3. Margen Badge
        const esMargenPositivo = margen.margenPorcentual > 0;
        const margenColorClass = esMargenPositivo ? 'text-success' : 'text-danger';

        // 4. Cobertura Alerta
        const coberturaDiasText = rotacion.diasCobertura >= 999 ? 'Holgado (&gt;90 d)' : `${rotacion.diasCobertura} días`;
        const coberturaAlertaBadge = rotacion.alertaRecompra
            ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2 py-1"><i class="bi bi-bell-fill me-1"></i>Alerta Recompra</span>'
            : '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1"><i class="bi bi-shield-check me-1"></i>Stock Seguro</span>';

        return `
            <div class="row g-3 mb-4">
                <!-- KPI 1: Stock Disponible -->
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="payment-kpi-card" style="border-left: 3px solid ${stockBorderColor};">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Stock Disponible</span>
                            <div class="payment-kpi-icon" style="background-color: ${stockIconBg}; color: ${stockIconColor};">
                                <span class="material-symbols-outlined" style="font-size: 20px;">inventory_2</span>
                            </div>
                        </div>
                        <div class="kpi-value text-dark fw-bold" style="font-size: 22px;">
                            ${stock.stockTotal} und
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-2" style="font-size: 12px;">
                            <span class="text-muted">Mín: ${stock.stockMinimo} und</span>
                            ${stockBadge}
                        </div>
                    </div>
                </div>

                <!-- KPI 2: Valorización FIFO -->
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="payment-kpi-card" style="border-left: 3px solid #2563eb;">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Valorización FIFO</span>
                            <div class="payment-kpi-icon" style="background-color: #eff6ff; color: #2563eb;">
                                <span class="material-symbols-outlined" style="font-size: 20px;">account_balance_wallet</span>
                            </div>
                        </div>
                        <div class="kpi-value text-dark fw-bold" style="font-size: 22px;">
                            ${this.formatMoney(valorizacion.valorTotal)}
                        </div>
                        <div class="d-flex align-items-center flex-wrap mt-2" style="font-size: 12px;">
                            <span class="text-muted">Prom: <strong>${this.formatMoney(valorizacion.costoPromedioPonderado)}</strong></span>
                            ${diffBadge}
                        </div>
                    </div>
                </div>

                <!-- KPI 3: Margen Comercial -->
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="payment-kpi-card" style="border-left: 3px solid #8b5cf6;">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Margen Comercial</span>
                            <div class="payment-kpi-icon" style="background-color: #f5f3ff; color: #8b5cf6;">
                                <span class="material-symbols-outlined" style="font-size: 20px;">trending_up</span>
                            </div>
                        </div>
                        <div class="kpi-value ${margenColorClass} fw-bold" style="font-size: 22px;">
                            ${margen.margenPorcentual}%
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-2" style="font-size: 12px;">
                            <span class="text-muted">Utilidad: <strong>${this.formatMoney(margen.utilidadMonetaria)}</strong>/und</span>
                            <span class="badge bg-purple-subtle text-purple border" style="font-size: 10px; background-color: #faf5ff; color: #7e22ce;">P.Venta ${this.formatMoney(margen.precioVenta)}</span>
                        </div>
                    </div>
                </div>

                <!-- KPI 4: Rotación y Cobertura -->
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="payment-kpi-card" style="border-left: 3px solid ${rotacion.alertaRecompra ? '#dc2626' : '#059669'};">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Rotación y Cobertura</span>
                            <div class="payment-kpi-icon" style="background-color: ${rotacion.alertaRecompra ? '#fef2f2' : '#ecfdf5'}; color: ${rotacion.alertaRecompra ? '#dc2626' : '#059669'};">
                                <span class="material-symbols-outlined" style="font-size: 20px;">speed</span>
                            </div>
                        </div>
                        <div class="kpi-value text-dark fw-bold" style="font-size: 22px;">
                            ${coberturaDiasText}
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-2" style="font-size: 12px;">
                            <span class="text-muted">${rotacion.velocidadDiaria} und/día</span>
                            ${coberturaAlertaBadge}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Renderiza las filas de la tabla de lotes FIFO con barra de consumo y badge de capa activa.
     * @param {Array} lotes 
     * @param {string} [filtroActual='todos'] 
     * @returns {string}
     */
    renderTablaLotes(lotes = [], filtroActual = 'todos') {
        if (!Array.isArray(lotes) || lotes.length === 0) {
            return `<tr><td colspan="7" class="text-center py-4 text-muted">No hay lotes para este filtro.</td></tr>`;
        }

        let html = '';
        lotes.forEach(l => {
            const actual = parseFloat(l.cantidadActual) || 0;
            const inicial = parseFloat(l.cantidadInicial) || 0;
            const consumo = l.porcentajeConsumo !== undefined ? l.porcentajeConsumo : 0;
            const esAgotado = actual === 0;

            let badgeCapa = '';
            if (l.esCapaActiva) {
                badgeCapa = `<span class="badge bg-primary text-white shadow-sm px-2 py-1"><i class="bi bi-play-fill me-1"></i>Capa Activa</span>`;
            } else if (esAgotado) {
                badgeCapa = `<span class="badge bg-secondary-subtle text-muted border px-2 py-1">Agotado</span>`;
            } else {
                badgeCapa = `<span class="badge bg-light text-secondary border px-2 py-1">En Reserva</span>`;
            }

            const rowClass = esAgotado ? 'table-light opacity-50' : (l.esCapaActiva ? 'bg-primary-subtle bg-opacity-10' : '');

            html += `
                <tr class="${rowClass}" style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);">
                    <td class="py-2 ps-3 tnum">${this.formatFecha(l.fechaIngreso)}</td>
                    <td class="py-2 fw-medium">${escapeHtml(l.referencia || 'Sin Referencia')}</td>
                    <td class="py-2 text-end tnum">${this.formatMoney(l.costoUnitario)}</td>
                    <td class="py-2 text-end tnum">${inicial} und</td>
                    <td class="py-2 text-end tnum">
                        <strong class="${esAgotado ? 'text-muted' : 'text-success'}">${actual} und</strong>
                    </td>
                    <td class="py-2 text-center" style="min-width: 130px;">
                        <div class="d-flex align-items-center justify-content-center">
                            <div class="progress flex-grow-1" style="height: 6px; background-color: #e2e8f0; border-radius: 4px;">
                                <div class="progress-bar ${esAgotado ? 'bg-secondary' : 'bg-primary'}" role="progressbar" style="width: ${consumo}%;" aria-valuenow="${consumo}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <span class="text-muted ms-2 tnum" style="font-size: 11px; min-width: 32px;">${consumo}%</span>
                        </div>
                    </td>
                    <td class="py-2 pe-3 text-center">
                        ${badgeCapa}
                    </td>
                </tr>
            `;
        });

        return html;
    },

    /**
     * Renderiza el timeline de movimientos de Kardex con cálculo visual de diferencias.
     * @param {Array} movimientos 
     * @returns {string}
     */
    renderTimelineKardex(movimientos = []) {
        if (!Array.isArray(movimientos) || movimientos.length === 0) {
            return `<tr><td colspan="7" class="py-4 text-center text-muted">Sin movimientos registrados en Kardex.</td></tr>`;
        }

        let html = '';
        movimientos.forEach(mov => {
            const dateObj = mov.creado_en ? new Date(mov.creado_en) : new Date();
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            const fechaStr = `${day}/${month}/${year} ${hours}:${minutes}`;

            const dif = parseFloat(mov.diferencia) || 0;
            let difClass = 'text-muted';
            let difSign = '';

            if (dif > 0) {
                difClass = 'text-success fw-bold';
                difSign = '+';
            } else if (dif < 0) {
                difClass = 'text-danger fw-bold';
                difSign = '-';
            }

            const formatNum = (num) => Number(num || 0).toLocaleString('es-CO');

            html += `
                <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);">
                    <td class="py-2 ps-4 text-start tnum">${fechaStr}</td>
                    <td class="py-2">
                        <span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle px-2 py-1 text-uppercase" style="font-size: 10px;">
                            ${escapeHtml(mov.tipo_operacion || '')}
                        </span>
                    </td>
                    <td class="py-2 text-end tnum">${formatNum(mov.cantidad_anterior)}</td>
                    <td class="py-2 text-end tnum ${difClass}">${difSign}${formatNum(Math.abs(dif))}</td>
                    <td class="py-2 fw-medium text-end tnum" style="color: #d97706;">${formatNum(mov.cantidad_nueva)}</td>
                    <td class="py-2 text-muted small">${escapeHtml(mov.origen_documento || '-')}</td>
                    <td class="py-2 pe-4 text-muted small">${escapeHtml(mov.referencia_lote || '-')}</td>
                </tr>
            `;
        });

        return html;
    },

    /**
     * Renderiza la tabla de facturas / ventas asociadas con cantidades específicas del ítem.
     * @param {Array} ventas 
     * @param {string} [tipo='ventas']
     * @returns {string}
     */
    renderTablaVentas(ventas = [], tipo = 'ventas') {
        if (!Array.isArray(ventas) || ventas.length === 0) {
            const labelTipo = tipo === 'compras' ? 'compras' : 'ventas';
            return `<tr><td colspan="7" class="py-4 text-center text-muted">No se registran ${labelTipo} para este producto.</td></tr>`;
        }

        let html = '';
        ventas.forEach(v => {
            let badgeEstado = '';
            if (v.estado === 'cobrada' || v.estado === 'pagada') {
                badgeEstado = '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill">Cobrada</span>';
            } else if (v.estado === 'anulada' || v.estado === 'void') {
                badgeEstado = '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill">Anulada</span>';
            } else if (v.estado === 'vencida') {
                badgeEstado = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">Vencida</span>';
            } else {
                badgeEstado = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill">Pendiente</span>';
            }

            html += `
                <tr class="row-factura-asociada" data-id="${escapeHtml(String(v.id || ''))}" data-tipo="${escapeHtml(String(v.tipo || 'venta'))}" style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);">
                    <td class="py-2 ps-3 fw-semibold">Factura #${escapeHtml(String(v.numero || v.id))}</td>
                    <td class="py-2 tnum">${this.formatFecha(v.fecha)}</td>
                    <td class="py-2">${escapeHtml(v.clienteNombre || 'Consumidor Final')}</td>
                    <td class="py-2 text-end tnum fw-bold text-dark">${v.cantidadItem} und</td>
                    <td class="py-2 text-end tnum">${this.formatMoney(v.precioUnitarioItem)}</td>
                    <td class="py-2 text-end tnum fw-semibold text-primary">${this.formatMoney(v.totalItem)}</td>
                    <td class="py-2 pe-3 text-center">${badgeEstado}</td>
                </tr>
            `;
        });

        return html;
    },

    /**
     * Renderiza el layout completo del detalle de producto.
     * @param {Object} state 
     * @returns {string}
     */
    renderLayout(state = {}) {
        const prod = state.producto || {};
        const kpis = state.kpis || {};
        const lotes = state.lotes || [];
        const filtroLotes = state.filtroLotes || 'todos';
        const ventas = state.ventas || [];
        const facturasCompra = state.facturasCompra || [];

        const todayIso = new Date().toISOString().split('T')[0];

        return `
            <div class="dash-layout p-4" style="max-width: 1400px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                
                <!-- BREADCRUMB & HEADER -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div style="font-size: var(--fs-sm);" class="text-muted">
                        <span>Inventario</span> &gt; <span>Productos</span> &gt; <span class="text-dark fw-bold">Detalle</span>
                    </div>
                    <div class="d-flex gap-2">
                        <button id="btn-kardex-prod" class="btn btn-sm btn-outline-primary d-inline-flex align-items-center" style="font-size: 13px; font-weight: 500; border-radius: var(--border-radius-sm); padding: 5px 12px;">
                            <span class="material-symbols-outlined me-1" style="font-size: 16px;">receipt_long</span>Kardex
                        </button>
                        <button id="btn-volver-prod" class="btn btn-sm btn-light border d-inline-flex align-items-center" style="font-size: 13px; font-weight: 500; border-radius: var(--border-radius-sm); padding: 5px 12px; color: var(--text-body);">
                            <span class="material-symbols-outlined me-1" style="font-size: 16px;">arrow_back</span>Volver al Listado
                        </button>
                    </div>
                </div>

                <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
                    <div>
                        <div class="d-flex align-items-center gap-2">
                            <h2 class="page-title mb-1 fw-bold text-dark" style="font-size: 24px; letter-spacing: -0.5px;">
                                ${escapeHtml(prod.nombre || 'Producto')}
                            </h2>
                            <span class="badge" style="background-color: #f1f5f9; color: var(--text-main); border: 1px solid var(--border-color); font-family: monospace; font-size: 13px; padding: 4px 10px;">
                                SKU: ${escapeHtml(prod.sku || 'N/A')}
                            </span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px;">
                            Gestión por capas FIFO, trazabilidad de costos, rotación comercial y movimientos.
                        </p>
                    </div>
                </div>

                <!-- 4 KPI CARDS EJECUTIVAS -->
                <div id="kpi-cards-container">
                    ${this.renderKpiCards(kpis)}
                </div>

                <!-- CONTENIDO PRINCIPAL: 2 COLUMNAS -->
                <div class="row g-4">
                    <!-- Columna Izquierda: Ficha Técnica & Registro de Lote -->
                    <div class="col-12 col-lg-4">
                        <div class="card border-0 shadow-sm mb-4">
                            <div class="card-body p-4">
                                <h5 class="fw-bold mb-3" style="font-size: 15px; color: var(--text-main);">Ficha Comercial</h5>
                                <ul class="list-unstyled mb-0" style="font-size: 13px;">
                                    <li class="mb-2 d-flex justify-content-between">
                                        <span class="text-muted">Precio de Venta:</span>
                                        <strong class="tnum text-dark">${this.formatMoney(prod.precioVenta)}</strong>
                                    </li>
                                    <li class="mb-2 d-flex justify-content-between">
                                        <span class="text-muted">Costo Base Fijo:</span>
                                        <span class="tnum text-muted">${this.formatMoney(prod.costoBase)}</span>
                                    </li>
                                    <li class="mb-2 d-flex justify-content-between">
                                        <span class="text-muted">Stock Mínimo Sugerido:</span>
                                        <span class="tnum text-dark">${escapeHtml(String(prod.stockMinimo || 0))} und</span>
                                    </li>
                                    <li class="d-flex justify-content-between">
                                        <span class="text-muted">Impuesto / IVA:</span>
                                        <span class="tnum text-dark">${escapeHtml(String(prod.impuesto ? prod.impuesto + '%' : '0%'))}</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <!-- Formulario de Registro de Lote -->
                        <div class="card border-0 shadow-sm">
                            <div class="card-body p-4">
                                <h5 class="fw-bold mb-2" style="font-size: 15px; color: var(--text-main);">
                                    <i class="bi bi-box-arrow-in-down text-primary me-2"></i>Registrar Nuevo Lote FIFO
                                </h5>
                                <p class="text-muted small mb-3">Ingresa una nueva capa de inventario con su costo unitario.</p>
                                
                                <div id="lote-alert" class="alert alert-success d-none mb-3 py-2" style="font-size: 0.9rem;"></div>
                                
                                <form id="form-nuevo-lote">
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold">Cantidad Ingresada *</label>
                                        <input type="number" id="lote-cantidad" class="form-control" required min="1" placeholder="Ej: 50">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold">Costo Unitario ($) *</label>
                                        <input type="text" id="lote-costo" class="form-control" required placeholder="$ 0">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold">Fecha de Ingreso *</label>
                                        <input type="date" id="lote-fecha" class="form-control" required value="${todayIso}">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold">Referencia / Factura Compra</label>
                                        <input type="text" id="lote-ref" class="form-control" placeholder="Ej: Compra #1024 o Ajuste">
                                    </div>
                                    <button type="submit" class="btn btn-primary w-100 mt-2">
                                        <i class="bi bi-plus-lg me-1"></i>Incorporar Capa FIFO
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>

                    <!-- Columna Derecha: Capas de Inventario (Lotes FIFO) -->
                    <div class="col-12 col-lg-8">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body p-4">
                                <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
                                    <div>
                                        <h5 class="fw-bold mb-0" style="font-size: 15px; color: var(--text-main);">Capas de Inventario (Lotes FIFO)</h5>
                                        <span class="text-muted" style="font-size: 12px;">Despacho secuencial del lote más antiguo al más nuevo</span>
                                    </div>
                                    <div class="btn-group btn-group-sm" role="group" id="filtro-lotes-group">
                                        <button type="button" class="btn ${filtroLotes === 'todos' ? 'btn-primary' : 'btn-outline-secondary'}" data-filtro="todos">Todos</button>
                                        <button type="button" class="btn ${filtroLotes === 'activos' ? 'btn-primary' : 'btn-outline-secondary'}" data-filtro="activos">Disponibles</button>
                                        <button type="button" class="btn ${filtroLotes === 'agotados' ? 'btn-primary' : 'btn-outline-secondary'}" data-filtro="agotados">Agotados</button>
                                    </div>
                                </div>

                                <div class="table-responsive">
                                    <table class="table align-middle">
                                        <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                                            <tr style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
                                                <th class="py-2 ps-3">Fecha Ingreso</th>
                                                <th class="py-2">Referencia</th>
                                                <th class="py-2 text-end">Costo Unitario</th>
                                                <th class="py-2 text-end">Inicial</th>
                                                <th class="py-2 text-end">Disponible</th>
                                                <th class="py-2 text-center">Consumo FIFO</th>
                                                <th class="py-2 pe-3 text-center">Estado / Capa</th>
                                            </tr>
                                        </thead>
                                        <tbody id="tbody-lotes-fifo">
                                            ${this.renderTablaLotes(lotes, filtroLotes)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Pestañas Inferiores: Facturas de Venta y Compra del Ítem -->
                    <div class="col-12">
                        <div class="card border-0 mb-4 shadow-sm" style="border-radius: var(--border-radius-sm);">
                            <div class="card-header bg-white border-bottom p-3">
                                <ul class="nav nav-tabs card-header-tabs border-bottom-0" id="tabs-facturas-item" role="tablist">
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link active fw-bold text-nowrap" id="tab-facturas-venta-btn" data-bs-toggle="tab" data-bs-target="#tab-facturas-venta-pane" type="button" role="tab" style="font-size: var(--fs-md);">
                                            <i class="bi bi-receipt me-2 text-muted"></i>Ventas de este Producto <span class="badge rounded-pill bg-light text-secondary border ms-1">${ventas.length}</span>
                                        </button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link fw-semibold text-nowrap" id="tab-facturas-compra-btn" data-bs-toggle="tab" data-bs-target="#tab-facturas-compra-pane" type="button" role="tab" style="font-size: var(--fs-md);">
                                            <i class="bi bi-cart-check me-2 text-muted"></i>Compras de este Producto <span class="badge rounded-pill bg-light text-secondary border ms-1">${facturasCompra.length}</span>
                                        </button>
                                    </li>
                                </ul>
                            </div>
                            <div class="tab-content" id="tabs-facturas-item-content">
                                <div class="tab-pane fade show active p-3" id="tab-facturas-venta-pane" role="tabpanel">
                                    <div class="table-responsive">
                                        <table class="table align-middle">
                                            <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                                                <tr style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
                                                    <th class="py-2 ps-3">Documento</th>
                                                    <th class="py-2">Fecha</th>
                                                    <th class="py-2">Cliente</th>
                                                    <th class="py-2 text-end">Cantidad</th>
                                                    <th class="py-2 text-end">Precio Unitario</th>
                                                    <th class="py-2 text-end">Total Ítem</th>
                                                    <th class="py-2 pe-3 text-center">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${this.renderTablaVentas(ventas)}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div class="tab-pane fade p-3" id="tab-facturas-compra-pane" role="tabpanel">
                                    <div class="table-responsive">
                                        <table class="table align-middle">
                                            <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                                                <tr style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
                                                    <th class="py-2 ps-3">Documento</th>
                                                    <th class="py-2">Fecha</th>
                                                    <th class="py-2">Proveedor</th>
                                                    <th class="py-2 text-end">Cantidad</th>
                                                    <th class="py-2 text-end">Costo Unitario</th>
                                                    <th class="py-2 text-end">Total Ítem</th>
                                                    <th class="py-2 pe-3 text-center">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${this.renderTablaVentas(facturasCompra, 'compras')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- MODAL KARDEX -->
                <div class="modal fade" id="modalKardexProducto" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div class="modal-content" style="background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);">
                            <div class="modal-header border-bottom">
                                <h5 class="modal-title fw-bold d-flex align-items-center" style="color: var(--text-main); font-size: 16px;">
                                    <span class="material-symbols-outlined me-2" style="font-size: 20px; color: var(--primary);">receipt_long</span>Kardex de Producto: ${escapeHtml(prod.nombre || '')}
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body p-0">
                                <div class="table-responsive">
                                    <table class="table align-middle mb-0 text-center">
                                        <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                                            <tr style="color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                                                <th class="py-2 ps-4 text-start">Fecha</th>
                                                <th class="py-2">Tipo</th>
                                                <th class="py-2 text-end">Cant. Anterior</th>
                                                <th class="py-2 text-end">Diferencia</th>
                                                <th class="py-2 text-end">Cant. Nueva</th>
                                                <th class="py-2">Origen</th>
                                                <th class="py-2 pe-4">Referencia</th>
                                            </tr>
                                        </thead>
                                        <tbody id="tbody-kardex-modal">
                                            <tr><td colspan="7" class="py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Cargando kardex...</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="modal-footer border-top">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        `;
    }
};
