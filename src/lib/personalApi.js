import { http } from './http'

// ── Horario base (constantes) ─────────────────────────────────
export const HORARIO_BASE = {
  SEMANA: { entrada: '09:30', salida: '19:30', minutosEsperados: 600 },
  SABADO: { entrada: '09:30', salida: '16:30', minutosEsperados: 420 },
}
export const MINUTOS_SEMANA_COMPLETA = 600 * 5 + 420

export function getTipoDia(nombreDia) {
  return nombreDia === 'Sábado' ? 'SABADO' : 'SEMANA'
}

// ── Helpers de tiempo ─────────────────────────────────────────
export function timeToMin(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function minToHHMM(min) {
  if (min === null || min === undefined) return '--:--'
  const abs = Math.abs(min)
  return String(Math.floor(abs / 60)).padStart(2, '0') + ':' + String(abs % 60).padStart(2, '0')
}

function normTime(t) {
  return t ? t.slice(0, 5) : null
}

// ── Cálculo por día ───────────────────────────────────────────
export function calcularDia(horaEntrada, horaSalida, nombreDia) {
  const tipo    = getTipoDia(nombreDia)
  const horario = HORARIO_BASE[tipo]
  const entMin  = timeToMin(horaEntrada)
  const salMin  = timeToMin(horaSalida)
  const entEsp  = timeToMin(horario.entrada)
  const salEsp  = timeToMin(horario.salida)

  let estado = 'AUSENTE'
  if (entMin !== null && salMin !== null) estado = 'COMPLETO'
  else if (entMin !== null)              estado = 'SALIDA_PENDIENTE'

  let minutosTrabajados = null
  let extraEntrada      = 0
  let extraSalida       = 0
  let esPuntual         = false

  if (estado === 'COMPLETO') {
    minutosTrabajados = salMin - entMin
    if (entMin < entEsp) extraEntrada = entEsp - entMin
    if (salMin > salEsp) extraSalida  = salMin - salEsp
  }
  if (entMin !== null) esPuntual = entMin <= entEsp

  return {
    estado,
    minutosTrabajados,
    extraEntrada,
    extraSalida,
    totalExtra: extraEntrada + extraSalida,
    esPuntual,
    horario,
  }
}

// ── Cálculo resumen semanal ───────────────────────────────────
export function calcularResumenSemanal(registros) {
  let minutosTrabajados = 0
  let minutosExtra      = 0
  let diasCompletos     = 0
  let primerDiaTardio   = null

  for (const reg of registros) {
    const calc = calcularDia(reg.hora_entrada, reg.hora_salida, reg.nombre_dia)
    if (calc.estado === 'COMPLETO') {
      minutosTrabajados += calc.minutosTrabajados
      minutosExtra      += calc.totalExtra
      diasCompletos++
      if (!calc.esPuntual && !primerDiaTardio) primerDiaTardio = reg.nombre_dia
    }
  }

  const DIAS_LABORALES = 6 // Lun–Sáb

  let bonoPuntualidad = false
  let motivoBono      = null
  if (diasCompletos === 0) {
    motivoBono = 'Sin registros completos en la semana.'
  } else if (diasCompletos < DIAS_LABORALES) {
    motivoBono = `Solo asistió ${diasCompletos} de ${DIAS_LABORALES} días.`
  } else if (primerDiaTardio) {
    motivoBono = `Llegada tardía el ${primerDiaTardio}.`
  } else {
    bonoPuntualidad = true
  }

  return {
    minutos_trabajados:         minutosTrabajados,
    minutos_esperados:          MINUTOS_SEMANA_COMPLETA,
    minutos_extra:              minutosExtra,
    dias_con_registro_completo: diasCompletos,
    bono_puntualidad:           bonoPuntualidad,
    motivo_bono:                motivoBono,
  }
}

// ── Helpers de semana ─────────────────────────────────────────
// Convierte un objeto Date a "YYYY-MM-DD" usando hora LOCAL (no UTC)
function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getLunesDeSemana(fechaStr) {
  const d   = new Date(fechaStr + 'T12:00:00')
  const dia = d.getDay()
  const off = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + off)
  return localStr(d)
}

export function getLunesAnterior(fechaLunes) {
  const d = new Date(fechaLunes + 'T12:00:00')
  d.setDate(d.getDate() - 7)
  return localStr(d)
}

export function getLunesSiguiente(fechaLunes) {
  const d = new Date(fechaLunes + 'T12:00:00')
  d.setDate(d.getDate() + 7)
  return localStr(d)
}

const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
function fmtCorto(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00')
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`
}

const NOMBRES_DIA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

export function getNombreDia(fechaStr) {
  return NOMBRES_DIA[new Date(fechaStr + 'T12:00:00').getDay()]
}

export function getDiasDeSemana(fechaLunes) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(fechaLunes + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return { fecha: localStr(d), nombreDia: NOMBRES_DIA[d.getDay()], numeroDia: d.getDate() }
  })
}

// ── Semanas ───────────────────────────────────────────────────
export async function getOrCreateSemana(fechaRef) {
  const lunes  = getLunesDeSemana(fechaRef)
  const sabado = (() => {
    const d = new Date(lunes + 'T12:00:00')
    d.setDate(d.getDate() + 5)
    return localStr(d)
  })()
  const descripcion = `Semana del ${fmtCorto(lunes)} al ${fmtCorto(sabado)}`
  return http.post('/api/personal/semanas', { fecha_inicio: lunes, fecha_fin: sabado, descripcion })
}

export async function getSemanas() {
  return http.get('/api/personal/semanas')
}

// ── Empleados ─────────────────────────────────────────────────
export async function getEmpleados() {
  return http.get('/api/personal/empleados')
}

export async function createEmpleado(nombre, telefono) {
  return http.post('/api/personal/empleados', { nombre, telefono })
}

export async function updateEmpleado(id, nombre, telefono) {
  return http.put(`/api/personal/empleados/${id}`, { nombre, telefono })
}

export async function deleteEmpleado(id) {
  return http.del(`/api/personal/empleados/${id}`)
}

// ── Registros diarios ─────────────────────────────────────────
export async function getRegistrosSemana(semanaId) {
  const rows = await http.get(`/api/personal/registros/${semanaId}`)
  return rows.map(r => ({
    ...r,
    hora_entrada: normTime(r.hora_entrada),
    hora_salida:  normTime(r.hora_salida),
  }))
}

export async function upsertRegistro(empleadoId, semanaId, fecha, horaEntrada, horaSalida) {
  const data = await http.post('/api/personal/registros', {
    empleadoId, semanaId, fecha,
    nombreDia: getNombreDia(fecha),
    horaEntrada: horaEntrada || null,
    horaSalida:  horaSalida  || null,
  })
  return { ...data, hora_entrada: normTime(data.hora_entrada), hora_salida: normTime(data.hora_salida) }
}

// ── Resumen semanal ───────────────────────────────────────────
export async function getResumenesSemana(semanaId) {
  return http.get(`/api/personal/resumenes/${semanaId}`)
}

export async function upsertResumen(empleadoId, semanaId, resumen) {
  return http.post('/api/personal/resumenes', { empleadoId, semanaId, resumen })
}
