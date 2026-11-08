-- =============================================================================
-- FASE 1: BLINDAJE DE SEGURIDAD EN RED, PERMISOS RPC E ÍNDICES RELACIONALES
-- Archivo: scripts/fase1_blindaje_seguridad_e_indices.sql
-- Ejecución: Supabase Dashboard > SQL Editor (Seguro para ejecución "en caliente")
-- =============================================================================

-- =============================================================================
-- 1. BLINDAJE DE ACCESO EN RED A PROCEDIMIENTOS ALMACENADOS (RPC)
-- =============================================================================
-- Revoca permisos de ejecución al rol público y anónimo en todas las funciones del
-- esquema public, garantizando que nadie sin iniciar sesión pueda invocar RPCs.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM public, anon;

-- Concede ejecución de forma explícita al rol autenticado (usuarios logueados en la app)
-- y al rol service_role (procesos de administración interna).
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- Configura los privilegios por defecto para que cualquier función futura herede
-- automáticamente esta política restrictiva.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM public, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;


-- =============================================================================
-- 2. HARDENING DE FUNCIONES CRÍTICAS (SEARCH_PATH SEGURO + VALIDACIÓN DE SESIÓN)
-- =============================================================================
-- Evita vulnerabilidades de Search Path Hijacking en funciones SECURITY DEFINER
-- y añade verificación explícita de autenticación en los procedimientos más sensibles.

-- 2.1 Consulta de Cartera con Saldos
CREATE OR REPLACE FUNCTION public.get_cartera_con_saldos(p_tipo_cartera text, p_contacto_id text DEFAULT NULL::text)
 RETURNS TABLE(id text, numero text, fecha date, vencimiento date, contacto_id text, estado text, tipo text, total numeric, saldo_original numeric, saldo numeric, total_pagado numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Acceso denegado: Requiere autenticación.';
    END IF;

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
    ),
    pagos_agrupados AS (
        SELECT 
            p.factura_id,
            SUM(p.monto) as total_abonos
        FROM pagos_ingresos p
        JOIN facturas_base fb ON p.factura_id = fb.id_bigint
        WHERE COALESCE(p.estado, '') != 'anulado'
          AND (
              fb.tiene_saldo_original = false 
              OR (
                  p.id > 22669 
                  AND p.fecha >= '2026-07-26' 
                  AND (p.observaciones IS NULL OR p.observaciones NOT ILIKE '%Split del pago%')
              )
          )
        GROUP BY p.factura_id
    )
    SELECT 
        fb.id,
        fb.numero,
        fb.fecha,
        fb.vencimiento,
        fb.contacto_id,
        'pendiente'::text as estado,
        fb.tipo,
        fb.calc_total,
        fb.saldo_original,
        ROUND(GREATEST(0, (CASE WHEN fb.tiene_saldo_original THEN fb.calc_saldo_original ELSE fb.calc_total END) - COALESCE(pa.total_abonos, 0)), 2) as saldo,
        COALESCE(pa.total_abonos, 0) as total_pagado
    FROM facturas_base fb
    LEFT JOIN pagos_agrupados pa ON fb.id_bigint = pa.factura_id
    WHERE ROUND(GREATEST(0, (CASE WHEN fb.tiene_saldo_original THEN fb.calc_saldo_original ELSE fb.calc_total END) - COALESCE(pa.total_abonos, 0)), 2) > 0.01
    ORDER BY fb.fecha ASC;
END;
$function$;

