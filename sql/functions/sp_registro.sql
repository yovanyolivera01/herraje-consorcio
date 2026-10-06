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


-- Entrada de HOY de un empleado específico, con su nombre ya unido — para
-- mostrarla en pantalla justo cuando esa persona llega. Es una FUNCTION, no
-- una vista (a pesar del prefijo "v_"): una vista no puede tomar un
-- parámetro como p_id_empleado/$1 — eso solo funciona dentro de una
-- función, igual que sp_obtener_registro_hoy (que regresa lo mismo pero
-- sin el nombre). RETURNS TABLE en vez de RETURNS registro: así, si el
-- empleado no tiene entrada hoy, regresa cero filas en vez de una fila con
-- todo NULL — más simple de checar desde la ruta (if (!rows[0])).
CREATE OR REPLACE FUNCTION v_mostrar_registro_entrada(p_id_empleado integer)
RETURNS TABLE (
    fecha             date,
    hora_llegada      time,
    nombre            character varying,
    apellido_paterno  character varying,
    apellido_materno  character varying
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.fecha,
        r.hora_llegada,
        e.nombre,
        e.apellido_paterno,
        e.apellido_materno
    FROM registro r
    INNER JOIN empleados e ON r.id_empleado = e.empleado_id
    WHERE r.id_empleado = p_id_empleado AND r.fecha = CURRENT_DATE
    ORDER BY r.hora_llegada DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
