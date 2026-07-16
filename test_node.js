function genId() { return Math.random().toString(); }
const DATA = {
  clientes: [
    {id_alegra: 347, name: 'Alberto Arroyo', identification: '80412744'},
    {id_alegra: 661, name: 'Alberto Arroyo'},
    {id_alegra: 100, name: 'Alberto Arroyo'}
  ]
};
let cg_clients = [
    {id: '1', nombre: 'Alberto Arroyo', id_alegra: 347},
    {id: '2', nombre: 'Alberto Arroyo', id_alegra: 661},
    {id: '3', nombre: 'Alberto Arroyo', id_alegra: 100}
];

// Deduplicate
const uniqueClientsMap = {};
const deduplicatedClients = [];
cg_clients.forEach(c => {
    if (!c) return;
    const key = (c.nombre || '').trim().toLowerCase();
    if (!key) { deduplicatedClients.push(c); return; }
    if (!uniqueClientsMap[key]) {
        uniqueClientsMap[key] = c;
        deduplicatedClients.push(c);
    } else {
        const existing = uniqueClientsMap[key];
        if (!existing.id_alegra && c.id_alegra) existing.id_alegra = c.id_alegra;
    }
});

const mergeById = (existing, newItems, idField) => {
    const map = {};
    existing.forEach(e => map[e.id] = e);
    newItems.forEach(n => {
        const match = Object.values(map).find(e => 
            (e[idField] && String(e[idField]) === String(n[idField])) ||
            (e.nombre && n.nombre && e.nombre.trim().toLowerCase() === n.nombre.trim().toLowerCase())
        );
        if (match) map[match.id] = { ...match, ...n };
        else { const id = genId(); map[id] = { id, ...n }; }
    });
    return Object.values(map);
};

const cMap = DATA.clientes.map(c => ({ id_alegra: c.id_alegra, nombre: c.name, identificacion: c.identification }));
const cFinal = mergeById(deduplicatedClients, cMap, 'id_alegra');

// Write out JSON to verify
const fs = require('fs');
fs.writeFileSync('test_output.json', JSON.stringify(cFinal, null, 2));
