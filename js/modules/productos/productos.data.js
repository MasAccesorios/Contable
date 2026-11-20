// js/modules/productos/productos.data.js
// Capa de Datos, Persistencia y Agregación Financiera de Inventario (Lotes FIFO)

function getLocalDate() {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

export const ProductosData = {
    _supabase: null,
    _db: null,

    async getSupabase() {
        if (this._supabase) return this._supabase;
        if (typeof window !== 'undefined' && window.supabase) return window.supabase;
        try {
            const mod = await import('../../core/supabase.js');
            this._supabase = mod.supabase;
            return this._supabase;
        } catch {
            return null;
        }
    },

    setSupabase(client) {
        this._supabase = client;
    },

    async getDB() {
        if (this._db) return this._db;
        if (typeof window !== 'undefined' && window.DB) return window.DB;
        try {
            const mod = await import('../../core/db.js');
            this._db = mod.default || mod.DB;
            return this._db;
        } catch {
            return null;
        }
    },

    setDB(db) {
        this._db = db;
    },

    /**
     * Carga la página de productos utilizando la RPC optimizada get_productos_page_v2,
     * con fallback automático si no está disponible.
     */
    async cargarPaginaProductos({ page = 1, limit = 25, sortColumn = 'nombre', sortDirection = 'asc', searchQuery = '', filterCriteria = 'todos' }) {
        const sb = await this.getSupabase();
        try {
            if (sb && typeof sb.rpc === 'function') {
                const { data, error } = await sb.rpc('get_productos_page_v2', {
                    p_page: page,
                    p_limit: limit,
                    p_sort_column: sortColumn,
                    p_sort_direction: sortDirection,
                    p_search_query: searchQuery,
                    p_filter_criteria: filterCriteria
                });

                if (!error && data) {
                    const result = typeof data === 'string' ? JSON.parse(data) : data;
                    return {
                        data: result.data || [],
                        totalCount: parseInt(result.total_count) || 0,
                        kpis: result.kpis || {},
                        tabCounts: result.tab_counts || {}
                    };
                }
            }
        } catch (err) {
            console.warn('[ProductosData] RPC get_productos_page_v2 falló, intentando fallback:', err);
        }

        // Fallback defensivo usando tabla productos y lotes_fifo locales
        return await this._cargarPaginaFallback({ page, limit, sortColumn, sortDirection, searchQuery, filterCriteria });
    },

    async _cargarPaginaFallback({ page = 1, limit = 25, sortColumn = 'nombre', sortDirection = 'asc', searchQuery = '', filterCriteria = 'todos' }) {
        try {
            const db = await this.getDB();
            const prods = (db ? await db.getAll('productos') : []) || [];
            const lotes = (db ? await db.getAll('lotes_fifo') : []) || [];

            const enriquecidos = prods.map(p => {
                const todosLotes = lotes.filter(l => String(l.productoId) === String(p.id));
                const stock = todosLotes.reduce((sum, l) => sum + Number(l.cantidadActual || 0), 0);

                const lotesPositivos = todosLotes.filter(l => Number(l.cantidadActual || 0) > 0);
                const stockPos = lotesPositivos.reduce((sum, l) => sum + Number(l.cantidadActual || 0), 0);
                const costoLotesPos = lotesPositivos.reduce((sum, l) => sum + (Number(l.cantidadActual || 0) * Number(l.costoUnitario || 0)), 0);

                const costoPromedio = stockPos > 0 ? costoLotesPos / stockPos : Number(p.costoBase || 0);
                const valorInventario = stock > 0 ? stock * costoPromedio : 0;
                const precioVenta = Number(p.precioVenta || 0);
                const utilidadUnitaria = precioVenta - costoPromedio;
                const margenPct = precioVenta > 0 ? Math.round(((utilidadUnitaria / precioVenta) * 100) * 10) / 10 : 0;
                const sMin = Number(p.stockMinimo || 5);

                let estadoStock = 'optimo';
                if (stock <= 0) estadoStock = 'agotado';
                else if (stock <= sMin) estadoStock = 'bajo_stock';

                return {
                    id: p.id,
                    sku: p.sku || '',
                    nombre: p.nombre || '',
                    precioVenta,
                    costoBase: Number(p.costoBase || 0),
                    stockMinimo: sMin,
                    impuesto: Number(p.impuesto || 0),
                    estado: p.estado || 'active',
                    stock,
                    costoPromedio,
                    valorTotalInventario: valorInventario,
                    lotesActivosCount: lotesPositivos.length,
                    utilidadUnitaria,
                    margenPct,
                    estadoStock
                };
            });

            const kpis = this.calcularKPIsLocales(enriquecidos);
            const tabCounts = this.calcularTabCountsLocales(enriquecidos);
            const res = this.filtrarYPaginarLocales(enriquecidos, {
                filterCriteria,
                searchQuery,
                sortColumn,
                sortDirection,
                page,
                limit
            });

            return {
                data: res.data,
                totalCount: res.totalCount,
                kpis,
                tabCounts
            };
        } catch (e) {
            console.error('[ProductosData] Error crítico en fallback:', e);
            return { data: [], totalCount: 0, kpis: {}, tabCounts: {} };
        }
    },

    calcularKPIsLocales(productos = []) {
        let totalActivos = 0;
        let totalInactivos = 0;
        let totalUnidadesFisicas = 0;
        let valorTotalInventario = 0;
        let valorVentaPotencial = 0;
        let bajoStock = 0;
        let agotados = 0;
        let optimos = 0;

        productos.forEach(p => {
            const isInactive = p.estado === 'inactivo' || p.estado === 'inactive';
            if (isInactive) {
                totalInactivos++;
                return;
            }

            totalActivos++;
            const stock = Number(p.stock || 0);
            const costo = Number(p.costoPromedio || p.costoBase || 0);
            const precio = Number(p.precioVenta || 0);
            const sMin = Number(p.stockMinimo || 5);

            totalUnidadesFisicas += stock;
            valorTotalInventario += stock * costo;
            valorVentaPotencial += stock * precio;

            if (stock <= 0) {
                agotados++;
            } else if (stock <= sMin) {
                bajoStock++;
            } else {
                optimos++;
            }
        });

        let margenGlobal = 0;
        if (valorVentaPotencial > 0) {
            margenGlobal = Math.round((((valorVentaPotencial - valorTotalInventario) / valorVentaPotencial) * 100) * 10) / 10;
        }

        return {
            valor_total_inventario: Math.round(valorTotalInventario),
            total_unidades_fisicas: Math.round(totalUnidadesFisicas),
            valor_venta_potencial: Math.round(valorVentaPotencial),
            total_activos: totalActivos,
            total_inactivos: totalInactivos,
            bajo_stock: bajoStock,
            agotados: agotados,
            optimos: optimos,
            margen_promedio_global: margenGlobal
        };
    },

    calcularTabCountsLocales(productos = []) {
        let todos = 0;
        let bajoStock = 0;
        let agotado = 0;
        let optimo = 0;
        let inactivos = 0;

        productos.forEach(p => {
            const isInactive = p.estado === 'inactivo' || p.estado === 'inactive';
            if (isInactive) {
                inactivos++;
                return;
            }

            todos++;
            const stock = Number(p.stock || 0);
            const sMin = Number(p.stockMinimo || 5);

            if (stock <= 0) agotado++;
            else if (stock <= sMin) bajoStock++;
            else optimo++;
        });

        return {
            todos,
            bajo_stock: bajoStock,
            agotado,
            optimo,
            inactivos
        };
    },

    filtrarYPaginarLocales(productos = [], { filterCriteria = 'todos', searchQuery = '', sortColumn = 'nombre', sortDirection = 'asc', page = 1, limit = 25 }) {
        const q = (searchQuery || '').trim().toLowerCase();

        let filtrados = productos.filter(p => {
            const isInactive = p.estado === 'inactivo' || p.estado === 'inactive';

            if (filterCriteria === 'inactivos') {
                if (!isInactive) return false;
            } else {
                if (isInactive) return false;
            }

            if (q) {
                const matchNombre = (p.nombre || '').toLowerCase().includes(q);
                const matchSku = (p.sku || '').toLowerCase().includes(q);
                if (!matchNombre && !matchSku) return false;
            }

            const stock = Number(p.stock || 0);
            const sMin = Number(p.stockMinimo || 5);

            if (filterCriteria === 'bajo_stock') {
                return stock <= sMin && stock > 0;
            }
            if (filterCriteria === 'agotado') {
                return stock <= 0;
            }
            if (filterCriteria === 'optimo') {
                return stock > sMin;
            }

            return true;
        });

        // Ordenamiento
        filtrados.sort((a, b) => {
            let valA = a[sortColumn];
            let valB = b[sortColumn];

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        const totalCount = filtrados.length;
        const offset = (page - 1) * limit;
        const data = filtrados.slice(offset, offset + limit);

        return { data, totalCount };
    },

    async guardarProducto(nuevoProducto, cantidadInicial = 0) {
        const db = await this.getDB();
        if (!db) throw new Error('Base de datos no inicializada');

        const prodGuardado = await db.save('productos', nuevoProducto);

        if (Number(cantidadInicial) > 0 && !nuevoProducto.id?.toString().startsWith('prod_edit_')) {
            const loteInicial = {
                id: 'lote_' + prodGuardado.id + '_init',
                productoId: prodGuardado.id,
                cantidadInicial: Number(cantidadInicial),
                cantidadActual: Number(cantidadInicial),
                costoUnitario: Number(nuevoProducto.costoBase || 0),
                fechaIngreso: getLocalDate(),
                referencia: 'Inventario Inicial',
                origen_movimiento: 'producto_nuevo:' + (prodGuardado.sku || '')
            };
            await db.save('lotes_fifo', loteInicial);
        }

        return prodGuardado;
    },

    async desactivarProducto(id) {
        const db = await this.getDB();
        if (!db) throw new Error('Base de datos no inicializada');
        return await db.save('productos', { id, estado: 'inactivo' });
    },

    async activarProducto(id) {
        const db = await this.getDB();
        if (!db) throw new Error('Base de datos no inicializada');
        return await db.save('productos', { id, estado: 'active' });
    },

    async obtenerProducto(id) {
        const db = await this.getDB();
        if (!db) return null;
        return await db.get('productos', id);
    }
};
