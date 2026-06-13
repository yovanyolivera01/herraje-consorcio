const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// ── Convertir cotización a pedido ─────────────────────────────────────────────

router.post('/pedidos/convertir', async (req, res) => {
  try {
    const { id_cotizacion, tipo_pago, monto_anticipo } = req.body
    const { rows } = await query(
      'SELECT * FROM sp_convertir_cotizacion_a_pedido($1, $2, $3)',
      [id_cotizacion, tipo_pago, Number(monto_anticipo)]
    )
    const row = rows[0]
    if (!row || row.out_mensaje?.startsWith('ERROR')) {
      return res.status(400).json({ message: row?.out_mensaje ?? 'Error al convertir cotización' })
    }

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
    const { id_cliente, id_nivel_precio, partidas, tipo_pago, monto_anticipo } = req.body
    const { rows } = await query(
      'SELECT * FROM sp_crear_pedido_directo($1, $2, $3, $4, $5)',
      [id_cliente ?? null, id_nivel_precio, tipo_pago, Number(monto_anticipo), JSON.stringify(partidas)]
    )
    const row = rows[0]
    if (!row || row.out_mensaje?.startsWith('ERROR')) {
      return res.status(400).json({ message: row?.out_mensaje ?? 'Error al crear el pedido' })
    }
    try { await query('SELECT sp_insertar_pedidod($1)', [row.out_id_pedido]) } catch {}
    ok(res, { id_pedido: row.out_id_pedido, folio: row.out_folio })
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

// ── Detalle de pedido ─────────────────────────────────────────────────────────

router.get('/pedidos/:id', async (req, res) => {
  try {
    const id = req.params.id
    const [cabRes, partRes, procRes] = await Promise.all([
      query('SELECT * FROM sp_obtener_cabecera_pedido($1)', [id]),
      query('SELECT * FROM sp_obtener_partidas_pedido($1)', [id]),
      query('SELECT * FROM sp_obtener_procesos_pedido($1)', [id]),
    ])
    if (!cabRes.rows.length) return res.status(404).json({ message: 'Pedido no encontrado' })

    const cab = cabRes.rows[0]
    let extras = []
    const id_cotizacion = cab.id_cotizacion ?? null
    if (id_cotizacion) {
      try {
        const extRes = await query(
          'SELECT tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, notas FROM partida_cotizacion_extra WHERE id_cotizacion=$1 ORDER BY id_partida_extra',
          [id_cotizacion]
        )
        extras = extRes.rows
      } catch {}
    }

    ok(res, { cabecera: cab, partidas: partRes.rows, procesos: procRes.rows, extras })
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

module.exports = router
