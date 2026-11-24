// js/modules/inventario/categorias/categorias.events.js
// Manejador de Eventos e Interacciones para Categorías Contables
// MAS Accesorios - Sistema Contable

import { CategoriasData } from './categorias.data.js';
import { CategoriasTemplates, escapeHtml } from './categorias.templates.js';
import { supabase } from '../../../core/supabase.js';

export const CategoriasEvents = {
    module: null,
    element: null,
    activeMenuEl: null,
    modalInstance: null,

    /**
     * Vincula todos los eventos del módulo.
     */
    bind(element, moduleInstance) {
        this.element = element;
        this.module = moduleInstance;
        this.cleanupFloatingMenu();

        // 1. Botón Actualizar (Recarga en caliente sin refrescar página completa)
        element.querySelector('#btn-actualizar-categorias')?.addEventListener('click', async () => {
            const icon = element.querySelector('#icon-actualizar-categorias');
            if (icon) icon.classList.add('bi-spin');
            try {
                await this.module.recargarDatos(true);
            } finally {
                if (icon) icon.classList.remove('bi-spin');
            }
        });

        // 2. Botón Nueva Categoría
        element.querySelector('#btn-nueva-categoria')?.addEventListener('click', () => {
            this.abrirModalCrear();
        });

        // 3. Botón Exportar
        element.querySelector('#btn-exportar-categorias')?.addEventListener('click', () => {
            this.exportarDatos();
        });

        // 4. Tabs de filtrado rápido
        element.querySelectorAll('.payment-tab-btn').forEach(tabBtn => {
            tabBtn.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.getAttribute('data-tab') || 'todas';
                this.cambiarTab(targetTab);
            });
        });

        // 5. Buscador en tiempo real con debounce
        const searchInput = element.querySelector('#search-categorias');
        let searchTimeout = null;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.module.state.searchQuery = e.target.value || '';
                this.actualizarTablaFiltrada();
            }, 150);
        });

        // Botón limpiar búsqueda
        element.querySelector('#btn-clear-search')?.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                this.module.state.searchQuery = '';
                this.actualizarTablaFiltrada();
            }
        });

        // 6. Delegación de eventos para la tabla (Kebab Menú de 3 puntos)
        const tbody = element.querySelector('#tbody-categorias');
        tbody?.addEventListener('click', (e) => {
            const btnMenu = e.target.closest('.btn-cat-action-menu');
            if (btnMenu) {
                e.stopPropagation();
                this.toggleFloatingMenu(btnMenu);
            }
        });

        // 7. Cierre de menú flotante al hacer clic fuera o presionar Escape
        document.addEventListener('click', (e) => {
            if (this.activeMenuEl && !this.activeMenuEl.contains(e.target)) {
                this.cleanupFloatingMenu();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cleanupFloatingMenu();
            }
        });
    },

    /**
     * Cambia de pestaña activa y actualiza la tabla.
     */
    cambiarTab(tabName) {
        this.module.state.selectedTab = tabName;

        // Actualizar UI de tabs
        this.element.querySelectorAll('.payment-tab-btn').forEach(btn => {
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.actualizarTablaFiltrada();
    },

    /**
     * Aplica los filtros de tab y búsqueda y re-renderiza exclusivamente el tbody.
     */
    actualizarTablaFiltrada() {
        const { categorias, conteoMovimientos, selectedTab, searchQuery } = this.module.state;
        const filtradas = CategoriasData.filtrarYBuscar(categorias, selectedTab, searchQuery);
        this.module.state.categoriasFiltradas = filtradas;

        const tbody = this.element.querySelector('#tbody-categorias');
        if (tbody) {
            tbody.innerHTML = CategoriasTemplates.renderTabla(filtradas, conteoMovimientos);
        }
    },

    /**
     * Abre el modal para crear una nueva categoría.
     */
    abrirModalCrear() {
        this.abrirModal(null);
    },

    /**
     * Abre el modal para editar una categoría existente.
     */
    abrirModalEditar(categoria) {
        this.abrirModal(categoria);
    },

    /**
     * Abre y vincula el modal de creación / edición.
     */
    abrirModal(categoria = null) {
        this.cleanupFloatingMenu();
        const container = this.element.querySelector('#container-modal-categoria') || document.body;
        container.innerHTML = CategoriasTemplates.renderModalForm(categoria);

        const modalEl = document.getElementById('modalCategoriaForm');
        if (!modalEl) return;

        // Soporte Bootstrap Modal o Fallback Manual
        if (window.bootstrap?.Modal) {
            this.modalInstance = new window.bootstrap.Modal(modalEl);
            this.modalInstance.show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
            modalEl.setAttribute('aria-modal', 'true');
            modalEl.removeAttribute('aria-hidden');

            // Backdrop
            let backdrop = document.getElementById('modal-cat-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.id = 'modal-cat-backdrop';
                backdrop.className = 'modal-backdrop fade show';
                document.body.appendChild(backdrop);
            }
            document.body.classList.add('modal-open');

            // Cerrar en data-bs-dismiss
            modalEl.querySelectorAll('[data-bs-dismiss="modal"]').forEach(b => {
                b.onclick = () => this.cerrarModal();
            });
        }

        // Listener de cambio de flujo interactivo (radio inputs)
        modalEl.querySelectorAll('input[name="radio-cat-flujo"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const flujo = e.target.value;
                const iconBadge = modalEl.querySelector('#modal-cat-icon-badge');
                const selectHidden = modalEl.querySelector('#select-cat-flujo');
                if (selectHidden) selectHidden.value = flujo;

                // Actualizar estilos visuales de las tarjetas de selección
                modalEl.querySelectorAll('input[name="radio-cat-flujo"]').forEach(r => {
                    const card = r.closest('label');
                    if (r.checked) {
                        card.className = `flex-grow-1 p-2.5 border rounded-3 d-flex align-items-center gap-2 cursor-pointer ${flujo === 'out' ? 'bg-danger bg-opacity-10 border-danger' : 'bg-success bg-opacity-10 border-success'}`;
                    } else {
                        card.className = 'flex-grow-1 p-2.5 border rounded-3 d-flex align-items-center gap-2 cursor-pointer bg-white';
                    }
                });

                if (iconBadge) {
                    iconBadge.className = `payment-kpi-icon ${flujo === 'in' ? 'in-bg' : 'out-bg'}`;
                }
            });
        });

        // Listener de Submit del Formulario
        const form = modalEl.querySelector('#form-guardar-categoria');
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.guardarCategoria(form);
        });

        // Foco automático en el campo de texto
        setTimeout(() => {
            modalEl.querySelector('#input-cat-nombre')?.focus();
        }, 120);
    },

    /**
     * Cierra el modal activo.
     */
    cerrarModal() {
        const modalEl = document.getElementById('modalCategoriaForm');
        if (this.modalInstance && typeof this.modalInstance.hide === 'function') {
            this.modalInstance.hide();
        } else if (modalEl) {
            modalEl.classList.remove('show');
            modalEl.style.display = 'none';
            document.getElementById('modal-cat-backdrop')?.remove();
            document.body.classList.remove('modal-open');
        }
        setTimeout(() => {
            modalEl?.remove();
            this.modalInstance = null;
        }, 200);
    },

    /**
     * Valida y persiste la categoría en Supabase.
     */
    async guardarCategoria(form) {
        const idVal = form.querySelector('#input-cat-id')?.value;
        const nombreVal = form.querySelector('#input-cat-nombre')?.value;
        const flujoVal = form.querySelector('input[name="radio-cat-flujo"]:checked')?.value || form.querySelector('#select-cat-flujo')?.value || 'out';
        const estadoVal = form.querySelector('#select-cat-estado')?.value || 'activa';
        const errorAlert = form.querySelector('#modal-cat-error');
        const submitBtn = form.querySelector('#btn-submit-cat');
        const spinner = form.querySelector('#spinner-cat-submit');
        const icon = form.querySelector('#icon-cat-submit');

        // Validación con CategoriasData
        const validacion = CategoriasData.validarCategoria(
            { nombre: nombreVal, tipo_flujo: flujoVal, estado: estadoVal },
            this.module.state.categorias,
            idVal || null
        );

        if (!validacion.valido) {
            if (errorAlert) {
                errorAlert.textContent = validacion.error;
                errorAlert.classList.remove('d-none');
            }
            return;
        }

        if (errorAlert) errorAlert.classList.add('d-none');

        // Estado de carga
        if (submitBtn) submitBtn.disabled = true;
        if (spinner) spinner.classList.remove('d-none');
        if (icon) icon.classList.add('d-none');

        try {
            const { categoriaLimpia } = validacion;

            if (idVal) {
                // Actualizar registro existente
                const { error } = await supabase
                    .from('categorias_contables')
                    .update(categoriaLimpia)
                    .eq('id', idVal);

                if (error) throw error;
                this.mostrarToast(`Categoría "${categoriaLimpia.nombre}" actualizada con éxito.`);
            } else {
                // Crear nuevo registro
                const { error } = await supabase
                    .from('categorias_contables')
                    .insert([categoriaLimpia]);

                if (error) throw error;
                this.mostrarToast(`Categoría "${categoriaLimpia.nombre}" creada con éxito.`);
            }

            this.cerrarModal();
            await this.module.recargarDatos(false);
        } catch (err) {
            console.error('Error al guardar categoría contable:', err);
            if (errorAlert) {
                errorAlert.textContent = `Error al guardar: ${err.message || 'Error de conexión con la base de datos'}`;
                errorAlert.classList.remove('d-none');
            }
        } finally {
            if (submitBtn) submitBtn.disabled = false;
            if (spinner) spinner.classList.add('d-none');
            if (icon) icon.classList.remove('d-none');
        }
    },

    /**
     * Abre / Cierra el menú contextual flotante para la fila seleccionada.
     */
    toggleFloatingMenu(triggerBtn) {
        if (this.activeMenuEl && this.activeMenuEl.dataset.triggerId === triggerBtn.dataset.id) {
            this.cleanupFloatingMenu();
            return;
        }

        this.cleanupFloatingMenu();

        const catId = triggerBtn.getAttribute('data-id');
        const categoria = this.module.state.categorias.find(c => String(c.id) === String(catId));
        if (!categoria) return;

        const count = this.module.state.conteoMovimientos[categoria.nombre] || 0;
        const rect = triggerBtn.getBoundingClientRect();

        const menuWrapper = document.createElement('div');
        menuWrapper.innerHTML = CategoriasTemplates.renderFloatingMenu({ categoria, count, rect });
        const menuEl = menuWrapper.firstElementChild;
        menuEl.dataset.triggerId = catId;

        // Posicionamiento inteligente anti-colisiones
        let top = rect.bottom + 4;
        let left = rect.right - 220;
        if (left < 10) left = 10;
        if (top + 200 > window.innerHeight) {
            top = rect.top - 190;
        }

        menuEl.style.top = `${top}px`;
        menuEl.style.left = `${left}px`;
        document.body.appendChild(menuEl);
        this.activeMenuEl = menuEl;

        // Vincular eventos del menú flotante
        // 1. Editar
        menuEl.querySelector('.btn-menu-editar')?.addEventListener('click', () => {
            this.cleanupFloatingMenu();
            this.abrirModalEditar(categoria);
        });

        // 2. Cambiar Estado
        menuEl.querySelector('.btn-menu-toggle-estado')?.addEventListener('click', async () => {
            this.cleanupFloatingMenu();
            await this.toggleEstadoCategoria(categoria);
        });

        // 3. Eliminar
        menuEl.querySelector('.btn-menu-eliminar')?.addEventListener('click', async () => {
            this.cleanupFloatingMenu();
            await this.eliminarCategoria(categoria, count);
        });
    },

    /**
     * Alterna rápidamente el estado (activa <-> inactiva) de una categoría.
     */
    async toggleEstadoCategoria(categoria) {
        const nuevoEstado = categoria.estado === 'activa' ? 'inactiva' : 'activa';
        try {
            const { error } = await supabase
                .from('categorias_contables')
                .update({ estado: nuevoEstado })
                .eq('id', categoria.id);

            if (error) throw error;

            categoria.estado = nuevoEstado;
            this.mostrarToast(`Categoría "${categoria.nombre}" ${nuevoEstado === 'activa' ? 'activada' : 'desactivada'} correctamente.`);
            this.module.actualizarVistasCompletas();
        } catch (err) {
            console.error('Error alternando estado de categoría:', err);
            alert(`No se pudo cambiar el estado: ${err.message}`);
        }
    },

    /**
     * Elimina una categoría protegiendo la integridad contable si tiene transacciones vinculadas.
     */
    async eliminarCategoria(categoria, count) {
        const numCount = Number(count || 0);

        if (numCount > 0) {
            alert(`⚠️ Acción Bloqueada por Integridad Contable:\n\nLa categoría "${categoria.nombre}" tiene ${numCount} movimientos contables registrados en el historial financiero.\n\nPara proteger la consistencia de tus reportes y balances, no puede eliminarse físicamente. En su lugar, puedes DESACTIVARLA usando la opción "Desactivar" del menú.`);
            return;
        }

        const confirmar = window.confirm(`¿Estás seguro de eliminar la categoría "${categoria.nombre}"?\n\nEsta categoría no tiene movimientos vinculados. Esta acción no se puede deshacer.`);
        if (!confirmar) return;

        try {
            const { error } = await supabase
                .from('categorias_contables')
                .delete()
                .eq('id', categoria.id);

            if (error) throw error;

            this.module.state.categorias = this.module.state.categorias.filter(c => c.id !== categoria.id);
            this.mostrarToast(`Categoría "${categoria.nombre}" eliminada correctamente.`);
            this.module.actualizarVistasCompletas();
        } catch (err) {
            console.error('Error al eliminar categoría:', err);
            alert(`No se pudo eliminar la categoría: ${err.message}`);
        }
    },

    /**
     * Exporta las categorías a Excel (.xlsx) o CSV con compatibilidad y blindaje.
     */
    exportarDatos() {
        const { categoriasFiltradas, categorias, conteoMovimientos } = this.module.state;
        const lista = categoriasFiltradas && categoriasFiltradas.length > 0 ? categoriasFiltradas : categorias;

        if (!lista || lista.length === 0) {
            alert('No hay categorías para exportar con el filtro actual.');
            return;
        }

        const dataToExport = CategoriasData.mapearParaExcel(lista, conteoMovimientos);
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `Reporte_Categorias_Contables_${dateStr}`;

        if (window.XLSX) {
            const ws = window.XLSX.utils.json_to_sheet(dataToExport);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, 'Categorias');
            window.XLSX.writeFile(wb, `${fileName}.xlsx`);
        } else {
            const headers = Object.keys(dataToExport[0]);
            let csv = headers.join(';') + '\r\n';
            dataToExport.forEach(row => {
                csv += headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(';') + '\r\n';
            });
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }
    },

    /**
     * Elimina menús flotantes abiertos en el DOM.
     */
    cleanupFloatingMenu() {
        if (this.activeMenuEl) {
            this.activeMenuEl.remove();
            this.activeMenuEl = null;
        }
        document.querySelectorAll('.row-action-menu').forEach(el => el.remove());
    },

    /**
     * Muestra una notificación toast amigable no intrusiva.
     */
    mostrarToast(mensaje) {
        let toastContainer = document.getElementById('toast-cat-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-cat-container';
            toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '1090';
            document.body.appendChild(toastContainer);
        }

        const toastEl = document.createElement('div');
        toastEl.className = 'toast align-items-center text-white bg-dark border-0 show shadow-lg mb-2';
        toastEl.setAttribute('role', 'alert');
        toastEl.style.borderRadius = '10px';
        toastEl.style.fontSize = '13px';
        toastEl.innerHTML = `
            <div class="d-flex p-2 px-3">
                <div class="toast-body d-flex align-items-center gap-2">
                    <i class="bi bi-check-circle-fill text-success"></i> ${escapeHtml(mensaje)}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        toastContainer.appendChild(toastEl);
        setTimeout(() => {
            toastEl.classList.remove('show');
            setTimeout(() => toastEl.remove(), 200);
        }, 3200);
    }
};
