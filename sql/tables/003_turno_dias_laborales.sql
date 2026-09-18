-- Días laborales de un turno: qué días de la semana aplica (1=Lunes ...
-- 7=Domingo, mismo orden que EXTRACT(ISODOW FROM date)). Por default
-- Lunes a Sábado, igual al supuesto ya usado en el cálculo de bono de
-- puntualidad (DIAS_LABORALES = 6 en src/lib/personalApi.js).

ALTER TABLE turno
  ADD COLUMN IF NOT EXISTS dias_laborales INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6}';

-- v_horas_ausencia ya no debe reportar ausencia en un día que el turno del
-- empleado no considera laboral (antes asumía los 7 días de la semana).
CREATE OR REPLACE VIEW v_horas_ausencia AS
SELECT
  e.empleado_id                                                         AS id_empleado,
  d.fecha,
  t.id_turno,
  ROUND(EXTRACT(EPOCH FROM (t.hora_fin - t.hora_inicio)) / 3600.0, 2)   AS horas_programadas,
  ROUND(COALESCE(EXTRACT(EPOCH FROM (r.hora_salida - r.hora_llegada)) / 3600.0, 0), 2) AS horas_trabajadas,
  ROUND(GREATEST(
    EXTRACT(EPOCH FROM (t.hora_fin - t.hora_inicio)) / 3600.0
      - COALESCE(EXTRACT(EPOCH FROM (r.hora_salida - r.hora_llegada)) / 3600.0, 0),
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
