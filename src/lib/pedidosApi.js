import { supabase } from './supabase'

// ── Helpers ───────────────────────────────────────────────────────────────

function formatearFechaHora(isoString) {
  if (!isoString) return { fecha: '—', hora: '—' }
  const d = new Date(isoString)
  return {
    fecha: new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
    hora:  new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d).slice(0, 5),
  }
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
  return row.out_id_pedido
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
  return row.out_id_pedido
}

// ── Pedidos pendientes  (HU-10) ───────────────────────────────────────────
//
//  SP: sp_obtener_pedidos_pendientes()
//  Incluye campos calculados: dias_pendiente, num_partidas

export const getPedidosPendientes = async () => {
  const { data, error } = await supabase.rpc('sp_obtener_pedidos_pendientes')
  if (error) throw error
  return (data ?? []).map(row => {
    const { fecha, hora } = formatearFechaHora(row.fecha_creacion)
    return {
      id:              row.id_pedido,
      folio:           row.folio,
      fecha,
      hora,
      fechaCreacionISO: row.fecha_creacion,
      clienteNombre:   row.cliente ?? 'Mostrador',
      telefono:        row.telefono_cliente ?? '',
      total:           Number(row.total),
      anticipo:        Number(row.monto_anticipo),
      saldo:           Number(row.saldo_pendiente),
      diasPendiente:   row.dias_pendiente ?? 0,
      numPartidas:     Number(row.num_partidas ?? 0),
      observaciones:   row.observaciones ?? '',
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
      folio:           row.folio,
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
  const [cabRes, partRes, procRes] = await Promise.all([
    supabase.rpc('sp_obtener_cabecera_pedido', { p_id_pedido: id_pedido }),
    supabase.rpc('sp_obtener_partidas_pedido', { p_id_pedido: id_pedido }),
    supabase.rpc('sp_obtener_procesos_pedido', { p_id_pedido: id_pedido }),
  ])
  if (cabRes.error)  throw cabRes.error
  if (partRes.error) throw partRes.error
  if (procRes.error) throw procRes.error

  const cab = Array.isArray(cabRes.data) ? cabRes.data[0] : cabRes.data
  if (!cab) throw new Error('Pedido no encontrado')

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

  return {
    id:              cab.id_pedido,
    id_cotizacion:   cab.id_cotizacion,
    folio:           cab.folio,
    fecha,
    hora,
    fechaEntrega:    fechaEnt,
    fechaCreacionISO: cab.fecha_creacion,
    fechaEntregaISO:  cab.fecha_entrega,
    cliente:  { nombre: cab.cliente ?? 'Mostrador', telefono: cab.telefono_cliente ?? '' },
    nivel:    { nombre: cab.nivel_precio ?? '' },
    total:    Number(cab.total),
    tipo_pago:     cab.tipo_pago,
    forma_pago:    cab.tipo_pago,   // alias para código existente
    anticipo:      Number(cab.monto_anticipo),
    saldo:         Number(cab.saldo_pendiente),
    saldo_cobrado: cab.monto_cobrado_entrega != null ? Number(cab.monto_cobrado_entrega) : null,
    estado:        cab.estatus,     // alias para código existente (usa 'estado' en páginas)
    estatus:       cab.estatus,
    observaciones: cab.observaciones ?? '',
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
