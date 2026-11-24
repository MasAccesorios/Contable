// js/modules/bancos/detalle.js
// Módulo de Libro Auxiliar y Detalle de Movimientos Bancarios 360° (Homologado con Gastos Operativos y Conciliación)

import { escapeHtml } from '../../shared/formatters.js';

export function agruparTransaccionesPorPago(transacciones) {
    const grupos = {};
    (transacciones || []).forEach(t => {
        const key = t.grupo_pago_id || ('single_' + t.id);
        if (!grupos[key]) {
            grupos[key] = { ...t, monto: 0, idsIncluidos: [], facturaIdsIncluidas: [] };
        }
        grupos[key].monto += Number(t.monto);
        grupos[key].idsIncluidos.push(t.id);
        if (t.conciliacion_id) grupos[key].conciliacion_id = t.conciliacion_id;
        if (t.conciliado_en) grupos[key].conciliado_en = t.conciliado_en;
        if (t.factura_id) grupos[key].facturaIdsIncluidas.push(t.factura_id);
    });
    return Object.values(grupos);
}

export const DetalleBancoModule = {
    state: {
        bancoId: null,
        cuenta: null,
        todasLasCuentas: [],
        transacciones: [],
        saldos: {},
        saldo: 0,
        kpis: {
            saldoLibros: 0,
            totalIngresos: 0,
            conteoIngresos: 0,
            totalEgresos: 0,
            conteoEgresos: 0,
            conteoPendientes: 0,
            conteoConciliados: 0,
            tabCounts: { todas: 0, ingresos: 0, egresos: 0, pendientes: 0, conciliados: 0 }
        },
        currentTab: 'todas',
        searchQuery: '',
        fechaDesde: '',
        fechaHasta: '',
        offset: 0,
        limit: 50,
        hasMore: true,
        isLoading: false,
        totalCount: 0
    },

    element: null,
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
        try {
            const mod = await import('../../core/db.js');
            this._db = mod.default;
            return this._db;
        } catch {
            return null;
        }
    },

    // =========================================================================
    // IDENTIDAD Y FORMATTERS
    // =========================================================================
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
        if (tipo === 'caja' || nombreLower.includes('caja') || nombreLower.includes('efectivo')) {
            return {
                initials: 'CJ',
                brand: 'Efectivo',
                icon: 'bi-cash-stack',
                bg: '#ecfdf5',
                color: '#059669'
            };
        }

        const initials = (nombre.slice(0, 2) || 'BC').toUpperCase();
        return {
            initials,
            brand: nombre || 'Banco',
            icon: 'bi-bank2',
            bg: '#eff6ff',
            color: '#2563eb'
        };
    },

    getThirdPartyAvatar(name, isIngreso = true) {
        if (!name || name === '-' || name === 'Sin tercero' || name === 'Desconocido') {
            return { initials: '?', bg: '#f1f5f9', color: '#64748b' };
        }
        const clean = String(name).trim();
        const parts = clean.split(/\s+/);
        let initials = parts[0][0] || '';
        if (parts.length > 1 && parts[1][0]) {
            initials += parts[1][0];
        } else if (clean.length > 1) {
            initials += clean[1];
        }
        initials = initials.toUpperCase();

        const colorsIngreso = [
            { bg: '#eff6ff', color: '#1d4ed8' },
            { bg: '#ecfdf5', color: '#059669' },
            { bg: '#fef3c7', color: '#d97706' },
            { bg: '#e0f2fe', color: '#0369a1' },
            { bg: '#ccfbf1', color: '#0f766e' }
        ];

        const colorsGasto = [
            { bg: '#fef2f2', color: '#dc2626' },
            { bg: '#fff7ed', color: '#ea580c' },
            { bg: '#fef3c7', color: '#d97706' },
            { bg: '#f3e8ff', color: '#7e22ce' },
            { bg: '#f1f5f9', color: '#475569' }
        ];

        const palette = isIngreso ? colorsIngreso : colorsGasto;
        let hash = 0;
        for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
        const index = Math.abs(hash) % palette.length;
        return { initials: initials.substring(0, 2), ...palette[index] };
    },

    formatMoney(val) {
        const num = parseFloat(val || 0);
        return '$ ' + num.toLocaleString('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    },

    formatFecha(str) {
        if (!str) return '-';
        const parts = String(str).split('T')[0].split('-');
        if (parts.length < 3) return escapeHtml(String(str));
        const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const mesIdx = parseInt(parts[1], 10) - 1;
        return `${parts[2]} ${meses[mesIdx] || parts[1]} ${parts[0]}`;
    },

    // =========================================================================
    // CÁLCULO DE KPIS Y FILTROS (MÉTODOS PUROS TDD)
    // =========================================================================
    calcularKpis(cuenta, saldos = {}, transacciones = [], pendientesCount = null) {
        const cuentaId = cuenta ? String(cuenta.id) : null;
        let saldoLibros = 0;

        if (cuentaId && saldos[cuentaId] !== undefined) {
            saldoLibros = Number(saldos[cuentaId]);
        } else if (cuenta && cuenta.saldo_inicial !== undefined) {
            saldoLibros = Number(cuenta.saldo_inicial);
        }

        let totalIngresos = 0;
        let conteoIngresos = 0;
        let totalEgresos = 0;
        let conteoEgresos = 0;
        let conteoConciliados = 0;
        let conteoPendientesLocal = 0;

        (transacciones || []).forEach(t => {
            const esAnulado = t.estado === 'anulado';
            if (esAnulado) return;

            const esIngreso = t.tipo === 'ingreso' || t.tipo === 'in';
            const monto = Number(t.monto || 0);

            if (esIngreso) {
                totalIngresos += monto;
                conteoIngresos++;
            } else {
                totalEgresos += monto;
                conteoEgresos++;
            }

            const estaConciliado = Boolean(t.conciliacion_id || t.conciliado_en);
            if (estaConciliado) {
                conteoConciliados++;
            } else {
                conteoPendientesLocal++;
            }
        });

        const conteoPendientes = pendientesCount !== null && pendientesCount !== undefined
            ? Number(pendientesCount)
            : conteoPendientesLocal;

        return {
            saldoLibros,
            totalIngresos,
            conteoIngresos,
            totalEgresos,
            conteoEgresos,
            conteoPendientes,
            conteoConciliados,
            tabCounts: {
                todas: (transacciones || []).length,
                ingresos: conteoIngresos,
                egresos: conteoEgresos,
                pendientes: conteoPendientesLocal,
                conciliados: conteoConciliados
            }
        };
    },

    filtrarMovimientos(transacciones = [], { tab = 'todas', search = '', fechaDesde = '', fechaHasta = '' } = {}) {
        const query = String(search || '').toLowerCase().trim();

        return (transacciones || []).filter(t => {
            // 1. Filtro por Pestaña
            if (tab === 'ingresos') {
                if (t.tipo !== 'ingreso' && t.tipo !== 'in') return false;
            } else if (tab === 'egresos') {
                if (t.tipo !== 'egreso' && t.tipo !== 'out') return false;
            } else if (tab === 'pendientes') {
                if (t.conciliacion_id || t.conciliado_en) return false;
            } else if (tab === 'conciliados') {
                if (!t.conciliacion_id && !t.conciliado_en) return false;
            }

            // 2. Filtro por Rango de Fechas
            if (fechaDesde && t.fecha && t.fecha < fechaDesde) return false;
            if (fechaHasta && t.fecha && t.fecha > fechaHasta) return false;

            // 3. Filtro por Búsqueda de Texto
            if (query) {
                const searchCorpus = [
                    t.terceroNombre,
                    t.terceroNit,
                    t.cuentaContable,
                    t.referencia,
                    t.observaciones,
                    t.categoria,
                    t.detalle,
                    t.factura_numero ? `factura #${t.factura_numero}` : '',
                    t.id ? String(t.id) : ''
                ].filter(Boolean).join(' ').toLowerCase();

                if (!searchCorpus.includes(query)) return false;
            }

            return true;
        });
    },

    mapearParaExport(transacciones = [], cuenta = {}) {
        return (transacciones || []).map(t => {
            const sanitize = val => {
                if (val === null || val === undefined) return '';
                const str = String(val).trim();
                if (/^[=+\-@]/.test(str)) return `'${str}`;
                return str;
            };

            const esIngreso = t.tipo === 'ingreso' || t.tipo === 'in';
            const estaConciliado = Boolean(t.conciliacion_id || t.conciliado_en);

            return {
                'Fecha': t.fecha || '',
                'Nº Transacción': sanitize(t.grupo_pago_id || t.id),
                'Tercero': sanitize(t.terceroNombre || 'Sin tercero'),
                'NIT': sanitize(t.terceroNit || ''),
                'Cuenta Contable': sanitize(t.cuentaContable?.replace(/<[^>]*>/g, '') || t.categoria || 'Otros'),
                'Tipo': esIngreso ? 'Ingreso' : 'Egreso',
                'Débito': !esIngreso ? Number(t.monto || 0) : 0,
                'Crédito': esIngreso ? Number(t.monto || 0) : 0,
                'Monto': Number(t.monto || 0),
                'Estado Conciliación': estaConciliado ? 'Conciliado' : 'Pendiente'
            };
        });
    },

    // =========================================================================
    // CICLO DE VIDA E INICIALIZACIÓN
    // =========================================================================
    async init(element) {
        if (!element) return;
        this.element = element;

        const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        this.state.bancoId = urlParams.get('banco_id');
        this.state.offset = 0;
        this.state.limit = 50;
        this.state.hasMore = true;
        this.state.transacciones = [];
        this.state.searchQuery = '';
        this.state.currentTab = 'todas';
        this.state.fechaDesde = '';
        this.state.fechaHasta = '';

        this.renderSkeleton();
        await this.loadInitialData();
        this.render();
    },

    renderSkeleton() {
        if (!this.element) return;
        this.element.innerHTML = `
            <div class="dash-layout p-3 p-md-4" style="max-width: 1260px; margin: 0 auto;">
                <div class="d-flex align-items-center gap-3 mb-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <span class="text-muted fw-medium">Cargando detalle y extracto bancario...</span>
                </div>
            </div>
        `;
    },

    async loadInitialData() {
        const db = await this.getDB();
        const supabase = await this.getSupabase();

        // 1. Cargar catálogo de cuentas bancarias
        let cuentas = [];
        if (db) {
            cuentas = await db.getAll('cuentas_bancarias') || [];
        } else if (supabase) {
            const { data } = await supabase.from('cuentas_bancarias').select('*');
            cuentas = data || [];
        }
        this.state.todasLasCuentas = cuentas;

        // 2. Identificar la cuenta solicitada
        const paramId = this.state.bancoId;
        this.state.cuenta = cuentas.find(c => String(c.id) === String(paramId)) ||
                            cuentas.find(c => String(c.nombre).toLowerCase() === String(paramId).toLowerCase()) ||
                            cuentas[0] || null;

        if (this.state.cuenta) {
            this.state.bancoId = this.state.cuenta.id;
        }

        // 3. Obtener saldos consolidados
        if (supabase) {
            try {
                const { data: saldosData } = await supabase.rpc('get_saldos_por_cuenta');
                const mapa = {};
                (saldosData || []).forEach(s => {
                    mapa[String(s.cuenta_id)] = Number(s.saldo || 0);
                });
                this.state.saldos = mapa;
                if (this.state.cuenta) {
                    this.state.saldo = mapa[String(this.state.cuenta.id)] ?? Number(this.state.cuenta.saldo_inicial || 0);
                }
            } catch (err) {
                console.warn('[DetalleBancoModule] Error cargando saldos:', err);
            }
        }

        // 4. Cargar movimientos
        await this.loadMovimientos(false);
    },

    async loadMovimientos(isLoadMore = false) {
        if (this.state.isLoading || !this.state.cuenta) return;
        this.state.isLoading = true;

        const supabase = await this.getSupabase();
        if (!supabase) {
            this.state.isLoading = false;
            return;
        }

        const cuentaRealId = parseInt(this.state.cuenta.id, 10);
        let tipoRpc = 'todos';
        if (this.state.currentTab === 'ingresos') tipoRpc = 'ingreso';
        if (this.state.currentTab === 'egresos') tipoRpc = 'egreso';

        try {
            const { data: pagos, error } = await supabase.rpc('get_movimientos_banco', {
                p_cuenta_id: cuentaRealId,
                p_offset: this.state.offset,
                p_limit: this.state.limit,
                p_search: this.state.searchQuery,
                p_tipo: tipoRpc
            });

            if (!error && pagos) {
                const mapped = pagos.map(item => {
                    let terceroNombre = item.tercero_nombre;
                    if (!terceroNombre) {
                        terceroNombre = item.referencia || 'Desconocido';
                    }

                    let cuentaContable = 'Otros movimientos';
                    if (item.factura_numero) {
                        const fNum = item.factura_numero;
                        const fId = item.factura_id;
                        cuentaContable = `<a href="#/ingresos/facturas/ver/${fId}" class="text-decoration-none text-primary fw-medium" onclick="event.stopPropagation()">Factura #${fNum}</a>`;
                    } else if (item.categoria) {
                        cuentaContable = item.categoria;
                    } else if (item.observaciones) {
                        const obs = String(item.observaciones).trim();
                        if (!/^\(\s*Alegra ID:\s*\d+\s*\)$/i.test(obs)) {
                            cuentaContable = obs;
                        }
                    }

                    return {
                        ...item,
                        tipo: item.tipo === 'in' ? 'ingreso' : 'egreso',
                        monto: Number(item.monto || 0),
                        referenciaId: item.factura_id ? String(item.factura_id) : null,
                        cuentaId: String(item.cuenta_id),
                        detalle: item.observaciones || item.categoria || item.referencia || 'Sin detalle',
                        terceroNombre,
                        terceroNit: item.tercero_nit || '',
                        cuentaContable
                    };
                });

                // Enriquecer con estado de conciliación real
                const idsMov = mapped.map(m => m.id);
                if (idsMov.length > 0) {
                    const { data: concRows } = await supabase
                        .from('pagos_ingresos')
                        .select('id, conciliacion_id, conciliado_en')
                        .in('id', idsMov);
                    const mapaConc = new Map((concRows || []).map(r => [r.id, r]));
                    mapped.forEach(m => {
                        const r = mapaConc.get(m.id);
                        m.conciliacion_id = r?.conciliacion_id ?? null;
                        m.conciliado_en = r?.conciliado_en ?? null;
                    });
                }

                if (!isLoadMore) {
                    this.state.transacciones = mapped;
                } else {
                    this.state.transacciones = this.state.transacciones.concat(mapped);
                }

                this.state.offset += pagos.length;
                this.state.hasMore = pagos.length === this.state.limit;
            }
        } catch (err) {
            console.error('[DetalleBancoModule] Error cargando transacciones:', err);
        }

        // Consultar conteo de pendientes de conciliación (a partir de la fecha de corte)
        let conteoPendientes = null;
        try {
            const { count } = await supabase
                .from('pagos_ingresos')
                .select('id', { count: 'exact', head: true })
                .eq('cuenta_id', cuentaRealId)
                .is('conciliacion_id', null)
                .is('conciliado_en', null)
                .neq('estado', 'anulado')
                .gte('fecha', '2026-08-01');
            conteoPendientes = count || 0;
        } catch (e) {
            console.warn('[DetalleBancoModule] Error consultando pendientes de conciliación:', e);
        }

        // Recalcular KPIs
        this.state.kpis = this.calcularKpis(this.state.cuenta, this.state.saldos, this.state.transacciones, conteoPendientes);
        this.state.isLoading = false;
    },

    // =========================================================================
    // RENDERIZADO VISUAL
    // =========================================================================
    render() {
        if (!this.element) return;
        this.element.innerHTML = this.renderLayout(this.state);
        this.renderTableContent();
        this.attachEvents();
    },

    renderLayout(state) {
        const c = state.cuenta || { nombre: 'Cuenta', tipo: 'Banco', numero: '-' };
        const avatar = this.getBankAvatar(c);
        const k = state.kpis || {
            saldoLibros: 0,
            totalIngresos: 0,
            conteoIngresos: 0,
            totalEgresos: 0,
            conteoEgresos: 0,
            conteoPendientes: 0,
            conteoConciliados: 0,
            tabCounts: { todas: 0, ingresos: 0, egresos: 0, pendientes: 0, conciliados: 0 }
        };
        const counts = k.tabCounts || { todas: 0, ingresos: 0, egresos: 0, pendientes: 0, conciliados: 0 };
        const isActivo = c.estado !== 'inactivo';

        return `
            <div class="dash-layout p-3 p-md-4" style="max-width: 1260px; margin: 0 auto;">
                
                <!-- TOP BAR DE ALTO IMPACTO (ESTILO GASTOS OPERATIVOS) -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <div class="d-flex align-items-center gap-3">
                        <a href="#/bancos" class="btn btn-light bg-white border shadow-xs d-flex align-items-center justify-content-center" style="width: 42px; height: 42px; border-radius: 10px; color: var(--text-body);" title="Volver a Bancos">
                            <i class="bi bi-arrow-left fs-5"></i>
                        </a>

                        <!-- Avatar Institucional de la Entidad -->
                        <div class="payment-avatar shadow-xs" style="width: 46px; height: 46px; font-size: 16px; font-weight: 800; border-radius: 12px; background-color: ${avatar.bg}; color: ${avatar.color}; display: flex; align-items: center; justify-content: center;">
                            ${escapeHtml(avatar.initials)}
                        </div>

                        <div>
                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                <h2 class="page-title mb-0" style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">${escapeHtml(c.nombre)}</h2>
                                <span class="badge border rounded-pill" style="background-color: ${avatar.bg}; color: ${avatar.color}; font-size: 11px; padding: 4px 10px; font-weight: 700;">
                                    <i class="bi ${avatar.icon} me-1"></i> ${escapeHtml(avatar.brand)}
                                </span>
                                <span class="badge ${isActivo ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-secondary border border-secondary-subtle'} rounded-pill" style="font-size: 11px; padding: 4px 9px;">
                                    ${isActivo ? 'Activa' : 'Inactiva'}
                                </span>
                            </div>
                            <p class="text-muted mb-0" style="font-size: 12.5px; margin-top: 2px;">
                                Tipo: <strong class="text-dark">${escapeHtml(c.tipo || 'Banco')}</strong> &nbsp;|&nbsp; 
                                Número: <strong class="text-dark">${escapeHtml(c.numero || '---')}</strong> &nbsp;|&nbsp; 
                                Libro Auxiliar y Detalle Histórico de Movimientos
                            </p>
                        </div>
                    </div>

                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <!-- Botón Directo: Conciliar Cuenta -->
                        <a href="#/bancos/conciliacion?banco_id=${encodeURIComponent(c.id)}" class="btn btn-primary-action shadow-xs d-flex align-items-center gap-2" style="font-weight: 700; font-size: 13px; border-radius: 8px; padding: 8px 16px;">
                            <i class="bi bi-patch-check-fill text-warning"></i> Conciliar ${escapeHtml(avatar.brand)}
                        </a>

                        <!-- Botón Exportar Excel -->
                        <button id="btn-export-excel" class="btn btn-light bg-white border text-secondary shadow-xs d-flex align-items-center gap-2" style="font-weight: 600; font-size: 13px; border-radius: 8px; padding: 8px 14px;" title="Exportar a Excel / CSV">
                            <i class="bi bi-file-earmark-excel text-success fs-6"></i> Exportar
                        </button>

                        <!-- Botón Refrescar -->
                        <button id="btn-refresh-detalle" class="btn btn-light bg-white border text-secondary shadow-xs d-flex align-items-center justify-content-center" style="width: 38px; height: 38px; border-radius: 8px;" title="Actualizar datos">
                            <i class="bi bi-arrow-clockwise fs-6"></i>
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS (ESTÁNDAR GASTOS OPERATIVOS) -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Saldo en Libros (Disponible) -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card shadow-xs" style="border-top: 3px solid #2563eb;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Saldo en Libros</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-bank"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold ${k.saldoLibros >= 0 ? 'text-primary' : 'text-danger'} tnum" style="font-size: 22px;">
                                ${this.formatMoney(k.saldoLibros)}
                            </div>
                            <div class="mt-2 d-flex align-items-center gap-2">
                                <span class="badge ${k.saldoLibros >= 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} border rounded-pill" style="font-size: 10.5px;">
                                    ${k.saldoLibros >= 0 ? 'Disponible' : 'Sobregiro'}
                                </span>
                                <span class="text-muted" style="font-size: 11px;">Saldo contable actual</span>
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Total Entradas (Ingresos) -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card shadow-xs" style="border-top: 3px solid #059669;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Total Entradas</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-arrow-down-left"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" style="font-size: 22px;">
                                ${this.formatMoney(k.totalIngresos)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <strong>${k.conteoIngresos}</strong> transacciones de ingreso
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Total Salidas (Egresos) -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card shadow-xs" style="border-top: 3px solid #dc2626;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Total Salidas</span>
                                <div class="payment-kpi-icon out-bg">
                                    <i class="bi bi-arrow-up-right"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-danger tnum" style="font-size: 22px;">
                                ${this.formatMoney(k.totalEgresos)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                <strong>${k.conteoEgresos}</strong> pagos y retiros
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Estado de Conciliación -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card shadow-xs" style="border-top: 3px solid #d97706;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Por Conciliar</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-patch-check"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold ${k.conteoPendientes > 0 ? 'text-warning-emphasis' : 'text-success'} tnum" style="font-size: 22px;">
                                ${k.conteoPendientes > 0 ? `${k.conteoPendientes} Pendientes` : 'Al Día (0)'}
                            </div>
                            <div class="mt-2 d-flex align-items-center justify-content-between" style="font-size: 11px;">
                                <span class="text-muted">${k.conteoConciliados} ya conciliados</span>
                                <a href="#/bancos/conciliacion?banco_id=${encodeURIComponent(c.id)}" class="fw-semibold text-primary text-decoration-none">Conciliar →</a>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR PRINCIPAL DE TABLA CON PESTAÑAS (DASH-TABLE-CONTAINER) -->
                <div class="dash-table-container shadow-xs">
                    
                    <!-- 1. BARRA DE PESTAÑAS SEGMENTADAS (PAYMENT-TABS-BAR) -->
                    <div class="card-header bg-white border-bottom p-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                        <div class="payment-tabs-bar" role="tablist">
                            <button class="payment-tab-btn ${state.currentTab === 'todas' ? 'active' : ''}" data-tab="todas" type="button">
                                Todos <span class="payment-tab-badge" id="tab-count-todas">${counts.todas}</span>
                            </button>
                            <button class="payment-tab-btn ${state.currentTab === 'ingresos' ? 'active' : ''}" data-tab="ingresos" type="button">
                                <i class="bi bi-arrow-down-left text-success me-1"></i> Ingresos <span class="payment-tab-badge" id="tab-count-ingresos">${counts.ingresos}</span>
                            </button>
                            <button class="payment-tab-btn ${state.currentTab === 'egresos' ? 'active' : ''}" data-tab="egresos" type="button">
                                <i class="bi bi-arrow-up-right text-danger me-1"></i> Egresos <span class="payment-tab-badge" id="tab-count-egresos">${counts.egresos}</span>
                            </button>
                            <button class="payment-tab-btn ${state.currentTab === 'pendientes' ? 'active' : ''}" data-tab="pendientes" type="button">
                                <i class="bi bi-clock-history text-warning-emphasis me-1"></i> Pendientes <span class="payment-tab-badge" id="tab-count-pendientes">${counts.pendientes}</span>
                            </button>
                            <button class="payment-tab-btn ${state.currentTab === 'conciliados' ? 'active' : ''}" data-tab="conciliados" type="button">
                                <i class="bi bi-patch-check-fill text-success me-1"></i> Conciliados <span class="payment-tab-badge" id="tab-count-conciliados">${counts.conciliados}</span>
                            </button>
                        </div>
                    </div>

                    <!-- 2. BARRA DE FILTROS: BUSCADOR Y RANGOS DE FECHA -->
                    <div class="p-3 bg-light border-bottom d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
                        
                        <!-- Buscador Omnibox con icono y limpiar -->
                        <div class="d-flex align-items-center gap-2 flex-grow-1" style="max-width: 480px;">
                            <div class="input-group input-group-sm" style="position: relative;">
                                <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                                <input type="text" class="form-control border-start-0 ps-0 text-dark" id="detail-search" placeholder="Buscar por tercero, NIT, categoría, referencia, factura..." value="${escapeHtml(state.searchQuery || '')}" autocomplete="off" style="font-size: 13px; box-shadow: none;">
                                <button class="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted ${state.searchQuery ? '' : 'd-none'}" id="detail-search-clear" style="z-index: 10; text-decoration: none;" type="button">
                                    <i class="bi bi-x-circle-fill"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Filtros de Fecha con Presets -->
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <span class="text-muted small fw-medium">Rango:</span>
                            <input type="date" class="form-control form-control-sm text-muted" id="filter-fecha-desde" value="${state.fechaDesde || ''}" style="width: 130px; font-size: 12px;">
                            <span class="text-muted small">a</span>
                            <input type="date" class="form-control form-control-sm text-muted" id="filter-fecha-hasta" value="${state.fechaHasta || ''}" style="width: 130px; font-size: 12px;">
                            
                            <div class="btn-group btn-group-sm" role="group">
                                <button type="button" class="btn btn-light bg-white border text-secondary btn-range-preset" data-range="este-mes" style="font-size: 11px;">Este Mes</button>
                                <button type="button" class="btn btn-light bg-white border text-secondary btn-range-preset" data-range="ultimos-3" style="font-size: 11px;">3 Meses</button>
                                <button type="button" class="btn btn-light bg-white border text-secondary btn-range-preset" data-range="todo" style="font-size: 11px;">Todo</button>
                            </div>
                        </div>
                    </div>

                    <!-- 3. TABLA DE DATOS -->
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0" id="detail-bancos-table">
                            <thead class="table-light text-muted" style="font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px;">
                                <tr>
                                    <th class="py-3 ps-3" style="width: 120px;">Fecha / Trans.</th>
                                    <th class="py-3" style="min-width: 200px;">Tercero / Beneficiario</th>
                                    <th class="py-3" style="min-width: 180px;">Concepto / Categoría</th>
                                    <th class="py-3 text-center" style="width: 130px;">Conciliación</th>
                                    <th class="py-3 text-end pe-3" style="width: 150px;">Valor</th>
                                    <th class="py-3 text-center" style="width: 90px;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="detail-grid-body">
                                <!-- Filas dinámicas -->
                            </tbody>
                        </table>
                    </div>

                    <!-- 4. FOOTER CON RESUMEN Y BOTÓN CARGAR MÁS -->
                    <div class="card-footer bg-white border-top p-3 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2" id="detail-grid-footer">
                        <!-- Conteo reactivo y paginación -->
                    </div>
                </div>
            </div>
        `;
    },

    renderTableContent() {
        if (!this.element) return;
        const tbody = this.element.querySelector('#detail-grid-body');
        const footer = this.element.querySelector('#detail-grid-footer');
        if (!tbody || !footer) return;

        // Agrupar transacciones según regla de transaccionesUtils
        const agrupadas = agruparTransaccionesPorPago(this.state.transacciones);
        const filtradas = this.filtrarMovimientos(agrupadas, {
            tab: this.state.currentTab,
            search: this.state.searchQuery,
            fechaDesde: this.state.fechaDesde,
            fechaHasta: this.state.fechaHasta
        });

        if (filtradas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <div class="d-flex flex-column align-items-center justify-content-center text-muted">
                            <div class="p-3 bg-light rounded-circle mb-3" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
                                <i class="bi bi-inbox fs-2 text-secondary"></i>
                            </div>
                            <h6 class="fw-bold text-dark mb-1">No se encontraron movimientos</h6>
                            <p class="small text-muted mb-0" style="max-width: 380px;">
                                No hay transacciones que coincidan con la pestaña seleccionada o los filtros de búsqueda aplicados.
                            </p>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = filtradas.map(t => {
                const esIngreso = t.tipo === 'ingreso' || t.tipo === 'in';
                const avatarTercero = this.getThirdPartyAvatar(t.terceroNombre, esIngreso);
                const estaConciliado = Boolean(t.conciliacion_id || t.conciliado_en);
                const valorColor = esIngreso ? '#059669' : '#dc2626';
                const signo = esIngreso ? '+' : '-';

                const badgeConciliacion = estaConciliado
                    ? `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 8px;" title="Conciliado en extracto bancario">
                         <i class="bi bi-patch-check-fill me-1"></i> Conciliado
                       </span>`
                    : `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill fw-medium" style="font-size: 11px; padding: 4px 8px;" title="Pendiente de conciliar">
                         <i class="bi bi-clock me-1"></i> Pendiente
                       </span>`;

                return `
                    <tr class="movimiento-row" data-id="${t.id}" style="cursor: pointer; transition: background-color 0.15s;">
                        <!-- Columna 1: Fecha & ID -->
                        <td class="py-3 ps-3">
                            <div class="fw-semibold text-dark" style="font-size: 13px;">${this.formatFecha(t.fecha)}</div>
                            <span class="payment-code-badge mt-1" style="font-size: 10.5px;">
                                #${escapeHtml(String(t.grupo_pago_id || t.id))}
                            </span>
                        </td>

                        <!-- Columna 2: Tercero con Avatar -->
                        <td class="py-3">
                            <div class="d-flex align-items-center gap-2">
                                <div class="payment-avatar" style="width: 32px; height: 32px; font-size: 11px; font-weight: 700; border-radius: 8px; background-color: ${avatarTercero.bg}; color: ${avatarTercero.color}; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                    ${escapeHtml(avatarTercero.initials)}
                                </div>
                                <div class="text-truncate" style="max-width: 240px;">
                                    <div class="fw-semibold text-dark" style="font-size: 13px;">${escapeHtml(t.terceroNombre || 'Sin tercero')}</div>
                                    ${t.terceroNit ? `<div class="text-muted" style="font-size: 11px;">NIT/CC: ${escapeHtml(t.terceroNit)}</div>` : ''}
                                </div>
                            </div>
                        </td>

                        <!-- Columna 3: Concepto / Categoría Contable -->
                        <td class="py-3">
                            <div style="font-size: 13px; color: var(--text-main);">
                                ${t.cuentaContable || 'Otros'}
                            </div>
                            ${t.observaciones && !t.cuentaContable.includes(t.observaciones) ? `<div class="text-muted text-truncate" style="font-size: 11px; max-width: 240px;">${escapeHtml(t.observaciones)}</div>` : ''}
                        </td>

                        <!-- Columna 4: Estado Conciliación -->
                        <td class="py-3 text-center">
                            ${badgeConciliacion}
                        </td>

                        <!-- Columna 5: Monto / Valor -->
                        <td class="py-3 text-end pe-3">
                            <div class="fw-bold tnum" style="font-size: 14px; color: ${valorColor};">
                                ${signo} ${this.formatMoney(t.monto)}
                            </div>
                            <span class="text-muted" style="font-size: 10.5px;">${esIngreso ? 'Entrada' : 'Salida'}</span>
                        </td>

                        <!-- Columna 6: Acciones Rápidas -->
                        <td class="py-3 text-center" onclick="event.stopPropagation()">
                            <div class="dropdown d-inline-block">
                                <button class="btn btn-sm btn-light border-0 p-1 text-muted" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Más opciones">
                                    <i class="bi bi-three-dots-vertical fs-6"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end shadow border" style="font-size: 13px; border-radius: 8px;">
                                    <li><a class="dropdown-item py-2 d-flex align-items-center gap-2 btn-ver-transaccion" href="javascript:void(0)" data-id="${t.id}"><i class="bi bi-layout-sidebar-inset-reverse text-primary"></i> Ver Detalle</a></li>
                                    ${!estaConciliado ? `
                                        <li><a class="dropdown-item py-2 d-flex align-items-center gap-2 btn-editar-transaccion" href="javascript:void(0)" data-id="${t.id}"><i class="bi bi-pencil text-secondary"></i> Editar</a></li>
                                        <li><hr class="dropdown-divider my-1"></li>
                                        <li><a class="dropdown-item py-2 d-flex align-items-center gap-2 text-danger btn-eliminar-banco" href="javascript:void(0)" data-id="${t.id}" data-grupo="${t.grupo_pago_id || ''}" data-monto="${t.monto}" data-fecha="${t.fecha}"><i class="bi bi-trash"></i> Eliminar</a></li>
                                    ` : `
                                        <li><hr class="dropdown-divider my-1"></li>
                                        <li><span class="dropdown-item-text text-muted small fst-italic"><i class="bi bi-lock me-1"></i> Movimiento conciliado</span></li>
                                    `}
                                </ul>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Render Footer
        footer.innerHTML = `
            <div class="text-muted small">
                Mostrando <strong>${filtradas.length}</strong> de <strong>${this.state.transacciones.length}</strong> movimientos cargados
            </div>
            <div>
                ${this.state.hasMore ? `
                    <button id="detail-btn-loadmore" class="btn btn-sm btn-outline-secondary px-3 py-1.5 shadow-xs" ${this.state.isLoading ? 'disabled' : ''}>
                        ${this.state.isLoading ? '<span class="spinner-border spinner-border-sm me-2"></span>Cargando...' : '<i class="bi bi-chevron-down me-1"></i> Cargar más movimientos'}
                    </button>
                ` : `
                    <span class="text-muted small fst-italic">Todos los movimientos han sido cargados.</span>
                `}
            </div>
        `;
    },

    // =========================================================================
    // EVENTOS Y REACTIVIDAD
    // =========================================================================
    attachEvents() {
        if (!this.element) return;

        // 1. Pestañas
        this.element.querySelectorAll('.payment-tab-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const tab = e.currentTarget.dataset.tab;
                if (this.state.currentTab === tab) return;
                this.state.currentTab = tab;

                // Actualizar clases activas
                this.element.querySelectorAll('.payment-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Si se cambia a tipo de RPC que requiere recarga server-side
                if (tab === 'ingresos' || tab === 'egresos' || tab === 'todas') {
                    this.state.offset = 0;
                    await this.loadMovimientos(false);
                }

                this.renderTableContent();
            });
        });

        // 2. Buscador en tiempo real con debounce
        const searchInput = this.element.querySelector('#detail-search');
        const searchClear = this.element.querySelector('#detail-search-clear');
        let debounceTimer;

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (searchClear) {
                    if (val.trim().length > 0) searchClear.classList.remove('d-none');
                    else searchClear.classList.add('d-none');
                }

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                    this.state.searchQuery = val.trim();
                    this.renderTableContent();
                }, 300);
            });
        }

        if (searchClear && searchInput) {
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                searchClear.classList.add('d-none');
                this.state.searchQuery = '';
                this.renderTableContent();
            });
        }

        // 3. Filtros de Fecha
        const inputDesde = this.element.querySelector('#filter-fecha-desde');
        const inputHasta = this.element.querySelector('#filter-fecha-hasta');

        if (inputDesde) {
            inputDesde.addEventListener('change', (e) => {
                this.state.fechaDesde = e.target.value;
                this.renderTableContent();
            });
        }

        if (inputHasta) {
            inputHasta.addEventListener('change', (e) => {
                this.state.fechaHasta = e.target.value;
                this.renderTableContent();
            });
        }

        // 4. Botones rápidos de rango de fechas
        this.element.querySelectorAll('.btn-range-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const range = e.currentTarget.dataset.range;
                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');

                if (range === 'este-mes') {
                    this.state.fechaDesde = `${yyyy}-${mm}-01`;
                    this.state.fechaHasta = `${yyyy}-${mm}-${dd}`;
                } else if (range === 'ultimos-3') {
                    const d3 = new Date(now);
                    d3.setMonth(d3.getMonth() - 3);
                    const y3 = d3.getFullYear();
                    const m3 = String(d3.getMonth() + 1).padStart(2, '0');
                    this.state.fechaDesde = `${y3}-${m3}-01`;
                    this.state.fechaHasta = `${yyyy}-${mm}-${dd}`;
                } else if (range === 'todo') {
                    this.state.fechaDesde = '';
                    this.state.fechaHasta = '';
                }

                if (inputDesde) inputDesde.value = this.state.fechaDesde;
                if (inputHasta) inputHasta.value = this.state.fechaHasta;
                this.renderTableContent();
            });
        });

        // 5. Botón Exportar a Excel (CSV con UTF-8 BOM y sanitización CWE-1236)
        const btnExport = this.element.querySelector('#btn-export-excel');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                this.descargarCsv();
            });
        }

        // 6. Botón Refrescar
        const btnRefresh = this.element.querySelector('#btn-refresh-detalle');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', async () => {
                btnRefresh.classList.add('disabled');
                btnRefresh.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                this.state.offset = 0;
                await this.loadInitialData();
                this.render();
            });
        }

        // 7. Botón Cargar Más
        const footerEl = this.element.querySelector('#detail-grid-footer');
        if (footerEl) {
            footerEl.addEventListener('click', async (e) => {
                const btnLoad = e.target.closest('#detail-btn-loadmore');
                if (btnLoad) {
                    btnLoad.disabled = true;
                    btnLoad.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cargando...';
                    await this.loadMovimientos(true);
                    this.renderTableContent();
                }
            });
        }

        // 8. Delegación de clics en filas y acciones de movimientos
        this.element.addEventListener('click', async (e) => {
            const btnVer = e.target.closest('.btn-ver-transaccion');
            const btnEditar = e.target.closest('.btn-editar-transaccion');
            const btnEliminar = e.target.closest('.btn-eliminar-banco');
            const trMov = e.target.closest('.movimiento-row');

            if (btnEliminar) {
                e.preventDefault();
                e.stopPropagation();
                await this.confirmarEliminar(btnEliminar.dataset);
                return;
            }

            if (btnEditar) {
                e.preventDefault();
                e.stopPropagation();
                await this.abrirModalDetalle(btnEditar.dataset.id, true);
                return;
            }

            if (btnVer) {
                e.preventDefault();
                e.stopPropagation();
                await this.abrirModalDetalle(btnVer.dataset.id, false);
                return;
            }

            if (trMov && !e.target.closest('button') && !e.target.closest('a') && !e.target.closest('.dropdown-menu')) {
                await this.abrirModalDetalle(trMov.dataset.id, false);
            }
        });
    },

    async abrirModalDetalle(tId, autoEdit = false) {
        const currentItems = agruparTransaccionesPorPago(this.state.transacciones);
        const t = currentItems.find(x => String(x.id) === String(tId));
        if (!t) return;

        try {
            const modalModule = await import('../../shared/transaccionModal.js');
            await modalModule.mostrarDetalleTransaccion(t, async () => {
                this.state.offset = 0;
                await this.loadInitialData();
                this.render();
            });

            if (autoEdit) {
                setTimeout(() => {
                    const btnEdit = document.getElementById('btn-activar-edicion');
                    if (btnEdit) btnEdit.click();
                }, 200);
            }
        } catch (err) {
            console.error('[DetalleBancoModule] Error abriendo modal de transacción:', err);
        }
    },

    async confirmarEliminar({ id, grupo, monto, fecha }) {
        const montoFormat = this.formatMoney(monto);
        if (confirm(`¿Está seguro que desea eliminar este movimiento por valor de ${montoFormat} del ${fecha}? Esta acción revertirá el saldo de la cuenta.`)) {
            try {
                const supabase = await this.getSupabase();
                const { anularTransaccion } = await import('../../shared/transaccionesUtils.js');
                if (grupo) {
                    await anularTransaccion(grupo, true);
                } else {
                    const { data: row } = await supabase.from('pagos_ingresos').select('categoria').eq('id', id).single();
                    if (row?.categoria === 'Transferencia') {
                        const { error } = await supabase.rpc('anular_transferencia_pareja', { p_id: id });
                        if (error) throw error;
                    } else {
                        await anularTransaccion(id, false);
                    }
                }
                this.state.offset = 0;
                await this.loadInitialData();
                this.render();
            } catch (err) {
                alert('Error al anular el movimiento: ' + (err.message || err));
            }
        }
    },

    descargarCsv() {
        const agrupadas = agruparTransaccionesPorPago(this.state.transacciones);
        const filtradas = this.filtrarMovimientos(agrupadas, {
            tab: this.state.currentTab,
            search: this.state.searchQuery,
            fechaDesde: this.state.fechaDesde,
            fechaHasta: this.state.fechaHasta
        });

        const filas = this.mapearParaExport(filtradas, this.state.cuenta);
        if (filas.length === 0) {
            alert('No hay movimientos disponibles para exportar.');
            return;
        }

        const headers = Object.keys(filas[0]);
        const csvRows = [headers.join(';')];

        filas.forEach(row => {
            const values = headers.map(header => {
                const val = row[header] ?? '';
                const escaped = String(val).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(';'));
        });

        const csvContent = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const nombreCuenta = (this.state.cuenta?.nombre || 'Banco').replace(/[^a-zA-Z0-9_-]/g, '_');
        const hoy = new Date().toISOString().split('T')[0];

        link.setAttribute('href', url);
        link.setAttribute('download', `Extracto_${nombreCuenta}_${hoy}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};
