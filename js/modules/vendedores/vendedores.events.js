// js/modules/vendedores/vendedores.events.js
// Capa de Eventos, Interacciones Reactivas, Drawer 360°, Modales y Analítica Chart.js

import { VendedoresData } from './vendedores.data.js';
import { VendedoresTemplates } from './vendedores.templates.js';

export const VendedoresEvents = {
    module: null,
    element: null,

    init(module) {
        this.module = module;
        this.element = module.element;

        this.setupTopBarEvents();
        this.setupTabsAndSearchEvents();
        this.setupTableActionEvents();
        this.setupDrawerEvents();
    },

    setupTopBarEvents() {
        const el = this.element;
        if (!el) return;

        // 1. Botón Nuevo Vendedor
        el.querySelector('#btn-nuevo-vendedor-top')?.addEventListener('click', () => {
            this.abrirModalVendedor();
        });

        // 2. Botón Refrescar
        el.querySelector('#btn-refresh-vendedores')?.addEventListener('click', async () => {
            const btn = el.querySelector('#btn-refresh-vendedores');
            const icon = btn?.querySelector('i');
            if (icon) icon.className = 'spinner-border spinner-border-sm';
            if (btn) btn.disabled = true;

            await this.module.recargar();

            if (icon) icon.className = 'bi bi-arrow-clockwise';
            if (btn) btn.disabled = false;
        });

        // 3. Botón Exportar a Excel
        el.querySelector('#btn-export-excel')?.addEventListener('click', () => {
            this.exportarExcel();
        });

        // 4. Toggle Vista: Lista vs Analítica
        const btnViewLista = el.querySelector('#btn-view-lista');
        const btnViewGrafico = el.querySelector('#btn-view-grafico');
        const containerTable = el.querySelector('#vendedores-table-container');
        const containerAnalytics = el.querySelector('#vendedores-analytics-container');

        if (btnViewLista && btnViewGrafico) {
            btnViewLista.addEventListener('click', () => {
                this.module.state.currentView = 'lista';
                btnViewLista.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold';
                btnViewGrafico.className = 'btn btn-sm btn-light border-0 text-muted';
                if (containerAnalytics) containerAnalytics.style.display = 'none';
                if (containerTable) containerTable.style.display = 'block';
                this.actualizarTablaEnDOM();
            });

            btnViewGrafico.addEventListener('click', () => {
                this.module.state.currentView = 'grafico';
                btnViewGrafico.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold text-primary';
                btnViewLista.className = 'btn btn-sm btn-light border-0 text-muted';
                if (containerTable) containerTable.style.display = 'none';
                if (containerAnalytics) {
                    containerAnalytics.style.display = 'block';
                    containerAnalytics.innerHTML = VendedoresTemplates.renderAnalitica(this.module.state.vendedores, this.module.state.insights);
                    this.renderCharts();
                }
            });
        }
    },

    setupTabsAndSearchEvents() {
        const el = this.element;
        if (!el) return;

        // Pestañas segmentadas (.payment-tab-btn)
        el.querySelectorAll('.payment-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (!tab) return;

                this.module.state.currentTab = tab;

                el.querySelectorAll('.payment-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                this.aplicarFiltrosYRenderizar();
            });
        });

        // Omnibox de Búsqueda
        const searchInput = el.querySelector('#search-vendedores');
        if (searchInput) {
            let debounceTimer = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.module.state.searchQuery = e.target.value.trim();
                    this.aplicarFiltrosYRenderizar();
                }, 150);
            });
        }
    },

    aplicarFiltrosYRenderizar() {
        const state = this.module.state;
        state.vendedoresFiltrados = VendedoresData.filtrarYOrdenar(state.vendedores, {
            tab: state.currentTab,
            search: state.searchQuery,
            sortBy: 'total_vendido',
            sortOrder: 'desc'
        });

        if (state.currentView === 'lista') {
            this.actualizarTablaEnDOM();
        } else {
            const container = this.element.querySelector('#vendedores-analytics-container');
            if (container) {
                container.innerHTML = VendedoresTemplates.renderAnalitica(state.vendedores, state.insights);
                this.renderCharts();
            }
        }
    },

    actualizarTablaEnDOM() {
        const container = this.element?.querySelector('#vendedores-table-container');
        if (!container) return;

        const kpis = this.module.state.kpis || {};
        container.innerHTML = VendedoresTemplates.renderTabla(
            this.module.state.vendedoresFiltrados,
            kpis.totalVendido || 0
        );
        this.setupTableActionEvents();
    },

    setupTableActionEvents() {
        const el = this.element;
        if (!el) return;

        // Clic en fila de la tabla -> Abrir Drawer 360°
        el.querySelectorAll('.payment-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('a')) return;
                const id = row.dataset.id;
                if (id) this.abrirDrawer(id);
            });
        });

        // Botón Inspección 360°
        el.querySelectorAll('.btn-ver-drawer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (id) this.abrirDrawer(id);
            });
        });

        // Botón Pago Rápido
        el.querySelectorAll('.btn-quick-pagar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (id) this.abrirDrawer(id);
            });
        });

        // Botón Editar Vendedor
        el.querySelectorAll('.btn-editar-vendedor').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const v = {
                    id: btn.dataset.id,
                    nombre: btn.dataset.nombre,
                    telefono: btn.dataset.telefono,
                    porcentaje_comision: parseFloat(btn.dataset.porcentaje),
                    estado: btn.dataset.estado
                };
                this.abrirModalVendedor(v);
            });
        });
    },

    setupDrawerEvents() {
        const el = this.element;
        if (!el) return;

        const backdrop = el.querySelector('#vendedor-drawer-backdrop');
        const btnClose = el.querySelector('#btn-close-drawer');
        const btnCloseFooter = el.querySelector('#btn-drawer-cerrar-footer');
        const btnEditar = el.querySelector('#btn-drawer-editar-vendedor');

        const cerrar = () => this.cerrarDrawer();

        backdrop?.addEventListener('click', cerrar);
        btnClose?.addEventListener('click', cerrar);
        btnCloseFooter?.addEventListener('click', cerrar);

        btnEditar?.addEventListener('click', () => {
            const vId = this.module.state.activeDrawerVendedorId;
            const v = (this.module.state.vendedores || []).find(vend => String(vend.id) === String(vId));
            if (v) this.abrirModalVendedor(v);
        });
    },

    async abrirDrawer(vendedorId) {
        if (!vendedorId) return;
        this.module.state.activeDrawerVendedorId = vendedorId;

        const backdrop = this.element?.querySelector('#vendedor-drawer-backdrop');
        const drawer = this.element?.querySelector('#drawer-vendedor-360');
        const body = this.element?.querySelector('#drawer-vendedor-body');
        if (!drawer || !body) return;

        body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;

        if (backdrop) backdrop.classList.add('show');
        drawer.classList.add('show');

        // Cargar datos profundos del vendedor
        const { vendedor, comisiones, cuentas } = await VendedoresData.cargarDetalleVendedor(vendedorId);
        this.module.state.activeDrawerVendedor = vendedor;
        this.module.state.activeDrawerComisiones = comisiones;
        this.module.state.activeDrawerCuentas = cuentas;

        body.innerHTML = VendedoresTemplates.renderDrawerContent(vendedor, comisiones, cuentas);

        // Asociar eventos internos del drawer
        this.setupDrawerInternalActions(body, vendedor, comisiones, cuentas);
    },

    cerrarDrawer() {
        const backdrop = this.element?.querySelector('#vendedor-drawer-backdrop');
        const drawer = this.element?.querySelector('#drawer-vendedor-360');
        if (backdrop) backdrop.classList.remove('show');
        if (drawer) drawer.classList.remove('show');
        this.module.state.activeDrawerVendedorId = null;
    },

    setupDrawerInternalActions(body, vendedor, comisiones, cuentas) {
        if (!body || !vendedor) return;

        // Botón Pagar Comisión Individual
        body.querySelectorAll('.btn-pagar-comision-single').forEach(btn => {
            btn.addEventListener('click', () => {
                const cid = btn.dataset.id;
                const monto = btn.dataset.monto;
                const comision = { id: cid, monto: parseFloat(monto) };
                this.abrirModalPagarComision(comision, cuentas, vendedor.nombre);
            });
        });

        // Botón Liquidar Todo lo Pendiente
        body.querySelector('.btn-liquidar-todo')?.addEventListener('click', () => {
            const pendientes = (comisiones || []).filter(c => c.estado === 'pendiente');
            this.abrirModalLiquidacionMasiva(vendedor, pendientes, cuentas);
        });
    },

    abrirModalVendedor(vendedor = null) {
        const root = this.element?.querySelector('#vendedor-modals-root') || document.body;
        const existing = document.getElementById('vendedor-modal');
        if (existing) existing.remove();

        root.insertAdjacentHTML('beforeend', VendedoresTemplates.renderModalVendedor(vendedor));

        const modalEl = document.getElementById('vendedor-modal');
        const closeModal = () => modalEl?.remove();

        document.getElementById('btn-close-vendedor-modal')?.addEventListener('click', closeModal);
        document.getElementById('btn-cancel-vendedor')?.addEventListener('click', closeModal);

        document.getElementById('btn-guardar-vendedor')?.addEventListener('click', async () => {
            const nombre = document.getElementById('vend-nombre')?.value.trim();
            const telefono = document.getElementById('vend-telefono')?.value.trim();
            const porcentaje = document.getElementById('vend-porcentaje')?.value;
            const estado = document.getElementById('vend-estado')?.value || 'activo';
            const errDiv = document.getElementById('vend-error');
            const btnGuardar = document.getElementById('btn-guardar-vendedor');

            if (errDiv) { errDiv.style.display = 'none'; errDiv.textContent = ''; }

            const validacion = VendedoresData.validarVendedor({ nombre, telefono, porcentaje_comision: porcentaje, estado });
            if (!validacion.valido) {
                if (errDiv) { errDiv.textContent = validacion.error; errDiv.style.display = 'block'; }
                return;
            }

            try {
                if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...'; }

                await VendedoresData.guardarVendedor(vendedor?.id, validacion.data);
                closeModal();
                await this.module.recargar();

                this.showNotification(vendedor ? 'Vendedor actualizado con éxito.' : 'Vendedor registrado exitosamente.');
            } catch (err) {
                if (errDiv) {
                    errDiv.textContent = 'Error al guardar: ' + err.message;
                    errDiv.style.display = 'block';
                }
            } finally {
                if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = '<i class="bi bi-check-lg me-1"></i> Guardar'; }
            }
        });
    },

    abrirModalPagarComision(comision, cuentas, vendedorNombre) {
        const root = this.element?.querySelector('#vendedor-modals-root') || document.body;
        const existing = document.getElementById('pagar-comision-modal');
        if (existing) existing.remove();

        root.insertAdjacentHTML('beforeend', VendedoresTemplates.renderModalPagarComision(comision, cuentas, vendedorNombre));

        const modalEl = document.getElementById('pagar-comision-modal');
        const closeModal = () => modalEl?.remove();

        document.getElementById('btn-close-pago-modal')?.addEventListener('click', closeModal);
        document.getElementById('btn-cancel-pago')?.addEventListener('click', closeModal);

        document.getElementById('btn-confirmar-pago')?.addEventListener('click', async () => {
            const cuentaId = document.getElementById('pago-cuenta')?.value;
            const errDiv = document.getElementById('pago-error');
            const btnConfirmar = document.getElementById('btn-confirmar-pago');

            if (!cuentaId) {
                if (errDiv) { errDiv.textContent = 'Selecciona una cuenta bancaria.'; errDiv.style.display = 'block'; }
                return;
            }

            try {
                if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Procesando...'; }

                await VendedoresData.pagarComision(comision.id, cuentaId);
                closeModal();

                // Recargar drawer y vista general
                const vId = this.module.state.activeDrawerVendedorId;
                await this.module.recargar();
                if (vId) await this.abrirDrawer(vId);

                this.showNotification('Comisión liquidada correctamente.');
            } catch (err) {
                if (errDiv) {
                    errDiv.textContent = 'Error al pagar: ' + err.message;
                    errDiv.style.display = 'block';
                }
            } finally {
                if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.innerHTML = '<i class="bi bi-check-circle me-1"></i> Confirmar Pago'; }
            }
        });
    },

    abrirModalLiquidacionMasiva(vendedor, comisionesPendientes, cuentas) {
        const root = this.element?.querySelector('#vendedor-modals-root') || document.body;
        const existing = document.getElementById('liquidacion-masiva-modal');
        if (existing) existing.remove();

        root.insertAdjacentHTML('beforeend', VendedoresTemplates.renderModalLiquidacionMasiva(vendedor, comisionesPendientes, cuentas));

        const modalEl = document.getElementById('liquidacion-masiva-modal');
        const closeModal = () => modalEl?.remove();

        document.getElementById('btn-close-masiva-modal')?.addEventListener('click', closeModal);
        document.getElementById('btn-cancel-masiva')?.addEventListener('click', closeModal);

        document.getElementById('btn-confirmar-masiva')?.addEventListener('click', async () => {
            const cuentaId = document.getElementById('pago-masivo-cuenta')?.value;
            const errDiv = document.getElementById('masiva-error');
            const btnConfirmar = document.getElementById('btn-confirmar-masiva');

            if (!cuentaId) {
                if (errDiv) { errDiv.textContent = 'Selecciona una cuenta bancaria de desembolso.'; errDiv.style.display = 'block'; }
                return;
            }

            const cIds = comisionesPendientes.map(c => c.id);

            try {
                if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Desembolsando...'; }

                const res = await VendedoresData.liquidarComisionesMasivas(cIds, cuentaId);
                closeModal();

                const vId = this.module.state.activeDrawerVendedorId;
                await this.module.recargar();
                if (vId) await this.abrirDrawer(vId);

                this.showNotification(`Liquidación masiva completada: ${res.pagadas} comisiones pagadas exitosamente.`);
            } catch (err) {
                if (errDiv) {
                    errDiv.textContent = 'Error en liquidación masiva: ' + err.message;
                    errDiv.style.display = 'block';
                }
            } finally {
                if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.innerHTML = '<i class="bi bi-check-all me-1"></i> Desembolsar Todo'; }
            }
        });
    },

    renderCharts() {
        const initCharts = () => {
            if (typeof Chart === 'undefined') return;

            const vendedores = this.module.state.vendedores || [];
            const activosConVentas = [...vendedores]
                .filter(v => Number(v.total_vendido || 0) > 0)
                .sort((a, b) => Number(b.total_vendido || 0) - Number(a.total_vendido || 0))
                .slice(0, 8); // Top 8

            // 1. Chart Ranking Ventas (Horizontal Bar)
            const ctxVentas = document.getElementById('chartVentasVendedores');
            if (ctxVentas) {
                if (window.chartVendedoresVentas) {
                    window.chartVendedoresVentas.destroy();
                }

                const labels = activosConVentas.map(v => v.nombre);
                const dataVentas = activosConVentas.map(v => Number(v.total_vendido || 0));

                window.chartVendedoresVentas = new Chart(ctxVentas, {
                    type: 'bar',
                    data: {
                        labels: labels.length > 0 ? labels : ['Sin datos'],
                        datasets: [{
                            label: 'Ventas Cobradas ($)',
                            data: dataVentas.length > 0 ? dataVentas : [0],
                            backgroundColor: '#3b82f6',
                            borderRadius: 6
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `Vendido: $ ${Number(ctx.raw || 0).toLocaleString('es-CO')}`
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { color: '#f1f5f9' },
                                ticks: {
                                    callback: (val) => '$ ' + (val >= 1000000 ? (val / 1000000).toFixed(0) + 'M' : val.toLocaleString())
                                }
                            },
                            y: { grid: { display: false } }
                        }
                    }
                });
            }

            // 2. Chart Comisiones Pagadas vs Pendientes (Stacked Bar o Donut)
            const ctxComisiones = document.getElementById('chartComisionesVendedores');
            if (ctxComisiones) {
                if (window.chartVendedoresComisiones) {
                    window.chartVendedoresComisiones.destroy();
                }

                const kpis = this.module.state.kpis || {};
                const pagada = Number(kpis.comisionPagada || 0);
                const pendiente = Number(kpis.comisionPendiente || 0);

                window.chartVendedoresComisiones = new Chart(ctxComisiones, {
                    type: 'doughnut',
                    data: {
                        labels: ['Pagadas', 'Pendientes'],
                        datasets: [{
                            data: [pagada, pendiente],
                            backgroundColor: ['#10b981', '#f59e0b'],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `${ctx.label}: $ ${Number(ctx.raw || 0).toLocaleString('es-CO')}`
                                }
                            }
                        },
                        cutout: '65%'
                    }
                });
            }
        };

        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = initCharts;
            document.head.appendChild(script);
        } else {
            setTimeout(initCharts, 50);
        }
    },

    exportarExcel() {
        const btn = this.element?.querySelector('#btn-export-excel');
        const originalHtml = btn ? btn.innerHTML : '';

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Exportando...';
            }

            const lista = this.module.state.vendedoresFiltrados || this.module.state.vendedores || [];
            if (lista.length === 0) {
                alert('No hay vendedores disponibles para exportar con los filtros actuales.');
                return;
            }

            const dataToExport = VendedoresData.mapearParaExcel(lista);
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `Reporte_Vendedores_${dateStr}`;

            if (window.XLSX) {
                const ws = window.XLSX.utils.json_to_sheet(dataToExport);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, 'Vendedores');
                window.XLSX.writeFile(wb, `${fileName}.xlsx`);
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
                a.download = `${fileName}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Error exportando reporte de vendedores:', err);
            alert('Error al exportar: ' + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    },

    showNotification(message, type = 'success') {
        if (typeof window !== 'undefined' && window.CoreActions && typeof window.CoreActions.showSuccessModal === 'function' && type === 'success') {
            window.CoreActions.showSuccessModal(message);
        } else {
            this.showToast(message, type);
        }
    },

    showToast(message, type = 'success') {
        if (typeof document === 'undefined') return;
        const toastId = 'toast-' + Date.now();
        const safeType = ['success', 'danger', 'warning', 'info'].includes(type) ? type : 'info';
        const icon = safeType === 'success' ? 'check-circle' : safeType === 'danger' ? 'x-circle' : 'info-circle';

        const html = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${safeType} border-0 shadow-sm" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body d-flex align-items-center py-2 px-3" style="font-size: 13px;">
                        <i class="bi bi-${icon} me-2 fs-6"></i>
                        <span>${message}</span>
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '1090';
            document.body.appendChild(toastContainer);
        }

        toastContainer.insertAdjacentHTML('beforeend', html);
        const toastEl = document.getElementById(toastId);
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const bsToast = new bootstrap.Toast(toastEl, { delay: 3500 });
            bsToast.show();
            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        } else {
            setTimeout(() => toastEl?.remove(), 3500);
        }
    }
};
