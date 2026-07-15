$content = [IO.File]::ReadAllText("d:\Contable\js\db.js")
$idx = $content.IndexOf("// --- AUTO-INJECTED MASSIVE UPDATE ---")
if ($idx -gt 0) {
    $new = $content.Substring(0, $idx)
    [IO.File]::WriteAllText("d:\Contable\js\db.js", $new)
    Write-Host "Removed block!"
} else {
    Write-Host "Block not found"
}
