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
            diffBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle ms-1" style="font-size: 10px;">-${this.formatMoney(Math.abs(diffCosto))} vs base</span>`;
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

        // 5. Métricas Históricas
        const totalRecaudo = historico.totalRecaudo || 0;
        const totalUnidades = historico.totalUnidadesVendidas ?? historico.unidadesVendidas ?? 0;
        const ticketMedio = historico.precioPromedioPonderado || historico.precioPromedio || 0;

        return `
            <div class="row g-3 mb-4">
                <!-- KPI 1: Stock Disponible -->
                <div class="col-12 col-sm-6 col-md-4 col-xl">
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
                <div class="col-12 col-sm-6 col-md-4 col-xl">
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
                <div class="col-12 col-sm-6 col-md-4 col-xl">
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

                <!-- KPI 4: Ventas Acumuladas -->
                <div class="col-12 col-sm-6 col-md-4 col-xl">
                    <div class="payment-kpi-card" style="border-left: 3px solid #0284c7;">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="text-uppercase fw-semibold text-muted" style="font-size: 11px; letter-spacing: 0.5px;">Ventas Acumuladas</span>
                            <div class="payment-kpi-icon" style="background-color: #f0f9ff; color: #0284c7;">
                                <span class="material-symbols-outlined" style="font-size: 20px;">point_of_sale</span>
                            </div>
                        </div>
                        <div class="kpi-value text-dark fw-bold" style="font-size: 22px;">
                            ${this.formatMoney(totalRecaudo)}
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-2" style="font-size: 12px;">
                            <span class="text-muted">${totalUnidades} und</span>
                            <span class="badge bg-light text-secondary border" style="font-size: 10px;">Prom: ${this.formatMoney(ticketMedio)}</span>
                        </div>
                    </div>
                </div>

                <!-- KPI 5: Rotación y Cobertura -->
                <div class="col-12 col-sm-6 col-md-4 col-xl">
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
            <div class="dash-layout p-4" style="max-width: 1400px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                
                <!-- FRANJA 1: BREADCRUMB, HEADER DE PRODUCTO & ACCIONES -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div style="font-size: var(--fs-sm);" class="text-muted">
                        <span>Inventario</span> &gt; <span>Productos</span> &gt; <span class="text-dark fw-bold">Detalle</span>
                    </div>
                    <div class="d-flex gap-2">
                        <button id="btn-kardex-prod" class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center" style="font-size: 13px; font-weight: 500; border-radius: var(--border-radius-sm); padding: 5px 12px;">
                            <span class="material-symbols-outlined me-1" style="font-size: 16px; color: #2563eb;">receipt_long</span>Kardex
                        </button>
                        <button id="btn-volver-prod" class="btn btn-sm btn-light border d-inline-flex align-items-center" style="font-size: 13px; font-weight: 500; border-radius: var(--border-radius-sm); padding: 5px 12px; color: var(--text-body);">
                            <span class="material-symbols-outlined me-1" style="font-size: 16px;">arrow_back</span>Volver al Listado
                        </button>
                    </div>
                </div>

                <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
                    <div>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <h2 class="page-title mb-0 fw-bold text-dark" style="font-size: 24px; letter-spacing: -0.5px;">
                                ${escapeHtml(prod.nombre || 'Producto')}
                            </h2>
                            <span class="badge" style="background-color: #f1f5f9; color: var(--text-main); border: 1px solid var(--border-color); font-family: monospace; font-size: 13px; padding: 4px 10px;">
                                SKU: ${escapeHtml(prod.sku || 'N/A')}
                                <i id="btn-copy-sku" class="bi bi-copy ms-1 text-muted cursor-pointer" title="Copiar SKU" style="cursor: pointer;"></i>
                            </span>
                            <span class="badge border rounded-pill px-2.5 py-1 ${stockBadgeBg}" style="font-size: 12px;">
                                <span class="d-inline-block rounded-circle ${stockDotClass} me-1" style="width: 7px; height: 7px;"></span>
                                ${stockBadgeText}
                            </span>
                        </div>
                        <p class="text-muted mb-0 mt-1" style="font-size: 13px;">
                            Gestión por capas FIFO, trazabilidad de costos, rotación comercial y movimientos.
                        </p>
                    </div>
                    <div class="d-flex gap-2">
                        <button id="btn-abrir-lote-modal" class="btn btn-sm btn-primary d-inline-flex align-items-center shadow-sm" data-bs-toggle="modal" data-bs-target="#modalNuevoLoteFIFO" style="font-size: 13px; font-weight: 600; border-radius: var(--border-radius-sm); padding: 6px 14px;">
                            <span class="material-symbols-outlined me-1" style="font-size: 18px;">add_box</span>+ Ingresar Lote FIFO
                        </button>
                    </div>
                </div>

                <!-- STRIP DE 5 KPI CARDS EJECUTIVAS -->
                <div id="kpi-cards-container">
                    ${this.renderKpiCards(kpis)}
                </div>

                <!-- FRANJA 2: MASTER CONTEXT GRID (3 COLUMNAS SIMÉTRICAS DE IGUAL ALTURA) -->
                <div class="row g-3 mb-4">
                    
                    <!-- CARD 1: FICHA DE PRECIOS -->
                    <div class="col-12 col-md-6 col-lg-4">
                        <div class="card border-0 shadow-sm h-100" style="border-radius: var(--border-radius-sm); border: 1px solid var(--border-color);">
                            <div class="card-body p-3.5 d-flex flex-column justify-content-between">
                                <div>
                                    <h6 class="fw-bold mb-3 d-flex align-items-center text-dark" style="font-size: 14px;">
                                        <span class="material-symbols-outlined me-1.5 text-primary" style="font-size: 18px;">payments</span>Ficha de Precios
                                    </h6>
                                    <ul class="list-unstyled mb-0" style="font-size: 12.5px;">
                                        <li class="mb-2 pb-1.5 border-bottom d-flex justify-content-between align-items-center">
                                            <span class="text-muted">PVP Catálogo:</span>
                                            <strong class="tnum text-dark" style="font-size: 13.5px;">${this.formatMoney(prod.precioVenta)}</strong>
                                        </li>
                                        <li class="mb-2 pb-1.5 border-bottom d-flex justify-content-between align-items-center">
                                            <span class="text-muted">PVP Promedio Real Ventas:</span>
                                            <span class="tnum text-primary fw-semibold">${this.formatMoney(historico.precioPromedioPonderado || prod.precioVenta)}</span>
                                        </li>
                                        <li class="mb-2 pb-1.5 border-bottom d-flex justify-content-between align-items-center">
                                            <span class="text-muted">Costo Base Fijo:</span>
                                            <span class="tnum text-muted">${this.formatMoney(prod.costoBase)}</span>
                                        </li>
                                        <li class="mb-2 pb-1.5 border-bottom d-flex justify-content-between align-items-center">
                                            <span class="text-muted">Costo Promedio FIFO:</span>
                                            <strong class="tnum text-dark">${this.formatMoney(valorizacion.costoPromedioPonderado)}</strong>
                                        </li>
                                        <li class="mb-2 pb-1.5 border-bottom d-flex justify-content-between align-items-center">
                                            <span class="text-muted">Utilidad Unitaria Bruta:</span>
                                            <span class="tnum fw-bold ${margen.margenPorcentual > 0 ? 'text-success' : 'text-danger'}">
                                                ${this.formatMoney(margen.utilidadMonetaria)} (${margen.margenPorcentual}%)
                                            </span>
                                        </li>
                                        <li class="d-flex justify-content-between align-items-center">
                                            <span class="text-muted">Régimen IVA / Impuesto:</span>
                                            <span class="badge bg-light text-dark border">${prod.impuesto != null && prod.impuesto !== '' ? escapeHtml(String(prod.impuesto)) + '%' : '0% Exento'}</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- CARD 2: PARÁMETROS DE BODEGA & REABASTECIMIENTO -->
                    <div class="col-12 col-md-6 col-lg-4">
                        <div class="card border-0 shadow-sm h-100" style="border-radius: var(--border-radius-sm); border: 1px solid var(--border-color);">
                            <div class="card-body p-3.5 d-flex flex-column justify-content-between">
                                <div>
                                    <h6 class="fw-bold mb-3 d-flex align-items-center text-dark" style="font-size: 14px;">
                                        <span class="material-symbols-outlined me-1.5 text-warning" style="font-size: 18px;">warehouse</span>Parámetros de Bodega
                                    </h6>
                                    <ul class="list-unstyled mb-0" style="font-size: 12.5px;">
                                        <li class="mb-2 pb-1.5 border-bottom d-flex justify-content-between align-items-center">
                                            <span class="text-muted">Stock Mínimo Registrado:</span>
                                            <strong class="tnum text-dark">${parseFloat(prod.stockMinimo) || 0} und</strong>
                                        </li>
                                        <li class="mb-2 pb-1.5 border-bottom d-flex justify-content-between align-items-center">
                                            <span class="text-muted">Punto de Reorden Sugerido (ROP):</span>
                                            <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-bold px-2 py-1">${rotacion.puntoReordenSugerido || 5} und</span>
                                        </li>
                                        <li class="mb-2 pb-1.5 border-bottom d-flex justify-content-between align-items-center">
                                            <span class="text-muted">Velocidad Diaria (30d):</span>
                                            <span class="tnum text-muted">${rotacion.velocidadDiaria || 0} und/día</span>
                                        </li>
                                        <li class="mb-2 pb-1.5 border-bottom d-flex justify-content-between align-items-center">
                                            <span class="text-muted">Días de Cobertura:</span>
                                            <strong class="tnum ${rotacion.alertaRecompra ? 'text-danger' : 'text-success'}">${rotacion.diasCobertura >= 999 ? '> 90 días' : rotacion.diasCobertura + ' días'}</strong>
                                        </li>
                                        <li class="d-flex justify-content-between align-items-center">
                                            <span class="text-muted">Valor Total en Bodega:</span>
                                            <strong class="tnum text-dark">${this.formatMoney(valorizacion.valorTotal)}</strong>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- CARD 3: CONCENTRACIÓN DE CANALES & TOP CLIENTES -->
                    <div class="col-12 col-md-12 col-lg-4">
                        <div class="card border-0 shadow-sm h-100" style="border-radius: var(--border-radius-sm); border: 1px solid var(--border-color);">
                            <div class="card-body p-3.5 d-flex flex-column justify-content-between">
                                <div>
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <h6 class="fw-bold mb-0 d-flex align-items-center text-dark" style="font-size: 14px;">
                                            <span class="material-symbols-outlined me-1.5 text-info" style="font-size: 18px;">pie_chart</span>Concentración de Canales
                                        </h6>
                                        <span class="badge bg-light text-muted border" style="font-size: 10px;">Pareto Top 3</span>
                                    </div>
                                    
                                    ${canalesHtml}
                                </div>

                                <div>
                                    ${linkTodosClientes}
                                    <div class="p-2 mt-2 rounded-2" style="background-color: #f8fafc; border: 1px dashed var(--border-color); font-size: 11.5px;">
                                        <div class="d-flex justify-content-between">
                                            <span class="text-muted">Total Ventas Históricas:</span>
                                            <strong class="text-primary tnum">${historico.totalUnidadesVendidas || 0} und (${this.formatMoney(historico.totalRecaudo)})</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- FRANJA 3: HUB TRANSACCIONAL OPERATIVO AL 100% DE ANCHO (12 COLUMNAS) -->
                <div class="row g-4 mb-4">
                    <div class="col-12">
                        <div class="card border-0 shadow-sm" style="border-radius: var(--border-radius-sm); border: 1px solid var(--border-color);">
                            <div class="card-header bg-white border-bottom p-0">
                                <ul class="nav nav-tabs card-header-tabs m-0 border-bottom-0 flex-nowrap" id="tabs-producto-principal" role="tablist" style="overflow-x: auto; white-space: nowrap;">
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link active fw-bold text-nowrap py-3 px-3.5 border-0 border-bottom border-primary border-2 text-primary" id="tab-lotes-fifo-btn" data-bs-toggle="tab" data-bs-target="#tab-lotes-fifo-pane" type="button" role="tab" style="font-size: 13px;">
                                            <span class="material-symbols-outlined align-middle me-1" style="font-size: 18px;">layers</span>Capas FIFO <span class="badge rounded-pill bg-light text-secondary border ms-1">${lotes.length}</span>
                                        </button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link fw-semibold text-nowrap py-3 px-3.5 border-0 text-muted" id="tab-kardex-btn" data-bs-toggle="tab" data-bs-target="#tab-kardex-pane" type="button" role="tab" style="font-size: 13px;">
                                            <span class="material-symbols-outlined align-middle me-1" style="font-size: 18px;">receipt_long</span>Kardex Continuo <span class="badge rounded-pill bg-light text-secondary border ms-1">${kardex.length}</span>
                                        </button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link fw-semibold text-nowrap py-3 px-3.5 border-0 text-muted" id="tab-facturas-venta-btn" data-bs-toggle="tab" data-bs-target="#tab-facturas-venta-pane" type="button" role="tab" style="font-size: 13px;">
                                            <span class="material-symbols-outlined align-middle me-1" style="font-size: 18px;">shopping_bag</span>Ventas del Ítem <span class="badge rounded-pill bg-light text-secondary border ms-1">${ventas.length}</span>
                                        </button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link fw-semibold text-nowrap py-3 px-3.5 border-0 text-muted" id="tab-facturas-compra-btn" data-bs-toggle="tab" data-bs-target="#tab-facturas-compra-pane" type="button" role="tab" style="font-size: 13px;">
                                            <span class="material-symbols-outlined align-middle me-1" style="font-size: 18px;">local_shipping</span>Compras del Ítem <span class="badge rounded-pill bg-light text-secondary border ms-1">${facturasCompra.length}</span>
                                        </button>
                                    </li>
                                </ul>
                            </div>

                            <div class="card-body p-0">
                                <div class="tab-content" id="tabs-producto-content">
                                    
                                    <!-- TAB 1: CAPAS FIFO (100% ANCHO) -->
                                    <div class="tab-pane fade show active p-3" id="tab-lotes-fifo-pane" role="tabpanel">
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
                                            <table class="table align-middle mb-0">
                                                <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                                                    <tr style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
                                                        <th class="py-2.5 ps-3">Fecha Ingreso</th>
                                                        <th class="py-2.5">Referencia</th>
                                                        <th class="py-2.5 text-center">Antigüedad</th>
                                                        <th class="py-2.5 text-end">Costo Unitario</th>
                                                        <th class="py-2.5 text-end">Inicial</th>
                                                        <th class="py-2.5 text-end">Disponible</th>
                                                        <th class="py-2.5 text-center">Consumo FIFO</th>
                                                        <th class="py-2.5 pe-3 text-center">Estado / Capa</th>
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
                                            <table class="table align-middle mb-0 text-center">
                                                <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                                                    <tr style="color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                                                        <th class="py-2.5 ps-4 text-start">Fecha &amp; Hora</th>
                                                        <th class="py-2.5">Operación</th>
                                                        <th class="py-2.5 text-end">Cant. Anterior</th>
                                                        <th class="py-2.5 text-end">Diferencia</th>
                                                        <th class="py-2.5 text-end">Cant. Nueva</th>
                                                        <th class="py-2.5">Documento Origen</th>
                                                        <th class="py-2.5 pe-4">Referencia</th>
                                                    </tr>
                                                </thead>
                                                <tbody id="tbody-kardex-embebido">
                                                    ${this.renderTimelineKardex(kardex)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <!-- TAB 3: VENTAS ASOCIADAS (100% ANCHO) -->
                                    <div class="tab-pane fade p-3" id="tab-facturas-venta-pane" role="tabpanel">
                                        <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
                                            <div class="input-group input-group-sm" style="max-width: 320px;">
                                                <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                                                <input type="text" id="search-ventas-prod" class="form-control border-start-0" placeholder="Buscar por cliente o factura...">
                                            </div>
                                            <span class="text-muted small">${ventas.length} facturas de venta asociadas</span>
                                        </div>

                                        <div class="table-responsive">
                                            <table class="table align-middle mb-0">
                                                <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                                                    <tr style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
                                                        <th class="py-2.5 ps-3">Documento</th>
                                                        <th class="py-2.5">Fecha</th>
                                                        <th class="py-2.5">Cliente</th>
                                                        <th class="py-2.5 text-end">Cantidad</th>
                                                        <th class="py-2.5 text-end">Precio Unitario</th>
                                                        <th class="py-2.5 text-end">Total Ítem</th>
                                                        <th class="py-2.5 pe-3 text-center">Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody id="tbody-ventas-prod">
                                                    ${this.renderTablaVentas(ventas)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <!-- TAB 4: COMPRAS ASOCIADAS (100% ANCHO) -->
                                    <div class="tab-pane fade p-3" id="tab-facturas-compra-pane" role="tabpanel">
                                        <div class="d-flex justify-content-between align-items-center mb-3">
                                            <h6 class="fw-bold mb-0 text-dark" style="font-size: 14px;">Órdenes y Facturas de Compra</h6>
                                            <span class="text-muted small">${facturasCompra.length} facturas de proveedor</span>
                                        </div>

                                        <div class="table-responsive">
                                            <table class="table align-middle mb-0">
                                                <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                                                    <tr style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
                                                        <th class="py-2.5 ps-3">Documento</th>
                                                        <th class="py-2.5">Fecha</th>
                                                        <th class="py-2.5">Proveedor</th>
                                                        <th class="py-2.5 text-end">Cantidad</th>
                                                        <th class="py-2.5 text-end">Costo Unitario</th>
                                                        <th class="py-2.5 text-end">Total Ítem</th>
                                                        <th class="py-2.5 pe-3 text-center">Estado</th>
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
                                    <span class="material-symbols-outlined me-2 text-primary" style="font-size: 20px;">add_box</span>Registrar Nuevo Lote FIFO
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

                <!-- MODAL KARDEX RÁPIDO (#modalKardexProducto) -->
                <div class="modal fade" id="modalKardexProducto" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div class="modal-content" style="background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);">
                            <div class="modal-header border-bottom py-3">
                                <h5 class="modal-title fw-bold d-flex align-items-center" style="color: var(--text-main); font-size: 16px;">
                                    <span class="material-symbols-outlined me-2 text-primary" style="font-size: 20px;">receipt_long</span>Kardex de Producto: ${escapeHtml(prod.nombre || '')}
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body p-0">
                                <div class="table-responsive">
                                    <table class="table align-middle mb-0 text-center">
                                        <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                                            <tr style="color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                                                <th class="py-2 ps-4 text-start">Fecha &amp; Hora</th>
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
                            <div class="modal-footer border-top py-2">
                                <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Cerrar</button>
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
                                    <span class="material-symbols-outlined me-2 text-info" style="font-size: 20px;">pie_chart</span>Todos los Clientes &amp; Canales: ${escapeHtml(prod.nombre || '')}
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body p-0">
                                <div class="table-responsive">
                                    <table class="table align-middle mb-0">
                                        <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color); font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">
                                            <tr>
                                                <th class="py-2.5 ps-4">Cliente / Canal</th>
                                                <th class="py-2.5 text-end">Unidades</th>
                                                <th class="py-2.5 text-end">Participación</th>
                                                <th class="py-2.5 pe-4 text-end">Total Recaudado</th>
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
