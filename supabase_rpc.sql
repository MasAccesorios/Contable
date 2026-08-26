-- ========================================================
-- RPCs de Supabase -- MAS Accesorios
-- Proyecto: oejeqszwxuucgotvdrmk
-- Ultima actualizacion: 2026-08-25
-- NOTA: Este archivo es documentacion local.
--       Para desplegar cambios, ejecutar en:
--       Supabase Dashboard -> SQL Editor
-- ========================================================


-- ========================================================
-- 1. RPC: get_next_numero
-- Lee el proximo numero disponible SIN consumirlo.
-- Fuente de verdad: documentos_numero_seq (compartida).
-- contadores_documentos es vestigial y se ignora en lectura.
-- ========================================================
CREATE OR REPLACE FUNCTION get_next_numero(p_table text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_next bigint;
BEGIN
    IF p_table NOT IN ('facturas', 'cotizaciones') THEN
        RAISE EXCEPTION 'Tabla % no soportada', p_table;
    END IF;

    SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END
    INTO v_next
    FROM documentos_numero_seq;

    RETURN v_next;
END;
$func$;


-- ========================================================
-- 2. RPC: set_next_numero
-- Actualiza el proximo numero desde el modulo de Configuracion.
-- Actualiza documentos_numero_seq (efecto real en INSERTs)
-- y mantiene contadores_documentos sincronizada (vestigial).
-- ========================================================
CREATE OR REPLACE FUNCTION set_next_numero(p_table text, p_next bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_max_actual bigint;
BEGIN
    IF p_table NOT IN ('facturas', 'cotizaciones') THEN
        RAISE EXCEPTION 'Tabla % no soportada para actualizacion de secuencias', p_table;
    END IF;

    -- Validar contra el MAX real de AMBAS tablas (secuencia compartida)
    SELECT GREATEST(
        COALESCE((SELECT MAX(numero) FROM facturas), 0),
        COALESCE((SELECT MAX(numero) FROM cotizaciones), 0)
    ) INTO v_max_actual;

    IF p_next <= v_max_actual THEN
        RAISE EXCEPTION
            'El numero % es menor o igual al maximo actual en uso (%). '
            'Para avanzar la numeracion usa un valor mayor a %.',
            p_next, v_max_actual, v_max_actual;
    END IF;

    -- Actualizar la secuencia real (esto SI afecta los proximos INSERTs)
    PERFORM setval('documentos_numero_seq', p_next - 1, true);

    -- Mantener contadores_documentos sincronizada por compatibilidad
    UPDATE contadores_documentos
    SET siguiente_numero = p_next
    WHERE tabla = p_table;

    IF NOT FOUND THEN
        INSERT INTO contadores_documentos (tabla, siguiente_numero)
        VALUES (p_table, p_next)
        ON CONFLICT (tabla) DO UPDATE SET siguiente_numero = EXCLUDED.siguiente_numero;
    END IF;
END;
$func$;


-- ========================================================
-- 3. RPC: save_document_with_details
-- Guarda/actualiza facturas o cotizaciones con sus detalles
-- en una unica transaccion atomica.
--
-- INSERT de facturas - logica dual de numeracion:
--   * p_header tiene 'numero' -> conversion cotizacion->factura:
--     usa ese numero y avanza documentos_numero_seq hasta >= el.
--   * p_header sin 'numero'  -> factura nueva: usa nextval().
-- INSERT de cotizaciones: siempre nextval() (sin cambio).
-- ========================================================
CREATE OR REPLACE FUNCTION save_document_with_details(
    p_table     text,
    p_header    jsonb,
    p_details   jsonb,
    p_is_update boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_id     bigint;
    v_numero bigint;
    v_result jsonb;
BEGIN
    IF p_table NOT IN ('facturas', 'cotizaciones') THEN
        RAISE EXCEPTION 'Table % not supported', p_table;
    END IF;

    -- UPDATE -------------------------------------------------
    IF p_is_update THEN
        v_id := (p_header->>'id')::bigint;

        IF p_table = 'facturas' THEN
            UPDATE facturas SET
                fecha                = (p_header->>'fecha')::date,
                vencimiento          = (p_header->>'vencimiento')::date,
                contacto_id          = (p_header->>'contacto_id')::bigint,
                total                = (p_header->>'total')::numeric,
                estado               = p_header->>'estado',
                tipo                 = COALESCE(p_header->>'tipo', 'venta'),
                observaciones        = p_header->>'observaciones',
                cotizacion_origen_id = (p_header->>'cotizacion_origen_id')::bigint
            WHERE id = v_id
            RETURNING to_jsonb(facturas.*) INTO v_result;
            DELETE FROM factura_detalles WHERE factura_id = v_id;

        ELSIF p_table = 'cotizaciones' THEN
            UPDATE cotizaciones SET
                fecha         = (p_header->>'fecha')::date,
                vencimiento   = (p_header->>'vencimiento')::date,
                contacto_id   = (p_header->>'contacto_id')::bigint,
                total         = (p_header->>'total')::numeric,
                estado        = p_header->>'estado',
                observaciones = p_header->>'observaciones'
            WHERE id = v_id
            RETURNING to_jsonb(cotizaciones.*) INTO v_result;
            DELETE FROM cotizacion_detalles WHERE cotizacion_id = v_id;
        END IF;

    -- INSERT -------------------------------------------------
    ELSE
        IF p_table = 'facturas' THEN
            IF p_header->>'numero' IS NOT NULL THEN
                -- Conversion cotizacion->factura: heredar numero de la cotizacion
                v_numero := (p_header->>'numero')::bigint;
                -- Avanzar la secuencia para que nextval() futuro no lo repita
                PERFORM setval(
                    'documentos_numero_seq',
                    GREATEST(v_numero, (SELECT last_value FROM documentos_numero_seq)),
                    true
                );
            ELSE
                -- Factura nueva directa: usar la secuencia compartida
                v_numero := nextval('documentos_numero_seq');
            END IF;

            INSERT INTO facturas (
                numero, fecha, vencimiento, contacto_id,
                total, estado, tipo, observaciones, cotizacion_origen_id
            ) VALUES (
                v_numero,
                (p_header->>'fecha')::date,
                (p_header->>'vencimiento')::date,
                (p_header->>'contacto_id')::bigint,
                (p_header->>'total')::numeric,
                COALESCE(p_header->>'estado', 'open'),
                COALESCE(p_header->>'tipo', 'venta'),
                p_header->>'observaciones',
                (p_header->>'cotizacion_origen_id')::bigint
            ) RETURNING to_jsonb(facturas.*) INTO v_result;

        ELSIF p_table = 'cotizaciones' THEN
            v_numero := nextval('documentos_numero_seq');

            INSERT INTO cotizaciones (
                numero, fecha, vencimiento, contacto_id,
                total, estado, observaciones
            ) VALUES (
                v_numero,
                (p_header->>'fecha')::date,
                (p_header->>'vencimiento')::date,
                (p_header->>'contacto_id')::bigint,
                (p_header->>'total')::numeric,
                COALESCE(p_header->>'estado', 'draft'),
                p_header->>'observaciones'
            ) RETURNING to_jsonb(cotizaciones.*) INTO v_result;
        END IF;

        v_id := (v_result->>'id')::bigint;
    END IF;

    -- DETALLES (misma transaccion atomica) -------------------
    IF p_table = 'facturas' THEN
        INSERT INTO factura_detalles (
            factura_id, producto_id, cantidad, precio_unitario,
            descuento_porcentaje, subtotal, descripcion_personalizada
        )
        SELECT
            v_id,
            (detail->>'producto_id')::bigint,
            (detail->>'cantidad')::numeric,
            (detail->>'precio_unitario')::numeric,
            (detail->>'descuento_porcentaje')::numeric,
            (detail->>'subtotal')::numeric,
            detail->>'descripcion_personalizada'
        FROM jsonb_array_elements(p_details) AS detail;

    ELSIF p_table = 'cotizaciones' THEN
        INSERT INTO cotizacion_detalles (
            cotizacion_id, producto_id, cantidad, precio_unitario,
            descuento_porcentaje, subtotal, descripcion_personalizada
        )
        SELECT
            v_id,
            (detail->>'producto_id')::bigint,
            (detail->>'cantidad')::numeric,
            (detail->>'precio_unitario')::numeric,
            (detail->>'descuento_porcentaje')::numeric,
            (detail->>'subtotal')::numeric,
            detail->>'descripcion_personalizada'
        FROM jsonb_array_elements(p_details) AS detail;
    END IF;

    RETURN v_result;
END;
$func$;


-- ========================================================
-- 4. RPC: get_reconciliacion_inventario
-- Calcula la reconciliacion de movimientos de inventario.
-- Para cada producto con checkpoint (ultimo ajuste con campo
-- "a" en su JSON de detalles), calcula:
--   - vendido_despues : unidades salidas en lotes_fifo_movimientos
--                       desde la fecha del checkpoint, usando
--                       DISTINCT ON para evitar duplicados.
--   - esperado        : checkpoint - vendido_despues
--   - actual          : stock actual en productos.stock
--   - discrepancia    : actual - esperado
--
-- FIX 2026-08-25:
--   ANTES: la consulta usaba una clave de costo en ajustes_inventario
--          y no deduplicaba lotes_fifo_movimientos, inflando salidas.
--   AHORA: lee item.a via jsonb_to_recordset filtrando WHERE a IS NOT NULL,
--          y aplica DISTINCT ON(producto_id, creado_en, diferencia).
-- ========================================================
CREATE OR REPLACE FUNCTION get_reconciliacion_inventario()
RETURNS TABLE (
    sku            text,
    nombre         text,
    tiene_checkpoint boolean,
    checkpoint     numeric,
    fecha_checkpoint timestamptz,
    vendido_despues numeric,
    esperado       numeric,
    actual         numeric,
    discrepancia   numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $func$

-- Productos CON checkpoint
SELECT
    p.sku,
    p.nombre,
    TRUE  AS tiene_checkpoint,
    c.a   AS checkpoint,
    c.created_at AS fecha_checkpoint,
    -- Solo salidas (diferencia negativa), deduplicadas
    COALESCE(SUM(ABS(lfm_limpia.diferencia)) FILTER (WHERE lfm_limpia.diferencia < 0), 0) AS vendido_despues,
    -- Neto desde el checkpoint: incluye entradas (+) y salidas (-)
    c.a + COALESCE(SUM(lfm_limpia.diferencia), 0) AS esperado,
    -- Stock físico real: suma de lotes_fifo activos
    COALESCE((
        SELECT SUM(lf.cantidad_actual)
        FROM lotes_fifo lf
        WHERE lf.producto_id = p.id
    ), 0) AS actual,
    -- Discrepancia: real vs lo que matemáticamente debería haber
    COALESCE((
        SELECT SUM(lf.cantidad_actual)
        FROM lotes_fifo lf
        WHERE lf.producto_id = p.id
    ), 0) - (c.a + COALESCE(SUM(lfm_limpia.diferencia), 0)) AS discrepancia
FROM productos p
CROSS JOIN LATERAL (
    SELECT ai.created_at, item.a
    FROM ajustes_inventario ai
    CROSS JOIN LATERAL jsonb_to_recordset(ai.detalles) AS item(sku text, a numeric)
    WHERE item.sku = p.sku
      AND item.a IS NOT NULL
    ORDER BY ai.created_at DESC
    LIMIT 1
) c
LEFT JOIN (
    -- TODOS los movimientos post-checkpoint deduplicados (entradas y salidas)
    SELECT DISTINCT ON (producto_id, creado_en, diferencia)
           producto_id, creado_en, diferencia
    FROM lotes_fifo_movimientos
) lfm_limpia
    ON lfm_limpia.producto_id = p.id
    AND lfm_limpia.creado_en >= c.created_at
GROUP BY p.sku, p.nombre, p.id, c.a, c.created_at

UNION ALL

-- Productos SIN checkpoint
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
ORDER BY tiene_checkpoint DESC, sku;

$func$;

