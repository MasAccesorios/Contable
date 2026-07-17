(async function() {
    try {
        const configList = DB.getAll(DB.KEYS.INTEGRATIONS) || [];
        const config = configList.find(c => c.proveedor === 'alegra');
        
        if (!config || !config.api_key || !config.email) {
            console.log("No Alegra credentials found.");
            return;
        }

        const token = btoa(`${config.email}:${config.api_key}`);
        const headers = {
            'Authorization': `Basic ${token}`,
            'Accept': 'application/json'
        };

        // 1. Fetch estimates from Alegra
        console.log("Fetching Alegra estimates to find 6749...");
        const estRes = await fetch(`https://api.alegra.com/api/v1/estimates?limit=50&order_direction=DESC`, { headers });
        if (!estRes.ok) return;
        const estimates = await estRes.json();

        // 2. Find 6749
        const target = estimates.find(est => {
            const num = String(est.numberTemplate ? est.numberTemplate.number : (est.id || '')).replace('#', '');
            return num === '6749';
        });

        if (target) {
            console.log(`Found 6749 in Alegra (ID: ${target.id}). Deleting from Alegra...`);
            const delRes = await fetch(`https://api.alegra.com/api/v1/estimates/${target.id}`, {
                method: 'DELETE',
                headers
            });
            if (delRes.ok) {
                console.log("Successfully deleted 6749 from Alegra.");
            } else {
                console.log("Failed to delete from Alegra", await delRes.text());
            }
        }

        // 3. Purge locally
        let cots = DB.getAll(DB.KEYS.COTIZACIONES) || [];
        let cotsAlegra = DB.getAll(DB.KEYS.COTIZACIONES_ALEGRA) || [];
        cots = cots.filter(c => c && String(c.numero) !== '6749');
        cotsAlegra = cotsAlegra.filter(c => c && String(c.numero) !== '6749');
        await DB._persist(DB.KEYS.COTIZACIONES, cots);
        await DB._persist(DB.KEYS.COTIZACIONES_ALEGRA, cotsAlegra);
        
        // Remove self from index.html so it doesn't run again? 
        // Not easily doable from client JS, but it won't hurt if 6749 is gone.
        
        if (App && App.showToast && target) {
            App.showToast("Cotización 6749 eliminada de Alegra permanentemente.", "Éxito", "success");
            setTimeout(() => location.reload(), 1500);
        }

    } catch(e) {
        console.error("Error in delete-alegra-6749:", e);
    }
})();
