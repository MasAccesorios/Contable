/**
 * Extractor Profundo de Alegra a formato alegra_data.js
 * Requiere Node.js 18+ (usa fetch nativo)
 * 
 * Uso: 
 * 1. Reemplaza EMAIL y TOKEN con tus credenciales de Alegra.
 * 2. Ejecuta: node extractor_alegra.js
 */

const fs = require('fs');
const EMAIL = 'tu_correo@ejemplo.com';
const TOKEN = 'tu_token_api_alegra';

const AUTH_HEADER = 'Basic ' + Buffer.from(EMAIL + ':' + TOKEN).toString('base64');
const BASE_URL = 'https://api.alegra.com/api/v1';

const HEADERS = {
    'Accept': 'application/json',
    'Authorization': AUTH_HEADER
};

// Función para paginación automática
async function fetchAll(endpoint) {
    let allData = [];
    let start = 0;
    const limit = 30;
    
    while (true) {
        console.log(`[+] Obteniendo ${endpoint} (start: ${start})...`);
        const res = await fetch(`${BASE_URL}/${endpoint}?start=${start}&limit=${limit}`, { headers: HEADERS });
        
        if (!res.ok) {
            console.error(`Error en ${endpoint}: ${res.statusText}`);
            break;
        }
        
        const data = await res.json();
        allData = allData.concat(data);
        
        if (data.length < limit) break; // Fin de los registros
        start += limit;
    }
    return allData;
}

// Función para obtener el detalle profundo de cada factura/cotización
async function fetchDeepItems(endpoint, itemsList) {
    console.log(`\n[+] Iniciando extracción profunda de ${itemsList.length} registros en ${endpoint}...`);
    const deepData = [];
    
    for (let i = 0; i < itemsList.length; i++) {
        const item = itemsList[i];
        console.log(`    -> Extrayendo ID ${item.id} (${i + 1}/${itemsList.length})`);
        
        // Controlar la cuota de la API (rate limit) de Alegra
        await new Promise(r => setTimeout(r, 333)); // Max 3 req/sec

        const res = await fetch(`${BASE_URL}/${endpoint}/${item.id}`, { headers: HEADERS });
        if (res.ok) {
            const detail = await res.json();
            deepData.push(detail);
        } else {
            console.error(`    [X] Error obteniendo detalle de ID ${item.id}`);
            // Fallback al shallow item si falla el detalle
            deepData.push(item);
        }
    }
    return deepData;
}

async function run() {
    console.log("=== INICIANDO EXTRACCIÓN MASIVA DE ALEGRA ===");
    
    // 1. Extraer Productos
    const rawProducts = await fetchAll('items');
    // 2. Extraer Clientes
    const rawClients = await fetchAll('contacts');
    
    // 3. Extraer Facturas y Cotizaciones (Shallow primero)
    const rawInvoices = await fetchAll('invoices');
    const rawEstimates = await fetchAll('estimates');
    
    // 4. Extracción profunda (Deep fetch) para obtener los arreglos de productos ("items")
    const deepInvoices = await fetchDeepItems('invoices', rawInvoices);
    const deepEstimates = await fetchDeepItems('estimates', rawEstimates);

    // --- FORMATEO ESTRUCTURA ALEGRA_DATA ---
    console.log("\n[+] Formateando estructura JSON final...");
    
    const FINAL_DATA = {
        clientes: rawClients.map(c => ({
            id_alegra: c.id,
            name: c.name || '',
            identification: c.identification || '',
            email: c.email || '',
            phone: c.phonePrimary || '',
            address: c.address ? c.address.address : ''
        })),
        bancos: [], // Si necesitas bancos, extrae de 'bank-accounts'
        productos: rawProducts.map(p => ({
            id_alegra: p.id,
            name: p.name || '',
            reference: p.reference || '',
            price: p.price ? p.price[0].price : 0,
            cost: p.inventory ? p.inventory.unitCost : 0,
            inventory: p.inventory ? p.inventory.availableQuantity : 0
        })),
        facturas: deepInvoices.map(f => ({
            id_alegra: f.id,
            numero: f.numberTemplate ? f.numberTemplate.number : f.id,
            fecha_emision: f.date,
            fecha_vencimiento: f.dueDate,
            cliente_nit: f.client ? f.client.identification : '',
            cliente_nombre: f.client ? f.client.name : '',
            cliente_id_alegra: f.client ? f.client.id : '',
            total: f.total,
            abono: f.total - (f.balance || 0),
            saldo: f.balance || 0,
            estado: f.status,
            items: f.items ? f.items.map(i => ({
                id_item_alegra: i.id,
                nombre: i.name,
                precio_unitario: i.price,
                cantidad: i.quantity,
                descuento: i.discount,
                impuesto: i.tax,
                total: i.total
            })) : []
        })),
        cotizaciones: deepEstimates.map(e => ({
            id_alegra: e.id,
            numero: e.numberTemplate ? e.numberTemplate.number : e.id,
            fecha_emision: e.date,
            validez: e.dueDate,
            cliente_nit: e.client ? e.client.identification : '',
            cliente_nombre: e.client ? e.client.name : '',
            cliente_id_alegra: e.client ? e.client.id : '',
            total: e.total,
            estado: e.status,
            items: e.items ? e.items.map(i => ({
                id_item_alegra: i.id,
                nombre: i.name,
                precio_unitario: i.price,
                cantidad: i.quantity,
                descuento: i.discount,
                impuesto: i.tax,
                total: i.total
            })) : []
        })),
        pagos: []
    };

    // --- ESCRITURA EN DISCO ---
    console.log("[+] Generando archivo alegra_data.js...");
    const jsContent = `// Archivo autogenerado - Extracción profunda Alegra\nwindow.ALEGRA_SYNC_DATA = ${JSON.stringify(FINAL_DATA)};`;
    
    fs.writeFileSync('alegra_data.js', jsContent, 'utf8');
    console.log("=== EXTRACCIÓN EXITOSA ===");
    console.log("Archivo 'alegra_data.js' creado. Cópialo a tu carpeta 'js/' y reemplaza el anterior.");
}

run();
