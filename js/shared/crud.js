// js/utils/core-actions.js
import DB from '../core/db.js';
import { InventarioUtils } from './inventarioUtils.js';

export const CoreActions = {
    /**
     * Renderiza la barra de navegación superior de un documento
     * @param {string} parentHash - Hash de la ruta para volver (ej: 'ingresos/cotizaciones')
     * @param {string} label - Etiqueta del botón volver (ej: 'Volver a Cotizaciones')
     * @returns {string} HTML del encabezado
     */
    renderDocumentHeader(parentHash, label = 'Volver') {
        return `
            <div class="d-flex align-items-center mb-4">
                <button class="btn btn-link text-decoration-none p-0 me-3 d-flex align-items-center text-muted" 
                        onclick="window.location.hash = '#/${parentHash}'" 
                        style="color: var(--text-body) !important; font-weight: var(--weight-medium); transition: color 0.2s;">
                    <i class="bi bi-arrow-left me-2"></i>${label}
                </button>
            </div>
        `;
    },

    /**
     * Renderiza el contenedor de acciones globales para el documento (Cotización, Factura, etc)
     * @param {Object} documentData - Datos del documento
     * @param {string} type - Tipo de documento ('cotizacion', 'factura', 'recibo')
     * @param {boolean} isViewOnly - Indica si está en modo solo lectura
     * @param {boolean} isNew - Indica si es un documento nuevo no guardado
     * @returns {string} HTML de los botones de acción
     */
    renderActionButtons(documentData, type = 'cotizacion', isViewOnly = true, isNew = false) {
        let buttons = '';
        const docId = documentData ? documentData.id : '';
        
        // Estilo especial para Imprimir si no es vista de lectura (opaco y alerta)
        const printStyle = !isViewOnly ? 'opacity: 0.5; transition: all 0.2s;' : '';
        
        buttons += `
            <button class="btn btn-outline-secondary btn-sm me-2 btn-imprimir" data-id="${docId}" style="${printStyle}">
                <i class="bi bi-printer me-1"></i>Imprimir
            </button>
        `;

        if (!isNew) {
            buttons += `
                <button class="btn btn-outline-secondary btn-sm me-2 btn-editar" data-id="${docId}" ${!isViewOnly ? 'style="display: none;"' : ''}>
                    <i class="bi bi-pencil me-1"></i>Editar
                </button>
            `;

            // Lógica Exclusiva: Conversión de Cotización
            if (type === 'cotizacion') {
                const isConverted = documentData.convertidoAFactura === true;
                buttons += `
                    <button class="btn ${isConverted ? 'btn-secondary' : 'btn-primary'} btn-sm btn-convertir" 
                            data-id="${docId}" ${isConverted || !isViewOnly ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}>
                        <i class="bi bi-receipt me-1"></i>Convertir a Factura
                    </button>
                `;
            }
        }

        return `<div class="document-actions d-flex justify-content-end align-items-center">${buttons}</div>`;
    },

    /**
     * Lógica de Negocio Estricta: Convertir Cotización a Factura
     * @param {string} idCotizacion 
     * @param {Function} onSuccessCallback - Callback a ejecutar tras la conversión (para recargar UI)
     */
    async convertirCotizacionAFactura(idCotizacion, onSuccessCallback) {
        try {
            const cotizacion = await DB.get('cotizaciones', idCotizacion);
            if (!cotizacion) throw new Error("Cotización no encontrada.");

            // Regla de Negocio: Condición Bloqueada (Segunda vez)
            if (cotizacion.convertidoAFactura) {
                this.showWarningModal(`Esta cotización ya fue convertida a la factura [No. ${cotizacion.facturaDestinoId || 'X'}]. Para generar una factura nueva basada en estos datos, debes crear primero una copia nueva de esta cotización.`);
                return;
            }

            // Regla de Negocio: Validar y Descontar FIFO antes de convertir
            const invResult = await InventarioUtils.procesarSalidaInventario(cotizacion.detalles || []);
            if (!invResult.success) {
                this.showWarningModal("Acción interceptada: " + invResult.error);
                return; // ABORTA LA CONVERSIÓN
            }

            // Regla de Negocio: Condición Permitida (Primera vez) - Clonación de la data
            const idFactura = 'fac_' + Date.now();
            const nuevaFactura = {
                id: idFactura,
                clienteId: cotizacion.clienteId,
                fecha: new Date().toISOString().split('T')[0],
                vencimiento: cotizacion.vencimiento,
                total: cotizacion.total || 0,
                estado: 'por_pagar',
                tipo: 'venta',
                detalles: invResult.detallesActualizados,
                total_costo: invResult.costoTotalVenta,
                notas: cotizacion.notas || '',
                terminosCondiciones: cotizacion.terminosCondiciones || 'Favor realizar los pagos a nuestra cuenta bancaria.',
                origenCotizacionId: cotizacion.id,
                prefijo: 'FAC',
                numero: Math.floor(Math.random() * 9000) + 1000
            };

            await DB.save('facturas', nuevaFactura);

            // Modificar estado original
            cotizacion.convertidoAFactura = true;
            cotizacion.facturaDestinoId = idFactura;
            await DB.save('cotizaciones', cotizacion);

            // Callback
            if (onSuccessCallback) {
                onSuccessCallback(idFactura, cotizacion);
            }

        } catch (error) {
            console.error("Error al convertir cotización a factura:", error);
            this.showWarningModal("Error al convertir a factura: " + error.message);
            throw error; // Propagar para que el botón pueda restaurar su estado
        }
    },

    /**
     * Modal nativo ligero con diseño del sistema corporativo (Alegra estricto)
     */
    showWarningModal(message) {
        const existing = document.getElementById('core-warning-modal');
        if (existing) existing.remove();

        const modalHtml = `
            <div id="core-warning-modal" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(0,0,0,0.4); z-index: 9999; backdrop-filter: blur(2px);">
                <div class="bg-white p-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px; max-width: 450px; border-top: 4px solid #f59e0b;">
                    <div class="d-flex align-items-center mb-3">
                        <i class="bi bi-exclamation-triangle-fill text-warning fs-4 me-3"></i>
                        <h5 class="mb-0 fw-bold" style="color: var(--text-main); font-size: 16px;">Acción interceptada</h5>
                    </div>
                    <p style="color: var(--text-body); font-size: 14px; line-height: 1.5; margin-bottom: 24px;">${message}</p>
                    <div class="text-end">
                        <button class="btn btn-light px-4 text-dark" style="font-weight: var(--weight-medium); border: 1px solid #e2e8f0;" onclick="document.getElementById('core-warning-modal').remove()">Entendido</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    /**
     * Vincula los listeners de la Utility Bar al documento
     */
    bindActionEvents(element, documentData, type, callbacks = {}) {
        const btnConvertir = element.querySelector('.btn-convertir');
        if (btnConvertir && !btnConvertir.disabled) {
            btnConvertir.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const id = btn.dataset.id;
                const oldHtml = btn.innerHTML;
                
                try {
                    btn.disabled = true;
                    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Guardando...`;
                    await this.convertirCotizacionAFactura(id, callbacks.onConvertSuccess);
                } catch (err) {
                    console.error("[Conversion Button Error]:", err);
                    btn.disabled = false;
                    btn.innerHTML = oldHtml;
                }
            });
        }

        const btnPrint = element.querySelector('.btn-imprimir');
        if (btnPrint) {
            // Solo secuestramos el evento genérico si es explícitamente un pago/recibo de caja.
            if (type === 'pago') {
                btnPrint.addEventListener('click', () => {
                    if (btnPrint.style.opacity === '0.5') {
                        this.showWarningModal("Debe guardar los cambios del documento antes de poder imprimirlo.");
                    } else {
                        this.printDocumentFormat(documentData, type);
                    }
                });
            }
        }

        const btnEdit = element.querySelector('.btn-editar');
        if (btnEdit) {
            btnEdit.addEventListener('click', () => {
                let modulo = 'cotizaciones';
                if (type === 'factura') modulo = 'facturas';
                if (type === 'pago') modulo = 'pagos';
                
                window.location.hash = `#/ingresos/${modulo}/editar/${documentData.id}`;
            });
        }
    },

    /**
     * Motor Asíncrono de Impresión
     * @param {Object} documentData 
     * @param {string} tipoModulo - 'cotizacion', 'factura', 'pago'
     */
    printDocumentFormat(documentData, tipoModulo) {
        if (!documentData) return;

        // 1. Remover cualquier residuo de impresión anterior
        const oldContainer = document.getElementById('print-sandbox');
        if (oldContainer) oldContainer.remove();

        // 2. Crear un contenedor plano exclusivo para el motor de impresión
        const printSandbox = document.createElement('div');
        printSandbox.id = 'print-sandbox';
        
        // Limpieza estricta del número de factura (Quitar duplicados y prefijos 'fac_')
        const numeroLimpio = documentData.distribucionCredito?.[0]?.facturaNumero
            ?.replace(/fac_/gi, '')
            ?.replace(/Fac\s+/gi, '') || '';

        const totalFormateado = parseFloat(documentData.totalDebito || documentData.monto || 0)
            .toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Extraer dinámicamente el HTML exacto del logo corporativo de la interfaz actual
        const interfaceLogo = document.querySelector('.brand .logo, aside .brand img');
        const logoHtmlReal = interfaceLogo ? interfaceLogo.outerHTML : `
            <img src="LogoMas.png" alt="MAS Accesorios" style="max-height: 45px; object-fit: contain;">
        `;

        const cabeceraImpresion = `
            <div class="print-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0c1a30; padding-bottom: 15px; margin-bottom: 25px;">
                <div style="display: flex; align-items: center;">
                    ${logoHtmlReal}
                </div>
                <div style="text-align: right; font-family: 'Inter', sans-serif;">
                    <h2 style="margin: 0; font-size: 14px; color: #0c1a30; font-weight: 700;">RECIBO DE CAJA</h2>
                    <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 700; color: #ef4444;">No. ${documentData.nroRecibo || documentData.id}</p>
                </div>
            </div>
        `;

        // 3. Inyectar HTML plano con estilos inline inline-block (Sin layouts de la SPA)
        printSandbox.innerHTML = `
            <style>
                @media screen {
                    #print-sandbox { display: none; }
                }
                @media print {
                    body * { visibility: hidden; }
                    #print-sandbox, #print-sandbox * { visibility: visible; }
                    
                    /* Configuración del tamaño de la hoja física en el navegador */
                    @page {
                        size: letter portrait; /* O "A5 portrait" si usas papel media hoja nativo */
                        margin: 0;
                    }
                    
                    #print-sandbox {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        font-family: 'Inter', sans-serif;
                        color: #0c1a30 !important;
                        background: #fff !important;
                        font-size: 14px; /* Aumentar escala base de texto */
                    }
                    
                    .print-container {
                        padding: 50px;
                        width: 100%;
                        box-sizing: border-box;
                    }
                    
                    .print-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0c1a30; padding-bottom: 15px; margin-bottom: 25px; }
                    /* Diseño exacto del Logo Corporativo MAS Accesorios */
                    .corp-logo-box {
                        width: 42px;
                        height: 42px;
                        background-color: #ffffff;
                        border: 2px solid #0099ec;
                        border-radius: 4px;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        font-family: 'Inter', sans-serif;
                        padding: 2px;
                        box-sizing: border-box;
                    }
                    .corp-logo-top {
                        font-size: 14px;
                        font-weight: 900;
                        color: #0099ec;
                        line-height: 1;
                        letter-spacing: 0.5px;
                    }
                    .corp-logo-bottom {
                        font-size: 6.5px;
                        font-weight: 700;
                        color: #0099ec;
                        line-height: 1;
                        margin-top: 1px;
                        text-transform: uppercase;
                    }
                    
                    /* Forzar que las tablas y textos ocupen el ancho completo real */
                    .print-table { 
                        width: 100% !important; 
                        border-collapse: collapse; 
                        margin-top: 30px; 
                        font-size: 14px;
                    }
                    .print-table th { background-color: #f8f9fa !important; color: #0c1a30; font-weight: 600; padding: 10px; border-bottom: 1px solid #dee2e6; }
                    .print-table td { padding: 12px 10px; border-bottom: 1px solid #eee; color: #2c3e50; }
                }
            </style>
            
            <div class="print-container">
                ${cabeceraImpresion}

                <div style="margin-bottom: 25px; font-size: 13px; color: #4b5563;">
                    <strong>Fecha de Emisión:</strong> ${documentData.fecha}<br>
                    <strong>Cliente:</strong> ${documentData.clienteNombre || 'Cliente Contado'}<br>
                    <strong>Forma de Pago:</strong> ${documentData.formaPago || 'Consignación'}
                </div>
                
                <table class="print-table">
                    <thead>
                        <tr>
                            <th style="text-align: left;">Factura Afectada</th>
                            <th style="text-align: right;">Monto Abonado</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Factura ${numeroLimpio}</td>
                            <td style="text-align: right; font-weight: 700;">
                                $ ${totalFormateado}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        document.body.appendChild(printSandbox);

        // 4. Retraso de macrotarea para asegurar el correcto renderizado del DOM de impresión
        setTimeout(() => {
            window.print();
            // Limpiar el DOM inmediatamente después de cerrar el cuadro de diálogo
            printSandbox.remove();
        }, 250);
    }
};

/**
 * MOTOR COMPARTIDO DE LÍNEAS DE INVENTARIO (COTIZACIONES Y FACTURAS)
 * Centraliza la inyección de precios, stock y autocompletado.
 */
export const ItemEngine = {
    renderProductSearchBox(detalle, productos) {
        // Encontrar producto inicial si existe
        const prod = productos.find(p => p.id === detalle.productoId);
        const initialText = prod ? `[${prod.sku || 'S/N'}] - ${prod.nombre}` : '';
        
        return `
            <div class="position-relative">
                <input type="hidden" class="input-prod-id" value="${detalle.productoId || ''}">
                <input type="text" class="form-control form-control-sm text-muted border-0 bg-light input-prod-search mb-1" 
                       placeholder="Escriba código o nombre..." autocomplete="off" value="${initialText}">
                <input type="text" class="form-control form-control-sm border-0 bg-light mt-1 input-prod-desc" 
                       placeholder="Ej. iPhone 17 Pro Max" value="${detalle.descripcion_personalizada || ''}">
                <div class="search-results-dropdown position-absolute w-100 bg-white shadow-sm" 
                     style="display: none; z-index: 1050; max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; top: 100%;">
                </div>
            </div>
        `;
    },

    bindLineEvents(tr, calcEngine, productos = []) {
        const inputSearch = tr.querySelector('.input-prod-search');
        const inputId = tr.querySelector('.input-prod-id');
        const dropdown = tr.querySelector('.search-results-dropdown');
        
        const inpQty = tr.querySelector('.input-qty');
        const inpPrice = tr.querySelector('.input-price');
        const inpTax = tr.querySelector('.input-tax');
        
        // Contenedores de Metadatos
        const metaProd = tr.querySelector('.meta-prod');
        const metaQty = tr.querySelector('.meta-qty');

        // Cerrar dropdowns al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!tr.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        // ==========================================
        // Lógica de Autocompletado (Live Search)
        // ==========================================
        inputSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query.length < 1) {
                dropdown.style.display = 'none';
                dropdown.innerHTML = '';
                // Limpiar si borró todo
                if (query.length === 0 && inputId.value) {
                    inputId.value = '';
                    inpPrice.value = 0;
                    inpTax.value = 0;
                    if (metaProd) metaProd.innerHTML = '';
                    if (metaQty) metaQty.innerHTML = '';
                    calcEngine();
                }
                return;
            }

            // Filtrado predictivo
            const filtered = productos.filter(p => 
                (p.nombre && p.nombre.toLowerCase().includes(query)) || 
                (p.sku && p.sku.toLowerCase().includes(query))
            );

            if (filtered.length === 0) {
                dropdown.innerHTML = `<div class="p-2 text-muted small text-center">No hay resultados</div>`;
                dropdown.style.display = 'block';
                return;
            }

            // Renderizar resultados con Mapeo estricto de precio_venta
            dropdown.innerHTML = filtered.map(p => {
                let precioReal = 0;
                if (p.precio_venta !== undefined) precioReal = p.precio_venta;
                else if (p.precioVenta !== undefined) precioReal = p.precioVenta;
                else if (p.precio !== undefined) precioReal = p.precio;
                else if (p.price !== undefined) {
                    if (Array.isArray(p.price) && p.price.length > 0) precioReal = p.price[0].price || 0;
                    else precioReal = p.price;
                }
                
                return `
                <div class="dropdown-item-search p-2" style="cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px;"
                     data-id="${p.id}" data-precio="${precioReal}" data-impuesto="${p.impuesto || p.tax || 0}" 
                     data-sku="${p.sku || p.reference || ''}" data-stock="${p.stockActual || p.inventory || p.cantidad || 0}" data-nombre="${p.nombre || p.name}">
                    <strong style="color: var(--text-main);">[${p.sku || p.reference || 'S/N'}]</strong> - ${p.nombre || p.name}
                </div>
                `;
            }).join('');
            
            dropdown.style.display = 'block';

            // Efecto hover (Vanilla JS)
            dropdown.querySelectorAll('.dropdown-item-search').forEach(item => {
                item.addEventListener('mouseenter', () => item.style.backgroundColor = 'var(--primary-light)');
                item.addEventListener('mouseleave', () => item.style.backgroundColor = 'transparent');
                
                // Acción de Selección
                item.addEventListener('click', (ev) => {
                    const ds = ev.currentTarget.dataset;
                    
                    inputSearch.value = `[${ds.sku || 'S/N'}] - ${ds.nombre}`;
                    inputSearch.dataset.lastSku = ds.sku;
                    inputId.value = ds.id;
                    
                    // Inyección estricta de Precios e Impuestos
                    inpPrice.value = ds.precio;
                    inpTax.value = ds.impuesto;
                    if (parseFloat(inpQty.value || 0) === 0) inpQty.value = 1;

                    // Renderizado de Información Secundaria Inferior
                    if (metaProd) metaProd.innerHTML = `
                        <span style="color: var(--text-muted); font-size: 11px; display: inline-block; margin-top: 4px;">
                            ${ds.sku || 'S/N'}
                        </span>
                    `;
                    if (metaQty) metaQty.innerHTML = `<span style="color: var(--text-muted); font-size: 11px; display: inline-block; margin-top: 4px;">Disp: ${ds.stock || 0}</span>`;
                    
                    dropdown.style.display = 'none';
                    
                    // Disparo Manual Forzado de Eventos (Math Engine Trigger)
                    inpPrice.dispatchEvent(new Event('input', { bubbles: true }));
                    inpQty.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    // Detonación obligatoria del motor matemático (Fallback redundante)
                    if (typeof calcEngine === 'function') calcEngine();
                });
            });
        });
    }
};

/**
 * GESTOR DE NUMERACIÓN Y CONTROL DE DUPLICADOS (MODAL)
 * Maneja la configuración del consecutivo en tiempo real previniendo choques en DB.
 */
export const NumberingManager = {
    async openNumberingModal(tipoDocumento, currentData, onSaveCallback) {
        // Remover si ya existe
        const existing = document.getElementById('numbering-modal');
        if (existing) existing.remove();

        const titulo = tipoDocumento === 'cotizacion' ? 'Cotización' : 'Factura';
        const currentPrefix = currentData.prefijo || '';
        const currentNum = currentData.numero || '';

        const modalHtml = `
            <div id="numbering-modal" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(12, 26, 48, 0.4); z-index: 1050; backdrop-filter: blur(2px);">
                <div class="bg-white p-4 shadow rounded" style="width: 400px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h5 class="fw-bold mb-0" style="color: var(--text-main);">Configurar numeración</h5>
                        <button class="btn-close" id="btn-close-num" aria-label="Close"></button>
                    </div>
                    
                    <div class="row align-items-center mb-3">
                        <div class="col-4 text-muted" style="font-size: 13px;">Nombre:</div>
                        <div class="col-8 fw-bold" style="font-size: 13px; color: var(--text-main);">${titulo}</div>
                    </div>
                    
                    <div class="row align-items-center mb-3">
                        <div class="col-4 text-muted" style="font-size: 13px;">Prefijo:</div>
                        <div class="col-8">
                            <input type="text" id="num-prefijo" class="form-control form-control-sm text-muted" value="${currentPrefix}">
                        </div>
                    </div>
                    
                    <div class="row align-items-start mb-4">
                        <div class="col-4 text-muted mt-1" style="font-size: 13px;">Siguiente número:</div>
                        <div class="col-8">
                            <input type="number" id="num-siguiente" class="form-control form-control-sm text-muted" value="${currentNum}">
                            <div id="num-error" class="text-danger mt-1" style="font-size: 11px; display: none; line-height: 1.2;"></div>
                        </div>
                    </div>
                    
                    <div class="mb-4 text-center">
                        <a href="#" style="color: #2dbda8; font-size: 13px; text-decoration: none; font-weight: var(--weight-medium);">Gestionar mis numeraciones</a>
                    </div>
                    
                    <div class="d-flex justify-content-end gap-2 mt-2">
                        <button class="btn btn-light border px-4" id="btn-cancel-num" style="font-weight: var(--weight-medium); font-size: 13px; color: var(--text-body);">Cancelar</button>
                        <button class="btn text-white px-4" id="btn-save-num" style="background-color: #2cbfb7; font-weight: var(--weight-medium); font-size: 13px; border-radius: 6px;">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('numbering-modal');
        const btnClose = document.getElementById('btn-close-num');
        const btnCancel = document.getElementById('btn-cancel-num');
        const btnSave = document.getElementById('btn-save-num');
        const inpPrefijo = document.getElementById('num-prefijo');
        const inpSiguiente = document.getElementById('num-siguiente');
        const errDiv = document.getElementById('num-error');

        const closeModal = () => modal.remove();

        btnClose.addEventListener('click', closeModal);
        btnCancel.addEventListener('click', closeModal);

        btnSave.addEventListener('click', async () => {
            const newPrefijo = inpPrefijo.value.trim();
            const newNum = parseInt(inpSiguiente.value.trim());

            inpSiguiente.style.borderColor = 'var(--border-color)';
            errDiv.style.display = 'none';

            if (!newNum) {
                inpSiguiente.style.borderColor = '#ef4444';
                errDiv.textContent = 'El número es requerido.';
                errDiv.style.display = 'block';
                return;
            }

            // Duplication Guard Logic
            const collectionName = tipoDocumento === 'cotizacion' ? 'cotizaciones' : 'facturas';
            const todos = await DB.getAll(collectionName);
            
            const isDuplicate = todos.some(doc => 
                doc.id !== currentData.id && // Excluir actual
                (doc.prefijo || '') === newPrefijo && 
                parseInt(doc.numero) === newNum
            );

            if (isDuplicate) {
                inpSiguiente.style.borderColor = '#ef4444';
                errDiv.textContent = `El número ${newPrefijo}${newNum} ya se encuentra registrado en un documento anterior. Por favor, asigne un consecutivo disponible.`;
                errDiv.style.display = 'block';
                return;
            }

            // Validación superada
            currentData.prefijo = newPrefijo;
            currentData.numero = newNum;
            
            if (onSaveCallback) onSaveCallback(newPrefijo, newNum);
            closeModal();
        });
    }
};

