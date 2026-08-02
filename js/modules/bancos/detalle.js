// js/modules/bancos/detalle.js
import DB from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';
import { supabase } from '../../core/supabase.js';
import { agruparTransaccionesPorPago } from '../../shared/transaccionesUtils.js';
import { mostrarDetalleTransaccion } from '../../shared/transaccionModal.js';

export const DetalleBancoModule = {
    state: {
        bancoId: null, // Nombre de la cuenta o ID
        cuenta: null,
        transacciones: [],
        saldo: 0,
        totalIngresos: 0,
        totalEgresos: 0,
        filteredTransacciones: [],
        offset: 0,
        limit: 50,
        hasMore: true,
        isLoading: false
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        this.state.bancoId = urlParams.get('banco_id');

        this.state.offset = 0;
        this.state.hasMore = true;
        this.state.transacciones = [];
        
        await this.loadData();
        this.render();
    },

    async loadData(isLoadMore = false) {
        if (this.state.isLoading) return;
        this.state.isLoading = true;

        const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const bancoIdParam = urlParams.get('banco_id');
        let cuentaRealId = null;
        
        if (!isLoadMore) {
            const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
            this.state.cuenta = dbCuentas.find(c => String(c.id) === String(bancoIdParam));
            
            if (!this.state.cuenta) {
                console.error("No se encontró la cuenta con banco_id:", bancoIdParam, "en dbCuentas:", dbCuentas);
            }
        }

        if (this.state.cuenta && this.state.cuenta.id) {
            cuentaRealId = this.state.cuenta.id;
            
            // 1. Obtener transacciones paginadas
            const { data: pagos, error } = await supabase
                .from('pagos_ingresos')
                .select('*')
                .eq('cuenta_id', cuentaRealId)
                .neq('estado', 'anulado') // Excluir anulados de la vista
                .order('fecha', { ascending: false })
                .range(this.state.offset, this.state.offset + this.state.limit - 1);
            
            if (!error && pagos) {
                // ENRICHMENT: Fetch contacts and invoices
                const contactoIds = [...new Set(pagos.map(p => p.contacto_id).filter(Boolean))];
                const facturaIds = [...new Set(pagos.map(p => p.factura_id).filter(Boolean))];
                
                let contactosMap = {};
                if (contactoIds.length > 0) {
                    const { data: contactos } = await supabase.from('contactos').select('id, nombre, identificacion').in('id', contactoIds);
                    if (contactos) {
                        contactos.forEach(c => contactosMap[c.id] = c);
                    }
                }
                
                let facturasMap = {};
                if (facturaIds.length > 0) {
                    const { data: facturas } = await supabase.from('facturas').select('id, numero').in('id', facturaIds);
                    if (facturas) {
                        facturas.forEach(f => facturasMap[f.id] = f);
                    }
                }

                const mapped = pagos.map(item => {
                    const contacto = contactosMap[item.contacto_id];
                    let terceroNombre = contacto ? contacto.nombre : (item.referencia || 'Desconocido');
                    let terceroNit = contacto && contacto.identificacion ? contacto.identificacion : '';
                    
                    let cuentaContable = 'Otros movimientos';
                    if (item.factura_id && facturasMap[item.factura_id]) {
                        cuentaContable = `Facturas: ${facturasMap[item.factura_id].numero}`;
                    } else if (item.categoria) {
                        cuentaContable = item.categoria;
                    } else if (item.observaciones) {
                        cuentaContable = item.observaciones;
                    }
                    
                    return {
                        ...item,
                        tipo: item.tipo === 'in' ? 'ingreso' : 'egreso',
                        monto: Number(item.monto),
                        referenciaId: item.factura_id ? String(item.factura_id) : null,
                        cuentaId: String(item.cuenta_id),
                        detalle: item.observaciones || item.categoria || item.referencia || 'Sin detalle',
                        terceroNombre,
                        terceroNit,
                        cuentaContable
                    };
                });

                if (!isLoadMore) {
                    this.state.transacciones = mapped;
                } else {
                    this.state.transacciones = this.state.transacciones.concat(mapped);
                }

                this.state.offset += pagos.length;
                this.state.hasMore = pagos.length === this.state.limit;
            }

            // 2. Calcular Saldos (solo en la primera carga)
            if (!isLoadMore) {
                let movimientos = [];
                let desde = 0;
                while (true) {
                    const { data } = await supabase
                        .from('pagos_ingresos')
                        .select('tipo, monto')
                        .eq('cuenta_id', cuentaRealId)
                        .neq('estado', 'anulado') // Excluir anulados del cálculo de saldo
                        .range(desde, desde + 999);
                    
                    if (!data || data.length === 0) break;
                    movimientos = movimientos.concat(data);
                    if (data.length < 1000) break;
                    desde += 1000;
                }
                
    
                const saldoCalculado = movimientos.reduce((acc, t) => {
                    const esIngreso = t.tipo === 'in' || t.tipo === 'ingreso';
                    return acc + (esIngreso ? Number(t.monto) : -Number(t.monto));
                }, 0);
                
                const saldoInicial = parseFloat(this.state.cuenta.saldo_inicial) || 0;
                this.state.saldo = saldoInicial + saldoCalculado;
            }
        } else {
            // Caso fallback (cuenta no encontrada por ID)
            if (!isLoadMore) this.state.transacciones = [];
            this.state.hasMore = false;
        }

        this.state.isLoading = false;
    },

    render() {
        const c = this.state.cuenta;
        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        const headerHtml = CoreActions.renderDocumentHeader('bancos', 'Volver a Bancos');

        let searchQuery = '';
        let filterTipo = 'todos'; // todos, ingreso, egreso
        let transaccionesAgrupadas = [];

        const renderGrid = () => {
            // Filtrar localmente sobre lo que ya está cargado
            this.state.filteredTransacciones = this.state.transacciones.filter(t => {
                const desc = (t.detalle || t.referencia || t.categoria || '').toLowerCase();
                const matchesSearch = !searchQuery || desc.includes(searchQuery);
                const matchesTipo = filterTipo === 'todos' || t.tipo === filterTipo;
                return matchesSearch && matchesTipo;
            });

            transaccionesAgrupadas = agruparTransaccionesPorPago(this.state.filteredTransacciones);
            const currentItems = transaccionesAgrupadas;

            const tbodyHtml = currentItems.length > 0 ? currentItems.map(t => {
                const isIngreso = t.tipo === 'ingreso';
                const valorColor = isIngreso ? '#2cbfb7' : '#e74c3c';
                
                return `
                    <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);" data-id="${t.id}">
                        <td class="py-3">${t.fecha || '-'}</td>
                        <td class="py-3">
                            <div style="color: var(--text-main); font-weight: 500;">${t.terceroNombre || 'Sin tercero'}</div>
                            ${t.terceroNit ? `<div style="font-size: 11px; color: #888;">${t.terceroNit}</div>` : ''}
                        </td>
                        <td class="py-3" style="color: var(--text-main);">
                            ${t.cuentaContable}
                        </td>
                        <td class="py-3 text-end fw-medium" style="color: ${valorColor};">
                            ${formatMoney(t.monto)}
                        </td>
                        <td class="py-3 text-center">
                            <button class="btn btn-sm btn-link p-0 text-muted mx-1" onclick="import('../../shared/transaccionModal.js').then(m => m.mostrarDetalleTransaccion('${t.id}'))" title="Ver detalle" style="color: #6c757d !important; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">
                                <i class="bi bi-eye fs-6"></i>
                            </button>
                            <button class="btn btn-sm btn-link p-0 text-muted mx-1" onclick="alert('Funcionalidad en desarrollo')" title="Imprimir" style="color: #6c757d !important; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">
                                <i class="bi bi-printer fs-6"></i>
                            </button>
                            <button class="btn btn-sm btn-link p-0 text-muted mx-1" onclick="alert('Funcionalidad en desarrollo')" title="Más opciones" style="color: #6c757d !important; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">
                                <i class="bi bi-three-dots-vertical fs-6"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('') : `<tr><td colspan="5" class="text-center py-5 text-muted">No se encontraron movimientos o no coinciden con la búsqueda.</td></tr>`;

            this.element.innerHTML = `
                <div class="module-container p-4" style="max-width: 1100px; margin: 0 auto;">
                    
                    <!-- HEADER -->
                    <div class="d-flex justify-content-between align-items-start mb-4">
                        <div>
                            ${headerHtml}
                            <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">${c.nombre}</h2>
                            <p class="text-muted mb-0" style="font-size: 14px;">Tipo: ${c.tipo} &nbsp;|&nbsp; Número: ${c.numero}</p>
                        </div>
                    </div>

                    <!-- STATS CARDS -->
                    <div class="row g-4 mb-4">
                        <div class="col-md-4">
                            <div class="card border-0" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px; border-top: 4px solid #2cbfb7;">
                                <div class="card-body p-4">
                                    <p class="text-muted mb-1" style="font-size: 13px;">Saldo en Libros</p>
                                    <h3 class="fw-bold mb-0" style="color: #2cbfb7;">${formatMoney(this.state.saldo)}</h3>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- DATA TABLE CARD -->
                    <div class="card border-0" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                        
                        <!-- FILTERS -->
                        <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center" style="border-radius: 8px 8px 0 0;">
                            <div class="input-group input-group-sm" style="width: 250px;">
                                <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                                <input type="text" class="form-control border-start-0 ps-0 text-muted" id="detail-search" placeholder="Buscar por descripción..." value="${searchQuery}" style="font-size: 13px; box-shadow: none;">
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="text-muted" style="font-size: 13px;">Tipo:</span>
                                <select id="detail-filter-tipo" class="form-select form-select-sm text-muted" style="width: 130px; box-shadow: none;">
                                    <option value="todos" ${filterTipo === 'todos' ? 'selected' : ''}>Todos</option>
                                    <option value="ingreso" ${filterTipo === 'ingreso' ? 'selected' : ''}>Ingresos</option>
                                    <option value="egreso" ${filterTipo === 'egreso' ? 'selected' : ''}>Egresos</option>
                                </select>
                            </div>
                        </div>

                        <!-- GRID -->
                        <div class="table-responsive">
                            <table class="table table-borderless align-middle mb-0">
                                <thead style="border-bottom: 1px solid var(--border-color);">
                                    <tr style="color: var(--text-muted); font-size: 13px; font-weight: var(--weight-medium);">
                                        <th class="py-3 fw-normal" style="width: 100px;">Fecha</th>
                                        <th class="py-3 fw-normal">Tercero</th>
                                        <th class="py-3 fw-normal">Cuenta contable</th>
                                        <th class="py-3 fw-normal text-end" style="width: 130px;">Valor</th>
                                        <th class="py-3 fw-normal text-center" style="width: 120px;">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tbodyHtml}
                                </tbody>
                            </table>
                        </div>

                        <!-- FOOTER (CARGAR MÁS) -->
                        <div class="card-footer bg-white border-top p-3 text-center" style="border-radius: 0 0 8px 8px;">
                            ${this.state.hasMore ? 
                                `<button id="detail-btn-loadmore" class="btn btn-sm btn-outline-secondary px-4 py-2" ${this.state.isLoading ? 'disabled' : ''}>
                                    ${this.state.isLoading ? 'Cargando...' : 'Cargar más movimientos'}
                                </button>` 
                            : 
                                `<span class="text-muted" style="font-size: 13px;">No hay más movimientos.</span>`
                            }
                        </div>
                    </div>
                </div>
            `;

            bindEvents();
        };

        const bindEvents = () => {
            const searchInput = this.element.querySelector('#detail-search');
            if (searchInput) {
                searchInput.focus();
                const val = searchInput.value;
                searchInput.value = '';
                searchInput.value = val;

                searchInput.addEventListener('input', (e) => {
                    searchQuery = e.target.value.toLowerCase().trim();
                    renderGrid();
                });
            }

            this.element.querySelector('#detail-filter-tipo')?.addEventListener('change', (e) => {
                filterTipo = e.target.value;
                renderGrid();
            });

            this.element.querySelector('#detail-btn-loadmore')?.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cargando...';
                await this.loadData(true);
                renderGrid();
            });

            this.element.querySelectorAll('tbody tr[data-id]').forEach(row => {
                row.addEventListener('click', async () => {
                    const tId = row.dataset.id;
                    const t = transaccionesAgrupadas.find(x => String(x.id) === String(tId));
                    if (!t) return;
                    await mostrarDetalleTransaccion(t, () => {
                        this.loadData().then(() => this.render());
                    });
                });
            });
        };

        renderGrid();
    }
};
