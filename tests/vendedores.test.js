import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { VendedoresData } from '../js/modules/vendedores/vendedores.data.js';
import { VendedoresTemplates } from '../js/modules/vendedores/vendedores.templates.js';

describe('Módulo Vendedores 360° Inteligente - TDD Test Suite', () => {

    // ─────────────────────────────────────────────────────────────────────────
    // Mock Datasets
    // ─────────────────────────────────────────────────────────────────────────

    const vendedoresMock = [
        {
            id: 1,
            nombre: 'Wilber López',
            telefono: '3158512091',
            porcentaje_comision: 10,
            estado: 'activo',
            total_vendido: 45000000,
            comision_generada: 4500000,
            comision_pagada: 3500000,
            comision_pendiente: 1000000
        },
        {
            id: 2,
            nombre: 'Mauricio Ramos',
            telefono: '3104567890',
            porcentaje_comision: 8,
            estado: 'activo',
            total_vendido: 25000000,
            comision_generada: 2000000,
            comision_pagada: 2000000,
            comision_pendiente: 0
        },
        {
            id: 3,
            nombre: 'Carlos Vendedor Nuevo',
            telefono: '3201112233',
            porcentaje_comision: 10,
            estado: 'activo',
            total_vendido: 0,
            comision_generada: 0,
            comision_pagada: 0,
            comision_pendiente: 0
        },
        {
            id: 4,
            nombre: 'Ana María Gómez',
            telefono: '3009998877',
            porcentaje_comision: 12,
            estado: 'inactivo',
            total_vendido: 12000000,
            comision_generada: 1440000,
            comision_pagada: 1000000,
            comision_pendiente: 440000
        }
    ];

    const comisionesMock = [
        { id: 101, factura_id: 501, vendedor_id: 1, monto: 500000, estado: 'pagada', fecha_pago: '2026-11-01', facturas: { numero: 6880, fecha: '2026-10-30', total: 5000000 } },
        { id: 102, factura_id: 502, vendedor_id: 1, monto: 500000, estado: 'pendiente', fecha_pago: null, facturas: { numero: 6885, fecha: '2026-11-10', total: 5000000 } },
        { id: 103, factura_id: 503, vendedor_id: 1, monto: 500000, estado: 'pendiente', fecha_pago: null, facturas: { numero: 6890, fecha: '2026-11-18', total: 5000000 } },
        { id: 104, factura_id: 504, vendedor_id: 2, monto: 2000000, estado: 'pagada', fecha_pago: '2026-11-05', facturas: { numero: 6882, fecha: '2026-11-02', total: 25000000 } },
        { id: 105, factura_id: 505, vendedor_id: 4, monto: 440000, estado: 'pendiente', fecha_pago: null, facturas: { numero: 6870, fecha: '2026-10-15', total: 3666666 } }
    ];

    // =========================================================================
    // 1. VendedoresData.getVendorAvatar
    // =========================================================================
    describe('1. VendedoresData.getVendorAvatar', () => {
        it('debe generar iniciales mayúsculas de 2 letras y paleta para nombre compuesto', () => {
            const avatar = VendedoresData.getVendorAvatar('Wilber López');
            assert.strictEqual(avatar.initials, 'WL');
            assert.ok(avatar.bg.startsWith('#'));
            assert.ok(avatar.color.startsWith('#'));
        });

        it('debe generar 2 caracteres para un nombre de una sola palabra', () => {
            const avatar = VendedoresData.getVendorAvatar('Mauricio');
            assert.strictEqual(avatar.initials, 'MA');
        });

        it('debe manejar valores nulos, vacíos o indefinidos con fallback seguro', () => {
            const avatarNull = VendedoresData.getVendorAvatar(null);
            assert.strictEqual(avatarNull.initials, '?');
            assert.strictEqual(avatarNull.bg, '#f1f5f9');
            assert.strictEqual(avatarNull.color, '#64748b');

            const avatarEmpty = VendedoresData.getVendorAvatar('   ');
            assert.strictEqual(avatarEmpty.initials, '?');
        });

        it('debe ser determinista: mismo nombre siempre produce mismo color e iniciales', () => {
            const a1 = VendedoresData.getVendorAvatar('Wilber López');
            const a2 = VendedoresData.getVendorAvatar('Wilber López');
            assert.strictEqual(a1.bg, a2.bg);
            assert.strictEqual(a1.color, a2.color);
            assert.strictEqual(a1.initials, a2.initials);
        });
    });

    // =========================================================================
    // 2. VendedoresData.calcularKpis
    // =========================================================================
    describe('2. VendedoresData.calcularKpis', () => {
        it('debe calcular con precisión matemática los 4 KPIs ejecutivos y contadores de tabs', () => {
            const kpis = VendedoresData.calcularKpis(vendedoresMock);

            // Total vendido = 45M + 25M + 0 + 12M = 82,000,000
            assert.strictEqual(kpis.totalVendido, 82000000);

            // Comisiones pendientes = 1,000,000 + 0 + 0 + 440,000 = 1,440,000
            assert.strictEqual(kpis.comisionPendiente, 1440000);

            // Comisiones pagadas = 3,500,000 + 2,000,000 + 0 + 1,000,000 = 6,500,000
            assert.strictEqual(kpis.comisionPagada, 6500000);

            // Total comisiones generadas = 1,440,000 + 6,500,000 = 7,940,000
            assert.strictEqual(kpis.totalComisiones, 7940000);

            // Tasa de liquidación = (6,500,000 / 7,940,000) * 100 ~= 81.86%
            assert.strictEqual(Math.round(kpis.tasaLiquidacion), 82);

            // Vendedores activos / inactivos
            assert.strictEqual(kpis.vendedoresActivos, 3);
            assert.strictEqual(kpis.vendedoresInactivos, 1);
            assert.strictEqual(kpis.totalVendedores, 4);

            // Top vendedor
            assert.strictEqual(kpis.topVendedor?.nombre, 'Wilber López');
            assert.strictEqual(kpis.topVendedor?.total_vendido, 45000000);

            // Tab counts: todas=4, pendientes=2 (Wilber, Ana), al_dia=2 (Mauricio, Carlos), top=2, inactivos=1
            assert.strictEqual(kpis.tabCounts.todas, 4);
            assert.strictEqual(kpis.tabCounts.pendientes, 2);
            assert.strictEqual(kpis.tabCounts.al_dia, 2);
            assert.strictEqual(kpis.tabCounts.inactivos, 1);
        });

        it('debe manejar listas vacías, nulas o con valores corruptos sin lanzar NaN ni colapsar', () => {
            const kpis = VendedoresData.calcularKpis([]);
            assert.strictEqual(kpis.totalVendido, 0);
            assert.strictEqual(kpis.comisionPendiente, 0);
            assert.strictEqual(kpis.comisionPagada, 0);
            assert.strictEqual(kpis.tasaLiquidacion, 0);
            assert.strictEqual(kpis.vendedoresActivos, 0);
            assert.strictEqual(kpis.topVendedor, null);
            assert.strictEqual(kpis.tabCounts.todas, 0);
        });
    });

    // =========================================================================
    // 3. VendedoresData.generarInsightsInteligentes
    // =========================================================================
    describe('3. VendedoresData.generarInsightsInteligentes (Motor de Inteligencia)', () => {
        it('debe identificar al Top Performer con su cuota de mercado sobre el total de ventas', () => {
            const insights = VendedoresData.generarInsightsInteligentes(vendedoresMock);
            assert.ok(insights.topPerformer);
            assert.strictEqual(insights.topPerformer.nombre, 'Wilber López');
            // Cuota de ventas: 45M / 82M = ~54.88%
            assert.strictEqual(Math.round(insights.topPerformer.porcentajeTotal), 55);
        });

        it('debe alertar sobre vendedores con comisiones pendientes acumuladas', () => {
            const insights = VendedoresData.generarInsightsInteligentes(vendedoresMock);
            assert.strictEqual(insights.alertasPendientes.length, 2);
            assert.strictEqual(insights.mayorPendiente.nombre, 'Wilber López');
            assert.strictEqual(insights.mayorPendiente.monto, 1000000);
        });

        it('debe detectar inactividad comercial en vendedores registrados sin ventas', () => {
            const insights = VendedoresData.generarInsightsInteligentes(vendedoresMock);
            assert.ok(insights.inactivosSinVentas.some(v => v.nombre === 'Carlos Vendedor Nuevo'));
        });

        it('debe calcular sugerencias de acción comercial proactiva', () => {
            const insights = VendedoresData.generarInsightsInteligentes(vendedoresMock);
            assert.ok(Array.isArray(insights.recomendaciones));
            assert.ok(insights.recomendaciones.length > 0);
        });
    });

    // =========================================================================
    // 4. VendedoresData.filtrarYOrdenar
    // =========================================================================
    describe('4. VendedoresData.filtrarYOrdenar', () => {
        it('debe filtrar por tab "pendientes"', () => {
            const res = VendedoresData.filtrarYOrdenar(vendedoresMock, { tab: 'pendientes' });
            assert.strictEqual(res.length, 2);
            assert.ok(res.every(v => Number(v.comision_pendiente) > 0));
        });

        it('debe filtrar por tab "al_dia"', () => {
            const res = VendedoresData.filtrarYOrdenar(vendedoresMock, { tab: 'al_dia' });
            assert.strictEqual(res.length, 2);
            assert.ok(res.every(v => Number(v.comision_pendiente) === 0 && v.estado === 'activo'));
        });

        it('debe filtrar por tab "inactivos"', () => {
            const res = VendedoresData.filtrarYOrdenar(vendedoresMock, { tab: 'inactivos' });
            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].nombre, 'Ana María Gómez');
        });

        it('debe buscar en tiempo real por nombre insensible a mayúsculas y acentos', () => {
            const res = VendedoresData.filtrarYOrdenar(vendedoresMock, { search: 'wilber' });
            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].nombre, 'Wilber López');

            const resAccents = VendedoresData.filtrarYOrdenar(vendedoresMock, { search: 'lopez' });
            assert.strictEqual(resAccents.length, 1);
        });

        it('debe buscar por teléfono', () => {
            const res = VendedoresData.filtrarYOrdenar(vendedoresMock, { search: '310456' });
            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].nombre, 'Mauricio Ramos');
        });

        it('debe ordenar por mayor venta por defecto o según parámetro', () => {
            const ordenadosPorVenta = VendedoresData.filtrarYOrdenar(vendedoresMock, { sortBy: 'total_vendido', sortOrder: 'desc' });
            assert.strictEqual(ordenadosPorVenta[0].nombre, 'Wilber López');
            assert.strictEqual(ordenadosPorVenta[1].nombre, 'Mauricio Ramos');

            const ordenadosPorPendiente = VendedoresData.filtrarYOrdenar(vendedoresMock, { sortBy: 'comision_pendiente', sortOrder: 'desc' });
            assert.strictEqual(ordenadosPorPendiente[0].nombre, 'Wilber López');
            assert.strictEqual(ordenadosPorPendiente[1].nombre, 'Ana María Gómez');
        });
    });

    // =========================================================================
    // 5. VendedoresData.validarVendedor
    // =========================================================================
    describe('5. VendedoresData.validarVendedor', () => {
        it('debe aceptar datos válidos y normalizar espacios', () => {
            const valid = VendedoresData.validarVendedor({
                nombre: '  Laura Zapata  ',
                telefono: '300 123 4567',
                porcentaje_comision: 7.5,
                estado: 'activo'
            });
            assert.strictEqual(valid.valido, true);
            assert.strictEqual(valid.data.nombre, 'Laura Zapata');
            assert.strictEqual(valid.data.porcentaje_comision, 7.5);
        });

        it('debe rechazar nombres vacíos', () => {
            const inv = VendedoresData.validarVendedor({ nombre: '   ', porcentaje_comision: 10 });
            assert.strictEqual(inv.valido, false);
            assert.ok(inv.error.includes('nombre'));
        });

        it('debe rechazar porcentajes fuera de rango (<0 o >100 o NaN)', () => {
            const inv1 = VendedoresData.validarVendedor({ nombre: 'Pepe', porcentaje_comision: -5 });
            assert.strictEqual(inv1.valido, false);

            const inv2 = VendedoresData.validarVendedor({ nombre: 'Pepe', porcentaje_comision: 120 });
            assert.strictEqual(inv2.valido, false);

            const inv3 = VendedoresData.validarVendedor({ nombre: 'Pepe', porcentaje_comision: 'diez' });
            assert.strictEqual(inv3.valido, false);
        });
    });

    // =========================================================================
    // 6. VendedoresData.mapearParaExcel (Blindaje CWE-1236)
    // =========================================================================
    describe('6. VendedoresData.mapearParaExcel & Blindaje CWE-1236', () => {
        it('debe generar filas tabulares listas para exportar', () => {
            const data = VendedoresData.mapearParaExcel(vendedoresMock);
            assert.strictEqual(data.length, 4);
            assert.strictEqual(data[0]['Vendedor'], 'Wilber López');
            assert.strictEqual(data[0]['Total Vendido'], 45000000);
            assert.strictEqual(data[0]['Comisión Pendiente'], 1000000);
        });

        it('debe neutralizar Formula Injection en campos de texto (=, +, -, @)', () => {
            const malicioso = [
                {
                    id: 99,
                    nombre: '=SUM(A1:A10)',
                    telefono: '+573158512091',
                    porcentaje_comision: 10,
                    estado: 'activo',
                    total_vendido: 1000,
                    comision_generada: 100,
                    comision_pagada: 100,
                    comision_pendiente: 0
                }
            ];
            const data = VendedoresData.mapearParaExcel(malicioso);
            assert.ok(data[0]['Vendedor'].startsWith("'="));
            assert.ok(data[0]['Teléfono'].startsWith("'+"));
        });
    });

    // =========================================================================
    // 7. VendedoresTemplates Formatters
    // =========================================================================
    describe('7. VendedoresTemplates Formatters', () => {
        it('formatMoney debe formatear moneda COP ($ ...) y tolerar ceros o nulos', () => {
            assert.strictEqual(VendedoresTemplates.formatMoney(1000000), '$ 1.000.000');
            assert.strictEqual(VendedoresTemplates.formatMoney(0), '$ 0');
            assert.strictEqual(VendedoresTemplates.formatMoney(null), '$ 0');
            assert.strictEqual(VendedoresTemplates.formatMoney(undefined), '$ 0');
        });

        it('formatPercent debe formatear números decimales con %', () => {
            assert.strictEqual(VendedoresTemplates.formatPercent(10), '10%');
            assert.strictEqual(VendedoresTemplates.formatPercent(7.5), '7.5%');
            assert.strictEqual(VendedoresTemplates.formatPercent(0), '0%');
        });

        it('getEstadoBadge debe renderizar badge semántico activo o inactivo', () => {
            const badgeActivo = VendedoresTemplates.getEstadoBadge('activo');
            assert.ok(badgeActivo.includes('Activo'));
            assert.ok(badgeActivo.includes('bg-success'));

            const badgeInactivo = VendedoresTemplates.getEstadoBadge('inactivo');
            assert.ok(badgeInactivo.includes('Inactivo'));
            assert.ok(badgeInactivo.includes('bg-secondary'));
        });

        it('getComisionBadge debe alertar si hay pendientes o felicitar si está al día', () => {
            const badgePendiente = VendedoresTemplates.getComisionBadge(500000);
            assert.ok(badgePendiente.includes('Pendiente'));
            assert.ok(badgePendiente.includes('500.000'));

            const badgeAlDia = VendedoresTemplates.getComisionBadge(0);
            assert.ok(badgeAlDia.includes('Al día'));
        });
    });

    // =========================================================================
    // 8. VendedoresTemplates Componentes UI
    // =========================================================================
    describe('8. VendedoresTemplates Componentes UI', () => {
        it('renderLayout debe generar Top Bar con badge 360, 4 payment-kpi-cards, tabs y container de drawer', () => {
            const state = {
                vendedores: vendedoresMock,
                kpis: VendedoresData.calcularKpis(vendedoresMock),
                insights: VendedoresData.generarInsightsInteligentes(vendedoresMock),
                currentTab: 'todas',
                currentView: 'lista',
                searchQuery: ''
            };
            const html = VendedoresTemplates.renderLayout(state);
            assert.ok(html.includes('payment-kpi-card'));
            assert.ok(html.includes('payment-tabs-bar'));
            assert.ok(html.includes('ds-search-container'));
            assert.ok(html.includes('drawer-vendedor-360'));
            assert.ok(html.includes('btn-view-lista'));
            assert.ok(html.includes('btn-view-grafico'));
            assert.ok(html.includes('btn-export-excel'));
            assert.ok(html.includes('btn-nuevo-vendedor-top'));
        });

        it('renderTabla debe renderizar filas con avatares, métricas y pie de tabla tfoot', () => {
            const html = VendedoresTemplates.renderTabla(vendedoresMock);
            assert.ok(html.includes('Wilber López'));
            assert.ok(html.includes('Mauricio Ramos'));
            assert.ok(html.includes('tfoot'));
            assert.ok(html.includes('82.000.000')); // Total del pie
        });

        it('renderTabla con lista vacía debe renderizar estado vacío amigable', () => {
            const html = VendedoresTemplates.renderTabla([]);
            assert.ok(html.includes('No se encontraron vendedores'));
        });

        it('renderDrawerContent debe renderizar avatar, tabs y comisiones con botón de liquidación masiva', () => {
            const cuentasMock = [{ id: 1, nombre: 'Bancolombia' }];
            const html = VendedoresTemplates.renderDrawerContent(vendedoresMock[0], comisionesMock, cuentasMock);
            assert.ok(html.includes('Wilber López'));
            assert.ok(html.includes('Liquidar'));
            assert.ok(html.includes('1.000.000'));
        });

        it('renderAnalitica debe contener los canvas para Chart.js y tarjetas de diagnóstico', () => {
            const insights = VendedoresData.generarInsightsInteligentes(vendedoresMock);
            const html = VendedoresTemplates.renderAnalitica(vendedoresMock, insights);
            assert.ok(html.includes('chartVentasVendedores'));
            assert.ok(html.includes('chartComisionesVendedores'));
            assert.ok(html.includes('Top Performer'));
        });
    });

    // =========================================================================
    // 9. Blindaje de Seguridad y Prevención XSS
    // =========================================================================
    describe('9. Blindaje de Seguridad y Auditoría OWASP', () => {
        it('debe sanitizar XSS en nombres de vendedores y teléfonos al renderizar', () => {
            const xssVendor = [
                {
                    id: 999,
                    nombre: '<script>alert("XSS")</script> Pedro',
                    telefono: '<img src=x onerror=alert(1)>',
                    porcentaje_comision: 10,
                    estado: 'activo',
                    total_vendido: 1000,
                    comision_generada: 100,
                    comision_pagada: 100,
                    comision_pendiente: 0
                }
            ];
            const html = VendedoresTemplates.renderTabla(xssVendor);
            assert.ok(!html.includes('<script>alert("XSS")</script>'));
            assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
        });
    });

    // =========================================================================
    // 10. VendedoresModule Orquestador & Fachada
    // =========================================================================
    describe('10. VendedoresModule Orquestador', () => {
        it('debe exportar estado inicial y métodos públicos esperados por el SPA Router', async () => {
            const { VendedoresModule } = await import('../js/modules/vendedores/vendedores.js');
            assert.ok(VendedoresModule);
            assert.strictEqual(typeof VendedoresModule.init, 'function');
            assert.strictEqual(typeof VendedoresModule.cargarDatos, 'function');
            assert.strictEqual(typeof VendedoresModule.render, 'function');
            assert.strictEqual(typeof VendedoresModule.recargar, 'function');
            assert.strictEqual(typeof VendedoresModule.renderList, 'function');
            assert.strictEqual(typeof VendedoresModule.renderDetalle, 'function');
            assert.strictEqual(VendedoresModule.state.currentTab, 'todas');
            assert.strictEqual(VendedoresModule.state.currentView, 'lista');
        });
    });
});
