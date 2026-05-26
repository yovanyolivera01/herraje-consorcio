-- ================================================================
-- FIX: Fechas en SPs usan UTC en lugar de hora de México
-- Causa: ::DATE casteaba timestamptz usando UTC, por lo que pedidos
--        entregados después de las ~7pm México aparecían al día siguiente.
-- Solución: (timestamp AT TIME ZONE 'America/Mexico_City')::DATE
--
-- Ejecutar completo en Supabase → SQL Editor → Run
-- ================================================================

-- ── 1. SP: Historial de ventas (VIDRIO) ───────────────────────────

DROP FUNCTION IF EXISTS sp_obtener_historial_ventas(DATE, DATE);
DROP FUNCTION IF EXISTS sp_obtener_historial_ventas(TEXT, TEXT);

CREATE FUNCTION sp_obtener_historial_ventas(
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin    DATE DEFAULT NULL
)
RETURNS TABLE (
  id_pedido             INTEGER,
  folio                 TEXT,
  fecha_creacion        TIMESTAMPTZ,
  fecha_entrega         TIMESTAMPTZ,
  cliente               TEXT,
  nivel_precio          TEXT,
  tipo_pago             TEXT,
  monto_anticipo        NUMERIC,
  monto_cobrado_entrega NUMERIC,
  total                 NUMERIC,
  total_cobrado         NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id_pedido,
    p.folio::TEXT,
    p.fecha_creacion,
    p.fecha_entrega,
    COALESCE(c.nombre, 'Mostrador')::TEXT                                  AS cliente,
    COALESCE(np.nombre, '')::TEXT                                          AS nivel_precio,
    p.tipo_pago::TEXT,
    COALESCE(p.monto_anticipo, 0),
    p.monto_cobrado_entrega,
    p.total,
    COALESCE(p.monto_anticipo, 0) + COALESCE(p.monto_cobrado_entrega, 0) AS total_cobrado
  FROM pedido p
  LEFT JOIN cliente c       ON c.id_cliente       = p.id_cliente
  LEFT JOIN nivel_precio np ON np.id_nivel_precio = p.id_nivel_precio
  WHERE p.tipo_pedido = 'VIDRIO'
    AND p.estatus     = 'ENTREGADO'
    AND (p_fecha_inicio IS NULL
         OR (COALESCE(p.fecha_entrega, p.fecha_creacion) AT TIME ZONE 'America/Mexico_City')::DATE >= p_fecha_inicio)
    AND (p_fecha_fin   IS NULL
         OR (COALESCE(p.fecha_entrega, p.fecha_creacion) AT TIME ZONE 'America/Mexico_City')::DATE <= p_fecha_fin)
  ORDER BY COALESCE(p.fecha_entrega, p.fecha_creacion) DESC NULLS LAST;
END;
$$;

-- ── 2. SP: Exportar a Excel (ventas VIDRIO) ───────────────────────

DROP FUNCTION IF EXISTS sp_exportar_excel_ventas(DATE, DATE);
DROP FUNCTION IF EXISTS sp_exportar_excel_ventas(TEXT, TEXT);

CREATE FUNCTION sp_exportar_excel_ventas(
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin    DATE DEFAULT NULL
)
RETURNS TABLE (
  "Folio"              TEXT,
  "Fecha entrega"      TEXT,
  "Cliente"            TEXT,
  "Forma de pago"      TEXT,
  "Total pedido"       NUMERIC,
  "Anticipo"           NUMERIC,
  "Cobrado entrega"    NUMERIC,
  "Total cobrado"      NUMERIC,
  "Observaciones"      TEXT,
  "Tipo vidrio"        TEXT,
  "Largo (cm)"         NUMERIC,
  "Ancho (cm)"         NUMERIC,
  "m2"                 NUMERIC,
  "Cantidad"           INTEGER,
  "Precio m2"          NUMERIC,
  "Subtotal vidrio"    NUMERIC,
  "Subtotal procesos"  NUMERIC,
  "Total partida"      NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.folio::TEXT,
    to_char(
      COALESCE(p.fecha_entrega, p.fecha_creacion) AT TIME ZONE 'America/Mexico_City',
      'DD/MM/YYYY'
    ),
    COALESCE(c.nombre, 'Mostrador')::TEXT,
    p.tipo_pago::TEXT,
    p.total,
    COALESCE(p.monto_anticipo, 0),
    COALESCE(p.monto_cobrado_entrega, 0),
    COALESCE(p.monto_anticipo, 0) + COALESCE(p.monto_cobrado_entrega, 0),
    ''::TEXT,
    COALESCE(tv.clave, '—')::TEXT,
    pp.largo_cm,
    pp.ancho_cm,
    pp.metros_cuadrados,
    pp.cantidad,
    pp.precio_m2,
    pp.subtotal_vidrio,
    pp.subtotal_procesos,
    pp.total_partida
  FROM pedido p
  LEFT JOIN cliente c         ON c.id_cliente       = p.id_cliente
  LEFT JOIN partida_pedido pp ON pp.id_pedido        = p.id_pedido
  LEFT JOIN tipo_vidrio tv    ON tv.id_tipo_vidrio   = pp.id_tipo_vidrio
  WHERE p.tipo_pedido = 'VIDRIO'
    AND p.estatus     = 'ENTREGADO'
    AND (p_fecha_inicio IS NULL
         OR (COALESCE(p.fecha_entrega, p.fecha_creacion) AT TIME ZONE 'America/Mexico_City')::DATE >= p_fecha_inicio)
    AND (p_fecha_fin   IS NULL
         OR (COALESCE(p.fecha_entrega, p.fecha_creacion) AT TIME ZONE 'America/Mexico_City')::DATE <= p_fecha_fin)
  ORDER BY COALESCE(p.fecha_entrega, p.fecha_creacion) DESC NULLS LAST, pp.id_partida_pedido;
END;
$$;
