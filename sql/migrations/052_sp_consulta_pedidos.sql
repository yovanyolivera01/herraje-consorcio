-- Migration 052: sp_consulta_pedidos
-- Todos los pedidos (cualquier tipo: VIDRIO, MAQUILA, HERRAJE; cualquier estatus:
-- PENDIENTE, ENTREGADO, CANCELADO) creados en un rango de fechas.
-- La usa la página "Consulta de pedidos" (GET /api/pedidos/consulta).
-- Las fechas son obligatorias: sin rango no se devuelve nada.

CREATE OR REPLACE FUNCTION sp_consulta_pedidos(
  p_fecha_inicio TIMESTAMPTZ,
  p_fecha_fin    TIMESTAMPTZ
)
RETURNS TABLE (
  id_pedido             INT,
  folio                 TEXT,
  tipo_pedido           TEXT,
  estatus               TEXT,
  fecha_creacion        TIMESTAMPTZ,
  fecha_entrega         TIMESTAMPTZ,
  cliente               TEXT,
  tipo_pago             TEXT,
  monto_anticipo        NUMERIC,
  monto_cobrado_entrega NUMERIC,
  total                 NUMERIC
) AS $$
BEGIN
  IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id_pedido,
    p.folio::TEXT,
    p.tipo_pedido::TEXT,
    p.estatus::TEXT,
    p.fecha_creacion,
    p.fecha_entrega,
    COALESCE(c.nombre, 'Mostrador')::TEXT,
    p.tipo_pago::TEXT,
    COALESCE(p.monto_anticipo, 0),
    p.monto_cobrado_entrega,
    p.total
  FROM pedido p
  LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
  WHERE p.fecha_creacion >= p_fecha_inicio
    AND p.fecha_creacion <= p_fecha_fin
  ORDER BY p.fecha_creacion DESC;
END;
$$ LANGUAGE plpgsql;
