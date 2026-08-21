import { supabase } from '../../core/supabase.js';

export const CategoriasModule = {
    async init(element) {
        if (!element) return;
        this.renderList(element);
    },

    async renderList(element) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; color: #2cbfb7;">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;

        let totalCategorias = 0;
        let catActivas = 0;
        let categorias = [];

        try {
            const { data, error } = await supabase.from('categorias_contables').select('*').order('nombre', { ascending: true });
            if (!error && data) {
                categorias = data;
                totalCategorias = data.length;
                catActivas = data.filter(c => c.estado === 'activa').length;
            }
        } catch(e) {
            console.error('Error fetching categories:', e);
        }

        element.innerHTML = `
            <div class="ds-layout p-4" style="max-width: 1100px; margin: 0 auto;">
                <!-- TOP BAR -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Categorías</h2>
                        <p class="text-muted mb-0" style="font-size: 14px;">
                            Gestiona las categorías de tus productos y movimientos financieros.
                        </p>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-light bg-white border" style="font-weight: var(--weight-medium); font-size: 14px; color: var(--text-body);" onclick="location.reload()">
                            <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
                        </button>
                        <button class="btn btn-primary-action">
                            <i class="bi bi-plus-lg me-1"></i> Nueva Categoría
                        </button>
                    </div>
                </div>

                <!-- KPI CARDS -->
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Total Categorías</span>
                            <div class="ds-kpi-value">${totalCategorias}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Categorías Activas</span>
                            <div class="ds-kpi-value text-success">${catActivas}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="ds-kpi-card">
                            <span class="ds-kpi-label">Productos Asociados</span>
                            <div class="ds-kpi-value">0</div>
                        </div>
                    </div>
                </div>

                <!-- DATA TABLE CARD -->
                <div class="ds-table-container mb-4">
                    <!-- FILTERS -->
                    <div class="card-header bg-white border-bottom p-3 d-flex gap-3 align-items-center">
                        <div class="ds-search-container" style="width: 250px;">
                            <i class="bi bi-search ds-search-icon"></i>
                            <input type="text" class="ds-search-input" id="searchCategorias" autocomplete="off" placeholder="Buscar categoría...">
                        </div>
                    </div>

                    <!-- GRID -->
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle mb-0">
                            <thead class="ds-table-header">
                                <tr>
                                    <th class="py-2 fw-normal" style="min-width: 200px;">Nombre</th>
                                    <th class="py-2 fw-normal text-center" style="width: 150px;">Flujo</th>
                                    <th class="py-2 fw-normal text-center" style="width: 120px;">Estado</th>
                                    <th class="py-2 fw-normal text-end" style="width: 80px;"></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${categorias.length > 0 ? categorias.map(c => `
                                    <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-body);">
                                        <td class="py-3 fw-medium" style="color: var(--text-main); white-space: nowrap;">${c.nombre}</td>
                                        <td class="py-3 text-center" style="white-space: nowrap;"><span class="badge bg-light text-dark border border-secondary-subtle px-2 py-1 rounded-pill">${c.tipo_flujo || 'N/A'}</span></td>
                                        <td class="py-3 text-center" style="white-space: nowrap;">
                                            <span class="badge ${c.estado === 'activa' ? 'bg-success text-success bg-opacity-10 border border-success-subtle' : 'bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle'} rounded-pill fw-medium" style="font-size: 11px; padding: 5px 10px;">
                                                ${c.estado === 'activa' ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </td>
                                        <td class="py-3 text-end" style="white-space: nowrap;">
                                            <button class="btn btn-link text-muted p-0">
                                                <i class="bi bi-three-dots-vertical"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4" class="text-center py-5 text-muted">No se encontraron categorías</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
};
