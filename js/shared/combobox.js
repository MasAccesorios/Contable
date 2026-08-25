export const UI = {
    async fetchProductosCombobox(query) {
        const { supabase } = await import('../core/supabase.js');
        const { default: DB } = await import('../core/db.js');
        const { data, error } = await supabase.rpc('get_productos_page', {
            p_page: 1,
            p_limit: 20,
            p_sort_column: 'nombre',
            p_sort_direction: 'asc',
            p_search_query: query,
            p_filter_criteria: 'todos'
        });
        if (error) {
            console.error('Error fetching productos:', error);
            return [];
        }
        const productos = data?.[0]?.data || [];
        return productos.map(p => DB._mapToFrontend('productos', p));
    },

    async fetchFacturasCombobox(query) {
        const { supabase } = await import('../core/supabase.js');
        const { data, error } = await supabase.rpc('buscar_facturas_combobox', { query_text: query });
        if (error) {
            console.error('Error fetching facturas combobox:', error);
            return [];
        }
        return data || [];
    },


    /**
     * @param {Object} options
     * @param {HTMLElement} options.inputEl - The text input element
     * @param {HTMLElement} options.hiddenIdEl - The hidden input for the selected ID
     * @param {Array} options.items - Array of objects to search
     * @param {String} options.displayProp - Property name to display and search (e.g., 'nombre')
     * @param {Array} options.searchProps - Additional properties to search (e.g., ['nit'])
     * @param {Function} options.onSelect - Callback when item is selected
     * @param {Boolean} options.allowCreate - Whether to show the "+ Crear nuevo" option
     * @param {Function} options.onCreate - Callback when "+ Crear nuevo" is clicked
     */
    createCombobox({ inputEl, hiddenIdEl, items, displayProp, searchProps = [], onSelect, allowCreate = false, onCreate }) {
        if (!inputEl) return;

        // Idempotencia: Evitar duplicación de listeners y dropdowns
        if (inputEl.dataset.comboboxInit) {
            return; // Ya fue inicializado
        }
        inputEl.dataset.comboboxInit = 'true';

        // Remover dropdown existente si quedó residual en el DOM
        const existingDropdown = inputEl.parentElement.querySelector('.combobox-dropdown');
        if (existingDropdown) {
            existingDropdown.remove();
        }

        // Ensure container is relative for absolute positioning of dropdown
        if (getComputedStyle(inputEl.parentElement).position === 'static') {
            inputEl.parentElement.style.position = 'relative';
        }

        const dropdown = document.createElement('div');
        dropdown.className = 'combobox-dropdown shadow rounded bg-white';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            z-index: 1050;
            max-height: 250px;
            overflow-y: auto;
            display: none;
            border: 1px solid var(--border-color);
            margin-top: 4px;
        `;
        
        inputEl.parentElement.appendChild(dropdown);

        const normalizeText = (text) => {
            if (!text) return '';
            return text.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        };

        const renderResults = (query) => {
            const normQuery = normalizeText(query);
            
            let filtered = items;
            if (normQuery.length > 0) {
                filtered = items.filter(item => {
                    const matchDisplay = normalizeText(item[displayProp]).includes(normQuery);
                    const matchAdditional = searchProps.some(prop => normalizeText(item[prop]).includes(normQuery));
                    return matchDisplay || matchAdditional;
                });
            }

            let html = '';
            if (filtered.length > 0) {
                html += filtered.map(item => `
                    <div class="combobox-item p-2" style="cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: 13px;" data-id="${item.id}">
                        ${item[displayProp]}
                    </div>
                `).join('');
            } else {
                html += `<div class="p-2 text-muted small text-center">No hay resultados</div>`;
            }

            if (allowCreate) {
                html += `
                    <div class="combobox-create-item p-2 text-primary" style="cursor: pointer; font-size: 13px; font-weight: 500; border-top: 1px solid #e0e0e0; background-color: #f8f9fa;">
                        <i class="bi bi-plus-circle me-1"></i> + Crear nuevo contacto
                    </div>
                `;
            }

            dropdown.innerHTML = html;
            dropdown.style.display = 'block';

            // Event Listeners for items
            dropdown.querySelectorAll('.combobox-item').forEach(el => {
                el.addEventListener('mouseenter', () => el.style.backgroundColor = 'var(--primary-light, #e0f2f1)');
                el.addEventListener('mouseleave', () => el.style.backgroundColor = 'transparent');
                
                el.addEventListener('mousedown', (e) => {
                    // Prevent input blur
                    e.preventDefault();
                    
                    const id = el.dataset.id;
                    const selectedItem = items.find(i => String(i.id) === String(id));
                    
                    if (selectedItem) {
                        inputEl.value = selectedItem[displayProp];
                        if (hiddenIdEl) {
                            hiddenIdEl.value = selectedItem.id;
                            hiddenIdEl.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        if (onSelect) onSelect(selectedItem);
                    }
                    dropdown.style.display = 'none';
                });
            });

            // Event Listener for create button
            const btnCreate = dropdown.querySelector('.combobox-create-item');
            if (btnCreate) {
                btnCreate.addEventListener('mouseenter', () => btnCreate.style.backgroundColor = '#eef2f5');
                btnCreate.addEventListener('mouseleave', () => btnCreate.style.backgroundColor = '#f8f9fa');
                btnCreate.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    dropdown.style.display = 'none';
                    if (onCreate) onCreate(inputEl.value);
                });
            }
        };

        // Show dropdown on focus
        inputEl.addEventListener('focus', () => {
            renderResults(inputEl.value);
        });

        // Filter on input
        inputEl.addEventListener('input', (e) => {
            if (hiddenIdEl) {
                hiddenIdEl.value = ''; // Reset ID if user types manually
                hiddenIdEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            renderResults(e.target.value);
        });

        // Hide on blur
        inputEl.addEventListener('blur', () => {
            setTimeout(() => {
                dropdown.style.display = 'none';
            }, 150);
        });
        
        // Handle Keyboard Events
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dropdown.style.display = 'none';
                inputEl.blur();
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                if (dropdown.style.display === 'block') {
                    const normQuery = normalizeText(inputEl.value);
                    if (normQuery.length > 0) {
                        const optionElements = Array.from(dropdown.querySelectorAll('.combobox-item'));
                        if (optionElements.length > 0) {
                            let matchedEl = optionElements.find(el => normalizeText(el.innerText) === normQuery);
                            if (!matchedEl && optionElements.length > 0) {
                                matchedEl = optionElements[0];
                            }
                            
                            if (matchedEl) {
                                if (e.key === 'Enter') e.preventDefault(); // Evitar submit del form
                                const id = matchedEl.dataset.id;
                                const selectedItem = items.find(i => String(i.id) === String(id));
                                
                                if (selectedItem) {
                                    inputEl.value = selectedItem[displayProp];
                                    if (hiddenIdEl) {
                                        hiddenIdEl.value = selectedItem.id;
                                        hiddenIdEl.dispatchEvent(new Event('change', { bubbles: true }));
                                    }
                                    if (onSelect) onSelect(selectedItem);
                                }
                            }
                        }
                    }
                    dropdown.style.display = 'none';
                }
            }
        });
    },

    /**
     * @param {Object} options
     * @param {HTMLElement} options.inputEl - The text input element
     * @param {HTMLElement} options.hiddenIdEl - The hidden input for the selected ID
     * @param {Function} options.fetchItems - Async function that takes a query string and returns an array of items
     * @param {String} options.displayProp - Property name to display in the input (e.g., 'nombre')
     * @param {Function} options.renderItem - Optional custom render function for each item in the list
     * @param {Function} options.onSelect - Callback when item is selected
     * @param {Boolean} options.allowCreate - Whether to show the "+ Crear nuevo" option
     * @param {Function} options.onCreate - Callback when "+ Crear nuevo" is clicked
     */
    createAsyncCombobox({ inputEl, hiddenIdEl, fetchItems, displayProp, renderItem, onSelect, allowCreate = false, onCreate }) {
        if (!inputEl) return;

        if (inputEl.dataset.comboboxInit) return;
        inputEl.dataset.comboboxInit = 'true';

        const existingDropdown = inputEl.parentElement.querySelector('.combobox-dropdown');
        if (existingDropdown) existingDropdown.remove();

        if (getComputedStyle(inputEl.parentElement).position === 'static') {
            inputEl.parentElement.style.position = 'relative';
        }

        const dropdown = document.createElement('div');
        dropdown.className = 'combobox-dropdown shadow rounded bg-white';
        dropdown.style.cssText = `
            position: absolute; top: 100%; left: 0; right: 0; z-index: 1050;
            max-height: 250px; overflow-y: auto; display: none;
            border: 1px solid var(--border-color); margin-top: 4px;
        `;
        inputEl.parentElement.appendChild(dropdown);

        let debounceTimer;
        let lastQuery = null;

        const renderResults = async (query) => {
            if (query === lastQuery && dropdown.style.display === 'block') return;
            lastQuery = query;

            dropdown.innerHTML = `<div class="p-2 text-muted small text-center"><span class="spinner-border spinner-border-sm me-2" role="status"></span>Buscando...</div>`;
            dropdown.style.display = 'block';

            try {
                const items = await fetchItems(query);
                let itemsMap = {};
                let html = '';
                
                if (items && items.length > 0) {
                    html += items.map(item => {
                        itemsMap[item.id] = item;
                        return `
                        <div class="combobox-item p-2" style="cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: 13px;" data-id="${item.id}">
                            ${renderItem ? renderItem(item) : item[displayProp]}
                        </div>
                        `;
                    }).join('');
                } else {
                    html += `<div class="p-2 text-muted small text-center">No hay resultados</div>`;
                }

                if (allowCreate) {
                    html += `
                        <div class="combobox-create-item p-2 text-primary" style="cursor: pointer; font-size: 13px; font-weight: 500; border-top: 1px solid #e0e0e0; background-color: #f8f9fa;">
                            <i class="bi bi-plus-circle me-1"></i> + Crear nuevo
                        </div>
                    `;
                }

                dropdown.innerHTML = html;

                dropdown.querySelectorAll('.combobox-item').forEach(el => {
                    el.addEventListener('mouseenter', () => el.style.backgroundColor = 'var(--primary-light, #e0f2f1)');
                    el.addEventListener('mouseleave', () => el.style.backgroundColor = 'transparent');
                    el.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        const selectedItem = itemsMap[el.dataset.id];
                        if (selectedItem) {
                            inputEl.value = selectedItem[displayProp];
                            if (hiddenIdEl) {
                                hiddenIdEl.value = selectedItem.id;
                                hiddenIdEl.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            if (onSelect) onSelect(selectedItem);
                        }
                        dropdown.style.display = 'none';
                    });
                });

                const btnCreate = dropdown.querySelector('.combobox-create-item');
                if (btnCreate) {
                    btnCreate.addEventListener('mouseenter', () => btnCreate.style.backgroundColor = '#eef2f5');
                    btnCreate.addEventListener('mouseleave', () => btnCreate.style.backgroundColor = '#f8f9fa');
                    btnCreate.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        dropdown.style.display = 'none';
                        if (onCreate) onCreate(inputEl.value);
                    });
                }
            } catch (error) {
                console.error("Error combobox async:", error);
                dropdown.innerHTML = `<div class="p-2 text-danger small text-center">Error en búsqueda</div>`;
            }
        };

        inputEl.addEventListener('focus', () => renderResults(inputEl.value));
        inputEl.addEventListener('input', (e) => {
            if (hiddenIdEl) {
                hiddenIdEl.value = ''; 
                hiddenIdEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => renderResults(e.target.value), 300);
        });
        inputEl.addEventListener('blur', () => setTimeout(() => dropdown.style.display = 'none', 200));
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dropdown.style.display = 'none';
                inputEl.blur();
            }
        });
    }
};
