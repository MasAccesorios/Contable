/**
 * Módulo Orquestador de Detalle de Producto
 * Integra ProductoDetalleData, ProductoDetalleTemplates y ProductoDetalleEvents.
 */

import { ProductoDetalleData } from './productoDetalle.data.js';
import { ProductoDetalleTemplates } from './productoDetalle.templates.js';
import { ProductoDetalleEvents } from './productoDetalle.events.js';

export const ProductoDetalleModule = {
    data: ProductoDetalleData,
    templates: ProductoDetalleTemplates,
    events: ProductoDetalleEvents,

    element: null,
    onVolverCallback: null,

    state: {
        productoId: null,
        producto: null,
        lotes: [],
        ventas: [],
        facturasCompra: [],
        filtroLotes: 'todos',
        kpis: {},
        isLoading: false
    },

    /**
     * Inicializa y renderiza la vista detallada de producto.
     * @param {HTMLElement} element - Contenedor DOM donde se renderizará el módulo.
     * @param {string|number} productoId - Identificador único del producto.
     * @param {Function} [onVolver] - Callback opcional para regresar al listado.
     */
    async init(element, productoId, onVolver = null) {
        if (!element || !productoId) return;

        this.element = element;
        this.onVolverCallback = onVolver;
        this.state = {
            productoId,
            producto: null,
            lotes: [],
            ventas: [],
            facturasCompra: [],
            kardex: [],
            filtroLotes: 'todos',
            kpis: {},
            isLoading: true
        };

        this.element.innerHTML = `
            <div class="d-flex flex-column justify-content-center align-items-center py-5" style="min-height: 400px;">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Cargando detalle de producto...</span>
                </div>
                <div class="text-muted" style="font-size: 14px;">Calculando capas FIFO y valorizaciones...</div>
            </div>
        `;

        try {
            const dataResult = await this.data.cargarDetalle(productoId);
            if (!dataResult || !dataResult.producto) {
                const safeId = this.templates.escapeHtml(String(productoId || ''));
                this.element.innerHTML = `
                    <div class="alert alert-warning m-4 p-4 text-center">
                        <h5>Producto no encontrado</h5>
                        <p class="text-muted">El producto seleccionado (ID: ${safeId}) no existe o fue eliminado.</p>
                        <button id="btn-volver-prod" class="btn btn-primary btn-sm mt-2">
                            <span class="material-symbols-outlined me-1" style="font-size: 16px;">arrow_back</span>Volver al Listado
                        </button>
                    </div>
                `;
                this.element.querySelector('#btn-volver-prod')?.addEventListener('click', () => this.volver());
                return;
            }

            this.state.producto = dataResult.producto;
            this.state.lotes = dataResult.lotes || [];
            this.state.ventas = dataResult.ventas || [];
            this.state.facturasCompra = dataResult.facturasCompra || [];
            this.state.kardex = dataResult.kardex || [];
            this.state.kpis = dataResult.kpis || {};

            this.render();
        } catch (err) {
            console.error('Error al inicializar ProductoDetalleModule:', err);
            const safeMsg = this.templates.escapeHtml(String(err?.message || 'Ocurrió un error inesperado al procesar la información.'));
            this.element.innerHTML = `
                <div class="alert alert-danger m-4 p-4 text-center">
                    <h5>Error al cargar el producto</h5>
                    <p class="text-muted">${safeMsg}</p>
                    <button id="btn-volver-prod" class="btn btn-outline-danger btn-sm mt-2">
                        Volver al Listado
                    </button>
                </div>
            `;
            this.element.querySelector('#btn-volver-prod')?.addEventListener('click', () => this.volver());
        } finally {
            this.state.isLoading = false;
        }
    },

    /**
     * Renderiza la plantilla completa y enlaza los eventos.
     */
    render() {
        if (!this.element) return;

        const lotesDecorados = this.data.filtrarLotes(this.state.lotes, this.state.filtroLotes);

        const html = this.templates.renderLayout({
            producto: this.state.producto,
            kpis: this.state.kpis,
            lotes: lotesDecorados,
            filtroLotes: this.state.filtroLotes,
            ventas: this.state.ventas,
            facturasCompra: this.state.facturasCompra,
            kardex: this.state.kardex
        });

        this.element.innerHTML = html;
        this.events.bindEvents(this.element, this);
    },

    /**
     * Recarga únicamente los datos y actualiza las secciones afectadas sin reflow total.
     */
    async recargarDatos() {
        if (!this.state.productoId) return;

        const dataResult = await this.data.cargarDetalle(this.state.productoId);
        if (!dataResult) return;

        this.state.producto = dataResult.producto;
        this.state.lotes = dataResult.lotes || [];
        this.state.ventas = dataResult.ventas || [];
        this.state.facturasCompra = dataResult.facturasCompra || [];
        this.state.kardex = dataResult.kardex || [];
        this.state.kpis = dataResult.kpis || {};

        // Actualizar KPIs
        const kpiContainer = this.element.querySelector('#kpi-cards-container');
        if (kpiContainer) {
            kpiContainer.innerHTML = this.templates.renderKpiCards(this.state.kpis);
        }

        // Actualizar tabla de lotes
        const tbodyLotes = this.element.querySelector('#tbody-lotes-fifo');
        if (tbodyLotes) {
            const lotesFiltrados = this.data.filtrarLotes(this.state.lotes, this.state.filtroLotes);
            tbodyLotes.innerHTML = this.templates.renderTablaLotes(lotesFiltrados, this.state.filtroLotes);
        }

        // Si estamos en un entorno con el layout completo, sincronizar cabecera y sidebar
        if (this.element && typeof this.element.querySelector === 'function' && this.element.querySelector('#tabs-producto-principal')) {
            this.render();
        }
    },

    /**
     * Guarda un nuevo lote FIFO.
     * @param {Object} nuevoLote 
     */
    async guardarLote(nuevoLote) {
        return await this.data.guardarLote(nuevoLote);
    },

    /**
     * Carga el historial de movimientos de Kardex para el producto.
     * @param {string|number} productoId 
     */
    async cargarKardex(productoId) {
        return await this.data.cargarKardex(productoId);
    },

    /**
     * Ejecuta el callback para volver al listado o redirige el hash.
     */
    volver() {
        this.cleanup();
        if (typeof window !== 'undefined') {
            if (window.location.hash === '#/inventario/items') {
                if (typeof this.onVolverCallback === 'function') {
                    this.onVolverCallback();
                }
            } else {
                window.location.hash = '#/inventario/items';
                if (typeof this.onVolverCallback === 'function') {
                    this.onVolverCallback();
                }
            }
        } else if (typeof this.onVolverCallback === 'function') {
            this.onVolverCallback();
        }
    },

    /**
     * Limpieza de instancias y modales.
     */
    cleanup() {
        if (this.events && typeof this.events.cleanup === 'function') {
            this.events.cleanup(this.element);
        }
    }
};
