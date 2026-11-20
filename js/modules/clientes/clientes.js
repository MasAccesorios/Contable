// js/modules/clientes/clientes.js
// Módulo de Gestión & Análisis de Clientes (Directorio Comercial & Cartera 360°)

import { ContactosData } from './clientes.data.js';
import { ContactosTemplates } from './clientes.templates.js';
import { ContactosEvents } from './clientes.events.js';
import { escapeHtml } from '../../shared/formatters.js';

export const ContactosModule = {
    state: {
        view: 'lista', // 'lista' | 'grafico'
        currentPage: 1,
        itemsPerPage: 25,
        currentFilter: 'todos', // 'todos' | 'con_cartera' | 'mora_critica' | 'vip' | 'inactivos' | 'cliente' | 'proveedor'
        sortColumn: 'saldo_cartera',
        sortDirection: 'desc',
        searchQuery: '',
        totalCount: 0,
        contactos: [],
        kpis: {
            total_cartera: 0,
            cartera_vencida: 0,
            cartera_vigente: 0,
            pct_vigente: 100,
            mora_critica_saldo: 0,
            clientes_mora_critica: 0,
            conteo_con_cartera: 0,
            ventas_mes_actual: 0,
            ventas_mes_anterior: 0,
            variacion_ventas: 0,
            clientes_activos_60d: 0,
            total_contactos: 0,
            total_clientes: 0,
            total_proveedores: 0
        },
        activeDrawerId: null,
        currentClienteData: null,
        isLoading: false
    },

    async init(element) {
        if (!element) return;
        this.element = element;

        const [cleanHash, queryString] = window.location.hash.split('?');
        const urlParams = new URLSearchParams(queryString || '');
        const searchParam = urlParams.get('search') || urlParams.get('q');

        this.state.searchQuery = (searchParam || '').trim();
        this.state.currentFilter = 'todos';
        this.state.currentPage = 1;
        this.state.view = 'lista';
        this.state.sortColumn = 'saldo_cartera';
        this.state.sortDirection = 'desc';
        this.state.activeDrawerId = null;

        // 1. Renderizar Shell Principal Ergonómico
        this.renderLayout();

        // 2. Vincular Eventos Globales y de Controles
        this.bindEvents();

        // 3. Cargar Datos Paginados y KPIs
        await this.cargarPagina();

        // 4. Manejo de Deep-linking (#/contactos/ver/:id o #/contactos/nueva)
        const hashParts = cleanHash.split('/');
        const action = hashParts[2];
        const routeId = hashParts[3];

        if (action === 'ver' && routeId) {
            await this.mostrarDrawer(routeId);
        } else if (action === 'nueva') {
            this.renderForm();
        }
    },

    async mostrarDrawer(id) {
        const backdrop = this.element.querySelector('#cliente-drawer-backdrop');
        const drawer = this.element.querySelector('#cliente-drawer');
        const body = this.element.querySelector('#cliente-drawer-body');
        if (!drawer || !body) return;

        body.innerHTML = `
            <div class="d-flex flex-column justify-content-center align-items-center py-5">
                <div class="spinner-border text-primary mb-2" role="status"><span class="visually-hidden">Cargando...</span></div>
                <div class="text-muted small">Cargando perfil 360° del cliente...</div>
            </div>
        `;
        if (backdrop) backdrop.classList.add('show');
        drawer.classList.add('show');
        this.state.activeDrawerId = id;

        try {
            const data = await this._cargarClienteCompleto(id);
            if (data && data.contacto) {
                this.state.currentClienteData = data;
                body.innerHTML = this.renderDrawerContent(data);
                this.bindDrawerEvents(data);
            } else {
                body.innerHTML = `<div class="p-4 text-center text-muted">No se encontró información del contacto #${escapeHtml(id)}.</div>`;
            }
        } catch (err) {
            console.error('Error cargando cliente para drawer:', err);
            body.innerHTML = `<div class="p-4 text-center text-danger">Error al cargar datos del cliente: ${escapeHtml(err.message)}</div>`;
        }
    },

    cerrarDrawer() {
        const backdrop = this.element.querySelector('#cliente-drawer-backdrop');
        const drawer = this.element.querySelector('#cliente-drawer');
        if (backdrop) backdrop.classList.remove('show');
        if (drawer) drawer.classList.remove('show');
        this.state.activeDrawerId = null;
        this.state.currentClienteData = null;

        if (window.location.hash.includes('/ver/')) {
            history.replaceState(null, '', '#/contactos');
        }
    },

    async renderDetalle(id) {
        // Enlace compatible con vistas anteriores: abre el drawer 360° directamente
        await this.mostrarDrawer(id);
    }
};

Object.assign(ContactosModule, ContactosData, ContactosTemplates, ContactosEvents);
