/**
 * Módulo de Datos y Lógica Contable de Cuentas de Cobro
 * Maneja el estado de cartera, cálculo de KPIs ejecutivos, filtros y paginación.
 */

export const CuentaCobroData = {
    _supabase: null,

    getSupabase() {
        return this._supabase;
    },

    setSupabase(client) {
        this._supabase = client;
    },

    /**
     * Determina el estado de cartera de una cuenta de cobro según forma de pago,
     * fecha de vencimiento y abonos.
     * @param {Object} doc - Registro de la cuenta de cobro.
     * @param {Date|string} [hoyRef=new Date()] - Fecha de referencia para cálculos de vencimiento.
     * @returns {Object} Cuenta decorada con estado, saldo, totalCobrado y diasVencida.
     */
    determinarEstadoYCartera(doc, hoyRef = new Date()) {
        if (!doc) return null;

        const total = Math.round(((parseFloat(doc.total) || 0) + Number.EPSILON) * 100) / 100;
        const totalPagadoParsed = parseFloat(doc.total_pagado);
        const totalPagadoOriginal = !isNaN(totalPagadoParsed) ? totalPagadoParsed : undefined;

        let saldoOriginal = undefined;
        if (doc.saldo !== undefined && doc.saldo !== null) {
            const parsed = parseFloat(doc.saldo);
            if (!isNaN(parsed)) saldoOriginal = parsed;
        }

        const isAnulada = doc.estado === 'anulada' || doc.is_anulada === true || doc.anulada === true;

        if (isAnulada) {
            return {
                ...doc,
                total,
                saldo: 0,
                totalCobrado: 0,
                diasVencida: 0,
                estado: 'anulada',
                isCobrada: false,
                isVencida: false,
                isPendiente: false,
                isAnulada: true
            };
        }

        const estadoDoc = doc.estado ? String(doc.estado).trim().toLowerCase() : undefined;
        const formaPago = String(doc.forma_pago || '').trim().toLowerCase();
        const esContado = formaPago === 'contado';

        // Si explícitamente se marcó como cobrada o pagada, o si el saldo explícito es 0 o menor
        if (estadoDoc === 'cobrada' || estadoDoc === 'pagada' || (saldoOriginal !== undefined && saldoOriginal <= 0 && total > 0)) {
            return {
                ...doc,
                total,
                saldo: 0,
                totalCobrado: total,
                diasVencida: 0,
                estado: 'cobrada',
                isCobrada: true,
                isVencida: false,
                isPendiente: false,
                isAnulada: false
            };
        }

        // Cuenta con saldo pendiente o por cobrar
        const saldoCalculado = saldoOriginal !== undefined 
            ? Math.max(0, saldoOriginal)
            : (totalPagadoOriginal !== undefined ? Math.max(0, total - totalPagadoOriginal) : total);
        const totalCobradoCalculado = Math.max(0, total - saldoCalculado);

        // Parsear fecha hoy y fecha de vencimiento normalizadas a medianoche local
        const hoy = hoyRef instanceof Date ? hoyRef : new Date(hoyRef);
        const hoyMedianoche = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

        let vencDate = null;
        const rawVenc = doc.fecha_vencimiento || doc.fecha;
        if (rawVenc) {
            const strVenc = String(rawVenc).split('T')[0];
            const partes = strVenc.split('-').map(Number);
            if (partes.length === 3) {
                vencDate = new Date(partes[0], partes[1] - 1, partes[2]);
            }
        }

        let diasVencida = 0;
        let estado = 'pendiente';

        if (vencDate && vencDate < hoyMedianoche) {
            const diffMs = hoyMedianoche.getTime() - vencDate.getTime();
            diasVencida = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            estado = 'vencida';
        } else {
            estado = 'pendiente';
            diasVencida = 0;
        }

        // Si el estado en BD no fue especificado (fallback para tests o datos legacy) y es contado
        if (estadoDoc === undefined && esContado) {
            return {
                ...doc,
                total,
                saldo: 0,
                totalCobrado: total,
                diasVencida: 0,
                estado: 'cobrada',
                isCobrada: true,
                isVencida: false,
                isPendiente: false,
                isAnulada: false
            };
        }

        return {
            ...doc,
            total,
            saldo: Math.round((saldoCalculado + Number.EPSILON) * 100) / 100,
            totalCobrado: Math.round((totalCobradoCalculado + Number.EPSILON) * 100) / 100,
            diasVencida,
            estado,
            isCobrada: false,
            isVencida: estado === 'vencida',
            isPendiente: estado === 'pendiente',
            isAnulada: false
        };
    },

    /**
     * Calcula los KPIs ejecutivos financieros y operativos sobre las cuentas.
     * @param {Array<Object>} cuentas - Lista de cuentas.
     * @param {Date|string} [hoyRef=new Date()] - Fecha de referencia.
     * @returns {Object} Resumen de métricas.
     */
    calcularKPIs(cuentas = [], hoyRef = new Date()) {
        let totalEmitido = 0;
        let totalCobrado = 0;
        let totalPendiente = 0;
        let totalVencido = 0;

        let conteoTotal = (cuentas || []).length;
        let conteoCobradas = 0;
        let conteoPendientes = 0;
        let conteoVencidas = 0;
        let conteoAnuladas = 0;

        const getDoc = (this && typeof this.determinarEstadoYCartera === 'function')
            ? this.determinarEstadoYCartera.bind(this)
            : CuentaCobroData.determinarEstadoYCartera;

        (cuentas || []).forEach(item => {
            const decorada = getDoc(item, hoyRef);
            if (!decorada) return;

            if (decorada.isAnulada) {
                conteoAnuladas++;
                return;
            }

            const em = !isNaN(decorada.total) ? decorada.total : 0;
            const cob = !isNaN(decorada.totalCobrado) ? decorada.totalCobrado : 0;
            const sal = !isNaN(decorada.saldo) ? decorada.saldo : 0;

            totalEmitido += em;
            totalCobrado += cob;

            if (decorada.isCobrada) {
                conteoCobradas++;
            } else if (decorada.isVencida) {
                conteoVencidas++;
                totalPendiente += sal;
                totalVencido += sal;
            } else if (decorada.isPendiente) {
                conteoPendientes++;
                totalPendiente += sal;
            }
        });

        const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

        const kpis = {
            totalEmitido: round2(totalEmitido),
            totalCobrado: round2(totalCobrado),
            totalPendiente: round2(totalPendiente),
            totalVencido: round2(totalVencido),
            conteoTotal,
            conteoCobradas,
            conteoPendientes,
            conteoVencidas,
            conteoAnuladas
        };

        if (this.state) {
            this.state.kpis = kpis;
        }

        return kpis;
    },

    /**
     * Calcula los conteos para cada pestaña del selector Segmented Control.
     * @param {Array<Object>} cuentas 
     * @param {Date|string} [hoyRef=new Date()] 
     * @returns {{ todas: number, pendientes: number, vencidas: number, cobradas: number, anuladas: number }}
     */
    calcularTabCounts(cuentas = [], hoyRef = new Date()) {
        const counts = {
            todas: (cuentas || []).length,
            pendientes: 0,
            vencidas: 0,
            cobradas: 0,
            anuladas: 0
        };

        const getDoc = (this && typeof this.determinarEstadoYCartera === 'function')
            ? this.determinarEstadoYCartera.bind(this)
            : CuentaCobroData.determinarEstadoYCartera;

        (cuentas || []).forEach(item => {
            const doc = getDoc(item, hoyRef);
            if (!doc) return;

            if (doc.isAnulada) {
                counts.anuladas++;
            } else if (doc.isCobrada) {
                counts.cobradas++;
            } else if (doc.isVencida) {
                counts.vencidas++;
            } else if (doc.isPendiente) {
                counts.pendientes++;
            }
        });

        return counts;
    },

    /**
     * Aplica filtros por tab, búsqueda de texto libre, ordenamiento y paginación.
     * @param {Array<Object>} cuentas 
     * @param {Object} opciones 
     * @returns {{ items: Array<Object>, totalItems: number, totalPages: number, currentPage: number, itemsPerPage: number }}
     */
    filtrarYPaginar(cuentas = [], {
        selectedTab = 'todas',
        searchQuery = '',
        currentPage = 1,
        itemsPerPage = 10,
        sortBy = 'numero',
        sortOrder = 'desc',
        fechaHoy = new Date()
    } = {}) {
        const q = String(searchQuery || '').trim().toLowerCase();

        // 1. Decorar con estado de cartera si no viene decorada (defensivo ante elementos nulos)
        const getDoc = (this && typeof this.determinarEstadoYCartera === 'function')
            ? this.determinarEstadoYCartera.bind(this)
            : CuentaCobroData.determinarEstadoYCartera;

        const decoradas = (cuentas || []).filter(Boolean).map(c => {
            return c && c.estado && c.isCobrada !== undefined
                ? c
                : getDoc(c, fechaHoy);
        }).filter(Boolean);

        // 2. Filtrar por tab y texto
        const filtradas = decoradas.filter(doc => {
            if (!doc) return false;

            // Filtro por pestaña
            if (selectedTab === 'pendientes' && doc.estado !== 'pendiente') return false;
            if (selectedTab === 'vencidas' && doc.estado !== 'vencida') return false;
            if (selectedTab === 'cobradas' && doc.estado !== 'cobrada') return false;
            if (selectedTab === 'anuladas' && doc.estado !== 'anulada') return false;

            // Filtro por búsqueda textual
            if (q) {
                const numStr = String(doc.numero || doc.id || '').toLowerCase();
                const clienteStr = String(doc.cliente_razon_social || '').toLowerCase();
                const nitStr = String(doc.cliente_nit || '').toLowerCase();
                const formaStr = String(doc.forma_pago || '').toLowerCase();
                const totalStr = String(doc.total || '');

                let matchDetalles = false;
                if (Array.isArray(doc.detalles)) {
                    matchDetalles = doc.detalles.some(d => {
                        const nom = String(d?.nombre || '').toLowerCase();
                        const desc = String(d?.descripcion_personalizada || '').toLowerCase();
                        const sku = String(d?.sku || '').toLowerCase();
                        return nom.includes(q) || desc.includes(q) || sku.includes(q);
                    });
                }

                const match = numStr.includes(q) ||
                    clienteStr.includes(q) ||
                    nitStr.includes(q) ||
                    formaStr.includes(q) ||
                    totalStr.includes(q) ||
                    matchDetalles;

                if (!match) return false;
            }

            return true;
        });

        // 3. Ordenamiento
        filtradas.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];

            if (sortBy === 'numero' || sortBy === 'id' || sortBy === 'total') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else {
                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        // 4. Paginación defensiva
        const totalItems = filtradas.length;
        const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / itemsPerPage);
        const validPage = totalPages === 0 ? 1 : Math.max(1, Math.min(currentPage, totalPages));
        const startIndex = (validPage - 1) * itemsPerPage;
        const items = totalItems === 0 ? [] : filtradas.slice(startIndex, startIndex + itemsPerPage);

        return {
            items,
            totalItems,
            totalPages,
            currentPage: validPage,
            itemsPerPage
        };
    },

    /**
     * Carga las cuentas de cobro desde Supabase.
     */
    async cargarCuentasCobro() {
        const sb = this.getSupabase();
        if (!sb) {
            console.warn('[CuentaCobroData] Cliente Supabase no inicializado.');
            return [];
        }

        if (this.state) this.state.isLoading = true;

        try {
            const { data, error } = await sb
                .from('cuentas_cobro')
                .select('*')
                .order('numero', { ascending: false });

            if (error) throw error;

            const cuentasRaw = data || [];
            const cuentasDecoradas = cuentasRaw.map(c => this.determinarEstadoYCartera(c));

            if (this.state) {
                this.state.cuentas = cuentasDecoradas;
                this.calcularKPIs(cuentasDecoradas);
                this.aplicarFiltros();
            }

            return cuentasDecoradas;
        } catch (err) {
            console.error('[CuentaCobroData] Error cargando cuentas de cobro:', err);
            if (this.state) {
                this.state.cuentas = [];
                this.state.cuentasFiltradas = [];
            }
            return [];
        } finally {
            if (this.state) this.state.isLoading = false;
        }
    },

    /**
     * Aplica los filtros actuales al estado del módulo.
     */
    aplicarFiltros() {
        if (!this.state) return;
        const { cuentas, selectedTab, searchQuery, currentPage, itemsPerPage } = this.state;
        const resultado = this.filtrarYPaginar(cuentas, {
            selectedTab,
            searchQuery,
            currentPage,
            itemsPerPage
        });

        this.state.cuentasFiltradas = resultado.items;
        this.state.totalItems = resultado.totalItems;
        this.state.totalPages = resultado.totalPages;
        this.state.currentPage = resultado.currentPage;
    },

    /**
     * Marca una cuenta de cobro como cobrada/saldada en Supabase.
     * @param {string|number} id 
     */
    async marcarCobradaCuentaCobro(id) {
        const sb = this.getSupabase();
        if (!sb) throw new Error("Cliente de base de datos no disponible.");
        const { error } = await sb
            .from('cuentas_cobro')
            .update({ estado: 'cobrada' })
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    /**
     * Anula una cuenta de cobro en Supabase.
     * @param {string|number} id 
     */
    async anularCuentaCobro(id) {
        const sb = this.getSupabase();
        if (!sb) throw new Error("Cliente de base de datos no disponible.");
        const { error } = await sb
            .from('cuentas_cobro')
            .update({ estado: 'anulada' })
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    /**
     * Elimina físicamente una cuenta de cobro.
     * @param {string|number} id 
     */
    async eliminarCuentaCobro(id) {
        const sb = this.getSupabase();
        if (!sb) throw new Error("Cliente de base de datos no disponible.");
        const { error } = await sb
            .from('cuentas_cobro')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    /**
     * Carga el detalle completo de una cuenta de cobro.
     * @param {string|number} id 
     */
    async cargarDetalleCuentaCobro(id) {
        const sb = this.getSupabase();
        if (!sb) return null;
        try {
            const { data, error } = await sb
                .from('cuentas_cobro')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return this.determinarEstadoYCartera(data);
        } catch (e) {
            console.error('[CuentaCobroData] Error cargando detalle:', e);
            return null;
        }
    }
};