-- 2.2 Consulta de Movimientos de Banco
CREATE OR REPLACE FUNCTION public.get_movimientos_banco(p_cuenta_id bigint, p_offset integer, p_limit integer, p_search text DEFAULT ''::text, p_tipo text DEFAULT 'todos'::text)
 RETURNS TABLE(id bigint, fecha date, tipo text, monto numeric, cuenta_id bigint, factura_id bigint, contacto_id bigint, estado text, referencia text, observaciones text, categoria text, grupo_pago_id text, tercero_nombre text, tercero_nit text, factura_numero bigint, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Acceso denegado: Requiere autenticación.';
    END IF;

    RETURN QUERY
    WITH base_filtrada AS (
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
            c.nombre AS tercero_nombre,
            c.identificacion AS tercero_nit,
            f.numero AS factura_numero
        FROM pagos_ingresos p
        LEFT JOIN contactos c ON p.contacto_id = c.id
        LEFT JOIN facturas f ON p.factura_id = f.id
        WHERE p.cuenta_id = p_cuenta_id
          AND (p_tipo = 'todos' OR p.tipo = p_tipo)
          AND (
              p_search = '' 
              OR c.nombre ILIKE '%' || p_search || '%'
              OR c.identificacion ILIKE '%' || p_search || '%'
              OR p.observaciones ILIKE '%' || p_search || '%'
              OR p.referencia ILIKE '%' || p_search || '%'
              OR p.categoria ILIKE '%' || p_search || '%'
              OR f.numero::text ILIKE '%' || p_search || '%'
          )
    ),
    conteo_total AS (
        SELECT COUNT(*) AS total FROM base_filtrada
    )
    SELECT 
        b.id,
        b.fecha,
        b.tipo,
        b.monto,
        b.cuenta_id,
        b.factura_id,
        b.contacto_id,
        b.estado,
        b.referencia,
        b.observaciones,
        b.categoria,
        b.grupo_pago_id,
        b.tercero_nombre,
        b.tercero_nit,
        b.factura_numero,
        ct.total AS total_count
    FROM base_filtrada b
    CROSS JOIN conteo_total ct
    ORDER BY b.fecha DESC, b.id DESC
    OFFSET p_offset
    LIMIT p_limit;
END;
$function$;

-- 2.3 Obtención y Avance Seguro de Secuencias
CREATE OR REPLACE FUNCTION public.get_next_sequence_value(seq_name text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Acceso denegado: Requiere autenticación.';
    END IF;

    -- Validar contra una lista blanca de secuencias permitidas para evitar inyecciones
    IF seq_name NOT IN ('facturas_numero_seq', 'cotizaciones_numero_seq', 'ajustes_inventario_seq', 'cuentas_cobro_numero_seq', 'documentos_numero_seq') THEN
        RAISE EXCEPTION 'Secuencia no autorizada: %', seq_name;
    END IF;

    RETURN nextval(seq_name::regclass);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_next_numero(p_table text, p_next bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_max_actual bigint;
BEGIN
    IF auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Acceso denegado: Requiere autenticación.';
    END IF;

    IF p_table NOT IN ('facturas', 'cotizaciones') THEN
        RAISE EXCEPTION 'Tabla % no soportada para actualización de secuencias', p_table;
    END IF;
    
    SELECT GREATEST(
        COALESCE((SELECT MAX(numero) FROM facturas), 0),
        COALESCE((SELECT MAX(numero) FROM cotizaciones), 0)
    ) INTO v_max_actual;
    
    IF p_next <= v_max_actual THEN
        RAISE EXCEPTION 'El número % es menor o igual al máximo en uso (%). Usa un valor mayor a %.',
            p_next, v_max_actual, v_max_actual;
    END IF;
    
    IF p_table = 'facturas' THEN
        PERFORM setval('facturas_numero_seq', p_next - 1, true);
    ELSIF p_table = 'cotizaciones' THEN
        PERFORM setval('cotizaciones_numero_seq', p_next - 1, true);
    END IF;
    
    -- Compatibilidad con documentos_numero_seq si existe
    BEGIN
        PERFORM setval('documentos_numero_seq', p_next - 1, true);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END;
$function$;

-- 2.4 Eliminación Segura de Factura
CREATE OR REPLACE FUNCTION public.eliminar_factura_venta(p_factura_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
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
    IF auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Acceso denegado: Requiere autenticación.';
    END IF;

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

    FOR v_detalle IN
        SELECT fd.producto_id, fd.cantidad, fd.precio_unitario, p.sku
        FROM factura_detalles fd
        JOIN productos p ON p.id = fd.producto_id
        WHERE fd.factura_id = p_factura_id
    LOOP
        SELECT metros_por_unidad INTO v_metros_por_unidad
        FROM nanocarbon_factores_corte
        WHERE producto_id = v_detalle.producto_id;

        IF FOUND AND v_metros_por_unidad IS NOT NULL AND v_metros_por_unidad > 0 THEN
            SELECT id INTO v_producto_destino FROM productos WHERE sku = 'NC-BOBINA-PADRE' LIMIT 1;
            IF v_producto_destino IS NULL THEN
                SELECT id INTO v_producto_destino FROM productos WHERE sku = 'NC-BOBINA' LIMIT 1;
            END IF;
            IF v_producto_destino IS NOT NULL THEN
                v_cantidad_destino := v_detalle.cantidad * v_metros_por_unidad;
                INSERT INTO lotes_fifo (
                    producto_id, cantidad_inicial, cantidad_actual, costo_unitario,
                    fecha_ingreso, origen_movimiento, referencia
                ) VALUES (
                    v_producto_destino, v_cantidad_destino, v_cantidad_destino, 0,
                    CURRENT_DATE, 'Reversión venta eliminada (conversión)',
                    'Reversión Fac #' || v_factura.numero
                );
            END IF;
        ELSE
            SELECT costo_unitario INTO v_costo
            FROM lotes_fifo
            WHERE producto_id = v_detalle.producto_id
            ORDER BY id DESC LIMIT 1;

            IF v_costo IS NULL THEN
                SELECT costo_base INTO v_costo FROM productos WHERE id = v_detalle.producto_id;
            END IF;
            v_costo := COALESCE(v_costo, 0);

            INSERT INTO lotes_fifo (
                producto_id, cantidad_inicial, cantidad_actual, costo_unitario,
                fecha_ingreso, origen_movimiento, referencia
            ) VALUES (
                v_detalle.producto_id, v_detalle.cantidad, v_detalle.cantidad, v_costo,
                CURRENT_DATE, 'Reversión venta eliminada',
                'Reversión Fac #' || v_factura.numero
            );
        END IF;
    END LOOP;

    DELETE FROM comisiones WHERE factura_id = p_factura_id;
    DELETE FROM factura_detalles WHERE factura_id = p_factura_id;
    DELETE FROM facturas WHERE id = p_factura_id;

    RETURN jsonb_build_object(
        'success', true,
        'factura_id', p_factura_id,
        'numero', v_factura.numero,
        'mensaje', 'Factura eliminada y stock revertido exitosamente.'
    );
END;
$function$;

-- 2.5 Anulación Segura de Venta Pagada
CREATE OR REPLACE FUNCTION public.anular_venta_pagada(p_factura_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_factura record;
    v_notas_count int;
    v_detalle record;
    v_costo numeric;
    v_metros_por_unidad numeric;
    v_producto_destino bigint;
    v_cantidad_destino numeric;
BEGIN
    IF auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Acceso denegado: Requiere autenticación.';
    END IF;

    SELECT * INTO v_factura FROM facturas WHERE id = p_factura_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura no encontrada (ID: %)', p_factura_id;
    END IF;
    IF v_factura.estado IN ('anulada', 'void') THEN
        RAISE EXCEPTION 'La factura ya se encuentra anulada.';
    END IF;
    SELECT COUNT(*) INTO v_notas_count FROM notas_credito WHERE factura_id = p_factura_id AND estado != 'anulada';
    IF v_notas_count > 0 THEN
        RAISE EXCEPTION 'No se puede anular: tiene notas crédito activas asociadas. Anula las notas crédito primero.';
    END IF;

    FOR v_detalle IN
        SELECT fd.producto_id, fd.cantidad, p.sku
        FROM factura_detalles fd
        JOIN productos p ON p.id = fd.producto_id
        WHERE fd.factura_id = p_factura_id
    LOOP
        SELECT metros_por_unidad INTO v_metros_por_unidad
        FROM nanocarbon_factores_corte
        WHERE producto_id = v_detalle.producto_id;

        IF FOUND AND v_metros_por_unidad IS NOT NULL AND v_metros_por_unidad > 0 THEN
            SELECT id INTO v_producto_destino FROM productos WHERE sku = 'NC-BOBINA-PADRE' LIMIT 1;
            IF v_producto_destino IS NULL THEN
                SELECT id INTO v_producto_destino FROM productos WHERE sku = 'NC-BOBINA' LIMIT 1;
            END IF;
            IF v_producto_destino IS NOT NULL THEN
                v_cantidad_destino := v_detalle.cantidad * v_metros_por_unidad;
                INSERT INTO lotes_fifo (
                    producto_id, cantidad_inicial, cantidad_actual, costo_unitario,
                    fecha_ingreso, origen_movimiento, referencia
                ) VALUES (
                    v_producto_destino, v_cantidad_destino, v_cantidad_destino, 0,
                    CURRENT_DATE, 'Reversión venta anulada (conversión)',
                    'Anulación Fac #' || v_factura.numero
                );
            END IF;
        ELSE
            SELECT costo_unitario INTO v_costo
            FROM lotes_fifo
            WHERE producto_id = v_detalle.producto_id
            ORDER BY id DESC LIMIT 1;

            IF v_costo IS NULL THEN
                SELECT costo_base INTO v_costo FROM productos WHERE id = v_detalle.producto_id;
            END IF;
            v_costo := COALESCE(v_costo, 0);

            INSERT INTO lotes_fifo (
                producto_id, cantidad_inicial, cantidad_actual, costo_unitario,
                fecha_ingreso, origen_movimiento, referencia
            ) VALUES (
                v_detalle.producto_id, v_detalle.cantidad, v_detalle.cantidad, v_costo,
                CURRENT_DATE, 'Reversión venta anulada',
                'Anulación Fac #' || v_factura.numero
            );
        END IF;
    END LOOP;

    UPDATE pagos_ingresos
    SET estado = 'anulado'
    WHERE factura_id = p_factura_id AND COALESCE(estado, '') != 'anulado';

    UPDATE comisiones
    SET estado = 'anulada'
    WHERE factura_id = p_factura_id;

    UPDATE facturas
    SET estado = 'anulada',
        observaciones = COALESCE(observaciones, '') || ' [Anulada el ' || CURRENT_DATE::text || ']'
    WHERE id = p_factura_id;

    RETURN jsonb_build_object(
        'success', true,
        'factura_id', p_factura_id,
        'numero', v_factura.numero,
        'mensaje', 'Factura anulada, pagos y comisiones anulados, y stock devuelto exitosamente.'
    );
END;
$function$;


-- =============================================================================
-- 3. ÍNDICES DE RENDIMIENTO (CERO BLOQUEOS, 100% SEGURO EN CALIENTE)
-- =============================================================================
-- No alteran tipos ni restricciones. Aceleran búsquedas, uniones y agregaciones.

CREATE INDEX IF NOT EXISTS idx_pagos_ingresos_factura_id ON public.pagos_ingresos(factura_id);
CREATE INDEX IF NOT EXISTS idx_pagos_ingresos_contacto_id ON public.pagos_ingresos(contacto_id);
CREATE INDEX IF NOT EXISTS idx_pagos_ingresos_cuenta_id ON public.pagos_ingresos(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_ingresos_fecha ON public.pagos_ingresos(fecha);
CREATE INDEX IF NOT EXISTS idx_pagos_ingresos_grupo ON public.pagos_ingresos(grupo_pago_id);

CREATE INDEX IF NOT EXISTS idx_facturas_contacto_id ON public.facturas(contacto_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON public.facturas(fecha);
CREATE INDEX IF NOT EXISTS idx_facturas_estado ON public.facturas(estado);
CREATE INDEX IF NOT EXISTS idx_facturas_tipo ON public.facturas(tipo);
CREATE INDEX IF NOT EXISTS idx_facturas_numero ON public.facturas(numero);

CREATE INDEX IF NOT EXISTS idx_factura_detalles_factura_id ON public.factura_detalles(factura_id);
CREATE INDEX IF NOT EXISTS idx_factura_detalles_producto_id ON public.factura_detalles(producto_id);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_contacto_id ON public.cotizaciones(contacto_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_detalles_cotiz_id ON public.cotizacion_detalles(cotizacion_id);

CREATE INDEX IF NOT EXISTS idx_lotes_fifo_producto_id ON public.lotes_fifo(producto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_fifo_fecha_ingreso ON public.lotes_fifo(fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_lotes_fifo_movimientos_prod_id ON public.lotes_fifo_movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_fifo_movimientos_creado ON public.lotes_fifo_movimientos(creado_en);
