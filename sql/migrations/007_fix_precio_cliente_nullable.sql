-- Allow id_tipo_vidrio to be NULL (process-only prices have no glass type)
ALTER TABLE precio_cliente_registrado ALTER COLUMN id_tipo_vidrio DROP NOT NULL;

-- Drop the old unique constraint (covers all three columns, doesn't handle NULLs well)
ALTER TABLE precio_cliente_registrado
  DROP CONSTRAINT IF EXISTS precio_cliente_registrado_id_cliente_id_tipo_vidrio_id_proc_key;

-- Partial index: glass price only (id_proceso IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS pcr_vidrio_uidx
  ON precio_cliente_registrado (id_cliente, id_tipo_vidrio)
  WHERE id_proceso IS NULL;

-- Partial index: process price only (id_tipo_vidrio IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS pcr_proceso_uidx
  ON precio_cliente_registrado (id_cliente, id_proceso)
  WHERE id_tipo_vidrio IS NULL;

-- Partial index: both glass + process
CREATE UNIQUE INDEX IF NOT EXISTS pcr_ambos_uidx
  ON precio_cliente_registrado (id_cliente, id_tipo_vidrio, id_proceso)
  WHERE id_tipo_vidrio IS NOT NULL AND id_proceso IS NOT NULL;
