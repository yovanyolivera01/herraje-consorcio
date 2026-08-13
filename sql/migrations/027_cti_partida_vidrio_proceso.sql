-- Class-table inheritance for tipo='VIDRIO' and tipo='PROCESO'.
--
-- The base `partida` table (025) is a single-table-inheritance design:
-- one row shape for every tipo, with nullable columns for whichever
-- variant doesn't apply. That's fine for MAQUILA/PRODUCTO/EXTRA (still
-- left as-is here), but for VIDRIO/PROCESO we now split their exclusive
-- columns into satellite tables with real NOT NULL constraints, so the
-- database itself rejects a VIDRIO row missing id_tipo_vidrio, or a
-- PROCESO row missing id_proceso — instead of relying on application
-- code to always get it right.
--
-- largo_cm / ancho_cm / metros2 / subtotal_procesos stay on the base
-- table: MAQUILA also uses them, and MAQUILA isn't part of this pass.
--
-- No data migration needed — `partida` is empty at the time of this
-- migration (verified via `SELECT tipo, COUNT(*) FROM partida GROUP BY
-- tipo` returning zero rows).

-- IN PRODUCTION

CREATE TABLE IF NOT EXISTS partida_vidrio (
  id_partida       INTEGER PRIMARY KEY REFERENCES partida(id_partida) ON DELETE CASCADE,
  id_tipo_vidrio   INTEGER NOT NULL REFERENCES tipo_vidrio(id_tipo_vidrio),
  precio_m2        NUMERIC NOT NULL,
  es_hoja_completa BOOLEAN NOT NULL DEFAULT FALSE,
  subtotal_vidrio  NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS partida_proceso (
  id_partida      INTEGER PRIMARY KEY REFERENCES partida(id_partida) ON DELETE CASCADE,
  id_proceso      INTEGER NOT NULL REFERENCES proceso(id_proceso),
  id_unidad_cobro INTEGER NOT NULL REFERENCES unidad_cobro(id_unidad_cobro),
  sides           JSONB
);

ALTER TABLE partida
  DROP COLUMN IF EXISTS id_tipo_vidrio,
  DROP COLUMN IF EXISTS precio_m2,
  DROP COLUMN IF EXISTS es_hoja_completa,
  DROP COLUMN IF EXISTS subtotal_vidrio,
  DROP COLUMN IF EXISTS id_proceso,
  DROP COLUMN IF EXISTS id_unidad_cobro,
  DROP COLUMN IF EXISTS sides;
