// js/shared/abonoModal.js
import DB, { getLocalDate, mapPagoATransaccion } from './../core/db.js';
import { supabase } from './../core/supabase.js';
import { applyCurrencyFormatting, parseCurrencyValue, escapeHtml } from './formatters.js';
import { CoreActions } from './crud.js';
import { calcularEstadoFactura } from './carteraUtils.js';

function getThirdPartyAvatar(name, isIngreso) {
    if (!name || name === '-' || name.includes('N/A')) {
        return { initials: '?', bg: '#f1f5f9', color: '#64748b' };
    }
    const clean = name.trim();
    const parts = clean.split(/\s+/);
    let initials = parts[0][0] || '';
    if (parts.length > 1 && parts[1][0]) initials += parts[1][0];
    initials = initials.toUpperCase();

    const colorsIngreso = [
        { bg: '#eff6ff', color: '#1d4ed8' },
        { bg: '#ecfdf5', color: '#059669' },
        { bg: '#e0f2fe', color: '#0369a1' },
        { bg: '#fef3c7', color: '#d97706' },
        { bg: '#ccfbf1', color: '#0f766e' }
    ];
    const colorsGasto = [
        { bg: '#fef2f2', color: '#dc2626' },
        { bg: '#fff7ed', color: '#ea580c' },
        { bg: '#fef3c7', color: '#d97706' },
        { bg: '#f3e8ff', color: '#7e22ce' },
        { bg: '#f1f5f9', color: '#475569' }
    ];
    const palette = isIngreso ? colorsIngreso : colorsGasto;
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % palette.length;
    return { initials: initials.substring(0, 2), ...palette[index] };
}

function formatFechaCorta(fechaStr) {
    if (!fechaStr) return '-';
    const parts = String(fechaStr).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return fechaStr;
}

