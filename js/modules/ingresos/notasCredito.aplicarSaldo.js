import { supabase } from '../../core/supabase.js';
import { escapeHtml } from '../../shared/formatters.js';
import { CoreActions } from '../../shared/crud.js';

export const AplicarSaldoNCModal = {
    async abrir({ ncId, ncNumero, contactoId, clienteNombre, saldoAFavor, onSuccess }) {
        // Carga de facturas pendientes
        const { data: facturas, error } = await supabase.rpc('get_cartera_con_saldos', {
            p_tipo_cartera: 'cxc',
            p_contacto_id: String(contactoId)
        });

        if (error) {
            CoreActions.showErrorModal('Error al consultar facturas pendientes: ' + error.message);
            return;
        }

        if (!facturas || facturas.length === 0) {
            CoreActions.showWarningModal('El cliente no tiene facturas pendientes por cobrar.');
            return;
        }

        // Limpiar modal previo si existe
        const existingModal = document.getElementById('modalAplicarSaldoNC');
        if (existingModal) existingModal.remove();

        const saldoDisponibleNum = parseFloat(saldoAFavor) || 0;

        const modalHtml = `
            <div class="modal fade" id="modalAplicarSaldoNC" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered modal-lg">
                    <div class="modal-content border-0 shadow-lg" style="border-radius: 12px;">
                        <div class="modal-header border-0 pb-0 pt-4 px-4">
                            <div>
                                <h5 class="modal-title fw-bold" style="color: var(--text-main, #1f2937);">Aplicar Saldo a Favor - NC #${escapeHtml(String(ncNumero))}</h5>
                                <p class="text-muted small mb-0 mt-1">
                                    Cliente: <strong class="text-dark">${escapeHtml(clienteNombre || 'Sin cliente')}</strong>
                                    <span class="mx-2">•</span>
                                    Saldo a favor disponible: <strong class="text-success">$${saldoDisponibleNum.toLocaleString('es-CO')}</strong>
                                </p>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                        </div>
                        <div class="modal-body pt-3 pb-4 px-4">
                            <div class="dash-table-container mb-3">
                                <div class="table-responsive" style="max-height: 350px;">
                                    <table class="table table-borderless align-middle mb-0 tabla-pagos-multi">
                                        <thead>
                                            <tr style="border-bottom: 1px solid var(--border-color);">
                                                <th class="py-2 ps-3 fw-normal text-muted"># Factura</th>
                                                <th class="py-2 fw-normal text-muted">Fecha</th>
                                                <th class="py-2 fw-normal text-muted">Saldo Pendiente</th>
                                                <th class="py-2 text-end pe-3 fw-normal text-muted" style="width: 180px;">Monto a Aplicar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${facturas.map(f => {
                                                const saldoFac = parseFloat(f.saldo) || 0;
                                                return `
                                                    <tr style="border-bottom: 1px solid var(--border-color); font-size: var(--fs-base);">
                                                        <td data-label="Factura" class="align-middle fw-bold ps-3">#${escapeHtml(String(f.numero || f.id))}</td>
                                                        <td data-label="Fecha" class="align-middle text-muted">${escapeHtml(String(f.fecha || ''))}</td>
                                                        <td data-label="Saldo Pendiente" class="align-middle text-danger fw-bold">$${saldoFac.toLocaleString('es-CO')}</td>
                                                        <td data-label="Monto a Aplicar" class="align-middle text-end pe-3">
                                                            <input type="number" 
                                                                   step="any" 
                                                                   min="0" 
                                                                   max="${saldoFac}"
                                                                   inputmode="decimal" 
                                                                   class="form-control form-control-sm text-end input-monto-aplicar" 
                                                                   data-id="${f.id}" 
                                                                   data-saldo="${saldoFac}" 
                                                                   placeholder="0" 
                                                                   style="max-width: 150px; margin-left: auto;">
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded-3 border">
                                <div>
                                    <span class="text-muted small d-block">Total a aplicar:</span>
                                    <strong id="display-total-aplicar" class="fs-5 text-dark">$0</strong>
                                </div>
                                <div class="text-end">
                                    <span class="text-muted small d-block">Saldo restante:</span>
                                    <strong id="display-saldo-restante" class="fs-5 text-success">$${saldoDisponibleNum.toLocaleString('es-CO')}</strong>
                                </div>
                            </div>
                            <div id="alerta-error-aplicar" class="alert alert-danger py-2 px-3 small mt-3 d-none"></div>
                        </div>
                        <div class="modal-footer border-0 pt-0 pb-4 px-4">
                            <button type="button" class="btn btn-outline-secondary px-4 bg-white" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" id="btn-confirmar-aplicar-saldo" class="btn btn-primary-action px-4" disabled>
                                Aplicar Saldo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('modalAplicarSaldoNC');
        const modalInstance = new bootstrap.Modal(modalEl);
        modalInstance.show();

        const btnAplicar = modalEl.querySelector('#btn-confirmar-aplicar-saldo');
        const inputs = modalEl.querySelectorAll('.input-monto-aplicar');
        const displayTotal = modalEl.querySelector('#display-total-aplicar');
        const displayRestante = modalEl.querySelector('#display-saldo-restante');
        const alertError = modalEl.querySelector('#alerta-error-aplicar');

        const recalcular = () => {
            let totalAplicar = 0;
            let hayError = false;
            let mensajeError = '';

            inputs.forEach(inp => {
                const val = parseFloat(inp.value) || 0;
                const saldoMax = parseFloat(inp.dataset.saldo) || 0;

                if (val < 0) {
                    inp.classList.add('is-invalid');
                    hayError = true;
                    mensajeError = 'Los montos no pueden ser negativos.';
                } else if (val > saldoMax) {
                    inp.classList.add('is-invalid');
                    hayError = true;
                    mensajeError = `El monto en una factura supera su saldo pendiente ($${saldoMax.toLocaleString('es-CO')}).`;
                } else {
                    inp.classList.remove('is-invalid');
                }

                if (val > 0) {
                    totalAplicar += val;
                }
            });

            const saldoRestante = saldoDisponibleNum - totalAplicar;

            if (totalAplicar > saldoDisponibleNum) {
                hayError = true;
                mensajeError = `El total a aplicar ($${totalAplicar.toLocaleString('es-CO')}) supera el saldo a favor disponible ($${saldoDisponibleNum.toLocaleString('es-CO')}).`;
                displayRestante.classList.remove('text-success');
                displayRestante.classList.add('text-danger');
            } else {
                displayRestante.classList.remove('text-danger');
                displayRestante.classList.add('text-success');
            }

            displayTotal.textContent = '$' + totalAplicar.toLocaleString('es-CO');
            displayRestante.textContent = '$' + saldoRestante.toLocaleString('es-CO');

            if (hayError) {
                alertError.textContent = mensajeError;
                alertError.classList.remove('d-none');
                btnAplicar.disabled = true;
            } else {
                alertError.textContent = '';
                alertError.classList.add('d-none');
                btnAplicar.disabled = totalAplicar <= 0;
            }
        };

        inputs.forEach(inp => {
            inp.addEventListener('input', recalcular);
        });

        btnAplicar.addEventListener('click', async () => {
            const aplicaciones = [];
            inputs.forEach(inp => {
                const monto = parseFloat(inp.value) || 0;
                if (monto > 0) {
                    aplicaciones.push({
                        factura_id: parseInt(inp.dataset.id),
                        monto: monto
                    });
                }
            });

            if (aplicaciones.length === 0) return;

            btnAplicar.disabled = true;
            const oldBtnText = btnAplicar.innerHTML;
            btnAplicar.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Aplicando...';

            try {
                const { data: res, error: errRpc } = await supabase.rpc('aplicar_saldo_nota_credito', {
                    p_nc_id: parseInt(ncId),
                    p_aplicaciones: aplicaciones
                });

                if (errRpc) throw new Error(errRpc.message);

                modalInstance.hide();
                modalEl.remove();
                document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
                document.body.classList.remove('modal-open');

                const montoAplicado = res?.aplicado ? parseFloat(res.aplicado).toLocaleString('es-CO') : '';
                const restante = res?.saldo_restante !== undefined ? parseFloat(res.saldo_restante).toLocaleString('es-CO') : '';
                CoreActions.showSuccessModal(`Saldo aplicado con éxito: $${montoAplicado}. Saldo restante de la NC: $${restante}.`);

                if (typeof onSuccess === 'function') {
                    onSuccess();
                }
            } catch (err) {
                CoreActions.showErrorModal('Error aplicando saldo: ' + err.message);
            } finally {
                btnAplicar.disabled = false;
                btnAplicar.innerHTML = oldBtnText;
            }
        });

        modalEl.addEventListener('hidden.bs.modal', () => {
            modalEl.remove();
        });
    }
};
