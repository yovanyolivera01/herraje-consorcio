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


// ── Puestos ───────────────────────────────────────────────────────────────────

export const getPuestos = async () => apiFetch('/puestos')

export const getPuesto = async (id_puesto) => apiFetch(`/puestos/${id_puesto}`)

export const createPuesto = async ({ nombre, descripcion, plazas, salario, hora_extra, id_estado }) =>
  apiFetch('/puestos', { method: 'POST', body: { nombre, descripcion, plazas, salario, hora_extra, id_estado } })

export const deletePuesto = async (id_puesto) => apiFetch(`/puestos/${id_puesto}`, { method: 'DELETE' })

export const updatePuesto = async (id_puesto, { plazas, salario, hora_extra }) =>
  apiFetch(`/puestos/${id_puesto}`, { method: 'PUT', body: { plazas, salario, hora_extra } })