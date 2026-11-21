// js/modules/configuracion/configuracion.data.js
// Capa de Datos y Lógica de Negocio para Configuración del Sistema 360°

const STORAGE_KEY_EMPRESA = 'config_empresa_perfil';

export const ConfiguracionData = {
    _supabase: null,

    async getSupabase() {
        if (this._supabase) return this._supabase;
        if (typeof window !== 'undefined' && window.supabase) return window.supabase;
        try {
            const mod = await import('../../core/supabase.js');
            this._supabase = mod.supabase;
            return this._supabase;
        } catch (e) {
            return null;
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Validaciones y Normalización Pura
    // ─────────────────────────────────────────────────────────────────────────

    validarNuevoConsecutivo(valor, maxActual = 0) {
        // Rechazar tipos inválidos
        if (valor === null || valor === undefined || valor === '' || typeof valor === 'boolean' || typeof valor === 'object') {
            return { valido: false, numero: null, error: 'Debe ingresar un número entero positivo mayor a 0.' };
        }

        // Rechazar inyecciones de fórmulas (CWE-1236)
        if (typeof valor === 'string') {
            const trimmedStr = valor.trim();
            if (/^[=+\-@\t\r]/.test(trimmedStr)) {
                return { valido: false, numero: null, error: 'Entrada inválida o fórmula no permitida.' };
            }
            if (trimmedStr.includes('.') || trimmedStr.includes(',')) {
                return { valido: false, numero: null, error: 'El consecutivo debe ser un número entero sin decimales.' };
            }
        }

        if (typeof valor === 'number') {
            if (!Number.isFinite(valor) || !Number.isInteger(valor)) {
                return { valido: false, numero: null, error: 'El consecutivo debe ser un número entero finito sin decimales.' };
            }
        }

        const strVal = String(valor).trim();
        if (!/^\d+$/.test(strVal)) {
            return { valido: false, numero: null, error: 'Debe ingresar un número entero positivo mayor a 0.' };
        }

        const num = Number(strVal);
        if (!Number.isSafeInteger(num) || num < 1) {
            return { valido: false, numero: null, error: 'El número está fuera del rango seguro permitido.' };
        }

        const maxInt = Number(maxActual) || 0;
        if (num <= maxInt) {
            return {
                valido: false,
                numero: num,
                error: `El número ${num} es menor o igual al máximo en uso (${maxInt}). Debe ser un valor estrictamente mayor para evitar colisiones.`
            };
        }

        return { valido: true, numero: num, error: null };
    },

    calcularKpis(state = {}) {
        const s = state || {};
        const proximoFactura = Number(s.proximoFactura) || 1;
        const proximoCotizacion = Number(s.proximoCotizacion) || 1;
        const maxActual = Number(s.maxActual) || 0;
        const categorias = Array.isArray(s.categorias) ? s.categorias : [];
        const empresa = s.empresa || {};

        const totalCategorias = categorias.length;
        const categoriasActivas = categorias.filter(c => c && c.estado === 'activa').length;
        const categoriasIngreso = categorias.filter(c => c && c.tipo_flujo === 'in' && c.estado === 'activa').length;
        const categoriasEgreso = categorias.filter(c => c && c.tipo_flujo === 'out' && c.estado === 'activa').length;

        const perfilCompleto = !!(
            empresa &&
            empresa.razonSocial &&
            empresa.nit &&
            empresa.telefono
        );

        return {
            proximoDoc: Math.max(proximoFactura, proximoCotizacion),
            proximoFactura,
            proximoCotizacion,
            maxActual,
            totalCategorias,
            categoriasActivas,
            categoriasIngreso,
            categoriasEgreso,
            perfilCompleto
        };
    },

    calcularTabCounts(categorias = []) {
        const lista = Array.isArray(categorias) ? categorias : [];
        return {
            todas: lista.length,
            egresos: lista.filter(c => c && c.tipo_flujo === 'out' && c.estado === 'activa').length,
            ingresos: lista.filter(c => c && c.tipo_flujo === 'in' && c.estado === 'activa').length,
            inactivas: lista.filter(c => c && c.estado === 'inactiva').length
        };
    },

    filtrarCategorias(categorias = [], options = {}) {
        const lista = Array.isArray(categorias) ? categorias : [];
        const opts = options || {};
        const tab = opts.tab || 'todas';
        const cleanQuery = this._normalizarTexto(opts.query || '');

        return lista.filter(cat => {
            if (!cat) return false;

            // Filtro por pestaña
            if (tab === 'egresos') {
                if (cat.tipo_flujo !== 'out' || cat.estado !== 'activa') return false;
            } else if (tab === 'ingresos') {
                if (cat.tipo_flujo !== 'in' || cat.estado !== 'activa') return false;
            } else if (tab === 'inactivas') {
                if (cat.estado !== 'inactiva') return false;
            }

            // Filtro por texto de búsqueda
            if (cleanQuery) {
                const nombreNorm = this._normalizarTexto(cat.nombre || '');
                if (!nombreNorm.includes(cleanQuery)) return false;
            }

            return true;
        });
    },

    validarCategoria(categoria = {}, categoriasExistentes = []) {
        if (!categoria || typeof categoria !== 'object' || Array.isArray(categoria)) {
            return { valido: false, error: 'Datos de categoría inválidos.' };
        }

        const nombre = (categoria.nombre || '').trim();
        const tipo_flujo = (categoria.tipo_flujo || '').trim();

        if (nombre.length < 3) {
            return { valido: false, error: 'El nombre de la categoría debe tener al menos 3 caracteres.' };
        }

        if (nombre.length > 100) {
            return { valido: false, error: 'El nombre de la categoría no puede superar los 100 caracteres.' };
        }

        // Rechazar inyecciones de fórmulas (CWE-1236)
        if (/^[=+\-@\t\r]/.test(nombre)) {
            return { valido: false, error: 'El nombre de la categoría contiene caracteres de fórmula no permitidos.' };
        }

        if (tipo_flujo !== 'in' && tipo_flujo !== 'out') {
            return { valido: false, error: 'El tipo de flujo debe ser "in" (Ingreso) o "out" (Gasto/Egreso).' };
        }

        const nombreNorm = this._normalizarTexto(nombre);
        const yaExiste = (categoriasExistentes || []).some(c => 
            c && this._normalizarTexto(c.nombre) === nombreNorm && c.id !== categoria.id
        );

        if (yaExiste) {
            return { valido: false, error: `La categoría "${nombre}" ya existe en el sistema.` };
        }

        return {
            valido: true,
            error: null,
            categoriaLimpia: {
                nombre,
                tipo_flujo,
                estado: categoria.estado || 'activa'
            }
        };
    },

    sanitizarPerfilEmpresa(perfil = {}) {
        const p = (perfil && typeof perfil === 'object' && !Array.isArray(perfil)) ? perfil : {};
        let telLimpio = p.telefono ? String(p.telefono).replace(/\D/g, '') : '';
        if (telLimpio.startsWith('57') && telLimpio.length === 12) {
            telLimpio = telLimpio.slice(2);
        }

        return {
            razonSocial: (p.razonSocial || '').trim() || 'MAS Accesorios',
            titular: (p.titular || '').trim() || 'Diego Izquierdo',
            nit: (p.nit || '').trim() || '79981638-4',
            telefono: telLimpio || '3158512091',
            email: (p.email || '').trim() || 'contacto@masaccesorios.com',
            ciudad: (p.ciudad || '').trim() || 'Cali',
            direccion: (p.direccion || '').trim() || 'Calle 10 # 5-20, Centro Comercial Pasaje Cali',
            regimen: (p.regimen || '').trim() || 'Régimen Simplificado',
            terminosCotizacion: (p.terminosCotizacion || '').trim() || 'Vigencia de 15 días calendario. Precios sujetos a cambio sin previo aviso. Despachos contra confirmación de pago.',
            notasFactura: (p.notasFactura || '').trim() || 'Esta factura de venta se asimila a una letra de cambio según el artículo 774 del Código de Comercio. Pasados 30 días se causarán intereses moratorios autorizados por la ley.'
        };
    },

    _normalizarTexto(str) {
        if (!str) return '';
        return String(str)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Operaciones Asíncronas Supabase y LocalStorage
    // ─────────────────────────────────────────────────────────────────────────

    async cargarDatosIniciales() {
        try {
            const supabase = await this.getSupabase();
            if (!supabase) throw new Error('Cliente Supabase no disponible en este entorno');

            const [
                resFacturaNext,
                resCotizacionNext,
                resMaxFactura,
                resMaxCotizacion,
                resCategorias
            ] = await Promise.all([
                supabase.rpc('get_next_numero', { p_table: 'facturas' }),
                supabase.rpc('get_next_numero', { p_table: 'cotizaciones' }),
                supabase.from('facturas').select('numero').order('numero', { ascending: false }).limit(1),
                supabase.from('cotizaciones').select('numero').order('numero', { ascending: false }).limit(1),
                supabase.from('categorias_contables').select('*').order('tipo_flujo').order('nombre')
            ]);

            const maxFactura = resMaxFactura.data?.[0]?.numero || 0;
            const maxCotizacion = resMaxCotizacion.data?.[0]?.numero || 0;
            const maxActual = Math.max(Number(maxFactura), Number(maxCotizacion));

            const proximoFactura = Number(resFacturaNext.data) || (maxActual + 1);
            const proximoCotizacion = Number(resCotizacionNext.data) || (maxActual + 1);

            const categorias = resCategorias.data || [];

            // Cargar datos de empresa de LocalStorage con fallback
            let empresa = null;
            try {
                const stored = localStorage.getItem(STORAGE_KEY_EMPRESA);
                if (stored) empresa = JSON.parse(stored);
            } catch (e) {
                console.warn('[ConfiguracionData] Error leyendo empresa de localStorage:', e);
            }
            empresa = this.sanitizarPerfilEmpresa(empresa);

            return {
                proximoFactura,
                proximoCotizacion,
                maxActual,
                categorias,
                empresa,
                error: null
            };
        } catch (error) {
            console.error('[ConfiguracionData] Error en cargarDatosIniciales:', error);
            return {
                proximoFactura: 1,
                proximoCotizacion: 1,
                maxActual: 0,
                categorias: [],
                empresa: this.sanitizarPerfilEmpresa({}),
                error: error.message
            };
        }
    },

    async guardarConsecutivo(tabla, nuevoNumero) {
        if (!['facturas', 'cotizaciones'].includes(tabla)) {
            throw new Error(`Tabla no permitida para consecutivo: ${tabla}`);
        }
        const num = Number(nuevoNumero);
        if (!Number.isSafeInteger(num) || num <= 0) {
            throw new Error('El consecutivo debe ser un entero positivo válido.');
        }
        const supabase = await this.getSupabase();
        if (!supabase) throw new Error('Cliente Supabase no disponible');
        const { error } = await supabase.rpc('set_next_numero', {
            p_table: tabla,
            p_next: num
        });
        if (error) throw error;
        return true;
    },

    async crearCategoria(categoria) {
        const supabase = await this.getSupabase();
        if (!supabase) throw new Error('Cliente Supabase no disponible');
        // Obtener el siguiente ID determinista
        const { data: maxRows } = await supabase
            .from('categorias_contables')
            .select('id')
            .order('id', { ascending: false })
            .limit(1);

        const nextId = (maxRows?.[0]?.id || 0) + 1;

        const payload = {
            id: nextId,
            nombre: categoria.nombre.trim(),
            tipo_flujo: categoria.tipo_flujo,
            estado: 'activa'
        };

        const { data, error } = await supabase
            .from('categorias_contables')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async toggleEstadoCategoria(id, nuevoEstado) {
        if (!['activa', 'inactiva'].includes(nuevoEstado)) {
            throw new Error('Estado de categoría no válido.');
        }
        const numId = Number(id);
        if (!Number.isSafeInteger(numId) || numId <= 0) {
            throw new Error('ID de categoría inválido.');
        }
        const supabase = await this.getSupabase();
        if (!supabase) throw new Error('Cliente Supabase no disponible');
        const { error } = await supabase
            .from('categorias_contables')
            .update({ estado: nuevoEstado })
            .eq('id', numId);

        if (error) throw error;
        return true;
    },

    guardarPerfilEmpresa(perfil) {
        const sanitized = this.sanitizarPerfilEmpresa(perfil);
        try {
            localStorage.setItem(STORAGE_KEY_EMPRESA, JSON.stringify(sanitized));
        } catch (e) {
            console.warn('[ConfiguracionData] Error guardando perfil en localStorage:', e);
        }
        return sanitized;
    },

    obtenerPerfilEmpresa() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_EMPRESA);
            return this.sanitizarPerfilEmpresa(raw ? JSON.parse(raw) : {});
        } catch (e) {
            return this.sanitizarPerfilEmpresa({});
        }
    }
};
