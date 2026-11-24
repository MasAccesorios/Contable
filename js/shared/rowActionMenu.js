// js/shared/rowActionMenu.js
// Menús de Acciones Inteligentes Flotantes (3 puntos) para Facturas y Cotizaciones
// MAS Accesorios - Sistema Contable

import { formatMoneyCOP, buildWhatsAppUrl, buildFacturaWhatsAppText, buildCotizacionWhatsAppText } from './cobranzaUtils.js';

/**
 * Calcula las coordenadas óptimas de posicionamiento con detección de colisiones de pantalla.
 * Función pura para fácil verificación en entornos Node y DOM.
 */
export function calculateMenuPosition({ rect, menuWidth = 230, menuHeight = 280, windowWidth = 1024, windowHeight = 768, scrollX = 0, scrollY = 0 }) {
    // 1. Alineación Horizontal: alinear borde derecho del menú con el borde derecho del botón
    let left = rect.right - menuWidth + scrollX;
    if (left < 10) left = 10;
    if (left + menuWidth > windowWidth - 10) {
        left = windowWidth - menuWidth - 10;
    }

    // 2. Alineación Vertical: detectar si colisiona con el borde inferior del viewport
    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;
    let top;
    let openUpwards = false;

    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        // Abrir hacia arriba
        top = rect.top + scrollY - menuHeight - 4;
        openUpwards = true;
    } else {
        // Abrir hacia abajo
        top = rect.bottom + scrollY + 4;
        openUpwards = false;
    }

    return { top: Math.max(10, top), left: Math.max(10, left), openUpwards };
}

/**
 * Elimina cualquier menú de acciones flotante activo.
 */
export function cleanupFloatingRowMenus() {
    document.querySelectorAll('.row-action-menu').forEach(el => el.remove());
}

/**
 * Manejador estándar de envío por WhatsApp con fallback a clipboard.
 */
export function handleWhatsAppShare({ doc, cliente, isFactura = true }) {
    cleanupFloatingRowMenus();
    const phone = cliente?.telefono || cliente?.phone || '';
    const text = isFactura 
        ? buildFacturaWhatsAppText(doc, cliente) 
        : buildCotizacionWhatsAppText(doc, cliente);

    if (phone) {
        const url = buildWhatsAppUrl(phone, text);
        if (url) {
            window.open(url, '_blank');
            return;
        }
    }

    // Si no tiene teléfono configurado, solicitar al usuario
    const targetPhone = window.prompt ? window.prompt(`Ingresa el número de celular o WhatsApp para enviar ${isFactura ? 'la factura' : 'la cotización'} a ${cliente?.nombre || 'el cliente'} (ej: 3151234567):`, '') : '';
    if (targetPhone && targetPhone.trim()) {
        const url = buildWhatsAppUrl(targetPhone.trim(), text);
        if (url) {
            window.open(url, '_blank');
            return;
        }
    }

    // Fallback: Copiar al portapapeles
    if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            if (window.alert) window.alert('Mensaje copiado al portapapeles. ¡Pégalo en el chat de WhatsApp con el cliente!');
        }).catch(() => {});
    }
}

/**
 * Abre el menú contextual inteligente para Facturas de Venta.
 */
