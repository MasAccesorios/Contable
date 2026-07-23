// js/modules/importador.js
import DB from '../../core/db.js';

export const ImportadorModule = {
    async init(element) {
        if (!element) return;
        element.innerHTML = `
            <div class="container-fluid p-4">
                <div class="card border-0 shadow-sm" style="max-width: 800px; margin: 0 auto;">
                    <div class="card-body">
                        <h4 class="card-title mb-3 fw-bold text-dark">
                            <i class="bi bi-database-fill-down text-primary me-2"></i>Importación de Datos (Alegra)
                        </h4>
                        <p class="text-muted">
                            Este módulo lee el archivo <code>datos_alegra.json</code> en la raíz del proyecto e importa clientes/proveedores al almacén de <strong>Contactos</strong>, y productos con su costo base al almacén de <strong>Productos</strong> (inicializando el lote FIFO correspondiente).
                        </p>
                        <hr class="text-muted opacity-25">
                        <div id="import-status" class="alert alert-info d-none">Preparado para iniciar...</div>
                        <div id="import-details" class="mt-3 p-3 bg-light rounded text-muted small d-none" style="max-height: 250px; overflow-y: auto; font-family: monospace;"></div>
                        <div class="mt-4 d-flex gap-2">
                            <button id="btn-iniciar-importacion" class="btn btn-primary px-4">
                                <i class="bi bi-play-fill me-1"></i>Iniciar Importación
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const btn = element.querySelector('#btn-iniciar-importacion');
        if (btn) {
            btn.addEventListener('click', () => this.procesar(element));
        }
    },

    async procesar(element) {
        const statusEl = element ? element.querySelector('#import-status') : null;
        const detailsEl = element ? element.querySelector('#import-details') : null;
        const btn = element ? element.querySelector('#btn-iniciar-importacion') : null;

        const updateStatus = (msg, type = 'info') => {
            if (!statusEl) return;
            statusEl.className = `alert alert-${type}`;
            statusEl.innerHTML = msg;
            statusEl.classList.remove('d-none');
        };

        const appendDetail = (line) => {
            if (!detailsEl) return;
            detailsEl.classList.remove('d-none');
            detailsEl.innerHTML += `${line}<br>`;
            detailsEl.scrollTop = detailsEl.scrollHeight;
        };

        if (btn) btn.disabled = true;
        if (detailsEl) detailsEl.innerHTML = '';
        updateStatus('Cargando datos y analizando base de datos existente...', 'info');

        try {
            // Cargar datos existentes para control de duplicados
            const [existingContactos, existingProductos] = await Promise.all([
                DB.getAll('contactos'),
                DB.getAll('productos')
            ]);

            const existingContactIds = new Set(existingContactos.map(c => String(c.id)));
            const existingContactNits = new Set(existingContactos.map(c => String(c.nit || '').trim().toLowerCase()).filter(Boolean));
            const existingProductIds = new Set(existingProductos.map(p => String(p.id)));
            const existingProductSkus = new Set(existingProductos.map(p => String(p.sku || '').trim().toLowerCase()).filter(Boolean));

            appendDetail(`[DB] Registros actuales: ${existingContactos.length} contactos, ${existingProductos.length} productos.`);

            const response = await fetch('datos_alegra.json');
            if (!response.ok) {
                throw new Error(`Error al intentar cargar 'datos_alegra.json': Servidor devolvió estado HTTP ${response.status}.`);
            }
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("El archivo 'datos_alegra.json' no es un JSON válido o el servidor devolvió un fallback de HTML (posible error 404 oculto).");
            }
            const data = await response.json();

            let contactosImportados = 0, contactosOmitidos = 0;
            let productosImportados = 0, productosOmitidos = 0, lotesCreados = 0;
            let facturasImportadas = 0, facturasOmitidas = 0;

            const facturasExistentes = await DB.getAll('facturas');
            const existingFacturaIds = new Set(facturasExistentes.map(f => String(f.id)));

            // --- IMPORTACIÓN DE CONTACTOS (IDEMPOTENTE) ---
            const contactosRaw = data.contactos || data.clientes || data.contacts || [];
            appendDetail(`[JSON] Procesando ${contactosRaw.length} contactos...`);
            for (const c of contactosRaw) {
                const id = String(c.id || 'cont_' + Math.random().toString(36).substring(2, 9));
                const nit = String(c.nit || c.identification || c.documento || '').trim().toLowerCase();

                if (existingContactIds.has(id) || (nit && existingContactNits.has(nit))) {
                    contactosOmitidos++;
                    continue;
                }

                const contacto = {
                    id,
                    nombre: c.nombre || c.name || c.razonSocial || 'Contacto Sin Nombre',
                    nit: nit || 'S/N',
                    tipo: String(c.tipo || 'cliente').toLowerCase() === 'proveedor' ? 'proveedor' : 'cliente',
                    telefono: c.telefono || c.phone || '',
                    email: c.email || '',
                    ciudad: c.ciudad || c.city || '',
                    direccion: c.direccion || c.address || '',
                    regimen: c.regimen || 'Regimen Simplificado',
                    cupoCredito: parseFloat(c.cupoCredito || c.creditLimit || 0),
                    plazosPago: parseInt(c.plazosPago || c.paymentTerms || 0)
                };
                await DB.save('contactos', contacto);
                existingContactIds.add(id);
                if (nit) existingContactNits.add(nit);
                contactosImportados++;
            }

            // --- IMPORTACIÓN DE PRODUCTOS E INVENTARIO INICIAL (IDEMPOTENTE) ---
            const productosRaw = data.productos || data.products || data.items || [];
            const fechaActual = new Date().toISOString().split('T')[0];
            appendDetail(`[JSON] Procesando ${productosRaw.length} productos...`);

            for (const p of productosRaw) {
                const id = String(p.id || 'prod_' + Math.random().toString(36).substring(2, 9));
                const sku = String(p.sku || p.reference || p.codigo || '').trim().toLowerCase();

                if (existingProductIds.has(id) || (sku && existingProductSkus.has(sku))) {
                    productosOmitidos++;
                    continue;
                }

                const costoBase = parseFloat(p.costoBase || p.costo || p.price_purchase || p.precioCompra || 0);
                const precioVenta = parseFloat(p.precioVenta || p.price || p.precio || 0);
                const cantidadArchivo = parseInt(p.stockActual || p.cantidad || p.quantity || p.stock || 0);

                const producto = {
                    id,
                    sku: sku || 'SKU-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
                    nombre: p.nombre || p.name || 'Producto Sin Nombre',
                    precioVenta,
                    costoBase,
                    stockMinimo: parseInt(p.stockMinimo || p.min_stock || 5),
                    ubicacion: p.ubicacion || p.location || '',
                    stockActual: 0 // Única fuente de verdad será la suma de lotes_fifo
                };
                await DB.save('productos', producto);
                existingProductIds.add(id);
                if (sku) existingProductSkus.add(sku);
                productosImportados++;

                // Inicializar Lote FIFO base
                const lote = {
                    id: 'lote_' + id + '_init',
                    productoId: id,
                    cantidadInicial: cantidadArchivo,
                    cantidadActual: cantidadArchivo,
                    costoUnitario: costoBase,
                    fechaIngreso: p.fechaIngreso || fechaActual,
                    referencia: 'Importación Inicial (Alegra)'
                };
                await DB.save('lotes_fifo', lote);
                lotesCreados++;
            }

            // --- IMPORTACIÓN DE FACTURAS (CRONOLÓGICO Y DESCARGO FIFO ESTRICTO) ---
            const facturasRaw = data.facturas || data.invoices || [];
            if (facturasRaw.length > 0) {
                appendDetail(`[JSON] Procesando ${facturasRaw.length} facturas (Descargo FIFO)...`);
                
                facturasRaw.sort((a, b) => new Date(a.fecha || a.date) - new Date(b.fecha || b.date));
                // Traer todos los lotes (incluyendo los recién creados en el paso anterior)
                const cacheLotes = await DB.getAll('lotes_fifo');

                for (const f of facturasRaw) {
                    const id = String(f.id || 'fac_' + Math.random().toString(36).substring(2, 9));
                    if (existingFacturaIds.has(id)) {
                        facturasOmitidas++;
                        continue;
                    }

                    const tipo = (f.tipo || f.type || 'venta').toLowerCase();
                    const detalles = f.detalles || f.items || [];

                    if (tipo === 'venta') {
                        for (const det of detalles) {
                            let qtyToDeduct = parseInt(det.cantidad || det.quantity || 1);
                            const prodId = String(det.productoId || det.item_id || det.id || '');
                            
                            if (!prodId || qtyToDeduct <= 0) continue;

                            // Filtrar de la caché compartida para mantener los descuentos previos en memoria
                            const prodLotes = cacheLotes.filter(l => l.productoId === prodId && l.cantidadActual > 0);
                            prodLotes.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso));

                            for (const lote of prodLotes) {
                                if (qtyToDeduct <= 0) break;
                                const deduct = Math.min(lote.cantidadActual, qtyToDeduct);
                                lote.cantidadActual -= deduct; // Modifica la referencia directa en cacheLotes
                                qtyToDeduct -= deduct;
                                await DB.save('lotes_fifo', lote);
                            }

                            // Manejo de sobreventa o desfases del archivo plano
                            if (qtyToDeduct > 0) {
                                let oldestLot = cacheLotes.filter(l => l.productoId === prodId)
                                    .sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso))[0];
                                
                                if (!oldestLot) {
                                    const prodRel = await DB.get('productos', prodId);
                                    oldestLot = {
                                        id: 'lote_' + prodId + '_fallback_' + Date.now(),
                                        productoId: prodId,
                                        cantidadInicial: 0,
                                        cantidadActual: 0,
                                        costoUnitario: prodRel ? prodRel.costoBase : 0, 
                                        fechaIngreso: f.fecha || f.date || fechaActual,
                                        referencia: 'Descuadre Histórico'
                                    };
                                    cacheLotes.push(oldestLot); // Se añade a la caché por si vuelve a ser requerido
                                }
                                oldestLot.cantidadActual -= qtyToDeduct; // Permite saldo negativo controlado
                                await DB.save('lotes_fifo', oldestLot);
                            }
                        }
                    }

                    const factura = {
                        id,
                        contactoId: f.contactoId || f.client_id || '',
                        fecha: f.fecha || f.date || fechaActual,
                        total: parseFloat(f.total || 0),
                        estado: (f.estado || f.status || 'pendiente').toLowerCase(),
                        tipo: tipo,
                        detalles: detalles
                    };
                    await DB.save('facturas', factura);
                    existingFacturaIds.add(id);
                    facturasImportadas++;
                }
            }

            // --- IMPORTACIÓN DE PAGOS (ABONOS) ---
            const pagosRaw = data.pagos || data.payments || [];
            let pagosImportados = 0;
            let pagosOmitidos = 0;
            if (pagosRaw.length > 0) {
                appendDetail(`[JSON] Procesando ${pagosRaw.length} pagos (Abonos de Cartera)...`);
                
                const transaccionesDb = await DB.getAll('transacciones');
                const existingTransIds = new Set(transaccionesDb.map(t => String(t.id)));
                
                // Recargar facturas ya que pudieron ser insertadas o modificadas
                const facturasParaPagos = await DB.getAll('facturas');

                for (const p of pagosRaw) {
                    const id = String(p.id || 'pago_' + Math.random().toString(36).substring(2, 9));
                    if (existingTransIds.has(id)) {
                        pagosOmitidos++;
                        continue;
                    }

                    const facturaAsociadaId = String(p.facturaId || p.invoice_id || '');
                    const montoPago = parseFloat(p.monto || p.amount || 0);

                    if (!facturaAsociadaId || montoPago <= 0) {
                        pagosOmitidos++;
                        continue;
                    }

                    // Afectar la factura
                    const factura = facturasParaPagos.find(f => String(f.id) === facturaAsociadaId);
                    if (factura) {
                        const total = parseFloat(factura.total) || 0;
                        const saldoAnterior = parseFloat(factura.saldo !== undefined ? factura.saldo : total);
                        const nuevoSaldo = saldoAnterior - montoPago;
                        factura.saldo = nuevoSaldo;
                        if (nuevoSaldo <= 0) {
                            factura.estado = 'pagada';
                        } else {
                            factura.estado = 'parcial';
                        }
                        await DB.save('facturas', factura);

                        // Registrar transacción (ingreso a caja)
                        const transaccion = {
                            id,
                            facturaId: factura.id, // For backwards comp
                            referenciaId: factura.id, // Normalized
                            tipo: 'ingreso',
                            monto: montoPago,
                            fecha: p.fecha || p.date || fechaActual,
                            referencia: `Abono a Fac. ${factura.prefijo || ''}${factura.numero || factura.id}`, // For backwards comp
                            detalle: `Abono a Fac. ${factura.prefijo || ''}${factura.numero || factura.id}`, // Normalized
                            cuenta: p.cuenta || p.account || 'Caja General', // For backwards comp
                            cuentaId: p.cuenta || p.account || 'Caja General' // Normalized
                        };
                        await DB.save('transacciones', transaccion);
                        existingTransIds.add(id);
                        pagosImportados++;
                    } else {
                        pagosOmitidos++;
                    }
                }
            }

            appendDetail(`[Fin] Proceso finalizado con éxito.`);
            updateStatus(`
                <strong>¡Importación, Descargo FIFO y Pagos Completados!</strong><br>
                - <strong>Productos:</strong> ${productosImportados} creados, ${productosOmitidos} duplicados omitidos.<br>
                - <strong>Lotes (Init/Fallback):</strong> ${lotesCreados} inicializados.<br>
                - <strong>Facturas Procesadas:</strong> ${facturasImportadas} creadas, ${facturasOmitidas} omitidas.<br>
                - <strong>Pagos Procesados:</strong> ${pagosImportados} aplicados, ${pagosOmitidos} omitidos.
            `, 'success');

        } catch (err) {
            console.error('Error durante la importación:', err);
            updateStatus(`<strong>Error crítico:</strong> ${err.message}`, 'danger');
            if (btn) btn.disabled = false;
        }
    }
};
