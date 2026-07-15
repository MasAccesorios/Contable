$d = Get-Content test_sync_results.json | ConvertFrom-Json
Write-Host "Clientes: $($d.clientes.Count)"
Write-Host "Facturas: $($d.facturas.Count)"
Write-Host "Bancos: $($d.bancos.Count)"
