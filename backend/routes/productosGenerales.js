const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

router.get('/productos-generales', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT pg.*, pr.nombre AS proveedor_nombre
      FROM producto_general pg
      LEFT JOIN proveedores pr ON pr.id = pg.proveedor_id
      ORDER BY pg.nombre
    `)
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/productos-generales', async (req, res) => {
  try {
    const { nombre, descripcion, unidad, precio } = req.body
    const { rows } = await query(
      `INSERT INTO producto_general (nombre, descripcion, unidad, precio, existencias)
       VALUES ($1,$2,$3,$4,0) RETURNING *`,
      [nombre, descripcion || null, unidad || null, precio ? Number(precio) : null]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.put('/productos-generales/:id', async (req, res) => {
  try {
    const campos = req.body
    const sets = Object.keys(campos).map((k, i) => `${k}=$${i + 1}`).join(', ')
    const vals  = [...Object.values(campos), req.params.id]
    const { rows } = await query(
      `UPDATE producto_general SET ${sets} WHERE id_producto_general=$${vals.length} RETURNING *`, vals
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.post('/productos-generales/:id/ajustar', async (req, res) => {
  try {
    const { delta } = req.body
    const { rows: cur } = await query(
      'SELECT existencias FROM producto_general WHERE id_producto_general=$1', [req.params.id]
    )
    if (!cur.length) return res.status(404).json({ message: 'Producto no encontrado' })
    const nuevas = (cur[0].existencias ?? 0) + Number(delta)
    if (nuevas < 0) return res.status(400).json({ message: 'Las existencias no pueden quedar en negativo' })
    await query('UPDATE producto_general SET existencias=$1 WHERE id_producto_general=$2', [nuevas, req.params.id])
    ok(res, { existencias: nuevas })
  } catch (e) { err(res, e) }
})

router.post('/productos-generales/:id/vender', async (req, res) => {
  try {
    const { cantidad } = req.body
    const { rows: cur } = await query(
      'SELECT existencias FROM producto_general WHERE id_producto_general=$1', [req.params.id]
    )
    if (!cur.length) return ok(res, { ok: true })
    const nuevas = Math.max(0, (cur[0].existencias ?? 0) - Number(cantidad))
    await query('UPDATE producto_general SET existencias=$1 WHERE id_producto_general=$2', [nuevas, req.params.id])
    ok(res, { existencias: nuevas })
  } catch (e) { err(res, e) }
})

module.exports = router
