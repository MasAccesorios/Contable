import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AnalisisRecompraData, AnalisisRecompraTemplates } from '../js/modules/inventario/analisisRecompra.js';

describe('Módulo Análisis de Recompra 360° - TDD Test Suite', () => {

    const mockItems = [
        {
            producto_id: 1,
            sku: '2315',
            nombre: 'Kit Mouse & Keyboard Rechargeable',
            stock_actual: 2,
            costo_base: 25000,
            precio_venta: 50000,
            margen_pct: 50.0,
            unidades_vendidas_periodo: 18,
            rotacion_dias: 10,
            score: 68.2,
            recomendacion: 'Recomprar urgente',
            reponer_urgente: true,
            ultima_compra_costo: 24000,
            ultima_compra_fecha: '2026-10-15',
            dias_desde_ultima_compra: 37,
            tendencia_pct: 15.0,
            margen_generado_periodo: 450000
        },
        {
            producto_id: 2,
            sku: '2327',
            nombre: 'Intercomunicador Moto Q58 MAX Negro',
            stock_actual: 0,
            costo_base: 80000,
            precio_venta: 160000,
            margen_pct: 50.0,
            unidades_vendidas_periodo: 51,
            rotacion_dias: 0,
            score: 27.0,
            recomendacion: 'Revisar - demanda cayendo',
            reponer_urgente: false,
            ultima_compra_costo: 82000,
            ultima_compra_fecha: '2026-09-10',
            dias_desde_ultima_compra: 72,
            tendencia_pct: -35.0,
            margen_generado_periodo: 4080000
        },
        {
            producto_id: 3,
            sku: '2311',
            nombre: 'Airport Display A9 Pro ANC',
            stock_actual: 15,
            costo_base: 45000,
            precio_venta: 95000,
            margen_pct: 52.6,
            unidades_vendidas_periodo: 30,
            rotacion_dias: 45,
            score: 55.4,
            recomendacion: 'Recomprar',
            reponer_urgente: false,
            ultima_compra_costo: 45000,
            ultima_compra_fecha: '2026-11-01',
            dias_desde_ultima_compra: 20,
            tendencia_pct: 5.0,
            margen_generado_periodo: 1500000
        },
        {
            producto_id: 4,
            sku: '2297',
            nombre: 'Auriculares para Casco Bluetooth',
            stock_actual: 40,
            costo_base: 30000,
            precio_venta: 60000,
            margen_pct: 50.0,
            unidades_vendidas_periodo: 6,
            rotacion_dias: 200,
            score: 18.0,
            recomendacion: 'Mantener stock actual',
            reponer_urgente: false,
            ultima_compra_costo: 30000,
            ultima_compra_fecha: '2026-08-15',
            dias_desde_ultima_compra: 98,
            tendencia_pct: -10.0,
            margen_generado_periodo: 180000
        }
    ];

    describe('AnalisisRecompraData - Cálculos de Decisión de Compra', () => {
        it('debe calcular métricas derivadas de compra (unidades sugeridas y presupuesto estimado)', () => {
            const diasPeriodo = 90;
            const umbralCobertura = 30;

            // Item 1: 18 ventas en 90 días = 0.2 und/día. Para 30 días necesita 6 und. Tiene 2 en stock => Sugeridas = 4 und.
            const met1 = AnalisisRecompraData.calcularMetricasItem(mockItems[0], diasPeriodo, umbralCobertura);
            assert.strictEqual(met1.venta_diaria, 0.2);
            assert.strictEqual(met1.unidades_sugeridas, 4);
            assert.strictEqual(met1.presupuesto_estimado, 4 * 24000); // 96.000
            assert.strictEqual(met1.categoria_recompra, 'urgente');

            // Item 4: Cobertura 200 días >= 30 días => Sugeridas = 0
            const met4 = AnalisisRecompraData.calcularMetricasItem(mockItems[3], diasPeriodo, umbralCobertura);
            assert.strictEqual(met4.unidades_sugeridas, 0);
            assert.strictEqual(met4.presupuesto_estimado, 0);
            assert.strictEqual(met4.categoria_recompra, 'saludable');
        });

        it('debe calcular KPIs ejecutivos globales en dinero ($) y conteos por estado', () => {
            const diasPeriodo = 90;
            const umbralCobertura = 30;
            const kpis = AnalisisRecompraData.calcularKPIs(mockItems, umbralCobertura, diasPeriodo);

            assert.strictEqual(kpis.totalItems, 4);
            assert.strictEqual(kpis.conteoUrgentes, 1);
            assert.ok(kpis.presupuestoUrgente >= 96000);
            assert.ok(kpis.presupuestoTotal >= 96000);
            assert.strictEqual(kpis.conteoRecomprar, 1);
            assert.strictEqual(kpis.conteoRevisar, 1);
            assert.strictEqual(kpis.conteoSaludables, 1);
        });

        it('debe calcular totales para pie de tabla tfoot', () => {
            const diasPeriodo = 90;
            const umbralCobertura = 30;
            const enriquecidos = mockItems.map(it => AnalisisRecompraData.calcularMetricasItem(it, diasPeriodo, umbralCobertura));
            const totales = AnalisisRecompraData.calcularTotales(enriquecidos);

            assert.ok(totales.totalUnidadesSugeridas > 0);
            assert.ok(totales.totalPresupuestoSugerido > 0);
            assert.strictEqual(totales.totalVendidas, 18 + 51 + 30 + 6);
        });

        it('debe filtrar correctamente por pestañas segmentadas', () => {
            const diasPeriodo = 90;
            const umbralCobertura = 30;

            const urgentes = AnalisisRecompraData.filtrarYOrdenar(mockItems, {
                activeTab: 'urgentes',
                searchQuery: '',
                diasPeriodo,
                umbralCobertura
            });
            assert.strictEqual(urgentes.length, 1);
            assert.strictEqual(urgentes[0].sku, '2315');

            const revisar = AnalisisRecompraData.filtrarYOrdenar(mockItems, {
                activeTab: 'revisar',
                searchQuery: '',
                diasPeriodo,
                umbralCobertura
            });
            assert.strictEqual(revisar.length, 1);
            assert.strictEqual(revisar[0].sku, '2327');
        });

        it('debe buscar en tiempo real por SKU o nombre de producto', () => {
            const diasPeriodo = 90;
            const umbralCobertura = 30;

            const resSku = AnalisisRecompraData.filtrarYOrdenar(mockItems, {
                activeTab: 'todos',
                searchQuery: '2327',
                diasPeriodo,
                umbralCobertura
            });
            assert.strictEqual(resSku.length, 1);
            assert.strictEqual(resSku[0].sku, '2327');

            const resNombre = AnalisisRecompraData.filtrarYOrdenar(mockItems, {
                activeTab: 'todos',
                searchQuery: 'Keyboard',
                diasPeriodo,
                umbralCobertura
            });
            assert.strictEqual(resNombre.length, 1);
            assert.strictEqual(resNombre[0].sku, '2315');
        });

        it('debe ordenar dinámicamente por presupuesto estimado, rotación o score', () => {
            const diasPeriodo = 90;
            const umbralCobertura = 30;

            const ordenadosPorScore = AnalisisRecompraData.filtrarYOrdenar(mockItems, {
                activeTab: 'todos',
                searchQuery: '',
                sortColumn: 'score',
                sortDirection: 'desc',
                diasPeriodo,
                umbralCobertura
            });
            assert.strictEqual(ordenadosPorScore[0].sku, '2315'); // 68.2 score
        });
    });

    describe('AnalisisRecompraTemplates - Ergonomía Ejecutiva y Cero Scrollbars', () => {
        it('getLayoutHTML debe contener componentes ejecutivos de gastos operativos (4 KPIs, tabs bar, drawer y buscador)', () => {
            const state = {
                diasPeriodo: 90,
                umbralCobertura: 30,
                activeTab: 'todos',
                currentView: 'tabla'
            };
            const html = AnalisisRecompraTemplates.getLayoutHTML(state);

            assert.ok(html.includes('payment-kpi-card'), 'Debe usar payment-kpi-card');
            assert.ok(html.includes('payment-tabs-bar'), 'Debe usar payment-tabs-bar');
            assert.ok(html.includes('payment-drawer'), 'Debe contener payment-drawer para ficha 360°');
            assert.ok(html.includes('dash-table-container'), 'Debe usar dash-table-container');
            // Cero scrollbars
            assert.ok(!html.includes('table-responsive'), 'No debe usar table-responsive para evitar scroll horizontal');
            assert.ok(html.includes('overflow-x: hidden'), 'Debe prevenir overflow horizontal explícitamente');
        });

        it('getTableHeaderHTML debe definir 6 columnas fluidas con porcentajes fijos que sumen 100%', () => {
            const html = AnalisisRecompraTemplates.getTableHeaderHTML({ sortColumn: 'score', sortDirection: 'desc' });
            assert.ok(html.includes('Producto / Clasificación'));
            assert.ok(html.includes('Stock & Cobertura'));
            assert.ok(html.includes('Demanda & Ritmo'));
            assert.ok(html.includes('Costos & Precios'));
            assert.ok(html.includes('Sugerencia Compra'));
            assert.ok(html.includes('Acción'));
        });

        it('getTableRowsHTML debe renderizar sugerencia de compra, presupuesto estimado y sanitización XSS', () => {
            const diasPeriodo = 90;
            const umbralCobertura = 30;
            const enriquecidos = mockItems.map(it => AnalisisRecompraData.calcularMetricasItem(it, diasPeriodo, umbralCobertura));
            const html = AnalisisRecompraTemplates.getTableRowsHTML(enriquecidos, { diasPeriodo, umbralCobertura });

            assert.ok(html.includes('2315'));
            assert.ok(html.includes('Kit Mouse &amp; Keyboard Rechargeable') || html.includes('Kit Mouse & Keyboard'));
            assert.ok(html.includes('btn-open-drawer') || html.includes('payment-row'));
        });

        it('getTableFooterHTML debe consolidar presupuesto e ítems para la decisión de compra', () => {
            const diasPeriodo = 90;
            const umbralCobertura = 30;
            const enriquecidos = mockItems.map(it => AnalisisRecompraData.calcularMetricasItem(it, diasPeriodo, umbralCobertura));
            const html = AnalisisRecompraTemplates.getTableFooterHTML(enriquecidos);

            assert.ok(html.includes('<tfoot'));
            assert.ok(html.includes('Total Sugerido a Pedir') || html.includes('Total Consolidado'));
            assert.ok(html.includes('$'));
        });

        it('getDrawerContentHTML debe renderizar ficha 360°, simulador interactivo y link a orden de compra', () => {
            const diasPeriodo = 90;
            const umbralCobertura = 30;
            const item = AnalisisRecompraData.calcularMetricasItem(mockItems[0], diasPeriodo, umbralCobertura);
            const html = AnalisisRecompraTemplates.getDrawerContentHTML(item, { diasPeriodo, umbralCobertura });

            assert.ok(html.includes('2315'));
            assert.ok(html.includes('Simulador de Compra'));
            assert.ok(html.includes('#/gastos/proveedores/nueva'), 'Debe enlazar a creación de compra');
        });
    });

    describe('Casos Borde, Sanitización y Resiliencia Defensiva (ECC Blindaje)', () => {
        it('debe manejar ítems con valores nulos, indefinidos o vacíos sin lanzar excepciones ni NaN', () => {
            const itemVacio = {
                sku: null,
                nombre: undefined,
                stock_actual: null,
                unidades_vendidas_periodo: null,
                rotacion_dias: null,
                costo_base: null,
                ultima_compra_costo: null
            };

            const met = AnalisisRecompraData.calcularMetricasItem(itemVacio, 90, 30);
            assert.strictEqual(met.venta_diaria, 0);
            assert.strictEqual(met.unidades_sugeridas, 0);
            assert.strictEqual(met.presupuesto_estimado, 0);
            assert.strictEqual(met.costo_referencia, 0);
            assert.strictEqual(met.categoria_recompra, 'saludable');
        });

        it('calcularKPIs y calcularTotales deben tolerar listas vacías retornando ceros seguros', () => {
            const kpisVacios = AnalisisRecompraData.calcularKPIs([]);
            assert.strictEqual(kpisVacios.totalItems, 0);
            assert.strictEqual(kpisVacios.presupuestoUrgente, 0);
            assert.strictEqual(kpisVacios.presupuestoTotal, 0);

            const totalesVacios = AnalisisRecompraData.calcularTotales([]);
            assert.strictEqual(totalesVacios.totalItems, 0);
            assert.strictEqual(totalesVacios.totalPresupuestoSugerido, 0);
        });

        it('debe sanitizar XSS en SKU, nombre y recomendaciones al renderizar tabla y drawer', () => {
            const itemMalicioso = {
                sku: '<script>alert("xss")</script>',
                nombre: '<img src=x onerror=alert("pwned")>',
                stock_actual: 5,
                unidades_vendidas_periodo: 10,
                rotacion_dias: 5,
                costo_base: 1000,
                recomendacion: '<b>Urgente</b>'
            };

            const diasPeriodo = 90;
            const umbralCobertura = 30;
            const enriquecido = AnalisisRecompraData.calcularMetricasItem(itemMalicioso, diasPeriodo, umbralCobertura);

            const rowHtml = AnalisisRecompraTemplates.getTableRowsHTML([enriquecido], { diasPeriodo, umbralCobertura });
            assert.ok(!rowHtml.includes('<script>'), 'No debe contener tags de script sin escapar');
            assert.ok(rowHtml.includes('&lt;script&gt;'), 'Debe escapar <script>');
            assert.ok(!rowHtml.includes('<img src=x'), 'No debe contener tag img sin escapar');

            const drawerHtml = AnalisisRecompraTemplates.getDrawerContentHTML(enriquecido, { diasPeriodo, umbralCobertura });
            assert.ok(!drawerHtml.includes('<script>'));
        });

        it('getAnalyticsViewHTML debe renderizar correctamente con o sin datos', () => {
            const htmlVacio = AnalisisRecompraTemplates.getAnalyticsViewHTML([]);
            assert.ok(htmlVacio.includes('No hay datos analíticos'));

            const diasPeriodo = 90;
            const umbralCobertura = 30;
            const enriquecidos = mockItems.map(it => AnalisisRecompraData.calcularMetricasItem(it, diasPeriodo, umbralCobertura));
            const htmlConDatos = AnalisisRecompraTemplates.getAnalyticsViewHTML(enriquecidos, { diasPeriodo, umbralCobertura });
            assert.ok(htmlConDatos.includes('Distribución de Inversión'));
            assert.ok(htmlConDatos.includes('Matriz de Decisión'));
        });
    });
});
