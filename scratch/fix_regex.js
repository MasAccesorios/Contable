const fs = require('fs');
let content = fs.readFileSync('js/modules/gastos/compras.js', 'utf8');

// Fix 1
let re1 = /btn\.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"><\/span>`;[\s\S]*?ExportManager\.exportDataToExcel\(allDecorated, 'Facturas_Compras', getExportName, btn\);\s+} catch\(err\) { console\.error\(err\); }\s+btn\.innerHTML = originalHtml;\s+btn\.disabled = false;\s+}/;

let repl1 = `btn.innerHTML = \`<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Generando...\`;
                    
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
                }`;

if(re1.test(content)) {
    content = content.replace(re1, repl1);
    console.log('Fix 1 applied via regex');
} else {
    console.log('Fix 1 regex did not match');
}

// Fix 2
let re2 = /value="\$\{factura\.fecha\}"/g;
content = content.replace(re2, 'value="${factura.fecha || \'\'}"');

let re3 = /value="\$\{factura\.vencimiento\}"/g;
content = content.replace(re3, 'value="${factura.vencimiento || \'\'}"');

console.log('Fix 2 applied via replaceAll');

fs.writeFileSync('js/modules/gastos/compras.js', content, 'utf8');
