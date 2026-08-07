import DB, { getLocalDate } from '../../core/db.js';

export const ValorizacionModule = {
    state: {
        productos: [],
        datosCalculados: [],
        filtrados: [],
        currentPage: 1,
        itemsPerPage: 10,
        searchQuery: '',
        granTotal: 0
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        const hoy = getLocalDate();
        
        element.innerHTML = `
            <div class="module-container p-4" style="max-width: 1200px; margin: 0 auto;">
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
                        <button id="btn-descargar-csv" class="btn text-white" style="background-color: #2cbfb7; font-weight: var(--weight-medium); font-size: 14px;">
                            <i class="bi bi-download me-1"></i> Descargar
                        </button>
                    </div>
                </div>

                <!-- DATA TABLE CARD -->
                <div class="card border-0" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                    
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
        await this.cargarYCalcularDatos();
        this.renderTabla();
    },

    bindEvents() {
        const el = this.element;

        el.querySelector('#search-valorizacion')?.addEventListener('input', (e) => {
            this.state.searchQuery = e.target.value.toLowerCase().trim();
            this.state.currentPage = 1;
            this.renderTabla();
        });

        el.querySelector('#items-per-page')?.addEventListener('change', (e) => {
            this.state.itemsPerPage = parseInt(e.target.value);
            this.state.currentPage = 1;
            this.renderTabla();
        });

        el.querySelector('#btn-prev-page')?.addEventListener('click', () => {
            if (this.state.currentPage > 1) {
                this.state.currentPage--;
                this.renderTabla();
            }
        });

        el.querySelector('#btn-next-page')?.addEventListener('click', () => {
            const totalPages = Math.ceil(this.state.filtrados.length / this.state.itemsPerPage) || 1;
            if (this.state.currentPage < totalPages) {
                this.state.currentPage++;
                this.renderTabla();
            }
        });

        el.querySelector('#btn-descargar-csv')?.addEventListener('click', () => {
            this.exportarCSV();
        });
    },

    // --------------------------------------------------------
    // MOTOR DE CÁLCULO GENERAL (Ocurre 1 sola vez al cargar)
    // --------------------------------------------------------
    async cargarYCalcularDatos() {
        const rawProductos = await DB.getAll('productos');
        const rawLotes = await DB.getAll('lotes_fifo');

        // Permitir mostrar productos activos e importados
        this.state.productos = rawProductos.filter(p => p.estado !== 'inactivo' && p.estado !== 'inactive');
        
        let granTotalAcumulado = 0;
        
        this.state.datosCalculados = this.state.productos.map(p => {
            const lotesProd = rawLotes.filter(l => l.productoId === p.id);
            
            // El trigger de base de datos ya garantiza que p.stock = SUM(lotes_fifo)
            const stockTotal = parseFloat(p.stock) || 0;
            
            // Calcular costo usando solo los lotes positivos para no distorsionar el promedio
            const lotesPositivos = lotesProd.filter(l => l.cantidadActual > 0);
            const stockLotesPositivos = lotesPositivos.reduce((sum, l) => sum + l.cantidadActual, 0);
            const costoLotes = lotesPositivos.reduce((sum, l) => sum + (l.cantidadActual * (l.costoUnitario || 0)), 0);
            
            // Si el stock es 0, hace fallback al costo base para no mostrar $0 en promedio
            const costoPromedio = stockTotal > 0 ? 
                (stockLotesPositivos > 0 ? costoLotes / stockLotesPositivos : (parseFloat(p.costoBase) || 0)) 
                : (parseFloat(p.costoBase) || 0);
            
            const valorTotal = stockTotal * costoPromedio; 

            // REGLA: Stock negativo aporta $0 (excepto SKU 500x que son rollos de corte bajo demanda)
            const isRollo = p.sku && p.sku.startsWith('500');
            granTotalAcumulado += (stockTotal < 0 && !isRollo) ? 0 : valorTotal;

            return {
                id: p.id,
                sku: p.sku || '',
                nombre: p.nombre || 'Sin nombre',
                stockTotal,
                costoPromedio,
                valorTotal
            };
        });

        // Este es el valor consolidado de toda la empresa
        this.state.granTotal = granTotalAcumulado;
    },

    renderTabla() {
        // 1. Filtrado dinámico
        const query = this.state.searchQuery;
        this.state.filtrados = this.state.datosCalculados.filter(item => 
            item.nombre.toLowerCase().includes(query) || 
            item.sku.toLowerCase().includes(query)
        );

        // 2. Paginación
        const totalItems = this.state.filtrados.length;
        const totalPages = Math.ceil(totalItems / this.state.itemsPerPage) || 1;
        
        if (this.state.currentPage > totalPages) {
            this.state.currentPage = totalPages;
        }

        const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
        const endIndex = Math.min(startIndex + this.state.itemsPerPage, totalItems);
        const paginaActual = this.state.filtrados.slice(startIndex, endIndex);

        // 3. Renderizado de Grilla
        const container = this.element.querySelector('#tbody-valorizacion');
        if (paginaActual.length === 0) {
            container.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">No se encontraron productos.</td></tr>`;
        } else {
            const formatMoney = (val) => '$' + val.toLocaleString('es-CO', {minimumFractionDigits: 2});
            let html = '';
            
            paginaActual.forEach(item => {
                const isZero = item.stockTotal === 0;
                html += `
                    <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);">
                        <td class="py-3 ps-4 text-truncate" style="color: var(--text-main); font-weight: var(--weight-medium); max-width: 300px;" title="${item.nombre}">${item.nombre}</td>
                        <td class="py-3">${item.sku}</td>
                        <td class="py-3 text-end" style="${isZero ? 'color: #94a3b8;' : ''}">${item.stockTotal} und</td>
                        <td class="py-3 text-end text-muted">${formatMoney(item.costoPromedio)}</td>
                        <td class="py-3 text-end pe-4" style="font-weight: ${isZero ? 'normal' : '600'}; color: ${isZero ? '#94a3b8' : 'var(--text-main)'};">${formatMoney(item.valorTotal)}</td>
                    </tr>
                `;
            });
            container.innerHTML = html;
        }

        // 4. Inyectar Gran Total (fijo de toda la empresa)
        const formatMoneyTotal = (val) => '$' + val.toLocaleString('es-CO', {minimumFractionDigits: 2});
        this.element.querySelector('#tfoot-gran-total').textContent = formatMoneyTotal(this.state.granTotal);

        // 5. Actualizar UI de paginación
        this.element.querySelector('#current-page').textContent = this.state.currentPage;
        this.element.querySelector('#total-pages').textContent = totalPages;
        this.element.querySelector('#showing-count').textContent = totalItems > 0 ? `${startIndex + 1}-${endIndex} de ${totalItems}` : '0 de 0';
        
        this.element.querySelector('#btn-prev-page').disabled = (this.state.currentPage === 1);
        this.element.querySelector('#btn-next-page').disabled = (this.state.currentPage === totalPages);
    },

    // --------------------------------------------------------
    // GENERADOR CSV NATIVO (Basado en datos filtrados)
    // --------------------------------------------------------
    exportarCSV() {
        if (this.state.filtrados.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }

        // UTF-8 BOM (\uFEFF) fuerza a Excel a reconocer tildes y caracteres especiales
        // 1. Separador de columnas ajustado a punto y coma (;) para LatAm
        let csvContent = "Ítem;Referencia;Cantidad;Costo promedio;Total\n";

        // 2. Función helper para que Excel lea los números como números puros:
        // Toma un número, fija 2 decimales, y cambia el punto (.) por coma (,) decimal.
        const formatDecimalLatam = (num) => Number(num || 0).toFixed(2).replace('.', ',');

        // Exportamos TODOS los filtrados, ignorando la página actual
        this.state.filtrados.forEach(item => {
            // Escapar comillas dobles internamente y envolver todo el texto en comillas
            const escapeCSV = (str) => `"${String(str).replace(/"/g, '""')}"`;
            
            const row = [
                escapeCSV(item.nombre),
                escapeCSV(item.sku),
                item.stockTotal,
                formatDecimalLatam(item.costoPromedio),
                formatDecimalLatam(item.valorTotal)
            ];
            
            csvContent += row.join(";") + "\n";
        });

        // Excepción de sumatoria CSV para SKU serie 500
        const totalExportado = this.state.filtrados.reduce((sum, item) => {
            const isRollo = item.sku && item.sku.startsWith('500');
            return sum + ((item.stockTotal < 0 && !isRollo) ? 0 : item.valorTotal);
        }, 0);
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
    }
};
