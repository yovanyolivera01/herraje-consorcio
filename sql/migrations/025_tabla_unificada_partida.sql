-- Unified partida table — replaces (eventually):
--   partida_pedido, partida_cotizacion          (VIDRIO)
--   partida_proceso_pedido, partida_proceso     (PROCESO, attached to a VIDRIO row)
--   partida_pedido_extra, partida_cotizacion_extra (MAQUILA / PRODUCTO / EXTRA)
--   partida_pedido_maquila                       (old dedicated maquila, unused)
--
-- This migration only CREATES the new table — it does not migrate existing
-- data or touch any application code yet. Safe to run: purely additive.

CREATE TABLE IF NOT EXISTS partida (
  id_partida          SERIAL PRIMARY KEY,

  -- Exactly one parent document — never both, never neither
  id_cotizacion       INTEGER REFERENCES cotizacion(id_cotizacion) ON DELETE CASCADE,
  id_pedido           INTEGER REFERENCES pedido(id_pedido)         ON DELETE CASCADE,

  -- For tipo='PROCESO': the VIDRIO row this process is attached to.
  -- NULL for every other tipo.
  id_partida_padre    INTEGER REFERENCES partida(id_partida) ON DELETE CASCADE,

  tipo                VARCHAR(20) NOT NULL
                      CHECK (tipo IN ('VIDRIO', 'PROCESO', 'MAQUILA', 'PRODUCTO', 'EXTRA')),

  -- ── Vidrio-specific ───────────────────────────────────────────────
  id_tipo_vidrio      INTEGER REFERENCES tipo_vidrio(id_tipo_vidrio),
  largo_cm            NUMERIC,
  ancho_cm            NUMERIC,
  metros2             NUMERIC,
  precio_m2           NUMERIC,
  es_hoja_completa    BOOLEAN DEFAULT FALSE,
  subtotal_vidrio     NUMERIC,
  subtotal_procesos   NUMERIC,

  -- ── Proceso-specific (tipo='PROCESO') ─────────────────────────────
  id_proceso          INTEGER REFERENCES proceso(id_proceso),
  id_unidad_cobro     INTEGER REFERENCES unidad_cobro(id_unidad_cobro),
  sides               JSONB,

  -- ── Maquila / Producto / Extra-specific ───────────────────────────
  descripcion         TEXT,
  unidad              TEXT DEFAULT 'pza',
  id_producto_general INTEGER REFERENCES producto_general(id_producto_general),
  notas               TEXT,

  -- ── Shared across every tipo ──────────────────────────────────────
  cantidad            NUMERIC NOT NULL DEFAULT 1,
  precio_unitario     NUMERIC,
  subtotal            NUMERIC NOT NULL,
  observaciones       TEXT,

  -- ── Delivery tracking (pedido-side rows only) ─────────────────────
  estatus_entrega     VARCHAR(20) DEFAULT 'PENDIENTE',
  fecha_entrega_real  TIMESTAMPTZ,

  fecha_registro      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_partida_un_solo_padre CHECK (
    (id_cotizacion IS NOT NULL AND id_pedido IS NULL) OR
    (id_cotizacion IS NULL AND id_pedido IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_partida_cotizacion ON partida(id_cotizacion) WHERE id_cotizacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partida_pedido      ON partida(id_pedido)     WHERE id_pedido IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partida_padre        ON partida(id_partida_padre) WHERE id_partida_padre IS NOT NULL;
