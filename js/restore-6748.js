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
        console.log("Restaurando cotización 6748 desde Alegra...");
        // Buscamos hasta 100 para asegurarnos de que la encontramos (del 10 de julio)
        const estRes = await fetch(`https://api.alegra.com/api/v1/estimates?limit=100&order_direction=DESC`, { headers });
        if (!estRes.ok) return;
        const estimates = await estRes.json();

        // 2. Find 6748
        const target = estimates.find(est => {
            const num = String(est.numberTemplate ? est.numberTemplate.number : (est.id || '')).replace('#', '');
            return num === '6748';
        });

        if (target) {
            console.log(`Encontrada 6748 en Alegra (ID: ${target.id}). Restaurando localmente...`);
            let cotsAlegra = DB.getAll(DB.KEYS.COTIZACIONES_ALEGRA) || [];
            
            // Asegurarnos de que no exista ya para no duplicarla
            if (!cotsAlegra.some(c => String(c.numero) === '6748')) {
                const clientName = (target.client && target.client.name) ? target.client.name : 'Desconocido';
                const doc = {
                    id: DB.genId(),
                    id_alegra: target.id,
                    numero: '6748',
                    fecha_emision: target.date,
                    validez: target.dueDate || null,
                    cliente_id_alegra: target.client ? target.client.id : null,
                    cliente_nombre: clientName,
                    cliente_nit: target.client ? target.client.identification : null,
                    estado: target.status,
                    total: parseFloat(target.total || 0),
                    items: target.items || [],
                    created_at: new Date().toISOString()
                };
                
                cotsAlegra.push(doc);
                await DB._persist(DB.KEYS.COTIZACIONES_ALEGRA, cotsAlegra);
                console.log("6748 restaurada con éxito.");
                if (App && App.showToast) {
                    App.showToast("Cotización 6748 restaurada desde Alegra.", "Restaurada", "success");
                    setTimeout(() => location.reload(), 2000);
                }
            }
        } else {
            console.log("No se pudo encontrar la 6748 en Alegra. Puede que sea más antigua o no exista.");
        }

    } catch(e) {
        console.error("Error restaurando 6748:", e);
    }
})();
