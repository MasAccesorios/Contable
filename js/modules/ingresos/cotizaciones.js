import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions, ItemEngine, ExportManager, PrintManager } from '../../shared/crud.js';
import { NumberingManager } from '../../shared/numberingManager.js';
import { ContactosModule } from '../clientes/clientes.js';
import { UI } from '../../shared/combobox.js';

export const CotizacionesModule = {
    async init(element) {
        if (!element) return;

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
        // Estado de Paginación, Ordenamiento y Filtro
        let sortColumn = 'numero';
        let sortDirection = 'desc';
        let currentPage = 1;
        let itemsPerPage = 10;
        let searchQuery = '';
        let filterCriteria = 'todos'; // todos, numero, cliente, fecha, estado
        let filteredData = []; // Mantenido para exportación rápida de la página actual
        let kpiDataCotizaciones = null;

        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        // 1. INYECTAR HTML ESTÁTICO (Top Bar, KPIs vacíos, Filtros, Thead)
        element.innerHTML = `
            <div class="dash-layout p-4" style="max-width: 1100px; margin: 0 auto;">
                
                <!-- TOP BAR -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Cotizaciones</h2>
                        <p class="text-muted mb-0" style="font-size: var(--fs-md);">
                            Crea y gestiona cotizaciones personalizadas para tus clientes potenciales. 
                            <a href="#" style="color: var(--primary); text-decoration: none;">Saber más</a>
                        </p>
                    </div>
                    <div class="d-flex gap-2">
                        <button id="btn-refresh-list" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body);">
                            <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
                        </button>
                        <button id="btn-export-list" class="btn btn-light bg-white border" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body);">
                            <i class="bi bi-download me-1"></i> Exportar
                        </button>
                        <a href="#/ingresos/cotizaciones/nueva" class="btn btn-primary-action">
                            <i class="bi bi-plus-lg me-1"></i> Nueva cotización
                        </a>
                    </div>
                </div>

                <!-- KPI CARDS COTIZACIONES -->
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Total Cotizado</span>
                            <div class="ds-kpi-value" id="kpi-cotizado">...</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Cotizaciones Facturadas</span>
                            <div class="ds-kpi-value" id="kpi-aprobado">...</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Cotizaciones Sin Facturar</span>
                            <div class="ds-kpi-value" id="kpi-pendiente">...</div>
                        </div>
                    </div>
                </div>

                <!-- DATA TABLE CARD -->
                <div class="ds-table-container mb-4">
                    
                    <!-- FILTERS -->
                    <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center">
                        <div class="ds-search-container" style="width: 250px;">
                            <i class="bi bi-search ds-search-icon"></i>
                            <input type="text" class="ds-search-input" id="searchCotizaciones" autocomplete="off" placeholder="Buscar..." value="">
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-link text-decoration-none text-muted p-0 dropdown-toggle" data-bs-toggle="dropdown" style="font-size: var(--fs-md);">
                                <i class="bi bi-funnel me-1"></i> Filtrar <span id="lbl-filtro-actual" style="font-size: var(--fs-sm); font-weight: 500; color: var(--primary);"></span>
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
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0">
                            <thead style="border-bottom: 1px solid var(--border-color);" id="grid-thead">
                                <!-- Llenado dinámicamente -->
                            </thead>
                            <tbody id="grid-tbody">
                                <!-- Llenado dinámicamente -->
                            </tbody>
                        </table>
                    </div>

                    <!-- PAGINATION FOOTER -->
                    <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center" style="border-radius: 0 0 var(--border-radius-sm) var(--border-radius-sm);" id="grid-pagination">
                        <!-- Llenado dinámicamente -->
                    </div>
                </div>
            </div>
        `;

        const renderGrid = async () => {
            const tbodyEl = element.querySelector('#grid-tbody');
            if (tbodyEl) {
                tbodyEl.innerHTML = `<tr><td colspan="6" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>`;
            }

            // KPIs vía RPC (Cacheado)
            if (!kpiDataCotizaciones) {
                const { data: kpis, error: errKpi } = await supabase.rpc('get_cotizaciones_kpis');
                if (!errKpi && kpis) {
                    kpiDataCotizaciones = {
                        totalCotizado: parseFloat(kpis.totalCotizado) || 0,
                        totalAprobado: parseFloat(kpis.totalAprobado) || 0,
                        totalPendiente: parseFloat(kpis.totalPendiente) || 0
                    };
                } else {
                    kpiDataCotizaciones = { totalCotizado: 0, totalAprobado: 0, totalPendiente: 0 };
                }
            }

            // Paginación Real vía RPC
            const { data: response, error } = await supabase.rpc('get_cotizaciones_page', {
                p_page: currentPage,
                p_limit: itemsPerPage,
                p_sort_column: sortColumn,
                p_sort_direction: sortDirection,
                p_search_query: searchQuery,
                p_filter_criteria: filterCriteria
            });

            if (error) {
                console.error("Error cargando cotizaciones:", error);
                if (tbodyEl) tbodyEl.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-danger">Error al cargar cotizaciones: ${error.message}</td></tr>`;
                return;
            }

            const currentItems = response?.[0]?.data || [];
            const totalItems = parseInt(response?.[0]?.total_count || 0, 10);
            filteredData = currentItems; // Para exportar solo la página

            const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
            if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;
            const startIndex = (currentPage - 1) * itemsPerPage;

            // Actualizar KPIs Visuales
            if (kpiDataCotizaciones) {
                const kpiCot = element.querySelector('#kpi-cotizado');
                if(kpiCot) kpiCot.innerHTML = '$ ' + formatMoney(kpiDataCotizaciones.totalCotizado).replace('$ ', '');
                
                const kpiApr = element.querySelector('#kpi-aprobado');
                if(kpiApr) kpiApr.innerHTML = '$ ' + formatMoney(kpiDataCotizaciones.totalAprobado).replace('$ ', '');
                
                const kpiPen = element.querySelector('#kpi-pendiente');
                if(kpiPen) kpiPen.innerHTML = '$ ' + formatMoney(kpiDataCotizaciones.totalPendiente).replace('$ ', '');
            }

            // Generar Thead (Para flechas de ordenamiento)
            const theadHtml = `
                <tr class="ds-table-header">
                    <th class="py-2 fw-normal sortable-header" data-column="numero" style="cursor: pointer; user-select: none; white-space: nowrap; width: 80px;">
                        Número ${sortColumn === 'numero' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th class="py-2 fw-normal sortable-header" data-column="cliente" style="cursor: pointer; user-select: none; min-width: 150px;">
                        Cliente ${sortColumn === 'cliente' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th class="py-2 fw-normal sortable-header" data-column="fecha" style="cursor: pointer; user-select: none; white-space: nowrap;">
                        Creación ${sortColumn === 'fecha' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th class="py-2 fw-normal text-end" style="white-space: nowrap; min-width: 120px;">Total</th>
                    <th class="py-2 fw-normal text-center" style="white-space: nowrap; width: 100px;">Estado</th>
                    <th class="py-2 fw-normal text-end" style="width: 80px; white-space: nowrap;"></th>
                </tr>
            `;

            // Generar Tbody
            const tbodyHtml = currentItems.length > 0 ? currentItems.map(c => {
                const isFacturada = c.convertido_a_factura;
                const badgeClass = isFacturada ? 'bg-success text-success bg-opacity-10 border border-success-subtle' : 'bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle';
                const labelEstado = isFacturada ? 'Facturada' : 'Sin facturar';
                const numDisplay = (c.numero || c.id);
                const clientNameDisplay = c.cliente_nombre || 'Sin Cliente';
                
                return `
                    <tr style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: var(--fs-base); color: var(--text-body);" onclick="if(!event.target.closest('button')) window.location.hash = '#/ingresos/cotizaciones/ver/${c.id}'">
                        <td class="py-2" style="white-space: nowrap;">${numDisplay}</td>
                        <td class="py-2" style="color: var(--text-main); font-weight: var(--weight-medium); max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${clientNameDisplay}</td>
                        <td class="py-2" style="white-space: nowrap;">${c.fecha}</td>
                        <td class="py-2 text-end" style="white-space: nowrap;">${formatMoney(c.total)}</td>
                        <td class="py-2 text-center" style="white-space: nowrap;">
                            <span class="badge ${badgeClass} rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">${labelEstado}</span>
                        </td>
                        <td class="py-2 text-end" style="position: relative; white-space: nowrap;">
                            <button class="btn btn-link text-muted p-0 me-2 btn-imprimir-row" data-id="${c.id}">
                                <i class="bi bi-printer"></i>
                            </button>
                            <button class="btn btn-link text-muted p-0 btn-menu-row" data-id="${c.id}">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('') : `<tr><td colspan="6" class="text-center py-5 text-muted">No se encontraron cotizaciones</td></tr>`;

            // Generar Paginador
            const paginationHtml = `
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
            `;

            // Inyectar HTML Dinámico
            if (element.querySelector('#grid-thead')) element.querySelector('#grid-thead').innerHTML = theadHtml;
            if (element.querySelector('#grid-tbody')) element.querySelector('#grid-tbody').innerHTML = tbodyHtml;
            if (element.querySelector('#grid-pagination')) element.querySelector('#grid-pagination').innerHTML = paginationHtml;

            bindDynamicEvents();
        };

        const bindStaticEvents = () => {
            // Búsqueda en vivo (Debounced) - El input ya no se destruye
            const searchInput = element.querySelector('#searchCotizaciones');
            const clearSearchBtn = element.querySelector('#clearSearchBtnCotizaciones');

            if (searchInput) {
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

            // Cambiar Criterio de Filtro
            element.querySelectorAll('.filter-opt').forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.preventDefault();
                    filterCriteria = e.target.dataset.criteria;
                    const lbl = element.querySelector('#lbl-filtro-actual');
                    if (lbl) lbl.textContent = filterCriteria !== 'todos' ? `(${e.target.textContent})` : '';
                    currentPage = 1;
                    renderGrid();
                });
            });

            // Exportar Lista a CSV
            element.querySelector('#btn-export-list')?.addEventListener('click', (e) => {
                ExportManager.exportDataToExcel(filteredData, 'Cotizaciones', (id, c) => c ? c.cliente_nombre : 'Sin Cliente', e.currentTarget);
            });

            // Actualizar Caché
            element.querySelector('#btn-refresh-list')?.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const originalHtml = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`;
                
                // Forzamos actualización de KPIs también
                kpiDataCotizaciones = null;
                await renderGrid();
                
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            });
        };

        const bindDynamicEvents = () => {
            // Ordenamiento por Columnas (Thead es dinámico)
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

            // Paginación (Footer es dinámico)
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
                currentPage++; renderGrid();
            });

            // Row Menu Actions (Popovers Flotantes)
            element.querySelectorAll('.btn-menu-row').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const existing = document.querySelector('.row-action-menu');
                    if (existing) existing.remove();

                    const id = e.currentTarget.dataset.id;
                    const rect = e.currentTarget.getBoundingClientRect();

                    const menuHtml = `
                        <div class="row-action-menu position-absolute bg-white shadow rounded border py-2" 
                             style="z-index: 1060; width: 140px; top: ${rect.bottom + window.scrollY}px; left: ${rect.left - 100}px;">
                            <a href="#/ingresos/cotizaciones/editar/${id}" class="d-block px-3 py-1 text-decoration-none" style="color: var(--text-body); font-size: var(--fs-base);">
                                <i class="bi bi-pencil me-2"></i> Editar
                            </a>
                            <a href="#" class="d-block px-3 py-1 text-decoration-none mt-1 btn-delete-row" data-id="${id}" style="color: var(--danger); font-size: var(--fs-base);">
                                <i class="bi bi-trash me-2"></i> Eliminar
                            </a>
                        </div>
                    `;
                    document.body.insertAdjacentHTML('beforeend', menuHtml);

                    const menu = document.querySelector('.row-action-menu');
                    menu.querySelector('.btn-delete-row').addEventListener('click', async (ev) => {
                        ev.preventDefault();
                        if (confirm('¿Estás seguro de eliminar esta cotización de forma permanente?')) {
                            await DB.delete('cotizaciones', id);
                            menu.remove();
                            renderGrid();
                        }
                    });
                });
            });

            // Imprimir rápido
            element.querySelectorAll('.btn-imprimir-row').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = e.currentTarget.dataset.id;
                    const doc = await DB.get('cotizaciones', id);
                    if (doc) {
                        const contactos = await DB.getAll('contactos');
                        const productos = await DB.getAll('productos');
                        PrintManager.printDocument(doc, 'Cotización', contactos, productos);
                    }
                });
            });
        };

        // Flujo inicial de montaje
        bindStaticEvents();
        renderGrid();
    },
    async renderForm(element, id = null, isViewOnly = false) {
        // Carga de DB
        // Forzar refresh de contactos en modo edición para incluir contactos recién creados
        const contactos = (!id || !isViewOnly)
            ? await DB.refreshCache('contactos')
            : await DB.getAll('contactos');
        const productos = await DB.getAll('productos');
        
        // Estado por defecto
        let cotizacion = {
            id: 'cot_' + Date.now(),
            numero: undefined,
            fecha: getLocalDate(),
            vencimiento: '',
            clienteId: '',
            detalles: [{ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 }],
            notas: '',
            terminosCondiciones: 'Los valores descritos en esta cotización tienen una validez de 15 días.',
            convertidoAFactura: false,
            total: 0
        };

        if (id) {
            const dbData = await DB.get('cotizaciones', id);
            if (dbData) cotizacion = dbData;
            if (!cotizacion.detalles || cotizacion.detalles.length === 0) {
                cotizacion.detalles = [{ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 }];
            }
            
            // Buscar si esta cotización ya fue convertida a factura dinámicamente
            try {
                const idNum = parseInt(id, 10);
                if (!isNaN(idNum)) {
                    const { data: facturasAsociadas, error: facErr } = await supabase
                        .from('facturas')
                        .select('id, numero, cotizacion_origen_id')
                        .eq('cotizacion_origen_id', idNum)
                        .limit(1);
                        
                    if (facturasAsociadas && facturasAsociadas.length > 0) {
                        cotizacion.convertidoAFactura = true;
                        cotizacion.facturaDestinoId = facturasAsociadas[0].id;
                        cotizacion.facturaDestinoNumero = facturasAsociadas[0].numero;
                    }
                }
            } catch (e) {
                console.error("Error al buscar factura asociada:", e);
            }
        }

        const headerHtml = CoreActions.renderDocumentHeader('ingresos/cotizaciones', 'Volver a Cotizaciones');
        const actionsHtml = CoreActions.renderActionButtons(cotizacion, 'cotizacion', isViewOnly, !id);

        // Add legacy fallback for contacts not yet synced to IndexedDB
        const clientes = contactos.filter(c => 
            (c.es_cliente !== undefined ? c.es_cliente : c.tipo !== 'proveedor') 
            && c.estado !== 'inactive'
        );
        const clienteActual = clientes.find(c => c.id === cotizacion.clienteId);
        const clienteNombreActual = clienteActual ? clienteActual.nombre : '';

        element.innerHTML = `
            <div class=\"dash-layout p-4\" style=\"max-width: 1100px; margin: 0 auto;\">
                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        ${headerHtml}
                        <h2 class="h3 fw-bold mb-0" style="color: var(--text-main);">${id ? 'Cotización No. ' + cotizacion.numero : 'Nueva cotización'}</h2>
                    </div>
                    ${actionsHtml}
                </div>

                <div class="dash-table-container mb-4" style="overflow: visible;">
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
                                    <option>Cotización</option>
                                </select>
                                <div class="d-flex justify-content-between align-items-center text-muted" style="font-size: var(--fs-md);">
                                    <span id="lbl-numero">No. <strong style="color: var(--text-main);">${cotizacion.numero || '[Autogenerado al guardar]'}</strong></span>
                                    ${!isViewOnly ? `<i class="bi bi-gear" id="btn-config-num" style="cursor: pointer;"></i>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- INFO COTIZACION -->
                        <h6 class="fw-bold mb-3" style="color: var(--text-main);">Información de la cotización</h6>
                        <div class="row mb-5 g-4">
                            <div class="col-md-4">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Cliente <span class="text-danger">*</span></label>
                                ${isViewOnly ? `
                                <a href="#/contactos/ver/${cotizacion.clienteId}" class="form-control form-control-sm text-decoration-none d-flex align-items-center justify-content-between" style="cursor:pointer; color: var(--text-body); background-color: #e9ecef; border-color: #ced4da;">
                                    ${clienteNombreActual}
                                    <i class="bi bi-box-arrow-up-right text-muted" style="font-size: 0.75rem;"></i>
                                </a>
                                <input type="hidden" id="select-cliente" value="${cotizacion.clienteId || ''}">
                                ` : `
                                <input type="text" id="search-cliente" class="form-control form-control-sm text-muted" placeholder="Buscar cliente..." value="${clienteNombreActual}" autocomplete="off">
                                <input type="hidden" id="select-cliente" value="${cotizacion.clienteId || ''}">
                                `}
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Fecha de creación</label>
                                <input type="date" id="input-fecha" class="form-control form-control-sm text-muted" value="${cotizacion.fecha}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" style="font-size: var(--fs-sm); font-weight: var(--weight-medium); color: var(--text-body);">Fecha de vencimiento</label>
                                <input type="date" id="input-vencimiento" class="form-control form-control-sm text-muted" value="${cotizacion.vencimiento}" ${isViewOnly ? 'disabled' : ''}>
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
                    <textarea id="input-notas" class="form-control text-muted" rows="2" style="font-size: var(--fs-base); border-color: var(--border-color); resize: none;" placeholder="Agrega comentarios para aclarar datos de la cotización, serán visibles para tus clientes" ${isViewOnly ? 'disabled' : ''}>${cotizacion.notas}</textarea>
                </div>
                <div>
                    <h6 class="fw-bold mb-1" style="font-size: var(--fs-md); color: var(--text-main);">Términos y condiciones</h6>
                    <textarea id="input-terminos" class="form-control text-muted" rows="2" style="font-size: var(--fs-base); border-color: var(--border-color); resize: none;" placeholder="Define los términos y condiciones, y/o las posibles cláusulas en caso de reclamos" ${isViewOnly ? 'disabled' : ''}>${cotizacion.terminosCondiciones}</textarea>
                </div>

                <!-- DOCUMENTOS RELACIONADOS (Solo Vista) -->
                ${isViewOnly && cotizacion.convertidoAFactura && cotizacion.facturaDestinoId ? `
                <div class="mt-5">
                    <h6 class="fw-bold mb-3" style="color: var(--text-main);">Documentos relacionados</h6>
                    <ul class="nav nav-tabs mb-3" role="tablist" style="border-bottom: 2px solid var(--border-color);">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-factura" type="button" role="tab" style="font-size: var(--fs-base); font-weight: var(--weight-medium); color: var(--text-main); border-bottom-color: transparent;">Factura relacionada</button>
                        </li>
                    </ul>
                    
                    <div class="tab-content border-0 p-0">
                        <div class="tab-pane fade show active" id="tab-factura" role="tabpanel">
                            <div class="card border border-light shadow-sm" style="max-width:300px; cursor:pointer;" onclick="sessionStorage.setItem('origenVolver', JSON.stringify({hash: '#/ingresos/cotizaciones/ver/${cotizacion.id}', label: 'Volver a la cotización'})); window.location.hash='#/ingresos/facturas/ver/${cotizacion.facturaDestinoId}'">
                                <div class="card-body py-3 px-3 d-flex justify-content-between align-items-center">
                                    <div>
                                        <small class="text-muted d-block" style="font-size: var(--fs-xs);">Ver documento destino</small>
                                        <span class="fw-medium text-dark" style="font-size: var(--fs-md); color: var(--primary) !important;">Factura</span>
                                    </div>
                                    <i class="bi bi-box-arrow-up-right text-muted" style="font-size: var(--fs-sm);"></i>
                                </div>
                            </div>
                        </div>
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
            CoreActions.bindActionEvents(element, cotizacion, 'cotizacion', {
                onConvertSuccess: (nuevaFacturaId) => {
                    try {
                        window.location.hash = `#/ingresos/facturas/ver/${nuevaFacturaId}`;
                    } catch (e) {
                        console.error("Error al redireccionar a la nueva factura:", e);
                    }
                }
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
                
                cotizacion.total = totalFinal; // Mantener en estado global para guardado rápido
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
                        element.querySelector('#search-cliente').value = nuevoContacto.nombre;
                        const hiddenInput = element.querySelector('#select-cliente');
                        hiddenInput.value = nuevoContacto.id;
                        calcularVencimiento(nuevoContacto);
                    });
                }
            });
        }

        // Configuración de Numeración (Engranaje)
        element.querySelector('#btn-config-num')?.addEventListener('click', () => {
            NumberingManager.openNumberingModal('cotizacion', cotizacion, (prefijo, numero) => {
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
            window.location.hash = '#/ingresos/cotizaciones';
        });

        // Evento Imprimir Global (Acción Superior)
        element.querySelector('.btn-imprimir')?.addEventListener('click', (e) => {
            if (!isViewOnly) {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
                CoreActions.showWarningModal("Primero debes guardar o finalizar la cotización para poder generar su formato de impresión oficial.");
                if (window._cotizacionesPrintBtnTimeout) clearTimeout(window._cotizacionesPrintBtnTimeout);
                window._cotizacionesPrintBtnTimeout = setTimeout(() => {
                    if (document.body.contains(e.currentTarget)) {
                        e.currentTarget.style.borderColor = '';
                        e.currentTarget.style.color = '';
                    }
                }, 3000);
                return;
            }
            PrintManager.printDocument(cotizacion, 'Cotización', contactos, productos);
        });

        // Evento Vista Previa Global (Acción Superior)
        element.querySelector('.btn-vista-previa')?.addEventListener('click', (e) => {
            if (!isViewOnly) {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
                CoreActions.showWarningModal("Primero debes guardar o finalizar la cotización para poder generar su vista previa.");
                if (window._cotizacionesPreviewBtnTimeout) clearTimeout(window._cotizacionesPreviewBtnTimeout);
                window._cotizacionesPreviewBtnTimeout = setTimeout(() => {
                    if (document.body.contains(e.currentTarget)) {
                        e.currentTarget.style.borderColor = '';
                        e.currentTarget.style.color = '';
                    }
                }, 3000);
                return;
            }
            PrintManager.printDocument(cotizacion, 'Cotización', contactos, productos, 'preview');
        });

        // Evento Editar Global (Acción Superior)
        element.querySelector('.btn-editar')?.addEventListener('click', (e) => {
            const docId = e.currentTarget.dataset.id;
            window.location.hash = `#/ingresos/cotizaciones/editar/${docId}`;
        });

        // Evento Guardar (Captura de Estado DOM a DB)
        element.querySelector('#btn-guardar')?.addEventListener('click', async (e) => {
            const btnGuardar = e.currentTarget;
            if (btnGuardar.disabled) return;
            const originalText = btnGuardar.innerHTML;
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

            import('../../shared/formatters.js').then(async fmt => {
                const parseP = (v) => fmt.parseCurrencyValue(v);

                try {
                    const clienteId = element.querySelector('#select-cliente').value;
                    if (!clienteId) {
                        const searchInput = element.querySelector('#search-cliente');
                        searchInput.style.borderColor = '#ef4444';
                        CoreActions.showWarningModal("Debes seleccionar un cliente válido de la lista.");
                        if (window._cotizaSearchClientTimeout) clearTimeout(window._cotizaSearchClientTimeout);
                        window._cotizaSearchClientTimeout = setTimeout(() => {
                            if (document.body.contains(searchInput)) {
                                searchInput.style.borderColor = '';
                            }
                        }, 3000);
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = originalText;
                        return;
                    }

                    const arrDetalles = Array.from(tbody.querySelectorAll('tr')).map(r => {
                        return {
                            id: r.dataset.uid,
                            productoId: r.querySelector('.input-prod-id').value,
                            descripcion_personalizada: r.querySelector('.input-prod-desc')?.value || '',
                            cantidad: parseFloat(r.querySelector('.input-qty').value || 0),
                            precio: parseP(r.querySelector('.input-price').value),
                            descuento: parseFloat(r.querySelector('.input-disc').value || 0),
                            impuesto: parseFloat(r.querySelector('.input-tax').value || 0)
                        };
                    }).filter(d => d.productoId);

                    if (arrDetalles.length === 0 || parseFloat(element.querySelector('#tot-total').dataset.rawTotal) <= 0) {
                        CoreActions.showWarningModal("Debe agregar al menos un producto válido y con cantidad mayor a cero.");
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = originalText;
                        return;
                    }

                    cotizacion.clienteId = clienteId;
                    cotizacion.fecha = element.querySelector('#input-fecha').value;
                    cotizacion.vencimiento = element.querySelector('#input-vencimiento').value || cotizacion.fecha;
                    cotizacion.notas = element.querySelector('#input-notas').value;
                    cotizacion.terminosCondiciones = element.querySelector('#input-terminos').value;
                    cotizacion.detalles = arrDetalles;

                    if (!cotizacion.numero) {
                        cotizacion = await DB.saveWithNextNumero('cotizaciones', cotizacion);
                    } else {
                        await DB.save('cotizaciones', cotizacion);
                    }
                    
                    window.hayCambiosSinGuardar = false;
                    window.location.hash = `#/ingresos/cotizaciones/ver/${cotizacion.id}`;
                } catch (error) {
                    console.error("Fallo general de guardado:", error);
                    CoreActions.showWarningModal("Error al guardar: " + error.message);
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = originalText;
                } finally {
                    const btnCancelar = element.querySelector('#btn-cancelar');
                    if (btnCancelar) btnCancelar.disabled = false;
                }
            });
        });

        // Inicializar UI
        cotizacion.detalles.forEach(det => addRow(det));
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
