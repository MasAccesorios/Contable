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

Write-Host "Fetching limit=1000..."
try {
    $res = Invoke-RestMethod -Uri 'https://api.alegra.com/api/v1/contacts?order_direction=DESC&type=client&limit=1000&start=0' -Headers $headers -ErrorAction Stop
    Write-Host "Success: $($res.Count) records."
} catch {
    Write-Host "Failed: $($_.Exception.Message)"
}
