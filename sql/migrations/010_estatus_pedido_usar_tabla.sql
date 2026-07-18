-- Migration 010: Replace estatus_pedido_t ENUM with FK to estado_pedido table
-- Run on herraje_desarrollo FIRST, then on herraje_consorcio (production)
-- Take a backup before running on production:
--   pg_dump -U postgres herraje_consorcio > backup_antes_010.sql

BEGIN;

-- ── Step 1: Update estado_pedido table ───────────────────────────────────────

TRUNCATE TABLE estado_pedido RESTART IDENTITY;

INSERT INTO estado_pedido (descripcion) VALUES
  ('PENDIENTE'),
  ('ENTREGADO'),
  ('ANTICIPO_LIQUIDADO'),
  ('PARCIAL'),
  ('CANCELADO');

-- ── Step 2: Drop ALL views that depend on pedido.estatus (CASCADE) ───────────

DROP VIEW IF EXISTS v_pedidos_pendientes CASCADE;
DROP VIEW IF EXISTS v_pedidos_credito CASCADE;

-- ── Step 3: Change pedido.estatus from ENUM to VARCHAR ───────────────────────

ALTER TABLE pedido
  ALTER COLUMN estatus TYPE VARCHAR(50) USING estatus::TEXT;

-- ── Step 4: Add FK constraint to estado_pedido ───────────────────────────────

ALTER TABLE pedido
  ADD CONSTRAINT fk_pedido_estatus
  FOREIGN KEY (estatus) REFERENCES estado_pedido(descripcion);

-- ── Step 5: Recreate views ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_pedidos_pendientes AS
SELECT
  p.id_pedido,
  p.folio,
  p.tipo_pedido,
  COALESCE(c.nombre, 'Público general') AS cliente,
  p.estatus,
  p.total,
  p.monto_anticipo,
  p.saldo_pendiente,
  p.fecha_creacion AS fecha_pedido
FROM pedido p
LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
WHERE p.estatus = ANY (ARRAY['PENDIENTE', 'ANTICIPO_LIQUIDADO', 'PARCIAL'])
ORDER BY p.tipo_pedido, p.fecha_creacion;

CREATE OR REPLACE VIEW v_pedidos_credito AS
SELECT
  p.id_pedido,
  p.folio,
  p.fecha_creacion,
  COALESCE(c.nombre, 'Mostrador') AS cliente,
  p.total,
  p.monto_anticipo,
  (p.total - p.monto_anticipo) AS saldo,
  p.estatus,
  CASE WHEN EXISTS (
    SELECT 1 FROM partida_pedido_maquila ppm WHERE ppm.id_pedido = p.id_pedido
  ) THEN 'MAQUILA' ELSE 'VIDRIO' END AS tipo
FROM pedido p
LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
WHERE p.tipo_pago = 'CREDITO';

COMMIT;

-- ── Verify ────────────────────────────────────────────────────────────────────
-- SELECT descripcion FROM estado_pedido ORDER BY id_estado;
-- SELECT DISTINCT estatus FROM pedido ORDER BY estatus;
