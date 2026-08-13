-- id_partida_padre on `partida` was only ever used by tipo='PROCESO'
-- rows (pointing at the VIDRIO/MAQUILA piece they were attached to).
-- Migration 035 moved PROCESO out of `partida` entirely — process
-- charges live in `partida_proceso` now (its own id_partida FK
-- straight at the piece). Since then, id_partida_padre has been
-- permanently NULL for every remaining row (VIDRIO/MAQUILA/PRODUCTO/
-- EXTRA never set it); every "AND id_partida_padre IS NULL" filter
-- still in the code is checking an always-true condition. Dropping the
-- dead column and those now-meaningless checks.

-- IN PRODUCTION 
ALTER TABLE partida DROP COLUMN id_partida_padre;
