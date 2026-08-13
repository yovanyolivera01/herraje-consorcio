-- partida_vidrio only stored subtotal_vidrio (glass-only total for the
-- whole partida) and precio_m2 (price per m²) — no unit price for just
-- the glass (per piece), parallel to how partida.precio_unitario already
-- stores the combined (glass+procesos) unit price. Adding that here.
-- IN PRODUCTION

ALTER TABLE partida_vidrio ADD COLUMN precio_vidrio NUMERIC;

UPDATE partida_vidrio pv
SET precio_vidrio = ROUND(pv.subtotal_vidrio / NULLIF(p.cantidad, 0), 2)
FROM partida p
WHERE p.id_partida = pv.id_partida;
