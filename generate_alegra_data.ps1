$jsonRaw = [IO.File]::ReadAllText("test_sync_results.json", [System.Text.Encoding]::UTF8)
$data = $jsonRaw | ConvertFrom-Json

# FIX: API de Alegra no retorna 'balance' actual en /bank-accounts y retorna 403 en reportes.
$manualBalances = @{
    "24" = 125.00
    "23" = 3096112.00
    "22" = 790551.00
    "20" = 3449260.00
    "19" = 1265658.00
    "7"  = 51867901.00
    "1"  = 2580179.00
}

foreach ($banco in $data.bancos) {
    $id = [string]$banco.id_alegra
    if ($manualBalances.ContainsKey($id)) {
        $banco | Add-Member -MemberType NoteProperty -Name "balance" -Value $manualBalances[$id] -Force
    } else {
        $banco | Add-Member -MemberType NoteProperty -Name "balance" -Value 0 -Force
    }
}

$jsonFinal = $data | ConvertTo-Json -Depth 10 -Compress
$jsContent = "window.ALEGRA_SYNC_DATA = $jsonFinal;"

[IO.File]::WriteAllText("js\alegra_data.js", $jsContent, [System.Text.Encoding]::UTF8)

Write-Host "js/alegra_data.js generado correctamente."
