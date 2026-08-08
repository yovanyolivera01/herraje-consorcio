-- Drops the pre-unification partida_* tables now that everything reads
-- and writes through the unified `partida`/`partida_vidrio`/
-- `partida_proceso` structure (025-035). Migration 033 already copied
-- every historical row into the new structure — verified before this
-- migration was written: every partida_pedido row has a matching
-- partida(tipo='VIDRIO') row, and no partida_cotizacion_extra row is
-- missing from the backfill either.
--
-- v_pedidos_por_cobrar depended on partida_pedido_maquila to guess a
-- pedido's tipo — that table has been sitting at 0 rows since the
-- cutover (nothing writes to it anymore), so the view has silently
-- been reporting 'VIDRIO' for every pedido, maquila included. Fixed to
-- read pedido.tipo_pedido directly, which every current code path
-- already sets correctly.
--
-- partida_cotizacion and partida_proceso_legacy are NOT dropped here:
-- auditoria_precio_editado (a real audit trail, not a duplicate-data
-- table) has a foreign key into partida_cotizacion, and
-- partida_proceso_legacy has its own FK back into partida_cotizacion.
-- Leaving both in place rather than touching audit history as a side
-- effect of a schema cleanup.

CREATE OR REPLACE VIEW v_pedidos_por_cobrar AS
SELECT
  p.id_pedido,
  p.folio,
  p.fecha_creacion,
  COALESCE(c.nombre, 'Mostrador') AS cliente,
  p.total,
  p.monto_anticipo,
  p.total - p.monto_anticipo AS saldo,
  p.estatus,
  p.tipo_pedido::text AS tipo
FROM pedido p
LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
WHERE p.tipo_pago = 'POR COBRAR';

-- Child tables (FK to partida_pedido/partida_maquila) first.
DROP TABLE IF EXISTS partida_proceso_pedido;
DROP TABLE IF EXISTS proceso_partida_pedido;
DROP TABLE IF EXISTS proceso_partida_maquila;
DROP TABLE IF EXISTS proceso_partida_pedido_maquila;
DROP TABLE IF EXISTS partida_pedido_maquila;

DROP TABLE IF EXISTS partida_pedido;
DROP TABLE IF EXISTS partida_pedido_extra;
DROP TABLE IF EXISTS partida_maquila;
DROP TABLE IF EXISTS partida_cotizacion_extra;

-- NOT dropped — see note above:
--   partida_cotizacion (referenced by auditoria_precio_editado)
--   partida_proceso_legacy (FK back into partida_cotizacion)
