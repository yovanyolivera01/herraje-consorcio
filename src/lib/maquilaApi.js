import { http } from './http'
import { mxDayBound } from './utils'

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

// ── Cotizaciones de maquila ───────────────────────────────────────────────

export const iniciarCotizacionMaquila = (datos) =>
  http.post('/api/maquila/cotizaciones', datos)

export const agregarPartidaMaquila = (id_cotizacion, datos) =>
  http.post(`/api/maquila/cotizaciones/${id_cotizacion}/partidas`, datos)

export const eliminarPartidaMaquila = (id_partida) =>
  http.del(`/api/maquila/partidas/${id_partida}`)

export const finalizarCotizacionMaquila = (id_cotizacion) =>
  http.post(`/api/maquila/cotizaciones/${id_cotizacion}/finalizar`)

export const getTicketMaquila = (id_cotizacion) =>
  http.get(`/api/maquila/cotizaciones/${id_cotizacion}/ticket`)

export const getCotizacionesMaquila = async () => {
  const rows = await http.get('/api/maquila/cotizaciones')
  return rows.map(row => {
    const { fecha, hora } = formatearFechaHora(row.fecha)
    return {
      id:            row.id_cotizacion,
      folio:         row.folio,
      fecha,
      hora,
      fechaISO:      row.fecha,
      clienteNombre: row.cliente_nombre ?? 'Mostrador',
      nivelNombre:   row.nivel_nombre   ?? '',
      total:         Number(row.total   ?? 0),
      estatus:       row.estatus,
      observaciones: row.observaciones  ?? '',
    }
  })
}

export const getDetalleCotizacionMaquila = async (id_cotizacion) => {
  const data = await http.get(`/api/maquila/cotizaciones/${id_cotizacion}`)
  const { fecha, hora } = formatearFechaHora(data.fecha)
  return {
    id:            data.id_cotizacion,
    folio:         data.folio,
    fecha,
    hora,
    fechaISO:      data.fecha,
    cliente:       data.cliente,
    nivel:         data.nivel,
    total:         Number(data.total ?? 0),
    estatus:       data.estatus,
    observaciones: data.observaciones ?? '',
    partidas: (data.partidas ?? []).map(p => ({
      id:                p.id_partida_maquila,
      descripcion:       p.descripcion        ?? '',
      largo_cm:          Number(p.largo_cm),
      ancho_cm:          Number(p.ancho_cm),
      cantidad:          p.cantidad,
      metros2:           Number(p.metros2),
      subtotal_procesos: Number(p.subtotal_procesos),
      subtotal_partida:  Number(p.subtotal_partida),
      procesos: (p.procesos ?? []).map(pp => ({
        id:               pp.id_proceso_pm,
        id_proceso:       pp.id_proceso,
        nombre:           pp.nombre           ?? '',
        unidad:           pp.unidad           ?? '',
        cantidad_unidades: Number(pp.cantidad_unidades),
        precio_unitario:  Number(pp.precio_unitario),
        subtotal:         Number(pp.subtotal),
      })),
    })),
  }
}

export const reabrirCotizacion = (id_cotizacion) =>
  http.post(`/api/maquila/cotizaciones/${id_cotizacion}/reabrir`)

export const convertirMaquilaAPedido = (datos) =>
  http.post('/api/maquila/pedidos/convertir', datos)

// ── Pedidos de maquila ────────────────────────────────────────────────────

export const getPedidosPendientesMaquila = async () => {
  const rows = await http.get('/api/maquila/pedidos/pendientes')
  return rows.map(row => {
    const { fecha, hora } = formatearFechaHora(row.fecha_pedido)
    return {
      id:                 row.id_pedido,
      folio:              row.folio,
      fecha,
      hora,
      fechaPedidoISO:     row.fecha_pedido,
      clienteNombre:      row.cliente        ?? 'Mostrador',
      total:              Number(row.total),
      anticipo:           Number(row.monto_anticipo),
      saldo:              Number(row.saldo_pendiente),
      estatus:            row.estatus,
      partidasPendientes: Number(row.partidas_pendientes ?? 0),
      numPartidas:        Number(row.partidas_total      ?? 0),
    }
  })
}

export const getDetallePedidoMaquila = async (id_pedido) => {
  const data = await http.get(`/api/maquila/pedidos/${id_pedido}`)
  const { fecha, hora } = formatearFechaHora(data.fecha_pedido)
  return {
    id:              data.id_pedido,
    folio:           data.folio,
    folioCotizacion: data.folio_cotizacion ?? '',
    fecha,
    hora,
    fechaPedidoISO:  data.fecha_pedido,
    cliente:         data.cliente,
    total:           Number(data.total),
    tipo_pago:       data.tipo_pago,
    anticipo:        Number(data.monto_anticipo),
    saldo:           Number(data.saldo_pendiente),
    estatus:         data.estatus,
    partidas: (data.partidas ?? []).map(pm => ({
      id:                 pm.id_partida_ped_maq,
      descripcion:        pm.descripcion        ?? '',
      largo_cm:           Number(pm.largo_cm),
      ancho_cm:           Number(pm.ancho_cm),
      cantidad:           pm.cantidad,
      metros2:            Number(pm.metros2),
      subtotal_partida:   Number(pm.subtotal_partida),
      estatus_entrega:    pm.estatus_entrega,
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

export const entregarPartidaMaquila = (id_partida_ped_maq) =>
  http.post(`/api/maquila/partidas-pedido/${id_partida_ped_maq}/entregar`)

export const getPedidosEntregadosMaquila = async (fechaDesde, fechaHasta) => {
  const params = new URLSearchParams()
  if (fechaDesde) params.set('fecha_inicio', fechaDesde)
  if (fechaHasta) params.set('fecha_fin',    fechaHasta)
  const rows = await http.get(`/api/maquila/pedidos/historial?${params}`)
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
      total:           Number(row.total   ?? 0),
      tipo_pago:       row.tipo_pago,
      anticipo:        Number(row.monto_anticipo ?? 0),
    }
  })
}

export const marcarAnticipoLiquidado = (id_pedido) =>
  http.post(`/api/maquila/pedidos/${id_pedido}/liquidar`)
