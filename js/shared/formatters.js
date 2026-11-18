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
    const strVal = String(value).replace(/\./g, '').replace(/,/g, '.');
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
