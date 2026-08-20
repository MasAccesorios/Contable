CREATE OR REPLACE FUNCTION public.get_cotizaciones_page(p_page integer DEFAULT 1, p_limit integer DEFAULT 50, p_sort_column text DEFAULT 'numero'::text, p_sort_direction text DEFAULT 'desc'::text, p_search_query text DEFAULT ''::text, p_filter_criteria text DEFAULT 'todos'::text)
 RETURNS TABLE(data json, total_count bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_offset integer;
    v_search text;
BEGIN
    v_offset := (p_page - 1) * p_limit;
    v_search := '%' || p_search_query || '%';

    RETURN QUERY
    WITH filtered_cotizaciones AS (
        SELECT 
            c.id,
            c.numero,
            c.fecha,
            c.vencimiento,
            c.contacto_id,
            c.total,
            c.estado,
            c.observaciones,
            c.created_at,
            cnt.nombre AS cliente_nombre,
            EXISTS(SELECT 1 FROM facturas f WHERE f.cotizacion_origen_id = c.id) AS convertido_a_factura
        FROM cotizaciones c
        LEFT JOIN contactos cnt ON c.contacto_id = cnt.id
        WHERE
            p_search_query = '' OR (
                (p_filter_criteria = 'todos' AND (
                    cnt.nombre ILIKE v_search OR
                    c.numero::text ILIKE v_search OR
                    (CASE WHEN EXISTS(SELECT 1 FROM facturas f WHERE f.cotizacion_origen_id = c.id) THEN 'aprobada' ELSE 'pendiente' END) ILIKE v_search OR
                    c.fecha::text ILIKE v_search OR
                    c.total::text ILIKE v_search
                )) OR
                (p_filter_criteria = 'numero' AND c.numero::text = regexp_replace(p_search_query, '\D', '', 'g')) OR
                (p_filter_criteria = 'cliente' AND cnt.nombre ILIKE v_search) OR
                (p_filter_criteria = 'estado' AND (CASE WHEN EXISTS(SELECT 1 FROM facturas f WHERE f.cotizacion_origen_id = c.id) THEN 'aprobada' ELSE 'pendiente' END) ILIKE v_search) OR
                (p_filter_criteria = 'fecha' AND c.fecha::text ILIKE v_search) OR
                (p_filter_criteria = 'monto' AND c.total::text ILIKE v_search)
            )
    ),
    counted AS (
        SELECT count(*) AS v_row_count FROM filtered_cotizaciones
    )
    SELECT 
        COALESCE(json_agg(row_to_json(f)), '[]'::json) AS data,
        (SELECT v_row_count FROM counted)
    FROM (
        SELECT * FROM filtered_cotizaciones
        ORDER BY
            CASE WHEN p_sort_direction = 'asc' AND p_sort_column = 'numero' THEN numero END ASC,
            CASE WHEN p_sort_direction = 'desc' AND p_sort_column = 'numero' THEN numero END DESC,
            CASE WHEN p_sort_direction = 'asc' AND p_sort_column = 'cliente' THEN cliente_nombre END ASC,
            CASE WHEN p_sort_direction = 'desc' AND p_sort_column = 'cliente' THEN cliente_nombre END DESC,
            CASE WHEN p_sort_direction = 'asc' AND p_sort_column = 'fecha' THEN fecha END ASC,
            CASE WHEN p_sort_direction = 'desc' AND p_sort_column = 'fecha' THEN fecha END DESC,
            id DESC
        LIMIT p_limit OFFSET v_offset
    ) f;
END;
$function$
