import DB, { getLocalDate } from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';
import { supabase } from '../../core/supabase.js';
import { applyCurrencyFormatting, parseCurrencyValue } from '../../shared/formatters.js';
import { UI } from '../../shared/combobox.js';

export default {
    async init(element) {
        if (!element) return;
        
        const hashParts = window.location.hash.split('?');
        const urlParams = new URLSearchParams(hashParts[1] || '');
        
        const grupoId = urlParams.get('grupoId');
        this.grupoId = grupoId || null;

        if (urlParams.has('clienteId')) {
            sessionStorage.setItem('clienteId', urlParams.get('clienteId'));
            // Remove parameter from URL to keep it clean (optional, but good practice)
            window.history.replaceState(null, '', window.location.pathname + hashParts[0]);
        } else if (!this.grupoId) {
            // Limpieza agresiva de cualquier rastro previo si es carga directa limpia
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
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(val);
    },

    renderLoading() {
        return `<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2">Cargando facturas pendientes...</p></div>`;
    },

    async loadData(element) {
        try {
            const cuentas = await DB.getAll('cuentas_bancarias') || [];
            const contactos = await DB.getAll('contactos') || [];
            this.contactos = contactos;
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
                if (pagosGrupo.length > 0) {
                    const primerPago = pagosGrupo[0];
                    this.fechaOriginal = primerPago.fecha;
                    this.cuentaOriginal = primerPago.cuenta_id;
                    this.metodoOriginal = primerPago.metodo_pago;
                    this.categoriaOriginal = primerPago.categoria;
                    this.observacionesOriginal = primerPago.observaciones;
                    this.numeroReciboOriginal = primerPago.numero_recibo;
                    if (!this.clienteId && primerPago.contacto_id) {
                        this.clienteId = primerPago.contacto_id;
                    }
                }
            }

            if (this.clienteId) {
                cliente = await DB.get('contactos', this.clienteId);
                // Cargar facturas del cliente usando RPC
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

            this.renderUI(element, cliente, contactos, cuentas);
            this.attachEvents(element);

        } catch (error) {
            console.error("Error loading data:", error);
            element.innerHTML = `<div class="alert alert-danger m-4">Error cargando datos.</div>`;
        }
    },

    renderUI(element, cliente, contactos, cuentas) {
        const cuentaSeleccionada = this.grupoId ? this.cuentaOriginal : null;
        const cuentasOptions = cuentas.map(c => `
            <option value="${c.id}" ${cuentaSeleccionada && String(cuentaSeleccionada) === String(c.id) ? 'selected' : ''}>
                ${c.nombre} (${c.tipo})
            </option>
        `).join('');

        const metodoSeleccionado = (this.grupoId && this.metodoOriginal) ? String(this.metodoOriginal).toLowerCase() : 'transferencia';
        const fechaValor = (this.grupoId && this.fechaOriginal) ? this.fechaOriginal : getLocalDate();
        const tituloVista = this.grupoId ? 'Editar pago agrupado' : 'Registrar Pagos Multi-Factura';
        const btnTexto = this.grupoId ? 'Guardar cambios' : 'Registrar Pagos';

        const facturasRows = this.facturasData.map(f => `
            <tr data-pago-id="${f.pagoIdExistente || ''}" style="border-bottom: 1px solid var(--border-color); font-size: var(--fs-base); color: var(--text-body);">
                <td class="align-middle fw-bold" style="color: var(--text-main);">#${f.numero}</td>
                <td class="align-middle text-muted">${f.fecha}</td>
                <td class="align-middle">${this.formatCurrency(f.total)}</td>
                <td class="align-middle text-muted">${this.formatCurrency(f.totalAbonado)}</td>
                <td class="align-middle text-danger fw-bold">${this.formatCurrency(f.saldo)}</td>
                <td class="align-middle">
                    <div class="input-group input-group-sm" style="max-width: 150px; margin-left:auto;">
                        <span class="input-group-text">$</span>
                        <input type="text" class="form-control monto-abono text-end fw-bold" 
                            data-id="${f.id}" 
                            data-pago-id="${f.pagoIdExistente || ''}" 
                            data-saldo="${f.saldo}" 
                            data-monto-existente="${f.montoExistente || 0}" 
                            data-total="${f.total || 0}"
                            value="${f.pagoIdExistente ? f.montoExistente : '0'}">
                    </div>
                </td>
            </tr>
        `).join('');

        element.innerHTML = `
            <div class="dash-layout p-4" style="max-width: 1200px; margin: 0 auto;">
                <div class="mb-4">
                    <button onclick="window.location.hash='${this.grupoId ? '#/ingresos/pagos-recibidos' : '#/cartera'}'" class="btn btn-light border btn-sm rounded-pill mb-2">
                        <i class="bi bi-arrow-left"></i> ${this.grupoId ? 'Volver a Pagos Recibidos' : 'Volver a Cartera'}
                    </button>
                    <h2 class="h3 fw-bold mb-0" style="color: var(--text-main);">${tituloVista}</h2>
                </div>

                <div class="row g-4">
                    <!-- Columna Izquierda: Configuración del Pago -->
                    <div class="col-lg-4">
                        <div class="ds-table-container p-4 mb-4">
                            <h6 class="ds-kpi-label mb-1">Cliente</h6>
                            ${cliente ? `<h4 class="fw-bold mb-3" style="color: var(--text-main);">${cliente.nombre}</h4>` : `
                            <div class="custom-combobox position-relative mb-3" id="combo-cliente-container">
                                <input type="text" class="form-control" id="pago-cliente-search" placeholder="Buscar cliente por nombre o NIT..." autocomplete="off">
                                <input type="hidden" id="pago-cliente-id">
                            </div>
                            `}
                            <div class="d-flex justify-content-between pt-3" style="border-top: 1px solid var(--border-color);">
                                <span class="text-muted">Deuda Total:</span>
                                <span class="fw-bold text-danger fs-5">${this.formatCurrency(this.deudaTotal)}</span>
                            </div>
                        </div>

                        <div class="ds-table-container p-4">
                            <h5 class="fw-bold mb-4" style="color: var(--text-main);">Detalles del Recibo</h5>
                            
                            <div class="mb-3">
                                <label class="form-label text-muted" style="font-size: 13px;">Cuenta de Destino</label>
                                <select id="pago-cuenta" class="form-select">
                                    ${cuentasOptions}
                                </select>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label text-muted" style="font-size: 13px;">Método de Pago</label>
                                <select id="pago-metodo" class="form-select">
                                    <option value="transferencia" ${metodoSeleccionado === 'transferencia' ? 'selected' : ''}>Transferencia</option>
                                    <option value="efectivo" ${metodoSeleccionado === 'efectivo' ? 'selected' : ''}>Efectivo</option>
                                    <option value="tarjeta" ${metodoSeleccionado === 'tarjeta' ? 'selected' : ''}>Tarjeta</option>
                                    <option value="otro" ${metodoSeleccionado === 'otro' ? 'selected' : ''}>Otro</option>
                                </select>
                            </div>

                            <div class="mb-4">
                                <label class="form-label text-muted" style="font-size: 13px;">Fecha de Pago</label>
                                <input type="date" id="pago-fecha" class="form-control" value="${fechaValor}">
                            </div>

                            ${this.grupoId ? `
                            <div class="mb-4">
                                <label class="form-label text-muted" style="font-size: 13px;">Nota</label>
                                <input type="text" id="pago-nota" class="form-control" value="${this.observacionesOriginal || ''}" placeholder="Nota o concepto...">
                            </div>
                            ` : ''}

                            <div class="p-3 bg-success bg-opacity-10 rounded-3 mb-4 text-center border border-success border-opacity-25">
                                <h6 class="text-success fw-bold mb-1">TOTAL A RECIBIR</h6>
                                <h2 id="total-recibir-display" class="fw-bold text-success mb-0">$0.00</h2>
                            </div>

                            <button id="btn-registrar" class="btn btn-primary-action w-100 py-3 fw-bold" disabled>
                                <i class="bi bi-check-circle me-2"></i>${btnTexto}
                            </button>
                        </div>
                    </div>

                    <!-- Columna Derecha: Tabla de Facturas -->
                    <div class="col-lg-8">
                        <div class="ds-table-container h-100">
                            <div class="p-4" style="border-bottom: 1px solid var(--border-color);">
                                <h5 class="fw-bold mb-0" style="color: var(--text-main);">Facturas Pendientes</h5>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-borderless align-middle mb-0">
                                    <thead class="ds-table-header">
                                        <tr>
                                            <th class="py-2 fw-normal ps-4"># Factura</th>
                                            <th class="py-2 fw-normal">Fecha</th>
                                            <th class="py-2 fw-normal">Total Orig.</th>
                                            <th class="py-2 fw-normal">Abonado</th>
                                            <th class="py-2 fw-normal">Saldo Pendiente</th>
                                            <th class="py-2 fw-normal text-end pe-4">Monto a Pagar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${facturasRows}
                                    </tbody>
                                </table>
                            </div>
                            <div class="p-3 text-end text-muted" style="font-size: var(--fs-xs); border-top: 1px solid var(--border-color);">
                                Digite el monto a abonar en la casilla correspondiente a cada factura.
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
        const btnRegistrar = element.querySelector('#btn-registrar');

        // Sumar dinámicamente
        const updateSum = () => {
            let sum = 0;
            inputs.forEach(input => {
                let val = parseCurrencyValue(input.value);
                let max = parseFloat(input.getAttribute('data-saldo')) || 0;
                if (this.grupoId) {
                    const montoExistente = parseFloat(input.getAttribute('data-monto-existente')) || 0;
                    const totalFactura = parseFloat(input.getAttribute('data-total')) || (max + montoExistente);
                    max = Math.min(max + montoExistente, totalFactura);
                }
                
                // Autocorrección si el usuario digita más del saldo permitido
                if (val > max) { val = max; input.value = val; applyCurrencyFormatting(input); }
                if (val < 0) { val = 0; input.value = 0; }
                
                sum += val;
            });
            display.innerText = this.formatCurrency(sum);
            btnRegistrar.disabled = sum <= 0;
        };

        const self = this;
        inputs.forEach(input => {
            applyCurrencyFormatting(input);
            input.addEventListener('input', updateSum);
            input.addEventListener('focus', function() {
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

                    if (abonos.length === 0) return;

                    // Registrar cada pago de forma iterativa y limpia
                    const grupoPagoId = 'pago_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
                    
                    let nextNumero = null;
                    const { data: numData, error: numError } = await supabase.rpc('get_next_numero_recibo');
                    if (!numError && numData) {
                        nextNumero = numData;
                    }

                    for (const abono of abonos) {
                        // Inferir tipo de pago desde la factura
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
                            metodo_pago: metodo
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
                }
                
            } catch (error) {
                console.error("Error guardando transacciones:", error);
                CoreActions.showWarningModal("Error al procesar el guardado de transacciones.");
                btnRegistrar.disabled = false;
                btnRegistrar.innerHTML = `<i class="bi bi-check-circle me-2"></i>${this.grupoId ? 'Guardar cambios' : 'Registrar Pagos'}`;
            }
        });
    }
};
