-- 1. Crear secuencias nativas en Postgres (si no existen)
CREATE SEQUENCE IF NOT EXISTS facturas_numero_seq;
CREATE SEQUENCE IF NOT EXISTS cotizaciones_numero_seq;

-- 2. Inicializar las secuencias al MAX actual de cada tabla para no chocar con datos existentes
SELECT setval('facturas_numero_seq', COALESCE((SELECT MAX(numero) FROM facturas), 0));
SELECT setval('cotizaciones_numero_seq', COALESCE((SELECT MAX(numero) FROM cotizaciones), 0));

-- 3. Crear el RPC `set_next_numero` que consumirá el frontend desde Configuración
CREATE OR REPLACE FUNCTION set_next_numero(p_table text, p_next bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se setea el valor actual a (p_next - 1) para que el próximo nextval() arroje p_next
    IF p_table = 'facturas' THEN
        PERFORM setval('facturas_numero_seq', p_next - 1, true);
    ELSIF p_table = 'cotizaciones' THEN
        PERFORM setval('cotizaciones_numero_seq', p_next - 1, true);
    ELSE
        RAISE EXCEPTION 'Tabla % no soportada para actualización de secuencias', p_table;
    END IF;
END;
$$;

-- 4. Modificar el RPC principal `save_document_with_details` para que utilice
-- estas secuencias nativas en lugar de la ineficiente y limitante consulta MAX(numero).
-- NOTA ARQUITECTÓNICA: Al usar secuencias nativas (nextval), si ocurre un error en el INSERT
-- posterior a obtener el número, el número consumido se perderá (salto de secuencia).
-- Esto es el comportamiento estándar y esperado en Postgres para evitar bloqueos transaccionales
-- y no indica corrupción de datos.
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
                observaciones = p_header->>'observaciones'
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
        -- ¡NUEVO!: Se obtienen los consecutivos de forma segura y atómica usando secuencias
        IF p_table = 'facturas' THEN
            v_numero := nextval('facturas_numero_seq');
            
            INSERT INTO facturas (numero, fecha, vencimiento, contacto_id, total, estado, observaciones)
            VALUES (
                v_numero, 
                (p_header->>'fecha')::date, 
                (p_header->>'vencimiento')::date, 
                (p_header->>'contacto_id')::bigint, 
                (p_header->>'total')::numeric, 
                p_header->>'estado', 
                p_header->>'observaciones'
            ) RETURNING to_jsonb(facturas.*) INTO v_result;
            
        ELSIF p_table = 'cotizaciones' THEN
            v_numero := nextval('cotizaciones_numero_seq');
            
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

    -- Inserción de Detalles en Cascada dentro de la misma Transacción
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
