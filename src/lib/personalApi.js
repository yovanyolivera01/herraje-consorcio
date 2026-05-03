import { supabase } from './supabase'

// ── Horario base (constantes) ─────────────────────────────────
export const HORARIO_BASE = {
  SEMANA: { entrada: '09:30', salida: '19:30', minutosEsperados: 600 },
  SABADO: { entrada: '09:30', salida: '16:30', minutosEsperados: 420 },
}
export const MINUTOS_SEMANA_COMPLETA = 600 * 5 + 420 // 3420 min = 57 hrs

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

// Supabase devuelve TIME como "HH:MM:SS", normalizamos a "HH:MM"
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
  const dia = d.getDay() // 0=dom
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

// Devuelve las 6 fechas de la semana (Lun–Sáb) a partir del lunes
export function getDiasDeSemana(fechaLunes) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(fechaLunes + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return { fecha: localStr(d), nombreDia: NOMBRES_DIA[d.getDay()], numeroDia: d.getDate() }
  })
}

// ── Semanas (Supabase) ────────────────────────────────────────
export async function getOrCreateSemana(fechaRef) {
  const lunes  = getLunesDeSemana(fechaRef)
  const sabado = (() => { const d = new Date(lunes + 'T12:00:00'); d.setDate(d.getDate() + 5); return localStr(d) })()
  const desc   = `Semana del ${fmtCorto(lunes)} al ${fmtCorto(sabado)}`

  const { data: existente } = await supabase
    .from('semanas')
    .select('*')
    .eq('fecha_inicio', lunes)
    .maybeSingle()
  if (existente) return existente

  const { data, error } = await supabase
    .from('semanas')
    .insert({ fecha_inicio: lunes, fecha_fin: sabado, descripcion: desc })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getSemanas() {
  const { data, error } = await supabase
    .from('semanas')
    .select('*')
    .order('fecha_inicio', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ── Empleados (Supabase) ──────────────────────────────────────
export async function getEmpleados() {
  const { data, error } = await supabase
    .from('empleados')
    .select('*')
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return data ?? []
}

export async function createEmpleado(nombre, telefono) {
  const { data, error } = await supabase
    .from('empleados')
    .insert({ nombre: nombre.trim(), telefono: telefono.trim() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateEmpleado(id, nombre, telefono) {
  const { data, error } = await supabase
    .from('empleados')
    .update({ nombre: nombre.trim(), telefono: telefono.trim() })
    .eq('empleado_id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEmpleado(id) {
  const { error } = await supabase
    .from('empleados')
    .update({ activo: false })
    .eq('empleado_id', id)
  if (error) throw error
}

// ── Registros diarios (Supabase) ──────────────────────────────
export async function getRegistrosSemana(semanaId) {
  const { data, error } = await supabase
    .from('registros_diarios')
    .select('*')
    .eq('semana_id', semanaId)
  if (error) throw error
  return (data ?? []).map(r => ({
    ...r,
    hora_entrada: normTime(r.hora_entrada),
    hora_salida:  normTime(r.hora_salida),
  }))
}

export async function upsertRegistro(empleadoId, semanaId, fecha, horaEntrada, horaSalida) {
  const { data, error } = await supabase
    .from('registros_diarios')
    .upsert(
      {
        empleado_id:        empleadoId,
        semana_id:          semanaId,
        fecha,
        nombre_dia:         getNombreDia(fecha),
        hora_entrada:       horaEntrada || null,
        hora_salida:        horaSalida  || null,
        fecha_modificacion: new Date().toISOString(),
      },
      { onConflict: 'empleado_id,fecha' }
    )
    .select()
    .single()
  if (error) throw error
  return { ...data, hora_entrada: normTime(data.hora_entrada), hora_salida: normTime(data.hora_salida) }
}

// ── Resumen semanal (Supabase) ────────────────────────────────
export async function getResumenesSemana(semanaId) {
  const { data, error } = await supabase
    .from('resumen_semanal')
    .select('*')
    .eq('semana_id', semanaId)
  if (error) throw error
  return data ?? []
}

export async function upsertResumen(empleadoId, semanaId, resumen) {
  const { error } = await supabase
    .from('resumen_semanal')
    .upsert(
      { empleado_id: empleadoId, semana_id: semanaId, ...resumen, fecha_calculo: new Date().toISOString() },
      { onConflict: 'empleado_id,semana_id' }
    )
  if (error) throw error
}
