import DB from '../../core/db.js';
import { CoreActions, ItemEngine, NumberingManager, ExportManager, PrintManager } from '../../shared/crud.js';

export const FacturasModule = {
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
        const facturasData = await DB.getAll('facturas');
        // Ordenar por ID o fecha (más reciente primero)
        facturasData.sort((a, b) => b.id.localeCompare(a.id));

        // Obtener contactos para mostrar los nombres
        const contactos = await DB.getAll('contactos');
        const getClienteName = (id) => {
            const cliente = contactos.find(c => c.id === id);
            return cliente ? cliente.nombre : 'Sin Cliente';
        };

        // Estado de Paginación y Filtro
        let currentPage = 1;
        let itemsPerPage = 10;
        let searchQuery = '';
        let filterCriteria = 'todos'; // todos, numero, cliente, fecha, estado
        let filteredData = [];

        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        const renderGrid = () => {
            // Aplicar Filtro Multi-Criterio
            filteredData = facturasData.filter(c => {
                if (!searchQuery) return true;
                const clientName = getClienteName(c.clienteId).toLowerCase();
                const num = (c.prefijo || '') + (c.numero || '').toString();
                const state = c.estado || 'por_pagar';
                const date = c.fecha || '';

                if (filterCriteria === 'numero') return num.toLowerCase().includes(searchQuery);
                if (filterCriteria === 'cliente') return clientName.includes(searchQuery);
                if (filterCriteria === 'fecha') return date.includes(searchQuery);
                if (filterCriteria === 'estado') return state.includes(searchQuery);
                
                // Búsqueda Transversal Global
                return clientName.includes(searchQuery) || num.toLowerCase().includes(searchQuery) || state.includes(searchQuery) || date.includes(searchQuery);
            });

            const totalItems = filteredData.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;

            const startIndex = (currentPage - 1) * itemsPerPage;
            const currentItems = filteredData.slice(startIndex, startIndex + itemsPerPage);

            const tbodyHtml = currentItems.length > 0 ? currentItems.map(c => {
                const estado = c.estado || 'por_pagar';
                let badgeColor = '';
                let labelEstado = '';
                
                if (estado === 'pagada') {
                    badgeColor = 'color: #15803d; background-color: #dcfce7;';
                    labelEstado = 'Pagada';
                } else if (estado === 'anulada') {
                    badgeColor = 'color: #ef4444; background-color: #fee2e2;';
                    labelEstado = 'Anulada';
                } else {
                    badgeColor = 'color: #b45309; background-color: #fef3c7;';
                    labelEstado = 'Por Pagar';
                }

                const numDisplay = (c.prefijo || '') + (c.numero || c.id);
                
                return `
                    <tr style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);" onclick="if(!event.target.closest('button')) window.location.hash = '#/ingresos/facturas/ver/${c.id}'">
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
            }).join('') : `<tr><td colspan="6" class="text-center py-5 text-muted">No se encontraron facturas</td></tr>`;

            element.innerHTML = `
                <div class="module-container p-4" style="max-width: 1200px; margin: 0 auto;">
                    
                    <!-- TOP BAR -->
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Facturas de venta</h2>
                            <p class="text-muted mb-0" style="font-size: 14px;">
                                Gestiona las facturas generadas por ventas a tus clientes. 
                                <a href="#" style="color: #2cbfb7; text-decoration: none;">Saber más</a>
                            </p>
                        </div>
                        <div class="d-flex gap-2">
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
                                        <th class="py-3 fw-normal">Número</th>
                                        <th class="py-3 fw-normal">Cliente</th>
                                        <th class="py-3 fw-normal">Creación</th>
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

            // Crear Factura
            element.querySelector('#btn-nueva-factura')?.addEventListener('click', () => {
                window.location.hash = '#/ingresos/facturas/nueva';
            });

            // Exportar Lista a CSV
            element.querySelector('#btn-export-list')?.addEventListener('click', (e) => {
                ExportManager.exportDataToExcel(filteredData, 'Facturas', getClienteName, e.currentTarget);
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
                    menu.querySelector('.btn-delete-row').addEventListener('click', async (ev) => {
                        ev.preventDefault();
                        if (confirm('¿Estás seguro de eliminar esta factura de forma permanente?')) {
                            await DB.delete('facturas', id);
                            menu.remove();
                            // Recargar DB local
                            const idx = facturasData.findIndex(c => c.id === id);
                            if (idx > -1) facturasData.splice(idx, 1);
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
                    const doc = facturasData.find(c => c.id === id);
                    if (doc) {
                        const productos = await DB.getAll('productos');
                        PrintManager.printDocument(doc, 'Factura de venta', contactos, productos);
                    }
                });
            });
        };

        // Click out to close row menus
        document.addEventListener('click', (e) => {
            const menu = document.querySelector('.row-action-menu');
            if (menu && !e.target.closest('.row-action-menu') && !e.target.closest('.btn-menu-row')) {
                menu.remove();
            }
        });

        renderGrid();
    },

    async renderForm(element, id = null, isViewOnly = false) {
        // Carga de DB
        const contactos = await DB.getAll('contactos');
        const productos = await DB.getAll('productos');
        
        // Estado por defecto
        let factura = {
            id: 'fac_' + Date.now(),
            numero: Math.floor(Math.random() * 9000) + 1000,
            fecha: new Date().toISOString().split('T')[0],
            vencimiento: new Date().toISOString().split('T')[0],
            clienteId: '',
            detalles: [{ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 }],
            notas: '',
            terminosCondiciones: 'Favor realizar los pagos a nuestra cuenta bancaria.',
            estado: 'por_pagar',
            total: 0
        };

        if (id) {
            const dbData = await DB.get('facturas', id);
            if (dbData) factura = dbData;
            
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

        // Opciones de Clientes
        let clientesOptions = '<option value="">Selecciona un cliente</option>';
        contactos.filter(c => c.tipo === 'cliente').forEach(c => {
            clientesOptions += `<option value="${c.id}" ${factura.clienteId === c.id ? 'selected' : ''} data-plazos="${c.plazosPago || 0}">${c.nombre}</option>`;
        });

        element.innerHTML = `
            <div class="module-container p-4" style="max-width: 1100px; margin: 0 auto;">
                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        ${headerHtml}
                        <h2 class="h3 fw-bold mb-0" style="color: var(--text-main);">${id ? 'Factura No. ' + factura.numero : 'Nueva factura'}</h2>
                    </div>
                    ${actionsHtml}
                </div>

                <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                    <div class="card-body p-5">
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
                                    <span id="lbl-numero">No. <strong style="color: var(--text-main);">${factura.prefijo ? factura.prefijo + ' ' : ''}${factura.numero}</strong></span>
                                    ${!isViewOnly ? `<i class="bi bi-gear" id="btn-config-num" style="cursor: pointer;"></i>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- INFO FACTURA -->
                        <h6 class="fw-bold mb-3" style="color: var(--text-main);">Información de la factura</h6>
                        <div class="row mb-5 g-3">
                            <div class="col-md-3">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Cliente <span class="text-danger">*</span></label>
                                <select id="select-cliente" class="form-select form-select-sm text-muted" ${isViewOnly ? 'disabled' : ''}>
                                    ${clientesOptions}
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Tipo de Venta</label>
                                <select id="select-tipo-venta" class="form-select form-select-sm text-muted" ${isViewOnly ? 'disabled' : ''}>
                                    <option value="credito" ${factura.tipoVenta === 'credito' || !factura.tipoVenta ? 'selected' : ''}>A Crédito (Cartera)</option>
                                    <option value="contado" ${factura.tipoVenta === 'contado' ? 'selected' : ''}>De Contado (Caja)</option>
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

                        <!-- TEXTAREAS ADICIONALES -->
                        <div class="mb-4">
                            <h6 class="fw-bold mb-1" style="font-size: 14px; color: var(--text-main);">Notas</h6>
                            <textarea id="input-notas" class="form-control text-muted" rows="2" style="font-size: 13px; border-color: var(--border-color); resize: none;" placeholder="Agrega comentarios para aclarar datos de la factura, serán visibles para tus clientes" ${isViewOnly ? 'disabled' : ''}>${factura.notas}</textarea>
                        </div>
                        <div>
                            <h6 class="fw-bold mb-1" style="font-size: 14px; color: var(--text-main);">Términos y condiciones</h6>
                            <textarea id="input-terminos" class="form-control text-muted" rows="2" style="font-size: 13px; border-color: var(--border-color); resize: none;" placeholder="Define los términos y condiciones, y/o las posibles cláusulas en caso de reclamos" ${isViewOnly ? 'disabled' : ''}>${factura.terminosCondiciones}</textarea>
                        </div>
                    </div>
                </div>

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
                    ${ItemEngine.renderProductSearchBox(detalle, productos)}
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
                    if (metaProd) metaProd.innerHTML = `<span style="color: var(--text-muted); font-size: 11px;">${prod.sku || 'S/N'} | Agregar descripción <i class="bi bi-pencil" style="cursor:pointer;"></i></span>`;
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
            
            factura.total = totalFinal; // Mantener en estado global para guardado rápido
        };

        // Enlace de Datos: Fecha de Vencimiento Automatizada
        element.querySelector('#select-cliente')?.addEventListener('change', (e) => {
            const opt = e.target.options[e.target.selectedIndex];
            const plazos = parseInt(opt.dataset.plazos || 0);
            if (plazos > 0) {
                const fechaCreacion = new Date(element.querySelector('#input-fecha').value);
                fechaCreacion.setDate(fechaCreacion.getDate() + plazos);
                element.querySelector('#input-vencimiento').value = fechaCreacion.toISOString().split('T')[0];
            }
        });

        // Configuración de Numeración (Engranaje)
        element.querySelector('#btn-config-num')?.addEventListener('click', () => {
            NumberingManager.openNumberingModal('factura', factura, (prefijo, numero) => {
                element.querySelector('#lbl-numero').innerHTML = `No. <strong style="color: var(--text-main);">${prefijo ? prefijo + ' ' : ''}${numero}</strong>`;
            });
        });

        // Evento Agregar Línea
        element.querySelector('#btn-agregar-linea')?.addEventListener('click', () => {
            addRow({ id: Date.now(), productoId: '', cantidad: 0, precio: 0, descuento: 0, impuesto: 0 });
            calcEngine();
        });

        // Evento Cancelar
        element.querySelector('#btn-cancelar')?.addEventListener('click', () => {
            window.location.hash = '#/ingresos/facturas';
        });

        // Evento Imprimir Global (Acción Superior)
        element.querySelector('.btn-imprimir')?.addEventListener('click', (e) => {
            if (!isViewOnly) {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
                CoreActions.showWarningModal("Primero debes guardar o finalizar la factura para poder generar su formato de impresión oficial.");
                setTimeout(() => {
                    e.currentTarget.style.borderColor = '';
                    e.currentTarget.style.color = '';
                }, 3000);
                return;
            }
            PrintManager.printDocument(factura, 'Factura de venta', contactos, productos);
        });

        // Evento Editar Global (Acción Superior)
        element.querySelector('.btn-editar')?.addEventListener('click', (e) => {
            const docId = e.currentTarget.dataset.id;
            window.location.hash = `#/ingresos/facturas/editar/${docId}`;
        });

        // Evento Guardar (Captura de Estado DOM a DB)
        element.querySelector('#btn-guardar')?.addEventListener('click', async () => {
            const clienteId = element.querySelector('#select-cliente').value;
            if (!clienteId) {
                CoreActions.showWarningModal("Debe seleccionar un cliente.");
                return;
            }

            const tipoVenta = element.querySelector('#select-tipo-venta').value;
            const isNew = !id; // Si es nueva factura, descargamos inventario

            // Recolectar detalles
            const arrDetalles = [];
            let hasError = false;
            let stockError = '';

            const rows = tbody.querySelectorAll('tr');
            for (const tr of rows) {
                const prodId = tr.querySelector('.input-prod-id').value;
                if (!prodId) continue;
                
                const inpQty = tr.querySelector('.input-qty');
                const qty = parseFloat(inpQty.value || 0);
                if (qty <= 0) {
                    inpQty.style.borderColor = '#ef4444';
                    hasError = true;
                }

                // Validación de stock solo si es nueva factura
                if (isNew) {
                    const lotes = await DB.getAll('lotes_fifo');
                    const stockTotal = lotes.filter(l => l.productoId === prodId).reduce((sum, l) => sum + l.cantidadActual, 0);
                    if (stockTotal < qty) {
                        const prod = productos.find(p => p.id === prodId);
                        stockError += `Stock insuficiente para ${prod ? prod.nombre : 'el producto'}. Disponible: ${stockTotal}, Requerido: ${qty}.<br>`;
                        inpQty.style.borderColor = '#ef4444';
                        hasError = true;
                    }
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
            }

            if (stockError) {
                CoreActions.showWarningModal(stockError);
                return;
            }

            if (arrDetalles.length === 0 || hasError || parseFloat(element.querySelector('#tot-total').dataset.rawTotal) <= 0) {
                CoreActions.showWarningModal("Debe agregar al menos un producto válido y con cantidad mayor a cero.");
                return;
            }

            // Descargo FIFO de inventario si es nueva
            let costoTotalVenta = 0;
            if (isNew) {
                const lotesGlobales = await DB.getAll('lotes_fifo');
                for (const det of arrDetalles) {
                    let qtyRestante = det.cantidad;
                    let costoLinea = 0;
                    const lotesProd = lotesGlobales.filter(l => l.productoId === det.productoId && l.cantidadActual > 0);
                    lotesProd.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso)); // FIFO
                    
                    for (const lote of lotesProd) {
                        if (qtyRestante <= 0) break;
                        const aDescontar = Math.min(lote.cantidadActual, qtyRestante);
                        lote.cantidadActual -= aDescontar;
                        qtyRestante -= aDescontar;
                        costoLinea += (aDescontar * lote.costoUnitario);
                        await DB.save('lotes_fifo', lote); // Guardar cambio en BD
                    }
                    det.costoTotalCalculado = costoLinea;
                    costoTotalVenta += costoLinea;
                }
            } else {
                // Si es edición, mantenemos el costo total previo para no recalcular
                costoTotalVenta = factura.total_costo || 0;
            }

            factura.clienteId = clienteId;
            factura.tipoVenta = tipoVenta;
            factura.fecha = element.querySelector('#input-fecha').value;
            factura.vencimiento = element.querySelector('#input-vencimiento').value;
            factura.notas = element.querySelector('#input-notas').value;
            factura.terminosCondiciones = element.querySelector('#input-terminos').value;
            factura.detalles = arrDetalles;
            factura.tipo = 'venta'; // Ensure type is venta
            
            const rawTotal = parseFloat(element.querySelector('#tot-total').dataset.rawTotal);
            factura.total = rawTotal;
            factura.total_costo = costoTotalVenta;
            factura.utilidad = rawTotal - costoTotalVenta;

            // Condicional Contado vs Crédito
            if (tipoVenta === 'contado') {
                factura.estado = 'pagada';
                // Crear ingreso a Caja General si es nueva
                if (isNew) {
                    const transaccion = {
                        id: 'trx_' + Date.now(),
                        facturaId: factura.id,
                        tipo: 'ingreso',
                        monto: rawTotal,
                        fecha: factura.fecha,
                        referencia: `Venta al contado Fac. ${factura.prefijo || ''}${factura.numero}`,
                        cuenta: 'Caja General'
                    };
                    await DB.save('transacciones', transaccion);
                }
            } else {
                factura.estado = factura.estado === 'pagada' ? 'pagada' : 'por_pagar'; // Si se cambia a crédito, asume por_pagar
            }

            await DB.save('facturas', factura);
            
            // Navegar a modo lectura para bloquear edición y habilitar impresión final
            window.location.hash = `#/ingresos/facturas/ver/${factura.id}`;
        });

        // Inicializar UI
        factura.detalles.forEach(det => addRow(det));
        calcEngine(); // Primer cálculo
    }
};
