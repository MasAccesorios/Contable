// js/modules/productos/productos.js
// Módulo de Gestión de Productos & Catálogo de Inventario 360° (Orquestador Principal)

import { ProductosData } from './productos.data.js';
import { ProductosTemplates, getProductAvatar } from './productos.templates.js';
import { ProductosEvents } from './productos.events.js';
import { ProductoDetalleModule } from './detalle/productoDetalle.js';
import { ProductoDetalleData } from './detalle/productoDetalle.data.js';

export const ProductosModule = {
    data: ProductosData,
    templates: ProductosTemplates,
    events: ProductosEvents,

    state: {
        view: 'lista', // 'lista' | 'grafico'
        currentPage: 1,
        itemsPerPage: 25,
        currentFilter: 'todos', // 'todos' | 'bajo_stock' | 'agotado' | 'optimo' | 'inactivos'
        sortColumn: 'nombre',
        sortDirection: 'asc',
        searchQuery: '',
        totalCount: 0,
        productos: [],
        kpis: {
            valor_total_inventario: 0,
            total_unidades_fisicas: 0,
            valor_venta_potencial: 0,
            total_activos: 0,
            total_inactivos: 0,
            bajo_stock: 0,
            agotados: 0,
            optimos: 0,
            margen_promedio_global: 0
        },
        tabCounts: {
            todos: 0,
            bajo_stock: 0,
            agotado: 0,
            optimo: 0,
            inactivos: 0
        },
        topItems: [],
        activeDrawerId: null,
        isLoading: false
    },

    // Delegación de formateadores para templates
    formatMoney: ProductosTemplates.formatMoney.bind(ProductosTemplates),
    formatDecimal: ProductosTemplates.formatDecimal.bind(ProductosTemplates),
    getStockBadge: ProductosTemplates.getStockBadge.bind(ProductosTemplates),
    getMargenBadge: ProductosTemplates.getMargenBadge.bind(ProductosTemplates),

    async init(element) {
        if (!element) return;
        this.element = element;

        const rawHash = (typeof window !== 'undefined' && window.location?.hash) ? window.location.hash : '';
        const [cleanHash, queryString] = rawHash.split('?');
        const urlParams = new URLSearchParams(queryString || '');
        const searchParam = urlParams.get('search') || urlParams.get('q');

        // Limpiar estado
        this.state.currentPage = 1;
        this.state.searchQuery = (searchParam || '').trim();
        this.state.currentFilter = 'todos';
        this.state.view = 'lista';
        this.state.activeDrawerId = null;

        // Comprobar si la ruta es ver detalle
        const hashParts = cleanHash.split('/');
        const action = hashParts[3];
        const routeId = hashParts[4];

        if (action === 'ver' && routeId) {
            await this.renderDetalle(element, routeId);
            return () => {
                ProductoDetalleModule.cleanup();
            };
        }

        // Renderizado del Shell Principal
        this.element.innerHTML = this.templates.renderLayout.call(this);

        // Vincular Eventos Globales
        this.events.bindStaticEvents(this);

        // Cargar Primera Página de Datos
        await this.cargarPagina();

        return () => {
            ProductoDetalleModule.cleanup();
        };
    },

    async cargarPagina() {
        if (!this.element) return;
        this.state.isLoading = true;

        const overlay = this.element.querySelector('#grid-loading-overlay');
        if (overlay) overlay.style.display = 'flex';

        try {
            const res = await this.data.cargarPaginaProductos({
                page: this.state.currentPage,
                limit: this.state.itemsPerPage,
                sortColumn: this.state.sortColumn,
                sortDirection: this.state.sortDirection,
                searchQuery: this.state.searchQuery,
                filterCriteria: this.state.currentFilter
            });

            this.state.productos = res.data || [];
            this.state.totalCount = res.totalCount || 0;
            if (res.kpis && Object.keys(res.kpis).length > 0) {
                this.state.kpis = res.kpis;
            }
            if (res.tabCounts && Object.keys(res.tabCounts).length > 0) {
                this.state.tabCounts = res.tabCounts;
            }

            // Calcular Top 5 referencias para vista analítica
            if (this.state.productos.length > 0) {
                const copia = [...this.state.productos];
                copia.sort((a, b) => Number(b.valorTotalInventario || 0) - Number(a.valorTotalInventario || 0));
                this.state.topItems = copia.slice(0, 5);
            }

            // Renderizar Filas de Tabla
            this.templates.renderGrid.call(this, this.state.productos, this.state.totalCount);

            // Renderizar Paginador
            this.templates.renderPagination.call(this, this.state.totalCount, this.state.currentPage, this.state.itemsPerPage);

            // Vincular Eventos de Fila y Paginación
            this.bindFilaEvents();
            this.events.bindPaginationEvents(this, this.state.totalCount);

            // Actualizar KPIs y Badges en DOM
            this.actualizarKpisEnDOM();

            // Si está en vista gráfica, actualizar analítica
            if (this.state.view === 'grafico') {
                this.templates.renderAnalyticsView.call(this, this.state.kpis, this.state.topItems);
            }
        } catch (err) {
            console.error('[ProductosModule] Error cargando página:', err);
        } finally {
            this.state.isLoading = false;
            if (overlay) overlay.style.display = 'none';
        }
    },

    bindFilaEvents() {
        this.events.bindFilaEvents(this);
    },

    actualizarKpisEnDOM() {
        const el = this.element;
        if (!el) return;

        const kpis = this.state.kpis || {};
        const tabs = this.state.tabCounts || {};

        // KPIs
        const elVal = el.querySelector('#kpi-valor-inventario');
        if (elVal) elVal.textContent = this.formatMoney(kpis.valor_total_inventario);

        const elUnd = el.querySelector('#kpi-unidades-fisicas');
        if (elUnd) elUnd.textContent = (Math.round(kpis.total_unidades_fisicas || 0)).toLocaleString('es-CO');

        const elItems = el.querySelector('#kpi-total-items');
        if (elItems) elItems.textContent = (kpis.total_activos || 0).toLocaleString('es-CO');

        const elCrit = el.querySelector('#kpi-stock-critico');
        if (elCrit) elCrit.textContent = (kpis.bajo_stock || 0).toLocaleString('es-CO');

        const elMarg = el.querySelector('#kpi-margen-promedio');
        if (elMarg) elMarg.textContent = `${(kpis.margen_promedio_global || 0).toFixed(1)}%`;

        // Tab Badges
        const bTodos = el.querySelector('#badge-tab-todos');
        if (bTodos) bTodos.textContent = tabs.todos || 0;

        const bBajo = el.querySelector('#badge-tab-bajo-stock');
        if (bBajo) bBajo.textContent = tabs.bajo_stock || 0;

        const bAgot = el.querySelector('#badge-tab-agotado');
        if (bAgot) bAgot.textContent = tabs.agotado || 0;

        const bOpt = el.querySelector('#badge-tab-optimo');
        if (bOpt) bOpt.textContent = tabs.optimo || 0;

        const bInact = el.querySelector('#badge-tab-inactivos');
        if (bInact) bInact.textContent = tabs.inactivos || 0;
    },

    actualizarVisibilidadVistas() {
        const el = this.element;
        if (!el) return;

        const tableView = el.querySelector('#productos-table-view-container');
        const graphView = el.querySelector('#productos-analytics-container');
        const btnLista = el.querySelector('#btn-view-lista');
        const btnGraf = el.querySelector('#btn-view-grafico');

        if (this.state.view === 'grafico') {
            if (tableView) tableView.style.display = 'none';
            if (graphView) graphView.style.display = 'block';
            btnLista?.classList.remove('btn-white', 'bg-white', 'shadow-xs', 'fw-bold');
            btnLista?.classList.add('btn-light', 'border-0', 'text-muted');
            btnGraf?.classList.add('btn-white', 'bg-white', 'shadow-xs', 'fw-bold', 'text-primary');
            btnGraf?.classList.remove('btn-light', 'border-0', 'text-muted');
        } else {
            if (tableView) tableView.style.display = 'block';
            if (graphView) graphView.style.display = 'none';
            btnGraf?.classList.remove('btn-white', 'bg-white', 'shadow-xs', 'fw-bold', 'text-primary');
            btnGraf?.classList.add('btn-light', 'border-0', 'text-muted');
            btnLista?.classList.add('btn-white', 'bg-white', 'shadow-xs', 'fw-bold');
            btnLista?.classList.remove('btn-light', 'border-0', 'text-muted');
        }
    },

    async abrirDrawer(id = null) {
        const el = this.element;
        if (!el) return;

        let producto = null;
        if (id) {
            producto = await this.data.obtenerProducto(id);
        }

        const titleEl = el.querySelector('#producto-drawer-title');
        const iconEl = el.querySelector('#drawer-header-icon');
        const bodyEl = el.querySelector('#producto-drawer-body');
        const drawerEl = el.querySelector('#producto-drawer');
        const backdropEl = el.querySelector('#producto-drawer-backdrop');

        if (titleEl) titleEl.textContent = id ? 'Editar Producto' : 'Nuevo Producto';
        if (iconEl) iconEl.className = id ? 'bi bi-pencil' : 'bi bi-box-seam';
        if (bodyEl) {
            bodyEl.innerHTML = this.templates.renderDrawerContent.call(this, producto);
        }

        this.events.bindDrawerFormEvents(this, Boolean(id));

        if (backdropEl) backdropEl.classList.add('show');
        if (drawerEl) drawerEl.classList.add('show');
    },

    cerrarDrawer() {
        const el = this.element;
        if (!el) return;
        el.querySelector('#producto-drawer')?.classList.remove('show');
        el.querySelector('#producto-drawer-backdrop')?.classList.remove('show');
    },

    async renderDetalle(element, id) {
        const container = element.querySelector('#productos-view-container') || element;
        const sb = await this.data.getSupabase();
        const db = await this.data.getDB();
        if (sb) ProductoDetalleData.setSupabase(sb);
        if (db) ProductoDetalleData.setDB(db);

        await ProductoDetalleModule.init(container, id, () => {
            if (typeof window !== 'undefined') {
                window.location.hash = '#/inventario/items';
            }
            this.init(element);
        });
    }
};
