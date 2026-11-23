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
    });
});
