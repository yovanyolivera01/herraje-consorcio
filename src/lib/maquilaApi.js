import { mxDayBound } from './utils'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function apiFetch(path, options = {}) {
  const { method = 'GET', body } = options
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
  return data
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TZ = 'America/Mexico_City'
function formatearFechaHora(isoString) {
  if (!isoString) return { fecha: '—', hora: '—' }
  const utc = /Z|[+-]\d{2}:?\d{2}$/.test(isoString) ? isoString : isoString + 'Z'
  const d = new Date(utc)
  return {
    fecha: new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(d),
    hora:  new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d).slice(0, 5),
  }
}

// ============================================================================
//  COTIZACIONES DE MAQUILA
// ============================================================================

export const iniciarCotizacionMaquila = async ({ id_cliente, id_nivel_precio, observaciones }) =>
  apiFetch('/maquila/cotizaciones', { method: 'POST', body: { id_cliente: id_cliente ?? null, id_nivel_precio, observaciones: observaciones ?? null } })

export const agregarPartidaMaquila = async ({ id_cotizacion, descripcion, largo_cm, ancho_cm, cantidad, procesos }) =>
  apiFetch(`/maquila/cotizaciones/${id_cotizacion}/partidas`, {
    method: 'POST',
    body: { descripcion: descripcion ?? null, largo_cm: Number(largo_cm), ancho_cm: Number(ancho_cm), cantidad: Number(cantidad), procesos: procesos ?? [] },
  })

export const eliminarPartidaMaquila = async (id_partida_maquila) =>
  apiFetch(`/maquila/partidas/${id_partida_maquila}`, { method: 'DELETE' })

export const finalizarCotizacionMaquila = async (id_cotizacion) => {
  const data = await apiFetch(`/maquila/cotizaciones/${id_cotizacion}/finalizar`, { method: 'POST', body: {} })
  return Number(data.total ?? 0)
}

export const getTicketMaquila = async (id_cotizacion) =>
  apiFetch(`/maquila/cotizaciones/${id_cotizacion}/ticket`)

export const getCotizacionesMaquila = async () => {
  const rows = await apiFetch('/maquila/cotizaciones')
  return rows.map(row => {
    const { fecha, hora } = formatearFechaHora(row.fecha)
    return {
      id:            row.id_cotizacion,
      folio:         row.folio,
      fecha,
      hora,
      fechaISO:      row.fecha,
      clienteNombre: row.cliente_nombre ?? 'Mostrador',
      nivelNombre:   row.nivel_nombre ?? '',
      total:         Number(row.total ?? 0),
      estatus:       row.estatus,
      observaciones: row.observaciones ?? '',
    }
  })
}

export const getDetalleCotizacionMaquila = async (id_cotizacion) => {
  const row = await apiFetch(`/maquila/cotizaciones/${id_cotizacion}`)
  const { fecha, hora } = formatearFechaHora(row.fecha)
  return {
    id:            row.id_cotizacion,
    folio:         row.folio,
    fecha,
    hora,
    fechaISO:      row.fecha,
    cliente:       row.cliente,
    nivel:         row.nivel,
    total:         Number(row.total ?? 0),
    estatus:       row.estatus,
    observaciones: row.observaciones ?? '',
    partidas: (row.partidas ?? []).map(p => ({
      id:                p.id_partida_maquila,
      descripcion:       p.descripcion ?? '',
      largo_cm:          Number(p.largo_cm),
      ancho_cm:          Number(p.ancho_cm),
      cantidad:          p.cantidad,
      metros2:           Number(p.metros2),
      subtotal_procesos: Number(p.subtotal_procesos),
      subtotal_partida:  Number(p.subtotal_partida),
      procesos: (p.procesos ?? []).map(pp => ({
        id:                pp.id_proceso_pm,
        id_proceso:        pp.id_proceso,
        nombre:            pp.nombre ?? '',
        unidad:            pp.unidad ?? '',
        cantidad_unidades: Number(pp.cantidad_unidades),
        precio_unitario:   Number(pp.precio_unitario),
        subtotal:          Number(pp.subtotal),
      })),
    })),
  }
}

