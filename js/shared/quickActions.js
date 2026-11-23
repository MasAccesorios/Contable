/**
 * QuickActions Hub 2.0 - MAS Accesorios
 * Centro de Creación y Acceso Rápido Ergonómico
 * Soporta navegación por teclado, WCAG 2.2 AA y selector por tabs
 */

export const QUICK_ACTIONS_CONFIG = {
    crear: [
        {
            categoria: 'Ventas & Ingresos',
            items: [
                {
                    key: '1',
                    titulo: 'Factura de Venta',
                    descripcion: 'Genera cobro oficial y descuenta stock',
                    icono: 'bi-receipt',
                    claseIcono: 'qa-icon-ventas',
                    ruta: '#/ingresos/facturas/nueva'
                },
                {
                    key: '2',
                    titulo: 'Cotización Comercial',
                    descripcion: 'Presupuesto formal para cliente',
                    icono: 'bi-file-earmark-text',
                    claseIcono: 'qa-icon-ventas',
                    ruta: '#/ingresos/cotizaciones/nueva'
                },
                {
                    key: '3',
                    titulo: 'Recibo de Caja / Abono',
                    descripcion: 'Registrar pago o cobro de cliente',
                    icono: 'bi-cash-coin',
                    claseIcono: 'qa-icon-cobros',
                    ruta: '#/ingresos/pagos/nuevo'
                },
                {
                    key: '4',
                    titulo: 'Cuenta de Cobro',
                    descripcion: 'Documento de cobro sin factura fiscal',
                    icono: 'bi-file-earmark-check',
                    claseIcono: 'qa-icon-cobros',
                    ruta: '#/ingresos/cuenta-cobro/nueva'
                }
            ]
        },
        {
            categoria: 'Compras & Gastos',
            items: [
                {
                    key: '5',
                    titulo: 'Factura de Compra',
                    descripcion: 'Registrar proveedor y sumar stock',
                    icono: 'bi-bag-check',
                    claseIcono: 'qa-icon-compras',
                    ruta: '#/gastos/proveedores/nueva'
                },
                {
                    key: '6',
                    titulo: 'Gasto Operativo',
                    descripcion: 'Servicios, arriendos, nómina y salidas de caja',
                    icono: 'bi-dash-circle',
                    claseIcono: 'qa-icon-gastos',
                    ruta: '#/gastos/pagos?nuevo=true'
                },
                {
                    key: '7',
                    titulo: 'Pago a Proveedor',
                    descripcion: 'Comprobante de egreso o abono a compra',
                    icono: 'bi-wallet2',
                    claseIcono: 'qa-icon-compras',
                    ruta: '#/gastos/pagos/nuevo'
                }
            ]
        },
        {
            categoria: 'Catálogo & Terceros',
            items: [
                {
                    key: '8',
                    titulo: 'Nuevo Contacto',
                    descripcion: 'Registrar cliente, proveedor o tercero',
                    icono: 'bi-person-plus',
                    claseIcono: 'qa-icon-operaciones',
                    ruta: '#/contactos/nueva'
                },
                {
                    key: '9',
                    titulo: 'Ajuste de Inventario',
                    descripcion: 'Incremento o merma manual (Kardex FIFO)',
                    icono: 'bi-sliders',
                    claseIcono: 'qa-icon-operaciones',
                    ruta: '#/inventario/ajustes/nuevo'
                }
            ]
        }
    ],
    listas: [
        {
            categoria: 'Ventas & Facturación',
            items: [
                {
                    titulo: 'Facturas de Venta',
                    descripcion: 'Histórico, estados de cobro y descarga PDF',
                    icono: 'bi-receipt',
                    claseIcono: 'qa-icon-list',
                    ruta: '#/ingresos/facturas'
                },
                {
                    titulo: 'Cotizaciones',
                    descripcion: 'Seguimiento de presupuestos activos',
                    icono: 'bi-file-text',
                    claseIcono: 'qa-icon-list',
                    ruta: '#/ingresos/cotizaciones'
                },
                {
                    titulo: 'Control de Cartera (CxC)',
                    descripcion: 'Cuentas por cobrar, moras y estados de cuenta',
                    icono: 'bi-pie-chart',
                    claseIcono: 'qa-icon-list',
                    ruta: '#/cartera'
                }
            ]
        },
        {
            categoria: 'Compras & Egresos',
            items: [
                {
                    titulo: 'Facturas de Compra',
                    descripcion: 'Historial de compras y proveedores',
                    icono: 'bi-bag',
                    claseIcono: 'qa-icon-list',
                    ruta: '#/gastos/proveedores'
                },
                {
                    titulo: 'Gastos Operativos',
                    descripcion: 'Control de egresos generales y salidas de caja',
                    icono: 'bi-dash-circle',
                    claseIcono: 'qa-icon-list',
                    ruta: '#/gastos/pagos'
                },
                {
                    titulo: 'Histórico de Egresos',
                    descripcion: 'Pagos realizados a proveedores y gastos',
                    icono: 'bi-cash-stack',
                    claseIcono: 'qa-icon-list',
                    ruta: '#/gastos/pagos-realizados'
                }
            ]
        },
        {
            categoria: 'Tesorería & Operaciones',
            items: [
                {
                    titulo: 'Conciliación Bancaria',
                    descripcion: 'Movimientos de cuentas bancarias y caja',
                    icono: 'bi-bank',
                    claseIcono: 'qa-icon-list',
                    ruta: '#/bancos/conciliacion'
                },
                {
                    titulo: 'Catálogo de Productos',
                    descripcion: 'Stock, precios y costos de inventario',
                    icono: 'bi-box-seam',
                    claseIcono: 'qa-icon-list',
                    ruta: '#/inventario/items'
                }
            ]
        }
    ]
};

