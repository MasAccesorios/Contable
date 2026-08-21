const fs = require('fs');
const path = 'js/modules/bancos/detalle.js';
const newContent = `// js/modules/bancos/detalle.js
import DB from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';
import { supabase } from '../../core/supabase.js';
import { agruparTransaccionesPorPago, anularTransaccion } from '../../shared/transaccionesUtils.js';
import { mostrarDetalleTransaccion } from '../../shared/transaccionModal.js';

export const DetalleBancoModule = {
    state: {
        bancoId: null, // Nombre de la cuenta o ID
        cuenta: null,
        transacciones: [],
        saldo: 0,
        totalIngresos: 0,
        totalEgresos: 0,
        offset: 0,
        limit: 50,
        hasMore: true,
        isLoading: false,
        searchQuery: '',
        filterTipo: 'todos'
    },
    
    staticRendered: false,
    element: null,

    async init(element) {
        if (!element) return;
        this.element = element;
        this.staticRendered = false;

        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        this.state.bancoId = urlParams.get('banco_id');

        this.state.offset = 0;
        this.state.hasMore = true;
        this.state.transacciones = [];
        this.state.searchQuery = '';
        this.state.filterTipo = 'todos';
        
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
            cuentaRealId = parseInt(this.state.cuenta.id);
            
            // 1. Obtener transacciones mediante RPC
            const { data: pagos, error } = await supabase.rpc('get_movimientos_banco', {
                p_cuenta_id: cuentaRealId,
                p_offset: this.state.offset,
                p_limit: this.state.limit,
                p_search: this.state.searchQuery,
                p_tipo: this.state.filterTipo
            });
            
            if (!error && pagos) {
                const mapped = pagos.map(item => {
                    let terceroNombre = item.tercero_nombre;
                    if (!terceroNombre) {
                        terceroNombre = item.referencia || 'Desconocido';
                    }

                    let cuentaContable = 'Otros movimientos';
                    if (item.factura_numero) {
                        const fNum = item.factura_numero;
                        const fId  = item.factura_id;
                        cuentaContable = \`<a href="#/ingresos/facturas/ver/\${fId}" class="text-decoration-none text-primary" onclick="event.stopPropagation()">Factura #\${fNum}</a>\`;
                    } else if (item.categoria) {
                        cuentaContable = item.categoria;
                    } else if (item.observaciones) {
                        const obs = String(item.observaciones).trim();
                        // Si la observación es EXCLUSIVAMENTE la basura de migración, la ignoramos
                        if (!/^\\(\\s*Alegra ID:\\s*\\d+\\s*\\)$/i.test(obs)) {
                            cuentaContable = obs;
                        }
                    }
                    
                    return {
                        ...item,
                        tipo: item.tipo === 'in' ? 'ingreso' : 'egreso',
                        monto: Number(item.monto),
                        referenciaId: item.factura_id ? String(item.factura_id) : null,
                        cuentaId: String(item.cuenta_id),
                        detalle: item.observaciones || item.categoria || item.referencia || 'Sin detalle',
                        terceroNombre,
                        terceroNit: item.tercero_nit || '',
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
            } else if (error) {
                console.error("Error cargando pagos_ingresos", error);
            }

            // 2. Calcular Saldos (solo en la primera carga)
            if (!isLoadMore) {
                const { data: saldos, error: errorSaldos } = await supabase.rpc('get_saldos_por_cuenta');
                let saldoCalculado = 0;
                
                if (!errorSaldos && saldos) {
                    const saldoCuenta = saldos.find(s => String(s.cuenta_id) === String(cuentaRealId));
                    if (saldoCuenta) {
                        saldoCalculado = Number(saldoCuenta.saldo);
                    }
                }
                
                this.state.saldo = saldoCalculado;
            }
        } else {
            if (!isLoadMore) this.state.transacciones = [];
            this.state.hasMore = false;
        }

        this.state.isLoading = false;
    },

    render() {
        const c = this.state.cuenta;
        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        const headerHtml = CoreActions.renderDocumentHeader('bancos', 'Volver a Bancos');

        if (!this.staticRendered) {
            this.element.innerHTML = \`
                <div class="module-container p-4" style="max-width: 1100px; margin: 0 auto;">
                    
                    <!-- HEADER -->
                    <div class="d-flex justify-content-between align-items-start mb-4">
                        <div>
                            \${headerHtml}
                            <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">\${c ? c.nombre : 'Cargando...'}</h2>
                            \${c ? \`<p class="text-muted mb-0" style="font-size: 14px;">Tipo: \${c.tipo} &nbsp;|&nbsp; Número: \${c.numero}</p>\` : ''}
                        </div>
                    </div>

                    <!-- STATS CARDS -->
                    <div class="row g-4 mb-4">
                        <div class="col-md-4">
                            <div class="card border-0" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px; border-top: 4px solid #2cbfb7;">
                                <div class="card-body p-4">
                                    <p class="text-muted mb-1" style="font-size: 13px;">Saldo en Libros</p>
                                    <h3 class="fw-bold mb-0" id="detail-saldo-card" style="color: #2cbfb7;">\${formatMoney(this.state.saldo)}</h3>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- DATA TABLE CARD -->
                    <div class="card border-0" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px;">
                        
                        <!-- FILTERS -->
                        <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center" style="border-radius: 8px 8px 0 0;">
                            <div class="input-group input-group-sm" style="width: 250px; position: relative;">
                                <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                                <input type="text" class="form-control border-start-0 ps-0 text-muted" id="detail-search" placeholder="Buscar movimientos..." autocomplete="off" style="font-size: 13px; box-shadow: none;">
                                <button class="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted d-none" id="detail-search-clear" style="z-index: 10; text-decoration: none;"><i class="bi bi-x-circle-fill"></i></button>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="text-muted" style="font-size: 13px;">Tipo:</span>
                                <select id="detail-filter-tipo" class="form-select form-select-sm text-muted" style="width: 130px; box-shadow: none;">
                                    <option value="todos">Todos</option>
                                    <option value="ingreso">Ingresos</option>
                                    <option value="egreso">Egresos</option>
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
                                <tbody id="detail-grid-body">
                                </tbody>
                            </table>
                        </div>

                        <!-- FOOTER (CARGAR MÁS) -->
                        <div class="card-footer bg-white border-top p-3 text-center" style="border-radius: 0 0 8px 8px;" id="detail-grid-footer">
                        </div>
                    </div>
                </div>
            \`;
            this.staticRendered = true;
            this.bindStaticEvents();
        } else {
            // Update saldo on re-render just in case
            const saldoEl = this.element.querySelector('#detail-saldo-card');
            if (saldoEl) saldoEl.textContent = formatMoney(this.state.saldo);
        }

        this.renderGrid();
    },

    bindStaticEvents() {
        const searchInput = this.element.querySelector('#detail-search');
        const clearBtn = this.element.querySelector('#detail-search-clear');
        const filterTipo = this.element.querySelector('#detail-filter-tipo');
        let debounceTimer;

        if (searchInput && clearBtn) {
            searchInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (val.trim().length > 0) {
                    clearBtn.classList.remove('d-none');
                } else {
                    clearBtn.classList.add('d-none');
                }

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                    this.state.searchQuery = val.trim();
                    this.state.offset = 0;
                    await this.loadData(false);
                    this.renderGrid();
                }, 400);
            });

            clearBtn.addEventListener('click', async () => {
                searchInput.value = '';
                clearBtn.classList.add('d-none');
                this.state.searchQuery = '';
                this.state.offset = 0;
                searchInput.focus();
                await this.loadData(false);
                this.renderGrid();
            });
        }

        if (filterTipo) {
            filterTipo.addEventListener('change', async (e) => {
                this.state.filterTipo = e.target.value;
                this.state.offset = 0;
                await this.loadData(false);
                this.renderGrid();
            });
        }

        const footer = this.element.querySelector('#detail-grid-footer');
        if (footer) {
            footer.addEventListener('click', async (e) => {
                const btn = e.target.closest('#detail-btn-loadmore');
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cargando...';
                    await this.loadData(true);
                    this.renderGrid();
                }
            });
        }
    },

    renderGrid() {
        const tbody = this.element.querySelector('#detail-grid-body');
        const footer = this.element.querySelector('#detail-grid-footer');
        if (!tbody || !footer) return;
        
        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        const currentItems = agruparTransaccionesPorPago(this.state.transacciones);

        tbody.innerHTML = currentItems.length > 0 ? currentItems.map(t => {
            const isIngreso = t.tipo === 'ingreso';
            const valorColor = isIngreso ? '#2cbfb7' : '#e74c3c';
            
            return \`
                <tr class="movimiento-row" style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body); cursor: pointer; transition: background-color 0.2s;" data-id="\${t.id}" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'">
                    <td class="py-3">
                        \${t.fecha || '-'}
                        <div class="text-muted mt-1" style="font-size: 10px;">Nº trans: \${t.grupo_pago_id || t.id}</div>
                    </td>
                    <td class="py-3">
                        <div style="color: var(--text-main); font-weight: 500;">\${t.terceroNombre || 'Sin tercero'}</div>
                        \${t.terceroNit ? \`<div style="font-size: 11px; color: #888;">\${t.terceroNit}</div>\` : ''}
                    </td>
                    <td class="py-3" style="color: var(--text-main);">
                        \${t.cuentaContable}
                    </td>
                    <td class="py-3 text-end fw-medium" style="color: \${valorColor};">
                        \${formatMoney(t.monto)}
                    </td>
                    <td class="py-3 text-center">

                        <div class="dropdown d-inline-block">
                            <button class="btn btn-sm btn-link p-0 text-muted mx-1" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Más opciones" style="color: #6c757d !important; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">
                                <i class="bi bi-three-dots-vertical fs-6"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end shadow border-0" style="font-size: 13px;">
                                <li><a class="dropdown-item btn-editar-transaccion" href="javascript:void(0)" data-id="\${t.id}">Editar</a></li>
                                <li><a class="dropdown-item text-danger btn-eliminar-banco" href="javascript:void(0)" data-id="\${t.id}" data-grupo="\${t.grupo_pago_id || ''}" data-monto="\${t.monto}" data-fecha="\${t.fecha}">Eliminar</a></li>
                            </ul>
                        </div>
                    </td>
                </tr>
            \`;
        }).join('') : \`<tr><td colspan="5" class="text-center py-5 text-muted">No se encontraron movimientos o no coinciden con la búsqueda.</td></tr>\`;

        footer.innerHTML = this.state.hasMore ? 
            \`<button id="detail-btn-loadmore" class="btn btn-sm btn-outline-secondary px-4 py-2" \${this.state.isLoading ? 'disabled' : ''}>
                \${this.state.isLoading ? 'Cargando...' : 'Cargar más movimientos'}
            </button>\` 
        : 
            \`<span class="text-muted" style="font-size: 13px;">No hay más movimientos.</span>\`;

        this.bindDynamicEvents();
    },

    bindDynamicEvents() {
        this.element.querySelectorAll('.btn-eliminar-banco').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                const grupo = e.currentTarget.dataset.grupo;
                const monto = e.currentTarget.dataset.monto;
                const fecha = e.currentTarget.dataset.fecha;
                const montoFormat = '$ ' + parseFloat(monto || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                
                if (confirm(\`¿Está seguro que desea eliminar este movimiento por valor de \${montoFormat} del \${fecha}? Esta acción revertirá el saldo de la cuenta.\`)) {
                    try {
                        const { anularTransaccion } = await import('../../shared/transaccionesUtils.js');
                        if (grupo) {
                            await anularTransaccion(grupo, true);
                        } else {
                            await anularTransaccion(id, false);
                        }
                        this.state.offset = 0; // Reset pagination
                        await this.loadData(false);
                        this.renderGrid();
                    } catch (err) {
                        alert("Error al anular el movimiento: " + err.message);
                    }
                }
            });
        });

        const openModal = async (tId, autoEdit = false) => {
            // Because we grouped, we might need to find inside the grouped array or original array.
            // But we already grouped in renderGrid, so we can just use agruparTransaccionesPorPago directly or search the grouped one.
            const currentItems = agruparTransaccionesPorPago(this.state.transacciones);
            const t = currentItems.find(x => String(x.id) === String(tId));
            if (!t) return;
            const modalModule = await import('../../shared/transaccionModal.js');
            await modalModule.mostrarDetalleTransaccion(t, () => {
                this.state.offset = 0;
                this.loadData(false).then(() => {
                    // Force static component update if saldo changed
                    const saldoEl = this.element.querySelector('#detail-saldo-card');
                    if (saldoEl) saldoEl.textContent = '$ ' + parseFloat(this.state.saldo || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    this.renderGrid();
                });
            });
            
            if (autoEdit) {
                setTimeout(() => {
                    const btnEdit = document.getElementById('btn-activar-edicion');
                    if (btnEdit) btnEdit.click();
                }, 200);
            }
        };

        this.element.querySelectorAll('.btn-ver-transaccion').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openModal(e.currentTarget.dataset.id, false);
            });
        });

        this.element.querySelectorAll('.btn-editar-transaccion').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openModal(e.currentTarget.dataset.id, true);
            });
        });

        this.element.querySelectorAll('tbody tr[data-id]').forEach(row => {
            row.addEventListener('click', async (e) => {
                if (e.target.closest('button') || e.target.closest('.dropdown-menu') || e.target.closest('a')) return;
                const tId = row.dataset.id;
                openModal(tId, false);
            });
        });
    }
};
`;
fs.writeFileSync(path, newContent, 'utf8');
console.log("Success patch complete detalle");
