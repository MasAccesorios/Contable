import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';

export const ValorizacionModule = {
    state: {
        paginaActual: [],
        totalItems: 0,
        currentPage: 1,
        itemsPerPage: 10,
        searchQuery: '',
        granTotal: 0,
        undFisicas: 0,
        stockBajo: 0
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        const hoy = getLocalDate();
        
        element.innerHTML = `
            <div class="dash-layout p-4">
                <!-- TOP BAR -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Valor de inventario</h2>
                        <p class="text-muted mb-0" style="font-size: 14px;">Consulta el valor actual, cantidad y costo promedio de tu inventario.</p>
                    </div>
                    <div class="d-flex gap-2">
                        <span class="badge bg-light text-dark border d-flex align-items-center px-3" style="font-size: 13px; font-weight: var(--weight-medium);">
                            <i class="bi bi-calendar-check me-2 text-muted"></i> Hasta: ${hoy}
                        </span>
                        <button id="btn-descargar-csv" class="btn btn-primary-action">
                            <i class="bi bi-download me-1"></i> Descargar
                        </button>
                    </div>
                </div>

                <!-- KPI CARDS VALORIZACION -->
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Valor Total del Inventario</span>
                                <div class="dash-icon-box variant-blue">
                                    <i class="bi bi-box-seam"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="kpi-valor-total">$ 0</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Total Unidades Físicas</span>
                                <div class="dash-icon-box variant-green">
                                    <i class="bi bi-boxes"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="kpi-unidades-fisicas">0</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Stock Bajo / Agotado</span>
                                <div class="dash-icon-box variant-red">
                                    <i class="bi bi-exclamation-triangle"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="kpi-stock-bajo">0</div>
                        </div>
                    </div>
                </div>

                <!-- DATA TABLE CARD -->
                <div class="dash-table-container">
                    
                    <!-- FILTERS -->
                    <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center" style="border-radius: 8px 8px 0 0;">
                        <div class="input-group input-group-sm" style="width: 300px;">
                            <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                            <input type="text" id="search-valorizacion" class="form-control border-start-0 ps-0 text-muted" placeholder="Buscar por nombre o referencia..." style="font-size: 13px; box-shadow: none;">
                        </div>
                    </div>

                    <!-- GRID -->
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0">
                            <thead style="border-bottom: 1px solid var(--border-color);">
                                <tr style="color: var(--text-muted); font-size: 13px; font-weight: var(--weight-medium);">
                                    <th class="py-3 fw-normal ps-4">Ítem</th>
                                    <th class="py-3 fw-normal">Referencia</th>
                                    <th class="py-3 fw-normal text-end">Cantidad</th>
                                    <th class="py-3 fw-normal text-end">Costo promedio</th>
                                    <th class="py-3 fw-normal text-end pe-4">Total</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-valorizacion">
                                <tr><td colspan="5" class="text-center py-5 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Calculando valorización...</td></tr>
                            </tbody>
                            <!-- FOOTER FIJO DE LA TABLA (Muestra siempre el Gran Total del catálogo) -->
                            <tfoot style="border-top: 2px solid var(--border-color); background-color: #f8fafc;">
                                <tr>
                                    <td colspan="4" class="py-3 text-end ps-4" style="font-weight: 600; color: var(--text-main); font-size: 14px;">Total Valorizado del Inventario:</td>
                                    <td class="py-3 text-end pe-4" style="font-weight: 700; color: #2cbfb7; font-size: 16px;" id="tfoot-gran-total">$0,00</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <!-- PAGINATION CONTROLS -->
                    <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center" style="border-radius: 0 0 8px 8px;">
                        <div class="d-flex align-items-center gap-3" style="font-size: 13px; color: var(--text-body);">
                            <span class="d-flex align-items-center gap-2">
                                Ítems por página: 
                                <select id="items-per-page" class="form-select form-select-sm border-0 bg-transparent fw-bold" style="width: auto; box-shadow: none; cursor: pointer;">
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                </select>
                            </span>
                            <span id="showing-count">...</span>
                        </div>
                        <div class="d-flex align-items-center gap-2" style="font-size: 13px;">
                            <span>Página <span id="current-page" class="fw-bold">1</span> de <span id="total-pages">1</span></span>
                            <button class="btn btn-sm btn-light border text-muted px-2" id="btn-prev-page" disabled><i class="bi bi-chevron-left"></i></button>
                            <button class="btn btn-sm btn-light border text-muted px-2" id="btn-next-page" disabled><i class="bi bi-chevron-right"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
        await this.calcularKPIs();
        await this.fetchRPC();
        this.renderTabla();
    },

    async calcularKPIs() {
        try {
            const dataAll = await this.fetchRPC(true);
            if (dataAll) {
                let undFisicas = 0;
                let stockBajo = 0;
                dataAll.forEach(item => {
                    const st = parseFloat(item.stock_total) || 0;
                    undFisicas += st;
                    if (st <= 3) stockBajo++; // Umbral de stock bajo genérico
                });
                this.state.undFisicas = undFisicas;
                this.state.stockBajo = stockBajo;
            }
        } catch (e) {
            console.error('Error calculando KPIs:', e);
        }
    },

    bindEvents() {
        const el = this.element;

        el.querySelector('#search-valorizacion')?.addEventListener('input', async (e) => {
            this.state.searchQuery = e.target.value.toLowerCase().trim();
            this.state.currentPage = 1;
            await this.fetchRPC();
            this.renderTabla();
        });

        el.querySelector('#items-per-page')?.addEventListener('change', async (e) => {
            this.state.itemsPerPage = parseInt(e.target.value);
            this.state.currentPage = 1;
            await this.fetchRPC();
            this.renderTabla();
        });

        el.querySelector('#btn-prev-page')?.addEventListener('click', async () => {
            if (this.state.currentPage > 1) {
                this.state.currentPage--;
                await this.fetchRPC();
                this.renderTabla();
            }
        });

        el.querySelector('#btn-next-page')?.addEventListener('click', async () => {
            const totalPages = Math.ceil(this.state.totalItems / this.state.itemsPerPage) || 1;
            if (this.state.currentPage < totalPages) {
                this.state.currentPage++;
                await this.fetchRPC();
                this.renderTabla();
            }
        });

        el.querySelector('#btn-descargar-csv')?.addEventListener('click', () => {
            this.exportarCSV();
        });
    },

    // --------------------------------------------------------
    // MOTOR DE CÁLCULO GENERAL (RPC Server-side)
    // --------------------------------------------------------
    async fetchRPC(exportAll = false) {
        if (!exportAll) {
            this.element.querySelector('#tbody-valorizacion').innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Cargando valorización...</td></tr>`;
        }

        const { data, error } = await supabase.rpc('get_inventario_valorizado', {
            p_search: this.state.searchQuery,
            p_page: this.state.currentPage,
            p_limit: this.state.itemsPerPage,
            p_export_all: exportAll
        });

        if (error) {
            console.error("Error fetching inventario valorizado:", error);
            if (exportAll) return [];
            this.state.paginaActual = [];
            this.state.totalItems = 0;
            return;
        }

        if (exportAll) {
            return data.items || [];
        }

        this.state.granTotal = data.gran_total;
        this.state.totalItems = data.total_items;
        this.state.paginaActual = data.items || [];
    },

    renderTabla() {
        const totalItems = this.state.totalItems || 0;
        const totalPages = Math.ceil(totalItems / this.state.itemsPerPage) || 1;
        const paginaActual = this.state.paginaActual || [];

        // Renderizado de Grilla
        const container = this.element.querySelector('#tbody-valorizacion');
        if (paginaActual.length === 0) {
            container.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">No se encontraron productos.</td></tr>`;
        } else {
            const formatMoney = (val) => '$' + (val || 0).toLocaleString('es-CO', {maximumFractionDigits: 0});
            let html = '';
            
            paginaActual.forEach(item => {
                const stock = parseFloat(item.stock_total) || 0;
                const isZero = stock === 0;
                const isLow = stock > 0 && stock <= 3;
                
                let stockBadge = `<span class="badge bg-success text-success bg-opacity-10 border border-success-subtle rounded-pill fw-medium px-2 py-1">${stock} und</span>`;
                if (isZero) {
                    stockBadge = `<span class="badge bg-danger text-danger bg-opacity-10 border border-danger-subtle rounded-pill fw-medium px-2 py-1">Agotado (0)</span>`;
                } else if (isLow) {
                    stockBadge = `<span class="badge bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle rounded-pill fw-medium px-2 py-1">Bajo (${stock})</span>`;
                }

                html += `
                    <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);">
                        <td class="py-3 ps-4 text-truncate" style="color: var(--text-main); font-weight: var(--weight-medium); max-width: 300px;" title="${item.nombre}">${item.nombre}</td>
                        <td class="py-3">${item.sku || ''}</td>
                        <td class="py-3 text-end">${stockBadge}</td>
                        <td class="py-3 text-end text-muted">${formatMoney(item.costo_promedio)}</td>
                        <td class="py-3 text-end pe-4" style="font-weight: ${isZero ? 'normal' : '600'}; color: ${isZero ? '#94a3b8' : 'var(--text-main)'};">${formatMoney(item.valor_total)}</td>
                    </tr>
                `;
            });
            container.innerHTML = html;
        }

        // Actualizar KPIs
        const kpiValorTotal = this.element.querySelector('#kpi-valor-total');
        const kpiUnidades = this.element.querySelector('#kpi-unidades-fisicas');
        const kpiBajo = this.element.querySelector('#kpi-stock-bajo');
        
        const formatKpiMoney = (val) => '$' + (val || 0).toLocaleString('es-CO', {maximumFractionDigits: 0});
        
        if (kpiValorTotal) kpiValorTotal.textContent = formatKpiMoney(this.state.granTotal).replace('$ ', '$');
        if (kpiUnidades) kpiUnidades.textContent = this.state.undFisicas.toLocaleString('es-CO');
        if (kpiBajo) kpiBajo.textContent = this.state.stockBajo.toLocaleString('es-CO');

        // Inyectar Gran Total (fijo de toda la empresa)
        const formatFooterMoney = (val) => '$' + (val || 0).toLocaleString('es-CO', {maximumFractionDigits: 0});
        this.element.querySelector('#tfoot-gran-total').textContent = formatFooterMoney(this.state.granTotal);

        // Actualizar UI de paginación
        const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
        const endIndex = Math.min(startIndex + this.state.itemsPerPage, totalItems);

        this.element.querySelector('#current-page').textContent = this.state.currentPage;
        this.element.querySelector('#total-pages').textContent = totalPages;
        this.element.querySelector('#showing-count').textContent = totalItems > 0 ? `${startIndex + 1}-${endIndex} de ${totalItems}` : '0 de 0';
        
        this.element.querySelector('#btn-prev-page').disabled = (this.state.currentPage === 1);
        this.element.querySelector('#btn-next-page').disabled = (this.state.currentPage === totalPages);
    },

    // --------------------------------------------------------
    // GENERADOR CSV NATIVO (Basado en datos de Postgres)
    // --------------------------------------------------------
    async exportarCSV() {
        const btn = this.element.querySelector('#btn-descargar-csv');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Descargando...';
        btn.disabled = true;

        const dataToExport = await this.fetchRPC(true);
        
        if (!dataToExport || dataToExport.length === 0) {
            alert('No hay datos para exportar.');
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        // UTF-8 BOM (\uFEFF) fuerza a Excel a reconocer tildes y caracteres especiales
        // 1. Separador de columnas ajustado a punto y coma (;) para LatAm
        let csvContent = "Ítem;Referencia;Cantidad;Costo promedio;Total\n";

        // 2. Función helper para que Excel lea los números como números puros:
        // Toma un número, fija 2 decimales, y cambia el punto (.) por coma (,) decimal.
        const formatDecimalLatam = (num) => Number(num || 0).toFixed(2).replace('.', ',');

        let totalExportado = 0;

        // Exportamos TODOS los filtrados devueltos por el RPC
        dataToExport.forEach(item => {
            // Escapar comillas dobles internamente y envolver todo el texto en comillas
            const escapeCSV = (str) => `"${String(str).replace(/"/g, '""')}"`;
            
            const row = [
                escapeCSV(item.nombre),
                escapeCSV(item.sku || ''),
                item.stock_total,
                formatDecimalLatam(item.costo_promedio),
                formatDecimalLatam(item.valor_total)
            ];
            
            totalExportado += Number(item.valor_total);
            csvContent += row.join(";") + "\n";
        });

        csvContent += `\n"Total Valorizado";"";"";"";"${formatDecimalLatam(totalExportado)}"\n`;

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `Valor_Inventario_${getLocalDate()}.csv`);
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};
