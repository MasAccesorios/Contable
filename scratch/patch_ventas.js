const fs = require('fs');

// PATCH ventas.js
let ventasText = fs.readFileSync('js/modules/ventas/ventas.js', 'utf8');

const targetVentas = `            // Exportar Lista a CSV (descarga completa de filtros actuales)
            element.querySelector('#btn-export-list')?.addEventListener('click', async (e) => {
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

                    ExportManager.exportDataToExcel(allDecorated, 'Facturas', getExportName, btn);
                } catch(err) { console.error(err); }
                
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            });`;

const replVentas = `            // Exportar Lista a CSV (descarga completa de filtros actuales)
            element.querySelector('#btn-export-list')?.addEventListener('click', async (e) => {
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
            });`;

const safeReplace = (content, target, repl) => {
    let t = target.replace(/\r/g, '');
    let r = repl.replace(/\r/g, '');
    let c = content.replace(/\r/g, '');
    if (c.includes(t)) {
        return c.replace(t, r);
    }
    return null;
};

let vResult = safeReplace(ventasText, targetVentas, replVentas);
if (vResult) {
    fs.writeFileSync('js/modules/ventas/ventas.js', vResult, 'utf8');
    console.log("ventas.js patched successfully.");
} else {
    console.error("ventas.js patch failed.");
}


// PATCH crud.js
let crudText = fs.readFileSync('js/shared/crud.js', 'utf8');

const targetCrud = `                            'Estado': item.estado || 'Activo'
                        };
                    }

                    const clienteNombre = getClienteNameFunc ? getClienteNameFunc(item.clienteId || item.cliente_id) : (item.clienteId || item.cliente_id || 'N/A');`;

const replCrud = `                            'Estado': item.estado || 'Activo'
                        };
                    }
                    
                    if (tipoModulo === 'Facturas' || tipoModulo === 'Facturas_Compras') {
                        const contactoId = item.contacto_id || item.proveedorId || item.clienteId || item.cliente_id;
                        const clienteNombre = getClienteNameFunc ? getClienteNameFunc(contactoId) : (contactoId || 'Sin Contacto');
                        
                        let estadoReal = item.estado || item.estado_dinamico || 'Pendiente';
                        if (estadoReal === 'por_pagar') estadoReal = 'Pendiente';
                        
                        return {
                            'Número de Documento': item.numero || item.id,
                            'Cliente/Proveedor': clienteNombre,
                            'Fecha de Creación': item.fecha || '',
                            'Fecha de Vencimiento': item.vencimiento || '',
                            'Valor Total': formatMoney(item.total),
                            'Total Pagado': formatMoney(item.totalPagado || item.total_pagado),
                            'Saldo Pendiente': formatMoney(item.saldoPendiente || item.saldo_pendiente),
                            'Estado Actual': estadoReal
                        };
                    }

                    const clienteNombre = getClienteNameFunc ? getClienteNameFunc(item.clienteId || item.cliente_id) : (item.clienteId || item.cliente_id || 'N/A');`;

let cResult = safeReplace(crudText, targetCrud, replCrud);
if (cResult) {
    fs.writeFileSync('js/shared/crud.js', cResult, 'utf8');
    console.log("crud.js patched successfully.");
} else {
    console.error("crud.js patch failed.");
}
