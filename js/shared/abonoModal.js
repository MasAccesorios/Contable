// js/shared/abonoModal.js
import DB from '../core/db.js';
import { CoreActions } from './crud.js';

export const AbonoModal = {
    modalInstance: null,
    onSuccessCallback: null,
    currentSaldo: 0,
    facturaId: null,

    async show(facturaId, saldoPendiente, onSuccess) {
        this.facturaId = facturaId;
        this.currentSaldo = parseFloat(saldoPendiente) || 0;
        this.onSuccessCallback = onSuccess;

        // Inyectar el HTML solo si no existe en el DOM actual
        if (!document.getElementById('modalAbonoShared')) {
            const html = `
            <div class="modal fade" id="modalAbonoShared" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow" style="border-radius: 12px;">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="modal-title fw-bold">Registrar Abono</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body pt-3 pb-4">
                            <form id="form-abono-shared">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-medium">Monto a abonar</label>
                                    <div class="input-group">
                                        <span class="input-group-text bg-light border-end-0">$</span>
                                        <input type="number" step="any" id="abono-monto-shared" class="form-control border-start-0" required>
                                    </div>
                                    <div class="form-text text-danger" id="abono-hint-shared"></div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-medium">Fecha de pago</label>
                                    <input type="date" id="abono-fecha-shared" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label text-muted small fw-medium">Cuenta destino</label>
                                    <select id="abono-cuenta-shared" class="form-select" required></select>
                                </div>
                                <button type="submit" class="btn btn-primary w-100 fw-medium" style="background-color: #2cbfb7; border: none; padding: 10px;">Guardar Abono</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            this.bindEvents(); // Solo se ata el listener la primera vez que se inyecta
        }

        // Llenar cuentas dinámicamente desde Firestore
        const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
        const cuentasActivas = dbCuentas.filter(c => c.estado === 'activo');
        const selectCuenta = document.getElementById('abono-cuenta-shared');
        selectCuenta.innerHTML = cuentasActivas.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');

        // Prellenar datos
        document.getElementById('abono-monto-shared').value = this.currentSaldo;
        document.getElementById('abono-monto-shared').max = this.currentSaldo;
        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2});
        document.getElementById('abono-hint-shared').textContent = `Saldo pendiente: ${formatMoney(this.currentSaldo)}`;
        
        // Mostrar Modal
        if (!this.modalInstance) {
            this.modalInstance = new bootstrap.Modal(document.getElementById('modalAbonoShared'));
        }
        this.modalInstance.show();
    },

    bindEvents() {
        const form = document.getElementById('form-abono-shared');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const monto = parseFloat(document.getElementById('abono-monto-shared').value);
            const fecha = document.getElementById('abono-fecha-shared').value;
            const cuenta = document.getElementById('abono-cuenta-shared').value;

            if (monto <= 0 || monto > this.currentSaldo) {
                CoreActions.showWarningModal("El monto del abono es inválido o supera el saldo pendiente.");
                return;
            }

            const factura = await DB.get('facturas', this.facturaId);
            if (factura) {
                const transaccion = {
                    id: 'trx_' + Date.now(),
                    facturaId: factura.id, // Compatibilidad legado
                    referenciaId: factura.id,
                    tipo: 'ingreso',
                    monto: monto,
                    fecha: fecha,
                    referencia: `Abono a Fac. ${factura.numero || factura.id}`,
                    detalle: `Abono a Fac. ${factura.numero || factura.id}`,
                    cuenta: cuenta,
                    cuentaId: cuenta
                };
                
                await DB.save('transacciones', transaccion);
                
                this.modalInstance.hide();
                CoreActions.showWarningModal("Abono registrado exitosamente.");
                
                if (this.onSuccessCallback) {
                    this.onSuccessCallback(); // Gatillo para que Ventas o Cartera se recarguen
                }
            }
        });
    }
};
