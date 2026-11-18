import { supabase } from '../../../core/supabase.js';
import { CoreActions } from '../../../shared/crud.js';
import { anularTransaccion } from '../../../shared/transaccionesUtils.js';

export const PagosRecibidosEvents = {
    bindStaticEvents() {
        // 1. Botón Nuevo Pago
        const btnNuevoPago = this.element.querySelector('#btn-nuevo-pago');
        if (btnNuevoPago) {
            btnNuevoPago.addEventListener('click', () => {
                window.location.hash = '#/ingresos/pagos/nuevo';
            });
        }

        // 2. Buscador en tiempo real con debounce
        const inputSearch = this.element.querySelector('#search-pagos');
        let searchTimeout;
        if (inputSearch) {
            inputSearch.addEventListener('input', (e) => {
                const val = e.target.value;
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.state.searchQuery = val.trim();
                    this.state.currentPage = 1;
                    this.cargarPagos();
                }, 350);
            });
        }

        // 3. Filtro por Cuenta Bancaria
        const selectCuenta = this.element.querySelector('#filter-cuenta-bancaria');
        if (selectCuenta) {
            selectCuenta.addEventListener('change', (e) => {
                this.state.selectedAccount = e.target.value;
                this.state.currentPage = 1;
                this.cargarPagos();
            });
        }

        // 4. Tabs de Filtro Rápido (Segmented Control)
        this.element.querySelectorAll('.payment-tab-btn').forEach(tabBtn => {
            tabBtn.addEventListener('click', () => {
                this.element.querySelectorAll('.payment-tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                this.state.selectedTab = tabBtn.dataset.tab || 'todos';
                this.state.currentPage = 1;
                this.cargarPagos();
            });
        });

        // 5. Toggle de Vistas: Lista vs Analítica
        const btnViewLista = this.element.querySelector('#btn-view-lista');
        const btnViewGrafico = this.element.querySelector('#btn-view-grafico');
        const containerTable = this.element.querySelector('#table-view-container');
        const containerAnalytics = this.element.querySelector('#analytics-view-container');

        if (btnViewLista && btnViewGrafico) {
            btnViewLista.addEventListener('click', () => {
                this.state.view = 'lista';
                btnViewLista.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold';
                btnViewGrafico.className = 'btn btn-sm btn-light border-0 text-muted';
                if (containerAnalytics) containerAnalytics.style.display = 'none';
                if (containerTable) containerTable.style.display = 'block';
                this.cargarPagos();
            });

            btnViewGrafico.addEventListener('click', async () => {
                this.state.view = 'grafico';
                btnViewGrafico.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold text-primary';
                btnViewLista.className = 'btn btn-sm btn-light border-0 text-muted';
                if (containerTable) containerTable.style.display = 'none';
                if (containerAnalytics) {
                    containerAnalytics.style.display = 'block';
                    containerAnalytics.innerHTML = `
                        <div class="text-center py-5">
                            <div class="spinner-border text-primary" role="status"></div>
                            <p class="text-muted mt-2" style="font-size: 13px;">Generando analítica de pagos...</p>
                        </div>
                    `;
                    const data = await this.cargarDatosGrafico();
                    this.renderAnalyticsView(containerAnalytics, data);
                }
            });
        }

        // 6. Botón Exportar Excel
        const btnExport = this.element.querySelector('#btn-export-excel');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                this.exportarExcel();
            });
        }

        // 7. Botón Refrescar
        const btnRefresh = this.element.querySelector('#btn-refresh-pagos');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', async () => {
                const icon = btnRefresh.querySelector('i');
                if (icon) icon.classList.add('spinner-border', 'spinner-border-sm');
                await this.calcularKPIs();
                if (this.state.view === 'grafico') {
                    this.renderList();
                    const containerAnalytics = this.element.querySelector('#analytics-view-container');
                    if (containerAnalytics) {
                        containerAnalytics.style.display = 'block';
                        const data = await this.cargarDatosGrafico();
                        this.renderAnalyticsView(containerAnalytics, data);
                    }
                } else {
                    this.renderList();
                    await this.cargarPagos();
                }
            });
        }

        // 8. Drawer - Cerrar panel
        const btnCloseDrawer = this.element.querySelector('#btn-drawer-close');
        const btnCloseDrawerBottom = this.element.querySelector('#btn-drawer-close-bottom');
        const backdropDrawer = this.element.querySelector('#payment-drawer-backdrop');

        if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', () => this.cerrarDrawer());
        if (btnCloseDrawerBottom) btnCloseDrawerBottom.addEventListener('click', () => this.cerrarDrawer());
        if (backdropDrawer) backdropDrawer.addEventListener('click', () => this.cerrarDrawer());
    },

    bindDetailEvents(container) {
        const btnVolver = container.querySelector('#btn-volver-pagos');
        if (btnVolver) {
            btnVolver.addEventListener('click', () => {
                this.state.view = 'lista';
                this.state.currentComprobanteData = null;
                this.render();
            });
        }
        
        const btnVistaPrevia = container.querySelector('#btn-vista-previa-comprobante');
        if (btnVistaPrevia) {
            btnVistaPrevia.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.mostrarDetalle(id, 'vista-previa');
            });
        }
        
        const btnImprimirComprobante = container.querySelector('#btn-imprimir-comprobante');
        if (btnImprimirComprobante) {
            btnImprimirComprobante.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.mostrarDetalle(id, 'print');
            });
        }
        
        const btnEditarComprobante = container.querySelector('#btn-editar-comprobante');
        if (btnEditarComprobante) {
            btnEditarComprobante.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                import('../../../shared/transaccionModal.js').then(async m => {
                    const { data } = await supabase.from('pagos_ingresos').select('*').eq('id', id).single();
                    if (data) {
                        m.mostrarDetalleTransaccion(data, async () => {
                            this.state.view = 'lista';
                            await this.calcularKPIs();
                            await this.cargarPagos();
                        });
                        setTimeout(() => {
                            const btnEdit = document.getElementById('btn-activar-edicion');
                            if (btnEdit) btnEdit.click();
                        }, 200);
                    }
                });
            });
        }
    },

    bindDynamicEvents(gridContainer) {
        // 1. Selector de cantidad por página
        const selectLimit = gridContainer.querySelector('#select-limit');
        if (selectLimit) {
            selectLimit.addEventListener('change', (e) => {
                this.state.itemsPerPage = parseInt(e.target.value, 10);
                this.state.currentPage = 1;
                this.cargarPagos();
            });
        }

        // 2. Paginación
        const btnPrev = gridContainer.querySelector('#btn-prev');
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                if (this.state.currentPage > 1) {
                    this.state.currentPage--;
                    this.cargarPagos();
                }
            });
        }

        const btnNext = gridContainer.querySelector('#btn-next');
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                const max = Math.ceil(this.state.totalItems / this.state.itemsPerPage) || 1;
                if (this.state.currentPage < max) {
                    this.state.currentPage++;
                    this.cargarPagos();
                }
            });
        }

        // 3. Clic en fila para abrir el Drawer lateral de comprobante y trazabilidad
        gridContainer.querySelectorAll('.row-pago').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.btn-menu-row') || e.target.closest('.dropdown-menu') || e.target.closest('a') || e.target.closest('.btn-quick-print')) return;
                const id = row.getAttribute('data-id');
                this.mostrarDrawer(id);
            });
        });

        // 4. Quick Actions
        gridContainer.querySelectorAll('.btn-quick-preview').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                this.mostrarDrawer(id);
            });
        });

        gridContainer.querySelectorAll('.btn-quick-print').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                this.mostrarDetalle(id, 'print');
            });
        });

        // 5. Menú contextual flotante (3 puntos)
        gridContainer.querySelectorAll('.btn-menu-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof window.cleanupFloatingElements === 'function') {
                    window.cleanupFloatingElements();
                }

                const id = btn.getAttribute('data-id');
                const conciliado = btn.getAttribute('data-conciliado') === 'true';
                const anulado = btn.getAttribute('data-anulado') === 'true';
                const rect = btn.getBoundingClientRect();
                
                const menu = document.createElement('div');
                menu.className = 'dropdown-menu row-action-menu show shadow border';
                menu.style.position = 'absolute';
                menu.style.top = `${rect.bottom + window.scrollY}px`;
                menu.style.left = `${rect.left + window.scrollX - 130}px`;
                menu.style.zIndex = '1060';
                menu.style.minWidth = '150px';
                menu.style.fontSize = '13px';
                menu.style.borderRadius = '8px';
                
                menu.innerHTML = `
                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-ver-${id}">
                        <i class="bi bi-layout-sidebar-inset-reverse text-primary"></i> Ver trazabilidad
                    </a>
                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-imprimir-${id}">
                        <i class="bi bi-printer text-secondary"></i> Imprimir
                    </a>
                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-full-${id}">
                        <i class="bi bi-arrows-fullscreen text-secondary"></i> Ver en pantalla completa
                    </a>
                    ${conciliado ? `
                        <div class="dropdown-divider my-1"></div>
                        <div class="px-3 py-2 text-muted small fst-italic" style="font-size: 11px;">Movimiento conciliado con el banco.</div>
                    ` : (!anulado ? `
                        <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-editar-${id}">
                            <i class="bi bi-pencil text-secondary"></i> Editar
                        </a>
                        <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-anular-${id}">
                            <i class="bi bi-x-circle text-warning"></i> Anular
                        </a>
                        <div class="dropdown-divider my-1"></div>
                        <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-danger" href="#" id="action-eliminar-${id}">
                            <i class="bi bi-trash"></i> Eliminar
                        </a>
                    ` : '')}
                `;

                document.body.appendChild(menu);

                const actionVer = document.getElementById(`action-ver-${id}`);
                if (actionVer) {
                    actionVer.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();
                        this.mostrarDrawer(id);
                    });
                }

                const actionFull = document.getElementById(`action-full-${id}`);
                if (actionFull) {
                    actionFull.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();
                        this.mostrarDetalle(id, 'preview');
                    });
                }
                
                const actionImprimir = document.getElementById(`action-imprimir-${id}`);
                if (actionImprimir) {
                    actionImprimir.addEventListener('click', async (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();
                        this.mostrarDetalle(id, 'print');
                    });
                }
                
                const actionEditar = document.getElementById(`action-editar-${id}`);
                if (actionEditar) {
                    actionEditar.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();
                        import('../../../shared/transaccionModal.js').then(m => {
                            supabase.from('pagos_ingresos').select('*').eq('id', id).single().then(({data}) => {
                                if (data) {
                                    m.mostrarDetalleTransaccion(data, async () => {
                                        await this.calcularKPIs();
                                        await this.cargarPagos();
                                    });
                                    setTimeout(() => {
                                        const btnEdit = document.getElementById('btn-activar-edicion');
                                        if (btnEdit) btnEdit.click();
                                    }, 200);
                                }
                            });
                        });
                    });
                }

                const actionAnular = document.getElementById(`action-anular-${id}`);
                if (actionAnular) {
                    actionAnular.addEventListener('click', async (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();
                        
                        if (confirm('¿Estás seguro de anular este pago? Esta acción no se puede deshacer.')) {
                            const {data: t} = await supabase.from('pagos_ingresos').select('*').eq('id', id).single();
                            if (t) {
                                try {
                                    if (t.categoria === 'Transferencia') {
                                        const { error } = await supabase.rpc('anular_transferencia_pareja', { p_id: t.id });
                                        if (error) throw error;
                                    } else {
                                        await anularTransaccion(t.id, false);
                                    }
                                    CoreActions.showWarningModal('Pago anulado con éxito', 'success');
                                    await this.calcularKPIs();
                                    await this.cargarPagos();
                                } catch (err) {
                                    CoreActions.showWarningModal('Error al anular: ' + err.message);
                                }
                            }
                        }
                    });
                }
                
                const actionEliminar = document.getElementById(`action-eliminar-${id}`);
                if (actionEliminar) {
                    actionEliminar.addEventListener('click', async (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        window.cleanupFloatingElements();

                        const grupoId = btn.getAttribute('data-grupo');

                        if (grupoId) {
                            if (conciliado) {
                                CoreActions.showWarningModal('Este movimiento está conciliado. Elimina la conciliación en Bancos > Conciliación para poder modificarlo.');
                                return;
                            }

                            const confirmado = await CoreActions.showConfirmModalAsync('¿Estás seguro de ELIMINAR permanentemente este pago agrupado? Se borrarán TODAS sus facturas asociadas y sus saldos volverán al estado anterior a este pago. Esta acción no se puede deshacer.');
                            if (!confirmado) return;

                            try {
                                const { data: pagosGrupo } = await supabase.from('pagos_ingresos').select('*').eq('grupo_pago_id', grupoId);
                                const facturaIdsAfectadas = [...new Set((pagosGrupo || []).map(p => p.factura_id).filter(Boolean))];

                                for (const fid of facturaIdsAfectadas) {
                                    const { data: fact } = await supabase.from('facturas').select('saldo_pendiente, pagada, monto_pagado').eq('id', fid).single();
                                    const montoAbonadoFactura = (pagosGrupo || [])
                                        .filter(p => p.factura_id === fid)
                                        .reduce((sum, p) => sum + Number(p.monto), 0);

                                    if (fact) {
                                        const nuevoSaldo = Number(fact.saldo_pendiente || 0) + montoAbonadoFactura;
                                        const nuevoMontoPagado = Math.max(0, Number(fact.monto_pagado || 0) - montoAbonadoFactura);
                                        await supabase.from('facturas').update({
                                            saldo_pendiente: nuevoSaldo,
                                            monto_pagado: nuevoMontoPagado,
                                            pagada: false
                                        }).eq('id', fid);
                                    }
                                }

                                await supabase.from('pagos_ingresos').delete().eq('grupo_pago_id', grupoId);
                                CoreActions.showWarningModal('Pago agrupado eliminado y facturas actualizadas.', 'success');
                                await this.calcularKPIs();
                                await this.cargarPagos();
                            } catch (err) {
                                CoreActions.showWarningModal('Error al eliminar pago agrupado: ' + err.message);
                            }
                        } else {
                            const { data: t } = await supabase.from('pagos_ingresos').select('*').eq('id', id).single();
                            if (t && t.factura_id) {
                                CoreActions.showWarningModal('No se puede eliminar un pago asociado a una factura. Usa la opción "Anular" para mantener la consistencia del saldo.');
                                return;
                            }
                            if (conciliado) {
                                CoreActions.showWarningModal('Este movimiento está conciliado. Elimina la conciliación en Bancos para poder modificarlo.');
                                return;
                            }

                            if (confirm('¿Estás seguro de ELIMINAR permanentemente este pago? Esta acción no se puede deshacer.')) {
                                try {
                                    if (t && t.categoria === 'Transferencia') {
                                        const { error } = await supabase.rpc('eliminar_transferencia_pareja', { p_id: id });
                                        if (error) throw error;
                                    } else {
                                        await supabase.from('pagos_ingresos').delete().eq('id', id);
                                    }
                                    CoreActions.showWarningModal('Pago eliminado con éxito', 'success');
                                    await this.calcularKPIs();
                                    await this.cargarPagos();
                                } catch (err) {
                                    CoreActions.showWarningModal('Error al eliminar: ' + err.message);
                                }
                            }
                        }
                    });
                }
            });
        });
    },

    exportarExcel() {
        try {
            const pagos = this.state.pagos || [];
            if (pagos.length === 0) {
                CoreActions.showWarningModal('No hay pagos en la lista para exportar.');
                return;
            }

            const dataToExport = pagos.map(p => ({
                'N° Recibo': p.numero,
                'Fecha': p.fecha,
                'Cliente': p.cliente || 'Cliente General',
                'Concepto / Detalle': p.categoria || 'Sin detalle',
                'Factura Asociada': p.factura_numero ? `Factura #${p.factura_numero}` : (p.factura_id ? `Factura #${p.factura_id}` : 'Anticipo / Directo'),
                'Cuenta Bancaria': p.cuenta_bancaria || 'Caja / Efectivo',
                'Conciliación': p.estado_conciliacion ? 'Conciliado' : 'Por conciliar',
                'Estado': p.estado_transaccion === 'anulado' ? 'Anulado' : 'Activo',
                'Monto Recibido': Number(p.monto) || 0
            }));

            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];

            if (window.XLSX) {
                const ws = window.XLSX.utils.json_to_sheet(dataToExport);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, "Pagos_Recibidos");
                window.XLSX.writeFile(wb, `Pagos_Recibidos_${dateStr}.xlsx`);
            } else {
                const headers = Object.keys(dataToExport[0]);
                let csv = headers.join(';') + '\r\n';
                dataToExport.forEach(row => {
                    csv += headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(';') + '\r\n';
                });
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Pagos_Recibidos_${dateStr}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error('Error exportando pagos:', e);
            CoreActions.showWarningModal('Error al exportar los pagos: ' + e.message);
        }
    }
};
