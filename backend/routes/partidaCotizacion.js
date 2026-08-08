const express = require('express')
const { query, pool } = require('../db')
const router = express.Router()

function ok(res, data)  { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// VIDRIO's glass-specific columns (id_tipo_vidrio, precio_m2,
// subtotal_vidrio, es_hoja_completa) live in `partida_vidrio`, NOT NULL
// there — the database itself rejects a VIDRIO row with no glass type.
// The SELECT below re-joins it so the API response shape matches the
// old single-table one exactly.
//
// Processes attached to a VIDRIO piece are NOT their own `partida` row
// — they're a row in `partida_proceso` pointing straight at the piece
// via id_partida (id_proceso/id_unidad_cobro/cantidad/precio_unitario/
// subtotal all live there together).

const INSERT_VIDRIO_JOINED = `
WITH ins AS (
  INSERT INTO partida (id_cotizacion, tipo, largo_cm, ancho_cm, metros2, cantidad, subtotal_procesos, precio_unitario, subtotal, observaciones)
  VALUES ($1,'VIDRIO',$2,$3,$4,$5::NUMERIC,$6,ROUND($7::NUMERIC / NULLIF($5::NUMERIC,0), 2),$7,$8)
  RETURNING id_partida, id_cotizacion, largo_cm, ancho_cm, metros2, cantidad, subtotal_procesos, precio_unitario, subtotal, observaciones
),
insv AS (
  INSERT INTO partida_vidrio (id_partida, id_tipo_vidrio, precio_m2, es_hoja_completa, subtotal_vidrio, precio_vidrio)
  SELECT id_partida, $9, $10, $11, $12, ROUND($12::NUMERIC / NULLIF($5::NUMERIC,0), 2) FROM ins
  RETURNING id_partida, id_tipo_vidrio, precio_m2, es_hoja_completa, subtotal_vidrio, precio_vidrio
)
SELECT
  ins.id_partida, ins.id_cotizacion, insv.id_tipo_vidrio,
  ins.cantidad AS piezas, ins.largo_cm, ins.ancho_cm, ins.metros2,
  insv.precio_m2 AS precio_m2_aplicado,
  insv.subtotal_vidrio, insv.precio_vidrio, ins.subtotal_procesos, ins.precio_unitario,
  ins.subtotal AS subtotal_partida,
  insv.es_hoja_completa, ins.observaciones
FROM ins JOIN insv ON insv.id_partida = ins.id_partida
`

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
  INSERT INTO partida (id_cotizacion, tipo, descripcion, largo_cm, ancho_cm, metros2, cantidad, subtotal_procesos, precio_unitario, subtotal, observaciones, id_espesor)
  VALUES ($1,'MAQUILA',$2,$3,$4,$5,$6::NUMERIC,$7,ROUND($8::NUMERIC / NULLIF($6::NUMERIC,0), 2),$8,$9,$10)
  RETURNING id_partida, id_cotizacion, descripcion, largo_cm, ancho_cm, metros2, cantidad, subtotal_procesos, precio_unitario, subtotal, observaciones, id_espesor
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
    const partida = req.body
    const { rows: pRows } = await client.query(INSERT_VIDRIO_JOINED, [
      req.params.id,
      partida.largo_cm,
      partida.ancho_cm,
      partida.metros2,
      partida.piezas ?? 1,
      partida.subtotal_procesos ?? 0,
      partida.subtotal_partida,
      partida.observaciones || null,
      partida.id_tipo_vidrio,
      partida.precio_m2_aplicado,
      partida.es_hoja_completa ?? false,
      partida.subtotal_vidrio,
    ])

    const p = pRows[0]
    if (partida.procesos?.length) {
      for (const proc of partida.procesos) {
        await insertProceso(client, p.id_partida, proc, partida.piezas ?? 1)
      }
    }

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
      const { rows: pRows } = await client.query(INSERT_VIDRIO_JOINED, [
        req.params.id,
        partida.largo_cm,
        partida.ancho_cm,
        partida.metros2,
        partida.piezas ?? 1,
        partida.subtotal_procesos ?? 0,
        partida.subtotal_partida,
        partida.observaciones || null,
        partida.id_tipo_vidrio,
        partida.precio_m2_aplicado,
        partida.es_hoja_completa ?? false,
        partida.subtotal_vidrio,
      ])
      if (partida.procesos?.length) {
        for (const proc of partida.procesos) {
          await insertProceso(client, pRows[0].id_partida, proc, partida.piezas ?? 1)
        }
      }
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
