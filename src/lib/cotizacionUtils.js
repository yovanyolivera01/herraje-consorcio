import { r5 } from './utils'

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

// Calculates the total for a list of partidas, applying r5 rounding per piece
export function calcTotal(partidas) {
  return partidas.reduce((s, p) => {
    if (!p.tipo || p.tipo === 'VIDRIO') {
      if (p.precio_manual) return s + Number(p.precio_manual)
      const pzas = Number(p.piezas ?? 1)
      const cuVid = r5(Number(p.subtotal_vidrio || p.subtotal_partida || 0) / pzas)
      const totProc = (p.procesos ?? []).reduce((ps, pr) => ps + r5(Number(pr.subtotal) / pzas) * pzas, 0)
      return s + cuVid * pzas + totProc
    }
    return s + r5(Number(p.subtotal_partida ?? 0))
  }, 0)
}
