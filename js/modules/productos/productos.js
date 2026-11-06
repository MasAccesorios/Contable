// js/modules/productos.js
// Módulo de Gestión de Productos e Inventarios (Lotes FIFO) - Hoja Completa
import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { renderTablaFacturas } from '../../shared/tablaFacturas.js';
import { calcularEstadoFactura } from '../../shared/carteraUtils.js';
import { escapeHtml } from '../../shared/formatters.js';
import { ExportManager } from '../../shared/exportManager.js';

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
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <h2 class="page-title mb-0" style="font-size: 20px; font-weight: 700; color: var(--text-main);">Ítems de venta</h2>
                            <span class="badge" style="background-color: #f1f5f9; color: var(--text-muted); font-size: 11px; font-weight: 600; border: 1px solid var(--border-color); border-radius: 9999px; padding: 3px 10px;">Inventario</span>
                        </div>
                        <p class="text-muted mb-0" style="font-size: 13px;">Gestiona tus productos, su costo promedio y el inventario disponible en tiempo real.</p>
                    </div>
                    <div class="d-flex flex-wrap gap-2 w-100 w-md-auto justify-content-md-end">
                        <button id="btn-refresh-list" class="btn btn-light bg-white border d-inline-flex align-items-center justify-content-center" style="font-weight: 500; font-size: 13px; color: var(--text-body); border-radius: var(--border-radius-sm); padding: 8px 14px;">
                            <span class="material-symbols-outlined me-1" style="font-size: 18px;">refresh</span> Actualizar
                        </button>
                        <button id="btn-export-list" class="btn btn-light bg-white border d-inline-flex align-items-center justify-content-center" style="font-weight: 500; font-size: 13px; color: var(--text-body); border-radius: var(--border-radius-sm); padding: 8px 14px;">
                            <span class="material-symbols-outlined me-1" style="font-size: 18px;">download</span> Exportar
                        </button>
                        <button id="btn-nuevo-producto" class="btn btn-primary-action d-inline-flex align-items-center justify-content-center" style="font-weight: 600; font-size: 13px; border-radius: var(--border-radius-sm); padding: 8px 16px;">
                            <span class="material-symbols-outlined me-1" style="font-size: 18px;">add</span> Nuevo producto
                        </button>
                    </div>
                </div>

                <!-- DATA TABLE CARD -->
                <div class="dash-table-container">
                    
                    <!-- FILTERS -->
                    <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center" style="border-radius: var(--border-radius-sm) var(--border-radius-sm) 0 0;">
                        <div class="ds-search-container" style="width: 280px; position: relative;">
                            <span class="material-symbols-outlined" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 18px; color: var(--text-muted); pointer-events: none;">search</span>
                            <input type="text" id="searchProductos" class="form-control" placeholder="Buscar por nombre, SKU..." value="${this.searchQuery}" autocomplete="off" style="padding-left: 34px; font-size: 13px; border-radius: var(--border-radius-sm); border-color: var(--border-color);">
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-light bg-white border dropdown-toggle d-inline-flex align-items-center" data-bs-toggle="dropdown" style="font-size: 13px; font-weight: 500; border-radius: var(--border-radius-sm); padding: 7px 12px; color: var(--text-body);">
                                <span class="material-symbols-outlined me-1" style="font-size: 17px; color: var(--text-muted);">filter_list</span> Filtrar <span id="lbl-filtro-actual" style="font-size: 12px; font-weight: 600; color: var(--primary); margin-left: 4px;"></span>
                            </button>
                            <ul class="dropdown-menu shadow-sm border" style="font-size: 13px; border-radius: var(--border-radius-sm);">
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
                    <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center" style="border-radius: 0 0 var(--border-radius-sm) var(--border-radius-sm);" id="grid-pagination">
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
                <tr style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                    <th class="py-3 ps-4 cursor-pointer sort-col" data-col="sku" style="white-space: nowrap; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
                        SKU ${this.sortColumn === 'sku' ? (this.sortDirection === 'asc' ? '<span class="material-symbols-outlined align-middle" style="font-size: 14px;">arrow_upward</span>' : '<span class="material-symbols-outlined align-middle" style="font-size: 14px;">arrow_downward</span>') : ''}
                    </th>
                    <th class="py-3 cursor-pointer sort-col" data-col="nombre" style="min-width: 220px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
                        Nombre / Descripción ${this.sortColumn === 'nombre' ? (this.sortDirection === 'asc' ? '<span class="material-symbols-outlined align-middle" style="font-size: 14px;">arrow_upward</span>' : '<span class="material-symbols-outlined align-middle" style="font-size: 14px;">arrow_downward</span>') : ''}
                    </th>
                    <th class="py-3 text-end" style="white-space: nowrap; min-width: 120px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Precio Venta</th>
                    <th class="py-3 text-end" style="white-space: nowrap; min-width: 110px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Stock Total</th>
                    <th class="py-3 text-end" style="white-space: nowrap; min-width: 150px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Costo Promedio Real</th>
                    <th class="py-3 text-end pe-4" style="width: 80px; white-space: nowrap;"></th>
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
                <tr data-id="${p.id}" style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body); height: 44px;" class="row-clickable">
                    <td class="py-2 ps-4 td-sku" style="color: var(--text-main); font-weight: 600; font-family: monospace;">${escapeHtml(p.sku) || ''}</td>
                    <td class="py-2 text-truncate td-nombre" style="max-width: 300px; font-weight: 500; color: var(--text-main);">${escapeHtml(p.nombre || '')}</td>
                    <td class="py-2 text-end tnum" style="font-weight: 500;">$${(p.precioVenta || 0).toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                    <td class="py-2 text-end">
                        <span class="badge ${isLowStock ? 'badge-stitch-vencido' : 'badge-stitch-cobrado'} tnum" style="font-size: 11px; font-weight: 600;" ${isLowStock ? 'title="¡Alerta: Stock por debajo del mínimo!"' : ''}>
                            ${isLowStock ? '<span class="material-symbols-outlined align-middle me-1" style="font-size: 13px;">warning</span>' : ''}${stockTotal} und
                        </span>
                    </td>
                    <td class="py-2 text-end text-muted tnum">$${(costoPromedio || 0).toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                    <td class="py-2 text-end pe-4">
                        <button class="btn btn-link text-muted p-1 me-1 btn-menu-row btn-editar" data-id="${p.id}" title="Editar">
                            <span class="material-symbols-outlined" style="font-size: 18px;">edit</span>
                        </button>
                        <button class="btn btn-link text-muted p-1 btn-menu-row btn-eliminar" data-id="${p.id}" title="Desactivar">
                            <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
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
                    <select class="form-select form-select-sm text-muted select-per-page" style="width: 70px; font-size: 13px; border-radius: var(--border-radius-sm);">
                        <option value="10" ${this.itemsPerPage===10?'selected':''}>10</option>
                        <option value="20" ${this.itemsPerPage===20?'selected':''}>20</option>
                        <option value="50" ${this.itemsPerPage===50?'selected':''}>50</option>
                    </select>
                    <span class="text-muted border-start ps-3 tnum">${totalItems > 0 ? from + 1 : 0}-${Math.min(from + this.itemsPerPage, totalItems)} de ${totalItems}</span>
                </div>
                <div class="d-flex align-items-center gap-2" style="font-size: 13px; color: var(--text-body);">
                    <span>Página</span>
                    <input type="number" class="form-control form-control-sm text-center text-muted input-page tnum" value="${this.currentPage}" min="1" max="${totalPages}" style="width: 50px; font-size: 13px; border-radius: var(--border-radius-sm);">
                    <span class="tnum">de ${totalPages}</span>
                    <div class="ms-2 d-inline-flex gap-1">
                        <button class="btn btn-sm btn-light border p-1 d-inline-flex align-items-center justify-content-center btn-prev-page" ${this.currentPage === 1 ? 'disabled' : ''} style="width: 28px; height: 28px; border-radius: var(--border-radius-sm);"><span class="material-symbols-outlined" style="font-size: 16px;">chevron_left</span></button>
                        <button class="btn btn-sm btn-light border p-1 d-inline-flex align-items-center justify-content-center btn-next-page" ${this.currentPage === totalPages ? 'disabled' : ''} style="width: 28px; height: 28px; border-radius: var(--border-radius-sm);"><span class="material-symbols-outlined" style="font-size: 16px;">chevron_right</span></button>
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
                            <input type="text" id="form-sku" class="form-control" value="${escapeHtml(producto.sku)}" ${id ? 'disabled' : 'required'}>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-muted small">Nombre del Producto *</label>
                            <input type="text" id="form-nombre" class="form-control" value="${escapeHtml(producto.nombre)}" required>
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

        const [producto, lotesResult, detallesResult] = await Promise.all([
            DB.get('productos', id),
            supabase.from('lotes_fifo').select('*').eq('producto_id', id),
            supabase.from('factura_detalles').select('factura_id').eq('producto_id', id)
        ]);
        if (!producto) return;

        const { data: lotesData } = lotesResult;
        const lotesProd = lotesData ? lotesData.map(l => DB._mapToFrontend('lotes_fifo', l)) : [];

        // Ordenar lotes por fecha de ingreso ascendente para visualización FIFO
        lotesProd.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso));

        let lotesHtml = '';
        let stockTotalDisponible = lotesProd.length > 0 
            ? lotesProd.reduce((sum, l) => sum + (parseFloat(l.cantidadActual) || 0), 0)
            : (parseFloat(producto.stock) || 0);

        lotesProd.forEach(l => {
            lotesHtml += `
                <tr class="${l.cantidadActual === 0 ? 'table-light opacity-50' : ''}" style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);">
                    <td class="py-2 ps-3 tnum">${l.fechaIngreso}</td>
                    <td class="py-2">${escapeHtml(l.referencia)}</td>
                    <td class="py-2 text-end tnum">$${l.costoUnitario.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td class="py-2 text-end tnum">${l.cantidadInicial} und</td>
                    <td class="py-2 text-end pe-3 tnum">
                        <strong class="${l.cantidadActual === 0 ? 'text-muted' : 'text-success'}">${l.cantidadActual} und</strong>
                    </td>
                </tr>
            `;
        });


        let facturasAsociadas = [];
        let facturasCompraAsociadas = [];
        let contactosMap = {};
        try {
            const detalles = detallesResult?.data;
            if (detalles && detalles.length > 0) {
                const facturaIds = [...new Set(detalles.map(d => d.factura_id))];
                const { data: facturas } = await supabase.from('facturas').select('*').in('id', facturaIds).in('tipo', ['venta', 'compra']);
                
                if (facturas && facturas.length > 0) {
                    const contactIds = [...new Set(facturas.map(f => f.clienteId || f.proveedorId || f.contacto_id || f.contactoId).filter(Boolean))];
                    
                    const [contactosRes, transaccionesRes] = await Promise.all([
                        contactIds.length > 0 ? supabase.from('contactos').select('id, nombre').in('id', contactIds) : Promise.resolve({ data: [] }),
                        supabase.from('pagos_ingresos').select('*').in('factura_id', facturas.map(f => f.id))
                    ]);

                    contactosRes?.data?.forEach(c => contactosMap[c.id] = c.nombre);
                    const transMapeadas = (transaccionesRes?.data || []).map(t => ({...t, tipo: t.tipo === 'in' ? 'ingreso' : 'egreso'}));

                    const procesarFactura = (f) => {
                        const tr = transMapeadas.filter(t => t.factura_id === f.id);
                        const { estado, saldo, totalPagado } = calcularEstadoFactura(f, tr);
                        return {
                            ...f,
                            estado,
                            saldoPendiente: saldo,
                            totalPagado
                        };
                    };

                    const facturasVenta = facturas.filter(f => f.tipo === 'venta' || !f.tipo);
                    const facturasCompra = facturas.filter(f => f.tipo === 'compra');

                    facturasAsociadas = facturasVenta.map(procesarFactura);
                    facturasAsociadas.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

                    facturasCompraAsociadas = facturasCompra.map(procesarFactura);
                    facturasCompraAsociadas.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
                }
            }
        } catch (e) {
            console.error("Error al cargar facturas asociadas:", e);
        }

        const tieneFacturas = facturasAsociadas.length > 0 || facturasCompraAsociadas.length > 0;
        const defaultTabVenta = facturasAsociadas.length > 0 || facturasCompraAsociadas.length === 0;

        container.innerHTML = `


            <div class="row g-4">
                <!-- Panel de Detalles del Producto & Carga de Lotes -->
                <div class="col-12 col-lg-4">
                    <div class="card border-0 shadow-sm mb-4">
                        <div class="card-body p-4">
                            <h5 class="fw-bold mb-3" style="font-size: 15px; color: var(--text-main);">Detalle Técnico</h5>
                            <ul class="list-unstyled mb-0" style="font-size: 13px;">
                                <li class="mb-3 d-flex align-items-center">
                                    <span class="text-muted me-2">SKU:</span> 
                                    <span class="badge" style="background-color: #f1f5f9; color: var(--text-main); border: 1px solid var(--border-color); font-family: monospace; font-size: 13px; padding: 4px 10px;">
                                        ${escapeHtml(producto.sku)}
                                    </span>
                                </li>
                                <li class="mb-2"><span class="text-muted">Descripción:</span> <strong style="color: var(--text-main);">${escapeHtml(producto.nombre)}</strong></li>
                                <li class="mb-2"><span class="text-muted">Precio Venta:</span> <strong class="tnum" style="color: var(--text-main);">$${producto.precioVenta.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></li>
                                <li><span class="text-muted">Costo Base Fijo:</span> <span class="tnum text-muted">$${producto.costoBase.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></li>
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
                <div class="col-12 col-lg-8">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body p-4">
                            <div class="d-flex justify-content-between align-items-center mb-4">
                                <h5 class="fw-bold mb-0" style="font-size: 15px; color: var(--text-main);">Capas de Inventario (Lotes FIFO)</h5>
                                <div class="d-flex gap-2">
                                    <button id="btn-kardex-prod" class="btn btn-sm btn-outline-primary d-inline-flex align-items-center" style="font-size: 13px; font-weight: 500; border-radius: var(--border-radius-sm); padding: 5px 12px;">
                                        <span class="material-symbols-outlined me-1" style="font-size: 16px;">receipt_long</span>Kardex
                                    </button>
                                    <button id="btn-volver-prod" class="btn btn-sm btn-light border d-inline-flex align-items-center" style="font-size: 13px; font-weight: 500; border-radius: var(--border-radius-sm); padding: 5px 12px; color: var(--text-body);">
                                        <span class="material-symbols-outlined me-1" style="font-size: 16px;">arrow_back</span>Volver al Listado
                                    </button>
                                </div>
                            </div>
                            
                            <!-- NUEVO BANNER STOCK TOTAL -->
                            <div class="alert d-flex align-items-center p-3 mb-4" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--border-radius-sm);">
                                <span class="material-symbols-outlined me-3" style="font-size: 28px; color: #2563eb;">inventory_2</span>
                                <div>
                                    <div class="text-muted" style="font-size: 12px; font-weight: 500;">Stock Total Disponible</div>
                                    <div class="fw-bold tnum" style="font-size: 18px; color: #1e40af;">${stockTotalDisponible} unidades</div>
                                </div>
                            </div>

                            <div class="table-responsive">
                                <table class="table align-middle">
                                    <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                                        <tr style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
                                            <th class="py-2 ps-3">Fecha Ingreso</th>
                                            <th class="py-2">Referencia</th>
                                            <th class="py-2 text-end">Costo Unitario</th>
                                            <th class="py-2 text-end">Cantidad Inicial</th>
                                            <th class="py-2 text-end pe-3">Cantidad Disponible</th>
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
                ${tieneFacturas ? `
                <div class="col-12 col-lg-12">
                    <div class="card border-0 mb-4 shadow-sm" style="border-radius: var(--border-radius-sm);">
                        <div class="card-header bg-white border-bottom p-3">
                            <ul class="nav nav-tabs card-header-tabs border-bottom-0" id="tabs-facturas-item" role="tablist">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link ${defaultTabVenta ? 'active fw-bold' : 'fw-semibold'} text-nowrap" id="tab-facturas-venta-btn" data-bs-toggle="tab" data-bs-target="#tab-facturas-venta-pane" type="button" role="tab" aria-controls="tab-facturas-venta-pane" aria-selected="${defaultTabVenta ? 'true' : 'false'}" style="font-size: var(--fs-md);">
                                        <i class="bi bi-receipt me-2 text-muted"></i>Facturas de Venta <span class="badge rounded-pill bg-light text-secondary border ms-1">${facturasAsociadas.length}</span>
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link ${!defaultTabVenta ? 'active fw-bold' : 'fw-semibold'} text-nowrap" id="tab-facturas-compra-btn" data-bs-toggle="tab" data-bs-target="#tab-facturas-compra-pane" type="button" role="tab" aria-controls="tab-facturas-compra-pane" aria-selected="${!defaultTabVenta ? 'true' : 'false'}" style="font-size: var(--fs-md);">
                                        <i class="bi bi-cart-check me-2 text-muted"></i>Facturas de Compra <span class="badge rounded-pill bg-light text-secondary border ms-1">${facturasCompraAsociadas.length}</span>
                                    </button>
                                </li>
                            </ul>
                        </div>
                        <div class="tab-content" id="tabs-facturas-item-content">
                            <div class="tab-pane fade ${defaultTabVenta ? 'show active' : ''}" id="tab-facturas-venta-pane" role="tabpanel" aria-labelledby="tab-facturas-venta-btn">
                                ${renderTablaFacturas(facturasAsociadas, contactosMap, 'fecha', 'desc', { hash: `#/inventario/items/ver/${id}`, label: `Volver al Producto (${escapeHtml(producto.nombre)})` }, 'venta')}
                            </div>
                            <div class="tab-pane fade ${!defaultTabVenta ? 'show active' : ''}" id="tab-facturas-compra-pane" role="tabpanel" aria-labelledby="tab-facturas-compra-btn">
                                ${renderTablaFacturas(facturasCompraAsociadas, contactosMap, 'fecha', 'desc', { hash: `#/inventario/items/ver/${id}`, label: `Volver al Producto (${escapeHtml(producto.nombre)})` }, 'compra')}
                            </div>
                        </div>
                    </div>
                </div>` : ''}
            </div>

            <!-- MODAL KARDEX -->
            <div class="modal fade" id="modalKardexProducto" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content" style="background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);">
                        <div class="modal-header border-bottom">
                            <h5 class="modal-title fw-bold d-flex align-items-center" style="color: var(--text-main); font-size: 16px;">
                                <span class="material-symbols-outlined me-2" style="font-size: 20px; color: var(--primary);">receipt_long</span>Kardex de Producto: ${escapeHtml(producto.nombre)}
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
        `;

        import('../../shared/formatters.js').then(fmt => {
            fmt.applyCurrencyFormatting(element.querySelector('#lote-costo'));
        });

        element.querySelector('#btn-volver-prod')?.addEventListener('click', () => this.renderGrid(element));

        element.querySelector('#btn-kardex-prod')?.addEventListener('click', async () => {
            const modalEl = element.querySelector('#modalKardexProducto');
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();

            const tbody = modalEl.querySelector('#tbody-kardex-modal');
            tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Cargando movimientos...</td></tr>';
            
            const { data, error } = await supabase.rpc('get_kardex_producto', { p_producto_id: id });
            
            if (error) {
                console.error("Error cargando kardex:", error);
                tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-danger">Error al cargar el kardex.</td></tr>';
                return;
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-muted">Sin movimientos registrados</td></tr>';
                return;
            }

            let html = '';
            data.forEach(mov => {
                const dateObj = new Date(mov.creado_en);
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const year = dateObj.getFullYear();
                const hours = String(dateObj.getHours()).padStart(2, '0');
                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                const dateParts = `${day}/${month}/${year} ${hours}:${minutes}`;
                
                const dif = parseFloat(mov.diferencia) || 0;
                let difColor = '';
                let difSign = '';
                if (dif > 0) {
                    difColor = 'text-success fw-bold';
                    difSign = '+';
                } else if (dif < 0) {
                    difColor = 'text-danger fw-bold';
                }

                const formatNum = (num) => Number(num || 0).toLocaleString('es-CO');

                html += `
                    <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);">
                        <td class="py-2 ps-4 text-start tnum">${dateParts}</td>
                        <td class="py-2"><span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle px-2 py-1 text-uppercase" style="font-size: 10px;">${escapeHtml(mov.tipo_operacion || '')}</span></td>
                        <td class="py-2 text-end tnum">${formatNum(mov.cantidad_anterior)}</td>
                        <td class="py-2 text-end tnum ${difColor}">${difSign}${formatNum(dif)}</td>
                        <td class="py-2 fw-medium text-end tnum" style="color: #d97706;">${formatNum(mov.cantidad_nueva)}</td>
                        <td class="py-2 text-muted small">${escapeHtml(mov.origen_documento || '-')}</td>
                        <td class="py-2 pe-4 text-muted small">${escapeHtml(mov.referencia_lote || '-')}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        });
        
        // Manejador del submit de nuevo lote
        element.querySelector('#form-nuevo-lote')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alertEl = element.querySelector('#lote-alert');
            
            const qty = parseFloat(element.querySelector('#lote-cantidad').value) || 0;
            
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
