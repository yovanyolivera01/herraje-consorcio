-- Minutos de comida del turno. hora_inicio/hora_fin incluyen la comida, así
-- que las horas a trabajar por día son (fin - inicio) - minutos_comida.
-- Antes esto era una constante (60) en el cálculo de horas.

ALTER TABLE turno ADD COLUMN IF NOT EXISTS minutos_comida INTEGER NOT NULL DEFAULT 60;


-- Se quita la firma de 4 parámetros para que no queden dos sobrecargas.
DROP FUNCTION IF EXISTS public.sp_create_turno(time, time, integer, integer[]);

CREATE OR REPLACE FUNCTION public.sp_create_turno(
    p_hora_inicio    time,
    p_hora_fin       time,
    p_tolerancia     integer,
    p_dias_laborales integer[],
    p_minutos_comida integer
)
RETURNS turno AS $$
DECLARE
    v_turno turno;
BEGIN
    INSERT INTO turno (hora_inicio, hora_fin, tolerancia, dias_laborales, minutos_comida)
    VALUES (
        p_hora_inicio, p_hora_fin, p_tolerancia,
        COALESCE(p_dias_laborales, '{1,2,3,4,5,6}'),
        COALESCE(p_minutos_comida, 60)
    )
    RETURNING * INTO v_turno;
    RETURN v_turno;
END;
$$ LANGUAGE plpgsql;


-- La columna nueva va al final: CREATE OR REPLACE VIEW no permite reordenar.
CREATE OR REPLACE VIEW v_turnos AS
SELECT
    id_turno,
    hora_inicio,
    hora_fin,
    tolerancia,
    dias_laborales,
    minutos_comida
FROM turno
ORDER BY id_turno DESC;


-- v_horas_ausencia: las horas programadas también descuentan la comida del
-- turno (antes comparaba horas trabajadas SIN comida contra un span CON
-- comida, y todos salían con ausencia).
CREATE OR REPLACE VIEW v_horas_ausencia AS
SELECT
  e.empleado_id                                                         AS id_empleado,
  d.fecha,
  t.id_turno,
  ROUND((EXTRACT(EPOCH FROM (t.hora_fin - t.hora_inicio)) / 60.0 - t.minutos_comida) / 60.0, 2) AS horas_programadas,
  ROUND(COALESCE(EXTRACT(EPOCH FROM (
    (r.hora_salida - r.hora_llegada)
    - COALESCE(r.hora_regreso_comida - r.hora_salida_comida, INTERVAL '0')
  )) / 3600.0, 0), 2)                                                    AS horas_trabajadas,
  ROUND(GREATEST(
    (EXTRACT(EPOCH FROM (t.hora_fin - t.hora_inicio)) / 60.0 - t.minutos_comida) / 60.0
      - COALESCE(EXTRACT(EPOCH FROM (
          (r.hora_salida - r.hora_llegada)
          - COALESCE(r.hora_regreso_comida - r.hora_salida_comida, INTERVAL '0')
        )) / 3600.0, 0),
    0
  ), 2)                                                                  AS horas_ausencia,
  (r.id_registro IS NULL)                                               AS sin_registro,
  ci.descripcion                                                        AS tipo_incidencia
FROM (SELECT generate_series(CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE, INTERVAL '1 day')::date AS fecha) d
CROSS JOIN empleados e
JOIN turno t
  ON t.id_turno = e.id_turno
LEFT JOIN registro r
  ON r.id_empleado = e.empleado_id AND r.fecha = d.fecha
LEFT JOIN incidencia i
  ON i.id_empleado = e.empleado_id
  AND d.fecha BETWEEN i.fecha_inicio AND COALESCE(i.fecha_fin, i.fecha_inicio)
LEFT JOIN catalogo_incidencia ci
  ON ci.id_catalogo_incidencia = i.id_catalogo_incidencia
WHERE e.id_turno IS NOT NULL
  AND e.id_estado = 1
  AND EXTRACT(ISODOW FROM d.fecha)::INTEGER = ANY(t.dias_laborales);
