export function printTicket(venta, modo = '80mm') {
  const isCarta = modo === 'carta'
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ticket ${venta.folio}</title>
  <style>
    @page { margin: ${isCarta ? '15mm' : '4mm'}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${isCarta ? "'Segoe UI', sans-serif" : "'Courier New', monospace"};
      font-size: ${isCarta ? '13px' : '12px'};
      width: ${isCarta ? '100%' : '72mm'};
      max-width: ${isCarta ? '700px' : '72mm'};
      margin: 0 auto;
      color: #000;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .right { text-align: right; }
    .divider { border: none; border-top: 1px dashed #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .header { margin-bottom: 10px; }
    .header h1 { font-size: ${isCarta ? '20px' : '14px'}; }
    .header p { font-size: ${isCarta ? '12px' : '10px'}; color: #555; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th { border-bottom: 1px solid #000; padding: 4px 6px; font-size: ${isCarta ? '12px' : '10px'}; text-align: left; }
    td { padding: 4px 6px; vertical-align: top; font-size: ${isCarta ? '12px' : '11px'}; }
    .total-row { font-size: ${isCarta ? '16px' : '13px'}; font-weight: bold; }
    .footer { margin-top: 12px; font-size: 11px; color: #555; }
  </style>
</head>
<body>
  <div class="header center">
    <h1>HERRAJE CONSORCIO</h1>
    <p>Ferretería y Herrajes</p>
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
</body>
</html>`

  const win = window.open('', '_blank', 'width=480,height=640')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 600)
}
