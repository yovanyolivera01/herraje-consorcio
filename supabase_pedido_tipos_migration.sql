-- ═══════════════════════════════════════════════════════════════════════
-- Migración: partida_pedido soporta VIDRIO, HERRAJE y MAQUILA
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Agregar discriminador de tipo ────────────────────────────────────
ALTER TABLE partida_pedido
  ADD COLUMN IF NOT EXISTS tipo_linea VARCHAR(10) NOT NULL DEFAULT 'VIDRIO';

ALTER TABLE partida_pedido
  DROP CONSTRAINT IF EXISTS partida_pedido_tipo_check;

ALTER TABLE partida_pedido
  ADD CONSTRAINT partida_pedido_tipo_check
    CHECK (tipo_linea IN ('VIDRIO', 'HERRAJE', 'MAQUILA'));

-- ── 2. Hacer nullable las columnas exclusivas de vidrio ─────────────────
--    (las filas de herraje/maquila no las necesitan)
ALTER TABLE partida_pedido
  ALTER COLUMN id_tipo_vidrio   DROP NOT NULL,
  ALTER COLUMN largo_cm         DROP NOT NULL,
  ALTER COLUMN ancho_cm         DROP NOT NULL,
  ALTER COLUMN metros_cuadrados DROP NOT NULL,
  ALTER COLUMN precio_m2        DROP NOT NULL,
  ALTER COLUMN subtotal_vidrio  DROP NOT NULL,
  ALTER COLUMN subtotal_procesos DROP NOT NULL;

-- ── 3. Nuevas columnas para herraje y maquila ───────────────────────────
ALTER TABLE partida_pedido
  ADD COLUMN IF NOT EXISTS id_producto     INT  REFERENCES productos(id),
  ADD COLUMN IF NOT EXISTS id_proceso_d    INT  REFERENCES proceso(id_proceso),
  ADD COLUMN IF NOT EXISTS descripcion     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(10,2);


