import jsPDF from 'jspdf'
import logoVR from '../assets/images/logoVR.jpeg'
import { getHorasEmpleado, getCalculoNomina, minToHHMM, horaCorta } from '../lib/calculosApi'
import { getDomingoDeSemana, descripcionSemana, getNombreDia } from '../lib/semana'

// Reporte de horas de empleados en PDF (A4 horizontal): logotipo de la
// empresa, título "Reporte de horas" y la semana, y por cada empleado una
// tabla con sus 4 marcas por día y los cálculos del backend
// (/api/calculos/horas/empleado/:id), más una fila de totales y el bono.

const MARGEN = 10
const ESTADO_TEXTO = {
  completo: 'Completo', en_curso: 'En curso', en_comida: 'En comida',
  falta: 'Falta', pendiente: 'Pendiente', descanso: 'Descanso',
}

const AZUL  = [26, 58, 107]
const GRIS  = [100, 100, 100]
const ROJO  = [185, 28, 28]
const AMBAR = [180, 83, 9]

// key: función que da el texto de la celda; color: color opcional según el día.
const COLUMNAS = [
  { titulo: 'Día',              ancho: 32, align: 'left',  valor: d => `${getNombreDia(d.fecha).slice(0, 3)} ${d.fecha.slice(8)}/${d.fecha.slice(5, 7)}` },
  { titulo: 'Entrada',          ancho: 18, valor: d => horaCorta2(d.marcas?.entrada) },
  { titulo: 'Salida a comer',   ancho: 20, valor: d => horaCorta2(d.marcas?.salida_comida) },
  { titulo: 'Regreso',          ancho: 18, valor: d => horaCorta2(d.marcas?.regreso_comida) },
  { titulo: 'Salida',           ancho: 18, valor: d => horaCorta2(d.marcas?.salida) },
  { titulo: 'Estado',           ancho: 22, valor: d => ESTADO_TEXTO[d.estado] ?? d.estado, color: d => d.estado === 'falta' ? ROJO : null },
  { titulo: 'Programadas',      ancho: 20, valor: d => hhmm(d.minutos_programados) },
  { titulo: 'Trabajadas',       ancho: 20, valor: d => d.estado === 'completo' ? minToHHMM(d.minutos_trabajados) : '-' },
  { titulo: 'Comida',           ancho: 16, valor: d => hhmm(d.minutos_comida) },
  { titulo: 'Extra',            ancho: 16, valor: d => hhmm(d.minutos_extra), color: d => d.minutos_extra > 0 ? AMBAR : null },
  { titulo: 'Faltantes',        ancho: 18, valor: d => hhmm(d.minutos_faltantes), color: d => d.minutos_faltantes > 0 ? ROJO : null },
  { titulo: 'Retardo',          ancho: 16, valor: d => d.es_retardo ? `${d.retardo_minutos} min` : '-', color: d => d.es_retardo ? ROJO : null },
  { titulo: 'Salida anticipada', ancho: 18, valor: d => hhmm(d.salida_anticipada_min), color: d => d.salida_anticipada_min > 0 ? ROJO : null },
  { titulo: 'Exceso comida',    ancho: 18, valor: d => hhmm(d.exceso_comida_min), color: d => d.exceso_comida_min > 0 ? AMBAR : null },
]

function horaCorta2(t) {
  const h = horaCorta(t)
  return h === '—' ? '-' : h
}

const hhmm = (min) => (min ? minToHHMM(min) : '-')
const suma = (dias, campo) => dias.reduce((acc, d) => acc + (d[campo] ?? 0), 0)

async function cargarLogo() {
  const blob = await (await fetch(logoVR)).blob()
  const dataUrl = await new Promise(resolve => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.readAsDataURL(blob)
  })
  const { w, h } = await new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve({ w: img.width, h: img.height })
    img.src = dataUrl
  })
  return { dataUrl, ratio: w / h }
}

// Encabezado de cada hoja: logotipo + "Reporte de horas" + semana.
function dibujarEncabezado(doc, logo, semanaTxt) {
  const ancho = doc.internal.pageSize.getWidth()
  const altoLogo = 16

  doc.addImage(logo.dataUrl, 'JPEG', MARGEN, MARGEN, altoLogo * logo.ratio, altoLogo)

  doc.setTextColor(...AZUL)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Reporte de horas', MARGEN + altoLogo * logo.ratio + 8, MARGEN + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...GRIS)
  doc.text(semanaTxt, MARGEN + altoLogo * logo.ratio + 8, MARGEN + 14)

  doc.setFontSize(9)
  doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, ancho - MARGEN, MARGEN + 8, { align: 'right' })

  doc.setDrawColor(...AZUL)
  doc.setLineWidth(0.6)
  doc.line(MARGEN, MARGEN + altoLogo + 3, ancho - MARGEN, MARGEN + altoLogo + 3)

  return MARGEN + altoLogo + 8 // y donde puede empezar el contenido
}

