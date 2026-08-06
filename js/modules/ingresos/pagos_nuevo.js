import DB, { getLocalDate } from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';
import { supabase } from '../../core/supabase.js';
import { applyCurrencyFormatting, parseCurrencyValue } from '../../shared/formatters.js';

export default {
    async init(element) {
        if (!element) return;
        
        const clienteId = sessionStorage.getItem('clienteId');
        if (!clienteId) {
            CoreActions.showWarningModal('Por favor selecciona un cliente desde la vista de Cartera.');
            window.location.hash = '#/cartera';
            return;
        }

        this.clienteId = clienteId;
        this.facturasData = [];

        element.innerHTML = this.renderLoading();
        await this.loadData(element);
    },
    
    formatCurrency(val) {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(val);
    },

    renderLoading() {
        return `<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2">Cargando facturas pendientes...</p></div>`;
    },

    async loadData(element) {
        try {
            const cliente = await DB.get('contactos', this.clienteId);
            const cuentas = await DB.getAll('cuentas_bancarias') || [];
            
            // Cargar facturas del cliente usando RPC
            const { data: facturasPendientesRPC, error } = await supabase.rpc('get_cartera_con_saldos', { 
                p_tipo_cartera: 'cxc',
                p_contacto_id: String(this.clienteId)
            });
            if (error) console.error("Error fetching cartera para pagos:", error);
            
            this.facturasData = (facturasPendientesRPC || []).map(f => ({
                ...f, 
                totalAbonado: f.total_pagado 
            }));

            if (this.facturasData.length === 0) {
                element.innerHTML = `
                    <div class="py-5 px-4 text-center">
                        <div class="bg-white p-5 shadow-sm rounded border">
                            <h4 class="text-success mb-3"><i class="bi bi-check-circle-fill"></i> Cliente al día</h4>
                            <p>El cliente <strong>${cliente ? cliente.nombre : this.clienteId}</strong> no tiene facturas con saldo pendiente.</p>
                            <button onclick="window.location.hash='#/cartera'" class="btn btn-outline-secondary mt-3">Volver a Cartera</button>
                        </div>
                    </div>
                `;
                return;
            }

            this.deudaTotal = this.facturasData.reduce((sum, f) => sum + f.saldo, 0);

            this.renderUI(element, cliente, cuentas);
            this.attachEvents(element);

        } catch (error) {
            console.error("Error loading data:", error);
            element.innerHTML = `<div class="alert alert-danger m-4">Error cargando datos.</div>`;
        }
    },

    renderUI(element, cliente, cuentas) {
        const cuentasOptions = cuentas.map(c => `<option value="${c.id}">${c.nombre} (${c.tipo})</option>`).join('');
        const facturasRows = this.facturasData.map(f => `
            <tr>
                <td class="align-middle fw-bold">#${f.numero}</td>
                <td class="align-middle">${f.fecha}</td>
                <td class="align-middle">${this.formatCurrency(f.total)}</td>
                <td class="align-middle text-muted">${this.formatCurrency(f.totalAbonado)}</td>
                <td class="align-middle text-danger fw-bold">${this.formatCurrency(f.saldo)}</td>
                <td class="align-middle">
                    <div class="input-group input-group-sm" style="max-width: 150px; margin-left:auto;">
                        <span class="input-group-text">$</span>
                        <input type="text" class="form-control monto-abono text-end fw-bold" 
                            data-id="${f.id}" data-saldo="${f.saldo}" value="0">
                    </div>
                </td>
            </tr>
        `).join('');

        element.innerHTML = `
            <div class="container-fluid py-4" style="font-family: 'Inter', sans-serif;">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <button onclick="window.location.hash='#/cartera'" class="btn btn-outline-secondary btn-sm rounded-pill mb-2">
                            <i class="bi bi-arrow-left"></i> Volver a Cartera
                        </button>
                        <h2 class="fw-bold mb-0 text-dark">Registrar Pagos Multi-Factura</h2>
                    </div>
                </div>

                <div class="row g-4">
                    <!-- Columna Izquierda: Configuración del Pago -->
                    <div class="col-lg-4">
                        <div class="card border-0 shadow-sm rounded-4 mb-4">
                            <div class="card-body p-4 bg-light rounded-4">
                                <h6 class="text-uppercase text-muted fw-bold mb-1" style="font-size: 12px;">Cliente</h6>
                                <h4 class="fw-bold text-dark mb-3">${cliente ? cliente.nombre : 'Cliente Desconocido'}</h4>
                                <div class="d-flex justify-content-between border-top pt-3">
                                    <span class="text-muted">Deuda Total:</span>
                                    <span class="fw-bold text-danger fs-5">${this.formatCurrency(this.deudaTotal)}</span>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4">
                            <div class="card-body p-4">
                                <h5 class="fw-bold mb-4">Detalles del Recibo</h5>
                                
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-bold">Cuenta de Destino</label>
                                    <select id="pago-cuenta" class="form-select border-2 bg-light">
                                        ${cuentasOptions}
                                    </select>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-bold">Método de Pago</label>
                                    <select id="pago-metodo" class="form-select border-2 bg-light">
                                        <option value="transferencia">Transferencia</option>
                                        <option value="efectivo">Efectivo</option>
                                        <option value="tarjeta">Tarjeta</option>
                                        <option value="otro">Otro</option>
                                    </select>
                                </div>

                                <div class="mb-4">
                                    <label class="form-label text-muted small fw-bold">Fecha de Pago</label>
                                    <input type="date" id="pago-fecha" class="form-control border-2 bg-light" value="${getLocalDate()}">
                                </div>

                                <div class="p-3 bg-success bg-opacity-10 rounded-3 mb-4 text-center border border-success border-opacity-25">
                                    <h6 class="text-success fw-bold mb-1">TOTAL A RECIBIR</h6>
                                    <h2 id="total-recibir-display" class="fw-bold text-success mb-0">$0.00</h2>
                                </div>

                                <button id="btn-registrar" class="btn btn-success w-100 py-3 rounded-3 fw-bold fs-6" disabled>
                                    <i class="bi bi-check-circle me-2"></i>Registrar Pagos
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Columna Derecha: Tabla de Facturas -->
                    <div class="col-lg-8">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-header bg-white border-bottom p-4 rounded-top-4">
                                <h5 class="fw-bold mb-0">Facturas Pendientes</h5>
                            </div>
                            <div class="card-body p-0">
                                <div class="table-responsive">
                                    <table class="table table-hover align-middle mb-0">
                                        <thead class="table-light">
                                            <tr>
                                                <th class="ps-4"># Factura</th>
                                                <th>Fecha</th>
                                                <th>Total Orig.</th>
                                                <th>Abonado</th>
                                                <th>Saldo Pendiente</th>
                                                <th class="text-end pe-4">Monto a Pagar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${facturasRows}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="card-footer bg-light p-3 text-end text-muted small rounded-bottom-4">
                                Digite el monto a abonar en la casilla correspondiente a cada factura.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    attachEvents(element) {
        const inputs = element.querySelectorAll('.monto-abono');
        const display = element.querySelector('#total-recibir-display');
        const btnRegistrar = element.querySelector('#btn-registrar');

        // Sumar dinámicamente
        const updateSum = () => {
            let sum = 0;
            inputs.forEach(input => {
                let val = parseCurrencyValue(input.value);
                let max = parseFloat(input.getAttribute('data-saldo')) || 0;
                
                // Autocorrección si el usuario digita más del saldo
                if (val > max) { val = max; input.value = val; applyCurrencyFormatting(input); }
                if (val < 0) { val = 0; input.value = 0; }
                
                sum += val;
            });
            display.innerText = this.formatCurrency(sum);
            btnRegistrar.disabled = sum <= 0;
        };

        inputs.forEach(input => {
            applyCurrencyFormatting(input);
            input.addEventListener('input', updateSum);
            input.addEventListener('focus', function() { this.select(); });
        });

        // Registrar
        btnRegistrar.addEventListener('click', async () => {
            const cuentaId = element.querySelector('#pago-cuenta').value;
            const metodo = element.querySelector('#pago-metodo').value;
            const fecha = element.querySelector('#pago-fecha').value;

            if (!cuentaId) {
                CoreActions.showWarningModal("Debe seleccionar una cuenta bancaria destino.");
                return;
            }

            const abonos = [];
            inputs.forEach(input => {
                const val = parseCurrencyValue(input.value);
                if (val > 0) {
                    abonos.push({
                        factura_id: input.getAttribute('data-id'),
                        monto: val
                    });
                }
            });

            if (abonos.length === 0) return;

            btnRegistrar.disabled = true;
            btnRegistrar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

            try {
                // Registrar cada pago de forma iterativa y limpia
                const grupoPagoId = 'pago_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
                for (const abono of abonos) {
                    const transaccion = {
                        id: 'trx_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
                        factura_id: parseInt(abono.factura_id, 10),
                        contacto_id: parseInt(this.clienteId, 10),
                        grupo_pago_id: grupoPagoId,
                        tipo: 'ingreso',
                        monto: parseFloat(abono.monto),
                        fecha: fecha,
                        cuenta_id: parseInt(cuentaId, 10)
                    };
                    await DB.save('transacciones', transaccion);
                    
                    // Actualizar estado de factura si llega a 0 (Opcional, pero para mantener la UI limpia si recargan)
                    const fId = abono.factura_id;
                    const facturaData = await DB.get('facturas', fId);
                    if (facturaData) {
                        const inputRow = element.querySelector(`.monto-abono[data-id="${fId}"]`);
                        const saldoAntiguo = parseFloat(inputRow.getAttribute('data-saldo'));
                        if (abono.monto >= saldoAntiguo) {
                            facturaData.estado = 'closed';
                            await DB.save('facturas', facturaData);
                        } else {
                            facturaData.estado = 'parcial';
                            await DB.save('facturas', facturaData);
                        }
                    }
                }

                CoreActions.showWarningModal(`¡Se han registrado ${abonos.length} abonos exitosamente!`);
                window.location.hash = '#/cartera';
                
            } catch (error) {
                console.error("Error guardando transacciones:", error);
                CoreActions.showWarningModal("Error al procesar el guardado de transacciones.");
                btnRegistrar.disabled = false;
                btnRegistrar.innerHTML = '<i class="bi bi-check-circle me-2"></i>Registrar Pagos';
            }
        });
    }
};
