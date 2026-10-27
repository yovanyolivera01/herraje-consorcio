// Cálculo de la nómina de UN empleado en un periodo. Lógica pura: recibe los
// días ya calculados (services/calculosHoras.js), el turno y las tarifas del
// puesto. Todo se calcula DÍA POR DÍA según el turno del empleado.
//
//   puestos.salario     = sueldo de la semana laboral completa del turno
//                         (ej. 1000 por lun-vie => dias_laborales = 5)
//   valor_dia           = salario / cantidad de dias_laborales del turno
//   valor_minuto        = valor_dia / minutos programados del día
//
//   sueldo_base : valor_dia x días laborales ya transcurridos del periodo
//                 (descansos y días pendientes aún no se pagan)
//   deducciones : faltas x valor_dia
//                 + minutos faltantes de los días trabajados x valor_minuto
//   horas_extra : minutos extra de los días completos / 60
//   monto_extra : horas_extra x puestos.hora_extra (pago por hora extra)
//   total_pagar : sueldo_base + monto_extra - deducciones (lo calcula el SP)

const redondear = (n) => Math.round(n * 100) / 100

function calcularNomina(dias, turno, { salario, hora_extra }) {
    const salarioSemana = Number(salario) || 0
    const tarifaExtra = Number(hora_extra) || 0
    const diasPorSemana = (turno.dias_laborales ?? [1, 2, 3, 4, 5, 6]).length
    const valorDia = diasPorSemana > 0 ? salarioSemana / diasPorSemana : 0

    let diasPagados = 0
    let faltas = 0
    let minutosFaltantes = 0
    let minutosExtra = 0
    let incompletos = 0
    let deducciones = 0

    const detalle = dias.map(d => {
        // Solo cuentan los días laborales que ya pasaron
        if (!d.dia_laboral || d.estado === 'pendiente') {
            return { fecha: d.fecha, estado: d.estado, sueldo_dia: 0, deduccion_dia: 0, horas_extra: 0 }
        }

        diasPagados++
        const valorMinuto = d.minutos_programados > 0 ? valorDia / d.minutos_programados : 0
        let deduccion = 0

        if (d.estado === 'falta') {
            faltas++
            deduccion = valorDia
        } else {
            // 'completo' trae faltantes/extra; un día sin hora de salida
            // ('en_curso' / 'en_comida' de un día pasado) no se puede medir
            if (d.estado !== 'completo') incompletos++
            minutosFaltantes += d.minutos_faltantes
            minutosExtra += d.minutos_extra
            deduccion = d.minutos_faltantes * valorMinuto
        }

        deducciones += deduccion
        return {
            fecha: d.fecha,
            estado: d.estado,
            sueldo_dia: redondear(valorDia),
            deduccion_dia: redondear(deduccion),
            horas_extra: redondear(d.minutos_extra / 60),
        }
    })

    const sueldoBase = valorDia * diasPagados

    return {
        sueldo_base: redondear(sueldoBase),
        horas_extra: redondear(minutosExtra / 60),
        monto_extra: redondear((minutosExtra / 60) * tarifaExtra),
        deducciones: redondear(Math.min(deducciones, sueldoBase)),
        resumen: {
            valor_dia: redondear(valorDia),
            dias_pagados: diasPagados,
            faltas,
            minutos_faltantes: minutosFaltantes,
            dias_sin_salida: incompletos,
        },
        detalle,
    }
}

module.exports = { calcularNomina }
