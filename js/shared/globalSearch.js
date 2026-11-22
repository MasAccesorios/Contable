import { supabase } from '../core/supabase.js';
import { escapeHtml, extractDocumentNumber, highlightMatches, toSpanishSearchVariants } from './formatters.js';

const FREQ_STORAGE_KEY = 'gs_busquedas_frecuentes';
const MAX_STORED = 6;
const MAX_SHOWN = 5;

// Comandos del sistema / Accesos directos rápidos
const SYSTEM_COMMANDS = [
    { title: 'Nueva Factura de Venta', icon: 'bi-receipt', desc: 'Crear factura para cliente', hash: '#/ingresos/facturas/nueva', keywords: ['nueva factura', 'crear factura', 'vender', 'venta', 'facturar', 'factura'] },
    { title: 'Nuevo Contacto / Cliente', icon: 'bi-person-plus', desc: 'Registrar cliente o proveedor', hash: '#/contactos/nueva', keywords: ['nuevo cliente', 'crear cliente', 'nuevo proveedor', 'contacto', 'tercero', 'cliente', 'proveedor'] },
    { title: 'Nuevo Recibo de Caja (Cobro)', icon: 'bi-cash-coin', desc: 'Registrar abono de cliente', hash: '#/ingresos/pagos/nuevo', keywords: ['registrar pago', 'recibo de caja', 'cobro', 'abono', 'pago recibido', 'recibo'] },
    { title: 'Nuevo Comprobante de Egreso (Gasto)', icon: 'bi-wallet2', desc: 'Registrar pago a proveedor', hash: '#/gastos/pagos/nuevo', keywords: ['nuevo gasto', 'pago realizado', 'egreso', 'comprobante de egreso', 'gasto'] },
    { title: 'Nueva Cotización', icon: 'bi-file-earmark-text', desc: 'Generar cotización comercial', hash: '#/ingresos/cotizaciones/nueva', keywords: ['nueva cotizacion', 'crear cotizacion', 'cotizar', 'presupuesto', 'cotizacion'] },
    { title: 'Nuevo Producto / Ítem', icon: 'bi-box-seam', desc: 'Añadir ítem al inventario', hash: '#/inventario/items/nuevo', keywords: ['nuevo producto', 'crear producto', 'item', 'inventario nuevo', 'producto', 'articulo'] },
    { title: 'Módulo de Cartera (CxC)', icon: 'bi-pie-chart', desc: 'Control de saldos y moras', hash: '#/cartera', keywords: ['cartera', 'cuentas por cobrar', 'cxc', 'mora', 'deudas'] },
    { title: 'Conciliación Bancaria', icon: 'bi-bank', desc: 'Extractos y tesorería', hash: '#/bancos/conciliacion', keywords: ['bancos', 'conciliacion', 'tesoreria', 'extracto', 'cuenta'] },
    { title: 'Reportes y Analíticas', icon: 'bi-graph-up', desc: 'Informes de ventas y utilidad', hash: '#/reportes', keywords: ['reportes', 'informes', 'ventas', 'ganancias', 'perdidas'] },
    { title: 'Auditoría de Integridad', icon: 'bi-shield-check', desc: 'Diagnóstico de kardex y transacciones', hash: '#/auditoria', keywords: ['auditoria', 'integridad', 'kardex check', 'verificar'] },
];

function getAvatar(name = '') {
    const clean = (name || '').trim();
    if (!clean) return { initials: 'CL', bg: '#e0e7ff', color: '#3730a3' };
    const parts = clean.split(' ').filter(Boolean);
    const initials = (parts.length > 1 ? (parts[0][0] + parts[1][0]) : clean.substring(0, 2)).toUpperCase();
    const colors = [
        { bg: '#dbeafe', color: '#1e40af' },
        { bg: '#fef3c7', color: '#92400e' },
        { bg: '#dcfce7', color: '#166534' },
        { bg: '#f3e8ff', color: '#6b21a8' },
        { bg: '#ffedd5', color: '#9a3412' }
    ];
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    return { initials, ...colors[Math.abs(hash) % colors.length] };
}

