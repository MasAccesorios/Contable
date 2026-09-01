import { supabase } from '../../core/supabase.js';

export const ContactosData = {
    async fetchKpis() {
        try {
            const { data } = await supabase
                .from('contactos')
                .select('es_cliente, es_proveedor, estado');
            
            // Filtramos inactivos igual que el RPC
            const activos = data?.filter(c => c.estado !== 'inactive') || [];
            
            const total      = activos.length;
            const clientes   = activos.filter(c => c.es_cliente).length;
            const proveedores = activos.filter(c => c.es_proveedor).length;
            
            return { total, clientes, proveedores };
        } catch { return { total: 0, clientes: 0, proveedores: 0 }; }
    },

    async cargarPagina() {
        const { currentPage, itemsPerPage, currentFilter, searchQuery } = this.state;
        
        try {
            const [rpcResponse, kpis] = await Promise.all([
                supabase.rpc('get_contactos_page', {
                    p_page: currentPage,
                    p_limit: itemsPerPage,
                    p_sort_column: 'nombre',
                    p_sort_direction: 'asc',
                    p_search_query: searchQuery,
                    p_filter_criteria: currentFilter
                }),
                this.fetchKpis()
            ]);

            if (rpcResponse.error) throw rpcResponse.error;

            const { data, total_count } = rpcResponse.data;
            this.state.totalCount = total_count || 0;
            this.renderGrid(data || [], this.state.totalCount);
            this.renderKpis(kpis);
        } catch (err) {
            console.error('Error cargando contactos:', err);
            this.renderGrid([], 0);
        }
    },
};
