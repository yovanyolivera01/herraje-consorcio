import { supabase } from './supabase'
import { mxDayBound } from './utils'

// ── Helper de fecha ──────────────────────────────────────────────────────────

const TZ = 'America/Mexico_City'
function formatearFechaHora(isoString) {
  if (!isoString) return { fecha: '—', hora: '—' }
  const d = new Date(isoString)
  return {
    fecha: new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(d),
    hora:  new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d).slice(0, 5),
  }
}

// ── Helper para validar respuesta de SP con p_mensaje ────────────────────────

function assertSP(row, errKeyword = null) {
  const msg = row?.p_mensaje ?? ''
  const isError = errKeyword
    ? msg.includes(errKeyword)
    : msg.toLowerCase().startsWith('error') || msg.includes('no encontrad') || msg.includes('no se puede') || msg.includes('no válid') || msg.includes('no está en')
  if (isError) throw new Error(msg)
}

// ============================================================================
//  COTIZACIONES DE MAQUILA
// ============================================================================

// ── Crear cabecera (US-07) ───────────────────────────────────────────────────

export const iniciarCotizacionMaquila = async ({ id_cliente, id_nivel_precio, observaciones }) => {
  const { data, error } = await supabase.rpc('sp_iniciar_cotizacion_maquila', {
    p_id_cliente:      id_cliente      ?? null,
    p_id_nivel_precio: id_nivel_precio,
    p_observaciones:   observaciones   ?? null,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row || row.p_id_cotizacion === 0) throw new Error(row?.p_mensaje ?? 'Error al iniciar cotización')
  return { id_cotizacion: row.p_id_cotizacion, folio: row.p_folio }
}

// ── Agregar partida con procesos (US-07 / US-08) ─────────────────────────────
// procesos: [{ id_proceso, cantidad? }] — cantidad en null = SP la calcula

export const agregarPartidaMaquila = async ({ id_cotizacion, descripcion, largo_cm, ancho_cm, cantidad, procesos }) => {
  const { data, error } = await supabase.rpc('sp_agregar_partida_maquila', {
    p_id_cotizacion: id_cotizacion,
    p_descripcion:   descripcion ?? null,
    p_largo_cm:      Number(largo_cm),
    p_ancho_cm:      Number(ancho_cm),
    p_cantidad:      Number(cantidad),
    p_procesos:      procesos ?? [],
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row || row.p_id_partida === 0) throw new Error(row?.p_mensaje ?? 'Error al agregar partida')
  return { id_partida: row.p_id_partida, subtotal: Number(row.p_subtotal) }
}

// ── Eliminar partida (US-08) ─────────────────────────────────────────────────

export const eliminarPartidaMaquila = async (id_partida_maquila) => {
  const { data, error } = await supabase.rpc('sp_eliminar_partida_maquila', {
    p_id_partida_maquila: id_partida_maquila,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (row?.p_mensaje === 'Partida no encontrada.') throw new Error(row.p_mensaje)
}

// ── Finalizar cotización (US-09) ─────────────────────────────────────────────

export const finalizarCotizacionMaquila = async (id_cotizacion) => {
  const { data, error } = await supabase.rpc('sp_finalizar_cotizacion_maquila', {
    p_id_cotizacion: id_cotizacion,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row || (row.p_total === 0 && row.p_mensaje !== 'OK')) {
    const msg = row?.p_mensaje ?? 'Error al finalizar cotización'
    if (!msg.includes('finalizada')) throw new Error(msg)
  }
  return Number(row.p_total)
}

// ── Ticket de maquila (US-10) ────────────────────────────────────────────────
// Retorna filas planas agrupables por id_partida

export const getTicketMaquila = async (id_cotizacion) => {
  const { data, error } = await supabase.rpc('sp_obtener_ticket_maquila', {
    p_id_cotizacion: id_cotizacion,
  })
  if (error) throw error
  return data ?? []
}

// ── Historial de cotizaciones de maquila ─────────────────────────────────────

export const getCotizacionesMaquila = async () => {
  const { data, error } = await supabase
    .from('cotizacion')
    .select('*, cliente(id_cliente, nombre), nivel_precio(id_nivel_precio, nombre)')
    .eq('tipo_cotizacion', 'MAQUILA')
    .neq('estatus', 'CONVERTIDA')
    .order('fecha', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => {
    const { fecha, hora } = formatearFechaHora(row.fecha)
    return {
      id:            row.id_cotizacion,
      folio:         row.folio,
      fecha,
      hora,
      fechaISO:      row.fecha,
      clienteNombre: row.cliente?.nombre ?? 'Mostrador',
      nivelNombre:   row.nivel_precio?.nombre ?? '',
      total:         Number(row.total ?? 0),
      estatus:       row.estatus,
      observaciones: row.observaciones ?? '',
    }
  })
}

// ── Detalle completo de cotización (partidas + procesos) ─────────────────────

export const getDetalleCotizacionMaquila = async (id_cotizacion) => {
  const [cotRes, partidasRes] = await Promise.all([
    supabase
      .from('cotizacion')
      .select('*, cliente(id_cliente, nombre, telefono), nivel_precio(id_nivel_precio, nombre)')
      .eq('id_cotizacion', id_cotizacion)
      .single(),
    supabase
      .from('partida_maquila')
      .select('*, proceso_partida_maquila(*, proceso(id_proceso, nombre, unidad_cobro(nombre)))')
      .eq('id_cotizacion', id_cotizacion)
      .order('id_partida_maquila'),
  ])
  if (cotRes.error)     throw cotRes.error
  if (partidasRes.error) throw partidasRes.error

  const row = cotRes.data
  const { fecha, hora } = formatearFechaHora(row.fecha)
  return {
    id:            row.id_cotizacion,
    folio:         row.folio,
    fecha,
    hora,
    fechaISO:      row.fecha,
    cliente:       row.cliente,
    nivel:         row.nivel_precio,
    total:         Number(row.total ?? 0),
    estatus:       row.estatus,
    observaciones: row.observaciones ?? '',
    partidas: (partidasRes.data ?? []).map(p => ({
      id:                 p.id_partida_maquila,
      descripcion:        p.descripcion ?? '',
      largo_cm:           Number(p.largo_cm),
      ancho_cm:           Number(p.ancho_cm),
      cantidad:           p.cantidad,
      metros2:            Number(p.metros2),
      subtotal_procesos:  Number(p.subtotal_procesos),
      subtotal_partida:   Number(p.subtotal_partida),
      procesos: (p.proceso_partida_maquila ?? []).map(pp => ({
        id:               pp.id_proceso_pm,
        id_proceso:       pp.id_proceso,
        nombre:           pp.proceso?.nombre ?? '',
        unidad:           pp.proceso?.unidad_cobro?.nombre ?? '',
        cantidad_unidades: Number(pp.cantidad_unidades),
        precio_unitario:  Number(pp.precio_unitario),
        subtotal:         Number(pp.subtotal),
      })),
    })),
  }
}

// ── Reabrir cotización FINALIZADA para edición (US-06) ───────────────────────
// Aplica a cotizaciones VIDRIO y MAQUILA

export const reabrirCotizacion = async (id_cotizacion) => {
  const { data, error } = await supabase.rpc('sp_reabrir_cotizacion', {
    p_id_cotizacion: id_cotizacion,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  assertSP(row)
  return true
}

// ── Convertir a pedido (US-12) ───────────────────────────────────────────────

export const convertirMaquilaAPedido = async ({ id_cotizacion, tipo_pago, monto_anticipo }) => {
  const { data, error } = await supabase.rpc('sp_convertir_maquila_a_pedido', {
    p_id_cotizacion:  id_cotizacion,
    p_tipo_pago:      tipo_pago,
    p_monto_anticipo: Number(monto_anticipo),
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row || row.p_id_pedido === 0) throw new Error(row?.p_mensaje ?? 'Error al convertir a pedido')
  return { id_pedido: row.p_id_pedido, folio: row.p_folio_pedido }
}

// ============================================================================
//  PEDIDOS DE MAQUILA
// ============================================================================

// ── Pedidos pendientes filtrados por tipo MAQUILA ────────────────────────────

export const getPedidosPendientesMaquila = async () => {
  const { data, error } = await supabase.rpc('sp_obtener_pedidos_pendientes', {
    p_tipo_pedido: 'MAQUILA',
  })
  if (error) throw error
  return (data ?? []).map(row => {
    const { fecha, hora } = formatearFechaHora(row.fecha_pedido)
    return {
      id:                  row.id_pedido,
      folio:               row.folio,
      fecha,
      hora,
      fechaPedidoISO:      row.fecha_pedido,
      clienteNombre:       row.cliente ?? 'Mostrador',
      total:               Number(row.total),
      anticipo:            Number(row.monto_anticipo),
      saldo:               Number(row.saldo_pendiente),
      estatus:             row.estatus,
      partidasPendientes:  Number(row.partidas_pendientes ?? 0),
      numPartidas:         Number(row.partidas_total     ?? 0),
    }
  })
}

// ── Detalle de pedido de maquila (partidas + procesos snapshot) ──────────────

export const getDetallePedidoMaquila = async (id_pedido) => {
  const [pedRes, partidasRes] = await Promise.all([
    supabase
      .from('pedido')
      .select('*, cliente(id_cliente, nombre, telefono), cotizacion(folio)')
      .eq('id_pedido', id_pedido)
      .single(),
    supabase
      .from('partida_pedido_maquila')
      .select('*, proceso_partida_pedido_maquila(*, proceso(nombre, unidad_cobro(nombre)))')
      .eq('id_pedido', id_pedido)
      .order('id_partida_ped_maq'),
  ])
  if (pedRes.error)     throw pedRes.error
  if (partidasRes.error) throw partidasRes.error

  const p = pedRes.data
  const { fecha, hora } = formatearFechaHora(p.fecha_pedido)
  return {
    id:               p.id_pedido,
    folio:            p.folio,
    folioCotizacion:  p.cotizacion?.folio ?? '',
    fecha,
    hora,
    fechaPedidoISO:   p.fecha_pedido,
    cliente:          p.cliente,
    total:            Number(p.total),
    tipo_pago:        p.tipo_pago,
    anticipo:         Number(p.monto_anticipo),
    saldo:            Number(p.saldo_pendiente),
    estatus:          p.estatus,
    partidas: (partidasRes.data ?? []).map(pm => ({
      id:                pm.id_partida_ped_maq,
      descripcion:       pm.descripcion       ?? '',
      largo_cm:          Number(pm.largo_cm),
      ancho_cm:          Number(pm.ancho_cm),
      cantidad:          pm.cantidad,
      metros2:           Number(pm.metros2),
      subtotal_partida:  Number(pm.subtotal_partida),
      estatus_entrega:   pm.estatus_entrega,
      fecha_entrega_real: pm.fecha_entrega_real ?? null,
      procesos: (pm.proceso_partida_pedido_maquila ?? []).map(pp => ({
        nombre:            pp.proceso?.nombre             ?? '',
        unidad:            pp.proceso?.unidad_cobro?.nombre ?? '',
        cantidad_unidades: Number(pp.cantidad_unidades),
        precio_unitario:   Number(pp.precio_unitario),
        subtotal:          Number(pp.subtotal),
      })),
    })),
  }
}

// ── Entregar una línea de pedido maquila ─────────────────────────────────────
// Actualiza estatus_entrega y recalcula estatus del pedido padre

export const entregarPartidaMaquila = async (id_partida_ped_maq) => {
  const { data: pm, error: pmErr } = await supabase
    .from('partida_pedido_maquila')
    .update({ estatus_entrega: 'ENTREGADO', fecha_entrega_real: new Date().toISOString() })
    .eq('id_partida_ped_maq', id_partida_ped_maq)
    .select('id_pedido')
    .single()
  if (pmErr) throw pmErr

  const id_pedido = pm.id_pedido
  const { data: todas, error: todasErr } = await supabase
    .from('partida_pedido_maquila')
    .select('estatus_entrega')
    .eq('id_pedido', id_pedido)
  if (todasErr) throw todasErr

  const total      = todas.length
  const entregadas = todas.filter(r => r.estatus_entrega === 'ENTREGADO').length
  const nuevoEstatus =
    entregadas === total ? 'ENTREGADO' :
    entregadas > 0       ? 'PARCIAL'   : null

  if (nuevoEstatus) {
    const { error: pedErr } = await supabase
      .from('pedido')
      .update({
        estatus:       nuevoEstatus,
        ...(nuevoEstatus === 'ENTREGADO' ? { fecha_entrega: new Date().toISOString() } : {}),
      })
      .eq('id_pedido', id_pedido)
    if (pedErr) throw pedErr
  }

  return true
}

// ── Pedidos de maquila entregados (historial) ────────────────────────────────

export const getPedidosEntregadosMaquila = async (fechaDesde, fechaHasta) => {
  let query = supabase
    .from('pedido')
    .select('*, cliente(id_cliente, nombre)')
    .eq('tipo_pedido', 'MAQUILA')
    .eq('estatus', 'ENTREGADO')
    .order('fecha_entrega', { ascending: false })

  if (fechaDesde) query = query.gte('fecha_entrega', mxDayBound(fechaDesde))
  if (fechaHasta) query = query.lte('fecha_entrega', mxDayBound(fechaHasta, true))

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map(row => {
    const { fecha }           = formatearFechaHora(row.fecha_pedido)
    const { fecha: fechaEnt } = row.fecha_entrega ? formatearFechaHora(row.fecha_entrega) : { fecha: '—' }
    return {
      id:              row.id_pedido,
      folio:           row.folio,
      fecha,
      fechaEntrega:    fechaEnt,
      fechaEntregaISO: row.fecha_entrega,
      clienteNombre:   row.cliente?.nombre ?? 'Mostrador',
      total:           Number(row.total ?? 0),
      tipo_pago:       row.tipo_pago,
      anticipo:        Number(row.monto_anticipo ?? 0),
    }
  })
}

// ── Marcar anticipo como liquidado (US-12) ───────────────────────────────────

export const marcarAnticipoLiquidado = async (id_pedido) => {
  const { data, error } = await supabase.rpc('sp_marcar_anticipo_liquidado', {
    p_id_pedido: id_pedido,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  assertSP(row, 'no encontrado')
  return true
}
