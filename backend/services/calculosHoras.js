// Cálculo de horas de empleados — lógica PURA (sin base de datos ni Express)
// para poder probarla y reusarla. Trabaja sobre un registro de asistencia
// (tabla `registro`, 4 marcas al día) y el turno del empleado.
//
//   hora_llegada        marca 1: entrada
//   hora_salida_comida  marca 2: sale a comer
//   hora_regreso_comida marca 3: regresa de comer
//   hora_salida         marca 4: salida
//
// Todas las horas llegan como texto 'HH:MM' o 'HH:MM:SS'; todo se calcula
// en MINUTOS enteros para evitar errores de redondeo con decimales.

// hora_inicio/hora_fin del turno incluyen la comida; turno.minutos_comida
// (migración 049) es lo que se descuenta para saber cuántos minutos hay que
// trabajar. 60 solo se usa si el turno no trae el campo.
const COMIDA_DEFAULT_MIN = 60
const comidaProgramada = (turno) => turno.minutos_comida ?? COMIDA_DEFAULT_MIN

// Fecha de hoy en Ciudad de México (YYYY-MM-DD) — el servidor corre en UTC.
function hoyMX() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

function aMinutos(hora) {
    if (!hora) return null
    const [h, m] = String(hora).split(':').map(Number)
    return h * 60 + m
}

