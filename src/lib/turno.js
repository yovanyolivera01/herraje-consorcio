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


// ── Turnos ────────────────────────────────────────────────────────────────

export const getTurnos = async () => apiFetch('/personal/turno')

export const createTurno = async ({ hora_inicio, hora_fin, tolerancia, dias_laborales, minutos_comida }) =>
  apiFetch('/personal/turno', { method: 'POST', body: { hora_inicio, hora_fin, tolerancia, dias_laborales, minutos_comida } })

