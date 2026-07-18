-- SP: sp_insertar_pedidod
-- Description: Inserts a record into pedidod table for a given pedido
-- Used in: backend/routes/pedidos.js
--
-- To get the current code from the DB run:
--   SELECT prosrc FROM pg_proc WHERE proname = 'sp_insertar_pedidod';

CREATE OR REPLACE FUNCTION sp_insertar_pedidod(p_id_pedido INT)
RETURNS VOID AS $$
BEGIN
  -- (paste code from pgAdmin here)
END;
$$ LANGUAGE plpgsql;
