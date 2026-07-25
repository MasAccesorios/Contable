// js/db.js
// Módulo de persistencia local indexada y sincronización para MAS Accesorios

import { db, collection, doc, getDoc, getDocs, setDoc, deleteDoc } from './firebase.js';

const DB_NAME = 'MasAccesoriosDB';
const DB_VERSION = 3;
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

                // 7. Pagos / Recibos de caja
                if (!db.objectStoreNames.contains('pagos')) {
                    const store = db.createObjectStore('pagos', { keyPath: 'id' });
                    store.createIndex('by_cliente', 'clienteId', { unique: false });
                    store.createIndex('by_fecha', 'fecha', { unique: false });
                }

                // 8. Gastos Operativos
                if (!db.objectStoreNames.contains('gastos')) {
                    const store = db.createObjectStore('gastos', { keyPath: 'id' });
                    store.createIndex('by_cuenta', 'cuentaId', { unique: false });
                    store.createIndex('by_fecha', 'fecha', { unique: false });
                    store.createIndex('by_categoria', 'categoria', { unique: false });
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
     * Si storeName es 'productos', persiste en Firestore; el resto usa IndexedDB.
     */
    async save(storeName, data) {
        if (!data.id) throw new Error(`El registro debe contener un ID único para persistencia en ${storeName}.`);

        if (storeName === 'productos') {
            const ref = doc(db, 'productos', data.id);
            await setDoc(ref, data);
            return data;
        }

        const idb = await this.init();
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(data);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    /**
     * Obtiene un registro por su ID único.
     * Si storeName es 'productos', lee desde Firestore; el resto usa IndexedDB.
     */
    async get(storeName, id) {
        if (storeName === 'productos') {
            const ref = doc(db, 'productos', id);
            const snap = await getDoc(ref);
            return snap.exists() ? snap.data() : null;
        }

        const idb = await this.init();
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    /**
     * Obtiene todos los registros de un almacén específico.
     * Si storeName es 'productos', usa getDocs() (lectura puntual); el resto usa IndexedDB.
     */
    async getAll(storeName) {
        if (storeName === 'productos') {
            const snap = await getDocs(collection(db, 'productos'));
            return snap.docs.map(d => d.data());
        }

        const idb = await this.init();
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    /**
     * Elimina un registro por su ID único.
     * Si storeName es 'productos', elimina en Firestore; el resto usa IndexedDB.
     */
    async delete(storeName, id) {
        if (storeName === 'productos') {
            await deleteDoc(doc(db, 'productos', id));
            return true;
        }

        const idb = await this.init();
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    }
};

// Autoejecución preventiva para asegurar la disponibilidad del esquema global
DB.init().catch(err => console.error("Fallo automáico de inicialización DB:", err));

export default DB;