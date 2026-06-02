import { supabase } from './supabase'
import { mxDayBound } from './utils'

const TZ = 'America/Mexico_City'
function formatFecha(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(d)
}

// ── Partidas de vidrio de pedidos VIDRIO entregados ───────────────────────────
// Devuelve una fila por pieza de vidrio (partida_pedido)

export const getPartidasVidrioEntregadas = async (fechaDesde, fechaHasta) => {
  let query = supabase
    .from('pedido')
    .select('id_pedido, folio, fecha_entrega, tipo_pago, cliente(nombre)')
    .eq('tipo_pedido', 'VIDRIO')
    .eq('estatus', 'ENTREGADO')
    .order('fecha_entrega', { ascending: false })

  if (fechaDesde) query = query.gte('fecha_entrega', mxDayBound(fechaDesde))
  if (fechaHasta) query = query.lte('fecha_entrega', mxDayBound(fechaHasta, true))

  const { data: pedidos, error: pedError } = await query
  if (pedError) throw pedError
  if (!pedidos?.length) return []

  const ids = pedidos.map(p => p.id_pedido)
  const { data: partidas, error: partError } = await supabase
    .from('partida_pedido')
    .select('*, tipo_vidrio(clave, descripcion)')
    .in('id_pedido', ids)
    .order('id_pedido')
  if (partError) throw partError

  const pedidoMap = Object.fromEntries(pedidos.map(p => [p.id_pedido, p]))

  return (partidas ?? []).map(p => {
    const ped = pedidoMap[p.id_pedido]
    return {
      id:               p.id_partida_pedido,
      id_pedido:        p.id_pedido,
      folio:            ped?.folio ?? '—',
      fechaEntrega:     formatFecha(ped?.fecha_entrega),
      fechaEntregaISO:  ped?.fecha_entrega,
      clienteNombre:    ped?.cliente?.nombre ?? 'Mostrador',
      clave_vidrio:     p.tipo_vidrio?.clave ?? '—',
      nombre_vidrio:    p.tipo_vidrio?.descripcion ?? '',
      largo_cm:         Number(p.largo_cm),
      ancho_cm:         Number(p.ancho_cm),
      metros2:          Number(p.metros_cuadrados ?? p.metros2 ?? 0),
      cantidad:         Number(p.cantidad ?? 1),
      precio_m2:        Number(p.precio_m2),
      subtotal_vidrio:  Number(p.subtotal_vidrio),
      subtotal_procesos: Number(p.subtotal_procesos),
      total_partida:    Number(p.total_partida),
    }
  })
}

// ── Extras de MAQUILA de cotizaciones mixtas entregadas ───────────────────────
// Pedidos VIDRIO entregados que tienen extras tipo=MAQUILA en partida_cotizacion_extra

export const getExtrasMaquilaEntregadas = async (fechaDesde, fechaHasta) => {
  let query = supabase
    .from('pedido')
    .select('id_pedido, folio, fecha_entrega, fecha_creacion, id_cotizacion, tipo_pago, monto_anticipo, total, cliente(nombre)')
    .eq('tipo_pedido', 'VIDRIO')
    .eq('estatus', 'ENTREGADO')
    .not('id_cotizacion', 'is', null)
    .order('fecha_creacion', { ascending: false })

  if (fechaDesde) {
    const desde = mxDayBound(fechaDesde)
    query = query.or(
      `fecha_entrega.gte.${desde},and(fecha_entrega.is.null,fecha_creacion.gte.${desde})`
    )
  }
  if (fechaHasta) {
    const hasta = mxDayBound(fechaHasta, true)
    query = query.or(
      `fecha_entrega.lte.${hasta},and(fecha_entrega.is.null,fecha_creacion.lte.${hasta})`
    )
  }

  const { data: pedidos, error: pedError } = await query
  if (pedError) throw pedError
  if (!pedidos?.length) return []

  const idsCot = pedidos.map(p => p.id_cotizacion).filter(Boolean)
  const { data: extras, error: extError } = await supabase
    .from('partida_cotizacion_extra')
    .select('*')
    .in('id_cotizacion', idsCot)
    .eq('tipo', 'MAQUILA')
  if (extError) throw extError

  const cotPedMap = Object.fromEntries(pedidos.map(p => [p.id_cotizacion, p]))

  return (extras ?? []).map(e => {
    const ped = cotPedMap[e.id_cotizacion]
    return {
      id:              e.id_partida_extra,
      id_pedido:       ped?.id_pedido,
      folio:           ped?.folio ?? '—',
      fechaEntrega:    formatFecha(ped?.fecha_entrega ?? ped?.fecha_creacion),
      fechaEntregaISO: ped?.fecha_entrega ?? ped?.fecha_creacion,
      clienteNombre:   ped?.cliente?.nombre ?? 'Mostrador',
      descripcion:     e.descripcion ?? '',
      unidad:          e.unidad ?? '',
      cantidad:        Number(e.cantidad ?? 0),
      precio_unitario: Number(e.precio_unitario ?? 0),
      subtotal:        Number(e.subtotal ?? 0),
      tipo_pago:       ped?.tipo_pago,
    }
  })
}

