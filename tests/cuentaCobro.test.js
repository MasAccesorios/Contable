import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CuentaCobroData } from '../js/modules/ingresos/cuentaCobro.data.js';
import { CuentaCobroTemplates } from '../js/modules/ingresos/cuentaCobro.templates.js';
import { escapeHtml } from '../js/shared/formatters.js';

describe('Módulo Cuentas de Cobro - TDD Test Suite', () => {

    // =========================================================================
    // 1. CuentaCobroData.determinarEstadoYCartera
    // =========================================================================
    describe('CuentaCobroData.determinarEstadoYCartera', () => {
        const fechaHoyRef = new Date('2026-11-19T12:00:00');

        it('debe marcar como "cobrada" una cuenta con forma de pago Contado (saldo = 0, totalCobrado = total)', () => {
            const doc = {
                id: 1,
                numero: 101,
                fecha: '2026-11-10',
                fecha_vencimiento: '2026-11-10',
                forma_pago: 'Contado',
                total: 250000
            };

            const resultado = CuentaCobroData.determinarEstadoYCartera(doc, fechaHoyRef);

            assert.strictEqual(resultado.estado, 'cobrada');
            assert.strictEqual(resultado.saldo, 0);
            assert.strictEqual(resultado.totalCobrado, 250000);
            assert.strictEqual(resultado.diasVencida, 0);
            assert.strictEqual(resultado.isCobrada, true);
        });

        it('debe marcar como "vencida" una cuenta a Crédito cuya fecha de vencimiento ya pasó (diasVencida > 0, saldo = total)', () => {
            const doc = {
                id: 2,
                numero: 102,
                fecha: '2026-10-01',
                fecha_vencimiento: '2026-10-31',
                forma_pago: 'Crédito',
                total: 500000
            };

            const resultado = CuentaCobroData.determinarEstadoYCartera(doc, fechaHoyRef);

            assert.strictEqual(resultado.estado, 'vencida');
            assert.strictEqual(resultado.saldo, 500000);
            assert.strictEqual(resultado.totalCobrado, 0);
            assert.ok(resultado.diasVencida > 0, 'diasVencida debe ser mayor a 0');
            assert.strictEqual(resultado.isVencida, true);
        });

        it('debe marcar como "pendiente" una cuenta a Crédito con vencimiento futuro o el mismo día', () => {
            const doc = {
                id: 3,
                numero: 103,
                fecha: '2026-11-15',
                fecha_vencimiento: '2026-11-30',
                forma_pago: 'Crédito',
                total: 750000
            };

            const resultado = CuentaCobroData.determinarEstadoYCartera(doc, fechaHoyRef);

            assert.strictEqual(resultado.estado, 'pendiente');
            assert.strictEqual(resultado.saldo, 750000);
            assert.strictEqual(resultado.totalCobrado, 0);
            assert.strictEqual(resultado.diasVencida, 0);
            assert.strictEqual(resultado.isPendiente, true);
        });

        it('debe marcar como "anulada" si el estado original es "anulada" independientemente de fechas y montos', () => {
            const doc = {
                id: 4,
                numero: 104,
                fecha: '2026-10-01',
                fecha_vencimiento: '2026-10-15',
                forma_pago: 'Crédito',
                estado: 'anulada',
                total: 1000000
            };

            const resultado = CuentaCobroData.determinarEstadoYCartera(doc, fechaHoyRef);

            assert.strictEqual(resultado.estado, 'anulada');
            assert.strictEqual(resultado.saldo, 0);
            assert.strictEqual(resultado.totalCobrado, 0);
            assert.strictEqual(resultado.diasVencida, 0);
            assert.strictEqual(resultado.isAnulada, true);
        });

        it('edge case: doc con saldo explícito 0 debe marcarse como "cobrada"', () => {
            const doc = {
                id: 5,
                numero: 105,
                fecha: '2026-10-01',
                fecha_vencimiento: '2026-10-15',
                forma_pago: 'Crédito',
                total: 400000,
                saldo: 0,
                total_pagado: 400000
            };

            const resultado = CuentaCobroData.determinarEstadoYCartera(doc, fechaHoyRef);
            assert.strictEqual(resultado.estado, 'cobrada');
            assert.strictEqual(resultado.saldo, 0);
            assert.strictEqual(resultado.totalCobrado, 400000);
        });

        it('edge case: doc sin total o con total 0 debe ser manejado defensivamente', () => {
            const doc = {
                id: 6,
                numero: 106,
                fecha: '2026-11-01',
                forma_pago: 'Contado',
                total: null
            };

            const resultado = CuentaCobroData.determinarEstadoYCartera(doc, fechaHoyRef);
            assert.strictEqual(resultado.total, 0);
            assert.strictEqual(resultado.saldo, 0);
            assert.strictEqual(resultado.totalCobrado, 0);
        });

        it('debe respetar estado explícito "pendiente" en cuenta a Contado si no está saldada', () => {
            const doc = {
                id: 7,
                numero: 107,
                fecha: '2026-11-19',
                fecha_vencimiento: '2026-11-25',
                forma_pago: 'Contado',
                estado: 'pendiente',
                total: 350000
            };

            const resultado = CuentaCobroData.determinarEstadoYCartera(doc, fechaHoyRef);
            assert.strictEqual(resultado.estado, 'pendiente');
            assert.strictEqual(resultado.saldo, 350000);
            assert.strictEqual(resultado.totalCobrado, 0);
            assert.strictEqual(resultado.isPendiente, true);
        });

        it('debe marcar como "vencida" una cuenta a Contado con estado explícito "pendiente" si la fecha ya venció', () => {
            const doc = {
                id: 8,
                numero: 108,
                fecha: '2026-10-01',
                fecha_vencimiento: '2026-10-15',
                forma_pago: 'Contado',
                estado: 'pendiente',
                total: 200000
            };

            const resultado = CuentaCobroData.determinarEstadoYCartera(doc, fechaHoyRef);
            assert.strictEqual(resultado.estado, 'vencida');
            assert.strictEqual(resultado.saldo, 200000);
            assert.strictEqual(resultado.totalCobrado, 0);
            assert.strictEqual(resultado.isVencida, true);
        });
    });

    // =========================================================================
    // 2. CuentaCobroData.calcularKPIs
    // =========================================================================
    describe('CuentaCobroData.calcularKPIs', () => {
        const fechaHoyRef = new Date('2026-11-19T12:00:00');

        it('debe calcular correctamente las sumatorias de emitido, cobrado, pendiente, vencido y recuentos', () => {
            const cuentas = [
                // Contado -> cobrada
                { id: 1, numero: 1, fecha: '2026-11-01', fecha_vencimiento: '2026-11-01', forma_pago: 'Contado', total: 100000 },
                // Crédito vigente -> pendiente
                { id: 2, numero: 2, fecha: '2026-11-15', fecha_vencimiento: '2026-11-25', forma_pago: 'Crédito', total: 200000 },
                // Crédito vencido -> vencida
                { id: 3, numero: 3, fecha: '2026-10-01', fecha_vencimiento: '2026-10-20', forma_pago: 'Crédito', total: 300000 },
                // Anulada -> no suma a cartera activa
                { id: 4, numero: 4, fecha: '2026-11-05', fecha_vencimiento: '2026-11-10', forma_pago: 'Crédito', estado: 'anulada', total: 150000 }
            ];

            const kpis = CuentaCobroData.calcularKPIs(cuentas, fechaHoyRef);

            // Emitido activo: 100.000 + 200.000 + 300.000 = 600.000
            assert.strictEqual(kpis.totalEmitido, 600000);
            // Cobrado: 100.000
            assert.strictEqual(kpis.totalCobrado, 100000);
            // Pendiente total (incluye vencidas y vigentes): 200.000 + 300.000 = 500.000
            assert.strictEqual(kpis.totalPendiente, 500000);
            // Vencido: 300.000
            assert.strictEqual(kpis.totalVencido, 300000);

            // Recuentos
            assert.strictEqual(kpis.conteoTotal, 4);
            assert.strictEqual(kpis.conteoCobradas, 1);
            assert.strictEqual(kpis.conteoPendientes, 1);
            assert.strictEqual(kpis.conteoVencidas, 1);
            assert.strictEqual(kpis.conteoAnuladas, 1);
        });

        it('edge case: lista vacía debe retornar ceros en todos los KPIs sin lanzar error', () => {
            const kpis = CuentaCobroData.calcularKPIs([], fechaHoyRef);

            assert.strictEqual(kpis.totalEmitido, 0);
            assert.strictEqual(kpis.totalCobrado, 0);
            assert.strictEqual(kpis.totalPendiente, 0);
            assert.strictEqual(kpis.totalVencido, 0);
            assert.strictEqual(kpis.conteoTotal, 0);
            assert.strictEqual(kpis.conteoCobradas, 0);
            assert.strictEqual(kpis.conteoPendientes, 0);
            assert.strictEqual(kpis.conteoVencidas, 0);
            assert.strictEqual(kpis.conteoAnuladas, 0);
        });

        it('edge case: redondear centavos a 2 decimales para evitar problemas de precisión float', () => {
            const cuentas = [
                { id: 1, forma_pago: 'Contado', total: 10.555 },
                { id: 2, forma_pago: 'Contado', total: 20.444 }
            ];

            const kpis = CuentaCobroData.calcularKPIs(cuentas, fechaHoyRef);
            assert.strictEqual(kpis.totalEmitido, 31);
            assert.strictEqual(kpis.totalCobrado, 31);
        });
    });

    // =========================================================================
    // 3. CuentaCobroData.calcularTabCounts
    // =========================================================================
    describe('CuentaCobroData.calcularTabCounts', () => {
        const fechaHoyRef = new Date('2026-11-19T12:00:00');

        it('debe contar correctamente cada estado para los tabs', () => {
            const cuentas = [
                { id: 1, forma_pago: 'Contado', total: 100 },
                { id: 2, forma_pago: 'Contado', total: 200 },
                { id: 3, forma_pago: 'Crédito', fecha_vencimiento: '2026-11-30', total: 300 },
                { id: 4, forma_pago: 'Crédito', fecha_vencimiento: '2026-10-10', total: 400 },
                { id: 5, forma_pago: 'Crédito', fecha_vencimiento: '2026-10-15', total: 500 },
                { id: 6, estado: 'anulada', total: 600 }
            ];

            const counts = CuentaCobroData.calcularTabCounts(cuentas, fechaHoyRef);

            assert.strictEqual(counts.todas, 6);
            assert.strictEqual(counts.cobradas, 2);
            assert.strictEqual(counts.pendientes, 1);
            assert.strictEqual(counts.vencidas, 2);
            assert.strictEqual(counts.anuladas, 1);
        });

        it('edge case: lista vacía retorna counts en 0', () => {
            const counts = CuentaCobroData.calcularTabCounts([], fechaHoyRef);
            assert.deepStrictEqual(counts, {
                todas: 0,
                pendientes: 0,
                vencidas: 0,
                cobradas: 0,
                anuladas: 0
            });
        });
    });

    // =========================================================================
    // 4. CuentaCobroData.filtrarYPaginar
    // =========================================================================
    describe('CuentaCobroData.filtrarYPaginar', () => {
        const fechaHoyRef = new Date('2026-11-19T12:00:00');
        const dataset = [
            {
                id: 1,
                numero: 101,
                fecha: '2026-11-01',
                fecha_vencimiento: '2026-11-01',
                cliente_razon_social: 'Acme SAS',
                cliente_nit: '900123456-1',
                forma_pago: 'Contado',
                total: 500000,
                detalles: [{ nombre: 'Consultoría TI', sku: 'TI-01' }]
            },
            {
                id: 2,
                numero: 102,
                fecha: '2026-11-05',
                fecha_vencimiento: '2026-11-25',
                cliente_razon_social: 'Beta Logística Ltda',
                cliente_nit: '800654321-2',
                forma_pago: 'Crédito',
                total: 1200000,
                detalles: [{ nombre: 'Mantenimiento Preventivo', sku: 'MP-02' }]
            },
            {
                id: 3,
                numero: 103,
                fecha: '2026-10-10',
                fecha_vencimiento: '2026-10-25',
                cliente_razon_social: 'Gamma Distribuciones',
                cliente_nit: '901999888-3',
                forma_pago: 'Crédito',
                total: 800000,
                detalles: [{ nombre: 'Soporte Cloud', sku: 'CL-03' }]
            },
            {
                id: 4,
                numero: 104,
                fecha: '2026-11-10',
                fecha_vencimiento: '2026-11-10',
                cliente_razon_social: 'Delta Services',
                cliente_nit: '900111222-4',
                forma_pago: 'Crédito',
                estado: 'anulada',
                total: 300000,
                detalles: [{ nombre: 'Licencia Software', sku: 'LS-04' }]
            }
        ];

        it('debe filtrar por tab "cobradas"', () => {
            const resultado = CuentaCobroData.filtrarYPaginar(dataset, {
                selectedTab: 'cobradas',
                searchQuery: '',
                currentPage: 1,
                itemsPerPage: 10,
                fechaHoy: fechaHoyRef
            });

            assert.strictEqual(resultado.totalItems, 1);
            assert.strictEqual(resultado.items[0].numero, 101);
            assert.strictEqual(resultado.items[0].estado, 'cobrada');
        });

        it('debe filtrar por tab "vencidas"', () => {
            const resultado = CuentaCobroData.filtrarYPaginar(dataset, {
                selectedTab: 'vencidas',
                searchQuery: '',
                currentPage: 1,
                itemsPerPage: 10,
                fechaHoy: fechaHoyRef
            });

            assert.strictEqual(resultado.totalItems, 1);
            assert.strictEqual(resultado.items[0].numero, 103);
            assert.strictEqual(resultado.items[0].estado, 'vencida');
        });

        it('debe filtrar por tab "pendientes"', () => {
            const resultado = CuentaCobroData.filtrarYPaginar(dataset, {
                selectedTab: 'pendientes',
                searchQuery: '',
                currentPage: 1,
                itemsPerPage: 10,
                fechaHoy: fechaHoyRef
            });

            assert.strictEqual(resultado.totalItems, 1);
            assert.strictEqual(resultado.items[0].numero, 102);
            assert.strictEqual(resultado.items[0].estado, 'pendiente');
        });

        it('debe filtrar por búsqueda textual de cliente', () => {
            const resultado = CuentaCobroData.filtrarYPaginar(dataset, {
                selectedTab: 'todas',
                searchQuery: 'beta logística',
                currentPage: 1,
                itemsPerPage: 10,
                fechaHoy: fechaHoyRef
            });

            assert.strictEqual(resultado.totalItems, 1);
            assert.strictEqual(resultado.items[0].cliente_razon_social, 'Beta Logística Ltda');
        });

        it('debe filtrar por búsqueda textual de NIT', () => {
            const resultado = CuentaCobroData.filtrarYPaginar(dataset, {
                selectedTab: 'todas',
                searchQuery: '901999888',
                currentPage: 1,
                itemsPerPage: 10,
                fechaHoy: fechaHoyRef
            });

            assert.strictEqual(resultado.totalItems, 1);
            assert.strictEqual(resultado.items[0].numero, 103);
        });

        it('debe filtrar por búsqueda textual de número de cuenta', () => {
            const resultado = CuentaCobroData.filtrarYPaginar(dataset, {
                selectedTab: 'todas',
                searchQuery: '101',
                currentPage: 1,
                itemsPerPage: 10,
                fechaHoy: fechaHoyRef
            });

            assert.strictEqual(resultado.totalItems, 1);
            assert.strictEqual(resultado.items[0].numero, 101);
        });

        it('debe filtrar por búsqueda textual de ítems / SKU en detalles', () => {
            const resultado = CuentaCobroData.filtrarYPaginar(dataset, {
                selectedTab: 'todas',
                searchQuery: 'Soporte Cloud',
                currentPage: 1,
                itemsPerPage: 10,
                fechaHoy: fechaHoyRef
            });

            assert.strictEqual(resultado.totalItems, 1);
            assert.strictEqual(resultado.items[0].numero, 103);
        });

        it('debe paginar correctamente los resultados', () => {
            const itemsMuchos = Array.from({ length: 25 }, (_, i) => ({
                id: i + 1,
                numero: 200 + i,
                fecha: '2026-11-01',
                forma_pago: 'Contado',
                total: 1000
            }));

            const p1 = CuentaCobroData.filtrarYPaginar(itemsMuchos, {
                selectedTab: 'todas',
                currentPage: 1,
                itemsPerPage: 10,
                fechaHoy: fechaHoyRef
            });

            assert.strictEqual(p1.items.length, 10);
            assert.strictEqual(p1.totalItems, 25);
            assert.strictEqual(p1.totalPages, 3);
            assert.strictEqual(p1.currentPage, 1);

            const p3 = CuentaCobroData.filtrarYPaginar(itemsMuchos, {
                selectedTab: 'todas',
                currentPage: 3,
                itemsPerPage: 10,
                fechaHoy: fechaHoyRef
            });

            assert.strictEqual(p3.items.length, 5);
            assert.strictEqual(p3.currentPage, 3);
        });

        it('edge case: búsqueda sin coincidencias debe retornar lista vacía y totalPages 0', () => {
            const resultado = CuentaCobroData.filtrarYPaginar(dataset, {
                selectedTab: 'todas',
                searchQuery: 'inexistente_xyz_999',
                currentPage: 1,
                itemsPerPage: 10,
                fechaHoy: fechaHoyRef
            });

            assert.strictEqual(resultado.totalItems, 0);
            assert.strictEqual(resultado.items.length, 0);
            assert.strictEqual(resultado.totalPages, 0);
        });
    });

    // =========================================================================
    // 5. CuentaCobroTemplates formatters & helpers
    // =========================================================================
    describe('CuentaCobroTemplates & Formatters', () => {
        it('formatMoney debe formatear montos en pesos colombianos de forma consistente', () => {
            assert.strictEqual(CuentaCobroTemplates.formatMoney(0), '$ 0');
            assert.strictEqual(CuentaCobroTemplates.formatMoney(1500000), '$ 1.500.000');
            assert.strictEqual(CuentaCobroTemplates.formatMoney('2500.50'), '$ 2.500,5');
            assert.strictEqual(CuentaCobroTemplates.formatMoney(null), '$ 0');
            assert.strictEqual(CuentaCobroTemplates.formatMoney(undefined), '$ 0');
        });

        it('formatFecha debe formatear YYYY-MM-DD a DD/MM/YYYY y tolerar valores nulos o ISO', () => {
            assert.strictEqual(CuentaCobroTemplates.formatFecha('2026-11-19'), '19/11/2026');
            assert.strictEqual(CuentaCobroTemplates.formatFecha('2026-11-19T14:30:00Z'), '19/11/2026');
            assert.strictEqual(CuentaCobroTemplates.formatFecha(null), '---');
            assert.strictEqual(CuentaCobroTemplates.formatFecha(undefined), '---');
            assert.strictEqual(CuentaCobroTemplates.formatFecha(''), '---');
            assert.strictEqual(CuentaCobroTemplates.formatFecha('---'), '---');
        });

        it('getClientAvatar debe generar iniciales y color determinista', () => {
            const av1 = CuentaCobroTemplates.getClientAvatar('Acme Soluciones SAS');
            assert.strictEqual(av1.initials, 'AS');
            assert.ok(av1.bg, 'debe tener background color');
            assert.ok(av1.color, 'debe tener text color');

            const av2 = CuentaCobroTemplates.getClientAvatar('Bancolombia');
            assert.strictEqual(av2.initials, 'B');

            const avVacio = CuentaCobroTemplates.getClientAvatar(null);
            assert.strictEqual(avVacio.initials, '?');

            const avSinCliente = CuentaCobroTemplates.getClientAvatar('Sin cliente');
            assert.strictEqual(avSinCliente.initials, '?');
        });

        it('escapeHtml debe escapar caracteres peligrosos contra inyecciones XSS', () => {
            assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
            assert.strictEqual(escapeHtml('Tom & Jerry "Special" \'Edition\''), 'Tom &amp; Jerry &quot;Special&quot; &#39;Edition&#39;');
            assert.strictEqual(escapeHtml(null), '');
            assert.strictEqual(escapeHtml(undefined), '');
            assert.strictEqual(escapeHtml(''), '');
        });

        it('CuentaCobroTemplates.escapeHtml debe delegar o funcionar idéntico a escapeHtml', () => {
            assert.strictEqual(CuentaCobroTemplates.escapeHtml('<b>Prueba</b>'), '&lt;b&gt;Prueba&lt;/b&gt;');
        });

        it('getEstadoBadge debe renderizar los badges adecuados según el estado', () => {
            const badgeCobrada = CuentaCobroTemplates.getEstadoBadge({ estado: 'cobrada' });
            assert.ok(badgeCobrada.includes('bg-success-subtle'));
            assert.ok(badgeCobrada.includes('Cobrada'));

            const badgePendiente = CuentaCobroTemplates.getEstadoBadge({ estado: 'pendiente' });
            assert.ok(badgePendiente.includes('bg-warning-subtle'));
            assert.ok(badgePendiente.includes('Pendiente'));

            const badgeVencida = CuentaCobroTemplates.getEstadoBadge({ estado: 'vencida', diasVencida: 15 });
            assert.ok(badgeVencida.includes('bg-danger-subtle'));
            assert.ok(badgeVencida.includes('15 d'));

            const badgeAnulada = CuentaCobroTemplates.getEstadoBadge({ estado: 'anulada' });
            assert.ok(badgeAnulada.includes('bg-secondary-subtle'));
            assert.ok(badgeAnulada.includes('Anulada'));

            assert.strictEqual(CuentaCobroTemplates.getEstadoBadge(null), '');
        });

        it('renderLayout debe generar el HTML completo del dashboard con KPIs y controles', () => {
            const fakeCtx = {
                state: {
                    cuentas: [
                        { id: 1, forma_pago: 'Contado', total: 100000 },
                        { id: 2, forma_pago: 'Crédito', fecha_vencimiento: '2026-10-01', total: 50000 }
                    ],
                    cuentasFiltradas: [],
                    selectedTab: 'todas',
                    searchQuery: 'test',
                    kpis: {
                        totalEmitido: 150000,
                        totalCobrado: 100000,
                        totalPendiente: 50000,
                        totalVencido: 50000,
                        conteoTotal: 2,
                        conteoCobradas: 1,
                        conteoPendientes: 0,
                        conteoVencidas: 1,
                        conteoAnuladas: 0
                    }
                },
                formatMoney: CuentaCobroTemplates.formatMoney,
                formatFecha: CuentaCobroTemplates.formatFecha,
                getClientAvatar: CuentaCobroTemplates.getClientAvatar,
                getEstadoBadge: CuentaCobroTemplates.getEstadoBadge,
                renderGrid: () => '<div id="grid-mock"></div>',
                calcularTabCounts: CuentaCobroData.calcularTabCounts
            };

            const html = CuentaCobroTemplates.renderLayout.call(fakeCtx);
            assert.ok(html.includes('Cuentas de Cobro'));
            assert.ok(html.includes('$ 150.000'));
            assert.ok(html.includes('payment-segmented-control'));
            assert.ok(html.includes('search-cc'));
        });

        it('renderGrid debe renderizar tabla con filas o estado vacío', () => {
            const fakeCtxVacio = {
                state: { cuentasFiltradas: [], totalItems: 0, currentPage: 1, totalPages: 0 }
            };
            const htmlVacio = CuentaCobroTemplates.renderGrid.call(fakeCtxVacio);
            assert.ok(htmlVacio.includes('No se encontraron cuentas de cobro'));

            const fakeCtxLleno = {
                state: {
                    cuentasFiltradas: [
                        {
                            id: 1,
                            numero: 101,
                            fecha: '2026-11-01',
                            fecha_vencimiento: '2026-11-15',
                            cliente_razon_social: 'Cliente Test',
                            cliente_nit: '12345678',
                            forma_pago: 'Contado',
                            total: 50000,
                            saldo: 0,
                            estado: 'cobrada'
                        }
                    ],
                    totalItems: 1,
                    currentPage: 1,
                    totalPages: 1
                },
                getClientAvatar: CuentaCobroTemplates.getClientAvatar,
                getEstadoBadge: CuentaCobroTemplates.getEstadoBadge,
                formatMoney: CuentaCobroTemplates.formatMoney,
                formatFecha: CuentaCobroTemplates.formatFecha
            };
            const htmlLleno = CuentaCobroTemplates.renderGrid.call(fakeCtxLleno);
            assert.ok(htmlLleno.includes('No. 101'));
            assert.ok(htmlLleno.includes('Cliente Test'));
        });

        it('renderDrawerContent debe renderizar el comprobante detallado con ítems', () => {
            const doc = {
                id: 1,
                numero: 205,
                fecha: '2026-11-10',
                fecha_vencimiento: '2026-11-20',
                cliente_razon_social: 'Empresa Alpha',
                cliente_nit: '900999888',
                cliente_telefono: '3001234567',
                cliente_email: 'alpha@test.com',
                forma_pago: 'Crédito',
                subtotal: 100000,
                impuestos: 19000,
                total: 119000,
                saldo: 119000,
                estado: 'pendiente',
                detalles: [
                    { nombre: 'Servicio Contable', cantidad: 1, precio_unitario: 100000, total: 100000 }
                ]
            };

            const html = CuentaCobroTemplates.renderDrawerContent(doc);
            assert.ok(html.includes('Cuenta de Cobro No. 205'));
            assert.ok(html.includes('Empresa Alpha'));
            assert.ok(html.includes('Servicio Contable'));
            assert.ok(html.includes('$ 119.000'));

            assert.ok(CuentaCobroTemplates.renderDrawerContent(null).includes('No se pudo cargar'));
        });
    });

    // =========================================================================
    // 6. CuentaCobroData client injection & state methods
    // =========================================================================
    describe('CuentaCobroData State & Client Methods', () => {
        it('setSupabase y getSupabase deben almacenar y retornar el cliente inyectado', () => {
            const fakeClient = { from: () => {} };
            CuentaCobroData.setSupabase(fakeClient);
            assert.strictEqual(CuentaCobroData.getSupabase(), fakeClient);
            CuentaCobroData.setSupabase(null);
        });

        it('aplicarFiltros debe actualizar cuentasFiltradas y paginación en el estado ligado', () => {
            const fakeModule = {
                state: {
                    cuentas: [
                        { id: 1, numero: 1, forma_pago: 'Contado', total: 100 },
                        { id: 2, numero: 2, forma_pago: 'Crédito', total: 200 }
                    ],
                    selectedTab: 'cobradas',
                    searchQuery: '',
                    currentPage: 1,
                    itemsPerPage: 10,
                    cuentasFiltradas: [],
                    totalItems: 0,
                    totalPages: 0
                },
                filtrarYPaginar: CuentaCobroData.filtrarYPaginar,
                determinarEstadoYCartera: CuentaCobroData.determinarEstadoYCartera
            };

            CuentaCobroData.aplicarFiltros.call(fakeModule);
            assert.strictEqual(fakeModule.state.totalItems, 1);
            assert.strictEqual(fakeModule.state.cuentasFiltradas[0].numero, 1);
        });

        it('cargarCuentasCobro debe consultar Supabase y popular el estado', async () => {
            const fakeData = [
                { id: 10, numero: 501, forma_pago: 'Contado', total: 350000 },
                { id: 11, numero: 502, forma_pago: 'Crédito', fecha_vencimiento: '2026-12-01', total: 600000 }
            ];

            const mockSb = {
                from: (table) => {
                    assert.strictEqual(table, 'cuentas_cobro');
                    return {
                        select: () => ({
                            order: () => Promise.resolve({ data: fakeData, error: null })
                        })
                    };
                }
            };

            const fakeModule = {
                state: {
                    cuentas: [],
                    cuentasFiltradas: [],
                    kpis: {},
                    selectedTab: 'todas',
                    searchQuery: '',
                    currentPage: 1,
                    itemsPerPage: 10,
                    isLoading: false
                },
                getSupabase: () => mockSb,
                determinarEstadoYCartera: CuentaCobroData.determinarEstadoYCartera,
                calcularKPIs: CuentaCobroData.calcularKPIs,
                filtrarYPaginar: CuentaCobroData.filtrarYPaginar,
                aplicarFiltros: CuentaCobroData.aplicarFiltros
            };

            const result = await CuentaCobroData.cargarCuentasCobro.call(fakeModule);
            assert.strictEqual(result.length, 2);
            assert.strictEqual(fakeModule.state.cuentas.length, 2);
            assert.strictEqual(fakeModule.state.kpis.totalEmitido, 950000);
            assert.strictEqual(fakeModule.state.isLoading, false);
        });

        it('anularCuentaCobro debe enviar update con estado anulada', async () => {
            let updatePayload = null;
            let filterId = null;

            const mockSb = {
                from: (table) => {
                    assert.strictEqual(table, 'cuentas_cobro');
                    return {
                        update: (payload) => {
                            updatePayload = payload;
                            return {
                                eq: (col, val) => {
                                    assert.strictEqual(col, 'id');
                                    filterId = val;
                                    return Promise.resolve({ error: null });
                                }
                            };
                        }
                    };
                }
            };

            CuentaCobroData.setSupabase(mockSb);
            const res = await CuentaCobroData.anularCuentaCobro(99);
            assert.strictEqual(res, true);
            assert.deepStrictEqual(updatePayload, { estado: 'anulada' });
            assert.strictEqual(filterId, 99);
            CuentaCobroData.setSupabase(null);
        });

        it('marcarCobradaCuentaCobro debe enviar update con estado cobrada', async () => {
            let updatePayload = null;
            let filterId = null;

            const mockSb = {
                from: (table) => {
                    assert.strictEqual(table, 'cuentas_cobro');
                    return {
                        update: (payload) => {
                            updatePayload = payload;
                            return {
                                eq: (col, val) => {
                                    assert.strictEqual(col, 'id');
                                    filterId = val;
                                    return Promise.resolve({ error: null });
                                }
                            };
                        }
                    };
                }
            };

            CuentaCobroData.setSupabase(mockSb);
            const res = await CuentaCobroData.marcarCobradaCuentaCobro(88);
            assert.strictEqual(res, true);
            assert.deepStrictEqual(updatePayload, { estado: 'cobrada' });
            assert.strictEqual(filterId, 88);
            CuentaCobroData.setSupabase(null);
        });

        it('eliminarCuentaCobro debe enviar delete al registro correspondiente', async () => {
            let deletedId = null;

            const mockSb = {
                from: (table) => {
                    assert.strictEqual(table, 'cuentas_cobro');
                    return {
                        delete: () => ({
                            eq: (col, val) => {
                                assert.strictEqual(col, 'id');
                                deletedId = val;
                                return Promise.resolve({ error: null });
                            }
                        })
                    };
                }
            };

            CuentaCobroData.setSupabase(mockSb);
            const res = await CuentaCobroData.eliminarCuentaCobro(77);
            assert.strictEqual(res, true);
            assert.strictEqual(deletedId, 77);
            CuentaCobroData.setSupabase(null);
        });

        it('cargarDetalleCuentaCobro debe retornar el registro decorado', async () => {
            const rawDoc = { id: 55, numero: 88, forma_pago: 'Contado', total: 120000 };

            const mockSb = {
                from: (table) => ({
                    select: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({ data: rawDoc, error: null })
                        })
                    })
                })
            };

            CuentaCobroData.setSupabase(mockSb);
            const doc = await CuentaCobroData.cargarDetalleCuentaCobro(55);
            assert.strictEqual(doc.id, 55);
            assert.strictEqual(doc.estado, 'cobrada');
            assert.strictEqual(doc.saldo, 0);
            CuentaCobroData.setSupabase(null);
        });
    });
});
