-- in production

ALTER TABLE partida_proceso
  ADD COLUMN IF NOT EXISTS sides JSONB;

ALTER TABLE partida_proceso_pedido
  ADD COLUMN IF NOT EXISTS sides JSONB;
