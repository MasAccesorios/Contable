import DB from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';
import { TesoreriaModule } from '../tesoreria.js';

export const PagosModule = {
    state: {
        facturasPendientes: [],
        clienteSeleccionado: null,
        cuentaSeleccionada: null,
        totalPagoCalculado: 0,
        clientesDb: [],
        cuentasDb: [],
        pagoEditandoId: null,
        pagoEditando: null
    },

    obtenerTodosLosBancosDelModulo() {
        let datosAlegraRaw = localStorage.getItem('datos_alegra');
        let data = {};
        if (datosAlegraRaw) {
            try { data = JSON.parse(datosAlegraRaw); } catch(e) {}
        }
        
        let listaCuentasReales = data.bancos || data.cuentasBancarias || data.cuentas || [];
        
        // Si está vacío o si detecta el viejo mock temporal de 5 bancos (Nequi, DaviPlata, BBVA...)
        const esMockViejo = listaCuentasReales.length === 5 && listaCuentasReales.some(b => b.nombre === 'BBVA');
        
        if (listaCuentasReales.length === 0 || esMockViejo) {
            console.warn("Módulo de bancos vacío o desactualizado. Sincronizando datos maestros reales desde Tesoreria en localStorage...");
            // Extraer del módulo real de Tesorería
            listaCuentasReales = TesoreriaModule.cuentasConfig.map((c, i) => ({
                id: `b${i+1}`,
                nombre: c.nombre,
                numero: c.numero,
                tipo: c.tipo
            }));
            data.bancos = listaCuentasReales;
            localStorage.setItem('datos_alegra', JSON.stringify(data));
        }
        
        return listaCuentasReales;
    },

    async init(element) {
        if (!element) return;
        
        if (typeof window.cleanupFloatingElements === 'function') {
            window.cleanupFloatingElements();
        }
        
        this.element = element;

        const hash = window.location.hash;
        if (hash.includes('/editar/') || hash.includes('/ver/')) {
            const parts = hash.split('/');
            this.state.pagoEditandoId = parts[parts.length - 1];
            
            let datosRecuperados = await DB.get('pagos', this.state.pagoEditandoId);
            if (!datosRecuperados) {
                CoreActions.showWarningModal("El pago solicitado no fue encontrado en la base de datos.");
                window.location.hash = '#/ingresos/pagos';
                return;
            }

            this.state.pagoEditando = datosRecuperados;
            
            // Asegura que el estado no esté vacío al mapear los inputs de la grilla
            this.state.facturasPendientes = datosRecuperados ? (datosRecuperados.facturas || []) : [];
            this.state.isViewOnly = hash.includes('/ver/');
        } else {
            this.state.pagoEditandoId = null;
            this.state.pagoEditando = null;
            this.state.isViewOnly = false;
        }

        await this.render();
        
        // Fetch real data
        const contactos = await DB.getAll('contactos');
        this.state.clientesDb = contactos.filter(c => c.tipo === 'cliente');

        // Forzar la carga completa del maestro de bancos en el Autocomplete del módulo
        this.state.cuentasDb = this.obtenerTodosLosBancosDelModulo();
        const catálogoBancos = this.state.cuentasDb;

        await this.bindEvents();

        this.bindAutocomplete('input-cliente-pago', 'dropdown-cliente-pago', this.state.clientesDb, (item) => this.seleccionarCliente(item));
        
        // Rebindear el componente asegurando que el dataset completo esté disponible siempre
        const inputCuenta = document.getElementById('input-cuenta-pago');
        const dropdownCuenta = document.getElementById('dropdown-cuenta-pago');

        const renderizarOpcionesBancos = (lista) => {
            dropdownCuenta.innerHTML = '';
            lista.forEach(banco => {
                const nombre = typeof banco === 'string' ? banco : (banco.nombre || banco.name || banco.cuenta || banco.id || 'Desconocido');
                const li = document.createElement('li');
                li.className = 'dropdown-item py-2';
                li.style.cursor = 'pointer';
                li.innerText = nombre;
                li.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    inputCuenta.value = nombre;
                    this.state.cuentaSeleccionada = typeof banco === 'string' ? { id: banco, nombre: banco } : banco;
                    dropdownCuenta.classList.remove('show');
                });
                dropdownCuenta.appendChild(li);
            });
            if (lista.length > 0) {
                dropdownCuenta.classList.add('show');
            } else {
                dropdownCuenta.classList.remove('show');
            }
        };

        if (inputCuenta && dropdownCuenta) {
            const openDropdown = () => {
                const bancosReales = this.obtenerTodosLosBancosDelModulo();
                renderizarOpcionesBancos(bancosReales);
            };

            // Mostrar TODOS los bancos inmediatamente cuando el usuario haga clic en el campo
            inputCuenta.addEventListener('focus', openDropdown);
            inputCuenta.addEventListener('click', openDropdown);

            inputCuenta.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                const bancosReales = this.obtenerTodosLosBancosDelModulo();
                const filtrados = bancosReales.filter(b => {
                    const nombre = typeof b === 'string' ? b : (b.nombre || b.name || b.cuenta || b.id || '');
                    return nombre.toLowerCase().includes(query);
                });
                renderizarOpcionesBancos(filtrados);
            });
            
            // Cerrar menú al hacer clic fuera
            document.addEventListener('click', (e) => {
                if (!inputCuenta.contains(e.target) && !dropdownCuenta.contains(e.target)) {
                    dropdownCuenta.classList.remove('show');
                }
            });
        }

        // Pre-fill data if editing or view
        if (this.state.pagoEditando) {
            const p = this.state.pagoEditando;
            
            this.element.querySelector('#fecha-pago').value = p.fecha || '';
            this.element.querySelector('#forma-pago').value = p.formaPago || 'Consignación';
            this.element.querySelector('#notas-pago').value = p.notas || '';
            
            const cliente = this.state.clientesDb.find(c => c.id == p.clienteId);
            if(cliente) {
                this.element.querySelector('#input-cliente-pago').value = cliente.nombre;
                this.state.clienteSeleccionado = cliente;
            } else {
                this.element.querySelector('#input-cliente-pago').value = p.clienteNombre || p.cliente || p.clienteId || '';
            }
            
            // 3. Al cargar datos de un pago existente (Edición), rellenar el texto sin pisar el dataset del buscador
            const inputCuenta = document.getElementById('input-cuenta-pago');
            if (inputCuenta) {
                const cuentaObj = this.state.cuentasDb.find(c => c.id == p.cuentaBancaria || c.nombre == p.cuentaBancaria);
                inputCuenta.value = cuentaObj ? cuentaObj.nombre : (p.cuentaBancaria || '');
                this.state.cuentaSeleccionada = cuentaObj || { nombre: p.cuentaBancaria };
            }
            
            if (this.state.isViewOnly) {
                this.renderizarFacturasAfectadasEnConsulta(p.distribucionCredito || []);
            } else if (cliente) {
                await this.cargarFacturasCliente(cliente.id);
            }
        }
    },

    async render() {
        const nroRecibo = this.state.pagoEditando ? this.state.pagoEditando.nroRecibo : (Math.floor(Math.random() * 90000) + 10000);
        const fechaHoy = new Date().toISOString().split('T')[0];
        const titulo = this.state.isViewOnly ? 'Ver pago recibido' : (this.state.pagoEditando ? 'Editar pago recibido' : 'Nuevo pago recibido');
        const actionsHtml = CoreActions.renderActionButtons(this.state.pagoEditando, 'pago', this.state.isViewOnly, !this.state.pagoEditandoId);

        this.element.innerHTML = `
            <div class="py-4 px-5" style="font-family: 'Inter', sans-serif; background-color: #f8f9fa; min-height: 100vh;">
                <!-- Contenedor Superior Alineado y Simétrico -->
                <div class="mx-auto mb-4 d-flex justify-content-between align-items-center" style="max-width: 1000px; font-family: 'Inter', sans-serif;">
                    <div>
                        <span class="text-muted" style="cursor: pointer; font-size: 12px;" id="btn-volver-pagos">�?Volver a Pagos</span>
                        <h2 class="fw-medium text-dark mt-1 mb-0" style="font-size: 20px;">${titulo}</h2>
                    </div>
                    
                    <!-- Grupo de Botones Compacto y Alineado a la Derecha -->
                    <div class="d-flex gap-2">
                        ${actionsHtml}
                    </div>
                </div>

                <!-- Tarjeta Estilo Alegra (Clean White Slate) -->
                <div class="bg-white border border-light-subtle p-5 mx-auto shadow-sm" style="max-width: 1000px; border-radius: 4px;">
                    
                    <!-- Fila Consecutivo / Header Empresa -->
                    <div class="d-flex justify-content-between align-items-start mb-4">
                        <div class="d-flex align-items-center">
                            <img src="LogoMas.png" alt="Logo" style="max-height: 50px; margin-right: 15px;">
                            <div>
                                <span class="fw-bold text-dark d-block" style="font-size: 14px;">Accesorios .</span>
                                <span class="text-muted" style="font-size: 11px;">NIT 79872092</span>
                            </div>
                        </div>
                        <div class="text-end">
                            <span class="fw-bold text-dark d-block" style="font-size: 15px;">No. <span id="lbl-nro-recibo">${nroRecibo}</span></span>
                            <span class="text-muted" style="font-size: 11px; cursor: pointer;">Recibo de caja ✏️</span>
                        </div>
                    </div>

                    <!-- Cuadrícula de Campos de Cabecera -->
                    <div class="row row-cols-1 row-cols-md-3 g-4 mb-4">
                        <!-- Campo Cliente con Autocomplete -->
                        <div class="position-relative">
                            <label class="form-label text-secondary small mb-1">Cliente <span class="text-danger">*</span></label>
                            <input type="text" id="input-cliente-pago" class="form-control form-control-sm text-muted bg-white" placeholder="Buscar cliente..." autocomplete="off" ${this.state.isViewOnly ? 'disabled' : ''}>
                            <ul id="dropdown-cliente-pago" class="dropdown-menu w-100 shadow-sm" style="max-height: 200px; overflow-y: auto;"></ul>
                        </div>
                        <div class="col-md-3 mb-3 position-relative">
                            <label class="form-label text-secondary small mb-1">Cuenta bancaria <span class="text-danger">*</span> <i class="bi bi-question-circle text-danger" style="cursor:help;"></i></label>
                            <input type="text" id="input-cuenta-pago" class="form-control form-control-sm text-muted bg-white" placeholder="Buscar banco..." autocomplete="off" ${this.state.isViewOnly ? 'disabled' : ''}>
                            <ul id="dropdown-cuenta-pago" class="dropdown-menu w-100 shadow-sm" style="max-height: 200px; overflow-y: auto;"></ul>
                        </div>
                        <div class="col-md-3 mb-3">
                            <label class="form-label text-secondary small mb-1">Fecha de pago <span class="text-danger">*</span></label>
                            <input type="date" id="fecha-pago" class="form-control form-control-sm text-muted bg-white" value="${fechaHoy}" ${this.state.isViewOnly ? 'disabled' : ''}>
                        </div>
                    </div>
                    
                    <div class="row mb-5">
                        <div class="col-md-6 mb-3">
                            <label class="form-label text-secondary small mb-1">Forma de pago <span class="text-danger">*</span></label>
                            <select id="forma-pago" class="form-select form-select-sm text-muted bg-white" ${this.state.isViewOnly ? 'disabled' : ''}>
                                <option value="Consignación">Consignación</option>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Transferencia">Transferencia</option>
                            </select>
                        </div>

                        <!-- Centro de Costo -->
                        <div>
                            <label class="form-label text-secondary small mb-1">Centro de costo �?/label>
                            <select id="centro-costo-pago" class="form-select form-select-sm border-light-subtle text-muted" disabled>
                                <option value="">Seleccionar</option>
                            </select>
                        </div>
                    </div>

                    <!-- Selector Segmentado Tipo de Ingreso -->
                    <div class="mb-5">
                        <label class="form-label text-secondary small mb-1">Tipo de ingreso</label>
                        <div class="d-flex border border-light-subtle rounded-1 overflow-hidden" style="max-width: 100%;">
                            <button class="btn btn-sm w-50 py-2 fw-medium rounded-0 border-end border-light-subtle" id="tab-pago-factura" style="background-color: #f8f9fa; color: #0c1a30; font-size: 13px;">Pago a factura de cliente</button>
                            <button class="btn btn-sm w-50 py-2 fw-medium rounded-0 text-muted" id="tab-otros-ingresos" disabled style="background-color: #ffffff; font-size: 13px;">Otros ingresos</button>
                        </div>
                    </div>

                    <!-- Grilla Transaccional Facturas -->
                    <div class="mb-5">
                        <h5 class="fw-bold text-dark mb-1" style="font-size: 14px;">Facturas por cobrar</h5>
                        <p class="text-muted mb-3" style="font-size: 12px;">Agrega el monto recibido a las facturas relacionadas con este ingreso.</p>
                        
                        <div class="table-responsive" style="overflow: visible;">
                            <table class="table align-middle table-hover border-light-subtle" id="tabla-facturas-pendientes" style="font-size: 12px; border: 1px solid #f2f2f2;">
                                <thead style="background-color: #f9fbfd; color: #4e5d78;">
                                    <tr>
                                        <th class="py-2 border-bottom fw-semibold">Número</th>
                                        <th class="py-2 border-bottom fw-semibold">Vencimiento</th>
                                        <th class="py-2 border-bottom fw-semibold">Total</th>
                                        <th class="py-2 border-bottom fw-semibold" style="width: 110px;">Retenciones</th>
                                        <th class="py-2 border-bottom fw-semibold">Por cobrar</th>
                                        <th class="py-2 border-bottom fw-semibold" style="width: 160px;">Monto recibido</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-facturas-pago">
                                    <tr>
                                        <td colspan="6" class="text-center text-muted py-4">Selecciona un cliente válido para desplegar su estado de cartera pendiente.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Totales -->
                    <div class="d-flex justify-content-end align-items-center mb-4 py-3 border-top border-light-subtle">
                        <span class="text-secondary fw-semibold me-4" style="font-size: 15px;">Total</span>
                        <span class="fw-bold text-dark" id="total-pago-global" style="font-size: 20px;">$ 0,00</span>
                    </div>

                    <!-- Notas -->
                    <div class="mb-5">
                        <label class="form-label text-secondary small mb-1">Notas</label>
                        <textarea id="notas-pago" class="form-control text-muted bg-white" rows="2" style="font-size: 13px; border-radius: 4px;" placeholder="Agrega detalles adicionales que serán visibles en la impresión." ${this.state.isViewOnly ? 'disabled' : ''}></textarea>
                    </div>

                    <!-- Footer Guardar -->
                    <div class="d-flex justify-content-end border-top pt-4 gap-2" ${this.state.isViewOnly ? 'style="display: none !important;"' : ''}>
                        <button id="btn-cancelar-pago" class="btn btn-light fw-medium px-4 py-1-5 border" style="font-size: 13px; border-radius: 4px;">Cancelar</button>
                        <button id="btn-guardar-pago" class="btn text-white fw-medium px-4 py-1-5" style="background-color: #2cbfb7; font-size: 13px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">Guardar</button>
                    </div>
                </div>
            </div>
        `;
        
        CoreActions.bindActionEvents(this.element, this.state.pagoEditando, 'pago');
    },

    bindAutocomplete(inputId, dropdownId, dataset, onSelectCallback) {
        const input = this.element.querySelector('#' + inputId);
        const dropdown = this.element.querySelector('#' + dropdownId);

        const renderDropdown = (query = '') => {
            dropdown.innerHTML = '';
            
            const resultados = query 
                ? dataset.filter(item => item.nombre.toLowerCase().includes(query) || (item.nit && item.nit.toString().includes(query)))
                : dataset;

            if (resultados.length === 0) {
                dropdown.innerHTML = `<li class="dropdown-item text-muted small py-2">No se encontraron resultados</li>`;
            } else {
                resultados.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'dropdown-item py-2';
                    li.style.cursor = 'pointer';
                    li.innerHTML = `<strong>${item.nombre}</strong> ${item.nit ? `<span class="text-muted col-12 d-block small">NIT: ${item.nit}</span>` : ''}`;
                    li.addEventListener('click', (ev) => {
                        ev.stopPropagation(); 
                        input.value = item.nombre;
                        dropdown.classList.remove('show');
                        onSelectCallback(item);
                    });
                    dropdown.appendChild(li);
                });
            }
            dropdown.classList.add('show');
        };

        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query && dataset.length > 20) {
                dropdown.classList.remove('show');
                return;
            }
            renderDropdown(query);
        });

        input.addEventListener('focus', () => {
            const query = input.value.toLowerCase().trim();
            if (dataset.length <= 20 || query) {
                renderDropdown(query);
            }
        });

        document.addEventListener('click', (e) => {
            if (input && dropdown) {
                if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            }
        });
    },

    async seleccionarCliente(cliente) {
        this.state.clienteSeleccionado = cliente;
        await this.cargarFacturasCliente(cliente.id);
    },

    seleccionarCuenta(cuenta) {
        this.state.cuentaSeleccionada = cuenta;
    },

    renderizarFacturasAfectadasEnConsulta(distribucion) {
        const tbody = this.element.querySelector('#tbody-facturas-pago');
        if (!distribucion || distribucion.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Este documento no tiene facturas asociadas en el historial.</td></tr>`;
            return;
        }

        tbody.innerHTML = distribucion.map((d, index) => {
            const numDisplay = (d.facturaNumero || d.facturaId || 'Factura').toString().replace('fac_', '');
            return `
            <tr data-index="${index}">
                <td class="text-primary fw-medium py-2">${numDisplay}</td>
                <td style="color: var(--text-muted);">-</td>
                <td class="text-dark">$ ${parseFloat(d.montoAbonado || d.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                <td>-</td>
                <td class="fw-medium text-dark">$ 0.00</td>
                <td>
                    <div class="input-group input-group-sm border border-light-subtle rounded-1" style="background: #fff; max-width: 140px;">
                        <span class="input-group-text bg-transparent border-0 text-muted px-1" style="font-size:12px;">$</span>
                        <input type="number" step="any" class="form-control border-0 ps-1 input-monto-recibido fw-medium bg-white" data-index="${index}" value="${d.montoAbonado || d.total || 0}" disabled>
                    </div>
                </td>
            </tr>
            `;
        }).join('');

        const total = distribucion.reduce((sum, d) => sum + parseFloat(d.montoAbonado || d.total || 0), 0);
        this.actualizarTotalPantalla(total);
    },

    async cargarFacturasCliente(clienteId) {
        const tbody = this.element.querySelector('#tbody-facturas-pago');
        
        if (!clienteId) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Selecciona un cliente válido para desplegar su estado de cartera pendiente.</td></tr>`;
            this.actualizarTotalPantalla(0);
            return;
        }

        const facturas = await DB.getAll('facturas');
        const transacciones = await DB.getAll('transacciones');
        
        this.state.facturasPendientes = facturas
            .filter(f => (f.clienteId === clienteId || f.contactoId === clienteId) && f.tipo !== 'compra' && f.estado !== 'anulada')
            .map(f => {
                const pagosRelacionados = transacciones
                    .filter(t => t.referenciaId === f.id && t.tipo === 'ingreso' && t.pagoId !== this.state.pagoEditandoId)
                    .reduce((sum, t) => sum + t.monto, 0);
                
                const porCobrar = (f.total || 0) - pagosRelacionados;
                const numDisplay = (f.prefijo || '') + (f.numero || f.id.replace('fac_', ''));
                const isVencida = new Date(f.vencimiento) < new Date();
                
                return { 
                    ...f, 
                    numDisplay,
                    porCobrar, 
                    vencida: isVencida 
                };
            })
            .filter(f => f.porCobrar > 0.01) 
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)); 

        tbody.innerHTML = "";
        
        if (this.state.facturasPendientes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Este cliente no tiene facturas pendientes por cobrar.</td></tr>`;
            return;
        }

        this.state.facturasPendientes.forEach((fac, index) => {
            const dateStyle = fac.vencida ? 'color: #ef4444;' : 'color: var(--text-muted);';
            
            // Si editando, rellenar el input de monto recibido
            let valorEdit = '';
            if (this.state.pagoEditando && this.state.pagoEditando.distribucionCredito) {
                const distr = this.state.pagoEditando.distribucionCredito.find(d => d.facturaId === fac.id);
                if (distr && distr.montoAbonado > 0) {
                    valorEdit = distr.montoAbonado;
                }
            }

            tbody.innerHTML += `
                <tr data-index="${index}">
                    <td class="text-primary fw-medium py-2">${fac.numDisplay}</td>
                    <td style="${dateStyle}">${fac.vencimiento}</td>
                    <td class="text-dark">$ ${fac.total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                    <td>
                        <div class="input-group input-group-sm border border-light-subtle rounded-1" style="max-width: 90px; background: #fff;">
                            <span class="input-group-text bg-transparent border-0 text-muted px-1" style="font-size:11px;">$</span>
                            <input type="text" class="form-control border-0 ps-1 bg-transparent text-muted" value="0.00" readonly style="font-size:11px;">
                        </div>
                    </td>
                    <td class="fw-medium text-dark">$ ${fac.porCobrar.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                    <td>
                        <div class="input-group input-group-sm border border-light-subtle rounded-1" style="background: #fff; max-width: 140px;">
                            <span class="input-group-text bg-transparent border-0 text-muted px-1" style="font-size:12px;">$</span>
                            <input type="number" step="any" class="form-control border-0 ps-1 input-monto-recibido fw-medium ${this.state.isViewOnly ? 'bg-white' : ''}" data-index="${index}" min="0" max="${fac.porCobrar}" value="${valorEdit}" placeholder="0.00" ${this.state.isViewOnly ? 'disabled' : ''}>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        if (this.state.pagoEditando) {
            let total = 0;
            this.element.querySelectorAll('.input-monto-recibido').forEach(inp => {
                total += parseFloat(inp.value) || 0;
            });
            this.state.totalPagoCalculado = total;
            this.actualizarTotalPantalla(total);
        } else {
            this.actualizarTotalPantalla(0);
        }
    },

    validarYCalcularTotales(input) {
        const index = parseInt(input.getAttribute('data-index'));
        const factura = this.state.facturasPendientes[index];
        let valorIngresado = parseFloat(input.value) || 0;

        if (valorIngresado > factura.porCobrar) {
            input.value = factura.porCobrar;
            valorIngresado = factura.porCobrar;
            input.parentElement.classList.add('border-danger');
            CoreActions.showWarningModal(`El abono para la factura ${factura.numDisplay} no puede superar el saldo pendiente de $${factura.porCobrar.toLocaleString('es-CO')}`);
        } else if (valorIngresado < 0) {
            input.value = '';
            valorIngresado = 0;
        } else {
            input.parentElement.classList.remove('border-danger');
        }

        let totalAcumulado = 0;
        this.element.querySelectorAll('.input-monto-recibido').forEach(inp => {
            totalAcumulado += parseFloat(inp.value) || 0;
        });

        this.state.totalPagoCalculado = totalAcumulado;
        this.actualizarTotalPantalla(totalAcumulado);
    },

    actualizarTotalPantalla(valor) {
        this.element.querySelector('#total-pago-global').innerText = `$ ${valor.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    async bindEvents() {
        this.element.querySelector('#btn-volver-pagos').addEventListener('click', () => {
            window.location.hash = '#/ingresos/pagos';
        });

        this.element.querySelector('#btn-cancelar-pago').addEventListener('click', () => {
            window.location.hash = '#/ingresos/pagos';
        });

        const tbody = this.element.querySelector('#tbody-facturas-pago');
        tbody.addEventListener('input', (e) => {
            if (e.target.classList.contains('input-monto-recibido')) {
                this.validarYCalcularTotales(e.target);
            }
        });

        // Navegación desde el número de factura
        tbody.addEventListener('click', (e) => {
            if (e.target.classList.contains('text-primary')) {
                const facturaId = e.target.innerText.trim();
                window.location.hash = `#/ingresos/facturas/ver/fac_${facturaId}`;
            }
        });

        this.element.querySelector('#btn-guardar-pago').addEventListener('click', async () => {
            await this.procesarGuardadoPago();
        });
    },

    async procesarGuardadoPago() {
        const btnGuardar = this.element.querySelector('#btn-guardar-pago');
        const clienteSeleccionado = this.state.clienteSeleccionado;
        const cuentaSeleccionada = this.state.cuentaSeleccionada;
        const fecha = this.element.querySelector('#fecha-pago').value;
        const formaPago = this.element.querySelector('#forma-pago').value;
        const notas = this.element.querySelector('#notas-pago').value;
        const nroRecibo = this.element.querySelector('#lbl-nro-recibo').innerText;

        if (!clienteSeleccionado) {
            CoreActions.showWarningModal("Debe seleccionar un cliente del buscador.");
            return;
        }

        if (!cuentaSeleccionada) {
            const inputCuentaStr = this.element.querySelector('#input-cuenta-pago').value;
            if (!inputCuentaStr) {
                CoreActions.showWarningModal("Debe seleccionar una cuenta bancaria.");
                return;
            } else {
                this.state.cuentaSeleccionada = { id: inputCuentaStr, nombre: inputCuentaStr };
            }
        }

        if (this.state.totalPagoCalculado <= 0) {
            CoreActions.showWarningModal("No se puede guardar un recibo de caja sin distribuciones o con valor total de cero.");
            return;
        }

        btnGuardar.disabled = true;

        try {
            const pagoId = this.state.pagoEditandoId || ('pago_' + Date.now());
            const distribucionCredito = [];

            this.element.querySelectorAll('.input-monto-recibido').forEach(inp => {
                const valor = parseFloat(inp.value) || 0;
                if (valor > 0) {
                    const idx = parseInt(inp.getAttribute('data-index'));
                    const fac = this.state.facturasPendientes[idx];
                    distribucionCredito.push({
                        facturaId: fac.id,
                        facturaNumero: fac.numDisplay,
                        montoAbonado: valor,
                        saldoAnterior: fac.porCobrar,
                        nuevoSaldo: fac.porCobrar - valor
                    });
                }
            });

            const pagoFinalizado = {
                id: pagoId,
                nroRecibo: nroRecibo,
                clienteId: clienteSeleccionado.id,
                cuentaBancaria: this.state.cuentaSeleccionada.id,
                fecha: fecha,
                formaPago: formaPago,
                totalDebito: this.state.totalPagoCalculado,
                distribucionCredito: distribucionCredito,
                notas: notas
            };

            if (this.state.pagoEditandoId) {
                // Eliminar transacciones antiguas asociadas a este pago
                const oldTrans = await DB.getAll('transacciones');
                const transToDelete = oldTrans.filter(t => t.pagoId === this.state.pagoEditandoId);
                for (const t of transToDelete) {
                    await DB.delete('transacciones', t.id);
                }

                // Revertir el estado 'pagada' de facturas asociadas previamente
                if (this.state.pagoEditando && this.state.pagoEditando.distribucionCredito) {
                    for(const asig of this.state.pagoEditando.distribucionCredito) {
                        const facDb = await DB.get('facturas', asig.facturaId);
                        if (facDb && facDb.estado === 'pagada') {
                            facDb.estado = 'por_pagar';
                            await DB.save('facturas', facDb);
                        }
                    }
                }
            }

            await DB.save('pagos', pagoFinalizado);

            for (const asig of distribucionCredito) {
                const transaccion = {
                    id: `trans_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    cuentaId: this.state.cuentaSeleccionada.id,
                    tipo: 'ingreso',
                    monto: asig.montoAbonado,
                    fecha: fecha,
                    detalle: `Recibo de caja #${nroRecibo} (Abono a Fac ${asig.facturaNumero})`,
                    referenciaId: asig.facturaId,
                    pagoId: pagoId
                };
                await DB.save('transacciones', transaccion);

                const facDb = await DB.get('facturas', asig.facturaId);
                if (facDb && asig.nuevoSaldo <= 0.01) {
                    facDb.estado = 'pagada'; 
                    await DB.save('facturas', facDb);
                }
            }

            CoreActions.showWarningModal(`Recibo de caja #${nroRecibo} guardado con éxito.`);
            
            setTimeout(() => {
                window.location.hash = '#/ingresos/pagos';
            }, 2000);
            
        } catch (error) {
            console.error("Error crítico en el guardado contable:", error);
            CoreActions.showWarningModal("Error de consistencia: Asegúrate de que el cliente y las facturas estén correctamente cargados en el estado.");
            btnGuardar.disabled = false;
        }
    }
};
