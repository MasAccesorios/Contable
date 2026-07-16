const fs = require('fs');
const lines = fs.readFileSync('C:/Users/DiegoM/.gemini/antigravity-ide/brain/68b45996-d85a-43d9-a23b-6eb5763891af/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');
for (const line of lines) {
    if (line.includes('"type":"USER_INPUT"')) {
        const lower = line.toLowerCase();
        if (lower.includes('alegra') && lower.includes('@')) {
            console.log(line);
        }
    }
}
