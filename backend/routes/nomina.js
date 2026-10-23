const express = require('express')
const { query } = require('../db')
const { calcularRango, fechasEnRango } = require('../services/calculosHoras')
const { calcularNomina } = require('../services/calculosNomina')
const { SQL_REGISTROS, SQL_TURNO, agruparPorEmpleado } = require('../services/consultasHoras')
const router = express.Router()

function ok(res, data, status = 200) { res.status(status).json(data) }
function err(res, e, status = 500) {
    // RAISE EXCEPTION del SP (P0001) = error de validación -> 400
    res.status(e.code === 'P0001' ? 400 : status).json({ message: e.message })
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DIAS = 62
const redondear = (n) => Math.round(n * 100) / 100

function validarRango(inicio, fin) {
    if (!FECHA_RE.test(inicio ?? '') || !FECHA_RE.test(fin ?? '')) {
        return 'fecha_inicio y fecha_fin son obligatorias con formato YYYY-MM-DD'
    }
    if (inicio > fin) return 'fecha_inicio no puede ser posterior a fecha_fin'
    if (fechasEnRango(inicio, fin).length > MAX_DIAS) return `El rango máximo es de ${MAX_DIAS} días`
    return null
}

// Calcula (sin guardar) el pago de TODOS los empleados activos con turno en un
// periodo: toma los días de services/calculosHoras.js y calcula día por día
// según el turno (services/calculosNomina.js) con el sueldo / tarifa de hora
// extra del puesto. `nomina` es null si el empleado no tiene puesto.
async function calcularPeriodo(fecha_inicio, fecha_fin) {
    const { rows: empleados } = await query(SQL_TURNO, [null])
    const { rows: registros } = await query(SQL_REGISTROS, [fecha_inicio, fecha_fin, null])
    const porEmpleado = agruparPorEmpleado(registros)

    const { rows: puestos } = await query(
        `SELECT e.empleado_id, p.salario, p.hora_extra
         FROM empleados e JOIN puestos p ON p.id_puesto = e.id_puesto`
    )
    const puestoDe = Object.fromEntries(puestos.map(p => [p.empleado_id, p]))

    return empleados.map(e => {
        const puesto = puestoDe[e.empleado_id]
        const nombre = [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' ')
        if (!puesto) return { empleado_id: e.empleado_id, nombre, nomina: null }

        const { dias } = calcularRango(fecha_inicio, fecha_fin, porEmpleado[e.empleado_id] ?? {}, e)
        const nomina = calcularNomina(dias, e, puesto)
        nomina.total_pagar = redondear(nomina.sueldo_base + nomina.monto_extra - nomina.deducciones)
        nomina.tarifa_hora_extra = Number(puesto.hora_extra) || 0
        return { empleado_id: e.empleado_id, nombre, nomina }
    })
}

// Nóminas ya generadas de un periodo, con el nombre del empleado.
// GET /api/nomina?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
router.get('/nomina', async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query
        const invalido = validarRango(fecha_inicio, fecha_fin)
        if (invalido) return err(res, new Error(invalido), 400)

        const { rows } = await query(
            `SELECT n.*, to_char(n.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
                    to_char(n.fecha_fin, 'YYYY-MM-DD')    AS fecha_fin,
                    to_char(n.fecha_pago, 'YYYY-MM-DD')   AS fecha_pago,
                    concat_ws(' ', e.nombre, e.apellido_paterno, e.apellido_materno) AS nombre
             FROM nomina n
             JOIN empleados e ON e.empleado_id = n.id_empleado
             WHERE n.fecha_inicio = $1 AND n.fecha_fin = $2
             ORDER BY e.nombre`,
            [fecha_inicio, fecha_fin]
        )
        ok(res, rows)
    } catch (e) { err(res, e) }
})

// Vista previa del pago de todos los empleados (no guarda nada) — la usa el
// PDF del reporte de horas.
// GET /api/nomina/calculo?fecha_inicio=...&fecha_fin=...
router.get('/nomina/calculo', async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query
        const invalido = validarRango(fecha_inicio, fecha_fin)
        if (invalido) return err(res, new Error(invalido), 400)

        const filas = await calcularPeriodo(fecha_inicio, fecha_fin)
        ok(res, {
            empleados: filas.map(({ nomina, ...f }) => ({ ...f, ...(nomina && { ...nomina, detalle: undefined }) })),
            total_pagar: redondear(filas.reduce((acc, f) => acc + (f.nomina?.total_pagar ?? 0), 0)),
        })
    } catch (e) { err(res, e) }
})

// Genera y guarda la nómina de TODOS los empleados con sp_insertar_data_nomina.
// Los empleados que ya tienen nómina en ese periodo exacto se omiten.
// POST /api/nomina/generar { fecha_inicio, fecha_fin, fecha_pago?, metodo_pago? }
router.post('/nomina/generar', async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, fecha_pago = null, metodo_pago = null } = req.body
        const invalido = validarRango(fecha_inicio, fecha_fin)
        if (invalido) return err(res, new Error(invalido), 400)

        const filas = await calcularPeriodo(fecha_inicio, fecha_fin)

        const { rows: existentes } = await query(
            'SELECT id_empleado FROM nomina WHERE fecha_inicio = $1 AND fecha_fin = $2',
            [fecha_inicio, fecha_fin]
        )
        const yaGenerado = new Set(existentes.map(n => n.id_empleado))

        const generadas = []
        const omitidos = []

        for (const { empleado_id, nombre, nomina: n } of filas) {
            if (yaGenerado.has(empleado_id)) { omitidos.push({ empleado_id, nombre, motivo: 'Ya tiene nómina en este periodo' }); continue }
            if (!n) { omitidos.push({ empleado_id, nombre, motivo: 'Sin puesto asignado' }); continue }

            const { rows } = await query(
                'SELECT * FROM sp_insertar_data_nomina($1,$2,$3,$4,$5,$6,$7,$8,$9)',
                [empleado_id, fecha_inicio, fecha_fin, n.sueldo_base, n.horas_extra, n.monto_extra, n.deducciones, fecha_pago, metodo_pago]
            )
            generadas.push({ ...rows[0], nombre, resumen: n.resumen, detalle: n.detalle })
        }

        ok(res, { generadas, omitidos }, 201)
    } catch (e) { err(res, e) }
})

module.exports = router
