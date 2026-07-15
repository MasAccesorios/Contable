$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)
$headers = @{ Authorization = "Basic $authStr"; Accept = "application/json" }

# Calculate real bank balance by summing all payments per bank account
# Get all payments and sum by bank account
Write-Host "Calculando saldos reales de bancos desde pagos recibidos..."

$bankSaldos = @{}

$start = 0
$limit = 30
while ($true) {
    try {
        $payments = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/payments?limit=$limit&start=$start" -Headers $headers
        if ($null -eq $payments -or $payments.Count -eq 0) { break }
        foreach ($p in $payments) {
            $bankId = [string]$p.bankAccount.id
            if (-not $bankSaldos[$bankId]) { 
                $bankSaldos[$bankId] = @{ name = [string]$p.bankAccount.name; total = 0.0 } 
            }
            $bankSaldos[$bankId].total += [double]$p.amount
        }
        if ($payments.Count -lt $limit) { break }
        $start += $limit
        Write-Host "  Processed $start payments..."
    } catch { break }
}

Write-Host "`n=== SALDOS CALCULADOS DESDE PAGOS ==="
$bankSaldos.GetEnumerator() | Sort-Object { $_.Value.total } -Descending | ForEach-Object {
    Write-Host "  ID: $($_.Key) | $($_.Value.name): $([string]::Format('{0:N0}', $_.Value.total)) COP"
}
