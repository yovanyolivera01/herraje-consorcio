-- Extends the "no use the old tables" cutover (see 025) to:
--   - pedidos (vidrio): sp_crear_pedido_directo, sp_convertir_cotizacion_a_pedido,
--     sp_obtener_partidas_pedido, sp_obtener_procesos_pedido,
--     sp_obtener_pedidos_pendientes, sp_entregar_partida_pedido,
--     sp_decrementar_inventario_vidrio, sp_exportar_excel_ventas,
--     sp_obtener_historial_ventas, sp_getpartidasforfactura
--   - extras (MAQUILA/PRODUCTO/EXTRA line items attached to a vidrio
--     cotizacion/pedido): folded into the same SPs above + route changes
--   - the standalone maquila quoting module: sp_agregar_partida_maquila,
--     sp_finalizar_cotizacion_maquila, sp_obtener_ticket_maquila,
--     sp_eliminar_partida_maquila, sp_convertir_maquila_a_pedido
--
-- Discriminator note: both "extra" line items and real maquila-job partidas
-- can carry tipo='MAQUILA'. Only job partidas ever set largo_cm/ancho_cm
-- (extras never do), so `largo_cm IS NOT NULL` reliably identifies a real
-- maquila job wherever the two could otherwise collide under the same
-- pedido/cotizacion.

