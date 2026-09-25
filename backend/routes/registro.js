const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// Registro del día de hoy para un empleado (o ninguno si aún no ha marcado
// entrada) — usado para saber si el botón debe ofrecer "entrada" o "salida".
router.get('/registro/hoy/:id_empleado', async (req, res) => {
    try {
        const { rows } = await query('SELECT * FROM sp_obtener_registro_hoy($1)', [req.params.id_empleado])
        // sp_obtener_registro_hoy RETURNS registro (not SETOF) — with no
        // match it still returns one row, just with every column NULL.
        ok(res, rows[0]?.id_registro == null ? null : rows[0])
    } catch (e) { err(res, e) }
})

// Check-in: registra la llegada del empleado (hora_salida queda NULL hasta el check-out)
router.post('/registro', async (req, res) => {
    try {
        const { id_empleado, id_turno, fecha, hora_entrada, created_at } = req.body

        const { rows } = await query(
            'SELECT * FROM sp_registro($1,$2,$3,$4,$5)',
            [id_empleado, id_turno, fecha, hora_entrada, created_at || new Date()]
        )
        ok(res, rows[0])
    } catch (e) { err(res, e) }
})

// Check-out: solo registra la hora de salida de un registro existente
router.put('/registro/:id_registro', async (req, res) => {
    try {
        const { hora_salida } = req.body

        const { rows } = await query(
            'SELECT * FROM sp_update_registro($1,$2)',
            [req.params.id_registro, hora_salida]
        )
        ok(res, rows[0])
    } catch (e) { err(res, e) }
})

module.exports = router
