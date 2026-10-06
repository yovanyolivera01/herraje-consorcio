-- Table: turno

CREATE TABLE IF NOT EXISTS turno (
  id_turno     SERIAL PRIMARY KEY,
  hora_inicio  TIME NOT NULL,
  hora_fin     TIME NOT NULL,
  tolerancia   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Días de la semana que aplica el turno (ISODOW: 1=Lunes ... 7=Domingo)
ALTER TABLE turno
  ADD COLUMN IF NOT EXISTS dias_laborales INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6}';


-- Se quita la firma anterior (con p_id_turno, p_created_at, p_updated_at y
-- p_dias_laborales integer) para que no queden dos sobrecargas de la función.
DROP FUNCTION IF EXISTS public.sp_create_turno(integer, time, time, integer, timestamp without time zone, timestamp without time zone, integer);



CREATE OR REPLACE FUNCTION public.sp_create_turno(
    p_hora_inicio time,
    p_hora_fin time,
    p_tolerancia integer,
    p_dias_laborales integer[]
)
RETURNS turno AS $$
DECLARE
    v_turno turno;
BEGIN
    INSERT INTO turno (hora_inicio, hora_fin, tolerancia, dias_laborales)
    VALUES (p_hora_inicio, p_hora_fin, p_tolerancia, COALESCE(p_dias_laborales, '{1,2,3,4,5,6}'))
    RETURNING * INTO v_turno;
    RETURN v_turno;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE VIEW v_turnos AS
SELECT
    id_turno,
    hora_inicio,
    hora_fin,
    tolerancia,
    dias_laborales
FROM turno
ORDER BY id_turno DESC;