// ── Extras de HERRAJE de cotizaciones mixtas entregadas ───────────────────────
// Pedidos VIDRIO entregados que tienen extras tipo=PRODUCTO en partida_cotizacion_extra

export const getExtrasHerrajeEntregadas = async (fechaDesde, fechaHasta) => {
  let query = supabase
    .from('pedido')
    .select('id_pedido, folio, fecha_entrega, fecha_creacion, id_cotizacion, tipo_pago, monto_anticipo, total, cliente(nombre)')
    .eq('tipo_pedido', 'VIDRIO')
    .eq('estatus', 'ENTREGADO')
    .not('id_cotizacion', 'is', null)
    .order('fecha_creacion', { ascending: false })

  if (fechaDesde) {
    const desde = mxDayBound(fechaDesde)
    query = query.or(
      `fecha_entrega.gte.${desde},and(fecha_entrega.is.null,fecha_creacion.gte.${desde})`
    )
  }
  if (fechaHasta) {
    const hasta = mxDayBound(fechaHasta, true)
    query = query.or(
      `fecha_entrega.lte.${hasta},and(fecha_entrega.is.null,fecha_creacion.lte.${hasta})`
    )
  }

  const { data: pedidos, error: pedError } = await query
  if (pedError) throw pedError
  if (!pedidos?.length) return []

  const idsCot = pedidos.map(p => p.id_cotizacion).filter(Boolean)
  const { data: extras, error: extError } = await supabase
    .from('partida_cotizacion_extra')
    .select('*')
    .in('id_cotizacion', idsCot)
    .eq('tipo', 'PRODUCTO')
  if (extError) throw extError

  const cotPedMap = Object.fromEntries(pedidos.map(p => [p.id_cotizacion, p]))

  return (extras ?? []).map(e => {
    const ped = cotPedMap[e.id_cotizacion]
    return {
      id:              e.id_partida_extra,
      id_pedido:       ped?.id_pedido,
      folio:           ped?.folio ?? '—',
      fechaEntrega:    formatFecha(ped?.fecha_entrega ?? ped?.fecha_creacion),
      fechaEntregaISO: ped?.fecha_entrega ?? ped?.fecha_creacion,
      clienteNombre:   ped?.cliente?.nombre ?? 'Mostrador',
      descripcion:     e.descripcion ?? '',
      unidad:          e.unidad ?? '',
      cantidad:        Number(e.cantidad ?? 0),
      precio_unitario: Number(e.precio_unitario ?? 0),
      subtotal:        Number(e.subtotal ?? 0),
      tipo_pago:       ped?.tipo_pago,
    }
  })
}

// ── Ventas directas de herraje (NuevaVenta) ───────────────────────────────
// Devuelve una fila por partida de venta directa (folio VTA-)

export const getVentasDirectasHerraje = async (fechaDesde, fechaHasta) => {
  let query = supabase
    .from('ventas')
    .select('id, folio, fecha_hora')
    .order('fecha_hora', { ascending: false })

  if (fechaDesde) query = query.gte('fecha_hora', mxDayBound(fechaDesde))
  if (fechaHasta) query = query.lte('fecha_hora', mxDayBound(fechaHasta, true))

  const { data: ventas, error: ventasError } = await query
  if (ventasError) throw ventasError
  if (!ventas?.length) return []

  const ids = ventas.map(v => v.id)
  const { data: detalles, error: detError } = await supabase
    .from('detalle_venta')
    .select('id, venta_id, cantidad, precio_unitario, subtotal, productos(descripcion, tono), producto_general(nombre, unidad)')
    .in('venta_id', ids)
  if (detError) throw detError

  const ventaMap = Object.fromEntries(ventas.map(v => [v.id, v]))

  return (detalles ?? []).map(d => {
    const venta       = ventaMap[d.venta_id]
    const descripcion = d.productos?.descripcion ?? d.producto_general?.nombre ?? ''
    const tono        = d.productos?.tono ?? ''
    const unidad      = d.producto_general?.unidad ?? 'pza'
    return {
      id:              `vta-${d.id}`,
      folio:           venta?.folio ?? '—',
      fechaEntrega:    formatFecha(venta?.fecha_hora),
      fechaEntregaISO: venta?.fecha_hora,
      clienteNombre:   'Mostrador',
      descripcion:     tono ? `${descripcion} · ${tono}` : descripcion,
      unidad,
      cantidad:        Number(d.cantidad ?? 0),
      precio_unitario: Number(d.precio_unitario ?? 0),
      subtotal:        Number(d.subtotal ?? 0),
      tipo_pago:       'CONTADO',
    }
  })
}