function fmtMoney(val) {
    const n = parseFloat(val) || 0;
    return '$ ' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export const GlobalSearch = {
    currentSearchToken: 0,
    searchAbortController: null,
    activeIndex: -1,
    isInitialized: false,
    currentFilter: 'todos',
    cachedGroups: [],
    cachedQuery: '',

    init() {
        const input = document.getElementById('global-search');
        if (!input) return;

        // Prevenir registros múltiples de eventos
        if (this.isInitialized && input.dataset.gsInit === 'true') {
            return;
        }
        input.dataset.gsInit = 'true';
        this.isInitialized = true;

        let debounceTimer;

        // 1. Envolver el input en un contenedor relativo para ubicar el dropdown y controles
        let wrapper = input.closest('.gs-container');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'gs-container position-relative flex-grow-1 d-flex align-items-center';
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);
        }

        // 1.1 Inyectar icono de lupa a la izquierda si no existe
        if (!wrapper.querySelector('.gs-search-icon')) {
            const icon = document.createElement('i');
            icon.className = 'bi bi-search gs-search-icon';
            wrapper.insertBefore(icon, input);
        }

        // 1.2 Inyectar botón de limpieza rápida (✕)
        let clearBtn = wrapper.querySelector('.gs-clear-btn');
        if (!clearBtn) {
            clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'gs-clear-btn';
            clearBtn.setAttribute('title', 'Limpiar búsqueda (Esc)');
            clearBtn.setAttribute('aria-label', 'Limpiar búsqueda');
            clearBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
            wrapper.appendChild(clearBtn);

            clearBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clear();
                input.focus();
                this.renderFrecuentes(input);
            });
        }

        // 2. Inyectar indicador de atajo (Ctrl K / ⌘K)
        if (!wrapper.querySelector('.gs-kbd-hint')) {
            const isMac = navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const hint = document.createElement('kbd');
            hint.className = 'gs-kbd-hint d-none d-sm-inline-block';
            hint.textContent = isMac ? '⌘K' : 'Ctrl K';
            wrapper.appendChild(hint);
        }

        // 3. Atajo global de teclado (Ctrl + K o /)
        document.addEventListener('keydown', (e) => {
            const isCtrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
            const isSlash = e.key === '/' && document.activeElement !== input && 
                            !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
            
            if (isCtrlK || isSlash) {
                e.preventDefault();
                input.focus();
                input.select();
            }
        });

        // 4. Gestión de foco y clases auxiliares
        input.addEventListener('focus', () => {
            wrapper.classList.add('has-focus');
            if (input.value.trim().length === 0) {
                this.renderFrecuentes(input);
            } else if (input.value.trim().length >= 2) {
                this.performSearch(input.value.trim(), input);
            }
        });

        input.addEventListener('blur', () => {
            wrapper.classList.remove('has-focus');
        });

        // 5. Input con Debounce
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                wrapper.classList.add('has-value');
            } else {
                wrapper.classList.remove('has-value');
            }

            clearTimeout(debounceTimer);

            if (query.length < 2) {
                if (query.length === 0) {
                    this.renderFrecuentes(input);
                } else {
                    this.closeDropdown();
                }
                return;
            }

            debounceTimer = setTimeout(() => {
                this.performSearch(query, input);
            }, 250);
        });

        // 6. Navegación por teclado en dropdown (Flechas, Enter, Tab, Escape)
        input.addEventListener('keydown', (e) => {
            const dropdown = document.getElementById('global-search-results');
            const isDropdownVisible = dropdown && dropdown.style.display !== 'none';

            if (e.key === 'Escape') {
                if (input.value.trim().length > 0) {
                    this.clear();
                    this.renderFrecuentes(input);
                } else {
                    this.closeDropdown();
                    input.blur();
                }
                return;
            }

            // Alternar filtros con tecla Tab cuando el dropdown esté abierto
            if (isDropdownVisible && e.key === 'Tab') {
                e.preventDefault();
                this.cycleFilterTab(e.shiftKey ? -1 : 1, input);
                return;
            }

            if (!isDropdownVisible) {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    if (input.value.trim().length >= 2) {
                        this.performSearch(input.value.trim(), input);
                    } else {
                        this.renderFrecuentes(input);
                    }
                }
                return;
            }

            const navItems = Array.from(dropdown.querySelectorAll('.gs-nav-item'));
            if (navItems.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = (this.activeIndex + 1) >= navItems.length ? 0 : this.activeIndex + 1;
                this.updateActiveItem(navItems, nextIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = (this.activeIndex - 1) < 0 ? navItems.length - 1 : this.activeIndex - 1;
                this.updateActiveItem(navItems, prevIndex);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const target = (this.activeIndex >= 0 && navItems[this.activeIndex]) ? navItems[this.activeIndex] : navItems[0];
                this.seleccionarElemento(target, input);
            }
        });

        // 7. Cerrar al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.gs-container')) {
                this.closeDropdown();
            }
        });
    },

    setFilter(filter, input) {
        this.currentFilter = filter;
        this.renderFilteredResults(input, this.cachedQuery);
    },

    cycleFilterTab(direction, input) {
        const availableFilters = ['todos'];
        (this.cachedGroups || []).forEach(g => {
            if (g && g.data && g.data.length > 0 && !availableFilters.includes(g.type)) {
                availableFilters.push(g.type);
            }
        });
        if (availableFilters.length <= 1) return;
        const currentIndex = availableFilters.indexOf(this.currentFilter);
        let nextIndex = currentIndex + direction;
        if (nextIndex < 0) nextIndex = availableFilters.length - 1;
        if (nextIndex >= availableFilters.length) nextIndex = 0;
        this.setFilter(availableFilters[nextIndex], input);
    },

    updateActiveItem(items, newIndex) {
        items.forEach(el => el.classList.remove('gs-item-active'));
        if (newIndex >= 0 && newIndex < items.length) {
            items[newIndex].classList.add('gs-item-active');
            items[newIndex].scrollIntoView({ block: 'nearest' });
            this.activeIndex = newIndex;
        } else {
            this.activeIndex = -1;
        }
    },

    // ─── Búsquedas frecuentes (LocalStorage) ───────────────────────────────────

    getFrecuentes() {
        try {
            const stored = JSON.parse(localStorage.getItem(FREQ_STORAGE_KEY));
            return Array.isArray(stored) ? stored : [];
        } catch {
            return [];
        }
    },

    registrarBusquedaExitosa(item) {
        if (!item) return;
        let entry = null;
        if (typeof item === 'object') {
            const title = (item.title || '').trim();
            if (!title) return;
            entry = {
                title,
                type: item.type || 'general',
                hash: item.hash || '',
                subtitle: item.subtitle || '',
                icon: item.icon || 'bi-clock-history'
            };
        } else {
            const clean = String(item).trim();
            if (!clean || clean.length < 2) return;
            entry = clean;
        }

        let historial = this.getFrecuentes();
        const getKey = (e) => typeof e === 'object' ? (e.title || '').toLowerCase() : String(e).toLowerCase();
        const newKey = getKey(entry);

        historial = historial.filter(e => getKey(e) !== newKey);
        historial.unshift(entry);
        historial = historial.slice(0, MAX_STORED);
        try {
            localStorage.setItem(FREQ_STORAGE_KEY, JSON.stringify(historial));
        } catch (e) {
            console.warn('[GlobalSearch] Error guardando historial:', e);
        }
    },

    eliminarFrecuente(key) {
        const target = String(key || '').toLowerCase();
        const getKey = (e) => typeof e === 'object' ? (e.title || '').toLowerCase() : String(e).toLowerCase();
        const historial = this.getFrecuentes().filter(e => getKey(e) !== target);
        localStorage.setItem(FREQ_STORAGE_KEY, JSON.stringify(historial));
    },

    limpiarFrecuentes() {
        localStorage.removeItem(FREQ_STORAGE_KEY);
    },

    renderFrecuentes(input) {
        const top = this.getFrecuentes().slice(0, MAX_SHOWN);
        const wrapper = input.closest('.gs-container');

        // Si no hay búsquedas frecuentes, mostrar sugerencias de accesos rápidos
        if (top.length === 0) {
            const sugerenciasHtml = SYSTEM_COMMANDS.slice(0, 4).map(cmd => `
                <a href="${cmd.hash}" class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 gs-nav-item text-decoration-none" style="color: var(--text-main);" data-entity-title="${escapeHtml(cmd.title)}" data-entity-type="comando" data-entity-hash="${cmd.hash}" data-entity-icon="${cmd.icon}">
                    <i class="bi ${cmd.icon} text-primary" style="font-size: 15px;"></i>
                    <div class="flex-grow-1">
                        <div class="fw-medium" style="font-size: 13px; color: var(--text-main);">${escapeHtml(cmd.title)}</div>
                        <div class="text-muted" style="font-size: 11px;">${escapeHtml(cmd.desc)}</div>
                    </div>
                </a>
            `).join('');

            const html = `
                <div class="gs-section-header">
                    <span>Acciones Frecuentes</span>
                    <span class="text-muted" style="font-size: 10px;">Atajo rápido</span>
                </div>
                ${sugerenciasHtml}
                <div class="gs-footer-hints">
                    <span>Escribe para buscar clientes, facturas, cotizaciones o productos</span>
                    <kbd class="px-1 py-0 gs-kbd rounded">Esc</kbd>
                </div>
            `;
            this.renderDropdown(input, html);
            this.bindDropdownClicks(input);
            return;
        }

        const itemsHtml = top.map(item => {
            const isObj = item && typeof item === 'object';
            const title = isObj ? item.title : item;
            const subtitle = isObj && item.subtitle ? item.subtitle : null;
            const rawIcon = isObj ? item.icon : 'bi-clock-history';
            const icon = (typeof rawIcon === 'string' && /^bi-[a-z0-9-]+$/.test(rawIcon)) ? rawIcon : 'bi-bookmark';
            const rawHash = isObj ? item.hash : null;
            const hash = (typeof rawHash === 'string' && rawHash.startsWith('#')) ? rawHash : null;

            return `
                <div class="dropdown-item py-2 gs-frecuente-item px-3 d-flex align-items-center justify-content-between gap-2 gs-nav-item" ${hash ? `data-hash="${escapeHtml(hash)}"` : ''} data-entity-title="${escapeHtml(title)}">
                    <a href="${hash ? escapeHtml(hash) : 'javascript:void(0)'}" class="gs-frecuente-link flex-grow-1 d-flex align-items-center gap-2 text-decoration-none" style="color: var(--text-main); min-width: 0;" data-query="${escapeHtml(title)}" ${hash ? `data-hash="${escapeHtml(hash)}"` : ''}>
                        <i class="bi ${icon} text-muted" style="font-size: 14px;"></i>
                        <div class="text-truncate">
                            <span style="font-size: 13px; font-weight: 500;">${escapeHtml(title)}</span>
                            ${subtitle ? `<div class="text-muted" style="font-size: 10.5px;">${escapeHtml(subtitle)}</div>` : ''}
                        </div>
                    </a>
                    <button type="button" class="btn btn-sm btn-link text-muted p-0 gs-frecuente-borrar" data-query="${escapeHtml(title)}" title="Quitar de recientes" style="line-height: 1;">
                        <i class="bi bi-x-lg" style="font-size: 11px;"></i>
                    </button>
                </div>
            `;
        }).join('');

        const html = `
            <div class="gs-section-header">
                <span>Búsquedas recientes</span>
                <a href="javascript:void(0)" class="gs-frecuente-limpiar-todo text-muted text-decoration-none" style="font-size: 11px;">Borrar historial</a>
            </div>
            ${itemsHtml}
            <div class="gs-footer-hints">
                <span><kbd class="px-1 py-0 gs-kbd rounded">↑↓</kbd> Seleccionar • <kbd class="px-1 py-0 gs-kbd rounded">↵</kbd> Abrir • <kbd class="px-1 py-0 gs-kbd rounded">Esc</kbd> Cerrar</span>
            </div>
        `;

        this.renderDropdown(input, html);
        this.activeIndex = -1;

        document.querySelectorAll('.gs-frecuente-link').forEach(l => {
            l.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const hash = l.getAttribute('data-hash');
                if (hash && hash !== 'javascript:void(0)') {
                    this.closeDropdown();
                    input.value = '';
                    window.location.hash = hash;
                } else {
                    const query = l.getAttribute('data-query');
                    input.value = query;
                    wrapper?.classList.add('has-value');
                    this.performSearch(query, input, false);
                }
            });
        });

        document.querySelectorAll('.gs-frecuente-borrar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.eliminarFrecuente(btn.getAttribute('data-query'));
                this.renderFrecuentes(input);
            });
        });

        const btnLimpiarTodo = document.querySelector('.gs-frecuente-limpiar-todo');
        if (btnLimpiarTodo) {
            btnLimpiarTodo.addEventListener('click', (e) => {
                e.stopPropagation();
                this.limpiarFrecuentes();
                this.renderFrecuentes(input);
            });
        }
    },

    // ─── Búsqueda inteligente Multi-Entidad ────────────────────────────────────

    async performSearch(query, input, autoNavigate = false) {
        if (this.searchAbortController) {
            try { this.searchAbortController.abort(); } catch {}
        }
        this.searchAbortController = new AbortController();

        const searchToken = Date.now();
        this.currentSearchToken = searchToken;
        this.activeIndex = -1;

        this.renderDropdown(input, `
            <div class="p-3 text-center text-muted small">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                Buscando clientes, facturas, cotizaciones y productos...
            </div>
        `);

        // Extraer número de documento SOLO si la intención de búsqueda es explícitamente un documento
        // (ej. "2167", "#6882", "FE-1042", "Factura #6882", "Cotización #12")
        // Previene que textos con números intercalados como "2 en 1 Wireless T67" o "Cable 3 en 1" extraigan falsos números de factura.
        const numValue = extractDocumentNumber(query);
        const qLower = query.toLowerCase();

        // 1. Filtrar Comandos del Sistema
        const matchingCommands = SYSTEM_COMMANDS.filter(cmd => 
            cmd.title.toLowerCase().includes(qLower) || 
            cmd.keywords.some(k => k.includes(qLower) || qLower.includes(k))
        ).slice(0, 3);

        // Generar variantes tolerantes a tildes y sanitizadas para PostgREST .or()
        const { safeQuery, wildcardQuery } = toSpanishSearchVariants(query);

        if (safeQuery.length < 2 && numValue === null) {
            this.closeDropdown();
            return;
        }

        const promises = [];

        // 2. Consulta de Contactos (Clientes / Proveedores por Nombre, NIT, Email o Teléfono)
        const contactosFilter = (wildcardQuery && wildcardQuery !== safeQuery)
            ? `nombre.ilike.%${safeQuery}%,nombre.ilike.%${wildcardQuery}%,identificacion.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,telefono.ilike.%${safeQuery}%`
            : `nombre.ilike.%${safeQuery}%,identificacion.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,telefono.ilike.%${safeQuery}%`;

        promises.push(
            supabase.from('contactos')
                .select('id, nombre, identificacion, email, telefono, tipo, es_cliente, es_proveedor')
                .neq('estado', 'inactive')
                .or(contactosFilter)
                .limit(4)
                .then(res => ({ type: 'contactos', data: res.data || [] }))
                .catch(err => { console.error('[GlobalSearch] Error buscando contactos:', err); return { type: 'contactos', data: [] }; })
        );

        // 3. Consulta de Productos (Inventario con stock real calculado por FIFO y búsqueda por nombre o SKU)
        const prodSearchTerm = (wildcardQuery && wildcardQuery !== safeQuery) ? wildcardQuery : safeQuery;
        promises.push(
            supabase.rpc('get_productos_page_v2', {
                p_page: 1,
                p_limit: 5,
                p_sort_column: 'nombre',
                p_sort_direction: 'asc',
                p_search_query: prodSearchTerm,
                p_filter_criteria: 'todos'
            })
            .then(async res => {
                if (res.error) throw res.error;
                const raw = res.data;
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                let items = (parsed?.data || []).map(p => ({
                    id: p.id,
                    nombre: p.nombre,
                    sku: p.sku,
                    precioVenta: p.precioVenta ?? p.precio_venta ?? 0,
                    precio_venta: p.precioVenta ?? p.precio_venta ?? 0,
                    stock: Number(p.stock !== undefined ? p.stock : 0),
                    stockMinimo: Number(p.stockMinimo ?? p.stock_minimo ?? 5),
                    stock_minimo: Number(p.stockMinimo ?? p.stock_minimo ?? 5),
                    estadoStock: p.estadoStock || 'optimo'
                }));

                // Búsqueda inteligente por palabras clave si la frase exacta no arrojó resultados
                if (items.length === 0 && safeQuery.includes(' ')) {
                    const tokens = safeQuery.split(/\s+/).filter(t => t.length >= 2 && !['para', 'con', 'del', 'los', 'las', 'una', 'uno', 'por'].includes(t.toLowerCase()));
                    if (tokens.length >= 2) {
                        try {
                            const orFilter = tokens.slice(0, 3).map(t => `nombre.ilike.%${t}%,sku.ilike.%${t}%`).join(',');
                            const { data: altProds } = await supabase.from('productos')
                                .select('id, nombre, sku, precio_venta, stock_minimo, estado')
                                .or(orFilter)
                                .limit(5);
                            if (altProds && altProds.length > 0) {
                                items = altProds.map(p => ({
                                    id: p.id,
                                    nombre: p.nombre,
                                    sku: p.sku,
                                    precioVenta: Number(p.precio_venta || 0),
                                    precio_venta: Number(p.precio_venta || 0),
                                    stock: 0,
                                    stockMinimo: Number(p.stock_minimo || 5),
                                    stock_minimo: Number(p.stock_minimo || 5),
                                    estadoStock: 'desconocido'
                                }));
                            }
                        } catch (tokErr) {
                            console.warn('[GlobalSearch] Búsqueda por tokens secundarios:', tokErr);
                        }
                    }
                }

                return { type: 'productos', data: items };
            })
            .catch(async (err) => {
                console.warn('[GlobalSearch] RPC get_productos_page_v2 falló, usando fallback defensivo:', err);
                try {
                    const fallbackFilter = (wildcardQuery && wildcardQuery !== safeQuery)
                        ? `nombre.ilike.%${safeQuery}%,nombre.ilike.%${wildcardQuery}%,sku.ilike.%${safeQuery}%`
                        : `nombre.ilike.%${safeQuery}%,sku.ilike.%${safeQuery}%`;
                    const { data: prods, error: pErr } = await supabase.from('productos')
                        .select('id, nombre, sku, precio_venta, stock_minimo, estado')
                        .or(fallbackFilter)
                        .limit(5);
                    if (pErr) throw pErr;
                    const mapped = (prods || []).map(p => ({
                        id: p.id,
                        nombre: p.nombre,
                        sku: p.sku,
                        precioVenta: Number(p.precio_venta || 0),
                        precio_venta: Number(p.precio_venta || 0),
                        stock: 0,
                        stockMinimo: Number(p.stock_minimo || 5),
                        stock_minimo: Number(p.stock_minimo || 5),
                        estadoStock: 'desconocido'
                    }));
                    return { type: 'productos', data: mapped };
                } catch (fallbackErr) {
                    console.error('[GlobalSearch] Fallback de productos falló:', fallbackErr);
                    return { type: 'productos', data: [] };
                }
            })
        );

        // 4. Consulta de Facturas por número (Solo si se detectó un número de documento intencional)
        if (numValue !== null) {
            promises.push(
                supabase.from('facturas')
                    .select('id, numero, total, estado, tipo, fecha, contacto_id, saldo_original, contactos(id, nombre, identificacion)')
                    .eq('numero', numValue)
                    .limit(4)
                    .then(res => ({ type: 'facturas', data: res.data || [] }))
                    .catch(err => { console.error('[GlobalSearch] Error buscando facturas por número:', err); return { type: 'facturas', data: [] }; })
            );

            // 5. Consulta de Cotizaciones por número
            promises.push(
                supabase.from('cotizaciones')
                    .select('id, numero, total, estado, fecha, contacto_id, contactos(id, nombre, identificacion)')
                    .eq('numero', numValue)
                    .limit(3)
                    .then(res => ({ type: 'cotizaciones', data: res.data || [] }))
                    .catch(err => { console.error('[GlobalSearch] Error buscando cotizaciones por número:', err); return { type: 'cotizaciones', data: [] }; })
            );
        }

        const initialResults = await Promise.all(promises);

        if (this.currentSearchToken !== searchToken) return;

        const contactosGroup = initialResults.find(g => g.type === 'contactos');
        const productosGroup = initialResults.find(g => g.type === 'productos');
        let facturasGroup = initialResults.find(g => g.type === 'facturas') || { type: 'facturas', data: [] };
        let cotizacionesGroup = initialResults.find(g => g.type === 'cotizaciones') || { type: 'cotizaciones', data: [] };

        const contactos = contactosGroup?.data || [];

        // 6. Si encontramos contactos, buscar en paralelo sus facturas y cotizaciones asociadas
        if (contactos.length > 0) {
            const contactIds = contactos.map(c => c.id);
            try {
                const [facturasContactosRes, cotizacionesContactosRes] = await Promise.all([
                    supabase.from('facturas')
                        .select('id, numero, total, estado, tipo, fecha, contacto_id, saldo_original, contactos(id, nombre, identificacion)')
                        .in('contacto_id', contactIds)
                        .order('fecha', { ascending: false })
                        .limit(6),
                    supabase.from('cotizaciones')
                        .select('id, numero, total, estado, fecha, contacto_id, contactos(id, nombre, identificacion)')
                        .in('contacto_id', contactIds)
                        .order('fecha', { ascending: false })
                        .limit(4)
                ]);

                if (this.currentSearchToken !== searchToken) return;

                const facsDeContactos = facturasContactosRes.data || [];
                const cotsDeContactos = cotizacionesContactosRes.data || [];

                // Decorar cada contacto con sus facturas recientes y saldo acumulado
                contactos.forEach(c => {
                    c.facturasRecientes = facsDeContactos.filter(f => String(f.contacto_id) === String(c.id));
                    c.facturasPendientesCount = c.facturasRecientes.filter(f => 
                        !['cobrada', 'pagada', 'anulada'].includes((f.estado || '').toLowerCase())
                    ).length;
                    c.totalPendiente = c.facturasRecientes
                        .filter(f => !['cobrada', 'pagada', 'anulada'].includes((f.estado || '').toLowerCase()))
                        .reduce((sum, f) => sum + (parseFloat(f.saldo_original || f.total) || 0), 0);
                });

                // Mezclar facturas encontradas sin duplicados
                const facturaMap = new Map();
                facturasGroup.data.forEach(f => facturaMap.set(String(f.id), f));
                facsDeContactos.forEach(f => {
                    if (!facturaMap.has(String(f.id))) {
                        facturaMap.set(String(f.id), f);
                    }
                });
                facturasGroup.data = Array.from(facturaMap.values()).slice(0, 5);

                // Mezclar cotizaciones encontradas sin duplicados
                const cotizacionMap = new Map();
                cotizacionesGroup.data.forEach(c => cotizacionMap.set(String(c.id), c));
                cotsDeContactos.forEach(c => {
                    if (!cotizacionMap.has(String(c.id))) {
                        cotizacionMap.set(String(c.id), c);
                    }
                });
                cotizacionesGroup.data = Array.from(cotizacionMap.values()).slice(0, 4);

            } catch (err) {
                console.error('[GlobalSearch] Error vinculando facturas de contactos:', err);
            }
        }

        const finalResults = [
            { type: 'comandos', data: matchingCommands },
            contactosGroup,
            facturasGroup,
            cotizacionesGroup,
            productosGroup
        ].filter(Boolean);

        this.cachedGroups = finalResults;
        this.cachedQuery = query;

        // Si se solicitó autoNavegación (ej. al presionar Enter con 1 única coincidencia unívoca en todo el sistema)
        if (autoNavigate) {
            const countContactos = contactos.length;
            const countFacturas = facturasGroup.data.length;
            const countCotizaciones = cotizacionesGroup.data.length;
            const countProductos = productosGroup?.data?.length || 0;
            const totalResultados = countContactos + countFacturas + countCotizaciones + countProductos;

            // ÚNICAMENTE auto-navegar si existe exactamente 1 resultado en TODO el sistema sin ambigüedad
            if (totalResultados === 1) {
                let firstActionHash = null;
                let singleEntity = null;
                if (countContactos === 1) {
                    firstActionHash = `#/contactos/ver/${contactos[0].id}?search=${encodeURIComponent(contactos[0].nombre)}`;
                    singleEntity = { title: contactos[0].nombre, type: 'contacto', hash: firstActionHash, subtitle: `NIT: ${contactos[0].identificacion || 'Sin NIT'}`, icon: 'bi-person' };
                } else if (countProductos === 1) {
                    firstActionHash = `#/inventario/items/ver/${productosGroup.data[0].id}`;
                    singleEntity = { title: productosGroup.data[0].nombre, type: 'producto', hash: firstActionHash, subtitle: `SKU: ${productosGroup.data[0].sku || 'N/A'}`, icon: 'bi-box-seam' };
                } else if (countFacturas === 1) {
                    firstActionHash = `#/ingresos/facturas/ver/${facturasGroup.data[0].id}`;
                    singleEntity = { title: `Factura #${facturasGroup.data[0].numero}`, type: 'factura', hash: firstActionHash, subtitle: fmtMoney(facturasGroup.data[0].total), icon: 'bi-receipt' };
                } else if (countCotizaciones === 1) {
                    firstActionHash = `#/ingresos/cotizaciones/ver/${cotizacionesGroup.data[0].id}`;
                    singleEntity = { title: `Cotización #${cotizacionesGroup.data[0].numero}`, type: 'cotizacion', hash: firstActionHash, subtitle: fmtMoney(cotizacionesGroup.data[0].total), icon: 'bi-file-earmark-text' };
                }

                if (firstActionHash) {
                    this.registrarBusquedaExitosa(singleEntity || query);
                    this.closeDropdown();
                    input.value = '';
                    input.closest('.gs-container')?.classList.remove('has-value');
                    window.location.hash = firstActionHash;
                    return;
                }
            }
        }

        this.renderFilteredResults(input, query);
    },

    renderFilteredResults(input, query) {
        const groups = this.cachedGroups || [];
        
        // Calcular conteos por categoría
        const counts = {
            todos: 0,
            contactos: 0,
            productos: 0,
            facturas: 0,
            cotizaciones: 0,
            comandos: 0
        };

        groups.forEach(g => {
            if (!g || !Array.isArray(g.data)) return;
            const len = g.data.length;
            counts[g.type] = len;
            counts.todos += len;
        });

        // Si el filtro actual no tiene resultados disponibles, volver a 'todos'
        if (this.currentFilter !== 'todos' && (!counts[this.currentFilter] || counts[this.currentFilter] === 0)) {
            this.currentFilter = 'todos';
        }

        // Pestañas / Chips de filtrado interactivo
        let filterTabsHtml = '';
        if (counts.todos > 0) {
            filterTabsHtml = `
                <div class="gs-filter-tabs">
                    <button type="button" class="gs-filter-chip ${this.currentFilter === 'todos' ? 'active' : ''}" data-filter="todos">
                        Todos <span class="badge-count">(${counts.todos})</span>
                    </button>
                    ${counts.contactos > 0 ? `
                        <button type="button" class="gs-filter-chip ${this.currentFilter === 'contactos' ? 'active' : ''}" data-filter="contactos">
                            <i class="bi bi-people-fill"></i> Clientes <span class="badge-count">(${counts.contactos})</span>
                        </button>
                    ` : ''}
                    ${counts.productos > 0 ? `
                        <button type="button" class="gs-filter-chip ${this.currentFilter === 'productos' ? 'active' : ''}" data-filter="productos">
                            <i class="bi bi-box-seam"></i> Productos <span class="badge-count">(${counts.productos})</span>
                        </button>
                    ` : ''}
                    ${counts.facturas > 0 ? `
                        <button type="button" class="gs-filter-chip ${this.currentFilter === 'facturas' ? 'active' : ''}" data-filter="facturas">
                            <i class="bi bi-receipt"></i> Facturas <span class="badge-count">(${counts.facturas})</span>
                        </button>
                    ` : ''}
                    ${counts.cotizaciones > 0 ? `
                        <button type="button" class="gs-filter-chip ${this.currentFilter === 'cotizaciones' ? 'active' : ''}" data-filter="cotizaciones">
                            <i class="bi bi-file-earmark-text"></i> Cotizaciones <span class="badge-count">(${counts.cotizaciones})</span>
                        </button>
                    ` : ''}
                    ${counts.comandos > 0 ? `
                        <button type="button" class="gs-filter-chip ${this.currentFilter === 'comandos' ? 'active' : ''}" data-filter="comandos">
                            <i class="bi bi-lightning-charge-fill"></i> Acciones <span class="badge-count">(${counts.comandos})</span>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        const filteredGroups = this.currentFilter === 'todos'
            ? groups
            : groups.filter(g => g.type === this.currentFilter);

        this.displayResults(input, filteredGroups, query, filterTabsHtml, counts.todos);
    },

    displayResults(input, groups, query, filterTabsHtml = '', totalCount = 0) {
        let html = filterTabsHtml;
        let displayedCount = 0;

        groups.forEach(group => {
            if (!group || !group.data || group.data.length === 0) return;
            displayedCount += group.data.length;

            switch (group.type) {
                case 'comandos': {
                    const itemsHtml = group.data.map(cmd => `
                        <a href="${cmd.hash}" class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 gs-nav-item text-decoration-none" style="color: var(--text-main);" data-entity-title="${escapeHtml(cmd.title)}" data-entity-type="comando" data-entity-hash="${cmd.hash}" data-entity-icon="${cmd.icon}">
                            <i class="bi ${cmd.icon} text-primary" style="font-size: 15px;"></i>
                            <div class="flex-grow-1">
                                <div class="fw-medium" style="font-size: 13px; color: var(--text-main);">${highlightMatches(cmd.title, query)}</div>
                                <div class="text-muted" style="font-size: 11px;">${highlightMatches(cmd.desc, query)}</div>
                            </div>
                            <span class="badge bg-light text-muted border" style="font-size: 10px;">Acción</span>
                        </a>
                    `).join('');

                    html += `
                        <div class="gs-section-header">
                            <span><i class="bi bi-lightning-charge-fill text-warning me-1"></i> Acciones Rápidas</span>
                        </div>
                        ${itemsHtml}
                    `;
                    break;
                }

                case 'contactos': {
                    const itemsHtml = group.data.map(item => {
                        const avatar = getAvatar(item.nombre);
                        const tieneFacturas = item.facturasRecientes && item.facturasRecientes.length > 0;
                        const esCliente = item.es_cliente !== false;
                        const tipoBadge = `<span class="badge ${esCliente ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-secondary-subtle text-secondary'} rounded-pill" style="font-size: 10.5px;">${esCliente ? 'Cliente' : 'Proveedor'}</span>`;
                        
                        let balanceBadge = '';
                        if (item.facturasPendientesCount > 0) {
                            balanceBadge = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill" style="font-size: 10.5px;"><i class="bi bi-exclamation-circle me-1"></i>${item.facturasPendientesCount} pendiente(s) • ${fmtMoney(item.totalPendiente)}</span>`;
                        } else {
                            balanceBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill" style="font-size: 10.5px;"><i class="bi bi-check-circle me-1"></i>Al día</span>`;
                        }

                        // Submenú de facturas recientes embebidas
                        let facturasRecientesHtml = '';
                        if (tieneFacturas) {
                            facturasRecientesHtml = `
                                <div class="mt-2 p-2 gs-embedded-facturas rounded-2 border" style="font-size: 11.5px;">
                                    <div class="text-muted fw-bold mb-1 d-flex justify-content-between align-items-center" style="font-size: 10px; text-transform: uppercase;">
                                        <span><i class="bi bi-receipt me-1"></i> Facturas de ${escapeHtml(item.nombre)}:</span>
                                        <a href="#/ingresos/facturas?search=${encodeURIComponent(item.nombre)}" class="text-primary text-decoration-none gs-nav-item" style="font-size: 10px;">Ver todas (${item.facturasRecientes.length}) &rarr;</a>
                                    </div>
                                    <div class="d-flex flex-column gap-1">
                                        ${item.facturasRecientes.slice(0, 3).map(f => {
                                            const esCobrada = ['cobrada', 'pagada'].includes((f.estado || '').toLowerCase());
                                            return `
                                                <a href="#/ingresos/facturas/ver/${f.id}" class="d-flex justify-content-between align-items-center py-1 px-2 text-decoration-none gs-nav-item gs-embedded-item rounded border" data-entity-title="Factura #${f.numero}" data-entity-type="factura" data-entity-hash="#/ingresos/facturas/ver/${f.id}" data-entity-subtitle="${fmtMoney(f.total)}" data-entity-icon="bi-receipt">
                                                    <span style="color: var(--text-main);"><strong>Factura #${f.numero}</strong> <span class="text-muted small">(${f.fecha || 'Sin fecha'})</span></span>
                                                    <span class="d-flex align-items-center gap-2">
                                                        <span class="fw-semibold" style="color: var(--text-main);">${fmtMoney(f.total)}</span>
                                                        <span class="badge ${esCobrada ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis'} rounded-pill" style="font-size: 9.5px;">${escapeHtml(f.estado || 'por_cobrar')}</span>
                                                    </span>
                                                </a>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }

                        return `
                            <div class="p-3 border-bottom gs-card-contacto" style="background-color: var(--surface);">
                                <!-- CABECERA DEL CLIENTE -->
                                <div class="d-flex align-items-center justify-content-between gap-2">
                                    <div class="d-flex align-items-center gap-2 flex-grow-1 min-w-0">
                                        <div style="background-color: ${avatar.bg}; color: ${avatar.color}; width: 36px; height: 36px; font-size: 13px; font-weight: 700; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                            ${escapeHtml(avatar.initials)}
                                        </div>
                                        <div class="text-truncate">
                                            <div class="fw-bold text-truncate" style="color: var(--text-main); font-size: 13.5px;">${highlightMatches(item.nombre, query)}</div>
                                            <div class="text-muted small d-flex align-items-center gap-1" style="font-size: 11px;">
                                                <span>NIT: ${highlightMatches(item.identificacion || 'Sin NIT', query)}</span>
                                                ${item.telefono ? `<span>• Tel: ${highlightMatches(item.telefono, query)}</span>` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="d-flex flex-column align-items-end gap-1 flex-shrink-0">
                                        ${tipoBadge}
                                        ${balanceBadge}
                                    </div>
                                </div>

                                <!-- SUBMENÚ DE ACCIONES RÁPIDAS -->
                                <div class="d-flex flex-wrap gap-1 mt-2 pt-2 border-top">
                                    <a href="#/ingresos/facturas?search=${encodeURIComponent(item.nombre)}" class="gs-action-chip gs-nav-item" title="Ver sólo las facturas de este cliente" data-entity-title="${escapeHtml(item.nombre)}" data-entity-type="contacto" data-entity-hash="#/ingresos/facturas?search=${encodeURIComponent(item.nombre)}" data-entity-icon="bi-receipt">
                                        <i class="bi bi-receipt text-primary"></i> Ver Facturas
                                    </a>
                                    <a href="#/contactos/ver/${item.id}?search=${encodeURIComponent(item.nombre)}" class="gs-action-chip gs-nav-item" title="Abrir perfil 360° y cartera" data-entity-title="${escapeHtml(item.nombre)}" data-entity-type="contacto" data-entity-hash="#/contactos/ver/${item.id}?search=${encodeURIComponent(item.nombre)}" data-entity-subtitle="NIT: ${escapeHtml(item.identificacion || '')}" data-entity-icon="bi-person">
                                        <i class="bi bi-person-vcard text-secondary"></i> Ficha 360°
                                    </a>
                                    <a href="#/ingresos/facturas/nueva?clienteId=${item.id}" class="gs-action-chip gs-chip-success gs-nav-item" title="Crear nueva factura de venta para este cliente" data-entity-title="Facturar a ${escapeHtml(item.nombre)}" data-entity-type="comando" data-entity-hash="#/ingresos/facturas/nueva?clienteId=${item.id}" data-entity-icon="bi-plus-circle-fill">
                                        <i class="bi bi-plus-circle-fill text-success"></i> Facturar
                                    </a>
                                    <a href="#/ingresos/pagos/nuevo?clienteId=${item.id}" class="gs-action-chip gs-nav-item" title="Registrar recibo de caja / abono" data-entity-title="Cobrar a ${escapeHtml(item.nombre)}" data-entity-type="comando" data-entity-hash="#/ingresos/pagos/nuevo?clienteId=${item.id}" data-entity-icon="bi-cash-coin">
                                        <i class="bi bi-cash-coin text-warning"></i> Cobrar
                                    </a>
                                    <a href="#/ingresos/cotizaciones/nueva?clienteId=${item.id}" class="gs-action-chip gs-nav-item" title="Crear cotización comercial" data-entity-title="Cotizar a ${escapeHtml(item.nombre)}" data-entity-type="comando" data-entity-hash="#/ingresos/cotizaciones/nueva?clienteId=${item.id}" data-entity-icon="bi-file-earmark-plus">
                                        <i class="bi bi-file-earmark-plus text-info"></i> Cotizar
                                    </a>
                                </div>

                                <!-- FACTURAS RECIENTES VINCULADAS -->
                                ${facturasRecientesHtml}
                            </div>
                        `;
                    }).join('');

                    html += `
                        <div class="gs-section-header">
                            <span><i class="bi bi-people-fill me-1"></i> Contactos & Clientes (${group.data.length})</span>
                            <a href="#/contactos?search=${encodeURIComponent(query)}" class="text-primary text-decoration-none gs-nav-item" style="font-size: 10px;">Ver todos en directorio &rarr;</a>
                        </div>
                        ${itemsHtml}
                    `;
                    break;
                }

                case 'facturas': {
                    const itemsHtml = group.data.map(item => {
                        const esCompra = item.tipo === 'compra';
                        const hash = esCompra ? `#/gastos/proveedores/ver/${item.id}` : `#/ingresos/facturas/ver/${item.id}`;
                        const badgeTipo = esCompra ? 'Compra' : 'Venta';
                        const label = `Factura de ${badgeTipo} #${item.numero}`;
                        const esCobrada = ['cobrada', 'pagada'].includes((item.estado || '').toLowerCase());
                        const clienteNombre = item.contactos?.nombre || 'Cliente General';

                        return `
                            <div class="dropdown-item py-2 px-3 border-bottom d-flex align-items-center justify-content-between gap-2 gs-nav-item" data-hash="${hash}" data-entity-title="${escapeHtml(label)}" data-entity-type="factura" data-entity-hash="${hash}" data-entity-subtitle="${escapeHtml(clienteNombre)} • ${fmtMoney(item.total)}" data-entity-icon="bi-receipt">
                                <a href="${hash}" class="flex-grow-1 text-decoration-none d-flex align-items-center gap-2" style="color: var(--text-main); min-width: 0;">
                                    <i class="bi bi-receipt-cutoff ${esCompra ? 'text-danger' : 'text-primary'}" style="font-size: 18px;"></i>
                                    <div class="text-truncate">
                                        <div class="fw-semibold text-truncate" style="color: var(--text-main); font-size: 13px;">Factura de ${badgeTipo} #${highlightMatches(String(item.numero), query)}</div>
                                        <div class="text-muted" style="font-size: 11px;">
                                            <span>${highlightMatches(clienteNombre, query)}</span> • <span>${item.fecha || 'Sin fecha'}</span>
                                        </div>
                                    </div>
                                </a>
                                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                                    <span class="fw-bold" style="color: var(--text-main); font-size: 13px;">${fmtMoney(item.total)}</span>
                                    <span class="badge ${esCobrada ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis'} rounded-pill" style="font-size: 10px;">
                                        ${escapeHtml(item.estado || 'pendiente')}
                                    </span>
                                </div>
                            </div>
                        `;
                    }).join('');

                    html += `
                        <div class="gs-section-header">
                            <span><i class="bi bi-receipt me-1"></i> Facturas (${group.data.length})</span>
                            <a href="#/ingresos/facturas?search=${encodeURIComponent(query)}" class="text-primary text-decoration-none gs-nav-item" style="font-size: 10px;">Ver facturas &rarr;</a>
                        </div>
                        ${itemsHtml}
                    `;
                    break;
                }

                case 'cotizaciones': {
                    const itemsHtml = group.data.map(item => {
                        const label = `Cotización #${item.numero}`;
                        const clienteNombre = item.contactos?.nombre || 'Cliente General';
                        const hash = `#/ingresos/cotizaciones/ver/${item.id}`;

                        return `
                            <a href="${hash}" class="dropdown-item py-2 px-3 border-bottom d-flex align-items-center justify-content-between gap-2 gs-nav-item text-decoration-none" style="color: var(--text-main);" data-entity-title="${escapeHtml(label)}" data-entity-type="cotizacion" data-entity-hash="${hash}" data-entity-subtitle="${escapeHtml(clienteNombre)} • ${fmtMoney(item.total)}" data-entity-icon="bi-file-earmark-text">
                                <div class="d-flex align-items-center gap-2 text-truncate">
                                    <i class="bi bi-file-earmark-text text-info" style="font-size: 18px;"></i>
                                    <div class="text-truncate">
                                        <div class="fw-semibold text-truncate" style="color: var(--text-main); font-size: 13px;">Cotización #${highlightMatches(String(item.numero), query)}</div>
                                        <div class="text-muted" style="font-size: 11px;">${highlightMatches(clienteNombre, query)} • ${item.fecha || ''}</div>
                                    </div>
                                </div>
                                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                                    <span class="fw-bold" style="color: var(--text-main); font-size: 13px;">${fmtMoney(item.total)}</span>
                                    <span class="badge bg-info-subtle text-info border border-info-subtle rounded-pill" style="font-size: 10px;">
                                        ${escapeHtml(item.estado || 'abierta')}
                                    </span>
                                </div>
                            </a>
                        `;
                    }).join('');

                    html += `
                        <div class="gs-section-header">
                            <span><i class="bi bi-file-earmark-text me-1"></i> Cotizaciones (${group.data.length})</span>
                            <a href="#/ingresos/cotizaciones?search=${encodeURIComponent(query)}" class="text-primary text-decoration-none gs-nav-item" style="font-size: 10px;">Ver cotizaciones &rarr;</a>
                        </div>
                        ${itemsHtml}
                    `;
                    break;
                }

                case 'productos': {
                    const itemsHtml = group.data.map(item => {
                        const stock = Number(item.stock !== undefined ? item.stock : 0);
                        const minStock = Number(item.stockMinimo ?? item.stock_minimo ?? 5);
                        const precio = Number(item.precioVenta ?? item.precio_venta ?? 0);
                        const hash = `#/inventario/items/ver/${item.id}`;
                        let stockBadge = '';

                        if (stock > minStock) {
                            stockBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill" style="font-size: 10px;"><i class="bi bi-check-circle me-1"></i>${stock} en stock</span>`;
                        } else if (stock > 0) {
                            stockBadge = `<span class="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill" style="font-size: 10px;"><i class="bi bi-exclamation-triangle me-1"></i>${stock} bajo stock</span>`;
                        } else {
                            stockBadge = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill" style="font-size: 10px;"><i class="bi bi-x-circle me-1"></i>Agotado (0)</span>`;
                        }

                        return `
                            <div class="dropdown-item py-2 px-3 border-bottom d-flex align-items-center justify-content-between gap-2 gs-card-producto">
                                <a href="${hash}" class="flex-grow-1 text-decoration-none d-flex align-items-center gap-2 gs-nav-item" style="color: var(--text-main); min-width: 0;" data-entity-title="${escapeHtml(item.nombre)}" data-entity-type="producto" data-entity-hash="${hash}" data-entity-subtitle="SKU: ${escapeHtml(item.sku || 'N/A')} • ${fmtMoney(precio)}" data-entity-icon="bi-box-seam">
                                    <i class="bi bi-box-seam text-primary" style="font-size: 18px;"></i>
                                    <div class="text-truncate">
                                        <div class="fw-semibold text-truncate" style="color: var(--text-main); font-size: 13px;">${highlightMatches(item.nombre, query)}</div>
                                        <div class="text-muted" style="font-size: 11px;">SKU / Ref: <span class="fw-medium" style="color: var(--text-main);">${highlightMatches(item.sku || 'N/A', query)}</span>${item.categoria ? ` • ${escapeHtml(item.categoria)}` : ''}</div>
                                    </div>
                                </a>
                                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                                    <div class="text-end">
                                        <div class="fw-bold" style="color: var(--text-main); font-size: 13px;">${fmtMoney(precio)}</div>
                                        ${stockBadge}
                                    </div>
                                    <div class="d-flex gap-1 ms-1">
                                        <a href="#/ingresos/facturas/nueva?productoId=${item.id}" class="gs-action-chip gs-chip-success gs-nav-item" title="Facturar este producto" data-entity-title="Facturar ${escapeHtml(item.nombre)}" data-entity-type="comando" data-entity-hash="#/ingresos/facturas/nueva?productoId=${item.id}" data-entity-icon="bi-cart-plus">
                                            <i class="bi bi-cart-plus"></i>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');

                    html += `
                        <div class="gs-section-header">
                            <span><i class="bi bi-box-seam me-1"></i> Productos & Inventario (${group.data.length})</span>
                            <a href="#/inventario/items?search=${encodeURIComponent(query)}" class="text-primary text-decoration-none gs-nav-item" style="font-size: 10px;">Ver catálogo &rarr;</a>
                        </div>
                        ${itemsHtml}
                    `;
                    break;
                }
            }
        });

        if (displayedCount === 0) {
            html += `
                <div class="p-4 text-center text-muted">
                    <i class="bi bi-search text-muted opacity-50" style="font-size: 2rem;"></i>
                    <div class="fw-semibold mt-2" style="font-size: 13.5px;">Sin coincidencias para "${escapeHtml(query)}"</div>
                    <div class="small text-muted mt-1" style="font-size: 11.5px;">Intenta buscando por nombre de cliente, NIT, número de factura o SKU de producto.</div>
                </div>
            `;
        }

        html += `
            <div class="gs-footer-hints">
                <span><kbd class="px-1 py-0 gs-kbd rounded">↑↓</kbd> Navegar • <kbd class="px-1 py-0 gs-kbd rounded">↵</kbd> Abrir • <kbd class="px-1 py-0 gs-kbd rounded">Tab</kbd> Filtrar • <kbd class="px-1 py-0 gs-kbd rounded">Esc</kbd> Cerrar</span>
                <span class="text-muted">${totalCount || displayedCount} resultado(s)</span>
            </div>
        `;

        this.renderDropdown(input, html);
        this.bindDropdownClicks(input);
    },

    seleccionarElemento(el, input) {
        if (!el) return;
        const entityTitle = el.dataset.entityTitle;
        const entityData = entityTitle ? {
            title: entityTitle,
            type: el.dataset.entityType || 'item',
            hash: el.dataset.entityHash || el.getAttribute('href') || '',
            subtitle: el.dataset.entitySubtitle || '',
            icon: el.dataset.entityIcon || 'bi-bookmark'
        } : (el.dataset.registrar || el.getAttribute('title') || input.value);

        this.registrarBusquedaExitosa(entityData);
        this.closeDropdown();
        input.value = '';
        input.closest('.gs-container')?.classList.remove('has-value');

        const targetHref = el.getAttribute('href') || el.dataset.hash || el.dataset.entityHash || el.querySelector('a')?.getAttribute('href');
        if (targetHref && targetHref.startsWith('#')) {
            window.location.hash = targetHref;
        }
    },

    bindDropdownClicks(input) {
        const dropdown = document.getElementById('global-search-results');
        if (!dropdown) return;

        // Clics en pestañas / chips de filtro
        dropdown.querySelectorAll('.gs-filter-chip').forEach(chip => {
            chip.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const filter = chip.getAttribute('data-filter');
                if (filter) this.setFilter(filter, input);
            });
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Clics en elementos navegables
        const items = dropdown.querySelectorAll('a[href], .gs-nav-item');
        items.forEach(el => {
            if (el.classList.contains('gs-filter-chip')) return;
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.seleccionarElemento(el, input);
            };
            el.addEventListener('mousedown', handler);
            el.addEventListener('click', handler);
        });
    },

    renderDropdown(input, htmlContent) {
        let dropdown = document.getElementById('global-search-results');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'global-search-results';
            input.parentElement.appendChild(dropdown);
        }
        dropdown.innerHTML = htmlContent;
        dropdown.style.display = 'block';
    },

    closeDropdown() {
        const dropdown = document.getElementById('global-search-results');
        if (dropdown) dropdown.style.display = 'none';
        this.activeIndex = -1;
    },

    clear() {
        const input = document.getElementById('global-search');
        if (input) {
            input.value = '';
            input.parentElement?.classList.remove('has-value');
        }
        this.currentFilter = 'todos';
        this.cachedGroups = [];
        this.cachedQuery = '';
        this.closeDropdown();
    }
};