-- ═══════════════════════════════════════════════════════════════════════
-- SP: sp_crear_pedido_directo  (versión actualizada con los 3 tipos)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sp_crear_pedido_directo(
  p_id_cliente      INT,
  p_id_nivel_precio INT,
  p_tipo_pago       TEXT,
  p_monto_anticipo  NUMERIC,
  p_partidas        JSONB       -- cada elemento debe incluir "tipo_linea": "VIDRIO"|"HERRAJE"|"MAQUILA"
)
RETURNS TABLE(out_id_pedido INT, out_folio TEXT, out_mensaje TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_pedido  INT;
  v_folio      TEXT;
  v_saldo      NUMERIC;
  v_total      NUMERIC := 0;
  v_partida    JSONB;
  v_proceso    JSONB;
  v_id_partida INT;
  v_tipo       TEXT;
BEGIN

  -- Calcular total sumando subtotales
  FOR v_partida IN SELECT * FROM jsonb_array_elements(p_partidas)
  LOOP
    v_total := v_total + (v_partida->>'subtotal_partida')::NUMERIC;
  END LOOP;

  v_saldo := CASE
    WHEN p_tipo_pago = 'LIQUIDADO' THEN 0
    ELSE v_total - p_monto_anticipo
  END;

  -- Insertar cabecera del pedido
  INSERT INTO pedido (
    folio, fecha_creacion, id_cliente, id_nivel_precio, id_cotizacion,
    total, tipo_pago, monto_anticipo, saldo_pendiente, estatus
  ) VALUES (
    'PED-00000', NOW(), p_id_cliente, p_id_nivel_precio, NULL,
    v_total, p_tipo_pago::tipo_pago_t, p_monto_anticipo, v_saldo,
    (CASE WHEN p_tipo_pago = 'LIQUIDADO' THEN 'ENTREGADO' ELSE 'PENDIENTE' END)::estatus_pedido_t
  )
  RETURNING id_pedido INTO v_id_pedido;

  v_folio := 'PED-' || LPAD(v_id_pedido::TEXT, 5, '0');
  UPDATE pedido SET folio = v_folio WHERE id_pedido = v_id_pedido;

  -- ── Insertar cada partida según su tipo ──────────────────────────────
  FOR v_partida IN SELECT * FROM jsonb_array_elements(p_partidas)
  LOOP
    v_tipo := COALESCE(v_partida->>'tipo_linea', 'VIDRIO');

    -- ── VIDRIO ──────────────────────────────────────────────────────────
    IF v_tipo = 'VIDRIO' THEN

      INSERT INTO partida_pedido (
        id_pedido, tipo_linea,
        id_tipo_vidrio, largo_cm, ancho_cm, cantidad,
        metros_cuadrados, precio_m2,
        subtotal_vidrio, subtotal_procesos, total_partida
      ) VALUES (
        v_id_pedido, 'VIDRIO',
        (v_partida->>'id_tipo_vidrio')::INT,
        (v_partida->>'largo_cm')::NUMERIC,
        (v_partida->>'ancho_cm')::NUMERIC,
        (v_partida->>'piezas')::INT,
        (v_partida->>'metros2')::NUMERIC,
        (v_partida->>'precio_m2_aplicado')::NUMERIC,
        (v_partida->>'subtotal_vidrio')::NUMERIC,
        COALESCE((v_partida->>'subtotal_procesos')::NUMERIC, 0),
        (v_partida->>'subtotal_partida')::NUMERIC
      )
      RETURNING id_partida_pedido INTO v_id_partida;

      -- Procesos (maquila) vinculados a la partida de vidrio
      IF jsonb_array_length(COALESCE(v_partida->'procesos', '[]'::JSONB)) > 0 THEN
        FOR v_proceso IN SELECT * FROM jsonb_array_elements(v_partida->'procesos')
        LOOP
          INSERT INTO proceso_partida_pedido (
            id_partida_pedido, id_proceso,
            cantidad_unidades, precio_unitario, subtotal
          ) VALUES (
            v_id_partida,
            (v_proceso->>'id_proceso')::INT,
            (v_proceso->>'cantidad')::NUMERIC,
            (v_proceso->>'precio_unitario')::NUMERIC,
            (v_proceso->>'subtotal')::NUMERIC
          );
        END LOOP;
      END IF;

    -- ── HERRAJE ─────────────────────────────────────────────────────────
    ELSIF v_tipo = 'HERRAJE' THEN

      INSERT INTO partida_pedido (
        id_pedido, tipo_linea,
        id_producto, descripcion,
        cantidad, precio_unitario, total_partida
      ) VALUES (
        v_id_pedido, 'HERRAJE',
        (v_partida->>'id_producto')::INT,
        v_partida->>'descripcion',
        (v_partida->>'cantidad')::INT,
        (v_partida->>'precio_unitario')::NUMERIC,
        (v_partida->>'subtotal_partida')::NUMERIC
      );

    -- ── MAQUILA (servicio sin vidrio asociado) ───────────────────────────
    ELSIF v_tipo = 'MAQUILA' THEN

      INSERT INTO partida_pedido (
        id_pedido, tipo_linea,
        id_proceso_d, descripcion,
        cantidad, precio_unitario, total_partida
      ) VALUES (
        v_id_pedido, 'MAQUILA',
        (v_partida->>'id_proceso')::INT,
        v_partida->>'descripcion',
        (v_partida->>'cantidad')::INT,
        (v_partida->>'precio_unitario')::NUMERIC,
        (v_partida->>'subtotal_partida')::NUMERIC
      );

    END IF;

  END LOOP;

  RETURN QUERY SELECT v_id_pedido, v_folio, 'OK'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::INT, NULL::TEXT, ('ERROR: ' || SQLERRM)::TEXT;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════
-- SP: sp_obtener_partidas_pedido  (devuelve los 3 tipos)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sp_obtener_partidas_pedido(p_id_pedido INT)
RETURNS TABLE(
  id_partida_pedido   INT,
  tipo_linea          TEXT,
  -- VIDRIO
  tipo_vidrio         TEXT,
  largo_cm            NUMERIC,
  ancho_cm            NUMERIC,
  metros_cuadrados    NUMERIC,
  precio_m2           NUMERIC,
  subtotal_vidrio     NUMERIC,
  subtotal_procesos   NUMERIC,
  -- HERRAJE / MAQUILA
  id_producto         INT,
  id_proceso_d        INT,
  descripcion         TEXT,
  precio_unitario     NUMERIC,
  -- COMPARTIDO
  cantidad            INT,
  total_partida       NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id_partida_pedido,
    pp.tipo_linea::TEXT,
    tv.clave,                        -- tipo_vidrio (NULL si no es vidrio)
    pp.largo_cm,
    pp.ancho_cm,
    pp.metros_cuadrados,
    pp.precio_m2,
    pp.subtotal_vidrio,
    pp.subtotal_procesos,
    pp.id_producto,
    pp.id_proceso_d,
    COALESCE(pp.descripcion, pr.nombre, p.descripcion)::TEXT AS descripcion,
    pp.precio_unitario,
    pp.cantidad,
    pp.total_partida
  FROM partida_pedido pp
  LEFT JOIN tipo_vidrio  tv ON tv.id_tipo_vidrio = pp.id_tipo_vidrio
  LEFT JOIN proceso      pr ON pr.id_proceso     = pp.id_proceso_d
  LEFT JOIN productos    p  ON p.id              = pp.id_producto
  WHERE pp.id_pedido = p_id_pedido
  ORDER BY pp.id_partida_pedido;
END;
$$;
