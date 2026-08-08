--- in prodution


DROP FUNCTION IF EXISTS public.sp_obtener_partidas_pedido(integer);

CREATE OR REPLACE FUNCTION public.sp_obtener_partidas_pedido(p_id_pedido integer)
 RETURNS TABLE(id_partida_pedido integer, tipo_vidrio text, largo_cm numeric, ancho_cm numeric, cantidad integer, metros_cuadrados numeric, precio_m2 numeric, subtotal_vidrio numeric, subtotal_procesos numeric, total_partida numeric, estatus_entrega text, fecha_entrega_real timestamp with time zone, observaciones text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
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
    pp.fecha_entrega_real,
    pp.observaciones::TEXT  AS observaciones
  FROM partida_pedido pp
  LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pp.id_tipo_vidrio
  WHERE pp.id_pedido = p_id_pedido
  ORDER BY pp.id_partida_pedido;
$function$
