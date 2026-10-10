-- Asistencia con 4 marcas por día (antes solo entrada/salida):
--   1. entrada            -> registro.hora_llegada
--   2. salida a comer     -> registro.hora_salida_comida
--   3. regreso de comer   -> registro.hora_regreso_comida
--   4. salida             -> registro.hora_salida
-- Se conserva la misma fila diaria de `registro` (y sus columnas actuales)
-- para no romper datos históricos ni sp_registro / sp_obtener_registro_hoy,
-- que regresan el tipo `registro` y toman las columnas nuevas solas.

ALTER TABLE registro ADD COLUMN IF NOT EXISTS hora_salida_comida  TIME;
ALTER TABLE registro ADD COLUMN IF NOT EXISTS hora_regreso_comida TIME;


-- Registra la siguiente marca de un registro existente, validando el orden:
-- no se puede salir a comer sin haber entrado, regresar sin haber salido a
-- comer, ni marcar la salida final sin haber regresado. p_marca:
-- 'salida_comida' | 'regreso_comida' | 'salida'.
CREATE OR REPLACE FUNCTION sp_registrar_marca(
    p_id_registro integer,
    p_marca       text,
    p_hora        time
)
RETURNS registro AS $$
DECLARE
    v_registro registro;
BEGIN
    SELECT * INTO v_registro FROM registro WHERE id_registro = p_id_registro;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el registro %', p_id_registro;
    END IF;

    IF p_marca = 'salida_comida' THEN
        IF v_registro.hora_salida_comida IS NOT NULL THEN
            RAISE EXCEPTION 'La salida a comer ya fue registrada';
        END IF;
        UPDATE registro SET hora_salida_comida = p_hora
        WHERE id_registro = p_id_registro RETURNING * INTO v_registro;

    ELSIF p_marca = 'regreso_comida' THEN
        IF v_registro.hora_salida_comida IS NULL THEN
            RAISE EXCEPTION 'Primero se debe registrar la salida a comer';
        END IF;
        IF v_registro.hora_regreso_comida IS NOT NULL THEN
            RAISE EXCEPTION 'El regreso de comer ya fue registrado';
        END IF;
        UPDATE registro SET hora_regreso_comida = p_hora
        WHERE id_registro = p_id_registro RETURNING * INTO v_registro;

    ELSIF p_marca = 'salida' THEN
        IF v_registro.hora_regreso_comida IS NULL THEN
            RAISE EXCEPTION 'Primero se debe registrar el regreso de comer';
        END IF;
        IF v_registro.hora_salida IS NOT NULL THEN
            RAISE EXCEPTION 'La salida ya fue registrada';
        END IF;
        UPDATE registro SET hora_salida = p_hora
        WHERE id_registro = p_id_registro RETURNING * INTO v_registro;

    ELSE
        RAISE EXCEPTION 'Marca inválida: % (use salida_comida, regreso_comida o salida)', p_marca;
    END IF;

    RETURN v_registro;
END;
$$ LANGUAGE plpgsql;


-- v_horas_ausencia: las horas trabajadas ahora descuentan el tiempo de
-- comida (regreso - salida a comer) cuando ambas marcas existen. Resto de la
-- vista idéntico a sql/tables/003_turno_dias_laborales.sql.
CREATE OR REPLACE VIEW v_horas_ausencia AS
SELECT
  e.empleado_id                                                         AS id_empleado,
  d.fecha,
  t.id_turno,
  ROUND(EXTRACT(EPOCH FROM (t.hora_fin - t.hora_inicio)) / 3600.0, 2)   AS horas_programadas,
  ROUND(COALESCE(EXTRACT(EPOCH FROM (
    (r.hora_salida - r.hora_llegada)
    - COALESCE(r.hora_regreso_comida - r.hora_salida_comida, INTERVAL '0')
  )) / 3600.0, 0), 2)                                                    AS horas_trabajadas,
  ROUND(GREATEST(
    EXTRACT(EPOCH FROM (t.hora_fin - t.hora_inicio)) / 3600.0
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
