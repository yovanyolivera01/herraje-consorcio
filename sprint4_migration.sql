-- ============================================================
-- Sprint 4: Maquila · Inventario · Productos Generales
-- Ejecutar en Supabase → SQL Editor
-- Es idempotente: se puede volver a ejecutar sin errores.
-- ============================================================

-- ── 1. Columnas nuevas en tablas existentes ──────────────────

ALTER TABLE cotizacion
  ADD COLUMN IF NOT EXISTS tipo_cotizacion TEXT NOT NULL DEFAULT 'VIDRIO'
    CHECK (tipo_cotizacion IN ('VIDRIO','MAQUILA'));

ALTER TABLE pedido
  ADD COLUMN IF NOT EXISTS tipo_pedido TEXT NOT NULL DEFAULT 'VIDRIO'
    CHECK (tipo_pedido IN ('VIDRIO','MAQUILA'));

-- partida_pedido: columna para entrega por línea (Sprint 4 US-03)
ALTER TABLE partida_pedido
  ADD COLUMN IF NOT EXISTS estatus_entrega TEXT NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estatus_entrega IN ('PENDIENTE','ENTREGADO'));

ALTER TABLE partida_pedido
  ADD COLUMN IF NOT EXISTS fecha_entrega_real TIMESTAMPTZ;

-- precio_proceso: permitir id_espesor NULL para procesos de maquila
ALTER TABLE precio_proceso
  ALTER COLUMN id_espesor DROP NOT NULL;

-- ── 2. Tablas nuevas Sprint 4 ────────────────────────────────

-- Partidas de cotización de maquila
CREATE TABLE IF NOT EXISTS partida_maquila (
  id_partida_maquila SERIAL PRIMARY KEY,
  id_cotizacion      INTEGER NOT NULL REFERENCES cotizacion(id_cotizacion) ON DELETE CASCADE,
  descripcion        TEXT,
  largo_cm           NUMERIC(8,2)  NOT NULL,
  ancho_cm           NUMERIC(8,2)  NOT NULL,
  cantidad           INTEGER       NOT NULL DEFAULT 1,
  metros2            NUMERIC(10,4) NOT NULL,
  subtotal_procesos  NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_partida   NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- Procesos de cada partida de maquila
CREATE TABLE IF NOT EXISTS proceso_partida_maquila (
  id_proceso_pm      SERIAL PRIMARY KEY,
  id_partida_maquila INTEGER NOT NULL REFERENCES partida_maquila(id_partida_maquila) ON DELETE CASCADE,
  id_proceso         INTEGER NOT NULL REFERENCES proceso(id_proceso),
  cantidad_unidades  NUMERIC(10,4) NOT NULL,
  precio_unitario    NUMERIC(10,2) NOT NULL,
  subtotal           NUMERIC(12,2) NOT NULL
);

-- Partidas de pedido de maquila (snapshot al convertir)
CREATE TABLE IF NOT EXISTS partida_pedido_maquila (
  id_partida_ped_maq SERIAL PRIMARY KEY,
  id_pedido          INTEGER NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
  descripcion        TEXT,
  largo_cm           NUMERIC(8,2)  NOT NULL,
  ancho_cm           NUMERIC(8,2)  NOT NULL,
  cantidad           INTEGER       NOT NULL DEFAULT 1,
  metros2            NUMERIC(10,4) NOT NULL,
  subtotal_partida   NUMERIC(12,2) NOT NULL,
  estatus_entrega    TEXT NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estatus_entrega IN ('PENDIENTE','ENTREGADO')),
  fecha_entrega_real TIMESTAMPTZ
);

-- Procesos snapshot por partida de pedido de maquila
CREATE TABLE IF NOT EXISTS proceso_partida_pedido_maquila (
  id                 SERIAL PRIMARY KEY,
  id_partida_ped_maq INTEGER NOT NULL REFERENCES partida_pedido_maquila(id_partida_ped_maq) ON DELETE CASCADE,
  id_proceso         INTEGER NOT NULL REFERENCES proceso(id_proceso),
  cantidad_unidades  NUMERIC(10,4) NOT NULL,
  precio_unitario    NUMERIC(10,2) NOT NULL,
  subtotal           NUMERIC(12,2) NOT NULL
);

