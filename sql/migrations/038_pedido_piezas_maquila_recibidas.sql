-- Stores the total MAQUILA pieces received on a pedido directly on the
-- pedido row, same pattern as pedido.total (a stored sum, not
-- recomputed from partidas on every read). Populated by every SP that
-- creates or converts a pedido with MAQUILA content:
-- sp_crear_pedido_directo, sp_convertir_cotizacion_a_pedido,
-- sp_convertir_maquila_a_pedido.

ALTER TABLE pedido ADD COLUMN piezas_maquila_recibidas NUMERIC NOT NULL DEFAULT 0;