function aHHMM(minutos) {
    if (minutos == null) return null
    const abs = Math.abs(minutos)
    return `${minutos < 0 ? '-' : ''}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

function dif(fin, inicio) {
    return fin == null || inicio == null ? null : fin - inicio
}

// Minutos que el turno exige trabajar en un día (span menos la comida).
function minutosProgramados(turno) {
    const span = dif(aMinutos(turno.hora_fin), aMinutos(turno.hora_inicio))
    return Math.max(0, span - comidaProgramada(turno))
}

// ISODOW: 1=Lunes ... 7=Domingo (igual que turno.dias_laborales)
function isoDow(fechaStr) {
    const d = new Date(`${fechaStr}T12:00:00Z`).getUTCDay()
    return d === 0 ? 7 : d
}

// Resultado de un día. `registro` puede ser null (no checó). `turno` es
// { hora_inicio, hora_fin, tolerancia, dias_laborales }.
function calcularDia(fecha, registro, turno, hoy = hoyMX()) {
    const laboral = (turno.dias_laborales ?? [1, 2, 3, 4, 5, 6]).includes(isoDow(fecha))
    const programados = minutosProgramados(turno)

    // Hoy y los días futuros sin registro aún no son falta: el empleado
    // todavía puede checar. No suman minutos esperados.
    const pendiente = !registro && fecha >= hoy

    const base = {
        fecha,
        dia_laboral: laboral,
        minutos_programados: laboral && !pendiente ? programados : 0,
    }

    if (!registro) {
        return {
            ...base,
            estado: !laboral ? 'descanso' : pendiente ? 'pendiente' : 'falta',
            minutos_trabajados: 0, minutos_comida: null, minutos_extra: 0,
            minutos_faltantes: laboral && !pendiente ? programados : 0,
            retardo_minutos: 0, es_retardo: false,
            salida_anticipada_min: 0, exceso_comida_min: 0,
        }
    }

    const llegada  = aMinutos(registro.hora_llegada)
    const salComer = aMinutos(registro.hora_salida_comida)
    const regComer = aMinutos(registro.hora_regreso_comida)
    const salida   = aMinutos(registro.hora_salida)

    // Registros anteriores a las 4 marcas solo tienen entrada/salida: no
    // hubo comida registrada, así que no se descuenta nada.
    const comida = dif(regComer, salComer)

    const completo = salida != null
    const trabajados = completo ? Math.max(0, dif(salida, llegada) - (comida ?? 0)) : null

    const retardo = Math.max(0, llegada - aMinutos(turno.hora_inicio))

    return {
        ...base,
        estado: completo ? 'completo'
              : salComer != null && regComer == null ? 'en_comida'
              : 'en_curso',
        minutos_trabajados: trabajados,
        minutos_comida: comida,
        // Extra y faltante solo tienen sentido con el día cerrado
        minutos_extra:     completo && laboral ? Math.max(0, trabajados - programados) : 0,
        minutos_faltantes: completo && laboral ? Math.max(0, programados - trabajados) : 0,
        retardo_minutos: retardo,
        es_retardo: retardo > (turno.tolerancia ?? 0),
        salida_anticipada_min: completo ? Math.max(0, aMinutos(turno.hora_fin) - salida) : 0,
        exceso_comida_min: comida != null ? Math.max(0, comida - comidaProgramada(turno)) : 0,
        marcas: {
            entrada: registro.hora_llegada ?? null,
            salida_comida: registro.hora_salida_comida ?? null,
            regreso_comida: registro.hora_regreso_comida ?? null,
            salida: registro.hora_salida ?? null,
        },
    }
}

// Fechas 'YYYY-MM-DD' de inicio a fin, ambos inclusive.
function fechasEnRango(inicio, fin) {
    const out = []
    const d = new Date(`${inicio}T12:00:00Z`)
    const last = new Date(`${fin}T12:00:00Z`)
    while (d <= last) {
        out.push(d.toISOString().slice(0, 10))
        d.setUTCDate(d.getUTCDate() + 1)
    }
    return out
}

// Días + totales de un rango. `registrosPorFecha`: { 'YYYY-MM-DD': registro }.
function calcularRango(inicio, fin, registrosPorFecha, turno) {
    const hoy = hoyMX()
    const dias = fechasEnRango(inicio, fin).map(f => calcularDia(f, registrosPorFecha[f] ?? null, turno, hoy))

    const sum = (campo) => dias.reduce((acc, d) => acc + (d[campo] ?? 0), 0)
    const laborales = dias.filter(d => d.dia_laboral)

    const totales = {
        dias_laborales: laborales.length,
        dias_completos: dias.filter(d => d.estado === 'completo').length,
        faltas: dias.filter(d => d.estado === 'falta').length,
        retardos: dias.filter(d => d.es_retardo).length,
        minutos_programados: sum('minutos_programados'),
        minutos_trabajados: sum('minutos_trabajados'),
        minutos_extra: sum('minutos_extra'),
        minutos_faltantes: sum('minutos_faltantes'),
        minutos_retardo: sum('retardo_minutos'),
        minutos_comida: sum('minutos_comida'),
        minutos_exceso_comida: sum('exceso_comida_min'),
        salidas_anticipadas: dias.filter(d => d.salida_anticipada_min > 0).length,
        minutos_salida_anticipada: sum('salida_anticipada_min'),
    }
    totales.minutos_diferencia = totales.minutos_trabajados - totales.minutos_programados

    // Bono de puntualidad: ningún retardo y todos los días laborales ya
    // transcurridos completos (con al menos un día laboral transcurrido).
    const transcurridos = laborales.filter(d => d.estado !== 'pendiente')
    const completos = transcurridos.filter(d => d.estado === 'completo').length
    if (transcurridos.length === 0) {
        totales.bono_puntualidad = false
        totales.motivo_bono = 'Sin días laborales transcurridos en el periodo.'
    } else if (completos < transcurridos.length) {
        totales.bono_puntualidad = false
        totales.motivo_bono = `Solo asistió ${completos} de ${transcurridos.length} días.`
    } else if (totales.retardos > 0) {
        totales.bono_puntualidad = false
        totales.motivo_bono = `${totales.retardos} retardo(s) en el periodo.`
    } else {
        totales.bono_puntualidad = true
        totales.motivo_bono = null
    }

    return { dias, totales }
}

module.exports = {
    COMIDA_DEFAULT_MIN,
    aMinutos, aHHMM, minutosProgramados, isoDow,
    calcularDia, calcularRango, fechasEnRango,
}
