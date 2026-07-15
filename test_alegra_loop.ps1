$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)
$headers = @{ Authorization = "Basic $authStr"; Accept = "application/json" }

for ($i = 0; $i -le 210; $i += 30) {
    try {
        $url = "https://api.alegra.com/api/v1/contacts?order_direction=DESC&type=client&limit=30&start=$i"
        $res = Invoke-RestMethod -Uri $url -Headers $headers -ErrorAction Stop
        Write-Host "Page start=$i Success"
    } catch {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errBody = $reader.ReadToEnd()
        Write-Host "Page start=$i ERROR: $errBody"
        break
    }
    Start-Sleep -Milliseconds 2000
}
