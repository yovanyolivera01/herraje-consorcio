-- sp_insertar_partida_proceso: inserta un proceso de una partida
-- (antes un INSERT directo en partidaCotizacion.js -> insertProceso).
--
--   p_id_partida : partida a la que pertenece el proceso
--   p_proceso    : JSON con id_proceso, id_unidad_cobro, cantidad,
--                  precio_unitario, subtotal y sidesML (opcional)
--   p_piezas     : piezas de la partida; si viene, precio_por_pieza =
--                  ROUND(subtotal / piezas, 2), si no queda NULL
-- PENDING IN PRODUCTION

CREATE OR REPLACE FUNCTION public.sp_insertar_partida_proceso(
  p_id_partida integer,
  p_proceso    jsonb,
  p_piezas     numeric DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_subtotal NUMERIC := (p_proceso->>'subtotal')::NUMERIC;
BEGIN
  IF p_id_partida IS NULL THEN
    RAISE EXCEPTION 'Falta la partida';
  END IF;

  INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal, sides, precio_por_pieza)
  VALUES (
    p_id_partida,
    (p_proceso->>'id_proceso')::INT,
    (p_proceso->>'id_unidad_cobro')::INT,
    (p_proceso->>'cantidad')::NUMERIC,
    (p_proceso->>'precio_unitario')::NUMERIC,
    v_subtotal,
    NULLIF(p_proceso->'sidesML', 'null'::JSONB),
    CASE WHEN COALESCE(p_piezas, 0) <> 0 THEN ROUND(v_subtotal / p_piezas, 2) END
  );
END;
$function$;
