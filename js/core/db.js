// js/db.js
// MÃ³dulo de persistencia local indexada y sincronizaciÃ³n para MAS Accesorios

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

                // 1. AlmacÃ©n de Contactos (Clientes y Proveedores)
                if (!db.objectStoreNames.contains('contactos')) {
                    const store = db.createObjectStore('contactos', { keyPath: 'id' });
                    store.createIndex('by_nit', 'nit', { unique: false });
                    store.createIndex('by_tipo', 'tipo', { unique: false }); // 'cliente' o 'proveedor'
                }

                // 2. AlmacÃ©n de Productos e Inventarios
                if (!db.objectStoreNames.contains('productos')) {
                    const store = db.createObjectStore('productos', { keyPath: 'id' });
                    store.createIndex('by_sku', 'sku', { unique: true });
                }

                // 3. AlmacÃ©n de Lotes FIFO para tracking de costos reales
                if (!db.objectStoreNames.contains('lotes_fifo')) {
                    const store = db.createObjectStore('lotes_fifo', { keyPath: 'id' });
                    store.createIndex('by_producto', 'productoId', { unique: false });
                }

                // 4. AlmacÃ©n de Cotizaciones
                if (!db.objectStoreNames.contains('cotizaciones')) {
                    const store = db.createObjectStore('cotizaciones', { keyPath: 'id' });
                    store.createIndex('by_cliente', 'clienteId', { unique: false });
                    store.createIndex('by_estado', 'estado', { unique: false });
                }

                // 5. AlmacÃ©n de Facturas y Cuentas por Cobrar/Pagar
                if (!db.objectStoreNames.contains('facturas')) {
                    const store = db.createObjectStore('facturas', { keyPath: 'id' });
                    store.createIndex('by_contacto', 'contactoId', { unique: false });
                    store.createIndex('by_tipo', 'tipo', { unique: false }); // 'venta' o 'compra'
                    store.createIndex('by_estado', 'estado', { unique: false }); // 'paga', 'parcial', 'por_pagar'
                }

                // 6. AlmacÃ©n de Transacciones de Caja y Bancos
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
                console.log("IndexedDB inicializada con Ã©xito.");
                resolve(dbInstance);
            };

            request.onerror = (e) => {
                console.error("Error crÃ­tico abriendo IndexedDB:", e.target.error);
                reject(e.target.error);
            };
        });
    },

    /**
     * Guarda o actualiza un registro de forma idempotente en un almacÃ©n.
     * Si storeName es 'productos', persiste en Firestore; el resto usa IndexedDB.
     */
    async save(storeName, data) {
        if (!data.id) throw new Error(`El registro debe contener un ID Ãºnico para persistencia en ${storeName}.`);

        // TODO: transacciones sigue en IndexedDB â€” bancos.js hace getAll completo para sumar saldos, migrar solo despuÃ©s de refactorizar a saldo acumulado para no agotar cuota de lecturas de Firestore.
        if (storeName === 'productos' || storeName === 'contactos' || storeName === 'cotizaciones' || storeName === 'facturas' || storeName === 'lotes_fifo') {
            const ref = doc(db, storeName, data.id);
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
     * Obtiene un registro por su ID Ãºnico.
     * Si storeName es 'productos', lee desde Firestore; el resto usa IndexedDB.
     */
    async get(storeName, id) {
        // TODO: transacciones sigue en IndexedDB â€” bancos.js hace getAll completo para sumar saldos, migrar solo despuÃ©s de refactorizar a saldo acumulado para no agotar cuota de lecturas de Firestore.
        if (storeName === 'productos' || storeName === 'contactos' || storeName === 'cotizaciones' || storeName === 'facturas' || storeName === 'lotes_fifo') {
            const ref = doc(db, storeName, id);
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
     * Obtiene todos los registros de un almacÃ©n especÃ­fico.
     * Si storeName es 'productos', usa getDocs() (lectura puntual); el resto usa IndexedDB.
     */
    async getAll(storeName) {
        // TODO: transacciones sigue en IndexedDB â€” bancos.js hace getAll completo para sumar saldos, migrar solo despuÃ©s de refactorizar a saldo acumulado para no agotar cuota de lecturas de Firestore.
        if (storeName === 'productos' || storeName === 'contactos' || storeName === 'cotizaciones' || storeName === 'facturas' || storeName === 'lotes_fifo') {
            const snap = await getDocs(collection(db, storeName));
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
     * Elimina un registro por su ID Ãºnico.
     * Si storeName es 'productos', elimina en Firestore; el resto usa IndexedDB.
     */
    async delete(storeName, id) {
        // TODO: transacciones sigue en IndexedDB â€” bancos.js hace getAll completo para sumar saldos, migrar solo despuÃ©s de refactorizar a saldo acumulado para no agotar cuota de lecturas de Firestore.
        if (storeName === 'productos' || storeName === 'contactos' || storeName === 'cotizaciones' || storeName === 'facturas' || storeName === 'lotes_fifo') {
            await deleteDoc(doc(db, storeName, id));
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

// AutoejecuciÃ³n preventiva para asegurar la disponibilidad del esquema global
DB.init().catch(err => console.error("Fallo automÃ¡ico de inicializaciÃ³n DB:", err));

export default DB;

// ============================================================================
// SCRIPT DE RESTAURACIÃ“N DE BACKUPS (JSON -> Firestore/IndexedDB)
// Ejecutar en consola del navegador: await window.runRestoration()
// ============================================================================
window.runRestoration = async function() {
    // 1. Crear el selector de archivos
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    
    input.onchange = async e => {
        const files = Array.from(e.target.files);
        const getFile = (pattern) => files.find(f => f.name.includes(pattern));
        
        const fInventario = getFile('backup_inventario_pre_reset500x');
        const fContactos = getFile('backup_contactos_2026-07-23_v2');
        const fFacturas = getFile('backup_facturas_post_refactor');
        const fCompleto = getFile('backup_completo_pre_v3');

        if (!fInventario || !fContactos || !fFacturas || !fCompleto) {
            console.error("Faltan archivos. AsegÃºrate de seleccionar los 4 requeridos.");
            return;
        }

        const readJson = async (file) => JSON.parse(await file.text());
        
        console.log("Leyendo archivos...");
        const invData = await readJson(fInventario);
        const contData = await readJson(fContactos);
        const facData = await readJson(fFacturas);
        const compData = await readJson(fCompleto);

        // 2. Filtrado en Memoria
        console.log("=== FASE 1: Filtro ===");
        
        // Productos
        const originalProdCount = invData.productos.length;
        const productosAprobados = invData.productos.filter(p => !p.sku.match(/^500[1-5]-/));
        const productosExcluidos = invData.productos.filter(p => p.sku.match(/^500[1-5]-/));
        const excluidosIds = productosExcluidos.map(p => p.id);
        console.log(`- Productos: LeÃ­dos ${originalProdCount}, Excluidos ${productosExcluidos.length}, A restaurar ${productosAprobados.length}`);

        // Lotes FIFO
        const originalLoteCount = invData.lotes.length;
        const lotesAprobados = invData.lotes.filter(l => !excluidosIds.includes(l.productoId));
        console.log(`- Lotes FIFO: LeÃ­dos ${originalLoteCount}, Excluidos ${originalLoteCount - lotesAprobados.length}, A restaurar ${lotesAprobados.length}`);

        // Las demÃ¡s no necesitan filtro
        const contactos = contData.length ? contData : contData.contactos || Object.values(contData);
        const facturas = facData.length ? facData : facData.facturas || Object.values(facData);
        const transacciones = compData.transacciones || [];

        const coleccionesFirestore = [
            { name: 'productos', data: productosAprobados },
            { name: 'lotes_fifo', data: lotesAprobados },
            { name: 'contactos', data: contactos },
            { name: 'facturas', data: facturas }
        ];

        let totalAEscribir = coleccionesFirestore.reduce((acc, curr) => acc + curr.data.length, 0);
        
        const confirmar = confirm(`Se escribirÃ¡n ${totalAEscribir} documentos en Firestore y ${transacciones.length} en IndexedDB.\nÂ¿Proceder?`);
        if (!confirmar) return;

        console.log("\n=== FASE 2: RestauraciÃ³n Firestore ===");
        let totalErroresGlobales = 0;

        for (const col of coleccionesFirestore) {
            console.log(`Restaurando '${col.name}' (${col.data.length} docs)...`);
            const errores = [];
            let migrados = 0;
            const chunkSize = 100;
            
            for (let i = 0; i < col.data.length; i += chunkSize) {
                const chunk = col.data.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (docData) => {
                    try {
                        if (!docData.id) throw new Error("ID invÃ¡lido");
                        const ref = doc(db, col.name, String(docData.id));
                        await setDoc(ref, docData);
                    } catch (error) {
                        errores.push({ id: docData.id || 'N/A', error: error.message });
                    }
                }));
                migrados += chunk.length;
                console.log(`Progreso ${col.name}: ${migrados} / ${col.data.length}...`);
            }

            const snap = await getDocs(collection(db, col.name));
            console.log(`âœ… RESULTADO ${col.name}: Archivo=${col.data.length} | Nube=${snap.size}`);
            
            if (errores.length > 0) {
                totalErroresGlobales += errores.length;
                console.error(`âŒ ERRORES EN ${col.name}: ${errores.length}`);
                console.table(errores);
            }
        }

        console.log("\n=== FASE 3: RestauraciÃ³n IndexedDB (Transacciones) ===");
        const idb = await DB.init();
        const txCount = transacciones.length;
        if (txCount > 0) {
            let txErrores = 0;
            await new Promise((resolve, reject) => {
                const idbTx = idb.transaction('transacciones', 'readwrite');
                const store = idbTx.objectStore('transacciones');
                transacciones.forEach(t => {
                    const req = store.put(t);
                    req.onerror = () => txErrores++;
                });
                idbTx.oncomplete = () => resolve();
                idbTx.onerror = () => reject(idbTx.error);
            });
            console.log(`âœ… RESULTADO transacciones: Archivo=${txCount} | IndexedDB=Restauradas (${txErrores} errores)`);
        } else {
            console.log("No hay transacciones para restaurar.");
        }

        console.log("\nðŸš€ RESTAURACIÃ“N COMPLETA.");
    };

    input.click();
};
// SCRIPT DE DEDUPLICACION (FIRESTORE)
window.runDeduplication = async function() {
    console.log("Iniciando an¨¢lisis de deduplicaci¨®n en Firestore...");

    // 1. Obtener todos los contactos
    const snap = await getDocs(collection(db, 'contactos'));
    const contactos = [];
    snap.forEach(doc => contactos.push({ id: doc.id, ...doc.data() }));

    console.log(`Descargados ${contactos.length} contactos de Firestore.`);

    // 2. Generar y forzar descarga de respaldo JSON crudo (Pre-Delete)
    const dataStr = JSON.stringify(contactos, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firestore_contactos_pre_dedup_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Respaldo JSON descargado correctamente en tu equipo.");

    // 3. Agrupar por NIT o por Nombre Normalizado + Tel¨¦fono
    const grupos = {};
    for (const c of contactos) {
        let key;
        const nit = c.nit ? String(c.nit).trim() : '';
        if (nit && nit.toUpperCase() !== 'S/N') {
            key = nit.toUpperCase();
        } else {
            const n = c.nombre ? String(c.nombre).trim().toLowerCase().replace(/\s+/g, ' ') : '';
            const t = c.telefono ? String(c.telefono).trim() : '';
            key = `${n}|${t}`;
        }
        
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(c);
    }

    // 4. Analizar e identificar operaciones (Merge Inteligente)
    const docsAActualizar = []; // Registros base que heredar¨¢n campos
    const docsAEliminar = []; // Duplicados que ser¨¢n borrados
    const muestraGrupos = []; // Para reporte en consola

    const keys = Object.keys(grupos);
    for (const key of keys) {
        const grupo = grupos[key];
        if (grupo.length > 1) {
            // Tomamos el primer registro como BASE
            const base = { ...grupo[0] };
            const duplicados = grupo.slice(1);

            // Merge inteligente: rellenar campos vac¨ªos del base
            for (const dup of duplicados) {
                for (const field of Object.keys(dup)) {
                    if (field !== 'id') {
                        const valBase = base[field];
                        const valDup = dup[field];
                        // Si el base lo tiene vac¨ªo, pero el duplicado s¨ª lo tiene, heredarlo
                        // Aseguramos respetar valores reales como el n¨²mero 0
                        if ((valBase === undefined || valBase === null || valBase === '') && (valDup !== undefined && valDup !== null && valDup !== '')) {
                            base[field] = valDup;
                        }
                    }
                }
                docsAEliminar.push(dup.id);
            }
            
            docsAActualizar.push(base);

            // Guardar para la muestra de consola
            if (muestraGrupos.length < 10) {
                muestraGrupos.push({
                    criterio: key,
                    totalEnGrupo: grupo.length,
                    idBaseFinal: base.id,
                    nombreFinal: base.nombre,
                    telefonoFinal: base.telefono,
                    emailFinal: base.email,
                    direccionFinal: base.direccion,
                    idsBorrados: duplicados.map(d => d.id).join(', ')
                });
            }
        }
    }

    // 5. Mostrar en consola el resumen y la tabla de muestra
    console.log(`\n=== RESUMEN DE DEDUPLICACI¨®N ===`);
    console.log(`- Grupos ¨²nicos totales resultantes: ${keys.length}`);
    console.log(`- Registros base a fusionar/actualizar: ${docsAActualizar.length}`);
    console.log(`- Documentos basura a eliminar de Firestore: ${docsAEliminar.length}`);
    
    if (muestraGrupos.length > 0) {
        console.log(`\n--- MUESTRA DE LOS PRIMEROS 10 GRUPOS (YA FUSIONADOS) ---`);
        console.table(muestraGrupos);
    }

    if (docsAEliminar.length === 0) {
        console.log("No hay duplicados para limpiar. Proceso terminado.");
        return;
    }

    // 6. Lanzar confirm de bloqueo de seguridad
    const proceder = confirm(
        `RESPALDO DESCARGADO.\n\n` +
        `An¨¢lisis terminado:\n` +
        `- Se enriquecer¨¢n ${docsAActualizar.length} registros base.\n` +
        `- SE ELIMINAR¨¢N ${docsAEliminar.length} registros duplicados de Firestore.\n\n` +
        `?Deseas proceder con la fusi¨®n y el borrado final?`
    );
    
    if (!proceder) {
        console.log("Operaci¨®n cancelada por el usuario.");
        return;
    }

    // 7. Ejecutar cambios en Firestore (Protegido con try/catch individual)
    console.log("\nEjecutando cambios en Firestore...");
    let errores = 0;
    
    // 7a. Primero actualizar los base
    for (const base of docsAActualizar) {
        try {
            const ref = doc(db, 'contactos', String(base.id));
            await setDoc(ref, base);
        } catch (e) {
            console.error(`Error fusionando el base ${base.id}:`, e);
            errores++;
        }
    }
    console.log(`? Actualizados ${docsAActualizar.length} registros base.`);

    // 7b. Luego borrar los excedentes (deleteDoc)
    let borrados = 0;
    for (const id of docsAEliminar) {
        try {
            const ref = doc(db, 'contactos', String(id));
            await deleteDoc(ref);
            borrados++;
        } catch (e) {
            console.error(`Error eliminando el duplicado ${id}:`, e);
            errores++;
        }
        if (borrados % 100 === 0) console.log(`Progreso borrado: ${borrados}/${docsAEliminar.length}...`);
    }

    // Recalcular Nube
    const snapFinal = await getDocs(collection(db, 'contactos'));
    
    console.log(`\n?? LIMPIEZA FINALIZADA.`);
    console.log(`- Duplicados eliminados exitosamente: ${borrados}`);
    console.log(`- Total de contactos en Firestore AHORA: ${snapFinal.size}`);
    
    if (errores > 0) {
        console.error(`- Ocurrieron ${errores} errores durante el proceso.`);
    }
};
