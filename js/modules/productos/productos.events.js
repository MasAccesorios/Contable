// js/modules/productos/productos.events.js
// Manejo de Eventos de DOM, Interacciones Ergonómicas, Drawer Slide-over y Filtrado Reactivo

import { applyCurrencyFormatting, parseCurrencyValue } from '../../shared/formatters.js';

export const ProductosEvents = {
    debounceTimer: null,

    bindStaticEvents(module) {
        const el = module.element;
        if (!el) return;

        // 1. Selector de Vistas: Lista vs Analítica
        el.querySelector('#btn-view-lista')?.addEventListener('click', () => {
            module.state.view = 'lista';
            module.actualizarVisibilidadVistas();
        });

        el.querySelector('#btn-view-grafico')?.addEventListener('click', () => {
            module.state.view = 'grafico';
            module.actualizarVisibilidadVistas();
            module.templates.renderAnalyticsView.call(module, module.state.kpis, module.state.topItems);
        });

        // 2. Refrescar Datos
        el.querySelector('#btn-refresh-grid')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span>`;

            try {
                const db = await module.data.getDB();
                if (db && typeof db.refreshCache === 'function') {
                    await db.refreshCache('lotes_fifo');
                    await db.refreshCache('productos');
                }
            } catch (err) {
                console.warn('[ProductosEvents] Error refrescando caché:', err);
            }

            await module.cargarPagina();
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        });

        // 3. Exportar Excel
        el.querySelector('#btn-export-excel')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Exportando...`;

            try {
                // Obtener catálogo completo
                const res = await module.data.cargarPaginaProductos({
                    page: 1,
                    limit: 3000,
                    sortColumn: module.state.sortColumn,
                    sortDirection: module.state.sortDirection,
                    searchQuery: module.state.searchQuery,
                    filterCriteria: module.state.currentFilter
                });

                const dataset = (res.data || []).map(p => ({
                    'SKU': p.sku || '',
                    'Producto': p.nombre || '',
                    'Stock Actual': p.stock || 0,
                    'Stock Mínimo': p.stockMinimo || 5,
                    'Estado Stock': p.estadoStock || 'optimo',
                    'Costo Promedio': p.costoPromedio || 0,
                    'Precio Venta': p.precioVenta || 0,
                    'Utilidad Unitaria': p.utilidadUnitaria || 0,
                    'Margen %': p.margenPct || 0,
                    'Capital Total en Bodega': p.valorTotalInventario || 0,
                    'Estado': p.estado || 'activo'
                }));

                const { ExportManager } = await import('../../shared/exportManager.js');
                ExportManager.exportDataToExcel(dataset, 'Inventario_Items_Venta', null, btn);
            } catch (err) {
                console.error('[ProductosEvents] Error exportando catálogo:', err);
                alert('Ocurrió un error al exportar los productos a Excel.');
            } finally {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        });

        // 4. Apertura del Drawer Lateral
        el.querySelector('#btn-nuevo-producto')?.addEventListener('click', () => {
            module.abrirDrawer(null);
        });

        // 5. Clic en KPI Crítico para Filtrar Rápido
        el.querySelector('#card-kpi-stock-critico')?.addEventListener('click', () => {
            module.state.currentFilter = 'bajo_stock';
            module.state.currentPage = 1;
            this.actualizarTabsUI(el, 'bajo_stock');
            module.cargarPagina();
        });

        // 6. Tabs de Filtro Rápido
        el.querySelectorAll('#productos-tabs-bar .payment-tab-btn').forEach(tabBtn => {
            tabBtn.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const filter = btn.dataset.tab;
                if (!filter || filter === module.state.currentFilter) return;

                module.state.currentFilter = filter;
                module.state.currentPage = 1;
                this.actualizarTabsUI(el, filter);
                module.cargarPagina();
            });
        });

        // 7. Buscador con Debounce
        const searchInput = el.querySelector('#search-productos');
        const clearBtn = el.querySelector('#btn-clear-search-productos');

        searchInput?.addEventListener('input', (e) => {
            clearTimeout(this.debounceTimer);
            const val = e.target.value.trim();
            if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';

            this.debounceTimer = setTimeout(() => {
                module.state.searchQuery = val;
                module.state.currentPage = 1;
                module.cargarPagina();
            }, 350);
        });

        clearBtn?.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            clearBtn.style.display = 'none';
            module.state.searchQuery = '';
            module.state.currentPage = 1;
            module.cargarPagina();
        });

        // 8. Selector de Ordenamiento
        el.querySelector('#sort-productos')?.addEventListener('change', (e) => {
            const parts = e.target.value.split(':');
            module.state.sortColumn = parts[0] || 'nombre';
            module.state.sortDirection = parts[1] || 'asc';
            module.state.currentPage = 1;
            module.cargarPagina();
        });

        // 9. Cierre del Drawer
        const cerrarDrawerHandler = () => module.cerrarDrawer();
        el.querySelector('#btn-cerrar-drawer')?.addEventListener('click', cerrarDrawerHandler);
        el.querySelector('#producto-drawer-backdrop')?.addEventListener('click', cerrarDrawerHandler);
    },

    actualizarTabsUI(el, activeFilter) {
        el.querySelectorAll('#productos-tabs-bar .payment-tab-btn').forEach(btn => {
            if (btn.dataset.tab === activeFilter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    },

    bindDrawerFormEvents(module, isEdit) {
        const el = module.element;
        if (!el) return;

        // Formateo de moneda reactivo en los inputs
        ['#drawer-costo', '#drawer-precio', '#drawer-cantidad-inicial', '#drawer-impuesto', '#drawer-minimo'].forEach(sel => {
            const input = el.querySelector(sel);
            if (input) applyCurrencyFormatting(input);
        });

        // Simulador de Margen en Vivo
        const updateMarginPreview = () => {
            const costo = parseCurrencyValue(el.querySelector('#drawer-costo')?.value) || 0;
            const precio = parseCurrencyValue(el.querySelector('#drawer-precio')?.value) || 0;
            const utilidad = precio - costo;
            const pct = precio > 0 ? ((utilidad / precio) * 100) : 0;

            const pctEl = el.querySelector('#drawer-preview-margen-pct');
            const utilEl = el.querySelector('#drawer-preview-utilidad');

            if (pctEl) {
                pctEl.textContent = `${pct.toFixed(1)}%`;
                pctEl.className = `fw-bold fs-6 ${pct >= 25 ? 'text-success' : pct >= 10 ? 'text-warning' : 'text-danger'}`;
            }
            if (utilEl) {
                utilEl.textContent = module.templates.formatMoney(utilidad);
            }
        };

        el.querySelector('#drawer-costo')?.addEventListener('input', updateMarginPreview);
        el.querySelector('#drawer-precio')?.addEventListener('input', updateMarginPreview);
        updateMarginPreview();

        // Botón Cancelar en el Drawer
        el.querySelector('#btn-cancelar-drawer')?.addEventListener('click', () => module.cerrarDrawer());

        // Submit del Formulario
        el.querySelector('#form-producto-drawer')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = el.querySelector('#btn-guardar-drawer');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Guardando...`;
            }

            try {
                const prodId = el.querySelector('#drawer-producto-id')?.value || ('prod_' + Date.now());
                const sku = el.querySelector('#drawer-sku')?.value.trim();
                const nombre = el.querySelector('#drawer-nombre')?.value.trim();
                const costoBase = parseCurrencyValue(el.querySelector('#drawer-costo')?.value) || 0;
                const precioVenta = parseCurrencyValue(el.querySelector('#drawer-precio')?.value) || 0;
                const impuesto = parseCurrencyValue(el.querySelector('#drawer-impuesto')?.value) || 0;
                const stockMinimo = parseCurrencyValue(el.querySelector('#drawer-minimo')?.value) || 5;
                const cantInicial = parseCurrencyValue(el.querySelector('#drawer-cantidad-inicial')?.value) || 0;

                const payload = {
                    id: prodId,
                    sku,
                    nombre,
                    costoBase,
                    precioVenta,
                    impuesto,
                    stockMinimo,
                    estado: 'active'
                };

                await module.data.guardarProducto(payload, cantInicial);
                module.cerrarDrawer();
                await module.cargarPagina();
            } catch (err) {
                console.error('[ProductosEvents] Error guardando producto:', err);
                alert('Error al guardar el producto: ' + (err.message || 'Error desconocido'));
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i class="bi bi-check2-circle me-1"></i> Guardar Producto`;
                }
            }
        });
    },

    bindFilaEvents(module) {
        const el = module.element;
        if (!el) return;

        // Clic en fila para ver detalle
        el.querySelectorAll('.row-producto-clickable').forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('.dropdown')) {
                    const id = row.dataset.id;
                    if (id && typeof window !== 'undefined') {
                        window.location.hash = `#/inventario/items/ver/${id}`;
                    }
                }
            });
        });

        // Copiar SKU al portapapeles
        el.querySelectorAll('.btn-copy-sku').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sku = btn.dataset.sku;
                if (!sku) return;

                try {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        await navigator.clipboard.writeText(sku);
                        const originalHtml = btn.innerHTML;
                        btn.innerHTML = `<i class="bi bi-check-lg text-success"></i>`;
                        setTimeout(() => { btn.innerHTML = originalHtml; }, 1500);
                    }
                } catch (err) {
                    console.warn('[ProductosEvents] No se pudo copiar SKU:', err);
                }
            });
        });

        // Dropdown acción editar
        el.querySelectorAll('.btn-accion-editar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                module.abrirDrawer(btn.dataset.id);
            });
        });

        // Dropdown acción desactivar
        el.querySelectorAll('.btn-accion-desactivar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('¿Estás seguro de desactivar este producto? No estará disponible para nuevas ventas.')) {
                    try {
                        await module.data.desactivarProducto(btn.dataset.id);
                        await module.cargarPagina();
                    } catch (err) {
                        alert('Error al desactivar el producto: ' + err.message);
                    }
                }
            });
        });

        // Dropdown acción reactivar
        el.querySelectorAll('.btn-accion-activar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    await module.data.activarProducto(btn.dataset.id);
                    await module.cargarPagina();
                } catch (err) {
                    alert('Error al reactivar el producto: ' + err.message);
                }
            });
        });
    },

    bindPaginationEvents(module, totalItems) {
        const el = module.element;
        if (!el) return;

        const totalPages = Math.ceil(totalItems / module.state.itemsPerPage) || 1;

        el.querySelector('.select-per-page')?.addEventListener('change', (e) => {
            module.state.itemsPerPage = parseInt(e.target.value) || 25;
            module.state.currentPage = 1;
            module.cargarPagina();
        });

        el.querySelector('.input-page')?.addEventListener('change', (e) => {
            let val = parseInt(e.target.value) || 1;
            if (val < 1) val = 1;
            if (val > totalPages) val = totalPages;
            module.state.currentPage = val;
            module.cargarPagina();
        });

        el.querySelector('.btn-prev-page')?.addEventListener('click', () => {
            if (module.state.currentPage > 1) {
                module.state.currentPage--;
                module.cargarPagina();
            }
        });

        el.querySelector('.btn-next-page')?.addEventListener('click', () => {
            if (module.state.currentPage < totalPages) {
                module.state.currentPage++;
                module.cargarPagina();
            }
        });
    }
};
