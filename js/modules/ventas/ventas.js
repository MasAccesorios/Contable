import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions, ItemEngine, NumberingManager, ExportManager, PrintManager } from '../../shared/crud.js';
import { TesoreriaModule } from '../bancos/bancos.js';
import { ContactosModule } from '../clientes/clientes.js';
import { UI } from '../../shared/combobox.js';
import { calcularEstadoFactura } from '../../shared/carteraUtils.js';
import { AbonoModal } from '../../shared/abonoModal.js';
import { InventarioUtils } from '../../shared/inventarioUtils.js';

export const FacturasModule = {
    cache: { contactos: null, productos: null },
    
    async init(element) {
        if (!element) return;

        // Cargar catálogos base una sola vez por renderizado del módulo
        this.cache.contactos = await DB.getAll('contactos');
        this.cache.productos = await DB.getAll('productos');

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
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; color: #2cbfb7;">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;
        
        let contactos = this.cache.contactos;
        
        const getClienteName = (id) => {
            const cliente = contactos.find(c => c.id == id);
            return cliente ? cliente.nombre : 'Sin Cliente';
        };

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

        const renderGrid = async () => {
            // Spinner while loading
            if (element.querySelector('tbody')) {
                element.querySelector('tbody').innerHTML = `<tr><td colspan="9" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>`;
            }

            try {
                const { data: pageData, error } = await supabase.rpc('get_facturas_con_saldos', {
                    p_page: currentPage,
                    p_limit: itemsPerPage,
                    p_sort_col: sortColumn,
                    p_sort_dir: sortDirection,
                    p_search: searchQuery,
                    p_filter_criteria: filterCriteria
                });
                
                if (error) throw error;
                
                totalItems = pageData && pageData.length > 0 ? pageData[0].total_count : 0;
                totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
                
                if (currentPage > totalPages && totalPages > 0) {
                    currentPage = totalPages;
                    return renderGrid();
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

            const tbodyHtml = currentItems.length > 0 ? currentItems.map(c => {
                const estado = c.estado || 'por_pagar';
                let textEstadoColor = '';
                let labelEstado = '';
                
                if (estado === 'anulada' || estado === 'voided' || estado === 'void') {
                    textEstadoColor = 'color: #ef4444;';
                    labelEstado = 'Anulada';
                } else if (c.saldoPendiente <= 0) {
                    textEstadoColor = 'color: #2cbfb7;';
                    labelEstado = 'Cobrada';
                } else {
                    textEstadoColor = 'color: #ef4444;';
                    labelEstado = 'Por cobrar';
                }

                const numDisplay = c.numero || parseInt(String(c.id).replace(/\D/g, ''), 10) || c.id;
                
                let vencimientoColor = 'var(--text-body)';
                if (c.vencimiento) {
                    const vDate = new Date(c.vencimiento);
                    const hoy = new Date();
                    hoy.setHours(0,0,0,0);
                    if (vDate < hoy && labelEstado === 'Por cobrar') {
                        vencimientoColor = '#ef4444';
                    }
                }
                
                return `
                    <tr style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);" onclick="if(!event.target.closest('button')) window.location.hash = '#/ingresos/facturas/ver/${c.id}'">
                        <td class="py-3">${numDisplay}</td>
                        <td class="py-3">${c.fecha || ''}</td>
                        <td class="py-3" style="color: ${vencimientoColor};">${c.vencimiento || ''}</td>
                        <td class="py-3" style="color: var(--text-main); font-weight: var(--weight-medium);">${getClienteName(c.clienteId || c.contacto_id || c.contactoId)}</td>
                        <td class="py-3 text-end">${formatMoney(c.total)}</td>
                        <td class="py-3 text-end">${formatMoney(c.totalPagado)}</td>
                        <td class="py-3 text-end">${formatMoney(c.saldoPendiente)}</td>
                        <td class="py-3 text-center" style="${textEstadoColor} font-weight: 500;">
                            ${labelEstado}
                        </td>
                        <td class="py-3 text-end" style="position: relative;">
                            <button class="btn btn-link text-muted p-0 me-2 btn-imprimir-row" data-id="${c.id}">
                                <i class="bi bi-printer"></i>
                            </button>
                            <button class="btn btn-link text-muted p-0 btn-menu-row" data-id="${c.id}">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('') : `<tr><td colspan="9" class="text-center py-5 text-muted">No se encontraron facturas</td></tr>`;

            const startIndex = (currentPage - 1) * itemsPerPage;

            element.innerHTML = `
                <div class="module-container p-4" style="max-width: 1200px; margin: 0 auto;">
                    <!-- TOP BAR -->
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Facturas de venta</h2>
                            <p class="text-muted mb-0" style="font-size: 14px;">
                                Gestiona las facturas generadas por ventas a tus clientes. 
                            </p>
                        </div>
                        <div class="d-flex gap-2">
                            <button id="btn-refresh-list" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: 14px; color: var(--text-body);">
                                <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
                            </button>
                            <button id="btn-export-list" class="btn btn-light bg-white border" style="font-weight: var(--weight-medium); font-size: 14px; color: var(--text-body);">
                                <i class="bi bi-download me-1"></i> Exportar
                            </button>
                            <div class="btn-group">
                                <button id="btn-nueva-factura" class="btn text-white" style="background-color: #2cbfb7; font-weight: var(--weight-medium); font-size: 14px;">
                                    <i class="bi bi-plus-lg me-1"></i> Nueva factura
                                </button>
                                <button class="btn text-white px-2 dropdown-toggle dropdown-toggle-split" style="background-color: #2cbfb7; border-left: 1px solid rgba(255,255,255,0.2);"></button>
                            </div>
                        </div>
                    </div>

                    <!-- DATA TABLE CARD -->
                    <div class="card border-0" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                        <!-- FILTERS -->
                        <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center" style="border-radius: 8px 8px 0 0;">
                            <div class="input-group input-group-sm" style="width: 250px;">
                                <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                                <input type="text" class="form-control border-start-0 ps-0 text-muted" id="search-input" placeholder="Buscar..." value="${searchQuery}" style="font-size: 13px; box-shadow: none;">
                            </div>
                            <div class="dropdown">
                                <button class="btn btn-link text-decoration-none text-muted p-0 dropdown-toggle" data-bs-toggle="dropdown" style="font-size: 14px;">
                                    <i class="bi bi-funnel me-1"></i> Filtrar <span id="lbl-filtro-actual" style="font-size: 12px; font-weight: 500; color: #2cbfb7;">${filterCriteria !== 'todos' ? '('+filterCriteria+')' : ''}</span>
                                </button>
                                <ul class="dropdown-menu shadow border-0" style="font-size: 13px;">
                                    <li><a class="dropdown-item filter-opt" href="#" data-criteria="todos">Todos los campos</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item filter-opt" href="#" data-criteria="numero">Por Número</a></li>
                                    <li><a class="dropdown-item filter-opt" href="#" data-criteria="cliente">Por Cliente</a></li>
                                    <li><a class="dropdown-item filter-opt" href="#" data-criteria="fecha">Por Fecha de creación</a></li>
                                    <li><a class="dropdown-item filter-opt" href="#" data-criteria="estado">Por Estado</a></li>
                                </ul>
                            </div>
                        </div>

                        <!-- GRID -->
                        <div class="table-responsive">
                            <table class="table table-borderless align-middle mb-0">
                                <thead style="border-bottom: 1px solid var(--border-color);">
                                    <tr style="color: var(--text-muted); font-size: 13px; font-weight: var(--weight-medium);">
                                        <th class="py-3 fw-normal sortable-header" data-column="numero" style="cursor: pointer; user-select: none;">
                                            Número ${sortColumn === 'numero' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                                        </th>
                                        <th class="py-3 fw-normal sortable-header" data-column="fecha" style="cursor: pointer; user-select: none;">
                                            Creación ${sortColumn === 'fecha' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                                        </th>
                                        <th class="py-3 fw-normal">Vencimiento</th>
                                        <th class="py-3 fw-normal sortable-header" data-column="cliente" style="cursor: pointer; user-select: none;">
                                            Cliente ${sortColumn === 'cliente' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                                        </th>
                                        <th class="py-3 fw-normal text-end">Total</th>
                                        <th class="py-3 fw-normal text-end">Cobrado</th>
                                        <th class="py-3 fw-normal text-end">Por cobrar</th>
                                        <th class="py-3 fw-normal text-center">Estado</th>
                                        <th class="py-3 fw-normal text-end" style="width: 80px;"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tbodyHtml}
                                </tbody>
                            </table>
                        </div>

                        <!-- PAGINATION FOOTER -->
                        <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center" style="border-radius: 0 0 8px 8px;">
                            <div class="d-flex align-items-center gap-3" style="font-size: 13px; color: var(--text-body);">
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

                            <div class="d-flex align-items-center gap-2" style="font-size: 13px; color: var(--text-body);">
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
            // Búsqueda en vivo (Debounced simple)
            const searchInput = element.querySelector('#search-input');
            if (searchInput) {
                searchInput.focus();
                // Cursor al final
                const val = searchInput.value;
                searchInput.value = '';
                searchInput.value = val;

                let debounceTimer;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        searchQuery = e.target.value.toLowerCase().trim();
                        currentPage = 1;
                        renderGrid();
                    }, 400);
                });
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
                btn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`;
                
                try {
                    const { data: allFiltered, error } = await supabase.rpc('get_facturas_con_saldos', {
                        p_page: 1,
                        p_limit: 10000,
                        p_sort_col: sortColumn,
                        p_sort_dir: sortDirection,
                        p_search: searchQuery,
                        p_filter_criteria: filterCriteria
                    });
                    if (error) throw error;
                    
                    const allDecorated = allFiltered.map(f => {
                        return { ...f, estado: f.estado_dinamico, saldoPendiente: f.saldo_pendiente, totalPagado: f.total_pagado };
                    });
                    ExportManager.exportDataToExcel(allDecorated, 'Facturas', getClienteName, btn);
                } catch(err) { console.error(err); }
                
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            });

            // Actualizar Caché
            element.querySelector('#btn-refresh-list')?.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const originalHtml = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`;
                
                await DB.refreshCache('facturas');
                transacciones = (await DB.getAll('transacciones').catch(() => [])) || [];
                contactos = await DB.refreshCache('contactos');
                
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
                    const canAbonar = factData && factData.estado !== 'pagada' && factData.estado !== 'anulada';
                    
                    const menuHtml = `
                        <div class="row-action-menu position-absolute bg-white shadow rounded border py-2" 
                             style="z-index: 1060; width: 150px; top: ${rect.bottom + window.scrollY}px; left: ${rect.left - 100}px;">
                            ${canAbonar ? `
                            <a href="#" class="d-block px-3 py-1 text-decoration-none btn-abonar-factura" data-id="${id}" data-saldo="${factData.saldoPendiente}" style="color: #10b981; font-size: 13px;">
                                <i class="bi bi-wallet2 me-2"></i> Registrar Pago
                            </a>
                            <hr class="dropdown-divider my-1">` : ''}
                            <a href="#/ingresos/facturas/editar/${id}" class="d-block px-3 py-1 text-decoration-none" style="color: var(--text-body); font-size: 13px;">
                                <i class="bi bi-pencil me-2"></i> Editar
                            </a>
                            <a href="#" class="d-block px-3 py-1 text-decoration-none mt-1 btn-delete-row" data-id="${id}" style="color: #ef4444; font-size: 13px;">
                                <i class="bi bi-trash me-2"></i> Eliminar
                            </a>
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

                    menu.querySelector('.btn-delete-row').addEventListener('click', async (ev) => {
                        ev.preventDefault();
                        if (confirm('¿Estás seguro de eliminar esta factura de forma permanente?')) {
                            await DB.delete('facturas', id);
                            menu.remove();
                            await renderGrid();
                        }
                    });
                });
            });

            // Imprimir rápido
            element.querySelectorAll('.btn-imprimir-row').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = e.currentTarget.dataset.id;
                    const doc = currentItems.find(c => c.id == id);
                    if (doc) {
                        PrintManager.printDocument(doc, 'Factura de venta', contactos, this.cache.productos);
                    }
                });
            });
        };

        await renderGrid();
    },

    async renderForm(element, id = null, isViewOnly = false) {
        // Carga de DB
        const contactos = this.cache.contactos;
        const productos = this.cache.productos;

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

        // Datos de Clientes para el Combobox
        const clientes = contactos.filter(c => c.tipo === 'cliente');
        const clienteActual = clientes.find(c => c.id === factura.clienteId);
        const clienteNombreActual = clienteActual ? clienteActual.nombre : '';

        const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
        const cuentasActivas = dbCuentas.filter(c => c.estado === 'activo');

        element.innerHTML = `
            <div class="module-container p-4" style="max-width: 1100px; margin: 0 auto;">
                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        ${headerHtml}
                        <h2 class="h3 fw-bold mb-0" style="color: var(--text-main);">${id ? 'Factura No. ' + factura.numero : 'Nueva factura'}</h2>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        ${isViewOnly && id && factura.estado !== 'pagada' && factura.estado !== 'anulada' ? 
                            `<button class="btn btn-primary fw-medium px-4 btn-abonar-detalle" data-id="${factura.id}" data-saldo="${factura.saldoPendiente}" style="background-color: #2cbfb7; border: none; border-radius: 8px;"><i class="bi bi-wallet2 me-2"></i>Registrar Pago</button>` 
                            : ''}
                        ${actionsHtml}
                    </div>
                </div>

                <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                    <div class="card-body p-3 p-md-5">
                        <!-- HEADER DOCUMENTO -->
                        <div class="row mb-5 align-items-center">
                            <div class="col-md-4">
                                <img src="LogoMas.png" alt="Logo" style="max-height: 80px;">
                            </div>
                            <div class="col-md-4 text-center">
                                <h5 class="fw-bold" style="color: var(--text-main);">Accesorios .</h5>
                            </div>
                            <div class="col-md-4">
                                <select class="form-select mb-2 bg-light border-0">
                                    <option>Factura de venta</option>
                                </select>
                                <div class="d-flex justify-content-between align-items-center text-muted" style="font-size: 14px;">
                                    <span id="lbl-numero">No. <strong style="color: var(--text-main);">${factura.numero || '[Autogenerado al guardar]'}</strong></span>
                                    ${!isViewOnly ? `<i class="bi bi-gear" id="btn-config-num" style="cursor: pointer;"></i>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- INFO FACTURA -->
                        <h6 class="fw-bold mb-3" style="color: var(--text-main);">Información de la factura</h6>
                        <div class="row mb-5 g-3">
                            <div class="col-md-3">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Cliente <span class="text-danger">*</span></label>
                                <input type="text" id="search-cliente" class="form-control form-control-sm text-muted" placeholder="Buscar cliente..." value="${clienteNombreActual}" autocomplete="off" ${isViewOnly ? 'disabled' : ''}>
                                <input type="hidden" id="select-cliente" value="${factura.clienteId || ''}">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Tipo de Venta</label>
                                <select id="select-tipo-venta" class="form-select form-select-sm text-muted" ${isViewOnly ? 'disabled' : ''}>
                                    <option value="credito" ${factura.tipoVenta === 'credito' || !factura.tipoVenta ? 'selected' : ''}>A Crédito (Cartera)</option>
                                    <option value="contado" ${factura.tipoVenta === 'contado' ? 'selected' : ''}>De Contado (Caja)</option>
                                </select>
                            </div>
                            <div class="col-md-3" id="container-cuenta-venta" style="display: ${factura.tipoVenta === 'contado' ? 'block' : 'none'};">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Cuenta (Contado)</label>
                                <select id="select-cuenta-venta" class="form-select form-select-sm text-muted" ${isViewOnly ? 'disabled' : ''}>
                                    ${cuentasActivas.map(c => `<option value="${c.nombre}" ${factura.cuentaId === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Fecha de creación</label>
                                <input type="date" id="input-fecha" class="form-control form-control-sm text-muted" value="${factura.fecha}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Fecha de vencimiento</label>
                                <input type="date" id="input-vencimiento" class="form-control form-control-sm text-muted" value="${factura.vencimiento}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                        </div>

                        <hr class="mb-5" style="border-color: var(--border-color); opacity: 1;">

                        <!-- PRODUCTOS -->
                        <h6 class="fw-bold mb-3" style="color: var(--text-main);">Productos y servicios</h6>
                        <div class="table-responsive mb-3" style="overflow: visible;">
                            <table class="table table-borderless align-middle mb-0" id="tabla-detalles" style="font-size: 13px;">
                                <thead style="border-bottom: 1px solid var(--border-color);">
                                    <tr style="color: var(--text-muted); font-weight: var(--weight-regular);">
                                        <th style="width: 40px;"><input type="checkbox" class="form-check-input" disabled></th>
                                        <th>Producto o servicios</th>
                                        <th style="width: 100px;">Cantidad</th>
                                        <th style="width: 150px;">Precio</th>
                                        <th style="width: 120px;">Descuento %</th>
                                        <th style="width: 150px;">Impuesto %</th>
                                        <th class="text-end" style="width: 120px;">Subtotal</th>
                                        <th style="width: 40px;"></th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-detalles">
                                    <!-- Líneas dinámicas renderizadas por JS -->
                                </tbody>
                            </table>
                        </div>
                        
                        ${!isViewOnly ? `
                        <button id="btn-agregar-linea" class="btn btn-link text-decoration-none p-0 mb-5" style="font-size: 14px; font-weight: var(--weight-medium); color: var(--primary);">
                            <i class="bi bi-plus-lg me-1"></i>Agregar línea
                        </button>
                        ` : ''}

                        <!-- TOTALES -->
                        <div class="row justify-content-end mb-5">
                            <div class="col-md-4">
                                <div class="d-flex justify-content-between mb-2" style="font-size: 14px; color: var(--text-body);">
                                    <span>Subtotal</span><span id="tot-subtotal">$0,00</span>
                                </div>
                                <div class="d-flex justify-content-between mb-2" style="font-size: 14px; color: var(--text-body);">
                                    <span>Descuento</span><span id="tot-descuento">$0,00</span>
                                </div>
                                <div class="d-flex justify-content-between mb-3" style="font-size: 14px; color: var(--text-body);">
                                    <span>Impuestos</span><span id="tot-impuestos">$0,00</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="fw-bold" style="font-size: 16px; color: var(--text-main);">Total</span>
                                    <span class="fw-bold" id="tot-total" style="font-size: 20px; color: var(--text-main);" data-raw-total="0">$0,00</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- DOCUMENTOS RELACIONADOS (Solo Vista) -->
                ${isViewOnly ? `
                <div class="mt-5">
                    <h6 class="fw-bold mb-3" style="color: var(--text-main);">Documentos relacionados</h6>
                    <ul class="nav nav-tabs mb-3" role="tablist" style="border-bottom: 2px solid var(--border-color);">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-pagos" type="button" role="tab" style="font-size: 13px; font-weight: var(--weight-medium); color: var(--text-main); border-bottom-color: transparent;">Pagos recibidos</button>
                        </li>
                        ${factura.cotizacion_origen_id ? `
                        <li class="nav-item" role="presentation">
                            <button class="nav-link text-muted" data-bs-toggle="tab" data-bs-target="#tab-cotizacion" type="button" role="tab" style="font-size: 13px; font-weight: var(--weight-medium); border-bottom-color: transparent;">Cotización origen</button>
                        </li>` : ''}
                    </ul>
                    
                    <div class="tab-content border-0 p-0">
                        <div class="tab-pane fade show active" id="tab-pagos" role="tabpanel">
                            <div class="table-responsive">
                                <table class="table table-sm align-middle mb-0" style="font-size: 13px;">
                                    <thead>
                                        <tr class="text-muted" style="border-bottom: 1px solid var(--border-color);">
                                            <th class="fw-medium pb-2">Fecha</th>
                                            <th class="fw-medium pb-2">Cuenta</th>
                                            <th class="fw-medium pb-2">Método</th>
                                            <th class="fw-medium pb-2 text-end">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(transacciones && transacciones.length > 0) ? transacciones.map(p => `
                                        <tr style="border-bottom: 1px solid #f0f0f0;">
                                            <td class="py-2 text-muted">${p.fecha || p.created_at?.split('T')[0] || ''}</td>
                                            <td class="py-2">${p.cuentaId || p.cuenta_id || '-'}</td>
                                            <td class="py-2">${p.metodo_pago || p.metodoPago || '-'}</td>
                                            <td class="py-2 text-end fw-medium">$${Number(p.monto || p.valor || 0).toLocaleString()}</td>
                                        </tr>`).join('') : `
                                        <tr><td colspan="4" class="text-muted text-center py-4">No hay pagos registrados para esta factura</td></tr>
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
                                        <small class="text-muted d-block" style="font-size:11px;">Ver documento origen</small>
                                        <span class="fw-medium text-dark" style="font-size:14px; color: var(--primary) !important;">Cotización</span>
                                    </div>
                                    <i class="bi bi-box-arrow-up-right text-muted" style="font-size: 12px;"></i>
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
                    ${ItemEngine.renderProductSearchBox(detalle, productos, isViewOnly)}
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
                    <a href="#" class="toggle-desc-tax d-md-none text-decoration-none mt-2 d-inline-block" style="font-size: 11px; color: var(--primary);">+ Editar descuento/impuesto</a>
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
            ItemEngine.bindLineEvents(tr, () => calcEngine(), productos);

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
                const prod = productos.find(p => p.id === detalle.productoId);
                if (prod) {
                    if (metaProd) metaProd.innerHTML = `<span style="color: var(--text-muted); font-size: 11px;">${prod.sku || 'S/N'}</span>`;
                    if (metaQty) metaQty.innerHTML = `<span style="color: var(--text-muted); font-size: 11px;">Disp: ${prod.stockActual || prod.cantidad || 0}</span>`;
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
            UI.createCombobox({
                inputEl: element.querySelector('#search-cliente'),
                hiddenIdEl: element.querySelector('#select-cliente'),
                items: clientes,
                displayProp: 'nombre',
                searchProps: ['nit', 'email'],
                allowCreate: true,
                onSelect: (selectedItem) => {
                    calcularVencimiento(selectedItem);
                },
                onCreate: (query) => {
                    ContactosModule.renderQuickModal(query, (nuevoContacto) => {
                        // Al guardar exitosamente, lo autoseleccionamos
                        element.querySelector('#search-cliente').value = nuevoContacto.nombre;
                        const hiddenInput = element.querySelector('#select-cliente');
                        hiddenInput.value = nuevoContacto.id;
                        
                        // Calculamos vencimiento explícitamente para el nuevo contacto
                        calcularVencimiento(nuevoContacto);
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
            PrintManager.printDocument(factura, 'Factura de venta', contactos, productos);
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
            PrintManager.printDocument(factura, 'Factura de venta', contactos, productos, 'preview');
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
                    if (isNew) {
                        const invResult = await InventarioUtils.procesarSalidaInventario(arrDetalles, null, productos);
                        if (!invResult.success) {
                            CoreActions.showWarningModal(invResult.error);
                            btnGuardar.disabled = false;
                            btnGuardar.innerHTML = originalText;
                            return; // ABORTA LA VENTA
                        }
                        costoTotalVenta = invResult.costoTotalVenta;
                        arrDetalles.length = 0;
                        arrDetalles.push(...invResult.detallesActualizados);
                    } else {
                        costoTotalVenta = factura.total_costo || 0;
                    }

                    factura.clienteId = clienteId;
                    factura.tipoVenta = tipoVenta;
                    if (tipoVenta === 'contado') {
                        factura.cuentaId = element.querySelector('#select-cuenta-venta').value;
                    }
                    factura.fecha = element.querySelector('#input-fecha').value;
                    factura.vencimiento = element.querySelector('#input-vencimiento').value;
                    factura.detalles = arrDetalles;
                    factura.tipo = 'venta'; // Ensure type is venta
                    
                    const rawTotal = parseFloat(element.querySelector('#tot-total').dataset.rawTotal);
                    factura.total = rawTotal;

                    if (!factura.numero) {
                        factura = await DB.saveWithNextNumero('facturas', factura);
                    } else {
                        await DB.save('facturas', factura);
                    }

                    // Condicional Contado vs Crédito
                    if (tipoVenta === 'contado') {
                        if (isNew) {
                            const transaccion = {
                                id: 'trx_' + Date.now(),
                                facturaId: factura.id,
                                referenciaId: factura.id,
                                tipo: 'ingreso',
                                monto: rawTotal,
                                fecha: factura.fecha,
                                referencia: `Venta al contado Fac. ${factura.numero}`,
                                detalle: `Venta al contado Fac. ${factura.numero}`,
                                cuenta: factura.cuentaId,
                                cuentaId: factura.cuentaId
                            };
                            await DB.save('transacciones', transaccion);
                        }
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
