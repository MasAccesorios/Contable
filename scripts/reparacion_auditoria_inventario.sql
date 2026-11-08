-- =============================================================================
-- REPARACIÓN Y NIVELACIÓN DE INVENTARIO (AUDITORÍA KARDEX)
-- Archivo: scripts/reparacion_auditoria_inventario.sql
-- Ejecución: Supabase Dashboard > SQL Editor (Seguro para ejecución "en caliente")
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. CORRECCIÓN DISCREPANCIA 1: PELÍCULA NANOCARBÓN **GARANTIA** (SKU: 5001-, ID: 1809)
-- =============================================================================
-- Causa: 5 salidas de garantía operadas en sobreventa (lote negativo de -5).
-- Solución:
-- a) Crear lote compensatorio de +5 unidades en lotes_fifo para nivelar el stock físico a 0.
-- b) Actualizar run_audit_check_7 para incluir '5001-' en la lista blanca de garantías.

DO $$
DECLARE
    v_stock_actual numeric;
BEGIN
    SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_stock_actual
    FROM lotes_fifo
    WHERE producto_id = 1809;

    -- Solo insertar si el saldo actual sigue siendo negativo (-5)
    IF v_stock_actual < 0 THEN
        INSERT INTO lotes_fifo (
            producto_id,
            cantidad_inicial,
            cantidad_actual,
            costo_unitario,
            fecha_ingreso,
            referencia,
            origen_movimiento
        ) VALUES (
            1809,
            ABS(v_stock_actual),
            ABS(v_stock_actual),
            0,
            CURRENT_DATE,
            'Ajuste compensatorio de garantía auditada - SKU 5001-',
            'ajuste:auditoria_garantias'
        );

        RAISE NOTICE 'Discrepancia 1 resuelta: Lote compensatorio de % unidades insertado para producto 1809.', ABS(v_stock_actual);
    ELSE
        RAISE NOTICE 'Producto 1809 ya se encuentra nivelado (stock en lotes: %).', v_stock_actual;
    END IF;
END $$;

-- Actualizar la función run_audit_check_7 para blindarla con autenticación
-- e incluir '5001-' dentro de las exclusiones válidas de sobreventa/garantía.
CREATE OR REPLACE FUNCTION public.run_audit_check_7()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_fails json;
    v_count int;
BEGIN
    IF auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Acceso denegado: Requiere autenticación.';
    END IF;

    WITH fails AS (
        SELECT p.id AS producto_id, p.sku, p.nombre, SUM(l.cantidad_actual) AS suma_lotes
        FROM productos p
        JOIN lotes_fifo l ON p.id = l.producto_id
        WHERE COALESCE(p.sku, '') NOT IN ('2100-V8', '2100-6S', '5001+', '5002+', '5003+', '5004+', '5005+', '5001-')
        GROUP BY p.id, p.sku, p.nombre
        HAVING SUM(l.cantidad_actual) < -0.001
    )
    SELECT COALESCE(json_agg(row_to_json(f)), '[]'::json), COUNT(*) INTO v_fails, v_count FROM fails f;
    IF v_count = 0 THEN 
        RETURN json_build_object('success', true);
    ELSE 
        RETURN json_build_object(
            'success', false, 
            'count', v_count, 
            'columns', json_build_array('producto_id', 'sku', 'nombre', 'suma_lotes'), 
            'data', v_fails
        );
    END IF;
END;
$function$;

-- =============================================================================
-- 2. CORRECCIÓN DISCREPANCIA 2: POOL-NANOCARBON (ROLLO MADRE ID: 2046)
-- =============================================================================
-- Causa: Desfase de +0.3334 m (1/3 de metro) entre el cálculo matemático
-- (Checkpoint 432.1793 - Ventas 38.2588 = 393.9205) y el saldo de lotes (394.2539).
-- Solución: Descontar 0.3334 m del lote activo más reciente con trazabilidad
-- 'ajuste:reconciliacion_auditoria' para igualar el stock actual a 393.9205 m.

DO $$
DECLARE
    v_lote_id bigint;
    v_cant_actual numeric;
    v_stock_total_2046 numeric;
BEGIN
    SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_stock_total_2046
    FROM lotes_fifo
    WHERE producto_id = 2046;

    -- Solo aplicar si el stock actual refleja el desfase de ~394.2539 m
    IF v_stock_total_2046 > 393.9205 THEN
        -- Buscar el lote con saldo positivo
        SELECT id, cantidad_actual INTO v_lote_id, v_cant_actual
        FROM lotes_fifo
        WHERE producto_id = 2046 AND cantidad_actual >= 0.3334
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_lote_id IS NOT NULL THEN
            -- Contexto kardex para que el trigger registre el ajuste de auditoría
            PERFORM set_config('kardex.tipo', 'ajuste', true);
            PERFORM set_config('kardex.origen', 'ajuste:reconciliacion_auditoria_nanocarbon', true);

            UPDATE lotes_fifo
            SET cantidad_actual = cantidad_actual - 0.3334
            WHERE id = v_lote_id;

            PERFORM set_config('kardex.tipo', '', true);
            PERFORM set_config('kardex.origen', '', true);

            RAISE NOTICE 'Discrepancia 2 resuelta: Descontado 0.3334 m del lote % (Producto 2046). Stock consolidado nivelado a 393.9205 m.', v_lote_id;
        ELSE
            RAISE NOTICE 'No se encontró lote individual con saldo >= 0.3334 en producto 2046.';
        END IF;
    ELSE
        RAISE NOTICE 'Producto 2046 ya se encuentra en el valor esperado (stock actual: %).', v_stock_total_2046;
    END IF;
END $$;

COMMIT;
