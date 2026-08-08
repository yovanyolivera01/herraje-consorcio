-- sp_obtener_cabecera_pedido wasn't tracked in any prior migration file
-- (created ad-hoc directly against the DB at some point) — redefining
-- it here to also expose pedido.piezas_maquila_recibidas (038) and
-- pedido.piezas_vidrio_vendidas (040).

DROP FUNCTION IF EXISTS public.sp_obtener_cabecera_pedido(integer);

CREATE OR REPLACE FUNCTION public.sp_obtener_cabecera_pedido(p_id_pedido integer)
 RETURNS TABLE(id_pedido integer, id_cotizacion integer, folio text, fecha_creacion timestamp with time zone, fecha_entrega timestamp with time zone, tipo_pago text, total numeric, monto_anticipo numeric, saldo_pendiente numeric, monto_cobrado_entrega numeric, estatus text, cliente text, telefono_cliente text, nivel_precio text, observaciones text, piezas_maquila_recibidas numeric, piezas_vidrio_vendidas numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        p.id_pedido,
        p.id_cotizacion,
        p.folio::TEXT,
        p.fecha_creacion,
        p.fecha_entrega,
        p.tipo_pago::TEXT,
        p.total,
        p.monto_anticipo,
        p.saldo_pendiente,
        p.monto_cobrado_entrega,
        p.estatus::TEXT,
        COALESCE(c.nombre, 'Mostrador')::TEXT  AS cliente,
        c.telefono::TEXT                       AS telefono_cliente,
        np.nombre::TEXT                        AS nivel_precio,
        p.observaciones::TEXT,
        p.piezas_maquila_recibidas,
        p.piezas_vidrio_vendidas
    FROM   pedido p
    LEFT JOIN cliente      c  ON c.id_cliente      = p.id_cliente
    LEFT JOIN nivel_precio np ON np.id_nivel_precio = p.id_nivel_precio
    WHERE  p.id_pedido = p_id_pedido;
END;
$function$;
