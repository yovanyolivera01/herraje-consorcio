
CREATE OR REPLACE FUNCTION sp_create_turno(
    p_id_turno integer,
    p_hora_inicio time,
    p_hora_fin time,
    p_tolerancia integer,
    p_created_at timestamp without time zone,
    p_updated_at timestamp without time zone

)
RETURNS turno AS $$
DECLARE
  v_turno turno;  
BEGIN
    INSERT INTO turno (hora_inicio, hora_fin, tolerancia, created_at, updated_at)
    VALUES (p_hora_inicio, p_hora_fin, p_tolerancia, p_created_at, p_updated_at)
    RETURNING * INTO v_turno;
    RETURN v_turno;
END;
$$ LANGUAGE plpgsql;
























