// js/shared/validaciones.js
// Reglas comunes (montos, fechas, campos requeridos)

export const Validaciones = {
    isValidMonto(monto) {
        return typeof monto === 'number' && monto >= 0;
    },
    
    isValidRequired(text) {
        return text && text.trim().length > 0;
    },
    
    hasStockSuficiente(producto, cantidadA_vender) {
        if (!producto) return false;
        return (producto.stockActual || 0) >= cantidadA_vender;
    }
};

export default Validaciones;
