/**
 * MOTOR COMPARTIDO DE LÍNEAS DE INVENTARIO (COTIZACIONES Y FACTURAS)
 * Centraliza la inyección de precios, stock y autocompletado.
 */
export const ItemEngine = {
    renderProductSearchBox(detalle, productos, isViewOnly = false) {
        // Encontrar producto inicial si existe
        const prod = productos.find(p => String(p.id) === String(detalle.productoId));
        const initialText = prod ? `[${prod.sku || 'S/N'}] - ${prod.nombre}` : '';
        
        return `
            <div class="position-relative">
                <input type="hidden" class="input-prod-id" value="${detalle.productoId || ''}">
                <input type="text" class="form-control form-control-sm text-muted border-0 bg-light input-prod-search mb-1" 
                       placeholder="Escriba código o nombre..." autocomplete="off" value="${initialText}" ${isViewOnly ? 'disabled' : ''}>
                <input type="text" class="form-control form-control-sm border-0 bg-light mt-1 input-prod-desc" 
                       placeholder="" value="${detalle.descripcion_personalizada || ''}" ${isViewOnly ? 'disabled' : ''}>
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
                fetchItems: (query) => UI.fetchProductosCombobox(query),
                displayProp: 'nombre',
                renderItem: (p) => {
                    return `<strong style="color: var(--text-main);">[${p.sku || p.reference || 'S/N'}]</strong> - ${p.nombre || p.name}`;
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
                    
                    inputSearch.value = `[${p.sku || p.reference || 'S/N'}] - ${p.nombre || p.name}`;
                    inputSearch.dataset.lastSku = p.sku || p.reference;
                    
                    // Inyección estricta de Precios e Impuestos
                    if (inpPrice) inpPrice.value = Number(precioReal || 0).toString().replace('.', ',');
                    if (inpTax) inpTax.value = p.impuesto || p.tax || 0;
                    if (inpQty && parseFloat(inpQty.value || 0) === 0) inpQty.value = 1;

                    // Renderizado de Información Secundaria Inferior
                    if (metaProd) metaProd.innerHTML = `
                        <span style="color: var(--text-muted); font-size: 11px; display: inline-block; margin-top: 4px;">
                            ${p.sku || p.reference || 'S/N'}
                        </span>
                    `;
                    const stockVal = p.stockActual || p.inventory || p.cantidad || 0;
                    if (metaQty) {
                        metaQty.innerHTML = `<span style="color: var(--text-muted); font-size: 11px; display: inline-block; margin-top: 4px;">Disp: ${stockVal}</span>`;
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
                        const container = tr.closest('.dash-layout') || tr.closest('form') || document;
                        const clienteInput = container.querySelector('#select-cliente');
                        if (clienteInput && String(clienteInput.value) === "698") {
                            try {
                                const { supabase } = await import('../core/supabase.js');
                                const { data, error } = await supabase.rpc('get_precio_promedio_ml', { p_producto_id: p.id });
                                
                                if (!error && data) {
                                    const mlInfo = Array.isArray(data) ? data[0] : data;
                                    if (mlInfo && mlInfo.veces_vendido > 0) {
                                        if (inpPrice) {
                                            const datalistId = `ml-datalist-${p.id}-${Date.now()}`;
                                            const datalist = document.createElement('datalist');
                                            datalist.id = datalistId;
                                            datalist.className = 'price-ml-datalist';
                                            
                                            datalist.innerHTML = `
                                                <option value="${mlInfo.precio_promedio}">Promedio</option>
                                                <option value="${mlInfo.precio_minimo}">Mínimo</option>
                                                <option value="${mlInfo.precio_maximo}">Máximo</option>
                                            `;
                                            
                                            inpPrice.parentNode.appendChild(datalist);
                                            inpPrice.setAttribute('list', datalistId);
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error("Error cargando precio ML:", err);
                            }
                        }
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
                <input type="number" min="0" class="form-control form-control-sm border-0 bg-light input-qty mb-1" value="${detalle.cantidad}" ${isViewOnly ? 'disabled' : ''}>
                <div class="meta-qty ps-1"></div>
            </td>
            <td class="align-top"><input type="text" class="form-control form-control-sm border-0 bg-light input-price" value="${detalle.precio}" placeholder="$" ${isViewOnly ? 'disabled' : ''}></td>
            <td class="align-top"><input type="number" step="any" min="0" max="100" class="form-control form-control-sm border-0 bg-light input-disc" value="${detalle.descuento}" placeholder="0 %" ${isViewOnly ? 'disabled' : ''}></td>
            <td class="align-top"><input type="number" step="any" min="0" max="100" class="form-control form-control-sm border-0 bg-light input-tax" value="${detalle.impuesto}" placeholder="%" ${isViewOnly ? 'disabled' : ''}></td>
            <td class="text-end align-top pt-3">
                <span class="calc-subtotal fw-bold d-block" style="color: var(--text-main);">$0,00</span>
                <a href="#" class="toggle-desc-tax d-md-none text-decoration-none mt-2 d-inline-block" style="font-size: var(--fs-xs); color: var(--primary);">+ Editar descuento/impuesto</a>
            </td>
            <td class="text-center align-top pt-2">
                ${!isViewOnly ? `<button class="btn btn-link text-muted p-0 btn-eliminar-linea">
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
            const prod = productosFactura.find(p => p.id === detalle.productoId);
            if (prod) {
                if (metaProd) metaProd.innerHTML = `<span style="color: var(--text-muted); font-size: var(--fs-xs);">${prod.sku || 'S/N'}</span>`;
                if (metaQty) metaQty.innerHTML = `<span style="color: var(--text-muted); font-size: var(--fs-xs);">Disp: ${prod.stockActual || prod.cantidad || 0}</span>`;
            }
        }
        
        return tr;
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
            formRows.forEach(tr => {
                const qty = parseFloat(tr.querySelector('.input-qty').value || 0);
                const price = fmt.parseCurrencyValue(tr.querySelector('.input-price').value);
                const discPct = parseFloat(tr.querySelector('.input-disc').value || 0);
                const taxPct = parseFloat(tr.querySelector('.input-tax').value || 0);

                const baseLine = qty * price;
                const discAmount = baseLine * (discPct / 100);
                const subLine = baseLine - discAmount;
                const taxAmount = subLine * (taxPct / 100);

                const subtotalEl = tr.querySelector('.calc-subtotal');
                if (subtotalEl) subtotalEl.textContent = fmt_money(subLine);

                sumSubtotal += baseLine;
                sumDescuento += discAmount;
                sumImpuestos += taxAmount;
            });

            const totalFinal = sumSubtotal - sumDescuento + sumImpuestos;
            
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
