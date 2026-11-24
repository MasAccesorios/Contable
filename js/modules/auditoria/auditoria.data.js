// js/modules/auditoria/auditoria.data.js
// Capa de Datos, Motor de Integridad Contable y Catálogo de Validaciones 360°

export const AuditoriaData = {
    _supabase: null,

    async getSupabase() {
        if (this._supabase) return this._supabase;
        if (typeof window !== 'undefined' && window.supabase) return window.supabase;
        try {
            const mod = await import('../../core/supabase.js');
            this._supabase = mod.supabase;
            return this._supabase;
        } catch {
            return null;
        }
    },

    /**
     * Catálogo Central de Chequeos de Integridad
     * 16 validaciones exhaustivas organizadas en 5 dominios contables y operacionales
     */
    CATALOGO_CHEQUEOS: [
        // ─────────────────────────────────────────────────────────────────────
        // 1. VENTAS & FACTURACIÓN
        // ─────────────────────────────────────────────────────────────────────
        {
            id: 'VTA-001',
            category: 'ventas',
            title: 'Facturas con inconsistencia matemática (saldo original > total)',
            description: 'Verifica facturas donde el saldo inicial registrado excede el total facturado.',
            severity: 'critical',
            rpcName: 'run_audit_check_1',
            columns: ['id', 'numero', 'total', 'saldo_original'],
            entityType: 'factura'
        },
        {
            id: 'VTA-002',
            category: 'ventas',
            title: 'Facturas cerradas/pagadas pero con pagos insuficientes',
            description: 'Identifica facturas marcadas como pagadas cuya sumatoria de pagos activos no cubre el valor total.',
            severity: 'critical',
            rpcName: 'run_audit_check_2',
            columns: ['id', 'numero', 'estado', 'total_base', 'suma_pagos', 'faltante'],
            entityType: 'factura'
        },
        {
            id: 'VTA-003',
            category: 'ventas',
            title: 'Discrepancia entre total de factura y suma de renglones',
            description: 'Detecta facturas donde el total difiere de la suma de subtotales de sus ítems (factura_detalles).',
            severity: 'critical',
            rpcName: 'run_audit_check_diff_factura_detalles',
            columns: ['id', 'numero', 'fecha', 'total', 'suma_detalles', 'diferencia'],
            entityType: 'factura'
        },
        {
            id: 'VTA-004',
            category: 'ventas',
            title: 'Facturas activas huérfanas de ítems',
            description: 'Facturas con total mayor a cero que no tienen ningún producto o servicio asociado.',
            severity: 'warning',
            columns: ['id', 'numero', 'fecha', 'total', 'estado'],
            entityType: 'factura',
            customRunner: async (supabase) => {
                const { data, error } = await supabase
                    .from('facturas')
                    .select('id, numero, fecha, total, estado')
                    .not('estado', 'in', '("anulada","void")')
                    .gt('total', 0);
                if (error) throw error;
                // Verificar detalles
                const facturasSinItems = [];
                for (const f of (data || []).slice(0, 500)) {
                    const { count, error: errC } = await supabase
                        .from('factura_detalles')
                        .select('id', { count: 'exact', head: true })
                        .eq('factura_id', f.id);
                    if (!errC && count === 0) {
                        facturasSinItems.push(f);
                    }
                }
                if (facturasSinItems.length === 0) return { success: true, count: 0, data: [] };
                return {
                    success: false,
                    count: facturasSinItems.length,
                    columns: ['id', 'numero', 'fecha', 'total', 'estado'],
                    data: facturasSinItems
                };
            }
        },
        {
            id: 'VTA-005',
            category: 'ventas',
            title: 'Facturas convertidas de cotización con número inconsistente',
            description: 'Audita que las facturas originadas en cotización preserven el número asignado (excluyendo caso histórico #6070).',
            severity: 'warning',
            rpcName: 'run_audit_check_10',
            columns: ['factura_id', 'factura_numero', 'cotizacion_id', 'cotizacion_numero'],
            entityType: 'factura'
        },

        // ─────────────────────────────────────────────────────────────────────
        // 2. CARTERA & CONTACTOS
        // ─────────────────────────────────────────────────────────────────────
        {
            id: 'CAR-001',
            category: 'cartera',
            title: 'Cuadre Global de Cartera (CXC / CXP vs sumatoria analítica)',
            description: 'Cruza los totales del dashboard de cartera con la sumatoria matemática factura por factura.',
            severity: 'critical',
            customRunner: async (supabase) => {
                const { data: sumasManuales, error: errManual } = await supabase.rpc('run_audit_check_6_manual_sum');
                if (errManual) throw errManual;
                const { data: carteraKpis, error: errCartera } = await supabase.rpc('get_dashboard_cartera_kpis');
                if (errCartera) throw errCartera;

                const sumRpcCxc = carteraKpis ? parseFloat(carteraKpis.cxc_total || 0) : 0;
                const sumRpcCxp = carteraKpis ? parseFloat(carteraKpis.cxp_total || 0) : 0;
                const manualCxc = parseFloat(sumasManuales?.cxc || 0);
                const manualCxp = parseFloat(sumasManuales?.cxp || 0);

                const diffCxc = Math.abs(sumRpcCxc - manualCxc);
                const diffCxp = Math.abs(sumRpcCxp - manualCxp);

                const dataFails = [];
                if (diffCxc > 0.05) {
                    dataFails.push({ tipo: 'Cartera Clientes (CXC)', total_rpc: sumRpcCxc.toFixed(2), total_manual: manualCxc.toFixed(2), diferencia: diffCxc.toFixed(2) });
                }
                if (diffCxp > 0.05) {
                    dataFails.push({ tipo: 'Cartera Proveedores (CXP)', total_rpc: sumRpcCxp.toFixed(2), total_manual: manualCxp.toFixed(2), diferencia: diffCxp.toFixed(2) });
                }

                if (dataFails.length > 0) {
                    return {
                        success: false,
                        count: dataFails.length,
                        columns: ['tipo', 'total_rpc', 'total_manual', 'diferencia'],
                        data: dataFails
                    };
                }
                return { success: true, count: 0, data: [] };
            }
        },
        {
            id: 'CAR-002',
            category: 'cartera',
            title: 'Facturas huérfanas de contacto (cliente inexistente)',
            description: 'Detecta facturas que apuntan a un contacto_id que fue eliminado o no existe en la tabla contactos.',
            severity: 'critical',
            rpcName: 'run_audit_check_5',
            columns: ['factura_id', 'factura_numero', 'contacto_id_huerfano', 'estado'],
            entityType: 'factura'
        },
        {
            id: 'CAR-003',
            category: 'cartera',
            title: 'Contactos con identificación duplicada o inválida (NIT / Cédula)',
            description: 'Identifica contactos activos que comparten el mismo número de documento o tienen valores "null" / vacíos.',
            severity: 'warning',
            rpcName: 'run_audit_check_contactos_duplicados',
            columns: ['identificacion', 'total_registros', 'ids_afectados', 'nombres_asociados'],
            entityType: 'contacto'
        },

        // ─────────────────────────────────────────────────────────────────────
        // 3. INVENTARIO & LOTES FIFO
        // ─────────────────────────────────────────────────────────────────────
        {
            id: 'INV-001',
            category: 'inventario',
            title: 'Productos con sobreventa (suma de lotes FIFO negativa)',
            description: 'Verifica si existen productos cuyo stock global sumado de lotes se encuentra en números rojos.',
            severity: 'critical',
            rpcName: 'run_audit_check_7',
            columns: ['producto_id', 'sku', 'nombre', 'suma_lotes'],
            entityType: 'producto'
        },
        {
            id: 'INV-002',
            category: 'inventario',
            title: 'Lotes FIFO físicamente inconsistentes (actual > inicial o costo < 0)',
            description: 'Detecta lotes con stock actual superior a la cantidad con la que ingresaron o con costos negativos.',
            severity: 'warning',
            rpcName: 'run_audit_check_lotes_inconsistentes',
            columns: ['lote_id', 'producto_id', 'sku', 'nombre', 'cantidad_inicial', 'cantidad_actual', 'costo_unitario', 'fecha_ingreso'],
            entityType: 'producto'
        },
        {
            id: 'INV-003',
            category: 'inventario',
            title: 'Alerta de Margen Negativo (Venta por debajo del costo base)',
            description: 'Detecta productos activos cuyo precio de venta configurado es inferior a su costo de adquisición.',
            severity: 'warning',
            rpcName: 'run_audit_check_productos_margen_negativo',
            columns: ['producto_id', 'sku', 'nombre', 'costo_base', 'precio_venta', 'perdida_unitaria', 'margen_porcentaje'],
            entityType: 'producto'
        },
        {
            id: 'INV-004',
            category: 'inventario',
            title: 'Reconciliación 360° de Movimientos de Inventario vs Checkpoints',
            description: 'Cruza el stock actual contra el historial de deltas de ventas y ajustes desde el último conteo físico.',
            severity: 'warning',
            isSpecialUi: true,
            columns: ['sku', 'nombre', 'checkpoint', 'fecha_checkpoint', 'vendido_despues', 'esperado', 'actual', 'discrepancia'],
            customRunner: async (supabase) => {
                let data = [];
                let from = 0;
                const PAGE_SIZE = 1000;
                while (true) {
                    const to = from + PAGE_SIZE - 1;
                    const { data: pageData, error } = await supabase.rpc('get_reconciliacion_inventario').range(from, to);
                    if (error) throw error;
                    if (pageData && pageData.length > 0) {
                        data = data.concat(pageData);
                    }
                    if (!pageData || pageData.length < PAGE_SIZE) break;
                    from += PAGE_SIZE;
                }
                const discrepancias = data.filter(d => d.tiene_checkpoint && Math.abs(d.discrepancia) > 0.01);
                return {
                    success: discrepancias.length === 0,
                    count: discrepancias.length,
                    columns: ['sku', 'nombre', 'checkpoint', 'fecha_checkpoint', 'vendido_despues', 'esperado', 'actual', 'discrepancia'],
                    data: discrepancias,
                    meta: {
                        totalVerificados: data.filter(d => d.tiene_checkpoint && Math.abs(d.discrepancia) <= 0.01).length,
                        sinCheckpoint: data.filter(d => !d.tiene_checkpoint).length,
                        rawList: data
                    }
                };
            }
        },

        // ─────────────────────────────────────────────────────────────────────
        // 4. BANCOS & TESORERÍA
        // ─────────────────────────────────────────────────────────────────────
        {
            id: 'BNK-001',
            category: 'bancos',
            title: 'Pagos/Ingresos huérfanos (factura referenciada no existe)',
            description: 'Movimientos financieros registrados como cobro de factura cuyo registro en facturas fue eliminado.',
            severity: 'critical',
            rpcName: 'run_audit_check_4',
            columns: ['pago_id', 'pago_numero', 'factura_id_huerfano', 'monto', 'estado'],
            entityType: 'pago'
        },
        {
            id: 'BNK-002',
            category: 'bancos',
            title: 'Pagos/Ingresos sin cuenta bancaria asignada',
            description: 'Transacciones financieras activas que no están asociadas a ninguna cuenta bancaria o caja.',
            severity: 'warning',
            rpcName: 'run_audit_check_pagos_sin_cuenta',
            columns: ['pago_id', 'pago_numero', 'fecha', 'monto', 'tipo', 'factura_id', 'factura_numero'],
            entityType: 'pago'
        },
        {
            id: 'BNK-003',
            category: 'bancos',
            title: 'Alerta de Pagos Duplicados Sospechosos',
            description: 'Detecta transacciones con el mismo monto, misma factura, misma cuenta y misma fecha.',
            severity: 'warning',
            rpcName: 'run_audit_check_pagos_duplicados',
            columns: ['factura_id', 'factura_numero', 'monto', 'fecha', 'cuenta_bancaria', 'repeticiones', 'pago_ids'],
            entityType: 'pago'
        },

        // ─────────────────────────────────────────────────────────────────────
        // 5. SEGURIDAD & INFRAESTRUCTURA
        // ─────────────────────────────────────────────────────────────────────
        {
            id: 'SEC-001',
            category: 'seguridad',
            title: 'Seguridad de infraestructura: tablas sin RLS o sin políticas',
            description: 'Audita el catálogo de PostgreSQL para verificar que no existan tablas públicas expuestas sin protección.',
            severity: 'critical',
            rpcName: 'run_audit_check_8',
            columns: ['tabla', 'problema'],
            entityType: 'sistema'
        }
    ],

    /**
     * Calcula KPIs ejecutivos consolidados y Health Score (0-100%)
     */
    calcularKpis(checks = []) {
        if (!Array.isArray(checks) || checks.length === 0) {
            return {
                healthScore: 100,
                totalChecks: 0,
                passedChecks: 0,
                failedChecks: 0,
                criticalDiscrepancies: 0,
                warningDiscrepancies: 0,
                totalDiscrepancies: 0,
                categoryCounts: { todas: 0, ventas: 0, cartera: 0, inventario: 0, bancos: 0, seguridad: 0, con_errores: 0 }
            };
        }

        let passedChecks = 0;
        let failedChecks = 0;
        let pendingChecks = 0;
        let criticalDiscrepancies = 0;
        let warningDiscrepancies = 0;

        const categoryCounts = {
            todas: checks.length,
            ventas: 0,
            cartera: 0,
            inventario: 0,
            bancos: 0,
            seguridad: 0,
            con_errores: 0
        };

        for (const c of checks) {
            if (c.category && categoryCounts[c.category] !== undefined) {
                categoryCounts[c.category]++;
            }

            const hasError = Boolean(c.error || (c.result && !c.result.success));
            const isPending = !c.result && !c.error;

            if (hasError) {
                failedChecks++;
                categoryCounts.con_errores++;
                const count = Number(c.result?.count || 1);
                if (c.severity === 'critical') {
                    criticalDiscrepancies += count;
                } else {
                    warningDiscrepancies += count;
                }
            } else if (c.result && c.result.success) {
                passedChecks++;
            } else if (isPending) {
                pendingChecks++;
            }
        }

        // Ponderación de Health Score:
        // Base 100%. Cada fallo crítico descuenta peso alto, advertencias peso medio.
        const totalEvaluated = passedChecks + failedChecks;
        let healthScore = 100;
        if (totalEvaluated > 0) {
            const penalizacionCritica = Math.min(60, criticalDiscrepancies * 4 + (failedChecks * 3));
            const penalizacionWarning = Math.min(30, warningDiscrepancies * 0.5);
            healthScore = Math.max(0, Math.round(100 - penalizacionCritica - penalizacionWarning));
        }

        return {
            healthScore,
            totalChecks: checks.length,
            passedChecks,
            failedChecks,
            pendingChecks,
            criticalDiscrepancies,
            warningDiscrepancies,
            totalDiscrepancies: criticalDiscrepancies + warningDiscrepancies,
            categoryCounts
        };
    },

    /**
     * Filtra los chequeos por pestaña y texto de búsqueda reactivo
     */
    filtrarChequeos(checks = [], tab = 'todas', query = '') {
        if (!Array.isArray(checks)) return [];
        const cleanQuery = (query || '').trim().toLowerCase();

        return checks.filter(c => {
            // Filtro por pestaña
            if (tab === 'con_errores') {
                const hasError = c.error || (c.result && !c.result.success);
                if (!hasError) return false;
            } else if (tab !== 'todas' && c.category !== tab) {
                return false;
            }

            // Filtro por búsqueda de texto
            if (!cleanQuery) return true;
            const searchIndex = `${c.id} ${c.title} ${c.description || ''} ${c.category || ''}`.toLowerCase();
            return searchIndex.includes(cleanQuery);
        });
    },

    /**
     * Mapea el estado de la auditoría para exportar a Excel / CSV (Blindado contra CWE-1236)
     */
    mapearParaExcel(checks = []) {
        if (!Array.isArray(checks)) return [];
        return checks.map(c => {
            const sanitize = val => {
                if (val === null || val === undefined) return '';
                const str = String(val);
                if (/^[=+\-@]/.test(str)) return "'" + str;
                return str;
            };

            const isSuccess = c.result && c.result.success;
            const hasError = c.error || (c.result && !c.result.success);

            return {
                'Código': sanitize(c.id),
                'Chequeo': sanitize(c.title),
                'Categoría': sanitize(c.category),
                'Severidad': sanitize(c.severity),
                'Estado': isSuccess ? 'Aprobado' : (hasError ? 'Discrepancia Detectada' : 'Pendiente'),
                'Discrepancias': c.result?.count || (hasError ? 1 : 0),
                'Descripción': sanitize(c.description || '')
            };
        });
    },

    /**
     * Genera un informe Markdown estructurado para copiar al portapapeles
     */
    generarInformeMarkdown(checks = []) {
        const kpis = this.calcularKpis(checks);
        const fecha = new Date().toLocaleString('es-CO');

        let md = `# Informe de Auditoría de Integridad Contable 360°\n`;
        md += `**Fecha de Ejecución:** ${fecha}\n`;
        md += `**Health Score:** ${kpis.healthScore}% | **Chequeos:** ${kpis.passedChecks}/${kpis.totalChecks} aprobados | **Discrepancias Críticas:** ${kpis.criticalDiscrepancies}\n\n`;
        md += `| Código | Chequeo | Severidad | Estado | Discrepancias |\n`;
        md += `| :--- | :--- | :---: | :---: | :---: |\n`;

        for (const c of checks) {
            const estado = c.result?.success ? '✅ Aprobado' : (c.error ? '⚠️ Error Ejecución' : `❌ ${c.result?.count || 1} discrepancia(s)`);
            const count = c.result?.count || (c.result?.success ? 0 : 1);
            md += `| \`${c.id}\` | ${c.title} | ${c.severity.toUpperCase()} | ${estado} | ${count} |\n`;
        }

        const conDiscrepancia = checks.filter(c => c.result && !c.result.success);
        if (conDiscrepancia.length > 0) {
            md += `\n## Resumen de Problemas Detectados\n`;
            for (const c of conDiscrepancia) {
                md += `\n### [${c.id}] ${c.title}\n`;
                md += `- **Severidad:** ${c.severity}\n`;
                md += `- **Discrepancias:** ${c.result.count}\n`;
                if (c.result.data && c.result.data.length > 0) {
                    md += `- **Muestra de registros afectados:** ${c.result.data.slice(0, 5).map(d => JSON.stringify(d)).join('; ')}\n`;
                }
            }
        }

        return md;
    },

    /**
     * Ejecuta un chequeo individual
     */
    async ejecutarChequeo(checkDefinition) {
        const supabase = await this.getSupabase();
        if (!supabase) throw new Error('Cliente Supabase no disponible');

        if (checkDefinition.customRunner) {
            return await checkDefinition.customRunner(supabase);
        }

        if (checkDefinition.rpcName) {
            const { data, error } = await supabase.rpc(checkDefinition.rpcName);
            if (error) throw error;
            return data;
        }

        return { success: true, count: 0, data: [] };
    }
};