export function openFacturaRowMenu({
    trigger,
    factura,
    cliente,
    onAbonar,
    onVerDetalle,
    onImprimir,
    onDuplicar,
    onAnular,
    onEliminar,
    onWhatsApp
}) {
    cleanupFloatingRowMenus();
    if (!trigger || !factura) return;

    const num = factura.numero || factura.id;
    const total = Number(factura.total || 0);
    const totalPagado = Number(factura.totalPagado ?? factura.total_pagado ?? 0);
    const saldo = Math.max(0, Number(factura.saldoPendiente ?? factura.saldo_pendiente ?? (total - totalPagado)));
    
    const isAnulada = factura.estado === 'anulada' || factura.estado === 'void' || factura.estado === 'voided';
    const isCobrada = saldo <= 0 && !isAnulada;
    const isParcial = totalPagado > 0 && saldo > 0 && !isAnulada;
    const isPorCobrar = totalPagado === 0 && saldo > 0 && !isAnulada;

    const menu = document.createElement('div');
    menu.className = 'row-action-menu position-absolute';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', `Acciones de Factura #${num}`);

    // Badge de estado para el header del menú
    let badgeHtml = '';
    if (isAnulada) {
        badgeHtml = `<span class="badge bg-secondary-subtle text-secondary rounded-pill" style="font-size: 10px;">Anulada</span>`;
    } else if (isCobrada) {
        badgeHtml = `<span class="badge bg-success-subtle text-success rounded-pill" style="font-size: 10px;">Cobrada</span>`;
    } else if (isParcial) {
        badgeHtml = `<span class="badge bg-warning-subtle text-warning-emphasis rounded-pill" style="font-size: 10px;">Abono parcial</span>`;
    } else {
        badgeHtml = `<span class="badge bg-primary-subtle text-primary rounded-pill" style="font-size: 10px;">Por cobrar</span>`;
    }

    let itemsHtml = `
        <div class="row-action-header">
            <span class="badge bg-light text-dark border fw-bold" style="font-size: 11px;">
                FAC #${num}
            </span>
            ${badgeHtml}
        </div>
    `;

    // 1. Botón Estrella: Registrar Pago (solo si tiene saldo y no está anulada)
    if (!isAnulada && saldo > 0) {
        itemsHtml += `
            <button type="button" class="row-action-item item-primary btn-action-abonar" title="Registrar Pago de Factura">
                <span class="d-flex align-items-center">
                    <span class="row-action-icon" style="background: rgba(5, 150, 105, 0.15); color: #059669;">
                        <i class="bi bi-cash-stack"></i>
                    </span>
                    <span>Registrar Pago</span>
                </span>
                <span class="badge bg-white text-success border border-success-subtle rounded-pill fw-semibold" style="font-size: 10px; padding: 2px 7px;">
                    ${formatMoneyCOP(saldo)}
                </span>
            </button>
        `;
    }

    // 2. Ver Detalle / Trazabilidad
    itemsHtml += `
        <button type="button" class="row-action-item btn-action-ver" title="Ver Detalle y Trazabilidad">
            <span class="d-flex align-items-center">
                <span class="row-action-icon" style="background: rgba(37, 99, 235, 0.1); color: #2563eb;">
                    <i class="bi bi-layout-sidebar-inset-reverse"></i>
                </span>
                <span>Ver detalle y trazabilidad</span>
            </span>
        </button>
    `;

    // 3. Imprimir / PDF
    itemsHtml += `
        <button type="button" class="row-action-item btn-action-imprimir" title="Imprimir Formato Oficial">
            <span class="d-flex align-items-center">
                <span class="row-action-icon" style="background: rgba(100, 116, 139, 0.1); color: #475569;">
                    <i class="bi bi-printer"></i>
                </span>
                <span>Imprimir / PDF</span>
            </span>
        </button>
    `;

    // 4. WhatsApp (Cobro o Comprobante)
    const wppLabel = saldo > 0 ? 'Cobrar por WhatsApp' : 'Comprobante por WhatsApp';
    itemsHtml += `
        <button type="button" class="row-action-item btn-action-whatsapp" title="${wppLabel}">
            <span class="d-flex align-items-center">
                <span class="row-action-icon" style="background: rgba(22, 163, 74, 0.12); color: #16a34a;">
                    <i class="bi bi-whatsapp"></i>
                </span>
                <span>${wppLabel}</span>
            </span>
            ${saldo > 0 ? `<i class="bi bi-send-fill text-muted" style="font-size: 11px;"></i>` : ''}
        </button>
    `;

    // 5. Duplicar Factura
    itemsHtml += `
        <button type="button" class="row-action-item btn-action-duplicar" title="Crear nueva factura basada en esta">
            <span class="d-flex align-items-center">
                <span class="row-action-icon" style="background: rgba(124, 58, 237, 0.1); color: #7c3aed;">
                    <i class="bi bi-copy"></i>
                </span>
                <span>Duplicar factura</span>
            </span>
            <span class="badge bg-light text-muted border rounded-pill" style="font-size: 9.5px;">Copia</span>
        </button>
    `;

    // 6. Editar Factura (solo si no está anulada)
    if (!isAnulada) {
        itemsHtml += `
            <a href="#/ingresos/facturas/editar/${factura.id}" class="row-action-item btn-action-editar" title="Editar Factura">
                <span class="d-flex align-items-center">
                    <span class="row-action-icon" style="background: rgba(100, 116, 139, 0.1); color: #475569;">
                        <i class="bi bi-pencil"></i>
                    </span>
                    <span>Editar factura</span>
                </span>
            </a>
        `;
    }

    // 7. Acciones Destructivas: Eliminar o Anular
    if (!isAnulada) {
        itemsHtml += `<div class="row-action-divider"></div>`;
        if (totalPagado > 0) {
            itemsHtml += `
                <button type="button" class="row-action-item item-danger btn-action-anular" title="Anular venta y revertir inventario/pagos">
                    <span class="d-flex align-items-center">
                        <span class="row-action-icon" style="background: rgba(220, 38, 38, 0.1); color: #dc2626;">
                            <i class="bi bi-x-circle"></i>
                        </span>
                        <span>Anular venta (revertir)</span>
                    </span>
                </button>
            `;
        } else {
            itemsHtml += `
                <button type="button" class="row-action-item item-danger btn-action-eliminar" title="Eliminar factura y devolver stock">
                    <span class="d-flex align-items-center">
                        <span class="row-action-icon" style="background: rgba(220, 38, 38, 0.1); color: #dc2626;">
                            <i class="bi bi-trash"></i>
                        </span>
                        <span>Eliminar factura</span>
                    </span>
                </button>
            `;
        }
    }

    menu.innerHTML = itemsHtml;
    document.body.appendChild(menu);

    // Posicionamiento inteligente
    const rect = trigger.getBoundingClientRect();
    const pos = calculateMenuPosition({
        rect,
        menuWidth: menu.offsetWidth || 230,
        menuHeight: menu.offsetHeight || 280,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
    });

    menu.style.top = `${pos.top}px`;
    menu.style.left = `${pos.left}px`;
    if (pos.openUpwards) menu.classList.add('menu-upwards');

    // Eventos
    menu.querySelector('.btn-action-abonar')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanupFloatingRowMenus();
        if (typeof onAbonar === 'function') onAbonar(factura.id, saldo);
    });

    menu.querySelector('.btn-action-ver')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanupFloatingRowMenus();
        if (typeof onVerDetalle === 'function') onVerDetalle(factura.id);
    });

    menu.querySelector('.btn-action-imprimir')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanupFloatingRowMenus();
        if (typeof onImprimir === 'function') onImprimir(factura.id);
    });

    menu.querySelector('.btn-action-whatsapp')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (typeof onWhatsApp === 'function') {
            onWhatsApp(factura, cliente);
        } else {
            handleWhatsAppShare({ doc: factura, cliente, isFactura: true });
        }
    });

    menu.querySelector('.btn-action-duplicar')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanupFloatingRowMenus();
        if (typeof onDuplicar === 'function') onDuplicar(factura.id);
    });

    menu.querySelector('.btn-action-editar')?.addEventListener('click', () => {
        cleanupFloatingRowMenus();
    });

    menu.querySelector('.btn-action-anular')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanupFloatingRowMenus();
        if (typeof onAnular === 'function') onAnular(factura.id);
    });

    menu.querySelector('.btn-action-eliminar')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanupFloatingRowMenus();
        if (typeof onEliminar === 'function') onEliminar(factura.id);
    });
}

