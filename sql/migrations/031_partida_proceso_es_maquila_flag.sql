-- Denormalized `es_maquila` flag on partida_proceso, so reads can filter
-- vidrio-attached vs maquila-attached processes without joining back to
-- the parent `partida` row every time.
--
-- To avoid this drifting out of sync with the real parent (the actual
-- source of truth is partida.id_partida_padre -> partida.tipo), the flag
-- is set by a trigger, not by application code. Every insert into
-- partida_proceso automatically looks up its own parent's tipo and
-- stamps es_maquila accordingly — the app can't get it wrong, and
-- doesn't need to know about it at all.
-- IN PRODUCTION

ALTER TABLE partida_proceso ADD COLUMN es_maquila BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION trg_partida_proceso_set_es_maquila() RETURNS TRIGGER AS $$
DECLARE
  v_tipo_padre VARCHAR;
BEGIN
  SELECT padre.tipo INTO v_tipo_padre
  FROM partida hijo
  JOIN partida padre ON padre.id_partida = hijo.id_partida_padre
  WHERE hijo.id_partida = NEW.id_partida;

  IF v_tipo_padre IS NULL THEN
    RAISE EXCEPTION 'partida_proceso.id_partida=% has no parent partida row (id_partida_padre not set) - cannot determine es_maquila', NEW.id_partida;
  END IF;

  NEW.es_maquila := (v_tipo_padre = 'MAQUILA');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_es_maquila
BEFORE INSERT ON partida_proceso
FOR EACH ROW EXECUTE FUNCTION trg_partida_proceso_set_es_maquila();
