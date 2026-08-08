const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data)  { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// ── Procesos ──────────────────────────────────────────────────────────────

router.get('/procesos', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT p.*,
        json_build_object('id_unidad_cobro', u.id_unidad_cobro, 'nombre', u.nombre, 'descripcion', u.descripcion) AS unidad_cobro
      FROM proceso p
      LEFT JOIN unidad_cobro u ON u.id_unidad_cobro = p.id_unidad_cobro
      ORDER BY p.nombre ASC
    `)
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/procesos', async (req, res) => {
  try {
    const { nombre, id_unidad_cobro, precio_unitario = 0, tipo = 'PROCESO', diametro_mm = null } = req.body
    const { rows: ins } = await query(
      'INSERT INTO proceso (nombre, id_unidad_cobro, precio_unitario, tipo, diametro_mm) VALUES ($1,$2,$3,$4,$5) RETURNING id_proceso',
      [nombre, id_unidad_cobro, Number(precio_unitario), tipo, diametro_mm ?? null]
    )
    const { rows } = await query(`
      SELECT p.*,
        json_build_object('id_unidad_cobro', u.id_unidad_cobro, 'nombre', u.nombre, 'descripcion', u.descripcion) AS unidad_cobro
      FROM proceso p LEFT JOIN unidad_cobro u ON u.id_unidad_cobro = p.id_unidad_cobro
      WHERE p.id_proceso=$1
    `, [ins[0].id_proceso])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.put('/procesos/:id', async (req, res) => {
  try {
    const campos = req.body
    const sets = Object.keys(campos).map((k, i) => `${k}=$${i + 1}`).join(', ')
    const vals = [...Object.values(campos), req.params.id]
    await query(`UPDATE proceso SET ${sets} WHERE id_proceso=$${vals.length}`, vals)
    const { rows } = await query(`
      SELECT p.*,
        json_build_object('id_unidad_cobro', u.id_unidad_cobro, 'nombre', u.nombre, 'descripcion', u.descripcion) AS unidad_cobro
      FROM proceso p LEFT JOIN unidad_cobro u ON u.id_unidad_cobro = p.id_unidad_cobro
      WHERE p.id_proceso=$1
    `, [req.params.id])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

module.exports = router
