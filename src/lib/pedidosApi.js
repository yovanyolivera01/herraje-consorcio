import { supabase } from './supabase'
import { r5 } from './utils'

// ── Helpers ───────────────────────────────────────────────────────────────

const TZ = 'America/Mexico_City'

// PED-00141 → PED-141  |  PED-01000 → PED-1000
const fmtFolio = (folio) => folio ? folio.replace(/^([A-Z]+-?)0+(\d)/, '$1$2') : ''

function formatearFechaHora(isoString) {
  if (!isoString) return { fecha: '—', hora: '—' }
  const utc = /Z|[+-]\d{2}:?\d{2}$/.test(isoString) ? isoString : isoString + 'Z'
  const d = new Date(utc)
  return {
    fecha: new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(d),
    hora:  new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d).slice(0, 5),
  }
}

// ── Auditoría pedidod (fire-and-forget, no bloquea el flujo principal) ───
const auditarPedido = (id_pedido) => {
  supabase.rpc('sp_insertar_pedidod', { p_id_pedido: id_pedido })
    .then(({ error }) => { if (error) console.warn('[pedidod]', error.message) })
    .catch(e => console.warn('[pedidod]', e.message))
}

// ── Conversión cotización → pedido  (HU-08) ───────────────────────────────
//
//  SP: sp_convertir_cotizacion_a_pedido(p_id_cotizacion, p_tipo_pago, p_monto_anticipo)
//  Retorna TABLE (out_id_pedido INT, out_folio TEXT, out_mensaje TEXT)
//  out_mensaje comienza con 'ERROR:' si algo salió mal.

