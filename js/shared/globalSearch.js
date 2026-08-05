import { supabase } from '../core/supabase.js';

export const GlobalSearch = {
    init() {
        const input = document.getElementById('global-search');
        if (!input) return;

        let debounceTimer;

        // Wrap input in a relative container if it isn't already, for absolute dropdown positioning
        if (!input.parentElement.classList.contains('gs-container')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'gs-container position-relative flex-grow-1 d-flex align-items-center';
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);
        }

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(debounceTimer);

            if (query.length < 2) {
                this.closeDropdown();
                return;
            }

            debounceTimer = setTimeout(() => {
                this.performSearch(query, input);
            }, 300);
        });

        // Event listener to close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.gs-container')) {
                this.closeDropdown();
            }
        });
    },

    async performSearch(query, input) {
        this.renderDropdown(input, '<div class="p-3 text-center text-muted small"><div class="spinner-border spinner-border-sm me-2" role="status"></div> Buscando...</div>');

        const promises = [];
        const isNum = !isNaN(parseInt(query, 10)) && query.match(/^[0-9]+$/);
        
        // 1. Contactos (Parcial)
        promises.push(
            supabase.from('contactos')
                .select('id, nombre, identificacion')
                .or(`nombre.ilike.%${query}%,identificacion.ilike.%${query}%`)
                .limit(5)
                .then(res => ({ type: 'contactos', data: res.data || [] }))
                .catch(() => ({ type: 'contactos', data: [] }))
        );

        // 2. Productos (Parcial)
        promises.push(
            supabase.from('productos')
                .select('id, nombre, sku')
                .or(`nombre.ilike.%${query}%,sku.ilike.%${query}%`)
                .limit(5)
                .then(res => ({ type: 'productos', data: res.data || [] }))
                .catch(() => ({ type: 'productos', data: [] }))
        );

        // 3. Facturas (Exacta)
        if (isNum) {
            promises.push(
                supabase.from('facturas')
                    .select('id, numero, total, tipo, contactos!inner(nombre)')
                    .eq('numero', parseInt(query, 10))
                    .limit(5)
                    .then(res => ({ type: 'facturas', data: res.data || [] }))
                    .catch(() => ({ type: 'facturas', data: [] }))
            );
            
            // 4. Cotizaciones (Exacta)
            promises.push(
                supabase.from('cotizaciones')
                    .select('id, numero, total, contactos!inner(nombre)')
                    .eq('numero', parseInt(query, 10))
                    .limit(5)
                    .then(res => ({ type: 'cotizaciones', data: res.data || [] }))
                    .catch(() => ({ type: 'cotizaciones', data: [] }))
            );
        }

        const results = await Promise.all(promises);
        this.displayResults(input, results);
    },

    displayResults(input, results) {
        let html = '';
        let totalCount = 0;

        results.forEach(group => {
            if (group.data && group.data.length > 0) {
                totalCount += group.data.length;
                let title = '';
                let itemsHtml = '';

                switch (group.type) {
                    case 'contactos':
                        title = 'Contactos';
                        itemsHtml = group.data.map(item => `
                            <a href="#/contactos/ver/${item.id}" class="dropdown-item py-2 gs-result-link px-3 text-wrap" style="white-space: normal;">
                                <div class="fw-medium text-dark" style="font-size: 13px;">${item.nombre}</div>
                                <div class="text-muted" style="font-size: 11px;">NIT: ${item.identificacion || 'N/A'}</div>
                            </a>
                        `).join('');
                        break;
                    case 'productos':
                        title = 'Productos';
                        itemsHtml = group.data.map(item => `
                            <a href="#/inventario/items/ver/${item.id}" class="dropdown-item py-2 gs-result-link px-3 text-wrap" style="white-space: normal;">
                                <div class="fw-medium text-dark" style="font-size: 13px;">${item.nombre}</div>
                                <div class="text-muted" style="font-size: 11px;">SKU: ${item.sku || 'N/A'}</div>
                            </a>
                        `).join('');
                        break;
                    case 'facturas':
                        title = 'Facturas';
                        itemsHtml = group.data.map(item => {
                            const esCompra = item.tipo === 'compra';
                            const hash = esCompra ? `#/gastos/proveedores/ver/${item.id}` : `#/ingresos/facturas/ver/${item.id}`;
                            const badge = esCompra ? 'Compra' : 'Venta';
                            return `
                                <a href="${hash}" class="dropdown-item py-2 gs-result-link px-3 text-wrap" style="white-space: normal;">
                                    <div class="fw-medium text-dark" style="font-size: 13px;">Factura de ${badge} #${item.numero}</div>
                                    <div class="text-muted" style="font-size: 11px;">${item.contactos?.nombre || 'Sin cliente'} - $${Number(item.total).toLocaleString()}</div>
                                </a>
                            `;
                        }).join('');
                        break;
                    case 'cotizaciones':
                        title = 'Cotizaciones';
                        itemsHtml = group.data.map(item => `
                            <a href="#/ingresos/cotizaciones/ver/${item.id}" class="dropdown-item py-2 gs-result-link px-3 text-wrap" style="white-space: normal;">
                                <div class="fw-medium text-dark" style="font-size: 13px;">Cotización #${item.numero}</div>
                                <div class="text-muted" style="font-size: 11px;">${item.contactos?.nombre || 'Sin cliente'} - $${Number(item.total).toLocaleString()}</div>
                            </a>
                        `).join('');
                        break;
                }

                html += `
                    <div class="px-3 py-1 bg-light border-bottom border-top" style="margin-top: -1px;">
                        <small class="fw-bold text-muted" style="font-size: 10px; text-transform: uppercase;">${title}</small>
                    </div>
                    ${itemsHtml}
                `;
            }
        });

        if (totalCount === 0) {
            html = '<div class="p-3 text-center text-muted small">Sin resultados</div>';
        }

        this.renderDropdown(input, html);

        // Bind clicks to clear input and close dropdown
        const links = document.querySelectorAll('.gs-result-link');
        links.forEach(l => {
            l.addEventListener('click', () => {
                this.closeDropdown();
                input.value = '';
            });
        });
    },

    renderDropdown(input, htmlContent) {
        let dropdown = document.getElementById('global-search-results');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'global-search-results';
            // Custom styling to ensure it sits nicely under the input
            dropdown.className = 'position-absolute bg-white shadow-sm rounded border overflow-hidden';
            dropdown.style.top = '100%';
            dropdown.style.left = '0';
            dropdown.style.width = '100%';
            dropdown.style.minWidth = '300px';
            dropdown.style.zIndex = '1060';
            dropdown.style.maxHeight = '400px';
            dropdown.style.overflowY = 'auto';
            dropdown.style.marginTop = '6px';
            input.parentElement.appendChild(dropdown);
        }
        dropdown.innerHTML = htmlContent;
        dropdown.style.display = 'block';
    },

    closeDropdown() {
        const dropdown = document.getElementById('global-search-results');
        if (dropdown) dropdown.style.display = 'none';
    },
    
    clear() {
        const input = document.getElementById('global-search');
        if (input) input.value = '';
        this.closeDropdown();
    }
};
