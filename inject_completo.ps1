
# =========================================================
# INJECT_COMPLETO.PS1 v3 - Genera HTML de carga directa
# Lee test_sync_results.json y genera un archivo HTML
# que el usuario abre UNA VEZ para cargar todo en IndexedDB
# =========================================================

$jsonRaw = [IO.File]::ReadAllText("test_sync_results.json", [System.Text.Encoding]::UTF8)
$data = $jsonRaw | ConvertFrom-Json

# FIX: API de Alegra no retorna 'balance' actual en /bank-accounts y retorna 403 en reportes.
# Se inyectan los saldos manuales provistos por el usuario en la captura para inicializar correctamente.
$manualBalances = @{
    "24" = 125.00
    "23" = 3096112.00
    "22" = 790551.00
    "20" = 3449260.00
    "19" = 1265658.00
    "7"  = 51867901.00
    "1"  = 2580179.00
}

foreach ($banco in $data.bancos) {
    $id = [string]$banco.id_alegra
    if ($manualBalances.ContainsKey($id)) {
        $banco | Add-Member -MemberType NoteProperty -Name "balance" -Value $manualBalances[$id] -Force
    } else {
        $banco | Add-Member -MemberType NoteProperty -Name "balance" -Value 0 -Force
    }
}

$jsonRaw = $data | ConvertTo-Json -Depth 10 -Compress

Write-Host "========================================"
Write-Host " GENERANDO CARGADOR DIRECTO A IndexedDB "
Write-Host "========================================"
Write-Host "Clientes a cargar:     $($data.clientes.Count)"
Write-Host "Bancos a cargar:       $($data.bancos.Count)"
Write-Host "Facturas a cargar:     $($data.facturas.Count)"
Write-Host "Cotizaciones a cargar: $($data.cotizaciones.Count)"
Write-Host "Pagos a cargar:        $($data.pagos.Count)"
Write-Host "Productos a cargar:    $($data.productos.Count)"

