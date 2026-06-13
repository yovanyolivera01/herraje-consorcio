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

// ── Helpers ───────────────────────────────────────────────────────────────────

const TZ = 'America/Mexico_City'
function formatearFechaHora(isoString) {
  const utc = /Z|[+-]\d{2}:?\d{2}$/.test(isoString ?? '') ? isoString : (isoString ?? '') + 'Z'
  const d = new Date(utc)
  return {
    fecha: new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(d),
    hora:  new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d).slice(0, 5),
  }
}

const mapProducto = (row) => ({
  id:              row.id,
  codigo:          row.codigo ?? '',
  codigoProveedor: row.codigo_proveedor ?? '',
  proveedorNombre: row.proveedor_nombre,
  marca:           row.marca || '',
  tono:            row.tono  || '',
  descripcion:     row.descripcion,
  espesor:         row.espesor_mm,
  precio:          Number(row.precio),
  existencias:     row.existencias,
  imagen:          row.imagen_url || '',
  stockBajo:       row.stock_bajo,
})

const mapVentaResumen = (row) => {
  const { fecha, hora } = formatearFechaHora(row.fecha_hora)
  return {
    id:          row.id,
    folio:       row.folio,
    fecha,
    hora,
    fechaISO:    row.fecha_hora,
    total:       Number(row.total),
    numPartidas: Number(row.num_partidas),
    totalPiezas: Number(row.total_piezas),
  }
}

// ── Proveedores ───────────────────────────────────────────────────────────────

export const getProveedores = async () => apiFetch('/proveedores')

export const createProveedor = async ({ nombre, telefono }) =>
  apiFetch('/proveedores', { method: 'POST', body: { nombre, telefono } })

export const updateProveedor = async (codigo, { nombre, telefono }) =>
  apiFetch(`/proveedores/${codigo}`, { method: 'PUT', body: { nombre, telefono } })

export const deleteProveedor = async (codigo) =>
  apiFetch(`/proveedores/${codigo}`, { method: 'DELETE' })

// ── Productos ─────────────────────────────────────────────────────────────────

export const getProductos = async () => {
  const rows = await apiFetch('/productos')
  return rows.map(mapProducto)
}

export const createProducto = async (formData) => {
  const row = await apiFetch('/productos', { method: 'POST', body: formData })
  return mapProducto(row)
}

export const updateProducto = async (productoId, formData) => {
  const row = await apiFetch(`/productos/${productoId}`, { method: 'PUT', body: formData })
  return mapProducto(row)
}

export const deleteProducto = async (codigo) =>
  apiFetch(`/productos/${codigo}`, { method: 'DELETE' })

export const ajustarExistencias = async (productoId, delta, tipo, nota = null) =>
  apiFetch(`/productos/${productoId}/ajustar`, { method: 'POST', body: { delta, tipo, nota } })

// ── Ventas ────────────────────────────────────────────────────────────────────

export const getVentas = async () => {
  const rows = await apiFetch('/ventas')
  return rows.map(mapVentaResumen)
}

export const createVenta = async (partidas) => {
  const venta = await apiFetch('/ventas', { method: 'POST', body: { partidas } })
  const { fecha, hora } = formatearFechaHora(venta.fecha_hora)
  return {
    id:       venta.id,
    folio:    venta.folio,
    fecha,
    hora,
    fechaISO: venta.fecha_hora,
    total:    Number(venta.total),
    partidas: partidas.map(p => ({
      codigoProducto: p.codigoProducto,
      descripcion:    p.descripcion,
      tono:           p.tono,
      precioUnitario: p.precioUnitario,
      cantidad:       p.cantidad,
      subtotal:       p.subtotal,
    })),
  }
}

export const getDetalleVenta = async (ventaId) => {
  const data = await apiFetch(`/ventas/${ventaId}`)
  const { fecha, hora } = formatearFechaHora(data.venta.fecha_hora)
  return {
    id:       data.venta.id,
    folio:    data.venta.folio,
    fecha,
    hora,
    fechaISO: data.venta.fecha_hora,
    total:    Number(data.venta.total),
    partidas: (data.detalles ?? []).map(row => ({
      codigoProducto: row.codigo        ?? '',
      descripcion:    row.descripcion   ?? '',
      tono:           row.tono          ?? '',
      precioUnitario: Number(row.precio_unitario),
      cantidad:       row.cantidad,
      subtotal:       Number(row.subtotal),
    })),
  }
}
