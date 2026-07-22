// js/modules/ventas.js
import DB from '../core/db.js';

export const VentasModule = {
    async init(element) {
        if (!element) return;
        
        element.innerHTML = `
            <div class="module-container p-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="h3 fw-bold text-dark mb-0">Facturación y Cotizaciones</h2>
                    <div class="d-flex gap-2">
                        <button id="btn-nueva-cotizacion" class="btn btn-outline-secondary">
                            <i class="bi bi-file-earmark-text me-1"></i>Cotización
                        </button>
                        <button id="btn-nueva-factura" class="btn btn-primary">
                            <i class="bi bi-receipt me-1"></i>Nueva Venta
                        </button>
                    </div>
                </div>

                <div id="ventas-view-container" class="view-container"></div>
            </div>
        `;

        element.querySelector('#btn-nueva-cotizacion')?.addEventListener('click', () => this.renderForm(element, 'cotizacion'));
        element.querySelector('#btn-nueva-factura')?.addEventListener('click', () => this.renderForm(element, 'factura'));

        await this.renderTabla(element);
    },

    async renderTabla(element) {
        const container = element.querySelector('#ventas-view-container');
        if (!container) return;

        const [facturas, cotizaciones, contactos] = await Promise.all([
            DB.getAll('facturas'),
            DB.getAll('cotizaciones'),
            DB.getAll('contactos')
        ]);

        const documentos = [
            ...facturas.map(f => ({ ...f, docType: 'factura' })),
            ...cotizaciones.map(c => ({ ...c, docType: 'cotizacion' }))
        ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (documentos.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 bg-white rounded shadow-sm border border-light">
                    <i class="bi bi-receipt text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-3 mb-0">No hay facturas ni cotizaciones registradas.</p>
                </div>`;
            return;
        }

        let html = `
            <div class="card border-0 shadow-sm">
                <div class="table-responsive">
                    <table class="table align-middle mb-0">
                        <thead class="table-light text-muted font-monospace" style="font-size: 0.85rem;">
                            <tr>
                                <th class="px-4">Fecha</th>
                                <th>Tipo</th>
                                <th>ID Doc</th>
                                <th>Cliente</th>
                                <th class="text-end">Total</th>
                                <th class="text-center px-4">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        documentos.forEach(doc => {
            const cliente = contactos.find(c => c.id === doc.contactoId)?.nombre || 'Desconocido';
            const badgeClass = doc.docType === 'factura' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary';
            
            html += `
                <tr>
                    <td class="px-4">${doc.fecha}</td>
                    <td><span class="badge ${badgeClass} rounded-pill px-2 py-1 text-uppercase">${doc.docType}</span></td>
                    <td><code>${doc.id.split('_')[1] || doc.id}</code></td>
                    <td><strong>${cliente}</strong></td>
                    <td class="text-end fw-bold">$${(doc.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td class="text-center px-4">
                        <span class="badge bg-light text-dark border">${doc.estado ? doc.estado.toUpperCase() : 'N/A'}</span>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div></div>`;
        container.innerHTML = html;
    },

    async renderForm(element, tipoDoc) {
        const container = element.querySelector('#ventas-view-container');
        if (!container) return;

        const [contactos, productos, lotes] = await Promise.all([
            DB.getAll('contactos'),
            DB.getAll('productos'),
            DB.getAll('lotes_fifo')
        ]);

        const clientes = contactos.filter(c => c.tipo === 'cliente');

        // Render base form
        container.innerHTML = `
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h4 class="card-title fw-bold text-dark mb-0">
                            ${tipoDoc === 'factura' ? 'Nueva Factura de Venta' : 'Nueva Cotización'}
                        </h4>
                        <button id="btn-cancelar-venta" class="btn btn-sm btn-light">Volver</button>
                    </div>
                    
                    <div id="venta-alert" class="alert d-none mb-3 py-2"></div>
                    
                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-semibold">Cliente *</label>
                            <select id="venta-cliente" class="form-select" required>
                                <option value="">Seleccione un cliente...</option>
                                ${clientes.map(c => `<option value="${c.id}">${c.nombre} (${c.nit})</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-muted small fw-semibold">Fecha *</label>
                            <input type="date" id="venta-fecha" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                        </div>
                    </div>

                    <h5 class="fw-bold mb-3 border-bottom pb-2">Detalle de Productos</h5>
                    
                    <div class="row g-2 align-items-end mb-3 bg-light p-3 rounded border">
                        <div class="col-md-5">
                            <label class="form-label text-muted small">Producto</label>
                            <select id="linea-producto" class="form-select">
                                <option value="">Seleccione producto...</option>
                                ${productos.map(p => {
                                    const prodLotes = lotes.filter(l => l.productoId === p.id && l.cantidadActual > 0);
                                    const stock = prodLotes.reduce((sum, l) => sum + l.cantidadActual, 0);
                                    return `<option value="${p.id}" data-precio="${p.precioVenta}" data-stock="${stock}">${p.nombre} (Stock: ${stock})</option>`;
                                }).join('')}
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label text-muted small">Cantidad</label>
                            <input type="number" id="linea-qty" class="form-control" min="1" value="1">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label text-muted small">Precio Unit.</label>
                            <input type="number" step="any" id="linea-precio" class="form-control">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label text-muted small">Desc. (%)</label>
                            <input type="number" step="any" id="linea-desc" class="form-control" value="0" min="0" max="100">
                        </div>
                        <div class="col-md-1">
                            <button type="button" id="btn-add-linea" class="btn btn-secondary w-100"><i class="bi bi-plus-lg"></i></button>
                        </div>
                    </div>

                    <div class="table-responsive mb-4">
                        <table class="table align-middle">
                            <thead class="table-light text-muted small">
                                <tr>
                                    <th>Producto</th>
                                    <th class="text-end">Cant.</th>
                                    <th class="text-end">Precio</th>
                                    <th class="text-end">Desc.</th>
                                    <th class="text-end">Subtotal</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="tbody-detalles">
                                <tr id="row-empty"><td colspan="6" class="text-center text-muted py-3">Agregue productos al detalle</td></tr>
                            </tbody>
                            <tfoot class="table-light">
                                <tr>
                                    <td colspan="4" class="text-end fw-bold">TOTAL:</td>
                                    <td class="text-end fw-bold fs-5 text-primary" id="venta-total">$0.00</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div class="d-flex justify-content-end">
                        <button type="button" id="btn-guardar-venta" class="btn btn-primary px-5">
                            <i class="bi bi-check-lg me-1"></i>Guardar ${tipoDoc === 'factura' ? 'Factura' : 'Cotización'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        const state = {
            detalles: [],
            total: 0
        };

        const updateTable = () => {
            const tbody = container.querySelector('#tbody-detalles');
            const totalEl = container.querySelector('#venta-total');
            
            if (state.detalles.length === 0) {
                tbody.innerHTML = '<tr id="row-empty"><td colspan="6" class="text-center text-muted py-3">Agregue productos al detalle</td></tr>';
                totalEl.textContent = '$0.00';
                return;
            }

            let html = '';
            state.total = 0;

            state.detalles.forEach((det, idx) => {
                const subtotal = (det.precio * det.cantidad) * (1 - (det.descuento / 100));
                state.total += subtotal;
                
                html += `
                    <tr>
                        <td>${det.productoNombre}</td>
                        <td class="text-end">${det.cantidad}</td>
                        <td class="text-end">$${det.precio.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td class="text-end">${det.descuento}%</td>
                        <td class="text-end fw-semibold">$${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td class="text-center">
                            <button type="button" class="btn btn-sm btn-outline-danger btn-remove-linea" data-idx="${idx}"><i class="bi bi-trash"></i></button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
            totalEl.textContent = `$${state.total.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

            tbody.querySelectorAll('.btn-remove-linea').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.currentTarget.dataset.idx);
                    state.detalles.splice(idx, 1);
                    updateTable();
                });
            });
        };

        const showAlert = (msg, type = 'danger') => {
            const alertEl = container.querySelector('#venta-alert');
            alertEl.className = `alert alert-${type} mb-3 py-2`;
            alertEl.textContent = msg;
            alertEl.classList.remove('d-none');
            setTimeout(() => alertEl.classList.add('d-none'), 4000);
        };

        element.querySelector('#btn-cancelar-venta')?.addEventListener('click', () => this.renderTabla(element));

        // Auto-fill price on product select
        element.querySelector('#linea-producto')?.addEventListener('change', (e) => {
            const selectedOpt = e.target.options[e.target.selectedIndex];
            if (selectedOpt && selectedOpt.value) {
                element.querySelector('#linea-precio').value = selectedOpt.dataset.precio;
            }
        });

        // Add line
        element.querySelector('#btn-add-linea')?.addEventListener('click', () => {
            const selectProd = element.querySelector('#linea-producto');
            const qtyInput = element.querySelector('#linea-qty');
            const precioInput = element.querySelector('#linea-precio');
            const descInput = element.querySelector('#linea-desc');

            if (!selectProd.value) return showAlert('Seleccione un producto');
            
            const prodId = selectProd.value;
            const selectedOpt = selectProd.options[selectProd.selectedIndex];
            const prodNombre = selectedOpt.text.split(' (Stock')[0];
            const stockDisponible = parseInt(selectedOpt.dataset.stock);
            
            const cantidad = parseInt(qtyInput.value) || 0;
            const precio = parseFloat(precioInput.value) || 0;
            const descuento = parseFloat(descInput.value) || 0;

            if (cantidad <= 0) return showAlert('La cantidad debe ser mayor a 0');
            
            // Si es factura, validar stock estrictamente
            if (tipoDoc === 'factura' && cantidad > stockDisponible) {
                return showAlert(`Stock insuficiente. Disponible: ${stockDisponible}`);
            }

            state.detalles.push({
                productoId: prodId,
                productoNombre: prodNombre,
                cantidad,
                precio,
                descuento
            });

            // Reset inputs
            selectProd.value = '';
            qtyInput.value = '1';
            precioInput.value = '';
            descInput.value = '0';

            updateTable();
        });

        // Save Document
        element.querySelector('#btn-guardar-venta')?.addEventListener('click', async () => {
            const clienteId = element.querySelector('#venta-cliente').value;
            const fecha = element.querySelector('#venta-fecha').value;

            if (!clienteId) return showAlert('Seleccione un cliente');
            if (state.detalles.length === 0) return showAlert('Agregue al menos un producto al detalle');

            const btnGuardar = element.querySelector('#btn-guardar-venta');
            btnGuardar.disabled = true;

            try {
                const docId = `${tipoDoc}_${Date.now()}`;
                let costoTotalVenta = 0;

                // Lógica de descarga FIFO si es Factura
                if (tipoDoc === 'factura') {
                    for (const det of state.detalles) {
                        let qtyToDeduct = det.cantidad;
                        const prodLotes = lotes.filter(l => l.productoId === det.productoId && l.cantidadActual > 0);
                        prodLotes.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso));

                        let costoArticulo = 0;

                        for (const lote of prodLotes) {
                            if (qtyToDeduct <= 0) break;

                            const disponible = lote.cantidadActual;
                            const deduct = Math.min(disponible, qtyToDeduct);
                            
                            lote.cantidadActual -= deduct;
                            costoArticulo += (deduct * lote.costoUnitario);
                            qtyToDeduct -= deduct;

                            await DB.save('lotes_fifo', lote); // Guardar actualización del lote
                        }

                        if (qtyToDeduct > 0) {
                            throw new Error(`Integridad FIFO fallida para ${det.productoNombre}. Stock inconsistente.`);
                        }

                        det.costoTotal = costoArticulo;
                        costoTotalVenta += costoArticulo;
                    }
                }

                const documento = {
                    id: docId,
                    contactoId: clienteId,
                    fecha: fecha,
                    total: state.total,
                    detalles: state.detalles,
                    estado: tipoDoc === 'factura' ? 'paga' : 'pendiente'
                };

                if (tipoDoc === 'factura') {
                    documento.costoTotal = costoTotalVenta;
                    documento.utilidadBruta = state.total - costoTotalVenta;
                    documento.tipo = 'venta';
                    await DB.save('facturas', documento);

                    // Registrar ingreso en Tesorería (Caja General por defecto)
                    const transaccion = {
                        id: `trans_${Date.now()}`,
                        cuentaId: 'caja_general',
                        tipo: 'ingreso',
                        monto: state.total,
                        fecha: fecha,
                        detalle: `Ingreso por Factura de Venta #${docId.split('_')[1]}`,
                        referenciaId: docId
                    };
                    await DB.save('transacciones', transaccion);
                } else {
                    await DB.save('cotizaciones', documento);
                }

                showAlert(`${tipoDoc === 'factura' ? 'Factura' : 'Cotización'} guardada con éxito`, 'success');
                setTimeout(() => {
                    this.renderTabla(element);
                }, 1500);

            } catch (err) {
                console.error(err);
                showAlert(err.message, 'danger');
                btnGuardar.disabled = false;
            }
        });
    }
};
