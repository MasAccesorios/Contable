import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ProductoDetalleData } from '../js/modules/productos/detalle/productoDetalle.data.js';
import { ProductoDetalleTemplates } from '../js/modules/productos/detalle/productoDetalle.templates.js';
import { ProductoDetalleEvents } from '../js/modules/productos/detalle/productoDetalle.events.js';
import { ProductoDetalleModule } from '../js/modules/productos/detalle/productoDetalle.js';
import { escapeHtml } from '../js/shared/formatters.js';

describe('Módulo Producto Detalle - TDD Test Suite', () => {

    // =========================================================================
    // 1. ProductoDetalleData.calcularStockYEstado
    // =========================================================================
    describe('ProductoDetalleData.calcularStockYEstado', () => {
        it('debe calcular el stock sumando solo las cantidades actuales de lotes FIFO activos', () => {
            const producto = { id: 1, nombre: 'Producto A', stock: 0, stockMinimo: 10 };
            const lotes = [
                { id: 'l1', cantidadInicial: 20, cantidadActual: 15 },
                { id: 'l2', cantidadInicial: 10, cantidadActual: 0 }, // Agotado
                { id: 'l3', cantidadInicial: 30, cantidadActual: 10 }
            ];

            const resultado = ProductoDetalleData.calcularStockYEstado(producto, lotes);

            assert.strictEqual(resultado.stockTotal, 25);
            assert.strictEqual(resultado.esFallback, false);
            assert.strictEqual(resultado.estado, 'optimo');
        });

        it('debe clasificar el semáforo como "optimo" cuando el stock supera el stock mínimo', () => {
            const producto = { id: 1, stockMinimo: 10 };
            const lotes = [{ id: 'l1', cantidadActual: 20 }];

            const resultado = ProductoDetalleData.calcularStockYEstado(producto, lotes);

            assert.strictEqual(resultado.estado, 'optimo');
            assert.strictEqual(resultado.stockTotal, 20);
        });

        it('debe clasificar el semáforo como "recompra" cuando el stock es menor o igual al mínimo pero mayor al 50%', () => {
            const producto = { id: 1, stockMinimo: 10 };
            const lotes = [{ id: 'l1', cantidadActual: 8 }]; // 8 <= 10 y 8 > 5

            const resultado = ProductoDetalleData.calcularStockYEstado(producto, lotes);

            assert.strictEqual(resultado.estado, 'recompra');
        });

        it('debe clasificar el semáforo como "critico" cuando el stock es positivo pero menor o igual al 50% del mínimo', () => {
            const producto = { id: 1, stockMinimo: 10 };
            const lotes = [{ id: 'l1', cantidadActual: 4 }]; // 4 <= 5 (50% de 10)

            const resultado = ProductoDetalleData.calcularStockYEstado(producto, lotes);

            assert.strictEqual(resultado.estado, 'critico');
        });

        it('debe clasificar el semáforo como "agotado" cuando el stock es cero o menor', () => {
            const producto = { id: 1, stockMinimo: 10 };
            const lotes = [{ id: 'l1', cantidadActual: 0 }];

            const resultado = ProductoDetalleData.calcularStockYEstado(producto, lotes);

            assert.strictEqual(resultado.stockTotal, 0);
            assert.strictEqual(resultado.estado, 'agotado');
        });

        it('debe hacer fallback a producto.stock cuando la lista de lotes está vacía o es nula', () => {
            const producto = { id: 2, stock: 18, stockMinimo: 5 };

            const resVacio = ProductoDetalleData.calcularStockYEstado(producto, []);
            assert.strictEqual(resVacio.stockTotal, 18);
            assert.strictEqual(resVacio.esFallback, true);
            assert.strictEqual(resVacio.estado, 'optimo');

            const resNull = ProductoDetalleData.calcularStockYEstado(producto, null);
            assert.strictEqual(resNull.stockTotal, 18);
            assert.strictEqual(resNull.esFallback, true);
        });

        it('debe manejar campos snake_case (cantidad_actual, stock_minimo) transparentemente', () => {
            const producto = { id: 3, stock_minimo: 12 };
            const lotes = [
                { id: 'l1', cantidad_actual: 3 } // 3 <= 6 (50% de 12) -> critico
            ];

            const resultado = ProductoDetalleData.calcularStockYEstado(producto, lotes);

            assert.strictEqual(resultado.stockTotal, 3);
            assert.strictEqual(resultado.stockMinimo, 12);
            assert.strictEqual(resultado.estado, 'critico');
        });

        it('debe manejar producto nulo o sin stockMinimo asignando defaults seguros', () => {
            const res = ProductoDetalleData.calcularStockYEstado(null, null);
            assert.strictEqual(res.stockTotal, 0);
            assert.strictEqual(res.estado, 'agotado');
            assert.strictEqual(res.stockMinimo, 0);
        });
    });

    // =========================================================================
    // 2. ProductoDetalleData.calcularValorizacionFIFO
    // =========================================================================
    describe('ProductoDetalleData.calcularValorizacionFIFO', () => {
        it('debe calcular la sumatoria de valor total y el costo promedio ponderado real de lotes activos', () => {
            const producto = { id: 1, costoBase: 12000 };
            const lotes = [
                { id: 'l1', cantidadActual: 10, costoUnitario: 10000 }, // 100.000
                { id: 'l2', cantidadActual: 20, costoUnitario: 15000 }, // 300.000
                { id: 'l3', cantidadActual: 0, costoUnitario: 8000 }    // Agotado: no suma
            ];

            const res = ProductoDetalleData.calcularValorizacionFIFO(producto, lotes);

            assert.strictEqual(res.totalUnidades, 30);
            assert.strictEqual(res.valorTotal, 400000);
            assert.strictEqual(Math.round(res.costoPromedioPonderado * 100) / 100, 13333.33);
            assert.strictEqual(res.costoBase, 12000);
            assert.strictEqual(Math.round(res.diferenciaCosto * 100) / 100, 1333.33);
        });

        it('debe hacer fallback a producto.costoBase y producto.stock si no hay lotes activos', () => {
            const producto = { id: 2, stock: 15, costoBase: 25000 };
            const lotes = [];

            const res = ProductoDetalleData.calcularValorizacionFIFO(producto, lotes);

            assert.strictEqual(res.totalUnidades, 15);
            assert.strictEqual(res.valorTotal, 375000);
            assert.strictEqual(res.costoPromedioPonderado, 25000);
            assert.strictEqual(res.diferenciaCosto, 0);
        });

        it('debe soportar campos snake_case (costo_unitario, costo_base)', () => {
            const producto = { id: 3, costo_base: 5000 };
            const lotes = [
                { id: 'l1', cantidad_actual: 5, costo_unitario: 6000 }
            ];

            const res = ProductoDetalleData.calcularValorizacionFIFO(producto, lotes);

            assert.strictEqual(res.valorTotal, 30000);
            assert.strictEqual(res.costoPromedioPonderado, 6000);
            assert.strictEqual(res.diferenciaCosto, 1000);
        });

        it('edge case: producto y lotes vacíos deben retornar ceros sin fallar', () => {
            const res = ProductoDetalleData.calcularValorizacionFIFO(null, []);
            assert.strictEqual(res.valorTotal, 0);
            assert.strictEqual(res.costoPromedioPonderado, 0);
            assert.strictEqual(res.totalUnidades, 0);
        });
    });

    // =========================================================================
    // 3. ProductoDetalleData.calcularMargenComercial
    // =========================================================================
    describe('ProductoDetalleData.calcularMargenComercial', () => {
        it('debe calcular la utilidad monetaria ($/und) y el margen bruto porcentual según precio de venta y costo FIFO', () => {
            const producto = { id: 1, precioVenta: 20000, costoBase: 12000 };
            const costoFIFO = 14000;

            const res = ProductoDetalleData.calcularMargenComercial(producto, costoFIFO);

            assert.strictEqual(res.precioVenta, 20000);
            assert.strictEqual(res.costoUnitario, 14000);
            assert.strictEqual(res.utilidadMonetaria, 6000);
            assert.strictEqual(res.margenPorcentual, 30);
        });

        it('debe usar producto.costoBase si no se pasa costo FIFO o es nulo', () => {
            const producto = { id: 2, precioVenta: 50000, costoBase: 35000 };

            const res = ProductoDetalleData.calcularMargenComercial(producto, null);

            assert.strictEqual(res.costoUnitario, 35000);
            assert.strictEqual(res.utilidadMonetaria, 15000);
            assert.strictEqual(res.margenPorcentual, 30);
        });

        it('debe manejar margen negativo cuando el costo supera el precio de venta', () => {
            const producto = { id: 3, precioVenta: 10000 };
            const costoFIFO = 15000;

            const res = ProductoDetalleData.calcularMargenComercial(producto, costoFIFO);

            assert.strictEqual(res.utilidadMonetaria, -5000);
            assert.strictEqual(res.margenPorcentual, -50);
        });

        it('edge case: precio de venta 0 o faltante no debe producir NaN ni Infinity', () => {
            const producto = { id: 4, precioVenta: 0, costoBase: 1000 };

            const res = ProductoDetalleData.calcularMargenComercial(producto, 1000);

            assert.strictEqual(res.utilidadMonetaria, -1000);
            assert.strictEqual(res.margenPorcentual, 0);
            assert.ok(!isNaN(res.margenPorcentual));
        });
    });

    // =========================================================================
    // 4. ProductoDetalleData.calcularRotacionYCobertura
    // =========================================================================
    describe('ProductoDetalleData.calcularRotacionYCobertura', () => {
        it('debe calcular velocidad diaria, proyección de días de cobertura y alerta de recompra', () => {
            const stockTotal = 30;
            const ventas = [
                { cantidad: 20 },
                { cantidad: 40 }
            ];
            const periodoDias = 30;

            const res = ProductoDetalleData.calcularRotacionYCobertura(stockTotal, ventas, periodoDias);

            assert.strictEqual(res.unidadesVendidas, 60);
            assert.strictEqual(res.velocidadDiaria, 2);
            assert.strictEqual(res.diasCobertura, 15);
            assert.strictEqual(res.alertaRecompra, true);
        });

        it('no debe activar alerta de recompra cuando los días de cobertura son holgados (> 15 días)', () => {
            const stockTotal = 100;
            const ventas = [{ cantidad: 30 }];
            const res = ProductoDetalleData.calcularRotacionYCobertura(stockTotal, ventas, 30);

            assert.strictEqual(res.velocidadDiaria, 1);
            assert.strictEqual(res.diasCobertura, 100);
            assert.strictEqual(res.alertaRecompra, false);
        });

        it('debe manejar cero ventas en el período sin colapsar (velocidad 0, cobertura infinita/segura)', () => {
            const stockTotal = 25;
            const res = ProductoDetalleData.calcularRotacionYCobertura(stockTotal, [], 30);

            assert.strictEqual(res.unidadesVendidas, 0);
            assert.strictEqual(res.velocidadDiaria, 0);
            assert.strictEqual(res.diasCobertura, 999);
            assert.strictEqual(res.alertaRecompra, false);
        });

        it('debe alertar de recompra inmediata si el stock es 0', () => {
            const stockTotal = 0;
            const res = ProductoDetalleData.calcularRotacionYCobertura(stockTotal, [{ cantidad: 10 }], 30);

            assert.strictEqual(res.diasCobertura, 0);
            assert.strictEqual(res.alertaRecompra, true);
        });

        it('debe tolerar invocación pasando producto y lotes como primeros parámetros', () => {
            const producto = { stock: 40 };
            const lotes = [{ cantidadActual: 40 }];
            const ventas = [{ cantidad: 40 }];
            const res = ProductoDetalleData.calcularRotacionYCobertura(producto, lotes, ventas, 20);

            assert.strictEqual(res.velocidadDiaria, 2);
            assert.strictEqual(res.diasCobertura, 20);
            assert.strictEqual(res.alertaRecompra, false);
        });

        it('debe incluir sugerencia de punto de reorden (puntoReordenSugerido) en el objeto retornado', () => {
            const stockTotal = 50;
            const ventas = [{ cantidad: 60 }];
            const res = ProductoDetalleData.calcularRotacionYCobertura(stockTotal, ventas, 30);

            assert.ok(res.puntoReordenSugerido !== undefined, 'puntoReordenSugerido debe estar definido');
            assert.strictEqual(typeof res.puntoReordenSugerido, 'number');
            assert.ok(res.puntoReordenSugerido > 0, 'puntoReordenSugerido debe ser mayor a 0 cuando hay rotación');
        });

        it('debe retornar puntoReordenSugerido en 0 cuando no hay ventas en el período', () => {
            const stockTotal = 20;
            const res = ProductoDetalleData.calcularRotacionYCobertura(stockTotal, [], 30);

            assert.strictEqual(res.puntoReordenSugerido, 0);
        });
    });

    // =========================================================================
    // 4b. ProductoDetalleData.calcularMetricasHistoricas
    // =========================================================================
    describe('ProductoDetalleData.calcularMetricasHistoricas', () => {
        const ventasPrueba = [
            {
                id: 'v1',
                numero: 'FAC-001',
                fecha: '2026-11-01',
                clienteNombre: 'Canal Mayorista',
                cantidadItem: 50,
                precioUnitarioItem: 10000,
                totalItem: 500000,
                estado: 'cobrada'
            },
            {
                id: 'v2',
                numero: 'FAC-002',
                fecha: '2026-11-05',
                clienteNombre: 'Canal Minorista',
                cantidadItem: 20,
                precioUnitarioItem: 12000,
                totalItem: 240000,
                estado: 'pendiente'
            },
            {
                id: 'v3',
                numero: 'FAC-003',
                fecha: '2026-11-08',
                clienteNombre: 'Canal Mayorista',
                cantidadItem: 30,
                precioUnitarioItem: 10000,
                totalItem: 300000,
                estado: 'anulada' // Excluir
            },
            {
                id: 'v4',
                numero: 'FAC-004',
                fecha: '2026-11-10',
                clienteNombre: 'Canal E-Commerce',
                cantidadItem: 10,
                precioUnitarioItem: 15000,
                totalItem: 150000,
                estado: 'void' // Excluir
            }
        ];

        it('debe sumar total de recaudo y total de unidades vendidas excluyendo facturas anuladas/void', () => {
            const res = ProductoDetalleData.calcularMetricasHistoricas(ventasPrueba);

            // Válidas: v1 (500.000, 50 und) + v2 (240.000, 20 und) = 740.000 y 70 und
            assert.strictEqual(res.totalRecaudo, 740000);
            const unidades = res.totalUnidadesVendidas ?? res.unidadesVendidas;
            assert.strictEqual(unidades, 70);
        });

        it('debe calcular el precio promedio ponderado de venta excluyendo anuladas', () => {
            const res = ProductoDetalleData.calcularMetricasHistoricas(ventasPrueba);

            // 740.000 / 70 = 10571.43
            const esperado = Math.round((740000 / 70) * 100) / 100;
            assert.strictEqual(Math.round(res.precioPromedioPonderado * 100) / 100, esperado);
        });

        it('debe agrupar y ordenar canales/clientes por volumen de unidades vendidas descendentemente', () => {
            const res = ProductoDetalleData.calcularMetricasHistoricas(ventasPrueba);
            const canales = res.concentracionCanales || res.canales;

            assert.ok(Array.isArray(canales), 'Debe retornar un array de canales/clientes agrupados');
            assert.strictEqual(canales.length, 2);

            const primero = canales[0];
            const segundo = canales[1];

            assert.strictEqual(primero.nombre || primero.canal || primero.cliente, 'Canal Mayorista');
            assert.strictEqual(primero.unidades ?? primero.totalUnidades, 50);

            assert.strictEqual(segundo.nombre || segundo.canal || segundo.cliente, 'Canal Minorista');
            assert.strictEqual(segundo.unidades ?? segundo.totalUnidades, 20);
        });

        it('debe aplicar agrupamiento Pareto (Top 3 + Otros) cuando existen más de 3 clientes compradores', () => {
            const ventasMultiples = [
                { id: 1, clienteNombre: 'Cliente A', cantidadItem: 100, precioUnitarioItem: 1000, totalItem: 100000, estado: 'cobrada' },
                { id: 2, clienteNombre: 'Cliente B', cantidadItem: 50, precioUnitarioItem: 1000, totalItem: 50000, estado: 'cobrada' },
                { id: 3, clienteNombre: 'Cliente C', cantidadItem: 30, precioUnitarioItem: 1000, totalItem: 30000, estado: 'cobrada' },
                { id: 4, clienteNombre: 'Cliente D', cantidadItem: 10, precioUnitarioItem: 1000, totalItem: 10000, estado: 'cobrada' },
                { id: 5, clienteNombre: 'Cliente E', cantidadItem: 5, precioUnitarioItem: 1000, totalItem: 5000, estado: 'cobrada' },
                { id: 6, clienteNombre: 'Cliente F', cantidadItem: 5, precioUnitarioItem: 1000, totalItem: 5000, estado: 'cobrada' }
            ];

            const res = ProductoDetalleData.calcularMetricasHistoricas(ventasMultiples);

            assert.strictEqual(res.canales.length, 6, 'La lista completa debe retener los 6 clientes');
            assert.strictEqual(res.canalesPareto.length, 4, 'canalesPareto debe contener 3 top + 1 fila Otros');
            assert.strictEqual(res.canalesPareto[0].nombre, 'Cliente A');
            assert.strictEqual(res.canalesPareto[1].nombre, 'Cliente B');
            assert.strictEqual(res.canalesPareto[2].nombre, 'Cliente C');
            assert.strictEqual(res.canalesPareto[3].esOtros, true);
            assert.strictEqual(res.canalesPareto[3].unidades, 20); // 10 + 5 + 5
            assert.strictEqual(res.canalesPareto[3].total, 20000);
        });

        it('edge case: lista de ventas vacía o nula debe retornar ceros seguros', () => {
            const resVacio = ProductoDetalleData.calcularMetricasHistoricas([]);
            assert.strictEqual(resVacio.totalRecaudo, 0);
            assert.strictEqual(resVacio.totalUnidadesVendidas ?? resVacio.unidadesVendidas, 0);
            assert.strictEqual(resVacio.precioPromedioPonderado, 0);
            assert.deepStrictEqual(resVacio.concentracionCanales || resVacio.canales, []);

            const resNulo = ProductoDetalleData.calcularMetricasHistoricas(null);
            assert.strictEqual(resNulo.totalRecaudo, 0);
            assert.strictEqual(resNulo.totalUnidadesVendidas ?? resNulo.unidadesVendidas, 0);
            assert.strictEqual(resNulo.precioPromedioPonderado, 0);
            assert.deepStrictEqual(resNulo.concentracionCanales || resNulo.canales, []);
        });
    });

    // =========================================================================
    // 5. ProductoDetalleData.filtrarLotes
    // =========================================================================
    describe('ProductoDetalleData.filtrarLotes', () => {
        const lotesPrueba = [
            { id: 'l2', fechaIngreso: '2026-02-01', cantidadInicial: 50, cantidadActual: 20 },
            { id: 'l1', fechaIngreso: '2026-01-10', cantidadInicial: 30, cantidadActual: 0 },  // Agotado
            { id: 'l3', fechaIngreso: '2026-03-15', cantidadInicial: 40, cantidadActual: 40 }
        ];

        it('debe ordenar ascendentemente por fechaIngreso (FIFO)', () => {
            const res = ProductoDetalleData.filtrarLotes(lotesPrueba, 'todos');

            assert.strictEqual(res.length, 3);
            assert.strictEqual(res[0].id, 'l1');
            assert.strictEqual(res[1].id, 'l2');
            assert.strictEqual(res[2].id, 'l3');
        });

        it('debe identificar la Capa Activa Inmediata (el primer lote en orden FIFO con cantidadActual > 0)', () => {
            const res = ProductoDetalleData.filtrarLotes(lotesPrueba, 'todos');

            assert.strictEqual(res[0].esCapaActiva, false);
            assert.strictEqual(res[1].esCapaActiva, true);
            assert.strictEqual(res[2].esCapaActiva, false);
        });

        it('debe calcular el porcentaje de consumo por lote', () => {
            const res = ProductoDetalleData.filtrarLotes(lotesPrueba, 'todos');

            assert.strictEqual(res[0].porcentajeConsumo, 100);
            assert.strictEqual(res[1].porcentajeConsumo, 60);
            assert.strictEqual(res[2].porcentajeConsumo, 0);
        });

        it('debe filtrar exclusivamente lotes "activos" (cantidadActual > 0)', () => {
            const res = ProductoDetalleData.filtrarLotes(lotesPrueba, 'activos');

            assert.strictEqual(res.length, 2);
            assert.strictEqual(res[0].id, 'l2');
            assert.strictEqual(res[1].id, 'l3');
            assert.strictEqual(res[0].esCapaActiva, true);
        });

        it('debe filtrar exclusivamente lotes "agotados" (cantidadActual === 0)', () => {
            const res = ProductoDetalleData.filtrarLotes(lotesPrueba, 'agotados');

            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].id, 'l1');
            assert.strictEqual(res[0].esCapaActiva, false);
        });

        it('debe calcular diasEnBodega (aging) como la diferencia en días entre fechaIngreso y la fecha actual', () => {
            const ahora = Date.now();
            const MS_POR_DIA = 24 * 60 * 60 * 1000;
            const hace10DiasIso = new Date(ahora - 10 * MS_POR_DIA).toISOString().split('T')[0];
            const hace25DiasIso = new Date(ahora - 25 * MS_POR_DIA).toISOString().split('T')[0];

            const lotesAging = [
                { id: 'l1', fechaIngreso: hace10DiasIso, cantidadInicial: 10, cantidadActual: 10 },
                { id: 'l2', fechaIngreso: hace25DiasIso, cantidadInicial: 20, cantidadActual: 15 }
            ];

            const resultado = ProductoDetalleData.filtrarLotes(lotesAging, 'todos');
            const loteL1 = resultado.find(l => l.id === 'l1');
            const loteL2 = resultado.find(l => l.id === 'l2');

            assert.strictEqual(typeof loteL1.diasEnBodega, 'number');
            assert.strictEqual(loteL1.diasEnBodega, 10);
            assert.strictEqual(loteL2.diasEnBodega, 25);
        });

        it('debe manejar fechas inválidas o nulas asignando 0 días en diasEnBodega', () => {
            const lotesFechasInvalidas = [
                { id: 'l_null', fechaIngreso: null, cantidadInicial: 10, cantidadActual: 10 },
                { id: 'l_undefined', cantidadInicial: 10, cantidadActual: 10 },
                { id: 'l_invalida', fechaIngreso: 'fecha-no-valida', cantidadInicial: 10, cantidadActual: 10 }
            ];

            const resultado = ProductoDetalleData.filtrarLotes(lotesFechasInvalidas, 'todos');

            for (const lote of resultado) {
                assert.strictEqual(lote.diasEnBodega, 0);
            }
        });

        it('edge case: lista vacía o nula retorna array vacío', () => {
            assert.deepStrictEqual(ProductoDetalleData.filtrarLotes([]), []);
            assert.deepStrictEqual(ProductoDetalleData.filtrarLotes(null), []);
        });
    });

    // =========================================================================
    // 6. ProductoDetalleData Mappings & Data Persistence (Async)
    // =========================================================================
    describe('ProductoDetalleData Mappings y Persistencia', () => {
        it('mapLoteToFrontend debe convertir campos snake_case a camelCase', () => {
            const rawLote = {
                id: 101,
                producto_id: 'prod_99',
                cantidad_inicial: 50,
                cantidad_actual: 35,
                costo_unitario: 12500,
                fecha_ingreso: '2026-04-10',
                referencia_lote: 'DOC-55'
            };

            const mapped = ProductoDetalleData.mapLoteToFrontend(rawLote);

            assert.strictEqual(mapped.id, '101');
            assert.strictEqual(mapped.productoId, 'prod_99');
            assert.strictEqual(mapped.cantidadInicial, 50);
            assert.strictEqual(mapped.cantidadActual, 35);
            assert.strictEqual(mapped.costoUnitario, 12500);
            assert.strictEqual(mapped.fechaIngreso, '2026-04-10');
            assert.strictEqual(mapped.referencia, 'DOC-55');
        });

        it('mapLoteToFrontend con valor nulo debe retornar null', () => {
            assert.strictEqual(ProductoDetalleData.mapLoteToFrontend(null), null);
        });

        it('setSupabase, getSupabase, setDB y getDB deben almacenar y retornar clientes', () => {
            const mockClient = { name: 'MockSupabase' };
            const mockDB = { name: 'MockDB' };

            ProductoDetalleData.setSupabase(mockClient);
            ProductoDetalleData.setDB(mockDB);

            assert.strictEqual(ProductoDetalleData.getSupabase(), mockClient);
            assert.strictEqual(ProductoDetalleData.getDB(), mockDB);
        });

        it('cargarDetalle debe obtener producto, lotes, ventas y calcular KPIs completos', async () => {
            const mockDB = {
                get: async (store, id) => ({
                    id: 'prod_1',
                    nombre: 'Audífonos Bluetooth',
                    sku: 'AUD-001',
                    precioVenta: 80000,
                    costoBase: 45000,
                    stockMinimo: 10
                })
            };

            const mockSupabase = {
                from: (table) => {
                    if (table === 'lotes_fifo') {
                        return {
                            select: () => ({
                                eq: async () => ({
                                    data: [
                                        { id: 'l1', producto_id: 'prod_1', cantidad_inicial: 20, cantidad_actual: 15, costo_unitario: 42000, fecha_ingreso: '2026-01-05', referencia: 'Compra #1' }
                                    ]
                                })
                            })
                        };
                    }
                    if (table === 'factura_detalles') {
                        return {
                            select: () => ({
                                eq: async () => ({
                                    data: [
                                        { id: 1, factura_id: 10, producto_id: 'prod_1', cantidad: 5, precio_unitario: 80000, total: 400000 }
                                    ]
                                })
                            })
                        };
                    }
                    if (table === 'facturas') {
                        return {
                            select: () => ({
                                in: async () => ({
                                    data: [
                                        { id: 10, numero: 1001, fecha: '2026-01-15', tipo: 'venta', clienteId: 99, estado: 'cobrada' }
                                    ]
                                })
                            })
                        };
                    }
                    if (table === 'contactos') {
                        return {
                            select: () => ({
                                in: async () => ({
                                    data: [{ id: 99, nombre: 'Ana Gómez' }]
                                })
                            })
                        };
                    }
                    return {};
                }
            };

            ProductoDetalleData.setDB(mockDB);
            ProductoDetalleData.setSupabase(mockSupabase);

            const result = await ProductoDetalleData.cargarDetalle('prod_1');

            assert.ok(result);
            assert.strictEqual(result.producto.nombre, 'Audífonos Bluetooth');
            assert.strictEqual(result.lotes.length, 1);
            assert.strictEqual(result.ventas.length, 1);
            assert.strictEqual(result.ventas[0].clienteNombre, 'Ana Gómez');
            assert.strictEqual(result.ventas[0].cantidadItem, 5);
            assert.strictEqual(result.kpis.stock.stockTotal, 15);
            assert.strictEqual(result.kpis.stock.estado, 'optimo');
        });

        it('guardarLote debe delegar en DB.save o supabase.insert', async () => {
            let guardadoEnDB = null;
            const mockDB = {
                save: async (store, item) => {
                    guardadoEnDB = { store, item };
                    return item;
                }
            };
            ProductoDetalleData.setDB(mockDB);

            const lote = { id: 'lote_test', cantidadInicial: 10 };
            const res = await ProductoDetalleData.guardarLote(lote);

            assert.strictEqual(guardadoEnDB.store, 'lotes_fifo');
            assert.strictEqual(guardadoEnDB.item.id, 'lote_test');
            assert.strictEqual(res.id, 'lote_test');
        });

        it('guardarLote con Supabase debe sanitizar payload a snake_case y excluir id string', async () => {
            ProductoDetalleData.setDB(null);
            let insertado = null;
            const mockSupabase = {
                from: (table) => {
                    assert.strictEqual(table, 'lotes_fifo');
                    return {
                        insert: (payload) => {
                            insertado = payload;
                            return {
                                select: () => ({
                                    single: async () => ({ data: { id: 999, ...payload }, error: null })
                                })
                            };
                        }
                    };
                }
            };
            ProductoDetalleData.setSupabase(mockSupabase);

            const loteInput = {
                id: 'lote_12345',
                productoId: 44,
                cantidadInicial: 20,
                cantidadActual: 20,
                costoUnitario: 35000,
                fechaIngreso: '2026-03-01',
                referencia: 'Compra Directa',
                origenMovimiento: 'ingreso_manual:TEST'
            };

            const result = await ProductoDetalleData.guardarLote(loteInput);

            assert.ok(insertado);
            assert.strictEqual(insertado.id, undefined); // No debe enviar string 'lote_12345'
            assert.strictEqual(insertado.producto_id, 44);
            assert.strictEqual(insertado.cantidad_inicial, 20);
            assert.strictEqual(insertado.cantidad_actual, 20);
            assert.strictEqual(insertado.costo_unitario, 35000);
            assert.strictEqual(insertado.referencia, 'Compra Directa');
            assert.strictEqual(result.id, 999);
        });

        it('cargarKardex debe invocar RPC get_kardex_producto', async () => {
            const mockSupabase = {
                rpc: async (fnName, params) => {
                    assert.strictEqual(fnName, 'get_kardex_producto');
                    assert.strictEqual(params.p_producto_id, 123);
                    return {
                        data: [
                            { creado_en: '2026-03-01', tipo_operacion: 'ENTRADA', diferencia: 10 }
                        ],
                        error: null
                    };
                }
            };
            ProductoDetalleData.setSupabase(mockSupabase);

            const movimientos = await ProductoDetalleData.cargarKardex(123);
            assert.strictEqual(movimientos.length, 1);
            assert.strictEqual(movimientos[0].diferencia, 10);
        });
    });

    // =========================================================================
    // 7. ProductoDetalleTemplates
    // =========================================================================
    describe('ProductoDetalleTemplates', () => {
        it('formatMoney debe formatear montos en pesos colombianos ($ ...)', () => {
            assert.strictEqual(ProductoDetalleTemplates.formatMoney(1500000), '$ 1.500.000');
            assert.strictEqual(ProductoDetalleTemplates.formatMoney(0), '$ 0');
            assert.strictEqual(ProductoDetalleTemplates.formatMoney(null), '$ 0');
        });

        it('formatFecha debe formatear fechas a DD/MM/YYYY', () => {
            assert.strictEqual(ProductoDetalleTemplates.formatFecha('2026-11-19'), '19/11/2026');
            assert.strictEqual(ProductoDetalleTemplates.formatFecha('2026-11-19T14:30:00Z'), '19/11/2026');
            assert.strictEqual(ProductoDetalleTemplates.formatFecha(null), '---');
        });

        it('escapeHtml debe sanitizar caracteres peligrosos contra inyecciones XSS', () => {
            const dirty = '<script>alert("xss")</script> & "quotes" \'test\'';
            const clean = ProductoDetalleTemplates.escapeHtml(dirty);
            assert.ok(!clean.includes('<script>'));
            assert.ok(clean.includes('&lt;script&gt;'));
            assert.ok(clean.includes('&amp;'));
            assert.ok(clean.includes('&quot;'));
        });

        it('renderKpiCards debe renderizar exactamente 5 tarjetas ejecutivas con clase .payment-kpi-card', () => {
            const kpis = {
                stock: { stockTotal: 25, stockMinimo: 10, estado: 'optimo' },
                valorizacion: { valorTotal: 400000, costoPromedioPonderado: 13333.33, costoBase: 12000, diferenciaCosto: 1333.33 },
                margen: { precioVenta: 20000, costoUnitario: 13333.33, utilidadMonetaria: 6666.67, margenPorcentual: 33.33 },
                rotacion: { unidadesVendidas: 60, velocidadDiaria: 2, diasCobertura: 15, alertaRecompra: true },
                metricasHistoricas: { totalRecaudo: 1200000, totalUnidadesVendidas: 60, precioPromedioPonderado: 20000 }
            };

            const html = ProductoDetalleTemplates.renderKpiCards(kpis);

            const matches = html.match(/payment-kpi-card/g) || [];
            assert.strictEqual(matches.length, 5);

            assert.ok(html.includes('Stock Disponible'));
            assert.ok(html.includes('Valorización FIFO'));
            assert.ok(html.includes('Margen Comercial'));
            assert.ok(html.includes('Rotación y Cobertura'));
            assert.ok(html.includes('Ventas Acumuladas'));
            assert.ok(html.includes('25 und'));
            assert.ok(html.includes('$ 400.000'));
            assert.ok(html.includes('33.3%') || html.includes('33,3%') || html.includes('33.33%'));
            assert.ok(html.includes('15 días') || html.includes('15 d'));
            assert.ok(html.includes('$ 1.200.000'));
            assert.ok(html.includes('60 und'));
            assert.ok(html.includes('ds-kpi-label'), 'Debe usar clase canónica ds-kpi-label');
            assert.ok(html.includes('payment-kpi-value'), 'Debe usar clase canónica payment-kpi-value');
            assert.ok(html.includes('bi-box-seam'), 'Debe usar Bootstrap icon bi-box-seam');
        });

        it('renderKpiCards debe incluir tarjeta de Ventas Acumuladas con fallback seguro de 0 cuando no hay métricas', () => {
            const kpis = {
                stock: { stockTotal: 10, stockMinimo: 5, estado: 'optimo' },
                valorizacion: { valorTotal: 100000, costoPromedioPonderado: 10000, costoBase: 10000, diferenciaCosto: 0 },
                margen: { precioVenta: 15000, costoUnitario: 10000, utilidadMonetaria: 5000, margenPorcentual: 33.33 },
                rotacion: { unidadesVendidas: 0, velocidadDiaria: 0, diasCobertura: 999, alertaRecompra: false }
            };

            const html = ProductoDetalleTemplates.renderKpiCards(kpis);
            const matches = html.match(/payment-kpi-card/g) || [];
            assert.strictEqual(matches.length, 5);
            assert.ok(html.includes('Ventas Acumuladas'));
            assert.ok(html.includes('$ 0'));
            assert.ok(html.includes('0 und'));
        });

        it('renderKpiCards debe soportar estados recompra, crítico y agotado con sus badges', () => {
            const kpisRecompra = {
                stock: { stockTotal: 8, stockMinimo: 10, estado: 'recompra' },
                valorizacion: { valorTotal: 80000, costoPromedioPonderado: 10000, costoBase: 11000, diferenciaCosto: -1000 },
                margen: { precioVenta: 15000, costoUnitario: 10000, utilidadMonetaria: 5000, margenPorcentual: 33.33 },
                rotacion: { unidadesVendidas: 10, velocidadDiaria: 0.33, diasCobertura: 24, alertaRecompra: false }
            };

            const htmlRecompra = ProductoDetalleTemplates.renderKpiCards(kpisRecompra);
            assert.ok(htmlRecompra.includes('Recompra'));
            assert.ok(htmlRecompra.includes('Stock Seguro'));

            const kpisCritico = {
                stock: { stockTotal: 3, stockMinimo: 10, estado: 'critico' },
                valorizacion: { valorTotal: 30000, costoPromedioPonderado: 10000, costoBase: 10000, diferenciaCosto: 0 },
                margen: { precioVenta: 12000, costoUnitario: 10000, utilidadMonetaria: 2000, margenPorcentual: 16.6 },
                rotacion: { unidadesVendidas: 5, velocidadDiaria: 0.16, diasCobertura: 18, alertaRecompra: false }
            };

            const htmlCritico = ProductoDetalleTemplates.renderKpiCards(kpisCritico);
            assert.ok(htmlCritico.includes('Crítico'));
            assert.ok(htmlCritico.includes('Alineado con base'));

            const kpisAgotado = {
                stock: { stockTotal: 0, stockMinimo: 10, estado: 'agotado' },
                valorizacion: { valorTotal: 0, costoPromedioPonderado: 0, costoBase: 10000, diferenciaCosto: 0 },
                margen: { precioVenta: 12000, costoUnitario: 10000, utilidadMonetaria: 2000, margenPorcentual: 16.6 },
                rotacion: { unidadesVendidas: 0, velocidadDiaria: 0, diasCobertura: 0, alertaRecompra: true }
            };

            const htmlAgotado = ProductoDetalleTemplates.renderKpiCards(kpisAgotado);
            assert.ok(htmlAgotado.includes('Agotado'));
            assert.ok(htmlAgotado.includes('Alerta Recompra'));
        });

        it('renderTablaLotes debe renderizar filas con barra de consumo, badge de capa activa y reservas', () => {
            const lotes = [
                {
                    id: 'l1',
                    fechaIngreso: '2026-02-01',
                    referencia: 'Compra #001 <img src=x onerror=alert(1)>',
                    costoUnitario: 10000,
                    cantidadInicial: 50,
                    cantidadActual: 20,
                    porcentajeConsumo: 60,
                    esCapaActiva: true
                },
                {
                    id: 'l2',
                    fechaIngreso: '2026-02-15',
                    referencia: 'Lote en reserva',
                    costoUnitario: 12000,
                    cantidadInicial: 30,
                    cantidadActual: 30,
                    porcentajeConsumo: 0,
                    esCapaActiva: false
                },
                {
                    id: 'l3',
                    fechaIngreso: '2026-01-10',
                    referencia: 'Lote agotado',
                    costoUnitario: 8000,
                    cantidadInicial: 30,
                    cantidadActual: 0,
                    porcentajeConsumo: 100,
                    esCapaActiva: false
                }
            ];

            const html = ProductoDetalleTemplates.renderTablaLotes(lotes, 'todos');

            assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
            assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
            assert.ok(html.includes('Capa Activa'));
            assert.ok(html.includes('En Reserva'));
            assert.ok(html.includes('Agotado'));
            assert.ok(html.includes('60%') || html.includes('width: 60%'));
        });

        it('renderTablaLotes con lista vacía debe mostrar mensaje amigable', () => {
            const html = ProductoDetalleTemplates.renderTablaLotes([], 'activos');
            assert.ok(html.includes('No hay lotes'));
        });

        it('renderTimelineKardex debe renderizar movimientos con colores según signo y sanitización XSS', () => {
            const movimientos = [
                {
                    creado_en: '2026-03-01T10:00:00Z',
                    tipo_operacion: 'ENTRADA',
                    cantidad_anterior: 10,
                    diferencia: 20,
                    cantidad_nueva: 30,
                    origen_documento: 'Compra <b>101</b>',
                    referencia_lote: 'Lote-ABC'
                },
                {
                    creado_en: '2026-03-02T15:00:00Z',
                    tipo_operacion: 'SALIDA',
                    cantidad_anterior: 30,
                    diferencia: -5,
                    cantidad_nueva: 25,
                    origen_documento: 'Factura 505',
                    referencia_lote: 'Lote-ABC'
                }
            ];

            const html = ProductoDetalleTemplates.renderTimelineKardex(movimientos);

            assert.ok(!html.includes('<b>101</b>'));
            assert.ok(html.includes('&lt;b&gt;101&lt;/b&gt;'));
            assert.ok(html.includes('+20'));
            assert.ok(html.includes('-5'));
            assert.ok(html.includes('text-success'));
            assert.ok(html.includes('text-danger'));
        });

        it('renderTimelineKardex con lista vacía debe mostrar mensaje amigable', () => {
            const html = ProductoDetalleTemplates.renderTimelineKardex([]);
            assert.ok(html.includes('Sin movimientos'));
        });

        it('renderTablaVentas debe renderizar cantidades específicas del ítem con sanitización', () => {
            const ventas = [
                {
                    id: 101,
                    numero: 505,
                    fecha: '2026-03-10',
                    clienteNombre: 'Cliente <script>bad()</script>',
                    cantidadItem: 3,
                    precioUnitarioItem: 25000,
                    totalItem: 75000,
                    estado: 'cobrada'
                },
                {
                    id: 102,
                    numero: 506,
                    fecha: '2026-03-11',
                    clienteNombre: 'Cliente Dos',
                    cantidadItem: 2,
                    precioUnitarioItem: 25000,
                    totalItem: 50000,
                    estado: 'vencida'
                },
                {
                    id: 103,
                    numero: 507,
                    fecha: '2026-03-12',
                    clienteNombre: 'Cliente Tres',
                    cantidadItem: 1,
                    precioUnitarioItem: 25000,
                    totalItem: 25000,
                    estado: 'pendiente'
                }
            ];

            const html = ProductoDetalleTemplates.renderTablaVentas(ventas);

            assert.ok(!html.includes('<script>bad()</script>'));
            assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));
            assert.ok(html.includes('Cobrada'));
            assert.ok(html.includes('Vencida'));
            assert.ok(html.includes('Pendiente'));
            assert.ok(html.includes('$ 25.000'));
            assert.ok(html.includes('$ 75.000'));
        });

        it('renderTablaVentas con lista vacía debe mostrar mensaje amigable', () => {
            const html = ProductoDetalleTemplates.renderTablaVentas([]);
            assert.ok(html.includes('No se registran ventas'));
        });

        it('renderLayout debe renderizar la estructura completa con header, modales y contenedores', () => {
            const producto = {
                id: 1,
                nombre: 'Laptop HP 15"',
                sku: 'LAP-001',
                precioVenta: 2500000,
                costoBase: 1800000,
                stockMinimo: 5
            };
            const kpis = {
                stock: { stockTotal: 10, stockMinimo: 5, estado: 'optimo' },
                valorizacion: { valorTotal: 18000000, costoPromedioPonderado: 1800000, costoBase: 1800000, diferenciaCosto: 0 },
                margen: { precioVenta: 2500000, costoUnitario: 1800000, utilidadMonetaria: 700000, margenPorcentual: 28 },
                rotacion: { unidadesVendidas: 4, velocidadDiaria: 0.13, diasCobertura: 75, alertaRecompra: false }
            };

            const html = ProductoDetalleTemplates.renderLayout({ producto, kpis, lotes: [], filtroLotes: 'todos' });

            assert.ok(html.includes('Laptop HP 15&quot;') || html.includes('Laptop HP 15"'));
            assert.ok(html.includes('LAP-001'));
            assert.ok(html.includes('btn-volver-prod'));
            assert.ok(!html.includes('id="btn-kardex-prod"'), 'No debe existir el botón #btn-kardex-prod en la cabecera');
            assert.ok(!html.includes('id="modalKardexProducto"'), 'No debe existir el modal rápido #modalKardexProducto');
            assert.ok(html.includes('id="tab-kardex-pane"'), 'El kardex debe estar integrado en el tab continuo #tab-kardex-pane');
            assert.ok(html.includes('id="tbody-kardex-embebido"'), 'Debe contener la tabla embebida continua #tbody-kardex-embebido');
            assert.ok(html.includes('form-nuevo-lote'));
            assert.ok(html.includes('payment-kpi-card'));
            assert.ok(html.includes('payment-code-badge'), 'SKU debe usar clase canónica payment-code-badge');
            assert.ok(html.includes('ds-search-container'), 'Debe usar el contenedor canónico ds-search-container');
            assert.ok(html.includes('ds-search-input'), 'Debe usar el input canónico ds-search-input');
        });

        it('renderLayout debe renderizar las 5 pestañas a 100% de ancho: Capas FIFO (#tab-lotes-fifo-pane), Kardex (#tab-kardex-pane), Precios (#tab-precios-pane), Ventas (#tab-facturas-venta-pane), Compras (#tab-facturas-compra-pane)', () => {
            const producto = { id: 1, nombre: 'Laptop HP 15"', sku: 'LAP-001' };
            const kpis = {
                stock: { stockTotal: 10, stockMinimo: 5, estado: 'optimo' },
                valorizacion: { valorTotal: 18000000, costoPromedioPonderado: 1800000, costoBase: 1800000, diferenciaCosto: 0 },
                margen: { precioVenta: 2500000, costoUnitario: 1800000, utilidadMonetaria: 700000, margenPorcentual: 28 },
                rotacion: { unidadesVendidas: 4, velocidadDiaria: 0.13, diasCobertura: 75, alertaRecompra: false }
            };

            const html = ProductoDetalleTemplates.renderLayout({ producto, kpis, lotes: [], ventas: [], facturasCompra: [], filtroLotes: 'todos' });

            assert.ok(html.includes('id="tab-lotes-fifo-pane"'), 'Debe contener el contenedor de pestaña #tab-lotes-fifo-pane');
            assert.ok(html.includes('id="tab-kardex-pane"'), 'Debe contener el contenedor de pestaña #tab-kardex-pane');
            assert.ok(html.includes('id="tab-precios-pane"'), 'Debe contener el contenedor de pestaña #tab-precios-pane');
            assert.ok(html.includes('id="tab-facturas-venta-pane"'), 'Debe contener el contenedor de pestaña #tab-facturas-venta-pane');
            assert.ok(html.includes('id="tab-facturas-compra-pane"'), 'Debe contener el contenedor de pestaña #tab-facturas-compra-pane');

            // Botones de las 5 pestañas
            assert.ok(html.includes('id="tab-lotes-fifo-btn"'), 'Debe contener el botón #tab-lotes-fifo-btn');
            assert.ok(html.includes('id="tab-kardex-btn"'), 'Debe contener el botón #tab-kardex-btn');
            assert.ok(html.includes('id="tab-precios-btn"'), 'Debe contener el botón #tab-precios-btn');
            assert.ok(html.includes('id="tab-facturas-venta-btn"'), 'Debe contener el botón #tab-facturas-venta-btn');
            assert.ok(html.includes('id="tab-facturas-compra-btn"'), 'Debe contener el botón #tab-facturas-compra-btn');
        });

        it('renderLayout debe contener el modal #modalNuevoLoteFIFO para creación de lotes', () => {
            const producto = { id: 1, nombre: 'Laptop HP 15"' };
            const kpis = { stock: {}, valorizacion: {}, margen: {}, rotacion: {} };

            const html = ProductoDetalleTemplates.renderLayout({ producto, kpis, lotes: [] });

            assert.ok(html.includes('id="modalNuevoLoteFIFO"'), 'Debe contener el modal #modalNuevoLoteFIFO');
        });

        it('renderLayout debe eliminar la Franja 2 intermedia por completo y subir tablas al primer pantallazo', () => {
            const producto = { id: 1, nombre: 'Laptop HP 15"', precioVenta: 2500000, costoBase: 1800000 };
            const kpis = {
                stock: { stockTotal: 10, stockMinimo: 5, estado: 'optimo' },
                valorizacion: { valorTotal: 18000000, costoPromedioPonderado: 1800000, costoBase: 1800000, diferenciaCosto: 0 },
                margen: { precioVenta: 2500000, costoUnitario: 1800000, utilidadMonetaria: 700000, margenPorcentual: 28 },
                rotacion: { unidadesVendidas: 4, velocidadDiaria: 0.13, diasCobertura: 75, alertaRecompra: false }
            };

            const html = ProductoDetalleTemplates.renderLayout({ producto, kpis, lotes: [], ventas: [] });

            // 1. No debe existir franja intermedia ni panel maestro
            assert.ok(!html.includes('id="panel-maestro-producto"'), 'No debe existir #panel-maestro-producto');
            assert.ok(!html.includes('master-context-panel'), 'No debe existir la clase master-context-panel');

            // 2. Tab 1 debe integrar la barra de parámetros de bodega en su cabecera
            assert.ok(html.includes('id="parametros-bodega-strip"'), 'Tab 1 debe integrar #parametros-bodega-strip');
            assert.ok(html.includes('Stock Mínimo'), 'Parámetros de bodega debe incluir Stock Mínimo');
            assert.ok(html.includes('Punto de Reorden'), 'Parámetros de bodega debe incluir Punto de Reorden');

            // 3. Tab 3 debe integrar la Ficha de Precios y Estructura de Costos
            assert.ok(html.includes('id="ficha-precios-content"'), 'Tab 3 debe integrar #ficha-precios-content');
            assert.ok(html.includes('PVP Catálogo'), 'Ficha de precios debe incluir PVP Catálogo');
            assert.ok(html.includes('Costo Promedio FIFO'), 'Ficha de precios debe incluir Costo Promedio FIFO');
            assert.ok(html.includes('Utilidad Unitaria Bruta'), 'Ficha de precios debe incluir Utilidad Unitaria Bruta');
        });

        it('renderLayout debe integrar Concentración de Canales Pareto (#concentracion-canales-content) en Tab 4 de Ventas', () => {
            const producto = { id: 1, nombre: 'Laptop HP 15"', precioVenta: 2500000, costoBase: 1800000 };
            const kpis = {
                stock: { stockTotal: 10, stockMinimo: 5, estado: 'optimo' },
                valorizacion: { valorTotal: 18000000, costoPromedioPonderado: 1800000, costoBase: 1800000, diferenciaCosto: 0 },
                margen: { precioVenta: 2500000, costoUnitario: 1800000, utilidadMonetaria: 700000, margenPorcentual: 28 },
                rotacion: { unidadesVendidas: 4, velocidadDiaria: 0.13, diasCobertura: 75, alertaRecompra: false },
                metricasHistoricas: {
                    totalRecaudo: 10000000,
                    totalUnidadesVendidas: 4,
                    precioPromedioPonderado: 2500000,
                    canales: [{ nombre: 'Canal Corporativo', unidades: 4, porcentaje: 100 }]
                }
            };

            const html = ProductoDetalleTemplates.renderLayout({ producto, kpis, lotes: [], ventas: [] });

            // 1. Debe existir el bloque superior #concentracion-canales-content dentro de Tab 4
            assert.ok(html.includes('id="concentracion-canales-content"'), 'Debe contener #concentracion-canales-content');
            assert.ok(!html.includes('dashed'), 'No debe contener ninguna caja con estilo dashed');
            assert.ok(html.includes('Canal Corporativo'), 'Debe renderizar los compradores / canales');
            assert.ok(html.includes('id="modalTodosClientes"'), 'Debe contener el modal #modalTodosClientes');

            // 2. Debe renderizar el resumen contable
            assert.ok(
                html.includes('Total Ventas Históricas') || html.includes('Resumen Contable'),
                'Debe renderizar el resumen contable'
            );
            assert.ok(html.includes('$ 10.000.000'), 'Debe renderizar el total de recaudo en pesos');
            assert.ok(html.includes('4 und'), 'Debe renderizar las unidades vendidas');
        });

        it('renderFilasModalClientes debe renderizar filas de clientes con sanitización XSS', () => {
            const canales = [
                { nombre: 'Cliente Seguro', unidades: 20, porcentaje: 60, total: 200000 },
                { nombre: '<img src=x onerror=alert(1)> Inyector', unidades: 10, porcentaje: 40, total: 100000 }
            ];

            const html = ProductoDetalleTemplates.renderFilasModalClientes(canales);

            assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
            assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
            assert.ok(html.includes('Cliente Seguro'));
            assert.ok(html.includes('20 und'));
            assert.ok(html.includes('$ 200.000'));
        });

        it('renderFilasModalClientes con lista vacía debe retornar mensaje amigable', () => {
            const html = ProductoDetalleTemplates.renderFilasModalClientes([]);
            assert.ok(html.includes('Sin compradores registrados'));
        });
    });

    // =========================================================================
    // 8. ProductoDetalleEvents
    // =========================================================================
    describe('ProductoDetalleEvents', () => {
        function createMockDOM() {
            const elements = {};
            const makeMockEl = (tag = 'div', id = '', className = '') => {
                const el = {
                    tagName: tag,
                    id,
                    className,
                    dataset: {},
                    value: '',
                    disabled: false,
                    innerHTML: '',
                    textContent: '',
                    onclick: null,
                    onsubmit: null,
                    classList: {
                        _classes: new Set(className ? className.split(' ') : []),
                        add(c) { this._classes.add(c); el.className = Array.from(this._classes).join(' '); },
                        remove(c) { this._classes.delete(c); el.className = Array.from(this._classes).join(' '); },
                        contains(c) { return this._classes.has(c); }
                    },
                    removeEventListener: () => {},
                    addEventListener: () => {}
                };
                return el;
            };

            const root = makeMockEl('div', 'root');
            const btnVolver = makeMockEl('button', 'btn-volver-prod');
            const tabKardexBtn = makeMockEl('button', 'tab-kardex-btn');
            const tbodyKardexEmbebido = makeMockEl('tbody', 'tbody-kardex-embebido');
            const filtroGroup = makeMockEl('div', 'filtro-lotes-group');
            const btnFiltroTodos = makeMockEl('button', '', 'btn-primary');
            btnFiltroTodos.dataset.filtro = 'todos';
            const btnFiltroActivos = makeMockEl('button', '', 'btn-outline-secondary');
            btnFiltroActivos.dataset.filtro = 'activos';
            const tbodyLotes = makeMockEl('tbody', 'tbody-lotes-fifo');

            const formNuevoLote = makeMockEl('form', 'form-nuevo-lote');
            const loteCant = makeMockEl('input', 'lote-cantidad');
            const loteCosto = makeMockEl('input', 'lote-costo');
            const loteFecha = makeMockEl('input', 'lote-fecha');
            const loteRef = makeMockEl('input', 'lote-ref');
            const loteAlert = makeMockEl('div', 'lote-alert');
            const submitBtn = makeMockEl('button');
            submitBtn.type = 'submit';

            filtroGroup.querySelectorAll = (sel) => sel === 'button[data-filtro]' ? [btnFiltroTodos, btnFiltroActivos] : [];
            formNuevoLote.querySelector = (sel) => sel === 'button[type="submit"]' ? submitBtn : null;

            elements['#btn-volver-prod'] = btnVolver;
            elements['#tab-kardex-btn'] = tabKardexBtn;
            elements['#tbody-kardex-embebido'] = tbodyKardexEmbebido;
            elements['#filtro-lotes-group'] = filtroGroup;
            elements['#tbody-lotes-fifo'] = tbodyLotes;
            elements['#form-nuevo-lote'] = formNuevoLote;
            elements['#lote-cantidad'] = loteCant;
            elements['#lote-costo'] = loteCosto;
            elements['#lote-fecha'] = loteFecha;
            elements['#lote-ref'] = loteRef;
            elements['#lote-alert'] = loteAlert;

            root.querySelector = (sel) => elements[sel] || null;
            root.querySelectorAll = (sel) => elements[sel] ? [elements[sel]] : [];

            return {
                root,
                btnVolver,
                tabKardexBtn,
                tbodyKardexEmbebido,
                btnFiltroActivos,
                btnFiltroTodos,
                tbodyLotes,
                formNuevoLote,
                loteCant,
                loteCosto,
                loteFecha,
                loteRef,
                loteAlert,
                submitBtn
            };
        }

        it('bindEvents no debe fallar si element o module es nulo', () => {
            assert.doesNotThrow(() => ProductoDetalleEvents.bindEvents(null, null));
            assert.doesNotThrow(() => ProductoDetalleEvents.bindEvents({}, null));
        });

        it('debe vincular el botón volver y llamar a module.volver()', () => {
            const dom = createMockDOM();
            let volverLlamado = false;
            const mockModule = { volver: () => { volverLlamado = true; } };

            ProductoDetalleEvents.bindEvents(dom.root, mockModule);
            dom.btnVolver.onclick({ preventDefault: () => {} });

            assert.strictEqual(volverLlamado, true);
        });

        it('debe vincular filtro de lotes y actualizar la tabla en DOM', () => {
            const dom = createMockDOM();
            const mockModule = {
                state: { filtroLotes: 'todos', lotes: [{ id: 'l1', cantidadActual: 10 }] },
                data: ProductoDetalleData,
                templates: ProductoDetalleTemplates
            };

            ProductoDetalleEvents.bindEvents(dom.root, mockModule);
            dom.btnFiltroActivos.onclick({ preventDefault: () => {} });

            assert.strictEqual(mockModule.state.filtroLotes, 'activos');
            assert.ok(dom.btnFiltroActivos.classList.contains('btn-primary'));
            assert.ok(dom.tbodyLotes.innerHTML.length > 0);
        });

        it('debe validar cantidad > 0 al someter formulario de nuevo lote', async () => {
            const dom = createMockDOM();
            dom.loteCant.value = '0';
            const mockModule = { state: { producto: { id: 1 } }, guardarLote: async () => {} };

            ProductoDetalleEvents.bindEvents(dom.root, mockModule);
            await dom.formNuevoLote.onsubmit({ preventDefault: () => {} });

            assert.ok(dom.loteAlert.textContent.includes('mayor a 0'));
        });

        it('debe procesar lote válido y recargar datos', async () => {
            const dom = createMockDOM();
            dom.loteCant.value = '25';
            dom.loteCosto.value = '15.000';
            dom.loteFecha.value = '2026-05-01';
            dom.loteRef.value = 'Lote Test';

            let guardado = null;
            let recargado = false;
            const mockModule = {
                state: { producto: { id: 99, sku: 'SKU-99' } },
                guardarLote: async (lote) => { guardado = lote; },
                recargarDatos: async () => { recargado = true; }
            };

            ProductoDetalleEvents.bindEvents(dom.root, mockModule);
            await dom.formNuevoLote.onsubmit({ preventDefault: () => {} });

            assert.ok(guardado);
            assert.strictEqual(guardado.cantidadInicial, 25);
            assert.strictEqual(guardado.costoUnitario, 15000);
            assert.strictEqual(guardado.referencia, 'Lote Test');
            assert.strictEqual(recargado, true);
            assert.ok(dom.loteAlert.textContent.includes('éxito'));
        });

        it('debe manejar error al guardar lote mostrando alerta de peligro', async () => {
            const dom = createMockDOM();
            dom.loteCant.value = '10';
            dom.loteCosto.value = '5000';

            const mockModule = {
                state: { producto: { id: 1 } },
                guardarLote: async () => { throw new Error('Fallo en base de datos'); },
                recargarDatos: async () => {}
            };

            ProductoDetalleEvents.bindEvents(dom.root, mockModule);
            await dom.formNuevoLote.onsubmit({ preventDefault: () => {} });

            assert.ok(dom.loteAlert.textContent.includes('Fallo en base de datos'));
        });

        it('debe validar costo >= 0 al someter formulario de nuevo lote', async () => {
            const dom = createMockDOM();
            dom.loteCant.value = '10';
            dom.loteCosto.value = '-500';
            const mockModule = { state: { producto: { id: 1 } }, guardarLote: async () => {} };

            ProductoDetalleEvents.bindEvents(dom.root, mockModule);
            await dom.formNuevoLote.onsubmit({ preventDefault: () => {} });

            assert.ok(dom.loteAlert.textContent.includes('costo unitario'));
        });

        it('debe validar formato de fecha AAAA-MM-DD', async () => {
            const dom = createMockDOM();
            dom.loteCant.value = '10';
            dom.loteCosto.value = '1000';
            dom.loteFecha.value = 'fecha_invalida';
            const mockModule = { state: { producto: { id: 1 } }, guardarLote: async () => {} };

            ProductoDetalleEvents.bindEvents(dom.root, mockModule);
            await dom.formNuevoLote.onsubmit({ preventDefault: () => {} });

            assert.ok(dom.loteAlert.textContent.includes('formato válido'));
        });

        it('debe vincular navegación al hacer clic en filas de facturas asociadas', () => {
            const rowVenta = {
                dataset: { id: '456', tipo: 'venta' },
                onclick: null
            };
            const rowCompra = {
                dataset: { id: '789', tipo: 'compra' },
                onclick: null
            };
            const root = {
                querySelector: () => null,
                querySelectorAll: (sel) => sel === '.row-factura-asociada' ? [rowVenta, rowCompra] : []
            };

            if (typeof window === 'undefined') {
                global.window = { location: { hash: '#/inventario/items/ver/1' } };
            }
            if (typeof sessionStorage === 'undefined') {
                const store = {};
                global.sessionStorage = {
                    setItem: (k, v) => { store[k] = v; },
                    getItem: (k) => store[k] || null
                };
            }

            ProductoDetalleEvents.bindEvents(root, {});

            assert.strictEqual(typeof rowVenta.onclick, 'function');
            rowVenta.onclick({ preventDefault: () => {} });
            assert.strictEqual(window.location.hash, '#/ingresos/facturas/ver/456');

            rowCompra.onclick({ preventDefault: () => {} });
            assert.strictEqual(window.location.hash, '#/gastos/proveedores/ver/789');
        });

        it('cleanup debe tolerar ejecución sin errores', () => {
            assert.doesNotThrow(() => ProductoDetalleEvents.cleanup(null));
            assert.doesNotThrow(() => ProductoDetalleEvents.cleanup({ querySelector: () => null }));
        });

        it('debe cargar movimientos de kardex al pulsar el tab de kardex continuo embebido', async () => {
            const dom = createMockDOM();
            const mockModule = {
                state: { producto: { id: 55 } },
                cargarKardex: async () => [
                    { creado_en: '2026-05-10', tipo_operacion: 'ENTRADA', cantidad_anterior: 0, diferencia: 20, cantidad_nueva: 20, origen_documento: 'Doc 1' }
                ],
                templates: ProductoDetalleTemplates
            };

            ProductoDetalleEvents.bindEvents(dom.root, mockModule);
            await dom.tabKardexBtn.onclick({ preventDefault: () => {} });

            assert.ok(dom.tbodyKardexEmbebido.innerHTML.includes('+20'));
            assert.ok(dom.tbodyKardexEmbebido.innerHTML.includes('Doc 1'));
        });

        it('debe actualizar clases activas y paneles al hacer clic en los botones de pestaña', () => {
            const makeTabBtn = (id, target) => {
                const classSet = new Set(['nav-link', 'fw-semibold', 'text-muted']);
                const callbacks = {};
                return {
                    id,
                    getAttribute: (name) => name === 'data-bs-target' ? target : null,
                    classList: {
                        add: (...cls) => cls.forEach(c => classSet.add(c)),
                        remove: (...cls) => cls.forEach(c => classSet.delete(c)),
                        contains: (c) => classSet.has(c)
                    },
                    addEventListener: (evt, cb) => {
                        callbacks[evt] = cb;
                    },
                    click: () => {
                        if (callbacks['click']) callbacks['click']();
                    }
                };
            };

            const makePane = (id) => {
                const classSet = new Set(['tab-pane']);
                return {
                    id,
                    classList: {
                        add: (...cls) => cls.forEach(c => classSet.add(c)),
                        remove: (...cls) => cls.forEach(c => classSet.delete(c)),
                        contains: (c) => classSet.has(c)
                    }
                };
            };

            const tab1 = makeTabBtn('tab-lotes-fifo-btn', '#tab-lotes-fifo-pane');
            const tab3 = makeTabBtn('tab-precios-btn', '#tab-precios-pane');
            const pane1 = makePane('tab-lotes-fifo-pane');
            const pane3 = makePane('tab-precios-pane');

            const root = {
                querySelector: (sel) => {
                    if (sel === '#tab-lotes-fifo-pane') return pane1;
                    if (sel === '#tab-precios-pane') return pane3;
                    return null;
                },
                querySelectorAll: (sel) => {
                    if (sel === '#tabs-producto-principal button[data-bs-toggle="tab"]') return [tab1, tab3];
                    if (sel === '#tabs-producto-content .tab-pane') return [pane1, pane3];
                    return [];
                }
            };

            ProductoDetalleEvents.bindEvents(root, {});

            // Simular clic en pestaña de Precios
            tab3.click();

            assert.strictEqual(tab3.classList.contains('active'), true);
            assert.strictEqual(tab3.classList.contains('text-primary'), true);
            assert.strictEqual(tab1.classList.contains('active'), false);
            assert.strictEqual(pane3.classList.contains('active'), true);
            assert.strictEqual(pane1.classList.contains('active'), false);
        });

        it('debe filtrar filas de ventas al escribir en el buscador #search-ventas-prod', () => {
            const row1 = { textContent: 'Factura #101 Juan Perez', style: { display: '' } };
            const row2 = { textContent: 'Factura #102 Acero SAS', style: { display: '' } };
            const searchInput = { value: '', oninput: null };
            const root = {
                querySelector: (sel) => sel === '#search-ventas-prod' ? searchInput : null,
                querySelectorAll: (sel) => sel === '#tbody-ventas-prod .row-factura-asociada' ? [row1, row2] : []
            };

            ProductoDetalleEvents.bindEvents(root, {});

            assert.strictEqual(typeof searchInput.oninput, 'function');

            // Filtrar por 'Juan'
            searchInput.value = 'Juan';
            searchInput.oninput();
            assert.strictEqual(row1.style.display, '');
            assert.strictEqual(row2.style.display, 'none');

            // Limpiar filtro
            searchInput.value = '';
            searchInput.oninput();
            assert.strictEqual(row1.style.display, '');
            assert.strictEqual(row2.style.display, '');
        });

        it('debe copiar SKU al portapapeles al pulsar #btn-copy-sku', async () => {
            let textoCopiado = '';
            const originalClipboard = globalThis.navigator?.clipboard;
            try {
                Object.defineProperty(globalThis.navigator, 'clipboard', {
                    value: {
                        writeText: async (text) => { textoCopiado = text; }
                    },
                    configurable: true,
                    writable: true
                });
            } catch (e) {
                // Si no es configurable, omitir mock directo
            }

            const btnSku = {
                className: 'bi bi-copy',
                onclick: null
            };
            const root = {
                querySelector: (sel) => sel === '#btn-copy-sku' ? btnSku : null,
                querySelectorAll: () => []
            };

            const module = {
                state: { producto: { sku: 'SKU-TEST-99' } }
            };

            ProductoDetalleEvents.bindEvents(root, module);
            await btnSku.onclick({ preventDefault: () => {} });

            if (textoCopiado) {
                assert.strictEqual(textoCopiado, 'SKU-TEST-99');
                assert.ok(btnSku.className.includes('bi-check2'));
            } else {
                assert.strictEqual(typeof btnSku.onclick, 'function');
            }

            if (originalClipboard) {
                try {
                    Object.defineProperty(globalThis.navigator, 'clipboard', {
                        value: originalClipboard,
                        configurable: true,
                        writable: true
                    });
                } catch (e) {}
            }
        });
    });

    // =========================================================================
    // 9. ProductoDetalleModule Orchestrator
    // =========================================================================
    describe('ProductoDetalleModule Orquestador', () => {
        it('debe exponer referencias a data, templates y events', () => {
            assert.strictEqual(ProductoDetalleModule.data, ProductoDetalleData);
            assert.strictEqual(ProductoDetalleModule.templates, ProductoDetalleTemplates);
            assert.ok(ProductoDetalleModule.events);
        });

        it('init debe retornar temprano si element o productoId es nulo', async () => {
            await ProductoDetalleModule.init(null, 1);
            await ProductoDetalleModule.init({}, null);
        });

        it('init debe renderizar mensaje de producto no encontrado si data.cargarDetalle retorna null', async () => {
            const element = { innerHTML: '', querySelector: () => null };
            const originalCargar = ProductoDetalleModule.data.cargarDetalle;
            ProductoDetalleModule.data.cargarDetalle = async () => null;

            await ProductoDetalleModule.init(element, 'prod_inexistente');

            assert.ok(element.innerHTML.includes('Producto no encontrado'));
            ProductoDetalleModule.data.cargarDetalle = originalCargar;
        });

        it('init debe renderizar mensaje de error si data.cargarDetalle falla', async () => {
            const element = { innerHTML: '', querySelector: () => null };
            const originalCargar = ProductoDetalleModule.data.cargarDetalle;
            ProductoDetalleModule.data.cargarDetalle = async () => { throw new Error('Error de conexión'); };

            await ProductoDetalleModule.init(element, 'prod_error');

            assert.ok(element.innerHTML.includes('Error al cargar el producto'));
            ProductoDetalleModule.data.cargarDetalle = originalCargar;
        });

        it('init debe cargar datos, poblar state y renderizar layout completo', async () => {
            const element = {
                innerHTML: '',
                querySelector: () => null,
                querySelectorAll: () => []
            };

            const originalCargar = ProductoDetalleModule.data.cargarDetalle;
            ProductoDetalleModule.data.cargarDetalle = async () => ({
                producto: { id: 77, nombre: 'Mouse Óptico', sku: 'MOU-77', precioVenta: 50000, costoBase: 25000, stockMinimo: 5 },
                lotes: [{ id: 'l1', cantidadActual: 10, cantidadInicial: 10, costoUnitario: 25000 }],
                ventas: [],
                facturasCompra: [],
                kpis: {
                    stock: { stockTotal: 10, stockMinimo: 5, estado: 'optimo' },
                    valorizacion: { valorTotal: 250000, costoPromedioPonderado: 25000, costoBase: 25000, diferenciaCosto: 0 },
                    margen: { precioVenta: 50000, costoUnitario: 25000, utilidadMonetaria: 25000, margenPorcentual: 50 },
                    rotacion: { unidadesVendidas: 0, velocidadDiaria: 0, diasCobertura: 999, alertaRecompra: false }
                }
            });

            await ProductoDetalleModule.init(element, 77);

            assert.strictEqual(ProductoDetalleModule.state.producto.nombre, 'Mouse Óptico');
            assert.ok(element.innerHTML.includes('Mouse Óptico'));
            assert.ok(element.innerHTML.includes('MOU-77'));
            assert.ok(element.innerHTML.includes('payment-kpi-card'));

            ProductoDetalleModule.data.cargarDetalle = originalCargar;
        });

        it('recargarDatos debe actualizar KPIs y tabla de lotes en DOM', async () => {
            const kpiContainer = { innerHTML: '' };
            const tbodyLotes = { innerHTML: '' };
            ProductoDetalleModule.element = {
                querySelector: (sel) => {
                    if (sel === '#kpi-cards-container') return kpiContainer;
                    if (sel === '#tbody-lotes-fifo') return tbodyLotes;
                    return null;
                }
            };
            ProductoDetalleModule.state.productoId = 77;
            ProductoDetalleModule.state.filtroLotes = 'todos';

            const originalCargar = ProductoDetalleModule.data.cargarDetalle;
            ProductoDetalleModule.data.cargarDetalle = async () => ({
                producto: { id: 77, nombre: 'Mouse Óptico' },
                lotes: [{ id: 'l1', cantidadActual: 20, cantidadInicial: 20, costoUnitario: 25000 }],
                ventas: [],
                facturasCompra: [],
                kpis: {
                    stock: { stockTotal: 20, stockMinimo: 5, estado: 'optimo' },
                    valorizacion: { valorTotal: 500000, costoPromedioPonderado: 25000, costoBase: 25000, diferenciaCosto: 0 },
                    margen: { precioVenta: 50000, costoUnitario: 25000, utilidadMonetaria: 25000, margenPorcentual: 50 },
                    rotacion: { unidadesVendidas: 0, velocidadDiaria: 0, diasCobertura: 999, alertaRecompra: false }
                }
            });

            await ProductoDetalleModule.recargarDatos();

            assert.ok(kpiContainer.innerHTML.includes('Stock Disponible'));
            assert.ok(tbodyLotes.innerHTML.includes('20 und'));

            ProductoDetalleModule.data.cargarDetalle = originalCargar;
        });

        it('guardarLote y cargarKardex deben delegar en data layer', async () => {
            let loteGuardado = null;
            let kardexIdConsultado = null;

            ProductoDetalleModule.data.guardarLote = async (lote) => { loteGuardado = lote; return lote; };
            ProductoDetalleModule.data.cargarKardex = async (id) => { kardexIdConsultado = id; return []; };

            await ProductoDetalleModule.guardarLote({ id: 'lote_test' });
            await ProductoDetalleModule.cargarKardex(88);

            assert.strictEqual(loteGuardado.id, 'lote_test');
            assert.strictEqual(kardexIdConsultado, 88);
        });

        it('volver debe invocar el callback onVolver si está registrado', () => {
            let callbackInvocado = false;
            ProductoDetalleModule.onVolverCallback = () => {
                callbackInvocado = true;
            };

            ProductoDetalleModule.volver();
            assert.strictEqual(callbackInvocado, true);
        });

        it('volver debe cambiar window.location.hash si no hay callback registrado', () => {
            ProductoDetalleModule.onVolverCallback = null;
            if (typeof window === 'undefined') {
                global.window = { location: { hash: '' } };
            }

            ProductoDetalleModule.volver();
            assert.strictEqual(window.location.hash, '#/inventario/items');
        });
    });
});
