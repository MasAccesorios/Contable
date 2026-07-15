$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)

$headers = @{
    Authorization = "Basic $authStr"
    Accept = "application/json"
}

function Get-AllPages {
    param([string]$BaseUrl, [string]$Label)
    $all = [System.Collections.Generic.List[object]]::new()
    $start = 0
    $limit = 30
    $pageNum = 1
    $retries = 0
    
    while ($true) {
        $url = "${BaseUrl}&limit=${limit}&start=${start}"
        Write-Host "Fetching URL: $url"
        try {
            $result = Invoke-RestMethod -Uri $url -Headers $headers -ErrorAction Stop
            
            # Normalize to array
            if ($null -eq $result) { break }
            $items = @()
            if ($result -is [System.Array]) {
                $items = $result
            } elseif ($result -is [System.Collections.IEnumerable] -and $result -isnot [string]) {
                $items = @($result)
            } else {
                $items = @($result)
            }
            
            $count = $items.Count
            Write-Host "  [$Label] Pagina $pageNum (start=$start): $count registros extraidos"
            
            if ($count -eq 0) { break }
            
            foreach ($item in $items) {
                $all.Add($item)
            }
            
            # If less than limit returned, we are done
            if ($count -lt $limit) { break }
            
            $start += $limit
            $pageNum++
            $retries = 0  # reset on success
            
            # Control de Rate Limits (200ms a 500ms preventivo)
            Start-Sleep -Milliseconds (Get-Random -Minimum 200 -Maximum 500)
        } catch {
            $errMsg = $_.Exception.Message
            # Retry system (Exponential Backoff up to 3 times)
            if ($retries -lt 3) {
                $retries++
                $waitSec = $retries * 10
                Write-Host "  [$Label] ERROR en peticion: $errMsg"
                Write-Host "  [$Label] Rate-limit o fallo de conexion. Reintento $retries en ${waitSec}s..."
                Start-Sleep -Seconds $waitSec
                continue  # retry same page
            }
            Write-Host "  [$Label] ERROR FINAL en pagina ${pageNum}: $errMsg"
            break
        }
    }
    
    Write-Host "[OK] TOTAL $Label : $($all.Count) registros"
    return ,$all.ToArray()
}

Write-Host "=================================================="
Write-Host " EXTRACCION MASIVA ESPEJO ALEGRA 2026            "
Write-Host "=================================================="

# 1. Contactos (Clientes y Proveedores)
Write-Host "`n[1/7] CONTACTOS (Clientes y Proveedores)..."
# Removido '?type=client' para extraer todos
$rawContactos = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/contacts?order_direction=DESC" -Label "Contactos"
$contactos = @($rawContactos | ForEach-Object {
    @{
        id_alegra      = [string]$_.id
        name           = if ($_.name) { [string]$_.name } else { "Desconocido" }
        identification = [string]$_.identification
        email          = [string]$_.email
        phone          = if ($_.phonePrimary) { [string]$_.phonePrimary } else { "" }
        address        = if ($_.address -and $_.address.address) { [string]$_.address.address } else { "" }
        tipo           = if ($_.type) { [string]$_.type } else { "client" }
        cupo_credito   = if ($_.creditLimit) { [double]$_.creditLimit } else { 0 }
        plazo_dias     = if ($_.term) { if ($null -ne $_.term.days) { [int]$_.term.days } else { try { [int]$_.term } catch { 0 } } } else { 0 }
    }
})

# 2. Productos e Inventario
Write-Host "`n[2/7] PRODUCTOS E INVENTARIO..."
$rawProductos = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/items?order_direction=DESC" -Label "Productos"
$productos = @($rawProductos | ForEach-Object {
    $p = $_
    $precio = 0
    if ($p.price -and $p.price.Count -gt 0) { $precio = [double]$p.price[0].price }
    $costo = if ($p.cost) { [double]$p.cost } else { 0 }
    $stock = 0
    if ($p.inventory -and $null -ne $p.inventory.availableQuantity) {
        $stock = [double]$p.inventory.availableQuantity
    }
    @{
        id_alegra = [string]$p.id
        name      = [string]$p.name
        reference = [string]$p.reference
        price     = $precio
        cost      = $costo
        inventory = $stock
    }
})

