$json = Get-Content test_sync_results.json -Raw
$scriptBlock = @"

// --- AUTO-INJECTED MASSIVE UPDATE ---
DB.initPromise.then(() => {
    console.log('Iniciando actualización masiva inyectada de forma segura...');
    const data = $json;
    let updated = false;

    if (data.facturas && data.facturas.length > 0) {
        let facturasLocales = DB.getAll(DB.KEYS.FACTURAS_ALEGRA) || [];
        data.facturas.forEach(inv => {
            const numLimpio = String(inv.numero || inv.id_alegra).replace('#', '');
            const clientName = (inv.cliente_nombre && inv.cliente_nombre !== '') ? inv.cliente_nombre : 'Desconocido';
            const existingIdx = facturasLocales.findIndex(f => String(f.id_alegra) === String(inv.id_alegra));
            const doc = { ...inv, numero: numLimpio, cliente_nombre: clientName };
            if (existingIdx >= 0) {
                facturasLocales[existingIdx] = { ...facturasLocales[existingIdx], ...doc };
            } else {
                facturasLocales.push({ id: DB.genId(), created_at: new Date().toISOString(), ...doc });
            }
        });
        DB._persist(DB.KEYS.FACTURAS_ALEGRA, facturasLocales);
        console.log(`✓ Masivo: ${data.facturas.length} facturas actualizadas.`);
        updated = true;
    }

    if (data.cotizaciones && data.cotizaciones.length > 0) {
        let cotiLocales = DB.getAll(DB.KEYS.COTIZACIONES_ALEGRA) || [];
        data.cotizaciones.forEach(est => {
            const numLimpio = String(est.numero || est.id_alegra).replace('#', '');
            const clientName = (est.cliente_nombre && est.cliente_nombre !== '') ? est.cliente_nombre : 'Desconocido';
            const existingIdx = cotiLocales.findIndex(c => String(c.id_alegra) === String(est.id_alegra));
            const doc = { ...est, numero: numLimpio, cliente_nombre: clientName };
            if (existingIdx >= 0) {
                cotiLocales[existingIdx] = { ...cotiLocales[existingIdx], ...doc };
            } else {
                cotiLocales.push({ id: DB.genId(), created_at: new Date().toISOString(), ...doc });
            }
        });
        DB._persist(DB.KEYS.COTIZACIONES_ALEGRA, cotiLocales);
        console.log(`✓ Masivo: ${data.cotizaciones.length} cotizaciones actualizadas.`);
        updated = true;
    }
    
    if (updated && typeof App !== 'undefined' && typeof App.loadDashboard === 'function') {
        setTimeout(() => App.loadDashboard(), 500);
    }
});
"@

Add-Content -Path "js\db.js" -Value $scriptBlock -Encoding UTF8
Write-Output "Inyección segura completada."
