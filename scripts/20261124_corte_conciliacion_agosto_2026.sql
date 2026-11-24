-- Script de Corte de Conciliación Bancaria (01/08/2026)
-- Cierra y marca como conciliadas todas las transacciones históricas previas a agosto de 2026 en pagos_ingresos.
-- De esta forma el KPI ejecutivo 'Por Conciliar' en el módulo de Bancos y Cajas refleja de manera precisa
-- únicamente las transacciones abiertas vivas a partir del 1 de agosto de 2026.

BEGIN;

UPDATE public.pagos_ingresos
SET conciliado_en = '2026-08-01 00:00:00+00'
WHERE fecha < '2026-08-01'
  AND conciliado_en IS NULL
  AND estado != 'anulado';

COMMIT;
