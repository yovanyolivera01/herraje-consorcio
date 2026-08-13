-- Cost of ONE process, allocated per physical piece of the partida it's
-- attached to: subtotal (total cost of this process for the whole
-- partida) ÷ the parent partida's piece count. Different from:
--   partida_proceso.precio_unitario — price per billing unit (m²/ML/pza)
--   partida.precio_unitario         — combined price per piece (glass/
--                                     maquila + ALL its processes together)
-- This is the one missing piece: what THIS process costs per piece.

-- IN PRODUCTION

ALTER TABLE partida_proceso ADD COLUMN precio_por_pieza NUMERIC;

UPDATE partida_proceso pp
SET precio_por_pieza = ROUND(pp.subtotal / NULLIF(p.cantidad, 0), 2)
FROM partida p
WHERE p.id_partida = pp.id_partida;
