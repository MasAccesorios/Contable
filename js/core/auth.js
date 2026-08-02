// js/core/auth.js
// Manejo de sesión y roles (Supabase Auth)

export const Auth = {
    user: null,
    
    init() {
        // Sesión gestionada por supabase.auth.onAuthStateChange en app.js
    },
    
    canAccess(moduleName) {
        // Por ahora devuelve true, se implementarán roles reales luego
        return true;
    }
};

export default Auth;
