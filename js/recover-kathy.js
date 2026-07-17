(async function() {
    try {
        let cots = DB.getAll(DB.KEYS.COTIZACIONES) || [];
        
        if (!cots.some(c => String(c.numero) === '6748')) {
            console.log("Restaurando 6748 (Kathy Castillo) localmente...");
            const doc = {
                id: DB.genId(),
                numero: '6748',
                fecha_emision: '2026-07-10',
                validez: '2026-07-25',
                cliente_id: null,
                cliente_nombre: 'Kathy Castillo',
                estado: 'convertida',
                total: 240000,
                subtotal: 240000,
                items: [],
                created_at: new Date().toISOString()
            };
            cots.push(doc);
            await DB._persist(DB.KEYS.COTIZACIONES, cots);
            
            if (App && App.showToast) {
                App.showToast("Cotización 6748 (Kathy Castillo) restaurada localmente.", "Restaurada", "success");
                setTimeout(() => location.reload(), 1500);
            }
        }
    } catch(e) {
        console.error(e);
    }
})();
