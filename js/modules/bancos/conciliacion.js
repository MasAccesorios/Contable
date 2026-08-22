import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';

export const ConciliacionModule = {
    state: {
        cuentas: [],
        historialConciliaciones: [],
        bancoId: null,
        fechaDesde: '',
        fechaHasta: '',
        saldoAnterior: 0,
        entradas: 0,
        salidas: 0,
        saldoBancario: 0,
        movimientosRango: [],
        editingConciliacionId: null,
        saldoTotalSistema: 0,
        ajusteGastos: 0,
        ajusteImpuestos: 0,
        ajusteEntradas: 0
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        this.state.bancoId = urlParams.get('banco_id');

        const hoy = new Date();
        const hace3MesesDate = new Date(hoy);
        hace3MesesDate.setMonth(hace3MesesDate.getMonth() - 3);
        this.state.fechaDesde = getLocalDate(hace3MesesDate);
        this.state.fechaHasta = getLocalDate(hoy);

        await this.loadData();
        this.renderBase();
        await this.cargarDatosRPC();
        this.calcularTotales();
        this.renderTabla();
        this.renderHistorial();
        this.attachEvents();
    },

    async loadData() {
        const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
        this.state.cuentas = dbCuentas.filter(c => c.estado === 'active' || c.estado === 'activo');
        if (!this.state.bancoId && this.state.cuentas.length > 0) {
            this.state.bancoId = this.state.cuentas[0].id;
        }
        // transacciones ya NO se cargan en masa — se obtienen vía RPC por cuenta/rango
        this.state.historialConciliaciones = await DB.getAll('conciliaciones') || [];
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
    },

    formatMoney(val) {
        return '$' + (val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2});
    },

    calcularTotales() {
        if (!this.state.bancoId) return;
        // Los valores ya vienen calculados desde el RPC — solo actualizar la UI
        const { saldoAnterior, entradas, salidas } = this.state;
        this.element.querySelector('#concil-saldo-anterior').textContent = this.formatMoney(saldoAnterior);
        this.state.saldoTotalSistema = saldoAnterior + entradas - salidas;
        this.element.querySelector('#concil-saldo-total').textContent = this.formatMoney(this.state.saldoTotalSistema);
        this.recalcularDiferenciaPendiente();
    },

    recalcularDiferenciaPendiente() {
        const difEl = this.element.querySelector('#concil-diferencia');
        
        const staticDiff = this.state.saldoBancario - this.state.saldoTotalSistema;
        
        let sumaVisibleNoMarcada = 0;
        if (this.state.movimientosRango && this.state._seleccionados) {
            this.state.movimientosRango.forEach(m => {
                if (!this.state._seleccionados.has(m.id)) {
                    sumaVisibleNoMarcada += (m.tipo === 'ingreso' || m.tipo === 'in' ? Number(m.monto) : -Number(m.monto));
                }
            });
        }
        
        const diferenciaPendiente = staticDiff + sumaVisibleNoMarcada + this.state.ajusteGastos + this.state.ajusteImpuestos - this.state.ajusteEntradas;
        
        this.state.diferenciaActual = diferenciaPendiente;
        if (difEl) difEl.textContent = this.formatMoney(this.state.diferenciaActual);
        
        if (Math.abs(this.state.diferenciaActual) < 1) {
            if (difEl) difEl.style.color = '#2cbfb7';
        } else {
            if (difEl) difEl.style.color = '#ef4444';
        }
    },

    renderBase() {
        let opcionesCuentas = this.state.cuentas.map(c => 
            `<option value="${c.id}" ${String(c.id) === String(this.state.bancoId) ? 'selected' : ''}>${c.nombre}</option>`
        ).join('');

        this.element.innerHTML = `
            <div class="module-container p-4" style="max-width: 1200px; margin: 0 auto;">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Conciliación Bancaria</h2>
                        <p class="text-muted mb-0" style="font-size: var(--fs-md);">Concilia tus movimientos bancarios y mantén tu saldo exacto.</p>
                    </div>
                </div>

                <!-- Selector global de cuenta -->
                <div class="mb-4">
                    <label class="form-label text-muted" style="font-size: var(--fs-sm); font-weight: 500;">Cuenta a conciliar</label>
                    <select id="concil-cuenta" class="form-select border text-muted fw-medium" style="width: 250px; border-radius: 6px;">
                        ${opcionesCuentas}
                    </select>
                </div>

                <!-- Tabs -->
                <ul class="nav nav-tabs mb-4" id="concilTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active text-muted fw-medium" id="nueva-tab" data-bs-toggle="tab" data-bs-target="#nueva" type="button" role="tab" style="color: var(--text-main) !important;">Nueva Conciliación</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link text-muted fw-medium" id="historial-tab" data-bs-toggle="tab" data-bs-target="#historial" type="button" role="tab">Historial</button>
                    </li>
                </ul>

                <div class="tab-content" id="concilTabsContent">
                    <!-- Pestaña Nueva Conciliación -->
                    <div class="tab-pane fade show active" id="nueva" role="tabpanel">
                        <!-- Selectores de Fechas -->
                        <div class="d-flex gap-3 mb-4 flex-wrap">
                            <div class="d-flex align-items-center gap-2 bg-white border px-3 rounded-2 shadow-sm" style="height: 38px;">
                                <i class="bi bi-calendar text-muted"></i>
                                <input type="date" id="concil-desde" class="form-control border-0 bg-transparent text-muted text-sm shadow-none p-0" value="${this.state.fechaDesde}">
                                <span class="text-muted">-</span>
                                <input type="date" id="concil-hasta" class="form-control border-0 bg-transparent text-muted text-sm shadow-none p-0" value="${this.state.fechaHasta}">
                            </div>
                        </div>

                        <!-- Resumen (Estilo Alegra) -->
                        <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                            <div class="card-body p-4">
                                <div class="row align-items-center text-center" id="resumen-conciliacion-row">
                                    <div class="col-3 border-end">
                                        <p class="text-muted mb-1" style="font-size: var(--fs-sm); font-weight: 500;">Saldo anterior</p>
                                        <h4 class="fw-bold mb-0" style="color: var(--text-main);" id="concil-saldo-anterior">$0,00</h4>
                                    </div>
                                    <div class="col-3 border-end text-start px-4">
                                        <label class="text-muted mb-1 d-block" style="font-size: var(--fs-sm); font-weight: 500;">Saldo bancario (Extracto)</label>
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text bg-light border-end-0">$</span>
                                            <input type="text" id="concil-input-saldo" class="form-control border-start-0 ps-0 text-dark fw-medium" placeholder="0.00" value="0">
                                        </div>
                                    </div>
                                    <div class="col-3 border-end">
                                        <p class="text-muted mb-1" style="font-size: var(--fs-sm); font-weight: 500;">Saldo en sistema</p>
                                        <h4 class="fw-bold mb-0" style="color: var(--text-main);" id="concil-saldo-total">$0,00</h4>
                                    </div>
                                    <div class="col-3">
                                        <p class="text-muted mb-1" style="font-size: var(--fs-sm); font-weight: 500;">Diferencia</p>
                                        <div class="d-flex flex-column align-items-center justify-content-center">
                                            <h4 class="fw-bold mb-1" id="concil-diferencia" style="color: var(--danger);">$0,00</h4>
                                        </div>
                                    </div>
                                </div>
                                <div class="row align-items-center mt-3 pt-3 border-top">
                                    <div class="col-4 border-end text-start px-4">
                                        <label class="text-muted mb-1 d-block" style="font-size: var(--fs-sm); font-weight: 500;">Gastos bancarios</label>
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text bg-light border-end-0">$</span>
                                            <input type="text" id="concil-ajuste-gastos" class="form-control border-start-0 ps-0 text-dark fw-medium" placeholder="0.00" value="0">
                                        </div>
                                    </div>
                                    <div class="col-4 border-end text-start px-4">
                                        <label class="text-muted mb-1 d-block" style="font-size: var(--fs-sm); font-weight: 500;">Impuestos bancarios</label>
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text bg-light border-end-0">$</span>
                                            <input type="text" id="concil-ajuste-impuestos" class="form-control border-start-0 ps-0 text-dark fw-medium" placeholder="0.00" value="0">
                                        </div>
                                    </div>
                                    <div class="col-4 text-start px-4">
                                        <label class="text-muted mb-1 d-block" style="font-size: var(--fs-sm); font-weight: 500;">Entradas bancarias</label>
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text bg-light border-end-0">$</span>
                                            <input type="text" id="concil-ajuste-entradas" class="form-control border-start-0 ps-0 text-dark fw-medium" placeholder="0.00" value="0">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Tabla de Movimientos -->
                        <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                            <div class="card-body p-0">
                                <div class="table-responsive">
                                    <table class="table table-hover align-middle mb-0">
                                        <thead style="background-color: var(--bg-main); white-space: nowrap;">
                                            <tr>
                                                <th class="py-3 ps-4 text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Fecha</th>
                                                <th class="py-3 text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Descripción</th>
                                                <th class="py-3 text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Tipo</th>
                                                <th class="py-3 text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Monto</th>
                                                <th class="py-3 pe-4 text-center text-muted" style="font-size: var(--fs-sm); font-weight: 600;">
                                                    <input type="checkbox" id="chk-select-all" class="form-check-input me-1" title="Seleccionar todo" style="cursor: pointer;">
                                                    Conciliado
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody id="tbody-conciliacion">
                                            <!-- Inyectado vía JS -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="d-flex justify-content-end mb-5">
                            <button id="btn-guardar-concil" class="btn text-white fw-medium shadow-sm px-4 py-2" style="background-color: var(--primary); border-radius: 6px;">
                                Guardar conciliación
                            </button>
                        </div>
                    </div>

                    <!-- Pestaña Historial -->
                    <div class="tab-pane fade" id="historial" role="tabpanel">
                        <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                            <div class="card-body p-0">
                                <div class="table-responsive">
                                    <table class="table table-hover align-middle mb-0">
                                        <thead style="background-color: var(--bg-main);">
                                            <tr>
                                                <th class="py-3 ps-4 text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Fecha Guardado</th>
                                                <th class="py-3 text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Rango de Fechas</th>
                                                <th class="py-3 text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Saldo Bancario</th>
                                                <th class="py-3 text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Diferencia</th>
                                                <th class="py-3 text-center text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Movs. Conciliados</th>
                                                <th class="py-3 pe-4 text-end text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody id="tbody-historial">
                                            <!-- Inyectado vía JS -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Detalle Conciliacion -->
            <div class="modal fade" id="modal-detalle-conciliacion" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content border-0 shadow" style="border-radius: 12px;">
                        <div class="modal-header border-bottom-0 pb-0">
                            <h5 class="modal-title fw-bold" style="color: var(--text-main);">Detalle de Conciliación</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4" id="modal-detalle-body">
                            <!-- Inyectado via JS -->
                        </div>
                    </div>
                </div>
            </div>

        `;
    },

    renderTabla() {
        const tbody = this.element.querySelector('#tbody-conciliacion');
        let html = '';

        if (this.state.movimientosRango.length === 0) {
            html = `<tr><td colspan="5" class="text-center py-5 text-muted">No hay movimientos en este rango.</td></tr>`;
        }

        // Ordenar por fecha asc
        const movimientosStr = [...this.state.movimientosRango].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        movimientosStr.forEach(m => {
            const isIngreso = m.tipo === 'ingreso';
            const badgeBg = isIngreso ? '#d1fae5' : '#fee2e2';
            const badgeColor = isIngreso ? '#059669' : '#dc2626';

            html += `
                <tr style="font-size: var(--fs-base); color: var(--text-body);">
                    <td class="py-3 ps-4" style="white-space: nowrap;">${(m.fecha || '').substring(0, 10)}</td>
                    <td class="py-3 fw-medium" style="color: var(--text-main); white-space: nowrap;">${m.detalle || m.referencia || m.descripcion || '-'}</td>
                    <td class="py-3" style="white-space: nowrap;">
                        <span class="badge" style="background-color: ${badgeBg}; color: ${badgeColor}; font-weight: 500;">
                            ${m.tipo.toUpperCase()}
                        </span>
                    </td>
                    <td class="py-3" style="font-weight: 500; white-space: nowrap;">${this.formatMoney(m.monto)}</td>
                    <td class="py-3 pe-4 text-center" style="white-space: nowrap;">
                        <input class="form-check-input concil-check" type="checkbox" data-id="${m.id}" ${(this.state._seleccionados && this.state._seleccionados.has(m.id)) ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    renderHistorial() {
        const tbody = this.element.querySelector('#tbody-historial');
        if (!tbody) return;
        let html = '';

        const historialFiltrado = this.state.historialConciliaciones
            .filter(c => String(c.banco_id) === String(this.state.bancoId))
            .sort((a, b) => new Date(b.fecha_guardado) - new Date(a.fecha_guardado));

        if (historialFiltrado.length === 0) {
            html = `<tr><td colspan="5" class="text-center py-5 text-muted">No hay historial para esta cuenta.</td></tr>`;
        }

        historialFiltrado.forEach(h => {
            const dateObj = new Date(h.fecha_guardado);
            const fechaGuardadoStr = dateObj.toLocaleDateString('es-CO') + ' ' + dateObj.toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'});
            const rango = `${h.fecha_desde} a ${h.fecha_hasta}`;
            
            const isDiferenciaCero = h.diferencia === 0;
            const difColor = isDiferenciaCero ? '#059669' : '#dc2626';
            const cantMovs = h.movimientos_conciliados ? h.movimientos_conciliados.length : 0;

            html += `
                <tr style="font-size: var(--fs-base); color: var(--text-body);">
                    <td class="py-3 ps-4 fw-medium text-muted">${fechaGuardadoStr}</td>
                    <td class="py-3 text-muted">${rango}</td>
                    <td class="py-3" style="font-weight: 500;">${this.formatMoney(h.saldo_bancario)}</td>
                    <td class="py-3" style="color: ${difColor}; font-weight: 600;">${this.formatMoney(h.diferencia)}</td>
                    <td class="py-3 text-center">
                        <span class="badge bg-light text-dark border">${cantMovs}</span>
                    </td>
                    <td class="py-3 pe-4 text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-sm btn-light border text-primary btn-ver-concil" data-id="${h.id}" title="Ver detalle"><i class="bi bi-eye"></i></button>
                            <button class="btn btn-sm btn-light border text-warning btn-editar-concil" data-id="${h.id}" title="Editar"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-light border text-danger btn-eliminar-concil" data-id="${h.id}" title="Eliminar"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

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

        const _resetSeleccion = () => { 
            this.state._seleccionados = new Set(); 
            this.state.editingConciliacionId = null;
            
            this.state.ajusteGastos = 0;
            this.state.ajusteImpuestos = 0;
            this.state.ajusteEntradas = 0;
            
            const e1 = this.element.querySelector('#concil-ajuste-gastos');
            const e2 = this.element.querySelector('#concil-ajuste-impuestos');
            const e3 = this.element.querySelector('#concil-ajuste-entradas');
            if (e1) e1.value = '0';
            if (e2) e2.value = '0';
            if (e3) e3.value = '0';
        };

        this.element.querySelector('#nueva-tab')?.addEventListener('click', (e) => {
            // Solo actuar si el usuario hizo clic real (no si se invocó via JS desde "Editar")
            if (e.isTrusted) {
                _resetSeleccion();
                this.renderTabla();
            }
        });

        this.element.querySelector('#concil-cuenta').addEventListener('change', async (e) => {
            _resetSeleccion();
            this.state.bancoId = e.target.value;
            await this.cargarDatosRPC();
            this.calcularTotales();
            this.renderTabla();
            this.renderHistorial();
        });

        this.element.querySelector('#concil-desde').addEventListener('change', async (e) => {
            _resetSeleccion();
            this.state.fechaDesde = e.target.value;
            await this.cargarDatosRPC();
            this.calcularTotales();
            this.renderTabla();
        });

        this.element.querySelector('#concil-hasta').addEventListener('change', async (e) => {
            _resetSeleccion();
            this.state.fechaHasta = e.target.value;
            await this.cargarDatosRPC();
            this.calcularTotales();
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

            const payload = {
                p_id: this.state.editingConciliacionId || null,
                p_banco_id: parseInt(this.state.bancoId, 10),
                p_fecha_desde: this.state.fechaDesde,
                p_fecha_hasta: this.state.fechaHasta,
                p_saldo_bancario: this.state.saldoBancario,
                p_saldo_sistema: this.state.saldoAnterior + this.state.entradas - this.state.salidas,
                p_diferencia: this.state.saldoBancario - (this.state.saldoAnterior + this.state.entradas - this.state.salidas),
                p_movimientos_conciliados: movimientosConciliados
            };

            try {
                const { error } = await supabase.rpc('guardar_conciliacion_bancaria', payload);
                if (error) throw error;
                
                this.state.editingConciliacionId = null;
                alert('Conciliación guardada exitosamente.');
                // Redirigir a bancos
                window.location.hash = '#/bancos';
            } catch (error) {
                console.error("[Conciliacion] Error al guardar:", error);
                alert('Hubo un error al guardar la conciliación: ' + (error?.message || JSON.stringify(error)));
            }
        });

        // Eventos para la tabla de historial (Ver, Editar, Eliminar)
        this.element.querySelector('#tbody-historial')?.addEventListener('click', async (e) => {
            const btnVer = e.target.closest('.btn-ver-concil');
            const btnEditar = e.target.closest('.btn-editar-concil');
            const btnEliminar = e.target.closest('.btn-eliminar-concil');

            if (btnVer) {
                const id = btnVer.getAttribute('data-id');
                const concil = this.state.historialConciliaciones.find(c => c.id === id);
                if (!concil) return;

                // Lookup acotado por IDs — no escanea state.transacciones completo
                const ids = (concil.movimientos_conciliados || []).map(i => parseInt(i, 10)).filter(Boolean);
                let movs = [];
                if (ids.length > 0) {
                    const { data: movsData } = await supabase
                        .from('pagos_ingresos')
                        .select('id, fecha, observaciones, referencia, tipo, monto')
                        .in('id', ids);
                    movs = (movsData || []).map(m => ({
                        ...m,
                        tipo:   m.tipo === 'in' ? 'ingreso' : 'egreso',
                        detalle: m.observaciones || m.referencia || ''
                    }));
                }

                let tableHtml = `
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr class="text-muted" style="font-size: var(--fs-base);">
                                    <th>Fecha</th>
                                    <th>Detalle</th>
                                    <th class="text-end">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                if (movs.length === 0) {
                    tableHtml += `<tr><td colspan="3" class="text-center py-4 text-muted">No hay movimientos guardados en esta conciliación.</td></tr>`;
                } else {
                    movs.forEach(m => {
                        const esIngreso = m.tipo === 'ingreso';
                        tableHtml += `
                        <tr style="font-size: var(--fs-base);">
                            <td class="py-2">${(m.fecha || '').substring(0,10)}</td>
                            <td class="py-2 fw-medium">${m.detalle || m.referencia || '-'}</td>
                            <td class="py-2 text-end text-${esIngreso ? 'success' : 'danger'} fw-medium">${this.formatMoney(m.monto)}</td>
                        </tr>`;
                    });
                }
                tableHtml += `</tbody></table></div>`;

                const modalBody = document.getElementById('modal-detalle-body');
                if (modalBody) modalBody.innerHTML = tableHtml;

                const modalEl = document.getElementById('modal-detalle-conciliacion');
                if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                }
            }

            if (btnEditar) {
                const id = btnEditar.getAttribute('data-id');
                const concil = this.state.historialConciliaciones.find(c => c.id === id);
                if (!concil) return;

                this.state.editingConciliacionId = concil.id;
                this.state._seleccionados = new Set(
                    (concil.movimientos_conciliados || []).map(id => parseInt(id, 10)).filter(Boolean)
                );

                // Llenar inputs
                const inputDesde = document.getElementById('concil-desde');
                const inputHasta = document.getElementById('concil-hasta');
                const inputSaldo = document.getElementById('concil-input-saldo');
                
                if (inputDesde) inputDesde.value = concil.fecha_desde;
                if (inputHasta) inputHasta.value = concil.fecha_hasta;
                if (inputSaldo) {
                    inputSaldo.value = concil.saldo_bancario;
                    import('../../shared/formatters.js').then(fmt => fmt.applyCurrencyFormatting(inputSaldo));
                }
                
                this.state.fechaDesde = concil.fecha_desde;
                this.state.fechaHasta = concil.fecha_hasta;
                this.state.saldoBancario = concil.saldo_bancario;

                await this.cargarDatosRPC();
                this.calcularTotales();
                this.renderTabla();

                // Cambiar a la pestaña Nueva Conciliacion
                const tabBtn = document.getElementById('nueva-tab');
                if (tabBtn && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
                    const tab = new bootstrap.Tab(tabBtn);
                    tab.show();
                }
            }

            if (btnEliminar) {
                const id = btnEliminar.getAttribute('data-id');
                if (confirm("¿Seguro que deseas eliminar el registro de esta conciliación?\n(Los movimientos bancarios reales no se verán afectados)")) {
                    try {
                        await DB.delete('conciliaciones', id);
                        this.state.historialConciliaciones = await DB.getAll('conciliaciones') || [];
                        this.renderHistorial();
                    } catch (error) {
                        console.error(error);
                        alert("Error al eliminar la conciliación.");
                    }
                }
            }
        });
    }
};
