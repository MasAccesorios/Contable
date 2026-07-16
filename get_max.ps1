$text = Get-Content -Raw "js/alegra_data.js"
$jsonText = $text -replace "(?s)^.*?window\.ALEGRA_SYNC_DATA\s*=\s*", ""
$jsonText = $jsonText -replace ";\s*$", ""
$jsonObj = $jsonText | ConvertFrom-Json

$maxNum = 0
foreach ($f in $jsonObj.facturas) {
    $num = $f.id
    if ($f.numberTemplate -and $f.numberTemplate.number) {
        $num = $f.numberTemplate.number
    }
    $num = [int]$num
    if ($num -gt $maxNum) {
        $maxNum = $num
    }
}
Write-Output "Max Factura: $maxNum"

$maxNumCot = 0
foreach ($c in $jsonObj.cotizaciones) {
    $num = $c.id
    if ($c.numberTemplate -and $c.numberTemplate.number) {
        $num = $c.numberTemplate.number
    }
    $num = [int]$num
    if ($num -gt $maxNumCot) {
        $maxNumCot = $num
    }
}
Write-Output "Max Cotizacion: $maxNumCot"
