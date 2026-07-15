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

$all = @()
for ($i = 0; $i -le 690; $i += 30) {
    $url = "https://api.alegra.com/api/v1/contacts?type=client&limit=30&start=$i"
    Write-Host "Fetching $url ..."
    try {
        $res = Invoke-RestMethod -Uri $url -Headers $headers -ErrorAction Stop
        Write-Host "Success: $($res.Count) records."
        $all += $res
    } catch {
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $body = $reader.ReadToEnd()
            Write-Host "Failed Body: $body"
        }
        Write-Host "Failed: $($_.Exception.Message)"
        break
    }
    Start-Sleep -Milliseconds 1000
}
Write-Host "Total fetched: $($all.Count)"
