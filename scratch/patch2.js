const fs = require('fs');
let text = fs.readFileSync('js/modules/cartera/cartera.js', 'utf8');

text = text.replace(
    'const cabeceras = ["Número", "Tipo documento", "Cliente", "Creación", "Vencimiento", "Total", "Pagado", "Por cobrar"];',
    'const cabeceras = ["Número", "Tipo documento", "Cliente", "Creación", "Vencimiento", "Estado", "Total", "Pagado", "Por cobrar"];'
);

text = text.replace(
    /if \(tds\.length < 9\) return;/g,
    'if (tds.length < 10) return;'
);

let mappingCRLF = `                    "Número": tds[1].innerText.trim(),\r
                    "Tipo documento": tds[2].innerText.trim(),\r
                    "Cliente": tds[3].innerText.trim(),\r
                    "Creación": tds[4].innerText.trim(),\r
                    "Vencimiento": tds[5].innerText.trim(),\r
                    "Total": parseMoney(tds[6].innerText),\r
                    "Pagado": parseMoney(tds[7].innerText),\r
                    "Por cobrar": parseMoney(tds[8].innerText)`;

let newMappingCRLF = `                    "Número": tds[1].innerText.trim(),\r
                    "Tipo documento": tds[2].innerText.trim(),\r
                    "Cliente": tds[3].innerText.trim(),\r
                    "Creación": tds[4].innerText.trim(),\r
                    "Vencimiento": tds[5].innerText.trim(),\r
                    "Estado": tds[6].innerText.trim(),\r
                    "Total": parseMoney(tds[7].innerText),\r
                    "Pagado": parseMoney(tds[8].innerText),\r
                    "Por cobrar": parseMoney(tds[9].innerText)`;

text = text.replace(mappingCRLF, newMappingCRLF);
text = text.replace(mappingCRLF.replace(/\r/g, ''), newMappingCRLF.replace(/\r/g, ''));

let loopCRLF = `                // Columnas F, G, H (Total, Pagado, Por cobrar) son indices 5, 6, 7\r
                for (let C = 5; C <= 7; ++C) {`;

let newLoopCRLF = `                // Columnas G, H, I (Total, Pagado, Por cobrar) son indices 6, 7, 8\r
                for (let C = 6; C <= 8; ++C) {`;

text = text.replace(loopCRLF, newLoopCRLF);
text = text.replace(loopCRLF.replace(/\r/g, ''), newLoopCRLF.replace(/\r/g, ''));

fs.writeFileSync('js/modules/cartera/cartera.js', text, 'utf8');
