import logoUrl from '../assets/images/logoVR_b64.txt?raw'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * Imprime un ticket de vidrio (cotización o pedido) via iframe.
 * @param {object} detalle - datos del ticket (folio, fecha, hora, clienteNombre, nivelNombre,
 *   tipo, formaPago, anticipo, saldo, saldo_cobrado, esEntregado, total,
 *   partidas[{piezas, clave, largo_cm, ancho_cm, subtotal_vidrio, procesos, subtotal_partida}])
 */
function glassIconSVG(sides, largo, ancho) {
  const { top: t, bottom: b, left: l, right: r } = sides
  if (t && b && l && r) return ''
  const W = 44, H = 34, lbH = 8, lbW = 14
  const gx0 = lbW, gy0 = lbH, gx1 = W - 2, gy1 = H - lbH - 1
  const cx = (gx0 + gx1) / 2, cy = (gy0 + gy1) / 2
  const S = (ax, ay, bx, by, on) => on
    ? `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#1B4DFF" stroke-width="2.5"/>`
    : `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#BBBBBB" stroke-width="1" stroke-dasharray="2,2"/>`
  let lbl = ''
  if (t || b) lbl += `<text x="${cx}" y="${t ? gy0 - 3 : gy1 + 7}" text-anchor="middle" font-size="6" font-family="Arial,sans-serif" font-weight="700" fill="#1B4DFF">${ancho}cm</text>`
  if (l || r) { const lx = l ? gx0 - 1 : gx1 + 1; lbl += `<text x="${lx}" y="${cy}" text-anchor="${l ? 'end' : 'start'}" dominant-baseline="middle" font-size="6" font-family="Arial,sans-serif" font-weight="700" fill="#1B4DFF" transform="rotate(-90,${lx},${cy})">${largo}cm</text>` }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:inline-block;vertical-align:middle;flex-shrink:0;margin-right:3px"><rect x="${gx0}" y="${gy0}" width="${gx1-gx0}" height="${gy1-gy0}" fill="rgba(100,140,255,0.08)"/>${S(gx0,gy0,gx1,gy0,t)}${S(gx0,gy1,gx1,gy1,b)}${S(gx0,gy0,gx0,gy1,l)}${S(gx1,gy0,gx1,gy1,r)}${lbl}</svg>`
}

function parseMaqNotas(p) {
  try { return p.notas ? JSON.parse(p.notas) : null } catch { return null }
}

