import { r5 } from '../lib/utils'

/**
 * Imprime un ticket de vidrio (cotización o pedido) via iframe.
 * @param {object} detalle - datos del ticket (folio, fecha, hora, clienteNombre, nivelNombre,
 *   tipo, formaPago, anticipo, saldo, saldo_cobrado, esEntregado, total,
 *   partidas[{piezas, clave, largo_cm, ancho_cm, subtotal_vidrio, procesos, subtotal_partida}])
 */
export function printTicketVidrio(detalle) {
  const vidrios  = detalle.partidas.filter(p => !p.tipo || p.tipo === 'VIDRIO')
  const maquilas = detalle.partidas.filter(p => p.tipo === 'MAQUILA')
  const herrajes = detalle.partidas.filter(p => p.tipo === 'HERRAJE' || p.tipo === 'PRODUCTO')
  
  const renderVidrio = p => {
    const pzas   = p.piezas ?? 1
    const cuVid  = r5(Number(p.subtotal_vidrio) / pzas)
    const totVid = cuVid * pzas
    const procRows = (p.procesos ?? []).map(pr => {
      const cuPr  = r5(Number(pr.subtotal) / pzas)
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
      </div>`
  }

  const renderMaquila = p => {
    if (p.largo_cm && Number(p.largo_cm) > 0) {
      const pzas  = p.piezas ?? 1
      const dimStr = `${p.largo_cm}×${p.ancho_cm}cm`
      const clave = (p.clave && p.clave !== dimStr) ? ` · ${p.clave}` : ''
      const procRows = (p.procesos ?? []).map(pr => `
        <div class="row" style="padding-left:10px;font-size:12px">
          <span>+${pr.nombre}</span><span>$${r5(Number(pr.subtotal ?? 0)).toFixed(2)}</span>
        </div>`).join('')
      return `
        <div class="partida">
          <div class="row bold">
            <span>${pzas} · ${p.largo_cm}×${p.ancho_cm}cm${clave}</span>
            <span>$${r5(Number(p.subtotal_partida)).toFixed(2)}</span>
          </div>
          ${procRows}
          ${p.descripcion ? `<div style="font-size:11px;padding-left:10px;margin-bottom:2px">${p.descripcion}</div>` : ''}
          </div>`
    }
    const label = p.descripcion || p.clave || '—'
    const cu    = p.precio_unitario != null ? `$${r5(Number(p.precio_unitario)).toFixed(2)}` : ''
    const tot   = `$${r5(Number(p.subtotal_partida)).toFixed(2)}`
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
        <span class="bold">$${r5(Number(p.subtotal_partida)).toFixed(2)}</span>
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

  const totalCalculado = detalle.partidas.reduce((sum, p) => {
    if (p.tipo === 'MAQUILA' || p.tipo === 'HERRAJE' || p.tipo === 'PRODUCTO') {
      return sum + r5(Number(p.subtotal_partida))
    }
    const pzas = p.piezas ?? 1
    const cuVid = r5(Number(p.subtotal_vidrio || p.subtotal_partida) / pzas)
    const totVid = cuVid * pzas
    const totProc = (p.procesos ?? []).reduce((s, pr) => s + r5(Number(pr.subtotal) / pzas) * pzas, 0)
    return sum + totVid + totProc
  }, 0)

  let rows = ''
  if (vidrios.length)  rows += sectionLbl('Vidrio') + colHeader + vidrios.map(renderVidrio).join('')
  if (maquilas.length) rows += sectionLbl('Maquila') + maqColHeader + maquilas.map(renderMaquila).join('')
  if (herrajes.length) rows += sectionLbl('Herraje') + herrajes.map(renderHerraje).join('')

  const pagoRows = detalle.tipo === 'pedido' ? `
    <hr class="divider">
    <div class="row"><span>Forma de pago:</span><span>${
      detalle.formaPago === 'LIQUIDADO' ? 'Liquidado' :
      detalle.formaPago === 'CREDITO'   ? 'Crédito' :
      detalle.formaPago === 'CONTADO'   ? 'Contado' : 'Anticipo'
    }</span></div>
    ${detalle.formaPago === 'ANTICIPO' ? `
      <div class="row"><span>Anticipo:</span><span class="bold">$${r5(Number(detalle.anticipo)).toFixed(2)}</span></div>
      ${!detalle.esEntregado ? `<div class="row"><span>Saldo pendiente:</span><span class="bold">$${r5(Number(detalle.saldo)).toFixed(2)}</span></div>` : ''}
      ${detalle.esEntregado && detalle.saldo_cobrado != null ? `<div class="row"><span>Saldo cobrado:</span><span class="bold">$${r5(Number(detalle.saldo_cobrado)).toFixed(2)}</span></div>` : ''}
    ` : ''}
    ${detalle.formaPago === 'CREDITO' ? `
  <div class="row"><span>Saldo a crédito:</span><span class="bold">$${totalCalculado.toFixed(2)}</span></div>
  <br><br><br>
  <div style="border-top:1px solid #000;width:70%;margin:0 auto;margin-top:20px;"></div>
  <div style="text-align:center;font-size:11px;margin-top:4px;">Firma del cliente</div>
` : ''}

  ` : ''

  const esMaquila = maquilas.length > 0 && vidrios.length === 0
  const titulo = detalle.tipo === 'pedido'
    ? (esMaquila ? 'Pedido maquila' : 'Pedido vidrio')
    : (esMaquila ? 'Cotizacion maquila' : 'Cotizacion vidrio')
  const folioLabel = detalle.tipo === 'pedido' ? 'Pedido:' : 'Folio:'
  const cotLabel = detalle.tipo === 'pedido' ? `<div class="row"><span>Cotizacion:</span><span>${detalle.foliosCot ?? ''}</span></div>` : ''
  const pie = detalle.esEntregado ? '¡Gracias por su compra!' : detalle.tipo === 'pedido' ? 'Pendiente de entrega.' : 'Cotizacion con vigencia de 15 dias.'

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
    .c-cant { width: 12px; flex-shrink: 0; }
    .c-med  { width: 42px; flex-shrink: 0; }
    .c-desc { flex: 1; }
    .c-cu   { width: 44px; flex-shrink: 0; text-align: right; }
    .c-tot  { width: 48px; flex-shrink: 0; text-align: right; }
    .col-header { font-size: 9px; color: #555; border-bottom: 1px dashed #aaa; margin-bottom: 3px; }
  </style>
</head>
<body>
  <div class="header center">
    <h1>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h1>
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
  <hr class="divider">
  ${rows}
  <hr class="divider">
  <div class="row total-row"><span>TOTAL:</span><span>$${totalCalculado.toFixed(2)}</span></div>
  ${pagoRows}
  <hr class="divider">
  <div class="footer center">${pie}</div>
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
  const extrasTotal = extras.reduce((sum, e) => sum + r5(Number(e.subtotal)), 0)
  const totalCalculado = detalle.partidas.reduce((sum, p) => sum + r5(Number(p.subtotal_partida)), 0) + extrasTotal
  const rows = detalle.partidas.map((p, i) => {
    const cant = p.cantidad ?? 1
    const procRows = (p.procesos ?? []).map(pr => {
      const cantLabel = pr.cantidad && pr.cantidad !== 1 ? ` × ${pr.cantidad}` : ''
      return `<div class="row" style="padding-left:12px;font-size:11px;color:#444">
        <span>+ ${pr.nombre}${cantLabel}</span><span>$${r5(Number(pr.subtotal)).toFixed(2)}</span>
      </div>`
    }).join('')

    return `
      <div class="partida">
        <div class="row" style="margin-bottom:2px">
          <span class="bold" style="font-size:13px">${cant}- ${p.largo_cm}×${p.ancho_cm} ${p.clave_vidrio}</span>
          <span class="bold" style="font-size:13px">$${r5(Number(p.subtotal_partida)).toFixed(2)}</span>
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
      const cu  = e.precio_unitario != null ? `$${r5(Number(e.precio_unitario)).toFixed(2)}` : ''
      const tot = `$${r5(Number(e.subtotal)).toFixed(2)}`
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
  <hr class="divider">
  <div class="row total-row"><span>TOTAL</span><span>$${totalCalculado.toFixed(2)}</span></div>
  <hr class="divider-thin">
  <div class="pago-box">
    <div class="row"><span>Anticipo pagado:</span><span class="bold">$${r5(Number(detalle.anticipo)).toFixed(2)}</span></div>
    <div class="row" style="font-size:14px"><span class="bold">Saldo pendiente:</span><span class="bold">$${(totalCalculado - r5(Number(detalle.anticipo))).toFixed(2)}</span></div>
  </div>
  <hr class="divider-thin">
  <div class="center" style="font-size:11px;margin-top:6px">${detalle.tipo_pago === 'CREDITO' ? 'Entregado.' : 'Pendiente de entrega.'}</div>
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
  const totalCalculado = detalle.partidas.reduce((sum, p) => sum + r5(Number(p.subtotal_partida)), 0)
  const rows = detalle.partidas.map((p) => {
    const pzas = p.piezas ?? 1
    const m2 = (pzas * p.largo_cm * p.ancho_cm / 10000).toFixed(4)
    const procesos = (p.procesos ?? []).map(pr => pr.nombre).join(', ') || '—'
    const precioPza = (Number(p.subtotal_partida) / pzas).toFixed(2)
    return `
      <tr class="partida-row">
        <td style="text-align:center;font-weight:700">${pzas}</td>
        <td><strong>${p.clave}</strong></td>
        <td style="text-align:center;color:#555;font-size:12px">${m2} m²</td>
        <td style="text-align:right;font-size:12px">$${precioPza}</td>
        <td style="text-align:right;font-weight:600">$${r5(Number(p.subtotal_partida)).toFixed(2)}</td>
        <td style="color:#555;font-size:12px">${procesos}</td>
      </tr>`
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

    /* ── Encabezado principal ── */
    .brand-header {
      background: #1a3a6b;
      border-radius: 12px;
      padding: 28px 40px 22px;
      color: #fff;
      text-align: center;
      position: relative;
      margin-bottom: 20px;
    }
    .brand-header .diamond-left,
    .brand-header .diamond-right {
      position: absolute; top: 50%; transform: translateY(-50%);
      width: 60px; height: 90px;
      border: 2px solid rgba(100,160,230,0.5);
      border-radius: 50%;
    }
    .brand-header .diamond-left  { left: 30px; }
    .brand-header .diamond-right { right: 30px; }
    .brand-header .diamond-left::before,
    .brand-header .diamond-right::before {
      content: '';
      position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px;
      border: 1.5px solid rgba(100,160,230,0.35);
      border-radius: 50%;
    }
    .brand-header .top-diamond {
      width: 14px; height: 14px;
      border: 2px solid rgba(100,180,255,0.6);
      transform: rotate(45deg);
      margin: 0 auto 10px;
    }
    .brand-header h1 {
      font-size: 38px; font-weight: 900; letter-spacing: 2px;
      text-transform: uppercase; line-height: 1;
    }
    .brand-header .consorcio {
      font-size: 20px; font-weight: 300; letter-spacing: 12px;
      color: rgba(150,190,255,0.85); margin: 4px 0 10px;
      text-transform: uppercase;
    }
    .brand-header .slogan {
      font-style: italic; font-size: 15px;
      color: rgba(210,230,255,0.8); letter-spacing: 1px;
    }

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

  <!-- Encabezado de marca -->
  <div class="brand-header">
    <div class="diamond-left"></div>
    <div class="diamond-right"></div>
    <div class="top-diamond"></div>
    <h1 style="font-size:26px">VIDRIO TEMPLADO Y ALUMINIO ROSALES</h1>
    <div class="slogan">Rosales #35 C.P. 55270, Granjas Valle de Guadalupe · Ecatepec de Morelos, Estado de Mexico</div>
    <div class="slogan" style="margin-top:4px">Tel: 5523134256, 5522161432, 5547912671 · rosalesvidriotempladofernando@gmail.com</div>
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
        <th>Tipo de vidrio</th>
        <th style="text-align:center">m²</th>
        <th style="text-align:right">Precio/pza</th>
        <th style="text-align:right">Total</th>
        <th>Descripción</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

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
  const vidrios  = detalle.partidas.filter(p => !p.tipo || p.tipo === 'VIDRIO')
  const maquilas = detalle.partidas.filter(p => p.tipo === 'MAQUILA')
  const herrajes = detalle.partidas.filter(p => p.tipo === 'HERRAJE' || p.tipo === 'PRODUCTO')

  const totalCalculado = detalle.partidas.reduce((sum, p) => {
    if (p.tipo === 'MAQUILA' || p.tipo === 'HERRAJE' || p.tipo === 'PRODUCTO') {
      return sum + r5(Number(p.subtotal_partida))
    }
    const pzas  = p.piezas ?? 1
    const cuVid = r5(Number(p.subtotal_vidrio || p.subtotal_partida) / pzas)
    const totProc = (p.procesos ?? []).reduce((s, pr) => s + r5(Number(pr.subtotal) / pzas) * pzas, 0)
    return sum + cuVid * pzas + totProc
  }, 0)

  const vidrioRows = vidrios.map((p, idx) => {
    const pzas    = p.piezas ?? 1
    const cuVid   = r5(Number(p.subtotal_vidrio || p.subtotal_partida) / pzas)
    const totVid  = cuVid * pzas
    const procNombres = (p.procesos ?? []).map(pr => pr.nombre).join(', ') || '—'
    const m2      = ((pzas * Number(p.largo_cm) * Number(p.ancho_cm)) / 10000).toFixed(4)
    return `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'}">
        <td style="text-align:center;font-weight:700">${pzas}</td>
        <td style="font-size:11px">${p.largo_cm}×${p.ancho_cm} cm</td>
        <td style="font-weight:700;color:#1a3a6b">${p.clave ?? ''}</td>
        <td style="text-align:right;font-size:11px">$${cuVid.toFixed(2)}</td>
        <td style="text-align:right;font-weight:600">$${totVid.toFixed(2)}</td>
        <td style="font-size:11px;color:#555">${procNombres}</td>
      </tr>`
  }).join('')

  const vidrioSection = vidrios.length === 0 ? '' : `
    <div class="section-title">Vidrio</div>
    <table>
      <thead><tr>
        <th style="text-align:center">Pzas</th>
        <th>Medida</th>
        <th>Tipo</th>
        <th style="text-align:right">C/u</th>
        <th style="text-align:right">Total</th>
        <th>Descripción</th>
      </tr></thead>
      <tbody>${vidrioRows}</tbody>
    </table>`

  const maquilaRows = maquilas.map((p, idx) => {
    const dotIdx = (p.descripcion ?? '').indexOf(' · ')
    const dims   = dotIdx >= 0 ? p.descripcion.slice(0, dotIdx) : (p.descripcion ?? p.clave ?? '—')
    const procs  = dotIdx >= 0 ? p.descripcion.slice(dotIdx + 3).split(', ').filter(Boolean) : []
    const cuVal  = p.precio_unitario != null
      ? Number(p.precio_unitario)
      : (p.cantidad ? Number(p.subtotal_partida) / Number(p.cantidad) : null)
    const cu  = cuVal != null ? `$${r5(cuVal).toFixed(2)}` : '—'
    const tot = `$${r5(Number(p.subtotal_partida)).toFixed(2)}`
    const procRows = procs.map(pr => `
      <tr>
        <td style="font-size:11px;color:#555;padding-left:12px">+ ${pr}</td>
        <td></td>
        <td></td>
      </tr>`).join('')
    return `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'}">
        <td style="font-weight:600">${dims}</td>
        <td style="text-align:right">${cu}</td>
        <td style="text-align:right;font-weight:600">${tot}</td>
      </tr>${procRows}`
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

  const herrajeRows = herrajes.map((p, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'}">
      <td>${p.descripcion ?? '—'}</td>
      <td style="text-align:center">${p.cantidad ?? 1}</td>
      <td style="text-align:right;font-weight:600">$${r5(Number(p.subtotal_partida)).toFixed(2)}</td>
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
    if (!fp || fp === 'LIQUIDADO') return `<div class="pago-row"><span>Forma de pago:</span><span class="bold">Liquidado</span></div>`
    if (fp === 'CREDITO') return `
      <div class="pago-row"><span>Forma de pago:</span><span class="bold">Crédito</span></div>
      <div class="pago-row"><span>Saldo a crédito:</span><span class="bold">$${totalCalculado.toFixed(2)}</span></div>
      <div style="border-top:1px solid #000;width:60%;margin:24px auto 4px"></div>
      <div style="text-align:center;font-size:11px">Firma del cliente</div>`
    if (fp === 'ANTICIPO') return `
      <div class="pago-row"><span>Forma de pago:</span><span class="bold">Anticipo</span></div>
      <div class="pago-row"><span>Anticipo pagado:</span><span class="bold">$${r5(Number(detalle.anticipo)).toFixed(2)}</span></div>
      <div class="pago-row"><span>Saldo pendiente:</span><span class="bold">$${r5(Number(detalle.saldo)).toFixed(2)}</span></div>`
    return `<div class="pago-row"><span>Forma de pago:</span><span class="bold">${fp}</span></div>`
  })()

  const esMaquila = maquilas.length > 0 && vidrios.length === 0
  const titulo = esMaquila ? 'PEDIDO DE MAQUILA' : herrajes.length > 0 && vidrios.length === 0 ? 'PEDIDO DE HERRAJE' : 'PEDIDO DE VIDRIO'
  const pie = detalle.esEntregado ? '¡Gracias por su compra!' : detalle.formaPago === 'CREDITO' ? 'Entregado.' : 'Pendiente de entrega.'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo} ${detalle.folio}</title>
  <style>
    @page { margin: 0; size: A4 portrait; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 12mm 14mm; }
    .brand-header { background: #1a3a6b; border-radius: 12px; padding: 22px 40px 18px; color: #fff; text-align: center; position: relative; margin-bottom: 18px; }
    .brand-header .oval-l, .brand-header .oval-r { position: absolute; top: 50%; transform: translateY(-50%); width: 52px; height: 80px; border: 2px solid rgba(100,160,230,.45); border-radius: 50%; }
    .brand-header .oval-l { left: 26px; } .brand-header .oval-r { right: 26px; }
    .brand-header .oval-l::before, .brand-header .oval-r::before { content: ''; position: absolute; inset: 8px; border: 1.5px solid rgba(100,160,230,.25); border-radius: 50%; }
    .brand-header .diamond { width: 12px; height: 12px; border: 2px solid rgba(120,180,255,.6); transform: rotate(45deg); margin: 0 auto 8px; }
    .brand-header h1 { font-size: 24px; font-weight: 900; letter-spacing: 2px; }
    .brand-header .slogan { font-style: italic; font-size: 12px; color: rgba(210,230,255,.85); margin-top: 3px; }
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
    <div class="oval-l"></div><div class="oval-r"></div>
    <div class="diamond"></div>
    <h1>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h1>
    <div class="slogan">Rosales #35 C.P. 55270, Granjas Valle de Guadalupe · Ecatepec de Morelos, Estado de Mexico</div>
    <div class="slogan">Tel: 5523134256, 5522161432, 5547912671 · rosalesvidriotempladofernando@gmail.com</div>
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
  </div>

  ${vidrioSection}
  ${maquilaSection}
  ${herrajeSection}

  <div class="total-box">
    <div class="total-inner">TOTAL: $${totalCalculado.toFixed(2)}</div>
  </div>

  <div class="pago-box">${pagoInfo}</div>

  <div class="footer-doc">${pie}<br>Vidrio Templado y Aluminio Rosales · Tel: 5523134256, 5522161432, 5547912671</div>
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
    .brand-header { background: #1a3a6b; border-radius: 12px; padding: 22px 40px 18px; color: #fff; text-align: center; position: relative; margin-bottom: 18px; }
    .brand-header .oval-l, .brand-header .oval-r { position: absolute; top: 50%; transform: translateY(-50%); width: 52px; height: 80px; border: 2px solid rgba(100,160,230,.45); border-radius: 50%; }
    .brand-header .oval-l { left: 26px; } .brand-header .oval-r { right: 26px; }
    .brand-header .oval-l::before, .brand-header .oval-r::before { content: ''; position: absolute; inset: 8px; border: 1.5px solid rgba(100,160,230,.25); border-radius: 50%; }
    .brand-header .diamond { width: 12px; height: 12px; border: 2px solid rgba(120,180,255,.6); transform: rotate(45deg); margin: 0 auto 8px; }
    .brand-header h1 { font-size: 24px; font-weight: 900; letter-spacing: 2px; }
    .brand-header .slogan { font-style: italic; font-size: 12px; color: rgba(210,230,255,.85); margin-top: 3px; }
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
    <div class="oval-l"></div><div class="oval-r"></div>
    <div class="diamond"></div>
    <h1>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h1>
    <div class="slogan">Rosales #35 C.P. 55270, Granjas Valle de Guadalupe · Ecatepec de Morelos, Estado de Mexico</div>
    <div class="slogan">Tel: 5523134256, 5522161432, 5547912671 · rosalesvidriotempladofernando@gmail.com</div>
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
        const precio = r5(Number(p.precioUnitario))
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
    <div class="total-inner">TOTAL: $${r5(Number(venta.total)).toFixed(2)}</div>
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
    const precio = r5(Number(p.precioUnitario)).toFixed(2)
    return `<div class="partida bold">${p.cantidad} - ${p.descripcion}${tono} x $${precio}</div>`
  }).join('')}
  <hr class="divider">
  <div class="row total-row">
    <span>TOTAL:</span>
    <span>$${r5(Number(venta.total)).toFixed(2)}</span>
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
