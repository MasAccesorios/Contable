const fs = require('fs');
const path = 'js/modules/ingresos/notasCredito.js';
let text = fs.readFileSync(path, 'utf8');

const target1 = `    async anularNotaCredito(id) {
        // Fetch nota
        const { data: nota, error: errN } = await supabase.from('notas_credito').select('*').eq('id', id).single();
        if (errN || !nota) throw new Error("No se encontró la nota de crédito");
        
        // Fetch detalles
        const { data: detalles } = await supabase.from('nota_credito_detalles').select('*').eq('nota_credito_id', id);
        
        // Revertir inventario
        if (detalles && detalles.length > 0) {
            const outItems = detalles.map(d => ({ productoId: d.producto_id, cantidad: d.cantidad }));
            const outRes = await InventarioUtils.procesarSalidaInventario(outItems);
            if (!outRes.success) throw new Error(outRes.error);
        }

        // Anular nota
        const { error: updErr1 } = await supabase.from('notas_credito').update({ estado: 'anulada' }).eq('id', id);
        if (updErr1) throw new Error(updErr1.message);

        // Anular pago
        const { error: updErr2 } = await supabase.from('pagos_ingresos').update({ estado: 'anulado' }).eq('referencia', 'NC-' + nota.numero);
        if (updErr2) throw new Error(updErr2.message);
    },`;

const repl1 = `    async anularNotaCredito(id) {
        // 1. Snapshot del estado previo (Cabecera y Pago Cruzado)
        const { data: snapshotNota, error: errN } = await supabase.from('notas_credito').select('*').eq('id', id).single();
        if (errN || !snapshotNota) throw new Error("No se encontró la nota de crédito");
        
        const { data: snapshotPago } = await supabase.from('pagos_ingresos')
            .select('*').eq('referencia', 'NC-' + snapshotNota.numero).single();

        // 2. Fetch detalles para calcular salida de inventario
        const { data: detalles } = await supabase.from('nota_credito_detalles').select('*').eq('nota_credito_id', id);
        
        // 3. FASE 1: Cálculo en memoria (Read-Only)
        let planSalida = null;
        if (detalles && detalles.length > 0) {
            const outItems = detalles.map(d => ({ productoId: d.producto_id, cantidad: d.cantidad }));
            planSalida = await InventarioUtils.calcularSalidaInventario(outItems);
            if (!planSalida.success) throw new Error("No hay stock suficiente para anular la nota de crédito: " + planSalida.error);
        }

        try {
            // 4. FASE 2: Escritura Documental (Update de estado)
            const { error: updErr1 } = await supabase.from('notas_credito').update({ estado: 'anulada' }).eq('id', id);
            if (updErr1) throw new Error(updErr1.message);

            if (snapshotPago) {
                const { error: updErr2 } = await supabase.from('pagos_ingresos').update({ estado: 'anulado' }).eq('id', snapshotPago.id);
                if (updErr2) throw new Error(updErr2.message);
            }

            // 5. FASE 3: Modificación Física de Inventario con rollback interno
            if (planSalida) {
                await InventarioUtils.ejecutarPlanInventario(planSalida.operacionesDB);
            }

        } catch (errorTransaccion) {
            console.error("Error crítico anulando nota, revirtiendo base de datos...", errorTransaccion);
            // 6. ROLLBACK COMPENSATORIO EXTERNO
            await supabase.from('notas_credito').update({ estado: snapshotNota.estado }).eq('id', id);
            if (snapshotPago) {
                await supabase.from('pagos_ingresos').update({ estado: snapshotPago.estado }).eq('id', snapshotPago.id);
            }
            throw new Error("Error al anular la nota. Se ha revertido la operación por seguridad.");
        }
    },`;

const safeReplace = (content, target, repl) => {
    let t = target.replace(/\r/g, '');
    let r = repl.replace(/\r/g, '');
    let c = content.replace(/\r/g, '');
    if (c.includes(t)) {
        return c.replace(t, r);
    }
    return null;
};

let result = safeReplace(text, target1, repl1);
if (result) {
    fs.writeFileSync(path, result, 'utf8');
    console.log("Success nc1");
} else {
    console.error("Match failed nc1");
}
