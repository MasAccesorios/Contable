-- =============================================================================
-- RECONCILIACIÓN DE INVENTARIO DEFINITIVA (AUDITORÍA KARDEX)
-- Archivo: scripts/actualizar_reconciliacion_productos_nuevos.sql
-- Ejecución: Supabase Dashboard > SQL Editor
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_reconciliacion_inventario()
 RETURNS TABLE(
    sku text,
    nombre text,
    tiene_checkpoint boolean,
    checkpoint numeric,
    fecha_checkpoint timestamp with time zone,
    vendido_despues numeric,
    esperado numeric,
    actual numeric,
    discrepancia numeric
 )
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
-- 1. PRODUCTOS DISCRETOS CON CHECKPOINT (Ajuste histórico O Producto nuevo de Factura de Compra)
-- Nota: Se excluye explícitamente el Rollo Madre 2046 ('5000-ROLLO'), ya que este se reconcilia en la Sección 3 (POOL-NANOCARBON).
SELECT
    p.sku,
    p.nombre,
    TRUE  AS tiene_checkpoint,
    c.a   AS checkpoint,
    c.created_at AS fecha_checkpoint,
    COALESCE(SUM(ABS(lfm_limpia.diferencia)) FILTER (
        WHERE lfm_limpia.diferencia < 0
          AND (lfm_limpia.origen_documento IS NULL
               OR lfm_limpia.origen_documento NOT LIKE 'ajuste:%')
    ), 0) AS vendido_despues,
    c.a + COALESCE(SUM(lfm_limpia.diferencia), 0) AS esperado,
    COALESCE((
        SELECT SUM(lf.cantidad_actual)
        FROM lotes_fifo lf
        WHERE lf.producto_id = p.id
    ), 0) AS actual,
    COALESCE((
        SELECT SUM(lf.cantidad_actual)
        FROM lotes_fifo lf
        WHERE lf.producto_id = p.id
    ), 0) - (c.a + COALESCE(SUM(lfm_limpia.diferencia), 0)) AS discrepancia
FROM productos p
CROSS JOIN LATERAL (
    SELECT c_sub.created_at, c_sub.a
    FROM (
        -- Prioridad 1: Último ajuste de inventario registrado (conteo físico histórico)
        SELECT ai.created_at, item.a, 1 AS prioridad
        FROM ajustes_inventario ai
        CROSS JOIN LATERAL jsonb_to_recordset(ai.detalles) AS item(sku text, a numeric)
        WHERE item.sku = p.sku
          AND item.a IS NOT NULL

        UNION ALL

        -- Prioridad 2: Para productos nuevos nacidos por Factura de Compra (ej. SKU 2329)
        -- Punto de partida = 0 al momento de creación del producto
        SELECT p.created_at, 0::numeric AS a, 2 AS prioridad
        WHERE EXISTS (
            SELECT 1 FROM lotes_fifo lf WHERE lf.producto_id = p.id
        )
    ) c_sub
    ORDER BY c_sub.prioridad ASC, c_sub.created_at DESC
    LIMIT 1
) c
LEFT JOIN (
    SELECT DISTINCT ON (id)
           id, producto_id, creado_en, diferencia, origen_documento
    FROM lotes_fifo_movimientos lm1
    WHERE NOT (
        lm1.tipo_operacion = 'update'
        AND EXISTS (
            SELECT 1 FROM lotes_fifo_movimientos lm2
            WHERE lm2.lote_id = lm1.lote_id
              AND lm2.creado_en = lm1.creado_en
              AND lm2.tipo_operacion <> 'update'
        )
    )
) lfm_limpia
    ON lfm_limpia.producto_id = p.id
    AND lfm_limpia.creado_en >= c.created_at
WHERE p.id NOT IN (SELECT producto_id FROM nanocarbon_factores_corte)
  AND p.id != 2046 
  AND COALESCE(p.sku, '') NOT IN ('5000-ROLLO', 'POOL-NANOCARBON')
GROUP BY p.sku, p.nombre, p.id, c.a, c.created_at

UNION ALL

-- 2. PRODUCTOS SIN CHECKPOINT (Productos creados sin ajuste y sin ningún lote de compra)
SELECT
    p.sku,
    p.nombre,
    FALSE AS tiene_checkpoint,
    NULL  AS checkpoint,
    NULL  AS fecha_checkpoint,
    NULL  AS vendido_despues,
    NULL  AS esperado,
    COALESCE((
        SELECT SUM(lf.cantidad_actual)
        FROM lotes_fifo lf
        WHERE lf.producto_id = p.id
    ), 0) AS actual,
    NULL  AS discrepancia
FROM productos p
WHERE NOT EXISTS (
    SELECT 1
    FROM ajustes_inventario ai
    CROSS JOIN LATERAL jsonb_to_recordset(ai.detalles) AS item(sku text, a numeric)
    WHERE item.sku = p.sku
      AND item.a IS NOT NULL
)
AND NOT EXISTS (
    SELECT 1 FROM lotes_fifo lf WHERE lf.producto_id = p.id
)
AND p.id NOT IN (SELECT producto_id FROM nanocarbon_factores_corte)
AND p.id != 2046
AND COALESCE(p.sku, '') NOT IN ('5000-ROLLO', 'POOL-NANOCARBON')

