$baseDir = "D:\Contable"

$filesToDelete = @(
    "temp_compra.html",
    "js\alegra_data.js",
    "js\alegra_inventario.js",
    "js\app_backup.js",
    "js\app_merged.js",
    "js\auth.js",
    "js\db.js",
    "js\pages.js",
    "js\sync-alegra.js"
)

$dirsToDelete = @(
    "js\components"
)

foreach ($file in $filesToDelete) {
    $path = Join-Path $baseDir $file
    if (Test-Path $path) {
        Remove-Item -Path $path -Force -ErrorAction SilentlyContinue
    }
}

foreach ($dir in $dirsToDelete) {
    $path = Join-Path $baseDir $dir
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}
