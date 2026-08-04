// js/modules/productos.js
// Módulo de Gestión de Productos e Inventarios (Lotes FIFO) - Hoja Completa
import DB, { getLocalDate } from '../../core/db.js';

export const ProductosModule = {
    async init(element) {
        if (!element) return;
        
        element.innerHTML = `
            <div class="module-container p-4" style="max-width: 1200px; margin: 0 auto;">
                <!-- TOP BAR -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Ítems de venta</h2>
                        <p class="text-muted mb-0" style="font-size: 14px;">Gestiona tus productos, su costo promedio y el inventario disponible.</p>
                    </div>
                    <div class="d-flex gap-2">
                        <button id="btn-refresh-list" class="btn btn-light bg-white border me-2" style="font-weight: var(--weight-medium); font-size: 14px; color: var(--text-body);">
                            <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
                        </button>
                        <button id="btn-export-list" class="btn btn-light bg-white border" style="font-weight: var(--weight-medium); font-size: 14px; color: var(--text-body);">
                            <i class="bi bi-download me-1"></i> Exportar
                        </button>
                        <button id="btn-nuevo-producto" class="btn text-white" style="background-color: #2cbfb7; font-weight: var(--weight-medium); font-size: 14px;">
                            <i class="bi bi-plus-lg me-1"></i> Nuevo producto
                        </button>
                    </div>
                </div>

                <!-- DATA TABLE CARD -->
                <div class="card border-0" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                    
                    <!-- FILTERS -->
                    <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center" style="border-radius: 8px 8px 0 0;">
                        <div class="input-group input-group-sm" style="width: 250px;">
                            <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                            <input type="text" id="search-producto" class="form-control border-start-0 ps-0 text-muted" placeholder="Buscar por nombre o SKU..." style="font-size: 13px; box-shadow: none;">
                        </div>
                    </div>

                    <!-- GRID -->
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0">
                            <thead style="border-bottom: 1px solid var(--border-color);">
                                <tr style="color: var(--text-muted); font-size: 13px; font-weight: var(--weight-medium);">
                                    <th class="py-3 fw-normal ps-4">SKU</th>
                                    <th class="py-3 fw-normal">Nombre / Descripción</th>
                                    <th class="py-3 fw-normal text-end">Precio Venta</th>
                                    <th class="py-3 fw-normal text-end">Stock Total</th>
                                    <th class="py-3 fw-normal text-end">Costo Promedio Real</th>
                                    <th class="py-3 fw-normal text-end pe-4" style="width: 80px;"></th>
                                </tr>
                            </thead>
                            <tbody id="tbody-productos">
                                <!-- Filas inyectadas por renderTabla -->
                            </tbody>
                        </table>
                    </div>

                    <!-- PAGINATION FOOTER -->
                    <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center" style="border-radius: 0 0 8px 8px;">
                        <div class="d-flex align-items-center gap-3" style="font-size: 13px; color: var(--text-body);">
                            <span id="showing-count">Cargando...</span>
                        </div>
                    </div>
                </div>
                
                <div id="productos-view-container" class="view-container mt-4"></div>
            </div>
        `;

        element.querySelector('#btn-nuevo-producto')?.addEventListener('click', () => this.renderForm(element));
        element.querySelector('#search-producto')?.addEventListener('input', () => this.filtrarProductos(element));
        
        element.querySelector('#btn-refresh-list')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`;
            
            await DB.refreshCache('productos');
            await DB.refreshCache('lotes_fifo');
            await this.renderTabla(element);
            
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        });

        const hashParts = window.location.hash.split('/');
        const action = hashParts[3]; // #/inventario/items/ver/id (parts[0]=#, [1]=inventario, [2]=items, [3]=ver)
        const routeId = hashParts[4];

        if (action === 'ver' && routeId) {
            await this.renderDetalle(element, routeId);
        } else {
            await this.renderTabla(element);
        }
    },

    async renderTabla(element) {
        const container = element.querySelector('#tbody-productos');
        if (!container) return;

        const productos = await DB.getAll('productos');
        const lotes = await DB.getAll('lotes_fifo');
        
        if (productos.length === 0) {
            container.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">No hay productos registrados en el inventario.</td></tr>`;
            return;
        }

        let html = '';

        productos.forEach(p => {
            // Permitir mostrar productos activos e importados sin estado explícito
            if (p.estado === 'inactivo' || p.estado === 'inactive') return;

            const lotesProd = lotes.filter(l => l.productoId === p.id && l.cantidadActual > 0);
            
            // Priorizar stock importado estático y sumarle los lotes nuevos si los hay
            const stockBase = parseFloat(p.stock) || 0;
            const stockLotes = lotesProd.reduce((sum, l) => sum + l.cantidadActual, 0);
            const stockTotal = stockBase + stockLotes;

            // Calcular costo usando el estático si no hay lotes
            const costoLotes = lotesProd.reduce((sum, l) => sum + (l.cantidadActual * (l.costoUnitario || 0)), 0);
            const costoPromedio = stockTotal > 0 ? 
                (stockLotes > 0 ? costoLotes / stockLotes : (p.costoBase || 0)) 
                : (p.costoBase || 0);

            const isLowStock = stockTotal <= (p.stockMinimo || 0);
            
            html += `
                <tr data-id="${p.id}" style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);" onclick="if(!event.target.closest('button')) window.location.hash = '#/inventario/items/ver/${p.id}'">
                    <td class="py-3 ps-4 td-sku" style="color: var(--text-main); font-weight: var(--weight-medium);">${p.sku}</td>
                    <td class="py-3 text-truncate td-nombre" style="max-width: 300px;">${p.nombre}</td>
                    <td class="py-3 text-end">$${(p.precioVenta || 0).toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                    <td class="py-3 text-end">
                        <span style="${isLowStock ? 'color: #ef4444; background-color: #fee2e2;' : 'color: #15803d; background-color: #dcfce7;'} padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: var(--weight-medium);" ${isLowStock ? 'title="¡Alerta: Stock por debajo del mínimo!"' : ''}>
                            ${isLowStock ? '<i class="bi bi-exclamation-triangle-fill me-1"></i>' : ''}${stockTotal} und
                        </span>
                    </td>
                    <td class="py-3 text-end text-muted">$${(costoPromedio || 0).toLocaleString('es-CO', {minimumFractionDigits: 2})}</td>
                    <td class="py-3 text-end pe-4">
                        <button class="btn btn-link text-muted p-0 btn-menu-row btn-editar" data-id="${p.id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = html;

        // Actualizar paginador (simulado por ahora)
        const showingEl = element.querySelector('#showing-count');
        if (showingEl) showingEl.textContent = `Mostrando ${productos.filter(p => p.estado !== 'inactivo').length} productos`;

        container.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renderForm(element, e.currentTarget.dataset.id);
            });
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
                    <h4 class="card-title fw-bold mb-3 text-dark">${id ? 'Editar Producto' : 'Crear Nuevo Producto'}</h4>
                    <div class="alert alert-warning py-2 mb-4 d-flex align-items-center" style="font-size: 0.9rem;">
                        <i class="bi bi-info-circle-fill me-2"></i>
                        <span><strong>Nota:</strong> Los datos maestros (nombre, precio, SKU) se sincronizan desde Alegra.</span>
                    </div>
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
                            <div class="col-md-4">
                                <label class="form-label fw-semibold text-muted small">Cantidad Inicial *</label>
                                <input type="text" id="form-cantidad-inicial" class="form-control" value="0,00" ${id ? 'disabled' : 'required'}>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label fw-semibold text-muted small">Costo Inicial ($) *</label>
                                <input type="text" id="form-costo" class="form-control" value="${producto.costoBase ? Number(producto.costoBase).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}" ${id ? 'disabled' : 'required'}>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label fw-semibold text-muted small">Precio Base ($) *</label>
                                <input type="text" id="form-precio" class="form-control" value="${producto.precioVenta ? Number(producto.precioVenta).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}" required>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-4">
                                <label class="form-label fw-semibold text-muted small">Impuesto (%)</label>
                                <input type="text" id="form-impuesto" class="form-control" value="${producto.impuesto ? Number(producto.impuesto).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label fw-semibold text-muted small">Precio Total ($)</label>
                                <input type="text" id="form-precio-total" class="form-control bg-light" value="0,00" readonly disabled>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label fw-semibold text-muted small">Stock Mínimo</label>
                                <input type="text" id="form-minimo" class="form-control" value="${producto.stockMinimo ? Number(producto.stockMinimo).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '5,00'}">
                            </div>
                        </div>
                        <div class="mb-4">
                            <label class="form-label fw-semibold text-muted small">Ubicación Almacén</label>
                            <input type="text" id="form-ubicacion" class="form-control" value="${producto.ubicacion || ''}">
                        </div>
                        <div class="d-flex justify-content-end gap-2">
                            <button type="button" id="btn-cancelar-producto" class="btn btn-light px-4">Cancelar</button>
                            <button type="submit" class="btn btn-primary px-4">Guardar Producto</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        import('../../shared/formatters.js').then(fmt => {
            ['#form-precio', '#form-costo', '#form-cantidad-inicial', '#form-impuesto', '#form-minimo'].forEach(selector => {
                const el = element.querySelector(selector);
                if (el) fmt.applyCurrencyFormatting(el);
            });
            
            // Cálculo en vivo del Precio Total
            const calcTotal = () => {
                const pBase = fmt.parseCurrencyValue(element.querySelector('#form-precio').value) || 0;
                const imp = fmt.parseCurrencyValue(element.querySelector('#form-impuesto').value) || 0;
                const total = pBase * (1 + (imp / 100));
                element.querySelector('#form-precio-total').value = total.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            };
            
            element.querySelector('#form-precio').addEventListener('input', calcTotal);
            element.querySelector('#form-impuesto').addEventListener('input', calcTotal);
            calcTotal(); // Cálculo inicial
        });

        element.querySelector('#btn-cancelar-producto')?.addEventListener('click', () => this.renderTabla(element));
        element.querySelector('#form-producto-data')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const prodId = id || 'prod_' + Date.now();
            let pVenta = 0, cBase = 0, cInicial = 0, imp = 0, sMin = 0;
            try {
                const fmt = await import('../../shared/formatters.js');
                pVenta = fmt.parseCurrencyValue(element.querySelector('#form-precio').value);
                cBase = fmt.parseCurrencyValue(element.querySelector('#form-costo').value);
                cInicial = fmt.parseCurrencyValue(element.querySelector('#form-cantidad-inicial').value);
                imp = fmt.parseCurrencyValue(element.querySelector('#form-impuesto').value);
                sMin = fmt.parseCurrencyValue(element.querySelector('#form-minimo').value);
            } catch(e) {
                pVenta = parseFloat(element.querySelector('#form-precio').value) || 0;
                cBase = parseFloat(element.querySelector('#form-costo').value) || 0;
                cInicial = parseFloat(element.querySelector('#form-cantidad-inicial').value) || 0;
                imp = parseFloat(element.querySelector('#form-impuesto').value) || 0;
                sMin = parseFloat(element.querySelector('#form-minimo').value) || 0;
            }

            const nuevoProducto = {
                id: prodId,
                sku: element.querySelector('#form-sku').value,
                nombre: element.querySelector('#form-nombre').value,
                precioVenta: pVenta,
                costoBase: cBase,
                impuesto: imp,
                stockMinimo: sMin,
                ubicacion: element.querySelector('#form-ubicacion').value
            };

            await DB.save('productos', nuevoProducto);

            // Si es un producto nuevo, inicializar un lote FIFO vacío con cantidad cero
            if (!id) {
                const loteInicial = {
                    id: 'lote_' + prodId + '_init',
                    productoId: prodId,
                    cantidadInicial: cInicial,
                    cantidadActual: cInicial,
                    costoUnitario: nuevoProducto.costoBase,
                    fechaIngreso: getLocalDate(),
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
                            <h5 class="fw-bold mb-2"><i class="bi bi-box-arrow-in-down text-primary me-2"></i>Registrar Nuevo Lote</h5>
                            <p class="text-muted small mb-3">Nota: El inventario local puede ser sobreescrito si Alegra actualiza el stock maestro.</p>
                            <div id="lote-alert" class="alert alert-success d-none mb-3 py-2" style="font-size: 0.9rem;"></div>
                            
                            <form id="form-nuevo-lote">
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Cantidad Ingresada *</label>
                                    <input type="number" id="lote-cantidad" class="form-control" required min="1">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Costo Unitario ($) *</label>
                                    <input type="text" id="lote-costo" class="form-control" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label text-muted small fw-semibold">Fecha de Ingreso *</label>
                                    <input type="date" id="lote-fecha" class="form-control" required value="${getLocalDate()}">
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

        import('../../shared/formatters.js').then(fmt => {
            fmt.applyCurrencyFormatting(element.querySelector('#lote-costo'));
        });

        element.querySelector('#btn-volver-prod')?.addEventListener('click', () => this.renderTabla(element));
        
        // Manejador del submit de nuevo lote
        element.querySelector('#form-nuevo-lote')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alertEl = element.querySelector('#lote-alert');
            
            const qty = parseInt(element.querySelector('#lote-cantidad').value) || 0;
            
            let lCosto = 0;
            try {
                const fmt = await import('../../shared/formatters.js');
                lCosto = fmt.parseCurrencyValue(element.querySelector('#lote-costo').value);
            } catch(e) {
                lCosto = parseFloat(element.querySelector('#lote-costo').value) || 0;
            }

            const nuevoLote = {
                id: 'lote_' + Date.now(),
                productoId: id,
                cantidadInicial: qty,
                cantidadActual: qty,
                costoUnitario: lCosto,
                fechaIngreso: element.querySelector('#lote-fecha').value,
                referencia: element.querySelector('#lote-ref').value.trim()
            };

            await DB.save('lotes_fifo', nuevoLote);

            // Mostrar mensaje de éxito en pantalla sin usar alerts nativos
            if (alertEl) {
                alertEl.textContent = 'Lote guardado e integrado con éxito al FIFO.';
                alertEl.classList.remove('d-none');
                
                if (window._productosAlertTimeout) clearTimeout(window._productosAlertTimeout);
                window._productosAlertTimeout = setTimeout(() => alertEl.classList.add('d-none'), 3000);
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
            const sku = row.querySelector('.td-sku')?.textContent.toLowerCase() || '';
            const nombre = row.querySelector('.td-nombre')?.textContent.toLowerCase() || '';
            
            if (sku.includes(query) || nombre.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
};
