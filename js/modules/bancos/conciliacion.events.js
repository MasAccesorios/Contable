// js/modules/bancos/conciliacion.events.js
// Manejo de Eventos, Interacciones Ergonómicas y Cuadre Reactivo de Conciliación Bancaria 360°

export const ConciliacionEvents = {
    attachEvents() {
        const el = this.element;
        if (!el) return;

        if (!this.state._seleccionados) {
            this.state._seleccionados = new Set();
        }

        // 1. Alternancia de Pestañas Principales (payment-tabs-bar)
        const tabNueva = el.querySelector('#tab-nav-nueva');
        const tabHistorial = el.querySelector('#tab-nav-historial');
        const viewActiva = el.querySelector('#view-concil-activa');
        const viewHistorial = el.querySelector('#view-concil-historial');

        const activarTab = async (tabName) => {
            this.state.currentTab = tabName;
            if (tabName === 'nueva') {
                if (tabNueva) tabNueva.classList.add('active');
                if (tabHistorial) tabHistorial.classList.remove('active');
                if (viewActiva) viewActiva.style.display = 'block';
                if (viewHistorial) viewHistorial.style.display = 'none';
            } else {
                if (tabHistorial) tabHistorial.classList.add('active');
                if (tabNueva) tabNueva.classList.remove('active');
                if (viewActiva) viewActiva.style.display = 'none';
                if (viewHistorial) viewHistorial.style.display = 'block';
                await this.loadHistorial(this.state.bancoId);
                this.renderHistorial();
            }
        };

        if (tabNueva) tabNueva.addEventListener('click', () => activarTab('nueva'));
        if (tabHistorial) tabHistorial.addEventListener('click', () => activarTab('historial'));

        // 2. Acordeón de Ajustes Directos de Extracto
        const headerAjustes = el.querySelector('#header-panel-ajustes');
        const btnToggleAjustes = el.querySelector('#btn-toggle-ajustes');
        const bodyAjustes = el.querySelector('#body-panel-ajustes');
        const iconToggle = el.querySelector('#icon-toggle-ajustes');

        const toggleAjustes = () => {
            if (!bodyAjustes) return;
            const isHidden = bodyAjustes.style.display === 'none';
            bodyAjustes.style.display = isHidden ? 'block' : 'none';
            if (iconToggle) {
                iconToggle.className = isHidden ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
            }
        };

        if (headerAjustes) headerAjustes.addEventListener('click', (e) => {
            if (e.target.closest('input')) return;
            toggleAjustes();
        });
        if (btnToggleAjustes) btnToggleAjustes.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAjustes();
        });

        // 3. Botón Refrescar Datos
        el.querySelector('#btn-refresh-concil')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const icon = btn.querySelector('i');
            if (icon) icon.className = 'spinner-border spinner-border-sm';
            btn.disabled = true;

            await Promise.all([
                this.cargarDatosRPC(),
                this.loadHistorial(this.state.bancoId)
            ]);
            this.calcularTotales();
            this.recalcularDiferenciaPendiente();
            this.renderTabla();
            this.renderHistorial();

            if (icon) icon.className = 'bi bi-arrow-clockwise';
            btn.disabled = false;
        });

        // 4. Select-All Checkbox en Tabla de Movimientos
        el.querySelector('#chk-select-all')?.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const checks = el.querySelectorAll('.concil-check');
            
            checks.forEach(cb => {
                cb.checked = isChecked;
                const id = parseInt(cb.dataset.id, 10);
                if (!isNaN(id)) {
                    if (isChecked) this.state._seleccionados.add(id);
                    else this.state._seleccionados.delete(id);
                }
                const row = cb.closest('.fila-movimiento-concil');
                if (row) {
                    if (isChecked) row.style.setProperty('background-color', '#f0fdf4', 'important');
                    else row.style.removeProperty('background-color');
                }
            });
            this.recalcularDiferenciaPendiente();
        });

        // 5. Checkbox individual y clic en fila de movimiento
        el.querySelector('#tbody-conciliacion')?.addEventListener('click', (e) => {
            const row = e.target.closest('.fila-movimiento-concil');
            if (!row) return;

            const cb = row.querySelector('.concil-check');
            if (!cb) return;

            // Si se hizo clic directo en el checkbox, dejamos que el evento change nativo actúe
            if (e.target === cb) return;

            cb.checked = !cb.checked;
            const id = parseInt(cb.dataset.id, 10);
            if (!isNaN(id)) {
                if (cb.checked) {
                    this.state._seleccionados.add(id);
                    row.style.setProperty('background-color', '#f0fdf4', 'important');
                } else {
                    this.state._seleccionados.delete(id);
                    row.style.removeProperty('background-color');
                }
            }
            this.recalcularDiferenciaPendiente();
        });

        el.querySelector('#tbody-conciliacion')?.addEventListener('change', (e) => {
            if (!e.target.classList.contains('concil-check')) return;
            const cb = e.target;
            const id = parseInt(cb.dataset.id, 10);
            const row = cb.closest('.fila-movimiento-concil');

            if (!isNaN(id)) {
                if (cb.checked) {
                    this.state._seleccionados.add(id);
                    if (row) row.style.setProperty('background-color', '#f0fdf4', 'important');
                } else {
                    this.state._seleccionados.delete(id);
                    if (row) row.style.removeProperty('background-color');
                }
            }
            this.recalcularDiferenciaPendiente();
        });

        // 6. Botones de Selección Rápida en Filtro
        el.querySelector('#btn-marcar-todos-filtro')?.addEventListener('click', () => {
            const checks = el.querySelectorAll('.concil-check');
            checks.forEach(cb => {
                cb.checked = true;
                const id = parseInt(cb.dataset.id, 10);
                if (!isNaN(id)) this.state._seleccionados.add(id);
                const row = cb.closest('.fila-movimiento-concil');
                if (row) row.style.setProperty('background-color', '#f0fdf4', 'important');
            });
            this.recalcularDiferenciaPendiente();
        });

        el.querySelector('#btn-desmarcar-todos')?.addEventListener('click', () => {
            const checks = el.querySelectorAll('.concil-check');
            checks.forEach(cb => {
                cb.checked = false;
                const row = cb.closest('.fila-movimiento-concil');
                if (row) row.style.removeProperty('background-color');
            });
            this.state._seleccionados.clear();
            const chkAll = el.querySelector('#chk-select-all');
            if (chkAll) chkAll.checked = false;
            this.recalcularDiferenciaPendiente();
        });

        // 7. Filtros por Tipo de Movimiento (.btn-filtro-movs)
        el.querySelectorAll('.btn-filtro-movs').forEach(btn => {
            btn.addEventListener('click', () => {
                el.querySelectorAll('.btn-filtro-movs').forEach(b => {
                    b.classList.remove('active', 'btn-white', 'bg-white', 'shadow-xs', 'fw-bold');
                    b.classList.add('btn-light', 'border-0', 'text-muted');
                });
                btn.classList.add('active', 'btn-white', 'bg-white', 'shadow-xs', 'fw-bold');
                btn.classList.remove('btn-light', 'border-0', 'text-muted');

                this.state.filterTipoMovs = btn.dataset.filter || 'todos';
                this.renderTabla();
            });
        });

        // 8. Buscador en Vivo de Movimientos
        const inputSearchMovs = el.querySelector('#search-movimientos-concil');
        let searchTimeout;
        if (inputSearchMovs) {
            inputSearchMovs.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.state.searchMovsQuery = e.target.value;
                    this.renderTabla();
                }, 250);
            });
        }

        // 9. Selector Global de Cuenta
        el.querySelector('#concil-cuenta')?.addEventListener('change', async (e) => {
            this.state._seleccionados = new Set();
            this.state.editingConciliacionId = null;
            this.state.bancoId = e.target.value ? parseInt(e.target.value, 10) : null;

            await Promise.all([
                this.cargarDatosRPC(),
                this.loadHistorial(this.state.bancoId)
            ]);

            this.renderBase();
            this.attachEvents();
            this.calcularTotales();
            this.recalcularDiferenciaPendiente();
            this.renderTabla();
            this.renderHistorial();
        });

        // 10. Rango de Fechas
        el.querySelector('#concil-desde')?.addEventListener('change', async (e) => {
            this.state._seleccionados = new Set();
            let val = e.target.value;
            if (val && val < '2026-08-01') {
                val = '2026-08-01';
                e.target.value = val;
            }
            this.state.fechaDesde = val;
            await this.cargarDatosRPC();
            this.calcularTotales();
            this.recalcularDiferenciaPendiente();
            this.renderTabla();
        });

        el.querySelector('#concil-hasta')?.addEventListener('change', async (e) => {
            this.state._seleccionados = new Set();
            this.state.fechaHasta = e.target.value;
            await this.cargarDatosRPC();
            this.calcularTotales();
            this.recalcularDiferenciaPendiente();
            this.renderTabla();
        });

        // 11. Formateo y Entradas Numéricas Reactivas
        const saldoInput = el.querySelector('#concil-input-saldo');
        const inputGastos = el.querySelector('#concil-ajuste-gastos');
        const inputImp = el.querySelector('#concil-ajuste-impuestos');
        const inputEnt = el.querySelector('#concil-ajuste-entradas');

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

        // 12. Botón Guardar Conciliación con Transaccionalidad Segura
        el.querySelector('#btn-guardar-concil')?.addEventListener('click', async () => {
            if (this._isSaving) return;
            this._isSaving = true;

            const btn = el.querySelector('#btn-guardar-concil');
            try {
                if (!this.state.bancoId || isNaN(parseInt(this.state.bancoId, 10))) {
                    alert('Debes seleccionar una cuenta bancaria válida.');
                    return;
                }
                if (!this.state.fechaDesde || !this.state.fechaHasta) {
                    alert('Debes definir las fechas del periodo a conciliar.');
                    return;
                }

                const absDif = Math.abs(Number(this.state.diferenciaActual) || 0);
                if (absDif >= 1) {
                    const continuar = confirm(`Vas a guardar esta conciliación con una diferencia de ${this.formatMoney(this.state.diferenciaActual)} sin resolver. ¿Deseas continuar de todas formas?`);
                    if (!continuar) return;
                }

                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
                }

                const DB = await this.getDB();
                const supabaseClient = await this.getSupabase();
                const movimientosConciliados = Array.from(this.state._seleccionados || []);

                const ajustesCreados = [];
                const rollbackAjustes = async () => {
                    if (ajustesCreados.length > 0 && supabaseClient) {
                        try {
                            await supabaseClient.from('pagos_ingresos').delete().in('id', ajustesCreados);
                        } catch (e) {
                            console.error('[Conciliacion] Error en rollback de ajustes:', e);
                        }
                    }
                    if (DB && typeof DB.invalidateCache === 'function') {
                        DB.invalidateCache('transacciones');
                        DB.invalidateCache('pagos_ingresos');
                    }
                };

                // Crear ajustes automáticos si fueron especificados
                const ajustes = [
                    { valor: this.state.ajusteGastos, tipo: 'egreso', categoria: 'Gastos bancarios' },
                    { valor: this.state.ajusteImpuestos, tipo: 'egreso', categoria: 'Impuestos bancarios' },
                    { valor: this.state.ajusteEntradas, tipo: 'ingreso', categoria: 'Entradas bancarias' }
                ];

                for (const adj of ajustes) {
                    if (adj.valor > 0) {
                        const payloadAdj = {
                            tipo: adj.tipo,
                            fecha: this.state.fechaHasta,
                            monto: adj.valor,
                            cuenta_id: parseInt(this.state.bancoId, 10),
                            categoria: adj.categoria,
                            observaciones: 'Ajuste automático de conciliación',
                            estado: 'open'
                        };
                        try {
                            const res = await DB.save('transacciones', payloadAdj);
                            const resId = (res && res.id) || (res && res[0] && res[0].id);
                            if (resId) {
                                movimientosConciliados.push(resId);
                                ajustesCreados.push(resId);
                            } else {
                                await rollbackAjustes();
                                alert('No se pudo guardar el ajuste "' + adj.categoria + '". La conciliación NO se guardó.');
                                return;
                            }
                        } catch (err) {
                            await rollbackAjustes();
                            alert('No se pudo guardar el ajuste "' + adj.categoria + '": ' + (err?.message || err));
                            return;
                        }
                    }
                }

                this.recalcularDiferenciaPendiente();
                const difFinal = Math.abs(this.state.diferenciaActual) < 1 ? 0 : Number(this.state.diferenciaActual);
                const saldoBanco = Number(this.state.saldoBancario) || 0;
                const editId = this.state.editingConciliacionId ? parseInt(this.state.editingConciliacionId, 10) : null;

                const payload = this.prepararPayloadGuardado({
                    editingId: editId,
                    bancoId: this.state.bancoId,
                    fechaDesde: this.state.fechaDesde,
                    fechaHasta: this.state.fechaHasta,
                    saldoBancario: saldoBanco,
                    saldoSistema: Number(this.state.saldoTotalSistema) || (saldoBanco - difFinal),
                    diferenciaFinal: difFinal,
                    movimientosConciliados
                });

                if (!supabaseClient) throw new Error('Cliente Supabase no disponible.');
                const { error } = await supabaseClient.rpc('guardar_conciliacion_bancaria', payload);
                if (error) {
                    await rollbackAjustes();
                    throw error;
                }

                if (DB && typeof DB.invalidateCache === 'function') {
                    DB.invalidateCache('conciliaciones');
                    DB.invalidateCache('transacciones');
                    DB.invalidateCache('pagos_ingresos');
                }

                this.state.editingConciliacionId = null;
                alert('Conciliación guardada exitosamente.');

                // Limpiar inputs y recargar
                this.state._seleccionados = new Set();
                this.state.saldoBancario = 0;
                this.state.ajusteGastos = 0;
                this.state.ajusteImpuestos = 0;
                this.state.ajusteEntradas = 0;

                await Promise.all([
                    this.loadHistorial(this.state.bancoId),
                    this.cargarDatosRPC()
                ]);

                this.renderBase();
                this.attachEvents();
                this.calcularTotales();
                this.recalcularDiferenciaPendiente();
                this.renderTabla();
                this.renderHistorial();

                // Cambiar a pestaña Historial para mostrar el comprobante
                await activarTab('historial');
            } catch (error) {
                console.error('[Conciliacion] Error al guardar conciliación:', error);
                alert('Hubo un error al guardar la conciliación: ' + (error?.message || JSON.stringify(error)));
            } finally {
                this._isSaving = false;
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar Conciliación';
                }
            }
        });

        // 13. Eventos en Tabla Historial (Ver Detalle, Editar, Eliminar)
        el.querySelector('#tbody-historial')?.addEventListener('click', async (e) => {
            const rowVer = e.target.closest('.row-historial-concil');
            const btnVer = e.target.closest('.btn-ver-detalle-concil');
            const btnEditar = e.target.closest('.btn-editar-concil');
            const btnEliminar = e.target.closest('.btn-eliminar-concil');

            if (btnVer || (rowVer && !e.target.closest('button'))) {
                const id = btnVer?.getAttribute('data-id') || rowVer?.getAttribute('data-id');
                if (id) {
                    window.location.hash = `#/bancos/conciliacion/detalle/${id}`;
                }
                return;
            }

            if (btnEditar) {
                e.stopPropagation();
                const id = btnEditar.getAttribute('data-id');
                const targetId = parseInt(id, 10);
                const concil = (this.state.historialConciliaciones || []).find(c => parseInt(c.id, 10) === targetId);
                if (!concil) return;

                this.state.editingConciliacionId = targetId;
                this.state._seleccionados = new Set(
                    (concil.movimientos_conciliados || []).map(mid => parseInt(mid, 10)).filter(mid => !isNaN(mid))
                );

                if (concil.banco_id) {
                    this.state.bancoId = parseInt(concil.banco_id, 10);
                }
                this.state.fechaDesde = concil.fecha_desde;
                this.state.fechaHasta = concil.fecha_hasta;
                this.state.saldoBancario = Number(concil.saldo_bancario) || 0;

                await this.cargarDatosRPC();
                this.renderBase();
                this.attachEvents();
                this.calcularTotales();
                this.recalcularDiferenciaPendiente();
                this.renderTabla();
                await activarTab('nueva');
                return;
            }

            if (btnEliminar) {
                e.stopPropagation();
                const id = btnEliminar.getAttribute('data-id');
                const targetId = parseInt(id, 10);
                if (isNaN(targetId)) return;

                if (confirm('¿Seguro que deseas eliminar el registro de esta conciliación?\n(Los movimientos bancarios asociados volverán a quedar pendientes en el extracto)')) {
                    try {
                        const supabaseClient = await this.getSupabase();
                        const DB = await this.getDB();
                        if (!supabaseClient) throw new Error('Cliente Supabase no disponible.');

                        const { error: rpcError } = await supabaseClient.rpc('eliminar_conciliacion_bancaria', { p_id: targetId });
                        if (rpcError) throw rpcError;

                        if (DB && typeof DB.invalidateCache === 'function') {
                            DB.invalidateCache('conciliaciones');
                        }

                        await this.loadHistorial(this.state.bancoId);
                        this.renderHistorial();
                    } catch (error) {
                        console.error('[Conciliacion] Error al eliminar:', error);
                        alert('Error al eliminar la conciliación: ' + (error?.message || JSON.stringify(error)));
                    }
                }
            }
        });
    }
};
