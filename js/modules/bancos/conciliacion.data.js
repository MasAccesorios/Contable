import DB from '../../core/db.js';
import { supabase } from '../../core/supabase.js';

export const ConciliacionData = {
    async loadHistorial(bancoId = null) {
        const rawId = (bancoId !== null && bancoId !== undefined) ? bancoId : this.state.bancoId;
        const targetBancoId = (rawId !== null && rawId !== undefined && rawId !== '') ? parseInt(rawId, 10) : null;
        DB.invalidateCache('conciliaciones');
        try {
            let query = supabase
                .from('conciliaciones')
                .select('*')
                .order('fecha_guardado', { ascending: false });

            if (targetBancoId !== null && !isNaN(targetBancoId)) {
                query = query.eq('banco_id', targetBancoId);
            }

            const { data, error } = await query;
            if (error) throw error;
            this.state.historialConciliaciones = data || [];
        } catch (err) {
            console.error('[Conciliacion] Error cargando historial:', err);
            const all = await DB.getAll('conciliaciones') || [];
            this.state.historialConciliaciones = (targetBancoId !== null && !isNaN(targetBancoId))
                ? all.filter(c => parseInt(c.banco_id, 10) === targetBancoId)
                : all;
        }
        return this.state.historialConciliaciones;
    },

    async loadData() {
        const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
        this.state.cuentas = dbCuentas.filter(c => c.estado === 'active' || c.estado === 'activo');
        if (!this.state.bancoId && this.state.cuentas.length > 0) {
            this.state.bancoId = parseInt(this.state.cuentas[0].id, 10);
        }
        // transacciones ya NO se cargan en masa — se obtienen vía RPC por cuenta/rango
        await this.loadHistorial(this.state.bancoId);
    },

    async cargarDatosRPC() {
        if (!this.state.bancoId) return;
        const targetCuentaId = parseInt(this.state.bancoId, 10);
        if (isNaN(targetCuentaId)) return;

        const editId = this.state.editingConciliacionId ? parseInt(this.state.editingConciliacionId, 10) : null;
        const { data, error } = await supabase.rpc('get_conciliacion_bancaria', {
            p_cuenta_id:       targetCuentaId,
            p_fecha_desde:     this.state.fechaDesde,
            p_fecha_hasta:     this.state.fechaHasta,
            p_conciliacion_id: (editId && !isNaN(editId)) ? editId : null
        });
        if (error) {
            console.error('[Conciliacion] RPC error:', error);
            return;
        }
        this.state.saldoAnterior    = Number(data.saldo_anterior) || 0;
        this.state.entradas         = Number(data.entradas)       || 0;
        this.state.salidas          = Number(data.salidas)        || 0;
        this.state.movimientosRango = data.movimientos            || [];
    }
};
