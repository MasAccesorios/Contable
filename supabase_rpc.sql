-- ========================================================
-- 1. RPC: set_next_numero
-- ========================================================
CREATE OR REPLACE FUNCTION set_next_numero(p_table text, p_next bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_factura bigint;
    v_max_cotizacion bigint;
    v_max_global bigint;
BEGIN
    SELECT COALESCE(MAX(numero), 0) INTO v_max_factura FROM facturas;
    SELECT COALESCE(MAX(numero), 0) INTO v_max_cotizacion FROM cotizaciones;
    
    v_max_global := GREATEST(v_max_factura, v_max_cotizacion);
    
    IF p_next <= v_max_global THEN
        RAISE EXCEPTION 'El número % es menor o igual al máximo actual en uso (%)', p_next, v_max_global;
    END IF;

    -- Ignoramos p_table, todas las peticiones (sean de factura o cotización)
    -- afectan a la misma secuencia unificada.
    PERFORM setval('documentos_numero_seq', p_next - 1, true);
END;
$$;


-- ========================================================
-- 2. RPC: save_document_with_details
-- ========================================================
CREATE OR REPLACE FUNCTION save_document_with_details(
    p_table text,
    p_header jsonb,
    p_details jsonb,
    p_is_update boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id bigint;
    v_numero bigint;
    v_result jsonb;
BEGIN
    IF p_table NOT IN ('facturas', 'cotizaciones') THEN
        RAISE EXCEPTION 'Table % not supported', p_table;
    END IF;

    IF p_is_update THEN
        v_id := (p_header->>'id')::bigint;
        
        IF p_table = 'facturas' THEN
            UPDATE facturas SET
                fecha = (p_header->>'fecha')::date,
                vencimiento = (p_header->>'vencimiento')::date,
                contacto_id = (p_header->>'contacto_id')::bigint,
                total = (p_header->>'total')::numeric,
                estado = p_header->>'estado',
                tipo = p_header->>'tipo',
                observaciones = p_header->>'observaciones',
                cotizacion_origen_id = (p_header->>'cotizacion_origen_id')::bigint
            WHERE id = v_id
            RETURNING to_jsonb(facturas.*) INTO v_result;
            
            DELETE FROM factura_detalles WHERE factura_id = v_id;
        ELSIF p_table = 'cotizaciones' THEN
            UPDATE cotizaciones SET
                fecha = (p_header->>'fecha')::date,
                vencimiento = (p_header->>'vencimiento')::date,
                contacto_id = (p_header->>'contacto_id')::bigint,
                total = (p_header->>'total')::numeric,
                estado = p_header->>'estado',
                observaciones = p_header->>'observaciones'
            WHERE id = v_id
            RETURNING to_jsonb(cotizaciones.*) INTO v_result;
            
            DELETE FROM cotizacion_detalles WHERE cotizacion_id = v_id;
        END IF;
    ELSE
        -- Uso de Secuencia Unificada: garantiza que no haya colisiones
        -- entre una cotización creada en caja 1 y una factura creada en caja 2 al mismo tiempo.
        v_numero := nextval('documentos_numero_seq');
        
        IF p_table = 'facturas' THEN
            INSERT INTO facturas (numero, fecha, vencimiento, contacto_id, total, estado, tipo, observaciones, cotizacion_origen_id)
            VALUES (
                v_numero, 
                (p_header->>'fecha')::date, 
                (p_header->>'vencimiento')::date, 
                (p_header->>'contacto_id')::bigint, 
                (p_header->>'total')::numeric, 
                p_header->>'estado', 
                COALESCE(p_header->>'tipo', 'venta'),
                p_header->>'observaciones',
                (p_header->>'cotizacion_origen_id')::bigint
            ) RETURNING to_jsonb(facturas.*) INTO v_result;
            
        ELSIF p_table = 'cotizaciones' THEN
            INSERT INTO cotizaciones (numero, fecha, vencimiento, contacto_id, total, estado, observaciones)
            VALUES (
                v_numero, 
                (p_header->>'fecha')::date, 
                (p_header->>'vencimiento')::date, 
                (p_header->>'contacto_id')::bigint, 
                (p_header->>'total')::numeric, 
                p_header->>'estado', 
                p_header->>'observaciones'
            ) RETURNING to_jsonb(cotizaciones.*) INTO v_result;
        END IF;
        
        v_id := (v_result->>'id')::bigint;
    END IF;

    -- Inserción de Detalles en Cascada
    IF p_table = 'facturas' THEN
        INSERT INTO factura_detalles (factura_id, producto_id, cantidad, precio_unitario, descuento_porcentaje, subtotal, descripcion_personalizada)
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
        INSERT INTO cotizacion_detalles (cotizacion_id, producto_id, cantidad, precio_unitario, descuento_porcentaje, subtotal, descripcion_personalizada)
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
$$;
