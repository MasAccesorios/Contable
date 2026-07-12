/* =====================================================
   MAS Accesorios - Auth Module
   ===================================================== */

const Auth = {
    currentUser: null,

    init() {
        const userData = localStorage.getItem(DB.KEYS.CURRENT_USER);
        if (userData) {
            this.currentUser = JSON.parse(userData);
            return true;
        }
        return false;
    },

    login(email, password) {
        const user = DB.authenticate(email, password);
        if (user) {
            this.currentUser = user;
            localStorage.setItem(DB.KEYS.CURRENT_USER, JSON.stringify(user));
            return true;
        }
        return false;
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem(DB.KEYS.CURRENT_USER);
    },

    isAdmin() {
        return this.currentUser && this.currentUser.rol === 'admin';
    },

    getUserName() {
        return this.currentUser ? this.currentUser.nombre : 'Usuario';
    },

    getUserRole() {
        return this.currentUser ? (this.currentUser.rol === 'admin' ? 'Administrador' : 'Vendedor') : '';
    },

    // RBAC Permissions List
    canAccess(page) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;

        // Vendedor allowed pages
        const allowedPages = [
            'dashboard',
            'clientes',
            'productos', // solo lectura
            'ventas',
            'cotizaciones'
        ];
        return allowedPages.includes(page);
    },

    canPerform(action) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;

        // Vendedor allowed actions
        const allowedActions = [
            'create_cliente',
            'edit_cliente',
            'create_venta',
            'create_cotizacion'
        ];
        return allowedActions.includes(action);
    }
};
