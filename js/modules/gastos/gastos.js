import DB from '../../core/db.js';
import { CoreActions } from '../../shared/crud.js';
import { UI } from '../../shared/combobox.js';
import { TesoreriaModule } from '../bancos/bancos.js';

const CATEGORIAS_GASTO = ["Arriendo", "Servicios", "Nómina", "Insumos Menores", "Otros"];

export const GastosModule = {
    async init(element) {
        element.innerHTML = `
            <div class="container-fluid py-4">
                <div class="d-flex justify-content-between flex-wrap pt-3 pb-2 mb-3 border-bottom">
                    <h1 class="h2">Gastos Operativos</h1>
                </div>

                <!-- Panel Superior: Creación Rápida -->
                <div class="card mb-4 shadow-sm border-0">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                        <h5 class="mb-0 text-primary"><i class="bi bi-receipt me-2"></i>Registrar Nuevo Gasto</h5>
                    </div>
                    <div class="card-body">
                        <form id="form-nuevo-gasto" class="row g-4 align-items-end">
                            <div class="col-md-2">
                                <label class="form-label text-muted small fw-semibold mb-1">Fecha *</label>
                                <input type="date" class="form-control" id="gasto-fecha" required>
                            </div>
                            <div class="col-md-2">
                                <label class="form-label text-muted small fw-semibold mb-1">Categoría *</label>
                                <select class="form-select" id="gasto-categoria" required>
                                    <option value="">Seleccione...</option>
                                    ${CATEGORIAS_GASTO.map(c => `<option value="${c}">${c}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-2">
                                <label class="form-label text-muted small fw-semibold mb-1">Monto ($) *</label>
                                <input type="number" class="form-control" id="gasto-monto" min="1" required>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label text-muted small fw-semibold mb-1">Cuenta Bancaria *</label>
                                <div class="custom-combobox" id="combo-cuenta-container">
                                    <input type="text" class="form-control" id="gasto-cuenta" placeholder="Buscar cuenta..." required autocomplete="off">
                                    <input type="hidden" id="gasto-cuenta-id" required>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label text-muted small fw-semibold mb-1">Referencia (Opcional)</label>
                                <input type="text" class="form-control" id="gasto-referencia" placeholder="Nro Factura / Recibo">
                            </div>
                            <div class="col-md-10">
                                <label class="form-label text-muted small fw-semibold mb-1">Descripción *</label>
                                <input type="text" class="form-control" id="gasto-descripcion" placeholder="Ej. Pago servicio de internet" required minlength="3">
                            </div>
                            <div class="col-md-2">
                                <button type="submit" class="btn btn-primary w-100" id="btn-guardar-gasto">
                                    <i class="bi bi-plus-circle me-1"></i>Registrar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Panel Inferior: Gestión y Listado -->
                <div class="card shadow-sm border-0">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-2 d-flex justify-content-between align-items-center">
                        <h5 class="mb-0 text-secondary"><i class="bi bi-list-ul me-2"></i>Historial de Gastos</h5>
                        <h4 class="mb-0 text-danger fw-bold" id="kpi-total-gastos">$0</h4>
                    </div>
                    <div class="card-body">
                        <!-- Filtros -->
                        <div class="row g-2 mb-3">
                            <div class="col-md-3">
                                <select class="form-select form-select-sm" id="filtro-categoria">
                                    <option value="todas">Todas las categorías</option>
                                    ${CATEGORIAS_GASTO.map(c => `<option value="${c}">${c}</option>`).join('')}
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
                                    <tr class="small text-uppercase fw-semibold text-secondary" style="letter-spacing: 0.5px;">
                                        <th class="border-0 py-3">Fecha</th>
                                        <th class="border-0 py-3">Categoría</th>
                                        <th class="border-0 py-3">Descripción</th>
                                        <th class="border-0 py-3">Cuenta</th>
                                        <th class="border-0 py-3">Referencia</th>
                                        <th class="border-0 py-3 text-end">Monto</th>
                                        <th class="border-0 py-3 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-gastos">
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
    },

    setupUI(element) {
        // Inicializar Combobox de Cuentas
        const inputCuenta = element.querySelector('#gasto-cuenta');
        const hiddenCuentaId = element.querySelector('#gasto-cuenta-id');
        
        // Transformar la data de cuentas para el combobox
        const bancosData = this.cuentasActivas.map(b => ({
            id: b.nombre, // Nombre puro para la base de datos
            displayNombre: `${b.nombre} ${b.numero !== '-' ? '('+b.numero+')' : ''}` // Nombre visual
        }));
        
        UI.createCombobox({
            inputEl: inputCuenta,
            hiddenIdEl: hiddenCuentaId,
            items: bancosData,
            displayProp: 'displayNombre',
            searchProps: ['id']
        });

        // Set fecha actual por defecto
        const fechaHoy = new Date().toISOString().split('T')[0];
        element.querySelector('#gasto-fecha').value = fechaHoy;
        
        // Default mes actual para filtros
        const primerDiaMes = new Date();
        primerDiaMes.setDate(1);
        element.querySelector('#filtro-fecha-desde').value = primerDiaMes.toISOString().split('T')[0];
        element.querySelector('#filtro-fecha-hasta').value = fechaHoy;

        // Event Listeners Filtros
        ['filtro-categoria', 'filtro-fecha-desde', 'filtro-fecha-hasta'].forEach(id => {
            element.querySelector(`#${id}`).addEventListener('change', () => this.renderTabla(element));
        });

        element.querySelector('#btn-limpiar-filtros').addEventListener('click', () => {
            element.querySelector('#filtro-categoria').value = 'todas';
            element.querySelector('#filtro-fecha-desde').value = primerDiaMes.toISOString().split('T')[0];
            element.querySelector('#filtro-fecha-hasta').value = fechaHoy;
            this.renderTabla(element);
        });

        // Event Listener Formulario
        const form = element.querySelector('#form-nuevo-gasto');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = element.querySelector('#btn-guardar-gasto');
            const cuentaName = hiddenCuentaId.value.trim(); // Extraer el nombre puro del campo oculto

            // Validar que la cuenta existe en config usando el nombre puro
            const cuentaValida = this.cuentasActivas.find(b => b.nombre === cuentaName);
            if (!cuentaValida) {
                alert("Por favor seleccione una cuenta bancaria válida de la lista.");
                return;
            }

            const datos = {
                fecha: element.querySelector('#gasto-fecha').value,
                categoria: element.querySelector('#gasto-categoria').value,
                monto: parseFloat(element.querySelector('#gasto-monto').value),
                cuentaId: cuentaName,
                referencia: element.querySelector('#gasto-referencia').value.trim(),
                descripcion: element.querySelector('#gasto-descripcion').value.trim(),
                estado: 'activo'
            };

            try {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...';
                
                await this.registrarGasto(datos);
                
                // Reset form
                form.reset();
                element.querySelector('#gasto-fecha').value = fechaHoy; // Restaurar fecha hoy
                hiddenCuentaId.value = '';
                
                await this.renderTabla(element);
            } catch (err) {
                alert('Error al guardar el gasto: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-plus-circle me-1"></i>Registrar';
            }
        });
    },

    async registrarGasto(datosPrevios) {
        // Validaciones defensivas
        if (!datosPrevios.cuentaId || datosPrevios.monto <= 0 || !datosPrevios.categoria || !datosPrevios.descripcion) {
            throw new Error("Datos inválidos o incompletos para registrar el gasto.");
        }

        // Generación explícita de IDs
        const gastoId = 'gst_' + Date.now();
        const datosGasto = { ...datosPrevios, id: gastoId };
        
        // 1. Guardar Gasto
        await DB.save('gastos', datosGasto);
        
        // 2. Transacción Atómica
        try {
            const transaccionId = 'txn_gasto_' + gastoId;
            const transaccion = {
                id: transaccionId,
                cuentaId: datosGasto.cuentaId,
                fecha: datosGasto.fecha,
                tipo: 'egreso', // Salida de dinero
                monto: datosGasto.monto,
                categoria: 'Pago Gasto Operativo',
                detalle: `[${datosGasto.categoria}] ${datosGasto.descripcion}`,
                referenciaId: gastoId,
                referenciaTipo: 'gasto'
            };
            await DB.save('transacciones', transaccion);
            return datosGasto;
        } catch (error) {
            console.error("Fallo al crear la transacción bancaria. Revertiendo el gasto...");
            // Rollback manual
            try {
                await DB.delete('gastos', gastoId);
                console.log("Rollback exitoso: El gasto huérfano fue eliminado.");
            } catch (rollbackError) {
                console.error("CRÍTICO: Fallo al crear la transacción bancaria y falló el rollback. El gasto ha quedado huérfano.", rollbackError);
            }
            throw new Error("No se pudo registrar la transacción en el banco. El gasto ha sido anulado.");
        }
    },

    async renderTabla(element) {
        const tbody = element.querySelector('#tbody-gastos');
        const kpiTotal = element.querySelector('#kpi-total-gastos');
        
        const catFiltro = element.querySelector('#filtro-categoria').value;
        const fechaDesde = element.querySelector('#filtro-fecha-desde').value;
        const fechaHasta = element.querySelector('#filtro-fecha-hasta').value;

        const todosGastos = await DB.getAll('gastos');
        
        // Aplicar Filtros
        const gastosFiltrados = todosGastos.filter(g => {
            if (g.estado === 'anulado') return false; // No mostrar anulados (soft delete) en el listado activo
            if (catFiltro !== 'todas' && g.categoria !== catFiltro) return false;
            if (fechaDesde && g.fecha < fechaDesde) return false;
            if (fechaHasta && g.fecha > fechaHasta) return false;
            return true;
        });

        // Ordenar por fecha descendente
        gastosFiltrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        // Calcular KPI
        const total = gastosFiltrados.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
        kpiTotal.textContent = `$${total.toLocaleString()}`;

        if (gastosFiltrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No se encontraron gastos en este período.</td></tr>`;
            return;
        }

        tbody.innerHTML = gastosFiltrados.map(g => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td class="py-3 text-muted">${g.fecha}</td>
                <td class="py-3"><span class="badge bg-light text-dark border">${g.categoria}</span></td>
                <td class="py-3">${g.descripcion}</td>
                <td class="py-3 text-muted">${g.cuentaId}</td>
                <td class="py-3 text-muted">${g.referencia || '-'}</td>
                <td class="py-3 text-end fw-bold text-danger">-$${g.monto.toLocaleString()}</td>
                <td class="py-3 text-center">
                    <button class="btn btn-sm btn-light text-danger btn-eliminar-gasto" data-id="${g.id}" title="Eliminar/Anular">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Eventos Eliminar
        tbody.querySelectorAll('.btn-eliminar-gasto').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm('¿Está seguro de anular este gasto? Esta acción revertirá el movimiento bancario correspondiente.')) {
                    try {
                        await this.anularGasto(id);
                        await this.renderTabla(element);
                    } catch (err) {
                        alert("Error al anular el gasto: " + err.message);
                    }
                }
            });
        });
    },

    async anularGasto(gastoId) {
        const gasto = await DB.get('gastos', gastoId);
        if (!gasto) throw new Error("Gasto no encontrado");

        // 1. Soft Delete del Gasto
        gasto.estado = 'anulado';
        await DB.save('gastos', gasto);

        // 2. Reversión de la transacción bancaria (crear ingreso)
        const transaccionReversion = {
            id: 'txn_rev_' + Date.now(),
            cuentaId: gasto.cuentaId,
            fecha: new Date().toISOString().split('T')[0], // Fecha de reversión: hoy
            tipo: 'ingreso', // Reingresa el dinero
            monto: gasto.monto,
            categoria: 'Reversión Gasto Operativo',
            detalle: `Reversión de gasto: [${gasto.categoria}] ${gasto.descripcion}`,
            referenciaId: gasto.id,
            referenciaTipo: 'reversion_gasto'
        };
        
        await DB.save('transacciones', transaccionReversion);
    }
};
