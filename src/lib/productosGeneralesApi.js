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

// ── Catálogo de productos generales ──────────────────────────────────────────

export const getProductosGenerales = async () => {
  const rows = await apiFetch('/productos-generales')
  return rows.map(row => ({
    ...row,
    proveedor_nombre: row.proveedor_nombre ?? null,
  }))
}

export const createProductoGeneral = async ({ nombre, descripcion, unidad, precio }) =>
  apiFetch('/productos-generales', {
    method: 'POST',
    body: { nombre, descripcion: descripcion || null, unidad: unidad || null, precio: precio ? Number(precio) : null },
  })

export const updateProductoGeneral = async (id, campos) =>
  apiFetch(`/productos-generales/${id}`, { method: 'PUT', body: campos })

// ── Ajuste de existencias ─────────────────────────────────────────────────────

export const ajustarExistenciasGeneral = async (id, delta) => {
  const data = await apiFetch(`/productos-generales/${id}/ajustar`, { method: 'POST', body: { delta } })
  return data.existencias
}

// ── Descontar existencias por venta ──────────────────────────────────────────

export const venderProductoGeneral = async (id_producto_general, cantidad) => {
  try {
    await apiFetch(`/productos-generales/${id_producto_general}/vender`, { method: 'POST', body: { cantidad } })
  } catch {}
}
