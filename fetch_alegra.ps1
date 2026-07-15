$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("$($email):$($apiKey)")
$authStr = [System.Convert]::ToBase64String($authBytes)

$headers = @{
    Authorization = "Basic $authStr"
    Accept = "application/json"
}

# Invoices (No date filter to ensure data is fetched)
$invRes = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/invoices?limit=30&order_direction=DESC" -Headers $headers
$todayInvoices = $invRes

$facturasAlegra = @()
foreach ($inv in $todayInvoices) {
    $numLimpio = if ($inv.numberTemplate) { $inv.numberTemplate.number -replace '#', '' } else { $inv.id -replace '#', '' }
    $clientName = if ($inv.client.name) { $inv.client.name } else { "Desconocido" }
    $total = if ($inv.total) { [float]$inv.total } else { 0 }
    $balance = if ($inv.balance) { [float]$inv.balance } else { 0 }
    
    $doc = @{
        id_alegra = $inv.id
        numero = $numLimpio
        fecha_emision = $inv.date
        fecha_vencimiento = $inv.dueDate
        cliente_id_alegra = $inv.client.id
        cliente_nombre = $clientName
        cliente_nit = $inv.client.identification
        estado = $inv.status
        total = $total
        saldo = $balance
        abono = $total - $balance
        items = $inv.items
    }
    $facturasAlegra += $doc
}

# Payments
$payRes = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/payments?limit=30&order_direction=DESC" -Headers $headers
$todayPayments = $payRes

foreach ($pay in $todayPayments) {
    foreach ($payInv in $pay.invoices) {
        foreach ($f in $facturasAlegra) {
            if ([string]$f.id_alegra -eq [string]$payInv.id) {
                $amountPaid = if ($payInv.amount) { [float]$payInv.amount } else { 0 }
                $f.abono = $f.abono + $amountPaid
                $f.saldo = $f.total - $f.abono
            }
        }
    }
}

# Estimates
$estRes = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/estimates?limit=30&order_direction=DESC" -Headers $headers
$todayEstimates = $estRes

$cotiAlegra = @()
foreach ($est in $todayEstimates) {
    $numLimpio = if ($est.numberTemplate) { $est.numberTemplate.number -replace '#', '' } else { $est.id -replace '#', '' }
    $clientName = if ($est.client.name) { $est.client.name } else { "Desconocido" }
    $total = if ($est.total) { [float]$est.total } else { 0 }
    
    $doc = @{
        id_alegra = $est.id
        numero = $numLimpio
        fecha_emision = $est.date
        validez = $est.dueDate
        cliente_id_alegra = $est.client.id
        cliente_nombre = $clientName
        cliente_nit = $est.client.identification
        estado = $est.status
        total = $total
        items = $est.items
    }
    $cotiAlegra += $doc
}

# Write to JSON
$baseDeDatos = @{
    facturas = $facturasAlegra
    cotizaciones = $cotiAlegra
}

$baseDeDatos | ConvertTo-Json -Depth 10 | Set-Content -Path "test_sync_results.json" -Encoding UTF8
Write-Output "Se ha generado el archivo 'test_sync_results.json' con $($facturasAlegra.Count) facturas y $($cotiAlegra.Count) cotizaciones."
