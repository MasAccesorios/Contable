$json = '{"bancos":[{"id_alegra":"24","balance":0}]}'
$data = $json | ConvertFrom-Json
foreach ($b in $data.bancos) {
    if ($null -ne $b.balance) {
        $b.balance = 125.00
    } else {
        $b | Add-Member -MemberType NoteProperty -Name 'balance' -Value 125.00 -Force
    }
}
$data | ConvertTo-Json -Depth 10 -Compress
