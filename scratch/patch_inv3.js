const fs = require('fs');
const path = 'js/shared/inventarioUtils.js';
let text = fs.readFileSync(path, 'utf8');

const target = `    /**
     * Devuelve el inventario (restaurando cantidadActual) de lotes previamente mermados.
     * Se usa al borrar/anular facturas de venta.
     */
    async revertirSalidaInventario(detalles) {
        try {
            const lotesGlobales = await DB.getAll('lotes_fifo');
            const productos = await DB.getAll('productos');
            
            let qtyARevertirPorProducto = {};
            for (const det of detalles) {
                const prodId = String(det.productoId);
                qtyARevertirPorProducto[prodId] = (qtyARevertirPorProducto[prodId] || 0) + parseFloat(det.cantidad);
            }

            for (const prodId in qtyARevertirPorProducto) {
                let qtyToReturn = qtyARevertirPorProducto[prodId];
                
                // Lotes del producto que tienen espacio (fueron mermados o son negativos)
                const lotesProd = lotesGlobales.filter(l => 
                    String(l.productoId) === prodId && 
                    parseFloat(l.cantidadActual) < parseFloat(l.cantidadInicial)
                );
                
                // Ordenar del más antiguo al más nuevo (revertimos rellenando los lotes más viejos primero, que fueron los primeros en ser descontados por FIFO)
                lotesProd.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso));

                for (const lote of lotesProd) {
                    if (qtyToReturn <= 0) break;
                    
                    const espacioDisponible = parseFloat(lote.cantidadInicial) - parseFloat(lote.cantidadActual);
                    if (espacioDisponible > 0) {
                        const add = Math.min(espacioDisponible, qtyToReturn);
                        lote.cantidadActual = parseFloat(lote.cantidadActual) + add;
                        qtyToReturn -= add;
                        await DB.save('lotes_fifo', lote);
                    }
                }

                // Si aún queda por devolver (ej. lotes borrados), crear un lote positivo compensatorio.
                // Usamos 0.0001 para ignorar residuos microscópicos de punto flotante de JS (ej. 1e-15)
                if (qtyToReturn > 0.0001) {
                    const prod = productos.find(p => String(p.id) === prodId);
                    const costoUnitario = prod ? (prod.precio_compra || prod.precioCompra || 0) : 0;
                    
                    const nuevoLote = {
                        id: 'lote_rev_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                        productoId: parseInt(prodId),
                        fechaIngreso: getLocalDate(),
                        cantidadInicial: qtyToReturn,
                        cantidadActual: qtyToReturn,
                        costoUnitario: costoUnitario
                    };
                    await DB.save('lotes_fifo', nuevoLote);
                }
            }
            return { success: true };
        } catch (error) {
            console.error("Error revirtiendo inventario:", error);
            return { success: false, error: "Fallo al revertir el inventario: " + error.message };
        }
    }`;

const repl = `    /**
     * Calcula cómo devolver el inventario (restaurando cantidadActual) de lotes previamente mermados.
     * Genera un plan de operaciones (update/insert) listo para ser ejecutado con \`ejecutarPlanInventario\`.
     * Se usa al borrar/anular facturas de venta o procesar notas de crédito.
     */
    async calcularReversionInventario(detalles) {
        try {
            const lotesGlobales = await DB.getAll('lotes_fifo');
            const productos = await DB.getAll('productos');
            const operacionesDB = [];
            
            let qtyARevertirPorProducto = {};
            for (const det of detalles) {
                const prodId = String(det.productoId);
                qtyARevertirPorProducto[prodId] = (qtyARevertirPorProducto[prodId] || 0) + parseFloat(det.cantidad);
            }

            for (const prodId in qtyARevertirPorProducto) {
                let qtyToReturn = qtyARevertirPorProducto[prodId];
                
                // Lotes del producto que tienen espacio (fueron mermados o son negativos)
                const lotesProd = lotesGlobales.filter(l => 
                    String(l.productoId) === prodId && 
                    parseFloat(l.cantidadActual) < parseFloat(l.cantidadInicial)
                );
                
                // Ordenar del más antiguo al más nuevo (revertimos rellenando los lotes más viejos primero, que fueron los primeros en ser descontados por FIFO)
                lotesProd.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso));

                for (const lote of lotesProd) {
                    if (qtyToReturn <= 0) break;
                    
                    const espacioDisponible = parseFloat(lote.cantidadInicial) - parseFloat(lote.cantidadActual);
                    if (espacioDisponible > 0) {
                        const add = Math.min(espacioDisponible, qtyToReturn);
                        lote.cantidadActual = parseFloat(lote.cantidadActual) + add;
                        qtyToReturn -= add;
                        operacionesDB.push({ action: 'update', data: { ...lote } });
                    }
                }

                // Si aún queda por devolver (ej. lotes borrados), crear un lote positivo compensatorio.
                // Usamos 0.0001 para ignorar residuos microscópicos de punto flotante de JS (ej. 1e-15)
                if (qtyToReturn > 0.0001) {
                    const prod = productos.find(p => String(p.id) === prodId);
                    const costoUnitario = prod ? (prod.precio_compra || prod.precioCompra || 0) : 0;
                    
                    const nuevoLote = {
                        id: 'lote_rev_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                        productoId: parseInt(prodId),
                        fechaIngreso: getLocalDate(),
                        cantidadInicial: qtyToReturn,
                        cantidadActual: qtyToReturn,
                        costoUnitario: costoUnitario
                    };
                    operacionesDB.push({ action: 'insert', data: nuevoLote });
                }
            }
            return { success: true, operacionesDB };
        } catch (error) {
            console.error("Error calculando reversion de inventario:", error);
            return { success: false, error: "Fallo al calcular reversion de inventario: " + error.message };
        }
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
    console.log("Success utils patch");
} else {
    console.error("Match failed utils patch");
}
