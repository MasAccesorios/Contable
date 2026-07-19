import DB from '../../db.js';
import { CoreActions } from '../../utils/core-actions.js';
import { TesoreriaModule } from '../tesoreria.js';

export const PagosVerModule = {
    state: {
        pagoActual: null
    },

    async init(element) {
        if (typeof window.cleanupFloatingElements === 'function') {
            window.cleanupFloatingElements();
        }
        this.element = element;
        const hash = window.location.hash;
        const parts = hash.split('/');
        const id = parts[parts.length - 1];
        await this.cargarDatosPago(id);
    },

    async cargarDatosPago(id) {
        let pagoEncontrado = await DB.get('pagos', id);
        
        // Fallback robusto por si buscan por número en vez de ID
        if (!pagoEncontrado) {
            const todos = await DB.getAll('pagos');
            pagoEncontrado = todos.find(p => p.numero == id || p.nroRecibo == id);
        }

        if (!pagoEncontrado) {
            // Manejo de error si no existe el pago
            this.element.innerHTML = `<div class="p-5 text-center text-muted"><h4>Pago no encontrado</h4></div>`;
            return;
        }

        // Resolver nombre del cliente
        let clienteNombre = pagoEncontrado.cliente || 'Desconocido';
        if (pagoEncontrado.clienteId) {
            const cliente = await DB.get('contactos', pagoEncontrado.clienteId);
            if (cliente) clienteNombre = cliente.nombre;
        }

        // Resolver cuenta bancaria
        let nombreCuenta = pagoEncontrado.cuentaBancaria || 'No especificada';
        if (nombreCuenta.startsWith('b')) {
            const idx = parseInt(nombreCuenta.substring(1)) - 1;
            if (TesoreriaModule.cuentasConfig[idx]) {
                nombreCuenta = TesoreriaModule.cuentasConfig[idx].nombre;
            }
        }

        this.state.pagoActual = {
            id: pagoEncontrado.id,
            numero: pagoEncontrado.nroRecibo || pagoEncontrado.id,
            valorTotal: pagoEncontrado.totalDebito || pagoEncontrado.monto || 0,
            estado: pagoEncontrado.estado || "No conciliado",
            cliente: clienteNombre,
            fechaCreacion: pagoEncontrado.fecha || pagoEncontrado.creacion,
            cuentaBancaria: nombreCuenta,
            facturasAsociadas: pagoEncontrado.distribucionCredito || []
        };

        this.render();
        this.bindEvents();
    },

    render() {
        const p = this.state.pagoActual;
        
        // Normalización de datos ya resueltos
        const numero = p.numero;
        const valorTotal = p.valorTotal;
        const clienteNombre = p.cliente;
        const cuentaBancaria = p.cuentaBancaria;
        const fecha = p.fechaCreacion;
        const estado = p.estado;
        
        const facturasFuente = p.facturasAsociadas;

        const valorFormateado = valorTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
        
        const facturasHtml = facturasFuente.map(f => {
            const num = f.numero || f.facturaNumero || f.facturaId || "---";
            const date = f.fechaCreacion || fecha;
            const total = ((f.montoAbonado || f.pagado || 0) + (f.nuevoSaldo || f.porCobrar || 0)).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
            const pag = (f.montoAbonado || f.pagado || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
            const pco = (f.nuevoSaldo || f.porCobrar || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
            return `
                <tr>
                    <td class="text-primary ps-4" style="color: #6366f1 !important; font-size: 13px;">${num}</td>
                    <td class="text-muted" style="font-size: 13px;">${date}</td>
                    <td style="font-size: 13px;">${total}</td>
                    <td style="font-size: 13px;">${pag}</td>
                    <td class="pe-4" style="font-size: 13px;">${pco}</td>
                </tr>
            `;
        }).join('') || `<tr><td colspan="5" class="text-center text-muted py-3">No hay facturas asociadas</td></tr>`;

        this.element.innerHTML = `
            <div class="py-4 px-3" style="font-family: 'Inter', sans-serif; background-color: #f8f9fc; min-height: 100vh; font-size: 14px;">
                
                <!-- BARRA SUPERIOR ALINEADA CON BOTONERA COMPACTA -->
                <div class="d-flex justify-content-between align-items-center mb-4" style="max-width: 1000px; margin: 0 auto;">
                    <div>
                        <a href="#/ingresos/pagos" class="text-decoration-none" style="font-size: 13px; color: #2cbfb7;" id="btn-volver-listado">← Volver a mis pagos recibidos</a>
                        <h2 class="fw-bold text-dark mt-2 mb-0" style="font-size: 24px;">Pago recibido ${numero}</h2>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-light border bg-white text-secondary" style="border-radius: 6px; padding: 6px 12px;"><i class="bi bi-three-dots-vertical"></i></button>
                        <button class="btn btn-light border bg-white text-secondary" style="border-radius: 6px; padding: 6px 12px;"><i class="bi bi-envelope"></i></button>
                        <button class="btn btn-light border bg-white text-secondary" id="btn-print" style="border-radius: 6px; padding: 6px 12px;"><i class="bi bi-printer"></i></button>
                        <a href="#/ingresos/pagos/editar/${p.id || numero}" class="btn btn-light border bg-white fw-medium text-dark d-flex align-items-center shadow-sm" style="border-radius: 6px; padding: 6px 16px;"><i class="bi bi-pencil me-2" style="font-size: 13px;"></i>Editar pago</a>
                    </div>
                </div>

                <div style="max-width: 1000px; margin: 0 auto;">
                    <!-- TARJETA VALOR TOTAL -->
                    <div class="card border-0 shadow-sm mb-4" style="border-radius: 8px;">
                        <div class="card-body p-4">
                            <span class="text-muted d-block mb-1" style="font-size: 13px;">Valor total</span>
                            <h3 class="fw-bold m-0 text-dark" style="font-size: 28px; letter-spacing: -0.5px;">${valorFormateado}</h3>
                        </div>
                    </div>

                    <!-- TARJETA INFORMACIÓN -->
                    <div class="card border-0 shadow-sm mb-4" style="border-radius: 8px;">
                        <div class="card-body p-4">
                            <h5 class="fw-bold mb-4 text-dark" style="font-size: 16px;">Información del pago</h5>
                            
                            <div class="row mb-4">
                                <div class="col-md-6">
                                    <span class="text-muted d-block mb-2" style="font-size: 13px;">Estado</span>
                                    <span class="badge bg-white text-secondary border fw-normal px-2 py-1" style="font-size: 12px;">${estado}</span>
                                </div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6 mb-4 mb-md-0">
                                    <span class="text-muted d-block mb-2" style="font-size: 13px;">Cliente</span>
                                    <a href="#" class="text-decoration-none" style="color: #6366f1; font-size: 13px;">${clienteNombre}</a>
                                </div>
                                <div class="col-md-6">
                                    <span class="text-muted d-block mb-2" style="font-size: 13px;">Fecha de creación</span>
                                    <span class="text-dark" style="font-size: 13px;">${fecha}</span>
                                </div>
                            </div>

                            <div class="row mt-4">
                                <div class="col-md-12">
                                    <span class="text-muted d-block mb-2" style="font-size: 13px;">Cuenta bancaria</span>
                                    <a href="#" class="text-decoration-none" style="color: #6366f1; font-size: 13px;">${cuentaBancaria}</a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TARJETA ARCHIVOS ADJUNTOS -->
                    <div class="card border-0 shadow-sm mb-4" style="border-radius: 8px;">
                        <div class="card-body p-4">
                            <h5 class="fw-bold mb-4 text-dark" style="font-size: 16px;">Archivos adjuntos</h5>
                            <div class="text-center py-5 border rounded" style="background-color: #fefefe; border-color: #f1f3f5 !important;">
                                <p class="text-muted mb-4" style="font-size: 13px;">Puedes subir archivos relacionados con este pago recibido</p>
                                <button class="btn btn-light border bg-white shadow-sm fw-medium text-dark" style="border-radius: 6px; font-size: 13px;"><i class="bi bi-upload me-2 text-secondary"></i>Subir archivo</button>
                            </div>
                        </div>
                    </div>

                    <!-- TARJETA TABS FACTURAS -->
                    <div class="card border-0 shadow-sm mb-4" style="border-radius: 8px;">
                        <div class="card-header bg-white border-bottom pt-4 px-4 pb-0">
                            <ul class="nav nav-tabs border-bottom-0" style="gap: 15px;">
                                <li class="nav-item">
                                    <a class="nav-link active border-0 border-bottom border-3 text-dark fw-medium px-1 pb-3" href="#" style="background: transparent; border-color: #2cbfb7 !important; color: #333 !important; font-size: 14px;">Facturas asociadas</a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link border-0 text-muted px-1 pb-3" href="#" style="background: transparent; font-size: 14px;">Aplicación de anticipo</a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link border-0 text-muted px-1 pb-3" href="#" style="background: transparent; font-size: 14px;">Contabilidad</a>
                                </li>
                            </ul>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table align-middle mb-0" style="border-collapse: separate; border-spacing: 0;">
                                    <thead style="background-color: #fcfcfd;">
                                        <tr>
                                            <th class="border-top-0 border-bottom text-muted fw-medium py-3 ps-4" style="font-size: 12px; font-weight: 500;">Número</th>
                                            <th class="border-top-0 border-bottom text-muted fw-medium py-3" style="font-size: 12px; font-weight: 500;">Fecha de creación</th>
                                            <th class="border-top-0 border-bottom text-muted fw-medium py-3" style="font-size: 12px; font-weight: 500;">Total</th>
                                            <th class="border-top-0 border-bottom text-muted fw-medium py-3" style="font-size: 12px; font-weight: 500;">Pagado</th>
                                            <th class="border-top-0 border-bottom text-muted fw-medium py-3 pe-4" style="font-size: 12px; font-weight: 500;">Por cobrar</th>
                                        </tr>
                                    </thead>
                                    <tbody style="border-top: none;">
                                        ${facturasHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- TARJETA COMENTARIOS -->
                    <div class="card border-0 shadow-sm mb-5" style="border-radius: 8px;">
                        <div class="card-header bg-white border-bottom pt-4 px-4 pb-0">
                            <ul class="nav nav-tabs border-bottom-0" style="gap: 15px;">
                                <li class="nav-item">
                                    <a class="nav-link active border-0 border-bottom border-3 text-dark fw-medium px-1 pb-3" href="#" style="background: transparent; border-color: #2cbfb7 !important; color: #333 !important; font-size: 14px;">Comentarios</a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link border-0 text-muted px-1 pb-3" href="#" style="background: transparent; font-size: 14px;">Recordatorios <i class="bi bi-question-circle text-secondary ms-1"></i></a>
                                </li>
                            </ul>
                        </div>
                        <div class="card-body p-4">
                            <div class="d-flex justify-content-between mb-4">
                                <button class="btn btn-sm btn-light rounded-pill border px-3 text-info fw-medium" style="background-color: #e9fbfb; border-color: #bdf2f0 !important;"><i class="bi bi-search me-1"></i> Recientes <span class="ms-1" style="font-size: 10px;">↓</span></button>
                                <button class="btn btn-sm text-muted border-0 bg-transparent"><i class="bi bi-arrows-expand"></i></button>
                            </div>
                            <div class="text-center py-4 mb-4">
                                <div style="display:inline-block; border-radius:50%; border:2px solid #2cbfb7; width:45px; height:45px; line-height:41px; margin-bottom:15px;">
                                    <i class="bi bi-chat-left-text" style="font-size: 20px; color: #2cbfb7;"></i>
                                </div>
                                <span class="text-muted d-block" style="font-size: 13px;">Aún no hay comentarios</span>
                            </div>
                            <div class="border rounded p-3 bg-white">
                                <textarea class="form-control border-0 bg-transparent mb-2 shadow-none" placeholder="Escribe un comentario" rows="1" style="font-size: 13px; resize: none;"></textarea>
                                <div class="text-muted mb-2" style="font-size: 11.5px;">Menciona con @, asigna tareas o agenda recordatorios para tu equipo</div>
                                <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                                    <div>
                                        <button class="btn btn-sm border-0 bg-transparent text-secondary p-1 me-1"><i class="bi bi-type-bold"></i></button>
                                        <button class="btn btn-sm border-0 bg-transparent text-secondary p-1"><i class="bi bi-at"></i></button>
                                    </div>
                                    <div class="text-muted d-flex align-items-center" style="font-size: 11px;">
                                        <span class="me-3">0/1000</span>
                                        <button class="btn btn-sm text-white px-2 py-1" style="background-color: #adb5bd; border-radius: 4px;"><i class="bi bi-send-fill" style="font-size: 12px;"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    bindEvents() {
        const btnPrint = this.element.querySelector('#btn-print');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                CoreActions.printDocumentFormat(this.state.pagoActual, 'recibo');
            });
        }
    }
};
