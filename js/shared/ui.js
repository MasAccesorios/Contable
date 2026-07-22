// js/shared/ui.js
// Componentes repetidos, toasts, modales

export const UI = {
    showToast(message, type = 'info') {
        console.log(`[TOAST ${type.toUpperCase()}]: ${message}`);
        // Lógica de Bootstrap Toast irá aquí
    }
};

export default UI;
