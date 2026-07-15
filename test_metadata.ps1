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

Write-Host "Fetching metadata..."
try {
    $res = Invoke-RestMethod -Uri 'https://api.alegra.com/api/v1/contacts?metadata=true&limit=1' -Headers $headers -ErrorAction Stop
    $res.metadata | ConvertTo-Json
} catch {
    Write-Host "Failed: $($_.Exception.Message)"
}
