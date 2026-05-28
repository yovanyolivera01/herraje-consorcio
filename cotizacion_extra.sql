-- ================================================================
-- Partidas extra en cotizaciones (maquila + productos generales)
-- Ejecutar en: Supabase → SQL Editor → Run
-- ================================================================

CREATE TABLE IF NOT EXISTS partida_cotizacion_extra (
  id_partida_extra    SERIAL PRIMARY KEY,
  id_cotizacion       INTEGER       NOT NULL REFERENCES cotizacion(id_cotizacion) ON DELETE CASCADE,
  tipo                VARCHAR(20)   NOT NULL DEFAULT 'MAQUILA',  -- MAQUILA | PRODUCTO
  descripcion         TEXT          NOT NULL,
  unidad              TEXT          NOT NULL DEFAULT 'pza',
  cantidad            NUMERIC(12,4) NOT NULL DEFAULT 1,
  precio_unitario     NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal            NUMERIC(12,2) NOT NULL DEFAULT 0,
  id_producto_general INTEGER       REFERENCES producto_general(id_producto_general),
  notas               TEXT,
  created_at          TIMESTAMPTZ   DEFAULT NOW()
);

GRANT ALL ON TABLE    partida_cotizacion_extra                            TO anon, authenticated;
GRANT ALL ON SEQUENCE partida_cotizacion_extra_id_partida_extra_seq      TO anon, authenticated;
