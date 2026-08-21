const fs = require('fs');

const path = 'js/shared/inventarioUtils.js';
let text = fs.readFileSync(path, 'utf8');

const target = `    /**
     * FASE 2 (Write): Toma el plan de operaciones y ejecuta los guardados físicos en base de datos.
     */
    async ejecutarPlanInventario(operacionesDB) {
        if (!operacionesDB || operacionesDB.length === 0) return;
        
        for (const op of operacionesDB) {
            await DB.save('lotes_fifo', op.data);
        }
    },`;

const repl = `    /**
     * FASE 2 (Write): Toma el plan de operaciones y ejecuta los guardados físicos en base de datos.
     * Implementa rollback interno LIFO en caso de fallos parciales.
     */
    async ejecutarPlanInventario(operacionesDB) {
        if (!operacionesDB || operacionesDB.length === 0) return;
        
        // Pila de instrucciones compensatorias (LIFO)
        const compensaciones = [];
        
        try {
            for (const op of operacionesDB) {
                if (op.action === 'update') {
                    // 1. Snapshot ANTES de pisar el registro existente
                    const snapshotPrevio = await DB.get('lotes_fifo', op.data.id);
                    if (!snapshotPrevio) throw new Error(\`El lote \${op.data.id} ya no existe.\`);
                    
                    // Instrucción para revertir: Volver a hacer UPDATE con los datos viejos
                    compensaciones.push({ tipo: 'restaurar', data: snapshotPrevio });
                    
                    await DB.save('lotes_fifo', op.data);
                    
                } else if (op.action === 'insert') {
                    // 1. Insertamos y capturamos la fila resultante (con el ID real de Postgres)
                    const loteGuardado = await DB.save('lotes_fifo', op.data);
                    
                    // Instrucción para revertir: ELIMINAR el lote recién creado
                    compensaciones.push({ tipo: 'eliminar', idReal: loteGuardado.id });
                }
            }
        } catch (errorOriginal) {
            console.error("Fallo aplicando lote FIFO. Iniciando rollback interno...", errorOriginal);
            
            // Ejecutar las instrucciones compensatorias en orden INVERSO
            for (let i = compensaciones.length - 1; i >= 0; i--) {
                const comp = compensaciones[i];
                try {
                    if (comp.tipo === 'restaurar') {
                        await DB.save('lotes_fifo', comp.data);
                    } else if (comp.tipo === 'eliminar') {
                        await DB.delete('lotes_fifo', comp.idReal);
                    }
                } catch (errRollback) {
                    console.error("Fallo CRÍTICO compensando lote en BD:", errRollback);
                }
            }
            
            throw new Error("Transacción física fallida. Los lotes tocados fueron revertidos. Error: " + errorOriginal.message);
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

let result = safeReplace(text, target, repl);
if (result) {
    fs.writeFileSync(path, result, 'utf8');
    console.log("Success utils");
} else {
    console.error("Match failed utils");
}
