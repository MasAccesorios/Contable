// js/modules/bancos/conciliacion.data.js
// Capa de Acceso a Datos, Motor de Cuadre Reactivo y Persistencia de Conciliaciones Bancarias 360°

export const ConciliacionData = {
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

    async getDB() {
        if (this._db) return this._db;
        if (typeof window !== 'undefined' && window.DB) return window.DB;
        try {
            const mod = await import('../../core/db.js');
            this._db = mod.default || mod.DB || mod;
            return this._db;
        } catch {
            return null;
        }
    },

    getBankAvatar(cuenta = {}) {
        const nombre = String(cuenta.nombre || '').trim();
        const tipo = String(cuenta.tipo || '').toLowerCase();
        const nombreLower = nombre.toLowerCase();

        if (nombreLower.includes('bancolombia')) {
            return {
                initials: 'BC',
                brand: 'Bancolombia',
                icon: 'bi-bank',
                bg: '#fef3c7',
                color: '#d97706'
            };
        }
        if (nombreLower.includes('daviplata')) {
            return {
                initials: 'DP',
                brand: 'DaviPlata',
                icon: 'bi-phone',
                bg: '#fee2e2',
                color: '#dc2626'
            };
        }
        if (nombreLower.includes('davivienda')) {
            return {
                initials: 'DV',
                brand: 'Davivienda',
                icon: 'bi-bank',
                bg: '#fee2e2',
                color: '#dc2626'
            };
        }
        if (nombreLower.includes('nu bank') || nombreLower.startsWith('nu ') || nombreLower === 'nu') {
            return {
                initials: 'NU',
                brand: 'Nu',
                icon: 'bi-credit-card-2-front',
                bg: '#f3e8ff',
                color: '#7e22ce'
            };
        }
        if (nombreLower.includes('nequi')) {
            return {
                initials: 'NQ',
                brand: 'Nequi',
                icon: 'bi-phone',
                bg: '#fdf2f8',
                color: '#db2777'
            };
        }
        if (nombreLower.includes('binance') || nombreLower.includes('crypto')) {
            return {
                initials: 'BN',
                brand: 'Binance',
                icon: 'bi-currency-bitcoin',
                bg: '#fef9c3',
                color: '#ca8a04'
            };
        }
        if (tipo === 'caja' || tipo === 'efectivo' || nombreLower.includes('caja') || nombreLower.includes('efectivo')) {
            return {
                initials: 'CJ',
                brand: 'Efectivo',
                icon: 'bi-cash-stack',
                bg: '#ecfdf5',
                color: '#059669'
            };
        }

        const parts = nombre.split(/\s+/).filter(Boolean);
        let initials = parts[0] ? parts[0].substring(0, 2).toUpperCase() : 'BK';
        if (parts.length > 1 && parts[1][0]) {
            initials = (parts[0][0] + parts[1][0]).toUpperCase();
        }

        return {
            initials,
            brand: 'Banco',
            icon: 'bi-bank',
            bg: '#f1f5f9',
            color: '#475569'
        };
    },

    calcularDiferencia({
        saldoAnterior = 0,
        saldoSistema = 0,
        saldoBancario = 0,
        movimientos = [],
        seleccionados = new Set(),
        ajustes = {}
    } = {}) {
        const staticDiff = Number(saldoBancario) - Number(saldoSistema);

        let sumaVisibleNoMarcada = 0;
        let sumaMarcados = 0;
        let countMarcados = 0;

        (movimientos || []).forEach(m => {
            const isIngreso = m.tipo === 'ingreso' || m.tipo === 'in';
            const montoNum = Number(m.monto || 0);
            const delta = isIngreso ? montoNum : -montoNum;

            if (seleccionados && seleccionados.has(m.id)) {
                sumaMarcados += delta;
                countMarcados++;
            } else {
                sumaVisibleNoMarcada += delta;
            }
        });

        const ajusteGastos = Number(ajustes?.gastos || 0);
        const ajusteImpuestos = Number(ajustes?.impuestos || 0);
        const ajusteEntradas = Number(ajustes?.entradas || 0);

        const diferencia = Math.round((staticDiff + sumaVisibleNoMarcada + ajusteGastos + ajusteImpuestos - ajusteEntradas) * 100) / 100;
        const absDiff = Math.abs(diferencia);

        let estadoSemaforo = 'descuadrado';
        if (absDiff < 0.01) {
            estadoSemaforo = 'cuadrado';
        } else if (absDiff <= 100) {
            estadoSemaforo = 'tolerancia';
        }

        return {
            diferencia,
            estadoSemaforo,
            sumaVisibleNoMarcada,
            sumaMarcados,
            countMarcados,
            totalMovimientos: movimientos.length
        };
    },

    filtrarMovimientos(movimientos = [], tab = 'todos', searchQuery = '', seleccionados = new Set()) {
        const query = String(searchQuery || '').toLowerCase().trim();

        return (movimientos || []).filter(m => {
            const isIngreso = m.tipo === 'ingreso' || m.tipo === 'in';
            const isMarcado = seleccionados && seleccionados.has(m.id);

            // 1. Filtro por Pestaña
            if (tab === 'ingresos') {
                if (!isIngreso) return false;
            } else if (tab === 'egresos') {
                if (isIngreso) return false;
            } else if (tab === 'marcados') {
                if (!isMarcado) return false;
            } else if (tab === 'pendientes') {
                if (isMarcado) return false;
            }

            // 2. Filtro por Buscador
            if (query) {
                const detalle = String(m.detalle || m.descripcion || m.observaciones || '').toLowerCase();
                const ref = String(m.referencia || '').toLowerCase();
                const monto = String(m.monto || '');
                if (!detalle.includes(query) && !ref.includes(query) && !monto.includes(query)) {
                    return false;
                }
            }

            return true;
        });
    },

    prepararPayloadGuardado({
        editingId = null,
        bancoId = null,
        fechaDesde = '',
        fechaHasta = '',
        saldoBancario = 0,
        saldoSistema = 0,
        diferenciaFinal = 0,
        movimientosConciliados = []
    } = {}) {
        return {
            p_id: editingId ? parseInt(editingId, 10) : null,
            p_banco_id: parseInt(bancoId, 10),
            p_fecha_desde: fechaDesde,
            p_fecha_hasta: fechaHasta,
            p_saldo_bancario: Number(saldoBancario),
            p_saldo_sistema: Number(saldoSistema),
            p_diferencia: Number(diferenciaFinal),
            p_movimientos_conciliados: Array.from(movimientosConciliados || []).map(id => parseInt(id, 10)).filter(Boolean)
        };
    },

    async loadHistorial(bancoId = null) {
        const rawId = (bancoId !== null && bancoId !== undefined) ? bancoId : this.state.bancoId;
        const targetBancoId = (rawId !== null && rawId !== undefined && rawId !== '') ? parseInt(rawId, 10) : null;
        
        const DB = await this.getDB();
        const supabaseClient = await this.getSupabase();

        if (DB && typeof DB.invalidateCache === 'function') {
            DB.invalidateCache('conciliaciones');
        }

        try {
            if (supabaseClient) {
                let query = supabaseClient
                    .from('conciliaciones')
                    .select('*')
                    .order('fecha_guardado', { ascending: false });

                if (targetBancoId !== null && !isNaN(targetBancoId)) {
                    query = query.eq('banco_id', targetBancoId);
                }

                const { data, error } = await query;
                if (error) throw error;
                this.state.historialConciliaciones = data || [];
            } else if (DB && DB.getAll) {
                const all = (await DB.getAll('conciliaciones')) || [];
                this.state.historialConciliaciones = (targetBancoId !== null && !isNaN(targetBancoId))
                    ? all.filter(c => parseInt(c.banco_id, 10) === targetBancoId)
                    : all;
            }
        } catch (err) {
            console.error('[ConciliacionData] Error cargando historial:', err);
            if (DB && DB.getAll) {
                const all = (await DB.getAll('conciliaciones')) || [];
                this.state.historialConciliaciones = (targetBancoId !== null && !isNaN(targetBancoId))
                    ? all.filter(c => parseInt(c.banco_id, 10) === targetBancoId)
                    : all;
            }
        }
        return this.state.historialConciliaciones;
    },

    async loadData() {
        const DB = await this.getDB();
        const supabaseClient = await this.getSupabase();

        let dbCuentas = [];
        if (DB && DB.getAll) {
            dbCuentas = (await DB.getAll('cuentas_bancarias')) || [];
        } else if (supabaseClient) {
            const { data } = await supabaseClient.from('cuentas_bancarias').select('*').order('nombre');
            dbCuentas = data || [];
        }

        this.state.cuentas = (dbCuentas || []).filter(c => c.estado !== 'inactivo' && c.estado !== 'inactive');
        
        if (!this.state.bancoId && this.state.cuentas.length > 0) {
            this.state.bancoId = parseInt(this.state.cuentas[0].id, 10);
        }
        await this.loadHistorial(this.state.bancoId);
    },

    async cargarDatosRPC() {
        if (!this.state.bancoId) return;
        const targetCuentaId = parseInt(this.state.bancoId, 10);
        if (isNaN(targetCuentaId)) return;

        const supabaseClient = await this.getSupabase();
        if (!supabaseClient) return;

        const editId = this.state.editingConciliacionId ? parseInt(this.state.editingConciliacionId, 10) : null;
        const { data, error } = await supabaseClient.rpc('get_conciliacion_bancaria', {
            p_cuenta_id:       targetCuentaId,
            p_fecha_desde:     this.state.fechaDesde,
            p_fecha_hasta:     this.state.fechaHasta,
            p_conciliacion_id: (editId && !isNaN(editId)) ? editId : null
        });

        if (error) {
            console.error('[ConciliacionData] RPC error:', error);
            return;
        }

        if (data) {
            this.state.saldoAnterior    = Number(data.saldo_anterior) || 0;
            this.state.entradas         = Number(data.entradas)       || 0;
            this.state.salidas          = Number(data.salidas)        || 0;
            this.state.movimientosRango = data.movimientos            || [];
        }
    }
};
