// js/modules/auditoria/auditoria.js
// Orquestador Principal del Módulo de Auditoría de Integridad 360°

import { AuditoriaData } from './auditoria.data.js';
import { AuditoriaTemplates } from './auditoria.templates.js';
import { AuditoriaEvents } from './auditoria.events.js';

export const AuditoriaModule = {
    _container: null,
    _state: {
        checks: [],
        currentTab: 'todas',
        searchQuery: '',
        expandedChecks: new Set(),
        isRunning: false,
        lastAuditDate: null,
        kpis: null
    },

    async init(container = null) {
        if (!container) container = document.getElementById('view-viewport');
        this._container = container;

        // Inicializar catálogo de chequeos limpios
        this._state.checks = AuditoriaData.CATALOGO_CHEQUEOS.map(c => ({
            ...c,
            result: null,
            error: null,
            isRunning: false
        }));

        this._state.expandedChecks.clear();
        this._state.kpis = AuditoriaData.calcularKpis(this._state.checks);

        this.renderAll();
        AuditoriaEvents.bindEvents(this._container, this._state, this);

        // Auto-ejecución inmediata de la auditoría al entrar al módulo
        this.runFullAudit();
    },

    renderAll() {
        if (!this._container) return;
        this._state.kpis = AuditoriaData.calcularKpis(this._state.checks);
        this._container.innerHTML = AuditoriaTemplates.renderLayout(this._state);
        this.renderChecksList();
    },

    renderChecksList() {
        if (!this._container) return;
        const checksContainer = this._container.querySelector('#audit-checks-container');
        if (!checksContainer) return;

        const filtered = AuditoriaData.filtrarChequeos(
            this._state.checks,
            this._state.currentTab,
            this._state.searchQuery
        );

        if (filtered.length === 0) {
            checksContainer.innerHTML = `
                <div class="card border-0 shadow-sm p-4 text-center bg-white" style="border-radius: 12px;">
                    <div class="py-4">
                        <i class="bi bi-search text-muted" style="font-size: 32px;"></i>
                        <h6 class="mt-2 text-muted fw-bold">No se encontraron chequeos</h6>
                        <p class="text-muted mb-0" style="font-size: 13px;">
                            ${this._state.searchQuery ? `No hay resultados para "${this._state.searchQuery}".` : 'No hay chequeos disponibles en esta categoría.'}
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        checksContainer.innerHTML = filtered.map(c => {
            const isExpanded = this._state.expandedChecks.has(c.id);
            return AuditoriaTemplates.renderCheckCard(c, isExpanded);
        }).join('');
    },

    updateCheckCardInDom(checkId) {
        const check = this._state.checks.find(c => c.id === checkId);
        if (!check || !this._container) return;

        const existingCard = this._container.querySelector(`#check-card-${checkId}`);
        if (!existingCard) {
            this.renderChecksList();
            return;
        }

        const isExpanded = this._state.expandedChecks.has(check.id);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = AuditoriaTemplates.renderCheckCard(check, isExpanded);
        const newCard = tempDiv.firstElementChild;
        if (newCard) {
            existingCard.replaceWith(newCard);
        }
    },

    updateKpisInDom() {
        if (!this._container) return;
        this._state.kpis = AuditoriaData.calcularKpis(this._state.checks);

        // Actualizar pestañas badge counts
        const counts = this._state.kpis.categoryCounts;
        const tabs = this._container.querySelectorAll('#audit-tabs [data-tab]');
        tabs.forEach(tabBtn => {
            const tabKey = tabBtn.getAttribute('data-tab');
            const badge = tabBtn.querySelector('.badge');
            if (badge && counts[tabKey] !== undefined) {
                badge.innerText = counts[tabKey];
            }
        });

        // Re-render layout si no se está ejecutando para sincronizar tarjetas superiores
        if (!this._state.isRunning) {
            const searchVal = this._container.querySelector('#audit-search-input')?.value;
            this._container.innerHTML = AuditoriaTemplates.renderLayout(this._state);
            AuditoriaEvents.bindEvents(this._container, this._state, this);
            const newSearch = this._container.querySelector('#audit-search-input');
            if (newSearch && searchVal) {
                newSearch.value = searchVal;
                newSearch.focus();
            }
            this.renderChecksList();
        }
    },

    setTab(tab) {
        this._state.currentTab = tab;
        const tabBtns = this._container.querySelectorAll('#audit-tabs [data-tab]');
        tabBtns.forEach(b => {
            const isTarget = b.getAttribute('data-tab') === tab;
            b.classList.toggle('active', isTarget);
        });
        this.renderChecksList();
    },

    setSearchQuery(query) {
        this._state.searchQuery = query;
        this.renderChecksList();
    },

    toggleCheckDetails(checkId) {
        if (this._state.expandedChecks.has(checkId)) {
            this._state.expandedChecks.delete(checkId);
        } else {
            this._state.expandedChecks.add(checkId);
        }
        this.updateCheckCardInDom(checkId);
    },

    async runSingleCheck(checkId, btnElement = null) {
        const check = this._state.checks.find(c => c.id === checkId);
        if (!check) return;

        check.isRunning = true;
        check.error = null;
        this.updateCheckCardInDom(checkId);

        try {
            const result = await AuditoriaData.ejecutarChequeo(check);
            check.result = result;
            check.error = null;
            if (result && !result.success) {
                this._state.expandedChecks.add(check.id);
            }
        } catch (error) {
            console.error(`Error ejecutando ${checkId}:`, error);
            check.error = error;
            check.result = null;
            this._state.expandedChecks.add(check.id);
        } finally {
            check.isRunning = false;
            this.updateCheckCardInDom(checkId);
            this.updateKpisInDom();
        }
    },

    async runFullAudit() {
        if (this._state.isRunning) return;

        this._state.isRunning = true;
        this._state.expandedChecks.clear();

        const btnRun = this._container?.querySelector('#btn-run-audit');
        if (btnRun) {
            btnRun.disabled = true;
            btnRun.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Ejecutando Auditoría...`;
        }

        // Ejecución secuencial controlada para máxima estabilidad de memoria
        for (const check of this._state.checks) {
            check.isRunning = true;
            check.error = null;
            this.updateCheckCardInDom(check.id);

            try {
                const result = await AuditoriaData.ejecutarChequeo(check);
                check.result = result;
                check.error = null;
                // Si hay discrepancia, auto-expandir para que sea visible de inmediato
                if (result && !result.success) {
                    this._state.expandedChecks.add(check.id);
                }
            } catch (error) {
                console.error(`Error ejecutando chequeo ${check.id}:`, error);
                check.error = error;
                check.result = null;
                this._state.expandedChecks.add(check.id);
            } finally {
                check.isRunning = false;
                this.updateCheckCardInDom(check.id);
            }
        }

        this._state.isRunning = false;
        this._state.lastAuditDate = new Date().toISOString();

        if (btnRun) {
            btnRun.disabled = false;
            btnRun.innerHTML = `<i class="bi bi-play-fill me-1"></i> Ejecutar Auditoría Completa`;
        }

        this.updateKpisInDom();
    }
};

export async function init(container = null) {
    return AuditoriaModule.init(container);
}
