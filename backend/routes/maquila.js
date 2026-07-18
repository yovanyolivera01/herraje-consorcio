const express = require('express')
const { query, pool } = require('../db')
const router = express.Router()

function ok(res, data) { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// ── Cotizaciones de maquila ───────────────────────────────────────────────

router.get('/maquila/cotizaciones', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.*,
        COALESCE(cl.nombre, 'Mostrador') AS cliente_nombre,
        np.nombre                         AS nivel_nombre
      FROM cotizacion c
      LEFT JOIN cliente      cl ON cl.id_cliente      = c.id_cliente
      LEFT JOIN nivel_precio np ON np.id_nivel_precio = c.id_nivel_precio
      WHERE c.tipo_cotizacion = 'MAQUILA'
        AND c.estatus <> 'CONVERTIDA'
      ORDER BY c.fecha DESC
    `)
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/maquila/cotizaciones', async (req, res) => {
  try {
    const { id_cliente, id_nivel_precio, observaciones } = req.body
    const { rows } = await query(
      'SELECT * FROM sp_iniciar_cotizacion_maquila($1, $2, $3)',
      [id_cliente ?? null, id_nivel_precio, observaciones ?? null]
    )
    const row = rows[0]
    if (!row || row.p_id_cotizacion === 0)
      return res.status(400).json({ message: row?.p_mensaje ?? 'Error al iniciar cotización' })
    ok(res, { id_cotizacion: row.p_id_cotizacion, folio: row.p_folio })
  } catch (e) { err(res, e) }
})

router.get('/maquila/cotizaciones/:id', async (req, res) => {
  try {
    const id = req.params.id
    const [cotRes, partidasRes] = await Promise.all([
      query(`
        SELECT c.*,
          json_build_object('id_cliente', cl.id_cliente, 'nombre', cl.nombre, 'telefono', cl.telefono) AS cliente,
          json_build_object('id_nivel_precio', np.id_nivel_precio, 'nombre', np.nombre) AS nivel
        FROM cotizacion c
        LEFT JOIN cliente      cl ON cl.id_cliente      = c.id_cliente
        LEFT JOIN nivel_precio np ON np.id_nivel_precio = c.id_nivel_precio
        WHERE c.id_cotizacion = $1
      `, [id]),
      query(`
        SELECT pm.*,
          json_agg(json_build_object(
            'id_proceso_pm',    ppm.id_proceso_pm,
            'id_proceso',       ppm.id_proceso,
            'nombre',           pr.nombre,
            'unidad',           uc.nombre,
            'cantidad_unidades', ppm.cantidad_unidades,
            'precio_unitario',  ppm.precio_unitario,
            'subtotal',         ppm.subtotal
          )) FILTER (WHERE ppm.id_proceso_pm IS NOT NULL) AS procesos
        FROM partida_maquila pm
        LEFT JOIN proceso_partida_maquila ppm ON ppm.id_partida_maquila = pm.id_partida_maquila
        LEFT JOIN proceso      pr ON pr.id_proceso      = ppm.id_proceso
        LEFT JOIN unidad_cobro uc ON uc.id_unidad_cobro = pr.id_unidad_cobro
        WHERE pm.id_cotizacion = $1
        GROUP BY pm.id_partida_maquila
        ORDER BY pm.id_partida_maquila
      `, [id]),
    ])
    if (!cotRes.rows.length) return res.status(404).json({ message: 'Cotización no encontrada' })
    ok(res, { ...cotRes.rows[0], partidas: partidasRes.rows })
  } catch (e) { err(res, e) }
})

router.post('/maquila/cotizaciones/:id/partidas', async (req, res) => {
  try {
    const { descripcion, largo_cm, ancho_cm, cantidad, procesos } = req.body
    const { rows } = await query(
      'SELECT * FROM sp_agregar_partida_maquila($1, $2, $3, $4, $5, $6)',
      [req.params.id, descripcion ?? null, Number(largo_cm), Number(ancho_cm), Number(cantidad), JSON.stringify(procesos ?? [])]
    )
    const row = rows[0]
    if (!row || row.p_id_partida === 0)
      return res.status(400).json({ message: row?.p_mensaje ?? 'Error al agregar partida' })
    ok(res, { id_partida: row.p_id_partida, subtotal: Number(row.p_subtotal) })
  } catch (e) { err(res, e) }
})

router.post('/maquila/cotizaciones/:id/finalizar', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM sp_finalizar_cotizacion_maquila($1)',
      [req.params.id]
    )
    const row = rows[0]
    ok(res, { total: Number(row?.p_total ?? 0), mensaje: row?.p_mensaje })
  } catch (e) { err(res, e) }
})

router.get('/maquila/cotizaciones/:id/ticket', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM sp_obtener_ticket_maquila($1)',
      [req.params.id]
    )
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/maquila/cotizaciones/:id/reabrir', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM sp_reabrir_cotizacion($1)',
      [req.params.id]
    )
    ok(res, { ok: true, mensaje: rows[0]?.p_mensaje })
  } catch (e) { err(res, e) }
})

router.delete('/maquila/partidas/:id', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM sp_eliminar_partida_maquila($1)',
      [req.params.id]
    )
    ok(res, { ok: true, mensaje: rows[0]?.p_mensaje })
  } catch (e) { err(res, e) }
})

// ── Pedidos de maquila ────────────────────────────────────────────────────

router.post('/maquila/pedidos/convertir', async (req, res) => {
  try {
    const { id_cotizacion, tipo_pago, monto_anticipo, metodo_pago } = req.body
    const { rows } = await query(
      'SELECT * FROM sp_convertir_maquila_a_pedido($1, $2, $3)',
      [id_cotizacion, tipo_pago, Number(monto_anticipo)]
    )
    const row = rows[0]
    if (!row || row.p_id_pedido === 0)
      return res.status(400).json({ message: row?.p_mensaje ?? 'Error al convertir a pedido' })
    // Garantizar tipo_pedido correcto independiente de la versión del SP en DB
    await query("UPDATE pedido SET tipo_pedido = 'MAQUILA' WHERE id_pedido = $1", [row.p_id_pedido])
    if (metodo_pago) await query('UPDATE pedido SET metodo_pago=$1 WHERE id_pedido=$2', [metodo_pago, row.p_id_pedido])
    ok(res, { id_pedido: row.p_id_pedido, folio: row.p_folio_pedido })
  } catch (e) { err(res, e) }
})

// Igual que /convertir pero desvincula la cotizacion intermedia del pedido
// para que quede como un pedido directo (id_cotizacion = NULL).
router.post('/maquila/pedidos/convertir-directo', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { id_cotizacion, tipo_pago, monto_anticipo, metodo_pago } = req.body
    const { rows } = await client.query(
      'SELECT * FROM sp_convertir_maquila_a_pedido($1, $2, $3)',
      [id_cotizacion, tipo_pago, Number(monto_anticipo)]
    )
    const row = rows[0]
    if (!row || row.p_id_pedido === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: row?.p_mensaje ?? 'Error al crear pedido directo' })
    }
    // Desvincular cotizacion intermedia y garantizar tipo_pedido correcto
    await client.query(
      "UPDATE pedido SET id_cotizacion = NULL, tipo_pedido = 'MAQUILA' WHERE id_pedido = $1",
      [row.p_id_pedido]
    )
    if (metodo_pago) await client.query('UPDATE pedido SET metodo_pago=$1 WHERE id_pedido=$2', [metodo_pago, row.p_id_pedido])
    // Para LIQUIDADO: marcar entregado inmediatamente
    if (tipo_pago === 'LIQUIDADO') {
      await client.query(
        "UPDATE pedido SET estatus = 'ENTREGADO', fecha_entrega = NOW() WHERE id_pedido = $1",
        [row.p_id_pedido]
      )
      await client.query(
        "UPDATE partida_pedido_maquila SET estatus_entrega = 'ENTREGADO', fecha_entrega_real = NOW() WHERE id_pedido = $1",
        [row.p_id_pedido]
      )
    }
    await client.query('COMMIT')
    try { await query('SELECT sp_insertar_pedidod($1)', [row.p_id_pedido]) } catch {}
    ok(res, { id_pedido: row.p_id_pedido, folio: row.p_folio_pedido })
  } catch (e) {
    await client.query('ROLLBACK')
    err(res, e)
  } finally { client.release() }
})

router.get('/maquila/pedidos/pendientes', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM sp_obtener_pedidos_pendientes($1)',
      ['MAQUILA']
    )
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.get('/maquila/pedidos/historial', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    const { rows } = await query(`
      SELECT p.*,
        COALESCE(c.nombre, 'Mostrador') AS cliente_nombre
      FROM pedido p
      LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
      WHERE p.tipo_pedido = 'MAQUILA'
        AND p.estatus = 'ENTREGADO'
        AND ($1::timestamptz IS NULL OR p.fecha_entrega >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR p.fecha_entrega <= $2::timestamptz)
      ORDER BY p.fecha_entrega DESC
    `, [fecha_inicio || null, fecha_fin || null])
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.get('/maquila/pedidos/:id', async (req, res) => {
  try {
    const id = req.params.id
    const [pedRes, partidasRes] = await Promise.all([
      query(`
        SELECT p.*,
          json_build_object('id_cliente', c.id_cliente, 'nombre', c.nombre, 'telefono', c.telefono) AS cliente,
          co.folio AS folio_cotizacion
        FROM pedido p
        LEFT JOIN cliente    c  ON c.id_cliente    = p.id_cliente
        LEFT JOIN cotizacion co ON co.id_cotizacion = p.id_cotizacion
        WHERE p.id_pedido = $1
      `, [id]),
      query(`
        SELECT ppm.*,
          json_agg(json_build_object(
            'nombre',            pr.nombre,
            'unidad',            uc.nombre,
            'cantidad_unidades', pppm.cantidad_unidades,
            'precio_unitario',   pppm.precio_unitario,
            'subtotal',          pppm.subtotal
          )) FILTER (WHERE pppm.id IS NOT NULL) AS procesos
        FROM partida_pedido_maquila ppm
        LEFT JOIN proceso_partida_pedido_maquila pppm ON pppm.id_partida_ped_maq = ppm.id_partida_ped_maq
        LEFT JOIN proceso      pr ON pr.id_proceso      = pppm.id_proceso
        LEFT JOIN unidad_cobro uc ON uc.id_unidad_cobro = pr.id_unidad_cobro
        WHERE ppm.id_pedido = $1
        GROUP BY ppm.id_partida_ped_maq
        ORDER BY ppm.id_partida_ped_maq
      `, [id]),
    ])
    if (!pedRes.rows.length) return res.status(404).json({ message: 'Pedido no encontrado' })

    let partidas = partidasRes.rows

    // Si no hay snapshot en partida_pedido_maquila, leer desde partida_maquila via id_cotizacion
    if (partidas.length === 0 && pedRes.rows[0].id_cotizacion) {
      const fallback = await query(`
        SELECT pm.id_partida_maquila AS id_partida_ped_maq,
               pm.descripcion, pm.largo_cm, pm.ancho_cm, pm.cantidad,
               pm.metros2, pm.subtotal_partida, 'PENDIENTE' AS estatus_entrega,
               NULL AS fecha_entrega_real,
          json_agg(json_build_object(
            'nombre',            pr.nombre,
            'unidad',            uc.nombre,
            'cantidad_unidades', ppm.cantidad_unidades,
            'precio_unitario',   ppm.precio_unitario,
            'subtotal',          ppm.subtotal
          )) FILTER (WHERE ppm.id_proceso_pm IS NOT NULL) AS procesos
        FROM partida_maquila pm
        LEFT JOIN proceso_partida_maquila ppm ON ppm.id_partida_maquila = pm.id_partida_maquila
        LEFT JOIN proceso      pr ON pr.id_proceso      = ppm.id_proceso
        LEFT JOIN unidad_cobro uc ON uc.id_unidad_cobro = pr.id_unidad_cobro
        WHERE pm.id_cotizacion = $1
        GROUP BY pm.id_partida_maquila
        ORDER BY pm.id_partida_maquila
      `, [pedRes.rows[0].id_cotizacion])
      partidas = fallback.rows
    }

    ok(res, { ...pedRes.rows[0], partidas })
  } catch (e) { err(res, e) }
})

router.post('/maquila/partidas-pedido/:id/entregar', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: pmRows } = await client.query(
      `UPDATE partida_pedido_maquila
       SET estatus_entrega = 'ENTREGADO', fecha_entrega_real = NOW()
       WHERE id_partida_ped_maq = $1 RETURNING id_pedido`,
      [req.params.id]
    )
    if (!pmRows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Partida no encontrada' }) }

    const id_pedido = pmRows[0].id_pedido
    const { rows: todas } = await client.query(
      'SELECT estatus_entrega FROM partida_pedido_maquila WHERE id_pedido = $1',
      [id_pedido]
    )
    const entregadas  = todas.filter(r => r.estatus_entrega === 'ENTREGADO').length
    const nuevoEstatus = entregadas === todas.length ? 'ENTREGADO' : entregadas > 0 ? 'PARCIAL' : null
    if (nuevoEstatus) {
      await client.query(
        `UPDATE pedido SET estatus = $1 ${nuevoEstatus === 'ENTREGADO' ? ', fecha_entrega = NOW()' : ''} WHERE id_pedido = $2`,
        [nuevoEstatus, id_pedido]
      )
    }
    await client.query('COMMIT')
    ok(res, { ok: true })
  } catch (e) {
    await client.query('ROLLBACK')
    err(res, e)
  } finally { client.release() }
})

router.post('/maquila/pedidos/:id/liquidar', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM sp_marcar_anticipo_liquidado($1)',
      [req.params.id]
    )
    ok(res, { ok: true, mensaje: rows[0]?.p_mensaje })
  } catch (e) { err(res, e) }
})

module.exports = router
