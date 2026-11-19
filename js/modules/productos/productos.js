// js/modules/productos.js
// Módulo de Gestión de Productos e Inventarios (Lotes FIFO) - Hoja Completa
import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { escapeHtml, applyCurrencyFormatting, parseCurrencyValue } from '../../shared/formatters.js';
import { ExportManager } from '../../shared/exportManager.js';
import { ProductoDetalleModule } from './detalle/productoDetalle.js';
import { ProductoDetalleData } from './detalle/productoDetalle.data.js';

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
        return () => {
            ProductoDetalleModule.cleanup();
        };
    },

    async renderList(element) {
        element.innerHTML = `
            <div class="dash-layout p-4">
                <!-- TOP BAR -->
                <div id="productos-list-header" class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
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
                            <input type="text" id="searchProductos" class="form-control" placeholder="Buscar por nombre, SKU..." value="${escapeHtml(this.searchQuery || '')}" autocomplete="off" style="padding-left: 34px; font-size: 13px; border-radius: var(--border-radius-sm); border-color: var(--border-color);">
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

        const hash = (typeof window !== 'undefined' && window.location?.hash) ? window.location.hash : '';
        const hashParts = hash.split('/');
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
        const listHeader = element.querySelector('#productos-list-header');
        if (listHeader) listHeader.classList.remove('d-none');

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
                <tr data-id="${escapeHtml(String(p.id))}" style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body); height: 44px;" class="row-clickable">
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
                        <button class="btn btn-link text-muted p-1 me-1 btn-menu-row btn-editar" data-id="${escapeHtml(String(p.id))}" title="Editar">
                            <span class="material-symbols-outlined" style="font-size: 18px;">edit</span>
                        </button>
                        <button class="btn btn-link text-muted p-1 btn-menu-row btn-eliminar" data-id="${escapeHtml(String(p.id))}" title="Desactivar">
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
                        try {
                            await DB.save('productos', { id: e.currentTarget.dataset.id, estado: 'inactivo' });
                            this.renderGrid(element);
                        } catch (err) {
                            console.error('Error al desactivar producto:', err);
                            alert('Error al desactivar producto: ' + (err.message || 'Error desconocido'));
                        }
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

        ['#form-precio', '#form-costo', '#form-cantidad-inicial', '#form-impuesto', '#form-minimo'].forEach(selector => {
            const el = element.querySelector(selector);
            if (el) applyCurrencyFormatting(el);
        });
        
        // Cálculo en vivo del Precio Total
        const calcTotal = () => {
            const pBase = parseCurrencyValue(element.querySelector('#form-precio')?.value) || 0;
            const impVal = parseCurrencyValue(element.querySelector('#form-impuesto')?.value) || 0;
            const total = pBase * (1 + (impVal / 100));
            const inputTotal = element.querySelector('#form-precio-total');
            if (inputTotal) {
                inputTotal.value = total.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }
        };
        
        element.querySelector('#form-precio')?.addEventListener('input', calcTotal);
        element.querySelector('#form-impuesto')?.addEventListener('input', calcTotal);
        calcTotal(); // Cálculo inicial

        element.querySelector('#btn-cancelar-producto')?.addEventListener('click', () => this.renderGrid(element));
        element.querySelector('#form-producto-data')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const prodId = id || 'prod_' + Date.now();
            const pVenta = parseCurrencyValue(element.querySelector('#form-precio')?.value) || 0;
            const cBase = parseCurrencyValue(element.querySelector('#form-costo')?.value) || 0;
            const cInicial = parseCurrencyValue(element.querySelector('#form-cantidad-inicial')?.value) || 0;
            const imp = parseCurrencyValue(element.querySelector('#form-impuesto')?.value) || 0;
            const sMin = parseCurrencyValue(element.querySelector('#form-minimo')?.value) || 0;

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
        const listHeader = element.querySelector('#productos-list-header');
        if (listHeader) listHeader.classList.add('d-none');

        const gridCard = element.querySelector('.dash-table-container');
        if (gridCard) gridCard.classList.add('d-none');

        const container = element.querySelector('#productos-view-container');
        if (!container) return;

        ProductoDetalleData.setSupabase(supabase);
        ProductoDetalleData.setDB(DB);

        await ProductoDetalleModule.init(container, id, () => {
            if (typeof window !== 'undefined') {
                window.location.hash = '#/inventario/items';
            }
            const header = element.querySelector('#productos-list-header');
            if (header) header.classList.remove('d-none');
            this.renderGrid(element);
        });
    }
};
