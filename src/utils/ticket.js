/**
 * Imprime un ticket de vidrio (cotización o pedido) via iframe.
 * @param {object} detalle - datos del ticket (folio, fecha, hora, clienteNombre, nivelNombre,
 *   tipo, formaPago, anticipo, saldo, saldo_cobrado, esEntregado, total,
 *   partidas[{piezas, clave, largo_cm, ancho_cm, subtotal_vidrio, procesos, subtotal_partida}])
 */
export function printTicketVidrio(detalle) {
  const rows = detalle.partidas.map(p => {
    const pzas = p.piezas ?? 1
    const procRows = (p.procesos ?? []).map(pr => `
      <div class="row" style="padding-left:10px;font-size:12px">
        <span>+ ${pr.nombre}</span><span>$${Number(pr.subtotal).toFixed(2)}</span>
      </div>`).join('')
    const subRow = (p.procesos?.length > 0) ? `
      <div class="row bold" style="font-size:12px">
        <span>Subtotal</span><span>$${Number(p.subtotal_partida).toFixed(2)}</span>
      </div>` : ''
    return `
      <div class="partida">
        <div class="row bold">
          <span>${pzas} pza${pzas > 1 ? 's' : ''} — ${p.clave} · ${p.largo_cm}×${p.ancho_cm}</span>
          <span>$${Number(p.subtotal_vidrio).toFixed(2)}</span>
        </div>
        ${procRows}${subRow}
      </div>`
  }).join('')

  const pagoRows = detalle.tipo === 'pedido' ? `
    <hr class="divider">
    <div class="row"><span>Forma de pago:</span><span>${detalle.formaPago === 'LIQUIDADO' ? 'Liquidado' : 'Anticipo'}</span></div>
    ${detalle.formaPago === 'ANTICIPO' ? `
      <div class="row"><span>Anticipo:</span><span class="bold">$${Number(detalle.anticipo).toFixed(2)}</span></div>
      ${!detalle.esEntregado ? `<div class="row"><span>Saldo pendiente:</span><span class="bold">$${Number(detalle.saldo).toFixed(2)}</span></div>` : ''}
      ${detalle.esEntregado && detalle.saldo_cobrado != null ? `<div class="row"><span>Saldo cobrado:</span><span class="bold">$${Number(detalle.saldo_cobrado).toFixed(2)}</span></div>` : ''}
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
    .partida { margin-bottom: 8px; }
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
  <div class="row"><span>Hora:</span><span>${detalle.hora ?? ''}</span></div>
  <div class="row"><span>Cliente:</span><span>${detalle.clienteNombre ?? 'Mostrador'}</span></div>
  <div class="row"><span>Nivel:</span><span>${detalle.nivelNombre ?? ''}</span></div>
  <hr class="divider">
  ${rows}
  <hr class="divider">
  <div class="row total-row"><span>TOTAL:</span><span>$${Number(detalle.total).toFixed(2)}</span></div>
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
    .total-row { font-size: ${isCarta ? '17px' : '15px'}; font-weight: 700; }
    .footer { margin-top: 10px; font-size: 12px; color: #000; }
  </style>
</head>
<body>
  <div class="header center">
    <h1>HERRAJES CONSORCIO</h1>
    <p class="bold">ARTE EN VIDRIO</p>
    <p class="bold">Pedido herraje</p>
  </div>
  <hr class="divider">
  <div class="row"><span>Folio:</span><span class="bold">${venta.folio}</span></div>
  <div class="row"><span>Fecha:</span><span>${venta.fecha}</span></div>
  <div class="row"><span>Hora:</span><span>${venta.hora}</span></div>
  <hr class="divider">
  <table>
    <thead>
      <tr>
        <th>Cant.</th>
        <th>Descripción</th>
        <th>Tono</th>
        <th class="right">P.U.</th>
        <th class="right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${venta.partidas.map(p => `
      <tr>
        <td>${p.cantidad}</td>
        <td>${p.descripcion}</td>
        <td>${p.tono || '-'}</td>
        <td class="right">$${Number(p.precioUnitario).toFixed(2)}</td>
        <td class="right">$${Number(p.subtotal).toFixed(2)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
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
