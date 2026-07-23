import DB from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';
import { TesoreriaModule } from '../bancos/bancos.js';

export default {
    async init(element) {
        if (!element) return;
        await this.renderList(element);
    },

    async renderList(element) {
        const facturasRaw = await DB.getAll('facturas');
        const contactos = await DB.getAll('contactos');
        
        // Solo facturas de venta pendientes
        const facturasPendientes = facturasRaw.filter(f => f.tipo === 'venta' && f.estado !== 'pagada' && f.estado !== 'anulada');
        
        const getCliente = (id) => contactos.find(c => c.id === id) || { nombre: 'Desconocido' };
        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        const html = `
            <div class="module-container p-4" style="max-width: 1100px; margin: 0 auto;">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="h3 fw-bold mb-0" style="color: var(--text-main);">Cartera (Cuentas por Cobrar)</h2>
                </div>

                <div class="card border-0 shadow-sm" style="border-radius: 8px;">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead style="background-color: #f8fafc; border-bottom: 1px solid var(--border-color);">
                                    <tr style="color: var(--text-muted); font-size: 13px; font-weight: var(--weight-medium);">
                                        <th class="ps-4 py-3">Factura</th>
                                        <th class="py-3">Cliente</th>
                                        <th class="py-3">Fecha Venc.</th>
                                        <th class="text-end py-3">Total</th>
                                        <th class="text-end py-3">Saldo Pendiente</th>
                                        <th class="text-center py-3 pe-4">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${facturasPendientes.length === 0 ? '<tr><td colspan="6" class="text-center py-4 text-muted">No hay facturas pendientes de cobro.</td></tr>' : 
                                    facturasPendientes.map(f => {
                                        const total = parseFloat(f.total) || 0;
                                        const saldo = parseFloat(f.saldo !== undefined ? f.saldo : total); // Si no hay saldo, es el total
                                        const cliente = getCliente(f.clienteId);
                                        
                                        // Comprobar si está vencida
                                        const isVencida = new Date(f.vencimiento) < new Date();
                                        const vencimientoClass = isVencida ? 'text-danger fw-bold' : '';

                                        return `
                                            <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);">
                                                <td class="ps-4 py-3 fw-medium">No. ${f.prefijo || ''}${f.numero || f.id}</td>
                                                <td class="py-3">${cliente.nombre}</td>
                                                <td class="py-3 ${vencimientoClass}">${f.vencimiento || 'N/A'} ${isVencida ? '(Vencida)' : ''}</td>
                                                <td class="py-3 text-end">${formatMoney(total)}</td>
                                                <td class="py-3 text-end fw-bold text-danger">${formatMoney(saldo)}</td>
                                                <td class="py-3 text-center pe-4">
                                                    <button class="btn btn-sm btn-primary px-3 rounded-pill btn-abonar" data-id="${f.id}" data-saldo="${saldo}">Registrar Abono</button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Modal de Abono -->
            <div class="modal fade" id="modalAbono" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow" style="border-radius: 12px;">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="modal-title fw-bold">Registrar Abono</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body pt-3 pb-4">
                            <form id="form-abono">
                                <input type="hidden" id="abono-factura-id">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-medium">Monto a abonar</label>
                                    <div class="input-group">
                                        <span class="input-group-text bg-light border-end-0">$</span>
                                        <input type="number" step="any" id="abono-monto" class="form-control border-start-0" required>
                                    </div>
                                    <div class="form-text text-danger" id="abono-hint"></div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-medium">Fecha de pago</label>
                                    <input type="date" id="abono-fecha" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label text-muted small fw-medium">Cuenta destino</label>
                                    <select id="abono-cuenta" class="form-select" required>
                                        ${TesoreriaModule.cuentasConfig.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                                    </select>
                                </div>
                                <button type="submit" class="btn btn-primary w-100 py-2" style="font-weight: 500; border-radius: 8px;">Confirmar Pago</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        element.innerHTML = html;

        // Lógica del modal
        let currentSaldo = 0;
        let abonoModal = null;
        if (window.bootstrap && window.bootstrap.Modal) {
            abonoModal = new bootstrap.Modal(document.getElementById('modalAbono'));
        }

        element.querySelectorAll('.btn-abonar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const facturaId = e.currentTarget.dataset.id;
                currentSaldo = parseFloat(e.currentTarget.dataset.saldo);
                
                element.querySelector('#abono-factura-id').value = facturaId;
                element.querySelector('#abono-monto').value = currentSaldo; // Sugerir pago total
                element.querySelector('#abono-monto').max = currentSaldo;
                element.querySelector('#abono-hint').textContent = `Saldo pendiente: ${formatMoney(currentSaldo)}`;
                
                if (abonoModal) abonoModal.show();
            });
        });

        element.querySelector('#form-abono')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const facturaId = element.querySelector('#abono-factura-id').value;
            const monto = parseFloat(element.querySelector('#abono-monto').value);
            const fecha = element.querySelector('#abono-fecha').value;
            const cuenta = element.querySelector('#abono-cuenta').value;

            if (monto <= 0 || monto > currentSaldo) {
                CoreActions.showWarningModal("El monto del abono es inválido o supera el saldo pendiente.");
                return;
            }

            // Procesar el pago
            const factura = await DB.get('facturas', facturaId);
            if (factura) {
                const total = parseFloat(factura.total) || 0;
                const saldoAnterior = parseFloat(factura.saldo !== undefined ? factura.saldo : total);
                const nuevoSaldo = saldoAnterior - monto;

                factura.saldo = nuevoSaldo;
                if (nuevoSaldo <= 0) {
                    factura.estado = 'pagada';
                } else {
                    factura.estado = 'parcial';
                }

                await DB.save('facturas', factura);

                // Registrar transacción (ingreso)
                const transaccion = {
                    id: 'trx_' + Date.now(),
                    facturaId: factura.id, // Backwards comp
                    referenciaId: factura.id, // Normalized
                    tipo: 'ingreso',
                    monto: monto,
                    fecha: fecha,
                    referencia: `Abono a Fac. ${factura.prefijo || ''}${factura.numero || factura.id}`, // Backwards comp
                    detalle: `Abono a Fac. ${factura.prefijo || ''}${factura.numero || factura.id}`, // Normalized
                    cuenta: cuenta, // Backwards comp
                    cuentaId: cuenta // Normalized
                };
                await DB.save('transacciones', transaccion);

                if (abonoModal) abonoModal.hide();
                CoreActions.showWarningModal("Abono registrado exitosamente.");
                
                // Recargar listado
                setTimeout(() => this.renderList(element), 500);
            }
        });
    }
};
