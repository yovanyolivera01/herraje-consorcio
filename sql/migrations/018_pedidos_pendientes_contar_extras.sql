CREATE OR REPLACE FUNCTION public.sp_obtener_pedidos_pendientes(p_tipo_pedido character varying)
 RETURNS TABLE(id_pedido integer, folio text, tipo_pedido text, cliente text, fecha_pedido timestamp with time zone, total numeric, monto_anticipo numeric, saldo_pendiente numeric, estatus text, partidas_pendientes bigint, partidas_total bigint, tipo_pago text)
 LANGUAGE sql
AS $function$
    SELECT
        p.id_pedido,
        p.folio,
        p.tipo_pedido,
        COALESCE(c.nombre, 'Público general') AS cliente,
        p.fecha_creacion AS fecha_pedido,
        p.total,
        p.monto_anticipo,
        p.saldo_pendiente,
        p.estatus::TEXT AS estatus,
        CASE p.tipo_pedido
            WHEN 'VIDRIO' THEN
                (SELECT COUNT(*) FROM partida_pedido pp
                 WHERE pp.id_pedido = p.id_pedido AND pp.estatus_entrega = 'PENDIENTE')
                +
                (CASE WHEN p.estatus::TEXT = 'PENDIENTE'
                      THEN (SELECT COUNT(*) FROM partida_pedido_extra ppe WHERE ppe.id_pedido = p.id_pedido)
                      ELSE 0 END)
            WHEN 'MAQUILA' THEN
                (SELECT COUNT(*) FROM partida_pedido_maquila ppm
                 WHERE ppm.id_pedido = p.id_pedido AND ppm.estatus_entrega = 'PENDIENTE')
                +
                (CASE WHEN p.estatus::TEXT = 'PENDIENTE'
                      THEN (SELECT COUNT(*) FROM partida_pedido_extra ppe WHERE ppe.id_pedido = p.id_pedido)
                      ELSE 0 END)
            ELSE 0
        END AS partidas_pendientes,
        CASE p.tipo_pedido
            WHEN 'VIDRIO' THEN
                (SELECT COUNT(*) FROM partida_pedido pp WHERE pp.id_pedido = p.id_pedido)
                + (SELECT COUNT(*) FROM partida_pedido_extra ppe WHERE ppe.id_pedido = p.id_pedido)
            WHEN 'MAQUILA' THEN
                (SELECT COUNT(*) FROM partida_pedido_maquila ppm WHERE ppm.id_pedido = p.id_pedido)
                + (SELECT COUNT(*) FROM partida_pedido_extra ppe WHERE ppe.id_pedido = p.id_pedido)
            ELSE 0
        END AS partidas_total,
        p.tipo_pago::TEXT AS tipo_pago
    FROM pedido p
    LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
    WHERE p.estatus::TEXT IN ('PENDIENTE','ANTICIPO_LIQUIDADO','PARCIAL')
      AND (p_tipo_pedido IS NULL OR p.tipo_pedido = p_tipo_pedido)
    ORDER BY p.fecha_creacion ASC;
$function$
