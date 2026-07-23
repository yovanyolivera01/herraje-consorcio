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

  -- Copiar partidas de cotización → pedido
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

    -- Procesos snapshot
    INSERT INTO partida_proceso_pedido
      (id_partida_pedido, id_proceso, id_unidad_cobro, cantidad_unidades, precio_unitario, subtotal)
    SELECT v_id_pp, pp.id_proceso, pp.id_unidad_cobro, pp.cantidad, pp.precio_unitario, pp.subtotal
    FROM partida_proceso pp
    WHERE pp.id_partida = v_partida.id_partida;
  END LOOP;

  -- Copiar extras (maquila / productos) de cotización → pedido
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
$function$
