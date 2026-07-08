const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

router.post('/egresos', async (req, res) => {
    const { description, monto, user_insert } = req.body
    try {
        const { rows } = await query('SELECT * FROM sp_insertar_egreso($1,$2,$3)',[description,monto,user_insert])
        const row = rows[0]
        ok(res, { id_egreso: row.p_id_egreso, mensaje: row.p_mensaje })
    } catch (e) { err(res, e) }
})


router.get('/egresos',async(req,res)=>{
  try{
    const{rows} =await query ('SELECT * FROM v_egresos')
    ok(res,rows)

  }catch (e){err(res,e)}

})


module.exports = router