-- partida (VIDRIO/MAQUILA) only stored metros2 as the TOTAL for the whole
-- partida (piezas × m² de una pieza) — no m² for just one piece, parallel
-- to how precio_vidrio (041) and precio_por_pieza (043) already store the
-- per-piece money value. Adding the per-piece area here.
-- IN PRODUCTION

ALTER TABLE partida ADD COLUMN metros2_pieza NUMERIC;

UPDATE partida
SET metros2_pieza = ROUND(metros2 / NULLIF(cantidad, 0), 4)
WHERE metros2 IS NOT NULL;