UNION ALL

-- 3. POOL-NANOCARBON (Reconciliación matemática exclusiva del Rollo Madre 2046)
SELECT
    'POOL-NANOCARBON' AS sku,
    'Rollo NanoCarbón (material compartido) - reconciliación de pool' AS nombre,
    TRUE AS tiene_checkpoint,
    pool_check.cantidad_inicial AS checkpoint,
    pool_check.created_at AS fecha_checkpoint,
    COALESCE((
        SELECT SUM(
            CASE 
                WHEN ncf.metros_por_unidad IS NOT NULL THEN ABS(lm.diferencia) * ncf.metros_por_unidad
                ELSE ABS(lm.diferencia)
            END
        )
        FROM (
            SELECT DISTINCT ON (id)
                   id, producto_id, creado_en, diferencia, origen_documento
            FROM lotes_fifo_movimientos lm1
            WHERE NOT (
                lm1.tipo_operacion = 'update'
                AND EXISTS (
                    SELECT 1 FROM lotes_fifo_movimientos lm2
                    WHERE lm2.lote_id = lm1.lote_id
                      AND lm2.creado_en = lm1.creado_en
                      AND lm2.tipo_operacion <> 'update'
                )
            )
        ) lm
        LEFT JOIN nanocarbon_factores_corte ncf ON ncf.producto_id = lm.producto_id
        WHERE (lm.producto_id = 2046 OR ncf.producto_id IS NOT NULL)
          AND lm.diferencia < 0
          AND lm.creado_en >= pool_check.created_at
          AND (lm.origen_documento IS NULL OR lm.origen_documento NOT LIKE 'ajuste:%')
    ), 0) AS vendido_despues,
    pool_check.cantidad_inicial - COALESCE((
        SELECT SUM(
            CASE 
                WHEN ncf.metros_por_unidad IS NOT NULL THEN ABS(lm.diferencia) * ncf.metros_por_unidad
                ELSE ABS(lm.diferencia)
            END
        )
        FROM (
            SELECT DISTINCT ON (id)
                   id, producto_id, creado_en, diferencia, origen_documento
            FROM lotes_fifo_movimientos lm1
            WHERE NOT (
                lm1.tipo_operacion = 'update'
                AND EXISTS (
                    SELECT 1 FROM lotes_fifo_movimientos lm2
                    WHERE lm2.lote_id = lm1.lote_id
                      AND lm2.creado_en = lm1.creado_en
                      AND lm2.tipo_operacion <> 'update'
                )
            )
        ) lm
        LEFT JOIN nanocarbon_factores_corte ncf ON ncf.producto_id = lm.producto_id
        WHERE (lm.producto_id = 2046 OR ncf.producto_id IS NOT NULL)
          AND lm.diferencia < 0
          AND lm.creado_en >= pool_check.created_at
          AND (lm.origen_documento IS NULL OR lm.origen_documento NOT LIKE 'ajuste:%')
    ), 0) AS esperado,
    (SELECT SUM(cantidad_actual) FROM lotes_fifo WHERE producto_id = 2046) AS actual,
    (SELECT SUM(cantidad_actual) FROM lotes_fifo WHERE producto_id = 2046) -
    (pool_check.cantidad_inicial - COALESCE((
        SELECT SUM(
            CASE 
                WHEN ncf.metros_por_unidad IS NOT NULL THEN ABS(lm.diferencia) * ncf.metros_por_unidad
                ELSE ABS(lm.diferencia)
            END
        )
        FROM (
            SELECT DISTINCT ON (id)
                   id, producto_id, creado_en, diferencia, origen_documento
            FROM lotes_fifo_movimientos lm1
            WHERE NOT (
                lm1.tipo_operacion = 'update'
                AND EXISTS (
                    SELECT 1 FROM lotes_fifo_movimientos lm2
                    WHERE lm2.lote_id = lm1.lote_id
                      AND lm2.creado_en = lm1.creado_en
                      AND lm2.tipo_operacion <> 'update'
                )
            )
        ) lm
        LEFT JOIN nanocarbon_factores_corte ncf ON ncf.producto_id = lm.producto_id
        WHERE (lm.producto_id = 2046 OR ncf.producto_id IS NOT NULL)
          AND lm.diferencia < 0
          AND lm.creado_en >= pool_check.created_at
          AND (lm.origen_documento IS NULL OR lm.origen_documento NOT LIKE 'ajuste:%')
    ), 0)) AS discrepancia
FROM (
    SELECT cantidad_inicial, fecha_ingreso, created_at
    FROM lotes_fifo
    WHERE producto_id = 2046 AND origen_movimiento = 'conteo_fisico_inicial'
    ORDER BY created_at DESC
    LIMIT 1
) pool_check

ORDER BY tiene_checkpoint DESC, sku;
$function$;
