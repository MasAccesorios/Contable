export const QuickActions = {
    init() {
        const btn = document.getElementById('quick-action-btn');
        if (!btn) return;

        // Ensure parent is positioned for absolute dropdown
        if (!btn.parentElement.classList.contains('position-relative')) {
            btn.parentElement.classList.add('position-relative');
        }

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(btn);
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#quick-action-dropdown') && e.target !== btn) {
                this.closeDropdown();
            }
        });
    },

    toggleDropdown(btn) {
        let dropdown = document.getElementById('quick-action-dropdown');
        
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'quick-action-dropdown';
            dropdown.className = 'position-absolute bg-white shadow rounded border overflow-hidden py-2';
            // Position it below the button, aligned to the right edge
            dropdown.style.top = '100%';
            dropdown.style.right = '0';
            dropdown.style.minWidth = '220px';
            dropdown.style.zIndex = '1060';
            dropdown.style.marginTop = '8px';

            dropdown.innerHTML = `
                <a href="#/ingresos/facturas/nueva" class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 qa-link">
                    <i class="bi bi-receipt text-primary"></i>
                    <span style="font-size: var(--fs-md); font-weight: 500;">Factura</span>
                </a>
                <a href="#/ingresos/cotizaciones/nueva" class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 qa-link">
                    <i class="bi bi-file-earmark-text text-primary"></i>
                    <span style="font-size: var(--fs-md); font-weight: 500;">Cotización</span>
                </a>
                <a href="#/contactos/nueva" class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 qa-link">
                    <i class="bi bi-person-plus text-primary"></i>
                    <span style="font-size: var(--fs-md); font-weight: 500;">Contacto</span>
                </a>
                <a href="#/gastos/pagos" class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 qa-link">
                    <i class="bi bi-cash-coin text-primary"></i>
                    <span style="font-size: var(--fs-md); font-weight: 500;">Gasto</span>
                </a>
                <a href="#/ingresos/operativos" class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 qa-link">
                    <i class="bi bi-graph-up-arrow text-primary"></i>
                    <span style="font-size: var(--fs-md); font-weight: 500;">Ingreso</span>
                </a>
                
                <hr class="dropdown-divider my-2">

                <div class="px-3 py-1">
                    <small class="fw-bold text-muted" style="font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.5px;">Ver Listas</small>
                </div>
                <a href="#/ingresos/facturas" class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 qa-link">
                    <i class="bi bi-list-ul text-muted"></i>
                    <span style="font-size: var(--fs-md); font-weight: 500;">Facturas de venta</span>
                </a>
                <a href="#/gastos/proveedores" class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 qa-link">
                    <i class="bi bi-list-ul text-muted"></i>
                    <span style="font-size: var(--fs-md); font-weight: 500;">Facturas de compra</span>
                </a>
            `;

            btn.parentElement.appendChild(dropdown);

            // Bind click events to close the dropdown
            const links = dropdown.querySelectorAll('.qa-link');
            links.forEach(l => {
                l.addEventListener('click', () => {
                    this.closeDropdown();
                });
            });
        }

        if (dropdown.style.display === 'none' || !dropdown.style.display) {
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    },

    closeDropdown() {
        const dropdown = document.getElementById('quick-action-dropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
};
