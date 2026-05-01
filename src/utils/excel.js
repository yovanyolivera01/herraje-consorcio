import * as XLSX from 'xlsx'

/**
 * Genera y descarga un Excel de cotización con encabezado corporativo.
 * @param {object} detalle - mismos datos que printCotizacionCarta
 */
export function exportCotizacionExcel(detalle) {
  const wb = XLSX.utils.book_new()
  const ws = {}

  // ── helpers ──────────────────────────────────────────────────────────────
  const C = (r, c) => XLSX.utils.encode_cell({ r, c })

  const set = (r, c, v, s) => {
    ws[C(r, c)] = { v, t: typeof v === 'number' ? 'n' : 's', s }
  }

  const azulOsc = '1A3A6B'
  const blanco  = 'FFFFFF'
  const azulCla = 'E8EFF8'
  const gris    = 'F4F7FB'
  const negro   = '111111'

  const estHead = (sz = 11, bold = false, fg = negro, bg = null, center = false) => ({
    font: { name: 'Calibri', sz, bold, color: { rgb: fg } },
    fill: bg ? { patternType: 'solid', fgColor: { rgb: bg } } : undefined,
    alignment: { horizontal: center ? 'center' : 'left', vertical: 'center', wrapText: true },
    border: {},
  })

  const estBorde = (fg = negro, bg = null, bold = false, center = false, sz = 11) => ({
    font: { name: 'Calibri', sz, bold, color: { rgb: fg } },
    fill: bg ? { patternType: 'solid', fgColor: { rgb: bg } } : undefined,
    alignment: { horizontal: center ? 'center' : 'left', vertical: 'center' },
    border: {
      top:    { style: 'thin', color: { rgb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
      left:   { style: 'thin', color: { rgb: 'CCCCCC' } },
      right:  { style: 'thin', color: { rgb: 'CCCCCC' } },
    },
  })

  const merges = []
  const merge  = (rs, re, cs, ce) => merges.push({ s: { r: rs, c: cs }, e: { r: re, c: ce } })

  // ── 5 columnas: A(0) B(1) C(2) D(3) E(4) ─────────────────────────────────
  const COLS = 5

  let row = 0

  // ── Fila 0: TEMPLADOS ──────────────────────────────────────────────────────
  merge(row, row, 0, COLS - 1)
  set(row, 0, 'TEMPLADOS CONSORCIO', {
    font: { name: 'Calibri', sz: 28, bold: true, color: { rgb: blanco } },
    fill: { patternType: 'solid', fgColor: { rgb: azulOsc } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {},
  })
  for (let c = 1; c < COLS; c++) set(row, c, '', { fill: { patternType: 'solid', fgColor: { rgb: azulOsc } }, border: {} })
  row++

  // ── Fila 1: CONSORCIO ──────────────────────────────────────────────────────
  merge(row, row, 0, COLS - 1)
  set(row, 0, 'C  O  N  S  O  R  C  I  O', {
    font: { name: 'Calibri', sz: 14, bold: false, color: { rgb: 'A8C4E8' } },
    fill: { patternType: 'solid', fgColor: { rgb: azulOsc } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {},
  })
  for (let c = 1; c < COLS; c++) set(row, c, '', { fill: { patternType: 'solid', fgColor: { rgb: azulOsc } }, border: {} })
  row++

  // ── Fila 2: slogan ─────────────────────────────────────────────────────────
  merge(row, row, 0, COLS - 1)
  set(row, 0, 'Arte en Vidrio', {
    font: { name: 'Calibri', sz: 12, italic: true, color: { rgb: 'C8DCF4' } },
    fill: { patternType: 'solid', fgColor: { rgb: azulOsc } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {},
  })
  for (let c = 1; c < COLS; c++) set(row, c, '', { fill: { patternType: 'solid', fgColor: { rgb: azulOsc } }, border: {} })
  row++

  // ── Fila 3: separador ─────────────────────────────────────────────────────
  merge(row, row, 0, COLS - 1)
  set(row, 0, 'MARCAS QUE DISTRIBUIMOS', {
    font: { name: 'Calibri', sz: 9, bold: false, color: { rgb: '888888' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F0F0F0' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {},
  })
  for (let c = 1; c < COLS; c++) set(row, c, '', { fill: { patternType: 'solid', fgColor: { rgb: 'F0F0F0' } }, border: {} })
  row++

  // ── Fila 4: marcas (3 grupos fusionados) ──────────────────────────────────
  // axlent: cols 0-1, DAWH: col 2, Brüken: cols 3-4
  merge(row, row + 1, 0, 1)
  set(row, 0, 'axlent', {
    font: { name: 'Calibri', sz: 14, bold: true, italic: true, color: { rgb: '1A3A6B' } },
    fill: { patternType: 'solid', fgColor: { rgb: blanco } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { right: { style: 'thin', color: { rgb: 'DDDDDD' } } },
  })
  set(row + 1, 0, 'i  t  a  l  y', {
    font: { name: 'Calibri', sz: 9, color: { rgb: '888888' } },
    fill: { patternType: 'solid', fgColor: { rgb: blanco } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { right: { style: 'thin', color: { rgb: 'DDDDDD' } } },
  })
  for (let r2 = row; r2 <= row + 1; r2++) set(r2, 1, '', { fill: { patternType: 'solid', fgColor: { rgb: blanco } }, border: {} })

  merge(row, row + 1, 2, 2)
  set(row, 2, 'DAWH', {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: negro } },
    fill: { patternType: 'solid', fgColor: { rgb: blanco } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { left: { style: 'thin', color: { rgb: 'DDDDDD' } }, right: { style: 'thin', color: { rgb: 'DDDDDD' } } },
  })
  set(row + 1, 2, 'Door & Window Hardware', {
    font: { name: 'Calibri', sz: 9, color: { rgb: '888888' } },
    fill: { patternType: 'solid', fgColor: { rgb: blanco } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { left: { style: 'thin', color: { rgb: 'DDDDDD' } }, right: { style: 'thin', color: { rgb: 'DDDDDD' } } },
  })

  merge(row, row + 1, 3, 4)
  set(row, 3, 'Brüken', {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: blanco } },
    fill: { patternType: 'solid', fgColor: { rgb: azulOsc } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {},
  })
  set(row + 1, 3, 'ASSA ABLOY', {
    font: { name: 'Calibri', sz: 9, color: { rgb: 'A8C4E8' } },
    fill: { patternType: 'solid', fgColor: { rgb: azulOsc } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {},
  })
  for (let r2 = row; r2 <= row + 1; r2++) set(r2, 4, '', { fill: { patternType: 'solid', fgColor: { rgb: azulOsc } }, border: {} })
  row += 2

  // ── Fila 6: espacio ────────────────────────────────────────────────────────
  row++

  // ── Fila 7: título del documento ───────────────────────────────────────────
  const esTitulo = detalle.tipo === 'pedido' ? 'PEDIDO DE VIDRIO' : 'COTIZACIÓN DE VIDRIO'
  merge(row, row, 0, 2)
  set(row, 0, esTitulo, {
    font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: azulOsc } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {},
  })
  set(row, 3, 'Folio:', estHead(11, true, negro))
  set(row, 4, detalle.folio, estHead(11, true, azulOsc))
  row++

  set(row, 3, 'Fecha:', estHead(11, false, negro))
  set(row, 4, detalle.fecha, estHead(11, false, negro))
  row++

  if (detalle.hora) {
    set(row, 3, 'Hora:', estHead(11, false, negro))
    set(row, 4, detalle.hora, estHead(11, false, negro))
    row++
  }

  // ── Destinatario: empresa (si existe) o cliente ───────────────────────────
  row++
  const emp = detalle.empresa

  if (emp) {
    // Nombre de la empresa como encabezado
    merge(row, row, 0, COLS - 1)
    set(row, 0, emp.nombre, {
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: blanco } },
      fill: { patternType: 'solid', fgColor: { rgb: '2D5FA8' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: {},
    })
    for (let c = 1; c < COLS; c++) set(row, c, '', { fill: { patternType: 'solid', fgColor: { rgb: '2D5FA8' } }, border: {} })
    row++

    const campos = [
      emp.razon_social ? `Razón social: ${emp.razon_social}` : '',
      emp.rfc          ? `RFC: ${emp.rfc}` : '',
      emp.telefono     ? `Tel: ${emp.telefono}` : '',
      emp.correo       ? `Correo: ${emp.correo}` : '',
      emp.direccion    ? `Dirección: ${emp.direccion}` : '',
    ].filter(Boolean)

    campos.forEach(linea => {
      merge(row, row, 0, COLS - 1)
      set(row, 0, linea, {
        font: { name: 'Calibri', sz: 11, color: { rgb: '222222' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'EAF0FA' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: { left: { style: 'medium', color: { rgb: '2D5FA8' } } },
      })
      for (let c = 1; c < COLS; c++) set(row, c, '', { fill: { patternType: 'solid', fgColor: { rgb: 'EAF0FA' } }, border: {} })
      row++
    })
  } else {
    // Sin empresa: mostrar nombre del cliente
    merge(row, row, 0, COLS - 1)
    set(row, 0, detalle.clienteNombre ?? 'Mostrador', {
      font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: azulOsc } },
      fill: { patternType: 'solid', fgColor: { rgb: azulCla } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: { left: { style: 'medium', color: { rgb: azulOsc } } },
    })
    for (let c = 1; c < COLS; c++) set(row, c, '', { fill: { patternType: 'solid', fgColor: { rgb: azulCla } }, border: {} })
    row++

    if (detalle.clienteTel || detalle.nivelNombre) {
      const line = [detalle.clienteTel ? `Tel: ${detalle.clienteTel}` : '', detalle.nivelNombre ? `Nivel: ${detalle.nivelNombre}` : ''].filter(Boolean).join('   ·   ')
      merge(row, row, 0, COLS - 1)
      set(row, 0, line, {
        font: { name: 'Calibri', sz: 11, color: { rgb: '555555' } },
        fill: { patternType: 'solid', fgColor: { rgb: azulCla } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: { left: { style: 'medium', color: { rgb: azulOsc } } },
      })
      for (let c = 1; c < COLS; c++) set(row, c, '', { fill: { patternType: 'solid', fgColor: { rgb: azulCla } }, border: {} })
      row++
    }
  }

  // ── Espacio ────────────────────────────────────────────────────────────────
  row++

  // ── Encabezado tabla ───────────────────────────────────────────────────────
  const headers = ['#', 'Tipo de vidrio', 'Descripción', 'm²', 'Subtotal']
  headers.forEach((h, c) => {
    set(row, c, h, {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: blanco } },
      fill: { patternType: 'solid', fgColor: { rgb: azulOsc } },
      alignment: { horizontal: c === COLS - 1 ? 'right' : 'center', vertical: 'center' },
      border: { bottom: { style: 'medium', color: { rgb: blanco } } },
    })
  })
  row++

  // ── Filas de datos ─────────────────────────────────────────────────────────
  detalle.partidas.forEach((p, idx) => {
    const pzas  = p.piezas ?? 1
    const m2    = (pzas * p.largo_cm * p.ancho_cm / 10000)
    const bgRow = idx % 2 === 0 ? 'FFFFFF' : gris

    set(row, 0, idx + 1,   estBorde(negro, bgRow, false, true))
    set(row, 1, p.clave,   estBorde(azulOsc, bgRow, true, false))
    set(row, 2, `${pzas} pza${pzas > 1 ? 's' : ''} · ${p.largo_cm}×${p.ancho_cm} cm`, estBorde(negro, bgRow))
    ws[C(row, 3)] = { v: m2, t: 'n', z: '0.0000', s: estBorde(negro, bgRow, false, true) }
    ws[C(row, 4)] = { v: p.subtotal_partida, t: 'n', z: '"$"#,##0.00', s: estBorde(negro, bgRow, true, true) }
    row++

    // procesos
    ;(p.procesos ?? []).forEach(pr => {
      merge(row, row, 1, 3)
      set(row, 0, '', estBorde(negro, bgRow))
      set(row, 1, `   + ${pr.nombre}`, {
        font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '555555' } },
        fill: { patternType: 'solid', fgColor: { rgb: bgRow } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: { top: { style: 'thin', color: { rgb: 'DDDDDD' } }, bottom: { style: 'thin', color: { rgb: 'DDDDDD' } } },
      })
      for (let c = 2; c <= 3; c++) set(row, c, '', { fill: { patternType: 'solid', fgColor: { rgb: bgRow } }, border: {} })
      ws[C(row, 4)] = { v: pr.subtotal, t: 'n', z: '"$"#,##0.00', s: estBorde('555555', bgRow, false, true, 10) }
      row++
    })
  })

  // ── Total ──────────────────────────────────────────────────────────────────
  row++
  merge(row, row, 0, 3)
  set(row, 0, 'TOTAL', {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: blanco } },
    fill: { patternType: 'solid', fgColor: { rgb: azulOsc } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: {},
  })
  for (let c = 1; c <= 3; c++) set(row, c, '', { fill: { patternType: 'solid', fgColor: { rgb: azulOsc } }, border: {} })
  ws[C(row, 4)] = {
    v: detalle.total, t: 'n', z: '"$"#,##0.00',
    s: {
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: blanco } },
      fill: { patternType: 'solid', fgColor: { rgb: azulOsc } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: {},
    },
  }
  row++

  // ── Pie ────────────────────────────────────────────────────────────────────
  row++
  merge(row, row, 0, COLS - 1)
  const pieTexto = detalle.tipo === 'pedido' ? '¡Gracias por su compra!' : 'Cotización con vigencia de 15 días a partir de la fecha de emisión.'
  set(row, 0, pieTexto, {
    font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '777777' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { top: { style: 'thin', color: { rgb: 'CCCCCC' } } },
  })
  for (let c = 1; c < COLS; c++) set(row, c, '', { border: { top: { style: 'thin', color: { rgb: 'CCCCCC' } } } })
  row++
  merge(row, row, 0, COLS - 1)
  set(row, 0, 'Templados Consorcio · Arte en Vidrio', {
    font: { name: 'Calibri', sz: 10, color: { rgb: '999999' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {},
  })

  // ── Rango y merges ─────────────────────────────────────────────────────────
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: COLS - 1 } })
  ws['!merges'] = merges
  ws['!cols'] = [
    { wch: 5 },   // #
    { wch: 16 },  // Tipo
    { wch: 28 },  // Descripción
    { wch: 10 },  // m²
    { wch: 14 },  // Subtotal
  ]
  ws['!rows'] = [
    { hpt: 42 }, // TEMPLADOS
    { hpt: 22 }, // consorcio
    { hpt: 20 }, // slogan
    { hpt: 16 }, // marcas label
    { hpt: 28 }, // marca nombre
    { hpt: 18 }, // marca sub
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Cotizacion')
  const nombreArchivo = `Cotizacion_${detalle.folio ?? 'vidrio'}_${detalle.fecha?.replace(/\//g, '-') ?? ''}.xlsx`
  XLSX.writeFile(wb, nombreArchivo, { cellStyles: true })
}
