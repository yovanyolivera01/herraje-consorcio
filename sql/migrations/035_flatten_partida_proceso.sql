-- Collapses the tipo='PROCESO' phantom-row pattern into a single
-- partida_proceso row per process charge — altering the existing
-- partida_proceso table in place instead of swapping in a new one.
--
-- Before: a process charge was TWO rows — a tipo='PROCESO' row in
-- `partida` (id_partida_padre -> the VIDRIO/MAQUILA piece; cantidad/
-- precio_unitario/subtotal; every other column NULL, since a process
-- has no dimensions of its own) plus a row in `partida_proceso`
-- (id_partida -> that phantom row; id_proceso/id_unidad_cobro/sides).
--
-- This was needless indirection: nothing outside partida_proceso
-- itself ever needed the phantom row to exist as a `partida` row —
-- it existed only to give the process charge an id_partida to hang
-- id_proceso/id_unidad_cobro off of.
--
-- After: ONE row in `partida_proceso`, with its own id_partida_proceso
-- identity, cantidad/precio_unitario/subtotal alongside id_proceso/
-- id_unidad_cobro/sides, and id_partida pointing straight at the real
-- VIDRIO/MAQUILA piece (same column name as partida_vidrio.id_partida
-- uses for its own piece — just no longer unique here, since one piece
-- can have several processes). No more tipo='PROCESO' rows in
-- `partida` at all.

-- 1. Add the new columns. id_partida_nuevo is temporary — the table
--    already has an `id_partida` column (the old 1:1 FK to the
--    phantom row), so the real parent-piece pointer is added under a
--    placeholder name and swapped in once the old column is gone.
ALTER TABLE partida_proceso
  ADD COLUMN id_partida_proceso SERIAL,
  ADD COLUMN id_partida_nuevo   INTEGER,
  ADD COLUMN cantidad           NUMERIC,
  ADD COLUMN precio_unitario    NUMERIC,
  ADD COLUMN subtotal           NUMERIC;

-- 2. Backfill from the phantom partida row each existing row still
--    points at via the old id_partida.
UPDATE partida_proceso pp
SET id_partida_nuevo = fantasma.id_partida_padre,
    cantidad         = fantasma.cantidad,
    precio_unitario  = fantasma.precio_unitario,
    subtotal         = fantasma.subtotal
FROM partida fantasma
WHERE fantasma.id_partida = pp.id_partida;

-- 3. Drop the old identity (a plain 1:1 FK to the phantom row), then
--    promote the placeholder to the real `id_partida` name.
ALTER TABLE partida_proceso DROP CONSTRAINT partida_proceso_pkey;
ALTER TABLE partida_proceso DROP COLUMN id_partida;
ALTER TABLE partida_proceso RENAME COLUMN id_partida_nuevo TO id_partida;

-- 4. Now that every row has real values, enforce it.
ALTER TABLE partida_proceso
  ALTER COLUMN id_partida       SET NOT NULL,
  ALTER COLUMN cantidad         SET NOT NULL,
  ALTER COLUMN precio_unitario  SET NOT NULL,
  ALTER COLUMN subtotal         SET NOT NULL;

ALTER TABLE partida_proceso ADD PRIMARY KEY (id_partida_proceso);
ALTER TABLE partida_proceso
  ADD CONSTRAINT partida_proceso_id_partida_fkey
  FOREIGN KEY (id_partida) REFERENCES partida(id_partida) ON DELETE CASCADE;

CREATE INDEX idx_partida_proceso_id_partida ON partida_proceso(id_partida);

-- 5. Phantom rows are no longer needed — the process rows above no
--    longer reference them at all.
DELETE FROM i WHERE tipo = 'PROCESO';

-- 6. tipo='PROCESO' is no longer a valid partida row shape.
ALTER TABLE partida DROP CONSTRAINT partida_tipo_check;
ALTER TABLE partida ADD CONSTRAINT partida_tipo_check
  CHECK (tipo IN ('VIDRIO', 'MAQUILA', 'PRODUCTO', 'EXTRA'));

-- 7. es_maquila trigger (031) no longer needs to look up a phantom
--    partida row first — id_partida points at the real parent now.
CREATE OR REPLACE FUNCTION trg_partida_proceso_set_es_maquila() RETURNS TRIGGER AS $$
DECLARE
  v_tipo_padre VARCHAR;
BEGIN
  SELECT tipo INTO v_tipo_padre FROM partida WHERE id_partida = NEW.id_partida;

  IF v_tipo_padre IS NULL THEN
    RAISE EXCEPTION 'partida_proceso.id_partida=% has no matching partida row', NEW.id_partida;
  END IF;

  NEW.es_maquila := (v_tipo_padre = 'MAQUILA');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
