import { mxDayBound } from './utils'

const API = import.meta.env.VITE_API_URL || ''

async function apiFetch(path, options = {}) {
  const { method = 'GET', body } = options
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
  return data
}

// Prices in the system are pre-tax. When a client requires a factura,
// IVA 16% is added on top of the stored cost (not extracted from it).
function calcularImportes(costoSinIva) {
  const base = Math.round(costoSinIva * 100) / 100
  const iva  = Math.round((costoSinIva * 0.16) * 100) / 100
  return { base, iva }
}

function fechaActual() {
  // SAT requires local Mexico City time, not UTC
  return new Date()
    .toLocaleString('sv', { timeZone: 'America/Mexico_City' })
    .replace(' ', 'T')
}

export const getPartidasParaFactura = async (id_pedido) =>
  apiFetch(`/pedidos/${id_pedido}/partidas-factura`)

export async function crearCFDI(resumen, receptor) {
  const { rfc, nombre, cpFiscal, regimen, usoCfdi, formaPago, metodoPago } = receptor

  const partidas = await getPartidasParaFactura(resumen.id)

  // Itemized: one Concepto per partida, each with its own pre-tax base/IVA —
  // keeps the invoice's tax total consistent with what was actually sold,
  // instead of deriving one lump base/IVA from the pedido's grand total.
  const conceptos = (partidas.length ? partidas : [{ descripcion: `Vidrio templado y aluminio según pedido ${resumen.folio}`, cantidad: 1, subtotal: resumen.total }])
    .map(p => {
      const cantidad = Number(p.cantidad) > 0 ? Number(p.cantidad) : 1
      const { base, iva } = calcularImportes(Number(p.subtotal))
      const valorUnitario = Math.round((base / cantidad) * 100) / 100
      const total = Math.round((base + iva) * 100) / 100
      return {
        ProductCode:         '44103103',
        UnitCode:            'H87',
        Unit:                'Pieza',
        IdentificationNumber: resumen.folio || '',
        // Facturama's validator crashes (ArgumentNullException) on a null
        // Description instead of rejecting it cleanly — some partida rows
        // (Maquila/Extra/Producto) can have a null descripcion in the DB.
        Description:         p.descripcion || 'Vidrio, herraje o servicio de maquila',
        Quantity:            cantidad,
        UnitPrice:           valorUnitario,
        Subtotal:            base,
        TaxObject:           '02', // taxes itemized at concept level
        Taxes: [
          {
            Name:          'IVA',
            Rate:          '0.16',
            Base:          base,
            Total:         iva,
            IsRetention:   false,
            IsFederalTax:  true,
          },
        ],
        Total: total,
      }
    })

  const rfcReceptor = rfc.trim().toUpperCase()
  const RFC_GENERICOS = ['XAXX010101000', 'XEXX010101000']

  const body = {
    // Internal metadata stripped by backend before sending to Facturama
    _id_pedido:    resumen.id,
    _folio_pedido: resumen.folio,
    _total_cfdi:   resumen.total,

    // CFDI 4.0 payload — Facturama's own JSON schema (English property names),
    // NOT the raw SAT XML tag names (Receptor/Conceptos/Impuestos/etc.)
    Receiver: {
      Rfc:          rfcReceptor,
      Name:         nombre.trim().toUpperCase(),
      CfdiUse:      usoCfdi,
      FiscalRegime: regimen,
      TaxZipCode:   cpFiscal.trim(),
    },
    CfdiType:      'I',
    PaymentForm:   formaPago,
    PaymentMethod: metodoPago,
    Exportation:   '01', // "No aplica" — required by CFDI 4.0, not an export transaction
    Date:          fechaActual(),
    Items: conceptos,
  }

  // SAT (CFDI 4.0) requires a GlobalInformation node whenever the receiver
  // is the generic "público en general" RFC — summarizes the billing
  // period this factura global covers.
  if (RFC_GENERICOS.includes(rfcReceptor)) {
    const now = new Date()
    body.GlobalInformation = {
      Periodicity: '01', // Diario — se factura una operación puntual, no un acumulado
      Months:      String(now.getMonth() + 1).padStart(2, '0'),
      Year:        String(now.getFullYear()),
    }
  }

  return apiFetch('/facturama/cfdi', { method: 'POST', body })
}

export async function cancelarCFDI(id_factura, motivo, uuid_sustitucion) {
  return apiFetch(`/facturama/cfdi/${id_factura}/cancelar`, {
    method: 'DELETE',
    body: { motivo, uuid_sustitucion: uuid_sustitucion || '' },
  })
}

export async function getFacturas(fechaDesde, fechaHasta) {
  const params = new URLSearchParams()
  if (fechaDesde) params.set('fecha_inicio', mxDayBound(fechaDesde, false))
  if (fechaHasta) params.set('fecha_fin',    mxDayBound(fechaHasta, true))
  return apiFetch(`/facturas?${params}`)
}

export const getCFDIPdfUrl = (id) =>
  `${API}/api/facturama/cfdi/${encodeURIComponent(id)}/pdf`

export const getCFDIXmlUrl = (id) =>
  `${API}/api/facturama/cfdi/${encodeURIComponent(id)}/xml`
