import { supabase } from '../core/supabase.js';
import DB from '../core/db.js';

export async function init(container = null) {
    if (!container) container = document.getElementById('view-viewport');
    container.innerHTML = `
        <div class="content-header">
            <h2 class="content-title">🛡️ Auditoría de Integridad</h2>
            <div class="header-actions">
                <button id="btn-run-audit" class="btn btn-primary">
                    <i class="bi bi-play-fill"></i> Ejecutar Auditoría
                </button>
            </div>
        </div>
        <div class="content-body" style="padding: 20px;">
            <p class="text-muted">Este módulo ejecuta verificaciones lógicas de integridad de datos en la base de datos para detectar discrepancias e inconsistencias, como sobreventas, huérfanos o saldos desalineados.</p>
            
            <div id="audit-results" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem;">
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
        { id: 7, title: 'Productos con suma de lotes negativa (sobreventa)', fn: check7 }
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
    const facturas = await DB.getAll('facturas');
    
    const fails = facturas.filter(f => 
        f.saldo_original !== null && 
        f.saldo_original !== undefined && 
        parseFloat(f.saldo_original) > parseFloat(f.total)
    );
    
    if (fails.length === 0) return { success: true };
    
    return {
        success: false,
        count: fails.length,
        columns: ['id', 'numero', 'total', 'saldo_original'],
        data: fails.map(f => ({
            id: f.id,
            numero: f.numero,
            total: f.total,
            saldo_original: f.saldo_original
        }))
    };
}

// 2. Facturas con estado='closed'/'pagada' en BD pero que tengan pagos_ingresos activos sumando menos que el total
async function check2() {
    // Traer TODAS las facturas
    const facturasTodas = await DB.getAll('facturas');
    const facturas = facturasTodas.filter(f => f.estado === 'closed' || f.estado === 'pagada');
    
    if (facturas.length === 0) return { success: true };
    
    // Traer TODOS los pagos (esto bajará los 24k pagos la primera vez, luego se sirve de caché)
    const todosPagos = await DB.getAll('pagos_ingresos');
    
    const pagosSumMap = {};
    todosPagos.forEach(p => {
        if (p.estado !== 'anulado') {
            pagosSumMap[p.factura_id] = (pagosSumMap[p.factura_id] || 0) + parseFloat(p.monto || 0);
        }
    });
    
    const fails = [];
    for (const f of facturas) {
        const sumPagos = pagosSumMap[f.id] || 0;
        const totalBase = (f.saldo_original !== null && f.saldo_original !== undefined) 
            ? parseFloat(f.saldo_original) 
            : parseFloat(f.total);
        
        // Tolerancia de 0.01 por posibles problemas de redondeo
        if (totalBase - sumPagos > 0.01) {
            fails.push({
                id: f.id,
                numero: f.numero,
                estado: f.estado,
                total_base: totalBase.toFixed(2),
                suma_pagos: sumPagos.toFixed(2),
                faltante: (totalBase - sumPagos).toFixed(2)
            });
        }
    }
    
    if (fails.length === 0) return { success: true };
    
    return {
        success: false,
        count: fails.length,
        columns: ['id', 'numero', 'estado', 'total_base', 'suma_pagos', 'faltante'],
        data: fails
    };
}

// 3. Productos donde productos.stock no coincide con SUM(lotes_fifo.cantidad_actual)
async function check3() {
    const productos = await DB.getAll('productos');
    const lotes = await DB.getAll('lotes_fifo');
    
    const lotesSumMap = {};
    lotes.forEach(l => {
        lotesSumMap[l.productoId] = (lotesSumMap[l.productoId] || 0) + parseFloat(l.cantidadActual || 0);
    });
    
    const fails = [];
    for (const p of productos) {
        const stockDb = parseFloat(p.stock) || 0;
        const sumLotes = lotesSumMap[String(p.id)] || 0;
        
        if (Math.abs(stockDb - sumLotes) > 0.001) {
            fails.push({
                producto_id: p.id,
                sku: p.sku || '',
                nombre: p.nombre,
                stock_en_productos: stockDb,
                suma_lotes: sumLotes,
                discrepancia: (stockDb - sumLotes).toFixed(2)
            });
        }
    }
    
    if (fails.length === 0) return { success: true };
    
    return {
        success: false,
        count: fails.length,
        columns: ['producto_id', 'sku', 'nombre', 'stock_en_productos', 'suma_lotes', 'discrepancia'],
        data: fails
    };
}

// 4. pagos_ingresos con factura_id que no existe en facturas
async function check4() {
    const pagosTodos = await DB.getAll('pagos_ingresos');
    const pagos = pagosTodos.filter(p => p.factura_id !== null && p.factura_id !== undefined);
    
    if (pagos.length === 0) return { success: true };
    
    const facturas = await DB.getAll('facturas');
    const facturaIdsSet = new Set(facturas.map(f => String(f.id)));
    
    const fails = pagos.filter(p => !facturaIdsSet.has(String(p.factura_id))).map(p => ({
        pago_id: p.id,
        pago_numero: p.numero,
        factura_id_huerfano: p.factura_id,
        monto: p.monto,
        estado: p.estado
    }));
    
    if (fails.length === 0) return { success: true };
    
    return {
        success: false,
        count: fails.length,
        columns: ['pago_id', 'pago_numero', 'factura_id_huerfano', 'monto', 'estado'],
        data: fails
    };
}

// 5. Facturas con contacto_id que no existe en contactos
async function check5() {
    const facturasTodas = await DB.getAll('facturas');
    const facturas = facturasTodas.filter(f => f.contacto_id !== null && f.contacto_id !== undefined);
    
    const contactos = await DB.getAll('contactos');
    const contactosIdsSet = new Set(contactos.map(c => String(c.id)));
    
    const fails = facturas.filter(f => !contactosIdsSet.has(String(f.contacto_id))).map(f => ({
        factura_id: f.id,
        factura_numero: f.numero,
        contacto_id_huerfano: f.contacto_id,
        estado: f.estado
    }));
    
    if (fails.length === 0) return { success: true };
    
    return {
        success: false,
        count: fails.length,
        columns: ['factura_id', 'factura_numero', 'contacto_id_huerfano', 'estado'],
        data: fails
    };
}

// 6. Comparación cruzada Cartera
async function check6() {
    const todasFacturas = await DB.getAll('facturas');
    const todosPagos = await DB.getAll('pagos_ingresos');
    
    const validFacturas = todasFacturas.filter(f => !['anulada', 'void', 'voided'].includes(f.estado?.toLowerCase()) && (f.tipo === 'venta' || !f.tipo));
    
    let sumSumaManual = 0;
    
    const pagosMap = {};
    for (const p of todosPagos) {
        if (p.estado?.toLowerCase() !== 'anulado' && p.tipo === 'in' && p.factura_id) {
            pagosMap[p.factura_id] = (pagosMap[p.factura_id] || 0) + parseFloat(p.monto || 0);
        }
    }
    
    for (const f of validFacturas) {
        const base = (f.saldo_original !== null && f.saldo_original !== undefined) ? parseFloat(f.saldo_original) : parseFloat(f.total || 0);
        const pagosFac = pagosMap[f.id] || 0;
        
        let pendiente = base - pagosFac;
        
        if (f.estado?.toLowerCase() === 'pagada' || f.estado?.toLowerCase() === 'closed') {
            pendiente = 0; // Por regla
        } else if (pendiente < 0) {
            pendiente = 0;
        }
        
        sumSumaManual += pendiente;
    }
    
    const { data: cartera, error: errCar } = await supabase.rpc('get_cartera_con_saldos', { p_page: 1, p_limit: 10000 });
    let sumRpc = 0;
    if (!errCar && cartera) {
        sumRpc = cartera.reduce((acc, c) => acc + parseFloat(c.saldo_pendiente || 0), 0);
    } else {
        const { data: rpcFacs, error: errRpcFac } = await supabase.rpc('get_facturas_con_saldos', { p_page: 1, p_limit: 100000 });
        if (!errRpcFac && rpcFacs) {
            sumRpc = rpcFacs.reduce((acc, f) => acc + parseFloat(f.saldo_pendiente || 0), 0);
        } else {
             return {
                success: false,
                count: 1,
                columns: ['error'],
                data: [{ error: 'No se pudo ejecutar el RPC de cartera para comparar. ' + (errCar?.message || errRpcFac?.message) }]
             };
        }
    }
    
    const diff = Math.abs(sumRpc - sumSumaManual);
    if (diff > 0.01) {
        return {
            success: false,
            count: 1,
            columns: ['origen', 'total_saldo_pendiente', 'diferencia'],
            data: [
                { origen: 'RPC (Base de Datos)', total_saldo_pendiente: sumRpc.toFixed(2), diferencia: diff.toFixed(2) },
                { origen: 'Cálculo Manual (JS)', total_saldo_pendiente: sumSumaManual.toFixed(2), diferencia: diff.toFixed(2) }
            ]
        };
    }
    
    return { success: true };
}

// 7. Productos con SUM(lotes_fifo.cantidad_actual) negativo (sobreventa)
async function check7() {
    const productos = await DB.getAll('productos');
    const lotes = await DB.getAll('lotes_fifo');
    
    const lotesSumMap = {};
    lotes.forEach(l => {
        lotesSumMap[l.productoId] = (lotesSumMap[l.productoId] || 0) + parseFloat(l.cantidadActual || 0);
    });
    
    const fails = [];
    for (const p of productos) {
        const sumLotes = lotesSumMap[String(p.id)] || 0;
        
        if (sumLotes < -0.001) {
            fails.push({
                producto_id: p.id,
                sku: p.sku || '',
                nombre: p.nombre,
                suma_lotes: sumLotes.toFixed(2)
            });
        }
    }
    
    if (fails.length === 0) return { success: true };
    
    return {
        success: false,
        count: fails.length,
        columns: ['producto_id', 'sku', 'nombre', 'suma_lotes'],
        data: fails
    };
}
