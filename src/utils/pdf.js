import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function buildCotizacionHTML(detalle) {
  const titulo    = detalle.tipo === 'pedido' ? 'PEDIDO DE VIDRIO' : 'COTIZACIÓN DE VIDRIO'
  const folioLbl  = detalle.tipo === 'pedido' ? 'Pedido N°:' : 'Folio:'
  const pie       = detalle.tipo === 'pedido' ? '¡Gracias por su compra!' : 'Cotización con vigencia de 15 días a partir de la fecha de emisión.'

  const filas = detalle.partidas.map((p, idx) => {
    const pzas     = p.piezas ?? 1
    const m2       = (pzas * p.largo_cm * p.ancho_cm / 10000).toFixed(4)
    const procesos = (p.procesos ?? []).map(pr => pr.nombre).join('<br>') || '—'
    const precioPza = (Number(p.subtotal_partida) / pzas).toFixed(2)
    return `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'}">
        <td style="font-weight:700;text-align:center">${pzas}</td>
        <td style="font-weight:700;color:#1a3a6b">${p.clave}</td>
        <td style="color:#555;font-size:11px">${procesos}</td>
        <td style="color:#555;font-size:11px;text-align:center">${m2} m²</td>
        <td style="text-align:right;font-size:11px">$${precioPza}</td>
        <td style="text-align:right;font-weight:600">$${Number(p.subtotal_partida).toFixed(2)}</td>
      </tr>`
  }).join('')

  const emp = detalle.empresa
  const destinatario = emp ? `
    <div style="background:#1e4f9c;color:#fff;padding:9px 14px;border-radius:6px 6px 0 0;font-size:13px;font-weight:700">
      ${emp.nombre}
    </div>
    <div style="background:#eaf0fa;padding:8px 14px 10px;border-radius:0 0 6px 6px;border-left:4px solid #1e4f9c;font-size:11px;color:#222;line-height:1.9;margin-bottom:16px">
      ${emp.razon_social ? `<div>Razón social: <strong>${emp.razon_social}</strong></div>` : ''}
      ${emp.rfc          ? `<div>RFC: <strong>${emp.rfc}</strong></div>` : ''}
      ${emp.telefono     ? `<div>Tel: ${emp.telefono}</div>` : ''}
      ${emp.correo       ? `<div>Correo: ${emp.correo}</div>` : ''}
      ${emp.direccion    ? `<div>Dirección: ${emp.direccion}</div>` : ''}
    </div>` : `
    <div style="background:#f4f7fb;border-left:4px solid #1a3a6b;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;color:#1a3a6b">${detalle.clienteNombre ?? 'Mostrador'}</div>
      ${detalle.clienteTel ? `<div style="font-size:12px;color:#555;margin-top:3px">Tel: ${detalle.clienteTel}</div>` : ''}
    </div>`

  return `
<html><head><meta charset="UTF-8">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#111; width:750px; }
  .brand { background:#1a3a6b; border-radius:10px; padding:26px 40px 20px; color:#fff; text-align:center; position:relative; margin-bottom:16px; }
  .brand h1 { font-size:34px; font-weight:900; letter-spacing:2px; }
  .brand .consorcio { font-size:16px; letter-spacing:10px; color:rgba(160,200,255,.8); margin:4px 0 8px; }
  .brand .slogan { font-style:italic; font-size:13px; color:rgba(210,230,255,.8); }
  .brand .oval-l,.brand .oval-r { position:absolute; top:50%; transform:translateY(-50%); width:52px; height:80px; border:2px solid rgba(100,160,230,.45); border-radius:50%; }
  .brand .oval-l { left:26px; } .brand .oval-r { right:26px; }
  .brand .oval-l::before,.brand .oval-r::before { content:''; position:absolute; inset:8px; border:1.5px solid rgba(100,160,230,.25); border-radius:50%; }
  .brand .diamond { width:12px; height:12px; border:2px solid rgba(120,180,255,.6); transform:rotate(45deg); margin:0 auto 8px; }
  .marcas { margin-bottom:16px; }
  .marcas-lbl { text-align:center; font-size:9px; letter-spacing:4px; color:#999; text-transform:uppercase; margin-bottom:6px; }
  .marcas-grid { display:flex; border:1px solid #ddd; border-radius:7px; overflow:hidden; }
  .marca { flex:1; padding:10px 6px; text-align:center; border-right:1px solid #ddd; }
  .marca:last-child { border-right:none; }
  .marca.hl { background:#1a3a6b; color:#fff; }
  .marca .mn { font-size:15px; font-weight:700; color:#1a3a6b; }
  .marca.hl .mn { color:#fff; }
  .marca .ms { font-size:8px; letter-spacing:2px; color:#999; text-transform:uppercase; margin-top:2px; }
  .marca.hl .ms { color:rgba(200,220,255,.8); }
  .doc-info { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
  .doc-titulo { font-size:17px; font-weight:700; color:#1a3a6b; }
  .doc-meta { font-size:11px; color:#555; line-height:1.9; text-align:right; }
  .doc-meta strong { color:#111; }
  table { width:100%; border-collapse:collapse; margin-bottom:12px; }
  th { background:#1a3a6b; color:#fff; padding:7px 9px; font-size:11px; text-align:left; }
  th:last-child { text-align:right; }
  td { padding:6px 9px; border-bottom:1px solid #eee; font-size:12px; vertical-align:top; }
  .total-box { display:flex; justify-content:flex-end; margin-bottom:20px; }
  .total-inner { background:#1a3a6b; color:#fff; padding:10px 22px; border-radius:7px; font-size:18px; font-weight:700; }
  .footer { border-top:1px solid #ddd; padding-top:10px; font-size:10px; color:#888; text-align:center; line-height:1.7; }
</style></head><body>
  <div class="brand">
    <div class="oval-l"></div><div class="oval-r"></div>
    <div class="diamond"></div>
    <h1 style="font-size:22px">VIDRIO TEMPLADO Y ALUMINIO ROSALES</h1>
    <div class="slogan">Rosales #35 C.P. 55270, Granjas Valle de Guadalupe · Ecatepec de Morelos, Estado de Mexico</div>
    <div class="slogan" style="margin-top:3px">Tel: 5523134256, 5522161432, 5547912671 · rosalesvidriotempladofernando@gmail.com</div>
  </div>
  <div class="marcas">
    <div class="marcas-lbl">Marcas que distribuimos</div>
    <div class="marcas-grid">
      <div class="marca"><div class="mn" style="font-style:italic">axlent</div><div class="ms">i t a l y</div></div>
      <div class="marca"><div class="mn">DAWH</div><div class="ms">Door &amp; Window Hardware</div></div>
      <div class="marca hl"><div class="mn">Brüken</div><div class="ms">ASSA ABLOY</div></div>
    </div>
  </div>
  <div class="doc-info">
    <div class="doc-titulo">${titulo}</div>
    <div class="doc-meta">
      <div>${folioLbl} <strong>${detalle.folio}</strong></div>
      <div>Fecha: <strong>${detalle.fecha}</strong></div>
      ${detalle.hora ? `<div>Hora: <strong>${detalle.hora}</strong></div>` : ''}
    </div>
  </div>
  ${destinatario}
  <table>
    <thead><tr><th style="text-align:center">Pzas</th><th>Tipo de vidrio</th><th>Procesos</th><th style="text-align:center">m²</th><th style="text-align:right">Precio/pza</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="total-box">
    <div class="total-inner">TOTAL: $${Number(detalle.total).toFixed(2)}</div>
  </div>
  <div class="footer">${pie}<br>Vidrio Templado y Aluminio Rosales · Tel: 5523134256, 5522161432, 5547912671</div>
</body></html>`
}