const ALTO_FILA = 6.2

function fila(doc, y, celdas, { negrita = false, fondo = null } = {}) {
  let x = MARGEN
  const total = COLUMNAS.reduce((a, c) => a + c.ancho, 0)
  if (fondo) {
    doc.setFillColor(...fondo)
    doc.rect(MARGEN, y, total, ALTO_FILA, 'F')
  }
  doc.setFont('helvetica', negrita ? 'bold' : 'normal')
  doc.setFontSize(8)
  COLUMNAS.forEach((col, i) => {
    const { texto, color } = celdas[i]
    doc.setTextColor(...(color ?? [30, 30, 30]))
    const alinear = col.align === 'left' ? 'left' : 'center'
    const tx = alinear === 'left' ? x + 1.5 : x + col.ancho / 2
    doc.text(String(texto), tx, y + ALTO_FILA - 1.9, { align: alinear })
    x += col.ancho
  })
  doc.setDrawColor(225, 225, 225)
  doc.setLineWidth(0.2)
  doc.line(MARGEN, y + ALTO_FILA, MARGEN + total, y + ALTO_FILA)
}

// Alto que ocupa el bloque de un empleado (nombre + cabecera + días + total + bono + firma)
const ALTO_FIRMA = 17
const ALTO_PAGO = 13
const altoBloque = (nDias, conPago) => 8 + ALTO_FILA * (nDias + 2) + 7 + (conPago ? ALTO_PAGO : 0) + ALTO_FIRMA + 6

