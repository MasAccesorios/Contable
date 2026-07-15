$html = Get-Content cargador-masivo.html -Raw
$match = [regex]::Match($html, 'const DATA = (\{.*?\});', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if ($match.Success) {
    $json = $match.Groups[1].Value | ConvertFrom-Json
    Write-Host "Clientes in HTML:" $json.clientes.Count
    Write-Host "Facturas in HTML:" $json.facturas.Count
    Write-Host "Bancos in HTML:" $json.bancos.Count
} else {
    Write-Host "DATA not found"
}
