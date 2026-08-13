-- Espesor (glass thickness, e.g. "6MM") for a MAQUILA job was only ever
-- kept in frontend local state (espesor_label) before saving — never
-- persisted. It's a property of the piece itself (same espesor applies
-- to every process attached to it), so it belongs on `partida`, same
-- reasoning as largo_cm/ancho_cm living there instead of on
-- partida_proceso.
 -- IN PRODUCTION
ALTER TABLE partida ADD COLUMN id_espesor INTEGER REFERENCES espesor(id_espesor);
