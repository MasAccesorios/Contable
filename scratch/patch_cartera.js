const fs = require('fs');
const path = 'js/modules/cartera/cartera.js';
let content = fs.readFileSync(path, 'utf8');

// The chunk we want to replace
const originalChunk = `            const cabeceras = ["Número", "Tipo documento", "Cliente", "Creación", "Vencimiento", "Total", "Pagado", "Por cobrar"];
            
            const parseMoney = (str) => {
                const parsed = parseFloat(str.replace(/\\$/g, '').replace(/\\./g, '').replace(/,/g, '.').trim());
                return isNaN(parsed) ? 0 : parsed;
            };
            
            const dataToExport = [];
            
            visibles.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length < 9) return;
                
                dataToExport.push({
                    "Número": tds[1].innerText.trim(),
                    "Tipo documento": tds[2].innerText.trim(),
                    "Cliente": tds[3].innerText.trim(),
                    "Creación": tds[4].innerText.trim(),
                    "Vencimiento": tds[5].innerText.trim(),
                    "Total": parseMoney(tds[6].innerText),
                    "Pagado": parseMoney(tds[7].innerText),
                    "Por cobrar": parseMoney(tds[8].innerText)
                });
            });
            
            const ws = XLSX.utils.json_to_sheet(dataToExport, { header: cabeceras });
            
            // Formatear las columnas de moneda como $#,##0.00 en Excel
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                // Columnas F, G, H (Total, Pagado, Por cobrar) son indices 5, 6, 7
                for (let C = 5; C <= 7; ++C) {`;

// The chunk to replace it with
const newChunk = `            const cabeceras = ["Número", "Tipo documento", "Cliente", "Creación", "Vencimiento", "Estado", "Total", "Pagado", "Por cobrar"];
            
            const parseMoney = (str) => {
                const parsed = parseFloat(str.replace(/\\$/g, '').replace(/\\./g, '').replace(/,/g, '.').trim());
                return isNaN(parsed) ? 0 : parsed;
            };
            
            const dataToExport = [];
            
            visibles.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length < 10) return; // 10 is the safe minimum now
                
                dataToExport.push({
                    "Número": tds[1].innerText.trim(),
                    "Tipo documento": tds[2].innerText.trim(),
                    "Cliente": tds[3].innerText.trim(),
                    "Creación": tds[4].innerText.trim(),
                    "Vencimiento": tds[5].innerText.trim(),
                    "Estado": tds[6].innerText.trim(),
                    "Total": parseMoney(tds[7].innerText),
                    "Pagado": parseMoney(tds[8].innerText),
                    "Por cobrar": parseMoney(tds[9].innerText)
                });
            });
            
            const ws = XLSX.utils.json_to_sheet(dataToExport, { header: cabeceras });
            
            // Formatear las columnas de moneda como $#,##0.00 en Excel
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                // Columnas G, H, I (Total, Pagado, Por cobrar) son indices 6, 7, 8
                for (let C = 6; C <= 8; ++C) {`;

// Use Regex to bypass CR LF
const regexSafeEscape = (str) => {
    return str.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&') // escape special characters
              .replace(/\\s+/g, '\\\\s+'); // match any whitespace variation (CRLF vs LF)
};

const regex = new RegExp(regexSafeEscape(originalChunk));

if (regex.test(content)) {
    fs.writeFileSync(path, content.replace(regex, newChunk), 'utf8');
    console.log("Success");
} else {
    console.error("Match failed.");
}
