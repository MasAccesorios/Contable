const fs = require('fs');
const content = fs.readFileSync('js/modules/gastos/compras.js', 'utf8');

const replacement = `
    async renderList(element) {
        element.innerHTML = \`
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; color: #2cbfb7;">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        \`;
        
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
        
        let kpiDataCxp = null;

        // PRELOAD KPIs just once
        try {
            const { data: cxpData } = await supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxp' });
            if (cxpData) {
                let total = 0, vigente = 0, vencido = 0;
                const hoyUTC = Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                cxpData.forEach(f => {
                    const saldo = parseFloat(f.saldo !== undefined ? f.saldo : f.total) || 0;
                    total += saldo;
                    let diasVencida = 0;
                    if (f.vencimiento) {
                        const vDate = new Date(f.vencimiento);
                        const utcVenc = Date.UTC(vDate.getFullYear(), vDate.getMonth(), vDate.getDate());
                        diasVencida = Math.floor((hoyUTC - utcVenc) / (1000 * 60 * 60 * 24));
                    }
                    if (diasVencida >= 1) vencido += saldo;
                    else vigente += saldo;
                });
                kpiDataCxp = { total, vigente, vencido };
            } else {
                kpiDataCxp = { total: 0, vigente: 0, vencido: 0 };
            }
        } catch(e) {
            kpiDataCxp = { total: 0, vigente: 0, vencido: 0 };
        }

        // DRAW STATIC SHELL
        element.innerHTML = \`
                <div class="module-container p-4" style="max-width: 1200px; margin: 0 auto;">
                    <!-- TOP BAR -->
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Facturas de Compra</h2>
                            <p class="text-muted mb-0" style="font-size: 14px;">
                                Gestiona las facturas generadas por compras a tus proveedores. 
                            </p>
                        </div>
                        <div class="d-flex gap-2">
                            <button id="btn-refresh-list" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: 14px; color: var(--text-body);">
                                <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
                            </button>
                            <button id="btn-export-list" class="btn btn-light bg-white border" style="font-weight: var(--weight-medium); font-size: 14px; color: var(--text-body);">
                                <i class="bi bi-download me-1"></i> Exportar
                            </button>
                            <button id="btn-nueva-factura" class="btn text-white" style="background-color: #2cbfb7; font-weight: var(--weight-medium); font-size: 14px;">
                                <i class="bi bi-plus-lg me-1"></i> Nueva factura
                            </button>
                        </div>
                    </div>

                    <!-- KPI CARDS COMPRAS -->
                    <div class="row g-3 mb-4">
                        <div class="col-12 col-sm-6 col-lg-4">
                            <div class="card kpi-card kpi-primary">
                                <div class="kpi-card-body">
                                    <i class="bi bi-wallet2 kpi-icon"></i>
                                    <h6 class="kpi-label">Total por Pagar</h6>
                                    <h5 class="kpi-value">$ \${formatMoney(kpiDataCxp.total).replace('$ ', '')}</h5>
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-sm-6 col-lg-4">
                            <div class="card kpi-card kpi-success">
                                <div class="kpi-card-body">
                                    <i class="bi bi-check-circle kpi-icon"></i>
                                    <h6 class="kpi-label">Cuentas Vigentes</h6>
                                    <h5 class="kpi-value">$ \${formatMoney(kpiDataCxp.vigente).replace('$ ', '')}</h5>
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-sm-6 col-lg-4">
                            <div class="card kpi-card kpi-danger">
                                <div class="kpi-card-body">
                                    <i class="bi bi-exclamation-triangle kpi-icon"></i>
                                    <h6 class="kpi-label">Cuentas Vencidas</h6>
                                    <h5 class="kpi-value">$ \${formatMoney(kpiDataCxp.vencido).replace('$ ', '')}</h5>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- DATA TABLE CARD -->
                    <div class="card border-0" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                        <!-- FILTERS -->
                        <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center" style="border-radius: 8px 8px 0 0;">
                            <div class="input-group input-group-sm position-relative" style="width: 250px;">
                                <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                                <input type="text" class="form-control border-start-0 ps-0 text-muted" id="searchCompras" placeholder="Buscar compras..." autocomplete="off" style="font-size: 13px; box-shadow: none;">
                                <button class="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none d-none" id="clearSearchBtnCompras" style="z-index: 5; padding-right: 10px; font-size: 12px;">
                                    <i class="bi bi-x-circle-fill"></i>
                                </button>
                            </div>
                            <div class="dropdown">
                                <button class="btn btn-link text-decoration-none text-muted p-0 dropdown-toggle" data-bs-toggle="dropdown" style="font-size: 14px;">
                                    <i class="bi bi-funnel me-1"></i> Filtrar <span id="lbl-filtro-actual" style="font-size: 12px; font-weight: 500; color: #2cbfb7;"></span>
                                </button>
                                <ul class="dropdown-menu shadow border-0" style="font-size: 13px;">
                                    <li><a class="dropdown-item filter-opt" href="#" data-criteria="todos">Todos los campos</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item filter-opt" href="#" data-criteria="numero">Por Número</a></li>
                                    <li><a class="dropdown-item filter-opt" href="#" data-criteria="proveedor">Por Proveedor</a></li>
                                    <li><a class="dropdown-item filter-opt" href="#" data-criteria="fecha">Por Fecha de creación</a></li>
                                    <li><a class="dropdown-item filter-opt" href="#" data-criteria="estado">Por Estado</a></li>
                                </ul>
                            </div>
                        </div>

                        <!-- GRID -->
                        <div class="table-responsive">
                            <table class="table table-borderless align-middle mb-0">
                                <thead style="border-bottom: 1px solid var(--border-color);" id="compras-thead">
                                    <tr style="color: var(--text-muted); font-size: 13px; font-weight: var(--weight-medium);">
                                        <th class="py-3 fw-normal sortable-header" data-column="numero" style="cursor: pointer; user-select: none;">Número</th>
                                        <th class="py-3 fw-normal sortable-header" data-column="fecha" style="cursor: pointer; user-select: none;">Creación</th>
                                        <th class="py-3 fw-normal">Vencimiento</th>
                                        <th class="py-3 fw-normal sortable-header" data-column="proveedor" style="cursor: pointer; user-select: none;">Proveedor</th>
                                        <th class="py-3 fw-normal text-end">Total</th>
                                        <th class="py-3 fw-normal text-end">Pagado</th>
                                        <th class="py-3 fw-normal text-end">Por pagar</th>
                                        <th class="py-3 fw-normal text-center">Estado</th>
                                        <th class="py-3 fw-normal text-end" style="width: 80px;"></th>
                                    </tr>
                                </thead>
                                <tbody id="compras-tbody">
                                </tbody>
                            </table>
                        </div>

                        <!-- PAGINATION FOOTER -->
                        <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center" style="border-radius: 0 0 8px 8px;" id="compras-footer">
                        </div>
                    </div>
                </div>
        \`;

        const tbodyElement = element.querySelector('#compras-tbody');
        const theadElement = element.querySelector('#compras-thead');
        const footerElement = element.querySelector('#compras-footer');
        const filterLbl = element.querySelector('#lbl-filtro-actual');

        const updateSortHeaders = () => {
            theadElement.querySelectorAll('.sortable-header').forEach(th => {
                const col = th.dataset.column;
                let text = th.innerText.replace(' ▲', '').replace(' ▼', '');
                if (sortColumn === col) {
                    text += sortDirection === 'asc' ? ' ▲' : ' ▼';
                }
                th.innerText = text;
            });
        };

        const renderGrid = async () => {
            // Spinner while loading
            tbodyElement.innerHTML = \`<tr><td colspan="9" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>\`;

            updateSortHeaders();
            filterLbl.innerText = filterCriteria !== 'todos' ? \`(\${filterCriteria})\` : '';

            try {
                const { data: pageData, error } = await supabase.rpc('get_facturas_con_saldos', {
                    p_page: currentPage,
                    p_limit: itemsPerPage,
                    p_sort_col: sortColumn,
                    p_sort_dir: sortDirection,
                    p_search: searchQuery,
                    p_filter_criteria: filterCriteria,
                    p_tipo: 'compra'
                });
                
                if (error) throw error;
                
                totalItems = pageData && pageData.length > 0 ? pageData[0].total_count : 0;
                totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
                
                if (currentPage > totalPages && totalPages > 0) {
                    currentPage = totalPages;
                    return renderGrid();
                }

                // Resolver nombres de proveedores dinámicamente para la página actual
                const contactoIds = pageData.map(c => c.proveedorId || c.contacto_id || c.contactoId).filter(Boolean);
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
                tbodyElement.innerHTML = \`<tr><td colspan="9" class="text-center py-5 text-danger">Error al cargar datos</td></tr>\`;
                return;
            }

            const tbodyHtml = currentItems.length > 0 ? currentItems.map(c => {
                const estado = c.estado || 'por_pagar';
                let labelEstado = '';
                let badgeClass = '';
                
                let isVencida = false;
                if (c.vencimiento) {
                    const vDate = new Date(c.vencimiento);
                    const hoy = new Date();
                    hoy.setHours(0,0,0,0);
                    if (vDate < hoy) isVencida = true;
                }
                
                if (estado === 'anulada' || estado === 'voided' || estado === 'void') {
                    labelEstado = 'Anulada';
                    badgeClass = 'bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle';
                } else if (c.saldoPendiente <= 0) {
                    labelEstado = 'Pagada';
                    badgeClass = 'bg-primary text-primary bg-opacity-10 border border-primary-subtle';
                } else if (isVencida) {
                    labelEstado = 'Vencida';
                    badgeClass = 'bg-danger text-danger bg-opacity-10 border border-danger-subtle';
                } else {
                    labelEstado = 'Vigente';
                    badgeClass = 'bg-success text-success bg-opacity-10 border border-success-subtle';
                }

                const numDisplay = c.numero || parseInt(String(c.id).replace(/\\D/g, ''), 10) || c.id;
                const rowOpacity = (estado === 'anulada' || estado === 'voided' || estado === 'void') ? '0.5' : '1';
                
                return \`
                    <tr style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body); opacity: \${rowOpacity}; transition: opacity 0.2s;" onclick="if(!event.target.closest('button')) window.location.hash = '#/gastos/proveedores/ver/\${c.id}'">
                        <td class="py-3">\${numDisplay}</td>
                        <td class="py-3">\${c.fecha || ''}</td>
                        <td class="py-3 \${isVencida && c.saldoPendiente > 0 ? 'text-danger fw-semibold' : ''}">\${c.vencimiento || ''}</td>
                        <td class="py-3" style="color: var(--text-main); font-weight: var(--weight-medium);">\${contactosMap[c.proveedorId || c.contacto_id || c.contactoId] || 'Sin Proveedor'}</td>
                        <td class="py-3 text-end">\${formatMoney(c.total)}</td>
                        <td class="py-3 text-end">\${formatMoney(c.totalPagado)}</td>
                        <td class="py-3 text-end fw-bold text-dark">\${formatMoney(c.saldoPendiente)}</td>
                        <td class="py-3 text-center">
                            <span class="badge \${badgeClass} rounded-pill fw-medium" style="font-size: 11px; padding: 5px 10px;">\${labelEstado}</span>
                        </td>
                        <td class="py-3 text-end" style="position: relative;">
                            <button class="btn btn-link text-muted p-0 me-2 btn-imprimir-row" data-id="\${c.id}">
                                <i class="bi bi-printer"></i>
                            </button>
                            <button class="btn btn-link text-muted p-0 btn-menu-row" data-id="\${c.id}">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                        </td>
                    </tr>
                \`;
            }).join('') : \`<tr><td colspan="9" class="text-center py-5 text-muted">No se encontraron facturas</td></tr>\`;

            tbodyElement.innerHTML = tbodyHtml;

            const startIndex = (currentPage - 1) * itemsPerPage;
            footerElement.innerHTML = \`
                <div class="d-flex align-items-center gap-3" style="font-size: 13px; color: var(--text-body);">
                    <div class="d-flex align-items-center gap-2">
                        <span>Resultados por página:</span>
                        <select class="form-select form-select-sm text-muted" id="select-per-page" style="width: 70px;">
                            <option value="10" \${itemsPerPage===10?'selected':''}>10</option>
                            <option value="20" \${itemsPerPage===20?'selected':''}>20</option>
                            <option value="50" \${itemsPerPage===50?'selected':''}>50</option>
                            <option value="100" \${itemsPerPage===100?'selected':''}>100</option>
                        </select>
                    </div>
                    <span class="text-muted border-start ps-3">\${totalItems > 0 ? startIndex + 1 : 0}-\${Math.min(startIndex + itemsPerPage, totalItems)} de \${totalItems}</span>
                </div>

                <div class="d-flex align-items-center gap-2" style="font-size: 13px; color: var(--text-body);">
                    <span>Página</span>
                    <input type="number" id="input-page" class="form-control form-control-sm text-center text-muted" value="\${currentPage}" min="1" max="\${totalPages}" style="width: 50px;">
                    <span>de \${totalPages}</span>
                    <div class="ms-2">
                        <button class="btn btn-link text-muted p-0 me-1" id="btn-prev-page" \${currentPage === 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
                        <button class="btn btn-link text-muted p-0" id="btn-next-page" \${currentPage === totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>
                    </div>
                </div>
            \`;

            bindDynamicEvents();
        };

        const bindStaticEvents = () => {
            const searchInput = element.querySelector('#searchCompras');
            const clearBtn = element.querySelector('#clearSearchBtnCompras');
            let debounceTimer;

            if (searchInput && clearBtn) {
                searchInput.addEventListener('input', (e) => {
                    const val = e.target.value;
                    if (val.length > 0) clearBtn.classList.remove('d-none');
                    else clearBtn.classList.add('d-none');

                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        searchQuery = val.toLowerCase().trim();
                        currentPage = 1;
                        renderGrid();
                    }, 400);
                });

                clearBtn.addEventListener('click', () => {
                    searchInput.value = '';
                    clearBtn.classList.add('d-none');
                    searchInput.focus();
                    searchQuery = '';
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
                    currentPage = 1;
                    renderGrid();
                });
            });

            // Crear Factura
            const btnNuevaFactura = element.querySelector('#btn-nueva-factura');
            if (btnNuevaFactura) {
                btnNuevaFactura.addEventListener('click', () => {
                    window.location.hash = '#/gastos/proveedores/nueva';
                });
            }

            // Exportar Lista a CSV
            const btnExportList = element.querySelector('#btn-export-list');
            if (btnExportList) {
                btnExportList.addEventListener('click', async (e) => {
                    const btn = e.currentTarget;
                    const originalHtml = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = \`<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>\`;
                    
                    try {
                        const { data: allFiltered, error } = await supabase.rpc('get_facturas_con_saldos', {
                            p_page: 1,
                            p_limit: 10000,
                            p_sort_col: sortColumn,
                            p_sort_dir: sortDirection,
                            p_search: searchQuery,
                            p_filter_criteria: filterCriteria,
                            p_tipo: 'compra'
                        });
                        if (error) throw error;
                        
                        const allDecorated = allFiltered.map(f => {
                            return { ...f, estado: f.estado_dinamico, saldoPendiente: f.saldo_pendiente, totalPagado: f.total_pagado };
                        });
                        
                        const exportIds = allFiltered.map(c => c.proveedorId || c.contacto_id || c.contactoId).filter(Boolean);
                        let exportMap = {};
                        if (exportIds.length > 0) {
                            const { data: edata } = await supabase.from('contactos').select('id, nombre').in('id', exportIds);
                            if (edata) edata.forEach(c => exportMap[c.id] = c.nombre);
                        }
                        const getExportName = (id) => exportMap[id] || 'Sin Proveedor';

                        ExportManager.exportDataToExcel(allDecorated, 'Facturas_Compras', getExportName, btn);
                    } catch(err) { console.error(err); }
                    
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                });
            }

            // Actualizar Caché
            const btnRefreshList = element.querySelector('#btn-refresh-list');
            if (btnRefreshList) {
                btnRefreshList.addEventListener('click', async (e) => {
                    const btn = e.currentTarget;
                    const originalHtml = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = \`<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>\`;
                    
                    await renderGrid();
                    
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                });
            }
        };

        const bindDynamicEvents = () => {
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
`;

const startIdx = content.indexOf('    async renderList(element) {');
const endIdx = content.indexOf('            // Row Menu Actions (Popovers Flotantes)', startIdx);

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find start or end block');
    process.exit(1);
}

const newContent = content.substring(0, startIdx) + replacement + content.substring(endIdx + 45); // + 45 skips the "            // Row Menu Actions..." comment
fs.writeFileSync('js/modules/gastos/compras.js', newContent, 'utf8');
