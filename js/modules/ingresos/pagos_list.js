import DB from '../../db.js';
import { TesoreriaModule } from '../tesoreria.js';

export const PagosListModule = {
    state: {
        pagos: []
    },

    async init(element) {
        if (!element) return;
        
        if (typeof window.cleanupFloatingElements === 'function') {
            window.cleanupFloatingElements();
        }
        
        this.element = element;
        await this.cargarPagos();
    },

    async cargarPagos() {
        // Cargar los pagos reales del sistema desde IndexedDB
        let pagosData = await DB.getAll('pagos');
        pagosData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        const contactos = await DB.getAll('contactos');
        
        // Mapear los datos para la vista
        this.state.pagos = pagosData.map(p => {
            const cliente = contactos.find(c => c.id === p.clienteId);
            
            // Resolver la cuenta bancaria (b1 -> NU Bank Ahorros, etc)
            let nombreCuenta = p.cuentaBancaria;
            if (nombreCuenta && nombreCuenta.startsWith('b')) {
                // Es un ID mapeado del TesoreriaModule
                const idx = parseInt(nombreCuenta.substring(1)) - 1;
                if (TesoreriaModule.cuentasConfig[idx]) {
                    nombreCuenta = TesoreriaModule.cuentasConfig[idx].nombre;
                }
            }
            
            const nroFacturas = p.distribucionCredito ? p.distribucionCredito.length : 0;
            
            let fechaFormateada = p.fecha;
            if(p.fecha && p.fecha.includes('-')) {
                const partes = p.fecha.split('-');
                if(partes.length === 3) fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }

            return {
                id: p.id,
                numero: p.nroRecibo || p.id,
                cliente: cliente ? cliente.nombre : '---',
                detalles: p.formaPago === 'Transferencia' ? 'Transferencias ban...' : `Facturas: ${nroFacturas}`,
                creacion: fechaFormateada,
                cuentaBancaria: nombreCuenta || 'No especificada',
                estado: p.estado || 'No conciliado',
                monto: p.totalDebito || 0
            };
        });

        this.render();
        this.bindEvents();
    },

    render() {
        this.element.innerHTML = `
            <div class="py-3 px-4" style="font-family: 'Inter', sans-serif; background-color: #f8f9fa; min-height: 100vh; font-size: 13px;">
                
                <!-- ENCABEZADO CON BOTÓN NUEVO PAGO -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="fw-bold text-dark m-0" style="font-size: 22px; color: #0c1a30 !important;">Pagos recibidos</h2>
                        <p class="text-muted m-0 mt-1" style="font-size: 13px;">Registra y organiza todos los pagos que recibes en tu empresa. <a href="#" class="text-info text-decoration-none" style="color: #2cbfb7 !important;">Saber más</a></p>
                    </div>
                    <button id="btn-nuevo-pago" class="btn text-white px-3 py-2 fw-medium shadow-sm" style="background-color: #2cbfb7; border-color: #2cbfb7; border-radius: 4px; font-size: 13px;">+ Nuevo pago recibido</button>
                </div>

                <!-- CONTENEDOR PRINCIPAL DE LA TABLA ESTILO ALEGRA -->
                <div class="card shadow-sm border border-light-subtle bg-white" style="border-radius: 6px;">
                    
                    <!-- BARRA DE FILTRAR ACCESIBLE -->
                    <div class="card-header bg-white border-bottom-0 p-3">
                        <button class="btn btn-sm btn-white border border-light-subtle rounded text-secondary d-flex align-items-center gap-1 bg-white px-3" style="padding-top: 5px; padding-bottom: 5px;">
                            <span>🔍</span> Filtrar
                        </button>
                    </div>

                    <!-- TABLA DE PAGOS -->
                    <div class="table-responsive">
                        <table class="table align-middle table-hover m-0 text-nowrap">
                            <thead class="table-light text-secondary fw-semibold border-bottom" style="--bs-table-bg: #f9fbfd; font-size: 12px;">
                                <tr>
                                    <th style="width: 40px;" class="ps-3"><input type="checkbox" class="form-check-input"></th>
                                    <th class="py-2.5">Número</th>
                                    <th>Cliente</th>
                                    <th>Detalles</th>
                                    <th>Creación</th>
                                    <th>Cuenta bancaria</th>
                                    <th>Estado</th>
                                    <th class="text-end pe-4">Monto</th>
                                    <th style="width: 50px;"></th>
                                </tr>
                            </thead>
                            <tbody style="font-size: 13px; color: #2c3e50;">
                                ${this.state.pagos.length > 0 ? this.state.pagos.map(pago => {
                                    const nombreCuenta = pago.cuentaBancaria;
                                    const esConciliado = pago.estado === 'Conciliado';
                                    
                                    return `
                                        <tr style="cursor: pointer;" data-id="${pago.id}">
                                            <td class="ps-3"><input type="checkbox" class="form-check-input row-checkbox"></td>
                                            <td class="text-primary fw-medium btn-ver-pago" style="color: #6366f1 !important;">${pago.numero}</td>
                                            <td class="text-muted btn-ver-pago text-truncate" style="max-width: 150px;">${pago.cliente}</td>
                                            <td class="text-muted btn-ver-pago text-truncate" style="max-width: 150px;">${pago.detalles}</td>
                                            <td class="text-muted btn-ver-pago">${pago.creacion}</td>
                                            <!-- SOLUCIÓN DEL ERROR: Inyección limpia del valor evaluado -->
                                            <td class="text-dark fw-medium btn-ver-pago text-truncate" style="max-width: 150px;">${nombreCuenta}</td>
                                            <td class="btn-ver-pago">
                                                <span class="d-flex align-items-center gap-1.5">
                                                    <span style="color: ${esConciliado ? '#22c55e' : '#cbd5e1'}; font-size: 14px;">${esConciliado ? '✓' : '○'}</span>
                                                    <span class="text-secondary" style="font-size: 12.5px;">${pago.estado}</span>
                                                </span>
                                            </td>
                                            <td class="text-end fw-bold pe-4 text-dark btn-ver-pago">
                                                $ ${(pago.monto || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td class="pe-3 position-relative">
                                                <button class="btn btn-sm btn-link text-secondary p-0 border-0 dropdown-toggle-acciones" style="text-decoration: none; font-size: 16px;">⋮</button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('') : `
                                    <tr>
                                        <td colspan="9" class="text-center text-muted py-5">
                                            <div class="mb-3"><i class="bi bi-inbox fs-1"></i></div>
                                            <p class="mb-0">No se encontraron pagos o recibos de caja.</p>
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>

                    <!-- PIE DE PÁGINA (PAGINADOR FIJO ESTILO ALEGRA) -->
                    <div class="card-footer bg-white border-top d-flex justify-content-between align-items-center px-4 py-3 text-muted" style="font-size: 12px;">
                        <div class="d-flex align-items-center gap-2">
                            <span>Ítems por página:</span>
                            <select class="form-select form-select-sm border-light-subtle" style="width: 65px; font-size: 12px; padding-top: 2px; padding-bottom: 2px;">
                                <option>20</option>
                                <option>50</option>
                            </select>
                            <span class="ms-2">1-${Math.min(20, this.state.pagos.length)} de ${this.state.pagos.length}</span>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <span>Página <input type="text" value="1" class="form-control form-control-sm d-inline-block text-center" style="width: 35px; font-size: 12px; padding-top: 2px; padding-bottom: 2px;"> de 1</span>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-light border py-0 px-2" disabled>‹</button>
                                <button class="btn btn-sm btn-light border py-0 px-2" disabled>›</button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;
    },

    bindEvents() {
        // Evento para navegar a la creación de un nuevo pago
        const btnNuevo = this.element.querySelector('#btn-nuevo-pago');
        if (btnNuevo) {
            btnNuevo.addEventListener('click', () => {
                window.location.hash = '#/ingresos/pagos/nuevo';
            });
        }

        // Evento para ingresar al detalle del pago al hacer clic sobre cualquier celda permitida
        this.element.querySelectorAll('.btn-ver-pago').forEach(element => {
            element.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                if (row) {
                    const id = row.getAttribute('data-id');
                    window.location.hash = `#/ingresos/pagos/ver/${id}`;
                }
            });
        });

        // Manejador del menú de acciones flotantes rápidas
        this.element.querySelectorAll('.dropdown-toggle-acciones').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                if (typeof window.cleanupFloatingElements === 'function') {
                    window.cleanupFloatingElements();
                }

                const row = e.target.closest('tr');
                const id = row.getAttribute('data-id');
                const rect = e.target.getBoundingClientRect();
                
                const pago = this.state.pagos.find(p => p.id == id);
                if (!pago) return;

                const menu = document.createElement('div');
                menu.className = 'dropdown-menu row-actions-menu show shadow-sm border border-light-subtle';
                menu.style.position = 'fixed';
                menu.style.top = `${rect.bottom + window.scrollY}px`;
                menu.style.left = `${rect.left - 120}px`;
                menu.style.zIndex = '1050';
                menu.style.minWidth = '140px';
                menu.style.fontSize = '13px';
                menu.style.borderRadius = '6px';
                
                menu.innerHTML = `
                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-print-${id}">
                        <i class="bi bi-printer text-secondary"></i> Imprimir
                    </a>
                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#/ingresos/pagos/editar/${pago.numero}">
                        <i class="bi bi-pencil text-secondary"></i> Editar
                    </a>
                    <a class="dropdown-item py-2 d-flex align-items-center gap-2 text-dark" href="#" id="action-anular-${id}">
                        <i class="bi bi-x-circle text-secondary"></i> Anular
                    </a>
                    <div class="dropdown-divider my-1"></div>
                    <a class="dropdown-item py-2 text-danger d-flex align-items-center gap-2" href="#" id="action-eliminar-${id}">
                        <i class="bi bi-trash"></i> Eliminar
                    </a>
                `;

                document.body.appendChild(menu);

                // Eventos del menú
                document.getElementById(`action-print-${id}`)?.addEventListener('click', async (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const pagoReal = await DB.get('pagos', id);
                    if (pagoReal) {
                        import('../../utils/core-actions.js').then(m => {
                            m.CoreActions.printDocumentFormat(pagoReal, 'recibo');
                        });
                    }
                    window.cleanupFloatingElements();
                });

                document.getElementById(`action-anular-${id}`)?.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    import('../../utils/core-actions.js').then(m => {
                        m.CoreActions.showWarningModal('La función de anular está actualmente en desarrollo. Pronto estará disponible.');
                    });
                    window.cleanupFloatingElements();
                });

                document.getElementById(`action-eliminar-${id}`)?.addEventListener('click', async (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if(confirm('¿Estás seguro de eliminar este pago recibido de forma permanente?')) {
                        await DB.delete('pagos', id);
                        this.cargarPagos(); // Recargar listado
                    }
                    window.cleanupFloatingElements();
                });

                // Cerrar al hacer clic fuera
                const closeMenu = (ev) => {
                    if (!menu.contains(ev.target)) {
                        window.cleanupFloatingElements();
                        document.removeEventListener('click', closeMenu);
                    }
                };
                setTimeout(() => document.addEventListener('click', closeMenu), 0);
            });
        });
        
        // Evitar que el checkbox abra la vista de detalle
        this.element.querySelectorAll('.row-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => e.stopPropagation());
        });
    }
};
