// js/modules/bancos/detalle.js
import DB from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';

export const DetalleBancoModule = {
    state: {
        bancoId: null, // Nombre de la cuenta
        cuenta: null,
        transacciones: [],
        saldo: 0,
        totalIngresos: 0,
        totalEgresos: 0,
        filteredTransacciones: []
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        this.state.bancoId = urlParams.get('banco_id');

        await this.loadData();
        this.render();
    },

    async loadData() {
        const dbCuentas = await DB.getAll('cuentas_bancarias') || [];
        this.state.cuenta = dbCuentas.find(c => c.nombre === this.state.bancoId || c.id === this.state.bancoId);
        
        // Si no se encuentra en DB, construimos una cuenta temporal para efectos de visualización
        if (!this.state.cuenta) {
            this.state.cuenta = {
                nombre: this.state.bancoId,
                tipo: 'Banco',
                numero: '-',
                estado: 'activo'
            };
        }

        const todasTrx = await DB.getAll('transacciones') || [];
        
        // Filtrar transacciones para esta cuenta
        this.state.transacciones = todasTrx.filter(t => {
            const trxCuenta = t.cuentaId || t.cuenta || 'AAACaja general';
            return trxCuenta === this.state.bancoId;
        });

        // Ordenar por fecha descendente por defecto (más reciente primero)
        this.state.transacciones.sort((a, b) => {
            const dateA = a.fecha || '';
            const dateB = b.fecha || '';
            return dateB.localeCompare(dateA);
        });

        // Calcular totales
        this.state.saldo = 0;
        this.state.totalIngresos = 0;
        this.state.totalEgresos = 0;

        this.state.transacciones.forEach(t => {
            if (t.tipo === 'ingreso') {
                this.state.saldo += t.monto;
                this.state.totalIngresos += t.monto;
            } else if (t.tipo === 'egreso' || t.tipo === 'gasto') {
                this.state.saldo -= t.monto;
                this.state.totalEgresos += t.monto;
            }
        });
    },

    render() {
        const c = this.state.cuenta;
        const formatMoney = val => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        const headerHtml = CoreActions.renderDocumentHeader('bancos', 'Volver a Bancos');

        // Estado local de paginación y filtro
        let currentPage = 1;
        let itemsPerPage = 10;
        let searchQuery = '';
        let filterTipo = 'todos'; // todos, ingreso, egreso

        const renderGrid = () => {
            // Filtrar
            this.state.filteredTransacciones = this.state.transacciones.filter(t => {
                const desc = (t.detalle || t.referencia || t.categoria || '').toLowerCase();
                const matchesSearch = !searchQuery || desc.includes(searchQuery);
                const matchesTipo = filterTipo === 'todos' || t.tipo === filterTipo;
                return matchesSearch && matchesTipo;
            });

            const totalItems = this.state.filteredTransacciones.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;

            const startIndex = (currentPage - 1) * itemsPerPage;
            const currentItems = this.state.filteredTransacciones.slice(startIndex, startIndex + itemsPerPage);

            const tbodyHtml = currentItems.length > 0 ? currentItems.map(t => {
                const isIngreso = t.tipo === 'ingreso';
                const badgeColor = isIngreso ? 'color: #15803d; background-color: #dcfce7;' : 'color: #b91c1c; background-color: #fee2e2;';
                const labelTipo = isIngreso ? 'Ingreso' : 'Egreso';
                
                return `
                    <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);">
                        <td class="py-3">${t.fecha || '-'}</td>
                        <td class="py-3" style="color: var(--text-main); font-weight: 500;">
                            ${t.detalle || t.referencia || t.categoria || 'Sin detalle'}
                        </td>
                        <td class="py-3 text-center">
                            <span style="${badgeColor} padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: var(--weight-medium);">${labelTipo}</span>
                        </td>
                        <td class="py-3 text-end fw-medium ${isIngreso ? 'text-success' : 'text-danger'}">
                            ${isIngreso ? '+' : '-'} ${formatMoney(t.monto)}
                        </td>
                    </tr>
                `;
            }).join('') : `<tr><td colspan="4" class="text-center py-5 text-muted">No se encontraron movimientos.</td></tr>`;

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
                        <div class="col-md-4">
                            <div class="card border-0" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px; border-top: 4px solid #10b981;">
                                <div class="card-body p-4">
                                    <p class="text-muted mb-1" style="font-size: 13px;">Total Ingresos</p>
                                    <h3 class="fw-bold mb-0" style="color: #10b981;">${formatMoney(this.state.totalIngresos)}</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card border-0" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px; border-top: 4px solid #ef4444;">
                                <div class="card-body p-4">
                                    <p class="text-muted mb-1" style="font-size: 13px;">Total Egresos</p>
                                    <h3 class="fw-bold mb-0" style="color: #ef4444;">${formatMoney(this.state.totalEgresos)}</h3>
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
                                        <th class="py-3 fw-normal">Fecha</th>
                                        <th class="py-3 fw-normal">Descripción</th>
                                        <th class="py-3 fw-normal text-center" style="width: 150px;">Tipo</th>
                                        <th class="py-3 fw-normal text-end" style="width: 200px;">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tbodyHtml}
                                </tbody>
                            </table>
                        </div>

                        <!-- PAGINATION FOOTER -->
                        <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center" style="border-radius: 0 0 8px 8px;">
                            <div class="d-flex align-items-center gap-3" style="font-size: 13px; color: var(--text-body);">
                                <div class="d-flex align-items-center gap-2">
                                    <span>Resultados por página:</span>
                                    <select class="form-select form-select-sm text-muted" id="detail-per-page" style="width: 70px;">
                                        <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10</option>
                                        <option value="20" ${itemsPerPage === 20 ? 'selected' : ''}>20</option>
                                        <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                                    </select>
                                </div>
                                <span class="text-muted border-start ps-3">${totalItems > 0 ? startIndex + 1 : 0}-${Math.min(startIndex + itemsPerPage, totalItems)} de ${totalItems}</span>
                            </div>

                            <div class="d-flex align-items-center gap-2" style="font-size: 13px; color: var(--text-body);">
                                <span>Página</span>
                                <input type="number" id="detail-page" class="form-control form-control-sm text-center text-muted" value="${currentPage}" min="1" max="${totalPages}" style="width: 50px;">
                                <span>de ${totalPages}</span>
                                <div class="ms-2">
                                    <button class="btn btn-link text-muted p-0 me-1" id="detail-btn-prev" ${currentPage === 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
                                    <button class="btn btn-link text-muted p-0" id="detail-btn-next" ${currentPage === totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>
                                </div>
                            </div>
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
                    currentPage = 1;
                    renderGrid();
                });
            }

            this.element.querySelector('#detail-filter-tipo')?.addEventListener('change', (e) => {
                filterTipo = e.target.value;
                currentPage = 1;
                renderGrid();
            });

            this.element.querySelector('#detail-per-page')?.addEventListener('change', (e) => {
                itemsPerPage = parseInt(e.target.value, 10);
                currentPage = 1;
                renderGrid();
            });

            this.element.querySelector('#detail-page')?.addEventListener('change', (e) => {
                const page = parseInt(e.target.value, 10);
                if (page >= 1 && page <= Math.ceil(this.state.filteredTransacciones.length / itemsPerPage)) {
                    currentPage = page;
                    renderGrid();
                }
            });

            this.element.querySelector('#detail-btn-prev')?.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderGrid();
                }
            });

            this.element.querySelector('#detail-btn-next')?.addEventListener('click', () => {
                const totalPages = Math.ceil(this.state.filteredTransacciones.length / itemsPerPage);
                if (currentPage < totalPages) {
                    currentPage++;
                    renderGrid();
                }
            });
        };

        renderGrid();
    }
};
