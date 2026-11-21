import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ContactosTemplates, getClientAvatar } from '../js/modules/clientes/clientes.templates.js';
import { ContactosModule } from '../js/modules/clientes/clientes.js';

describe('Módulo Clientes & Contactos 360° - TDD Test Suite', () => {

    // =========================================================================
    // 1. Helpers & Formatters
    // =========================================================================
    describe('getClientAvatar', () => {
        it('debe generar iniciales mayúsculas y color determinista para un nombre completo', () => {
            const avatar = getClientAvatar('Mercado Libre');
            assert.strictEqual(avatar.initials, 'ML');
            assert.ok(avatar.bg, 'Debe incluir un color de fondo');
            assert.ok(avatar.color, 'Debe incluir un color de texto');
        });

        it('debe manejar nombres de una sola palabra', () => {
            const avatar = getClientAvatar('Bancolombia');
            assert.strictEqual(avatar.initials, 'B');
        });

        it('debe manejar valores nulos o vacíos con fallback seguro', () => {
            const avNulo = getClientAvatar(null);
            assert.strictEqual(avNulo.initials, '?');

            const avVacio = getClientAvatar('');
            assert.strictEqual(avVacio.initials, '?');

            const avSinCliente = getClientAvatar('Sin cliente');
            assert.strictEqual(avSinCliente.initials, '?');
        });

        it('debe ser determinista (mismo nombre = mismos colores e iniciales)', () => {
            const a1 = getClientAvatar('Juan David Ramirez');
            const a2 = getClientAvatar('Juan David Ramirez');
            assert.deepStrictEqual(a1, a2);
        });
    });

    describe('ContactosTemplates formatters', () => {
        it('formatMoney debe formatear montos en pesos colombianos ($ ...)', () => {
            assert.strictEqual(ContactosTemplates.formatMoney(13048455), '$ 13.048.455');
            assert.strictEqual(ContactosTemplates.formatMoney(0), '$ 0');
            assert.strictEqual(ContactosTemplates.formatMoney(null), '$ 0');
        });

        it('formatFecha debe formatear fechas YYYY-MM-DD a DD/MM/YYYY', () => {
            assert.strictEqual(ContactosTemplates.formatFecha('2026-11-19'), '19/11/2026');
            assert.strictEqual(ContactosTemplates.formatFecha('2026-11-19T14:30:00Z'), '19/11/2026');
            assert.strictEqual(ContactosTemplates.formatFecha(null), '---');
        });

        it('getMoraBadge debe asignar la etiqueta semántica correcta según días y saldo', () => {
            // Saldo 0 -> Al día
            const bAlDia = ContactosTemplates.getMoraBadge(45, 0);
            assert.ok(bAlDia.includes('Al día'));
            assert.ok(bAlDia.includes('text-success'));

            // Saldo > 0 pero días <= 0 -> Vigente
            const bVigente = ContactosTemplates.getMoraBadge(-5, 500000);
            assert.ok(bVigente.includes('Vigente'));
            assert.ok(bVigente.includes('text-primary'));

            // Saldo > 0 con mora 1-30 días -> Mora warning
            const bMoraLeve = ContactosTemplates.getMoraBadge(15, 200000);
            assert.ok(bMoraLeve.includes('Mora 15d'));
            assert.ok(bMoraLeve.includes('text-warning-emphasis'));

            // Saldo > 0 con mora > 30 días -> Mora crítica
            const bMoraCritica = ContactosTemplates.getMoraBadge(45, 1000000);
            assert.ok(bMoraCritica.includes('Mora 45d'));
            assert.ok(bMoraCritica.includes('text-danger'));
        });
    });

    // =========================================================================
    // 2. Renderizado de Componentes
    // =========================================================================
    describe('ContactosTemplates.renderLayout', () => {
        it('debe inyectar la estructura ergonómica con Top Bar, 4 KPI cards, tabs y drawer', () => {
            const fakeElement = { innerHTML: '' };
            const fakeCtx = {
                element: fakeElement,
                state: {
                    view: 'lista',
                    currentFilter: 'todos',
                    searchQuery: '',
                    sortColumn: 'saldo_cartera',
                    sortDirection: 'desc'
                }
            };

            ContactosTemplates.renderLayout.call(fakeCtx);
            const html = fakeElement.innerHTML;

            // Top Bar
            assert.ok(html.includes('Gestión de Contactos'));
            assert.ok(html.includes('Directorio & Cartera 360°'));
            assert.ok(html.includes('btn-view-lista'));
            assert.ok(html.includes('btn-view-grafico'));
            assert.ok(html.includes('btn-export-excel'));
            assert.ok(html.includes('btn-nuevo-contacto'));

            // 4 KPI Cards
            assert.ok(html.includes('Cartera Total Clientes'));
            assert.ok(html.includes('Facturación del Mes'));
            assert.ok(html.includes('Mora Crítica (>30 días)'));
            assert.ok(html.includes('Clientes Activos (60d)'));

            // Segmented Tabs Bar
            assert.ok(html.includes('data-filter="todos"'));
            assert.ok(html.includes('data-filter="con_cartera"'));
            assert.ok(html.includes('data-filter="mora_critica"'));
            assert.ok(html.includes('data-filter="vip"'));
            assert.ok(html.includes('data-filter="inactivos"'));
            assert.ok(html.includes('data-filter="proveedor"'));

            // Slide-over Drawer
            assert.ok(html.includes('cliente-drawer-backdrop'));
            assert.ok(html.includes('cliente-drawer'));
        });
    });

    describe('ContactosTemplates.renderGrid', () => {
        it('debe renderizar estado vacío amigable cuando rows está vacío', () => {
            const tbodyFake = { innerHTML: '' };
            const fakeElement = {
                querySelector: (sel) => {
                    if (sel === '#tbody-contactos') return tbodyFake;
                    return null;
                }
            };
            const fakeCtx = {
                element: fakeElement,
                state: { currentPage: 1, itemsPerPage: 25 },
                bindFilaEvents: () => {}
            };

            ContactosTemplates.renderGrid.call(fakeCtx, [], 0);
            assert.ok(tbodyFake.innerHTML.includes('No se encontraron contactos'));
        });

        it('debe renderizar filas enriquecidas con avatar hash, LTV, cartera y semáforo de mora', () => {
            const tbodyFake = { innerHTML: '' };
            const fakeElement = {
                querySelector: (sel) => {
                    if (sel === '#tbody-contactos') return tbodyFake;
                    return null;
                }
            };
            const fakeCtx = {
                element: fakeElement,
                state: { currentPage: 1, itemsPerPage: 25 },
                formatMoney: ContactosTemplates.formatMoney,
                getMoraBadge: ContactosTemplates.getMoraBadge,
                bindFilaEvents: () => {}
            };

            const mockRows = [
                {
                    id: 698,
                    nombre: 'Mercado Libre Colombia',
                    nit: '830067394',
                    telefono: '3001234567',
                    ciudad: 'Bogotá',
                    es_cliente: true,
                    es_proveedor: false,
                    ventas_totales_ltv: 110853296,
                    total_facturas: 125,
                    saldo_cartera: 7509903,
                    facturas_pendientes: 3,
                    max_dias_mora: -36,
                    cupo_credito: 20000000
                }
            ];

            ContactosTemplates.renderGrid.call(fakeCtx, mockRows, 1);
            const html = tbodyFake.innerHTML;

            assert.ok(html.includes('Mercado Libre Colombia'));
            assert.ok(html.includes('830067394'));
            assert.ok(html.includes('Bogotá'));
            assert.ok(html.includes('$ 110.853.296'));
            assert.ok(html.includes('$ 7.509.903'));
            assert.ok(html.includes('btn-ver-drawer'));
            assert.ok(html.includes('btn-wpp-cliente'));
            assert.ok(html.includes('btn-menu-cliente') || html.includes('btn-editar'));
        });
    });

    describe('ContactosTemplates.renderDrawerContent', () => {
        it('debe renderizar el panel 360° con scorecard, facturas pendientes y botones de abono', () => {
            const fakeCtx = {
                formatMoney: ContactosTemplates.formatMoney,
                formatFecha: ContactosTemplates.formatFecha,
                getMoraBadge: ContactosTemplates.getMoraBadge
            };

            const mockData = {
                contacto: {
                    id: 274,
                    nombre: 'Juan Pablo Ortega',
                    nit: '74282469',
                    telefono: '3006603099',
                    ciudad: 'Bogota',
                    direccion: 'Centro Comercial Panama',
                    cupo_credito: 5000000,
                    plazos_pago: 30,
                    es_cliente: true
                },
                facturasPendientes: [
                    { id: 101, numero: 5012, fecha: '2026-10-15', vencimiento: '2026-10-15', total: 600000, saldo: 600000, diasMora: 34 }
                ],
                totalSaldoPendiente: 600000,
                maxDiasMora: 34,
                historialFacturas: [],
                historialPagos: [
                    { id: 1, numero_recibo: 108, fecha: '2026-10-10', metodo_pago: 'Transferencia', monto: 300000 }
                ]
            };

            const html = ContactosTemplates.renderDrawerContent.call(fakeCtx, mockData);

            // Identidad & Scorecard
            assert.ok(html.includes('Juan Pablo Ortega'));
            assert.ok(html.includes('74282469'));
            assert.ok(html.includes('$ 600.000'));
            assert.ok(html.includes('34 días'));

            // Pestañas
            assert.ok(html.includes('Facturas Pendientes (1)'));
            assert.ok(html.includes('Recibos de Caja (1)'));
            assert.ok(html.includes('btn-abonar-factura-drawer'));
            assert.ok(html.includes('5012'));
        });
    });

    // =========================================================================
    // 3. ContactosModule State & Initializers
    // =========================================================================
    describe('ContactosModule', () => {
        it('debe exponer el estado inicial correcto y métodos orquestadores', () => {
            assert.strictEqual(ContactosModule.state.currentPage, 1);
            assert.strictEqual(ContactosModule.state.itemsPerPage, 25);
            assert.strictEqual(ContactosModule.state.currentFilter, 'todos');
            assert.strictEqual(ContactosModule.state.view, 'lista');
            assert.strictEqual(typeof ContactosModule.init, 'function');
            assert.strictEqual(typeof ContactosModule.mostrarDrawer, 'function');
            assert.strictEqual(typeof ContactosModule.cerrarDrawer, 'function');
            assert.strictEqual(typeof ContactosModule.cargarPagina, 'function');
        });
    });
});
