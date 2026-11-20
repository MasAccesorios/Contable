-- ============================================================================
-- SCRIPT DE MIGRACIÓN Y CONSOLIDACIÓN ATÓMICA DE CLIENTE
-- Objetivo: Deduplicar y unificar 'Alberto Arroyo' (ID 661 -> ID 347)
-- Base de Datos: PostgreSQL 17 / Supabase (mas-accesorios-contable)
-- Auditado por: planner y database-reviewer (ECC Agents)
-- ============================================================================

DO $$
DECLARE
    v_facturas_actualizadas INT;
    v_cotizaciones_actualizadas INT;
    v_pagos_actualizados INT;
    v_notas_actualizadas INT;
    v_facturas_totales INT;
    v_cotizaciones_totales INT;
    v_pagos_totales INT;
    v_contacto_661_restante INT;
BEGIN
    -- Paso 1: Habilitar modificación en movimientos conciliados para esta transacción
    PERFORM set_config('app.permitir_cambio_conciliado', 'on', true);

    -- Paso 1.1: Lock determinista y verificación de existencia de ambos registros
    PERFORM 1 FROM public.contactos WHERE id IN (347, 661) ORDER BY id FOR UPDATE;
    IF (SELECT count(*) FROM public.contactos WHERE id IN (347, 661)) <> 2 THEN
        RAISE EXCEPTION 'ABORTANDO: Uno o ambos contactos (347, 661) no existen en la base de datos.';
    END IF;

    -- Paso 2: Consolidar teléfono en el contacto canónico superviviente (ID 347)
    UPDATE public.contactos
    SET 
        telefono = '3132476670'
    WHERE id = 347;

    -- Paso 3: Reasignar Facturas
    WITH rows AS (
        UPDATE public.facturas
        SET contacto_id = 347
        WHERE contacto_id = 661
        RETURNING 1
    )
    SELECT count(*) INTO v_facturas_actualizadas FROM rows;

    -- Paso 4: Reasignar Cotizaciones
    WITH rows AS (
        UPDATE public.cotizaciones
        SET contacto_id = 347
        WHERE contacto_id = 661
        RETURNING 1
    )
    SELECT count(*) INTO v_cotizaciones_actualizadas FROM rows;

    -- Paso 5: Reasignar Pagos e Ingresos
    WITH rows AS (
        UPDATE public.pagos_ingresos
        SET contacto_id = 347
        WHERE contacto_id = 661
        RETURNING 1
    )
    SELECT count(*) INTO v_pagos_actualizados FROM rows;

    -- Paso 6: Reasignar Notas Crédito (defensivo)
    WITH rows AS (
        UPDATE public.notas_credito
        SET contacto_id = 347
        WHERE contacto_id = 661
        RETURNING 1
    )
    SELECT count(*) INTO v_notas_actualizadas FROM rows;

    -- Paso 7: Validar que 661 ya no tenga ninguna referencia activa antes de eliminar
    SELECT 
        (SELECT count(*) FROM public.facturas WHERE contacto_id = 661) +
        (SELECT count(*) FROM public.cotizaciones WHERE contacto_id = 661) +
        (SELECT count(*) FROM public.pagos_ingresos WHERE contacto_id = 661) +
        (SELECT count(*) FROM public.notas_credito WHERE contacto_id = 661)
    INTO v_contacto_661_restante;

    IF v_contacto_661_restante > 0 THEN
        RAISE EXCEPTION 'ABORTANDO: Existen % referencias activas aún asociadas al ID 661.', v_contacto_661_restante;
    END IF;

    -- Paso 8: Eliminar el contacto duplicado ID 661
    DELETE FROM public.contactos WHERE id = 661;

    -- Paso 9: Aserciones finales de consistencia sobre ID 347
    SELECT count(*) INTO v_facturas_totales FROM public.facturas WHERE contacto_id = 347;
    SELECT count(*) INTO v_cotizaciones_totales FROM public.cotizaciones WHERE contacto_id = 347;
    SELECT count(*) INTO v_pagos_totales FROM public.pagos_ingresos WHERE contacto_id = 347;

    IF v_facturas_totales <> 51 THEN
        RAISE EXCEPTION 'FALLO EN ASERCIÓN: Total de facturas para ID 347 esperado: 51, obtenido: %', v_facturas_totales;
    END IF;

    IF v_cotizaciones_totales <> 25 THEN
        RAISE EXCEPTION 'FALLO EN ASERCIÓN: Total de cotizaciones para ID 347 esperado: 25, obtenido: %', v_cotizaciones_totales;
    END IF;

    IF v_pagos_totales <> 65 THEN
        RAISE EXCEPTION 'FALLO EN ASERCIÓN: Total de pagos_ingresos para ID 347 esperado: 65, obtenido: %', v_pagos_totales;
    END IF;

    RAISE NOTICE 'CONSOLIDACIÓN EXITOSA: Facturas transferidas: %, Cotizaciones transferidas: %, Pagos transferidos: %, Total consolidado ID 347 verificado.',
        v_facturas_actualizadas, v_cotizaciones_actualizadas, v_pagos_actualizados;
END $$;
