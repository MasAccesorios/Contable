// js/modules/inventario/ajustes.events.js
// Manejo de Eventos de DOM, Interacciones Ergonómicas, Drawer Lateral 360° y Exportación

import { AjustesData } from './ajustes.data.js';

export const AjustesEvents = {
    debounceTimer: null,
    escapeListener: null,

    bindEvents(module) {
        const el = module.element;
        if (!el) return;

        // 1. Selector de Pestañas (Segmented Control - .payment-tab-btn)
        el.querySelectorAll('.payment-tab-btn, .tab-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetBtn = e.currentTarget;
                const tab = targetBtn.dataset.tab;
                if (!tab || tab === module.state.currentTab) return;

                module.state.currentTab = tab;
                module.state.currentPage = 1;

                // Actualizar clases activas en botones según estándar de Gastos Operativos
                el.querySelectorAll('.payment-tab-btn, .tab-filter-btn').forEach(b => {
                    if (b.dataset.tab === tab) {
                        b.classList.add('active');
                    } else {
                        b.classList.remove('active');
                    }
                });

                module.actualizarGrilla();
            });
        });

        // 2. Buscador en Tiempo Real con Debounce (250ms)
        const searchInput = el.querySelector('#search-ajustes');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                if (this.debounceTimer) clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    module.state.searchQuery = (e.target.value || '').trim();
                    module.state.currentPage = 1;
                    module.actualizarGrilla();
                }, 250);
            });
        }

        // 3. Botón de Limpiar Búsqueda
        el.querySelector('#btn-clear-search')?.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            module.state.searchQuery = '';
            module.state.currentPage = 1;
            module.actualizarGrilla();
        });

        // 4. Botón Refrescar
        el.querySelector('#btn-refresh-ajustes')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span>`;
            try {
                await module.cargarDatos();
            } finally {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        });

        // 5. Botón Exportar a Excel
        el.querySelector('#btn-export-excel')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            await this.ejecutarExportacionExcel(module, btn);
        });

        // 6. Cerrar Drawer por clic en backdrop
        const backdrop = el.querySelector('#drawer-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => this.cerrarDrawer(module));
        }

        // 7. Cerrar Drawer con tecla Escape
        if (this.escapeListener) {
            document.removeEventListener('keydown', this.escapeListener);
        }
        this.escapeListener = (e) => {
            if (e.key === 'Escape' && module.state.isDrawerOpen) {
                this.cerrarDrawer(module);
            }
        };
        document.addEventListener('keydown', this.escapeListener);
    },

    bindGridEvents(module) {
        const el = module.element;
        if (!el) return;

        // Clic en fila de ajuste para abrir drawer 360°
        el.querySelectorAll('.ajuste-row-item').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('a')) return;
                const id = row.dataset.id;
                if (id) this.abrirDrawer(module, id);
            });
        });

        // Clic en botón específico de abrir drawer
        el.querySelectorAll('.btn-open-drawer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (id) this.abrirDrawer(module, id);
            });
        });

        // Botón de resetear filtros cuando la búsqueda está vacía
        el.querySelector('#btn-reset-filters')?.addEventListener('click', () => {
            const searchInput = el.querySelector('#search-ajustes');
            if (searchInput) searchInput.value = '';
            module.state.searchQuery = '';
            module.state.currentTab = 'todas';
            module.state.currentPage = 1;
            module.actualizarGrilla();
        });

        // Paginación
        el.querySelectorAll('.btn-pagination-nav').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(btn.dataset.page, 10);
                if (page && page > 0 && page !== module.state.currentPage) {
                    module.state.currentPage = page;
                    module.actualizarGrilla();
                }
            });
        });
    },

    abrirDrawer(module, ajusteId) {
        const el = module.element;
        if (!el) return;

        const ajuste = (module.state.todosAjustes || []).find(a => String(a.id) === String(ajusteId));
        if (!ajuste) return;

        const drawerContainer = el.querySelector('#drawer-content-container');
        const drawerRoot = el.querySelector('#ajustes-drawer');
        const backdrop = el.querySelector('#drawer-backdrop');

        if (drawerContainer && drawerRoot) {
            drawerContainer.innerHTML = module.templates.renderDrawerContent(ajuste);
            drawerRoot.classList.add('show');
            if (backdrop) backdrop.classList.add('show');
            module.state.isDrawerOpen = true;

            // Vincular botones de cerrar dentro del drawer
            drawerContainer.querySelectorAll('.btn-close-drawer').forEach(b => {
                b.addEventListener('click', () => this.cerrarDrawer(module));
            });
        }
    },

    cerrarDrawer(module) {
        const el = module.element;
        if (!el) return;
        const drawerRoot = el.querySelector('#ajustes-drawer');
        const backdrop = el.querySelector('#drawer-backdrop');
        if (drawerRoot) {
            drawerRoot.classList.remove('show');
        }
        if (backdrop) {
            backdrop.classList.remove('show');
        }
        module.state.isDrawerOpen = false;
    },

    async ejecutarExportacionExcel(module, btn) {
        if (!btn) return;
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Exportando...`;

        try {
            // Filtrar ítems actuales
            const filtrados = AjustesData.filtrarAjustes(module.state.todosAjustes || [], {
                tab: module.state.currentTab || 'todas',
                query: module.state.searchQuery || ''
            });

            if (filtrados.length === 0) {
                if (typeof alert === 'function') alert('No hay ajustes para exportar con el filtro actual.');
                return;
            }

            const rowsToExport = AjustesData.mapearAjustesParaExport(filtrados);
            const dateStr = new Date().toISOString().split('T')[0];
            const tabName = module.state.currentTab || 'todas';
            const filename = `Ajustes_Inventario_${tabName}_${dateStr}.xlsx`;

            if (typeof window !== 'undefined' && window.XLSX) {
                const ws = window.XLSX.utils.json_to_sheet(rowsToExport);

                // Auto-ancho de columnas
                const colKeys = Object.keys(rowsToExport[0]);
                ws['!cols'] = colKeys.map(k => ({
                    wch: Math.max(k.length + 3, ...rowsToExport.slice(0, 50).map(r => String(r[k] ?? '').length + 2))
                }));

                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, 'Ajustes');
                window.XLSX.writeFile(wb, filename);
            } else if (typeof document !== 'undefined') {
                // Fallback CSV con delimitador ";" y BOM UTF-8
                const headers = Object.keys(rowsToExport[0]);
                let csv = headers.join(';') + '\r\n';
                rowsToExport.forEach(row => {
                    csv += headers.map(h => {
                        const raw = (row[h] !== null && row[h] !== undefined) ? String(row[h]) : '';
                        const escaped = raw.replace(/"/g, '""');
                        const isFormula = /^[=+\-@\t\r]/.test(escaped);
                        const isNumber = !isNaN(Number(raw)) && raw.trim() !== '';
                        return (isFormula && !isNumber) ? `"'${escaped}"` : `"${escaped}"`;
                    }).join(';') + '\r\n';
                });

                const BOM = '\uFEFF';
                const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename.replace('.xlsx', '.csv'));
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('[AjustesEvents] Error exportando ajustes:', err);
            if (typeof alert === 'function') alert('Ocurrió un error al exportar los ajustes de inventario.');
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    },

    cleanup() {
        if (this.escapeListener) {
            document.removeEventListener('keydown', this.escapeListener);
            this.escapeListener = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }
};
