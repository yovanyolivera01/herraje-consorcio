const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// ── Partidas de vidrio de pedidos entregados ──────────────────────────────

router.get('/reportes/partidas-vidrio', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    const { rows } = await query(`
      SELECT
        pp.id_partida_pedido,
        pp.id_pedido,
        p.folio,
        p.fecha_entrega,
        p.tipo_pago,
        COALESCE(c.nombre, 'Mostrador') AS cliente_nombre,
        tv.clave                        AS clave_vidrio,
        tv.descripcion                  AS nombre_vidrio,
        pp.largo_cm,
        pp.ancho_cm,
        COALESCE(pp.metros_cuadrados, 0) AS metros2,
        COALESCE(pp.cantidad, 1)         AS cantidad,
        pp.precio_m2,
        pp.subtotal_vidrio,
        pp.subtotal_procesos,
        pp.total_partida
      FROM partida_pedido pp
      JOIN pedido p ON p.id_pedido = pp.id_pedido
      LEFT JOIN cliente    c  ON c.id_cliente     = p.id_cliente
      LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pp.id_tipo_vidrio
      WHERE p.tipo_pedido = 'VIDRIO'
        AND p.estatus     = 'ENTREGADO'
        AND ($1::date IS NULL OR p.fecha_entrega >= $1::date)
        AND ($2::date IS NULL OR p.fecha_entrega <= $2::date)
      ORDER BY p.fecha_entrega DESC
    `, [fecha_inicio || null, fecha_fin || null])
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Extras de maquila de pedidos entregados ───────────────────────────────

router.get('/reportes/extras-maquila', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    const { rows } = await query(`
      SELECT
        e.id_partida_extra,
        p.id_pedido,
        p.folio,
        COALESCE(p.fecha_entrega, p.fecha_creacion) AS fecha_entrega_iso,
        p.tipo_pago,
        COALESCE(c.nombre, 'Mostrador') AS cliente_nombre,
        e.descripcion,
        e.unidad,
        e.cantidad,
        e.precio_unitario,
        e.subtotal
      FROM partida_cotizacion_extra e
      JOIN pedido p ON p.id_cotizacion = e.id_cotizacion
      LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
      WHERE p.tipo_pedido = 'VIDRIO'
        AND p.estatus     = 'ENTREGADO'
        AND e.tipo        = 'MAQUILA'
        AND ($1::date IS NULL OR COALESCE(p.fecha_entrega, p.fecha_creacion) >= $1::date)
        AND ($2::date IS NULL OR COALESCE(p.fecha_entrega, p.fecha_creacion) <= $2::date)
      ORDER BY fecha_entrega_iso DESC
    `, [fecha_inicio || null, fecha_fin || null])
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Extras de herraje de pedidos entregados ───────────────────────────────

router.get('/reportes/extras-herraje', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    const { rows } = await query(`
      SELECT
        e.id_partida_extra,
        p.id_pedido,
        p.folio,
        COALESCE(p.fecha_entrega, p.fecha_creacion) AS fecha_entrega_iso,
        p.tipo_pago,
        COALESCE(c.nombre, 'Mostrador') AS cliente_nombre,
        e.descripcion,
        e.unidad,
        e.cantidad,
        e.precio_unitario,
        e.subtotal
      FROM partida_cotizacion_extra e
      JOIN pedido p ON p.id_cotizacion = e.id_cotizacion
      LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
      WHERE p.tipo_pedido = 'VIDRIO'
        AND p.estatus     = 'ENTREGADO'
        AND e.tipo        = 'PRODUCTO'
        AND ($1::date IS NULL OR COALESCE(p.fecha_entrega, p.fecha_creacion) >= $1::date)
        AND ($2::date IS NULL OR COALESCE(p.fecha_entrega, p.fecha_creacion) <= $2::date)
      ORDER BY fecha_entrega_iso DESC
    `, [fecha_inicio || null, fecha_fin || null])
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Ventas directas de herraje ────────────────────────────────────────────

router.get('/reportes/ventas-herraje', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    const { rows } = await query(`
      SELECT
        CONCAT('vta-', dv.id) AS id,
        v.folio,
        v.fecha_hora,
        COALESCE(p.descripcion, pg.nombre, '') AS descripcion,
        COALESCE(p.tono, pg.unidad, 'pza')    AS unidad,
        dv.cantidad,
        dv.precio_unitario,
        dv.subtotal
      FROM detalle_venta dv
      JOIN ventas v ON v.id = dv.venta_id
      LEFT JOIN productos       p  ON p.id                  = dv.producto_id
      LEFT JOIN producto_general pg ON pg.id_producto_general = dv.id_producto_general
      WHERE ($1::date IS NULL OR v.fecha_hora >= $1::date)
        AND ($2::date IS NULL OR v.fecha_hora <= $2::date)
      ORDER BY v.fecha_hora DESC
    `, [fecha_inicio || null, fecha_fin || null])
    ok(res, rows)
  } catch (e) { err(res, e) }
})

module.exports = router