export const reabrirCotizacion = async (id_cotizacion) =>
  apiFetch(`/maquila/cotizaciones/${id_cotizacion}/reabrir`, { method: 'POST', body: {} })

export const convertirMaquilaAPedido = async ({ id_cotizacion, tipo_pago, monto_anticipo }) =>
  apiFetch('/maquila/pedidos/convertir', { method: 'POST', body: { id_cotizacion, tipo_pago, monto_anticipo: Number(monto_anticipo) } })

// ============================================================================
//  PEDIDOS DE MAQUILA
// ============================================================================

export const getPedidosPendientesMaquila = async () => {
  const rows = await apiFetch('/maquila/pedidos/pendientes')
  return rows.map(row => {
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

export const getDetallePedidoMaquila = async (id_pedido) => {
  const row = await apiFetch(`/maquila/pedidos/${id_pedido}`)
  const { fecha, hora } = formatearFechaHora(row.fecha_pedido)
  return {
    id:              row.id_pedido,
    folio:           row.folio,
    folioCotizacion: row.folio_cotizacion ?? '',
    fecha,
    hora,
    fechaPedidoISO:  row.fecha_pedido,
    cliente:         row.cliente,
    total:           Number(row.total),
    tipo_pago:       row.tipo_pago,
    anticipo:        Number(row.monto_anticipo),
    saldo:           Number(row.saldo_pendiente),
    estatus:         row.estatus,
    partidas: (row.partidas ?? []).map(pm => ({
      id:                pm.id_partida_ped_maq,
      descripcion:       pm.descripcion       ?? '',
      largo_cm:          Number(pm.largo_cm),
      ancho_cm:          Number(pm.ancho_cm),
      cantidad:          pm.cantidad,
      metros2:           Number(pm.metros2),
      subtotal_partida:  Number(pm.subtotal_partida),
      estatus_entrega:   pm.estatus_entrega,
      fecha_entrega_real: pm.fecha_entrega_real ?? null,
      procesos: (pm.procesos ?? []).map(pp => ({
        nombre:            pp.nombre             ?? '',
        unidad:            pp.unidad             ?? '',
        cantidad_unidades: Number(pp.cantidad_unidades),
        precio_unitario:   Number(pp.precio_unitario),
        subtotal:          Number(pp.subtotal),
      })),
    })),
  }
}

export const entregarPartidaMaquila = async (id_partida_ped_maq) =>
  apiFetch(`/maquila/partidas-pedido/${id_partida_ped_maq}/entregar`, { method: 'POST', body: {} })

export const getPedidosEntregadosMaquila = async (fechaDesde, fechaHasta) => {
  const params = new URLSearchParams()
  if (fechaDesde) params.set('fecha_inicio', mxDayBound(fechaDesde))
  if (fechaHasta) params.set('fecha_fin',    mxDayBound(fechaHasta, true))
  const rows = await apiFetch(`/maquila/pedidos/historial?${params}`)
  return rows.map(row => {
    const { fecha }           = formatearFechaHora(row.fecha_pedido)
    const { fecha: fechaEnt } = row.fecha_entrega ? formatearFechaHora(row.fecha_entrega) : { fecha: '—' }
    return {
      id:              row.id_pedido,
      folio:           row.folio,
      fecha,
      fechaEntrega:    fechaEnt,
      fechaEntregaISO: row.fecha_entrega,
      clienteNombre:   row.cliente_nombre ?? 'Mostrador',
      total:           Number(row.total ?? 0),
      tipo_pago:       row.tipo_pago,
      anticipo:        Number(row.monto_anticipo ?? 0),
    }
  })
}

export const marcarAnticipoLiquidado = async (id_pedido) =>
  apiFetch(`/maquila/pedidos/${id_pedido}/liquidar`, { method: 'POST', body: {} })
