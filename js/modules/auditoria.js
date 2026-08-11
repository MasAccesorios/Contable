import { supabase } from '../core/supabase.js';
import DB from '../core/db.js';

export async function init(container = null) {
    if (!container) container = document.getElementById('view-viewport');
    container.innerHTML = `
        <div class="dash-layout p-4">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 class="h3 fw-bold mb-1 text-dark">🛡️ Auditoría de Integridad</h2>
                    <p class="text-muted mb-0" style="font-size: 14px;">Este módulo ejecuta verificaciones lógicas de integridad de datos en la base de datos para detectar discrepancias e inconsistencias, como sobreventas, huérfanos o saldos desalineados.</p>
                </div>
                <div>
                    <button id="btn-run-audit" class="btn btn-primary-action">
                        <i class="bi bi-play-fill me-1"></i> Ejecutar Auditoría
                    </button>
                </div>
            </div>
            
            <div id="audit-results" class="d-flex flex-column gap-3">
                <!-- Aquí se inyectarán los resultados -->
            </div>
        </div>
    `;

    document.getElementById('btn-run-audit').addEventListener('click', runAudit);
}

async function runAudit() {
    const resultsContainer = document.getElementById('audit-results');
    const btn = document.getElementById('btn-run-audit');
    
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Ejecutando...`;
    
    resultsContainer.innerHTML = '';
    
    // Configuración de los cheques
    const checks = [
        { id: 1, title: 'Facturas con inconsistencia matemática (saldo original > total)', fn: check1 },
        { id: 2, title: 'Facturas cerradas/pagadas pero con pagos insuficientes', fn: check2 },
        { id: 3, title: 'Productos con stock diferente a la suma de lotes', fn: check3 },
        { id: 4, title: 'Pagos/Ingresos huérfanos (factura no existe)', fn: check4 },
        { id: 5, title: 'Facturas huérfanas de contacto', fn: check5 },
        { id: 6, title: 'Cartera de clientes vs sumatoria manual de facturas y pagos', fn: check6 },
        { id: 7, title: 'Productos con suma de lotes negativa (sobreventa)', fn: check7 },
        { id: 8, title: 'Seguridad de infraestructura: tablas sin RLS o sin políticas', fn: check8 }
    ];

    for (const check of checks) {
        // Crear UI placeholder
        const card = document.createElement('div');
        card.className = 'card';
        card.id = `audit-check-${check.id}`;
        card.innerHTML = `
            <div class="card-body d-flex justify-content-between align-items-center">
                <div>
                    <h5 class="card-title mb-1" style="font-size: 1rem;">${check.title}</h5>
                    <p class="card-text text-muted mb-0" style="font-size: 0.85rem;" id="audit-status-${check.id}">Ejecutando...</p>
                </div>
                <div id="audit-icon-${check.id}">
                    <div class="spinner-border text-primary" role="status" style="width: 1.5rem; height: 1.5rem;">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                </div>
            </div>
            <div class="card-footer bg-light" id="audit-details-${check.id}" style="display: none;">
                <!-- Detalles -->
            </div>
        `;
        resultsContainer.appendChild(card);

        try {
            const result = await check.fn();
            const iconDiv = document.getElementById(`audit-icon-${check.id}`);
            const statusText = document.getElementById(`audit-status-${check.id}`);
            const detailsDiv = document.getElementById(`audit-details-${check.id}`);
            
            if (result.success) {
                iconDiv.innerHTML = `<span style="font-size: 1.5rem;">✅</span>`;
                statusText.innerText = 'Sin problemas detectados';
                statusText.classList.add('text-success');
            } else {
                iconDiv.innerHTML = `<span style="font-size: 1.5rem;">❌</span>`;
                statusText.innerText = `Se encontraron ${result.count} discrepancia(s)`;
                statusText.classList.add('text-danger');
                
                // Botón de detalle
                const viewBtn = document.createElement('button');
                viewBtn.className = 'btn btn-sm btn-outline-danger mt-2';
                viewBtn.innerText = 'Ver detalle';
                
                const tableContainer = document.createElement('div');
                tableContainer.className = 'table-responsive mt-3';
                tableContainer.style.display = 'none';
                tableContainer.innerHTML = buildTable(result.columns, result.data);
                
                viewBtn.addEventListener('click', () => {
                    tableContainer.style.display = tableContainer.style.display === 'none' ? 'block' : 'none';
                    viewBtn.innerText = tableContainer.style.display === 'none' ? 'Ver detalle' : 'Ocultar detalle';
                });
                
                detailsDiv.appendChild(viewBtn);
                detailsDiv.appendChild(tableContainer);
                detailsDiv.style.display = 'block';
            }
        } catch (error) {
            console.error(`Error en chequeo ${check.id}:`, error);
            const iconDiv = document.getElementById(`audit-icon-${check.id}`);
            const statusText = document.getElementById(`audit-status-${check.id}`);
            iconDiv.innerHTML = `<span style="font-size: 1.5rem;">⚠️</span>`;
            statusText.innerText = `Error al ejecutar: ${error.message}`;
            statusText.classList.add('text-warning');
        }
    }

    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-play-fill"></i> Ejecutar Auditoría`;
}

