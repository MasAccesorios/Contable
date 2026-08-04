/**
 * SPA Shell Router - MAS Accesorios
 * Arquitectura Vanilla JS (Sin dependencias externas)
 */
import { supabase } from './supabase.js';
import { renderLogin } from './login.js';
import { GlobalSearch } from '../shared/globalSearch.js';
import { QuickActions } from '../shared/quickActions.js';


window.cleanupFloatingElements = function() {
    document.querySelectorAll('.dropdown-menu, .row-actions-menu, .desc-popover, .search-results-dropdown').forEach(el => el.remove());
};

// Listener global ÚNICO para cerrar menús contextuales de filas (.row-action-menu)
// Registrado una sola vez aquí en lugar de re-registrarse en cada renderList() de facturas/cotizaciones.
document.addEventListener('click', (e) => {
    const menu = document.querySelector('.row-action-menu');
    if (menu && !e.target.closest('.row-action-menu') && !e.target.closest('.btn-menu-row')) {
        menu.remove();
    }
});

// Listener global ÚNICO para cerrar dropdowns de autocompletado de items (.search-results-dropdown)
// Registrado una sola vez aquí en lugar de re-registrarse por cada fila de producto en crud.js.
document.addEventListener('click', (e) => {
    document.querySelectorAll('.search-results-dropdown').forEach(dropdown => {
        const tr = dropdown.closest('tr');
        if (tr && !tr.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
});

const routes = {
    'inicio': () => import('../modules/dashboard.js'),
    'contactos': () => import('../modules/clientes/clientes.js'),
    'bancos': () => import('../modules/bancos/bancos.js'),
    'gastos/pagos': () => import('../modules/gastos/gastos.js'),
    'gastos/proveedores': () => import('../modules/gastos/compras.js'),
    'inventario/items': () => import('../modules/productos/productos.js'),
    'inventario/valor': () => import('../modules/inventario/valorizacion.js'),
    'importador': () => import('../modules/integracion-alegra/importador.js'),
    'ingresos/cotizaciones': () => import('../modules/ingresos/cotizaciones.js'),
    'ingresos/operativos': () => import('../modules/gastos/ingresos_operativos.js'),
    'ingresos/facturas': () => import('../modules/ventas/ventas.js'),
    'ingresos/pagos/nuevo': () => import('../modules/ingresos/pagos_nuevo.js'),
    'cartera': () => import('../modules/cartera/cartera.js'),
    'bancos/conciliacion': () => import('../modules/bancos/conciliacion.js'),
    'bancos/detalle': () => import('../modules/bancos/detalle.js'),
    'reportes': () => import('../modules/reportes.js'),
    'configuracion': () => import('../modules/configuracion.js'),
    // Soporte para alias de compatibilidad con módulos anteriores
    'dashboard': () => import('../modules/dashboard.js'),
    'tesoreria': () => import('../modules/bancos/bancos.js')
};

async function router() {
    // Cerrar sidebar en móviles automáticamente ante cualquier cambio de ruta
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.remove('open');
    }

    GlobalSearch.clear();

    const hash = window.location.hash.substring(2) || 'inicio';
    const [routePath, queryString] = hash.split('?');
    const appEl = document.getElementById('view-viewport');
    if (!appEl) return;

    // Actualizar estado activo en el menú lateral
    document.querySelectorAll('#sidebar a').forEach(link => {
        const href = link.getAttribute('href');
        // Usamos includes para soportar tanto #/inicio como #/inicio/
        if (href === '#/' + routePath) {
            link.classList.add('active');
            
            // Si está dentro de un submenú, mantener abierto el padre
            const parentDropdown = link.closest('.menu-dropdown');
            if (parentDropdown) {
                parentDropdown.classList.add('open');
            }
        } else {
            link.classList.remove('active');
        }
    });

    let matchRoute = null;
    let matchKey = '';
    
    // Buscar la ruta más específica que coincida con el hash (permite sub-rutas como /nueva o /editar/123)
    for (const key of Object.keys(routes)) {
        if (routePath === key || routePath.startsWith(key + '/')) {
            if (key.length > matchKey.length) {
                matchKey = key;
                matchRoute = routes[key];
            }
        }
    }

    if (matchRoute) {
        try {
            const module = await matchRoute();
            
            let initFn = null;
            if (typeof module.init === 'function') {
                initFn = module.init;
            } else {
                for (const key of Object.keys(module)) {
                    if (module[key] && typeof module[key].init === 'function') {
                        initFn = module[key].init.bind(module[key]);
                        break;
                    }
                }
            }

            if (initFn) {
                if (typeof window.cleanupFloatingElements === 'function') {
                    window.cleanupFloatingElements();
                }
                
                // 1. Resetear el flag incondicionalmente al cargar una vista nueva (previene falsos positivos)
                window.hayCambiosSinGuardar = false;
                
                // 2. Clonar nodo para purgar event listeners acumulados del módulo anterior (memory leak fix)
                const newAppEl = appEl.cloneNode(false);
                appEl.parentNode.replaceChild(newAppEl, appEl);

                await initFn(newAppEl);
            } else {
                renderPlaceholder(appEl, routePath, "El módulo se cargó correctamente, pero no expone un método init().");
            }
        } catch (err) {
            console.error('Error al instanciar el módulo:', err);
            // IMPORTANTE: usar newAppEl (si existe) o appEl, porque appEl pudo haber sido reemplazado
            const targetEl = document.getElementById('view-viewport') || appEl;
            renderPlaceholder(targetEl, routePath, `Error de Carga: ${err.message}`);
        }
    } else {
        // Generador automático de Placeholders
        renderPlaceholder(appEl, routePath, "Esta vista base está configurada correctamente y lista para ser desarrollada.");
    }
}

function renderPlaceholder(container, hash, message) {
    // Formatear el texto de la ruta para mostrarlo como título
    const routeParts = hash.split('/');
    const title = routeParts[routeParts.length - 1]
                    .replace(/-/g, ' ')
                    .replace(/^\w/, c => c.toUpperCase());
                    
    container.innerHTML = `
        <div class="placeholder-container">
            <h1 style="font-size: 48px; margin-bottom: 20px;">🚧</h1>
            <h3 style="color: #1e293b;">Módulo: ${title}</h3>
            <p style="color: #64748b; margin-top: 10px;">${message}</p>
        </div>
    `;
}

// Inicialización de interacciones Vanilla JS
function initUI() {
    // Lógica para desplegables (Dropdowns)
    const dropdownTriggers = document.querySelectorAll('.dropdown-trigger');
    dropdownTriggers.forEach(trigger => {
        trigger.addEventListener('click', function() {
            const parent = this.closest('.menu-dropdown');
            parent.classList.toggle('open');
        });
    });

    // Lógica para el toggle del Sidebar en Móviles
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

}

// Guardián estricto para clicks en menús/enlaces (Evita la navegación asíncrona)
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#/"]');
    if (link && window.hayCambiosSinGuardar) {
        const resultado = confirm('Tienes cambios sin guardar. ¿Deseas salir de todas formas?');
        if (!resultado) {
            e.preventDefault();
            e.stopImmediatePropagation();
        } else {
            window.hayCambiosSinGuardar = false;
        }
    }
}, { capture: true });

