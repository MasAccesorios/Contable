// js/modules/inventario/categorias/categorias.data.js
// Capa de Datos y Lógica Pura para Gestión de Categorías Contables
// MAS Accesorios - Sistema Contable

/**
 * Normaliza un texto removiendo acentos y convirtiendo a minúsculas.
 */
function normalizeText(text) {
    if (!text) return '';
    return String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export const CategoriasData = {
    /**
     * Calcula los KPIs y contadores ejecutivos del catálogo de categorías.
     * @param {Array} categorias 
     * @param {Object} conteoMovimientos 
     * @returns {Object}
     */
    calcularKpis(categorias, conteoMovimientos = {}) {
        if (!Array.isArray(categorias)) {
            return {
                total: 0,
                activas: 0,
                inactivas: 0,
                egresos: 0,
                ingresos: 0,
                totalMovimientos: 0
            };
        }

        let activas = 0;
        let inactivas = 0;
        let egresos = 0;
        let ingresos = 0;

        for (const cat of categorias) {
            if (cat.estado === 'activa') {
                activas++;
            } else {
                inactivas++;
            }

            if (cat.tipo_flujo === 'out') {
                egresos++;
            } else if (cat.tipo_flujo === 'in') {
                ingresos++;
            }
        }

        const totalMovimientos = Object.values(conteoMovimientos || {}).reduce(
            (sum, count) => sum + Number(count || 0),
            0
        );

        return {
            total: categorias.length,
            activas,
            inactivas,
            egresos,
            ingresos,
            totalMovimientos
        };
    },

    /**
     * Filtra y busca en el arreglo de categorías por pestaña y query de texto.
     * @param {Array} categorias 
     * @param {string} tab - 'todas', 'egresos', 'ingresos', 'inactivas', 'activas'
     * @param {string} query 
     * @returns {Array}
     */
    filtrarYBuscar(categorias, tab = 'todas', query = '') {
        if (!Array.isArray(categorias)) return [];

        let items = [...categorias];

        // 1. Filtrado por Pestaña
        if (tab === 'egresos') {
            items = items.filter(c => c.tipo_flujo === 'out');
        } else if (tab === 'ingresos') {
            items = items.filter(c => c.tipo_flujo === 'in');
        } else if (tab === 'inactivas') {
            items = items.filter(c => c.estado === 'inactiva');
        } else if (tab === 'activas') {
            items = items.filter(c => c.estado === 'activa');
        }

        // 2. Búsqueda en tiempo real
        const cleanQuery = normalizeText(query);
        if (cleanQuery) {
            items = items.filter(c => {
                const nombreNorm = normalizeText(c.nombre);
                const flujoNorm = c.tipo_flujo === 'in' ? 'ingreso in' : 'egreso gasto out';
                return nombreNorm.includes(cleanQuery) || flujoNorm.includes(cleanQuery);
            });
        }

        return items;
    },

    /**
     * Valida y sanitiza una categoría antes de persistirla en Supabase.
     * @param {Object} categoria 
     * @param {Array} categoriasExistentes 
     * @param {number|string} editingId 
     * @returns {{ valido: boolean, error?: string, categoriaLimpia?: Object }}
     */
    validarCategoria(categoria, categoriasExistentes = [], editingId = null) {
        if (!categoria) {
            return { valido: false, error: 'Datos de categoría inválidos.' };
        }

        const nombre = (categoria.nombre || '').trim();
        if (!nombre || nombre.length < 2) {
            return { valido: false, error: 'El nombre de la categoría debe tener al menos 2 caracteres.' };
        }

        // Validar no duplicados (insensible a acentos/mayúsculas)
        const nombreNorm = normalizeText(nombre);
        const duplicado = categoriasExistentes.find(c => {
            if (editingId && String(c.id) === String(editingId)) return false;
            return normalizeText(c.nombre) === nombreNorm;
        });

        if (duplicado) {
            return { valido: false, error: `Ya existe una categoría con el nombre "${duplicado.nombre}".` };
        }

        // Normalizar flujo y estado
        const tipo_flujo = (categoria.tipo_flujo === 'in' || categoria.tipo_flujo === 'ingreso') ? 'in' : 'out';
        const estado = (categoria.estado === 'inactiva') ? 'inactiva' : 'activa';

        return {
            valido: true,
            categoriaLimpia: {
                nombre,
                tipo_flujo,
                estado
            }
        };
    },

    /**
     * Mapea las categorías a una estructura limpia para exportación tabular con blindaje CWE-1236.
     * @param {Array} categorias 
     * @param {Object} conteoMovimientos 
     * @returns {Array<Object>}
     */
    mapearParaExcel(categorias, conteoMovimientos = {}) {
        if (!Array.isArray(categorias)) return [];

        const sanitizeFormula = (val) => {
            const str = String(val ?? '');
            if (/^[=+\-@\t\r]/.test(str)) {
                return `'${str}`;
            }
            return str;
        };

        return categorias.map(c => {
            const count = conteoMovimientos[c.nombre] || 0;
            return {
                'ID': c.id,
                'Nombre': sanitizeFormula(c.nombre),
                'Flujo': c.tipo_flujo === 'in' ? 'Ingreso' : 'Egreso / Gasto',
                'Estado': c.estado === 'activa' ? 'Activa' : 'Inactiva',
                'Movimientos Asociados': Number(count),
                'Fecha de Creación': c.created_at ? new Date(c.created_at).toLocaleDateString('es-CO') : '-'
            };
        });
    }
};
