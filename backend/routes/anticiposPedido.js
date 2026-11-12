const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }


// Consulta el pedido
router.get('/anticipos/:id_cliente',async (req, res) => {
    try {
        const { rows } = await query('SELECT * FROM v_pedido_anticipos WHERE id_cliente = $1', [req.params.id_cliente])   
        ok(res, rows)
    } catch (e) {
        err(res, e)
    }   

})


// see the saldo pendiente de un cliente, para saber si puede pedir un anticipo
router.get('/saldo/:id_cliente', async (req, res) => {
    try {
        // Suma el saldo de todos los pedidos del cliente (sale de la vista v_pedido_anticipos)
        const { rows } = await query(
            'SELECT COALESCE(SUM(saldo), 0) AS saldo FROM v_pedido_anticipos WHERE id_cliente = $1',
            [req.params.id_cliente]
        )
        ok(res, rows)
    } catch (e) {
        err(res, e)
    }
})


// Resumen de anticipos de un pedido (sale de la vista v_pedido_anticipos)
router.get('/anticipo-pedido/:id_pedido', async (req, res) => {
    try {
        const { rows } = await query('SELECT * FROM v_pedido_anticipos WHERE id_pedido = $1', [req.params.id_pedido])
        if (!rows.length) return err(res, new Error('Pedido no encontrado'), 404)
        ok(res, rows[0])
    } catch (e) {
        err(res, e)
    }
})


// insert a row in the table anticipos_pedidos
router.post('/anticipo', async (req, res) => {
    try {
        const { id_pedido, id_cliente, id_metodo_pago, monto, fecha_hora, referencia, observaciones } = req.body
        if (!id_pedido || !id_metodo_pago || !(Number(monto) > 0)) {
            return err(res, new Error('id_pedido, id_metodo_pago y monto (mayor a 0) son obligatorios'), 400)
        }
        // Mismo orden que los parametros del SP
        const { rows } = await query(
            'SELECT sp_insert_anticipo_pedido($1, $2, $3, $4, $5, $6, $7) AS id_anticipo',
            [id_pedido, id_cliente ?? null, id_metodo_pago, Number(monto), fecha_hora ?? null, referencia ?? null, observaciones ?? null]
        )
        res.status(201).json(rows[0])
    } catch (e) {
        // P0001 = RAISE EXCEPTION del SP (monto mayor al saldo, pedido cancelado, etc.)
        err(res, e, e.code === 'P0001' ? 400 : 500)
    }
})



module.exports = router