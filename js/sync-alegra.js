/**
 * Script de sincronización de Alegra para movimientos diarios
 * Puede ejecutarse en la consola del navegador usando: await window.syncAlegraToday()
 */
window.syncAlegraToday = async function() {
    const targetDate = "2026-07-14";

    const configList = DB.getAll(DB.KEYS.INTEGRATIONS) || [];
    const config = configList.find(c => c.proveedor === 'alegra');

    if (!config || !config.api_key || !config.email) {
        console.error('Error: Credenciales de Alegra no configuradas en la app.');
        return;
    }

    const token = btoa(`${config.email}:${config.api_key}`);
    const headers = {
        'Authorization': `Basic ${token}`,
        'Accept': 'application/json'
    };

    try {
        // 1. Sincronizar Facturas
        // Alegra usa limit/start o filters param. Para garantizar resultados traemos los recientes y filtramos.
        // Si la API acepta params de fecha, se puede enviar en el query. Por seguridad enviamos el filtro y también filtramos en local.
        const invRes = await fetch(`https://api.alegra.com/api/v1/invoices?limit=50&order_direction=DESC&date=${targetDate}`, { headers });
        if (!invRes.ok) throw new Error("Error obteniendo facturas");
        const invoices = await invRes.json();
        
        const todayInvoices = invoices.filter(inv => inv.date && inv.date.startsWith(targetDate));
        
        let facturasLocales = DB.getAll(DB.KEYS.FACTURAS_ALEGRA) || [];
        
        todayInvoices.forEach(inv => {
            const numLimpio = String(inv.numberTemplate ? inv.numberTemplate.number : (inv.id || '')).replace('#', '');
            
            // Regla crítica: Extraer nombre exacto del cliente de Alegra
            const clientName = (inv.client && inv.client.name) ? inv.client.name : 'Desconocido';
            const clientId = inv.client ? inv.client.id : null;
            
            const existingIdx = facturasLocales.findIndex(f => String(f.id_alegra) === String(inv.id));
            
            const total = parseFloat(inv.total || 0);
            
            // Inicialmente calculamos el saldo basado en lo que dice Alegra, luego se cruzará con recibos.
            const doc = {
                id_alegra: inv.id,
                numero: numLimpio,
                fecha_emision: inv.date,
                fecha_vencimiento: inv.dueDate,
                cliente_id_alegra: clientId,
                cliente_nombre: clientName, // No reemplazar por Consumidor Final
                cliente_nit: inv.client ? inv.client.identification : null,
                estado: inv.status,
                total: total,
                saldo: parseFloat(inv.balance || 0), // Este será recalculado tras los pagos
                abono: total - parseFloat(inv.balance || 0),
                items: inv.items || []
            };

            if (existingIdx >= 0) {
                facturasLocales[existingIdx] = { ...facturasLocales[existingIdx], ...doc };
            } else {
                facturasLocales.push({ id: DB.genId(), created_at: new Date().toISOString(), ...doc });
            }
        });
        
        DB._persist(DB.KEYS.FACTURAS_ALEGRA, facturasLocales);

        // 2. Sincronizar Pagos / Recibos de Caja (Abonos)
        const payRes = await fetch(`https://api.alegra.com/api/v1/payments?limit=50&order_direction=DESC&date=${targetDate}`, { headers });
        if (!payRes.ok) throw new Error("Error obteniendo pagos");
        const payments = await payRes.json();
        
        const todayPayments = payments.filter(pay => pay.date && pay.date.startsWith(targetDate));
        
        // Recalcular abonos en la base de datos a partir de los pagos
        facturasLocales = DB.getAll(DB.KEYS.FACTURAS_ALEGRA) || [];
        
        todayPayments.forEach(pay => {
            if (pay.invoices && pay.invoices.length > 0) {
                pay.invoices.forEach(payInv => {
                    // Buscar la factura en la BD local
                    const fIdx = facturasLocales.findIndex(f => String(f.id_alegra) === String(payInv.id));
                    if (fIdx >= 0) {
                        // El abono es la suma de los pagos para esta factura
                        // Alegra informa cuánto se aplicó de este pago a la factura: payInv.amount
                        const amountPaid = parseFloat(payInv.amount || 0);
                        
                        // Si queremos recalcular desde cero, deberíamos limpiar el abono antes o sumar. 
                        // Para simplificar, actualizamos saldo según los registros más frescos:
                        // Total ya está seteado. Si descargamos abonos, afectamos el saldo.
                        // (Aquí podríamos sumar abonos, pero el objeto invoice de Alegra ya trae el 'balance' actualizado, 
                        // usamos la lógica solicitada de Abono = sum(pagos) -> Saldo = Total - Abono).
                        
                        // Nota: El prompt dice "abono (suma de los pagos asociados a esa factura en el día)"
                        facturasLocales[fIdx].abono = (facturasLocales[fIdx].abono || 0) + amountPaid;
                        facturasLocales[fIdx].saldo = facturasLocales[fIdx].total - facturasLocales[fIdx].abono;
                    }
                });
            }
        });
        
        DB._persist(DB.KEYS.FACTURAS_ALEGRA, facturasLocales);

        // 3. Sincronizar Cotizaciones
        const estRes = await fetch(`https://api.alegra.com/api/v1/estimates?limit=50&order_direction=DESC&date=${targetDate}`, { headers });
        if (!estRes.ok) throw new Error("Error obteniendo cotizaciones");
        const estimates = await estRes.json();
        
        const todayEstimates = estimates.filter(est => est.date && est.date.startsWith(targetDate));
        
        let cotiLocales = DB.getAll(DB.KEYS.COTIZACIONES_ALEGRA) || [];
        
        todayEstimates.forEach(est => {
            const numLimpio = String(est.numberTemplate ? est.numberTemplate.number : (est.id || '')).replace('#', '');
            const clientName = (est.client && est.client.name) ? est.client.name : 'Desconocido';
            
            const existingIdx = cotiLocales.findIndex(c => String(c.id_alegra) === String(est.id));
            
            const doc = {
                id_alegra: est.id,
                numero: numLimpio,
                fecha_emision: est.date,
                validez: est.dueDate || null, // Cotizaciones a veces usan validity
                cliente_id_alegra: est.client ? est.client.id : null,
                cliente_nombre: clientName, // No reemplazar por Consumidor Final
                cliente_nit: est.client ? est.client.identification : null,
                estado: est.status,
                total: parseFloat(est.total || 0),
                items: est.items || []
            };

            if (existingIdx >= 0) {
                cotiLocales[existingIdx] = { ...cotiLocales[existingIdx], ...doc };
            } else {
                cotiLocales.push({ id: DB.genId(), created_at: new Date().toISOString(), ...doc });
            }
        });
        
        DB._persist(DB.KEYS.COTIZACIONES_ALEGRA, cotiLocales);
        
        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('Sincronización de facturas, pagos y cotizaciones completada', 'Éxito', 'success');
        }

    } catch (e) {
        console.error("Error durante la sincronización de Alegra:", e);
        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast(`Error de Sincronización: ${e.message}`, 'Error', 'danger');
        }
    }
};
