/**
 * SearchableSelect - A premium, accessible, and fast searchable dropdown component.
 * Author: Antigravity
 */
class SearchableSelect {
    constructor(elementId, options = {}) {
        this.container = document.getElementById(elementId);
        if (!this.container) return;

        this.onSelect = options.onSelect || (() => { });
        this.placeholder = options.placeholder || 'Buscar...';
        this.data = options.data || []; // Array of {id, text, reference}
        this.value = options.value || null;
        this.isOpen = false;
        this.selectedIndex = -1;
        this.filteredData = [];

        this._init();
    }

    _init() {
        this.container.classList.add('searchable-select-container');
        this.container.innerHTML = `
            <div class="ss-input-wrapper">
                <input type="text" class="ss-input" placeholder="${this.placeholder}" autocomplete="off">
                <i class="bi bi-chevron-down ss-icon"></i>
            </div>
            <div class="ss-dropdown d-none">
                <div class="ss-results"></div>
            </div>
        `;

        this.input = this.container.querySelector('.ss-input');
        this.dropdown = this.container.querySelector('.ss-dropdown');
        this.results = this.container.querySelector('.ss-results');

        this._bindEvents();
    }

    _bindEvents() {
        this.input.addEventListener('focus', () => this.open());
        this.input.addEventListener('input', () => this.filter());

        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this._moveSelection(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this._moveSelection(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this._selectCurrent();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });
    }

    setData(data) {
        this.data = data;
        if (this.isOpen) this.filter();
    }

    setValue(id) {
        const item = this.data.find(d => d.id === id);
        if (item) {
            this.value = id;
            this.input.value = item.text;
            this.close();
        } else {
            this.clear();
        }
    }

    getValue() {
        return this.value;
    }

    clear() {
        this.value = null;
        this.input.value = '';
        this.close();
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.dropdown.classList.remove('d-none');
        this.container.classList.add('active');
        this.filter();
    }

    close() {
        this.isOpen = false;
        this.dropdown.classList.add('d-none');
        this.container.classList.remove('active');
        this.selectedIndex = -1;

        // Reset input to current selection text if closed without selecting
        const current = this.data.find(d => d.id === this.value);
        if (current) {
            this.input.value = current.text;
        } else if (!this.value) {
            this.input.value = '';
        }
    }

    filter() {
        const term = this.input.value.toLowerCase().trim();
        const tokens = term ? term.split(/\s+/) : [];

        // Custom search algorithm: Priority to Reference
        const referenceMatches = [];
        const textMatches = [];

        this.data.forEach(item => {
            const ref = String(item.reference || '').toLowerCase();
            const text = String(item.text || '').toLowerCase();

            if (term === '') {
                textMatches.push(item);
                return;
            }

            if (ref.startsWith(term)) {
                referenceMatches.push(item);
            } else if (ref.includes(term)) {
                referenceMatches.push(item); // Partial ref matches
            } else if (tokens.every(t => text.includes(t) || ref.includes(t))) {
                textMatches.push(item);
            }
        });

        this.filteredData = [...referenceMatches, ...textMatches].slice(0, 500); // Increased limit to ensure all items are visible
        this._renderResults();
    }

    _renderResults() {
        if (this.filteredData.length === 0) {
            this.results.innerHTML = `<div class="ss-no-results">No se encontraron resultados</div>`;
            return;
        }

        this.results.innerHTML = this.filteredData.map((item, index) => `
            <div class="ss-item ${index === this.selectedIndex ? 'selected' : ''}" data-id="${item.id}" data-index="${index}">
                <span class="ss-ref">${item.reference ? '[' + item.reference + ']' : ''}</span>
                <span class="ss-text">${item.text}</span>
            </div>
        `).join('');

        this.results.querySelectorAll('.ss-item').forEach(el => {
            el.addEventListener('click', () => {
                this._selectItem(parseInt(el.dataset.index));
            });
        });
    }

    _moveSelection(direction) {
        if (!this.isOpen) {
            this.open();
            return;
        }

        this.selectedIndex += direction;
        if (this.selectedIndex < 0) this.selectedIndex = this.filteredData.length - 1;
        if (this.selectedIndex >= this.filteredData.length) this.selectedIndex = 0;

        this._renderResults();

        // Scroll into view
        const selectedEl = this.results.querySelector('.selected');
        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest' });
        }
    }

    _selectCurrent() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredData.length) {
            this._selectItem(this.selectedIndex);
        }
    }

    _selectItem(index) {
        const item = this.filteredData[index];
        this.value = item.id;
        this.input.value = item.text;
        this.onSelect(item);
        this.close();
    }
}
