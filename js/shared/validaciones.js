// js/shared/validaciones.js
// Reglas comunes (montos, fechas, campos requeridos)

export const Validaciones = {
    isValidMonto(monto) {
        return typeof monto === 'number' && monto >= 0;
    },
    
    isValidRequired(text) {
        return text && text.trim().length > 0;
    }
};

export default Validaciones;
