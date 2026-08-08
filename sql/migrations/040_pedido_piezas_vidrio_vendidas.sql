-- Same treatment as piezas_maquila_recibidas (038): stores the total
-- VIDRIO pieces sold directly on the pedido row instead of deriving it
-- from partidas on every read.

ALTER TABLE pedido ADD COLUMN piezas_vidrio_vendidas NUMERIC NOT NULL DEFAULT 0;
