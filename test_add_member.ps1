$jsonRaw = Get-Content "test_sync_results.json" -Raw
$data = $jsonRaw | ConvertFrom-Json

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

$data | Select-Object -ExpandProperty bancos | Select-Object id_alegra, balance
