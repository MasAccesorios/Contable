$text = Get-Content -Raw "js/alegra_data.js"
$matches = [regex]::Matches($text, '\{[^{]*"reference":"232[^"]*"[^}]*\}')
foreach ($m in $matches) { Write-Output $m.Value }