export const convertirCotizacionAPedido = async (id_cotizacion, tipo_pago, monto_anticipo) => {
  const { data, error } = await supabase.rpc('sp_convertir_cotizacion_a_pedido', {
    p_id_cotizacion:  id_cotizacion,
    p_tipo_pago:      tipo_pago,
    p_monto_anticipo: Number(monto_anticipo),
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row || row.out_mensaje?.startsWith('ERROR')) {
    throw new Error(row?.out_mensaje ?? 'Error desconocido al convertir cotización')
  }

  // Descontar m² del inventario de vidrio para cada partida de la cotización
  const { error: invError } = await supabase.rpc('sp_decrementar_inventario_vidrio', {
    p_id_cotizacion: id_cotizacion,
    p_folio_pedido:  row.out_folio ?? '',
  })
  if (invError) console.error('[inventario] No se pudo descontar stock:', invError.message)

  auditarPedido(row.out_id_pedido)
  return row.out_id_pedido
}

// ── Descontar inventario desde partidas en memoria  ───────────────────────
//
//  Usado cuando se crea un pedido directo (sin cotización previa).
//  Agrupa las partidas por id_tipo_vidrio y descuenta m2_disponible del
//  lote con más stock disponible.

export const decrementarInventarioDesdePartidas = async (partidas, folioRef = '') => {
  const byTipo = {}
  for (const p of partidas) {
    if (!p.id_tipo_vidrio) continue
    const m2 = Number(p.metros2) || 0
    byTipo[p.id_tipo_vidrio] = (byTipo[p.id_tipo_vidrio] || 0) + m2
  }

  for (const [tipoStr, total_m2] of Object.entries(byTipo)) {
    const id_tipo_vidrio = Number(tipoStr)

    const { data: lotes } = await supabase
      .from('inventario_vidrio')
      .select('id_inventario, m2_disponible, es_preferido')
      .eq('id_tipo_vidrio', id_tipo_vidrio)
      .order('es_preferido', { ascending: false })
      .order('m2_disponible', { ascending: false })
      .limit(1)

    if (!lotes?.length) continue

    const lote      = lotes[0]
    const nuevoSaldo = Math.max(Number(lote.m2_disponible) - total_m2, 0)

    await supabase
      .from('inventario_vidrio')
      .update({ m2_disponible: nuevoSaldo })
      .eq('id_inventario', lote.id_inventario)

    await supabase
      .from('movimiento_inventario_vidrio')
      .insert({
        id_inventario:       lote.id_inventario,
        tipo_movimiento:     'SALIDA',
        m2_cantidad:         total_m2,
        m2_saldo_resultante: nuevoSaldo,
        nota:                `Venta ${folioRef || 'directa'}`,
      })
  }
}

// ── Crear pedido directo (sin cotización)  ────────────────────────────────
//
//  SP: sp_crear_pedido_directo(p_id_cliente, p_id_nivel_precio, p_tipo_pago,
//                               p_monto_anticipo, p_partidas)
//  Retorna TABLE (out_id_pedido INT, out_folio TEXT, out_mensaje TEXT)

export const crearPedidoDirecto = async ({ id_cliente, id_nivel_precio, partidas, tipo_pago, monto_anticipo }) => {
  const { data, error } = await supabase.rpc('sp_crear_pedido_directo', {
    p_id_cliente:      id_cliente ?? null,
    p_id_nivel_precio: id_nivel_precio,
    p_tipo_pago:       tipo_pago,
    p_monto_anticipo:  Number(monto_anticipo),
    p_partidas:        partidas,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row || row.out_mensaje?.startsWith('ERROR')) {
    throw new Error(row?.out_mensaje ?? 'Error desconocido al crear el pedido')
  }
  auditarPedido(row.out_id_pedido)
  return row.out_id_pedido
}

// ── Pedidos pendientes  (HU-10) ───────────────────────────────────────────
//
//  SP: sp_obtener_pedidos_pendientes(p_tipo_pedido)
//  Sprint 4: SP ahora requiere tipo_pedido y retorna nuevos campos.

export const getPedidosPendientes = async () => {
  const { data, error } = await supabase.rpc('sp_obtener_pedidos_pendientes', {
    p_tipo_pedido: 'VIDRIO',
  })
  if (error) throw error
  return (data ?? []).map(row => {
    const { fecha, hora } = formatearFechaHora(row.fecha_pedido)
    return {
      id:                 row.id_pedido,
      folio:              fmtFolio(row.folio),
      fecha,
      hora,
      fechaCreacionISO:   row.fecha_pedido,
      clienteNombre:      row.cliente ?? 'Mostrador',
      telefono:           '',
      total:              r5(Number(row.total)),
      anticipo:           Number(row.monto_anticipo),
      saldo:              r5(Number(row.total)) - Number(row.monto_anticipo),
      estatus:            row.estatus,
      diasPendiente:      0,
      numPartidas:        Number(row.partidas_total     ?? 0),
      partidasPendientes: Number(row.partidas_pendientes ?? 0),
      observaciones:      '',
    }
  })
}

// ── Pedidos entregados / historial de ventas  (HU-09) ─────────────────────
//
//  SP: sp_obtener_historial_ventas(p_fecha_inicio, p_fecha_fin)
//  NULL en fechas = semana actual / hoy (lógica en el SP)

export const getPedidosEntregados = async (fechaDesde, fechaHasta) => {
  const { data, error } = await supabase.rpc('sp_obtener_historial_ventas', {
    p_fecha_inicio: fechaDesde || null,
    p_fecha_fin:    fechaHasta || null,
  })
  if (error) throw error
  return (data ?? []).map(row => {
    const { fecha, hora }     = formatearFechaHora(row.fecha_creacion)
    const { fecha: fechaEnt } = row.fecha_entrega ? formatearFechaHora(row.fecha_entrega) : { fecha: '—' }
    return {
      id:              row.id_pedido,
      folio:           fmtFolio(row.folio),
      fecha,
      hora,
      fechaEntrega:    fechaEnt,
      fechaEntregaISO: row.fecha_entrega,
      clienteNombre:   row.cliente ?? 'Mostrador',
      nivelNombre:     row.nivel_precio ?? '',
      tipo_pago:       row.tipo_pago,
      forma_pago:      row.tipo_pago,   // alias para código existente
      total:           Number(row.total),
      anticipo:        Number(row.monto_anticipo),
      saldo_cobrado:   row.monto_cobrado_entrega != null ? Number(row.monto_cobrado_entrega) : null,
      totalCobrado:    Number(row.total_cobrado),
    }
  })
}

// ── Detalle completo de un pedido ─────────────────────────────────────────
//
//  SPs: sp_obtener_cabecera_pedido  → cabecera + cliente + nivel
//       sp_obtener_partidas_pedido  → piezas de vidrio
//       sp_obtener_procesos_pedido  → procesos por partida

export const getDetallePedido = async (id_pedido) => {
  const [cabRes, partRes, procRes, pedidoRow] = await Promise.all([
    supabase.rpc('sp_obtener_cabecera_pedido', { p_id_pedido: id_pedido }),
    supabase.rpc('sp_obtener_partidas_pedido', { p_id_pedido: id_pedido }),
    supabase.rpc('sp_obtener_procesos_pedido', { p_id_pedido: id_pedido }),
    supabase.from('pedido').select('id_cotizacion').eq('id_pedido', id_pedido).single(),
  ])
  if (cabRes.error)  throw cabRes.error
  if (partRes.error) throw partRes.error
  if (procRes.error) throw procRes.error

  const cab = Array.isArray(cabRes.data) ? cabRes.data[0] : cabRes.data
  if (!cab) throw new Error('Pedido no encontrado')

  const id_cotizacion = cab.id_cotizacion ?? pedidoRow.data?.id_cotizacion ?? null

  const { fecha, hora }     = formatearFechaHora(cab.fecha_creacion)
  const { fecha: fechaEnt } = cab.fecha_entrega ? formatearFechaHora(cab.fecha_entrega) : { fecha: '—' }

  // Agrupar procesos por partida
  const procesosPorPartida = {}
  for (const pr of (procRes.data ?? [])) {
    const pid = pr.id_partida_pedido
    if (!procesosPorPartida[pid]) procesosPorPartida[pid] = []
    procesosPorPartida[pid].push({
      nombre:          pr.proceso        ?? '',
      unidad:          pr.unidad_cobro   ?? '',
      cantidad:        Number(pr.cantidad_unidades),
      precio_unitario: Number(pr.precio_unitario),
      subtotal:        Number(pr.subtotal),
    })
  }

  // Extras (MAQUILA/PRODUCTO) de la cotización de origen
  let extras = []
  if (id_cotizacion) {
    const { data: extrasData } = await supabase
      .from('partida_cotizacion_extra')
      .select('tipo, descripcion, unidad, cantidad, precio_unitario, subtotal, notas')
      .eq('id_cotizacion', id_cotizacion)
      .order('id_partida_extra')
    if (extrasData) extras = extrasData
  }

  return {
    id:              cab.id_pedido,
    id_cotizacion:   id_cotizacion,
    folio:           fmtFolio(cab.folio),
    fecha,
    hora,
    fechaEntrega:    fechaEnt,
    fechaCreacionISO: cab.fecha_creacion,
    fechaEntregaISO:  cab.fecha_entrega,
    cliente:  { nombre: cab.cliente ?? 'Mostrador', telefono: cab.telefono_cliente ?? '' },
    nivel:    { nombre: cab.nivel_precio ?? '' },
    total:    r5(Number(cab.total)),
    tipo_pago:     cab.tipo_pago,
    forma_pago:    cab.tipo_pago,   // alias para código existente
    anticipo:      Number(cab.monto_anticipo),
    saldo:         r5(Number(cab.total)) - Number(cab.monto_anticipo),
    saldo_cobrado: cab.monto_cobrado_entrega != null ? Number(cab.monto_cobrado_entrega) : null,
    estado:        cab.estatus,     // alias para código existente (usa 'estado' en páginas)
    estatus:       cab.estatus,
    observaciones: cab.observaciones ?? '',
    extras,
    partidas: (partRes.data ?? []).map(p => ({
      id:                 p.id_partida_pedido,
      clave_vidrio:       p.tipo_vidrio      ?? '—',   // alias — SP retorna clave del tipo
      descripcion_vidrio: '',
      largo_cm:           Number(p.largo_cm),
      ancho_cm:           Number(p.ancho_cm),
      metros2:            Number(p.metros_cuadrados),  // alias para código existente
      precio_m2_aplicado: Number(p.precio_m2),         // alias para código existente
      subtotal_vidrio:    Number(p.subtotal_vidrio),
      subtotal_procesos:  Number(p.subtotal_procesos),
      subtotal_partida:   Number(p.total_partida),     // alias para código existente
      cantidad:           p.cantidad,
      procesos:           procesosPorPartida[p.id_partida_pedido] ?? [],
    })),
  }
}

// ── Marcar pedido como entregado  (HU-11) ────────────────────────────────
//
//  SP: sp_marcar_pedido_entregado(p_id_pedido, p_monto_cobrado)
//  Retorna TABLE (exito BOOLEAN, mensaje TEXT)

export const marcarComoEntregado = async (id_pedido, monto_cobrado) => {
  const { data, error } = await supabase.rpc('sp_marcar_pedido_entregado', {
    p_id_pedido:     id_pedido,
    p_monto_cobrado: Number(monto_cobrado),
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.exito) throw new Error(row?.mensaje ?? 'Error al registrar la entrega')
  auditarPedido(id_pedido)
  return true
}

// ── Entregar línea específica del pedido (Sprint 4 US-03) ────────────────
//
//  SP: sp_entregar_partida_pedido(p_id_partida_pedido)
//  Marca la línea como ENTREGADO y recalcula estatus del pedido padre.

export const entregarPartidaPedido = async (id_partida_pedido) => {
  const { data, error } = await supabase.rpc('sp_entregar_partida_pedido', {
    p_id_partida_pedido: id_partida_pedido,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (row?.p_mensaje?.includes('ya entregada') || row?.p_mensaje?.includes('no encontrad')) {
    throw new Error(row.p_mensaje)
  }
  return true
}

// ── Marcar anticipo como liquidado (Sprint 4 US-12) ──────────────────────
//
//  SP: sp_marcar_anticipo_liquidado(p_id_pedido)
//  Cambia estatus PENDIENTE/PARCIAL → ANTICIPO_LIQUIDADO.

export const marcarAnticipoLiquidado = async (id_pedido) => {
  const { data, error } = await supabase.rpc('sp_marcar_anticipo_liquidado', {
    p_id_pedido: id_pedido,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (row?.p_mensaje?.includes('no encontrado') || row?.p_mensaje?.includes('incorrecto')) {
    throw new Error(row.p_mensaje)
  }
  return true
}

// ── Export a Excel  (HU-09) ───────────────────────────────────────────────
//
//  SP: sp_exportar_excel_ventas(p_fecha_inicio, p_fecha_fin)
//  Retorna filas planas: una fila por partida de pedido

export const getPedidosParaExport = async (fechaDesde, fechaHasta) => {
  const { data, error } = await supabase.rpc('sp_exportar_excel_ventas', {
    p_fecha_inicio: fechaDesde || null,
    p_fecha_fin:    fechaHasta || null,
  })
  if (error) throw error
  return data ?? []
}
