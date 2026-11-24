// js/modules/bancos/bancos.data.js
// Capa de Acceso a Datos, KPIs, Normalización y Exportación de Bancos y Cajas 360°

export const TesoreriaData = {
    FECHA_CORTE_CONCILIACION: '2026-08-01',
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
        if (tipo === 'caja' || nombreLower.includes('caja') || nombreLower.includes('efectivo')) {
            return {
                initials: 'CJ',
                brand: 'Efectivo',
                icon: 'bi-cash-stack',
                bg: '#ecfdf5',
                color: '#059669'
            };
        }

        // Genérico para cualquier otra entidad
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

    calcularKpis(cuentas = [], saldos = {}, concCount = 0) {
        let totalConsolidado = 0;
        let totalBancos = 0;
        let bancosCount = 0;
        let totalCajas = 0;
        let cajasCount = 0;
        let inactivasCount = 0;
        let activasCount = 0;

        (cuentas || []).forEach(c => {
            const isInactive = c.estado === 'inactivo' || c.estado === 'inactive';
            const isActivo = !isInactive;
            const saldo = Number(
                saldos[c.id] !== undefined
                    ? saldos[c.id]
                    : (saldos[c.nombre] !== undefined
                        ? saldos[c.nombre]
                        : (c.saldo_inicial || 0))
            );
            const tipoLower = String(c.tipo || '').toLowerCase().trim();
            const nombreLower = String(c.nombre || '').toLowerCase();
            const isCaja = tipoLower === 'caja' || tipoLower === 'efectivo' || nombreLower.includes('caja') || nombreLower.includes('efectivo');

            if (isActivo) {
                activasCount++;
                totalConsolidado += saldo;
                if (isCaja) {
                    totalCajas += saldo;
                    cajasCount++;
                } else {
                    totalBancos += saldo;
                    bancosCount++;
                }
            } else {
                inactivasCount++;
            }
        });

        return {
            totalConsolidado,
            totalBancos,
            bancosCount,
            totalCajas,
            cajasCount,
            movimientosPorConciliar: Number(concCount) || 0,
            tabCounts: {
                todas: activasCount,
                bancos: bancosCount,
                cajas: cajasCount,
                inactivas: inactivasCount
            }
        };
    },

    filtrarCuentas(cuentas = [], tab = 'todas', searchQuery = '', saldos = {}) {
        const query = String(searchQuery || '').toLowerCase().trim();

        return (cuentas || []).filter(c => {
            const isInactive = c.estado === 'inactivo' || c.estado === 'inactive';
            const isActivo = !isInactive;
            const tipoLower = String(c.tipo || '').toLowerCase().trim();
            const nombreLower = String(c.nombre || '').toLowerCase();
            const isCaja = tipoLower === 'caja' || tipoLower === 'efectivo' || nombreLower.includes('caja') || nombreLower.includes('efectivo');

            // 1. Filtro por Pestaña
            if (tab === 'bancos') {
                if (!isActivo || isCaja) return false;
            } else if (tab === 'cajas') {
                if (!isActivo || !isCaja) return false;
            } else if (tab === 'inactivas') {
                if (isActivo) return false;
            } else {
                // 'todas' muestra las activas
                if (!isActivo) return false;
            }

            // 2. Filtro por Buscador
            if (query) {
                const nombreMatch = String(c.nombre || '').toLowerCase().includes(query);
                const tipoMatch = String(c.tipo || '').toLowerCase().includes(query);
                const numeroMatch = String(c.numero || '').toLowerCase().includes(query);
                if (!nombreMatch && !tipoMatch && !numeroMatch) return false;
            }

            return true;
        });
    },

    async loadData(meses = 6) {
        const supabaseClient = await this.getSupabase();
        const DB = await this.getDB();

        // 1. Cargar histórico para gráficas
        if (supabaseClient) {
            const { data: dataGrafica, error: errGrafica } = await supabaseClient.rpc('get_ingresos_egresos_por_mes', { meses: meses });
            if (errGrafica) console.error('[TesoreriaData] Error cargando gráfica:', errGrafica);
            this.state.datosGrafica = dataGrafica || [];
        } else {
            this.state.datosGrafica = [];
        }

        // 2. Cargar cuentas bancarias desde BD
        let dbCuentas = [];
        if (DB && DB.getAll) {
            dbCuentas = (await DB.getAll('cuentas_bancarias')) || [];
        } else if (supabaseClient) {
            const { data } = await supabaseClient.from('cuentas_bancarias').select('*').order('nombre');
            dbCuentas = data || [];
        }

        this.state.todasLasCuentas = dbCuentas || [];
        this.state.cuentasActivas = this.state.todasLasCuentas.filter(c => c.estado !== 'inactivo');

        // 3. Cargar saldos consolidados
        this.state.saldos = {};
        if (supabaseClient) {
            const { data: saldos, error } = await supabaseClient.rpc('get_saldos_por_cuenta');
            if (error) { console.error('[TesoreriaData] Error cargando saldos:', error); }
            if (saldos) {
                saldos.forEach(s => {
                    this.state.saldos[s.cuenta_id] = Number(s.saldo || 0);
                    if (s.nombre) this.state.saldos[s.nombre] = Number(s.saldo || 0);
                });
            }
        }

        // 4. Conteo de transacciones pendientes por conciliar (a partir de la fecha de corte y solo en cuentas activas)
        let conteoPendientes = 0;
        if (supabaseClient) {
            try {
                const cuentasActivasIds = (this.state.todasLasCuentas || [])
                    .filter(c => c.estado !== 'inactivo' && c.estado !== 'inactive')
                    .map(c => c.id);

                let query = supabaseClient
                    .from('pagos_ingresos')
                    .select('id', { count: 'exact', head: true })
                    .is('conciliacion_id', null)
                    .is('conciliado_en', null)
                    .not('cuenta_id', 'is', null)
                    .neq('estado', 'anulado');

                if (cuentasActivasIds.length > 0) {
                    query = query.in('cuenta_id', cuentasActivasIds);
                }

                if (this.FECHA_CORTE_CONCILIACION) {
                    query = query.gte('fecha', this.FECHA_CORTE_CONCILIACION);
                }

                const { count } = await query;
                conteoPendientes = count || 0;
            } catch (err) {
                console.warn('[TesoreriaData] Error consultando pagos pendientes:', err);
            }
        }

        // 5. Calcular KPIs ejecutivos
        this.state.kpis = this.calcularKpis(this.state.todasLasCuentas, this.state.saldos, conteoPendientes);
        this.state.totalConsolidado = this.state.kpis.totalConsolidado;

        // 6. Actualizar vistas
        if (typeof this.renderResumen === 'function') this.renderResumen();
        if (typeof this.renderTabla === 'function') this.renderTabla();

        // 7. Cargar Chart.js y renderizar vista analítica
        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = () => {
                if (typeof this.renderChart === 'function') this.renderChart();
            };
            document.head.appendChild(script);
        } else {
            if (typeof this.renderChart === 'function') this.renderChart();
        }
    },

    async cargarMovimientosCuenta(cuentaId, limit = 5) {
        if (!cuentaId) return [];
        const supabaseClient = await this.getSupabase();
        if (!supabaseClient) return [];

        try {
            const { data, error } = await supabaseClient.rpc('get_movimientos_banco', {
                p_cuenta_id: parseInt(cuentaId, 10),
                p_offset: 0,
                p_limit: limit,
                p_search: '',
                p_tipo: 'todos'
            });
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('[TesoreriaData] Error cargando movimientos de cuenta:', err);
            return [];
        }
    },

    exportarExcel() {
        const btn = document.getElementById('btn-export-excel');
        const icon = btn?.querySelector('i');
        const originalClass = icon ? icon.className : '';

        if (icon) {
            icon.className = 'spinner-border spinner-border-sm me-1';
        }

        try {
            if (typeof window === 'undefined' || !window.XLSX) {
                if (typeof alert !== 'undefined') alert('La librería SheetJS (XLSX) no está disponible en este momento.');
                return;
            }

            const cuentas = this.state.todasLasCuentas || [];
            const saldos = this.state.saldos || {};

            // Sanitización contra inyección de fórmulas CSV / Excel (CWE-1236)
            const sanitizeExcel = (val) => {
                if (val === null || val === undefined) return '';
                const str = String(val).trim();
                if (/^[=+\-@\t\r]/.test(str)) {
                    return "'" + str;
                }
                return str;
            };

            const filas = cuentas.map(c => {
                const saldo = Number(saldos[c.id] !== undefined ? saldos[c.id] : (saldos[c.nombre] || 0));
                return {
                    'ID': c.id,
                    'Nombre de Cuenta': sanitizeExcel(c.nombre),
                    'Tipo': sanitizeExcel(c.tipo),
                    'Número': sanitizeExcel(c.numero || c.numero_cuenta || '---'),
                    'Estado': c.estado === 'inactivo' ? 'Inactiva' : 'Activa',
                    'Saldo Actual': saldo
                };
            });

            const ws = window.XLSX.utils.json_to_sheet(filas);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, 'Bancos y Cajas');

            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            window.XLSX.writeFile(wb, `Reporte_Bancos_${dateStr}.xlsx`);
        } catch (err) {
            console.error('[TesoreriaData] Error exportando Excel:', err);
            if (typeof alert !== 'undefined') alert('Ocurrió un error al generar el archivo Excel: ' + err.message);
        } finally {
            if (icon) {
                icon.className = originalClass;
            }
        }
    },

    async ejecutarTransferencia(origenId, destinoId, monto, fecha, nota) {
        const origenIdInt = parseInt(origenId, 10);
        const destinoIdInt = parseInt(destinoId, 10);
        const montoNum = Number(monto);

        if (!origenId || !destinoId || isNaN(origenIdInt) || isNaN(destinoIdInt) || !Number.isFinite(montoNum) || montoNum <= 0 || !fecha) {
            if (typeof alert !== 'undefined') alert('Por favor completa todos los campos correctamente.');
            return false;
        }

        if (origenIdInt === destinoIdInt) {
            if (typeof alert !== 'undefined') alert('La cuenta de origen y destino no pueden ser la misma.');
            return false;
        }

        const DB = await this.getDB();

        const cuentaOrigen = (this.state.todasLasCuentas || []).find(c => String(c.id) === String(origenId));
        const cuentaDestino = (this.state.todasLasCuentas || []).find(c => String(c.id) === String(destinoId));
        const nombreOrigen = cuentaOrigen?.nombre || String(origenId);
        const nombreDestino = cuentaDestino?.nombre || String(destinoId);

        const transferenciaId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });

        const cleanNota = nota ? String(nota).trim() : '';
        const egreso = {
            tipo: 'out',
            monto: montoNum,
            fecha: fecha,
            cuenta_id: origenIdInt,
            factura_id: null,
            categoria: 'Transferencia',
            observaciones: `Transferencia a ${nombreDestino}${cleanNota ? ' — ' + cleanNota : ''}`,
            estado: 'open',
            grupo_pago_id: transferenciaId,
            transferencia_id: transferenciaId
        };

        const ingreso = {
            tipo: 'in',
            monto: montoNum,
            fecha: fecha,
            cuenta_id: destinoIdInt,
            factura_id: null,
            categoria: 'Transferencia',
            observaciones: `Transferencia desde ${nombreOrigen}${cleanNota ? ' — ' + cleanNota : ''}`,
            estado: 'open',
            grupo_pago_id: transferenciaId,
            transferencia_id: transferenciaId
        };

        try {
            await DB.save('transacciones', egreso);
            await DB.save('transacciones', ingreso);
            return true;
        } catch (err) {
            console.error('[TesoreriaData] Error al guardar transferencia:', err);
            if (typeof alert !== 'undefined') alert('Error al guardar la transferencia: ' + (err?.message || JSON.stringify(err)));
            return false;
        }
    },

    async toggleEstadoCuenta(id, estadoActual) {
        if (!id) return;
        const nuevoEstado = estadoActual === 'inactivo' ? 'activo' : 'inactivo';
        const accionStr = nuevoEstado === 'inactivo' ? 'desactivar' : 'activar';

        if (typeof window !== 'undefined' && window.CoreActions && window.CoreActions.showConfirmModal) {
            window.CoreActions.showConfirmModal(
                `¿Seguro que deseas ${accionStr} esta cuenta?`,
                async () => {
                    await this.actualizarEstadoDB(id, nuevoEstado);
                }
            );
        } else {
            if (confirm(`¿Seguro que deseas ${accionStr} esta cuenta?`)) {
                await this.actualizarEstadoDB(id, nuevoEstado);
            }
        }
    },

    async actualizarEstadoDB(id, nuevoEstado) {
        try {
            const DB = await this.getDB();
            const cuenta = await DB.get('cuentas_bancarias', id);
            if (cuenta) {
                cuenta.estado = nuevoEstado;
                await DB.save('cuentas_bancarias', cuenta);
                await this.loadData();
            }
        } catch (err) {
            console.error('[TesoreriaData] Error al actualizar estado:', err);
            if (typeof alert !== 'undefined') alert('Error al actualizar el estado de la cuenta.');
        }
    }
};
