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
  cfdiBody.ExpeditionPlace = process.env.FACTURAMA_CP_EMISOR || cfdiBody.ExpeditionPlace

  // Regla del SAT (CFDI 4.0): con RFC genérico de público en general
  // (XAXX010101000) o extranjero (XEXX010101000), el TaxZipCode del
  // receptor debe coincidir con el CP del emisor — no con uno arbitrario
  // capturado en el formulario. Se fuerza aquí para que siempre sea
  // válido sin importar qué CP haya quedado en el formulario.
  const RFC_GENERICOS = ['XAXX010101000', 'XEXX010101000']
  if (cfdiBody.Receiver && RFC_GENERICOS.includes(cfdiBody.Receiver.Rfc) && process.env.FACTURAMA_CP_EMISOR) {
    cfdiBody.Receiver.TaxZipCode = process.env.FACTURAMA_CP_EMISOR
  }

  try {
    const r = await fetch(`${baseUrl()}/3/cfdis`, {
      method:  'POST',
      headers: { 'Authorization': authHeader(), 'Content-Type': 'application/json' },
      body:    JSON.stringify(cfdiBody),
    })
    const rawText = await r.text()
    let data = {}
    try { data = rawText ? JSON.parse(rawText) : {} } catch { /* respuesta no-JSON, se conserva rawText para el log */ }
    if (!r.ok) {
      console.error(`[facturama] ${r.status} ${r.statusText} — ${rawText || '(cuerpo vacío)'}`)
      const msg = Object.keys(data).length ? extractError(data) : `${r.status} ${r.statusText}: ${rawText || 'sin detalle'}`
      return res.status(r.status).json({ message: msg })
    }

    // Persist in local DB
    try {
      const { rows: insRows } = await query(
        'SELECT * FROM sp_insertar_factura_cfdi($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          _id_pedido    ?? null,
          _folio_pedido ?? null,
          data.Id ?? data.id ?? null,
          data.Serie    ?? null,
          data.Folio    ?? null,
          cfdiBody.Receiver?.Rfc  ?? null,
          cfdiBody.Receiver?.Name ?? null,
          _total_cfdi  ?? null,
        ]
      )
      if (!insRows[0]?.p_id_factura) {
        console.error('[facturama] No se pudo guardar en BD:', insRows[0]?.p_mensaje)
      }
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
    const r = await fetch(`${baseUrl()}/Cfdi/pdf/issued/${encodeURIComponent(req.params.id)}`, {
      headers: { 'Authorization': authHeader() },
    })
    if (!r.ok) return res.status(r.status).end()
    const data = await r.json()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.pdf"`)
    res.send(Buffer.from(data.Content, 'base64'))
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// ── Descargar XML ─────────────────────────────────────────────────────────
router.get('/facturama/cfdi/:id/xml', async (req, res) => {
  try {
    const r = await fetch(`${baseUrl()}/Cfdi/xml/issued/${encodeURIComponent(req.params.id)}`, {
      headers: { 'Authorization': authHeader() },
    })
    if (!r.ok) return res.status(r.status).end()
    const data = await r.json()
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.xml"`)
    res.send(Buffer.from(data.Content, 'base64'))
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

module.exports = router
