// NUKE SCRIPT - Autorizado por el usuario para erradicar la cotizacion 6749
(async function nukeGhostQuote() {
    console.log("Iniciando secuencia de erradicación nuclear para cotización 6749...");
    
    // Función auxiliar para purgar por número en cualquier tabla
    const purgeByNumero = async (key) => {
        let items = DB.getAll(key) || [];
        const originalLength = items.length;
        items = items.filter(c => c && String(c.numero) !== '6749' && String(c.numero) !== '6748'); // Erradicamos 6749 y 6748 (basado en la screenshot)
        if (items.length !== originalLength) {
            console.log(`Purgados ${originalLength - items.length} registros fantasma en la tabla: ${key}`);
            await DB._persist(key, items);
        }
    };

    // Purga directa en cabeceras locales y de Alegra
    await purgeByNumero(DB.KEYS.COTIZACIONES);
    await purgeByNumero(DB.KEYS.COTIZACIONES_ALEGRA);

    // Búsqueda profunda para extraer el ID real y matar los detalles
    let allCots = [...(DB.getAll(DB.KEYS.COTIZACIONES) || []), ...(DB.getAll(DB.KEYS.COTIZACIONES_ALEGRA) || [])];
    const ghostCots = allCots.filter(c => c && (String(c.numero) === '6749' || String(c.numero) === '6748'));
    
    let details = DB.getAll(DB.KEYS.COTIZACION_DETAILS) || [];
    let initialDetailsCount = details.length;
    
    for (const ghost of ghostCots) {
        details = details.filter(d => d && String(d.cotizacion_id) !== String(ghost.id) && String(d.cotizacion_id) !== String(ghost.id_alegra));
        // Erradicación extra por si el ID local también coincide con los parametros borrados
        await DB.delete(DB.KEYS.COTIZACIONES, ghost.id);
        await DB.delete(DB.KEYS.COTIZACIONES_ALEGRA, ghost.id_alegra);
    }
    
    if (details.length !== initialDetailsCount) {
        await DB._persist(DB.KEYS.COTIZACION_DETAILS, details);
        console.log(`Purgados ${initialDetailsCount - details.length} detalles huérfanos.`);
    }

    console.log("Erradicación nuclear completada con éxito.");
})();
