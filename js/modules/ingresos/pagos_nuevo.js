import DB, { getLocalDate } from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';
import { supabase } from '../../core/supabase.js';
import { applyCurrencyFormatting, parseCurrencyValue, escapeHtml } from '../../shared/formatters.js';
import { UI } from '../../shared/combobox.js';

function getThirdPartyAvatar(name) {
    if (!name || name === '-' || name === 'Sin cliente') {
        return { initials: '?', bg: '#f1f5f9', color: '#64748b' };
    }
    const clean = name.trim();
    const parts = clean.split(/\s+/);
    let initials = parts[0][0] || '';
    if (parts.length > 1 && parts[1][0]) initials += parts[1][0];
    initials = initials.toUpperCase();

    const colors = [
        { bg: '#eff6ff', color: '#1d4ed8' },
        { bg: '#ecfdf5', color: '#059669' },
        { bg: '#e0f2fe', color: '#0369a1' },
        { bg: '#fef3c7', color: '#d97706' },
        { bg: '#ccfbf1', color: '#0f766e' }
    ];
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % colors.length;
    return { initials: initials.substring(0, 2), ...colors[index] };
}

export default {
    async init(element) {
        if (!element) return;

        const hashParts = window.location.hash.split('?');
        const urlParams = new URLSearchParams(hashParts[1] || '');

        const grupoId = urlParams.get('grupoId');
        this.grupoId = grupoId || null;

        if (urlParams.has('clienteId')) {
            sessionStorage.setItem('clienteId', urlParams.get('clienteId'));
            window.history.replaceState(null, '', window.location.pathname + hashParts[0]);
        } else if (!this.grupoId) {
            sessionStorage.removeItem('clienteId');
            sessionStorage.removeItem('currentCliente');
            localStorage.removeItem('clienteId');
            localStorage.removeItem('currentCliente');
            window.currentCliente = null;
        }

        const clienteId = sessionStorage.getItem('clienteId');
        this.clienteId = clienteId;
        this.facturasData = [];

        element.innerHTML = this.renderLoading();
        await this.loadData(element);
    },

    formatCurrency(val) {
        return '$' + (val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    renderLoading() {
        return `
            <div class="dash-layout p-4 text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-2 text-muted fw-medium" style="font-size: 14px;">Cargando información de cartera y facturas...</p>
            </div>
        `;
    },

    async loadData(element) {
        try {
            const cuentas = await DB.getAll('cuentas_bancarias') || [];
            let cliente = null;
            let facturasPendientesRPC = [];

            let pagosGrupo = [];
            if (this.grupoId) {
                const { data: pg, error: errPg } = await supabase
                    .from('pagos_ingresos')
                    .select('*')
                    .eq('grupo_pago_id', this.grupoId);
                if (errPg) console.error("Error fetching pagosGrupo:", errPg);
                pagosGrupo = pg || [];
                if (pagosGrupo.some(p => p.conciliacion_id !== null && p.conciliacion_id !== undefined)) {
                    CoreActions.showWarningModal('Este pago está conciliado. Elimina la conciliación para editarlo.');
                    window.history.back();
                    return;
                }
                if (pagosGrupo.length > 0) {
                    const primerPago = pagosGrupo[0];
                    this.fechaOriginal = primerPago.fecha;
                    this.cuentaOriginal = primerPago.cuenta_id;
                    this.metodoOriginal = primerPago.metodo_pago;
                    this.categoriaOriginal = primerPago.categoria;
                    this.observacionesOriginal = primerPago.observaciones;
                    if (!this.clienteId && primerPago.contacto_id) {
                        this.clienteId = primerPago.contacto_id;
                    }
                }
            }

            if (this.clienteId) {
                cliente = await DB.get('contactos', this.clienteId);
                const { data, error } = await supabase.rpc('get_cartera_con_saldos', {
                    p_tipo_cartera: 'cxc',
                    p_contacto_id: String(this.clienteId)
                });
                if (error) console.error("Error fetching cartera para pagos:", error);
                facturasPendientesRPC = data || [];
            }

            this.facturasData = facturasPendientesRPC
                .map(f => {
                    const fila = pagosGrupo.find(p => String(p.factura_id) === String(f.id));
                    return {
                        ...f,
                        totalAbonado: f.total_pagado,
                        pagoIdExistente: fila ? fila.id : null,
                        montoExistente: fila ? Number(fila.monto) : 0
                    };
                });

            if (this.grupoId && pagosGrupo.length > 0) {
                const facturasFaltantes = pagosGrupo.filter(
                    p => p.factura_id && !this.facturasData.some(f => String(f.id) === String(p.factura_id))
                );
                if (facturasFaltantes.length > 0) {
                    const fIds = facturasFaltantes.map(p => p.factura_id);
                    const { data: facsData } = await supabase.from('facturas').select('*').in('id', fIds);
                    const filasExtras = facturasFaltantes.map(p => {
                        const fac = (facsData || []).find(f => String(f.id) === String(p.factura_id));
                        return {
                            id: p.factura_id,
                            numero: fac ? fac.numero : p.factura_id,
                            fecha: fac ? fac.fecha : '',
                            total: fac ? fac.total : 0,
                            totalAbonado: fac ? fac.total : 0,
                            saldo: 0,
                            pagoIdExistente: p.id,
                            montoExistente: Number(p.monto)
                        };
                    });
                    this.facturasData = [...this.facturasData, ...filasExtras];
                }
            }

            this.facturasData.sort((a, b) => Number(a.numero) - Number(b.numero));

            if (this.clienteId && this.facturasData.length === 0) {
                element.innerHTML = `
                    <div class="dash-layout p-4" style="max-width: 1200px; margin: 0 auto;">
                        <button onclick="window.history.back()" class="btn btn-light bg-white border text-secondary shadow-xs mb-3" style="border-radius: 8px;">
                            <i class="bi bi-arrow-left me-1"></i> Volver
                        </button>
                        <div class="card p-5 text-center border-0 shadow-xs rounded-4 bg-white">
                            <div class="payment-kpi-icon in-bg mx-auto mb-3" style="width: 50px; height: 50px; font-size: 24px;">
                                <i class="bi bi-check2-circle"></i>
                            </div>
                            <h4 class="fw-bold mb-2" style="color: var(--text-main);">Cliente al día</h4>
                            <p class="text-muted">El cliente <strong>${cliente ? escapeHtml(cliente.nombre) : this.clienteId}</strong> no presenta facturas pendientes con saldo.</p>
                            <div class="mt-3">
                                <button onclick="window.location.hash='#/cartera'" class="btn btn-primary-action px-4 py-2 fw-semibold">
                                    Ir a Cartera
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                return;
            }

            this.deudaTotal = this.facturasData.reduce((sum, f) => sum + (f.saldo || 0), 0);

            this.renderUI(element, cliente, cuentas);
            this.attachEvents(element);

        } catch (error) {
            console.error("Error loading data:", error);
            element.innerHTML = `<div class="alert alert-danger m-4">Error cargando información de pagos.</div>`;
        }
    },

    renderUI(element, cliente, cuentas) {
        const cuentaSeleccionada = this.grupoId ? this.cuentaOriginal : null;
        const cuentasActivas = (cuentas || []).filter(c => c.estado === 'active' || c.activo === true);
        const cuentasOptions = cuentasActivas.map(c => `
            <option value="${c.id}" ${cuentaSeleccionada && String(cuentaSeleccionada) === String(c.id) ? 'selected' : ''}>
                ${escapeHtml(c.nombre)} (${c.tipo || 'Cuenta'})
            </option>
        `).join('');

        const metodoSeleccionado = (this.grupoId && this.metodoOriginal) ? String(this.metodoOriginal).toLowerCase() : 'transferencia';
        const fechaValor = (this.grupoId && this.fechaOriginal) ? this.fechaOriginal : getLocalDate();
        const tituloVista = this.grupoId ? 'Editar Pago Agrupado' : 'Recibo de Caja / Cobro a Clientes';
        const btnTexto = this.grupoId ? 'Guardar Cambios' : 'Registrar Pago';
        const avatar = getThirdPartyAvatar(cliente ? cliente.nombre : '');

        const facturasRows = this.facturasData.map(f => {
            const montoInicial = f.pagoIdExistente ? f.montoExistente : 0;
            const nuevoSaldoInicial = Math.max(0, f.saldo - montoInicial);
            return `
            <tr data-id="${f.id}" data-pago-id="${f.pagoIdExistente || ''}" class="payment-row align-middle" style="border-bottom: 1px solid var(--border-color);">
                <td class="ps-3 py-3" data-label="Seleccionar">
                    <div class="form-check">
                        <input class="form-check-input check-factura-pago" type="checkbox" data-id="${f.id}" ${montoInicial > 0 ? 'checked' : ''}>
                    </div>
                </td>
                <td class="py-3" data-label="Factura">
                    <span class="payment-code-badge">#${f.numero}</span>
                </td>
                <td class="py-3 text-muted" data-label="Fecha" style="font-size: 13px;">${f.fecha || '-'}</td>
                <td class="py-3 text-muted tnum" data-label="Total Orig." style="font-size: 13px;">${this.formatCurrency(f.total)}</td>
                <td class="py-3 text-muted tnum" data-label="Abonado" style="font-size: 13px;">${this.formatCurrency(f.totalAbonado)}</td>
                <td class="py-3 text-danger fw-bold td-saldo-pendiente tnum" data-label="Saldo Pendiente" style="font-size: 14px;">${this.formatCurrency(f.saldo)}</td>
                <td class="py-3 text-end td-monto-pagar" data-label="Monto a Pagar" style="width: 160px;">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-light text-muted">$</span>
                        <input type="text" class="form-control monto-abono text-end fw-bold text-success tnum" 
                            data-id="${f.id}" 
                            data-pago-id="${f.pagoIdExistente || ''}" 
                            data-saldo="${f.saldo}" 
                            data-monto-existente="${f.montoExistente || 0}" 
                            data-total="${f.total || 0}"
                            value="${montoInicial}"
                            inputmode="decimal" autocomplete="off" style="font-size: 13px;">
                    </div>
                </td>
                <td class="pe-3 py-3 text-end text-muted tnum td-nuevo-saldo-col" data-label="Nuevo Saldo" style="font-size: 12px;">
                    ${this.formatCurrency(nuevoSaldoInicial)}
                </td>
            </tr>
            `;
        }).join('');

        element.innerHTML = `
            <div class="dash-layout p-4" style="max-width: 1350px; margin: 0 auto;">
                
                <!-- TOP BAR DE ALTO IMPACTO (ESTILO GASTOS OPERATIVOS) -->
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-2 border-bottom">
                    <div>
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <button onclick="window.history.back()" class="btn btn-sm btn-light bg-white border text-secondary shadow-xs d-flex align-items-center gap-1" style="border-radius: 8px; font-weight: 500;">
                                <i class="bi bi-arrow-left"></i> Volver
                            </button>
                            <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1" style="font-size: 11px;">
                                <i class="bi bi-receipt me-1"></i> Cartera & Cobros
                            </span>
                        </div>
                        <h3 class="fw-bold mb-0" style="color: var(--text-main); font-size: 22px;">${tituloVista}</h3>
                        <p class="text-muted mb-0" style="font-size: 13px;">
                            Aplicación y conciliación de abonos a facturas con distribución inteligente.
                        </p>
                    </div>

                    <div class="d-flex align-items-center gap-2">
                        <button type="button" class="btn btn-light bg-white border text-secondary shadow-xs btn-sm" id="btn-refrescar-datos" style="border-radius: 8px;" title="Refrescar">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                </div>

                <!-- 4 KPI CARDS DINÁMICAS (ESTILO GASTOS OPERATIVOS) -->
                <div class="row g-3 mb-4">
                    <!-- KPI 1: Deuda Total -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Deuda Total Cliente</span>
                                <div class="payment-kpi-icon out-bg">
                                    <i class="bi bi-wallet2"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-danger tnum" id="display-deuda-total" style="font-size: 22px;">
                                ${this.formatCurrency(this.deudaTotal)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Saldo exigible en facturas pendientes
                            </div>
                        </div>
                    </div>

                    <!-- KPI 2: Facturas Pendientes -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Facturas con Saldo</span>
                                <div class="payment-kpi-icon blue-bg">
                                    <i class="bi bi-collection"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-dark tnum" style="font-size: 22px;">
                                ${this.facturasData.length}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Documentos por cobrar
                            </div>
                        </div>
                    </div>

                    <!-- KPI 3: Total a Recibir -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card" style="border-left: 3px solid #059669;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Total a Recibir</span>
                                <div class="payment-kpi-icon in-bg">
                                    <i class="bi bi-cash-stack"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-success tnum" id="total-recibir-display" style="font-size: 22px;">
                                $0,00
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Monto total de este recibo de pago
                            </div>
                        </div>
                    </div>

                    <!-- KPI 4: Deuda Restante Proyectada -->
                    <div class="col-12 col-sm-6 col-lg-3">
                        <div class="payment-kpi-card">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="ds-kpi-label">Saldo Restante Estimado</span>
                                <div class="payment-kpi-icon pending-bg">
                                    <i class="bi bi-hourglass-split"></i>
                                </div>
                            </div>
                            <div class="payment-kpi-value fw-bold text-secondary tnum" id="display-saldo-restante" style="font-size: 22px;">
                                ${this.formatCurrency(this.deudaTotal)}
                            </div>
                            <div class="mt-2 text-muted" style="font-size: 11px;">
                                Cartera pendiente tras aplicar pago
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-4">
                    <!-- COLUMNA IZQUIERDA: CONFIGURACIÓN DEL RECIBO (ESTILO GASTOS OPERATIVOS) -->
                    <div class="col-lg-4">
                        <!-- Tarjeta Tercero / Cliente -->
                        <div class="card border rounded-3 p-3 mb-3 bg-white shadow-xs" style="border-color: var(--border-color);">
                            <span class="ds-kpi-label mb-2 d-block">Cliente</span>
                            ${cliente ? `
                            <div class="d-flex align-items-center gap-3">
                                <div class="payment-avatar" style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 44px; height: 44px; font-size: 15px;">
                                    ${avatar.initials}
                                </div>
                                <div style="overflow: hidden;">
                                    <h5 class="fw-bold mb-0 text-truncate" style="color: var(--text-main); font-size: 15px;">${escapeHtml(cliente.nombre)}</h5>
                                    <div class="text-muted" style="font-size: 12px;">NIT / ID: ${cliente.identificacion || 'N/A'}</div>
                                </div>
                            </div>
                            ` : `
                            <div class="custom-combobox position-relative" id="combo-cliente-container">
                                <input type="text" class="form-control" id="pago-cliente-search" placeholder="Buscar cliente por nombre o NIT..." autocomplete="off" style="border-radius: 8px;">
                                <input type="hidden" id="pago-cliente-id">
                            </div>
                            `}
                        </div>

                        <!-- Tarjeta Parámetros del Pago -->
                        <div class="card border rounded-3 p-4 bg-white shadow-xs" style="border-color: var(--border-color);">
                            <h6 class="fw-bold mb-3 d-flex align-items-center gap-2" style="color: var(--text-main); font-size: 14px;">
                                <i class="bi bi-credit-card text-primary"></i> Parámetros de la Transacción
                            </h6>

                            <div class="mb-3">
                                <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Cuenta Bancaria / Caja Destino *</label>
                                <select id="pago-cuenta" class="form-select" style="border-radius: 8px; font-size: 13px;" required>
                                    ${cuentasOptions}
                                </select>
                            </div>

                            <div class="mb-3">
                                <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Método de Pago *</label>
                                <select id="pago-metodo" class="form-select" style="border-radius: 8px; font-size: 13px;">
                                    <option value="transferencia" ${metodoSeleccionado === 'transferencia' ? 'selected' : ''}>Transferencia Bancaria</option>
                                    <option value="efectivo" ${metodoSeleccionado === 'efectivo' ? 'selected' : ''}>Efectivo</option>
                                    <option value="tarjeta" ${metodoSeleccionado === 'tarjeta' ? 'selected' : ''}>Tarjeta Débito/Crédito</option>
                                    <option value="otro" ${metodoSeleccionado === 'otro' ? 'selected' : ''}>Otro medio</option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Fecha del Pago *</label>
                                <input type="date" id="pago-fecha" class="form-control" value="${fechaValor}" style="border-radius: 8px; font-size: 13px;">
                            </div>

                            <div class="mb-4">
                                <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">Nota o Referencia</label>
                                <input type="text" id="pago-nota" class="form-control" value="${this.observacionesOriginal || ''}" placeholder="Ej. Pago con transferencia ref #1234..." style="border-radius: 8px; font-size: 13px;">
                            </div>

                            <button id="btn-registrar" class="btn btn-primary-action w-100 py-3 fw-bold shadow-xs d-flex align-items-center justify-content-center gap-2" style="border-radius: 10px; font-size: 15px;" disabled>
                                <i class="bi bi-check-circle-fill"></i> ${btnTexto}
                            </button>
                        </div>
                    </div>

                    <!-- COLUMNA DERECHA: TABLA Y HERRAMIENTA DE DISTRIBUCIÓN (ESTILO GASTOS OPERATIVOS) -->
                    <div class="col-lg-8">
                        <div class="card border rounded-3 bg-white shadow-xs" style="border-color: var(--border-color); overflow: hidden;">
                            
                            <!-- BARRA DE AUTO-DISTRIBUCIÓN RÁPIDA -->
                            <div class="p-3 bg-light border-bottom">
                                <div class="row g-2 align-items-center">
                                    <div class="col-12 col-md-5">
                                        <label class="form-label text-muted fw-semibold mb-1" style="font-size: 12px;">
                                            <i class="bi bi-lightning-charge text-warning"></i> Monto Total Consignado / Recibido
                                        </label>
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text bg-white fw-bold text-muted">$</span>
                                            <input type="text" id="input-monto-consignado-global" class="form-control fw-bold text-success tnum" placeholder="0" autocomplete="off" style="font-size: 14px;">
                                            <button type="button" class="btn btn-primary-action" id="btn-aplicar-auto-distribucion" title="Distribuir automáticamente en facturas más antiguas">
                                                <i class="bi bi-magic me-1"></i> Auto-Distribuir
                                            </button>
                                        </div>
                                    </div>
                                    <div class="col-12 col-md-7 d-flex justify-content-md-end align-items-center gap-2 pt-2 pt-md-0">
                                        <button type="button" class="btn btn-sm btn-white bg-white border text-secondary shadow-xs" id="btn-seleccionar-todas" style="border-radius: 6px; font-size: 12px;">
                                            <i class="bi bi-check-all"></i> Saldar Todas
                                        </button>
                                        <button type="button" class="btn btn-sm btn-white bg-white border text-secondary shadow-xs" id="btn-limpiar-montos" style="border-radius: 6px; font-size: 12px;">
                                            <i class="bi bi-eraser"></i> Limpiar
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- TABLA DE FACTURAS -->
                            <div class="table-responsive" style="min-height: 250px;">
                                <table class="table table-hover table-borderless align-middle mb-0 w-100 tabla-pagos-multi">
                                    <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                        <tr>
                                            <th class="ps-3 py-3" style="width: 40px;"></th>
                                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;"># Factura</th>
                                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Fecha</th>
                                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Total Orig.</th>
                                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Abonado</th>
                                            <th class="py-3 text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Saldo Pendiente</th>
                                            <th class="py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px; width: 160px;">Monto a Pagar</th>
                                            <th class="pe-3 py-3 text-end text-uppercase text-muted fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">Nuevo Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${facturasRows}
                                    </tbody>
                                </table>
                            </div>

                            <!-- FOOTER DE TABLA -->
                            <div class="p-3 bg-white border-top d-flex flex-wrap justify-content-between align-items-center gap-2" style="font-size: 12px;">
                                <span class="text-muted">
                                    <i class="bi bi-info-circle me-1"></i> Ingrese el monto en cada factura o use la barra superior de <strong>Auto-Distribuir</strong>.
                                </span>
                                <div>
                                    <span class="text-muted">Total a Asignar: </span>
                                    <strong class="text-success fs-6 tnum" id="lbl-total-asignar-tabla">$0,00</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    attachEvents(element) {
        const searchInput = element.querySelector('#pago-cliente-search');
        const hiddenIdEl = element.querySelector('#pago-cliente-id');

        if (searchInput && hiddenIdEl) {
            UI.createAsyncCombobox({
                inputEl: searchInput,
                hiddenIdEl: hiddenIdEl,
                fetchItems: async (query) => {
                    const { data } = await supabase.from('contactos')
                        .select('id, nombre, identificacion')
                        .eq('es_cliente', true)
                        .neq('estado', 'inactive')
                        .or(`nombre.ilike.%${query}%,identificacion.ilike.%${query}%`)
                        .limit(20);
                    return data ? data.map(d => ({ ...d, nit: d.identificacion })) : [];
                },
                displayProp: 'nombre',
                onSelect: (item) => {
                    sessionStorage.setItem('clienteId', item.id);
                    this.clienteId = item.id;
                    element.innerHTML = this.renderLoading();
                    this.loadData(element);
                }
            });
        }

        const inputs = element.querySelectorAll('.monto-abono');
        const display = element.querySelector('#total-recibir-display');
        const displayAsignar = element.querySelector('#lbl-total-asignar-tabla');
        const displayRestante = element.querySelector('#display-saldo-restante');
        const btnRegistrar = element.querySelector('#btn-registrar');
        const inputConsignadoGlobal = element.querySelector('#input-monto-consignado-global');
        const btnAutoDistribuir = element.querySelector('#btn-aplicar-auto-distribucion');
        const btnSaldarTodas = element.querySelector('#btn-seleccionar-todas');
        const btnLimpiar = element.querySelector('#btn-limpiar-montos');
        const btnRefrescar = element.querySelector('#btn-refrescar-datos');

        if (inputConsignadoGlobal) applyCurrencyFormatting(inputConsignadoGlobal);

        // Recalcular sumas y estados dinámicos
        const updateSum = () => {
            let sum = 0;
            let saldoRestanteProyectado = 0;

            inputs.forEach(input => {
                let val = parseCurrencyValue(input.value);
                let max = parseFloat(input.getAttribute('data-saldo')) || 0;
                if (this.grupoId) {
                    const montoExistente = parseFloat(input.getAttribute('data-monto-existente')) || 0;
                    const totalFactura = parseFloat(input.getAttribute('data-total')) || (max + montoExistente);
                    max = Math.min(max + montoExistente, totalFactura);
                }

                if (val > max) { val = max; input.value = val; applyCurrencyFormatting(input); }
                if (val < 0) { val = 0; input.value = 0; }

                const remanente = Math.max(0, max - val);
                saldoRestanteProyectado += remanente;

                const filaTr = input.closest('tr');
                const celdaNuevoSaldo = filaTr ? filaTr.querySelector('.td-nuevo-saldo-col') : null;
                const checkRow = filaTr ? filaTr.querySelector('.check-factura-pago') : null;

                if (celdaNuevoSaldo) {
                    celdaNuevoSaldo.textContent = this.formatCurrency(remanente);
                    if (remanente <= 0.01 && val > 0) {
                        celdaNuevoSaldo.innerHTML = '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 py-0 px-2">Saldada</span>';
                    }
                }

                if (checkRow) {
                    checkRow.checked = val > 0;
                }

                sum += val;
            });

            if (display) display.innerText = this.formatCurrency(sum);
            if (displayAsignar) displayAsignar.innerText = this.formatCurrency(sum);
            if (displayRestante) displayRestante.innerText = this.formatCurrency(saldoRestanteProyectado);
            if (btnRegistrar) btnRegistrar.disabled = sum <= 0;
        };

        const self = this;
        inputs.forEach(input => {
            applyCurrencyFormatting(input);
            input.addEventListener('input', updateSum);
            input.addEventListener('focus', function () {
                const valorActual = parseCurrencyValue(this.value);
                if (valorActual === 0) {
                    let maxVal = parseFloat(this.getAttribute('data-saldo')) || 0;
                    if (self.grupoId) {
                        const montoExistente = parseFloat(this.getAttribute('data-monto-existente')) || 0;
                        const totalFactura = parseFloat(this.getAttribute('data-total')) || (maxVal + montoExistente);
                        maxVal = Math.min(maxVal + montoExistente, totalFactura);
                    }
                    this.value = maxVal;
                    applyCurrencyFormatting(this);
                    updateSum();
                }
                this.select();
            });
        });

        // Evento en checkboxes de cada fila
        element.querySelectorAll('.check-factura-pago').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const fila = e.target.closest('tr');
                const inp = fila ? fila.querySelector('.monto-abono') : null;
                if (!inp) return;

                if (e.target.checked) {
                    let maxVal = parseFloat(inp.getAttribute('data-saldo')) || 0;
                    if (this.grupoId) {
                        const montoExistente = parseFloat(inp.getAttribute('data-monto-existente')) || 0;
                        const totalFactura = parseFloat(inp.getAttribute('data-total')) || (maxVal + montoExistente);
                        maxVal = Math.min(maxVal + montoExistente, totalFactura);
                    }
                    inp.value = maxVal;
                } else {
                    inp.value = '0';
                }
                applyCurrencyFormatting(inp);
                updateSum();
            });
        });

        // Botón Auto-Distribuir por Monto Consignado Global
        if (btnAutoDistribuir && inputConsignadoGlobal) {
            btnAutoDistribuir.addEventListener('click', () => {
                const totalMonto = parseCurrencyValue(inputConsignadoGlobal.value) || 0;
                if (totalMonto <= 0) {
                    CoreActions.showWarningModal("Ingrese el valor total consignado para auto-distribuir.");
                    return;
                }

                let disponible = totalMonto;
                // Distribuir FIFO: de las primeras facturas a las últimas
                inputs.forEach(input => {
                    input.value = '0';
                    applyCurrencyFormatting(input);
                });

                inputs.forEach(input => {
                    if (disponible <= 0) return;
                    let max = parseFloat(input.getAttribute('data-saldo')) || 0;
                    if (this.grupoId) {
                        const montoExistente = parseFloat(input.getAttribute('data-monto-existente')) || 0;
                        const totalFactura = parseFloat(input.getAttribute('data-total')) || (max + montoExistente);
                        max = Math.min(max + montoExistente, totalFactura);
                    }
                    const asignar = Math.min(disponible, max);
                    input.value = asignar;
                    applyCurrencyFormatting(input);
                    disponible -= asignar;
                });

                updateSum();

                if (disponible > 0) {
                    CoreActions.showWarningModal(`El monto consignado superó la deuda total de las facturas. Quedó un excedente de ${this.formatCurrency(disponible)}.`);
                }
            });
        }

        // Botón Saldar Todas
        if (btnSaldarTodas) {
            btnSaldarTodas.addEventListener('click', () => {
                inputs.forEach(input => {
                    let max = parseFloat(input.getAttribute('data-saldo')) || 0;
                    if (this.grupoId) {
                        const montoExistente = parseFloat(input.getAttribute('data-monto-existente')) || 0;
                        const totalFactura = parseFloat(input.getAttribute('data-total')) || (max + montoExistente);
                        max = Math.min(max + montoExistente, totalFactura);
                    }
                    input.value = max;
                    applyCurrencyFormatting(input);
                });
                updateSum();
            });
        }

        // Botón Limpiar Montos
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                inputs.forEach(input => {
                    input.value = '0';
                    applyCurrencyFormatting(input);
                });
                if (inputConsignadoGlobal) {
                    inputConsignadoGlobal.value = '';
                }
                updateSum();
            });
        }

        // Botón Refrescar
        if (btnRefrescar) {
            btnRefrescar.addEventListener('click', () => {
                element.innerHTML = this.renderLoading();
                this.loadData(element);
            });
        }

        if (this.grupoId) {
            updateSum();
        }

        // Registrar / Guardar cambios
        btnRegistrar.addEventListener('click', async () => {
            const cuentaId = element.querySelector('#pago-cuenta').value;
            const metodo = element.querySelector('#pago-metodo').value;
            const fecha = element.querySelector('#pago-fecha').value;

            if (!cuentaId) {
                CoreActions.showWarningModal("Debe seleccionar una cuenta bancaria destino.");
                return;
            }

            btnRegistrar.disabled = true;
            btnRegistrar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

            try {
                if (this.grupoId) {
                    const lineas = [];
                    inputs.forEach(input => {
                        lineas.push({
                            pago_id: input.closest('tr')?.dataset?.pagoId || null,
                            factura_id: input.getAttribute('data-id'),
                            monto: parseCurrencyValue(input.value) || 0
                        });
                    });

                    const updatePayload = {
                        fecha: fecha,
                        cuenta_id: parseInt(cuentaId, 10),
                        categoria: this.categoriaOriginal,
                        observaciones: element.querySelector('#pago-nota') ? element.querySelector('#pago-nota').value : this.observacionesOriginal,
                        metodo_pago: metodo
                    };

                    const lineasConMonto = lineas.filter(l => l.monto > 0);
                    const facturaIdsAfectadas = [...new Set(lineasConMonto.map(l => l.factura_id).filter(Boolean))];
                    let estadosFacturas = [];

                    if (facturaIdsAfectadas.length > 0) {
                        const { data: transaccionesF } = await supabase.from('pagos_ingresos').select('*').in('factura_id', facturaIdsAfectadas);
                        const { data: facturasF } = await supabase.from('facturas').select('*').in('id', facturaIdsAfectadas);
                        if (facturasF && transaccionesF) {
                            const { calcularEstadoFactura } = await import('../../shared/carteraUtils.js');
                            for (const f of facturasF) {
                                f.estado = 'pendiente';
                                let txM = transaccionesF.filter(tx => tx.factura_id === f.id).map(tx => {
                                    const lineaMatch = lineas.find(l => l.pago_id && String(l.pago_id) === String(tx.id));
                                    return { ...tx, monto: lineaMatch ? lineaMatch.monto : tx.monto, tipo: tx.tipo === 'in' ? 'ingreso' : 'egreso' };
                                });
                                const lineasNuevas = lineas.filter(l => !l.pago_id && l.monto > 0 && String(l.factura_id) === String(f.id));
                                lineasNuevas.forEach((ln, index) => {
                                    txM.push({ id: Date.now() + index, factura_id: f.id, tipo: 'ingreso', estado: 'activo', fecha: updatePayload.fecha, observaciones: '', monto: ln.monto });
                                });
                                const metricas = calcularEstadoFactura(f, txM);
                                estadosFacturas.push({ id: f.id, estado: metricas.estado });
                            }
                        }
                    }

                    const { error } = await supabase.rpc('editar_pago_grupo_lineas', {
                        p_grupo_pago_id: this.grupoId,
                        p_update_payload: updatePayload,
                        p_lineas: lineas,
                        p_estados_facturas: estadosFacturas
                    });
                    if (error) throw error;

                    CoreActions.showWarningModal("Pago actualizado exitosamente.");
                    window.location.hash = '#/ingresos/pagos-recibidos';

                } else {
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

                    if (abonos.length === 0) {
                        CoreActions.showWarningModal("Debe abonar a al menos una factura.");
                        btnRegistrar.disabled = false;
                        btnRegistrar.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${btnTexto}`;
                        return;
                    }

                    const grupoPagoId = 'pago_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

                    let nextNumero = null;
                    const { data: numData, error: numError } = await supabase.rpc('get_next_numero_recibo');
                    if (!numError && numData) {
                        nextNumero = numData;
                    }

                    for (const abono of abonos) {
                        const facturaParaTipo = this.facturasData.find(f => String(f.id) === String(abono.factura_id));
                        const tipoPago = (facturaParaTipo && (facturaParaTipo.tipo === 'compra' || facturaParaTipo.tipo === 'gasto')) ? 'egreso' : 'ingreso';

                        const transaccion = {
                            id: 'trx_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
                            numero_recibo: nextNumero,
                            factura_id: parseInt(abono.factura_id, 10),
                            contacto_id: parseInt(this.clienteId, 10),
                            grupo_pago_id: grupoPagoId,
                            tipo: tipoPago,
                            monto: parseFloat(abono.monto),
                            fecha: fecha,
                            cuenta_id: parseInt(cuentaId, 10),
                            metodo_pago: metodo,
                            observaciones: element.querySelector('#pago-nota')?.value || null
                        };
                        await DB.save('transacciones', transaccion);
                        await supabase.rpc('recalcular_estado_factura', { p_factura_id: abono.factura_id });
                    }

                    CoreActions.showWarningModal(`¡Se han registrado ${abonos.length} abonos exitosamente!`);
                    window.location.hash = '#/cartera';
                }

            } catch (error) {
                console.error("Error guardando transacciones:", error);
                CoreActions.showWarningModal("Error al procesar el guardado de transacciones.");
                btnRegistrar.disabled = false;
                btnRegistrar.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${this.grupoId ? 'Guardar Cambios' : 'Registrar Pago'}`;
            }
        });
    }
};
