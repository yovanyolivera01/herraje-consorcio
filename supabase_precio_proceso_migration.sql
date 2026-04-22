-- ── Migración: precios de proceso por nivel de cliente y espesor ─────────
-- Ejecutar en Supabase > SQL Editor

-- Opción A: tabla aún NO creada (primera vez)
CREATE TABLE IF NOT EXISTS precio_proceso (
  id_precio_proceso SERIAL PRIMARY KEY,
  id_proceso        INTEGER NOT NULL REFERENCES proceso(id_proceso)          ON DELETE CASCADE,
  id_nivel_precio   INTEGER NOT NULL REFERENCES nivel_precio(id_nivel_precio) ON DELETE CASCADE,
  id_espesor        INTEGER NOT NULL REFERENCES espesor(id_espesor)           ON DELETE CASCADE,
  precio_unitario   NUMERIC(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT precio_proceso_unico UNIQUE (id_proceso, id_nivel_precio, id_espesor)
);

-- Opción B: si ya ejecutaste la migración anterior (sin id_espesor), usa esto en su lugar:
-- ALTER TABLE precio_proceso ADD COLUMN id_espesor INTEGER NOT NULL REFERENCES espesor(id_espesor) ON DELETE CASCADE;
-- ALTER TABLE precio_proceso DROP CONSTRAINT precio_proceso_unico;
-- ALTER TABLE precio_proceso ADD CONSTRAINT precio_proceso_unico UNIQUE (id_proceso, id_nivel_precio, id_espesor);
