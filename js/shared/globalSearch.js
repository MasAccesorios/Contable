import { supabase } from '../core/supabase.js';
import { escapeHtml } from './formatters.js';

const FREQ_STORAGE_KEY = 'gs_busquedas_frecuentes';
const MAX_STORED = 30;
const MAX_SHOWN = 6;

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

        input.addEventListener('focus', () => {
            if (input.value.trim().length === 0) {
                this.renderFrecuentes(input);
            }
        });

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(debounceTimer);

            if (query.length < 2) {
                if (query.length === 0) {
                    this.renderFrecuentes(input);
                } else {
                    this.closeDropdown();
                }
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

    // ─── Búsquedas frecuentes (guardadas en localStorage del navegador) ───────

    getFrecuentes() {
        try {
            return JSON.parse(localStorage.getItem(FREQ_STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    },

    registrarBusquedaExitosa(query) {
        const key = query.trim().toLowerCase();
        if (!key) return;

        const frecuentes = this.getFrecuentes();
        frecuentes[key] = (frecuentes[key] || 0) + 1;

        // Si crece demasiado, conservar solo las más frecuentes
        const entries = Object.entries(frecuentes);
        if (entries.length > MAX_STORED) {
            entries.sort((a, b) => b[1] - a[1]);
            const recortado = Object.fromEntries(entries.slice(0, MAX_STORED));
            localStorage.setItem(FREQ_STORAGE_KEY, JSON.stringify(recortado));
        } else {
            localStorage.setItem(FREQ_STORAGE_KEY, JSON.stringify(frecuentes));
        }
    },

    eliminarFrecuente(query) {
        const frecuentes = this.getFrecuentes();
        delete frecuentes[query];
        localStorage.setItem(FREQ_STORAGE_KEY, JSON.stringify(frecuentes));
    },

    limpiarFrecuentes() {
        localStorage.removeItem(FREQ_STORAGE_KEY);
    },

    renderFrecuentes(input) {
        const frecuentes = this.getFrecuentes();
        const top = Object.entries(frecuentes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX_SHOWN);

        if (top.length === 0) {
            this.closeDropdown();
            return;
        }

        const itemsHtml = top.map(([query]) => `
            <div class="dropdown-item py-2 gs-frecuente-item px-3 d-flex align-items-center justify-content-between gap-2">
                <a href="javascript:void(0)" class="gs-frecuente-link flex-grow-1 d-flex align-items-center gap-2 text-decoration-none text-dark" data-query="${escapeHtml(query)}" style="min-width: 0;">
                    <i class="bi bi-clock-history text-muted" style="font-size: 12px;"></i>
                    <span style="font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(query)}</span>
                </a>
                <button type="button" class="btn btn-sm btn-link text-muted p-0 gs-frecuente-borrar" data-query="${escapeHtml(query)}" title="Quitar de frecuentes" style="line-height: 1;">
                    <i class="bi bi-x-lg" style="font-size: 11px;"></i>
                </button>
            </div>
        `).join('');

        const html = `
            <div class="px-3 py-1 bg-light border-bottom d-flex justify-content-between align-items-center" style="margin-top: -1px;">
                <small class="fw-bold text-muted" style="font-size: 10px; text-transform: uppercase;">Búsquedas frecuentes</small>
                <a href="javascript:void(0)" class="gs-frecuente-limpiar-todo text-muted text-decoration-none" style="font-size: 10px;">Borrar historial</a>
            </div>
            ${itemsHtml}
        `;

        this.renderDropdown(input, html);

        document.querySelectorAll('.gs-frecuente-link').forEach(l => {
            l.addEventListener('click', (e) => {
                e.preventDefault();
                const query = l.getAttribute('data-query');
                input.value = query;
                this.performSearch(query, input, true);
            });
        });

        document.querySelectorAll('.gs-frecuente-borrar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.eliminarFrecuente(btn.getAttribute('data-query'));
                this.renderFrecuentes(input);
            });
        });

        const btnLimpiarTodo = document.querySelector('.gs-frecuente-limpiar-todo');
        if (btnLimpiarTodo) {
            btnLimpiarTodo.addEventListener('click', (e) => {
                e.stopPropagation();
                this.limpiarFrecuentes();
                this.closeDropdown();
            });
        }
    },

    async performSearch(query, input, autoNavigate = false) {
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
                .catch(err => { console.error('[GlobalSearch] Error buscando contactos:', err); return { type: 'contactos', data: [] }; })
        );

        // 2. Productos (Parcial)
        promises.push(
            supabase.from('productos')
                .select('id, nombre, sku')
                .or(`nombre.ilike.%${query}%,sku.ilike.%${query}%`)
                .limit(5)
                .then(res => ({ type: 'productos', data: res.data || [] }))
                .catch(err => { console.error('[GlobalSearch] Error buscando productos:', err); return { type: 'productos', data: [] }; })
        );

        // 3. Facturas (Exacta)
        if (isNum) {
            promises.push(
                supabase.from('facturas')
                    .select('id, numero, total, tipo, contactos!inner(nombre)')
                    .eq('numero', parseInt(query, 10))
                    .limit(5)
                    .then(res => ({ type: 'facturas', data: res.data || [] }))
                    .catch(err => { console.error('[GlobalSearch] Error buscando facturas:', err); return { type: 'facturas', data: [] }; })
            );
            
            // 4. Cotizaciones (Exacta)
            promises.push(
                supabase.from('cotizaciones')
                    .select('id, numero, total, contactos!inner(nombre)')
                    .eq('numero', parseInt(query, 10))
                    .limit(5)
                    .then(res => ({ type: 'cotizaciones', data: res.data || [] }))
                    .catch(err => { console.error('[GlobalSearch] Error buscando cotizaciones:', err); return { type: 'cotizaciones', data: [] }; })
            );
        }

        const results = await Promise.all(promises);
        
        if (autoNavigate) {
            let totalCount = 0;
            let singleResult = null;
            let singleResultType = null;

            results.forEach(group => {
                if (group.data && group.data.length > 0) {
                    totalCount += group.data.length;
                    if (totalCount === 1) {
                        singleResult = group.data[0];
                        singleResultType = group.type;
                    }
                }
            });

            if (totalCount === 1 && singleResult) {
                let hash = '';
                switch (singleResultType) {
                    case 'contactos':
                        hash = `#/contactos/ver/${singleResult.id}`;
                        break;
                    case 'productos':
                        hash = `#/inventario/items/ver/${singleResult.id}`;
                        break;
                    case 'facturas':
                        hash = singleResult.tipo === 'compra' ? `#/gastos/proveedores/ver/${singleResult.id}` : `#/ingresos/facturas/ver/${singleResult.id}`;
                        break;
                    case 'cotizaciones':
                        hash = `#/ingresos/cotizaciones/ver/${singleResult.id}`;
                        break;
                }

                if (hash) {
                    this.registrarBusquedaExitosa(query);
                    this.closeDropdown();
                    input.value = '';
                    window.location.hash = hash.substring(1);
                    return;
                }
            }
        }

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
                            <a href="#/contactos/ver/${item.id}" class="dropdown-item py-2 gs-result-link px-3 text-wrap" style="white-space: normal;" data-registrar="${escapeHtml(item.nombre)}">
                                <div class="fw-medium text-dark" style="font-size: 13px;">${item.nombre}</div>
                                <div class="text-muted" style="font-size: 11px;">NIT: ${item.identificacion || 'N/A'}</div>
                            </a>
                        `).join('');
                        break;
                    case 'productos':
                        title = 'Productos';
                        itemsHtml = group.data.map(item => `
                            <a href="#/inventario/items/ver/${item.id}" class="dropdown-item py-2 gs-result-link px-3 text-wrap" style="white-space: normal;" data-registrar="${escapeHtml(item.nombre)}">
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
                            const label = `Factura de ${badge} #${item.numero}`;
                            return `
                                <a href="${hash}" class="dropdown-item py-2 gs-result-link px-3 text-wrap" style="white-space: normal;" data-registrar="${escapeHtml(label)}">
                                    <div class="fw-medium text-dark" style="font-size: 13px;">${label}</div>
                                    <div class="text-muted" style="font-size: 11px;">${item.contactos?.nombre || 'Sin cliente'} - $${Number(item.total).toLocaleString()}</div>
                                </a>
                            `;
                        }).join('');
                        break;
                    case 'cotizaciones':
                        title = 'Cotizaciones';
                        itemsHtml = group.data.map(item => {
                            const label = `Cotización #${item.numero}`;
                            return `
                            <a href="#/ingresos/cotizaciones/ver/${item.id}" class="dropdown-item py-2 gs-result-link px-3 text-wrap" style="white-space: normal;" data-registrar="${escapeHtml(label)}">
                                <div class="fw-medium text-dark" style="font-size: 13px;">${label}</div>
                                <div class="text-muted" style="font-size: 11px;">${item.contactos?.nombre || 'Sin cliente'} - $${Number(item.total).toLocaleString()}</div>
                            </a>
                        `;
                        }).join('');
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
            l.addEventListener('click', (e) => {
                e.preventDefault();
                this.registrarBusquedaExitosa(l.dataset.registrar || input.value);
                this.closeDropdown();
                input.value = '';
                
                const targetHref = l.getAttribute('href');
                if (targetHref) {
                    if (targetHref.startsWith('#')) {
                        window.location.hash = targetHref.substring(1);
                    } else {
                        window.location.href = targetHref;
                    }
                }
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
