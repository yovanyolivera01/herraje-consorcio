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
// ── Empleados ─────────────────────────────────────────────────────────────────
export async function getEmpleados() {
  return apiFetch('/personal/empleados')
}

export async function createEmpleado(form) {
  return apiFetch('/personal/empleados', { method: 'POST', body: form })
}

export async function updateEmpleado(id, form) {
  return apiFetch(`/personal/empleados/${id}`, { method: 'PUT', body: form })
}

export async function deleteEmpleado(id) {
  return apiFetch(`/personal/empleados/${id}`, { method: 'DELETE' })
}

// Actualiza solo el descriptor facial (cara), sin tocar el resto del
// registro — para un flujo de captura de rostro independiente del form
// completo (p.ej. un botón "Capturar rostro").
export async function updateEmpleadoCara(id, cara) {
  return apiFetch(`/personal/empleados/${id}/cara`, { method: 'PATCH', body: { cara } })
}