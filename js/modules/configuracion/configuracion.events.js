// js/modules/configuracion/configuracion.events.js
// Capa de Gestión de Eventos y Ciclo de Vida para Configuración 360°

import { ConfiguracionData } from './configuracion.data.js';
import { ConfiguracionTemplates } from './configuracion.templates.js';

export const ConfiguracionEvents = {

    init(module) {
        this.module = module;
        this.container = module.element;
        this.bindGlobalEvents();
        this.renderActiveTab();
    },

    bindGlobalEvents() {
        if (!this.container) return;

        // Delegación de clics en la barra de tabs segmentada
        this.container.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('.payment-tab-btn');
            if (tabBtn) {
                const newTab = tabBtn.dataset.tab;
                if (newTab && newTab !== this.module.state.currentTab) {
                    this.module.state.currentTab = newTab;
                    this.container.querySelectorAll('.payment-tab-btn').forEach(b => b.classList.toggle('active', b === tabBtn));
                    this.renderActiveTab();
                }
                return;
            }

            // Botón de refrescar general
            const btnRefresh = e.target.closest('#btn-refresh-config');
            if (btnRefresh) {
                this.recargarTodo();
                return;
            }
        });
    },

    renderActiveTab() {
        const contentEl = this.container.querySelector('#config-tab-content');
        if (!contentEl) return;

        const { currentTab } = this.module.state;

        if (currentTab === 'consecutivos') {
            contentEl.innerHTML = ConfiguracionTemplates.renderConsecutivosTab(this.module.state);
            this.bindConsecutivosEvents(contentEl);
        } else if (currentTab === 'categorias') {
            this.renderCategoriasTabContent(contentEl);
        } else if (currentTab === 'empresa') {
            contentEl.innerHTML = ConfiguracionTemplates.renderEmpresaTab(this.module.state.empresa);
            this.bindEmpresaEvents(contentEl);
        } else if (currentTab === 'apariencia') {
            const currentTheme = localStorage.getItem('app-theme') || '';
            contentEl.innerHTML = ConfiguracionTemplates.renderAparienciaTab(currentTheme);
            this.bindAparienciaEvents(contentEl);
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Eventos: Pestaña Consecutivos
    // ─────────────────────────────────────────────────────────────────────────

    bindConsecutivosEvents(contentEl) {
        const btnFactura = contentEl.querySelector('.btn-guardar-consecutivo[data-tabla="facturas"]');
        const btnCotizacion = contentEl.querySelector('.btn-guardar-consecutivo[data-tabla="cotizaciones"]');

        const handleSave = async (tabla, inputId, btn) => {
            const input = contentEl.querySelector(inputId);
            if (!input) return;

            const res = ConfiguracionData.validarNuevoConsecutivo(input.value, this.module.state.maxActual);
            if (!res.valido) {
                this.showToast(res.error, 'warning');
                input.focus();
                return;
            }

            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';

            try {
                await ConfiguracionData.guardarConsecutivo(tabla, res.numero);
                
                // Actualizar estado local
                if (tabla === 'facturas') this.module.state.proximoFactura = res.numero;
                if (tabla === 'cotizaciones') this.module.state.proximoCotizacion = res.numero;

                this.actualizarKpisEnDOM();
                this.showToast(`Consecutivo de ${tabla} actualizado con éxito a #${res.numero}`, 'success');
                this.renderActiveTab();
            } catch (error) {
                console.error(`[ConfiguracionEvents] Error guardando consecutivo de ${tabla}:`, error);
                this.showToast(`Error al guardar en base de datos: ${error.message}`, 'danger');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        };

        if (btnFactura) {
            btnFactura.addEventListener('click', () => handleSave('facturas', '#input-next-factura', btnFactura));
        }
        if (btnCotizacion) {
            btnCotizacion.addEventListener('click', () => handleSave('cotizaciones', '#input-next-cotizacion', btnCotizacion));
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Eventos: Pestaña Categorías Contables
    // ─────────────────────────────────────────────────────────────────────────

    renderCategoriasTabContent(contentEl) {
        const { categorias, catFilter, catQuery } = this.module.state;
        const filtradas = ConfiguracionData.filtrarCategorias(categorias, {
            tab: catFilter,
            query: catQuery
        });

        contentEl.innerHTML = ConfiguracionTemplates.renderCategoriasTab({
            categorias: filtradas,
            activeTabFilter: catFilter,
            searchQuery: catQuery
        });

        // Asegurar modal en el DOM
        let drawerContainer = this.container.querySelector('#drawer-config-container');
        if (drawerContainer && !drawerContainer.querySelector('#modal-crear-categoria')) {
            drawerContainer.innerHTML = ConfiguracionTemplates.renderModalNuevaCategoria();
        }

        this.bindCategoriasEvents(contentEl);
    },

    bindCategoriasEvents(contentEl) {
        // Sub-filtros
        contentEl.querySelectorAll('.btn-cat-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                this.module.state.catFilter = btn.dataset.catFilter;
                this.renderCategoriasTabContent(contentEl);
            });
        });

        // Buscador
        const inputBuscar = contentEl.querySelector('#input-buscar-categoria');
        if (inputBuscar) {
            inputBuscar.addEventListener('input', (e) => {
                this.module.state.catQuery = e.target.value;
                const filtradas = ConfiguracionData.filtrarCategorias(this.module.state.categorias, {
                    tab: this.module.state.catFilter,
                    query: this.module.state.catQuery
                });
                
                const tbody = contentEl.querySelector('tbody');
                if (tbody) {
                    // Re-renderizado quirúrgico del tbody
                    const temp = document.createElement('div');
                    temp.innerHTML = ConfiguracionTemplates.renderCategoriasTab({
                        categorias: filtradas,
                        activeTabFilter: this.module.state.catFilter,
                        searchQuery: this.module.state.catQuery
                    });
                    const newTbody = temp.querySelector('tbody');
                    if (newTbody) tbody.innerHTML = newTbody.innerHTML;
                    this.bindToggleCategoryButtons(contentEl);
                }
            });
        }

        // Botón Nueva Categoría (abre modal)
        const btnNueva = contentEl.querySelector('#btn-nueva-categoria');
        if (btnNueva) {
            btnNueva.addEventListener('click', () => {
                const modalEl = document.getElementById('modal-crear-categoria');
                if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                    modal.show();
                }
            });
        }

        // Binds en botones de la tabla
        this.bindToggleCategoryButtons(contentEl);

        // Bind en el formulario del modal
        this.bindModalNuevaCategoria();
    },

    bindToggleCategoryButtons(contentEl) {
        contentEl.querySelectorAll('.btn-toggle-categoria').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = Number(btn.dataset.id);
                const estadoActual = btn.dataset.estado;
                const nuevoEstado = estadoActual === 'activa' ? 'inactiva' : 'activa';

                btn.disabled = true;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

                try {
                    await ConfiguracionData.toggleEstadoCategoria(id, nuevoEstado);
                    
                    // Actualizar memoria
                    const cat = this.module.state.categorias.find(c => c.id === id);
                    if (cat) cat.estado = nuevoEstado;

                    this.actualizarKpisEnDOM();
                    this.showToast(`Categoría "${cat?.nombre || id}" ahora está ${nuevoEstado}.`, 'success');
                    this.renderActiveTab();
                } catch (error) {
                    console.error('[ConfiguracionEvents] Error toggle categoria:', error);
                    this.showToast(`Error al cambiar estado: ${error.message}`, 'danger');
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            });
        });
    },

    bindModalNuevaCategoria() {
        const form = document.getElementById('form-nueva-categoria');
        if (!form || form.dataset.bound === 'true') return;
        form.dataset.bound = 'true';

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputNombre = document.getElementById('input-cat-nombre');
            const radioFlujo = form.querySelector('input[name="tipo_flujo"]:checked');
            const btnSubmit = document.getElementById('btn-submit-categoria');

            if (!inputNombre || !radioFlujo) return;

            const val = ConfiguracionData.validarCategoria({
                nombre: inputNombre.value,
                tipo_flujo: radioFlujo.value
            }, this.module.state.categorias);

            if (!val.valido) {
                this.showToast(val.error, 'warning');
                inputNombre.focus();
                return;
            }

            const originalHtml = btnSubmit.innerHTML;
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Creando...';

            try {
                const nueva = await ConfiguracionData.crearCategoria(val.categoriaLimpia);
                this.module.state.categorias.push(nueva);
                this.actualizarKpisEnDOM();

                // Cerrar modal
                const modalEl = document.getElementById('modal-crear-categoria');
                if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }

                form.reset();
                this.showToast(`Categoría "${nueva.nombre}" creada exitosamente`, 'success');
                this.renderActiveTab();
            } catch (error) {
                console.error('[ConfiguracionEvents] Error creando categoria:', error);
                this.showToast(`Error al crear categoría: ${error.message}`, 'danger');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = originalHtml;
            }
        });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Eventos: Pestaña Empresa & Membrete
    // ─────────────────────────────────────────────────────────────────────────

    bindEmpresaEvents(contentEl) {
        const form = contentEl.querySelector('#form-empresa-config');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const perfil = {
                razonSocial: contentEl.querySelector('#empresa-razon-social')?.value,
                titular: contentEl.querySelector('#empresa-titular')?.value,
                nit: contentEl.querySelector('#empresa-nit')?.value,
                regimen: contentEl.querySelector('#empresa-regimen')?.value,
                telefono: contentEl.querySelector('#empresa-telefono')?.value,
                email: contentEl.querySelector('#empresa-email')?.value,
                ciudad: contentEl.querySelector('#empresa-ciudad')?.value,
                direccion: contentEl.querySelector('#empresa-direccion')?.value,
                terminosCotizacion: contentEl.querySelector('#empresa-terminos-cotizacion')?.value,
                notasFactura: contentEl.querySelector('#empresa-notas-factura')?.value
            };

            const guardado = ConfiguracionData.guardarPerfilEmpresa(perfil);
            this.module.state.empresa = guardado;
            this.actualizarKpisEnDOM();
            this.showToast('Configuración de empresa y membrete guardada correctamente', 'success');
        });

        const btnRestaurar = contentEl.querySelector('#btn-restaurar-empresa');
        if (btnRestaurar) {
            btnRestaurar.addEventListener('click', () => {
                if (!confirm('¿Desea restaurar los datos de empresa por defecto de MAS Accesorios?')) return;
                const def = ConfiguracionData.sanitizarPerfilEmpresa({});
                ConfiguracionData.guardarPerfilEmpresa(def);
                this.module.state.empresa = def;
                this.actualizarKpisEnDOM();
                this.showToast('Valores por defecto de MAS Accesorios restaurados', 'info');
                this.renderActiveTab();
            });
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Eventos: Pestaña Apariencia & Sistema
    // ─────────────────────────────────────────────────────────────────────────

    bindAparienciaEvents(contentEl) {
        const cards = contentEl.querySelectorAll('.theme-option-card');

        cards.forEach(card => {
            card.addEventListener('click', () => {
                const valor = card.dataset.themeValue;
                if (valor) {
                    localStorage.setItem('app-theme', valor);
                    document.documentElement.setAttribute('data-theme', valor);
                } else {
                    localStorage.removeItem('app-theme');
                    document.documentElement.removeAttribute('data-theme');
                }

                cards.forEach(c => {
                    const match = c.dataset.themeValue === (localStorage.getItem('app-theme') || '');
                    c.classList.toggle('border-primary', match);
                    c.classList.toggle('shadow-xs', match);
                });

                this.showToast('Tema visual actualizado', 'success');
                this.renderActiveTab();
            });
        });

        const btnLimpiar = contentEl.querySelector('#btn-limpiar-historial-busqueda');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                localStorage.removeItem('mas_frequent_searches');
                this.showToast('Historial de búsquedas frecuentes restablecido.', 'info');
            });
        }

        const btnRecargar = contentEl.querySelector('#btn-recargar-spa');
        if (btnRecargar) {
            btnRecargar.addEventListener('click', () => {
                window.location.reload();
            });
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers Reactivos
    // ─────────────────────────────────────────────────────────────────────────

    actualizarKpisEnDOM() {
        const kpis = ConfiguracionData.calcularKpis(this.module.state);
        this.module.state.kpis = kpis;

        const kpiProximo = this.container.querySelector('#kpi-proximo-doc');
        if (kpiProximo) kpiProximo.textContent = `#${kpis.proximoDoc}`;

        const kpiCategorias = this.container.querySelector('#kpi-categorias-activas');
        if (kpiCategorias) kpiCategorias.textContent = `${kpis.categoriasActivas} Activas`;

        const badgeTab = this.container.querySelector('.payment-tab-badge');
        if (badgeTab) badgeTab.textContent = kpis.totalCategorias;
    },

    async recargarTodo() {
        const btn = this.container.querySelector('#btn-refresh-config');
        if (btn) btn.classList.add('rotate-spin');

        await this.module.recargar();

        if (btn) btn.classList.remove('rotate-spin');
        this.showToast('Parámetros de configuración actualizados.', 'success');
    },

    showToast(message, type = 'success') {
        const toastId = 'toast-' + Date.now();
        const icon = type === 'success' ? 'check-circle' : (type === 'danger' ? 'x-circle' : 'exclamation-circle');
        
        const html = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0 shadow-sm" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body d-flex align-items-center py-2 px-3">
                        <i class="bi bi-${icon} fs-5 me-2"></i>
                        <span style="font-size: 13px;">${message}</span>
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '1090';
            document.body.appendChild(toastContainer);
        }

        toastContainer.insertAdjacentHTML('beforeend', html);
        const toastEl = document.getElementById(toastId);
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const bsToast = new bootstrap.Toast(toastEl, { delay: 3500 });
            bsToast.show();
            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        } else {
            setTimeout(() => toastEl?.remove(), 3500);
        }
    }
};
