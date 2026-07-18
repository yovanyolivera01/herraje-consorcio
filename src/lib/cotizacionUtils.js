// Parses measurement input: "largo x ancho" or "piezas-largo x ancho"
export function parseNotacion(texto) {
  if (!texto || !texto.trim()) return { error: 'Ingresa una medida (ej. 3-22x45)' }
  const limpio = texto.trim()
    .replace(/\s/g, '')
    .replace(/[×\*]/g, 'x')
    .replace(/,/g, '.')

  let m = limpio.match(/^(\d+)-(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)$/)
  if (m) {
    const piezas = Number(m[1])
    const largo  = Number(m[2])
    const ancho  = Number(m[3])
    if (piezas <= 0) return { error: 'La cantidad de piezas debe ser mayor a 0' }
    if (largo  <= 0) return { error: 'El largo debe ser mayor a 0' }
    if (ancho  <= 0) return { error: 'El ancho debe ser mayor a 0' }
    return { piezas, largo, ancho }
  }

  m = limpio.match(/^(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)$/)
  if (m) {
    const largo = Number(m[1])
    const ancho = Number(m[2])
    if (largo <= 0) return { error: 'El largo debe ser mayor a 0' }
    if (ancho <= 0) return { error: 'El ancho debe ser mayor a 0' }
    return { piezas: 1, largo, ancho }
  }

  return { error: 'Formato invalido. Ej: 98x45  o  3-98x45' }
}

export function calcTotal(partidas) {
  return partidas.reduce((s, p) => {
    if (p.precio_manual) return s + Number(p.precio_manual)
    return s + Number(p.subtotal_partida ?? 0)
  }, 0)
}
