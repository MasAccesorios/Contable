import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions } from '../../shared/crud.js';
import { ItemEngine } from '../../shared/itemEngine.js';
import { InventarioUtils } from '../../shared/inventarioUtils.js';
import { escapeHtml } from '../../shared/formatters.js';

export const AjustesInventarioModule = {
    async init(element) {
        if (!element) return;
        
        const hashParts = window.location.hash.split('/');
        const action = hashParts[3];
        const id = hashParts[4];
        
        if (action === 'nuevo') {
            await this.renderForm(element);
        } else if (action === 'ver') {
            await this.renderForm(element, id, true);
        } else {
            await this.renderList(element);
        }
    },

    async renderList(element) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" style="color: var(--primary);" role="status"></div>
            </div>
        `;

        try {
            const { data: ajustes, error } = await supabase.from('ajustes_inventario').select('*').order('created_at', { ascending: false }).limit(50);
            if (error) throw error;

            const tbodyHtml = (ajustes && ajustes.length > 0) ? ajustes.map(a => {
                return `
                    <tr style="cursor: pointer; transition: background-color 0.2s;" onclick="if(!event.target.closest('button')) window.location.hash = '#/inventario/ajustes/ver/${a.id}'" class="hover-bg-light">
                        <td class="py-3 fw-medium">#${a.numero}</td>
                        <td class="py-3">${a.fecha || ''}</td>
                        <td class="py-3 text-truncate" style="max-width: 300px;">${a.observaciones || 'Sin observaciones'}</td>
                        <td class="py-3 text-end" style="position: relative;">
                            <button class="btn btn-link text-muted p-0 btn-menu-row" data-id="${a.id}">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('') : '<tr><td colspan="4" class="text-center py-5 text-muted">No se encontraron ajustes recientes</td></tr>';

            element.innerHTML = `
                <div class="dash-layout p-4" style="max-width: 1000px; margin: 0 auto;">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 class="h3 fw-bold mb-1 text-dark">Ajustes de Inventario</h2>
                            <p class="text-muted mb-0" style="font-size: var(--fs-md);">Registra incrementos o disminuciones por daños, pérdidas o descuadres.</p>
                        </div>
                        <button class="btn btn-primary-action" onclick="window.location.hash='#/inventario/ajustes/nuevo'">
                            <i class="bi bi-plus-lg me-1"></i> Nuevo Ajuste
                        </button>
                    </div>

                    <div class="ds-table-container">
                        <div class="table-responsive">
                            <table class="table table-borderless align-middle mb-0">
                                <thead class="ds-table-header">
                                    <tr>
                                        <th class="py-3">Número</th>
                                        <th class="py-3">Fecha</th>
                                        <th class="py-3">Observaciones</th>
                                        <th class="py-3 text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tbodyHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Row Menu
            element.querySelectorAll('.btn-menu-row').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const existing = document.querySelector('.row-action-menu');
                    if (existing) existing.remove();

                    const id = e.currentTarget.dataset.id;
                    const rect = e.currentTarget.getBoundingClientRect();
                    
                    const menuHtml = `
                        <div class="row-action-menu position-absolute bg-white shadow rounded border py-2" 
                             style="z-index: 1060; width: 150px; top: ${rect.bottom + window.scrollY}px; left: ${rect.left - 100}px;">
                            <a href="#/inventario/ajustes/ver/${id}" class="d-block px-3 py-1 text-decoration-none text-body hover-bg-light" style="font-size: var(--fs-base);">Ver Detalle</a>
                        </div>
                    `;
                    document.body.insertAdjacentHTML('beforeend', menuHtml);
                    
                    const menu = document.querySelector('.row-action-menu');
                    
                    const botonMenu = e.currentTarget;
                    const closeMenu = (evt) => {
                        if (menu && !menu.contains(evt.target) && !botonMenu.contains(evt.target)) {
                            menu.remove();
                            document.removeEventListener('click', closeMenu);
                        }
                    };
                    document.addEventListener('click', closeMenu);
                });
            });

        } catch (e) {
            console.error("Error cargando ajustes:", e);
            element.innerHTML = `<div class="p-4 text-danger">Error cargando lista: ${e.message}</div>`;
        }
    },

    async renderForm(element, id = null, isViewOnly = false) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" style="color: var(--primary);" role="status"></div>
            </div>
        `;

        try {
            let ajuste = { fecha: getLocalDate(), observaciones: '', detalles: [] };
            
            if (id) {
                const { data, error } = await supabase.from('ajustes_inventario').select('*').eq('id', id).single();
                if (error) throw error;
                ajuste = data;
                if (typeof ajuste.detalles === 'string') ajuste.detalles = JSON.parse(ajuste.detalles);
            } else {
                // Get next numero
                const { data: numData } = await supabase.rpc('get_next_sequence_value', { seq_name: 'ajustes_inventario_seq' });
                ajuste.numero = numData || 'Auto';
            }

            const productos = await DB.getAll('productos');
            // Mapeo auxiliar de nombre y sku para el ItemEngine base (que usa descripción)
            const detallesRender = (ajuste.detalles && ajuste.detalles.length > 0) ? ajuste.detalles : [{}];

            element.innerHTML = `
                <div class="dash-layout p-4" style="max-width: 1100px; margin: 0 auto;">
                    <div class="d-flex align-items-center mb-4 gap-3">
                        <button class="btn btn-link text-muted p-0 text-decoration-none" onclick="window.location.hash='#/inventario/ajustes'">
                            <i class="bi bi-arrow-left fs-5"></i>
                        </button>
                        <h2 class="h3 fw-bold mb-0" style="color: var(--text-main);">${id ? (isViewOnly ? 'Ver Ajuste' : 'Editar Ajuste') : 'Nuevo Ajuste de Inventario'}</h2>
                        <span class="ms-auto badge bg-light text-dark border p-2" style="font-size: var(--fs-md);">No. ${ajuste.numero}</span>
                    </div>

                    <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03); border-radius: 8px;">
                        <div class="card-header bg-white border-bottom p-4">
                            <h6 class="mb-0 fw-bold" style="color: var(--text-main);">Detalles del ajuste</h6>
                        </div>
                        <div class="card-body p-4">
                            <div class="row g-4">
                                <div class="col-md-4">
                                    <label class="form-label text-muted" style="font-size: var(--fs-base); font-weight: 500;">Fecha *</label>
                                    <input type="date" class="form-control" id="ajuste-fecha" value="${ajuste.fecha}" ${isViewOnly ? 'disabled' : ''}>
                                </div>
                                <div class="col-md-8">
                                    <label class="form-label text-muted" style="font-size: var(--fs-base); font-weight: 500;">Observaciones</label>
                                    <textarea class="form-control" id="ajuste-observaciones" rows="1" placeholder="Ej. Inventario dañado por filtración de agua" ${isViewOnly ? 'disabled' : ''}>${escapeHtml(ajuste.observaciones)}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03); border-radius: 8px;">
                        <div class="card-header bg-white border-bottom p-4 d-flex justify-content-between align-items-center">
                            <h6 class="mb-0 fw-bold" style="color: var(--text-main);">Ítems a ajustar</h6>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive" style="overflow: visible;">
                                <table class="table table-borderless align-middle mb-0" id="ajustes-table">
                                    <thead class="bg-light" style="border-bottom: 1px solid var(--border-color);">
                                        <tr style="color: var(--text-muted); font-size: var(--fs-base); font-weight: 500;">
                                            <th class="ps-4 py-3" style="width: 30%;">Ítem</th>
                                            <th class="py-3 text-center" style="width: 10%;">Stock Actual</th>
                                            <th class="py-3 text-center" style="width: 10%;">Saldo Resultante</th>
                                            <th class="py-3" style="width: 20%;">Tipo Ajuste</th>
                                            <th class="py-3" style="width: 10%;">Cantidad</th>
                                            <th class="py-3" style="width: 15%;">Costo Uni.</th>
                                            ${!isViewOnly ? '<th class="pe-4 py-3 text-center" style="width: 5%;"></th>' : ''}
                                        </tr>
                                    </thead>
                                    <tbody id="ajustes-body">
                                        <!-- Renderizado dinámico -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        ${!isViewOnly ? `
                        <div class="card-footer bg-white border-top p-3 text-center">
                            <button type="button" class="btn btn-link text-decoration-none" id="btn-add-line" style="color: var(--primary); font-weight: 500;">
                                <i class="bi bi-plus-circle me-1"></i> Agregar línea
                            </button>
                        </div>
                        ` : ''}
                    </div>

                    ${!isViewOnly ? `
                    <div class="d-flex justify-content-end gap-2">
                        <button class="btn btn-light border px-4" onclick="window.history.back()">Cancelar</button>
                        <button class="btn text-white px-4" id="btn-guardar-ajuste" style="background-color: var(--primary); font-weight: 500;">
                            Guardar Ajuste
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;

            const tbody = element.querySelector('#ajustes-body');
            
            // Render Engine for Ajustes
            const renderLine = (detalle = {}) => {
                const tr = document.createElement('tr');
                tr.className = 'item-row';
                
                // Tipo Adjustment logic
                const isIncremento = detalle.tipo === 'incremento';
                const isDisminucion = detalle.tipo === 'disminucion';
                
                tr.innerHTML = `
                    <td class="ps-4 py-3">
                        ${ItemEngine.renderProductSearchBox(detalle, productos, isViewOnly)}
                    </td>
                    <td class="py-3 text-center">
                        <span class="badge bg-secondary bg-opacity-10 text-secondary stock-actual-lbl" style="font-size: var(--fs-base);">--</span>
                    </td>
                    <td class="py-3 text-center">
                        <span class="badge bg-info bg-opacity-10 text-info saldo-resultante-lbl" style="font-size: var(--fs-base);">--</span>
                    </td>
                    <td class="py-3">
                        <select class="form-select form-select-sm select-tipo-ajuste text-muted bg-light border-0" ${isViewOnly ? 'disabled' : ''}>
                            <option value="">Seleccione...</option>
                            <option value="incremento" ${isIncremento ? 'selected' : ''}>Incremento</option>
                            <option value="disminucion" ${isDisminucion ? 'selected' : ''}>Disminución</option>
                        </select>
                    </td>
                    <td class="py-3">
                        <input type="number" class="form-control form-control-sm text-end border-0 bg-light input-cantidad" value="${detalle.cantidad || ''}" min="1" ${isViewOnly ? 'disabled' : ''}>
                    </td>
                    <td class="py-3">
                        <input type="text" class="form-control form-control-sm text-end border-0 bg-light input-costo" value="${detalle.costo_unitario || ''}" placeholder="$ 0" ${isViewOnly || !isIncremento ? 'disabled' : ''} ${isDisminucion ? 'title="Calculado automáticamente por el motor FIFO"' : ''}>
                    </td>
                    ${!isViewOnly ? `
                    <td class="pe-4 py-3 text-center">
                        <button class="btn btn-link text-danger p-0 btn-remove-line"><i class="bi bi-x-circle fs-5"></i></button>
                    </td>
                    ` : ''}
                `;
                tbody.appendChild(tr);

                if (!isViewOnly) {
                    // Mute ItemEngine internal description field since we don't use custom descriptions here
                    const descInput = tr.querySelector('.input-prod-desc');
                    if(descInput) descInput.style.display = 'none';

                    const inputProdId = tr.querySelector('.input-prod-id');
                    const searchInput = tr.querySelector('.input-prod-search');
                    const tipoSelect = tr.querySelector('.select-tipo-ajuste');
                    const costoInput = tr.querySelector('.input-costo');
                    const stockLbl = tr.querySelector('.stock-actual-lbl');

                    import('../../shared/combobox.js').then(({ UI }) => {
                        UI.createAsyncCombobox({
                            inputEl: searchInput,
                            hiddenIdEl: inputProdId,
                            fetchItems: (query) => UI.fetchProductosCombobox(query),
                            displayProp: 'nombre',
                            renderItem: (p) => {
                                return `<strong style="color: var(--text-main);">[${p.sku || p.reference || 'S/N'}]</strong> - ${p.nombre || p.name}`;
                            },
                            allowCreate: false,
                            onSelect: async (p) => {
                                // 1. Formato exacto
                                searchInput.value = `[${p.sku || p.reference || 'S/N'}] - ${p.nombre || p.name}`;
                                
                                // 2. Consultar Stock Real
                                stockLbl.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span>`;
                                try {
                                    const { data } = await supabase.from('lotes_fifo').select('cantidad_actual, costo_unitario').eq('producto_id', p.id);
                                    let stockTotal = 0;
                                    let costoLotes = 0;
                                    let stockPositivo = 0;
                                    if (data) {
                                        data.forEach(l => {
                                            stockTotal += l.cantidad_actual;
                                            if (l.cantidad_actual > 0) {
                                                stockPositivo += l.cantidad_actual;
                                                costoLotes += (l.cantidad_actual * Number(l.costo_unitario || 0));
                                            }
                                        });
                                    }
                                    stockLbl.textContent = stockTotal;
                                    const costoPromedio = stockPositivo > 0 ? (costoLotes / stockPositivo) : (p.costo_base || p.costoBase || p.precio_compra || p.precioCompra || 0);
                                    tr.dataset.costoPromedio = costoPromedio;
                                } catch(e) {
                                    stockLbl.textContent = '?';
                                }

                                // 3. Sugerir costo automáticamente si el tipo es Incremento
                                if (tipoSelect.value === 'incremento') {
                                    const precioSugerido = tr.dataset.costoPromedio;
                                    if (precioSugerido && !costoInput.value) {
                                        costoInput.value = `$ ${Number(precioSugerido).toLocaleString('es-CO', {maximumFractionDigits:2})}`;
                                    }
                                }
                                
                                // Detonar actualización del saldo
                                const inpCantidad = tr.querySelector('.input-cantidad');
                                if (inpCantidad) inpCantidad.dispatchEvent(new Event('input'));
                            }
                        });
                    });

                    // Carga inicial de stock si el producto ya venía seleccionado
                    if (inputProdId.value && inputProdId.value !== '') {
                        stockLbl.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span>`;
                        supabase.from('lotes_fifo').select('cantidad_actual, costo_unitario').eq('producto_id', inputProdId.value).then(({data}) => {
                            let stockTotal = 0;
                            let costoLotes = 0;
                            let stockPositivo = 0;
                            if (data) {
                                data.forEach(l => {
                                    stockTotal += l.cantidad_actual;
                                    if (l.cantidad_actual > 0) {
                                        stockPositivo += l.cantidad_actual;
                                        costoLotes += (l.cantidad_actual * Number(l.costo_unitario || 0));
                                    }
                                });
                            }
                            stockLbl.textContent = stockTotal;
                            const prod = productos.find(p => String(p.id) === String(inputProdId.value));
                            const costoPromedio = stockPositivo > 0 ? (costoLotes / stockPositivo) : (prod ? (prod.costo_base || prod.costoBase || prod.precio_compra || prod.precioCompra || 0) : 0);
                            tr.dataset.costoPromedio = costoPromedio;
                            const inpCantidad = tr.querySelector('.input-cantidad');
                            if (inpCantidad) inpCantidad.dispatchEvent(new Event('input'));
                        });
                    }

                    // Calculadora de Saldo Resultante
                    const calcSaldo = () => {
                        const stockActual = parseFloat(stockLbl.textContent);
                        const qty = parseFloat(tr.querySelector('.input-cantidad').value) || 0;
                        const tipo = tipoSelect.value;
                        const saldoLbl = tr.querySelector('.saldo-resultante-lbl');
                        
                        if (!saldoLbl) return;
                        
                        if (!tipo || isNaN(stockActual)) {
                            saldoLbl.textContent = '--';
                            saldoLbl.className = 'badge bg-info bg-opacity-10 text-info saldo-resultante-lbl';
                            return;
                        }
                        
                        let nuevoSaldo = stockActual;
                        if (tipo === 'incremento') nuevoSaldo += qty;
                        else if (tipo === 'disminucion') nuevoSaldo -= qty;
                        
                        saldoLbl.textContent = nuevoSaldo;
                        if (nuevoSaldo < 0) {
                            saldoLbl.className = 'badge bg-danger bg-opacity-10 text-danger saldo-resultante-lbl';
                        } else {
                            saldoLbl.className = 'badge bg-info bg-opacity-10 text-info saldo-resultante-lbl';
                        }
                    };

                    const inpCantidad = tr.querySelector('.input-cantidad');
                    if (inpCantidad) inpCantidad.addEventListener('input', calcSaldo);

                    tipoSelect.addEventListener('change', () => {
                        if (tipoSelect.value === 'incremento') {
                            costoInput.disabled = false;
                            costoInput.placeholder = "Costo Promedio";
                            // Try to suggest a cost
                            if (!costoInput.value && tr.dataset.costoPromedio) {
                                costoInput.value = `$ ${Number(tr.dataset.costoPromedio).toLocaleString('es-CO', {maximumFractionDigits:2})}`;
                            }
                        } else {
                            costoInput.disabled = true;
                            costoInput.value = '';
                            costoInput.placeholder = "Cálculo FIFO";
                        }
                        calcSaldo();
                    });
                    
                    // Formatting for Costo
                    costoInput.addEventListener('blur', (e) => {
                        let val = e.target.value.replace(/[^0-9.-]+/g,"");
                        if(val) e.target.value = `$ ${Number(val).toLocaleString('es-CO')}`;
                    });
                    costoInput.addEventListener('focus', (e) => {
                        let val = e.target.value.replace(/[^0-9.-]+/g,"");
                        e.target.value = val;
                    });

                    tr.querySelector('.btn-remove-line').addEventListener('click', () => {
                        tr.remove();
                    });
                } else {
                    // Si es view-only igual cargar stock histórico o dejar rayita
                    tr.querySelector('.stock-actual-lbl').textContent = 'N/A';
                    const costoInput = tr.querySelector('.input-costo');
                    if(costoInput && costoInput.value) {
                         let val = String(costoInput.value).replace(/[^0-9.-]+/g,"");
                         if(val) costoInput.value = `$ ${Number(val).toLocaleString('es-CO')}`;
                    }
                }
            };

            detallesRender.forEach(d => renderLine(d));

            if (!isViewOnly) {
                element.querySelector('#btn-add-line').addEventListener('click', () => renderLine());
                
                element.querySelector('#btn-guardar-ajuste').addEventListener('click', async (e) => {
                    const btnGuardar = e.currentTarget;
                    const fecha = element.querySelector('#ajuste-fecha').value;
                    const obs = element.querySelector('#ajuste-observaciones').value;
                    
                    if (!fecha) return CoreActions.showWarningModal("La fecha es obligatoria");

                    const rows = tbody.querySelectorAll('.item-row');
                    const itemsAjuste = [];
                    let hasErrors = false;

                    rows.forEach(r => {
                        const pid = r.querySelector('.input-prod-id').value;
                        const pName = r.querySelector('.input-prod-search').value;
                        const tipo = r.querySelector('.select-tipo-ajuste').value;
                        const qty = parseFloat(r.querySelector('.input-cantidad').value);
                        const costoRaw = r.querySelector('.input-costo').value.replace(/[^0-9.-]+/g,"");
                        const costo = parseFloat(costoRaw);

                        if (!pid) return; // Skip empty rows
                        
                        if (!tipo) { CoreActions.showWarningModal(`Selecciona el tipo de ajuste para ${pName}`); hasErrors = true; return; }
                        if (isNaN(qty) || qty <= 0) { CoreActions.showWarningModal(`Cantidad inválida en ${pName}`); hasErrors = true; return; }
                        
                        if (tipo === 'incremento' && (isNaN(costo) || costo < 0)) {
                            CoreActions.showWarningModal(`Ingresa el costo unitario para el incremento de ${pName}`);
                            hasErrors = true; return;
                        }

                        itemsAjuste.push({
                            productoId: pid,
                            nombre: pName,
                            tipo: tipo,
                            cantidad: qty,
                            costo_unitario: tipo === 'incremento' ? costo : null
                        });
                    });

                    if (hasErrors) return;
                    if (itemsAjuste.length === 0) return CoreActions.showWarningModal("Agrega al menos un ítem al ajuste");

                    btnGuardar.disabled = true;
                    btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...`;

                    try {
                        // 1. Obtener Siguiente Número (Si falla, hacemos fallback a un hash)
                        let nextNumero = ajuste.numero;
                        if (nextNumero === 'Auto') {
                            const { data: numData } = await supabase.rpc('get_next_sequence_value', { seq_name: 'ajustes_inventario_seq' });
                            nextNumero = numData || Date.now();
                        }

                        // 2. Procesar Inventario Híbrido
                        const itemsIncremento = itemsAjuste.filter(i => i.tipo === 'incremento');
                        const itemsDisminucion = itemsAjuste.filter(i => i.tipo === 'disminucion');

                        let planDisminucion = null;

                        // FASE 1: Simulación de salida (READ ONLY)
                        if (itemsDisminucion.length > 0) {
                            planDisminucion = await InventarioUtils.calcularSalidaInventario(itemsDisminucion);
                            if (!planDisminucion.success) throw new Error("Error en Disminución: " + planDisminucion.error);
                            
                            // Re-asignamos costos calculados por FIFO a nuestro historial
                            itemsDisminucion.forEach((item, idx) => {
                                const actualizado = planDisminucion.detallesActualizados.find(d => String(d.productoId) === String(item.productoId) && d.cantidad === item.cantidad);
                                if (actualizado) {
                                    item.costo_unitario = (actualizado.costoTotalCalculado / item.cantidad) || 0;
                                }
                            });
                        }

                        // FASE 2: Guardar documento principal (Ajuste)
                        const payload = {
                            numero: nextNumero,
                            fecha: fecha,
                            observaciones: obs,
                            detalles: itemsAjuste
                        };

                        // Se usa .select().single() para obtener el ID en caso de necesitar rollback
                        const { data: hdrData, error: hdrErr } = await supabase.from('ajustes_inventario').insert([payload]).select().single();
                        if (hdrErr) throw new Error("Fallo al guardar el ajuste de inventario: " + hdrErr.message);
                        const ajusteId = hdrData.id;

                        // FASE 3: Modificar Inventario Físico con Rollback de seguridad
                        let idsLotesIncrementoInsertados = [];

                        try {
                            // 3.1 PRIMERO: Inserts de Incrementos (Riesgo bajo, reversión fácil)
                            if (itemsIncremento.length > 0) {
                                const lotesInsert = itemsIncremento.map(item => ({
                                    producto_id: item.productoId,
                                    cantidad_inicial: item.cantidad,
                                    cantidad_actual: item.cantidad,
                                    costo_unitario: item.costo_unitario,
                                    fecha_ingreso: fecha,
                                    referencia: `Ajuste de Inventario #${nextNumero}`
                                }));
                                
                                // Usamos select() para obtener los IDs reales en caso de necesitar rollback
                                const { data: lotesGuardados, error: insErr } = await supabase.from('lotes_fifo').insert(lotesInsert).select();
                                if (insErr) throw new Error("Fallo al insertar lote de incremento: " + insErr.message);
                                
                                idsLotesIncrementoInsertados = lotesGuardados.map(l => l.id);
                            }

                            // 3.2 SEGUNDO: Disminuciones FIFO (Riesgo alto, toca lotes existentes)
                            if (itemsDisminucion.length > 0 && planDisminucion) {
                                const origenDoc = 'ajuste:' + nextNumero;
                                await InventarioUtils.ejecutarPlanInventario(planDisminucion.operacionesDB, origenDoc);
                            }

                        } catch (invErr) {
                            // ROLLBACK COMPENSATORIO TOTAL
                            console.error("Fallo crítico ajustando inventario físico post-registro. Revirtiendo...", invErr);
                            
                            // A. Revertir los incrementos (si llegaron a insertarse)
                            if (idsLotesIncrementoInsertados.length > 0) {
                                await supabase.from('lotes_fifo').delete().in('id', idsLotesIncrementoInsertados);
                            }

                            // B. Revertir la cabecera del ajuste
                            await supabase.from('ajustes_inventario').delete().eq('id', ajusteId);
                            
                            throw new Error("El ajuste falló al mover el inventario físico. Se ha revertido por completo por seguridad. Intente de nuevo.");
                        }

                        CoreActions.showSuccessModal("Ajuste de inventario guardado correctamente.");
                        window.location.hash = '#/inventario/ajustes';

                    } catch (err) {
                        console.error("Error guardando ajuste:", err);
                        CoreActions.showErrorModal(err.message);
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = "Guardar Ajuste";
                    }
                });
            }

        } catch (e) {
            console.error("Error en form de ajustes:", e);
            element.innerHTML = `<div class="p-4 text-danger">Error: ${e.message}</div>`;
        }
    }
};
