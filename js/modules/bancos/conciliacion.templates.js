import { supabase } from '../../core/supabase.js';
import { escapeHtml } from '../../shared/formatters.js';

export const ConciliacionTemplates = {
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
            `<option value="${c.id}" ${String(c.id) === String(this.state.bancoId) ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`
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
                    <td class="py-3 fw-medium" style="color: var(--text-main); white-space: nowrap;">${escapeHtml(m.detalle || m.referencia || m.descripcion || '-')}</td>
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
                <tr class="row-historial-concil" data-id="${h.id}" style="cursor: pointer; font-size: var(--fs-base); color: var(--text-body);">
                    <td class="py-3 ps-4 fw-medium text-muted">${fechaGuardadoStr}</td>
                    <td class="py-3 text-muted">${rango}</td>
                    <td class="py-3" style="font-weight: 500;">${this.formatMoney(h.saldo_bancario)}</td>
                    <td class="py-3" style="color: ${difColor}; font-weight: 600;">${this.formatMoney(h.diferencia)}</td>
                    <td class="py-3 text-center">
                        <span class="badge bg-light text-dark border">${cantMovs}</span>
                    </td>
                    <td class="py-3 pe-4 text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-sm btn-light border text-warning btn-editar-concil" data-id="${h.id}" title="Editar"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-light border text-danger btn-eliminar-concil" data-id="${h.id}" title="Eliminar"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    async renderDetalle(element, id) {
        const concil = this.state.historialConciliaciones.find(c => String(c.id) === String(id));
        if (!concil) {
            element.innerHTML = `<div class="p-5 text-center text-muted">Conciliación no encontrada.</div>`;
            return;
        }

        const cuenta = this.state.cuentas.find(c => String(c.id) === String(concil.banco_id));
        const bancoNombre = cuenta ? cuenta.nombre : 'Cuenta Desconocida';

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

        const dateObj = new Date(concil.fecha_guardado);
        const fechaGuardadoStr = dateObj.toLocaleDateString('es-CO') + ' ' + dateObj.toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'});
        
        let htmlRows = '';
        if (movs.length === 0) {
            htmlRows = `<tr><td colspan="4" class="text-center py-5 text-muted">No hay movimientos guardados en esta conciliación.</td></tr>`;
        } else {
            // Ordenar por fecha
            movs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(m => {
                const isIngreso = m.tipo === 'ingreso';
                const badgeBg = isIngreso ? '#d1fae5' : '#fee2e2';
                const badgeColor = isIngreso ? '#059669' : '#dc2626';

                htmlRows += `
                    <tr style="font-size: var(--fs-base); color: var(--text-body);">
                        <td class="py-3 ps-4" style="white-space: nowrap;">${(m.fecha || '').substring(0, 10)}</td>
                        <td class="py-3 fw-medium" style="color: var(--text-main);">${escapeHtml(m.detalle || m.referencia || '-')}</td>
                        <td class="py-3" style="white-space: nowrap;">
                            <span class="badge" style="background-color: ${badgeBg}; color: ${badgeColor}; font-weight: 500;">
                                ${m.tipo.toUpperCase()}
                            </span>
                        </td>
                        <td class="py-3 pe-4 text-end" style="font-weight: 500; white-space: nowrap;">${this.formatMoney(m.monto)}</td>
                    </tr>
                `;
            });
        }

        const isDifCero = Math.abs(concil.diferencia) < 1;
        const difColor = isDifCero ? 'var(--success)' : 'var(--danger)';

        element.innerHTML = `
            <div class="dash-layout p-4">
                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        <a href="#/bancos/conciliacion?banco_id=${concil.banco_id}" class="btn btn-sm btn-light border mb-3 text-muted fw-medium" style="border-radius: 6px;">
                            <i class="bi bi-arrow-left me-1"></i> Volver a Conciliación
                        </a>
                        <h2 class="h3 fw-bold mb-0" style="color: var(--text-main);">Detalle de Conciliación</h2>
                        <p class="text-muted mb-0 mt-1" style="font-size: var(--fs-md);">${bancoNombre}</p>
                    </div>
                </div>

                <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                    <div class="card-body p-4">
                        <div class="row align-items-center text-center">
                            <div class="col-3 border-end">
                                <p class="text-muted mb-1" style="font-size: var(--fs-sm); font-weight: 500;">Fecha Guardado</p>
                                <h5 class="fw-bold mb-0" style="color: var(--text-main);">${fechaGuardadoStr}</h5>
                            </div>
                            <div class="col-3 border-end">
                                <p class="text-muted mb-1" style="font-size: var(--fs-sm); font-weight: 500;">Rango</p>
                                <h5 class="fw-bold mb-0" style="color: var(--text-main);">${concil.fecha_desde} a ${concil.fecha_hasta}</h5>
                            </div>
                            <div class="col-3 border-end">
                                <p class="text-muted mb-1" style="font-size: var(--fs-sm); font-weight: 500;">Saldo Bancario</p>
                                <h5 class="fw-bold mb-0" style="color: var(--text-main);">${this.formatMoney(concil.saldo_bancario)}</h5>
                            </div>
                            <div class="col-3">
                                <p class="text-muted mb-1" style="font-size: var(--fs-sm); font-weight: 500;">Diferencia</p>
                                <h5 class="fw-bold mb-0" style="color: ${difColor};">${this.formatMoney(concil.diferencia)}</h5>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead style="background-color: var(--bg-main); white-space: nowrap;">
                                    <tr>
                                        <th class="py-3 ps-4 text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Fecha</th>
                                        <th class="py-3 text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Descripción</th>
                                        <th class="py-3 text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Tipo</th>
                                        <th class="py-3 pe-4 text-end text-muted" style="font-size: var(--fs-sm); font-weight: 600;">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${htmlRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
};
