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

function Get-AllPages {
    param (
        [string]$BaseUrl,
        [string]$Label,
        [int]$MaxRecords = 5000,
        [int]$LimitPerPage = 30
    )

    $allData = @()
    $start = 0
    $limit = $LimitPerPage
    $page = 1
    $hasMore = $true

    do {
        if ($BaseUrl -match "\?") {
            $url = "$BaseUrl&limit=$limit&start=$start"
        } else {
            $url = "$BaseUrl?limit=$limit&start=$start"
        }

        try {
            Write-Host "Fetching: $url"
            $response = Invoke-RestMethod -Uri $url -Headers $headers -ErrorAction Stop

            if ($response.Count -gt 0) {
                $allData += $response
                Write-Host "  [$Label] Pagina $page (start=$start): $($response.Count) registros"
                
                if ($response.Count -lt $limit) {
                    $hasMore = $false
                } else {
                    $start += $limit
                    $page++
                }
            } else {
                $hasMore = $false
            }
        } catch {
            Write-Host "  [$Label] ERROR en pagina $($page): $($_.Exception.Message)"
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $body = $reader.ReadToEnd()
                Write-Host "  Body: $body"
            }
            $hasMore = $false
        }

        Start-Sleep -Milliseconds 5000

        if ($allData.Count -ge $MaxRecords) {
            Write-Host "  [$Label] Limite de seguridad alcanzado: $MaxRecords registros"
            $hasMore = $false
        }
    } while ($hasMore)

    return $allData
}

$rawClientes = Get-AllPages -BaseUrl "https://api.alegra.com/api/v1/contacts?order_direction=DESC&type=client" -Label "Clientes" -MaxRecords 1500
Write-Host "Total: $($rawClientes.Count)"
