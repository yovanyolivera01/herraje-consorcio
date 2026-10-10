const express = require('express')
const { query } = require('../db')
const { calcularRango, calcularDia, fechasEnRango } = require('../services/calculosHoras')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// Rutas de CÁLCULOS (solo lectura). La lógica vive en
// services/calculosHoras.js; aquí solo se consultan los datos y se
// responde — así los cálculos no se mezclan con el CRUD de las otras rutas.

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DIAS = 62

function validarRango(inicio, fin) {
    if (!FECHA_RE.test(inicio ?? '') || !FECHA_RE.test(fin ?? '')) {
        return 'fecha_inicio y fecha_fin son obligatorias con formato YYYY-MM-DD'
    }
    if (inicio > fin) return 'fecha_inicio no puede ser posterior a fecha_fin'
    if (fechasEnRango(inicio, fin).length > MAX_DIAS) return `El rango máximo es de ${MAX_DIAS} días`
    return null
}

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

// Horas de UN empleado en un rango: detalle por día + totales.
// GET /api/calculos/horas/empleado/:id?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
router.get('/calculos/horas/empleado/:id_empleado', async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query
        const invalido = validarRango(fecha_inicio, fecha_fin)
        if (invalido) return err(res, new Error(invalido), 400)

        const id = Number(req.params.id_empleado)
        const { rows: empleados } = await query(SQL_TURNO, [id])
        if (!empleados[0]) return err(res, new Error('Empleado no encontrado o sin turno asignado'), 404)

        const { rows: registros } = await query(SQL_REGISTROS, [fecha_inicio, fecha_fin, id])
        const { dias, totales } = calcularRango(fecha_inicio, fecha_fin, agruparPorEmpleado(registros)[id] ?? {}, empleados[0])

        ok(res, { empleado: empleados[0], dias, totales })
    } catch (e) { err(res, e) }
})

// Totales de TODOS los empleados activos con turno en un rango (nómina).
// GET /api/calculos/horas/resumen?fecha_inicio=...&fecha_fin=...
router.get('/calculos/horas/resumen', async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query
        const invalido = validarRango(fecha_inicio, fecha_fin)
        if (invalido) return err(res, new Error(invalido), 400)

        const { rows: empleados } = await query(SQL_TURNO, [null])
        const { rows: registros } = await query(SQL_REGISTROS, [fecha_inicio, fecha_fin, null])
        const porEmpleado = agruparPorEmpleado(registros)

        ok(res, empleados.map(e => ({
            empleado_id: e.empleado_id,
            nombre: [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' '),
            ...calcularRango(fecha_inicio, fecha_fin, porEmpleado[e.empleado_id] ?? {}, e).totales,
        })))
    } catch (e) { err(res, e) }
})

// Registros de UN día de todos los empleados activos con turno (4 marcas + cálculos).
// GET /api/calculos/horas/dia?fecha=YYYY-MM-DD
router.get('/calculos/horas/dia', async (req, res) => {
    try {
        const { fecha } = req.query
        const invalido = validarRango(fecha, fecha)
        if (invalido) return err(res, new Error('fecha es obligatoria con formato YYYY-MM-DD'), 400)

        const { rows: empleados } = await query(SQL_TURNO, [null])
        const { rows: registros } = await query(SQL_REGISTROS, [fecha, fecha, null])
        const porEmpleado = agruparPorEmpleado(registros)

        ok(res, empleados.map(e => ({
            empleado_id: e.empleado_id,
            nombre: [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' '),
            hora_inicio: e.hora_inicio,
            hora_fin: e.hora_fin,
            ...calcularDia(fecha, porEmpleado[e.empleado_id]?.[fecha] ?? null, e),
        })))
    } catch (e) { err(res, e) }
})

module.exports = router
