// js/utils/core-actions.js
import DB, { getLocalDate } from '../core/db.js';
import { InventarioUtils } from './inventarioUtils.js';

export const CoreActions = {
    /**
     * Renderiza la barra de navegación superior de un documento
     * @param {string} parentHash - Hash de la ruta para volver (ej: 'ingresos/cotizaciones')
     * @param {string} label - Etiqueta del botón volver (ej: 'Volver a Cotizaciones')
     * @returns {string} HTML del encabezado
     */
    renderDocumentHeader(parentHash, label = 'Volver') {
        const origen = sessionStorage.getItem('origenVolver');
        let hashFinal = `#/${parentHash}`;
        let labelFinal = label;
        if (origen) {
            try {
                const o = JSON.parse(origen);
                hashFinal = o.hash;
                labelFinal = o.label;
            } catch(e) {}
            sessionStorage.removeItem('origenVolver');
        }

        return `
            <div class="d-flex align-items-center mb-4">
                <button class="btn btn-link text-decoration-none p-0 me-3 d-flex align-items-center text-muted" 
                        onclick="window.location.hash = '${hashFinal}'" 
                        style="color: var(--text-body) !important; font-weight: var(--weight-medium); transition: color 0.2s;">
                    <i class="bi bi-arrow-left me-2"></i>${labelFinal}
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
            <button class="btn btn-outline-info btn-sm me-2 btn-vista-previa" data-id="${docId}" style="${printStyle}">
                <i class="bi bi-eye me-1"></i>Vista Previa
            </button>
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
                if (isConverted && documentData.facturaDestinoId) {
                    buttons += `
                        <button class="btn btn-outline-primary btn-sm btn-ver-factura" 
                                onclick="sessionStorage.setItem('origenVolver', JSON.stringify({hash: '#/ingresos/cotizaciones/ver/${docId}', label: 'Volver a la cotización'})); window.location.hash='#/ingresos/facturas/ver/${documentData.facturaDestinoId}'">
                            <i class="bi bi-box-arrow-up-right me-1"></i>Ver Factura
                        </button>
                    `;
                } else {
                    buttons += `
                        <button class="btn btn-primary btn-sm btn-convertir" 
                                data-id="${docId}" ${!isViewOnly ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}>
                            <i class="bi bi-receipt me-1"></i>Convertir a Factura
                        </button>
                    `;
                }
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
                fecha: getLocalDate(),
                vencimiento: cotizacion.vencimiento,
                total: cotizacion.total || 0,
                estado: 'por_pagar',
                tipo: 'venta',
                detalles: invResult.detallesActualizados,
                total_costo: invResult.costoTotalVenta,
                notas: cotizacion.notas || '',
                terminosCondiciones: cotizacion.terminosCondiciones || 'Favor realizar los pagos a nuestra cuenta bancaria.',
                cotizacion_origen_id: parseInt(cotizacion.id, 10) || cotizacion.id,
                numero: undefined
            };

            const facturaGuardada = await DB.saveWithNextNumero('facturas', nuevaFactura);
            const idReal = facturaGuardada.id;

            // Modificar estado original
            cotizacion.convertidoAFactura = true;
            cotizacion.facturaDestinoId = idReal;
            await DB.save('cotizaciones', cotizacion);

            // Callback
            if (onSuccessCallback) {
                onSuccessCallback(idReal, cotizacion);
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
        if (window._crudPrintTimeout1) clearTimeout(window._crudPrintTimeout1);
        window._crudPrintTimeout1 = setTimeout(() => {
            window.print();
            // Limpiar el DOM inmediatamente después de cerrar el cuadro de diálogo
            if (document.body.contains(printSandbox)) printSandbox.remove();
        }, 250);
    }
};

/**
 * MOTOR COMPARTIDO DE LÍNEAS DE INVENTARIO (COTIZACIONES Y FACTURAS)
 * Centraliza la inyección de precios, stock y autocompletado.
 */
export const ItemEngine = {
    renderProductSearchBox(detalle, productos, isViewOnly = false) {
        // Encontrar producto inicial si existe
        const prod = productos.find(p => p.id === detalle.productoId);
        const initialText = prod ? `[${prod.sku || 'S/N'}] - ${prod.nombre}` : '';
        
        return `
            <div class="position-relative">
                <input type="hidden" class="input-prod-id" value="${detalle.productoId || ''}">
                <input type="text" class="form-control form-control-sm text-muted border-0 bg-light input-prod-search mb-1" 
                       placeholder="Escriba código o nombre..." autocomplete="off" value="${initialText}" ${isViewOnly ? 'disabled' : ''}>
                <input type="text" class="form-control form-control-sm border-0 bg-light mt-1 input-prod-desc" 
                       placeholder="Ej. iPhone 17 Pro Max" value="${detalle.descripcion_personalizada || ''}" ${isViewOnly ? 'disabled' : ''}>
                <div class="search-results-dropdown position-absolute w-100 bg-white shadow-sm" 
                     style="display: none; z-index: 1050; max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; top: 100%;">
                </div>
            </div>
        `;
    },

    bindLineEvents(tr, calcEngine, productos = [], options = { isCompra: false, onCrearProducto: null }) {
        const inputSearch = tr.querySelector('.input-prod-search');
        const inputId = tr.querySelector('.input-prod-id');
        const dropdown = tr.querySelector('.search-results-dropdown');
        
        const inpQty = tr.querySelector('.input-qty');
        const inpPrice = tr.querySelector('.input-price');
        const inpTax = tr.querySelector('.input-tax');
        
        // Contenedores de Metadatos
        const metaProd = tr.querySelector('.meta-prod');
        const metaQty = tr.querySelector('.meta-qty');

        // ==========================================
        // Lógica de Autocompletado (Live Search Asíncrono)
        // ==========================================
        
        // Mantener limpieza manual si se borra el campo
        inputSearch.addEventListener('input', (e) => {
            if (e.target.value.trim().length === 0 && inputId.value) {
                inputId.value = '';
                inpPrice.value = 0;
                inpTax.value = 0;
                if (metaProd) metaProd.innerHTML = '';
                if (metaQty) metaQty.innerHTML = '';
                if (typeof calcEngine === 'function') calcEngine();
            }
        });

        // Usamos importación dinámica para UI por si no estaba
        import('./combobox.js').then(({ UI }) => {
            UI.createAsyncCombobox({
                inputEl: inputSearch,
                hiddenIdEl: inputId,
                fetchItems: async (query) => {
                    const { supabase } = await import('../core/supabase.js');
                    const { default: DB } = await import('../core/db.js');
                    const { data } = await supabase.from('productos')
                        .select('*')
                        .or(`nombre.ilike.%${query}%,sku.ilike.%${query}%`)
                        .limit(20);
                    return data ? data.map(p => DB._mapToFrontend('productos', p)) : [];
                },
                displayProp: 'nombre',
                renderItem: (p) => {
                    return `<strong style="color: var(--text-main);">[${p.sku || p.reference || 'S/N'}]</strong> - ${p.nombre || p.name}`;
                },
                allowCreate: !!options.onCrearProducto,
                onCreate: (query) => {
                    if (options.onCrearProducto) options.onCrearProducto(query, tr);
                },
                onSelect: (p) => {
                    let precioReal = 0;
                    
                    if (options.isCompra) {
                        // Si es compra, usar costo promedio o costo base
                        if (p.costo_promedio !== undefined) precioReal = p.costo_promedio;
                        else if (p.costoBase !== undefined) precioReal = p.costoBase;
                        else if (p.costo !== undefined) precioReal = p.costo;
                    } else {
                        // Si es venta, usar precio de venta
                        if (p.precio_venta !== undefined) precioReal = p.precio_venta;
                        else if (p.precioVenta !== undefined) precioReal = p.precioVenta;
                        else if (p.precio !== undefined) precioReal = p.precio;
                        else if (p.price !== undefined) {
                            if (Array.isArray(p.price) && p.price.length > 0) precioReal = p.price[0].price || 0;
                            else precioReal = p.price;
                        }
                    }
                    
                    inputSearch.value = `[${p.sku || p.reference || 'S/N'}] - ${p.nombre || p.name}`;
                    inputSearch.dataset.lastSku = p.sku || p.reference;
                    
                    // Inyección estricta de Precios e Impuestos
                    inpPrice.value = Number(precioReal || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    inpTax.value = p.impuesto || p.tax || 0;
                    if (parseFloat(inpQty.value || 0) === 0) inpQty.value = 1;

                    // Renderizado de Información Secundaria Inferior
                    if (metaProd) metaProd.innerHTML = `
                        <span style="color: var(--text-muted); font-size: 11px; display: inline-block; margin-top: 4px;">
                            ${p.sku || p.reference || 'S/N'}
                        </span>
                    `;
                    const stockVal = p.stockActual || p.inventory || p.cantidad || 0;
                    if (metaQty) metaQty.innerHTML = `<span style="color: var(--text-muted); font-size: 11px; display: inline-block; margin-top: 4px;">Disp: ${stockVal}</span>`;
                    
                    // Disparo Manual Forzado de Eventos (Math Engine Trigger)
                    inpPrice.dispatchEvent(new Event('input', { bubbles: true }));
                    inpQty.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    // Detonación obligatoria del motor matemático (Fallback redundante)
                    if (typeof calcEngine === 'function') calcEngine();
                }
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
export function numeroALetras(valor) {
    if (valor === 0) return "Cero Pesos M/CTE.";
    
    function Unidades(num){
        switch(num) {
            case 1: return "UN";
            case 2: return "DOS";
            case 3: return "TRES";
            case 4: return "CUATRO";
            case 5: return "CINCO";
            case 6: return "SEIS";
            case 7: return "SIETE";
            case 8: return "OCHO";
            case 9: return "NUEVE";
        }
        return "";
    }
    
    function Decenas(num){
        let decena = Math.floor(num/10);
        let unidad = num - (decena * 10);
        switch(decena) {
            case 1:
                switch(unidad) {
                    case 0: return "DIEZ";
                    case 1: return "ONCE";
                    case 2: return "DOCE";
                    case 3: return "TRECE";
                    case 4: return "CATORCE";
                    case 5: return "QUINCE";
                    default: return "DIECI" + Unidades(unidad);
                }
            case 2:
                switch(unidad) {
                    case 0: return "VEINTE";
                    default: return "VEINTI" + Unidades(unidad);
                }
            case 3: return DecenasY("TREINTA", unidad);
            case 4: return DecenasY("CUARENTA", unidad);
            case 5: return DecenasY("CINCUENTA", unidad);
            case 6: return DecenasY("SESENTA", unidad);
            case 7: return DecenasY("SETENTA", unidad);
            case 8: return DecenasY("OCHENTA", unidad);
            case 9: return DecenasY("NOVENTA", unidad);
            case 0: return Unidades(unidad);
        }
    }
    
    function DecenasY(strSin, numUnidades) {
        if (numUnidades > 0) return strSin + " Y " + Unidades(numUnidades);
        return strSin;
    }
    
    function Centenas(num) {
        let centenas = Math.floor(num / 100);
        let decenas = num - (centenas * 100);
        
        switch(centenas) {
            case 1:
                if (decenas > 0) return "CIENTO " + Decenas(decenas);
                return "CIEN";
            case 2: return "DOSCIENTOS " + Decenas(decenas);
            case 3: return "TRESCIENTOS " + Decenas(decenas);
            case 4: return "CUATROCIENTOS " + Decenas(decenas);
            case 5: return "QUINIENTOS " + Decenas(decenas);
            case 6: return "SEISCIENTOS " + Decenas(decenas);
            case 7: return "SETECIENTOS " + Decenas(decenas);
            case 8: return "OCHOCIENTOS " + Decenas(decenas);
            case 9: return "NOVECIENTOS " + Decenas(decenas);
        }
        return Decenas(decenas);
    }
    
    function Seccion(num, divisor, strSingular, strPlural) {
        let cientos = Math.floor(num / divisor);
        let resto = num - (cientos * divisor);
        let letras = "";
        if (cientos > 0) {
            if (cientos > 1) {
                letras = Centenas(cientos) + " " + strPlural;
            } else {
                letras = strSingular;
            }
        }
        return letras;
    }
    
    function Miles(num) {
        let divisor = 1000;
        let cientos = Math.floor(num / divisor);
        let resto = num - (cientos * divisor);
        let strMiles = Seccion(num, divisor, "MIL", "MIL");
        let strCentenas = Centenas(resto);
        if (strMiles == "") return strCentenas;
        return strMiles + " " + strCentenas;
    }
    
    function Millones(num) {
        let divisor = 1000000;
        let cientos = Math.floor(num / divisor);
        let resto = num - (cientos * divisor);
        let strMillones = Seccion(num, divisor, "UN MILLON DE", "MILLONES DE");
        let strMiles = Miles(resto);
        if(strMillones == "") return strMiles;
        return strMillones + " " + strMiles;
    }
    
    const texto = Millones(Math.floor(valor)).trim();
    return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase() + " Pesos M/CTE.";
}

export const PrintManager = {
    printCuentaCobro(doc, mode = 'print') {
        const oldContainer = document.querySelector('.print-document-template');
        if (oldContainer) oldContainer.remove();

        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const numDisplay = doc.numero || parseInt(String(doc.id).replace(/\D/g, ''), 10) || doc.id;
        
        const rowsHtml = (doc.detalles || []).map(det => {
            const subtotal = (det.cantidad || 0) * (det.precio_unitario || 0);
            return `
                <tr style="border-bottom: 1px solid #dee2e6; font-size: 13px; color: #495057;">
                    <td style="padding: 8px 4px;">
                        <div style="font-weight: 600; color: #212529;">${det.nombre || 'Ítem sin nombre'}</div>
                        ${det.sku ? `<div style="font-size: 11.5px; color: #6c757d; margin-top: 3px;">SKU: ${det.sku}</div>` : ''}
                    </td>
                    <td style="padding: 8px 4px; text-align: center;">${det.cantidad}</td>
                    <td style="padding: 8px 4px; text-align: right;">${formatMoney(det.precio_unitario)}</td>
                    <td style="padding: 8px 4px; text-align: right;">${formatMoney(subtotal)}</td>
                </tr>
            `;
        }).join('');

        const container = document.createElement('div');
        container.id = 'print-view-container';
        container.className = mode === 'preview' ? 'preview-document-template' : `print-document-template hoja-dinamica`;
        container.innerHTML = `
            <!-- HEADER -->
            <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #e9ecef; padding-bottom: 15px; margin-bottom: 25px;">
                <div style="width: 50%;">
                    <h1 style="color: #1a365d; font-size: 24px; margin: 0 0 10px 0; font-weight: 700;">DIEGO IZQUIERDO</h1>
                    <div style="font-size: 13px; color: #495057; line-height: 1.5;">
                        <strong style="color: #212529;">NIT:</strong> 79981638-4<br>
                        <strong style="color: #212529;">Dirección:</strong> Cra.111A No.148-50 4-1404<br>
                        <strong style="color: #212529;">Teléfono:</strong> +57 3158512091
                    </div>
                    <span style="display: inline-block; background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 2px 6px; font-size: 10px; border-radius: 4px; margin-top: 8px; color: #6c757d;">No responsable de IVA</span>
                </div>
                <div style="width: 45%; text-align: right; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px;">
                    <h2 style="color: #2b6cb0; font-size: 18px; margin: 0 0 5px 0;">CUENTA DE COBRO</h2>
                    <h3 style="color: #e53e3e; font-size: 20px; margin: 0 0 5px 0;">No. ${numDisplay}</h3>
                    <p style="font-size: 10px; color: #6c757d; margin: 0;">Documento equivalente / Cuenta original</p>
                </div>
            </div>

            <!-- CLIENT AND PAYMENT INFO -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 25px;">
                <div style="width: 48%; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #f8f9fa; padding: 10px 15px; border-bottom: 1px solid #e9ecef;">
                        <strong style="color: #2b6cb0; font-size: 12px; letter-spacing: 0.5px;">DATOS DEL CLIENTE</strong>
                    </div>
                    <div style="padding: 15px; font-size: 13px; color: #495057;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding-bottom: 8px; width: 30%;"><strong>Razón Social:</strong></td><td style="padding-bottom: 8px;">${doc.cliente_razon_social || ''}</td></tr>
                            <tr><td style="padding-bottom: 8px;"><strong>NIT:</strong></td><td style="padding-bottom: 8px;">${doc.cliente_nit || ''}</td></tr>
                            <tr><td style="padding-bottom: 8px;"><strong>Dirección:</strong></td><td style="padding-bottom: 8px;">${doc.cliente_direccion || ''}</td></tr>
                            <tr><td style="padding-bottom: 8px;"><strong>Ciudad:</strong></td><td style="padding-bottom: 8px;">${doc.cliente_ciudad || ''}</td></tr>
                            <tr><td style="padding-bottom: 8px;"><strong>Teléfono:</strong></td><td style="padding-bottom: 8px;">${doc.cliente_telefono || ''}</td></tr>
                            <tr><td><strong>Correo:</strong></td><td>${doc.cliente_email || ''}</td></tr>
                        </table>
                    </div>
                </div>
                <div style="width: 48%; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #f8f9fa; padding: 10px 15px; border-bottom: 1px solid #e9ecef;">
                        <strong style="color: #2b6cb0; font-size: 12px; letter-spacing: 0.5px;">DETALLES DEL PAGO</strong>
                    </div>
                    <div style="padding: 15px; font-size: 13px; color: #495057;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding-bottom: 8px; width: 45%;"><strong>Fecha Expedición:</strong></td><td style="padding-bottom: 8px;">${doc.fecha}</td></tr>
                            <tr><td style="padding-bottom: 8px;"><strong>Fecha Vencimiento:</strong></td><td style="padding-bottom: 8px;">${doc.fecha_vencimiento || doc.fecha}</td></tr>
                            <tr><td style="padding-bottom: 8px;"><strong>Moneda:</strong></td><td style="padding-bottom: 8px;">COP (Pesos Colombianos)</td></tr>
                            <tr><td style="padding-bottom: 8px;"><strong>Forma de Pago:</strong></td><td style="padding-bottom: 8px;">${doc.forma_pago || 'Contado'}</td></tr>
                            <tr><td><strong>Medio de Pago:</strong></td><td>${doc.medio_pago || 'Instrumento no definido'}</td></tr>
                        </table>
                    </div>
                </div>
            </div>

            <!-- TABLA DE PRODUCTOS -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead style="background-color: #2b6cb0; color: white;">
                    <tr style="font-size: 12px;">
                        <th style="text-align: left; padding: 10px; font-weight: normal; letter-spacing: 0.5px;">DESCRIPCIÓN DEL PRODUCTO / SERVICIO</th>
                        <th style="text-align: center; padding: 10px; font-weight: normal; letter-spacing: 0.5px; width: 10%;">CANT.</th>
                        <th style="text-align: right; padding: 10px; font-weight: normal; letter-spacing: 0.5px; width: 18%;">PRECIO UNIT.</th>
                        <th style="text-align: right; padding: 10px; font-weight: normal; letter-spacing: 0.5px; width: 18%;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <!-- FOOTER TOTALES -->
            <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
                <div style="width: 40%;">
                    <table style="width: 100%; font-size: 13px; color: #495057;">
                        <tr>
                            <td style="text-align: right; padding: 5px 10px; font-weight: bold;">Subtotal:</td>
                            <td style="text-align: right; padding: 5px 10px;">${formatMoney(doc.subtotal)}</td>
                        </tr>
                        <tr>
                            <td style="text-align: right; padding: 5px 10px; font-weight: bold;">Impuestos (IVA):</td>
                            <td style="text-align: right; padding: 5px 10px;">$ 0</td>
                        </tr>
                        <tr style="background-color: #f1f3f5;">
                            <td style="text-align: right; padding: 10px; font-weight: bold; color: #1a365d; font-size: 15px;">TOTAL A PAGAR:</td>
                            <td style="text-align: right; padding: 10px; font-weight: bold; color: #1a365d; font-size: 15px;">${formatMoney(doc.total)}</td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div style="background-color: #f8f9fa; border-left: 4px solid #2b6cb0; padding: 12px 15px; margin-bottom: 25px; font-size: 13px; color: #495057;">
                <strong>Valor en letras:</strong> ${numeroALetras(doc.total)}
            </div>

            <!-- TEXTO LEGAL FIJO -->
            <p style="font-size: 10px; color: #6c757d; line-height: 1.4; text-align: justify; margin-bottom: 50px;">
                Esta cuenta de cobro se asimila en todos sus efectos a una letra de cambio de conformidad con el Art. 774 del Código de Comercio. Autorizo que en caso de incumplimiento de esta obligación sea reportado a las centrales de riesgo, y se cobrarán intereses por mora a la tasa máxima legal permitida. Persona natural no responsable de IVA y no obligada a facturar electrónicamente, de conformidad con lo establecido en el artículo 437 y 616-2 del Estatuto Tributario.
            </p>

            <!-- FIRMA -->
            <div style="display: flex; justify-content: space-between; margin-top: 40px; margin-bottom: 20px; padding: 0 20px;">
                <div style="text-align: center; width: 40%;">
                    <div style="border-bottom: 1px solid #ced4da; margin-bottom: 8px;"></div>
                    <strong style="font-size: 11px; color: #212529;">ELABORADO POR</strong><br>
                    <span style="font-size: 10px; color: #6c757d;">DIEGO IZQUIERDO - NIT 79981638-4</span>
                </div>
                <div style="text-align: center; width: 40%;">
                    <div style="border-bottom: 1px solid #ced4da; margin-bottom: 8px;"></div>
                    <strong style="font-size: 11px; color: #212529;">ACEPTADA, FIRMA Y/O SELLO Y FECHA</strong><br>
                    <span style="font-size: 10px; color: #6c757d; text-transform: uppercase;">${doc.cliente_razon_social || ''}</span>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        if (mode === 'preview') {
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100vw';
            container.style.height = '100vh';
            container.style.zIndex = '1060';
            container.style.overflowY = 'auto';
            container.style.backgroundColor = '#f8f9fa';
            container.style.padding = '0';
            
            const closeHeader = document.createElement('div');
            closeHeader.style.position = 'sticky';
            closeHeader.style.top = '0';
            closeHeader.style.zIndex = '1070';
            closeHeader.style.backgroundColor = '#fff';
            closeHeader.style.padding = '15px';
            closeHeader.style.textAlign = 'center';
            closeHeader.style.borderBottom = '1px solid #dee2e6';
            closeHeader.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            closeHeader.innerHTML = `
                <div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-success btn-compartir-preview"><i class="bi bi-share me-1"></i>Compartir</button>
                    <button class="btn btn-danger btn-cerrar-preview"><i class="bi bi-x-circle me-1"></i>Cerrar</button>
                </div>
            `;
            
            closeHeader.querySelector('.btn-cerrar-preview').addEventListener('click', () => {
                container.remove();
            });
            
            const btnCompartir = closeHeader.querySelector('.btn-compartir-preview');
            const originalCompartirHtml = btnCompartir.innerHTML;
            
            btnCompartir.disabled = true;
            btnCompartir.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Preparando...';
            
            let cachedShareFile = null;
            
            const precacheShareImage = async () => {
                try {
                    if (!window.html2canvas) {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                            script.onload = resolve;
                            script.onerror = () => reject(new Error('No se pudo cargar html2canvas'));
                            document.head.appendChild(script);
                        });
                    }
                    
                    const oldScrollTop = container.scrollTop;
                    container.scrollTop = 0;
                    
                    const canvas = await window.html2canvas(container, { 
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff'
                    });
                    
                    container.scrollTop = oldScrollTop;
                    
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                    if (!blob) throw new Error('Error al generar imagen');
                    
                    const fileName = `CuentaCobro_${numDisplay}.png`;
                    cachedShareFile = new File([blob], fileName, { type: 'image/png' });
                    
                    btnCompartir.innerHTML = originalCompartirHtml;
                    btnCompartir.disabled = false;
                    
                } catch (err) {
                    console.error('Error precargando imagen de compartir:', err);
                    btnCompartir.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Error al preparar';
                }
            };
            
            setTimeout(precacheShareImage, 100);
            
            btnCompartir.addEventListener('click', async () => {
                if (!cachedShareFile) return;
                
                if (navigator.canShare && navigator.canShare({ files: [cachedShareFile] })) {
                    try {
                        await navigator.share({
                            title: 'Cuenta de Cobro',
                            text: 'Adjunto la cuenta de cobro solicitada.',
                            files: [cachedShareFile]
                        });
                    } catch (e) {
                        console.log('Share canceled or failed', e);
                    }
                } else {
                    const url = URL.createObjectURL(cachedShareFile);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = cachedShareFile.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            });
            
            container.prepend(closeHeader);
        } else {
            window.print();
            container.remove();
        }
    },

    printDocument(doc, tipoDoc, contactos, productos, mode = 'print') {

        // 1. Limpiar cualquier contenedor de impresión previo si existe
        const oldContainer = document.querySelector('.print-document-template');
        if (oldContainer) oldContainer.remove();

        // 2. Determinar tamaño de hoja
        const printClass = 'hoja-dinamica';

        // 3. Resolutores de Datos
        const cliente = contactos.find(c => c.id === doc.clienteId) || {};
        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const numDisplay = doc.numero || parseInt(String(doc.id).replace(/\D/g, ''), 10) || doc.id;
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
        container.className = mode === 'preview' ? 'preview-document-template' : `print-document-template ${printClass}`;
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
                <thead style="display: table-header-group;">
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
            <div>
                <div style="display: flex; justify-content: space-between; margin-top: 24px;">
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
            </div>
        `;

        document.body.appendChild(container);

        if (mode === 'preview') {
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100vw';
            container.style.height = '100vh';
            container.style.zIndex = '1060';
            container.style.overflowY = 'auto';
            container.style.backgroundColor = '#f8f9fa';
            container.style.padding = '0';
            
            const closeHeader = document.createElement('div');
            closeHeader.style.position = 'sticky';
            closeHeader.style.top = '0';
            closeHeader.style.zIndex = '1070';
            closeHeader.style.backgroundColor = '#fff';
            closeHeader.style.padding = '15px';
            closeHeader.style.textAlign = 'center';
            closeHeader.style.borderBottom = '1px solid #dee2e6';
            closeHeader.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            closeHeader.innerHTML = `
                <div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-success btn-compartir-preview"><i class="bi bi-share me-1"></i>Compartir</button>
                    <button class="btn btn-danger btn-cerrar-preview"><i class="bi bi-x-circle me-1"></i>Cerrar</button>
                </div>
            `;
            
            closeHeader.querySelector('.btn-cerrar-preview').addEventListener('click', () => {
                container.remove();
            });
            
            const btnCompartir = closeHeader.querySelector('.btn-compartir-preview');
            const originalCompartirHtml = btnCompartir.innerHTML;
            
            // Estado inicial: Deshabilitado mientras precarga
            btnCompartir.disabled = true;
            btnCompartir.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Preparando...';
            
            let cachedShareFile = null;
            
            // Función de precarga en segundo plano
            const precacheShareImage = async () => {
                try {
                    if (!window.html2canvas) {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                            script.onload = resolve;
                            script.onerror = () => reject(new Error('No se pudo cargar html2canvas'));
                            document.head.appendChild(script);
                        });
                    }
                    
                    const oldScrollTop = container.scrollTop;
                    container.scrollTop = 0;
                    
                    const canvas = await window.html2canvas(paperContent, { 
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff'
                    });
                    
                    container.scrollTop = oldScrollTop;
                    
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                    if (!blob) throw new Error('Error al generar imagen');
                    
                    const fileName = `${tipoDoc.replace(/[^a-zA-Z0-9]/g, '_')}_${numDisplay}.png`;
                    cachedShareFile = new File([blob], fileName, { type: 'image/png' });
                    
                    // Precarga terminada con éxito
                    btnCompartir.innerHTML = originalCompartirHtml;
                    btnCompartir.disabled = false;
                    
                } catch (err) {
                    console.error('Error precargando imagen de compartir:', err);
                    btnCompartir.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Error al preparar';
                }
            };
            
            // Iniciar precarga sin bloquear
            setTimeout(precacheShareImage, 100);
            
            btnCompartir.addEventListener('click', async () => {
                if (!cachedShareFile) return; // Bloqueo de seguridad
                
                if (navigator.canShare && navigator.canShare({ files: [cachedShareFile] })) {
                    try {
                        // PRIMER AWAIT DESPUÉS DEL GESTO DEL USUARIO
                        await navigator.share({
                            title: tipoDoc,
                            text: 'Adjunto el documento solicitado.',
                            files: [cachedShareFile]
                        });
                    } catch (e) {
                        console.log('Share canceled or failed', e);
                    }
                } else {
                    // Fallback descarga manual
                    const url = URL.createObjectURL(cachedShareFile);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = cachedShareFile.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            });
            
            container.insertBefore(closeHeader, container.firstChild);
            
            // Envolver el contenido en un "papel" para que se vea bien en desktop, 
            // pero que ocupe todo el ancho en mobile para facilitar captura
            const paperContent = document.createElement('div');
            paperContent.style.maxWidth = '800px';
            paperContent.style.margin = '20px auto';
            paperContent.style.padding = '20px';
            paperContent.style.backgroundColor = '#fff';
            paperContent.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
            paperContent.style.fontFamily = "'Inter', sans-serif";
            paperContent.style.color = "#212529";
            
            // Mover todo excepto el header de cierre al paperContent
            while (container.childNodes.length > 1) {
                paperContent.appendChild(container.childNodes[1]);
            }
            container.appendChild(paperContent);
            
        } else {
            // 6. Ejecutar impresión simple y directa
            if (window._crudPrintTimeout2) clearTimeout(window._crudPrintTimeout2);
            window._crudPrintTimeout2 = setTimeout(() => {
                window.print();
                // Limpiar el DOM 1 segundo después de que se cierre el cuadro de impresión
                if (window._crudPrintCleanTimeout) clearTimeout(window._crudPrintCleanTimeout);
                window._crudPrintCleanTimeout = setTimeout(() => {
                    if (document.body.contains(container)) {
                        container.remove();
                    }
                }, 1000);
            }, 150);
        }
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
        if (window._crudExportTimeout) clearTimeout(window._crudExportTimeout);
        window._crudExportTimeout = setTimeout(() => {
            try {
                // Formateadores locales
                const formatMoney = (val) => parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                
                // Mapear objetos a filas planas
                const rows = dataArray.map(item => {
                    const clienteNombre = getClienteNameFunc ? getClienteNameFunc(item.clienteId) : (item.clienteId || 'N/A');
                    const numDoc = item.numero || parseInt(String(item.id).replace(/\D/g, ''), 10) || item.id;
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
                const dateStr = getLocalDate();
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