$htmlContent = @"
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Cargador Masivo - MAS Accesorios</title>
<style>
  body { font-family: Arial; background: #1a1a2e; color: #eee; display: flex; flex-direction: column; align-items: center; padding: 40px; }
  h1 { color: #e94560; }
  #log { background: #16213e; padding: 20px; border-radius: 8px; width: 100%; max-width: 700px; max-height: 400px; overflow-y: auto; font-family: monospace; font-size: 13px; line-height: 1.6; }
  .ok { color: #00ff88; }
  .err { color: #ff4444; }
  .info { color: #ffcc00; }
  button { margin-top: 20px; padding: 14px 30px; background: #e94560; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; }
  button:disabled { background: #555; cursor: not-allowed; }
</style>
<script>
window.onerror = function(msg, url, lineNo, columnNo, error) {
    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById('log').innerHTML += '<div class="err">CRITICAL JS ERROR: ' + msg + ' at line ' + lineNo + '</div>';
    });
    return false;
};
</script>
</head>
<body>
<h1>&#128202; Cargador Masivo de Datos</h1>
<p>Este archivo carga todos los datos de Alegra directamente en la base de datos local de la app.</p>
<button id="btnCargar" onclick="cargarDatos()">Iniciar Carga Masiva</button>
<div id="log"></div>

<script>
const DATA = $jsonRaw;

function log(msg, tipo) {
    const el = document.getElementById('log');
    el.innerHTML += '<div class="' + (tipo||'info') + '">' + msg + '</div>';
    el.scrollTop = el.scrollHeight;
}

function genId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function cargarDatos() {
    document.getElementById('btnCargar').disabled = true;
    log('Abriendo base de datos IndexedDB...', 'info');
    
    const DB_NAME = 'ContableDB';
    const STORE = 'kv_store';
    
    const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
        };
    });
    
    async function getKey(key) {
        return new Promise((resolve) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(key);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }
    
    async function putKey(key, value) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
    
    function mergeById(existing, newItems, idField) {
        const map = {};
        existing.forEach(e => {
            map[e.id] = e;
        });
        newItems.forEach(n => {
            const existingMatch = Object.values(map).find(e => e[idField] && String(e[idField]) === String(n[idField]));
            if (existingMatch) {
                map[existingMatch.id] = { ...existingMatch, ...n };
            } else {
                const newId = genId();
                map[newId] = { id: newId, created_at: new Date().toISOString(), ...n };
            }
        });
        return Object.values(map);
    }
    
    try {
        // 1. CLIENTES
        log('Cargando clientes...', 'info');
        const clientesExist = await getKey('cg_clients');
        const clientesMapped = DATA.clientes.map(c => ({
            id_alegra: c.id_alegra,
            nombre: c.name,
            identificacion: c.identification,
            email: c.email,
            telefono: c.phone,
            direccion: c.address
        }));
        const clientesFinal = mergeById(Array.isArray(clientesExist) ? clientesExist : [], clientesMapped, 'id_alegra');
        await putKey('cg_clients', clientesFinal);
        log('Clientes cargados: ' + clientesFinal.length + ' registros', 'ok');
        
        // 2. BANCOS
        log('Cargando bancos...', 'info');
        const bancosExist = await getKey('cg_banks');
        const bancosMapped = DATA.bancos.map(b => ({
            id_alegra: b.id_alegra,
            nombre: b.name,
            tipo: b.type,
            saldo_actual: parseFloat(b.balance) || 0
        }));
        const bancosFinal = mergeById(Array.isArray(bancosExist) ? bancosExist : [], bancosMapped, 'id_alegra');
        await putKey('cg_banks', bancosFinal);
        log('Bancos cargados: ' + bancosFinal.length + ' registros', 'ok');
        
        // 3. FACTURAS ALEGRA
        log('Cargando facturas...', 'info');
        const facturasExist = await getKey('cg_facturas_alegra');
        const facturasFinal = mergeById(Array.isArray(facturasExist) ? facturasExist : [], DATA.facturas, 'id_alegra');
        await putKey('cg_facturas_alegra', facturasFinal);
        log('Facturas (Alegra) cargadas: ' + facturasFinal.length + ' registros', 'ok');
        
        // 4. VENTAS (Mapeadas desde facturas)
        log('Integrando facturas en Ventas y Cartera...', 'info');
        const ventasExist = await getKey('cg_sales');
        const carteraExist = await getKey('cg_cartera');
        const ventasMap = {};
        const carteraMap = {};
        (Array.isArray(ventasExist) ? ventasExist : []).forEach(v => { if (v.id_alegra) ventasMap[v.id_alegra] = v; });
        (Array.isArray(carteraExist) ? carteraExist : []).forEach(c => { if (c.id_alegra) carteraMap[c.id_alegra] = c; });
        
        DATA.facturas.forEach(inv => {
            const clientLocal = clientesFinal.find(cl => cl.id_alegra === inv.cliente_id_alegra);
            const localClientId = clientLocal ? clientLocal.id : '';
            const hoy = new Date().toISOString().split('T')[0];
            const vencida = inv.fecha_vencimiento && inv.fecha_vencimiento < hoy;
            const estado = parseFloat(inv.saldo) <= 0 ? 'pagada' : (vencida ? 'vencida' : 'abierta');
            
            if (ventasMap[inv.id_alegra]) {
                Object.assign(ventasMap[inv.id_alegra], { ...inv, cliente_id: localClientId, fecha: inv.fecha_emision, estado });
            } else {
                ventasMap[inv.id_alegra] = { id: genId(), created_at: new Date().toISOString(), ...inv, cliente_id: localClientId, fecha: inv.fecha_emision, estado };
            }
            
            if (parseFloat(inv.saldo) > 0) {
                const cDoc = {
                    id_alegra: inv.id_alegra,
                    venta_id: ventasMap[inv.id_alegra].id,
                    numero: inv.numero,
                    cliente_id: localClientId,
                    cliente_nombre: inv.cliente_nombre,
                    fecha_emision: inv.fecha_emision,
                    fecha_vencimiento: inv.fecha_vencimiento,
                    total: parseFloat(inv.total),
                    abono: parseFloat(inv.abono),
                    saldo: parseFloat(inv.saldo),
                    estado,
                    updated_at: new Date().toISOString()
                };
                if (carteraMap[inv.id_alegra]) { Object.assign(carteraMap[inv.id_alegra], cDoc); }
                else { carteraMap[inv.id_alegra] = { id: genId(), created_at: new Date().toISOString(), ...cDoc }; }
            }
        });
        
        await putKey('cg_sales', Object.values(ventasMap));
        await putKey('cg_cartera', Object.values(carteraMap));
        log('Ventas integradas: ' + Object.values(ventasMap).length + ' registros', 'ok');
        log('Cartera integrada: ' + Object.values(carteraMap).length + ' cuentas por cobrar', 'ok');
        
        // 5. COTIZACIONES ALEGRA
        log('Cargando cotizaciones...', 'info');
        const cotizacionesExist = await getKey('cg_cotizaciones_alegra');
        const cotiFinal = mergeById(Array.isArray(cotizacionesExist) ? cotizacionesExist : [], DATA.cotizaciones, 'id_alegra');
        await putKey('cg_cotizaciones_alegra', cotiFinal);
        
        const cotiNativasExist = await getKey('cg_cotizaciones');
        const cotiNativasMapped = DATA.cotizaciones.map(c => ({
            id_alegra: c.id_alegra,
            numero: c.numero,
            fecha: c.fecha_emision,
            validez: c.validez,
            cliente_nombre: c.cliente_nombre,
            total: parseFloat(c.total),
            estado: c.estado
        }));
        const cotiNativasFinal = mergeById(Array.isArray(cotiNativasExist) ? cotiNativasExist : [], cotiNativasMapped, 'id_alegra');
        await putKey('cg_cotizaciones', cotiNativasFinal);
        log('Cotizaciones cargadas: ' + cotiFinal.length + ' registros', 'ok');
        
        // 6. PRODUCTOS
        if (DATA.productos && DATA.productos.length > 0) {
            log('Cargando productos...', 'info');
            const productosExist = await getKey('cg_products');
            const productosMapped = DATA.productos.map(p => ({
                id_alegra: p.id_alegra,
                nombre: p.name,
                referencia: p.reference,
                precio_venta: parseFloat(p.price) || 0,
                precio_compra: parseFloat(p.cost) || 0,
                stock_actual: parseFloat(p.inventory) || 0
            }));
            const productosFinal = mergeById(Array.isArray(productosExist) ? productosExist : [], productosMapped, 'id_alegra');
            await putKey('cg_products', productosFinal);
            log('Productos cargados: ' + productosFinal.length + ' registros', 'ok');
        }
        
        log('', 'info');
        log('======================================', 'ok');
        log('¡CARGA MASIVA COMPLETADA CON EXITO!', 'ok');
        log('Puedes cerrar esta ventana y recargar', 'ok');
        log('la aplicacion principal (F5).', 'ok');
        log('======================================', 'ok');
        
        document.getElementById('btnCargar').textContent = '¡Listo! Cierra y recarga la app';
        document.getElementById('btnCargar').style.background = '#00c853';
        
    } catch(e) {
        log('ERROR CRITICO: ' + e.message, 'err');
        console.error(e);
    }
}
</script>
</body>
</html>
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding $False
[IO.File]::WriteAllText("cargador-masivo.html", $htmlContent, $utf8NoBom)

Write-Host "`nArchivo 'cargador-masivo.html' generado correctamente."
Write-Host "Pasos siguientes:"
Write-Host "  1. Abre 'cargador-masivo.html' en Chrome"
Write-Host "  2. Haz clic en 'Iniciar Carga Masiva'"
Write-Host "  3. Espera a que diga COMPLETADO"
Write-Host "  4. Cierra esa pestaña y abre index.html"
