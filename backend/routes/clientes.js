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
    const { rows } = await query(
      'SELECT * FROM sp_crear_cliente($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        nombre,
        telefono || null,
        correo || null,
        id_nivel_precio || null,
        rfc || null,
        razon_social || null,
        cp_fiscal || null,
        regimen_fiscal || null,
        uso_cfdi || null,
      ]
    )

    const { p_id_resultado, p_mensaje } = rows[0]
    if (!p_id_resultado) {
      return res.status(400).json({ message: p_mensaje })
    }

    const { rows: clienteRows } = await query(`
      SELECT c.*,
        json_build_object('id_nivel_precio', n.id_nivel_precio, 'nombre', n.nombre) AS nivel_precio
      FROM cliente c LEFT JOIN nivel_precio n ON n.id_nivel_precio = c.id_nivel_precio
      WHERE c.id_cliente=$1
    `, [p_id_resultado])
    ok(res, clienteRows[0])
  } catch (e) { err(res, e) }
})

router.put('/clientes/:id', async (req, res) => {
  try {
    const { rows: currentRows } = await query('SELECT * FROM cliente WHERE id_cliente=$1', [req.params.id])
    if (!currentRows.length) return res.status(404).json({ message: 'Cliente no encontrado' })
    const merged = { ...currentRows[0], ...req.body }

    const { rows } = await query(
      'SELECT * FROM sp_actualizar_cliente($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        req.params.id,
        merged.nombre,
        merged.telefono,
        merged.correo,
        merged.id_nivel_precio,
        merged.activo,
        merged.rfc,
        merged.razon_social,
        merged.cp_fiscal,
        merged.regimen_fiscal,
        merged.uso_cfdi,
      ]
    )

    const { p_mensaje } = rows[0]
    if (p_mensaje !== 'Cliente actualizado correctamente.') {
      return res.status(400).json({ message: p_mensaje })
    }

    const { rows: clienteRows } = await query(`
      SELECT c.*,
        json_build_object('id_nivel_precio', n.id_nivel_precio, 'nombre', n.nombre) AS nivel_precio
      FROM cliente c LEFT JOIN nivel_precio n ON n.id_nivel_precio = c.id_nivel_precio
      WHERE c.id_cliente=$1
    `, [req.params.id])
    ok(res, clienteRows[0])
  } catch (e) { err(res, e) }
})

module.exports = router
