-- ================================================================
-- Agrega hojas_entrada y hojas_restante al inventario de vidrio
-- Ejecutar en: Supabase → SQL Editor → Run
-- ================================================================

-- 1. Agregar columna hojas_entrada (counter de entradas manuales, inicia en 0)
ALTER TABLE inventario_vidrio
  ADD COLUMN IF NOT EXISTS hojas_entrada INTEGER DEFAULT 0;

-- 2. Agregar columna m2_hoja (m² reales por hoja, columna regular — no la generada)
ALTER TABLE inventario_vidrio
  ADD COLUMN IF NOT EXISTS m2_hoja NUMERIC;

-- 3. Backfill hojas_entrada = 0 para lotes existentes
UPDATE inventario_vidrio
SET hojas_entrada = 0
WHERE hojas_entrada IS NULL;

-- 4. Backfill m2_hoja desde m2_total_inicial / cantidad_hojas para lotes existentes
UPDATE inventario_vidrio
SET m2_hoja = ROUND(m2_total_inicial / NULLIF(cantidad_hojas, 0), 4)
WHERE m2_hoja IS NULL AND cantidad_hojas > 0;

-- 5. Recrear vista con los nuevos campos
--    hojas_restante usa m2_hoja (columna correcta) en vez de la columna generada m2_por_hoja
DROP VIEW IF EXISTS v_inventario_vidrio;
CREATE VIEW v_inventario_vidrio AS
SELECT
  iv.id_inventario,
  tv.clave                                                       AS tipo_vidrio,
  (iv.largo_cm || 'x' || iv.ancho_cm || ' cm')                  AS medidas,
  iv.id_tipo_vidrio,
  COALESCE(iv.hojas_entrada, 0)                                  AS hojas_entrada,
  iv.cantidad_hojas,
  ROUND(iv.m2_disponible / NULLIF(iv.m2_hoja, 0), 2)            AS hojas_restante,
  iv.m2_hoja                                                     AS m2_por_hoja,
  iv.m2_disponible,
  iv.m2_total_inicial,
  iv.es_preferido,
  CASE WHEN iv.m2_total_inicial > 0
    THEN ROUND((1.0 - iv.m2_disponible / iv.m2_total_inicial) * 100, 2)
    ELSE 0
  END                                                            AS pct_usado,
  CASE
    WHEN iv.m2_disponible <= 0                                   THEN 'SIN_STOCK'
    WHEN iv.m2_disponible < iv.m2_total_inicial * 0.20           THEN 'STOCK_BAJO'
    ELSE 'OK'
  END                                                            AS alerta_stock
FROM inventario_vidrio iv
JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = iv.id_tipo_vidrio;

-- 6. Actualizar SP de registro para guardar m2_hoja y hojas_entrada al crear un lote
DROP FUNCTION IF EXISTS sp_registrar_inventario_vidrio(INTEGER, NUMERIC, NUMERIC, INTEGER);
CREATE OR REPLACE FUNCTION sp_registrar_inventario_vidrio(
  p_id_tipo_vidrio INTEGER,
  p_largo_cm       NUMERIC,
  p_ancho_cm       NUMERIC,
  p_cantidad_hojas INTEGER
)
RETURNS TABLE (p_id_inventario INTEGER, p_m2_total NUMERIC, p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_m2_hoja  NUMERIC;
  v_m2_total NUMERIC;
  v_id_inv   INTEGER;
BEGIN
  v_m2_hoja  := ROUND((p_largo_cm * p_ancho_cm) / 10000.0, 4);
  v_m2_total := ROUND(v_m2_hoja * p_cantidad_hojas, 4);

  INSERT INTO inventario_vidrio
    (id_tipo_vidrio, largo_cm, ancho_cm, cantidad_hojas, hojas_entrada, m2_hoja,
     m2_disponible, m2_total_inicial)
  VALUES
    (p_id_tipo_vidrio, p_largo_cm, p_ancho_cm, p_cantidad_hojas, 0, v_m2_hoja,
     v_m2_total, v_m2_total)
  RETURNING id_inventario INTO v_id_inv;

  INSERT INTO movimiento_inventario_vidrio
    (id_inventario, tipo_movimiento, m2_cantidad, m2_saldo_resultante, nota)
  VALUES
    (v_id_inv, 'ENTRADA', v_m2_total, v_m2_total,
     'Registro inicial: ' || p_cantidad_hojas || ' hojas');

  RETURN QUERY SELECT v_id_inv, v_m2_total, 'OK'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION sp_registrar_inventario_vidrio(INTEGER, NUMERIC, NUMERIC, INTEGER) TO anon, authenticated;
