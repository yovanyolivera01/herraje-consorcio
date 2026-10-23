-- Editar y eliminar turnos (antes solo existía sp_create_turno).

-- Actualiza un turno; regresa NULL si no existe. Los cambios afectan a todos
-- los empleados con este turno (horas programadas, comida, días laborales).
CREATE OR REPLACE FUNCTION public.sp_update_turno(
    p_id_turno       integer,
    p_hora_inicio    time,
    p_hora_fin       time,
    p_tolerancia     integer,
    p_dias_laborales integer[],
    p_minutos_comida integer DEFAULT 60
)
RETURNS turno AS $$
DECLARE
    v_turno turno;
BEGIN
    IF p_hora_fin <= p_hora_inicio THEN
        RAISE EXCEPTION 'La hora fin debe ser posterior a la hora inicio';
    END IF;

    UPDATE turno
    SET hora_inicio    = p_hora_inicio,
        hora_fin       = p_hora_fin,
        tolerancia     = COALESCE(p_tolerancia, 0),
        dias_laborales = COALESCE(p_dias_laborales, '{1,2,3,4,5,6}'),
        minutos_comida = COALESCE(p_minutos_comida, 60),
        updated_at     = NOW()
    WHERE id_turno = p_id_turno
    RETURNING * INTO v_turno;

    RETURN v_turno;
END;
$$ LANGUAGE plpgsql;

-- Elimina un turno y regresa el registro borrado (NULL si no existe).
-- No deja borrarlo si hay empleados asignados o registros de asistencia que
-- lo usan: primero hay que reasignar a esos empleados.
CREATE OR REPLACE FUNCTION public.sp_delete_turno(
    p_id_turno integer
)
RETURNS turno AS $$
DECLARE
    v_turno turno;
    v_empleados integer;
BEGIN
    SELECT COUNT(*) INTO v_empleados FROM empleados WHERE id_turno = p_id_turno;
    IF v_empleados > 0 THEN
        RAISE EXCEPTION 'No se puede eliminar el turno: % empleado(s) lo tienen asignado', v_empleados;
    END IF;

    IF EXISTS (SELECT 1 FROM registro WHERE id_turno = p_id_turno) THEN
        RAISE EXCEPTION 'No se puede eliminar el turno: tiene registros de asistencia';
    END IF;

    DELETE FROM turno
    WHERE id_turno = p_id_turno
    RETURNING * INTO v_turno;

    RETURN v_turno;
END;
$$ LANGUAGE plpgsql;
