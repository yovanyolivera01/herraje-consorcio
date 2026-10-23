-- Vista con la información completa de un empleado en una sola fila: datos
-- personales, dirección, puesto (con su sueldo y tarifa de hora extra), turno
-- y estado. No expone el descriptor facial ni la huella, solo si existen.
-- La usa el modal "Información del empleado" (GET /api/personal/empleados/:id/info).
CREATE OR REPLACE VIEW v_empleado_info AS
SELECT
  e.empleado_id,
  e.nombre,
  e.apellido_paterno,
  e.apellido_materno,
  concat_ws(' ', e.nombre, e.apellido_paterno, e.apellido_materno) AS nombre_completo,
  e.telefono,
  e.fecha_registro,
  e.calle,
  e.colonia,
  e.ciudad,
  e.cp,
  e.id_estado,
  s.descripcion       AS estado,
  e.id_puesto,
  p.nombre            AS puesto,
  p.salario           AS sueldo_puesto,
  p.hora_extra        AS tarifa_hora_extra,
  e.id_turno,
  t.hora_inicio,
  t.hora_fin,
  t.tolerancia,
  t.minutos_comida,
  t.dias_laborales,
  (e.cara   IS NOT NULL AND e.cara   <> '') AS tiene_rostro,
  (e.huella IS NOT NULL AND e.huella <> '') AS tiene_huella
FROM empleados e
LEFT JOIN estatus s ON s.id_estado = e.id_estado
LEFT JOIN puestos p ON p.id_puesto = e.id_puesto
LEFT JOIN turno   t ON t.id_turno  = e.id_turno;
