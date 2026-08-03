import DB, { getLocalDate } from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';
import { obtenerCarteraFiltrada } from '../../shared/carteraUtils.js';
import { AbonoModal } from '../../shared/abonoModal.js';

export default {
    async init(element) {
        if (!element) return;
        await this.renderList(element);
    },

    async renderList(element, fechaInicio = null, fechaFin = null) {
        this.lastElement = element;
        const facturasRaw = await DB.getAll('facturas');
        const contactos = await DB.getAll('contactos');
        const transacciones = (await DB.getAll('transacciones').catch(() => [])) || [];
        
        // 1. Obtener Cartera Filtrada Centralizada
        let facturasPendientes = obtenerCarteraFiltrada(facturasRaw, transacciones, contactos, 'cxc');

        // 2. Filtro Adicional de Periodo (específico de esta vista)

        if (fechaInicio && fechaFin) {
            const fStart = new Date(fechaInicio);
            const fEnd = new Date(fechaFin);
            fEnd.setHours(23, 59, 59, 999);
            
            facturasPendientes = facturasPendientes.filter(f => {
                const dateVal = f.fecha || f.fechaCreacion || f.vencimiento; 
                if (!dateVal) return true;
                const d = new Date(dateVal);
                return d >= fStart && d <= fEnd;
            });
        }
        
        const getCliente = (id) => contactos.find(c => c.id === id) || { nombre: 'Desconocido' };
        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        const totalCartera = facturasPendientes.reduce((sum, f) => {
            const total = parseFloat(f.total) || 0;
            const saldo = parseFloat(f.saldo !== undefined ? f.saldo : total);
            return sum + saldo;
        }, 0);

        const html = `
            <div class="py-3 px-4" style="font-family: 'Inter', sans-serif; background-color: #f8f9fa; min-height: 100vh; font-size: 13px;">
                
                <!-- BREADCRUMB Y BOTONES SUPERIORES DE ACCIÓN -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div style="font-size: 12px;" class="text-muted">
                        <span>Reportes</span> &gt; <span>Administrativos</span> &gt; <span class="text-dark font-weight-bold">Cuentas por cobrar</span>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-light border bg-white text-secondary" title="Exportar">📥</button>
                        <button class="btn btn-sm btn-light border bg-white text-secondary" title="Compartir">🔗</button>
                    </div>
                </div>

                <!-- TÍTULO Y BOTÓN GENERAR -->
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h2 class="fw-bold text-dark m-0" style="font-size: 20px;">Cuentas por cobrar</h2>
                        <p class="text-muted m-0 mt-1" style="font-size: 12px;">Conoce lo que te deben tus clientes y lleva un control del vencimiento de sus facturas.</p>
                    </div>
                    <div>
                        <button id="btn-generar-reporte" class="btn btn-sm text-white px-3 py-2 fw-medium" style="background-color: #2cbfb7; border-radius: 4px; font-size: 13px;">Generar Reporte</button>
                    </div>
                </div>

                <!-- FILTRO DE PERIODO -->
                <div class="card border-0 shadow-sm p-3 mb-3 bg-white position-relative" style="border-radius: 6px; max-width: 320px;">
                    <label class="form-label text-muted mb-1" style="font-size: 11px; font-weight: 600;">Periodo *</label>
                    
                    <!-- INPUT DISPARADOR DEL PICKER -->
                    <div id="input-date-range-trigger" class="form-control form-control-sm border-light-subtle d-flex justify-content-between align-items-center" style="font-size: 12px; cursor: pointer; background-color: #fff; padding: 6px 12px;">
                        <span id="lbl-rango-activo">01/01/2000 - Hoy</span>
                        <span class="text-muted">📅</span>
                    </div>

                    <!-- POPOVER DESPLEGABLE CON ATAJOS Y CALENDARIO -->
                    <div id="popover-date-picker" class="card shadow-lg border-0 position-absolute start-0 mt-1 d-none" style="z-index: 1050; width: 620px; border-radius: 8px; top: 100%;">
                        <div class="card-body p-0 d-flex" style="font-size: 12px; min-height: 280px;">
                            
                            <!-- PANEL IZQUIERDO: ATAJOS PREDEFINIDOS -->
                            <div class="border-end p-2" style="width: 170px; background-color: #f9fbfd;">
                                <div class="text-muted fw-bold px-2 py-1" style="font-size: 11px;">Predefinido</div>
                                <div class="list-group list-group-flush" id="lista-atajos-fecha" style="font-size: 12px;">
                                    <button type="button" class="list-group-item list-group-item-action border-0 px-2 py-1 text-primary bg-transparent fw-medium" data-range="inicio">Desde el Inicio</button>
                                    <button type="button" class="list-group-item list-group-item-action border-0 px-2 py-1 text-secondary bg-transparent" data-range="hoy">Hoy</button>
                                    <button type="button" class="list-group-item list-group-item-action border-0 px-2 py-1 text-secondary bg-transparent" data-range="ayer">Ayer</button>
                                    <button type="button" class="list-group-item list-group-item-action border-0 px-2 py-1 text-secondary bg-transparent" data-range="esta_semana">Esta Semana</button>
                                    <button type="button" class="list-group-item list-group-item-action border-0 px-2 py-1 text-secondary bg-transparent" data-range="semana_anterior">Semana Anterior</button>
                                    <button type="button" class="list-group-item list-group-item-action border-0 px-2 py-1 text-secondary bg-transparent" data-range="este_mes">Este Mes</button>
                                    <button type="button" class="list-group-item list-group-item-action border-0 px-2 py-1 text-secondary bg-transparent" data-range="mes_anterior">Mes Anterior</button>
                                    <button type="button" class="list-group-item list-group-item-action border-0 px-2 py-1 text-secondary bg-transparent" data-range="ultimos_3_meses">Últimos 3 Meses</button>
                                    <button type="button" class="list-group-item list-group-item-action border-0 px-2 py-1 text-secondary bg-transparent" data-range="este_trimestre">Este Trimestre</button>
                                    <button type="button" class="list-group-item list-group-item-action border-0 px-2 py-1 text-secondary bg-transparent" data-range="trimestre_anterior">Trimestre Anterior</button>
                                    <button type="button" class="list-group-item list-group-item-action border-0 px-2 py-1 text-secondary bg-transparent" data-range="este_ano">Este Año</button>
                                    <button type="button" class="list-group-item list-group-item-action border-0 px-2 py-1 text-secondary bg-transparent" data-range="ano_anterior">Año Anterior</button>
                                </div>
                            </div>

                            <!-- PANEL DERECHO: VISTA DE DUAL CALENDAR -->
                            <div class="p-3 flex-fill bg-white">
                                <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                    <span class="fw-bold text-dark" style="font-size: 11px;">Rango personalizado:</span>
                                    <div class="d-flex gap-1">
                                        <input type="date" id="picker-fecha-inicio" class="form-control form-control-sm py-0 px-1" style="font-size: 11px; width: 110px;" value="2000-01-01">
                                        <span class="text-muted">-</span>
                                        <input type="date" id="picker-fecha-fin" class="form-control form-control-sm py-0 px-1" style="font-size: 11px; width: 110px;" value="">
                                    </div>
                                </div>
                                
                                <!-- MOCKUP VISUAL DE CALENDARIOS DUALES SELECCIONABLES -->
                                <div class="d-flex gap-3 text-center align-items-start pt-1">
                                    <div class="flex-fill border rounded p-2">
                                        <div class="fw-bold text-dark mb-1" style="font-size: 11px;">Enero 2000</div>
                                        <div class="text-muted small">◄ Mes Incial</div>
                                    </div>
                                    <div class="flex-fill border rounded p-2">
                                        <div class="fw-bold text-dark mb-1" style="font-size: 11px;">Mes Final</div>
                                        <div class="text-muted small">Mes Final ►</div>
                                    </div>
                                </div>

                                <!-- ACCIONES DE APLICACIÓN -->
                                <div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
                                    <button id="btn-cancelar-picker" class="btn btn-sm btn-light border px-3" style="font-size: 11px;">Cancelar</button>
                                    <button id="btn-aplicar-picker" class="btn btn-sm text-white px-3" style="background-color: #2cbfb7; font-size: 11px;">Aplicar Periodo</button>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                <!-- BARRAS / PESTAÑAS DE VENCIMIENTO Y TOTAL GENERAL -->
                <div class="card border-0 shadow-sm bg-white mb-3" style="border-radius: 6px; overflow: hidden;">
                    <div class="d-flex border-bottom text-center text-muted" style="font-size: 12px;">
                        <div class="flex-fill py-2 px-1 border-end bg-light-subtle">Vencidas 30 días o menos</div>
                        <div class="flex-fill py-2 px-1 border-end bg-light-subtle">Vencidas 31 a de 60 días</div>
                        <div class="flex-fill py-2 px-1 border-end bg-light-subtle">Vencidas 61 a de 90 días</div>
                        <div class="flex-fill py-2 px-1 border-end bg-light-subtle">Vencidas 91+</div>
                        <div class="flex-fill py-2 px-1 bg-light-subtle">No vencidas</div>
                    </div>
                    <div class="p-3 text-center">
                        <div class="text-muted" style="font-size: 11px;">Total por cobrar</div>
                        <div class="fw-bold" style="font-size: 18px; color: #ef4444;" id="lbl-total-por-cobrar">$ ${totalCartera.toLocaleString('es-CO', {minimumFractionDigits: 2})}</div>
                    </div>
                </div>

                <!-- TABLA DE DETALLE DE CARTERA POR FACTURA -->
                <div class="card border-0 shadow-sm bg-white" style="border-radius: 6px;">
                    <div class="p-2 d-flex justify-content-end border-bottom">
                        <button class="btn btn-sm btn-light border bg-white text-secondary" style="font-size: 12px;">⚙️ Filtrar</button>
                    </div>
                    
                    <div class="table-responsive">
                        <table class="table align-middle table-hover m-0" style="font-size: 12px;">
                            <thead class="table-light text-secondary fw-semibold border-bottom" style="--bs-table-bg: #f9fbfd; white-space: nowrap;">
                                <tr>
                                    <th style="width: 35px;" class="ps-3"><input type="checkbox" class="form-check-input"></th>
                                    <th>Número</th>
                                    <th>Tipo de documento</th>
                                    <th>Cliente</th>
                                    <th>Creación</th>
                                    <th>Vencimiento</th>
                                    <th class="text-end">Total</th>
                                    <th class="text-end">Cobrado</th>
                                    <th class="text-end pe-3">Por cobrar</th>
                                    <th class="text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${facturasPendientes.map(f => {
                                    const total = parseFloat(f.total) || 0;
                                    const saldo = parseFloat(f.saldo !== undefined ? f.saldo : total);
                                    const cobrado = f.totalPagado !== undefined ? f.totalPagado : (total - saldo);
                                    const cliente = getCliente(f.clienteId);
                                    const isVencida = new Date(f.vencimiento) < new Date();
                                    
                                    return `
                                    <tr>
                                        <td class="ps-3"><input type="checkbox" class="form-check-input"></td>
                                        <td class="text-primary fw-medium" style="cursor: pointer; white-space: nowrap;">${f.numero || f.id}</td>
                                        <td class="text-muted" style="white-space: nowrap;">Factura de venta</td>
                                        <td class="text-dark" style="white-space: nowrap;">${cliente.nombre}</td>
                                        <td class="text-muted" style="white-space: nowrap;">${f.fecha || 'N/A'}</td>
                                        <td class="${isVencida ? 'text-danger fw-semibold' : 'text-muted'}" style="white-space: nowrap;">${f.vencimiento || 'N/A'}</td>
                                        <td class="text-end text-dark" style="white-space: nowrap;">$ ${total.toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                                        <td class="text-end text-muted" style="white-space: nowrap;">$ ${cobrado.toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                                        <td class="text-end fw-bold text-dark pe-3" style="white-space: nowrap;">$ ${saldo.toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                                        <td class="text-center" style="white-space: nowrap;">
                                            <button class="btn btn-sm text-white btn-abonar" style="background-color: #2cbfb7;" data-id="${f.id}" data-saldo="${saldo}">Registrar Pago</button>
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- PAGINADOR FIJO INFERIOR -->
                    <div class="d-flex justify-content-between align-items-center p-3 text-muted border-top" style="font-size: 11px;">
                        <div class="d-flex align-items-center gap-2">
                            <span>Página 1 de 1</span>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <span>Mostrando 1-${facturasPendientes.length} de ${facturasPendientes.length}</span>
                            <select class="form-select form-select-sm border-light-subtle py-0" style="width: 110px; font-size: 11px;">
                                <option>Resultados por página: 20</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            

        `;

        element.innerHTML = html;
        this.bindDatePickerEvents();

        element.querySelectorAll('.btn-abonar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const facturaId = e.currentTarget.dataset.id;
                
                AbonoModal.show(facturaId, () => {
                    if (this._abonoTimeout) clearTimeout(this._abonoTimeout);
                    this._abonoTimeout = setTimeout(() => {
                        if (document.body.contains(element)) {
                            this.renderList(element);
                        }
                    }, 500);
                });
            });
        });
    },

    bindDatePickerEvents() {
        const trigger = document.getElementById('input-date-range-trigger');
        const popover = document.getElementById('popover-date-picker');

        // Alternar visibilidad del menú desplegable
        trigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            popover?.classList.toggle('d-none');
        });

        // Ocultar al hacer clic fuera
        if (this._outsideClickListener) {
            document.removeEventListener('click', this._outsideClickListener);
        }
        this._outsideClickListener = (e) => {
            if (!popover?.contains(e.target) && !trigger?.contains(e.target)) {
                popover?.classList.add('d-none');
            }
        };
        document.addEventListener('click', this._outsideClickListener);
        // Eventos de atajos predefinidos
        document.querySelectorAll('#lista-atajos-fecha button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tipoAtajo = e.target.getAttribute('data-range');
                this.calcularRangoSegunAtajo(tipoAtajo);
                popover?.classList.add('d-none');
            });
        });

        // Botones de acción
        document.getElementById('btn-cancelar-picker')?.addEventListener('click', () => {
            popover?.classList.add('d-none');
        });

        document.getElementById('btn-aplicar-picker')?.addEventListener('click', () => {
            const fInicio = document.getElementById('picker-fecha-inicio').value;
            const fFin = document.getElementById('picker-fecha-fin').value;
            
            if (fInicio && fFin) {
                document.getElementById('lbl-rango-activo').innerText = `${fInicio} - ${fFin}`;
                // Disparar regeneración limpia del reporte
                if (typeof this.filtrarDatosPorRango === 'function') {
                    this.filtrarDatosPorRango(fInicio, fFin);
                }
            }
            popover?.classList.add('d-none');
        });

        // VINCULACIÓN DEL BOTÓN GENERAR REPORTE
        const btnGenerar = document.getElementById('btn-generar-reporte');
        if (btnGenerar) {
            btnGenerar.addEventListener('click', () => {
                this.ejecutarFiltroReporte();
            });
        }
    },

    ejecutarFiltroReporte() {
        const inputInicio = document.getElementById('picker-fecha-inicio');
        const inputFin = document.getElementById('picker-fecha-fin');

        // Obtener la fecha de hoy en formato YYYY-MM-DD
        const hoyObj = new Date();
        const hoyStr = getLocalDate(hoyObj);

        // Estado inicial de la UI indica rango 2000-01-01 hasta hoy si no está definido
        const fechaInicio = (inputInicio && inputInicio.value) ? inputInicio.value : '2000-01-01';
        const fechaFin = (inputFin && inputFin.value) ? inputFin.value : hoyStr;

        // Feedback visual inmediato en el botón
        const btnGenerar = document.getElementById('btn-generar-reporte');
        if (btnGenerar) {
            btnGenerar.disabled = true;
            btnGenerar.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Buscando...`;
        }

        // Ejecutar la búsqueda/filtrado
        if (this._filterTimeout) clearTimeout(this._filterTimeout);
        this._filterTimeout = setTimeout(() => {
            if (typeof this.filtrarDatosPorRango === 'function') {
                this.filtrarDatosPorRango(fechaInicio, fechaFin);
            }
        }, 300);
    },

    filtrarDatosPorRango(inicio, fin) {
        if (this.lastElement) {
            this.renderList(this.lastElement, inicio, fin);
        }
    },

    calcularRangoSegunAtajo(tipo) {
        const hoy = new Date();
        const hoyStr = getLocalDate(hoy);
        const primerDiaMesStr = getLocalDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
        const hace3Meses = new Date(hoy);
        hace3Meses.setMonth(hace3Meses.getMonth() - 3);
        const ultimos3MesesStr = getLocalDate(hace3Meses);
        const primerDiaAnoStr = getLocalDate(new Date(hoy.getFullYear(), 0, 1));
        
        let inicio, fin;

        switch(tipo) {
            case 'inicio':
                inicio = "2000-01-01";
                fin = hoyStr;
                break;
            case 'hoy':
                inicio = fin = hoyStr;
                break;
            case 'este_mes':
                inicio = primerDiaMesStr;
                fin = hoyStr; // O el último día del mes, pero usualmente reportes son hasta hoy
                break;
            case 'ultimos_3_meses':
                inicio = ultimos3MesesStr;
                fin = hoyStr;
                break;
            case 'este_ano':
                inicio = primerDiaAnoStr;
                fin = hoyStr;
                break;
            default:
                inicio = "2000-01-01";
                fin = hoyStr;
        }

        document.getElementById('picker-fecha-inicio').value = inicio;
        document.getElementById('picker-fecha-fin').value = fin;
        document.getElementById('lbl-rango-activo').innerText = `${inicio} - ${fin}`;
        
        if (typeof this.filtrarDatosPorRango === 'function') {
            this.filtrarDatosPorRango(inicio, fin);
        }
    }
};
