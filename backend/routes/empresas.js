const express = require('express')
const { query } = require('../db')
const router = express.Router()

function ok(res, data)             { res.json(data) }
function err(res, e, status = 500) { res.status(status).json({ message: e.message }) }

// ── Empresas ──────────────────────────────────────────────────────────────

router.get('/empresas', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM empresa ORDER BY nombre ASC')
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/empresas', async (req, res) => {
  try {
    const { nombre, razon_social, rfc, telefono, correo, direccion } = req.body
    const { rows } = await query(
      `INSERT INTO empresa (nombre, razon_social, rfc, telefono, correo, direccion)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nombre, razon_social || null, rfc || null, telefono || null, correo || null, direccion || null]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.put('/empresas/:id', async (req, res) => {
  try {
    const campos = req.body
    const sets = Object.keys(campos).map((k, i) => `${k}=$${i + 1}`).join(', ')
    const vals = [...Object.values(campos), req.params.id]
    const { rows } = await query(
      `UPDATE empresa SET ${sets} WHERE id_empresa=$${vals.length} RETURNING *`, vals
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

// ── Precios por empresa ───────────────────────────────────────────────────

router.get('/empresas/:id/precios', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM precio_empresa WHERE id_empresa=$1 AND activo=true`,
      [req.params.id]
    )
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/empresas/:id/precios', async (req, res) => {
  try {
    const { id_tipo_vidrio, id_proceso, precio_m2 } = req.body
    const { rows } = await query(
      `INSERT INTO precio_empresa (id_empresa, id_tipo_vidrio, id_proceso, precio_m2)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id_empresa, id_tipo_vidrio, id_proceso)
       DO UPDATE SET precio_m2=EXCLUDED.precio_m2, activo=true, actualizado_en=NOW()
       RETURNING *`,
      [req.params.id, id_tipo_vidrio, id_proceso ?? null, Number(precio_m2)]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

// ── Vincular cliente a empresa ────────────────────────────────────────────

router.post('/clientes/:id/empresa', async (req, res) => {
  try {
    const { id_empresa } = req.body
    const { rows } = await query(
      `INSERT INTO cliente_empresa (id_cliente, id_empresa)
       VALUES ($1,$2)
       ON CONFLICT (id_cliente)
       DO UPDATE SET id_empresa=EXCLUDED.id_empresa, activo=true, desde=NOW()
       RETURNING *`,
      [req.params.id, id_empresa]
    )
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

router.get('/clientes/:id/empresa', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ce.id_empresa,
         json_build_object(
           'id_empresa', e.id_empresa, 'nombre', e.nombre, 'razon_social', e.razon_social,
           'rfc', e.rfc, 'telefono', e.telefono, 'correo', e.correo, 'direccion', e.direccion
         ) AS empresa
       FROM cliente_empresa ce
       JOIN empresa e ON e.id_empresa = ce.id_empresa
       WHERE ce.id_cliente=$1 AND ce.activo=true`,
      [req.params.id]
    )
    ok(res, rows[0] ?? null)
  } catch (e) { err(res, e) }
})

// ── Precios especiales por cliente registrado ─────────────────────────────

router.get('/clientes/:id/precios', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM precio_cliente_registrado WHERE id_cliente=$1 AND activo=true`,
      [req.params.id]
    )
    ok(res, rows)
  } catch (e) { err(res, e) }
})

router.post('/clientes/:id/precios', async (req, res) => {
  try {
    const { id_tipo_vidrio, id_proceso, precio_m2 } = req.body
    const vid = id_tipo_vidrio ?? null
    const proc = id_proceso ?? null
    let sql, params

    if (vid && proc) {
      sql = `INSERT INTO precio_cliente_registrado (id_cliente, id_tipo_vidrio, id_proceso, precio_m2, activo)
             VALUES ($1,$2,$3,$4,true)
             ON CONFLICT (id_cliente, id_tipo_vidrio, id_proceso) WHERE id_tipo_vidrio IS NOT NULL AND id_proceso IS NOT NULL
             DO UPDATE SET precio_m2=EXCLUDED.precio_m2, activo=true, actualizado_en=NOW()
             RETURNING *`
      params = [req.params.id, vid, proc, Number(precio_m2)]
    } else if (vid) {
      sql = `INSERT INTO precio_cliente_registrado (id_cliente, id_tipo_vidrio, precio_m2, activo)
             VALUES ($1,$2,$3,true)
             ON CONFLICT (id_cliente, id_tipo_vidrio) WHERE id_proceso IS NULL
             DO UPDATE SET precio_m2=EXCLUDED.precio_m2, activo=true, actualizado_en=NOW()
             RETURNING *`
      params = [req.params.id, vid, Number(precio_m2)]
    } else {
      sql = `INSERT INTO precio_cliente_registrado (id_cliente, id_proceso, precio_m2, activo)
             VALUES ($1,$2,$3,true)
             ON CONFLICT (id_cliente, id_proceso) WHERE id_tipo_vidrio IS NULL
             DO UPDATE SET precio_m2=EXCLUDED.precio_m2, activo=true, actualizado_en=NOW()
             RETURNING *`
      params = [req.params.id, proc, Number(precio_m2)]
    }

    const { rows } = await query(sql, params)
    ok(res, rows[0])
  } catch (e) { err(res, e) }
})

module.exports = router
