const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// ── Convertir cotización a pedido ─────────────────────────────────────────

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
    ok(res, { id_pedido: row.out_id_pedido, folio: row.out_folio })
  } catch (e) { err(res, e) }
})

// ── Crear pedido directo ──────────────────────────────────────────────────

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
    ok(res, { id_pedido: row.out_id_pedido, folio: row.out_folio })
  } catch (e) { err(res, e) }
})

// ── Pedidos pendientes ────────────────────────────────────────────────────

router.get('/pedidos/pendientes', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM sp_obtener_pedidos_pendientes()')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Historial de ventas ───────────────────────────────────────────────────

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

// ── Exportar Excel ────────────────────────────────────────────────────────

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

// ── Detalle de pedido ─────────────────────────────────────────────────────

router.get('/pedidos/:id', async (req, res) => {
  try {
    const id = req.params.id
    const [cabRes, partRes, procRes] = await Promise.all([
      query('SELECT * FROM sp_obtener_cabecera_pedido($1)', [id]),
      query('SELECT * FROM sp_obtener_partidas_pedido($1)', [id]),
      query('SELECT * FROM sp_obtener_procesos_pedido($1)', [id]),
    ])
    if (!cabRes.rows.length) return res.status(404).json({ message: 'Pedido no encontrado' })
    ok(res, { cabecera: cabRes.rows[0], partidas: partRes.rows, procesos: procRes.rows })
  } catch (e) { err(res, e) }
})

// ── Marcar como entregado ─────────────────────────────────────────────────

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
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
})

module.exports = router
