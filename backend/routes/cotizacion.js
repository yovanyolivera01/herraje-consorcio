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

// ── Clientes ──────────────────────────────────────────────────────────────

router.get('/clientes', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.*,
        json_build_object('id_nivel_precio', n.id_nivel_precio, 'nombre', n.nombre) AS nivel_precio
      FROM cliente c
      LEFT JOIN nivel_precio n ON n.id_nivel_precio = c.id_nivel_precio
      ORDER BY c.nombre ASC
    `)
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/clientes', async (req, res) => {
  try {
    const { nombre, telefono, correo, id_nivel_precio } = req.body
    const { rows: ins } = await query(
      'INSERT INTO cliente (nombre, telefono, correo, id_nivel_precio) VALUES ($1,$2,$3,$4) RETURNING id_cliente',
      [nombre, telefono || null, correo || null, id_nivel_precio || null]
    )
    const { rows } = await query(`
      SELECT c.*,
        json_build_object('id_nivel_precio', n.id_nivel_precio, 'nombre', n.nombre) AS nivel_precio
      FROM cliente c LEFT JOIN nivel_precio n ON n.id_nivel_precio = c.id_nivel_precio
      WHERE c.id_cliente=$1
    `, [ins[0].id_cliente])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.put('/clientes/:id', async (req, res) => {
  try {
    const campos = req.body
    const sets = Object.keys(campos).map((k, i) => `${k}=$${i + 1}`).join(', ')
    const vals = [...Object.values(campos), req.params.id]
    await query(`UPDATE cliente SET ${sets} WHERE id_cliente=$${vals.length}`, vals)
    const { rows } = await query(`
      SELECT c.*,
        json_build_object('id_nivel_precio', n.id_nivel_precio, 'nombre', n.nombre) AS nivel_precio
      FROM cliente c LEFT JOIN nivel_precio n ON n.id_nivel_precio = c.id_nivel_precio
      WHERE c.id_cliente=$1
    `, [req.params.id])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

// ── Procesos ──────────────────────────────────────────────────────────────

router.get('/procesos', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT p.*,
        json_build_object('id_unidad_cobro', u.id_unidad_cobro, 'nombre', u.nombre, 'descripcion', u.descripcion) AS unidad_cobro
      FROM proceso p
      LEFT JOIN unidad_cobro u ON u.id_unidad_cobro = p.id_unidad_cobro
      ORDER BY p.nombre ASC
    `)
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/procesos', async (req, res) => {
  try {
    const { nombre, id_unidad_cobro, precio_unitario = 0 } = req.body
    const { rows: ins } = await query(
      'INSERT INTO proceso (nombre, id_unidad_cobro, precio_unitario) VALUES ($1,$2,$3) RETURNING id_proceso',
      [nombre, id_unidad_cobro, Number(precio_unitario)]
    )
    const { rows } = await query(`
      SELECT p.*,
        json_build_object('id_unidad_cobro', u.id_unidad_cobro, 'nombre', u.nombre, 'descripcion', u.descripcion) AS unidad_cobro
      FROM proceso p LEFT JOIN unidad_cobro u ON u.id_unidad_cobro = p.id_unidad_cobro
      WHERE p.id_proceso=$1
    `, [ins[0].id_proceso])
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.put('/procesos/:id', async (req, res) => {
  try {
    const campos = req.body
    const sets = Object.keys(campos).map((k, i) => `${k}=$${i + 1}`).join(', ')
    const vals = [...Object.values(campos), req.params.id]
    await query(`UPDATE proceso SET ${sets} WHERE id_proceso=$${vals.length}`, vals)
    const { rows } = await query(`
      SELECT p.*,
        json_build_object('id_unidad_cobro', u.id_unidad_cobro, 'nombre', u.nombre, 'descripcion', u.descripcion) AS unidad_cobro
      FROM proceso p LEFT JOIN unidad_cobro u ON u.id_unidad_cobro = p.id_unidad_cobro
      WHERE p.id_proceso=$1
    `, [req.params.id])
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
        SELECT pc.*,
          json_build_object('id_tipo_vidrio', tv.id_tipo_vidrio, 'clave', tv.clave, 'descripcion', tv.descripcion) AS tipo_vidrio
        FROM partida_cotizacion pc
        LEFT JOIN tipo_vidrio tv ON tv.id_tipo_vidrio = pc.id_tipo_vidrio
        WHERE pc.id_cotizacion=$1
        ORDER BY pc.id_partida ASC
      `, [req.params.id]),
    ])

    if (!cotRes.rows.length) return res.status(404).json({ message: 'Cotización no encontrada' })

    const ids = partidasRes.rows.map(p => p.id_partida)
    let procesos = []
    if (ids.length) {
      const procRes = await query(`
        SELECT pp.*,
          json_build_object(
            'id_proceso', pr.id_proceso, 'nombre', pr.nombre,
            'unidad_cobro', json_build_object('nombre', uc.nombre)
          ) AS proceso
        FROM partida_proceso pp
        LEFT JOIN proceso      pr ON pr.id_proceso      = pp.id_proceso
        LEFT JOIN unidad_cobro uc ON uc.id_unidad_cobro = pr.id_unidad_cobro
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

    // Extras (maquila / productos generales) — tabla opcional
    let extras = []
    try {
      const extRes = await query(
        'SELECT * FROM partida_cotizacion_extra WHERE id_cotizacion=$1 ORDER BY id_partida_extra',
        [req.params.id]
      )
      extras = extRes.rows
    } catch { /* tabla puede no existir aún */ }

    ok(res, { ...cotRes.rows[0], partidas, extras })
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

router.post('/cotizaciones/:id/partidas', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const partida = req.body
    const { rows: pRows } = await client.query(`
      INSERT INTO partida_cotizacion
        (id_cotizacion, id_tipo_vidrio, piezas, largo_cm, ancho_cm, metros2, precio_m2_aplicado,
         subtotal_vidrio, subtotal_procesos, subtotal_partida, es_hoja_completa)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [
      req.params.id,
      partida.id_tipo_vidrio,
      partida.piezas ?? 1,
      partida.largo_cm,
      partida.ancho_cm,
      partida.metros2,
      partida.precio_m2_aplicado,
      partida.subtotal_vidrio,
      partida.subtotal_procesos ?? 0,
      partida.subtotal_partida,
      partida.es_hoja_completa ?? false,
    ])

    const p = pRows[0]
    if (partida.procesos?.length) {
      for (const proc of partida.procesos) {
        await client.query(`
          INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [p.id_partida, proc.id_proceso, proc.id_unidad_cobro, proc.cantidad, proc.precio_unitario, proc.subtotal])
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

// ── Actualizar cotización completa (cabecera + partidas) ──────────────────

router.put('/cotizaciones/:id/actualizar', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { id_nivel_precio, id_cliente, partidas, total } = req.body

    // Borrar procesos y partidas existentes
    const { rows: existentes } = await client.query(
      'SELECT id_partida FROM partida_cotizacion WHERE id_cotizacion=$1',
      [req.params.id]
    )
    if (existentes.length) {
      const ids = existentes.map(p => p.id_partida)
      await client.query('DELETE FROM partida_proceso WHERE id_partida = ANY($1::int[])', [ids])
      await client.query('DELETE FROM partida_cotizacion WHERE id_cotizacion=$1', [req.params.id])
    }

    // Actualizar cabecera
    await client.query(
      `UPDATE cotizacion SET id_nivel_precio=$1, id_cliente=$2, total=$3, estatus='FINALIZADA'
       WHERE id_cotizacion=$4`,
      [id_nivel_precio, id_cliente || null, Number(total), req.params.id]
    )

    // Re-insertar partidas
    for (const partida of (partidas ?? [])) {
      const { rows: pRows } = await client.query(`
        INSERT INTO partida_cotizacion
          (id_cotizacion, id_tipo_vidrio, piezas, largo_cm, ancho_cm, metros2,
           precio_m2_aplicado, subtotal_vidrio, subtotal_procesos, subtotal_partida, es_hoja_completa)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id_partida
      `, [
        req.params.id, partida.id_tipo_vidrio, partida.piezas ?? 1,
        partida.largo_cm, partida.ancho_cm, partida.metros2,
        partida.precio_m2_aplicado, partida.subtotal_vidrio,
        partida.subtotal_procesos ?? 0, partida.subtotal_partida,
        partida.es_hoja_completa ?? false,
      ])
      if (partida.procesos?.length) {
        for (const proc of partida.procesos) {
          await client.query(
            'INSERT INTO partida_proceso (id_partida, id_proceso, id_unidad_cobro, cantidad, precio_unitario, subtotal) VALUES ($1,$2,$3,$4,$5,$6)',
            [pRows[0].id_partida, proc.id_proceso, proc.id_unidad_cobro, proc.cantidad, proc.precio_unitario, proc.subtotal]
          )
        }
      }
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

// ── Partidas extra (maquila / productos) ──────────────────────────────────

router.get('/cotizaciones/:id/extras', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM partida_cotizacion_extra WHERE id_cotizacion=$1 ORDER BY id_partida_extra',
      [req.params.id]
    )
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/cotizaciones/:id/extras', async (req, res) => {
  try {
    const { tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas } = req.body
    const { rows } = await query(
      `INSERT INTO partida_cotizacion_extra
         (id_cotizacion, tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, id_producto_general, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.id, tipo, descripcion, unidad ?? 'pza', Number(cantidad),
       Number(precio_unitario), Number(subtotal), id_producto_general ?? null, notas ?? null]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.delete('/cotizaciones/:id/extras', async (req, res) => {
  try {
    await query('DELETE FROM partida_cotizacion_extra WHERE id_cotizacion=$1', [req.params.id])
    ok(res, { ok: true })
  } catch (e) { err(res, e) }
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
