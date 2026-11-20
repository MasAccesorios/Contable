// js/modules/bancos/bancos.events.js
// Manejo de Eventos, Interacciones Ergonómicas, Drawer y Modales de Bancos y Cajas 360°

import { getLocalDate } from '../../core/db.js';
import { escapeHtml } from '../../shared/formatters.js';

export const TesoreriaEvents = {
    bindEvents() {
        const el = this.element;
        if (!el) return;

        // 1. Botón Actualizar Datos
        el.querySelector('#btn-actualizar-bancos')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const icon = btn.querySelector('i');
            if (icon) icon.className = 'spinner-border spinner-border-sm me-2';
            btn.disabled = true;

            await this.loadData();

            if (icon) icon.className = 'bi bi-arrow-clockwise';
            btn.disabled = false;
        });

        // 2. Botón Exportar a Excel
        el.querySelector('#btn-export-excel')?.addEventListener('click', () => {
            if (typeof this.exportarExcel === 'function') {
                this.exportarExcel();
            }
        });

        // 3. Toggle de Vistas: Lista vs Analítica
        const btnViewLista = el.querySelector('#btn-view-lista');
        const btnViewGrafico = el.querySelector('#btn-view-grafico');
        const containerAnalytics = el.querySelector('#bancos-analytics-container');
        const containerTable = el.querySelector('#bancos-table-view-container');

        if (btnViewLista && btnViewGrafico) {
            btnViewLista.addEventListener('click', () => {
                this.state.currentView = 'lista';
                btnViewLista.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold';
                btnViewGrafico.className = 'btn btn-sm btn-light border-0 text-muted';
                if (containerAnalytics) containerAnalytics.style.display = 'none';
                if (containerTable) containerTable.style.display = 'block';
                this.renderTabla();
            });

            btnViewGrafico.addEventListener('click', () => {
                this.state.currentView = 'grafico';
                btnViewGrafico.className = 'btn btn-sm btn-white bg-white shadow-xs fw-bold text-primary';
                btnViewLista.className = 'btn btn-sm btn-light border-0 text-muted';
                if (containerTable) containerTable.style.display = 'none';
                if (containerAnalytics) containerAnalytics.style.display = 'block';
                this.renderChart();
            });
        }

        // 4. Tabs de Filtro Rápido (payment-tabs-bar)
        el.querySelectorAll('.payment-tab-btn').forEach(tabBtn => {
            tabBtn.addEventListener('click', () => {
                el.querySelectorAll('.payment-tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                this.state.currentTab = tabBtn.dataset.tab || 'todas';
                this.state.currentPage = 1;
                this.renderTabla();
            });
        });

        // 5. Buscador con Debounce de 300ms
        const inputSearch = el.querySelector('#search-bancos');
        let searchTimeout;
        if (inputSearch) {
            inputSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.state.searchQuery = e.target.value;
                    this.state.currentPage = 1;
                    this.renderTabla(this.state.searchQuery);
                }, 300);
            });
        }

        // 6. Delegación de Eventos en Tabla (Clic en Fila, Acciones, Paginador)
        el.querySelector('#tbody-bancos')?.addEventListener('click', async (e) => {
            const editarBtn = e.target.closest('.btn-editar-cuenta');
            if (editarBtn) {
                e.stopPropagation();
                this.abrirModalEditarCuenta(editarBtn.dataset);
                return;
            }

            const toggleBtn = e.target.closest('.btn-toggle-estado');
            if (toggleBtn) {
                e.stopPropagation();
                const id = toggleBtn.getAttribute('data-id');
                const estadoActual = toggleBtn.getAttribute('data-estado');
                this.toggleEstadoCuenta(id, estadoActual);
                return;
            }

            const conciliarBtn = e.target.closest('.btn-conciliar-directo');
            if (conciliarBtn) {
                e.stopPropagation();
                const id = conciliarBtn.dataset.id;
                window.location.hash = `#/bancos/conciliacion?banco_id=${id}`;
                return;
            }

            const inspectBtn = e.target.closest('.btn-quick-inspect-banco') || e.target.closest('.btn-menu-inspect-banco');
            if (inspectBtn) {
                e.stopPropagation();
                const id = inspectBtn.dataset.id;
                await this.abrirDrawer(id);
                return;
            }

            const menuBtn = e.target.closest('.dropdown') || e.target.closest('.dropdown-menu');
            if (menuBtn) {
                return;
            }

            const row = e.target.closest('.banco-row');
            if (row) {
                const id = row.getAttribute('data-id');
                await this.abrirDrawer(id);
            }
        });

        // 7. Eventos de Paginador
        el.querySelector('#bancos-pagination')?.addEventListener('change', (e) => {
            if (e.target.classList.contains('select-per-page')) {
                this.state.itemsPerPage = parseInt(e.target.value, 10);
                this.state.currentPage = 1;
                this.renderTabla();
            }
        });

        el.querySelector('#bancos-pagination')?.addEventListener('click', (e) => {
            const btnPrev = e.target.closest('.btn-prev-page');
            const btnNext = e.target.closest('.btn-next-page');

            if (btnPrev && this.state.currentPage > 1) {
                this.state.currentPage--;
                this.renderTabla();
            }
            if (btnNext) {
                this.state.currentPage++;
                this.renderTabla();
            }
        });

        // 8. Drawer: Cerrar y Acciones
        const btnCloseDrawer = el.querySelector('#btn-bancos-drawer-close');
        const btnCloseDrawerB = el.querySelector('#btn-bancos-drawer-close-bottom');
        const backdropDrawer = el.querySelector('#bancos-drawer-backdrop');

        if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', () => this.cerrarDrawer());
        if (btnCloseDrawerB) btnCloseDrawerB.addEventListener('click', () => this.cerrarDrawer());
        if (backdropDrawer) backdropDrawer.addEventListener('click', () => this.cerrarDrawer());

        el.querySelector('#btn-drawer-conciliar')?.addEventListener('click', () => {
            if (this.state.activeDrawerCuentaId) {
                window.location.hash = `#/bancos/conciliacion?banco_id=${this.state.activeDrawerCuentaId}`;
            }
        });

        el.querySelector('#btn-drawer-ver-detalle')?.addEventListener('click', () => {
            if (this.state.activeDrawerCuentaId) {
                window.location.hash = `#/bancos/detalle?banco_id=${this.state.activeDrawerCuentaId}`;
            }
        });

        // 9. Selector de Rango en Gráfico de Flujo
        el.querySelector('#select-chart-rango')?.addEventListener('change', async (e) => {
            const meses = parseInt(e.target.value, 10);
            await this.loadData(meses);
            this.renderChart(meses);
        });

        // 10. Modal Transferir: Apertura y Envío
        el.querySelector('#btn-transferir')?.addEventListener('click', () => {
            const origenSelect = document.getElementById('transf-origen');
            const destinoSelect = document.getElementById('transf-destino');

            const cuentasOptions = (this.state.cuentasActivas || [])
                .map(c => {
                    const numPart = c.numero && c.numero !== '-' ? ` (${c.numero})` : '';
                    return `<option value="${c.id}">${escapeHtml(c.nombre)}${escapeHtml(numPart)}</option>`;
                })
                .join('');

            if (origenSelect) {
                origenSelect.innerHTML = '<option value="" disabled selected>Selecciona el origen</option>' + cuentasOptions;
            }
            if (destinoSelect) {
                destinoSelect.innerHTML = '<option value="" disabled selected>Selecciona el destino</option>' + cuentasOptions;
            }

            const inputFecha = document.getElementById('transf-fecha');
            if (inputFecha) inputFecha.value = getLocalDate();

            const modalEl = document.getElementById('modal-transferir');
            if (modalEl) {
                if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                } else {
                    modalEl.classList.add('show', 'd-block');
                    modalEl.style.backgroundColor = 'rgba(0,0,0,0.5)';
                }
                import('../../shared/formatters.js').then(fmt => {
                    fmt.applyCurrencyFormatting(document.getElementById('transf-monto'));
                });
            }
        });

        el.querySelector('#modal-transferir .btn-close')?.addEventListener('click', () => {
            this.cerrarModalFallback('modal-transferir');
        });
        el.querySelector('#modal-transferir [data-bs-dismiss="modal"]')?.addEventListener('click', () => {
            this.cerrarModalFallback('modal-transferir');
        });

        el.querySelector('#form-transferir')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-confirmar-transf');
            if (btn) btn.disabled = true;

            const origenId = document.getElementById('transf-origen').value;
            const destinoId = document.getElementById('transf-destino').value;
            let monto = 0;
            try {
                const fmt = await import('../../shared/formatters.js');
                monto = fmt.parseCurrencyValue(document.getElementById('transf-monto').value);
            } catch (_) {
                monto = parseFloat(document.getElementById('transf-monto').value.replace(/\./g, '').replace(/,/g, '.')) || 0;
            }
            const fecha = document.getElementById('transf-fecha').value;
            const nota = document.getElementById('transf-nota').value.trim();

            const success = await this.ejecutarTransferencia(origenId, destinoId, monto, fecha, nota);

            if (success) {
                this.cerrarModalFallback('modal-transferir');
                document.getElementById('form-transferir').reset();
                await this.loadData();
            }

            if (btn) btn.disabled = false;
        });

        // 11. Modal Agregar Banco: Apertura y Envío
        el.querySelector('#btn-agregar-banco')?.addEventListener('click', () => {
            const form = document.getElementById('form-agregar-banco');
            if (form) form.reset();

            const modalEl = document.getElementById('modal-agregar-banco');
            if (modalEl) {
                if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                } else {
                    modalEl.classList.add('show', 'd-block');
                    modalEl.style.backgroundColor = 'rgba(0,0,0,0.5)';
                }
                import('../../shared/formatters.js').then(fmt => {
                    fmt.applyCurrencyFormatting(document.getElementById('banco-saldo-inicial'));
                });
            }
        });

        el.querySelector('#modal-agregar-banco .btn-close')?.addEventListener('click', () => {
            this.cerrarModalFallback('modal-agregar-banco');
        });
        el.querySelector('#modal-agregar-banco [data-bs-dismiss="modal"]')?.addEventListener('click', () => {
            this.cerrarModalFallback('modal-agregar-banco');
        });

        el.querySelector('#form-agregar-banco')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-confirmar-agregar-banco');
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...'; }

            const nombre = document.getElementById('banco-nombre').value.trim();
            const tipo = document.getElementById('banco-tipo').value.trim();
            const numero_cuenta = document.getElementById('banco-numero-cuenta').value.trim() || null;

            let saldo_inicial = 0;
            try {
                const fmt = await import('../../shared/formatters.js');
                saldo_inicial = fmt.parseCurrencyValue(document.getElementById('banco-saldo-inicial').value);
            } catch (_) {
                saldo_inicial = parseFloat(
                    document.getElementById('banco-saldo-inicial').value.replace(/\./g, '').replace(/,/g, '.')
                ) || 0;
            }

            const supabaseClient = await this.getSupabase();
            const { error } = await supabaseClient.from('cuentas_bancarias').insert({
                nombre,
                tipo,
                numero_cuenta,
                saldo_inicial,
                estado: 'active'
            });

            if (error) {
                console.error('[TesoreriaEvents] Error al crear cuenta:', error);
                if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar'; }
                alert('Error al guardar la cuenta: ' + error.message);
                return;
            }

            const DB = await this.getDB();
            if (DB && typeof DB.invalidateCache === 'function') {
                DB.invalidateCache('cuentas_bancarias');
            }
            this.cerrarModalFallback('modal-agregar-banco');
            await this.loadData();
            if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar'; }
        });

        // 12. Modal Editar Banco: Envío
        el.querySelector('#modal-editar-banco .btn-close')?.addEventListener('click', () => {
            this.cerrarModalFallback('modal-editar-banco');
        });
        el.querySelector('#modal-editar-banco [data-bs-dismiss="modal"]')?.addEventListener('click', () => {
            this.cerrarModalFallback('modal-editar-banco');
        });

        el.querySelector('#form-editar-banco')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-confirmar-editar-banco');
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...'; }

            const id = document.getElementById('banco-edit-id').value;
            const nombre = document.getElementById('banco-edit-nombre').value.trim();
            const tipo = document.getElementById('banco-edit-tipo').value.trim();
            const numero_cuenta = document.getElementById('banco-edit-numero-cuenta').value.trim() || null;

            const supabaseClient = await this.getSupabase();
            const { error } = await supabaseClient.from('cuentas_bancarias').update({
                nombre,
                tipo,
                numero_cuenta
            }).eq('id', id);

            if (error) {
                console.error('[TesoreriaEvents] Error al editar cuenta:', error);
                if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar cambios'; }
                alert('Error al guardar los cambios: ' + error.message);
                return;
            }

            const DB = await this.getDB();
            if (DB && typeof DB.invalidateCache === 'function') {
                DB.invalidateCache('cuentas_bancarias');
            }
            this.cerrarModalFallback('modal-editar-banco');
            await this.loadData();
            if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar cambios'; }
        });
    },

    async abrirDrawer(cuentaId) {
        if (!cuentaId) return;
        this.state.activeDrawerCuentaId = cuentaId;

        const backdrop = this.element?.querySelector('#bancos-drawer-backdrop');
        const drawer = this.element?.querySelector('#bancos-drawer');
        const body = this.element?.querySelector('#bancos-drawer-body');
        if (!drawer || !body) return;

        body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center py-5">
                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>
            </div>
        `;

        if (backdrop) backdrop.classList.add('show');
        drawer.classList.add('show');

        const cuenta = (this.state.todasLasCuentas || []).find(c => String(c.id) === String(cuentaId));
        const movimientos = await this.cargarMovimientosCuenta(cuentaId, 5);

        body.innerHTML = this.renderDrawerContent(cuenta, movimientos);
    },

    cerrarDrawer() {
        const backdrop = this.element?.querySelector('#bancos-drawer-backdrop');
        const drawer = this.element?.querySelector('#bancos-drawer');
        if (backdrop) backdrop.classList.remove('show');
        if (drawer) drawer.classList.remove('show');
        this.state.activeDrawerCuentaId = null;
    },

    abrirModalEditarCuenta(dataset) {
        document.getElementById('banco-edit-id').value = dataset.id || '';
        document.getElementById('banco-edit-nombre').value = dataset.nombre || '';
        document.getElementById('banco-edit-tipo').value = dataset.tipo || '';
        document.getElementById('banco-edit-numero-cuenta').value = dataset.numero || '';

        const modalEl = document.getElementById('modal-editar-banco');
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modalInstance = new bootstrap.Modal(modalEl);
            modalInstance.show();
        } else if (modalEl) {
            modalEl.classList.add('show', 'd-block');
            modalEl.style.backgroundColor = 'rgba(0,0,0,0.5)';
        }
    },

    cerrarModalFallback(modalId) {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) return;
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
        } else {
            modalEl.classList.remove('show', 'd-block');
            modalEl.style.backgroundColor = '';
        }
    }
};
