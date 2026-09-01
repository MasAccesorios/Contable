import { supabase } from '../../../core/supabase.js';
import { CoreActions } from '../../../shared/crud.js';

export const PagosRealizadosData = {
    async calcularKPIs() {
        try {
            const { data, error } = await supabase.rpc('get_pagos_kpis', { p_tipo: 'out' });
            if (!error && data) {
                this.state.kpis = { total: parseFloat(data.total) || 0 };
            }
        } catch (e) {
            console.error('Error calculando KPIs:', e);
        }
    },

    async _cargarComprobanteAgrupado(id) {
        const { data: t } = await supabase.from('pagos_ingresos').select('*, contactos(*), cuentas_bancarias(*), facturas(*, contactos(*))').eq('id', id).single();
        if (!t) return null;
        if (t.grupo_pago_id) {
            const { data: grupo } = await supabase.from('pagos_ingresos').select('*, contactos(*), facturas(*, contactos(*))').eq('grupo_pago_id', t.grupo_pago_id);
            if (grupo && grupo.length > 1) {
                t.itemsGrupo = grupo;
                t.monto = grupo.reduce((sum, p) => sum + Number(p.monto), 0);
            }
        }
        return t;
    },

    async cargarPagos() {
        this.state.isLoading = true;
        this.renderGrid();

        try {
            const { data, error } = await supabase.rpc('get_pagos_lista', {
                p_tipo: 'out',
                p_page: this.state.currentPage,
                p_limit: this.state.itemsPerPage,
                p_search: this.state.searchQuery
            });

            if (error) throw error;

            this.state.pagos = data || [];
            this.state.totalItems = this.state.pagos.length > 0 ? Number(this.state.pagos[0].total_count) : 0;
        } catch (error) {
            console.error('Error cargando pagos realizados:', error);
            CoreActions.showWarningModal('Error al cargar la lista de pagos: ' + (error.message || error));
        } finally {
            this.state.isLoading = false;
            this.renderGrid();
        }
    }
};
