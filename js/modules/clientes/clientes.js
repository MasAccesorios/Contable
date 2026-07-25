// js/modules/contactos.js
// Módulo de Gestión de Contactos (Clientes y Proveedores) - Hoja Completa

import DB from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';

export const ContactosModule = {
    async init(element) {
        if (!element) return;
        
        // Renderizar contenedor principal de hoja completa
        element.innerHTML = `
            <div class="module-container">
                <div class="module-header">
                    <h2>Gestión de Contactos (Clientes / Proveedores)</h2>
                    <button id="btn-nuevo-contacto" class="btn-primary">+ Nuevo Contacto</button>
                </div>
                
                <div class="filters-bar">
                    <input type="text" id="search-contacto" placeholder="Buscar por nombre, NIT o teléfono..." class="input-search">
                    <select id="filter-tipo" class="select-filter">
                        <option value="todos">Todos los tipos</option>
                        <option value="cliente">Clientes</option>
                        <option value="proveedor">Proveedores</option>
                    </select>
                </div>

                <div id="contactos-view-container" class="view-container">
                    <!-- Aquí se cargará dinámicamente la tabla o el formulario -->
                </div>
            </div>
        `;

        // Enganchar eventos principales
        element.querySelector('#btn-nuevo-contacto')?.addEventListener('click', () => this.renderForm(element));
        element.querySelector('#search-contacto')?.addEventListener('input', () => this.filtrarContactos(element));
        element.querySelector('#filter-tipo')?.addEventListener('change', () => this.filtrarContactos(element));

        // Cargar vista de tabla por defecto
        await this.renderTabla(element);
    },

    /**
     * Lógica centralizada para guardar un contacto en la base de datos
     */
    async guardarContacto(datos, id = null) {
        const nuevoContacto = {
            id: id || 'cont_' + Date.now(),
            ...datos
        };
        await DB.save('contactos', nuevoContacto);
        return nuevoContacto;
    },

    async renderTabla(element) {
        const container = element.querySelector('#contactos-view-container');
        if (!container) return;

        const contactos = await DB.getAll('contactos');
        
        if (contactos.length === 0) {
            container.innerHTML = `<p class="empty-state">No hay contactos registrados en el sistema.</p>`;
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table-main">
                    <thead>
                        <tr>
                            <th>Nombre / Razón Social</th>
                            <th>NIT / CC</th>
                            <th>Tipo</th>
                            <th>Teléfono</th>
                            <th>Ciudad</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-contactos">
        `;

        contactos.forEach(c => {
            if (c.estado === 'inactivo') return; // Soft delete check
            html += `
                <tr data-id="${c.id}">
                    <td><strong>${c.nombre}</strong></td>
                    <td>${c.nit}</td>
                    <td><span class="badge ${c.tipo}">${c.tipo.toUpperCase()}</span></td>
                    <td>${c.telefono || 'N/A'}</td>
                    <td>${c.ciudad || 'N/A'}</td>
                    <td>
                        <button class="btn-action btn-ver" data-id="${c.id}">Ver</button>
                        <button class="btn-action btn-editar" data-id="${c.id}">Editar</button>
                        <button class="btn-action btn-eliminar" data-id="${c.id}" style="color: red;">Eliminar</button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;

        // Asignar eventos a los botones de la tabla
        container.querySelectorAll('.btn-ver').forEach(btn => {
            btn.addEventListener('click', (e) => this.renderDetalle(element, e.target.dataset.id));
        });
        container.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', (e) => this.renderForm(element, e.target.dataset.id));
        });
        container.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('¿Está seguro de eliminar este contacto?')) {
                    await CoreActions.softDelete('contactos', e.target.dataset.id);
                    await this.renderTabla(element);
                }
            });
        });
    },

    async renderForm(element, id = null) {
        const container = element.querySelector('#contactos-view-container');
        if (!container) return;

        let contacto = { nombre: '', nit: '', tipo: 'cliente', telefono: '', email: '', ciudad: '', direccion: '', regimen: 'Regimen Simplificado', cupoCredito: 0, plazosPago: 0 };
        
        if (id) {
            contacto = await DB.get('contactos', id) || contacto;
        }

        container.innerHTML = `
            <div class="form-hoja-completa">
                <h3>${id ? 'Editar Contacto' : 'Crear Nuevo Contacto'}</h3>
                <form id="form-contacto-data">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Nombre o Razón Social *</label>
                            <input type="text" id="form-nombre" value="${contacto.nombre}" required>
                        </div>
                        <div class="form-group">
                            <label>NIT o Cédula *</label>
                            <input type="text" id="form-nit" value="${contacto.nit}" required>
                        </div>
                        <div class="form-group">
                            <label>Tipo de Contacto</label>
                            <select id="form-tipo">
                                <option value="cliente" ${contacto.tipo === 'cliente' ? 'selected' : ''}>Cliente</option>
                                <option value="proveedor" ${contacto.tipo === 'proveedor' ? 'selected' : ''}>Proveedor</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Teléfono</label>
                            <input type="text" id="form-telefono" value="${contacto.telefono}">
                        </div>
                        <div class="form-group">
                            <label>Correo Electrónico</label>
                            <input type="email" id="form-email" value="${contacto.email}">
                        </div>
                        <div class="form-group">
                            <label>Ciudad</label>
                            <input type="text" id="form-ciudad" value="${contacto.ciudad}">
                        </div>
                        <div class="form-group">
                            <label>Dirección</label>
                            <input type="text" id="form-direccion" value="${contacto.direccion}">
                        </div>
                        <div class="form-group">
                            <label>Régimen Tributario</label>
                            <select id="form-regimen">
                                <option value="Regimen Simplificado" ${contacto.regimen === 'Regimen Simplificado' ? 'selected' : ''}>Régimen Simplificado (No responsable de IVA)</option>
                                <option value="Regimen Comun" ${contacto.regimen === 'Regimen Comun' ? 'selected' : ''}>Régimen Común (Responsable de IVA)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Cupo de Crédito ($)</label>
                            <input type="number" id="form-cupo" value="${contacto.cupoCredito || 0}">
                        </div>
                        <div class="form-group">
                            <label>Plazos de Pago (Días)</label>
                            <input type="number" id="form-plazos" value="${contacto.plazosPago || 0}">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" id="btn-cancelar-contacto" class="btn-secondary">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar Contacto</button>
                    </div>
                </form>
            </div>
        `;

        element.querySelector('#btn-cancelar-contacto')?.addEventListener('click', () => this.renderTabla(element));
        element.querySelector('#form-contacto-data')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const datos = {
                nombre: element.querySelector('#form-nombre').value,
                nit: element.querySelector('#form-nit').value,
                tipo: element.querySelector('#form-tipo').value,
                telefono: element.querySelector('#form-telefono').value,
                email: element.querySelector('#form-email').value,
                ciudad: element.querySelector('#form-ciudad').value,
                direccion: element.querySelector('#form-direccion').value,
                regimen: element.querySelector('#form-regimen').value,
                cupoCredito: parseFloat(element.querySelector('#form-cupo').value) || 0,
                plazosPago: parseInt(element.querySelector('#form-plazos').value) || 0
            };

            await this.guardarContacto(datos, id);
            this.renderTabla(element);
        });
    },

    async renderDetalle(element, id) {
        const container = element.querySelector('#contactos-view-container');
        if (!container) return;

        const contacto = await DB.get('contactos', id);
        if (!contacto) return;

        container.innerHTML = `
            <div class="perfil-hoja-completa">
                <div class="perfil-header">
                    <h3>${contacto.nombre}</h3>
                    <button id="btn-volver-perfil" class="btn-secondary">Volver al listado</button>
                </div>
                <div class="perfil-grid">
                    <div class="info-card">
                        <h4>Datos Básicos</h4>
                        <p><strong>Identificación:</strong> ${contacto.nit}</p>
                        <p><strong>Tipo:</strong> ${contacto.tipo.toUpperCase()}</p>
                        <p><strong>Teléfono:</strong> ${contacto.telefono || 'No registrado'}</p>
                        <p><strong>Email:</strong> ${contacto.email || 'No registrado'}</p>
                        <p><strong>Ubicación:</strong> ${contacto.direccion || ''} ${contacto.ciudad ? `(${contacto.ciudad})` : ''}</p>
                    </div>
                    <div class="info-card">
                        <h4>Condiciones Comerciales</h4>
                        <p><strong>Régimen:</strong> ${contacto.regimen || 'Regimen Simplificado'}</p>
                        <p><strong>Cupo de Crédito:</strong> $${(contacto.cupoCredito || 0).toLocaleString()}</p>
                        <p><strong>Plazos de Pago:</strong> ${contacto.plazosPago || 0} días</p>
                    </div>
                </div>
            </div>
        `;

        element.querySelector('#btn-volver-perfil')?.addEventListener('click', () => this.renderTabla(element));
    },

    async filtrarContactos(element) {
        const query = element.querySelector('#search-contacto')?.value.toLowerCase() || '';
        const tipo = element.querySelector('#filter-tipo')?.value || 'todos';
        const tbody = element.querySelector('#tbody-contactos');
        if (!tbody) return;

        const contactos = await DB.getAll('contactos');

        tbody.innerHTML = '';
        contactos.forEach(c => {
            if (c.estado === 'inactivo') return; // Soft delete check
            const matchQuery = c.nombre.toLowerCase().includes(query) || c.nit.includes(query);
            const matchTipo = tipo === 'todos' || c.tipo === tipo;

            if (matchQuery && matchTipo) {
                tbody.innerHTML += `
                    <tr data-id="${c.id}">
                        <td><strong>${c.nombre}</strong></td>
                        <td>${c.nit}</td>
                        <td><span class="badge ${c.tipo}">${c.tipo.toUpperCase()}</span></td>
                        <td>${c.telefono || 'N/A'}</td>
                        <td>${c.ciudad || 'N/A'}</td>
                        <td>
                            <button class="btn-action btn-ver" data-id="${c.id}">Ver</button>
                            <button class="btn-action btn-editar" data-id="${c.id}">Editar</button>
                            <button class="btn-action btn-eliminar" data-id="${c.id}" style="color: red;">Eliminar</button>
                        </td>
                    </tr>
                `;
            }
        });
        
        tbody.querySelectorAll('.btn-ver').forEach(btn => {
            btn.addEventListener('click', (e) => this.renderDetalle(element, e.target.dataset.id));
        });
        tbody.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', (e) => this.renderForm(element, e.target.dataset.id));
        });
        tbody.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('¿Está seguro de eliminar este contacto?')) {
                    await CoreActions.softDelete('contactos', e.target.dataset.id);
                    await this.filtrarContactos(element);
                }
            });
        });
    },

    /**
     * Renderiza un modal rápido (Bootstrap) para crear un cliente mínimo.
     * @param {string} query - El texto que el usuario escribió en el buscador.
     * @param {function} callback - Función a ejecutar con el contacto recién creado.
     */
    renderQuickModal(query, callback) {
        // 1. Crear la estructura del modal dinámicamente si no existe en el DOM
        let modalEl = document.getElementById('quick-cliente-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'quick-cliente-modal';
            modalEl.className = 'modal fade';
            modalEl.setAttribute('tabindex', '-1');
            modalEl.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Crear Cliente Rápido</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                        </div>
                        <div class="modal-body">
                            <form id="form-quick-cliente">
                                <div class="mb-3">
                                    <label class="form-label">Nombre o Razón Social <span style="color:red">*</span></label>
                                    <input type="text" class="form-control" id="quick-nombre" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">NIT / CC <span style="color:red">*</span></label>
                                    <input type="text" class="form-control" id="quick-nit" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Teléfono</label>
                                    <input type="tel" class="form-control" id="quick-telefono">
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="btn-save-quick-cliente">Guardar Cliente</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);
        }

        // 2. Instanciar el modal de Bootstrap
        const modalInstance = new bootstrap.Modal(modalEl);

        // 3. Precargar datos y resetear el formulario
        const inputNombre = modalEl.querySelector('#quick-nombre');
        const inputNit = modalEl.querySelector('#quick-nit');
        const inputTelefono = modalEl.querySelector('#quick-telefono');
        const form = modalEl.querySelector('#form-quick-cliente');

        form.reset();
        inputNombre.value = query || '';
        
        // 4. Configurar el evento de guardado
        const btnSave = modalEl.querySelector('#btn-save-quick-cliente');
        
        // Evitar suscripciones múltiples clonando y reemplazando el botón
        const newBtnSave = btnSave.cloneNode(true);
        btnSave.parentNode.replaceChild(newBtnSave, btnSave);
        
        newBtnSave.addEventListener('click', async () => {
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            // Datos mínimos explícitos
            const datos = {
                nombre: inputNombre.value.trim(),
                nit: inputNit.value.trim(),
                telefono: inputTelefono.value.trim(),
                tipo: 'cliente',
                regimen: 'Regimen Simplificado',
                cupoCredito: 0,
                plazosPago: 0,
                fechaCreacion: new Date().toISOString()
            };

            try {
                newBtnSave.disabled = true;
                newBtnSave.textContent = 'Guardando...';

                // Usamos la lógica centralizada de la línea 46
                const nuevoContacto = await this.guardarContacto(datos);
                
                modalInstance.hide();
                
                if (typeof callback === 'function') {
                    callback(nuevoContacto);
                }
            } catch (err) {
                console.error('Error al guardar cliente rápido:', err);
                alert('Ocurrió un error al guardar: ' + err.message);
            } finally {
                newBtnSave.disabled = false;
                newBtnSave.textContent = 'Guardar Cliente';
            }
        });

        // 5. Mostrar el modal (y dar foco al primer campo útil)
        modalEl.addEventListener('shown.bs.modal', function onShown() {
            inputNit.focus();
            modalEl.removeEventListener('shown.bs.modal', onShown);
        });

        modalInstance.show();
    }
};
