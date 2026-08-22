import { supabase } from '../../core/supabase.js';
import { CoreActions } from '../../shared/crud.js';
import DB from '../../core/db.js';

export const VendedoresModule = {
    async init(element) {
        if (!element) return;
        const hashParts = window.location.hash.split('/');
        const action = hashParts[2];
        const id = hashParts[3];

        if (action === 'ver' && id) {
            await this.renderDetalle(element, id);
        } else {
            await this.renderList(element);
        }
    },

    async renderList(element) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; color: var(--primary);">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;

        let vendedores = [];
        try {
            const { data, error } = await supabase.rpc('get_vendedores_resumen');
            if (error) throw error;
            vendedores = data || [];
        } catch (e) {
            console.error('Error cargando vendedores:', e);
        }

        const totalPendiente = vendedores.reduce((acc, v) => acc + Number(v.comision_pendiente || 0), 0);
        const totalPagado = vendedores.reduce((acc, v) => acc + Number(v.comision_pagada || 0), 0);

        element.innerHTML = `
            <div class="dash-layout p-4" style="max-width: 1200px; margin: 0 auto;">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Vendedores</h2>
                        <p class="text-muted mb-0" style="font-size: var(--fs-md);">Gestiona tus vendedores y las comisiones generadas por sus ventas pagadas.</p>
                    </div>
                    <button class="btn btn-primary-action" id="btn-nuevo-vendedor">
                        <i class="bi bi-plus-lg me-1"></i> Nuevo vendedor
                    </button>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Vendedores activos</span>
                            <div class="ds-kpi-value">${vendedores.filter(v => v.estado === 'activo').length}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Comisiones pendientes por pagar</span>
                            <div class="ds-kpi-value text-warning">$${totalPendiente.toLocaleString()}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Comisiones ya pagadas</span>
                            <div class="ds-kpi-value text-success">$${totalPagado.toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                <div class="ds-table-container mb-4">
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0">
                            <thead class="ds-table-header">
                                <tr>
                                    <th class="py-2 fw-normal">Nombre</th>
                                    <th class="py-2 fw-normal text-center">% Comisión</th>
                                    <th class="py-2 fw-normal text-end">Total vendido (pagado)</th>
                                    <th class="py-2 fw-normal text-end">Comisión pendiente</th>
                                    <th class="py-2 fw-normal text-end">Comisión pagada</th>
                                    <th class="py-2 fw-normal text-center">Estado</th>
                                    <th class="py-2 fw-normal text-end" style="width: 100px;"></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${vendedores.length > 0 ? vendedores.map(v => `
                                    <tr style="border-bottom: 1px solid var(--border-color); font-size: var(--fs-base); color: var(--text-body); cursor:pointer;" onclick="if(!event.target.closest('button')) window.location.hash='#/vendedores/ver/${v.id}'">
                                        <td class="py-3 fw-medium" style="color: var(--text-main);">${v.nombre}</td>
                                        <td class="py-3 text-center">${Number(v.porcentaje_comision)}%</td>
                                        <td class="py-3 text-end">$${Number(v.total_vendido).toLocaleString()}</td>
                                        <td class="py-3 text-end text-warning fw-medium">$${Number(v.comision_pendiente).toLocaleString()}</td>
                                        <td class="py-3 text-end text-success">$${Number(v.comision_pagada).toLocaleString()}</td>
                                        <td class="py-3 text-center">
                                            <span class="badge ${v.estado === 'activo' ? 'bg-success text-success bg-opacity-10 border border-success-subtle' : 'bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle'} rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">
                                                ${v.estado === 'activo' ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td class="py-3 text-end">
                                            <button class="btn btn-sm btn-link text-dark p-0 btn-editar-vendedor" data-id="${v.id}" data-nombre="${v.nombre}" data-telefono="${v.telefono || ''}" data-porcentaje="${v.porcentaje_comision}" data-estado="${v.estado}" title="Editar">
                                                <i class="bi bi-pencil"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="7" class="text-center py-5 text-muted">Aún no tienes vendedores registrados</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-nuevo-vendedor').addEventListener('click', () => this.openVendedorModal());

        document.querySelectorAll('.btn-editar-vendedor').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openVendedorModal({
                    id: btn.dataset.id,
                    nombre: btn.dataset.nombre,
                    telefono: btn.dataset.telefono,
                    porcentaje: btn.dataset.porcentaje,
                    estado: btn.dataset.estado
                });
            });
        });
    },

    openVendedorModal(vendedor = null) {
        const existing = document.getElementById('vendedor-modal');
        if (existing) existing.remove();

        const esEdicion = !!vendedor;
        const modalHtml = `
            <div id="vendedor-modal" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(12, 26, 48, 0.4); z-index: 1050; backdrop-filter: blur(2px);">
                <div class="bg-white p-4 shadow rounded" style="width: 420px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h5 class="fw-bold mb-0" style="color: var(--text-main);">${esEdicion ? 'Editar vendedor' : 'Nuevo vendedor'}</h5>
                        <button class="btn-close" id="btn-close-vendedor-modal" aria-label="Close"></button>
                    </div>

                    <div class="mb-3">
                        <label class="form-label text-muted" style="font-size: 13px;">Nombre</label>
                        <input type="text" id="vend-nombre" class="form-control" value="${vendedor?.nombre || ''}">
                    </div>

                    <div class="mb-3">
                        <label class="form-label text-muted" style="font-size: 13px;">Teléfono (opcional)</label>
                        <input type="text" id="vend-telefono" class="form-control" value="${vendedor?.telefono || ''}">
                    </div>

                    <div class="mb-3">
                        <label class="form-label text-muted" style="font-size: 13px;">% Comisión sobre el total de la venta</label>
                        <input type="number" id="vend-porcentaje" class="form-control" value="${vendedor?.porcentaje || 10}" min="0" max="100" step="0.1">
                    </div>

                    ${esEdicion ? `
                    <div class="mb-4">
                        <label class="form-label text-muted" style="font-size: 13px;">Estado</label>
                        <select id="vend-estado" class="form-select">
                            <option value="activo" ${vendedor?.estado === 'activo' ? 'selected' : ''}>Activo</option>
                            <option value="inactivo" ${vendedor?.estado === 'inactivo' ? 'selected' : ''}>Inactivo</option>
                        </select>
                    </div>` : ''}

                    <div id="vend-error" class="text-danger mb-3" style="font-size: 12px; display: none;"></div>

                    <div class="d-flex justify-content-end gap-2">
                        <button class="btn btn-light border" id="btn-cancel-vendedor">Cancelar</button>
                        <button class="btn btn-primary-action" id="btn-guardar-vendedor">Guardar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const closeModal = () => document.getElementById('vendedor-modal')?.remove();
        document.getElementById('btn-close-vendedor-modal').addEventListener('click', closeModal);
        document.getElementById('btn-cancel-vendedor').addEventListener('click', closeModal);

        document.getElementById('btn-guardar-vendedor').addEventListener('click', async () => {
            const nombre = document.getElementById('vend-nombre').value.trim();
            const telefono = document.getElementById('vend-telefono').value.trim();
            const porcentaje = parseFloat(document.getElementById('vend-porcentaje').value);
            const errDiv = document.getElementById('vend-error');

            if (!nombre) {
                errDiv.textContent = 'El nombre es requerido.';
                errDiv.style.display = 'block';
                return;
            }
            if (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
                errDiv.textContent = 'El porcentaje debe ser un número entre 0 y 100.';
                errDiv.style.display = 'block';
                return;
            }

            try {
                if (esEdicion) {
                    const estado = document.getElementById('vend-estado').value;
                    const { error } = await supabase.from('vendedores')
                        .update({ nombre, telefono: telefono || null, porcentaje_comision: porcentaje, estado })
                        .eq('id', vendedor.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('vendedores')
                        .insert([{ nombre, telefono: telefono || null, porcentaje_comision: porcentaje }]);
                    if (error) throw error;
                }
                closeModal();
                await this.renderList(document.getElementById('view-viewport'));
            } catch (err) {
                errDiv.textContent = 'Error al guardar: ' + err.message;
                errDiv.style.display = 'block';
            }
        });
    },

    async renderDetalle(element, vendedorId) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; color: var(--primary);">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;

        const [{ data: vendedor }, { data: comisiones, error: errCom }, { data: cuentas }] = await Promise.all([
            supabase.from('vendedores').select('*').eq('id', vendedorId).single(),
            supabase.from('comisiones')
                .select('*, facturas(numero, fecha)')
                .eq('vendedor_id', vendedorId)
                .order('created_at', { ascending: false }),
            supabase.from('cuentas_bancarias').select('id, nombre').eq('estado', 'activo')
        ]);

        if (errCom) console.error('Error cargando comisiones:', errCom);
        const listaComisiones = comisiones || [];

        element.innerHTML = `
            <div class="dash-layout p-4" style="max-width: 1000px; margin: 0 auto;">
                <a href="#/vendedores" class="text-decoration-none text-muted d-inline-flex align-items-center gap-1 mb-3" style="font-size: var(--fs-md);">
                    <i class="bi bi-arrow-left"></i> Volver a Vendedores
                </a>
                <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">${vendedor?.nombre || 'Vendedor'}</h2>
                <p class="text-muted mb-4" style="font-size: var(--fs-md);">Comisión: ${Number(vendedor?.porcentaje_comision || 0)}% sobre el valor total de cada venta pagada.</p>

                <div class="ds-table-container mb-4">
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0">
                            <thead class="ds-table-header">
                                <tr>
                                    <th class="py-2 fw-normal">Factura</th>
                                    <th class="py-2 fw-normal">Fecha</th>
                                    <th class="py-2 fw-normal text-end">Comisión</th>
                                    <th class="py-2 fw-normal text-center">Estado</th>
                                    <th class="py-2 fw-normal text-end" style="width: 140px;"></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${listaComisiones.length > 0 ? listaComisiones.map(c => `
                                    <tr style="border-bottom: 1px solid var(--border-color); font-size: var(--fs-base); color: var(--text-body);">
                                        <td class="py-3 fw-medium" style="color: var(--text-main);">${c.facturas?.numero || c.factura_id}</td>
                                        <td class="py-3 text-muted">${c.facturas?.fecha || ''}</td>
                                        <td class="py-3 text-end fw-medium">$${Number(c.monto).toLocaleString()}</td>
                                        <td class="py-3 text-center">
                                            <span class="badge ${c.estado === 'pagada' ? 'bg-success text-success bg-opacity-10 border border-success-subtle' : 'bg-warning text-warning-emphasis bg-opacity-10 border border-warning-subtle'} rounded-pill fw-medium" style="font-size: var(--fs-xs); padding: 5px 10px;">
                                                ${c.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                                            </span>
                                        </td>
                                        <td class="py-3 text-end">
                                            ${c.estado === 'pendiente' ? `<button class="btn btn-sm btn-success btn-pagar-comision" data-id="${c.id}" data-monto="${c.monto}">Pagar</button>` : `<span class="text-muted" style="font-size: var(--fs-xs);">${c.fecha_pago || ''}</span>`}
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="5" class="text-center py-5 text-muted">Este vendedor aún no tiene comisiones generadas</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.querySelectorAll('.btn-pagar-comision').forEach(btn => {
            btn.addEventListener('click', () => this.openPagarComisionModal(btn.dataset.id, btn.dataset.monto, cuentas || [], vendedorId));
        });
    },

    openPagarComisionModal(comisionId, monto, cuentas, vendedorId) {
        const existing = document.getElementById('pagar-comision-modal');
        if (existing) existing.remove();

        const modalHtml = `
            <div id="pagar-comision-modal" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(12, 26, 48, 0.4); z-index: 1050; backdrop-filter: blur(2px);">
                <div class="bg-white p-4 shadow rounded" style="width: 400px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <h5 class="fw-bold mb-4" style="color: var(--text-main);">Pagar comisión</h5>
                    <p class="mb-3" style="font-size: var(--fs-md);">Monto: <strong>$${Number(monto).toLocaleString()}</strong></p>

                    <div class="mb-4">
                        <label class="form-label text-muted" style="font-size: 13px;">Cuenta desde la que se paga</label>
                        <select id="pago-cuenta" class="form-select">
                            ${cuentas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                        </select>
                    </div>

                    <div id="pago-error" class="text-danger mb-3" style="font-size: 12px; display: none;"></div>

                    <div class="d-flex justify-content-end gap-2">
                        <button class="btn btn-light border" id="btn-cancel-pago">Cancelar</button>
                        <button class="btn btn-primary-action" id="btn-confirmar-pago">Confirmar pago</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const closeModal = () => document.getElementById('pagar-comision-modal')?.remove();
        document.getElementById('btn-cancel-pago').addEventListener('click', closeModal);

        document.getElementById('btn-confirmar-pago').addEventListener('click', async () => {
            const cuentaId = document.getElementById('pago-cuenta').value;
            const errDiv = document.getElementById('pago-error');
            if (!cuentaId) {
                errDiv.textContent = 'Selecciona una cuenta.';
                errDiv.style.display = 'block';
                return;
            }

            try {
                const { error } = await supabase.rpc('pagar_comision', {
                    p_comision_id: parseInt(comisionId, 10),
                    p_cuenta_id: parseInt(cuentaId, 10)
                });
                if (error) throw error;

                closeModal();
                DB.invalidateCache('cuentas_bancarias');
                DB.invalidateCache('transacciones');
                await this.renderDetalle(document.getElementById('view-viewport'), vendedorId);
                CoreActions.showSuccessModal('Comisión pagada correctamente.');
            } catch (err) {
                errDiv.textContent = 'Error al pagar: ' + err.message;
                errDiv.style.display = 'block';
            }
        });
    }
};
