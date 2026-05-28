-- ================================================================
-- SPRINT 4 — Backend completo para producción PostgreSQL/Supabase
-- Ejecutar completo en: Supabase → SQL Editor → Run
-- Es idempotente: se puede volver a ejecutar sin errores.
-- ================================================================

-- ── 1. Columnas nuevas en tablas existentes ──────────────────────

ALTER TABLE cotizacion
  ADD COLUMN IF NOT EXISTS tipo_cotizacion TEXT NOT NULL DEFAULT 'VIDRIO'
    CHECK (tipo_cotizacion IN ('VIDRIO','MAQUILA'));

ALTER TABLE pedido
  ADD COLUMN IF NOT EXISTS tipo_pedido TEXT NOT NULL DEFAULT 'VIDRIO'
    CHECK (tipo_pedido IN ('VIDRIO','MAQUILA'));

ALTER TABLE partida_pedido
  ADD COLUMN IF NOT EXISTS estatus_entrega    TEXT NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estatus_entrega IN ('PENDIENTE','ENTREGADO'));

ALTER TABLE partida_pedido
  ADD COLUMN IF NOT EXISTS fecha_entrega_real TIMESTAMPTZ;

ALTER TABLE precio_proceso
  ALTER COLUMN id_espesor DROP NOT NULL;

-- ── 2. RLS — políticas permisivas para todas las tablas ──────────

DO $$
DECLARE
  tbls TEXT[] := ARRAY[
    'tono','espesor','tipo_vidrio','nivel_precio','precio_vidrio',
    'unidad_cobro','proceso','precio_proceso','precio_proceso_especial',
    'cliente','cotizacion','partida_cotizacion','partida_proceso',
    'pedido','partida_pedido','partida_proceso_pedido',
    'empresa','cliente_empresa','precio_empresa','precio_cliente_registrado',
    'partida_maquila','proceso_partida_maquila',
    'partida_pedido_maquila','proceso_partida_pedido_maquila',
    'inventario_vidrio','movimiento_inventario_vidrio',
    'producto_general'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_anon" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "allow_all_anon" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      tbl
    );
  END LOOP;
END $$;

-- ── 3. Helper: eliminar todos los overloads de un SP ─────────────

