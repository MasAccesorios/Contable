/**
 * SPA Shell Router - MAS Accesorios
 * Arquitectura Vanilla JS (Sin dependencias externas)
 */
import { auth, onAuthStateChanged, signOut } from './firebase.js';
import { renderLogin } from './login.js';


window.cleanupFloatingElements = function() {
    document.querySelectorAll('.dropdown-menu, .row-actions-menu, .desc-popover, .search-results-dropdown').forEach(el => el.remove());
};

const routes = {
    'inicio': () => import('../modules/dashboard.js'),
    'contactos': () => import('../modules/clientes/clientes.js'),
    'bancos': () => import('../modules/bancos/bancos.js'),
    'gastos/pagos': () => import('../modules/gastos/gastos.js'),
    'inventario/items': () => import('../modules/productos/productos.js'),
    'inventario/valor': () => import('../modules/inventario/valorizacion.js'),
    'importador': () => import('../modules/integracion-alegra/importador.js'),
    'ingresos/cotizaciones': () => import('../modules/ingresos/cotizaciones.js'),
    'ingresos/facturas': () => import('../modules/ventas/ventas.js'),
    'cartera': () => import('../modules/cartera/cartera.js'),
    'reportes': () => import('../modules/reportes.js'),
    // Soporte para alias de compatibilidad con módulos anteriores
    'dashboard': () => import('../modules/dashboard.js'),
    'tesoreria': () => import('../modules/bancos/bancos.js')
};

async function router() {
    const hash = window.location.hash.substring(2) || 'inicio';
    const appEl = document.getElementById('view-viewport');
    if (!appEl) return;

    // Actualizar estado activo en el menú lateral
    document.querySelectorAll('#sidebar a').forEach(link => {
        const href = link.getAttribute('href');
        // Usamos includes para soportar tanto #/inicio como #/inicio/
        if (href === '#/' + hash) {
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
        if (hash === key || hash.startsWith(key + '/')) {
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
                await initFn(appEl);
            } else {
                renderPlaceholder(appEl, hash, "El módulo se cargó correctamente, pero no expone un método init().");
            }
        } catch (err) {
            console.error('Error al instanciar el módulo:', err);
            renderPlaceholder(appEl, hash, `Error de Carga: ${err.message}`);
        }
    } else {
        // Generador automático de Placeholders
        renderPlaceholder(appEl, hash, "Esta vista base está configurada correctamente y lista para ser desarrollada.");
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

    // Auto-cerrar sidebar en móvil al hacer clic en cualquier enlace
    document.querySelectorAll('#sidebar a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    });
}

// Escuchadores globales de navegación y carga
window.addEventListener('hashchange', () => {
    // Proteger cambios de ruta directos en la barra del navegador
    if (auth.currentUser) {
        router();
    }
});

window.addEventListener('DOMContentLoaded', () => {
    initUI();
    
    const sidebar = document.getElementById('sidebar');
    const navbar = document.getElementById('navbar');
    const viewport = document.getElementById('view-viewport');

    // Firebase Auth Observer (El verdadero guardián de las rutas)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuario Autenticado: Restauramos la UI normal
            sidebar.style.display = 'block'; 
            navbar.style.display = 'flex';
            document.getElementById('app-container').classList.remove('unauthenticated');
            
            // Dejamos que el enrutador lea la URL actual y cargue el módulo
            router(); 
        } else {
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
