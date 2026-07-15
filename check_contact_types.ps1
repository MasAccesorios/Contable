$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)
$headers = @{ Authorization = "Basic $authStr"; Accept = "application/json" }

# Count total contacts for different filters by paginating until 400 or empty
function Get-TotalCount {
    param([string]$UrlFilter)
    $start = 0
    $limit = 30
    $total = 0
    while ($true) {
        $url = "https://api.alegra.com/api/v1/contacts?limit=$limit&start=$start$UrlFilter"
        try {
            $r = Invoke-RestMethod -Uri $url -Headers $headers -ErrorAction Stop
            if ($null -eq $r -or $r.Count -eq 0) { break }
            $total += $r.Count
            if ($r.Count -lt $limit) { break }
            $start += $limit
        } catch {
            break
        }
    }
    return $total
}

Write-Host "Total with type=client:   " (Get-TotalCount -UrlFilter "&type=client")
Write-Host "Total with type=customer: " (Get-TotalCount -UrlFilter "&type=customer")
Write-Host "Total with type=provider: " (Get-TotalCount -UrlFilter "&type=provider")
Write-Host "Total without type filter:" (Get-TotalCount -UrlFilter "")
