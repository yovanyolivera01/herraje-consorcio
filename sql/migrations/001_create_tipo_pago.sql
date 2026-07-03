-- Migration 001: Create tipo_pago catalog table
-- Run on: herraje_consorcio (production) and herraje_desarrollo (local)

CREATE TABLE IF NOT EXISTS tipo_pago (
  id_tipo_pago SERIAL PRIMARY KEY,
  descripcion  VARCHAR(20) NOT NULL UNIQUE
);

INSERT INTO tipo_pago (descripcion) VALUES
  ('LIQUIDADO'),
  ('ANTICIPO'),
  ('CONTADO'),
  ('CREDITO')
ON CONFLICT (descripcion) DO NOTHING;
