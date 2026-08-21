const fs = require('fs');
let content = fs.readFileSync('js/modules/gastos/compras.js', 'utf8');

const target = `            // Imprimir rápido
            element.querySelectorAll('.btn-imprimir-row').forEach(btn => {
            ...t,
            tipo: t.tipo === 'in' ? 'ingreso' : 'egreso'
        }));`;

const replacement = `            // Imprimir rápido
            element.querySelectorAll('.btn-imprimir-row').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = e.currentTarget.dataset.id;
                    const doc = await DB.get('facturas', id);
                    if (doc) {
                        const { data: cList } = await supabase.from('contactos').select('*').limit(2000);
                        const { data: pList } = await supabase.from('productos').select('*').limit(2000);
                        PrintManager.printDocument(doc, 'Factura de Compra', cList, pList);
                    }
                });
            });
        };

        bindStaticEvents();
        await renderGrid();
    },

    async renderForm(element, id = null, isViewOnly = false) {
        const facturaIdTransacciones = id ? [id] : [];
        const { data: rawTransaccionesData } = facturaIdTransacciones.length > 0
            ? await supabase.from('pagos_ingresos').select('*').in('factura_id', facturaIdTransacciones)
            : { data: [] };
            
        // TRADUCCIÓN OBLIGATORIA: El query crudo a Supabase devuelve 'in' / 'out'. 
        // calcularEstadoFactura exige el contrato 'ingreso' / 'egreso'.
        const transacciones = (rawTransaccionesData || []).map(t => ({
            ...t,
            tipo: t.tipo === 'in' ? 'ingreso' : 'egreso'
        }));`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('js/modules/gastos/compras.js', content, 'utf8');
    console.log('Fixed properly');
} else {
    console.log('Target not found');
}
