-- ══════════════════════════════════════════════════════════════════════════
--  TABLA DE AUDITORÍA: pedidod
--  Una fila por artículo/partida dentro de cada pedido.
--  Permite auditar todo lo vendido agrupando por id_pedido / folio_pedido.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pedidod (

  id_pedidod          BIGSERIAL        PRIMARY KEY,

  -- Referencia al pedido
  id_pedido           INTEGER          NOT NULL,
  folio_pedido        TEXT             NOT NULL,
  tipo_pedido         TEXT,
  fecha_pedido        TIMESTAMPTZ,
  fecha_entrega       TIMESTAMPTZ,
  estatus_pedido      TEXT,

  -- Origen: cotización (NULL si fue pedido directo)
  id_cotizacion       INTEGER,
  folio_cotizacion    TEXT,

  -- Cliente y precio
  id_cliente          INTEGER,
  cliente_nombre      TEXT             NOT NULL DEFAULT 'Mostrador',
  nivel_precio        TEXT,
  tipo_pago           TEXT,
  anticipo            NUMERIC(12,2)    NOT NULL DEFAULT 0,
  total_pedido        NUMERIC(12,2)    NOT NULL DEFAULT 0,

  -- Línea de detalle
  num_linea           SMALLINT         NOT NULL,
  tipo_partida        TEXT             NOT NULL,   -- VIDRIO | MAQUILA | HERRAJE | PRODUCTO
  descripcion         TEXT,

  -- Campos de vidrio (NULL para otros tipos)
  clave_vidrio        TEXT,
  largo_cm            NUMERIC(10,4),
  ancho_cm            NUMERIC(10,4),
  cantidad            NUMERIC(10,4)    NOT NULL DEFAULT 1,
  metros2             NUMERIC(12,6),
  precio_m2           NUMERIC(12,4),
  subtotal_vidrio     NUMERIC(12,2),
  subtotal_procesos   NUMERIC(12,2),

  -- Campos compartidos herraje / maquila / vidrio
  unidad              TEXT,
  precio_unitario     NUMERIC(12,4),
  subtotal            NUMERIC(12,2)    NOT NULL DEFAULT 0,

  -- Auditoría
  insertado_en        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_pedidod_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pedidod_id_pedido     ON pedidod(id_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidod_folio         ON pedidod(folio_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidod_id_cotizacion ON pedidod(id_cotizacion);
CREATE INDEX IF NOT EXISTS idx_pedidod_id_cliente    ON pedidod(id_cliente);
CREATE INDEX IF NOT EXISTS idx_pedidod_fecha         ON pedidod(fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidod_tipo_partida  ON pedidod(tipo_partida);


-- ══════════════════════════════════════════════════════════════════════════
--  SP: sp_insertar_pedidod(p_id_pedido)
--
--  Vacía y reconstruye las filas de auditoría para el pedido dado.
--  Maneja los tres tipos: VIDRIO, HERRAJE y MAQUILA.
--  Es idempotente: puedes llamarlo varias veces sin duplicar datos.
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sp_insertar_pedidod(p_id_pedido INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ped         RECORD;
  v_partida     RECORD;
  v_extra       RECORD;
  v_linea       SMALLINT := 0;
BEGIN

  -- 1. Leer cabecera del pedido
  SELECT
    p.id_pedido,
    p.folio,
    p.tipo_pedido,
    p.fecha_creacion,
    p.fecha_entrega,
    p.estatus,
    p.id_cotizacion,
    p.id_cliente,
    p.tipo_pago,
    COALESCE(p.monto_anticipo, 0)   AS anticipo,
    COALESCE(p.total, 0)            AS total,
    COALESCE(c.nombre, 'Mostrador') AS cliente_nombre,
    np.nombre                       AS nivel_nombre,
    co.folio                        AS folio_cotizacion
  INTO v_ped
  FROM pedido p
  LEFT JOIN cliente      c  ON c.id_cliente       = p.id_cliente
  LEFT JOIN nivel_precio np ON np.id_nivel_precio  = p.id_nivel_precio
  LEFT JOIN cotizacion   co ON co.id_cotizacion    = p.id_cotizacion
  WHERE p.id_pedido = p_id_pedido;

  IF NOT FOUND THEN
    RETURN 'ERROR: Pedido ' || p_id_pedido || ' no encontrado';
  END IF;

  -- 2. Borrar registros anteriores (idempotente)
  DELETE FROM pedidod WHERE id_pedido = p_id_pedido;

  -- ────────────────────────────────────────────────────────────────────────
  -- 3a. VIDRIO — partidas de vidrio con sus procesos sumados
  -- ────────────────────────────────────────────────────────────────────────
  FOR v_partida IN
    SELECT
      pp.id_partida_pedido,
      pp.largo_cm,
      pp.ancho_cm,
      COALESCE(pp.cantidad, 1)                                      AS cantidad,
      COALESCE(pp.metros_cuadrados, 0)                              AS metros2,
      COALESCE(pp.precio_m2, 0)                                     AS precio_m2,
      COALESCE(pp.subtotal_vidrio, 0)                               AS subtotal_vidrio,
      COALESCE(pp.subtotal_procesos, 0)                             AS subtotal_procesos,
      COALESCE(pp.total_partida, 0)                                 AS total_partida,
      tv.clave                                                      AS clave_vidrio,
      tv.descripcion                                                AS desc_vidrio
    FROM partida_pedido pp
    LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pp.id_tipo_vidrio
    WHERE pp.id_pedido  = p_id_pedido
      AND pp.tipo_linea = 'VIDRIO'
    ORDER BY pp.id_partida_pedido
  LOOP
    v_linea := v_linea + 1;

    INSERT INTO pedidod (
      id_pedido, folio_pedido, tipo_pedido, fecha_pedido, fecha_entrega, estatus_pedido,
      id_cotizacion, folio_cotizacion,
      id_cliente, cliente_nombre, nivel_precio, tipo_pago, anticipo, total_pedido,
      num_linea, tipo_partida, descripcion,
      clave_vidrio, largo_cm, ancho_cm, cantidad, metros2, precio_m2,
      subtotal_vidrio, subtotal_procesos,
      unidad, precio_unitario, subtotal
    ) VALUES (
      v_ped.id_pedido, v_ped.folio, v_ped.tipo_pedido,
      v_ped.fecha_creacion, v_ped.fecha_entrega, v_ped.estatus,
      v_ped.id_cotizacion, v_ped.folio_cotizacion,
      v_ped.id_cliente, v_ped.cliente_nombre, v_ped.nivel_nombre,
      v_ped.tipo_pago, v_ped.anticipo, v_ped.total,
      v_linea, 'VIDRIO',
      v_partida.clave_vidrio || ' · '
        || v_partida.largo_cm || '×' || v_partida.ancho_cm || ' cm'
        || CASE WHEN v_partida.desc_vidrio IS NOT NULL
                THEN ' (' || v_partida.desc_vidrio || ')' ELSE '' END,
      v_partida.clave_vidrio,
      v_partida.largo_cm, v_partida.ancho_cm,
      v_partida.cantidad, v_partida.metros2, v_partida.precio_m2,
      v_partida.subtotal_vidrio, v_partida.subtotal_procesos,
      'm²', v_partida.precio_m2, v_partida.total_partida
    );
  END LOOP;

  -- ────────────────────────────────────────────────────────────────────────
  -- 3b. HERRAJE — productos de inventario en el pedido
  -- ────────────────────────────────────────────────────────────────────────
  FOR v_partida IN
    SELECT
      pp.id_partida_pedido,
      COALESCE(pp.descripcion, pr.descripcion, pr.marca)  AS descripcion,
      pr.codigo                                           AS codigo_producto,
      COALESCE(pp.cantidad, 1)                            AS cantidad,
      COALESCE(pp.precio_unitario, pr.precio, 0)          AS precio_unitario,
      COALESCE(pp.total_partida, 0)                       AS total_partida
    FROM partida_pedido pp
    LEFT JOIN productos pr ON pr.id = pp.id_producto
    WHERE pp.id_pedido  = p_id_pedido
      AND pp.tipo_linea = 'HERRAJE'
    ORDER BY pp.id_partida_pedido
  LOOP
    v_linea := v_linea + 1;

    INSERT INTO pedidod (
      id_pedido, folio_pedido, tipo_pedido, fecha_pedido, fecha_entrega, estatus_pedido,
      id_cotizacion, folio_cotizacion,
      id_cliente, cliente_nombre, nivel_precio, tipo_pago, anticipo, total_pedido,
      num_linea, tipo_partida, descripcion,
      cantidad, unidad, precio_unitario, subtotal
    ) VALUES (
      v_ped.id_pedido, v_ped.folio, v_ped.tipo_pedido,
      v_ped.fecha_creacion, v_ped.fecha_entrega, v_ped.estatus,
      v_ped.id_cotizacion, v_ped.folio_cotizacion,
      v_ped.id_cliente, v_ped.cliente_nombre, v_ped.nivel_nombre,
      v_ped.tipo_pago, v_ped.anticipo, v_ped.total,
      v_linea, 'HERRAJE', v_partida.descripcion,
      v_partida.cantidad, 'pza', v_partida.precio_unitario, v_partida.total_partida
    );
  END LOOP;

  -- ────────────────────────────────────────────────────────────────────────
  -- 3c. MAQUILA — servicios sin vidrio asociado
  -- ────────────────────────────────────────────────────────────────────────
  FOR v_partida IN
    SELECT
      pp.id_partida_pedido,
      COALESCE(pp.descripcion, proc.nombre)  AS descripcion,
      proc.nombre                            AS nombre_proceso,
      COALESCE(pp.cantidad, 1)               AS cantidad,
      COALESCE(pp.precio_unitario, 0)        AS precio_unitario,
      COALESCE(pp.total_partida, 0)          AS total_partida
    FROM partida_pedido pp
    LEFT JOIN proceso proc ON proc.id_proceso = pp.id_proceso_d
    WHERE pp.id_pedido  = p_id_pedido
      AND pp.tipo_linea = 'MAQUILA'
    ORDER BY pp.id_partida_pedido
  LOOP
    v_linea := v_linea + 1;

    INSERT INTO pedidod (
      id_pedido, folio_pedido, tipo_pedido, fecha_pedido, fecha_entrega, estatus_pedido,
      id_cotizacion, folio_cotizacion,
      id_cliente, cliente_nombre, nivel_precio, tipo_pago, anticipo, total_pedido,
      num_linea, tipo_partida, descripcion,
      cantidad, unidad, precio_unitario, subtotal
    ) VALUES (
      v_ped.id_pedido, v_ped.folio, v_ped.tipo_pedido,
      v_ped.fecha_creacion, v_ped.fecha_entrega, v_ped.estatus,
      v_ped.id_cotizacion, v_ped.folio_cotizacion,
      v_ped.id_cliente, v_ped.cliente_nombre, v_ped.nivel_nombre,
      v_ped.tipo_pago, v_ped.anticipo, v_ped.total,
      v_linea, 'MAQUILA', v_partida.descripcion,
      v_partida.cantidad, 'serv', v_partida.precio_unitario, v_partida.total_partida
    );
  END LOOP;

  -- ────────────────────────────────────────────────────────────────────────
  -- 4. Extras de cotización (MAQUILA / PRODUCTO capturados en cotizacion)
  --    Solo aplica para pedidos que vienen de una cotización previa.
  -- ────────────────────────────────────────────────────────────────────────
  IF v_ped.id_cotizacion IS NOT NULL THEN
    FOR v_extra IN
      SELECT *
      FROM partida_cotizacion_extra
      WHERE id_cotizacion = v_ped.id_cotizacion
      ORDER BY id_partida_extra
    LOOP
      v_linea := v_linea + 1;

      INSERT INTO pedidod (
        id_pedido, folio_pedido, tipo_pedido, fecha_pedido, fecha_entrega, estatus_pedido,
        id_cotizacion, folio_cotizacion,
        id_cliente, cliente_nombre, nivel_precio, tipo_pago, anticipo, total_pedido,
        num_linea, tipo_partida, descripcion,
        cantidad, unidad, precio_unitario, subtotal
      ) VALUES (
        v_ped.id_pedido, v_ped.folio, v_ped.tipo_pedido,
        v_ped.fecha_creacion, v_ped.fecha_entrega, v_ped.estatus,
        v_ped.id_cotizacion, v_ped.folio_cotizacion,
        v_ped.id_cliente, v_ped.cliente_nombre, v_ped.nivel_nombre,
        v_ped.tipo_pago, v_ped.anticipo, v_ped.total,
        v_linea, v_extra.tipo, v_extra.descripcion,
        COALESCE(v_extra.cantidad, 1),
        v_extra.unidad,
        COALESCE(v_extra.precio_unitario, 0),
        COALESCE(v_extra.subtotal, v_extra.cantidad * v_extra.precio_unitario, 0)
      );
    END LOOP;
  END IF;

  RETURN 'OK: ' || v_linea || ' líneas insertadas para pedido ' || v_ped.folio;

EXCEPTION WHEN OTHERS THEN
  RETURN 'ERROR: ' || SQLERRM;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════
--  SP auxiliar: sp_insertar_pedidod_todos
--  Reconstruye pedidod para TODOS los pedidos existentes (carga inicial).
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sp_insertar_pedidod_todos()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id     INTEGER;
  v_count  INTEGER := 0;
  v_errors INTEGER := 0;
  v_result TEXT;
BEGIN
  FOR v_id IN SELECT id_pedido FROM pedido ORDER BY id_pedido LOOP
    v_result := sp_insertar_pedidod(v_id);
    IF v_result LIKE 'ERROR%' THEN
      v_errors := v_errors + 1;
    ELSE
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN 'OK: ' || v_count || ' pedidos procesados, ' || v_errors || ' errores';
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════
--  Carga inicial: llena pedidod con todos los pedidos existentes
--  Ejecutar UNA SOLA VEZ después de crear la tabla y los SPs
-- ══════════════════════════════════════════════════════════════════════════

SELECT sp_insertar_pedidod_todos();
