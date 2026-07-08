
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
        SELECT 1 FROM partida_maquila WHERE id_cotizacion = p_id_cotizacion
    ) THEN
        p_total   := 0;
        p_mensaje := 'No se puede finalizar: la cotización no tiene partidas.';
        RETURN;
    END IF;

    SELECT COALESCE(SUM(CEIL(subtotal_partida / 5.0) * 5), 0) INTO v_total
    FROM partida_maquila WHERE id_cotizacion = p_id_cotizacion;

    UPDATE cotizacion
    SET estatus = 'FINALIZADA',
        total   = v_total,
        fecha_modificacion = NOW()
    WHERE id_cotizacion = p_id_cotizacion;

    p_total   := v_total;
    p_mensaje := 'Cotización de maquila finalizada. Total: $' || v_total;
END;
