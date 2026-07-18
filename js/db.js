// js/db.js
// Módulo de persistencia local indexada y sincronización para MAS Accesorios

const DB_NAME = 'MasAccesoriosDB';
const DB_VERSION = 1;
let dbInstance = null;

const DB = {
    /**
     * Inicializa IndexedDB creando los almacenes de datos necesarios.
     */
    init() {
        return new Promise((resolve, reject) => {
            if (dbInstance) return resolve(dbInstance);

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;

                // 1. Almacén de Contactos (Clientes y Proveedores)
                if (!db.objectStoreNames.contains('contactos')) {
                    const store = db.createObjectStore('contactos', { keyPath: 'id' });
                    store.createIndex('by_nit', 'nit', { unique: false });
                    store.createIndex('by_tipo', 'tipo', { unique: false }); // 'cliente' o 'proveedor'
                }

                // 2. Almacén de Productos e Inventarios
                if (!db.objectStoreNames.contains('productos')) {
                    const store = db.createObjectStore('productos', { keyPath: 'id' });
                    store.createIndex('by_sku', 'sku', { unique: true });
                }

                // 3. Almacén de Lotes FIFO para tracking de costos reales
                if (!db.objectStoreNames.contains('lotes_fifo')) {
                    const store = db.createObjectStore('lotes_fifo', { keyPath: 'id' });
                    store.createIndex('by_producto', 'productoId', { unique: false });
                }

                // 4. Almacén de Cotizaciones
                if (!db.objectStoreNames.contains('cotizaciones')) {
                    const store = db.createObjectStore('cotizaciones', { keyPath: 'id' });
                    store.createIndex('by_cliente', 'clienteId', { unique: false });
                    store.createIndex('by_estado', 'estado', { unique: false });
                }

                // 5. Almacén de Facturas y Cuentas por Cobrar/Pagar
                if (!db.objectStoreNames.contains('facturas')) {
                    const store = db.createObjectStore('facturas', { keyPath: 'id' });
                    store.createIndex('by_contacto', 'contactoId', { unique: false });
                    store.createIndex('by_tipo', 'tipo', { unique: false }); // 'venta' o 'compra'
                    store.createIndex('by_estado', 'estado', { unique: false }); // 'paga', 'parcial', 'por_pagar'
                }

                // 6. Almacén de Transacciones de Caja y Bancos
                if (!db.objectStoreNames.contains('transacciones')) {
                    const store = db.createObjectStore('transacciones', { keyPath: 'id' });
                    store.createIndex('by_cuenta', 'cuentaId', { unique: false });
                    store.createIndex('by_fecha', 'fecha', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                dbInstance = e.target.result;
                console.log("IndexedDB inicializada con éxito.");
                resolve(dbInstance);
            };

            request.onerror = (e) => {
                console.error("Error crítico abriendo IndexedDB:", e.target.error);
                reject(e.target.error);
            };
        });
    },

    /**
     * Guarda o actualiza un registro de forma idempotente en un almacén.
     */
    async save(storeName, data) {
        if (!data.id) throw new Error(`El registro debe contener un ID único para persistencia en ${storeName}.`);
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(data);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    /**
     * Obtiene un registro por su ID único.
     */
    async get(storeName, id) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    /**
     * Obtiene todos los registros de un almacén específico.
     */
    async getAll(storeName) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    }
};

// Autoejecución preventiva para asegurar la disponibilidad del esquema global
DB.init().catch(err => console.error("Fallo automáico de inicialización DB:", err));

export default DB;