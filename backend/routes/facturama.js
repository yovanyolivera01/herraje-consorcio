const express    = require('express')
const { query }  = require('../db')
const router     = express.Router()

const baseUrl = () =>
  process.env.FACTURAMA_ENV === 'production'
    ? 'https://api.facturama.mx'
    : 'https://apisandbox.facturama.mx'

function authHeader() {
  const user = process.env.FACTURAMA_USER || ''
  const pass = process.env.FACTURAMA_PASS || ''
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
}

function extractError(data) {
  if (data?.ModelState) return Object.values(data.ModelState).flat().join(' | ')
  return data?.message ?? data?.Message ?? JSON.stringify(data)
}

// ── Crear CFDI 4.0 y guardar en BD ───────────────────────────────────────
router.post('/facturama/cfdi', async (req, res) => {
  const { _id_pedido, _folio_pedido, _total_cfdi, ...cfdiBody } = req.body
  try {
    const r = await fetch(`${baseUrl()}/4/cfdis`, {
      method:  'POST',
      headers: { 'Authorization': authHeader(), 'Content-Type': 'application/json' },
      body:    JSON.stringify(cfdiBody),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(r.status).json({ message: extractError(data) })

    // Persist in local DB
    try {
      await query(
        `INSERT INTO factura_cfdi
           (id_pedido, folio_pedido, uuid_cfdi, serie, folio_cfdi, rfc_receptor, nombre_receptor, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          _id_pedido    ?? null,
          _folio_pedido ?? null,
          data.Id ?? data.id ?? null,
          data.Serie    ?? null,
          data.Folio    ?? null,
          cfdiBody.Receptor?.Rfc    ?? null,
          cfdiBody.Receptor?.Nombre ?? null,
          _total_cfdi  ?? null,
        ]
      )
    } catch (dbErr) {
      console.error('[facturama] No se pudo guardar en BD:', dbErr.message)
    }

    res.json(data)
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// ── Listar facturas guardadas ─────────────────────────────────────────────
router.get('/facturas', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query
    const { rows } = await query(`
      SELECT
        f.id_factura,
        f.uuid_cfdi,
        f.serie,
        f.folio_cfdi,
        f.fecha_emision,
        f.rfc_receptor,
        f.nombre_receptor,
        f.total,
        f.status,
        f.id_pedido,
        f.folio_pedido,
        COALESCE(c.nombre, 'Mostrador') AS cliente_nombre
      FROM factura_cfdi f
      LEFT JOIN pedido  p ON p.id_pedido  = f.id_pedido
      LEFT JOIN cliente c ON c.id_cliente = p.id_cliente
      WHERE ($1::timestamptz IS NULL OR f.fecha_emision >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR f.fecha_emision <= $2::timestamptz)
      ORDER BY f.fecha_emision DESC
    `, [fecha_inicio || null, fecha_fin || null])
    res.json(rows)
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// ── Descargar PDF ─────────────────────────────────────────────────────────
router.get('/facturama/cfdi/:id/pdf', async (req, res) => {
  try {
    const r = await fetch(`${baseUrl()}/cfdi/pdf/issued/${encodeURIComponent(req.params.id)}`, {
      headers: { 'Authorization': authHeader() },
    })
    if (!r.ok) return res.status(r.status).end()
    const buf = await r.arrayBuffer()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.pdf"`)
    res.send(Buffer.from(buf))
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// ── Descargar XML ─────────────────────────────────────────────────────────
router.get('/facturama/cfdi/:id/xml', async (req, res) => {
  try {
    const r = await fetch(`${baseUrl()}/cfdi/xml/issued/${encodeURIComponent(req.params.id)}`, {
      headers: { 'Authorization': authHeader() },
    })
    if (!r.ok) return res.status(r.status).end()
    const text = await r.text()
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.xml"`)
    res.send(text)
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

module.exports = router
