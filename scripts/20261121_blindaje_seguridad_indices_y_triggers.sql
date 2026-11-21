-- =============================================================================
-- MIGRACIÓN CANÓNICA: BLINDAJE DE SEGURIDAD, ÍNDICES DE RENDIMIENTO Y TRIGGERS
-- Fecha: 21 de Noviembre de 2026
-- Proyecto: Sistema Contable MAS Accesorios
-- Motor: PostgreSQL 17.6 (Supabase Managed)
-- Estado: APLICADO EXITOSAMENTE EN PRODUCCIÓN
-- =============================================================================

BEGIN;

-- 1. SEGURIDAD: REVOCAR ACCESO ANÓNIMO A TABLAS Y FORZAR AUTENTICACIÓN
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

-- 2. POLÍTICAS RLS EN TABLAS PREVIAMENTE EXPUESTAS
ALTER POLICY "allow all authenticated" ON public.ajustes_inventario 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "allow all authenticated" ON public.categorias_contables 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "allow all authenticated" ON public.contadores_documentos 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "allow all authenticated" ON public.notas_credito 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "allow all authenticated" ON public.nota_credito_detalles 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "Permitir todo a usuarios autenticados" ON public.conciliaciones 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 3. SEGURIDAD: BLINDAR get_productos_page_v2 Y get_contactos_page
REVOKE EXECUTE ON FUNCTION public.get_productos_page_v2(integer, integer, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_productos_page_v2(integer, integer, text, text, text, text) TO authenticated, service_role;
ALTER FUNCTION public.get_productos_page_v2(integer, integer, text, text, text, text) SECURITY INVOKER SET search_path = public, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_contactos_page(integer, integer, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_contactos_page(integer, integer, text, text, text, text) TO authenticated, service_role;
ALTER FUNCTION public.get_contactos_page(integer, integer, text, text, text, text) SECURITY INVOKER SET search_path = public, extensions, pg_temp;

-- 4. AISLAR EXTENSIÓN pg_trgm EN ESQUEMA extensions
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- 5. RENDIMIENTO: 9 ÍNDICES DE COBERTURA PARA FOREIGN KEYS
CREATE INDEX IF NOT EXISTS idx_comisiones_cuenta_id ON public.comisiones(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_comisiones_vendedor_id ON public.comisiones(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_banco_id ON public.conciliaciones(banco_id);
CREATE INDEX IF NOT EXISTS idx_contactos_vendedor_id ON public.contactos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_facturas_vendedor_id ON public.facturas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_nota_credito_detalles_nc_id ON public.nota_credito_detalles(nota_credito_id);
CREATE INDEX IF NOT EXISTS idx_nota_credito_detalles_prod_id ON public.nota_credito_detalles(producto_id);
CREATE INDEX IF NOT EXISTS idx_notas_credito_contacto_id ON public.notas_credito(contacto_id);
CREATE INDEX IF NOT EXISTS idx_notas_credito_factura_id ON public.notas_credito(factura_id);

-- 6. RENDIMIENTO: ELIMINAR 3 ÍNDICES DUPLICADOS
DROP INDEX IF EXISTS public.idx_cotizacion_detalles_cotiz_id;
DROP INDEX IF EXISTS public.idx_lotes_fifo_movimientos_creado;
DROP INDEX IF EXISTS public.idx_lotes_fifo_movimientos_prod_id;

-- 7. RENDIMIENTO: OPTIMIZACIÓN RLS (INITPLAN EN 14 POLÍTICAS)
ALTER POLICY "acceso_autenticado_contactos" ON public.contactos 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_productos" ON public.productos 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_cuentas" ON public.cuentas_bancarias 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_facturas" ON public.facturas 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_factura_det" ON public.factura_detalles 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_cotizaciones" ON public.cotizaciones 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_cotizacion_det" ON public.cotizacion_detalles 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_pagos" ON public.pagos_ingresos 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_lotes" ON public.lotes_fifo 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_cuentas_cobro" ON public.cuentas_cobro 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_movimientos" ON public.lotes_fifo_movimientos 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_vendedores" ON public.vendedores 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_comisiones" ON public.comisiones 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

ALTER POLICY "acceso_autenticado_nanocarbon_factores_corte" ON public.nanocarbon_factores_corte 
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 8. INTEGRIDAD: TRIGGER ATÓMICO PARA RECALCULAR FACTURA ANTE CAMBIOS EN PAGOS
CREATE OR REPLACE FUNCTION public.trg_fn_recalcular_factura_desde_pago()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.factura_id IS NOT NULL THEN PERFORM public.recalcular_estado_factura(OLD.factura_id); END IF;
        RETURN OLD;
    ELSE
        IF NEW.factura_id IS NOT NULL THEN PERFORM public.recalcular_estado_factura(NEW.factura_id); END IF;
        IF TG_OP = 'UPDATE' AND OLD.factura_id IS DISTINCT FROM NEW.factura_id AND OLD.factura_id IS NOT NULL THEN
            PERFORM public.recalcular_estado_factura(OLD.factura_id);
        END IF;
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_factura_estado_pago ON public.pagos_ingresos;
CREATE TRIGGER trg_sync_factura_estado_pago
AFTER INSERT OR UPDATE OF monto, estado, factura_id OR DELETE ON public.pagos_ingresos
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_recalcular_factura_desde_pago();

-- 9. SEGURIDAD: FIJAR search_path SEGURO EN FUNCIONES
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN (
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args 
        FROM pg_proc p 
        JOIN pg_namespace n ON n.oid = p.pronamespace 
        WHERE n.nspname = 'public' AND p.prokind = 'f'
    ) 
    LOOP 
        EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, extensions, pg_temp', r.proname, r.args); 
    END LOOP; 
END $$;

COMMIT;
