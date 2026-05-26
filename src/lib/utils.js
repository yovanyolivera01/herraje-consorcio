// Redondea al siguiente múltiplo de 5 (siempre hacia arriba)
// 101-104 → 105 · 106-109 → 110 · 2459.98 → 2460 · 15683.98 → 15685
export function r5(precio) {
  return Math.ceil(precio / 5) * 5
}

export function fmt5(precio) {
  return r5(precio).toFixed(2)
}

// ── Helpers de fecha en zona horaria de México ────────────────────────────

const TZ_MX = 'America/Mexico_City'

// Fecha de hoy en YYYY-MM-DD según hora de México (no UTC)
export function hoyMX() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_MX }).format(new Date())
}

// Lunes de la semana actual en YYYY-MM-DD según hora de México
export function lunesMX() {
  const now = new Date()
  const dia = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(
    new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TZ_MX }).format(now)
  )
  const diff = dia === 0 ? -6 : 1 - dia
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_MX })
    .format(new Date(now.getTime() + diff * 864e5))
}

// ISO con offset MX para inicio (end=false) o fin (end=true) de un día.
// Detecta automáticamente CST (-06:00) o CDT (-05:00) para el día indicado.
export function mxDayBound(dateStr, end = false) {
  const probe = new Date(`${dateStr}T18:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_MX, timeZoneName: 'shortOffset',
  }).formatToParts(probe)
  const tzStr = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT-6'
  const m = tzStr.match(/GMT([+-])(\d+):?(\d*)/)
  const offset = m
    ? `${m[1]}${String(m[2]).padStart(2,'0')}:${String(m[3]||'0').padStart(2,'0')}`
    : '-06:00'
  return `${dateStr}T${end ? '23:59:59.999' : '00:00:00.000'}${offset}`
}
