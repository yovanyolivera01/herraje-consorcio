-- ================================================================
-- Decremento automático de inventario al convertir cotización
-- Ejecutar en: Supabase → SQL Editor → Run
-- ================================================================

-- Descuenta m2_disponible en inventario_vidrio para cada partida
-- de la cotización indicada y registra un movimiento SALIDA.
-- Se llama desde la app justo después de sp_convertir_cotizacion_a_pedido.

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
    -- Tomar el lote con más m² disponibles para ese tipo
    SELECT id_inventario, m2_disponible
    INTO   v_id_inv, v_saldo
    FROM   inventario_vidrio
    WHERE  id_tipo_vidrio = v_partida.id_tipo_vidrio
    ORDER  BY m2_disponible DESC
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
      v_id_inv,
      'SALIDA',
      v_partida.total_m2,
      v_saldo,
      'Venta ' || COALESCE(NULLIF(p_folio_pedido, ''), 'cot-' || p_id_cotizacion::TEXT)
    );
  END LOOP;

  RETURN QUERY SELECT 'OK'::TEXT;
END;
$$;

-- RLS para la función (heredada de SECURITY DEFINER, pero asegurar acceso)
GRANT EXECUTE ON FUNCTION sp_decrementar_inventario_vidrio(INTEGER, TEXT) TO anon, authenticated;