export const AbonoModal = {
    modalInstance: null,
    onSuccessCallback: null,
    currentSaldo: 0,
    facturaId: null,
    clienteId: null,
    esIngreso: true,
    facturasCartera: [],
    deudaTotalCliente: 0,
    modoDistribucion: 'single', // 'single' | 'multi'

    async show(facturaId, onSuccess, precalculatedSaldo = null) {
        this.facturaId = facturaId;
        this.onSuccessCallback = onSuccess;
        this.clienteId = null;
        this.facturasCartera = [];
        this.deudaTotalCliente = 0;
        this.modoDistribucion = 'single';

        let clienteNombre = 'N/A';
        let numDoc = 'N/A';
        let facturaData = null;

        if (facturaId) {
            facturaData = await DB.get('facturas', facturaId);
            if (!facturaData) {
                CoreActions.showWarningModal("No se pudo cargar la información de la factura.");
                return;
            }

            this.esIngreso = !(facturaData.tipo === 'compra' || facturaData.tipo === 'gasto');

            if (precalculatedSaldo !== null && precalculatedSaldo !== undefined) {
                this.currentSaldo = precalculatedSaldo;
            } else {
                const { data: pagosRaw, error: errPagos } = await supabase
                    .from('pagos_ingresos')
                    .select('*')
                    .eq('factura_id', facturaId);
                if (errPagos) {
                    console.error('[AbonoModal] Error obteniendo pagos de la factura:', errPagos);
                }
                const transacciones = (pagosRaw || []).map(item => mapPagoATransaccion(item));
                const estadoDinamico = calcularEstadoFactura(facturaData, transacciones);
                this.currentSaldo = estadoDinamico.saldo;
            }

            this.clienteId = facturaData.contacto_id || facturaData.clienteId;
            numDoc = facturaData.numero || facturaData.id;

            if (this.clienteId) {
                const cliente = await DB.get('contactos', this.clienteId);
                if (cliente) clienteNombre = cliente.nombre;

                // Cargar todas las facturas pendientes de este cliente/proveedor
                try {
                    const tipoCartera = this.esIngreso ? 'cxc' : 'cxp';
                    const { data: carteraData, error: errCartera } = await supabase.rpc('get_cartera_con_saldos', {
                        p_tipo_cartera: tipoCartera,
                        p_contacto_id: String(this.clienteId)
                    });
                    if (!errCartera && Array.isArray(carteraData)) {
                        this.facturasCartera = carteraData
                            .filter(f => (f.saldo || 0) > 0.01)
                            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                        this.deudaTotalCliente = this.facturasCartera.reduce((acc, f) => acc + (f.saldo || 0), 0);
                    }
                } catch (e) {
                    console.error('[AbonoModal] Error cargando cartera del contacto:', e);
                }
            }
        } else {
            this.currentSaldo = 0;
            this.esIngreso = true;
        }

        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const avatar = getThirdPartyAvatar(clienteNombre, this.esIngreso);
        const tieneMultiples = this.facturasCartera.length > 1;

        // Eliminar modal anterior si existe para forzar recarga de UI
        const existingModal = document.getElementById('modalAbonoShared');
        if (existingModal) {
            existingModal.remove();
        }

        const html = `
        <div class="modal fade" id="modalAbonoShared" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-dialog-centered modal-lg" id="modalAbonoDialog" style="transition: max-width 0.25s ease;">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden; background: #ffffff;">
                    <!-- HEADER ESTILO GASTOS OPERATIVOS -->
                    <div class="modal-header border-bottom px-3 px-sm-4 py-3 bg-white d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center gap-2.5">
                            <div class="payment-kpi-icon ${this.esIngreso ? 'in-bg' : 'out-bg'}" style="width: 38px; height: 38px; font-size: 17px; border-radius: 10px;">
                                <i class="bi ${this.esIngreso ? 'bi-arrow-down-left' : 'bi-arrow-up-right'}"></i>
                            </div>
                            <div>
                                <h5 class="modal-title fw-bold mb-0" style="color: var(--text-main); font-size: 16px;">
                                    ${this.esIngreso ? 'Registrar Pago de Cliente' : 'Registrar Pago a Proveedor'}
                                </h5>
                                <p class="text-muted mb-0" style="font-size: 11px;">
                                    ${this.esIngreso ? 'Abono directo a factura o distribución inteligente en cartera.' : 'Registro de egreso y aplicación de pago a facturas.'}
                                </p>
                            </div>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>

                    <div class="modal-body p-3 p-sm-4" style="background-color: #f8fafc;">
                        <!-- TARJETA EJECUTIVA DE CONTACTO Y FACTURA (ESTILO PAYMENT-KPI-CARD) -->
                        <div class="card border rounded-3 p-3 mb-3 bg-white shadow-xs" style="border-color: var(--border-color);">
                            <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 38px; height: 38px;">
                                        ${avatar.initials}
                                    </div>
                                    <div>
                                        <div class="fw-bold" style="color: var(--text-main); font-size: 14px;">${escapeHtml(clienteNombre)}</div>
                                        <div class="text-muted" style="font-size: 12px;">
                                            Factura actual: <span class="payment-code-badge">#${numDoc}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="text-sm-end">
                                    <div class="text-muted" style="font-size: 11px; text-transform: uppercase; font-weight: 600;">Saldo factura #${numDoc}</div>
                                    <div class="fw-bold text-danger tnum" style="font-size: 18px;">${formatMoney(this.currentSaldo)}</div>
                                </div>
                            </div>

                            ${tieneMultiples ? `
                            <div class="mt-2 pt-2 border-top d-flex flex-wrap justify-content-between align-items-center gap-2" style="font-size: 12px;">
                                <div class="text-secondary" style="font-size: 11px;">
                                    <i class="bi bi-info-circle text-primary me-1"></i>
                                    Tiene <strong>${this.facturasCartera.length} facturas pendientes</strong> (Total: <strong>${formatMoney(this.deudaTotalCliente)}</strong>).
                                </div>
                                <div class="payment-tabs-bar p-1" style="background-color: #f1f5f9; border-radius: 8px;">
                                    <button type="button" class="payment-tab-btn active" id="tab-abono-single" style="padding: 4px 10px; font-size: 11px;">
                                        <i class="bi bi-file-earmark-check"></i> Solo #${numDoc}
                                    </button>
                                    <button type="button" class="payment-tab-btn" id="tab-abono-multi" style="padding: 4px 10px; font-size: 11px;">
                                        <i class="bi bi-layers"></i> Distribuir cartera
                                    </button>
                                </div>
                            </div>
                            ` : ''}
                        </div>

                        <!-- FORMULARIO PRINCIPAL -->
                        <form id="form-abono-shared">
                            <div class="card border rounded-3 p-3 bg-white shadow-xs mb-3" style="border-color: var(--border-color);">
                                <div class="row g-3 mb-2">
                                    <div class="col-12 col-sm-6">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Fecha del Pago *</label>
                                        <div class="input-group">
                                            <span class="input-group-text bg-light border-end-0 text-muted" style="border-radius: 8px 0 0 8px;"><i class="bi bi-calendar3"></i></span>
                                            <input type="date" id="abono-fecha-shared" class="form-control border-start-0" value="${getLocalDate()}" style="border-radius: 0 8px 8px 0; font-size: 13px;" required>
                                        </div>
                                    </div>
                                    <div class="col-12 col-sm-6">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Cuenta Bancaria / Caja Destino *</label>
                                        <select id="abono-cuenta-shared" class="form-select" style="border-radius: 8px; font-size: 13px;" required></select>
                                    </div>
                                </div>

                                <div class="row g-3 mb-2">
                                    <div class="col-12 col-sm-6">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Valor Total Recibido *</label>
                                        <div class="input-group">
                                            <span class="input-group-text bg-light border-end-0 text-muted fw-bold" style="border-radius: 8px 0 0 8px;">$</span>
                                            <input type="text" id="abono-monto-shared" class="form-control border-start-0 fw-bold ${this.esIngreso ? 'text-success' : 'text-danger'} tnum" style="border-radius: 0 8px 8px 0; font-size: 15px;" required autocomplete="off" inputmode="decimal">
                                        </div>
                                        <div class="form-text mt-1 text-muted" id="abono-monto-help" style="font-size: 11px;">
                                            Saldo pendiente de esta factura: ${formatMoney(this.currentSaldo)}
                                        </div>
                                    </div>
                                    <div class="col-12 col-sm-6">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Método de Pago *</label>
                                        <select id="abono-metodo-shared" class="form-select" style="border-radius: 8px; font-size: 13px;">
                                            <option value="transferencia">Transferencia Bancaria</option>
                                            <option value="efectivo">Efectivo</option>
                                            <option value="tarjeta">Tarjeta Débito/Crédito</option>
                                            <option value="otro">Otro medio</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Nota o Referencia (Opcional)</label>
                                        <input type="text" id="abono-nota-shared" class="form-control" placeholder="Ej. Transferencia Bancolombia ref #0923..." style="border-radius: 8px; font-size: 13px;">
                                    </div>
                                </div>
                            </div>

                            <!-- SECCIÓN DE DISTRIBUCIÓN MULTI-FACTURA (RESPONSIVE CARDS) -->
                            <div id="seccion-distribucion-multi" class="card border rounded-3 p-3 bg-white shadow-xs mb-2" style="border-color: var(--border-color); display: none;">
                                <div class="d-flex flex-wrap justify-content-between align-items-center mb-2 pb-2 border-bottom gap-2">
                                    <div>
                                        <h6 class="fw-bold mb-0" style="color: var(--text-main); font-size: 13px;">
                                            <i class="bi bi-diagram-3 me-1 text-primary"></i> Distribución del Pago en Facturas
                                        </h6>
                                        <span class="text-muted" style="font-size: 11px;">Reparta el monto recibido entre las facturas pendientes.</span>
                                    </div>
                                    <div class="d-flex flex-wrap gap-1.5 align-items-center">
                                        <button type="button" class="btn btn-sm btn-light border py-1 px-2 text-nowrap" id="btn-auto-prioridad-actual" style="font-size: 11px; border-radius: 6px;" title="Pagar factura #${numDoc} primero y el resto a las más antiguas">
                                            <i class="bi bi-lightning-fill text-warning"></i> Prioridad #${numDoc}
                                        </button>
                                        <button type="button" class="btn btn-sm btn-light border py-1 px-2 text-nowrap" id="btn-auto-fifo" style="font-size: 11px; border-radius: 6px;" title="Pagar de la más antigua a la más reciente">
                                            <i class="bi bi-clock-history text-primary"></i> Más antiguas (FIFO)
                                        </button>
                                        <button type="button" class="btn btn-sm btn-light border py-1 px-2 text-nowrap" id="btn-limpiar-distribucion" style="font-size: 11px; border-radius: 6px;" title="Poner en cero">
                                            <i class="bi bi-eraser text-secondary"></i> Limpiar
                                        </button>
                                    </div>
                                </div>

                                <!-- LISTA DE TARJETAS DE DISTRIBUCIÓN (RESPONSIVE MÓVIL Y DESKTOP) -->
                                <div class="distribucion-facturas-lista pe-1" id="lista-distribucion-facturas" style="max-height: 270px; overflow-y: auto; overflow-x: hidden;">
                                    ${this.renderFilasDistribucion(numDoc)}
                                </div>

                                <!-- BARRA DE CUADRE EN TIEMPO REAL -->
                                <div class="p-2.5 mt-2 rounded-3 bg-light border d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2" style="font-size: 12px;">
                                    <div class="d-flex flex-wrap align-items-center gap-2">
                                        <div><span class="text-muted">Total Recibido:</span> <strong id="lbl-total-recibido" class="tnum text-dark">$0</strong></div>
                                        <span class="text-muted d-none d-sm-inline">|</span>
                                        <div><span class="text-muted">Total Aplicado:</span> <strong id="lbl-total-aplicado" class="tnum text-primary">$0</strong></div>
                                    </div>
                                    <div class="text-sm-end">
                                        <span id="badge-cuadre-distribucion" class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 py-1 px-2">
                                            <i class="bi bi-check2-circle me-1"></i> Cuadrado
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- FOOTER CON ACCIONES -->
                            <div class="d-flex flex-wrap justify-content-end align-items-center mt-3 pt-3 border-top gap-2">
                                <button type="button" class="btn btn-light border btn-sm px-3" data-bs-dismiss="modal" style="border-radius: 8px; font-weight: 500; height: 38px;">
                                    Cancelar
                                </button>
                                <button type="submit" id="btn-guardar-abono" class="btn btn-primary-action btn-sm px-4 shadow-xs" style="border-radius: 8px; font-weight: 600; height: 38px;">
                                    <i class="bi bi-check2-circle me-1"></i> Guardar Pago
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        this.bindEvents();

        // Llenar cuentas bancarias dinámicamente
        const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
        const cuentasActivas = dbCuentas.filter(c => c.estado === 'active' || c.activo === true);
        const selectCuenta = document.getElementById('abono-cuenta-shared');
        selectCuenta.innerHTML = cuentasActivas.map(c => `
            <option value="${c.id}">${escapeHtml(c.nombre)} (${c.tipo || 'Cuenta'})</option>
        `).join('');

        // Prellenar valor inicial con el saldo de esta factura
        const montoInput = document.getElementById('abono-monto-shared');
        montoInput.value = this.currentSaldo.toString();
        applyCurrencyFormatting(montoInput);

        // Mostrar Modal
        this.modalInstance = new bootstrap.Modal(document.getElementById('modalAbonoShared'));
        this.modalInstance.show();
    },

    renderFilasDistribucion(numDocActual) {
        if (!this.facturasCartera || this.facturasCartera.length === 0) {
            return `<div class="text-center py-4 text-muted small">No hay facturas pendientes registradas.</div>`;
        }

        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return this.facturasCartera.map(f => {
            const esActual = String(f.id) === String(this.facturaId);
            return `
            <div class="item-distribucion-factura p-2.5 mb-2 rounded-3 border bg-white shadow-xs ${esActual ? 'is-actual border-primary bg-primary bg-opacity-10' : ''}" data-factura-id="${f.id}">
                <!-- Fila 1: Factura, Fecha y Saldo Pendiente -->
                <div class="d-flex justify-content-between align-items-center mb-2 gap-2">
                    <div class="d-flex align-items-center gap-1.5 flex-wrap">
                        <span class="payment-code-badge ${esActual ? 'border-primary text-primary fw-bold' : ''}">#${f.numero || f.id}</span>
                        ${esActual ? '<span class="badge bg-primary" style="font-size: 10px; font-weight: 600;">Actual</span>' : ''}
                        <span class="text-muted" style="font-size: 11px; white-space: nowrap;"><i class="bi bi-calendar3 me-1"></i>${formatFechaCorta(f.fecha)}</span>
                    </div>
                    <div class="text-end text-nowrap">
                        <span class="text-muted" style="font-size: 11px;">Saldo:</span>
                        <span class="fw-bold text-danger tnum ms-1 td-saldo-original" data-saldo="${f.saldo}" style="font-size: 13px;">${formatMoney(f.saldo)}</span>
                    </div>
                </div>

                <!-- Fila 2: Input para abonar y Nuevo Saldo -->
                <div class="d-flex align-items-center justify-content-between gap-2 pt-2 border-top">
                    <div class="d-flex align-items-center gap-2 flex-grow-1" style="min-width: 0;">
                        <label class="form-label text-muted mb-0 fw-semibold text-nowrap" style="font-size: 11px;">Abonar:</label>
                        <div class="input-group input-group-sm flex-grow-1" style="max-width: 180px;">
                            <span class="input-group-text bg-light text-muted fw-bold px-1.5">$</span>
                            <input type="text" class="form-control form-control-sm text-end fw-bold input-distribucion-linea tnum text-success" 
                                data-factura-id="${f.id}" 
                                data-saldo="${f.saldo}"
                                value="${esActual ? f.saldo : 0}" 
                                autocomplete="off"
                                inputmode="decimal"
                                style="font-size: 14px; min-height: 36px;">
                        </div>
                    </div>
                    <div class="text-end text-nowrap ps-1">
                        <div class="text-muted" style="font-size: 10px; line-height: 1.1;">Nuevo Saldo</div>
                        <div class="td-nuevo-saldo tnum fw-semibold mt-0.5" style="font-size: 12px;">
                            ${esActual ? '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 py-0 px-1.5" style="font-size: 11px;">Saldada</span>' : formatMoney(f.saldo)}
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    bindEvents() {
        const modalEl = document.getElementById('modalAbonoShared');
        const form = document.getElementById('form-abono-shared');
        const montoInput = document.getElementById('abono-monto-shared');
        const tabSingle = document.getElementById('tab-abono-single');
        const tabMulti = document.getElementById('tab-abono-multi');
        const seccionMulti = document.getElementById('seccion-distribucion-multi');
        const btnAutoPrioridad = document.getElementById('btn-auto-prioridad-actual');
        const btnAutoFifo = document.getElementById('btn-auto-fifo');
        const btnLimpiar = document.getElementById('btn-limpiar-distribucion');
        const modalDialog = document.getElementById('modalAbonoDialog');

        if (montoInput) applyCurrencyFormatting(montoInput);

        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Función para cambiar de modo visual (Single vs Multi)
        const setModo = (modo) => {
            this.modoDistribucion = modo;
            if (modo === 'multi') {
                if (tabSingle) tabSingle.classList.remove('active');
                if (tabMulti) tabMulti.classList.add('active');
                if (seccionMulti) seccionMulti.style.display = 'block';
                if (modalDialog) modalDialog.classList.add('modal-xl');
                autoDistribuir(true);
            } else {
                if (tabMulti) tabMulti.classList.remove('active');
                if (tabSingle) tabSingle.classList.add('active');
                if (seccionMulti) seccionMulti.style.display = 'none';
                if (modalDialog) modalDialog.classList.remove('modal-xl');
            }
        };

        if (tabSingle) tabSingle.addEventListener('click', () => setModo('single'));
        if (tabMulti) tabMulti.addEventListener('click', () => setModo('multi'));

        // Recalcular saldos en la lista de distribución
        const actualizarTotalesDistribucion = () => {
            const inputsLineas = modalEl.querySelectorAll('.input-distribucion-linea');
            let totalAplicado = 0;
            const montoTotal = parseCurrencyValue(montoInput.value) || 0;

            inputsLineas.forEach(inp => {
                const saldoOrig = parseFloat(inp.getAttribute('data-saldo')) || 0;
                let valAbono = parseCurrencyValue(inp.value) || 0;

                // Tope por saldo de la factura
                if (valAbono > saldoOrig) {
                    valAbono = saldoOrig;
                    inp.value = valAbono;
                    applyCurrencyFormatting(inp);
                } else if (valAbono < 0) {
                    valAbono = 0;
                    inp.value = 0;
                }

                totalAplicado += valAbono;

                // Actualizar nuevo saldo en la celda
                const fila = inp.closest('.item-distribucion-factura');
                const celdaNuevoSaldo = fila ? fila.querySelector('.td-nuevo-saldo') : null;
                if (celdaNuevoSaldo) {
                    const remanente = Math.max(0, saldoOrig - valAbono);
                    if (remanente <= 0.01) {
                        celdaNuevoSaldo.innerHTML = '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 py-0 px-1.5" style="font-size: 11px;">Saldada</span>';
                    } else {
                        celdaNuevoSaldo.textContent = formatMoney(remanente);
                    }
                }
            });

            const lblRecibido = document.getElementById('lbl-total-recibido');
            const lblAplicado = document.getElementById('lbl-total-aplicado');
            const badgeCuadre = document.getElementById('badge-cuadre-distribucion');

            if (lblRecibido) lblRecibido.textContent = formatMoney(montoTotal);
            if (lblAplicado) lblAplicado.textContent = formatMoney(totalAplicado);

            if (badgeCuadre) {
                const diff = montoTotal - totalAplicado;
                if (Math.abs(diff) < 0.01 && montoTotal > 0) {
                    badgeCuadre.className = 'badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 py-1 px-2';
                    badgeCuadre.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Monto distribuido al 100%';
                } else if (diff > 0) {
                    badgeCuadre.className = 'badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-25 py-1 px-2';
                    badgeCuadre.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i> Falta asignar ${formatMoney(diff)}`;
                } else {
                    badgeCuadre.className = 'badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 py-1 px-2';
                    badgeCuadre.innerHTML = `<i class="bi bi-x-circle me-1"></i> Sobreasignado por ${formatMoney(Math.abs(diff))}`;
                }
            }
        };

        // Algoritmo de auto-distribución
        const autoDistribuir = (priorizarActual = true) => {
            const montoTotal = parseCurrencyValue(montoInput.value) || 0;
            if (montoTotal <= 0) return;

            let disponible = montoTotal;
            const inputsLineas = modalEl.querySelectorAll('.input-distribucion-linea');

            // Resetear todos a cero primero
            inputsLineas.forEach(inp => {
                inp.value = '0';
                applyCurrencyFormatting(inp);
            });

            // Si se prioriza la actual, asignar primero a la factura actual
            if (priorizarActual && this.facturaId) {
                const inpActual = modalEl.querySelector(`.input-distribucion-linea[data-factura-id="${this.facturaId}"]`);
                if (inpActual) {
                    const saldoActual = parseFloat(inpActual.getAttribute('data-saldo')) || 0;
                    const aPagarActual = Math.min(disponible, saldoActual);
                    inpActual.value = aPagarActual.toString();
                    applyCurrencyFormatting(inpActual);
                    disponible -= aPagarActual;
                }
            }

            // Repartir el remanente a las facturas pendientes ordenadas por fecha (FIFO)
            if (disponible > 0) {
                inputsLineas.forEach(inp => {
                    const fId = inp.getAttribute('data-factura-id');
                    if (priorizarActual && String(fId) === String(this.facturaId)) return; // ya procesada
                    if (disponible <= 0) return;

                    const saldoF = parseFloat(inp.getAttribute('data-saldo')) || 0;
                    const yaAsignado = parseCurrencyValue(inp.value) || 0;
                    const pendiente = Math.max(0, saldoF - yaAsignado);
                    const asignar = Math.min(disponible, pendiente);

                    const nuevoValor = yaAsignado + asignar;
                    inp.value = nuevoValor.toString();
                    applyCurrencyFormatting(inp);
                    disponible -= asignar;
                });
            }

            actualizarTotalesDistribucion();
        };

        // Eventos en inputs de distribución
        const inputsLineas = modalEl.querySelectorAll('.input-distribucion-linea');
        inputsLineas.forEach(inp => {
            applyCurrencyFormatting(inp);
            inp.addEventListener('input', actualizarTotalesDistribucion);
            inp.addEventListener('focus', function () {
                this.select();
            });
        });

        // Botones de acción rápida en la distribución
        if (btnAutoPrioridad) btnAutoPrioridad.addEventListener('click', () => autoDistribuir(true));
        if (btnAutoFifo) btnAutoFifo.addEventListener('click', () => autoDistribuir(false));
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                inputsLineas.forEach(inp => {
                    inp.value = '0';
                    applyCurrencyFormatting(inp);
                });
                actualizarTotalesDistribucion();
            });
        }

        // Si el usuario cambia el monto principal:
        montoInput.addEventListener('input', () => {
            const val = parseCurrencyValue(montoInput.value) || 0;
            // Si el monto supera el saldo de la factura actual y el cliente tiene más facturas, auto-activar modo multi
            if (val > (this.currentSaldo + 0.01) && this.facturasCartera.length > 1 && this.modoDistribucion !== 'multi') {
                setModo('multi');
            } else if (this.modoDistribucion === 'multi') {
                autoDistribuir(true);
            }
        });

        // Envío del formulario
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const fecha = document.getElementById('abono-fecha-shared').value;
                const cuentaSelect = document.getElementById('abono-cuenta-shared');
                const cuentaId = cuentaSelect.value;
                const metodoPago = document.getElementById('abono-metodo-shared').value;
                const montoTotal = parseCurrencyValue(montoInput.value);
                const nota = document.getElementById('abono-nota-shared').value.trim();

                if (!cuentaId) {
                    CoreActions.showWarningModal("Seleccione una cuenta bancaria o caja.");
                    return;
                }

                if (montoTotal <= 0) {
                    CoreActions.showWarningModal("El monto del pago debe ser mayor a cero.");
                    return;
                }

                // Determinar qué facturas y montos se van a registrar
                let abonos = [];
                if (this.modoDistribucion === 'multi') {
                    inputsLineas.forEach(inp => {
                        const val = parseCurrencyValue(inp.value) || 0;
                        if (val > 0) {
                            abonos.push({
                                factura_id: parseInt(inp.getAttribute('data-factura-id'), 10),
                                monto: val
                            });
                        }
                    });

                    const totalDistribuido = abonos.reduce((sum, a) => sum + a.monto, 0);
                    if (abonos.length === 0) {
                        CoreActions.showWarningModal("Debe asignar un monto a al menos una factura en la lista.");
                        return;
                    }

                    if (Math.abs(totalDistribuido - montoTotal) > 0.01) {
                        CoreActions.showWarningModal(`La suma de las facturas (${formatMoney(totalDistribuido)}) no coincide con el total recibido (${formatMoney(montoTotal)}). Ajuste la distribución.`);
                        return;
                    }
                } else {
                    // Modo individual: pago a la factura actual
                    if (montoTotal > (this.currentSaldo + 0.01)) {
                        if (this.facturasCartera.length > 1) {
                            CoreActions.showWarningModal("El monto recibido supera el saldo de esta factura. Utilice la pestaña «Distribuir cartera» para abonar a otras facturas pendientes.");
                            setModo('multi');
                            return;
                        } else {
                            CoreActions.showWarningModal("El monto del abono no puede superar el saldo pendiente de la factura.");
                            return;
                        }
                    }

                    abonos.push({
                        factura_id: parseInt(this.facturaId, 10),
                        monto: montoTotal
                    });
                }

                const btnSubmit = document.getElementById('btn-guardar-abono');
                if (btnSubmit && btnSubmit.disabled) return;
                if (btnSubmit) {
                    btnSubmit.disabled = true;
                    btnSubmit.dataset.originalText = btnSubmit.innerHTML;
                    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Guardando...';
                }

                try {
                    // Obtener consecutivo oficial de recibo de caja
                    let nextNumero = null;
                    try {
                        const { data: numData, error: numError } = await supabase.rpc('get_next_numero_recibo');
                        if (!numError && numData) nextNumero = numData;
                    } catch (errRecibo) {
                        console.warn('[AbonoModal] Consecutivo de recibo:', errRecibo);
                    }

                    const grupoPagoId = 'pago_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
                    const tipoPago = this.esIngreso ? 'ingreso' : 'egreso';

                    for (const abono of abonos) {
                        const transaccion = {
                            id: 'trx_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
                            numero_recibo: nextNumero,
                            factura_id: abono.factura_id,
                            contacto_id: this.clienteId ? parseInt(this.clienteId, 10) : null,
                            grupo_pago_id: grupoPagoId,
                            tipo: tipoPago,
                            monto: abono.monto,
                            fecha: fecha,
                            cuenta_id: parseInt(cuentaId, 10),
                            metodo_pago: metodoPago,
                            observaciones: nota || null
                        };

                        await DB.save('transacciones', transaccion);
                        await supabase.rpc('recalcular_estado_factura', { p_factura_id: abono.factura_id });
                    }

                    document.activeElement?.blur();
                    const modalDom = document.getElementById('modalAbonoShared');
                    modalDom.addEventListener('hidden.bs.modal', () => {
                        CoreActions.showWarningModal(
                            abonos.length > 1
                                ? `¡Pago registrado exitosamente para ${abonos.length} facturas!`
                                : "Pago registrado exitosamente."
                        );
                        if (this.onSuccessCallback) {
                            this.onSuccessCallback();
                        }
                    }, { once: true });

                    this.modalInstance.hide();

                } catch (error) {
                    console.error("[AbonoModal] Error guardando pago:", error);
                    CoreActions.showWarningModal("Error al procesar el registro del pago.");
                } finally {
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = btnSubmit.dataset.originalText;
                    }
                }
            });
        }

        // Limpiar instancia al cerrar
        modalEl.addEventListener('hidden.bs.modal', () => {
            this.modalInstance = null;
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            document.body.classList.remove('modal-open');
        });
    }
};
