$text = Get-Content -Raw "C:\Users\DiegoM\.gemini\antigravity-ide\brain\68b45996-d85a-43d9-a23b-6eb5763891af\.system_generated\logs\transcript.jsonl"
$text -split "`n" | Where-Object { $_ -match '"type":"USER_INPUT"' } | Out-File "d:\Contable\user_inputs.txt" -Encoding utf8
