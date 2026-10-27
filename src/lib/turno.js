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


export const updateTurno = async (id, { hora_inicio, hora_fin, tolerancia, dias_laborales, minutos_comida }) =>
  apiFetch(`/personal/turno/${id}`, { method: 'PUT', body: { hora_inicio, hora_fin, tolerancia, dias_laborales, minutos_comida } })

export const deleteTurno = async (id) =>
  apiFetch(`/personal/turno/${id}`, { method: 'DELETE' })

const DIAS_CORTO = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' }

// '09:00:00' -> '09:00'
const hhmm = (t) => (t ? String(t).slice(0, 5) : '')

// Texto para mostrar un turno sin su id: "09:00 - 18:00 · Lun, Mar, Mié, Jue, Vie"
export const descripcionTurno = (t) =>
  `${hhmm(t.hora_inicio)} - ${hhmm(t.hora_fin)} · ${(t.dias_laborales ?? []).map(d => DIAS_CORTO[d] ?? d).join(', ')}`
