const fs = require('fs');
const path = 'js/modules/ingresos/notasCredito.js';
let text = fs.readFileSync(path, 'utf8');

const target2 = `                        // 1. Reversión de inventario
                        const invResult = await InventarioUtils.revertirSalidaInventario(selectedItems);
                        if (!invResult.success) throw new Error("Error revirtiendo inventario: " + invResult.error);

                        // 2. Obtener num NC
                        const { data: seqData, error: seqError } = await supabase.rpc('execute_sql', { sql_query: "SELECT nextval('notas_credito_seq');" });
                        let ncNumero = 1;
                        if (!seqError && seqData && seqData.length > 0) {
                            ncNumero = parseInt(seqData[0].nextval);
                        } else {
                            // Si el RPC falla (ej. permisos), hacemos fallback manual (esto puede pasar en bases con RLS restrictivo)
                            const { data: maxNc } = await supabase.from('notas_credito').select('numero').order('numero', { ascending: false }).limit(1);
                            ncNumero = (maxNc && maxNc.length > 0 && maxNc[0].numero) ? maxNc[0].numero + 1 : 1;
                        }

                        // 3. Crear Nota
                        const { data: ncGuardada, error: ncErr } = await supabase.from('notas_credito').insert([{
                            numero: ncNumero,
                            factura_id: currentFactura.id,
                            contacto_id: currentFactura.contacto_id || currentFactura.clienteId,
                            fecha: element.querySelector('#nc-fecha').value,
                            motivo: element.querySelector('#nc-motivo').value,
                            total: totalNC,
                            estado: 'activa'
                        }]).select().single();
                        
                        if (ncErr) throw ncErr;

                        // 4. Crear detalles
                        const detallesArr = selectedItems.map(si => ({
                            nota_credito_id: ncGuardada.id,
                            producto_id: parseInt(si.productoId),
                            cantidad: si.cantidad,
                            precio_unitario: si.precio,
                            subtotal: si.subtotal
                        }));
                        const { error: detErr } = await supabase.from('nota_credito_detalles').insert(detallesArr);
                        if (detErr) throw new Error("Error al guardar detalles de la nota: " + detErr.message);

                        // 5. Inyectar pago cruzado en pagos_ingresos
                        const { error: pagoErr } = await supabase.from('pagos_ingresos').insert([{
                            factura_id: currentFactura.id,
                            fecha: element.querySelector('#nc-fecha').value,
                            monto: totalNC,
                            tipo: 'in', // abono a la factura
                            cuenta_id: null,
                            estado: 'completado',
                            observaciones: 'Pago cruzado por Nota de Crédito #' + ncNumero,
                            referencia: 'NC-' + ncNumero
                        }]);
                        if (pagoErr) throw new Error("Error al cruzar saldo en pagos: " + pagoErr.message);

                        CoreActions.showSuccessModal("Nota de crédito creada con éxito. Inventario revertido.");`;

const repl2 = `                        // 1. FASE 1: Cálculo en memoria (Read-Only)
                        const planReversion = await InventarioUtils.calcularReversionInventario(selectedItems);
                        if (!planReversion.success) throw new Error("Error calculando inventario: " + planReversion.error);

                        // 2. Obtener num NC
                        const { data: seqData, error: seqError } = await supabase.rpc('execute_sql', { sql_query: "SELECT nextval('notas_credito_seq');" });
                        let ncNumero = 1;
                        if (!seqError && seqData && seqData.length > 0) {
                            ncNumero = parseInt(seqData[0].nextval);
                        } else {
                            const { data: maxNc } = await supabase.from('notas_credito').select('numero').order('numero', { ascending: false }).limit(1);
                            ncNumero = (maxNc && maxNc.length > 0 && maxNc[0].numero) ? maxNc[0].numero + 1 : 1;
                        }

                        let ncId = null;
                        let pagoId = null;

                        try {
                            // 3. FASE 2: Escritura Documental Escalona (Segura)
                            
                            // a. Crear Cabecera
                            const { data: ncGuardada, error: ncErr } = await supabase.from('notas_credito').insert([{
                                numero: ncNumero,
                                factura_id: currentFactura.id,
                                contacto_id: currentFactura.contacto_id || currentFactura.clienteId,
                                fecha: element.querySelector('#nc-fecha').value,
                                motivo: element.querySelector('#nc-motivo').value,
                                total: totalNC,
                                estado: 'activa'
                            }]).select().single();
                            
                            if (ncErr) throw new Error("Fallo al crear cabecera: " + ncErr.message);
                            ncId = ncGuardada.id;

                            // b. Crear Detalles
                            const detallesArr = selectedItems.map(si => ({
                                nota_credito_id: ncId,
                                producto_id: parseInt(si.productoId),
                                cantidad: si.cantidad,
                                precio_unitario: si.precio,
                                subtotal: si.subtotal
                            }));
                            const { error: detErr } = await supabase.from('nota_credito_detalles').insert(detallesArr);
                            if (detErr) throw new Error("Error al guardar detalles de la nota: " + detErr.message);

                            // c. Inyectar pago cruzado en pagos_ingresos
                            const { data: pagoCruzado, error: pagoErr } = await supabase.from('pagos_ingresos').insert([{
                                factura_id: currentFactura.id,
                                fecha: element.querySelector('#nc-fecha').value,
                                monto: totalNC,
                                tipo: 'in', // abono a la factura
                                cuenta_id: null,
                                estado: 'completado',
                                observaciones: 'Pago cruzado por Nota de Crédito #' + ncNumero,
                                referencia: 'NC-' + ncNumero
                            }]).select().single();
                            if (pagoErr) throw new Error("Error al cruzar saldo en pagos: " + pagoErr.message);
                            pagoId = pagoCruzado.id;

                            // 4. FASE 3: Modificación Física de Inventario con Rollback interno
                            await InventarioUtils.ejecutarPlanInventario(planReversion.operacionesDB);

                        } catch (errorTransaccion) {
                            console.error("Fallo crítico en transacción. Revirtiendo creación de nota de crédito...", errorTransaccion);
                            
                            // 5. ROLLBACK COMPENSATORIO EXTERNO
                            if (pagoId) await supabase.from('pagos_ingresos').delete().eq('id', pagoId);
                            if (ncId) {
                                // Borrar detalles explícitamente para evitar orphans
                                await supabase.from('nota_credito_detalles').delete().eq('nota_credito_id', ncId);
                                await supabase.from('notas_credito').delete().eq('id', ncId);
                            }
                            
                            throw new Error("Transacción fallida. Se abortó la creación y el inventario físico quedó intacto. Detalle: " + errorTransaccion.message);
                        }

                        CoreActions.showSuccessModal("Nota de crédito creada con éxito. Inventario actualizado.");`;

const safeReplace = (content, target, repl) => {
    let t = target.replace(/\r/g, '');
    let r = repl.replace(/\r/g, '');
    let c = content.replace(/\r/g, '');
    if (c.includes(t)) {
        return c.replace(t, r);
    }
    return null;
};

let result = safeReplace(text, target2, repl2);
if (result) {
    fs.writeFileSync(path, result, 'utf8');
    console.log("Success nc2");
} else {
    console.error("Match failed nc2");
}
