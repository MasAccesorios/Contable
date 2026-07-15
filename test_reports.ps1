$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)
$headers = @{ Authorization = "Basic $authStr"; Accept = "application/json" }

Write-Host "--- Test: /reports/bank-balances ---"
try {
    $r = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/reports/bank-balances" -Headers $headers
    Write-Host ($r | ConvertTo-Json -Depth 3 -Compress)
} catch {
    Write-Host "ERROR: " $_.Exception.Message
}

Write-Host "--- Test: /reports/balances ---"
try {
    $r = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/reports/balances" -Headers $headers
    Write-Host ($r | ConvertTo-Json -Depth 3 -Compress)
} catch {
    Write-Host "ERROR: " $_.Exception.Message
}
