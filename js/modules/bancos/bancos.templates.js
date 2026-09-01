export const TesoreriaTemplates = {
    renderResumen() {
        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2});
        
        const resumenBancos = this.element.querySelector('#resumen-bancos');
        const resumenTotal = this.element.querySelector('#resumen-total');
        const kpiSaldoTotal = this.element.querySelector('#kpi-saldo-total');
        const kpiBancosActivos = this.element.querySelector('#kpi-bancos-activos');
        const kpiEfectivoActivos = this.element.querySelector('#kpi-efectivo-activos');

        let bancosCount = 0;
        let cajasCount = 0;
        
        this.state.cuentasActivas.forEach(c => {
            if ((c.tipo || '').toLowerCase() === 'caja') cajasCount++;
            else bancosCount++;
        });

        if (resumenBancos) resumenBancos.textContent = formatMoney(this.state.totalConsolidado);
        if (resumenTotal) resumenTotal.textContent = formatMoney(this.state.totalConsolidado);
        if (kpiSaldoTotal) kpiSaldoTotal.textContent = formatMoney(this.state.totalConsolidado);
        if (kpiBancosActivos) kpiBancosActivos.textContent = bancosCount;
        if (kpiEfectivoActivos) kpiEfectivoActivos.textContent = cajasCount;
    },

    renderTabla(searchQuery = '') {
        const container = this.element.querySelector('#tbody-bancos');
        if (!container) return;

        let html = '';
        const formatMoney = val => '$' + (val || 0).toLocaleString('es-CO', {minimumFractionDigits: 2});

        // Usar cuentas de Firestore (todasLasCuentas) si existen, si no fallback a cuentasConfig
        const sourceArray = (this.state.todasLasCuentas && this.state.todasLasCuentas.length > 0) 
                            ? this.state.todasLasCuentas 
                            : this.cuentasConfig;
                            
        const cuentasFiltradas = sourceArray.filter(c => 
            c.nombre.toLowerCase().includes(searchQuery) ||
            c.tipo.toLowerCase().includes(searchQuery) ||
            (c.numero && c.numero.toLowerCase().includes(searchQuery))
        );

        if (cuentasFiltradas.length === 0) {
            html = `<tr><td colspan="5" class="text-center py-5 text-muted">No se encontraron bancos.</td></tr>`;
        }

        cuentasFiltradas.forEach(c => {
            const saldo = this.state.saldos[c.id] !== undefined ? this.state.saldos[c.id] : (this.state.saldos[c.nombre] || 0);
            const isEfectivo = (c.tipo || '').toLowerCase() === 'caja';
            const icon = isEfectivo ? 'bi-cash' : 'bi-bank';
            
            const isActivo = c.estado !== 'inactivo';
            const opacityStyle = isActivo ? '' : 'opacity: 0.6;';
            const badge = isActivo 
                ? '<span class="badge bg-success text-success bg-opacity-10 border border-success-subtle rounded-pill ms-2 fw-medium" style="font-size: var(--fs-xxs); padding: 4px 8px;">Activa</span>' 
                : '<span class="badge bg-secondary text-secondary bg-opacity-10 border border-secondary-subtle rounded-pill ms-2 fw-medium" style="font-size: var(--fs-xxs); padding: 4px 8px;">Inactiva</span>';
            const actionBtnIcon = isActivo ? 'bi-pause-circle' : 'bi-play-circle';
            const actionBtnColor = isActivo ? 'text-danger' : 'text-success';
            const actionBtnTitle = isActivo ? 'Desactivar cuenta' : 'Activar cuenta';
            
            const tipoBadgeColor = isEfectivo ? 'bg-success text-success' : 'bg-primary text-primary';
            
            // Layout de Alegra: ícono gris tenue a la izquierda del nombre
            html += `
                <tr class="banco-row" data-id="${c.id}" style="cursor: pointer; font-size: var(--fs-base); color: var(--text-body); border-bottom: 1px solid var(--border-color); ${opacityStyle}">
                    <td class=\"py-2 ps-4 d-flex align-items-center\" style="white-space: nowrap;">
                        <div class="bg-light rounded-circle p-2 me-3 d-flex align-items-center justify-content-center text-muted" style="width: 32px; height: 32px; border: 1px solid #e2e8f0; flex-shrink: 0;">
                            <i class="bi ${icon}" style="font-size: var(--fs-md);"></i>
                        </div>
                        <span style="color: var(--text-main); font-weight: 500;">${c.nombre}</span>
                        ${badge}
                    </td>
                    <td class=\"py-2\" style="white-space: nowrap;"><span class="badge ${tipoBadgeColor} bg-opacity-10 border border-${isEfectivo?'success':'primary'}-subtle rounded-pill fw-medium" style="font-size: var(--fs-sm); padding: 5px 10px;">${c.tipo}</span></td>
                    <td class=\"py-2 font-monospace text-muted\" style="white-space: nowrap;">${c.numero || '-'}</td>
                    <td class=\"py-2\" style="color: var(--primary); font-weight: 500; white-space: nowrap;">${formatMoney(saldo)}</td>
                    <td class=\"py-2 pe-4\">
                        <div class="d-flex gap-2 align-items-center">
                            <button class="btn btn-sm btn-light border px-3 text-muted btn-conciliar" style="font-size: var(--fs-sm); font-weight: 500; border-radius: 4px;" onclick="event.stopPropagation(); window.location.hash='#/bancos/conciliacion?banco_id=${c.id}'">
                                Conciliar
                            </button>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-light border text-muted px-2 btn-abrir-menu-cuenta" data-bs-toggle="dropdown" aria-expanded="false" title="Más opciones" style="border-radius: 4px;">
                                    <i class="bi bi-three-dots-vertical"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end shadow border-0" style="font-size: var(--fs-base);">
                                    <li><a class="dropdown-item btn-editar-cuenta" href="javascript:void(0)" data-id="${c.id}" data-nombre="${c.nombre}" data-tipo="${c.tipo}" data-numero="${c.numero || ''}">Editar</a></li>
                                    <li><a class="dropdown-item ${actionBtnColor} btn-toggle-estado" href="javascript:void(0)" data-id="${c.id}" data-estado="${c.estado || 'activo'}">${actionBtnTitle}</a></li>
                                </ul>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = html;
    },

    renderChart(meses = 6) {
        const canvas = document.getElementById('chart-ingresos-gastos');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (this.state.chartInstance) {
            this.state.chartInstance.destroy();
        }

        // 1. Usar los datos de la base de datos
        const datos = this.state.datosGrafica || [];
        
        // 2. Preparar Data para Chart.js
        const labels = datos.map(m => m.mes);
        const dataIngresos = datos.map(m => m.ingresos || 0);
        const dataGastos = datos.map(m => m.egresos || 0);

        this.state.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: dataIngresos,
                        backgroundColor: '#2cbfb7', // Verde
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    },
                    {
                        label: 'Gastos',
                        data: dataGastos,
                        backgroundColor: '#e11d48', // Rojo suave
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 20,
                            font: { size: 12, family: "'Inter', sans-serif" }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { font: { size: 12 } }
                    },
                    y: {
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false,
                            borderDash: [5, 5]
                        },
                        ticks: {
                            font: { size: 11 },
                            callback: function(value) {
                                // Convertir a millones si es muy grande
                                if (value >= 1000000) {
                                    return '$' + (value / 1000000).toFixed(0) + 'M';
                                }
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }
};