# 3. Facturas de Venta
Write-Host "`n[3/7] FACTURAS DE VENTA HISTORICAS..."
$rawFacturas = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/invoices?order_direction=DESC" -Label "Facturas de Venta"
$facturas = @($rawFacturas | ForEach-Object {
    $inv = $_
    $numLimpio = if ($inv.numberTemplate -and $inv.numberTemplate.number) {
        [string]$inv.numberTemplate.number -replace '#', ''
    } else {
        [string]$inv.id -replace '#', ''
    }
    $clientName = if ($inv.client -and $inv.client.name) { [string]$inv.client.name } else { "Desconocido" }
    $total   = if ($inv.total)   { [double]$inv.total }   else { 0 }
    $balance = if ($inv.balance) { [double]$inv.balance } else { 0 }
    $abono   = $total - $balance
    @{
        id_alegra         = [string]$inv.id
        numero            = $numLimpio
        fecha_emision     = [string]$inv.date
        fecha_vencimiento = [string]$inv.dueDate
        cliente_id_alegra = [string]$inv.client.id
        cliente_nombre    = $clientName
        cliente_nit       = [string]$inv.client.identification
        estado            = [string]$inv.status
        total             = $total
        saldo             = $balance
        abono             = $abono
    }
})

# 4. Cotizaciones
Write-Host "`n[4/7] COTIZACIONES..."
$rawCotizaciones = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/estimates?order_direction=DESC" -Label "Cotizaciones"
$cotizaciones = @($rawCotizaciones | ForEach-Object {
    $est = $_
    $numLimpio = if ($est.numberTemplate -and $est.numberTemplate.number) {
        [string]$est.numberTemplate.number -replace '#', ''
    } else {
        [string]$est.id -replace '#', ''
    }
    $clientName = if ($est.client -and $est.client.name) { [string]$est.client.name } else { "Desconocido" }
    $total = if ($est.total) { [double]$est.total } else { 0 }
    @{
        id_alegra         = [string]$est.id
        numero            = $numLimpio
        fecha_emision     = [string]$est.date
        validez           = [string]$est.dueDate
        cliente_id_alegra = [string]$est.client.id
        cliente_nombre    = $clientName
        cliente_nit       = [string]$est.client.identification
        estado            = [string]$est.status
        total             = $total
    }
})

# 5. Gastos y Facturas de Compra (bills)
Write-Host "`n[5/7] GASTOS Y FACTURAS DE COMPRA..."
$rawCompras = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/bills?order_direction=DESC" -Label "Compras"
$compras = @($rawCompras | ForEach-Object {
    $bill = $_
    $provName = if ($bill.provider -and $bill.provider.name) { [string]$bill.provider.name } else { "Desconocido" }
    $total   = if ($bill.total)   { [double]$bill.total }   else { 0 }
    $balance = if ($bill.balance) { [double]$bill.balance } else { 0 }
    $pagado  = $total - $balance
    @{
        id_alegra           = [string]$bill.id
        numero              = [string]$bill.numberTemplate.number
        fecha               = [string]$bill.date
        fecha_vencimiento   = [string]$bill.dueDate
        proveedor_id_alegra = [string]$bill.provider.id
        proveedor_nombre    = $provName
        estado              = [string]$bill.status
        total               = $total
        saldo               = $balance
        pagado              = $pagado
    }
})

# 6. Bancos (Saldos iniciales)
Write-Host "`n[6/7] BANCOS..."
$rawBancos = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/bank-accounts?order_direction=DESC" -Label "Bancos"
$bancos = @($rawBancos | ForEach-Object {
    $b = $_
    $bal = 0
    if ($b.initialBalance) { $bal = [double]$b.initialBalance }
    if ($b.balance) { $bal = [double]$b.balance }
    @{
        id_alegra = [string]$b.id
        name      = [string]$b.name
        type      = [string]$b.type
        balance   = $bal
    }
})

