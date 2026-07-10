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
