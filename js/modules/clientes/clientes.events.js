import DB from '../../core/db.js';

export const ContactosEvents = {
    bindEvents() {
        const el = this.element;
        let _searchTimer = null;

        el.querySelector('#btn-nuevo-contacto')?.addEventListener('click', () => this.renderForm());

        el.querySelector('#btn-refresh-list')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`;
            await this.cargarPagina();
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        });

        // Buscador con debounce 350ms
        const searchInput = el.querySelector('#search-contacto');
        const clearBtn = el.querySelector('#clearSearchBtnContactos');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                if (clearBtn) clearBtn.style.display = e.target.value ? 'block' : 'none';
                clearTimeout(_searchTimer);
                _searchTimer = setTimeout(() => {
                    this.state.searchQuery = e.target.value.toLowerCase().trim();
                    this.state.currentPage = 1;
                    this.cargarPagina();
                }, 350);
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                }
                clearBtn.style.display = 'none';
                this.state.searchQuery = '';
                this.state.currentPage = 1;
                this.cargarPagina();
            });
        }

        el.querySelectorAll('.nav-link[data-filter]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                el.querySelectorAll('.nav-link').forEach(t => {
                    t.classList.remove('active', 'text-dark');
                    t.classList.add('text-muted');
                    t.style.borderBottomColor = 'transparent';
                });
                e.target.classList.add('active', 'text-dark');
                e.target.classList.remove('text-muted');
                e.target.style.borderBottomColor = 'var(--primary)';

                this.state.currentFilter = e.target.dataset.filter;
                this.state.currentPage = 1;
                this.cargarPagina();
            });
        });

        el.querySelector('#items-per-page')?.addEventListener('change', (e) => {
            this.state.itemsPerPage = parseInt(e.target.value);
            this.state.currentPage = 1;
            this.cargarPagina();
        });

        el.querySelector('#btn-prev-page')?.addEventListener('click', () => {
            if (this.state.currentPage > 1) {
                this.state.currentPage--;
                this.cargarPagina();
            }
        });

        el.querySelector('#btn-next-page')?.addEventListener('click', () => {
            const totalPages = Math.ceil(this.state.totalCount / this.state.itemsPerPage) || 1;
            if (this.state.currentPage < totalPages) {
                this.state.currentPage++;
                this.cargarPagina();
            }
        });

        el.querySelector('#btn-refresh')?.addEventListener('click', async (e) => {
            const icon = e.currentTarget.querySelector('i');
            if (icon) icon.classList.add('spin-animation');
            await this.cargarPagina();
            if (icon) {
                if (window._clientesRefreshTimeout) clearTimeout(window._clientesRefreshTimeout);
                window._clientesRefreshTimeout = setTimeout(() => {
                    if (document.body.contains(icon)) icon.classList.remove('spin-animation');
                }, 500);
            }
        });
    },

    bindFilaEvents() {
        const container = this.element.querySelector('#tbody-contactos');
        if(!container) return;

        container.querySelectorAll('.btn-ver').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.renderDetalle(e.currentTarget.dataset.id);
            });
        });
        container.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.renderForm(e.currentTarget.dataset.id);
            });
        });
        container.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('¿Está seguro de desactivar este contacto? Ya no aparecerá en los listados activos, pero se conservará su historial de facturación.')) {
                    await DB.save('contactos', { id: e.currentTarget.dataset.id, estado: 'inactive' });
                    this.cargarPagina();
                }
            });
        });
    },
};