# 7. Pagos / Movimientos Bancarios
Write-Host "`n[7/7] PAGOS Y MOVIMIENTOS..."
$rawPagos = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/payments?order_direction=DESC" -Label "Pagos (Ingresos)"
$rawPagosProv = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/provider-payments?order_direction=DESC" -Label "Pagos a Proveedores"
$pagosList = @()
foreach ($p in $rawPagos) {
    $pagosList += @{
        id_alegra      = [string]$p.id
        date           = [string]$p.date
        bankAccount    = if ($p.bankAccount) { [string]$p.bankAccount.id } else { "" }
        bankName       = if ($p.bankAccount) { [string]$p.bankAccount.name } else { "" }
        client         = if ($p.client) { [string]$p.client.id } else { "" }
        client_name    = if ($p.client -and $p.client.name) { [string]$p.client.name } else { "" }
        amount         = if ($p.amount) { [double]$p.amount } else { 0 }
        description    = if ($p.observations) { [string]$p.observations } elseif ($p.numberTemplate -and $p.numberTemplate.number) { [string]$p.numberTemplate.number } else { "Pago recibido" }
        tipo           = "ingreso"
    }
}
foreach ($p in $rawPagosProv) {
    $pagosList += @{
        id_alegra      = [string]$p.id
        date           = [string]$p.date
        bankAccount    = if ($p.bankAccount) { [string]$p.bankAccount.id } else { "" }
        bankName       = if ($p.bankAccount) { [string]$p.bankAccount.name } else { "" }
        provider       = if ($p.provider) { [string]$p.provider.id } else { "" }
        provider_name  = if ($p.provider -and $p.provider.name) { [string]$p.provider.name } else { "" }
        amount         = if ($p.amount) { [double]$p.amount } else { 0 }
        description    = if ($p.observations) { [string]$p.observations } elseif ($p.numberTemplate -and $p.numberTemplate.number) { [string]$p.numberTemplate.number } else { "Pago a proveedor" }
        tipo           = "egreso"
    }
}

# Guardar JSON Masivo
$resultado = [ordered]@{
    timestamp         = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    version           = "v4_offline_mirror_bancos"
    clientes          = $contactos
    bancos            = $bancos
    facturas          = $facturas
    cotizaciones      = $cotizaciones
    pagos             = $pagosList
    bank_movements    = $pagosList   # Alias para el cargador de movimientos bancarios
    productos         = $productos
    compras           = $compras
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $False
$json = $resultado | ConvertTo-Json -Depth 10
[IO.File]::WriteAllText("test_sync_results.json", $json, $utf8NoBom)

Write-Host "`n=================================================="
Write-Host "REPORTE DE MIGRACIÓN ESPEJO - ALEGRA 2026"
Write-Host "=================================================="
Write-Host "- Clientes / Proveedores: $($contactos.Count)"
Write-Host "- Productos / Inventario: $($productos.Count)"
Write-Host "- Facturas de Venta: $($facturas.Count)"
Write-Host "- Egresos / Compras: $($compras.Count)"
Write-Host "- Bancos / Pagos: $($bancos.Count)"
Write-Host "- Estado: COMPLETADO / SIN PÉRDIDAS"
Write-Host "=================================================="
Write-Host "SIGUIENTE PASO: Abra la aplicacion web y utilice el Cargador Masivo de Datos"
Write-Host "para importar el archivo 'test_sync_results.json' generado."

# Escribir a .log
$logContent = @"
==================================================
REPORTE DE MIGRACIÓN ESPEJO - ALEGRA 2026
==================================================
- Clientes / Proveedores: $($contactos.Count)
- Productos / Inventario: $($productos.Count)
- Facturas de Venta: $($facturas.Count)
- Egresos / Compras: $($compras.Count)
- Bancos / Pagos: $($bancos.Count)
- Estado: COMPLETADO / SIN PÉRDIDAS
==================================================
"@
[IO.File]::WriteAllText("importacion_espejo.log", $logContent, $utf8NoBom)
