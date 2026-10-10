// Helpers de fechas de semana (lunes a domingo) para las pantallas de
// Personal. Solo manejan fechas 'YYYY-MM-DD'; los cálculos de horas viven en
// el backend (services/calculosHoras.js, consultados con lib/calculosApi.js).

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sumarDias(fechaStr, n) {
  const d = new Date(fechaStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return localStr(d)
}

export const hoyLocal = () => localStr(new Date())

export function getLunesDeSemana(fechaStr) {
  const d   = new Date(fechaStr + 'T12:00:00')
  const dia = d.getDay()
  d.setDate(d.getDate() + (dia === 0 ? -6 : 1 - dia))
  return localStr(d)
}

export const getLunesAnterior  = (lunes) => sumarDias(lunes, -7)
export const getLunesSiguiente = (lunes) => sumarDias(lunes, 7)
export const getDomingoDeSemana = (lunes) => sumarDias(lunes, 6)

const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const NOMBRES_DIA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function fmtCorto(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00')
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`
}

export const descripcionSemana = (lunes) =>
  `Semana del ${fmtCorto(lunes)} al ${fmtCorto(getDomingoDeSemana(lunes))}`

export const getNombreDia = (fechaStr) => NOMBRES_DIA[new Date(fechaStr + 'T12:00:00').getDay()]
export const getNumeroDia = (fechaStr) => new Date(fechaStr + 'T12:00:00').getDate()
