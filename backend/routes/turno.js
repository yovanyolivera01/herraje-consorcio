const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

router.get('/personal/turno', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM v_turnos')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/personal/turno', async (req, res) => {
  try {
    const { hora_inicio, hora_fin, tolerancia, dias_laborales, minutos_comida } = req.body
    const { rows } = await query(
      'SELECT * FROM public.sp_create_turno($1,$2,$3,$4,$5)',
      [
        hora_inicio?.trim(), hora_fin?.trim(), tolerancia ?? 0, dias_laborales ?? null, minutos_comida ?? 60,
      ]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

module.exports = router
