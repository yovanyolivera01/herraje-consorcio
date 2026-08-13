-- Returns one row per invoiceable line item (CFDI Concepto candidate) for a pedido.
-- Vidrio pieces fold their attached processes into one subtotal per piece
-- (total_partida already includes subtotal_procesos); extras are already
-- one-row-per-line-item on their own tables.
-- IN PRODUCTION
CREATE OR REPLACE FUNCTION public.sp_getPartidasForFactura(p_id_pedido integer)
 RETURNS TABLE(descripcion text, cantidad numeric, precio_unitario numeric, subtotal numeric)
 LANGUAGE sql
AS $function$
  -- Vidrio pieces
  SELECT
    (COALESCE(tv.clave, '—') || ' ' || pp.largo_cm || '×' || pp.ancho_cm || 'cm')::TEXT AS descripcion,
    pp.cantidad::NUMERIC                                      AS cantidad,
    (pp.total_partida / NULLIF(pp.cantidad, 0))::NUMERIC      AS precio_unitario,
    pp.total_partida::NUMERIC                                 AS subtotal
  FROM partida_pedido pp
  LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pp.id_tipo_vidrio
  WHERE pp.id_pedido = p_id_pedido

  UNION ALL

  -- Maquila / producto / proceso-extra (current active flow)
  SELECT
    descripcion::TEXT,
    cantidad::NUMERIC,
    precio_unitario::NUMERIC,
    subtotal::NUMERIC
  FROM partida_pedido_extra
  WHERE id_pedido = p_id_pedido

  UNION ALL

  -- Older dedicated maquila table (currently unused, kept for completeness)
  SELECT
    descripcion::TEXT,
    cantidad::NUMERIC,
    (subtotal_partida / NULLIF(cantidad, 0))::NUMERIC AS precio_unitario,
    subtotal_partida::NUMERIC                          AS subtotal
  FROM partida_pedido_maquila
  WHERE id_pedido = p_id_pedido;
$function$;
