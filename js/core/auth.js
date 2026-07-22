// js/core/auth.js
// Manejo de sesión y roles (Firebase Auth)

export const Auth = {
    user: null,
    
    init() {
        console.log("Auth module initialized.");
        // Aquí se conectará con Firebase Auth más adelante
    },
    
    canAccess(moduleName) {
        // Por ahora devuelve true, se implementarán roles reales luego
        return true;
    }
};

export default Auth;
