-- ══════════════════════════════════════════════════════════════════════════
--  Migración: partida_cotizacion_extra
--  Líneas adicionales en cotización (maquila, herraje, productos generales)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS partida_cotizacion_extra (
  id_partida_extra     SERIAL PRIMARY KEY,
  id_cotizacion        INTEGER NOT NULL REFERENCES cotizacion(id_cotizacion) ON DELETE CASCADE,
  tipo                 TEXT NOT NULL,        -- MAQUILA | HERRAJE | PRODUCTO
  descripcion          TEXT,
  unidad               TEXT DEFAULT 'pza',
  cantidad             NUMERIC(10,4) NOT NULL DEFAULT 1,
  precio_unitario      NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal             NUMERIC(12,2) NOT NULL DEFAULT 0,
  id_producto_general  INTEGER REFERENCES productos(id),
  notas                TEXT
);

CREATE INDEX IF NOT EXISTS idx_partida_extra_cotizacion ON partida_cotizacion_extra(id_cotizacion);
