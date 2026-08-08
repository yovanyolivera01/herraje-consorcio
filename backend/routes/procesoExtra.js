const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data)  { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// ── Partidas extra (maquila / productos / proceso extra) ──────────────────
// Stored in the unified `partida` table: tipo IN ('MAQUILA','PRODUCTO','EXTRA'),
// largo_cm IS NULL (never dimensioned — that's what separates an extra line
// item from a real maquila-job partida).

const EXTRA_WHERE = `tipo IN ('MAQUILA','PRODUCTO','EXTRA') AND largo_cm IS NULL`

router.get('/cotizaciones/:id/extras', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id_partida AS id_partida_extra, id_cotizacion, tipo, descripcion, unidad,
              cantidad, precio_unitario, subtotal, id_producto_general, notas,
              fecha_registro AS created_at, observaciones
       FROM partida WHERE id_cotizacion=$1 AND ${EXTRA_WHERE} ORDER BY id_partida`,
      [req.params.id]
    )
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/cotizaciones/:id/extras', async (req, res) => {
  try {
    const { tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones } = req.body
    const { rows } = await query(
      `INSERT INTO partida
         (id_cotizacion, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id_partida AS id_partida_extra, id_cotizacion, tipo, descripcion, unidad,
                 cantidad, precio_unitario, subtotal, id_producto_general, notas,
                 fecha_registro AS created_at, observaciones`,
      [req.params.id, tipo, descripcion, unidad ?? 'pza', Number(cantidad),
       Number(precio_unitario), Number(subtotal), id_producto_general ?? null, notas ?? null, observaciones ?? null]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.delete('/cotizaciones/:id/extras', async (req, res) => {
  try {
    await query(`DELETE FROM partida WHERE id_cotizacion=$1 AND ${EXTRA_WHERE}`, [req.params.id])
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
})

module.exports = router