/**
 * GESTOR DE IMPRESIÓN DINÁMICA (MEDIA HOJA / HOJA COMPLETA)
 * Genera un contenedor temporal formateado para imprimir un documento.
 */
export const PrintManager = {
    printDocument(doc, tipoDoc, contactos, productos) {

        // 1. Limpiar cualquier contenedor de impresión previo si existe
        const oldContainer = document.querySelector('.print-document-template');
        if (oldContainer) oldContainer.remove();

        // 2. Determinar tamaño de hoja
        const printClass = (doc.detalles && doc.detalles.length < 5) ? 'media-hoja' : 'hoja-completa';

        // 3. Resolutores de Datos
        const cliente = contactos.find(c => c.id === doc.clienteId) || {};
        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const numDisplay = (doc.prefijo || '') + (doc.numero || doc.id);
        const totalUnidades = (doc.detalles || []).reduce((sum, det) => sum + (Number(det.cantidad) || 0), 0);

        // 4. Generar Filas de la Tabla
        const rowsHtml = (doc.detalles || []).map(det => {
            const prod = productos.find(p => p.id === det.productoId) || {};
            const subtotal = (det.cantidad || 0) * (det.precio || 0);
            return `
                <tr style="border-bottom: 1px solid #dee2e6; font-size: 12px; color: #495057;">
                    <td style="padding: 8px 4px;">${prod.sku || 'N/A'}</td>
                    <td style="padding: 8px 4px;">
                        <div style="font-weight: 600; color: #212529;">${prod.nombre || 'Ítem sin nombre'}</div>
                        ${det.descripcion_personalizada ? `<div style="font-size: 10.5px; color: #6c757d; margin-top: 3px;">${det.descripcion_personalizada}</div>` : ''}
                    </td>
                    <td style="padding: 8px 4px; text-align: right;">${formatMoney(det.precio)}</td>
                    <td style="padding: 8px 4px; text-align: center;">${det.cantidad}</td>
                    <td style="padding: 8px 4px; text-align: right;">${det.descuento || 0}%</td>
                    <td style="padding: 8px 4px; text-align: right;">${formatMoney(subtotal)}</td>
                </tr>
            `;
        }).join('');

        // 5. Construir HTML
        const container = document.createElement('div');
        container.id = 'print-view-container';
        container.className = `print-document-template ${printClass}`;
        container.innerHTML = `
            <!-- HEADER IMPRESIÓN -->
            <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #6c757d; padding-bottom: 15px; margin-bottom: 25px;">
                <div style="width: 40%;">
                    <img src="LogoMas.png" style="max-height: 80px; margin-bottom: 5px;" alt="Logo" onerror="this.style.display='none'">
                </div>
                <div style="text-align: right; width: 40%; padding-top: 15px;">
                    <p style="margin: 0; font-size: 14px; color: #6c757d; font-weight: bold;">3158512091</p>
                </div>
            </div>

            <h2 style="color: #495057; margin-top: 0; margin-bottom: 20px;">${tipoDoc}</h2>

            <!-- INFO CLIENTE Y DOC -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 25px;">
                <div style="background-color: #f8f9fa; padding: 20px; width: 48%; border-radius: 6px;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 16px; color: #212529;">${cliente.nombre || 'Sin cliente'}</p>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 5px;">
                        <strong style="color: #495057;">CC/NIT</strong><span>${cliente.identificacion || ''}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px;">
                        <strong style="color: #495057;">TEL</strong><span>${cliente.telefono || ''}</span>
                    </div>
                </div>
                <div style="width: 45%;">
                    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 15px; padding-bottom: 5px; border-bottom: 1px solid #dee2e6;">
                        <strong style="color: #495057;">${tipoDoc} No.</strong><span style="font-weight: bold; font-size: 15px;">${numDisplay}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 15px; padding-bottom: 5px; border-bottom: 1px solid #dee2e6;">
                        <strong style="color: #495057;">Fecha de expedición</strong><span>${doc.fecha}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; padding-bottom: 5px; border-bottom: 1px solid #dee2e6;">
                        <strong style="color: #495057;">Fecha de vencimiento</strong><span>${doc.vencimiento || doc.fecha}</span>
                    </div>
                </div>
            </div>

            <!-- TABLA DE PRODUCTOS -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 35px;">
                <thead>
                    <tr style="border-bottom: 2px solid #dee2e6; color: #495057; font-size: 13px;">
                        <th style="text-align: left; padding: 8px 4px;">Referencia</th>
                        <th style="text-align: left; padding: 8px 4px;">Ítem</th>
                        <th style="text-align: right; padding: 8px 4px;">Precio</th>
                        <th style="text-align: center; padding: 8px 4px;">Cantidad</th>
                        <th style="text-align: right; padding: 8px 4px;">Descuento</th>
                        <th style="text-align: right; padding: 8px 4px;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <!-- FOOTER TOTALES -->
            <div style="display: flex; justify-content: space-between; margin-top: auto;">
                <div style="width: 50%;">
                    <h5 style="color: #6c757d; font-size: 14px; margin: 0 0 8px 0;">Observaciones</h5>
                    <p style="font-size: 12px; color: #495057; margin: 0;">${doc.notas || ''}</p>
                </div>
                <div style="width: 38%;">
                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                        <strong style="color: #495057;">Subtotal</strong><span>${formatMoney(doc.total)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 16px; margin-bottom: 12px; border-top: 1px solid #dee2e6; padding-top: 8px;">
                        <strong style="color: #212529;">Total</strong><span style="font-weight: bold; color: #212529;">${formatMoney(doc.total)}</span>
                    </div>
                    <div style="text-align: right; font-size: 12px; font-weight: bold; color: #6c757d;">
                        Cantidad de productos: ${totalUnidades}
                    </div>
                </div>
            </div>

            <!-- FIRMA -->
            <div style="text-align: center; margin-top: 40px; margin-bottom: 20px;">
                <div style="width: 200px; height: 50px; background-color: #f8f9fa; margin: 0 auto; border-bottom: 1px solid #495057;"></div>
                <p style="font-size: 10px; color: #212529; margin-top: 5px;">ELABORADO POR</p>
            </div>
        `;

        document.body.appendChild(container);

        // 6. Ejecutar impresión simple y directa
        setTimeout(() => {
            window.print();
            // Limpiar el DOM 1 segundo después de que se cierre el cuadro de impresión
            setTimeout(() => {
                if (document.body.contains(container)) {
                    container.remove();
                }
            }, 1000);
        }, 150);
    }
};

