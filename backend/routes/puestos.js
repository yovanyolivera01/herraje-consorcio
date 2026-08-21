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




module.exports = router
