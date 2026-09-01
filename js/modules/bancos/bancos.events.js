import { supabase } from '../../core/supabase.js';
import { getLocalDate } from '../../core/db.js';

export const TesoreriaEvents = {
    bindEvents() {
        const el = this.element;

        el.querySelector('#btn-actualizar-bancos')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Actualizando...';
            btn.disabled = true;
            
            // Forzar repintado visual y dar feedback
            await new Promise(r => {
                if (window._bancosRefreshTimeout) clearTimeout(window._bancosRefreshTimeout);
                window._bancosRefreshTimeout = setTimeout(r, 400);
            });
            await this.loadData();
            
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        });

        el.querySelector('#btn-agregar-banco')?.addEventListener('click', () => {
            // Limpiar el form antes de abrir
            const form = document.getElementById('form-agregar-banco');
            if (form) form.reset();

            const modalEl = document.getElementById('modal-agregar-banco');
            if (modalEl) {
                if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                } else {
                    modalEl.classList.add('show', 'd-block');
                    modalEl.style.backgroundColor = 'rgba(0,0,0,0.5)';
                }
                import('../../shared/formatters.js').then(fmt => {
                    fmt.applyCurrencyFormatting(document.getElementById('banco-saldo-inicial'));
                });
            }
        });

        el.querySelector('#btn-transferir')?.addEventListener('click', () => {
            // 1. Obtener las referencias a los selects
            const origenSelect = document.getElementById('transf-origen');
            const destinoSelect = document.getElementById('transf-destino');
            
            // 2. Construir el HTML de los options
            const cuentasOptions = (this.state.cuentasActivas || [])
                .map(c => `<option value="${c.id}">${c.nombre}</option>`)
                .join('');
            
            // 3. Inyectar dinámicamente preservando los placeholders originales
            if (origenSelect) {
                origenSelect.innerHTML = '<option value="" disabled selected>Selecciona el origen</option>' + cuentasOptions;
            }
            if (destinoSelect) {
                destinoSelect.innerHTML = '<option value="" disabled selected>Selecciona el destino</option>' + cuentasOptions;
            }

            // 4. Abrir el modal normalmente
            const modalEl = document.getElementById('modal-transferir');
            if (modalEl) {
                if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                } else {
                    modalEl.classList.add('show', 'd-block');
                    modalEl.style.backgroundColor = 'rgba(0,0,0,0.5)';
                }
                import('../../shared/formatters.js').then(fmt => {
                    fmt.applyCurrencyFormatting(document.getElementById('transf-monto'));
                });
            }
        });

        // Close manual fallback
        el.querySelector('#modal-transferir .btn-close')?.addEventListener('click', () => {
            const modalEl = document.getElementById('modal-transferir');
            if (modalEl) {
                modalEl.classList.remove('show', 'd-block');
                modalEl.style.backgroundColor = '';
            }
        });
        el.querySelector('#modal-transferir [data-bs-dismiss="modal"]')?.addEventListener('click', () => {
            const modalEl = document.getElementById('modal-transferir');
            if (modalEl) {
                modalEl.classList.remove('show', 'd-block');
                modalEl.style.backgroundColor = '';
            }
        });

        el.querySelector('#search-bancos')?.addEventListener('input', (e) => {
            this.renderTabla(e.target.value.toLowerCase().trim());
        });

        el.querySelector('#tbody-bancos')?.addEventListener('click', (e) => {
            const editarBtn = e.target.closest('.btn-editar-cuenta');
            if (editarBtn) {
                this.abrirModalEditarCuenta(editarBtn.dataset);
                return;
            }

            const toggleBtn = e.target.closest('.btn-toggle-estado');
            if (toggleBtn) {
                const id = toggleBtn.getAttribute('data-id');
                const estadoActual = toggleBtn.getAttribute('data-estado');
                this.toggleEstadoCuenta(id, estadoActual);
                return;
            }

            const conciliarBtn = e.target.closest('.btn-conciliar');
            if (conciliarBtn) {
                return;
            }

            const menuBtn = e.target.closest('.btn-abrir-menu-cuenta') || e.target.closest('.dropdown-menu');
            if (menuBtn) {
                return;
            }

            const row = e.target.closest('.banco-row');
            if (row) {
                const id = row.getAttribute('data-id');
                window.location.hash = `#/bancos/detalle?banco_id=${encodeURIComponent(id)}`;
            }
        });

        el.querySelector('#select-chart-rango')?.addEventListener('change', (e) => {
            const meses = parseInt(e.target.value, 10);
            this.renderChart(meses);
        });

        el.querySelector('#form-transferir')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-confirmar-transf');
            if (btn) btn.disabled = true;

            const origenId = document.getElementById('transf-origen').value;
            const destinoId = document.getElementById('transf-destino').value;
            let monto = 0;
            try {
                const fmt = await import('../../shared/formatters.js');
                monto = fmt.parseCurrencyValue(document.getElementById('transf-monto').value);
            } catch(e) {
                monto = parseFloat(document.getElementById('transf-monto').value.replace(/\./g, '').replace(/,/g, '.'));
            }
            const fecha = document.getElementById('transf-fecha').value;
            const nota = document.getElementById('transf-nota').value.trim();

            const success = await this.ejecutarTransferencia(origenId, destinoId, monto, fecha, nota);
            
            if (success) {
                // Cerrar modal
                const modalEl = document.getElementById('modal-transferir');
                if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const modalInstance = bootstrap.Modal.getInstance(modalEl);
                    if (modalInstance) modalInstance.hide();
                } else {
                    modalEl.classList.remove('show', 'd-block');
                }
                
                // Limpiar form
                document.getElementById('form-transferir').reset();
                document.getElementById('transf-fecha').value = getLocalDate();

                // Recargar datos
                await this.loadData();
            }

            if (btn) btn.disabled = false;
        });

        el.querySelector('#form-agregar-banco')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-confirmar-agregar-banco');
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...'; }

            const nombre = document.getElementById('banco-nombre').value.trim();
            const tipo = document.getElementById('banco-tipo').value.trim();
            const numero_cuenta = document.getElementById('banco-numero-cuenta').value.trim() || null;

            let saldo_inicial = 0;
            try {
                const fmt = await import('../../shared/formatters.js');
                saldo_inicial = fmt.parseCurrencyValue(document.getElementById('banco-saldo-inicial').value);
            } catch (_) {
                saldo_inicial = parseFloat(
                    document.getElementById('banco-saldo-inicial').value.replace(/\./g, '').replace(/,/g, '.')
                ) || 0;
            }

            const { error } = await supabase.from('cuentas_bancarias').insert({
                nombre,
                tipo,
                numero_cuenta,
                saldo_inicial,
                estado: 'active'
            });

            if (error) {
                console.error('Error al crear cuenta:', error);
                if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar'; }
                alert('Error al guardar la cuenta: ' + error.message);
                return;
            }

            // Cerrar modal
            const modalEl = document.getElementById('modal-agregar-banco');
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            } else if (modalEl) {
                modalEl.classList.remove('show', 'd-block');
                modalEl.style.backgroundColor = '';
            }

            // Recargar lista
            await this.loadData();

            if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar'; }
        });

        el.querySelector('#form-editar-banco')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-confirmar-editar-banco');
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...'; }

            const id = document.getElementById('banco-edit-id').value;
            const nombre = document.getElementById('banco-edit-nombre').value.trim();
            const tipo = document.getElementById('banco-edit-tipo').value.trim();
            const numero_cuenta = document.getElementById('banco-edit-numero-cuenta').value.trim() || null;

            const { error } = await supabase.from('cuentas_bancarias').update({
                nombre,
                tipo,
                numero_cuenta
            }).eq('id', id);

            if (error) {
                console.error('Error al editar cuenta:', error);
                if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar cambios'; }
                alert('Error al guardar los cambios: ' + error.message);
                return;
            }

            const modalEl = document.getElementById('modal-editar-banco');
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            } else if (modalEl) {
                modalEl.classList.remove('show', 'd-block');
                modalEl.style.backgroundColor = '';
            }

            await this.loadData();

            if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar cambios'; }
        });
    },

    abrirModalEditarCuenta(dataset) {
        document.getElementById('banco-edit-id').value = dataset.id || '';
        document.getElementById('banco-edit-nombre').value = dataset.nombre || '';
        document.getElementById('banco-edit-tipo').value = dataset.tipo || '';
        document.getElementById('banco-edit-numero-cuenta').value = dataset.numero || '';

        const modalEl = document.getElementById('modal-editar-banco');
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modalInstance = new bootstrap.Modal(modalEl);
            modalInstance.show();
        } else if (modalEl) {
            modalEl.classList.add('show', 'd-block');
            modalEl.style.backgroundColor = 'rgba(0,0,0,0.5)';
        }
    }
};