// Escuchadores globales de navegación y carga
let currentHash = window.location.hash;
let isRevertingHash = false;

window.addEventListener('hashchange', async () => {
    if (isRevertingHash) {
        isRevertingHash = false;
        return;
    }
    
    if (window.hayCambiosSinGuardar) {
        const resultado = confirm('Tienes cambios sin guardar. ¿Deseas salir de todas formas?');
        if (!resultado) {
            isRevertingHash = true;
            window.location.hash = currentHash;
            return;
        }
        window.hayCambiosSinGuardar = false;
    }
    currentHash = window.location.hash;

    // Proteger cambios de ruta directos en la barra del navegador
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        router();
    }
});

// Proteger al recargar o cerrar pestaña
window.addEventListener('beforeunload', (e) => {
    if (window.hayCambiosSinGuardar) {
        e.preventDefault();
        e.returnValue = '';
    }
});

window.addEventListener('DOMContentLoaded', () => {
    initUI();
    GlobalSearch.init();
    QuickActions.init();
    
    const sidebar = document.getElementById('sidebar');
    const navbar = document.getElementById('navbar');
    const viewport = document.getElementById('view-viewport');

    let yaHuboSesionInicial = false;

    // Monitorear sesión centralizadamente
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            // Usuario Autenticado: Restauramos la UI normal
            sidebar.style.display = 'block'; 
            navbar.style.display = 'flex';
            document.getElementById('app-container').classList.remove('unauthenticated');
            
            // Dejamos que el enrutador lea la URL actual y cargue el módulo
            // SOLO si es la primera vez que se detecta sesión
            if (!yaHuboSesionInicial) {
                yaHuboSesionInicial = true;
                router(); 
            }
        } else {
            yaHuboSesionInicial = false;
            // Usuario No Autenticado
            // Ocultamos el cascarón de la app y liberamos el margen del sidebar
            sidebar.style.display = 'none';
            navbar.style.display = 'none';
            document.getElementById('app-container').classList.add('unauthenticated');
            
            // Limpiamos la URL
            if (window.location.hash !== '') {
                window.history.replaceState(null, null, ' '); 
            }

            // Inyectamos el módulo de Login
            renderLogin(viewport);
        }
    });
});
