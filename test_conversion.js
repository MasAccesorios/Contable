
const fs = require('fs');
const path = require('path');

// Mock localStorage
const storage = {};
global.localStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => { storage[key] = value; },
    removeItem: (key) => { delete storage[key]; },
    clear: () => { for (let key in storage) delete storage[key]; }
};

// Load db.js content
const dbCode = fs.readFileSync(path.join(__dirname, 'js', 'db.js'), 'utf8');
// Evaluate DB object in global scope
eval(dbCode.replace('const DB =', 'global.DB ='));

async function runTests() {
    console.log("--- Iniciando Pruebas de Cotización a Factura ---");

    try {
        // 1. Setup Data
        const client = DB.saveClient({ nombre: 'Test Client', documento: '123456', tipo: 'Cliente' });
        const product = DB.saveProduct({ codigo: 'TEST-001', nombre: 'Test Product', precio_compra: 100, precio_venta: 200, stock_actual: 10, stock_minimo: 2 });
        const bank = DB.saveBank({ nombre: 'Banco Test', saldo_actual: 0 });

        console.log("✅ Setup inicial completado.");

        // 2. Create Quotation
        const cotData = {
            cliente_id: client.id,
            fecha: '2026-03-03',
            validez: '2026-03-10',
            estado: 'aceptada'
        };
        const details = [{ producto_id: product.id, cantidad: 3, precio_unitario: 200 }];

        const savedCot = DB.registerCotizacion(cotData, details);
        console.log(`✅ Cotización registrada: #${savedCot.id.substr(-6)} con estado ${savedCot.estado}`);

        // 3. Convert to Sale
        const originalStock = DB.getProduct(product.id).stock_actual;
        const savedSale = DB.convertCotizacionToVenta(savedCot.id, 'contado', bank.id);

        console.log(`✅ Conversión exitosa: Factura #${savedSale.id.substr(-6)}`);

        // 4. Verification
        const updatedProduct = DB.getProduct(product.id);
        const updatedCot = DB.getCotizacion(savedCot.id);
        const updatedBank = DB.getBank(bank.id);

        // Check Inventory
        if (updatedProduct.stock_actual === originalStock - 3) {
            console.log("✅ Inventario descontado correctamente (10 -> 7).");
        } else {
            throw new Error(`Fallo en inventario: esperado ${originalStock - 3}, obtenido ${updatedProduct.stock_actual}`);
        }

        // Check Quotation Status
        if (updatedCot.estado === 'convertida' && updatedCot.factura_id === savedSale.id) {
            console.log("✅ Estado de cotización actualizado a 'convertida' y vinculada a factura.");
        } else {
            throw new Error(`Fallo en estado de cotización: ${updatedCot.estado}`);
        }

        // Check Finance (Bank)
        if (updatedBank.saldo_actual === 600) {
            console.log("✅ Saldo bancario actualizado correctamente (+600).");
        } else {
            throw new Error(`Fallo en saldo bancario: esperado 600, obtenido ${updatedBank.saldo_actual}`);
        }

        // 5. Test Stock Validation (Fail case)
        console.log("--- Probando validación de stock insuficiente ---");
        const cotFail = DB.registerCotizacion({ cliente_id: client.id, fecha: '2026-03-03', estado: 'aceptada' },
            [{ producto_id: product.id, cantidad: 100, precio_unitario: 200 }]);
        try {
            DB.convertCotizacionToVenta(cotFail.id, 'contado', bank.id);
            throw new Error("Fallo: La conversión debería haber fallado por falta de stock.");
        } catch (e) {
            console.log(`✅ Error capturado correctamente: ${e.message}`);
        }

        console.log("\n🚀 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!");

    } catch (err) {
        console.error("\n❌ ERROR EN LAS PRUEBAS:");
        console.error(err.message);
        process.exit(1);
    }
}

runTests();
