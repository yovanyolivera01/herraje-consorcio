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

// Prices in the system include IVA 16%.
// Facturama needs the pre-tax base amount.
function calcularImportes(totalConIva) {
  const base = Math.round((totalConIva / 1.16) * 100) / 100
  const iva  = Math.round((totalConIva - base) * 100) / 100
  return { base, iva }
}

function fechaActual() {
  // SAT requires local Mexico City time, not UTC
  return new Date()
    .toLocaleString('sv', { timeZone: 'America/Mexico_City' })
    .replace(' ', 'T')
}

export async function crearCFDI(resumen, receptor) {
  const { rfc, nombre, cpFiscal, regimen, usoCfdi, formaPago, metodoPago } = receptor
  const { base, iva } = calcularImportes(resumen.total)

  const body = {
    // Internal metadata stripped by backend before sending to Facturama
    _id_pedido:    resumen.id,
    _folio_pedido: resumen.folio,
    _total_cfdi:   resumen.total,

    // CFDI 4.0 payload
    Fecha: fechaActual(),
    Receptor: {
      Rfc:                     rfc.trim().toUpperCase(),
      Nombre:                  nombre.trim().toUpperCase(),
      DomicilioFiscalReceptor: cpFiscal.trim(),
      RegimenFiscalReceptor:   regimen,
      UsoCfdi:                 usoCfdi,
    },
    TipoDeComprobante: 'I',
    MetodoPago:        metodoPago,
    FormaPago:         formaPago,
    Moneda:            'MXN',
    Conceptos: [
      {
        ClaveProdServ:    '44103103',
        ClaveUnidad:      'H87',
        Unidad:           'Pieza',
        NoIdentificacion: resumen.folio,
        Descripcion:      `Vidrio templado y aluminio según pedido ${resumen.folio}`,
        Cantidad:         1.0,
        ValorUnitario:    base,
        Importe:          base,
        Descuento:        0.0,
        Impuestos: {
          Traslados: [
            {
              Base:       base,
              Impuesto:   '002',
              TipoFactor: 'Tasa',
              TasaOCuota: '0.160000',
              Importe:    iva,
            },
          ],
        },
      },
    ],
  }

  return apiFetch('/facturama/cfdi', { method: 'POST', body })
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
