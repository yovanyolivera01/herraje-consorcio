// Consultas compartidas por las rutas que calculan horas (calculos y nomina).

// to_char evita que pg convierta date/time a objetos Date de JS (con
// corrimientos de zona horaria); las horas se quedan como texto 'HH:MM:SS'.
// DISTINCT ON deja el ÚLTIMO registro de cada día por empleado.
const SQL_REGISTROS = `
    SELECT DISTINCT ON (r.id_empleado, r.fecha)
        r.id_empleado,
        to_char(r.fecha, 'YYYY-MM-DD')            AS fecha,
        to_char(r.hora_llegada, 'HH24:MI:SS')         AS hora_llegada,
        to_char(r.hora_salida_comida, 'HH24:MI:SS')   AS hora_salida_comida,
        to_char(r.hora_regreso_comida, 'HH24:MI:SS')  AS hora_regreso_comida,
        to_char(r.hora_salida, 'HH24:MI:SS')          AS hora_salida
    FROM registro r
    WHERE r.fecha BETWEEN $1 AND $2
      AND ($3::int IS NULL OR r.id_empleado = $3)
    ORDER BY r.id_empleado, r.fecha, r.id_registro DESC`

const SQL_TURNO = `
    SELECT e.empleado_id, e.nombre, e.apellido_paterno, e.apellido_materno,
           to_char(t.hora_inicio, 'HH24:MI:SS') AS hora_inicio,
           to_char(t.hora_fin, 'HH24:MI:SS')    AS hora_fin,
           t.tolerancia, t.dias_laborales, t.minutos_comida
    FROM empleados e
    JOIN turno t ON t.id_turno = e.id_turno
    WHERE e.id_estado = 1
      AND ($1::int IS NULL OR e.empleado_id = $1)
    ORDER BY e.empleado_id`

function agruparPorEmpleado(registros) {
    const out = {}
    for (const r of registros) (out[r.id_empleado] ??= {})[r.fecha] = r
    return out
}

module.exports = { SQL_REGISTROS, SQL_TURNO, agruparPorEmpleado }
