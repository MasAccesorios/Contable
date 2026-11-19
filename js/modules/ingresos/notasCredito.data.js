import { supabase } from '../../core/supabase.js';

export const NotasCreditoData = {
    async anularNotaCredito(id) {
        const numericId = parseInt(id, 10);
        if (isNaN(numericId) || numericId <= 0) {
            throw new Error("Identificador de nota de crédito inválido.");
        }
        const { data, error } = await supabase.rpc('anular_nota_credito', { p_nc_id: numericId });
        if (error) throw new Error(error.message);
        return data;
    },

    async cargarNotasCredito() {
        this.state.isLoading = true;
        try {
            // 1. Cargar notas de crédito con joins de contacto y factura origen
            const [ncResult, pagosResult] = await Promise.all([
                supabase
                    .from('notas_credito')
                    .select('id, numero, fecha, motivo, total, estado, observaciones, factura_id, contacto_id, created_at, contactos(id, nombre, identificacion, telefono, email), facturas(id, numero, total, fecha, estado)')
                    .order('numero', { ascending: false }),
                supabase
                    .from('pagos_ingresos')
                    .select('id, numero, fecha, monto, referencia, factura_id, facturas(id, numero)')
                    .ilike('referencia', 'NC-%')
                    .neq('estado', 'anulado')
            ]);

            if (ncResult.error) {
                console.error('[NotasCreditoData] Error consultando notas_credito:', ncResult.error);
                throw ncResult.error;
            }

            const rawNotas = ncResult.data || [];
            const rawPagos = pagosResult.data || [];

            // Indexar pagos por referencia 'NC-X'
            const pagosPorNC = new Map();
            rawPagos.forEach(p => {
                const ref = String(p.referencia || '').trim().toUpperCase();
                if (!pagosPorNC.has(ref)) {
                    pagosPorNC.set(ref, []);
                }
                pagosPorNC.get(ref).push(p);
            });

            // Decorar cada nota con saldos reales y estado
            const notas = rawNotas.map(n => {
                const total = parseFloat(n.total) || 0;
                const refKey = 'NC-' + String(n.numero || n.id).trim().toUpperCase();
                const pagosAplicados = pagosPorNC.get(refKey) || [];
                const totalAplicado = pagosAplicados.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
                
                const isAnulada = n.estado === 'anulada' || n.estado === 'void';
                let saldoAFavor = 0;
                let estadoReal = 'anulada';

                if (isAnulada) {
                    saldoAFavor = 0;
                    estadoReal = 'anulada';
                } else {
                    saldoAFavor = Math.max(0, Math.round((total - totalAplicado + Number.EPSILON) * 100) / 100);
                    estadoReal = saldoAFavor > 0 ? 'saldo_favor' : 'aplicada';
                }

                const cliente = n.contactos || {
                    id: n.contacto_id,
                    nombre: 'Sin cliente / Contado',
                    identificacion: '',
                    telefono: '',
                    email: ''
                };

                const facturaOrigen = n.facturas || null;

                return {
                    ...n,
                    total,
                    totalAplicado,
                    saldoAFavor,
                    isAnulada,
                    estadoReal,
                    cliente,
                    facturaOrigen,
                    pagosAplicados
                };
            });

            this.state.notas = notas;
            this.calcularKPIsNotas(notas);
            this.aplicarFiltros();
        } catch (err) {
            console.error('[NotasCreditoData] Error general cargando notas:', err);
            this.state.notas = [];
            this.state.notasFiltradas = [];
        } finally {
            this.state.isLoading = false;
        }
    },

    calcularKPIsNotas(notas) {
        let saldoFavorPendiente = 0;
        let totalAplicadasMes = 0;
        let totalEmitidoMes = 0;
        let totalAnuladasMes = 0;
        let conteoSaldoFavor = 0;
        let conteoAplicadas = 0;
        let conteoAnuladas = 0;

        const deudoresConSaldo = new Set();
        const hoy = new Date();
        const mesActual = hoy.getMonth();
        const anioActual = hoy.getFullYear();

        notas.forEach(n => {
            const fechaLimpia = String(n.fecha || '').split('T')[0].split(' ')[0];
            const fechaNota = fechaLimpia ? new Date(fechaLimpia + 'T00:00:00') : new Date();
            const esEsteMes = fechaNota.getMonth() === mesActual && fechaNota.getFullYear() === anioActual;

            if (n.isAnulada) {
                conteoAnuladas++;
                if (esEsteMes) {
                    totalAnuladasMes += n.total;
                }
            } else if (n.saldoAFavor > 0) {
                conteoSaldoFavor++;
                saldoFavorPendiente += n.saldoAFavor;
                if (n.contacto_id) {
                    deudoresConSaldo.add(String(n.contacto_id));
                }
                if (esEsteMes) {
                    totalEmitidoMes += n.total;
                }
            } else {
                conteoAplicadas++;
                if (esEsteMes) {
                    totalAplicadasMes += n.total;
                    totalEmitidoMes += n.total;
                }
            }
        });

        // Si este mes no hubo notas emitidas, tomar el total emitido histórico de las activas para dar contexto
        const totalEmitidoHistorico = notas.filter(n => !n.isAnulada).reduce((s, n) => s + n.total, 0);
        const totalAplicadoHistorico = notas.filter(n => !n.isAnulada).reduce((s, n) => s + (n.totalAplicado || 0), 0);

        this.state.kpis = {
            saldoFavorPendiente: Math.round((saldoFavorPendiente + Number.EPSILON) * 100) / 100,
            totalAplicadasMes: Math.round((totalAplicadasMes + Number.EPSILON) * 100) / 100,
            totalAplicadoHistorico: Math.round((totalAplicadoHistorico + Number.EPSILON) * 100) / 100,
            totalEmitidoMes: Math.round(((totalEmitidoMes > 0 ? totalEmitidoMes : totalEmitidoHistorico) + Number.EPSILON) * 100) / 100,
            totalAnuladasMes: Math.round((totalAnuladasMes + Number.EPSILON) * 100) / 100,
            totalEmitidoHistorico: Math.round((totalEmitidoHistorico + Number.EPSILON) * 100) / 100,
            conteoTotal: notas.length,
            conteoSaldoFavor,
            conteoAplicadas,
            conteoAnuladas,
            clientesConSaldo: deudoresConSaldo.size
        };
    },

    aplicarFiltros() {
        const { notas, selectedTab, searchQuery } = this.state;
        const q = (searchQuery || '').toLowerCase().trim();

        let filtradas = notas.filter(n => {
            // 1. Filtro por Pestaña
            if (selectedTab === 'saldo_favor' && n.estadoReal !== 'saldo_favor') return false;
            if (selectedTab === 'aplicadas' && n.estadoReal !== 'aplicada') return false;
            if (selectedTab === 'anuladas' && n.estadoReal !== 'anulada') return false;

            // 2. Búsqueda Textual
            if (q) {
                const matchNum = String(n.numero || n.id || '').toLowerCase().includes(q);
                const matchCli = String(n.cliente?.nombre || '').toLowerCase().includes(q);
                const matchNit = String(n.cliente?.identificacion || '').toLowerCase().includes(q);
                const matchFac = String(n.facturaOrigen?.numero || n.factura_id || '').toLowerCase().includes(q);
                const matchTotal = String(n.total || '').includes(q);
                const matchSaldo = String(n.saldoAFavor || '').includes(q);
                const matchFecha = String(n.fecha || '').toLowerCase().includes(q);
                const matchMotivo = String(n.motivo || '').toLowerCase().includes(q);

                if (!matchNum && !matchCli && !matchNit && !matchFac && !matchTotal && !matchSaldo && !matchFecha && !matchMotivo) {
                    return false;
                }
            }

            return true;
        });

        this.state.notasFiltradas = filtradas;
        this.state.totalItems = filtradas.length;
    },

    async cargarDetalleNotaDrawer(notaId) {
        const numericId = parseInt(notaId, 10);
        if (isNaN(numericId) || numericId <= 0) return null;
        try {
            const [detallesRes, notaRes] = await Promise.all([
                supabase
                    .from('nota_credito_detalles')
                    .select('id, nota_credito_id, producto_id, cantidad, precio_unitario, subtotal, productos(id, nombre, sku)')
                    .eq('nota_credito_id', numericId),
                supabase
                    .from('notas_credito')
                    .select('*, contactos(*), facturas(*)')
                    .eq('id', numericId)
                    .single()
            ]);

            if (notaRes.error) throw notaRes.error;

            const nota = notaRes.data;
            const detalles = detallesRes.data || [];

            // Consultar cruces en pagos_ingresos
            let cruces = [];
            const refNC = 'NC-' + String(nota.numero || nota.id).trim();
            if (refNC !== 'NC-') {
                const { data: pagos } = await supabase
                    .from('pagos_ingresos')
                    .select('id, numero, fecha, monto, factura_id, cuenta_id, facturas(id, numero), cuentas_bancarias(nombre)')
                    .ilike('referencia', refNC)
                    .neq('estado', 'anulado');
                cruces = pagos || [];
            }

            const sumaCruces = cruces.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
            const saldoAFavor = nota.estado === 'anulada' ? 0 : Math.max(0, Number(nota.total || 0) - sumaCruces);

            return {
                nota: {
                    ...nota,
                    saldoAFavor,
                    totalAplicado: sumaCruces
                },
                detalles,
                facturaOrigen: nota.facturas || null,
                cliente: nota.contactos || null,
                cruces
            };
        } catch (err) {
            console.error('[NotasCreditoData] Error en cargarDetalleNotaDrawer:', err);
            return null;
        }
    }
};
