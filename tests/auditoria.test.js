import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AuditoriaData } from '../js/modules/auditoria/auditoria.data.js';
import { AuditoriaTemplates } from '../js/modules/auditoria/auditoria.templates.js';

describe('Módulo Auditoría de Integridad 360° - TDD Test Suite', () => {

    // ─────────────────────────────────────────────────────────────────────────
    // Mock Datasets de Chequeos
    // ─────────────────────────────────────────────────────────────────────────

    const mockChecksCatalog = [
        {
            id: 'VTA-001',
            category: 'ventas',
            title: 'Facturas con inconsistencia matemática (saldo original > total)',
            severity: 'critical',
            description: 'Detecta facturas con saldo inicial inconsistente.',
            result: { success: true, count: 0, data: [] }
        },
        {
            id: 'VTA-003',
            category: 'ventas',
            title: 'Discrepancia entre total de factura y suma de ítems',
            severity: 'critical',
            description: 'Detecta facturas cuyo total no coincide con factura_detalles.',
            result: {
                success: false,
                count: 2,
                columns: ['id', 'numero', 'total', 'suma_detalles', 'diferencia'],
                data: [
                    { id: 6180, numero: 6879, total: 257000, suma_detalles: 0, diferencia: 257000 },
                    { id: 6179, numero: 6878, total: 728500, suma_detalles: 0, diferencia: 728500 }
                ]
            }
        },
        {
            id: 'CAR-003',
            category: 'cartera',
            title: 'Contactos con identificación duplicada o inválida',
            severity: 'warning',
            description: 'Detecta contactos activos que comparten NIT.',
            result: {
                success: false,
                count: 1,
                columns: ['identificacion', 'total_registros', 'ids_afectados'],
                data: [
                    { identificacion: '79981638', total_registros: 3, ids_afectados: '700, 677, 694' }
                ]
            }
        },
        {
            id: 'INV-004',
            category: 'inventario',
            title: 'Alerta de Margen Negativo (Venta a Pérdida)',
            severity: 'warning',
            description: 'Productos activos con costo superior al precio de venta.',
            result: {
                success: false,
                count: 1,
                columns: ['sku', 'nombre', 'costo_base', 'precio_venta', 'perdida_unitaria'],
                data: [
                    { sku: '1306-S6', nombre: 'Goma Bomper S6', costo_base: 8265, precio_venta: 4500, perdida_unitaria: 3765 }
                ]
            }
        },
        {
            id: 'BNK-001',
            category: 'bancos',
            title: 'Pagos/Ingresos huérfanos de factura',
            severity: 'critical',
            description: 'Pagos que apuntan a facturas inexistentes.',
            result: { success: true, count: 0, data: [] }
        },
        {
            id: 'SEC-001',
            category: 'seguridad',
            title: 'Seguridad de infraestructura RLS',
            severity: 'critical',
            description: 'Tablas sin Row Level Security o sin políticas activas.',
            result: { success: true, count: 0, data: [] }
        }
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // 1. AuditoriaData.calcularKpis
    // ─────────────────────────────────────────────────────────────────────────
    describe('1. AuditoriaData.calcularKpis', () => {
        it('debe calcular con precisión matemática los KPIs ejecutivos y el Health Score', () => {
            const kpis = AuditoriaData.calcularKpis(mockChecksCatalog);

            assert.equal(kpis.totalChecks, 6);
            assert.equal(kpis.passedChecks, 3);
            assert.equal(kpis.failedChecks, 3);
            assert.equal(kpis.criticalDiscrepancies, 2); // 2 de VTA-003
            assert.equal(kpis.warningDiscrepancies, 2);  // 1 de CAR-003 + 1 de INV-004
            assert.equal(kpis.totalDiscrepancies, 4);

            // Health Score: 3 aprobados de 6, con 1 fallo crítico y 2 warnings
            assert.ok(kpis.healthScore >= 0 && kpis.healthScore <= 100);
            assert.equal(typeof kpis.healthScore, 'number');
            assert.equal(kpis.categoryCounts.ventas, 2);
            assert.equal(kpis.categoryCounts.cartera, 1);
            assert.equal(kpis.categoryCounts.inventario, 1);
            assert.equal(kpis.categoryCounts.bancos, 1);
            assert.equal(kpis.categoryCounts.seguridad, 1);
            assert.equal(kpis.categoryCounts.con_errores, 3);
        });

        it('debe retornar 100% de Health Score cuando todos los chequeos son exitosos', () => {
            const cleanChecks = mockChecksCatalog.map(c => ({
                ...c,
                result: { success: true, count: 0, data: [] }
            }));
            const kpis = AuditoriaData.calcularKpis(cleanChecks);

            assert.equal(kpis.healthScore, 100);
            assert.equal(kpis.passedChecks, 6);
            assert.equal(kpis.failedChecks, 0);
            assert.equal(kpis.totalDiscrepancies, 0);
        });

        it('debe manejar listas vacías, nulas o elementos con error de ejecución sin colapsar', () => {
            const errorChecks = [
                { id: 'ERR-1', category: 'ventas', severity: 'critical', result: null, error: new Error('Network error') },
                { id: 'ERR-2', category: 'cartera', severity: 'warning', result: { success: false, count: 1 } },
                { id: 'PEND-1', category: 'bancos', severity: 'info', result: null }
            ];
            const kpis = AuditoriaData.calcularKpis(errorChecks);

            assert.equal(kpis.totalChecks, 3);
            assert.equal(kpis.passedChecks, 0);
            assert.equal(kpis.failedChecks, 2);
            assert.equal(kpis.pendingChecks, 1);
            assert.ok(!isNaN(kpis.healthScore));

            const emptyKpis = AuditoriaData.calcularKpis([]);
            assert.equal(emptyKpis.healthScore, 100);
            assert.equal(emptyKpis.totalChecks, 0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. AuditoriaData.filtrarChequeos
    // ─────────────────────────────────────────────────────────────────────────
    describe('2. AuditoriaData.filtrarChequeos', () => {
        it('debe filtrar correctamente por tab de categoría', () => {
            const ventas = AuditoriaData.filtrarChequeos(mockChecksCatalog, 'ventas', '');
            assert.equal(ventas.length, 2);
            assert.ok(ventas.every(c => c.category === 'ventas'));

            const bancos = AuditoriaData.filtrarChequeos(mockChecksCatalog, 'bancos', '');
            assert.equal(bancos.length, 1);
            assert.equal(bancos[0].id, 'BNK-001');
        });

        it('debe filtrar por tab especial "con_errores"', () => {
            const conErrores = AuditoriaData.filtrarChequeos(mockChecksCatalog, 'con_errores', '');
            assert.equal(conErrores.length, 3);
            assert.ok(conErrores.every(c => c.result && !c.result.success));
        });

        it('debe buscar en tiempo real por ID de chequeo insensible a mayúsculas', () => {
            const res = AuditoriaData.filtrarChequeos(mockChecksCatalog, 'todas', 'vta-003');
            assert.equal(res.length, 1);
            assert.equal(res[0].id, 'VTA-003');
        });

        it('debe buscar en tiempo real por palabras clave en título o descripción', () => {
            const res = AuditoriaData.filtrarChequeos(mockChecksCatalog, 'todas', 'Margen');
            assert.equal(res.length, 1);
            assert.equal(res[0].id, 'INV-004');
        });

        it('debe combinar categoría y búsqueda por texto simultáneamente', () => {
            const res = AuditoriaData.filtrarChequeos(mockChecksCatalog, 'ventas', 'discrepancia');
            assert.equal(res.length, 1);
            assert.equal(res[0].id, 'VTA-003');

            const noMatch = AuditoriaData.filtrarChequeos(mockChecksCatalog, 'bancos', 'discrepancia');
            assert.equal(noMatch.length, 0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. AuditoriaData.mapearParaExportar & Blindaje CWE-1236
    // ─────────────────────────────────────────────────────────────────────────
    describe('3. AuditoriaData.mapearParaExportar & Blindaje CWE-1236', () => {
        it('debe generar filas tabulares listas para exportar a Excel / CSV', () => {
            const rows = AuditoriaData.mapearParaExcel(mockChecksCatalog);
            assert.ok(Array.isArray(rows));
            assert.ok(rows.length > 0);
            assert.ok(rows[0].hasOwnProperty('Código'));
            assert.ok(rows[0].hasOwnProperty('Chequeo'));
            assert.ok(rows[0].hasOwnProperty('Categoría'));
            assert.ok(rows[0].hasOwnProperty('Severidad'));
            assert.ok(rows[0].hasOwnProperty('Estado'));
            assert.ok(rows[0].hasOwnProperty('Discrepancias'));
        });

        it('debe neutralizar Formula Injection (CWE-1236) en textos maliciosos (=, +, -, @)', () => {
            const malicioso = [
                {
                    id: '=CMD|calc.exe',
                    category: '+admin',
                    title: '@DANGEROUS',
                    severity: '-alert',
                    result: { success: false, count: 1, data: [] }
                }
            ];
            const rows = AuditoriaData.mapearParaExcel(malicioso);
            assert.equal(rows[0]['Código'], "'=CMD|calc.exe");
            assert.equal(rows[0]['Categoría'], "'+admin");
            assert.equal(rows[0]['Chequeo'], "'@DANGEROUS");
            assert.equal(rows[0]['Severidad'], "'-alert");
        });

        it('debe generar un resumen Markdown estructurado para portapapeles', () => {
            const md = AuditoriaData.generarInformeMarkdown(mockChecksCatalog);
            assert.ok(typeof md === 'string');
            assert.ok(md.includes('# Informe de Auditoría de Integridad'));
            assert.ok(md.includes('Health Score:'));
            assert.ok(md.includes('VTA-003'));
            assert.ok(md.includes('Discrepancias'));
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. AuditoriaTemplates Formatters & Componentes UI
    // ─────────────────────────────────────────────────────────────────────────
    describe('4. AuditoriaTemplates Formatters & Componentes UI', () => {
        it('formatMoney debe formatear moneda COP ($ ...)', () => {
            assert.equal(AuditoriaTemplates.formatMoney(250000), '$ 250.000');
            assert.equal(AuditoriaTemplates.formatMoney(0), '$ 0');
            assert.equal(AuditoriaTemplates.formatMoney(null), '$ 0');
        });

        it('getSeverityBadge debe retornar badge HTML semántico según nivel', () => {
            const crit = AuditoriaTemplates.getSeverityBadge('critical');
            assert.ok(crit.includes('Crítico'));
            assert.ok(crit.includes('danger') || crit.includes('red') || crit.includes('#ef4444') || crit.includes('badge'));

            const warn = AuditoriaTemplates.getSeverityBadge('warning');
            assert.ok(warn.includes('Advertencia'));

            const info = AuditoriaTemplates.getSeverityBadge('info');
            assert.ok(info.includes('Informativo'));
        });

        it('getHealthBadge debe retornar badge con color dinámico según puntaje', () => {
            const high = AuditoriaTemplates.getHealthBadge(95);
            assert.ok(high.includes('Excelente') || high.includes('success'));

            const mid = AuditoriaTemplates.getHealthBadge(75);
            assert.ok(mid.includes('Atención') || mid.includes('warning'));

            const low = AuditoriaTemplates.getHealthBadge(45);
            assert.ok(low.includes('Crítico') || low.includes('danger'));
        });

        it('renderLayout debe generar Top Bar, 4 KPIs, Tabs, Toolbar y contenedor de lista', () => {
            const html = AuditoriaTemplates.renderLayout({
                kpis: AuditoriaData.calcularKpis(mockChecksCatalog),
                currentTab: 'todas',
                searchQuery: ''
            });

            assert.ok(html.includes('Auditoría'));
            assert.ok(html.includes('Health Score') || html.includes('Salud'));
            assert.ok(html.includes('id="btn-run-audit"'));
            assert.ok(html.includes('id="audit-search-input"'));
            assert.ok(html.includes('id="audit-checks-container"'));
            assert.ok(html.includes('id="btn-export-excel"'));
            assert.ok(html.includes('id="btn-copy-report"'));
        });

        it('renderCheckCard debe renderizar una tarjeta con sus detalles y escapar XSS (CWE-79)', () => {
            const checkConXSS = {
                id: 'XSS-001',
                category: 'ventas',
                title: '<script>alert("xss")</script>Inyección',
                severity: 'critical',
                description: 'Prueba de <b>seguridad</b>',
                result: {
                    success: false,
                    count: 1,
                    columns: ['id', 'valor'],
                    data: [{ id: 1, valor: '<img src=x onerror=alert(1)>' }]
                }
            };

            const cardHtml = AuditoriaTemplates.renderCheckCard(checkConXSS);
            assert.ok(!cardHtml.includes('<script>alert("xss")</script>'));
            assert.ok(cardHtml.includes('&lt;script&gt;'));
            assert.ok(!cardHtml.includes('<img src=x onerror=alert(1)>'));
        });
    });
});