export async function exportCotizacionPDF(detalle) {
  const contenedor = document.createElement('div')
  contenedor.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;padding:32px 36px;'
  contenedor.innerHTML = buildCotizacionHTML(detalle)
  document.body.appendChild(contenedor)

  try {
    const canvas = await html2canvas(contenedor, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW  = pdf.internal.pageSize.getWidth()
    const pageH  = pdf.internal.pageSize.getHeight()
    const margin = 10
    const maxW   = pageW - margin * 2
    const maxH   = pageH - margin * 2

    // How many canvas pixels fit in one PDF page height
    const pxPerMM     = canvas.width / maxW
    const pageHeightPx = maxH * pxPerMM
    const totalPages  = Math.ceil(canvas.height / pageHeightPx)

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage()

      const srcY = Math.round(i * pageHeightPx)
      const srcH = Math.min(Math.round(pageHeightPx), canvas.height - srcY)

      const slice = document.createElement('canvas')
      slice.width  = canvas.width
      slice.height = srcH
      slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)

      pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, maxW, srcH / pxPerMM)
    }

    pdf.save(`Cotizacion_${detalle.folio ?? 'vidrio'}_${(detalle.fecha ?? '').replace(/\//g, '-')}.pdf`)
  } finally {
    document.body.removeChild(contenedor)
  }
}
