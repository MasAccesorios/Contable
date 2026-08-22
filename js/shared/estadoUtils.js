export const EstadoUtils = {
    /**
     * Verifica de forma segura y unificada si un documento (factura, nota de crédito, cotización)
     * está en estado anulado, cubriendo todas las variaciones históricas y de sincronización con Alegra.
     * @param {string} estado 
     * @returns {boolean}
     */
    estaAnulado: function(estado) {
        if (!estado) return false;
        const e = estado.toLowerCase().trim();
        return e === 'anulada' || e === 'void' || e === 'voided' || e === 'anulado';
    }
};
