import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AnalisisNanocarbonData } from '../js/modules/inventario/analisisNanocarbon.js';
import { AnalisisNanocarbonTemplates } from '../js/modules/inventario/analisisNanocarbon.js';

describe('Módulo Análisis NanoCarbón - TDD Test Suite', () => {

    const mockData = [
        {
            tipo: 'resumen_rollo',
            sku: '5000-ROLLO',
            nombre: 'Rollo Madre NanoCarbón 1.52m x 30m',
            metros_stock_actual: 391.45,
            valor_stock_actual: 14875146,
            consumo_diario_metros: 0.47,
            dias_restantes_rollo: 826,
            fecha_estimada_agotamiento: '2029-02-24',
            recomendacion: 'Stock de rollo suficiente'
        },
        {
            tipo: 'sku',
            sku: '5001+',
            nombre: 'Película NanoCarbón Original',
            unidades_vendidas_periodo: 1195,
            tendencia_pct: -2.8,
            metros_por_unidad: 0.02,
            metros_consumidos_periodo: 19.96,
            precio_venta: 4900,
            costo_base: 1850,
            margen_pct: 62.2,
            margen_generado_periodo: 3644750,
            recomendacion: 'Recomprar urgente'
        },
        {
            tipo: 'sku',
            sku: '5003+',
            nombre: 'Película NanoCarbón Digital',
            unidades_vendidas_periodo: 19,
            tendencia_pct: -67.8,
            metros_por_unidad: 0.17,
            metros_consumidos_periodo: 3.17,
            precio_venta: 10000,
            costo_base: 4500,
            margen_pct: 55.0,
            margen_generado_periodo: 104500,
            recomendacion: 'Mantener stock'
        },
        {
            tipo: 'sku',
            sku: '5002+',
            nombre: 'Película NanoCarbón P. Camara',
            unidades_vendidas_periodo: 12,
            tendencia_pct: 100.0,
            metros_por_unidad: 0.0,
            metros_consumidos_periodo: 0.02,
            precio_venta: 1000,
            costo_base: 200,
            margen_pct: 80.0,
            margen_generado_periodo: 9600,
            recomendacion: 'Mantener stock'
        },
        {
            tipo: 'sku',
            sku: '5001-',
            nombre: 'Película NanoCarbón **GARANTIA**',
            unidades_vendidas_periodo: 5,
            tendencia_pct: 400.0,
            metros_por_unidad: null,
            metros_consumidos_periodo: 0.0,
            precio_venta: 0,
            costo_base: 1850,
            margen_pct: -100.0,
            margen_generado_periodo: -9250,
            recomendacion: 'Garantía / Merma'
        },
        {
            tipo: 'sku',
            sku: '5004+',
            nombre: 'Película NanoCarbón Tablet Original',
            unidades_vendidas_periodo: 322,
            tendencia_pct: 35.9,
            metros_por_unidad: 0.06,
            metros_consumidos_periodo: 19.51,
            precio_venta: 7900,
            costo_base: 10120,
            margen_pct: -28.1,
            margen_generado_periodo: -714840,
            recomendacion: 'Revisar precio / margen'
        }
    ];

    // =========================================================================
    // 1. Data Layer: Extracción y Cálculos
    // =========================================================================
    describe('AnalisisNanocarbonData', () => {
        const stateMock = {
            rawData: mockData,
            sortColumn: 'margen_generado_periodo',
            sortDirection: 'desc',
            searchQuery: '',
            activeTab: 'todos',
            diasPeriodo: 90,
            umbralRollo: 30
        };

        it('getRolloResumen debe extraer correctamente el registro de tipo resumen_rollo', () => {
            const context = { state: stateMock };
            const rollo = AnalisisNanocarbonData.getRolloResumen.call(context);
            assert.ok(rollo, 'Debe encontrar el rollo madre');
            assert.strictEqual(rollo.sku, '5000-ROLLO');
            assert.strictEqual(rollo.metros_stock_actual, 391.45);
        });

        it('getSkuItems debe extraer los 5 SKUs hijos excluyendo el resumen del rollo', () => {
            const context = { state: stateMock };
            const skus = AnalisisNanocarbonData.getSkuItems.call(context);
            assert.strictEqual(skus.length, 5);
            assert.ok(skus.every(it => it.tipo === 'sku'));
        });

        it('calcularTotalesConsolidados debe sumarizar vendidas, metros y margen neto', () => {
            const context = { state: stateMock };
            const skus = AnalisisNanocarbonData.getSkuItems.call(context);
            const totales = AnalisisNanocarbonData.calcularTotales(skus);

            assert.strictEqual(totales.totalVendidas, 1195 + 19 + 12 + 5 + 322); // 1553
            assert.strictEqual(Number(totales.totalMetrosConsumidos.toFixed(2)), 42.66);
            assert.strictEqual(totales.totalMargenNeto, 3644750 + 104500 + 9600 - 9250 - 714840); // 3034760
        });

        it('filtrarSkus debe filtrar por término de búsqueda en SKU y Nombre', () => {
            const context = {
                state: {
                    ...stateMock,
                    searchQuery: 'tablet'
                }
            };
            const skus = AnalisisNanocarbonData.getSkuItems.call(context);
            assert.strictEqual(skus.length, 1);
            assert.strictEqual(skus[0].sku, '5004+');
        });

        it('filtrarSkus por tab "criticos" debe retornar solo los productos con margen negativo', () => {
            const context = {
                state: {
                    ...stateMock,
                    activeTab: 'criticos'
                }
            };
            const skus = AnalisisNanocarbonData.getSkuItems.call(context);
            assert.strictEqual(skus.length, 2); // 5001- y 5004+
            assert.ok(skus.every(s => s.margen_pct < 0));
        });
    });

    // =========================================================================
    // 2. Templates Layer: Estilo Gastos Operativos y 5 Columnas
    // =========================================================================
    describe('AnalisisNanocarbonTemplates', () => {
        const stateMock = {
            diasPeriodo: 90,
            umbralRollo: 30,
            searchQuery: '',
            activeTab: 'todos',
            activeView: 'tabla',
            sortColumn: 'margen_generado_periodo',
            sortDirection: 'desc'
        };

        it('getRolloCardHTML debe renderizar 4 tarjetas ejecutivas con clase payment-kpi-card', () => {
            const context = { state: stateMock, getBadgeRolloHTML: AnalisisNanocarbonTemplates.getBadgeRolloHTML };
            const rollo = mockData.find(it => it.tipo === 'resumen_rollo');
            const html = AnalisisNanocarbonTemplates.getRolloCardHTML.call(context, rollo);

            assert.ok(html.includes('payment-kpi-card'), 'Debe usar payment-kpi-card');
            assert.ok(html.includes('391,45 m') || html.includes('391.45 m'), 'Debe mostrar metros en stock');
            assert.ok(html.includes('0,47 m/día') || html.includes('0.47 m/día'), 'Debe mostrar consumo diario');
            assert.ok(html.includes('826 días'), 'Debe mostrar días restantes');
            assert.ok(html.includes('2029-02-24'), 'Debe mostrar fecha estimada de agotamiento');
        });

        it('getTableHeaderHTML debe renderizar exactamente 5 columnas optimizadas sin desbordamiento', () => {
            const context = { state: stateMock };
            const html = AnalisisNanocarbonTemplates.getTableHeaderHTML.call(context);

            assert.ok(html.includes('Producto / Corte'), 'Debe incluir columna Producto / Corte');
            assert.ok(html.includes('Ventas'), 'Debe incluir columna Ventas & Tendencia');
            assert.ok(html.includes('Consumo Bobina'), 'Debe incluir columna Consumo Bobina');
            assert.ok(html.includes('Precios'), 'Debe incluir columna Precios (Venta/Costo)');
            assert.ok(html.includes('Rentabilidad'), 'Debe incluir columna Rentabilidad & Margen');

            // No deben existir 11 encabezados individuales
            const thMatches = (html.match(/<th/g) || []).length;
            assert.strictEqual(thMatches, 5, 'Debe haber exactamente 5 columnas para evitar scroll horizontal');
        });

        it('getTableRowsHTML debe renderizar métricas compuestas con totalizadores en tfoot', () => {
            const context = {
                state: stateMock,
                getTendenciaHTML: AnalisisNanocarbonTemplates.getTendenciaHTML,
                getRecomendacionBadgeHTML: AnalisisNanocarbonTemplates.getRecomendacionBadgeHTML
            };
            const skus = mockData.filter(it => it.tipo === 'sku');
            const html = AnalisisNanocarbonTemplates.getTableRowsHTML.call(context, skus);

            assert.ok(html.includes('5004+'), 'Debe renderizar SKU');
            assert.ok(html.includes('Película NanoCarbón Tablet Original'), 'Debe renderizar nombre');
            assert.ok(html.includes('Pérdida por unidad'), 'Debe alertar pérdida');
            assert.ok(html.includes('-28.1%'), 'Debe renderizar margen negativo');
        });

        it('renderAnalyticsViewHTML debe renderizar vista gráfica de distribución de bobina y rentabilidad', () => {
            const context = { state: stateMock };
            const rollo = mockData.find(it => it.tipo === 'resumen_rollo');
            const skus = mockData.filter(it => it.tipo === 'sku');
            const html = AnalisisNanocarbonTemplates.getAnalyticsViewHTML.call(context, rollo, skus);

            assert.ok(html.includes('Distribución de Consumo de Bobina'), 'Debe incluir barra de distribución');
            assert.ok(html.includes('Ranking de Generación de Margen'), 'Debe incluir ranking de rentabilidad');
        });

        it('Seguridad OWASP: getTableRowsHTML debe sanitizar ataques XSS en nombres y SKUs maliciosos', () => {
            const context = {
                state: stateMock,
                getTendenciaHTML: AnalisisNanocarbonTemplates.getTendenciaHTML,
                getRecomendacionBadgeHTML: AnalisisNanocarbonTemplates.getRecomendacionBadgeHTML
            };
            const maliciousSku = [
                {
                    tipo: 'sku',
                    sku: '<script>alert("xss")</script>',
                    nombre: '<img src=x onerror=alert(1)> Película Hack',
                    unidades_vendidas_periodo: 10,
                    tendencia_pct: 0,
                    metros_por_unidad: 0.05,
                    metros_consumidos_periodo: 0.5,
                    precio_venta: 5000,
                    costo_base: 2000,
                    margen_pct: 60,
                    margen_generado_periodo: 30000,
                    recomendacion: '<b onmouseover=evil()>Revisar</b>'
                }
            ];
            const html = AnalisisNanocarbonTemplates.getTableRowsHTML.call(context, maliciousSku);

            assert.ok(!html.includes('<script>'), 'No debe contener tags <script>');
            assert.ok(!html.includes('<img src=x'), 'No debe contener tags <img> inyectados');
            assert.ok(html.includes('&lt;script&gt;') || html.includes('&lt;img'), 'Debe contener entidades HTML seguras');
        });
    });
});
