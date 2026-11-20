// js/modules/inventario/ajustes.js
// Módulo de Ajustes de Inventario 360° (Orquestador Principal y Formulario Transaccional)

import { escapeHtml } from '../../shared/formatters.js';
import { AjustesData } from './ajustes.data.js';
import { AjustesTemplates } from './ajustes.templates.js';
import { AjustesEvents } from './ajustes.events.js';

function getLocalDate(d = new Date()) {
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const AjustesInventarioModule = {
    data: AjustesData,
    templates: AjustesTemplates,
    events: AjustesEvents,

    state: {
        todosAjustes: [],
        currentTab: 'todas',
        searchQuery: '',
        currentPage: 1,
        itemsPerPage: 15,
        kpis: {
            totalAjustes: 0,
            unidadesIncrementadas: 0,
            unidadesDisminuidas: 0,
            balanceNeto: 0,
            totalItems: 0,
            tabCounts: {
                todas: 0,
                incrementos: 0,
                disminuciones: 0,
                checkpoints: 0
            }
        },
        isDrawerOpen: false,
        isLoading: false
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        const hash = (typeof window !== 'undefined' && window.location?.hash) ? window.location.hash : '';
        const hashParts = hash.split('/');
        const action = hashParts[3];
        const id = hashParts[4];

        if (action === 'nuevo') {
            await this.renderForm(element);
        } else if (action === 'ver') {
            await this.renderForm(element, id, true);
        } else {
            await this.renderList(element);
        }

        return () => {
            this.events.cleanup();
        };
    },

    async renderList(element) {
        // Reset state
        this.state.currentPage = 1;
        this.state.searchQuery = '';
        this.state.currentTab = 'todas';
        this.state.isDrawerOpen = false;

        // Render Base Layout
        element.innerHTML = this.templates.renderLayout(this.state);

        // Bind Static Events
        this.events.bindEvents(this);

        // Load Data
        await this.cargarDatos();
    },

    async cargarDatos() {
        if (!this.element) return;
        this.state.isLoading = true;

        const overlay = this.element.querySelector('#grid-loading-overlay');
        if (overlay) overlay.style.display = 'flex';

        try {
            const ajustes = await this.data.cargarAjustes();
            this.state.todosAjustes = ajustes || [];

            // Calcular KPIs ejecutivos
            this.state.kpis = this.data.calcularKpis(this.state.todosAjustes);

            // Actualizar tarjetas de KPI en DOM
            this.actualizarKpisEnDOM();

            // Actualizar tabla y paginador
            this.actualizarGrilla();
        } catch (err) {
            console.error('[AjustesInventarioModule] Error cargando ajustes:', err);
            const wrapper = this.element.querySelector('#ajustes-table-wrapper');
            if (wrapper) {
                wrapper.innerHTML = `
                    <div class="card border-0 shadow-xs p-4 text-center text-danger" style="border-radius: 10px; background: #fff;">
                        <i class="bi bi-exclamation-triangle fs-3 mb-2"></i>
                        <h6 class="fw-bold mb-1">Error al cargar ajustes de inventario</h6>
                        <p class="text-muted mb-3" style="font-size: 13px;">${escapeHtml(err.message || 'Error de conexión con la base de datos.')}</p>
                        <button class="btn btn-sm btn-light border mx-auto px-3" onclick="window.location.reload()">
                            Reintentar
                        </button>
                    </div>
                `;
            }
        } finally {
            this.state.isLoading = false;
            if (overlay) overlay.style.display = 'none';
        }
    },

    actualizarKpisEnDOM() {
        if (!this.element) return;
        const kpis = this.state.kpis || {};
        const elTotal = this.element.querySelector('#kpi-total-ajustes');
        const elInc = this.element.querySelector('#kpi-unidades-incrementadas');
        const elDis = this.element.querySelector('#kpi-unidades-disminuidas');
        const elBal = this.element.querySelector('#kpi-balance-neto');

        if (elTotal) elTotal.textContent = this.templates.formatNumero(kpis.totalAjustes);
        if (elInc) elInc.textContent = `+${this.templates.formatNumero(kpis.unidadesIncrementadas)}`;
        if (elDis) elDis.textContent = `-${this.templates.formatNumero(kpis.unidadesDisminuidas)}`;
        if (elBal) {
            elBal.textContent = `${kpis.balanceNeto > 0 ? '+' : ''}${this.templates.formatNumero(kpis.balanceNeto)}`;
            elBal.className = `payment-kpi-value fw-bold ${kpis.balanceNeto >= 0 ? 'text-primary' : 'text-danger'} tnum`;
        }

        // Actualizar contadores de tabs
        const counts = kpis.tabCounts || {};
        const updateBadge = (id, val) => {
            const btn = this.element.querySelector(id);
            const badge = btn?.querySelector('.badge');
            if (badge) badge.textContent = val || 0;
        };

        updateBadge('#tab-todas', counts.todas);
        updateBadge('#tab-incrementos', counts.incrementos);
        updateBadge('#tab-disminuciones', counts.disminuciones);
        updateBadge('#tab-checkpoints', counts.checkpoints);
    },

    actualizarGrilla() {
        if (!this.element) return;

        // 1. Filtrar ajustes según pestaña y buscador
        const filtrados = this.data.filtrarAjustes(this.state.todosAjustes, {
            tab: this.state.currentTab,
            query: this.state.searchQuery
        });

        // 2. Paginar lista resultante
        const paginado = this.data.paginar(filtrados, this.state.currentPage, this.state.itemsPerPage);
        this.state.currentPage = paginado.currentPage;

        // 3. Renderizar tabla
        const tableWrapper = this.element.querySelector('#ajustes-table-wrapper');
        if (tableWrapper) {
            tableWrapper.innerHTML = this.templates.renderGrid(paginado.items, this.state);
        }

        // 4. Renderizar paginador
        const paginationContainer = this.element.querySelector('#ajustes-pagination-container');
        if (paginationContainer) {
            paginationContainer.innerHTML = this.templates.renderPagination(paginado.totalItems, paginado.currentPage, paginado.pageSize);
        }

        // 5. Vincular eventos dinámicos de filas y paginación
        this.events.bindGridEvents(this);
    },

    // =========================================================================
    // FORMULARIO TRANSACCIONAL (NUEVO / VER AJUSTE) - PRESERVADO Y ROBUSTO
    // =========================================================================
    async renderForm(element, id = null, isViewOnly = false) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" style="color: var(--primary);" role="status"></div>
            </div>
        `;

        try {
            const [supabase, DB, { CoreActions }, { ItemEngine }] = await Promise.all([
                this.data.getSupabase(),
                this.data.getDB(),
                import('../../shared/crud.js'),
                import('../../shared/itemEngine.js')
            ]);

            let ajuste = { fecha: getLocalDate(), observaciones: '', detalles: [] };

            if (id) {
                const { data, error } = await supabase.from('ajustes_inventario').select('*').eq('id', id).single();
                if (error) throw error;
                ajuste = data;
                if (typeof ajuste.detalles === 'string') {
                    try {
                        ajuste.detalles = JSON.parse(ajuste.detalles);
                    } catch (e) {
                        ajuste.detalles = [];
                    }
                }
            } else {
                const { data: numData } = await supabase.rpc('get_next_sequence_value', { seq_name: 'ajustes_inventario_seq' });
                ajuste.numero = numData || 'Auto';
            }

            const productos = await DB.getAll('productos');
            const detallesRender = (ajuste.detalles && ajuste.detalles.length > 0) ? ajuste.detalles : [{}];

            element.innerHTML = `
                <div class="dash-layout p-4" style="max-width: 1100px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
                    <div class="d-flex align-items-center mb-4 gap-3">
                        <button class="btn btn-light bg-white border text-secondary rounded-circle" style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;" onclick="window.location.hash='#/inventario/ajustes'" title="Volver a lista">
                            <i class="bi bi-arrow-left fs-5"></i>
                        </button>
                        <div>
                            <h2 class="h3 fw-bold mb-0" style="color: var(--text-main); letter-spacing: -0.5px;">${id ? (isViewOnly ? 'Ver Ajuste de Inventario' : 'Editar Ajuste de Inventario') : 'Nuevo Ajuste de Inventario'}</h2>
                            <p class="text-muted mb-0" style="font-size: 13px;">Registra incrementos por sobrantes o mermas con afectación de lotes FIFO.</p>
                        </div>
                        <span class="ms-auto badge bg-light text-dark border px-3 py-2 fw-semibold" style="font-size: 13px;">No. ${escapeHtml(ajuste.numero)}</span>
                    </div>

                    <div class="card border-0 mb-4 shadow-xs" style="border-radius: 10px; background: #fff;">
                        <div class="card-header bg-white border-bottom p-4">
                            <h6 class="mb-0 fw-bold" style="color: var(--text-main);">Detalles del comprobante</h6>
                        </div>
                        <div class="card-body p-4">
                            <div class="row g-4">
                                <div class="col-md-4">
                                    <label class="form-label text-muted" style="font-size: 13px; font-weight: 500;">Fecha *</label>
                                    <input type="date" class="form-control" id="ajuste-fecha" value="${escapeHtml(ajuste.fecha)}" ${isViewOnly ? 'disabled' : ''}>
                                </div>
                                <div class="col-md-8">
                                    <label class="form-label text-muted" style="font-size: 13px; font-weight: 500;">Observaciones</label>
                                    <textarea class="form-control" id="ajuste-observaciones" rows="1" placeholder="Ej. Inventario dañado por filtración, garantía de cliente, sobrante físico..." ${isViewOnly ? 'disabled' : ''}>${escapeHtml(ajuste.observaciones)}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card border-0 mb-4 shadow-xs" style="border-radius: 10px; background: #fff;">
                        <div class="card-header bg-white border-bottom p-4 d-flex justify-content-between align-items-center">
                            <h6 class="mb-0 fw-bold" style="color: var(--text-main);">Ítems a ajustar</h6>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive" style="overflow: visible;">
                                <table class="table table-borderless align-middle mb-0" id="ajustes-table">
                                    <thead class="bg-light" style="border-bottom: 1px solid var(--border-color, #e2e8f0);">
                                        <tr style="color: var(--text-muted); font-size: 12px; font-weight: 600;" class="text-uppercase">
                                            <th class="ps-4 py-3" style="width: 32%;">Ítem / Referencia</th>
                                            <th class="py-3 text-center" style="width: 12%;">Stock Actual</th>
                                            <th class="py-3 text-center" style="width: 12%;">Saldo Resultante</th>
                                            <th class="py-3" style="width: 18%;">Tipo Ajuste</th>
                                            <th class="py-3" style="width: 10%;">Cantidad</th>
                                            <th class="py-3" style="width: 16%;">Costo Uni.</th>
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
                            <button type="button" class="btn btn-link text-decoration-none" id="btn-add-line" style="color: var(--primary, #2563eb); font-weight: 500;">
                                <i class="bi bi-plus-circle me-1"></i> Agregar línea
                            </button>
                        </div>
                        ` : ''}
                    </div>

                    ${!isViewOnly ? `
                    <div class="d-flex justify-content-end gap-2">
                        <button class="btn btn-light border px-4" onclick="window.history.back()" style="border-radius: 8px;">Cancelar</button>
                        <button class="btn btn-primary-action px-4 text-white" id="btn-guardar-ajuste" style="border-radius: 8px; font-weight: 600;">
                            Guardar Ajuste
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;

            const tbody = element.querySelector('#ajustes-body');

            const renderLine = (detalle = {}) => {
                const tr = document.createElement('tr');
                tr.className = 'item-row';

                const isIncremento = detalle.tipo === 'incremento';
                const isDisminucion = detalle.tipo === 'disminucion';

                tr.innerHTML = `
                    <td class="ps-4 py-3">
                        ${ItemEngine.renderProductSearchBox(detalle, productos, isViewOnly)}
                    </td>
                    <td class="py-3 text-center">
                        <span class="badge bg-secondary bg-opacity-10 text-secondary stock-actual-lbl" style="font-size: 12px;">--</span>
                    </td>
                    <td class="py-3 text-center">
                        <span class="badge bg-info bg-opacity-10 text-info saldo-resultante-lbl" style="font-size: 12px;">--</span>
                    </td>
                    <td class="py-3">
                        <select class="form-select form-select-sm select-tipo-ajuste text-muted bg-light border-0" ${isViewOnly ? 'disabled' : ''}>
                            <option value="">Seleccione...</option>
                            <option value="incremento" ${isIncremento ? 'selected' : ''}>Incremento (+)</option>
                            <option value="disminucion" ${isDisminucion ? 'selected' : ''}>Disminución (-)</option>
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
                    const descInput = tr.querySelector('.input-prod-desc');
                    if (descInput) descInput.style.display = 'none';

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
                                return `<strong style="color: var(--text-main);">[${escapeHtml(p.sku || p.reference || 'S/N')}]</strong> - ${escapeHtml(p.nombre || p.name)}`;
                            },
                            allowCreate: false,
                            onSelect: async (p) => {
                                searchInput.value = `[${p.sku || p.reference || 'S/N'}] - ${p.nombre || p.name}`;

                                stockLbl.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span>`;
                                try {
                                    const { data } = await supabase.from('lotes_fifo').select('cantidad_actual, costo_unitario').eq('producto_id', p.id);
                                    let stockTotal = 0;
                                    let costoLotes = 0;
                                    let stockPositivo = 0;
                                    if (data) {
                                        data.forEach(l => {
                                            stockTotal += (l.cantidad_actual || 0);
                                            if (l.cantidad_actual > 0) {
                                                stockPositivo += l.cantidad_actual;
                                                costoLotes += (l.cantidad_actual * Number(l.costo_unitario || 0));
                                            }
                                        });
                                    }
                                    stockLbl.textContent = stockTotal;
                                    const costoPromedio = stockPositivo > 0 ? (costoLotes / stockPositivo) : (p.costo_base || p.costoBase || p.precio_compra || p.precioCompra || 0);
                                    tr.dataset.costoPromedio = costoPromedio;
                                } catch (e) {
                                    stockLbl.textContent = '?';
                                }

                                if (tipoSelect.value === 'incremento') {
                                    const precioSugerido = tr.dataset.costoPromedio;
                                    if (precioSugerido && !costoInput.value) {
                                        costoInput.value = `$ ${Number(precioSugerido).toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;
                                    }
                                }

                                const inpCantidad = tr.querySelector('.input-cantidad');
                                if (inpCantidad) inpCantidad.dispatchEvent(new Event('input'));
                            }
                        });
                    });

                    if (inputProdId.value && inputProdId.value !== '') {
                        stockLbl.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span>`;
                        supabase.from('lotes_fifo').select('cantidad_actual, costo_unitario').eq('producto_id', inputProdId.value).then(({ data }) => {
                            let stockTotal = 0;
                            let costoLotes = 0;
                            let stockPositivo = 0;
                            if (data) {
                                data.forEach(l => {
                                    stockTotal += (l.cantidad_actual || 0);
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
                            if (!costoInput.value && tr.dataset.costoPromedio) {
                                costoInput.value = `$ ${Number(tr.dataset.costoPromedio).toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;
                            }
                        } else {
                            costoInput.disabled = true;
                            costoInput.value = '';
                            costoInput.placeholder = "Cálculo FIFO";
                        }
                        calcSaldo();
                    });

                    costoInput.addEventListener('blur', (e) => {
                        let val = e.target.value.replace(/[^0-9.-]+/g, "");
                        if (val) e.target.value = `$ ${Number(val).toLocaleString('es-CO')}`;
                    });
                    costoInput.addEventListener('focus', (e) => {
                        let val = e.target.value.replace(/[^0-9.-]+/g, "");
                        e.target.value = val;
                    });

                    tr.querySelector('.btn-remove-line').addEventListener('click', () => {
                        tr.remove();
                    });
                } else {
                    tr.querySelector('.stock-actual-lbl').textContent = 'N/A';
                    const costoInput = tr.querySelector('.input-costo');
                    if (costoInput && costoInput.value) {
                        let val = String(costoInput.value).replace(/[^0-9.-]+/g, "");
                        if (val) costoInput.value = `$ ${Number(val).toLocaleString('es-CO')}`;
                    }
                }
            };

            if (isViewOnly && detallesRender.length > 100) {
                // Renderizado asíncrono por lotes para prevenir congelamiento de UI en checkpoints gigantescos
                const BATCH_SIZE = 50;
                let currentIndex = 0;
                const renderNextBatch = () => {
                    const chunk = detallesRender.slice(currentIndex, currentIndex + BATCH_SIZE);
                    chunk.forEach(d => renderLine(d));
                    currentIndex += BATCH_SIZE;
                    if (currentIndex < detallesRender.length) {
                        setTimeout(renderNextBatch, 0);
                    }
                };
                renderNextBatch();
            } else {
                detallesRender.forEach(d => renderLine(d));
            }

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
                        const costoRaw = r.querySelector('.input-costo').value.replace(/[^0-9.-]+/g, "");
                        const costo = parseFloat(costoRaw);
                        if (!pid) return;

                        if (!tipo) {
                            CoreActions.showWarningModal(`Selecciona el tipo de ajuste para ${pName}`);
                            hasErrors = true;
                            return;
                        }
                        if (isNaN(qty) || qty <= 0) {
                            CoreActions.showWarningModal(`Cantidad inválida en ${pName}`);
                            hasErrors = true;
                            return;
                        }

                        if (tipo === 'incremento' && (isNaN(costo) || costo < 0)) {
                            CoreActions.showWarningModal(`Ingresa el costo unitario para el incremento de ${pName}`);
                            hasErrors = true;
                            return;
                        }
                        const stockActualTxt = r.querySelector('.stock-actual-lbl').textContent;
                        const stockActual = parseFloat(stockActualTxt) || 0;
                        let stockResultante = stockActual;
                        if (tipo === 'incremento') stockResultante += qty;
                        else if (tipo === 'disminucion') stockResultante -= qty;

                        itemsAjuste.push({
                            productoId: parseInt(pid, 10),
                            producto_id: parseInt(pid, 10),
                            nombre: String(pName || '').trim(),
                            tipo: tipo,
                            cantidad: qty,
                            costo_unitario: tipo === 'incremento' ? costo : null,
                            a: stockResultante
                        });
                    });

                    if (hasErrors) return;
                    if (itemsAjuste.length === 0) return CoreActions.showWarningModal("Agrega al menos un ítem al ajuste");

                    btnGuardar.disabled = true;
                    btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...`;

                    try {
                        let nextNumero = parseInt(ajuste.numero, 10);
                        if (isNaN(nextNumero) || ajuste.numero === 'Auto') {
                            const { data: numData } = await supabase.rpc('get_next_sequence_value', { seq_name: 'ajustes_inventario_seq' });
                            nextNumero = parseInt(numData, 10) || Date.now();
                        }

                        const itemsIncremento = itemsAjuste
                            .filter(i => i.tipo === 'incremento')
                            .map(i => ({ producto_id: parseInt(i.producto_id, 10), cantidad: i.cantidad, costo_unitario: i.costo_unitario }));
                        const itemsDisminucion = itemsAjuste
                            .filter(i => i.tipo === 'disminucion')
                            .map(i => ({ producto_id: parseInt(i.producto_id, 10), cantidad: i.cantidad }));

                        const { error: rpcErr } = await supabase.rpc('guardar_ajuste_inventario', {
                            p_numero: parseInt(nextNumero, 10) || Date.now(),
                            p_fecha: String(fecha).trim(),
                            p_observaciones: String(obs || '').trim(),
                            p_detalles: itemsAjuste,
                            p_items_incremento: itemsIncremento,
                            p_items_disminucion: itemsDisminucion
                        });

                        if (rpcErr) throw new Error("Fallo al guardar el ajuste de inventario: " + rpcErr.message);

                        CoreActions.showSuccessModal("Ajuste de inventario guardado correctamente.");
                        window.location.hash = '#/inventario/ajustes';
                    } catch (err) {
                        console.error("[AjustesInventarioModule] Error guardando ajuste:", err);
                        CoreActions.showErrorModal(err.message);
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = "Guardar Ajuste";
                    }
                });
            }

        } catch (e) {
            console.error("[AjustesInventarioModule] Error en formulario de ajustes:", e);
            element.innerHTML = `<div class="p-4 text-danger">Error: ${escapeHtml(e.message)}</div>`;
        }
    }
};
