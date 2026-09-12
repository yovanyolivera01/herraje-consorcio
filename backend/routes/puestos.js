const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

router.get('/puestos', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM v_puestos')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.get('/puestos/:id_puesto', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM puestos WHERE id_puesto = $1', [req.params.id_puesto])
    if (!rows.length) return err(res, new Error('Puesto no encontrado'), 404)
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.put('/puestos/:id_puesto', async (req, res) => {
  const { plazas, salario, hora_extra } = req.body
  try {
    const actual = await query('SELECT * FROM puestos WHERE id_puesto = $1', [req.params.id_puesto])
    if (!actual.rows.length) return err(res, new Error('Puesto no encontrado'), 404)
    const p = actual.rows[0]

    const { rows } = await query(
      'SELECT * FROM public.sp_update_puesto($1,$2,$3,$4,$5,$6,$7)',
      [req.params.id_puesto, p.nombre, p.descripcion, salario, hora_extra, plazas, p.id_estado]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.post('/puestos', async (req, res) => {
  const { nombre, descripcion, plazas, salario, hora_extra, id_estado } = req.body

  try {
    const { rows } = await query(
      'SELECT * FROM public.sp_create_puesto($1,$2,$3,$4,$5,$6)',
      [nombre, descripcion, salario, hora_extra, plazas, id_estado]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.delete('/puestos/:id_puesto', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM public.sp_delete_puesto($1)', [req.params.id_puesto])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})











module.exports = router
