import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions, ItemEngine } from '../../shared/crud.js';
import { InventarioUtils } from '../../shared/inventarioUtils.js';

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
                <div class="spinner-border" style="color: #2cbfb7;" role="status"></div>
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
                            <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Ajustes de Inventario</h2>
                            <p class="text-muted mb-0" style="font-size: 14px;">Registra incrementos o disminuciones por daños, pérdidas o descuadres.</p>
                        </div>
                        <button class="btn text-white" style="background-color: #2cbfb7; font-weight: 500;" onclick="window.location.hash='#/inventario/ajustes/nuevo'">
                            <i class="bi bi-plus-lg me-1"></i> Nuevo Ajuste
                        </button>
                    </div>

                    <div class="card border-0" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03); border-radius: 8px;">
                        <div class="table-responsive">
                            <table class="table table-borderless align-middle mb-0">
                                <thead style="border-bottom: 1px solid var(--border-color);">
                                    <tr style="color: var(--text-muted); font-size: 13px; font-weight: 500;">
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
                            <a href="#/inventario/ajustes/ver/${id}" class="d-block px-3 py-1 text-decoration-none text-body hover-bg-light" style="font-size: 13px;">Ver Detalle</a>
                        </div>
                    `;
                    document.body.insertAdjacentHTML('beforeend', menuHtml);
                    
                    const menu = document.querySelector('.row-action-menu');
                    
                    const closeMenu = (evt) => {
                        if (menu && !menu.contains(evt.target) && !e.currentTarget.contains(evt.target)) {
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
                <div class="spinner-border" style="color: #2cbfb7;" role="status"></div>
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
                        <span class="ms-auto badge bg-light text-dark border p-2" style="font-size: 14px;">No. ${ajuste.numero}</span>
                    </div>

                    <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03); border-radius: 8px;">
                        <div class="card-header bg-white border-bottom p-4">
                            <h6 class="mb-0 fw-bold" style="color: var(--text-main);">Detalles del ajuste</h6>
                        </div>
                        <div class="card-body p-4">
                            <div class="row g-4">
                                <div class="col-md-4">
                                    <label class="form-label text-muted" style="font-size: 13px; font-weight: 500;">Fecha *</label>
                                    <input type="date" class="form-control" id="ajuste-fecha" value="${ajuste.fecha}" ${isViewOnly ? 'disabled' : ''}>
                                </div>
                                <div class="col-md-8">
                                    <label class="form-label text-muted" style="font-size: 13px; font-weight: 500;">Observaciones</label>
                                    <textarea class="form-control" id="ajuste-observaciones" rows="1" placeholder="Ej. Inventario dañado por filtración de agua" ${isViewOnly ? 'disabled' : ''}>${ajuste.observaciones}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card border-0 mb-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03); border-radius: 8px;">
                        <div class="card-header bg-white border-bottom p-4 d-flex justify-content-between align-items-center">
                            <h6 class="mb-0 fw-bold" style="color: var(--text-main);">Ítems a ajustar</h6>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-borderless align-middle mb-0" id="ajustes-table">
                                    <thead class="bg-light" style="border-bottom: 1px solid var(--border-color);">
                                        <tr style="color: var(--text-muted); font-size: 13px; font-weight: 500;">
                                            <th class="ps-4 py-3" style="width: 35%;">Ítem</th>
                                            <th class="py-3 text-center" style="width: 15%;">Stock Actual</th>
                                            <th class="py-3" style="width: 20%;">Tipo Ajuste</th>
                                            <th class="py-3" style="width: 15%;">Cantidad</th>
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
                            <button type="button" class="btn btn-link text-decoration-none" id="btn-add-line" style="color: #2cbfb7; font-weight: 500;">
                                <i class="bi bi-plus-circle me-1"></i> Agregar línea
                            </button>
                        </div>
                        ` : ''}
                    </div>

                    ${!isViewOnly ? `
                    <div class="d-flex justify-content-end gap-2">
                        <button class="btn btn-light border px-4" onclick="window.history.back()">Cancelar</button>
                        <button class="btn text-white px-4" id="btn-guardar-ajuste" style="background-color: #2cbfb7; font-weight: 500;">
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
                        <span class="badge bg-secondary bg-opacity-10 text-secondary stock-actual-lbl" style="font-size: 13px;">--</span>
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
                            fetchItems: async (query) => {
                                const { data } = await supabase.from('productos')
                                    .select('*')
                                    .or(`nombre.ilike.%${query}%,sku.ilike.%${query}%`)
                                    .limit(20);
                                return data ? data.map(p => DB._mapToFrontend('productos', p)) : [];
                            },
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
                                    const { data } = await supabase.from('lotes_fifo').select('cantidad_actual').eq('producto_id', p.id);
                                    const sum = data ? data.reduce((acc, l) => acc + l.cantidad_actual, 0) : 0;
                                    stockLbl.textContent = sum;
                                } catch(e) {
                                    stockLbl.textContent = '?';
                                }

                                // 3. Sugerir costo automáticamente si el tipo es Incremento
                                if (tipoSelect.value === 'incremento') {
                                    const precioSugerido = p.precio_compra || p.precioCompra;
                                    if (precioSugerido && !costoInput.value) {
                                        costoInput.value = `$ ${Number(precioSugerido).toLocaleString('es-CO')}`;
                                    }
                                }
                            }
                        });
                    });

                    // Carga inicial de stock si el producto ya venía seleccionado
                    if (inputProdId.value && inputProdId.value !== '') {
                        stockLbl.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span>`;
                        supabase.from('lotes_fifo').select('cantidad_actual').eq('producto_id', inputProdId.value).then(({data}) => {
                            const sum = data ? data.reduce((acc, l) => acc + l.cantidad_actual, 0) : 0;
                            stockLbl.textContent = sum;
                        });
                    }

                    

                    tipoSelect.addEventListener('change', () => {
                        if (tipoSelect.value === 'incremento') {
                            costoInput.disabled = false;
                            costoInput.placeholder = "Costo Promedio";
                            // Try to suggest a cost
                            const pId = inputProdId.value;
                            if (pId) {
                                const prod = productos.find(p => String(p.id) === String(pId));
                                if (prod && (prod.precio_compra || prod.precioCompra)) {
                                    if (!costoInput.value) costoInput.value = prod.precio_compra || prod.precioCompra;
                                    // reformat
                                    let val = String(costoInput.value).replace(/[^0-9.-]+/g,"");
                                    if(val) costoInput.value = `$ ${Number(val).toLocaleString('es-CO')}`;
                                }
                            }
                        } else {
                            costoInput.disabled = true;
                            costoInput.value = '';
                            costoInput.placeholder = "Cálculo FIFO";
                        }
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

                        // DISMINUCIONES (Vía FIFO)
                        if (itemsDisminucion.length > 0) {
                            const result = await InventarioUtils.procesarSalidaInventario(itemsDisminucion);
                            if (!result.success) throw new Error("Error en Disminución: " + result.error);
                            
                            // Re-asignamos costos calculados por FIFO a nuestro historial
                            itemsDisminucion.forEach((item, idx) => {
                                const actualizado = result.detallesActualizados.find(d => String(d.productoId) === String(item.productoId) && d.cantidad === item.cantidad);
                                if (actualizado) {
                                    item.costo_unitario = (actualizado.costoTotalCalculado / item.cantidad) || 0;
                                }
                            });
                        }

                        // INCREMENTOS (Insert Directo)
                        if (itemsIncremento.length > 0) {
                            const lotesInsert = itemsIncremento.map(item => ({
                                producto_id: item.productoId,
                                cantidad_inicial: item.cantidad,
                                cantidad_actual: item.cantidad,
                                costo_unitario: item.costo_unitario,
                                fecha_ingreso: fecha,
                                referencia: `Ajuste de Inventario #${nextNumero}`
                            }));
                            const { error: insErr } = await supabase.from('lotes_fifo').insert(lotesInsert);
                            if (insErr) throw insErr;
                        }

                        // 3. Guardar Cabecera de Ajuste
                        const payload = {
                            numero: nextNumero,
                            fecha: fecha,
                            observaciones: obs,
                            detalles: itemsAjuste
                        };

                        const { error: hdrErr } = await supabase.from('ajustes_inventario').insert([payload]);
                        if (hdrErr) throw hdrErr;

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
