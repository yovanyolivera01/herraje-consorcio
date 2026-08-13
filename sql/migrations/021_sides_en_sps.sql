-- sp_crear_pedido_directo: carry sidesML through into partida_proceso_pedido.sides
-- IN PRODUCTION

CREATE OR REPLACE FUNCTION public.sp_crear_pedido_directo(p_id_cliente integer, p_id_nivel_precio integer, p_tipo_pago text, p_monto_anticipo numeric, p_partidas jsonb)
 RETURNS TABLE(out_id_pedido integer, out_folio text, out_mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_id_pedido  INT;
  v_folio      TEXT;
  v_saldo      NUMERIC;
  v_total      NUMERIC := 0;
  v_partida    JSONB;
  v_proceso    JSONB;
  v_id_partida INT;
BEGIN
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
          cantidad_unidades, precio_unitario, subtotal, sides
        ) VALUES (
          v_id_partida,
          (v_proceso->>'id_proceso')::INT,
          (v_proceso->>'id_unidad_cobro')::INT,
          (v_proceso->>'cantidad')::NUMERIC,
          (v_proceso->>'precio_unitario')::NUMERIC,
          (v_proceso->>'subtotal')::NUMERIC,
          v_proceso->'sidesML'
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_id_pedido, v_folio, 'OK'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::INT, NULL::TEXT, ('ERROR: ' || SQLERRM)::TEXT;
END;
$function$;


-- sp_convertir_cotizacion_a_pedido: carry partida_proceso.sides through to partida_proceso_pedido.sides
CREATE OR REPLACE FUNCTION public.sp_convertir_cotizacion_a_pedido(p_id_cotizacion integer, p_tipo_pago text, p_monto_anticipo numeric)
 RETURNS TABLE(out_id_pedido integer, out_folio text, out_mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

  FOR v_partida IN
    SELECT * FROM partida_cotizacion WHERE id_cotizacion = p_id_cotizacion
  LOOP
    INSERT INTO partida_pedido (
      id_pedido, id_tipo_vidrio, largo_cm, ancho_cm, cantidad,
      metros_cuadrados, precio_m2, subtotal_vidrio, subtotal_procesos, total_partida,
      estatus_entrega, fecha_entrega_real, observaciones
    ) VALUES (
      v_id_pedido, v_partida.id_tipo_vidrio, v_partida.largo_cm, v_partida.ancho_cm,
      COALESCE(v_partida.piezas, 1),
      v_partida.metros2, v_partida.precio_m2_aplicado,
      v_partida.subtotal_vidrio, v_partida.subtotal_procesos, v_partida.subtotal_partida,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END,
      v_partida.observaciones
    ) RETURNING id_partida_pedido INTO v_id_pp;

    INSERT INTO partida_proceso_pedido
      (id_partida_pedido, id_proceso, id_unidad_cobro, cantidad_unidades, precio_unitario, subtotal, sides)
    SELECT v_id_pp, pp.id_proceso, pp.id_unidad_cobro, pp.cantidad, pp.precio_unitario, pp.subtotal, pp.sides
    FROM partida_proceso pp
    WHERE pp.id_partida = v_partida.id_partida;
  END LOOP;

  INSERT INTO partida_pedido_extra (
    id_pedido, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones
  )
  SELECT
    v_id_pedido, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones
  FROM partida_cotizacion_extra
  WHERE id_cotizacion = p_id_cotizacion;

  UPDATE cotizacion SET estatus = 'CONVERTIDA' WHERE id_cotizacion = p_id_cotizacion;

  RETURN QUERY SELECT v_id_pedido, v_folio, 'OK'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::INT, NULL::TEXT, ('ERROR: ' || SQLERRM)::TEXT;
END;
$function$;


-- sp_obtener_procesos_pedido: return sides too (return-columns change, needs drop first)
DROP FUNCTION IF EXISTS public.sp_obtener_procesos_pedido(integer);

CREATE OR REPLACE FUNCTION public.sp_obtener_procesos_pedido(p_id_pedido integer)
 RETURNS TABLE(id_partida_pedido integer, proceso text, unidad_cobro text, cantidad_unidades numeric, precio_unitario numeric, subtotal numeric, sides jsonb)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    ppp.id_partida_pedido,
    pr.nombre::TEXT        AS proceso,
    uc.nombre::TEXT        AS unidad_cobro,
    ppp.cantidad_unidades,
    ppp.precio_unitario,
    ppp.subtotal,
    ppp.sides
  FROM partida_proceso_pedido ppp
  LEFT JOIN proceso      pr ON pr.id_proceso      = ppp.id_proceso
  LEFT JOIN unidad_cobro uc ON uc.id_unidad_cobro = ppp.id_unidad_cobro
  WHERE ppp.id_partida_pedido IN (
    SELECT id_partida_pedido FROM partida_pedido WHERE id_pedido = p_id_pedido
  )
  ORDER BY ppp.id_partida_pedido, ppp.id_partida_proceso_pedido;
$function$;
