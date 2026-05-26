-- ================================================================
-- Lote preferido para descuento de inventario
-- Ejecutar en: Supabase → SQL Editor → Run
-- ================================================================

-- 1. Agregar columna es_preferido
ALTER TABLE inventario_vidrio
  ADD COLUMN IF NOT EXISTS es_preferido BOOLEAN NOT NULL DEFAULT false;

-- 2. Actualizar la vista para incluirla (DROP + CREATE por cambio de columnas)
DROP VIEW IF EXISTS v_inventario_vidrio;
CREATE VIEW v_inventario_vidrio AS
SELECT
  iv.id_inventario,
  tv.clave                                                  AS tipo_vidrio,
  (iv.largo_cm || 'x' || iv.ancho_cm || ' cm')             AS medidas,
  iv.id_tipo_vidrio,
  iv.cantidad_hojas,
  iv.m2_por_hoja,
  iv.m2_disponible,
  iv.m2_total_inicial,
  iv.es_preferido,
  CASE WHEN iv.m2_total_inicial > 0
    THEN ROUND((1.0 - iv.m2_disponible / iv.m2_total_inicial) * 100, 2)
    ELSE 0
  END                                                       AS pct_usado,
  CASE
    WHEN iv.m2_disponible <= 0                                THEN 'SIN_STOCK'
    WHEN iv.m2_disponible < iv.m2_total_inicial * 0.20        THEN 'STOCK_BAJO'
    ELSE 'OK'
  END                                                       AS alerta_stock
FROM inventario_vidrio iv
JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = iv.id_tipo_vidrio;

-- 3. Actualizar SP de decremento para respetar lote preferido
CREATE OR REPLACE FUNCTION sp_decrementar_inventario_vidrio(
  p_id_cotizacion INTEGER,
  p_folio_pedido  TEXT DEFAULT ''
)
RETURNS TABLE (p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_partida RECORD;
  v_id_inv  INTEGER;
  v_saldo   NUMERIC;
BEGIN
  FOR v_partida IN
    SELECT id_tipo_vidrio,
           SUM(metros2) AS total_m2
    FROM   partida_cotizacion
    WHERE  id_cotizacion = p_id_cotizacion
    GROUP  BY id_tipo_vidrio
  LOOP
    -- Preferir el lote marcado como preferido; si no hay, el de mayor m² disponible
    SELECT id_inventario, m2_disponible
    INTO   v_id_inv, v_saldo
    FROM   inventario_vidrio
    WHERE  id_tipo_vidrio = v_partida.id_tipo_vidrio
    ORDER  BY es_preferido DESC, m2_disponible DESC
    LIMIT  1;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_saldo := GREATEST(v_saldo - v_partida.total_m2, 0);

    UPDATE inventario_vidrio
    SET    m2_disponible = v_saldo
    WHERE  id_inventario = v_id_inv;

    INSERT INTO movimiento_inventario_vidrio
      (id_inventario, tipo_movimiento, m2_cantidad, m2_saldo_resultante, nota)
    VALUES (
      v_id_inv, 'SALIDA', v_partida.total_m2, v_saldo,
      'Venta ' || COALESCE(NULLIF(p_folio_pedido, ''), 'cot-' || p_id_cotizacion::TEXT)
    );
  END LOOP;

  RETURN QUERY SELECT 'OK'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION sp_decrementar_inventario_vidrio(INTEGER, TEXT) TO anon, authenticated;
