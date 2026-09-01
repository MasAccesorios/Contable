import DB from '../../core/db.js';
import { supabase } from '../../core/supabase.js';

export const TesoreriaData = {
    async loadData() {
        const { data: dataGrafica, error: errGrafica } = await supabase.rpc('get_ingresos_egresos_por_mes', { meses: 6 });
        if (errGrafica) console.error('Error cargando gráfica:', errGrafica);
        this.state.datosGrafica = dataGrafica || [];
        
        const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
        this.state.todasLasCuentas = dbCuentas;
        this.state.cuentasActivas = dbCuentas.filter(c => c.estado === 'active' || c.estado === 'activo');
        
        // Limpiar el diccionario de saldos
        this.state.saldos = {};
        this.state.totalConsolidado = 0;

        // Calcular saldos (sólo para las cuentas activas)
        this.state.cuentasActivas.forEach(c => {
            this.state.saldos[c.id] = 0;
            // Fallback para legacy UI requests
            this.state.saldos[c.nombre] = 0;
        });

        const { data: saldos, error } = await supabase.rpc('get_saldos_por_cuenta');
        if (error) { console.error('Error cargando saldos:', error); }
        
        if (saldos) {
            saldos.forEach(s => {
                // Asignar directamente el saldo de la BD, ignorando saldo_inicial obsoleto
                this.state.saldos[s.cuenta_id] = Number(s.saldo);
            });
        }

        // Sumar todos los saldos consolidados
        this.state.cuentasActivas.forEach(c => {
            this.state.totalConsolidado += (this.state.saldos[c.id] || 0);
        });

        // Renderizar vistas
        this.renderResumen();
        this.renderTabla();
        
        // Cargar script de Chart.js si no existe y dibujar gráfico
        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = () => this.renderChart();
            document.head.appendChild(script);
        } else {
            this.renderChart();
        }
    },

    async ejecutarTransferencia(origenId, destinoId, monto, fecha, nota) {
        if (!origenId || !destinoId || !monto || monto <= 0 || !fecha) {
            alert('Por favor completa todos los campos correctamente.');
            return false;
        }
        
        if (origenId === destinoId) {
            alert('La cuenta de origen y destino no pueden ser la misma.');
            return false;
        }

        const origenIdInt  = parseInt(origenId, 10);
        const destinoIdInt = parseInt(destinoId, 10);

        // Buscar nombres de cuenta para la nota descriptiva
        const cuentaOrigen  = (this.state.todasLasCuentas || []).find(c => String(c.id) === String(origenId));
        const cuentaDestino = (this.state.todasLasCuentas || []).find(c => String(c.id) === String(destinoId));
        const nombreOrigen  = cuentaOrigen?.nombre  || String(origenId);
        const nombreDestino = cuentaDestino?.nombre || String(destinoId);

        // 1. Egreso en la cuenta Origen (tipo='out', columnas reales de pagos_ingresos)
        const egreso = {
            tipo:          'out',
            monto:         Number(monto),
            fecha:         fecha,
            cuenta_id:     origenIdInt,
            factura_id:    null,
            categoria:     'Transferencia',
            observaciones: `Transferencia a ${nombreDestino}${nota ? ' — ' + nota : ''}`,
            estado:        'open'
        };

        // 2. Ingreso en la cuenta Destino (tipo='in')
        const ingreso = {
            tipo:          'in',
            monto:         Number(monto),
            fecha:         fecha,
            cuenta_id:     destinoIdInt,
            factura_id:    null,
            categoria:     'Transferencia',
            observaciones: `Transferencia desde ${nombreOrigen}${nota ? ' — ' + nota : ''}`,
            estado:        'open'
        };

        // 3. Guardar ambos — DB.save('transacciones') mapea internamente a pagos_ingresos
        try {
            await DB.save('transacciones', egreso);
            await DB.save('transacciones', ingreso);
            return true;
        } catch (err) {
            console.error('Error al guardar transferencia:', err);
            alert('Error al guardar la transferencia: ' + (err?.message || JSON.stringify(err)));
            return false;
        }
    },

    async toggleEstadoCuenta(id, estadoActual) {
        if (!id) return;
        const nuevoEstado = estadoActual === 'inactivo' ? 'activo' : 'inactivo';
        const accionStr = nuevoEstado === 'inactivo' ? 'desactivar' : 'activar';
        
        if (window.CoreActions && window.CoreActions.showConfirmModal) {
            window.CoreActions.showConfirmModal(
                `¿Seguro que deseas ${accionStr} esta cuenta?`,
                async () => {
                    await this.actualizarEstadoDB(id, nuevoEstado);
                }
            );
        } else {
            if (confirm(`¿Seguro que deseas ${accionStr} esta cuenta?`)) {
                await this.actualizarEstadoDB(id, nuevoEstado);
            }
        }
    },

    async actualizarEstadoDB(id, nuevoEstado) {
        try {
            const cuenta = await DB.get('cuentas_bancarias', id);
            if (cuenta) {
                cuenta.estado = nuevoEstado;
                await DB.save('cuentas_bancarias', cuenta);
                // Usar nuestro nuevo botón de actualizar para refrescar visualmente
                const btnRefresh = this.element.querySelector('#btn-actualizar-bancos');
                if (btnRefresh) {
                    btnRefresh.click();
                } else {
                    await this.loadData();
                }
            }
        } catch (err) {
            console.error('Error al actualizar estado:', err);
            alert('Error al actualizar el estado de la cuenta.');
        }
    }
};
