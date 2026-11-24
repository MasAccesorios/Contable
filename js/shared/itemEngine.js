import { escapeHtml } from './formatters.js';

/**
 * MOTOR COMPARTIDO DE LÍNEAS DE INVENTARIO (COTIZACIONES Y FACTURAS)
 * Centraliza la inyección de precios, stock y autocompletado.
 */
export const ItemEngine = {
    renderProductSearchBox(detalle, productos, isViewOnly = false) {
        // Encontrar producto inicial si existe
        const prod = productos.find(p => String(p.id) === String(detalle.productoId));
        const initialText = prod ? `[${escapeHtml(prod.sku) || 'S/N'}] - ${escapeHtml(prod.nombre)}` : '';
        const customDesc = detalle.descripcion_personalizada || detalle.descripcionPersonalizada || '';
        
        return `
            <div class="product-search-cell">
                <div class="position-relative product-search-wrapper">
                    <input type="hidden" class="input-prod-id" value="${escapeHtml(detalle.productoId) || ''}">
                    <input type="text" class="form-control form-control-sm text-dark border-0 bg-light input-prod-search mb-1 fw-medium" 
                           placeholder="Escriba código o nombre..." autocomplete="off" value="${initialText}" ${isViewOnly ? 'disabled' : ''} style="border-radius: 6px;">
                </div>
                <input type="text" class="form-control form-control-sm text-muted border-0 bg-light mt-1 input-prod-desc" 
                       placeholder="Descripción adicional (opcional)..." value="${escapeHtml(customDesc)}" ${isViewOnly ? 'disabled' : ''} style="border-radius: 6px; font-size: 11px;">
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
                fetchItems: (query) => UI.fetchProductosCombobox(query),
                displayProp: 'nombre',
                renderItem: (p) => {
                    return `<strong style="color: var(--text-main);">[${escapeHtml(p.sku || p.reference) || 'S/N'}]</strong> - ${escapeHtml(p.nombre || p.name)}`;
                },
                allowCreate: !!options.onCrearProducto,
                onCreate: (query) => {
                    if (options.onCrearProducto) options.onCrearProducto(query, tr);
                },
                onSelect: async (p) => {
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
                    
                    inputSearch.value = `[${escapeHtml(p.sku || p.reference) || 'S/N'}] - ${escapeHtml(p.nombre || p.name)}`;
                    inputSearch.dataset.lastSku = p.sku || p.reference;
                    
                    // Inyección estricta de Precios e Impuestos
                    if (inpPrice) inpPrice.value = Number(precioReal || 0).toString().replace('.', ',');
                    if (inpTax) inpTax.value = p.impuesto || p.tax || 0;
                    if (inpQty && parseFloat(inpQty.value || 0) === 0) inpQty.value = 1;

                    // Renderizado de Información Secundaria Inferior
                    if (metaProd) metaProd.innerHTML = `
                        <span style="color: var(--text-muted); font-size: 11px; display: inline-block; margin-top: 4px;">
                            ${escapeHtml(p.sku || p.reference) || 'S/N'}
                        </span>
                    `;
                    const stockVal = p.stockActual || p.inventory || p.cantidad || 0;
                    if (metaQty) {
                        const pillClass = Number(stockVal) > 0 ? 'stock-pill-ok' : 'stock-pill-low';
                        const pillIcon = Number(stockVal) > 0 ? '<i class="bi bi-check-circle me-1"></i>' : '<i class="bi bi-exclamation-triangle me-1"></i>';
                        metaQty.innerHTML = `<span class="${pillClass}" style="margin-top: 4px;">${pillIcon}Disp: ${stockVal}</span>`;
                    }
                        
                    // Limpieza total del contexto anterior
                    let oldDropdown = tr.querySelector('.price-ml-dropdown');
                    if (oldDropdown) oldDropdown.remove();
                    
                    let oldSelect = tr.querySelector('.price-select-ml');
                    if (oldSelect) oldSelect.remove();
                    
                    let oldDatalist = tr.querySelector('.price-ml-datalist');
                    if (oldDatalist) oldDatalist.remove();
                    
                    if (inpPrice) {
                        inpPrice.classList.remove('d-none');
                        inpPrice.removeAttribute('list');
                    }

                    // Lógica de precio sugerido para Mercado Libre
                    if (!options.isCompra) {
                        ItemEngine.cargarPreciosMercadoLibre(tr, p.id, calcEngine);
                    }
                    
                    // Disparo Manual Forzado de Eventos (Math Engine Trigger)
                    if (inpPrice) inpPrice.dispatchEvent(new Event('input', { bubbles: true }));
                    if (inpQty) inpQty.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    // Detonación obligatoria del motor matemático (Fallback redundante)
                    if (typeof calcEngine === 'function') calcEngine();
                }
            });
        });
    },

    addRow(options) {
        const {
            detalle,
            tbody,
            isViewOnly,
            productosFactura,
            contadorLineas,
            calcEngine,
            reindexRows,
            isCompra = false,
            onCrearProducto = null,
        } = options;

        const tr = document.createElement('tr');
        tr.dataset.uid = detalle.id;
        tr.style.borderBottom = '1px solid var(--border-color)';
        tr.innerHTML = `
            <td class="text-muted text-center num-linea align-top pt-3">${contadorLineas}</td>
            <td class="align-top">
                ${this.renderProductSearchBox(detalle, productosFactura, isViewOnly)}
                <div class="meta-prod ps-1"></div>
            </td>
            <td class="align-top">
                <input type="number" min="0" class="form-control form-control-sm border-0 bg-light input-qty mb-1" value="${detalle.cantidad}" ${isViewOnly ? 'disabled' : ''} style="border-radius: 6px; font-weight: 500;">
                <div class="meta-qty ps-1"></div>
            </td>
            <td class="align-top"><input type="text" class="form-control form-control-sm border-0 bg-light input-price" value="${Number(detalle.precio || 0).toString().replace('.', ',')}" placeholder="$" ${isViewOnly ? 'disabled' : ''} style="border-radius: 6px; font-weight: 600;"></td>
            <td class="align-top"><input type="number" step="any" min="0" max="100" class="form-control form-control-sm border-0 bg-light input-disc" value="${detalle.descuento}" placeholder="0 %" ${isViewOnly ? 'disabled' : ''} style="border-radius: 6px;"></td>
            <td class="align-top"><input type="number" step="any" min="0" max="100" class="form-control form-control-sm border-0 bg-light input-tax" value="${detalle.impuesto}" placeholder="%" ${isViewOnly ? 'disabled' : ''} style="border-radius: 6px;"></td>
            <td class="text-end align-top pt-3">
                <span class="calc-subtotal fw-bold d-block tnum" style="color: var(--text-main); font-size: 13px;">$0,00</span>
                <a href="#" class="toggle-desc-tax d-md-none text-decoration-none mt-2 d-inline-block" style="font-size: var(--fs-xs); color: var(--primary);">+ Editar descuento/impuesto</a>
            </td>
            <td class="text-center align-top pt-2">
                ${!isViewOnly ? `<button class="btn btn-sm btn-light border-0 text-danger p-1 btn-eliminar-linea" title="Eliminar fila" style="border-radius: 6px;">
                    <i class="bi bi-trash"></i>
                </button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);

        // Toggle Descuento/Impuesto móvil
        const toggleDesc = tr.querySelector('.toggle-desc-tax');
        if (toggleDesc) {
            toggleDesc.addEventListener('click', (e) => {
                e.preventDefault();
                tr.classList.toggle('show-discount-tax');
                toggleDesc.textContent = tr.classList.contains('show-discount-tax') ? '- Ocultar descuento/impuesto' : '+ Editar descuento/impuesto';
            });
        }

        // Delegar Eventos Principales al Motor Global (Auto-Pricing y Metadatos)
        let bindEventsOptions = { isCompra: isCompra };
        if (onCrearProducto) bindEventsOptions.onCrearProducto = onCrearProducto;

        this.bindLineEvents(tr, () => calcEngine(), productosFactura, bindEventsOptions);

        const inpPrice = tr.querySelector('.input-price');
        
        import('./formatters.js').then(fmt => {
            fmt.applyCurrencyFormatting(inpPrice);
            
            if (!isViewOnly) {
                const inpQty = tr.querySelector('.input-qty');
                const inpDisc = tr.querySelector('.input-disc');
                const inpTax = tr.querySelector('.input-tax');
                
                [inpQty, inpPrice, inpDisc, inpTax].forEach(el => {
                    el.addEventListener('input', () => calcEngine());
                });
            }
        });

        if (!isViewOnly) {
            // Eliminar línea
            tr.querySelector('.btn-eliminar-linea').addEventListener('click', () => {
                tr.remove();
                if (reindexRows) reindexRows();
                calcEngine();
            });
        }

        // Render inicial si había producto seleccionado (Edición)
        if (detalle.productoId) {
            // Forzar re-cálculo visual inicial si es necesario
            const metaProd = tr.querySelector('.meta-prod');
            const metaQty = tr.querySelector('.meta-qty');
            const prod = productosFactura.find(p => String(p.id) === String(detalle.productoId));
            if (prod) {
                if (metaProd) metaProd.innerHTML = `<span style="color: var(--text-muted); font-size: 11px; display: inline-block; margin-top: 4px;">${escapeHtml(prod.sku) || 'S/N'}</span>`;
                const stockVal = prod.stockActual || prod.cantidad || 0;
                if (metaQty) {
                    const pillClass = Number(stockVal) > 0 ? 'stock-pill-ok' : 'stock-pill-low';
                    const pillIcon = Number(stockVal) > 0 ? '<i class="bi bi-check-circle me-1"></i>' : '<i class="bi bi-exclamation-triangle me-1"></i>';
                    metaQty.innerHTML = `<span class="${pillClass}" style="margin-top: 4px;">${pillIcon}Disp: ${stockVal}</span>`;
                }
            }

            if (!isCompra) {
                this.cargarPreciosMercadoLibre(tr, parseInt(detalle.productoId, 10), calcEngine);
            }
        }
        
        return tr;
    },

    async cargarPreciosMercadoLibre(tr, productoId, calcEngine) {
        if (!tr || !productoId) return;

        // Limpiar contenedor previo
        const existingContainer = tr.querySelector('.ml-price-container');
        if (existingContainer) existingContainer.remove();

        const container = tr.closest('.dash-layout') || tr.closest('form') || document;
        const clienteInput = container.querySelector('#select-cliente');
        const searchCliente = container.querySelector('#search-cliente');
        const cliId = String(clienteInput?.value || '').trim();
        const cliName = String(searchCliente?.value || '').toLowerCase();
        const esMercadoLibre = cliId === "698" || cliName.includes('mercado libre') || cliName.includes('mercadolibre');

        if (!esMercadoLibre) return;

        const inpPrice = tr.querySelector('.input-price');
        if (!inpPrice || inpPrice.disabled) return;

        try {
            const { supabase } = await import('../core/supabase.js');

            // Consultar estadísticas de venta a Mercado Libre y la venta más reciente en paralelo
            const [statsRes, lastSaleRes] = await Promise.all([
                supabase.rpc('get_precio_promedio_ml', { p_producto_id: productoId }),
                supabase.from('factura_detalles')
                    .select('precio_unitario, facturas!inner(id, fecha, numero, contacto_id, tipo, estado)')
                    .eq('producto_id', productoId)
                    .eq('facturas.contacto_id', 698)
                    .eq('facturas.tipo', 'venta')
                    .not('facturas.estado', 'in', '("anulada","void","voided")')
                    .order('id', { ascending: false })
                    .limit(1)
            ]);

            const mlData = statsRes.data;
            const mlInfo = Array.isArray(mlData) ? mlData[0] : mlData;
            const ultimoPrecio = lastSaleRes.data?.[0]?.precio_unitario ? Number(lastSaleRes.data[0].precio_unitario) : null;

            const tieneVentas = (mlInfo && Number(mlInfo.veces_vendido) > 0) || (ultimoPrecio !== null && ultimoPrecio > 0);
            if (!tieneVentas) return;

            const formatCOP = (num) => Number(Math.round(num || 0)).toLocaleString('es-CO');
            const formatInput = (num) => Number(num || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const primaryPrice = ultimoPrecio || mlInfo?.precio_promedio || mlInfo?.precio_minimo || 0;
            if (!primaryPrice) return;

            const mlContainer = document.createElement('div');
            mlContainer.className = 'ml-price-container mt-1';

            let itemsHtml = '';
            if (ultimoPrecio) {
                itemsHtml += `
                    <li>
                        <button type="button" class="dropdown-item d-flex align-items-center justify-content-between py-1.5 px-2 rounded btn-ml-price" data-price="${ultimoPrecio}" style="font-size: 11px;">
                            <span class="d-flex align-items-center gap-1.5 text-secondary">
                                <span class="badge" style="background: #ecfdf5; color: #065f46; font-size: 9.5px; font-weight: 700;">Último</span>
                                Facturado:
                            </span>
                            <strong class="text-dark font-monospace" style="font-size: 11.5px;">$${formatCOP(ultimoPrecio)}</strong>
                        </button>
                    </li>
                `;
            }
            if (mlInfo?.precio_promedio) {
                itemsHtml += `
                    <li>
                        <button type="button" class="dropdown-item d-flex align-items-center justify-content-between py-1.5 px-2 rounded btn-ml-price" data-price="${mlInfo.precio_promedio}" style="font-size: 11px;">
                            <span class="d-flex align-items-center gap-1.5 text-secondary">
                                <span class="badge" style="background: #eff6ff; color: #1d4ed8; font-size: 9.5px; font-weight: 700;">Prom</span>
                                Promedio:
                            </span>
                            <strong class="text-dark font-monospace" style="font-size: 11.5px;">$${formatCOP(mlInfo.precio_promedio)}</strong>
                        </button>
                    </li>
                `;
            }
            if (mlInfo?.precio_minimo) {
                itemsHtml += `
                    <li>
                        <button type="button" class="dropdown-item d-flex align-items-center justify-content-between py-1.5 px-2 rounded btn-ml-price" data-price="${mlInfo.precio_minimo}" style="font-size: 11px;">
                            <span class="d-flex align-items-center gap-1.5 text-secondary">
                                <span class="badge" style="background: #f8fafc; color: #475569; font-size: 9.5px; font-weight: 600;">Mín</span>
                                Mínimo:
                            </span>
                            <strong class="text-dark font-monospace" style="font-size: 11.5px;">$${formatCOP(mlInfo.precio_minimo)}</strong>
                        </button>
                    </li>
                `;
            }
            if (mlInfo?.precio_maximo) {
                itemsHtml += `
                    <li>
                        <button type="button" class="dropdown-item d-flex align-items-center justify-content-between py-1.5 px-2 rounded btn-ml-price" data-price="${mlInfo.precio_maximo}" style="font-size: 11px;">
                            <span class="d-flex align-items-center gap-1.5 text-secondary">
                                <span class="badge" style="background: #fff7ed; color: #9a3412; font-size: 9.5px; font-weight: 600;">Máx</span>
                                Máximo:
                            </span>
                            <strong class="text-dark font-monospace" style="font-size: 11.5px;">$${formatCOP(mlInfo.precio_maximo)}</strong>
                        </button>
                    </li>
                `;
            }

            mlContainer.innerHTML = `
                <div class="dropdown">
                    <div class="btn-group btn-group-xs" style="border-radius: 5px;">
                        <button type="button" class="btn btn-xs py-0 px-1 border btn-ml-quick-price text-start d-flex align-items-center gap-1"
                                data-price="${primaryPrice}"
                                title="Clic para aplicar último precio ($${formatCOP(primaryPrice)})"
                                style="font-size: 10px; font-weight: 600; background: #f8fafc; border-color: #cbd5e1; color: #334155; border-radius: 4px 0 0 4px; height: 19px; line-height: 1;">
                            <i class="bi bi-tag text-primary" style="font-size: 8.5px;"></i>
                            <span>$${formatCOP(primaryPrice)}</span>
                        </button>
                        <button type="button" class="btn btn-xs py-0 px-1 border dropdown-toggle dropdown-toggle-split" 
                                data-bs-toggle="dropdown" data-bs-auto-close="true" aria-expanded="false" 
                                title="Ver precios de referencia Mercado Libre"
                                style="font-size: 8.5px; background: #f8fafc; border-color: #cbd5e1; border-left: none; color: #64748b; border-radius: 0 4px 4px 0; height: 19px; line-height: 1;">
                            <span class="visually-hidden">Precios</span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end shadow-sm p-1 rounded-3" style="min-width: 220px; z-index: 1060; border: 1px solid var(--border-color) !important;">
                            <li class="dropdown-header px-2 py-1 text-muted d-flex justify-content-between align-items-center" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                <span><i class="bi bi-shop text-primary me-1"></i>Mercado Libre</span>
                                ${mlInfo?.veces_vendido ? `<span class="badge bg-light text-muted border py-0 px-1" style="font-weight: 500;">${mlInfo.veces_vendido} ${mlInfo.veces_vendido === 1 ? 'venta' : 'ventas'}</span>` : ''}
                            </li>
                            <li><hr class="dropdown-divider my-1"></li>
                            ${itemsHtml}
                        </ul>
                    </div>
                </div>
            `;

            inpPrice.parentNode.appendChild(mlContainer);

            const applyPrice = (priceVal) => {
                const selectedPrice = parseFloat(priceVal);
                if (!isNaN(selectedPrice) && inpPrice) {
                    inpPrice.value = formatInput(selectedPrice);
                    inpPrice.dispatchEvent(new Event('input', { bubbles: true }));
                    if (typeof calcEngine === 'function') calcEngine();
                }
            };

            mlContainer.querySelector('.btn-ml-quick-price')?.addEventListener('click', (e) => {
                e.preventDefault();
                applyPrice(e.currentTarget.dataset.price);
            });

            const toggleBtn = mlContainer.querySelector('.dropdown-toggle');
            mlContainer.querySelectorAll('.btn-ml-price').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    applyPrice(btn.dataset.price);
                    if (toggleBtn && window.bootstrap?.Dropdown) {
                        const inst = window.bootstrap.Dropdown.getInstance(toggleBtn);
                        if (inst) inst.hide();
                    }
                });
            });
        } catch (err) {
            console.warn("No se pudo cargar precios de Mercado Libre:", err);
        }
    },

    actualizarPreciosMercadoLibreEnTabla(tbody, calcEngine) {
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(tr => {
            const pId = tr.querySelector('.input-prod-id')?.value;
            if (pId) {
                this.cargarPreciosMercadoLibre(tr, parseInt(pId, 10), calcEngine);
            } else {
                const existing = tr.querySelector('.ml-price-container');
                if (existing) existing.remove();
            }
        });
    },

    formatMoney(val) {
        return '$' + val.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    reindexRows(tbody) {
        let count = 0;
        tbody.querySelectorAll('tr').forEach(tr => {
            count++;
            const cell = tr.querySelector('.num-linea');
            if (cell) cell.textContent = count;
        });
        return count;
    },

    calcEngine(options) {
        const {
            tbody,
            element,
            factura
        } = options;

        const fmt_money = this.formatMoney.bind(this);
        let sumSubtotal = 0;
        let sumDescuento = 0;
        let sumImpuestos = 0;
        const formRows = Array.from(tbody.querySelectorAll('tr'));
        
        import('./formatters.js').then(fmt => {
            const round2 = (val) => Math.round((Number(val) + Number.EPSILON) * 100) / 100;

            formRows.forEach(tr => {
                const qty = parseFloat(tr.querySelector('.input-qty').value || 0);
                const price = fmt.parseCurrencyValue(tr.querySelector('.input-price').value);
                const discPct = parseFloat(tr.querySelector('.input-disc').value || 0);
                const taxPct = parseFloat(tr.querySelector('.input-tax').value || 0);

                const baseLine = round2(qty * price);
                const discAmount = round2(baseLine * (discPct / 100));
                const subLine = round2(baseLine - discAmount);
                const taxAmount = round2(subLine * (taxPct / 100));

                const subtotalEl = tr.querySelector('.calc-subtotal');
                if (subtotalEl) subtotalEl.textContent = fmt_money(subLine);

                sumSubtotal = round2(sumSubtotal + baseLine);
                sumDescuento = round2(sumDescuento + discAmount);
                sumImpuestos = round2(sumImpuestos + taxAmount);
            });

            const totalFinal = round2(sumSubtotal - sumDescuento + sumImpuestos);
            
            if (element) {
                const elSubtotal = element.querySelector('#tot-subtotal');
                const elDescuento = element.querySelector('#tot-descuento');
                const elImpuestos = element.querySelector('#tot-impuestos');
                const elTotal = element.querySelector('#tot-total');

                if (elSubtotal) elSubtotal.textContent = fmt_money(sumSubtotal);
                if (elDescuento) elDescuento.textContent = fmt_money(sumDescuento);
                if (elImpuestos) elImpuestos.textContent = fmt_money(sumImpuestos);
                if (elTotal) {
                    elTotal.textContent = fmt_money(totalFinal);
                    elTotal.dataset.rawTotal = totalFinal.toString();
                }
            }
            
            if (factura) {
                factura.total = totalFinal; // Mantener en estado global para guardado rápido
            }
        });
    }
};
