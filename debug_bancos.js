const fs = require('fs');

// Mock localStorage
global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
};

// Evaluate db.js
const dbCode = fs.readFileSync('js/db.js', 'utf8');
eval(dbCode);

// Simulate sync
const testSync = JSON.parse(fs.readFileSync('test_sync_results.json', 'utf8'));

// Run mergeById logic for banks exactly as in db.js
const bMap = testSync.bancos.map(b => ({ 
    id_alegra: b.id_alegra, 
    nombre: b.name, 
    tipo: b.type, 
    balance: b.balance, 
    saldo_actual: parseFloat(b.balance) || 0 
}));

const mergeById = (existing, newItems, idField) => {
    const map = {};
    existing.forEach(e => map[e.id] = e);
    newItems.forEach(n => {
        const match = Object.values(map).find(e => e[idField] && String(e[idField]) === String(n[idField]));
        if (match) map[match.id] = { ...match, ...n };
        else { const id = DB.genId(); map[id] = { id, created_at: new Date().toISOString(), ...n }; }
    });
    return Object.values(map);
};

const finalBanks = mergeById([], bMap, 'id_alegra');
console.log("FINAL BANKS AFTER MERGE:", JSON.stringify(finalBanks.slice(0,2), null, 2));

// Run bancos() logic
const movements = [];
let saldoBancosEfectivo = 0;
const bankData = finalBanks.map(b => {
    let baseBalance = b.balance !== undefined ? parseFloat(b.balance) : parseFloat(b.saldo_inicial || 0);
    let saldoReal = baseBalance;
    movements.forEach(m => {
        if (String(m.banco_id) === String(b.id)) {
            const amount = parseFloat(m.monto || 0);
            if (m.tipo === 'ingreso') saldoReal += amount;
            else saldoReal -= amount;
        }
    });
    if (saldoReal > 0) saldoBancosEfectivo += saldoReal;
    return { ...b, saldoReal };
});

console.log("BANK DATA MAPPED:", JSON.stringify(bankData.slice(0,2), null, 2));
