import json
with open('C:/Users/DiegoM/.gemini/antigravity-ide/brain/68b45996-d85a-43d9-a23b-6eb5763891af/.system_generated/logs/transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        if '"type":"USER_INPUT"' in line:
            lower = line.lower()
            if 'alegra' in lower and '@' in lower:
                print(line)
