import { supabase } from '../../../core/supabase.js';
import { CoreActions } from '../../../shared/crud.js';

export const PagosRealizadosData = {
    async calcularKPIs() {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();

            const startCurrentMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const prevMonthDate = new Date(year, month - 1, 1);
            const startPrevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
            const lastPrevMonthDate = new Date(year, month, 0);
            const endPrevMonth = `${lastPrevMonthDate.getFullYear()}-${String(lastPrevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(lastPrevMonthDate.getDate()).padStart(2, '0')}`;
            const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            // Consultas concurrentes en paralelo con Promise.all
            const [
                kpiRes,
                prevRes,
                todayRes,
                txCountRes,
                cuentasRes,
                concRes,
                monthMovsRes
            ] = await Promise.all([
                supabase.rpc('get_pagos_kpis', { p_tipo: 'out' }),
                supabase.from('pagos_ingresos')
                    .select('monto')
                    .eq('tipo', 'out')
                    .neq('estado', 'anulado')
                    .gte('fecha', startPrevMonth)
                    .lte('fecha', endPrevMonth),
                supabase.from('pagos_ingresos')
                    .select('monto')
                    .eq('tipo', 'out')
                    .neq('estado', 'anulado')
                    .eq('fecha', todayStr),
                supabase.from('pagos_ingresos')
                    .select('id', { count: 'exact', head: true })
                    .eq('tipo', 'out')
                    .neq('estado', 'anulado')
                    .gte('fecha', startCurrentMonth),
                supabase.from('cuentas_bancarias')
                    .select('id, nombre, tipo')
                    .eq('estado', 'active')
                    .order('nombre'),
                supabase.from('conciliaciones')
                    .select('movimientos_conciliados'),
                supabase.from('pagos_ingresos')
                    .select('id, monto')
                    .eq('tipo', 'out')
                    .neq('estado', 'anulado')
                    .gte('fecha', startCurrentMonth)
            ]);

            const totalActual = parseFloat(kpiRes?.data?.total) || 0;
            const totalAnterior = (prevRes?.data || []).reduce((sum, r) => sum + Number(r.monto || 0), 0);

            let variacion = 0;
            if (totalAnterior > 0) {
                variacion = Math.round(((totalActual - totalAnterior) / totalAnterior) * 100);
            } else if (totalActual > 0) {
                variacion = 100;
            }

            const totalHoy = (todayRes?.data || []).reduce((sum, r) => sum + Number(r.monto || 0), 0);
            const txCount = txCountRes?.count || 0;
            this.state.cuentasBancarias = cuentasRes?.data || [];

            // Conciliación pendiente
            let montoPendiente = 0;
            let conteoPendiente = 0;
            const concSet = new Set((concRes?.data || []).flatMap(c => c.movimientos_conciliados || []));

            if (monthMovsRes?.data) {
                monthMovsRes.data.forEach(m => {
                    if (!concSet.has(m.id)) {
                        montoPendiente += Number(m.monto || 0);
                        conteoPendiente++;
                    }
                });
            }

            this.state.kpis = {
                total: totalActual,
                totalAnterior,
                variacion,
                transaccionesMes: txCount,
                totalHoy,
                montoPendiente,
                conteoPendiente
            };
        } catch (e) {
            console.error('Error calculando KPIs de pagos realizados:', e);
        }
    },

    async _cargarComprobanteAgrupado(id) {
        const { data: t } = await supabase.from('pagos_ingresos').select('*, contactos(*), cuentas_bancarias(*), facturas(*, contactos(*))').eq('id', id).single();
        if (!t) return null;
        if (t.grupo_pago_id) {
            const { data: grupo } = await supabase.from('pagos_ingresos').select('*, contactos(*), facturas(*, contactos(*))').eq('grupo_pago_id', t.grupo_pago_id);
            if (grupo && grupo.length > 1) {
                t.itemsGrupo = grupo;
                t.monto = grupo.reduce((sum, p) => sum + Number(p.monto), 0);
            }
        }
        return t;
    },

    async cargarPagos() {
        this.state.isLoading = true;
        this.renderGrid();

        try {
            const isFiltered = (this.state.selectedAccount && this.state.selectedAccount !== 'todas') ||
                               (this.state.selectedTab && this.state.selectedTab !== 'todos');

            if (!isFiltered) {
                // Modo estándar: paginación server-side nativa
                const { data, error } = await supabase.rpc('get_pagos_lista', {
                    p_tipo: 'out',
                    p_page: this.state.currentPage,
                    p_limit: this.state.itemsPerPage,
                    p_search: this.state.searchQuery
                });

                if (error) throw error;

                this.state.pagos = data || [];
                this.state.totalItems = this.state.pagos.length > 0 ? Number(this.state.pagos[0].total_count) : 0;
            } else {
                // Modo con filtros activos: se consulta el set completo para filtrar con consistencia en paginador
                const { data, error } = await supabase.rpc('get_pagos_lista', {
                    p_tipo: 'out',
                    p_page: 1,
                    p_limit: 1000,
                    p_search: this.state.searchQuery
                });

                if (error) throw error;

                let filtrados = data || [];

                if (this.state.selectedAccount && this.state.selectedAccount !== 'todas') {
                    filtrados = filtrados.filter(p => String(p.cuenta_bancaria || '').toLowerCase() === this.state.selectedAccount.toLowerCase());
                }

                if (this.state.selectedTab === 'pendientes') {
                    filtrados = filtrados.filter(p => !p.estado_conciliacion && p.estado_transaccion !== 'anulado');
                } else if (this.state.selectedTab === 'conciliados') {
                    filtrados = filtrados.filter(p => !!p.estado_conciliacion && p.estado_transaccion !== 'anulado');
                } else if (this.state.selectedTab === 'con_factura') {
                    filtrados = filtrados.filter(p => !!p.factura_id);
                } else if (this.state.selectedTab === 'directos') {
                    filtrados = filtrados.filter(p => !p.factura_id);
                } else if (this.state.selectedTab === 'anulados') {
                    filtrados = filtrados.filter(p => p.estado_transaccion === 'anulado');
                }

                this.state.totalItems = filtrados.length;
                const totalPages = Math.ceil(this.state.totalItems / this.state.itemsPerPage) || 1;
                if (this.state.currentPage > totalPages) {
                    this.state.currentPage = totalPages;
                }

                const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
                this.state.pagos = filtrados.slice(startIndex, startIndex + this.state.itemsPerPage);
            }
        } catch (error) {
            console.error('Error cargando pagos realizados:', error);
            CoreActions.showWarningModal('Error al cargar la lista de pagos: ' + (error.message || error));
        } finally {
            this.state.isLoading = false;
            this.renderGrid();
        }
    },

    async cargarDatosGrafico() {
        try {
            const now = new Date();
            const past30 = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

            const { data } = await supabase
                .from('pagos_ingresos')
                .select('id, fecha, monto, categoria, cuentas_bancarias(nombre), contactos(nombre)')
                .eq('tipo', 'out')
                .neq('estado', 'anulado')
                .gte('fecha', past30)
                .order('fecha', { ascending: true });

            const dailyMap = {};
            const accountMap = {};
            const vendorMap = {};

            (data || []).forEach(p => {
                const f = p.fecha || 'Sin fecha';
                const cta = p.cuentas_bancarias?.nombre || 'Efectivo / Caja';
                const prov = p.contactos?.nombre || 'Proveedor General';
                const val = Number(p.monto) || 0;

                dailyMap[f] = (dailyMap[f] || 0) + val;
                accountMap[cta] = (accountMap[cta] || 0) + val;
                vendorMap[prov] = (vendorMap[prov] || 0) + val;
            });

            const topVendors = Object.entries(vendorMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([nombre, total]) => ({ nombre, total }));

            return {
                dailyLabels: Object.keys(dailyMap),
                dailyValues: Object.values(dailyMap),
                accountLabels: Object.keys(accountMap),
                accountValues: Object.values(accountMap),
                topVendors
            };
        } catch (e) {
            console.error('Error cargando analítica de egresos:', e);
            return null;
        }
    }
};
