-- sp_obtener_partidas_pedido ahora regresa es_por_pieza (requiere 053), para
-- que el ticket y la hoja A4 del pedido sepan cuando la partida se vendió
-- POR PIEZA (en ese caso no se imprime c/u ni Total en la línea del vidrio).
-- Cambia el RETURNS TABLE, por eso DROP + CREATE (copia de 028).
-- PENDING IN PRODUCTION

DROP FUNCTION IF EXISTS public.sp_obtener_partidas_pedido(integer);

CREATE OR REPLACE FUNCTION public.sp_obtener_partidas_pedido(p_id_pedido integer)
 RETURNS TABLE(id_partida_pedido integer, tipo_vidrio text, largo_cm numeric, ancho_cm numeric, cantidad integer, metros_cuadrados numeric, precio_m2 numeric, subtotal_vidrio numeric, precio_vidrio numeric, subtotal_procesos numeric, total_partida numeric, estatus_entrega text, fecha_entrega_real timestamp with time zone, observaciones text, es_por_pieza boolean)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    p.id_partida,
    tv.clave::TEXT           AS tipo_vidrio,
    p.largo_cm,
    p.ancho_cm,
    p.cantidad::INT          AS cantidad,
    p.metros2                AS metros_cuadrados,
    pv.precio_m2,
    pv.subtotal_vidrio,
    pv.precio_vidrio,
    p.subtotal_procesos,
    p.subtotal                AS total_partida,
    p.estatus_entrega::TEXT   AS estatus_entrega,
    p.fecha_entrega_real,
    p.observaciones::TEXT     AS observaciones,
    pv.es_por_pieza
  FROM partida p
  JOIN partida_vidrio pv ON pv.id_partida = p.id_partida
  LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pv.id_tipo_vidrio
  WHERE p.id_pedido = p_id_pedido AND p.tipo = 'VIDRIO'
  ORDER BY p.id_partida;
$function$;
