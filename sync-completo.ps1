$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)

$headers = @{
    Authorization = "Basic $authStr"
    Accept = "application/json"
}

function Get-AllPages {
    param([string]$BaseUrl, [string]$Label, [int]$MaxRecords = 5000)
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
            Write-Host "  [$Label] Pagina $pageNum (start=$start): $count registros"
            
            if ($count -eq 0) { break }
            
            # Avoid Alegra undocumented pagination rate limit (400 Bad Request)
            Start-Sleep -Seconds 15
            
            foreach ($item in $items) {
                $all.Add($item)
            }
            
            # If less than limit returned, we are done
            if ($count -lt $limit) { break }
            
            # Safety cap
            if ($all.Count -ge $MaxRecords) {
                Write-Host "  [$Label] Limite de seguridad alcanzado: $($all.Count) registros"
                break
            }
            
            $start += $limit
            $pageNum++
            $retries = 0  # reset on success
            Start-Sleep -Milliseconds 2000 # Rate limiting
        } catch {
            $errMsg = $_.Exception.Message
            # If 400 (rate limit), wait and retry up to 3 times
            if ($errMsg -like '*400*' -and $retries -lt 3) {
                $retries++
                $waitSec = $retries * 2
                Write-Host "  [$Label] Rate-limit en pagina ${pageNum}, reintento $retries en ${waitSec}s..."
                Start-Sleep -Seconds $waitSec
                continue  # retry same page
            }
            Write-Host "  [$Label] ERROR en pagina ${pageNum}: $errMsg"
            break
        }
    }
    
    Write-Host "[OK] TOTAL $Label : $($all.Count) registros"
    return ,$all.ToArray()
}

Write-Host "========================================"
Write-Host " SINCRONIZACION MASIVA ALEGRA - v2     "
Write-Host "========================================"

# 1. Clientes
Write-Host "`n[1/6] CLIENTES..."
$rawClientes = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/contacts?type=client" -Label "Clientes" -MaxRecords 1500
$clientes = @($rawClientes | ForEach-Object {
    @{
        id_alegra      = [string]$_.id
        name           = if ($_.name) { [string]$_.name } else { "Desconocido" }
        identification = [string]$_.identification
        email          = [string]$_.email
        phone          = if ($_.phonePrimary) { [string]$_.phonePrimary } else { "" }
        address        = if ($_.address -and $_.address.address) { [string]$_.address.address } else { "" }
    }
})
Write-Host "Clientes mapeados: $($clientes.Count)"

# 2. Bancos
Write-Host "`n[2/6] BANCOS..."
$rawBancos = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/bank-accounts?order_direction=DESC" -Label "Bancos" -MaxRecords 100
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
Write-Host "Bancos mapeados: $($bancos.Count)"

# 3. Facturas (solo las recientes - ultimo año para evitar bucle infinito)
Write-Host "`n[3/6] FACTURAS (ultimas 900 - ultimos meses)..."
$rawFacturas = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/invoices?order_direction=DESC" -Label "Facturas" -MaxRecords 900
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
Write-Host "Facturas mapeadas: $($facturas.Count)"

# 4. Pagos
Write-Host "`n[4/6] PAGOS..."
$rawPagos = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/payments?order_direction=DESC" -Label "Pagos" -MaxRecords 500
$pagos = @($rawPagos | ForEach-Object {
    $pay = $_
    @{
        id_alegra   = [string]$pay.id
        date        = [string]$pay.date
        bankAccount = [string]$pay.bankAccount.id
        bankName    = [string]$pay.bankAccount.name
        client      = [string]$pay.client.id
        amount      = if ($pay.amount) { [double]$pay.amount } else { 0 }
    }
})
Write-Host "Pagos mapeados: $($pagos.Count)"

# 5. Cotizaciones
Write-Host "`n[5/6] COTIZACIONES..."
$rawCotizaciones = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/estimates?order_direction=DESC" -Label "Cotizaciones" -MaxRecords 500
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
Write-Host "Cotizaciones mapeadas: $($cotizaciones.Count)"

# 6. Productos (sin filtro de tipo)
Write-Host "`n[6/6] PRODUCTOS..."
$rawProductos = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/items?order_direction=DESC" -Label "Productos" -MaxRecords 500
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
Write-Host "Productos mapeados: $($productos.Count)"

# Guardar JSON
$resultado = [ordered]@{
    clientes     = $clientes
    bancos       = $bancos
    facturas     = $facturas
    cotizaciones = $cotizaciones
    pagos        = $pagos
    productos    = $productos
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $False
$json = $resultado | ConvertTo-Json -Depth 10
[IO.File]::WriteAllText("test_sync_results.json", $json, $utf8NoBom)

Write-Host "`n========================================"
Write-Host " REPORTE FINAL                          "
Write-Host "========================================"
Write-Host "Clientes:       $($clientes.Count)"
Write-Host "Bancos:         $($bancos.Count)"
Write-Host "Facturas:       $($facturas.Count)"
Write-Host "Cotizaciones:   $($cotizaciones.Count)"
Write-Host "Pagos:          $($pagos.Count)"
Write-Host "Productos:      $($productos.Count)"
Write-Host "Archivo JSON:   test_sync_results.json"
Write-Host "========================================"
Write-Host "SIGUIENTE PASO: Ejecute inject_completo.ps1"
