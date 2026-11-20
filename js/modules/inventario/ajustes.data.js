// js/modules/inventario/ajustes.data.js
// Capa de Acceso a Datos, Normalización, KPIs y Exportación de Ajustes de Inventario

function normalizeString(str) {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

export const AjustesData = {
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

    async cargarAjustes() {
        const client = await this.getSupabase();
        if (!client) return [];
        const { data, error } = await client
            .from('ajustes_inventario')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(a => this.decorarAjuste(a));
    },

    decorarAjuste(raw) {
        if (!raw) return null;

        const id = raw.id;
        const numero = raw.numero;
        const fecha = raw.fecha || '';
        const observaciones = raw.observaciones !== null && raw.observaciones !== undefined ? String(raw.observaciones) : '';
        const created_at = raw.created_at || '';

        let detalles = [];
        if (typeof raw.detalles === 'string') {
            try {
                detalles = JSON.parse(raw.detalles);
            } catch (e) {
                detalles = [];
            }
        } else if (Array.isArray(raw.detalles)) {
            detalles = raw.detalles;
        }

        let unidadesIncrementadas = 0;
        let unidadesDisminuidas = 0;
        let costoTotalEstimado = 0;
        let hasIncremento = false;
        let hasDisminucion = false;

        const obsNorm = normalizeString(observaciones);
        let isCheckpoint = obsNorm.includes('checkpoint') || obsNorm.includes('reconciliacion masiva') || detalles.length > 50;

        detalles.forEach(d => {
            if (!d) return;

            // Esquema estándar con tipo explícito
            if (d.tipo === 'incremento') {
                const qty = Math.abs(parseFloat(d.cantidad) || 0);
                const costo = parseFloat(d.costo_unitario) || 0;
                unidadesIncrementadas += qty;
                if (qty > 0) hasIncremento = true;
                if (costo > 0) costoTotalEstimado += (qty * costo);
            } else if (d.tipo === 'disminucion') {
                const qty = Math.abs(parseFloat(d.cantidad) || 0);
                unidadesDisminuidas += qty;
                if (qty > 0) hasDisminucion = true;
            } else if (d.tipo === 'cantidad') {
                // Esquema delta: de -> a
                const de = parseFloat(d.de) || 0;
                const a = parseFloat(d.a) || 0;
                const delta = a - de;
                if (delta > 0) {
                    unidadesIncrementadas += delta;
                    hasIncremento = true;
                } else if (delta < 0) {
                    unidadesDisminuidas += Math.abs(delta);
                    hasDisminucion = true;
                }
            } else if (d.a !== undefined && d.tipo === undefined) {
                // Snapshot masivo de conteo físico (a = conteo)
                isCheckpoint = true;
            }
        });

        // Clasificación de Tipo
        let tipo = 'checkpoint';
        if (isCheckpoint) {
            tipo = 'checkpoint';
        } else if (hasIncremento && hasDisminucion) {
            tipo = 'mixto';
        } else if (hasIncremento) {
            tipo = 'incremento';
        } else if (hasDisminucion) {
            tipo = 'disminucion';
        } else if (detalles.length === 0) {
            tipo = 'checkpoint';
        }

        const balanceNeto = unidadesIncrementadas - unidadesDisminuidas;
        const totalItems = detalles.length;

        // Construcción de searchIndex exhaustivo y normalizado
        const searchParts = [
            String(numero),
            `#${numero}`,
            fecha,
            observaciones,
            tipo
        ];

        detalles.forEach(d => {
            if (!d) return;
            if (d.sku) searchParts.push(String(d.sku));
            if (d.nombre) searchParts.push(String(d.nombre));
        });

        const rawIndex = searchParts.join(' ').toLowerCase();
        const searchIndex = normalizeString(rawIndex);

        return {
            id,
            numero,
            fecha,
            observaciones,
            created_at,
            detalles,
            tipo,
            isCheckpoint,
            unidadesIncrementadas,
            unidadesDisminuidas,
            balanceNeto,
            totalItems,
            costoTotalEstimado,
            searchIndex
        };
    },

    calcularKpis(ajustes) {
        if (!Array.isArray(ajustes) || ajustes.length === 0) {
            return {
                totalAjustes: 0,
                unidadesIncrementadas: 0,
                unidadesDisminuidas: 0,
                balanceNeto: 0,
                totalItems: 0,
                tabCounts: {
                    todas: 0,
                    incrementos: 0,
                    disminuciones: 0,
                    checkpoints: 0
                }
            };
        }

        let totalAjustes = ajustes.length;
        let unidadesIncrementadas = 0;
        let unidadesDisminuidas = 0;
        let totalItems = 0;

        let countIncrementos = 0;
        let countDisminuciones = 0;
        let countCheckpoints = 0;

        ajustes.forEach(a => {
            if (!a) return;
            unidadesIncrementadas += (a.unidadesIncrementadas || 0);
            unidadesDisminuidas += (a.unidadesDisminuidas || 0);
            totalItems += (a.totalItems || 0);

            // Conteos dinámicos para tabs
            if (a.tipo === 'incremento' || (a.tipo === 'mixto' && (a.unidadesIncrementadas || 0) > 0)) {
                countIncrementos++;
            }
            if (a.tipo === 'disminucion' || (a.tipo === 'mixto' && (a.unidadesDisminuidas || 0) > 0)) {
                countDisminuciones++;
            }
            if (a.tipo === 'checkpoint' || a.isCheckpoint) {
                countCheckpoints++;
            }
        });

        const balanceNeto = unidadesIncrementadas - unidadesDisminuidas;

        return {
            totalAjustes,
            unidadesIncrementadas,
            unidadesDisminuidas,
            balanceNeto,
            totalItems,
            tabCounts: {
                todas: totalAjustes,
                incrementos: countIncrementos,
                disminuciones: countDisminuciones,
                checkpoints: countCheckpoints
            }
        };
    },

    filtrarAjustes(dataset, filterCriteria) {
        if (!Array.isArray(dataset)) return [];

        const tab = (typeof filterCriteria === 'string' ? filterCriteria : filterCriteria?.tab) || 'todas';
        const rawQuery = (typeof filterCriteria === 'object' ? filterCriteria?.query : '') || '';
        const cleanQuery = normalizeString(rawQuery.replace(/^#/, ''));

        return dataset.filter(a => {
            if (!a) return false;

            // Filtro por tab
            if (tab === 'incrementos') {
                const match = a.tipo === 'incremento' || (a.tipo === 'mixto' && (a.unidadesIncrementadas || 0) > 0);
                if (!match) return false;
            } else if (tab === 'disminuciones') {
                const match = a.tipo === 'disminucion' || (a.tipo === 'mixto' && (a.unidadesDisminuidas || 0) > 0);
                if (!match) return false;
            } else if (tab === 'checkpoints') {
                const match = a.tipo === 'checkpoint' || a.isCheckpoint;
                if (!match) return false;
            }

            // Filtro por texto de búsqueda
            if (cleanQuery) {
                const inIndex = a.searchIndex && a.searchIndex.includes(cleanQuery);
                const inNum = String(a.numero).includes(cleanQuery);
                if (!inIndex && !inNum) return false;
            }

            return true;
        });
    },

    paginar(items, page, pageSize = 25) {
        const list = Array.isArray(items) ? items : [];
        const totalItems = list.length;
        const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

        let currentPage = parseInt(page, 10) || 1;
        if (totalItems === 0) {
            currentPage = 1;
        } else if (currentPage < 1) {
            currentPage = 1;
        } else if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const sliced = list.slice(startIndex, endIndex);

        return {
            items: sliced,
            totalItems,
            totalPages,
            currentPage,
            pageSize
        };
    },

    mapearAjustesParaExport(ajustes) {
        if (!Array.isArray(ajustes) || ajustes.length === 0) return [];

        return ajustes.map(a => {
            let tipoLabel = 'Checkpoint';
            if (a.tipo === 'incremento') tipoLabel = 'Incremento';
            else if (a.tipo === 'disminucion') tipoLabel = 'Disminución';
            else if (a.tipo === 'mixto') tipoLabel = 'Mixto';

            return {
                'Número': `#${a.numero}`,
                'Fecha': a.fecha || '',
                'Tipo': tipoLabel,
                'Ítems': a.totalItems || 0,
                'Unidades +': a.unidadesIncrementadas || 0,
                'Unidades -': a.unidadesDisminuidas || 0,
                'Balance': a.balanceNeto || 0,
                'Observaciones': a.observaciones || ''
            };
        });
    }
};
