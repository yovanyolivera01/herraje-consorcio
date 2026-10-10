const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// Asistencia con 4 marcas al día: entrada -> salida a comer -> regreso de
// comer -> salida. Reemplaza el flujo de 2 marcas de routes/registro.js
// (que se deja intacto para no romper nada existente). El orden se valida
// en la base de datos (sp_registrar_marca, migración 048).

// Registro de hoy del empleado, o null si aún no marca entrada. El
// frontend deduce la siguiente marca de las columnas que ya tienen hora.
router.get('/asistencia/hoy/:id_empleado', async (req, res) => {
    try {
        const { rows } = await query('SELECT * FROM sp_obtener_registro_hoy($1)', [req.params.id_empleado])
        // RETURNS registro (no SETOF): sin coincidencia llega una fila con todo NULL
        ok(res, rows[0]?.id_registro == null ? null : rows[0])
    } catch (e) { err(res, e) }
})

// Marca 1: entrada (crea el registro del día)
router.post('/asistencia/entrada', async (req, res) => {
    try {
        const { id_empleado, id_turno, fecha, hora, created_at } = req.body
        const { rows } = await query(
            'SELECT * FROM sp_registro($1,$2,$3,$4,$5)',
            [id_empleado, id_turno, fecha, hora, created_at || new Date()]
        )
        ok(res, rows[0])
    } catch (e) { err(res, e) }
})

// Marcas 2, 3 y 4 sobre un registro existente
const MARCAS = {
    'salida-comida':  'salida_comida',
    'regreso-comida': 'regreso_comida',
    'salida':         'salida',
}

for (const [ruta, marca] of Object.entries(MARCAS)) {
    router.put(`/asistencia/:id_registro/${ruta}`, async (req, res) => {
        try {
            const { rows } = await query(
                'SELECT * FROM sp_registrar_marca($1,$2,$3)',
                [req.params.id_registro, marca, req.body.hora]
            )
            ok(res, rows[0])
        } catch (e) {
            // Errores de orden/duplicado (RAISE EXCEPTION) son del cliente, no del servidor
            err(res, e, e.code === 'P0001' ? 400 : 500)
        }
    })
}

module.exports = router
