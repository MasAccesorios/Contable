$data = Get-Content test_sync_results.json -Raw | ConvertFrom-Json
$data.clientes | Where-Object { $_.name -match 'Kathy' -or $_.name -match 'TECNOLOGICA' } | Select-Object id_alegra, name
