-- Denormalized `es_maquila` flag directly on `partida`, so you can tell
-- whether a row IS a real maquila job (not just an extra maquila charge)
-- without checking tipo + largo_cm every time — and since id_pedido /
-- id_cotizacion already live on this same row, it relates to pedido with
-- no join at all: WHERE id_pedido = X AND es_maquila = true.
--
-- Same safety approach as partida_proceso.es_maquila (031): a trigger
-- derives the value from the row's own tipo/largo_cm, so application
-- code never sets it and it can't drift out of sync.
--
-- Rule: es_maquila = true only for a REAL maquila job (tipo='MAQUILA'
-- AND largo_cm IS NOT NULL) — NOT for a flat "extra maquila charge"
-- line item (tipo='MAQUILA' but no dimensions), since those never
-- represent a client-supplied physical piece.

-- IN PRODUCTION

ALTER TABLE partida ADD COLUMN es_maquila BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION trg_partida_set_es_maquila() RETURNS TRIGGER AS $$
BEGIN
  NEW.es_maquila := (NEW.tipo = 'MAQUILA' AND NEW.largo_cm IS NOT NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_es_maquila
BEFORE INSERT OR UPDATE ON partida
FOR EACH ROW EXECUTE FUNCTION trg_partida_set_es_maquila();
