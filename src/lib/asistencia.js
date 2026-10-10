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

// Las 4 marcas del día, en orden. `campo` es la columna de `registro` que
// guarda la hora; `ruta` el sufijo de PUT /asistencia/:id/<ruta>.
export const MARCAS = [
  { accion: 'entrada',        campo: 'hora_llegada',        ruta: null,             texto: 'Entrada' },
  { accion: 'salida_comida',  campo: 'hora_salida_comida',  ruta: 'salida-comida',  texto: 'Salida a comer' },
  { accion: 'regreso_comida', campo: 'hora_regreso_comida', ruta: 'regreso-comida', texto: 'Regreso de comer' },
  { accion: 'salida',         campo: 'hora_salida',         ruta: 'salida',         texto: 'Salida' },
]

export const getAsistenciaHoy = (id_empleado) =>
  apiFetch(`/asistencia/hoy/${id_empleado}`)

export const marcarEntrada = ({ id_empleado, id_turno }) =>
  apiFetch('/asistencia/entrada', {
    method: 'POST',
    body: { id_empleado, id_turno, fecha: hoyMX(), hora: horaActualMX(), created_at: new Date().toISOString() },
  })

export const marcarSiguiente = (id_registro, ruta) =>
  apiFetch(`/asistencia/${id_registro}/${ruta}`, { method: 'PUT', body: { hora: horaActualMX() } })

// Siguiente marca pendiente del registro de hoy (null = las 4 ya hechas).
// Sin registro todavía -> toca la entrada.
export function siguienteMarca(registroHoy) {
  if (!registroHoy) return MARCAS[0]
  return MARCAS.find(m => !registroHoy[m.campo]) ?? null
}

// Decide cuál de las 4 marcas toca y la registra de una — lo usa el
// reconocimiento facial: ya se identificó a la persona frente a la cámara,
// no hay botón aparte que presionar.
// Regresa { accion, texto, registro }; accion 'completo' si ya hizo las 4.
export async function registrarAsistenciaAutomatica(id_empleado, id_turno) {
  const registroHoy = await getAsistenciaHoy(id_empleado)
  const marca = siguienteMarca(registroHoy)

  if (!marca) return { accion: 'completo', texto: 'Completo', registro: registroHoy }

  const registro = marca.ruta === null
    ? await marcarEntrada({ id_empleado, id_turno })
    : await marcarSiguiente(registroHoy.id_registro, marca.ruta)

  return { accion: marca.accion, texto: marca.texto, registro }
}
