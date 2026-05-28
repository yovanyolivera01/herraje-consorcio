-- ================================================================
-- FIX: sp_obtener_partidas_pedido no devuelve partidas de pedidos
--      LIQUIDADO (convertidos directamente como ENTREGADO).
--
-- Causa: la versión anterior filtraba por estatus_entrega = 'PENDIENTE',
--        lo que oculta todas las partidas de un pedido LIQUIDADO.
--
-- Ejecutar en Supabase → SQL Editor → Run
-- ================================================================

DROP FUNCTION IF EXISTS sp_obtener_partidas_pedido(INTEGER);

CREATE FUNCTION sp_obtener_partidas_pedido(p_id_pedido INTEGER)
RETURNS TABLE (
  id_partida_pedido  INTEGER,
  tipo_vidrio        TEXT,
  largo_cm           NUMERIC,
  ancho_cm           NUMERIC,
  cantidad           INTEGER,
  metros_cuadrados   NUMERIC,
  precio_m2          NUMERIC,
  subtotal_vidrio    NUMERIC,
  subtotal_procesos  NUMERIC,
  total_partida      NUMERIC,
  estatus_entrega    TEXT,
  fecha_entrega_real TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    pp.id_partida_pedido,
    tv.clave::TEXT          AS tipo_vidrio,
    pp.largo_cm,
    pp.ancho_cm,
    pp.cantidad,
    pp.metros_cuadrados,
    pp.precio_m2,
    pp.subtotal_vidrio,
    pp.subtotal_procesos,
    pp.total_partida,
    pp.estatus_entrega,
    pp.fecha_entrega_real
  FROM partida_pedido pp
  LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pp.id_tipo_vidrio
  WHERE pp.id_pedido = p_id_pedido
  ORDER BY pp.id_partida_pedido;
$$;
