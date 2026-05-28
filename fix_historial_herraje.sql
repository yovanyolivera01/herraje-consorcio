-- ================================================================
-- FIX: Historial de herraje no muestra ventas
-- Causas posibles:
--   1. RLS habilitado en ventas/detalle_venta sin política permisiva
--   2. v_historial_ventas view no incluye productos generales
--   3. movimientos_inventario trigger bloqueando inserts
--
-- Ejecutar completo en Supabase → SQL Editor → Run
-- ================================================================

-- ── 1. RLS permisivo para ventas ─────────────────────────────────
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_anon" ON ventas;
CREATE POLICY "allow_all_anon" ON ventas
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── 2. RLS permisivo para detalle_venta ──────────────────────────
ALTER TABLE detalle_venta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_anon" ON detalle_venta;
CREATE POLICY "allow_all_anon" ON detalle_venta
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── 3. RLS permisivo para movimientos_inventario ─────────────────
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_anon" ON movimientos_inventario;
CREATE POLICY "allow_all_anon" ON movimientos_inventario
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── 4. Recrear v_historial_ventas ────────────────────────────────
--    Versión anterior: posiblemente filtraba solo producto_id IS NOT NULL
--    Versión nueva: incluye tanto herraje como productos generales
DROP VIEW IF EXISTS v_historial_ventas;
CREATE VIEW v_historial_ventas AS
SELECT
  v.id,
  v.folio,
  v.fecha_hora,
  COALESCE(v.total, 0)::NUMERIC(12,2)   AS total,
  COUNT(d.id)::INTEGER                  AS num_partidas,
  COALESCE(SUM(d.cantidad), 0)::INTEGER AS total_piezas
FROM ventas v
LEFT JOIN detalle_venta d ON d.venta_id = v.id
GROUP BY v.id, v.folio, v.fecha_hora, v.total
ORDER BY v.fecha_hora DESC;

-- Acceso anon/authenticated a la vista
GRANT SELECT ON v_historial_ventas TO anon, authenticated;

-- ── Diagnóstico (ejecuta por separado para verificar) ─────────────
--
-- 1. ¿Hay ventas en la tabla?
-- SELECT COUNT(*), MIN(fecha_hora), MAX(fecha_hora) FROM ventas;
--
-- 2. ¿Qué devuelve la vista?
-- SELECT * FROM v_historial_ventas LIMIT 10;
--
-- 3. ¿Hay filas en detalle_venta?
-- SELECT COUNT(*), SUM(CASE WHEN producto_id IS NULL THEN 1 ELSE 0 END) AS generales
-- FROM detalle_venta;
 ..                                                                                                                                               