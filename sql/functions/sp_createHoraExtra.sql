

CREATE OR REPLACE FUNCTION sp_create_hora_extra(
    p_id_hora_extra integer,
    p_id_empleado integer,
    p_fecha date,
    p_horas numeric,
    p_created_at timestamp without time zone,
)
RETURNS hora_extra AS $$
DECLARE
  v_hora_extra hora_extra;  
BEGIN
    INSERT INTO hora_extra (id_empleado, fecha, horas, created_at)
    VALUES (p_id_empleado, p_fecha, p_horas, p_created_at)
    RETURNING * INTO v_hora_extra;
    RETURN v_hora_extra;
END;
$$ LANGUAGE plpgsql;