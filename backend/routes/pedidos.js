const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

async function guardarObsPartidas(id_pedido, obs) {
  if (!obs || !obs.some(o => o)) return
  const { rows } = await query(
    "SELECT id_partida FROM partida WHERE id_pedido=$1 AND tipo='VIDRIO' ORDER BY id_partida ASC",
    [id_pedido]
  )
  for (let i = 0; i < Math.min(rows.length, obs.length); i++) {
    if (obs[i]) await query('UPDATE partida SET observaciones=$1 WHERE id_partida=$2', [obs[i], rows[i].id_partida])
  }
}

// ── Convertir cotización a pedido ─────────────────────────────────────────────

router.post('/pedidos/convertir', async (req, res) => {
  try {
    const { id_cotizacion, tipo_pago, monto_anticipo, metodo_pago, observaciones, partidas_obs } = req.body
    const { rows } = await query(
      'SELECT * FROM sp_convertir_cotizacion_a_pedido($1, $2, $3)',
      [id_cotizacion, tipo_pago, Number(monto_anticipo)]
    )
    const row = rows[0]
    if (!row || row.out_mensaje?.startsWith('ERROR')) {
      return res.status(400).json({ message: row?.out_mensaje ?? 'Error al convertir cotización' })
    }
    // Ensure id_cotizacion is always linked (SP may skip it when no vidrio partidas)
    await query('UPDATE pedido SET id_cotizacion=$1 WHERE id_pedido=$2 AND id_cotizacion IS NULL', [id_cotizacion, row.out_id_pedido])
    // If cotización had no vidrio partidas, mark pedido as MAQUILA
    try {
      const { rows: pcRows } = await query("SELECT COUNT(*) AS cnt FROM partida WHERE id_cotizacion=$1 AND tipo='VIDRIO'", [id_cotizacion])
      if (Number(pcRows[0].cnt) === 0) {
        await query("UPDATE pedido SET tipo_pedido='MAQUILA' WHERE id_pedido=$1", [row.out_id_pedido])
      }
    } catch {}
    if (metodo_pago) await query('UPDATE pedido SET metodo_pago=$1 WHERE id_pedido=$2', [metodo_pago, row.out_id_pedido])
    if (observaciones) await query('UPDATE pedido SET observaciones=$1 WHERE id_pedido=$2', [observaciones, row.out_id_pedido])
    await guardarObsPartidas(row.out_id_pedido, partidas_obs)

    // Descontar inventario de vidrio
    try {
      await query('SELECT sp_decrementar_inventario_vidrio($1, $2)', [id_cotizacion, row.out_folio ?? ''])
    } catch (invErr) {
      console.error('[inventario] No se pudo descontar stock:', invErr.message)
    }

    try { await query('SELECT sp_insertar_pedidod($1)', [row.out_id_pedido]) } catch {}
    ok(res, { id_pedido: row.out_id_pedido, folio: row.out_folio })
  } catch (e) { err(res, e) }
})

// ── Crear pedido directo ──────────────────────────────────────────────────────

router.post('/pedidos/directo', async (req, res) => {
  try {
    const { id_cliente, id_nivel_precio, partidas, tipo_pago, monto_anticipo, metodo_pago, observaciones } = req.body
    const { rows } = await query(
      'SELECT * FROM sp_crear_pedido_directo($1, $2, $3, $4, $5)',
      [id_cliente ?? null, id_nivel_precio, tipo_pago, Number(monto_anticipo), JSON.stringify(partidas)]
    )
    const row = rows[0]
    if (!row || row.out_mensaje?.startsWith('ERROR')) {
      return res.status(400).json({ message: row?.out_mensaje ?? 'Error al crear el pedido' })
    }
    if (metodo_pago) await query('UPDATE pedido SET metodo_pago=$1 WHERE id_pedido=$2', [metodo_pago, row.out_id_pedido])
    if (observaciones) await query('UPDATE pedido SET observaciones=$1 WHERE id_pedido=$2', [observaciones, row.out_id_pedido])
    await guardarObsPartidas(row.out_id_pedido, (partidas ?? []).map(p => p.observaciones || null))
    try { await query('SELECT sp_insertar_pedidod($1)', [row.out_id_pedido]) } catch {}
    ok(res, { id_pedido: row.out_id_pedido, folio: row.out_folio })
  } catch (e) { err(res, e) }
})

// ── Crear pedido directo con extras (sin cotización) ─────────────────────────

