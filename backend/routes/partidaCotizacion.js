const express = require('express')
const { query, pool } = require('../db')
const router = express.Router()

function ok(res, data)  { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// Una partida VIDRIO (partida + partida_vidrio + sus procesos) se inserta
// con sp_insertar_partida_vidrio (migración 054), que delega en
// sp_insertar_partida_vidrio_por_pieza cuando es_por_pieza = true. Luego
// se lee con sp_select_partida para regresar el formato de siempre.
async function insertVidrio(client, id_cotizacion, partida) {
  const { rows } = await client.query(
    'SELECT sp_insertar_partida_vidrio($1, $2) AS id_partida',
    [id_cotizacion, JSON.stringify(partida)]
  )
  const { rows: pRows } = await client.query('SELECT * FROM sp_select_partida($1)', [rows[0].id_partida])
  return pRows[0]
}

async function insertProceso(client, id_partida, proc, piezas) {
  const precio_por_pieza = piezas ? Math.round((proc.subtotal / piezas) * 100) / 100 : null
  await client.query(
    `INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal, sides, precio_por_pieza)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id_partida, proc.id_proceso, proc.id_unidad_cobro, proc.cantidad, proc.precio_unitario, proc.subtotal,
     proc.sidesML ? JSON.stringify(proc.sidesML) : null, precio_por_pieza]
  )
}

const INSERT_MAQUILA = `
  INSERT INTO partida (id_cotizacion, tipo, descripcion, largo_cm, ancho_cm, metros2, metros2_pieza, cantidad, subtotal_procesos, precio_unitario, subtotal, observaciones, id_espesor)
  VALUES ($1,'MAQUILA',$2,$3,$4,$5,ROUND($5::NUMERIC / NULLIF($6::NUMERIC,0), 4),$6::NUMERIC,$7,ROUND($8::NUMERIC / NULLIF($6::NUMERIC,0), 2),$8,$9,$10)
  RETURNING id_partida, id_cotizacion, descripcion, largo_cm, ancho_cm, metros2, metros2_pieza, cantidad, subtotal_procesos, precio_unitario, subtotal, observaciones, id_espesor
`

// Job de maquila dimensionado (largo_cm/ancho_cm reales) — mismo
// tratamiento CTI que un VIDRIO: fila en `partida` + una fila en
// `partida_proceso` por cada proceso adjunto (via insertProceso, ya
// genérico sobre id_partida/piezas).
async function insertMaquila(client, id_cotizacion, m) {
  const { rows } = await client.query(INSERT_MAQUILA, [
    id_cotizacion, m.descripcion || null, m.largo_cm, m.ancho_cm, m.metros2,
    m.cantidad ?? 1, m.subtotal_procesos ?? 0, m.subtotal_partida, m.observaciones || null, m.id_espesor ?? null,
  ])
  const p = rows[0]
  if (m.procesos?.length) {
    for (const proc of m.procesos) await insertProceso(client, p.id_partida, proc, m.cantidad ?? 1)
  }
  return p
}

// ── Agregar una partida a una cotización ──────────────────────────────────

router.post('/cotizaciones/:id/partidas', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const p = await insertVidrio(client, req.params.id, req.body)
    await client.query('COMMIT')
    ok(res, p)
  } catch (e) {
    await client.query('ROLLBACK')
    err(res, e)
  } finally {
    client.release()
  }
})

// ── Agregar un job de maquila dimensionado a una cotización ───────────────

router.post('/cotizaciones/:id/maquilas', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const p = await insertMaquila(client, req.params.id, req.body)
    await client.query('COMMIT')
    ok(res, p)
  } catch (e) {
    await client.query('ROLLBACK')
    err(res, e)
  } finally {
    client.release()
  }
})

// ── Actualizar cotización completa (cabecera + partidas) ──────────────────

router.put('/cotizaciones/:id/actualizar', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { id_nivel_precio, id_cliente, partidas, maquilas, total } = req.body

    // Borrar partidas existentes (satelites y procesos hijos se borran en cascada)
    await client.query("DELETE FROM partida WHERE id_cotizacion=$1 AND tipo='VIDRIO'", [req.params.id])
    await client.query("DELETE FROM partida WHERE id_cotizacion=$1 AND tipo='MAQUILA' AND largo_cm IS NOT NULL", [req.params.id])

    // Actualizar cabecera
    await client.query(
      `UPDATE cotizacion SET id_nivel_precio=$1, id_cliente=$2, total=$3, estatus='FINALIZADA'
       WHERE id_cotizacion=$4`,
      [id_nivel_precio, id_cliente || null, Number(total), req.params.id]
    )

    // Re-insertar partidas
    for (const partida of (partidas ?? [])) {
      await insertVidrio(client, req.params.id, partida)
    }

    for (const m of (maquilas ?? [])) {
      await insertMaquila(client, req.params.id, m)
    }

    await client.query('COMMIT')
    ok(res, { ok: true })
  } catch (e) {
    await client.query('ROLLBACK')
    err(res, e)
  } finally {
    client.release()
  }
})

module.exports = router
