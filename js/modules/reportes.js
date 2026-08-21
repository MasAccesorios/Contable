import DB, { getLocalDate } from '../core/db.js';
import { supabase } from '../core/supabase.js';
import { CoreActions, PrintManager } from '../shared/crud.js';

export default {
    async init(element) {
        if (!element) return;

        const hoy = getLocalDate();
        const hace3MesesDate = new Date();
        hace3MesesDate.setMonth(hace3MesesDate.getMonth() - 3);
        const inicioRango = getLocalDate(hace3MesesDate);

        element.innerHTML = `
            <div class="dash-layout p-4">
                <h2 class="h3 fw-bold mb-4 text-dark">Reportes y Exportaciones</h2>
                
                <!-- KPI CARDS REPORTES -->
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Informes Disponibles</span>
                                <div class="dash-icon-box variant-blue">
                                    <i class="bi bi-file-earmark-bar-graph"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value">6</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Exportaciones Hoy</span>
                                <div class="dash-icon-box variant-green">
                                    <i class="bi bi-cloud-download"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value" id="kpi-exportaciones">0</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-4">
                        <div class="dash-kpi-card d-flex flex-column justify-content-between" style="min-height: 90px;">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="dash-kpi-label">Último Reporte</span>
                                <div class="dash-icon-box variant-yellow">
                                    <i class="bi bi-clock-history"></i>
                                </div>
                            </div>
                            <div class="dash-kpi-value text-truncate" id="kpi-ultimo">N/A</div>
                        </div>
                    </div>
                </div>

                <div class="dash-table-container">
                    <div class="card-body p-4">
                        <form id="form-reportes">
                            <div class="mb-4">
                                <label class="form-label text-muted small fw-bold mb-3">Selecciona el tipo de reporte</label>
                                <div class="row g-3 mb-4">
                                    <!-- Card 1 -->
                                    <div class="col-12 col-sm-6">
                                        <div class="card border-light-subtle border-2 shadow-sm h-100 report-card" data-tipo="ventas" style="cursor: pointer; border-radius: 10px; transition: 0.2s;">
                                            <div class="card-body d-flex align-items-center gap-3 p-3">
                                                <div class="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center" style="width: 45px; height: 45px; flex-shrink: 0;">
                                                    <i class="bi bi-graph-up fs-5"></i>
                                                </div>
                                                <div>
                                                    <h6 class="mb-1 fw-bold text-dark" style="font-size: var(--fs-md);">Ventas por Rango</h6>
                                                    <p class="mb-0 text-muted" style="font-size: var(--fs-sm);">Historial de facturas</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Card 2 -->
                                    <div class="col-12 col-sm-6">
                                        <div class="card border-light-subtle border-2 shadow-sm h-100 report-card" data-tipo="utilidad" style="cursor: pointer; border-radius: 10px; transition: 0.2s;">
                                            <div class="card-body d-flex align-items-center gap-3 p-3">
                                                <div class="rounded-circle bg-success bg-opacity-10 text-success d-flex align-items-center justify-content-center" style="width: 45px; height: 45px; flex-shrink: 0;">
                                                    <i class="bi bi-currency-dollar fs-5"></i>
                                                </div>
                                                <div>
                                                    <h6 class="mb-1 fw-bold text-dark" style="font-size: var(--fs-md);">Utilidad Operativa</h6>
                                                    <p class="mb-0 text-muted" style="font-size: var(--fs-sm);">Margen bruto</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Card 3 -->
                                    <div class="col-12 col-sm-6">
                                        <div class="card border-light-subtle border-2 shadow-sm h-100 report-card" data-tipo="cartera" style="cursor: pointer; border-radius: 10px; transition: 0.2s;">
                                            <div class="card-body d-flex align-items-center gap-3 p-3">
                                                <div class="rounded-circle bg-danger bg-opacity-10 text-danger d-flex align-items-center justify-content-center" style="width: 45px; height: 45px; flex-shrink: 0;">
                                                    <i class="bi bi-journal-text fs-5"></i>
                                                </div>
                                                <div>
                                                    <h6 class="mb-1 fw-bold text-dark" style="font-size: var(--fs-md);">Cartera por Cliente</h6>
                                                    <p class="mb-0 text-muted" style="font-size: var(--fs-sm);">Cuentas por cobrar</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Card 4 -->
                                    <div class="col-12 col-sm-6">
                                        <div class="card border-light-subtle border-2 shadow-sm h-100 report-card" data-tipo="estado_cuenta" style="cursor: pointer; border-radius: 10px; transition: 0.2s;">
                                            <div class="card-body d-flex align-items-center gap-3 p-3">
                                                <div class="rounded-circle bg-info bg-opacity-10 text-info d-flex align-items-center justify-content-center" style="width: 45px; height: 45px; flex-shrink: 0;">
                                                    <i class="bi bi-whatsapp fs-5"></i>
                                                </div>
                                                <div>
                                                    <h6 class="mb-1 fw-bold text-dark" style="font-size: var(--fs-md);">Estado de Cuenta</h6>
                                                    <p class="mb-0 text-muted" style="font-size: var(--fs-sm);">Envío por WhatsApp</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Card 5 -->
                                    <div class="col-12 col-sm-6">
                                        <div class="card border-light-subtle border-2 shadow-sm h-100 report-card" data-tipo="inventario" style="cursor: pointer; border-radius: 10px; transition: 0.2s;">
                                            <div class="card-body d-flex align-items-center gap-3 p-3">
                                                <div class="rounded-circle bg-warning bg-opacity-10 text-warning d-flex align-items-center justify-content-center" style="width: 45px; height: 45px; flex-shrink: 0;">
                                                    <i class="bi bi-box-seam fs-5"></i>
                                                </div>
                                                <div>
                                                    <h6 class="mb-1 fw-bold text-dark" style="font-size: var(--fs-md);">Inventario Valorizado</h6>
                                                    <p class="mb-0 text-muted" style="font-size: var(--fs-sm);">Stock actual</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Card 6 -->
                                    <div class="col-12 col-sm-6">
                                        <div class="card border-light-subtle border-2 shadow-sm h-100 report-card" data-tipo="gastos" style="cursor: pointer; border-radius: 10px; transition: 0.2s;">
                                            <div class="card-body d-flex align-items-center gap-3 p-3">
                                                <div class="rounded-circle bg-secondary bg-opacity-10 text-secondary d-flex align-items-center justify-content-center" style="width: 45px; height: 45px; flex-shrink: 0;">
                                                    <i class="bi bi-cash-stack fs-5"></i>
                                                </div>
                                                <div>
                                                    <h6 class="mb-1 fw-bold text-dark" style="font-size: var(--fs-md);">Gastos y Egresos</h6>
                                                    <p class="mb-0 text-muted" style="font-size: var(--fs-sm);">Módulo tesorería</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <input type="hidden" id="rep-tipo" value="" required>
                            </div>

                            <div class="row g-3 mb-4" id="rango-fechas" style="display: none;">
                                <div class="col-12 col-md-6">
                                    <label class="form-label text-muted small fw-bold">Fecha Inicio</label>
                                    <input type="date" class="form-control" id="rep-inicio" value="${inicioRango}">
                                </div>
                                <div class="col-12 col-md-6">
                                    <label class="form-label text-muted small fw-bold">Fecha Fin</label>
                                    <input type="date" class="form-control" id="rep-fin" value="${hoy}">
                                </div>
                            </div>

                            <div class="d-flex justify-content-end">
                                <button type="submit" class="btn btn-primary-action w-100 w-md-auto" id="btn-exportar" style="display: none;">
                                    <i class="bi bi-file-earmark-excel me-2"></i>Generar Exportable
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <div id="estado-cuenta-container" class="mt-4" style="display: none;"></div>
            </div>
        `;

        const hiddenTipo = element.querySelector('#rep-tipo');
        const rangoFechas = element.querySelector('#rango-fechas');
        const repCards = element.querySelectorAll('.report-card');
        const btnExportar = element.querySelector('#btn-exportar');
        const containerCuenta = element.querySelector('#estado-cuenta-container');

        repCards.forEach(card => {
            card.addEventListener('click', () => {
                // Limpiar selección previa
                repCards.forEach(c => {
                    c.classList.remove('border-primary', 'shadow');
                    c.classList.add('border-light-subtle', 'shadow-sm');
                });
                // Marcar actual
                card.classList.remove('border-light-subtle', 'shadow-sm');
                card.classList.add('border-primary', 'shadow');
                
                const val = card.dataset.tipo;
                hiddenTipo.value = val;

                if (val === 'estado_cuenta') {
                    containerCuenta.style.display = 'block';
                    btnExportar.style.display = 'block';
                } else {
                    containerCuenta.style.display = 'none';
                    containerCuenta.innerHTML = '';
                    btnExportar.style.display = 'block';
                }
                
                if (val === 'cartera' || val === 'inventario' || val === 'estado_cuenta') {
                    rangoFechas.style.display = 'none';
                } else {
                    rangoFechas.style.display = 'flex';
                }
            });
        });

        element.querySelector('#form-reportes').addEventListener('submit', async (e) => {
            e.preventDefault();
            const tipo = hiddenTipo.value;
            
            if (!tipo) {
                CoreActions.showWarningModal("Por favor selecciona un tipo de reporte.");
                return;
            }
            
            const btn = element.querySelector('#btn-exportar');
            const fInicio = element.querySelector('#rep-inicio').value;
            const fFin = element.querySelector('#rep-fin').value;
            
            try {
                let dataToExport = [];
                const contactos = await DB.getAll('contactos');
                const getClienteName = (id) => {
                    const c = contactos.find(x => String(x.id) === String(id));
                    return c ? c.nombre : 'Cliente Genérico / Contado';
                };

                if (tipo === 'estado_cuenta') {
                    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cargando...';
                    btn.disabled = true;
                    
                    const container = element.querySelector('#estado-cuenta-container');
                    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
                    
                    const { data: cartera, error } = await supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxc' });
                    
                    btn.innerHTML = '<i class="bi bi-file-earmark-excel me-2"></i>Generar Exportable';
                    btn.disabled = false;
                    
                    if (error) {
                        CoreActions.showWarningModal('Error al cargar la cartera.');
                        return;
                    }
                    
                    const agrupado = {};
                    (cartera || []).forEach(f => {
                        if (!agrupado[f.contacto_id]) {
                            agrupado[f.contacto_id] = { id: f.contacto_id, nombre: getClienteName(f.contacto_id), total: 0 };
                        }
                        agrupado[f.contacto_id].total += parseFloat(f.saldo) || 0;
                    });
                    
                    const clientesArr = Object.values(agrupado).sort((a,b) => b.total - a.total);
                    
                    if (clientesArr.length === 0) {
                        container.innerHTML = '<div class="alert alert-info">No hay cuentas por cobrar.</div>';
                        return;
                    }
                    
                    let htmlCards = '<div class="row g-3">';
                    clientesArr.forEach(c => {
                        htmlCards += `
                            <div class="col-md-6">
                                <div class="card border-0 shadow-sm h-100" style="border-radius: 8px;">
                                    <div class="card-body d-flex justify-content-between align-items-center p-3">
                                        <div>
                                            <h6 class="mb-1 text-dark fw-bold" style="font-size: var(--fs-md);">${c.nombre}</h6>
                                            <div class="text-danger fw-bold" style="font-size: var(--fs-md);">$${c.total.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                        </div>
                                        <button class="btn btn-sm btn-outline-success d-flex align-items-center btn-wpp-estado" data-id="${c.id}" style="border-radius: 6px;">
                                            <i class="bi bi-whatsapp me-1"></i> Enviar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    htmlCards += '</div>';
                    
                    container.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h5 class="text-dark mb-0">Estados de Cuenta</h5>
                            <span class="badge bg-primary rounded-pill">${clientesArr.length} clientes</span>
                        </div>
                        ${htmlCards}
                    `;
                    
                    container.querySelectorAll('.btn-wpp-estado').forEach(btn => {
                        btn.addEventListener('click', () => {
                            if (window.PrintManager) {
                                window.PrintManager.printEstadoCuenta(btn.dataset.id);
                            } else if (PrintManager) {
                                PrintManager.printEstadoCuenta(btn.dataset.id);
                            }
                        });
                    });
                    
                    return; // No exportamos CSV
                }

                if (tipo === 'ventas' || tipo === 'utilidad') {
                    const facturas = await DB.getAll('facturas');
                    let filtradas = facturas.filter(f => f.tipo === 'venta' && f.fecha >= fInicio && f.fecha <= fFin);
                    
                    if (tipo === 'ventas') {
                        dataToExport = filtradas.map(f => ({
                            'Documento': f.numero || parseInt(String(f.id).replace(/\D/g, ''), 10) || f.id,
                            'Fecha': f.fecha,
                            'Cliente': getClienteName(f.clienteId || f.contactoId),
                            'Estado': f.estado,
                            'Total de Venta': Math.round(f.total || 0)
                        }));
                    } else { // Utilidad
                        dataToExport = filtradas.map(f => ({
                            'Documento': f.numero || parseInt(String(f.id).replace(/\D/g, ''), 10) || f.id,
                            'Fecha': f.fecha,
                            'Cliente': getClienteName(f.clienteId || f.contactoId),
                            'Total de Venta': Math.round(f.total || 0),
                            'Costo de Venta (FIFO)': Math.round(f.total_costo || 0),
                            'Utilidad Bruta': Math.round((f.total || 0) - (f.total_costo || 0))
                        }));
                    }
                } 
                else if (tipo === 'cartera') {
                    const { data: cartera, error: errC } = await supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxc' });
                    if (errC) throw new Error('Error al cargar cartera: ' + errC.message);
                    dataToExport = (cartera || []).map(f => ({
                        'Cliente':           getClienteName(f.contacto_id),
                        'Documento':         f.numero,
                        'Fecha Emisión':     f.fecha,
                        'Fecha Vencimiento': f.vencimiento || '',
                        'Total Factura':     Math.round(parseFloat(f.total) || 0),
                        'Saldo Pendiente':   Math.round(parseFloat(f.saldo) || 0)
                    }));
                }
                else if (tipo === 'inventario') {
                    const lotes = await DB.getAll('lotes_fifo');
                    const productos = await DB.getAll('productos');
                    const getProdName = (id) => {
                        const p = productos.find(x => x.id === id);
                        return p ? p.nombre : 'Producto Desconocido';
                    };
                    const getProdCat = (id) => {
                        const p = productos.find(x => x.id === id);
                        return p ? p.categoria : '';
                    };

                    dataToExport = lotes.filter(l => l.cantidadActual > 0).map(l => ({
                        'Producto': getProdName(l.productoId),
                        'Categoría': getProdCat(l.productoId),
                        'Lote/Ref': l.id,
                        'Fecha de Ingreso': l.fechaIngreso,
                        'Stock Disponible': l.cantidadActual,
                        'Costo Unitario': Math.round(l.costoUnitario || 0),
                        'Valor Total': Math.round(l.cantidadActual * (l.costoUnitario || 0))
                    }));
                }
                else if (tipo === 'gastos') {
                    const transacciones = await DB.getAll('transacciones');
                    let egresos = transacciones.filter(t => t.tipo === 'egreso' && t.fecha >= fInicio && t.fecha <= fFin);
                    dataToExport = egresos.map(t => ({
                        'Fecha': t.fecha,
                        'Cuenta de Salida': t.cuentaId || t.cuenta || '',
                        'Concepto/Detalle': t.detalle || t.referencia || '',
                        'Referencia Documento': t.referenciaId || '',
                        'Monto ($)': Math.round(t.monto || 0)
                    }));
                }

                if (dataToExport.length === 0) {
                    CoreActions.showWarningModal("No hay datos para exportar con los filtros seleccionados.");
                    return;
                }
                
                // Actualizar KPIs de uso (visual)
                let expCount = parseInt(element.querySelector('#kpi-exportaciones').textContent) || 0;
                element.querySelector('#kpi-exportaciones').textContent = expCount + 1;
                element.querySelector('#kpi-ultimo').textContent = tipo.replace('_', ' ').toUpperCase();
                
                this.exportDynamicCSV(dataToExport, tipo, btn);

            } catch (err) {
                console.error(err);
                CoreActions.showWarningModal("Ocurrió un error al generar el reporte.");
            }
        });
    },

    exportDynamicCSV(rows, tipoModulo, btnElement) {
        let originalText = btnElement.innerHTML;
        btnElement.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';
        btnElement.disabled = true;

        try {
            const headers = Object.keys(rows[0]);
            let csvContent = headers.join(';') + String.fromCharCode(13, 10);
            
            rows.forEach(row => {
                const values = headers.map(header => {
                    let val = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
                    val = val.replace(/"/g, '""');
                    return `"${val}"`;
                });
                csvContent += values.join(';') + String.fromCharCode(13, 10);
            });

            const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
            const blob = new Blob([BOM, csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const dateStr = getLocalDate();
            const filename = `Reporte_${tipoModulo}_${dateStr}.csv`;

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            link.style.display = 'none';
            document.body.appendChild(link);
            
            link.click();
            
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generando reporte:', error);
            CoreActions.showWarningModal('Ocurrió un error al generar el archivo. Por favor, intenta de nuevo.');
        } finally {
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
        }
    }
};
