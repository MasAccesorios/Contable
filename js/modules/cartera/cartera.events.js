import { AbonoModal } from '../../shared/abonoModal.js';
import { PrintManager } from '../../shared/printManager.js';
import { CoreActions } from '../../shared/crud.js';
import { getLocalDate } from '../../core/db.js';

export const CarteraEvents = {
    bindStaticEvents() {
        if (!this.element) return;

        // 1. Búsqueda con Debounce
        const searchInput = this.element.querySelector('#search-cartera');
        if (searchInput) {
            let debounceTimer = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.state.searchQuery = e.target.value;
                    this.state.currentPage = 1;
                    this.aplicarFiltros();
                    this.render();
                }, 250);
            });
        }

        // 2. Tabs de Segmented Control
        this.element.querySelectorAll('.payment-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                if (tab && tab !== this.state.selectedTab) {
                    this.state.selectedTab = tab;
                    this.state.currentPage = 1;

                    this.element.querySelectorAll('.payment-tab-btn').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');

                    this.aplicarFiltros();
                    this.render();
                }
            });
        });

        // 3. Filtro por Cliente Específico
        const clienteSelect = this.element.querySelector('#filter-cliente-select');
        if (clienteSelect) {
            clienteSelect.addEventListener('change', (e) => {
                this.state.selectedClienteId = e.target.value;
                this.state.currentPage = 1;
                this.aplicarFiltros();
                this.render();
            });
        }

        // 4. Toggle de Vistas: Facturas vs Clientes vs Analítica
        const btnFacturas = this.element.querySelector('#btn-view-facturas');
        const btnClientes = this.element.querySelector('#btn-view-clientes');
        const btnAnalitica = this.element.querySelector('#btn-view-analitica');

        if (btnFacturas) {
            btnFacturas.onclick = () => {
                if (this.state.view !== 'facturas') {
                    this.state.view = 'facturas';
                    this.renderLayoutActual();
                }
            };
        }
        if (btnClientes) {
            btnClientes.onclick = () => {
                if (this.state.view !== 'clientes') {
                    this.state.view = 'clientes';
                    this.renderLayoutActual();
                }
            };
        }
        if (btnAnalitica) {
            btnAnalitica.onclick = () => {
                if (this.state.view !== 'analitica') {
                    this.state.view = 'analitica';
                    this.renderLayoutActual();
                }
            };
        }

        // 5. Botón Refrescar
        const btnRefresh = this.element.querySelector('#btn-refresh-cartera');
        if (btnRefresh) {
            btnRefresh.onclick = async () => {
                const icon = btnRefresh.querySelector('i');
                if (icon) icon.classList.add('spin-animation');
                await this.cargarDatosCartera();
                this.renderLayoutActual();
                if (icon) icon.classList.remove('spin-animation');
            };
        }

        // 6. Botón Exportar Excel
        const btnExportar = this.element.querySelector('#btn-exportar-cartera');
        if (btnExportar) {
            btnExportar.onclick = () => this.exportarExcel();
        }

        // 7. Cierre del Drawer
        const btnClose = this.element.querySelector('#btn-cartera-drawer-close');
        const btnCloseBottom = this.element.querySelector('#btn-cartera-drawer-close-bottom');
        const backdrop = this.element.querySelector('#cartera-drawer-backdrop');

        if (btnClose) btnClose.onclick = () => this.cerrarDrawer();
        if (btnCloseBottom) btnCloseBottom.onclick = () => this.cerrarDrawer();
        if (backdrop) backdrop.onclick = () => this.cerrarDrawer();

        if (!this._onKeyDown) {
            this._onKeyDown = (e) => {
                if (e.key === 'Escape' && this.state.activeDrawerFacturaId) {
                    this.cerrarDrawer();
                }
            };
        }
        document.removeEventListener('keydown', this._onKeyDown);
        document.addEventListener('keydown', this._onKeyDown);
    },

    bindDynamicEvents(container) {
        if (!container) return;

        // 1. Clic en Fila de Factura -> Abrir Drawer
        container.querySelectorAll('.row-factura').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
                const id = row.dataset.id;
                if (id) this.mostrarDrawer(id);
            });
        });

        // 2. Botón Abonar Fila
        container.querySelectorAll('.btn-abonar-fila').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const facturaId = btn.dataset.id;
                const saldo = parseFloat(btn.dataset.saldo) || 0;
                this.abrirModalAbono(facturaId, saldo);
            });
        });

        // 3. Botón WhatsApp Fila (Por Factura)
        container.querySelectorAll('.btn-wpp-fila').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const facturaId = btn.dataset.id;
                const f = this.state.facturas.find(x => String(x.id) === String(facturaId));
                if (f) this.enviarCobroWhatsAppFactura(f);
            });
        });

        // 4. Botón Imprimir Estado de Cuenta
        container.querySelectorAll('.btn-estado-fila').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const clienteId = btn.dataset.clienteId;
                if (clienteId) PrintManager.printEstadoCuenta(clienteId);
            });
        });

        // 5. Clic en Fila de Cliente (Vista Clientes)
        container.querySelectorAll('.btn-wpp-cliente').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cid = btn.dataset.clienteId;
                const clienteData = this.state.clientesAgrupados.find(c => String(c.id) === String(cid));
                if (clienteData) this.enviarCobroWhatsAppCliente(clienteData);
            });
        });

        container.querySelectorAll('.btn-print-cliente').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cid = btn.dataset.clienteId;
                if (cid) PrintManager.printEstadoCuenta(cid);
            });
        });

        container.querySelectorAll('.btn-detalle-cliente').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cid = btn.dataset.clienteId;
                const clienteData = this.state.clientesAgrupados.find(c => String(c.id) === String(cid));
                if (clienteData && clienteData.facturas.length > 0) {
                    this.mostrarDrawer(clienteData.facturas[0].id);
                }
            });
        });

        // 6. Paginador
        const selectLimit = container.querySelector('#select-items-per-page');
        if (selectLimit) {
            selectLimit.addEventListener('change', (e) => {
                this.state.itemsPerPage = parseInt(e.target.value) || 20;
                this.state.currentPage = 1;
                this.render();
            });
        }

        const btnPrev = container.querySelector('#btn-prev-page');
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                if (this.state.currentPage > 1) {
                    this.state.currentPage--;
                    this.render();
                }
            });
        }

        const btnNext = container.querySelector('#btn-next-page');
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                const totalPages = Math.ceil(this.state.totalItems / this.state.itemsPerPage) || 1;
                if (this.state.currentPage < totalPages) {
                    this.state.currentPage++;
                    this.render();
                }
            });
        }
    },

    abrirModalAbono(facturaId, saldo) {
        AbonoModal.show(facturaId, async () => {
            await this.cargarDatosCartera();
            this.renderLayoutActual();
            if (this.state.activeDrawerFacturaId && String(this.state.activeDrawerFacturaId) === String(facturaId)) {
                this.mostrarDrawer(facturaId);
            }
        }, saldo);
    },

    enviarCobroWhatsAppFactura(f) {
        const cliente = f.cliente;
        let tel = cliente?.telefono ? String(cliente.telefono).replace(/\D/g, '') : '';
        if (!tel) {
            tel = prompt(`El cliente "${cliente?.nombre || 'General'}" no tiene teléfono registrado.\nIngresa el número de WhatsApp (ej: 3001234567):`);
            if (!tel) return;
            tel = tel.replace(/\D/g, '');
        }

        const finalPhone = tel.startsWith('57') ? tel : (tel.length === 10 ? '57' + tel : tel);
        if (!finalPhone || finalPhone.length < 7) {
            CoreActions.showWarningModal("El número de teléfono no es válido o no fue proporcionado.");
            return;
        }
        const hoyFecha = typeof getLocalDate === 'function' ? getLocalDate() : new Date().toISOString().split('T')[0];

        let moraTexto = '';
        if (f.diasVencida > 0) {
            moraTexto = `Presenta *${f.diasVencida} días de mora* (Venció el ${this.formatFecha(f.vencimientoReal)})`;
        } else {
            moraTexto = `Se encuentra al día (Vence el ${this.formatFecha(f.vencimientoReal)})`;
        }

        let msg = `*RECORDATORIO DE PAGO - MAS ACCESORIOS*\n`;
        msg += `_Fecha: ${hoyFecha}_\n\n`;
        msg += `Estimado(a) *${cliente?.nombre || 'Cliente'}*, cordial saludo.\n`;
        msg += `Le recordamos amablemente el saldo pendiente de su *Factura #${f.numero || f.id}*:\n\n`;
        msg += `• *Monto Total:* ${this.formatMoney(f.total)}\n`;
        msg += `• *Abonos Realizados:* ${this.formatMoney(f.cobrado)}\n`;
        msg += `• *Saldo Pendiente por Cobrar:* *${this.formatMoney(f.saldo)}*\n`;
        msg += `• *Estado:* ${moraTexto}\n\n`;

        msg += `*MEDIOS DE PAGO AUTORIZADOS:*\n`;
        msg += `• *Bancolombia (Ahorros):* 54700050214\n`;
        msg += `  Titular: Diego M Izquierdo\n`;
        msg += `• *Nequi / DaviPlata:* 3158512091\n`;
        msg += `  Titular: Diego M Izquierdo\n`;
        msg += `• *Llave Bre-B / Transfiya:* @izquierdo638\n`;
        msg += `  (Transferencia inmediata desde cualquier banco)\n\n`;
        msg += `*Confirmar Pago:* Favor enviarnos el comprobante por este medio para registrar su abono de inmediato.\n\n`;
        msg += `¡Muchas gracias por su preferencia!`;

        const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    },

    enviarCobroWhatsAppCliente(clienteData) {
        let tel = clienteData.telefono ? String(clienteData.telefono).replace(/\D/g, '') : '';
        if (!tel) {
            tel = prompt(`El cliente "${clienteData.nombre}" no tiene teléfono registrado.\nIngresa el número de WhatsApp (ej: 3001234567):`);
            if (!tel) return;
            tel = tel.replace(/\D/g, '');
        }

        const finalPhone = tel.startsWith('57') ? tel : (tel.length === 10 ? '57' + tel : tel);
        if (!finalPhone || finalPhone.length < 7) {
            CoreActions.showWarningModal("El número de teléfono no es válido o no fue proporcionado.");
            return;
        }
        const hoyFecha = typeof getLocalDate === 'function' ? getLocalDate() : new Date().toISOString().split('T')[0];

        let msg = `*ESTADO DE CUENTA - MAS ACCESORIOS*\n`;
        msg += `_Fecha: ${hoyFecha}_\n\n`;
        msg += `Estimado(a) *${clienteData.nombre}*, un cordial saludo.\n`;
        msg += `Le compartimos el resumen de su saldo pendiente con nosotros:\n\n`;
        msg += `• *Saldo Total Pendiente:* *${this.formatMoney(clienteData.totalSaldo)}*\n`;
        msg += `• *Facturas Pendientes:* ${clienteData.facturas.length}\n`;
        if (clienteData.maxDiasMora > 0) {
            msg += `• *Estado:* Presenta saldo en mora (hasta ${clienteData.maxDiasMora} días)\n`;
        } else {
            msg += `• *Estado:* Cartera al día\n`;
        }

        msg += `\n*Detalle de Facturas:*\n`;
        clienteData.facturas.slice(0, 6).forEach(f => {
            const moraTag = f.diasVencida > 0 ? ` [Vencida +${f.diasVencida}d]` : ` [Al día]`;
            msg += `• *Fac #${f.numero || f.id}* | Vence: ${this.formatFecha(f.vencimientoReal)} | Saldo: *${this.formatMoney(f.saldo)}*${moraTag}\n`;
        });
        if (clienteData.facturas.length > 6) {
            msg += `• _... y ${clienteData.facturas.length - 6} factura(s) más._\n`;
        }

        msg += `\n*MEDIOS DE PAGO AUTORIZADOS:*\n`;
        msg += `• *Bancolombia (Ahorros):* 54700050214\n`;
        msg += `  Titular: Diego M Izquierdo\n`;
        msg += `• *Nequi / DaviPlata:* 3158512091\n`;
        msg += `  Titular: Diego M Izquierdo\n`;
        msg += `• *Llave Bre-B / Transfiya:* @izquierdo638\n`;
        msg += `  (Transferencia inmediata desde cualquier entidad bancaria)\n\n`;
        msg += `*Confirmar Pago:* Favor remitir su comprobante a este WhatsApp indicando el número de factura.\n\n`;
        msg += `Agradecemos regularizar el saldo pendiente a la mayor brevedad. Si ya realizó el pago, por favor compártanos el comprobante.\n¡Muchas gracias!`;

        const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    },

    exportarExcel() {
        const facturas = this.state.facturasFiltradas || [];
        if (facturas.length === 0) {
            CoreActions.showWarningModal("No hay datos para exportar con los filtros seleccionados.");
            return;
        }

        if (typeof XLSX === 'undefined') {
            CoreActions.showWarningModal("La librería de exportación XLSX no está disponible.");
            return;
        }

        const cabeceras = [
            "Número", 
            "Tipo documento", 
            "Cliente", 
            "NIT / CC", 
            "Teléfono", 
            "Fecha Creación", 
            "Vencimiento", 
            "Días Mora", 
            "Estado Mora", 
            "Total Factura", 
            "Cobrado", 
            "Saldo Pendiente"
        ];

        const safeStr = (v) => {
            if (v === null || v === undefined) return '';
            const s = String(v).trim();
            return /^[=+@\-\t\r]/.test(s) ? `'${s}` : s;
        };

        const dataToExport = facturas.map(f => ({
            "Número": safeStr(f.numero || f.id),
            "Tipo documento": "Factura de venta",
            "Cliente": safeStr(f.cliente?.nombre || 'Cliente General'),
            "NIT / CC": safeStr(f.cliente?.identificacion || ''),
            "Teléfono": safeStr(f.cliente?.telefono || ''),
            "Fecha Creación": safeStr(f.fecha || ''),
            "Vencimiento": safeStr(f.vencimientoReal || ''),
            "Días Mora": f.diasVencida,
            "Estado Mora": f.diasVencida <= 0 ? 'Al día' : (f.diasVencida <= 30 ? 'Vencida 1-30d' : (f.diasVencida <= 60 ? 'Mora 31-60d' : 'Mora Crítica +60d')),
            "Total Factura": f.total,
            "Cobrado": f.cobrado,
            "Saldo Pendiente": f.saldo
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport, { header: cabeceras });

        // Formatear columnas monetarias (índices 9, 10, 11) como moneda contable en Excel
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            for (let C = 9; C <= 11; ++C) {
                const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
                if (ws[cellRef]) {
                    ws[cellRef].z = '"$"#,##0.00';
                }
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cartera");

        const hoy = typeof getLocalDate === 'function' ? getLocalDate() : new Date().toISOString().split('T')[0];
        const fileName = `Cuentas_por_cobrar_${hoy}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }
};
