import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions, ExportManager, PrintManager } from '../../shared/crud.js';
import { ItemEngine } from '../../shared/itemEngine.js';
import { NumberingManager } from '../../shared/numberingManager.js';
import { renderTablaFacturas } from '../../shared/tablaFacturas.js';
import { mostrarDetalleTransaccion } from '../../shared/transaccionModal.js';
import { ContactosModule } from '../clientes/clientes.js';
import { UI } from '../../shared/combobox.js';
import { calcularEstadoFactura } from '../../shared/carteraUtils.js';
import { AbonoModal } from '../../shared/abonoModal.js';
import { InventarioUtils } from '../../shared/inventarioUtils.js';
import { EstadoUtils } from '../../shared/estadoUtils.js';
import { anularTransaccion } from '../../shared/transaccionesUtils.js';

export const FacturasModule = {
    cache: { contactos: null, productos: null },
    
    async init(element) {
        if (!element) return;

        // Ya no cargamos catálogos completos (Fase 2)

        const hashParts = window.location.hash.split('/');
        const action = hashParts[3];
        const id = hashParts[4];

        if (action === 'nueva' || action === 'editar') {
            await this.renderForm(element, id, false);
        } else if (action === 'ver') {
            await this.renderForm(element, id, true);
        } else {
            await this.renderList(element);
        }
    },

    async renderList(element) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; color: var(--primary);">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;
        
        let contactosMap = {}; // Caché local a la página de facturas actual

        // Estado de Paginación, Ordenamiento y Filtro Server-Side
        let sortColumn = 'numero';
        let sortDirection = 'desc';
        let currentPage = 1;
        let itemsPerPage = 10;
        let searchQuery = '';
        let filterCriteria = 'todos';
        
        let currentItems = [];
        let totalItems = 0;
        let totalPages = 1;

        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        let kpiDataCxc = null;

        const renderGrid = async () => {
            // Spinner while loading
            if (element.querySelector('tbody')) {
                element.querySelector('tbody').innerHTML = `<tr><td colspan="9" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>`;
            }

            if (!kpiDataCxc) {
                try {
                    const { data, error } = await supabase.rpc('get_facturas_kpis', { p_tipo: 'venta' });
                    if (!error && data) {
                        kpiDataCxc = {
                            facturado: parseFloat(data.facturado) || 0,
                            cobrado: parseFloat(data.cobrado) || 0,
                            pendiente: parseFloat(data.pendiente) || 0
                        };
                    } else {
                        kpiDataCxc = { facturado: 0, cobrado: 0, pendiente: 0 };
                    }
                } catch(e) {
                    kpiDataCxc = { facturado: 0, cobrado: 0, pendiente: 0 };
                }
            }

            try {
                const { data: pageData, error } = await supabase.rpc('get_facturas_con_saldos', {
                    p_page: currentPage,
                    p_limit: itemsPerPage,
                    p_sort_col: sortColumn,
                    p_sort_dir: sortDirection,
                    p_search: searchQuery,
                    p_filter_criteria: filterCriteria,
                    p_tipo: 'venta'
                });
                
                if (error) throw error;
                
                totalItems = pageData && pageData.length > 0 ? pageData[0].total_count : 0;
                totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
                
                if (currentPage > totalPages && totalPages > 0) {
                    currentPage = totalPages;
                    return renderGrid();
                }

                // Resolver nombres de clientes dinámicamente para la página actual
                const contactoIds = pageData.map(c => c.clienteId || c.contacto_id || c.contactoId).filter(Boolean);
                if (contactoIds.length > 0) {
                    const { data: cdata } = await supabase.from('contactos').select('id, nombre').in('id', contactoIds);
                    if (cdata) cdata.forEach(c => contactosMap[c.id] = c.nombre);
                }

                currentItems = pageData.map(f => {
                    // El RPC ya devuelve estado_dinamico, saldo_pendiente y total_pagado
                    return { ...f, estado: f.estado_dinamico, saldoPendiente: f.saldo_pendiente, totalPagado: f.total_pagado };
                });
            } catch (err) {
                console.error(err);
                if (element.querySelector('tbody')) {
                    element.querySelector('tbody').innerHTML = `<tr><td colspan="9" class="text-center py-5 text-danger">Error al cargar datos</td></tr>`;
                }
                return;
            }

            const startIndex = (currentPage - 1) * itemsPerPage;

            element.innerHTML = `
                <div class=\"dash-layout p-4\" style=\"max-width: 1100px; margin: 0 auto;\">
                    <!-- TOP BAR -->
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Facturas de venta</h2>
                            <p class="text-muted mb-0" style="font-size: var(--fs-md);">
                                Gestiona las facturas generadas por ventas a tus clientes. 
                            </p>
                        </div>
                        <div class="d-flex gap-2">
                            <button id="btn-refresh-list" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body);">
                                <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
                            </button>
                            <button id="btn-export-list" class="btn btn-light bg-white border" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body);">
                                <i class="bi bi-download me-1"></i> Exportar
                            </button>
                            <button id="btn-nueva-factura" class="btn btn-primary-action">
                                <i class="bi bi-plus-lg me-1"></i> Nueva factura
                            </button>
                        </div>
                    </div>

                    <!-- KPI CARDS FACTURAS -->
                    <div class="row g-3 mb-4">
                        <div class="col-12 col-sm-6 col-lg-4">
                            <div class="ds-kpi-card">
                                <span class="ds-kpi-label">Total Facturado</span>
                                <div class="ds-kpi-value">$ ${formatMoney(kpiDataCxc.facturado).replace('$ ', '')}</div>
                            </div>
                        </div>
                        <div class="col-12 col-sm-6 col-lg-4">
                            <div class="ds-kpi-card">
                                <span class="ds-kpi-label">Total Cobrado</span>
                                <div class="ds-kpi-value">$ ${formatMoney(kpiDataCxc.cobrado).replace('$ ', '')}</div>
                            </div>
                        </div>
                        <div class="col-12 col-sm-6 col-lg-4">
                            <div class="ds-kpi-card">
                                <span class="ds-kpi-label">Total Pendiente</span>
                                <div class="ds-kpi-value">$ ${formatMoney(kpiDataCxc.pendiente).replace('$ ', '')}</div>
                            </div>
                        </div>
                    </div>

                    <!-- DATA TABLE CARD -->
                    <div class="ds-table-container mb-4">
                        <!-- FILTERS -->
                        <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center">
                            <div class="ds-search-container" style="width: 250px;">
                                <i class="bi bi-search ds-search-icon"></i>
                                <input type="text" class="ds-search-input" id="searchFacturas" autocomplete="off" placeholder="Buscar..." value="${searchQuery}">
                            </div>
                            <div class="dropdown">
                                <button class="btn btn-link text-decoration-none text-muted p-0 dropdown-toggle" data-bs-toggle="dropdown" style="font-size: var(--fs-md);">
                                    <i class="bi bi-funnel me-1"></i> Filtrar <span id="lbl-filtro-actual" style="font-size: var(--fs-sm); font-weight: 500; color: var(--primary);">${filterCriteria !== 'todos' ? '('+filterCriteria+')' : ''}</span>
                                </button>
                                <ul class="dropdown-menu shadow border-0" style="font-size: var(--fs-base);">
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

                        <!-- GRID -->
                        ${renderTablaFacturas(currentItems, contactosMap, sortColumn, sortDirection)}

                        <!-- PAGINATION FOOTER -->
                        <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center" style="border-radius: 0 0 var(--border-radius-sm) var(--border-radius-sm);">
                            <div class="d-flex align-items-center gap-3" style="font-size: var(--fs-base); color: var(--text-body);">
                                <div class="d-flex align-items-center gap-2">
                                    <span>Resultados por página:</span>
                                    <select class="form-select form-select-sm text-muted" id="select-per-page" style="width: 70px;">
                                        <option value="10" ${itemsPerPage===10?'selected':''}>10</option>
                                        <option value="20" ${itemsPerPage===20?'selected':''}>20</option>
                                        <option value="50" ${itemsPerPage===50?'selected':''}>50</option>
                                        <option value="100" ${itemsPerPage===100?'selected':''}>100</option>
                                    </select>
                                </div>
                                <span class="text-muted border-start ps-3">${totalItems > 0 ? startIndex + 1 : 0}-${Math.min(startIndex + itemsPerPage, totalItems)} de ${totalItems}</span>
                            </div>

                            <div class="d-flex align-items-center gap-2" style="font-size: var(--fs-base); color: var(--text-body);">
                                <span>Página</span>
                                <input type="number" id="input-page" class="form-control form-control-sm text-center text-muted" value="${currentPage}" min="1" max="${totalPages}" style="width: 50px;">
                                <span>de ${totalPages}</span>
                                <div class="ms-2">
                                    <button class="btn btn-link text-muted p-0 me-1" id="btn-prev-page" ${currentPage === 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
                                    <button class="btn btn-link text-muted p-0" id="btn-next-page" ${currentPage === totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            bindGridEvents();
        };

        const bindGridEvents = () => {
            // Re-aplicar focus si venimos de un re-render
            const searchInput = element.querySelector('#searchFacturas');
            if (searchInput) {
                searchInput.focus();
                const val = searchInput.value;
                searchInput.value = '';
                searchInput.value = val;
            }

            // Buscador del servidor con debounce
            if (searchInput) {
                const clearSearchBtn = element.querySelector('#clearSearchBtn');
                
                let debounceTimer;
                searchInput.addEventListener('input', (e) => {
                    const val = e.target.value;
                    if (clearSearchBtn) {
                        clearSearchBtn.style.display = val.length > 0 ? '' : 'none';
                    }
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        searchQuery = val.trim();
                        currentPage = 1;
                        renderGrid();
                    }, 400);
                });

                if (clearSearchBtn) {
                    clearSearchBtn.addEventListener('click', () => {
                        searchInput.value = '';
                        clearSearchBtn.style.display = 'none';
                        searchQuery = '';
                        currentPage = 1;
                        renderGrid();
                    });
                }
            }

            // Ordenamiento por Columnas
            element.querySelectorAll('.sortable-header').forEach(header => {
                header.addEventListener('click', (e) => {
                    const col = e.currentTarget.dataset.column;
                    if (sortColumn === col) {
                        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortColumn = col;
                        sortDirection = 'desc';
                    }
                    renderGrid();
                });
            });

            // Cambiar Criterio de Filtro
            element.querySelectorAll('.filter-opt').forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.preventDefault();
                    filterCriteria = e.target.dataset.criteria;
                    currentPage = 1;
                    renderGrid();
                });
            });

            // Crear Factura
            element.querySelector('#btn-nueva-factura')?.addEventListener('click', () => {
                window.location.hash = '#/ingresos/facturas/nueva';
            });

            // Exportar Lista a CSV (descarga completa de filtros actuales)
            element.querySelector('#btn-export-list')?.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const originalHtml = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Generando...`;
                
                try {
                    const { data: allFiltered, error } = await supabase.rpc('get_facturas_con_saldos', {
                        p_page: 1,
                        p_limit: 10000,
                        p_sort_col: sortColumn,
                        p_sort_dir: sortDirection,
                        p_search: searchQuery,
                        p_filter_criteria: filterCriteria,
                        p_tipo: 'venta'
                    });
                    if (error) throw error;
                    
                    const allDecorated = allFiltered.map(f => {
                        return { ...f, estado: f.estado_dinamico, saldoPendiente: f.saldo_pendiente, totalPagado: f.total_pagado };
                    });
                    
                    const exportIds = allFiltered.map(c => c.clienteId || c.contacto_id || c.contactoId).filter(Boolean);
                    let exportMap = {};
                    if (exportIds.length > 0) {
                        const { data: edata } = await supabase.from('contactos').select('id, nombre').in('id', exportIds);
                        if (edata) edata.forEach(c => exportMap[c.id] = c.nombre);
                    }
                    const getExportName = (id) => exportMap[id] || 'Sin Cliente';

                    btn.innerHTML = originalHtml;
                    btn.disabled = false;

                    ExportManager.exportDataToExcel(allDecorated, 'Facturas', getExportName, btn);
                } catch(err) { 
                    console.error(err); 
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }
            });

            // Actualizar Caché
            element.querySelector('#btn-refresh-list')?.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const originalHtml = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`;
                
                await renderGrid();
                
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            });

            // Paginación
            element.querySelector('#select-per-page')?.addEventListener('change', (e) => {
                itemsPerPage = parseInt(e.target.value);
                currentPage = 1;
                renderGrid();
            });

            element.querySelector('#input-page')?.addEventListener('change', (e) => {
                let val = parseInt(e.target.value) || 1;
                currentPage = val;
                renderGrid();
            });

            element.querySelector('#btn-prev-page')?.addEventListener('click', () => {
                if (currentPage > 1) { currentPage--; renderGrid(); }
            });

            element.querySelector('#btn-next-page')?.addEventListener('click', () => {
                if (currentPage < totalPages) { currentPage++; renderGrid(); }
            });

            // Row Menu Actions (Popovers Flotantes)
            element.querySelectorAll('.btn-menu-row').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const existing = document.querySelector('.row-action-menu');
                    if (existing) existing.remove();

                    const id = e.currentTarget.dataset.id;
                    const rect = e.currentTarget.getBoundingClientRect();

                    const factData = currentItems.find(f => f.id == id);
                    const canAbonar = factData && factData.estado !== 'pagada' && !EstadoUtils.estaAnulado(factData.estado);
                    const isAnulada = factData && EstadoUtils.estaAnulado(factData.estado);
                    
                    const menuHtml = `
                        <div class="row-action-menu position-absolute bg-white shadow rounded border py-2" 
                             style="z-index: 1060; width: 150px; top: ${rect.bottom + window.scrollY}px; left: ${rect.left - 100}px;">
                            ${canAbonar ? `
                            <a href="#" class="d-block px-3 py-1 text-decoration-none btn-abonar-factura" data-id="${id}" data-saldo="${factData.saldoPendiente}" style="color: var(--success); font-size: var(--fs-base);">
                                <i class="bi bi-wallet2 me-2"></i> Registrar Pago
                            </a>
                            <hr class="dropdown-divider my-1">` : ''}
                            ${!isAnulada ? `
                            <a href="#/ingresos/facturas/editar/${id}" class="d-block px-3 py-1 text-decoration-none" style="color: var(--text-body); font-size: var(--fs-base);">
                                <i class="bi bi-pencil me-2"></i> Editar
                            </a>
                            ${factData.tipo === 'compra' ? `
                            <a href="#" class="d-block px-3 py-1 text-decoration-none mt-1 btn-anular-compra" data-id="${id}" style="color: var(--danger); font-size: var(--fs-base);">
                                <i class="bi bi-x-circle me-2"></i> Anular Compra
                            </a>` : (factData.estado === 'anulada' ? '' : (factData.totalPagado > 0 ? `
                            <a href="#" class="d-block px-3 py-1 text-decoration-none mt-1 btn-anular-venta" data-id="${id}" style="color: var(--danger); font-size: var(--fs-base);">
                                <i class="bi bi-x-circle me-2"></i> Anular Venta
                            </a>` : `
                            <a href="#" class="d-block px-3 py-1 text-decoration-none mt-1 btn-delete-row" data-id="${id}" style="color: var(--danger); font-size: var(--fs-base);">
                                <i class="bi bi-trash me-2"></i> Eliminar
                            </a>`))}
                            ` : `
                            <a href="#/ingresos/facturas/editar/${id}" class="d-block px-3 py-1 text-decoration-none" style="color: var(--text-body); font-size: var(--fs-base);">
                                <i class="bi bi-eye me-2"></i> Ver Detalles
                            </a>`}
                        </div>
                    `;
                    document.body.insertAdjacentHTML('beforeend', menuHtml);

                    const menu = document.querySelector('.row-action-menu');
                    
                    if (canAbonar) {
                        menu.querySelector('.btn-abonar-factura').addEventListener('click', (ev) => {
                            ev.preventDefault();
                            const facId = ev.currentTarget.dataset.id;
                            menu.remove();
                            AbonoModal.show(facId, () => {
                                renderGrid(); // Recargar grid para reflejar estado
                            });
                        });
                    }

                    const btnDeleteRow = menu.querySelector('.btn-delete-row');
                    if (btnDeleteRow) {
                        btnDeleteRow.addEventListener('click', async (ev) => {
                            ev.preventDefault();
                            if (confirm('¿Estás seguro de eliminar esta factura de forma permanente? Se devolverá el inventario asociado.')) {
                                menu.remove();
                                try {
                                    // El RPC realiza la validación de pagos, la reversión atómica de inventario 
                                    // y el borrado de la factura. Todo en una sola transacción segura.
                                    const { data: result, error } = await supabase.rpc('eliminar_factura_venta', { 
                                        p_factura_id: parseInt(id, 10) 
                                    });

                                    if (error) {
                                        throw new Error(error.message || "Error devuelto por la base de datos.");
                                    }

                                    // Forzar limpieza de caché
                                    DB.invalidateCache('facturas');
                                    DB.invalidateCache('lotes_fifo');
                                    
                                    await renderGrid();
                                    CoreActions.showSuccessModal('Factura eliminada y stock devuelto exitosamente.');
                                } catch (error) {
                                    console.error("Error al eliminar:", error);
                                    CoreActions.showWarningModal("No se pudo eliminar: " + error.message);
                                }
                            }
                        });
                    }

                    const btnAnularVenta = menu.querySelector('.btn-anular-venta');
                    if (btnAnularVenta) {
                        btnAnularVenta.addEventListener('click', async (ev) => {
                            ev.preventDefault();
                            if (confirm('¿Estás seguro de anular esta venta? Se revertirá el inventario y el pago asociado. Esta acción no se puede deshacer.')) {
                                menu.remove();
                                try {
                                    const { data: result, error } = await supabase.rpc('anular_venta_pagada', { 
                                        p_factura_id: parseInt(id, 10) 
                                    });

                                    if (error) {
                                        throw new Error(error.message || "Error devuelto por la base de datos.");
                                    }

                                    // Forzar limpieza de caché
                                    DB.invalidateCache('facturas');
                                    DB.invalidateCache('lotes_fifo');
                                    DB.invalidateCache('transacciones');
                                    DB.invalidateCache('pagos_ingresos');
                                    DB.invalidateCache('comisiones');
                                    
                                    await renderGrid();
                                    CoreActions.showSuccessModal('Venta anulada exitosamente.');
                                } catch (error) {
                                    console.error("Error al anular venta:", error);
                                    CoreActions.showWarningModal("No se pudo anular: " + error.message);
                                }
                            }
                        });
                    }

                    const btnAnularCompra = menu.querySelector('.btn-anular-compra');
                    if (btnAnularCompra) {
                        btnAnularCompra.addEventListener('click', async (ev) => {
                            ev.preventDefault();
                            if (confirm('¿Estás seguro de anular esta factura de compra? Se revertirá el inventario ingresado.')) {
                                menu.remove();
                                
                                try {
                                    const { anularFacturaCompra } = await import('../../shared/anularCompraUtils.js');
                                    const result = await anularFacturaCompra(id, { DB, EstadoUtils, InventarioUtils, supabase, CoreActions });
                                    
                                    if (result.alreadyAnnulled) {
                                        CoreActions.showWarningModal("Esta factura ya se encuentra anulada.");
                                        return;
                                    }
                                    
                                    CoreActions.showSuccessModal('Factura de compra anulada e inventario revertido con éxito.');
                                    await renderGrid();
                                } catch (err) {
                                    console.error('Error al anular compra:', err);
                                    CoreActions.showErrorModal('Error: ' + err.message);
                                }
                            }
                        });
                    }
                });
            });

            // Imprimir rápido
            element.querySelectorAll('.btn-imprimir-row').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = e.currentTarget.dataset.id;
                    const doc = await DB.get('facturas', id);
                    if (doc) {
                        const contactos = await DB.getAll('contactos');
                        const productos = await DB.getAll('productos');
                        PrintManager.printDocument(doc, 'Factura de venta', contactos, productos);
                    }
                });
            });
        };

        await renderGrid();
    },

    async renderForm(element, id = null, isViewOnly = false) {
        const facturaIdTransacciones = id ? [id] : [];
        const { data: rawTransaccionesData } = facturaIdTransacciones.length > 0
            ? await supabase.from('pagos_ingresos').select('*').in('factura_id', facturaIdTransacciones)
            : { data: [] };
            
        // TRADUCCIÓN OBLIGATORIA: El query crudo a Supabase devuelve 'in' / 'out'. 
        // calcularEstadoFactura exige el contrato 'ingreso' / 'egreso'.
        const transacciones = (rawTransaccionesData || []).map(t => ({
            ...t,
            tipo: t.tipo === 'in' ? 'ingreso' : 'egreso'
        }));

        const { data: rawNotasCredito } = facturaIdTransacciones.length > 0
            ? await supabase.from('notas_credito').select('*').in('factura_id', facturaIdTransacciones)
            : { data: [] };
        const notasCredito = rawNotasCredito || [];
        
        // Estado por defecto
        let factura = {
            id: 'fac_' + Date.now(),
            numero: undefined,
            fecha: getLocalDate(),
            vencimiento: '',
            clienteId: '',
            detalles: [{ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 }],
            notas: '',
            terminosCondiciones: 'Favor realizar los pagos a nuestra cuenta bancaria.',
            estado: 'por_pagar',
            total: 0
        };

        if (id) {
            const dbData = await DB.get('facturas', id);
            if (dbData) {
                factura = dbData;
                // Decorar factura con saldo real al vuelo
                const dinamico = calcularEstadoFactura(factura, transacciones);
                factura.estado = dinamico.estado;
                factura.saldoPendiente = dinamico.saldo;
            }
            
            // Fix backwards compatibility for converted cotizaciones
            if (factura.contactoId && !factura.clienteId) {
                factura.clienteId = factura.contactoId;
            }
            if (!factura.numero) {
                factura.numero = Math.floor(Math.random() * 9000) + 1000;
            }

            if (!factura.detalles || factura.detalles.length === 0) {
                factura.detalles = [{ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 }];
            }
        }

        const headerHtml = CoreActions.renderDocumentHeader('ingresos/facturas', 'Volver a Facturas de venta');
        const actionsHtml = CoreActions.renderActionButtons(factura, 'factura', isViewOnly, !id);

        const contactos = await DB.getAll('contactos');

        // Fetch initial client name
        let clienteNombreActual = '';
        if (factura.clienteId) {
            const { data: cliData } = await supabase.from('contactos').select('nombre').eq('id', factura.clienteId).single();
            if (cliData) clienteNombreActual = cliData.nombre;
        }

        // Fetch initial products for details
        let productosFactura = [];
        if (factura.detalles && factura.detalles.length > 0) {
            const pIds = factura.detalles.map(d => d.productoId).filter(Boolean);
            if (pIds.length > 0) {
                const { data: pData } = await supabase.from('productos').select('*').in('id', pIds);
                if (pData) productosFactura = pData.map(p => DB._mapToFrontend('productos', p));
            }
        }
        
        const dbContactos = await DB.getAll('contactos') || [];
        const clientes = dbContactos.filter(c => c.estado === 'activo' && (c.es_cliente || c.tipo !== 'proveedor'));

        const { data: vendedoresActivos } = await supabase.from('vendedores').select('id, nombre').eq('estado', 'activo').order('nombre');
        const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
        const cuentasActivas = dbCuentas.filter(c => c.estado === 'active');
        const cuentasMap = {};
        dbCuentas.forEach(c => cuentasMap[c.id] = c.nombre);

        element.innerHTML = `
            <div class=\"dash-layout p-4\" style=\"max-width: 1100px; margin: 0 auto;\">
                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        ${headerHtml}
                        <h2 class="h3 fw-bold mb-0" style="color: var(--text-main);">${id ? 'Factura No. ' + factura.numero : 'Nueva factura'}</h2>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        ${isViewOnly && id && factura.estado !== 'pagada' && !EstadoUtils.estaAnulado(factura.estado) ? 
                            `<button class="btn btn-primary-action px-4 btn-abonar-detalle" data-id="${factura.id}" data-saldo="${factura.saldoPendiente}"><i class="bi bi-wallet2 me-2"></i>Registrar Pago</button>` 
                            : ''}
                        ${actionsHtml}
                    </div>
                </div>

                <div class="dash-table-container mb-4" style="overflow: visible;">
                    <div class="card-body p-3 p-md-5">
                        <!-- HEADER DOCUMENTO -->
                        <div class="row mb-4 align-items-center">
                            <div class="col-12 col-md-4 mb-3 mb-md-0 text-center text-md-start">
                                <img src="LogoMas.png" alt="Logo" style="max-height: 80px;">
                            </div>
                            <div class="col-12 col-md-4 text-center mb-3 mb-md-0">
                                <h5 class="fw-bold" style="color: var(--text-main);">Accesorios .</h5>
                            </div>
                            <div class="col-12 col-md-4 text-center text-md-end">
                                <select class="form-select mb-2 bg-light border-0 d-inline-block w-auto">
                                    <option>Factura de venta</option>
                                </select>
                                <div class="d-flex justify-content-center justify-content-md-end align-items-center text-muted" style="font-size: var(--fs-md);">
                                    <span id="lbl-numero">No. <strong style="color: var(--text-main);">${factura.numero || '[Autogenerado al guardar]'}</strong></span>
                                    ${!isViewOnly ? `<i class="bi bi-gear ms-2" id="btn-config-num" style="cursor: pointer;"></i>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- INFO FACTURA -->
                        <h6 class="fw-bold mb-3" style="color: var(--text-main);">Información de la factura</h6>
                        <div class="row mb-5 g-3">
                            <div class="col-12 col-sm-6 col-md-3">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Cliente <span class="text-danger">*</span></label>
                                ${isViewOnly ? `
                                <a href="#/contactos/ver/${factura.clienteId}" class="form-control form-control-sm text-decoration-none d-flex align-items-center justify-content-between" style="cursor:pointer; color: var(--text-body); background-color: #e9ecef; border-color: #ced4da;">
                                    ${clienteNombreActual}
                                    <i class="bi bi-box-arrow-up-right text-muted" style="font-size: 0.75rem;"></i>
                                </a>
                                <input type="hidden" id="select-cliente" value="${factura.clienteId || ''}">
                                ` : `
                                <input type="text" id="search-cliente" class="form-control form-control-sm text-muted" placeholder="Buscar cliente..." value="${clienteNombreActual}" autocomplete="off">
                                <input type="hidden" id="select-cliente" value="${factura.clienteId || ''}">
                                `}
                            </div>
                            <div class="col-12 col-sm-6 col-md-3">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Tipo de Venta</label>
                                <select id="select-tipo-venta" class="form-select form-select-sm text-muted" ${isViewOnly ? 'disabled' : ''}>
                                    <option value="credito" ${factura.tipoVenta === 'credito' || !factura.tipoVenta ? 'selected' : ''}>A Crédito (Cartera)</option>
                                    <option value="contado" ${factura.tipoVenta === 'contado' ? 'selected' : ''}>De Contado (Caja)</option>
                                </select>
                            </div>
                            <div class="col-12 col-sm-6 col-md-3" id="container-cuenta-venta" style="display: ${factura.tipoVenta === 'contado' ? 'block' : 'none'};">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Cuenta (Contado)</label>
                                <select id="select-cuenta-venta" class="form-select form-select-sm text-muted" ${isViewOnly ? 'disabled' : ''}>
                                    ${cuentasActivas.map(c => `<option value="${c.nombre}" ${factura.cuentaId === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-6 col-md-3">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Fecha de creación</label>
                                <input type="date" id="input-fecha" class="form-control form-control-sm text-muted" value="${factura.fecha}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-6 col-md-3">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Fecha de vencimiento</label>
                                <input type="date" id="input-vencimiento" class="form-control form-control-sm text-muted" value="${factura.vencimiento}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-6 col-md-3">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Vendedor (opcional)</label>
                                <select id="select-vendedor" class="form-select form-select-sm text-muted" ${isViewOnly ? 'disabled' : ''}>
                                    <option value="">Sin vendedor asignado</option>
                                    ${(vendedoresActivos || []).map(v => `<option value="${v.id}" ${String(factura.vendedor_id) === String(v.id) ? 'selected' : ''}>${v.nombre}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <hr class="mb-5" style="border-color: var(--border-color); opacity: 1;">

                        <!-- PRODUCTOS -->
                        <h6 class="fw-bold mb-3" style="color: var(--text-main);">Productos y servicios</h6>
                        <div class="table-responsive mb-3" style="overflow: visible;">
                            <table class="table table-borderless align-middle mb-0" id="tabla-detalles" style="font-size: var(--fs-base);">
                                <thead style="border-bottom: 1px solid var(--border-color);">
                                    <tr style="color: var(--text-muted); font-weight: var(--weight-regular);">
                                        <th style="width: 40px;"><input type="checkbox" class="form-check-input" disabled></th>
                                        <th style="width: 35%; min-width: 180px;">Producto o servicios</th>
                                        <th style="width: 15%;">Cantidad</th>
                                        <th style="width: 15%;">Precio</th>
                                        <th style="width: 10%;">Desc %</th>
                                        <th style="width: 12%;">Impto %</th>
                                        <th class="text-end" style="width: 13%;">Subtotal</th>
                                        <th style="width: 40px;"></th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-detalles">
                                    <!-- Líneas dinámicas renderizadas por JS -->
                                </tbody>
                            </table>
                        </div>
                        
                        ${!isViewOnly ? `
                        <button id="btn-agregar-linea" class="btn btn-link text-decoration-none p-0 mb-5" style="font-size: var(--fs-md); font-weight: var(--weight-medium); color: var(--primary);">
                            <i class="bi bi-plus-lg me-1"></i>Agregar línea
                        </button>
                        ` : ''}

                        <!-- TOTALES -->
                        <div class="row justify-content-end mb-5">
                            <div class="col-md-4">
                                <div class="d-flex justify-content-between mb-2" style="font-size: var(--fs-md); color: var(--text-body);">
                                    <span>Subtotal</span><span id="tot-subtotal">$0,00</span>
                                </div>
                                <div class="d-flex justify-content-between mb-2" style="font-size: var(--fs-md); color: var(--text-body);">
                                    <span>Descuento</span><span id="tot-descuento">$0,00</span>
                                </div>
                                <div class="d-flex justify-content-between mb-3" style="font-size: var(--fs-md); color: var(--text-body);">
                                    <span>Impuestos</span><span id="tot-impuestos">$0,00</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="fw-bold" style="font-size: var(--fs-lg); color: var(--text-main);">Total</span>
                                    <span class="fw-bold" id="tot-total" style="font-size: var(--fs-lg); color: var(--text-main);" data-raw-total="0">$0,00</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- TEXTAREAS ADICIONALES -->
                <div class="mb-4">
                    <h6 class="fw-bold mb-1" style="font-size: var(--fs-md); color: var(--text-main);">Notas</h6>
                    <textarea id="input-notas" class="form-control text-muted" rows="2" style="font-size: var(--fs-base); border-color: var(--border-color); resize: none;" placeholder="Agrega comentarios para aclarar datos de la factura, serán visibles para tus clientes" ${isViewOnly ? 'disabled' : ''}>${factura.notas}</textarea>
                </div>
                <div>
                    <h6 class="fw-bold mb-1" style="font-size: var(--fs-md); color: var(--text-main);">Términos y condiciones</h6>
                    <textarea id="input-terminos" class="form-control text-muted" rows="2" style="font-size: var(--fs-base); border-color: var(--border-color); resize: none;" placeholder="Define los términos y condiciones, y/o las posibles cláusulas en caso de reclamos" ${isViewOnly ? 'disabled' : ''}>${factura.terminosCondiciones}</textarea>
                </div>

                <!-- DOCUMENTOS RELACIONADOS (Solo Vista) -->
                ${isViewOnly ? `
                <div class="mt-5">
                    <h6 class="fw-bold mb-3" style="color: var(--text-main);">Documentos relacionados</h6>
                    <ul class="nav nav-tabs mb-3" role="tablist" style="border-bottom: 2px solid var(--border-color);">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-pagos" type="button" role="tab" style="font-size: var(--fs-base); font-weight: var(--weight-medium); color: var(--text-main); border-bottom-color: transparent;">Pagos recibidos</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link text-muted" data-bs-toggle="tab" data-bs-target="#tab-notas-credito" type="button" role="tab" style="font-size: var(--fs-base); font-weight: var(--weight-medium); border-bottom-color: transparent;">Notas de crédito</button>
                        </li>
                        ${factura.cotizacion_origen_id ? `
                        <li class="nav-item" role="presentation">
                            <button class="nav-link text-muted" data-bs-toggle="tab" data-bs-target="#tab-cotizacion" type="button" role="tab" style="font-size: var(--fs-base); font-weight: var(--weight-medium); border-bottom-color: transparent;">Cotización origen</button>
                        </li>` : ''}
                    </ul>
                    
                    <div class="tab-content border-0 p-0">
                        <div class="tab-pane fade show active" id="tab-pagos" role="tabpanel">
                            <div class="table-responsive">
                                <table class="table table-sm align-middle mb-0" style="font-size: var(--fs-base);">
                                    <thead>
                                        <tr class="text-muted" style="border-bottom: 1px solid var(--border-color);">
                                            <th class="fw-medium pb-2">Fecha</th>
                                            <th class="fw-medium pb-2">Cuenta</th>
                                            <th class="fw-medium pb-2">Método</th>
                                            <th class="fw-medium pb-2 text-end">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(transacciones && transacciones.length > 0) ? transacciones.map((p, idx) => `
                                        <tr class="fila-pago" data-index="${idx}" style="border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'">
                                            <td class="py-2 text-muted">${p.fecha || p.created_at?.split('T')[0] || ''}</td>
                                            <td class="py-2">${cuentasMap[p.cuentaId || p.cuenta_id] || (p.cuentaId || p.cuenta_id || '-')}</td>
                                            <td class="py-2">${p.metodo_pago || p.metodoPago || '-'}</td>
                                            <td class="py-2 text-end fw-medium">$${Number(p.monto || p.valor || 0).toLocaleString()}</td>
                                        </tr>`).join('') : `
                                        <tr><td colspan="4" class="text-muted text-center py-4">No hay pagos registrados para esta factura</td></tr>
                                        `}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div class="tab-pane fade" id="tab-notas-credito" role="tabpanel">
                            <div class="table-responsive">
                                <table class="table table-sm align-middle mb-0" style="font-size: var(--fs-base);">
                                    <thead>
                                        <tr class="text-muted" style="border-bottom: 1px solid var(--border-color);">
                                            <th class="fw-medium pb-2">Fecha</th>
                                            <th class="fw-medium pb-2">Número NC</th>
                                            <th class="fw-medium pb-2">Motivo</th>
                                            <th class="fw-medium pb-2 text-center">Estado</th>
                                            <th class="fw-medium pb-2 text-end">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(notasCredito && notasCredito.length > 0) ? notasCredito.map(nc => `
                                        <tr style="border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'" onclick="window.location.hash='#/ingresos/notas-credito/ver/${nc.id}'">
                                            <td class="py-2 text-muted">${nc.fecha || ''}</td>
                                            <td class="py-2">NC-${nc.numero || nc.id}</td>
                                            <td class="py-2">${nc.motivo || '-'}</td>
                                            <td class="py-2 text-center">${EstadoUtils.estaAnulado(nc.estado) ? '<span class="text-danger fw-bold">Anulada</span>' : '<span class="text-success fw-bold">Activa</span>'}</td>
                                            <td class="py-2 text-end fw-medium">$${Number(nc.total || 0).toLocaleString()}</td>
                                        </tr>`).join('') : `
                                        <tr><td colspan="5" class="text-muted text-center py-4">No hay notas de crédito registradas</td></tr>
                                        `}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        
                        ${factura.cotizacion_origen_id ? `
                        <div class="tab-pane fade" id="tab-cotizacion" role="tabpanel">
                            <div class="card border border-light shadow-sm" style="max-width:300px; cursor:pointer;" onclick="sessionStorage.setItem('origenVolver', JSON.stringify({hash: '#/ingresos/facturas/ver/${factura.id}', label: 'Volver a la factura'})); window.location.hash='#/ingresos/cotizaciones/ver/${factura.cotizacion_origen_id}'">
                                <div class="card-body py-3 px-3 d-flex justify-content-between align-items-center">
                                    <div>
                                        <small class="text-muted d-block" style="font-size: var(--fs-xs);">Ver documento origen</small>
                                        <span class="fw-medium text-dark" style="font-size: var(--fs-md); color: var(--primary) !important;">Cotización</span>
                                    </div>
                                    <i class="bi bi-box-arrow-up-right text-muted" style="font-size: var(--fs-sm);"></i>
                                </div>
                            </div>
                        </div>` : ''}
                    </div>
                </div>
                ` : ''}

                <!-- FOOTER ACTIONS -->
                ${!isViewOnly ? `
                <div class="d-flex justify-content-end gap-3 mb-5">
                    <button id="btn-cancelar" class="btn btn-outline-secondary px-4 bg-white" style="font-weight: var(--weight-medium); border-color: var(--border-color);">
                        Cancelar
                    </button>
                    <button id="btn-guardar" class="btn btn-primary px-5" style="font-weight: var(--weight-medium);">Guardar</button>
                </div>
                ` : ''}
            </div>
        `;

        if (id) {
            // Pasamos 'factura' en vez de 'cotizacion' para que evite renderizar "Convertir a Factura"
            CoreActions.bindActionEvents(element, factura, 'factura', {});
            
            element.querySelectorAll('.fila-pago').forEach(row => {
                row.addEventListener('click', () => {
                    const idx = parseInt(row.dataset.index, 10);
                    if (!isNaN(idx) && transacciones && transacciones[idx]) {
                        mostrarDetalleTransaccion(transacciones[idx], () => {
                            this.renderForm(element, id, isViewOnly);
                        });
                    }
                });
            });
        }

        // ==========================================
        // LÓGICA DE INTERACCIÓN (ENGINE DOM)
        // ==========================================

        const tbody = element.querySelector('#tbody-detalles');
        let contadorLineas = 0;

        // Renderizador de fila dinámica
        const addRow = (detalle) => {
            contadorLineas++;
            const tr = document.createElement('tr');
            tr.dataset.uid = detalle.id;
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.innerHTML = `
                <td class="text-muted text-center num-linea align-top pt-3">${contadorLineas}</td>
                <td class="align-top">
                    ${ItemEngine.renderProductSearchBox(detalle, productosFactura, isViewOnly)}
                    <div class="meta-prod ps-1"></div>
                </td>
                <td class="align-top">
                    <input type="number" min="0" class="form-control form-control-sm border-0 bg-light input-qty mb-1" value="${detalle.cantidad}" ${isViewOnly ? 'disabled' : ''}>
                    <div class="meta-qty ps-1"></div>
                </td>
                <td class="align-top"><input type="text" class="form-control form-control-sm border-0 bg-light input-price" value="${detalle.precio}" placeholder="$" ${isViewOnly ? 'disabled' : ''}></td>
                <td class="align-top"><input type="number" step="any" min="0" max="100" class="form-control form-control-sm border-0 bg-light input-disc" value="${detalle.descuento}" placeholder="0 %" ${isViewOnly ? 'disabled' : ''}></td>
                <td class="align-top"><input type="number" step="any" min="0" max="100" class="form-control form-control-sm border-0 bg-light input-tax" value="${detalle.impuesto}" placeholder="%" ${isViewOnly ? 'disabled' : ''}></td>
                <td class="text-end align-top pt-3">
                    <span class="calc-subtotal fw-bold d-block" style="color: var(--text-main);">$0,00</span>
                    <a href="#" class="toggle-desc-tax d-md-none text-decoration-none mt-2 d-inline-block" style="font-size: var(--fs-xs); color: var(--primary);">+ Editar descuento/impuesto</a>
                </td>
                <td class="text-center align-top pt-2">
                    ${!isViewOnly ? `<button class="btn btn-link text-muted p-0 btn-eliminar-linea">
                        <i class="bi bi-trash"></i>
                    </button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);

            // Toggle Descuento/Impuesto móvil
            const toggleDesc = tr.querySelector('.toggle-desc-tax');
            if (toggleDesc) {
                toggleDesc.addEventListener('click', (e) => {
                    e.preventDefault();
                    tr.classList.toggle('show-discount-tax');
                    toggleDesc.textContent = tr.classList.contains('show-discount-tax') ? '- Ocultar descuento/impuesto' : '+ Editar descuento/impuesto';
                });
            }

            // Delegar Eventos Principales al Motor Global (Auto-Pricing y Metadatos)
            ItemEngine.bindLineEvents(tr, () => calcEngine(), productosFactura);

            if (!isViewOnly) {
                // Disparadores locales del Math Engine
                const inpQty = tr.querySelector('.input-qty');
                const inpPrice = tr.querySelector('.input-price');
                const inpDisc = tr.querySelector('.input-disc');
                const inpTax = tr.querySelector('.input-tax');
                
                import('../../shared/formatters.js').then(fmt => {
                    fmt.applyCurrencyFormatting(inpPrice);
                    [inpQty, inpPrice, inpDisc, inpTax].forEach(el => {
                        el.addEventListener('input', () => calcEngine());
                    });
                });

                // Eliminar línea
                tr.querySelector('.btn-eliminar-linea').addEventListener('click', () => {
                    tr.remove();
                    reindexRows();
                    calcEngine();
                });
            }

            // Render inicial si había producto seleccionado (Edición)
            if (detalle.productoId) {
                // Forzar re-cálculo visual inicial si es necesario
                const metaProd = tr.querySelector('.meta-prod');
                const metaQty = tr.querySelector('.meta-qty');
                const prod = productosFactura.find(p => p.id === detalle.productoId);
                if (prod) {
                    if (metaProd) metaProd.innerHTML = `<span style="color: var(--text-muted); font-size: var(--fs-xs);">${prod.sku || 'S/N'}</span>`;
                    if (metaQty) metaQty.innerHTML = `<span style="color: var(--text-muted); font-size: var(--fs-xs);">Disp: ${prod.stockActual || prod.cantidad || 0}</span>`;
                }
            }
        };

        // Reindexador de numerales
        const reindexRows = () => {
            contadorLineas = 0;
            tbody.querySelectorAll('tr').forEach(tr => {
                contadorLineas++;
                tr.querySelector('.num-linea').textContent = contadorLineas;
            });
        };

        // Motor Matemático (Dynamic Pricing & Totals)
        const formatMoney = (val) => '$' + val.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        const calcEngine = () => {
            let sumSubtotal = 0;
            let sumDescuento = 0;
            let sumImpuestos = 0;
            const formRows = Array.from(tbody.querySelectorAll('tr'));
            
            import('../../shared/formatters.js').then(fmt => {
                formRows.forEach(tr => {
                    const qty = parseFloat(tr.querySelector('.input-qty').value || 0);
                    const price = fmt.parseCurrencyValue(tr.querySelector('.input-price').value);
                    const discPct = parseFloat(tr.querySelector('.input-disc').value || 0);
                    const taxPct = parseFloat(tr.querySelector('.input-tax').value || 0);

                    const baseLine = qty * price;
                    const discAmount = baseLine * (discPct / 100);
                    const subLine = baseLine - discAmount;
                    const taxAmount = subLine * (taxPct / 100);

                    tr.querySelector('.calc-subtotal').textContent = formatMoney(subLine);

                    sumSubtotal += baseLine;
                    sumDescuento += discAmount;
                    sumImpuestos += taxAmount;
                });

                const totalFinal = sumSubtotal - sumDescuento + sumImpuestos;
                
                element.querySelector('#tot-subtotal').textContent = formatMoney(sumSubtotal);
                element.querySelector('#tot-descuento').textContent = formatMoney(sumDescuento);
                element.querySelector('#tot-impuestos').textContent = formatMoney(sumImpuestos);
                const totalLbl = element.querySelector('#tot-total');
                totalLbl.textContent = formatMoney(totalFinal);
                totalLbl.dataset.rawTotal = totalFinal.toString();
                
                factura.total = totalFinal; // Mantener en estado global para guardado rápido
            });
        };

        // Función Helper: Cálculo de Fecha de Vencimiento
        const calcularVencimiento = (cliente) => {
            const plazos = parseInt(cliente.plazosPago || 0);
            const inputVencimiento = element.querySelector('#input-vencimiento');
            if (plazos > 0) {
                const fechaCreacion = new Date(element.querySelector('#input-fecha').value);
                fechaCreacion.setDate(fechaCreacion.getDate() + plazos);
                if (inputVencimiento) inputVencimiento.value = getLocalDate(fechaCreacion);
            } else {
                if (inputVencimiento) inputVencimiento.value = '';
            }
        };

        // Inicialización de Combobox de Clientes y Cálculo de Vencimiento Automatizado
        if (!isViewOnly) {
            UI.createAsyncCombobox({
                inputEl: element.querySelector('#search-cliente'),
                hiddenIdEl: element.querySelector('#select-cliente'),
                fetchItems: async (query) => {
                    const { data } = await supabase.from('contactos')
                        .select('id, nombre, identificacion, plazos_pago, vendedor_id')
                        .eq('es_cliente', true)
                        .neq('estado', 'inactive')
                        .or(`nombre.ilike.%${query}%,identificacion.ilike.%${query}%`)
                        .limit(20);
                    return data ? data.map(d => ({ ...d, nit: d.identificacion, plazosPago: d.plazos_pago })) : [];
                },
                displayProp: 'nombre',
                allowCreate: true,
                onSelect: (selectedItem) => {
                    calcularVencimiento(selectedItem);
                    const selectVendedor = element.querySelector('#select-vendedor');
                    if (selectVendedor && selectedItem.vendedor_id) {
                        selectVendedor.value = selectedItem.vendedor_id;
                    }
                },
                onCreate: (query) => {
                    ContactosModule.renderQuickModal(query, (nuevoContacto) => {
                        // Al guardar exitosamente, lo autoseleccionamos
                        element.querySelector('#search-cliente').value = nuevoContacto.nombre;
                        const hiddenInput = element.querySelector('#select-cliente');
                        hiddenInput.value = nuevoContacto.id;
                        
                        // Calculamos vencimiento explícitamente para el nuevo contacto
                        calcularVencimiento(nuevoContacto);
                        
                        const selectVendedor = element.querySelector('#select-vendedor');
                        if (selectVendedor && nuevoContacto.vendedor_id) {
                            selectVendedor.value = nuevoContacto.vendedor_id;
                        }
                    });
                }
            });
        }

        // Configuración de Numeración (Engranaje)
        element.querySelector('#select-tipo-venta')?.addEventListener('change', (e) => {
            const containerCuenta = element.querySelector('#container-cuenta-venta');
            if (containerCuenta) {
                containerCuenta.style.display = e.target.value === 'contado' ? 'block' : 'none';
            }
        });

        // Configuración de Numeración (Engranaje)
        element.querySelector('#btn-config-num')?.addEventListener('click', () => {
            NumberingManager.openNumberingModal('factura', factura, (prefijo, numero) => {
                element.querySelector('#lbl-numero').innerHTML = `No. <strong style="color: var(--text-main);">${numero}</strong>`;
            });
        });

        // Evento Agregar Línea
        element.querySelector('#btn-agregar-linea')?.addEventListener('click', () => {
            addRow({ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 });
            calcEngine();
        });

        // Evento Cancelar
        element.querySelector('#btn-cancelar')?.addEventListener('click', () => {
            window.hayCambiosSinGuardar = false;
            window.location.hash = '#/ingresos/facturas';
        });

        // Evento Imprimir Global (Acción Superior)
        element.querySelector('.btn-imprimir')?.addEventListener('click', (e) => {
            if (!isViewOnly) {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
                CoreActions.showWarningModal("Primero debes guardar o finalizar la factura para poder generar su formato de impresión oficial.");
                if (window._ventasPrintBtnTimeout) clearTimeout(window._ventasPrintBtnTimeout);
                window._ventasPrintBtnTimeout = setTimeout(() => {
                    if (document.body.contains(e.currentTarget)) {
                        e.currentTarget.style.borderColor = '';
                        e.currentTarget.style.color = '';
                    }
                }, 3000);
                return;
            }
            PrintManager.printDocument(factura, 'Factura de venta', contactos, productosFactura);
        });

        // Evento Vista Previa Global (Acción Superior)
        element.querySelector('.btn-vista-previa')?.addEventListener('click', (e) => {
            if (!isViewOnly) {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
                CoreActions.showWarningModal("Primero debes guardar o finalizar la factura para poder generar su vista previa.");
                if (window._ventasPreviewBtnTimeout) clearTimeout(window._ventasPreviewBtnTimeout);
                window._ventasPreviewBtnTimeout = setTimeout(() => {
                    if (document.body.contains(e.currentTarget)) {
                        e.currentTarget.style.borderColor = '';
                        e.currentTarget.style.color = '';
                    }
                }, 3000);
                return;
            }
            PrintManager.printDocument(factura, 'Factura de venta', contactos, productosFactura, 'preview');
        });

        // Evento Registrar Pago (Acción Superior - Solo Vista)
        element.querySelector('.btn-abonar-detalle')?.addEventListener('click', (e) => {
            e.preventDefault();
            const facId = e.currentTarget.dataset.id;
            AbonoModal.show(facId, () => {
                this.renderForm(element, facId, true); // Recargar la vista de detalle para reflejar el pago
            });
        });

        // Evento Editar Global (Acción Superior)
        element.querySelector('.btn-editar')?.addEventListener('click', (e) => {
            const docId = e.currentTarget.dataset.id;
            window.location.hash = `#/ingresos/facturas/editar/${docId}`;
        });

        // Evento Guardar (Captura de Estado DOM a DB)
        element.querySelector('#btn-guardar')?.addEventListener('click', async (e) => {
            const btnGuardar = e.currentTarget;
            if (btnGuardar.disabled) return; // Salvaguarda estricta contra doble clic
            
            const originalText = btnGuardar.innerHTML;
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
            
            const btnCancelar = element.querySelector('#btn-cancelar');
            if (btnCancelar) btnCancelar.disabled = true;
            
            import('../../shared/formatters.js').then(async fmt => {
                const parseP = (v) => fmt.parseCurrencyValue(v);

                try {
                    const clienteId = element.querySelector('#select-cliente').value;
                    if (!clienteId) {
                        const searchInput = element.querySelector('#search-cliente');
                        searchInput.style.borderColor = '#ef4444'; // Resalta en rojo
                        CoreActions.showWarningModal("Debes seleccionar un cliente válido de la lista.");
                        if (window._ventasSearchClientTimeout) clearTimeout(window._ventasSearchClientTimeout);
                        window._ventasSearchClientTimeout = setTimeout(() => {
                            if (document.body.contains(searchInput)) {
                                searchInput.style.borderColor = '';
                            }
                        }, 3000);
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = originalText;
                        return;
                    }

                    const tipoVenta = element.querySelector('#select-tipo-venta').value;
                    const isNew = !id; // Si es nueva factura, descargamos inventario

                    // Recolectar detalles
                    const arrDetalles = Array.from(element.querySelectorAll('#tbody-detalles tr')).map(r => {
                        return {
                            id: r.dataset.uid,
                            productoId: parseInt(r.querySelector('.input-prod-id').value),
                            cantidad: parseFloat(r.querySelector('.input-qty').value) || 0,
                            precio: parseP(r.querySelector('.input-price').value),
                            descuento: parseFloat(r.querySelector('.input-disc').value) || 0,
                            impuesto: parseFloat(r.querySelector('.input-tax').value) || 0
                        };
                    });

                    if (arrDetalles.length === 0 || parseFloat(element.querySelector('#tot-total').dataset.rawTotal) <= 0) {
                        CoreActions.showWarningModal("Debe agregar al menos un producto válido y con cantidad mayor a cero.");
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = originalText;
                        return;
                    }

                    // Descargo FIFO de inventario si es nueva
                    let costoTotalVenta = 0;
                    let planInventario = null;
                    if (isNew) {
                        // Bloqueo de Reprocesamiento si viene de una cotización
                        if (factura.cotizacion_origen_id) {
                            const { data: existe } = await supabase
                                .from('facturas')
                                .select('id, numero')
                                .eq('cotizacion_origen_id', factura.cotizacion_origen_id);
                            
                            if (existe && existe.length > 0) {
                                CoreActions.showWarningModal(`La cotización origen ya fue convertida a la factura [No. ${existe[0].numero || existe[0].id}]. No se puede duplicar.`);
                                btnGuardar.disabled = false;
                                btnGuardar.innerHTML = originalText;
                                return;
                            }
                        }

                        planInventario = await InventarioUtils.calcularSalidaInventario(arrDetalles, null, null);
                        if (!planInventario.success) {
                            CoreActions.showWarningModal(planInventario.error);
                            btnGuardar.disabled = false;
                            btnGuardar.innerHTML = originalText;
                            return; // ABORTA LA VENTA
                        }
                        costoTotalVenta = planInventario.costoTotalVenta;
                        arrDetalles.length = 0;
                        arrDetalles.push(...planInventario.detallesActualizados);
                    } else {
                        costoTotalVenta = factura.total_costo || 0;
                    }

                    factura.total_costo = costoTotalVenta;
                    factura.clienteId = clienteId;
                    factura.tipoVenta = tipoVenta;
                    const vendedorSeleccionado = element.querySelector('#select-vendedor')?.value;
                    factura.vendedor_id = vendedorSeleccionado ? parseInt(vendedorSeleccionado, 10) : null;
                    if (tipoVenta === 'contado') {
                        factura.cuentaId = element.querySelector('#select-cuenta-venta').value;
                    }
                    factura.fecha = element.querySelector('#input-fecha').value;
                    factura.vencimiento = element.querySelector('#input-vencimiento').value || factura.fecha;
                    factura.notas = element.querySelector('#input-notas').value;
                    factura.terminosCondiciones = element.querySelector('#input-terminos').value;
                    factura.detalles = arrDetalles;
                    factura.tipo = 'venta'; // Ensure type is venta
                    
                    const rawTotal = parseFloat(element.querySelector('#tot-total').dataset.rawTotal);
                    factura.total = rawTotal;

                    let facturaGuardadaId = null;
                    
                    if (isNew) {
                        const { data: v_result, error } = await supabase.rpc('crear_venta_directa', {
                            p_factura_header: {
                                fecha: factura.fecha,
                                vencimiento: factura.vencimiento,
                                contacto_id: parseInt(clienteId, 10),
                                total: rawTotal,
                                total_costo: costoTotalVenta,
                                estado: tipoVenta === 'contado' ? 'pagada' : 'por_pagar',
                                observaciones: factura.notas,
                                vendedor_id: factura.vendedor_id
                            },
                            p_factura_detalles: arrDetalles.map(det => {
                                const base = det.cantidad * det.precio;
                                const sub = base - (base * (det.descuento / 100));
                                return {
                                    producto_id: parseInt(det.productoId, 10),
                                    cantidad: det.cantidad,
                                    precio_unitario: det.precio,
                                    descuento_porcentaje: det.descuento,
                                    subtotal: sub,
                                    descripcion_personalizada: ''
                                };
                            }),
                            p_operaciones_fifo: planInventario.operacionesDB.map(op => ({
                                action: op.action,
                                id: op.action === 'update' ? parseInt(op.data.id, 10) : null,
                                producto_id: parseInt(op.data.productoId, 10),
                                fecha_ingreso: op.data.fechaIngreso,
                                cantidad_actual: parseFloat(op.data.cantidadActual),
                                costo_unitario: parseFloat(op.data.costoUnitario)
                            })),
                            p_origen_documento: 'factura directa venta',
                            p_pago_contado: tipoVenta === 'contado' ? {
                                fecha: factura.fecha,
                                monto: rawTotal,
                                cuenta_id: parseInt(factura.cuentaId, 10)
                            } : null
                        });

                        if (error) throw new Error("Error al guardar la venta: " + error.message);
                        
                        facturaGuardadaId = v_result.id;
                        factura.id = facturaGuardadaId;
                        
                        if (DB.invalidateCache) {
                            DB.invalidateCache('facturas');
                            DB.invalidateCache('lotes_fifo');
                            if (tipoVenta === 'contado') {
                                DB.invalidateCache('transacciones');
                                DB.invalidateCache('pagos_ingresos');
                            }
                        }
                    } else {
                        await DB.save('facturas', factura);
                        facturaGuardadaId = factura.id;
                    }
                    
                    // Navegar a modo lectura para bloquear edición y habilitar impresión final
                    window.hayCambiosSinGuardar = false;
                    window.location.hash = `#/ingresos/facturas/ver/${factura.id}`;
                } catch (error) {
                    console.error("Fallo general de guardado:", error);
                    alert("Error en el sistema al guardar: " + error.message);
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = originalText;
                } finally {
                    if (btnCancelar) btnCancelar.disabled = false;
                }
            });
        });

        // Inicializar UI
        factura.detalles.forEach(det => addRow(det));
        calcEngine(); // Primer cálculo

        if (!isViewOnly) {
            window.hayCambiosSinGuardar = false;
            element.addEventListener('input', (e) => { 
                window.hayCambiosSinGuardar = true; 
            });
            element.addEventListener('change', (e) => { 
                window.hayCambiosSinGuardar = true; 
            });
        }
    }
};
