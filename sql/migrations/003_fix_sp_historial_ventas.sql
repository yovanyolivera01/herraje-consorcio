-- Migration 003: Fix sp_obtener_historial_ventas to include MAQUILA pedidos
-- Run on: herraje_consorcio (production) and herraje_desarrollo (local)

CREATE OR REPLACE FUNCTION sp_obtener_historial_ventas(
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin    DATE DEFAULT NULL
)
RETURNS TABLE (
  id_pedido            INT,
  folio                TEXT,
  fecha_creacion       TIMESTAMPTZ,
  fecha_entrega        TIMESTAMPTZ,
  cliente              TEXT,
  nivel_precio         TEXT,
  tipo_pago            TEXT,
  monto_anticipo       NUMERIC,
  monto_cobrado_entrega NUMERIC,
  total                NUMERIC,
  total_cobrado        NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id_pedido,
    p.folio::TEXT,
    p.fecha_creacion,
    p.fecha_entrega,
    COALESCE(c.nombre, 'Mostrador')::TEXT                                   AS cliente,
    COALESCE(np.nombre, '')::TEXT                                           AS nivel_precio,
    p.tipo_pago::TEXT,
    COALESCE(p.monto_anticipo, 0),
    p.monto_cobrado_entrega,
    p.total,
    COALESCE(p.monto_anticipo, 0) + COALESCE(p.monto_cobrado_entrega, 0)  AS total_cobrado
  FROM pedido p
  LEFT JOIN cliente     c  ON c.id_cliente      = p.id_cliente
  LEFT JOIN nivel_precio np ON np.id_nivel_precio = p.id_nivel_precio
  WHERE p.tipo_pedido IN ('VIDRIO', 'MAQUILA','HERRAJE')
    AND p.estatus     = 'ENTREGADO'
    AND (p_fecha_inicio IS NULL OR COALESCE(p.fecha_entrega, p.fecha_creacion) >= p_fecha_inicio)
    AND (p_fecha_fin   IS NULL OR COALESCE(p.fecha_entrega, p.fecha_creacion) <= p_fecha_fin)
  ORDER BY COALESCE(p.fecha_entrega, p.fecha_creacion) DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;
