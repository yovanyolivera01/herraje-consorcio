-- Catch-up migration: ensures partida_pedido_extra and partida_cotizacion_extra
-- exist with their full current structure, regardless of whether migration 008
-- or any ad-hoc local changes were ever applied to this database.

CREATE TABLE IF NOT EXISTS partida_pedido_extra (
  id_partida_extra     SERIAL PRIMARY KEY,
  id_pedido            INTEGER NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
  tipo                 TEXT    NOT NULL,
  descripcion          TEXT    NOT NULL DEFAULT '',
  unidad               TEXT    NOT NULL DEFAULT 'pza',
  cantidad             NUMERIC NOT NULL DEFAULT 1,
  precio_unitario      NUMERIC NOT NULL DEFAULT 0,
  subtotal             NUMERIC NOT NULL DEFAULT 0,
  id_producto_general  INTEGER,
  notas                TEXT
);

ALTER TABLE partida_pedido_extra
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

CREATE TABLE IF NOT EXISTS partida_cotizacion_extra (
  id_partida_extra     SERIAL PRIMARY KEY,
  id_cotizacion        INTEGER NOT NULL REFERENCES cotizacion(id_cotizacion) ON DELETE CASCADE,
  tipo                 VARCHAR NOT NULL DEFAULT 'MAQUILA',
  descripcion          TEXT    NOT NULL,
  unidad               TEXT    NOT NULL DEFAULT 'pza',
  cantidad             NUMERIC NOT NULL DEFAULT 1,
  precio_unitario      NUMERIC NOT NULL DEFAULT 0,
  subtotal             NUMERIC NOT NULL DEFAULT 0,
  id_producto_general  INTEGER REFERENCES producto_general(id_producto_general),
  notas                TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE partida_cotizacion_extra
  ADD COLUMN IF NOT EXISTS observaciones TEXT;
