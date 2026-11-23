CREATE OR REPLACE FUNCTION public.editar_factura_inventario_fifo(
    p_factura_id bigint, 
    p_factura_header jsonb, 
    p_nuevos_detalles jsonb, 
    p_origen_movimiento text, 
    p_permitir_negativos boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_producto_id BIGINT;
    v_producto_operar BIGINT;
    v_qty_restante NUMERIC;
    v_lote RECORD;
    v_a_operar NUMERIC;
    v_espacio NUMERIC;
    v_costo_unitario NUMERIC;
    v_nuevo_lote_id BIGINT;
    v_item RECORD;
    v_metros_por_unidad NUMERIC;
    v_delta_operar NUMERIC;
    v_costo_actual NUMERIC := 0;
    v_costo_delta NUMERIC := 0;
    v_nuevo_total_costo NUMERIC := 0;
BEGIN
    SELECT COALESCE(total_costo, 0) INTO v_costo_actual
    FROM facturas
    WHERE id = p_factura_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Factura no encontrada (ID: ' || p_factura_id || ')');
    END IF;

    CREATE TEMP TABLE IF NOT EXISTS temp_deltas (
        producto_id BIGINT,
        delta_cantidad NUMERIC
    ) ON COMMIT DROP;

    TRUNCATE temp_deltas;

    INSERT INTO temp_deltas (producto_id, delta_cantidad)
    SELECT
        COALESCE(n.producto_id, o.producto_id),
        COALESCE(n.cantidad, 0) - COALESCE(o.cantidad, 0)
    FROM
        (SELECT producto_id, SUM(cantidad) as cantidad FROM factura_detalles WHERE factura_id = p_factura_id GROUP BY producto_id) o
    FULL OUTER JOIN
        (SELECT (value->>'producto_id')::BIGINT as producto_id, SUM((value->>'cantidad')::NUMERIC) as cantidad
         FROM jsonb_array_elements(p_nuevos_detalles) GROUP BY (value->>'producto_id')::BIGINT) n
    ON o.producto_id = n.producto_id;

    IF NOT p_permitir_negativos THEN
        FOR v_item IN SELECT * FROM temp_deltas WHERE delta_cantidad > 0
        LOOP
            DECLARE
                v_stock_disp NUMERIC;
                v_mpu NUMERIC;
                v_prod_check BIGINT;
                v_delta_check NUMERIC;
            BEGIN
                SELECT metros_por_unidad INTO v_mpu FROM nanocarbon_factores_corte WHERE producto_id = v_item.producto_id;
                IF v_mpu IS NOT NULL THEN
                    v_prod_check := 2046;
                    v_delta_check := v_item.delta_cantidad * v_mpu;
                ELSE
                    v_prod_check := v_item.producto_id;
                    v_delta_check := v_item.delta_cantidad;
                END IF;

                SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_stock_disp
                FROM lotes_fifo WHERE producto_id = v_prod_check AND cantidad_actual > 0;

                IF v_delta_check > v_stock_disp THEN
                    RETURN jsonb_build_object(
                        'success', false, 'error', 'stock_insuficiente',
                        'producto_id', v_item.producto_id,
                        'stock_disponible', v_stock_disp,
                        'cantidad_pedida', v_delta_check
                    );
                END IF;
            END;
        END LOOP;
    END IF;

    FOR v_item IN SELECT * FROM temp_deltas WHERE delta_cantidad <> 0
    LOOP
        v_producto_id := v_item.producto_id;

        SELECT metros_por_unidad INTO v_metros_por_unidad
        FROM nanocarbon_factores_corte WHERE producto_id = v_producto_id;

        IF v_metros_por_unidad IS NOT NULL THEN
            v_producto_operar := 2046;
            v_delta_operar := v_item.delta_cantidad * v_metros_por_unidad;
            SELECT COALESCE(costo_base, 0) INTO v_costo_unitario FROM productos WHERE id = 2046;
        ELSE
            v_producto_operar := v_producto_id;
            v_delta_operar := v_item.delta_cantidad;
            SELECT COALESCE(costo_base, 0) INTO v_costo_unitario FROM productos WHERE id = v_producto_id;
        END IF;
        v_costo_unitario := COALESCE(v_costo_unitario, 0);

        v_qty_restante := ABS(v_delta_operar);

        IF v_delta_operar > 0 THEN
            FOR v_lote IN SELECT * FROM lotes_fifo WHERE producto_id = v_producto_operar AND cantidad_actual > 0 ORDER BY fecha_ingreso ASC, created_at ASC FOR UPDATE
            LOOP
                IF v_qty_restante <= 0 THEN EXIT; END IF;
                v_a_operar := LEAST(v_lote.cantidad_actual, v_qty_restante);

                PERFORM set_config('kardex.tipo', 'salida', true);
                PERFORM set_config('kardex.origen', p_origen_movimiento, true);
                UPDATE lotes_fifo SET cantidad_actual = cantidad_actual - v_a_operar WHERE id = v_lote.id;
                PERFORM set_config('kardex.tipo', '', true);
                PERFORM set_config('kardex.origen', '', true);

                v_costo_delta := v_costo_delta + (v_a_operar * COALESCE(v_lote.costo_unitario, v_costo_unitario, 0));
                v_qty_restante := v_qty_restante - v_a_operar;
            END LOOP;

            IF v_qty_restante > 0 AND p_permitir_negativos THEN
                PERFORM set_config('kardex.tipo', 'salida_negativa', true);
                PERFORM set_config('kardex.origen', p_origen_movimiento, true);
                INSERT INTO lotes_fifo (producto_id, fecha_ingreso, cantidad_inicial, cantidad_actual, costo_unitario, origen_movimiento)
                VALUES (v_producto_operar, CURRENT_DATE, 0, -v_qty_restante, v_costo_unitario, p_origen_movimiento) RETURNING id INTO v_nuevo_lote_id;
                PERFORM set_config('kardex.tipo', '', true);
                PERFORM set_config('kardex.origen', '', true);

                v_costo_delta := v_costo_delta + (v_qty_restante * v_costo_unitario);
            END IF;

        ELSE
            FOR v_lote IN SELECT * FROM lotes_fifo WHERE producto_id = v_producto_operar AND cantidad_actual < cantidad_inicial ORDER BY fecha_ingreso ASC, created_at ASC FOR UPDATE
            LOOP
                IF v_qty_restante <= 0 THEN EXIT; END IF;
                v_espacio := v_lote.cantidad_inicial - v_lote.cantidad_actual;
                v_a_operar := LEAST(v_espacio, v_qty_restante);

                PERFORM set_config('kardex.tipo', 'reversion_venta', true);
                PERFORM set_config('kardex.origen', p_origen_movimiento, true);
                UPDATE lotes_fifo SET cantidad_actual = cantidad_actual + v_a_operar WHERE id = v_lote.id;
                PERFORM set_config('kardex.tipo', '', true);
                PERFORM set_config('kardex.origen', '', true);

                v_costo_delta := v_costo_delta - (v_a_operar * COALESCE(v_lote.costo_unitario, v_costo_unitario, 0));
                v_qty_restante := v_qty_restante - v_a_operar;
            END LOOP;

            IF v_qty_restante > 0 THEN
                PERFORM set_config('kardex.tipo', 'reversion_venta', true);
                PERFORM set_config('kardex.origen', p_origen_movimiento, true);
                INSERT INTO lotes_fifo (producto_id, fecha_ingreso, cantidad_inicial, cantidad_actual, costo_unitario, origen_movimiento)
                VALUES (v_producto_operar, CURRENT_DATE, v_qty_restante, v_qty_restante, v_costo_unitario, p_origen_movimiento) RETURNING id INTO v_nuevo_lote_id;
                PERFORM set_config('kardex.tipo', '', true);
                PERFORM set_config('kardex.origen', '', true);

                v_costo_delta := v_costo_delta - (v_qty_restante * v_costo_unitario);
            END IF;
        END IF;
    END LOOP;

    v_nuevo_total_costo := GREATEST(0, ROUND(v_costo_actual + v_costo_delta, 2));

    UPDATE facturas SET
        total = (p_factura_header->>'total')::NUMERIC,
        total_costo = v_nuevo_total_costo,
        vencimiento = (p_factura_header->>'vencimiento')::DATE,
        observaciones = p_factura_header->>'observaciones',
        contacto_id = (p_factura_header->>'contacto_id')::BIGINT,
        vendedor_id = (p_factura_header->>'vendedor_id')::BIGINT
    WHERE id = p_factura_id;

    DELETE FROM factura_detalles WHERE factura_id = p_factura_id;

    INSERT INTO factura_detalles (factura_id, producto_id, cantidad, precio_unitario, descuento_porcentaje, subtotal, descripcion_personalizada)
    SELECT
        p_factura_id,
        (value->>'producto_id')::BIGINT,
        (value->>'cantidad')::NUMERIC,
        (value->>'precio_unitario')::NUMERIC,
        (value->>'descuento_porcentaje')::NUMERIC,
        (value->>'subtotal')::NUMERIC,
        (value->>'descripcion_personalizada')
    FROM jsonb_array_elements(p_nuevos_detalles);

    RETURN jsonb_build_object('success', true, 'total_costo', v_nuevo_total_costo, 'costo_delta', v_costo_delta);
END;
$$;
