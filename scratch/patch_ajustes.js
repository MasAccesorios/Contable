const fs = require('fs');

const path = 'js/modules/inventario/ajustes.js';
let text = fs.readFileSync(path, 'utf8');

const target = `                        // 2. Procesar Inventario Híbrido
                        const itemsIncremento = itemsAjuste.filter(i => i.tipo === 'incremento');
                        const itemsDisminucion = itemsAjuste.filter(i => i.tipo === 'disminucion');

                        // DISMINUCIONES (Vía FIFO)
                        if (itemsDisminucion.length > 0) {
                            const result = await InventarioUtils.procesarSalidaInventario(itemsDisminucion);
                            if (!result.success) throw new Error("Error en Disminución: " + result.error);
                            
                            // Re-asignamos costos calculados por FIFO a nuestro historial
                            itemsDisminucion.forEach((item, idx) => {
                                const actualizado = result.detallesActualizados.find(d => String(d.productoId) === String(item.productoId) && d.cantidad === item.cantidad);
                                if (actualizado) {
                                    item.costo_unitario = (actualizado.costoTotalCalculado / item.cantidad) || 0;
                                }
                            });
                        }

                        // INCREMENTOS (Insert Directo)
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
                            if (insErr) throw insErr;
                        }

                        // 3. Guardar Cabecera de Ajuste
                        const payload = {
                            numero: nextNumero,
                            fecha: fecha,
                            observaciones: obs,
                            detalles: itemsAjuste
                        };

                        const { error: hdrErr } = await supabase.from('ajustes_inventario').insert([payload]);
                        if (hdrErr) throw hdrErr;

                        CoreActions.showSuccessModal("Ajuste de inventario guardado correctamente.");`;

const repl = `                        // 2. Procesar Inventario Híbrido
                        const itemsIncremento = itemsAjuste.filter(i => i.tipo === 'incremento');
                        const itemsDisminucion = itemsAjuste.filter(i => i.tipo === 'disminucion');

                        let planDisminucion = null;

                        // FASE 1: Simulación de salida (READ ONLY)
                        if (itemsDisminucion.length > 0) {
                            planDisminucion = await InventarioUtils.calcularSalidaInventario(itemsDisminucion);
                            if (!planDisminucion.success) throw new Error("Error en Disminución: " + planDisminucion.error);
                            
                            // Re-asignamos costos calculados por FIFO a nuestro historial
                            itemsDisminucion.forEach((item, idx) => {
                                const actualizado = planDisminucion.detallesActualizados.find(d => String(d.productoId) === String(item.productoId) && d.cantidad === item.cantidad);
                                if (actualizado) {
                                    item.costo_unitario = (actualizado.costoTotalCalculado / item.cantidad) || 0;
                                }
                            });
                        }

                        // FASE 2: Guardar documento principal (Ajuste)
                        const payload = {
                            numero: nextNumero,
                            fecha: fecha,
                            observaciones: obs,
                            detalles: itemsAjuste
                        };

                        // Se usa .select().single() para obtener el ID en caso de necesitar rollback
                        const { data: hdrData, error: hdrErr } = await supabase.from('ajustes_inventario').insert([payload]).select().single();
                        if (hdrErr) throw new Error("Fallo al guardar el ajuste de inventario: " + hdrErr.message);
                        const ajusteId = hdrData.id;

                        // FASE 3: Modificar Inventario Físico con Rollback de seguridad
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
                        }

                        CoreActions.showSuccessModal("Ajuste de inventario guardado correctamente.");`;

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
    console.log("Success");
} else {
    console.error("Match failed");
}
