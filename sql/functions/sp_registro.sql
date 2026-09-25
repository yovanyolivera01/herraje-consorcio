CREATE OR REPLACE FUNCTION sp_registro(
    p_id_empleado integer,
    p_id_turno integer,
    p_fecha date,
    p_hora_entrada time,
    p_created_at timestamp without time zone
)
RETURNS registro AS $$
DECLARE
v_registro registro;
BEGIN
    INSERT INTO registro (id_empleado, id_turno, fecha, hora_llegada, created_at)
    VALUES (p_id_empleado, p_id_turno, p_fecha, p_hora_entrada, p_created_at)
    RETURNING * INTO v_registro;
    RETURN v_registro;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION sp_update_registro(
    p_id_registro integer,
    p_hora_salida time
)
RETURNS registro AS $$
DECLARE
v_registro registro;
BEGIN
    UPDATE registro
    SET
        hora_salida = p_hora_salida
    WHERE id_registro = p_id_registro
    RETURNING * INTO v_registro;
    RETURN v_registro;
END;
$$ LANGUAGE plpgsql;


-- Último registro del día de hoy para un empleado (o ninguna fila con
-- id_registro si aún no ha marcado entrada — RETURNS registro, no SETOF,
-- así que "sin resultado" siempre llega como una fila con todo NULL).
CREATE OR REPLACE FUNCTION sp_obtener_registro_hoy(p_id_empleado integer)
RETURNS registro AS $$
DECLARE
v_registro registro;
BEGIN
    SELECT * INTO v_registro
    FROM registro
    WHERE id_empleado = p_id_empleado AND fecha = CURRENT_DATE
    ORDER BY id_registro DESC
    LIMIT 1;

    RETURN v_registro;
END;
$$ LANGUAGE plpgsql;