-- Inventario de hojas de vidrio
CREATE TABLE IF NOT EXISTS inventario_vidrio (
  id_inventario    SERIAL PRIMARY KEY,
  id_tipo_vidrio   INTEGER NOT NULL REFERENCES tipo_vidrio(id_tipo_vidrio),
  largo_cm         NUMERIC(8,2)  NOT NULL,
  ancho_cm         NUMERIC(8,2)  NOT NULL,
  m2_por_hoja      NUMERIC(10,4) NOT NULL,
  cantidad_hojas   INTEGER       NOT NULL DEFAULT 0,
  m2_disponible    NUMERIC(12,4) NOT NULL DEFAULT 0,
  m2_total_inicial NUMERIC(12,4) NOT NULL DEFAULT 0,
  fecha_registro   TIMESTAMPTZ DEFAULT NOW()
);

-- Movimientos de inventario
CREATE TABLE IF NOT EXISTS movimiento_inventario_vidrio (
  id_movimiento       SERIAL PRIMARY KEY,
  id_inventario       INTEGER NOT NULL REFERENCES inventario_vidrio(id_inventario),
  tipo_movimiento     TEXT NOT NULL CHECK (tipo_movimiento IN ('ENTRADA','SALIDA','AJUSTE')),
  m2_cantidad         NUMERIC(12,4) NOT NULL,
  m2_saldo_resultante NUMERIC(12,4) NOT NULL,
  nota                TEXT,
  fecha               TIMESTAMPTZ DEFAULT NOW()
);

-- Catálogo de productos generales
CREATE TABLE IF NOT EXISTS producto_general (
  id_producto_general SERIAL PRIMARY KEY,
  nombre              TEXT    NOT NULL,
  descripcion         TEXT,
  unidad              TEXT,
  precio              NUMERIC(10,2),
  activo              BOOLEAN DEFAULT true
);

-- ── 3. Vista de inventario ────────────────────────────────────

CREATE OR REPLACE VIEW v_inventario_vidrio AS
SELECT
  iv.id_inventario,
  tv.clave                                                     AS tipo_vidrio,
  (iv.largo_cm::TEXT || 'x' || iv.ancho_cm::TEXT || ' cm')    AS medidas,
  iv.cantidad_hojas,
  iv.m2_por_hoja,
  iv.m2_disponible,
  iv.m2_total_inicial,
  CASE WHEN iv.m2_total_inicial > 0
    THEN ROUND((1.0 - iv.m2_disponible / iv.m2_total_inicial) * 100, 2)
    ELSE 0
  END                                                          AS pct_usado,
  CASE
    WHEN iv.m2_disponible <= 0                                      THEN 'SIN_STOCK'
    WHEN iv.m2_disponible < iv.m2_total_inicial * 0.20              THEN 'STOCK_BAJO'
    ELSE 'OK'
  END                                                          AS alerta_stock
FROM inventario_vidrio iv
JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = iv.id_tipo_vidrio;

-- ── 4. RLS — habilitar y crear políticas permisivas ──────────
-- Patrón: anon + authenticated pueden hacer todo (app interna con auth propia).

