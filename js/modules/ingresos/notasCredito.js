import { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions } from '../../shared/crud.js';
import { ItemEngine } from '../../shared/itemEngine.js';
import { InventarioUtils } from '../../shared/inventarioUtils.js';
import { EstadoUtils } from '../../shared/estadoUtils.js';

export const NotasCreditoModule = {
    async init(element) {
        if (!element) return;

        const hashParts = window.location.hash.split('/');
        const action = hashParts[3];
        const id = hashParts[4];

        if (action === 'nueva') {
            await this.renderForm(element, id, false, false);
        } else if (action === 'editar') {
            await this.renderForm(element, id, false, true);
        } else if (action === 'ver') {
            await this.renderForm(element, id, true, false);
        } else {
            await this.renderList(element);
        }
    },

    async anularNotaCredito(id) {
        // 1. Snapshot del estado previo (Cabecera y Pago Cruzado)
        const { data: snapshotNota, error: errN } = await supabase.from('notas_credito').select('*').eq('id', id).single();
        if (errN || !snapshotNota) throw new Error("No se encontró la nota de crédito");
        
        const { data: snapshotPago } = await supabase.from('pagos_ingresos')
            .select('*').eq('referencia', 'NC-' + snapshotNota.numero).single();

        // 2. Fetch detalles para calcular salida de inventario
        const { data: detalles } = await supabase.from('nota_credito_detalles').select('*').eq('nota_credito_id', id);
        
        // 3. FASE 1: Cálculo en memoria (Read-Only)
        let planSalida = null;
        if (detalles && detalles.length > 0) {
            const outItems = detalles.map(d => ({ productoId: d.producto_id, cantidad: d.cantidad }));
            planSalida = await InventarioUtils.calcularSalidaInventario(outItems);
            if (!planSalida.success) throw new Error("No hay stock suficiente para anular la nota de crédito: " + planSalida.error);
        }

        try {
            // 4. FASE 2: Escritura Documental (Update de estado)
            const { error: updErr1 } = await supabase.from('notas_credito').update({ estado: 'anulada' }).eq('id', id);
            if (updErr1) throw new Error(updErr1.message);

            if (snapshotPago) {
                const { error: updErr2 } = await supabase.from('pagos_ingresos').update({ estado: 'anulado' }).eq('id', snapshotPago.id);
                if (updErr2) throw new Error(updErr2.message);
            }

            // 5. FASE 3: Modificación Física de Inventario con rollback interno
            if (planSalida) {
                const origenDoc = 'anulacion_nota_credito:' + snapshotNota.numero;
                await InventarioUtils.ejecutarPlanInventario(planSalida.operacionesDB, origenDoc);
            }

        } catch (errorTransaccion) {
            console.error("Error crítico anulando nota, revirtiendo base de datos...", errorTransaccion);
            // 6. ROLLBACK COMPENSATORIO EXTERNO
            await supabase.from('notas_credito').update({ estado: snapshotNota.estado }).eq('id', id);
            if (snapshotPago) {
                await supabase.from('pagos_ingresos').update({ estado: snapshotPago.estado }).eq('id', snapshotPago.id);
            }
            throw new Error("Error al anular la nota. Se ha revertido la operación por seguridad.");
        }
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
                    <div class="spinner-border" style="color: var(--primary);" role="status"></div>
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
                let badgeClass = EstadoUtils.estaAnulado(n.estado) ? 'bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle' : 'bg-success text-success bg-opacity-10 border border-success-subtle';
                let labelEstado = EstadoUtils.estaAnulado(n.estado) ? 'Anulada' : 'Aplicada';
                const estadoLabel = `<span class="badge ${badgeClass} rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">${labelEstado}</span>`;
                const opacity = EstadoUtils.estaAnulado(n.estado) ? '0.5' : '1';
                
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
                            <p class="text-muted mb-0" style="font-size: var(--fs-md);">Gestiona las devoluciones y saldos a favor de tus clientes.</p>
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
                                <input type="text" class="form-control border-start-0 ps-0 text-muted" id="search-input" placeholder="Buscar..." value="${searchQuery}" style="font-size: var(--fs-base); box-shadow: none;">
                            </div>
                        </div>

                        <!-- GRID -->
                        <div class="table-responsive">
                            <table class="table table-borderless align-middle mb-0">
                                <thead style="border-bottom: 1px solid var(--border-color);">
                                    <tr style="color: var(--text-muted); font-size: var(--fs-base); font-weight: 500;">
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
                    const isAnulada = EstadoUtils.estaAnulado(estado);
                    
                    const menuHtml = `
                        <div class="row-action-menu position-absolute bg-white shadow rounded border py-2" 
                             style="z-index: 1060; width: 150px; top: ${rect.bottom + window.scrollY}px; left: ${rect.left - 100}px;">
                            <a href="#/ingresos/notas-credito/ver/${id}" class="d-block px-3 py-1 text-decoration-none text-body hover-bg-light" style="font-size: var(--fs-base);">Ver Detalle</a>
                            ${!isAnulada ? `
                                <a href="#/ingresos/notas-credito/editar/${id}" class="d-block px-3 py-1 text-decoration-none text-body hover-bg-light" style="font-size: var(--fs-base);">Editar</a>
                                <div class="dropdown-divider my-1"></div>
                                <a href="#" class="d-block px-3 py-1 text-decoration-none text-danger hover-bg-light btn-action-anular" data-id="${id}" style="font-size: var(--fs-base);">Anular</a>
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

                    const botonMenu = e.currentTarget;
                    const closeMenu = (evt) => {
                        if (menu && !menu.contains(evt.target) && !botonMenu.contains(evt.target)) {
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

    async renderForm(element, id, isViewOnly, isEditMode = false) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" style="color: var(--primary);" role="status"></div>
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

            let headerTitle = id ? (EstadoUtils.estaAnulado(nota.estado) ? 'Nota de Crédito (ANULADA)' : 'Detalle de Nota de Crédito') : 'Nueva Nota de Crédito';
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
                        ${(id && !isViewOnly && !EstadoUtils.estaAnulado(nota.estado)) ? `
                            <button id="btn-anular-nc" class="btn btn-outline-danger bg-white" style="font-weight: 500;">
                                <i class="bi bi-x-circle me-1"></i> Anular Nota de Crédito
                            </button>
                        ` : ''}
                    </div>
            `;

            // Form container
            html += `<div class="dash-table-container mb-4" style="overflow: visible;">
                <div class="card-body p-4">`;

            let htmlRecibo = '';

            if (!id || isEditMode) {
                // Modo creación o edición
                html += `
                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <label class="form-label fw-medium text-muted small">${isEditMode ? 'Factura de Venta origen' : 'Buscar Factura de Venta origen'}</label>
                            ${!isEditMode ? `
                            <div class="custom-combobox position-relative" id="combo-factura-container">
                                <div class="input-group">
                                    <span class="input-group-text bg-light border-end-0"><i class="bi bi-search"></i></span>
                                    <input type="text" id="input-buscar-factura" class="form-control border-start-0" placeholder="Buscar por número..." autocomplete="off">
                                    <input type="hidden" id="factura-id-hidden">
                                </div>
                            </div>
                            ` : ''}
                            <div id="factura-search-result" class="mt-2 small">
                                ${isEditMode ? `<span class="text-success fw-bold">Factura asociada: #${facturaOrigen?.numero} - Cliente: ${clienteNombre} - Total: ${Number(facturaOrigen?.total || 0).toLocaleString()}</span>` : ''}
                            </div>
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
                    
                    <div id="items-container" class="${!isEditMode ? 'd-none' : ''}">
                        <h6 class="fw-bold mb-3">Ítems a Devolver</h6>
                        <div class="table-responsive">
                            <table class="table table-borderless align-middle" style="border-spacing: 0; min-width: 600px;">
                                <thead style="border-bottom: 1px solid var(--border-color);">
                                    <tr style="color: var(--text-muted); font-weight: var(--weight-regular); font-size: var(--fs-base);">
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
            } else if (id && isViewOnly) {
                // Modo vista
                let statusBadgeClass = EstadoUtils.estaAnulado(nota.estado) ? 'mas-receipt-status-anulada' : 'mas-receipt-status-aplicada';
                let statusText = EstadoUtils.estaAnulado(nota.estado) ? 'Anulada' : 'Aplicada';
                htmlRecibo = `
                    <style>
                        .mas-receipt-container {
                            font-family: 'Inter', system-ui, -apple-system, sans-serif;
                            color: #1e293b;
                            background: #ffffff;
                            max-width: 800px;
                            margin: 0 auto;
                        }
                        .mas-receipt-card {
                            background: #ffffff;
                            border: 1px solid #e2e8f0;
                            border-radius: 16px;
                            box-shadow: 0 10px 25px rgba(0,0,0,0.05);
                            overflow: hidden;
                            position: relative;
                        }
                        .mas-receipt-header {
                            background: linear-gradient(to right, #f8fafc, #ffffff);
                            border-bottom: 2px dashed #cbd5e1;
                            padding: 10px 20px;
                        }
                        .mas-receipt-body {
                            padding: 10px 20px;
                            overflow: hidden;
                        }
                        .mas-receipt-footer {
                            background: #f8fafc;
                            padding: 10px 20px;
                            border-top: 1px solid #e2e8f0;
                            border-bottom-left-radius: 16px;
                            border-bottom-right-radius: 16px;
                        }
                        .mas-receipt-status-badge {
                            display: inline-block;
                            padding: 4px 10px;
                            border-radius: 999px;
                            font-size: 11px;
                            font-weight: 600;
                            letter-spacing: 0.5px;
                            text-transform: uppercase;
                        }
                        .mas-receipt-status-aplicada { background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
                        .mas-receipt-status-anulada { background-color: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
                        
                        .mas-receipt-info-label {
                            font-size: 10px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            color: #64748b;
                            font-weight: 600;
                            margin-bottom: 2px;
                        }
                        .mas-receipt-info-value {
                            font-size: 13px;
                            font-weight: 500;
                            color: #0f172a;
                        }
                        .mas-receipt-table th {
                            font-size: 11px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            color: #64748b;
                            border-bottom: 1px solid #cbd5e1 !important;
                            padding-bottom: 8px;
                            font-weight: 600;
                        }
                        .mas-receipt-table td {
                            padding: 10px 0;
                            vertical-align: middle;
                            font-size: 13px;
                            color: #334155;
                            border-bottom: 1px solid #f1f5f9 !important;
                        }
                        .mas-receipt-total-row {
                            display: flex;
                            justify-content: flex-end;
                            align-items: baseline;
                            gap: 10px;
                            padding-top: 14px;
                            border-top: 2px solid #059669;
                        }
                        .mas-receipt-total-label {
                            font-size: 12px;
                            color: #64748b;
                            text-transform: uppercase;
                            letter-spacing: 0.6px;
                            font-weight: 600;
                        }
                        .mas-receipt-total-amount {
                            font-size: 26px;
                            font-weight: 800;
                            color: #0f172a;
                            letter-spacing: -0.6px;
                        }
                    </style>
                    <div class="mas-receipt-container" style="padding: 20px;">
                        <div class="mas-receipt-card">
                            <div class="mas-receipt-header d-flex justify-content-between align-items-center">
                                <div><img src="LogoMas.png" alt="MAS Accesorios" style="max-height: 40px; object-fit: contain;"></div>
                                <div class="text-end">
                                    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; letter-spacing: -0.5px;">NOTA DE CRÉDITO</h2>
                                    <div class="d-flex align-items-center justify-content-end gap-3">
                                        <span style="font-size: 13px; color: #64748b; font-weight: 500;">Nº <span style="color: #0f172a; font-weight: 700;">${nota.numero || nota.id}</span></span>
                                        <span class="mas-receipt-status-badge ${statusBadgeClass}">${statusText}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="mas-receipt-body">
                                <div class="row mb-4 mt-2">
                                    <div class="col-6">
                                        <div class="mas-receipt-info-label">CLIENTE</div>
                                        <div class="mas-receipt-info-value">${clienteNombre || 'N/A'}</div>
                                    </div>
                                    <div class="col-6 text-end">
                                        <div class="mas-receipt-info-label">FACTURA ORIGEN</div>
                                        <div class="mas-receipt-info-value">#${facturaOrigen?.numero || facturaOrigen?.id || 'N/A'}</div>
                                    </div>
                                    <div class="col-6 mt-3">
                                        <div class="mas-receipt-info-label">FECHA</div>
                                        <div class="mas-receipt-info-value">${nota.fecha}</div>
                                    </div>
                                    <div class="col-6 mt-3 text-end">
                                        <div class="mas-receipt-info-label">MOTIVO</div>
                                        <div class="mas-receipt-info-value">${nota.motivo || 'N/A'}</div>
                                    </div>
                                </div>
                                <table class="table table-borderless mas-receipt-table mb-4">
                                    <thead>
                                        <tr>
                                            <th class="text-start">PRODUCTO O SERVICIO</th>
                                            <th class="text-center">CANT. DEVUELTA</th>
                                            <th class="text-end">PRECIO UNIT.</th>
                                            <th class="text-end">SUBTOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${detallesNota.map(d => `
                                            <tr>
                                                <td class="text-start fw-medium text-dark">${productosMap[d.producto_id] || 'Ítem ' + d.producto_id}</td>
                                                <td class="text-center">${d.cantidad}</td>
                                                <td class="text-end">$${Number(d.precio_unitario || 0).toLocaleString()}</td>
                                                <td class="text-end fw-bold text-dark">$${Number(d.subtotal || 0).toLocaleString()}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="mas-receipt-footer">
                                <div class="mas-receipt-total-row border-0 pt-0">
                                    <div class="mas-receipt-total-label">TOTAL NC</div>
                                    <div class="mas-receipt-total-amount">$${Number(nota.total || 0).toLocaleString()}</div>
                                </div>
                                <div class="row mt-4 pt-4 border-top" style="border-color: #e2e8f0 !important;">
                                    <div class="col-6">
                                        <div style="border-top: 1px solid #94a3b8; width: 80%; padding-top: 5px; font-size: 11px; color: #64748b; font-weight: 500;">
                                            ELABORADO POR
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div style="border-top: 1px solid #94a3b8; width: 80%; padding-top: 5px; font-size: 11px; color: #64748b; font-weight: 500; margin-left: auto;">
                                            RECIBIDO / ACEPTADO
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            html += `</div></div>`; // End form container

            if (!id || isEditMode) {
                html += `
                    <div class="d-flex justify-content-end gap-3 mb-5">
                        <button class="btn btn-outline-secondary px-4 bg-white" onclick="window.location.hash='#/ingresos/notas-credito'">Cancelar</button>
                        <button id="btn-guardar-nc" class="btn btn-primary-action px-5 ${!isEditMode ? 'd-none' : ''}">${isEditMode ? 'Guardar Cambios' : 'Crear Nota de Crédito'}</button>
                    </div>
                `;
            }

            html += `</div>`;
            element.innerHTML = html;

            if (id && isViewOnly) {
                import('../../shared/printManager.js').then(({ PrintManager }) => {
                    PrintManager._renderPreviewShell(htmlRecibo, { 
                        mode: 'preview', 
                        title: 'Nota de Crédito', 
                        fileName: `NotaCredito_${nota.numero || nota.id}.png`, 
                        printClass: 'formato-media-carta' 
                    });
                    
                    setTimeout(() => {
                        const btnCerrar = document.querySelector('.btn-cerrar-preview');
                        if (btnCerrar) {
                            btnCerrar.addEventListener('click', () => window.location.hash = '#/ingresos/notas-credito');
                        }
                    }, 50);
                });
            }

            // Logica de creación y edición
            if (!id || isEditMode) {
                let currentFactura = isEditMode ? facturaOrigen : null;
                let currentDetalles = [];

                const btnGuardar = element.querySelector('#btn-guardar-nc');
                const tbody = element.querySelector('#nc-tbody');
                const totalDisplay = element.querySelector('#nc-total-display');
                
                
                const updateTotals = () => {
                    let sum = 0;
                    element.querySelectorAll('.nc-input-qty').forEach((input) => {
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
                    else if (!isEditMode) btnGuardar.classList.add('d-none');
                };

                const resultDiv = element.querySelector('#factura-search-result');
                
                if (isEditMode) {
                    const loadEditModeData = async () => {
                        try {
                            const { data: fdets } = await supabase.from('factura_detalles').select('*').eq('factura_id', currentFactura.id);
                            currentDetalles = fdets || [];
                            
                            const pIds = [...new Set(currentDetalles.map(d => d.producto_id).filter(Boolean))];
                            let productosFactura = [];
                            if (pIds.length > 0) {
                                const { data: prodsData } = await supabase.from('productos').select('id, sku, nombre').in('id', pIds);
                                if (prodsData) productosFactura = prodsData;
                            }
                            
                            tbody.innerHTML = currentDetalles.map((d, index) => {
                                const price = parseFloat(d.precio_unitario || d.precio) || 0;
                                const detalleMock = { productoId: d.producto_id, descripcion_personalizada: d.descripcion_personalizada || '' };
                                
                                const existingDetalle = detallesNota.find(dn => dn.producto_id === d.producto_id);
                                const returnedQty = existingDetalle ? existingDetalle.cantidad : 0;
                                
                                return `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td class="align-top py-3">${ItemEngine.renderProductSearchBox(detalleMock, productosFactura, true)}</td>
                                        <td class="align-top text-end py-3">
                                            <input type="text" class="form-control form-control-sm border-0 bg-light text-end" value="${price.toLocaleString()}" disabled>
                                        </td>
                                        <td class="align-top py-3">
                                            <div class="d-flex align-items-center gap-2">
                                                <input type="number" class="form-control form-control-sm border-0 bg-light nc-input-qty text-center" 
                                                       data-index="${index}" data-max="${d.cantidad}" data-price="${price}" data-prodid="${d.producto_id}" 
                                                       value="${returnedQty}" min="0" max="${d.cantidad}" step="1">
                                                <span class="text-muted small text-nowrap">/ ${d.cantidad}</span>
                                            </div>
                                        </td>
                                        <td class="text-end align-top py-3 fw-bold">$<span class="nc-subtotal">${(returnedQty * price).toLocaleString()}</span></td>
                                    </tr>
                                `;
                            }).join('');
                            
                            element.querySelectorAll('.nc-input-qty').forEach(inp => {
                                inp.addEventListener('input', updateTotals);
                            });
                            updateTotals();
                        } catch (err) {
                            console.error("Error loading edit mode data:", err);
                        }
                    };
                    loadEditModeData();
                } else {
                    import('../../shared/combobox.js').then(({ UI }) => {
                    UI.createAsyncCombobox({
                        inputEl: element.querySelector('#input-buscar-factura'),
                        hiddenIdEl: element.querySelector('#factura-id-hidden'),
                        fetchItems: (query) => UI.fetchFacturasCombobox(query),
                        displayProp: 'numero',
                        renderItem: (item) => {
                            const total = item.total ? Number(item.total).toLocaleString() : '0';
                            const cliente = item.cliente_nombre ? item.cliente_nombre : 'Sin Cliente';
                            return `
                                <div class="d-flex flex-column">
                                    <span class="fw-bold text-dark">#${item.numero} - ${cliente}</span>
                                    <span class="text-muted small">Total: $${total}</span>
                                </div>
                            `;
                        },
                        onSelect: async (selectedItem) => {
                            if (!selectedItem) return;
                            
                            resultDiv.innerHTML = '<span class="text-muted">Cargando detalles...</span>';
                            
                            try {
                        if (selectedItem.estado === 'anulada' || selectedItem.estado === 'void') {
                            resultDiv.innerHTML = '<span class="text-danger fw-medium">Esta factura está anulada, no se puede generar una nota de crédito sobre ella.</span>';
                            currentFactura = null;
                            element.querySelector('#items-container').classList.add('d-none');
                            btnGuardar.classList.add('d-none');
                            return;
                        }
                        
                        currentFactura = selectedItem;
                        
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

                        let clientName = currentFactura.cliente_nombre || 'Sin Cliente';
                        
                        // Asegurar que currentFactura tenga contacto_id para btnGuardar
                        if (!currentFactura.contacto_id && !currentFactura.clienteId) {
                            const { data: fData } = await supabase.from('facturas').select('contacto_id').eq('id', currentFactura.id).single();
                            if (fData) {
                                currentFactura.contacto_id = fData.contacto_id;
                            }
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
                        }
                    });
                });
                }

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
                        
                        // Validar saldo
                        const { data: cartera, error: errCartera } = await supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxc' });
                        if (errCartera) throw new Error("Error consultando cartera para validación de saldo: " + errCartera.message);
                        
                        const facturaCartera = cartera?.find(c => c.id === currentFactura.id);
                        const saldoPendienteActual = facturaCartera ? parseFloat(facturaCartera.saldo) : 0;
                        const totalAnterior = isEditMode ? parseFloat(nota.total) : 0;
                        const saldoDisponibleReal = saldoPendienteActual + totalAnterior;
                        
                        if (totalNC > saldoDisponibleReal) {
                            throw new Error(`El total de la Nota de Crédito (${totalNC.toLocaleString()}) supera el saldo disponible de la factura (${saldoDisponibleReal.toLocaleString()}).`);
                        }
                        
                        // 1. FASE 1: Cálculo en memoria (Read-Only)
                        const planReversion = await InventarioUtils.calcularReversionInventario(selectedItems);
                        if (!planReversion.success) throw new Error("Error calculando inventario: " + planReversion.error);

                        // SI ES EDICIÓN: Anular nota existente
                        if (isEditMode) {
                            try {
                                await NotasCreditoModule.anularNotaCredito(id);
                            } catch(e) {
                                throw new Error("Fallo al anular la nota actual antes de editarla: " + e.message);
                            }
                        }

                        // 2. Obtener num NC (si es creación)
                        let ncNumero = isEditMode ? nota.numero : 1;
                        if (!isEditMode) {
                            const { data: seqData, error: seqError } = await supabase.rpc('execute_sql', { sql_query: "SELECT nextval('notas_credito_seq');" });
                            if (!seqError && seqData && seqData.length > 0) {
                                ncNumero = parseInt(seqData[0].nextval);
                            } else {
                                const { data: maxNc } = await supabase.from('notas_credito').select('numero').order('numero', { ascending: false }).limit(1);
                                ncNumero = (maxNc && maxNc.length > 0 && maxNc[0].numero) ? maxNc[0].numero + 1 : 1;
                            }
                        }

                        let ncId = isEditMode ? nota.id : null;
                        let pagoId = null;

                        try {
                            // 3. FASE 2: Escritura Documental Escalona (Segura)
                            
                            // a. Crear/Actualizar Cabecera
                            if (isEditMode) {
                                const { error: ncErr } = await supabase.from('notas_credito').update({
                                    fecha: element.querySelector('#nc-fecha').value,
                                    motivo: element.querySelector('#nc-motivo').value,
                                    total: totalNC,
                                    estado: 'activa'
                                }).eq('id', ncId);
                                if (ncErr) throw new Error("Fallo al actualizar cabecera: " + ncErr.message);
                            } else {
                                const { data: ncGuardada, error: ncErr } = await supabase.from('notas_credito').insert([{
                                    numero: ncNumero,
                                    factura_id: currentFactura.id,
                                    contacto_id: currentFactura.contacto_id || currentFactura.clienteId,
                                    fecha: element.querySelector('#nc-fecha').value,
                                    motivo: element.querySelector('#nc-motivo').value,
                                    total: totalNC,
                                    estado: 'activa'
                                }]).select().single();
                                
                                if (ncErr) throw new Error("Fallo al crear cabecera: " + ncErr.message);
                                ncId = ncGuardada.id;
                            }

                            // b. Crear Detalles
                            if (isEditMode) {
                                await supabase.from('nota_credito_detalles').delete().eq('nota_credito_id', ncId);
                            }
                            const detallesArr = selectedItems.map(si => ({
                                nota_credito_id: ncId,
                                producto_id: parseInt(si.productoId),
                                cantidad: si.cantidad,
                                precio_unitario: si.precio,
                                subtotal: si.subtotal
                            }));
                            const { error: detErr } = await supabase.from('nota_credito_detalles').insert(detallesArr);
                            if (detErr) throw new Error("Error al guardar detalles de la nota: " + detErr.message);

                            // c. Inyectar pago cruzado en pagos_ingresos
                            const { data: pagoCruzado, error: pagoErr } = await supabase.from('pagos_ingresos').insert([{
                                factura_id: currentFactura.id,
                                fecha: element.querySelector('#nc-fecha').value,
                                monto: totalNC,
                                tipo: 'in',
                                cuenta_id: null,
                                estado: 'completado',
                                observaciones: 'Pago cruzado por Nota de Crédito #' + ncNumero,
                                referencia: 'NC-' + ncNumero
                            }]).select().single();
                            if (pagoErr) throw new Error("Error al cruzar saldo en pagos: " + pagoErr.message);
                            pagoId = pagoCruzado.id;

                            // 4. FASE 3: Modificación Física de Inventario con Rollback interno
                            const origenDoc = 'nota_credito:' + ncNumero;
                            await InventarioUtils.ejecutarPlanInventario(planReversion.operacionesDB, origenDoc);

                        } catch (errorTransaccion) {
                            console.error("Fallo crítico en transacción. Revirtiendo creación de nota de crédito...", errorTransaccion);
                            
                            // 5. ROLLBACK COMPENSATORIO EXTERNO
                            if (pagoId) await supabase.from('pagos_ingresos').delete().eq('id', pagoId);

                            if (isEditMode) {
                                throw new Error(`La nota de crédito fue revertida pero la actualización falló. Estado actual: ANULADA. Se requiere revisión manual inmediata. Detalle: ${errorTransaccion.message}`);
                            } else {
                                if (ncId) {
                                    await supabase.from('nota_credito_detalles').delete().eq('nota_credito_id', ncId);
                                    await supabase.rpc('rollback_eliminar_nota_credito', { p_id: ncId });
                                }
                                throw new Error("Transacción fallida. Se abortó la creación y el inventario físico quedó intacto. Detalle: " + errorTransaccion.message);
                            }
                        }

                        CoreActions.showSuccessModal(isEditMode ? "Nota de crédito actualizada con éxito." : "Nota de crédito creada con éxito. Inventario actualizado.");
                        window.location.hash = '#/ingresos/notas-credito';

                    } catch (e) {
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = 'Crear Nota de Crédito';
                        CoreActions.showErrorModal(e.message);
                    }
                });
            }

            const btnAnular = element.querySelector('#btn-anular-nc');
            if (btnAnular) {
                btnAnular.addEventListener('click', async (e) => {
                    e.preventDefault();
                    if (confirm('¿Está seguro que desea anular esta nota de crédito? Esta acción revertirá el saldo y los movimientos de inventario.')) {
                        btnAnular.disabled = true;
                        try {
                            await NotasCreditoModule.anularNotaCredito(id);
                            CoreActions.showSuccessModal("Nota de Crédito anulada correctamente.");
                            window.location.hash = '#/ingresos/notas-credito';
                        } catch (err) {
                            btnAnular.disabled = false;
                            CoreActions.showErrorModal("Error anulando: " + err.message);
                        }
                    }
                });
            }
        } catch (e) {
            console.error(e);
            element.innerHTML = `<div class="p-4 text-danger">Error: ${e.message}</div>`;
        }
    }
};
