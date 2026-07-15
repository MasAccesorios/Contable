$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)
$headers = @{ Authorization = "Basic $authStr"; Accept = "application/json" }

# Try to get account statement for bank ID 1
Write-Host "--- Test: /bank-accounts/1/statement ---"
try {
    $r = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/bank-accounts/1/statement" -Headers $headers
    Write-Host ($r | ConvertTo-Json -Depth 3 -Compress)
} catch {
    Write-Host "ERROR: " $_.Exception.Message
}

# Try bank reconciliation summary endpoint
Write-Host "`n--- Test: /bank-reconciliations ---"
try {
    $r = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/bank-reconciliations?limit=5&bank_account_id=1" -Headers $headers
    Write-Host ($r | ConvertTo-Json -Depth 3 -Compress)
} catch {
    Write-Host "ERROR: " $_.Exception.Message
}
