// js/utils/core-actions.js
import DB, { getLocalDate } from '../core/db.js';
import { InventarioUtils } from './inventarioUtils.js';
import { supabase } from '../core/supabase.js';
import { numeroALetras } from './numeroALetras.js';
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

        const estadoDoc = documentData ? documentData.estado : null;
        const esAnulado = estadoDoc === 'anulada' || estadoDoc === 'anulado' || estadoDoc === 'voided' || estadoDoc === 'void';

        if (!isNew) {
            if (!esAnulado) {
                buttons += `
                    <button class="btn btn-outline-secondary btn-sm me-2 btn-editar" data-id="${docId}" ${!isViewOnly ? 'style="display: none;"' : ''}>
                        <i class="bi bi-pencil me-1"></i>Editar
                    </button>
                `;
            }

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

            // Regla de Negocio Adicional: Bloqueo de Reprocesamiento Fuerte en DB
            const { data: existe } = await supabase
                .from('facturas')
                .select('id, numero')
                .eq('cotizacion_origen_id', cotizacion.id || idCotizacion);

            if (existe && existe.length > 0) {
                this.showWarningModal(`Esta cotización ya fue convertida a la factura [No. ${existe[0].numero || existe[0].id}].`);
                return;
            }

            // Regla de Negocio: Validar y Simular FIFO antes de convertir (FASE 1 - Read Only)
            const planInventario = await InventarioUtils.calcularSalidaInventario(cotizacion.detalles || []);
            if (!planInventario.success) {
                this.showWarningModal("Acción interceptada: " + planInventario.error);
                return; // ABORTA LA CONVERSIÓN
            }

            // Regla de Negocio: Condición Permitida (Primera vez) - RPC Atómico
            const { data: v_result, error } = await supabase.rpc('convertir_cotizacion_a_factura', {
                p_cotizacion_id: parseInt(cotizacion.id, 10),
                p_factura_header: {
                    fecha: getLocalDate(),
                    vencimiento: cotizacion.vencimiento,
                    contacto_id: cotizacion.clienteId,
                    total: cotizacion.total || 0,
                    estado: 'por_pagar',
                    tipo: 'venta',
                    observaciones: cotizacion.notas || '',
                    total_costo: planInventario.costoTotalVenta,
                    numero: cotizacion.numero
                },
                p_factura_detalles: planInventario.detallesActualizados.map((det, i) => ({
                    producto_id: det.productoId,
                    cantidad: det.cantidad,
                    precio_unitario: det.precio,
                    descuento_porcentaje: det.descuento,
                    subtotal: det.subtotal,
                    descripcion_personalizada: det.descripcion_personalizada || ''
                })),
                p_operaciones_fifo: planInventario.operacionesDB.map(op => ({
                    action: op.action,
                    id: op.data.id,
                    producto_id: op.data.productoId,
                    fecha_ingreso: op.data.fechaIngreso,
                    cantidad_actual: op.data.cantidadActual,
                    costo_unitario: op.data.costoUnitario
                })),
                p_origen_documento: 'factura:' + (cotizacion.numero || 'nueva') + ' (desde cotizacion:' + cotizacion.id + ')'
            });

            if (error) throw new Error("Error al convertir a factura: " + error.message);

            const idReal = v_result.id;

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

    showSuccessModal(message) {
        const existing = document.getElementById('core-success-modal');
        if (existing) existing.remove();
        const modalHtml = `
            <div id="core-success-modal" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(0,0,0,0.4); z-index: 9999; backdrop-filter: blur(2px);">
                <div class="bg-white p-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px; max-width: 450px; border-top: 4px solid #10b981;">
                    <div class="d-flex align-items-center mb-3">
                        <i class="bi bi-check-circle-fill text-success fs-4 me-3"></i>
                        <h5 class="mb-0 fw-bold" style="color: var(--text-main); font-size: 16px;">Listo</h5>
                    </div>
                    <p style="color: var(--text-body); font-size: 14px; line-height: 1.5; margin-bottom: 24px;">${message}</p>
                    <div class="text-end">
                        <button class="btn btn-light px-4 text-dark" style="font-weight: var(--weight-medium); border: 1px solid #e2e8f0;" onclick="document.getElementById('core-success-modal').remove()">Entendido</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    showErrorModal(message) {
        const existing = document.getElementById('core-error-modal');
        if (existing) existing.remove();
        const modalHtml = `
            <div id="core-error-modal" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(0,0,0,0.4); z-index: 9999; backdrop-filter: blur(2px);">
                <div class="bg-white p-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px; max-width: 450px; border-top: 4px solid #ef4444;">
                    <div class="d-flex align-items-center mb-3">
                        <i class="bi bi-x-circle-fill text-danger fs-4 me-3"></i>
                        <h5 class="mb-0 fw-bold" style="color: var(--text-main); font-size: 16px;">Error</h5>
                    </div>
                    <p style="color: var(--text-body); font-size: 14px; line-height: 1.5; margin-bottom: 24px;">${message}</p>
                    <div class="text-end">
                        <button class="btn btn-light px-4 text-dark" style="font-weight: var(--weight-medium); border: 1px solid #e2e8f0;" onclick="document.getElementById('core-error-modal').remove()">Cerrar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    showConfirmModalAsync(message) {
        return new Promise((resolve) => {
            const existing = document.getElementById('core-confirm-modal');
            if (existing) existing.remove();

            const modalHtml = `
                <div id="core-confirm-modal" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(0,0,0,0.4); z-index: 9999; backdrop-filter: blur(2px);">
                    <div class="bg-white p-4" style="box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.03), 0px 1px 3px rgba(0, 0, 0, 0.05); border-radius: 8px; max-width: 450px; border-top: 4px solid #3b82f6;">
                        <div class="d-flex align-items-center mb-3">
                            <i class="bi bi-question-circle-fill text-primary fs-4 me-3"></i>
                            <h5 class="mb-0 fw-bold" style="color: var(--text-main); font-size: 16px;">Confirmar Acción</h5>
                        </div>
                        <p style="color: var(--text-body); font-size: 14px; line-height: 1.5; margin-bottom: 24px;">${message}</p>
                        <div class="text-end d-flex justify-content-end gap-2">
                            <button id="btn-confirm-cancel" class="btn btn-light px-4 text-dark" style="font-weight: var(--weight-medium); border: 1px solid #e2e8f0;">Cancelar</button>
                            <button id="btn-confirm-accept" class="btn btn-primary px-4" style="font-weight: var(--weight-medium);">Continuar</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
                document.getElementById('core-confirm-modal').remove();
                resolve(false);
            });
            
            document.getElementById('btn-confirm-accept').addEventListener('click', () => {
                document.getElementById('core-confirm-modal').remove();
                resolve(true);
            });
        });
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


window.CoreActions = CoreActions;
