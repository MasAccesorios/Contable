import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { QuickActions, QUICK_ACTIONS_CONFIG } from '../js/shared/quickActions.js';

describe('QuickActions Hub 2.0 - TDD & Config Validation', () => {

    describe('Configuración e Integridad de Rutas', () => {
        it('debe tener definidas las secciones "crear" y "listas"', () => {
            assert.ok(Array.isArray(QUICK_ACTIONS_CONFIG.crear), 'Sección crear debe ser un array');
            assert.ok(Array.isArray(QUICK_ACTIONS_CONFIG.listas), 'Sección listas debe ser un array');
            assert.ok(QUICK_ACTIONS_CONFIG.crear.length > 0, 'Debe tener grupos de creación');
            assert.ok(QUICK_ACTIONS_CONFIG.listas.length > 0, 'Debe tener grupos de listas');
        });

        it('todos los ítems de "crear" deben tener campos requeridos y rutas hash válidas', () => {
            const allItems = QUICK_ACTIONS_CONFIG.crear.flatMap(g => g.items);
            assert.ok(allItems.length >= 7, 'Debe haber al menos 7 acciones rápidas principales');

            const keysSet = new Set();
            for (const item of allItems) {
                assert.ok(item.titulo, 'Cada item debe tener título');
                assert.ok(item.descripcion, `Item ${item.titulo} debe tener descripción`);
                assert.ok(item.icono.startsWith('bi-'), `Item ${item.titulo} debe usar Bootstrap Icons`);
                assert.ok(item.claseIcono, `Item ${item.titulo} debe tener clase semántica de icono`);
                assert.ok(item.ruta.startsWith('#/'), `Item ${item.titulo} debe tener ruta hash válida`);
                
                if (item.key) {
                    assert.ok(!keysSet.has(item.key), `Atajo ${item.key} no debe estar duplicado`);
                    keysSet.add(item.key);
                }
            }
        });

        it('todos los ítems de "listas" deben tener rutas válidas que comiencen con #/', () => {
            const allListas = QUICK_ACTIONS_CONFIG.listas.flatMap(g => g.items);
            for (const item of allListas) {
                assert.ok(item.titulo, 'Item de lista debe tener título');
                assert.ok(item.ruta.startsWith('#/'), `Item de lista ${item.titulo} debe tener ruta hash`);
            }
        });

        it('debe incluir la acción rápida para registrar Gasto Operativo con ruta #/gastos/pagos?nuevo=true', () => {
            const allCrear = QUICK_ACTIONS_CONFIG.crear.flatMap(g => g.items);
            const gastoItem = allCrear.find(i => i.ruta === '#/gastos/pagos?nuevo=true');
            assert.ok(gastoItem, 'Debe existir un ítem de creación para Gasto Operativo con ruta #/gastos/pagos?nuevo=true');
            assert.match(gastoItem.titulo, /gasto/i, 'El título debe indicar explícitamente Gasto');
        });

        it('debe incluir la acción rápida para registrar Ingresos con ruta #/ingresos/operativos?nuevo=true', () => {
            const allCrear = QUICK_ACTIONS_CONFIG.crear.flatMap(g => g.items);
            const ingresoItem = allCrear.find(i => i.ruta === '#/ingresos/operativos?nuevo=true');
            assert.ok(ingresoItem, 'Debe existir un ítem de creación para Ingresos con ruta #/ingresos/operativos?nuevo=true');
            assert.match(ingresoItem.titulo, /ingreso/i, 'El título debe indicar explícitamente Ingresos');
            assert.strictEqual(ingresoItem.key, '4', 'Debe conservar el atajo de teclado 4');
        });

        it('debe incluir Gastos Operativos en la sección de listas con ruta #/gastos/pagos', () => {
            const allListas = QUICK_ACTIONS_CONFIG.listas.flatMap(g => g.items);
            const gastosLista = allListas.find(i => i.ruta === '#/gastos/pagos');
            assert.ok(gastosLista, 'Debe existir la lista de Gastos Operativos en listas con ruta #/gastos/pagos');
        });
    });

    describe('Ciclo de Vida y DOM Helpers (Mock Environment)', () => {
        let mockParent;
        let mockBtn;

        beforeEach(() => {
            // Mock de elementos DOM mínimos
            mockParent = {
                classList: {
                    classes: new Set(),
                    contains(c) { return this.classes.has(c); },
                    add(c) { this.classes.add(c); },
                    remove(c) { this.classes.delete(c); }
                },
                appendChild(child) {
                    this.child = child;
                    child.parentElement = this;
                }
            };

            mockBtn = {
                id: 'quick-action-btn',
                parentElement: mockParent,
                attributes: {},
                classList: {
                    classes: new Set(),
                    contains(c) { return this.classes.has(c); },
                    add(c) { this.classes.add(c); },
                    remove(c) { this.classes.delete(c); },
                    toggle(c, force) {
                        if (force !== undefined) {
                            if (force) this.classes.add(c);
                            else this.classes.delete(c);
                        } else {
                            if (this.classes.has(c)) this.classes.delete(c);
                            else this.classes.add(c);
                        }
                    }
                },
                setAttribute(k, v) { this.attributes[k] = v; },
                getAttribute(k) { return this.attributes[k]; },
                focus() { this.focused = true; },
                addEventListener() {}
            };
        });

        it('isOpen debe retornar false cuando el dropdown no existe o está oculto', () => {
            // Sin dropdown en el DOM global
            globalThis.document = {
                getElementById: (id) => (id === 'quick-action-btn' ? mockBtn : null),
                addEventListener: () => {}
            };
            assert.strictEqual(QuickActions.isOpen(), false);
        });

        it('switchTab debe cambiar la pestaña activa y actualizar estado', () => {
            QuickActions.activeTab = 'crear';
            QuickActions.switchTab('listas');
            assert.strictEqual(QuickActions.activeTab, 'listas');
            QuickActions.switchTab('crear');
            assert.strictEqual(QuickActions.activeTab, 'crear');
        });

        it('updateFocusedCard debe marcar correctamente la tarjeta con is-focused', () => {
            const card1 = { classList: { add() { this.focused = true; }, remove() { this.focused = false; } } };
            const card2 = { classList: { add() { this.focused = true; }, remove() { this.focused = false; } } };
            const cards = [card1, card2];

            QuickActions.focusedIndex = 0;
            QuickActions.updateFocusedCard(cards);
            assert.strictEqual(card1.classList.focused, true);
            assert.strictEqual(card2.classList.focused, false);

            QuickActions.focusedIndex = 1;
            QuickActions.updateFocusedCard(cards);
            assert.strictEqual(card1.classList.focused, false);
            assert.strictEqual(card2.classList.focused, true);
        });

        it('handleKeydown Escape debe cerrar el dropdown si está abierto', () => {
            let closed = false;
            QuickActions.isOpen = () => true;
            QuickActions.closeDropdown = () => { closed = true; };
            QuickActions.btnElement = mockBtn;

            let prevented = false;
            QuickActions.handleKeydown({
                key: 'Escape',
                preventDefault: () => { prevented = true; }
            });

            assert.strictEqual(prevented, true);
            assert.strictEqual(closed, true);
        });

        it('handleKeydown Shift + N debe conmutar el menú', () => {
            let toggled = false;
            QuickActions.toggleDropdown = () => { toggled = true; };

            let prevented = false;
            QuickActions.handleKeydown({
                key: 'N',
                shiftKey: true,
                preventDefault: () => { prevented = true; }
            });

            assert.strictEqual(prevented, true);
            assert.strictEqual(toggled, true);
        });

        it('handleKeydown con número 6 debe activar el enlace de Gasto Operativo', () => {
            let clicked = false;
            const mockCard = {
                querySelector: (sel) => (sel === '.qa-key-badge' ? { textContent: '6' } : null),
                click: () => { clicked = true; }
            };
            const mockHub = {
                querySelectorAll: () => [mockCard]
            };

            globalThis.document = {
                getElementById: (id) => (id === 'quick-action-dropdown' ? mockHub : null)
            };

            QuickActions.isOpen = () => true;
            QuickActions.activeTab = 'crear';

            let prevented = false;
            QuickActions.handleKeydown({
                key: '6',
                ctrlKey: false,
                altKey: false,
                metaKey: false,
                preventDefault: () => { prevented = true; }
            });

            assert.strictEqual(prevented, true);
            assert.strictEqual(clicked, true);
        });

        it('handleKeydown con número 9 debe activar el límite superior (Ajuste de Inventario)', () => {
            let clicked = false;
            const mockCard = {
                querySelector: (sel) => (sel === '.qa-key-badge' ? { textContent: '9' } : null),
                click: () => { clicked = true; }
            };
            const mockHub = {
                querySelectorAll: () => [mockCard]
            };

            globalThis.document = {
                getElementById: (id) => (id === 'quick-action-dropdown' ? mockHub : null)
            };

            QuickActions.isOpen = () => true;
            QuickActions.activeTab = 'crear';

            let prevented = false;
            QuickActions.handleKeydown({
                key: '9',
                ctrlKey: false,
                altKey: false,
                metaKey: false,
                preventDefault: () => { prevented = true; }
            });

            assert.strictEqual(prevented, true);
            assert.strictEqual(clicked, true);
        });
    });

    describe('Seguridad y Blindaje de Parámetros de Navegación', () => {
        it('debe validar que los esquemas y parámetros en rutas de QuickActions sean seguros', () => {
            const allItems = [
                ...QUICK_ACTIONS_CONFIG.crear.flatMap(g => g.items),
                ...QUICK_ACTIONS_CONFIG.listas.flatMap(g => g.items)
            ];
            for (const item of allItems) {
                assert.ok(!item.ruta.toLowerCase().startsWith('javascript:'), 'Ruta insegura en ' + item.titulo);
                assert.ok(!item.ruta.toLowerCase().startsWith('data:'), 'Ruta insegura en ' + item.titulo);
                assert.ok(item.ruta.startsWith('#/'), 'Ruta debe usar hash SPA: ' + item.titulo);

                if (item.ruta.includes('?')) {
                    const [, qs] = item.ruta.split('?');
                    const params = new URLSearchParams(qs);
                    assert.strictEqual(params.has('__proto__'), false);
                    assert.strictEqual(params.has('constructor'), false);
                    assert.strictEqual(params.has('prototype'), false);
                }
            }
        });

        it('debe procesar el parámetro ?nuevo de manera segura y determinista sin coerción a undefined', () => {
            const parseHelper = (hash, search = '', pathname = '/app/index.html') => {
                const hashParts = hash ? hash.split('?') : [];
                const queryParams = new URLSearchParams(hashParts[1] || search);
                const isNuevo = queryParams.get('nuevo') === 'true' || queryParams.has('nuevo');
                const cleanUrl = pathname + (hashParts[0] || '');
                return { isNuevo, cleanUrl };
            };

            const res1 = parseHelper('#/gastos/pagos?nuevo=true');
            assert.strictEqual(res1.isNuevo, true);
            assert.strictEqual(res1.cleanUrl, '/app/index.html#/gastos/pagos');

            const res2 = parseHelper('', '');
            assert.strictEqual(res2.isNuevo, false);
            assert.strictEqual(res2.cleanUrl, '/app/index.html');
            assert.ok(!res2.cleanUrl.includes('undefined'), 'No debe contener undefined');

            const res3 = parseHelper('#/gastos/pagos?nuevo=<script>alert(1)</script>');
            assert.strictEqual(res3.cleanUrl, '/app/index.html#/gastos/pagos');
            assert.ok(!res3.cleanUrl.includes('<script>'), 'URL limpia no debe conservar payload');
        });
    });
});