export const QuickActions = {
    activeTab: 'crear',
    btnElement: null,
    hubElement: null,
    focusedIndex: -1,
    isInitialized: false,

    init() {
        const btn = document.getElementById('quick-action-btn');
        if (!btn) return;

        this.btnElement = btn;
        btn.setAttribute('aria-haspopup', 'true');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('title', 'Acciones rápidas y creación (Shift + N o Clic)');

        // Asegurar posicionamiento relativo del contenedor padre
        if (!btn.parentElement.classList.contains('position-relative')) {
            btn.parentElement.classList.add('position-relative');
        }

        // Evitar duplicar listeners globales
        if (!this.isInitialized) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown(btn);
            });

            // Cerrar al hacer clic fuera
            document.addEventListener('click', (e) => {
                if (this.isOpen()) {
                    const hub = document.getElementById('quick-action-dropdown');
                    if (hub && !hub.contains(e.target) && e.target !== btn) {
                        this.closeDropdown();
                    }
                }
            });

            // Cerrar automáticamente al navegar por hash
            window.addEventListener('hashchange', () => {
                if (this.isOpen()) {
                    this.closeDropdown();
                }
            });

            // Atajos de teclado globales
            document.addEventListener('keydown', (e) => {
                this.handleKeydown(e);
            });

            this.isInitialized = true;
        }
    },

    isOpen() {
        if (typeof document === 'undefined') return false;
        const hub = document.getElementById('quick-action-dropdown');
        return Boolean(hub && hub.style.display !== 'none');
    },

    toggleDropdown(btn = this.btnElement) {
        if (this.isOpen()) {
            this.closeDropdown();
        } else {
            this.openDropdown(btn);
        }
    },

    openDropdown(btn = this.btnElement) {
        let hub = document.getElementById('quick-action-dropdown');
        if (!hub) {
            hub = document.createElement('div');
            hub.id = 'quick-action-dropdown';
            hub.className = 'quick-action-hub';
            hub.setAttribute('role', 'menu');
            hub.setAttribute('aria-label', 'Centro de creación rápida');
            btn.parentElement.appendChild(hub);
            this.hubElement = hub;
        }

        this.renderHub(hub);
        hub.style.display = 'block';

        if (btn) {
            btn.classList.add('is-active');
            btn.setAttribute('aria-expanded', 'true');
        }

        this.focusedIndex = -1;
    },

    closeDropdown() {
        const hub = document.getElementById('quick-action-dropdown');
        if (hub) {
            hub.style.display = 'none';
        }
        if (this.btnElement) {
            this.btnElement.classList.remove('is-active');
            this.btnElement.setAttribute('aria-expanded', 'false');
        }
        this.focusedIndex = -1;
    },

    switchTab(tabName) {
        if (this.activeTab === tabName) return;
        this.activeTab = tabName;
        const hub = document.getElementById('quick-action-dropdown');
        if (hub) {
            this.renderHub(hub);
            this.focusedIndex = -1;
        }
    },

    renderHub(container) {
        const isCrear = this.activeTab === 'crear';
        const groups = QUICK_ACTIONS_CONFIG[this.activeTab] || [];

        let html = `
            <div class="qa-hub-header">
                <div class="qa-tab-bar" role="tablist">
                    <button type="button" class="qa-tab-btn ${isCrear ? 'active' : ''}" data-tab="crear" role="tab" aria-selected="${isCrear}">
                        <i class="bi bi-plus-circle"></i>
                        <span>Crear Nuevo</span>
                    </button>
                    <button type="button" class="qa-tab-btn ${!isCrear ? 'active' : ''}" data-tab="listas" role="tab" aria-selected="${!isCrear}">
                        <i class="bi bi-list-columns"></i>
                        <span>Ver Listas</span>
                    </button>
                </div>
            </div>
            <div class="qa-hub-body" role="region" aria-live="polite">
        `;

        groups.forEach((group) => {
            html += `<div class="qa-section-label">${group.categoria}</div>`;
            group.items.forEach((item) => {
                html += `
                    <a href="${item.ruta}" class="qa-action-card qa-link" role="menuitem" tabindex="-1">
                        <div class="qa-icon-box ${item.claseIcono || 'qa-icon-ventas'}">
                            <i class="bi ${item.icono}"></i>
                        </div>
                        <div class="qa-action-content">
                            <h4 class="qa-action-title">${item.titulo}</h4>
                            <p class="qa-action-desc">${item.descripcion}</p>
                        </div>
                        ${item.key ? `<span class="qa-key-badge">${item.key}</span>` : '<i class="bi bi-chevron-right text-muted" style="font-size: 11px;"></i>'}
                    </a>
                `;
            });
        });

        html += `
            </div>
            <div class="qa-hub-footer">
                <span>Atajo: <kbd>1</kbd> - <kbd>9</kbd> o <kbd>↑</kbd><kbd>↓</kbd></span>
                <span>Cerrar con <kbd>Esc</kbd></span>
            </div>
        `;

        container.innerHTML = html;
        this.bindHubEvents(container);
    },

    bindHubEvents(container) {
        // Tab switching
        container.querySelectorAll('.qa-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.switchTab(btn.dataset.tab);
            });
        });

        // Enlaces de acción
        container.querySelectorAll('.qa-link').forEach(link => {
            link.addEventListener('click', () => {
                this.closeDropdown();
            });
        });
    },

    handleKeydown(e) {
        // Atajo global para abrir/cerrar menú si no está en un input
        if (e.key === 'N' && e.shiftKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
            e.preventDefault();
            this.toggleDropdown();
            return;
        }

        if (!this.isOpen()) return;

        // Escape: Cierra el menú y devuelve el foco al botón
        if (e.key === 'Escape') {
            e.preventDefault();
            this.closeDropdown();
            if (this.btnElement) this.btnElement.focus();
            return;
        }

        const hub = document.getElementById('quick-action-dropdown');
        if (!hub) return;

        const actionCards = Array.from(hub.querySelectorAll('.qa-action-card'));
        if (actionCards.length === 0) return;

        // Navegación con flechas
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.focusedIndex = (this.focusedIndex + 1) % actionCards.length;
            this.updateFocusedCard(actionCards);
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.focusedIndex = (this.focusedIndex - 1 + actionCards.length) % actionCards.length;
            this.updateFocusedCard(actionCards);
            return;
        }

        // Enter sobre el ítem enfocado
        if (e.key === 'Enter' && this.focusedIndex >= 0 && actionCards[this.focusedIndex]) {
            e.preventDefault();
            actionCards[this.focusedIndex].click();
            return;
        }

        // Atajo numérico rápido (1-9 en pestaña 'crear')
        if (this.activeTab === 'crear' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const num = parseInt(e.key, 10);
            if (!isNaN(num) && num >= 1 && num <= 9) {
                const targetCard = actionCards.find(card => {
                    const badge = card.querySelector('.qa-key-badge');
                    return badge && badge.textContent.trim() === String(num);
                });
                if (targetCard) {
                    e.preventDefault();
                    targetCard.click();
                    return;
                }
            }
        }
    },

    updateFocusedCard(cards) {
        cards.forEach((card, idx) => {
            if (idx === this.focusedIndex) {
                card.classList.add('is-focused');
                if (typeof card.scrollIntoView === 'function') {
                    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            } else {
                card.classList.remove('is-focused');
            }
        });
    }
};
