import { http } from './http'

// ── Helpers ───────────────────────────────────────────────────────────────

const TZ = 'America/Mexico_City'
function formatearFechaHora(isoString) {
  const d = new Date(isoString)
  const fechaFormatter = new Intl.DateTimeFormat('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ,
  })
  const horaFormatter = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
  })
  return {
    fecha: fechaFormatter.format(d),
    hora:  horaFormatter.format(d).slice(0, 5),
  }
}

const mapProducto = (row) => ({
  id:              row.id,
  codigo:          row.codigo          ?? '',
  codigoProveedor: row.codigo_proveedor ?? '',
  proveedorNombre: row.proveedor_nombre,
  marca:           row.marca            || '',
  tono:            row.tono             || '',
  descripcion:     row.descripcion,
  espesor:         row.espesor_mm,
  precio:          Number(row.precio),
  existencias:     row.existencias,
  imagen:          row.imagen_url        || '',
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

// ── Proveedores ───────────────────────────────────────────────────────────

export const getProveedores = () => http.get('/api/proveedores')

export const createProveedor = ({ nombre, telefono }) =>
  http.post('/api/proveedores', { nombre, telefono })

export const updateProveedor = (codigo, { nombre, telefono }) =>
  http.put(`/api/proveedores/${codigo}`, { nombre, telefono })

export const deleteProveedor = (codigo) => http.del(`/api/proveedores/${codigo}`)

// ── Productos ─────────────────────────────────────────────────────────────

export const getProductos = async () => {
  const rows = await http.get('/api/productos')
  return rows.map(mapProducto)
}

export const createProducto = (formData) => http.post('/api/productos', formData)

export const updateProducto = (productoId, formData) =>
  http.put(`/api/productos/${productoId}`, formData)

export const deleteProducto = (codigo) => http.del(`/api/productos/${codigo}`)

export const ajustarExistencias = (productoId, delta, tipo, nota = null) =>
  http.post(`/api/productos/${productoId}/ajustar`, { delta, tipo, nota })

// ── Ventas ────────────────────────────────────────────────────────────────

export const getVentas = async () => {
  const rows = await http.get('/api/ventas')
  return rows.map(mapVentaResumen)
}

export const createVenta = async (partidas) => {
  const { venta, partidas: perts } = await http.post('/api/ventas', { partidas })
  const { fecha, hora } = formatearFechaHora(venta.fecha_hora)
  return {
    id:       venta.id,
    folio:    venta.folio,
    fecha,
    hora,
    fechaISO: venta.fecha_hora,
    total:    Number(venta.total),
    partidas: perts.map(p => ({
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
  const { venta, detalles } = await http.get(`/api/ventas/${ventaId}`)
  const { fecha, hora } = formatearFechaHora(venta.fecha_hora)
  return {
    id:       venta.id,
    folio:    venta.folio,
    fecha,
    hora,
    fechaISO: venta.fecha_hora,
    total:    Number(venta.total),
    partidas: detalles.map(row => ({
      codigoProducto: row.codigo         ?? '',
      descripcion:    row.descripcion    ?? '',
      tono:           row.tono           ?? '',
      precioUnitario: Number(row.precio_unitario),
      cantidad:       row.cantidad,
      subtotal:       Number(row.subtotal),
    })),
  }
}
