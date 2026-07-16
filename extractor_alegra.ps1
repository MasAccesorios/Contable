$Email = "mauricio.izquierdo@hotmail.com"
$Token = "4be4096858fba53cdc21"
$AuthHeader = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$($Email):$($Token)"))
$BaseUrl = "https://api.alegra.com/api/v1"
$Headers = @{
    "Accept" = "application/json"
    "Authorization" = $AuthHeader
}

Write-Host "=== INICIANDO EXTRACCION MASIVA DE ALEGRA ===" -ForegroundColor Cyan

function Get-AlegraData {
    param([string]$Endpoint)
    $Start = 0
    $Limit = 30
    $AllData = @()
    
    while ($true) {
        Write-Host "[+] Obteniendo $Endpoint (start: $Start)..."
        $Url = "$BaseUrl/$Endpoint`?start=$Start&limit=$Limit"
        
        Start-Sleep -Milliseconds 333 # Rate limit preventivo

        try {
            $Response = Invoke-RestMethod -Uri $Url -Headers $Headers -Method Get
            if ($Response -is [array]) {
                $AllData += $Response
                if ($Response.Count -lt $Limit) { break }
            } else {
                $AllData += $Response
                break
            }
            $Start += $Limit
        } catch {
            if ($_ -match "429") {
                Write-Host "    [!] Limite de API alcanzado (429). Esperando 2 segundos para reintentar..." -ForegroundColor Yellow
                Start-Sleep -Seconds 2
                continue # Reintenta el mismo $Start
            } else {
                Write-Host "    [X] Error en $Endpoint`: $_" -ForegroundColor Red
                break
            }
        }
    }
    return $AllData
}

function Get-DeepItems {
    param([string]$Endpoint, [array]$ItemsList)
    $DeepData = @()
    $Count = $ItemsList.Count
    
    Write-Host "`n[+] Iniciando extraccion profunda de $Count registros en $Endpoint..." -ForegroundColor Yellow
    
    for ($i = 0; $i -lt $Count; $i++) {
        $Item = $ItemsList[$i]
        $Id = $Item.id
        $Current = $i + 1
        Write-Host "    -> Extrayendo ID $Id ($Current/$Count)"
        
        Start-Sleep -Milliseconds 333 # Rate limit
        
        while ($true) {
            try {
                $Detail = Invoke-RestMethod -Uri "$BaseUrl/$Endpoint/$Id" -Headers $Headers -Method Get
                $DeepData += $Detail
                break
            } catch {
                if ($_ -match "429") {
                    Write-Host "    [!] Limite de API alcanzado (429). Esperando 2 segundos para reintentar ID $Id..." -ForegroundColor Yellow
                    Start-Sleep -Seconds 2
                    continue
                } else {
                    Write-Host "    [X] Error obteniendo detalle de ID $Id" -ForegroundColor Red
                    $DeepData += $Item
                    break
                }
            }
        }
    }
    return $DeepData
}

# 1. Extraer todo
$RawProducts = @(Get-AlegraData "items")
$RawClients = @(Get-AlegraData "contacts")
$RawInvoices = @(Get-AlegraData "invoices")
$RawEstimates = @(Get-AlegraData "estimates")

# 2. Extraccion Profunda
$DeepInvoices = @(Get-DeepItems "invoices" $RawInvoices)
$DeepEstimates = @(Get-DeepItems "estimates" $RawEstimates)

Write-Host "`n[+] Formateando estructura JSON final..." -ForegroundColor Cyan

# Formatear Clientes
$FinalClientes = @()
foreach ($c in $RawClients) {
    $Addr = if ($c.address) { $c.address.address } else { "" }
    $FinalClientes += @{
        id_alegra = $c.id
        name = if ($c.name) { $c.name } else { "" }
        identification = if ($c.identification) { $c.identification } else { "" }
        email = if ($c.email) { $c.email } else { "" }
        phone = if ($c.phonePrimary) { $c.phonePrimary } else { "" }
        address = $Addr
    }
}

# Formatear Productos
$FinalProductos = @()
foreach ($p in $RawProducts) {
    $Price = if ($p.price -and $p.price.Count -gt 0) { $p.price[0].price } else { 0 }
    $Cost = if ($p.inventory) { $p.inventory.unitCost } else { 0 }
    $Inv = if ($p.inventory) { $p.inventory.availableQuantity } else { 0 }
    
    $FinalProductos += @{
        id_alegra = $p.id
        name = if ($p.name) { $p.name } else { "" }
        reference = if ($p.reference) { $p.reference } else { "" }
        price = $Price
        cost = $Cost
        inventory = $Inv
    }
}

# Formatear Facturas
$FinalFacturas = @()
foreach ($f in $DeepInvoices) {
    $Items = @()
    if ($f.items) {
        foreach ($i in $f.items) {
            $Items += @{
                id_item_alegra = $i.id
                nombre = $i.name
                precio_unitario = $i.price
                cantidad = $i.quantity
                descuento = $i.discount
                impuesto = $i.tax
                total = $i.total
            }
        }
    }
    
    $FinalFacturas += @{
        id_alegra = $f.id
        numero = if ($f.numberTemplate) { $f.numberTemplate.number } else { $f.id }
        fecha_emision = $f.date
        fecha_vencimiento = $f.dueDate
        cliente_nit = if ($f.client) { $f.client.identification } else { "" }
        cliente_nombre = if ($f.client) { $f.client.name } else { "" }
        cliente_id_alegra = if ($f.client) { $f.client.id } else { "" }
        total = $f.total
        abono = $f.total - ($f.balance | Select-Object -Default 0)
        saldo = if ($f.balance) { $f.balance } else { 0 }
        estado = $f.status
        items = $Items
    }
}

# Formatear Cotizaciones
$FinalCotizaciones = @()
foreach ($e in $DeepEstimates) {
    $Items = @()
    if ($e.items) {
        foreach ($i in $e.items) {
            $Items += @{
                id_item_alegra = $i.id
                nombre = $i.name
                precio_unitario = $i.price
                cantidad = $i.quantity
                descuento = $i.discount
                impuesto = $i.tax
                total = $i.total
            }
        }
    }
    
    $FinalCotizaciones += @{
        id_alegra = $e.id
        numero = if ($e.numberTemplate) { $e.numberTemplate.number } else { $e.id }
        fecha_emision = $e.date
        validez = $e.dueDate
        cliente_nit = if ($e.client) { $e.client.identification } else { "" }
        cliente_nombre = if ($e.client) { $e.client.name } else { "" }
        cliente_id_alegra = if ($e.client) { $e.client.id } else { "" }
        total = $e.total
        estado = $e.status
        items = $Items
    }
}

$FinalData = @{
    clientes = $FinalClientes
    bancos = @()
    productos = $FinalProductos
    facturas = $FinalFacturas
    cotizaciones = $FinalCotizaciones
    pagos = @()
}

Write-Host "[+] Generando archivo alegra_data.js..." -ForegroundColor Cyan
$JsonStr = $FinalData | ConvertTo-Json -Depth 10 -Compress
$JsContent = "// Archivo autogenerado - Extraccion profunda Alegra`nwindow.ALEGRA_SYNC_DATA = $JsonStr;"
[IO.File]::WriteAllText("D:\Contable\js\alegra_data.js", $JsContent, [System.Text.Encoding]::UTF8)

Write-Host "=== EXTRACCION EXITOSA ===" -ForegroundColor Green
Write-Host "El archivo 'js\alegra_data.js' ha sido reemplazado automaticamente con la data profunda."
