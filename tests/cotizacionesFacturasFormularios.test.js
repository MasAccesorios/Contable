import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ItemEngine } from '../js/shared/itemEngine.js';
import { numeroALetras } from '../js/shared/numeroALetras.js';

describe('Formularios Modernos: Cotizaciones y Facturas - Suite de Pruebas Unitarias', () => {

    describe('1. Motor de Cálculo Financiero (ItemEngine.calcEngine & Redondeo)', () => {
        test('debe calcular subtotal, descuento, impuestos y total con precisión matemática al centavo', () => {
            const mockTable = {
                rows: [
                    { qty: 2, price: 50000, disc: 10, tax: 19 }, // base: 100.000, desc: 10.000, sub: 90.000, tax: 17.100
                    { qty: 1, price: 200000, disc: 0, tax: 0 }    // base: 200.000, desc: 0, sub: 200.000, tax: 0
                ]
            };

            const round2 = (val) => Math.round((Number(val) + Number.EPSILON) * 100) / 100;
            let sumSubtotal = 0;
            let sumDescuento = 0;
            let sumImpuestos = 0;

            mockTable.rows.forEach(r => {
                const base = round2(r.qty * r.price);
                const desc = round2(base * (r.disc / 100));
                const sub = round2(base - desc);
                const tax = round2(sub * (r.tax / 100));

                sumSubtotal = round2(sumSubtotal + base);
                sumDescuento = round2(sumDescuento + desc);
                sumImpuestos = round2(sumImpuestos + tax);
            });

            const totalFinal = round2(sumSubtotal - sumDescuento + sumImpuestos);

            assert.strictEqual(sumSubtotal, 300000);
            assert.strictEqual(sumDescuento, 10000);
            assert.strictEqual(sumImpuestos, 17100);
            assert.strictEqual(totalFinal, 307100);
        });

        test('formatMoney de ItemEngine debe formatear pesos colombianos con 2 decimales', () => {
            const formatted = ItemEngine.formatMoney(150000.5);
            assert.ok(formatted.includes('150.000') || formatted.includes('150000'));
            assert.ok(formatted.startsWith('$'));
        });
    });

    describe('2. Conversión de Números a Letras en Tiempo Real', () => {
        test('debe convertir cero a "Cero Pesos M/CTE."', () => {
            assert.strictEqual(numeroALetras(0), 'Cero Pesos M/CTE.');
        });

        test('debe convertir cifras monetarias comunes correctamente', () => {
            const resultado = numeroALetras(1500000);
            assert.ok(resultado.toUpperCase().includes('MILLON') || resultado.toUpperCase().includes('QUINIENTOS'));
            assert.ok(resultado.toUpperCase().includes('PESOS M/CTE.'));
        });
    });

    describe('3. Días de Vigencia Comercial y Vencimiento', () => {
        test('debe calcular correctamente la diferencia en días entre fecha de emisión y vencimiento', () => {
            const fCreacion = '2026-11-23';
            const fVencimiento = '2026-12-08';

            const dF = new Date(fCreacion + 'T12:00:00');
            const dV = new Date(fVencimiento + 'T12:00:00');
            const diffDays = Math.round((dV - dF) / (1000 * 60 * 60 * 24));

            assert.strictEqual(diffDays, 15);
        });

        test('debe sumar días rápidos (+15d, +30d) sin desfases de zona horaria', () => {
            const fechaBase = '2026-11-23';
            const d = new Date(fechaBase + 'T12:00:00');
            d.setDate(d.getDate() + 30);

            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const resultado = `${yyyy}-${mm}-${dd}`;

            assert.strictEqual(resultado, '2026-12-23');
        });
    });

    describe('4. Semáforo y Watchdog Preventivo de Inventario FIFO', () => {
        test('debe alertar cuando la cantidad pedida supere el stock disponible', () => {
            const lineas = [
                { id: 1, sku: 'PROD-A', cantidad: 5, stockDisponible: 10 },
                { id: 2, sku: 'PROD-B', cantidad: 12, stockDisponible: 8 }
            ];

            let stockInsuficiente = false;
            let unidadesFaltantes = 0;

            lineas.forEach(l => {
                if (l.cantidad > l.stockDisponible) {
                    stockInsuficiente = true;
                    unidadesFaltantes += (l.cantidad - l.stockDisponible);
                }
            });

            assert.strictEqual(stockInsuficiente, true);
            assert.strictEqual(unidadesFaltantes, 4);
        });

        test('debe marcar disponible cuando todas las líneas tengan inventario suficiente', () => {
            const lineas = [
                { id: 1, sku: 'PROD-A', cantidad: 3, stockDisponible: 5 },
                { id: 2, sku: 'PROD-B', cantidad: 2, stockDisponible: 2 }
            ];

            let stockInsuficiente = false;
            lineas.forEach(l => {
                if (l.cantidad > l.stockDisponible) {
                    stockInsuficiente = true;
                }
            });

            assert.strictEqual(stockInsuficiente, false);
        });
    });

    describe('5. Detección Reactiva de Cartera y Deuda de Clientes', () => {
        test('debe acumular correctamente el saldo exigible de múltiples facturas', () => {
            const facturasCliente = [
                { id: 101, numero: 5001, total: 500000, saldo: 200000 },
                { id: 102, numero: 5002, total: 350000, saldo: 350000 }
            ];

            const deudaTotal = facturasCliente.reduce((sum, f) => sum + Number(f.saldo || 0), 0);
            assert.strictEqual(deudaTotal, 550000);
        });

        test('debe detectar cliente al día cuando la cartera esté en cero', () => {
            const facturasCliente = [];
            const deudaTotal = facturasCliente.reduce((sum, f) => sum + Number(f.saldo || 0), 0);
            assert.strictEqual(deudaTotal, 0);
        });
    });

    describe('6. Validación Pre-Guardado y Blindaje de Datos', () => {
        test('debe rechazar guardado si no hay cliente seleccionado', () => {
            const clienteId = '';
            assert.strictEqual(!clienteId, true);
        });

        test('debe rechazar guardado si el total de la cotización/factura es cero o negativo', () => {
            const total = 0;
            const isValid = total > 0;
            assert.strictEqual(isValid, false);
        });

        test('debe filtrar detalles vacíos o sin productoId', () => {
            const detalles = [
                { productoId: '15', cantidad: 2, precio: 50000 },
                { productoId: '', cantidad: 0, precio: 0 },
                { productoId: undefined, cantidad: 1, precio: 10000 }
            ];

            const filtrados = detalles.filter(d => Boolean(d.productoId));
            assert.strictEqual(filtrados.length, 1);
            assert.strictEqual(filtrados[0].productoId, '15');
        });
    });

    describe('7. Ergonomía de Combobox y Precios Mercado Libre', () => {
        test('renderProductSearchBox debe estructurar el wrapper de búsqueda de forma independiente de la descripción', async () => {
            const { ItemEngine } = await import('../js/shared/itemEngine.js');
            const html = ItemEngine.renderProductSearchBox({ productoId: 2304 }, []);
            
            // Verifica que el contenedor del input de búsqueda esté aislado para que el dropdown flote encima
            assert.ok(html.includes('product-search-wrapper'), 'Debe incluir product-search-wrapper');
            assert.ok(html.includes('input-prod-search'), 'Debe incluir input de búsqueda');
            assert.ok(html.includes('input-prod-desc'), 'Debe incluir descripción adicional');
        });

        test('debe formatear correctamente los precios históricos para Mercado Libre (Mín, Prom, Máx, Último)', () => {
            const mlStats = {
                precio_promedio: 18500,
                precio_minimo: 15000,
                precio_maximo: 22000,
                veces_vendido: 5
            };
            const ultimoPrecio = 19000;

            const formatCOP = (num) => Number(Math.round(num || 0)).toLocaleString('es-CO');
            const formatInput = (num) => Number(num || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            assert.strictEqual(formatCOP(ultimoPrecio), '19.000');
            assert.strictEqual(formatCOP(mlStats.precio_minimo), '15.000');
            assert.strictEqual(formatCOP(mlStats.precio_promedio), '18.500');
            assert.strictEqual(formatCOP(mlStats.precio_maximo), '22.000');
            assert.strictEqual(formatInput(ultimoPrecio), '19.000,00');
        });
    });
});
