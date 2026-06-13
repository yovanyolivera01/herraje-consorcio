const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data)  { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// ── Proveedores ───────────────────────────────────────────────────────────────

router.get('/proveedores', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM proveedores ORDER BY nombre ASC')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/proveedores', async (req, res) => {
  const client = await require('../db').pool.connect()
  try {
    await client.query('BEGIN')
    const { nombre, telefono } = req.body
    const { rows: ins } = await client.query(
      'INSERT INTO proveedores (codigo, nombre, telefono) VALUES ($1, $2, $3) RETURNING id',
      ['__tmp__', nombre, telefono || null]
    )
    const id     = ins[0].id
    const codigo = 'PROV-' + String(id).padStart(4, '0')
    const { rows } = await client.query(
      'UPDATE proveedores SET codigo=$1 WHERE id=$2 RETURNING *',
      [codigo, id]
    )
    await client.query('COMMIT')
    ok(res, rows[0])
  } catch (e) {
    await client.query('ROLLBACK')
    err(res, e)
  } finally { client.release() }
})

router.put('/proveedores/:codigo', async (req, res) => {
  try {
    const { nombre, telefono } = req.body
    const { rows } = await query(
      'UPDATE proveedores SET nombre=$1, telefono=$2 WHERE codigo=$3 RETURNING *',
      [nombre, telefono || null, req.params.codigo]
    )
    if (!rows.length) return res.status(404).json({ message: 'Proveedor no encontrado' })
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.delete('/proveedores/:codigo', async (req, res) => {
  try {
    await query('DELETE FROM proveedores WHERE codigo=$1', [req.params.codigo])
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
})

// ── Productos ─────────────────────────────────────────────────────────────────

const PRODUCTOS_QUERY = `
  SELECT
    p.id,
    p.codigo,
    pr.codigo     AS codigo_proveedor,
    pr.nombre     AS proveedor_nombre,
    p.marca,
    p.tono,
    p.descripcion,
    p.espesor_mm,
    p.precio,
    p.existencias,
    p.imagen_url,
    false         AS stock_bajo
  FROM productos p
  JOIN proveedores pr ON pr.id = p.proveedor_id
`

router.get('/productos', async (req, res) => {
  try {
    const { rows } = await query(PRODUCTOS_QUERY)
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/productos', async (req, res) => {
  try {
    const f = req.body
    if (!f.descripcion?.trim()) return res.status(400).json({ message: 'La descripción es obligatoria' })
    if (!f.marca?.trim())       return res.status(400).json({ message: 'La marca es obligatoria' })

    const provRes = await query('SELECT id FROM proveedores WHERE codigo=$1', [f.codigoProveedor])
    if (!provRes.rows.length) return res.status(400).json({ message: 'Proveedor no encontrado' })

    const { rows } = await query(
      `INSERT INTO productos (codigo, proveedor_id, marca, tono, descripcion, espesor_mm, precio, imagen_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL) RETURNING id`,
      [f.codigoProducto || null, provRes.rows[0].id, f.marca || '', f.tono || '', f.descripcion, Number(f.espesor), Number(f.precio)]
    )
    const { rows: full } = await query(PRODUCTOS_QUERY + ' WHERE p.id=$1', [rows[0].id])
    ok(res, full[0])
  } catch (e) { err(res, e) }
})

router.put('/productos/:id', async (req, res) => {
  try {
    const f = req.body
    if (!f.descripcion?.trim()) return res.status(400).json({ message: 'La descripción es obligatoria' })
    if (!f.marca?.trim())       return res.status(400).json({ message: 'La marca es obligatoria' })

    const provRes = await query('SELECT id FROM proveedores WHERE codigo=$1', [f.codigoProveedor])
    if (!provRes.rows.length) return res.status(400).json({ message: 'Proveedor no encontrado' })

    await query(
      `UPDATE productos SET codigo=$1, proveedor_id=$2, marca=$3, tono=$4, descripcion=$5,
       espesor_mm=$6, precio=$7, imagen_url=NULL WHERE id=$8`,
      [f.codigoProducto?.trim(), provRes.rows[0].id, f.marca || '', f.tono || '', f.descripcion,
       Number(f.espesor), Number(f.precio), req.params.id]
    )
    const { rows } = await query(PRODUCTOS_QUERY + ' WHERE p.id=$1', [req.params.id])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.delete('/productos/:codigo', async (req, res) => {
  try {
    await query('DELETE FROM productos WHERE codigo=$1', [req.params.codigo])
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
})

router.post('/productos/:id/ajustar', async (req, res) => {
  const client = await require('../db').pool.connect()
  try {
    await client.query('BEGIN')
    const { delta, tipo, nota } = req.body
    const prodRes = await client.query('SELECT existencias FROM productos WHERE id=$1', [req.params.id])
    if (!prodRes.rows.length) return res.status(404).json({ message: 'Producto no encontrado' })

    const nuevas = prodRes.rows[0].existencias + Number(delta)
    if (nuevas < 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Las existencias no pueden quedar en negativo' })
    }

    await client.query('UPDATE productos SET existencias=$1 WHERE id=$2', [nuevas, req.params.id])
    await client.query(
      `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, existencias_resultantes, nota)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, tipo, Number(delta), nuevas, nota || null]
    )
    await client.query('COMMIT')
    ok(res, { ok: true })
  } catch (e) {
    await client.query('ROLLBACK')
    err(res, e)
  } finally {
    client.release()
  }
})

// ── Ventas ────────────────────────────────────────────────────────────────────

router.get('/ventas', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        v.id, v.folio, v.fecha_hora, v.total,
        COUNT(dv.id)                  AS num_partidas,
        COALESCE(SUM(dv.cantidad), 0) AS total_piezas
      FROM ventas v
      LEFT JOIN detalle_venta dv ON dv.venta_id = v.id
      GROUP BY v.id, v.folio, v.fecha_hora, v.total
      ORDER BY v.fecha_hora DESC
    `)
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/ventas', async (req, res) => {
  const client = await require('../db').pool.connect()
  try {
    await client.query('BEGIN')
    const { partidas } = req.body

    const ventaRes = await client.query(
      "INSERT INTO ventas (fecha_hora) VALUES ($1) RETURNING *",
      [new Date().toISOString()]
    )
    const venta = ventaRes.rows[0]

    let total = 0
    for (const p of partidas) {
      if (p.tipo === 'GENERAL' || p.idProductoGeneral) {
        await client.query(
          `INSERT INTO detalle_venta (venta_id, id_producto_general, producto_id, cantidad, precio_unitario)
           VALUES ($1, $2, NULL, $3, $4)`,
          [venta.id, p.idProductoGeneral, p.cantidad, p.precioUnitario]
        )
        const cur = await client.query(
          'SELECT existencias FROM producto_general WHERE id_producto_general=$1', [p.idProductoGeneral]
        )
        if (cur.rows.length) {
          const nuevas = Math.max(0, (cur.rows[0].existencias ?? 0) - p.cantidad)
          await client.query(
            'UPDATE producto_general SET existencias=$1 WHERE id_producto_general=$2',
            [nuevas, p.idProductoGeneral]
          )
        }
      } else {
        await client.query(
          `INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario)
           VALUES ($1, $2, $3, $4)`,
          [venta.id, p.productoId, p.cantidad, p.precioUnitario]
        )
      }
      total += Number(p.subtotal ?? (p.cantidad * p.precioUnitario))
    }

    await client.query('UPDATE ventas SET total=$1 WHERE id=$2', [total, venta.id])
    const finalRes = await client.query('SELECT * FROM ventas WHERE id=$1', [venta.id])
    await client.query('COMMIT')
    ok(res, finalRes.rows[0])
  } catch (e) {
    await client.query('ROLLBACK')
    err(res, e)
  } finally {
    client.release()
  }
})

router.get('/ventas/:id', async (req, res) => {
  try {
    const [ventaRes, detRes] = await Promise.all([
      query('SELECT id, folio, fecha_hora, total FROM ventas WHERE id=$1', [req.params.id]),
      query(`
        SELECT dv.cantidad, dv.precio_unitario, dv.subtotal,
               p.codigo,
               COALESCE(p.descripcion, pg.nombre, '') AS descripcion,
               COALESCE(p.tono, '')                   AS tono
        FROM detalle_venta dv
        LEFT JOIN productos        p  ON p.id                   = dv.producto_id
        LEFT JOIN producto_general pg ON pg.id_producto_general = dv.id_producto_general
        WHERE dv.venta_id = $1
      `, [req.params.id]),
    ])
    if (!ventaRes.rows.length) return res.status(404).json({ message: 'Venta no encontrada' })
    ok(res, { venta: ventaRes.rows[0], detalles: detRes.rows })
  } catch (e) { err(res, e) }
})

module.exports = router
