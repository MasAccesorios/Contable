// js/modules/inventario/categorias.js
// Módulo de Categorías Contables Moderno
// MAS Accesorios - Sistema Contable

import { supabase } from '../../core/supabase.js';
import { CategoriasData } from './categorias/categorias.data.js';
import { CategoriasTemplates } from './categorias/categorias.templates.js';
import { CategoriasEvents } from './categorias/categorias.events.js';

export const CategoriasModule = {
    element: null,
    state: {
        categorias: [],
        categoriasFiltradas: [],
        conteoMovimientos: {},
        selectedTab: 'todas',
        searchQuery: '',
        kpis: {}
    },

    async init(element) {
        if (!element) return;
        this.element = element;
        this.state.selectedTab = 'todas';
        this.state.searchQuery = '';

        // 1. Mostrar estado de carga moderno
        this.renderLoading(element);

        // 2. Cargar datos desde Supabase
        await this.cargarDatos();

        // 3. Renderizar layout principal
        this.renderLayoutCompleto();

        // 4. Vincular eventos e interacciones
        CategoriasEvents.bind(this.element, this);

        // 5. Renderizar contenido de tabla
        CategoriasEvents.actualizarTablaFiltrada();

        return () => CategoriasEvents.unbind();
    },

    renderLoading(element) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="d-flex flex-column align-items-center gap-3">
                    <div class="spinner-border text-primary" role="status" style="width: 2.8rem; height: 2.8rem;">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <span class="text-muted fw-semibold" style="font-size: 13px;">Cargando catálogo contable...</span>
                </div>
            </div>
        `;
    },

    async cargarDatos() {
        try {
            // Consulta en paralelo: categorías contables + uso en transacciones (pagos_ingresos)
            const [catRes, pagosRes] = await Promise.all([
                supabase.from('categorias_contables').select('*').order('nombre', { ascending: true }),
                supabase.from('pagos_ingresos').select('categoria').not('categoria', 'is', null)
            ]);

            if (catRes.error) {
                console.error('Error cargando categorías contables:', catRes.error);
            }
            this.state.categorias = catRes.data || [];

            // Contar movimientos por categoría
            const conteo = {};
            if (pagosRes.data) {
                for (const row of pagosRes.data) {
                    const catName = row.categoria;
                    if (catName) {
                        conteo[catName] = (conteo[catName] || 0) + 1;
                    }
                }
            }
            this.state.conteoMovimientos = conteo;

            // Calcular KPIs
            this.state.kpis = CategoriasData.calcularKpis(this.state.categorias, this.state.conteoMovimientos);
        } catch (err) {
            console.error('Error inesperado cargando categorías:', err);
            this.state.categorias = [];
            this.state.conteoMovimientos = {};
            this.state.kpis = CategoriasData.calcularKpis([], {});
        }
    },

    renderLayoutCompleto() {
        if (!this.element) return;
        this.element.innerHTML = CategoriasTemplates.renderLayout(
            this.state.kpis,
            this.state.selectedTab,
            this.state.searchQuery
        );
    },

    async recargarDatos(mostrarFeedback = false) {
        await this.cargarDatos();
        this.actualizarVistasCompletas();
        if (mostrarFeedback) {
            CategoriasEvents.mostrarToast('Datos actualizados correctamente.');
        }
    },

    actualizarVistasCompletas() {
        if (!this.element) return;
        this.state.kpis = CategoriasData.calcularKpis(this.state.categorias, this.state.conteoMovimientos);

        // Guardar estado actual del buscador
        const currentSearch = this.element.querySelector('#search-categorias')?.value || '';
        this.state.searchQuery = currentSearch;

        // Re-render layout
        this.renderLayoutCompleto();

        // Re-vincular eventos
        CategoriasEvents.bind(this.element, this);

        // Actualizar tabla
        CategoriasEvents.actualizarTablaFiltrada();
    }
};
