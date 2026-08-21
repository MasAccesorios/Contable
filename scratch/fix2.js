const fs = require('fs');

const path = 'js/modules/gastos/compras.js';
let content = fs.readFileSync(path, 'utf8');

// FIX 1: Export logic
const target1 = `            // Exportar Lista a CSV
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
            }`;

const repl1 = `            // Exportar Lista a CSV
            const btnExportList = element.querySelector('#btn-export-list');
            if (btnExportList) {
                btnExportList.addEventListener('click', async (e) => {
                    const btn = e.currentTarget;
                    const originalHtml = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = \`<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Generando...\`;
                    
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
                            return { 
                                ...f, 
                                estado: f.estado_dinamico, 
                                saldoPendiente: f.saldo_pendiente, 
                                totalPagado: f.total_pagado,
                                cliente_id: f.contacto_id || f.proveedorId || f.contactoId
                            };
                        });
                        
                        const exportIds = allFiltered.map(c => c.proveedorId || c.contacto_id || c.contactoId).filter(Boolean);
                        let exportMap = {};
                        if (exportIds.length > 0) {
                            const { data: edata } = await supabase.from('contactos').select('id, nombre').in('id', exportIds);
                            if (edata) edata.forEach(c => exportMap[c.id] = c.nombre);
                        }
                        const getExportName = (id) => exportMap[id] || 'Sin Proveedor';

                        btn.innerHTML = originalHtml;
                        btn.disabled = false;

                        ExportManager.exportDataToExcel(allDecorated, 'Facturas_Compras', getExportName, btn);
                    } catch(err) { 
                        console.error(err); 
                        btn.innerHTML = originalHtml;
                        btn.disabled = false;
                    }
                });
            }`;

// FIX 2: Date inputs
const target2 = `                            <div class="col-6 col-md-3">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Fecha de creación</label>
                                <input type="date" id="input-fecha" class="form-control form-control-sm text-muted" value="\${factura.fecha}" \${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-6 col-md-3">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Fecha de vencimiento</label>
                                <input type="date" id="input-vencimiento" class="form-control form-control-sm text-muted" value="\${factura.vencimiento}" \${isViewOnly ? 'disabled' : ''}>
                            </div>`;

const repl2 = `                            <div class="col-6 col-md-3">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Fecha de creación</label>
                                <input type="date" id="input-fecha" class="form-control form-control-sm text-muted" value="\${factura.fecha || ''}" \${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-6 col-md-3">
                                <label class="form-label" style="font-size: 12px; font-weight: var(--weight-medium); color: var(--text-body);">Fecha de vencimiento</label>
                                <input type="date" id="input-vencimiento" class="form-control form-control-sm text-muted" value="\${factura.vencimiento || ''}" \${isViewOnly ? 'disabled' : ''}>
                            </div>`;

if (!content.includes(target1)) console.log('Target 1 not found!');
else {
    content = content.replace(target1, repl1);
    console.log('Target 1 fixed');
}

if (!content.includes(target2)) console.log('Target 2 not found!');
else {
    content = content.replace(target2, repl2);
    console.log('Target 2 fixed');
}

fs.writeFileSync(path, content, 'utf8');
