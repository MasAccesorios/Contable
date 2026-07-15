$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)
$headers = @{ Authorization = "Basic $authStr"; Accept = "application/json" }

# Get specific bank account
Write-Host "--- Test: /bank-accounts/24 (NU Bank Ahorros) ---"
try {
    $r = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/bank-accounts/24" -Headers $headers
    Write-Host ($r | ConvertTo-Json -Depth 3 -Compress)
} catch {
    Write-Host "ERROR: " $_.Exception.Message
}

Write-Host "--- Test: /bank-accounts/23 (DaviPlata) ---"
try {
    $r = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/bank-accounts/23" -Headers $headers
    Write-Host ($r | ConvertTo-Json -Depth 3 -Compress)
} catch {
    Write-Host "ERROR: " $_.Exception.Message
}
