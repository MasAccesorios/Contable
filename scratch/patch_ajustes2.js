const fs = require('fs');

const path = 'js/modules/inventario/ajustes.js';
let text = fs.readFileSync(path, 'utf8');

const target = `                        // FASE 3: Modificar Inventario Físico con Rollback de seguridad
                        try {
                            // Salidas FIFO
                            if (itemsDisminucion.length > 0 && planDisminucion) {
                                await InventarioUtils.ejecutarPlanInventario(planDisminucion.operacionesDB);
                            }

                            // Incrementos directos
                            if (itemsIncremento.length > 0) {
                                const lotesInsert = itemsIncremento.map(item => ({
                                    producto_id: item.productoId,
                                    cantidad_inicial: item.cantidad,
                                    cantidad_actual: item.cantidad,
                                    costo_unitario: item.costo_unitario,
                                    fecha_ingreso: fecha,
                                    referencia: \`Ajuste de Inventario #\${nextNumero}\`
                                }));
                                const { error: insErr } = await supabase.from('lotes_fifo').insert(lotesInsert);
                                if (insErr) throw new Error("Fallo al insertar lote: " + insErr.message);
                            }
                        } catch (invErr) {
                            // ROLLBACK COMPENSATORIO
                            console.error("Fallo crítico ajustando inventario físico post-registro. Revirtiendo...", invErr);
                            await supabase.from('ajustes_inventario').delete().eq('id', ajusteId);
                            throw new Error("El ajuste se guardó pero falló el movimiento físico de inventario. Por seguridad se anuló la operación. Intente de nuevo.");
                        }`;

const repl = `                        // FASE 3: Modificar Inventario Físico con Rollback de seguridad
                        let idsLotesIncrementoInsertados = [];

                        try {
                            // 3.1 PRIMERO: Inserts de Incrementos (Riesgo bajo, reversión fácil)
                            if (itemsIncremento.length > 0) {
                                const lotesInsert = itemsIncremento.map(item => ({
                                    producto_id: item.productoId,
                                    cantidad_inicial: item.cantidad,
                                    cantidad_actual: item.cantidad,
                                    costo_unitario: item.costo_unitario,
                                    fecha_ingreso: fecha,
                                    referencia: \`Ajuste de Inventario #\${nextNumero}\`
                                }));
                                
                                // Usamos select() para obtener los IDs reales en caso de necesitar rollback
                                const { data: lotesGuardados, error: insErr } = await supabase.from('lotes_fifo').insert(lotesInsert).select();
                                if (insErr) throw new Error("Fallo al insertar lote de incremento: " + insErr.message);
                                
                                idsLotesIncrementoInsertados = lotesGuardados.map(l => l.id);
                            }

                            // 3.2 SEGUNDO: Disminuciones FIFO (Riesgo alto, toca lotes existentes)
                            if (itemsDisminucion.length > 0 && planDisminucion) {
                                await InventarioUtils.ejecutarPlanInventario(planDisminucion.operacionesDB);
                            }

                        } catch (invErr) {
                            // ROLLBACK COMPENSATORIO TOTAL
                            console.error("Fallo crítico ajustando inventario físico post-registro. Revirtiendo...", invErr);
                            
                            // A. Revertir los incrementos (si llegaron a insertarse)
                            if (idsLotesIncrementoInsertados.length > 0) {
                                await supabase.from('lotes_fifo').delete().in('id', idsLotesIncrementoInsertados);
                            }

                            // B. Revertir la cabecera del ajuste
                            await supabase.from('ajustes_inventario').delete().eq('id', ajusteId);
                            
                            throw new Error("El ajuste falló al mover el inventario físico. Se ha revertido por completo por seguridad. Intente de nuevo.");
                        }`;

const safeReplace = (content, target, repl) => {
    let t = target.replace(/\r/g, '');
    let r = repl.replace(/\r/g, '');
    let c = content.replace(/\r/g, '');
    if (c.includes(t)) {
        return c.replace(t, r);
    }
    return null;
};

let result = safeReplace(text, target, repl);
if (result) {
    fs.writeFileSync(path, result, 'utf8');
    console.log("Success ajustes");
} else {
    console.error("Match failed ajustes");
}
