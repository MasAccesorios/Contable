-- ==========================================
-- RPCs actualizados desde producción Supabase
-- ==========================================


CREATE OR REPLACE FUNCTION public.anular_transaccion_y_actualizar_facturas(p_es_grupo boolean, p_pago_id bigint, p_grupo_pago_id text, p_estados_facturas jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF p_es_grupo THEN
        UPDATE pagos_ingresos SET estado = 'anulado' WHERE grupo_pago_id = p_grupo_pago_id;
    ELSE
        UPDATE pagos_ingresos SET estado = 'anulado' WHERE id = p_pago_id;
    END IF;

    IF p_estados_facturas IS NOT NULL AND jsonb_array_length(p_estados_facturas) > 0 THEN
        UPDATE facturas f
        SET estado = e.estado
        FROM jsonb_to_recordset(p_estados_facturas) AS e(id bigint, estado text)
        WHERE f.id = e.id;
    END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.anular_venta_pagada(p_factura_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_factura        record;
    v_notas_count    int;
    v_comision_pagada_count int;
    v_detalle        record;
    v_costo          numeric;
    v_metros_por_unidad numeric;
    v_producto_destino bigint;
    v_cantidad_destino numeric;
BEGIN
    SELECT * INTO v_factura FROM facturas WHERE id = p_factura_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura no encontrada (ID: %)', p_factura_id;
    END IF;
    IF v_factura.tipo != 'venta' THEN
        RAISE EXCEPTION 'Esta función solo anula facturas de venta.';
    END IF;
    IF v_factura.estado = 'anulada' THEN
        RAISE EXCEPTION 'Esta factura ya está anulada.';
    END IF;
    SELECT COUNT(*) INTO v_notas_count FROM notas_credito WHERE factura_id = p_factura_id;
    IF v_notas_count > 0 THEN
        RAISE EXCEPTION 'No se puede anular: la factura tiene notas crédito asociadas. Resuélvelas primero.';
    END IF;
    SELECT COUNT(*) INTO v_comision_pagada_count
    FROM comisiones WHERE factura_id = p_factura_id AND estado = 'pagada';
    IF v_comision_pagada_count > 0 THEN
        RAISE EXCEPTION 'No se puede anular: ya se pagó la comisión al vendedor por esta factura. Resuelve esa comisión manualmente primero.';
    END IF;
    FOR v_detalle IN (SELECT * FROM factura_detalles WHERE factura_id = p_factura_id) LOOP
        SELECT metros_por_unidad INTO v_metros_por_unidad
        FROM nanocarbon_factores_corte WHERE producto_id = v_detalle.producto_id;

        IF v_metros_por_unidad IS NOT NULL THEN
            v_producto_destino := 2046;
            v_cantidad_destino := v_detalle.cantidad * v_metros_por_unidad;
            SELECT COALESCE(costo_base, 0) INTO v_costo FROM productos WHERE id = 2046;
        ELSE
            v_producto_destino := v_detalle.producto_id;
            v_cantidad_destino := v_detalle.cantidad;
            SELECT COALESCE(costo_base, 0) INTO v_costo FROM productos WHERE id = v_detalle.producto_id;
        END IF;

        INSERT INTO lotes_fifo (
            producto_id, fecha_ingreso, cantidad_inicial, cantidad_actual, costo_unitario, referencia, origen_movimiento
        ) VALUES (
            v_producto_destino, CURRENT_DATE, v_cantidad_destino, v_cantidad_destino, v_costo,
            'Devolución Factura Venta Anulada ' || v_factura.numero,
            'venta_anulada:' || v_factura.numero
        );
    END LOOP;
    UPDATE pagos_ingresos SET estado = 'anulado' WHERE factura_id = p_factura_id AND estado != 'anulado';
    UPDATE facturas SET estado = 'anulada' WHERE id = p_factura_id;
    RETURN jsonb_build_object('success', true, 'message', 'Factura anulada, inventario devuelto (lote nuevo) y pago/comisión revertidos.');
END;
$function$;


CREATE OR REPLACE FUNCTION public.bloquear_delete_notas_credito()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  raise exception 'No se puede eliminar una nota de crédito directamente. Use la opción ""Anular"" desde la app para revertir correctamente pagos e inventario.';
  return null;
end;
$function$;


CREATE OR REPLACE FUNCTION public.buscar_facturas_combobox(query_text text, max_limit integer DEFAULT 10)
 RETURNS TABLE(id bigint, numero bigint, tipo text, estado text, total numeric, cliente_nombre text, cliente_identificacion text)
 LANGUAGE plpgsql
AS $function$
BEGIN
RETURN QUERY
SELECT 
        f.id, 
        f.numero, 
        f.tipo::text,
        f.estado::text,
        f.total, 
        c.nombre::text, 
        c.identificacion::text
FROM facturas f
LEFT JOIN contactos c ON f.contacto_id = c.id
WHERE f.tipo = 'venta' 
AND f.numero::text ILIKE '%' || query_text || '%'
LIMIT max_limit;
END;
$function$;


CREATE OR REPLACE FUNCTION public.convertir_cotizacion_a_factura(p_cotizacion_id bigint, p_factura_header jsonb, p_factura_detalles jsonb, p_operaciones_fifo jsonb, p_origen_documento text DEFAULT 'factura'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id        bigint;
    v_numero    bigint;
    v_result    jsonb;
    v_op        jsonb;
BEGIN
    -- Lock de la cotización para evitar doble conversión por clic simultáneo
    PERFORM 1 FROM cotizaciones WHERE id = p_cotizacion_id FOR UPDATE;

    IF EXISTS (SELECT 1 FROM facturas WHERE cotizacion_origen_id = p_cotizacion_id) THEN
        RAISE EXCEPTION 'Esta cotización ya fue convertida a factura.';
    END IF;

    -- Numeración heredada de la cotización
    IF p_factura_header->>'numero' IS NOT NULL THEN
        v_numero := (p_factura_header->>'numero')::bigint;
        PERFORM setval(
            'documentos_numero_seq',
            GREATEST(v_numero, (SELECT last_value FROM documentos_numero_seq)),
            true
        );
    ELSE
        v_numero := nextval('documentos_numero_seq');
    END IF;

    INSERT INTO facturas (
        numero, fecha, vencimiento, contacto_id, total, estado, tipo,
        observaciones, cotizacion_origen_id, total_costo
    ) VALUES (
        v_numero,
        (p_factura_header->>'fecha')::date,
        (p_factura_header->>'vencimiento')::date,
        (p_factura_header->>'contacto_id')::bigint,
        (p_factura_header->>'total')::numeric,
        COALESCE(p_factura_header->>'estado', 'por_pagar'),
        COALESCE(p_factura_header->>'tipo', 'venta'),
        p_factura_header->>'observaciones',
        p_cotizacion_id,
        (p_factura_header->>'total_costo')::numeric
    ) RETURNING to_jsonb(facturas.*) INTO v_result;

    v_id := (v_result->>'id')::bigint;

    INSERT INTO factura_detalles (
        factura_id, producto_id, cantidad, precio_unitario,
        descuento_porcentaje, subtotal, descripcion_personalizada
    )
    SELECT
        v_id,
        (d->>'producto_id')::bigint,
        (d->>'cantidad')::numeric,
        (d->>'precio_unitario')::numeric,
        (d->>'descuento_porcentaje')::numeric,
        (d->>'subtotal')::numeric,
        COALESCE(
            d->>'descripcion_personalizada',
            d->>'observaciones',
            d->>'comentario',
            d->>'nota',
            ''
        )
    FROM jsonb_array_elements(p_factura_detalles) AS d;

    -- Descuento FIFO físico, dentro de la misma transacción
    FOR v_op IN SELECT * FROM jsonb_array_elements(p_operaciones_fifo)
    LOOP
        IF v_op->>'action' = 'update' THEN
            UPDATE lotes_fifo SET
                cantidad_actual    = (v_op->>'cantidad_actual')::numeric,
                origen_movimiento = p_origen_documento,
                referencia        = 'factura:' || v_numero
            WHERE id = (v_op->>'id')::bigint;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Lote % no existe (posible carrera con otra operación).', v_op->>'id';
            END IF;

        ELSIF v_op->>'action' = 'insert' THEN
            INSERT INTO lotes_fifo (
                producto_id, fecha_ingreso, cantidad_inicial,
                cantidad_actual, costo_unitario, origen_movimiento, referencia
            ) VALUES (
                (v_op->>'producto_id')::bigint,
                (v_op->>'fecha_ingreso')::date,
                0,
                (v_op->>'cantidad_actual')::numeric,
                (v_op->>'costo_unitario')::numeric,
                p_origen_documento,
                'factura:' || v_numero
            );
        END IF;
    END LOOP;

    UPDATE cotizaciones SET estado = 'billed' WHERE id = p_cotizacion_id;

    RETURN v_result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.crear_venta_directa(p_factura_header jsonb, p_factura_detalles jsonb, p_operaciones_fifo jsonb, p_origen_documento text, p_pago_contado jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_id       bigint;
    v_numero   bigint;
    v_result   jsonb;
    v_op       jsonb;
    v_vendedor bigint;
BEGIN
    IF p_factura_header->>'numero' IS NOT NULL THEN
        v_numero := (p_factura_header->>'numero')::bigint;
        PERFORM setval(
            'documentos_numero_seq',
            GREATEST(v_numero, (SELECT last_value FROM documentos_numero_seq)),
            true
        );
    ELSE
        v_numero := nextval('documentos_numero_seq');
    END IF;

    v_vendedor := (p_factura_header->>'vendedor_id')::bigint;

    INSERT INTO facturas (
        numero, fecha, vencimiento, contacto_id, total, total_costo,
        estado, tipo, observaciones, vendedor_id
    ) VALUES (
        v_numero,
        (p_factura_header->>'fecha')::date,
        (p_factura_header->>'vencimiento')::date,
        (p_factura_header->>'contacto_id')::bigint,
        (p_factura_header->>'total')::numeric,
        (p_factura_header->>'total_costo')::numeric,
        COALESCE(p_factura_header->>'estado', 'por_pagar'),
        'venta',
        p_factura_header->>'observaciones',
        v_vendedor
    ) RETURNING to_jsonb(facturas.*) INTO v_result;

    v_id := (v_result->>'id')::bigint;

    INSERT INTO factura_detalles (
        factura_id, producto_id, cantidad, precio_unitario,
        descuento_porcentaje, subtotal, descripcion_personalizada
    )
    SELECT
        v_id,
        (d->>'producto_id')::bigint,
        (d->>'cantidad')::numeric,
        (d->>'precio_unitario')::numeric,
        (d->>'descuento_porcentaje')::numeric,
        (d->>'subtotal')::numeric,
        d->>'descripcion_personalizada'
    FROM jsonb_array_elements(p_factura_detalles) AS d;

    FOR v_op IN SELECT * FROM jsonb_array_elements(p_operaciones_fifo)
    LOOP
        IF v_op->>'action' = 'update' THEN
            UPDATE lotes_fifo SET
                cantidad_actual   = (v_op->>'cantidad_actual')::numeric,
                origen_movimiento = p_origen_documento,
                referencia        = 'factura:' || v_numero
            WHERE id = (v_op->>'id')::bigint;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Lote % no existe (posible carrera con otra operación).', v_op->>'id';
            END IF;

        ELSIF v_op->>'action' = 'insert' THEN
            INSERT INTO lotes_fifo (
                producto_id, fecha_ingreso, cantidad_inicial,
                cantidad_actual, costo_unitario, origen_movimiento, referencia
            ) VALUES (
                (v_op->>'producto_id')::bigint,
                (v_op->>'fecha_ingreso')::date,
                0,
                (v_op->>'cantidad_actual')::numeric,
                (v_op->>'costo_unitario')::numeric,
                p_origen_documento,
                'factura:' || v_numero
            );
        END IF;
    END LOOP;

    IF p_pago_contado IS NOT NULL THEN
        INSERT INTO pagos_ingresos (
            fecha, monto, cuenta_id, contacto_id, factura_id,
            tipo, estado, referencia
        ) VALUES (
            (p_pago_contado->>'fecha')::date,
            (p_pago_contado->>'monto')::numeric,
            (p_pago_contado->>'cuenta_id')::bigint,
            (p_factura_header->>'contacto_id')::bigint,
            v_id,
            'in',
            'open',
            'Venta al contado Fac. ' || v_numero
        );
    END IF;

    -- Comisión automática si la venta nace directamente en 'pagada' con vendedor asignado
    -- (replica la lógica del trigger trg_gestionar_comision_factura, que solo dispara en UPDATE, no INSERT)
    IF v_vendedor IS NOT NULL AND COALESCE(p_factura_header->>'estado', 'por_pagar') = 'pagada' THEN
        INSERT INTO comisiones (factura_id, vendedor_id, monto, estado)
        SELECT v_id, v_vendedor, (p_factura_header->>'total')::numeric * (v.porcentaje_comision / 100.0), 'pendiente'
        FROM vendedores v WHERE v.id = v_vendedor
        ON CONFLICT (factura_id) DO NOTHING;
    END IF;

    v_result := v_result || jsonb_build_object('numero', v_numero);
    RETURN v_result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.editar_factura_compra_con_inventario(p_factura_id bigint, p_factura_header jsonb, p_nuevos_detalles jsonb, p_origen_movimiento text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_producto_id BIGINT;
    v_costo_unitario NUMERIC;
    v_item RECORD;
    v_lote_id BIGINT;
    v_cantidad_anterior NUMERIC;
    v_origen_lote TEXT;
BEGIN
    v_origen_lote := 'compra:' || (SELECT numero FROM facturas WHERE id = p_factura_id);

    CREATE TEMP TABLE IF NOT EXISTS temp_deltas_compra (
        producto_id BIGINT,
        cantidad_nueva NUMERIC,
        precio_unitario NUMERIC
    ) ON COMMIT DROP;

    TRUNCATE temp_deltas_compra;

    INSERT INTO temp_deltas_compra (producto_id, cantidad_nueva, precio_unitario)
    SELECT
        (value->>'producto_id')::BIGINT,
        SUM((value->>'cantidad')::NUMERIC),
        MAX((value->>'precio_unitario')::NUMERIC)
    FROM jsonb_array_elements(p_nuevos_detalles)
    GROUP BY (value->>'producto_id')::BIGINT;

    WITH duplicados AS (
        SELECT id, producto_id,
               ROW_NUMBER() OVER (PARTITION BY producto_id ORDER BY id ASC) AS rn
        FROM lotes_fifo
        WHERE origen_movimiento = v_origen_lote
    )
    UPDATE lotes_fifo lf
    SET cantidad_actual = 0, cantidad_inicial = 0
    FROM duplicados d
    WHERE lf.id = d.id AND d.rn > 1;

    FOR v_item IN SELECT * FROM temp_deltas_compra
    LOOP
        v_producto_id := v_item.producto_id;
        v_costo_unitario := v_item.precio_unitario;
        v_lote_id := NULL;
        v_cantidad_anterior := 0;

        SELECT id, cantidad_actual INTO v_lote_id, v_cantidad_anterior
        FROM lotes_fifo
        WHERE producto_id = v_producto_id AND origen_movimiento = v_origen_lote
        ORDER BY id ASC
        LIMIT 1;

        IF v_lote_id IS NOT NULL THEN
            PERFORM set_config('kardex.tipo', 'ajuste_edicion', true);
            PERFORM set_config('kardex.origen', p_origen_movimiento, true);
            UPDATE lotes_fifo SET
                cantidad_actual = v_item.cantidad_nueva,
                cantidad_inicial = v_item.cantidad_nueva,
                costo_unitario = v_costo_unitario
            WHERE id = v_lote_id;
            PERFORM set_config('kardex.tipo', '', true);
            PERFORM set_config('kardex.origen', '', true);
        ELSE
            PERFORM set_config('kardex.tipo', 'ajuste_edicion', true);
            PERFORM set_config('kardex.origen', p_origen_movimiento, true);
            INSERT INTO lotes_fifo (producto_id, fecha_ingreso, cantidad_inicial, cantidad_actual, costo_unitario, origen_movimiento, referencia)
            VALUES (v_producto_id, CURRENT_DATE, v_item.cantidad_nueva, v_item.cantidad_nueva, v_costo_unitario, v_origen_lote, 'Edicion Factura Compra ' || p_factura_id)
            RETURNING id INTO v_lote_id;
            PERFORM set_config('kardex.tipo', '', true);
            PERFORM set_config('kardex.origen', '', true);
        END IF;
    END LOOP;

    UPDATE lotes_fifo
    SET cantidad_actual = 0, cantidad_inicial = 0
    WHERE origen_movimiento = v_origen_lote
      AND producto_id NOT IN (SELECT producto_id FROM temp_deltas_compra);

    UPDATE facturas SET
        total = (p_factura_header->>'total')::NUMERIC,
        total_costo = (p_factura_header->>'total_costo')::NUMERIC,
        vencimiento = (p_factura_header->>'vencimiento')::DATE,
        observaciones = p_factura_header->>'observaciones',
        contacto_id = (p_factura_header->>'contacto_id')::BIGINT
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

    RETURN jsonb_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.editar_factura_inventario_fifo(p_factura_id bigint, p_factura_header jsonb, p_nuevos_detalles jsonb, p_origen_movimiento text, p_permitir_negativos boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
BEGIN
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

                v_qty_restante := v_qty_restante - v_a_operar;
            END LOOP;

            IF v_qty_restante > 0 AND p_permitir_negativos THEN
                PERFORM set_config('kardex.tipo', 'salida_negativa', true);
                PERFORM set_config('kardex.origen', p_origen_movimiento, true);
                INSERT INTO lotes_fifo (producto_id, fecha_ingreso, cantidad_inicial, cantidad_actual, costo_unitario, origen_movimiento)
                VALUES (v_producto_operar, CURRENT_DATE, 0, -v_qty_restante, v_costo_unitario, p_origen_movimiento) RETURNING id INTO v_nuevo_lote_id;
                PERFORM set_config('kardex.tipo', '', true);
                PERFORM set_config('kardex.origen', '', true);
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

                v_qty_restante := v_qty_restante - v_a_operar;
            END LOOP;

            IF v_qty_restante > 0 THEN
                PERFORM set_config('kardex.tipo', 'reversion_venta', true);
                PERFORM set_config('kardex.origen', p_origen_movimiento, true);
                INSERT INTO lotes_fifo (producto_id, fecha_ingreso, cantidad_inicial, cantidad_actual, costo_unitario, origen_movimiento)
                VALUES (v_producto_operar, CURRENT_DATE, v_qty_restante, v_qty_restante, v_costo_unitario, p_origen_movimiento) RETURNING id INTO v_nuevo_lote_id;
                PERFORM set_config('kardex.tipo', '', true);
                PERFORM set_config('kardex.origen', '', true);
            END IF;
        END IF;
    END LOOP;

    UPDATE facturas SET
        total = (p_factura_header->>'total')::NUMERIC,
        total_costo = (p_factura_header->>'total_costo')::NUMERIC,
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

    RETURN jsonb_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.editar_transaccion_y_actualizar_facturas(p_es_grupo boolean, p_pago_id bigint, p_grupo_pago_id text, p_update_payload jsonb, p_estados_facturas jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF p_es_grupo THEN
        UPDATE pagos_ingresos SET
            fecha         = (p_update_payload->>'fecha')::date,
            cuenta_id     = (p_update_payload->>'cuenta_id')::bigint,
            categoria     = p_update_payload->>'categoria',
            observaciones = p_update_payload->>'observaciones'
        WHERE grupo_pago_id = p_grupo_pago_id;
    ELSE
        UPDATE pagos_ingresos SET
            fecha         = (p_update_payload->>'fecha')::date,
            cuenta_id     = (p_update_payload->>'cuenta_id')::bigint,
            categoria     = p_update_payload->>'categoria',
            observaciones = p_update_payload->>'observaciones',
            monto         = (p_update_payload->>'monto')::numeric,
            factura_id    = CASE WHEN p_update_payload ? 'factura_id'
                                  THEN (p_update_payload->>'factura_id')::bigint
                                  ELSE factura_id END
        WHERE id = p_pago_id;
    END IF;

    IF p_estados_facturas IS NOT NULL AND jsonb_array_length(p_estados_facturas) > 0 THEN
        UPDATE facturas f
        SET estado = e.estado
        FROM jsonb_to_recordset(p_estados_facturas) AS e(id bigint, estado text)
        WHERE f.id = e.id;
    END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.eliminar_factura_venta(p_factura_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_factura record;
    v_pagos_count int;
    v_notas_count int;
    v_detalle record;
    v_costo numeric;
    v_metros_por_unidad numeric;
    v_producto_destino bigint;
    v_cantidad_destino numeric;
BEGIN
    SELECT * INTO v_factura FROM facturas WHERE id = p_factura_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura no encontrada (ID: %)', p_factura_id;
    END IF;
    SELECT COUNT(*) INTO v_pagos_count FROM pagos_ingresos WHERE factura_id = p_factura_id;
    IF v_pagos_count > 0 THEN
        RAISE EXCEPTION 'No se puede eliminar: la factura tiene pagos registrados. Reversa o elimina los pagos primero.';
    END IF;
    SELECT COUNT(*) INTO v_notas_count FROM notas_credito WHERE factura_id = p_factura_id;
    IF v_notas_count > 0 THEN
        RAISE EXCEPTION 'No se puede eliminar: la factura tiene notas crédito asociadas. Elimínalas o resuélvelas primero.';
    END IF;
    FOR v_detalle IN (SELECT * FROM factura_detalles WHERE factura_id = p_factura_id) LOOP
        SELECT metros_por_unidad INTO v_metros_por_unidad
        FROM nanocarbon_factores_corte WHERE producto_id = v_detalle.producto_id;

        IF v_metros_por_unidad IS NOT NULL THEN
            v_producto_destino := 2046;
            v_cantidad_destino := v_detalle.cantidad * v_metros_por_unidad;
            SELECT COALESCE(costo_base, 0) INTO v_costo FROM productos WHERE id = 2046;
        ELSE
            v_producto_destino := v_detalle.producto_id;
            v_cantidad_destino := v_detalle.cantidad;
            SELECT COALESCE(costo_base, 0) INTO v_costo FROM productos WHERE id = v_detalle.producto_id;
        END IF;

        INSERT INTO lotes_fifo (
            producto_id, fecha_ingreso, cantidad_inicial, cantidad_actual, costo_unitario, referencia, origen_movimiento
        ) VALUES (
            v_producto_destino, CURRENT_DATE, v_cantidad_destino, v_cantidad_destino, v_costo,
            'Devolución Factura Venta ' || v_factura.numero,
            'venta_eliminada:' || v_factura.numero
        );
    END LOOP;
    DELETE FROM facturas WHERE id = p_factura_id;
    RETURN jsonb_build_object('success', true, 'message', 'Factura eliminada e inventario devuelto correctamente (lote nuevo, sin tocar histórico).');
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_gestionar_comision_factura()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Caso 1: la factura pasa a ""pagada"" (comportamiento original, sin cambios)
    IF NEW.tipo = 'venta' AND NEW.vendedor_id IS NOT NULL
       AND NEW.estado = 'pagada' AND (OLD.estado IS DISTINCT FROM 'pagada') THEN

        INSERT INTO comisiones (factura_id, vendedor_id, monto, estado)
        SELECT NEW.id, NEW.vendedor_id, NEW.total * (v.porcentaje_comision / 100.0), 'pendiente'
        FROM vendedores v WHERE v.id = NEW.vendedor_id
        ON CONFLICT (factura_id) DO NOTHING;

    -- Caso 2 (NUEVO): la factura YA estaba pagada y se le asigna/cambia el vendedor ahora
    ELSIF NEW.tipo = 'venta' AND NEW.vendedor_id IS NOT NULL
          AND NEW.estado = 'pagada' AND OLD.estado = 'pagada'
          AND (OLD.vendedor_id IS DISTINCT FROM NEW.vendedor_id) THEN

        INSERT INTO comisiones (factura_id, vendedor_id, monto, estado)
        SELECT NEW.id, NEW.vendedor_id, NEW.total * (v.porcentaje_comision / 100.0), 'pendiente'
        FROM vendedores v WHERE v.id = NEW.vendedor_id
        ON CONFLICT (factura_id) DO UPDATE
        SET vendedor_id = EXCLUDED.vendedor_id, monto = EXCLUDED.monto
        WHERE comisiones.estado = 'pendiente';

    ELSIF OLD.estado = 'pagada' AND NEW.estado IS DISTINCT FROM 'pagada' THEN

        DELETE FROM comisiones
        WHERE factura_id = NEW.id AND estado = 'pendiente';

    END IF;
    RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_log_movimiento_lote()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_tipo text;
    v_origen text;
BEGIN
    v_tipo := current_setting('kardex.tipo', true);
    v_origen := current_setting('kardex.origen', true);
    
    IF v_tipo IS NULL OR v_tipo = '' THEN
        v_tipo := LOWER(TG_OP);
    END IF;
    
    IF v_origen IS NULL OR v_origen = '' THEN
        v_origen := COALESCE(NEW.origen_movimiento, 'desconocido');
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO lotes_fifo_movimientos (lote_id, producto_id, tipo_operacion, cantidad_anterior, cantidad_nueva, diferencia, origen_documento, referencia_lote)
        VALUES (NEW.id, NEW.producto_id, v_tipo, NULL, NEW.cantidad_actual, NEW.cantidad_actual, v_origen, NEW.referencia);

    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.cantidad_actual IS DISTINCT FROM OLD.cantidad_actual THEN
            INSERT INTO lotes_fifo_movimientos (lote_id, producto_id, tipo_operacion, cantidad_anterior, cantidad_nueva, diferencia, origen_documento, referencia_lote)
            VALUES (NEW.id, NEW.producto_id, v_tipo, OLD.cantidad_actual, NEW.cantidad_actual, NEW.cantidad_actual - OLD.cantidad_actual, v_origen, NEW.referencia);
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO lotes_fifo_movimientos (lote_id, producto_id, tipo_operacion, cantidad_anterior, cantidad_nueva, diferencia, origen_documento, referencia_lote)
        VALUES (OLD.id, OLD.producto_id, 'delete', OLD.cantidad_actual, NULL, -OLD.cantidad_actual, 'eliminado', OLD.referencia);
    END IF;
    RETURN NULL;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_cartera_con_saldos(p_tipo_cartera text, p_contacto_id text DEFAULT NULL::text)
 RETURNS TABLE(id text, numero text, fecha date, vencimiento date, contacto_id text, estado text, tipo text, total numeric, saldo_original numeric, saldo numeric, total_pagado numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    WITH facturas_base AS (
        SELECT 
            f.id AS id_bigint,
            f.id::text,
            f.numero::text,
            f.fecha,
            f.vencimiento,
            f.contacto_id::text,
            f.tipo::text,
            COALESCE(NULLIF(regexp_replace(f.total::text, '[^\d.]', '', 'g'), ''), '0')::numeric as calc_total,
            f.saldo_original,
            COALESCE(NULLIF(regexp_replace(f.saldo_original::text, '[^\d.]', '', 'g'), ''), '0')::numeric as calc_saldo_original,
            CASE WHEN f.saldo_original IS NOT NULL THEN TRUE ELSE FALSE END as tiene_saldo_original
        FROM facturas f
        LEFT JOIN contactos c ON f.contacto_id = c.id
        WHERE 
            f.estado NOT IN ('anulada', 'void', 'closed', 'pagada')
            AND EXTRACT(YEAR FROM COALESCE(f.fecha, f.vencimiento, f.created_at, CURRENT_DATE)) > 2017
            AND (p_contacto_id IS NULL OR f.contacto_id::text = p_contacto_id)
            AND (
                (p_tipo_cartera = 'cxc' AND (
                    (f.tipo = 'venta') OR 
                    (f.tipo IS NULL AND COALESCE(c.es_cliente, c.tipo != 'proveedor', true) = true)
                ))
                OR 
                (p_tipo_cartera = 'cxp' AND (
                    (f.tipo = 'compra') OR 
                    (f.tipo IS NULL AND COALESCE(c.es_proveedor, c.tipo = 'proveedor', false) = true)
                ))
            )
    )
    SELECT 
        fb.id,
        fb.numero,
        fb.fecha,
        fb.vencimiento,
        fb.contacto_id,
        CASE 
            WHEN GREATEST(0::numeric, (CASE WHEN fb.tiene_saldo_original THEN fb.calc_saldo_original ELSE fb.calc_total END) - COALESCE(sum_pagos.total_pagado, 0::numeric)) <= 0 THEN 'pagada'
            WHEN GREATEST(0::numeric, (CASE WHEN fb.tiene_saldo_original THEN fb.calc_saldo_original ELSE fb.calc_total END) - COALESCE(sum_pagos.total_pagado, 0::numeric)) < fb.calc_total THEN 'parcial'
            ELSE 'pendiente'
        END as estado,
        fb.tipo,
        fb.calc_total as total,
        fb.calc_saldo_original as saldo_original,
        GREATEST(0::numeric, (CASE WHEN fb.tiene_saldo_original THEN fb.calc_saldo_original ELSE fb.calc_total END) - COALESCE(sum_pagos.total_pagado, 0::numeric)) as saldo,
        CASE 
            WHEN fb.tiene_saldo_original THEN fb.calc_total - GREATEST(0::numeric, (CASE WHEN fb.tiene_saldo_original THEN fb.calc_saldo_original ELSE fb.calc_total END) - COALESCE(sum_pagos.total_pagado, 0::numeric))
            ELSE COALESCE(sum_pagos.total_pagado, 0::numeric) 
        END as total_pagado
    FROM facturas_base fb
    LEFT JOIN LATERAL (
        SELECT SUM(COALESCE(NULLIF(regexp_replace(t.monto::text, '[^\d.]', '', 'g'), ''), '0')::numeric) as total_pagado
        FROM pagos_ingresos t
        WHERE t.factura_id = fb.id_bigint
          AND t.tipo = CASE WHEN fb.tipo IN ('compra', 'gasto') THEN 'out' ELSE 'in' END
          AND t.estado IS DISTINCT FROM 'anulado'
          AND (
              NOT fb.tiene_saldo_original OR 
              (
                  t.id > 22669 
                  AND t.fecha >= '2026-07-26' 
                  AND (t.observaciones IS NULL OR t.observaciones NOT ILIKE '%Split del pago%')
              )
          )
    ) sum_pagos ON true
    WHERE GREATEST(0::numeric, (CASE WHEN fb.tiene_saldo_original THEN fb.calc_saldo_original ELSE fb.calc_total END) - COALESCE(sum_pagos.total_pagado, 0::numeric)) > 0
    ORDER BY fb.numero::numeric DESC;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_conciliacion_bancaria(p_cuenta_id integer, p_fecha_desde date, p_fecha_hasta date, p_conciliacion_id bigint DEFAULT NULL::bigint)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
declare
    v_saldo_anterior  numeric := 0;
    v_entradas        numeric := 0;
    v_salidas         numeric := 0;
    v_movimientos     json;
begin
    select
        coalesce(sum(case when tipo = 'in' then monto else -monto end), 0)
    into v_saldo_anterior
    from pagos_ingresos
    where cuenta_id = p_cuenta_id
      and estado   != 'anulado'
      and (tipo = 'in' or tipo = 'out')
      and fecha::date < p_fecha_desde;

    select
        coalesce(sum(case when tipo = 'in'  then monto else 0 end), 0),
        coalesce(sum(case when tipo = 'out' then monto else 0 end), 0)
    into v_entradas, v_salidas
    from pagos_ingresos
    where cuenta_id = p_cuenta_id
      and estado   != 'anulado'
      and (tipo = 'in' or tipo = 'out')
      and fecha::date between p_fecha_desde and p_fecha_hasta;

    select json_agg(
        json_build_object(
            'id',          m.id,
            'fecha',       m.fecha,
            'detalle',     coalesce(m.observaciones, m.referencia, ''),
            'referencia',  m.referencia,
            'tipo',        case when m.tipo = 'in' then 'ingreso' else 'egreso' end,
            'monto',       m.monto,
            'estado',      m.estado
        )
        order by m.fecha asc, m.id asc
    )
    into v_movimientos
    from pagos_ingresos m
    where m.cuenta_id = p_cuenta_id
      and m.estado   != 'anulado'
      and (m.tipo = 'in' or m.tipo = 'out')
      and m.fecha::date between p_fecha_desde and p_fecha_hasta
      and (m.conciliado_en IS NULL OR m.conciliacion_id = p_conciliacion_id);

    return json_build_object(
        'saldo_anterior', v_saldo_anterior,
        'entradas',       v_entradas,
        'salidas',        v_salidas,
        'movimientos',    coalesce(v_movimientos, '[]'::json)
    );
end;
$function$;


CREATE OR REPLACE FUNCTION public.get_contactos_page(p_page integer, p_limit integer, p_sort_column text, p_sort_direction text, p_search_query text, p_filter_criteria text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_offset integer;
    v_total_count bigint;
    v_result json;
BEGIN
    v_offset := (p_page - 1) * p_limit;
    SELECT count(*)
    INTO v_total_count
    FROM contactos c
    WHERE (c.estado IS NULL OR c.estado != 'inactive')
      AND (
          p_filter_criteria = 'todos'
          OR (p_filter_criteria = 'cliente' AND c.es_cliente = true)
          OR (p_filter_criteria = 'proveedor' AND c.es_proveedor = true)
      )
      AND (
          p_search_query = ''
          OR c.nombre ILIKE '%' || p_search_query || '%'
          OR c.identificacion ILIKE '%' || p_search_query || '%'
          OR c.telefono ILIKE '%' || p_search_query || '%'
          OR c.email ILIKE '%' || p_search_query || '%'
      );
    WITH contact_data AS (
        SELECT 
            c.id,
            c.nombre,
            c.identificacion as nit,
            c.telefono,
            c.email,
            c.tipo,
            c.estado,
            c.es_cliente,
            c.es_proveedor
        FROM contactos c
        WHERE (c.estado IS NULL OR c.estado != 'inactive')
          AND (
              p_filter_criteria = 'todos'
              OR (p_filter_criteria = 'cliente' AND c.es_cliente = true)
              OR (p_filter_criteria = 'proveedor' AND c.es_proveedor = true)
          )
          AND (
              p_search_query = ''
              OR c.nombre ILIKE '%' || p_search_query || '%'
              OR c.identificacion ILIKE '%' || p_search_query || '%'
              OR c.telefono ILIKE '%' || p_search_query || '%'
              OR c.email ILIKE '%' || p_search_query || '%'
          )
        ORDER BY 
            CASE WHEN p_sort_column = 'nombre' AND p_sort_direction = 'asc' THEN c.nombre END ASC,
            CASE WHEN p_sort_column = 'nombre' AND p_sort_direction = 'desc' THEN c.nombre END DESC,
            c.id DESC
        LIMIT p_limit
        OFFSET v_offset
    )
    SELECT json_build_object(
        'data', (SELECT COALESCE(json_agg(row_to_json(contact_data)), '[]'::json) FROM contact_data),
        'total_count', v_total_count
    ) INTO v_result;
    RETURN v_result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_cotizaciones_kpis()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_cotizado numeric := 0;
    v_total_aprobado numeric := 0;
    v_total_pendiente numeric := 0;
BEGIN
    SELECT 
        COALESCE(SUM(c.total), 0),
        COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM facturas f WHERE f.cotizacion_origen_id = c.id) THEN c.total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN NOT EXISTS(SELECT 1 FROM facturas f WHERE f.cotizacion_origen_id = c.id) THEN c.total ELSE 0 END), 0)
    INTO 
        v_total_cotizado, 
        v_total_aprobado, 
        v_total_pendiente
    FROM cotizaciones c
    WHERE EXTRACT(YEAR FROM c.fecha::date) = EXTRACT(YEAR FROM CURRENT_DATE)
      AND EXTRACT(MONTH FROM c.fecha::date) = EXTRACT(MONTH FROM CURRENT_DATE);
    RETURN json_build_object(
        'totalCotizado', v_total_cotizado,
        'totalAprobado', v_total_aprobado,
        'totalPendiente', v_total_pendiente
    );
END;
$function$;


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
            (c.estado = 'billed' OR EXISTS(SELECT 1 FROM facturas f WHERE f.cotizacion_origen_id = c.id)) AS convertido_a_factura
        FROM cotizaciones c
        LEFT JOIN contactos cnt ON c.contacto_id = cnt.id
        WHERE
            p_search_query = '' OR (
                (p_filter_criteria = 'todos' AND (
                    cnt.nombre ILIKE v_search OR
                    c.numero::text ILIKE v_search OR
                    (CASE WHEN (c.estado = 'billed' OR EXISTS(SELECT 1 FROM facturas f WHERE f.cotizacion_origen_id = c.id)) THEN 'aprobada' ELSE 'pendiente' END) ILIKE v_search OR
                    c.fecha::text ILIKE v_search OR
                    c.total::text ILIKE v_search
                )) OR
                (p_filter_criteria = 'numero' AND c.numero::text = regexp_replace(p_search_query, '\D', '', 'g')) OR
                (p_filter_criteria = 'cliente' AND cnt.nombre ILIKE v_search) OR
                (p_filter_criteria = 'estado' AND (CASE WHEN (c.estado = 'billed' OR EXISTS(SELECT 1 FROM facturas f WHERE f.cotizacion_origen_id = c.id)) THEN 'aprobada' ELSE 'pendiente' END) ILIKE v_search) OR
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
$function$;


CREATE OR REPLACE FUNCTION public.get_crud_kpis_mes(p_tipo text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total numeric := 0;
    v_aplicados numeric := 0;
    v_directos numeric := 0;
BEGIN
    SELECT 
        COALESCE(SUM(monto), 0),
        COALESCE(SUM(monto) FILTER (WHERE factura_id IS NOT NULL), 0),
        COALESCE(SUM(monto) FILTER (WHERE factura_id IS NULL), 0)
    INTO v_total, v_aplicados, v_directos
    FROM pagos_ingresos
    WHERE tipo = p_tipo 
      AND estado != 'anulado'
      AND EXTRACT(YEAR FROM fecha::date) = EXTRACT(YEAR FROM CURRENT_DATE)
      AND EXTRACT(MONTH FROM fecha::date) = EXTRACT(MONTH FROM CURRENT_DATE);
    RETURN json_build_object(
        'total', v_total, 
        'aplicados', v_aplicados, 
        'directos', v_directos
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_dashboard_cartera_kpis()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_cxc_total NUMERIC := 0;
    v_cxc_vigentes NUMERIC := 0;
    v_cxc_vencidas NUMERIC := 0;
    v_cxc_vigentes_doc INTEGER := 0;
    v_cxc_vencidas_doc INTEGER := 0;
    v_cxp_total NUMERIC := 0;
    v_cxp_vigentes NUMERIC := 0;
    v_cxp_vencidas NUMERIC := 0;
    v_cxp_vigentes_doc INTEGER := 0;
    v_cxp_vencidas_doc INTEGER := 0;
BEGIN
    SELECT 
        COALESCE(SUM(saldo), 0),
        COALESCE(SUM(CASE WHEN vencimiento >= CURRENT_DATE THEN saldo ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN vencimiento < CURRENT_DATE THEN saldo ELSE 0 END), 0),
        COUNT(CASE WHEN vencimiento >= CURRENT_DATE THEN 1 END),
        COUNT(CASE WHEN vencimiento < CURRENT_DATE THEN 1 END)
    INTO 
        v_cxc_total, v_cxc_vigentes, v_cxc_vencidas, v_cxc_vigentes_doc, v_cxc_vencidas_doc
    FROM get_cartera_con_saldos('cxc');
    SELECT 
        COALESCE(SUM(saldo), 0),
        COALESCE(SUM(CASE WHEN vencimiento >= CURRENT_DATE THEN saldo ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN vencimiento < CURRENT_DATE THEN saldo ELSE 0 END), 0),
        COUNT(CASE WHEN vencimiento >= CURRENT_DATE THEN 1 END),
        COUNT(CASE WHEN vencimiento < CURRENT_DATE THEN 1 END)
    INTO 
        v_cxp_total, v_cxp_vigentes, v_cxp_vencidas, v_cxp_vigentes_doc, v_cxp_vencidas_doc
    FROM get_cartera_con_saldos('cxp');
    RETURN jsonb_build_object(
        'cxc_total', v_cxc_total, 'cxc_vigentes', v_cxc_vigentes, 'cxc_vencidas', v_cxc_vencidas,
        'cxc_vigentes_doc', v_cxc_vigentes_doc, 'cxc_vencidas_doc', v_cxc_vencidas_doc,
        'cxp_total', v_cxp_total, 'cxp_vigentes', v_cxp_vigentes, 'cxp_vencidas', v_cxp_vencidas,
        'cxp_vigentes_doc', v_cxp_vigentes_doc, 'cxp_vencidas_doc', v_cxp_vencidas_doc
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_fecha_inicio date, p_fecha_fin date, p_prev_fecha_inicio date, p_prev_fecha_fin date)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_ventas_mes NUMERIC := 0;
    v_utilidad_mes NUMERIC := 0;
    v_ventas_prev NUMERIC := 0;
    v_productos_vendidos INTEGER := 0;
    v_facturas_count INTEGER := 0;
    v_daily_sales JSONB := '{}'::jsonb;
BEGIN
    -- 1. Ventas, utilidad y conteo de facturas del periodo actual
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(SUM(total - COALESCE(total_costo, 0)), 0),
        COUNT(*)
    INTO 
        v_ventas_mes, 
        v_utilidad_mes, 
        v_facturas_count
    FROM facturas
    WHERE fecha >= p_fecha_inicio AND fecha <= p_fecha_fin
      AND estado NOT IN ('void', 'anulada')
      AND tipo != 'compra';

    -- 2. Ventas del periodo anterior (para el badge de % crecimiento)
    SELECT 
        COALESCE(SUM(total), 0)
    INTO 
        v_ventas_prev
    FROM facturas
    WHERE fecha >= p_prev_fecha_inicio AND fecha <= p_prev_fecha_fin
      AND estado NOT IN ('void', 'anulada')
      AND tipo != 'compra';

    -- 3. Total de productos vendidos (JOIN directo desde los detalles)
    SELECT 
        COALESCE(SUM(fd.cantidad), 0)
    INTO 
        v_productos_vendidos
    FROM factura_detalles fd
    JOIN facturas f ON f.id = fd.factura_id
    WHERE f.fecha >= p_fecha_inicio AND f.fecha <= p_fecha_fin
      AND f.estado NOT IN ('void', 'anulada')
      AND f.tipo != 'compra';

    -- 4. Ventas agrupadas por día (para la gráfica Chart.js)
    SELECT 
        COALESCE(
            jsonb_object_agg(TO_CHAR(fecha, 'YYYY-MM-DD'), total_dia), 
            '{}'::jsonb
        )
    INTO v_daily_sales
    FROM (
        SELECT 
            fecha,
            SUM(total) as total_dia
        FROM facturas
        WHERE fecha >= p_fecha_inicio AND fecha <= p_fecha_fin
          AND estado NOT IN ('void', 'anulada')
          AND tipo != 'compra'
        GROUP BY fecha
    ) as daily;

    -- Devolver todo empaquetado como un objeto JSON
    RETURN jsonb_build_object(
        'ventas_mes', v_ventas_mes,
        'utilidad_mes', v_utilidad_mes,
        'ventas_prev', v_ventas_prev,
        'productos_vendidos', v_productos_vendidos,
        'facturas_count', v_facturas_count,
        'daily_sales', v_daily_sales
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_facturas_con_saldos(p_page integer DEFAULT 1, p_limit integer DEFAULT 50, p_sort_col text DEFAULT 'numero'::text, p_sort_dir text DEFAULT 'desc'::text, p_search text DEFAULT ''::text, p_filter_criteria text DEFAULT 'todos'::text, p_tipo text DEFAULT 'venta'::text)
 RETURNS TABLE(id bigint, numero bigint, fecha date, vencimiento date, contacto_id bigint, total numeric, estado text, observaciones text, saldo_original numeric, saldo_pendiente numeric, total_pagado numeric, estado_dinamico text, total_count bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_offset INT;
BEGIN
    v_offset := (p_page - 1) * p_limit;
    RETURN QUERY
    WITH matching_contactos AS (
        SELECT c.id FROM contactos c WHERE c.nombre ILIKE '%' || p_search || '%'
    ),
    pagos_full AS (
        SELECT p.factura_id, COALESCE(SUM(p.monto), 0) AS suma_pagos
        FROM pagos_ingresos p
        WHERE COALESCE(p.estado, '') != 'anulado' AND p.tipo = 'in'
        GROUP BY p.factura_id
    ),
    pagos_restringidos AS (
        SELECT p.factura_id, COALESCE(SUM(p.monto), 0) AS suma_pagos
        FROM pagos_ingresos p
        WHERE COALESCE(p.estado, '') != 'anulado' AND p.tipo = 'in'
          AND p.id > 22669 AND p.fecha >= '2026-07-26'
          AND (p.observaciones IS NULL OR p.observaciones NOT ILIKE '%Split del pago%')
        GROUP BY p.factura_id
    ),
    facturas_con_estado AS (
        SELECT 
            f.*,
            CASE WHEN f.saldo_original IS NULL 
                 THEN COALESCE(pf.suma_pagos, 0) 
                 ELSE COALESCE(pr.suma_pagos, 0) 
            END AS suma_pagos,
            (CASE 
                WHEN f.estado IN ('anulada', 'void', 'voided') THEN 'anulada'
                WHEN f.estado IN ('pagada', 'closed') THEN 'pagada'
                ELSE 
                    CASE 
                        WHEN GREATEST(0.00, COALESCE(f.saldo_original, f.total) - 
                            (CASE WHEN f.saldo_original IS NULL THEN COALESCE(pf.suma_pagos,0) ELSE COALESCE(pr.suma_pagos,0) END)
                        ) <= 0 THEN 'pagada'
                        WHEN GREATEST(0.00, COALESCE(f.saldo_original, f.total) - 
                            (CASE WHEN f.saldo_original IS NULL THEN COALESCE(pf.suma_pagos,0) ELSE COALESCE(pr.suma_pagos,0) END)
                        ) < f.total THEN 'parcial'
                        ELSE 'pendiente'
                    END
            END)::TEXT AS calc_estado_dinamico
        FROM facturas f
        LEFT JOIN pagos_full pf ON pf.factura_id = f.id
        LEFT JOIN pagos_restringidos pr ON pr.factura_id = f.id
    ),
    facturas_filtradas AS (
        SELECT fce.*, count(*) OVER() AS calc_total_count
        FROM facturas_con_estado fce
        WHERE 
            (p_tipo = 'todos' OR fce.tipo = p_tipo) AND
            (
            p_search = '' OR (
                (p_filter_criteria = 'numero' AND fce.numero::TEXT = regexp_replace(p_search, '\D', '', 'g')) OR
                (p_filter_criteria = 'fecha' AND fce.fecha::TEXT ILIKE '%' || p_search || '%') OR
                (p_filter_criteria = 'estado' AND fce.calc_estado_dinamico ILIKE '%' || p_search || '%') OR
                (p_filter_criteria = 'cliente' AND fce.contacto_id IN (SELECT mc.id FROM matching_contactos mc)) OR
                (p_filter_criteria = 'monto' AND fce.total::TEXT ILIKE '%' || p_search || '%') OR
                (p_filter_criteria = 'todos' AND (
                    fce.calc_estado_dinamico ILIKE '%' || p_search || '%' OR
                    fce.fecha::TEXT ILIKE '%' || p_search || '%' OR
                    (regexp_replace(p_search, '\D', '', 'g') <> '' AND fce.numero::TEXT = regexp_replace(p_search, '\D', '', 'g')) OR
                    fce.total::TEXT ILIKE '%' || p_search || '%' OR
                    fce.contacto_id IN (SELECT mc.id FROM matching_contactos mc)
                ))
            )
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
        fp.id::BIGINT, fp.numero::BIGINT, fp.fecha::DATE, fp.vencimiento::DATE, fp.contacto_id::BIGINT, 
        fp.total::NUMERIC, fp.estado::TEXT, fp.observaciones::TEXT, fp.saldo_original::NUMERIC,
        (CASE 
            WHEN fp.estado IN ('anulada', 'void', 'voided') THEN 0.00
            WHEN fp.estado IN ('pagada', 'closed') THEN 0.00
            ELSE GREATEST(0.00, COALESCE(fp.saldo_original, fp.total) - fp.suma_pagos)
        END)::NUMERIC AS saldo_pendiente,
        (CASE 
            WHEN fp.estado IN ('anulada', 'void', 'voided') THEN 0.00
            WHEN fp.estado IN ('pagada', 'closed') THEN fp.total
            ELSE fp.total - GREATEST(0.00, COALESCE(fp.saldo_original, fp.total) - fp.suma_pagos)
        END)::NUMERIC AS total_pagado,
        fp.calc_estado_dinamico AS estado_dinamico,
        fp.calc_total_count::BIGINT AS total_count
    FROM facturas_paginadas fp;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_facturas_kpis(p_tipo text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_facturado numeric := 0;
    v_total_cobrado numeric := 0;
    v_total_pendiente numeric := 0;
BEGIN
    WITH base_facturas AS (
        SELECT 
            f.id,
            f.total,
            f.estado,
            f.saldo_original,
            COALESCE(
                (SELECT SUM(p.monto)
                 FROM pagos_ingresos p
                 WHERE p.factura_id = f.id
                   AND COALESCE(p.estado, '') != 'anulado'
                   AND p.tipo = CASE WHEN p_tipo = 'venta' THEN 'in' ELSE 'out' END
                   AND (
                       f.saldo_original IS NULL 
                       OR (
                           p.id > 22669 
                           AND p.fecha >= '2026-07-26' 
                           AND (p.observaciones IS NULL OR p.observaciones NOT ILIKE '%Split del pago%')
                       )
                   )
                ), 0) AS suma_pagos
        FROM facturas f
        WHERE f.tipo = p_tipo
          AND f.estado NOT IN ('anulada', 'void', 'voided')
          AND EXTRACT(YEAR FROM f.fecha::date) = EXTRACT(YEAR FROM CURRENT_DATE)
          AND EXTRACT(MONTH FROM f.fecha::date) = EXTRACT(MONTH FROM CURRENT_DATE)
    ),
    calc_totales AS (
        SELECT 
            SUM(total) AS sum_facturado,
            SUM(CASE 
                WHEN estado IN ('pagada', 'closed') THEN 0.00
                ELSE GREATEST(0.00, COALESCE(saldo_original, total) - suma_pagos)
            END) AS sum_pendiente,
            SUM(CASE 
                WHEN estado IN ('pagada', 'closed') THEN total
                ELSE total - GREATEST(0.00, COALESCE(saldo_original, total) - suma_pagos)
            END) AS sum_cobrado
        FROM base_facturas
    )
    SELECT 
        COALESCE(sum_facturado, 0),
        COALESCE(sum_cobrado, 0),
        COALESCE(sum_pendiente, 0)
    INTO v_total_facturado, v_total_cobrado, v_total_pendiente
    FROM calc_totales;

    RETURN json_build_object(
        'facturado', v_total_facturado,
        'cobrado', v_total_cobrado,
        'pendiente', v_total_pendiente
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_ingresos_egresos_por_mes(meses integer DEFAULT 6)
 RETURNS TABLE(mes text, ingresos numeric, egresos numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    to_char(fecha, 'YYYY-MM') AS mes,
    SUM(CASE WHEN tipo = 'in' THEN monto ELSE 0 END) AS ingresos,
    SUM(CASE WHEN tipo = 'out' THEN monto ELSE 0 END) AS egresos
  FROM pagos_ingresos
  WHERE estado != 'void'
    AND fecha >= (CURRENT_DATE - (meses || ' months')::interval)
  GROUP BY to_char(fecha, 'YYYY-MM')
  ORDER BY mes;
$function$;


CREATE OR REPLACE FUNCTION public.get_inventario_valorizado(p_search text DEFAULT ''::text, p_page integer DEFAULT 1, p_limit integer DEFAULT 50, p_export_all boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_resultados JSON;
BEGIN
    WITH calculos AS (
        SELECT 
            p.id, 
            p.sku, 
            p.nombre,
            COALESCE(SUM(l.cantidad_actual), 0) as stock_total,
            COALESCE(p.costo_base, 0) as costo_base,
            COALESCE(SUM(l.cantidad_actual) FILTER (WHERE l.cantidad_actual > 0), 0) as stock_lotes_positivos,
            COALESCE(SUM(l.cantidad_actual * l.costo_unitario) FILTER (WHERE l.cantidad_actual > 0), 0) as costo_lotes
        FROM productos p
        LEFT JOIN lotes_fifo l ON p.id = l.producto_id
        WHERE p.estado NOT IN ('inactivo', 'inactive')
        GROUP BY p.id, p.sku, p.nombre, p.costo_base
    ),
    valorizados AS (
        SELECT 
            id, sku, nombre, stock_total,
            CASE 
                WHEN stock_total > 0 THEN 
                    CASE WHEN stock_lotes_positivos > 0 THEN (costo_lotes / stock_lotes_positivos) ELSE costo_base END
                ELSE costo_base 
            END as costo_promedio
        FROM calculos
    ),
    totales_completos AS (
        SELECT 
            id, sku, nombre, stock_total, costo_promedio,
            CASE 
                WHEN stock_total < 0 AND (sku IS NULL OR sku NOT IN ('5001','5002','5003','5004','5005')) THEN 0
                ELSE stock_total * costo_promedio 
            END as valor_total
        FROM valorizados
    ),
    filtrados AS (
        SELECT * 
        FROM totales_completos
        WHERE p_search = '' 
           OR nombre ILIKE '%' || p_search || '%' 
           OR sku ILIKE '%' || p_search || '%'
    ),
    paginados AS (
        SELECT * 
        FROM filtrados
        ORDER BY nombre ASC
        LIMIT CASE WHEN p_export_all THEN NULL ELSE p_limit END
        OFFSET CASE WHEN p_export_all THEN 0 ELSE (p_page - 1) * p_limit END
    )
    SELECT json_build_object(
        'gran_total', (SELECT COALESCE(SUM(valor_total), 0) FROM totales_completos),
        'total_items', (SELECT COUNT(*) FROM filtrados),
        'items', COALESCE((SELECT json_agg(row_to_json(p)) FROM paginados p), '[]'::json)
    ) INTO v_resultados;
    RETURN v_resultados;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_movimientos_banco(p_cuenta_id bigint, p_offset integer, p_limit integer, p_search text DEFAULT ''::text, p_tipo text DEFAULT 'todos'::text)
 RETURNS TABLE(id bigint, fecha date, tipo text, monto numeric, cuenta_id bigint, factura_id bigint, contacto_id bigint, estado text, referencia text, observaciones text, categoria text, grupo_pago_id text, tercero_nombre text, tercero_nit text, factura_numero bigint, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
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
              trim(regexp_replace(split_part(p.observaciones, '—', 1), '^Transferencia (desde|a)\s*', '', 'i')) || ' - ' || trim(split_part(p.observaciones, '—', 2))
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
    LEFT JOIN contactos fc ON f.contacto_id = fc.id
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


CREATE OR REPLACE FUNCTION public.get_next_numero(p_table text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.get_next_sequence_value(seq_name text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN nextval(seq_name::regclass);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_notas_credito_kpis()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_anulada numeric := 0;
    v_total_aplicadas numeric := 0;
    v_total_pendientes numeric := 0;
BEGIN
    SELECT 
        COALESCE(SUM(CASE WHEN estado = 'anulada' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN estado != 'anulada' THEN total ELSE 0 END), 0),
        0
    INTO 
        v_total_anulada, 
        v_total_aplicadas, 
        v_total_pendientes
    FROM notas_credito
    WHERE EXTRACT(YEAR FROM fecha::date) = EXTRACT(YEAR FROM CURRENT_DATE)
      AND EXTRACT(MONTH FROM fecha::date) = EXTRACT(MONTH FROM CURRENT_DATE);

    RETURN json_build_object(
        'totalAnulada', v_total_anulada,
        'totalAplicadas', v_total_aplicadas,
        'totalPendientes', v_total_pendientes
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_notas_credito_paginadas(p_page integer DEFAULT 1, p_limit integer DEFAULT 50, p_sort_col text DEFAULT 'numero'::text, p_sort_dir text DEFAULT 'desc'::text, p_search text DEFAULT ''::text)
 RETURNS TABLE(id bigint, numero bigint, fecha date, contacto_id bigint, contacto_nombre character varying, total numeric, estado text, total_count bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_offset INT;
BEGIN
    v_offset := (p_page - 1) * p_limit;

    RETURN QUERY
    WITH matching_contactos AS (
        SELECT c.id FROM contactos c WHERE c.nombre ILIKE '%' || p_search || '%'
    ),
    filtradas AS (
        SELECT 
            n.id, n.numero, n.fecha, n.contacto_id, c.nombre AS contacto_nombre, n.total, n.estado,
            count(*) OVER() AS calc_total_count
        FROM notas_credito n
        LEFT JOIN contactos c ON n.contacto_id = c.id
        WHERE 
            p_search = '' OR (
                (n.numero::TEXT = regexp_replace(p_search, '\D', '', 'g')) OR
                (n.fecha::TEXT ILIKE '%' || p_search || '%') OR
                (n.estado ILIKE '%' || p_search || '%') OR
                (n.contacto_id IN (SELECT mc.id FROM matching_contactos mc))
            )
    )
    SELECT 
        f.id::BIGINT, 
        f.numero::BIGINT, 
        f.fecha::DATE, 
        f.contacto_id::BIGINT,
        f.contacto_nombre::VARCHAR,
        f.total::NUMERIC, 
        f.estado::TEXT,
        f.calc_total_count::BIGINT AS total_count
    FROM filtradas f
    ORDER BY 
        CASE WHEN p_sort_dir = 'asc' AND p_sort_col = 'numero' THEN f.numero END ASC,
        CASE WHEN p_sort_dir = 'desc' AND p_sort_col = 'numero' THEN f.numero END DESC,
        CASE WHEN p_sort_dir = 'asc' AND p_sort_col = 'fecha' THEN f.fecha END ASC,
        CASE WHEN p_sort_dir = 'desc' AND p_sort_col = 'fecha' THEN f.fecha END DESC,
        CASE WHEN p_sort_dir = 'asc' AND p_sort_col = 'cliente' THEN f.contacto_nombre END ASC,
        CASE WHEN p_sort_dir = 'desc' AND p_sort_col = 'cliente' THEN f.contacto_nombre END DESC,
        f.id DESC
    LIMIT p_limit OFFSET v_offset;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_pagos_kpis(p_tipo text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total numeric := 0;
    v_hoy_bogota date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
    SELECT COALESCE(SUM(monto), 0)
    INTO v_total
    FROM pagos_ingresos
    WHERE tipo = p_tipo 
      AND estado != 'anulado'
      AND EXTRACT(YEAR FROM fecha) = EXTRACT(YEAR FROM v_hoy_bogota)
      AND EXTRACT(MONTH FROM fecha) = EXTRACT(MONTH FROM v_hoy_bogota);
    RETURN json_build_object('total', v_total);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_pagos_lista(p_tipo text, p_page integer DEFAULT 1, p_limit integer DEFAULT 10, p_search text DEFAULT ''::text)
 RETURNS TABLE(id bigint, numero bigint, cliente text, categoria text, factura_id bigint, factura_numero bigint, fecha date, cuenta_bancaria text, estado_conciliacion boolean, estado_transaccion text, monto numeric, observaciones text, total_count bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_offset INTEGER;
  v_search TEXT;
BEGIN
  v_offset := (p_page - 1) * p_limit;
  
  IF p_search IS NOT NULL AND TRIM(p_search) <> '' THEN
    v_search := '%' || TRIM(p_search) || '%';
  ELSE
    v_search := NULL;
  END IF;
  RETURN QUERY
  WITH filtered_data AS (
    SELECT 
      b.id AS base_id,
      COALESCE(b.numero, b.id) AS numero,
      COALESCE(c.nombre, fc.nombre)::text AS cliente,
      b.categoria::text AS categoria,
      b.factura_id,
      f.numero AS factura_numero,
      b.fecha,
      cb.nombre::text AS cuenta_bancaria,
      EXISTS (
        SELECT 1 
        FROM conciliaciones conc 
        WHERE b.id = ANY(conc.movimientos_conciliados)
      ) AS estado_conciliacion,
      b.estado::text AS estado_transaccion,
      b.monto,
      b.observaciones
    FROM pagos_ingresos b
    LEFT JOIN contactos c ON b.contacto_id = c.id
    LEFT JOIN facturas f ON b.factura_id = f.id
    LEFT JOIN contactos fc ON f.contacto_id = fc.id
    LEFT JOIN cuentas_bancarias cb ON b.cuenta_id = cb.id
    WHERE b.tipo = p_tipo
      AND (
        p_search IS NULL OR p_search = ''
        OR COALESCE(c.nombre, fc.nombre) ILIKE v_search
        OR COALESCE(b.numero, b.id)::text ILIKE v_search
        OR f.numero::text ILIKE v_search
        OR b.monto::text ILIKE v_search
        OR b.fecha::text ILIKE v_search
        OR b.estado ILIKE v_search
        OR b.categoria ILIKE v_search
        OR cb.nombre ILIKE v_search
      )
  ),
  total_count_cte AS (
    SELECT COUNT(*) AS total FROM filtered_data
  )
  SELECT 
    fd.base_id,
    fd.numero,
    fd.cliente,
    fd.categoria,
    fd.factura_id,
    fd.factura_numero,
    fd.fecha,
    fd.cuenta_bancaria,
    fd.estado_conciliacion,
    fd.estado_transaccion,
    fd.monto,
    fd.observaciones,
    cd.total AS total_count
  FROM filtered_data fd
  CROSS JOIN total_count_cte cd
  ORDER BY fd.fecha DESC, fd.base_id DESC
  LIMIT p_limit
  OFFSET v_offset;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_precio_promedio_ml(p_producto_id bigint)
 RETURNS TABLE(precio_promedio numeric, veces_vendido integer, precio_minimo numeric, precio_maximo numeric)
 LANGUAGE sql
AS $function$
  SELECT 
    ROUND(AVG(ultimas.precio_unitario), 0) AS precio_promedio,
    COUNT(*)::integer AS veces_vendido,
    MIN(ultimas.precio_unitario) AS precio_minimo,
    MAX(ultimas.precio_unitario) AS precio_maximo
  FROM (
    SELECT fd.precio_unitario
    FROM factura_detalles fd
    JOIN facturas f ON f.id = fd.factura_id
    WHERE f.contacto_id = 698
      AND fd.producto_id = p_producto_id
      AND f.tipo = 'venta'
      AND f.estado NOT IN ('anulada','void','voided')
    ORDER BY f.fecha DESC, f.numero DESC
    LIMIT 5
  ) ultimas
$function$;


CREATE OR REPLACE FUNCTION public.get_productos_page(p_page integer DEFAULT 1, p_limit integer DEFAULT 50, p_sort_column text DEFAULT 'nombre'::text, p_sort_direction text DEFAULT 'asc'::text, p_search_query text DEFAULT ''::text, p_filter_criteria text DEFAULT 'todos'::text)
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
    WITH lotes_agg AS (
        SELECT producto_id, COALESCE(SUM(cantidad_actual), 0) AS stock_total
        FROM lotes_fifo
        GROUP BY producto_id
    ),
    filtered_productos AS (
        SELECT 
            p.id,
            p.sku,
            p.nombre,
            p.precio_venta AS "precioVenta",
            p.costo_base AS "costoBase",
            p.stock_minimo AS "stockMinimo",
            p.estado,
            COALESCE(la.stock_total, 0) AS "stock"
        FROM productos p
        LEFT JOIN lotes_agg la ON la.producto_id = p.id
        WHERE 
            p.estado NOT IN ('inactivo', 'inactive')
            AND (
                p_search_query = ''
                OR (p_filter_criteria = 'todos' AND (
                    p.nombre ILIKE v_search
                    OR p.sku ILIKE v_search
                ))
                OR (p_filter_criteria = 'nombre' AND p.nombre ILIKE v_search)
                OR (p_filter_criteria = 'sku' AND p.sku ILIKE v_search)
            )
    ),
    ordered_productos AS (
        SELECT * FROM filtered_productos
        ORDER BY
            CASE WHEN p_sort_direction = 'asc' THEN
                CASE 
                    WHEN p_sort_column = 'nombre' THEN nombre
                    WHEN p_sort_column = 'sku' THEN sku
                END
            END ASC,
            CASE WHEN p_sort_direction = 'desc' THEN
                CASE 
                    WHEN p_sort_column = 'nombre' THEN nombre
                    WHEN p_sort_column = 'sku' THEN sku
                END
            END DESC,
            id ASC
    )
    SELECT 
        COALESCE(json_agg(row_to_json(ordered_productos.*)), '[]'::json),
        (SELECT COUNT(*) FROM filtered_productos)
    FROM (
        SELECT * FROM ordered_productos
        LIMIT p_limit OFFSET v_offset
    ) ordered_productos;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_reconciliacion_inventario()
 RETURNS TABLE(sku text, nombre text, tiene_checkpoint boolean, checkpoint numeric, fecha_checkpoint timestamp with time zone, vendido_despues numeric, esperado numeric, actual numeric, discrepancia numeric)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
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
    SELECT ai.created_at, item.a
    FROM ajustes_inventario ai
    CROSS JOIN LATERAL jsonb_to_recordset(ai.detalles) AS item(sku text, a numeric)
    WHERE item.sku = p.sku
      AND item.a IS NOT NULL
    ORDER BY ai.created_at DESC
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
GROUP BY p.sku, p.nombre, p.id, c.a, c.created_at

UNION ALL
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
AND p.id NOT IN (SELECT producto_id FROM nanocarbon_factores_corte)

UNION ALL
SELECT
    'POOL-NANOCARBON' AS sku,
    'Rollo NanoCarbón (material compartido) - reconciliación de pool' AS nombre,
    TRUE AS tiene_checkpoint,
    pool_check.cantidad_inicial AS checkpoint,
    pool_check.created_at AS fecha_checkpoint,
    COALESCE((
        SELECT SUM(ABS(lm.diferencia) * ncf.metros_por_unidad)
        FROM lotes_fifo_movimientos lm
        JOIN nanocarbon_factores_corte ncf ON ncf.producto_id = lm.producto_id
        WHERE lm.diferencia < 0
          AND lm.creado_en >= pool_check.created_at
          AND (lm.origen_documento IS NULL OR lm.origen_documento NOT LIKE 'ajuste:%')
    ), 0) AS vendido_despues,
    pool_check.cantidad_inicial - COALESCE((
        SELECT SUM(ABS(lm.diferencia) * ncf.metros_por_unidad)
        FROM lotes_fifo_movimientos lm
        JOIN nanocarbon_factores_corte ncf ON ncf.producto_id = lm.producto_id
        WHERE lm.diferencia < 0
          AND lm.creado_en >= pool_check.created_at
          AND (lm.origen_documento IS NULL OR lm.origen_documento NOT LIKE 'ajuste:%')
    ), 0) AS esperado,
    (SELECT SUM(cantidad_actual) FROM lotes_fifo WHERE producto_id = 2046) AS actual,
    (SELECT SUM(cantidad_actual) FROM lotes_fifo WHERE producto_id = 2046) -
    (pool_check.cantidad_inicial - COALESCE((
        SELECT SUM(ABS(lm.diferencia) * ncf.metros_por_unidad)
        FROM lotes_fifo_movimientos lm
        JOIN nanocarbon_factores_corte ncf ON ncf.producto_id = lm.producto_id
        WHERE lm.diferencia < 0
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


CREATE OR REPLACE FUNCTION public.get_reporte_gastos(p_fecha_inicio date, p_fecha_fin date)
 RETURNS TABLE("Fecha" date, "Cuenta de Salida" text, "Concepto/Detalle" text, "Referencia Documento" text, "Monto ($)" numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        p.fecha AS "Fecha",
        COALESCE(c.nombre, '')::TEXT AS "Cuenta de Salida",
        COALESCE(p.observaciones, p.referencia, '')::TEXT AS "Concepto/Detalle",
        COALESCE(p.factura_id::TEXT, '')::TEXT AS "Referencia Documento",
        ROUND(p.monto) AS "Monto ($)"
    FROM pagos_ingresos p
    LEFT JOIN cuentas_bancarias c ON p.cuenta_id = c.id
    WHERE p.tipo = 'out'
    AND p.fecha >= p_fecha_inicio
    AND p.fecha <= p_fecha_fin
    ORDER BY p.fecha ASC, p.id ASC;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_reporte_ventas_utilidad(p_fecha_inicio date, p_fecha_fin date)
 RETURNS TABLE("Documento" text, "Fecha" date, "Cliente" text, "Estado" text, "Total de Venta" numeric, "Costo de Venta (FIFO)" numeric, "Utilidad Bruta" numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(f.numero::TEXT, f.id::TEXT) AS "Documento",
        f.fecha AS "Fecha",
        COALESCE(c.nombre, 'Cliente Genérico / Contado') AS "Cliente",
        f.estado AS "Estado",
        ROUND(f.total) AS "Total de Venta",
        ROUND(COALESCE(f.total_costo, 0)) AS "Costo de Venta (FIFO)",
        ROUND(f.total - COALESCE(f.total_costo, 0)) AS "Utilidad Bruta"
    FROM facturas f
    LEFT JOIN contactos c ON f.contacto_id = c.id
    WHERE f.tipo = 'venta'
    AND f.estado NOT IN ('anulada', 'void')
    AND f.fecha >= p_fecha_inicio
    AND f.fecha <= p_fecha_fin
    ORDER BY f.fecha ASC, f.id ASC;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_saldo_total_bancos()
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(s.saldo), 0)
    INTO v_total
    FROM get_saldos_por_cuenta() s
    JOIN cuentas_bancarias c ON c.id = s.cuenta_id
    WHERE c.estado IN ('active', 'activo');
    RETURN v_total;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_saldos_por_cuenta()
 RETURNS TABLE(cuenta_id bigint, saldo numeric)
 LANGUAGE sql
AS $function$
  SELECT 
    cuenta_id, 
    SUM(
      CASE 
        WHEN tipo = 'in' THEN monto 
        WHEN tipo = 'out' THEN -monto 
        ELSE 0 
      END
    ) as saldo
  FROM pagos_ingresos
  WHERE estado IS NULL OR estado != 'anulado'
  GROUP BY cuenta_id;
$function$;


CREATE OR REPLACE FUNCTION public.get_total_transacciones(p_tipo text, p_categoria text DEFAULT NULL::text, p_fecha_desde date DEFAULT NULL::date, p_fecha_hasta date DEFAULT NULL::date)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    total NUMERIC;
BEGIN
SELECT COALESCE(SUM(monto), 0) INTO total
FROM pagos_ingresos
WHERE tipo = p_tipo
AND factura_id IS NULL
AND estado != 'anulado'
AND (p_categoria IS NULL OR categoria = p_categoria)
AND (p_fecha_desde IS NULL OR fecha >= p_fecha_desde)
AND (p_fecha_hasta IS NULL OR fecha <= p_fecha_hasta);
RETURN total;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_vendedores_resumen()
 RETURNS TABLE(id bigint, nombre text, telefono text, porcentaje_comision numeric, estado text, total_vendido numeric, comision_generada numeric, comision_pagada numeric, comision_pendiente numeric)
 LANGUAGE sql
AS $function$
    SELECT
        v.id,
        v.nombre,
        v.telefono,
        v.porcentaje_comision,
        v.estado,
        COALESCE((SELECT SUM(f.total) FROM facturas f WHERE f.vendedor_id = v.id AND f.estado = 'pagada'), 0) AS total_vendido,
        COALESCE((SELECT SUM(c.monto) FROM comisiones c WHERE c.vendedor_id = v.id), 0) AS comision_generada,
        COALESCE((SELECT SUM(c.monto) FROM comisiones c WHERE c.vendedor_id = v.id AND c.estado = 'pagada'), 0) AS comision_pagada,
        COALESCE((SELECT SUM(c.monto) FROM comisiones c WHERE c.vendedor_id = v.id AND c.estado = 'pendiente'), 0) AS comision_pendiente
    FROM vendedores v
    ORDER BY v.nombre;
$function$;


CREATE OR REPLACE FUNCTION public.guardar_ajuste_inventario(p_numero bigint, p_fecha date, p_observaciones text, p_detalles jsonb, p_items_incremento jsonb, p_items_disminucion jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_ajuste_id bigint;
    v_item jsonb;
    v_producto_id bigint;
    v_qty_restante numeric;
    v_lote record;
    v_a_operar numeric;
    v_origen text;
BEGIN
    -- 1. Cabecera del ajuste
    INSERT INTO ajustes_inventario (numero, fecha, observaciones, detalles)
    VALUES (p_numero, p_fecha, p_observaciones, p_detalles)
    RETURNING id INTO v_ajuste_id;

    v_origen := 'ajuste:' || p_numero;

    -- 2. Incrementos: un lote nuevo por cada item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_incremento)
    LOOP
        INSERT INTO lotes_fifo (
            producto_id, cantidad_inicial, cantidad_actual, costo_unitario,
            fecha_ingreso, referencia, origen_movimiento
        ) VALUES (
            (v_item->>'producto_id')::bigint,
            (v_item->>'cantidad')::numeric,
            (v_item->>'cantidad')::numeric,
            (v_item->>'costo_unitario')::numeric,
            p_fecha,
            'Ajuste de Inventario #' || p_numero,
            v_origen
        );
    END LOOP;

    -- 3. Disminuciones: FIFO real dentro de la misma transacción
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_disminucion)
    LOOP
        v_producto_id := (v_item->>'producto_id')::bigint;
        v_qty_restante := (v_item->>'cantidad')::numeric;
        IF v_producto_id IS NULL THEN
            RAISE EXCEPTION 'Item de disminución sin producto_id válido: %', v_item;
        END IF;

        FOR v_lote IN
            SELECT * FROM lotes_fifo
            WHERE producto_id = v_producto_id AND cantidad_actual > 0
            ORDER BY fecha_ingreso ASC, created_at ASC
            FOR UPDATE
        LOOP
            IF v_qty_restante <= 0 THEN EXIT; END IF;
            v_a_operar := LEAST(v_lote.cantidad_actual, v_qty_restante);

            PERFORM set_config('kardex.tipo', 'salida', true);
            PERFORM set_config('kardex.origen', v_origen, true);
            UPDATE lotes_fifo SET cantidad_actual = cantidad_actual - v_a_operar
            WHERE id = v_lote.id;
            PERFORM set_config('kardex.tipo', '', true);
            PERFORM set_config('kardex.origen', '', true);

            v_qty_restante := v_qty_restante - v_a_operar;
        END LOOP;

        IF v_qty_restante > 0 THEN
            RAISE EXCEPTION 'Stock insuficiente para producto_id % (faltan % unidades)', v_producto_id, v_qty_restante;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'id', v_ajuste_id, 'numero', p_numero);
END;
$function$;


CREATE OR REPLACE FUNCTION public.guardar_conciliacion_bancaria(p_id bigint, p_banco_id bigint, p_fecha_desde date, p_fecha_hasta date, p_saldo_bancario numeric, p_saldo_sistema numeric, p_diferencia numeric, p_movimientos_conciliados bigint[])
 RETURNS bigint
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id BIGINT;
BEGIN
    IF p_id IS NOT NULL THEN
        UPDATE pagos_ingresos
        SET conciliado_en = NULL, conciliacion_id = NULL
        WHERE conciliacion_id = p_id
          AND NOT (id = ANY(p_movimientos_conciliados));

        UPDATE conciliaciones
        SET banco_id = p_banco_id,
            fecha_desde = p_fecha_desde,
            fecha_hasta = p_fecha_hasta,
            saldo_bancario = p_saldo_bancario,
            saldo_sistema = p_saldo_sistema,
            diferencia = p_diferencia,
            fecha_guardado = now(),
            movimientos_conciliados = p_movimientos_conciliados
        WHERE id = p_id;

        v_id := p_id;
    ELSE
        INSERT INTO conciliaciones (banco_id, fecha_desde, fecha_hasta, saldo_bancario, saldo_sistema, diferencia, fecha_guardado, movimientos_conciliados)
        VALUES (p_banco_id, p_fecha_desde, p_fecha_hasta, p_saldo_bancario, p_saldo_sistema, p_diferencia, now(), p_movimientos_conciliados)
        RETURNING id INTO v_id;
    END IF;

    UPDATE pagos_ingresos
    SET conciliado_en = now(), conciliacion_id = v_id
    WHERE id = ANY(p_movimientos_conciliados);

    RETURN v_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.guardar_factura_compra_con_inventario(p_header jsonb, p_detalles jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_id      bigint;
    v_numero  bigint;
    v_result  jsonb;
    v_fecha   date;
BEGIN
    v_numero := nextval('documentos_numero_seq');
    v_fecha  := (p_header->>'fecha')::date;
    INSERT INTO facturas (
        numero,
        fecha,
        vencimiento,
        contacto_id,
        total,
        total_costo,
        estado,
        tipo,
        observaciones
    ) VALUES (
        v_numero,
        v_fecha,
        NULLIF(p_header->>'vencimiento', '')::date,
        (p_header->>'contacto_id')::bigint,
        (p_header->>'total')::numeric,
        (p_header->>'total')::numeric,
        COALESCE(NULLIF(p_header->>'estado', ''), 'por_pagar'),
        'compra',
        p_header->>'observaciones'
    )
    RETURNING id INTO v_id;
    INSERT INTO factura_detalles (
        factura_id,
        producto_id,
        cantidad,
        precio_unitario,
        descuento_porcentaje,
        subtotal,
        descripcion_personalizada
    )
    SELECT
        v_id,
        (det->>'producto_id')::bigint,
        (det->>'cantidad')::numeric,
        (det->>'precio_unitario')::numeric,
        COALESCE((det->>'descuento_porcentaje')::numeric, 0),
        (det->>'subtotal')::numeric,
        det->>'descripcion_personalizada'
    FROM jsonb_array_elements(p_detalles) AS det;
    INSERT INTO lotes_fifo (
        producto_id,
        cantidad_inicial,
        cantidad_actual,
        costo_unitario,
        fecha_ingreso,
        referencia,
        origen_movimiento
    )
    SELECT
        (det->>'producto_id')::bigint,
        (det->>'cantidad')::numeric,
        (det->>'cantidad')::numeric,
        (det->>'precio_unitario')::numeric,
        v_fecha,
        'Factura Compra ' || v_numero,
        'compra:' || v_numero
    FROM jsonb_array_elements(p_detalles) AS det;
    v_result := jsonb_build_object('id', v_id, 'numero', v_numero);
    RETURN v_result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.marcar_cotizacion_facturada(p_cotizacion_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE cotizaciones
    SET estado = 'billed'
    WHERE id = p_cotizacion_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.pagar_comision(p_comision_id bigint, p_cuenta_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_comision record;
    v_vendedor_nombre text;
    v_factura_numero bigint;
BEGIN
    SELECT * INTO v_comision FROM comisiones WHERE id = p_comision_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Comisión no encontrada.';
    END IF;
    IF v_comision.estado = 'pagada' THEN
        RAISE EXCEPTION 'Esta comisión ya fue pagada.';
    END IF;

    SELECT nombre INTO v_vendedor_nombre FROM vendedores WHERE id = v_comision.vendedor_id;
    SELECT numero INTO v_factura_numero FROM facturas WHERE id = v_comision.factura_id;

    INSERT INTO pagos_ingresos (tipo, monto, fecha, cuenta_id, categoria, observaciones, estado)
    VALUES ('out', v_comision.monto, CURRENT_DATE, p_cuenta_id, 'Comisión vendedor',
            'Comisión a ' || COALESCE(v_vendedor_nombre, 'vendedor') || ' por factura ' || COALESCE(v_factura_numero::text, v_comision.factura_id::text),
            'open');

    UPDATE comisiones
    SET estado = 'pagada', cuenta_id = p_cuenta_id, fecha_pago = CURRENT_DATE
    WHERE id = p_comision_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.procesar_salida_inventario_fifo(p_detalles jsonb, p_origen_movimiento text, p_permitir_negativos boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_producto_id BIGINT;
    v_producto_operar BIGINT;
    v_qty_restante NUMERIC;
    v_qty_original NUMERIC;
    v_metros_por_unidad NUMERIC;
    v_lote RECORD;
    v_a_operar NUMERIC;
    v_costo_unitario NUMERIC;
    v_nuevo_lote_id BIGINT;
    v_item JSONB;
    v_costo_total_venta NUMERIC := 0;
BEGIN
    IF NOT p_permitir_negativos THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles)
        LOOP
            DECLARE
                v_stock_disp NUMERIC;
                v_qty_pedida NUMERIC := (v_item->>'cantidad')::NUMERIC;
                v_prod_id BIGINT := (v_item->>'producto_id')::BIGINT;
                v_mpu NUMERIC;
                v_prod_check BIGINT;
            BEGIN
                IF v_prod_id IS NULL THEN CONTINUE; END IF;

                SELECT metros_por_unidad INTO v_mpu FROM nanocarbon_factores_corte WHERE producto_id = v_prod_id;
                IF v_mpu IS NOT NULL THEN
                    v_prod_check := 2046;
                    v_qty_pedida := v_qty_pedida * v_mpu;
                ELSE
                    v_prod_check := v_prod_id;
                END IF;

                SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_stock_disp
                FROM lotes_fifo WHERE producto_id = v_prod_check AND cantidad_actual > 0;

                IF v_qty_pedida > v_stock_disp THEN
                    RETURN jsonb_build_object(
                        'success', false, 'error', 'stock_insuficiente',
                        'producto_id', v_prod_id,
                        'stock_disponible', v_stock_disp,
                        'cantidad_pedida', v_qty_pedida
                    );
                END IF;
            END;
        END LOOP;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles)
    LOOP
        v_producto_id := (v_item->>'producto_id')::BIGINT;
        v_qty_original := (v_item->>'cantidad')::NUMERIC;

        IF v_producto_id IS NULL THEN
            CONTINUE;
        END IF;

        SELECT metros_por_unidad INTO v_metros_por_unidad
        FROM nanocarbon_factores_corte WHERE producto_id = v_producto_id;

        IF v_metros_por_unidad IS NOT NULL THEN
            v_producto_operar := 2046;
            v_qty_restante := v_qty_original * v_metros_por_unidad;
            SELECT costo_base INTO v_costo_unitario FROM productos WHERE id = 2046;
        ELSE
            v_producto_operar := v_producto_id;
            v_qty_restante := v_qty_original;
            SELECT costo_base INTO v_costo_unitario FROM productos WHERE id = v_producto_id;
        END IF;
        v_costo_unitario := COALESCE(v_costo_unitario, 0);

        FOR v_lote IN SELECT * FROM lotes_fifo WHERE producto_id = v_producto_operar AND cantidad_actual > 0 ORDER BY fecha_ingreso ASC, created_at ASC FOR UPDATE
        LOOP
            IF v_qty_restante <= 0 THEN EXIT; END IF;
            v_a_operar := LEAST(v_lote.cantidad_actual, v_qty_restante);

            PERFORM set_config('kardex.tipo', 'salida', true);
            PERFORM set_config('kardex.origen', p_origen_movimiento, true);
            UPDATE lotes_fifo SET cantidad_actual = cantidad_actual - v_a_operar WHERE id = v_lote.id;
            PERFORM set_config('kardex.tipo', '', true);
            PERFORM set_config('kardex.origen', '', true);

            v_costo_total_venta := v_costo_total_venta + (v_a_operar * v_lote.costo_unitario);
            v_qty_restante := v_qty_restante - v_a_operar;
        END LOOP;

        IF v_qty_restante > 0 AND p_permitir_negativos THEN
            PERFORM set_config('kardex.tipo', 'salida_negativa', true);
            PERFORM set_config('kardex.origen', p_origen_movimiento, true);
            INSERT INTO lotes_fifo (producto_id, fecha_ingreso, cantidad_inicial, cantidad_actual, costo_unitario, origen_movimiento)
            VALUES (v_producto_operar, CURRENT_DATE, 0, -v_qty_restante, v_costo_unitario, p_origen_movimiento) RETURNING id INTO v_nuevo_lote_id;
            PERFORM set_config('kardex.tipo', '', true);
            PERFORM set_config('kardex.origen', '', true);

            v_costo_total_venta := v_costo_total_venta + (v_qty_restante * v_costo_unitario);
        END IF;

    END LOOP;

    RETURN jsonb_build_object('success', true, 'costoTotalVenta', v_costo_total_venta);
END;
$function$;


CREATE OR REPLACE FUNCTION public.rollback_eliminar_nota_credito(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  ALTER TABLE notas_credito DISABLE TRIGGER trg_bloquear_delete_notas_credito;
  DELETE FROM notas_credito WHERE id = p_id;
  ALTER TABLE notas_credito ENABLE TRIGGER trg_bloquear_delete_notas_credito;
END;
$function$;


CREATE OR REPLACE FUNCTION public.run_audit_check_1()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_fails json;
    v_count int;
BEGIN
    WITH fails AS (
        SELECT id, numero, total, saldo_original
        FROM facturas
        WHERE saldo_original IS NOT NULL 
          AND saldo_original > total
    )
    SELECT COALESCE(json_agg(row_to_json(f)), '[]'::json), COUNT(*) INTO v_fails, v_count FROM fails f;
    IF v_count = 0 THEN RETURN json_build_object('success', true);
    ELSE RETURN json_build_object('success', false, 'count', v_count, 'columns', json_build_array('id', 'numero', 'total', 'saldo_original'), 'data', v_fails);
    END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.run_audit_check_10()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_fails json;
    v_count int;
BEGIN
    WITH fails AS (
        SELECT f.id AS factura_id, f.numero AS factura_numero,
               c.id AS cotizacion_id, c.numero AS cotizacion_numero
        FROM facturas f
        JOIN cotizaciones c ON f.cotizacion_origen_id = c.id
        WHERE f.numero IS DISTINCT FROM c.numero
          -- Excepción aceptada: caso histórico revisado y aprobado por Diego el 2026-08-21.
          -- Factura 6070 no puede tomar el número 6765 porque ya lo usa la factura 6060 (registro no relacionado).
          AND f.id NOT IN (6070)
    )
    SELECT COALESCE(json_agg(row_to_json(f)), '[]'::json), COUNT(*) INTO v_fails, v_count FROM fails f;
    IF v_count = 0 THEN RETURN json_build_object('success', true);
    ELSE RETURN json_build_object('success', false, 'count', v_count, 'columns', json_build_array('factura_id', 'factura_numero', 'cotizacion_id', 'cotizacion_numero'), 'data', v_fails);
    END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.run_audit_check_2()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_fails json;
    v_count int;
BEGIN
    WITH fails AS (
        SELECT 
            f.id, f.numero, f.estado, 
            COALESCE(f.saldo_original, f.total) AS total_base,
            COALESCE(SUM(p.monto), 0) AS suma_pagos,
            (COALESCE(f.saldo_original, f.total) - COALESCE(SUM(p.monto), 0)) AS faltante
        FROM facturas f
        LEFT JOIN pagos_ingresos p ON f.id = p.factura_id AND COALESCE(p.estado, '') != 'anulado'
        WHERE f.estado IN ('closed', 'pagada')
        GROUP BY f.id, f.numero, f.estado, f.saldo_original, f.total
        HAVING (COALESCE(f.saldo_original, f.total) - COALESCE(SUM(p.monto), 0)) > 0.01
    )
    SELECT COALESCE(json_agg(row_to_json(f)), '[]'::json), COUNT(*) INTO v_fails, v_count FROM fails f;
    IF v_count = 0 THEN RETURN json_build_object('success', true);
    ELSE RETURN json_build_object('success', false, 'count', v_count, 'columns', json_build_array('id', 'numero', 'estado', 'total_base', 'suma_pagos', 'faltante'), 'data', v_fails);
    END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.run_audit_check_3()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN json_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.run_audit_check_4()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_fails json;
    v_count int;
BEGIN
    WITH fails AS (
        SELECT p.id AS pago_id, p.numero AS pago_numero, p.factura_id AS factura_id_huerfano, p.monto, p.estado
        FROM pagos_ingresos p
        LEFT JOIN facturas f ON p.factura_id = f.id
        WHERE p.factura_id IS NOT NULL AND f.id IS NULL
    )
    SELECT COALESCE(json_agg(row_to_json(f)), '[]'::json), COUNT(*) INTO v_fails, v_count FROM fails f;
    IF v_count = 0 THEN RETURN json_build_object('success', true);
    ELSE RETURN json_build_object('success', false, 'count', v_count, 'columns', json_build_array('pago_id', 'pago_numero', 'factura_id_huerfano', 'monto', 'estado'), 'data', v_fails);
    END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.run_audit_check_5()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_fails json;
    v_count int;
BEGIN
    WITH fails AS (
        SELECT f.id AS factura_id, f.numero AS factura_numero, f.contacto_id AS contacto_id_huerfano, f.estado
        FROM facturas f
        LEFT JOIN contactos c ON f.contacto_id = c.id
        WHERE f.contacto_id IS NOT NULL AND c.id IS NULL
    )
    SELECT COALESCE(json_agg(row_to_json(f)), '[]'::json), COUNT(*) INTO v_fails, v_count FROM fails f;
    IF v_count = 0 THEN RETURN json_build_object('success', true);
    ELSE RETURN json_build_object('success', false, 'count', v_count, 'columns', json_build_array('factura_id', 'factura_numero', 'contacto_id_huerfano', 'estado'), 'data', v_fails);
    END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.run_audit_check_6_manual_sum()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_sum_cxc numeric := 0;
    v_sum_cxp numeric := 0;
BEGIN
    WITH base_facturas AS (
        SELECT 
            f.id, f.tipo, f.estado, COALESCE(f.saldo_original, f.total) as base,
            (SELECT COALESCE(SUM(p.monto), 0)
             FROM pagos_ingresos p
             WHERE p.factura_id = f.id AND COALESCE(p.estado, '') != 'anulado'
               AND (f.saldo_original IS NULL OR (p.id > 22669 AND p.fecha >= '2026-07-26' AND (p.observaciones IS NULL OR p.observaciones NOT ILIKE '%Split del pago%')))
            ) AS suma_pagos
        FROM facturas f
        WHERE f.estado NOT IN ('anulada', 'void', 'voided')
          AND EXTRACT(YEAR FROM COALESCE(f.fecha, f.vencimiento, f.created_at::date)) > 2017
    )
    SELECT 
        COALESCE(SUM(CASE WHEN COALESCE(tipo, 'venta') = 'venta' THEN 
            CASE WHEN estado IN ('pagada', 'closed') THEN 0 ELSE GREATEST(0, base - suma_pagos) END 
            ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo IN ('compra', 'gasto') THEN 
            CASE WHEN estado IN ('pagada', 'closed') THEN 0 ELSE GREATEST(0, base - suma_pagos) END 
            ELSE 0 END), 0)
    INTO v_sum_cxc, v_sum_cxp
    FROM base_facturas;

    RETURN json_build_object('cxc', v_sum_cxc, 'cxp', v_sum_cxp);
END;
$function$;


CREATE OR REPLACE FUNCTION public.run_audit_check_7()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_fails json;
    v_count int;
BEGIN
    WITH fails AS (
        SELECT p.id AS producto_id, p.sku, p.nombre, SUM(l.cantidad_actual) AS suma_lotes
        FROM productos p
        JOIN lotes_fifo l ON p.id = l.producto_id
        WHERE COALESCE(p.sku, '') NOT IN ('2100-V8', '2100-6S', '5001+', '5002+', '5003+', '5004+', '5005+')
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


CREATE OR REPLACE FUNCTION public.run_audit_check_8()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_data json;
    v_count int;
BEGIN
    WITH problemas AS (
        SELECT tablename AS tabla, 'RLS deshabilitado (tabla pública sin protección)' AS problema
        FROM pg_tables
        WHERE schemaname = 'public' AND rowsecurity = false

        UNION ALL

        SELECT t.tablename AS tabla, 'RLS habilitado pero sin ninguna política (bloquea todo acceso)' AS problema
        FROM pg_tables t
        WHERE t.schemaname = 'public'
          AND t.rowsecurity = true
          AND NOT EXISTS (
              SELECT 1 FROM pg_policies p
              WHERE p.schemaname = 'public' AND p.tablename = t.tablename
          )
    )
    SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json), COUNT(*)
    INTO v_data, v_count
    FROM problemas p;

    IF v_count = 0 THEN
        RETURN json_build_object('success', true);
    ELSE
        RETURN json_build_object(
            'success', false,
            'count', v_count,
            'columns', json_build_array('tabla', 'problema'),
            'data', v_data
        );
    END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.save_document_with_details(p_table text, p_header jsonb, p_details jsonb, p_is_update boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
                total_costo          = (p_header->>'total_costo')::numeric,
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
                v_numero := (p_header->>'numero')::bigint;
                PERFORM setval(
                    'documentos_numero_seq',
                    GREATEST(v_numero, (SELECT last_value FROM documentos_numero_seq)),
                    true
                );
            ELSE
                v_numero := nextval('documentos_numero_seq');
            END IF;

            INSERT INTO facturas (
                numero, fecha, vencimiento, contacto_id,
                total, total_costo, estado, tipo, observaciones, cotizacion_origen_id
            ) VALUES (
                v_numero,
                (p_header->>'fecha')::date,
                (p_header->>'vencimiento')::date,
                (p_header->>'contacto_id')::bigint,
                (p_header->>'total')::numeric,
                (p_header->>'total_costo')::numeric,
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
$function$;


CREATE OR REPLACE FUNCTION public.set_next_numero(p_table text, p_next bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_max_actual bigint;
BEGIN
    IF p_table NOT IN ('facturas', 'cotizaciones') THEN
        RAISE EXCEPTION 'Tabla % no soportada para actualización de secuencias', p_table;
    END IF;
    SELECT GREATEST(
        COALESCE((SELECT MAX(numero) FROM facturas), 0),
        COALESCE((SELECT MAX(numero) FROM cotizaciones), 0)
    ) INTO v_max_actual;
    IF p_next <= v_max_actual THEN
        RAISE EXCEPTION
            'El número % es menor o igual al máximo en uso (%). Usa un valor mayor a %.',
            p_next, v_max_actual, v_max_actual;
    END IF;
    PERFORM setval('documentos_numero_seq', p_next - 1, true);
    UPDATE contadores_documentos
    SET siguiente_numero = p_next
    WHERE tabla = p_table;
    IF NOT FOUND THEN
        INSERT INTO contadores_documentos (tabla, siguiente_numero)
        VALUES (p_table, p_next)
        ON CONFLICT (tabla) DO UPDATE SET siguiente_numero = EXCLUDED.siguiente_numero;
    END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.sum_pagos_filtrado(p_tipo text, p_categoria text, p_fecha_desde date, p_fecha_hasta date)
 RETURNS numeric
 LANGUAGE sql
AS $function$
    SELECT COALESCE(SUM(monto), 0)
    FROM pagos_ingresos
    WHERE tipo = p_tipo
      AND factura_id IS NULL
      AND estado != 'anulado'
      AND (p_categoria IS NULL OR categoria = p_categoria)
      AND (p_fecha_desde IS NULL OR fecha >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR fecha <= p_fecha_hasta);
$function$;


CREATE OR REPLACE FUNCTION public.sync_stock_producto()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_producto_id integer;
begin
  v_producto_id := coalesce(NEW.producto_id, OLD.producto_id);

  update productos
  set stock = (
    select coalesce(sum(cantidad_actual), 0)
    from lotes_fifo
    where producto_id = v_producto_id
  )
  where id = v_producto_id;

  return null;
end;
$function$;



CREATE OR REPLACE FUNCTION public.get_kardex_producto(p_producto_id bigint)
 RETURNS TABLE(movimiento_id bigint, lote_id bigint, tipo_operacion text, cantidad_anterior numeric, cantidad_nueva numeric, diferencia numeric, origen_documento text, referencia_lote text, creado_en timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
    WITH movimientos AS (
        SELECT 
            m.id as movimiento_id,
            m.lote_id,
            m.tipo_operacion,
            m.diferencia,
            m.origen_documento,
            m.referencia_lote,
            m.creado_en
        FROM lotes_fifo_movimientos m
        WHERE m.producto_id = p_producto_id
    ),
    saldos AS (
        SELECT 
            movimiento_id,
            lote_id,
            tipo_operacion,
            COALESCE(SUM(diferencia) OVER (ORDER BY creado_en ASC, movimiento_id ASC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS cantidad_anterior,
            SUM(diferencia) OVER (ORDER BY creado_en ASC, movimiento_id ASC) AS cantidad_nueva,
            diferencia,
            origen_documento,
            referencia_lote,
            creado_en
        FROM movimientos
    )
    SELECT * FROM saldos ORDER BY creado_en DESC, movimiento_id DESC;
$function$;
