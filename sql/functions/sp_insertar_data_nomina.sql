-- Inserta un registro en la tabla nomina y lo regresa.
-- total_pagar se calcula aqui: sueldo_base + monto_extra - deducciones.
-- Si no se manda p_sueldo_base se toma el sueldo vigente (tabla salario) o, si no
-- tiene, el sueldo de su puesto (puestos.salario).

CREATE OR REPLACE FUNCTION sp_insertar_data_nomina(
    p_id_empleado     integer,
    p_fecha_inicio    date,
    p_fecha_fin       date,
    p_sueldo_base     numeric DEFAULT NULL,
    p_horas_extra     numeric DEFAULT 0,
    p_monto_extra     numeric DEFAULT 0,
    p_deducciones     numeric DEFAULT 0,
    p_fecha_pago      date    DEFAULT NULL,
    p_metodo_pago     varchar DEFAULT NULL,
    p_referencia_pago varchar DEFAULT NULL
)
RETURNS nomina AS $$
DECLARE
  v_sueldo_base numeric(10,2);
  v_total       numeric(10,2);
  v_nomina      nomina;
BEGIN
  IF p_fecha_fin < p_fecha_inicio THEN
    RAISE EXCEPTION 'La fecha fin no puede ser anterior a la fecha inicio';
  END IF;

  v_sueldo_base := p_sueldo_base;
  IF v_sueldo_base IS NULL THEN
    SELECT sueldo INTO v_sueldo_base
    FROM salario
    WHERE id_empleado = p_id_empleado AND fecha_fin IS NULL;

    IF v_sueldo_base IS NULL THEN
      SELECT p.salario INTO v_sueldo_base
      FROM empleados e JOIN puestos p ON p.id_puesto = e.id_puesto
      WHERE e.empleado_id = p_id_empleado;
    END IF;

    IF v_sueldo_base IS NULL THEN
      RAISE EXCEPTION 'El empleado % no tiene sueldo ni puesto asignado', p_id_empleado;
    END IF;
  END IF;

  v_total := v_sueldo_base + COALESCE(p_monto_extra, 0) - COALESCE(p_deducciones, 0);
  IF v_total < 0 THEN
    RAISE EXCEPTION 'Las deducciones no pueden ser mayores al total a percibir';
  END IF;

  INSERT INTO nomina (
    id_empleado, fecha_inicio, fecha_fin, sueldo_base, horas_extra,
    monto_extra, deducciones, total_pagar, fecha_pago, metodo_pago, referencia_pago
  )
  VALUES (
    p_id_empleado, p_fecha_inicio, p_fecha_fin, v_sueldo_base, COALESCE(p_horas_extra, 0),
    COALESCE(p_monto_extra, 0), COALESCE(p_deducciones, 0), v_total,
    p_fecha_pago, p_metodo_pago, p_referencia_pago
  )
  RETURNING * INTO v_nomina;

  RETURN v_nomina;
END;
$$ LANGUAGE plpgsql;
