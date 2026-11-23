import test from 'node:test';
import assert from 'node:assert/strict';

// Test suite for Smart Payment Allocation (Abono Multi-Factura & Gastos Operativos style)

function autoDistribuirPagos({ montoTotal, facturas, priorizarFacturaId = null }) {
    if (montoTotal <= 0) return facturas.map(f => ({ ...f, abono: 0, nuevoSaldo: f.saldo }));

    let disponible = montoTotal;
    const resultado = facturas.map(f => ({ ...f, abono: 0, nuevoSaldo: f.saldo }));

    // 1. Si se prioriza una factura específica (ej: la factura actual que abrió el modal)
    if (priorizarFacturaId) {
        const target = resultado.find(f => String(f.id) === String(priorizarFacturaId));
        if (target) {
            const asignar = Math.min(disponible, target.saldo);
            target.abono = asignar;
            target.nuevoSaldo = target.saldo - asignar;
            disponible -= asignar;
        }
    }

    // 2. Distribuir el remanente en orden FIFO (más antiguas primero)
    for (const item of resultado) {
        if (priorizarFacturaId && String(item.id) === String(priorizarFacturaId)) continue;
        if (disponible <= 0) break;

        const asignar = Math.min(disponible, item.saldo);
        item.abono = asignar;
        item.nuevoSaldo = item.saldo - asignar;
        disponible -= asignar;
    }

    return {
        resultado,
        remanenteSobrante: disponible,
        totalAplicado: montoTotal - disponible
    };
}

test('Smart Payment Allocation - Prioridad Factura Actual + Cascada FIFO', async (t) => {
    const facturas = [
        { id: 'f1', numero: '6890', fecha: '2026-11-01', saldo: 200000 },
        { id: 'f2', numero: '6896', fecha: '2026-11-10', saldo: 411000 }, // Factura actual
        { id: 'f3', numero: '6901', fecha: '2026-11-15', saldo: 500000 }
    ];

    await t.test('debe saldar completamente la factura actual primero y repartir remanente a las más antiguas', () => {
        // Cliente transfiere $600.000 para saldar la 6896 ($411.000) y abonar el resto ($189.000) a la más antigua
        const { resultado, remanenteSobrante, totalAplicado } = autoDistribuirPagos({
            montoTotal: 600000,
            facturas,
            priorizarFacturaId: 'f2'
        });

        assert.equal(totalAplicado, 600000);
        assert.equal(remanenteSobrante, 0);

        const fActual = resultado.find(f => f.id === 'f2');
        assert.equal(fActual.abono, 411000);
        assert.equal(fActual.nuevoSaldo, 0);

        const fAntigua = resultado.find(f => f.id === 'f1');
        assert.equal(fAntigua.abono, 189000);
        assert.equal(fAntigua.nuevoSaldo, 11000);

        const fReciente = resultado.find(f => f.id === 'f3');
        assert.equal(fReciente.abono, 0);
        assert.equal(fReciente.nuevoSaldo, 500000);
    });

    await t.test('debe saldar todas las facturas y detectar excedente si el monto recibido es mayor a la deuda', () => {
        const { resultado, remanenteSobrante, totalAplicado } = autoDistribuirPagos({
            montoTotal: 1500000,
            facturas,
            priorizarFacturaId: 'f2'
        });

        // Deuda total = 200.000 + 411.000 + 500.000 = 1.111.000
        assert.equal(totalAplicado, 1111000);
        assert.equal(remanenteSobrante, 389000);

        for (const item of resultado) {
            assert.equal(item.nuevoSaldo, 0);
        }
    });

    await t.test('debe distribuir en orden FIFO puro cuando no se especifica factura prioritaria', () => {
        const { resultado, remanenteSobrante, totalAplicado } = autoDistribuirPagos({
            montoTotal: 500000,
            facturas,
            priorizarFacturaId: null
        });

        assert.equal(totalAplicado, 500000);
        assert.equal(remanenteSobrante, 0);

        // f1: $200.000 saldada
        assert.equal(resultado[0].abono, 200000);
        assert.equal(resultado[0].nuevoSaldo, 0);

        // f2: $300.000 abonados de $411.000
        assert.equal(resultado[1].abono, 300000);
        assert.equal(resultado[1].nuevoSaldo, 111000);

        // f3: $0
        assert.equal(resultado[2].abono, 0);
        assert.equal(resultado[2].nuevoSaldo, 500000);
    });

    await t.test('debe generar identificadores de grupo de pago consistentes', () => {
        const grupoPagoId = 'pago_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        assert.match(grupoPagoId, /^pago_\d+_\d+$/);
    });
});
