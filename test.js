try {
    const products = [{codigo: 2323}, {codigo: '2270'}];
    const q = '23';
    const matched = products.filter(p => p.codigo && p.codigo.toLowerCase().includes(q));
    console.log('Matched:', matched.length);
} catch (e) {
    console.log('Error:', e.message);
}
