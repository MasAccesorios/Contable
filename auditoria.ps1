$data = Get-Content test_sync_results.json -Raw | ConvertFrom-Json
Write-Host "=== AUDITORIA DE test_sync_results.json ==="
Write-Host "Clientes:     " $data.clientes.Count
Write-Host "Bancos:       " $data.bancos.Count
Write-Host "Facturas:     " $data.facturas.Count
Write-Host "Cotizaciones: " $data.cotizaciones.Count
Write-Host "Pagos:        " $data.pagos.Count
Write-Host "Productos:    " $data.productos.Count
Write-Host ""
Write-Host "=== DETALLE BANCOS ==="
$data.bancos | ForEach-Object { Write-Host "  ID_Alegra:" $_.id_alegra "| Nombre:" $_.name "| Balance:" $_.balance }
Write-Host ""
Write-Host "=== EJEMPLO FACTURAS (primeras 3) ==="
$data.facturas | Select-Object -First 3 | ForEach-Object { Write-Host "  ID:" $_.id_alegra "| Num:" $_.numero "| Cliente:" $_.cliente_nombre "| Total:" $_.total "| Saldo:" $_.saldo "| Abono:" $_.abono }
