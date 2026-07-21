const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

router.get('/clientes', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.*,
        json_build_object('id_nivel_precio', n.id_nivel_precio, 'nombre', n.nombre) AS nivel_precio
      FROM cliente c LEFT JOIN nivel_precio n ON n.id_nivel_precio = c.id_nivel_precio
      ORDER BY c.nombre ASC
    `)
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/clientes', async (req, res) => {
  try {
    const { nombre, telefono, correo, id_nivel_precio, rfc, razon_social, cp_fiscal, regimen_fiscal, uso_cfdi } = req.body
    const { rows: ins } = await query(
      `INSERT INTO cliente (nombre, telefono, correo, id_nivel_precio, rfc, razon_social, cp_fiscal, regimen_fiscal, uso_cfdi)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id_cliente`,
      [nombre, telefono || null, correo || null, id_nivel_precio || null,
       rfc || null, razon_social || null, cp_fiscal || null, regimen_fiscal || null, uso_cfdi || null]
    )
    const { rows } = await query(`
      SELECT c.*,
        json_build_object('id_nivel_precio', n.id_nivel_precio, 'nombre', n.nombre) AS nivel_precio
      FROM cliente c LEFT JOIN nivel_precio n ON n.id_nivel_precio = c.id_nivel_precio
      WHERE c.id_cliente=$1
    `, [ins[0].id_cliente])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.put('/clientes/:id', async (req, res) => {
  try {
    const campos = req.body
    const sets = Object.keys(campos).map((k, i) => `${k}=$${i + 1}`).join(', ')
    const vals = [...Object.values(campos), req.params.id]
    await query(`UPDATE cliente SET ${sets} WHERE id_cliente=$${vals.length}`, vals)
    const { rows } = await query(`
      SELECT c.*,
        json_build_object('id_nivel_precio', n.id_nivel_precio, 'nombre', n.nombre) AS nivel_precio
      FROM cliente c LEFT JOIN nivel_precio n ON n.id_nivel_precio = c.id_nivel_precio
      WHERE c.id_cliente=$1
    `, [req.params.id])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

module.exports = router
