$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)
$headers = @{ Authorization = "Basic $authStr"; Accept = "application/json" }

try {
    $r = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/contacts?order_direction=DESC&type=client&limit=30&start=180" -Headers $headers
    Write-Host "Success! Count: " $r.Count
} catch {
    Write-Host "Error message: " $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Host "Response body: " $body
    }
}
