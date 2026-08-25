import DB, { getLocalDate } from '../core/db.js';
import { supabase } from '../core/supabase.js';
import { numeroALetras } from './numeroALetras.js';
import { CoreActions } from './crud.js';
/**
 * GESTOR DE IMPRESIÓN DINÁMICA (MEDIA HOJA / HOJA COMPLETA)
 * Genera un contenedor temporal formateado para imprimir un documento.
 */


export const PrintManager = {
    _renderPreviewShell(innerHtmlContent, options) {
        const { mode, fileName, title = 'Documento', printClass = 'hoja-dinamica', shareText = 'Adjunto el documento solicitado.' } = options;

        if (mode === 'print') {
            const oldPrintContainer = document.getElementById('print-document-render');
            if (oldPrintContainer) oldPrintContainer.remove();

            const printContainer = document.createElement('div');
            printContainer.id = 'print-document-render';
            printContainer.className = `print-document-template ${printClass}`;
            printContainer.innerHTML = innerHtmlContent;
            document.body.appendChild(printContainer);

            const cleanupPrint = () => {
                if (document.body.contains(printContainer)) printContainer.remove();
                window.removeEventListener('afterprint', cleanupPrint);
            };
            window.addEventListener('afterprint', cleanupPrint);

            if (window._crudPrintCleanupFallback) clearTimeout(window._crudPrintCleanupFallback);
            window._crudPrintCleanupFallback = setTimeout(cleanupPrint, 15000);

            window.print();
            return;
        }

        const oldContainer = document.querySelector('.print-document-template');
        if (oldContainer) oldContainer.remove();

        const container = document.createElement('div');
        container.id = 'print-view-container';
        container.className = 'preview-document-template';
        container.innerHTML = innerHtmlContent;

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
            let paperContent;
            
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
                        backgroundColor: '#ffffff',
                        windowWidth: Math.max(document.documentElement.scrollWidth, paperContent.scrollWidth + 40),
                        windowHeight: Math.max(document.documentElement.scrollHeight, paperContent.scrollHeight + 40)
                    });
                    
                    container.scrollTop = oldScrollTop;
                    
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                    if (!blob) throw new Error('Error al generar imagen');
                    
                    cachedShareFile = new File([blob], fileName, { type: 'image/png' });
                    
                    btnCompartir.innerHTML = originalCompartirHtml;
                    btnCompartir.disabled = false;
                    
                } catch (err) {
                    console.error('Error precargando imagen de compartir:', err);
                    btnCompartir.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Error al preparar';
                    if (window.CoreActions) {
                        window.CoreActions.showWarningModal('No se pudo generar la imagen para compartir. Por favor verifica tu conexión a internet o intenta de nuevo.');
                    } else {
                        alert('No se pudo generar la imagen para compartir. Por favor verifica tu conexión a internet.');
                    }
                }
            };
            
            setTimeout(precacheShareImage, 100);
            
            btnCompartir.addEventListener('click', async () => {
                if (!cachedShareFile) return;
                
                if (navigator.canShare && navigator.canShare({ files: [cachedShareFile] })) {
                    try {
                        await navigator.share({
                            title: title,
                            text: shareText,
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

            paperContent = document.createElement('div');
            if (printClass === 'hoja-dinamica') {
                paperContent.style.width = '816px';
                paperContent.style.minHeight = '528px';
            } else if (printClass === 'cuenta-cobro') {
                paperContent.style.width = '816px';
                paperContent.style.minHeight = '1056px';
            } else {
                paperContent.style.width = '816px';
                paperContent.style.minHeight = '1056px';
            }
            paperContent.style.margin = '20px auto';
            paperContent.style.padding = '40px';
            paperContent.style.boxSizing = 'border-box';
            paperContent.style.backgroundColor = '#fff';
            paperContent.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
            paperContent.style.fontFamily = "'Inter', sans-serif";
            paperContent.style.color = "#212529";

            while (container.childNodes.length > 1) {
                paperContent.appendChild(container.childNodes[1]);
            }
            container.appendChild(paperContent);
        }
    },

    printCuentaCobro(doc, mode = 'print') {
        const oldContainer = document.querySelector('.print-document-template');
        if (oldContainer) oldContainer.remove();

        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const numDisplay = doc.numero || parseInt(String(doc.id).replace(/\D/g, ''), 10) || doc.id;
        
        const rowsHtml = (doc.detalles || []).map(det => {
            const subtotal = (det.cantidad || 0) * (det.precio_unitario || 0);
            return `
                <tr style="border-bottom: 1px solid #dee2e6; font-size: 14px; color: #495057;">
                    <td style="padding: 8px 4px;">
                        <div style="font-weight: 600; color: #212529;">${det.nombre || 'Ítem sin nombre'}</div>
                        ${det.sku ? `<div style="font-size: 12px; color: #6c757d; margin-top: 3px;">SKU: ${det.sku}</div>` : ''}
                    </td>
                    <td style="padding: 8px 4px; text-align: center;">${det.cantidad}</td>
                    <td style="padding: 8px 4px; text-align: right;">${formatMoney(det.precio_unitario)}</td>
                    <td style="padding: 8px 4px; text-align: right;">${formatMoney(subtotal)}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!-- HEADER -->
            <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; margin-bottom: 15px;">
                <div style="width: 50%;">
                    <h1 style="color: #1a365d; font-size: 24px; margin: 0 0 10px 0; font-weight: 700;">DIEGO IZQUIERDO</h1>
                    <div style="font-size: 13px; color: #495057; line-height: 1.5;">
                        <strong style="color: #212529;">NIT:</strong> 79981638-4<br>
                        <strong style="color: #212529;">Dirección:</strong> Cra.111A No.148-50 4-1404<br>
                        <strong style="color: #212529;">Teléfono:</strong> +57 3158512091
                    </div>
                    <span style="display: inline-block; background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 2px 6px; font-size: 10px; border-radius: 4px; margin-top: 8px; color: #6c757d;">No responsable de IVA</span>
                </div>
                <div style="width: 45%; text-align: right; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; box-sizing: border-box;">
                    <h2 style="color: #2b6cb0; font-size: 18px; margin: 0 0 5px 0;">CUENTA DE COBRO</h2>
                    <h3 style="color: #e53e3e; font-size: 20px; margin: 0 0 5px 0;">No. ${numDisplay}</h3>
                    <p style="font-size: 10px; color: #6c757d; margin: 0;">Documento equivalente / Cuenta original</p>
                </div>
            </div>

            <!-- CLIENT AND PAYMENT INFO -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <div style="width: 48%; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #f8f9fa; padding: 10px 15px; border-bottom: 1px solid #e9ecef;">
                        <strong style="color: #2b6cb0; font-size: 12px; letter-spacing: 0.5px;">DATOS DEL CLIENTE</strong>
                    </div>
                    <div style="padding: 10px; font-size: 14px; color: #495057;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding-bottom: 5px; width: 30%; white-space: nowrap;"><strong>Razón Social:</strong></td><td style="padding-bottom: 5px; padding-left: 5px;">${doc.cliente_razon_social || ''}</td></tr>
                            <tr><td style="padding-bottom: 5px;"><strong>NIT:</strong></td><td style="padding-bottom: 5px;">${doc.cliente_nit || ''}</td></tr>
                            <tr><td style="padding-bottom: 5px;"><strong>Dirección:</strong></td><td style="padding-bottom: 5px;">${doc.cliente_direccion || ''}</td></tr>
                            <tr><td style="padding-bottom: 5px;"><strong>Ciudad:</strong></td><td style="padding-bottom: 5px;">${doc.cliente_ciudad || ''}</td></tr>
                            <tr><td style="padding-bottom: 5px;"><strong>Teléfono:</strong></td><td style="padding-bottom: 5px;">${doc.cliente_telefono || ''}</td></tr>
                            <tr><td><strong>Correo:</strong></td><td>${doc.cliente_email || ''}</td></tr>
                        </table>
                    </div>
                </div>
                <div style="width: 48%; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #f8f9fa; padding: 10px 15px; border-bottom: 1px solid #e9ecef;">
                        <strong style="color: #2b6cb0; font-size: 12px; letter-spacing: 0.5px;">DETALLES DEL PAGO</strong>
                    </div>
                    <div style="padding: 10px; font-size: 14px; color: #495057;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding-bottom: 5px; width: 45%;"><strong>Fecha Expedición:</strong></td><td style="padding-bottom: 5px;">${doc.fecha}</td></tr>
                            <tr><td style="padding-bottom: 5px; white-space: nowrap;"><strong>Fecha Vencimiento:</strong></td><td style="padding-bottom: 5px;">${doc.fecha_vencimiento || doc.fecha}</td></tr>
                            <tr><td style="padding-bottom: 5px; white-space: nowrap;"><strong>Moneda:</strong></td><td style="padding-bottom: 5px;">COP (Pesos Colombianos)</td></tr>
                            <tr><td style="padding-bottom: 5px;"><strong>Forma de Pago:</strong></td><td style="padding-bottom: 5px;">${doc.forma_pago || 'Contado'}</td></tr>
                            <tr><td style="white-space: nowrap;"><strong>Medio de Pago:</strong></td><td>${doc.medio_pago || 'Instrumento no definido'}</td></tr>
                        </table>
                    </div>
                </div>
            </div>

            <!-- TABLA DE PRODUCTOS -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                <thead style="background-color: #2b6cb0; color: white;">
                    <tr style="font-size: 12px;">
                        <th style="text-align: left; padding: 6px 8px; font-weight: normal; letter-spacing: 0.5px;">DESCRIPCIÓN DEL PRODUCTO / SERVICIO</th>
                        <th style="text-align: center; padding: 6px 8px; font-weight: normal; letter-spacing: 0.5px; width: 10%;">CANT.</th>
                        <th style="text-align: right; padding: 6px 8px; font-weight: normal; letter-spacing: 0.5px; width: 18%;">PRECIO UNIT.</th>
                        <th style="text-align: right; padding: 6px 8px; font-weight: normal; letter-spacing: 0.5px; width: 18%;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <!-- FOOTER TOTALES -->
            <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                <div style="width: 40%;">
                    <table style="width: 100%; font-size: 14px; color: #495057;">
                        <tr>
                            <td style="text-align: right; padding: 5px 10px; font-weight: bold;">Subtotal:</td>
                            <td style="text-align: right; padding: 5px 10px;">${formatMoney(doc.subtotal)}</td>
                        </tr>
                        <tr>
                            <td style="text-align: right; padding: 5px 10px; font-weight: bold; white-space: nowrap;">Impuestos (IVA):</td>
                            <td style="text-align: right; padding: 5px 10px;">$ 0</td>
                        </tr>
                        <tr style="background-color: #f1f3f5;">
                            <td style="text-align: right; padding: 10px; font-weight: bold; color: #1a365d; font-size: 17px; white-space: nowrap;">TOTAL A PAGAR:</td>
                            <td style="text-align: right; padding: 10px; font-weight: bold; color: #1a365d; font-size: 17px;">${formatMoney(doc.total)}</td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div style="background-color: #f8f9fa; border-left: 4px solid #2b6cb0; padding: 8px 12px; margin-bottom: 12px; font-size: 14px; color: #495057;">
                <strong>Valor en letras:</strong> ${numeroALetras(doc.total)}
            </div>

            <!-- TEXTO LEGAL FIJO -->
            <p style="font-size: 11px; color: #6c757d; line-height: 1.4; text-align: justify; margin-bottom: 15px;">
                Esta cuenta de cobro se asimila en todos sus efectos a una letra de cambio de conformidad con el Art. 774 del Código de Comercio. Autorizo que en caso de incumplimiento de esta obligación sea reportado a las centrales de riesgo, y se cobrarán intereses por mora a la tasa máxima legal permitida. Persona natural no responsable de IVA y no obligada a facturar electrónicamente, de conformidad con lo establecido en el artículo 437 y 616-2 del Estatuto Tributario.
            </p>

            <!-- FIRMA -->
            <div style="display: flex; justify-content: space-between; margin-top: 12px; margin-bottom: 5px; padding: 0 20px;">
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

        this._renderPreviewShell(htmlContent, {
            mode,
            printClass: 'cuenta-cobro',
            fileName: `CuentaCobro_${numDisplay}.png`,
            title: 'Cuenta de Cobro'
        });
    },

    printDocument(doc, tipoDoc, contactos, productos, mode = 'print') {

        // 1. Limpiar cualquier contenedor de impresión previo si existe
        const oldContainer = document.querySelector('.print-document-template');
        if (oldContainer) oldContainer.remove();

        // 2. Determinar tamaño de hoja
        const printClass = 'documento-venta';

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
                <tr style="border-bottom: 1px solid #dee2e6; font-size: 11px; color: #495057;">
                    <td style="padding: 5px 4px; word-break: break-word; overflow-wrap: break-word;">${prod.sku || 'N/A'}</td>
                    <td style="padding: 5px 4px; word-break: break-word; overflow-wrap: break-word;">
                        <div style="font-weight: 400; color: #212529; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${prod.nombre || 'Ítem sin nombre'}${det.descripcion_personalizada ? ' — ' + det.descripcion_personalizada : ''}</div>
                    </td>
                    <td style="padding: 5px 4px; text-align: right; white-space: nowrap;">${formatMoney(det.precio)}</td>
                    <td style="padding: 5px 4px; text-align: center;">${det.cantidad}</td>
                    <td style="padding: 5px 4px; text-align: right;">${det.descuento || 0}%</td>
                    <td style="padding: 5px 4px; text-align: right; white-space: nowrap;">${formatMoney(subtotal)}</td>
                </tr>
            `;
        }).join('');

        // 5. Construir HTML
        const htmlContent = `
            <!-- INFO CLIENTE Y DOC -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <div style="background-color: #f8f9fa; padding: 10px; width: 48%; border-radius: 6px; box-sizing: border-box;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #212529;">${cliente.nombre || 'Sin cliente'}</p>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
                        <strong style="color: #495057;">CC/NIT</strong><span>${cliente.identificacion || ''}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px;">
                        <strong style="color: #495057;">TEL</strong><span>${cliente.telefono || ''}</span>
                    </div>
                </div>
                <div style="width: 48%; padding-top: 10px;">
                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; padding-bottom: 3px; border-bottom: 1px solid #dee2e6;">
                        <strong style="color: #495057;">${tipoDoc} No.</strong><span style="font-weight: bold; font-size: 14px;">${numDisplay}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; padding-bottom: 3px; border-bottom: 1px solid #dee2e6;">
                        <strong style="color: #495057;">Fecha de expedición</strong><span>${doc.fecha}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; padding-bottom: 3px; border-bottom: 1px solid #dee2e6;">
                        <strong style="color: #495057;">Fecha de vencimiento</strong><span>${doc.vencimiento || doc.fecha}</span>
                    </div>
                </div>
            </div>

            <!-- TABLA DE PRODUCTOS -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed;">
                <colgroup>
                    <col style="width: 10%;">
                    <col style="width: 50%;">
                    <col style="width: 12%;">
                    <col style="width: 7%;">
                    <col style="width: 5%;">
                    <col style="width: 16%;">
                </colgroup>
                <thead style="display: table-header-group;">
                    <tr>
                        <td colspan="6" style="height: 4px; border: none; padding: 0;"></td>
                    </tr>
                    <tr>
                        <td colspan="6" style="border: none; padding: 0;">
                            <!-- HEADER IMPRESIÓN -->
                            <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #6c757d; padding-bottom: 8px; margin-bottom: 12px;">
                                <div style="width: 40%;">
                                    <img src="LogoMas.png" style="max-height: 80px; margin-bottom: 5px;" alt="Logo" onerror="this.style.display='none'">
                                </div>
                                <div style="text-align: right; width: 40%; padding-top: 15px;">
                                    <p style="margin: 0; font-size: 14px; color: #6c757d; font-weight: bold;">3158512091</p>
                                </div>
                            </div>
                        </td>
                    </tr>
                    <tr style="border-bottom: 2px solid #dee2e6; color: #495057; font-size: 13px;">
                        <th style="text-align: left; padding: 5px 4px; width: 10%; word-break: break-word; overflow-wrap: break-word;">Ref.</th>
                        <th style="text-align: left; padding: 5px 4px; width: 50%; word-break: break-word; overflow-wrap: break-word;">Ítem</th>
                        <th style="text-align: right; padding: 5px 4px; width: 12%;">Precio</th>
                        <th style="text-align: center; padding: 5px 4px; width: 7%;">Cant.</th>
                        <th style="text-align: right; padding: 5px 4px; width: 5%;">Dto.</th>
                        <th style="text-align: right; padding: 5px 4px; width: 16%;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <!-- FOOTER TOTALES -->
            <div style="page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                    <div style="width: 50%;">
                        <h5 style="color: #6c757d; font-size: 14px; margin: 0 0 8px 0;">Observaciones</h5>
                        <p style="font-size: 12px; color: #495057; margin: 0;">${doc.notas || ''}</p>
                    </div>
                    <div style="width: 38%;">
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                            <strong style="color: #495057;">Subtotal</strong><span>${formatMoney(doc.total)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 16px; margin-bottom: 6px; border-top: 1px solid #dee2e6; padding-top: 8px;">
                            <strong style="color: #212529;">Total</strong><span style="font-weight: bold; color: #212529;">${formatMoney(doc.total)}</span>
                        </div>
                        <div style="text-align: right; font-size: 12px; font-weight: bold; color: #6c757d;">
                            Cantidad de productos: ${totalUnidades}
                        </div>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 5px; margin-bottom: 10px; page-break-inside: avoid;">
                    <div style="width: 200px; height: 25px; background-color: #f8f9fa; margin: 0 auto; border-bottom: 1px solid #495057;"></div>
                    <p style="font-size: 10px; color: #212529; margin-top: 5px;">ELABORADO POR</p>
                </div>
            </div>
        `;

        const fileName = `${tipoDoc.replace(/[^a-zA-Z0-9]/g, '_')}_${numDisplay}.png`;
        this._renderPreviewShell(htmlContent, {
            mode,
            fileName,
            title: tipoDoc,
            printClass
        });
    },

    async printEstadoCuenta(clienteId) {
        const oldContainer = document.querySelector('.print-document-template');
        if (oldContainer) oldContainer.remove();

        const cliente = await DB.get('contactos', clienteId);
        if (!cliente) {
            CoreActions.showWarningModal('Cliente no encontrado.');
            return;
        }

        const { data: facturas, error } = await supabase.rpc('get_cartera_con_saldos', { 
            p_tipo_cartera: 'cxc', 
            p_contacto_id: String(clienteId) 
        });

        if (error || !facturas || facturas.length === 0) {
            CoreActions.showWarningModal('No se encontraron facturas pendientes para este cliente.');
            return;
        }

        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const totalPorCobrar = facturas.reduce((sum, f) => sum + (parseFloat(f.saldo) || 0), 0);
        const hoyStr = getLocalDate();

        let rowsHtml = '';
        facturas.forEach(f => {
            const diasDespachado = Math.floor((new Date() - new Date(f.fecha)) / (1000 * 60 * 60 * 24));
            
            let barColor = '#198754';
            if (diasDespachado >= 30 && diasDespachado <= 60) barColor = '#fd7e14';
            else if (diasDespachado > 60) barColor = '#dc3545';
            
            let widthPercent = Math.min((diasDespachado / 120) * 100, 100);
            if (widthPercent < 2) widthPercent = 2;
            
            rowsHtml += `
                <tr style="border-bottom: 1px solid #dee2e6; font-size: 12px; color: #495057;">
                    <td style="padding: 10px 4px;">${f.numero || f.id}</td>
                    <td style="padding: 10px 4px;">${f.fecha}</td>
                    <td style="padding: 10px 4px;">${f.vencimiento || f.fecha}</td>
                    <td style="padding: 10px 4px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="background-color: #e9ecef; flex: 1; height: 6px; border-radius: 3px; overflow: hidden; min-width: 50px; max-width: 80px;">
                                <div style="background-color: ${barColor}; height: 100%; width: ${widthPercent}%;"></div>
                            </div>
                            <span style="font-size: 11px; font-weight: 500; min-width: 45px;">${diasDespachado} días</span>
                        </div>
                    </td>
                    <td style="padding: 10px 4px; text-align: right;">${formatMoney(f.total)}</td>
                    <td style="padding: 10px 4px; text-align: right; font-weight: 600; color: #212529;">${formatMoney(f.saldo)}</td>
                </tr>
            `;
        });

        const htmlContent = `
            <!-- HEADER -->
            <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #6c757d; padding-bottom: 15px; margin-bottom: 25px;">
                <div style="width: 40%;">
                    <img src="LogoMas.png" style="max-height: 80px; margin-bottom: 5px;" alt="Logo" onerror="this.style.display='none'">
                </div>
                <div style="text-align: right; width: 40%; padding-top: 15px;">
                    <h2 style="color: #495057; margin-top: 0; margin-bottom: 5px; font-size: 22px;">ESTADO DE CUENTA</h2>
                    <p style="margin: 0; font-size: 14px; color: #6c757d;">Fecha: ${hoyStr}</p>
                </div>
            </div>

            <!-- BLOQUE CLIENTE Y TOTAL -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                <div style="width: 50%;">
                    <p style="margin: 0 0 5px 0; font-weight: bold; font-size: 18px; color: #212529;">${cliente.nombre || 'Sin cliente'}</p>
                </div>
                <div style="background-color: #fdf3f2; padding: 15px 25px; border-radius: 8px; border-left: 4px solid #f06548; text-align: right;">
                    <p style="margin: 0 0 5px 0; font-size: 13px; color: #e85335; font-weight: 600; text-transform: uppercase;">Total Pendiente</p>
                    <h3 style="margin: 0; font-size: 24px; color: #a42c16;">${formatMoney(totalPorCobrar)}</h3>
                </div>
            </div>

            <!-- TABLA FACTURAS -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
                <thead style="display: table-header-group; background-color: #f8f9fa;">
                    <tr style="border-bottom: 2px solid #dee2e6; color: #495057; font-size: 12px; font-weight: bold;">
                        <th style="text-align: left; padding: 10px 4px;">No.</th>
                        <th style="text-align: left; padding: 10px 4px;">Creación</th>
                        <th style="text-align: left; padding: 10px 4px;">Vencimiento</th>
                        <th style="text-align: left; padding: 10px 4px;">Días despachado</th>
                        <th style="text-align: right; padding: 10px 4px;">Total</th>
                        <th style="text-align: right; padding: 10px 4px;">Saldo</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr style="border-top: 2px solid #dee2e6; font-size: 14px;">
                        <td colspan="5" style="padding: 12px 4px; text-align: right; font-weight: bold; color: #495057;">TOTAL POR COBRAR:</td>
                        <td style="padding: 12px 4px; text-align: right; font-weight: bold; color: #a42c16;">${formatMoney(totalPorCobrar)}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- PIE DE PAGINA -->
            <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #6c757d; font-size: 12px;">
                <p style="margin: 0 0 5px 0;">Agradecemos regularizar el saldo pendiente a la mayor brevedad. Para consultas o acuerdos de pago, contáctenos directamente.</p>
                <p style="margin: 0; font-weight: bold;">MAS Accesorios &middot; 3158512091</p>
            </div>
        `;

        this._renderPreviewShell(htmlContent, {
            mode: 'preview',
            fileName: `EstadoCuenta_${cliente.nombre ? cliente.nombre.replace(/[^a-zA-Z0-9]/g, '_') : 'Cliente'}.png`,
            title: 'Estado de Cuenta',
            printClass: 'hoja-dinamica',
            shareText: `Buen día ${cliente.nombre || 'cliente'}, envío estado de cuenta.`
        });
    }
};