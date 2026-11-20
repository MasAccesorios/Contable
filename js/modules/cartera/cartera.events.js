import { AbonoModal } from '../../shared/abonoModal.js';
import { PrintManager } from '../../shared/printManager.js';
import { CoreActions } from '../../shared/crud.js';
import { getLocalDate } from '../../core/db.js';
import { resolveClienteIdFromFactura } from '../../shared/cobranzaUtils.js';

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
        const clienteId = resolveClienteIdFromFactura(f);
        if (!clienteId) {
            CoreActions.showWarningModal("Esta factura no tiene un cliente asignado para generar el Estado de Cuenta.");
            return;
        }
        PrintManager.printEstadoCuenta(clienteId);
    },

    enviarCobroWhatsAppCliente(clienteData) {
        const clienteId = clienteData?.id || clienteData?.clienteId;
        if (!clienteId) {
            CoreActions.showWarningModal("No se encontró el identificador del cliente.");
            return;
        }
        PrintManager.printEstadoCuenta(clienteId);
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