function buildTable(columns, data) {
    if (!data || data.length === 0) return '';
    let html = '<table class="table table-sm table-bordered table-striped" style="font-size: 0.85rem;">';
    html += '<thead><tr>';
    for (const col of columns) {
        html += `<th>${col}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (const row of data) {
        html += '<tr>';
        for (const col of columns) {
            html += `<td>${row[col]}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

// ==========================================
// CHEQUEOS DE AUDITORÍA
// ==========================================

// 1. Facturas con saldo_original no NULL donde saldo_original > total
async function check1() {
    const { data, error } = await supabase.rpc('run_audit_check_1');
    if (error) throw error;
    return data;
}

// 2. Facturas con estado='closed'/'pagada' en BD pero que tengan pagos_ingresos activos sumando menos que el total
async function check2() {
    const { data, error } = await supabase.rpc('run_audit_check_2');
    if (error) throw error;
    return data;
}

// 3. Productos donde productos.stock no coincide con SUM(lotes_fifo.cantidad_actual)
async function check3() {
    const { data, error } = await supabase.rpc('run_audit_check_3');
    if (error) throw error;
    return data;
}

// 4. pagos_ingresos con factura_id que no existe en facturas
async function check4() {
    const { data, error } = await supabase.rpc('run_audit_check_4');
    if (error) throw error;
    return data;
}

// 5. Facturas con contacto_id que no existe en contactos
async function check5() {
    const { data, error } = await supabase.rpc('run_audit_check_5');
    if (error) throw error;
    return data;
}

// 6. Comparación cruzada Cartera
async function check6() {
    const { data: sumasManuales, error: errManual } = await supabase.rpc('run_audit_check_6_manual_sum');
    if (errManual) throw errManual;
    
    const { data: carteraCxc, error: errCxc } = await supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxc' });
    if (errCxc) throw errCxc;
    const sumRpcCxc = carteraCxc ? carteraCxc.reduce((acc, c) => acc + parseFloat(c.saldo !== undefined ? c.saldo : 0), 0) : 0;

    const { data: carteraCxp, error: errCxp } = await supabase.rpc('get_cartera_con_saldos', { p_tipo_cartera: 'cxp' });
    if (errCxp) throw errCxp;
    const sumRpcCxp = carteraCxp ? carteraCxp.reduce((acc, c) => acc + parseFloat(c.saldo !== undefined ? c.saldo : 0), 0) : 0;

    const manualCxc = parseFloat(sumasManuales?.cxc || 0);
    const manualCxp = parseFloat(sumasManuales?.cxp || 0);

    const diffCxc = Math.abs(sumRpcCxc - manualCxc);
    const diffCxp = Math.abs(sumRpcCxp - manualCxp);
    
    const dataFails = [];
    if (diffCxc > 0.01) {
        dataFails.push({ tipo: 'Cartera Clientes (CXC)', total_rpc: sumRpcCxc.toFixed(2), total_manual: manualCxc.toFixed(2), diferencia: diffCxc.toFixed(2) });
    }
    if (diffCxp > 0.01) {
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
    
    return { success: true };
}

// 7. Productos con SUM(lotes_fifo.cantidad_actual) negativo (sobreventa)
async function check7() {
    const { data, error } = await supabase.rpc('run_audit_check_7');
    if (error) throw error;
    return data;
}

// 8. Seguridad de infraestructura: tablas sin RLS o sin políticas
async function check8() {
    const { data, error } = await supabase.rpc('run_audit_check_8');
    if (error) throw error;
    return data;
}
