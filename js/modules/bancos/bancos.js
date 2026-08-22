// js/modules/bancos/bancos.js
import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';

export const TesoreriaModule = {
    cuentasConfig: [
        { nombre: "NU Bank Ahorros", tipo: "Banco", numero: "**** 0793" },
        { nombre: "DaviPlata", tipo: "Banco", numero: "**** 2091" },
        { nombre: "Nequi", tipo: "Banco", numero: "**** 2091" },
        { nombre: "3349 - Bancolombia Wilber", tipo: "Banco", numero: "**** 3349" },
        { nombre: "8421 - Davivienda Mao", tipo: "Banco", numero: "**** 8421" },
        { nombre: "0214-Bancolombia Diegomim24", tipo: "Banco", numero: "**** 0214" },
        { nombre: "7586-Bancolombia Andresmc17", tipo: "Banco", numero: "**** 7586" },
        { nombre: "7444-Bancolombia acinom", tipo: "Banco", numero: "**** 7444" },
        { nombre: "Caja Mary", tipo: "Efectivo", numero: "-" },
        { nombre: "9201-Bancolombia Luis E. Barrera", tipo: "Banco", numero: "**** 9201" },
        { nombre: "5278-Bancolombia Leidyizquierdo28", tipo: "Banco", numero: "**** 5278" },
        { nombre: "5787-Bancolombia Lenyma17", tipo: "Banco", numero: "**** 5787" },
        { nombre: "ABC Bank China", tipo: "Banco", numero: "-" },
        { nombre: "0955-Bancolombia Hermes", tipo: "Banco", numero: "**** 0955" },
        { nombre: "4037-Bancolombia Maryla", tipo: "Banco", numero: "**** 4037" },
        { nombre: "0130-Bancolombia Marcelo", tipo: "Banco", numero: "**** 0130" },
        { nombre: "4442-Bancolombia Helver", tipo: "Banco", numero: "**** 4442" },
        { nombre: "Transferencias - Binance", tipo: "Efectivo", numero: "-" },
        { nombre: "9451-Bancolombia Alba", tipo: "Banco", numero: "**** 9451" },
        { nombre: "9427-Bancolombia Mary", tipo: "Banco", numero: "**** 9427" },
        { nombre: "Davivienda Mao", tipo: "Banco", numero: "**** 0060" },
        { nombre: "AAACaja general", tipo: "Efectivo", numero: "-" }
    ],

    state: {
        transacciones: [],
        saldos: {},
        totalConsolidado: 0,
        chartInstance: null
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        element.innerHTML = `
            <div class="dash-layout p-4">
                <!-- TOP BAR -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Bancos</h2>
                        <p class="text-muted mb-0" style="font-size: var(--fs-md);">Controla los movimientos de dinero con tus cuentas de banco, efectivo y tarjetas de crédito.</p>
                    </div>
                    <div class="d-flex gap-2">
                        <button id="btn-transferir" class="btn bg-white border fw-medium shadow-sm d-flex align-items-center px-3" style="color: var(--text-body); font-size: var(--fs-md); border-radius: 6px;">
                            <i class="bi bi-arrow-down-up me-2"></i> Transferir
                        </button>
                        <button id="btn-agregar-banco" class="btn btn-primary-action">
                            <i class="bi bi-plus-lg me-2"></i> Agregar banco
                        </button>
                    </div>
                </div>

                <!-- KPI CARDS BANCOS -->
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Saldo Total en Cuentas</span>
                                <div class="dash-icon-box variant-blue">
                                    <i class="bi bi-bank"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="kpi-saldo-total">$ 0</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Cuentas Bancarias Activas</span>
                                <div class="dash-icon-box variant-green">
                                    <i class="bi bi-credit-card"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="kpi-bancos-activos">0</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Cajas / Efectivo</span>
                                <div class="dash-icon-box variant-yellow">
                                    <i class="bi bi-cash"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="kpi-efectivo-activos">0</div>
                        </div>
                    </div>
                </div>

                <!-- ROW FOR CHART AND RESUMEN -->
                <div class="row g-4 mb-4">
                    <!-- Chart -->
                    <div class="col-md-8">
                        <div class="card border-0 h-100" style="background: var(--surface); box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                            <div class="card-body p-4">
                                <div class="d-flex justify-content-between align-items-center mb-4">
                                    <h5 class="fw-bold mb-0" style="color: var(--text-main); font-size: var(--fs-lg);">Ingresos y gastos</h5>
                                    <select id="select-chart-rango" class="form-select form-select-sm border text-muted fw-medium" style="width: auto; border-radius: 6px; box-shadow: none;">
                                        <option value="1">1 mes</option>
                                        <option value="3">3 meses</option>
                                        <option value="6" selected>6 meses</option>
                                    </select>
                                </div>
                                <div style="height: 250px; position: relative;">
                                    <canvas id="chart-ingresos-gastos"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Resumen -->
                    <div class="col-md-4">
                        <div class="card border-0 h-100" style="background: var(--surface); box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                            <div class="card-body p-4 d-flex flex-column">
                                <h5 class="fw-bold mb-4" style="color: var(--text-main); font-size: var(--fs-lg);">Resumen</h5>
                                
                                <div class="mb-4">
                                    <p class="text-muted mb-1" style="font-size: var(--fs-base);">Saldo en bancos y efectivo</p>
                                    <h3 class="fw-bold mb-0" style="color: var(--primary);" id="resumen-bancos">$0,00</h3>
                                </div>
                                
                                <div class="mb-4 d-flex align-items-center justify-content-center" style="position: relative;">
                                    <hr class="w-100 text-muted m-0 opacity-25">
                                    <span class="px-2 position-absolute text-muted opacity-50" style="font-size: var(--fs-sm); background: var(--surface);"><i class="bi bi-dash-circle"></i></span>
                                </div>
                                
                                <div class="mt-2">
                                    <p class="text-muted mb-1" style="font-size: var(--fs-base);">Saldo total</p>
                                    <h3 class="fw-bold mb-0" style="color: var(--text-main);" id="resumen-total">$0,00</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TABLE -->
                <div class="dash-table-container">
                    <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center" style="border-radius: 8px 8px 0 0;">
                        <div class="input-group input-group-sm" style="width: 300px;">
                            <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                            <input type="text" id="search-bancos" class="form-control border-start-0 ps-0 text-muted" placeholder="Buscar bancos..." style="font-size: var(--fs-base); box-shadow: none;">
                        </div>
                        <button id="btn-actualizar-bancos" class="btn btn-sm btn-light border text-muted ms-auto d-flex align-items-center px-3" style="font-weight: 500; font-size: var(--fs-base);">
                            <i class="bi bi-arrow-clockwise me-2"></i> Actualizar datos
                        </button>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0 table-hover">
                            <thead style="border-bottom: 1px solid var(--border-color);">
                                <tr style="color: var(--text-muted); font-size: var(--fs-base); font-weight: var(--weight-medium); white-space: nowrap;">
                                    <th class=\"py-2 fw-normal ps-4\">Nombre</th>
                                    <th class=\"py-2 fw-normal\">Tipo de cuenta</th>
                                    <th class=\"py-2 fw-normal\">Número de cuenta</th>
                                    <th class=\"py-2 fw-normal\">Saldo</th>
                                    <th class=\"py-2 fw-normal pe-4\">Conciliación</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-bancos">
                                <tr><td colspan="5" class="text-center py-5 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Cargando bancos...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- MODAL TRANSFERIR -->
            <div class="modal fade" id="modal-transferir" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow" style="border-radius: 12px;">
                        <div class="modal-header border-bottom-0 pb-0">
                            <h5 class="modal-title fw-bold" style="color: var(--text-main);">Transferir entre cuentas</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4">
                            <form id="form-transferir">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Cuenta origen *</label>
                                    <select class="form-select" id="transf-origen" required>
                                        <option value="" disabled selected>Selecciona el origen</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Cuenta destino *</label>
                                    <select class="form-select" id="transf-destino" required>
                                        <option value="" disabled selected>Selecciona el destino</option>
                                    </select>
                                </div>
                                <div class="row g-3 mb-3">
                                    <div class="col-6">
                                        <label class="form-label text-muted small fw-semibold">Monto *</label>
                                        <input type="text" class="form-control fw-bold fs-5" id="transf-monto" required>
                                    </div>
                                    <div class="col-6">
                                        <label class="form-label text-muted small fw-semibold">Fecha *</label>
                                        <input type="date" class="form-control" id="transf-fecha" value="${getLocalDate()}" required>
                                    </div>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label text-muted small fw-semibold">Nota o referencia (Opcional)</label>
                                    <input type="text" class="form-control" id="transf-nota" placeholder="Ej. Traspaso de fondos">
                                </div>
                                <div class="d-flex gap-2 justify-content-end">
                                    <button type="button" class="btn btn-light border px-4" data-bs-dismiss="modal">Cancelar</button>
                                    <button type="submit" class="btn text-white px-4" style="background-color: var(--primary);" id="btn-confirmar-transf">Transferir</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODAL AGREGAR BANCO -->
            <div class="modal fade" id="modal-agregar-banco" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow" style="border-radius: 12px;">
                        <div class="modal-header border-bottom-0 pb-0">
                            <h5 class="modal-title fw-bold" style="color: var(--text-main);">Agregar cuenta bancaria</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4">
                            <form id="form-agregar-banco">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Nombre *</label>
                                    <input type="text" class="form-control" id="banco-nombre" placeholder="Ej. Bancolombia Ahorros" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Tipo *</label>
                                    <input type="text" class="form-control" id="banco-tipo" placeholder="Ej. Banco, Efectivo, Nequi..." required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Número de cuenta (Opcional)</label>
                                    <input type="text" class="form-control" id="banco-numero-cuenta" placeholder="Ej. **** 1234">
                                </div>
                                <div class="mb-4">
                                    <label class="form-label text-muted small fw-semibold">Saldo inicial</label>
                                    <input type="text" class="form-control fw-bold fs-5" id="banco-saldo-inicial" placeholder="$ 0,00">
                                </div>
                                <div class="d-flex gap-2 justify-content-end">
                                    <button type="button" class="btn btn-light border px-4" data-bs-dismiss="modal">Cancelar</button>
                                    <button type="submit" class="btn text-white px-4" style="background-color: var(--primary);" id="btn-confirmar-agregar-banco">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODAL EDITAR BANCO -->
            <div class="modal fade" id="modal-editar-banco" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow" style="border-radius: 12px;">
                        <div class="modal-header border-bottom-0 pb-0">
                            <h5 class="modal-title fw-bold" style="color: var(--text-main);">Editar cuenta bancaria</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4">
                            <form id="form-editar-banco">
                                <input type="hidden" id="banco-edit-id">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Nombre *</label>
                                    <input type="text" class="form-control" id="banco-edit-nombre" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Tipo *</label>
                                    <input type="text" class="form-control" id="banco-edit-tipo" placeholder="Ej. Banco, Efectivo, Nequi..." required>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label text-muted small fw-semibold">Número de cuenta (Opcional)</label>
                                    <input type="text" class="form-control" id="banco-edit-numero-cuenta" placeholder="Ej. **** 1234">
                                </div>
                                <div class="d-flex gap-2 justify-content-end">
                                    <button type="button" class="btn btn-light border px-4" data-bs-dismiss="modal">Cancelar</button>
                                    <button type="submit" class="btn text-white px-4" style="background-color: var(--primary);" id="btn-confirmar-editar-banco">Guardar cambios</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
        await this.loadData();
    },

    bindEvents() {
        const el = this.element;

        el.querySelector('#btn-actualizar-bancos')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Actualizando...';
            btn.disabled = true;
            
            // Forzar repintado visual y dar feedback
            await new Promise(r => {
                if (window._bancosRefreshTimeout) clearTimeout(window._bancosRefreshTimeout);
                window._bancosRefreshTimeout = setTimeout(r, 400);
            });
            await this.loadData();
            
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        });

        el.querySelector('#btn-agregar-banco')?.addEventListener('click', () => {
            // Limpiar el form antes de abrir
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

        el.querySelector('#btn-transferir')?.addEventListener('click', () => {
            // 1. Obtener las referencias a los selects
            const origenSelect = document.getElementById('transf-origen');
            const destinoSelect = document.getElementById('transf-destino');
            
            // 2. Construir el HTML de los options
            const cuentasOptions = (this.state.cuentasActivas || [])
                .map(c => `<option value="${c.id}">${c.nombre}</option>`)
                .join('');
            
            // 3. Inyectar dinámicamente preservando los placeholders originales
            if (origenSelect) {
                origenSelect.innerHTML = '<option value="" disabled selected>Selecciona el origen</option>' + cuentasOptions;
            }
            if (destinoSelect) {
                destinoSelect.innerHTML = '<option value="" disabled selected>Selecciona el destino</option>' + cuentasOptions;
            }

            // 4. Abrir el modal normalmente
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

        // Close manual fallback
        el.querySelector('#modal-transferir .btn-close')?.addEventListener('click', () => {
            const modalEl = document.getElementById('modal-transferir');
            if (modalEl) {
                modalEl.classList.remove('show', 'd-block');
                modalEl.style.backgroundColor = '';
            }
        });
        el.querySelector('#modal-transferir [data-bs-dismiss="modal"]')?.addEventListener('click', () => {
            const modalEl = document.getElementById('modal-transferir');
            if (modalEl) {
                modalEl.classList.remove('show', 'd-block');
                modalEl.style.backgroundColor = '';
            }
        });

        el.querySelector('#search-bancos')?.addEventListener('input', (e) => {
            this.renderTabla(e.target.value.toLowerCase().trim());
        });

        el.querySelector('#tbody-bancos')?.addEventListener('click', (e) => {
            const editarBtn = e.target.closest('.btn-editar-cuenta');
            if (editarBtn) {
                this.abrirModalEditarCuenta(editarBtn.dataset);
                return;
            }

            const toggleBtn = e.target.closest('.btn-toggle-estado');
            if (toggleBtn) {
                const id = toggleBtn.getAttribute('data-id');
                const estadoActual = toggleBtn.getAttribute('data-estado');
                this.toggleEstadoCuenta(id, estadoActual);
                return;
            }

            const conciliarBtn = e.target.closest('.btn-conciliar');
            if (conciliarBtn) {
                return;
            }

            const menuBtn = e.target.closest('.btn-abrir-menu-cuenta') || e.target.closest('.dropdown-menu');
            if (menuBtn) {
                return;
            }

            const row = e.target.closest('.banco-row');
            if (row) {
                const id = row.getAttribute('data-id');
                window.location.hash = `#/bancos/detalle?banco_id=${encodeURIComponent(id)}`;
            }
        });

        el.querySelector('#select-chart-rango')?.addEventListener('change', (e) => {
            const meses = parseInt(e.target.value, 10);
            this.renderChart(meses);
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
            } catch(e) {
                monto = parseFloat(document.getElementById('transf-monto').value.replace(/\./g, '').replace(/,/g, '.'));
            }
            const fecha = document.getElementById('transf-fecha').value;
            const nota = document.getElementById('transf-nota').value.trim();

            const success = await this.ejecutarTransferencia(origenId, destinoId, monto, fecha, nota);
            
            if (success) {
                // Cerrar modal
                const modalEl = document.getElementById('modal-transferir');
                if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const modalInstance = bootstrap.Modal.getInstance(modalEl);
                    if (modalInstance) modalInstance.hide();
                } else {
                    modalEl.classList.remove('show', 'd-block');
                }
                
                // Limpiar form
                document.getElementById('form-transferir').reset();
                document.getElementById('transf-fecha').value = getLocalDate();

                // Recargar datos
                await this.loadData();
            }

            if (btn) btn.disabled = false;
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

            const { error } = await supabase.from('cuentas_bancarias').insert({
                nombre,
                tipo,
                numero_cuenta,
                saldo_inicial,
                estado: 'active'
            });

            if (error) {
                console.error('Error al crear cuenta:', error);
                if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar'; }
                alert('Error al guardar la cuenta: ' + error.message);
                return;
            }

            // Cerrar modal
            const modalEl = document.getElementById('modal-agregar-banco');
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            } else if (modalEl) {
                modalEl.classList.remove('show', 'd-block');
                modalEl.style.backgroundColor = '';
            }

            // Recargar lista
            await this.loadData();

            if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar'; }
        });

        el.querySelector('#form-editar-banco')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-confirmar-editar-banco');
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...'; }

            const id = document.getElementById('banco-edit-id').value;
            const nombre = document.getElementById('banco-edit-nombre').value.trim();
            const tipo = document.getElementById('banco-edit-tipo').value.trim();
            const numero_cuenta = document.getElementById('banco-edit-numero-cuenta').value.trim() || null;

            const { error } = await supabase.from('cuentas_bancarias').update({
                nombre,
                tipo,
                numero_cuenta
            }).eq('id', id);

            if (error) {
                console.error('Error al editar cuenta:', error);
                if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar cambios'; }
                alert('Error al guardar los cambios: ' + error.message);
                return;
            }

            const modalEl = document.getElementById('modal-editar-banco');
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            } else if (modalEl) {
                modalEl.classList.remove('show', 'd-block');
                modalEl.style.backgroundColor = '';
            }

            await this.loadData();

            if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar cambios'; }
        });
    },

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

    renderResumen() {
        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2});
        
        const resumenBancos = this.element.querySelector('#resumen-bancos');
        const resumenTotal = this.element.querySelector('#resumen-total');
        const kpiSaldoTotal = this.element.querySelector('#kpi-saldo-total');
        const kpiBancosActivos = this.element.querySelector('#kpi-bancos-activos');
        const kpiEfectivoActivos = this.element.querySelector('#kpi-efectivo-activos');

        let bancosCount = 0;
        let cajasCount = 0;
        
        this.state.cuentasActivas.forEach(c => {
            if ((c.tipo || '').toLowerCase() === 'caja') cajasCount++;
            else bancosCount++;
        });

        if (resumenBancos) resumenBancos.textContent = formatMoney(this.state.totalConsolidado);
        if (resumenTotal) resumenTotal.textContent = formatMoney(this.state.totalConsolidado);
        if (kpiSaldoTotal) kpiSaldoTotal.textContent = formatMoney(this.state.totalConsolidado);
        if (kpiBancosActivos) kpiBancosActivos.textContent = bancosCount;
        if (kpiEfectivoActivos) kpiEfectivoActivos.textContent = cajasCount;
    },

    renderTabla(searchQuery = '') {
        const container = this.element.querySelector('#tbody-bancos');
        if (!container) return;

        let html = '';
        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2});

        // Usar cuentas de Firestore (todasLasCuentas) si existen, si no fallback a cuentasConfig
        const sourceArray = (this.state.todasLasCuentas && this.state.todasLasCuentas.length > 0) 
                            ? this.state.todasLasCuentas 
                            : this.cuentasConfig;
                            
        const cuentasFiltradas = sourceArray.filter(c => 
            c.nombre.toLowerCase().includes(searchQuery) ||
            c.tipo.toLowerCase().includes(searchQuery) ||
            (c.numero && c.numero.toLowerCase().includes(searchQuery))
        );

        if (cuentasFiltradas.length === 0) {
            html = `<tr><td colspan="5" class="text-center py-5 text-muted">No se encontraron bancos.</td></tr>`;
        }

        cuentasFiltradas.forEach(c => {
            const saldo = this.state.saldos[c.id] !== undefined ? this.state.saldos[c.id] : (this.state.saldos[c.nombre] || 0);
            const isEfectivo = (c.tipo || '').toLowerCase() === 'caja';
            const icon = isEfectivo ? 'bi-cash' : 'bi-bank';
            
            const isActivo = c.estado !== 'inactivo';
            const opacityStyle = isActivo ? '' : 'opacity: 0.6;';
            const badge = isActivo 
                ? '<span class="badge bg-success text-success bg-opacity-10 border border-success-subtle rounded-pill ms-2 fw-medium" style="font-size: var(--fs-xxs); padding: 4px 8px;">Activa</span>' 
                : '<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle rounded-pill ms-2 fw-medium" style="font-size: var(--fs-xxs); padding: 4px 8px;">Inactiva</span>';
            const actionBtnIcon = isActivo ? 'bi-pause-circle' : 'bi-play-circle';
            const actionBtnColor = isActivo ? 'text-danger' : 'text-success';
            const actionBtnTitle = isActivo ? 'Desactivar cuenta' : 'Activar cuenta';
            
            const tipoBadgeColor = isEfectivo ? 'bg-success text-success' : 'bg-primary text-primary';
            
            // Layout de Alegra: ícono gris tenue a la izquierda del nombre
            html += `
                <tr class="banco-row" data-id="${c.id}" style="cursor: pointer; font-size: var(--fs-base); color: var(--text-body); border-bottom: 1px solid var(--border-color); ${opacityStyle}">
                    <td class=\"py-2 ps-4 d-flex align-items-center\" style="white-space: nowrap;">
                        <div class="bg-light rounded-circle p-2 me-3 d-flex align-items-center justify-content-center text-muted" style="width: 32px; height: 32px; border: 1px solid #e2e8f0; flex-shrink: 0;">
                            <i class="bi ${icon}" style="font-size: var(--fs-md);"></i>
                        </div>
                        <span style="color: var(--text-main); font-weight: 500;">${c.nombre}</span>
                        ${badge}
                    </td>
                    <td class=\"py-2\" style="white-space: nowrap;"><span class="badge ${tipoBadgeColor} bg-opacity-10 border border-${isEfectivo?'success':'primary'}-subtle rounded-pill fw-medium" style="font-size: var(--fs-sm); padding: 5px 10px;">${c.tipo}</span></td>
                    <td class=\"py-2 font-monospace text-muted\" style="white-space: nowrap;">${c.numero || '-'}</td>
                    <td class=\"py-2\" style="color: var(--primary); font-weight: 500; white-space: nowrap;">${formatMoney(saldo)}</td>
                    <td class=\"py-2 pe-4\">
                        <div class="d-flex gap-2 align-items-center">
                            <button class="btn btn-sm btn-light border px-3 text-muted btn-conciliar" style="font-size: var(--fs-sm); font-weight: 500; border-radius: 4px;" onclick="event.stopPropagation(); window.location.hash='#/bancos/conciliacion?banco_id=${c.id}'">
                                Conciliar
                            </button>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-light border text-muted px-2 btn-abrir-menu-cuenta" data-bs-toggle="dropdown" aria-expanded="false" title="Más opciones" style="border-radius: 4px;">
                                    <i class="bi bi-three-dots-vertical"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end shadow border-0" style="font-size: var(--fs-base);">
                                    <li><a class="dropdown-item btn-editar-cuenta" href="javascript:void(0)" data-id="${c.id}" data-nombre="${c.nombre}" data-tipo="${c.tipo}" data-numero="${c.numero || ''}">Editar</a></li>
                                    <li><a class="dropdown-item ${actionBtnColor} btn-toggle-estado" href="javascript:void(0)" data-id="${c.id}" data-estado="${c.estado || 'activo'}">${actionBtnTitle}</a></li>
                                </ul>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = html;
    },

    renderChart(meses = 6) {
        const canvas = document.getElementById('chart-ingresos-gastos');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (this.state.chartInstance) {
            this.state.chartInstance.destroy();
        }

        // 1. Usar los datos de la base de datos
        const datos = this.state.datosGrafica || [];
        
        // 2. Preparar Data para Chart.js
        const labels = datos.map(m => m.mes);
        const dataIngresos = datos.map(m => m.ingresos || 0);
        const dataGastos = datos.map(m => m.egresos || 0);

        this.state.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: dataIngresos,
                        backgroundColor: '#2cbfb7', // Verde
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    },
                    {
                        label: 'Gastos',
                        data: dataGastos,
                        backgroundColor: '#e11d48', // Rojo suave
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 20,
                            font: { size: 12, family: "'Inter', sans-serif" }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { font: { size: 12 } }
                    },
                    y: {
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false,
                            borderDash: [5, 5]
                        },
                        ticks: {
                            font: { size: 11 },
                            callback: function(value) {
                                // Convertir a millones si es muy grande
                                if (value >= 1000000) {
                                    return '$' + (value / 1000000).toFixed(0) + 'M';
                                }
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
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
    }
};
