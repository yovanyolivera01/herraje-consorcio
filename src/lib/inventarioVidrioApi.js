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

// ── Consulta de inventario ────────────────────────────────────────────────────

export const getInventarioVidrio = async () => {
  const rows = await apiFetch('/inventario-vidrio')
  return rows.map(row => ({
    id_inventario:    row.id_inventario,
    id_tipo_vidrio:   row.id_tipo_vidrio,
    tipo_vidrio:      row.tipo_vidrio,
    medidas:          row.medidas,
    hojas_entrada:    Number(row.hojas_entrada ?? 0),
    hojas_restante:   Number(row.hojas_restante ?? 0),
    cantidad_hojas:   row.cantidad_hojas,
    m2_por_hoja:      Number(row.m2_por_hoja),
    m2_disponible:    Number(row.m2_disponible),
    m2_total_inicial: Number(row.m2_total_inicial),
    pct_usado:        Number(row.pct_usado),
    alerta_stock:     row.alerta_stock,
    es_preferido:     row.es_preferido ?? false,
  }))
}

// ── Marcar lote como preferido ────────────────────────────────────────────────

export const setLotePreferido = async (id_inventario) =>
  apiFetch(`/inventario-vidrio/${id_inventario}/preferido`, { method: 'POST', body: {} })

// ── Registrar entrada de hojas ────────────────────────────────────────────────

export const registrarInventarioVidrio = async ({ id_tipo_vidrio, largo_cm, ancho_cm, cantidad_hojas }) => {
  const data = await apiFetch('/inventario-vidrio', {
    method: 'POST',
    body: { id_tipo_vidrio, largo_cm: Number(largo_cm), ancho_cm: Number(ancho_cm), cantidad_hojas: Number(cantidad_hojas) },
  })
  return {
    id_inventario: data.id_inventario,
    m2_total:      Number(data.m2_total),
    mensaje:       data.mensaje,
  }
}

// ── Ajuste manual por hojas completas ─────────────────────────────────────────

export const ajustarInventario = async (id_inventario, hojas_delta, nota) =>
  apiFetch(`/inventario-vidrio/${id_inventario}/ajustar`, {
    method: 'POST',
    body: { hojas_delta, nota: nota ?? null },
  })

// ── Historial de movimientos de un lote ──────────────────────────────────────

export const getMovimientosInventario = async (id_inventario) =>
  apiFetch(`/inventario-vidrio/${id_inventario}/movimientos`)
