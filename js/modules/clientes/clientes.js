// js/modules/clientes/clientes.js
// Módulo de Gestión de Contactos (Clientes y Proveedores) - Hoja Completa

import { ContactosData } from './clientes.data.js';
import { ContactosTemplates } from './clientes.templates.js';
import { ContactosEvents } from './clientes.events.js';

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
                        <h2 class="page-title">Gestión de Contactos</h2>
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

                <div class="dash-table-container">
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
                                        <thead>
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
    }
};

Object.assign(ContactosModule, ContactosData, ContactosTemplates, ContactosEvents);
