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
