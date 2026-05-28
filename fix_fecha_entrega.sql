-- ================================================================
-- FIX: Reportes no muestran registros del día
-- Causa: los SPs que crean pedidos LIQUIDADO directamente como
--        ENTREGADO no establecen fecha_entrega, por lo que las
--        consultas filtradas por fecha_entrega no los encuentran.
--
-- Ejecutar completo en Supabase → SQL Editor → Run
-- ================================================================

-- ── 1. Backfill: arreglar pedidos ENTREGADO sin fecha_entrega ─────
--    Usa fecha_creacion como referencia (la más cercana a la entrega).

UPDATE pedido
SET fecha_entrega = COALESCE(fecha_creacion, NOW())
WHERE estatus = 'ENTREGADO'
  AND fecha_entrega IS NULL;

-- ── 2. SP: Historial de ventas (VIDRIO) ───────────────────────────
--    COALESCE(fecha_entrega, fecha_creacion) para tolerar registros
--    anteriores que aún no tengan fecha_entrega.

DROP FUNCTION IF EXISTS sp_obtener_historial_ventas(DATE, DATE);
DROP FUNCTION IF EXISTS sp_obtener_historial_ventas(TEXT, TEXT);

CREATE FUNCTION sp_obtener_historial_ventas(
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin    DATE DEFAULT NULL
)
RETURNS TABLE (
  id_pedido             INTEGER,
  folio                 TEXT,
  fecha_creacion        TIMESTAMPTZ,
  fecha_entrega         TIMESTAMPTZ,
  cliente               TEXT,
  nivel_precio          TEXT,
  tipo_pago             TEXT,
  monto_anticipo        NUMERIC,
  monto_cobrado_entrega NUMERIC,
  total                 NUMERIC,
  total_cobrado         NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id_pedido,
    p.folio::TEXT,
    p.fecha_creacion,
    p.fecha_entrega,
    COALESCE(c.nombre, 'Mostrador')::TEXT                                  AS cliente,
    COALESCE(np.nombre, '')::TEXT                                          AS nivel_precio,
    p.tipo_pago::TEXT,
    COALESCE(p.monto_anticipo, 0),
    p.monto_cobrado_entrega,
    p.total,
    COALESCE(p.monto_anticipo, 0) + COALESCE(p.monto_cobrado_entrega, 0) AS total_cobrado
  FROM pedido p
  LEFT JOIN cliente c       ON c.id_cliente       = p.id_cliente
  LEFT JOIN nivel_precio np ON np.id_nivel_precio = p.id_nivel_precio
  WHERE p.tipo_pedido = 'VIDRIO'
    AND p.estatus     = 'ENTREGADO'
    AND (p_fecha_inicio IS NULL
         OR COALESCE(p.fecha_entrega, p.fecha_creacion)::DATE >= p_fecha_inicio)
    AND (p_fecha_fin   IS NULL
         OR COALESCE(p.fecha_entrega, p.fecha_creacion)::DATE <= p_fecha_fin)
  ORDER BY COALESCE(p.fecha_entrega, p.fecha_creacion) DESC NULLS LAST;
END;
$$;

-- ── 3. SP: Convertir cotización VIDRIO a pedido ───────────────────
--    LIQUIDADO → estatus=ENTREGADO + fecha_entrega=NOW()

DROP FUNCTION IF EXISTS sp_convertir_cotizacion_a_pedido(INTEGER, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS sp_convertir_cotizacion_a_pedido(INTEGER, TEXT, NUMERIC, TEXT);

CREATE FUNCTION sp_convertir_cotizacion_a_pedido(
  p_id_cotizacion  INTEGER,
  p_tipo_pago      TEXT,
  p_monto_anticipo NUMERIC
)
RETURNS TABLE(out_id_pedido INT, out_folio TEXT, out_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cot        cotizacion%ROWTYPE;
  v_id_pedido  INT;
  v_folio      TEXT;
  v_saldo      NUMERIC;
  v_partida    partida_cotizacion%ROWTYPE;
  v_id_pp      INT;
BEGIN
  SELECT * INTO v_cot FROM cotizacion WHERE id_cotizacion = p_id_cotizacion;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::INT, NULL::TEXT, 'ERROR: cotización no encontrada'::TEXT;
    RETURN;
  END IF;

  v_saldo := CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 0
                  ELSE v_cot.total - COALESCE(p_monto_anticipo, 0) END;

  INSERT INTO pedido (
    folio, tipo_pedido, id_cliente, id_cotizacion, id_nivel_precio,
    total, tipo_pago, monto_anticipo, saldo_pendiente,
    estatus, fecha_creacion, fecha_entrega
  ) VALUES (
    'PED-00000', 'VIDRIO', v_cot.id_cliente, p_id_cotizacion, v_cot.id_nivel_precio,
    v_cot.total, p_tipo_pago::tipo_pago_t, COALESCE(p_monto_anticipo, 0), v_saldo,
    (CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END)::estatus_pedido_t,
    NOW(),
    CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END
  ) RETURNING id_pedido INTO v_id_pedido;

  v_folio := 'PED-' || LPAD(v_id_pedido::TEXT, 5, '0');
  UPDATE pedido SET folio = v_folio WHERE id_pedido = v_id_pedido;

  -- Copiar partidas de cotización → pedido
  FOR v_partida IN
    SELECT * FROM partida_cotizacion WHERE id_cotizacion = p_id_cotizacion
  LOOP
    INSERT INTO partida_pedido (
      id_pedido, id_tipo_vidrio, largo_cm, ancho_cm, cantidad,
      metros_cuadrados, precio_m2, subtotal_vidrio, subtotal_procesos, total_partida,
      estatus_entrega, fecha_entrega_real
    ) VALUES (
      v_id_pedido, v_partida.id_tipo_vidrio, v_partida.largo_cm, v_partida.ancho_cm,
      COALESCE(v_partida.piezas, 1),
      v_partida.metros2, v_partida.precio_m2_aplicado,
      v_partida.subtotal_vidrio, v_partida.subtotal_procesos, v_partida.subtotal_partida,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END
    ) RETURNING id_partida_pedido INTO v_id_pp;

    -- Procesos snapshot
    INSERT INTO partida_proceso_pedido
      (id_partida_pedido, id_proceso, id_unidad_cobro, cantidad_unidades, precio_unitario, subtotal)
    SELECT v_id_pp, pp.id_proceso, pp.id_unidad_cobro, pp.cantidad, pp.precio_unitario, pp.subtotal
    FROM partida_proceso pp
    WHERE pp.id_partida = v_partida.id_partida;
  END LOOP;

  UPDATE cotizacion SET estatus = 'CONVERTIDA' WHERE id_cotizacion = p_id_cotizacion;

  RETURN QUERY SELECT v_id_pedido, v_folio, 'OK'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::INT, NULL::TEXT, ('ERROR: ' || SQLERRM)::TEXT;
END;
$$;

-- ── 4. SP: Crear pedido directo (herraje / venta sin cotización) ───
--    Corrige: fecha_creacion (nombre real de la columna) y
--             fecha_entrega=NOW() para LIQUIDADO.

DROP FUNCTION IF EXISTS sp_crear_pedido_directo(INT, INT, TEXT, NUMERIC, JSONB);
DROP FUNCTION IF EXISTS sp_crear_pedido_directo(INTEGER, INTEGER, TEXT, NUMERIC, JSONB);
DROP FUNCTION IF EXISTS sp_crear_pedido_directo(INT, INT, TEXT, NUMERIC, JSONB, TEXT);
DROP FUNCTION IF EXISTS sp_crear_pedido_directo(INTEGER, INTEGER, TEXT, NUMERIC, JSONB, TEXT);

CREATE FUNCTION sp_crear_pedido_directo(
  p_id_cliente      INT,
  p_id_nivel_precio INT,
  p_tipo_pago       TEXT,
  p_monto_anticipo  NUMERIC,
  p_partidas        JSONB
)
RETURNS TABLE(out_id_pedido INT, out_folio TEXT, out_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id_pedido  INT;
  v_folio      TEXT;
  v_saldo      NUMERIC;
  v_total      NUMERIC := 0;
  v_partida    JSONB;
  v_proceso    JSONB;
  v_id_partida INT;
BEGIN
  -- Sumar total de partidas
  FOR v_partida IN SELECT * FROM jsonb_array_elements(p_partidas) LOOP
    v_total := v_total + (v_partida->>'subtotal_partida')::NUMERIC;
  END LOOP;

  v_saldo := CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 0
                  ELSE v_total - p_monto_anticipo END;

  INSERT INTO pedido (
    folio, tipo_pedido, fecha_creacion,
    id_cliente, id_nivel_precio, id_cotizacion,
    total, tipo_pago, monto_anticipo, saldo_pendiente,
    estatus, fecha_entrega
  ) VALUES (
    'PED-00000', 'VIDRIO', NOW(),
    p_id_cliente, p_id_nivel_precio, NULL,
    v_total, p_tipo_pago::tipo_pago_t, p_monto_anticipo, v_saldo,
    (CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END)::estatus_pedido_t,
    CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END
  ) RETURNING id_pedido INTO v_id_pedido;

  v_folio := 'PED-' || LPAD(v_id_pedido::TEXT, 5, '0');
  UPDATE pedido SET folio = v_folio WHERE id_pedido = v_id_pedido;

  FOR v_partida IN SELECT * FROM jsonb_array_elements(p_partidas) LOOP
    INSERT INTO partida_pedido (
      id_pedido, id_tipo_vidrio, largo_cm, ancho_cm, cantidad,
      metros_cuadrados, precio_m2, subtotal_vidrio, subtotal_procesos, total_partida,
      estatus_entrega, fecha_entrega_real
    ) VALUES (
      v_id_pedido,
      (v_partida->>'id_tipo_vidrio')::INT,
      (v_partida->>'largo_cm')::NUMERIC,
      (v_partida->>'ancho_cm')::NUMERIC,
      (v_partida->>'piezas')::INT,
      (v_partida->>'metros2')::NUMERIC,
      (v_partida->>'precio_m2_aplicado')::NUMERIC,
      (v_partida->>'subtotal_vidrio')::NUMERIC,
      (v_partida->>'subtotal_procesos')::NUMERIC,
      (v_partida->>'subtotal_partida')::NUMERIC,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END
    ) RETURNING id_partida_pedido INTO v_id_partida;

    IF jsonb_array_length(COALESCE(v_partida->'procesos', '[]'::JSONB)) > 0 THEN
      FOR v_proceso IN SELECT * FROM jsonb_array_elements(v_partida->'procesos') LOOP
        INSERT INTO partida_proceso_pedido (
          id_partida_pedido, id_proceso, id_unidad_cobro,
          cantidad_unidades, precio_unitario, subtotal
        ) VALUES (
          v_id_partida,
          (v_proceso->>'id_proceso')::INT,
          (v_proceso->>'id_unidad_cobro')::INT,
          (v_proceso->>'cantidad')::NUMERIC,
          (v_proceso->>'precio_unitario')::NUMERIC,
          (v_proceso->>'subtotal')::NUMERIC
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_id_pedido, v_folio, 'OK'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::INT, NULL::TEXT, ('ERROR: ' || SQLERRM)::TEXT;
END;
$$;

-- ── 5. SP: Exportar a Excel (ventas VIDRIO) ───────────────────────

DROP FUNCTION IF EXISTS sp_exportar_excel_ventas(DATE, DATE);
DROP FUNCTION IF EXISTS sp_exportar_excel_ventas(TEXT, TEXT);

CREATE FUNCTION sp_exportar_excel_ventas(
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin    DATE DEFAULT NULL
)
RETURNS TABLE (
  "Folio"              TEXT,
  "Fecha entrega"      TEXT,
  "Cliente"            TEXT,
  "Forma de pago"      TEXT,
  "Total pedido"       NUMERIC,
  "Anticipo"           NUMERIC,
  "Cobrado entrega"    NUMERIC,
  "Total cobrado"      NUMERIC,
  "Observaciones"      TEXT,
  "Tipo vidrio"        TEXT,
  "Largo (cm)"         NUMERIC,
  "Ancho (cm)"         NUMERIC,
  "m2"                 NUMERIC,
  "Cantidad"           INTEGER,
  "Precio m2"          NUMERIC,
  "Subtotal vidrio"    NUMERIC,
  "Subtotal procesos"  NUMERIC,
  "Total partida"      NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.folio::TEXT,
    to_char(
      COALESCE(p.fecha_entrega, p.fecha_creacion) AT TIME ZONE 'America/Mexico_City',
      'DD/MM/YYYY'
    ),
    COALESCE(c.nombre, 'Mostrador')::TEXT,
    p.tipo_pago::TEXT,
    p.total,
    COALESCE(p.monto_anticipo, 0),
    COALESCE(p.monto_cobrado_entrega, 0),
    COALESCE(p.monto_anticipo, 0) + COALESCE(p.monto_cobrado_entrega, 0),
    ''::TEXT,
    COALESCE(tv.clave, '—')::TEXT,
    pp.largo_cm,
    pp.ancho_cm,
    pp.metros_cuadrados,
    pp.cantidad,
    pp.precio_m2,
    pp.subtotal_vidrio,
    pp.subtotal_procesos,
    pp.total_partida
  FROM pedido p
  LEFT JOIN cliente c         ON c.id_cliente       = p.id_cliente
  LEFT JOIN partida_pedido pp ON pp.id_pedido        = p.id_pedido
  LEFT JOIN tipo_vidrio tv    ON tv.id_tipo_vidrio   = pp.id_tipo_vidrio
  WHERE p.tipo_pedido = 'VIDRIO'
    AND p.estatus     = 'ENTREGADO'
    AND (p_fecha_inicio IS NULL
         OR COALESCE(p.fecha_entrega, p.fecha_creacion)::DATE >= p_fecha_inicio)
    AND (p_fecha_fin   IS NULL
         OR COALESCE(p.fecha_entrega, p.fecha_creacion)::DATE <= p_fecha_fin)
  ORDER BY COALESCE(p.fecha_entrega, p.fecha_creacion) DESC NULLS LAST, pp.id_partida_pedido;
END;
$$;

-- ── Verificación: ejecuta esto para confirmar el backfill ─────────
--
-- SELECT COUNT(*) AS total_entregados,
--        SUM(CASE WHEN fecha_entrega IS NULL THEN 1 ELSE 0 END) AS sin_fecha
-- FROM pedido WHERE estatus = 'ENTREGADO';
--
-- Debe devolver sin_fecha = 0 después de ejecutar este script.
