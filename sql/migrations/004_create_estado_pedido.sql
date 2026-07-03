-- Migration 004: Create estado_pedido catalog table
-- Run on: herraje_consorcio (production) and herraje_desarrollo (local)

CREATE TABLE IF NOT EXISTS estado_pedido (
  id_estado   SERIAL PRIMARY KEY,
  descripcion VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO estado_pedido (descripcion) VALUES
  ('PAGADO FALTA ENTREGA'),
  ('ANTICIPO'),
  ('PAGADO Y ENTREGADO'),
  ('CREDITO'),
  ('ANTICIPO PARCIAL')
ON CONFLICT (descripcion) DO NOTHING;
