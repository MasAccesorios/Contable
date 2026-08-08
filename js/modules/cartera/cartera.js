import DB, { getLocalDate } from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';
import { obtenerCarteraFiltrada } from '../../shared/carteraUtils.js';
import { supabase } from '../../core/supabase.js';
import { AbonoModal } from '../../shared/abonoModal.js';

export default {
    async init(element) {
        if (!element) return;
        await this.renderList(element);
    },

    async renderList(element, fechaInicio = null, fechaFin = null) {
        this.lastElement = element;
        const contactos = await DB.getAll('contactos');
        
        // 1. Obtener Cartera desde RPC
        const { data: facturasPendientesRPC, error } = await supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxc' });
        if (error) console.error("Error fetching cartera:", error);
        
        let facturasPendientes = facturasPendientesRPC || [];

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
        
        const getCliente = (id) => contactos.find(c => String(c.id) === String(id)) || { nombre: 'Desconocido' };
        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        let totalCartera = 0;
        let totalVigente = 0;
        let totalVencido = 0;
        
        const hoyUTC = Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

        facturasPendientes.forEach(f => {
            const total = parseFloat(f.total) || 0;
            const saldo = parseFloat(f.saldo !== undefined ? f.saldo : total);
            totalCartera += saldo;
            
            let diasVencida = 0;
            if (f.vencimiento) {
                const vDate = new Date(f.vencimiento);
                const utcVenc = Date.UTC(vDate.getFullYear(), vDate.getMonth(), vDate.getDate());
                diasVencida = Math.floor((hoyUTC - utcVenc) / (1000 * 60 * 60 * 24));
            }
            if (diasVencida >= 1) {
                totalVencido += saldo;
            } else {
                totalVigente += saldo;
            }
        });

        const html = `
            <div class="dash-layout p-4">
                
                <!-- BREADCRUMB Y BOTONES SUPERIORES DE ACCIÓN -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div style="font-size: 12px;" class="text-muted">
                        <span>Reportes</span> &gt; <span>Administrativos</span> &gt; <span class="text-dark font-weight-bold">Cuentas por cobrar</span>
                    </div>
                      <div class="d-flex gap-2">
                          <button id="btn-exportar-cartera" class="btn btn-sm btn-light border bg-white text-secondary" title="Exportar">📥</button>
                          <button class="btn btn-sm btn-light border bg-white text-secondary" title="Compartir">🔗</button>
                      </div>
                </div>

                <!-- TÍTULO Y BOTÓN GENERAR -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1 text-dark">Cuentas por cobrar</h2>
                        <p class="text-muted small mb-0">Conoce lo que te deben tus clientes y lleva un control del vencimiento de sus facturas.</p>
                    </div>
                    <div>
                        <button id="btn-generar-reporte" class="btn btn-primary-action">Generar Reporte</button>
                    </div>
                </div>

                <!-- FILTRO DE PERIODO -->
                <div class="card border-0 shadow-sm p-3 mb-3 bg-white position-relative" style="border-radius: 14px; border: 1px solid #e2e8f0 !important; max-width: 320px;">
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

                <!-- KPI CARDS CARTERA -->
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Total por Cobrar</span>
                                <div class="dash-icon-box variant-blue">
                                    <i class="bi bi-wallet2"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="lbl-total-por-cobrar">$ ${totalCartera.toLocaleString('es-CO', {minimumFractionDigits: 2})}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Cartera Vigente</span>
                                <div class="dash-icon-box variant-green">
                                    <i class="bi bi-check-circle"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="lbl-total-vigente">$ ${totalVigente.toLocaleString('es-CO', {minimumFractionDigits: 2})}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Cartera Vencida</span>
                                <div class="dash-icon-box variant-red">
                                    <i class="bi bi-exclamation-triangle"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="lbl-total-vencido">$ ${totalVencido.toLocaleString('es-CO', {minimumFractionDigits: 2})}</div>
                        </div>
                    </div>
                </div>

                <!-- TABLA DE DETALLE DE CARTERA POR FACTURA -->
                <div class="dash-table-container">
                    <div class="p-3 d-flex justify-content-end border-bottom border-light-subtle">
                        <button id="btn-toggle-filtros" class="btn btn-sm btn-light border bg-white text-secondary" style="font-size: 12px; border-radius: 6px;">⚙️ Filtrar</button>
                    </div>
                    
                    <div id="row-filtros-alegra" class="d-none p-2 border-bottom bg-light d-flex flex-wrap gap-2 align-items-center" style="font-size: 12px;">
                        <input type="text" id="filtro-numero" class="form-control form-control-sm" placeholder="Número" style="border-radius: 6px; width: 120px;">
                        <select id="filtro-cliente" class="form-select form-select-sm" style="border-radius: 6px; width: 180px;">
                            <option value="">Cliente</option>
                        </select>
                        <div class="input-group input-group-sm" style="width: 150px;">
                            <input type="text" class="form-control border-end-0 text-muted" value="Creación" disabled style="background-color: #fff; border-radius: 6px 0 0 6px;">
                            <input type="date" id="filtro-creacion" class="form-control" style="border-radius: 0 6px 6px 0;">
                        </div>
                        <div class="input-group input-group-sm" style="width: 150px;">
                            <input type="text" class="form-control border-end-0 text-muted" value="Venc." disabled style="background-color: #fff; border-radius: 6px 0 0 6px;">
                            <input type="date" id="filtro-vencimiento" class="form-control" style="border-radius: 0 6px 6px 0;">
                        </div>
                        
                        <div class="ms-auto d-flex gap-2">
                            <button id="btn-aplicar-filtros" class="btn btn-sm text-dark border" style="background-color: #fff; border-color: #2cbfb7 !important; border-radius: 6px; color: #2cbfb7 !important;">Filtrar</button>
                            <button id="btn-cerrar-filtros" class="btn btn-sm btn-light border bg-white text-secondary" style="border-radius: 6px;">Cerrar</button>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="table align-middle table-hover m-0" style="font-size: 12px;">
                            <thead class="table-light text-muted small text-uppercase border-bottom">
                                <tr>
                                    <th style="width: 35px;" class="ps-3 py-2"><input type="checkbox" class="form-check-input"></th>
                                    <th class="py-2">Número</th>
                                    <th class="py-2">Tipo de documento</th>
                                    <th class="py-2">Cliente</th>
                                    <th class="py-2">Creación</th>
                                    <th class="py-2">Vencimiento</th>
                                    <th class="py-2">Estado</th>
                                    <th class="text-end py-2">Total</th>
                                    <th class="text-end py-2">Cobrado</th>
                                    <th class="text-end pe-3 py-2">Por cobrar</th>
                                    <th class="text-center py-2">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${facturasPendientes.map(f => {
                                    const total = parseFloat(f.total) || 0;
                                    const saldo = parseFloat(f.saldo !== undefined ? f.saldo : total);
                                    const cobrado = f.totalPagado !== undefined ? f.totalPagado : (total - saldo);
                                    const clienteId = f.contacto_id || f.clienteId;
                                    const cliente = getCliente(clienteId);
                                    
                                    const hoyDate = new Date();
                                    const utcHoy = Date.UTC(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate());
                                    let diasVencida = 0;
                                    if (f.vencimiento) {
                                        const vDate = new Date(f.vencimiento);
                                        const utcVenc = Date.UTC(vDate.getFullYear(), vDate.getMonth(), vDate.getDate());
                                        diasVencida = Math.floor((utcHoy - utcVenc) / (1000 * 60 * 60 * 24));
                                    }
                                    const isVencida = diasVencida >= 1;
                                    
                                    return `
                                    <tr class="tr-factura" data-numero="${String(f.numero || f.id).toLowerCase()}" data-cliente-id="${clienteId}" data-fecha="${f.fecha || ''}" data-vencimiento="${f.vencimiento || ''}" data-dias-vencida="${diasVencida}" data-saldo="${saldo}" style="cursor: pointer;" onclick="if(!event.target.closest('button')) { sessionStorage.setItem('origenVolver', JSON.stringify({hash: '#/cartera', label: 'Volver a Cuentas por Cobrar'})); window.location.hash = '#/ingresos/facturas/ver/${f.id}'; }">
                                        <td class="ps-3 py-1"><input type="checkbox" class="form-check-input"></td>
                                        <td class="text-primary fw-medium py-1" style="cursor: pointer; white-space: nowrap;">${f.numero || f.id}</td>
                                        <td class="text-muted py-1" style="white-space: nowrap;">Factura de venta</td>
                                        <td class="text-dark py-1" style="white-space: nowrap;">${cliente.nombre}</td>
                                        <td class="text-muted py-1" style="white-space: nowrap;">${f.fecha || 'N/A'}</td>
                                        <td class="${isVencida ? 'text-danger fw-semibold' : 'text-muted'} py-1" style="white-space: nowrap;">${f.vencimiento || 'N/A'}</td>
                                        <td class="py-1" style="white-space: nowrap;">
                                            <span class="badge ${isVencida ? 'bg-danger text-danger bg-opacity-10 border border-danger-subtle' : 'bg-success text-success bg-opacity-10 border border-success-subtle'} rounded-pill fw-medium" style="font-size: 10px; padding: 3px 8px;">${isVencida ? 'Vencida' : 'Vigente'}</span>
                                        </td>
                                        <td class="text-end text-dark py-1" style="white-space: nowrap;">$ ${total.toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                                        <td class="text-end text-muted py-1" style="white-space: nowrap;">$ ${cobrado.toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                                        <td class="text-end fw-bold text-dark pe-3 py-1" style="white-space: nowrap;">$ ${saldo.toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                                        <td class="text-center py-1" style="white-space: nowrap;">
                                            <button class="btn btn-sm text-white btn-abonar shadow-sm" style="background-color: #1877f2; font-size: 11px; padding: 3px 10px;" data-id="${f.id}" data-saldo="${saldo}">Registrar Pago</button>
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
                            <span id="lbl-conteo-mostrando">Mostrando 1-${facturasPendientes.length} de ${facturasPendientes.length}</span>
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
                const saldoCalculado = parseFloat(e.currentTarget.dataset.saldo) || 0;
                
                AbonoModal.show(facturaId, () => {
                    if (this._abonoTimeout) clearTimeout(this._abonoTimeout);
                    this._abonoTimeout = setTimeout(() => {
                        if (document.body.contains(element)) {
                            this.renderList(element);
                        }
                    }, 500);
                }, saldoCalculado);
            });
        });
        
        this.bindFiltrosTabla(facturasPendientes, contactos);
        this.bindDatePickerEvents();
        
        const btnGenerar = document.getElementById('btn-generar-reporte');
        if (btnGenerar) {
            btnGenerar.disabled = false;
            btnGenerar.innerHTML = `Generar Reporte`;
        }
    },

    bindFiltrosTabla(facturasPendientes, contactos) {
        const selectCliente = document.getElementById('filtro-cliente');
        if (selectCliente) {
            const clientesUnicosIds = [...new Set(facturasPendientes.map(f => String(f.contacto_id || f.clienteId)))];
            const clientesList = clientesUnicosIds.map(id => {
                const c = contactos.find(c => String(c.id) === id);
                return c ? { id, nombre: c.nombre } : { id, nombre: 'Desconocido' };
            }).sort((a,b) => a.nombre.localeCompare(b.nombre));
            
            clientesList.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.nombre;
                selectCliente.appendChild(opt);
            });
        }

        let currentTabRango = 'todas';

        const aplicarFiltros = () => {
            const txtNumero = (document.getElementById('filtro-numero')?.value || '').toLowerCase();
            const selCliente = document.getElementById('filtro-cliente')?.value || '';
            const dateCreacion = document.getElementById('filtro-creacion')?.value || '';
            const dateVencimiento = document.getElementById('filtro-vencimiento')?.value || '';

            let nuevoTotal = 0;
            let visibles = 0;

            document.querySelectorAll('.tr-factura').forEach(tr => {
                const numero = tr.getAttribute('data-numero');
                const clienteId = tr.getAttribute('data-cliente-id');
                const fecha = tr.getAttribute('data-fecha');
                const vencimiento = tr.getAttribute('data-vencimiento');
                const dias = parseInt(tr.getAttribute('data-dias-vencida')) || 0;
                const saldo = parseFloat(tr.getAttribute('data-saldo')) || 0;

                let match = true;
                
                if (txtNumero && !numero.includes(txtNumero)) match = false;
                if (selCliente && clienteId !== selCliente) match = false;
                if (dateCreacion && fecha !== dateCreacion) match = false;
                if (dateVencimiento && vencimiento !== dateVencimiento) match = false;

                if (currentTabRango !== 'todas') {
                    if (currentTabRango === '0-30' && (dias < 1 || dias > 30)) match = false;
                    if (currentTabRango === '31-60' && (dias < 31 || dias > 60)) match = false;
                    if (currentTabRango === '61-90' && (dias < 61 || dias > 90)) match = false;
                    if (currentTabRango === '91+' && dias < 91) match = false;
                    if (currentTabRango === 'no-vencidas' && dias >= 1) match = false;
                }

                if (match) {
                    tr.classList.remove('d-none');
                    nuevoTotal += saldo;
                    visibles++;
                } else {
                    tr.classList.add('d-none');
                }
            });

            const lblTotal = document.getElementById('lbl-total-por-cobrar');
            if (lblTotal) lblTotal.innerText = '$ ' + nuevoTotal.toLocaleString('es-CO', {minimumFractionDigits: 2});
            
            const lblConteo = document.getElementById('lbl-conteo-mostrando');
            if (lblConteo) lblConteo.innerText = `Mostrando 1-${visibles} de ${visibles}`;
        };

        document.getElementById('btn-aplicar-filtros')?.addEventListener('click', aplicarFiltros);
        
        document.getElementById('btn-toggle-filtros')?.addEventListener('click', () => {
            document.getElementById('row-filtros-alegra')?.classList.toggle('d-none');
        });
        
        document.getElementById('btn-cerrar-filtros')?.addEventListener('click', () => {
            document.getElementById('row-filtros-alegra')?.classList.add('d-none');
            document.getElementById('filtro-numero').value = '';
            document.getElementById('filtro-cliente').value = '';
            document.getElementById('filtro-creacion').value = '';
            document.getElementById('filtro-vencimiento').value = '';
            aplicarFiltros();
        });

        document.getElementById('row-filtros-alegra')?.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') aplicarFiltros();
            });
        });
        
        document.getElementById('btn-exportar-cartera')?.addEventListener('click', () => {
            const visibles = Array.from(document.querySelectorAll('.tr-factura:not(.d-none)'));
            if (visibles.length === 0) {
                alert("No hay datos para exportar.");
                return;
            }
            
            if (typeof XLSX === 'undefined') {
                alert("La librería de exportación aún no se ha cargado.");
                return;
            }
            
            const cabeceras = ["Número", "Tipo documento", "Cliente", "Creación", "Vencimiento", "Total", "Pagado", "Por cobrar"];
            
            const parseMoney = (str) => {
                const parsed = parseFloat(str.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '.').trim());
                return isNaN(parsed) ? 0 : parsed;
            };
            
            const dataToExport = [];
            
            visibles.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length < 9) return;
                
                dataToExport.push({
                    "Número": tds[1].innerText.trim(),
                    "Tipo documento": tds[2].innerText.trim(),
                    "Cliente": tds[3].innerText.trim(),
                    "Creación": tds[4].innerText.trim(),
                    "Vencimiento": tds[5].innerText.trim(),
                    "Total": parseMoney(tds[6].innerText),
                    "Pagado": parseMoney(tds[7].innerText),
                    "Por cobrar": parseMoney(tds[8].innerText)
                });
            });
            
            const ws = XLSX.utils.json_to_sheet(dataToExport, { header: cabeceras });
            
            // Formatear las columnas de moneda como $#,##0.00 en Excel
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                // Columnas F, G, H (Total, Pagado, Por cobrar) son indices 5, 6, 7
                for (let C = 5; C <= 7; ++C) {
                    const cellRef = XLSX.utils.encode_cell({c: C, r: R});
                    if (ws[cellRef]) {
                        ws[cellRef].z = '"$"#,##0.00';
                    }
                }
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Cartera");
            
            const fileName = `Cuentas_por_cobrar_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
        });

        const tabs = document.querySelectorAll('.tab-vencimiento');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const rango = e.currentTarget.getAttribute('data-rango');
                
                if (currentTabRango === rango) {
                    currentTabRango = 'todas';
                    e.currentTarget.classList.remove('bg-white', 'text-dark', 'fw-bold', 'border-bottom-0');
                    e.currentTarget.classList.add('bg-light-subtle', 'text-muted');
                } else {
                    currentTabRango = rango;
                    tabs.forEach(t => {
                        t.classList.remove('bg-white', 'text-dark', 'fw-bold', 'border-bottom-0');
                        t.classList.add('bg-light-subtle', 'text-muted');
                    });
                    e.currentTarget.classList.remove('bg-light-subtle', 'text-muted');
                    e.currentTarget.classList.add('bg-white', 'text-dark', 'fw-bold', 'border-bottom-0');
                    e.currentTarget.style.borderTop = '2px solid #2cbfb7';
                }
                
                tabs.forEach(t => {
                    if (t !== e.currentTarget || currentTabRango === 'todas') t.style.borderTop = '';
                });

                aplicarFiltros();
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
