import { supabase } from '../core/supabase.js';
import { escapeHtml } from './formatters.js';

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

        // 1. Envolver el input en un contenedor relativo para ubicar el dropdown y hint de atajo
        let wrapper = input.closest('.gs-container');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'gs-container position-relative flex-grow-1 d-flex align-items-center';
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);
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
            }, 300);
        });

        // 6. Navegación por teclado en dropdown (Flechas, Enter, Escape)
        input.addEventListener('keydown', (e) => {
            const dropdown = document.getElementById('global-search-results');
            const isDropdownVisible = dropdown && dropdown.style.display !== 'none';

            if (e.key === 'Escape') {
                this.closeDropdown();
                input.blur();
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

    registrarBusquedaExitosa(query) {
        const key = (query || '').trim();
        if (!key || key.length < 2) return;

        let historial = this.getFrecuentes();
        historial = historial.filter(q => q.toLowerCase() !== key.toLowerCase());
        historial.unshift(key);
        historial = historial.slice(0, MAX_STORED);
        try {
            localStorage.setItem(FREQ_STORAGE_KEY, JSON.stringify(historial));
        } catch (e) {
            console.warn('[GlobalSearch] Error guardando historial:', e);
        }
    },

    eliminarFrecuente(query) {
        const historial = this.getFrecuentes().filter(q => q.toLowerCase() !== query.toLowerCase());
        localStorage.setItem(FREQ_STORAGE_KEY, JSON.stringify(historial));
    },

    limpiarFrecuentes() {
        localStorage.removeItem(FREQ_STORAGE_KEY);
    },

    renderFrecuentes(input) {
        const top = this.getFrecuentes().slice(0, MAX_SHOWN);

        // Si no hay búsquedas frecuentes, mostrar sugerencias de accesos rápidos
        if (top.length === 0) {
            const sugerenciasHtml = SYSTEM_COMMANDS.slice(0, 4).map(cmd => `
                <a href="${cmd.hash}" class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 gs-nav-item text-decoration-none text-dark" data-registrar="${escapeHtml(cmd.title)}">
                    <i class="bi ${cmd.icon} text-primary" style="font-size: 15px;"></i>
                    <div class="flex-grow-1">
                        <div class="fw-medium" style="font-size: 13px;">${escapeHtml(cmd.title)}</div>
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
                    <kbd class="px-1 py-0 bg-white border rounded">Esc</kbd>
                </div>
            `;
            this.renderDropdown(input, html);
            this.bindDropdownClicks(input);
            return;
        }

        const itemsHtml = top.map(query => `
            <div class="dropdown-item py-2 gs-frecuente-item px-3 d-flex align-items-center justify-content-between gap-2 gs-nav-item">
                <a href="javascript:void(0)" class="gs-frecuente-link flex-grow-1 d-flex align-items-center gap-2 text-decoration-none text-dark" data-query="${escapeHtml(query)}" style="min-width: 0;">
                    <i class="bi bi-clock-history text-muted" style="font-size: 13px;"></i>
                    <span style="font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(query)}</span>
                </a>
                <button type="button" class="btn btn-sm btn-link text-muted p-0 gs-frecuente-borrar" data-query="${escapeHtml(query)}" title="Quitar de frecuentes" style="line-height: 1;">
                    <i class="bi bi-x-lg" style="font-size: 11px;"></i>
                </button>
            </div>
        `).join('');

        const html = `
            <div class="gs-section-header">
                <span>Búsquedas recientes</span>
                <a href="javascript:void(0)" class="gs-frecuente-limpiar-todo text-muted text-decoration-none" style="font-size: 11px;">Borrar historial</a>
            </div>
            ${itemsHtml}
            <div class="gs-footer-hints">
                <span>Selecciona con flechas o presiona Enter</span>
                <kbd class="px-1 py-0 bg-white border rounded">↑↓</kbd>
            </div>
        `;

        this.renderDropdown(input, html);
        this.activeIndex = -1;

        document.querySelectorAll('.gs-frecuente-link').forEach(l => {
            l.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const query = l.getAttribute('data-query');
                input.value = query;
                this.performSearch(query, input, true);
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
        const searchToken = Date.now();
        this.currentSearchToken = searchToken;
        this.activeIndex = -1;

        this.renderDropdown(input, `
            <div class="p-3 text-center text-muted small">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                Buscando clientes, facturas, cotizaciones y productos...
            </div>
        `);

        // Extraer números limpios si existen (soporta "#1042", "FE-1042", "1042")
        const numDigits = query.replace(/\D/g, '');
        const hasDigits = numDigits.length > 0;
        const numValue = hasDigits ? parseInt(numDigits, 10) : null;
        const qLower = query.toLowerCase();

        // 1. Filtrar Comandos del Sistema
        const matchingCommands = SYSTEM_COMMANDS.filter(cmd => 
            cmd.title.toLowerCase().includes(qLower) || 
            cmd.keywords.some(k => k.includes(qLower) || qLower.includes(k))
        ).slice(0, 3);

        // Sanitizar query para sintaxis PostgREST (elimina comas, comillas y paréntesis que rompen .or())
        const safeQuery = query.replace(/[,()"\\]/g, ' ').trim();

        const promises = [];

        // 2. Consulta de Contactos (Clientes / Proveedores por Nombre, NIT, Email o Teléfono)
        promises.push(
            supabase.from('contactos')
                .select('id, nombre, identificacion, email, telefono, tipo, es_cliente, es_proveedor')
                .neq('estado', 'inactive')
                .or(`nombre.ilike.%${safeQuery}%,identificacion.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,telefono.ilike.%${safeQuery}%`)
                .limit(4)
                .then(res => ({ type: 'contactos', data: res.data || [] }))
                .catch(err => { console.error('[GlobalSearch] Error buscando contactos:', err); return { type: 'contactos', data: [] }; })
        );

        // 3. Consulta de Productos (Inventario con stock real calculado por FIFO y búsqueda por nombre o SKU)
        promises.push(
            supabase.rpc('get_productos_page_v2', {
                p_page: 1,
                p_limit: 5,
                p_sort_column: 'nombre',
                p_sort_direction: 'asc',
                p_search_query: safeQuery,
                p_filter_criteria: 'todos'
            })
            .then(res => {
                if (res.error) throw res.error;
                const raw = res.data;
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                const items = (parsed?.data || []).map(p => ({
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
                return { type: 'productos', data: items };
            })
            .catch(async (err) => {
                console.warn('[GlobalSearch] RPC get_productos_page_v2 falló, usando fallback defensivo:', err);
                try {
                    const { data: prods, error: pErr } = await supabase.from('productos')
                        .select('id, nombre, sku, precio_venta, costo_base, stock_minimo, estado')
                        .or(`nombre.ilike.%${safeQuery}%,sku.ilike.%${safeQuery}%`)
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

        // 4. Consulta de Facturas (Si hay número, buscar directamente)
        if (hasDigits && numValue) {
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

        // Si se solicitó autoNavegación (ej. al presionar Enter sobre 1 único resultado)
        if (autoNavigate) {
            let totalItems = 0;
            let firstActionHash = null;

            if (contactos.length === 1) {
                firstActionHash = `#/contactos/ver/${contactos[0].id}?search=${encodeURIComponent(contactos[0].nombre)}`;
                totalItems = 1;
            } else if (facturasGroup.data.length === 1 && contactos.length === 0) {
                firstActionHash = `#/ingresos/facturas/ver/${facturasGroup.data[0].id}`;
                totalItems = 1;
            } else if (productosGroup?.data.length === 1 && contactos.length === 0) {
                firstActionHash = `#/inventario/items/ver/${productosGroup.data[0].id}`;
                totalItems = 1;
            }

            if (totalItems === 1 && firstActionHash) {
                this.registrarBusquedaExitosa(query);
                this.closeDropdown();
                input.value = '';
                window.location.hash = firstActionHash;
                return;
            }
        }

        this.displayResults(input, finalResults, query);
    },

    displayResults(input, groups, query) {
        let html = '';
        let totalCount = 0;

        groups.forEach(group => {
            if (!group || !group.data || group.data.length === 0) return;
            totalCount += group.data.length;

            switch (group.type) {
                case 'comandos': {
                    const itemsHtml = group.data.map(cmd => `
                        <a href="${cmd.hash}" class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 gs-nav-item text-decoration-none text-dark" data-registrar="${escapeHtml(cmd.title)}">
                            <i class="bi ${cmd.icon} text-primary" style="font-size: 15px;"></i>
                            <div class="flex-grow-1">
                                <div class="fw-medium" style="font-size: 13px;">${escapeHtml(cmd.title)}</div>
                                <div class="text-muted" style="font-size: 11px;">${escapeHtml(cmd.desc)}</div>
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
                                <div class="mt-2 p-2 bg-light bg-opacity-75 rounded-2 border" style="font-size: 11.5px;">
                                    <div class="text-muted fw-bold mb-1 d-flex justify-content-between align-items-center" style="font-size: 10px; text-transform: uppercase;">
                                        <span><i class="bi bi-receipt me-1"></i> Facturas de ${escapeHtml(item.nombre)}:</span>
                                        <a href="#/ingresos/facturas?search=${encodeURIComponent(item.nombre)}" class="text-primary text-decoration-none gs-nav-item" style="font-size: 10px;">Ver todas (${item.facturasRecientes.length}) &rarr;</a>
                                    </div>
                                    <div class="d-flex flex-column gap-1">
                                        ${item.facturasRecientes.slice(0, 3).map(f => {
                                            const esCobrada = ['cobrada', 'pagada'].includes((f.estado || '').toLowerCase());
                                            return `
                                                <a href="#/ingresos/facturas/ver/${f.id}" class="d-flex justify-content-between align-items-center py-1 px-2 text-decoration-none text-dark gs-nav-item rounded bg-white border" data-registrar="Factura #${f.numero}">
                                                    <span><strong>Factura #${f.numero}</strong> <span class="text-muted small">(${f.fecha || 'Sin fecha'})</span></span>
                                                    <span class="d-flex align-items-center gap-2">
                                                        <span class="fw-semibold">${fmtMoney(f.total)}</span>
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
                                            <div class="fw-bold text-dark text-truncate" style="font-size: 13.5px;">${escapeHtml(item.nombre)}</div>
                                            <div class="text-muted small d-flex align-items-center gap-1" style="font-size: 11px;">
                                                <span>NIT: ${escapeHtml(item.identificacion || 'Sin NIT')}</span>
                                                ${item.telefono ? `<span>• Tel: ${escapeHtml(item.telefono)}</span>` : ''}
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
                                    <a href="#/ingresos/facturas?search=${encodeURIComponent(item.nombre)}" class="gs-action-chip gs-nav-item" title="Ver sólo las facturas de este cliente" data-registrar="${escapeHtml(item.nombre)}">
                                        <i class="bi bi-receipt text-primary"></i> Ver Facturas
                                    </a>
                                    <a href="#/contactos/ver/${item.id}?search=${encodeURIComponent(item.nombre)}" class="gs-action-chip gs-nav-item" title="Abrir perfil 360° y cartera" data-registrar="${escapeHtml(item.nombre)}">
                                        <i class="bi bi-person-vcard text-secondary"></i> Ficha 360°
                                    </a>
                                    <a href="#/ingresos/facturas/nueva?clienteId=${item.id}" class="gs-action-chip gs-chip-success gs-nav-item" title="Crear nueva factura de venta para este cliente" data-registrar="${escapeHtml(item.nombre)}">
                                        <i class="bi bi-plus-circle-fill text-success"></i> Facturar
                                    </a>
                                    <a href="#/ingresos/pagos/nuevo?clienteId=${item.id}" class="gs-action-chip gs-nav-item" title="Registrar recibo de caja / abono" data-registrar="${escapeHtml(item.nombre)}">
                                        <i class="bi bi-cash-coin text-warning"></i> Cobrar
                                    </a>
                                    <a href="#/ingresos/cotizaciones/nueva?clienteId=${item.id}" class="gs-action-chip gs-nav-item" title="Crear cotización comercial" data-registrar="${escapeHtml(item.nombre)}">
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
                            <div class="dropdown-item py-2 px-3 border-bottom d-flex align-items-center justify-content-between gap-2 gs-nav-item" data-hash="${hash}" data-registrar="${escapeHtml(label)}">
                                <a href="${hash}" class="flex-grow-1 text-decoration-none text-dark d-flex align-items-center gap-2" style="min-width: 0;">
                                    <i class="bi bi-receipt-cutoff ${esCompra ? 'text-danger' : 'text-primary'}" style="font-size: 18px;"></i>
                                    <div class="text-truncate">
                                        <div class="fw-semibold text-truncate" style="font-size: 13px;">${label}</div>
                                        <div class="text-muted" style="font-size: 11px;">
                                            <span>${escapeHtml(clienteNombre)}</span> • <span>${item.fecha || 'Sin fecha'}</span>
                                        </div>
                                    </div>
                                </a>
                                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                                    <span class="fw-bold text-dark" style="font-size: 13px;">${fmtMoney(item.total)}</span>
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

                        return `
                            <a href="#/ingresos/cotizaciones/ver/${item.id}" class="dropdown-item py-2 px-3 border-bottom d-flex align-items-center justify-content-between gap-2 gs-nav-item text-decoration-none text-dark" data-registrar="${escapeHtml(label)}">
                                <div class="d-flex align-items-center gap-2 text-truncate">
                                    <i class="bi bi-file-earmark-text text-info" style="font-size: 18px;"></i>
                                    <div class="text-truncate">
                                        <div class="fw-semibold text-truncate" style="font-size: 13px;">${label}</div>
                                        <div class="text-muted" style="font-size: 11px;">${escapeHtml(clienteNombre)} • ${item.fecha || ''}</div>
                                    </div>
                                </div>
                                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                                    <span class="fw-bold" style="font-size: 13px;">${fmtMoney(item.total)}</span>
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
                                <a href="#/inventario/items/ver/${item.id}" class="flex-grow-1 text-decoration-none text-dark d-flex align-items-center gap-2 gs-nav-item" style="min-width: 0;" data-registrar="${escapeHtml(item.nombre)}">
                                    <i class="bi bi-box-seam text-primary" style="font-size: 18px;"></i>
                                    <div class="text-truncate">
                                        <div class="fw-semibold text-truncate" style="font-size: 13px;">${escapeHtml(item.nombre)}</div>
                                        <div class="text-muted" style="font-size: 11px;">SKU / Ref: <span class="fw-medium text-dark">${escapeHtml(item.sku || 'N/A')}</span>${item.categoria ? ` • ${escapeHtml(item.categoria)}` : ''}</div>
                                    </div>
                                </a>
                                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                                    <div class="text-end">
                                        <div class="fw-bold text-dark" style="font-size: 13px;">${fmtMoney(precio)}</div>
                                        ${stockBadge}
                                    </div>
                                    <div class="d-flex gap-1 ms-1">
                                        <a href="#/ingresos/facturas/nueva?productoId=${item.id}" class="gs-action-chip gs-chip-success gs-nav-item" title="Facturar este producto">
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

        if (totalCount === 0) {
            html = `
                <div class="p-4 text-center text-muted">
                    <i class="bi bi-search text-muted opacity-50" style="font-size: 2rem;"></i>
                    <div class="fw-semibold mt-2" style="font-size: 13.5px;">Sin coincidencias para "${escapeHtml(query)}"</div>
                    <div class="small text-muted mt-1" style="font-size: 11.5px;">Intenta buscando por nombre de cliente, NIT, número de factura o SKU de producto.</div>
                </div>
            `;
        }

        html += `
            <div class="gs-footer-hints">
                <span><kbd class="px-1 py-0 bg-white border rounded">↑↓</kbd> Navegar • <kbd class="px-1 py-0 bg-white border rounded">↵</kbd> Abrir • <kbd class="px-1 py-0 bg-white border rounded">Esc</kbd> Cerrar</span>
                <span class="text-muted">${totalCount} resultado(s)</span>
            </div>
        `;

        this.renderDropdown(input, html);
        this.bindDropdownClicks(input);
    },

    seleccionarElemento(el, input) {
        if (!el) return;
        const registrar = el.dataset.registrar || el.getAttribute('title') || input.value;
        this.registrarBusquedaExitosa(registrar);
        this.closeDropdown();
        input.value = '';

        const targetHref = el.getAttribute('href') || el.dataset.hash || el.querySelector('a')?.getAttribute('href');
        if (targetHref && targetHref !== 'javascript:void(0)') {
            if (targetHref.startsWith('#')) {
                window.location.hash = targetHref;
            } else {
                window.location.href = targetHref;
            }
        }
    },

    bindDropdownClicks(input) {
        const items = document.querySelectorAll('#global-search-results a[href], #global-search-results .gs-nav-item');
        items.forEach(el => {
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
        this.closeDropdown();
    }
};
