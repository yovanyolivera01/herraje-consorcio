const express = require('express')
const { query, pool } = require('../db')
const router = express.Router()


function ok(res, data)  { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }


router.get('/', async (req,res) =>{


    try {
        const pedidos = await query('SELECT * FROM sp_consulta_pedidos()')
        ok(res, pedidos)
    } catch (e) {
        err(res, e)
    }


})