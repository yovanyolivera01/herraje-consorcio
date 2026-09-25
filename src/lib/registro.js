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


export const registroCheckIn = async ({ id_empleado, id_turno, fecha, hora_entrada, created_at }) =>
  apiFetch('/registro', { method: 'POST', body: { id_empleado, id_turno, fecha, hora_entrada, created_at } })

export const registroCheckOut = async (id_registro, hora_salida) =>
  apiFetch(`/registro/${id_registro}`, { method: 'PUT', body: { hora_salida } })

export const getRegistroHoy = async (id_empleado) =>
  apiFetch(`/registro/hoy/${id_empleado}`)