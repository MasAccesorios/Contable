function genId() { return Math.random().toString(); }
const map = {
  '1': { id: '1', nombre: 'Alberto Arroyo', id_alegra: 347 }
};
const newItems = [
  { id_alegra: 347, nombre: 'Alberto Arroyo', identificacion: '80412744' },
  { id_alegra: 661, nombre: 'Alberto Arroyo', identificacion: '' }
];
const idField = 'id_alegra';

newItems.forEach(n => {
    const match = Object.values(map).find(e => 
        (e[idField] && String(e[idField]) === String(n[idField])) ||
        (e.nombre && n.nombre && e.nombre.trim().toLowerCase() === n.nombre.trim().toLowerCase())
    );
    if (match) {
        map[match.id] = { ...match, ...n };
    } else { 
        const id = genId(); 
        map[id] = { id, ...n }; 
    }
});
WScript.Echo(JSON.stringify(Object.values(map)));
