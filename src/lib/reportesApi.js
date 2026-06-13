import { mxDayBound } from './utils'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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

const TZ = 'America/Mexico_City'
function formatFecha(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(d)
}

// ── Partidas de vidrio de pedidos VIDRIO entregados ───────────────────────────

export const getPartidasVidrioEntregadas = async (fechaDesde, fechaHasta) => {
  const params = new URLSearchParams()
  if (fechaDesde) params.set('fecha_inicio', mxDayBound(fechaDesde))
  if (fechaHasta) params.set('fecha_fin',    mxDayBound(fechaHasta, true))
  const rows = await apiFetch(`/reportes/partidas-vidrio?${params}`)
  return rows.map(p => ({
    id:               p.id_partida_pedido,
    id_pedido:        p.id_pedido,
    folio:            p.folio ?? '—',
    fechaEntrega:     formatFecha(p.fecha_entrega),
    fechaEntregaISO:  p.fecha_entrega,
    clienteNombre:    p.cliente_nombre ?? 'Mostrador',
    clave_vidrio:     p.clave_vidrio ?? '—',
    nombre_vidrio:    p.nombre_vidrio ?? '',
    largo_cm:         Number(p.largo_cm),
    ancho_cm:         Number(p.ancho_cm),
    metros2:          Number(p.metros2 ?? 0),
    cantidad:         Number(p.cantidad ?? 1),
    precio_m2:        Number(p.precio_m2),
    subtotal_vidrio:  Number(p.subtotal_vidrio),
    subtotal_procesos: Number(p.subtotal_procesos),
    total_partida:    Number(p.total_partida),
  }))
}

// ── Extras de MAQUILA de cotizaciones mixtas entregadas ───────────────────────

export const getExtrasMaquilaEntregadas = async (fechaDesde, fechaHasta) => {
  const params = new URLSearchParams()
  if (fechaDesde) params.set('fecha_inicio', mxDayBound(fechaDesde))
  if (fechaHasta) params.set('fecha_fin',    mxDayBound(fechaHasta, true))
  const rows = await apiFetch(`/reportes/extras-maquila?${params}`)
  return rows.map(e => ({
    id:              e.id_partida_extra,
    id_pedido:       e.id_pedido,
    folio:           e.folio ?? '—',
    fechaEntrega:    formatFecha(e.fecha_entrega_iso),
    fechaEntregaISO: e.fecha_entrega_iso,
    clienteNombre:   e.cliente_nombre ?? 'Mostrador',
    descripcion:     e.descripcion ?? '',
    unidad:          e.unidad ?? '',
    cantidad:        Number(e.cantidad ?? 0),
    precio_unitario: Number(e.precio_unitario ?? 0),
    subtotal:        Number(e.subtotal ?? 0),
    tipo_pago:       e.tipo_pago,
  }))
}

// ── Extras de HERRAJE de cotizaciones mixtas entregadas ───────────────────────

export const getExtrasHerrajeEntregadas = async (fechaDesde, fechaHasta) => {
  const params = new URLSearchParams()
  if (fechaDesde) params.set('fecha_inicio', mxDayBound(fechaDesde))
  if (fechaHasta) params.set('fecha_fin',    mxDayBound(fechaHasta, true))
  const rows = await apiFetch(`/reportes/extras-herraje?${params}`)
  return rows.map(e => ({
    id:              e.id_partida_extra,
    id_pedido:       e.id_pedido,
    folio:           e.folio ?? '—',
    fechaEntrega:    formatFecha(e.fecha_entrega_iso),
    fechaEntregaISO: e.fecha_entrega_iso,
    clienteNombre:   e.cliente_nombre ?? 'Mostrador',
    descripcion:     e.descripcion ?? '',
    unidad:          e.unidad ?? '',
    cantidad:        Number(e.cantidad ?? 0),
    precio_unitario: Number(e.precio_unitario ?? 0),
    subtotal:        Number(e.subtotal ?? 0),
    tipo_pago:       e.tipo_pago,
  }))
}

// ── Ventas directas de herraje ────────────────────────────────────────────────

export const getVentasDirectasHerraje = async (fechaDesde, fechaHasta) => {
  const params = new URLSearchParams()
  if (fechaDesde) params.set('fecha_inicio', mxDayBound(fechaDesde))
  if (fechaHasta) params.set('fecha_fin',    mxDayBound(fechaHasta, true))
  const rows = await apiFetch(`/reportes/ventas-herraje?${params}`)
  return rows.map(d => ({
    id:              d.id,
    folio:           d.folio ?? '—',
    fechaEntrega:    formatFecha(d.fecha_hora),
    fechaEntregaISO: d.fecha_hora,
    clienteNombre:   'Mostrador',
    descripcion:     d.descripcion ?? '',
    unidad:          d.unidad ?? 'pza',
    cantidad:        Number(d.cantidad ?? 0),
    precio_unitario: Number(d.precio_unitario ?? 0),
    subtotal:        Number(d.subtotal ?? 0),
    tipo_pago:       'CONTADO',
  }))
}
