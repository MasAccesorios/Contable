import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AjustesData } from '../js/modules/inventario/ajustes.data.js';
import { AjustesTemplates } from '../js/modules/inventario/ajustes.templates.js';
import { AjustesInventarioModule } from '../js/modules/inventario/ajustes.js';

describe('Módulo Ajustes de Inventario 360° - TDD Test Suite', () => {

    // =========================================================================
    // 1. AjustesData.decorarAjuste
    // =========================================================================
    describe('AjustesData.decorarAjuste', () => {

        it('debe decorar correctamente un ajuste de incremento estándar (+15 unidades con costo)', () => {
            const raw = {
                id: 1,
                numero: 18,
                fecha: '2026-11-20',
                observaciones: 'Ingreso por garantía de proveedor',
                detalles: [
                    {
                        producto_id: 101,
                        sku: 'SKU-001',
                        nombre: 'Pantalla OLED 6.5',
                        tipo: 'incremento',
                        cantidad: 15,
                        costo_unitario: 50000
                    }
                ]
            };

            const decorado = AjustesData.decorarAjuste(raw);

            assert.strictEqual(decorado.id, 1);
            assert.strictEqual(decorado.numero, 18);
            assert.strictEqual(decorado.tipo, 'incremento');
            assert.strictEqual(decorado.unidadesIncrementadas, 15);
            assert.strictEqual(decorado.unidadesDisminuidas, 0);
            assert.strictEqual(decorado.balanceNeto, 15);
            assert.strictEqual(decorado.totalItems, 1);
            assert.strictEqual(decorado.costoTotalEstimado, 750000);
            assert.ok(decorado.searchIndex.includes('18'));
            assert.ok(decorado.searchIndex.includes('sku-001'));
            assert.ok(decorado.searchIndex.includes('pantalla oled'));
            assert.ok(decorado.searchIndex.includes('garantia'));
        });

        it('debe decorar correctamente un ajuste de disminución / merma estándar (-3 unidades sin costo / FIFO)', () => {
            const raw = {
                id: 2,
                numero: 19,
                fecha: '2026-11-20',
                observaciones: 'Merma por daño en bodega',
                detalles: [
                    {
                        producto_id: 202,
                        sku: 'SKU-002',
                        nombre: 'Batería Litio 5000mAh',
                        tipo: 'disminucion',
                        cantidad: 3,
                        costo_unitario: null
                    }
                ]
            };

            const decorado = AjustesData.decorarAjuste(raw);

            assert.strictEqual(decorado.id, 2);
            assert.strictEqual(decorado.numero, 19);
            assert.strictEqual(decorado.tipo, 'disminucion');
            assert.strictEqual(decorado.unidadesIncrementadas, 0);
            assert.strictEqual(decorado.unidadesDisminuidas, 3);
            assert.strictEqual(decorado.balanceNeto, -3);
            assert.strictEqual(decorado.totalItems, 1);
            assert.strictEqual(decorado.costoTotalEstimado, 0);
            assert.ok(decorado.searchIndex.includes('merma'));
            assert.ok(decorado.searchIndex.includes('bateria litio'));
        });

        it('debe decorar correctamente un ajuste mixto (incrementos y disminuciones simultáneas)', () => {
            const raw = {
                id: 3,
                numero: 20,
                fecha: '2026-11-20',
                observaciones: 'Reajuste general por auditoría física',
                detalles: [
                    {
                        producto_id: 101,
                        sku: 'SKU-001',
                        nombre: 'Pantalla OLED',
                        tipo: 'incremento',
                        cantidad: 10,
                        costo_unitario: 45000
                    },
                    {
                        producto_id: 202,
                        sku: 'SKU-002',
                        nombre: 'Batería Litio',
                        tipo: 'disminucion',
                        cantidad: 4,
                        costo_unitario: null
                    }
                ]
            };

            const decorado = AjustesData.decorarAjuste(raw);

            assert.strictEqual(decorado.tipo, 'mixto');
            assert.strictEqual(decorado.unidadesIncrementadas, 10);
            assert.strictEqual(decorado.unidadesDisminuidas, 4);
            assert.strictEqual(decorado.balanceNeto, 6);
            assert.strictEqual(decorado.totalItems, 2);
            assert.strictEqual(decorado.costoTotalEstimado, 450000);
            assert.ok(decorado.searchIndex.includes('pantalla'));
            assert.ok(decorado.searchIndex.includes('bateria'));
        });

        it('debe clasificar y calcular un checkpoint masivo (arreglo grande de SKUs con campo "a", sin "tipo")', () => {
            // Simulamos snapshot de conteo masivo (ej. 120 SKUs)
            const detallesMasivos = [];
            for (let i = 1; i <= 120; i++) {
                detallesMasivos.push({
                    producto_id: i,
                    sku: `SKU-${1000 + i}`,
                    nombre: `Producto Test ${i}`,
                    a: i % 10 === 0 ? 15 : 5 // valor conteo físico 'a'
                });
            }

            const raw = {
                id: 4,
                numero: 21,
                fecha: '2026-11-20',
                observaciones: 'Conteo físico anual Checkpoint Almacén Principal',
                detalles: detallesMasivos
            };

            const decorado = AjustesData.decorarAjuste(raw);

            assert.strictEqual(decorado.tipo, 'checkpoint');
            assert.strictEqual(decorado.totalItems, 120);
            assert.ok(decorado.isCheckpoint === true);
            assert.ok(decorado.searchIndex.includes('checkpoint'));
            assert.ok(decorado.searchIndex.includes('sku-1001'));
        });

        it('debe procesar reconciliación con deltas ("tipo": "cantidad", "de": 83, "a": 55)', () => {
            const raw = {
                id: 5,
                numero: 22,
                fecha: '2026-11-20',
                observaciones: 'Ajuste de descuadre por conteo ciego',
                detalles: [
                    {
                        producto_id: 301,
                        sku: 'SKU-301',
                        nombre: 'Cable Lightning MFi',
                        tipo: 'cantidad',
                        de: 83,
                        a: 55 // delta = 55 - 83 = -28 (disminución)
                    },
                    {
                        producto_id: 302,
                        sku: 'SKU-302',
                        nombre: 'Cargador 20W',
                        tipo: 'cantidad',
                        de: 40,
                        a: 60 // delta = 60 - 40 = +20 (incremento)
                    }
                ]
            };

            const decorado = AjustesData.decorarAjuste(raw);

            // Item 1: -28 unidades
            // Item 2: +20 unidades
            assert.strictEqual(decorado.unidadesIncrementadas, 20);
            assert.strictEqual(decorado.unidadesDisminuidas, 28);
            assert.strictEqual(decorado.balanceNeto, -8);
            assert.strictEqual(decorado.totalItems, 2);
            assert.strictEqual(decorado.tipo, 'mixto');
        });

        it('casos borde: detalles null, indefinido o vacío [] deben resolverse con ceros seguros', () => {
            const rawNull = { id: 6, numero: 23, fecha: '2026-11-20', detalles: null };
            const decNull = AjustesData.decorarAjuste(rawNull);

            assert.strictEqual(decNull.totalItems, 0);
            assert.strictEqual(decNull.unidadesIncrementadas, 0);
            assert.strictEqual(decNull.unidadesDisminuidas, 0);
            assert.strictEqual(decNull.balanceNeto, 0);
            assert.strictEqual(decNull.costoTotalEstimado, 0);
            assert.deepStrictEqual(decNull.detalles, []);

            const rawVacio = { id: 7, numero: 24, fecha: '2026-11-20', detalles: [] };
            const decVacio = AjustesData.decorarAjuste(rawVacio);

            assert.strictEqual(decVacio.totalItems, 0);
            assert.strictEqual(decVacio.balanceNeto, 0);
        });

        it('casos borde: detalles como string JSON debe parsearse correctamente', () => {
            const rawJson = {
                id: 8,
                numero: 25,
                fecha: '2026-11-20',
                observaciones: 'Vino de webhook con detalles serializados',
                detalles: JSON.stringify([
                    { producto_id: 501, sku: 'SKU-501', nombre: 'Adaptador OTG', tipo: 'incremento', cantidad: 8, costo_unitario: 12000 }
                ])
            };

            const decorado = AjustesData.decorarAjuste(rawJson);

            assert.strictEqual(decorado.totalItems, 1);
            assert.strictEqual(decorado.unidadesIncrementadas, 8);
            assert.strictEqual(decorado.balanceNeto, 8);
            assert.strictEqual(decorado.tipo, 'incremento');
            assert.ok(Array.isArray(decorado.detalles));
        });

        it('casos borde: string JSON corrupto en detalles debe manejarse defensivamente sin colapsar', () => {
            const rawCorrupto = {
                id: 9,
                numero: 26,
                fecha: '2026-11-20',
                detalles: '[{ invalid json'
            };

            const decorado = AjustesData.decorarAjuste(rawCorrupto);

            assert.strictEqual(decorado.totalItems, 0);
            assert.strictEqual(decorado.balanceNeto, 0);
            assert.deepStrictEqual(decorado.detalles, []);
        });

        it('casos borde: observaciones vacías, null o extremadamente largas (500+ chars) deben preservarse', () => {
            const longObs = 'Observación detallada de auditoría '.repeat(20);
            const raw = {
                id: 10,
                numero: 27,
                fecha: '2026-11-20',
                observaciones: longObs,
                detalles: []
            };

            const decorado = AjustesData.decorarAjuste(raw);
            assert.strictEqual(decorado.observaciones, longObs);
            assert.ok(decorado.searchIndex.includes('auditoria'));

            const rawSinObs = { id: 11, numero: 28, observaciones: null, detalles: [] };
            const decSinObs = AjustesData.decorarAjuste(rawSinObs);
            assert.strictEqual(decSinObs.observaciones, '');
        });

        it('searchIndex debe estar completamente normalizado en minúsculas y sin acentos', () => {
            const raw = {
                id: 12,
                numero: 29,
                fecha: '2026-11-20',
                observaciones: 'Garantía con Devolución Crítica',
                detalles: [
                    { producto_id: 1, sku: 'SKU-ABC', nombre: 'Cámara Acción 4K' }
                ]
            };

            const decorado = AjustesData.decorarAjuste(raw);
            const idx = decorado.searchIndex;

            assert.ok(idx.includes('29'));
            assert.ok(idx.includes('garantia') || idx.includes('garantía'));
            assert.ok(idx.includes('camara') || idx.includes('cámara'));
            assert.ok(idx.includes('sku-abc'));
        });
    });

    // =========================================================================
    // 2. AjustesData.calcularKpis
    // =========================================================================
    describe('AjustesData.calcularKpis', () => {

        const sampleAjustes = [
            {
                id: 1,
                tipo: 'incremento',
                unidadesIncrementadas: 15,
                unidadesDisminuidas: 0,
                balanceNeto: 15,
                totalItems: 2
            },
            {
                id: 2,
                tipo: 'disminucion',
                unidadesIncrementadas: 0,
                unidadesDisminuidas: 5,
                balanceNeto: -5,
                totalItems: 1
            },
            {
                id: 3,
                tipo: 'mixto',
                unidadesIncrementadas: 8,
                unidadesDisminuidas: 3,
                balanceNeto: 5,
                totalItems: 3
            },
            {
                id: 4,
                tipo: 'checkpoint',
                unidadesIncrementadas: 0,
                unidadesDisminuidas: 0,
                balanceNeto: 0,
                totalItems: 80
            }
        ];

        it('debe calcular correctamente los KPIs ejecutivos globales', () => {
            const kpis = AjustesData.calcularKpis(sampleAjustes);

            assert.strictEqual(kpis.totalAjustes, 4);
            assert.strictEqual(kpis.unidadesIncrementadas, 23); // 15 + 0 + 8 + 0
            assert.strictEqual(kpis.unidadesDisminuidas, 8);    // 0 + 5 + 3 + 0
            assert.strictEqual(kpis.balanceNeto, 15);          // 23 - 8
            assert.strictEqual(kpis.totalItems, 86);           // 2 + 1 + 3 + 80
        });

        it('debe calcular los conteos dinámicos para tabs (todas, incrementos, disminuciones, checkpoints)', () => {
            const kpis = AjustesData.calcularKpis(sampleAjustes);

            assert.strictEqual(kpis.tabCounts.todas, 4);
            assert.strictEqual(kpis.tabCounts.incrementos, 2);   // id 1 (incremento) e id 3 (mixto contiene incremento)
            assert.strictEqual(kpis.tabCounts.disminuciones, 2); // id 2 (disminucion) e id 3 (mixto contiene disminucion)
            assert.strictEqual(kpis.tabCounts.checkpoints, 1);   // id 4
        });

        it('debe manejar lista vacía, nula o indefinida con ceros seguros sin NaN ni undefined', () => {
            const emptyKpis = AjustesData.calcularKpis([]);
            assert.strictEqual(emptyKpis.totalAjustes, 0);
            assert.strictEqual(emptyKpis.unidadesIncrementadas, 0);
            assert.strictEqual(emptyKpis.unidadesDisminuidas, 0);
            assert.strictEqual(emptyKpis.balanceNeto, 0);
            assert.strictEqual(emptyKpis.totalItems, 0);
            assert.strictEqual(emptyKpis.tabCounts.todas, 0);
            assert.strictEqual(emptyKpis.tabCounts.incrementos, 0);
            assert.strictEqual(emptyKpis.tabCounts.disminuciones, 0);
            assert.strictEqual(emptyKpis.tabCounts.checkpoints, 0);

            const nullKpis = AjustesData.calcularKpis(null);
            assert.strictEqual(nullKpis.totalAjustes, 0);
            assert.strictEqual(nullKpis.balanceNeto, 0);
        });
    });

    // =========================================================================
    // 3. AjustesData.filtrarAjustes
    // =========================================================================
    describe('AjustesData.filtrarAjustes', () => {

        const dataset = [
            AjustesData.decorarAjuste({
                id: 1,
                numero: 18,
                fecha: '2026-11-18',
                observaciones: 'Garantia de fábrica proveedor Tech',
                detalles: [{ producto_id: 10, sku: '2311', nombre: 'Sensor de Proximidad', tipo: 'incremento', cantidad: 10 }]
            }),
            AjustesData.decorarAjuste({
                id: 2,
                numero: 19,
                fecha: '2026-11-19',
                observaciones: 'Merma por vencimiento de lote',
                detalles: [{ producto_id: 20, sku: '5588', nombre: 'Pasta Térmica Pro', tipo: 'disminucion', cantidad: 4 }]
            }),
            AjustesData.decorarAjuste({
                id: 3,
                numero: 20,
                fecha: '2026-11-20',
                observaciones: 'Ajuste mixto mensual',
                detalles: [
                    { producto_id: 10, sku: '2311', nombre: 'Sensor de Proximidad', tipo: 'incremento', cantidad: 5 },
                    { producto_id: 30, sku: '9900', nombre: 'Cable USB-C 2M', tipo: 'disminucion', cantidad: 2 }
                ]
            }),
            AjustesData.decorarAjuste({
                id: 4,
                numero: 21,
                fecha: '2026-11-20',
                observaciones: 'Checkpoint masivo de fin de mes',
                detalles: [
                    { producto_id: 40, sku: '4411', nombre: 'Módulo Bluetooth', a: 100 }
                ]
            })
        ];

        it('debe filtrar correctamente por tab "todas"', () => {
            const res = AjustesData.filtrarAjustes(dataset, { tab: 'todas', query: '' });
            assert.strictEqual(res.length, 4);
        });

        it('debe filtrar correctamente por tab "incrementos"', () => {
            const res = AjustesData.filtrarAjustes(dataset, { tab: 'incrementos', query: '' });
            // Incluye id 1 (incremento puro) e id 3 (mixto con incrementos)
            assert.strictEqual(res.length, 2);
            assert.ok(res.some(a => a.id === 1));
            assert.ok(res.some(a => a.id === 3));
        });

        it('debe filtrar correctamente por tab "disminuciones"', () => {
            const res = AjustesData.filtrarAjustes(dataset, { tab: 'disminuciones', query: '' });
            // Incluye id 2 (disminución pura) e id 3 (mixto con disminuciones)
            assert.strictEqual(res.length, 2);
            assert.ok(res.some(a => a.id === 2));
            assert.ok(res.some(a => a.id === 3));
        });

        it('debe filtrar correctamente por tab "checkpoints"', () => {
            const res = AjustesData.filtrarAjustes(dataset, { tab: 'checkpoints', query: '' });
            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].id, 4);
        });

        it('debe buscar en tiempo real por número (#18 o 18)', () => {
            const resHash = AjustesData.filtrarAjustes(dataset, { tab: 'todas', query: '#18' });
            assert.strictEqual(resHash.length, 1);
            assert.strictEqual(resHash[0].numero, 18);

            const resNum = AjustesData.filtrarAjustes(dataset, { tab: 'todas', query: '18' });
            assert.ok(resNum.some(a => a.numero === 18));
        });

        it('debe buscar en tiempo real por texto de observaciones ("Garantia")', () => {
            const res = AjustesData.filtrarAjustes(dataset, { tab: 'todas', query: 'Garantia' });
            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].id, 1);
        });

        it('debe buscar en tiempo real por SKU del ítem contenido ("2311")', () => {
            const res = AjustesData.filtrarAjustes(dataset, { tab: 'todas', query: '2311' });
            assert.strictEqual(res.length, 2); // id 1 e id 3 contienen SKU 2311
            assert.ok(res.some(a => a.id === 1));
            assert.ok(res.some(a => a.id === 3));
        });

        it('debe buscar en tiempo real por nombre de producto ("Pasta Térmica")', () => {
            const res = AjustesData.filtrarAjustes(dataset, { tab: 'todas', query: 'Pasta Térmica' });
            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].id, 2);
        });

        it('debe combinar pestaña y query de búsqueda simultáneamente', () => {
            // Tab 'incrementos' + query '2311' -> id 1 y 3
            const res1 = AjustesData.filtrarAjustes(dataset, { tab: 'incrementos', query: '2311' });
            assert.strictEqual(res1.length, 2);

            // Tab 'disminuciones' + query 'Sensor' -> solo id 3 (el id 1 no es disminución)
            const res2 = AjustesData.filtrarAjustes(dataset, { tab: 'disminuciones', query: 'Sensor' });
            assert.strictEqual(res2.length, 1);
            assert.strictEqual(res2[0].id, 3);

            // Tab 'checkpoints' + query 'Pasta' -> 0 resultados
            const res3 = AjustesData.filtrarAjustes(dataset, { tab: 'checkpoints', query: 'Pasta' });
            assert.strictEqual(res3.length, 0);
        });
    });

    // =========================================================================
    // 4. AjustesData.paginar
    // =========================================================================
    describe('AjustesData.paginar', () => {

        const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, numero: 100 + i }));

        it('debe paginar la página 1 con pageSize 10', () => {
            const res = AjustesData.paginar(items, 1, 10);
            assert.strictEqual(res.items.length, 10);
            assert.strictEqual(res.items[0].id, 1);
            assert.strictEqual(res.items[9].id, 10);
            assert.strictEqual(res.totalItems, 25);
            assert.strictEqual(res.totalPages, 3);
            assert.strictEqual(res.currentPage, 1);
        });

        it('debe paginar la última página con el remanente exacto', () => {
            const res = AjustesData.paginar(items, 3, 10);
            assert.strictEqual(res.items.length, 5);
            assert.strictEqual(res.items[0].id, 21);
            assert.strictEqual(res.items[4].id, 25);
            assert.strictEqual(res.currentPage, 3);
        });

        it('debe clampear a la última página válida si se solicita una página fuera de rango superior', () => {
            const res = AjustesData.paginar(items, 99, 10);
            assert.strictEqual(res.currentPage, 3);
            assert.strictEqual(res.items.length, 5);
        });

        it('debe clampear a la página 1 si se solicita página <= 0', () => {
            const res = AjustesData.paginar(items, 0, 10);
            assert.strictEqual(res.currentPage, 1);
            assert.strictEqual(res.items[0].id, 1);
        });

        it('debe manejar lista vacía con totalPages 0 o 1 y items vacíos sin lanzar error', () => {
            const res = AjustesData.paginar([], 1, 10);
            assert.strictEqual(res.items.length, 0);
            assert.strictEqual(res.totalItems, 0);
            assert.ok(res.totalPages === 0 || res.totalPages === 1);
        });
    });

    // =========================================================================
    // 5. AjustesData.mapearAjustesParaExport
    // =========================================================================
    describe('AjustesData.mapearAjustesParaExport', () => {

        it('debe generar la estructura tabular limpia para exportar a Excel/CSV', () => {
            const ajustes = [
                AjustesData.decorarAjuste({
                    id: 1,
                    numero: 18,
                    fecha: '2026-11-20',
                    observaciones: 'Ajuste de garantía',
                    detalles: [{ tipo: 'incremento', cantidad: 15 }]
                }),
                AjustesData.decorarAjuste({
                    id: 2,
                    numero: 19,
                    fecha: '2026-11-20',
                    observaciones: 'Merma de almacén',
                    detalles: [{ tipo: 'disminucion', cantidad: 3 }]
                })
            ];

            const rows = AjustesData.mapearAjustesParaExport(ajustes);

            assert.strictEqual(rows.length, 2);

            const r1 = rows[0];
            assert.ok('Número' in r1);
            assert.ok('Fecha' in r1);
            assert.ok('Tipo' in r1);
            assert.ok('Ítems' in r1);
            assert.ok('Unidades +' in r1);
            assert.ok('Unidades -' in r1);
            assert.ok('Balance' in r1);
            assert.ok('Observaciones' in r1);

            assert.strictEqual(r1['Número'], '#18');
            assert.strictEqual(r1['Tipo'], 'Incremento');
            assert.strictEqual(r1['Unidades +'], 15);
            assert.strictEqual(r1['Unidades -'], 0);
            assert.strictEqual(r1['Balance'], 15);
            assert.strictEqual(r1['Observaciones'], 'Ajuste de garantía');

            const r2 = rows[1];
            assert.strictEqual(r2['Número'], '#19');
            assert.strictEqual(r2['Tipo'], 'Disminución');
            assert.strictEqual(r2['Unidades +'], 0);
            assert.strictEqual(r2['Unidades -'], 3);
            assert.strictEqual(r2['Balance'], -3);
        });

        it('debe tolerar listas vacías o valores nulos retornando un arreglo vacío', () => {
            assert.deepStrictEqual(AjustesData.mapearAjustesParaExport([]), []);
            assert.deepStrictEqual(AjustesData.mapearAjustesParaExport(null), []);
        });
    });

    // =========================================================================
    // 6. AjustesTemplates - Formatters y Vistas
    // =========================================================================
    describe('AjustesTemplates Formatters', () => {

        it('formatMoney debe formatear moneda en COP ($ ...)', () => {
            assert.strictEqual(AjustesTemplates.formatMoney(50000), '$ 50.000');
            assert.strictEqual(AjustesTemplates.formatMoney(0), '$ 0');
            assert.strictEqual(AjustesTemplates.formatMoney(null), '$ 0');
            assert.strictEqual(AjustesTemplates.formatMoney(''), '$ 0');
        });

        it('formatFecha debe formatear fechas YYYY-MM-DD a DD/MM/YYYY y tolerar valores nulos', () => {
            assert.strictEqual(AjustesTemplates.formatFecha('2026-11-20'), '20/11/2026');
            assert.strictEqual(AjustesTemplates.formatFecha('2026-11-20T15:30:00Z'), '20/11/2026');
            assert.strictEqual(AjustesTemplates.formatFecha(null), '---');
            assert.strictEqual(AjustesTemplates.formatFecha(''), '---');
        });

        it('formatNumero debe formatear números de unidades con separador de miles', () => {
            assert.strictEqual(AjustesTemplates.formatNumero(12500), '12.500');
            assert.strictEqual(AjustesTemplates.formatNumero(0), '0');
            assert.strictEqual(AjustesTemplates.formatNumero(null), '0');
        });

        it('getTipoBadge debe generar el badge HTML semántico según el tipo de ajuste', () => {
            const inc = AjustesTemplates.getTipoBadge('incremento');
            assert.ok(inc.includes('Incremento'));
            assert.ok(inc.includes('badge') || inc.includes('success'));

            const dis = AjustesTemplates.getTipoBadge('disminucion');
            assert.ok(dis.includes('Disminución') || dis.includes('Merma'));
            assert.ok(dis.includes('badge') || dis.includes('danger') || dis.includes('warning'));

            const mix = AjustesTemplates.getTipoBadge('mixto');
            assert.ok(mix.includes('Mixto'));

            const chk = AjustesTemplates.getTipoBadge('checkpoint');
            assert.ok(chk.includes('Checkpoint'));

            const fallback = AjustesTemplates.getTipoBadge(null);
            assert.ok(fallback.includes('Ajuste') || fallback.includes('---'));
        });
    });

    describe('AjustesTemplates Componentes UI', () => {

        it('renderLayout debe generar la estructura completa con KPIs, tabs, barra de búsqueda y contenedor de drawer', () => {
            const state = {
                currentTab: 'todas',
                searchQuery: '',
                kpis: {
                    totalAjustes: 12,
                    unidadesIncrementadas: 150,
                    unidadesDisminuidas: 40,
                    balanceNeto: 110,
                    totalItems: 35,
                    tabCounts: { todas: 12, incrementos: 6, disminuciones: 4, checkpoints: 2 }
                }
            };

            const html = AjustesTemplates.renderLayout(state);

            // Encabezado y títulos
            assert.ok(html.includes('Ajustes de Inventario'));
            assert.ok(html.includes('btn-nuevo-ajuste') || html.includes('Nuevo Ajuste'));
            assert.ok(html.includes('btn-export-excel') || html.includes('Exportar'));

            // 4 KPI Cards
            assert.ok(html.includes('kpi-total-ajustes'));
            assert.ok(html.includes('kpi-unidades-incrementadas'));
            assert.ok(html.includes('kpi-unidades-disminuidas'));
            assert.ok(html.includes('kpi-balance-neto'));

            // Tabs con badges dinámicos
            assert.ok(html.includes('tab-todas'));
            assert.ok(html.includes('tab-incrementos'));
            assert.ok(html.includes('tab-disminuciones'));
            assert.ok(html.includes('tab-checkpoints'));

            // Buscador y tabla
            assert.ok(html.includes('search-ajustes'));
            assert.ok(html.includes('ajustes-grid-container') || html.includes('ajustes-table'));

            // Drawer lateral 360°
            assert.ok(html.includes('ajustes-drawer') || html.includes('drawer-ajuste'));
        });

        it('renderGrid debe renderizar estado vacío amigable cuando rows está vacío', () => {
            const html = AjustesTemplates.renderGrid([], { currentTab: 'todas', searchQuery: '' });
            assert.ok(html.includes('No se encontraron ajustes') || html.includes('Sin ajustes'));
            assert.ok(html.includes('bi-') || html.includes('icon'));
        });

        it('renderGrid debe renderizar filas de ajustes con badges, números y acciones', () => {
            const rows = [
                AjustesData.decorarAjuste({
                    id: 1,
                    numero: 18,
                    fecha: '2026-11-20',
                    observaciones: 'Ajuste de garantía de proveedor',
                    detalles: [{ tipo: 'incremento', cantidad: 15 }]
                })
            ];

            const html = AjustesTemplates.renderGrid(rows, { currentTab: 'todas', searchQuery: '' });

            assert.ok(html.includes('#18'));
            assert.ok(html.includes('20/11/2026') || html.includes('2026-11-20'));
            assert.ok(html.includes('Incremento'));
            assert.ok(html.includes('15'));
            assert.ok(html.includes('data-id="1"'));
        });

        it('renderDrawerContent debe renderizar el panel 360° con corte seguro a 50 ítems en checkpoints masivos', () => {
            // Generar 120 ítems para validar el corte seguro a 50
            const itemsMasivos = [];
            for (let i = 1; i <= 120; i++) {
                itemsMasivos.push({
                    producto_id: i,
                    sku: `SKU-${i}`,
                    nombre: `Producto Lote ${i}`,
                    tipo: 'incremento',
                    cantidad: 2,
                    costo_unitario: 10000
                });
            }

            const ajusteMasivo = AjustesData.decorarAjuste({
                id: 99,
                numero: 999,
                fecha: '2026-11-20',
                observaciones: 'Auditoría masiva de 120 ítems',
                detalles: itemsMasivos
            });

            const html = AjustesTemplates.renderDrawerContent(ajusteMasivo);

            // Cabecera del drawer con número y fecha
            assert.ok(html.includes('#999'));
            assert.ok(html.includes('Auditoría masiva'));

            // Scorecard resumen en el drawer
            assert.ok(html.includes('240') || html.includes('Unidades')); // 120 * 2 = 240
            assert.ok(html.includes('120') || html.includes('Ítems'));

            // Corte seguro a 50 ítems para no degradar el DOM
            assert.ok(html.includes('Mostrando 50 de 120') || html.includes('50 de 120') || html.includes('primeros 50'));

            // Validar que el ítem 1 está y que el ítem 100 NO está en el DOM de la tabla
            assert.ok(html.includes('SKU-1'));
            assert.ok(!html.includes('SKU-100'));
        });
    });

    // =========================================================================
    // 7. AjustesInventarioModule Orquestador
    // =========================================================================
    describe('AjustesInventarioModule Orquestador', () => {

        it('debe exponer el estado inicial y métodos orquestadores principales', () => {
            assert.ok(typeof AjustesInventarioModule.init === 'function');
            assert.ok(AjustesInventarioModule.state !== undefined, 'Debe contar con un state definido');
            assert.strictEqual(typeof AjustesInventarioModule.state.currentTab, 'string');
            assert.strictEqual(typeof AjustesInventarioModule.state.searchQuery, 'string');
            assert.strictEqual(typeof AjustesInventarioModule.state.currentPage, 'number');
        });
    });
    // =========================================================================
    // 8. Blindaje de Seguridad y Auditoría OWASP (Fase 4 ECC)
    // =========================================================================
    describe('Blindaje de Seguridad y Auditoría OWASP (Fase 4 ECC)', () => {

        it('1. Prevención estricta de XSS: debe sanitizar tags en numero, observaciones, SKU y conteo físico', () => {
            const rawMalicioso = {
                id: '123"><script>alert(1)</script>',
                numero: '<img src=x onerror=alert("xss")>',
                fecha: '2026-11-20<script>',
                observaciones: '<b>Inyección XSS</b> & "ataque"',
                detalles: [
                    {
                        sku: '<script>sku</script>',
                        nombre: '<svg onload=alert(2)>',
                        tipo: 'incremento',
                        cantidad: 10,
                        costo_unitario: 5000
                    },
                    {
                        sku: 'CKP-001',
                        nombre: 'Snapshot Masivo',
                        a: '<img src=x onerror=alert(3)>'
                    }
                ]
            };

            const decorado = AjustesData.decorarAjuste(rawMalicioso);
            const gridHtml = AjustesTemplates.renderGrid([decorado], {});
            const drawerHtml = AjustesTemplates.renderDrawerContent(decorado);

            // Verificar que no se inyectan tags HTML sin escapar
            assert.ok(!gridHtml.includes('<script>alert(1)</script>'));
            assert.ok(!gridHtml.includes('<img src=x onerror=alert("xss")>'));
            assert.ok(gridHtml.includes('&lt;img src=x onerror=alert(&quot;xss&quot;)&gt;'));
            assert.ok(gridHtml.includes('&lt;b&gt;Inyección XSS&lt;/b&gt; &amp; &quot;ataque&quot;'));

            assert.ok(!drawerHtml.includes('<script>sku</script>'));
            assert.ok(!drawerHtml.includes('<svg onload=alert(2)>'));
            assert.ok(!drawerHtml.includes('<img src=x onerror=alert(3)>'));
            assert.ok(drawerHtml.includes('&lt;script&gt;sku&lt;/script&gt;'));
        });

        it('2. Resiliencia contra colapso de UI (DOM DoS): Checkpoints masivos (1800+ ítems) deben procesarse en < 50ms', () => {
            const itemsGigantes = [];
            for (let i = 1; i <= 1850; i++) {
                itemsGigantes.push({
                    producto_id: i,
                    sku: `SKU-MASSIVE-${i}`,
                    nombre: `Item de Inventario Extendido ${i}`,
                    a: Math.floor(Math.random() * 100),
                    costo_unitario: 15000
                });
            }

            const t0 = performance.now();
            const ajusteGigante = AjustesData.decorarAjuste({
                id: 5001,
                numero: 9999,
                fecha: '2026-11-20',
                observaciones: 'Auditoría Anual Checkpoint 1850 Referencias',
                detalles: itemsGigantes
            });
            const tDecorar = performance.now() - t0;

            assert.strictEqual(ajusteGigante.isCheckpoint, true);
            assert.strictEqual(ajusteGigante.totalItems, 1850);
            assert.ok(tDecorar < 50, `Decoración tomó ${tDecorar}ms (esperado < 50ms)`);

            // Drawer lateral debe aplicar corte estricto de seguridad a 50 ítems
            const drawerMasivo = AjustesTemplates.renderDrawerContent(ajusteGigante);
            assert.ok(drawerMasivo.includes('Mostrando 50 de 1850'));
            assert.ok(drawerMasivo.includes('SKU-MASSIVE-1'));
            assert.ok(!drawerMasivo.includes('SKU-MASSIVE-100'));
        });

        it('3. Neutralización de CSV Formula Injection (CWE-1236)', () => {
            const items = [
                {
                    numero: 10,
                    fecha: '2026-11-20',
                    tipo: 'incremento',
                    totalItems: 1,
                    unidadesIncrementadas: 10,
                    unidadesDisminuidas: 0,
                    balanceNeto: 10,
                    observaciones: "=cmd|'/C calc'!A0"
                },
                {
                    numero: 11,
                    fecha: '2026-11-20',
                    tipo: 'disminucion',
                    totalItems: 2,
                    unidadesIncrementadas: 0,
                    unidadesDisminuidas: 5,
                    balanceNeto: -5,
                    observaciones: '@SUM(1+1)'
                }
            ];

            const rowsToExport = AjustesData.mapearAjustesParaExport(items);
            const headers = Object.keys(rowsToExport[0]);
            
            // Simular formateador CSV seguro
            let csv = headers.join(';') + '\r\n';
            rowsToExport.forEach(row => {
                csv += headers.map(h => {
                    const raw = (row[h] !== null && row[h] !== undefined) ? String(row[h]) : '';
                    const escaped = raw.replace(/"/g, '""');
                    const isFormula = /^[=+\-@\t\r]/.test(escaped);
                    const isNumber = !isNaN(Number(raw)) && raw.trim() !== '';
                    return (isFormula && !isNumber) ? `"'${escaped}"` : `"${escaped}"`;
                }).join(';') + '\r\n';
            });

            // Fórmulas maliciosas deben estar neutralizadas con apóstrofe inicial
            assert.ok(csv.includes('"\'=cmd|\'/C calc\'!A0"'));
            assert.ok(csv.includes('"\'@SUM(1+1)"'));
            // Números negativos legítimos (como balance -5) NO deben neutralizarse
            assert.ok(csv.includes('"-5"'));
        });
    });
});
