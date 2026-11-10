-- =============================================================================
-- FASE 1 v2: Hardening correcto de get_movimientos_banco
-- 
-- El script original de fase1 intentaba añadir seguridad pero usó auth.role()
-- dentro de SECURITY DEFINER — eso no funciona en Supabase porque la función
-- corre como el owner (postgres), no como el usuario llamante.
-- La función correcta usa auth.uid() que sí lee del JWT del request.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_movimientos_banco(
    p_cuenta_id bigint,
    p_offset integer,
    p_limit integer,
    p_search text DEFAULT ''::text,
    p_tipo text DEFAULT 'todos'::text
)
RETURNS TABLE(
    id bigint, fecha date, tipo text, monto numeric,
    cuenta_id bigint, factura_id bigint, contacto_id bigint,
    estado text, referencia text, observaciones text, categoria text,
    grupo_pago_id text, tercero_nombre text, tercero_nit text,
    factura_numero bigint, total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp   -- previene search_path hijacking
AS $function$
BEGIN
    -- auth.uid() lee el JWT del request incluso dentro de SECURITY DEFINER.
    -- auth.role() NO funciona en SECURITY DEFINER (siempre reporta el owner).
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: Requiere autenticación.';
    END IF;

    RETURN QUERY
    WITH filtered_data AS (
        SELECT
            p.id,
            p.fecha,
            p.tipo,
            p.monto,
            p.cuenta_id,
            p.factura_id,
            p.contacto_id,
            p.estado,
            p.referencia,
            p.observaciones,
            p.categoria,
            p.grupo_pago_id,
            COALESCE(
              c.nombre,
              fc.nombre,
              CASE
                WHEN p.observaciones LIKE '%—%' THEN
                  trim(regexp_replace(split_part(p.observaciones, '—', 1), '^Transferencia (desde|a)\s*', '', 'i'))
                  || ' - ' || trim(split_part(p.observaciones, '—', 2))
                WHEN p.observaciones IS NOT NULL AND p.observaciones != '' THEN
                  p.observaciones
                ELSE NULL
              END,
              NULLIF(p.referencia, '')
            ) AS tercero_nombre_calc,
            COALESCE(c.identificacion, fc.identificacion) AS tercero_nit_calc,
            f.numero AS factura_numero_calc
        FROM pagos_ingresos p
        LEFT JOIN contactos c ON p.contacto_id = c.id
        LEFT JOIN facturas f ON p.factura_id = f.id
        LEFT JOIN contactos fc ON f.contacto_id = fc.id   -- tercero desde factura
        WHERE p.cuenta_id = p_cuenta_id
          AND p.estado != 'anulado'
          AND (
              p_tipo = 'todos' OR
              (p_tipo = 'ingreso' AND p.tipo = 'in') OR
              (p_tipo = 'egreso' AND p.tipo = 'out')
          )
          AND (
              p_search = '' OR
              p.observaciones ILIKE '%' || p_search || '%' OR
              p.referencia ILIKE '%' || p_search || '%' OR
              p.categoria ILIKE '%' || p_search || '%' OR
              COALESCE(c.nombre, fc.nombre, '') ILIKE '%' || p_search || '%'
          )
    )
    SELECT
        fd.id,
        fd.fecha,
        fd.tipo::text,
        fd.monto,
        fd.cuenta_id,
        fd.factura_id,
        fd.contacto_id,
        fd.estado::text,
        fd.referencia::text,
        fd.observaciones,
        fd.categoria::text,
        fd.grupo_pago_id,
        fd.tercero_nombre_calc::text,
        fd.tercero_nit_calc::text,
        fd.factura_numero_calc,
        COUNT(*) OVER() AS total_count
    FROM filtered_data fd
    ORDER BY fd.fecha DESC, fd.id DESC
    OFFSET p_offset
    LIMIT p_limit;
END;
$function$;

-- Asegurar GRANT explícito (el REVOKE global de fase1 ya bloqueó anon/public)
GRANT EXECUTE ON FUNCTION public.get_movimientos_banco(bigint, integer, integer, text, text) TO authenticated, service_role;
