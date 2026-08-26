// Arma el texto (WhatsApp / correo) con el detalle de piezas y procesos de una
// cotizacion o pedido, a partir del mismo arreglo de partidas usado para imprimir
// el ticket (utils/ticket.js: printTicketVidrio).

function lineaVidrio(p) {
  const pzas = p.piezas ?? 1
  const base = `• ${pzas} · ${p.largo_cm}×${p.ancho_cm}cm · ${p.clave}: $${Number(p.subtotal_partida).toFixed(2)}`
  const procesos = (p.procesos ?? []).map(pr => `   + ${pr.nombre}: $${Number(pr.subtotal).toFixed(2)}`)
  return [base, ...procesos].join('\n')
}

function lineaMaquila(p) {
  const pzas = p.piezas ?? p.cantidad ?? 1
  const etiqueta = p.largo_cm
    ? `${pzas} · ${p.largo_cm}×${p.ancho_cm}cm${p.clave ? ' · ' + p.clave : ''}`
    : (p.descripcion || p.clave || '—')
  const base = `• ${etiqueta}: $${Number(p.subtotal_partida).toFixed(2)}`
  const procesos = (p.procesos ?? []).map(pr => `   + ${pr.nombre}`)
  return [base, ...procesos].join('\n')
}

function lineaSimple(p) {
  return `• ${p.cantidad ?? 1} · ${p.descripcion ?? '—'}: $${Number(p.subtotal_partida).toFixed(2)}`
}

function construirDetallePartidas(partidas = []) {
  const vidrios   = partidas.filter(p => !p.tipo || p.tipo === 'VIDRIO')
  const maquilas  = partidas.filter(p => p.tipo === 'MAQUILA')
  const extras    = partidas.filter(p => p.tipo === 'EXTRA')
  const herrajes  = partidas.filter(p => p.tipo === 'HERRAJE' || p.tipo === 'PRODUCTO')

  const secciones = []
  if (vidrios.length)  secciones.push(['Vidrio',         vidrios.map(lineaVidrio)])
  if (maquilas.length) secciones.push(['Maquila',        maquilas.map(lineaMaquila)])
  if (extras.length)   secciones.push(['Proceso Extra',  extras.map(lineaSimple)])
  if (herrajes.length) secciones.push(['Herraje',        herrajes.map(lineaSimple)])

  return secciones.map(([titulo, lineas]) => `${titulo}\n${lineas.join('\n')}`).join('\n\n')
}

export function construirMensajeCompartir({ tipo = 'cotizacion', folio, total, clienteNombre, partidas }) {
  const etiqueta = tipo === 'pedido' ? 'pedido' : 'cotizacion'
  const saludo = clienteNombre && clienteNombre !== 'Mostrador' ? `Hola ${clienteNombre},` : 'Hola,'
  const partes = [
    `${saludo} te comparto tu ${etiqueta} ${folio}:`,
    construirDetallePartidas(partidas),
    total != null ? `TOTAL: $${Number(total).toFixed(2)}` : '',
    '— Vidrio Templado y Aluminio Rosales',
  ]
  return partes.filter(Boolean).join('\n\n')
}
