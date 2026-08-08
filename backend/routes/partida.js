const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// ── Partidas itemizadas para facturación (CFDI) ───────────────────────────────

router.get('/pedidos/:id/partidas-factura', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM sp_getPartidasForFactura($1)', [req.params.id])
    ok(res, rows)
  } catch (e) { err(res, e) }
})

module.exports = router
