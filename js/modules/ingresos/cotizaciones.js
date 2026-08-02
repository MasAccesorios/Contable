import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions, ItemEngine, NumberingManager, ExportManager, PrintManager } from '../../shared/crud.js';
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
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; color: #2cbfb7;">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;
        const cotizacionesData = await DB.getAll('cotizaciones');

        // Obtener contactos para mostrar los nombres
        const contactos = await DB.getAll('contactos');
        const getClienteName = (id) => {
            const cliente = contactos.find(c => c.id === id);
            return cliente ? cliente.nombre : 'Sin Cliente';
        };

        // Estado de Paginación, Ordenamiento y Filtro
        let sortColumn = 'numero';
        let sortDirection = 'desc';
        let currentPage = 1;
        let itemsPerPage = 10;
        let searchQuery = '';
        let filterCriteria = 'todos'; // todos, numero, cliente, fecha, estado
        let filteredData = [];

        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        const renderGrid = () => {
            // Aplicar Filtro Multi-Criterio
            filteredData = cotizacionesData.filter(c => {
                if (!searchQuery) return true;
                const clientName = getClienteName(c.clienteId).toLowerCase();
                const num = (c.numero || '').toString();
                const state = c.convertidoAFactura ? 'facturada' : 'borrador';
                const date = c.fecha || '';

                if (filterCriteria === 'numero') return num.toLowerCase().includes(searchQuery);
                if (filterCriteria === 'cliente') return clientName.includes(searchQuery);
                if (filterCriteria === 'fecha') return date.includes(searchQuery);
                if (filterCriteria === 'estado') return state.includes(searchQuery);
                
                // Búsqueda Transversal Global
                return clientName.includes(searchQuery) || num.toLowerCase().includes(searchQuery) || state.includes(searchQuery) || date.includes(searchQuery);
            });

            // Aplicar Ordenamiento Dinámico
            filteredData.sort((a, b) => {
                let valA, valB;
                if (sortColumn === 'numero') {
                    valA = parseInt(String(a.numero !== undefined && a.numero !== null && String(a.numero).trim() !== '' ? a.numero : 0).replace(/\D/g, ''), 10) || 0;
                    valB = parseInt(String(b.numero !== undefined && b.numero !== null && String(b.numero).trim() !== '' ? b.numero : 0).replace(/\D/g, ''), 10) || 0;
                    if (valA === valB) {
                        valA = parseInt(String(a.id).replace(/\D/g, ''), 10) || 0;
                        valB = parseInt(String(b.id).replace(/\D/g, ''), 10) || 0;
                    }
                } else if (sortColumn === 'cliente') {
                    valA = getClienteName(a.clienteId || a.contactoId).toLowerCase();
                    valB = getClienteName(b.clienteId || b.contactoId).toLowerCase();
                } else if (sortColumn === 'fecha') {
                    valA = a.fecha || '';
                    valB = b.fecha || '';
                }

                let comparison = 0;
                if (typeof valA === 'number' && typeof valB === 'number') {
                    comparison = valA - valB;
                } else {
                    comparison = String(valA).localeCompare(String(valB));
                }

                return sortDirection === 'asc' ? comparison : -comparison;
            });

            const totalItems = filteredData.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;

            const startIndex = (currentPage - 1) * itemsPerPage;
            const currentItems = filteredData.slice(startIndex, startIndex + itemsPerPage);

            const tbodyHtml = currentItems.length > 0 ? currentItems.map(c => {
                const isFacturada = c.convertidoAFactura;
                const badgeColor = isFacturada ? 'color: #15803d; background-color: #dcfce7;' : 'color: #b45309; background-color: #fef3c7;';
                const labelEstado = isFacturada ? 'Facturada' : 'Borrador';
                const numDisplay = (c.numero || c.id);
                
                return `
                    <tr style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);" onclick="if(!event.target.closest('button')) window.location.hash = '#/ingresos/cotizaciones/ver/${c.id}'">
                        <td class="py-3">${numDisplay}</td>
                        <td class="py-3" style="color: var(--text-main); font-weight: var(--weight-medium);">${getClienteName(c.clienteId)}</td>
                        <td class="py-3">${c.fecha}</td>
                        <td class="py-3 text-end">${formatMoney(c.total)}</td>
                        <td class="py-3 text-center">
                            <span style="${badgeColor} padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: var(--weight-medium);">${labelEstado}</span>
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
            }).join('') : `<tr><td colspan="6" class="text-center py-5 text-muted">No se encontraron cotizaciones</td></tr>`;

            element.innerHTML = `
                <div class="module-container p-4" style="max-width: 1200px; margin: 0 auto;">
                    
                    <!-- TOP BAR -->
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Cotizaciones</h2>
                            <p class="text-muted mb-0" style="font-size: 14px;">
                                Crea y gestiona cotizaciones personalizadas para tus clientes potenciales. 
                                <a href="#" style="color: #2cbfb7; text-decoration: none;">Saber más</a>
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
                                <button id="btn-nueva-cotizacion" class="btn text-white" style="background-color: #2cbfb7; font-weight: var(--weight-medium); font-size: 14px;">
                                    <i class="bi bi-plus-lg me-1"></i> Nueva cotización
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
                                <input type="text" class="form-control border-start-0 ps-0 text-muted" id="search-input" placeholder="Buscar cliente" value="${searchQuery}" style="font-size: 13px; box-shadow: none;">
                            </div>
                            <div class="dropdown">
                                <button class="btn btn-link text-decoration-none text-muted p-0 dropdown-toggle" data-bs-toggle="dropdown" style="font-size: 14px;">
                                    <i class="bi bi-funnel me-1"></i> Filtrar <span id="lbl-filtro-actual" style="font-size: 12px; font-weight: 500; color: #2cbfb7;"></span>
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
                                        <th class="py-3 fw-normal sortable-header" data-column="cliente" style="cursor: pointer; user-select: none;">
                                            Cliente ${sortColumn === 'cliente' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                                        </th>
                                        <th class="py-3 fw-normal sortable-header" data-column="fecha" style="cursor: pointer; user-select: none;">
                                            Creación ${sortColumn === 'fecha' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                                        </th>
                                        <th class="py-3 fw-normal text-end">Total</th>
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

                searchInput.addEventListener('input', (e) => {
                    searchQuery = e.target.value.toLowerCase().trim();
                    currentPage = 1;
                    renderGrid();
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
                    const lbl = element.querySelector('#lbl-filtro-actual');
                    if (lbl) lbl.textContent = filterCriteria !== 'todos' ? `(${e.target.textContent})` : '';
                    currentPage = 1;
                    renderGrid();
                });
            });

            // Crear Cotización
            element.querySelector('#btn-nueva-cotizacion')?.addEventListener('click', () => {
                window.location.hash = '#/ingresos/cotizaciones/nueva';
            });

            // Exportar Lista a CSV
            element.querySelector('#btn-export-list')?.addEventListener('click', (e) => {
                ExportManager.exportDataToExcel(filteredData, 'Cotizaciones', getClienteName, e.currentTarget);
            });

            // Actualizar Caché
            element.querySelector('#btn-refresh-list')?.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const originalHtml = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`;
                
                cotizacionesData = await DB.refreshCache('cotizaciones');
                contactos = await DB.refreshCache('contactos');
                
                renderGrid();
                
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
                            <a href="#/ingresos/cotizaciones/editar/${id}" class="d-block px-3 py-1 text-decoration-none" style="color: var(--text-body); font-size: 13px;">
                                <i class="bi bi-pencil me-2"></i> Editar
                            </a>
                            <a href="#" class="d-block px-3 py-1 text-decoration-none mt-1 btn-delete-row" data-id="${id}" style="color: #ef4444; font-size: 13px;">
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
                            // Recargar DB local
                            const idx = cotizacionesData.findIndex(c => c.id === id);
                            if (idx > -1) cotizacionesData.splice(idx, 1);
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
                    const doc = cotizacionesData.find(c => c.id === id);
                    if (doc) {
                        const productos = await DB.getAll('productos');
                        PrintManager.printDocument(doc, 'Cotización', contactos, productos);
                    }
                });
            });
        };

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

        // Datos de Clientes para el Combobox
        const clientes = contactos.filter(c => c.tipo === 'cliente');
        const clienteActual = clientes.find(c => c.id === cotizacion.clienteId);
        const clienteNombreActual = clienteActual ? clienteActual.nombre : '';

        element.innerHTML = `
            <div class="module-container p-4" style="max-width: 1100px; margin: 0 auto;">
                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        ${headerHtml}
                        <h2 class="h3 fw-bold mb-0" style="color: var(--text-main);">${id ? 'Cotización No. ' + cotizacion.numero : 'Nueva cotización'}</h2>
                    </div>
                    ${actionsHtml}
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
                                    <option>Cotización</option>
                                </select>
                                <div class="d-flex justify-content-between align-items-center text-muted" style="font-size: 14px;">
                                    <span id="lbl-numero">No. <strong style="color: var(--text-main);">${cotizacion.numero || '[Autogenerado al guardar]'}</strong></span>
                                    ${!isViewOnly ? `<i class="bi bi-gear" id="btn-config-num" style="cursor: pointer;"></i>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- INFO COTIZACION -->
                        <h6 class="fw-bold mb-3" style="color: var(--text-main);">Información de la cotización</h6>
                        <div class="row mb-5 g-4">
                            <div class="col-md-4">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Cliente <span class="text-danger">*</span></label>
                                <input type="text" id="search-cliente" class="form-control form-control-sm text-muted" placeholder="Buscar cliente..." value="${clienteNombreActual}" autocomplete="off" ${isViewOnly ? 'disabled' : ''}>
                                <input type="hidden" id="select-cliente" value="${cotizacion.clienteId || ''}">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Fecha de creación</label>
                                <input type="date" id="input-fecha" class="form-control form-control-sm text-muted" value="${cotizacion.fecha}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Fecha de vencimiento</label>
                                <input type="date" id="input-vencimiento" class="form-control form-control-sm text-muted" value="${cotizacion.vencimiento}" ${isViewOnly ? 'disabled' : ''}>
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
                ${isViewOnly && cotizacion.convertidoAFactura && cotizacion.facturaDestinoId ? `
                <div class="mt-5">
                    <h6 class="fw-bold mb-3" style="color: var(--text-main);">Documentos relacionados</h6>
                    <ul class="nav nav-tabs mb-3" role="tablist" style="border-bottom: 2px solid var(--border-color);">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-factura" type="button" role="tab" style="font-size: 13px; font-weight: var(--weight-medium); color: var(--text-main); border-bottom-color: transparent;">Factura relacionada</button>
                        </li>
                    </ul>
                    
                    <div class="tab-content border-0 p-0">
                        <div class="tab-pane fade show active" id="tab-factura" role="tabpanel">
                            <div class="card border border-light shadow-sm" style="max-width:300px; cursor:pointer;" onclick="sessionStorage.setItem('origenVolver', JSON.stringify({hash: '#/ingresos/cotizaciones/ver/${cotizacion.id}', label: 'Volver a la cotización'})); window.location.hash='#/ingresos/facturas/ver/${cotizacion.facturaDestinoId}'">
                                <div class="card-body py-3 px-3 d-flex justify-content-between align-items-center">
                                    <div>
                                        <small class="text-muted d-block" style="font-size:11px;">Ver documento destino</small>
                                        <span class="fw-medium text-dark" style="font-size:14px; color: var(--primary) !important;">Factura</span>
                                    </div>
                                    <i class="bi bi-box-arrow-up-right text-muted" style="font-size: 12px;"></i>
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
                <td class="align-top"><input type="number" step="any" min="0" class="form-control form-control-sm border-0 bg-light input-price" value="${detalle.precio}" placeholder="$" ${isViewOnly ? 'disabled' : ''}></td>
                <td class="align-top"><input type="number" step="any" min="0" max="100" class="form-control form-control-sm border-0 bg-light input-disc" value="${detalle.descuento}" placeholder="0 %" ${isViewOnly ? 'disabled' : ''}></td>
                <td class="align-top"><input type="number" step="any" min="0" max="100" class="form-control form-control-sm border-0 bg-light input-tax" value="${detalle.impuesto}" placeholder="%" ${isViewOnly ? 'disabled' : ''}></td>
                <td class="text-end fw-bold calc-subtotal align-top pt-3" style="color: var(--text-main);">$0,00</td>
                <td class="text-center align-top pt-2">
                    ${!isViewOnly ? `<button class="btn btn-link text-muted p-0 btn-eliminar-linea">
                        <i class="bi bi-trash"></i>
                    </button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);

            // Delegar Eventos Principales al Motor Global (Auto-Pricing y Metadatos)
            ItemEngine.bindLineEvents(tr, () => calcEngine(), productos);

            if (!isViewOnly) {
                // Disparadores locales del Math Engine
                const inpQty = tr.querySelector('.input-qty');
                const inpPrice = tr.querySelector('.input-price');
                const inpDisc = tr.querySelector('.input-disc');
                const inpTax = tr.querySelector('.input-tax');
                [inpQty, inpPrice, inpDisc, inpTax].forEach(el => el.addEventListener('input', calcEngine));

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

            tbody.querySelectorAll('tr').forEach(tr => {
                const qty = parseFloat(tr.querySelector('.input-qty').value || 0);
                const price = parseFloat(tr.querySelector('.input-price').value || 0);
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
                setTimeout(() => {
                    e.currentTarget.style.borderColor = '';
                    e.currentTarget.style.color = '';
                }, 3000);
                return;
            }
            PrintManager.printDocument(cotizacion, 'Cotización', contactos, productos);
        });

        // Evento Editar Global (Acción Superior)
        element.querySelector('.btn-editar')?.addEventListener('click', (e) => {
            const docId = e.currentTarget.dataset.id;
            window.location.hash = `#/ingresos/cotizaciones/editar/${docId}`;
        });

        // Evento Guardar (Captura de Estado DOM a DB)
        element.querySelector('#btn-guardar')?.addEventListener('click', async (e) => {
            const btnGuardar = e.currentTarget;
            if (btnGuardar.disabled) return; // Salvaguarda estricta contra doble clic
            
            const originalText = btnGuardar.innerHTML;
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Guardando...`;
            
            const btnCancelar = element.querySelector('#btn-cancelar');
            if (btnCancelar) btnCancelar.disabled = true;

            try {
                const clienteId = element.querySelector('#select-cliente').value;
                if (!clienteId) {
                    const searchInput = element.querySelector('#search-cliente');
                    searchInput.style.borderColor = '#ef4444';
                    CoreActions.showWarningModal("Debes seleccionar un cliente válido de la lista.");
                    setTimeout(() => searchInput.style.borderColor = '', 3000);
                    return;
                }

                // Recolectar detalles
                const arrDetalles = [];
                let hasError = false;
                tbody.querySelectorAll('tr').forEach(tr => {
                    const prodId = tr.querySelector('.input-prod-id').value;
                    if (!prodId) return; // Omitir filas sin producto
                    
                    const inpQty = tr.querySelector('.input-qty');
                    const qty = parseFloat(inpQty.value || 0);
                    if (qty <= 0) {
                        inpQty.style.borderColor = '#ef4444';
                        hasError = true;
                    }
                    
                    arrDetalles.push({
                        id: tr.dataset.uid,
                        productoId: prodId,
                        descripcion_personalizada: tr.querySelector('.input-prod-desc').value,
                        cantidad: qty,
                        precio: parseFloat(tr.querySelector('.input-price').value || 0),
                        descuento: parseFloat(tr.querySelector('.input-disc').value || 0),
                        impuesto: parseFloat(tr.querySelector('.input-tax').value || 0)
                    });
                });

                if (arrDetalles.length === 0 || hasError || parseFloat(element.querySelector('#tot-total').dataset.rawTotal) <= 0) {
                    CoreActions.showWarningModal("Debe agregar al menos un producto válido y con cantidad mayor a cero.");
                    return;
                }

                cotizacion.clienteId = clienteId;
                cotizacion.fecha = element.querySelector('#input-fecha').value;
                cotizacion.vencimiento = element.querySelector('#input-vencimiento').value;
                cotizacion.detalles = arrDetalles;

                if (!cotizacion.numero) {
                    cotizacion = await DB.saveWithNextNumero('cotizaciones', cotizacion);
                } else {
                    await DB.save('cotizaciones', cotizacion);
                }
                
                // Navegar a modo lectura para bloquear edición y habilitar impresión final
                window.hayCambiosSinGuardar = false;
                window.location.hash = `#/ingresos/cotizaciones/ver/${cotizacion.id}`;
            } catch (err) {
                console.error("Error al guardar cotización:", err);
                CoreActions.showWarningModal("Ocurrió un error al intentar guardar la cotización.");
            } finally {
                if (btnGuardar) {
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = originalText;
                }
                if (btnCancelar) btnCancelar.disabled = false;
            }
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
