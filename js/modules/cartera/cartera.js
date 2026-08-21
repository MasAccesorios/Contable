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

    async renderList(element) {
        this.lastElement = element;
        const contactos = await DB.getAll('contactos');
        
        // 1. Obtener Cartera desde RPC
        const { data: facturasPendientesRPC, error } = await supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxc' });
        if (error) console.error("Error fetching cartera:", error);
        
        let facturasPendientes = facturasPendientesRPC || [];

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
            <div class="dash-layout p-4" style="max-width: 1100px; margin: 0 auto;">
                
                <!-- BREADCRUMB Y BOTONES SUPERIORES DE ACCIÓN -->
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div style="font-size: var(--fs-sm);" class="text-muted">
                        <span>Reportes</span> &gt; <span>Administrativos</span> &gt; <span class="text-dark font-weight-bold">Cuentas por cobrar</span>
                    </div>
                </div>

                <!-- TÍTULO Y BOTÓN GENERAR -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1 text-dark">Cuentas por cobrar</h2>
                        <p class="text-muted small mb-0">Conoce lo que te deben tus clientes y lleva un control del vencimiento de sus facturas.</p>
                    </div>
                    <div>
                        <button id="btn-exportar-cartera" class="btn btn-outline-secondary bg-white text-dark fw-medium">
                            <i class="bi bi-download me-1"></i> Exportar Reporte
                        </button>
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
                    <div class="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center">
                        <div class="ds-search-container" style="width: 280px;">
                            <i class="bi bi-search ds-search-icon"></i>
                            <input type="text" class="ds-search-input" id="searchFacturas" autocomplete="off" placeholder="Buscar cartera...">
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-link text-decoration-none text-muted p-0 dropdown-toggle" data-bs-toggle="dropdown" style="font-size: var(--fs-md);">
                                <i class="bi bi-funnel me-1"></i> Filtrar <span id="lbl-filtro-actual" style="font-size: var(--fs-sm); font-weight: 500; color: var(--primary);"></span>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end shadow border-0" style="font-size: var(--fs-base);">
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="todos">Todos los campos</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="numero">Por Número</a></li>
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="cliente">Por Cliente</a></li>
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="fecha">Por Fecha de creación</a></li>
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="estado">Por Estado</a></li>
                                <li><a class="dropdown-item filter-opt" href="#" data-criteria="monto">Por Monto</a></li>
                            </ul>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="table align-middle table-hover m-0" style="font-size: var(--fs-sm);">
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
                                    let vencimientoReal = (f.vencimiento && f.vencimiento !== 'N/A' && f.vencimiento.trim() !== '') ? f.vencimiento : f.fecha;

                                    if (vencimientoReal) {
                                        const vDate = new Date(vencimientoReal);
                                        const utcVenc = Date.UTC(vDate.getFullYear(), vDate.getMonth(), vDate.getDate());
                                        diasVencida = Math.floor((utcHoy - utcVenc) / (1000 * 60 * 60 * 24));
                                    }
                                    const isVencida = diasVencida >= 1;
                                    
                                    return `
                                    <tr class="tr-factura" data-numero="${String(f.numero || f.id).toLowerCase()}" data-cliente-nombre="${cliente.nombre}" data-cliente-id="${clienteId}" data-fecha="${f.fecha || ''}" data-vencimiento="${vencimientoReal || ''}" data-dias-vencida="${diasVencida}" data-saldo="${saldo}" style="cursor: pointer;" onclick="if(!event.target.closest('button')) { sessionStorage.setItem('origenVolver', JSON.stringify({hash: '#/cartera', label: 'Volver a Cuentas por Cobrar'})); window.location.hash = '#/ingresos/facturas/ver/${f.id}'; }">
                                        <td class="ps-3 py-1"><input type="checkbox" class="form-check-input"></td>
                                        <td class="text-primary fw-medium py-1" style="cursor: pointer; white-space: nowrap;">${f.numero || f.id}</td>
                                        <td class="text-muted py-1" style="white-space: nowrap;">Factura de venta</td>
                                        <td class="text-dark py-1" style="white-space: nowrap;">${cliente.nombre}</td>
                                        <td class="text-muted py-1" style="white-space: nowrap;">${f.fecha || '---'}</td>
                                        <td class="${isVencida ? 'text-danger fw-semibold' : 'text-muted'} py-1" style="white-space: nowrap;">${vencimientoReal || '---'}</td>
                                        <td class="py-1" style="white-space: nowrap;">
                                            <span class="badge ${isVencida ? 'bg-danger text-danger bg-opacity-10 border border-danger-subtle' : 'bg-success text-success bg-opacity-10 border border-success-subtle'} rounded-pill fw-medium" style="font-size: var(--fs-xxs); padding: 3px 8px;">${isVencida ? 'Vencida' : 'Vigente'}</span>
                                        </td>
                                        <td class="text-end text-dark py-1" style="white-space: nowrap;">$ ${total.toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                                        <td class="text-end text-muted py-1" style="white-space: nowrap;">$ ${cobrado.toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                                        <td class="text-end fw-bold text-dark pe-3 py-1" style="white-space: nowrap;">$ ${saldo.toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                                        <td class="text-center py-1" style="white-space: nowrap;">
                                            <button class="btn btn-sm text-white btn-abonar shadow-sm" style="background-color: var(--primary); font-size: var(--fs-xs); padding: 3px 10px;" data-id="${f.id}" data-saldo="${saldo}">Registrar Pago</button>
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- PAGINADOR FIJO INFERIOR -->
                    <div class="d-flex justify-content-between align-items-center p-3 text-muted border-top" style="font-size: var(--fs-xs);">
                        <div class="d-flex align-items-center gap-2">
                            <span>Página 1 de 1</span>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <span id="lbl-conteo-mostrando">Mostrando 1-${facturasPendientes.length} de ${facturasPendientes.length}</span>
                            <select class="form-select form-select-sm border-light-subtle py-0" style="width: 110px; font-size: var(--fs-xs);">
                                <option>Resultados por página: 20</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            

        `;

        element.innerHTML = html;

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
    },

    bindFiltrosTabla(facturasPendientes, contactos) {
        let currentTabRango = 'todas';
        let currentFilterCriteria = 'todos';
        let currentSearchQuery = '';

        const filterDropdownOpts = document.querySelectorAll('.filter-opt');
        const lblFiltroActual = document.getElementById('lbl-filtro-actual');
        const searchInput = document.getElementById('searchFacturas');

        filterDropdownOpts.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.preventDefault();
                currentFilterCriteria = e.target.getAttribute('data-criteria');
                if (lblFiltroActual) {
                    lblFiltroActual.innerText = currentFilterCriteria !== 'todos' ? '(' + currentFilterCriteria + ')' : '';
                }
                aplicarFiltros();
            });
        });

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearchQuery = e.target.value.toLowerCase().trim();
                aplicarFiltros();
            });
        }

        const aplicarFiltros = () => {
            let nuevoTotal = 0;
            let visibles = 0;

            document.querySelectorAll('.tr-factura').forEach(tr => {
                const numero = (tr.getAttribute('data-numero') || '').toLowerCase();
                const clienteNombre = (tr.getAttribute('data-cliente-nombre') || '').toLowerCase();
                const fecha = (tr.getAttribute('data-fecha') || '').toLowerCase();
                const vencimiento = (tr.getAttribute('data-vencimiento') || '').toLowerCase();
                const dias = parseInt(tr.getAttribute('data-dias-vencida')) || 0;
                const saldo = parseFloat(tr.getAttribute('data-saldo')) || 0;
                const estado = (tr.querySelector('.badge')?.innerText || '').toLowerCase();
                
                let matchSearch = true;
                if (currentSearchQuery) {
                    if (currentFilterCriteria === 'todos') {
                        matchSearch = numero.includes(currentSearchQuery) || 
                                      clienteNombre.includes(currentSearchQuery) || 
                                      fecha.includes(currentSearchQuery) || 
                                      estado.includes(currentSearchQuery) || 
                                      saldo.toString().includes(currentSearchQuery);
                    } else if (currentFilterCriteria === 'numero') {
                        matchSearch = numero.includes(currentSearchQuery);
                    } else if (currentFilterCriteria === 'cliente') {
                        matchSearch = clienteNombre.includes(currentSearchQuery);
                    } else if (currentFilterCriteria === 'fecha') {
                        matchSearch = fecha.includes(currentSearchQuery);
                    } else if (currentFilterCriteria === 'estado') {
                        matchSearch = estado.includes(currentSearchQuery);
                    } else if (currentFilterCriteria === 'monto') {
                        matchSearch = saldo.toString().includes(currentSearchQuery);
                    }
                }

                let matchTab = true;
                if (currentTabRango !== 'todas') {
                    if (currentTabRango === '0-30' && (dias < 1 || dias > 30)) matchTab = false;
                    if (currentTabRango === '31-60' && (dias < 31 || dias > 60)) matchTab = false;
                    if (currentTabRango === '61-90' && (dias < 61 || dias > 90)) matchTab = false;
                    if (currentTabRango === '91+' && dias < 91) matchTab = false;
                    if (currentTabRango === 'no-vencidas' && dias >= 1) matchTab = false;
                }

                if (matchSearch && matchTab) {
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
            
            const cabeceras = ["Número", "Tipo documento", "Cliente", "Creación", "Vencimiento", "Estado", "Total", "Pagado", "Por cobrar"];
            
            const parseMoney = (str) => {
                const parsed = parseFloat(str.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '.').trim());
                return isNaN(parsed) ? 0 : parsed;
            };
            
            const dataToExport = [];
            
            visibles.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length < 10) return;
                
                dataToExport.push({
                    "Número": tds[1].innerText.trim(),
                    "Tipo documento": tds[2].innerText.trim(),
                    "Cliente": tds[3].innerText.trim(),
                    "Creación": tds[4].innerText.trim(),
                    "Vencimiento": tds[5].innerText.trim(),
                    "Estado": tds[6].innerText.trim(),
                    "Total": parseMoney(tds[7].innerText),
                    "Pagado": parseMoney(tds[8].innerText),
                    "Por cobrar": parseMoney(tds[9].innerText)
                });
            });
            
            const ws = XLSX.utils.json_to_sheet(dataToExport, { header: cabeceras });
            
            // Formatear las columnas de moneda como $#,##0.00 en Excel
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                for (let C = 6; C <= 8; ++C) {
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
                    e.currentTarget.style.borderTop = '2px solid var(--primary)';
                }
                
                tabs.forEach(t => {
                    if (t !== e.currentTarget || currentTabRango === 'todas') t.style.borderTop = '';
                });

                aplicarFiltros();
            });
        });
    }
};