export function printTicketVidrio(detalle) {
  const vidrios    = detalle.partidas.filter(p => !p.tipo || p.tipo === 'VIDRIO')
  const maquilas   = detalle.partidas.filter(p => p.tipo === 'MAQUILA')
  const extrasProc = detalle.partidas.filter(p => p.tipo === 'EXTRA')
  const herrajes   = detalle.partidas.filter(p => p.tipo === 'HERRAJE' || p.tipo === 'PRODUCTO')
  
  const renderVidrio = p => {
    const pzas    = p.piezas ?? 1
    const cuVid   = Number(p.subtotal_vidrio ?? p.subtotal_partida) / pzas
    const totVid  = cuVid * pzas
    const hasProc = (p.procesos ?? []).length > 0
    const procSubtotal = (p.procesos ?? []).reduce((s, pr) => s + Number(pr.subtotal), 0)
    const exactSubtotal = Number(p.subtotal_partida)
    const procRows = (p.procesos ?? []).map(pr => {
      const cuPr  = Number(pr.subtotal) / pzas
      const totPr = cuPr * pzas
      const allSides = pr.sidesML?.top && pr.sidesML?.bottom && pr.sidesML?.left && pr.sidesML?.right
      const icon = (pr.sidesML && !allSides) ? glassIconSVG(pr.sidesML, p.largo_cm, p.ancho_cm) : ''
      return `
      <tr style="font-size:11px">
        <td colspan="3" style="padding-left:10px"><div style="display:flex;align-items:center">${icon}<span>+ ${pr.nombre}</span></div></td>
        <td class="c-cu">$${cuPr.toFixed(2)}</td>
        <td class="c-tot">$${totPr.toFixed(2)}</td>
      </tr>`
    }).join('')
    const subtotalRow = hasProc ? `
      <tr style="font-size:11px;font-weight:600;border-top:1px dashed #ccc">
        <td colspan="3">Subtotal</td>
        <td class="c-cu">$${(exactSubtotal / pzas).toFixed(2)}</td>
        <td class="c-tot">$${exactSubtotal.toFixed(2)}</td>
      </tr>` : ''
    const descRow = p.descripcion_vidrio ? `
      <tr>
        <td></td>
        <td colspan="4" style="font-size:11px;color:#555;padding-bottom:2px">${p.descripcion_vidrio}</td>
      </tr>` : ''
    return `
      <tr class="bold">
        <td class="c-cant">${pzas}</td>
        <td class="c-med">${p.largo_cm}×${p.ancho_cm}</td>
        <td>${p.clave}</td>
        <td class="c-cu">$${cuVid.toFixed(2)}</td>
        <td class="c-tot">$${totVid.toFixed(2)}</td>
      </tr>
      ${descRow}
      ${procRows}
      ${subtotalRow}`
  }

  const renderMaquila = p => {
    if (p.largo_cm && Number(p.largo_cm) > 0) {
      const pzas  = p.piezas ?? 1
      const cuMaq = Number(p.subtotal_partida) / pzas
      const procRows = (p.procesos ?? []).map(pr => {
        const allSides = pr.sidesML?.top && pr.sidesML?.bottom && pr.sidesML?.left && pr.sidesML?.right
        const icon = (pr.sidesML && !allSides) ? glassIconSVG(pr.sidesML, p.largo_cm, p.ancho_cm) : ''
        return `
        <tr style="font-size:11px">
          <td colspan="3" style="padding-left:10px"><div style="display:flex;align-items:center">${icon}<span>+ ${pr.nombre}</span></div></td>
          <td class="c-cu">${pr.precio_unitario != null ? `$${Number(pr.precio_unitario).toFixed(2)}` : ''}</td>
          <td class="c-tot">$${Number(pr.subtotal ?? 0).toFixed(2)}</td>
        </tr>`
      }).join('')
      const descRow = p.descripcion ? `
        <tr>
          <td></td>
          <td colspan="4" style="font-size:11px;color:#555;padding-bottom:2px">${p.descripcion}</td>
        </tr>` : ''
      return `
        <tr class="bold">
          <td class="c-cant">${pzas}</td>
          <td class="c-med">${p.largo_cm}×${p.ancho_cm}</td>
          <td>${p.clave ?? ''}</td>
          <td class="c-cu">$${cuMaq.toFixed(2)}</td>
          <td class="c-tot">$${Number(p.subtotal_partida).toFixed(2)}</td>
        </tr>
        ${descRow}
        ${procRows}`
    }
    const label = p.descripcion || p.clave || '—'
    const notasProcs = (parseMaqNotas(p)?.procesos) ?? []
    const dotIdx = label.indexOf(' · ')
    if (dotIdx >= 0) {
      const dimsStr = label.slice(0, dotIdx)
      const procsStr = label.slice(dotIdx + 3)
      const dm = dimsStr.match(/(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)cm/)
      const pLargo = dm?.[1], pAncho = dm?.[2]
      const procList = procsStr.split(', ')
      const procRows = procList.map((pr, i) => {
        const procData = notasProcs[i]
        const sides = procData?.sidesML
        const allSides = sides?.top && sides?.bottom && sides?.left && sides?.right
        const icon = (sides && !allSides && pLargo && pAncho) ? glassIconSVG(sides, pLargo, pAncho) : ''
        const txt = pr.replace(/\s*\[[TBLR]+\]/g, '')
        const cu  = procData?.precio_unitario != null ? `$${Number(procData.precio_unitario).toFixed(2)}` : ''
        const tot = procData?.subtotal != null ? `$${Number(procData.subtotal).toFixed(2)}` : ''
        return `<tr style="font-size:11px"><td colspan="3" style="padding-left:10px"><div style="display:flex;align-items:center">${icon}<span>+${txt}</span></div></td><td class="c-cu">${cu}</td><td class="c-tot">${tot}</td></tr>`
      }).join('')
      return `
        <tr class="bold">
          <td class="c-cant"></td>
          <td class="c-med"></td>
          <td>${dimsStr}</td>
          <td class="c-cu"></td>
          <td class="c-tot">$${Number(p.subtotal_partida).toFixed(2)}</td>
        </tr>
        ${procRows}`
    }
    const cu  = p.precio_unitario != null ? `$${Number(p.precio_unitario).toFixed(2)}` : ''
    return `
      <tr class="bold">
        <td class="c-cant">${p.cantidad ?? 1}</td>
        <td class="c-med"></td>
        <td>${label}</td>
        <td class="c-cu">${cu}</td>
        <td class="c-tot">$${Number(p.subtotal_partida).toFixed(2)}</td>
      </tr>`
  }

  const renderHerraje = p => `
    <div class="partida">
      <div class="row">
        <span>${p.cantidad ?? 1} · ${p.descripcion ?? ''}</span>
        <span class="bold">$${Number(p.subtotal_partida).toFixed(2)}</span>
      </div>
    </div>`

  const sectionLbl = text => `<div class="section-lbl">${text}</div>`

  const colHeader = `<table class="tbl-vidrio"><thead><tr>
    <th class="c-cant">Cant</th>
    <th class="c-med">Medida</th>
    <th>Descripción</th>
    <th class="c-cu">c/u</th>
    <th class="c-tot">Total</th>
  </tr></thead><tbody>`

  const totalCalculado = detalle.partidas.reduce((sum, p) => sum + Number(p.subtotal_partida), 0)

  const totalPzasVidrio  = detalle.piezasVidrioVendidas ??
    vidrios.reduce((s, p) => s + Number(p.piezas ?? p.cantidad ?? 1), 0)
  const totalPzasMaquila = detalle.piezasMaquilaRecibidas ??
    maquilas.reduce((s, p) => s + Number(p.piezas ?? p.cantidad ?? 1), 0)
  const piezasResumen = [
    (vidrios.length > 0 && totalPzasVidrio  > 0) ? `<div class="row" style="font-size:11px;color:#555"><span>Piezas vendidas:</span><span><strong>${totalPzasVidrio}</strong></span></div>`  : '',
    totalPzasMaquila > 0 ? `<div class="row" style="font-size:11px;color:#555"><span>Piezas maquila recibidas:</span><span><strong>${totalPzasMaquila}</strong></span></div>` : '',
  ].join('')

  let rows = ''
  if (vidrios.length)    rows += sectionLbl('Vidrio') + colHeader + vidrios.map(renderVidrio).join('') + '</tbody></table>'
  if (maquilas.length)   rows += sectionLbl('Maquila') + colHeader + maquilas.map(renderMaquila).join('') + '</tbody></table>'
  if (extrasProc.length) rows += sectionLbl('Proceso Extra') + extrasProc.map(p => `
    <div class="row"><span>${p.cantidad ?? 1} · ${p.descripcion ?? '—'}</span><span>$${Number(p.subtotal_partida).toFixed(2)}</span></div>`).join('')
  if (herrajes.length)   rows += sectionLbl('Herraje') + herrajes.map(renderHerraje).join('')

  const pagoRows = detalle.tipo === 'pedido' ? `
    <hr class="divider">
    ${detalle.metodoPago ? `<div class="row"><span>Método de pago:</span><span>${detalle.metodoPago.charAt(0) + detalle.metodoPago.slice(1).toLowerCase()}</span></div>` : ''}
    <div class="row"><span>Método de entrega:</span><span>${
      detalle.formaPago === 'LIQUIDADO' ? 'Liquidado' :
      detalle.formaPago === 'POR COBRAR' ? 'Por cobrar' :
      detalle.formaPago === 'CONTADO'   ? 'Contado' : 'Anticipo'
    }</span></div>
    ${detalle.formaPago === 'ANTICIPO' ? `
      <div class="row"><span>Anticipo:</span><span class="bold">$${Number(detalle.anticipo).toFixed(2)}</span></div>
      ${!detalle.esEntregado ? `<div class="row"><span>Saldo pendiente:</span><span class="bold">$${Number(detalle.saldo).toFixed(2)}</span></div>` : ''}
      ${detalle.esEntregado && detalle.saldo_cobrado != null ? `<div class="row"><span>Saldo cobrado:</span><span class="bold">$${Number(detalle.saldo_cobrado).toFixed(2)}</span></div>` : ''}
    ` : ''}
    ${detalle.formaPago === 'POR COBRAR' ? `
  <div class="row"><span>Saldo por cobrar:</span><span class="bold">$${totalCalculado.toFixed(2)}</span></div>
  <br><br><br>
  <div style="border-top:1px solid #000;width:70%;margin:0 auto;margin-top:20px;"></div>
  <div style="text-align:center;font-size:11px;margin-top:4px;">Firma del cliente</div>
` : ''}

  ` : ''

  const esMaquila = (maquilas.length > 0 || extrasProc.length > 0) && vidrios.length === 0
  const titulo = detalle.tipo === 'pedido'
    ? (esMaquila ? 'Pedido maquila' : 'Pedido vidrio')
    : (esMaquila ? 'Cotizacion maquila' : 'Cotizacion vidrio')
  const folioLabel = detalle.tipo === 'pedido' ? 'Pedido:' : 'Folio:'
  const cotLabel = detalle.tipo === 'pedido' ? `<div class="row"><span>Cotizacion:</span><span>${detalle.foliosCot ?? ''}</span></div>` : ''
  const pie = detalle.esEntregado ? '¡Gracias por su compra!' : detalle.tipo === 'pedido' ? 'Pendiente de entrega.' : 'Cotizacion con vigencia de 15 dias.'
  const reimpresionHtml = detalle.esCancelado
    ? `<div class="center" style="font-size:12px;font-weight:700;border:2px solid #991b1b;padding:4px 0;margin-top:6px;letter-spacing:1px;color:#991b1b">⚠ PEDIDO CANCELADO — REIMPRESIÓN ⚠</div>`
    : detalle.esReimpresion
      ? `<div class="center" style="font-size:11px;font-weight:700;border:1px dashed #000;padding:3px 0;margin-top:6px;letter-spacing:1px">*** REIMPRESION — PEDIDO ENTREGADO ***</div>`
      : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ticket ${detalle.folio}</title>
  <style>
    @page { margin: 4mm; size: 80mm auto; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, 'Helvetica Neue', sans-serif; font-size: 13px; width: 72mm; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .right { text-align: right; }
    .divider { border: none; border-top: 1.5px solid #000; margin: 7px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .header { margin-bottom: 10px; }
    .header h1 { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { font-size: 12px; font-weight: 600; }
    .partida { margin-bottom: 6px; }
    .section-lbl { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; border-bottom: 1px dashed #888; padding-bottom: 2px; margin: 6px 0 3px; }
    .total-row { font-size: 15px; font-weight: 700; }
    .footer { margin-top: 10px; font-size: 12px; }
    .tbl-vidrio { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 3px; }
    .tbl-vidrio td, .tbl-vidrio th { vertical-align: baseline; padding: 1px 0; }
    .tbl-vidrio thead th { font-size: 9px; font-weight: 400; color: #555; text-align: left; border-bottom: 1px dashed #aaa; padding-bottom: 3px; }
    .tbl-vidrio .bold td { font-weight: 700; }
    .c-cant { width: 22px; }
    .c-med  { width: 54px; }
    .c-cu   { width: 48px; text-align: right; padding-left: 6px; }
    .c-tot  { width: 52px; text-align: right; padding-left: 6px; }
  </style>
</head>
<body>
  <div class="header center">
    <h1>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h1>
    <p style="font-style:italic;font-weight:700">Calidad que se ve, confianza que perdura</p>
    <p>Rosales #35 C.P. 55270, Granjas Valle de Guadalupe</p>
    <p>Ecatepec de Morelos, Estado de Mexico</p>
    <p>Tel: 5523134256, 5522161432, 5547912671</p>
    <p>rosalesvidriotempladofernando@gmail.com</p>
    <p>${titulo}</p>
  </div>
  <hr class="divider">
  <div class="row"><span>${folioLabel}</span><span class="bold">${detalle.folio}</span></div>
  ${cotLabel}
  <div class="row"><span>Fecha:</span><span>${detalle.fecha}</span></div>
  ${detalle.hora ? `<div class="row"><span>Hora:</span><span>${detalle.hora}</span></div>` : ''}
  <div class="row"><span>Cliente:</span><span>${detalle.clienteNombre ?? 'Mostrador'}</span></div>
  <div class="row"><span>Nivel:</span><span>${detalle.nivelNombre ?? ''}</span></div>
  ${detalle.observaciones ? `<div style="font-size:11px;margin-bottom:4px;display:flex;gap:4px"><span style="white-space:nowrap;color:#555">Obs:</span><span>${detalle.observaciones}</span></div>` : ''}
  <hr class="divider">
  ${rows}
  ${piezasResumen ? `<hr class="divider">${piezasResumen}` : ''}
  <hr class="divider">
  <div class="row total-row"><span>TOTAL:</span><span>$${totalCalculado.toFixed(2)}</span></div>
  ${pagoRows}
  <hr class="divider">
  <div class="footer center">${pie}</div>
  ${reimpresionHtml}
</body>
</html>`

  let iframe = document.getElementById('__ticket_vidrio_frame__')
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = '__ticket_vidrio_frame__'
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden'
    document.body.appendChild(iframe)
  }
  iframe.contentDocument.open()
  iframe.contentDocument.write(html)
  iframe.contentDocument.close()
  setTimeout(() => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch {
      const win = window.open('', '_blank', 'width=480,height=640')
      if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400) }
    }
  }, 300)
}

/**
 * Imprime el detalle de un pedido pendiente como ticket de 80mm.
 */
export function printPedidoPendiente(detalle) {
  const vidrios  = detalle.partidas.filter(p => !p.tipo || p.tipo === 'VIDRIO')
  const maquilas = detalle.partidas.filter(p => p.tipo === 'MAQUILA')
  const extras = detalle.extras ?? []
  const extrasTotal = extras.reduce((sum, e) => sum + Number(e.subtotal), 0)
  const totalCalculado = detalle.partidas.reduce((sum, p) => sum + Number(p.subtotal_partida), 0) + extrasTotal
  const totalPzasVidrio  = detalle.piezasVidrioVendidas ??
    vidrios.reduce((s, p) => s + Number(p.cantidad ?? 1), 0)
  const totalPzasMaquila = detalle.piezasMaquilaRecibidas ??
    (maquilas.reduce((s, p) => s + Number(p.piezas ?? p.cantidad ?? 1), 0) +
     extras.filter(e => e.tipo === 'MAQUILA').reduce((s, e) => s + Number(e.cantidad ?? 1), 0))
  const piezasResumen = [
    (vidrios.length > 0 && totalPzasVidrio  > 0) ? `<div class="row" style="font-size:11px;color:#555"><span>Piezas vendidas:</span><span><strong>${totalPzasVidrio}</strong></span></div>`  : '',
    totalPzasMaquila > 0 ? `<div class="row" style="font-size:11px;color:#555"><span>Piezas maquila recibidas:</span><span><strong>${totalPzasMaquila}</strong></span></div>` : '',
  ].join('')
  const rows = vidrios.map((p, i) => {
    const cant        = p.cantidad ?? 1
    const vidSubtotal = Number(p.subtotal_vidrio ?? p.subtotal_partida)
    const hasProc     = (p.procesos ?? []).length > 0
    const procRows = (p.procesos ?? []).map(pr => {
      const cantLabel = pr.cantidad && pr.cantidad !== 1 ? ` × ${pr.cantidad}` : ''
      return `<div class="row" style="padding-left:12px;font-size:11px;color:#444">
        <span>+ ${pr.nombre}${cantLabel}</span><span>$${Number(pr.subtotal).toFixed(2)}</span>
      </div>`
    }).join('')
    const subtotalRow = hasProc ? `
      <div class="row" style="padding-top:3px;border-top:1px dashed #ccc;margin-top:2px;font-weight:700;font-size:12px">
        <span>Subtotal</span><span>$${Number(p.subtotal_partida).toFixed(2)}</span>
      </div>` : ''

    const cuVid = vidSubtotal / cant
    return `
      <div class="partida">
        <div style="display:flex;align-items:baseline;margin-bottom:2px;gap:6px">
          <span class="bold" style="font-size:13px;flex:1">${cant}- ${p.largo_cm}×${p.ancho_cm} ${p.clave_vidrio}</span>
          <span style="font-size:11px;color:#444;flex-shrink:0">$${cuVid.toFixed(2)} c/u</span>
          <span class="bold" style="font-size:13px;flex-shrink:0">$${vidSubtotal.toFixed(2)}</span>
        </div>
        <div style="font-size:11px;color:#444;margin-bottom:3px;padding-left:12px">
          ${p.clave_vidrio}${p.descripcion_vidrio ? ' — ' + p.descripcion_vidrio : ''} · ${Number(p.metros2).toFixed(4)} m²
        </div>
        ${procRows}
        ${subtotalRow}
      </div>`
  }).join('<div style="border-top:1px dashed #ccc;margin:5px 0"></div>')

  const maquilaDimHtml = maquilas.length === 0 ? '' : `
    <div style="font-weight:700;font-size:11px;margin:8px 0 3px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px dashed #888;padding-bottom:2px">
      Maquila
    </div>
    ${maquilas.map(p => {
      const procs = p.procesos ?? []
      const procRows = procs.length === 1
        ? `<div style="font-size:11px;color:#444;padding-left:12px">+ ${procs[0].nombre}</div>`
        : procs.length === 0 ? '' : procs.map(pr => `
        <div style="display:flex;padding-left:12px;font-size:11px;color:#444;gap:6px">
          <span style="flex:1">+ ${pr.nombre}</span>
          <span style="flex-shrink:0">${pr.precio_unitario != null ? `$${Number(pr.precio_unitario).toFixed(2)}` : ''}</span>
          <span style="flex-shrink:0">$${Number(pr.subtotal ?? 0).toFixed(2)}</span>
        </div>`).join('')
      const cuMaq = Number(p.subtotal_partida) / Number(p.piezas ?? p.cantidad ?? 1)
      return `
      <div class="partida">
        <div style="display:flex;align-items:baseline;margin-bottom:2px;gap:6px">
          <span class="bold" style="font-size:13px;flex:1">${p.piezas ?? p.cantidad ?? 1}- ${p.largo_cm}×${p.ancho_cm}cm${p.espesor_label ? ' · ' + p.espesor_label : ''}</span>
          <span style="font-size:11px;color:#444;flex-shrink:0">$${cuMaq.toFixed(2)} c/u</span>
          <span class="bold" style="font-size:13px;flex-shrink:0">$${Number(p.subtotal_partida).toFixed(2)}</span>
        </div>
        ${p.descripcion ? `<div style="font-size:11px;color:#444;margin-bottom:3px;padding-left:12px">${p.descripcion}</div>` : ''}
        ${procRows}
      </div>`
    }).join('<div style="border-top:1px dashed #ccc;margin:5px 0"></div>')}`

  const extrasHtml = extras.length === 0 ? '' : `
    <div style="font-weight:700;font-size:11px;margin:8px 0 3px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px dashed #888;padding-bottom:2px">
      Extras
    </div>
    <div style="display:flex;align-items:baseline;font-size:9px;color:#555;border-bottom:1px dashed #aaa;margin-bottom:3px;gap:2px">
      <span style="flex:1;padding-left:4px">Descripción</span>
      <span style="width:50px;flex-shrink:0;text-align:right">C.U.</span>
      <span style="width:50px;flex-shrink:0;text-align:right">Total</span>
    </div>
    ${extras.map(e => {
      const cu  = e.precio_unitario != null ? `$${Number(e.precio_unitario).toFixed(2)}` : ''
      const tot = `$${Number(e.subtotal).toFixed(2)}`
      return `
      <div class="partida">
        <div style="display:flex;align-items:baseline;font-size:11px;margin-bottom:2px;gap:2px">
          <span style="flex:1;padding-left:4px">${e.descripcion ?? ''}</span>
          <span style="width:50px;flex-shrink:0;text-align:right">${cu}</span>
          <span style="width:50px;flex-shrink:0;text-align:right;font-weight:700">${tot}</span>
        </div>
      </div>`
    }).join('')}`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Pedido ${detalle.folio}</title>
  <style>
    @page { margin: 4mm; size: 80mm auto; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, 'Helvetica Neue', sans-serif; font-size: 13px; width: 72mm; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .divider { border: none; border-top: 2px solid #000; margin: 7px 0; }
    .divider-thin { border: none; border-top: 1px solid #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .partida { margin-bottom: 4px; }
    .total-row { font-size: 16px; font-weight: 700; }
    .pago-box { background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; padding: 6px 8px; margin: 6px 0; }
    .header { margin-bottom: 10px; }
    .header h1 { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header center">
    <h1>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h1>
    <p style="font-style:italic;font-weight:700">Calidad que se ve, confianza que perdura</p>
    <p>Rosales #35 C.P. 55270, Granjas Valle de Guadalupe</p>
    <p>Ecatepec de Morelos, Estado de Mexico</p>
    <p>Tel: 5523134256, 5522161432, 5547912671</p>
    <p>rosalesvidriotempladofernando@gmail.com</p>
    <p>${vidrios.length === 0 && (maquilas.length > 0 || extras.length > 0) ? 'Pedido maquila' : 'Pedido vidrio'}</p>
  </div>
  <hr class="divider">
  <div class="row"><span>Pedido:</span><span class="bold">${detalle.folio}</span></div>
  ${detalle.id_cotizacion ? `<div class="row"><span>Cotizacion:</span><span>COT-${String(detalle.id_cotizacion).padStart(5,'0')}</span></div>` : ''}
  <div class="row"><span>Fecha:</span><span>${detalle.fecha}</span></div>
  ${detalle.hora ? `<div class="row"><span>Hora:</span><span>${detalle.hora}</span></div>` : ''}
  <div class="row"><span>Cliente:</span><span class="bold">${detalle.cliente?.nombre ?? 'Mostrador'}</span></div>
  ${detalle.nivel?.nombre ? `<div class="row"><span>Nivel:</span><span>${detalle.nivel.nombre}</span></div>` : ''}
  <hr class="divider">
  ${vidrios.length > 0 ? `<div style="font-weight:700;font-size:11px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px dashed #888;padding-bottom:2px">Vidrio</div>${rows}` : ''}
  ${maquilaDimHtml}
  ${extrasHtml}
  ${piezasResumen ? `<hr class="divider">${piezasResumen}` : ''}
  <hr class="divider">
  <div class="row total-row"><span>TOTAL</span><span>$${totalCalculado.toFixed(2)}</span></div>
  <hr class="divider-thin">
  <div class="pago-box">
    <div class="row"><span>Anticipo pagado:</span><span class="bold">$${Number(detalle.anticipo).toFixed(2)}</span></div>
    <div class="row" style="font-size:14px"><span class="bold">Saldo pendiente:</span><span class="bold">$${(totalCalculado - Number(detalle.anticipo)).toFixed(2)}</span></div>
  </div>
  <hr class="divider-thin">
  <div class="center" style="font-size:11px;margin-top:6px">${detalle.tipo_pago === 'POR COBRAR' ? 'Entregado.' : 'Pendiente de entrega.'}</div>
</body>
</html>`

  let iframe = document.getElementById('__ticket_vidrio_frame__')
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = '__ticket_vidrio_frame__'
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden'
    document.body.appendChild(iframe)
  }
  iframe.contentDocument.open()
  iframe.contentDocument.write(html)
  iframe.contentDocument.close()
  setTimeout(() => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print() }
    catch {
      const win = window.open('', '_blank', 'width=480,height=640')
      if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400) }
    }
  }, 300)
}

