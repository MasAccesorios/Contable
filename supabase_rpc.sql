-- ========================================================
-- RPCs de Supabase -- MAS Accesorios
-- Proyecto: oejeqszwxuucgotvdrmk
-- Ultima actualizacion: 2026-08-18
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
