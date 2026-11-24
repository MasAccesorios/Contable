import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TesoreriaData } from '../js/modules/bancos/bancos.data.js';
import { TesoreriaTemplates } from '../js/modules/bancos/bancos.templates.js';

describe('Módulo Bancos y Cajas 360° - TDD Test Suite', () => {

    const cuentasMock = [
        { id: 1, nombre: '3349 - Bancolombia Wilber', tipo: 'Banco', numero: '**** 3349', estado: 'activo' },
        { id: 2, nombre: '8421 - Davivienda Mao', tipo: 'Banco', numero: '**** 8421', estado: 'activo' },
        { id: 3, nombre: 'DaviPlata', tipo: 'Banco', numero: '**** 2091', estado: 'activo' },
        { id: 4, nombre: 'Nequi', tipo: 'Banco', numero: '**** 2091', estado: 'activo' },
        { id: 5, nombre: 'NU Bank Ahorros', tipo: 'Banco', numero: '**** 0793', estado: 'activo' },
        { id: 6, nombre: 'Caja Mary', tipo: 'Caja', numero: '-', estado: 'activo' },
        { id: 7, nombre: 'AAACaja general', tipo: 'Caja', numero: '-', estado: 'activo' },
        { id: 8, nombre: 'Cuenta Vieja Inactiva', tipo: 'Banco', numero: '**** 0000', estado: 'inactivo' }
    ];

    const saldosMock = {
        1: 5000000,
        2: 2500000,
        3: 300000,
        4: 200000,
        5: 1500000,
        6: 450000,
        7: 850000,
        8: 0
    };

    // =========================================================================
    // 1. TesoreriaData.getBankAvatar
    // =========================================================================
    describe('TesoreriaData.getBankAvatar', () => {
        it('debe reconocer Bancolombia y retornar paleta amarilla institucional', () => {
            const avatar = TesoreriaData.getBankAvatar({ nombre: '3349 - Bancolombia Wilber', tipo: 'Banco' });
            assert.strictEqual(avatar.initials, 'BC');
            assert.strictEqual(avatar.brand, 'Bancolombia');
            assert.strictEqual(avatar.icon, 'bi-bank');
            assert.strictEqual(avatar.bg, '#fef3c7');
            assert.strictEqual(avatar.color, '#d97706');
        });

        it('debe reconocer Davivienda y retornar paleta roja', () => {
            const avatar = TesoreriaData.getBankAvatar({ nombre: '8421 - Davivienda Mao', tipo: 'Banco' });
            assert.strictEqual(avatar.initials, 'DV');
            assert.strictEqual(avatar.brand, 'Davivienda');
            assert.strictEqual(avatar.icon, 'bi-bank');
            assert.strictEqual(avatar.bg, '#fee2e2');
            assert.strictEqual(avatar.color, '#dc2626');
        });

        it('debe reconocer DaviPlata como billetera', () => {
            const avatar = TesoreriaData.getBankAvatar({ nombre: 'DaviPlata', tipo: 'Banco' });
            assert.strictEqual(avatar.initials, 'DP');
            assert.strictEqual(avatar.brand, 'DaviPlata');
            assert.strictEqual(avatar.icon, 'bi-phone');
        });

        it('debe reconocer Nu Bank con púrpura distintivo', () => {
            const avatar = TesoreriaData.getBankAvatar({ nombre: 'NU Bank Ahorros', tipo: 'Banco' });
            assert.strictEqual(avatar.initials, 'NU');
            assert.strictEqual(avatar.brand, 'Nu');
            assert.strictEqual(avatar.bg, '#f3e8ff');
            assert.strictEqual(avatar.color, '#7e22ce');
        });

        it('debe reconocer Nequi con fucsia distintivo', () => {
            const avatar = TesoreriaData.getBankAvatar({ nombre: 'Nequi', tipo: 'Banco' });
            assert.strictEqual(avatar.initials, 'NQ');
            assert.strictEqual(avatar.brand, 'Nequi');
            assert.strictEqual(avatar.color, '#db2777');
        });

        it('debe reconocer Cajas y Efectivo con verde esmeralda', () => {
            const avatar = TesoreriaData.getBankAvatar({ nombre: 'Caja Mary', tipo: 'Caja' });
            assert.strictEqual(avatar.initials, 'CJ');
            assert.strictEqual(avatar.brand, 'Efectivo');
            assert.strictEqual(avatar.icon, 'bi-cash-stack');
            assert.strictEqual(avatar.bg, '#ecfdf5');
            assert.strictEqual(avatar.color, '#059669');
        });
    });

    // =========================================================================
    // 2. TesoreriaData.calcularKpis
    // =========================================================================
    describe('TesoreriaData.calcularKpis', () => {
        it('debe calcular con precisión los 4 KPIs principales y los conteos de pestañas', () => {
            const kpis = TesoreriaData.calcularKpis(cuentasMock, saldosMock, 14);

            // Total Consolidado = 5M + 2.5M + 300K + 200K + 1.5M + 450K + 850K = 10,800,000
            assert.strictEqual(kpis.totalConsolidado, 10800000);
            
            // Total Bancos (1, 2, 3, 4, 5) = 5M + 2.5M + 300K + 200K + 1.5M = 9,500,000
            assert.strictEqual(kpis.totalBancos, 9500000);
            assert.strictEqual(kpis.bancosCount, 5);

            // Total Cajas (6, 7) = 450K + 850K = 1,300,000
            assert.strictEqual(kpis.totalCajas, 1300000);
            assert.strictEqual(kpis.cajasCount, 2);

            // Movimientos por conciliar
            assert.strictEqual(kpis.movimientosPorConciliar, 14);

            // Fecha de corte de conciliación (agosto 2026)
            assert.strictEqual(TesoreriaData.FECHA_CORTE_CONCILIACION, '2026-08-01');

            // Conteo de Tabs
            assert.strictEqual(kpis.tabCounts.todas, 7); // Activas
            assert.strictEqual(kpis.tabCounts.bancos, 5);
            assert.strictEqual(kpis.tabCounts.cajas, 2);
            assert.strictEqual(kpis.tabCounts.inactivas, 1);
        });
    });

    // =========================================================================
    // 3. TesoreriaData.filtrarCuentas
    // =========================================================================
    describe('TesoreriaData.filtrarCuentas', () => {
        it('debe filtrar por pestaña "bancos"', () => {
            const res = TesoreriaData.filtrarCuentas(cuentasMock, 'bancos', '');
            assert.strictEqual(res.length, 5);
            assert.ok(res.every(c => (c.tipo || '').toLowerCase() !== 'caja'));
        });

        it('debe filtrar por pestaña "cajas"', () => {
            const res = TesoreriaData.filtrarCuentas(cuentasMock, 'cajas', '');
            assert.strictEqual(res.length, 2);
            assert.ok(res.every(c => (c.tipo || '').toLowerCase() === 'caja'));
        });

        it('debe filtrar por pestaña "inactivas"', () => {
            const res = TesoreriaData.filtrarCuentas(cuentasMock, 'inactivas', '');
            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].id, 8);
        });

        it('debe clasificar cuentas con tipo "Efectivo" y estado "inactive" en inglés', () => {
            const cuentasMixtas = [
                { id: 10, nombre: 'Caja Menor', tipo: 'Efectivo', estado: 'activo' },
                { id: 11, nombre: 'Banco Antigua', tipo: 'Banco', estado: 'inactive' },
                { id: 12, nombre: 'Cuenta Sin Transacciones', tipo: 'Banco', estado: 'active', saldo_inicial: 200000 }
            ];
            const saldos = { 10: 50000 }; // 12 no tiene transacciones en pagos_ingresos

            const kpis = TesoreriaData.calcularKpis(cuentasMixtas, saldos, 0);

            assert.strictEqual(kpis.totalCajas, 50000, 'Caja con tipo Efectivo debe sumarse a totalCajas');
            assert.strictEqual(kpis.cajasCount, 1);
            assert.strictEqual(kpis.totalBancos, 200000, 'Debe tomar saldo_inicial para cuenta sin movimientos');
            assert.strictEqual(kpis.tabCounts.inactivas, 1, 'inactive debe contarse en inactivas');
            assert.strictEqual(kpis.tabCounts.todas, 2, 'Solo las activas deben sumarse a todas');

            const filtradasCajas = TesoreriaData.filtrarCuentas(cuentasMixtas, 'cajas', '');
            assert.strictEqual(filtradasCajas.length, 1);
            assert.strictEqual(filtradasCajas[0].id, 10);

            const filtradasInactivas = TesoreriaData.filtrarCuentas(cuentasMixtas, 'inactivas', '');
            assert.strictEqual(filtradasInactivas.length, 1);
            assert.strictEqual(filtradasInactivas[0].id, 11);
        });
    });

    // =========================================================================
    // 4. TesoreriaTemplates - Formatos y Layouts
    // =========================================================================
    describe('TesoreriaTemplates', () => {
        it('formatMoney debe formatear moneda estándar colombiana sin decimales innecesarios', () => {
            assert.strictEqual(TesoreriaTemplates.formatMoney(10800000), '$ 10.800.000');
            assert.strictEqual(TesoreriaTemplates.formatMoney(0), '$ 0');
            assert.strictEqual(TesoreriaTemplates.formatMoney(-150000), '$ -150.000');
        });

        it('renderDrawerContent debe renderizar el panel lateral con datos de cuenta y saldo inicial', () => {
            const ctxMock = {
                state: { saldos: {} },
                getBankAvatar: TesoreriaData.getBankAvatar,
                formatMoney: TesoreriaTemplates.formatMoney,
                formatFecha: TesoreriaTemplates.formatFecha
            };
            const html = TesoreriaTemplates.renderDrawerContent.call(ctxMock, {
                id: 99,
                nombre: 'Cuenta Nueva Sin Movimientos',
                tipo: 'Banco',
                numero: '**** 9999',
                saldo_inicial: 750000
            }, []);

            assert.ok(html.includes('$ 750.000'), 'Debe reflejar el saldo inicial');
            assert.ok(html.includes('Cuenta Nueva Sin Movimientos'));
            assert.ok(html.includes('Sin movimientos recientes registrados'));
        });

        it('renderLayout debe incluir la estructura de Gastos Operativos: Top Bar, 4 KPIs y Drawer', () => {
            const stateMock = {
                currentTab: 'todas',
                currentView: 'lista',
                kpis: {
                    totalConsolidado: 10800000,
                    totalBancos: 9500000,
                    bancosCount: 5,
                    totalCajas: 1300000,
                    cajasCount: 2,
                    movimientosPorConciliar: 14,
                    tabCounts: { todas: 7, bancos: 5, cajas: 2, inactivas: 1 }
                }
            };

            const html = TesoreriaTemplates.renderLayout(stateMock);

            assert.ok(html.includes('payment-kpi-card'), 'Debe usar la clase payment-kpi-card');
            assert.ok(html.includes('payment-tabs-bar'), 'Debe incluir payment-tabs-bar');
            assert.ok(html.includes('payment-drawer'), 'Debe incluir el Slide-over drawer');
            assert.ok(html.includes('btn-view-lista'), 'Debe incluir botón de vista lista');
            assert.ok(html.includes('btn-view-grafico'), 'Debe incluir botón de vista analítica');
            assert.ok(html.includes('btn-export-excel'), 'Debe incluir botón de exportar excel');
            assert.ok(html.includes('modal-transferir'), 'Debe preservar modal transferir');
            assert.ok(html.includes('modal-agregar-banco'), 'Debe preservar modal agregar banco');
            assert.ok(html.includes('modal-editar-banco'), 'Debe preservar modal editar banco');
            assert.ok(html.includes('desde ago 2026'), 'Debe indicar el corte temporal desde ago 2026 en el KPI');
        });
    });
    // =========================================================================
    // 5. Pruebas de Seguridad y Sanitización (ECC Security Reviewer)
    // =========================================================================
    describe('Seguridad y Sanitización (XSS, Excel Injection, Validación)', () => {
        it('formatFecha debe neutralizar payloads XSS en partes anómalas', () => {
            const res = TesoreriaTemplates.formatFecha('2026-11-<script>');
            assert.ok(!res.includes('<script>'), 'No debe contener tags sin escapar');
            assert.ok(res.includes('&lt;script&gt;'), 'Debe contener entidades HTML');
        });

        it('ejecutarTransferencia debe rechazar montos no finitos (Infinity, NaN, <= 0)', async () => {
            const resInf = await TesoreriaData.ejecutarTransferencia(1, 2, Infinity, '2026-11-20', 'test');
            assert.strictEqual(resInf, false, 'Debe rechazar Infinity');

            const resNaN = await TesoreriaData.ejecutarTransferencia(1, 2, NaN, '2026-11-20', 'test');
            assert.strictEqual(resNaN, false, 'Debe rechazar NaN');

            const resNeg = await TesoreriaData.ejecutarTransferencia(1, 2, -1000, '2026-11-20', 'test');
            assert.strictEqual(resNeg, false, 'Debe rechazar monto negativo');

            const resSame = await TesoreriaData.ejecutarTransferencia("1", 1, 50000, '2026-11-20', 'test');
            assert.strictEqual(resSame, false, 'Debe rechazar misma cuenta aunque un id sea string');
        });
    });
});