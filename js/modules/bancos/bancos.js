// js/modules/tesoreria.js
import DB from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';
import { UI } from '../../shared/combobox.js';

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

    async init(element) {
        if (!element) return;

        element.innerHTML = `
            <div class="module-container p-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="h3 fw-bold text-dark mb-0">Tesorería (Caja y Bancos)</h2>
                    <div class="d-flex gap-2">
                        <button id="btn-nuevo-recaudo" class="btn btn-success">
                            <i class="bi bi-box-arrow-in-down me-1"></i>Recaudo (Ingreso)
                        </button>
                        <button id="btn-nuevo-egreso" class="btn btn-danger">
                            <i class="bi bi-box-arrow-up me-1"></i>Pago (Egreso)
                        </button>
                    </div>
                </div>

                <!-- Dashboard de Saldos -->
                <div id="dashboard-saldos" class="row g-3 mb-4"></div>

                <!-- Lista de Transacciones -->
                <div id="tesoreria-view-container" class="view-container"></div>
            </div>
        `;

        element.querySelector('#btn-nuevo-recaudo')?.addEventListener('click', () => this.renderFormRecaudo(element));
        element.querySelector('#btn-nuevo-egreso')?.addEventListener('click', () => this.renderFormEgreso(element));

        await this.renderDashboard(element);
        await this.renderTablaTransacciones(element);
    },

    async renderDashboard(element) {
        const container = element.querySelector('#dashboard-saldos');
        if (!container) return;

        const transacciones = await DB.getAll('transacciones');
        
        // Calcular saldos por cuenta
        const saldos = {};
        this.cuentasConfig.forEach(c => saldos[c.nombre] = 0);

        transacciones.forEach(t => {
            const cuenta = t.cuentaId || 'AAACaja general';
            if (saldos[cuenta] === undefined) saldos[cuenta] = 0;
            
            if (t.tipo === 'ingreso') {
                saldos[cuenta] += t.monto;
            } else if (t.tipo === 'egreso') {
                saldos[cuenta] -= t.monto;
            }
        });

        let totalConsolidado = 0;
        
        let html = `
        <div class="col-12">
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="table-light text-muted small">
                                <tr>
                                    <th class="ps-4">Nombre</th>
                                    <th>Tipo de cuenta</th>
                                    <th>Número de cuenta</th>
                                    <th class="text-end pe-4">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        this.cuentasConfig.forEach(c => {
            const saldo = saldos[c.nombre] || 0;
            totalConsolidado += saldo;
            let icon = c.tipo.toLowerCase() === 'efectivo' ? 'bi-cash-coin' : 'bi-bank';
            
            html += `
                <tr>
                    <td class="ps-4 py-3">
                        <div class="d-flex align-items-center">
                            <div class="bg-light rounded-circle p-2 me-3 text-secondary" style="width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
                                <i class="bi ${icon}"></i>
                            </div>
                            <span class="fw-semibold text-dark">${c.nombre}</span>
                        </div>
                    </td>
                    <td class="text-muted"><i class="bi bi-briefcase me-1"></i>${c.tipo}</td>
                    <td class="text-muted font-monospace">${c.numero}</td>
                    <td class="text-end pe-4 fw-bold ${saldo < 0 ? 'text-danger' : 'text-success'}">
                        $${saldo.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                </tr>
            `;
        });

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <div class="card border-0 shadow-sm bg-primary text-white">
                <div class="card-body d-flex justify-content-between align-items-center p-4">
                    <h5 class="mb-0 fw-bold">Saldo Consolidado Total</h5>
                    <h3 class="mb-0 fw-bold">$${totalConsolidado.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                </div>
            </div>
        </div>
        `;

        container.innerHTML = html;
    },

    async renderTablaTransacciones(element) {
        const container = element.querySelector('#tesoreria-view-container');
        if (!container) return;

        const transacciones = await DB.getAll('transacciones');
        transacciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (transacciones.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 bg-white rounded shadow-sm border border-light">
                    <i class="bi bi-cash-coin text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-3 mb-0">No hay movimientos de tesorería registrados.</p>
                </div>`;
            return;
        }

        let html = `
            <div class="card border-0 shadow-sm mt-2">
                <div class="card-header bg-white border-bottom py-3">
                    <h5 class="mb-0 fw-bold">Historial de Movimientos</h5>
                </div>
                <div class="table-responsive">
                    <table class="table align-middle mb-0">
                        <thead class="table-light text-muted font-monospace" style="font-size: 0.85rem;">
                            <tr>
                                <th class="px-4">Fecha</th>
                                <th>Cuenta</th>
                                <th>Tipo</th>
                                <th>Detalle</th>
                                <th>Ref. Documento</th>
                                <th class="text-end px-4">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        transacciones.forEach(t => {
            const isIngreso = t.tipo === 'ingreso';
            html += `
                <tr>
                    <td class="px-4">${t.fecha}</td>
                    <td><span class="badge bg-light text-dark border">${t.cuentaId || 'AAACaja general'}</span></td>
                    <td>
                        <span class="badge ${isIngreso ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill px-2 py-1 text-uppercase">
                            ${t.tipo}
                        </span>
                    </td>
                    <td>${t.detalle || 'N/A'}</td>
                    <td><code>${(t.referenciaId || '').split('_')[1] || t.referenciaId || '-'}</code></td>
                    <td class="text-end px-4 fw-bold ${isIngreso ? 'text-success' : 'text-danger'}">
                        ${isIngreso ? '+' : '-'}$${t.monto.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div></div>`;
        container.innerHTML = html;
    },

    async renderFormRecaudo(element) {
        const container = element.querySelector('#tesoreria-view-container');
        if (!container) return;
        
        // Hide dashboard when showing form
        const dashboard = element.querySelector('#dashboard-saldos');
        if (dashboard) dashboard.style.display = 'none';

        const contactos = await DB.getAll('contactos');
        const clientes = contactos.filter(c => c.tipo === 'cliente');

        container.innerHTML = `
            <div class="card border-0 shadow-sm max-width-md mx-auto" style="max-width: 800px;">
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                        <h4 class="card-title fw-bold text-success mb-0">
                            <i class="bi bi-box-arrow-in-down me-2"></i>Recaudo Multi-Factura
                        </h4>
                        <button id="btn-cancelar" class="btn btn-sm btn-light">Volver</button>
                    </div>
                    
                    <div id="tesoreria-alert" class="alert d-none mb-3 py-2"></div>
                    
                    <form id="form-recaudo">
                        <div class="row g-3 mb-4">
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-semibold">Cliente *</label>
                                <input type="text" id="search-recaudo-cliente" class="form-control" placeholder="Buscar cliente..." autocomplete="off" required>
                                <input type="hidden" id="recaudo-cliente" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-semibold">Cuenta de Ingreso *</label>
                                <select id="recaudo-cuenta" class="form-select" required>
                                    ${this.cuentasConfig.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-semibold">Monto Recibido ($) *</label>
                                <input type="number" step="any" id="recaudo-monto" class="form-control fw-bold text-success fs-5" required min="0.01">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-semibold">Fecha *</label>
                                <input type="date" id="recaudo-fecha" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                            </div>
                        </div>

                        <!-- Área de distribución automática -->
                        <div class="bg-light p-3 rounded border mb-4">
                            <h6 class="fw-bold mb-3">Facturas Pendientes del Cliente</h6>
                            <div class="table-responsive">
                                <table class="table table-sm align-middle mb-0">
                                    <thead class="text-muted small">
                                        <tr>
                                            <th>Factura</th>
                                            <th>Fecha</th>
                                            <th class="text-end">Total</th>
                                            <th class="text-end">Saldo Pend.</th>
                                            <th class="text-end text-success">Abono Aplicado</th>
                                        </tr>
                                    </thead>
                                    <tbody id="tbody-facturas-pendientes">
                                        <tr><td colspan="5" class="text-center text-muted">Seleccione un cliente para ver sus saldos pendientes.</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="d-flex justify-content-end">
                            <button type="submit" id="btn-guardar" class="btn btn-success px-5" disabled>
                                <i class="bi bi-check-lg me-1"></i>Procesar Recaudo
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const showAlert = (msg, type = 'danger') => {
            const alertEl = container.querySelector('#tesoreria-alert');
            if (!alertEl) return;
            alertEl.className = `alert alert-${type} mb-3 py-2`;
            alertEl.textContent = msg;
            alertEl.classList.remove('d-none');
            setTimeout(() => alertEl.classList.add('d-none'), 4000);
        };

        element.querySelector('#btn-cancelar')?.addEventListener('click', async () => {
            if (dashboard) dashboard.style.display = 'flex';
            await this.renderDashboard(element);
            await this.renderTablaTransacciones(element);
        });

        let facturasPendientes = [];
        let asignaciones = [];

        // Lógica interactiva de distribución multi-factura
        const recalcularDistribucion = () => {
            const montoInput = parseFloat(container.querySelector('#recaudo-monto').value) || 0;
            let montoRestante = montoInput;
            asignaciones = [];

            const tbody = container.querySelector('#tbody-facturas-pendientes');
            const btnGuardar = container.querySelector('#btn-guardar');

            if (facturasPendientes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">El cliente no tiene facturas con saldo pendiente.</td></tr>';
                btnGuardar.disabled = true;
                return;
            }

            btnGuardar.disabled = montoInput <= 0;
            let html = '';

            facturasPendientes.forEach(f => {
                let abono = 0;
                if (montoRestante > 0) {
                    abono = Math.min(f.saldoPendiente, montoRestante);
                    montoRestante -= abono;
                    if (abono > 0) {
                        asignaciones.push({ facturaId: f.id, abono });
                    }
                }

                html += `
                    <tr class="${abono > 0 ? 'table-success' : ''}">
                        <td><code>${f.id.split('_')[1] || f.id}</code></td>
                        <td>${f.fecha}</td>
                        <td class="text-end">$${f.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td class="text-end fw-bold">$${f.saldoPendiente.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td class="text-end fw-bold text-success">${abono > 0 ? '+$' + abono.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                    </tr>
                `;
            });

            if (montoRestante > 0) {
                html += `
                    <tr>
                        <td colspan="4" class="text-end fw-bold text-primary">SALDO A FAVOR (Anticipo):</td>
                        <td class="text-end fw-bold text-primary">+$${montoRestante.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                `;
                // Registraremos el anticipo genérico
                asignaciones.push({ facturaId: 'ANTICIPO', abono: montoRestante });
            }

            tbody.innerHTML = html;
        };

        // Función Helper: Carga de Facturas Pendientes
        const cargarFacturasPendientes = async (clienteId) => {
            if (!clienteId) {
                facturasPendientes = [];
                recalcularDistribucion();
                return;
            }

            // Fetch facturas and related transacciones to calculate real pending balance
            const facturas = await DB.getAll('facturas');
            const transacciones = await DB.getAll('transacciones');
            
            facturasPendientes = facturas
                .filter(f => f.clienteId === clienteId && f.tipo === 'venta')
                .map(f => {
                    // Sumar pagos previos referenciados a esta factura
                    const pagosRelacionados = transacciones
                        .filter(t => t.referenciaId === f.id && t.tipo === 'ingreso')
                        .reduce((sum, t) => sum + t.monto, 0);
                    
                    const saldoPendiente = f.total - pagosRelacionados;
                    return { ...f, saldoPendiente };
                })
                .filter(f => f.saldoPendiente > 0)
                .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)); // Cronológico FIFO

            recalcularDistribucion();
        };

        // Inicialización de Combobox de Clientes
        UI.createCombobox({
            inputEl: container.querySelector('#search-recaudo-cliente'),
            hiddenIdEl: container.querySelector('#recaudo-cliente'),
            items: clientes,
            displayProp: 'nombre',
            searchProps: ['nit', 'email'],
            allowCreate: false, // En recaudo el cliente ya debe existir
            onSelect: async (selectedItem) => {
                await cargarFacturasPendientes(selectedItem.id);
            }
        });

        container.querySelector('#recaudo-monto')?.addEventListener('input', recalcularDistribucion);

        container.querySelector('#form-recaudo')?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const clienteId = container.querySelector('#recaudo-cliente').value;
            if (!clienteId) {
                const searchInput = container.querySelector('#search-recaudo-cliente');
                searchInput.style.borderColor = '#ef4444';
                CoreActions.showWarningModal("Debes seleccionar un cliente válido de la lista.");
                setTimeout(() => searchInput.style.borderColor = '', 3000);
                return;
            }

            const btn = container.querySelector('#btn-guardar');
            btn.disabled = true;

            const cuentaId = container.querySelector('#recaudo-cuenta').value;
            const monto = parseFloat(container.querySelector('#recaudo-monto').value) || 0;
            const fecha = container.querySelector('#recaudo-fecha').value;

            try {
                // Registrar transacciones por cada asignación para claridad
                for (const asig of asignaciones) {
                    const transaccion = {
                        id: `trans_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        cuentaId: cuentaId,
                        tipo: 'ingreso',
                        monto: asig.abono,
                        fecha: fecha,
                        detalle: asig.facturaId === 'ANTICIPO' 
                            ? 'Anticipo / Saldo a favor del cliente' 
                            : `Abono a Factura #${asig.facturaId.split('_')[1] || asig.facturaId}`,
                        referenciaId: asig.facturaId
                    };
                    await DB.save('transacciones', transaccion);

                    // Actualizar estado de la factura si fue pagada en su totalidad
                    if (asig.facturaId !== 'ANTICIPO') {
                        const fac = await DB.get('facturas', asig.facturaId);
                        if (fac) {
                            const facPendiente = facturasPendientes.find(f => f.id === asig.facturaId);
                            if (facPendiente && (facPendiente.saldoPendiente - asig.abono <= 0.01)) {
                                fac.estado = 'paga';
                                await DB.save('facturas', fac);
                            }
                        }
                    }
                }

                showAlert('Recaudo procesado y distribuido exitosamente', 'success');
                setTimeout(async () => {
                    if (dashboard) dashboard.style.display = 'flex';
                    await this.renderDashboard(element);
                    await this.renderTablaTransacciones(element);
                }, 1500);
            } catch (err) {
                console.error(err);
                showAlert(err.message, 'danger');
                btn.disabled = false;
            }
        });
    },

    async renderFormEgreso(element) {
        const container = element.querySelector('#tesoreria-view-container');
        if (!container) return;
        
        const dashboard = element.querySelector('#dashboard-saldos');
        if (dashboard) dashboard.style.display = 'none';

        container.innerHTML = `
            <div class="card border-0 shadow-sm max-width-md mx-auto" style="max-width: 600px;">
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                        <h4 class="card-title fw-bold text-danger mb-0">
                            <i class="bi bi-box-arrow-up me-2"></i>Registrar Egreso
                        </h4>
                        <button id="btn-cancelar-egreso" class="btn btn-sm btn-light">Volver</button>
                    </div>
                    
                    <div id="egreso-alert" class="alert d-none mb-3 py-2"></div>
                    
                    <form id="form-egreso">
                        <div class="row g-3 mb-4">
                            <div class="col-md-12">
                                <label class="form-label text-muted small fw-semibold">Cuenta de Salida *</label>
                                <select id="egreso-cuenta" class="form-select" required>
                                    ${this.cuentasConfig.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-semibold">Monto a Pagar ($) *</label>
                                <input type="number" step="any" id="egreso-monto" class="form-control fw-bold text-danger fs-5" required min="0.01">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-semibold">Fecha *</label>
                                <input type="date" id="egreso-fecha" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                            </div>
                            <div class="col-md-12">
                                <label class="form-label text-muted small fw-semibold">Concepto / Detalle *</label>
                                <input type="text" id="egreso-detalle" class="form-control" placeholder="Ej. Pago orden a proveedor, Arriendo, etc." required>
                            </div>
                            <div class="col-md-12">
                                <label class="form-label text-muted small fw-semibold">Referencia (Opcional)</label>
                                <input type="text" id="egreso-ref" class="form-control" placeholder="Número de factura del proveedor, comprobante...">
                            </div>
                        </div>

                        <div class="d-flex justify-content-end">
                            <button type="submit" id="btn-guardar-egreso" class="btn btn-danger px-5">
                                <i class="bi bi-check-lg me-1"></i>Registrar Salida
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const showAlert = (msg, type = 'danger') => {
            const alertEl = container.querySelector('#egreso-alert');
            if (!alertEl) return;
            alertEl.className = `alert alert-${type} mb-3 py-2`;
            alertEl.textContent = msg;
            alertEl.classList.remove('d-none');
            setTimeout(() => alertEl.classList.add('d-none'), 4000);
        };

        element.querySelector('#btn-cancelar-egreso')?.addEventListener('click', async () => {
            if (dashboard) dashboard.style.display = 'flex';
            await this.renderDashboard(element);
            await this.renderTablaTransacciones(element);
        });

        element.querySelector('#form-egreso')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = container.querySelector('#btn-guardar-egreso');
            btn.disabled = true;

            const cuentaId = container.querySelector('#egreso-cuenta').value;
            const monto = parseFloat(container.querySelector('#egreso-monto').value) || 0;
            const fecha = container.querySelector('#egreso-fecha').value;
            const detalle = container.querySelector('#egreso-detalle').value;
            const ref = container.querySelector('#egreso-ref').value;

            try {
                const transaccion = {
                    id: `trans_${Date.now()}`,
                    cuentaId: cuentaId,
                    tipo: 'egreso',
                    monto: monto,
                    fecha: fecha,
                    detalle: detalle,
                    referenciaId: ref || ''
                };
                
                await DB.save('transacciones', transaccion);

                showAlert('Egreso registrado correctamente', 'success');
                setTimeout(async () => {
                    if (dashboard) dashboard.style.display = 'flex';
                    await this.renderDashboard(element);
                    await this.renderTablaTransacciones(element);
                }, 1500);
            } catch (err) {
                console.error(err);
                showAlert(err.message, 'danger');
                btn.disabled = false;
            }
        });
    }
};
