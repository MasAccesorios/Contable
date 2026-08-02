CREATE OR REPLACE FUNCTION get_facturas_con_saldos(
    p_page INT DEFAULT 1,
    p_limit INT DEFAULT 50,
    p_sort_col TEXT DEFAULT 'numero',
    p_sort_dir TEXT DEFAULT 'desc',
    p_search TEXT DEFAULT '',
    p_filter_criteria TEXT DEFAULT 'todos'
) RETURNS TABLE (
    id BIGINT, 
    numero BIGINT, 
    fecha DATE, 
    vencimiento DATE, 
    contacto_id BIGINT,
    total NUMERIC, 
    estado TEXT, 
    observaciones TEXT,
    saldo_original NUMERIC,
    saldo_pendiente NUMERIC, 
    total_pagado NUMERIC, 
    estado_dinamico TEXT,
    total_count BIGINT
) AS $$
DECLARE
    v_offset INT;
BEGIN
    v_offset := (p_page - 1) * p_limit;

    RETURN QUERY
    WITH matching_contactos AS (
        SELECT c.id FROM contactos c WHERE c.nombre ILIKE '%' || p_search || '%'
    ),
    facturas_filtradas AS (
        SELECT f.*, count(*) OVER() AS calc_total_count
        FROM facturas f
        WHERE 
            p_search = '' OR (
                (p_filter_criteria = 'numero' AND f.numero::TEXT = regexp_replace(p_search, '\D', '', 'g')) OR
                (p_filter_criteria = 'fecha' AND f.fecha::TEXT ILIKE '%' || p_search || '%') OR
                (p_filter_criteria = 'estado' AND f.estado ILIKE '%' || p_search || '%') OR
                (p_filter_criteria = 'cliente' AND f.contacto_id IN (SELECT mc.id FROM matching_contactos mc)) OR
                (p_filter_criteria = 'todos' AND (
                    f.estado ILIKE '%' || p_search || '%' OR
                    f.fecha::TEXT ILIKE '%' || p_search || '%' OR
                    (regexp_replace(p_search, '\D', '', 'g') <> '' AND f.numero::TEXT = regexp_replace(p_search, '\D', '', 'g')) OR
                    f.contacto_id IN (SELECT mc.id FROM matching_contactos mc)
                ))
            )
    ),
    facturas_paginadas AS (
        SELECT *
        FROM facturas_filtradas
        ORDER BY 
            CASE WHEN p_sort_dir = 'asc' AND p_sort_col = 'numero' THEN facturas_filtradas.numero END ASC,
            CASE WHEN p_sort_dir = 'desc' AND p_sort_col = 'numero' THEN facturas_filtradas.numero END DESC,
            CASE WHEN p_sort_dir = 'asc' AND p_sort_col = 'fecha' THEN facturas_filtradas.fecha END ASC,
            CASE WHEN p_sort_dir = 'desc' AND p_sort_col = 'fecha' THEN facturas_filtradas.fecha END DESC,
            CASE WHEN p_sort_dir = 'asc' AND p_sort_col = 'cliente' THEN facturas_filtradas.contacto_id END ASC,
            CASE WHEN p_sort_dir = 'desc' AND p_sort_col = 'cliente' THEN facturas_filtradas.contacto_id END DESC,
            facturas_filtradas.id ASC 
        LIMIT p_limit OFFSET v_offset
    )
    SELECT 
        fp.id::BIGINT, 
        fp.numero::BIGINT, 
        fp.fecha::DATE, 
        fp.vencimiento::DATE, 
        fp.contacto_id::BIGINT, 
        fp.total::NUMERIC, 
        fp.estado::TEXT, 
        fp.observaciones::TEXT,
        fp.saldo_original::NUMERIC,
        
        -- CALCULO DE SALDO PENDIENTE
        (CASE 
            WHEN fp.estado IN ('anulada', 'void', 'voided') THEN 0.00
            WHEN fp.estado IN ('pagada', 'closed') THEN 0.00
            ELSE GREATEST(0.00, COALESCE(fp.saldo_original, fp.total) - calc_pagos.suma_pagos)
        END)::NUMERIC AS saldo_pendiente,
        
        -- CALCULO DE TOTAL PAGADO
        (CASE 
            WHEN fp.estado IN ('anulada', 'void', 'voided') THEN 0.00
            WHEN fp.estado IN ('pagada', 'closed') THEN fp.total
            ELSE fp.total - GREATEST(0.00, COALESCE(fp.saldo_original, fp.total) - calc_pagos.suma_pagos)
        END)::NUMERIC AS total_pagado,
        
        -- CALCULO DE ESTADO DINAMICO
        (CASE 
            WHEN fp.estado IN ('anulada', 'void', 'voided') THEN 'anulada'
            WHEN fp.estado IN ('pagada', 'closed') THEN 'pagada'
            ELSE 
                CASE 
                    WHEN GREATEST(0.00, COALESCE(fp.saldo_original, fp.total) - calc_pagos.suma_pagos) <= 0 THEN 'pagada'
                    WHEN GREATEST(0.00, COALESCE(fp.saldo_original, fp.total) - calc_pagos.suma_pagos) < fp.total THEN 'parcial'
                    ELSE 'pendiente'
                END
        END)::TEXT AS estado_dinamico,
        
        fp.calc_total_count::BIGINT AS total_count

    FROM facturas_paginadas fp
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(p.monto), 0) AS suma_pagos
        FROM pagos_ingresos p
        WHERE p.factura_id = fp.id
          AND COALESCE(p.estado, '') != 'anulado'
          AND p.tipo = 'in'  -- facturas siempre cruzan con ingresos (in)
          AND (
              fp.saldo_original IS NULL 
              OR (
                  p.id > 22669 
                  AND p.fecha >= '2026-07-26' 
                  AND (p.observaciones IS NULL OR p.observaciones NOT ILIKE '%Split del pago%')
              )
          )
    ) calc_pagos ON true;
END;
$$ LANGUAGE plpgsql;
