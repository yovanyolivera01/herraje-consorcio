-- Populate partida.metros2_pieza (046) going forward in the two SPs that
-- insert/copy VIDRIO (and MAQUILA) partida rows outside partidaCotizacion.js:
-- sp_crear_pedido_directo (venta directa, sin cotización) and
-- sp_convertir_cotizacion_a_pedido (copia filas existentes, que ya tienen
-- metros2_pieza desde 046 — basta copiarlo via p.*).
-- IN PRODUCTION

CREATE OR REPLACE FUNCTION public.sp_crear_pedido_directo(p_id_cliente integer, p_id_nivel_precio integer, p_tipo_pago text, p_monto_anticipo numeric, p_partidas jsonb, p_maquilas jsonb DEFAULT '[]'::jsonb)
 RETURNS TABLE(out_id_pedido integer, out_folio text, out_mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_id_pedido  INT;
  v_folio      TEXT;
  v_saldo      NUMERIC;
  v_total      NUMERIC := 0;
  v_piezas_maq NUMERIC := 0;
  v_piezas_vid NUMERIC := 0;
  v_partida    JSONB;
  v_maquila    JSONB;
  v_proceso    JSONB;
  v_id_partida INT;
  v_id_maquila INT;
BEGIN
  FOR v_partida IN SELECT * FROM jsonb_array_elements(p_partidas) LOOP
    v_total := v_total + (v_partida->>'subtotal_partida')::NUMERIC;
    v_piezas_vid := v_piezas_vid + COALESCE((v_partida->>'piezas')::NUMERIC, 0);
  END LOOP;

  FOR v_maquila IN SELECT * FROM jsonb_array_elements(p_maquilas) LOOP
    v_total := v_total + (v_maquila->>'subtotal_partida')::NUMERIC;
    v_piezas_maq := v_piezas_maq + COALESCE((v_maquila->>'cantidad')::NUMERIC, 0);
  END LOOP;

  v_saldo := CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 0
                  ELSE v_total - p_monto_anticipo END;

  INSERT INTO pedido (
    folio, tipo_pedido, fecha_creacion,
    id_cliente, id_nivel_precio, id_cotizacion,
    total, tipo_pago, monto_anticipo, saldo_pendiente,
    estatus, fecha_entrega, piezas_maquila_recibidas, piezas_vidrio_vendidas
  ) VALUES (
    'PED-00000',
    CASE WHEN jsonb_array_length(p_partidas) > 0 THEN 'VIDRIO' ELSE 'MAQUILA' END,
    NOW(),
    p_id_cliente, p_id_nivel_precio, NULL,
    v_total, p_tipo_pago::tipo_pago_t, p_monto_anticipo, v_saldo,
    (CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END)::estatus_pedido_t,
    CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END,
    v_piezas_maq, v_piezas_vid
  ) RETURNING id_pedido INTO v_id_pedido;

  v_folio := 'PED-' || LPAD(v_id_pedido::TEXT, 5, '0');
  UPDATE pedido SET folio = v_folio WHERE id_pedido = v_id_pedido;

  FOR v_partida IN SELECT * FROM jsonb_array_elements(p_partidas) LOOP
    INSERT INTO partida (
      id_pedido, tipo, largo_cm, ancho_cm, cantidad,
      metros2, metros2_pieza, subtotal_procesos, precio_unitario, subtotal,
      estatus_entrega, fecha_entrega_real
    ) VALUES (
      v_id_pedido, 'VIDRIO',
      (v_partida->>'largo_cm')::NUMERIC,
      (v_partida->>'ancho_cm')::NUMERIC,
      (v_partida->>'piezas')::NUMERIC,
      (v_partida->>'metros2')::NUMERIC,
      ROUND((v_partida->>'metros2')::NUMERIC / NULLIF((v_partida->>'piezas')::NUMERIC, 0), 4),
      (v_partida->>'subtotal_procesos')::NUMERIC,
      ROUND((v_partida->>'subtotal_partida')::NUMERIC / NULLIF((v_partida->>'piezas')::NUMERIC, 0), 2),
      (v_partida->>'subtotal_partida')::NUMERIC,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END
    ) RETURNING id_partida INTO v_id_partida;

    INSERT INTO partida_vidrio (id_partida, id_tipo_vidrio, precio_m2, es_hoja_completa, subtotal_vidrio, precio_vidrio)
    VALUES (
      v_id_partida,
      (v_partida->>'id_tipo_vidrio')::INT,
      (v_partida->>'precio_m2_aplicado')::NUMERIC,
      COALESCE((v_partida->>'es_hoja_completa')::BOOLEAN, FALSE),
      (v_partida->>'subtotal_vidrio')::NUMERIC,
      ROUND((v_partida->>'subtotal_vidrio')::NUMERIC / NULLIF((v_partida->>'piezas')::NUMERIC, 0), 2)
    );

    IF jsonb_array_length(COALESCE(v_partida->'procesos', '[]'::JSONB)) > 0 THEN
      FOR v_proceso IN SELECT * FROM jsonb_array_elements(v_partida->'procesos') LOOP
        INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal, sides, precio_por_pieza)
        VALUES (
          v_id_partida,
          (v_proceso->>'id_proceso')::INT,
          (v_proceso->>'id_unidad_cobro')::INT,
          (v_proceso->>'cantidad')::NUMERIC,
          (v_proceso->>'precio_unitario')::NUMERIC,
          (v_proceso->>'subtotal')::NUMERIC,
          v_proceso->'sidesML',
          ROUND((v_proceso->>'subtotal')::NUMERIC / NULLIF((v_partida->>'piezas')::NUMERIC, 0), 2)
        );
      END LOOP;
    END IF;
  END LOOP;

  FOR v_maquila IN SELECT * FROM jsonb_array_elements(p_maquilas) LOOP
    INSERT INTO partida (
      id_pedido, tipo, descripcion, largo_cm, ancho_cm, cantidad,
      metros2, metros2_pieza, subtotal_procesos, precio_unitario, subtotal,
      estatus_entrega, fecha_entrega_real, observaciones, id_espesor
    ) VALUES (
      v_id_pedido, 'MAQUILA',
      NULLIF(v_maquila->>'descripcion', ''),
      (v_maquila->>'largo_cm')::NUMERIC,
      (v_maquila->>'ancho_cm')::NUMERIC,
      (v_maquila->>'cantidad')::NUMERIC,
      (v_maquila->>'metros2')::NUMERIC,
      ROUND((v_maquila->>'metros2')::NUMERIC / NULLIF((v_maquila->>'cantidad')::NUMERIC, 0), 4),
      (v_maquila->>'subtotal_partida')::NUMERIC,
      ROUND((v_maquila->>'subtotal_partida')::NUMERIC / NULLIF((v_maquila->>'cantidad')::NUMERIC, 0), 2),
      (v_maquila->>'subtotal_partida')::NUMERIC,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END,
      NULLIF(v_maquila->>'observaciones', ''),
      (v_maquila->>'id_espesor')::INT
    ) RETURNING id_partida INTO v_id_maquila;

    IF jsonb_array_length(COALESCE(v_maquila->'procesos', '[]'::JSONB)) > 0 THEN
      FOR v_proceso IN SELECT * FROM jsonb_array_elements(v_maquila->'procesos') LOOP
        INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal, sides, precio_por_pieza)
        VALUES (
          v_id_maquila,
          (v_proceso->>'id_proceso')::INT,
          (v_proceso->>'id_unidad_cobro')::INT,
          (v_proceso->>'cantidad')::NUMERIC,
          (v_proceso->>'precio_unitario')::NUMERIC,
          (v_proceso->>'subtotal')::NUMERIC,
          v_proceso->'sidesML',
          ROUND((v_proceso->>'subtotal')::NUMERIC / NULLIF((v_maquila->>'cantidad')::NUMERIC, 0), 2)
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_id_pedido, v_folio, 'OK'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::INT, NULL::TEXT, ('ERROR: ' || SQLERRM)::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sp_convertir_cotizacion_a_pedido(p_id_cotizacion integer, p_tipo_pago text, p_monto_anticipo numeric)
 RETURNS TABLE(out_id_pedido integer, out_folio text, out_mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_cot          cotizacion%ROWTYPE;
  v_id_pedido    INT;
  v_folio        TEXT;
  v_saldo        NUMERIC;
  v_piezas_maq   NUMERIC;
  v_piezas_vid   NUMERIC;
  v_partida      RECORD;
  v_maquila      RECORD;
  v_proc_row     RECORD;
  v_id_pp        INT;
  v_id_maq       INT;
BEGIN
  SELECT * INTO v_cot FROM cotizacion WHERE id_cotizacion = p_id_cotizacion;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::INT, NULL::TEXT, 'ERROR: cotización no encontrada'::TEXT;
    RETURN;
  END IF;

  v_saldo := CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 0
                  ELSE v_cot.total - COALESCE(p_monto_anticipo, 0) END;

  SELECT COALESCE(SUM(cantidad), 0) INTO v_piezas_maq
  FROM partida WHERE id_cotizacion = p_id_cotizacion AND tipo = 'MAQUILA';

  SELECT COALESCE(SUM(cantidad), 0) INTO v_piezas_vid
  FROM partida WHERE id_cotizacion = p_id_cotizacion AND tipo = 'VIDRIO';

  INSERT INTO pedido (
    folio, tipo_pedido, id_cliente, id_cotizacion, id_nivel_precio,
    total, tipo_pago, monto_anticipo, saldo_pendiente,
    estatus, fecha_creacion, fecha_entrega, piezas_maquila_recibidas, piezas_vidrio_vendidas
  ) VALUES (
    'PED-00000', 'VIDRIO', v_cot.id_cliente, p_id_cotizacion, v_cot.id_nivel_precio,
    v_cot.total, p_tipo_pago::tipo_pago_t, COALESCE(p_monto_anticipo, 0), v_saldo,
    (CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END)::estatus_pedido_t,
    NOW(),
    CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END,
    v_piezas_maq, v_piezas_vid
  ) RETURNING id_pedido INTO v_id_pedido;

  v_folio := 'PED-' || LPAD(v_id_pedido::TEXT, 5, '0');
  UPDATE pedido SET folio = v_folio WHERE id_pedido = v_id_pedido;

  FOR v_partida IN
    SELECT p.*, pv.id_tipo_vidrio, pv.precio_m2, pv.es_hoja_completa, pv.subtotal_vidrio, pv.precio_vidrio
    FROM partida p
    JOIN partida_vidrio pv ON pv.id_partida = p.id_partida
    WHERE p.id_cotizacion = p_id_cotizacion AND p.tipo = 'VIDRIO'
  LOOP
    INSERT INTO partida (
      id_pedido, tipo, largo_cm, ancho_cm, cantidad,
      metros2, metros2_pieza, subtotal_procesos, precio_unitario, subtotal,
      estatus_entrega, fecha_entrega_real, observaciones
    ) VALUES (
      v_id_pedido, 'VIDRIO', v_partida.largo_cm, v_partida.ancho_cm,
      COALESCE(v_partida.cantidad, 1),
      v_partida.metros2, v_partida.metros2_pieza, v_partida.subtotal_procesos, v_partida.precio_unitario, v_partida.subtotal,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END,
      v_partida.observaciones
    ) RETURNING id_partida INTO v_id_pp;

    INSERT INTO partida_vidrio (id_partida, id_tipo_vidrio, precio_m2, es_hoja_completa, subtotal_vidrio, precio_vidrio)
    VALUES (v_id_pp, v_partida.id_tipo_vidrio, v_partida.precio_m2, v_partida.es_hoja_completa, v_partida.subtotal_vidrio, v_partida.precio_vidrio);

    FOR v_proc_row IN
      SELECT cantidad, precio_unitario, subtotal, id_proceso, id_unidad_cobro, sides, precio_por_pieza
      FROM partida_proceso
      WHERE id_partida = v_partida.id_partida
    LOOP
      INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal, sides, precio_por_pieza)
      VALUES (v_id_pp, v_proc_row.id_proceso, v_proc_row.id_unidad_cobro, v_proc_row.cantidad, v_proc_row.precio_unitario, v_proc_row.subtotal, v_proc_row.sides, v_proc_row.precio_por_pieza);
    END LOOP;
  END LOOP;

  FOR v_maquila IN
    SELECT *
    FROM partida
    WHERE id_cotizacion = p_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL
  LOOP
    INSERT INTO partida (
      id_pedido, tipo, descripcion, largo_cm, ancho_cm, cantidad,
      metros2, metros2_pieza, subtotal_procesos, precio_unitario, subtotal,
      estatus_entrega, fecha_entrega_real, observaciones, id_espesor
    ) VALUES (
      v_id_pedido, 'MAQUILA', v_maquila.descripcion, v_maquila.largo_cm, v_maquila.ancho_cm,
      COALESCE(v_maquila.cantidad, 1),
      v_maquila.metros2, v_maquila.metros2_pieza, v_maquila.subtotal_procesos, v_maquila.precio_unitario, v_maquila.subtotal,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END,
      v_maquila.observaciones, v_maquila.id_espesor
    ) RETURNING id_partida INTO v_id_maq;

    FOR v_proc_row IN
      SELECT cantidad, precio_unitario, subtotal, id_proceso, id_unidad_cobro, sides, precio_por_pieza
      FROM partida_proceso
      WHERE id_partida = v_maquila.id_partida
    LOOP
      INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal, sides, precio_por_pieza)
      VALUES (v_id_maq, v_proc_row.id_proceso, v_proc_row.id_unidad_cobro, v_proc_row.cantidad, v_proc_row.precio_unitario, v_proc_row.subtotal, v_proc_row.sides, v_proc_row.precio_por_pieza);
    END LOOP;
  END LOOP;

  INSERT INTO partida (
    id_pedido, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones
  )
  SELECT
    v_id_pedido, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones
  FROM partida
  WHERE id_cotizacion = p_id_cotizacion
    AND tipo IN ('MAQUILA','PRODUCTO','EXTRA')
    AND largo_cm IS NULL;

  UPDATE cotizacion SET estatus = 'CONVERTIDA' WHERE id_cotizacion = p_id_cotizacion;

  RETURN QUERY SELECT v_id_pedido, v_folio, 'OK'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::INT, NULL::TEXT, ('ERROR: ' || SQLERRM)::TEXT;
END;
$function$;
