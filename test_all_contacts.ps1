$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)
$headers = @{ Authorization = "Basic $authStr"; Accept = "application/json" }

for ($pageNum = 1; $pageNum -le 25; $pageNum++) {
    $start = ($pageNum - 1) * 30
    $url = "https://api.alegra.com/api/v1/contacts?limit=30&start=$start"
    try {
        $r = Invoke-RestMethod -Uri $url -Headers $headers -ErrorAction Stop
        Write-Host "Page $pageNum (start=$start): Success! Count: $($r.Count)"
        if ($r.Count -lt 30) {
            Write-Host "End of records reached at page $pageNum."
            break
        }
    } catch {
        Write-Host "Page $pageNum (start=$start): Error: $($_.Exception.Message)"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $body = $reader.ReadToEnd()
            Write-Host "Response body: $body"
        }
        break
    }
    Start-Sleep -Milliseconds 200
}
