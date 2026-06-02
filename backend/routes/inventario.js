const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

function ROUND4(n) { return Math.round(n * 10000) / 10000 }

// ── Inventario de vidrio ──────────────────────────────────────────────────

router.get('/inventario-vidrio', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM v_inventario_vidrio ORDER BY tipo_vidrio')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/inventario-vidrio', async (req, res) => {
  try {
    const { id_tipo_vidrio, largo_cm, ancho_cm, cantidad_hojas } = req.body
    const { rows } = await query(
      'SELECT * FROM sp_registrar_inventario_vidrio($1, $2, $3, $4)',
      [id_tipo_vidrio, Number(largo_cm), Number(ancho_cm), Number(cantidad_hojas)]
    )
    const row = rows[0]
    if (!row || row.p_id_inventario === 0) throw new Error(row?.p_mensaje ?? 'Error al registrar')
    ok(res, { id_inventario: row.p_id_inventario, m2_total: Number(row.p_m2_total), mensaje: row.p_mensaje })
  } catch (e) { err(res, e) }
})

router.post('/inventario-vidrio/:id/preferido', async (req, res) => {
  try {
    const { rows: lote } = await query(
      'SELECT id_tipo_vidrio FROM inventario_vidrio WHERE id_inventario = $1',
      [req.params.id]
    )
    if (!lote.length) return res.status(404).json({ message: 'Lote no encontrado' })
    await query('UPDATE inventario_vidrio SET es_preferido = false WHERE id_tipo_vidrio = $1', [lote[0].id_tipo_vidrio])
    await query('UPDATE inventario_vidrio SET es_preferido = true  WHERE id_inventario  = $1', [req.params.id])
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
})

router.post('/inventario-vidrio/:id/ajustar', async (req, res) => {
  try {
    const { hojas_delta, nota } = req.body
    const { rows: invRows } = await query(
      'SELECT cantidad_hojas, m2_disponible, m2_por_hoja, m2_total_inicial, hojas_entrada FROM inventario_vidrio WHERE id_inventario = $1',
      [req.params.id]
    )
    if (!invRows.length) return res.status(404).json({ message: 'Lote no encontrado' })

    const inv          = invRows[0]
    const m2_hoja      = Number(inv.m2_por_hoja)
    const m2_ajuste    = ROUND4(hojas_delta * m2_hoja)
    const nuevas_hojas = Number(inv.cantidad_hojas) + hojas_delta
    const nuevo_saldo  = ROUND4(Number(inv.m2_disponible) + m2_ajuste)

    if (nuevas_hojas < 0) return res.status(400).json({ message: 'El ajuste resultaría en hojas negativas' })
    if (nuevo_saldo  < 0) return res.status(400).json({ message: 'El ajuste resultaría en m² negativo' })

    const nuevo_total = hojas_delta > 0
      ? ROUND4(Number(inv.m2_total_inicial) + m2_ajuste)
      : Number(inv.m2_total_inicial)

    await query(
      `UPDATE inventario_vidrio SET cantidad_hojas=$1, m2_disponible=$2
       ${hojas_delta > 0 ? ', m2_total_inicial=$3, hojas_entrada=hojas_entrada+$4' : ''}
       WHERE id_inventario=$5`,
      hojas_delta > 0
        ? [nuevas_hojas, nuevo_saldo, nuevo_total, hojas_delta, req.params.id]
        : [nuevas_hojas, nuevo_saldo, req.params.id]
    )

    await query(
      `INSERT INTO movimiento_inventario_vidrio
         (id_inventario, tipo_movimiento, m2_cantidad, m2_saldo_resultante, nota)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, hojas_delta > 0 ? 'ENTRADA' : 'AJUSTE',
       Math.abs(m2_ajuste), nuevo_saldo,
       nota ?? `${hojas_delta > 0 ? 'Entrada' : 'Descuento'}: ${Math.abs(hojas_delta)} hoja(s)`]
    )

    ok(res, { cantidad_hojas: nuevas_hojas, m2_disponible: nuevo_saldo })
  } catch (e) { err(res, e) }
})

router.get('/inventario-vidrio/:id/movimientos', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM movimiento_inventario_vidrio WHERE id_inventario = $1 ORDER BY fecha DESC',
      [req.params.id]
    )
    ok(res, rows)
  } catch (e) { err(res, e) }
})

module.exports = router
