// js/modules/configuracion.js
// Migrado a Supabase — ya no usa Firebase/Firestore
import { supabase } from '../core/supabase.js';

export const ConfiguracionModule = {
    async init(element) {
        if (!element) return;
        this.element = element;

        element.innerHTML = `
            <div class="dash-layout p-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="h3 fw-bold mb-1" style="color: var(--text-main);">Configuración</h2>
                        <p class="text-muted mb-0" style="font-size: 14px;">Administra los parámetros generales del sistema.</p>
                    </div>
                </div>
                
                <div class="dash-table-container mb-4">
                    <div class="card-header bg-white border-bottom py-3">
                        <h5 class="mb-0 fw-bold" style="color: #2cbfb7;">Numeración de documentos</h5>
                    </div>
                    <div class="card-body p-4 text-center" id="config-loader">
                        <div class="spinner-border text-primary" role="status"></div>
                        <p class="mt-2 text-muted">Cargando contadores...</p>
                    </div>
                    <div class="card-body p-4 d-none" id="config-content">
                        <div class="alert alert-warning d-flex align-items-center mb-4" role="alert">
                            <i class="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
                            <div>
                                <strong>Advertencia:</strong> Cambiar este número afecta la numeración de la <strong>PRÓXIMA</strong> factura o cotización que se cree. Úsalo con cuidado, especialmente si hay otro usuario trabajando al mismo tiempo.
                            </div>
                        </div>

                        <div class="row g-4">
                            <!-- Facturas -->
                            <div class="col-md-6">
                                <div class="p-3 border rounded">
                                    <label class="form-label fw-medium text-dark mb-2">Próximo número de factura</label>
                                    <div class="input-group">
                                        <span class="input-group-text bg-light">F-</span>
                                        <input type="number" id="next-factura-input" class="form-control" min="1" step="1">
                                        <button class="btn btn-primary-action px-4" id="btn-save-factura">
                                            Guardar
                                        </button>
                                    </div>
                                    <div class="form-text mt-2">Este será el número asignado a la próxima factura de venta.</div>
                                </div>
                            </div>
                            
                            <!-- Cotizaciones -->
                            <div class="col-md-6">
                                <div class="p-3 border rounded">
                                    <label class="form-label fw-medium text-dark mb-2">Próximo número de cotización</label>
                                    <div class="input-group">
                                        <span class="input-group-text bg-light">C-</span>
                                        <input type="number" id="next-cotizacion-input" class="form-control" min="1" step="1">
                                        <button class="btn btn-primary-action px-4" id="btn-save-cotizacion">
                                            Guardar
                                        </button>
                                    </div>
                                    <div class="form-text mt-2">Este será el número asignado a la próxima cotización.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.loader = element.querySelector('#config-loader');
        this.content = element.querySelector('#config-content');
        this.inputFactura = element.querySelector('#next-factura-input');
        this.inputCotizacion = element.querySelector('#next-cotizacion-input');
        
        this.btnSaveFactura = element.querySelector('#btn-save-factura');
        this.btnSaveCotizacion = element.querySelector('#btn-save-cotizacion');

        this.bindEvents();
        await this.loadData();
    },

    bindEvents() {
        this.btnSaveFactura.addEventListener('click', () => this.saveCounter('facturas', this.inputFactura.value));
        this.btnSaveCotizacion.addEventListener('click', () => this.saveCounter('cotizaciones', this.inputCotizacion.value));
    },

    async loadData() {
        try {
            // Leer el MAX(numero) actual de cada tabla en Supabase para mostrar el próximo número
            const [resFacturas, resCotizaciones] = await Promise.all([
                supabase.from('facturas').select('numero').eq('tipo', 'venta').order('numero', { ascending: false }).limit(1).single(),
                supabase.from('cotizaciones').select('numero').order('numero', { ascending: false }).limit(1).single()
            ]);

            const maxFactura = resFacturas.data?.numero ?? 0;
            const maxCotizacion = resCotizaciones.data?.numero ?? 0;

            // Mostrar el PRÓXIMO número (max actual + 1)
            this.inputFactura.value = maxFactura + 1;
            this.inputCotizacion.value = maxCotizacion + 1;

            // Mostrar el formulario
            this.loader.classList.add('d-none');
            this.content.classList.remove('d-none');
        } catch (error) {
            console.error('[Config] Error al cargar contadores desde Supabase:', error);
            this.showToast('Error al cargar la configuración', 'danger');
        }
    },

    async saveCounter(tabla, valStr) {
        const nuevoSiguiente = parseInt(valStr, 10);
        if (isNaN(nuevoSiguiente) || nuevoSiguiente < 1) {
            this.showToast('Por favor ingrese un número válido mayor a 0', 'warning');
            return;
        }

        const btn = tabla === 'facturas' ? this.btnSaveFactura : this.btnSaveCotizacion;
        const originalText = btn.innerHTML;
        
        try {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            btn.disabled = true;

            // En Supabase no existe colección "contadores" — el próximo número se
            // controla insertando un registro fantasma con numero = (nuevoSiguiente - 1),
            // de forma que el RPC hará MAX + 1 = nuevoSiguiente en el próximo guardado.
            // La forma más limpia: actualizar la sequence de Postgres vía RPC.
            const { error } = await supabase.rpc('set_next_numero', {
                p_table: tabla,
                p_next: nuevoSiguiente
            });

            if (error) throw error;

            this.showToast(`Numeración de ${tabla} actualizada. Próximo número: ${nuevoSiguiente}`, 'success');
        } catch (error) {
            console.error(`[Config] Error al guardar contador de ${tabla}:`, error);
            this.showToast(`Error al guardar: ${error.message}`, 'danger');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    showToast(message, type = 'success') {
        const toastId = 'toast-' + Date.now();
        const icon = type === 'success' ? 'check-circle' : (type === 'danger' ? 'x-circle' : 'exclamation-circle');
        
        const html = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body d-flex align-items-center">
                        <i class="bi bi-${icon} fs-5 me-2"></i>
                        <span>${message}</span>
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '1090';
            document.body.appendChild(toastContainer);
        }

        toastContainer.insertAdjacentHTML('beforeend', html);
        const toastEl = document.getElementById(toastId);
        // eslint-disable-next-line no-undef
        const bsToast = new bootstrap.Toast(toastEl, { delay: 3000 });
        bsToast.show();
        
        toastEl.addEventListener('hidden.bs.toast', () => {
            toastEl.remove();
        });
    }
};

