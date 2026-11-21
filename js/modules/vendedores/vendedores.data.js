// js/modules/vendedores/vendedores.data.js
// Capa de Datos, Cálculos de Negocio e Inteligencia Comercial 360°

export const VendedoresData = {
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
            this._db = mod.default || mod.DB;
            return this._db;
        } catch {
            return null;
        }
    },

    /**
     * Paletas de colores refinadas para avatares de vendedores
     */
    AVATAR_PALETTE: [
        { bg: '#eff6ff', color: '#1d4ed8' }, // Azul ejecutivo
        { bg: '#ecfdf5', color: '#059669' }, // Esmeralda
        { bg: '#fef3c7', color: '#d97706' }, // Ámbar cálido
        { bg: '#f3e8ff', color: '#7e22ce' }, // Púrpura real
        { bg: '#e0f2fe', color: '#0284c7' }, // Cyan océano
        { bg: '#fff1f2', color: '#e11d48' }, // Rosa coral
        { bg: '#f0fdf4', color: '#15803d' }, // Verde bosque
        { bg: '#fdf4ff', color: '#a21caf' }  // Magenta
    ],

    /**
     * Genera un avatar determinista para un vendedor según su nombre
     */
    getVendorAvatar(nombre) {
        if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
            return { initials: '?', bg: '#f1f5f9', color: '#64748b' };
        }

        const clean = nombre.trim();
        const parts = clean.split(/\s+/).filter(Boolean);
        let initials = parts[0][0] || '';
        if (parts.length > 1 && parts[1][0]) {
            initials += parts[1][0];
        } else if (clean.length > 1) {
            initials += clean[1];
        }
        initials = initials.toUpperCase();

        let hash = 0;
        for (let i = 0; i < clean.length; i++) {
            hash = clean.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % this.AVATAR_PALETTE.length;
        return { initials: initials.substring(0, 2), ...this.AVATAR_PALETTE[index] };
    },

    /**
     * Carga el resumen inicial de vendedores y cuentas activas
     */
    async cargarDatosIniciales() {
        const supabase = await this.getSupabase();
        if (!supabase) return { vendedores: [], cuentas: [] };

        try {
            const [vendedoresRes, cuentasRes] = await Promise.all([
                supabase.rpc('get_vendedores_resumen'),
                supabase.from('cuentas_bancarias').select('id, nombre, tipo, numero, estado').eq('estado', 'active')
            ]);

            const vendedores = (vendedoresRes?.data || []).map(v => ({
                id: v.id,
                nombre: v.nombre || 'Sin nombre',
                telefono: v.telefono || '',
                porcentaje_comision: Number(v.porcentaje_comision || 0),
                estado: v.estado || 'activo',
                total_vendido: Number(v.total_vendido || 0),
                comision_generada: Number(v.comision_generada || 0),
                comision_pagada: Number(v.comision_pagada || 0),
                comision_pendiente: Number(v.comision_pendiente || 0)
            }));

            const cuentas = cuentasRes?.data || [];
            return { vendedores, cuentas };
        } catch (error) {
            console.error('Error cargando datos iniciales de vendedores:', error);
            return { vendedores: [], cuentas: [] };
        }
    },

    /**
     * Carga el detalle profundo de un vendedor para el Drawer 360°
     */
    async cargarDetalleVendedor(vendedorId) {
        const supabase = await this.getSupabase();
        if (!supabase) return { vendedor: null, comisiones: [], cuentas: [] };

        try {
            const [vendedorRes, comisionesRes, cuentasRes] = await Promise.all([
                supabase.from('vendedores').select('*').eq('id', vendedorId).single(),
                supabase.from('comisiones')
                    .select('*, facturas(id, numero, fecha, total, estado, cliente_id, clientes(nombre))')
                    .eq('vendedor_id', vendedorId)
                    .order('created_at', { ascending: false }),
                supabase.from('cuentas_bancarias').select('id, nombre, tipo').eq('estado', 'active')
            ]);

            const vendedor = vendedorRes?.data || null;
            const comisiones = comisionesRes?.data || [];
            const cuentas = cuentasRes?.data || [];

            return { vendedor, comisiones, cuentas };
        } catch (error) {
            console.error('Error cargando detalle de vendedor:', error);
            return { vendedor: null, comisiones: [], cuentas: [] };
        }
    },

    /**
     * Calcula los 4 KPIs ejecutivos y los contadores dinámicos para las pestañas
     */
    calcularKpis(vendedores = []) {
        const lista = Array.isArray(vendedores) ? vendedores : [];
        if (lista.length === 0) {
            return {
                totalVendido: 0,
                comisionPendiente: 0,
                comisionPagada: 0,
                totalComisiones: 0,
                tasaLiquidacion: 0,
                vendedoresActivos: 0,
                vendedoresInactivos: 0,
                totalVendedores: 0,
                topVendedor: null,
                tabCounts: { todas: 0, pendientes: 0, al_dia: 0, top: 0, inactivos: 0 }
            };
        }

        let totalVendido = 0;
        let comisionPendiente = 0;
        let comisionPagada = 0;
        let vendedoresActivos = 0;
        let vendedoresInactivos = 0;

        let pendientesCount = 0;
        let alDiaCount = 0;
        let inactivosCount = 0;

        let topVendedor = null;
        let maxVentas = -1;

        for (const v of lista) {
            const vendido = Number(v.total_vendido || 0);
            const pendiente = Number(v.comision_pendiente || 0);
            const pagada = Number(v.comision_pagada || 0);
            const esActivo = v.estado === 'activo';

            totalVendido += vendido;
            comisionPendiente += pendiente;
            comisionPagada += pagada;

            if (esActivo) {
                vendedoresActivos++;
                if (pendiente === 0) alDiaCount++;
            } else {
                vendedoresInactivos++;
                inactivosCount++;
            }

            if (pendiente > 0) {
                pendientesCount++;
            }

            if (vendido > maxVentas && esActivo) {
                maxVentas = vendido;
                topVendedor = v;
            }
        }

        // Si ningún activo tiene ventas, considerar el mayor absoluto
        if (!topVendedor && lista.length > 0) {
            topVendedor = [...lista].sort((a, b) => Number(b.total_vendido || 0) - Number(a.total_vendido || 0))[0];
        }

        const totalComisiones = comisionPendiente + comisionPagada;
        const tasaLiquidacion = totalComisiones > 0 ? (comisionPagada / totalComisiones) * 100 : 0;

        // Top tab count: vendedores con ventas > promedio o los 3 mejores
        const promedioVentas = vendedoresActivos > 0 ? totalVendido / vendedoresActivos : 0;
        const topCount = lista.filter(v => v.estado === 'activo' && Number(v.total_vendido || 0) >= (promedioVentas > 0 ? promedioVentas : 1)).length;

        return {
            totalVendido,
            comisionPendiente,
            comisionPagada,
            totalComisiones,
            tasaLiquidacion,
            vendedoresActivos,
            vendedoresInactivos,
            totalVendedores: lista.length,
            topVendedor,
            tabCounts: {
                todas: lista.length,
                pendientes: pendientesCount,
                al_dia: alDiaCount,
                top: Math.max(topCount, 1),
                inactivos: inactivosCount
            }
        };
    },

    /**
     * Motor de Inteligencia y Diagnóstico Comercial
     */
    generarInsightsInteligentes(vendedores = []) {
        const lista = Array.isArray(vendedores) ? vendedores : [];
        if (lista.length === 0) {
            return {
                topPerformer: null,
                alertasPendientes: [],
                mayorPendiente: null,
                inactivosSinVentas: [],
                tasaGlobalCobro: 0,
                ticketPromedioGlobal: 0,
                recomendaciones: []
            };
        }

        const kpis = this.calcularKpis(lista);
        const top = kpis.topVendedor;
        let topPerformer = null;

        if (top && kpis.totalVendido > 0) {
            const pct = (Number(top.total_vendido || 0) / kpis.totalVendido) * 100;
            topPerformer = {
                id: top.id,
                nombre: top.nombre,
                total_vendido: Number(top.total_vendido || 0),
                porcentajeTotal: Math.round(pct),
                comision_generada: Number(top.comision_generada || 0)
            };
        }

        // Vendedores con comisiones pendientes
        const alertasPendientes = lista
            .filter(v => Number(v.comision_pendiente || 0) > 0)
            .map(v => ({
                id: v.id,
                nombre: v.nombre,
                monto: Number(v.comision_pendiente || 0),
                porcentaje_comision: v.porcentaje_comision
            }))
            .sort((a, b) => b.monto - a.monto);

        const mayorPendiente = alertasPendientes.length > 0 ? alertasPendientes[0] : null;

        // Vendedores activos pero sin ventas registradas
        const inactivosSinVentas = lista.filter(v => v.estado === 'activo' && Number(v.total_vendido || 0) === 0);

        // Generar recomendaciones de negocio inteligentes
        const recomendaciones = [];

        if (mayorPendiente && mayorPendiente.monto > 0) {
            recomendaciones.push({
                tipo: 'urgente',
                icono: 'bi-exclamation-triangle-fill',
                clase: 'text-warning',
                titulo: 'Liquidación prioritaria de comisiones',
                mensaje: `${mayorPendiente.nombre} acumula $ ${mayorPendiente.monto.toLocaleString('es-CO')} en comisiones pendientes. Liquidar oportunamente impulsa la motivación y retención comercial.`
            });
        }

        if (topPerformer && topPerformer.porcentajeTotal >= 50) {
            recomendaciones.push({
                tipo: 'analitico',
                icono: 'bi-trophy-fill',
                clase: 'text-primary',
                titulo: 'Alta concentración en vendedor estrella',
                mensaje: `${topPerformer.nombre} genera el ${topPerformer.porcentajeTotal}% de las ventas de la empresa. Sugerimos replicar sus mejores prácticas o capacitaciones con el resto del equipo.`
            });
        }

        if (inactivosSinVentas.length > 0) {
            recomendaciones.push({
                tipo: 'oportunidad',
                icono: 'bi-lightning-charge-fill',
                clase: 'text-info',
                titulo: 'Activación de vendedores sin ventas',
                mensaje: `Existen ${inactivosSinVentas.length} vendedores activos sin facturación registrada. Asigna prospectos o metas iniciales para activar su rendimiento.`
            });
        }

        if (kpis.tasaLiquidacion >= 80) {
            recomendaciones.push({
                tipo: 'exito',
                icono: 'bi-check-circle-fill',
                clase: 'text-success',
                titulo: 'Excelente ritmo de liquidación',
                mensaje: `El ${Math.round(kpis.tasaLiquidacion)}% de las comisiones devengadas ya han sido pagadas. El equipo comercial opera con alto nivel de satisfacción y cumplimiento.`
            });
        }

        return {
            topPerformer,
            alertasPendientes,
            mayorPendiente,
            inactivosSinVentas,
            tasaGlobalCobro: Math.round(kpis.tasaLiquidacion),
            recomendaciones
        };
    },

    /**
     * Filtra y ordena vendedores en tiempo real
     */
    filtrarYOrdenar(vendedores = [], { tab = 'todas', search = '', sortBy = 'total_vendido', sortOrder = 'desc' } = {}) {
        let resultado = [...(Array.isArray(vendedores) ? vendedores : [])];

        // 1. Filtro por Pestaña
        switch (tab) {
            case 'pendientes':
                resultado = resultado.filter(v => Number(v.comision_pendiente || 0) > 0);
                break;
            case 'al_dia':
                resultado = resultado.filter(v => Number(v.comision_pendiente || 0) === 0 && v.estado === 'activo');
                break;
            case 'top':
                resultado = resultado.filter(v => v.estado === 'activo');
                resultado.sort((a, b) => Number(b.total_vendido || 0) - Number(a.total_vendido || 0));
                break;
            case 'inactivos':
                resultado = resultado.filter(v => v.estado === 'inactivo');
                break;
            case 'todas':
            default:
                break;
        }

        // 2. Filtro por Omnibox de Búsqueda
        if (search && search.trim()) {
            const normalizar = (str) =>
                String(str || '')
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .trim();

            const q = normalizar(search);
            resultado = resultado.filter(v => {
                const nombreNorm = normalizar(v.nombre);
                const telNorm = String(v.telefono || '').replace(/\D/g, '');
                const qNum = search.replace(/\D/g, '');
                return nombreNorm.includes(q) || (qNum && telNorm.includes(qNum));
            });
        }

        // 3. Ordenamiento
        resultado.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = String(valB || '').toLowerCase();
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }

            valA = Number(valA || 0);
            valB = Number(valB || 0);
            return sortOrder === 'asc' ? valA - valB : valB - valA;
        });

        return resultado;
    },

    /**
     * Valida datos antes de crear o actualizar un vendedor
     */
    validarVendedor({ nombre, telefono, porcentaje_comision, estado }) {
        if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
            return { valido: false, error: 'El nombre del vendedor es obligatorio.' };
        }

        const pct = parseFloat(porcentaje_comision);
        if (isNaN(pct) || pct < 0 || pct > 100) {
            return { valido: false, error: 'El porcentaje de comisión debe estar entre 0% y 100%.' };
        }

        const estadoLimpio = estado === 'inactivo' ? 'inactivo' : 'activo';

        return {
            valido: true,
            error: null,
            data: {
                nombre: nombre.trim(),
                telefono: telefono ? String(telefono).trim() : null,
                porcentaje_comision: pct,
                estado: estadoLimpio
            }
        };
    },

    /**
     * Guarda o actualiza un vendedor en Supabase
     */
    async guardarVendedor(id, datos) {
        const supabase = await this.getSupabase();
        if (!supabase) throw new Error('Cliente Supabase no disponible');

        const val = this.validarVendedor(datos);
        if (!val.valido) throw new Error(val.error);

        if (id) {
            const { data, error } = await supabase
                .from('vendedores')
                .update(val.data)
                .eq('id', id)
                .select();
            if (error) throw error;
            return data?.[0];
        } else {
            const { data, error } = await supabase
                .from('vendedores')
                .insert([val.data])
                .select();
            if (error) throw error;
            return data?.[0];
        }
    },

    /**
     * Paga una comisión individual utilizando el RPC pagar_comision
     */
    async pagarComision(comisionId, cuentaId) {
        const supabase = await this.getSupabase();
        if (!supabase) throw new Error('Cliente Supabase no disponible');

        if (!comisionId || !cuentaId) {
            throw new Error('Comisión y cuenta bancaria son requeridas.');
        }

        const { error } = await supabase.rpc('pagar_comision', {
            p_comision_id: parseInt(comisionId, 10),
            p_cuenta_id: parseInt(cuentaId, 10)
        });

        if (error) throw error;

        // Invalidar cachés
        const DB = await this.getDB();
        if (DB && typeof DB.invalidateCache === 'function') {
            DB.invalidateCache('cuentas_bancarias');
            DB.invalidateCache('transacciones');
        }

        return true;
    },

    /**
     * Liquidación masiva inteligente de comisiones pendientes
     */
    async liquidarComisionesMasivas(comisionIds = [], cuentaId) {
        const supabase = await this.getSupabase();
        if (!supabase) throw new Error('Cliente Supabase no disponible');

        if (!Array.isArray(comisionIds) || comisionIds.length === 0) {
            throw new Error('No hay comisiones seleccionadas para liquidar.');
        }
        if (!cuentaId) {
            throw new Error('Debes seleccionar una cuenta bancaria de origen.');
        }

        const ctaId = parseInt(cuentaId, 10);
        const errores = [];
        let pagadas = 0;

        for (const cid of comisionIds) {
            try {
                const { error } = await supabase.rpc('pagar_comision', {
                    p_comision_id: parseInt(cid, 10),
                    p_cuenta_id: ctaId
                });
                if (error) throw error;
                pagadas++;
            } catch (err) {
                console.error(`Error liquidando comisión ${cid}:`, err);
                errores.push(`Comisión #${cid}: ${err.message}`);
            }
        }

        const DB = await this.getDB();
        if (DB && typeof DB.invalidateCache === 'function') {
            DB.invalidateCache('cuentas_bancarias');
            DB.invalidateCache('transacciones');
        }

        return { pagadas, errores };
    },

    /**
     * Mapea vendedores para exportación a Excel con sanitización CWE-1236
     */
    mapearParaExcel(vendedores = []) {
        const sanitize = (val) => {
            if (val === null || val === undefined) return '';
            const s = String(val).trim();
            // Prevención estricta contra inyección de fórmulas CSV (CWE-1236)
            if (/^[=+\-@\t\r]/.test(s)) {
                return "'" + s;
            }
            return s;
        };

        return (vendedores || []).map(v => {
            const totalVendido = Number(v.total_vendido || 0);
            const comisionPendiente = Number(v.comision_pendiente || 0);
            const comisionPagada = Number(v.comision_pagada || 0);
            const totalComision = comisionPendiente + comisionPagada;
            const tasa = totalComision > 0 ? Math.round((comisionPagada / totalComision) * 100) : 0;

            return {
                'ID': v.id,
                'Vendedor': sanitize(v.nombre),
                'Teléfono': sanitize(v.telefono || 'Sin teléfono'),
                '% Comisión': Number(v.porcentaje_comision || 0),
                'Total Vendido': totalVendido,
                'Comisión Pagada': comisionPagada,
                'Comisión Pendiente': comisionPendiente,
                'Tasa de Liquidación (%)': `${tasa}%`,
                'Estado': v.estado === 'activo' ? 'Activo' : 'Inactivo'
            };
        });
    }
};
