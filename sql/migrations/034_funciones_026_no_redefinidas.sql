-- Recovery file: if 027+ ran before 026 (out of order), 026 fails because
-- it references columns 027 already moved off partida. Of 026's 13
-- functions, 9 get completely redefined later anyway (by 028 for the
-- vidrio/pedido ones, by 029 for the maquila ones) — those don't need
-- 026's version at all. These 4 are the only ones from 026 that are
-- NEVER redefined by any later migration, and none of them reference
-- the columns 027 moved, so they're safe to create standalone, in any
-- order relative to 027-033.
--
-- Use this INSTEAD of 026 when 027+ already ran first. Then continue
-- with 028, 029, 030, 031, 032, 033 as normal.

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
                (SELECT COUNT(*) FROM partida pp
                 WHERE pp.id_pedido = p.id_pedido AND pp.tipo = 'VIDRIO' AND pp.estatus_entrega = 'PENDIENTE')
                +
                (CASE WHEN p.estatus::TEXT = 'PENDIENTE'
                      THEN (SELECT COUNT(*) FROM partida ppe
                            WHERE ppe.id_pedido = p.id_pedido AND ppe.tipo IN ('MAQUILA','PRODUCTO','EXTRA')
                              AND ppe.largo_cm IS NULL)
                      ELSE 0 END)
            WHEN 'MAQUILA' THEN
                (SELECT COUNT(*) FROM partida ppm
                 WHERE ppm.id_pedido = p.id_pedido AND ppm.tipo = 'MAQUILA' AND ppm.largo_cm IS NOT NULL
                   AND ppm.estatus_entrega = 'PENDIENTE')
                +
                (CASE WHEN p.estatus::TEXT = 'PENDIENTE'
                      THEN (SELECT COUNT(*) FROM partida ppe
                            WHERE ppe.id_pedido = p.id_pedido AND ppe.tipo IN ('MAQUILA','PRODUCTO','EXTRA')
                              AND ppe.largo_cm IS NULL)
                      ELSE 0 END)
            ELSE 0
        END AS partidas_pendientes,
        CASE p.tipo_pedido
            WHEN 'VIDRIO' THEN
                (SELECT COUNT(*) FROM partida pp WHERE pp.id_pedido = p.id_pedido AND pp.tipo = 'VIDRIO')
                + (SELECT COUNT(*) FROM partida ppe
                   WHERE ppe.id_pedido = p.id_pedido AND ppe.tipo IN ('MAQUILA','PRODUCTO','EXTRA')
                     AND ppe.largo_cm IS NULL)
            WHEN 'MAQUILA' THEN
                (SELECT COUNT(*) FROM partida ppm WHERE ppm.id_pedido = p.id_pedido AND ppm.tipo = 'MAQUILA' AND ppm.largo_cm IS NOT NULL)
                + (SELECT COUNT(*) FROM partida ppe
                   WHERE ppe.id_pedido = p.id_pedido AND ppe.tipo IN ('MAQUILA','PRODUCTO','EXTRA')
                     AND ppe.largo_cm IS NULL)
            ELSE 0
        END AS partidas_total,
        p.tipo_pago::TEXT AS tipo_pago
    FROM pedido p
    LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
    WHERE p.estatus::TEXT IN ('PENDIENTE','ANTICIPO_LIQUIDADO','PARCIAL')
      AND (p_tipo_pedido IS NULL OR p.tipo_pedido = p_tipo_pedido)
    ORDER BY p.fecha_creacion ASC;
$function$;

CREATE OR REPLACE FUNCTION public.sp_entregar_partida_pedido(p_id_partida_pedido integer, OUT p_mensaje text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_pedido     INT;
    v_total         INT;
    v_entregadas    INT;
BEGIN
    SELECT id_pedido INTO v_id_pedido
    FROM partida
    WHERE id_partida = p_id_partida_pedido
      AND tipo = 'VIDRIO'
      AND estatus_entrega = 'PENDIENTE';

    IF v_id_pedido IS NULL THEN
        p_mensaje := 'Línea no encontrada o ya entregada.';
        RETURN;
    END IF;

    UPDATE partida
    SET estatus_entrega    = 'ENTREGADO',
        fecha_entrega_real = NOW()
    WHERE id_partida = p_id_partida_pedido;

    SELECT COUNT(*)  INTO v_total      FROM partida WHERE id_pedido = v_id_pedido AND tipo = 'VIDRIO';
    SELECT COUNT(*)  INTO v_entregadas FROM partida
    WHERE id_pedido = v_id_pedido AND tipo = 'VIDRIO' AND estatus_entrega = 'ENTREGADO';

    UPDATE pedido
    SET estatus = CASE
            WHEN v_entregadas = v_total THEN 'ENTREGADO'
            WHEN v_entregadas > 0       THEN 'PARCIAL'
            ELSE estatus
        END,
        fecha_entrega = CASE
            WHEN v_entregadas = v_total THEN NOW()
            ELSE fecha_entrega
        END
    WHERE id_pedido = v_id_pedido;

    p_mensaje := 'Partida marcada como entregada. Estatus del pedido actualizado.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.sp_finalizar_cotizacion_maquila(p_id_cotizacion integer, OUT p_total numeric, OUT p_mensaje text)
 RETURNS record
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total NUMERIC(12,2);
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM cotizacion
        WHERE id_cotizacion = p_id_cotizacion
          AND estatus = 'BORRADOR'
          AND tipo_cotizacion = 'MAQUILA'
    ) THEN
        p_total   := 0;
        p_mensaje := 'Cotización no encontrada o no está en borrador.';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM partida WHERE id_cotizacion = p_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL
    ) THEN
        p_total   := 0;
        p_mensaje := 'No se puede finalizar: la cotización no tiene partidas.';
        RETURN;
    END IF;

    SELECT COALESCE(SUM(CEIL(subtotal / 5.0) * 5), 0) INTO v_total
    FROM partida WHERE id_cotizacion = p_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL;

    UPDATE cotizacion
    SET estatus = 'FINALIZADA',
        total   = v_total,
        fecha_modificacion = NOW()
    WHERE id_cotizacion = p_id_cotizacion;

    p_total   := v_total;
    p_mensaje := 'Cotización de maquila finalizada. Total: $' || v_total;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sp_eliminar_partida_maquila(p_id_partida_maquila integer, OUT p_mensaje text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_cotizacion INT;
BEGIN
    SELECT id_cotizacion INTO v_id_cotizacion
    FROM partida
    WHERE id_partida = p_id_partida_maquila AND tipo = 'MAQUILA';

    IF v_id_cotizacion IS NULL THEN
        p_mensaje := 'Partida no encontrada.';
        RETURN;
    END IF;

    DELETE FROM partida WHERE id_partida = p_id_partida_maquila AND tipo = 'MAQUILA';

    UPDATE cotizacion
    SET total = (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM partida
        WHERE id_cotizacion = v_id_cotizacion AND tipo = 'MAQUILA' AND largo_cm IS NOT NULL
    )
    WHERE id_cotizacion = v_id_cotizacion;

    p_mensaje := 'Partida eliminada y total actualizado.';
END;
$function$;
