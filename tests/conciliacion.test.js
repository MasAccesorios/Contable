import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ConciliacionData } from '../js/modules/bancos/conciliacion.data.js';
import { ConciliacionTemplates } from '../js/modules/bancos/conciliacion.templates.js';

describe('Módulo Conciliación Bancaria 360° - TDD Test Suite', () => {

    const cuentaBancolombiaMock = {
        id: 24,
        nombre: 'Bancolombia Ahorros Principal',
        tipo: 'Banco',
        numero: '**** 5432'
    };

    const movimientosMock = [
        { id: 101, fecha: '2026-11-01', tipo: 'ingreso', monto: 1500000, detalle: 'Pago Factura 1020' },
        { id: 102, fecha: '2026-11-05', tipo: 'egreso', monto: 350000, detalle: 'Compra suministros' },
        { id: 103, fecha: '2026-11-10', tipo: 'egreso', monto: 120000, detalle: 'Servicio internet' },
        { id: 104, fecha: '2026-11-15', tipo: 'ingreso', monto: 800000, detalle: 'Abono cliente Cartera' },
        { id: 105, fecha: '2026-11-20', tipo: 'egreso', monto: 50000, detalle: 'Gastos varios' }
    ];

    // =========================================================================
    // 1. Identidad Institucional & Avatares
    // =========================================================================
    describe('ConciliacionData.getBankAvatar', () => {
        it('debe generar avatar correcto para Bancolombia', () => {
            const avatar = ConciliacionData.getBankAvatar(cuentaBancolombiaMock);
            assert.strictEqual(avatar.initials, 'BC');
            assert.strictEqual(avatar.brand, 'Bancolombia');
            assert.strictEqual(avatar.bg, '#fef3c7');
            assert.strictEqual(avatar.color, '#d97706');
        });

        it('debe generar avatar genérico seguro ante valores incompletos', () => {
            const avatar = ConciliacionData.getBankAvatar({ nombre: 'Banco Agrario', tipo: 'Banco' });
            assert.strictEqual(avatar.initials, 'BA');
            assert.strictEqual(avatar.icon, 'bi-bank');
        });

        it('debe reconocer cajas y efectivo con paleta verde', () => {
            const avatar = ConciliacionData.getBankAvatar({ nombre: 'Caja Principal', tipo: 'Caja' });
            assert.strictEqual(avatar.initials, 'CJ');
            assert.strictEqual(avatar.brand, 'Efectivo');
            assert.strictEqual(avatar.color, '#059669');
        });
    });

    // =========================================================================
    // 2. Motor Matemático de Cuadre Reactivo
    // =========================================================================
    describe('ConciliacionData.calcularDiferencia', () => {
        it('debe dar diferencia 0 cuando todos los movimientos coinciden exactamente', () => {
            const saldoAnterior = 1000000;
            // Entradas = 1500000 + 800000 = 2300000
            // Salidas = 350000 + 120000 + 50000 = 520000
            // Saldo Sistema = 1000000 + 2300000 - 520000 = 2780000
            const saldoSistema = 2780000;
            const saldoBancario = 2780000;
            const seleccionados = new Set([101, 102, 103, 104, 105]);
            const ajustes = { gastos: 0, impuestos: 0, entradas: 0 };

            const res = ConciliacionData.calcularDiferencia({
                saldoAnterior,
                saldoSistema,
                saldoBancario,
                movimientos: movimientosMock,
                seleccionados,
                ajustes
            });

            assert.strictEqual(res.diferencia, 0);
            assert.strictEqual(res.estadoSemaforo, 'cuadrado');
        });

        it('debe computar correctamente partidas en tránsito (movimientos no marcados)', () => {
            const saldoSistema = 2780000;
            // Si el extracto aún no refleja el movimiento 104 (+800,000 en tránsito):
            // Saldo real en extracto = 2780000 - 800000 = 1980000
            const saldoBancario = 1980000;
            // Solo se marcan 101, 102, 103, 105 (el 104 queda sin marcar)
            const seleccionados = new Set([101, 102, 103, 105]);
            const ajustes = { gastos: 0, impuestos: 0, entradas: 0 };

            const res = ConciliacionData.calcularDiferencia({
                saldoAnterior: 1000000,
                saldoSistema,
                saldoBancario,
                movimientos: movimientosMock,
                seleccionados,
                ajustes
            });

            assert.strictEqual(res.diferencia, 0);
            assert.strictEqual(res.estadoSemaforo, 'cuadrado');
        });

        it('debe integrar ajustes de gastos bancarios, 4x1000 y rendimientos', () => {
            const saldoSistema = 2780000;
            // El banco descontó $25,000 de comisión y $12,000 de 4x1000 que no estaban en sistema:
            const saldoBancario = 2780000 - 25000 - 12000; // 2743000
            const seleccionados = new Set([101, 102, 103, 104, 105]);
            const ajustes = { gastos: 25000, impuestos: 12000, entradas: 0 };

            const res = ConciliacionData.calcularDiferencia({
                saldoAnterior: 1000000,
                saldoSistema,
                saldoBancario,
                movimientos: movimientosMock,
                seleccionados,
                ajustes
            });

            assert.strictEqual(res.diferencia, 0);
            assert.strictEqual(res.estadoSemaforo, 'cuadrado');
        });

        it('debe reflejar descuadre activo con semáforo rojo cuando hay discrepancia real', () => {
            const saldoSistema = 2780000;
            const saldoBancario = 2500000; // $280,000 de diferencia sin justificar
            const seleccionados = new Set([101, 102, 103, 104, 105]);
            const ajustes = { gastos: 0, impuestos: 0, entradas: 0 };

            const res = ConciliacionData.calcularDiferencia({
                saldoAnterior: 1000000,
                saldoSistema,
                saldoBancario,
                movimientos: movimientosMock,
                seleccionados,
                ajustes
            });

            assert.strictEqual(res.diferencia, -280000);
            assert.strictEqual(res.estadoSemaforo, 'descuadrado');
        });

        it('debe clasificar en estado tolerancia cuando la diferencia es menor o igual a $100', () => {
            const res = ConciliacionData.calcularDiferencia({
                saldoAnterior: 1000000,
                saldoSistema: 2780000,
                saldoBancario: 2780050, // $50 de diferencia por ajuste menor
                movimientos: movimientosMock,
                seleccionados: new Set([101, 102, 103, 104, 105]),
                ajustes: { gastos: 0, impuestos: 0, entradas: 0 }
            });

            assert.strictEqual(res.diferencia, 50);
            assert.strictEqual(res.estadoSemaforo, 'tolerancia');
        });

        it('debe ser resiliente ante movimientos con montos nulos, undefined o strings numéricos', () => {
            const movsAnomalos = [
                { id: 201, tipo: 'ingreso', monto: '50000' },
                { id: 202, tipo: 'egreso', monto: null },
                { id: 203, tipo: 'egreso', monto: undefined }
            ];

            const res = ConciliacionData.calcularDiferencia({
                saldoAnterior: 0,
                saldoSistema: 50000,
                saldoBancario: 50000,
                movimientos: movsAnomalos,
                seleccionados: new Set([201, 202, 203]),
                ajustes: { gastos: 0, impuestos: 0, entradas: 0 }
            });

            assert.strictEqual(res.diferencia, 0);
            assert.strictEqual(res.estadoSemaforo, 'cuadrado');
        });
    });

    // =========================================================================
    // 3. Filtrado y Búsqueda Ergonómica en Memoria
    // =========================================================================
    describe('ConciliacionData.filtrarMovimientos', () => {
        it('debe filtrar exclusivamente egresos cuando se selecciona la pestaña de egresos', () => {
            const filtrados = ConciliacionData.filtrarMovimientos(movimientosMock, 'egresos', '', new Set());
            assert.strictEqual(filtrados.length, 3);
            assert.ok(filtrados.every(m => m.tipo === 'egreso'));
        });

        it('debe buscar insensible a mayúsculas/minúsculas por detalle o referencia', () => {
            const filtrados = ConciliacionData.filtrarMovimientos(movimientosMock, 'todos', 'INTERNET', new Set());
            assert.strictEqual(filtrados.length, 1);
            assert.strictEqual(filtrados[0].id, 103);
        });

        it('debe filtrar por estado de selección (pendientes vs marcados)', () => {
            const seleccionados = new Set([101, 102]);
            const marcados = ConciliacionData.filtrarMovimientos(movimientosMock, 'marcados', '', seleccionados);
            const pendientes = ConciliacionData.filtrarMovimientos(movimientosMock, 'pendientes', '', seleccionados);
            assert.strictEqual(marcados.length, 2);
            assert.strictEqual(pendientes.length, 3);
        });
    });

    // =========================================================================
    // 4. Integridad del Payload para RPC
    // =========================================================================
    describe('ConciliacionData.prepararPayloadGuardado', () => {
        it('debe estructurar el payload exacto requerido por guardar_conciliacion_bancaria', () => {
            const payload = ConciliacionData.prepararPayloadGuardado({
                editingId: null,
                bancoId: 24,
                fechaDesde: '2026-08-01',
                fechaHasta: '2026-11-20',
                saldoBancario: 2780000,
                saldoSistema: 2780000,
                diferenciaFinal: 0,
                movimientosConciliados: [101, 102, 103, 104, 105]
            });

            assert.strictEqual(payload.p_id, null);
            assert.strictEqual(payload.p_banco_id, 24);
            assert.strictEqual(payload.p_fecha_desde, '2026-08-01');
            assert.strictEqual(payload.p_fecha_hasta, '2026-11-20');
            assert.strictEqual(payload.p_saldo_bancario, 2780000);
            assert.strictEqual(payload.p_saldo_sistema, 2780000);
            assert.strictEqual(payload.p_diferencia, 0);
            assert.deepStrictEqual(payload.p_movimientos_conciliados, [101, 102, 103, 104, 105]);
        });
    });

    // =========================================================================
    // 5. ConciliacionTemplates
    // =========================================================================
    describe('ConciliacionTemplates Layout', () => {
        it('formatMoney debe formatear montos en pesos colombianos ($ ...)', () => {
            assert.strictEqual(ConciliacionTemplates.formatMoney(2780000), '$ 2.780.000');
            assert.strictEqual(ConciliacionTemplates.formatMoney(0), '$ 0');
        });

        it('renderBase debe renderizar la estructura con payment-kpi-card y payment-tabs-bar', () => {
            const fakeElement = { innerHTML: '' };
            const ctxMock = {
                element: fakeElement,
                state: {
                    cuentas: [cuentaBancolombiaMock],
                    bancoId: 24,
                    fechaDesde: '2026-08-20',
                    fechaHasta: '2026-11-20',
                    saldoAnterior: 1000000,
                    saldoBancario: 2780000,
                    saldoTotalSistema: 2780000,
                    diferenciaActual: 0,
                    estadoSemaforo: 'cuadrado',
                    movimientosRango: movimientosMock,
                    _seleccionados: new Set([101, 102, 103, 104, 105]),
                    currentTab: 'nueva',
                    filterTipoMovs: 'todos',
                    historialConciliaciones: []
                },
                getBankAvatar: ConciliacionData.getBankAvatar,
                formatMoney: ConciliacionTemplates.formatMoney
            };

            const html = ConciliacionTemplates.renderBase.call(ctxMock);
            assert.ok(html.includes('payment-kpi-card'), 'Debe utilizar payment-kpi-card');
            assert.ok(html.includes('payment-tabs-bar'), 'Debe utilizar payment-tabs-bar');
            assert.ok(html.includes('dash-table-container'), 'Debe utilizar dash-table-container');
            assert.ok(html.includes('btn-guardar-concil'), 'Debe incluir botón guardar conciliación');
            assert.strictEqual(fakeElement.innerHTML, html, 'renderBase debe poblar element.innerHTML directamente');
        });

        it('formatFecha debe formatear fechas válidas y sanitizar entradas maliciosas', () => {
            assert.strictEqual(ConciliacionTemplates.formatFecha('2026-11-20'), '20/11/2026');
            assert.strictEqual(ConciliacionTemplates.formatFecha('2026-11-20T14:30:00Z'), '20/11/2026');
            assert.strictEqual(ConciliacionTemplates.formatFecha('---'), '---');
            
            // XSS / Injection payload check
            const dirty = '2026-11-<script>alert(1)</script>';
            const cleaned = ConciliacionTemplates.formatFecha(dirty);
            assert.ok(!cleaned.includes('<script>'), 'Debe sanitizar caracteres HTML');
            assert.ok(cleaned.includes('&lt;script&gt;'), 'Debe escapar entidades HTML');
        });
    });
});
