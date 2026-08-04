import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions, ItemEngine, NumberingManager, ExportManager, PrintManager } from '../../shared/crud.js';
import { TesoreriaModule } from '../bancos/bancos.js';
import { ContactosModule } from '../clientes/clientes.js';
import { UI } from '../../shared/combobox.js';
import { calcularEstadoFactura } from '../../shared/carteraUtils.js';
import { AbonoModal } from '../../shared/abonoModal.js';
import { InventarioUtils } from '../../shared/inventarioUtils.js';

export const ComprasModule = {
    cache: { contactos: null, productos: null },
    
    async init(element) {
        if (!element) return;

        // Cargar catálogos base una sola vez por renderizado del módulo
        this.cache.contactos = await DB.getAll('contactos');
        this.cache.productos = await DB.getAll('productos');

        const hashParts = window.location.hash.split('/');
        const action = hashParts[3];
        const id = hashParts[4];

        if (action === 'nueva' || action === 'editar') {
            await this.renderForm(element, id, false);
        } else if (action === 'ver') {
            await this.renderForm(element, id, true);
        } else {
            await this.renderList(element);
        }
    },

    async renderList(element) {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; color: #2cbfb7;">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;
        
        let contactos = this.cache.contactos;
        
        const getProveedorName = (id) => {
            const proveedor = contactos.find(c => c.id == id);
            return cliente ? cliente.nombre : 'Sin Cliente';
        };

        // Estado de Paginación, Ordenamiento y Filtro Server-Side
        let sortColumn = 'numero';
        let sortDirection = 'desc';
        let currentPage = 1;
        let itemsPerPage = 10;
        let searchQuery = '';
        let filterCriteria = 'todos';
        
        let currentItems = [];
        let totalItems = 0;
        let totalPages = 1;

        const formatMoney = (val) => '$ ' + parseFloat(val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        const renderGrid = async () => {
            // Spinner while loading
            if (element.querySelector('tbody')) {
                element.querySelector('tbody').innerHTML = `<tr><td colspan="9" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>`;
            }

            try {
                    const proveedorId = element.querySelector('#select-proveedor').value;
                    if (!proveedorId) {
                        const searchInput = element.querySelector('#search-proveedor');
                        searchInput.style.borderColor = '#ef4444'; 
                        CoreActions.showWarningModal("Debes seleccionar un proveedor válido de la lista.");
                        if (window._ventasSearchClientTimeout) clearTimeout(window._ventasSearchClientTimeout);
                        window._ventasSearchClientTimeout = setTimeout(() => {
                            if (document.body.contains(searchInput)) {
                                searchInput.style.borderColor = '';
                            }
                        }, 3000);
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = originalText;
                        return;
                    }

                    const tipoVenta = element.querySelector('#select-tipo-venta') ? element.querySelector('#select-tipo-venta').value : 'credito';
                    const isNew = !id; 

                    // Recolectar detalles
                    const arrDetalles = Array.from(element.querySelectorAll('#tbody-detalles tr')).map(r => {
                        return {
                            id: r.dataset.uid,
                            productoId: parseInt(r.querySelector('.input-prod-id').value),
                            cantidad: parseFloat(r.querySelector('.input-qty').value) || 0,
                            precio: parseP(r.querySelector('.input-price').value),
                            descuento: parseFloat(r.querySelector('.input-disc').value) || 0,
                            impuesto: parseFloat(r.querySelector('.input-tax').value) || 0
                        };
                    });

                    if (arrDetalles.length === 0 || parseFloat(element.querySelector('#tot-total').dataset.rawTotal) <= 0) {
                        CoreActions.showWarningModal("Debe agregar al menos un producto válido y con cantidad mayor a cero.");
                        btnGuardar.disabled = false;
                        btnGuardar.innerHTML = originalText;
                        return;
                    }

                    factura.contacto_id = proveedorId;
                    if (tipoVenta === 'contado') {
                        factura.cuentaId = element.querySelector('#select-cuenta-venta') ? element.querySelector('#select-cuenta-venta').value : null;
                    }
                    factura.fecha = element.querySelector('#input-fecha').value;
                    factura.vencimiento = element.querySelector('#input-vencimiento').value;
                    factura.detalles = arrDetalles;
                    factura.tipo = 'compra'; // EXPLICIT COMPRA
                    
                    const rawTotal = parseFloat(element.querySelector('#tot-total').dataset.rawTotal);
                    factura.total = rawTotal;

                    let savedFactura;
                    if (!factura.numero) {
                        savedFactura = await DB.saveWithNextNumero('facturas', factura);
                    } else {
                        savedFactura = await DB.save('facturas', factura);
                    }
                    
                    factura.id = savedFactura.id;
                    factura.numero = savedFactura.numero;

                    // INVENTARIO: Generar lotes_fifo para facturas nuevas
                    if (isNew) {
                        try {
                            const lotes = arrDetalles.map(d => ({
                                producto_id: d.productoId,
                                cantidad_inicial: d.cantidad,
                                cantidad_actual: d.cantidad,
                                costo_unitario: d.precio, 
                                fecha_ingreso: factura.fecha,
                                referencia: `Factura Compra ${factura.numero}`
                            }));
                            
                            const { error: lotesError } = await supabase.from('lotes_fifo').insert(lotes);
                            
                            if (lotesError) throw lotesError;
                        } catch (invErr) {
                            console.error("Error crítico al guardar inventario:", invErr);
                            CoreActions.showWarningModal(`La factura ${factura.numero} se guardó, pero hubo un error al actualizar el inventario (lotes_fifo). Por favor contacta a soporte. Detalle: ${invErr.message}`);
                            // Bloqueamos la redirección para que el usuario vea el modal
                            btnGuardar.disabled = false;
                            btnGuardar.innerHTML = originalText;
                            return; 
                        }
                    }

                    // Condicional Contado vs Crédito
                    if (tipoVenta === 'contado') {
                        if (isNew && factura.cuentaId) {
                            const transaccion = {
                                id: 'trx_' + Date.now(),
                                facturaId: factura.id,
                                referenciaId: factura.id,
                                tipo: 'egreso',
                                monto: rawTotal,
                                fecha: factura.fecha,
                                referencia: `Compra al contado Fac. ${factura.numero}`,
                                detalle: `Compra al contado Fac. ${factura.numero}`,
                                cuenta: factura.cuentaId,
                                cuentaId: factura.cuentaId
                            };
                            await DB.save('transacciones', transaccion);
                        }
                    }
                    
                    window.hayCambiosSinGuardar = false;
                    window.location.hash = `#/gastos/compras/ver/${factura.id}`;
                } catch (error) {
                    console.error("Fallo general de guardado:", error);
                    alert("Error en el sistema al guardar: " + error.message);
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = originalText;
                } finally {
                    if (btnCancelar) btnCancelar.disabled = false;
                }
            });
        });

        // Inicializar UI
        factura.detalles.forEach(det => addRow(det));
        calcEngine(); // Primer cálculo

        if (!isViewOnly) {
            window.hayCambiosSinGuardar = false;
            element.addEventListener('input', (e) => { 
                window.hayCambiosSinGuardar = true; 
            });
            element.addEventListener('change', (e) => { 
                window.hayCambiosSinGuardar = true; 
            });
        }
    }

    async crearProductoRapido(query, trElement) {
        const modalId = 'modal-crear-prod-rapido';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const html = `
            <div class="modal fade show" id="${modalId}" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Crear Nuevo Producto</h5>
                            <button type="button" class="btn-close" onclick="document.getElementById('${modalId}').remove()"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label text-muted small">Nombre del Producto</label>
                                <input type="text" id="cp-nombre" class="form-control" value="${query}">
                            </div>
                            <div class="row mb-3">
                                <div class="col-6">
                                    <label class="form-label text-muted small">SKU / Referencia</label>
                                    <input type="text" id="cp-sku" class="form-control">
                                </div>
                                <div class="col-6">
                                    <label class="form-label text-muted small">Precio Venta (Sugerido)</label>
                                    <div class="input-group">
                                        <span class="input-group-text">$</span>
                                        <input type="text" id="cp-precio" class="form-control text-end" value="0">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="cp-guardar">Guardar y Seleccionar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
        
        // Aplicar formato de moneda
        import('../../shared/formatters.js').then(fmt => {
            const inputPrecio = document.getElementById('cp-precio');
            inputPrecio.addEventListener('input', (e) => {
                fmt.applyCurrencyFormatting(e.target);
            });
            inputPrecio.addEventListener('blur', (e) => {
                if (e.target.value === '') e.target.value = '0';
                fmt.applyCurrencyFormatting(e.target);
            });
            
            document.getElementById('cp-guardar').addEventListener('click', async (e) => {
                const btn = e.target;
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
                
                try {
                    const nombre = document.getElementById('cp-nombre').value;
                    const sku = document.getElementById('cp-sku').value;
                    const precio = fmt.parseCurrencyValue(inputPrecio.value);
                    
                    if (!nombre) throw new Error("El nombre es obligatorio");
                
                const { data, error } = await supabase.from('productos').insert([{
                    nombre: nombre,
                    sku: sku,
                    precio_venta: precio,
                    tipo: 'producto',
                    estado: 'activo'
                }]).select().single();
                
                if (error) throw error;
                
                // Actualizar cache local
                this.cache.productos.push(data);
                
                // Cerrar modal
                document.getElementById(modalId).remove();
                
                // Inyectar en la fila
                if (trElement) {
                    const inpSearch = trElement.querySelector('.input-prod-search');
                    const inpId = trElement.querySelector('.input-prod-id');
                    
                    inpSearch.value = `[${data.sku || 'S/N'}] - ${data.nombre}`;
                    inpId.value = data.id;
                    
                    // Disparar evento para que ItemEngine y calcTotales lo tomen
                    inpSearch.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } catch (err) {
                alert("Error al crear producto: " + err.message);
                btn.disabled = false;
                btn.innerHTML = 'Guardar y Seleccionar';
            }
        });
        });
    }
};
