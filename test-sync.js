/**
 * Script de prueba para sincronizar con Alegra desde Node.js (Terminal)
 * Ejecutar con: node test-sync.js
 */

// Si estás usando Node v18+, 'fetch' es nativo.
// Configuramos la fecha objetivo solicitada.
const targetDate = "2026-07-14";

// 1. Configurar credenciales (Puedes reemplazar los strings o usar variables de entorno)
const email = process.env.ALEGRA_EMAIL || 'mauricio.izquierdo@hotmail.com';
const apiKey = process.env.ALEGRA_API_KEY || '4be4096858fba53cdc21';

if (email === 'tu_correo@ejemplo.com' || apiKey === 'tu_api_key') {
    console.warn("⚠️ ADVERTENCIA: Usando credenciales de prueba. Asegúrate de configurar ALEGRA_EMAIL y ALEGRA_API_KEY en tu entorno o en el script.");
}

const token = Buffer.from(`${email}:${apiKey}`).toString('base64');
const headers = {
    'Authorization': `Basic ${token}`,
    'Accept': 'application/json'
};

// Objeto simulado para guardar los datos en memoria en Node
const BaseDeDatosLocal = {
    facturas: [],
    cotizaciones: []
};

async function syncAlegraTodayNode() {
    console.log(`\nIniciando sincronización de prueba en Node.js (Día: ${targetDate})...`);

    try {
        // 1. Sincronizar Facturas
        console.log("-> Descargando facturas de Alegra...");
        const invRes = await fetch(`https://api.alegra.com/api/v1/invoices?limit=50&order_direction=DESC&date=${targetDate}`, { headers });
        if (!invRes.ok) throw new Error(`Error obteniendo facturas: ${invRes.statusText}`);
        const invoices = await invRes.json();
        
        const todayInvoices = invoices.filter(inv => inv.date && inv.date.startsWith(targetDate));
        
        todayInvoices.forEach(inv => {
            const numLimpio = String(inv.numberTemplate ? inv.numberTemplate.number : inv.id).replace('#', '');
            const clientName = (inv.client && inv.client.name) ? inv.client.name : 'Desconocido';
            const total = parseFloat(inv.total || 0);
            
            BaseDeDatosLocal.facturas.push({
                id_alegra: inv.id,
                numero: numLimpio,
                fecha_emision: inv.date,
                cliente_nombre: clientName,
                estado: inv.status,
                total: total,
                saldo: parseFloat(inv.balance || 0),
                abono: total - parseFloat(inv.balance || 0)
            });
        });
        console.log(`✓ [Éxito] Se procesaron y guardaron en memoria ${todayInvoices.length} facturas de venta.`);

        // 2. Sincronizar Pagos / Recibos de Caja (Abonos)
        console.log("-> Descargando pagos/recibos de Alegra...");
        const payRes = await fetch(`https://api.alegra.com/api/v1/payments?limit=50&order_direction=DESC&date=${targetDate}`, { headers });
        if (!payRes.ok) throw new Error(`Error obteniendo pagos: ${payRes.statusText}`);
        const payments = await payRes.json();
        
        const todayPayments = payments.filter(pay => pay.date && pay.date.startsWith(targetDate));
        
        todayPayments.forEach(pay => {
            if (pay.invoices && pay.invoices.length > 0) {
                pay.invoices.forEach(payInv => {
                    const localFactura = BaseDeDatosLocal.facturas.find(f => String(f.id_alegra) === String(payInv.id));
                    if (localFactura) {
                        const amountPaid = parseFloat(payInv.amount || 0);
                        localFactura.abono = (localFactura.abono || 0) + amountPaid;
                        localFactura.saldo = localFactura.total - localFactura.abono;
                    }
                });
            }
        });
        console.log(`✓ [Éxito] Se procesaron y cruzaron ${todayPayments.length} pagos contra las facturas.`);

        // 3. Sincronizar Cotizaciones
        console.log("-> Descargando cotizaciones de Alegra...");
        const estRes = await fetch(`https://api.alegra.com/api/v1/estimates?limit=50&order_direction=DESC&date=${targetDate}`, { headers });
        if (!estRes.ok) throw new Error(`Error obteniendo cotizaciones: ${estRes.statusText}`);
        const estimates = await estRes.json();
        
        const todayEstimates = estimates.filter(est => est.date && est.date.startsWith(targetDate));
        
        todayEstimates.forEach(est => {
            const numLimpio = String(est.numberTemplate ? est.numberTemplate.number : est.id).replace('#', '');
            const clientName = (est.client && est.client.name) ? est.client.name : 'Desconocido';
            
            BaseDeDatosLocal.cotizaciones.push({
                id_alegra: est.id,
                numero: numLimpio,
                fecha_emision: est.date,
                cliente_nombre: clientName,
                estado: est.status,
                total: parseFloat(est.total || 0)
            });
        });
        console.log(`✓ [Éxito] Se procesaron y guardaron en memoria ${todayEstimates.length} cotizaciones.`);
        
        console.log("\n================ RESUMEN DE LA PRUEBA ================");
        console.log(`- Facturas locales guardadas: ${BaseDeDatosLocal.facturas.length}`);
        console.log(`- Cotizaciones locales guardadas: ${BaseDeDatosLocal.cotizaciones.length}`);
        console.log("Nota: Estos registros han sido mapeados correctamente y están listos para ser persistidos (ej. en js/db.js o guardados en un JSON si así se requiere).");
        console.log("========================================================\n");

    } catch (e) {
        console.error("\n❌ Error durante la sincronización desde Node:");
        console.error(e.message);
    }
}

// Ejecutar script
syncAlegraTodayNode();
