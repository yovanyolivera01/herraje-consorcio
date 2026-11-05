import { http } from './http'

// ============================================================================
//  VIDRIO POR PIEZA  (backend/routes/porpieza.js)
// ============================================================================
//
// El backend calcula los precios con sp_insertar_partida_vidrio_por_pieza
// a partir de precio_pieza; los subtotales que se manden aquí se ignoran.
// Los errores de validación del SP llegan como Error con el mensaje del SP.

const num    = (v) => (v === '' || v == null ? null : Number(v))
const numReq = (v) => Number(v)

function normalizarProceso(p) {
  return {
    id_proceso:      numReq(p.id_proceso),
    id_unidad_cobro: num(p.id_unidad_cobro),
    cantidad:        num(p.cantidad),
    precio_unitario: num(p.precio_unitario),
    subtotal:        num(p.subtotal) ?? 0,
    sidesML:         p.sidesML ?? null,
  }
}

// Agrega una partida de vidrio por pieza a una cotización.
// Regresa la partida en el mismo formato que agregarPartida (más es_por_pieza).
export const agregarPartidaPorPieza = async (id_cotizacion, {
  id_tipo_vidrio, piezas, precio_pieza, largo_cm, ancho_cm,
  metros2 = null, observaciones = null, procesos = [],
}) =>
  http.post(`/api/cotizaciones/${id_cotizacion}/partidas-por-pieza`, {
    id_tipo_vidrio: numReq(id_tipo_vidrio),
    piezas:         numReq(piezas),
    precio_pieza:   numReq(precio_pieza),
    largo_cm:       num(largo_cm),
    ancho_cm:       num(ancho_cm),
    metros2:        num(metros2),
    observaciones:  observaciones || null,
    procesos:       (procesos ?? []).map(normalizarProceso),
  })
