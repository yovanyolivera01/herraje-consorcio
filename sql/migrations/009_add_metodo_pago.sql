-- Migration 009: Create metodo_pago table and add column to pedido

CREATE TABLE IF NOT EXISTS metodo_pago (
  id_metodo_pago SERIAL PRIMARY KEY,
  descripcion    TEXT NOT NULL UNIQUE,
  activo         BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO metodo_pago (descripcion) VALUES
  ('EFECTIVO'),
  ('TRANSFERENCIA'),
  ('TARJETA')
ON CONFLICT (descripcion) DO NOTHING;

ALTER TABLE pedido
  ADD COLUMN IF NOT EXISTS metodo_pago TEXT;
