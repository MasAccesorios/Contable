// js/modules/productos.js
// Módulo de Gestión de Productos e Inventarios (Lotes FIFO) - Hoja Completa
import DB from '../../core/db.js';

export const ProductosModule = {
    async init(element) {
        if (!element) return;
        
        element.innerHTML = `
            <div class="module-container p-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="h3 fw-bold text-dark mb-0">Gestión de Productos e Inventarios</h2>
                    <button id="btn-nuevo-producto" class="btn btn-primary">
                        <i class="bi bi-plus-circle me-1"></i>Nuevo Producto
                    </button>
                </div>
                
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                        <div class="input-group">
                            <span class="input-group-text bg-white border-end-0 text-muted">
                                <i class="bi bi-search"></i>
                            </span>
                            <input type="text" id="search-producto" placeholder="Buscar por nombre o SKU..." class="form-control border-start-0 ps-0">
                        </div>
                    </div>
                </div>

                <div id="productos-view-container" class="view-container"></div>
            </div>
        `;

        element.querySelector('#btn-nuevo-producto')?.addEventListener('click', () => this.renderForm(element));
        element.querySelector('#search-producto')?.addEventListener('input', () => this.filtrarProductos(element));

        await this.renderTabla(element);
    },

    async renderTabla(element) {
        const container = element.querySelector('#productos-view-container');
        if (!container) return;

        const productos = await DB.getAll('productos');
        const lotes = await DB.getAll('lotes_fifo');
        
        if (productos.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 bg-white rounded shadow-sm">
                    <i class="bi bi-box-seam text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-3 mb-0">No hay productos registrados en el inventario.</p>
                </div>`;
            return;
        }

        let html = `
            <div class="card border-0 shadow-sm">
                <div class="table-responsive">
                    <table class="table align-middle mb-0">
                        <thead class="table-light text-muted uppercase font-monospace" style="font-size: 0.85rem;">
                            <tr>
                                <th class="px-4">SKU</th>
                                <th>Nombre / Descripción</th>
                                <th class="text-end">Precio Venta</th>
                                <th class="text-end">Stock Total</th>
                                <th class="text-end">Costo Promedio Real</th>
                                <th class="text-center px-4">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-productos">
        `;

        productos.forEach(p => {
            const lotesProd = lotes.filter(l => l.productoId === p.id && l.cantidadActual > 0);
            const stockTotal = lotesProd.reduce((sum, l) => sum + l.cantidadActual, 0);
            const costoTotal = lotesProd.reduce((sum, l) => sum + (l.cantidadActual * l.costoUnitario), 0);
            const costoPromedio = stockTotal > 0 ? (costoTotal / stockTotal) : p.costoBase;

            html += `
                <tr data-id="${p.id}">
                    <td class="px-4"><code>${p.sku}</code></td>
                    <td><strong>${p.nombre}</strong></td>
                    <td class="text-end">$${p.precioVenta.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td class="text-end">
                        <span class="badge ${stockTotal <= p.stockMinimo ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'} rounded-pill px-3 py-2">
                            ${stockTotal} und
                        </span>
                    </td>
                    <td class="text-end">$${costoPromedio.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td class="text-center px-4">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary btn-ver" data-id="${p.id}">
                                <i class="bi bi-journal-text me-1"></i>Kardex / Lotes
                            </button>
                            <button class="btn btn-sm btn-outline-secondary btn-editar" data-id="${p.id}">
                                <i class="bi bi-pencil me-1"></i>Editar
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div></div>`;
        container.innerHTML = html;

        container.querySelectorAll('.btn-ver').forEach(btn => {
            btn.addEventListener('click', (e) => this.renderDetalle(element, e.currentTarget.dataset.id));
        });
        container.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', (e) => this.renderForm(element, e.currentTarget.dataset.id));
        });
    },

    async renderForm(element, id = null) {
        const container = element.querySelector('#productos-view-container');
        if (!container) return;

        let producto = { sku: '', nombre: '', precioVenta: 0, costoBase: 0, stockMinimo: 5, ubicacion: '' };
        
        if (id) {
            producto = await DB.get('productos', id) || producto;
        }

        container.innerHTML = `
            <div class="card border-0 shadow-sm max-width-md mx-auto" style="max-width: 600px;">
                <div class="card-body p-4">
                    <h4 class="card-title fw-bold mb-4 text-dark">${id ? 'Editar Producto' : 'Crear Nuevo Producto'}</h4>
                    <form id="form-producto-data">
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-muted small">SKU / Código Único *</label>
                            <input type="text" id="form-sku" class="form-control" value="${producto.sku}" ${id ? 'disabled' : 'required'}>
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold text-muted small">Nombre del Producto *</label>
                            <input type="text" id="form-nombre" class="form-control" value="${producto.nombre}" required>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label class="form-label fw-semibold text-muted small">Precio de Venta ($) *</label>
                                <input type="number" step="any" id="form-precio" class="form-control" value="${producto.precioVenta}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label fw-semibold text-muted small">Costo Base Inicial ($) *</label>
                                <input type="number" step="any" id="form-costo" class="form-control" value="${producto.costoBase}" ${id ? 'disabled' : 'required'}>
                            </div>
                        </div>
                        <div class="row mb-4">
                            <div class="col-md-6">
                                <label class="form-label fw-semibold text-muted small">Stock Mínimo Alerta</label>
                                <input type="number" id="form-minimo" class="form-control" value="${producto.stockMinimo}">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label fw-semibold text-muted small">Ubicación Almacén</label>
                                <input type="text" id="form-ubicacion" class="form-control" value="${producto.ubicacion || ''}">
                            </div>
                        </div>
                        <div class="d-flex justify-content-end gap-2">
                            <button type="button" id="btn-cancelar-producto" class="btn btn-light px-4">Cancelar</button>
                            <button type="submit" class="btn btn-primary px-4">Guardar Producto</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        element.querySelector('#btn-cancelar-producto')?.addEventListener('click', () => this.renderTabla(element));
        element.querySelector('#form-producto-data')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const prodId = id || 'prod_' + Date.now();
            const nuevoProducto = {
                id: prodId,
                sku: element.querySelector('#form-sku').value,
                nombre: element.querySelector('#form-nombre').value,
                precioVenta: parseFloat(element.querySelector('#form-precio').value) || 0,
                costoBase: parseFloat(element.querySelector('#form-costo').value) || 0,
                stockMinimo: parseInt(element.querySelector('#form-minimo').value) || 0,
                ubicacion: element.querySelector('#form-ubicacion').value
            };

            await DB.save('productos', nuevoProducto);

            // Si es un producto nuevo, inicializar un lote FIFO vacío con cantidad cero
            if (!id) {
                const loteInicial = {
                    id: 'lote_' + prodId + '_init',
                    productoId: prodId,
                    cantidadInicial: 0,
                    cantidadActual: 0,
                    costoUnitario: nuevoProducto.costoBase,
                    fechaIngreso: new Date().toISOString().split('T')[0],
                    referencia: 'Inventario Inicial'
                };
                await DB.save('lotes_fifo', loteInicial);
            }

            this.renderTabla(element);
        });
    },

    async renderDetalle(element, id) {
        const container = element.querySelector('#productos-view-container');
        if (!container) return;

        const producto = await DB.get('productos', id);
        if (!producto) return;

        const lotes = await DB.getAll('lotes_fifo');
        const lotesProd = lotes.filter(l => l.productoId === id);

        // Ordenar lotes por fecha de ingreso ascendente para visualización FIFO
        lotesProd.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso));

        let lotesHtml = '';
        lotesProd.forEach(l => {
            lotesHtml += `
                <tr class="${l.cantidadActual === 0 ? 'table-light opacity-50' : ''}">
                    <td>${l.fechaIngreso}</td>
                    <td>${l.referencia}</td>
                    <td class="text-end">$${l.costoUnitario.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td class="text-end">${l.cantidadInicial} und</td>
                    <td class="text-end">
                        <strong class="${l.cantidadActual === 0 ? 'text-muted' : 'text-success'}">${l.cantidadActual} und</strong>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = `
            <div class="row g-4">
                <!-- Panel de Detalles del Producto & Carga de Lotes -->
                <div class="col-lg-4">
                    <div class="card border-0 shadow-sm mb-4">
                        <div class="card-body p-4">
                            <h5 class="fw-bold mb-3">Detalle Técnico</h5>
                            <ul class="list-unstyled mb-0">
                                <li class="mb-2"><strong>SKU:</strong> <code class="bg-light px-2 py-1 rounded">${producto.sku}</code></li>
                                <li class="mb-2"><strong>Descripción:</strong> ${producto.nombre}</li>
                                <li class="mb-2"><strong>Precio Venta:</strong> $${producto.precioVenta.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</li>
                                <li class="mb-2"><strong>Ubicación:</strong> ${producto.ubicacion || 'No asignada'}</li>
                                <li><strong>Costo Base Fijo:</strong> $${producto.costoBase.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</li>
                            </ul>
                        </div>
                    </div>

                    <!-- Formulario de Ajuste / Carga de Lotes -->
                    <div class="card border-0 shadow-sm">
                        <div class="card-body p-4">
                            <h5 class="fw-bold mb-3"><i class="bi bi-box-arrow-in-down text-primary me-2"></i>Registrar Nuevo Lote</h5>
                            <div id="lote-alert" class="alert alert-success d-none mb-3 py-2" style="font-size: 0.9rem;"></div>
                            
                            <form id="form-nuevo-lote">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Cantidad Ingresada *</label>
                                    <input type="number" id="lote-cantidad" class="form-control" required min="1">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Costo Unitario ($) *</label>
                                    <input type="number" step="any" id="lote-costo" class="form-control" required min="0">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Fecha de Ingreso *</label>
                                    <input type="date" id="lote-fecha" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Referencia / Documento</label>
                                    <input type="text" id="lote-ref" class="form-control" placeholder="Ej. Compra 123 o Ajuste">
                                </div>
                                <button type="submit" class="btn btn-primary w-100 mt-2">
                                    <i class="bi bi-plus-lg me-1"></i>Agregar Lote
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- Tabla de Lotes Históricos (FIFO) -->
                <div class="col-lg-8">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body p-4">
                            <div class="d-flex justify-content-between align-items-center mb-4">
                                <h5 class="fw-bold mb-0">Capas de Inventario (Lotes FIFO)</h5>
                                <button id="btn-volver-prod" class="btn btn-sm btn-outline-secondary">
                                    <i class="bi bi-arrow-left me-1"></i>Volver al Listado
                                </button>
                            </div>
                            
                            <div class="table-responsive">
                                <table class="table align-middle">
                                    <thead class="table-light text-muted uppercase font-monospace" style="font-size: 0.85rem;">
                                        <tr>
                                            <th>Fecha Ingreso</th>
                                            <th>Referencia</th>
                                            <th class="text-end">Costo Unitario</th>
                                            <th class="text-end">Cantidad Inicial</th>
                                            <th class="text-end">Cantidad Disponible</th>
                                        </tr>
                                    </thead>
                                    <tbody id="tbody-lotes-fifo">
                                        ${lotesHtml || '<tr><td colspan="5" class="text-center py-4 text-muted">No hay lotes para este producto.</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        element.querySelector('#btn-volver-prod')?.addEventListener('click', () => this.renderTabla(element));
        
        // Manejador del submit de nuevo lote
        element.querySelector('#form-nuevo-lote')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alertEl = element.querySelector('#lote-alert');
            
            const qty = parseInt(element.querySelector('#lote-cantidad').value) || 0;
            const cost = parseFloat(element.querySelector('#lote-costo').value) || 0;
            const date = element.querySelector('#lote-fecha').value;
            const ref = element.querySelector('#lote-ref').value || 'Ajuste Manual';

            const nuevoLote = {
                id: 'lote_' + Date.now(),
                productoId: id,
                cantidadInicial: qty,
                cantidadActual: qty,
                costoUnitario: cost,
                fechaIngreso: date,
                referencia: ref
            };

            await DB.save('lotes_fifo', nuevoLote);

            // Mostrar mensaje de éxito en pantalla sin usar alerts nativos
            if (alertEl) {
                alertEl.textContent = 'Lote guardado e integrado con éxito al FIFO.';
                alertEl.classList.remove('d-none');
                setTimeout(() => alertEl.classList.add('d-none'), 3000);
            }

            // Limpiar campos de cantidad y referencia
            element.querySelector('#lote-cantidad').value = '';
            element.querySelector('#lote-ref').value = '';

            // Recargar vista de detalles del producto
            await this.renderDetalle(element, id);
        });
    },

    filtrarProductos(element) {
        const query = element.querySelector('#search-producto')?.value.toLowerCase() || '';
        const tbody = element.querySelector('#tbody-productos');
        if (!tbody) return;

        // Filtrado ultra-rápido operando directamente sobre el DOM renderizado
        // en lugar de recargar la base de datos en cada pulsación (evita bloqueos)
        const rows = tbody.querySelectorAll('tr[data-id]');
        rows.forEach(row => {
            const sku = row.querySelector('code')?.textContent.toLowerCase() || '';
            const nombre = row.querySelector('strong')?.textContent.toLowerCase() || '';
            
            if (sku.includes(query) || nombre.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
};
