$ErrorActionPreference = "Stop"
Write-Host "Cargando CSV..."
$csvPath = "D:\Contable\Alegra - Contactos 07-2026.csv"
$csv = Import-Csv -Path $csvPath -Encoding Default -Delimiter ","

Write-Host "Cargando alegra_data.js..."
$jsPath = "D:\Contable\js\alegra_data.js"
$content = Get-Content $jsPath -Raw
$jsonStr = $content.Replace('// Archivo autogenerado - Extraccion profunda Alegra', '').Replace('window.ALEGRA_SYNC_DATA = ', '').TrimEnd(';')
$data = $jsonStr | ConvertFrom-Json

$existingClients = $data.clientes

# Create a hashtable for quick lookup
$lookup = @{}
foreach ($c in $existingClients) {
    if ($c.name) {
        $key = $c.name.Trim().ToLower()
        $lookup[$key] = $true
    }
}

Write-Host "Procesando clientes del CSV..."
$addedCount = 0
$newId = 1000000

# We need to find the correct property names because of encoding issues
$props = $csv[0].psobject.properties | Select-Object -ExpandProperty Name
$identProp = $props | Where-Object { $_ -match "Identificaci" }
$dirProp = $props | Where-Object { $_ -match "Direcci" }
$telProp = $props | Where-Object { $_ -match "Tel" }

$newClients = @()

foreach ($row in $csv) {
    $name = $row.Nombre
    if (-not $name) { continue }
    
    $key = $name.Trim().ToLower()
    if (-not $lookup.ContainsKey($key)) {
        $ident = if ($identProp) { $row.$identProp } else { "" }
        $dir = if ($dirProp) { $row.$dirProp } else { "" }
        $tel = if ($telProp) { $row.$telProp } else { "" }
        if (-not $tel -and $row.Celular) { $tel = $row.Celular }

        $newClient = [PSCustomObject]@{
            id_alegra = $newId.ToString()
            name = $name
            identification = $ident
            email = $row.Correo
            phone = $tel
            address = $dir
        }
        $newClients += $newClient
        $newId++
        $addedCount++
    }
}

Write-Host "Agregando $addedCount clientes nuevos..."
if ($newClients.Count -gt 0) {
    $data.clientes = $existingClients + $newClients
}

Write-Host "Guardando JSON..."
$finalJson = $data | ConvertTo-Json -Depth 10 -Compress
$finalJs = "// Archivo autogenerado - Extraccion profunda Alegra`nwindow.ALEGRA_SYNC_DATA = $finalJson;"
[IO.File]::WriteAllText($jsPath, $finalJs, [System.Text.Encoding]::UTF8)

Write-Host "Completado."
