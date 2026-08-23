// js/modules/clientes/clientes.js
// Módulo de Gestión de Contactos (Clientes y Proveedores) - Hoja Completa

import DB from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { AbonoModal } from '../../shared/abonoModal.js';
import { calcularEstadoFactura } from '../../shared/carteraUtils.js';
import { agruparTransaccionesPorPago } from '../../shared/transaccionesUtils.js';
import { mostrarDetalleTransaccion } from '../../shared/transaccionModal.js';
import { escapeHtml } from '../../shared/formatters.js';
import { EstadoUtils } from '../../shared/estadoUtils.js';

export const ContactosModule = {
    state: {
        currentPage: 1,
        itemsPerPage: 25,
        currentFilter: 'todos',
        searchQuery: '',
        totalCount: 0
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        this.state.searchQuery = '';
        this.state.currentFilter = 'todos';
        this.state.currentPage = 1;
        
        // Renderizar contenedor principal de hoja completa
        element.innerHTML = `
            <div class="dash-layout p-4">
                <!-- Header -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1 text-dark">Gestión de Contactos</h2>
                        <p class="text-muted small mb-0">Crea tus clientes, proveedores y demás contactos para asociarlos en tus documentos</p>
                    </div>
                    <div class="d-flex gap-2">
                        <div class="dropdown">
                            <button class="btn btn-light border dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                Más acciones
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#">Importar contactos</a></li>
                                <li><a class="dropdown-item" href="#">Exportar contactos</a></li>
                            </ul>
                        </div>
                        <button id="btn-refresh-list" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: var(--fs-md); color: var(--text-body);">
                            <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
                        </button>
                        <button id="btn-nuevo-contacto" class="btn btn-primary-action">
                            <i class="bi bi-plus-lg me-1"></i> Nuevo contacto
                        </button>
                    </div>
                </div>

                <!-- KPI CARDS CONTACTOS -->
                <div class="row g-3 mb-4" id="contactos-kpi-row">
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Total Contactos</span>
                            <div class="ds-kpi-value" id="kpi-total-contactos"><span class="spinner-border spinner-border-sm text-secondary"></span></div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Clientes Registrados</span>
                            <div class="ds-kpi-value" id="kpi-clientes"><span class="spinner-border spinner-border-sm text-secondary"></span></div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Proveedores</span>
                            <div class="ds-kpi-value" id="kpi-proveedores"><span class="spinner-border spinner-border-sm text-secondary"></span></div>
                        </div>
                    </div>
                </div>

                <div class="ds-table-container">
                    <div class="card-body p-0">
                        <!-- Pestañas de Filtro (Tabs) -->
                        <ul class="nav nav-tabs border-bottom-0 gap-3 px-4 pt-3" id="contactos-tabs" style="border-bottom: 2px solid var(--border-color) !important;">
                            <li class="nav-item">
                                <a class="nav-link active fw-medium text-dark border-0 pb-3" data-filter="todos" href="#" style="border-bottom: 2px solid var(--primary) !important;">Todos</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link fw-medium text-muted border-0 pb-3" data-filter="cliente" href="#" style="border-bottom: 2px solid transparent !important;">Clientes</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link fw-medium text-muted border-0 pb-3" data-filter="proveedor" href="#" style="border-bottom: 2px solid transparent !important;">Proveedores</a>
                            </li>
                        </ul>

                        <div id="contactos-list-view" class="view-container p-4">
                            <!-- Buscador y Tabla Principal -->
                            <div id="tabla-contactos-wrapper">
                                <!-- Buscador -->
                                <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center mb-3">
                                    <div class="ds-search-container" style="width: 250px;">
                                        <i class="bi bi-search ds-search-icon"></i>
                                        <input type="text" id="search-contacto" class="ds-search-input" placeholder="Buscar..." autocomplete="off">
                                    </div>
                                    <button id="btn-filtrar" class="btn btn-link text-decoration-none text-muted p-0"><i class="bi bi-funnel"></i> Filtrar</button>
                                </div>

                                <!-- Tabla -->
                                <div class="table-responsive">
                                    <table class="table table-borderless align-middle mb-0">
                                        <thead class="ds-table-header">
                                            <tr>
                                                <th class="py-2" style="width: 40px;"><input type="checkbox" class="form-check-input" id="check-all"></th>
                                                <th class="py-2" style="white-space: nowrap;">Nombre <i class="bi bi-arrow-up-short"></i></th>
                                                <th class="py-2" style="white-space: nowrap;">Identificación</th>
                                                <th class="py-2" style="white-space: nowrap;">Teléfono</th>
                                                <th class="py-2" style="white-space: nowrap;">Tipo</th>
                                                <th class="py-2 text-end" style="white-space: nowrap;">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody id="tbody-contactos">
                                            <!-- Inyectado dinámicamente -->
                                        </tbody>
                                    </table>
                                </div>

                                <!-- Paginación -->
                                <div class="d-flex justify-content-between align-items-center mt-3 text-muted small">
                                    <div class="d-flex align-items-center gap-3">
                                        <span>Página <span id="current-page">1</span> de <span id="total-pages">1</span></span>
                                        <div class="btn-group">
                                            <button class="btn btn-sm btn-light border text-muted" id="btn-prev-page"><i class="bi bi-chevron-left"></i></button>
                                            <button class="btn btn-sm btn-light border text-muted" id="btn-next-page"><i class="bi bi-chevron-right"></i></button>
                                        </div>
                                    </div>
                                    <div class="d-flex align-items-center gap-3">
                                        <span class="d-flex align-items-center gap-2">
                                            Contactos por página: 
                                            <select id="items-per-page" class="form-select form-select-sm border-0 bg-transparent text-muted fw-bold" style="width: 60px; box-shadow: none; cursor: pointer;">
                                                <option value="10">10</option>
                                                <option value="25">25</option>
                                                <option value="50">50</option>
                                            </select>
                                        </span>
                                        <span id="showing-count">1-10 de 709</span>
                                        <button id="btn-refresh" class="btn btn-sm btn-light border text-muted rounded-circle" style="width: 30px; height: 30px; padding: 0;"><i class="bi bi-arrow-clockwise"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="contactos-action-view" class="view-container p-4" style="display: none;"></div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();

        const hashParts = window.location.hash.split('/');
        const action = hashParts[2];
        const routeId = hashParts[3];

        if (action === 'ver' && routeId) {
            await this.renderDetalle(routeId);
        } else if (action === 'nueva') {
            await this.cargarPagina();
            this.renderForm();
        } else {
            await this.cargarPagina();
        }
    },

    // ─── DATOS: paginación real server-side ────────────────────────────────────

    async fetchKpis() {
        try {
            const { data } = await supabase
                .from('contactos')
                .select('es_cliente, es_proveedor, estado');
            
            // Filtramos inactivos igual que el RPC
            const activos = data?.filter(c => c.estado !== 'inactive') || [];
            
            const total      = activos.length;
            const clientes   = activos.filter(c => c.es_cliente).length;
            const proveedores = activos.filter(c => c.es_proveedor).length;
            
            return { total, clientes, proveedores };
        } catch { return { total: 0, clientes: 0, proveedores: 0 }; }
    },

    renderKpis({ total, clientes, proveedores }) {
        const kpiTotal = this.element.querySelector('#kpi-total-contactos');
        const kpiCli   = this.element.querySelector('#kpi-clientes');
        const kpiProv  = this.element.querySelector('#kpi-proveedores');
        if (kpiTotal)  kpiTotal.textContent  = total;
        if (kpiCli)    kpiCli.textContent    = clientes;
        if (kpiProv)   kpiProv.textContent   = proveedores;
    },

    async cargarPagina() {
        const { currentPage, itemsPerPage, currentFilter, searchQuery } = this.state;
        
        try {
            const [rpcResponse, kpis] = await Promise.all([
                supabase.rpc('get_contactos_page', {
                    p_page: currentPage,
                    p_limit: itemsPerPage,
                    p_sort_column: 'nombre',
                    p_sort_direction: 'asc',
                    p_search_query: searchQuery,
                    p_filter_criteria: currentFilter
                }),
                this.fetchKpis()
            ]);

            if (rpcResponse.error) throw rpcResponse.error;

            const { data, total_count } = rpcResponse.data;
            this.state.totalCount = total_count || 0;
            this.renderGrid(data || [], this.state.totalCount);
            this.renderKpis(kpis);
        } catch (err) {
            console.error('Error cargando contactos:', err);
            this.renderGrid([], 0);
        }
    },

    renderGrid(rows, totalCount) {
        const wrapper = this.element.querySelector('#tabla-contactos-wrapper');
        if (wrapper) wrapper.style.display = 'block';

        const container = this.element.querySelector('#tbody-contactos');
        if (!container) return;

        const { currentPage, itemsPerPage } = this.state;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex   = Math.min(startIndex + rows.length, totalCount);
        const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

        // Renderizado de filas
        if (rows.length === 0) {
            container.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No se encontraron contactos que coincidan con la búsqueda.</td></tr>`;
        } else {
            let html = '';
            rows.forEach(c => {
                const inicial    = c.nombre ? c.nombre.charAt(0).toUpperCase() : '?';
                let badges = [];
                if (c.es_cliente) {
                    badges.push(`<span class="badge bg-success text-success bg-opacity-10 border border-success-subtle rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">Cliente</span>`);
                }
                if (c.es_proveedor) {
                    badges.push(`<span class="badge bg-primary text-primary bg-opacity-10 border border-primary-subtle rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">Proveedor</span>`);
                }
                if (badges.length === 0) {
                    // Fallback
                    const isCliente = (c.tipo || '').toLowerCase() === 'cliente';
                    const isProveedor = (c.tipo || '').toLowerCase() === 'proveedor';
                    if (isCliente) badges.push(`<span class="badge bg-success text-success bg-opacity-10 border border-success-subtle rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">Cliente</span>`);
                    else if (isProveedor) badges.push(`<span class="badge bg-primary text-primary bg-opacity-10 border border-primary-subtle rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">Proveedor</span>`);
                    else badges.push(`<span class="badge bg-light text-dark border rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">${c.tipo || '-'}</span>`);
                }
                const tipoBadge = badges.join('&nbsp;');

                html += `
                    <tr data-id="${c.id}" style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: var(--fs-base); color: var(--text-body);" onclick="if(!event.target.closest('button') && !event.target.closest('input')) window.location.hash = '#/contactos/ver/${c.id}'">
                        <td class="py-2"><input type="checkbox" class="form-check-input contact-check"></td>
                        <td class="py-2">
                            <div class="d-flex align-items-center gap-3">
                                <div class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0" style="width: 32px; height: 32px; background-color: var(--primary); font-size: var(--fs-md);">
                                    ${inicial}
                                </div>
                                <span class="fw-medium text-dark text-capitalize text-truncate" style="max-width: 200px;">${c.nombre ? c.nombre.toLowerCase() : ''}</span>
                            </div>
                        </td>
                        <td class="py-2 text-muted">${c.nit || '-'}</td>
                        <td class="py-2 text-muted">${c.telefono || '-'}</td>
                        <td class="py-2">${tipoBadge}</td>
                        <td class="py-2 text-end">
                            <button class="btn btn-sm btn-light text-muted btn-editar me-1" data-id="${c.id}" title="Editar"><i class="bi bi-pencil"></i></button>
                            <div class="dropdown d-inline-block">
                                <button class="btn btn-sm btn-light text-muted border-0" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
                                <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                                    <li><a class="dropdown-item btn-ver" href="#" data-id="${c.id}">Ver detalles</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item text-danger btn-eliminar" href="#" data-id="${c.id}">Eliminar</a></li>
                                </ul>
                            </div>
                        </td>
                    </tr>
                `;
            });
            container.innerHTML = html;
        }

        // UI Paginación
        const paginasEl      = this.element.querySelector('#current-page');
        const totalPagEl     = this.element.querySelector('#total-pages');
        const showingCountEl = this.element.querySelector('#showing-count');
        const prevBtn        = this.element.querySelector('#btn-prev-page');
        const nextBtn        = this.element.querySelector('#btn-next-page');

        if (paginasEl)      paginasEl.textContent  = currentPage;
        if (totalPagEl)     totalPagEl.textContent  = totalPages;
        if (showingCountEl) showingCountEl.textContent = totalCount > 0
            ? `${startIndex + 1}-${endIndex} de ${totalCount}`
            : '0-0 de 0';
        if (prevBtn) prevBtn.disabled = (currentPage === 1);
        if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);

        this.bindFilaEvents();
    },

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

    async renderForm(id = null) {
        const listView = this.element.querySelector('#contactos-list-view');
        const actionView = this.element.querySelector('#contactos-action-view');
        if (!listView || !actionView) return;

        listView.style.display = 'none';
        actionView.style.display = 'block';

        const tabs = this.element.querySelector('#contactos-tabs');
        if (tabs) tabs.style.display = 'none';
        const kpiRow = this.element.querySelector('#contactos-kpi-row');
        if (kpiRow) kpiRow.style.display = 'none';

        let contacto = { nombre: '', nit: '', tipo: 'cliente', telefono: '', email: '', ciudad: '', direccion: '', regimen: 'Regimen Simplificado', cupoCredito: 0, plazosPago: 0 };
        
        if (id) {
            contacto = await DB.get('contactos', id) || contacto;
        }

        const { data: vendedoresActivos } = await supabase.from('vendedores').select('id, nombre').eq('estado', 'activo').order('nombre');

        actionView.innerHTML = `
            <div class="form-hoja-completa bg-white rounded">
                <div class="d-flex align-items-center mb-3">
                    <button id="btn-cancelar-contacto"
                        class="btn btn-link text-decoration-none p-0 me-3 d-flex align-items-center"
                        style="color: var(--text-body) !important; font-weight: var(--weight-medium); transition: color 0.2s;">
                        <i class="bi bi-arrow-left me-2"></i>Volver a Contactos
                    </button>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                    <h3 class="h5 m-0 fw-bold">${id ? 'Editar Contacto' : 'Crear Nuevo Contacto'}</h3>
                </div>
                <form id="form-contacto-data">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium">Nombre o Razón Social *</label>
                            <input type="text" id="form-nombre" class="form-control form-control-sm" value="${contacto.nombre}" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium">NIT o Cédula *</label>
                            <input type="text" id="form-nit" class="form-control form-control-sm" value="${contacto.nit}" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium d-block">Tipo de Contacto <span class="text-danger">*</span></label>
                            <div class="form-check form-check-inline mt-1">
                                <input class="form-check-input" type="checkbox" id="form-es-cliente" ${contacto.es_cliente !== false ? 'checked' : ''}>
                                <label class="form-check-label text-muted small" for="form-es-cliente">Es cliente</label>
                            </div>
                            <div class="form-check form-check-inline mt-1">
                                <input class="form-check-input" type="checkbox" id="form-es-proveedor" ${contacto.es_proveedor ? 'checked' : ''}>
                                <label class="form-check-label text-muted small" for="form-es-proveedor">Es proveedor</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium">Vendedor asignado</label>
                            <select id="form-vendedor" class="form-select form-select-sm">
                                <option value="">Sin vendedor asignado</option>
                                ${(vendedoresActivos || []).map(v => `<option value="${v.id}" ${String(contacto.vendedor_id) === String(v.id) ? 'selected' : ''}>${v.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium">Teléfono</label>
                            <input type="text" id="form-telefono" class="form-control form-control-sm" value="${contacto.telefono || ''}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium">Correo Electrónico</label>
                            <input type="email" id="form-email" class="form-control form-control-sm" value="${contacto.email || ''}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-medium">Ciudad</label>
                            <input type="text" id="form-ciudad" class="form-control form-control-sm" value="${contacto.ciudad || ''}">
                        </div>
                        <div class="col-md-12">
                            <label class="form-label text-muted small fw-medium">Dirección</label>
                            <input type="text" id="form-direccion" class="form-control form-control-sm" value="${contacto.direccion || ''}">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label text-muted small fw-medium">Régimen Tributario</label>
                            <select id="form-regimen" class="form-select form-select-sm">
                                <option value="Regimen Simplificado" ${contacto.regimen === 'Regimen Simplificado' ? 'selected' : ''}>Régimen Simplificado (No responsable de IVA)</option>
                                <option value="Regimen Comun" ${contacto.regimen === 'Regimen Comun' ? 'selected' : ''}>Régimen Común (Responsable de IVA)</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label text-muted small fw-medium">Cupo de Crédito ($)</label>
                            <input type="number" id="form-cupo" class="form-control form-control-sm" value="${contacto.cupoCredito || 0}">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label text-muted small fw-medium">Plazos de Pago (Días)</label>
                            <input type="number" id="form-plazos" class="form-control form-control-sm" value="${contacto.plazosPago || 0}">
                        </div>
                    </div>
                    <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                        <button type="button" class="btn btn-light" id="btn-cancelar-form">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="background-color: var(--primary); border: none;">Guardar Contacto</button>
                    </div>
                </form>
            </div>
        `;

        this.element.querySelector('#btn-cancelar-contacto')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.restaurarVistaTabla();
        });

        this.element.querySelector('#btn-cancelar-form')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.restaurarVistaTabla();
        });

        this.element.querySelector('#form-contacto-data')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const esCliente = this.element.querySelector('#form-es-cliente').checked;
            const esProveedor = this.element.querySelector('#form-es-proveedor').checked;
            if (!esCliente && !esProveedor) {
                CoreActions.showWarningModal("Debe seleccionar al menos un tipo de contacto (Cliente o Proveedor).");
                return;
            }

            const datos = {
                nombre: this.element.querySelector('#form-nombre').value,
                nit: this.element.querySelector('#form-nit').value,
                es_cliente: esCliente,
                es_proveedor: esProveedor,
                tipo: esProveedor && !esCliente ? 'proveedor' : 'cliente',
                vendedor_id: this.element.querySelector('#form-vendedor').value || null,
                telefono: this.element.querySelector('#form-telefono').value,
                email: this.element.querySelector('#form-email').value,
                ciudad: this.element.querySelector('#form-ciudad').value,
                direccion: this.element.querySelector('#form-direccion').value,
                regimen: this.element.querySelector('#form-regimen').value,
                cupoCredito: parseFloat(this.element.querySelector('#form-cupo').value) || 0,
                plazosPago: parseInt(this.element.querySelector('#form-plazos').value) || 0
            };

            const nuevoContacto = {
                id: id || 'cont_' + Date.now(),
                ...datos
            };
            await DB.save('contactos', nuevoContacto);
            await this.cargarPagina();
            this.restaurarVistaTabla();
        });
    },

    async renderDetalle(id) {
        const listView = this.element.querySelector('#contactos-list-view');
        const actionView = this.element.querySelector('#contactos-action-view');
        if (!listView || !actionView) return;

        listView.style.display = 'none';
        actionView.style.display = 'block';

        const tabs = this.element.querySelector('#contactos-tabs');
        if (tabs) tabs.style.display = 'none';
        const kpiRow = this.element.querySelector('#contactos-kpi-row');
        if (kpiRow) kpiRow.style.display = 'none';

        const [contacto, facturasResp, cotizacionesResp, transaccionesResp] = await Promise.all([
            DB.get('contactos', id),
            supabase
                .from('facturas')
                .select('id, numero, fecha, vencimiento, total, saldo_original, estado, tipo')
                .eq('contacto_id', id)
                .eq('tipo', 'venta')
                .order('fecha', { ascending: false })
                .limit(50),
            supabase
                .from('cotizaciones')
                .select('id, numero, fecha, total, estado')
                .eq('contacto_id', id)
                .order('fecha', { ascending: false })
                .limit(50),
            supabase
                .from('pagos_ingresos')
                .select('id, tipo, monto, fecha, categoria, observaciones, grupo_pago_id, cuenta_id')
                .eq('contacto_id', id)
                .neq('estado', 'void')
                .order('fecha', { ascending: false })
                .limit(50)
        ]);

        if (!contacto) return;

        const facturasCliente = facturasResp.data;
        const cotizacionesCliente = cotizacionesResp.data;
        const transaccionesCliente = transaccionesResp.data;

        const facturaIdsCliente = (facturasCliente || []).map(f => f.id);
        const { data: rawTransacciones } = facturaIdsCliente.length > 0
            ? await supabase.from('pagos_ingresos').select('*').in('factura_id', facturaIdsCliente)
            : { data: [] };
            
        // TRADUCCIÓN OBLIGATORIA: El query crudo a Supabase devuelve 'in' / 'out'. 
        // calcularEstadoFactura exige el contrato 'ingreso' / 'egreso'.
        const todasLasTransacciones = (rawTransacciones || []).map(t => ({
            ...t,
            tipo: t.tipo === 'in' ? 'ingreso' : 'egreso'
        }));

        const transaccionesAgrupadas = agruparTransaccionesPorPago(transaccionesCliente);

        let saldoPorCobrarTotal = 0;
        (facturasCliente || []).forEach(f => {
            const estadoCalc = calcularEstadoFactura(f, todasLasTransacciones || []);
            if (estadoCalc.estado !== 'anulada' && estadoCalc.estado !== 'void') {
                saldoPorCobrarTotal += estadoCalc.saldo;
            }
        });

        const colorSaldo = saldoPorCobrarTotal > 0 ? '#e74c3c' : '#2cbfb7';

        actionView.innerHTML = `
            <div class="perfil-hoja-completa bg-white rounded">
                <div class="d-flex align-items-center mb-3">
                    <button id="btn-volver-perfil"
                        class="btn btn-link text-decoration-none p-0 me-3 d-flex align-items-center"
                        style="color: var(--text-body) !important; font-weight: var(--weight-medium); transition: color 0.2s;">
                        <i class="bi bi-arrow-left me-2"></i>Volver a Contactos
                    </button>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                    <h3 class="h5 m-0 fw-bold">${escapeHtml(contacto.nombre)}</h3>
                    <button class="btn btn-sm btn-light btn-editar-contacto-detalle" data-id="${contacto.id}">
                        <i class="bi bi-pencil me-1"></i>Editar
                    </button>
                </div>
                <div class="row g-4">
                    <div class="col-lg-4 col-md-6">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body">
                                <h4 class="h6 fw-bold text-dark mb-3">Datos Básicos</h4>
                                <p class="mb-2 text-muted small"><strong class="text-dark">Identificación:</strong> ${contacto.nit}</p>
                                <p class="mb-2 text-muted small text-capitalize"><strong class="text-dark">Tipo:</strong> ${contacto.tipo}</p>
                                <p class="mb-2 text-muted small"><strong class="text-dark">Teléfono:</strong> ${contacto.telefono || 'No registrado'}</p>
                                <p class="mb-2 text-muted small"><strong class="text-dark">Email:</strong> ${contacto.email || 'No registrado'}</p>
                                <p class="mb-0 text-muted small"><strong class="text-dark">Ubicación:</strong> ${contacto.direccion || ''} ${contacto.ciudad ? `(${contacto.ciudad})` : ''}</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4 col-md-6">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body">
                                <h4 class="h6 fw-bold text-dark mb-3">Condiciones Comerciales</h4>
                                <p class="mb-2 text-muted small"><strong class="text-dark">Régimen:</strong> ${contacto.regimen || 'Regimen Simplificado'}</p>
                                <p class="mb-2 text-muted small"><strong class="text-dark">Cupo de Crédito:</strong> $${(contacto.cupoCredito || 0).toLocaleString()}</p>
                                <p class="mb-0 text-muted small"><strong class="text-dark">Plazos de Pago:</strong> ${contacto.plazosPago || 0} días</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4 col-md-12">
                        <div class="card border-0 shadow-sm h-100" style="border-left: 4px solid ${colorSaldo} !important;">
                            <div class="card-body d-flex flex-column justify-content-center align-items-center text-center">
                                <h4 class="h6 fw-bold text-muted mb-2">Saldo por Cobrar</h4>
                                <h2 class="m-0 fw-bold" style="color: ${colorSaldo}; font-size: var(--fs-xxl); word-break: break-all;">
                                    $${saldoPorCobrarTotal.toLocaleString('es-CO', {minimumFractionDigits: 0})}
                                </h2>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-4">
                    <ul class="nav nav-tabs flex-nowrap overflow-auto" id="tabs-detalle-cliente" style="white-space: nowrap;">
                        <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-facturas" style="font-size: var(--fs-md); white-space: nowrap;">Facturas</button></li>
                        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-cotizaciones" style="font-size: var(--fs-md); white-space: nowrap;">Cotizaciones</button></li>
                        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-transacciones" style="font-size: var(--fs-md); white-space: nowrap;">Transacciones</button></li>
                    </ul>
                    <div class="tab-content border border-top-0 p-3">

                        <div class="tab-pane fade show active" id="tab-facturas">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <div class="input-group" style="max-width: 280px;">
                                    <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                                    <input type="text" class="form-control border-start-0" placeholder="Número" style="box-shadow:none;">
                                </div>
                            </div>
                            <div class="table-responsive">
                                <table class="table align-middle mb-0" style="font-size: var(--fs-md);">
                                    <thead>
                                        <tr class="text-muted" style="font-size: var(--fs-sm); background-color: var(--bg-main); border-bottom: 2px solid var(--border-color);">
                                            <th class="fw-medium pb-2">Número</th>
                                            <th class="fw-medium pb-2">Creación</th>
                                            <th class="fw-medium pb-2">Vencimiento</th>
                                            <th class="fw-medium pb-2">Total</th>
                                            <th class="fw-medium pb-2">Cobrado</th>
                                            <th class="fw-medium pb-2">Por cobrar</th>
                                            <th class="fw-medium pb-2">Estado</th>
                                            <th class="fw-medium pb-2 text-end">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(facturasCliente || []).map(f => {
                                            const estadoCalc = calcularEstadoFactura(f, todasLasTransacciones);
                                            const porCobrar = estadoCalc.saldo;
                                            const cobrado = estadoCalc.totalPagado;
                                            
                                            const esAnulada = EstadoUtils.estaAnulado(estadoCalc.estado);
                                            const esCerrada = estadoCalc.estado === 'pagada';
                                            const esBloqueada = esCerrada || esAnulada;

                                            let estadoLabel, estadoColor;
                                            if (esAnulada) {
                                                estadoLabel = 'Anulada'; estadoColor = '#999';
                                            } else if (porCobrar <= 0) {
                                                estadoLabel = 'Cobrada'; estadoColor = '#2cbfb7';
                                            } else if (porCobrar < Number(f.total)) {
                                                estadoLabel = 'Parcial'; estadoColor = '#f39c12';
                                            } else {
                                                estadoLabel = 'Por cobrar'; estadoColor = '#e74c3c';
                                            }
                                            return `
                                            <tr style="border-bottom: 1px solid #f0f0f0; cursor:pointer;" onclick="sessionStorage.setItem('origenVolver', JSON.stringify({hash: '#/contactos/ver/${id}', label: 'Volver al cliente'})); if(!event.target.closest('button') && !event.target.closest('a')) window.location.hash='#/ingresos/facturas/ver/${f.id}'">
                                                <td class="py-3 fw-medium">${f.numero}</td>
                                                <td class="py-3 text-muted">${f.fecha}</td>
                                                <td class="py-3 ${!esCerrada ? 'text-danger' : 'text-muted'}">${f.vencimiento || f.fecha}</td>
                                                <td class="py-3">$${Number(f.total).toLocaleString()}</td>
                                                <td class="py-3 text-muted">$${cobrado.toLocaleString()}</td>
                                                <td class="py-3 text-muted">$${porCobrar.toLocaleString()}</td>
                                                <td class="py-3"><span style="color: ${estadoColor}; font-weight: 500;">${estadoLabel}</span></td>
                                                <td class="py-3 text-end">
                                                    ${esBloqueada 
                                                        ? `<i class="bi bi-pencil text-muted opacity-25 me-2" title="Factura ${esAnulada ? 'anulada' : 'cerrada'}, no editable"></i>
                                                           <i class="bi bi-wallet2 text-muted opacity-25 me-2" title="No se puede abonar"></i>
                                                           <i class="bi bi-trash text-muted opacity-25" title="No se puede eliminar"></i>`
                                                        : `<a href="#/ingresos/facturas/editar/${f.id}" class="btn btn-sm btn-link text-dark p-1" title="Editar"><i class="bi bi-pencil"></i></a>
                                                           <a href="#" class="btn btn-sm btn-link text-dark p-1 btn-abonar-factura" data-id="${f.id}" data-saldo="${porCobrar}" title="Registrar pago"><i class="bi bi-wallet2"></i></a>
                                                           <button class="btn btn-sm btn-link text-danger p-1 btn-delete-row-cliente" data-tabla="facturas" data-id="${f.id}" title="Eliminar"><i class="bi bi-trash"></i></button>`
                                                    }
                                                </td>
                                            </tr>`;
                                        }).join('') || '<tr><td colspan="8" class="text-muted small text-center py-4">Sin facturas</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="tab-pane fade" id="tab-cotizaciones">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <div class="input-group" style="max-width: 280px;">
                                    <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                                    <input type="text" class="form-control border-start-0" placeholder="Número" style="box-shadow:none;">
                                </div>
                            </div>
                            <div class="table-responsive" style="font-size: var(--fs-base);">
                                <table class="table align-middle mb-0" style="font-size: var(--fs-md);">
                                    <thead>
                                        <tr class="text-muted" style="font-size: var(--fs-sm); background-color: var(--bg-main); border-bottom: 2px solid var(--border-color);">
                                            <th class="fw-medium pb-2">Número</th>
                                            <th class="fw-medium pb-2">Creación</th>
                                            <th class="fw-medium pb-2">Total</th>
                                            <th class="fw-medium pb-2">Estado</th>
                                            <th class="fw-medium pb-2 text-end">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(cotizacionesCliente || []).map(c => {
                                            const esAnuladaCot = c.estado === 'void' || c.estado === 'anulada';
                                            let badgeClass = '';
                                            let labelEstado = '';
                                            
                                            if (esAnuladaCot) {
                                                badgeClass = 'bg-secondary text-secondary-emphasis bg-opacity-10 border border-secondary-subtle';
                                                labelEstado = 'Anulada';
                                            } else {
                                                const isFacturada = c.estado === 'billed';
                                                badgeClass = isFacturada ? 'bg-success text-success bg-opacity-10 border border-success-subtle' : 'bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle';
                                                labelEstado = isFacturada ? 'Aprobada' : 'Pendiente';
                                            }
                                            
                                            return `
                                            <tr style="border-bottom: 1px solid #f0f0f0; cursor:pointer;" onclick="sessionStorage.setItem('origenVolver', JSON.stringify({hash: '#/contactos/ver/${id}', label: 'Volver al cliente'})); if(!event.target.closest('button') && !event.target.closest('a')) window.location.hash='#/ingresos/cotizaciones/ver/${c.id}'">
                                                <td class="py-3 fw-medium">${c.numero}</td>
                                                <td class="py-3 text-muted">${c.fecha}</td>
                                                <td class="py-3">$${Number(c.total).toLocaleString()}</td>
                                                <td class="py-3"><span class="badge ${badgeClass} rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">${labelEstado}</span></td>
                                                <td class="py-3 text-end">
                                                    ${esAnuladaCot 
                                                        ? `<i class="bi bi-pencil text-muted opacity-25 me-2"></i><i class="bi bi-trash text-muted opacity-25"></i>`
                                                        : `<a href="#/ingresos/cotizaciones/editar/${c.id}" class="btn btn-sm btn-link text-dark p-1" title="Editar"><i class="bi bi-pencil"></i></a>
                                                           <button class="btn btn-sm btn-link text-danger p-1 btn-delete-row-cliente" data-tabla="cotizaciones" data-id="${c.id}" title="Eliminar"><i class="bi bi-trash"></i></button>`
                                                    }
                                                </td>
                                            </tr>`;
                                        }).join('') || '<tr><td colspan="5" class="text-muted small text-center py-4">Sin cotizaciones</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="tab-pane fade" id="tab-transacciones">
                            <div class="table-responsive" style="font-size: var(--fs-base);">
                                <table class="table align-middle mb-0" style="font-size: var(--fs-md);">
                                    <thead>
                                        <tr class="text-muted" style="font-size: var(--fs-sm); background-color: var(--bg-main); border-bottom: 2px solid var(--border-color);">
                                            <th class="fw-medium pb-2">Fecha</th>
                                            <th class="fw-medium pb-2">Concepto</th>
                                            <th class="fw-medium pb-2">Monto</th>
                                            <th class="fw-medium pb-2 text-end">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(transaccionesAgrupadas || []).map(t => `
                                            <tr style="border-bottom: 1px solid #f0f0f0; cursor:pointer;" data-id="${t.id}">
                                                <td class="py-3 text-muted">${t.fecha}</td>
                                                <td class="py-3">${t.categoria || t.observaciones || ''}</td>
                                                <td class="py-3" style="color: ${t.tipo === 'in' ? '#2cbfb7' : '#e74c3c'}; font-weight: 500;">${t.tipo === 'in' ? '+' : '-'}$${Number(t.monto).toLocaleString()}</td>
                                                <td class="py-3 text-end">
                                                    <button class="btn btn-sm btn-link text-dark p-1 btn-editar-transaccion-cliente" data-id="${t.id}" title="Editar"><i class="bi bi-pencil"></i></button>
                                                    <button class="btn btn-sm btn-link text-danger p-1 btn-anular-transaccion-cliente" data-id="${t.id}" title="Anular"><i class="bi bi-trash"></i></button>
                                                </td>
                                            </tr>`).join('') || '<tr><td colspan="4" class="text-muted small text-center py-4">Sin transacciones</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        `;

        this.element.querySelectorAll('.btn-editar-transaccion-cliente').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const tId = btn.dataset.id;
                const t = (transaccionesAgrupadas || []).find(x => String(x.id) === String(tId));
                if (!t) return;
                await mostrarDetalleTransaccion(t, () => this.renderDetalle(id));
            });
        });

        this.element.querySelectorAll('#tab-transacciones tbody tr[data-id]').forEach(row => {
            row.addEventListener('click', async (e) => {
                if (e.target.closest('button')) return;
                const tId = row.dataset.id;
                const t = (transaccionesAgrupadas || []).find(x => String(x.id) === String(tId));
                if (!t) return;
                await mostrarDetalleTransaccion(t, () => this.renderDetalle(id));
            });
        });

        this.element.querySelector('.btn-editar-contacto-detalle')?.addEventListener('click', () => {
            this.renderForm(id);
        });

        this.element.querySelectorAll('.btn-abonar-factura').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const facId = btn.dataset.id;
                AbonoModal.show(facId, () => this.renderDetalle(id));
            });
        });

        this.element.querySelectorAll('.btn-delete-row-cliente').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!confirm('¿Eliminar este registro?')) return;
                await DB.delete(btn.dataset.tabla, btn.dataset.id);
                this.renderDetalle(id);
            });
        });

        this.element.querySelectorAll('.btn-anular-transaccion-cliente').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!confirm('¿Seguro que deseas anular este movimiento?')) return;
                await supabase.from('pagos_ingresos').update({ estado: 'anulado' }).eq('id', btn.dataset.id);
                this.renderDetalle(id);
            });
        });

        this.element.querySelector('#btn-volver-perfil')?.addEventListener('click', () => {
            this.restaurarVistaTabla();
        });
    },

    async restaurarVistaTabla() {
        const actionView = this.element.querySelector('#contactos-action-view');
        const listView = this.element.querySelector('#contactos-list-view');
        const tabs = this.element.querySelector('#contactos-tabs');
        const kpiRow = this.element.querySelector('#contactos-kpi-row');

        if (actionView) {
            actionView.innerHTML = '';
            actionView.style.display = 'none';
        }
        if (listView) listView.style.display = 'block';
        if (tabs) tabs.style.display = 'flex';
        if (kpiRow) kpiRow.style.display = 'flex';

        await this.cargarPagina();
    },

    renderQuickModal(query, onSuccessCallback) {
        const existingModal = document.getElementById('quick-contacto-modal');
        if (existingModal) existingModal.remove();

        // Determinar si la búsqueda parece un NIT o un Nombre
        const isNit = /^[\d-]+$/.test(query);
        const defaultName = isNit ? '' : query;
        const defaultNit = isNit ? query : '';

        const modalHtml = `
            <div class="modal fade" id="quick-contacto-modal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow">
                        <div class="modal-header border-bottom-0 pb-0">
                            <h5 class="modal-title fw-bold">Crear Contacto Rápido</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="quick-contacto-form">
                                <div class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label small fw-bold text-muted mb-1">Nombre / Razón Social <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="quick-nombre" value="${defaultName}" required autocomplete="off">
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label small fw-bold text-muted mb-1">NIT / Identificación <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="quick-nit" value="${defaultNit}" required autocomplete="off">
                                    </div>
                                    <div class="col-12 col-sm-6">
                                        <label class="form-label small fw-bold text-muted mb-1 d-block">Tipo <span class="text-danger">*</span></label>
                                        <div class="form-check form-check-inline mt-2">
                                            <input class="form-check-input" type="checkbox" id="quick-es-cliente" checked>
                                            <label class="form-check-label small" for="quick-es-cliente">Cliente</label>
                                        </div>
                                        <div class="form-check form-check-inline mt-2">
                                            <input class="form-check-input" type="checkbox" id="quick-es-proveedor">
                                            <label class="form-check-label small" for="quick-es-proveedor">Proveedor</label>
                                        </div>
                                    </div>
                                    <div class="col-12 col-sm-6">
                                        <label class="form-label small fw-bold text-muted mb-1">Teléfono</label>
                                        <input type="text" class="form-control" id="quick-telefono" autocomplete="off">
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer border-top-0 pt-0">
                            <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="btn-save-quick-contacto">Guardar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('quick-contacto-modal');
        const modalInstance = new bootstrap.Modal(modalEl);
        
        modalEl.querySelector('#btn-save-quick-contacto').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const form = modalEl.querySelector('#quick-contacto-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

            const esCliente = modalEl.querySelector('#quick-es-cliente').checked;
            const esProveedor = modalEl.querySelector('#quick-es-proveedor').checked;
            if (!esCliente && !esProveedor) {
                alert("Debe seleccionar al menos un tipo de contacto.");
                modalEl.querySelector('#btn-save-quick-contacto').disabled = false;
                modalEl.querySelector('#btn-save-quick-contacto').innerHTML = 'Guardar';
                return;
            }

            const nuevoContacto = {
                nombre: modalEl.querySelector('#quick-nombre').value.trim(),
                nit: modalEl.querySelector('#quick-nit').value.trim(),
                es_cliente: esCliente,
                es_proveedor: esProveedor,
                tipo: esProveedor && !esCliente ? 'proveedor' : 'cliente',
                telefono: modalEl.querySelector('#quick-telefono').value.trim() || null,
                email: null,
                direccion: null,
                ciudad: null,
                regimen: 'Regimen Simplificado',
                cupoCredito: 0,
                plazosPago: 0,
                fechaCreacion: new Date().toISOString()
            };

            try {
                // Check for duplicates
                const { data: existing } = await DB.client.from('contactos')
                    .select('id').eq('identificacion', nuevoContacto.nit).single();

                if (existing) throw new Error('Ya existe un contacto con esta identificación');

                const savedContacto = await DB.save('contactos', nuevoContacto);
                
                modalInstance.hide();
                if (onSuccessCallback) onSuccessCallback(savedContacto);
            } catch (err) {
                console.error(err);
                alert('Error al guardar contacto: ' + err.message);
                btn.disabled = false;
                btn.innerHTML = 'Guardar';
            }
        });

        modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
        modalInstance.show();
    }
};
