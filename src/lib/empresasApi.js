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

// ── Empresas ──────────────────────────────────────────────────────────────────

export const getEmpresas = async () => apiFetch('/empresas')

export const createEmpresa = async (data) =>
  apiFetch('/empresas', { method: 'POST', body: data })

export const updateEmpresa = async (id, data) =>
  apiFetch(`/empresas/${id}`, { method: 'PUT', body: data })

// ── Vincular cliente a empresa ────────────────────────────────────────────────

export const vincularClienteEmpresa = async (id_cliente, id_empresa) =>
  apiFetch(`/clientes/${id_cliente}/empresa`, { method: 'POST', body: { id_empresa } })

export const getEmpresaDeCliente = async (id_cliente) =>
  apiFetch(`/clientes/${id_cliente}/empresa`)

// ── Precios por empresa ───────────────────────────────────────────────────────

export const getPreciosEmpresa = async (id_empresa) =>
  apiFetch(`/empresas/${id_empresa}/precios`)

export const guardarPrecioEmpresa = async ({ id_empresa, id_tipo_vidrio, id_proceso, precio_m2 }) =>
  apiFetch(`/empresas/${id_empresa}/precios`, { method: 'POST', body: { id_tipo_vidrio, id_proceso: id_proceso ?? null, precio_m2 } })

// ── Precios por cliente registrado ────────────────────────────────────────────

export const getPreciosClienteRegistrado = async (id_cliente) =>
  apiFetch(`/clientes/${id_cliente}/precios`)

export const guardarPrecioClienteRegistrado = async ({ id_cliente, id_tipo_vidrio, id_proceso, precio_m2 }) =>
  apiFetch(`/clientes/${id_cliente}/precios`, { method: 'POST', body: { id_tipo_vidrio, id_proceso: id_proceso ?? null, precio_m2 } })

// ── Documento de cotización para empresa ──────────────────────────────────────

export const getDocumentoEmpresa = async (id_cotizacion_origen) =>
  apiFetch(`/cotizaciones/${id_cotizacion_origen}/documento-empresa`)
