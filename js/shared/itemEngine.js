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
                    if (inpPrice) inpPrice.value = Number(precioReal || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
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
    }
};
