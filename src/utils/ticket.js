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
    const pzas = p.piezas ?? 1
    const procRows = (p.procesos ?? []).map(pr => `
      <div class="row" style="padding-left:10px;font-size:12px">
        <span>+ ${pr.nombre}</span><span>$${r5(Number(pr.subtotal)).toFixed(2)}</span>
      </div>`).join('')
    const subRow = (p.procesos?.length > 0) ? `
      <div class="row bold" style="font-size:12px">
        <span>Subtotal partida</span><span>$${r5(Number(p.subtotal_partida)).toFixed(2)}</span>
      </div>` : ''
    return `
      <div class="partida">
        <div class="row bold">
          <span>${pzas} · ${p.largo_cm}×${p.ancho_cm} · ${p.clave}</span>
          <span>$${r5(Number(p.subtotal_vidrio)).toFixed(2)}</span>
        </div>
        ${procRows}${subRow}
      </div>`
  }

  const renderMaquila = p => {
    if (p.largo_cm && Number(p.largo_cm) > 0) {
      const pzas  = p.piezas ?? 1
      const clave = p.clave ? ` · ${p.clave}` : ''
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
          ${p.descripcion ? `<div style="font-size:11px;padding-left:10px;margin-bottom:2px">${p.descripcion}</div>` : ''}
          ${procRows}
        </div>`
    }
    return `
      <div class="partida">
        <div class="row">
          <span>${p.cantidad ?? 1} ${p.unidad ?? ''} — ${p.descripcion ?? ''}</span>
          <span class="bold">$${r5(Number(p.subtotal_partida)).toFixed(2)}</span>
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

  let rows = ''
  if (vidrios.length)  rows += sectionLbl('Vidrio')  + vidrios.map(renderVidrio).join('')
  if (maquilas.length) rows += sectionLbl('Maquila') + maquilas.map(renderMaquila).join('')
  if (herrajes.length) rows += sectionLbl('Herraje') + herrajes.map(renderHerraje).join('')

  const pagoRows = detalle.tipo === 'pedido' ? `
    <hr class="divider">
    <div class="row"><span>Forma de pago:</span><span>${detalle.formaPago === 'LIQUIDADO' ? 'Liquidado' : 'Anticipo'}</span></div>
    ${detalle.formaPago === 'ANTICIPO' ? `
      <div class="row"><span>Anticipo:</span><span class="bold">$${r5(Number(detalle.anticipo)).toFixed(2)}</span></div>
      ${!detalle.esEntregado ? `<div class="row"><span>Saldo pendiente:</span><span class="bold">$${r5(Number(detalle.saldo)).toFixed(2)}</span></div>` : ''}
      ${detalle.esEntregado && detalle.saldo_cobrado != null ? `<div class="row"><span>Saldo cobrado:</span><span class="bold">$${r5(Number(detalle.saldo_cobrado)).toFixed(2)}</span></div>` : ''}
    ` : ''}
  ` : ''

  const titulo = detalle.tipo === 'pedido' ? 'Pedido vidrio' : 'Cotizacion vidrio'
  const folioLabel = detalle.tipo === 'pedido' ? 'Pedido:' : 'Folio:'
  const cotLabel = detalle.tipo === 'pedido' ? `<div class="row"><span>Cotizacion:</span><span>${detalle.foliosCot ?? ''}</span></div>` : ''
  const pie = detalle.esEntregado ? '¡Gracias por su compra!' : detalle.tipo === 'pedido' ? 'Pedido pendiente de entrega.' : 'Cotizacion con vigencia de 15 dias.'

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
  </style>
</head>
<body>
  <div class="header center">
    <h1>TEMPLADOS CONSORCIO</h1>
    <p>ARTE EN VIDRIO</p>
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
  <div class="row total-row"><span>TOTAL:</span><span>$${r5(Number(detalle.total)).toFixed(2)}</span></div>
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
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:8px">
    <div style="font-size:16px;font-weight:900;letter-spacing:1px">TEMPLADOS CONSORCIO</div>
    <div style="font-size:11px;font-weight:600">ARTE EN VIDRIO</div>
    <div style="font-size:12px;font-weight:700;margin-top:3px">PEDIDO PENDIENTE</div>
  </div>
  <hr class="divider">
  <div class="row"><span>Pedido:</span><span class="bold">${detalle.folio}</span></div>
  <div class="row"><span>Fecha:</span><span>${detalle.fecha}</span></div>
  <div class="row"><span>Cliente:</span><span class="bold">${detalle.cliente?.nombre ?? 'Mostrador'}</span></div>
  ${detalle.nivel?.nombre ? `<div class="row"><span>Nivel:</span><span>${detalle.nivel.nombre}</span></div>` : ''}
  <hr class="divider">
  <div style="font-weight:700;font-size:11px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">
    Partidas (${detalle.partidas.length})
  </div>
  ${rows}
  <hr class="divider">
  <div class="row total-row"><span>TOTAL</span><span>$${r5(Number(detalle.total)).toFixed(2)}</span></div>
  <hr class="divider-thin">
  <div class="pago-box">
    <div class="row"><span>Anticipo pagado:</span><span class="bold">$${r5(Number(detalle.anticipo)).toFixed(2)}</span></div>
    <div class="row" style="font-size:14px"><span class="bold">Saldo pendiente:</span><span class="bold">$${r5(Number(detalle.saldo)).toFixed(2)}</span></div>
  </div>
  <hr class="divider-thin">
  <div class="center" style="font-size:11px;margin-top:6px">Pendiente de entrega.</div>
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
  const rows = detalle.partidas.map((p) => {
    const pzas = p.piezas ?? 1
    const m2 = (pzas * p.largo_cm * p.ancho_cm / 10000).toFixed(4)
    const procesos = (p.procesos ?? []).map(pr => pr.nombre).join(', ') || '—'
    const precioPza = (Number(p.subtotal_partida) / pzas).toFixed(2)
    return `
      <tr class="partida-row">
        <td style="text-align:center;font-weight:700">${pzas}</td>
        <td><strong>${p.clave}</strong></td>
        <td style="color:#555;font-size:12px">${procesos}</td>
        <td style="text-align:center;color:#555;font-size:12px">${m2} m²</td>
        <td style="text-align:right;font-size:12px">$${precioPza}</td>
        <td style="text-align:right;font-weight:600">$${r5(Number(p.subtotal_partida)).toFixed(2)}</td>
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
    @page { margin: 12mm 14mm; size: letter portrait; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

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
    <h1>TEMPLADOS</h1>
    <div class="consorcio">C O N S O R C I O</div>
    <div class="slogan">Arte en Vidrio</div>
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
        <th>Procesos</th>
        <th style="text-align:center">m²</th>
        <th style="text-align:right">Precio/pza</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <!-- Total -->
  <div class="total-box">
    <div class="total-inner">TOTAL: $${r5(Number(detalle.total)).toFixed(2)}</div>
  </div>

  <!-- Pie -->
  <div class="footer-doc">
    ${pie}<br>
    Templados Consorcio · Arte en Vidrio
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
 * Imprime un ticket usando un iframe oculto para evitar bloqueadores de ventanas emergentes.
 * El diálogo de impresión del sistema sigue apareciendo normalmente.
 */
export function printTicket(venta, modo = '80mm') {
  const isCarta = modo === 'carta'
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ticket ${venta.folio}</title>
  <style>
    @page { margin: ${isCarta ? '15mm' : '4mm'}; size: ${isCarta ? 'letter' : '80mm auto'}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${isCarta ? "'Segoe UI', Arial, sans-serif" : "Arial, 'Helvetica Neue', sans-serif"};
      font-size: ${isCarta ? '13px' : '13px'};
      width: ${isCarta ? '100%' : '72mm'};
      max-width: ${isCarta ? '700px' : '72mm'};
      margin: 0 auto;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .right { text-align: right; }
    .divider { border: none; border-top: 1.5px solid #000; margin: 7px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .header { margin-bottom: 10px; }
    .header h1 { font-size: ${isCarta ? '22px' : '16px'}; font-weight: 700; letter-spacing: 0.5px; }
    .header p { font-size: ${isCarta ? '13px' : '12px'}; font-weight: 600; color: #000; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th { border-bottom: 1.5px solid #000; padding: 4px 5px; font-size: ${isCarta ? '12px' : '11px'}; text-align: left; font-weight: 700; }
    td { padding: 4px 5px; vertical-align: top; font-size: ${isCarta ? '12px' : '12px'}; }
    .partida { margin-bottom: 6px; }
    .total-row { font-size: ${isCarta ? '17px' : '15px'}; font-weight: 700; }
    .footer { margin-top: 10px; font-size: 12px; color: #000; }
  </style>
</head>
<body>
  <div class="header center">
    <h1>TEMPLADOS CONSORCIO</h1>
    <p class="bold">ARTE EN VIDRIO</p>
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
