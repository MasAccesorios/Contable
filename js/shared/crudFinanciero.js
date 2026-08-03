import DB, { getLocalDate } from '../core/db.js';
import { UI } from './combobox.js';
import { supabase } from '../core/supabase.js';
import { anularTransaccion } from './transaccionesUtils.js';
import { applyCurrencyFormatting, parseCurrencyValue } from './formatters.js';

export class CrudFinanciero {
    constructor(config) {
        this.config = config;
        // config expected:
        // titulo: string
        // btnNuevoText: string
        // panelHistorialText: string
        // kpiId: string
        // formId: string
        // tbodyId: string
        // categorias: array of strings
        // colorMonto: string (e.g. 'text-danger' or 'text-success')
        // prefijoMonto: string (e.g. '-' or '+')
        // tipoTransaccion: string (e.g. 'egreso' or 'ingreso')
        // tipoFiltroDb: string (e.g. 'out' or 'in')
    }

    async init(element) {
        // Cargar contactos para el selector de proveedor
        const contactos = await DB.getAll('contactos');
        this.proveedores = contactos.filter(c => c.tipo === 'proveedor');

        // Cargar cuentas bancarias
        this.cuentasActivas = await DB.getAll('cuentas_bancarias') || [];

        element.innerHTML = `
            <div class="container-fluid py-4">
                <div class="d-flex justify-content-between flex-wrap pt-3 pb-2 mb-3 border-bottom">
                    <h1 class="h2">${this.config.titulo}</h1>
                </div>

                <!-- Panel Superior: Creación Rápida -->
                <div class="card mb-4 shadow-sm border-0">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                        <h5 class="mb-0 text-primary"><i class="bi bi-receipt me-2"></i>${this.config.btnNuevoText}</h5>
                    </div>
                    <div class="card-body">
                        <form id="${this.config.formId}" class="row g-4 align-items-end">
                            <div class="col-md-2">
                                <label class="form-label text-muted small fw-semibold mb-1">Fecha *</label>
                                <input type="date" class="form-control" id="transaccion-fecha" required>
                            </div>
                            <div class="col-md-2">
                                <label class="form-label text-muted small fw-semibold mb-1">Categoría *</label>
                                <select class="form-select" id="transaccion-categoria" required>
                                    <option value="">Seleccione...</option>
                                    ${this.config.categorias.map(c => `<option value="${c}">${c}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-2">
                                <label class="form-label text-muted small fw-semibold mb-1">Monto ($) *</label>
                                <input type="text" class="form-control" id="transaccion-monto" required>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label text-muted small fw-semibold mb-1">Proveedor (Opcional)</label>
                                <div class="custom-combobox" id="combo-proveedor-container">
                                    <input type="text" class="form-control" id="search-proveedor" placeholder="Buscar proveedor..." autocomplete="off">
                                    <input type="hidden" id="select-proveedor-id">
                                </div>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label text-muted small fw-semibold mb-1">Cuenta Bancaria *</label>
                                <div class="custom-combobox" id="combo-cuenta-container">
                                    <input type="text" class="form-control" id="transaccion-cuenta" placeholder="Buscar cuenta..." required autocomplete="off">
                                    <input type="hidden" id="transaccion-cuenta-id" required>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label text-muted small fw-semibold mb-1">Referencia (Opcional)</label>
                                <input type="text" class="form-control" id="transaccion-referencia" placeholder="Nro Factura / Recibo">
                            </div>
                            <div class="col-md-7">
                                <label class="form-label text-muted small fw-semibold mb-1">Descripción *</label>
                                <input type="text" class="form-control" id="transaccion-descripcion" placeholder="Ej. Pago servicio de internet" required minlength="3">
                            </div>
                            <div class="col-md-2">
                                <button type="submit" class="btn btn-primary w-100" id="btn-guardar-transaccion">
                                    <i class="bi bi-plus-circle me-1"></i>Registrar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Panel Inferior: Gestión y Listado -->
                <div class="card shadow-sm border-0">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-2 d-flex justify-content-between align-items-center">
                        <h5 class="mb-0 text-secondary"><i class="bi bi-list-ul me-2"></i>${this.config.panelHistorialText}</h5>
                        <h4 class="mb-0 ${this.config.colorMonto.replace('text-', 'text-')} fw-bold" id="${this.config.kpiId}">$0</h4>
                    </div>
                    <div class="card-body">
                        <!-- Filtros -->
                        <div class="row g-2 mb-3">
                            <div class="col-md-3">
                                <select class="form-select form-select-sm" id="filtro-categoria">
                                    <option value="todas">Todas las categorías</option>
                                    ${this.config.categorias.map(c => `<option value="${c}">${c}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-2">
                                <input type="date" class="form-control form-control-sm" id="filtro-fecha-desde" placeholder="Desde">
                            </div>
                            <div class="col-md-2">
                                <input type="date" class="form-control form-control-sm" id="filtro-fecha-hasta" placeholder="Hasta">
                            </div>
                            <div class="col-md-2">
                                <button class="btn btn-outline-secondary btn-sm w-100" id="btn-limpiar-filtros">Limpiar Filtros</button>
                            </div>
                        </div>

                        <!-- Tabla -->
                        <div class="table-responsive mt-3">
                            <table class="table table-hover align-middle border-0" style="font-size: 0.875rem;">
                                <thead class="bg-white text-muted border-bottom">
                                    <tr class="small text-uppercase fw-semibold text-secondary" style="letter-spacing: 0.5px; white-space: nowrap;">
                                        <th class="border-0 py-3">Fecha</th>
                                        <th class="border-0 py-3">Categoría</th>
                                        <th class="border-0 py-3">Descripción</th>
                                        <th class="border-0 py-3">Proveedor</th>
                                        <th class="border-0 py-3">Cuenta</th>
                                        <th class="border-0 py-3">Referencia</th>
                                        <th class="border-0 py-3 text-end">Monto</th>
                                        <th class="border-0 py-3 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="${this.config.tbodyId}">
                                    <!-- Contenido dinámico -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupUI(element);
        this.renderTabla(element);
    }

    setupUI(element) {
        UI.createCombobox({
            inputEl: element.querySelector('#search-proveedor'),
            hiddenIdEl: element.querySelector('#select-proveedor-id'),
            items: this.proveedores,
            displayProp: 'nombre',
            searchProps: ['nit', 'email']
        });

        const inputCuenta = element.querySelector('#transaccion-cuenta');
        const hiddenCuentaId = element.querySelector('#transaccion-cuenta-id');
        
        const bancosData = this.cuentasActivas.map(b => ({
            id: b.id, 
            displayNombre: `${b.nombre} ${b.numero && b.numero !== '-' ? '('+b.numero+')' : ''}`
        }));
        
        UI.createCombobox({
            inputEl: inputCuenta,
            hiddenIdEl: hiddenCuentaId,
            items: bancosData,
            displayProp: 'displayNombre',
            searchProps: ['displayNombre']
        });

        const fechaHoy = getLocalDate();
        element.querySelector('#transaccion-fecha').value = fechaHoy;
        
        const hace3Meses = new Date();
        hace3Meses.setMonth(hace3Meses.getMonth() - 3);
        element.querySelector('#filtro-fecha-desde').value = getLocalDate(hace3Meses);
        element.querySelector('#filtro-fecha-hasta').value = fechaHoy;

        ['filtro-categoria', 'filtro-fecha-desde', 'filtro-fecha-hasta'].forEach(id => {
            element.querySelector(`#${id}`).addEventListener('change', () => this.renderTabla(element));
        });

        element.querySelector('#btn-limpiar-filtros').addEventListener('click', () => {
            element.querySelector('#filtro-categoria').value = 'todas';
            element.querySelector('#filtro-fecha-desde').value = getLocalDate(hace3Meses);
            element.querySelector('#filtro-fecha-hasta').value = fechaHoy;
            this.renderTabla(element);
        });

        applyCurrencyFormatting(element.querySelector('#transaccion-monto'));

        const form = element.querySelector(`#${this.config.formId}`);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = element.querySelector('#btn-guardar-transaccion');
            const cuentaIdRaw = hiddenCuentaId.value.trim();

            const cuentaValida = this.cuentasActivas.find(b => String(b.id) === cuentaIdRaw);
            if (!cuentaValida) {
                alert("Por favor seleccione una cuenta bancaria válida de la lista.");
                return;
            }

            const datos = {
                fecha: element.querySelector('#transaccion-fecha').value,
                categoria: element.querySelector('#transaccion-categoria').value,
                monto: parseCurrencyValue(element.querySelector('#transaccion-monto').value),
                cuentaId: parseInt(cuentaIdRaw, 10),
                proveedorId: element.querySelector('#select-proveedor-id').value || null,
                referencia: element.querySelector('#transaccion-referencia').value.trim(),
                descripcion: element.querySelector('#transaccion-descripcion').value.trim(),
                estado: 'activo'
            };

            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...';
                
                await this.registrarTransaccion(datos);
                
                form.reset();
                element.querySelector('#transaccion-fecha').value = fechaHoy; 
                hiddenCuentaId.value = '';
                
                await this.renderTabla(element);
            } catch (err) {
                alert('Error al guardar: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-plus-circle me-1"></i>Registrar';
            }
        });
    }

    async registrarTransaccion(datosPrevios) {
        if (!datosPrevios.cuentaId || datosPrevios.monto <= 0 || !datosPrevios.categoria || !datosPrevios.descripcion) {
            throw new Error("Datos inválidos o incompletos para registrar la transacción.");
        }

        try {
            const transaccion = {
                cuenta_id: parseInt(datosPrevios.cuentaId, 10),
                fecha: datosPrevios.fecha,
                tipo: this.config.tipoTransaccion, 
                monto: datosPrevios.monto,
                categoria: datosPrevios.categoria, 
                referencia: datosPrevios.referencia || null, 
                observaciones: datosPrevios.descripcion, 
                contacto_id: datosPrevios.proveedorId ? parseInt(datosPrevios.proveedorId, 10) : null
            };

            await DB.save('transacciones', transaccion);
            return transaccion;
        } catch (error) {
            console.error("Fallo al registrar la transacción en pagos_ingresos.", error);
            throw new Error("No se pudo registrar la transacción en el sistema.");
        }
    }

    async renderTabla(element) {
        const tbody = element.querySelector(`#${this.config.tbodyId}`);
        const kpiTotal = element.querySelector(`#${this.config.kpiId}`);
        
        const catFiltro = element.querySelector('#filtro-categoria').value;
        const fechaDesde = element.querySelector('#filtro-fecha-desde').value;
        const fechaHasta = element.querySelector('#filtro-fecha-hasta').value;

        let todasTransacciones = [];
        let desde = 0;
        
        while (true) {
            const { data, error } = await supabase
                .from('pagos_ingresos')
                .select('*')
                .eq('tipo', this.config.tipoFiltroDb)
                .is('factura_id', null)
                .range(desde, desde + 999);
                
            if (error) {
                console.error("Error cargando historial:", error);
                break;
            }
            
            if (!data || data.length === 0) break;
            todasTransacciones = todasTransacciones.concat(data);
            if (data.length < 1000) break;
            desde += 1000;
        }
        
        todasTransacciones = todasTransacciones.map(g => ({
            id: g.id,
            fecha: g.fecha,
            categoria: g.categoria || 'Sin Categoría',
            descripcion: g.observaciones || '-',
            referencia: g.referencia || null,
            monto: Number(g.monto),
            cuentaId: g.cuenta_id,
            proveedorId: g.contacto_id,
            estado: g.estado
        }));
        
        const filtradas = todasTransacciones.filter(g => {
            if (g.estado === 'anulado') return false; 
            if (catFiltro !== 'todas' && g.categoria !== catFiltro) return false;
            if (fechaDesde && g.fecha < fechaDesde) return false;
            if (fechaHasta && g.fecha > fechaHasta) return false;
            return true;
        });

        filtradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        const total = filtradas.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
        kpiTotal.textContent = `$${total.toLocaleString()}`;

        if (filtradas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No se encontraron registros en este período.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtradas.map(g => {
            const proveedorNombre = g.proveedorId
                ? (this.proveedores || []).find(p => String(p.id) === String(g.proveedorId))?.nombre || '-'
                : '-';
            const cuentaNombre = g.cuentaId 
                ? (this.cuentasActivas || []).find(c => String(c.id) === String(g.cuentaId))?.nombre || g.cuentaId
                : '-';
            return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td class="py-3 text-muted" style="white-space: nowrap;">${g.fecha}</td>
                <td class="py-3" style="white-space: nowrap;"><span class="badge bg-light text-dark border">${g.categoria}</span></td>
                <td class="py-3" style="white-space: nowrap;">${g.descripcion}</td>
                <td class="py-3 text-muted" style="white-space: nowrap;">${proveedorNombre}</td>
                <td class="py-3 text-muted" style="white-space: nowrap;">${cuentaNombre}</td>
                <td class="py-3 text-muted" style="white-space: nowrap;">${g.referencia || '-'}</td>
                <td class="py-3 text-end fw-bold ${this.config.colorMonto}" style="white-space: nowrap;">${this.config.prefijoMonto}$${g.monto.toLocaleString()}</td>
                <td class="py-3 text-center" style="white-space: nowrap;">
                    <div class="dropdown">
                        <button class="btn btn-sm btn-link p-0 text-muted mx-1" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Más opciones" style="color: #6c757d !important; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">
                            <i class="bi bi-three-dots-vertical fs-6"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end shadow border-0" style="font-size: 13px;">
                            <li><a class="dropdown-item text-danger btn-eliminar-registro" href="javascript:void(0)" data-id="${g.id}">Eliminar</a></li>
                        </ul>
                    </div>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.btn-eliminar-registro').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm('¿Está seguro de anular este registro? Esta acción revertirá el movimiento bancario correspondiente.')) {
                    try {
                        await this.anularTransaccionObj(id);
                        await this.renderTabla(element);
                    } catch (err) {
                        alert("Error al anular: " + err.message);
                    }
                }
            });
        });
    }

    async anularTransaccionObj(id) {
        await anularTransaccion(id);
    }
}
