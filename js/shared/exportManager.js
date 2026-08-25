import DB, { getLocalDate } from '../core/db.js';
import { CoreActions } from './crud.js';

/**
 * GESTOR DE EXPORTACIÓN (EXCEL / CSV)
 * Convierte un arreglo de datos filtrado de la grilla en un archivo plano codificado para descarga.
 */
export const ExportManager = {
    exportDataToExcel(dataArray, tipoModulo, getClienteNameFunc, btnElement = null) {
        if (!dataArray || dataArray.length === 0) {
            CoreActions.showWarningModal('No hay datos disponibles para exportar con el filtro actual.');
            return;
        }

        // 1. Feedback Visual de Carga
        let originalText = '';
        if (btnElement) {
            originalText = btnElement.innerHTML;
            btnElement.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generando...';
            btnElement.disabled = true;
            btnElement.style.opacity = '0.7';
        }

        // 2. Mapeo Asíncrono Simulado (para permitir el repintado del DOM del spinner)
        if (window._crudExportTimeout) clearTimeout(window._crudExportTimeout);
        window._crudExportTimeout = setTimeout(() => {
            try {
                // Formateadores locales
                const formatMoney = (val) => parseFloat(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                
                // Mapear objetos a filas planas
                const rows = dataArray.map(item => {
                    if (tipoModulo === 'Productos') {
                        return {
                            'SKU': item.sku || '',
                            'Nombre': item.nombre || '',
                            'Costo Base': formatMoney(item.costoBase || item.costo_base),
                            'Precio Venta': formatMoney(item.precioVenta || item.precio_venta),
                            'Stock Base': item.stock || 0,
                            'Stock Mínimo': item.stockMinimo || item.stock_minimo || 0,
                            'Estado': item.estado || 'Activo'
                        };
                    }
                    
                    if (tipoModulo === 'Facturas' || tipoModulo === 'Facturas_Compras') {
                        const contactoId = item.contacto_id || item.proveedorId || item.clienteId || item.cliente_id;
                        const clienteNombre = getClienteNameFunc ? getClienteNameFunc(contactoId) : (contactoId || 'Sin Contacto');
                        
                        let estadoReal = item.estado || item.estado_dinamico || 'Pendiente';
                        if (estadoReal === 'por_pagar') estadoReal = 'Pendiente';
                        
                        return {
                            'Número de Documento': item.numero || item.id,
                            'Cliente/Proveedor': clienteNombre,
                            'Fecha de Creación': item.fecha || '',
                            'Fecha de Vencimiento': item.vencimiento || '',
                            'Valor Total': formatMoney(item.total),
                            'Total Pagado': formatMoney(item.totalPagado || item.total_pagado),
                            'Saldo Pendiente': formatMoney(item.saldoPendiente || item.saldo_pendiente),
                            'Estado Actual': estadoReal
                        };
                    }

                    const clienteNombre = getClienteNameFunc ? getClienteNameFunc(item.clienteId || item.cliente_id, item) : (item.clienteId || item.cliente_id || 'N/A');
                    const numDoc = item.numero || parseInt(String(item.id).replace(/\D/g, ''), 10) || item.id;
                    const estado = item.convertidoAFactura || item.convertido_a_factura ? 'Facturada' : 'Borrador';

                    return {
                        'Número de Documento': numDoc,
                        'Nombre del Cliente': clienteNombre,
                        'Fecha de Creación': item.fecha || item.created_at || '',
                        'Valor Total': formatMoney(item.total),
                        'Estado Actual': estado
                    };
                });

                if (rows.length === 0) throw new Error('Error al parsear los datos.');

                // 3. Extracción de Cabeceras
                const headers = Object.keys(rows[0]);
                
                // 4. Construcción del CSV con delimitadores limpios (;) y saltos de línea (CRLF)
                let csvContent = headers.join(';') + '\r\n';
                
                rows.forEach(row => {
                    const values = headers.map(header => {
                        let val = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
                        val = val.replace(/"/g, '""'); // Escapar comillas internas
                        return `"${val}"`;             // Envolver valor en comillas
                    });
                    csvContent += values.join(';') + '\r\n';
                });

                // 5. Inyección del BOM (Byte Order Mark real) para UTF-8 y Blob
                const BOM = '\uFEFF';
                const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);

                // 6. Generación de Nombre Dinámico y Gatillo de Descarga
                const dateStr = getLocalDate();
                const filename = `Reporte_${tipoModulo}_${dateStr}.csv`;

                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename);
                link.style.display = 'none';
                document.body.appendChild(link);
                
                link.click();
                
                // 7. Limpieza de Memoria
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

            } catch (error) {
                console.error('Error generando reporte:', error);
                CoreActions.showWarningModal('Ocurrió un error al generar el archivo. Por favor, intenta de nuevo.');
            } finally {
                // 8. Restaurar Feedback Visual
                if (btnElement) {
                    btnElement.innerHTML = originalText;
                    btnElement.disabled = false;
                    btnElement.style.opacity = '1';
                }
            }
        }, 150); // Timeout leve para priorizar UI rendering
    },

    /**
     * Soft delete para registros. En lugar de borrarlos físicamente,
     * cambia el estado a 'inactivo' para preservar integridad referencial.
     * @param {string} storeName - Nombre del object store
     * @param {string} id - ID del registro
     */
    async softDelete(storeName, id) {
        try {
            const registro = await DB.get(storeName, id);
            if (!registro) throw new Error("Registro no encontrado.");
            
            registro.estado = 'inactivo';
            registro.updated_at = new Date().toISOString();
            
            await DB.save(storeName, registro);
            return true;
        } catch (error) {
            console.error(`Error en softDelete para ${storeName} [${id}]:`, error);
            throw error;
        }
    }
};
