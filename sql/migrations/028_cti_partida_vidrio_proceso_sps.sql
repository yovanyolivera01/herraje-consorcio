-- Updates every stored procedure that reads/writes tipo='VIDRIO' or
-- tipo='PROCESO' rows to match the class-table-inheritance split done
-- in 027 (id_tipo_vidrio/precio_m2/es_hoja_completa/subtotal_vidrio now
-- live in partida_vidrio; id_proceso/id_unidad_cobro/sides now live in
-- partida_proceso). Extras/maquila logic is untouched — those tipos
-- were not part of this split.
--
-- sp_convertir_cotizacion_a_pedido: fixed to also copy dimensioned
-- MAQUILA jobs (largo_cm IS NOT NULL) — real largo_cm/ancho_cm + their
-- own partida_proceso children — the same CTI way VIDRIO already is.
-- Previously it only copied flat extras (largo_cm IS NULL), so a real
-- maquila job attached to a cotización would silently vanish on
-- conversion to a pedido. v_piezas_maq also now counts both flat and
-- dimensioned maquila cantidad, not just the flat case.

-- p_maquilas: dimensioned MAQUILA jobs created in the SAME pedido-directo
-- call as the VIDRIO partidas (no cotización involved either way). Each
-- element mirrors a VIDRIO partida's own 'procesos' array shape, so a
-- MAQUILA job gets the same CTI treatment (largo_cm/ancho_cm/metros2 on
-- the parent row, real PROCESO child rows) instead of being flattened
-- into a text descripcion.
DROP FUNCTION IF EXISTS public.sp_crear_pedido_directo(integer, integer, text, numeric, jsonb);

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
      metros2, subtotal_procesos, precio_unitario, subtotal,
      estatus_entrega, fecha_entrega_real
    ) VALUES (
      v_id_pedido, 'VIDRIO',
      (v_partida->>'largo_cm')::NUMERIC,
      (v_partida->>'ancho_cm')::NUMERIC,
      (v_partida->>'piezas')::NUMERIC,
      (v_partida->>'metros2')::NUMERIC,
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
      metros2, subtotal_procesos, precio_unitario, subtotal,
      estatus_entrega, fecha_entrega_real, observaciones, id_espesor
    ) VALUES (
      v_id_pedido, 'MAQUILA',
      NULLIF(v_maquila->>'descripcion', ''),
      (v_maquila->>'largo_cm')::NUMERIC,
      (v_maquila->>'ancho_cm')::NUMERIC,
      (v_maquila->>'cantidad')::NUMERIC,
      (v_maquila->>'metros2')::NUMERIC,
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

  -- Cuenta piezas de maquila tanto de extras planos como de jobs
  -- dimensionados (antes solo contaba los planos).
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
      metros2, subtotal_procesos, precio_unitario, subtotal,
      estatus_entrega, fecha_entrega_real, observaciones
    ) VALUES (
      v_id_pedido, 'VIDRIO', v_partida.largo_cm, v_partida.ancho_cm,
      COALESCE(v_partida.cantidad, 1),
      v_partida.metros2, v_partida.subtotal_procesos, v_partida.precio_unitario, v_partida.subtotal,
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

  -- Jobs de maquila dimensionados — mismo tratamiento CTI que VIDRIO
  -- arriba, sin el satelite partida_vidrio (maquila no tiene).
  FOR v_maquila IN
    SELECT *
    FROM partida
    WHERE id_cotizacion = p_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL
  LOOP
    INSERT INTO partida (
      id_pedido, tipo, descripcion, largo_cm, ancho_cm, cantidad,
      metros2, subtotal_procesos, precio_unitario, subtotal,
      estatus_entrega, fecha_entrega_real, observaciones, id_espesor
    ) VALUES (
      v_id_pedido, 'MAQUILA', v_maquila.descripcion, v_maquila.largo_cm, v_maquila.ancho_cm,
      COALESCE(v_maquila.cantidad, 1),
      v_maquila.metros2, v_maquila.subtotal_procesos, v_maquila.precio_unitario, v_maquila.subtotal,
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

DROP FUNCTION IF EXISTS public.sp_obtener_partidas_pedido(integer);

CREATE OR REPLACE FUNCTION public.sp_obtener_partidas_pedido(p_id_pedido integer)
 RETURNS TABLE(id_partida_pedido integer, tipo_vidrio text, largo_cm numeric, ancho_cm numeric, cantidad integer, metros_cuadrados numeric, precio_m2 numeric, subtotal_vidrio numeric, precio_vidrio numeric, subtotal_procesos numeric, total_partida numeric, estatus_entrega text, fecha_entrega_real timestamp with time zone, observaciones text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    p.id_partida,
    tv.clave::TEXT           AS tipo_vidrio,
    p.largo_cm,
    p.ancho_cm,
    p.cantidad::INT          AS cantidad,
    p.metros2                AS metros_cuadrados,
    pv.precio_m2,
    pv.subtotal_vidrio,
    pv.precio_vidrio,
    p.subtotal_procesos,
    p.subtotal                AS total_partida,
    p.estatus_entrega::TEXT   AS estatus_entrega,
    p.fecha_entrega_real,
    p.observaciones::TEXT     AS observaciones
  FROM partida p
  JOIN partida_vidrio pv ON pv.id_partida = p.id_partida
  LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pv.id_tipo_vidrio
  WHERE p.id_pedido = p_id_pedido AND p.tipo = 'VIDRIO'
  ORDER BY p.id_partida;
$function$;

CREATE OR REPLACE FUNCTION public.sp_obtener_procesos_pedido(p_id_pedido integer)
 RETURNS TABLE(id_partida_pedido integer, proceso text, unidad_cobro text, cantidad_unidades numeric, precio_unitario numeric, subtotal numeric, sides jsonb)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    pp.id_partida           AS id_partida_pedido,
    pr.nombre::TEXT         AS proceso,
    uc.nombre::TEXT         AS unidad_cobro,
    pp.cantidad             AS cantidad_unidades,
    pp.precio_unitario,
    pp.subtotal,
    pp.sides
  FROM partida_proceso pp
  LEFT JOIN proceso      pr ON pr.id_proceso      = pp.id_proceso
  LEFT JOIN unidad_cobro uc ON uc.id_unidad_cobro = pp.id_unidad_cobro
  WHERE pp.id_partida IN (
      SELECT id_partida FROM partida WHERE id_pedido = p_id_pedido AND tipo = 'VIDRIO'
    )
  ORDER BY pp.id_partida, pp.id_partida_proceso;
$function$;

CREATE OR REPLACE FUNCTION public.sp_decrementar_inventario_vidrio(p_id_cotizacion integer, p_folio_pedido text DEFAULT ''::text)
 RETURNS TABLE(p_mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_partida RECORD;
  v_id_inv  INTEGER;
  v_saldo   NUMERIC;
BEGIN
  FOR v_partida IN
    SELECT pv.id_tipo_vidrio,
           SUM(p.metros2) AS total_m2
    FROM   partida p
    JOIN   partida_vidrio pv ON pv.id_partida = p.id_partida
    WHERE  p.id_cotizacion = p_id_cotizacion AND p.tipo = 'VIDRIO'
    GROUP  BY pv.id_tipo_vidrio
  LOOP
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
$function$;

  CREATE OR REPLACE FUNCTION public.sp_exportar_excel_ventas(p_fecha_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone, p_fecha_fin timestamp with time zone DEFAULT NULL::timestamp with time zone)
  RETURNS TABLE("Folio" text, "Fecha entrega" text, "Cliente" text, "Forma de pago" text, "Total pedido" numeric, "Anticipo" numeric, "Cobrado entrega" numeric, "Total cobrado" numeric, "Observaciones" text, "Tipo vidrio" text, "Largo (cm)" numeric, "Ancho (cm)" numeric, m2 numeric, "Cantidad" integer, "Precio m2" numeric, "Subtotal vidrio" numeric, "Subtotal procesos" numeric, "Total partida" numeric)
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
  BEGIN
    RETURN QUERY
    SELECT
      p.folio::TEXT,
      to_char(COALESCE(p.fecha_entrega, p.fecha_creacion) AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY'),
      COALESCE(c.nombre, 'Mostrador')::TEXT,
      p.tipo_pago::TEXT,
      p.total,
      COALESCE(p.monto_anticipo, 0),
      COALESCE(p.monto_cobrado_entrega, 0),
      COALESCE(p.monto_anticipo, 0) + COALESCE(p.monto_cobrado_entrega, 0),
      ''::TEXT,
      COALESCE(tv.clave, '—')::TEXT,
      pp.largo_cm, pp.ancho_cm, pp.metros2, pp.cantidad::INT,
      pv.precio_m2, pv.subtotal_vidrio, pp.subtotal_procesos, pp.subtotal
    FROM pedido p
    LEFT JOIN cliente c         ON c.id_cliente      = p.id_cliente
    LEFT JOIN partida pp        ON pp.id_pedido      = p.id_pedido AND pp.tipo = 'VIDRIO'
    LEFT JOIN partida_vidrio pv ON pv.id_partida     = pp.id_partida
    LEFT JOIN tipo_vidrio tv    ON tv.id_tipo_vidrio = pv.id_tipo_vidrio
    WHERE p.tipo_pedido = 'VIDRIO'
      AND p.estatus     = 'ENTREGADO'
      AND (p_fecha_inicio IS NULL OR (COALESCE(p.fecha_entrega, p.fecha_creacion) AT TIME ZONE 'America/Mexico_City')::DATE >= (p_fecha_inicio AT TIME ZONE 'America/Mexico_City')::DATE)
      AND (p_fecha_fin   IS NULL OR (COALESCE(p.fecha_entrega, p.fecha_creacion) AT TIME ZONE 'America/Mexico_City')::DATE <= (p_fecha_fin AT TIME ZONE 'America/Mexico_City')::DATE)
    ORDER BY COALESCE(p.fecha_entrega, p.fecha_creacion) DESC NULLS LAST, pp.id_partida;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.sp_obtener_historial_ventas(p_fecha_inicio date DEFAULT NULL::date, p_fecha_fin date DEFAULT NULL::date)
 RETURNS TABLE(id_pedido integer, folio text, fecha_creacion timestamp with time zone, fecha_entrega timestamp with time zone, cliente text, nivel_precio text, tipo_pago text, monto_anticipo numeric, monto_cobrado_entrega numeric, total numeric, total_cobrado numeric, tipo_vidrio text, largo_cm numeric, ancho_cm numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id_pedido, p.folio::TEXT, p.fecha_creacion, p.fecha_entrega,
    COALESCE(c.nombre, 'Mostrador')::TEXT AS cliente,
    COALESCE(np.nombre, '')::TEXT AS nivel_precio,
    p.tipo_pago::TEXT,
    COALESCE(p.monto_anticipo, 0), p.monto_cobrado_entrega, p.total,
    COALESCE(p.monto_anticipo, 0) + COALESCE(p.monto_cobrado_entrega, 0) AS total_cobrado,
    COALESCE(tv.clave, '—')::TEXT AS tipo_vidrio,
    pp.largo_cm,
    pp.ancho_cm
  FROM pedido p
  LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
  LEFT JOIN nivel_precio np ON np.id_nivel_precio = p.id_nivel_precio
  LEFT JOIN partida pp ON pp.id_pedido = p.id_pedido AND pp.tipo = 'VIDRIO'
  LEFT JOIN partida_vidrio pv ON pv.id_partida = pp.id_partida
  LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pv.id_tipo_vidrio
  WHERE p.tipo_pedido IN ('VIDRIO', 'MAQUILA', 'HERRAJE')
    AND p.estatus = 'ENTREGADO'
    AND (p_fecha_inicio IS NULL OR (COALESCE(p.fecha_entrega, p.fecha_creacion) AT TIME ZONE 'America/Mexico_City')::DATE >= p_fecha_inicio)
    AND (p_fecha_fin   IS NULL OR (COALESCE(p.fecha_entrega, p.fecha_creacion) AT TIME ZONE 'America/Mexico_City')::DATE <= p_fecha_fin)
  ORDER BY COALESCE(p.fecha_entrega, p.fecha_creacion) DESC NULLS LAST;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sp_getpartidasforfactura(p_id_pedido integer)
 RETURNS TABLE(descripcion text, cantidad numeric, precio_unitario numeric, subtotal numeric)
 LANGUAGE sql
AS $function$
  -- Vidrio pieces
  SELECT
    (COALESCE(tv.clave, '—') || ' ' || pp.largo_cm || '×' || pp.ancho_cm || 'cm')::TEXT AS descripcion,
    pp.cantidad::NUMERIC                             AS cantidad,
    (pp.subtotal / NULLIF(pp.cantidad, 0))::NUMERIC  AS precio_unitario,
    pp.subtotal::NUMERIC                             AS subtotal
  FROM partida pp
  JOIN partida_vidrio pv ON pv.id_partida = pp.id_partida
  LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pv.id_tipo_vidrio
  WHERE pp.id_pedido = p_id_pedido AND pp.tipo = 'VIDRIO'

  UNION ALL

  -- Maquila / producto / extra line items (no dimensions)
  SELECT
    descripcion::TEXT,
    cantidad::NUMERIC,
    precio_unitario::NUMERIC,
    subtotal::NUMERIC
  FROM partida
  WHERE id_pedido = p_id_pedido
    AND tipo IN ('MAQUILA','PRODUCTO','EXTRA')
    AND largo_cm IS NULL

  UNION ALL

  -- Dedicated maquila job partidas (dimensioned)
  SELECT
    descripcion::TEXT,
    cantidad::NUMERIC,
    (subtotal / NULLIF(cantidad, 0))::NUMERIC AS precio_unitario,
    subtotal::NUMERIC                          AS subtotal
  FROM partida
  WHERE id_pedido = p_id_pedido
    AND tipo = 'MAQUILA'
    AND largo_cm IS NOT NULL;
$function$;
