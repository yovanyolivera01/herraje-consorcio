import { hoyMX, horaActualMX } from './utils'

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

// Decide automáticamente si toca marcar entrada o salida (según si el
// empleado ya tiene un registro hoy) y lo hace de una — usado por el flujo
// de reconocimiento facial (Layout.jsx): ahí no hay un botón que el usuario
// presione aparte, ya se identificó frente a la cámara así que se registra
// directo, a diferencia de botonRegistro.jsx donde la persona ya elegida
// decide con un click cuál de las dos acciones le toca.
export async function registrarAsistenciaAutomatica(id_empleado, id_turno) {
  const registroHoy = await getRegistroHoy(id_empleado)

  if (!registroHoy) {
    const registro = await registroCheckIn({
      id_empleado, id_turno,
      fecha:        hoyMX(),
      hora_entrada: horaActualMX(),
      created_at:   new Date().toISOString(),
    })
    return { accion: 'entrada', registro }
  }

  if (!registroHoy.hora_salida) {
    const registro = await registroCheckOut(registroHoy.id_registro, horaActualMX())
    return { accion: 'salida', registro }
  }

  return { accion: 'completo', registro: registroHoy }
}