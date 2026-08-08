const express = require('express')
const { query, pool } = require('../db')
const router = express.Router()

function ok(res, data)  { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// ── Tonos ─────────────────────────────────────────────────────────────────

router.get('/tonos', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM tono ORDER BY nombre ASC')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/tonos', async (req, res) => {
  try {
    const { rows } = await query('INSERT INTO tono (nombre) VALUES ($1) RETURNING *', [req.body.nombre])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.put('/tonos/:id', async (req, res) => {
  try {
    const campos = req.body
    const sets = Object.keys(campos).map((k, i) => `${k}=$${i + 1}`).join(', ')
    const vals = [...Object.values(campos), req.params.id]
    const { rows } = await query(`UPDATE tono SET ${sets} WHERE id_tono=$${vals.length} RETURNING *`, vals)
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

// ── Espesores ─────────────────────────────────────────────────────────────

router.get('/espesores', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM espesor ORDER BY valor_mm ASC')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/espesores', async (req, res) => {
  try {
    const { valor_mm, etiqueta } = req.body
    const { rows } = await query(
      'INSERT INTO espesor (valor_mm, etiqueta) VALUES ($1, $2) RETURNING *',
      [Number(valor_mm), etiqueta]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.put('/espesores/:id', async (req, res) => {
  try {
    const campos = req.body
    const sets = Object.keys(campos).map((k, i) => `${k}=$${i + 1}`).join(', ')
    const vals = [...Object.values(campos), req.params.id]
    const { rows } = await query(`UPDATE espesor SET ${sets} WHERE id_espesor=$${vals.length} RETURNING *`, vals)
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

// ── Tipos de vidrio ───────────────────────────────────────────────────────

const TIPOS_VIDRIO_QUERY = `
  SELECT tv.*,
    json_build_object('id_tono', t.id_tono, 'nombre', t.nombre) AS tono,
    json_build_object('id_espesor', e.id_espesor, 'valor_mm', e.valor_mm, 'etiqueta', e.etiqueta) AS espesor
  FROM tipo_vidrio tv
  LEFT JOIN tono    t ON t.id_tono    = tv.id_tono
  LEFT JOIN espesor e ON e.id_espesor = tv.id_espesor
`

router.get('/tipos-vidrio', async (req, res) => {
  try {
    const { rows } = await query(TIPOS_VIDRIO_QUERY + ' ORDER BY tv.clave ASC')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/tipos-vidrio', async (req, res) => {
  try {
    const { id_tono, id_espesor, clave, descripcion } = req.body
    const ins = await query(
      'INSERT INTO tipo_vidrio (id_tono, id_espesor, clave, descripcion) VALUES ($1,$2,$3,$4) RETURNING id_tipo_vidrio',
      [id_tono, id_espesor, clave, descripcion]
    )
    const { rows } = await query(TIPOS_VIDRIO_QUERY + ' WHERE tv.id_tipo_vidrio=$1', [ins.rows[0].id_tipo_vidrio])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.put('/tipos-vidrio/:id', async (req, res) => {
  try {
    const campos = req.body
    const sets = Object.keys(campos).map((k, i) => `${k}=$${i + 1}`).join(', ')
    const vals = [...Object.values(campos), req.params.id]
    await query(`UPDATE tipo_vidrio SET ${sets} WHERE id_tipo_vidrio=$${vals.length}`, vals)
    const { rows } = await query(TIPOS_VIDRIO_QUERY + ' WHERE tv.id_tipo_vidrio=$1', [req.params.id])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

// ── Niveles de precio ─────────────────────────────────────────────────────

router.get('/niveles-precio', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM nivel_precio WHERE activo=true ORDER BY id_nivel_precio ASC')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Precios de vidrio ─────────────────────────────────────────────────────

router.get('/precios-vidrio', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM precio_vidrio')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/precios-vidrio', async (req, res) => {
  try {
    const { id_tipo_vidrio, id_nivel_precio, precio_m2 } = req.body
    const { rows } = await query(`
      INSERT INTO precio_vidrio (id_tipo_vidrio, id_nivel_precio, precio_m2)
      VALUES ($1, $2, $3)
      ON CONFLICT (id_tipo_vidrio, id_nivel_precio)
      DO UPDATE SET precio_m2 = EXCLUDED.precio_m2
      RETURNING *
    `, [id_tipo_vidrio, id_nivel_precio, Number(precio_m2)])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

// ── Precios de proceso ────────────────────────────────────────────────────

router.get('/precios-proceso', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM precio_proceso')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/precios-proceso', async (req, res) => {
  try {
    const { id_proceso, precios } = req.body
    if (!precios?.length) return ok(res, [])
    const results = []
    for (const p of precios) {
      const { rows } = await query(`
        INSERT INTO precio_proceso (id_proceso, id_nivel_precio, id_espesor, precio_unitario)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id_proceso, id_nivel_precio, id_espesor)
        DO UPDATE SET precio_unitario = EXCLUDED.precio_unitario
        RETURNING *
      `, [id_proceso, p.id_nivel_precio, p.id_espesor, Number(p.precio_unitario)])
      results.push(rows[0])
    }
    ok(res, results)
  } catch (e) { err(res, e) }
})

// ── Unidades de cobro ─────────────────────────────────────────────────────

router.get('/unidades-cobro', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM unidad_cobro ORDER BY id_unidad_cobro ASC')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Tipos de pago ──────────────────────────────────────────────────────────

router.get('/tipos-pago', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM tipo_pago ORDER BY id_tipo_pago ASC')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Métodos de pago ───────────────────────────────────────────────────────

router.get('/metodos-pago', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM metodo_pago WHERE activo = TRUE ORDER BY id_metodo_pago ASC')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

// ── Cotizaciones ──────────────────────────────────────────────────────────

router.get('/cotizaciones', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        c.*,
        json_build_object('id_cliente', cl.id_cliente, 'nombre', cl.nombre) AS cliente,
        json_build_object('id_nivel_precio', n.id_nivel_precio, 'nombre', n.nombre, 'es_hoja_completa', n.es_hoja_completa) AS nivel_precio
      FROM cotizacion c
      LEFT JOIN cliente     cl ON cl.id_cliente     = c.id_cliente
      LEFT JOIN nivel_precio n  ON n.id_nivel_precio = c.id_nivel_precio
      WHERE c.estatus <> 'CONVERTIDA'
      ORDER BY c.fecha DESC
    `)
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/cotizaciones', async (req, res) => {
  try {
    const { id_nivel_precio, id_cliente, observaciones } = req.body
    const { rows: ins } = await query(
      `INSERT INTO cotizacion (folio, id_nivel_precio, id_cliente, observaciones, fecha)
       VALUES ('COT-00000', $1, $2, $3, $4) RETURNING id_cotizacion`,
      [id_nivel_precio, id_cliente || null, observaciones || null, new Date().toISOString()]
    )
    const id = ins[0].id_cotizacion
    const folio = 'COT-' + String(id).padStart(5, '0')
    const { rows } = await query(
      'UPDATE cotizacion SET folio=$1 WHERE id_cotizacion=$2 RETURNING *',
      [folio, id]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.get('/cotizaciones/:id', async (req, res) => {
  try {
    const [cotRes, partidasRes] = await Promise.all([
      query(`
        SELECT c.*,
          json_build_object('id_cliente', cl.id_cliente, 'nombre', cl.nombre, 'telefono', cl.telefono) AS cliente,
          json_build_object('id_nivel_precio', n.id_nivel_precio, 'nombre', n.nombre, 'es_hoja_completa', n.es_hoja_completa) AS nivel
        FROM cotizacion c
        LEFT JOIN cliente     cl ON cl.id_cliente     = c.id_cliente
        LEFT JOIN nivel_precio n  ON n.id_nivel_precio = c.id_nivel_precio
        WHERE c.id_cotizacion=$1
      `, [req.params.id]),
      query(`
        SELECT
          p.id_partida, p.id_cotizacion, pv.id_tipo_vidrio,
          p.cantidad AS piezas, p.largo_cm, p.ancho_cm, p.metros2,
          pv.precio_m2 AS precio_m2_aplicado,
          pv.subtotal_vidrio, pv.precio_vidrio, p.subtotal_procesos,
          p.subtotal AS subtotal_partida,
          pv.es_hoja_completa, p.observaciones,
          json_build_object('id_tipo_vidrio', tv.id_tipo_vidrio, 'clave', tv.clave, 'descripcion', tv.descripcion) AS tipo_vidrio
        FROM partida p
        JOIN partida_vidrio pv ON pv.id_partida = p.id_partida
        LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pv.id_tipo_vidrio
        WHERE p.id_cotizacion=$1 AND p.tipo='VIDRIO'
        ORDER BY p.id_partida ASC
      `, [req.params.id]),
    ])

    if (!cotRes.rows.length) return res.status(404).json({ message: 'Cotización no encontrada' })

    const ids = partidasRes.rows.map(p => p.id_partida)
    let procesos = []
    if (ids.length) {
      const procRes = await query(`
        SELECT
          pp.id_partida_proceso,
          pp.id_partida,
          pp.id_proceso, pp.id_unidad_cobro,
          pp.cantidad, pp.precio_unitario, pp.subtotal, pp.sides,
          json_build_object(
            'id_proceso', pr.id_proceso, 'nombre', pr.nombre,
            'unidad_cobro', json_build_object('nombre', uc.nombre)
          ) AS proceso
        FROM partida_proceso pp
        LEFT JOIN proceso      pr ON pr.id_proceso      = pp.id_proceso
        LEFT JOIN unidad_cobro uc ON uc.id_unidad_cobro = pp.id_unidad_cobro
        WHERE pp.id_partida = ANY($1::int[])
      `, [ids])
      procesos = procRes.rows
    }

    const procesosPorPartida = {}
    for (const pr of procesos) {
      if (!procesosPorPartida[pr.id_partida]) procesosPorPartida[pr.id_partida] = []
      procesosPorPartida[pr.id_partida].push(pr)
    }

    const partidas = partidasRes.rows.map(p => ({
      ...p,
      partida_proceso: procesosPorPartida[p.id_partida] ?? [],
    }))

    // Extras (maquila / productos generales)
    let extras = []
    try {
      const extRes = await query(
        `SELECT id_partida AS id_partida_extra, id_cotizacion, tipo, descripcion, unidad,
                cantidad, precio_unitario, subtotal, id_producto_general, notas, observaciones
         FROM partida
         WHERE id_cotizacion=$1 AND tipo IN ('MAQUILA','PRODUCTO','EXTRA')
           AND largo_cm IS NULL
         ORDER BY id_partida`,
        [req.params.id]
      )
      extras = extRes.rows
    } catch { /* no debería fallar, pero se conserva la tolerancia previa */ }

    // Jobs de maquila dimensionados (largo_cm IS NOT NULL) — mismo tratamiento
    // CTI que VIDRIO arriba: fila propia en `partida` + sus procesos en
    // `partida_proceso`, en vez de aplanados a texto+notas como los extras.
    let maquilas = []
    const maqRes = await query(
      `SELECT p.id_partida, p.descripcion, p.largo_cm, p.ancho_cm, p.cantidad, p.metros2,
              p.subtotal_procesos, p.subtotal, p.observaciones,
              p.id_espesor, esp.etiqueta AS espesor_label
       FROM partida p
       LEFT JOIN espesor esp ON esp.id_espesor = p.id_espesor
       WHERE p.id_cotizacion=$1 AND p.tipo='MAQUILA' AND p.largo_cm IS NOT NULL
       ORDER BY p.id_partida`,
      [req.params.id]
    )
    if (maqRes.rows.length) {
      const { rows: procMaqRows } = await query(
        `SELECT pp.id_partida, pp.id_proceso, pp.id_unidad_cobro,
                pr.nombre AS proceso, uc.nombre AS unidad_cobro,
                pp.cantidad, pp.precio_unitario, pp.subtotal, pp.sides
         FROM partida_proceso pp
         LEFT JOIN proceso      pr ON pr.id_proceso      = pp.id_proceso
         LEFT JOIN unidad_cobro uc ON uc.id_unidad_cobro = pp.id_unidad_cobro
         WHERE pp.id_partida = ANY($1::int[])`,
        [maqRes.rows.map(r => r.id_partida)]
      )
      const procsPorMaquila = {}
      for (const pr of procMaqRows) {
        if (!procsPorMaquila[pr.id_partida]) procsPorMaquila[pr.id_partida] = []
        procsPorMaquila[pr.id_partida].push(pr)
      }
      maquilas = maqRes.rows.map(r => ({ ...r, procesos: procsPorMaquila[r.id_partida] ?? [] }))
    }

    ok(res, { ...cotRes.rows[0], partidas, extras, maquilas })
  } catch (e) { err(res, e) }
})

router.put('/cotizaciones/:id', async (req, res) => {
  try {
    const campos = req.body
    const sets = Object.keys(campos).map((k, i) => `${k}=$${i + 1}`).join(', ')
    const vals = [...Object.values(campos), req.params.id]
    const { rows } = await query(
      `UPDATE cotizacion SET ${sets} WHERE id_cotizacion=$${vals.length} RETURNING *`,
      vals
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

// ── Documento de cotización para empresa ──────────────────────────────────

router.get('/cotizaciones/:id/documento-empresa', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM sp_documento_empresa($1)',
      [req.params.id]
    )
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.delete('/cotizaciones/:id', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'SELECT estatus FROM cotizacion WHERE id_cotizacion=$1', [req.params.id]
    )
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Cotización no encontrada' }) }
    if (rows[0].estatus === 'CONVERTIDA') { await client.query('ROLLBACK'); return res.status(400).json({ message: 'No se puede borrar una cotización convertida en pedido' }) }
    // PROCESO/satellite children cascade-delete automatically via FKs
    await client.query('DELETE FROM partida WHERE id_cotizacion=$1', [req.params.id])
    await client.query('DELETE FROM cotizacion WHERE id_cotizacion=$1', [req.params.id])
    await client.query('COMMIT')
    ok(res, { ok: true })
  } catch (e) {
    await client.query('ROLLBACK')
    err(res, e)
  } finally { client.release() }
})

// ── Precios de proceso especial (sin diferenciar espesor) ─────────────────

router.get('/precios-proceso-especial', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM precio_proceso_especial')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/precios-proceso-especial', async (req, res) => {
  try {
    const { id_proceso, precios } = req.body
    if (!precios?.length) return ok(res, [])
    const results = []
    for (const p of precios) {
      const { rows } = await query(`
        INSERT INTO precio_proceso_especial (id_proceso, id_nivel_precio, precio_unitario)
        VALUES ($1, $2, $3)
        ON CONFLICT (id_proceso, id_nivel_precio)
        DO UPDATE SET precio_unitario = EXCLUDED.precio_unitario
        RETURNING *
      `, [id_proceso, p.id_nivel_precio, Number(p.precio_unitario)])
      results.push(rows[0])
    }
    ok(res, results)
  } catch (e) { err(res, e) }
})

module.exports = router
