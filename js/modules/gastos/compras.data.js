// js/modules/gastos/compras.data.js
import DB from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { CoreActions } from '../../shared/crud.js';
import { ExportManager } from '../../shared/exportManager.js';
import { calcularDiasVencida } from '../../shared/carteraUtils.js';
import { EstadoUtils } from '../../shared/estadoUtils.js';
import { InventarioUtils } from '../../shared/inventarioUtils.js';

export const ComprasData = {
    /**
     * Calcula los 4 KPIs ejecutivos para Facturas de Compra (Cuentas por Pagar)
     */
    async fetchKpis() {
        let totalPorPagar = 0;
        let cuentasVigentes = 0;
        let cuentasVencidas = 0;
        let totalPagado = 0;
        let totalFacturado = 0;
        let conteoPorPagar = 0;
        let conteoVencidas = 0;
        let conteoVigentes = 0;

        try {
            // 1. Obtener cartera CXP con saldos
            const { data: cxpData, error: cxpErr } = await supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxp' });
            if (!cxpErr && Array.isArray(cxpData)) {
                cxpData.forEach(f => {
                    const saldo = parseFloat(f.saldo !== undefined ? f.saldo : f.total) || 0;
                    if (saldo > 0) {
                        totalPorPagar += saldo;
                        conteoPorPagar++;
                        const dias = calcularDiasVencida(f.vencimiento);
                        if (dias >= 1) {
                            cuentasVencidas += saldo;
                            conteoVencidas++;
                        } else {
                            cuentasVigentes += saldo;
                            conteoVigentes++;
                        }
                    }
                });
            }

            // 2. Obtener KPIs de compras del periodo (o acumulado)
            const { data: kpiRpc } = await supabase.rpc('get_facturas_kpis', { p_tipo: 'compra' });
            if (kpiRpc) {
                totalFacturado = parseFloat(kpiRpc.facturado) || 0;
                totalPagado = parseFloat(kpiRpc.cobrado) || 0;
            } else {
                // Fallback si la RPC falla o devuelve null
                const { data: facturasTotal } = await supabase
                    .from('facturas')
                    .select('total, estado')
                    .eq('tipo', 'compra')
                    .neq('estado', 'anulada');
                if (facturasTotal) {
                    totalFacturado = facturasTotal.reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
                    totalPagado = Math.max(0, totalFacturado - totalPorPagar);
                }
            }
        } catch (err) {
            console.error('[ComprasData] Error al calcular KPIs:', err);
        }

        const porcentajeAmortizado = totalFacturado > 0 ? Math.round((totalPagado / totalFacturado) * 100) : 0;

        return {
            totalPorPagar,
            cuentasVigentes,
            cuentasVencidas,
            totalPagado,
            totalFacturado,
            porcentajeAmortizado,
            conteoPorPagar,
            conteoVencidas,
            conteoVigentes
        };
    },

    /**
     * Calcula los conteos en vivo para las pestañas segmentadas
     */
    async fetchTabCounts() {
        const counts = {
            todas: 0,
            por_pagar: 0,
            vencidas: 0,
            pagadas: 0,
            anuladas: 0
        };

        try {
            const { data, error } = await supabase.rpc('get_facturas_con_saldos', {
                p_page: 1,
                p_limit: 10000,
                p_sort_col: 'numero',
                p_sort_dir: 'desc',
                p_search: '',
                p_filter_criteria: 'todos',
                p_tipo: 'compra'
            });

            if (!error && Array.isArray(data)) {
                counts.todas = data.length;
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);

                data.forEach(f => {
                    const estado = (f.estado_dinamico || f.estado || '').toLowerCase();
                    const isAnulada = estado === 'anulada' || estado === 'void' || estado === 'voided';
                    const saldo = parseFloat(f.saldo_pendiente !== undefined ? f.saldo_pendiente : f.total) || 0;

                    if (isAnulada) {
                        counts.anuladas++;
                    } else if (saldo <= 0) {
                        counts.pagadas++;
                    } else {
                        counts.por_pagar++;
                        let isVencida = false;
                        if (f.vencimiento) {
                            const vDate = new Date(String(f.vencimiento).split('T')[0] + 'T00:00:00');
                            if (!isNaN(vDate.getTime()) && vDate < hoy) isVencida = true;
                        }
                        if (isVencida) counts.vencidas++;
                    }
                });
            }
        } catch (err) {
            console.error('[ComprasData] Error al obtener conteos de pestañas:', err);
        }

        return counts;
    },

    /**
     * Obtiene el listado de facturas paginadas y filtradas
     */
    async fetchComprasPage({ page = 1, limit = 10, sortCol = 'numero', sortDir = 'desc', search = '', filterCriteria = 'todos', tab = 'todas' }) {
        const isTabFiltered = tab !== 'todas' || Boolean(search);
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
        const rpcSortCol = sortCol === 'proveedor' ? 'cliente' : sortCol;
        const rpcFilterCriteria = filterCriteria === 'proveedor' ? 'cliente' : filterCriteria;

        let items = [];
        let totalItems = 0;
        let contactosMap = {};

        try {
            if (!isTabFiltered) {
                // Consulta server-side normal
                const { data, error } = await supabase.rpc('get_facturas_con_saldos', {
                    p_page: safePage,
                    p_limit: safeLimit,
                    p_sort_col: rpcSortCol,
                    p_sort_dir: sortDir,
                    p_search: search,
                    p_filter_criteria: rpcFilterCriteria,
                    p_tipo: 'compra'
                });
                if (error) throw error;

                items = Array.isArray(data) ? data : [];
                totalItems = items.length > 0 ? parseInt(items[0].total_count || 0, 10) : 0;
            } else {
                // Lote amplio para filtrado preciso por pestaña y búsqueda
                const { data, error } = await supabase.rpc('get_facturas_con_saldos', {
                    p_page: 1,
                    p_limit: 10000,
                    p_sort_col: rpcSortCol,
                    p_sort_dir: sortDir,
                    p_search: search,
                    p_filter_criteria: rpcFilterCriteria,
                    p_tipo: 'compra'
                });
                if (error) throw error;

                let allRows = Array.isArray(data) ? data : [];
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);

                if (tab === 'por_pagar') {
                    allRows = allRows.filter(f => {
                        const isAnulada = EstadoUtils.estaAnulado(f.estado_dinamico || f.estado);
                        const saldo = parseFloat(f.saldo_pendiente !== undefined ? f.saldo_pendiente : f.total) || 0;
                        return !isAnulada && saldo > 0;
                    });
                } else if (tab === 'pagadas') {
                    allRows = allRows.filter(f => {
                        const isAnulada = EstadoUtils.estaAnulado(f.estado_dinamico || f.estado);
                        const saldo = parseFloat(f.saldo_pendiente !== undefined ? f.saldo_pendiente : f.total) || 0;
                        return !isAnulada && saldo <= 0;
                    });
                } else if (tab === 'vencidas') {
                    allRows = allRows.filter(f => {
                        const isAnulada = EstadoUtils.estaAnulado(f.estado_dinamico || f.estado);
                        const saldo = parseFloat(f.saldo_pendiente !== undefined ? f.saldo_pendiente : f.total) || 0;
                        if (isAnulada || saldo <= 0) return false;
                        if (!f.vencimiento) return false;
                        const vDate = new Date(String(f.vencimiento).split('T')[0] + 'T00:00:00');
                        return !isNaN(vDate.getTime()) && vDate < hoy;
                    });
                } else if (tab === 'anuladas') {
                    allRows = allRows.filter(f => EstadoUtils.estaAnulado(f.estado_dinamico || f.estado));
                }

                totalItems = allRows.length;
                const totalPages = Math.ceil(totalItems / safeLimit) || 1;
                let validPage = safePage;
                if (validPage > totalPages) validPage = totalPages;
                if (validPage < 1) validPage = 1;

                const from = (validPage - 1) * safeLimit;
                items = allRows.slice(from, from + safeLimit);
            }

            // Normalización de campos y decoraciones
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            items = items.map(f => {
                const saldo = parseFloat(f.saldo_pendiente !== undefined ? f.saldo_pendiente : f.total) || 0;
                const pagado = parseFloat(f.total_pagado) || 0;
                let isVencida = false;
                if (f.vencimiento) {
                    const vDate = new Date(String(f.vencimiento).split('T')[0] + 'T00:00:00');
                    if (!isNaN(vDate.getTime()) && vDate < hoy) isVencida = true;
                }
                return {
                    ...f,
                    estado: f.estado_dinamico || f.estado || 'por_pagar',
                    saldoPendiente: saldo,
                    totalPagado: pagado,
                    isVencida
                };
            });

            // Resolver proveedores en bloque (deduplicando IDs)
            const rawContactoIds = items.map(c => c.proveedorId || c.contacto_id || c.contactoId).filter(Boolean);
            const contactoIds = [...new Set(rawContactoIds)];
            if (contactoIds.length > 0) {
                const { data: cdata } = await supabase.from('contactos').select('id, nombre').in('id', contactoIds);
                if (cdata) {
                    cdata.forEach(c => { contactosMap[c.id] = c.nombre; });
                }
            }

        } catch (err) {
            console.error('[ComprasData] Error en fetchComprasPage:', err);
            throw err;
        }

        return { items, totalItems, contactosMap };
    },

    /**
     * Carga el detalle completo de una factura para el slide-over drawer
     */
    async fetchFacturaDetalleDrawer(id) {
        if (!id) throw new Error('ID de factura requerido');
        const cleanId = String(id).replace(/\D/g, '') || id;

        try {
            const [facRes, itemsRes, pagosRes] = await Promise.all([
                supabase.from('facturas')
                    .select('*, contactos(nombre, identificacion, email, telefono, direccion)')
                    .eq('id', cleanId)
                    .single(),
                supabase.from('factura_detalles')
                    .select('*, productos(nombre, sku, codigo)')
                    .eq('factura_id', cleanId),
                supabase.from('pagos_ingresos')
                    .select('id, fecha, monto, observaciones, comprobante, referencia, cuentas_bancarias(nombre), conciliacion_id')
                    .eq('factura_id', cleanId)
                    .neq('estado', 'anulado')
                    .order('fecha', { ascending: false })
            ]);

            if (facRes.error || !facRes.data) {
                throw facRes.error || new Error('Factura de compra no encontrada');
            }

            const fac = facRes.data;
            const items = itemsRes.data || [];
            const pagos = pagosRes.data || [];

            const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto || 0), 0);
            const saldoPendiente = Math.max(0, Number(fac.total || 0) - totalPagado);

            return { fac, items, pagos, totalPagado, saldoPendiente };
        } catch (err) {
            console.error('[ComprasData] Error al cargar detalle drawer:', err);
            throw err;
        }
    },

    /**
     * Anula una factura de compra revirtiendo lotes de inventario de forma atómica
     */
    async anularCompra(id) {
        if (!id) throw new Error('ID de factura requerido');
        const { anularFacturaCompra } = await import('../../shared/anularCompraUtils.js');
        return await anularFacturaCompra(id, { DB, EstadoUtils, InventarioUtils, supabase, CoreActions });
    },

    /**
     * Exporta las compras filtradas a archivo Excel/CSV
     */
    async exportarExcel({ sortCol, sortDir, search, filterCriteria, tab, btn }) {
        const rpcSortCol = sortCol === 'proveedor' ? 'cliente' : sortCol;
        const rpcFilterCriteria = filterCriteria === 'proveedor' ? 'cliente' : filterCriteria;

        const { data: allFiltered, error } = await supabase.rpc('get_facturas_con_saldos', {
            p_page: 1,
            p_limit: 10000,
            p_sort_col: rpcSortCol,
            p_sort_dir: sortDir,
            p_search: search,
            p_filter_criteria: rpcFilterCriteria,
            p_tipo: 'compra'
        });

        if (error) throw error;

        let allRows = Array.isArray(allFiltered) ? allFiltered : [];
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (tab === 'por_pagar') {
            allRows = allRows.filter(f => !EstadoUtils.estaAnulado(f.estado_dinamico || f.estado) && Number(f.saldo_pendiente) > 0);
        } else if (tab === 'pagadas') {
            allRows = allRows.filter(f => !EstadoUtils.estaAnulado(f.estado_dinamico || f.estado) && Number(f.saldo_pendiente) <= 0);
        } else if (tab === 'vencidas') {
            allRows = allRows.filter(f => {
                if (EstadoUtils.estaAnulado(f.estado_dinamico || f.estado) || Number(f.saldo_pendiente) <= 0) return false;
                if (!f.vencimiento) return false;
                return new Date(String(f.vencimiento).split('T')[0] + 'T00:00:00') < hoy;
            });
        } else if (tab === 'anuladas') {
            allRows = allRows.filter(f => EstadoUtils.estaAnulado(f.estado_dinamico || f.estado));
        }

        if (allRows.length === 0) {
            CoreActions.showWarningModal('No hay facturas de compra para exportar con los filtros seleccionados.');
            return;
        }

        const allDecorated = allRows.map(f => ({
            ...f,
            estado: f.estado_dinamico || f.estado,
            saldoPendiente: f.saldo_pendiente,
            totalPagado: f.total_pagado,
            cliente_id: f.contacto_id || f.proveedorId || f.contactoId
        }));

        const rawExportIds = allRows.map(c => c.proveedorId || c.contacto_id || c.contactoId).filter(Boolean);
        const exportIds = [...new Set(rawExportIds)];
        let exportMap = {};
        if (exportIds.length > 0) {
            const { data: edata } = await supabase.from('contactos').select('id, nombre').in('id', exportIds);
            if (edata) edata.forEach(c => { exportMap[c.id] = c.nombre; });
        }
        const getExportName = (id) => exportMap[id] || 'Sin Proveedor';

        ExportManager.exportDataToExcel(allDecorated, 'Facturas_Compras', getExportName, btn);
    }
};
