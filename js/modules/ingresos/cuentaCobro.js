import { supabase } from '../../core/supabase.js';
import { getLocalDate } from '../../core/db.js';
import { CoreActions, ItemEngine, PrintManager } from '../../shared/crud.js';

export const CuentaCobroModule = {
    async init(element) {
        if (!element) return;

        const hashParts = window.location.hash.split('/');
        const subAction = hashParts[3];
        const id = hashParts[4];

        if (subAction === 'nueva' || subAction === 'editar') {
            await this.renderForm(element, id, false);
        } else if (subAction === 'ver') {
            await this.renderForm(element, id, true);
        } else {
            await this.renderList(element);
        }
    },

    async renderList(element) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; color: #2cbfb7;">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;
        
        const { data, error } = await supabase.from('cuentas_cobro').select('*').order('numero', { ascending: false });
        const listData = data || [];

        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        const rowsHtml = listData.map(c => `
            <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);">
                <td style="padding: 12px 16px; font-weight: 500;">No. ${c.numero}</td>
                <td style="padding: 12px 16px;">${c.fecha}</td>
                <td style="padding: 12px 16px;">
                    <div style="font-weight: 500; color: var(--text-main);">${c.cliente_razon_social}</div>
                </td>
                <td style="padding: 12px 16px; text-align: right; font-weight: 600;">${formatMoney(c.total)}</td>
                <td style="padding: 12px 16px; text-align: right;">
                    <button class="btn btn-sm btn-light border btn-ver-row" data-id="${c.id}" title="Ver"><i class="bi bi-eye"></i></button>
                    <button class="btn btn-sm btn-light border ms-1 btn-imprimir-row" data-id="${c.id}" title="Imprimir"><i class="bi bi-printer"></i></button>
                    <button class="btn btn-sm btn-outline-danger ms-1 btn-delete-row" data-id="${c.id}" title="Eliminar"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `).join('');

        element.innerHTML = `
            <div class="module-container p-4" style="max-width: 1200px; margin: 0 auto;">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="h3 fw-bold mb-0" style="color: var(--text-main);">Cuentas de Cobro</h2>
                    <a href="#/ingresos/cuenta-cobro/nueva" class="btn btn-primary fw-medium px-4" style="background-color: #2cbfb7; border: none; border-radius: 8px;">
                        <i class="bi bi-plus-lg me-2"></i>Nueva Cuenta de Cobro
                    </a>
                </div>
                <div class="card border-0 shadow-sm" style="border-radius: 12px; overflow: hidden;">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0" style="width: 100%; border-collapse: collapse;">
                            <thead style="background-color: #f8f9fa;">
                                <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                    <th style="padding: 12px 16px; font-weight: 600;">Número</th>
                                    <th style="padding: 12px 16px; font-weight: 600;">Fecha</th>
                                    <th style="padding: 12px 16px; font-weight: 600;">Cliente</th>
                                    <th style="padding: 12px 16px; text-align: right; font-weight: 600;">Total</th>
                                    <th style="padding: 12px 16px; text-align: right; font-weight: 600;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml || '<tr><td colspan="5" class="text-center py-4 text-muted">No hay cuentas de cobro registradas.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        element.querySelectorAll('.btn-ver-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                window.location.hash = `#/ingresos/cuenta-cobro/ver/${e.currentTarget.dataset.id}`;
            });
        });

        element.querySelectorAll('.btn-imprimir-row').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const doc = listData.find(c => String(c.id) === String(id));
                if (doc) {
                    PrintManager.printCuentaCobro(doc);
                }
            });
        });

        element.querySelectorAll('.btn-delete-row').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('¿Estás seguro de eliminar esta cuenta de cobro?')) {
                    const id = e.currentTarget.dataset.id;
                    await supabase.from('cuentas_cobro').delete().eq('id', id);
                    this.renderList(element);
                }
            });
        });
    },

    async renderForm(element, id = null, isViewOnly = false) {
        let doc = {
            fecha: getLocalDate(),
            fecha_vencimiento: getLocalDate(),
            cliente_razon_social: '',
            cliente_nit: '',
            cliente_direccion: '',
            cliente_ciudad: '',
            cliente_telefono: '',
            cliente_email: '',
            forma_pago: 'Contado',
            medio_pago: 'Instrumento no definido',
            detalles: [{ id: Date.now(), producto_id: '', nombre: '', sku: '', cantidad: 1, precio_unitario: 0, total: 0 }],
            subtotal: 0,
            impuestos: 0,
            total: 0
        };

        if (id) {
            const { data } = await supabase.from('cuentas_cobro').select('*').eq('id', id).single();
            if (data) doc = data;
        }

        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        const headerHtml = CoreActions.renderDocumentHeader('ingresos/cuenta-cobro', 'Volver a Cuentas de Cobro');
        
        const actionsHtml = `
            <div class="d-flex gap-2">
                ${isViewOnly || id ? `
                <button class="btn btn-outline-secondary fw-medium px-3 border-2 qa-action-btn" id="btn-preview" style="border-radius: 8px;">
                    <i class="bi bi-eye me-2"></i>Vista Previa
                </button>
                <button class="btn btn-outline-primary fw-medium px-3 border-2 qa-action-btn" id="btn-print" style="border-radius: 8px;">
                    <i class="bi bi-printer me-2"></i>Imprimir
                </button>
                ` : ''}
                ${!isViewOnly ? `
                <button class="btn btn-primary fw-medium px-4 qa-action-btn shadow-sm" id="btn-save" style="background-color: #2cbfb7; border: none; border-radius: 8px;">
                    <i class="bi bi-save me-2"></i>Guardar
                </button>
                ` : ''}
                ${isViewOnly && id ? `
                <button class="btn btn-outline-primary fw-medium px-3 border-2 qa-action-btn" id="btn-edit" style="border-radius: 8px;">
                    <i class="bi bi-pencil me-2"></i>Editar
                </button>
                ` : ''}
            </div>
        `;

        element.innerHTML = `
            <div class="module-container p-4" style="max-width: 1100px; margin: 0 auto;">
                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        ${headerHtml}
                        <h2 class="h3 fw-bold mb-0" style="color: var(--text-main);">${id ? 'Cuenta de Cobro No. ' + doc.numero : 'Nueva Cuenta de Cobro'}</h2>
                    </div>
                    ${actionsHtml}
                </div>

                <div class="card border-0 shadow-sm mb-4" style="border-radius: 12px; overflow: visible;">
                    <div class="card-header bg-white border-bottom py-3 px-4">
                        <h6 class="mb-0 fw-bold" style="color: var(--text-main);">Información del Cliente</h6>
                    </div>
                    <div class="card-body p-4">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-medium">Razón Social *</label>
                                <input type="text" id="cc-razon-social" class="form-control" value="${doc.cliente_razon_social || ''}" required ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-medium">NIT / CC</label>
                                <input type="text" id="cc-nit" class="form-control" value="${doc.cliente_nit || ''}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-medium">Dirección</label>
                                <input type="text" id="cc-direccion" class="form-control" value="${doc.cliente_direccion || ''}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-medium">Ciudad</label>
                                <input type="text" id="cc-ciudad" class="form-control" value="${doc.cliente_ciudad || ''}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-medium">Teléfono</label>
                                <input type="text" id="cc-telefono" class="form-control" value="${doc.cliente_telefono || ''}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-muted small fw-medium">Correo Electrónico</label>
                                <input type="email" id="cc-email" class="form-control" value="${doc.cliente_email || ''}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card border-0 shadow-sm mb-4" style="border-radius: 12px; overflow: visible;">
                    <div class="card-header bg-white border-bottom py-3 px-4">
                        <h6 class="mb-0 fw-bold" style="color: var(--text-main);">Detalles del Pago</h6>
                    </div>
                    <div class="card-body p-4">
                        <div class="row g-3">
                            <div class="col-md-3">
                                <label class="form-label text-muted small fw-medium">Fecha Expedición *</label>
                                <input type="date" id="cc-fecha" class="form-control" value="${doc.fecha}" required ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label text-muted small fw-medium">Fecha Vencimiento</label>
                                <input type="date" id="cc-vencimiento" class="form-control" value="${doc.fecha_vencimiento || doc.fecha}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label text-muted small fw-medium">Forma de Pago</label>
                                <select id="cc-forma-pago" class="form-select" ${isViewOnly ? 'disabled' : ''}>
                                    <option value="Contado" ${doc.forma_pago === 'Contado' ? 'selected' : ''}>Contado</option>
                                    <option value="Crédito" ${doc.forma_pago === 'Crédito' ? 'selected' : ''}>Crédito</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label text-muted small fw-medium">Medio de Pago</label>
                                <input type="text" id="cc-medio-pago" class="form-control" value="${doc.medio_pago || 'Instrumento no definido'}" ${isViewOnly ? 'disabled' : ''}>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card border-0 shadow-sm mb-4" style="border-radius: 12px; overflow: visible;">
                    <div class="card-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                        <h6 class="mb-0 fw-bold" style="color: var(--text-main);">Productos o Servicios</h6>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive" style="overflow: visible;">
                            <table class="table mb-0" id="cc-items-table" style="min-width: 800px;">
                                <thead style="background-color: #f8f9fa;">
                                    <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                        <th style="width: 45%; padding: 12px 16px; font-weight: 600;">Ítem</th>
                                        <th style="width: 15%; padding: 12px 16px; font-weight: 600;">Precio Unitario</th>
                                        <th style="width: 15%; padding: 12px 16px; font-weight: 600;">Cantidad</th>
                                        <th style="width: 15%; padding: 12px 16px; font-weight: 600; text-align: right;">Total</th>
                                        ${!isViewOnly ? '<th style="width: 10%; padding: 12px 16px;"></th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>
                                </tbody>
                            </table>
                        </div>
                        ${!isViewOnly ? `
                        <div class="p-3 border-top bg-light">
                            <button type="button" class="btn btn-sm btn-outline-primary fw-medium" id="btn-add-line" style="border-radius: 6px;">
                                <i class="bi bi-plus-lg me-1"></i>Agregar línea
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <div class="row justify-content-end">
                    <div class="col-md-5 col-lg-4">
                        <div class="card border-0 shadow-sm" style="border-radius: 12px;">
                            <div class="card-body p-4">
                                <div class="d-flex justify-content-between mb-2">
                                    <span class="text-muted fw-medium" style="font-size: 14px;">Subtotal:</span>
                                    <span class="fw-bold" id="cc-subtotal" style="font-size: 14px; color: var(--text-body);">${formatMoney(doc.subtotal)}</span>
                                </div>
                                <div class="d-flex justify-content-between mb-3 pb-3 border-bottom">
                                    <span class="text-muted fw-medium" style="font-size: 14px;">Impuestos (IVA):</span>
                                    <span class="fw-bold" id="cc-impuestos" style="font-size: 14px; color: var(--text-body);">${formatMoney(doc.impuestos)}</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="text-muted fw-bold" style="font-size: 16px;">Total a Pagar:</span>
                                    <span class="fw-bold fs-4" id="cc-total" style="color: #2cbfb7;">${formatMoney(doc.total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const tbody = element.querySelector('#cc-items-table tbody');
        
        const getProductsFn = async () => {
            const { data } = await supabase.from('productos').select('*');
            return data.map(p => ({
                ...p,
                id: p.id,
                nombre: p.nombre,
                sku: p.sku,
                precio_base: p.precio_base || p.precio_venta || 0
            }));
        };

        const renderLine = (lineData, index) => {
            const tr = document.createElement('tr');
            tr.dataset.id = lineData.id;
            tr.style.cssText = "border-bottom: 1px solid var(--border-color);";

            const itemToBind = { ...lineData, productoId: lineData.producto_id };
            const searchHtml = ItemEngine.renderProductSearchBox(itemToBind, isViewOnly, null);

            tr.innerHTML = `
                <td style="padding: 12px 16px;">
                    ${searchHtml}
                </td>
                <td style="padding: 12px 16px;">
                    <input type="number" class="form-control item-price" value="${lineData.precio_unitario || 0}" step="0.01" ${isViewOnly ? 'disabled' : ''}>
                </td>
                <td style="padding: 12px 16px;">
                    <input type="number" class="form-control item-qty" value="${lineData.cantidad || 1}" min="1" step="0.01" ${isViewOnly ? 'disabled' : ''}>
                </td>
                <td style="padding: 12px 16px; text-align: right; vertical-align: middle;">
                    <span class="item-line-total fw-bold text-muted">${formatMoney(lineData.total)}</span>
                </td>
                ${!isViewOnly ? `
                <td style="padding: 12px 16px; text-align: right; vertical-align: middle;">
                    <button class="btn btn-sm btn-outline-danger btn-remove-line" title="Eliminar"><i class="bi bi-trash"></i></button>
                </td>
                ` : ''}
            `;
            tbody.appendChild(tr);

            if (!isViewOnly) {
                ItemEngine.bindLineEvents(tr, getProductsFn, (prod) => {
                    tr.querySelector('.item-price').value = prod.precio_base || 0;
                    lineData.producto_id = prod.id;
                    lineData.nombre = prod.nombre;
                    lineData.sku = prod.sku;
                    const searchInp = tr.querySelector('.product-search-input');
                    if (searchInp) searchInp.dataset.sku = lineData.sku;
                    updateTotals();
                });

                tr.querySelector('.item-price').addEventListener('input', updateTotals);
                tr.querySelector('.item-qty').addEventListener('input', updateTotals);
                
                tr.querySelector('.btn-remove-line').addEventListener('click', () => {
                    tr.remove();
                    updateTotals();
                });
            }
        };

        const updateTotals = () => {
            let subtotal = 0;
            const rows = tbody.querySelectorAll('tr');
            doc.detalles = [];

            rows.forEach((tr) => {
                const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
                const price = parseFloat(tr.querySelector('.item-price').value) || 0;
                const totalLine = qty * price;

                tr.querySelector('.item-line-total').textContent = formatMoney(totalLine);

                const searchInput = tr.querySelector('.product-search-input');
                
                doc.detalles.push({
                    id: tr.dataset.id,
                    producto_id: searchInput ? searchInput.dataset.productId : null,
                    nombre: searchInput ? searchInput.value : '',
                    sku: searchInput ? (searchInput.dataset.sku || searchInput.dataset.lastSku || '') : '',
                    cantidad: qty,
                    precio_unitario: price,
                    total: totalLine
                });

                subtotal += totalLine;
            });

            doc.subtotal = subtotal;
            doc.impuestos = 0;
            doc.total = subtotal;

            element.querySelector('#cc-subtotal').textContent = formatMoney(doc.subtotal);
            element.querySelector('#cc-impuestos').textContent = formatMoney(doc.impuestos);
            element.querySelector('#cc-total').textContent = formatMoney(doc.total);
        };

        doc.detalles.forEach((det, idx) => renderLine(det, idx));

        if (!isViewOnly) {
            element.querySelector('#btn-add-line').addEventListener('click', () => {
                renderLine({ id: Date.now(), producto_id: '', nombre: '', sku: '', cantidad: 1, precio_unitario: 0, total: 0 }, tbody.children.length);
            });

            element.querySelector('#btn-save').addEventListener('click', async () => {
                const rs = element.querySelector('#cc-razon-social').value.trim();
                const fecha = element.querySelector('#cc-fecha').value;
                if (!rs || !fecha) {
                    CoreActions.showWarningModal("Razón Social y Fecha Expedición son obligatorios.");
                    return;
                }

                updateTotals();
                
                const { data: prods, error: prodsErr } = await supabase.from('productos').select('id, nombre, sku');
                if (prodsErr) console.error("Error cargando productos para guardar:", prodsErr);
                
                doc.detalles = doc.detalles.map(d => {
                    if (d.producto_id && prods) {
                        const p = prods.find(x => String(x.id) === String(d.producto_id));
                        if (p) {
                            d.nombre = p.nombre;
                            d.sku = p.sku || '';
                        }
                    }
                    return d;
                });

                const payload = {
                    fecha: fecha,
                    fecha_vencimiento: element.querySelector('#cc-vencimiento').value || fecha,
                    cliente_razon_social: rs,
                    cliente_nit: element.querySelector('#cc-nit').value.trim(),
                    cliente_direccion: element.querySelector('#cc-direccion').value.trim(),
                    cliente_ciudad: element.querySelector('#cc-ciudad').value.trim(),
                    cliente_telefono: element.querySelector('#cc-telefono').value.trim(),
                    cliente_email: element.querySelector('#cc-email').value.trim(),
                    forma_pago: element.querySelector('#cc-forma-pago').value,
                    medio_pago: element.querySelector('#cc-medio-pago').value.trim(),
                    detalles: doc.detalles,
                    subtotal: doc.subtotal,
                    impuestos: doc.impuestos,
                    total: doc.total
                };

                element.querySelector('#btn-save').disabled = true;
                element.querySelector('#btn-save').innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

                try {
                    let resultId = null;
                    if (id) {
                        await supabase.from('cuentas_cobro').update(payload).eq('id', id);
                        resultId = id;
                    } else {
                        const { data, error } = await supabase.from('cuentas_cobro').insert(payload).select('id').single();
                        if (error) throw error;
                        resultId = data.id;
                    }

                    CoreActions.showSuccessModal('Cuenta de Cobro guardada con éxito.');
                    setTimeout(() => window.location.hash = `#/ingresos/cuenta-cobro/ver/${resultId}`, 1500);
                } catch (e) {
                    console.error("Error saving cuenta cobro:", e);
                    CoreActions.showErrorModal('Error al guardar: ' + e.message);
                    element.querySelector('#btn-save').disabled = false;
                    element.querySelector('#btn-save').innerHTML = '<i class="bi bi-save me-2"></i>Guardar';
                }
            });
        }

        if (element.querySelector('#btn-preview')) {
            element.querySelector('#btn-preview').addEventListener('click', () => {
                PrintManager.printCuentaCobro(doc, 'preview');
            });
        }
        if (element.querySelector('#btn-print')) {
            element.querySelector('#btn-print').addEventListener('click', () => {
                PrintManager.printCuentaCobro(doc, 'print');
            });
        }
        if (element.querySelector('#btn-edit')) {
            element.querySelector('#btn-edit').addEventListener('click', () => {
                window.location.hash = `#/ingresos/cuenta-cobro/editar/${id}`;
            });
        }
    }
};
