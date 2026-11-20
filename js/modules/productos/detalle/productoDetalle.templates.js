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
     * Renderiza las 5 tarjetas KPI con clase `.payment-kpi-card`.
     * 1. Stock Disponible (Semáforo)
     * 2. Valorización FIFO (Costo Promedio Real vs Base)
     * 3. Margen Comercial (Utilidad $/und y %)
     * 4. Ventas Acumuladas (Total Recaudado y Unidades Vendidas)
     * 5. Rotación y Cobertura (Velocidad diaria y días de cobertura)
     * @param {Object} kpis 
     * @returns {string}
     */
    renderKpiCards(kpis = {}) {
        const stock = kpis.stock || { stockTotal: 0, stockMinimo: 0, estado: 'agotado' };
        const valorizacion = kpis.valorizacion || { valorTotal: 0, costoPromedioPonderado: 0, costoBase: 0, diferenciaCosto: 0 };
        const margen = kpis.margen || { precioVenta: 0, costoUnitario: 0, utilidadMonetaria: 0, margenPorcentual: 0 };
        const rotacion = kpis.rotacion || { unidadesVendidas: 0, velocidadDiaria: 0, diasCobertura: 0, alertaRecompra: true };
        const historico = kpis.metricasHistoricas || kpis.historico || { totalRecaudo: 0, totalUnidadesVendidas: 0, precioPromedioPonderado: 0 };

        // 1. Configuración de Semáforo Stock
        let stockBadge = '';
        let stockBorderColor = '#059669';
        let stockIconClass = 'in-bg';

        switch (stock.estado) {
            case 'optimo':
                stockBorderColor = '#059669';
                stockIconClass = 'in-bg';
                stockBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill text-nowrap px-2 py-1"><i class="bi bi-check-circle me-1"></i>Óptimo</span>';
                break;
            case 'reorden':
                stockBorderColor = '#d97706';
                stockIconClass = 'pending-bg';
                stockBadge = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill text-nowrap px-2 py-1"><i class="bi bi-clock-history me-1"></i>Punto Reorden</span>';
                break;
            case 'recompra':
                stockBorderColor = '#d97706';
                stockIconClass = 'pending-bg';
                stockBadge = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill text-nowrap px-2 py-1"><i class="bi bi-clock-history me-1"></i>Recompra</span>';
                break;
            case 'critico':
                stockBorderColor = '#dc2626';
                stockIconClass = 'out-bg';
                stockBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill text-nowrap px-2 py-1"><i class="bi bi-exclamation-triangle me-1"></i>Crítico</span>';
                break;
            case 'agotado':
            default:
                stockBorderColor = '#64748b';
                stockIconClass = 'out-bg';
                stockBadge = '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill text-nowrap px-2 py-1"><i class="bi bi-x-circle me-1"></i>Agotado</span>';
                break;
        }

        // 2. Delta de Costo
        const diffCosto = valorizacion.diferenciaCosto || 0;
        let diffBadge = '';
        if (diffCosto > 0) {
            diffBadge = `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle text-nowrap ms-1" style="font-size: 9.5px; padding: 2px 5px;">+${this.formatMoney(diffCosto)} vs base</span>`;
        } else if (diffCosto < 0) {
            diffBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle text-nowrap ms-1" style="font-size: 9.5px; padding: 2px 5px;">-${this.formatMoney(Math.abs(diffCosto))} vs base</span>`;
        } else {
            diffBadge = `<span class="badge bg-light text-muted border text-nowrap ms-1" style="font-size: 9.5px; padding: 2px 5px;">Alineado con base</span>`;
        }

        // 3. Margen Badge
        const esMargenPositivo = margen.margenPorcentual > 0;
        const margenColorClass = esMargenPositivo ? 'text-success' : 'text-danger';

        // 4. Cobertura Alerta
        const coberturaDiasText = rotacion.diasCobertura >= 999 ? 'Holgado (&gt;90 d)' : `${rotacion.diasCobertura} días`;
        const coberturaAlertaBadge = rotacion.alertaRecompra
            ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill text-nowrap px-2 py-0.5" style="font-size: 10px;"><i class="bi bi-bell-fill me-1"></i>Alerta Recompra</span>'
            : '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill text-nowrap px-2 py-0.5" style="font-size: 10px;"><i class="bi bi-shield-check me-1"></i>Stock Seguro</span>';

        // 5. Métricas Históricas
        const totalRecaudo = historico.totalRecaudo || 0;
        const totalUnidades = historico.totalUnidadesVendidas ?? historico.unidadesVendidas ?? 0;
        const ticketMedio = historico.precioPromedioPonderado || historico.precioPromedio || 0;

        return `
            <div class="row g-3 mb-4 align-items-stretch">
                <!-- KPI 1: Stock Disponible -->
                <div class="col-12 col-sm-6 col-md-4 col-xl d-flex align-items-stretch">
                    <div class="payment-kpi-card w-100 flex-grow-1 h-100 d-flex flex-column justify-content-between p-3" style="border-left: 3px solid ${stockBorderColor};">
                        <div class="d-flex justify-content-between align-items-start mb-2" style="min-height: 38px;">
                            <span class="ds-kpi-label" style="line-height: 1.3;">Stock Disponible</span>
                            <div class="payment-kpi-icon ${stockIconClass}">
                                <i class="bi bi-box-seam"></i>
                            </div>
                        </div>
                        <div class="payment-kpi-value kpi-value text-dark fw-bold tnum my-auto" style="font-size: 22px; line-height: 1.2;">
                            ${stock.stockTotal} und
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top" style="font-size: 11px; min-height: 28px; border-color: var(--border-color) !important;">
                            <span class="text-muted text-nowrap">Mín: ${stock.stockMinimo} und</span>
                            <span class="text-nowrap">${stockBadge}</span>
                        </div>
                    </div>
                </div>

                <!-- KPI 2: Valorización FIFO -->
                <div class="col-12 col-sm-6 col-md-4 col-xl d-flex align-items-stretch">
                    <div class="payment-kpi-card w-100 flex-grow-1 h-100 d-flex flex-column justify-content-between p-3" style="border-left: 3px solid #2563eb;">
                        <div class="d-flex justify-content-between align-items-start mb-2" style="min-height: 38px;">
                            <span class="ds-kpi-label" style="line-height: 1.3;">Valorización FIFO</span>
                            <div class="payment-kpi-icon blue-bg">
                                <i class="bi bi-wallet2"></i>
                            </div>
                        </div>
                        <div class="payment-kpi-value kpi-value text-dark fw-bold tnum my-auto" style="font-size: 22px; line-height: 1.2;">
                            ${this.formatMoney(valorizacion.valorTotal)}
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top" style="font-size: 11px; min-height: 28px; border-color: var(--border-color) !important;">
                            <span class="text-muted text-nowrap">Prom: <strong>${this.formatMoney(valorizacion.costoPromedioPonderado)}</strong></span>
                            <span class="text-nowrap">${diffBadge}</span>
                        </div>
                    </div>
                </div>

                <!-- KPI 3: Margen Comercial -->
                <div class="col-12 col-sm-6 col-md-4 col-xl d-flex align-items-stretch">
                    <div class="payment-kpi-card w-100 flex-grow-1 h-100 d-flex flex-column justify-content-between p-3" style="border-left: 3px solid #8b5cf6;">
                        <div class="d-flex justify-content-between align-items-start mb-2" style="min-height: 38px;">
                            <span class="ds-kpi-label" style="line-height: 1.3;">Margen Comercial</span>
                            <div class="payment-kpi-icon" style="background-color: #f5f3ff; color: #8b5cf6;">
                                <i class="bi bi-graph-up-arrow"></i>
                            </div>
                        </div>
                        <div class="payment-kpi-value kpi-value ${margenColorClass} fw-bold tnum my-auto" style="font-size: 22px; line-height: 1.2;">
                            ${margen.margenPorcentual}%
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top" style="font-size: 11px; min-height: 28px; border-color: var(--border-color) !important;">
                            <span class="text-muted text-nowrap" style="font-size: 10.5px;">Util: <strong>${this.formatMoney(margen.utilidadMonetaria)}</strong></span>
                            <span class="badge bg-purple-subtle text-purple border text-nowrap" style="font-size: 10px; background-color: #faf5ff; color: #7e22ce;" title="Precio de Venta">PV ${this.formatMoney(margen.precioVenta)}</span>
                        </div>
                    </div>
                </div>

                <!-- KPI 4: Ventas Acumuladas -->
                <div class="col-12 col-sm-6 col-md-4 col-xl d-flex align-items-stretch">
                    <div class="payment-kpi-card w-100 flex-grow-1 h-100 d-flex flex-column justify-content-between p-3" style="border-left: 3px solid #0284c7;">
                        <div class="d-flex justify-content-between align-items-start mb-2" style="min-height: 38px;">
                            <span class="ds-kpi-label" style="line-height: 1.3;">Ventas Acumuladas</span>
                            <div class="payment-kpi-icon blue-bg">
                                <i class="bi bi-cash-stack"></i>
                            </div>
                        </div>
                        <div class="payment-kpi-value kpi-value text-dark fw-bold tnum my-auto" style="font-size: 22px; line-height: 1.2;">
                            ${this.formatMoney(totalRecaudo)}
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top" style="font-size: 11px; min-height: 28px; border-color: var(--border-color) !important;">
                            <span class="text-muted text-nowrap">${totalUnidades} und</span>
                            <span class="badge bg-light text-secondary border text-nowrap" style="font-size: 10px;">Prom: ${this.formatMoney(ticketMedio)}</span>
                        </div>
                    </div>
                </div>

                <!-- KPI 5: Rotación y Cobertura -->
                <div class="col-12 col-sm-6 col-md-4 col-xl d-flex align-items-stretch">
                    <div class="payment-kpi-card w-100 flex-grow-1 h-100 d-flex flex-column justify-content-between p-3" style="border-left: 3px solid ${rotacion.alertaRecompra ? '#dc2626' : '#059669'};">
                        <div class="d-flex justify-content-between align-items-start mb-2" style="min-height: 38px;">
                            <span class="ds-kpi-label" style="line-height: 1.3;">Rotación y Cobertura</span>
                            <div class="payment-kpi-icon ${rotacion.alertaRecompra ? 'out-bg' : 'in-bg'}">
                                <i class="bi bi-speedometer2"></i>
                            </div>
                        </div>
                        <div class="payment-kpi-value kpi-value text-dark fw-bold tnum my-auto" style="font-size: 22px; line-height: 1.2;">
                            ${coberturaDiasText}
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top" style="font-size: 11px; min-height: 28px; border-color: var(--border-color) !important;">
                            <span class="text-muted text-nowrap" style="font-size: 10.5px;">${rotacion.velocidadDiaria} und/día</span>
                            <span class="text-nowrap">${coberturaAlertaBadge}</span>
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
            return `<tr><td colspan="8" class="text-center py-4 text-muted">No hay lotes para este filtro.</td></tr>`;
        }

        let html = '';
        lotes.forEach(l => {
            const actual = parseFloat(l.cantidadActual) || 0;
            const inicial = parseFloat(l.cantidadInicial) || 0;
            const consumo = l.porcentajeConsumo !== undefined ? l.porcentajeConsumo : 0;
            const esAgotado = actual === 0;
            const aging = l.diasEnBodega !== undefined ? `${l.diasEnBodega} d` : '0 d';

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
                    <td class="py-2 text-center tnum"><span class="badge bg-light text-secondary border px-2 py-1" style="font-size: 11px;">${aging}</span></td>
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
            const dateObj = mov.creado_en ? new Date(mov.creado_en) : null;
            const esFechaValida = dateObj && !isNaN(dateObj.getTime());
            let fechaStr = '---';
            if (esFechaValida) {
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const year = dateObj.getFullYear();
                const hours = String(dateObj.getHours()).padStart(2, '0');
                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                fechaStr = `${day}/${month}/${year} ${hours}:${minutes}`;
            }

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

            const formatNum = (num) => {
                const n = Number(num);
                return Number.isFinite(n) ? n.toLocaleString('es-CO') : '0';
            };

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
     * Renderiza las filas de la tabla de todos los compradores / canales para el modal.
     * @param {Array} canales 
     * @returns {string}
     */
    renderFilasModalClientes(canales = []) {
        if (!Array.isArray(canales) || canales.length === 0) {
            return `<tr><td colspan="4" class="py-4 text-center text-muted">Sin compradores registrados.</td></tr>`;
        }
        return canales.map(c => `
            <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px;">
                <td class="py-2 ps-4 fw-medium text-dark">${escapeHtml(c.nombre)}</td>
                <td class="py-2 text-end tnum">${c.unidades || 0} und</td>
                <td class="py-2 text-end tnum"><span class="badge bg-light text-dark border">${c.porcentaje || 0}%</span></td>
                <td class="py-2 pe-4 text-end tnum text-primary fw-semibold">${this.formatMoney(c.total)}</td>
            </tr>
        `).join('');
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
        const kardex = state.kardex || [];

        const stock = kpis.stock || { stockTotal: 0, stockMinimo: 0, estado: 'agotado' };
        const valorizacion = kpis.valorizacion || { valorTotal: 0, costoPromedioPonderado: 0, costoBase: 0, diferenciaCosto: 0 };
        const margen = kpis.margen || { precioVenta: 0, costoUnitario: 0, utilidadMonetaria: 0, margenPorcentual: 0 };
        const rotacion = kpis.rotacion || { unidadesVendidas: 0, velocidadDiaria: 0, diasCobertura: 0, alertaRecompra: true, puntoReordenSugerido: 5 };
        const historico = kpis.metricasHistoricas || kpis.historico || { totalRecaudo: 0, totalUnidadesVendidas: 0, precioPromedioPonderado: 0, canales: [] };

        const todayIso = new Date().toISOString().split('T')[0];

        // Estado visual del stock badge
        let stockDotClass = 'bg-success';
        let stockBadgeText = 'En Existencia';
        let stockBadgeBg = 'bg-success-subtle text-success border-success-subtle';
        if (stock.estado === 'agotado') {
            stockDotClass = 'bg-secondary';
            stockBadgeText = 'Agotado';
            stockBadgeBg = 'bg-secondary-subtle text-secondary border-secondary-subtle';
        } else if (stock.estado === 'critico') {
            stockDotClass = 'bg-danger';
            stockBadgeText = 'Stock Crítico';
            stockBadgeBg = 'bg-danger-subtle text-danger border-danger-subtle';
        } else if (stock.estado === 'reorden') {
            stockDotClass = 'bg-warning';
            stockBadgeText = 'Punto Reorden';
            stockBadgeBg = 'bg-warning-subtle text-warning-emphasis border-warning-subtle';
        } else if (stock.estado === 'recompra') {
            stockDotClass = 'bg-warning';
            stockBadgeText = 'Punto de Reorden';
            stockBadgeBg = 'bg-warning-subtle text-warning-emphasis border-warning-subtle';
        }

        // Renderizado Pareto de Canales de Venta (Top 3 + Otros)
        let canalesHtml = '';
        const canalesPareto = Array.isArray(historico.canalesPareto) && historico.canalesPareto.length > 0
            ? historico.canalesPareto
            : (Array.isArray(historico.canales) && historico.canales.length > 0
                ? historico.canales.slice(0, 3)
                : [
                    { nombre: 'Mercado Libre / Online', unidades: Math.round((historico.totalUnidadesVendidas || 0) * 0.85) || 0, porcentaje: 85 },
                    { nombre: 'Venta Directa / POS', unidades: Math.round((historico.totalUnidadesVendidas || 0) * 0.15) || 0, porcentaje: 15 }
                ]);

        canalesPareto.forEach((c, idx) => {
            const barColors = ['#0284c7', '#8b5cf6', '#10b981', '#94a3b8'];
            const barColor = c.esOtros ? '#94a3b8' : barColors[idx % barColors.length];
            canalesHtml += `
                <div class="mb-2">
                    <div class="d-flex justify-content-between align-items-center mb-1" style="font-size: 12px;">
                        <span class="text-dark fw-medium text-truncate" style="max-width: 170px;" title="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</span>
                        <span class="text-muted tnum" style="font-size: 11px;"><strong>${c.unidades || 0} und</strong> (${c.porcentaje || 0}%)</span>
                    </div>
                    <div class="progress" style="height: 5px; background-color: #f1f5f9; border-radius: 4px;">
                        <div class="progress-bar" role="progressbar" style="width: ${c.porcentaje || 0}%; background-color: ${barColor};" aria-valuenow="${c.porcentaje || 0}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                </div>
            `;
        });

        const totalClientes = historico.totalClientesUnicos || (historico.canales ? historico.canales.length : 0);
        let linkTodosClientes = '';
        if (totalClientes > 3) {
            linkTodosClientes = `
                <div class="text-center mt-2 pt-1 border-top">
                    <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none fw-semibold" data-bs-toggle="modal" data-bs-target="#modalTodosClientes" style="font-size: 12px; color: var(--primary);">
                        Ver todos los compradores (${totalClientes}) <i class="bi bi-arrow-right ms-1"></i>
                    </button>
                </div>
            `;
        }

        return `
            <div class="dash-layout p-4" style="max-width: 1280px; margin: 0 auto; font-family: var(--font-body), 'Inter', system-ui, sans-serif;">
                
                <!-- BREADCRUMB & ACCIÓN VOLVER -->
                <div class="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-link text-decoration-none text-muted p-0 d-flex align-items-center gap-2 fw-medium" id="btn-volver-prod" style="font-size: 13px; color: var(--text-muted);">
                            <i class="bi bi-arrow-left"></i> Volver a Ítems de venta
                        </button>
                        <span class="text-muted opacity-50 mx-1">|</span>
                        <span class="text-muted" style="font-size: 12px;">Inventario &gt; Productos &gt; <strong class="text-dark">Detalle</strong></span>
                    </div>
                    <div class="d-flex gap-2">
                        <button id="btn-abrir-lote-modal" class="btn btn-primary-action shadow-xs d-inline-flex align-items-center gap-2" data-bs-toggle="modal" data-bs-target="#modalNuevoLoteFIFO" style="font-weight: 600; font-size: 13px; border-radius: 8px;">
                            <i class="bi bi-plus-lg"></i> + Ingresar Lote FIFO
                        </button>
                    </div>
                </div>

                <!-- CABECERA PRINCIPAL DE PRODUCTO -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
                    <div>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <h2 class="page-title mb-0 fw-bold text-dark" style="font-size: 24px; letter-spacing: -0.5px;">
                                ${escapeHtml(prod.nombre || 'Producto')}
                            </h2>
                            <span class="payment-code-badge" style="font-size: 12px;">
                                SKU: ${escapeHtml(prod.sku || 'N/A')}
                                <i id="btn-copy-sku" class="bi bi-copy ms-1 text-muted cursor-pointer" title="Copiar SKU" style="cursor: pointer;"></i>
                            </span>
                            <span class="badge border rounded-pill px-2 py-1 ${stockBadgeBg}" style="font-size: 12px;">
                                <span class="d-inline-block rounded-circle ${stockDotClass} me-1" style="width: 7px; height: 7px;"></span>
                                ${stockBadgeText}
                            </span>
                        </div>
                        <p class="text-muted mb-0 mt-1" style="font-size: 13px;">
                            Gestión por capas FIFO, trazabilidad de costos, rotación comercial y movimientos.
                        </p>
                    </div>
                </div>

                <!-- STRIP DE 5 KPI CARDS EJECUTIVAS -->
                <div id="kpi-cards-container">
                    ${this.renderKpiCards(kpis)}
                </div>

                <!-- HUB TRANSACCIONAL OPERATIVO AL 100% DE ANCHO (5 PESTAÑAS) -->
                <div class="row g-4 mb-4">
                    <div class="col-12">
                        <div class="card border-0 shadow-sm" style="border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background-color: var(--surface);">
                            <div class="card-header bg-white border-bottom p-0">
                                <ul class="nav nav-tabs card-header-tabs m-0 border-bottom-0 flex-nowrap" id="tabs-producto-principal" role="tablist" style="overflow-x: auto; white-space: nowrap;">
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link active fw-bold text-nowrap py-3 px-3 border-0 border-bottom border-primary border-2 text-primary" id="tab-lotes-fifo-btn" data-bs-toggle="tab" data-bs-target="#tab-lotes-fifo-pane" type="button" role="tab" style="font-size: 13px;">
                                            <i class="bi bi-layers me-1 text-primary"></i> Capas FIFO <span class="badge rounded-pill bg-light text-secondary border ms-1">${lotes.length}</span>
                                        </button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link fw-semibold text-nowrap py-3 px-3 border-0 text-muted" id="tab-kardex-btn" data-bs-toggle="tab" data-bs-target="#tab-kardex-pane" type="button" role="tab" style="font-size: 13px;">
                                            <i class="bi bi-receipt me-1 text-primary"></i> Kardex Continuo <span class="badge rounded-pill bg-light text-secondary border ms-1">${kardex.length}</span>
                                        </button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link fw-semibold text-nowrap py-3 px-3 border-0 text-muted" id="tab-precios-btn" data-bs-toggle="tab" data-bs-target="#tab-precios-pane" type="button" role="tab" style="font-size: 13px;">
                                            <i class="bi bi-currency-dollar me-1 text-primary"></i> Precios y Costos
                                        </button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link fw-semibold text-nowrap py-3 px-3 border-0 text-muted" id="tab-facturas-venta-btn" data-bs-toggle="tab" data-bs-target="#tab-facturas-venta-pane" type="button" role="tab" style="font-size: 13px;">
                                            <i class="bi bi-cart me-1 text-primary"></i> Ventas del Ítem <span class="badge rounded-pill bg-light text-secondary border ms-1">${ventas.length}</span>
                                        </button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link fw-semibold text-nowrap py-3 px-3 border-0 text-muted" id="tab-facturas-compra-btn" data-bs-toggle="tab" data-bs-target="#tab-facturas-compra-pane" type="button" role="tab" style="font-size: 13px;">
                                            <i class="bi bi-truck me-1 text-primary"></i> Compras del Ítem <span class="badge rounded-pill bg-light text-secondary border ms-1">${facturasCompra.length}</span>
                                        </button>
                                    </li>
                                </ul>
                            </div>

                            <div class="card-body p-0">
                                <div class="tab-content" id="tabs-producto-content">
                                    
                                    <!-- TAB 1: CAPAS FIFO (100% ANCHO) -->
                                    <div class="tab-pane fade show active p-3" id="tab-lotes-fifo-pane" role="tabpanel">
                                        <!-- BARRA INTEGRADA DE PARÁMETROS DE BODEGA -->
                                        <div id="parametros-bodega-strip" class="p-3 mb-3 rounded-2" style="background-color: var(--surface-muted); border: 1px solid var(--border-color);">
                                            <div class="row g-3 align-items-center">
                                                <div class="col-6 col-md-auto pe-md-3 border-end">
                                                    <span class="text-muted d-block" style="font-size: 11px; text-transform: uppercase; font-weight: 600;">Stock Mínimo</span>
                                                    <strong class="tnum text-dark" style="font-size: 13px;">${parseFloat(prod.stockMinimo) || 0} und</strong>
                                                </div>
                                                <div class="col-6 col-md-auto pe-md-3 border-end">
                                                    <span class="text-muted d-block" style="font-size: 11px; text-transform: uppercase; font-weight: 600;">Punto de Reorden (ROP)</span>
                                                    <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-bold px-2 py-1" style="font-size: 11.5px;">${rotacion.puntoReordenSugerido || 5} und</span>
                                                </div>
                                                <div class="col-6 col-md-auto pe-md-3 border-end">
                                                    <span class="text-muted d-block" style="font-size: 11px; text-transform: uppercase; font-weight: 600;">Velocidad Diaria (30d)</span>
                                                    <span class="tnum text-dark fw-medium" style="font-size: 13px;">${rotacion.velocidadDiaria || 0} und/día</span>
                                                </div>
                                                <div class="col-6 col-md-auto pe-md-3 border-end">
                                                    <span class="text-muted d-block" style="font-size: 11px; text-transform: uppercase; font-weight: 600;">Días de Cobertura</span>
                                                    <strong class="tnum ${rotacion.alertaRecompra ? 'text-danger' : 'text-success'}" style="font-size: 13px;">${rotacion.diasCobertura >= 999 ? '> 90 días' : rotacion.diasCobertura + ' días'}</strong>
                                                </div>
                                                <div class="col-12 col-md-auto">
                                                    <span class="text-muted d-block" style="font-size: 11px; text-transform: uppercase; font-weight: 600;">Valor Total en Bodega</span>
                                                    <strong class="tnum text-primary" style="font-size: 13px;">${this.formatMoney(valorizacion.valorTotal)}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
                                            <div>
                                                <h6 class="fw-bold mb-0 text-dark" style="font-size: 14px;">Capas de Inventario (Lotes FIFO)</h6>
                                                <span class="text-muted" style="font-size: 12px;">Despacho secuencial del lote más antiguo al más nuevo.</span>
                                            </div>
                                            <div class="btn-group btn-group-sm" role="group" id="filtro-lotes-group">
                                                <button type="button" class="btn ${filtroLotes === 'todos' ? 'btn-primary' : 'btn-outline-secondary'}" data-filtro="todos">Todos</button>
                                                <button type="button" class="btn ${filtroLotes === 'activos' ? 'btn-primary' : 'btn-outline-secondary'}" data-filtro="activos">Disponibles</button>
                                                <button type="button" class="btn ${filtroLotes === 'agotados' ? 'btn-primary' : 'btn-outline-secondary'}" data-filtro="agotados">Agotados</button>
                                            </div>
                                        </div>

                                        <div class="table-responsive">
                                            <table class="table table-hover align-middle mb-0">
                                                <thead style="background-color: var(--surface-muted); border-bottom: 1px solid var(--border-color);">
                                                    <tr style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
                                                        <th class="py-2 ps-3">Fecha Ingreso</th>
                                                        <th class="py-2">Referencia</th>
                                                        <th class="py-2 text-center">Antigüedad</th>
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

                                    <!-- TAB 2: KARDEX CONTINUO EMBEBIDO (100% ANCHO) -->
                                    <div class="tab-pane fade p-3" id="tab-kardex-pane" role="tabpanel">
                                        <div class="d-flex justify-content-between align-items-center mb-3">
                                            <div>
                                                <h6 class="fw-bold mb-0 text-dark" style="font-size: 14px;">Kardex de Movimientos</h6>
                                                <span class="text-muted" style="font-size: 12px;">Historial cronológico de entradas y salidas de bodega.</span>
                                            </div>
                                            <span class="badge bg-light text-muted border">${kardex.length} registros</span>
                                        </div>

                                        <div class="table-responsive">
                                            <table class="table table-hover align-middle mb-0 text-center">
                                                <thead style="background-color: var(--surface-muted); border-bottom: 1px solid var(--border-color);">
                                                    <tr style="color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                                                        <th class="py-2 ps-4 text-start">Fecha &amp; Hora</th>
                                                        <th class="py-2">Operación</th>
                                                        <th class="py-2 text-end">Cant. Anterior</th>
                                                        <th class="py-2 text-end">Diferencia</th>
                                                        <th class="py-2 text-end">Cant. Nueva</th>
                                                        <th class="py-2">Documento Origen</th>
                                                        <th class="py-2 pe-4">Referencia</th>
                                                    </tr>
                                                </thead>
                                                <tbody id="tbody-kardex-embebido">
                                                    ${this.renderTimelineKardex(kardex)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <!-- TAB 3: PRECIOS Y ESTRUCTURA DE COSTOS (100% ANCHO) -->
                                    <div class="tab-pane fade p-3 p-md-4" id="tab-precios-pane" role="tabpanel">
                                        <div id="ficha-precios-content" style="max-width: 950px; margin: 0 auto;">
                                            <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3 pb-2 border-bottom">
                                                <div>
                                                    <h6 class="fw-bold mb-0 text-dark d-flex align-items-center" style="font-size: 15px;">
                                                        <i class="bi bi-currency-dollar me-2 text-primary"></i>Ficha de Precios y Estructura de Costos
                                                    </h6>
                                                    <span class="text-muted" style="font-size: 12.5px;">Estructura de fijación comercial y rentabilidad sobre capas valoradas.</span>
                                                </div>
                                                <span class="badge bg-light text-dark border px-2 py-1" style="font-size: 12px;">
                                                    Régimen IVA: ${prod.impuesto != null && prod.impuesto !== '' ? escapeHtml(String(prod.impuesto)) + '%' : '0% Exento'}
                                                </span>
                                            </div>

                                            <div class="row g-3">
                                                <!-- BLOQUE 1: PRECIOS COMERCIALES -->
                                                <div class="col-12 col-md-6">
                                                    <div class="p-3 p-md-4 rounded-2 h-100" style="background-color: var(--surface-muted); border: 1px solid var(--border-color);">
                                                        <h6 class="fw-bold text-dark mb-3 d-flex align-items-center" style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em;">
                                                            <i class="bi bi-tag me-1 text-primary"></i>Precios de Venta
                                                        </h6>
                                                        <ul class="list-unstyled mb-0" style="font-size: 13px;">
                                                            <li class="mb-2 pb-2 border-bottom d-flex justify-content-between align-items-center">
                                                                <span class="text-muted">PVP Catálogo:</span>
                                                                <strong class="tnum text-dark" style="font-size: 14px;">${this.formatMoney(prod.precioVenta)}</strong>
                                                            </li>
                                                            <li class="mb-2 pb-2 border-bottom d-flex justify-content-between align-items-center">
                                                                <span class="text-muted">PVP Promedio Real Ventas:</span>
                                                                <span class="tnum text-primary fw-semibold">${this.formatMoney(historico.precioPromedioPonderado || prod.precioVenta)}</span>
                                                            </li>
                                                            <li class="d-flex justify-content-between align-items-center">
                                                                <span class="text-muted">Régimen IVA / Impuesto:</span>
                                                                <span class="badge bg-light text-dark border">${prod.impuesto != null && prod.impuesto !== '' ? escapeHtml(String(prod.impuesto)) + '%' : '0% Exento'}</span>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>

                                                <!-- BLOQUE 2: ESTRUCTURA DE COSTOS Y RENTABILIDAD -->
                                                <div class="col-12 col-md-6">
                                                    <div class="p-3 p-md-4 rounded-2 h-100" style="background-color: var(--surface-muted); border: 1px solid var(--border-color);">
                                                        <h6 class="fw-bold text-dark mb-3 d-flex align-items-center" style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em;">
                                                            <i class="bi bi-graph-up me-1 text-success"></i>Costos y Rentabilidad
                                                        </h6>
                                                        <ul class="list-unstyled mb-0" style="font-size: 13px;">
                                                            <li class="mb-2 pb-2 border-bottom d-flex justify-content-between align-items-center">
                                                                <span class="text-muted">Costo Base Fijo:</span>
                                                                <span class="tnum text-muted">${this.formatMoney(prod.costoBase)}</span>
                                                            </li>
                                                            <li class="mb-2 pb-2 border-bottom d-flex justify-content-between align-items-center">
                                                                <span class="text-muted">Costo Promedio FIFO:</span>
                                                                <strong class="tnum text-dark">${this.formatMoney(valorizacion.costoPromedioPonderado)}</strong>
                                                            </li>
                                                            <li class="d-flex justify-content-between align-items-center">
                                                                <span class="text-muted">Utilidad Unitaria Bruta:</span>
                                                                <span class="tnum fw-bold ${margen.margenPorcentual > 0 ? 'text-success' : 'text-danger'}" style="font-size: 13.5px;">
                                                                    ${this.formatMoney(margen.utilidadMonetaria)} (${margen.margenPorcentual}%)
                                                                </span>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- TAB 4: VENTAS ASOCIADAS (100% ANCHO) -->
                                    <div class="tab-pane fade p-3" id="tab-facturas-venta-pane" role="tabpanel">
                                        <!-- BLOQUE SUPERIOR: CONCENTRACIÓN DE CANALES PARETO -->
                                        <div id="concentracion-canales-content" class="p-3 p-md-4 mb-3 rounded-2" style="background-color: var(--surface-muted); border: 1px solid var(--border-color);">
                                            <div class="row g-3 align-items-center">
                                                <div class="col-12 col-lg-7 pe-lg-4 pb-3 pb-lg-0">
                                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                                        <h6 class="fw-bold mb-0 d-flex align-items-center text-dark" style="font-size: 13px;">
                                                            <i class="bi bi-pie-chart me-2 text-info"></i>Concentración de Canales de Venta
                                                        </h6>
                                                        <span class="badge bg-light text-muted border" style="font-size: 10px;">Pareto Top 3</span>
                                                    </div>
                                                    ${canalesHtml}
                                                    ${linkTodosClientes}
                                                </div>
                                                <div class="col-12 col-lg-5 ps-lg-4 pt-3 pt-lg-0">
                                                    <div class="p-3 rounded-2 bg-white border" style="font-size: 12.5px;">
                                                        <div class="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                                                            <span class="text-muted">Total Ventas Históricas:</span>
                                                            <strong class="text-primary tnum">${historico.totalUnidadesVendidas || 0} und (${this.formatMoney(historico.totalRecaudo)})</strong>
                                                        </div>
                                                        <div class="d-flex justify-content-between align-items-center">
                                                            <span class="text-muted">Precio Promedio Real:</span>
                                                            <strong class="text-dark tnum">${this.formatMoney(historico.precioPromedioPonderado || prod.precioVenta)}</strong>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
                                            <div class="ds-search-container" style="max-width: 320px; width: 100%;">
                                                <i class="bi bi-search ds-search-icon"></i>
                                                <input type="text" id="search-ventas-prod" class="ds-search-input" autocomplete="off" placeholder="Buscar por cliente o factura...">
                                            </div>
                                            <span class="text-muted small">${ventas.length} facturas de venta asociadas</span>
                                        </div>

                                        <div class="table-responsive">
                                            <table class="table table-hover align-middle mb-0">
                                                <thead style="background-color: var(--surface-muted); border-bottom: 1px solid var(--border-color);">
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
                                                <tbody id="tbody-ventas-prod">
                                                    ${this.renderTablaVentas(ventas)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <!-- TAB 5: COMPRAS ASOCIADAS (100% ANCHO) -->
                                    <div class="tab-pane fade p-3" id="tab-facturas-compra-pane" role="tabpanel">
                                        <div class="d-flex justify-content-between align-items-center mb-3">
                                            <h6 class="fw-bold mb-0 text-dark" style="font-size: 14px;">Órdenes y Facturas de Compra</h6>
                                            <span class="text-muted small">${facturasCompra.length} facturas de proveedor</span>
                                        </div>

                                        <div class="table-responsive">
                                            <table class="table table-hover align-middle mb-0">
                                                <thead style="background-color: var(--surface-muted); border-bottom: 1px solid var(--border-color);">
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
                                                <tbody id="tbody-compras-prod">
                                                    ${this.renderTablaVentas(facturasCompra, 'compras')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- MODAL NUEVO LOTE FIFO (#modalNuevoLoteFIFO) -->
                <div class="modal fade" id="modalNuevoLoteFIFO" tabindex="-1" aria-labelledby="modalNuevoLoteFIFOLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content" style="border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
                            <div class="modal-header border-bottom py-3">
                                <h5 class="modal-title fw-bold d-flex align-items-center" id="modalNuevoLoteFIFOLabel" style="color: var(--text-main); font-size: 16px;">
                                    <i class="bi bi-box-arrow-in-down me-2 text-primary"></i>Registrar Nuevo Lote FIFO
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body p-4">
                                <p class="text-muted small mb-3">
                                    Incorpora una nueva capa de existencias al inventario. Se despachará en orden secuencial una vez agotadas las capas previas.
                                </p>
                                
                                <div id="lote-alert" class="alert alert-success d-none mb-3 py-2" style="font-size: 0.9rem;"></div>
                                
                                <form id="form-nuevo-lote">
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold" for="lote-cantidad">Cantidad Ingresada *</label>
                                        <input type="number" id="lote-cantidad" class="form-control" required min="1" placeholder="Ej: 50">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold" for="lote-costo">Costo Unitario ($) *</label>
                                        <input type="text" id="lote-costo" class="form-control" required placeholder="$ 0">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold" for="lote-fecha">Fecha de Ingreso *</label>
                                        <input type="date" id="lote-fecha" class="form-control" required value="${todayIso}">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label text-muted small fw-semibold" for="lote-ref">Referencia / Factura Compra</label>
                                        <input type="text" id="lote-ref" class="form-control" placeholder="Ej: Compra #1024 o Ajuste Físico">
                                    </div>
                                    <div class="d-flex justify-content-end gap-2 mt-4">
                                        <button type="button" class="btn btn-sm btn-light border px-3" data-bs-dismiss="modal">Cancelar</button>
                                        <button type="submit" class="btn btn-sm btn-primary px-3 fw-semibold">
                                            <i class="bi bi-plus-lg me-1"></i>Incorporar Capa FIFO
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>


                <!-- MODAL TODOS LOS COMPRADORES / CLIENTES (#modalTodosClientes) -->
                <div class="modal fade" id="modalTodosClientes" tabindex="-1" aria-labelledby="modalTodosClientesLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                        <div class="modal-content" style="border-radius: var(--border-radius-sm); border: 1px solid var(--border-color);">
                            <div class="modal-header border-bottom py-3">
                                <h5 class="modal-title fw-bold d-flex align-items-center" id="modalTodosClientesLabel" style="font-size: 16px; color: var(--text-main);">
                                    <i class="bi bi-pie-chart me-2 text-info"></i>Todos los Clientes &amp; Canales: ${escapeHtml(prod.nombre || '')}
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body p-0">
                                <div class="table-responsive">
                                    <table class="table align-middle mb-0">
                                        <thead style="background-color: var(--surface-muted); border-bottom: 1px solid var(--border-color); font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">
                                            <tr>
                                                <th class="py-2 ps-4">Cliente / Canal</th>
                                                <th class="py-2 text-end">Unidades</th>
                                                <th class="py-2 text-end">Participación</th>
                                                <th class="py-2 pe-4 text-end">Total Recaudado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${this.renderFilasModalClientes(historico.canales || [])}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="modal-footer border-top py-2">
                                <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        `;
    }
};