CREATE OR REPLACE FUNCTION _drop_all_overloads(p_name TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig FROM pg_proc
    WHERE proname = p_name AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END $$;

SELECT _drop_all_overloads('sp_iniciar_cotizacion_maquila');
SELECT _drop_all_overloads('sp_agregar_partida_maquila');
SELECT _drop_all_overloads('sp_eliminar_partida_maquila');
SELECT _drop_all_overloads('sp_finalizar_cotizacion_maquila');
SELECT _drop_all_overloads('sp_obtener_ticket_maquila');
SELECT _drop_all_overloads('sp_reabrir_cotizacion');
SELECT _drop_all_overloads('sp_convertir_maquila_a_pedido');
SELECT _drop_all_overloads('sp_obtener_pedidos_pendientes');
SELECT _drop_all_overloads('sp_marcar_anticipo_liquidado');
SELECT _drop_all_overloads('sp_registrar_inventario_vidrio');
SELECT _drop_all_overloads('sp_entregar_partida_pedido');
SELECT _drop_all_overloads('sp_marcar_pedido_entregado');

DROP FUNCTION IF EXISTS _drop_all_overloads(TEXT);

-- ── 4. SP: Iniciar cotización de maquila ─────────────────────────

CREATE FUNCTION sp_iniciar_cotizacion_maquila(
  p_id_cliente      INTEGER,
  p_id_nivel_precio INTEGER,
  p_observaciones   TEXT DEFAULT NULL
)
RETURNS TABLE (p_id_cotizacion INTEGER, p_folio TEXT, p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id    INTEGER;
  v_folio TEXT;
BEGIN
  INSERT INTO cotizacion
    (folio, tipo_cotizacion, id_cliente, id_nivel_precio, observaciones, total, estatus, fecha)
  VALUES
    ('MAQ-00000', 'MAQUILA', p_id_cliente, p_id_nivel_precio, p_observaciones, 0, 'BORRADOR', NOW())
  RETURNING id_cotizacion INTO v_id;

  v_folio := 'MAQ-' || LPAD(v_id::TEXT, 5, '0');
  UPDATE cotizacion SET folio = v_folio WHERE id_cotizacion = v_id;

  RETURN QUERY SELECT v_id, v_folio, 'OK'::TEXT;
END;
$$;

-- ── 5. SP: Agregar partida de maquila ────────────────────────────
-- NOTA: metros2 es columna GENERADA en partida_maquila — no se inserta.
-- proceso_partida_maquila requiere id_unidad_cobro.

CREATE FUNCTION sp_agregar_partida_maquila(
  p_id_cotizacion INTEGER,
  p_descripcion   TEXT,
  p_largo_cm      NUMERIC,
  p_ancho_cm      NUMERIC,
  p_cantidad      INTEGER,
  p_procesos      JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (p_id_partida INTEGER, p_subtotal NUMERIC, p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
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

  -- Insertar partida (metros2 es columna generada, se omite)
  INSERT INTO partida_maquila
    (id_cotizacion, descripcion, largo_cm, ancho_cm, cantidad, subtotal_procesos, subtotal_partida)
  VALUES
    (p_id_cotizacion, p_descripcion, p_largo_cm, p_ancho_cm, p_cantidad, 0, 0)
  RETURNING id_partida_maquila INTO v_id_partida;

  -- Leer metros2 calculado por la BD
  SELECT metros2 INTO v_m2
  FROM partida_maquila WHERE id_partida_maquila = v_id_partida;

  -- Procesar cada proceso del JSON
  FOR v_proc IN SELECT * FROM jsonb_array_elements(p_procesos) LOOP
    v_id_proc := (v_proc->>'id_proceso')::INTEGER;

    SELECT pr.id_unidad_cobro, uc.nombre
    INTO v_id_unidad, v_unidad
    FROM proceso pr
    JOIN unidad_cobro uc ON uc.id_unidad_cobro = pr.id_unidad_cobro
    WHERE pr.id_proceso = v_id_proc;

    -- Por pieza: precio especial, cantidad = piezas o valor manual
    IF v_unidad ILIKE 'pza' OR v_unidad ILIKE '%pieza%' THEN
      SELECT precio_unitario INTO v_precio_u
      FROM precio_proceso_especial
      WHERE id_proceso = v_id_proc AND id_nivel_precio = v_id_nivel;
      v_cantidad_u := COALESCE((v_proc->>'cantidad')::NUMERIC, p_cantidad);
    -- Por ML: precio_proceso, cantidad = perimetro (piezas × 2 × (largo+ancho) / 100)
    ELSIF lower(v_unidad) LIKE '%ml%' OR lower(v_unidad) LIKE '%metro l%' THEN
      SELECT precio_unitario INTO v_precio_u
      FROM precio_proceso
      WHERE id_proceso = v_id_proc AND id_nivel_precio = v_id_nivel
      LIMIT 1;
      v_cantidad_u := COALESCE((v_proc->>'cantidad')::NUMERIC,
                               p_cantidad * 2 * (p_largo_cm + p_ancho_cm) / 100.0);
    -- Por m²: precio_proceso, cantidad = m²
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

    INSERT INTO proceso_partida_maquila
      (id_partida_maquila, id_proceso, id_unidad_cobro, cantidad_unidades, precio_unitario, subtotal)
    VALUES
      (v_id_partida, v_id_proc, v_id_unidad, v_cantidad_u, v_precio_u, v_sub_i);
  END LOOP;

  UPDATE partida_maquila
  SET subtotal_procesos = v_sub_proc, subtotal_partida = v_sub_proc
  WHERE id_partida_maquila = v_id_partida;

  UPDATE cotizacion
  SET total = COALESCE(
    (SELECT SUM(subtotal_partida) FROM partida_maquila WHERE id_cotizacion = p_id_cotizacion), 0)
  WHERE id_cotizacion = p_id_cotizacion;

  RETURN QUERY SELECT v_id_partida, v_sub_proc, 'OK'::TEXT;
END;
$$;

-- ── 6. SP: Eliminar partida de maquila ───────────────────────────

CREATE FUNCTION sp_eliminar_partida_maquila(
  p_id_partida_maquila INTEGER
)
RETURNS TABLE (p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id_cot INTEGER;
BEGIN
  SELECT id_cotizacion INTO v_id_cot
  FROM partida_maquila WHERE id_partida_maquila = p_id_partida_maquila;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'Partida no encontrada.'::TEXT;
    RETURN;
  END IF;

  DELETE FROM partida_maquila WHERE id_partida_maquila = p_id_partida_maquila;

  UPDATE cotizacion
  SET total = COALESCE(
    (SELECT SUM(subtotal_partida) FROM partida_maquila WHERE id_cotizacion = v_id_cot), 0)
  WHERE id_cotizacion = v_id_cot;

  RETURN QUERY SELECT 'OK'::TEXT;
END;
$$;

-- ── 7. SP: Finalizar cotización de maquila ───────────────────────

CREATE FUNCTION sp_finalizar_cotizacion_maquila(
  p_id_cotizacion INTEGER
)
RETURNS TABLE (p_total NUMERIC, p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT total INTO v_total FROM cotizacion WHERE id_cotizacion = p_id_cotizacion;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 'Error: cotización no encontrada'::TEXT;
    RETURN;
  END IF;

  UPDATE cotizacion SET estatus = 'FINALIZADA'
  WHERE id_cotizacion = p_id_cotizacion;

  RETURN QUERY SELECT v_total, 'OK'::TEXT;
END;
$$;

-- ── 8. SP: Ticket de cotización maquila ──────────────────────────

CREATE FUNCTION sp_obtener_ticket_maquila(
  p_id_cotizacion INTEGER
)
RETURNS TABLE (
  folio                TEXT,
  fecha                TIMESTAMPTZ,
  cliente_nombre       TEXT,
  nivel_nombre         TEXT,
  total_cotizacion     NUMERIC,
  id_partida           INTEGER,
  descripcion          TEXT,
  largo_cm             NUMERIC,
  ancho_cm             NUMERIC,
  cantidad             INTEGER,
  metros2              NUMERIC,
  subtotal_partida     NUMERIC,
  id_proceso           INTEGER,
  proceso_nombre       TEXT,
  unidad_cobro_nombre  TEXT,
  cantidad_unidades    NUMERIC,
  precio_unitario      NUMERIC,
  subtotal_proceso     NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.folio::TEXT,
    c.fecha,
    COALESCE(cl.nombre, 'Mostrador')::TEXT,
    np.nombre::TEXT,
    c.total,
    pm.id_partida_maquila,
    pm.descripcion::TEXT,
    pm.largo_cm,
    pm.ancho_cm,
    pm.cantidad,
    pm.metros2,
    pm.subtotal_partida,
    ppm.id_proceso,
    pr.nombre::TEXT,
    uc.nombre::TEXT,
    ppm.cantidad_unidades,
    ppm.precio_unitario,
    ppm.subtotal
  FROM cotizacion c
  LEFT JOIN cliente cl       ON cl.id_cliente      = c.id_cliente
  LEFT JOIN nivel_precio np  ON np.id_nivel_precio = c.id_nivel_precio
  JOIN  partida_maquila pm   ON pm.id_cotizacion   = c.id_cotizacion
  LEFT JOIN proceso_partida_maquila ppm ON ppm.id_partida_maquila = pm.id_partida_maquila
  LEFT JOIN proceso pr        ON pr.id_proceso      = ppm.id_proceso
  LEFT JOIN unidad_cobro uc   ON uc.id_unidad_cobro = ppm.id_unidad_cobro
  WHERE c.id_cotizacion = p_id_cotizacion
  ORDER BY pm.id_partida_maquila, ppm.id_proceso_pm;
END;
$$;

-- ── 9. SP: Reabrir cotización (vidrio y maquila) ─────────────────

CREATE FUNCTION sp_reabrir_cotizacion(
  p_id_cotizacion INTEGER
)
RETURNS TABLE (p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cotizacion WHERE id_cotizacion = p_id_cotizacion) THEN
    RETURN QUERY SELECT 'Error: cotización no encontrada'::TEXT;
    RETURN;
  END IF;

  UPDATE cotizacion SET estatus = 'BORRADOR'
  WHERE id_cotizacion = p_id_cotizacion AND estatus = 'FINALIZADA';

  RETURN QUERY SELECT 'OK'::TEXT;
END;
$$;

-- ── 10. SP: Convertir cotización maquila a pedido ────────────────
-- NOTA: metros2 también es generada en partida_pedido_maquila — se omite.
-- proceso_partida_pedido_maquila requiere id_unidad_cobro.

CREATE FUNCTION sp_convertir_maquila_a_pedido(
  p_id_cotizacion  INTEGER,
  p_tipo_pago      TEXT,
  p_monto_anticipo NUMERIC
)
RETURNS TABLE (p_id_pedido INTEGER, p_folio_pedido TEXT, p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cot          cotizacion%ROWTYPE;
  v_id_pedido    INTEGER;
  v_folio_pedido TEXT;
  v_saldo        NUMERIC;
  v_partida      partida_maquila%ROWTYPE;
  v_id_pp        INTEGER;
BEGIN
  SELECT * INTO v_cot FROM cotizacion WHERE id_cotizacion = p_id_cotizacion;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, ''::TEXT, 'Error: cotización no encontrada'::TEXT;
    RETURN;
  END IF;

  v_saldo := v_cot.total - COALESCE(p_monto_anticipo, 0);

  INSERT INTO pedido
    (folio, tipo_pedido, id_cliente, id_cotizacion, total, tipo_pago,
     monto_anticipo, saldo_pendiente, estatus, fecha_pedido)
  VALUES
    ('PED-00000', 'MAQUILA', v_cot.id_cliente, p_id_cotizacion, v_cot.total,
     p_tipo_pago, COALESCE(p_monto_anticipo, 0), v_saldo, 'PENDIENTE', NOW())
  RETURNING id_pedido INTO v_id_pedido;

  v_folio_pedido := 'PED-' || LPAD(v_id_pedido::TEXT, 5, '0');
  UPDATE pedido SET folio = v_folio_pedido WHERE id_pedido = v_id_pedido;

  -- Copiar partidas (metros2 es generada, no se inserta)
  FOR v_partida IN
    SELECT * FROM partida_maquila WHERE id_cotizacion = p_id_cotizacion
  LOOP
    INSERT INTO partida_pedido_maquila
      (id_pedido, descripcion, largo_cm, ancho_cm, cantidad,
       subtotal_procesos, subtotal_partida, estatus_entrega)
    VALUES
      (v_id_pedido, v_partida.descripcion, v_partida.largo_cm, v_partida.ancho_cm,
       v_partida.cantidad, v_partida.subtotal_procesos, v_partida.subtotal_partida, 'PENDIENTE')
    RETURNING id_partida_ped_maq INTO v_id_pp;

    -- Copiar procesos snapshot (incluye id_unidad_cobro)
    INSERT INTO proceso_partida_pedido_maquila
      (id_partida_ped_maq, id_proceso, id_unidad_cobro, cantidad_unidades, precio_unitario, subtotal)
    SELECT v_id_pp, id_proceso, id_unidad_cobro, cantidad_unidades, precio_unitario, subtotal
    FROM proceso_partida_maquila
    WHERE id_partida_maquila = v_partida.id_partida_maquila;
  END LOOP;

  UPDATE cotizacion SET estatus = 'CONVERTIDA' WHERE id_cotizacion = p_id_cotizacion;

  RETURN QUERY SELECT v_id_pedido, v_folio_pedido, 'OK'::TEXT;
END;
$$;

-- ── 11. SP: Pedidos pendientes (vidrio y maquila) ────────────────

CREATE FUNCTION sp_obtener_pedidos_pendientes(
  p_tipo_pedido TEXT DEFAULT 'VIDRIO'
)
RETURNS TABLE (
  id_pedido           INTEGER,
  folio               TEXT,
  fecha_pedido        TIMESTAMPTZ,
  cliente             TEXT,
  total               NUMERIC,
  monto_anticipo      NUMERIC,
  saldo_pendiente     NUMERIC,
  estatus             TEXT,
  partidas_pendientes BIGINT,
  partidas_total      BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_tipo_pedido = 'VIDRIO' THEN
    RETURN QUERY
    SELECT
      p.id_pedido,
      p.folio::TEXT,
      p.fecha_pedido,
      COALESCE(c.nombre, 'Mostrador')::TEXT,
      p.total,
      p.monto_anticipo,
      p.saldo_pendiente,
      p.estatus::TEXT,
      COUNT(pp.id_partida_pedido) FILTER (WHERE pp.estatus_entrega = 'PENDIENTE'),
      COUNT(pp.id_partida_pedido)
    FROM pedido p
    LEFT JOIN cliente c          ON c.id_cliente   = p.id_cliente
    LEFT JOIN partida_pedido pp  ON pp.id_pedido   = p.id_pedido
    WHERE p.tipo_pedido = 'VIDRIO'
      AND p.estatus NOT IN ('ENTREGADO','CANCELADO')
    GROUP BY p.id_pedido, p.folio, p.fecha_pedido, c.nombre,
             p.total, p.monto_anticipo, p.saldo_pendiente, p.estatus
    ORDER BY p.fecha_pedido DESC;
  ELSE
    RETURN QUERY
    SELECT
      p.id_pedido,
      p.folio::TEXT,
      p.fecha_pedido,
      COALESCE(c.nombre, 'Mostrador')::TEXT,
      p.total,
      p.monto_anticipo,
      p.saldo_pendiente,
      p.estatus::TEXT,
      COUNT(ppm.id_partida_ped_maq) FILTER (WHERE ppm.estatus_entrega = 'PENDIENTE'),
      COUNT(ppm.id_partida_ped_maq)
    FROM pedido p
    LEFT JOIN cliente c                  ON c.id_cliente  = p.id_cliente
    LEFT JOIN partida_pedido_maquila ppm ON ppm.id_pedido = p.id_pedido
    WHERE p.tipo_pedido = 'MAQUILA'
      AND p.estatus NOT IN ('ENTREGADO','CANCELADO')
    GROUP BY p.id_pedido, p.folio, p.fecha_pedido, c.nombre,
             p.total, p.monto_anticipo, p.saldo_pendiente, p.estatus
    ORDER BY p.fecha_pedido DESC;
  END IF;
END;
$$;

-- ── 12. SP: Marcar anticipo liquidado ────────────────────────────

CREATE FUNCTION sp_marcar_anticipo_liquidado(
  p_id_pedido INTEGER
)
RETURNS TABLE (p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pedido WHERE id_pedido = p_id_pedido) THEN
    RETURN QUERY SELECT 'Error: pedido no encontrado'::TEXT;
    RETURN;
  END IF;

  UPDATE pedido SET estatus = 'ANTICIPO_LIQUIDADO'
  WHERE id_pedido = p_id_pedido AND estatus IN ('PENDIENTE','PARCIAL');

  RETURN QUERY SELECT 'OK'::TEXT;
END;
$$;

-- ── 13. SP: Marcar pedido de vidrio como entregado ───────────────

CREATE FUNCTION sp_marcar_pedido_entregado(
  p_id_pedido     INTEGER,
  p_monto_cobrado NUMERIC
)
RETURNS TABLE (exito BOOLEAN, mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pedido WHERE id_pedido = p_id_pedido) THEN
    RETURN QUERY SELECT false, 'Pedido no encontrado'::TEXT;
    RETURN;
  END IF;

  UPDATE pedido
  SET estatus                 = 'ENTREGADO',
      fecha_entrega           = NOW(),
      monto_cobrado_entrega   = p_monto_cobrado,
      saldo_pendiente         = 0
  WHERE id_pedido = p_id_pedido;

  UPDATE partida_pedido
  SET estatus_entrega = 'ENTREGADO', fecha_entrega_real = NOW()
  WHERE id_pedido = p_id_pedido AND estatus_entrega = 'PENDIENTE';

  RETURN QUERY SELECT true, 'OK'::TEXT;
END;
$$;

-- ── 14. SP: Entregar partida de pedido de vidrio ─────────────────

CREATE FUNCTION sp_entregar_partida_pedido(
  p_id_partida_pedido INTEGER
)
RETURNS TABLE (p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id_pedido  INTEGER;
  v_total      INTEGER;
  v_entregadas INTEGER;
BEGIN
  SELECT id_pedido INTO v_id_pedido
  FROM partida_pedido WHERE id_partida_pedido = p_id_partida_pedido;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'Error: partida no encontrada'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM partida_pedido
    WHERE id_partida_pedido = p_id_partida_pedido AND estatus_entrega = 'ENTREGADO'
  ) THEN
    RETURN QUERY SELECT 'Error: la partida ya está entregada'::TEXT;
    RETURN;
  END IF;

  UPDATE partida_pedido
  SET estatus_entrega = 'ENTREGADO', fecha_entrega_real = NOW()
  WHERE id_partida_pedido = p_id_partida_pedido;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE estatus_entrega = 'ENTREGADO')::INTEGER
  INTO v_total, v_entregadas
  FROM partida_pedido WHERE id_pedido = v_id_pedido;

  IF v_entregadas = v_total THEN
    UPDATE pedido SET estatus = 'ENTREGADO', fecha_entrega = NOW()
    WHERE id_pedido = v_id_pedido;
  ELSIF v_entregadas > 0 THEN
    UPDATE pedido SET estatus = 'PARCIAL'
    WHERE id_pedido = v_id_pedido;
  END IF;

  RETURN QUERY SELECT 'OK'::TEXT;
END;
$$;

-- ── 15. SP: Registrar inventario de vidrio ───────────────────────

CREATE FUNCTION sp_registrar_inventario_vidrio(
  p_id_tipo_vidrio INTEGER,
  p_largo_cm       NUMERIC,
  p_ancho_cm       NUMERIC,
  p_cantidad_hojas INTEGER
)
RETURNS TABLE (p_id_inventario INTEGER, p_m2_total NUMERIC, p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_m2_hoja  NUMERIC;
  v_m2_total NUMERIC;
  v_id       INTEGER;
BEGIN
  v_m2_hoja  := ROUND(p_largo_cm * p_ancho_cm / 10000.0, 4);
  v_m2_total := ROUND(v_m2_hoja * p_cantidad_hojas, 4);

  SELECT id_inventario INTO v_id
  FROM inventario_vidrio
  WHERE id_tipo_vidrio = p_id_tipo_vidrio
    AND largo_cm = p_largo_cm AND ancho_cm = p_ancho_cm
  LIMIT 1;

  IF FOUND THEN
    UPDATE inventario_vidrio
    SET cantidad_hojas   = cantidad_hojas   + p_cantidad_hojas,
        m2_disponible    = m2_disponible    + v_m2_total,
        m2_total_inicial = m2_total_inicial + v_m2_total
    WHERE id_inventario = v_id;
  ELSE
    INSERT INTO inventario_vidrio
      (id_tipo_vidrio, largo_cm, ancho_cm, m2_por_hoja, cantidad_hojas, m2_disponible, m2_total_inicial)
    VALUES
      (p_id_tipo_vidrio, p_largo_cm, p_ancho_cm, v_m2_hoja, p_cantidad_hojas, v_m2_total, v_m2_total)
    RETURNING id_inventario INTO v_id;
  END IF;

  INSERT INTO movimiento_inventario_vidrio
    (id_inventario, tipo_movimiento, m2_cantidad, m2_saldo_resultante, nota)
  VALUES (
    v_id, 'ENTRADA', v_m2_total,
    (SELECT m2_disponible FROM inventario_vidrio WHERE id_inventario = v_id),
    'Entrada: ' || p_cantidad_hojas || ' hojas'
  );

  RETURN QUERY SELECT v_id, v_m2_total, 'OK'::TEXT;
END;
$$;

-- ── 16. Vista de inventario ──────────────────────────────────────

CREATE OR REPLACE VIEW v_inventario_vidrio AS
SELECT
  iv.id_inventario,
  tv.clave                                                  AS tipo_vidrio,
  (iv.largo_cm || 'x' || iv.ancho_cm || ' cm')             AS medidas,
  iv.cantidad_hojas,
  iv.m2_por_hoja,
  iv.m2_disponible,
  iv.m2_total_inicial,
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

-- ── Fin del script ───────────────────────────────────────────────
-- Para verificar que los SPs quedaron correctos:
--
-- SELECT proname, pg_get_function_identity_arguments(oid)
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname LIKE 'sp_%'
-- ORDER BY proname;
