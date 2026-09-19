import DB from '../../core/db.js';
import { supabase } from '../../core/supabase.js';

export const ConciliacionEvents = {
    attachEvents() {
        // Rastrear selección en state
        if (!this.state._seleccionados) {
            this.state._seleccionados = new Set();
        }

        // Select-all: actualiza DOM y state
        this.element.querySelector('#chk-select-all')?.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const checks = this.element.querySelectorAll('.concil-check');
            this.state._seleccionados = new Set();
            checks.forEach(cb => {
                cb.checked = isChecked;
                if (isChecked) {
                    const id = parseInt(cb.dataset.id, 10);
                    if (!isNaN(id)) this.state._seleccionados.add(id);
                }
            });
            this.recalcularDiferenciaPendiente();
        });

        // Checkbox individual: event delegation en tbody
        this.element.querySelector('#tbody-conciliacion')?.addEventListener('change', (e) => {
            if (!e.target.classList.contains('concil-check')) return;
            const id = parseInt(e.target.dataset.id, 10);
            if (isNaN(id)) return;
            if (e.target.checked) this.state._seleccionados.add(id);
            else this.state._seleccionados.delete(id);
            this.recalcularDiferenciaPendiente();
        });

        const _resetearInputs = () => { 
            this.state._seleccionados = new Set(); 
            this.state.editingConciliacionId = null;
            this.state.saldoBancario = 0;
            this.state.ajusteGastos = 0;
            this.state.ajusteImpuestos = 0;
            this.state.ajusteEntradas = 0;
            
            const saldoInput = this.element.querySelector('#concil-input-saldo');
            const e1 = this.element.querySelector('#concil-ajuste-gastos');
            const e2 = this.element.querySelector('#concil-ajuste-impuestos');
            const e3 = this.element.querySelector('#concil-ajuste-entradas');
            if (saldoInput) saldoInput.value = '0';
            if (e1) e1.value = '0';
            if (e2) e2.value = '0';
            if (e3) e3.value = '0';
        };

        this.element.querySelector('#nueva-tab')?.addEventListener('click', (e) => {
            // Solo actuar si el usuario hizo clic real (no si se invocó via JS desde "Editar")
            if (e.isTrusted) {
                _resetearInputs();
                this.recalcularDiferenciaPendiente();
                this.renderTabla();
            }
        });

        this.element.querySelector('#historial-tab')?.addEventListener('click', async () => {
            await this.loadHistorial(this.state.bancoId);
            this.renderHistorial();
        });

        this.element.querySelector('#concil-cuenta').addEventListener('change', async (e) => {
            _resetearInputs();
            this.state.bancoId = e.target.value ? parseInt(e.target.value, 10) : null;
            await Promise.all([
                this.cargarDatosRPC(),
                this.loadHistorial(this.state.bancoId)
            ]);
            this.calcularTotales();
            this.recalcularDiferenciaPendiente();
            this.renderTabla();
            this.renderHistorial();
        });

        this.element.querySelector('#concil-desde').addEventListener('change', async (e) => {
            _resetearInputs();
            this.state.fechaDesde = e.target.value;
            await this.cargarDatosRPC();
            this.calcularTotales();
            this.recalcularDiferenciaPendiente();
            this.renderTabla();
        });

        this.element.querySelector('#concil-hasta').addEventListener('change', async (e) => {
            _resetearInputs();
            this.state.fechaHasta = e.target.value;
            await this.cargarDatosRPC();
            this.calcularTotales();
            this.recalcularDiferenciaPendiente();
            this.renderTabla();
        });

        const saldoInput = this.element.querySelector('#concil-input-saldo');
        const inputGastos = this.element.querySelector('#concil-ajuste-gastos');
        const inputImp = this.element.querySelector('#concil-ajuste-impuestos');
        const inputEnt = this.element.querySelector('#concil-ajuste-entradas');

        import('../../shared/formatters.js').then(fmt => {
            if (saldoInput) {
                fmt.applyCurrencyFormatting(saldoInput);
                saldoInput.addEventListener('input', (e) => {
                    this.state.saldoBancario = fmt.parseCurrencyValue(e.target.value) || 0;
                    this.recalcularDiferenciaPendiente();
                });
            }
            if (inputGastos) {
                fmt.applyCurrencyFormatting(inputGastos);
                inputGastos.addEventListener('input', (e) => {
                    this.state.ajusteGastos = fmt.parseCurrencyValue(e.target.value) || 0;
                    this.recalcularDiferenciaPendiente();
                });
            }
            if (inputImp) {
                fmt.applyCurrencyFormatting(inputImp);
                inputImp.addEventListener('input', (e) => {
                    this.state.ajusteImpuestos = fmt.parseCurrencyValue(e.target.value) || 0;
                    this.recalcularDiferenciaPendiente();
                });
            }
            if (inputEnt) {
                fmt.applyCurrencyFormatting(inputEnt);
                inputEnt.addEventListener('input', (e) => {
                    this.state.ajusteEntradas = fmt.parseCurrencyValue(e.target.value) || 0;
                    this.recalcularDiferenciaPendiente();
                });
            }
        });

        this.element.querySelector('#btn-guardar-concil').addEventListener('click', async () => {
            if (Math.abs(this.state.diferenciaActual) >= 1) {
                const continuar = confirm(`Vas a guardar esta conciliación con una diferencia de ${this.formatMoney(this.state.diferenciaActual)} sin resolver. ¿Deseas continuar de todas formas?`);
                if (!continuar) return;
            }

            const movimientosConciliados = Array.from(this.state._seleccionados);
            
            // Crear ajustes si hay
            const ajustes = [
                { valor: this.state.ajusteGastos, tipo: 'egreso', categoria: 'Gastos bancarios' },
                { valor: this.state.ajusteImpuestos, tipo: 'egreso', categoria: 'Impuestos bancarios' },
                { valor: this.state.ajusteEntradas, tipo: 'ingreso', categoria: 'Entradas bancarias' }
            ];
            
            for (const adj of ajustes) {
                if (adj.valor > 0) {
                    const payloadAdj = {
                        tipo: adj.tipo,
                        fecha: new Date().toISOString(),
                        monto: adj.valor,
                        cuenta_id: parseInt(this.state.bancoId, 10),
                        categoria: adj.categoria,
                        observaciones: 'Ajuste automático de conciliación',
                        estado: 'open'
                    };
                    try {
                        const res = await DB.save('transacciones', payloadAdj);
                        if (res && res.id) movimientosConciliados.push(res.id);
                        else if (res && res[0] && res[0].id) movimientosConciliados.push(res[0].id);
                    } catch (err) {
                        console.error('Error guardando ajuste', adj.categoria, err);
                    }
                }
            }

            const editId = this.state.editingConciliacionId ? parseInt(this.state.editingConciliacionId, 10) : null;
            const payload = {
                p_id: (editId !== null && !isNaN(editId) && editId > 0) ? editId : null,
                p_banco_id: parseInt(this.state.bancoId, 10),
                p_fecha_desde: this.state.fechaDesde,
                p_fecha_hasta: this.state.fechaHasta,
                p_saldo_bancario: Number(this.state.saldoBancario) || 0,
                p_saldo_sistema: Number(this.state.saldoAnterior + this.state.entradas - this.state.salidas) || 0,
                p_diferencia: Number(this.state.saldoBancario - (this.state.saldoAnterior + this.state.entradas - this.state.salidas)) || 0,
                p_movimientos_conciliados: movimientosConciliados.map(mid => parseInt(mid, 10)).filter(mid => !isNaN(mid))
            };

            try {
                const { error } = await supabase.rpc('guardar_conciliacion_bancaria', payload);
                if (error) throw error;
                
                this.state.editingConciliacionId = null;
                alert('Conciliación guardada exitosamente.');
                
                _resetearInputs();
                await this.loadHistorial(this.state.bancoId);
                this.renderHistorial();
                await this.cargarDatosRPC();
                this.calcularTotales();
                this.recalcularDiferenciaPendiente();
                this.renderTabla();

                // Cambiar automáticamente a la pestaña Historial para mostrar el registro actualizado
                const tabHistorial = this.element.querySelector('#historial-tab');
                if (tabHistorial && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
                    const tab = bootstrap.Tab.getInstance(tabHistorial) || new bootstrap.Tab(tabHistorial);
                    tab.show();
                }
            } catch (error) {
                console.error("[Conciliacion] Error al guardar:", error);
                alert('Hubo un error al guardar la conciliación: ' + (error?.message || JSON.stringify(error)));
            }
        });

        // Eventos para la tabla de historial (Ver, Editar, Eliminar)
        this.element.querySelector('#tbody-historial')?.addEventListener('click', async (e) => {
            const rowVer = e.target.closest('.row-historial-concil');
            const btnEditar = e.target.closest('.btn-editar-concil');
            const btnEliminar = e.target.closest('.btn-eliminar-concil');

            if (rowVer && !e.target.closest('button')) {
                const id = rowVer.getAttribute('data-id');
                window.location.hash = `#/bancos/conciliacion/detalle/${id}`;
            }

            if (btnEditar) {
                const id = btnEditar.getAttribute('data-id');
                const targetId = parseInt(id, 10);
                const concil = this.state.historialConciliaciones.find(c => parseInt(c.id, 10) === targetId);
                if (!concil) return;

                this.state.editingConciliacionId = targetId;
                this.state._seleccionados = new Set(
                    (concil.movimientos_conciliados || []).map(mid => parseInt(mid, 10)).filter(mid => !isNaN(mid))
                );

                // Llenar inputs
                const inputCuenta = document.getElementById('concil-cuenta');
                const inputDesde = document.getElementById('concil-desde');
                const inputHasta = document.getElementById('concil-hasta');
                const inputSaldo = document.getElementById('concil-input-saldo');
                
                if (inputCuenta && concil.banco_id) {
                    const bId = parseInt(concil.banco_id, 10);
                    inputCuenta.value = bId;
                    this.state.bancoId = bId;
                }
                if (inputDesde) inputDesde.value = concil.fecha_desde;
                if (inputHasta) inputHasta.value = concil.fecha_hasta;
                if (inputSaldo) {
                    inputSaldo.value = concil.saldo_bancario;
                    import('../../shared/formatters.js').then(fmt => fmt.applyCurrencyFormatting(inputSaldo));
                }
                
                this.state.fechaDesde = concil.fecha_desde;
                this.state.fechaHasta = concil.fecha_hasta;
                this.state.saldoBancario = Number(concil.saldo_bancario) || 0;

                await this.cargarDatosRPC();
                this.calcularTotales();
                this.recalcularDiferenciaPendiente();
                this.renderTabla();

                // Cambiar a la pestaña Nueva Conciliacion
                const tabBtn = document.getElementById('nueva-tab');
                if (tabBtn && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
                    const tab = bootstrap.Tab.getInstance(tabBtn) || new bootstrap.Tab(tabBtn);
                    tab.show();
                }
            }

            if (btnEliminar) {
                const id = btnEliminar.getAttribute('data-id');
                const targetId = parseInt(id, 10);
                if (isNaN(targetId)) return;
                if (confirm("¿Seguro que deseas eliminar el registro de esta conciliación?\n(Los movimientos bancarios asociados volverán a quedar pendientes)")) {
                    try {
                        const { error: rpcError } = await supabase.rpc('eliminar_conciliacion_bancaria', { p_id: targetId });
                        if (rpcError) {
                            console.warn('[Conciliacion] RPC eliminar no disponible, ejecutando fallback directo:', rpcError);
                            await supabase.from('pagos_ingresos').update({ conciliado_en: null, conciliacion_id: null }).eq('conciliacion_id', targetId);
                            const { error: delError } = await supabase.from('conciliaciones').delete().eq('id', targetId);
                            if (delError) throw delError;
                        }
                        DB.invalidateCache('conciliaciones');
                        await this.loadHistorial(this.state.bancoId);
                        this.renderHistorial();
                    } catch (error) {
                        console.error('[Conciliacion] Error al eliminar:', error);
                        alert("Error al eliminar la conciliación: " + (error?.message || JSON.stringify(error)));
                    }
                }
            }
        });
    }
};
