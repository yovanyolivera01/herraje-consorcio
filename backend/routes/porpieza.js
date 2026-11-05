const express = require('express')
const { pool } = require('../db')
const router = express.Router()

function ok(res, data)  { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// Vidrio vendido POR PIEZA. El cálculo de precio y el insert (partida +
// partida_vidrio con es_por_pieza = TRUE + procesos) los hace el SP
// sp_insertar_partida_vidrio_por_pieza (migración 054) a partir de
// precio_pieza; los subtotales que mande el front se ignoran.
//
// Body esperado: { id_tipo_vidrio, piezas, precio_pieza, largo_cm, ancho_cm,
//                  metros2?, observaciones?, procesos?: [...] }

// Mismo formato de respuesta que POST /cotizaciones/:id/partidas, más
// es_por_pieza. La consulta vive en el SP sp_select_partida (migración 054).
const SELECT_PARTIDA = 'SELECT * FROM sp_select_partida($1)'

// Inserta la partida por pieza usando un client que ya está dentro de una
// transacción. (POST /cotizaciones/:id/partidas también acepta
// es_por_pieza = true: sp_insertar_partida_vidrio delega en este mismo SP.)
async function insertarPartidaPorPieza(client, id_cotizacion, partida) {
  const { rows } = await client.query(
    'SELECT sp_insertar_partida_vidrio_por_pieza($1, $2) AS id_partida',
    [id_cotizacion, JSON.stringify(partida)]
  )
  const { rows: pRows } = await client.query(SELECT_PARTIDA, [rows[0].id_partida])
  return pRows[0]
}

// ── Agregar una partida de vidrio por pieza a una cotización ──────────────

router.post('/cotizaciones/:id/partidas-por-pieza', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const p = await insertarPartidaPorPieza(client, req.params.id, req.body)
    await client.query('COMMIT')
    ok(res, p)
  } catch (e) {
    await client.query('ROLLBACK')
    // Las validaciones del SP (RAISE EXCEPTION) son errores del usuario
    err(res, e, e.code === 'P0001' ? 400 : 500)
  } finally {
    client.release()
  }
})

module.exports = router
