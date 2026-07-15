$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)

$headers = @{
    Authorization = "Basic $authStr"
    Accept        = "application/json"
}

Write-Host "Fetching 150..."
$res1 = Invoke-RestMethod -Uri 'https://api.alegra.com/api/v1/contacts?order_direction=DESC&type=client&limit=30&start=150' -Headers $headers -ErrorAction Stop
Write-Host "150 Count: $($res1.Count)"

Write-Host "Fetching 180..."
try {
    $res2 = Invoke-RestMethod -Uri 'https://api.alegra.com/api/v1/contacts?order_direction=DESC&type=client&limit=30&start=180' -Headers $headers -ErrorAction Stop
    Write-Host "180 Count: $($res2.Count)"
} catch {
    Write-Host "180 Failed: $($_.Exception.Message)"
}
