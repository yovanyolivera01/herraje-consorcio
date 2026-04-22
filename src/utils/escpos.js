/**
 * ESC/POS command builder para impresoras térmicas.
 * Compatible con impresoras Epson TM, BIXOLON, RONGTA, POS-58, etc.
 */

const ESC = 0x1B
const GS  = 0x1D

const Cmd = {
  INIT:        [ESC, 0x40],           // Inicializar impresora
  ALIGN_L:     [ESC, 0x61, 0x00],     // Alinear izquierda
  ALIGN_C:     [ESC, 0x61, 0x01],     // Centrar
  ALIGN_R:     [ESC, 0x61, 0x02],     // Alinear derecha
  BOLD_ON:     [ESC, 0x45, 0x01],     // Negrita activada
  BOLD_OFF:    [ESC, 0x45, 0x00],     // Negrita desactivada
  HEIGHT_2X:   [GS,  0x21, 0x11],     // Doble altura y ancho
  HEIGHT_1X:   [GS,  0x21, 0x00],     // Altura normal
  CODEPAGE:    [ESC, 0x74, 0x00],     // CP437 multilingual
  LF:          [0x0A],
  CUT:         [GS,  0x56, 0x42, 0x00], // Corte parcial con avance
}

/** Codifica un string a bytes Latin-1 mapeando caracteres españoles */
function encode(str) {
  const map = {
    'á':0xE1,'é':0xE9,'í':0xED,'ó':0xF3,'ú':0xFA,
    'Á':0xC1,'É':0xC9,'Í':0xCD,'Ó':0xD3,'Ú':0xDA,
    'ñ':0xF1,'Ñ':0xD1,'ü':0xFC,'Ü':0xDC,
    '¡':0xA1,'¿':0xBF,'€':0xD5,
  }
  const out = []
  for (const ch of str) {
    const code = ch.charCodeAt(0)
    if (map[ch] !== undefined) out.push(map[ch])
    else if (code < 128) out.push(code)
    else out.push(0x3F) // '?' para caracteres no soportados
  }
  return out
}

/** Acumula bytes de arrays, números o strings */
function push(buf, ...parts) {
  for (const p of parts) {
    if (Array.isArray(p)) buf.push(...p)
    else if (typeof p === 'string') buf.push(...encode(p))
    else buf.push(p)
  }
}

/** Texto izquierda + texto derecha separados por espacios hasta `width` cols */
function rowLR(left, right, width) {
  const spaces = Math.max(1, width - left.length - right.length)
  return left + ' '.repeat(spaces) + right
}

/**
 * Construye los bytes ESC/POS para ticket de vidrio (cotización o pedido).
 * @param {object} detalle - folio, fecha, hora, clienteNombre, nivelNombre,
 *   tipo ('cotizacion'|'pedido'), formaPago, anticipo, saldo, saldo_cobrado,
 *   esEntregado, partidas[{piezas, clave, largo_cm, ancho_cm, subtotal_vidrio,
 *   procesos[{nombre, subtotal}], subtotal_partida}], total
 * @param {number} cols - 42 para 80mm, 32 para 58mm
 * @returns {Uint8Array}
 */
