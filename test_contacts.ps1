$email = "mauricio.izquierdo@hotmail.com"
$apiKey = "4be4096858fba53cdc21"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes("${email}:${apiKey}")
$authStr = [System.Convert]::ToBase64String($authBytes)
$headers = @{ Authorization = "Basic $authStr"; Accept = "application/json" }

# Test page 7 of contacts with type=client (start=180)
Write-Host "Test 1: contacts?type=client&start=180"
try {
    $r = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/contacts?limit=30&start=180&type=client" -Headers $headers
    Write-Host "  OK: $(@($r).Count) registros"
} catch { Write-Host "  ERROR: $($_.Exception.Message)" }

# Test without type filter
Write-Host "Test 2: contacts (sin tipo) start=180"
try {
    $r = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/contacts?limit=30&start=180" -Headers $headers
    Write-Host "  OK: $(@($r).Count) registros"
} catch { Write-Host "  ERROR: $($_.Exception.Message)" }

# Test type=customer
Write-Host "Test 3: contacts?type=customer&start=0"
try {
    $r = Invoke-RestMethod -Uri "https://api.alegra.com/api/v1/contacts?limit=30&start=0&type=customer" -Headers $headers
    Write-Host "  OK: $(@($r).Count) registros"
    $r | Select-Object -First 2 | ForEach-Object { Write-Host "   -> $($_.name)" }
} catch { Write-Host "  ERROR: $($_.Exception.Message)" }
