const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// ── Consulta de pedidos ───────────────────────────────────────────────────────
// Todos los pedidos (cualquier tipo y estatus) creados en un rango de fechas.
// GET /api/consulta-pedidos?fecha_inicio=...&fecha_fin=...
// No va bajo /pedidos/... porque /pedidos/:id (en pedidos.js) lo atraparía.

router.get('/consulta-pedidos', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    if (!fecha_inicio || !fecha_fin) {
      return err(res, new Error('fecha_inicio y fecha_fin son obligatorias'), 400)
    }
    const { rows } = await query(
      'SELECT * FROM sp_consulta_pedidos($1::timestamptz, $2::timestamptz)',
      [fecha_inicio, fecha_fin]
    )
    ok(res, rows)
  } catch (e) { err(res, e) }
})

module.exports = router
