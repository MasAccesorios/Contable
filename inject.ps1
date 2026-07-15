$json = Get-Content test_sync_results.json -Raw
$dbjs = Get-Content js\db.js -Raw

# Remove the fake data object and inject the real one
$regex = '(?s)const data = \{.*?cotizaciones.*?\].*?\};'
$dbjs = $dbjs -replace $regex, "const data = $json;"

Set-Content js\db.js $dbjs -Encoding UTF8