/**
 * Imprime una cotización en hoja carta/A4 con encabezado de marca completo.
 */
export function printCotizacionCarta(detalle) {
  const totalCalculado = detalle.partidas.reduce((sum, p) => sum + Number(p.subtotal_partida), 0)
  const vidrosPartidas  = detalle.partidas.filter(p => !p.tipo || p.tipo === 'VIDRIO' || p.tipo === 'MAQUILA')
  const extrasPartidas  = detalle.partidas.filter(p => p.tipo === 'EXTRA')
  const rows = vidrosPartidas.map((p) => {
    const pzas    = p.piezas ?? 1
    const m2      = (pzas * p.largo_cm * p.ancho_cm / 10000).toFixed(4)
    const cuVid   = Number(p.subtotal_vidrio ?? p.subtotal_partida) / pzas
    const totVid  = cuVid * pzas
    const hasProc = (p.procesos ?? []).length > 0
    const procSubRows = (p.procesos ?? []).map(pr => {
      const cuPr  = Number(pr.subtotal) / pzas
      const totPr = cuPr * pzas
      return `
      <tr class="partida-row">
        <td></td>
        <td style="font-size:12px;color:#555;padding-left:14px">+ ${pr.nombre}</td>
        <td></td>
        <td style="text-align:right;font-size:12px;color:#555">$${cuPr.toFixed(2)}</td>
        <td style="text-align:right;font-size:12px;color:#555">$${totPr.toFixed(2)}</td>
        <td></td>
      </tr>`
    }).join('')
    const subtotalRow = hasProc ? `
      <tr class="partida-row" style="border-top:1px dashed #ccc">
        <td></td>
        <td style="font-size:12px;font-weight:700;padding-left:14px">Subtotal</td>
        <td></td>
        <td style="text-align:right;font-size:12px;font-weight:700">$${(Number(p.subtotal_partida)/pzas).toFixed(2)}</td>
        <td style="text-align:right;font-weight:700">$${Number(p.subtotal_partida).toFixed(2)}</td>
        <td></td>
      </tr>` : ''
    return `
      <tr class="partida-row">
        <td style="text-align:center;font-weight:700">${pzas}</td>
        <td><strong>${p.clave}</strong></td>
        <td style="text-align:center;color:#555;font-size:12px">${m2} m²</td>
        <td style="text-align:right;font-size:12px">$${cuVid.toFixed(2)}</td>
        <td style="text-align:right;font-weight:600">$${totVid.toFixed(2)}</td>
        <td></td>
      </tr>
      ${procSubRows}
      ${subtotalRow}`
  }).join('')

  const pie = detalle.tipo === 'pedido' ? '¡Gracias por su compra!' : 'Cotización con vigencia de 15 días a partir de la fecha de emisión.'
  const titulo = detalle.tipo === 'pedido' ? 'PEDIDO DE VIDRIO' : 'COTIZACIÓN DE VIDRIO'
  const folioLabel = detalle.tipo === 'pedido' ? 'Pedido N°:' : 'Folio:'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo} ${detalle.folio}</title>
  <style>
    @page { margin: 0; size: A4 portrait; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 12mm 14mm; }

    .brand-header { display: flex; align-items: center; gap: 16px; padding-bottom: 14px; border-bottom: 2px solid #1a3a6b; margin-bottom: 20px; }
    .brand-logo { width: 80px; height: auto; flex-shrink: 0; }
    .brand-name { font-size: 17px; font-weight: 900; letter-spacing: 1px; color: #1a3a6b; }
    .brand-detail { font-size: 11px; color: #555; margin-top: 3px; }

    /* ── Marcas ── */
    .marcas-section { margin-bottom: 20px; }
    .marcas-label {
      text-align: center; font-size: 10px; letter-spacing: 5px;
      color: #888; text-transform: uppercase; margin-bottom: 8px;
      display: flex; align-items: center; gap: 10px;
    }
    .marcas-label::before, .marcas-label::after {
      content: ''; flex: 1; height: 1px; background: #d0d0d0;
    }
    .marcas-grid { display: flex; gap: 0; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
    .marca-card {
      flex: 1; padding: 12px 8px; text-align: center;
      border-right: 1px solid #e0e0e0;
    }
    .marca-card:last-child { border-right: none; }
    .marca-card.destacado { background: #1a3a6b; color: #fff; }
    .marca-card .marca-nombre { font-size: 16px; font-weight: 700; color: #1a3a6b; }
    .marca-card.destacado .marca-nombre { color: #fff; }
    .marca-card .marca-sub { font-size: 9px; letter-spacing: 2px; color: #888; text-transform: uppercase; margin-top: 2px; }
    .marca-card.destacado .marca-sub { color: rgba(200,220,255,0.8); }

    /* ── Datos cotización ── */
    .doc-info {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 16px; gap: 20px;
    }
    .doc-titulo { font-size: 18px; font-weight: 700; color: #1a3a6b; }
    .doc-meta { font-size: 12px; color: #555; line-height: 1.8; text-align: right; }
    .doc-meta strong { color: #111; }
    .cliente-box {
      background: #f4f7fb; border-left: 4px solid #1a3a6b;
      padding: 10px 14px; border-radius: 0 6px 6px 0; margin-bottom: 16px; font-size: 13px;
    }
    .cliente-box .c-nombre { font-size: 15px; font-weight: 700; color: #1a3a6b; }
    .cliente-box .c-detail { color: #555; font-size: 12px; margin-top: 2px; }

    /* ── Tabla partidas ── */
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #1a3a6b; color: #fff; padding: 8px 10px; font-size: 12px; text-align: left; }
    th:last-child { text-align: right; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: top; }
    .partida-row td { background: #fff; }
    .partida-row:hover td { background: #fafafa; }

    /* ── Total ── */
    .total-box {
      display: flex; justify-content: flex-end; margin-bottom: 24px;
    }
    .total-inner {
      background: #1a3a6b; color: #fff; padding: 12px 24px;
      border-radius: 8px; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;
    }

    /* ── Pie ── */
    .footer-doc {
      border-top: 1px solid #ddd; padding-top: 12px;
      font-size: 11px; color: #777; text-align: center; line-height: 1.6;
    }
  </style>
</head>
<body>

  <div class="brand-header">
    <img src="${logoUrl}" class="brand-logo" alt="Logo">
    <div>
      <div class="brand-name">VIDRIO TEMPLADO Y ALUMINIO ROSALES</div>
      <div class="brand-detail" style="font-style:italic;color:#1565c0;font-weight:600;margin-top:2px">Calidad que se ve, confianza que perdura</div>
      <div class="brand-detail">Rosales #35 C.P. 55270, Granjas Valle de Guadalupe · Ecatepec de Morelos, Estado de Mexico</div>
      <div class="brand-detail">Tel: 5523134256, 5522161432, 5547912671 · rosalesvidriotempladofernando@gmail.com</div>
    </div>
  </div>

  <!-- Marcas -->
  <div class="marcas-section">
    <div class="marcas-label">Marcas que distribuimos</div>
    <div class="marcas-grid">
      <div class="marca-card">
        <div class="marca-nombre" style="font-style:italic">axlent</div>
        <div class="marca-sub">i t a l y</div>
      </div>
      <div class="marca-card">
        <div class="marca-nombre">DAWH</div>
        <div class="marca-sub">Door &amp; Window Hardware</div>
      </div>
      <div class="marca-card destacado">
        <div class="marca-nombre">Brüken</div>
        <div class="marca-sub">ASSA ABLOY</div>
      </div>
    </div>
  </div>

  <!-- Info del documento -->
  <div class="doc-info">
    <div class="doc-titulo">${titulo}</div>
    <div class="doc-meta">
      <div>${folioLabel} <strong>${detalle.folio}</strong></div>
      <div>Fecha: <strong>${detalle.fecha}</strong></div>
      ${detalle.hora ? `<div>Hora: <strong>${detalle.hora}</strong></div>` : ''}
    </div>
  </div>

  <!-- Destinatario: empresa o cliente -->
  <div class="cliente-box">
    ${detalle.empresa ? `
      <div class="c-nombre">${detalle.empresa.nombre}</div>
      <div class="c-detail" style="margin-top:6px">
        ${detalle.empresa.razon_social ? `<div>Razón social: <strong>${detalle.empresa.razon_social}</strong></div>` : ''}
        ${detalle.empresa.rfc         ? `<div>RFC: <strong>${detalle.empresa.rfc}</strong></div>` : ''}
        ${detalle.empresa.telefono    ? `<div>Tel: ${detalle.empresa.telefono}</div>` : ''}
        ${detalle.empresa.correo      ? `<div>Correo: ${detalle.empresa.correo}</div>` : ''}
        ${detalle.empresa.direccion   ? `<div>Dirección: ${detalle.empresa.direccion}</div>` : ''}
      </div>
    ` : `
      <div class="c-nombre">${detalle.clienteNombre ?? 'Mostrador'}</div>
      <div class="c-detail">
        ${detalle.clienteTel ? `Tel: ${detalle.clienteTel}` : ''}
        ${detalle.nivelNombre ? ` · Nivel: ${detalle.nivelNombre}` : ''}
      </div>
    `}
  </div>

  <!-- Partidas -->
  <table>
    <thead>
      <tr>
        <th style="text-align:center">Pzas</th>
        <th>Tipo / Proceso</th>
        <th style="text-align:center">m²</th>
        <th style="text-align:right">C/u</th>
        <th style="text-align:right">Total</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  ${extrasPartidas.length > 0 ? `
  <div style="font-size:13px;font-weight:700;color:#1a3a6b;margin:12px 0 6px;text-transform:uppercase;letter-spacing:1px">Proceso Extra</div>
  <table>
    <thead><tr>
      <th>Proceso</th>
      <th style="text-align:center">Cant</th>
      <th style="text-align:right">P.U.</th>
      <th style="text-align:right">Total</th>
    </tr></thead>
    <tbody>
      ${extrasPartidas.map((p, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'}">
        <td>${p.descripcion ?? '—'}</td>
        <td style="text-align:center">${p.cantidad ?? 1}</td>
        <td style="text-align:right;font-size:11px">$${Number(p.precio_unitario ?? 0).toFixed(2)}</td>
        <td style="text-align:right;font-weight:600">$${Number(p.subtotal_partida).toFixed(2)}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <!-- Total -->
  <div class="total-box">
    <div class="total-inner">TOTAL: $${totalCalculado.toFixed(2)}</div>
  </div>

  <!-- Pie -->
  <div class="footer-doc">
    ${pie}<br>
    Vidrio Templado y Aluminio Rosales · Tel: 5523134256, 5522161432, 5547912671
  </div>

</body>
</html>`

  let iframe = document.getElementById('__cot_carta_frame__')
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = '__cot_carta_frame__'
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden'
    document.body.appendChild(iframe)
  }
  iframe.contentDocument.open()
  iframe.contentDocument.write(html)
  iframe.contentDocument.close()
  setTimeout(() => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch {
      const win = window.open('', '_blank', 'width=820,height=1060')
      if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400) }
    }
  }, 350)
}

/**
 * Imprime un pedido en hoja A4 con encabezado de marca completo.
 * Acepta el mismo objeto detalle que printTicketVidrio (tipo: 'pedido').
 */
export async function printPedidoA4(detalle) {
  const vidrios    = detalle.partidas.filter(p => !p.tipo || p.tipo === 'VIDRIO')
  const maquilas   = detalle.partidas.filter(p => p.tipo === 'MAQUILA')
  const extrasProc = detalle.partidas.filter(p => p.tipo === 'EXTRA')
  const herrajes   = detalle.partidas.filter(p => p.tipo === 'HERRAJE' || p.tipo === 'PRODUCTO')

  const totalCalculado = detalle.partidas.reduce((sum, p) => sum + Number(p.subtotal_partida), 0)

  const totalPzasVidrio  = detalle.piezasVidrioVendidas ??
    vidrios.reduce((s, p) => s + Number(p.piezas ?? p.cantidad ?? 1), 0)
  const totalPzasMaquila = detalle.piezasMaquilaRecibidas ??
    maquilas.reduce((s, p) => s + Number(p.piezas ?? p.cantidad ?? 1), 0)
  const piezasResumen = (totalPzasVidrio > 0 || totalPzasMaquila > 0) ? `
    <div class="pblock" style="display:flex;gap:24px;font-size:12px;color:#444;margin-bottom:8px;margin-top:4px">
      ${totalPzasVidrio  > 0 ? `<span>Piezas vendidas: <strong>${totalPzasVidrio}</strong></span>`  : ''}
      ${totalPzasMaquila > 0 ? `<span>Piezas maquila recibidas: <strong>${totalPzasMaquila}</strong></span>` : ''}
    </div>` : ''

  const vidrioRows = vidrios.map((p, idx) => {
    const pzas    = p.piezas ?? 1
    const cuVid   = Number(p.subtotal_vidrio ?? p.subtotal_partida) / pzas
    const totVid  = cuVid * pzas
    const m2      = ((pzas * Number(p.largo_cm) * Number(p.ancho_cm)) / 10000).toFixed(4)
    const bg      = idx % 2 === 0 ? '#fff' : '#fafafa'
    const hasProc = (p.procesos ?? []).length > 0
    const procSubtotal = (p.procesos ?? []).reduce((s, pr) => s + Number(pr.subtotal), 0)
    const exactSubtotal = Number(p.subtotal_partida)
    const procSubRows = (p.procesos ?? []).map(pr => {
      const cuPr  = Number(pr.subtotal) / pzas
      const totPr = cuPr * pzas
      return `
      <tr style="background:${bg}">
        <td></td><td></td>
        <td style="font-size:11px;color:#555;padding-left:12px">+ ${pr.nombre}</td>
        <td style="text-align:right;font-size:11px;color:#555">$${cuPr.toFixed(2)}</td>
        <td style="text-align:right;font-size:11px;color:#555">$${totPr.toFixed(2)}</td>
        <td></td>
      </tr>`
    }).join('')
    const subtotalSubRow = hasProc ? `
      <tr style="background:${bg};border-top:1px dashed #ddd">
        <td></td><td></td>
        <td style="font-size:11px;font-weight:700;padding-left:12px">Subtotal</td>
        <td style="text-align:right;font-size:11px;font-weight:700">$${(exactSubtotal/pzas).toFixed(2)}</td>
        <td style="text-align:right;font-weight:700">$${exactSubtotal.toFixed(2)}</td>
        <td></td>
      </tr>` : ''
    const descRow = p.descripcion_vidrio ? `
      <tr style="background:${bg}">
        <td></td>
        <td colspan="4" style="font-size:11px;color:#555;padding-top:0">${p.descripcion_vidrio}</td>
        <td></td>
      </tr>` : ''
    return `
      <tbody class="pblock">
      <tr style="background:${bg}">
        <td style="text-align:center;font-weight:700">${pzas}</td>
        <td style="font-size:11px">${p.largo_cm}×${p.ancho_cm} cm · ${m2} m²</td>
        <td style="font-weight:700;color:#1a3a6b">${p.clave ?? ''}</td>
        <td style="text-align:right;font-size:11px">$${cuVid.toFixed(2)}</td>
        <td style="text-align:right;font-weight:600">$${totVid.toFixed(2)}</td>
        <td></td>
      </tr>
      ${descRow}
      ${procSubRows}
      ${subtotalSubRow}
      </tbody>`
  }).join('')

  const vidrioSection = vidrios.length === 0 ? '' : `
    <div class="section-title">Vidrio</div>
    <table>
      <thead><tr>
        <th style="text-align:center">Pzas</th>
        <th>Medida</th>
        <th>Tipo / Proceso</th>
        <th style="text-align:right">C/u</th>
        <th style="text-align:right">Total</th>
        <th></th>
      </tr></thead>
      ${vidrioRows}
    </table>`

  const maquilaRows = maquilas.map((p, idx) => {
    const hasDims = p.largo_cm && Number(p.largo_cm) > 0
    const dims = hasDims
      ? `${p.piezas ?? p.cantidad ?? 1} · ${p.largo_cm}×${p.ancho_cm}cm${p.clave ? ' · ' + p.clave : ''}${p.descripcion ? ' · ' + p.descripcion : ''}`
      : (p.descripcion ?? p.clave ?? '—')
    const bg = `background:${idx % 2 === 0 ? '#fff' : '#fafafa'}`
    if (hasDims && (p.procesos ?? []).length > 0) {
      const procRows = p.procesos.map(pr => {
        const cu = pr.precio_unitario != null ? `$${Number(pr.precio_unitario).toFixed(2)}` : '—'
        return `
        <tr>
          <td style="font-size:11px;color:#555;padding-left:14px">+ ${pr.nombre}</td>
          <td style="text-align:right;font-size:11px;color:#555">${cu}</td>
          <td style="text-align:right;font-size:11px;color:#555">$${Number(pr.subtotal ?? 0).toFixed(2)}</td>
        </tr>`
      }).join('')
      const cuMaq = Number(p.subtotal_partida) / Number(p.piezas ?? p.cantidad ?? 1)
      return `
      <tbody class="pblock">
      <tr style="${bg}">
        <td style="font-weight:600">${dims}</td>
        <td style="text-align:right;font-size:11px">$${cuMaq.toFixed(2)}</td>
        <td style="text-align:right;font-weight:600">$${Number(p.subtotal_partida).toFixed(2)}</td>
      </tr>${procRows}
      </tbody>`
    }
    // Extra-only path: parse description for dims + ML processes with glass icons
    if (!hasDims) {
      const notasProcs = (parseMaqNotas(p)?.procesos) ?? []
      const dotIdx = dims.indexOf(' · ')
      if (dotIdx >= 0) {
        const dimsStr = dims.slice(0, dotIdx)
        const procsStr = dims.slice(dotIdx + 3)
        const dm = dimsStr.match(/(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)cm/)
        const pLargo = dm?.[1], pAncho = dm?.[2]
        const procList = procsStr.split(', ')
        const procTrs = procList.map((pr, i) => {
          const procData = notasProcs[i]
          const sides = procData?.sidesML
          const allSides = sides?.top && sides?.bottom && sides?.left && sides?.right
          const icon = (sides && !allSides && pLargo && pAncho) ? glassIconSVG(sides, pLargo, pAncho) : ''
          const txt = pr.replace(/\s*\[[TBLR]+\]/g, '')
          const cu  = procData?.precio_unitario != null ? `$${Number(procData.precio_unitario).toFixed(2)}` : ''
          const tot = procData?.subtotal != null ? `$${Number(procData.subtotal).toFixed(2)}` : ''
          return `<tr><td style="font-size:11px;color:#555;padding-left:14px"><div style="display:flex;align-items:center">${icon}<span>+${txt}</span></div></td><td style="text-align:right;font-size:11px;color:#555">${cu}</td><td style="text-align:right;font-size:11px;color:#555">${tot}</td></tr>`
        }).join('')
        return `<tbody class="pblock"><tr style="${bg}"><td style="font-weight:600">${dimsStr}</td><td></td><td style="text-align:right;font-weight:600">$${Number(p.subtotal_partida).toFixed(2)}</td></tr>${procTrs}</tbody>`
      }
    }
    const cuVal = p.precio_unitario != null
      ? Number(p.precio_unitario)
      : (p.cantidad ? Number(p.subtotal_partida) / Number(p.cantidad) : null)
    const cu  = cuVal != null ? `$${Number(cuVal).toFixed(2)}` : '—'
    return `
      <tbody class="pblock">
      <tr style="${bg}">
        <td style="font-weight:600">${dims}</td>
        <td style="text-align:right">${cu}</td>
        <td style="text-align:right;font-weight:600">$${Number(p.subtotal_partida).toFixed(2)}</td>
      </tr>
      </tbody>`
  }).join('')

  const maquilaSection = maquilas.length === 0 ? '' : `
    <div class="section-title" style="margin-top:16px">Maquila</div>
    <table>
      <thead><tr>
        <th>Descripción</th>
        <th style="text-align:right">C.U.</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      ${maquilaRows}
    </table>`

  const extraProcRows = extrasProc.map((p, idx) => `
    <tbody class="pblock">
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'}">
      <td>${p.descripcion ?? '—'}</td>
      <td style="text-align:center">${p.cantidad ?? 1}</td>
      <td style="text-align:right;font-size:11px">$${Number(p.precio_unitario ?? 0).toFixed(2)}</td>
      <td style="text-align:right;font-weight:600">$${Number(p.subtotal_partida).toFixed(2)}</td>
    </tr>
    </tbody>`).join('')

  const extraProcSection = extrasProc.length === 0 ? '' : `
    <div class="section-title" style="margin-top:16px">Proceso Extra</div>
    <table>
      <thead><tr>
        <th>Proceso</th>
        <th style="text-align:center">Cant</th>
        <th style="text-align:right">P.U.</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      ${extraProcRows}
    </table>`

  const herrajeRows = herrajes.map((p, idx) => `
    <tbody class="pblock">
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'}">
      <td>${p.descripcion ?? '—'}</td>
      <td style="text-align:center">${p.cantidad ?? 1}</td>
      <td style="text-align:right;font-weight:600">$${Number(p.subtotal_partida).toFixed(2)}</td>
    </tr>
    </tbody>`).join('')

  const herrajeSection = herrajes.length === 0 ? '' : `
    <div class="section-title" style="margin-top:16px">Herraje / Producto</div>
    <table>
      <thead><tr>
        <th>Descripción</th>
        <th style="text-align:center">Cant</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      ${herrajeRows}
    </table>`

  const pagoInfo = (() => {
    const fp = detalle.formaPago
    const mp = detalle.metodoPago ? `<div class="pago-row"><span>Método de pago:</span><span class="bold">${detalle.metodoPago.charAt(0) + detalle.metodoPago.slice(1).toLowerCase()}</span></div>` : ''
    if (!fp || fp === 'LIQUIDADO') return `${mp}<div class="pago-row"><span>Método de entrega:</span><span class="bold">Liquidado</span></div>`
    if (fp === 'POR COBRAR') return `${mp}
      <div class="pago-row"><span>Método de entrega:</span><span class="bold">Por cobrar</span></div>
      <div class="pago-row"><span>Saldo por cobrar:</span><span class="bold">$${totalCalculado.toFixed(2)}</span></div>
      <div style="border-top:1px solid #000;width:60%;margin:24px auto 4px"></div>
      <div style="text-align:center;font-size:11px">Firma del cliente</div>`
    if (fp === 'ANTICIPO') return `${mp}
      <div class="pago-row"><span>Método de entrega:</span><span class="bold">Anticipo</span></div>
      <div class="pago-row"><span>Anticipo pagado:</span><span class="bold">$${Number(detalle.anticipo).toFixed(2)}</span></div>
      <div class="pago-row"><span>Saldo pendiente:</span><span class="bold">$${Number(detalle.saldo).toFixed(2)}</span></div>`
    return `${mp}<div class="pago-row"><span>Método de entrega:</span><span class="bold">${fp}</span></div>`
  })()

  const esCot = detalle.tipo === 'cotizacion'
  const esMaquila = (maquilas.length > 0 || extrasProc.length > 0) && vidrios.length === 0
  const titulo = esCot ? 'COTIZACIÓN' : esMaquila ? 'PEDIDO DE MAQUILA' : herrajes.length > 0 && vidrios.length === 0 ? 'PEDIDO DE HERRAJE' : 'PEDIDO DE VIDRIO'
  const pie = esCot ? 'Cotización con vigencia de 15 días. No es un comprobante de pago.'
    : detalle.esEntregado ? '¡Gracias por su compra!' : detalle.formaPago === 'POR COBRAR' ? 'Entregado.' : 'Pendiente de entrega.'
  const folioLabel = esCot ? 'Cotización N°:' : 'Pedido N°:'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo} ${detalle.folio}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; padding: 14px 18px; }
    .brand-header { display: flex; align-items: center; gap: 16px; padding-bottom: 4px; border-bottom: 2px solid #1a3a6b; margin-bottom: 3px; }
    .brand-logo { width: 80px; height: auto; flex-shrink: 0; }
    .brand-name { font-size: 17px; font-weight: 900; letter-spacing: 1px; color: #1a3a6b; }
    .brand-detail { font-size: 11px; color: #555; margin-top: 3px; }
    .doc-info { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
    .doc-titulo { font-size: 14px; font-weight: 700; color: #1a3a6b; }
    .doc-meta { font-size: 10px; color: #555; line-height: 1.25; text-align: right; }
    .doc-meta strong { color: #111; }
    .cliente-box { background: #f4f7fb; border-left: 3px solid #1a3a6b; padding: 3px 8px; border-radius: 0 4px 4px 0; margin-bottom: 5px; }
    .cliente-box .c-nombre { font-size: 12px; font-weight: 700; color: #1a3a6b; }
    .cliente-box .c-detail { color: #555; font-size: 10px; margin-top: 0; }
    .section-title { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #1a3a6b; border-bottom: 2px solid #1a3a6b; padding-bottom: 2px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    thead { display: table-header-group; }
    th { background: #1a3a6b; color: #fff; padding: 7px 9px; font-size: 11px; text-align: left; }
    td { padding: 6px 9px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: top; }
    .total-box { display: flex; justify-content: flex-end; margin: 16px 0; }
    .total-inner { background: #1a3a6b; color: #fff; padding: 10px 22px; border-radius: 7px; font-size: 20px; font-weight: 700; }
    .pago-box { background: #f4f7fb; border: 1px solid #d0daea; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
    .pago-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
    .bold { font-weight: 700; }
    .footer-doc { border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; color: #777; text-align: center; line-height: 1.6; }
    .clausulas-title { text-align: center; font-size: 11.5px; font-weight: 700; letter-spacing: 1px; margin: 10px 0 5px; color: #111; }
    .clausulas-list { list-style: none; padding: 0; margin: 0 0 4px; }
    .clausulas-list li { font-size: 10px; line-height: 1.5; padding-left: 12px; position: relative; }
    .clausulas-list li::before { content: '-'; position: absolute; left: 0; }
    .clausulas-list li.bold { font-weight: 700; }
    .clausulas-closing { font-size: 10px; margin-top: 8px; text-align: center; }
    .deposito-box { background: #f4f7fb; border-left: 3px solid #1a3a6b; padding: 6px 10px; border-radius: 0 5px 5px 0; margin: 8px 0; font-size: 10px; line-height: 1.6; color: #111; }
    .deposito-box .deposito-title { font-weight: 700; color: #1a3a6b; font-size: 10.5px; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <div id="pdf-header-block">
    <div class="brand-header">
      <img src="${logoUrl}" class="brand-logo" alt="Logo">
      <div>
        <div class="brand-name">VIDRIO TEMPLADO Y ALUMINIO ROSALES</div>
        <div class="brand-detail" style="font-style:italic;color:#1565c0;font-weight:600;margin-top:2px">Calidad que se ve, confianza que perdura</div>
        <div class="brand-detail">Rosales #35 C.P. 55270, Granjas Valle de Guadalupe · Ecatepec de Morelos, Estado de Mexico</div>
        <div class="brand-detail">Tel: 5523134256, 5522161432, 5547912671 · rosalesvidriotempladofernando@gmail.com</div>
      </div>
    </div>
  </div>
  <div id="pdf-body-block">
    <div class="pblock">
      <div class="doc-info">
        <div class="doc-titulo">${titulo}</div>
        <div class="doc-meta">
          <div>${folioLabel} <strong>${detalle.folio}</strong></div>
          ${detalle.foliosCot ? `<div>Cotización: <strong>${detalle.foliosCot}</strong></div>` : ''}
          <div>Fecha: <strong>${detalle.fecha}</strong></div>
          ${detalle.hora ? `<div>Hora: <strong>${detalle.hora}</strong></div>` : ''}
        </div>
      </div>

      <div class="cliente-box">
        <div class="c-nombre">${detalle.clienteNombre ?? 'Mostrador'}</div>
        <div class="c-detail">${detalle.nivelNombre ? `Nivel: ${detalle.nivelNombre}` : ''}</div>
        ${detalle.observaciones ? `<div class="c-detail" style="margin-top:2px"><em>Obs: ${detalle.observaciones}</em></div>` : ''}
      </div>
    </div>
    ${vidrioSection}
    ${maquilaSection}
    ${extraProcSection}
    ${herrajeSection}

    ${piezasResumen}
    <div class="total-box pblock">
      <div class="total-inner">TOTAL: $${totalCalculado.toFixed(2)}</div>
    </div>

    ${esCot ? '' : `<div class="pago-box pblock">${pagoInfo}</div>`}

    ${!esCot ? '' : `
    <div class="pblock deposito-box">
      <div class="deposito-title">Ficha de depósito</div>
      <div>Razón social: Fernando Perez Garcia</div>
      <div>Cuenta: 07496757779</div>
      <div>Sucursal: BBVA</div>
      <div>Clave: 012180004796757791</div>
    </div>
    <div class="pblock">
      <div class="clausulas-title">CLAUSULAS</div>
      <ul class="clausulas-list">
        <li class="bold">PARA AGENDAR LA ENTREGA EL PEDIDO DEBE ESTAR LIQUIDADO AL 100% Y QUEDA SUJETA A DISPONIBILIDAD</li>
        <li>ANTICIPACION</li>
        <li>ESTA COTIZACION "INCLUYE/NO INCLUYE" FLETE "GRATUITO"/CON UN COSTO DE $MONTO$"</li>
        <li class="bold">SE LE INFORMARA CON 30 MIN DE ANTICIPACION DE ARRIBO DE LA UNIDAD AL DESTINO FINAL</li>
        <li>SOLO CUENTA CON 10 - 15 MIN LIBRES PARA RECIBIR AL OPERADOR</li>
        <li>SI LA UNIDAD SE POSICIONA Y NO LLEGA A PRESENTARSE PARA RECIBIR SU MATERIAL NO SE LE COBRARA COSTO</li>
        <li>SI REQUIERE ENTREGA CON URGENCIA Y/O HORARIO ESPECIFICO TIENE UN COSTO ADICIONAL</li>
        <li class="bold">NO HAY REEMBOLSOS DE MATERIAL</li>
      </ul>
    </div>
    <div class="pblock">
      <div class="clausulas-title">OBSERVACIONES:</div>
      <ul class="clausulas-list">
        <li>CUALQUIER CAMBIO EN EL N° DE PZAS Y MEDIDAS DEJA INVALIDO ESTE PEDIDO</li>
        <li>EL PEDIDO NO CONSIDERA COLOCACION NI HERRAJES</li>
        <li class="bold">ES RESPONSABILIDAD DEL CLIENTE VERIFICAR Y CONFIRMAR INFORMACION SEA CORRECTA</li>
      </ul>
      <div class="clausulas-closing">ESPERANDO QUE SU PEDIDO SEA DE SU ENTERA SATISFACION, ESTAMOS A SUS ORDENES PARA CUALQUIER DUDA O ACLARACION.</div>
    </div>`}

    <div class="footer-doc pblock">${pie}<br>Vidrio Templado y Aluminio Rosales</div>
    ${detalle.esCancelado
      ? `<div class="pblock" style="margin-top:14px;text-align:center;font-size:13px;font-weight:700;letter-spacing:2px;border:2px solid #991b1b;padding:8px;color:#991b1b">⚠ PEDIDO CANCELADO — REIMPRESIÓN ⚠</div>`
      : detalle.esReimpresion
        ? `<div class="pblock" style="margin-top:14px;text-align:center;font-size:11px;font-weight:700;letter-spacing:2px;border:1.5px dashed #999;padding:6px;color:#555">*** REIMPRESIÓN — PEDIDO ENTREGADO ***</div>`
        : ''}
  </div>
</body>
</html>`

  // Se genera un PDF real (en vez de imprimir el HTML crudo vía iframe) para
  // que el diálogo de impresión de Chrome no le agregue su encabezado/pie
  // nativo con la URL/IP del servidor — eso solo ocurre al imprimir una
  // página HTML, no al imprimir un PDF ya renderizado.
  const contenedor = document.createElement('div')
  contenedor.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;'
  contenedor.innerHTML = html
  document.body.appendChild(contenedor)

  try {
    const scale = 2
    const headerEl = contenedor.querySelector('#pdf-header-block')

    // Cada partida vive en su propio <tbody class="pblock"> (o <div class="pblock">
    // para las secciones sin tabla) — así medimos su posición ANTES de rasterizar,
    // para nunca cortar una partida a la mitad entre dos hojas.
    const pblocks = Array.from(contenedor.querySelectorAll('.pblock'))
    const blockRanges = pblocks.map(el => ({
      top:    Math.round(el.offsetTop * scale),
      bottom: Math.round((el.offsetTop + el.offsetHeight) * scale),
    }))
    const headerPxHeight = Math.round(headerEl.offsetHeight * scale)

    const [canvas, headerCanvas] = await Promise.all([
      html2canvas(contenedor, { scale, useCORS: true, backgroundColor: '#ffffff', logging: false }),
      html2canvas(headerEl,   { scale, useCORS: true, backgroundColor: '#ffffff', logging: false }),
    ])

    const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW  = pdf.internal.pageSize.getWidth()
    const pageH  = pdf.internal.pageSize.getHeight()
    const margin = 8
    const maxW   = pageW - margin * 2

    const pxPerMM    = canvas.width / maxW
    const headerMM   = headerPxHeight / pxPerMM
    const headerGapMM = 4
    const bodyMaxHmm = pageH - margin * 2 - headerMM - headerGapMM
    const bodyMaxHpx = Math.round(bodyMaxHmm * pxPerMM)

    // Si el corte natural cae dentro de una partida, retrocede al inicio de esa
    // partida para que pase completa a la siguiente hoja (a menos que la partida
    // por sí sola ya sea más alta que una hoja — ahí no queda opción).
    const snapCut = (desiredY, minY) => {
      for (const r of blockRanges) {
        if (desiredY > r.top && desiredY < r.bottom) {
          return r.top > minY ? r.top : desiredY
        }
      }
      return desiredY
    }

    // 1a pasada: solo calcula dónde cae cada corte, sin dibujar nada — así
    // sabemos el total de hojas ANTES de dibujar la primera (para "Página X de Y").
    const pageSlices = []
    let cursorY = headerPxHeight
    while (cursorY < canvas.height) {
      let sliceEnd = Math.min(cursorY + bodyMaxHpx, canvas.height)
      sliceEnd = snapCut(sliceEnd, cursorY)
      const sliceH = sliceEnd - cursorY
      if (sliceH <= 0) break
      pageSlices.push({ start: cursorY, end: sliceEnd })
      cursorY = sliceEnd
    }
    const totalPages = pageSlices.length

    // 2a pasada: dibuja cada hoja con su encabezado repetido y el contador de página.
    pageSlices.forEach(({ start, end }, idx) => {
      if (idx > 0) pdf.addPage()
      pdf.addImage(headerCanvas.toDataURL('image/png'), 'PNG', margin, margin, maxW, headerMM)

      const sliceH = end - start
      const slice = document.createElement('canvas')
      slice.width  = canvas.width
      slice.height = sliceH
      slice.getContext('2d').drawImage(canvas, 0, start, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin + headerMM + headerGapMM, maxW, sliceH / pxPerMM)

      if (totalPages > 1) {
        pdf.setFontSize(9)
        pdf.setTextColor(130, 130, 130)
        pdf.text(`Página ${idx + 1} de ${totalPages}`, pageW - margin, pageH - 4, { align: 'right' })
      }
    })

    const nombreArchivo = `${detalle.tipo === 'cotizacion' ? 'Cotizacion' : 'Pedido'}_${detalle.folio ?? ''}.pdf`
    const blobUrl = pdf.output('bloburl')
    const win = window.open(blobUrl, '_blank')
    if (!win) pdf.save(nombreArchivo)
  } finally {
    document.body.removeChild(contenedor)
  }
}

/**
 * Imprime un ticket usando un iframe oculto para evitar bloqueadores de ventanas emergentes.
 * El diálogo de impresión del sistema sigue apareciendo normalmente.
 */
export function printTicket(venta, modo = '80mm') {
  const isCarta = modo === 'carta'

  const html = isCarta ? `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Venta herraje ${venta.folio}</title>
  <style>
    @page { margin: 0; size: A4 portrait; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 12mm 14mm; }
    .brand-header { display: flex; align-items: center; gap: 16px; padding-bottom: 14px; border-bottom: 2px solid #1a3a6b; margin-bottom: 18px; }
    .brand-logo { width: 80px; height: auto; flex-shrink: 0; }
    .brand-name { font-size: 17px; font-weight: 900; letter-spacing: 1px; color: #1a3a6b; }
    .brand-detail { font-size: 11px; color: #555; margin-top: 3px; }
    .doc-info { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .doc-titulo { font-size: 18px; font-weight: 700; color: #1a3a6b; }
    .doc-meta { font-size: 12px; color: #555; line-height: 1.8; text-align: right; }
    .doc-meta strong { color: #111; }
    .section-title { font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #1a3a6b; border-bottom: 2px solid #1a3a6b; padding-bottom: 4px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    th { background: #1a3a6b; color: #fff; padding: 7px 9px; font-size: 11px; text-align: left; }
    td { padding: 6px 9px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: top; }
    .total-box { display: flex; justify-content: flex-end; margin: 16px 0; }
    .total-inner { background: #1a3a6b; color: #fff; padding: 10px 22px; border-radius: 7px; font-size: 20px; font-weight: 700; }
    .footer-doc { border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; color: #777; text-align: center; line-height: 1.6; }
    .politicas { margin-top: 8px; font-size: 10.5px; color: #888; text-align: center; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="brand-header">
    <img src="${logoUrl}" class="brand-logo" alt="Logo">
    <div>
      <div class="brand-name">VIDRIO TEMPLADO Y ALUMINIO ROSALES</div>
      <div class="brand-detail" style="font-style:italic;color:#1565c0;font-weight:600;margin-top:2px">Calidad que se ve, confianza que perdura</div>
      <div class="brand-detail">Rosales #35 C.P. 55270, Granjas Valle de Guadalupe · Ecatepec de Morelos, Estado de Mexico</div>
      <div class="brand-detail">Tel: 5523134256, 5522161432, 5547912671 · rosalesvidriotempladofernando@gmail.com</div>
    </div>
  </div>

  <div class="doc-info">
    <div class="doc-titulo">VENTA DE HERRAJE</div>
    <div class="doc-meta">
      <div>Folio: <strong>${venta.folio}</strong></div>
      <div>Fecha: <strong>${venta.fecha}</strong></div>
      <div>Hora: <strong>${venta.hora}</strong></div>
    </div>
  </div>

  <div class="section-title">Productos</div>
  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th style="text-align:center">Cant</th>
        <th style="text-align:right">Precio u.</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${venta.partidas.map((p, idx) => {
        const tono   = p.tono ? ` · ${p.tono}` : ''
        const precio = Number(p.precioUnitario)
        const total  = precio * p.cantidad
        return `<tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'}">
          <td>${p.descripcion}${tono}</td>
          <td style="text-align:center">${p.cantidad}</td>
          <td style="text-align:right">$${precio.toFixed(2)}</td>
          <td style="text-align:right;font-weight:600">$${total.toFixed(2)}</td>
        </tr>`
      }).join('')}
    </tbody>
  </table>

  <div class="total-box">
    <div class="total-inner">TOTAL: $${Number(venta.total).toFixed(2)}</div>
  </div>

  <div class="footer-doc">
    ¡Gracias por su compra!<br>
    Vidrio Templado y Aluminio Rosales · Tel: 5523134256, 5522161432, 5547912671
  </div>
  <div class="politicas">
    <strong>POLÍTICAS DE DEVOLUCIÓN</strong><br>
    No se devuelve el dinero. Sí se realiza cambio de producto.
  </div>
</body>
</html>` : `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ticket ${venta.folio}</title>
  <style>
    @page { margin: 4mm; size: 80mm auto; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, 'Helvetica Neue', sans-serif; font-size: 13px; width: 72mm; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .divider { border: none; border-top: 1.5px solid #000; margin: 7px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .header { margin-bottom: 10px; }
    .header h1 { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { font-size: 12px; font-weight: 600; color: #000; }
    .partida { margin-bottom: 6px; }
    .total-row { font-size: 15px; font-weight: 700; }
    .footer { margin-top: 10px; font-size: 12px; color: #000; }
  </style>
</head>
<body>
  <div class="header center">
    <h1>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h1>
    <p>Rosales #35 C.P. 55270, Granjas Valle de Guadalupe</p>
    <p>Ecatepec de Morelos, Estado de Mexico</p>
    <p>Tel: 5523134256, 5522161432, 5547912671</p>
    <p>rosalesvidriotempladofernando@gmail.com</p>
    <p class="bold">Pedido herraje</p>
  </div>
  <hr class="divider">
  <div class="row"><span>Folio:</span><span class="bold">${venta.folio}</span></div>
  <div class="row"><span>Fecha:</span><span>${venta.fecha}</span></div>
  <div class="row"><span>Hora:</span><span>${venta.hora}</span></div>
  <hr class="divider">
  ${venta.partidas.map(p => {
    const tono  = p.tono ? ' · ' + p.tono : ''
    const precio = Number(p.precioUnitario).toFixed(2)
    return `<div class="partida bold">${p.cantidad} - ${p.descripcion}${tono} x $${precio}</div>`
  }).join('')}
  <hr class="divider">
  <div class="row total-row">
    <span>TOTAL:</span>
    <span>$${Number(venta.total).toFixed(2)}</span>
  </div>
  <hr class="divider">
  <div class="footer center">¡Gracias por su compra!</div>
  <hr class="divider">
  <div class="footer center" style="font-size:10px;line-height:1.5">
    <strong>POLÍTICAS DE DEVOLUCIÓN</strong><br>
    No se devuelve el dinero.<br>
    Sí se realiza cambio de producto.
  </div>
</body>
</html>`

  // Usar iframe oculto para evitar bloqueadores de popups
  let iframe = document.getElementById('__ticket_print_frame__')
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = '__ticket_print_frame__'
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden'
    document.body.appendChild(iframe)
  }

  iframe.contentDocument.open()
  iframe.contentDocument.write(html)
  iframe.contentDocument.close()

  // Pequeño delay para que el navegador renderice el HTML
  setTimeout(() => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch {
      // Fallback: ventana emergente (por si el navegador bloquea el iframe)
      const win = window.open('', '_blank', 'width=480,height=640')
      if (win) {
        win.document.write(html)
        win.document.close()
        win.focus()
        setTimeout(() => win.print(), 400)
      } else {
        alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.')
      }
    }
  }, 300)
}
