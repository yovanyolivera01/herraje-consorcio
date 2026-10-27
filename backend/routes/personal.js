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
    // La fecha de registro no la manda el usuario: es el día de hoy (hora de
    // México, el timezone de la sesión) al momento de dar de alta.
    const {
      nombre, telefono, apellido_materno, apellido_paterno,
      id_puesto, id_turno, calle, ciudad, colonia, cp, huella, cara, id_estado,
    } = req.body
    const { rows } = await query(
      'SELECT * FROM public.sp_agregar_empleado($1,$2,CURRENT_DATE,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
      [
        nombre?.trim(), telefono?.trim(),
        apellido_materno ?? null, apellido_paterno ?? null,
        // id_puesto/id_turno son integer en la SP — '' (campo numérico
        // vacío en el form) no es null/undefined así que "?? null" no lo
        // atrapaba, y Postgres tronaba con "invalid input syntax for type
        // integer". Turno es opcional en el form, así que esto pasaba en
        // cualquier alta sin turno asignado.
        id_puesto || null, id_turno || null,
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
        apellido_materno ?? null, apellido_paterno ?? null,
        id_puesto || null, id_turno || null,
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

// Información completa de UN empleado (puesto, turno, dirección) desde la vista v_empleado_info.
router.get('/personal/empleados/:id/info', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT *, to_char(fecha_registro, 'YYYY-MM-DD') AS fecha_registro,
              to_char(hora_inicio, 'HH24:MI') AS hora_inicio, to_char(hora_fin, 'HH24:MI') AS hora_fin
       FROM v_empleado_info WHERE empleado_id = $1`,
      [req.params.id]
    )
    if (!rows[0]) return err(res, new Error('Empleado no encontrado'), 404)
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

// Actualiza solo el descriptor facial (cara) — pensado para un flujo de
// captura de rostro independiente del formulario completo de edición.
router.patch('/personal/empleados/:id/cara', async (req, res) => {
  try {
    const { cara } = req.body
    const { rows } = await query(
      'SELECT * FROM public.sp_actualizar_cara_empleado($1,$2)',
      [req.params.id, cara ?? null]
    )
    if (!rows[0]?.empleado_id) return err(res, new Error('Empleado no encontrado'), 404)
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

module.exports = router
