-- SP: sp_decrementar_inventario_vidrio
-- Description: Decrements glass inventory when a pedido is confirmed
-- Used in: backend/routes/pedidos.js
--
-- To get the current code from the DB run:
--   SELECT prosrc FROM pg_proc WHERE proname = 'sp_decrementar_inventario_vidrio';

CREATE OR REPLACE FUNCTION sp_decrementar_inventario_vidrio(p_id_cotizacion INT, p_folio VARCHAR)
RETURNS VOID AS $$
BEGIN
  -- (paste code from pgAdmin here)
END;
$$ LANGUAGE plpgsql;
