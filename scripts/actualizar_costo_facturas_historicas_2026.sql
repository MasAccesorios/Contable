-- =============================================================================
-- RECONCILIACIÓN Y ACTUALIZACIÓN: COSTO HISTÓRICO DE FACTURAS 2026 (ENERO - JULIO)
-- Archivo: scripts/actualizar_costo_facturas_historicas_2026.sql
-- =============================================================================
-- Contexto:
-- Las 153 facturas de venta emitidas entre 2026-01-01 y 2026-07-31 procedían de la
-- migración inicial previa al encendido del motor FIFO en vivo (01/08/2026).
-- Tenían su campo total_costo en 0.
-- Este script asigna el costo real de mercancía vendida calculado desde factura_detalles
-- y el costo_base de cada producto del catálogo.
-- =============================================================================

-- 1. Actualización atómica del costo consolidado en facturas
UPDATE facturas f
SET total_costo = det.costo_calculado
FROM (
    SELECT 
        fd.factura_id,
        ROUND(SUM(fd.cantidad * COALESCE(p.costo_base, 0)), 2) as costo_calculado
    FROM factura_detalles fd
    JOIN productos p ON fd.producto_id = p.id
    GROUP BY fd.factura_id
) det
WHERE f.id = det.factura_id
  AND f.tipo = 'venta'
  AND f.fecha >= '2026-01-01'
  AND f.fecha < '2026-08-01'
  AND (f.total_costo IS NULL OR f.total_costo = 0);

-- 2. Actualización de la función RPC para ordenamiento descendente (más recientes primero)
CREATE OR REPLACE FUNCTION public.get_reporte_ventas_utilidad(p_fecha_inicio date, p_fecha_fin date)
 RETURNS TABLE("Documento" text, "Fecha" date, "Cliente" text, "Estado" text, "Total de Venta" numeric, "Costo de Venta (FIFO)" numeric, "Utilidad Bruta" numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(f.numero::TEXT, f.id::TEXT) AS "Documento",
        f.fecha AS "Fecha",
        COALESCE(c.nombre, 'Cliente Genérico / Contado')::TEXT AS "Cliente",
        f.estado::TEXT AS "Estado",
        ROUND(f.total) AS "Total de Venta",
        ROUND(COALESCE(f.total_costo, 0)) AS "Costo de Venta (FIFO)",
        ROUND(f.total - COALESCE(f.total_costo, 0)) AS "Utilidad Bruta"
    FROM facturas f
    LEFT JOIN contactos c ON f.contacto_id = c.id
    WHERE f.tipo = 'venta'
    AND f.estado NOT IN ('anulada', 'void')
    AND f.fecha >= p_fecha_inicio
    AND f.fecha <= p_fecha_fin
    ORDER BY f.fecha DESC, f.id DESC;
END;
$function$;
