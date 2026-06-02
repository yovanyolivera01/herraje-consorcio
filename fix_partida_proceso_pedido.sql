-- ================================================================
-- FIX: sp_convertir_cotizacion_a_pedido falla con
--      "relation partida_proceso_pedido does not exist"
--      cuando una cotización tiene vidrio + extras (maquila/herraje).
--
-- Causa: la tabla partida_proceso_pedido (snapshot de procesos por
--        partida de pedido) nunca fue creada en la BD.
--
-- Ejecutar en Supabase → SQL Editor → Run
-- ================================================================

-- ── 1. Crear tabla ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partida_proceso_pedido (
  id_partida_proceso_pedido SERIAL          PRIMARY KEY,
  id_partida_pedido         INTEGER         NOT NULL
    REFERENCES partida_pedido(id_partida_pedido) ON DELETE CASCADE,
  id_proceso                INTEGER
    REFERENCES proceso(id_proceso),
  id_unidad_cobro           INTEGER
    REFERENCES unidad_cobro(id_unidad_cobro),
  cantidad_unidades          NUMERIC(12,4)  NOT NULL DEFAULT 0,
  precio_unitario            NUMERIC(12,2)  NOT NULL DEFAULT 0,
  subtotal                   NUMERIC(12,2)  NOT NULL DEFAULT 0,
  created_at                 TIMESTAMPTZ    DEFAULT NOW()
);

-- ── 2. RLS ────────────────────────────────────────────────────────

ALTER TABLE partida_proceso_pedido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_anon" ON partida_proceso_pedido;
CREATE POLICY "allow_all_anon"
  ON partida_proceso_pedido
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

GRANT ALL ON TABLE    partida_proceso_pedido                                TO anon, authenticated;
GRANT ALL ON SEQUENCE partida_proceso_pedido_id_partida_proceso_pedido_seq TO anon, authenticated;

-- ── 3. Actualizar sp_obtener_procesos_pedido ──────────────────────
--    Para que el detalle del pedido muestre los procesos del vidrio.

DROP FUNCTION IF EXISTS sp_obtener_procesos_pedido(INTEGER);

CREATE FUNCTION sp_obtener_procesos_pedido(p_id_pedido INTEGER)
RETURNS TABLE (
  id_partida_pedido  INTEGER,
  proceso            TEXT,
  unidad_cobro       TEXT,
  cantidad_unidades  NUMERIC,
  precio_unitario    NUMERIC,
  subtotal           NUMERIC
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    ppp.id_partida_pedido,
    pr.nombre::TEXT        AS proceso,
    uc.nombre::TEXT        AS unidad_cobro,
    ppp.cantidad_unidades,
    ppp.precio_unitario,
    ppp.subtotal
  FROM partida_proceso_pedido ppp
  LEFT JOIN proceso      pr ON pr.id_proceso      = ppp.id_proceso
  LEFT JOIN unidad_cobro uc ON uc.id_unidad_cobro = ppp.id_unidad_cobro
  WHERE ppp.id_partida_pedido IN (
    SELECT id_partida_pedido FROM partida_pedido WHERE id_pedido = p_id_pedido
  )
  ORDER BY ppp.id_partida_pedido, ppp.id_partida_proceso_pedido;
$$;

GRANT EXECUTE ON FUNCTION sp_obtener_procesos_pedido(INTEGER) TO anon, authenticated;
