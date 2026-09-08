import DB from '../core/db.js';
import { supabase } from '../core/supabase.js';
import { applyCurrencyFormatting, parseCurrencyValue } from './formatters.js';

export async function mostrarDetalleTransaccion(t, onSuccess) {
    const { data: categoriasDB } = await supabase.from('categorias_contables').select('nombre').eq('estado', 'activa');
    const categoriasDin = categoriasDB ? categoriasDB.map(c => c.nombre) : [];

    const isGroup = !!t.grupo_pago_id;
    const transIdVisual = t.grupo_pago_id || t.id;

    // ── CASO GRUPO: cargar datos ─────────────────────────────────────────────
    let pagosDelGrupo = [];    // [{ id, factura_id, monto }]
    let facturasDelGrupo = []; // [{ id, numero, total, saldo_original }]
    let montoTotalGrupo = Number(t.monto);

    if (isGroup) {
        const { data: pgData } = await supabase
            .from('pagos_ingresos')
            .select('id, factura_id, monto')
            .eq('grupo_pago_id', t.grupo_pago_id);
        pagosDelGrupo = pgData || [];

        const facturaIds = pagosDelGrupo.map(p => p.factura_id).filter(Boolean);
        if (facturaIds.length > 0) {
            const { data: fgData } = await supabase
                .from('facturas')
                .select('id, numero, total, saldo_original')
                .in('id', facturaIds);
            facturasDelGrupo = fgData || [];
        }

        montoTotalGrupo = pagosDelGrupo.reduce((s, p) => s + Number(p.monto), 0);
    }

    // ── CAMPO FACTURA ASOCIADA (solo caso NO grupo) ──────────────────────────
    let htmlFacturaAsociada = '';
    if (!isGroup) {
        let numeroVisible = '';
        if (t.factura_id) {
            const { data: facturaActual } = await supabase.from('facturas').select('numero').eq('id', t.factura_id).single();
            numeroVisible = facturaActual?.numero || '';
        }
        htmlFacturaAsociada = `
        <div class="mb-3">
            <label class="form-label text-muted small">N\u00ba Factura Asociada (opcional)</label>
            <input type="number" id="edit-trans-factura-id" class="form-control" value="${numeroVisible}" placeholder="Ej. 6736" disabled>
        </div>`;
    }

    // ── Eliminar instancia previa ────────────────────────────────────────────
    const existingEl = document.getElementById('modalDetalleTransaccion');
    if (existingEl) existingEl.remove();

    // ── HTML: OFFCANVAS (grupo) o MODAL (individual) ─────────────────────────
    let html;

    if (isGroup) {
        const tbodyHtml = pagosDelGrupo.map(p => {
            const fac = facturasDelGrupo.find(f => String(f.id) === String(p.factura_id));
            const numFac = fac ? '#' + fac.numero : (p.factura_id ? '#' + p.factura_id : 'Sin factura');
            const totalFac = fac ? '$' + Number(fac.total).toLocaleString('es-CO') : '\u2014';
            const montoAbono = '$' + Number(p.monto).toLocaleString('es-CO');
            return `
            <tr>
                <td class="align-middle fw-medium">${numFac}</td>
                <td class="align-middle text-muted">${totalFac}</td>
                <td class="align-middle text-end fw-semibold">${montoAbono}</td>
            </tr>`;
        }).join('');

        html = `
        <div class="offcanvas offcanvas-end" tabindex="-1" id="modalDetalleTransaccion"
             aria-labelledby="offcanvas-titulo" style="width: 620px;">
            <div class="offcanvas-header border-bottom pb-3">
                <div>
                    <h5 class="offcanvas-title fw-bold mb-0" id="offcanvas-titulo">Pago agrupado</h5>
                    <span class="text-muted" style="font-size: 13px;">N\u00ba grupo: ${transIdVisual}</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <button type="button" id="btn-activar-edicion" class="btn btn-sm btn-light border">
                        <i class="bi bi-pencil me-1"></i>Editar pago
                    </button>
                    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
                </div>
            </div>
            <div class="offcanvas-body">
                <form id="form-editar-trans">
                    <!-- Resumen monto total -->
                    <div class="mb-4 p-3 rounded-3" style="background: #f8fafc; border: 1px solid #e2e8f0;">
                        <div class="text-muted small mb-1">Total abonado en este pago</div>
                        <div class="h3 fw-bold mb-0" id="display-monto-total" style="color: #0f172a;">
                            $${Number(montoTotalGrupo).toLocaleString('es-CO')}
                        </div>
                    </div>

                    <!-- Campos generales (solo lectura) -->
                    <div class="row mb-3 g-3">
                        <div class="col-6">
                            <label class="form-label text-muted small">Fecha</label>
                            <input type="date" id="edit-trans-fecha" class="form-control" value="${t.fecha}" disabled required>
                        </div>
                        <div class="col-6">
                            <label class="form-label text-muted small">Cuenta bancaria</label>
                            <select id="edit-trans-cuenta" class="form-select" disabled></select>
                        </div>
                    </div>
                    <div class="row mb-3 g-3">
                        <div class="col-6">
                            <label class="form-label text-muted small">Categor\u00eda</label>
                            <select id="edit-trans-categoria" class="form-select" disabled>
                                <option value="">Sin categor\u00eda</option>
                                ${categoriasDin.map(cat => `<option value="${cat}" ${t.categoria === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-6">
                            <label class="form-label text-muted small">Observaciones</label>
                            <input type="text" id="edit-trans-observaciones" class="form-control"
                                value="${(t.observaciones || '').replace(/"/g, '&quot;')}" disabled>
                        </div>
                    </div>

                    <!-- Tabla de facturas asociadas -->
                    <div class="mb-3 pt-3 border-top" id="wrap-facturas-grupo">
                        <label class="form-label text-muted small fw-medium mb-2">Facturas asociadas a este pago</label>
                        <div class="table-responsive">
                            <table class="table table-sm align-middle mb-0" id="tabla-facturas-grupo" style="font-size: 13px;">
                                <thead class="table-light">
                                    <tr class="text-muted">
                                        <th>Factura</th>
                                        <th>Total</th>
                                        <th class="text-end">Abonado</th>
                                    </tr>
                                </thead>
                                <tbody>${tbodyHtml}</tbody>
                            </table>
                        </div>
                    </div>
                </form>
            </div>
        </div>`;

    } else {
        // ── MODAL normal (pago individual) ────────────────────────────────────
        html = `
        <div class="modal fade" id="modalDetalleTransaccion" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 12px;">
                    <div class="modal-header border-0 pb-0 pt-4 px-4">
                        <h5 class="modal-title fw-bold">Pago recibido <span class="text-muted ms-2" style="font-size: 14px; font-weight: normal;">(N\u00ba trans: ${transIdVisual})</span></h5>
                        <div class="d-flex align-items-center gap-2">
                            <button type="button" id="btn-activar-edicion" class="btn btn-sm btn-light border">
                                <i class="bi bi-pencil me-1"></i>Editar pago
                            </button>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                    </div>
                    <div class="modal-body pt-3 pb-4 px-4">
                        <form id="form-editar-trans">
                            <div class="mb-4">
                                <div class="text-muted small">Valor total</div>
                                <div class="h4 fw-bold" id="display-monto-total">$${Number(t.monto).toLocaleString()}</div>
                            </div>
                            ${htmlFacturaAsociada}
                            <div class="row mb-3 g-3">
                                <div class="col-6">
                                    <label class="form-label text-muted small">Fecha</label>
                                    <input type="date" id="edit-trans-fecha" class="form-control" value="${t.fecha}" disabled required>
                                </div>
                                <div class="col-6">
                                    <label class="form-label text-muted small">Cuenta bancaria</label>
                                    <select id="edit-trans-cuenta" class="form-select" disabled></select>
                                </div>
                            </div>
                            <div class="row mb-3 g-3">
                                <div class="col-6">
                                    <label class="form-label text-muted small">Categor\u00eda</label>
                                    <select id="edit-trans-categoria" class="form-select" disabled>
                                        <option value="">Sin categor\u00eda</option>
                                        ${categoriasDin.map(cat => `<option value="${cat}" ${t.categoria === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="col-6">
                                    <label class="form-label text-muted small">Monto total</label>
                                    <input type="text" id="edit-trans-monto" class="form-control" value="${t.monto}" disabled required>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted small">Observaciones</label>
                                <input type="text" id="edit-trans-observaciones" class="form-control"
                                    value="${(t.observaciones || '').replace(/"/g, '&quot;')}" disabled>
                            </div>
                            <div class="d-grid mt-4" id="wrap-btn-guardar" style="display:none;">
                                <button type="submit" id="btn-guardar-trans-edit" class="btn text-white"
                                    style="background-color: #2cbfb7;">Guardar cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>`;
    }

    document.body.insertAdjacentHTML('beforeend', html);

    // ── Poblar select de cuentas ─────────────────────────────────────────────
    const dbCuentasEdit = await DB.getAll('cuentas_bancarias') || [];
    const selectCuentaEdit = document.getElementById('edit-trans-cuenta');
    selectCuentaEdit.innerHTML = dbCuentasEdit.map(c =>
        `<option value="${c.id}" ${String(c.id) === String(t.cuenta_id) ? 'selected' : ''}>${c.nombre}</option>`
    ).join('');

    if (!isGroup) {
        applyCurrencyFormatting(document.getElementById('edit-trans-monto'));
    }

    // ── Abrir instancia Bootstrap ────────────────────────────────────────────
    const uiEl = document.getElementById('modalDetalleTransaccion');
    const uiInstance = isGroup
        ? new bootstrap.Offcanvas(uiEl)
        : new bootstrap.Modal(uiEl);
    uiInstance.show();

    // ── Activar edición ──────────────────────────────────────────────────────
    document.getElementById('btn-activar-edicion').addEventListener('click', () => {
        if (isGroup) {
            sessionStorage.setItem('clienteId', String(t.contacto_id));
            window.location.hash = '#/ingresos/pagos/nuevo?clienteId=' + t.contacto_id + '&grupoId=' + encodeURIComponent(t.grupo_pago_id);
            uiInstance.hide();
            return;
        }

        ['edit-trans-fecha', 'edit-trans-cuenta', 'edit-trans-categoria', 'edit-trans-observaciones'].forEach(id => {
            document.getElementById(id).disabled = false;
        });

        document.getElementById('edit-trans-monto').disabled = false;
        const facInput = document.getElementById('edit-trans-factura-id');
        if (facInput) facInput.disabled = false;

        document.getElementById('wrap-btn-guardar').style.display = 'block';
        document.getElementById('btn-activar-edicion').style.display = 'none';
    });

    // ── Submit handler (solo individual) ─────────────────────────────────────
    document.getElementById('form-editar-trans').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (isGroup) return;

        const btnSubmit = document.getElementById('btn-guardar-trans-edit');
        if (btnSubmit && btnSubmit.disabled) return;
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.dataset.originalText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';
        }

        try {
            const updatePayload = {
                fecha:        document.getElementById('edit-trans-fecha').value,
                cuenta_id:    parseInt(document.getElementById('edit-trans-cuenta').value, 10),
                categoria:    document.getElementById('edit-trans-categoria').value || null,
                observaciones: document.getElementById('edit-trans-observaciones').value
            };

            let oldFacturaId = t.factura_id;
            let newFacturaId = oldFacturaId;
            let oldMonto = Number(t.monto);
            let newMonto = parseCurrencyValue(document.getElementById('edit-trans-monto').value);
            updatePayload.monto = newMonto;

            const facVal = document.getElementById('edit-trans-factura-id').value;
            newFacturaId = null;
            if (facVal) {
                const { data: fExist } = await supabase.from('facturas').select('id').eq('numero', parseInt(facVal, 10)).single();
                if (!fExist) {
                    throw new Error(`No existe ninguna factura con el n\u00famero ${facVal}.`);
                }
                newFacturaId = fExist.id;
            }
            updatePayload.factura_id = newFacturaId;

            let estadosFacturas = [];
            if (oldFacturaId !== newFacturaId || oldMonto !== newMonto) {
                const facturaIdsAfectadas = [...new Set([oldFacturaId, newFacturaId].filter(Boolean))];
                if (facturaIdsAfectadas.length > 0) {
                    const { data: transaccionesF } = await supabase.from('pagos_ingresos').select('*').in('factura_id', facturaIdsAfectadas);
                    const { data: facturasF } = await supabase.from('facturas').select('*').in('id', facturaIdsAfectadas);

                    if (facturasF && transaccionesF) {
                        const { calcularEstadoFactura } = await import('./carteraUtils.js');
                        for (let f of facturasF) {
                            f.estado = 'pendiente';
                            const txM = transaccionesF.filter(tx => tx.factura_id === f.id).map(tx => ({
                                ...tx,
                                monto: tx.id === t.id ? newMonto : tx.monto,
                                tipo:  tx.tipo === 'in' ? 'ingreso' : 'egreso'
                            }));
                            const metricas = calcularEstadoFactura(f, txM);
                            estadosFacturas.push({ id: f.id, estado: metricas.estado });
                        }
                    }
                }
            }

            const { error } = await supabase.rpc('editar_transaccion_y_actualizar_facturas', {
                p_es_grupo:       false,
                p_pago_id:        t.id,
                p_grupo_pago_id:  null,
                p_update_payload: updatePayload,
                p_estados_facturas: estadosFacturas
            });
            if (error) throw error;

            document.activeElement?.blur();
            uiEl.addEventListener('hidden.bs.modal', () => {
                if (onSuccess) onSuccess();
            }, { once: true });
            uiInstance.hide();

        } catch (err) {
            alert('Error al guardar: ' + (err?.message || JSON.stringify(err)));
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = btnSubmit.dataset.originalText;
            }
        }
    });
}
