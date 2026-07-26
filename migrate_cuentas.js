import DB from './js/core/db.js';
import { TesoreriaModule } from './js/modules/bancos/bancos.js';

window.runMigrationCuentas = async function() {
    console.log("Iniciando migración de cuentas bancarias a Firestore...");
    
    // Leemos el arreglo estático actual
    const cuentas = TesoreriaModule.cuentasConfig;
    
    // Protección 1: Detección de duplicados
    const nombres = cuentas.map(c => c.nombre);
    const duplicados = [...new Set(nombres.filter((item, index) => nombres.indexOf(item) !== index))];
    
    let mensajeConfirm = `Se encontraron ${cuentas.length} cuentas bancarias estáticas.\nSe migrarán a la colección 'cuentas_bancarias' en Firestore con estado 'activo'.`;
    
    if (duplicados.length > 0) {
        mensajeConfirm += `\n\n⚠️ ¡ADVERTENCIA! Se detectaron nombres duplicados:\n- ${duplicados.join('\n- ')}\n\nSi continúas, el último sobrescribirá al primero en Firestore.`;
    }
    
    mensajeConfirm += `\n\n¿Deseas proceder?`;
    
    const confirmar = confirm(mensajeConfirm);
    if (!confirmar) {
        console.log("Migración cancelada por el usuario.");
        return;
    }

    let migradas = 0;
    const errores = [];
    
    for (const c of cuentas) {
        // Protección 2: Validación de nombre vacío o con '/' (Firebase no lo soporta en doc IDs)
        if (!c.nombre || c.nombre.trim() === '') {
            errores.push({ cuenta: 'Desconocida', motivo: 'Nombre vacío' });
            continue;
        }
        if (c.nombre.includes('/')) {
            errores.push({ cuenta: c.nombre, motivo: 'Contiene carácter inválido (/)' });
            continue;
        }

        try {
            const cuentaDoc = {
                id: c.nombre, 
                nombre: c.nombre,
                tipo: c.tipo,
                numero: c.numero,
                estado: 'activo',
                timestamp_migracion: new Date().toISOString()
            };
            
            await DB.save('cuentas_bancarias', cuentaDoc);
            migradas++;
            console.log(`✅ Migrada: ${c.nombre}`);
        } catch(error) {
            errores.push({ cuenta: c.nombre, motivo: error.message });
            console.error(`❌ Error migrando ${c.nombre}:`, error);
        }
    }
    
    console.log(`\n=========================================`);
    console.log(`Migración finalizada. Éxitos: ${migradas} / ${cuentas.length}`);
    if (errores.length > 0) {
        console.log(`Se omitieron ${errores.length} cuentas por errores:`, errores);
    }
    alert(`Migración completada exitosamente.\n\nMigradas: ${migradas}\nErrores/Omitidas: ${errores.length}`);
};
