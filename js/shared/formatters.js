export function formatCurrencyInput(e) {
    let input = e.target;
    let value = input.value;
    if (value === '') return;

    let isNegative = value.startsWith('-');
    value = value.replace(/[^0-9,]/g, '');

    let parts = value.split(',');
    let intPart = parts[0];

    if (intPart) {
        intPart = parseInt(intPart, 10).toString();
        intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    let formatted = intPart;
    if (parts.length > 1) {
        formatted += ',' + parts[1].substring(0, 2);
    }

    if (isNegative) formatted = '-' + formatted;

    input.value = formatted;
}

export function parseCurrencyValue(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    const clean = String(value).replace(/[^0-9.,-]/g, '');
    const strVal = clean.replace(/\./g, '').replace(/,/g, '.');
    const parsed = parseFloat(strVal);
    return isNaN(parsed) ? 0 : parsed;
}

export function applyCurrencyFormatting(inputEl) {
    if (!inputEl) return;
    if (inputEl.type === 'number') {
        inputEl.type = 'text';
    }
    
    // Add event listeners
    inputEl.removeEventListener('input', formatCurrencyInput);
    inputEl.addEventListener('input', formatCurrencyInput);
    
    // Initial format if there is a value
    if (inputEl.value) {
        // Trigger formatting manually
        formatCurrencyInput({ target: inputEl });
    }
}

/**
 * Escapa caracteres HTML especiales para prevenir XSS
 * al insertar texto libre en innerHTML.
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Genera iniciales y una paleta de color determinista pastel para avatares de clientes o terceros.
 * @param {string|null|undefined} name 
 * @returns {{ initials: string, bg: string, color: string }}
 */
export function getClientAvatar(name) {
    const clean = String(name || '').trim();
    if (!clean || clean === '-' || clean === 'Sin Cliente' || clean === 'Sin Proveedor' || clean === 'General / Sin tercero') {
        return { initials: '?', bg: '#f1f5f9', color: '#64748b' };
    }
    const parts = clean.split(/\s+/);
    let initials = parts[0][0] || '';
    if (parts.length > 1 && parts[1][0]) initials += parts[1][0];
    initials = initials.toUpperCase().substring(0, 2);

    const palette = [
        { bg: '#eff6ff', color: '#1d4ed8' },
        { bg: '#ecfdf5', color: '#059669' },
        { bg: '#fef3c7', color: '#d97706' },
        { bg: '#f3e8ff', color: '#7e22ce' },
        { bg: '#e0f2fe', color: '#0369a1' },
        { bg: '#ccfbf1', color: '#0f766e' },
        { bg: '#fef2f2', color: '#dc2626' },
        { bg: '#fff7ed', color: '#ea580c' },
        { bg: '#f1f5f9', color: '#475569' }
    ];

    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % palette.length;
    return { initials, ...palette[index] };
}

/**
 * Sanitiza valores de texto para exportaciones CSV/Excel,
 * neutralizando Formula Injection (CWE-1236) anteponiendo apóstrofe si inicia con =, +, -, @, \t o \r.
 * @param {any} val
 * @returns {string}
 */
export function sanitizeForCSV(val) {
    if (val === null || val === undefined) return '';
    let str = String(val);
    const trimmed = str.trim();
    if (/^[=+\-@\t\r]/.test(str) || /^[=+\-@\t\r]/.test(trimmed)) {
        return "'" + str.replace(/"/g, '""');
    }
    return str.replace(/"/g, '""');
}

/**
 * Extrae de forma segura e intencional un número de documento contable (factura o cotización)
 * a partir de la consulta del buscador, evitando falsos positivos con nombres de productos,
 * referencias técnicas o textos compuestos (ej. "2 en 1 Wireless T67", "Cable 3 en 1", "iPhone 15").
 *
 * @param {string|null|undefined} query
 * @returns {number|null} El número de documento si la intención de búsqueda es un documento, o null en caso contrario.
 */
export function extractDocumentNumber(query) {
    if (!query || typeof query !== 'string') return null;
    const clean = query.trim();
    if (!clean) return null;

    // 1. Número puro o con prefijo directo de código: "2167", "#2167", "# 6882", "FE-2167", "FAC-2167", "COT-45"
    const matchDirecto = clean.match(/^(?:#\s*|(?:fe|fac|cot)[-_ ]\s*)?(\d{1,8})$/i);
    if (matchDirecto) {
        return parseInt(matchDirecto[1], 10);
    }

    // 2. Prefijo explícito de factura o cotización en palabras: "Factura #2167", "factura 6882", "fac 2167", "cotización #12", "cot 45"
    const matchPalabras = clean.match(/^(?:factura|fac\.?|cotizaci[oó]n|cot\.?)\s*(?:#|no\.?|n[°º])?\s*(\d{1,8})$/i);
    if (matchPalabras) {
        return parseInt(matchPalabras[1], 10);
    }

    return null;
}

/**
 * Diccionario de patrones fonéticos y terminaciones comunes en español
 * para búsqueda tolerante a acentos cuando la base de datos no tiene extensión unaccent.
 */
const SPANISH_ACCENT_PATTERNS = [
    { regex: /cion\b/gi, replacement: 'ci_n' },
    { regex: /sion\b/gi, replacement: 'si_n' },
    { regex: /bateria/gi, replacement: 'bater_a' },
    { regex: /hibrid/gi, replacement: 'h_brid' },
    { regex: /camara/gi, replacement: 'c_mara' },
    { regex: /telefono/gi, replacement: 'tel_fono' },
    { regex: /lampara/gi, replacement: 'l_mpara' },
    { regex: /debito/gi, replacement: 'd_bito' },
    { regex: /credito/gi, replacement: 'cr_dito' },
    { regex: /numero/gi, replacement: 'n_mero' },
    { regex: /linea/gi, replacement: 'l_nea' },
    { regex: /musica/gi, replacement: 'm_sica' },
    { regex: /optico/gi, replacement: '_ptico' },
    { regex: /inalambrico/gi, replacement: 'inal_mbrico' },
    { regex: /electronico/gi, replacement: 'electr_nico' },
    { regex: /articul/gi, replacement: 'art_cul' }
];

/**
 * Genera variantes de texto seguras para búsquedas en español tolerantes a acentos en PostgreSQL/PostgREST.
 * @param {string|null|undefined} query
 * @returns {{ safeQuery: string, wildcardQuery: string, hasDiacritics: boolean }}
 */
export function toSpanishSearchVariants(query) {
    if (!query || typeof query !== 'string') {
        return { safeQuery: '', wildcardQuery: '', hasDiacritics: false };
    }

    // 1. Sanitizar comas, paréntesis, comillas y barras invertidas que rompen la sintaxis .or() de PostgREST
    const safeQuery = query.replace(/[,()"\\]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!safeQuery) {
        return { safeQuery: '', wildcardQuery: '', hasDiacritics: false };
    }

    const hasDiacritics = /[áéíóúüñÁÉÍÓÚÜÑ]/.test(safeQuery);
    let wildcardQuery = safeQuery;

    if (hasDiacritics) {
        // Sustituir vocales acentuadas por el comodín SQL '_' (coincide con cualquier carácter en PostgreSQL ILIKE)
        wildcardQuery = safeQuery.replace(/[áéíóúüÁÉÍÓÚÜ]/gi, '_');
    } else {
        // Probar si contiene palabras o sufijos comunes que suelen llevar tilde
        for (const pattern of SPANISH_ACCENT_PATTERNS) {
            wildcardQuery = wildcardQuery.replace(pattern.regex, pattern.replacement);
        }
    }

    return { safeQuery, wildcardQuery, hasDiacritics };
}

/**
 * Resalta de forma 100% segura contra XSS y tolerante a tildes los términos coincidentes dentro de un texto.
 * Utiliza <mark class="gs-highlight"> sobre fragmentos escapados.
 *
 * @param {string|null|undefined} text Texto original a mostrar
 * @param {string|null|undefined} query Términos de búsqueda ingresados
 * @returns {string} Fragmento HTML seguro con coincidencias resaltadas
 */
export function highlightMatches(text, query) {
    if (text == null || text === '') return '';
    const rawText = String(text);

    if (!query || typeof query !== 'string') {
        return escapeHtml(rawText);
    }

    const cleanQuery = query.trim();
    if (!cleanQuery) {
        return escapeHtml(rawText);
    }

    // Mapa de correspondencia de diacríticos para regex
    const charMap = {
        'a': '[aáAÁ]', 'á': '[aáAÁ]', 'A': '[aáAÁ]', 'Á': '[aáAÁ]',
        'e': '[eéEÉ]', 'é': '[eéEÉ]', 'E': '[eéEÉ]', 'É': '[eéEÉ]',
        'i': '[iíIÍ]', 'í': '[iíIÍ]', 'I': '[iíIÍ]', 'Í': '[iíIÍ]',
        'o': '[oóOÓ]', 'ó': '[oóOÓ]', 'O': '[oóOÓ]', 'Ó': '[oóOÓ]',
        'u': '[uúüUÚÜ]', 'ú': '[uúüUÚÜ]', 'ü': '[uúüUÚÜ]', 'U': '[uúüUÚÜ]', 'Ú': '[uúüUÚÜ]', 'Ü': '[uúüUÚÜ]',
        'n': '[nñNÑ]', 'ñ': '[nñNÑ]', 'N': '[nñNÑ]', 'Ñ': '[nñNÑ]'
    };

    function buildPattern(str) {
        let pattern = '';
        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (charMap[ch]) {
                pattern += charMap[ch];
            } else if (/[.*+?^${}()|[\]\\]/.test(ch)) {
                pattern += '\\' + ch;
            } else {
                pattern += ch;
            }
        }
        return pattern;
    }

    // Extraer términos a buscar (la frase completa y cada palabra individual >= 2 caracteres)
    const terms = [cleanQuery];
    if (cleanQuery.includes(' ')) {
        const tokens = cleanQuery.split(/\s+/).filter(t => t.length >= 2);
        terms.push(...tokens);
    }

    const intervals = [];
    terms.forEach(term => {
        try {
            const rx = new RegExp(buildPattern(term), 'gi');
            let match;
            while ((match = rx.exec(rawText)) !== null) {
                if (match[0].length === 0) break;
                intervals.push([match.index, match.index + match[0].length]);
            }
        } catch {
            // Ignorar expresiones no válidas defensivamente
        }
    });

    if (intervals.length === 0) {
        return escapeHtml(rawText);
    }

    // Ordenar y fusionar intervalos solapados
    intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged = [];
    for (const [start, end] of intervals) {
        if (merged.length === 0 || merged[merged.length - 1][1] < start) {
            merged.push([start, end]);
        } else {
            merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], end);
        }
    }

    // Construir HTML sanitizado aplicando <mark class="gs-highlight">
    let result = '';
    let lastIndex = 0;
    for (const [start, end] of merged) {
        if (start > lastIndex) {
            result += escapeHtml(rawText.slice(lastIndex, start));
        }
        result += `<mark class="gs-highlight">${escapeHtml(rawText.slice(start, end))}</mark>`;
        lastIndex = end;
    }
    if (lastIndex < rawText.length) {
        result += escapeHtml(rawText.slice(lastIndex));
    }

    return result;
}
