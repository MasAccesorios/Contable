$text = Get-Content -Raw "js/alegra_data.js"
$text = $text -replace '(?s)^.*?window\.ALEGRA_SYNC_DATA\s*=\s*', ''
$text = $text -replace ';\s*$', ''
$data = $text | ConvertFrom-Json
$data.cotizaciones | Select-Object -First 1 | ConvertTo-Json -Depth 10
