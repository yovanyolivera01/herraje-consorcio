import { http } from './http'

// ── Helpers ───────────────────────────────────────────────────────────────

const TZ = 'America/Mexico_City'
function formatearFechaHora(isoString) {
  if (!isoString) return { fecha: '—', hora: '—' }
  const d = new Date(isoString)
  return {
    fecha: new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(d),
    hora:  new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d).slice(0, 5),
  }
}

// ── Conversión cotización → pedido  (HU-08) ───────────────────────────────

export const convertirCotizacionAPedido = async (id_cotizacion, tipo_pago, monto_anticipo) => {
  const data = await http.post('/api/pedidos/convertir', { id_cotizacion, tipo_pago, monto_anticipo })
  return data.id_pedido
}

// ── Crear pedido directo (sin cotización) ─────────────────────────────────

export const crearPedidoDirecto = async ({ id_cliente, id_nivel_precio, partidas, tipo_pago, monto_anticipo }) => {
  const data = await http.post('/api/pedidos/directo', { id_cliente, id_nivel_precio, partidas, tipo_pago, monto_anticipo })
  return data.id_pedido
}

// ── Pedidos pendientes  (HU-10) ───────────────────────────────────────────

export const getPedidosPendientes = async () => {
  const rows = await http.get('/api/pedidos/pendientes')
  return rows.map(row => {
    const { fecha, hora } = formatearFechaHora(row.fecha_creacion)
    return {
      id:               row.id_pedido,
      folio:            row.folio,
      fecha,
      hora,
      fechaCreacionISO: row.fecha_creacion,
      clienteNombre:    row.cliente         ?? 'Mostrador',
      telefono:         row.telefono_cliente ?? '',
      total:            Number(row.total),
      anticipo:         Number(row.monto_anticipo),
      saldo:            Number(row.saldo_pendiente),
      diasPendiente:    row.dias_pendiente   ?? 0,
      numPartidas:      Number(row.num_partidas ?? 0),
      observaciones:    row.observaciones    ?? '',
    }
  })
}

// ── Pedidos entregados / historial de ventas  (HU-09) ─────────────────────

export const getPedidosEntregados = async (fechaDesde, fechaHasta) => {
  const params = new URLSearchParams()
  if (fechaDesde) params.set('fecha_inicio', fechaDesde)
  if (fechaHasta) params.set('fecha_fin', fechaHasta)
  const rows = await http.get(`/api/pedidos/historial?${params}`)
  return rows.map(row => {
    const { fecha, hora }     = formatearFechaHora(row.fecha_creacion)
    const { fecha: fechaEnt } = row.fecha_entrega ? formatearFechaHora(row.fecha_entrega) : { fecha: '—' }
    return {
      id:              row.id_pedido,
      folio:           row.folio,
      fecha,
      hora,
      fechaEntrega:    fechaEnt,
      fechaEntregaISO: row.fecha_entrega,
      clienteNombre:   row.cliente       ?? 'Mostrador',
      nivelNombre:     row.nivel_precio  ?? '',
      tipo_pago:       row.tipo_pago,
      forma_pago:      row.tipo_pago,
      total:           Number(row.total),
      anticipo:        Number(row.monto_anticipo),
      saldo_cobrado:   row.monto_cobrado_entrega != null ? Number(row.monto_cobrado_entrega) : null,
      totalCobrado:    Number(row.total_cobrado),
    }
  })
}

// ── Detalle completo de un pedido ─────────────────────────────────────────

export const getDetallePedido = async (id_pedido) => {
  const { cabecera: cab, partidas: partsRaw, procesos: procsRaw } = await http.get(`/api/pedidos/${id_pedido}`)

  const { fecha, hora }     = formatearFechaHora(cab.fecha_creacion)
  const { fecha: fechaEnt } = cab.fecha_entrega ? formatearFechaHora(cab.fecha_entrega) : { fecha: '—' }

  const procesosPorPartida = {}
  for (const pr of (procsRaw ?? [])) {
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
    id:               cab.id_pedido,
    id_cotizacion:    cab.id_cotizacion,
    folio:            cab.folio,
    fecha,
    hora,
    fechaEntrega:     fechaEnt,
    fechaCreacionISO: cab.fecha_creacion,
    fechaEntregaISO:  cab.fecha_entrega,
    cliente:  { nombre: cab.cliente ?? 'Mostrador', telefono: cab.telefono_cliente ?? '' },
    nivel:    { nombre: cab.nivel_precio ?? '' },
    total:    Number(cab.total),
    tipo_pago:    cab.tipo_pago,
    forma_pago:   cab.tipo_pago,
    anticipo:     Number(cab.monto_anticipo),
    saldo:        Number(cab.saldo_pendiente),
    saldo_cobrado: cab.monto_cobrado_entrega != null ? Number(cab.monto_cobrado_entrega) : null,
    estado:    cab.estatus,
    estatus:   cab.estatus,
    observaciones: cab.observaciones ?? '',
    partidas: (partsRaw ?? []).map(p => {
      const tipo = p.tipo_linea ?? 'VIDRIO'
      const base = {
        id:              p.id_partida_pedido,
        tipo_linea:      tipo,
        subtotal_partida: Number(p.total_partida),
        cantidad:         Number(p.cantidad ?? 0),
      }
      if (tipo === 'VIDRIO') {
        return {
          ...base,
          clave_vidrio:       p.tipo_vidrio      ?? '—',
          descripcion_vidrio: '',
          largo_cm:           Number(p.largo_cm),
          ancho_cm:           Number(p.ancho_cm),
          metros2:            Number(p.metros_cuadrados),
          precio_m2_aplicado: Number(p.precio_m2),
          subtotal_vidrio:    Number(p.subtotal_vidrio),
          subtotal_procesos:  Number(p.subtotal_procesos),
          procesos:           procesosPorPartida[p.id_partida_pedido] ?? [],
        }
      }
      if (tipo === 'HERRAJE') {
        return {
          ...base,
          id_producto:     p.id_producto,
          descripcion:     p.descripcion ?? '',
          precio_unitario: Number(p.precio_unitario),
        }
      }
      // MAQUILA
      return {
        ...base,
        id_proceso:      p.id_proceso_d,
        descripcion:     p.descripcion ?? '',
        precio_unitario: Number(p.precio_unitario),
      }
    }),
  }
}

// ── Marcar pedido como entregado  (HU-11) ────────────────────────────────

export const marcarComoEntregado = async (id_pedido, monto_cobrado) => {
  await http.post(`/api/pedidos/${id_pedido}/entregar`, { monto_cobrado })
  return true
}

// ── Export a Excel  (HU-09) ───────────────────────────────────────────────

export const getPedidosParaExport = async (fechaDesde, fechaHasta) => {
  const params = new URLSearchParams()
  if (fechaDesde) params.set('fecha_inicio', fechaDesde)
  if (fechaHasta) params.set('fecha_fin', fechaHasta)
  return http.get(`/api/pedidos/exportar?${params}`)
}
