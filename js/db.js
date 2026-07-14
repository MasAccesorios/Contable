/* =====================================================
    MAS Accesorios - Database Layer (localStorage)
   ===================================================== */

const DB = {
    // Storage keys
    KEYS: {
        USERS: 'cg_users',
        CLIENTS: 'cg_clients',
        PRODUCTS: 'cg_products',
        SALES: 'cg_sales',
        SALE_DETAILS: 'cg_sale_details',
        CARTERA: 'cg_cartera',
        BANKS: 'cg_banks',
        BANK_MOVEMENTS: 'cg_bank_movements',
        EXPENSES: 'cg_expenses',
        INTEGRATIONS: 'cg_integrations',
        INTEGRATION_LOGS: 'cg_integration_logs',
        COMPRAS: 'cg_compras',
        COMPRA_DETAILS: 'cg_compra_details',
        COTIZACIONES: 'cg_cotizaciones',
        COTIZACION_DETAILS: 'cg_cotizacion_details',
        RECIBOS_CAJA: 'cg_recibos_caja',
        RECIBO_CAJA_DETALLE: 'cg_recibo_caja_detalle',
        CARTERA_PROVEEDORES: 'cg_cartera_proveedores',
        PAGOS_PROVEEDORES: 'cg_pagos_proveedores',
        PAGOS_PROVEEDORES_DETALLE: 'cg_pagos_proveedores_detalle',
        DEVOLUCIONES: 'cg_devoluciones',
        DEVOLUCION_DETAILS: 'cg_devolucion_details',
        SELLERS: 'cg_sellers',
        KARDEX: 'cg_kardex',
        INVENTORY_LOTS: 'cg_inventory_lots',
        COUNTERS: 'cg_counters',
        CURRENT_USER: 'cg_current_user',
        INITIALIZED: 'cg_initialized'
    },

    // Google Sheets Web App URL
    API_URL: 'https://script.google.com/macros/s/AKfycbxrhGrVogJxlZGkVMisyMad-4r-X5eMNl8BtcV2ORNLh4R46KSgYK5fSTrMYe2uozaF/exec',

    // In-memory cache to avoid repeated JSON.parse (PERF-01)
    _cache: {},

    // IndexedDB constants
    DB_NAME: 'ContableDB',
    STORE_NAME: 'kv_store',
    _db: null,
    initPromise: null,

    // Initialize IndexedDB connection and load cache
    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, 1);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME);
                }
            };
            
            request.onsuccess = (e) => {
                this._db = e.target.result;
                
                // Read all keys from IndexedDB to populate _cache
                const transaction = this._db.transaction(this.STORE_NAME, 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);
                const allKeysRequest = store.getAllKeys();
                
                allKeysRequest.onsuccess = () => {
                    const keys = allKeysRequest.result;
                    if (keys.length === 0) {
                        // Migrate existing localStorage data to IndexedDB if first time
                        this._migrateFromLocalStorage().then(() => {
                            this.initialize();
                            this._checkClearTestData().then(resolve);
                        }).catch((err) => {
                            console.error("Error migrating localStorage data:", err);
                            this.initialize();
                            this._checkClearTestData().then(resolve);
                        });
                        return;
                    }
                    
                    let loaded = 0;
                    keys.forEach(key => {
                        const getReq = store.get(key);
                        getReq.onsuccess = () => {
                            this._cache[key] = getReq.result;
                            loaded++;
                            if (loaded === keys.length) {
                                this.initialize();
                                this._checkClearTestData().then(resolve);
                            }
                        };
                        getReq.onerror = () => {
                            loaded++;
                            if (loaded === keys.length) {
                                this.initialize();
                                this._checkClearTestData().then(resolve);
                            }
                        };
                    });
                };
                
                allKeysRequest.onerror = () => {
                    this.initialize();
                    this._checkClearTestData().then(resolve);
                };
            };
            
            request.onerror = (e) => {
                console.error("IndexedDB open error:", e);
                this.initialize();
                this._checkClearTestData().then(resolve);
            };
        });
    },

    async _migrateFromLocalStorage() {
        if (!this._db) return;
        const transaction = this._db.transaction(this.STORE_NAME, 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        
        for (const key of Object.values(this.KEYS)) {
            const val = localStorage.getItem(key);
            if (val !== null) {
                try {
                    const parsed = JSON.parse(val);
                    store.put(parsed, key);
                    this._cache[key] = parsed;
                } catch(e) {
                    console.error("Error migrating key:", key, e);
                }
            }
        }
        
        const initVal = localStorage.getItem('cg_initialized');
        if (initVal) {
            store.put(initVal, 'cg_initialized');
        }
        
        return new Promise((resolve) => {
            transaction.oncomplete = () => {
                console.log("Migration from localStorage to IndexedDB completed successfully.");
                resolve();
            };
            transaction.onerror = () => {
                resolve();
            };
        });
    },

    async _checkClearTestData() {
        if (!localStorage.getItem('cg_test_cleared_v1')) {
            this.clearTestData();
            localStorage.setItem('cg_test_cleared_v1', 'true');
            alert('Se han borrado todos los datos de compras, ventas, contactos, facturas y bancos para comenzar pruebas desde cero. Los productos y usuarios se mantuvieron (con stock 0).');
            location.reload();
            return new Promise(() => {}); // Wait forever for reload
        }
    },
    
    // Sync all data from Google Sheets to IndexedDB/cache on startup
    async syncFromCloud() {
        try {
            console.log("Sincronizando con Google Sheets...");
            const response = await fetch(this.API_URL);
            const data = await response.json();
            
            if (data.error) {
                console.error("Error de Google Sheets:", data.error);
                return false;
            }
            
            // Overwrite IndexedDB/cache with Cloud Data
            for (const key in data) {
                try {
                    let parsedValue = data[key];
                    if(typeof parsedValue === 'string') {
                         parsedValue = JSON.parse(parsedValue);
                    }
                    this._persist(key, parsedValue);
                } catch(e) {
                    console.error("Error parseando llave", key, e);
                }
            }

            // Enforce only one admin and wipe others
            const targetEmail = 'mauricio.izquierdo@hotmail.com';
            let users = this.getAll(this.KEYS.USERS) || [];
            users = users.filter(u => u.email === targetEmail);

            const existingAdmin = users.find(u => u.email === targetEmail);
            if (existingAdmin) {
                existingAdmin.nombre = 'Administrador';
                existingAdmin.password = 'Aa79981638+';
                existingAdmin.rol = 'admin';
                existingAdmin.estado = 'activo';
                existingAdmin.deleted_at = null;
            } else {
                users.push({
                    id: this.genId(),
                    nombre: 'Administrador',
                    email: targetEmail,
                    password: 'Aa79981638+',
                    rol: 'admin',
                    estado: 'activo',
                    created_at: new Date().toISOString()
                });
            }
            this._persist(this.KEYS.USERS, users);
            await this.pushToCloud(this.KEYS.USERS, users);

            console.log("Sincronización completa.");
            return true;
        } catch (error) {
            console.error("Error de conexión con Google Sheets:", error);
            return false;
        }
    },

    _syncPending: {},
    _syncRunning: {},

    // Push specific key to Google Sheets with LIFO queue optimization
    async pushToCloud(key, data) {
        this._syncPending[key] = data;
        if (!this._syncRunning[key]) {
            this._runPushToCloud(key);
        }
    },

    async _runPushToCloud(key) {
        this._syncRunning[key] = true;
        while (this._syncPending[key] !== undefined) {
            const data = this._syncPending[key];
            delete this._syncPending[key];
            try {
                await fetch(this.API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        key: key,
                        value: JSON.stringify(data)
                    })
                });
            } catch(error) {
                console.error("No se pudo guardar en la nube en este momento:", error);
            }
        }
        delete this._syncRunning[key];
    },

    // Generate unique ID
    genId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
    },

    // Normalize a date string into a full ISO string (CODE-01)
    normalizeFecha(fecha) {
        if (!fecha) return new Date().toISOString();
        if (fecha.includes('T')) return fecha;
        if (fecha === new Date().toISOString().split('T')[0]) return new Date().toISOString();
        return fecha + 'T00:00:00';
    },

    // Generic CRUD operations
    getAll(key) {
        if (key === this.KEYS.CURRENT_USER) {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        }
        if (this._cache[key]) return this._cache[key];
        return [];
    },

    // Persist to IndexedDB and update cache
    _persist(key, data) {
        try {
            if (key === this.KEYS.CURRENT_USER) {
                localStorage.setItem(key, JSON.stringify(data));
                return;
            }
            this._cache[key] = data;
            
            // Asynchronously save to IndexedDB
            if (this._db) {
                const transaction = this._db.transaction(this.STORE_NAME, 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                store.put(data, key);
            }
            
            // Sync with Google Sheets asynchronously (fire and forget)
            this.pushToCloud(key, data);
            
        } catch (e) {
            console.error("Error write to database:", key, e);
        }
    },

    // Invalidate cache for a key
    _invalidate(key) {
        delete this._cache[key];
    },

    getById(key, id) {
        const items = this.getAll(key);
        return items.find(item => item.id === id);
    },

    save(key, item) {
        const items = this.getAll(key);
        if (item.id) {
            const idx = items.findIndex(i => i.id === item.id);
            if (idx !== -1) {
                item.updated_at = new Date().toISOString();
                items[idx] = { ...items[idx], ...item };
            } else {
                item.created_at = new Date().toISOString();
                item.updated_at = new Date().toISOString();
                items.push(item);
            }
        } else {
            item.id = this.genId();
            item.created_at = new Date().toISOString();
            item.updated_at = new Date().toISOString();
            items.push(item);
        }

        this._persist(key, items);
        return item;
    },

    delete(key, id) {
        let items = this.getAll(key);
        items = items.filter(i => i.id !== id);
        this._persist(key, items);
    },

    softDelete(key, id) {
        const items = this.getAll(key);
        const idx = items.findIndex(i => i.id === id);
        if (idx !== -1) {
            items[idx].deleted_at = new Date().toISOString();
            items[idx].updated_at = new Date().toISOString();
            this._persist(key, items);
            return true;
        }
        return false;
    },

    // Get all non-deleted items
    getAllActive(key) {
        return this.getAll(key).filter(item => !item.deleted_at);
    },

    getNextNumber(type) {
        const counters = JSON.parse(localStorage.getItem(this.KEYS.COUNTERS)) || {};
        const current = counters[type] || 0;
        const next = current + 1;
        counters[type] = next;
        localStorage.setItem(this.KEYS.COUNTERS, JSON.stringify(counters));
        this.pushToCloud(this.KEYS.COUNTERS, counters);
        return next;
    },

    // =========================================================
    // Users
    // =========================================================
    getUsers() { return this.getAllActive(this.KEYS.USERS); },
    getUser(id) { return this.getById(this.KEYS.USERS, id); },
    saveUser(user) { return this.save(this.KEYS.USERS, user); },
    deleteUser(id) { return this.softDelete(this.KEYS.USERS, id); },

    authenticate(email, password) {
        const users = this.getUsers();
        return users.find(u => u.email === email && u.password === password && u.estado === 'activo');
    },

    // =========================================================
    // Sellers (Vendedores)
    // =========================================================
    getSellers() { return this.getAllActive(this.KEYS.SELLERS); },
    getSeller(id) { return this.getById(this.KEYS.SELLERS, id); },
    saveSeller(seller) {
        if (!seller.nombre || seller.nombre.trim() === '') {
            throw new Error('El nombre del vendedor es obligatorio.');
        }
        return this.save(this.KEYS.SELLERS, seller);
    },
    deleteSeller(id) { this.softDelete(this.KEYS.SELLERS, id); },

    // =========================================================
    // Clients
    // =========================================================
    getClients() { return this.getAllActive(this.KEYS.CLIENTS); },
    getClient(id) { return this.getById(this.KEYS.CLIENTS, id); },
    saveClient(client) {
        if (client.documento) {
            const existing = this.getAll(this.KEYS.CLIENTS).find(c =>
                c.documento === client.documento &&
                c.id !== client.id &&
                !c.deleted_at
            );
            if (existing) {
                throw new Error(`Ya existe un cliente/proveedor registrado con el número de identificación ${client.documento}.`);
            }
        }
        return this.save(this.KEYS.CLIENTS, client);
    },
    deleteClient(id) { this.softDelete(this.KEYS.CLIENTS, id); },

    getClientBalance(clientId) {
        const cartera = this.getAll(this.KEYS.CARTERA)
            .filter(c => c.cliente_id === clientId && c.estado !== 'pagada');
        return cartera.reduce((sum, c) => sum + parseFloat(c.saldo), 0);
    },

    // =========================================================
    // Products
    // =========================================================
    getProducts() { return this.getAllActive(this.KEYS.PRODUCTS); },
    getProduct(id) { return this.getById(this.KEYS.PRODUCTS, id); },
    saveProduct(product) {
        if (!product.codigo || product.codigo.trim() === '') {
            throw new Error('La referencia del producto es obligatoria.');
        }

        const products = this.getAll(this.KEYS.PRODUCTS);
        const duplicate = products.find(p => p.codigo === product.codigo && p.id !== product.id && !p.deleted_at);
        if (duplicate) {
            throw new Error(`La referencia "${product.codigo}" ya está en uso por otro producto.`);
        }

        return this.save(this.KEYS.PRODUCTS, product);
    },
    deleteProduct(id) { this.softDelete(this.KEYS.PRODUCTS, id); },

    // =========================================================
    // FIFO Inventory Lots
    // =========================================================
    getInventoryLots(productoId) {
        return this.getAll(this.KEYS.INVENTORY_LOTS)
            .filter(l => l.producto_id === productoId && l.cantidad_disponible > 0)
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    },

    getAllInventoryLots(productoId) {
        return this.getAll(this.KEYS.INVENTORY_LOTS)
            .filter(l => l.producto_id === productoId)
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    },

    addInventoryLot(productoId, cantidad, costoUnitario, compraId, fecha) {
        const lot = {
            id: this.genId(),
            producto_id: productoId,
            compra_id: compraId || null,
            cantidad_original: parseInt(cantidad),
            cantidad_disponible: parseInt(cantidad),
            costo_unitario: parseFloat(costoUnitario),
            fecha: fecha || new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        const lots = this.getAll(this.KEYS.INVENTORY_LOTS);
        lots.push(lot);
        this._persist(this.KEYS.INVENTORY_LOTS, lots);
        return lot;
    },

    consumeFIFO(productoId, cantidadRequerida) {
        const lots = this.getAll(this.KEYS.INVENTORY_LOTS);
        const productLots = lots
            .filter(l => l.producto_id === productoId && l.cantidad_disponible > 0)
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        let remaining = parseInt(cantidadRequerida);
        const consumption = [];
        let totalCosto = 0;

        for (const lot of productLots) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, lot.cantidad_disponible);
            consumption.push({
                lote_id: lot.id,
                cantidad: take,
                costo_unitario: lot.costo_unitario
            });
            totalCosto += take * lot.costo_unitario;
            lot.cantidad_disponible -= take;
            remaining -= take;
        }

        if (remaining > 0) {
            // Not enough lots — use last known cost for the remainder
            const product = this.getProduct(productoId);
            const lastCost = productLots.length > 0
                ? productLots[productLots.length - 1].costo_unitario
                : (product && product.precio_compra ? parseFloat(product.precio_compra) : 0);
            
            consumption.push({
                lote_id: null,
                cantidad: remaining,
                costo_unitario: lastCost
            });
            totalCosto += remaining * lastCost;
        }

        this._persist(this.KEYS.INVENTORY_LOTS, lots);

        return {
            details: consumption,
            totalCosto: totalCosto,
            costoPromedio: cantidadRequerida > 0 ? totalCosto / cantidadRequerida : 0
        };
    },

    restoreFIFO(fifoDetails) {
        if (!fifoDetails || fifoDetails.length === 0) return;
        const lots = this.getAll(this.KEYS.INVENTORY_LOTS);

        fifoDetails.forEach(fd => {
            if (!fd.lote_id) return; // Skip entries without lot reference
            const lot = lots.find(l => l.id === fd.lote_id);
            if (lot) {
                lot.cantidad_disponible += parseInt(fd.cantidad);
            }
        });

        this._persist(this.KEYS.INVENTORY_LOTS, lots);
    },

    adjustStock(productId, newStock, motivo = 'Ajuste Manual') {
        const products = this.getAll(this.KEYS.PRODUCTS);
        const idx = products.findIndex(p => p.id === productId);
        if (idx !== -1) {
            const oldStock = parseInt(products[idx].stock_actual) || 0;
            const diff = parseInt(newStock) - oldStock;
            
            products[idx].stock_actual = parseInt(newStock);
            products[idx].updated_at = new Date().toISOString();
            this._persist(this.KEYS.PRODUCTS, products);

            if (diff !== 0) {
                const adjustments = this.getAll(this.KEYS.KARDEX) || [];
                adjustments.push({
                    id: this.genId(),
                    producto_id: productId,
                    movimiento_cantidad: diff,
                    costo_unitario: parseFloat(products[idx].precio_compra) || 0,
                    fecha: new Date().toISOString(),
                    motivo: motivo,
                    created_at: new Date().toISOString()
                });
                this._persist(this.KEYS.KARDEX, adjustments);
            }
        }
    },

    updateProductCost(productId, newCost) {
        const products = this.getAll(this.KEYS.PRODUCTS);
        const idx = products.findIndex(p => p.id === productId);
        if (idx !== -1) {
            products[idx].precio_compra = parseFloat(newCost);
            products[idx].updated_at = new Date().toISOString();
            this._persist(this.KEYS.PRODUCTS, products);
        }
    },

    updateProductPrice(productId, newPrice) {
        const products = this.getAll(this.KEYS.PRODUCTS);
        const idx = products.findIndex(p => p.id === productId);
        if (idx !== -1 && newPrice) {
            products[idx].precio_venta = parseFloat(newPrice);
            products[idx].updated_at = new Date().toISOString();
            this._persist(this.KEYS.PRODUCTS, products);
        }
    },

    // =========================================================
    // Cotizaciones
    // =========================================================
    getCotizaciones() {
        let data = this.getAll(this.KEYS.COTIZACIONES);
        if (!Array.isArray(data)) return [];
        // Auto-fix if nulls or bad data found
        if (data.includes(null) || data.some(d => !d || !d.id)) {
            console.warn('DB: Corrupt cotizaciones detected. Running auto-fix...');
            return this.fixCotizacionesData();
        }
        return data;
    },

    fixCotizacionesData() {
        let items = this.getAll(this.KEYS.COTIZACIONES);
        if (!Array.isArray(items)) items = [];
        const cleanItems = items.filter(item => item !== null && typeof item === 'object' && item.id);
        this._persist(this.KEYS.COTIZACIONES, cleanItems);
        return cleanItems;
    },
    getCotizacion(id) { return this.getById(this.KEYS.COTIZACIONES, id); },
    getCotizacionDetails(cotizacionId) {
        return this.getAll(this.KEYS.COTIZACION_DETAILS).filter(d => d.cotizacion_id === cotizacionId);
    },

    registerCotizacion(cotizacionData, details) {
        // 1. Validations
        if (!cotizacionData.cliente_id) throw new Error('El cliente es obligatorio.');
        if (!cotizacionData.fecha) throw new Error('La fecha es obligatoria.');
        if (!details || details.length === 0) throw new Error('Debe agregar al menos un producto.');

        let total = 0;
        details.forEach(d => {
            if (!d.producto_id || d.cantidad <= 0) throw new Error('Detalle de producto inválido.');
            const desc = d.descuento || 0;
            const taxSelect = d.impuesto || 'Ninguno';
            const netSubtotal = parseFloat(d.precio_unitario) * parseInt(d.cantidad) * (1 - desc / 100);
            const taxRate = taxSelect === '19%' ? 0.19 : 0.00;
            d.subtotal = netSubtotal + (netSubtotal * taxRate);
            total += d.subtotal;
        });

        if (total <= 0) throw new Error('El total de la cotización debe ser mayor a 0.');

        // 2. Head Saving
        const isNew = !cotizacionData.id;
        let existingCotizacion = isNew ? null : this.getCotizacion(cotizacionData.id);

        if (!isNew && existingCotizacion && existingCotizacion.estado === 'convertida') {
            throw new Error('No se puede editar una cotización ya convertida.');
        }

        const cotizacion = {
            ...existingCotizacion,
            ...cotizacionData,
            numero: existingCotizacion ? existingCotizacion.numero : this.getNextNumber('cotizacion'),
            total: total,
            vendedor_id: cotizacionData.vendedor_id || null,
            comision_monto: cotizacionData.vendedor_id ? (total * (parseFloat(this.getSeller(cotizacionData.vendedor_id)?.comision_porcentaje || 0) / 100)) : 0,
            estado: 'aceptada', // Simplification: Always mark as accepted
            fecha: (cotizacionData.fecha === new Date().toISOString().split('T')[0]) ? new Date().toISOString() : (cotizacionData.fecha + (cotizacionData.fecha.includes('T') ? '' : 'T00:00:00')),
            created_at: existingCotizacion ? existingCotizacion.created_at : new Date().toISOString()
        };

        const savedCotizacion = this.save(this.KEYS.COTIZACIONES, cotizacion);

        // 3. Details Saving (Atomic)
        let allDetails = this.getAll(this.KEYS.COTIZACION_DETAILS) || [];
        allDetails = allDetails.filter(d => d.cotizacion_id !== savedCotizacion.id);

        const newDetails = details.map(d => ({
            ...d,
            cotizacion_id: savedCotizacion.id,
            id: this.genId()
        }));

        allDetails.push(...newDetails);
        this._persist(this.KEYS.COTIZACION_DETAILS, allDetails);

        return savedCotizacion;
    },

    convertCotizacionToVenta(cotizacionId, tipoVenta, bancoId) {
        // 1. Security Checks
        const cotizacion = this.getCotizacion(cotizacionId);
        if (!cotizacion) throw new Error('Cotización no encontrada.');
        if (cotizacion.estado !== 'aceptada') throw new Error('Solo se pueden convertir cotizaciones en estado "Aceptada".');
        if (cotizacion.factura_id) throw new Error('Esta cotización ya tiene una factura asociada.');

        const details = this.getCotizacionDetails(cotizacionId);
        if (!details || details.length === 0) throw new Error('La cotización no tiene productos.');

        // 2. Stock Validation
        details.forEach(d => {
            const product = this.getProduct(d.producto_id);
            if (!product || parseInt(product.stock_actual) < parseInt(d.cantidad)) {
                throw new Error(`Stock insuficiente para "${product ? product.nombre : 'Producto'}". Disponible: ${product ? product.stock_actual : 0}`);
            }
        });

        // 3. Prepare Sale Data
        const saleData = {
            numero: cotizacion.numero,
            cliente_id: cotizacion.cliente_id,
            tipo_venta: tipoVenta || 'contado',
            fecha: new Date().toISOString(),
            observacion: `Convertida desde Cotización #${cotizacion.numero || cotizacionId.slice(-6).toUpperCase()}`,
            cotizacion_id: cotizacionId,
            vendedor_id: cotizacion.vendedor_id || null
        };

        // 4. Register Sale (Reuse existing logic for stock, bank, and details)
        const saleDetails = details.map(d => ({
            producto_id: d.producto_id,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
            descuento: d.descuento || 0,
            impuesto: d.impuesto || 'Ninguno',
            descripcion: d.descripcion || ''
        }));

        try {
            const savedSale = this.registerSale(saleData, saleDetails, bancoId);

            // 5. Update Quotation Status
            cotizacion.estado = 'convertida';
            cotizacion.factura_id = savedSale.id;

            this.save(this.KEYS.COTIZACIONES, cotizacion);

            return savedSale;
        } catch (error) {
            throw new Error('Error al generar la factura: ' + error.message);
        }
    },

    // =========================================================
    // Sales (Facturas de Venta)
    // =========================================================
    getSales() { return this.getAll(this.KEYS.SALES); },
    getSale(id) { return this.getById(this.KEYS.SALES, id); },

    getSaleDetails(saleId) {
        return this.getAll(this.KEYS.SALE_DETAILS).filter(d => d.venta_id === saleId);
    },

    registerSale(saleData, details, bancoId) {
        let total = 0;
        let totalCosto = 0;

        const isNew = !saleData.id;
        let existingSale = null;
        let oldDetails = [];

        if (!isNew) {
            existingSale = this.getSale(saleData.id);
            if (!existingSale) throw new Error("Venta no encontrada");
            if (existingSale.estado === 'pagada' || existingSale.estado === 'anulada') {
                throw new Error("No se puede editar una factura pagada o anulada");
            }
            oldDetails = this.getSaleDetails(saleData.id);

            // Revert old stock and FIFO lots
            oldDetails.forEach(od => {
                const product = this.getProduct(od.producto_id);
                if (product) {
                    this.adjustStock(od.producto_id, parseInt(product.stock_actual) + parseInt(od.cantidad));
                }
                // Restore FIFO lots consumed by old sale
                if (od.fifo_details) {
                    this.restoreFIFO(od.fifo_details);
                }
            });

            // Remove old details
            let allDetails = this.getAll(this.KEYS.SALE_DETAILS);
            allDetails = allDetails.filter(d => d.venta_id !== existingSale.id);
            this._persist(this.KEYS.SALE_DETAILS, allDetails);
        }

        let totalNeto = 0;
        // FIFO: Calculate cost from oldest lots
        details.forEach(d => {
            const product = this.getProduct(d.producto_id);
            const fifoResult = this.consumeFIFO(d.producto_id, d.cantidad);
            d.costo_unitario = fifoResult.costoPromedio;
            d.fifo_details = fifoResult.details;
            const desc = d.descuento || 0;
            const taxSelect = d.impuesto || 'Ninguno';
            const netSubtotal = parseFloat(d.precio_unitario) * parseInt(d.cantidad) * (1 - desc / 100);
            totalNeto += netSubtotal;
            const taxRate = taxSelect === '19%' ? 0.19 : 0.00;
            d.subtotal = netSubtotal + (netSubtotal * taxRate);
            total += d.subtotal;
            totalCosto += fifoResult.totalCosto;
        });

        const estadoFactura = saleData.tipo_venta === 'contado' ? 'pagada' : 'pendiente';

        const sale = {
            ...existingSale,
            ...saleData,
            numero: existingSale ? existingSale.numero : (saleData.numero || this.getNextNumber('venta')),
            estado: estadoFactura,
            total: total,
            total_costo: totalCosto,
            utilidad: totalNeto - totalCosto,
            vendedor_id: saleData.vendedor_id || null,
            comision_monto: saleData.vendedor_id ? (total * (parseFloat(this.getSeller(saleData.vendedor_id)?.comision_porcentaje || 0) / 100)) : 0,
            fecha: (saleData.fecha && saleData.fecha !== new Date().toISOString().split('T')[0]) ? (saleData.fecha + (saleData.fecha.includes('T') ? '' : 'T00:00:00')) : new Date().toISOString()
        };

        const savedSale = this.save(this.KEYS.SALES, sale);

        // BUG-01 fix: Single read/write for details
        const allDetails = this.getAll(this.KEYS.SALE_DETAILS);
        details.forEach(d => {
            d.venta_id = savedSale.id;
            d.id = this.genId();
            allDetails.push(d);
        });
        this._persist(this.KEYS.SALE_DETAILS, allDetails);

        // BUG-02 fix: Batch stock adjustments
        const products = this.getAll(this.KEYS.PRODUCTS);
        details.forEach(d => {
            const idx = products.findIndex(p => p.id === d.producto_id);
            if (idx !== -1) {
                products[idx].stock_actual = parseInt(products[idx].stock_actual) - parseInt(d.cantidad);
                products[idx].updated_at = new Date().toISOString();
            }
        });
        this._persist(this.KEYS.PRODUCTS, products);

        if (isNew) {
            if (saleData.tipo_venta === 'contado' && bancoId) {
                // 1. Registrar el pago en el historial de recibos de caja
                const recibo = {
                    id: this.genId(),
                    numero: this.getNextNumber('recibo'),
                    cliente_id: saleData.cliente_id,
                    banco_id: bancoId,
                    monto_total: total,
                    fecha: sale.fecha,
                    estado: 'activo',
                    observacion: `Pago contado - Venta #${sale.numero || sale.id.slice(-6)}`,
                    created_at: new Date().toISOString()
                };
                this.save(this.KEYS.RECIBOS_CAJA, recibo);

                // 2. Registrar movimiento bancario
                this.addBankMovement({
                    banco_id: bancoId,
                    tipo: 'ingreso',
                    monto: total,
                    descripcion: `Factura contado #${sale.numero || sale.id.slice(-6)}: ${this.getClient(saleData.cliente_id)?.nombre || ''}`,
                    referencia_id: savedSale.id,
                    fecha: sale.fecha
                });
            } else if (saleData.tipo_venta === 'credito') {
                const client = this.getClient(saleData.cliente_id);
                const plazoDias = client ? parseInt(client.plazo_dias) || 30 : 30;

                // Usar la fecha de la venta como base para el vencimiento
                const baseDate = sale.fecha ? new Date(sale.fecha.includes('T') ? sale.fecha : sale.fecha + 'T00:00:00') : new Date();
                const vencimiento = new Date(baseDate);
                vencimiento.setDate(vencimiento.getDate() + plazoDias);

                this.save(this.KEYS.CARTERA, {
                    venta_id: savedSale.id,
                    cliente_id: saleData.cliente_id,
                    total: total,
                    saldo: total,
                    fecha: sale.fecha,
                    fecha_vencimiento: vencimiento.toISOString().split('T')[0],
                    estado: 'pendiente'
                });
            }
        } else {
            const client = this.getClient(saleData.cliente_id);
            const clientName = client ? client.nombre : '';

            if (existingSale.tipo_venta === 'contado') {
                const bankMovements = this.getAll(this.KEYS.BANK_MOVEMENTS);
                const movIdx = bankMovements.findIndex(m => m.referencia_id === savedSale.id && m.tipo === 'ingreso');
                
                const recibos = this.getAll(this.KEYS.RECIBOS_CAJA);
                const recIdx = recibos.findIndex(r => r.observacion === `Pago contado - Venta #${savedSale.numero || savedSale.id.slice(-6)}` || r.observaciones === `Pago contado - Venta #${savedSale.numero || savedSale.id.slice(-6)}`);
                
                if (saleData.tipo_venta === 'contado') {
                    if (movIdx !== -1) {
                        const oldBancoId = bankMovements[movIdx].banco_id;
                        bankMovements[movIdx].banco_id = bancoId;
                        bankMovements[movIdx].monto = total;
                        bankMovements[movIdx].fecha = sale.fecha;
                        bankMovements[movIdx].descripcion = `Factura contado #${sale.numero || sale.id.slice(-6)}: ${clientName}`;
                        this._persist(this.KEYS.BANK_MOVEMENTS, bankMovements);
                        
                        this.recalcBankBalance(oldBancoId);
                        if (oldBancoId !== bancoId) {
                            this.recalcBankBalance(bancoId);
                        }
                    } else if (bancoId) {
                        this.addBankMovement({
                            banco_id: bancoId,
                            tipo: 'ingreso',
                            monto: total,
                            descripcion: `Factura contado #${sale.numero || sale.id.slice(-6)}: ${clientName}`,
                            referencia_id: savedSale.id,
                            fecha: sale.fecha
                        });
                    }
                    
                    if (recIdx !== -1) {
                        recibos[recIdx].banco_id = bancoId;
                        recibos[recIdx].monto_total = total;
                        recibos[recIdx].fecha = sale.fecha;
                        recibos[recIdx].cliente_id = saleData.cliente_id;
                        this._persist(this.KEYS.RECIBOS_CAJA, recibos);
                    }
                } else {
                    // Changed from Contado to Credito: Delete bank movement and recibo, create cartera
                    if (movIdx !== -1) {
                        const oldBancoId = bankMovements[movIdx].banco_id;
                        bankMovements.splice(movIdx, 1);
                        this._persist(this.KEYS.BANK_MOVEMENTS, bankMovements);
                        this.recalcBankBalance(oldBancoId);
                    }
                    if (recIdx !== -1) {
                        recibos.splice(recIdx, 1);
                        this._persist(this.KEYS.RECIBOS_CAJA, recibos);
                    }
                    
                    const plazoDias = client ? parseInt(client.plazo_dias) || 30 : 30;
                    const baseDate = sale.fecha ? new Date(sale.fecha.includes('T') ? sale.fecha : sale.fecha + 'T00:00:00') : new Date();
                    const vencimiento = new Date(baseDate);
                    vencimiento.setDate(vencimiento.getDate() + plazoDias);
                    
                    this.save(this.KEYS.CARTERA, {
                        venta_id: savedSale.id,
                        cliente_id: saleData.cliente_id,
                        total: total,
                        saldo: total,
                        fecha: sale.fecha,
                        fecha_vencimiento: vencimiento.toISOString().split('T')[0],
                        estado: 'pendiente'
                    });
                }
            } else if (existingSale.tipo_venta === 'credito') {
                const carteraList = this.getAll(this.KEYS.CARTERA);
                const carteraIdx = carteraList.findIndex(c => c.venta_id === savedSale.id);
                
                if (saleData.tipo_venta === 'credito') {
                    if (carteraIdx !== -1) {
                        const cItem = carteraList[carteraIdx];
                        const totalAbonado = parseFloat(cItem.total) - parseFloat(cItem.saldo);
                        cItem.total = total;
                        cItem.saldo = Math.max(0, total - totalAbonado);
                        cItem.cliente_id = saleData.cliente_id;
                        cItem.fecha = sale.fecha;
                        
                        const plazoDias = client ? parseInt(client.plazo_dias) || 30 : 30;
                        const baseDate = sale.fecha ? new Date(sale.fecha.includes('T') ? sale.fecha : sale.fecha + 'T00:00:00') : new Date();
                        const vencimiento = new Date(baseDate);
                        vencimiento.setDate(vencimiento.getDate() + plazoDias);
                        cItem.fecha_vencimiento = vencimiento.toISOString().split('T')[0];
                        
                        if (cItem.saldo === 0) {
                            cItem.estado = 'pagada';
                        } else {
                            const today = new Date().toISOString().split('T')[0];
                            cItem.estado = cItem.fecha_vencimiento < today ? 'vencida' : 'pendiente';
                        }
                        cItem.updated_at = new Date().toISOString();
                        this._persist(this.KEYS.CARTERA, carteraList);
                    }
                } else {
                    // Changed from Credito to Contado: Delete cartera entry and create bank movement + recibo
                    if (carteraIdx !== -1) {
                        carteraList.splice(carteraIdx, 1);
                        this._persist(this.KEYS.CARTERA, carteraList);
                    }
                    
                    const recibo = {
                        id: this.genId(),
                        numero: this.getNextNumber('recibo'),
                        cliente_id: saleData.cliente_id,
                        banco_id: bancoId,
                        monto_total: total,
                        fecha: sale.fecha,
                        estado: 'activo',
                        observacion: `Pago contado - Venta #${sale.numero || sale.id.slice(-6)}`,
                        created_at: new Date().toISOString()
                    };
                    this.save(this.KEYS.RECIBOS_CAJA, recibo);

                    this.addBankMovement({
                        banco_id: bancoId,
                        tipo: 'ingreso',
                        monto: total,
                        descripcion: `Factura contado #${sale.numero || sale.id.slice(-6)}: ${clientName}`,
                        referencia_id: savedSale.id,
                        fecha: sale.fecha
                    });
                }
            }
        }

        return savedSale;
    },

    anularSale(saleId) {
        const sale = this.getSale(saleId);
        if (!sale) return { success: false, message: 'Factura no encontrada' };
        if (sale.estado === 'anulada') return { success: false, message: 'La factura ya está anulada' };

        // 1. Restore Inventory and FIFO lots
        const details = this.getSaleDetails(saleId);
        details.forEach(d => {
            const product = this.getProduct(d.producto_id);
            if (product) {
                this.adjustStock(d.producto_id, parseInt(product.stock_actual) + parseInt(d.cantidad));
            }
            // Restore FIFO lots
            if (d.fifo_details) {
                this.restoreFIFO(d.fifo_details);
            }
        });

        // 2. Reverse Bank or Cartera (BUG-03 fix: use sale's banco_id)
        if (sale.tipo_venta === 'contado') {
            const targetBankId = sale.banco_id || (this.getBanks()[0] ? this.getBanks()[0].id : null);
            if (targetBankId) {
                this.addBankMovement({
                    banco_id: targetBankId,
                    tipo: 'egreso',
                    monto: sale.total,
                    descripcion: `Reversión anulación Factura #${sale.numero || sale.id.substr(-6).toUpperCase()}`,
                    referencia_id: sale.id,
                    fecha: new Date().toISOString().split('T')[0]
                });
            }
        } else if (sale.tipo_venta === 'credito') {
            let cartera = this.getAll(this.KEYS.CARTERA);
            cartera = cartera.map(c => {
                if (c.venta_id === sale.id) {
                    c.estado = 'anulada';
                    c.saldo = 0;
                }
                return c;
            });
            this._persist(this.KEYS.CARTERA, cartera);
        }

        // 3. Mark as annulled
        sale.estado = 'anulada';
        sale.utilidad = 0;
        this.save(this.KEYS.SALES, sale);

        return { success: true, message: 'Factura anulada correctamente' };
    },

    // =========================================================
    // Devoluciones (Sales Returns)
    // =========================================================
    getDevoluciones() { return this.getAll(this.KEYS.DEVOLUCIONES); },
    getDevolucion(id) { return this.getById(this.KEYS.DEVOLUCIONES, id); },
    getDevolucionDetails(devolucionId) {
        return this.getAll(this.KEYS.DEVOLUCION_DETAILS).filter(d => d.devolucion_id === devolucionId);
    },

    registerDevolucion(devolucionData, details) {
        // 1. Validations
        if (!devolucionData.venta_id) throw new Error('La factura de venta es obligatoria.');
        if (!details || details.length === 0) throw new Error('Debe agregar al menos un producto para la devolución.');

        const sale = this.getSale(devolucionData.venta_id);
        if (!sale) throw new Error('Factura de venta no encontrada.');
        if (sale.estado === 'anulada') throw new Error('No se pueden realizar devoluciones sobre una factura anulada.');

        let totalDevolucion = 0;
        details.forEach(d => {
            const saleDetail = this.getSaleDetails(devolucionData.venta_id).find(sd => sd.producto_id === d.producto_id);
            if (!saleDetail) throw new Error('El producto no pertenece a la factura original.');
            if (parseInt(d.cantidad) > parseInt(saleDetail.cantidad)) {
                throw new Error(`La cantidad a devolver (${d.cantidad}) excede la cantidad vendida (${saleDetail.cantidad}).`);
            }
            d.subtotal = parseFloat(saleDetail.precio_unitario) * parseInt(d.cantidad);
            totalDevolucion += d.subtotal;
        });

        // 2. Save Devolucion Header
        const devolucion = {
            ...devolucionData,
            total: totalDevolucion,
            fecha: (devolucionData.fecha && devolucionData.fecha !== new Date().toISOString().split('T')[0]) ? (devolucionData.fecha + (devolucionData.fecha.includes('T') ? '' : 'T00:00:00')) : new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        const savedDevolucion = this.save(this.KEYS.DEVOLUCIONES, devolucion);

        // 3. Save Devolucion Details
        const allDetails = this.getAll(this.KEYS.DEVOLUCION_DETAILS);
        details.forEach(d => {
            d.id = this.genId();
            d.devolucion_id = savedDevolucion.id;
            allDetails.push(d);

            // 4. Restore Inventory
            const product = this.getProduct(d.producto_id);
            if (product) {
                this.adjustStock(d.producto_id, parseInt(product.stock_actual) + parseInt(d.cantidad));
            }

            // 4b. Restore FIFO lots from original sale detail
            const saleDetail = this.getSaleDetails(devolucionData.venta_id).find(sd => sd.producto_id === d.producto_id);
            if (saleDetail && saleDetail.fifo_details) {
                // Calculate proportional restoration based on returned qty vs sold qty
                const ratio = parseInt(d.cantidad) / parseInt(saleDetail.cantidad);
                const partialFifo = saleDetail.fifo_details.map(fd => ({
                    lote_id: fd.lote_id,
                    cantidad: Math.round(fd.cantidad * ratio),
                    costo_unitario: fd.costo_unitario
                }));
                this.restoreFIFO(partialFifo);
            }
        });
        this._persist(this.KEYS.DEVOLUCION_DETAILS, allDetails);

        // 5. Accounting Adjustments
        if (sale.tipo_venta === 'contado') {
            // Cash sale: Money back (Bank exit)
            const defaultBank = this.getBanks()[0];
            if (defaultBank) {
                this.addBankMovement({
                    banco_id: devolucionData.banco_id || defaultBank.id,
                    tipo: 'egreso',
                    monto: totalDevolucion,
                    descripcion: `Devolución Venta #${sale.numero || sale.id.substr(-6).toUpperCase()} (Dev. #${savedDevolucion.id.substr(-6).toUpperCase()})`,
                    referencia_id: savedDevolucion.id,
                    fecha: devolucion.fecha
                });
            }
        } else if (sale.tipo_venta === 'credito') {
            // Credit sale: Reduce Cartera Balance
            const carteraItems = this.getAll(this.KEYS.CARTERA);
            const carteraIdx = carteraItems.findIndex(c => c.venta_id === sale.id);
            if (carteraIdx !== -1) {
                const c = carteraItems[carteraIdx];
                c.saldo = Math.max(0, parseFloat(c.saldo) - totalDevolucion);
                if (c.saldo === 0) {
                    c.estado = 'pagada';
                }
                c.updated_at = new Date().toISOString();
                this._persist(this.KEYS.CARTERA, carteraItems);
            }
        }

        return savedDevolucion;
    },

    // =========================================================
    // Compras (Entradas de Inventario)
    // =========================================================
    getCompras() { return this.getAll(this.KEYS.COMPRAS); },
    getCompra(id) { return this.getById(this.KEYS.COMPRAS, id); },
    getCompraDetails(compraId) {
        return this.getAll(this.KEYS.COMPRA_DETAILS).filter(d => d.compra_id === compraId);
    },

    registerCompra(compraData, details, bancoId) {
        let total = 0;

        details.forEach(d => {
            d.subtotal = parseFloat(d.costo_unitario) * parseInt(d.cantidad);
            total += d.subtotal;
        });

        const isNew = !compraData.id;

        // Retrieve existing if possible
        let existingCompra = null;
        if (!isNew) {
            existingCompra = this.getCompra(compraData.id);
        }

        const compra = {
            ...existingCompra,
            ...compraData,
            numero: existingCompra ? existingCompra.numero : this.getNextNumber('compra'),
            total: total,
            fecha: (compraData.fecha && compraData.fecha !== new Date().toISOString().split('T')[0]) ? (compraData.fecha + (compraData.fecha.includes('T') ? '' : 'T00:00:00')) : new Date().toISOString()
        };

        const savedCompra = this.save(this.KEYS.COMPRAS, compra);

        // First remove old details if updating
        if (!isNew) {
            let allDetails = this.getAll(this.KEYS.COMPRA_DETAILS);
            allDetails = allDetails.filter(d => d.compra_id !== savedCompra.id);
            this._persist(this.KEYS.COMPRA_DETAILS, allDetails);
        }

        // Save new details
        let allDetailsList = this.getAll(this.KEYS.COMPRA_DETAILS);
        details.forEach(d => {
            d.compra_id = savedCompra.id;
            d.id = this.genId();
            allDetailsList.push(d);
        });
        this._persist(this.KEYS.COMPRA_DETAILS, allDetailsList);

        // Apply effects ONLY if estado === 'recibida' and NOT already procesada
        if (compra.estado === 'recibida' && (!existingCompra || !existingCompra.procesada)) {
            details.forEach(d => {
                const product = this.getProduct(d.producto_id);
                if (product) {
                    const stockAnt = parseInt(product.stock_actual) || 0;
                    const cantComp = parseInt(d.cantidad);
                    const costoComp = parseFloat(d.costo_unitario);

                    // FIFO: Create a new inventory lot for this purchase
                    this.addInventoryLot(d.producto_id, cantComp, costoComp, savedCompra.id, compra.fecha);

                    // Update product cost to the latest purchase cost (reference only)
                    this.updateProductCost(d.producto_id, costoComp.toFixed(2));
                    this.adjustStock(d.producto_id, stockAnt + cantComp);

                    if (d.precio_venta_sugerido) {
                        this.updateProductPrice(d.producto_id, d.precio_venta_sugerido);
                    }
                }
            });

            if (compra.tipo_pago === 'contado' && bancoId) {
                // 1. Registrar el pago en el historial de pagos a proveedores
                const pagoRepo = {
                    id: this.genId(),
                    numero: this.getNextNumber('pago_proveedor'),
                    cartera_id: null, // No viene de una deuda previa
                    proveedor_id: null, // Podría buscarse por nombre si es necesario
                    proveedor_nombre: compra.proveedor,
                    banco_id: bancoId,
                    monto: total,
                    fecha: compra.fecha,
                    created_at: new Date().toISOString()
                };
                this.save(this.KEYS.PAGOS_PROVEEDORES, pagoRepo);

                // 2. Generar egreso bancario
                this.addBankMovement({
                    banco_id: bancoId,
                    tipo: 'egreso',
                    monto: total,
                    descripcion: `Compra Contado #${savedCompra.numero || savedCompra.id.substr(-6)}: ${compra.proveedor || ''}`,
                    referencia_id: savedCompra.id,
                    fecha: compra.fecha
                });
            } else if (compra.tipo_pago === 'credito') {
                // Generar cuenta por pagar en Cartera de Proveedores
                const allCarteraProv = this.getAll(this.KEYS.CARTERA_PROVEEDORES);
                const prov = this.getClients().find(cl => cl.nombre === compra.proveedor);

                const plazoDias = prov ? parseInt(prov.plazo_dias) || 30 : 30;
                // Parse date safely: only append time if it's a date-only string
                const baseDate = compra.fecha ? new Date(compra.fecha.includes('T') ? compra.fecha : compra.fecha + 'T00:00:00') : new Date();
                const vencimiento = new Date(baseDate);
                vencimiento.setDate(vencimiento.getDate() + plazoDias);

                allCarteraProv.push({
                    id: this.genId(),
                    compra_id: savedCompra.id,
                    proveedor_id: prov ? prov.id : null,
                    proveedor_nombre: compra.proveedor,
                    total: total,
                    saldo: total,
                    fecha: compra.fecha,
                    fecha_vencimiento: vencimiento.toISOString().split('T')[0],
                    estado: 'vigente',
                    created_at: new Date().toISOString()
                });
                this._persist(this.KEYS.CARTERA_PROVEEDORES, allCarteraProv);
            }

            compra.procesada = true;
            this.save(this.KEYS.COMPRAS, compra);
        }

        return savedCompra;
    },

    // =========================================================
    // Cartera
    // =========================================================
    getCartera(filter) {
        let items = this.getAll(this.KEYS.CARTERA);
        const today = new Date().toISOString().split('T')[0];

        // Update status of overdue items
        items.forEach(item => {
            if (item.estado === 'vigente' && item.fecha_vencimiento < today) {
                item.estado = 'vencida';
            }
        });
        this._persist(this.KEYS.CARTERA, items);

        if (filter && filter !== 'todas') {
            items = items.filter(c => c.estado === filter);
        }
        return items;
    },

    getCarteraItem(id) { return this.getById(this.KEYS.CARTERA, id); },

    registerAbono(carteraId, monto, bancoId) {
        const items = this.getAll(this.KEYS.CARTERA);
        const idx = items.findIndex(c => c.id === carteraId);
        if (idx === -1) {
            return false;
        }

        const item = items[idx];
        const valMonto = parseFloat(monto);

        if (isNaN(valMonto) || valMonto <= 0) {
            return false;
        }

        // 1. Update Cartera Balance
        item.saldo = parseFloat(item.saldo) - valMonto;
        if (item.saldo <= 0) {
            item.saldo = 0;
            item.estado = 'pagada';
        }
        item.updated_at = new Date().toISOString();
        items[idx] = item;
        this._persist(this.KEYS.CARTERA, items);

        // 2. Generate Recibo de Caja (for history)
        const client = this.getClient(item.cliente_id);
        const recibo = {
            id: this.genId(),
            numero: this.getNextNumber('recibo'),
            cliente_id: item.cliente_id,
            banco_id: bancoId,
            monto_total: valMonto,
            fecha: new Date().toISOString(),
            estado: 'activo',
            observacion: `Abono a Factura #${item.venta_id ? item.venta_id.slice(-6).toUpperCase() : 'N/A'}`,
            created_at: new Date().toISOString()
        };
        this.save(this.KEYS.RECIBOS_CAJA, recibo);

        // Save Detail
        const details = this.getAll(this.KEYS.RECIBO_CAJA_DETALLE);
        details.push({
            id: this.genId(),
            recibo_caja_id: recibo.id,
            cartera_id: item.id,
            factura_id: item.venta_id,
            monto_aplicado: valMonto
        });
        this._persist(this.KEYS.RECIBO_CAJA_DETALLE, details);

        // 3. Update Sale status if fully paid
        if (item.saldo === 0 && item.venta_id) {
            const sale = this.getSale(item.venta_id);
            if (sale && sale.estado !== 'anulada') {
                sale.estado = 'pagada';
                this.save(this.KEYS.SALES, sale);
            }
        }

        // 4. Generate bank income
        this.addBankMovement({
            banco_id: bancoId,
            tipo: 'ingreso',
            monto: valMonto,
            descripcion: `Recibo de Caja #${recibo.numero} - Abono ${client ? client.nombre : 'Cliente'}`,
            referencia_id: recibo.id,
            fecha: new Date().toISOString()
        });

        return true;
    },

    // =========================================================
    // Banks
    // =========================================================
    getBanks() { return this.getAll(this.KEYS.BANKS); },
    getBank(id) { return this.getById(this.KEYS.BANKS, id); },
    saveBank(bank) { return this.save(this.KEYS.BANKS, bank); },
    deleteBank(id) { this.delete(this.KEYS.BANKS, id); },

    // Internal helper for robust numeric parsing
    _parseNum(val) {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        // Handle strings with thousands separators (dots) and decimal separators (commas)
        // This is a common pattern in COP: 1.000.000,00
        let str = val.toString().trim();
        if (str.includes('.') && str.includes(',')) {
            // Standard COP format: 1.000.000,50 -> 1000000.50
            str = str.replace(/\./g, '').replace(',', '.');
        } else if (str.includes('.') && str.split('.').pop().length === 3) {
            // Likely thousands separator only: 1.000 -> 1000
            str = str.replace(/\./g, '');
        } else if (str.includes(',')) {
            // Decimal comma: 1000,50 -> 1000.50
            str = str.replace(',', '.');
        }
        const n = parseFloat(str);
        return isNaN(n) ? 0 : n;
    },

    getBankMovements(bankId) {
        let movements = this.getAll(this.KEYS.BANK_MOVEMENTS);
        if (bankId) {
            const targetId = bankId.toString();
            movements = movements.filter(m => m.banco_id && m.banco_id.toString() === targetId);
        }
        return movements.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    },

    addBankMovement(movement) {
        movement.id = this.genId();
        movement.created_at = new Date().toISOString();
        const movements = this.getAll(this.KEYS.BANK_MOVEMENTS);
        movements.push(movement);
        this._persist(this.KEYS.BANK_MOVEMENTS, movements);

        // Recalculate bank balance
        this.recalcBankBalance(movement.banco_id);
        return movement;
    },

    recalcBankBalance(bankId) {
        if (!bankId) return;

        const targetId = bankId.toString();
        const movements = this.getAll(this.KEYS.BANK_MOVEMENTS);

        let saldo = 0;
        movements.forEach(m => {
            if (m.banco_id && m.banco_id.toString() === targetId) {
                const amount = this._parseNum(m.monto);
                if (m.tipo === 'ingreso') saldo += amount;
                else saldo -= amount;
            }
        });

        const banks = this.getAll(this.KEYS.BANKS);
        const idx = banks.findIndex(b => b.id && b.id.toString() === targetId);
        if (idx !== -1) {
            const oldSaldo = banks[idx].saldo_actual;
            banks[idx].saldo_actual = saldo;
            banks[idx].updated_at = new Date().toISOString();
            this._persist(this.KEYS.BANKS, banks);
        } else {
            console.warn(`DB: No se pudo encontrar el banco con ID ${targetId} para actualizar saldo.`);
        }
    },

    recalibrateAllBanks() {
        const banks = this.getBanks();
        banks.forEach(b => this.recalcBankBalance(b.id));
    },

    getTotalBankBalance() {
        return this.getBanks().reduce((sum, b) => sum + parseFloat(b.saldo_actual || 0), 0);
    },

    // =========================================================
    // Recibos de Caja (Pagos Recibidos)
    // =========================================================
    getRecibosCaja() { return this.getAll(this.KEYS.RECIBOS_CAJA); },
    getReciboCaja(id) { return this.getById(this.KEYS.RECIBOS_CAJA, id); },
    getReciboCajaDetails(reciboId) {
        return this.getAll(this.KEYS.RECIBO_CAJA_DETALLE).filter(d => d.recibo_caja_id === reciboId);
    },

    getFacturasPendientesByCliente(clienteId) {
        return this.getAll(this.KEYS.CARTERA)
            .filter(c => c.cliente_id === clienteId && parseFloat(c.saldo) > 0 && c.estado !== 'anulada')
            .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));
    },

    registerReciboCaja(reciboData, detalles) {
        // 1. Validations
        if (!reciboData.cliente_id) throw new Error('Debe seleccionar un cliente.');
        if (!reciboData.banco_id) throw new Error('Debe seleccionar un banco.');
        if (!reciboData.fecha) throw new Error('La fecha es obligatoria.');
        if (!reciboData.monto_total || parseFloat(reciboData.monto_total) <= 0) throw new Error('El monto total debe ser mayor a 0.');
        if (!detalles || detalles.length === 0) throw new Error('Debe aplicar el pago a al menos una factura.');

        const montoTotal = parseFloat(reciboData.monto_total);
        let sumaAplicada = 0;

        // Validate each detail
        const carteraItems = this.getAll(this.KEYS.CARTERA);
        detalles.forEach(d => {
            const monto = parseFloat(d.monto_aplicado);
            if (monto <= 0) throw new Error('Los montos aplicados deben ser mayores a 0.');
            const carteraItem = carteraItems.find(c => c.id === d.cartera_id);
            if (!carteraItem) throw new Error(`Factura de cartera no encontrada: ${d.cartera_id}`);
            if (monto > parseFloat(carteraItem.saldo) + 0.01) {
                throw new Error(`El monto aplicado ($${monto.toLocaleString()}) excede el saldo pendiente ($${parseFloat(carteraItem.saldo).toLocaleString()}).`);
            }
            sumaAplicada += monto;
        });

        // Validate sum equals total (with tolerance)
        if (Math.abs(sumaAplicada - montoTotal) > 1) {
            throw new Error(`La suma de montos aplicados ($${sumaAplicada.toLocaleString()}) no coincide con el monto total ($${montoTotal.toLocaleString()}).`);
        }

        // 2. Save header
        const recibo = {
            ...reciboData,
            numero: this.getNextNumber('recibo'),
            monto_total: montoTotal,
            estado: 'activo',
            fecha: (reciboData.fecha && reciboData.fecha !== new Date().toISOString().split('T')[0]) ? (reciboData.fecha + (reciboData.fecha.includes('T') ? '' : 'T00:00:00')) : new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        const savedRecibo = this.save(this.KEYS.RECIBOS_CAJA, recibo);

        // 3. Save details
        let allDetails = this.getAll(this.KEYS.RECIBO_CAJA_DETALLE);
        detalles.forEach(d => {
            allDetails.push({
                id: this.genId(),
                recibo_caja_id: savedRecibo.id,
                cartera_id: d.cartera_id,
                factura_id: d.factura_id,
                monto_aplicado: parseFloat(d.monto_aplicado)
            });
        });
        this._persist(this.KEYS.RECIBO_CAJA_DETALLE, allDetails);

        // 4. Apply to cartera (reduce saldos)
        detalles.forEach(d => {
            const idx = carteraItems.findIndex(c => c.id === d.cartera_id);
            if (idx !== -1) {
                carteraItems[idx].saldo = parseFloat(carteraItems[idx].saldo) - parseFloat(d.monto_aplicado);
                if (carteraItems[idx].saldo <= 0) {
                    carteraItems[idx].saldo = 0;
                    carteraItems[idx].estado = 'pagada';
                }
                carteraItems[idx].updated_at = new Date().toISOString();
            }
        });
        this._persist(this.KEYS.CARTERA, carteraItems);

        // 5. Update sale estado if fully paid
        detalles.forEach(d => {
            const carteraItem = carteraItems.find(c => c.id === d.cartera_id);
            if (carteraItem && carteraItem.saldo === 0 && carteraItem.venta_id) {
                const sale = this.getSale(carteraItem.venta_id);
                if (sale && sale.estado !== 'anulada') {
                    sale.estado = 'pagada';
                    this.save(this.KEYS.SALES, sale);
                }
            }
        });

        // 6. Single bank movement
        this.addBankMovement({
            banco_id: reciboData.banco_id,
            tipo: 'ingreso',
            monto: montoTotal,
            descripcion: `Recibo de Caja #${savedRecibo.numero || savedRecibo.id.substr(-6).toUpperCase()}`,
            referencia_id: savedRecibo.id,
            fecha: reciboData.fecha
        });

        return savedRecibo;
    },

    anularReciboCaja(reciboId) {
        const recibo = this.getReciboCaja(reciboId);
        if (!recibo) throw new Error('Recibo no encontrado.');
        if (recibo.estado === 'anulado') throw new Error('El recibo ya está anulado.');

        const detalles = this.getReciboCajaDetails(reciboId);
        const carteraItems = this.getAll(this.KEYS.CARTERA);

        // 1. Restore saldos in cartera
        detalles.forEach(d => {
            const idx = carteraItems.findIndex(c => c.id === d.cartera_id);
            if (idx !== -1) {
                carteraItems[idx].saldo = parseFloat(carteraItems[idx].saldo) + parseFloat(d.monto_aplicado);
                if (carteraItems[idx].saldo > 0) {
                    const today = new Date().toISOString().split('T')[0];
                    carteraItems[idx].estado = carteraItems[idx].fecha_vencimiento < today ? 'vencida' : 'vigente';
                }
                carteraItems[idx].updated_at = new Date().toISOString();
            }
        });
        this._persist(this.KEYS.CARTERA, carteraItems);

        // 2. Update sale estado back to pendiente
        detalles.forEach(d => {
            const carteraItem = carteraItems.find(c => c.id === d.cartera_id);
            if (carteraItem && carteraItem.venta_id) {
                const sale = this.getSale(carteraItem.venta_id);
                if (sale && sale.estado === 'pagada') {
                    sale.estado = 'pendiente';
                    this.save(this.KEYS.SALES, sale);
                }
            }
        });

        // 3. Reverse bank movement
        this.addBankMovement({
            banco_id: recibo.banco_id,
            tipo: 'egreso',
            monto: parseFloat(recibo.monto_total),
            descripcion: `Anulación Recibo #${recibo.id.substr(-6).toUpperCase()}`,
            referencia_id: recibo.id,
            fecha: new Date().toISOString().split('T')[0]
        });

        // 4. Mark as annulled
        recibo.estado = 'anulado';
        recibo.updated_at = new Date().toISOString();
        this.save(this.KEYS.RECIBOS_CAJA, recibo);

        return { success: true, message: 'Recibo anulado correctamente.' };
    },

    // =========================================================
    // Expenses
    // =========================================================
    getExpenses() { return this.getAll(this.KEYS.EXPENSES); },
    getExpense(id) { return this.getById(this.KEYS.EXPENSES, id); },

    saveExpense(expense, isNew = true) {
        const saved = this.save(this.KEYS.EXPENSES, expense);

        if (isNew && expense.banco_id) {
            // Generate bank egress
            this.addBankMovement({
                banco_id: expense.banco_id,
                tipo: 'egreso',
                monto: parseFloat(expense.monto),
                descripcion: `Gasto: ${expense.descripcion}`,
                referencia_id: saved.id,
                fecha: (expense.fecha && expense.fecha !== new Date().toISOString().split('T')[0]) ? (expense.fecha + (expense.fecha.includes('T') ? '' : 'T00:00:00')) : new Date().toISOString()
            });
        }

        return saved;
    },

    // =========================================================
    // CARTERA PROVEEDORES
    // =========================================================
    getCarteraProveedores(filter = 'todas') {
        let items = this.getAll(this.KEYS.CARTERA_PROVEEDORES);
        const today = new Date().toISOString().split('T')[0];

        if (filter === 'vencida') {
            items = items.filter(i => i.saldo > 0 && i.fecha_vencimiento < today);
        } else if (filter === 'vigente') {
            items = items.filter(i => i.saldo > 0 && i.fecha_vencimiento >= today);
        } else if (filter === 'pagada') {
            items = items.filter(i => i.saldo <= 0);
        }

        return items.sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));
    },

    registerPagoProveedor(pagoData) {
        const allCartera = this.getAll(this.KEYS.CARTERA_PROVEEDORES);
        const item = allCartera.find(i => i.id === pagoData.cartera_id);

        if (item) {
            const fechaPrecisa = (pagoData.fecha && pagoData.fecha !== new Date().toISOString().split('T')[0]) ? (pagoData.fecha + (pagoData.fecha.includes('T') ? '' : 'T00:00:00')) : new Date().toISOString();

            // 1. Guardar registro del pago (Historial)
            const pagoRepo = {
                id: this.genId(),
                numero: this.getNextNumber('pago_proveedor'),
                cartera_id: pagoData.cartera_id,
                proveedor_id: item.proveedor_id,
                proveedor_nombre: item.proveedor_nombre,
                banco_id: pagoData.banco_id,
                monto: parseFloat(pagoData.monto),
                fecha: fechaPrecisa,
                created_at: new Date().toISOString()
            };
            this.save(this.KEYS.PAGOS_PROVEEDORES, pagoRepo);

            // 2. Actualizar saldo en cartera
            item.saldo -= parseFloat(pagoData.monto);
            if (item.saldo <= 0) {
                item.saldo = 0;
                item.estado = 'pagada';
            }
            this._persist(this.KEYS.CARTERA_PROVEEDORES, allCartera);

            // 3. Registrar egreso bancario
            this.addBankMovement({
                banco_id: pagoData.banco_id,
                tipo: 'egreso',
                monto: parseFloat(pagoData.monto),
                descripcion: `Pago a Proveedor #${pagoRepo.numero}: ${item.proveedor_nombre} (Ref. Compra #${item.compra_id.substr(-6).toUpperCase()})`,
                referencia_id: pagoRepo.id,
                fecha: fechaPrecisa
            });

            return true;
        }
        return false;
    },

    getPagosProveedores() {
        return this.getAll(this.KEYS.PAGOS_PROVEEDORES);
    },

    deleteExpense(id) { this.delete(this.KEYS.EXPENSES, id); },

    // =========================================================
    // Dashboard Metrics
    // =========================================================
    getDashboardMetrics() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const sales = this.getSales();
        const monthSales = sales.filter(s => {
            const d = new Date(s.fecha);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const ventasMes = monthSales.reduce((sum, s) => sum + parseFloat(s.total), 0);
        const utilidadMes = monthSales.reduce((sum, s) => sum + parseFloat(s.utilidad), 0);

        const cartera = this.getCartera();
        const totalCartera = cartera.filter(c => c.estado !== 'pagada')
            .reduce((sum, c) => sum + parseFloat(c.saldo), 0);
        const carteraVencida = cartera.filter(c => c.estado === 'vencida')
            .reduce((sum, c) => sum + parseFloat(c.saldo), 0);

        const products = this.getProducts();
        const inventarioValorizado = products.reduce((sum, p) =>
            sum + (parseFloat(p.stock_actual) * parseFloat(p.precio_compra)), 0);

        const saldoBancos = this.getTotalBankBalance();

        // Sales last 7 days
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const daySales = sales.filter(s => s.fecha && s.fecha.startsWith(dateStr));
            last7Days.push({
                date: dateStr,
                label: d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }),
                total: daySales.reduce((sum, s) => sum + parseFloat(s.total), 0),
                count: daySales.length
            });
        }

        // Previous month comparison
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const prevMonthSales = sales.filter(s => {
            const d = new Date(s.fecha);
            return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        });
        const ventasMesAnterior = prevMonthSales.reduce((sum, s) => sum + parseFloat(s.total), 0);
        const cambioVentas = ventasMesAnterior > 0
            ? ((ventasMes - ventasMesAnterior) / ventasMesAnterior * 100).toFixed(1)
            : 0;

        return {
            ventasMes,
            utilidadMes,
            totalCartera,
            carteraVencida,
            inventarioValorizado,
            saldoBancos,
            totalClientes: this.getClients().length,
            totalProductos: products.length,
            ventasCount: monthSales.length,
            cotizacionesCount: this.getCotizaciones().length,
            last7Days,
            cambioVentas,
            productosStockBajo: products.filter(p => p.stock_actual <= p.stock_minimo).length
        };
    },

    getKardexMovements(productoId) {
        const movements = [];
        // 1. Get Sales
        const saleDetails = this.getAllActive(this.KEYS.SALE_DETAILS);
        const filteredSaleDetails = productoId ? saleDetails.filter(d => d.producto_id === productoId) : saleDetails;
        filteredSaleDetails.forEach(d => {
            const sale = this.getSale(d.venta_id);
            if (sale) {
                movements.push({
                    fecha: sale.fecha || sale.created_at,
                    producto_id: d.producto_id,
                    tipo: 'Salida (Venta)',
                    ref: sale.numero || sale.id.substr(-6).toUpperCase(),
                    cant: -parseInt(d.cantidad),
                    costo_unitario: parseFloat(d.costo_unitario || 0),
                    origen: 'Venta ' + sale.tipo_venta,
                    cliente_proveedor: this.getClient(sale.cliente_id)?.nombre || 'Cliente N/A'
                });
            }
        });

        // 2. Get Purchases
        const compraDetails = this.getAllActive(this.KEYS.COMPRA_DETAILS);
        const filteredCompraDetails = productoId ? compraDetails.filter(d => d.producto_id === productoId) : compraDetails;
        filteredCompraDetails.forEach(d => {
            const compra = this.getById(this.KEYS.COMPRAS, d.compra_id);
            if (compra) {
                movements.push({
                    fecha: compra.fecha || compra.created_at,
                    producto_id: d.producto_id,
                    tipo: 'Entrada (Compra)',
                    ref: compra.numero || compra.id.substr(-6).toUpperCase(),
                    cant: parseInt(d.cantidad),
                    costo_unitario: parseFloat(d.costo_unitario || 0),
                    origen: 'Compra ' + (compra.proveedor || ''),
                    cliente_proveedor: compra.proveedor || 'Proveedor N/A'
                });
            }
        });

        // 3. Get Returns
        const devDetails = this.getAllActive(this.KEYS.DEVOLUCION_DETAILS);
        const filteredDevDetails = productoId ? devDetails.filter(d => d.producto_id === productoId) : devDetails;
        filteredDevDetails.forEach(d => {
            const dev = this.getById(this.KEYS.DEVOLUCIONES, d.devolucion_id);
            if (dev) {
                const sale = this.getSale(dev.venta_id);
                movements.push({
                    fecha: dev.fecha || dev.created_at,
                    producto_id: d.producto_id,
                    tipo: 'Entrada (Devolución)',
                    ref: dev.id.substr(-6).toUpperCase(),
                    cant: parseInt(d.cantidad),
                    costo_unitario: parseFloat(d.subtotal / d.cantidad || 0),
                    origen: 'Devolución Venta #' + (sale ? (sale.numero || sale.id.substr(-6).toUpperCase()) : 'N/A'),
                    cliente_proveedor: sale ? (this.getClient(sale.cliente_id)?.nombre || 'Cliente N/A') : 'Cliente N/A'
                });
            }
        });

        // 4. Get Adjustments
        const allAdjustments = this.getAllActive(this.KEYS.KARDEX);
        const filteredAdjustments = productoId ? allAdjustments.filter(k => k.producto_id === productoId) : allAdjustments;
        filteredAdjustments.forEach(k => {
            movements.push({
                fecha: k.fecha,
                producto_id: k.producto_id,
                tipo: k.movimiento_cantidad > 0 ? 'Entrada (Ajuste)' : 'Salida (Ajuste)',
                ref: 'Ajuste',
                cant: parseInt(k.movimiento_cantidad),
                costo_unitario: parseFloat(k.costo_unitario || 0),
                origen: k.motivo || 'Ajuste de Stock',
                cliente_proveedor: 'Ajuste Manual'
            });
        });

        // Sort by date descending
        return movements.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    },

    // =========================================================
    // Reports Data
    // =========================================================
    getReportData(type, filters = {}) {
        const { desde, hasta, clienteId } = filters;

        switch (type) {
            case 'ventas': {
                let sales = this.getSales();
                if (desde) sales = sales.filter(s => s.fecha >= desde);
                if (hasta) sales = sales.filter(s => s.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                return sales.map(s => {
                    const client = this.getClient(s.cliente_id);
                    const seller = s.vendedor_id ? this.getSeller(s.vendedor_id) : null;
                    return { 
                        ...s, 
                        cliente_nombre: client ? client.nombre : 'N/A',
                        vendedor_nombre: seller ? seller.nombre : 'Sin Asesor'
                    };
                });
            }
            case 'utilidad': {
                let sales = this.getSales();
                if (desde) sales = sales.filter(s => s.fecha >= desde);
                if (hasta) sales = sales.filter(s => s.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                return sales.map(s => ({
                    fecha: s.fecha,
                    total: s.total,
                    costo: s.total_costo,
                    utilidad: s.utilidad
                }));
            }
            case 'cartera': {
                let cartera = this.getCartera();
                if (clienteId) cartera = cartera.filter(c => c.cliente_id === clienteId);
                return cartera.map(c => {
                    const client = this.getClient(c.cliente_id);
                    return { ...c, cliente_nombre: client ? client.nombre : 'N/A' };
                });
            }
            case 'inventario': {
                return this.getProducts().map(p => ({
                    codigo: p.codigo,
                    nombre: p.nombre,
                    stock_actual: p.stock_actual,
                    stock_minimo: p.stock_minimo,
                    precio_compra: p.precio_compra,
                    precio_venta: p.precio_venta,
                    valor_inventario: p.stock_actual * p.precio_compra
                }));
            }
            case 'gastos': {
                let expenses = this.getExpenses();
                if (desde) expenses = expenses.filter(e => e.fecha >= desde);
                if (hasta) expenses = expenses.filter(e => e.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                return expenses;
            }
            case 'rentabilidad': {
                let sales = this.getSales().filter(s => s.estado !== 'anulada');
                if (desde) sales = sales.filter(s => s.fecha >= desde);
                if (hasta) sales = sales.filter(s => s.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                return sales.map(s => {
                    const client = this.getClient(s.cliente_id);
                    const seller = s.vendedor_id ? this.getSeller(s.vendedor_id) : null;
                    const totalNeto = parseFloat(s.total_costo) + parseFloat(s.utilidad);
                    const margin = totalNeto > 0 ? (s.utilidad / totalNeto * 100).toFixed(1) : 0;
                    return {
                        fecha: s.fecha ? s.fecha.split('T')[0] : '-',
                        referencia: s.numero || s.id.substr(-6).toUpperCase(),
                        cliente_nombre: client ? client.nombre : 'N/A',
                        vendedor_nombre: seller ? seller.nombre : 'Sin Asesor',
                        total: s.total,
                        total_neto: totalNeto,
                        total_costo: s.total_costo,
                        utilidad: s.utilidad,
                        margen: margin + '%'
                    };
                });
            }
            case 'productos_mas_vendidos': {
                let sales = this.getSales().filter(s => s.estado !== 'anulada');
                if (desde) sales = sales.filter(s => s.fecha >= desde);
                if (hasta) sales = sales.filter(s => s.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                const saleIds = new Set(sales.map(s => s.id));
                const saleDetails = this.getAllActive(this.KEYS.SALE_DETAILS).filter(d => saleIds.has(d.venta_id));
                const summary = {};
                saleDetails.forEach(d => {
                    if (!summary[d.producto_id]) {
                        const product = this.getProduct(d.producto_id);
                        summary[d.producto_id] = {
                            codigo: product ? product.codigo : 'N/A',
                            nombre: product ? product.nombre : 'Producto N/A',
                            cantidad_vendida: 0,
                            total_ingresos: 0,
                            total_costo: 0,
                            utilidad: 0
                        };
                    }
                    const qty = parseInt(d.cantidad) || 0;
                    const desc = d.descuento || 0;
                    const netSub = qty * parseFloat(d.precio_unitario) * (1 - desc / 100);
                    const cost = qty * parseFloat(d.costo_unitario || 0);
                    summary[d.producto_id].cantidad_vendida += qty;
                    summary[d.producto_id].total_ingresos += netSub;
                    summary[d.producto_id].total_costo += cost;
                    summary[d.producto_id].utilidad += (netSub - cost);
                });
                return Object.values(summary).sort((a, b) => b.cantidad_vendida - a.cantidad_vendida);
            }
            case 'baja_rotacion': {
                let sales = this.getSales().filter(s => s.estado !== 'anulada');
                if (desde) sales = sales.filter(s => s.fecha >= desde);
                if (hasta) sales = sales.filter(s => s.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                const saleIds = new Set(sales.map(s => s.id));
                const saleDetails = this.getAllActive(this.KEYS.SALE_DETAILS).filter(d => saleIds.has(d.venta_id));
                const soldQty = {};
                saleDetails.forEach(d => {
                    soldQty[d.producto_id] = (soldQty[d.producto_id] || 0) + (parseInt(d.cantidad) || 0);
                });
                return this.getProducts().map(p => {
                    const qty = soldQty[p.id] || 0;
                    return {
                        codigo: p.codigo,
                        nombre: p.nombre,
                        stock_actual: p.stock_actual,
                        cantidad_vendida: qty,
                        precio_compra: p.precio_compra,
                        valor_inventario: p.stock_actual * p.precio_compra
                    };
                }).sort((a, b) => a.cantidad_vendida - b.cantidad_vendida);
            }
            case 'clientes_mayor_compra': {
                let sales = this.getSales().filter(s => s.estado !== 'anulada');
                if (desde) sales = sales.filter(s => s.fecha >= desde);
                if (hasta) sales = sales.filter(s => s.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                const summary = {};
                sales.forEach(s => {
                    if (!summary[s.cliente_id]) {
                        const client = this.getClient(s.cliente_id);
                        summary[s.cliente_id] = {
                            nombre: client ? client.nombre : 'Cliente N/A',
                            documento: client ? client.documento : 'N/A',
                            numero_compras: 0,
                            total_comprado: 0,
                            total_utilidad: 0
                        };
                    }
                    summary[s.cliente_id].numero_compras += 1;
                    summary[s.cliente_id].total_comprado += parseFloat(s.total);
                    summary[s.cliente_id].total_utilidad += parseFloat(s.utilidad);
                });
                return Object.values(summary).sort((a, b) => b.total_comprado - a.total_comprado);
            }
            case 'flujo_caja': {
                let movements = this.getAll(this.KEYS.BANK_MOVEMENTS);
                if (desde) movements = movements.filter(m => m.fecha >= desde);
                if (hasta) movements = movements.filter(m => m.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                return movements.map(m => {
                    const bank = this.getBank(m.banco_id);
                    return {
                        fecha: m.fecha ? m.fecha.split('T')[0] : '-',
                        banco_nombre: bank ? bank.nombre : 'N/A',
                        tipo: m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
                        descripcion: m.descripcion,
                        monto: parseFloat(m.monto || 0)
                    };
                }).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
            }
            case 'estado_resultados': {
                let sales = this.getSales().filter(s => s.estado !== 'anulada');
                let expenses = this.getExpenses();
                if (desde) {
                    sales = sales.filter(s => s.fecha >= desde);
                    expenses = expenses.filter(e => e.fecha >= desde);
                }
                if (hasta) {
                    sales = sales.filter(s => s.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                    expenses = expenses.filter(e => e.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                }
                const totalIngresos = sales.reduce((sum, s) => sum + (parseFloat(s.total_costo) + parseFloat(s.utilidad)), 0);
                const totalCostos = sales.reduce((sum, s) => sum + parseFloat(s.total_costo), 0);
                const utilidadBruta = totalIngresos - totalCostos;
                const totalGastos = expenses.reduce((sum, e) => sum + parseFloat(e.monto), 0);
                const utilidadOperativa = utilidadBruta - totalGastos;
                return [{
                    ventas_totales: totalIngresos,
                    costo_ventas: totalCostos,
                    utilidad_bruta: utilidadBruta,
                    gastos_operativos: totalGastos,
                    utilidad_neta: utilidadOperativa
                }];
            }
            case 'utilidad_producto': {
                let sales = this.getSales().filter(s => s.estado !== 'anulada');
                if (desde) sales = sales.filter(s => s.fecha >= desde);
                if (hasta) sales = sales.filter(s => s.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                const saleIds = new Set(sales.map(s => s.id));
                const saleDetails = this.getAllActive(this.KEYS.SALE_DETAILS).filter(d => saleIds.has(d.venta_id));
                const summary = {};
                saleDetails.forEach(d => {
                    if (!summary[d.producto_id]) {
                        const product = this.getProduct(d.producto_id);
                        summary[d.producto_id] = {
                            codigo: product ? product.codigo : 'N/A',
                            nombre: product ? product.nombre : 'Producto N/A',
                            cantidad: 0,
                            ingresos: 0,
                            costo: 0,
                            utilidad: 0
                        };
                    }
                    const qty = parseInt(d.cantidad) || 0;
                    const desc = d.descuento || 0;
                    const revenue = qty * parseFloat(d.precio_unitario) * (1 - desc / 100);
                    const cost = qty * parseFloat(d.costo_unitario || 0);
                    summary[d.producto_id].cantidad += qty;
                    summary[d.producto_id].ingresos += revenue;
                    summary[d.producto_id].costo += cost;
                    summary[d.producto_id].utilidad += (revenue - cost);
                });
                return Object.values(summary).sort((a, b) => b.utilidad - a.utilidad);
            }
            case 'utilidad_cliente': {
                let sales = this.getSales().filter(s => s.estado !== 'anulada');
                if (desde) sales = sales.filter(s => s.fecha >= desde);
                if (hasta) sales = sales.filter(s => s.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                const summary = {};
                sales.forEach(s => {
                    if (!summary[s.cliente_id]) {
                        const client = this.getClient(s.cliente_id);
                        summary[s.cliente_id] = {
                            cliente_nombre: client ? client.nombre : 'Cliente N/A',
                            documento: client ? client.documento : 'N/A',
                            total_ventas: 0,
                            total_costo: 0,
                            utilidad: 0
                        };
                    }
                    const totalNeto = parseFloat(s.total_costo) + parseFloat(s.utilidad);
                    summary[s.cliente_id].total_ventas += totalNeto;
                    summary[s.cliente_id].total_costo += parseFloat(s.total_costo);
                    summary[s.cliente_id].utilidad += parseFloat(s.utilidad);
                });
                return Object.values(summary).sort((a, b) => b.utilidad - a.utilidad);
            }
            case 'utilidad_vendedor': {
                let sales = this.getSales().filter(s => s.estado !== 'anulada');
                if (desde) sales = sales.filter(s => s.fecha >= desde);
                if (hasta) sales = sales.filter(s => s.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                const summary = {};
                sales.forEach(s => {
                    const vId = s.vendedor_id || 'sin_asesor';
                    if (!summary[vId]) {
                        const seller = s.vendedor_id ? this.getSeller(s.vendedor_id) : null;
                        summary[vId] = {
                            vendedor_nombre: seller ? seller.nombre : 'Sin Asesor',
                            total_ventas: 0,
                            total_comision: 0,
                            utilidad: 0
                        };
                    }
                    const totalNeto = parseFloat(s.total_costo) + parseFloat(s.utilidad);
                    summary[vId].total_ventas += totalNeto;
                    summary[vId].total_comision += parseFloat(s.comision_monto || 0);
                    summary[vId].utilidad += parseFloat(s.utilidad);
                });
                return Object.values(summary).sort((a, b) => b.utilidad - a.utilidad);
            }
            case 'gastos': {
                let expenses = this.getExpenses();
                if (desde) expenses = expenses.filter(e => e.fecha >= desde);
                if (hasta) expenses = expenses.filter(e => e.fecha <= (hasta.includes('T') ? hasta : hasta + 'T23:59:59'));
                return expenses;
            }
            default:
                return [];
        }
    },

    // =========================================================
    // Initialize with seed data
    // =========================================================
    initialize() {
        // Dejar únicamente el administrador mauricio.izquierdo@hotmail.com y borrar todos los otros
        const targetEmail = 'mauricio.izquierdo@hotmail.com';
        let users = this.getAll(this.KEYS.USERS) || [];
        
        // Filtrar y conservar solo el correo objetivo
        users = users.filter(u => u.email === targetEmail);

        const existingAdmin = users.find(u => u.email === targetEmail);
        if (existingAdmin) {
            existingAdmin.nombre = 'Administrador';
            existingAdmin.password = 'Aa79981638+';
            existingAdmin.rol = 'admin';
            existingAdmin.estado = 'activo';
            existingAdmin.deleted_at = null;
        } else {
            users.push({
                id: this.genId(),
                nombre: 'Administrador',
                email: targetEmail,
                password: 'Aa79981638+',
                rol: 'admin',
                estado: 'activo',
                created_at: new Date().toISOString()
            });
        }
        this._persist(this.KEYS.USERS, users);

        // Limpiar sesión anterior si el usuario logueado no es el nuevo administrador
        const sessionUser = this.getAll(this.KEYS.CURRENT_USER);
        if (sessionUser && sessionUser.email !== targetEmail) {
            localStorage.removeItem(this.KEYS.CURRENT_USER);
        }

        if (this._cache[this.KEYS.INITIALIZED]) return;

        // Seed banks only
        const banks = [
            { nombre: 'Bancolombia', saldo_actual: 0 },
            { nombre: 'Davivienda', saldo_actual: 0 },
        ];
        banks.forEach(b => this.save(this.KEYS.BANKS, b));

        this._persist(this.KEYS.INITIALIZED, 'true');
    },

    // =========================================================
    // Utilities
    // =========================================================
    resetDatabase() {
        if (!Auth.isAdmin()) {
            alert('No tienes permisos para realizar esta acción.');
            return;
        }
        if (confirm('¿Está seguro de que desea BLANQUEAR toda la base de datos y reiniciar los contadores? Esta acción no se puede deshacer.')) {
            if (this._db) {
                const transaction = this._db.transaction(this.STORE_NAME, 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                store.clear();
            }
            localStorage.clear();
            this._cache = {};
            alert('Base de datos reiniciada. La página se recargará.');
            location.reload();
        }
    },

    clearTestData() {
        const keysToClear = [
            this.KEYS.CLIENTS,
            this.KEYS.SALES,
            this.KEYS.SALE_DETAILS,
            this.KEYS.CARTERA,
            this.KEYS.BANK_MOVEMENTS,
            this.KEYS.EXPENSES,
            this.KEYS.COMPRAS,
            this.KEYS.COMPRA_DETAILS,
            this.KEYS.COTIZACIONES,
            this.KEYS.COTIZACION_DETAILS,
            this.KEYS.RECIBOS_CAJA,
            this.KEYS.RECIBO_CAJA_DETALLE,
            this.KEYS.CARTERA_PROVEEDORES,
            this.KEYS.PAGOS_PROVEEDORES,
            this.KEYS.PAGOS_PROVEEDORES_DETALLE,
            this.KEYS.DEVOLUCIONES,
            this.KEYS.DEVOLUCION_DETAILS,
            this.KEYS.INVENTORY_LOTS
        ];

        keysToClear.forEach(k => {
            if (this._db) {
                const transaction = this._db.transaction(this.STORE_NAME, 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                store.delete(k);
            }
            localStorage.removeItem(k);
            delete this._cache[k];
        });

        // Reset banks amounts
        let banks = this.getAll(this.KEYS.BANKS);
        banks = banks.map(b => ({ ...b, saldo_actual: 0 }));
        this._persist(this.KEYS.BANKS, banks);

        // Reset products stock to 0
        let products = this.getAll(this.KEYS.PRODUCTS);
        products = products.map(p => ({ ...p, stock_actual: 0 }));
        this._persist(this.KEYS.PRODUCTS, products);

        // Reset counters
        if (this._db) {
            const transaction = this._db.transaction(this.STORE_NAME, 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            store.delete(this.KEYS.COUNTERS);
        }
        localStorage.removeItem(this.KEYS.COUNTERS);
        delete this._cache[this.KEYS.COUNTERS];

        console.log('Datos de prueba borrados.');
    }
};

// Start IndexedDB initialization
DB.initPromise = DB.init();
