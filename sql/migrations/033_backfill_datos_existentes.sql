-- One-time backfill: copies every existing row from the old tables into
-- the new partida / partida_vidrio / partida_proceso structure, so
-- pedidos and cotizaciones created BEFORE this cutover keep showing
-- their line items after the new code goes live.
--
-- Safe to run exactly once, right after 025-032 and BEFORE the new
-- application code starts inserting into `partida`. Refuses to run if
-- `partida` already has rows, to prevent accidental double-insertion.
--
-- Nothing is deleted from the old tables — this is a copy, not a move.

DO $$
DECLARE
  rec    RECORD;
  new_id INT;
BEGIN
  IF EXISTS (SELECT 1 FROM partida LIMIT 1) THEN
    RAISE EXCEPTION 'partida already has rows — refusing to run this one-time backfill again.';
  END IF;

  CREATE TEMP TABLE map_vidrio (old_table TEXT, old_id INT, new_id INT) ON COMMIT DROP;
  CREATE TEMP TABLE map_maquila (old_table TEXT, old_id INT, new_id INT) ON COMMIT DROP;

  -- ── 1. Cotización-side VIDRIO: partida_cotizacion -> partida + partida_vidrio ──
  FOR rec IN SELECT * FROM partida_cotizacion LOOP
    INSERT INTO partida (id_cotizacion, tipo, largo_cm, ancho_cm, metros2, cantidad, subtotal_procesos, precio_unitario, subtotal, observaciones)
    VALUES (rec.id_cotizacion, 'VIDRIO', rec.largo_cm, rec.ancho_cm, rec.metros2, rec.piezas, rec.subtotal_procesos, ROUND(rec.subtotal_partida / NULLIF(rec.piezas, 0), 2), rec.subtotal_partida, rec.observaciones)
    RETURNING id_partida INTO new_id;

    INSERT INTO partida_vidrio (id_partida, id_tipo_vidrio, precio_m2, es_hoja_completa, subtotal_vidrio)
    VALUES (new_id, rec.id_tipo_vidrio, rec.precio_m2_aplicado, rec.es_hoja_completa, rec.subtotal_vidrio);

    INSERT INTO map_vidrio VALUES ('partida_cotizacion', rec.id_partida, new_id);
  END LOOP;

  -- ── 2. Cotización-side PROCESO: partida_proceso_legacy -> partida + partida_proceso ──
  FOR rec IN
    SELECT pl.cantidad, pl.precio_unitario, pl.subtotal, pl.id_proceso, pl.id_unidad_cobro, pl.sides,
           m.new_id AS new_padre_id, p.id_cotizacion AS new_id_cotizacion
    FROM partida_proceso_legacy pl
    JOIN map_vidrio m ON m.old_table = 'partida_cotizacion' AND m.old_id = pl.id_partida
    JOIN partida p ON p.id_partida = m.new_id
  LOOP
    INSERT INTO partida (id_cotizacion, id_partida_padre, tipo, cantidad, precio_unitario, subtotal)
    VALUES (rec.new_id_cotizacion, rec.new_padre_id, 'PROCESO', rec.cantidad, rec.precio_unitario, rec.subtotal)
    RETURNING id_partida INTO new_id;

    INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro, sides)
    VALUES (new_id, rec.id_proceso, rec.id_unidad_cobro, rec.sides);
  END LOOP;

  -- ── 3. Pedido-side VIDRIO: partida_pedido -> partida + partida_vidrio ──
  FOR rec IN SELECT * FROM partida_pedido LOOP
    INSERT INTO partida (id_pedido, tipo, largo_cm, ancho_cm, metros2, cantidad, subtotal_procesos, precio_unitario, subtotal, observaciones, estatus_entrega, fecha_entrega_real)
    VALUES (rec.id_pedido, 'VIDRIO', rec.largo_cm, rec.ancho_cm, rec.metros_cuadrados, rec.cantidad, rec.subtotal_procesos, ROUND(rec.total_partida / NULLIF(rec.cantidad, 0), 2), rec.total_partida, rec.observaciones, rec.estatus_entrega, rec.fecha_entrega_real)
    RETURNING id_partida INTO new_id;

    INSERT INTO partida_vidrio (id_partida, id_tipo_vidrio, precio_m2, es_hoja_completa, subtotal_vidrio)
    VALUES (new_id, rec.id_tipo_vidrio, rec.precio_m2, FALSE, rec.subtotal_vidrio);

    INSERT INTO map_vidrio VALUES ('partida_pedido', rec.id_partida_pedido, new_id);
  END LOOP;

  -- ── 4. Pedido-side PROCESO: partida_proceso_pedido -> partida + partida_proceso ──
  FOR rec IN
    SELECT ppp.cantidad_unidades AS cantidad, ppp.precio_unitario, ppp.subtotal, ppp.id_proceso, ppp.id_unidad_cobro, ppp.sides,
           m.new_id AS new_padre_id, p.id_pedido AS new_id_pedido
    FROM partida_proceso_pedido ppp
    JOIN map_vidrio m ON m.old_table = 'partida_pedido' AND m.old_id = ppp.id_partida_pedido
    JOIN partida p ON p.id_partida = m.new_id
  LOOP
    INSERT INTO partida (id_pedido, id_partida_padre, tipo, cantidad, precio_unitario, subtotal)
    VALUES (rec.new_id_pedido, rec.new_padre_id, 'PROCESO', rec.cantidad, rec.precio_unitario, rec.subtotal)
    RETURNING id_partida INTO new_id;

    INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro, sides)
    VALUES (new_id, rec.id_proceso, rec.id_unidad_cobro, rec.sides);
  END LOOP;

  -- ── 5. Cotización-side extras: partida_cotizacion_extra -> partida ──
  INSERT INTO partida (id_cotizacion, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones)
  SELECT id_cotizacion, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones
  FROM partida_cotizacion_extra;

  -- ── 6. Pedido-side extras: partida_pedido_extra -> partida ──
  INSERT INTO partida (id_pedido, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones)
  SELECT id_pedido, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones
  FROM partida_pedido_extra;

  -- ── 7. Cotización-side maquila jobs: partida_maquila -> partida (+ procesos) ──
  FOR rec IN SELECT * FROM partida_maquila LOOP
    INSERT INTO partida (id_cotizacion, tipo, descripcion, largo_cm, ancho_cm, metros2, cantidad, subtotal_procesos, subtotal)
    VALUES (rec.id_cotizacion, 'MAQUILA', rec.descripcion, rec.largo_cm, rec.ancho_cm, rec.metros2, rec.cantidad, rec.subtotal_procesos, rec.subtotal_partida)
    RETURNING id_partida INTO new_id;

    INSERT INTO map_maquila VALUES ('partida_maquila', rec.id_partida_maquila, new_id);
  END LOOP;

  FOR rec IN
    SELECT ppm.cantidad_unidades AS cantidad, ppm.precio_unitario, ppm.subtotal, ppm.id_proceso, ppm.id_unidad_cobro,
           m.new_id AS new_padre_id, p.id_cotizacion AS new_id_cotizacion
    FROM proceso_partida_maquila ppm
    JOIN map_maquila m ON m.old_table = 'partida_maquila' AND m.old_id = ppm.id_partida_maquila
    JOIN partida p ON p.id_partida = m.new_id
  LOOP
    INSERT INTO partida (id_cotizacion, id_partida_padre, tipo, cantidad, precio_unitario, subtotal)
    VALUES (rec.new_id_cotizacion, rec.new_padre_id, 'PROCESO', rec.cantidad, rec.precio_unitario, rec.subtotal)
    RETURNING id_partida INTO new_id;

    INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro)
    VALUES (new_id, rec.id_proceso, rec.id_unidad_cobro);
  END LOOP;

  -- ── 8. Pedido-side maquila jobs: partida_pedido_maquila -> partida (+ procesos) ──
  FOR rec IN SELECT * FROM partida_pedido_maquila LOOP
    INSERT INTO partida (id_pedido, tipo, descripcion, largo_cm, ancho_cm, metros2, cantidad, subtotal_procesos, subtotal, estatus_entrega, fecha_entrega_real)
    VALUES (rec.id_pedido, 'MAQUILA', rec.descripcion, rec.largo_cm, rec.ancho_cm, rec.metros2, rec.cantidad, rec.subtotal_procesos, rec.subtotal_partida, rec.estatus_entrega, rec.fecha_entrega_real)
    RETURNING id_partida INTO new_id;

    INSERT INTO map_maquila VALUES ('partida_pedido_maquila', rec.id_partida_ped_maq, new_id);
  END LOOP;

  FOR rec IN
    SELECT pppm.cantidad_unidades AS cantidad, pppm.precio_unitario, pppm.subtotal, pppm.id_proceso, pppm.id_unidad_cobro,
           m.new_id AS new_padre_id, p.id_pedido AS new_id_pedido
    FROM proceso_partida_pedido_maquila pppm
    JOIN map_maquila m ON m.old_table = 'partida_pedido_maquila' AND m.old_id = pppm.id_partida_ped_maq
    JOIN partida p ON p.id_partida = m.new_id
  LOOP
    INSERT INTO partida (id_pedido, id_partida_padre, tipo, cantidad, precio_unitario, subtotal)
    VALUES (rec.new_id_pedido, rec.new_padre_id, 'PROCESO', rec.cantidad, rec.precio_unitario, rec.subtotal)
    RETURNING id_partida INTO new_id;

    INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro)
    VALUES (new_id, rec.id_proceso, rec.id_unidad_cobro);
  END LOOP;

  RAISE NOTICE 'Backfill complete.';
END $$;
