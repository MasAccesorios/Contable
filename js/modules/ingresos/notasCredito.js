import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions, ItemEngine } from '../../shared/crud.js';
import { InventarioUtils } from '../../shared/inventarioUtils.js';

export const NotasCreditoModule = {
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

    async anularNotaCredito(id) {
        // Fetch nota
        const { data: nota, error: errN } = await supabase.from('notas_credito').select('*').eq('id', id).single();
        if (errN || !nota) throw new Error("No se encontró la nota de crédito");
        
        // Fetch detalles
        const { data: detalles } = await supabase.from('nota_credito_detalles').select('*').eq('nota_credito_id', id);
        
        // Revertir inventario
        if (detalles && detalles.length > 0) {
            const outItems = detalles.map(d => ({ productoId: d.producto_id, cantidad: d.cantidad }));
            const outRes = await InventarioUtils.procesarSalidaInventario(outItems);
            if (!outRes.success) throw new Error(outRes.error);
        }

        // Anular nota
        const { error: updErr1 } = await supabase.from('notas_credito').update({ estado: 'anulada' }).eq('id', id);
        if (updErr1) throw new Error(updErr1.message);

        // Anular pago
        const { error: updErr2 } = await supabase.from('pagos_ingresos').update({ estado: 'anulado' }).eq('referencia', 'NC-' + nota.numero);
        if (updErr2) throw new Error(updErr2.message);
    },

    async renderList(element) {
        let currentPage = 1;
        let itemsPerPage = 50;
        let searchQuery = '';
        let sortColumn = 'numero';
        let sortDirection = 'desc';
        let kpiDataNC = null;

        const renderGrid = async () => {
            element.innerHTML = `
                <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                    <div class="spinner-border" style="color: #2cbfb7;" role="status"></div>
                </div>
            `;

            if (!kpiDataNC) {
                try {
                    const { data, error } = await supabase.rpc('get_notas_credito_kpis');
                    if (!error && data) {
                        kpiDataNC = {
                            totalAnulada: parseFloat(data.totalAnulada) || 0,
                            totalAplicadas: parseFloat(data.totalAplicadas) || 0,
                            totalPendientes: parseFloat(data.totalPendientes) || 0
                        };
                    } else {
                        kpiDataNC = { totalAnulada: 0, totalAplicadas: 0, totalPendientes: 0 };
                    }
                } catch(e) {
                    kpiDataNC = { totalAnulada: 0, totalAplicadas: 0, totalPendientes: 0 };
                }
            }

            let totalItems = 0;
            let totalPages = 1;
            let currentItems = [];

            try {
                const { data: pageData, error } = await supabase.rpc('get_notas_credito_paginadas', {
                    p_page: currentPage,
                    p_limit: itemsPerPage,
                    p_sort_col: sortColumn,
                    p_sort_dir: sortDirection,
                    p_search: searchQuery
                });

                if (error) throw error;
                
                totalItems = pageData && pageData.length > 0 ? pageData[0].total_count : 0;
                totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
                
                if (currentPage > totalPages && totalPages > 0) {
                    currentPage = totalPages;
                    return renderGrid();
                }

                currentItems = pageData || [];
            } catch (e) {
                console.error("Error cargando notas de credito:", e);
                element.innerHTML = `<div class="p-4 text-danger">Error cargando lista: ${e.message}</div>`;
                return;
            }

            const startIndex = (currentPage - 1) * itemsPerPage;

            const tbodyHtml = currentItems.length > 0 ? currentItems.map(n => {
                let badgeClass = n.estado === 'anulada' ? 'bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle' : 'bg-success text-success bg-opacity-10 border border-success-subtle';
                let labelEstado = n.estado === 'anulada' ? 'Anulada' : 'Aplicada';
                const estadoLabel = `<span class="badge ${badgeClass} rounded-pill fw-medium" style="font-size: 11px; padding: 5px 10px;">${labelEstado}</span>`;
                const opacity = n.estado === 'anulada' ? '0.5' : '1';
                
                return `
                    <tr style="cursor: pointer; opacity: ${opacity}; transition: opacity 0.2s;" onclick="if(!event.target.closest('button')) window.location.hash = '#/ingresos/notas-credito/ver/${n.id}'">
                        <td class="py-3">${n.numero || n.id}</td>
                        <td class="py-3">${n.fecha || ''}</td>
                        <td class="py-3 fw-medium">${n.contacto_nombre || 'Sin cliente'}</td>
                        <td class="py-3 text-end fw-medium">$${Number(n.total || 0).toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                        <td class="py-3 text-center">${estadoLabel}</td>
                        <td class="py-3 text-end" style="position: relative;">
                            <button class="btn btn-link text-muted p-0 btn-menu-row" data-id="${n.id}" data-estado="${n.estado}">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('') : '<tr><td colspan="6" class="text-center py-5 text-muted">No se encontraron notas de crédito</td></tr>';

            element.innerHTML = `
                <div class="dash-layout p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Notas de Crédito</h2>
                            <p class="text-muted mb-0" style="font-size: 14px;">Gestiona las devoluciones y saldos a favor de tus clientes.</p>
                        </div>
                        <button class="btn btn-primary-action" onclick="window.location.hash='#/ingresos/notas-credito/nueva'">
                            <i class="bi bi-plus-lg me-1"></i> Nueva Nota
                        </button>
                    </div>

                    <!-- KPI CARDS NOTAS CREDITO -->
                    <div class="row g-3 mb-4">
                        <div class="col-12 col-sm-6 col-lg-4">
                            <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                                <div class="d-flex justify-content-between align-items-start">
                                    <span class="dash-kpi-label">Notas Aplicadas (este mes)</span>
                                    <div class="dash-icon-box variant-green">
                                        <i class="bi bi-check2-all"></i>
                                    </div>
                                </div>
                                <div class="dash-kpi-value">$ ${Number(kpiDataNC.totalAplicadas).toLocaleString('es-CO', {minimumFractionDigits: 2})}</div>
                            </div>
                        </div>
                        <div class="col-12 col-sm-6 col-lg-4">
                            <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                                <div class="d-flex justify-content-between align-items-start">
                                    <span class="dash-kpi-label">Notas Pendientes (este mes)</span>
                                    <div class="dash-icon-box variant-yellow">
                                        <i class="bi bi-clock-history"></i>
                                    </div>
                                </div>
                                <div class="dash-kpi-value">$ ${Number(kpiDataNC.totalPendientes).toLocaleString('es-CO', {minimumFractionDigits: 2})}</div>
                            </div>
                        </div>
                        <div class="col-12 col-sm-6 col-lg-4">
                            <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                                <div class="d-flex justify-content-between align-items-start">
                                    <span class="dash-kpi-label">Total Anuladas (este mes)</span>
                                    <div class="dash-icon-box variant-red">
                                        <i class="bi bi-x-circle"></i>
                                    </div>
                                </div>
                                <div class="dash-kpi-value">$ ${Number(kpiDataNC.totalAnulada).toLocaleString('es-CO', {minimumFractionDigits: 2})}</div>
                            </div>
                        </div>
                    </div>

                    <div class="dash-table-container">
                        <!-- FILTERS -->
                        <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center" style="border-radius: 8px 8px 0 0;">
                            <div class="input-group input-group-sm" style="width: 250px;">
                                <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                                <input type="text" class="form-control border-start-0 ps-0 text-muted" id="search-input" placeholder="Buscar..." value="${searchQuery}" style="font-size: 13px; box-shadow: none;">
                            </div>
                        </div>

                        <!-- GRID -->
                        <div class="table-responsive">
                            <table class="table table-borderless align-middle mb-0">
                                <thead style="border-bottom: 1px solid var(--border-color);">
                                    <tr style="color: var(--text-muted); font-size: 13px; font-weight: 500;">
                                        <th class="py-3">Número</th>
                                        <th class="py-3">Fecha</th>
                                        <th class="py-3">Cliente</th>
                                        <th class="py-3 text-end">Total</th>
                                        <th class="py-3 text-center">Estado</th>
                                        <th class="py-3 text-end">Acciones</th>
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
            // Búsqueda
            const searchInput = element.querySelector('#search-input');
            if (searchInput) {
                searchInput.focus();
                const val = searchInput.value;
                searchInput.value = '';
                searchInput.value = val;

                let debounceTimer;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        searchQuery = e.target.value;
                        currentPage = 1;
                        renderGrid();
                    }, 400);
                });
            }

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
                const inputPage = element.querySelector('#input-page');
                const max = parseInt(inputPage.max);
                if (currentPage < max) { currentPage++; renderGrid(); }
            });

            // Acciones de Fila
            element.querySelectorAll('.btn-menu-row').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const existing = document.querySelector('.row-action-menu');
                    if (existing) existing.remove();

                    const id = e.currentTarget.dataset.id;
                    const estado = e.currentTarget.dataset.estado;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const isAnulada = estado === 'anulada';
                    
                    const menuHtml = `
                        <div class="row-action-menu position-absolute bg-white shadow rounded border py-2" 
                             style="z-index: 1060; width: 150px; top: ${rect.bottom + window.scrollY}px; left: ${rect.left - 100}px;">
                            <a href="#/ingresos/notas-credito/ver/${id}" class="d-block px-3 py-1 text-decoration-none text-body hover-bg-light" style="font-size: 13px;">Ver Detalle</a>
                            ${!isAnulada ? `
                                <div class="dropdown-divider my-1"></div>
                                <a href="#" class="d-block px-3 py-1 text-decoration-none text-danger hover-bg-light btn-action-anular" data-id="${id}" style="font-size: 13px;">Anular</a>
                            ` : ''}
                        </div>
                    `;
                    document.body.insertAdjacentHTML('beforeend', menuHtml);
                    
                    const menu = document.querySelector('.row-action-menu');
                    
                    if (!isAnulada) {
                        menu.querySelector('.btn-action-anular').addEventListener('click', async (ev) => {
                            ev.preventDefault();
                            menu.remove();
                            if (confirm('¿Estás seguro de anular esta Nota de Crédito? Esto deshará la devolución de inventario y restaurará el saldo pendiente de la factura.')) {
                                try {
                                    CoreActions.showLoadingOverlay?.("Anulando nota de crédito...");
                                    await NotasCreditoModule.anularNotaCredito(id);
                                    if (CoreActions.hideLoadingOverlay) CoreActions.hideLoadingOverlay();
                                    CoreActions.showSuccessModal("Nota de Crédito anulada correctamente.");
                                    
                                    kpiDataNC = null; // Refrescar KPIs
                                    renderGrid();
                                } catch (err) {
                                    if (CoreActions.hideLoadingOverlay) CoreActions.hideLoadingOverlay();
                                    CoreActions.showErrorModal("Error anulando: " + err.message);
                                }
                            }
                        });
                    }

                    const closeMenu = (evt) => {
                        if (menu && !menu.contains(evt.target) && !e.currentTarget.contains(evt.target)) {
                            menu.remove();
                            document.removeEventListener('click', closeMenu);
                        }
                    };
                    document.addEventListener('click', closeMenu);
                });
            });
        };

        renderGrid();
    },

    async renderForm(element, id, isViewOnly) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" style="color: #2cbfb7;" role="status"></div>
            </div>
        `;

        try {
            let nota = null;
            let detallesNota = [];
            let facturaOrigen = null;
            let clienteNombre = '';

            if (id) {
                // Cargar nota existente
                const { data: nData } = await supabase.from('notas_credito').select('*').eq('id', id).single();
                nota = nData;
                
                const { data: detData } = await supabase.from('nota_credito_detalles').select('*').eq('nota_credito_id', id);
                detallesNota = detData || [];

                if (nota && nota.factura_id) {
                    const { data: fData } = await supabase.from('facturas').select('*').eq('id', nota.factura_id).single();
                    facturaOrigen = fData;

                    if (nota.contacto_id) {
                        const { data: cData } = await supabase.from('contactos').select('nombre').eq('id', nota.contacto_id).single();
                        if (cData) clienteNombre = cData.nombre;
                    }
                }
            } else {
                nota = {
                    fecha: getLocalDate(),
                    motivo: 'Devolución de mercancía',
                    total: 0,
                    observaciones: ''
                };
            }

            let productosMap = {};
            const { data: prods } = await supabase.from('productos').select('id, nombre');
            prods?.forEach(p => productosMap[p.id] = p.nombre);

            let headerTitle = id ? (nota.estado === 'anulada' ? 'Nota de Crédito (ANULADA)' : 'Detalle de Nota de Crédito') : 'Nueva Nota de Crédito';
            let headerSubtitle = id ? 'NC-' + (nota.numero || nota.id) : 'Crear documento de devolución';

            let html = `
                <div class="dash-layout p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <button class="btn btn-link text-muted p-0 text-decoration-none mb-2" onclick="window.location.hash='#/ingresos/notas-credito'">
                                <i class="bi bi-arrow-left me-1"></i>Volver a Notas de Crédito
                            </button>
                            <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">${headerTitle}</h2>
                            <p class="text-muted mb-0">${headerSubtitle}</p>
                        </div>
                        ${(id && !isViewOnly && nota.estado !== 'anulada') ? `
                            <button id="btn-anular-nc" class="btn btn-outline-danger bg-white" style="font-weight: 500;">
                                <i class="bi bi-x-circle me-1"></i> Anular Nota de Crédito
                            </button>
                        ` : ''}
                    </div>
            `;

            // Form container
            html += `<div class="dash-table-container mb-4" style="overflow: visible;">
                <div class="card-body p-4">`;

            if (!id) {
                // Modo creación
                html += `
                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <label class="form-label fw-medium text-muted small">Buscar Factura de Venta origen</label>
                            <div class="input-group">
                                <span class="input-group-text bg-light border-end-0"><i class="bi bi-search"></i></span>
                                <input type="number" id="input-buscar-factura" class="form-control border-start-0" placeholder="Ej. 6750">
                                <button id="btn-buscar-factura" class="btn btn-primary-action">Buscar</button>
                            </div>
                            <div id="factura-search-result" class="mt-2 small"></div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-medium text-muted small">Fecha</label>
                            <input type="date" id="nc-fecha" class="form-control" value="${nota.fecha}">
                        </div>
                    </div>
                    <div class="mb-4">
                        <label class="form-label fw-medium text-muted small">Motivo</label>
                        <input type="text" id="nc-motivo" class="form-control" value="${nota.motivo}">
                    </div>
                    
                    <div id="items-container" class="d-none">
                        <h6 class="fw-bold mb-3">Ítems a Devolver</h6>
                        <div class="table-responsive">
                            <table class="table table-borderless align-middle" style="border-spacing: 0; min-width: 600px;">
                                <thead style="border-bottom: 1px solid var(--border-color);">
                                    <tr style="color: var(--text-muted); font-weight: var(--weight-regular); font-size: 13px;">
                                        <th>Producto o servicio</th>
                                        <th class="text-end" style="width: 150px;">Precio Facturado</th>
                                        <th class="text-center" style="width: 150px;">Cant. a Devolver</th>
                                        <th class="text-end" style="width: 150px;">Subtotal NC</th>
                                    </tr>
                                </thead>
                                <tbody id="nc-tbody"></tbody>
                            </table>
                        </div>
                        <div class="d-flex justify-content-end mb-3">
                            <h5 class="fw-bold">Total NC: $<span id="nc-total-display">0.00</span></h5>
                        </div>
                    </div>
                `;
            } else {
                // Modo vista
                html += `
                    <div class="row mb-4">
                        <div class="col-md-4">
                            <small class="text-muted d-block fw-medium mb-1">Cliente</small>
                            <div class="fw-bold fs-6">${clienteNombre || 'N/A'}</div>
                        </div>
                        <div class="col-md-4">
                            <small class="text-muted d-block fw-medium mb-1">Factura Origen</small>
                            <div class="fw-bold fs-6">
                                <a href="#/ingresos/facturas/ver/${facturaOrigen?.id}" class="text-decoration-none">
                                    #${facturaOrigen?.numero || facturaOrigen?.id || 'N/A'}
                                </a>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <small class="text-muted d-block fw-medium mb-1">Fecha & Motivo</small>
                            <div class="fw-bold fs-6">${nota.fecha}</div>
                            <div class="text-muted small">${nota.motivo || ''}</div>
                        </div>
                    </div>
                    
                    <h6 class="fw-bold mb-3">Ítems Devueltos</h6>
                    <div class="table-responsive mb-4">
                        <table class="table table-borderless align-middle" style="border-spacing: 0; min-width: 600px;">
                            <thead style="border-bottom: 1px solid var(--border-color);">
                                <tr style="color: var(--text-muted); font-weight: var(--weight-regular); font-size: 13px;">
                                    <th>Producto o servicio</th>
                                    <th class="text-center" style="width: 100px;">Cant. Devuelta</th>
                                    <th class="text-end" style="width: 150px;">Precio Unit.</th>
                                    <th class="text-end" style="width: 150px;">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${detallesNota.map(d => `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td class="align-top py-2">
                                            <div class="fw-medium text-dark" style="font-size: 13px;">${productosMap[d.producto_id] || 'Ítem ' + d.producto_id}</div>
                                        </td>
                                        <td class="align-top text-center py-2" style="font-size: 13px;">${d.cantidad}</td>
                                        <td class="align-top text-end py-2" style="font-size: 13px;">$${Number(d.precio_unitario || 0).toLocaleString()}</td>
                                        <td class="align-top text-end fw-bold py-2" style="font-size: 13px;">$${Number(d.subtotal || 0).toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="d-flex justify-content-end">
                        <h4 class="fw-bold" style="color: var(--text-main);">Total NC: $${Number(nota.total || 0).toLocaleString()}</h4>
                    </div>
                `;
            }

            html += `</div></div>`; // End form container

            if (!id) {
                html += `
                    <div class="d-flex justify-content-end gap-3 mb-5">
                        <button class="btn btn-outline-secondary px-4 bg-white" onclick="window.location.hash='#/ingresos/notas-credito'">Cancelar</button>
                        <button id="btn-guardar-nc" class="btn btn-primary-action px-5 d-none">Crear Nota de Crédito</button>
                    </div>
                `;
            }

            html += `</div>`;
            element.innerHTML = html;

            // Logica de creación
            if (!id) {
                let currentFactura = null;
                let currentDetalles = [];

                const btnBuscar = element.querySelector('#btn-buscar-factura');
                const btnGuardar = element.querySelector('#btn-guardar-nc');
                const tbody = element.querySelector('#nc-tbody');
                const totalDisplay = element.querySelector('#nc-total-display');
                
                const updateTotals = () => {
                    let sum = 0;
                    element.querySelectorAll('.nc-input-qty').forEach((input, index) => {
                        const qty = parseFloat(input.value) || 0;
                        const maxQty = parseFloat(input.dataset.max) || 0;
                        if (qty > maxQty) input.value = maxQty;
                        if (qty < 0) input.value = 0;
                        
                        const finalQty = parseFloat(input.value) || 0;
                        const price = parseFloat(input.dataset.price) || 0;
                        const sub = finalQty * price;
                        sum += sub;
                        
                        input.closest('tr').querySelector('.nc-subtotal').textContent = sub.toLocaleString();
                    });
                    totalDisplay.textContent = sum.toLocaleString();
                    if (sum > 0) btnGuardar.classList.remove('d-none');
                    else btnGuardar.classList.add('d-none');
                };

                btnBuscar.addEventListener('click', async () => {
                    const numFactura = element.querySelector('#input-buscar-factura').value;
                    const resultDiv = element.querySelector('#factura-search-result');
                    if (!numFactura) return;
                    
                    resultDiv.innerHTML = '<span class="text-muted">Buscando...</span>';
                    
                    try {
                        const { data: facts } = await supabase.from('facturas').select('*').eq('numero', numFactura).eq('tipo', 'venta');
                        if (!facts || facts.length === 0) {
                            resultDiv.innerHTML = '<span class="text-danger fw-medium">No se encontró la factura de venta.</span>';
                            currentFactura = null;
                            element.querySelector('#items-container').classList.add('d-none');
                            btnGuardar.classList.add('d-none');
                            return;
                        }
                        
                        if (facts[0].estado === 'anulada' || facts[0].estado === 'void') {
                            resultDiv.innerHTML = '<span class="text-danger fw-medium">Esta factura está anulada, no se puede generar una nota de crédito sobre ella.</span>';
                            currentFactura = null;
                            element.querySelector('#items-container').classList.add('d-none');
                            btnGuardar.classList.add('d-none');
                            return;
                        }
                        
                        currentFactura = facts[0];
                        
                        // Cargar detalles de la factura
                        const { data: fdets } = await supabase.from('factura_detalles').select('*').eq('factura_id', currentFactura.id);
                        currentDetalles = fdets || [];
                        
                        if (currentDetalles.length === 0) {
                            resultDiv.innerHTML = '<span class="text-warning fw-medium">Factura encontrada pero no tiene ítems guardados.</span>';
                            return;
                        }
                        
                        // Extraer IDs únicos de productos y traer sus nombres y SKUs reales
                        const pIds = [...new Set(currentDetalles.map(d => d.producto_id).filter(Boolean))];
                        let productosFactura = [];
                        if (pIds.length > 0) {
                            const { data: prodsData } = await supabase.from('productos').select('id, sku, nombre').in('id', pIds);
                            if (prodsData) {
                                productosFactura = prodsData;
                            }
                        }

                        let clientName = currentFactura.clienteId;
                        if (currentFactura.contacto_id || currentFactura.clienteId) {
                            const { data: cd } = await supabase.from('contactos').select('nombre').eq('id', currentFactura.contacto_id || currentFactura.clienteId).single();
                            if (cd) clientName = cd.nombre;
                        }

                        resultDiv.innerHTML = `<span class="text-success fw-bold">Factura seleccionada: #${currentFactura.numero} - Cliente: ${clientName} - Total: $${Number(currentFactura.total).toLocaleString()}</span>`;
                        element.querySelector('#items-container').classList.remove('d-none');
                        
                        tbody.innerHTML = currentDetalles.map((d, index) => {
                            const price = parseFloat(d.precio_unitario || d.precio) || 0; // Se lee precio_unitario, fallback a precio
                            
                            // Mockeamos el objeto detalle para ItemEngine
                            const detalleMock = {
                                productoId: d.producto_id,
                                descripcion_personalizada: d.descripcion_personalizada || ''
                            };
                            
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <td class="align-top py-3">
                                        ${ItemEngine.renderProductSearchBox(detalleMock, productosFactura, true)}
                                    </td>
                                    <td class="align-top text-end py-3">
                                        <input type="text" class="form-control form-control-sm border-0 bg-light text-end" value="$${price.toLocaleString()}" disabled>
                                    </td>
                                    <td class="align-top py-3">
                                        <div class="d-flex align-items-center gap-2">
                                            <input type="number" class="form-control form-control-sm border-0 bg-light nc-input-qty text-center" 
                                                   data-index="${index}" data-max="${d.cantidad}" data-price="${price}" data-prodid="${d.producto_id}" 
                                                   value="0" min="0" max="${d.cantidad}" step="1">
                                            <span class="text-muted small text-nowrap">/ ${d.cantidad}</span>
                                        </div>
                                    </td>
                                    <td class="text-end align-top py-3 fw-bold">
                                        $<span class="nc-subtotal">0</span>
                                    </td>
                                </tr>
                            `;
                        }).join('');

                        element.querySelectorAll('.nc-input-qty').forEach(inp => {
                            inp.addEventListener('input', updateTotals);
                        });
                        updateTotals();

                    } catch (e) {
                        resultDiv.innerHTML = `<span class="text-danger">Error: ${e.message}</span>`;
                    }
                });

                btnGuardar.addEventListener('click', async () => {
                    btnGuardar.disabled = true;
                    btnGuardar.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Guardando...';

                    try {
                        let totalNC = 0;
                        const selectedItems = [];
                        
                        element.querySelectorAll('.nc-input-qty').forEach(inp => {
                            const qty = parseFloat(inp.value) || 0;
                            if (qty > 0) {
                                const subtotal = qty * parseFloat(inp.dataset.price);
                                totalNC += subtotal;
                                selectedItems.push({
                                    productoId: inp.dataset.prodid,
                                    cantidad: qty,
                                    precio: inp.dataset.price,
                                    subtotal: subtotal
                                });
                            }
                        });

                        if (selectedItems.length === 0) throw new Error("Debe seleccionar al menos un ítem para devolver.");
                        
                        // 1. Reversión de inventario
                        const invResult = await InventarioUtils.revertirSalidaInventario(selectedItems);
                        if (!invResult.success) throw new Error("Error revirtiendo inventario: " + invResult.error);

                        // 2. Obtener num NC
                        const { data: seqData, error: seqError } = await supabase.rpc('execute_sql', { sql_query: "SELECT nextval('notas_credito_seq');" });
                        let ncNumero = 1;
                        if (!seqError && seqData && seqData.length > 0) {
                            ncNumero = parseInt(seqData[0].nextval);
                        } else {
                            // Si el RPC falla (ej. permisos), hacemos fallback manual (esto puede pasar en bases con RLS restrictivo)
                            const { data: maxNc } = await supabase.from('notas_credito').select('numero').order('numero', { ascending: false }).limit(1);
                            ncNumero = (maxNc && maxNc.length > 0 && maxNc[0].numero) ? maxNc[0].numero + 1 : 1;
                        }

                        // 3. Crear Nota
                        const { data: ncGuardada, error: ncErr } = await supabase.from('notas_credito').insert([{
                            numero: ncNumero,
                            factura_id: currentFactura.id,
                            contacto_id: currentFactura.contacto_id || currentFactura.clienteId,
                            fecha: element.querySelector('#nc-fecha').value,
                            motivo: element.querySelector('#nc-motivo').value,
                            total: totalNC,
                            estado: 'activa'
                        }]).select().single();
                        
                        if (ncErr) throw ncErr;

                        // 4. Crear detalles
                        const detallesArr = selectedItems.map(si => ({
                            nota_credito_id: ncGuardada.id,
                            producto_id: parseInt(si.productoId),
                            cantidad: si.cantidad,
                            precio_unitario: si.precio,
                            subtotal: si.subtotal
                        }));
                        const { error: detErr } = await supabase.from('nota_credito_detalles').insert(detallesArr);
                        if (detErr) throw new Error("Error al guardar detalles de la nota: " + detErr.message);

                        // 5. Inyectar pago cruzado en pagos_ingresos
                        const { error: pagoErr } = await supabase.from('pagos_ingresos').insert([{
                            factura_id: currentFactura.id,
                            fecha: element.querySelector('#nc-fecha').value,
                            monto: totalNC,
                            tipo: 'in', // abono a la factura
                            cuenta_id: null,
                            estado: 'completado',
                            observaciones: 'Pago cruzado por Nota de Crédito #' + ncNumero,
                            referencia: 'NC-' + ncNumero
                        }]);
                        if (pagoErr) throw new Error("Error al cruzar saldo en pagos: " + pagoErr.message);

                        CoreActions.showSuccessModal("Nota de crédito creada con éxito. Inventario revertido.");
                        window.location.hash = '#/ingresos/notas-credito';

                    } catch (e) {
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = 'Crear Nota de Crédito';
                        CoreActions.showErrorModal(e.message);
                    }
                });
            } else if (id && nota.estado !== 'anulada') {
                const btnAnular = element.querySelector('#btn-anular-nc');
                if (btnAnular) {
                    btnAnular.addEventListener('click', async () => {
                        if (confirm('¿Estás seguro de anular esta Nota de Crédito? Esto deshará la devolución de inventario y restaurará el saldo pendiente de la factura.')) {
                            btnAnular.disabled = true;
                            try {
                                // 1. Anular por la función centralizada
                                await this.anularNotaCredito(id);

                                CoreActions.showSuccessModal("Nota de Crédito anulada correctamente.");
                                this.renderForm(element, id, true);
                            } catch (e) {
                                btnAnular.disabled = false;
                                CoreActions.showErrorModal("Error anulando: " + e.message);
                            }
                        }
                    });
                }
            }
        } catch (e) {
            console.error(e);
            element.innerHTML = `<div class="p-4 text-danger">Error: ${e.message}</div>`;
        }
    }
};