/**
 * GESTOR DE EXPORTACIÓN (EXCEL / CSV)
 * Convierte un arreglo de datos filtrado de la grilla en un archivo plano codificado para descarga.
 */
export const ExportManager = {
    exportDataToExcel(dataArray, tipoModulo, getClienteNameFunc, btnElement = null) {
        if (!dataArray || dataArray.length === 0) {
            CoreActions.showWarningModal('No hay datos disponibles para exportar con el filtro actual.');
            return;
        }

        // 1. Feedback Visual de Carga
        let originalText = '';
        if (btnElement) {
            originalText = btnElement.innerHTML;
            btnElement.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generando...';
            btnElement.disabled = true;
            btnElement.style.opacity = '0.7';
        }

        // 2. Mapeo Asíncrono Simulado (para permitir el repintado del DOM del spinner)
        setTimeout(() => {
            try {
                // Formateadores locales
                const formatMoney = (val) => parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                
                // Mapear objetos a filas planas
                const rows = dataArray.map(item => {
                    const clienteNombre = getClienteNameFunc ? getClienteNameFunc(item.clienteId) : (item.clienteId || 'N/A');
                    const numDoc = (item.prefijo || '') + (item.numero || item.id);
                    const estado = item.convertidoAFactura ? 'Facturada' : 'Borrador';

                    return {
                        'Número de Documento': numDoc,
                        'Nombre del Cliente': clienteNombre,
                        'Fecha de Creación': item.fecha || '',
                        'Valor Total': formatMoney(item.total),
                        'Estado Actual': estado
                    };
                });

                if (rows.length === 0) throw new Error('Error al parsear los datos.');

                // 3. Extracción de Cabeceras
                const headers = Object.keys(rows[0]);
                
                // 4. Construcción del CSV con delimitadores limpios (;) y saltos de línea (CRLF)
                let csvContent = headers.join(';') + '\r\n';
                
                rows.forEach(row => {
                    const values = headers.map(header => {
                        let val = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
                        val = val.replace(/"/g, '""'); // Escapar comillas internas
                        return `"${val}"`;             // Envolver valor en comillas
                    });
                    csvContent += values.join(';') + '\r\n';
                });

                // 5. Inyección del BOM (Byte Order Mark real) para UTF-8 y Blob
                const BOM = '\uFEFF';
                const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);

                // 6. Generación de Nombre Dinámico y Gatillo de Descarga
                const dateStr = new Date().toISOString().split('T')[0];
                const filename = `Reporte_${tipoModulo}_${dateStr}.csv`;

                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename);
                link.style.display = 'none';
                document.body.appendChild(link);
                
                link.click();
                
                // 7. Limpieza de Memoria
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

            } catch (error) {
                console.error('Error generando reporte:', error);
                CoreActions.showWarningModal('Ocurrió un error al generar el archivo. Por favor, intenta de nuevo.');
            } finally {
                // 8. Restaurar Feedback Visual
                if (btnElement) {
                    btnElement.innerHTML = originalText;
                    btnElement.disabled = false;
                    btnElement.style.opacity = '1';
                }
            }
        }, 150); // Timeout leve para priorizar UI rendering
    },

    /**
     * Soft delete para registros. En lugar de borrarlos físicamente,
     * cambia el estado a 'inactivo' para preservar integridad referencial.
     * @param {string} storeName - Nombre del object store
     * @param {string} id - ID del registro
     */
    async softDelete(storeName, id) {
        try {
            const registro = await DB.get(storeName, id);
            if (!registro) throw new Error("Registro no encontrado.");
            
            registro.estado = 'inactivo';
            registro.updated_at = new Date().toISOString();
            
            await DB.save(storeName, registro);
            return true;
        } catch (error) {
            console.error(`Error en softDelete para ${storeName} [${id}]:`, error);
            throw error;
        }
    }
};