-- ════════════════════════════════════════════════════════════════════════
-- PEDIDOS (VIDRIO)
-- ════════════════════════════════════════════════════════════════════════

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
    INSERT INTO partida (
      id_pedido, tipo, id_tipo_vidrio, largo_cm, ancho_cm, cantidad,
      metros2, precio_m2, subtotal_vidrio, subtotal_procesos, subtotal,
      estatus_entrega, fecha_entrega_real
    ) VALUES (
      v_id_pedido, 'VIDRIO',
      (v_partida->>'id_tipo_vidrio')::INT,
      (v_partida->>'largo_cm')::NUMERIC,
      (v_partida->>'ancho_cm')::NUMERIC,
      (v_partida->>'piezas')::NUMERIC,
      (v_partida->>'metros2')::NUMERIC,
      (v_partida->>'precio_m2_aplicado')::NUMERIC,
      (v_partida->>'subtotal_vidrio')::NUMERIC,
      (v_partida->>'subtotal_procesos')::NUMERIC,
      (v_partida->>'subtotal_partida')::NUMERIC,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END
    ) RETURNING id_partida INTO v_id_partida;

    IF jsonb_array_length(COALESCE(v_partida->'procesos', '[]'::JSONB)) > 0 THEN
      FOR v_proceso IN SELECT * FROM jsonb_array_elements(v_partida->'procesos') LOOP
        INSERT INTO partida (
          id_pedido, id_partida_padre, tipo, id_proceso, id_unidad_cobro,
          cantidad, precio_unitario, subtotal, sides
        ) VALUES (
          v_id_pedido, v_id_partida, 'PROCESO',
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
  v_partida    partida%ROWTYPE;
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
    SELECT * FROM partida WHERE id_cotizacion = p_id_cotizacion AND tipo = 'VIDRIO'
  LOOP
    INSERT INTO partida (
      id_pedido, tipo, id_tipo_vidrio, largo_cm, ancho_cm, cantidad,
      metros2, precio_m2, subtotal_vidrio, subtotal_procesos, subtotal,
      estatus_entrega, fecha_entrega_real, observaciones
    ) VALUES (
      v_id_pedido, 'VIDRIO', v_partida.id_tipo_vidrio, v_partida.largo_cm, v_partida.ancho_cm,
      COALESCE(v_partida.cantidad, 1),
      v_partida.metros2, v_partida.precio_m2,
      v_partida.subtotal_vidrio, v_partida.subtotal_procesos, v_partida.subtotal,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END,
      CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN NOW() ELSE NULL END,
      v_partida.observaciones
    ) RETURNING id_partida INTO v_id_pp;

    INSERT INTO partida
      (id_pedido, id_partida_padre, tipo, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal, sides)
    SELECT v_id_pedido, v_id_pp, 'PROCESO', id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal, sides
    FROM partida
    WHERE id_partida_padre = v_partida.id_partida AND tipo = 'PROCESO';
  END LOOP;

  INSERT INTO partida (
    id_pedido, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones
  )
  SELECT
    v_id_pedido, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones
  FROM partida
  WHERE id_cotizacion = p_id_cotizacion
    AND tipo IN ('MAQUILA','PRODUCTO','EXTRA')
    AND id_partida_padre IS NULL
    AND largo_cm IS NULL;

  UPDATE cotizacion SET estatus = 'CONVERTIDA' WHERE id_cotizacion = p_id_cotizacion;

  RETURN QUERY SELECT v_id_pedido, v_folio, 'OK'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::INT, NULL::TEXT, ('ERROR: ' || SQLERRM)::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sp_obtener_partidas_pedido(p_id_pedido integer)
 RETURNS TABLE(id_partida_pedido integer, tipo_vidrio text, largo_cm numeric, ancho_cm numeric, cantidad integer, metros_cuadrados numeric, precio_m2 numeric, subtotal_vidrio numeric, subtotal_procesos numeric, total_partida numeric, estatus_entrega text, fecha_entrega_real timestamp with time zone, observaciones text)
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
    p.precio_m2,
    p.subtotal_vidrio,
    p.subtotal_procesos,
    p.subtotal                AS total_partida,
    p.estatus_entrega::TEXT   AS estatus_entrega,
    p.fecha_entrega_real,
    p.observaciones::TEXT     AS observaciones
  FROM partida p
  LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = p.id_tipo_vidrio
  WHERE p.id_pedido = p_id_pedido AND p.tipo = 'VIDRIO'
  ORDER BY p.id_partida;
$function$;

CREATE OR REPLACE FUNCTION public.sp_obtener_procesos_pedido(p_id_pedido integer)
 RETURNS TABLE(id_partida_pedido integer, proceso text, unidad_cobro text, cantidad_unidades numeric, precio_unitario numeric, subtotal numeric, sides jsonb)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    pp.id_partida_padre     AS id_partida_pedido,
    pr.nombre::TEXT         AS proceso,
    uc.nombre::TEXT         AS unidad_cobro,
    pp.cantidad             AS cantidad_unidades,
    pp.precio_unitario,
    pp.subtotal,
    pp.sides
  FROM partida pp
  LEFT JOIN proceso      pr ON pr.id_proceso      = pp.id_proceso
  LEFT JOIN unidad_cobro uc ON uc.id_unidad_cobro = pp.id_unidad_cobro
  WHERE pp.tipo = 'PROCESO'
    AND pp.id_partida_padre IN (
      SELECT id_partida FROM partida WHERE id_pedido = p_id_pedido AND tipo = 'VIDRIO'
    )
  ORDER BY pp.id_partida_padre, pp.id_partida;
$function$;

CREATE OR REPLACE FUNCTION public.sp_obtener_pedidos_pendientes(p_tipo_pedido character varying)
 RETURNS TABLE(id_pedido integer, folio text, tipo_pedido text, cliente text, fecha_pedido timestamp with time zone, total numeric, monto_anticipo numeric, saldo_pendiente numeric, estatus text, partidas_pendientes bigint, partidas_total bigint, tipo_pago text)
 LANGUAGE sql
AS $function$
    SELECT
        p.id_pedido,
        p.folio,
        p.tipo_pedido,
        COALESCE(c.nombre, 'Público general') AS cliente,
        p.fecha_creacion AS fecha_pedido,
        p.total,
        p.monto_anticipo,
        p.saldo_pendiente,
        p.estatus::TEXT AS estatus,
        CASE p.tipo_pedido
            WHEN 'VIDRIO' THEN
                (SELECT COUNT(*) FROM partida pp
                 WHERE pp.id_pedido = p.id_pedido AND pp.tipo = 'VIDRIO' AND pp.estatus_entrega = 'PENDIENTE')
                +
                (CASE WHEN p.estatus::TEXT = 'PENDIENTE'
                      THEN (SELECT COUNT(*) FROM partida ppe
                            WHERE ppe.id_pedido = p.id_pedido AND ppe.tipo IN ('MAQUILA','PRODUCTO','EXTRA')
                              AND ppe.id_partida_padre IS NULL AND ppe.largo_cm IS NULL)
                      ELSE 0 END)
            WHEN 'MAQUILA' THEN
                (SELECT COUNT(*) FROM partida ppm
                 WHERE ppm.id_pedido = p.id_pedido AND ppm.tipo = 'MAQUILA' AND ppm.largo_cm IS NOT NULL
                   AND ppm.estatus_entrega = 'PENDIENTE')
                +
                (CASE WHEN p.estatus::TEXT = 'PENDIENTE'
                      THEN (SELECT COUNT(*) FROM partida ppe
                            WHERE ppe.id_pedido = p.id_pedido AND ppe.tipo IN ('MAQUILA','PRODUCTO','EXTRA')
                              AND ppe.id_partida_padre IS NULL AND ppe.largo_cm IS NULL)
                      ELSE 0 END)
            ELSE 0
        END AS partidas_pendientes,
        CASE p.tipo_pedido
            WHEN 'VIDRIO' THEN
                (SELECT COUNT(*) FROM partida pp WHERE pp.id_pedido = p.id_pedido AND pp.tipo = 'VIDRIO')
                + (SELECT COUNT(*) FROM partida ppe
                   WHERE ppe.id_pedido = p.id_pedido AND ppe.tipo IN ('MAQUILA','PRODUCTO','EXTRA')
                     AND ppe.id_partida_padre IS NULL AND ppe.largo_cm IS NULL)
            WHEN 'MAQUILA' THEN
                (SELECT COUNT(*) FROM partida ppm WHERE ppm.id_pedido = p.id_pedido AND ppm.tipo = 'MAQUILA' AND ppm.largo_cm IS NOT NULL)
                + (SELECT COUNT(*) FROM partida ppe
                   WHERE ppe.id_pedido = p.id_pedido AND ppe.tipo IN ('MAQUILA','PRODUCTO','EXTRA')
                     AND ppe.id_partida_padre IS NULL AND ppe.largo_cm IS NULL)
            ELSE 0
        END AS partidas_total,
        p.tipo_pago::TEXT AS tipo_pago
    FROM pedido p
    LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
    WHERE p.estatus::TEXT IN ('PENDIENTE','ANTICIPO_LIQUIDADO','PARCIAL')
      AND (p_tipo_pedido IS NULL OR p.tipo_pedido = p_tipo_pedido)
    ORDER BY p.fecha_creacion ASC;
$function$;

CREATE OR REPLACE FUNCTION public.sp_entregar_partida_pedido(p_id_partida_pedido integer, OUT p_mensaje text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_pedido     INT;
    v_total         INT;
    v_entregadas    INT;
BEGIN
    SELECT id_pedido INTO v_id_pedido
    FROM partida
    WHERE id_partida = p_id_partida_pedido
      AND tipo = 'VIDRIO'
      AND estatus_entrega = 'PENDIENTE';

    IF v_id_pedido IS NULL THEN
        p_mensaje := 'Línea no encontrada o ya entregada.';
        RETURN;
    END IF;

    UPDATE partida
    SET estatus_entrega    = 'ENTREGADO',
        fecha_entrega_real = NOW()
    WHERE id_partida = p_id_partida_pedido;

    SELECT COUNT(*)  INTO v_total      FROM partida WHERE id_pedido = v_id_pedido AND tipo = 'VIDRIO';
    SELECT COUNT(*)  INTO v_entregadas FROM partida
    WHERE id_pedido = v_id_pedido AND tipo = 'VIDRIO' AND estatus_entrega = 'ENTREGADO';

    UPDATE pedido
    SET estatus = CASE
            WHEN v_entregadas = v_total THEN 'ENTREGADO'
            WHEN v_entregadas > 0       THEN 'PARCIAL'
            ELSE estatus
        END,
        fecha_entrega = CASE
            WHEN v_entregadas = v_total THEN NOW()
            ELSE fecha_entrega
        END
    WHERE id_pedido = v_id_pedido;

    p_mensaje := 'Partida marcada como entregada. Estatus del pedido actualizado.';
END;
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
    SELECT id_tipo_vidrio,
           SUM(metros2) AS total_m2
    FROM   partida
    WHERE  id_cotizacion = p_id_cotizacion AND tipo = 'VIDRIO'
    GROUP  BY id_tipo_vidrio
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
    pp.precio_m2, pp.subtotal_vidrio, pp.subtotal_procesos, pp.subtotal
  FROM pedido p
  LEFT JOIN cliente c      ON c.id_cliente      = p.id_cliente
  LEFT JOIN partida pp     ON pp.id_pedido      = p.id_pedido AND pp.tipo = 'VIDRIO'
  LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pp.id_tipo_vidrio
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
  LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pp.id_tipo_vidrio
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
  LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pp.id_tipo_vidrio
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
    AND id_partida_padre IS NULL
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

-- ════════════════════════════════════════════════════════════════════════
-- MAQUILA MODULE
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sp_agregar_partida_maquila(p_id_cotizacion integer, p_descripcion text, p_largo_cm numeric, p_ancho_cm numeric, p_cantidad integer, p_procesos jsonb DEFAULT '[]'::jsonb)
 RETURNS TABLE(p_id_partida integer, p_subtotal numeric, p_mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_id_nivel    INTEGER;
  v_m2          NUMERIC;
  v_sub_proc    NUMERIC := 0;
  v_id_partida  INTEGER;
  v_proc        JSONB;
  v_id_proc     INTEGER;
  v_unidad      TEXT;
  v_id_unidad   INTEGER;
  v_precio_u    NUMERIC;
  v_cantidad_u  NUMERIC;
  v_sub_i       NUMERIC;
BEGIN
  SELECT id_nivel_precio INTO v_id_nivel
  FROM cotizacion WHERE id_cotizacion = p_id_cotizacion;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0::NUMERIC, 'Error: cotización no encontrada'::TEXT;
    RETURN;
  END IF;

  v_m2 := ROUND((p_largo_cm * p_ancho_cm * p_cantidad) / 10000.0, 4);

  INSERT INTO partida
    (id_cotizacion, tipo, descripcion, largo_cm, ancho_cm, cantidad, metros2, subtotal_procesos, subtotal)
  VALUES
    (p_id_cotizacion, 'MAQUILA', p_descripcion, p_largo_cm, p_ancho_cm, p_cantidad, v_m2, 0, 0)
  RETURNING id_partida INTO v_id_partida;

  FOR v_proc IN SELECT * FROM jsonb_array_elements(p_procesos) LOOP
    v_id_proc := (v_proc->>'id_proceso')::INTEGER;

    SELECT pr.id_unidad_cobro, uc.nombre
    INTO v_id_unidad, v_unidad
    FROM proceso pr
    JOIN unidad_cobro uc ON uc.id_unidad_cobro = pr.id_unidad_cobro
    WHERE pr.id_proceso = v_id_proc;

    IF v_unidad ILIKE 'pza' OR v_unidad ILIKE '%pieza%' THEN
      SELECT precio_unitario INTO v_precio_u
      FROM precio_proceso_especial
      WHERE id_proceso = v_id_proc AND id_nivel_precio = v_id_nivel;
      v_cantidad_u := COALESCE((v_proc->>'cantidad')::NUMERIC, p_cantidad);
    ELSIF lower(v_unidad) LIKE '%ml%' OR lower(v_unidad) LIKE '%metro l%' THEN
      SELECT precio_unitario INTO v_precio_u
      FROM precio_proceso
      WHERE id_proceso = v_id_proc AND id_nivel_precio = v_id_nivel
      LIMIT 1;
      v_cantidad_u := COALESCE((v_proc->>'cantidad')::NUMERIC,
                               p_cantidad * 2 * (p_largo_cm + p_ancho_cm) / 100.0);
    ELSE
      SELECT precio_unitario INTO v_precio_u
      FROM precio_proceso
      WHERE id_proceso = v_id_proc AND id_nivel_precio = v_id_nivel
      LIMIT 1;
      v_cantidad_u := COALESCE((v_proc->>'cantidad')::NUMERIC, v_m2);
    END IF;

    v_precio_u := COALESCE(v_precio_u, 0);
    v_sub_i    := ROUND(v_cantidad_u * v_precio_u, 2);
    v_sub_proc := v_sub_proc + v_sub_i;

    INSERT INTO partida
      (id_cotizacion, id_partida_padre, tipo, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal)
    VALUES
      (p_id_cotizacion, v_id_partida, 'PROCESO', v_id_proc, v_id_unidad, v_cantidad_u, v_precio_u, v_sub_i);
  END LOOP;

  UPDATE partida
  SET subtotal_procesos = v_sub_proc, subtotal = v_sub_proc
  WHERE id_partida = v_id_partida;

  UPDATE cotizacion
  SET total = COALESCE(
    (SELECT SUM(subtotal) FROM partida WHERE id_cotizacion = p_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL), 0)
  WHERE id_cotizacion = p_id_cotizacion;

  RETURN QUERY SELECT v_id_partida, v_sub_proc, 'OK'::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sp_finalizar_cotizacion_maquila(p_id_cotizacion integer, OUT p_total numeric, OUT p_mensaje text)
 RETURNS record
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total NUMERIC(12,2);
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM cotizacion
        WHERE id_cotizacion = p_id_cotizacion
          AND estatus = 'BORRADOR'
          AND tipo_cotizacion = 'MAQUILA'
    ) THEN
        p_total   := 0;
        p_mensaje := 'Cotización no encontrada o no está en borrador.';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM partida WHERE id_cotizacion = p_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL
    ) THEN
        p_total   := 0;
        p_mensaje := 'No se puede finalizar: la cotización no tiene partidas.';
        RETURN;
    END IF;

    SELECT COALESCE(SUM(CEIL(subtotal / 5.0) * 5), 0) INTO v_total
    FROM partida WHERE id_cotizacion = p_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL;

    UPDATE cotizacion
    SET estatus = 'FINALIZADA',
        total   = v_total,
        fecha_modificacion = NOW()
    WHERE id_cotizacion = p_id_cotizacion;

    p_total   := v_total;
    p_mensaje := 'Cotización de maquila finalizada. Total: $' || v_total;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sp_obtener_ticket_maquila(p_id_cotizacion integer)
 RETURNS TABLE(folio text, tipo_cotizacion text, cliente text, nivel_precio text, observaciones text, estatus text, fecha_cotizacion timestamp with time zone, total numeric, id_partida integer, descripcion_vidrio text, largo_cm numeric, ancho_cm numeric, cantidad integer, metros2 numeric, nombre_proceso text, unidad_cobro text, cantidad_proceso numeric, precio_unitario numeric, subtotal_proceso numeric, subtotal_partida numeric)
 LANGUAGE sql
AS $function$
    SELECT
        c.folio,
        c.tipo_cotizacion,
        COALESCE(cl.nombre, 'Público general') AS cliente,
        np.nombre                              AS nivel_precio,
        c.observaciones,
        c.estatus,
        c.fecha,
        c.total,
        pm.id_partida,
        pm.descripcion                          AS descripcion_vidrio,
        pm.largo_cm,
        pm.ancho_cm,
        pm.cantidad::INT                        AS cantidad,
        pm.metros2,
        pr.nombre                               AS nombre_proceso,
        uc.nombre                               AS unidad_cobro,
        ppm.cantidad                            AS cantidad_proceso,
        ppm.precio_unitario,
        ppm.subtotal                            AS subtotal_proceso,
        pm.subtotal                             AS subtotal_partida
    FROM cotizacion c
    LEFT JOIN cliente        cl  ON cl.id_cliente       = c.id_cliente
    JOIN  nivel_precio       np  ON np.id_nivel_precio  = c.id_nivel_precio
    JOIN  partida            pm  ON pm.id_cotizacion    = c.id_cotizacion AND pm.tipo = 'MAQUILA' AND pm.largo_cm IS NOT NULL
    LEFT JOIN partida        ppm ON ppm.id_partida_padre = pm.id_partida AND ppm.tipo = 'PROCESO'
    LEFT JOIN proceso        pr  ON pr.id_proceso        = ppm.id_proceso
    LEFT JOIN unidad_cobro   uc  ON uc.id_unidad_cobro   = ppm.id_unidad_cobro
    WHERE c.id_cotizacion = p_id_cotizacion
      AND c.tipo_cotizacion = 'MAQUILA'
    ORDER BY pm.id_partida, ppm.id_partida;
$function$;

CREATE OR REPLACE FUNCTION public.sp_eliminar_partida_maquila(p_id_partida_maquila integer, OUT p_mensaje text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_cotizacion INT;
BEGIN
    SELECT id_cotizacion INTO v_id_cotizacion
    FROM partida
    WHERE id_partida = p_id_partida_maquila AND tipo = 'MAQUILA';

    IF v_id_cotizacion IS NULL THEN
        p_mensaje := 'Partida no encontrada.';
        RETURN;
    END IF;

    DELETE FROM partida WHERE id_partida = p_id_partida_maquila AND tipo = 'MAQUILA';

    UPDATE cotizacion
    SET total = (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM partida
        WHERE id_cotizacion = v_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL
    )
    WHERE id_cotizacion = v_id_cotizacion;

    p_mensaje := 'Partida eliminada y total actualizado.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.sp_convertir_maquila_a_pedido(p_id_cotizacion integer, p_tipo_pago character varying, p_monto_anticipo numeric, OUT p_id_pedido integer, OUT p_folio_pedido text, OUT p_mensaje text)
 RETURNS record
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_cliente        INT;
    v_id_nivel          INT;
    v_total             NUMERIC(12,2);
    v_folio             TEXT;
    rec_pm              RECORD;
    v_id_partida_ped    INT;
BEGIN
    SELECT id_cliente, id_nivel_precio, total INTO v_id_cliente, v_id_nivel, v_total
    FROM cotizacion
    WHERE id_cotizacion = p_id_cotizacion
      AND tipo_cotizacion = 'MAQUILA'
      AND estatus = 'FINALIZADA';

    IF v_total IS NULL THEN
        p_id_pedido    := 0;
        p_folio_pedido := '';
        p_mensaje      := 'Cotización no encontrada, no es maquila, o no está FINALIZADA.';
        RETURN;
    END IF;

    INSERT INTO pedido (
        folio, id_cotizacion, id_cliente, id_nivel_precio, tipo_pago,
        monto_anticipo, saldo_pendiente, total,
        estatus, tipo_pedido
    )
    VALUES (
        'PED-00000', p_id_cotizacion, v_id_cliente, v_id_nivel, p_tipo_pago::tipo_pago_t,
        COALESCE(p_monto_anticipo, 0),
        v_total - COALESCE(p_monto_anticipo, 0),
        v_total,
        CASE WHEN p_monto_anticipo >= v_total THEN 'ANTICIPO_LIQUIDADO' ELSE 'PENDIENTE' END,
        'MAQUILA'
    )
    RETURNING id_pedido INTO p_id_pedido;

    v_folio := 'PED-' || LPAD(p_id_pedido::TEXT, 5, '0');
    UPDATE pedido SET folio = v_folio WHERE id_pedido = p_id_pedido;

    FOR rec_pm IN
        SELECT * FROM partida WHERE id_cotizacion = p_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL
    LOOP
        INSERT INTO partida (
            id_pedido, tipo, descripcion, largo_cm, ancho_cm,
            cantidad, metros2, subtotal_procesos, subtotal
        )
        VALUES (
            p_id_pedido, 'MAQUILA', rec_pm.descripcion, rec_pm.largo_cm, rec_pm.ancho_cm,
            rec_pm.cantidad, rec_pm.metros2, rec_pm.subtotal_procesos, rec_pm.subtotal
        )
        RETURNING id_partida INTO v_id_partida_ped;

        INSERT INTO partida (id_pedido, id_partida_padre, tipo, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal)
        SELECT p_id_pedido, v_id_partida_ped, 'PROCESO', id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal
        FROM partida
        WHERE id_partida_padre = rec_pm.id_partida AND tipo = 'PROCESO';
    END LOOP;

    UPDATE cotizacion SET estatus = 'CONVERTIDA' WHERE id_cotizacion = p_id_cotizacion;

    p_folio_pedido := v_folio;
    p_mensaje      := 'Pedido de maquila creado: ' || v_folio;
END;
$function$;