router.post('/pedidos/directo-con-extras', async (req, res) => {
  try {
    const { id_cliente, id_nivel_precio, partidas, maquilas, tipo_pago, monto_anticipo, extras, total, metodo_pago, observaciones } = req.body

    const { rows } = await query(
      'SELECT * FROM sp_crear_pedido_directo($1, $2, $3, $4, $5, $6)',
      [id_cliente ?? null, id_nivel_precio, tipo_pago, Number(monto_anticipo), JSON.stringify(partidas ?? []), JSON.stringify(maquilas ?? [])]
    )
    const row = rows[0]
    if (!row || row.out_mensaje?.startsWith('ERROR')) {
      return res.status(400).json({ message: row?.out_mensaje ?? 'Error al crear el pedido' })
    }
    const id_pedido = row.out_id_pedido
    const folio     = row.out_folio

    // total (frontend grand total) also covers flat extras the SP never
    // sees — recompute saldo_pendiente here too, otherwise it stays at
    // whatever the SP derived from vidrio+maquila alone.
    if (total != null) {
      const saldo = tipo_pago === 'LIQUIDADO' ? 0 : Number(total) - Number(monto_anticipo)
      await query('UPDATE pedido SET total=$1, saldo_pendiente=$2 WHERE id_pedido=$3', [Number(total), saldo, id_pedido])
    }

    if (metodo_pago) await query('UPDATE pedido SET metodo_pago=$1 WHERE id_pedido=$2', [metodo_pago, id_pedido])
    if (observaciones) await query('UPDATE pedido SET observaciones=$1 WHERE id_pedido=$2', [observaciones, id_pedido])
    await guardarObsPartidas(id_pedido, (partidas ?? []).map(p => p.observaciones || null))
    for (const extra of (extras ?? [])) {
      await query(
        `INSERT INTO partida (id_pedido, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id_pedido, extra.tipo, extra.descripcion ?? '', extra.unidad ?? 'pza',
         Number(extra.cantidad), Number(extra.precio_unitario), Number(extra.subtotal),
         extra.id_producto_general ?? null, extra.notas ?? null, extra.observaciones ?? null]
      )
    }
    try { await query('SELECT sp_insertar_pedidod($1)', [id_pedido]) } catch {}
    ok(res, { id_pedido, folio })
  } catch (e) { err(res, e) }
})

// ── Decrementar inventario desde partidas (pedido directo sin cotización) ─────

router.post('/pedidos/decrementar-inventario', async (req, res) => {
  const { partidas = [], folioRef = '' } = req.body
  const byTipo = {}
  for (const p of partidas) {
    if (!p.id_tipo_vidrio) continue
    byTipo[p.id_tipo_vidrio] = (byTipo[p.id_tipo_vidrio] || 0) + Number(p.metros2 || 0)
  }

  try {
    for (const [tipoStr, total_m2] of Object.entries(byTipo)) {
      const id_tipo_vidrio = Number(tipoStr)
      const { rows: lotes } = await query(
        `SELECT id_inventario, m2_disponible FROM inventario_vidrio
         WHERE id_tipo_vidrio=$1
         ORDER BY es_preferido DESC, m2_disponible DESC LIMIT 1`,
        [id_tipo_vidrio]
      )
      if (!lotes.length) continue
      const lote = lotes[0]
      const nuevoSaldo = Math.max(Number(lote.m2_disponible) - total_m2, 0)
      await query('UPDATE inventario_vidrio SET m2_disponible=$1 WHERE id_inventario=$2', [nuevoSaldo, lote.id_inventario])
      await query(
        `INSERT INTO movimiento_inventario_vidrio (id_inventario, tipo_movimiento, m2_cantidad, m2_saldo_resultante, nota)
         VALUES ($1, 'SALIDA', $2, $3, $4)`,
        [lote.id_inventario, total_m2, nuevoSaldo, `Venta ${folioRef || 'directa'}`]
      )
    }
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
})

// ── Pedidos pendientes ────────────────────────────────────────────────────────

router.get('/pedidos/pendientes', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM sp_obtener_pedidos_pendientes($1)', ['VIDRIO'])
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Historial de ventas ───────────────────────────────────────────────────────

router.get('/pedidos/historial', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    const { rows } = await query(
      'SELECT * FROM sp_obtener_historial_ventas($1, $2)',
      [fecha_inicio || null, fecha_fin || null]
    )
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Exportar Excel ────────────────────────────────────────────────────────────

router.get('/pedidos/exportar', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    const { rows } = await query(
      'SELECT * FROM sp_exportar_excel_ventas($1, $2)',
      [fecha_inicio || null, fecha_fin || null]
    )
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Pedidos a crédito ─────────────────────────────────────────────────────────

router.get('/pedidos/credito', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM v_pedidos_por_cobrar')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Pedidos cancelados ────────────────────────────────────────────────────────

router.get('/pedidos/cancelados', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    const { rows } = await query(`
      SELECT
        p.id_pedido,
        p.folio,
        p.fecha_creacion,
        COALESCE(c.nombre, 'Mostrador') AS cliente,
        p.total,
        p.tipo_pago
      FROM pedido p
      LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
      WHERE p.estatus    = 'CANCELADO'
        AND p.tipo_pedido = 'VIDRIO'
        AND ($1::timestamptz IS NULL OR p.fecha_creacion >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR p.fecha_creacion <= $2::timestamptz)
      ORDER BY p.fecha_creacion DESC
    `, [fecha_inicio || null, fecha_fin || null])
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Detalle de pedido ─────────────────────────────────────────────────────────

router.get('/pedidos/:id', async (req, res) => {
  try {
    const id = req.params.id
    const [cabRes, partRes, procRes, mpRes] = await Promise.all([
      query('SELECT * FROM sp_obtener_cabecera_pedido($1)', [id]),
      query('SELECT * FROM sp_obtener_partidas_pedido($1)', [id]),
      query('SELECT * FROM sp_obtener_procesos_pedido($1)', [id]),
      query('SELECT metodo_pago FROM pedido WHERE id_pedido=$1', [id]),
    ])
    if (!cabRes.rows.length) return res.status(404).json({ message: 'Pedido no encontrado' })

    const cab = { ...cabRes.rows[0], metodo_pago: mpRes.rows[0]?.metodo_pago ?? null }
    let extras = []
    const id_cotizacion = cab.id_cotizacion ?? null
    const EXTRA_WHERE = `tipo IN ('MAQUILA','PRODUCTO','EXTRA') AND largo_cm IS NULL`
    if (id_cotizacion) {
      try {
        const extRes = await query(
          `SELECT tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, notas
           FROM partida WHERE id_cotizacion=$1 AND ${EXTRA_WHERE} ORDER BY id_partida`,
          [id_cotizacion]
        )
        extras = extRes.rows
      } catch {}
    } else {
      try {
        const extRes = await query(
          `SELECT tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, notas
           FROM partida WHERE id_pedido=$1 AND ${EXTRA_WHERE} ORDER BY id_partida`,
          [id]
        )
        extras = extRes.rows
      } catch {}
    }

    // Dimensioned MAQUILA jobs (real largo_cm/ancho_cm, own PROCESO children) —
    // separate from the flat MAQUILA/PRODUCTO/EXTRA charges above.
    let maquilas = []
    const maqRes = await query(
      `SELECT p.id_partida, p.descripcion, p.largo_cm, p.ancho_cm, p.cantidad, p.metros2, p.subtotal_procesos, p.subtotal,
              p.id_espesor, esp.etiqueta AS espesor_label
       FROM partida p
       LEFT JOIN espesor esp ON esp.id_espesor = p.id_espesor
       WHERE p.id_pedido=$1 AND p.tipo='MAQUILA' AND p.largo_cm IS NOT NULL
       ORDER BY p.id_partida`,
      [id]
    )
    if (maqRes.rows.length) {
      const { rows: procMaqRows } = await query(
        `SELECT pp.id_partida, pr.nombre AS proceso, uc.nombre AS unidad_cobro,
                pp.cantidad, pp.precio_unitario, pp.subtotal, pp.sides
         FROM partida_proceso pp
         LEFT JOIN proceso      pr ON pr.id_proceso      = pp.id_proceso
         LEFT JOIN unidad_cobro uc ON uc.id_unidad_cobro = pp.id_unidad_cobro
         WHERE pp.id_partida = ANY($1::int[])`,
        [maqRes.rows.map(r => r.id_partida)]
      )
      const procsPorMaquila = {}
      for (const pr of procMaqRows) {
        (procsPorMaquila[pr.id_partida] ??= []).push(pr)
      }
      maquilas = maqRes.rows.map(r => ({ ...r, procesos: procsPorMaquila[r.id_partida] ?? [] }))
    }

    ok(res, { cabecera: cab, partidas: partRes.rows, procesos: procRes.rows, extras, maquilas })
  } catch (e) { err(res, e) }
})

// ── Marcar como entregado ─────────────────────────────────────────────────────

router.post('/pedidos/:id/entregar', async (req, res) => {
  try {
    const { monto_cobrado } = req.body
    const { rows } = await query(
      'SELECT * FROM sp_marcar_pedido_entregado($1, $2)',
      [req.params.id, Number(monto_cobrado)]
    )
    const row = rows[0]
    if (!row?.exito) {
      return res.status(400).json({ message: row?.mensaje ?? 'Error al registrar la entrega' })
    }
    try { await query('SELECT sp_insertar_pedidod($1)', [req.params.id]) } catch {}
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
})

// ── Entregar partida específica ───────────────────────────────────────────────

router.post('/pedidos/:id/entregar-partida', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM sp_entregar_partida_pedido($1)',
      [req.params.id]
    )
    const row = rows[0]
    if (row?.p_mensaje?.includes('ya entregada') || row?.p_mensaje?.includes('no encontrad')) {
      return res.status(400).json({ message: row.p_mensaje })
    }
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
})

// ── Marcar anticipo como liquidado ────────────────────────────────────────────

router.post('/pedidos/:id/liquidar', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM sp_marcar_anticipo_liquidado($1)',
      [req.params.id]
    )
    const row = rows[0]
    if (row?.p_mensaje?.includes('no encontrado') || row?.p_mensaje?.includes('incorrecto')) {
      return res.status(400).json({ message: row.p_mensaje })
    }
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
})



// ── Cancelar pedido ───────────────────────────────────────────────────────────

router.post('/pedidos/:id/cancelar', async (req, res) => {
  try {
    const { rows } = await query(
      "UPDATE pedido SET estatus = 'CANCELADO' WHERE id_pedido = $1 RETURNING id_pedido",
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ message: 'Pedido no encontrado' })
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
})

module.exports = router
