// js/modules/auditoria/auditoria.events.js
// Manejador de Eventos Reactivos e Interactivos para Auditoría 360°

import { AuditoriaData } from './auditoria.data.js';
import { ExportManager } from '../../shared/exportManager.js';
import { getLocalDate } from '../../core/db.js';

export const AuditoriaEvents = {
    _searchDebounceTimer: null,

    bindEvents(container, state, orchestrator) {
        if (!container) return;

        // 1. Pestañas (Tabs) de Categoría
        const tabsContainer = container.querySelector('#audit-tabs');
        if (tabsContainer) {
            tabsContainer.addEventListener('click', (e) => {
                const tabBtn = e.target.closest('[data-tab]');
                if (!tabBtn) return;
                e.preventDefault();
                const tab = tabBtn.getAttribute('data-tab');
                orchestrator.setTab(tab);
            });
        }

        // 2. Buscador en Tiempo Real (Debounce)
        const searchInput = container.querySelector('#audit-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this._searchDebounceTimer);
                this._searchDebounceTimer = setTimeout(() => {
                    orchestrator.setSearchQuery(e.target.value);
                }, 200);
            });
        }

        // 3. Botón Ejecutar Auditoría Completa
        const btnRun = container.querySelector('#btn-run-audit');
        if (btnRun) {
            btnRun.addEventListener('click', (e) => {
                e.preventDefault();
                orchestrator.runFullAudit();
            });
        }

        // 4. Delegación de Eventos para Lista de Chequeos (Re-ejecutar & Toggle Detalles)
        const checksContainer = container.querySelector('#audit-checks-container');
        if (checksContainer) {
            checksContainer.addEventListener('click', async (e) => {
                // Re-ejecutar chequeo individual
                const rerunBtn = e.target.closest('.btn-rerun-check');
                if (rerunBtn) {
                    e.preventDefault();
                    const checkId = rerunBtn.getAttribute('data-id');
                    await orchestrator.runSingleCheck(checkId, rerunBtn);
                    return;
                }

                // Toggle Ver/Ocultar detalles
                const toggleBtn = e.target.closest('.btn-toggle-details');
                if (toggleBtn) {
                    e.preventDefault();
                    const checkId = toggleBtn.getAttribute('data-id');
                    orchestrator.toggleCheckDetails(checkId);
                    return;
                }
            });
        }

        // 5. Botón Copiar Informe al Portapapeles
        const btnCopy = container.querySelector('#btn-copy-report');
        if (btnCopy) {
            btnCopy.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const md = AuditoriaData.generarInformeMarkdown(state.checks);
                    await navigator.clipboard.writeText(md);

                    const originalHtml = btnCopy.innerHTML;
                    btnCopy.innerHTML = `<i class="bi bi-check-lg text-success me-1"></i> ¡Copiado!`;
                    btnCopy.classList.add('border-success');
                    setTimeout(() => {
                        btnCopy.innerHTML = originalHtml;
                        btnCopy.classList.remove('border-success');
                    }, 2000);
                } catch (err) {
                    console.error('Error copiando informe:', err);
                    alert('No se pudo acceder al portapapeles. Por favor, selecciona y copia manualmente.');
                }
            });
        }

        // 6. Botón Exportar a Excel
        const btnExport = container.querySelector('#btn-export-excel');
        if (btnExport) {
            btnExport.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportarInformeExcel(state.checks, btnExport);
            });
        }
    },

    exportarInformeExcel(checks, btnElement) {
        try {
            const rows = AuditoriaData.mapearParaExcel(checks);
            if (!rows || rows.length === 0) {
                alert('No hay chequeos disponibles para exportar.');
                return;
            }

            const dateStr = getLocalDate();

            // Si SheetJS está disponible en window.XLSX
            if (typeof window !== 'undefined' && window.XLSX) {
                const ws = window.XLSX.utils.json_to_sheet(rows);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, 'Auditoria_Integridad');
                window.XLSX.writeFile(wb, `Auditoria_Integridad_${dateStr}.xlsx`);
                return;
            }

            // Fallback CSV con delimitadores limpios y UTF-8 BOM
            const headers = Object.keys(rows[0]);
            let csvContent = headers.join(';') + '\r\n';
            rows.forEach(row => {
                const values = headers.map(header => {
                    const val = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
                    return `"${val.replace(/"/g, '""')}"`;
                });
                csvContent += values.join(';') + '\r\n';
            });

            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Auditoria_Integridad_${dateStr}.csv`);
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exportando auditoría:', error);
            alert('Ocurrió un error al generar la exportación.');
        }
    }
};