const dinero = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function dibujarEmpleado(doc, y, empleado, dias, totales, pago) {
  const total = COLUMNAS.reduce((a, c) => a + c.ancho, 0)

  // Barra con nombre y turno
  doc.setFillColor(...AZUL)
  doc.rect(MARGEN, y, total, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const nombre = [empleado.nombre, empleado.apellido_paterno, empleado.apellido_materno].filter(Boolean).join(' ')
  doc.text(nombre, MARGEN + 2, y + 4.9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(
    `Turno ${horaCorta(empleado.hora_inicio)} - ${horaCorta(empleado.hora_fin)}  |  Comida ${empleado.minutos_comida ?? 60} min  |  Tolerancia ${empleado.tolerancia ?? 0} min`,
    MARGEN + total - 2, y + 4.8, { align: 'right' }
  )
  y += 8

  // Cabecera de columnas
  fila(doc, y, COLUMNAS.map(c => ({ texto: c.titulo })), { negrita: true, fondo: [234, 240, 250] })
  y += ALTO_FILA

  // Días
  dias.forEach((d, idx) => {
    fila(doc, y, COLUMNAS.map(c => ({ texto: c.valor(d), color: c.color?.(d) })), {
      fondo: idx % 2 ? [250, 250, 250] : null,
    })
    y += ALTO_FILA
  })

  // Totales
  const retardos = dias.filter(d => d.es_retardo)
  const totalesCeldas = COLUMNAS.map(() => ({ texto: '' }))
  totalesCeldas[0] = { texto: 'TOTAL' }
  totalesCeldas[1] = { texto: `${totales.dias_completos}/${totales.dias_laborales} dias` }
  totalesCeldas[6] = { texto: hhmm(totales.minutos_programados) }
  totalesCeldas[7] = { texto: minToHHMM(totales.minutos_trabajados) }
  totalesCeldas[8] = { texto: hhmm(suma(dias, 'minutos_comida')) }
  totalesCeldas[9] = { texto: hhmm(totales.minutos_extra) }
  totalesCeldas[10] = { texto: hhmm(totales.minutos_faltantes) }
  totalesCeldas[11] = { texto: retardos.length ? `${retardos.length} (${totales.minutos_retardo} min)` : '-' }
  totalesCeldas[12] = { texto: hhmm(totales.minutos_salida_anticipada) }
  totalesCeldas[13] = { texto: hhmm(totales.minutos_exceso_comida) }
  fila(doc, y, totalesCeldas, { negrita: true, fondo: [234, 240, 250] })
  y += ALTO_FILA + 1

  // Diferencia y bono
  const dif = totales.minutos_diferencia
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...(dif >= 0 ? [21, 128, 61] : ROJO))
  doc.text(`Diferencia: ${dif >= 0 ? '+' : ''}${minToHHMM(dif)}`, MARGEN + 1.5, y + 3.5)
  doc.setTextColor(...(totales.bono_puntualidad ? [21, 128, 61] : ROJO))
  doc.text(
    `Bono de puntualidad: ${totales.bono_puntualidad ? 'APLICA' : `NO APLICA${totales.motivo_bono ? ` - ${totales.motivo_bono}` : ''}`}`,
    MARGEN + 60, y + 3.5
  )

  // Pago: sueldo del periodo (según los días del turno), extra, deducciones y total
  y += 6
  if (pago) {
    const r = pago.resumen
    doc.setFillColor(240, 247, 240)
    doc.rect(MARGEN, y, total, ALTO_PAGO - 4, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(30, 30, 30)
    doc.text(
      `Valor por dia ${dinero(r.valor_dia)} x ${r.dias_pagados} dias = ${dinero(pago.sueldo_base)}   |   `
      + `Extra: ${pago.horas_extra} h x ${dinero(pago.tarifa_hora_extra)} = ${dinero(pago.monto_extra)}   |   `
      + `Deducciones: ${r.faltas} falta(s) + ${minToHHMM(r.minutos_faltantes)} h faltantes = -${dinero(pago.deducciones)}`,
      MARGEN + 2, y + 3.8
    )
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...AZUL)
    doc.text(`TOTAL A PAGAR: ${dinero(pago.total_pagar)}`, MARGEN + total - 2, y + 7.6, { align: 'right' })
    y += ALTO_PAGO - 4
  }

  // Línea de firma con el nombre del empleado debajo
  y += pago ? 10 : 4
  const anchoLinea = 80
  doc.setDrawColor(60, 60, 60)
  doc.setLineWidth(0.3)
  doc.line(MARGEN + 1.5, y, MARGEN + 1.5 + anchoLinea, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(30, 30, 30)
  doc.text(nombre, MARGEN + 1.5 + anchoLinea / 2, y + 4, { align: 'center' })

  return y + 4 + 6
}

// Genera y descarga el PDF. `empleados`: los de la pantalla; `resumenes`:
// { empleado_id: totales } ya cargados (los que no están no tienen turno).
export async function descargarReporteHorasPDF(lunes, empleados, resumenes) {
  const domingo = getDomingoDeSemana(lunes)
  const semanaTxt = descripcionSemana(lunes)

  const [logo, detalles, nomina] = await Promise.all([
    cargarLogo(),
    Promise.all(
      empleados
        .filter(e => resumenes[e.empleado_id])
        .map(e => getHorasEmpleado(e.empleado_id, lunes, domingo))
    ),
    getCalculoNomina(lunes, domingo),
  ])
  const pagoDe = Object.fromEntries(nomina.empleados.filter(p => p.resumen).map(p => [p.empleado_id, p]))

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const alto = doc.internal.pageSize.getHeight()

  let y = dibujarEncabezado(doc, logo, semanaTxt)

  if (detalles.length === 0) {
    doc.setTextColor(...GRIS)
    doc.setFontSize(11)
    doc.text('No hay empleados con turno asignado en este periodo.', MARGEN, y + 6)
  }

  for (const { empleado, dias, totales } of detalles) {
    const pago = pagoDe[empleado.empleado_id]
    if (y + altoBloque(dias.length, !!pago) > alto - MARGEN - 6) {
      doc.addPage()
      y = dibujarEncabezado(doc, logo, semanaTxt)
    }
    y = dibujarEmpleado(doc, y, empleado, dias, totales, pago)
  }

  // Total general de la nómina de todos los empleados
  if (detalles.length > 0) {
    if (y + 14 > alto - MARGEN - 6) {
      doc.addPage()
      y = dibujarEncabezado(doc, logo, semanaTxt)
    }
    const ancho = COLUMNAS.reduce((a, c) => a + c.ancho, 0)
    doc.setFillColor(...AZUL)
    doc.rect(MARGEN, y, ancho, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('TOTAL GENERAL A PAGAR', MARGEN + 3, y + 6.8)
    doc.text(dinero(nomina.total_pagar), MARGEN + ancho - 3, y + 6.8, { align: 'right' })
  }

  // Pie con numeración
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRIS)
    doc.text(`Pagina ${i} de ${paginas}`, doc.internal.pageSize.getWidth() / 2, alto - 5, { align: 'center' })
  }

  doc.save(`reporte-horas-${lunes}.pdf`)
}
