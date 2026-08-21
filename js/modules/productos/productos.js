// js/modules/productos.js
// Módulo de Gestión de Productos e Inventarios (Lotes FIFO) - Hoja Completa
import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { renderTablaFacturas } from '../../shared/tablaFacturas.js';
import { calcularEstadoFactura } from '../../shared/carteraUtils.js';
import { escapeHtml } from '../../shared/formatters.js';
import { ExportManager } from '../../shared/crud.js';

export const ProductosModule = {
    currentPage: 1,
    itemsPerPage: 10,
    searchQuery: '',
    filterCriteria: 'todos',
    sortColumn: 'nombre',
    sortDirection: 'asc',

    async init(element) {
        if (!element) return;
        this.renderList(element);
    },

    async renderList(element) {
        element.innerHTML = `
            <div class="dash-layout p-4">
                <!-- TOP BAR -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div>
                        <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Ítems de venta</h2>
                        <p class="text-muted mb-0" style="font-size: 14px;">Gestiona tus productos, su costo promedio y el inventario disponible.</p>
                    </div>
                    <div class="d-flex flex-wrap gap-2 w-100 w-md-auto justify-content-md-end">
                        <button id="btn-refresh-list" class="btn btn-light bg-white border" style="flex: 1 1 auto; font-weight: var(--weight-medium); font-size: 14px; color: var(--text-body);">
                            <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
                        </button>
                        <button id="btn-export-list" class="btn btn-light bg-white border" style="flex: 1 1 auto; font-weight: var(--weight-medium); font-size: 14px; color: var(--text-body);">
                            <i class="bi bi-download me-1"></i> Exportar
                        </button>
                        <button id="btn-nuevo-producto" class="btn btn-primary-action" style="flex: 1 1 auto;">
                            <i class="bi bi-plus-lg me-1"></i> Nuevo producto
                        </button>
                    </div>
                </div>

                <!-- DATA TABLE CARD -->
                <div class="ds-table-container">
                    
                    <!-- FILTERS -->
                    <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center">
                        <div class="ds-search-container" style="width: 250px;">
                            <i class="bi bi-search ds-search-icon"></i>
                            <input type="text" id="searchProductos" class="ds-search-input" placeholder="Buscar por nombre, SKU..." value="${this.searchQuery}" autocomplete="off">
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-link text-decoration-none text-muted p-0 dropdown-toggle" data-bs-toggle="dropdown" style="font-size: 14px;">
                                <i class="bi bi-funnel me-1"></i> Filtrar <span id="lbl-filtro-actual" style="font-size: 12px; font-weight: 500; color: #2cbfb7;"></span>
                            </button>
                            <ul class="dropdown-menu shadow border-0" style="font-size: 13px;">
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="todos">Todos los campos</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="nombre">Por Nombre</a></li>
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="sku">Por SKU</a></li>
                            </ul>
                        </div>
                    </div>

                    <!-- GRID -->
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0">
                            <thead style="border-bottom: 1px solid var(--border-color);" id="grid-thead">
                                <!-- Llenado dinámicamente -->
                            </thead>
                            <tbody id="grid-tbody">
                                <!-- Llenado dinámicamente -->
                            </tbody>
                        </table>
                    </div>

                    <!-- PAGINATION FOOTER -->
                    <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center" style="border-radius: 0 0 8px 8px;" id="grid-pagination">
                    </div>
                </div>
                
                <div id="productos-view-container" class="view-container mt-4"></div>
            </div>
        `;

        this.bindStaticEvents(element);

        const hashParts = window.location.hash.split('/');
        const action = hashParts[3];
        const routeId = hashParts[4];

        if (action === 'ver' && routeId) {
            await this.renderDetalle(element, routeId);
        } else {
            await this.renderGrid(element);
        }
    },

    bindStaticEvents(element) {
        element.querySelector('#btn-nuevo-producto')?.addEventListener('click', () => this.renderForm(element));
        
        let debounceTimer;
        const searchInput = element.querySelector('#searchProductos');
        const clearBtn = element.querySelector('#clearSearchBtnProductos');

        searchInput?.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            if (clearBtn) clearBtn.style.display = e.target.value.trim() ? '' : 'none';
            debounceTimer = setTimeout(() => {
                this.searchQuery = e.target.value.trim();
                this.currentPage = 1;
                this.renderGrid(element);
            }, 400);
        });

        clearBtn?.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            clearBtn.style.display = 'none';
            this.searchQuery = '';
            this.currentPage = 1;
            this.renderGrid(element);
        });

        element.querySelectorAll('.filter-opt').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.preventDefault();
                this.filterCriteria = e.target.dataset.criteria;
                const lbl = element.querySelector('#lbl-filtro-actual');
                if (lbl) {
                    lbl.textContent = this.filterCriteria === 'todos' ? '' : `(${e.target.textContent})`;
                }
                this.currentPage = 1;
                this.renderGrid(element);
            });
        });

        element.querySelector('#btn-refresh-list')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`;
            
            await DB.refreshCache('lotes_fifo');
            await this.renderGrid(element);
            
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        });

        element.querySelector('#btn-export-list')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`;
            
            try {
                let allProducts = [];
                let currentPage = 1;
                const limit = 500;
                let hasMore = true;
                
                while (hasMore) {
                    const { data: pageResult, error } = await supabase.rpc('get_productos_page', {
                        p_page: currentPage,
                        p_limit: limit,
                        p_sort_column: this.sortColumn,
                        p_sort_direction: this.sortDirection,
                        p_search_query: this.searchQuery,
                        p_filter_criteria: this.filterCriteria
                    });
                    
                    if (error) throw error;
                    
                    const productos = pageResult?.[0]?.data || [];
                    const totalCount = parseInt(pageResult?.[0]?.total_count) || 0;
                    
                    if (productos.length > 0) {
                        allProducts = allProducts.concat(productos);
                    }
                    
                    if (allProducts.length >= totalCount || productos.length === 0) {
                        hasMore = false;
                    } else {
                        currentPage++;
                    }
                }
                
                btn.innerHTML = originalHtml;
                ExportManager.exportDataToExcel(allProducts, 'Productos', null, btn);
            } catch (err) {
                console.error("Error al recolectar productos para exportar:", err);
                alert("Error al exportar los productos.");
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        });
    },

    async renderGrid(element) {
        const gridCard = element.querySelector('.dash-table-container');
        if (gridCard) gridCard.classList.remove('d-none');
        
        const viewContainer = element.querySelector('#productos-view-container');
        if (viewContainer) viewContainer.innerHTML = '';

        const thead = element.querySelector('#grid-thead');
        const tbody = element.querySelector('#grid-tbody');
        const pagination = element.querySelector('#grid-pagination');
        if (!tbody) return;

        if (thead) {
            thead.innerHTML = `
                <tr class="ds-table-header">
                    <th class="py-2 fw-normal ps-4 cursor-pointer sort-col" data-col="sku" style="white-space: nowrap;">
                        SKU ${this.sortColumn === 'sku' ? (this.sortDirection === 'asc' ? '<i class="bi bi-arrow-up-short"></i>' : '<i class="bi bi-arrow-down-short"></i>') : ''}
                    </th>
                    <th class="py-2 fw-normal cursor-pointer sort-col" data-col="nombre" style="min-width: 200px;">
                        Nombre / Descripción ${this.sortColumn === 'nombre' ? (this.sortDirection === 'asc' ? '<i class="bi bi-arrow-up-short"></i>' : '<i class="bi bi-arrow-down-short"></i>') : ''}
                    </th>
                    <th class="py-2 fw-normal text-end" style="white-space: nowrap; min-width: 120px;">Precio Venta</th>
                    <th class="py-2 fw-normal text-end" style="white-space: nowrap; min-width: 100px;">Stock Total</th>
                    <th class="py-2 fw-normal text-end" style="white-space: nowrap; min-width: 150px;">Costo Promedio Real</th>
                    <th class="py-2 fw-normal text-end pe-4" style="width: 80px; white-space: nowrap;"></th>
                </tr>
            `;
            
            thead.querySelectorAll('.sort-col').forEach(th => {
                th.addEventListener('click', () => {
                    const col = th.dataset.col;
                    if (this.sortColumn === col) {
                        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        this.sortColumn = col;
                        this.sortDirection = 'asc';
                    }
                    this.renderGrid(element);
                });
            });
        }

        const { data: pageResult, error } = await supabase.rpc('get_productos_page', {
            p_page: this.currentPage,
            p_limit: this.itemsPerPage,
            p_sort_column: this.sortColumn,
            p_sort_direction: this.sortDirection,
            p_search_query: this.searchQuery,
            p_filter_criteria: this.filterCriteria
        });

        if (error) {
            console.error("Error al cargar productos:", error);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-danger">Error al cargar productos</td></tr>`;
            return;
        }

        const productos = pageResult?.[0]?.data || [];
        const totalItems = parseInt(pageResult?.[0]?.total_count) || 0;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;

        if (this.currentPage > totalPages && totalPages > 0) {
            this.currentPage = totalPages;
            return this.renderGrid(element);
        }

        if (productos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">No se encontraron productos.</td></tr>`;
            if (pagination) pagination.innerHTML = '';
            return;
        }

        const productIds = productos.map(p => p.id);
        let lotes = [];
        if (productIds.length > 0) {
            const { data } = await supabase.from('lotes_fifo').select('*').in('producto_id', productIds).gt('cantidad_actual', 0);
            if (data) lotes = data.map(l => DB._mapToFrontend('lotes_fifo', l));
        }

        let html = '';
        productos.forEach(p => {
            const lotesProd = lotes.filter(l => String(l.productoId) === String(p.id) && l.cantidadActual > 0);
            
            const stockBase = parseFloat(p.stock) || 0;
            const stockLotes = lotesProd.reduce((sum, l) => sum + l.cantidadActual, 0);
            const stockTotal = lotesProd.length > 0 ? stockLotes : stockBase;

            const costoLotes = lotesProd.reduce((sum, l) => sum + (l.cantidadActual * (l.costoUnitario || 0)), 0);
            const costoPromedio = stockTotal > 0 ? 
                (stockLotes > 0 ? costoLotes / stockLotes : (p.costoBase || 0)) 
                : (p.costoBase || 0);

            const isLowStock = stockTotal <= (p.stockMinimo || 0);
            
            html += `
                <tr data-id="${p.id}" style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);" class="row-clickable">
                    <td class="py-2 ps-4 td-sku" style="color: var(--text-main); font-weight: var(--weight-medium);">${p.sku || ''}</td>
                    <td class="py-2 text-truncate td-nombre" style="max-width: 300px;">${escapeHtml(p.nombre || '')}</td>
                    <td class="py-2 text-end">$${(p.precioVenta || 0).toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                    <td class="py-2 text-end">
                        <span style="${isLowStock ? 'color: #ef4444; background-color: #fee2e2;' : 'color: #15803d; background-color: #dcfce7;'} padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: var(--weight-medium);" ${isLowStock ? 'title="¡Alerta: Stock por debajo del mínimo!"' : ''}>
                            ${isLowStock ? '<i class="bi bi-exclamation-triangle-fill me-1"></i>' : ''}${stockTotal} und
                        </span>
                    </td>
                    <td class="py-2 text-end text-muted">$${(costoPromedio || 0).toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                    <td class="py-2 text-end pe-4">
                        <button class="btn btn-link text-muted p-0 me-2 btn-menu-row btn-editar" data-id="${p.id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-link text-muted p-0 btn-menu-row btn-eliminar" data-id="${p.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        if (pagination) {
            const from = (this.currentPage - 1) * this.itemsPerPage;
            pagination.innerHTML = `
                <div class="d-flex align-items-center gap-3" style="font-size: 13px; color: var(--text-body);">
                    <span>Resultados por página:</span>
                    <select class="form-select form-select-sm text-muted select-per-page" style="width: 70px;">
                        <option value="10" ${this.itemsPerPage===10?'selected':''}>10</option>
                        <option value="20" ${this.itemsPerPage===20?'selected':''}>20</option>
                        <option value="50" ${this.itemsPerPage===50?'selected':''}>50</option>
                    </select>
                    <span class="text-muted border-start ps-3">${totalItems > 0 ? from + 1 : 0}-${Math.min(from + this.itemsPerPage, totalItems)} de ${totalItems}</span>
                </div>
                <div class="d-flex align-items-center gap-2" style="font-size: 13px; color: var(--text-body);">
                    <span>Página</span>
                    <input type="number" class="form-control form-control-sm text-center text-muted input-page" value="${this.currentPage}" min="1" max="${totalPages}" style="width: 50px;">
                    <span>de ${totalPages}</span>
                    <div class="ms-2">
                        <button class="btn btn-link text-muted p-0 me-1 btn-prev-page" ${this.currentPage === 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
                        <button class="btn btn-link text-muted p-0 btn-next-page" ${this.currentPage === totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>
                    </div>
                </div>
            `;
        }

        this.bindDynamicEvents(element, totalPages);
    },

    bindDynamicEvents(element, totalPages) {
        const tbody = element.querySelector('#grid-tbody');
        if (tbody) {
            tbody.querySelectorAll('.row-clickable').forEach(row => {
                row.addEventListener('click', (e) => {
                    if (!e.target.closest('button')) {
                        window.location.hash = `#/inventario/items/ver/${row.dataset.id}`;
                    }
                });
            });

            tbody.querySelectorAll('.btn-editar').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.renderForm(element, e.currentTarget.dataset.id);
                });
            });

            tbody.querySelectorAll('.btn-eliminar').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm('¿Estás seguro de desactivar este producto? Ya no aparecerá en el listado ni podrá venderse.')) {
                        await DB.save('productos', { id: e.currentTarget.dataset.id, estado: 'inactivo' });
                        this.renderGrid(element);
                    }
                });
            });
        }

        const pagination = element.querySelector('#grid-pagination');
        if (pagination) {
            pagination.querySelector('.select-per-page')?.addEventListener('change', (e) => {
                this.itemsPerPage = parseInt(e.target.value);
                this.currentPage = 1;
                this.renderGrid(element);
            });
            pagination.querySelector('.input-page')?.addEventListener('change', (e) => {
                let val = parseInt(e.target.value) || 1;
                this.currentPage = val;
                this.renderGrid(element);
            });
            pagination.querySelector('.btn-prev-page')?.addEventListener('click', () => {
                if (this.currentPage > 1) { this.currentPage--; this.renderGrid(element); }
            });
            pagination.querySelector('.btn-next-page')?.addEventListener('click', () => {
                if (this.currentPage < totalPages) { this.currentPage++; this.renderGrid(element); }
            });
        }
    },

    async renderForm(element, id = null) {
        const container = element.querySelector('#productos-view-container');
        if (!container) return;

        let producto = { sku: '', nombre: '', precioVenta: 0, costoBase: 0, stockMinimo: 5 };
        
        if (id) {
            producto = await DB.get('productos', id) || producto;
        }

        container.innerHTML = `
            <div class="card border-0 shadow-sm max-width-md mx-auto" style="max-width: 600px;">
                <div class="card-body p-4">
                    <h4 class="card-title fw-bold mb-3 text-dark">${id ? 'Editar Producto' : 'Crear Nuevo Producto'}</h4>
                    <div class="alert alert-warning py-2 mb-4 d-flex align-items-center" style="font-size: 0.9rem;">
                        <i class="bi bi-info-circle-fill me-2"></i>
                        <span><strong>Nota:</strong> Los datos maestros (nombre, precio, SKU) se sincronizan desde Alegra.</span>
                    </div>
                    <form id="form-producto-data">
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-muted small">SKU / Código Único *</label>
                            <input type="text" id="form-sku" class="form-control" value="${producto.sku}" ${id ? 'disabled' : 'required'}>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-muted small">Nombre del Producto *</label>
                            <input type="text" id="form-nombre" class="form-control" value="${producto.nombre}" required>
                        </div>
                        <div class="row mb-3 g-3">
                            <div class="col-12 col-sm-6 col-md-4">
                                <label class="form-label fw-semibold text-muted small">Cantidad Inicial *</label>
                                <input type="text" id="form-cantidad-inicial" class="form-control" value="0,00" ${id ? 'disabled' : 'required'}>
                            </div>
                            <div class="col-12 col-sm-6 col-md-4">
                                <label class="form-label fw-semibold text-muted small">Costo Inicial ($) *</label>
                                <input type="text" id="form-costo" class="form-control" value="${producto.costoBase ? Number(producto.costoBase).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}" ${id ? 'disabled' : 'required'}>
                            </div>
                            <div class="col-12 col-sm-6 col-md-4">
                                <label class="form-label fw-semibold text-muted small">Precio Base ($) *</label>
                                <input type="text" id="form-precio" class="form-control" value="${producto.precioVenta ? Number(producto.precioVenta).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}" required>
                            </div>
                        </div>
                        <div class="row mb-3 g-3">
                            <div class="col-12 col-sm-6 col-md-4">
                                <label class="form-label fw-semibold text-muted small">Impuesto (%)</label>
                                <input type="text" id="form-impuesto" class="form-control" value="${producto.impuesto ? Number(producto.impuesto).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}">
                            </div>
                            <div class="col-12 col-sm-6 col-md-4">
                                <label class="form-label fw-semibold text-muted small">Precio Total ($)</label>
                                <input type="text" id="form-precio-total" class="form-control bg-light" value="0,00" readonly disabled>
                            </div>
                            <div class="col-12 col-sm-6 col-md-4">
                                <label class="form-label fw-semibold text-muted small">Stock Mínimo</label>
                                <input type="text" id="form-minimo" class="form-control" value="${producto.stockMinimo ? Number(producto.stockMinimo).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '5,00'}">
                            </div>
                        </div>
                        <div class="d-flex justify-content-end gap-2">
                            <button type="button" id="btn-cancelar-producto" class="btn btn-light px-4">Cancelar</button>
                            <button type="submit" class="btn btn-primary px-4">Guardar Producto</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        import('../../shared/formatters.js').then(fmt => {
            ['#form-precio', '#form-costo', '#form-cantidad-inicial', '#form-impuesto', '#form-minimo'].forEach(selector => {
                const el = element.querySelector(selector);
                if (el) fmt.applyCurrencyFormatting(el);
            });
            
            // Cálculo en vivo del Precio Total
            const calcTotal = () => {
                const pBase = fmt.parseCurrencyValue(element.querySelector('#form-precio').value) || 0;
                const imp = fmt.parseCurrencyValue(element.querySelector('#form-impuesto').value) || 0;
                const total = pBase * (1 + (imp / 100));
                element.querySelector('#form-precio-total').value = total.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            };
            
            element.querySelector('#form-precio').addEventListener('input', calcTotal);
            element.querySelector('#form-impuesto').addEventListener('input', calcTotal);
            calcTotal(); // Cálculo inicial
        });

        element.querySelector('#btn-cancelar-producto')?.addEventListener('click', () => this.renderGrid(element));
        element.querySelector('#form-producto-data')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const prodId = id || 'prod_' + Date.now();
            let pVenta = 0, cBase = 0, cInicial = 0, imp = 0, sMin = 0;
            try {
                const fmt = await import('../../shared/formatters.js');
                pVenta = fmt.parseCurrencyValue(element.querySelector('#form-precio').value);
                cBase = fmt.parseCurrencyValue(element.querySelector('#form-costo').value);
                cInicial = fmt.parseCurrencyValue(element.querySelector('#form-cantidad-inicial').value);
                imp = fmt.parseCurrencyValue(element.querySelector('#form-impuesto').value);
                sMin = fmt.parseCurrencyValue(element.querySelector('#form-minimo').value);
            } catch(e) {
                pVenta = parseFloat(element.querySelector('#form-precio').value) || 0;
                cBase = parseFloat(element.querySelector('#form-costo').value) || 0;
                cInicial = parseFloat(element.querySelector('#form-cantidad-inicial').value) || 0;
                imp = parseFloat(element.querySelector('#form-impuesto').value) || 0;
                sMin = parseFloat(element.querySelector('#form-minimo').value) || 0;
            }

            const nuevoProducto = {
                id: prodId,
                sku: element.querySelector('#form-sku').value,
                nombre: element.querySelector('#form-nombre').value,
                precioVenta: pVenta,
                costoBase: cBase,
                impuesto: imp,
                stockMinimo: sMin
            };

            const prodGuardado = await DB.save('productos', nuevoProducto);

            // Si es un producto nuevo, inicializar un lote FIFO vacío con cantidad cero
            if (!id) {
                const loteInicial = {
                    id: 'lote_' + prodGuardado.id + '_init',
                    productoId: prodGuardado.id,
                    cantidadInicial: cInicial,
                    cantidadActual: cInicial,
                    costoUnitario: nuevoProducto.costoBase,
                    fechaIngreso: getLocalDate(),
                    referencia: 'Inventario Inicial',
                    origen_movimiento: 'producto_nuevo:' + prodGuardado.sku
                };
                await DB.save('lotes_fifo', loteInicial);
            }

            this.renderGrid(element);
        });
    },

    async renderDetalle(element, id) {
        const gridCard = element.querySelector('.dash-table-container');
        if (gridCard) gridCard.classList.add('d-none');

        const container = element.querySelector('#productos-view-container');
        if (!container) return;

        const producto = await DB.get('productos', id);
        if (!producto) return;

        const { data: lotesData } = await supabase.from('lotes_fifo').select('*').eq('producto_id', id);
        const lotesProd = lotesData ? lotesData.map(l => DB._mapToFrontend('lotes_fifo', l)) : [];

        // Ordenar lotes por fecha de ingreso ascendente para visualización FIFO
        lotesProd.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso));

        let lotesHtml = '';
        let stockTotalDisponible = lotesProd.length > 0 
            ? lotesProd.reduce((sum, l) => sum + (parseFloat(l.cantidadActual) || 0), 0)
            : (parseFloat(producto.stock) || 0);

        lotesProd.forEach(l => {
            lotesHtml += `
                <tr class="${l.cantidadActual === 0 ? 'table-light opacity-50' : ''}">
                    <td>${l.fechaIngreso}</td>
                    <td>${l.referencia}</td>
                    <td class="text-end">$${l.costoUnitario.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td class="text-end">${l.cantidadInicial} und</td>
                    <td class="text-end">
                        <strong class="${l.cantidadActual === 0 ? 'text-muted' : 'text-success'}">${l.cantidadActual} und</strong>
                    </td>
                </tr>
            `;
        });


        let facturasAsociadas = [];
        let contactosMap = {};
        try {
            const { data: detalles } = await supabase.from('factura_detalles').select('factura_id').eq('producto_id', id);
            if (detalles && detalles.length > 0) {
                const facturaIds = [...new Set(detalles.map(d => d.factura_id))];
                const { data: facturas } = await supabase.from('facturas').select('*').in('id', facturaIds).eq('tipo', 'venta');
                
                if (facturas && facturas.length > 0) {
                    const cliIds = [...new Set(facturas.map(f => f.clienteId || f.contacto_id || f.contactoId).filter(Boolean))];
                    if (cliIds.length > 0) {
                        const { data: contactos } = await supabase.from('contactos').select('id, nombre').in('id', cliIds);
                        contactos?.forEach(c => contactosMap[c.id] = c.nombre);
                    }

                    const { data: transaccionesRaw } = await supabase.from('pagos_ingresos').select('*').in('factura_id', facturas.map(f => f.id));
                    const transMapeadas = (transaccionesRaw || []).map(t => ({...t, tipo: t.tipo === 'in' ? 'ingreso' : 'egreso'}));

                    facturasAsociadas = facturas.map(f => {
                        const tr = transMapeadas.filter(t => t.factura_id === f.id);
                        const { estado, saldo, totalPagado } = calcularEstadoFactura(f, tr);
                        return {
                            ...f,
                            estado,
                            saldoPendiente: saldo,
                            totalPagado
                        };
                    });
                    
                    facturasAsociadas.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
                }
            }
        } catch (e) {
            console.error("Error al cargar facturas asociadas:", e);
        }

        container.innerHTML = `


            <div class="row g-4">
                <!-- Panel de Detalles del Producto & Carga de Lotes -->
                <div class="col-lg-4">
                    <div class="card border-0 shadow-sm mb-4">
                        <div class="card-body p-4">
                            <h5 class="fw-bold mb-3">Detalle Técnico</h5>
                            <ul class="list-unstyled mb-0">
                                <li class="mb-3 d-flex align-items-center">
                                    <strong>SKU:</strong> 
                                    <span class="badge bg-white text-danger border border-danger border-2 px-3 py-2 ms-2 fs-6 shadow-sm rounded">
                                        ${producto.sku}
                                    </span>
                                </li>
                                <li class="mb-2"><strong>Descripción:</strong> ${escapeHtml(producto.nombre)}</li>
                                <li class="mb-2"><strong>Precio Venta:</strong> $${producto.precioVenta.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</li>
                                <li><strong>Costo Base Fijo:</strong> $${producto.costoBase.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</li>
                            </ul>
                        </div>
                    </div>

                    <!-- Formulario de Ajuste / Carga de Lotes -->
                    <div class="card border-0 shadow-sm">
                        <div class="card-body p-4">
                            <h5 class="fw-bold mb-2"><i class="bi bi-box-arrow-in-down text-primary me-2"></i>Registrar Nuevo Lote</h5>
                            <p class="text-muted small mb-3">Nota: El inventario local puede ser sobreescrito si Alegra actualiza el stock maestro.</p>
                            <div id="lote-alert" class="alert alert-success d-none mb-3 py-2" style="font-size: 0.9rem;"></div>
                            
                            <form id="form-nuevo-lote">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Cantidad Ingresada *</label>
                                    <input type="number" id="lote-cantidad" class="form-control" required min="1">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Costo Unitario ($) *</label>
                                    <input type="text" id="lote-costo" class="form-control" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Fecha de Ingreso *</label>
                                    <input type="date" id="lote-fecha" class="form-control" required value="${getLocalDate()}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Referencia / Documento</label>
                                    <input type="text" id="lote-ref" class="form-control" placeholder="Ej. Compra 123 o Ajuste">
                                </div>
                                <button type="submit" class="btn btn-primary w-100 mt-2">
                                    <i class="bi bi-plus-lg me-1"></i>Agregar Lote
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- Tabla de Lotes Históricos (FIFO) -->
                <div class="col-lg-8">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body p-4">
                            <div class="d-flex justify-content-between align-items-center mb-4">
                                <h5 class="fw-bold mb-0">Capas de Inventario (Lotes FIFO)</h5>
                                <button id="btn-volver-prod" class="btn btn-sm btn-outline-secondary">
                                    <i class="bi bi-arrow-left me-1"></i>Volver al Listado
                                </button>
                            </div>
                            
                            <!-- NUEVO BANNER STOCK TOTAL -->
                            <div class="alert alert-info d-flex align-items-center fw-bold fs-5 mb-4 shadow-sm" style="border-left: 5px solid #0dcaf0; background-color: #f8ffff;">
                                <i class="bi bi-box-seam me-3 fs-3"></i>
                                Stock Total Disponible: ${stockTotalDisponible} unidades
                            </div>

                            <div class="table-responsive">
                                <table class="table align-middle">
                                    <thead class="table-light text-muted uppercase font-monospace" style="font-size: 0.85rem;">
                                        <tr>
                                            <th>Fecha Ingreso</th>
                                            <th>Referencia</th>
                                            <th class="text-end">Costo Unitario</th>
                                            <th class="text-end">Cantidad Inicial</th>
                                            <th class="text-end">Cantidad Disponible</th>
                                        </tr>
                                    </thead>
                                    <tbody id="tbody-lotes-fifo">
                                        ${lotesHtml || '<tr><td colspan="5" class="text-center py-4 text-muted">No hay lotes para este producto.</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                ${facturasAsociadas.length > 0 ? `
                <div class="col-lg-12">
                    <div class="card border-0 mb-4 shadow-sm" style="border-radius: 8px;">
                        <div class="card-header bg-white border-bottom p-3">
                            <h5 class="fw-bold mb-0" style="color: var(--text-main); font-size: 15px;">
                                <i class="bi bi-receipt me-2 text-muted"></i>Facturas de Venta que incluyen este ítem
                            </h5>
                        </div>
                        ${renderTablaFacturas(facturasAsociadas, contactosMap, 'fecha', 'desc', { hash: `#/inventario/items/ver/${id}`, label: `Volver al Producto (${producto.nombre})` })}
                    </div>
                </div>` : ''}
            </div>
        `;

        import('../../shared/formatters.js').then(fmt => {
            fmt.applyCurrencyFormatting(element.querySelector('#lote-costo'));
        });

        element.querySelector('#btn-volver-prod')?.addEventListener('click', () => this.renderGrid(element));
        
        // Manejador del submit de nuevo lote
        element.querySelector('#form-nuevo-lote')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alertEl = element.querySelector('#lote-alert');
            
            const qty = parseInt(element.querySelector('#lote-cantidad').value) || 0;
            
            let lCosto = 0;
            try {
                const fmt = await import('../../shared/formatters.js');
                lCosto = fmt.parseCurrencyValue(element.querySelector('#lote-costo').value);
            } catch(e) {
                lCosto = parseFloat(element.querySelector('#lote-costo').value) || 0;
            }

            const nuevoLote = {
                id: 'lote_' + Date.now(),
                productoId: id,
                cantidadInicial: qty,
                cantidadActual: qty,
                costoUnitario: lCosto,
                fechaIngreso: element.querySelector('#lote-fecha').value,
                referencia: element.querySelector('#lote-ref').value.trim(),
                origen_movimiento: 'ingreso_manual:' + producto.sku
            };

            await DB.save('lotes_fifo', nuevoLote);

            // Mostrar mensaje de éxito en pantalla sin usar alerts nativos
            if (alertEl) {
                alertEl.textContent = 'Lote guardado e integrado con éxito al FIFO.';
                alertEl.classList.remove('d-none');
                
                if (window._productosAlertTimeout) clearTimeout(window._productosAlertTimeout);
                window._productosAlertTimeout = setTimeout(() => alertEl.classList.add('d-none'), 3000);
            }

            // Limpiar campos de cantidad y referencia
            element.querySelector('#lote-cantidad').value = '';
            element.querySelector('#lote-ref').value = '';

            // Recargar vista de detalles del producto
            await this.renderDetalle(element, id);
        });
    }
};
