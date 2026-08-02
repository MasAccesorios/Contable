import DB from '../core/db.js';
import { supabase } from '../core/supabase.js';
import { CATEGORIAS_GASTO } from '../modules/gastos/gastos.js';

export async function mostrarDetalleTransaccion(t, onSuccess) {
    let facturasAsociadasHtml = '';
    if (t.grupo_pago_id) {
        const { data: pagosDelGrupo } = await supabase
            .from('pagos_ingresos')
            .select('factura_id, monto')
            .eq('grupo_pago_id', t.grupo_pago_id);
        if (pagosDelGrupo && pagosDelGrupo.length > 1) {
            const facturaIds = pagosDelGrupo.map(p => p.factura_id).filter(Boolean);
            const { data: facturasDelGrupo } = await supabase
                .from('facturas')
                .select('id, numero, fecha, total, saldo_original')
                .in('id', facturaIds);
            facturasAsociadasHtml = `
                <div class="mb-3 pt-3 border-top">
                    <label class="form-label text-muted small fw-medium">Facturas asociadas a este pago</label>
                    <table class="table table-sm mb-0" style="font-size: 13px;">
                        <thead><tr class="text-muted"><th>Número</th><th>Total</th><th>Abonado aquí</th></tr></thead>
                        <tbody>
                            ${pagosDelGrupo.map(p => {
                                const f = (facturasDelGrupo || []).find(x => x.id === p.factura_id);
                                return `<tr><td>${f ? f.numero : p.factura_id}</td><td>$${f ? Number(f.total).toLocaleString() : '-'}</td><td>$${Number(p.monto).toLocaleString()}</td></tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>`;
        }
    }

    const existingModal = document.getElementById('modalDetalleTransaccion');
    if (existingModal) existingModal.remove();

    const html = `
    <div class="modal fade" id="modalDetalleTransaccion" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg" style="border-radius: 12px;">
                <div class="modal-header border-0 pb-0 pt-4 px-4">
                    <h5 class="modal-title fw-bold">Pago recibido</h5>
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
                            <div class="h4 fw-bold">$${Number(t.monto).toLocaleString()}</div>
                        </div>
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
                                <label class="form-label text-muted small">Categoría</label>
                                <select id="edit-trans-categoria" class="form-select" disabled>
                                    <option value="">Sin categoría</option>
                                    ${CATEGORIAS_GASTO.map(cat => `<option value="${cat}" ${t.categoria === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-6">
                                <label class="form-label text-muted small">Monto total</label>
                                <input type="number" step="any" id="edit-trans-monto" class="form-control" value="${t.monto}" disabled required>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-muted small">Observaciones</label>
                            <input type="text" id="edit-trans-observaciones" class="form-control" value="${(t.observaciones || '').replace(/"/g, '&quot;')}" disabled>
                        </div>
                        ${facturasAsociadasHtml}
                        <div class="d-grid mt-4" id="wrap-btn-guardar" style="display:none;">
                            <button type="submit" class="btn text-white" style="background-color: #2cbfb7;">Guardar cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    const dbCuentasEdit = await DB.getAll('cuentas_bancarias') || [];
    const selectCuentaEdit = document.getElementById('edit-trans-cuenta');
    selectCuentaEdit.innerHTML = dbCuentasEdit.map(c => `<option value="${c.id}" ${String(c.id) === String(t.cuenta_id) ? 'selected' : ''}>${c.nombre}</option>`).join('');

    const modalInstance = new bootstrap.Modal(document.getElementById('modalDetalleTransaccion'));
    modalInstance.show();

    document.getElementById('btn-activar-edicion').addEventListener('click', () => {
        ['edit-trans-fecha','edit-trans-cuenta','edit-trans-categoria','edit-trans-monto','edit-trans-observaciones'].forEach(idCampo => {
            document.getElementById(idCampo).disabled = false;
        });
        document.getElementById('wrap-btn-guardar').style.display = 'block';
        document.getElementById('btn-activar-edicion').style.display = 'none';
    });

    document.getElementById('form-editar-trans').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        try {
            const { error } = await supabase.from('pagos_ingresos').update({
                fecha: document.getElementById('edit-trans-fecha').value,
                monto: parseFloat(document.getElementById('edit-trans-monto').value),
                cuenta_id: parseInt(document.getElementById('edit-trans-cuenta').value, 10),
                categoria: document.getElementById('edit-trans-categoria').value || null,
                observaciones: document.getElementById('edit-trans-observaciones').value
            }).eq('id', t.id);
            if (error) throw error;
            modalInstance.hide();
            if (onSuccess) onSuccess();
        } catch (err) {
            alert('Error al guardar: ' + (err?.message || JSON.stringify(err)));
        }
    });
}
