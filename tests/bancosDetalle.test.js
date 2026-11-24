import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DetalleBancoModule } from '../js/modules/bancos/detalle.js';

describe('Módulo Detalle Bancario y Libro Auxiliar 360° - TDD Test Suite', () => {

    const cuentaDaviplataMock = {
        id: 23,
        nombre: 'DaviPlata',
        tipo: 'Banco',
        numero: '3158512091',
        estado: 'activo',
        saldo_inicial: 50000
    };

    const cuentaBancolombiaMock = {
        id: 1,
        nombre: '3349 - Bancolombia Wilber',
        tipo: 'Banco',
        numero: '3349',
        estado: 'activo',
        saldo_inicial: 0
    };

    const transaccionesMock = [
        {
            id: 26400,
            fecha: '2026-11-23',
            tipo: 'egreso',
            monto: 19000,
            terceroNombre: 'Diego2025',
            terceroNit: '79981638',
            cuentaContable: 'Otros',
            observaciones: 'Pago varios',
            conciliacion_id: null,
            conciliado_en: null
        },
        {
            id: 26379,
            fecha: '2026-11-20',
            tipo: 'egreso',
            monto: 7952,
            terceroNombre: 'Ajuste automático de conciliación',
            terceroNit: '',
            cuentaContable: 'Impuestos bancarios',
            observaciones: '4x1000 GMF',
            conciliacion_id: 15,
            conciliado_en: '2026-11-20T10:00:00Z'
        },
        {
            id: 26377,
            fecha: '2026-11-20',
            tipo: 'ingreso',
            monto: 1164000,
            terceroNombre: 'Paula Valentina Garcia',
            terceroNit: '1007249489',
            cuentaContable: 'Ingresos No Operacionales',
            observaciones: 'Pago recibido',
            conciliacion_id: null,
            conciliado_en: null
        },
        {
            id: 26368,
            fecha: '2026-11-20',
            tipo: 'ingreso',
            monto: 124000,
            terceroNombre: 'Pedro German Torres V.',
            terceroNit: '80187119',
            cuentaContable: 'Cuentas por Cobrar (Recaudo)',
            observaciones: 'Abono cliente',
            conciliacion_id: 15,
            conciliado_en: '2026-11-20T10:00:00Z'
        },
        {
            id: 26345,
            fecha: '2026-11-16',
            tipo: 'egreso',
            monto: 150000,
            terceroNombre: 'AAACaja general - Retiro Melgar',
            terceroNit: '',
            cuentaContable: 'Transferencia',
            observaciones: 'Traslado a caja',
            conciliacion_id: null,
            conciliado_en: null
        }
    ];

    // =========================================================================
    // 1. DetalleBancoModule.calcularKpis
    // =========================================================================
    describe('DetalleBancoModule.calcularKpis', () => {
        it('debe calcular con exactitud saldo, total entradas, total salidas y métricas de conciliación', () => {
            const saldosMock = { 23: 123383 };
            const kpis = DetalleBancoModule.calcularKpis(cuentaDaviplataMock, saldosMock, transaccionesMock, 3);

            // Saldo en libros = 123,383
            assert.strictEqual(kpis.saldoLibros, 123383);

            // Entradas: 1,164,000 + 124,000 = 1,288,000
            assert.strictEqual(kpis.totalIngresos, 1288000);
            assert.strictEqual(kpis.conteoIngresos, 2);

            // Salidas: 19,000 + 7,952 + 150,000 = 176,952
            assert.strictEqual(kpis.totalEgresos, 176952);
            assert.strictEqual(kpis.conteoEgresos, 3);

            // Movimientos pendientes por conciliar: 3
            assert.strictEqual(kpis.conteoPendientes, 3);

            // Movimientos ya conciliados: 2 (id 26379 y 26368)
            assert.strictEqual(kpis.conteoConciliados, 2);

            // Conteos para pestañas
            assert.strictEqual(kpis.tabCounts.todas, 5);
            assert.strictEqual(kpis.tabCounts.ingresos, 2);
            assert.strictEqual(kpis.tabCounts.egresos, 3);
            assert.strictEqual(kpis.tabCounts.pendientes, 3);
            assert.strictEqual(kpis.tabCounts.conciliados, 2);
        });

        it('debe tolerar datos vacíos o nulos sin producir NaN', () => {
            const kpis = DetalleBancoModule.calcularKpis(null, {}, [], 0);
            assert.strictEqual(kpis.saldoLibros, 0);
            assert.strictEqual(kpis.totalIngresos, 0);
            assert.strictEqual(kpis.totalEgresos, 0);
            assert.strictEqual(kpis.conteoPendientes, 0);
            assert.strictEqual(kpis.conteoConciliados, 0);
            assert.strictEqual(kpis.tabCounts.todas, 0);
        });
    });

    // =========================================================================
    // 2. DetalleBancoModule.filtrarMovimientos
    // =========================================================================
    describe('DetalleBancoModule.filtrarMovimientos', () => {
        it('debe filtrar exclusivamente ingresos al seleccionar pestaña ingresos', () => {
            const filtrados = DetalleBancoModule.filtrarMovimientos(transaccionesMock, { tab: 'ingresos' });
            assert.strictEqual(filtrados.length, 2);
            assert.ok(filtrados.every(t => t.tipo === 'ingreso'));
        });

        it('debe filtrar exclusivamente egresos al seleccionar pestaña egresos', () => {
            const filtrados = DetalleBancoModule.filtrarMovimientos(transaccionesMock, { tab: 'egresos' });
            assert.strictEqual(filtrados.length, 3);
            assert.ok(filtrados.every(t => t.tipo === 'egreso'));
        });

        it('debe filtrar movimientos pendientes de conciliación', () => {
            const filtrados = DetalleBancoModule.filtrarMovimientos(transaccionesMock, { tab: 'pendientes' });
            assert.strictEqual(filtrados.length, 3);
            assert.ok(filtrados.every(t => !t.conciliacion_id && !t.conciliado_en));
        });

        it('debe filtrar movimientos ya conciliados', () => {
            const filtrados = DetalleBancoModule.filtrarMovimientos(transaccionesMock, { tab: 'conciliados' });
            assert.strictEqual(filtrados.length, 2);
            assert.ok(filtrados.every(t => Boolean(t.conciliacion_id || t.conciliado_en)));
        });

        it('debe buscar en tiempo real por tercero insensible a mayúsculas y acentos', () => {
            const filtrados = DetalleBancoModule.filtrarMovimientos(transaccionesMock, { search: 'paula' });
            assert.strictEqual(filtrados.length, 1);
            assert.strictEqual(filtrados[0].id, 26377);
        });

        it('debe buscar por NIT o documento', () => {
            const filtrados = DetalleBancoModule.filtrarMovimientos(transaccionesMock, { search: '80187119' });
            assert.strictEqual(filtrados.length, 1);
            assert.strictEqual(filtrados[0].id, 26368);
        });

        it('debe buscar por categoría contable', () => {
            const filtrados = DetalleBancoModule.filtrarMovimientos(transaccionesMock, { search: 'impuestos' });
            assert.strictEqual(filtrados.length, 1);
            assert.strictEqual(filtrados[0].id, 26379);
        });

        it('debe filtrar por rango de fechas', () => {
            const filtrados = DetalleBancoModule.filtrarMovimientos(transaccionesMock, {
                fechaDesde: '2026-11-20',
                fechaHasta: '2026-11-23'
            });
            // 2026-11-23 (1), 2026-11-20 (3) -> total 4 (excluye 2026-11-16)
            assert.strictEqual(filtrados.length, 4);
        });
    });

    // =========================================================================
    // 3. DetalleBancoModule.getThirdPartyAvatar
    // =========================================================================
    describe('DetalleBancoModule.getThirdPartyAvatar', () => {
        it('debe generar avatar de dos letras para nombres compuestos de clientes/proveedores', () => {
            const avatar = DetalleBancoModule.getThirdPartyAvatar('Paula Valentina Garcia', true);
            assert.strictEqual(avatar.initials, 'PV');
            assert.ok(avatar.bg);
            assert.ok(avatar.color);
        });

        it('debe tolerar nombres de una sola palabra', () => {
            const avatar = DetalleBancoModule.getThirdPartyAvatar('Diego2025', false);
            assert.strictEqual(avatar.initials, 'DI');
        });

        it('debe proveer fallback seguro para registros sin tercero', () => {
            const avatar = DetalleBancoModule.getThirdPartyAvatar('', false);
            assert.strictEqual(avatar.initials, '?');
        });
    });

    // =========================================================================
    // 4. DetalleBancoModule.mapearParaExport & Blindaje CWE-1236
    // =========================================================================
    describe('DetalleBancoModule.mapearParaExport & Blindaje CWE-1236', () => {
        it('debe generar filas tabulares estructuradas para Excel', () => {
            const filas = DetalleBancoModule.mapearParaExport(transaccionesMock, cuentaDaviplataMock);
            assert.strictEqual(filas.length, 5);
            assert.ok(filas[0].Fecha);
            assert.ok(filas[0]['Nº Transacción']);
            assert.ok(filas[0].Tercero);
            assert.ok(filas[0]['Estado Conciliación']);
        });

        it('debe neutralizar inyección de fórmulas (=, +, -, @) en campos de texto', () => {
            const txInyeccion = [{
                id: 99999,
                fecha: '2026-11-24',
                tipo: 'egreso',
                monto: 100,
                terceroNombre: '=cmd|"/c calc"!A0',
                terceroNit: '+573158512091',
                cuentaContable: '@SUM(A1:A10)',
                observaciones: '-2+5+cmd',
                conciliacion_id: null
            }];

            const filas = DetalleBancoModule.mapearParaExport(txInyeccion, cuentaDaviplataMock);
            assert.ok(filas[0].Tercero.startsWith("'="), 'Debe prefijar con apóstrofe');
            assert.ok(filas[0].NIT.startsWith("'+"), 'Debe prefijar con apóstrofe');
            assert.ok(filas[0]['Cuenta Contable'].startsWith("'@"), 'Debe prefijar con apóstrofe');
        });
    });

    // =========================================================================
    // 5. DetalleBancoModule.renderLayout
    // =========================================================================
    describe('DetalleBancoModule.renderLayout', () => {
        it('debe incluir Top Bar con identidad DaviPlata (avatar DP rojo) y botón directo de Conciliar', () => {
            const stateMock = {
                cuenta: cuentaDaviplataMock,
                kpis: {
                    saldoLibros: 123383,
                    totalIngresos: 1288000,
                    conteoIngresos: 2,
                    totalEgresos: 176952,
                    conteoEgresos: 3,
                    conteoPendientes: 3,
                    conteoConciliados: 2,
                    tabCounts: { todas: 5, ingresos: 2, egresos: 3, pendientes: 3, conciliados: 2 }
                },
                currentTab: 'todas',
                searchQuery: '',
                fechaDesde: '',
                fechaHasta: ''
            };

            const html = DetalleBancoModule.renderLayout(stateMock);

            assert.ok(html.includes('dash-layout'), 'Debe usar contenedor dash-layout');
            assert.ok(html.includes('DaviPlata'), 'Debe mostrar el nombre de la cuenta');
            assert.ok(html.includes('DP'), 'Debe mostrar las iniciales del avatar del banco');
            assert.ok(html.includes('payment-kpi-card'), 'Debe usar payment-kpi-card');
            assert.ok(html.includes('payment-tabs-bar'), 'Debe incluir payment-tabs-bar');
            assert.ok(html.includes('dash-table-container'), 'Debe incluir dash-table-container');
            assert.ok(html.includes('#/bancos/conciliacion?banco_id=23'), 'Debe enlazar directamente a conciliar DaviPlata');
            assert.ok(html.includes('btn-export-excel'), 'Debe contener botón de exportar excel');
        });
    });
});
