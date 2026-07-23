import DB from '../core/db.js';
import { CoreActions } from '../shared/crud.js';

export default {
    async init(element) {
        if (!element) return;

        const hoy = new Date().toISOString().split('T')[0];
        const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

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
                                    <option value="inventario">Inventario Actual (Valorizado)</option>
                                    <option value="gastos">Gastos y Egresos (Tesorería)</option>
                                </select>
                            </div>

                            <div class="row g-3 mb-4" id="rango-fechas">
                                <div class="col-md-6">
                                    <label class="form-label text-muted small fw-bold">Fecha Inicio</label>
                                    <input type="date" id="rep-inicio" class="form-control" value="${inicioMes}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-muted small fw-bold">Fecha Fin</label>
                                    <input type="date" id="rep-fin" class="form-control" value="${hoy}">
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
            </div>
        `;

        const tipoSelect = element.querySelector('#rep-tipo');
        const rangoFechas = element.querySelector('#rango-fechas');

        tipoSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'cartera' || val === 'inventario') {
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
                    const c = contactos.find(x => x.id === id);
                    return c ? c.nombre : 'Cliente Genérico / Contado';
                };

                if (tipo === 'ventas' || tipo === 'utilidad') {
                    const facturas = await DB.getAll('facturas');
                    let filtradas = facturas.filter(f => f.tipo === 'venta' && f.fecha >= fInicio && f.fecha <= fFin);
                    
                    if (tipo === 'ventas') {
                        dataToExport = filtradas.map(f => ({
                            'Documento': (f.prefijo || '') + (f.numero || ''),
                            'Fecha': f.fecha,
                            'Cliente': getClienteName(f.clienteId),
                            'Estado': f.estado,
                            'Total de Venta': f.total
                        }));
                    } else { // Utilidad
                        dataToExport = filtradas.map(f => ({
                            'Documento': (f.prefijo || '') + (f.numero || ''),
                            'Fecha': f.fecha,
                            'Cliente': getClienteName(f.clienteId),
                            'Total de Venta': f.total,
                            'Costo de Venta (FIFO)': f.total_costo || 0,
                            'Utilidad Bruta': f.utilidad || 0
                        }));
                    }
                } 
                else if (tipo === 'cartera') {
                    const facturas = await DB.getAll('facturas');
                    let pendientes = facturas.filter(f => f.tipo === 'venta' && (f.estado === 'pendiente' || f.estado === 'parcial'));
                    dataToExport = pendientes.map(f => {
                        const total = parseFloat(f.total) || 0;
                        const saldo = f.saldo !== undefined ? parseFloat(f.saldo) : total;
                        return {
                            'Cliente': getClienteName(f.clienteId),
                            'Documento': (f.prefijo || '') + (f.numero || ''),
                            'Fecha Emisión': f.fecha,
                            'Fecha Vencimiento': f.vencimiento || '',
                            'Total Factura': total,
                            'Saldo Pendiente': saldo
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
                        'Costo Unitario': l.costoUnitario,
                        'Valor Total': (l.cantidadActual * l.costoUnitario)
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
                        'Monto ($)': t.monto
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

        setTimeout(() => {
            try {
                const headers = Object.keys(rows[0]);
                let csvContent = headers.join(';') + '\\r\\n';
                
                rows.forEach(row => {
                    const values = headers.map(header => {
                        let val = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
                        val = val.replace(/"/g, '""');
                        return `"${val}"`;
                    });
                    csvContent += values.join(';') + '\\r\\n';
                });

                const BOM = '\\uFEFF';
                const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);

                const dateStr = new Date().toISOString().split('T')[0];
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
        }, 300);
    }
};