DO $$
DECLARE
  tbls TEXT[] := ARRAY[
    -- Tablas pre-Sprint 4
    'tono','espesor','tipo_vidrio','nivel_precio','precio_vidrio',
    'unidad_cobro','proceso','precio_proceso','precio_proceso_especial',
    'cliente','cotizacion','partida_cotizacion','partida_proceso',
    'pedido','partida_pedido','partida_proceso_pedido',
    'empresa','cliente_empresa','precio_empresa','precio_cliente_registrado',
    -- Sprint 4
    'partida_maquila','proceso_partida_maquila',
    'partida_pedido_maquila','proceso_partida_pedido_maquila',
    'inventario_vidrio','movimiento_inventario_vidrio',
    'producto_general'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- Saltar si la tabla no existe aún
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

-- ── 5. Stored Procedures Sprint 4 ────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- Iniciar cotización de maquila
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_iniciar_cotizacion_maquila(
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

-- ─────────────────────────────────────────────────────────────
-- Agregar partida de maquila con procesos
-- p_procesos: JSONB array de [{id_proceso, cantidad?}]
--   • cantidad presente  → se usa como cantidad de unidades (proceso por pza)
--   • cantidad ausente   → SP calcula según unidad de cobro del proceso
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_agregar_partida_maquila(
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
  v_precio_u    NUMERIC;
  v_cantidad_u  NUMERIC;
  v_sub_i       NUMERIC;
BEGIN
  -- Validar cotización
  SELECT id_nivel_precio INTO v_id_nivel
  FROM cotizacion WHERE id_cotizacion = p_id_cotizacion;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0::NUMERIC, 'Error: cotización no encontrada'::TEXT;
    RETURN;
  END IF;

  -- Calcular m²
  v_m2 := ROUND(p_cantidad * (p_largo_cm * p_ancho_cm / 10000.0), 4);

  -- Insertar partida (subtotales se actualizan al final)
  INSERT INTO partida_maquila
    (id_cotizacion, descripcion, largo_cm, ancho_cm, cantidad, metros2, subtotal_procesos, subtotal_partida)
  VALUES
    (p_id_cotizacion, p_descripcion, p_largo_cm, p_ancho_cm, p_cantidad, v_m2, 0, 0)
  RETURNING id_partida_maquila INTO v_id_partida;

  -- Iterar procesos
  FOR v_proc IN SELECT * FROM jsonb_array_elements(p_procesos) LOOP
    v_id_proc := (v_proc->>'id_proceso')::INTEGER;

    -- Unidad de cobro del proceso
    SELECT uc.nombre INTO v_unidad
    FROM proceso pr
    JOIN unidad_cobro uc ON uc.id_unidad_cobro = pr.id_unidad_cobro
    WHERE pr.id_proceso = v_id_proc;

    -- Precio y cantidad según unidad
    IF v_unidad ILIKE 'pza' OR v_unidad ILIKE '%pieza%' THEN
      -- Precio especial por pieza
      SELECT precio_unitario INTO v_precio_u
      FROM precio_proceso_especial
      WHERE id_proceso = v_id_proc AND id_nivel_precio = v_id_nivel;
      v_cantidad_u := COALESCE((v_proc->>'cantidad')::NUMERIC, p_cantidad);
    ELSE
      -- Precio por m²: tomar primer precio para ese proceso+nivel (cualquier espesor)
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
      (id_partida_maquila, id_proceso, cantidad_unidades, precio_unitario, subtotal)
    VALUES
      (v_id_partida, v_id_proc, v_cantidad_u, v_precio_u, v_sub_i);
  END LOOP;

  -- Actualizar subtotales de la partida
  UPDATE partida_maquila
  SET subtotal_procesos = v_sub_proc, subtotal_partida = v_sub_proc
  WHERE id_partida_maquila = v_id_partida;

  -- Actualizar total de la cotización
  UPDATE cotizacion
  SET total = COALESCE(
    (SELECT SUM(subtotal_partida) FROM partida_maquila WHERE id_cotizacion = p_id_cotizacion),
    0
  )
  WHERE id_cotizacion = p_id_cotizacion;

  RETURN QUERY SELECT v_id_partida, v_sub_proc, 'OK'::TEXT;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Eliminar partida de maquila y recalcular total
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_eliminar_partida_maquila(
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
    (SELECT SUM(subtotal_partida) FROM partida_maquila WHERE id_cotizacion = v_id_cot),
    0
  )
  WHERE id_cotizacion = v_id_cot;

  RETURN QUERY SELECT 'OK'::TEXT;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Finalizar cotización de maquila
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_finalizar_cotizacion_maquila(
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

  UPDATE cotizacion
  SET estatus = 'FINALIZADA'
  WHERE id_cotizacion = p_id_cotizacion;

  RETURN QUERY SELECT v_total, 'OK'::TEXT;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Ticket de cotización de maquila (filas planas)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_obtener_ticket_maquila(
  p_id_cotizacion INTEGER
)
RETURNS TABLE (
  folio              TEXT,
  fecha              TIMESTAMPTZ,
  cliente_nombre     TEXT,
  nivel_nombre       TEXT,
  total_cotizacion   NUMERIC,
  id_partida         INTEGER,
  descripcion        TEXT,
  largo_cm           NUMERIC,
  ancho_cm           NUMERIC,
  cantidad           INTEGER,
  metros2            NUMERIC,
  subtotal_partida   NUMERIC,
  id_proceso         INTEGER,
  proceso_nombre     TEXT,
  unidad_cobro_nombre TEXT,
  cantidad_unidades  NUMERIC,
  precio_unitario    NUMERIC,
  subtotal_proceso   NUMERIC
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
  LEFT JOIN cliente cl      ON cl.id_cliente     = c.id_cliente
  LEFT JOIN nivel_precio np ON np.id_nivel_precio = c.id_nivel_precio
  JOIN partida_maquila pm   ON pm.id_cotizacion   = c.id_cotizacion
  LEFT JOIN proceso_partida_maquila ppm ON ppm.id_partida_maquila = pm.id_partida_maquila
  LEFT JOIN proceso pr       ON pr.id_proceso     = ppm.id_proceso
  LEFT JOIN unidad_cobro uc  ON uc.id_unidad_cobro = pr.id_unidad_cobro
  WHERE c.id_cotizacion = p_id_cotizacion
  ORDER BY pm.id_partida_maquila, ppm.id_proceso_pm;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Reabrir cotización (vidrio o maquila)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_reabrir_cotizacion(
  p_id_cotizacion INTEGER
)
RETURNS TABLE (p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cotizacion WHERE id_cotizacion = p_id_cotizacion) THEN
    RETURN QUERY SELECT 'Error: cotización no encontrada'::TEXT;
    RETURN;
  END IF;

  UPDATE cotizacion
  SET estatus = 'BORRADOR'
  WHERE id_cotizacion = p_id_cotizacion AND estatus = 'FINALIZADA';

  RETURN QUERY SELECT 'OK'::TEXT;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Convertir cotización de maquila a pedido
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_convertir_maquila_a_pedido(
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

  IF v_cot.tipo_cotizacion != 'MAQUILA' THEN
    RETURN QUERY SELECT 0, ''::TEXT, 'Error: la cotización no es de tipo MAQUILA'::TEXT;
    RETURN;
  END IF;

  -- Finalizar cotización si está en BORRADOR
  IF v_cot.estatus = 'BORRADOR' THEN
    UPDATE cotizacion SET estatus = 'FINALIZADA' WHERE id_cotizacion = p_id_cotizacion;
  END IF;

  v_saldo := v_cot.total - COALESCE(p_monto_anticipo, 0);

  -- Crear pedido
  INSERT INTO pedido
    (folio, tipo_pedido, id_cliente, id_cotizacion, total, tipo_pago,
     monto_anticipo, saldo_pendiente, estatus, fecha_pedido)
  VALUES
    ('PED-00000', 'MAQUILA', v_cot.id_cliente, p_id_cotizacion, v_cot.total, p_tipo_pago,
     COALESCE(p_monto_anticipo, 0), v_saldo, 'PENDIENTE', NOW())
  RETURNING id_pedido INTO v_id_pedido;

  v_folio_pedido := 'PED-' || LPAD(v_id_pedido::TEXT, 5, '0');
  UPDATE pedido SET folio = v_folio_pedido WHERE id_pedido = v_id_pedido;

  -- Copiar partidas y procesos (snapshot)
  FOR v_partida IN
    SELECT * FROM partida_maquila WHERE id_cotizacion = p_id_cotizacion
  LOOP
    INSERT INTO partida_pedido_maquila
      (id_pedido, descripcion, largo_cm, ancho_cm, cantidad, metros2, subtotal_partida, estatus_entrega)
    VALUES
      (v_id_pedido, v_partida.descripcion, v_partida.largo_cm, v_partida.ancho_cm,
       v_partida.cantidad, v_partida.metros2, v_partida.subtotal_partida, 'PENDIENTE')
    RETURNING id_partida_ped_maq INTO v_id_pp;

    -- Copiar procesos de esta partida
    INSERT INTO proceso_partida_pedido_maquila
      (id_partida_ped_maq, id_proceso, cantidad_unidades, precio_unitario, subtotal)
    SELECT v_id_pp, id_proceso, cantidad_unidades, precio_unitario, subtotal
    FROM proceso_partida_maquila
    WHERE id_partida_maquila = v_partida.id_partida_maquila;
  END LOOP;

  -- Marcar cotización como convertida
  UPDATE cotizacion SET estatus = 'CONVERTIDA' WHERE id_cotizacion = p_id_cotizacion;

  RETURN QUERY SELECT v_id_pedido, v_folio_pedido, 'OK'::TEXT;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Pedidos pendientes (vidrio o maquila) — Sprint 4
-- Sustituye/extiende la versión anterior sin parámetro.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_obtener_pedidos_pendientes(
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
      COALESCE(c.nombre, 'Mostrador')::TEXT                           AS cliente,
      p.total,
      p.monto_anticipo,
      p.saldo_pendiente,
      p.estatus::TEXT,
      COUNT(pp.id_partida_pedido) FILTER (WHERE pp.estatus_entrega = 'PENDIENTE') AS partidas_pendientes,
      COUNT(pp.id_partida_pedido)                                     AS partidas_total
    FROM pedido p
    LEFT JOIN cliente c       ON c.id_cliente = p.id_cliente
    LEFT JOIN partida_pedido pp ON pp.id_pedido = p.id_pedido
    WHERE p.tipo_pedido = 'VIDRIO'
      AND p.estatus NOT IN ('ENTREGADO','CANCELADO')
    GROUP BY p.id_pedido, p.folio, p.fecha_pedido, c.nombre,
             p.total, p.monto_anticipo, p.saldo_pendiente, p.estatus
    ORDER BY p.fecha_pedido DESC;

  ELSE -- MAQUILA
    RETURN QUERY
    SELECT
      p.id_pedido,
      p.folio::TEXT,
      p.fecha_pedido,
      COALESCE(c.nombre, 'Mostrador')::TEXT                                AS cliente,
      p.total,
      p.monto_anticipo,
      p.saldo_pendiente,
      p.estatus::TEXT,
      COUNT(ppm.id_partida_ped_maq) FILTER (WHERE ppm.estatus_entrega = 'PENDIENTE') AS partidas_pendientes,
      COUNT(ppm.id_partida_ped_maq)                                        AS partidas_total
    FROM pedido p
    LEFT JOIN cliente c              ON c.id_cliente = p.id_cliente
    LEFT JOIN partida_pedido_maquila ppm ON ppm.id_pedido = p.id_pedido
    WHERE p.tipo_pedido = 'MAQUILA'
      AND p.estatus NOT IN ('ENTREGADO','CANCELADO')
    GROUP BY p.id_pedido, p.folio, p.fecha_pedido, c.nombre,
             p.total, p.monto_anticipo, p.saldo_pendiente, p.estatus
    ORDER BY p.fecha_pedido DESC;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Marcar anticipo como liquidado (vidrio y maquila)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_marcar_anticipo_liquidado(
  p_id_pedido INTEGER
)
RETURNS TABLE (p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pedido WHERE id_pedido = p_id_pedido) THEN
    RETURN QUERY SELECT 'Error: pedido no encontrado'::TEXT;
    RETURN;
  END IF;

  UPDATE pedido
  SET estatus = 'ANTICIPO_LIQUIDADO'
  WHERE id_pedido = p_id_pedido
    AND estatus IN ('PENDIENTE','PARCIAL');

  RETURN QUERY SELECT 'OK'::TEXT;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Registrar entrada de inventario de vidrio
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_registrar_inventario_vidrio(
  p_id_tipo_vidrio INTEGER,
  p_largo_cm       NUMERIC,
  p_ancho_cm       NUMERIC,
  p_cantidad_hojas INTEGER
)
RETURNS TABLE (p_id_inventario INTEGER, p_m2_total NUMERIC, p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_m2_hoja NUMERIC;
  v_m2_total NUMERIC;
  v_id      INTEGER;
BEGIN
  v_m2_hoja  := ROUND(p_largo_cm * p_ancho_cm / 10000.0, 4);
  v_m2_total := ROUND(v_m2_hoja * p_cantidad_hojas, 4);

  -- Si ya existe un lote con exactamente las mismas medidas, sumar
  SELECT id_inventario INTO v_id
  FROM inventario_vidrio
  WHERE id_tipo_vidrio = p_id_tipo_vidrio
    AND largo_cm = p_largo_cm
    AND ancho_cm = p_ancho_cm
  LIMIT 1;

  IF FOUND THEN
    UPDATE inventario_vidrio
    SET
      cantidad_hojas   = cantidad_hojas   + p_cantidad_hojas,
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

  -- Registrar movimiento de entrada
  INSERT INTO movimiento_inventario_vidrio
    (id_inventario, tipo_movimiento, m2_cantidad, m2_saldo_resultante, nota)
  VALUES
    (v_id, 'ENTRADA', v_m2_total,
     (SELECT m2_disponible FROM inventario_vidrio WHERE id_inventario = v_id),
     'Entrada inicial de ' || p_cantidad_hojas || ' hojas');

  RETURN QUERY SELECT v_id, v_m2_total, 'OK'::TEXT;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Entregar partida de pedido de VIDRIO (Sprint 4 US-03)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_entregar_partida_pedido(
  p_id_partida_pedido INTEGER
)
RETURNS TABLE (p_mensaje TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id_pedido   INTEGER;
  v_total       INTEGER;
  v_entregadas  INTEGER;
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

  -- Recalcular estatus del pedido
  SELECT COUNT(*), COUNT(*) FILTER (WHERE estatus_entrega = 'ENTREGADO')
  INTO v_total, v_entregadas
  FROM partida_pedido WHERE id_pedido = v_id_pedido;

  IF v_entregadas = v_total THEN
    UPDATE pedido SET estatus = 'ENTREGADO', fecha_entrega = NOW() WHERE id_pedido = v_id_pedido;
  ELSIF v_entregadas > 0 THEN
    UPDATE pedido SET estatus = 'PARCIAL' WHERE id_pedido = v_id_pedido;
  END IF;

  RETURN QUERY SELECT 'OK'::TEXT;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Vincular cliente a empresa (SP que ya debería existir)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_vincular_cliente_empresa(
  p_id_cliente  INTEGER,
  p_id_empresa  INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Desactivar vínculo anterior si existe
  UPDATE cliente_empresa
  SET activo = false
  WHERE id_cliente = p_id_cliente AND activo = true;

  -- Insertar nuevo vínculo
  INSERT INTO cliente_empresa (id_cliente, id_empresa, activo)
  VALUES (p_id_cliente, p_id_empresa, true)
  ON CONFLICT (id_cliente, id_empresa) DO UPDATE SET activo = true;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Documento de cotización para empresa (sp_documento_empresa)
-- Retorna filas para el formato de cotización registrada
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_documento_empresa(
  p_id_cotizacion_origen INTEGER
)
RETURNS TABLE (
  id_cotizacion   INTEGER,
  folio           TEXT,
  fecha           TIMESTAMPTZ,
  empresa_nombre  TEXT,
  razon_social    TEXT,
  rfc             TEXT,
  cliente_nombre  TEXT,
  nivel_nombre    TEXT,
  total           NUMERIC,
  estatus         TEXT,
  id_partida      INTEGER,
  tipo_vidrio     TEXT,
  piezas          INTEGER,
  largo_cm        NUMERIC,
  ancho_cm        NUMERIC,
  metros2         NUMERIC,
  precio_m2       NUMERIC,
  subtotal_vidrio NUMERIC,
  subtotal_proc   NUMERIC,
  subtotal_partida NUMERIC,
  procesos_json   JSONB
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id_cotizacion,
    c.folio::TEXT,
    c.fecha,
    COALESCE(emp.nombre, '')::TEXT,
    COALESCE(emp.razon_social, '')::TEXT,
    COALESCE(emp.rfc, '')::TEXT,
    COALESCE(cl.nombre, 'Mostrador')::TEXT,
    np.nombre::TEXT,
    c.total,
    c.estatus::TEXT,
    pc.id_partida,
    tv.clave::TEXT,
    pc.piezas,
    pc.largo_cm,
    pc.ancho_cm,
    pc.metros2,
    pc.precio_m2_aplicado,
    pc.subtotal_vidrio,
    pc.subtotal_procesos,
    pc.subtotal_partida,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'nombre', pr2.nombre,
        'cantidad', ppr.cantidad,
        'precio_unitario', ppr.precio_unitario,
        'subtotal', ppr.subtotal
      ))
      FROM partida_proceso ppr
      JOIN proceso pr2 ON pr2.id_proceso = ppr.id_proceso
      WHERE ppr.id_partida = pc.id_partida),
      '[]'::JSONB
    )
  FROM cotizacion c
  LEFT JOIN cliente cl         ON cl.id_cliente       = c.id_cliente
  LEFT JOIN nivel_precio np    ON np.id_nivel_precio  = c.id_nivel_precio
  LEFT JOIN cliente_empresa ce ON ce.id_cliente       = c.id_cliente AND ce.activo = true
  LEFT JOIN empresa emp        ON emp.id_empresa      = ce.id_empresa
  JOIN partida_cotizacion pc   ON pc.id_cotizacion    = c.id_cotizacion
  LEFT JOIN tipo_vidrio tv     ON tv.id_tipo_vidrio   = pc.id_tipo_vidrio
  WHERE c.id_cotizacion = p_id_cotizacion_origen
  ORDER BY pc.id_partida;
END;
$$;

-- ── Fin de la migración Sprint 4 ─────────────────────────────
-- Verificación rápida: ejecuta esto para confirmar que las tablas tienen políticas RLS:
--
-- SELECT tablename, rowsecurity, (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) AS num_politicas
-- FROM pg_tables t
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
