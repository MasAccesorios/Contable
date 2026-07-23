export const UI = {
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
        
        // Hide on Escape
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dropdown.style.display = 'none';
                inputEl.blur();
            }
        });
    }
};
