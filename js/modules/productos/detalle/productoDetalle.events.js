/**
 * Módulo de Eventos e Interacciones para Detalle de Producto
 * Manejo de filtros de lotes, registro de nuevas capas FIFO, modal de Kardex y navegación.
 */

import { applyCurrencyFormatting, parseCurrencyValue } from '../../../shared/formatters.js';

export const ProductoDetalleEvents = {
    /**
     * Vincula todos los eventos del detalle de producto.
     * @param {HTMLElement} element - Contenedor raíz del módulo.
     * @param {Object} module - Instancia del módulo ProductoDetalleModule.
     */
    bindEvents(element, module) {
        if (!element || !module) return;

        // 1. Formateo de moneda en tiempo real para el costo del nuevo lote
        const costoInput = element.querySelector('#lote-costo');
        if (costoInput) {
            applyCurrencyFormatting(costoInput);
        }

        // 2. Botón Volver al Listado
        const btnVolver = element.querySelector('#btn-volver-prod');
        if (btnVolver) {
            btnVolver.onclick = (e) => {
                e.preventDefault();
                module.volver();
            };
        }

        // 3. Botón y Modal de Kardex
        const btnKardex = element.querySelector('#btn-kardex-prod');
        if (btnKardex) {
            btnKardex.onclick = async (e) => {
                e.preventDefault();
                const modalEl = element.querySelector('#modalKardexProducto');
                if (!modalEl) return;

                if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                    modal.show();
                }

                const tbody = modalEl.querySelector('#tbody-kardex-modal');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Cargando movimientos de Kardex...</td></tr>';
                }

                try {
                    const prodId = module.state.producto?.id;
                    if (!prodId) {
                        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-muted">ID de producto no disponible.</td></tr>';
                        return;
                    }
                    const movimientos = await module.cargarKardex(prodId);
                    if (tbody) {
                        tbody.innerHTML = module.templates.renderTimelineKardex(movimientos);
                    }
                } catch (err) {
                    console.error('Error al cargar kardex:', err);
                    if (tbody) {
                        tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-danger">Error al cargar movimientos de Kardex.</td></tr>';
                    }
                }
            };
        }

        // 4. Filtro de Lotes ('todos' | 'activos' | 'agotados')
        const filtroGroup = element.querySelector('#filtro-lotes-group');
        if (filtroGroup) {
            const buttons = filtroGroup.querySelectorAll('button[data-filtro]');
            buttons.forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const nuevoFiltro = btn.dataset.filtro;
                    if (nuevoFiltro && nuevoFiltro !== module.state.filtroLotes) {
                        module.state.filtroLotes = nuevoFiltro;

                        // Actualizar clases de botones
                        buttons.forEach(b => {
                            b.classList.remove('btn-primary');
                            b.classList.add('btn-outline-secondary');
                        });
                        btn.classList.remove('btn-outline-secondary');
                        btn.classList.add('btn-primary');

                        // Actualizar tabla de lotes
                        const tbodyLotes = element.querySelector('#tbody-lotes-fifo');
                        if (tbodyLotes) {
                            const lotesFiltrados = module.data.filtrarLotes(module.state.lotes, nuevoFiltro);
                            tbodyLotes.innerHTML = module.templates.renderTablaLotes(lotesFiltrados, nuevoFiltro);
                        }
                    }
                };
            });
        }

        // 5. Submit del Formulario de Nuevo Lote
        const formLote = element.querySelector('#form-nuevo-lote');
        if (formLote) {
            formLote.onsubmit = async (e) => {
                e.preventDefault();
                const alertEl = element.querySelector('#lote-alert');
                const submitBtn = formLote.querySelector('button[type="submit"]');

                const cantInput = element.querySelector('#lote-cantidad');
                const costoIn = element.querySelector('#lote-costo');
                const fechaInput = element.querySelector('#lote-fecha');
                const refInput = element.querySelector('#lote-ref');

                const qty = parseFloat(cantInput?.value);
                const costo = parseCurrencyValue(costoIn?.value);
                const fecha = fechaInput?.value?.trim() || new Date().toISOString().split('T')[0];
                const ref = (refInput?.value?.trim() || '').slice(0, 255);

                if (!Number.isFinite(qty) || qty <= 0) {
                    if (alertEl) {
                        alertEl.className = 'alert alert-warning mb-3 py-2';
                        alertEl.textContent = 'La cantidad ingresada debe ser un número mayor a 0.';
                        alertEl.classList.remove('d-none');
                    }
                    return;
                }

                if (!Number.isFinite(costo) || costo < 0) {
                    if (alertEl) {
                        alertEl.className = 'alert alert-warning mb-3 py-2';
                        alertEl.textContent = 'El costo unitario ingresado debe ser mayor o igual a 0.';
                        alertEl.classList.remove('d-none');
                    }
                    return;
                }

                if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
                    if (alertEl) {
                        alertEl.className = 'alert alert-warning mb-3 py-2';
                        alertEl.textContent = 'La fecha de ingreso debe tener un formato válido (AAAA-MM-DD).';
                        alertEl.classList.remove('d-none');
                    }
                    return;
                }

                if (submitBtn) submitBtn.disabled = true;

                const producto = module.state.producto || {};
                const nuevoLote = {
                    id: 'lote_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                    producto_id: producto.id,
                    productoId: producto.id,
                    cantidad_inicial: qty,
                    cantidadInicial: qty,
                    cantidad_actual: qty,
                    cantidadActual: qty,
                    costo_unitario: costo,
                    costoUnitario: costo,
                    fecha_ingreso: fecha,
                    fechaIngreso: fecha,
                    referencia: ref,
                    origen_movimiento: 'ingreso_manual:' + (producto.sku || producto.id)
                };

                try {
                    await module.guardarLote(nuevoLote);

                    if (alertEl) {
                        alertEl.className = 'alert alert-success mb-3 py-2';
                        alertEl.textContent = 'Lote incorporado con éxito a las capas FIFO.';
                        alertEl.classList.remove('d-none');
                        if (this._alertTimeout) clearTimeout(this._alertTimeout);
                        this._alertTimeout = setTimeout(() => alertEl?.classList.add('d-none'), 3500);
                    }

                    if (cantInput) cantInput.value = '';
                    if (refInput) refInput.value = '';

                    // Cerrar modal de nuevo lote si está abierto
                    const modalLoteEl = element.querySelector('#modalNuevoLoteFIFO');
                    if (modalLoteEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                        const modalInst = bootstrap.Modal.getInstance(modalLoteEl);
                        if (modalInst) {
                            try { modalInst.hide(); } catch (e) {}
                        }
                    }

                    // Recargar datos del producto y refrescar vista
                    await module.recargarDatos();
                } catch (err) {
                    console.error('Error al guardar lote FIFO:', err);
                    if (alertEl) {
                        alertEl.className = 'alert alert-danger mb-3 py-2';
                        alertEl.textContent = 'Error al guardar el lote: ' + (err.message || 'Error desconocido');
                        alertEl.classList.remove('d-none');
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            };
        }

        // 6. Navegación en Filas de Facturas / Compras asociadas
        const rowsFacturas = element.querySelectorAll('.row-factura-asociada');
        rowsFacturas.forEach(row => {
            row.onclick = (e) => {
                e.preventDefault();
                const id = row.dataset.id;
                const tipo = row.dataset.tipo;
                if (!id) return;

                if (typeof window !== 'undefined') {
                    if (typeof sessionStorage !== 'undefined') {
                        try {
                            sessionStorage.setItem('origenVolver', JSON.stringify({
                                hash: window.location.hash || '#/inventario/items',
                                label: 'Volver al producto'
                            }));
                        } catch (storageErr) {
                            // Fallback seguro si sessionStorage está bloqueado o lleno
                        }
                    }
                    const safeId = encodeURIComponent(String(id || ''));
                    if (tipo === 'compra') {
                        window.location.hash = `#/gastos/proveedores/ver/${safeId}`;
                    } else {
                        window.location.hash = `#/ingresos/facturas/ver/${safeId}`;
                    }
                }
            };
        });

        // 7. Buscador en vivo de ventas
        const searchVentasInput = element.querySelector('#search-ventas-prod');
        if (searchVentasInput) {
            searchVentasInput.oninput = () => {
                const query = (searchVentasInput.value || '').trim().toLowerCase();
                const filasVentas = element.querySelectorAll('#tbody-ventas-prod .row-factura-asociada');
                filasVentas.forEach(row => {
                    const text = (row.textContent || '').toLowerCase();
                    row.style.display = !query || text.includes(query) ? '' : 'none';
                });
            };
        }

        // 8. Copiar SKU al portapapeles
        const btnCopySku = element.querySelector('#btn-copy-sku');
        if (btnCopySku) {
            btnCopySku.onclick = async (e) => {
                e.preventDefault();
                const skuText = module.state.producto?.sku || '';
                if (!skuText) return;
                try {
                    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(skuText);
                        btnCopySku.className = 'bi bi-check2 text-success ms-1';
                        setTimeout(() => {
                            btnCopySku.className = 'bi bi-copy ms-1 text-muted cursor-pointer';
                        }, 2000);
                    }
                } catch (err) {
                    console.warn('No se pudo copiar SKU:', err);
                }
            };
        }
    },

    /**
     * Limpieza de instancias de modal y elementos flotantes en el DOM.
     * @param {HTMLElement} element 
     */
    cleanup(element) {
        if (this._alertTimeout) {
            clearTimeout(this._alertTimeout);
            this._alertTimeout = null;
        }
        if (!element) return;
        ['#modalKardexProducto', '#modalNuevoLoteFIFO', '#modalTodosClientes'].forEach(sel => {
            const modalEl = element.querySelector(sel);
            if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const instance = bootstrap.Modal.getInstance(modalEl);
                if (instance) {
                    try {
                        instance.hide();
                        instance.dispose();
                    } catch (e) {
                        // ignorar errores al disponer modal ya destruido
                    }
                }
            }
        });
        if (typeof document !== 'undefined') {
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body?.classList.remove('modal-open');
            if (document.body) {
                document.body.style.overflow = '';
            }
        }
    }
};
