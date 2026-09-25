const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }




// ── Empleados ─────────────────────────────────────────────────────────────

router.get('/personal/empleados', async (req, res) => {
  try {
    const { rows } = await query('Select * from v_empleados')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/personal/empleados', async (req, res) => {
  try {
    const {
      nombre, telefono, fecha_registro, apellido_materno, apellido_paterno,
      id_puesto, id_turno, calle, ciudad, colonia, cp, huella, cara, id_estado,
    } = req.body
    const { rows } = await query(
      'SELECT * FROM public.sp_agregar_empleado($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
      [
        nombre?.trim(), telefono?.trim(), fecha_registro || new Date(),
        apellido_materno ?? null, apellido_paterno ?? null, id_puesto ?? null, id_turno ?? null,
        calle ?? null, ciudad ?? null, colonia ?? null, cp ?? null, huella ?? null, cara ?? null,
        id_estado ?? 1,
      ]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.put('/personal/empleados/:id', async (req, res) => {
  try {
    const {
      nombre, telefono, fecha_registro, apellido_materno, apellido_paterno,
      id_puesto, id_turno, calle, ciudad, colonia, cp, huella, cara, id_estado,
    } = req.body
    const { rows } = await query(
      'SELECT * FROM public.sp_update_empleado($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',
      [
        req.params.id, nombre?.trim(), telefono?.trim(), fecha_registro ?? null,
        apellido_materno ?? null, apellido_paterno ?? null, id_puesto ?? null, id_turno ?? null,
        calle ?? null, ciudad ?? null, colonia ?? null, cp ?? null, huella ?? null, cara ?? null,
        id_estado ?? 1,
      ]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.delete('/personal/empleados/:id', async (req, res) => {
  try {
    await query('UPDATE empleados SET id_estado=0 WHERE empleado_id=$1', [req.params.id])
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
})




















// ── Semanas ───────────────────────────────────────────────────────────────

router.get('/personal/semanas', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM semanas ORDER BY fecha_inicio DESC')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/personal/semanas', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, descripcion } = req.body
    const { rows } = await query(
      `INSERT INTO semanas (fecha_inicio, fecha_fin, descripcion) VALUES ($1,$2,$3)
       ON CONFLICT (fecha_inicio) DO UPDATE SET fecha_fin=EXCLUDED.fecha_fin RETURNING *`,
      [fecha_inicio, fecha_fin, descripcion]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})


// ── Registros diarios ─────────────────────────────────────────────────────

router.get('/personal/registros/:semanaId', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM registros_diarios WHERE semana_id=$1',
      [req.params.semanaId]
    )
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/personal/registros', async (req, res) => {
  try {
    const { empleadoId, semanaId, fecha, horaEntrada, horaSalida } = req.body
    const nombreDia = req.body.nombreDia

    const { rows } = await query(`
      INSERT INTO registros_diarios
        (empleado_id, semana_id, fecha, nombre_dia, hora_entrada, hora_salida, fecha_modificacion)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (empleado_id, fecha)
      DO UPDATE SET
        hora_entrada       = EXCLUDED.hora_entrada,
        hora_salida        = EXCLUDED.hora_salida,
        fecha_modificacion = EXCLUDED.fecha_modificacion
      RETURNING *
    `, [
      empleadoId, semanaId, fecha, nombreDia,
      horaEntrada || null,
      horaSalida  || null,
      new Date().toISOString(),
    ])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

// ── Resumen semanal ───────────────────────────────────────────────────────

router.get('/personal/resumenes/:semanaId', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM resumen_semanal WHERE semana_id=$1', [req.params.semanaId])
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/personal/resumenes', async (req, res) => {
  try {
    const { empleadoId, semanaId, resumen } = req.body
    const campos = { ...resumen, fecha_calculo: new Date().toISOString() }
    const keys   = Object.keys(campos)
    const placeholders = keys.map((_, i) => `$${i + 3}`).join(', ')
    const sets = keys.map((k, i) => `${k}=$${i + 3}`).join(', ')
    await query(`
      INSERT INTO resumen_semanal (empleado_id, semana_id, ${keys.join(', ')})
      VALUES ($1, $2, ${placeholders})
      ON CONFLICT (empleado_id, semana_id) DO UPDATE SET ${sets}
    `, [empleadoId, semanaId, ...Object.values(campos)])
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
})

module.exports = router
