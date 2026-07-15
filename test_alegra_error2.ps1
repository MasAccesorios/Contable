$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)
$headers = @{ Authorization = "Basic $authStr"; Accept = "application/json" }

try {
    $res = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/contacts?order_direction=DESC&type=client&limit=30&start=180" -Headers $headers -ErrorAction Stop
    Write-Host "Success"
} catch {
    Write-Host "STATUS CODE: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "STATUS DESCRIPTION: $($_.Exception.Response.StatusDescription)"
}
