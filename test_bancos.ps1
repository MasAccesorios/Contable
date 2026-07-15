$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)
$headers = @{ Authorization = "Basic $authStr"; Accept = "application/json" }

# Get bank accounts
$banks = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/bank-accounts?limit=20" -Headers $headers
foreach ($b in $banks) {
    Write-Host "ID: $($b.id) | Name: $($b.name) | Balance: $($b.balance) | InitialBalance: $($b.initialBalance) | Type: $($b.type)"
    # Try to get all properties
    Write-Host "  All fields: " ($b | ConvertTo-Json -Depth 2 -Compress)
}
