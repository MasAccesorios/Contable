import DB from '../core/db.js';
import { supabase } from '../core/supabase.js';
import { applyCurrencyFormatting, parseCurrencyValue } from './formatters.js';

export async function mostrarDetalleTransaccion(t, onSuccess) {
    const { data: categoriasDB } = await supabase.from('categorias_contables').select('nombre').eq('estado', 'activa');
    const categoriasDin = categoriasDB ? categoriasDB.map(c => c.nombre) : [];

    const isGroup = !!t.grupo_pago_id;
    const transIdVisual = t.grupo_pago_id || t.id;

    // ── CASO GRUPO: cargar líneas del grupo ──────────────────────────────────
    let pagosDelGrupo = [];   // [{ id, factura_id, monto }]
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

    // ── TABLA DE FACTURAS (lectura) para modo vista ──────────────────────────
    let facturasAsociadasHtml = '';
    if (isGroup && pagosDelGrupo.length > 0) {
        facturasAsociadasHtml = `
            <div class="mb-3 pt-3 border-top" id="wrap-facturas-grupo">
                <label class="form-label text-muted small fw-medium">Facturas asociadas a este pago</label>
                <table class="table table-sm mb-0" id="tabla-facturas-grupo" style="font-size: 13px;">
                    <thead><tr class="text-muted"><th>Número</th><th>Total</th><th>Abonado aquí</th><th class="d-none edit-col"></th></tr></thead>
                    <tbody>
                        ${pagosDelGrupo.map(p => {
                            const f = facturasDelGrupo.find(x => x.id === p.factura_id);
                            return `<tr data-pago-id="${p.id}" data-factura-id="${p.factura_id}">
                                <td>${f ? f.numero : p.factura_id}</td>
                                <td>$${f ? Number(f.total).toLocaleString() : '-'}</td>
                                <td class="td-monto-view">$${Number(p.monto).toLocaleString()}</td>
                                <td class="d-none edit-col td-monto-edit">
                                    <input type="text" class="form-control form-control-sm input-linea-monto" value="${p.monto}" style="width:120px;">
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
                <div id="wrap-agregar-factura" class="d-none mt-2">
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-agregar-factura-grupo">
                        <i class="bi bi-plus-lg me-1"></i>Agregar factura pendiente
                    </button>
                </div>
            </div>`;
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
            <label class="form-label text-muted small">Nº Factura Asociada (opcional)</label>
            <input type="number" id="edit-trans-factura-id" class="form-control" value="${numeroVisible}" placeholder="Ej. 6736" disabled>
        </div>`;
    }

    const existingModal = document.getElementById('modalDetalleTransaccion');
    if (existingModal) existingModal.remove();

    // ── HTML DEL MODAL ───────────────────────────────────────────────────────
    const html = `
    <div class="modal fade" id="modalDetalleTransaccion" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered${isGroup ? ' modal-lg' : ''}">
            <div class="modal-content border-0 shadow-lg" style="border-radius: 12px;">
                <div class="modal-header border-0 pb-0 pt-4 px-4">
                    <h5 class="modal-title fw-bold">Pago recibido <span class="text-muted ms-2" style="font-size: 14px; font-weight: normal;">(Nº trans: ${transIdVisual})</span></h5>
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
                            <div class="h4 fw-bold" id="display-monto-total">$${Number(isGroup ? montoTotalGrupo : t.monto).toLocaleString()}</div>
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
                                <label class="form-label text-muted small">Categoría</label>
                                <select id="edit-trans-categoria" class="form-select" disabled>
                                    <option value="">Sin categoría</option>
                                    ${categoriasDin.map(cat => `<option value="${cat}" ${t.categoria === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                                </select>
                            </div>
                            ${!isGroup ? `
                            <div class="col-6">
                                <label class="form-label text-muted small">Monto total</label>
                                <input type="text" id="edit-trans-monto" class="form-control" value="${t.monto}" disabled required>
                            </div>` : ''}
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-muted small">Observaciones</label>
                            <input type="text" id="edit-trans-observaciones" class="form-control" value="${(t.observaciones || '').replace(/"/g, '&quot;')}" disabled>
                        </div>
                        ${facturasAsociadasHtml}
                        <div class="d-grid mt-4" id="wrap-btn-guardar" style="display:none;">
                            <button type="submit" id="btn-guardar-trans-edit" class="btn text-white" style="background-color: #2cbfb7;">Guardar cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    // ── Poblar select de cuentas ─────────────────────────────────────────────
    const dbCuentasEdit = await DB.getAll('cuentas_bancarias') || [];
    const selectCuentaEdit = document.getElementById('edit-trans-cuenta');
    selectCuentaEdit.innerHTML = dbCuentasEdit.map(c => `<option value="${c.id}" ${String(c.id) === String(t.cuenta_id) ? 'selected' : ''}>${c.nombre}</option>`).join('');

    if (!isGroup) {
        applyCurrencyFormatting(document.getElementById('edit-trans-monto'));
    }

    const modalInstance = new bootstrap.Modal(document.getElementById('modalDetalleTransaccion'));
    modalInstance.show();

    // ── Helper: recalcula el total del grupo desde los inputs de la tabla ────
    function recalcularTotalGrupo() {
        const inputs = document.querySelectorAll('#tabla-facturas-grupo .input-linea-monto');
        let sum = 0;
        inputs.forEach(inp => { sum += parseCurrencyValue(inp.value) || 0; });
        const display = document.getElementById('display-monto-total');
        if (display) display.textContent = '$' + sum.toLocaleString('es-CO');
    }

    // ── Activar edición ──────────────────────────────────────────────────────
    document.getElementById('btn-activar-edicion').addEventListener('click', () => {
        ['edit-trans-fecha','edit-trans-cuenta','edit-trans-categoria','edit-trans-observaciones'].forEach(idCampo => {
            document.getElementById(idCampo).disabled = false;
        });

        if (isGroup) {
            // Mostrar columna editable de montos, ocultar columna de vista
            document.querySelectorAll('#tabla-facturas-grupo .td-monto-view').forEach(td => td.classList.add('d-none'));
            document.querySelectorAll('#tabla-facturas-grupo .edit-col').forEach(td => td.classList.remove('d-none'));
            // Aplicar formato moneda a cada input de la tabla
            document.querySelectorAll('#tabla-facturas-grupo .input-linea-monto').forEach(inp => {
                applyCurrencyFormatting(inp);
                inp.addEventListener('input', recalcularTotalGrupo);
            });
            // Mostrar botón de agregar factura
            const wrapAgregar = document.getElementById('wrap-agregar-factura');
            if (wrapAgregar) wrapAgregar.classList.remove('d-none');
        } else {
            document.getElementById('edit-trans-monto').disabled = false;
            const facInput = document.getElementById('edit-trans-factura-id');
            if (facInput) facInput.disabled = false;
        }

        document.getElementById('wrap-btn-guardar').style.display = 'block';
        document.getElementById('btn-activar-edicion').style.display = 'none';
    });

    // ── Botón "+ Agregar factura pendiente" (solo isGroup) ──────────────────
    const btnAgregarFac = document.getElementById('btn-agregar-factura-grupo');
    if (btnAgregarFac) {
        btnAgregarFac.addEventListener('click', async () => {
            btnAgregarFac.disabled = true;
            btnAgregarFac.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Cargando...';

            try {
                const { data: cartera } = await supabase.rpc('get_cartera_con_saldos', {
                    p_tipo_cartera: 'cxc',
                    p_contacto_id: String(t.contacto_id)
                });

                // IDs ya presentes en la tabla
                const idsEnTabla = new Set(
                    [...document.querySelectorAll('#tabla-facturas-grupo tbody tr')].map(tr => tr.dataset.facturaId)
                );

                const disponibles = (cartera || []).filter(f => !idsEnTabla.has(String(f.id)));

                if (disponibles.length === 0) {
                    alert('No hay facturas pendientes adicionales para este contacto.');
                    return;
                }

                // Crear select temporal inline
                const wrapAgregar = document.getElementById('wrap-agregar-factura');
                const selectExistente = document.getElementById('select-nueva-factura-grupo');
                if (selectExistente) selectExistente.remove();

                const sel = document.createElement('select');
                sel.id = 'select-nueva-factura-grupo';
                sel.className = 'form-select form-select-sm mt-2';
                sel.innerHTML = `<option value="">-- Selecciona una factura --</option>` +
                    disponibles.map(f =>
                        `<option value="${f.id}" data-numero="${f.numero}" data-total="${f.total}">` +
                        `${f.numero} \u2014 saldo pendiente $${Number(f.saldo ?? f.total).toLocaleString('es-CO')}` +
                        `</option>`
                    ).join('');

                wrapAgregar.appendChild(sel);

                sel.addEventListener('change', () => {
                    const opt = sel.selectedOptions[0];
                    if (!opt.value) return;

                    const tbody = document.querySelector('#tabla-facturas-grupo tbody');
                    const tr = document.createElement('tr');
                    tr.dataset.pagoId = '';          // nueva línea, sin pago_id
                    tr.dataset.facturaId = opt.value;
                    tr.innerHTML = `
                        <td>${opt.dataset.numero}</td>
                        <td>$${Number(opt.dataset.total).toLocaleString('es-CO')}</td>
                        <td class="td-monto-view d-none"></td>
                        <td class="edit-col td-monto-edit">
                            <input type="text" class="form-control form-control-sm input-linea-monto" placeholder="0" style="width:120px;">
                        </td>`;
                    tbody.appendChild(tr);

                    // Aplicar formato y escuchar cambios
                    const inp = tr.querySelector('.input-linea-monto');
                    applyCurrencyFormatting(inp);
                    inp.addEventListener('input', recalcularTotalGrupo);
                    inp.focus();

                    sel.remove();
                });
            } catch (err) {
                alert('Error cargando facturas: ' + err.message);
            } finally {
                btnAgregarFac.disabled = false;
                btnAgregarFac.innerHTML = '<i class="bi bi-plus-lg me-1"></i>Agregar factura pendiente';
            }
        });
    }

    // ── Submit handler ───────────────────────────────────────────────────────
    document.getElementById('form-editar-trans').addEventListener('submit', async (ev) => {
        ev.preventDefault();

        const btnSubmit = document.getElementById('btn-guardar-trans-edit');
        if (btnSubmit && btnSubmit.disabled) return;
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.dataset.originalText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';
        }

        try {
            const updatePayload = {
                fecha: document.getElementById('edit-trans-fecha').value,
                cuenta_id: parseInt(document.getElementById('edit-trans-cuenta').value, 10),
                categoria: document.getElementById('edit-trans-categoria').value || null,
                observaciones: document.getElementById('edit-trans-observaciones').value
            };

            // ── CASO GRUPO ───────────────────────────────────────────────────
            if (isGroup) {
                // Construir array de líneas desde la tabla
                const filas = [...document.querySelectorAll('#tabla-facturas-grupo tbody tr')];
                const lineas = filas.map(fila => ({
                    pago_id: fila.dataset.pagoId || null,
                    factura_id: fila.dataset.facturaId,
                    monto: parseCurrencyValue(fila.querySelector('.input-linea-monto').value)
                }));

                // Validar montos
                const lineaInvalida = lineas.find(l => !(l.monto > 0));
                if (lineaInvalida) {
                    alert('Todos los montos de las facturas deben ser mayores a 0.');
                    return;
                }

                // Recalcular estados de todas las facturas involucradas
                const facturaIdsAfectadas = [...new Set(lineas.map(l => l.factura_id).filter(Boolean))];
                let estadosFacturas = [];

                if (facturaIdsAfectadas.length > 0) {
                    const { data: transaccionesF } = await supabase.from('pagos_ingresos').select('*').in('factura_id', facturaIdsAfectadas);
                    const { data: facturasF } = await supabase.from('facturas').select('*').in('id', facturaIdsAfectadas);

                    if (facturasF && transaccionesF) {
                        const { calcularEstadoFactura } = await import('./carteraUtils.js');
                        for (const f of facturasF) {
                            f.estado = 'pendiente';

                            // Transacciones existentes de esta factura (con montos nuevos aplicados)
                            let txM = transaccionesF
                                .filter(tx => tx.factura_id === f.id)
                                .map(tx => {
                                    const lineaMatch = lineas.find(l => l.pago_id && String(l.pago_id) === String(tx.id));
                                    return {
                                        ...tx,
                                        monto: lineaMatch ? lineaMatch.monto : tx.monto,
                                        tipo: tx.tipo === 'in' ? 'ingreso' : 'egreso'
                                    };
                                });

                            // Agregar líneas NUEVAS (sin pago_id) como tx virtuales
                            const lineasNuevas = lineas.filter(l => !l.pago_id && String(l.factura_id) === String(f.id));
                            lineasNuevas.forEach((ln, index) => {
                                txM.push({
                                    id: Date.now() + index,  // único por línea, siempre > 22669
                                    factura_id: f.id,
                                    tipo: 'ingreso',
                                    estado: 'activo',
                                    fecha: updatePayload.fecha,
                                    observaciones: '',
                                    monto: ln.monto
                                });
                            });

                            const metricas = calcularEstadoFactura(f, txM);
                            estadosFacturas.push({ id: f.id, estado: metricas.estado });
                        }
                    }
                }

                const { error } = await supabase.rpc('editar_pago_grupo_lineas', {
                    p_grupo_pago_id: t.grupo_pago_id,
                    p_update_payload: updatePayload,
                    p_lineas: lineas,
                    p_estados_facturas: estadosFacturas
                });
                if (error) throw error;

            // ── CASO INDIVIDUAL ──────────────────────────────────────────────
            } else {
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
                        throw new Error(`No existe ninguna factura con el número ${facVal}.`);
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
                                    tipo: tx.tipo === 'in' ? 'ingreso' : 'egreso'
                                }));
                                const metricas = calcularEstadoFactura(f, txM);
                                estadosFacturas.push({ id: f.id, estado: metricas.estado });
                            }
                        }
                    }
                }

                const { error } = await supabase.rpc('editar_transaccion_y_actualizar_facturas', {
                    p_es_grupo: false,
                    p_pago_id: t.id,
                    p_grupo_pago_id: null,
                    p_update_payload: updatePayload,
                    p_estados_facturas: estadosFacturas
                });
                if (error) throw error;
            }

            document.activeElement?.blur();
            const modalEl = document.getElementById('modalDetalleTransaccion');
            modalEl.addEventListener('hidden.bs.modal', () => {
                if (onSuccess) onSuccess();
            }, { once: true });
            modalInstance.hide();

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
