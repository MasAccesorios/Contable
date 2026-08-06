import DB, { getLocalDate } from '../core/db.js';
import { supabase } from '../core/supabase.js';
import { CoreActions, PrintManager } from '../shared/crud.js';
import { applyCurrencyFormatting } from '../shared/formatters.js';

export default {
    async init(element) {
        if (!element) return;

        const hoy = getLocalDate();
        const hace3MesesDate = new Date();
        hace3MesesDate.setMonth(hace3MesesDate.getMonth() - 3);
        const inicioRango = getLocalDate(hace3MesesDate);

        element.innerHTML = `
            <div class="p-4" style="max-width: 800px; margin: 0 auto;">
                <h3 class="text-title text-dark mb-4">Reportes y Exportaciones</h3>
                
                <div class="card border-0 shadow-sm" style="border-radius: 12px;">
                    <div class="card-body p-4">
                        <form id="form-reportes">
                            <div class="mb-4">
                                <label class="form-label text-muted small fw-bold">Tipo de Reporte</label>
                                <select id="rep-tipo" class="form-select text-dark" required>
                                    <option value="ventas">Ventas por Rango de Fecha</option>
                                    <option value="utilidad">Utilidad por Rango de Fecha</option>
                                    <option value="cartera">Cartera por Cliente</option>
                                    <option value="estado_cuenta">Estado de Cuenta por Cliente (WhatsApp)</option>
                                    <option value="inventario">Inventario Actual (Valorizado)</option>
                                    <option value="gastos">Gastos y Egresos (Tesorería)</option>
                                </select>
                            </div>

                            <div class="row g-3 mb-4" id="rango-fechas">
                                <div class="col-md-6">
                                    <label class="form-label text-muted small fw-bold">Fecha Inicio</label>
                                    <input type="date" class="form-control" id="rep-inicio" value="${inicioRango}" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-muted small fw-bold">Fecha Fin</label>
                                    <input type="date" class="form-control" id="rep-fin" value="${hoy}" required>
                                </div>
                            </div>

                            <div class="d-flex justify-content-end">
                                <button type="submit" class="btn btn-primary px-4 py-2" id="btn-exportar" style="border-radius: 8px; font-weight: 500;">
                                    <i class="bi bi-file-earmark-excel me-2"></i>Generar Exportable
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <div id="estado-cuenta-container" class="mt-4" style="display: none;"></div>
            </div>
        `;

        const tipoSelect = element.querySelector('#rep-tipo');
        const rangoFechas = element.querySelector('#rango-fechas');

        tipoSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const container = element.querySelector('#estado-cuenta-container');
            if (val === 'estado_cuenta') {
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
                container.innerHTML = '';
            }
            if (val === 'cartera' || val === 'inventario' || val === 'estado_cuenta') {
                rangoFechas.style.display = 'none';
            } else {
                rangoFechas.style.display = 'flex';
            }
        });

        element.querySelector('#form-reportes').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = element.querySelector('#btn-exportar');
            const tipo = tipoSelect.value;
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
                                            <h6 class="mb-1 text-dark fw-bold" style="font-size: 14px;">${c.nombre}</h6>
                                            <div class="text-danger fw-bold" style="font-size: 15px;">$${c.total.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
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
                    const facturas = await DB.getAll('facturas');
                    let pendientes = facturas.filter(f => f.tipo === 'venta' && (f.estado === 'pendiente' || f.estado === 'por_pagar' || f.estado === 'parcial'));
                    dataToExport = pendientes.map(f => {
                        const total = parseFloat(f.total) || 0;
                        const saldo = f.saldo !== undefined ? parseFloat(f.saldo) : total;
                        return {
                            'Cliente': getClienteName(f.clienteId || f.contactoId),
                            'Documento': f.numero || parseInt(String(f.id).replace(/\D/g, ''), 10) || f.id,
                            'Fecha Emisión': f.fecha,
                            'Fecha Vencimiento': f.vencimiento || '',
                            'Total Factura': Math.round(total),
                            'Saldo Pendiente': Math.round(saldo)
                        };
                    });
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
