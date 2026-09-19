import DB from '../../core/db.js';
import { supabase } from '../../core/supabase.js';

export const ConciliacionData = {
    async loadHistorial(bancoId = null) {
        const targetBancoId = bancoId || this.state.bancoId;
        DB.invalidateCache('conciliaciones');
        try {
            let query = supabase
                .from('conciliaciones')
                .select('*')
                .order('fecha_guardado', { ascending: false });

            if (targetBancoId) {
                query = query.eq('banco_id', parseInt(targetBancoId, 10));
            }

            const { data, error } = await query;
            if (error) throw error;
            this.state.historialConciliaciones = data || [];
        } catch (err) {
            console.error('[Conciliacion] Error cargando historial:', err);
            const all = await DB.getAll('conciliaciones') || [];
            this.state.historialConciliaciones = targetBancoId
                ? all.filter(c => String(c.banco_id) === String(targetBancoId))
                : all;
        }
        return this.state.historialConciliaciones;
    },

    async loadData() {
        const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
        this.state.cuentas = dbCuentas.filter(c => c.estado === 'active' || c.estado === 'activo');
        if (!this.state.bancoId && this.state.cuentas.length > 0) {
            this.state.bancoId = this.state.cuentas[0].id;
        }
        // transacciones ya NO se cargan en masa — se obtienen vía RPC por cuenta/rango
        await this.loadHistorial(this.state.bancoId);
    },

    async cargarDatosRPC() {
        if (!this.state.bancoId) return;
        const { data, error } = await supabase.rpc('get_conciliacion_bancaria', {
            p_cuenta_id:   parseInt(this.state.bancoId, 10),
            p_fecha_desde: this.state.fechaDesde,
            p_fecha_hasta: this.state.fechaHasta,
            p_conciliacion_id: this.state.editingConciliacionId || null
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
