const API = import.meta.env.VITE_API_URL || ''

async function apiFetch(path) {
  const res = await fetch(`${API}/api${path}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
  return data
}

// Los cálculos de horas se hacen en el backend (services/calculosHoras.js);
// aquí solo se consultan. Fechas en formato YYYY-MM-DD.

// Detalle por día + totales de un empleado en un rango
export const getHorasEmpleado = (id_empleado, fecha_inicio, fecha_fin) =>
  apiFetch(`/calculos/horas/empleado/${id_empleado}?fecha_inicio=${fecha_inicio}&fecha_fin=${fecha_fin}`)

// Totales de todos los empleados activos en un rango
export const getResumenHoras = (fecha_inicio, fecha_fin) =>
  apiFetch(`/calculos/horas/resumen?fecha_inicio=${fecha_inicio}&fecha_fin=${fecha_fin}`)

// 480 -> '8h 00m'
export function formatearMinutos(min) {
  if (min == null) return '--'
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`
}

// 495 -> '08:15' (con signo si es negativo)
export function minToHHMM(min) {
  if (min == null) return '--:--'
  const abs = Math.abs(min)
  return `${min < 0 ? '-' : ''}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

// '09:15:00' -> '09:15'
export const horaCorta = (t) => (t ? t.slice(0, 5) : '—')

// Registros (4 marcas + cálculos) de todos los empleados en un día
export const getHorasDia = (fecha) =>
  apiFetch(`/calculos/horas/dia?fecha=${fecha}`)
