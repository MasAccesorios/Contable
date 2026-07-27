import DB from '../../core/db.js';

export const ConciliacionModule = {
    state: {
        transacciones: [],
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
        editingConciliacionMovimientos: []
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        this.state.bancoId = urlParams.get('banco_id');

        const hoy = new Date();
        this.state.fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
        this.state.fechaHasta = hoy.toISOString().split('T')[0];

        await this.loadData();
        this.renderBase();
        this.calcularTotales();
        this.renderTabla();
        this.renderHistorial();
        this.attachEvents();
    },

    async loadData() {
        const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
        this.state.cuentas = dbCuentas.filter(c => c.estado === 'activo');
        if (!this.state.bancoId && this.state.cuentas.length > 0) {
            this.state.bancoId = this.state.cuentas[0].id;
        }
        this.state.transacciones = await DB.getAll('transacciones') || [];
        this.state.historialConciliaciones = await DB.getAll('conciliaciones') || [];
    },

    formatMoney(val) {
        return '$' + (val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2});
    },

    calcularTotales() {
        if (!this.state.bancoId) return;

        let saldoAnterior = 0;
        let entradas = 0;
        let salidas = 0;
        this.state.movimientosRango = [];

        this.state.transacciones.forEach(t => {
            if (t.cuentaId !== this.state.bancoId) return;
            const fechaTx = (t.fecha || '').substring(0, 10);

            if (fechaTx < this.state.fechaDesde) {
                if (t.tipo === 'ingreso') saldoAnterior += t.monto;
                else if (t.tipo === 'egreso' || t.tipo === 'gasto') saldoAnterior -= t.monto;
            } else if (fechaTx >= this.state.fechaDesde && fechaTx <= this.state.fechaHasta) {
                this.state.movimientosRango.push(t);
                if (t.tipo === 'ingreso') entradas += t.monto;
                else if (t.tipo === 'egreso' || t.tipo === 'gasto') salidas += t.monto;
            }
        });

        this.state.saldoAnterior = saldoAnterior;
        this.state.entradas = entradas;
        this.state.salidas = salidas;

        // Actualizar UI
        this.element.querySelector('#concil-saldo-anterior').textContent = this.formatMoney(saldoAnterior);
        this.element.querySelector('#concil-entradas').textContent = this.formatMoney(entradas);
        this.element.querySelector('#concil-salidas').textContent = this.formatMoney(salidas);
        
        const saldoTotal = saldoAnterior + entradas - salidas;
        this.element.querySelector('#concil-saldo-total').textContent = this.formatMoney(saldoTotal);

        this.calcularDiferencia(saldoTotal);
    },

    calcularDiferencia(saldoTotalCalculado) {
        const difEl = this.element.querySelector('#concil-diferencia');
        const diferencia = this.state.saldoBancario - saldoTotalCalculado;
        difEl.textContent = this.formatMoney(diferencia);
        
        if (diferencia === 0) {
            difEl.style.color = '#2cbfb7';
        } else {
            difEl.style.color = '#ef4444';
        }
    },

    renderBase() {
        let opcionesCuentas = this.state.cuentas.map(c => 
            `<option value="${c.id}" ${c.id === this.state.bancoId ? 'selected' : ''}>${c.nombre}</option>`
        ).join('');

        this.element.innerHTML = `
            <div class="module-container p-4" style="max-width: 1200px; margin: 0 auto;">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Conciliación Bancaria</h2>
                        <p class="text-muted mb-0" style="font-size: 14px;">Concilia tus movimientos bancarios y mantén tu saldo exacto.</p>
                    </div>
                </div>

                <!-- Selector global de cuenta -->
                <div class="mb-4">
                    <label class="form-label text-muted" style="font-size: 12px; font-weight: 500;">Cuenta a conciliar</label>
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
                                <div class="row text-center mb-4">
                                    <div class="col-4 border-end">
                                        <p class="text-muted mb-1" style="font-size: 12px; font-weight: 500;">Saldo anterior</p>
                                        <h4 class="fw-bold mb-0" style="color: var(--text-main);" id="concil-saldo-anterior">$0,00</h4>
                                    </div>
                                    <div class="col-4 border-end">
                                        <p class="text-muted mb-1" style="font-size: 12px; font-weight: 500;">Entradas</p>
                                        <h4 class="fw-bold mb-0" style="color: #10b981;" id="concil-entradas">$0,00</h4>
                                    </div>
                                    <div class="col-4">
                                        <p class="text-muted mb-1" style="font-size: 12px; font-weight: 500;">Salidas</p>
                                        <h4 class="fw-bold mb-0" style="color: #ef4444;" id="concil-salidas">$0,00</h4>
                                    </div>
                                </div>
                                <div class="row align-items-center">
                                    <div class="col-4">
                                        <label class="text-muted mb-1 d-block" style="font-size: 12px; font-weight: 500;">Saldo bancario <i class="bi bi-info-circle"></i></label>
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text bg-light border-end-0">$</span>
                                            <input type="number" id="concil-input-saldo" class="form-control border-start-0 ps-0 text-dark fw-medium" placeholder="0.00" value="0">
                                        </div>
                                    </div>
                                    <div class="col-4 text-center">
                                        <p class="text-muted mb-1" style="font-size: 12px; font-weight: 500;">Saldo total</p>
                                        <h4 class="fw-bold mb-0" style="color: var(--text-main);" id="concil-saldo-total">$0,00</h4>
                                    </div>
                                    <div class="col-4 text-center">
                                        <p class="text-muted mb-1" style="font-size: 12px; font-weight: 500;">Diferencia</p>
                                        <h4 class="fw-bold mb-0" id="concil-diferencia" style="color: #ef4444;">$0,00</h4>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Tabla de Movimientos -->
                        <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                            <div class="card-body p-0">
                                <div class="table-responsive">
                                    <table class="table table-hover align-middle mb-0">
                                        <thead style="background-color: #f8fafc;">
                                            <tr>
                                                <th class="py-3 ps-4 text-muted" style="font-size: 12px; font-weight: 600;">Fecha</th>
                                                <th class="py-3 text-muted" style="font-size: 12px; font-weight: 600;">Descripción</th>
                                                <th class="py-3 text-muted" style="font-size: 12px; font-weight: 600;">Tipo</th>
                                                <th class="py-3 text-muted" style="font-size: 12px; font-weight: 600;">Monto</th>
                                                <th class="py-3 pe-4 text-center text-muted" style="font-size: 12px; font-weight: 600;">Conciliado</th>
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
                            <button id="btn-guardar-concil" class="btn text-white fw-medium shadow-sm px-4 py-2" style="background-color: #2cbfb7; border-radius: 6px;">
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
                                        <thead style="background-color: #f8fafc;">
                                            <tr>
                                                <th class="py-3 ps-4 text-muted" style="font-size: 12px; font-weight: 600;">Fecha Guardado</th>
                                                <th class="py-3 text-muted" style="font-size: 12px; font-weight: 600;">Rango de Fechas</th>
                                                <th class="py-3 text-muted" style="font-size: 12px; font-weight: 600;">Saldo Bancario</th>
                                                <th class="py-3 text-muted" style="font-size: 12px; font-weight: 600;">Diferencia</th>
                                                <th class="py-3 text-center text-muted" style="font-size: 12px; font-weight: 600;">Movs. Conciliados</th>
                                                <th class="py-3 pe-4 text-end text-muted" style="font-size: 12px; font-weight: 600;">Acciones</th>
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
                <tr style="font-size: 13px; color: var(--text-body);">
                    <td class="py-3 ps-4">${(m.fecha || '').substring(0, 10)}</td>
                    <td class="py-3 fw-medium" style="color: var(--text-main);">${m.detalle || m.referencia || m.descripcion || '-'}</td>
                    <td class="py-3">
                        <span class="badge" style="background-color: ${badgeBg}; color: ${badgeColor}; font-weight: 500;">
                            ${m.tipo.toUpperCase()}
                        </span>
                    </td>
                    <td class="py-3" style="font-weight: 500;">${this.formatMoney(m.monto)}</td>
                    <td class="py-3 pe-4 text-center">
                        <input class="form-check-input concil-check" type="checkbox" data-id="${m.id}" ${this.state.editingConciliacionMovimientos.includes(m.id) ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
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
            .filter(c => c.banco_id === this.state.bancoId)
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
                <tr style="font-size: 13px; color: var(--text-body);">
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
        this.element.querySelector('#concil-cuenta').addEventListener('change', (e) => {
            this.state.bancoId = e.target.value;
            this.calcularTotales();
            this.renderTabla();
            this.renderHistorial();
        });

        this.element.querySelector('#concil-desde').addEventListener('change', (e) => {
            this.state.fechaDesde = e.target.value;
            this.calcularTotales();
            this.renderTabla();
        });

        this.element.querySelector('#concil-hasta').addEventListener('change', (e) => {
            this.state.fechaHasta = e.target.value;
            this.calcularTotales();
            this.renderTabla();
        });

        this.element.querySelector('#concil-input-saldo').addEventListener('input', (e) => {
            this.state.saldoBancario = parseFloat(e.target.value) || 0;
            const saldoTotal = this.state.saldoAnterior + this.state.entradas - this.state.salidas;
            this.calcularDiferencia(saldoTotal);
        });

        this.element.querySelector('#btn-guardar-concil').addEventListener('click', async () => {
            const checks = this.element.querySelectorAll('.concil-check:checked');
            const movimientosConciliados = Array.from(checks).map(cb => cb.dataset.id);

            const concil = {
                id: this.state.editingConciliacionId || `concil_${Date.now()}`,
                banco_id: this.state.bancoId,
                fecha_desde: this.state.fechaDesde,
                fecha_hasta: this.state.fechaHasta,
                saldo_bancario: this.state.saldoBancario,
                saldo_sistema: this.state.saldoAnterior + this.state.entradas - this.state.salidas,
                diferencia: this.state.saldoBancario - (this.state.saldoAnterior + this.state.entradas - this.state.salidas),
                fecha_guardado: new Date().toISOString(),
                movimientos_conciliados: movimientosConciliados
            };

            try {
                await DB.save('conciliaciones', concil);
                this.state.editingConciliacionId = null;
                this.state.editingConciliacionMovimientos = [];
                alert('Conciliación guardada exitosamente.');
                // Redirigir a bancos
                window.location.hash = '#/bancos';
            } catch (error) {
                console.error("Error al guardar:", error);
                alert('Hubo un error al guardar la conciliación.');
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

                const movs = this.state.transacciones.filter(t => (concil.movimientos_conciliados || []).includes(t.id));
                let tableHtml = `
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr class="text-muted" style="font-size: 13px;">
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
                        <tr style="font-size: 13px;">
                            <td class="py-2">${(m.fecha || '').substring(0,10)}</td>
                            <td class="py-2 fw-medium">${m.detalle || m.referencia || m.descripcion || '-'}</td>
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
                this.state.editingConciliacionMovimientos = concil.movimientos_conciliados || [];

                // Llenar inputs
                const inputDesde = document.getElementById('concil-desde');
                const inputHasta = document.getElementById('concil-hasta');
                const inputSaldo = document.getElementById('concil-input-saldo');
                
                if (inputDesde) inputDesde.value = concil.fecha_desde;
                if (inputHasta) inputHasta.value = concil.fecha_hasta;
                if (inputSaldo) inputSaldo.value = concil.saldo_bancario;
                
                this.state.fechaDesde = concil.fecha_desde;
                this.state.fechaHasta = concil.fecha_hasta;
                this.state.saldoBancario = concil.saldo_bancario;
                
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
