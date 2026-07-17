import logoUrl from '../assets/images/logoVR_b64.txt?raw'

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
      return `
      <div class="row5" style="padding-left:10px;font-size:11px">
        <span class="c-cant"></span>
        <span class="c-med"></span>
        <span class="c-desc">+ ${pr.nombre}</span>
        <span class="c-cu">$${cuPr.toFixed(2)}</span>
        <span class="c-tot">$${totPr.toFixed(2)}</span>
      </div>`
    }).join('')
    const subtotalRow = hasProc ? `
      <div class="row5" style="font-size:11px;font-weight:600;border-top:1px dashed #ccc;margin-top:2px;padding-top:2px">
        <span class="c-cant"></span>
        <span class="c-med"></span>
        <span class="c-desc">Subtotal</span>
        <span class="c-cu">$${(exactSubtotal / pzas).toFixed(2)}</span>
        <span class="c-tot">$${exactSubtotal.toFixed(2)}</span>
      </div>` : ''
    return `
      <div class="partida">
        <div class="row5 bold">
          <span class="c-cant">${pzas}</span>
          <span class="c-med">${p.largo_cm}×${p.ancho_cm}</span>
          <span class="c-desc">${p.clave}</span>
          <span class="c-cu">$${cuVid.toFixed(2)}</span>
          <span class="c-tot">$${totVid.toFixed(2)}</span>
        </div>
        ${procRows}
        ${subtotalRow}
      </div>`
  }

  const renderMaquila = p => {
    if (p.largo_cm && Number(p.largo_cm) > 0) {
      const pzas  = p.piezas ?? 1
      const dimStr = `${p.largo_cm}×${p.ancho_cm}cm`
      const clave = (p.clave && p.clave !== dimStr) ? ` · ${p.clave}` : ''
      const procRows = (p.procesos ?? []).map(pr => {
        const cu = pr.precio_unitario != null ? ` · $${Number(pr.precio_unitario).toFixed(2)}` : ''
        return `
        <div class="row" style="padding-left:10px;font-size:12px">
          <span>+${pr.nombre}${cu}</span><span>$${Number(pr.subtotal ?? 0).toFixed(2)}</span>
        </div>`
      }).join('')
      return `
        <div class="partida">
          <div class="row bold">
            <span>${pzas} · ${p.largo_cm}×${p.ancho_cm}cm${clave}</span>
            <span>$${Number(p.subtotal_partida).toFixed(2)}</span>
          </div>
          ${procRows}
          ${p.descripcion ? `<div style="font-size:11px;padding-left:10px;margin-bottom:2px">${p.descripcion}</div>` : ''}
          </div>`
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
        const sides = notasProcs[i]?.sidesML
        const allSides = sides?.top && sides?.bottom && sides?.left && sides?.right
        const icon = (sides && !allSides && pLargo && pAncho) ? glassIconSVG(sides, pLargo, pAncho) : ''
        const txt = icon ? pr.replace(/\s*\[[TBLR]+\]/g, '') : pr
        return `<div style="display:flex;align-items:center;padding-left:10px;font-size:11px;margin-bottom:1px">${icon}<span>+${txt}</span></div>`
      }).join('')
      return `
        <div class="partida">
          <div class="row bold"><span>${dimsStr}</span><span>$${Number(p.subtotal_partida).toFixed(2)}</span></div>
          ${procRows}
        </div>`
    }
    const cu  = p.precio_unitario != null ? `$${Number(p.precio_unitario).toFixed(2)}` : ''
    const tot = `$${Number(p.subtotal_partida).toFixed(2)}`
    return `
      <div class="partida">
        <div style="display:flex;align-items:baseline;font-size:11px;margin-bottom:2px;gap:2px">
          <span style="width:18px;flex-shrink:0"></span>
          <span style="flex:1">${label}</span>
          <span style="width:50px;flex-shrink:0;text-align:right">${cu}</span>
          <span style="width:50px;flex-shrink:0;text-align:right;font-weight:700">${tot}</span>
        </div>
      </div>`
  }

  const renderHerraje = p => `
    <div class="partida">
      <div class="row">
        <span>${p.cantidad ?? 1} · ${p.descripcion ?? ''}</span>
        <span class="bold">$${Number(p.subtotal_partida).toFixed(2)}</span>
      </div>
    </div>`

  const sectionLbl = text => `<div class="section-lbl">${text}</div>`

  const colHeader = `<div class="row5 col-header">
    <span class="c-cant">Cant</span>
    <span class="c-med">Medida</span>
    <span class="c-desc">Descripción</span>
    <span class="c-cu">c/u</span>
    <span class="c-tot">Total</span>
  </div>`

  const maqColHeader = `<div style="display:flex;align-items:baseline;font-size:9px;color:#555;border-bottom:1px dashed #aaa;margin-bottom:3px;gap:2px">
    <span style="width:18px;flex-shrink:0"></span>
    <span style="flex:1;padding-left:4px">Descripción</span>
    <span style="width:50px;flex-shrink:0;text-align:right">C.U.</span>
    <span style="width:50px;flex-shrink:0;text-align:right">Total</span>
  </div>`

  const totalCalculado = detalle.partidas.reduce((sum, p) => sum + Number(p.subtotal_partida), 0)

  const totalPzasVidrio  = vidrios.reduce((s, p) => s + Number(p.piezas ?? p.cantidad ?? 1), 0)
  const totalPzasMaquila = maquilas.reduce((s, p) => s + Number(p.piezas ?? p.cantidad ?? 1), 0)
  const piezasResumen = [
    totalPzasVidrio  > 0 ? `<div class="row" style="font-size:11px;color:#555"><span>Piezas vendidas:</span><span><strong>${totalPzasVidrio}</strong></span></div>`  : '',
    totalPzasMaquila > 0 ? `<div class="row" style="font-size:11px;color:#555"><span>Piezas maquila recibidas:</span><span><strong>${totalPzasMaquila}</strong></span></div>` : '',
  ].join('')

  let rows = ''
  if (vidrios.length)    rows += sectionLbl('Vidrio') + colHeader + vidrios.map(renderVidrio).join('')
  if (maquilas.length)   rows += sectionLbl('Maquila') + maqColHeader + maquilas.map(renderMaquila).join('')
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
    .row5 { display: flex; align-items: baseline; margin-bottom: 3px; font-size: 11px; }
    .c-cant { width: 22px; flex-shrink: 0; }
    .c-med  { width: 54px; flex-shrink: 0; }
    .c-desc { flex: 1; padding-left: 4px; }
    .c-cu   { width: 42px; flex-shrink: 0; text-align: right; }
    .c-tot  { width: 46px; flex-shrink: 0; text-align: right; }
    .col-header { font-size: 9px; color: #555; border-bottom: 1px dashed #aaa; margin-bottom: 3px; }
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
  ${piezasResumen}
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
  const extras = detalle.extras ?? []
  const extrasTotal = extras.reduce((sum, e) => sum + Number(e.subtotal), 0)
  const totalCalculado = detalle.partidas.reduce((sum, p) => {
    const procSubtotal = (p.procesos ?? []).reduce((s, pr) => s + Number(pr.subtotal), 0)
    return sum + Number(p.subtotal_vidrio ?? p.subtotal_partida) + procSubtotal
  }, 0) + extrasTotal
  const totalPzasVidrio  = detalle.partidas.reduce((s, p) => s + Number(p.cantidad ?? 1), 0)
  const totalPzasMaquila = extras.filter(e => e.tipo === 'MAQUILA').reduce((s, e) => s + Number(e.cantidad ?? 1), 0)
  const piezasResumen = [
    totalPzasVidrio  > 0 ? `<div class="row" style="font-size:11px;color:#555"><span>Piezas vendidas:</span><span><strong>${totalPzasVidrio}</strong></span></div>`  : '',
    totalPzasMaquila > 0 ? `<div class="row" style="font-size:11px;color:#555"><span>Piezas maquila recibidas:</span><span><strong>${totalPzasMaquila}</strong></span></div>` : '',
  ].join('')
  const rows = detalle.partidas.map((p, i) => {
    const cant = p.cantidad ?? 1
    const procSubtotal = (p.procesos ?? []).reduce((s, pr) => s + Number(pr.subtotal), 0)
    const exactSubtotal = Number(p.subtotal_vidrio ?? p.subtotal_partida) + procSubtotal
    const procRows = (p.procesos ?? []).map(pr => {
      const cantLabel = pr.cantidad && pr.cantidad !== 1 ? ` × ${pr.cantidad}` : ''
      return `<div class="row" style="padding-left:12px;font-size:11px;color:#444">
        <span>+ ${pr.nombre}${cantLabel}</span><span>$${Number(pr.subtotal).toFixed(2)}</span>
      </div>`
    }).join('')

    return `
      <div class="partida">
        <div class="row" style="margin-bottom:2px">
          <span class="bold" style="font-size:13px">${cant}- ${p.largo_cm}×${p.ancho_cm} ${p.clave_vidrio}</span>
          <span class="bold" style="font-size:13px">$${exactSubtotal.toFixed(2)}</span>
        </div>
        <div style="font-size:11px;color:#444;margin-bottom:3px;padding-left:12px">
          ${p.clave_vidrio}${p.descripcion_vidrio ? ' — ' + p.descripcion_vidrio : ''} · ${Number(p.metros2).toFixed(4)} m²
        </div>
        ${procRows}
      </div>`
  }).join('<div style="border-top:1px dashed #ccc;margin:5px 0"></div>')

  const extrasHtml = extras.length === 0 ? '' : `
    <div style="font-weight:700;font-size:11px;margin:8px 0 3px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px dashed #888;padding-bottom:2px">
      Maquila / Extras
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
    <p>Rosales #35 C.P. 55270, Granjas Valle de Guadalupe</p>
    <p>Ecatepec de Morelos, Estado de Mexico</p>
    <p>Tel: 5523134256, 5522161432, 5547912671</p>
    <p>rosalesvidriotempladofernando@gmail.com</p>
    <p>${extras.length > 0 && detalle.partidas.length === 0 ? 'Pedido maquila' : 'Pedido vidrio'}</p>
  </div>
  <hr class="divider">
  <div class="row"><span>Pedido:</span><span class="bold">${detalle.folio}</span></div>
  ${detalle.id_cotizacion ? `<div class="row"><span>Cotizacion:</span><span>COT-${String(detalle.id_cotizacion).padStart(5,'0')}</span></div>` : ''}
  <div class="row"><span>Fecha:</span><span>${detalle.fecha}</span></div>
  ${detalle.hora ? `<div class="row"><span>Hora:</span><span>${detalle.hora}</span></div>` : ''}
  <div class="row"><span>Cliente:</span><span class="bold">${detalle.cliente?.nombre ?? 'Mostrador'}</span></div>
  ${detalle.nivel?.nombre ? `<div class="row"><span>Nivel:</span><span>${detalle.nivel.nombre}</span></div>` : ''}
  <hr class="divider">
  ${detalle.partidas.length > 0 ? `<div style="font-weight:700;font-size:11px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px dashed #888;padding-bottom:2px">Vidrio</div>${rows}` : ''}
  ${extrasHtml}
  ${piezasResumen}
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
export function printPedidoA4(detalle) {
  const vidrios    = detalle.partidas.filter(p => !p.tipo || p.tipo === 'VIDRIO')
  const maquilas   = detalle.partidas.filter(p => p.tipo === 'MAQUILA')
  const extrasProc = detalle.partidas.filter(p => p.tipo === 'EXTRA')
  const herrajes   = detalle.partidas.filter(p => p.tipo === 'HERRAJE' || p.tipo === 'PRODUCTO')

  const totalCalculado = detalle.partidas.reduce((sum, p) => sum + Number(p.subtotal_partida), 0)

  const totalPzasVidrio  = vidrios.reduce((s, p) => s + Number(p.piezas ?? p.cantidad ?? 1), 0)
  const totalPzasMaquila = maquilas.reduce((s, p) => s + Number(p.piezas ?? p.cantidad ?? 1), 0)
  const piezasResumen = (totalPzasVidrio > 0 || totalPzasMaquila > 0) ? `
    <div style="display:flex;gap:24px;font-size:12px;color:#444;margin-bottom:8px;margin-top:4px">
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
    return `
      <tr style="background:${bg}">
        <td style="text-align:center;font-weight:700">${pzas}</td>
        <td style="font-size:11px">${p.largo_cm}×${p.ancho_cm} cm · ${m2} m²</td>
        <td style="font-weight:700;color:#1a3a6b">${p.clave ?? ''}</td>
        <td style="text-align:right;font-size:11px">$${cuVid.toFixed(2)}</td>
        <td style="text-align:right;font-weight:600">$${totVid.toFixed(2)}</td>
        <td></td>
      </tr>
      ${procSubRows}
      ${subtotalSubRow}`
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
      <tbody>${vidrioRows}</tbody>
    </table>`

  const maquilaRows = maquilas.map((p, idx) => {
    const hasDims = p.largo_cm && Number(p.largo_cm) > 0
    const dims = hasDims
      ? `${p.piezas ?? p.cantidad ?? 1} · ${p.largo_cm}×${p.ancho_cm}cm${p.descripcion ? ' · ' + p.descripcion : ''}`
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
      return `
      <tr style="${bg}">
        <td style="font-weight:600">${dims}</td>
        <td></td>
        <td style="text-align:right;font-weight:600">$${Number(p.subtotal_partida).toFixed(2)}</td>
      </tr>${procRows}`
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
          const sides = notasProcs[i]?.sidesML
          const allSides = sides?.top && sides?.bottom && sides?.left && sides?.right
          const icon = (sides && !allSides && pLargo && pAncho) ? glassIconSVG(sides, pLargo, pAncho) : ''
          const txt = icon ? pr.replace(/\s*\[[TBLR]+\]/g, '') : pr
          return `<tr><td style="font-size:11px;color:#555;padding-left:14px"><div style="display:flex;align-items:center">${icon}<span>+${txt}</span></div></td><td></td><td></td></tr>`
        }).join('')
        return `<tr style="${bg}"><td style="font-weight:600">${dimsStr}</td><td></td><td style="text-align:right;font-weight:600">$${Number(p.subtotal_partida).toFixed(2)}</td></tr>${procTrs}`
      }
    }
    const cuVal = p.precio_unitario != null
      ? Number(p.precio_unitario)
      : (p.cantidad ? Number(p.subtotal_partida) / Number(p.cantidad) : null)
    const cu  = cuVal != null ? `$${Number(cuVal).toFixed(2)}` : '—'
    return `
      <tr style="${bg}">
        <td style="font-weight:600">${dims}</td>
        <td style="text-align:right">${cu}</td>
        <td style="text-align:right;font-weight:600">$${Number(p.subtotal_partida).toFixed(2)}</td>
      </tr>`
  }).join('')

  const maquilaSection = maquilas.length === 0 ? '' : `
    <div class="section-title" style="margin-top:16px">Maquila</div>
    <table>
      <thead><tr>
        <th>Descripción</th>
        <th style="text-align:right">C.U.</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${maquilaRows}</tbody>
    </table>`

  const extraProcRows = extrasProc.map((p, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'}">
      <td>${p.descripcion ?? '—'}</td>
      <td style="text-align:center">${p.cantidad ?? 1}</td>
      <td style="text-align:right;font-size:11px">$${Number(p.precio_unitario ?? 0).toFixed(2)}</td>
      <td style="text-align:right;font-weight:600">$${Number(p.subtotal_partida).toFixed(2)}</td>
    </tr>`).join('')

  const extraProcSection = extrasProc.length === 0 ? '' : `
    <div class="section-title" style="margin-top:16px">Proceso Extra</div>
    <table>
      <thead><tr>
        <th>Proceso</th>
        <th style="text-align:center">Cant</th>
        <th style="text-align:right">P.U.</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${extraProcRows}</tbody>
    </table>`

  const herrajeRows = herrajes.map((p, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'}">
      <td>${p.descripcion ?? '—'}</td>
      <td style="text-align:center">${p.cantidad ?? 1}</td>
      <td style="text-align:right;font-weight:600">$${Number(p.subtotal_partida).toFixed(2)}</td>
    </tr>`).join('')

  const herrajeSection = herrajes.length === 0 ? '' : `
    <div class="section-title" style="margin-top:16px">Herraje / Producto</div>
    <table>
      <thead><tr>
        <th>Descripción</th>
        <th style="text-align:center">Cant</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${herrajeRows}</tbody>
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

  const esMaquila = (maquilas.length > 0 || extrasProc.length > 0) && vidrios.length === 0
  const titulo = esMaquila ? 'PEDIDO DE MAQUILA' : herrajes.length > 0 && vidrios.length === 0 ? 'PEDIDO DE HERRAJE' : 'PEDIDO DE VIDRIO'
  const pie = detalle.esEntregado ? '¡Gracias por su compra!' : detalle.formaPago === 'POR COBRAR' ? 'Entregado.' : 'Pendiente de entrega.'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo} ${detalle.folio}</title>
  <style>
    @page { margin: 0; size: A4 portrait; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 12mm 14mm; }
    .brand-header { display: flex; align-items: center; gap: 16px; padding-bottom: 14px; border-bottom: 2px solid #1a3a6b; margin-bottom: 18px; }
    .brand-logo { width: 80px; height: auto; flex-shrink: 0; }
    .brand-name { font-size: 17px; font-weight: 900; letter-spacing: 1px; color: #1a3a6b; }
    .brand-detail { font-size: 11px; color: #555; margin-top: 3px; }
    .doc-info { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
    .doc-titulo { font-size: 18px; font-weight: 700; color: #1a3a6b; }
    .doc-meta { font-size: 12px; color: #555; line-height: 1.8; text-align: right; }
    .doc-meta strong { color: #111; }
    .cliente-box { background: #f4f7fb; border-left: 4px solid #1a3a6b; padding: 10px 14px; border-radius: 0 6px 6px 0; margin-bottom: 16px; }
    .cliente-box .c-nombre { font-size: 15px; font-weight: 700; color: #1a3a6b; }
    .cliente-box .c-detail { color: #555; font-size: 12px; margin-top: 3px; }
    .section-title { font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #1a3a6b; border-bottom: 2px solid #1a3a6b; padding-bottom: 4px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    th { background: #1a3a6b; color: #fff; padding: 7px 9px; font-size: 11px; text-align: left; }
    td { padding: 6px 9px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: top; }
    .total-box { display: flex; justify-content: flex-end; margin: 16px 0; }
    .total-inner { background: #1a3a6b; color: #fff; padding: 10px 22px; border-radius: 7px; font-size: 20px; font-weight: 700; }
    .pago-box { background: #f4f7fb; border: 1px solid #d0daea; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
    .pago-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
    .bold { font-weight: 700; }
    .footer-doc { border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; color: #777; text-align: center; line-height: 1.6; }
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
    <div class="doc-titulo">${titulo}</div>
    <div class="doc-meta">
      <div>Pedido N°: <strong>${detalle.folio}</strong></div>
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

  ${vidrioSection}
  ${maquilaSection}
  ${extraProcSection}
  ${herrajeSection}

  ${piezasResumen}
  <div class="total-box">
    <div class="total-inner">TOTAL: $${totalCalculado.toFixed(2)}</div>
  </div>

  <div class="pago-box">${pagoInfo}</div>

  <div class="footer-doc">${pie}<br>Vidrio Templado y Aluminio Rosales · Tel: 5523134256, 5522161432, 5547912671</div>
  ${detalle.esCancelado
    ? `<div style="margin-top:14px;text-align:center;font-size:13px;font-weight:700;letter-spacing:2px;border:2px solid #991b1b;padding:8px;color:#991b1b">⚠ PEDIDO CANCELADO — REIMPRESIÓN ⚠</div>`
    : detalle.esReimpresion
      ? `<div style="margin-top:14px;text-align:center;font-size:11px;font-weight:700;letter-spacing:2px;border:1.5px dashed #999;padding:6px;color:#555">*** REIMPRESIÓN — PEDIDO ENTREGADO ***</div>`
      : ''}
</body>
</html>`

  let iframe = document.getElementById('__pedido_a4_frame__')
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = '__pedido_a4_frame__'
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden'
    document.body.appendChild(iframe)
  }
  iframe.contentDocument.open()
  iframe.contentDocument.write(html)
  iframe.contentDocument.close()
  setTimeout(() => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print() }
    catch {
      const win = window.open('', '_blank', 'width=820,height=1060')
      if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 400) }
    }
  }, 350)
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
