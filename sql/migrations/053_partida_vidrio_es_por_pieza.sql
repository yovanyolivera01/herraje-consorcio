-- partida_vidrio only marked es_hoja_completa (sold as a whole sheet).
-- Adding a flag to know when the glass partida is sold POR PIEZA, so the
-- partida can be validated/priced as a per-piece sale instead of per m².
-- Existing rows default to FALSE (they were all priced per m² or per sheet).
-- PENDING IN PRODUCTION

ALTER TABLE partida_vidrio
  ADD COLUMN IF NOT EXISTS es_por_pieza BOOLEAN NOT NULL DEFAULT FALSE;
