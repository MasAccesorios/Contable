// js/shared/abonoModal.js
import DB, { getLocalDate } from './../core/db.js';
import { applyCurrencyFormatting, parseCurrencyValue } from './formatters.js';
import { CoreActions } from './crud.js';
import { calcularEstadoFactura } from './carteraUtils.js';

export const AbonoModal = {
    modalInstance: null,
    onSuccessCallback: null,
    currentSaldo: 0,
    facturaId: null,

    async show(facturaId, onSuccess) {
        this.facturaId = facturaId;
        this.onSuccessCallback = onSuccess;
        this.clienteId = null;

        let clienteNombre = 'N/A (Ve al formulario avanzado)';
        let numDoc = 'N/A';
        let facturaData = null;

        if (facturaId) {
            facturaData = await DB.get('facturas', facturaId);
            if (!facturaData) {
                CoreActions.showWarningModal("No se pudo cargar la información de la factura.");
                return;
            }

            const transacciones = await DB.getAll('transacciones') || [];
            const estadoDinamico = calcularEstadoFactura(facturaData, transacciones);
            this.currentSaldo = estadoDinamico.saldo;
            this.clienteId = facturaData.contacto_id || facturaData.clienteId;
            numDoc = facturaData.numero || facturaData.id;

            if (this.clienteId) {
                const cliente = await DB.get('contactos', this.clienteId);
                if (cliente) clienteNombre = cliente.nombre;
            }
        } else {
            this.currentSaldo = 0;
        }

        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2});

        // Eliminar modal anterior si existe para forzar recarga de UI
        const existingModal = document.getElementById('modalAbonoShared');
        if (existingModal) {
            existingModal.remove();
        }

        const html = `
        <div class="modal fade" id="modalAbonoShared" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 12px; max-width: 500px;">
                    <div class="modal-header border-0 pb-0 pt-4 px-4">
                        <h5 class="modal-title fw-bold" style="color: #1f2937;">Nuevo pago</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body pt-3 pb-4 px-4">
                        <div class="mb-4" style="font-size: 15px; color: #4b5563;">
                            <div class="mb-2"><span class="fw-bold" style="color: #374151;">Contacto:</span> ${clienteNombre}</div>
                            <div class="mb-2"><span class="fw-bold" style="color: #374151;">Número de venta:</span> ${numDoc}</div>
                            <div class="mt-3"><span class="fw-bold text-dark" style="font-size: 16px;">Valor por cobrar: <span style="color: #4b5563;">${formatMoney(this.currentSaldo)}</span></span></div>
                        </div>

                        <form id="form-abono-shared">
                            <div class="row mb-3 g-3">
                                <div class="col-6">
                                    <label class="form-label text-muted small fw-medium mb-1">Fecha</label>
                                    <div class="input-group">
                                        <span class="input-group-text bg-white border-end-0 text-muted" style="border-radius: 8px 0 0 8px;"><i class="bi bi-calendar3"></i></span>
                                        <input type="date" id="abono-fecha-shared" class="form-control border-start-0 ps-0" value="${getLocalDate()}" style="border-radius: 0 8px 8px 0; box-shadow: none;" required>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <label class="form-label text-muted small fw-medium mb-1">Cuenta bancaria</label>
                                    <select id="abono-cuenta-shared" class="form-select" style="border-radius: 8px; box-shadow: none;" required></select>
                                </div>
                            </div>
                            <div class="row mb-4 g-3">
                                <div class="col-6">
                                    <label class="form-label text-muted small fw-medium mb-1">Valor</label>
                                    <div class="input-group">
                                        <span class="input-group-text bg-white border-end-0 text-muted" style="border-radius: 8px 0 0 8px;">$</span>
                                        <input type="text" id="abono-monto-shared" class="form-control border-start-0 ps-0" style="border-radius: 0 8px 8px 0; box-shadow: none;" required>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <label class="form-label text-muted small fw-medium mb-1">Método de pago</label>
                                    <select id="abono-metodo-shared" class="form-select" style="border-radius: 8px; box-shadow: none;">
                                        <option value="transferencia">Transferencia</option>
                                        <option value="efectivo">Efectivo</option>
                                        <option value="tarjeta">Tarjeta</option>
                                    </select>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted small fw-medium mb-1">Nota</label>
                                <input type="text" id="abono-nota-shared" class="form-control" style="border-radius: 8px; box-shadow: none;">
                            </div>
                            
                            <div class="d-flex justify-content-between align-items-center mt-2 pt-3 border-top">
                                <a href="#" id="btn-abono-avanzado" class="text-decoration-none text-dark" style="font-size: 14px; font-weight: 500;"><i class="bi bi-arrow-up-right"></i> Ir al formulario avanzado</a>
                                <button type="submit" class="btn text-white px-4 py-2" style="background-color: #38bdf8; border: none; border-radius: 8px; font-weight: 500;">Agregar pago</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', html);
        this.bindEvents();
        
        // Llenar cuentas dinámicamente
        const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
        const cuentasActivas = dbCuentas.filter(c => c.estado === 'active' || c.activo === true);
        const selectCuenta = document.getElementById('abono-cuenta-shared');
        selectCuenta.innerHTML = cuentasActivas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        // Prellenar datos
        const montoInput = document.getElementById('abono-monto-shared');
        montoInput.value = this.currentSaldo.toString();
        applyCurrencyFormatting(montoInput);
        montoInput.max = this.currentSaldo;
        
        // Mostrar Modal
        this.modalInstance = new bootstrap.Modal(document.getElementById('modalAbonoShared'));
        this.modalInstance.show();
    },

    bindEvents() {
        const btnAvanzado = document.getElementById('btn-abono-avanzado');
        if (btnAvanzado) {
            btnAvanzado.addEventListener('click', (e) => {
                e.preventDefault();
                
                // 1. Guardar el ID del cliente estrictamente en sessionStorage
                if (this.clienteId) {
                    sessionStorage.setItem('clienteId', this.clienteId);
                }
                
                // Limpiar el estado visual del modal antes de saltar de vista
                if (this.modalInstance) {
                    this.modalInstance.hide();
                }
                document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
                document.body.classList.remove('modal-open');
                
                // 2. Ejecutar la redirección limpia
                window.location.hash = '#/ingresos/pagos/nuevo';
            });
        }

        const form = document.getElementById('form-abono-shared');
        const montoInput = document.getElementById('abono-monto-shared');
        if (montoInput) applyCurrencyFormatting(montoInput);

        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!this.facturaId) {
                CoreActions.showWarningModal('Para registrar un pago general o anticipo, por favor utiliza la opción «Ir al formulario avanzado» para seleccionar el cliente.');
                return;
            }
            
            const fecha = document.getElementById('abono-fecha-shared').value;
            const cuentaSelect = document.getElementById('abono-cuenta-shared');
            const cuentaId = cuentaSelect.value;
            const metodoPago = document.getElementById('abono-metodo-shared').value;
            let montoAbono = parseCurrencyValue(montoInput.value);
            const nota = document.getElementById('abono-nota-shared').value.trim();

            if (montoAbono <= 0 || montoAbono > this.currentSaldo) {
                CoreActions.showWarningModal("El monto del abono es inválido o supera el saldo pendiente.");
                return;
            }

            const factura = await DB.get('facturas', this.facturaId);
            if (factura) {
                const transaccion = {
                    id: 'trx_' + Date.now(),
                    factura_id: factura.id,
                    tipo: 'ingreso',
                    monto: montoAbono,
                    fecha: fecha,
                    cuenta_id: cuentaId
                };
                
                await DB.save('transacciones', transaccion);
                
                this.modalInstance.hide();
                CoreActions.showWarningModal("Abono registrado exitosamente.");
                
                if (this.onSuccessCallback) {
                    this.onSuccessCallback();
                }
            }
        });
        
        // Limpiar instancia al cerrar
        document.getElementById('modalAbonoShared').addEventListener('hidden.bs.modal', () => {
            this.modalInstance = null;
        });
    }
};