export function buildTicketVidrio(detalle, cols = 42) {
  const buf = []
  const p = (...parts) => push(buf, ...parts)
  const amtW = 9 // "$9999.99"

  // ── Encabezado ────────────────────────────────────────────────────────────
  p(Cmd.INIT)
  p(Cmd.ALIGN_C, Cmd.BOLD_ON, Cmd.HEIGHT_2X)
  p('TEMPLADOS\n')
  p(Cmd.HEIGHT_1X)
  p('CONSORCIO\n')
  p('ARTE EN VIDRIO\n')
  p(detalle.tipo === 'pedido' ? 'Pedido vidrio\n' : 'Cotizacion vidrio\n')
  p(Cmd.BOLD_OFF, Cmd.ALIGN_L)
  p('-'.repeat(cols) + '\n')

  // ── Datos cabecera ────────────────────────────────────────────────────────
  if (detalle.tipo === 'pedido') {
    p(rowLR('Pedido:', detalle.folio, cols) + '\n')
    if (detalle.foliosCot) p(rowLR('Cotizacion:', detalle.foliosCot, cols) + '\n')
  } else {
    p(rowLR('Folio:', detalle.folio, cols) + '\n')
  }
  p(rowLR('Fecha:', detalle.fecha, cols) + '\n')
  p(rowLR('Hora:', detalle.hora ?? '', cols) + '\n')
  p(rowLR('Cliente:', detalle.clienteNombre ?? 'Mostrador', cols) + '\n')
  p(rowLR('Nivel:', detalle.nivelNombre ?? '', cols) + '\n')
  p('-'.repeat(cols) + '\n')

  // ── Partidas ──────────────────────────────────────────────────────────────
  for (const it of detalle.partidas) {
    const pzas     = it.piezas ?? 1
    const clave    = it.clave ?? '?'
    const medida   = `${it.largo_cm}x${it.ancho_cm}`
    const descLine = `${pzas} pza${pzas > 1 ? 's' : ''} - ${clave} ${medida}`
    const amt      = ('$' + Number(it.subtotal_vidrio).toFixed(2)).padStart(amtW)
    const pad      = Math.max(1, cols - descLine.length - amtW)
    p(Cmd.BOLD_ON)
    p(descLine + ' '.repeat(pad) + amt + '\n')
    p(Cmd.BOLD_OFF)

    for (const pr of (it.procesos ?? [])) {
      const prAmt = ('$' + Number(pr.subtotal).toFixed(2)).padStart(amtW)
      const prDesc = '+ ' + pr.nombre
      const prPad = Math.max(1, cols - prDesc.length - amtW)
      p(prDesc + ' '.repeat(prPad) + prAmt + '\n')
    }

    if (it.procesos?.length > 0) {
      const subAmt = ('$' + Number(it.subtotal_partida).toFixed(2)).padStart(amtW)
      p(rowLR('Subtotal', subAmt, cols) + '\n')
    }
    p('\n')
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  p('-'.repeat(cols) + '\n')
  p(Cmd.BOLD_ON)
  p(rowLR('TOTAL:', '$' + Number(detalle.total).toFixed(2), cols) + '\n')
  p(Cmd.BOLD_OFF)

  // ── Forma de pago (solo pedido) ───────────────────────────────────────────
  if (detalle.tipo === 'pedido') {
    p('-'.repeat(cols) + '\n')
    p(rowLR('Forma de pago:', detalle.formaPago === 'LIQUIDADO' ? 'Liquidado' : 'Anticipo', cols) + '\n')
    if (detalle.formaPago === 'ANTICIPO') {
      p(rowLR('Anticipo:', '$' + Number(detalle.anticipo).toFixed(2), cols) + '\n')
      if (!detalle.esEntregado) {
        p(rowLR('Saldo pendiente:', '$' + Number(detalle.saldo).toFixed(2), cols) + '\n')
      } else if (detalle.saldo_cobrado != null) {
        p(rowLR('Saldo cobrado:', '$' + Number(detalle.saldo_cobrado).toFixed(2), cols) + '\n')
      }
    }
  }

  // ── Pie ───────────────────────────────────────────────────────────────────
  p('-'.repeat(cols) + '\n')
  p(Cmd.ALIGN_C)
  p(detalle.esEntregado ? 'Gracias por su compra!\n' : 'Pedido pendiente de entrega.\n')
  p('\n\n\n')
  p(Cmd.CUT)

  return new Uint8Array(buf)
}

/**
 * Construye los bytes ESC/POS para imprimir un ticket.
 * @param {object} venta - objeto con folio, fecha, hora, total, partidas[]
 * @param {number} cols  - columnas de la impresora (32 para 58mm, 42 para 80mm)
 * @returns {Uint8Array}
 */
export function buildTicketEscPos(venta, cols = 42) {
  const buf = []
  const p = (...parts) => push(buf, ...parts)

  // ── Inicializar ───────────────────────────────────────────────────────────
  p(Cmd.INIT)
  p(Cmd.ALIGN_C, Cmd.BOLD_ON, Cmd.HEIGHT_2X)
  p('HERRAJES\n')
  p(Cmd.HEIGHT_1X)
  p('CONSORCIO\n')
  p('ARTE EN VIDRIO\n')
  p('Pedido herraje\n')
  p(Cmd.BOLD_OFF, Cmd.ALIGN_L)
  p('-'.repeat(cols) + '\n')

  // ── Datos de la venta ────────────────────────────────────────────────────
  p(rowLR('Folio:', venta.folio, cols) + '\n')
  p(rowLR('Fecha:', venta.fecha, cols) + '\n')
  p(rowLR('Hora:', venta.hora,  cols) + '\n')
  p('-'.repeat(cols) + '\n')

  // ── Cabecera de columnas ─────────────────────────────────────────────────
  const subtotalW = 9   // "$9999.99"
  const cantW     = 4   // "999 "
  const descW     = cols - cantW - subtotalW - 2
  p(Cmd.BOLD_ON)
  p('CANT' + ' ' + 'DESCRIPCION'.padEnd(descW) + ' ' + 'IMPORTE'.padStart(subtotalW) + '\n')
  p(Cmd.BOLD_OFF)
  p('-'.repeat(cols) + '\n')

  // ── Función para envolver texto ───────────────────────────────────────────
  const wrapText = (text, width) => {
    const words = text.split(' ')
    const lines = []
    let currentLine = ''
    for (const word of words) {
      if ((currentLine + ' ' + word).length <= width) {
        currentLine = currentLine ? currentLine + ' ' + word : word
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }

  // ── Partidas ──────────────────────────────────────────────────────────────
  for (const item of venta.partidas) {
    const subtotalStr = ('$' + Number(item.subtotal).toFixed(2)).padStart(subtotalW)
    const fullDesc = item.descripcion + (item.tono ? ' - ' + item.tono : '')
    const descLines = wrapText(fullDesc, descW)
    
    // Primera línea: Cantidad + Descripción completa envuelta + Subtotal
    if (descLines.length > 0) {
      const firstLine = descLines[0].padEnd(descW)
      p(String(item.cantidad).padStart(3) + ' ' + firstLine + ' ' + subtotalStr + '\n')
      
      // Líneas adicionales de descripción (sin cantidad ni importe, solo descripción)
      for (let i = 1; i < descLines.length; i++) {
        const additionalLine = descLines[i].padEnd(descW)
        p('    ' + additionalLine + '\n')
      }
      
      // Precio unitario en línea separada
      p('    $' + Number(item.precioUnitario).toFixed(2) + '/u\n')
    }
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  p('-'.repeat(cols) + '\n')
  p(Cmd.BOLD_ON)
  p(rowLR('TOTAL:', '$' + Number(venta.total).toFixed(2), cols) + '\n')
  p(Cmd.BOLD_OFF)

  // ── Pie ───────────────────────────────────────────────────────────────────
  p('-'.repeat(cols) + '\n')
  p(Cmd.ALIGN_C)
  p('Gracias por su compra!\n\n')
  p(Cmd.BOLD_ON)
  p('POLITICAS DE DEVOLUCION\n')
  p(Cmd.BOLD_OFF)
  p('No se devuelve el dinero.\n')
  p('Si se realiza cambio de producto.\n')
  p('\n\n\n')
  p(Cmd.CUT)

  return new Uint8Array(buf)
}