/**
 * Abre el menú contextual inteligente para Cotizaciones.
 */
export function openCotizacionRowMenu({
    trigger,
    cotizacion,
    cliente,
    onConvertir,
    onVerDetalle,
    onVerFactura,
    onImprimir,
    onDuplicar,
    onEliminar,
    onWhatsApp
}) {
    cleanupFloatingRowMenus();
    if (!trigger || !cotizacion) return;

    const num = cotizacion.numero || cotizacion.id;
    const isFacturada = Boolean(cotizacion.convertido_a_factura || cotizacion.convertidoAFactura || cotizacion.facturaDestinoId);
    const facturaDestinoId = cotizacion.facturaDestinoId || cotizacion.factura_destino_id;

    const menu = document.createElement('div');
    menu.className = 'row-action-menu position-absolute';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', `Acciones de Cotización #${num}`);

    let itemsHtml = `
        <div class="row-action-header">
            <span class="badge bg-light text-dark border fw-bold" style="font-size: 11px;">
                COT #${num}
            </span>
            ${isFacturada 
                ? `<span class="badge bg-success-subtle text-success rounded-pill" style="font-size: 10px;"><i class="bi bi-patch-check-fill me-1"></i>Facturada</span>`
                : `<span class="badge bg-warning-subtle text-warning-emphasis rounded-pill" style="font-size: 10px;"><i class="bi bi-hourglass-split me-1"></i>Sin facturar</span>`
            }
        </div>
    `;

    // 1. Botón Estrella: Convertir a Factura (si no está facturada) o Ver Factura (si ya está facturada)
    if (!isFacturada) {
        itemsHtml += `
            <button type="button" class="row-action-item item-primary btn-action-convertir" title="Convertir cotización en Factura de Venta">
                <span class="d-flex align-items-center">
                    <span class="row-action-icon" style="background: rgba(5, 150, 105, 0.15); color: #059669;">
                        <i class="bi bi-arrow-right-circle-fill"></i>
                    </span>
                    <span>Convertir a Factura</span>
                </span>
                <span class="badge bg-white text-success border border-success-subtle rounded-pill fw-semibold" style="font-size: 10px; padding: 2px 7px;">
                    Generar venta
                </span>
            </button>
        `;
    } else if (facturaDestinoId) {
        itemsHtml += `
            <button type="button" class="row-action-item item-primary-blue btn-action-ver-factura" title="Ver la Factura de Venta generada">
                <span class="d-flex align-items-center">
                    <span class="row-action-icon" style="background: rgba(37, 99, 235, 0.15); color: #1d4ed8;">
                        <i class="bi bi-box-arrow-up-right"></i>
                    </span>
                    <span>Ver Factura Asociada</span>
                </span>
                <span class="badge bg-white text-primary border border-primary-subtle rounded-pill fw-semibold" style="font-size: 10px;">
                    #${facturaDestinoId}
                </span>
            </button>
        `;
    }

    // 2. Ver Detalle
    itemsHtml += `
        <button type="button" class="row-action-item btn-action-ver" title="Ver Detalle de Cotización">
            <span class="d-flex align-items-center">
                <span class="row-action-icon" style="background: rgba(37, 99, 235, 0.1); color: #2563eb;">
                    <i class="bi bi-layout-sidebar-inset-reverse"></i>
                </span>
                <span>Ver detalle</span>
            </span>
        </button>
    `;

    // 3. Editar (solo si no está facturada)
    if (!isFacturada) {
        itemsHtml += `
            <a href="#/ingresos/cotizaciones/editar/${cotizacion.id}" class="row-action-item btn-action-editar" title="Editar Cotización">
                <span class="d-flex align-items-center">
                    <span class="row-action-icon" style="background: rgba(100, 116, 139, 0.1); color: #475569;">
                        <i class="bi bi-pencil"></i>
                    </span>
                    <span>Editar cotización</span>
                </span>
            </a>
        `;
    }

    // 4. Imprimir / PDF
    itemsHtml += `
        <button type="button" class="row-action-item btn-action-imprimir" title="Imprimir Oferta Comercial">
            <span class="d-flex align-items-center">
                <span class="row-action-icon" style="background: rgba(100, 116, 139, 0.1); color: #475569;">
                    <i class="bi bi-printer"></i>
                </span>
                <span>Imprimir / PDF</span>
            </span>
        </button>
    `;

    // 5. Enviar por WhatsApp
    itemsHtml += `
        <button type="button" class="row-action-item btn-action-whatsapp" title="Enviar Oferta por WhatsApp">
            <span class="d-flex align-items-center">
                <span class="row-action-icon" style="background: rgba(22, 163, 74, 0.12); color: #16a34a;">
                    <i class="bi bi-whatsapp"></i>
                </span>
                <span>Enviar por WhatsApp</span>
            </span>
            <i class="bi bi-send-fill text-muted" style="font-size: 11px;"></i>
        </button>
    `;

    // 6. Duplicar Cotización
    itemsHtml += `
        <button type="button" class="row-action-item btn-action-duplicar" title="Crear nueva cotización basada en esta">
            <span class="d-flex align-items-center">
                <span class="row-action-icon" style="background: rgba(124, 58, 237, 0.1); color: #7c3aed;">
                    <i class="bi bi-copy"></i>
                </span>
                <span>Duplicar cotización</span>
            </span>
            <span class="badge bg-light text-muted border rounded-pill" style="font-size: 9.5px;">Copia</span>
        </button>
    `;

    // 7. Acciones Destructivas: Eliminar
    itemsHtml += `
        <div class="row-action-divider"></div>
        <button type="button" class="row-action-item item-danger btn-action-eliminar" title="Eliminar Cotización">
            <span class="d-flex align-items-center">
                <span class="row-action-icon" style="background: rgba(220, 38, 38, 0.1); color: #dc2626;">
                    <i class="bi bi-trash"></i>
                </span>
                <span>Eliminar cotización</span>
            </span>
        </button>
    `;

    menu.innerHTML = itemsHtml;
    document.body.appendChild(menu);

    // Posicionamiento inteligente
    const rect = trigger.getBoundingClientRect();
    const pos = calculateMenuPosition({
        rect,
        menuWidth: menu.offsetWidth || 230,
        menuHeight: menu.offsetHeight || 280,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
    });

    menu.style.top = `${pos.top}px`;
    menu.style.left = `${pos.left}px`;
    if (pos.openUpwards) menu.classList.add('menu-upwards');

    // Eventos
    menu.querySelector('.btn-action-convertir')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanupFloatingRowMenus();
        if (typeof onConvertir === 'function') onConvertir(cotizacion.id);
    });

    menu.querySelector('.btn-action-ver-factura')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanupFloatingRowMenus();
        if (typeof onVerFactura === 'function') onVerFactura(facturaDestinoId);
    });

    menu.querySelector('.btn-action-ver')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanupFloatingRowMenus();
        if (typeof onVerDetalle === 'function') onVerDetalle(cotizacion.id);
    });

    menu.querySelector('.btn-action-editar')?.addEventListener('click', () => {
        cleanupFloatingRowMenus();
    });

    menu.querySelector('.btn-action-imprimir')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanupFloatingRowMenus();
        if (typeof onImprimir === 'function') onImprimir(cotizacion.id);
    });

    menu.querySelector('.btn-action-whatsapp')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (typeof onWhatsApp === 'function') {
            onWhatsApp(cotizacion, cliente);
        } else {
            handleWhatsAppShare({ doc: cotizacion, cliente, isFactura: false });
        }
    });

    menu.querySelector('.btn-action-duplicar')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanupFloatingRowMenus();
        if (typeof onDuplicar === 'function') onDuplicar(cotizacion.id);
    });

    menu.querySelector('.btn-action-eliminar')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanupFloatingRowMenus();
        if (typeof onEliminar === 'function') onEliminar(cotizacion.id);
    });
}
