-- The 027/028 CTI split moved id_proceso/id_unidad_cobro/sides off the
-- base `partida` table for EVERY tipo='PROCESO' row, not just the ones
-- attached to a VIDRIO partida. The maquila module also attaches
-- PROCESO children to its MAQUILA partidas, so its SPs need the same
-- satellite-table fixup.

CREATE OR REPLACE FUNCTION public.sp_agregar_partida_maquila(p_id_cotizacion integer, p_descripcion text, p_largo_cm numeric, p_ancho_cm numeric, p_cantidad integer, p_procesos jsonb DEFAULT '[]'::jsonb, p_id_espesor integer DEFAULT NULL)
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

  v_m2 := ROUND((p_largo_cm * p_ancho_cm * p_cantidad) / 10000.0, 2);

  INSERT INTO partida
    (id_cotizacion, tipo, descripcion, largo_cm, ancho_cm, cantidad, metros2, subtotal_procesos, subtotal, id_espesor)
  VALUES
    (p_id_cotizacion, 'MAQUILA', p_descripcion, p_largo_cm, p_ancho_cm, p_cantidad, v_m2, 0, 0, p_id_espesor)
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

    INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal, precio_por_pieza)
    VALUES (v_id_partida, v_id_proc, v_id_unidad, v_cantidad_u, v_precio_u, v_sub_i, ROUND(v_sub_i / NULLIF(p_cantidad, 0), 2));
  END LOOP;

  UPDATE partida
  SET subtotal_procesos = v_sub_proc, subtotal = v_sub_proc,
      precio_unitario   = ROUND(v_sub_proc / NULLIF(p_cantidad, 0), 2)
  WHERE id_partida = v_id_partida;

  UPDATE cotizacion
  SET total = COALESCE(
    (SELECT SUM(subtotal) FROM partida WHERE id_cotizacion = p_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL), 0)
  WHERE id_cotizacion = p_id_cotizacion;

  RETURN QUERY SELECT v_id_partida, v_sub_proc, 'OK'::TEXT;
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
    LEFT JOIN partida_proceso ppm ON ppm.id_partida = pm.id_partida
    LEFT JOIN proceso        pr  ON pr.id_proceso        = ppm.id_proceso
    LEFT JOIN unidad_cobro   uc  ON uc.id_unidad_cobro   = ppm.id_unidad_cobro
    WHERE c.id_cotizacion = p_id_cotizacion
      AND c.tipo_cotizacion = 'MAQUILA'
    ORDER BY pm.id_partida, ppm.id_partida_proceso;
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
    v_piezas_maq        NUMERIC;
    rec_pm              RECORD;
    rec_proc            RECORD;
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

    SELECT COALESCE(SUM(cantidad), 0) INTO v_piezas_maq
    FROM partida WHERE id_cotizacion = p_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL;

    INSERT INTO pedido (
        folio, id_cotizacion, id_cliente, id_nivel_precio, tipo_pago,
        monto_anticipo, saldo_pendiente, total,
        estatus, tipo_pedido, piezas_maquila_recibidas
    )
    VALUES (
        'PED-00000', p_id_cotizacion, v_id_cliente, v_id_nivel, p_tipo_pago::tipo_pago_t,
        COALESCE(p_monto_anticipo, 0),
        v_total - COALESCE(p_monto_anticipo, 0),
        v_total,
        CASE WHEN p_monto_anticipo >= v_total THEN 'ANTICIPO_LIQUIDADO' ELSE 'PENDIENTE' END,
        'MAQUILA',
        v_piezas_maq
    )
    RETURNING id_pedido INTO p_id_pedido;

    p_folio_pedido := 'PED-' || LPAD(p_id_pedido::TEXT, 5, '0');
    UPDATE pedido SET folio = p_folio_pedido WHERE id_pedido = p_id_pedido;

    FOR rec_pm IN
        SELECT * FROM partida WHERE id_cotizacion = p_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL
    LOOP
        INSERT INTO partida (
            id_pedido, tipo, descripcion, largo_cm, ancho_cm,
            cantidad, metros2, subtotal_procesos, precio_unitario, subtotal, id_espesor
        )
        VALUES (
            p_id_pedido, 'MAQUILA', rec_pm.descripcion, rec_pm.largo_cm, rec_pm.ancho_cm,
            rec_pm.cantidad, rec_pm.metros2, rec_pm.subtotal_procesos, rec_pm.precio_unitario, rec_pm.subtotal, rec_pm.id_espesor
        )
        RETURNING id_partida INTO v_id_partida_ped;

        FOR rec_proc IN
            SELECT cantidad, precio_unitario, subtotal, id_proceso, id_unidad_cobro, sides, precio_por_pieza
            FROM partida_proceso
            WHERE id_partida = rec_pm.id_partida
        LOOP
            INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal, sides, precio_por_pieza)
            VALUES (v_id_partida_ped, rec_proc.id_proceso, rec_proc.id_unidad_cobro, rec_proc.cantidad, rec_proc.precio_unitario, rec_proc.subtotal, rec_proc.sides, rec_proc.precio_por_pieza);
        END LOOP;
    END LOOP;

    UPDATE cotizacion SET estatus = 'CONVERTIDA' WHERE id_cotizacion = p_id_cotizacion;

    p_mensaje := 'Pedido de maquila creado: ' || p_folio_pedido;
END;
$function$;
