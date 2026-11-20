import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { 
    ProductosTemplates, 
    getProductAvatar 
} from '../js/modules/productos/productos.templates.js';
import { ProductosData } from '../js/modules/productos/productos.data.js';
import { ProductosModule } from '../js/modules/productos/productos.js';

describe('Módulo Productos & Ítems de Venta 360° - TDD Test Suite', () => {

    // =========================================================================
    // 1. Helpers & Formatters Visuales
    // =========================================================================
    describe('getProductAvatar', () => {
        it('debe generar iniciales mayúsculas y color determinista para un nombre de producto', () => {
            const avatar = getProductAvatar('Cargador Rápido 120W');
            assert.strictEqual(avatar.initials, 'CR');
            assert.ok(avatar.bg, 'Debe incluir color de fondo');
            assert.ok(avatar.color, 'Debe incluir color de texto');
        });

        it('debe manejar nombres de una sola palabra', () => {
            const avatar = getProductAvatar('Batería');
            assert.strictEqual(avatar.initials, 'B');
        });

        it('debe manejar valores nulos, vacíos o indefinidos con fallback seguro', () => {
            const avNulo = getProductAvatar(null);
            assert.strictEqual(avNulo.initials, 'IT');
            const avVacio = getProductAvatar('');
            assert.strictEqual(avVacio.initials, 'IT');
        });

        it('debe ser estrictamente determinista (mismo nombre = mismos colores e iniciales)', () => {
            const a1 = getProductAvatar('Cable Tipo C Blindado');
            const a2 = getProductAvatar('Cable Tipo C Blindado');
            assert.deepStrictEqual(a1, a2);
        });
    });

    describe('ProductosTemplates Formatters', () => {
        it('formatMoney debe formatear montos en pesos colombianos ($ ...)', () => {
            assert.strictEqual(ProductosTemplates.formatMoney(218932232), '$ 218.932.232');
            assert.strictEqual(ProductosTemplates.formatMoney(0), '$ 0');
            assert.strictEqual(ProductosTemplates.formatMoney(null), '$ 0');
        });

        it('formatDecimal debe formatear números con decimales en español', () => {
            const res = ProductosTemplates.formatDecimal(1450.5);
            assert.ok(res.includes('1.450,5') || res.includes('1.450'));
        });

        it('getMargenBadge debe clasificar correctamente el margen porcentual', () => {
            const alto = ProductosTemplates.getMargenBadge(54.6, 25000);
            assert.ok(alto.includes('badge-stitch-cobrado') || alto.includes('text-success'));
            assert.ok(alto.includes('54.6%'));

            const medio = ProductosTemplates.getMargenBadge(18.5, 5000);
            assert.ok(medio.includes('badge-stitch-pendiente') || medio.includes('text-warning'));

            const bajo = ProductosTemplates.getMargenBadge(6.2, 1000);
            assert.ok(bajo.includes('badge-stitch-vencido') || alto.includes('text-danger'));
        });

        it('getStockBadge debe clasificar correctamente los estados del inventario', () => {
            const opt = ProductosTemplates.getStockBadge('optimo', 25, 5);
            assert.ok(opt.includes('Óptimo'));
            assert.ok(opt.includes('badge-stitch-cobrado') || opt.includes('success'));

            const bajo = ProductosTemplates.getStockBadge('bajo_stock', 3, 5);
            assert.ok(bajo.includes('Crítico') || bajo.includes('Bajo'));

            const agotado = ProductosTemplates.getStockBadge('agotado', 0, 5);
            assert.ok(agotado.includes('Agotado'));
        });
    });

    // =========================================================================
    // 2. ProductosData - Cálculos y Lógica de Negocio
    // =========================================================================
    describe('ProductosData - Cálculos Locales y Fallback Defensivo', () => {
        const dummyProducts = [
            { id: 1, sku: 'SKU1', nombre: 'Prod 1', stock: 20, stockMinimo: 5, costoPromedio: 10000, precioVenta: 20000, estado: 'active' },
            { id: 2, sku: 'SKU2', nombre: 'Prod 2', stock: 2, stockMinimo: 5, costoPromedio: 5000, precioVenta: 8000, estado: 'active' },
            { id: 3, sku: 'SKU3', nombre: 'Prod 3', stock: 0, stockMinimo: 5, costoPromedio: 15000, precioVenta: 25000, estado: 'active' },
            { id: 4, sku: 'SKU4', nombre: 'Prod Inactivo', stock: 0, stockMinimo: 5, costoPromedio: 2000, precioVenta: 5000, estado: 'inactivo' }
        ];

        it('calcularKPIsLocales debe totalizar inventario, potencial de venta y estados de stock', () => {
            const kpis = ProductosData.calcularKPIsLocales(dummyProducts);
            // Prod 1: 20 * 10.000 = 200.000 | Venta: 20 * 20.000 = 400.000
            // Prod 2: 2 * 5.000 = 10.000     | Venta: 2 * 8.000 = 16.000
            // Prod 3: 0                      | Venta: 0
            // Total costo = 210.000, Total venta = 416.000
            assert.strictEqual(kpis.valor_total_inventario, 210000);
            assert.strictEqual(kpis.valor_venta_potencial, 416000);
            assert.strictEqual(kpis.total_activos, 3);
            assert.strictEqual(kpis.bajo_stock, 1);
            assert.strictEqual(kpis.agotados, 1);
            assert.strictEqual(kpis.optimos, 1);
            assert.strictEqual(kpis.total_inactivos, 1);
            assert.ok(kpis.margen_promedio_global > 0);
        });

        it('calcularTabCountsLocales debe contar correctamente cada categoría de stock', () => {
            const counts = ProductosData.calcularTabCountsLocales(dummyProducts);
            assert.strictEqual(counts.todos, 3);
            assert.strictEqual(counts.bajo_stock, 1);
            assert.strictEqual(counts.agotado, 1);
            assert.strictEqual(counts.optimo, 1);
            assert.strictEqual(counts.inactivos, 1);
        });

        it('filtrarYPaginarLocales debe filtrar por tab, búsqueda y paginar adecuadamente', () => {
            // Filtro por tab bajo_stock
            const resBajo = ProductosData.filtrarYPaginarLocales(dummyProducts, {
                filterCriteria: 'bajo_stock',
                searchQuery: '',
                page: 1,
                limit: 10
            });
            assert.strictEqual(resBajo.data.length, 1);
            assert.strictEqual(resBajo.data[0].sku, 'SKU2');

            // Búsqueda textual
            const resSearch = ProductosData.filtrarYPaginarLocales(dummyProducts, {
                filterCriteria: 'todos',
                searchQuery: 'Prod 1',
                page: 1,
                limit: 10
            });
            assert.strictEqual(resSearch.data.length, 1);
            assert.strictEqual(resSearch.data[0].sku, 'SKU1');
        });
    });

    // =========================================================================
    // 3. ProductosTemplates - Renderizado de UI y Componentes
    // =========================================================================
    describe('ProductosTemplates.renderLayout', () => {
        it('debe inyectar la estructura ergonómica con Top Bar, 4 KPI cards, tabs y drawer', () => {
            const fakeCtx = {
                state: {
                    view: 'lista',
                    currentFilter: 'todos',
                    searchQuery: '',
                    itemsPerPage: 25,
                    kpis: {
                        valor_total_inventario: 218932232,
                        total_activos: 1864,
                        bajo_stock: 133,
                        margen_promedio_global: 54.6
                    },
                    tabCounts: { todos: 1864, bajo_stock: 133, agotado: 1088, optimo: 643 }
                },
                formatMoney: ProductosTemplates.formatMoney
            };

            const html = ProductosTemplates.renderLayout.call(fakeCtx);

            // Título y navegación
            assert.ok(html.includes('Ítems de Venta'));
            assert.ok(html.includes('Catálogo de Inventario'));
            assert.ok(html.includes('btn-view-lista'));
            assert.ok(html.includes('btn-view-grafico'));
            assert.ok(html.includes('btn-export-excel'));
            assert.ok(html.includes('btn-nuevo-producto'));

            // 4 KPI Cards
            assert.ok(html.includes('kpi-valor-inventario'));
            assert.ok(html.includes('kpi-total-items'));
            assert.ok(html.includes('kpi-stock-critico'));
            assert.ok(html.includes('kpi-margen-promedio'));

            // Segmented Tabs Bar
            assert.ok(html.includes('data-tab="todos"'));
            assert.ok(html.includes('data-tab="bajo_stock"'));
            assert.ok(html.includes('data-tab="agotado"'));
            assert.ok(html.includes('data-tab="optimo"'));

            // Slide-over Drawer
            assert.ok(html.includes('producto-drawer-backdrop'));
            assert.ok(html.includes('producto-drawer'));
        });
    });

    describe('ProductosTemplates.renderGrid', () => {
        it('debe renderizar estado vacío amigable cuando la lista está vacía', () => {
            const tbodyFake = { innerHTML: '' };
            const fakeElement = {
                querySelector: (sel) => sel === '#tbody-productos' ? tbodyFake : null
            };
            const fakeCtx = {
                element: fakeElement,
                state: { currentPage: 1, itemsPerPage: 25 },
                bindFilaEvents: () => {}
            };

            ProductosTemplates.renderGrid.call(fakeCtx, [], 0);
            assert.ok(tbodyFake.innerHTML.includes('No se encontraron ítems'));
        });

        it('debe renderizar filas enriquecidas con avatar, SKU, stock bar y margen', () => {
            const tbodyFake = { innerHTML: '' };
            const fakeElement = {
                querySelector: (sel) => sel === '#tbody-productos' ? tbodyFake : null
            };
            const fakeCtx = {
                element: fakeElement,
                state: { currentPage: 1, itemsPerPage: 25 },
                formatMoney: ProductosTemplates.formatMoney,
                formatDecimal: ProductosTemplates.formatDecimal,
                getMargenBadge: ProductosTemplates.getMargenBadge,
                getStockBadge: ProductosTemplates.getStockBadge,
                bindFilaEvents: () => {}
            };

            const sample = [{
                id: 101,
                sku: 'MAS101',
                nombre: 'Cable HDMI 4K Trenzado',
                precioVenta: 35000,
                costoPromedio: 14000,
                stock: 45,
                stockMinimo: 10,
                valorTotalInventario: 630000,
                utilidadUnitaria: 21000,
                margenPct: 60,
                estadoStock: 'optimo'
            }];

            ProductosTemplates.renderGrid.call(fakeCtx, sample, 1);
            assert.ok(tbodyFake.innerHTML.includes('Cable HDMI 4K Trenzado'));
            assert.ok(tbodyFake.innerHTML.includes('MAS101'));
            assert.ok(tbodyFake.innerHTML.includes('$ 35.000'));
            assert.ok(tbodyFake.innerHTML.includes('$ 14.000'));
            assert.ok(tbodyFake.innerHTML.includes('$ 630.000'));
        });
    });

    // =========================================================================
    // 4. ProductosModule - Orquestador y Contrato de API
    // =========================================================================
    describe('ProductosModule Orquestador', () => {
        it('debe exponer el estado inicial correcto y métodos orquestadores', () => {
            assert.ok(ProductosModule.state, 'Debe contar con objeto state reactivo');
            assert.strictEqual(ProductosModule.state.view, 'lista');
            assert.strictEqual(ProductosModule.state.currentPage, 1);
            assert.strictEqual(ProductosModule.state.itemsPerPage, 25);
            assert.strictEqual(typeof ProductosModule.init, 'function');
            assert.strictEqual(typeof ProductosModule.cargarPagina, 'function');
            assert.strictEqual(typeof ProductosModule.abrirDrawer, 'function');
            assert.strictEqual(typeof ProductosModule.cerrarDrawer, 'function');
        });
    });
});
