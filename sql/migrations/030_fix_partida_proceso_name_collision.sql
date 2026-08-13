-- 027 used `CREATE TABLE IF NOT EXISTS partida_proceso` for the new
-- CTI satellite table, not realizing a table with that exact name
-- already existed — the legacy proceso table from the pre-unification
-- schema (FK'd to partida_cotizacion, holding real historical rows).
-- Because it already existed, the CREATE was a silent no-op and every
-- subsequent INSERT in 028/029 was writing into the WRONG (legacy)
-- table shape, immediately failing on its NOT NULL cantidad/precio_unitario/
-- subtotal columns.
--
-- Fix: rename the legacy table out of the way (data preserved, not
-- dropped — it's still one of the old tables slated for eventual
-- migration/removal per the broader cutover), then create the actual
-- CTI satellite table under the clean `partida_proceso` name.

-- IN PRODUCTION

ALTER TABLE partida_proceso RENAME TO partida_proceso_legacy;

CREATE TABLE partida_proceso (
  id_partida      INTEGER PRIMARY KEY REFERENCES partida(id_partida) ON DELETE CASCADE,
  id_proceso      INTEGER NOT NULL REFERENCES proceso(id_proceso),
  id_unidad_cobro INTEGER NOT NULL REFERENCES unidad_cobro(id_unidad_cobro),
  sides           JSONB
);
