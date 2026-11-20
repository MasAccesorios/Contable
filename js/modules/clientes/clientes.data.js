// js/modules/clientes/clientes.data.js

export const ContactosData = {
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
            this._db = mod.default;
            return this._db;
        } catch {
            return null;
        }
    },

    setDB(db) {
        this._db = db;
    },

    async fetchKpis() {
        return this.state.kpis;
    },

    async cargarPagina() {
        const { currentPage, itemsPerPage, currentFilter, searchQuery, sortColumn, sortDirection } = this.state;
        this.state.isLoading = true;
        this.renderGridLoading();

        try {
            const supabase = await this.getSupabase();
            if (!supabase) throw new Error('Supabase client no disponible');

            const { data: rpcRes, error } = await supabase.rpc('get_contactos_page', {
                p_page: currentPage,
                p_limit: itemsPerPage,
                p_sort_column: sortColumn || 'saldo_cartera',
                p_sort_direction: sortDirection || 'desc',
                p_search_query: searchQuery || '',
                p_filter_criteria: currentFilter || 'todos'
            });

            if (error) throw error;

            const res = typeof rpcRes === 'string' ? JSON.parse(rpcRes) : rpcRes;
            const rows = res?.data || [];
            const total = res?.total_count || 0;
            const kpis = res?.kpis || {};

            this.state.contactos = rows;
            this.state.totalCount = total;
            this.state.kpis = { ...this.state.kpis, ...kpis };
            this.state.isLoading = false;

            this.renderGrid(rows, total);
            this.renderKpis(this.state.kpis);

            if (this.state.view === 'grafico') {
                await this.renderAnalyticsView();
            }
        } catch (err) {
            console.error('Error cargando contactos:', err);
            this.state.isLoading = false;

            // Fallback a IndexedDB local si Supabase falla o está offline
            try {
                const db = await this.getDB();
                const locales = db ? await db.getAll('contactos') : [];
                const filtrados = (locales || []).filter(c => {
                    if (c.estado === 'inactive') return false;
                    if (searchQuery) {
                        const q = searchQuery.toLowerCase();
                        const match = (c.nombre || '').toLowerCase().includes(q) || (c.nit || '').toLowerCase().includes(q) || (c.telefono || '').toLowerCase().includes(q);
                        if (!match) return false;
                    }
                    if (currentFilter === 'cliente') return c.es_cliente !== false;
                    if (currentFilter === 'proveedor') return c.es_proveedor;
                    return true;
                });
                this.state.contactos = filtrados.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                this.state.totalCount = filtrados.length;
                this.renderGrid(this.state.contactos, this.state.totalCount);
            } catch (e2) {
                this.renderGrid([], 0);
            }
        }
    },

    async _cargarClienteCompleto(id) {
        const supabase = await this.getSupabase();
        const db = await this.getDB();

        if (!supabase) {
            const c = db ? await db.get('contactos', id) : null;
            return {
                contacto: c,
                facturasPendientes: [],
                totalSaldoPendiente: 0,
                maxDiasMora: 0,
                historialFacturas: [],
                historialPagos: []
            };
        }

        const [contacto, facturasCarteraRes, facturasHistorialRes, pagosRes] = await Promise.all([
            (db ? db.get('contactos', id) : Promise.resolve(null)).then(c => c || supabase.from('contactos').select('*').eq('id', id).single().then(r => r.data)),
            supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxc', p_contacto_id: String(id) }),
            supabase.from('facturas')
                .select('id, numero, fecha, vencimiento, total, saldo_original, estado, tipo')
                .eq('contacto_id', id)
                .eq('tipo', 'venta')
                .order('fecha', { ascending: false })
                .limit(20),
            supabase.from('pagos_ingresos')
                .select('id, numero, numero_recibo, grupo_pago_id, fecha, monto, categoria, metodo_pago, estado, factura_id, cuenta_id')
                .eq('contacto_id', id)
                .order('fecha', { ascending: false })
                .limit(20)
        ]);

        const hoy = new Date();
        const facturasPendientes = (facturasCarteraRes.data || []).map(f => {
            const fechaVenc = f.vencimiento || f.fecha;
            const diffDias = Math.floor((hoy - new Date(fechaVenc)) / (1000 * 60 * 60 * 24));
            return {
                ...f,
                diasMora: diffDias
            };
        });

        const totalSaldoPendiente = facturasPendientes.reduce((acc, f) => acc + (parseFloat(f.saldo) || 0), 0);
        const maxDiasMora = facturasPendientes.reduce((max, f) => Math.max(max, f.diasMora), 0);

        return {
            contacto,
            facturasPendientes,
            totalSaldoPendiente,
            maxDiasMora,
            historialFacturas: facturasHistorialRes.data || [],
            historialPagos: pagosRes.data || []
        };
    },

    async fetchAnalyticsData() {
        const supabase = await this.getSupabase();
        if (!supabase) return { topClients: [], aging: { vigente: 0, mora1_30: 0, mora31_60: 0, moraMas60: 0 } };

        try {
            const [topRes, carteraRes] = await Promise.all([
                supabase
                    .from('facturas')
                    .select('contacto_id, total, contactos(nombre)')
                    .eq('tipo', 'venta')
                    .not('estado', 'in', '("anulada","void")'),
                supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxc' })
            ]);

            const clientesVentas = {};
            (topRes.data || []).forEach(f => {
                const nombre = f.contactos?.nombre || 'Cliente General';
                clientesVentas[nombre] = (clientesVentas[nombre] || 0) + (parseFloat(f.total) || 0);
            });

            const sortedClients = Object.entries(clientesVentas)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            const aging = { vigente: 0, mora1_30: 0, mora31_60: 0, moraMas60: 0 };
            const hoy = new Date();
            (carteraRes.data || []).forEach(c => {
                const saldo = parseFloat(c.saldo) || 0;
                const dias = Math.floor((hoy - new Date(c.vencimiento || c.fecha)) / (1000 * 60 * 60 * 24));
                if (dias <= 0) aging.vigente += saldo;
                else if (dias <= 30) aging.mora1_30 += saldo;
                else if (dias <= 60) aging.mora31_60 += saldo;
                else aging.moraMas60 += saldo;
            });

            return {
                topClients: sortedClients,
                aging
            };
        } catch (e) {
            console.error('Error fetching analytics data:', e);
            return { topClients: [], aging: { vigente: 0, mora1_30: 0, mora31_60: 0, moraMas60: 0 } };
        }
    }
};
