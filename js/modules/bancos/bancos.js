// js/modules/bancos/bancos.js
import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';

import { TesoreriaData } from './bancos.data.js';
import { TesoreriaTemplates } from './bancos.templates.js';
import { TesoreriaEvents } from './bancos.events.js';
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

    state: {
        transacciones: [],
        saldos: {},
        totalConsolidado: 0,
        chartInstance: null
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        element.innerHTML = `
            <div class="dash-layout p-4">
                <!-- TOP BAR -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Bancos</h2>
                        <p class="text-muted mb-0" style="font-size: var(--fs-md);">Controla los movimientos de dinero con tus cuentas de banco, efectivo y tarjetas de crédito.</p>
                    </div>
                    <div class="d-flex gap-2">
                        <button id="btn-transferir" class="btn bg-white border fw-medium shadow-sm d-flex align-items-center px-3" style="color: var(--text-body); font-size: var(--fs-md); border-radius: 6px;">
                            <i class="bi bi-arrow-down-up me-2"></i> Transferir
                        </button>
                        <button id="btn-agregar-banco" class="btn btn-primary-action">
                            <i class="bi bi-plus-lg me-2"></i> Agregar banco
                        </button>
                    </div>
                </div>

                <!-- KPI CARDS BANCOS -->
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Saldo Total en Cuentas</span>
                                <div class="dash-icon-box variant-blue">
                                    <i class="bi bi-bank"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="kpi-saldo-total">$ 0</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Cuentas Bancarias Activas</span>
                                <div class="dash-icon-box variant-green">
                                    <i class="bi bi-credit-card"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="kpi-bancos-activos">0</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Cajas / Efectivo</span>
                                <div class="dash-icon-box variant-yellow">
                                    <i class="bi bi-cash"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="kpi-efectivo-activos">0</div>
                        </div>
                    </div>
                </div>

                <!-- ROW FOR CHART AND RESUMEN -->
                <div class="row g-4 mb-4">
                    <!-- Chart -->
                    <div class="col-md-8">
                        <div class="card border-0 h-100" style="background: var(--surface); box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                            <div class="card-body p-4">
                                <div class="d-flex justify-content-between align-items-center mb-4">
                                    <h5 class="fw-bold mb-0" style="color: var(--text-main); font-size: var(--fs-lg);">Ingresos y gastos</h5>
                                    <select id="select-chart-rango" class="form-select form-select-sm border text-muted fw-medium" style="width: auto; border-radius: 6px; box-shadow: none;">
                                        <option value="1">1 mes</option>
                                        <option value="3">3 meses</option>
                                        <option value="6" selected>6 meses</option>
                                    </select>
                                </div>
                                <div style="height: 250px; position: relative;">
                                    <canvas id="chart-ingresos-gastos"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Resumen -->
                    <div class="col-md-4">
                        <div class="card border-0 h-100" style="background: var(--surface); box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                            <div class="card-body p-4 d-flex flex-column">
                                <h5 class="fw-bold mb-4" style="color: var(--text-main); font-size: var(--fs-lg);">Resumen</h5>
                                
                                <div class="mb-4">
                                    <p class="text-muted mb-1" style="font-size: var(--fs-base);">Saldo en bancos y efectivo</p>
                                    <h3 class="fw-bold mb-0" style="color: var(--primary);" id="resumen-bancos">$0,00</h3>
                                </div>
                                
                                <div class="mb-4 d-flex align-items-center justify-content-center" style="position: relative;">
                                    <hr class="w-100 text-muted m-0 opacity-25">
                                    <span class="px-2 position-absolute text-muted opacity-50" style="font-size: var(--fs-sm); background: var(--surface);"><i class="bi bi-dash-circle"></i></span>
                                </div>
                                
                                <div class="mt-2">
                                    <p class="text-muted mb-1" style="font-size: var(--fs-base);">Saldo total</p>
                                    <h3 class="fw-bold mb-0" style="color: var(--text-main);" id="resumen-total">$0,00</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TABLE -->
                <div class="dash-table-container">
                    <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center" style="border-radius: 8px 8px 0 0;">
                        <div class="input-group input-group-sm" style="width: 300px;">
                            <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                            <input type="text" id="search-bancos" class="form-control border-start-0 ps-0 text-muted" placeholder="Buscar bancos..." style="font-size: var(--fs-base); box-shadow: none;">
                        </div>
                        <button id="btn-actualizar-bancos" class="btn btn-sm btn-light border text-muted ms-auto d-flex align-items-center px-3" style="font-weight: 500; font-size: var(--fs-base);">
                            <i class="bi bi-arrow-clockwise me-2"></i> Actualizar datos
                        </button>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0 table-hover">
                            <thead style="border-bottom: 1px solid var(--border-color);">
                                <tr style="color: var(--text-muted); font-size: var(--fs-base); font-weight: var(--weight-medium); white-space: nowrap;">
                                    <th class=\"py-2 fw-normal ps-4\">Nombre</th>
                                    <th class=\"py-2 fw-normal\">Tipo de cuenta</th>
                                    <th class=\"py-2 fw-normal\">Número de cuenta</th>
                                    <th class=\"py-2 fw-normal\">Saldo</th>
                                    <th class=\"py-2 fw-normal pe-4\">Conciliación</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-bancos">
                                <tr><td colspan="5" class="text-center py-5 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Cargando bancos...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- MODAL TRANSFERIR -->
            <div class="modal fade" id="modal-transferir" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow" style="border-radius: 12px;">
                        <div class="modal-header border-bottom-0 pb-0">
                            <h5 class="modal-title fw-bold" style="color: var(--text-main);">Transferir entre cuentas</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4">
                            <form id="form-transferir">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Cuenta origen *</label>
                                    <select class="form-select" id="transf-origen" required>
                                        <option value="" disabled selected>Selecciona el origen</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Cuenta destino *</label>
                                    <select class="form-select" id="transf-destino" required>
                                        <option value="" disabled selected>Selecciona el destino</option>
                                    </select>
                                </div>
                                <div class="row g-3 mb-3">
                                    <div class="col-6">
                                        <label class="form-label text-muted small fw-semibold">Monto *</label>
                                        <input type="text" class="form-control fw-bold fs-5" id="transf-monto" required>
                                    </div>
                                    <div class="col-6">
                                        <label class="form-label text-muted small fw-semibold">Fecha *</label>
                                        <input type="date" class="form-control" id="transf-fecha" value="${getLocalDate()}" required>
                                    </div>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label text-muted small fw-semibold">Nota o referencia (Opcional)</label>
                                    <input type="text" class="form-control" id="transf-nota" placeholder="Ej. Traspaso de fondos">
                                </div>
                                <div class="d-flex gap-2 justify-content-end">
                                    <button type="button" class="btn btn-light border px-4" data-bs-dismiss="modal">Cancelar</button>
                                    <button type="submit" class="btn text-white px-4" style="background-color: var(--primary);" id="btn-confirmar-transf">Transferir</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODAL AGREGAR BANCO -->
            <div class="modal fade" id="modal-agregar-banco" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow" style="border-radius: 12px;">
                        <div class="modal-header border-bottom-0 pb-0">
                            <h5 class="modal-title fw-bold" style="color: var(--text-main);">Agregar cuenta bancaria</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4">
                            <form id="form-agregar-banco">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Nombre *</label>
                                    <input type="text" class="form-control" id="banco-nombre" placeholder="Ej. Bancolombia Ahorros" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Tipo *</label>
                                    <input type="text" class="form-control" id="banco-tipo" placeholder="Ej. Banco, Efectivo, Nequi..." required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Número de cuenta (Opcional)</label>
                                    <input type="text" class="form-control" id="banco-numero-cuenta" placeholder="Ej. **** 1234">
                                </div>
                                <div class="mb-4">
                                    <label class="form-label text-muted small fw-semibold">Saldo inicial</label>
                                    <input type="text" class="form-control fw-bold fs-5" id="banco-saldo-inicial" placeholder="$ 0,00">
                                </div>
                                <div class="d-flex gap-2 justify-content-end">
                                    <button type="button" class="btn btn-light border px-4" data-bs-dismiss="modal">Cancelar</button>
                                    <button type="submit" class="btn text-white px-4" style="background-color: var(--primary);" id="btn-confirmar-agregar-banco">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODAL EDITAR BANCO -->
            <div class="modal fade" id="modal-editar-banco" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow" style="border-radius: 12px;">
                        <div class="modal-header border-bottom-0 pb-0">
                            <h5 class="modal-title fw-bold" style="color: var(--text-main);">Editar cuenta bancaria</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4">
                            <form id="form-editar-banco">
                                <input type="hidden" id="banco-edit-id">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Nombre *</label>
                                    <input type="text" class="form-control" id="banco-edit-nombre" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Tipo *</label>
                                    <input type="text" class="form-control" id="banco-edit-tipo" placeholder="Ej. Banco, Efectivo, Nequi..." required>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label text-muted small fw-semibold">Número de cuenta (Opcional)</label>
                                    <input type="text" class="form-control" id="banco-edit-numero-cuenta" placeholder="Ej. **** 1234">
                                </div>
                                <div class="d-flex gap-2 justify-content-end">
                                    <button type="button" class="btn btn-light border px-4" data-bs-dismiss="modal">Cancelar</button>
                                    <button type="submit" class="btn text-white px-4" style="background-color: var(--primary);" id="btn-confirmar-editar-banco">Guardar cambios</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
        await this.loadData();
    },









};

Object.assign(TesoreriaModule, TesoreriaData, TesoreriaTemplates, TesoreriaEvents);
