import DB, { getLocalDate } from '../../core/db.js';
import { supabase } from '../../core/supabase.js';
import { calcularDiasVencida } from '../../shared/carteraUtils.js';

export const CarteraData = {
    async cargarDatosCartera() {
        this.state.isLoading = true;
        try {
            const [contactosResult, carteraResult] = await Promise.all([
                DB.getAll('contactos').catch(err => {
                    console.error('[CarteraData] Error cargando contactos:', err);
                    return [];
                }),
                supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxc' })
            ]);

            const contactos = contactosResult || [];
            this.state.contactos = contactos;

            const contactosMap = new Map();
            contactos.forEach(c => {
                if (c && c.id !== undefined) {
                    contactosMap.set(String(c.id), c);
                }
            });
            this.state.contactosMap = contactosMap;

            if (carteraResult.error) {
                console.error('[CarteraData] Error RPC get_cartera_con_saldos:', carteraResult.error);
                throw carteraResult.error;
            }

            const rawFacturas = carteraResult.data || [];

            // Decorar cada factura con cliente, mora y porcentajes
            const facturas = rawFacturas.map(f => {
                const total = parseFloat(f.total) || 0;
                const saldo = parseFloat(f.saldo !== undefined ? f.saldo : total);
                const totalPagadoVal = f.total_pagado !== undefined ? f.total_pagado : f.totalPagado;
                const cobrado = totalPagadoVal !== undefined ? parseFloat(totalPagadoVal) : Math.max(0, total - saldo);
                const clienteId = f.contacto_id || f.clienteId;
                const rawCliente = contactosMap.get(String(clienteId));
                const cliente = rawCliente ? {
                    ...rawCliente,
                    identificacion: rawCliente.identificacion || rawCliente.nit || f.cliente_nit || '',
                    telefono: rawCliente.telefono || rawCliente.celular || ''
                } : {
                    id: clienteId,
                    nombre: f.cliente_nombre || 'Cliente General / Contado',
                    identificacion: f.cliente_nit || '',
                    telefono: ''
                };

                const fechaVenc = (f.vencimiento && f.vencimiento !== 'N/A' && String(f.vencimiento).trim() !== '') 
                    ? String(f.vencimiento).split('T')[0] 
                    : (f.fecha ? String(f.fecha).split('T')[0] : '');

                const diasVencida = calcularDiasVencida(fechaVenc);

                let tramoMora = 'al_dia';
                if (diasVencida > 60) {
                    tramoMora = 'mas_60';
                } else if (diasVencida >= 31) {
                    tramoMora = '31_60';
                } else if (diasVencida >= 1) {
                    tramoMora = '1_30';
                }

                const porcentajeCobrado = total > 0 ? Math.min(100, Math.round((cobrado / total) * 100)) : 100;

                return {
                    ...f,
                    total,
                    saldo,
                    cobrado,
                    clienteId,
                    cliente,
                    vencimientoReal: fechaVenc,
                    diasVencida,
                    tramoMora,
                    porcentajeCobrado
                };
            });

            this.state.facturas = facturas;
            this.calcularKPIsCartera(facturas);
            this.state.clientesAgrupados = this.agruparCarteraPorCliente(facturas);
            this.aplicarFiltros();
        } catch (err) {
            console.error('[CarteraData] Error general cargando cartera:', err);
            this.state.facturas = [];
            this.state.clientesAgrupados = [];
        } finally {
            this.state.isLoading = false;
        }
    },

    calcularKPIsCartera(facturas) {
        let totalCartera = 0;
        let totalVigente = 0;
        let mora1a30 = 0;
        let mora31a60 = 0;
        let mora60Plus = 0;

        let conteoVigentes = 0;
        let conteo1a30 = 0;
        let conteo31a60 = 0;
        let conteo60Plus = 0;

        const deudoresMap = new Map();

        facturas.forEach(f => {
            const saldo = f.saldo || 0;
            totalCartera += saldo;

            if (f.diasVencida <= 0) {
                totalVigente += saldo;
                conteoVigentes++;
            } else if (f.diasVencida <= 30) {
                mora1a30 += saldo;
                conteo1a30++;
            } else if (f.diasVencida <= 60) {
                mora31a60 += saldo;
                conteo31a60++;
            } else {
                mora60Plus += saldo;
                conteo60Plus++;
            }

            const cId = String(f.clienteId || 'sin_id');
            const acumulado = (deudoresMap.get(cId) || 0) + saldo;
            deudoresMap.set(cId, acumulado);
        });

        // Mora crítica: Facturas con mora > 30 días
        const moraCritica = mora31a60 + mora60Plus;
        const totalVencida = mora1a30 + moraCritica;

        const porcentajeVigente = totalCartera > 0 ? Math.round((totalVigente / totalCartera) * 100) : 100;
        const porcentajeMoraCritica = totalCartera > 0 ? Math.round((moraCritica / totalCartera) * 100) : 0;

        // Top Deudor
        let topClienteId = null;
        let maxSaldo = 0;
        deudoresMap.forEach((saldo, cId) => {
            if (saldo > maxSaldo) {
                maxSaldo = saldo;
                topClienteId = cId;
            }
        });

        const topCliente = topClienteId ? (this.state.contactosMap?.get(topClienteId) || null) : null;
        const concentracionTop = totalCartera > 0 ? Math.round((maxSaldo / totalCartera) * 100) : 0;

        this.state.kpis = {
            totalCartera: Math.round((totalCartera + Number.EPSILON) * 100) / 100,
            totalVigente: Math.round((totalVigente + Number.EPSILON) * 100) / 100,
            totalVencida: Math.round((totalVencida + Number.EPSILON) * 100) / 100,
            mora1a30: Math.round((mora1a30 + Number.EPSILON) * 100) / 100,
            mora31a60: Math.round((mora31a60 + Number.EPSILON) * 100) / 100,
            mora60Plus: Math.round((mora60Plus + Number.EPSILON) * 100) / 100,
            moraCritica: Math.round((moraCritica + Number.EPSILON) * 100) / 100,
            porcentajeVigente,
            porcentajeMoraCritica,
            conteoTotal: facturas.length,
            conteoVigentes,
            conteo1a30,
            conteo31a60,
            conteo60Plus,
            totalDeudores: deudoresMap.size,
            topDeudor: topCliente ? {
                nombre: topCliente.nombre,
                saldo: maxSaldo,
                concentracion: concentracionTop
            } : null
        };
    },

    agruparCarteraPorCliente(facturas) {
        const grupos = new Map();

        facturas.forEach(f => {
            const cId = String(f.clienteId || 'sin_id');
            if (!grupos.has(cId)) {
                grupos.set(cId, {
                    id: f.clienteId,
                    cliente: f.cliente,
                    nombre: f.cliente?.nombre || 'Cliente General',
                    identificacion: f.cliente?.identificacion || '',
                    telefono: f.cliente?.telefono || '',
                    totalSaldo: 0,
                    totalFacturado: 0,
                    facturas: [],
                    maxDiasMora: 0,
                    facturasVencidasCount: 0
                });
            }

            const grupo = grupos.get(cId);
            grupo.totalSaldo += f.saldo;
            grupo.totalFacturado += f.total;
            grupo.facturas.push(f);
            if (f.diasVencida > grupo.maxDiasMora) {
                grupo.maxDiasMora = f.diasVencida;
            }
            if (f.diasVencida >= 1) {
                grupo.facturasVencidasCount++;
            }
        });

        const lista = Array.from(grupos.values()).map(g => ({
            ...g,
            totalSaldo: Math.round((g.totalSaldo + Number.EPSILON) * 100) / 100,
            totalFacturado: Math.round((g.totalFacturado + Number.EPSILON) * 100) / 100
        }));

        // Ordenar por mayor saldo adeudado
        return lista.sort((a, b) => b.totalSaldo - a.totalSaldo);
    },

    aplicarFiltros() {
        const { facturas, selectedTab, searchQuery, selectedClienteId } = this.state;
        const q = (searchQuery || '').toLowerCase().trim();

        let filtradas = facturas.filter(f => {
            // 1. Filtro por Pestaña de Mora
            if (selectedTab === 'vigentes' && f.diasVencida >= 1) return false;
            if (selectedTab === 'mora_1_30' && (f.diasVencida < 1 || f.diasVencida > 30)) return false;
            if (selectedTab === 'mora_31_60' && (f.diasVencida < 31 || f.diasVencida > 60)) return false;
            if (selectedTab === 'mora_mas_60' && f.diasVencida <= 60) return false;

            // 2. Filtro por Cliente Específico
            if (selectedClienteId && selectedClienteId !== 'todos') {
                if (String(f.clienteId) !== String(selectedClienteId)) return false;
            }

            // 3. Búsqueda Textual
            if (q) {
                const matchNum = String(f.numero || f.id || '').toLowerCase().includes(q);
                const matchCli = String(f.cliente?.nombre || '').toLowerCase().includes(q);
                const matchNit = String(f.cliente?.identificacion || '').toLowerCase().includes(q);
                const matchSaldo = String(f.saldo || '').includes(q);
                const matchFecha = String(f.fecha || '').toLowerCase().includes(q);
                const matchVenc = String(f.vencimientoReal || '').toLowerCase().includes(q);
                if (!matchNum && !matchCli && !matchNit && !matchSaldo && !matchFecha && !matchVenc) {
                    return false;
                }
            }

            return true;
        });

        this.state.facturasFiltradas = filtradas;
        this.state.totalItems = filtradas.length;

        // Calcular total filtrado dinámico
        const saldoFiltrado = filtradas.reduce((sum, f) => sum + (f.saldo || 0), 0);
        this.state.saldoFiltrado = Math.round((saldoFiltrado + Number.EPSILON) * 100) / 100;

        // Actualizar clientes agrupados filtrados
        this.state.clientesFiltrados = this.agruparCarteraPorCliente(filtradas);
    },

    async cargarAbonosFactura(facturaId) {
        if (!facturaId) return [];
        try {
            const { data, error } = await supabase
                .from('pagos_ingresos')
                .select('id, numero, fecha, monto, metodo_pago, cuenta_id, observaciones, estado, cuentas_bancarias(nombre)')
                .eq('factura_id', facturaId)
                .neq('estado', 'anulado')
                .order('fecha', { ascending: false });

            if (error) {
                console.error('[CarteraData] Error consultando abonos de factura:', error);
                return [];
            }
            return data || [];
        } catch (err) {
            console.error('[CarteraData] Excepción consultando abonos:', err);
            return [];
        }
    }
};
