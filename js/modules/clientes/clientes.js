// js/modules/clientes/clientes.js
// Módulo de Gestión de Contactos (Clientes y Proveedores) - Hoja Completa

import DB from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { AbonoModal } from '../../shared/abonoModal.js';
import { calcularEstadoFactura } from '../../shared/carteraUtils.js';
import { CATEGORIAS_GASTO } from '../gastos/gastos.js';
import { agruparTransaccionesPorPago } from '../../shared/transaccionesUtils.js';
import { mostrarDetalleTransaccion } from '../../shared/transaccionModal.js';

export const ContactosModule = {
    state: {
        contactosData: [],
        currentPage: 1,
        itemsPerPage: 10,
        currentFilter: 'todos',
        searchQuery: ''
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        this.state.searchQuery = '';
        this.state.currentFilter = 'todos';
        this.state.currentPage = 1;
        
        // Renderizar contenedor principal de hoja completa
        element.innerHTML = `
            <div class="module-container bg-white rounded shadow-sm p-4">
                <!-- Header -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h4 mb-1 text-dark fw-bold">Gestión de Contactos</h2>
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
                        <button id="btn-refresh-list" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: 14px; color: var(--text-body);">
                            <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
                        </button>
                        <button id="btn-nuevo-contacto" class="btn btn-primary d-flex align-items-center gap-2" style="background-color: var(--primary); border: none;">
                            <i class="bi bi-plus-lg"></i> Nuevo contacto
                        </button>
                    </div>
                </div>

                <!-- Pestañas de Filtro (Tabs) -->
                <ul class="nav nav-tabs mb-4 border-bottom-0 gap-3" id="contactos-tabs" style="border-bottom: 2px solid var(--border-color) !important;">
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

                <div id="contactos-view-container" class="view-container">
                    <!-- Buscador y Tabla Principal -->
                    <div id="tabla-contactos-wrapper">
                        <!-- Buscador -->
                        <div class="d-flex justify-content-between mb-3">
                            <div class="input-group" style="max-width: 300px;">
                                <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                                <input type="text" id="search-contacto" class="form-control border-start-0 ps-0" placeholder="Buscar..." style="box-shadow: none;">
                            </div>
                            <button id="btn-filtrar" class="btn btn-light border text-muted"><i class="bi bi-funnel"></i> Filtrar</button>
                        </div>

                        <!-- Tabla -->
                        <div class="table-responsive">
                            <table class="table table-hover align-middle">
                                <thead class="table-light text-muted small text-uppercase">
                                    <tr>
                                        <th style="width: 40px;"><input type="checkbox" class="form-check-input" id="check-all"></th>
                                        <th>Nombre <i class="bi bi-arrow-up-short"></i></th>
                                        <th>Identificación</th>
                                        <th>Teléfono</th>
                                        <th>Tipo</th>
                                        <th class="text-end">Acciones</th>
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
            </div>
        `;

        this.bindEvents();

        const hashParts = window.location.hash.split('/');
        const action = hashParts[2];
        const routeId = hashParts[3];

        if (action === 'ver' && routeId) {
            await this.renderDetalle(routeId);
        } else if (action === 'nueva') {
            await this.cargarDatos(); // Carga inicial
            this.renderTabla();       // Render inicial
            this.renderForm();        // Abre el modal de nuevo contacto
        } else {
            await this.cargarDatos(); // Carga inicial
            this.renderTabla();       // Render inicial
        }
    },

    async cargarDatos() {
        // Obtenemos de Firestore vía el enrutador de DB
        const raw = await DB.getAll('contactos');
        this.state.contactosData = raw; // Se eliminó el filtro especulativo de 'estado !== inactivo'
    },

    renderTabla() {
        const wrapper = this.element.querySelector('#tabla-contactos-wrapper');
        if (wrapper) wrapper.style.display = 'block';

        const container = this.element.querySelector('#tbody-contactos');
        if (!container) return;

        const { contactosData, currentFilter, searchQuery, itemsPerPage } = this.state;

        // A. Filtrado por Tipo y Búsqueda (Combinado)
        let filtrados = contactosData.filter(c => {
            if (currentFilter !== 'todos' && c.tipo !== currentFilter) return false;
            if (searchQuery) {
                const searchStr = `${c.nombre || ''} ${c.nit || ''} ${c.telefono || ''}`.toLowerCase();
                if (!searchStr.includes(searchQuery)) return false;
            }
            return true;
        });

        // B. Cálculos de Paginación
        const totalItems = filtrados.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        
        if (this.state.currentPage > totalPages) {
            this.state.currentPage = totalPages;
        }

        const startIndex = (this.state.currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
        const paginaActual = filtrados.slice(startIndex, endIndex);

        // C. Renderizado
        if (paginaActual.length === 0) {
            container.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No se encontraron contactos que coincidan con la búsqueda.</td></tr>`;
        } else {
            let html = '';
            paginaActual.forEach(c => {
                const inicial = c.nombre ? c.nombre.charAt(0).toUpperCase() : '?';
                html += `
                    <tr data-id="${c.id}" style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);" onclick="if(!event.target.closest('button') && !event.target.closest('input')) window.location.hash = '#/contactos/ver/${c.id}'">
                        <td><input type="checkbox" class="form-check-input contact-check"></td>
                        <td>
                            <div class="d-flex align-items-center gap-3">
                                <div class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0" style="width: 32px; height: 32px; background-color: var(--primary); font-size: 14px;">
                                    ${inicial}
                                </div>
                                <span class="fw-medium text-dark text-capitalize text-truncate" style="max-width: 200px;">${c.nombre ? c.nombre.toLowerCase() : ''}</span>
                            </div>
                        </td>
                        <td class="text-muted">${c.nit || '-'}</td>
                        <td class="text-muted">${c.telefono || '-'}</td>
                        <td class="text-muted text-capitalize">${c.tipo || '-'}</td>
                        <td class="text-end">
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

        // D. Actualización UI Paginación
        const paginasEl = this.element.querySelector('#current-page');
        if(paginasEl) paginasEl.textContent = this.state.currentPage;
        
        const totalPagEl = this.element.querySelector('#total-pages');
        if(totalPagEl) totalPagEl.textContent = totalPages;
        
        const showingCountEl = this.element.querySelector('#showing-count');
        if(showingCountEl) showingCountEl.textContent = totalItems > 0 ? `${startIndex + 1}-${endIndex} de ${totalItems}` : `0-0 de 0`;
        
        const prevBtn = this.element.querySelector('#btn-prev-page');
        if(prevBtn) prevBtn.disabled = (this.state.currentPage === 1);
        
        const nextBtn = this.element.querySelector('#btn-next-page');
        if(nextBtn) nextBtn.disabled = (this.state.currentPage === totalPages);

        this.bindFilaEvents();
    },

    bindEvents() {
        const el = this.element;

        el.querySelector('#btn-nuevo-contacto')?.addEventListener('click', () => this.renderForm());

        el.querySelector('#btn-refresh-list')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`;
            
            this.state.contactosData = await DB.refreshCache('contactos');
            this.renderTabla();
            
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        });

        el.querySelector('#search-contacto')?.addEventListener('input', (e) => {
            this.state.searchQuery = e.target.value.toLowerCase().trim();
            this.state.currentPage = 1;
            this.renderTabla();
        });

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
                this.renderTabla();
            });
        });

        el.querySelector('#items-per-page')?.addEventListener('change', (e) => {
            this.state.itemsPerPage = parseInt(e.target.value);
            this.state.currentPage = 1;
            this.renderTabla();
        });

        el.querySelector('#btn-prev-page')?.addEventListener('click', () => {
            if (this.state.currentPage > 1) {
                this.state.currentPage--;
                this.renderTabla();
            }
        });

        el.querySelector('#btn-next-page')?.addEventListener('click', () => {
            this.state.currentPage++;
            this.renderTabla();
        });

        el.querySelector('#btn-refresh')?.addEventListener('click', async (e) => {
            const icon = e.currentTarget.querySelector('i');
            if(icon) icon.classList.add('spin-animation');
            await this.cargarDatos();
            this.renderTabla();
            if(icon) setTimeout(() => icon.classList.remove('spin-animation'), 500);
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
                if (confirm('¿Está seguro de eliminar este contacto?')) {
                    await DB.delete('contactos', e.currentTarget.dataset.id);
                    await this.cargarDatos();
                    this.renderTabla();
                }
            });
        });
    },

    async renderForm(id = null) {
        const container = this.element.querySelector('#contactos-view-container');
        if (!container) return;

        const tabs = this.element.querySelector('#contactos-tabs');
        if (tabs) tabs.style.display = 'none';

        let contacto = { nombre: '', nit: '', tipo: 'cliente', telefono: '', email: '', ciudad: '', direccion: '', regimen: 'Regimen Simplificado', cupoCredito: 0, plazosPago: 0 };
        
        if (id) {
            contacto = await DB.get('contactos', id) || contacto;
        }

        container.innerHTML = `
            <div class="form-hoja-completa bg-white p-4 rounded border">
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
                            <label class="form-label text-muted small fw-medium">Tipo de Contacto</label>
                            <select id="form-tipo" class="form-select form-select-sm">
                                <option value="cliente" ${contacto.tipo === 'cliente' ? 'selected' : ''}>Cliente</option>
                                <option value="proveedor" ${contacto.tipo === 'proveedor' ? 'selected' : ''}>Proveedor</option>
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
                        <button type="submit" class="btn btn-primary" style="background-color: var(--primary); border: none;">Guardar Contacto</button>
                    </div>
                </form>
            </div>
        `;

        this.element.querySelector('#btn-cancelar-contacto')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.restaurarVistaTabla();
        });

        this.element.querySelector('#form-contacto-data')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const datos = {
                nombre: this.element.querySelector('#form-nombre').value,
                nit: this.element.querySelector('#form-nit').value,
                tipo: this.element.querySelector('#form-tipo').value,
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
            await this.cargarDatos();
            this.restaurarVistaTabla();
        });
    },

    async renderDetalle(id) {
        const container = this.element.querySelector('#contactos-view-container');
        if (!container) return;

        const tabs = this.element.querySelector('#contactos-tabs');
        if (tabs) tabs.style.display = 'none';

        const contacto = await DB.get('contactos', id);
        if (!contacto) return;

        const { data: facturasCliente } = await supabase
            .from('facturas')
            .select('id, numero, fecha, vencimiento, total, saldo_original, estado')
            .eq('contacto_id', id)
            .order('fecha', { ascending: false })
            .limit(50);

        const facturaIdsCliente = (facturasCliente || []).map(f => f.id);
        const { data: todasLasTransacciones } = facturaIdsCliente.length > 0
            ? await supabase.from('pagos_ingresos').select('*').in('factura_id', facturaIdsCliente)
            : { data: [] };

        const { data: cotizacionesCliente } = await supabase
            .from('cotizaciones')
            .select('id, numero, fecha, total, estado')
            .eq('contacto_id', id)
            .order('fecha', { ascending: false })
            .limit(50);

        const { data: transaccionesCliente } = await supabase
            .from('pagos_ingresos')
            .select('id, tipo, monto, fecha, categoria, observaciones, grupo_pago_id, cuenta_id')
            .eq('contacto_id', id)
            .neq('estado', 'void')
            .order('fecha', { ascending: false })
            .limit(50);

        const transaccionesAgrupadas = agruparTransaccionesPorPago(transaccionesCliente);

        let saldoPorCobrarTotal = 0;
        (facturasCliente || []).forEach(f => {
            const estadoCalc = calcularEstadoFactura(f, todasLasTransacciones || []);
            if (estadoCalc.estado !== 'anulada' && estadoCalc.estado !== 'void') {
                saldoPorCobrarTotal += estadoCalc.saldo;
            }
        });

        const colorSaldo = saldoPorCobrarTotal > 0 ? '#e74c3c' : '#2cbfb7';

        container.innerHTML = `
            <div class="perfil-hoja-completa bg-white p-4 rounded border">
                <div class="d-flex align-items-center mb-3">
                    <button id="btn-volver-perfil"
                        class="btn btn-link text-decoration-none p-0 me-3 d-flex align-items-center"
                        style="color: var(--text-body) !important; font-weight: var(--weight-medium); transition: color 0.2s;">
                        <i class="bi bi-arrow-left me-2"></i>Volver a Contactos
                    </button>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                    <h3 class="h5 m-0 fw-bold">${contacto.nombre}</h3>
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
                                <h2 class="m-0 fw-bold" style="color: ${colorSaldo}; font-size: 28px; word-break: break-all;">
                                    $${saldoPorCobrarTotal.toLocaleString('es-CO', {minimumFractionDigits: 0})}
                                </h2>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-4">
                    <ul class="nav nav-tabs flex-nowrap overflow-auto" id="tabs-detalle-cliente" style="white-space: nowrap;">
                        <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-facturas" style="font-size: 14px; white-space: nowrap;">Facturas</button></li>
                        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-cotizaciones" style="font-size: 14px; white-space: nowrap;">Cotizaciones</button></li>
                        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-transacciones" style="font-size: 14px; white-space: nowrap;">Transacciones</button></li>
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
                                <table class="table align-middle mb-0" style="font-size: 14px;">
                                    <thead>
                                        <tr class="text-muted" style="font-size: 12px; background-color: #fafbfc; border-bottom: 2px solid #eee;">
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
                                            
                                            const esAnulada = estadoCalc.estado === 'anulada';
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
                            <div class="table-responsive" style="font-size: 13px;">
                                <table class="table align-middle mb-0" style="font-size: 14px;">
                                    <thead>
                                        <tr class="text-muted" style="font-size: 12px; background-color: #fafbfc; border-bottom: 2px solid #eee;">
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
                                            return `
                                            <tr style="border-bottom: 1px solid #f0f0f0; cursor:pointer;" onclick="sessionStorage.setItem('origenVolver', JSON.stringify({hash: '#/contactos/ver/${id}', label: 'Volver al cliente'})); if(!event.target.closest('button') && !event.target.closest('a')) window.location.hash='#/ingresos/cotizaciones/ver/${c.id}'">
                                                <td class="py-3 fw-medium">${c.numero}</td>
                                                <td class="py-3 text-muted">${c.fecha}</td>
                                                <td class="py-3">$${Number(c.total).toLocaleString()}</td>
                                                <td class="py-3"><span style="color: ${esAnuladaCot ? '#999' : '#4b5563'};">${c.estado}</span></td>
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
                            <div class="table-responsive" style="font-size: 13px;">
                                <table class="table align-middle mb-0" style="font-size: 14px;">
                                    <thead>
                                        <tr class="text-muted" style="font-size: 12px; background-color: #fafbfc; border-bottom: 2px solid #eee;">
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
        await this.cargarDatos();
        const tabs = this.element.querySelector('#contactos-tabs');
        if (tabs) tabs.style.display = 'flex';
        
        const container = this.element.querySelector('#contactos-view-container');
        if (container) {
            container.innerHTML = `
                <div id="tabla-contactos-wrapper">
                    <div class="d-flex justify-content-between mb-3">
                        <div class="input-group" style="max-width: 300px;">
                            <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                            <input type="text" id="search-contacto" class="form-control border-start-0 ps-0" placeholder="Buscar..." style="box-shadow: none;">
                        </div>
                        <button id="btn-filtrar" class="btn btn-light border text-muted"><i class="bi bi-funnel"></i> Filtrar</button>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle">
                            <thead class="table-light text-muted small text-uppercase">
                                <tr>
                                    <th style="width: 40px;"><input type="checkbox" class="form-check-input" id="check-all"></th>
                                    <th>Nombre <i class="bi bi-arrow-up-short"></i></th>
                                    <th>Identificación</th>
                                    <th>Teléfono</th>
                                    <th>Tipo</th>
                                    <th class="text-end">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-contactos"></tbody>
                        </table>
                    </div>
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
                                    <option value="10" ${this.state.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                                    <option value="25" ${this.state.itemsPerPage === 25 ? 'selected' : ''}>25</option>
                                    <option value="50" ${this.state.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                                </select>
                            </span>
                            <span id="showing-count">1-10 de 709</span>
                            <button id="btn-refresh" class="btn btn-sm btn-light border text-muted rounded-circle" style="width: 30px; height: 30px; padding: 0;"><i class="bi bi-arrow-clockwise"></i></button>
                        </div>
                    </div>
                </div>
            `;
            if(this.state.searchQuery) {
                const search = this.element.querySelector('#search-contacto');
                if(search) search.value = this.state.searchQuery;
            }
            this.bindEvents();
            this.renderTabla();
        }
    }
};
