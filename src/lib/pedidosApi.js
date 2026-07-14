import { mxDayBound } from './utils'

const API = import.meta.env.VITE_API_URL || ''

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
const fmtFolio = (folio) => folio ? folio.replace(/^([A-Z]+-?)0+(\d)/, '$1$2') : ''

function formatearFechaHora(isoString) {
  if (!isoString) return { fecha: '—', hora: '—' }
  const d = new Date(isoString)
  return {
    fecha: new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(d),
    hora:  new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d).slice(0, 5),
  }
}

// ── Conversión cotización → pedido ────────────────────────────────────────────

export const convertirCotizacionAPedido = async (id_cotizacion, tipo_pago, monto_anticipo, metodo_pago) => {
  const data = await apiFetch('/pedidos/convertir', {
    method: 'POST',
    body: { id_cotizacion, tipo_pago, monto_anticipo: Number(monto_anticipo), metodo_pago: metodo_pago || null },
  })
  return data.id_pedido
}

// ── Decrementar inventario desde partidas en memoria ─────────────────────────

export const decrementarInventarioDesdePartidas = async (partidas, folioRef = '') => {
  try {
    await apiFetch('/pedidos/decrementar-inventario', {
      method: 'POST',
      body: { partidas, folioRef },
    })
  } catch (e) {
    console.error('[inventario]', e.message)
  }
}

// ── Crear pedido directo ──────────────────────────────────────────────────────

export const crearPedidoDirecto = async ({ id_cliente, id_nivel_precio, partidas, tipo_pago, monto_anticipo, metodo_pago }) => {
  const data = await apiFetch('/pedidos/directo', {
    method: 'POST',
    body: { id_cliente: id_cliente ?? null, id_nivel_precio, partidas, tipo_pago, monto_anticipo: Number(monto_anticipo), metodo_pago: metodo_pago || null },
  })
  return data.id_pedido
}

export const crearPedidoDirectoConExtras = async ({ id_cliente, id_nivel_precio, partidas, tipo_pago, monto_anticipo, extras, total, metodo_pago }) => {
  const data = await apiFetch('/pedidos/directo-con-extras', {
    method: 'POST',
    body: { id_cliente: id_cliente ?? null, id_nivel_precio, partidas, tipo_pago, monto_anticipo: Number(monto_anticipo), extras, total: Number(total), metodo_pago: metodo_pago || null },
  })
  return data.id_pedido
}

// ── Pedidos pendientes ────────────────────────────────────────────────────────

export const getPedidosPendientes = async () => {
  const rows = await apiFetch('/pedidos/pendientes')
  return rows.map(row => {
    const { fecha, hora } = formatearFechaHora(row.fecha_pedido)
    return {
      id:               row.id_pedido,
      folio:            row.folio,
      fecha,
      hora,
      fechaCreacionISO:   row.fecha_pedido,
      clienteNombre:      row.cliente ?? 'Mostrador',
      telefono:           '',
      total:              Number(row.total),
      anticipo:           Number(row.monto_anticipo),
      saldo:              Number(row.total) - Number(row.monto_anticipo),
      estatus:            row.estatus,
      tipo_pago:          row.tipo_pago ?? null,
      diasPendiente:      0,
      numPartidas:        Number(row.partidas_total      ?? 0),
      partidasPendientes: Number(row.partidas_pendientes ?? 0),
      observaciones:      '',
    }
  })
}

// ── Pedidos entregados / historial de ventas ──────────────────────────────────

export const getPedidosEntregados = async (fechaDesde, fechaHasta) => {
  const params = new URLSearchParams()
  if (fechaDesde) params.set('fecha_inicio', fechaDesde)
  if (fechaHasta) params.set('fecha_fin',    fechaHasta)
  const rows = await apiFetch(`/pedidos/historial?${params}`)

  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.id_pedido)) {
      const { fecha, hora }     = formatearFechaHora(row.fecha_creacion)
      const { fecha: fechaEnt } = row.fecha_entrega ? formatearFechaHora(row.fecha_entrega) : { fecha: '—' }
      map.set(row.id_pedido, {
        id:              row.id_pedido,
        folio:           fmtFolio(row.folio),
        fecha,
        hora,
        fechaEntrega:    fechaEnt,
        fechaEntregaISO: row.fecha_entrega,
        clienteNombre:   row.cliente ?? 'Mostrador',
        nivelNombre:     row.nivel_precio ?? '',
        tipo_pago:       row.tipo_pago,
        forma_pago:      row.tipo_pago,
        total:           Number(row.total),
        anticipo:        Number(row.monto_anticipo),
        saldo_cobrado:   row.monto_cobrado_entrega != null ? Number(row.monto_cobrado_entrega) : null,
        totalCobrado:    Number(row.total_cobrado),
        partidas:        [],
      })
    }
    if (row.largo_cm != null) {
      map.get(row.id_pedido).partidas.push({
        tipo_vidrio: row.tipo_vidrio ?? '—',
        largo_cm:    Number(row.largo_cm),
        ancho_cm:    Number(row.ancho_cm),
      })
    }
  }
  return Array.from(map.values())
}

// ── Detalle completo de un pedido ─────────────────────────────────────────────

export const getDetallePedido = async (id_pedido) => {
  const data = await apiFetch(`/pedidos/${id_pedido}`)
  const cab  = data.cabecera

  const id_cotizacion = cab.id_cotizacion ?? null
  const { fecha, hora }     = formatearFechaHora(cab.fecha_creacion)
  const { fecha: fechaEnt } = cab.fecha_entrega ? formatearFechaHora(cab.fecha_entrega) : { fecha: '—' }

  const procesosPorPartida = {}
  for (const pr of (data.procesos ?? [])) {
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
    id_cotizacion,
    folio:            fmtFolio(cab.folio),
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
    metodo_pago:  cab.metodo_pago ?? null,
    anticipo:     Number(cab.monto_anticipo),
    saldo:        Number(cab.total) - Number(cab.monto_anticipo),
    saldo_cobrado: cab.monto_cobrado_entrega != null ? Number(cab.monto_cobrado_entrega) : null,
    estado:       cab.estatus,
    estatus:      cab.estatus,
    observaciones: cab.observaciones ?? '',
    extras: data.extras ?? [],
    partidas: (data.partidas ?? []).map(p => ({
      id:                 p.id_partida_pedido,
      clave_vidrio:       p.tipo_vidrio      ?? '—',
      descripcion_vidrio: '',
      largo_cm:           Number(p.largo_cm),
      ancho_cm:           Number(p.ancho_cm),
      metros2:            Number(p.metros_cuadrados),
      precio_m2_aplicado: Number(p.precio_m2),
      subtotal_vidrio:    Number(p.subtotal_vidrio),
      subtotal_procesos:  Number(p.subtotal_procesos),
      subtotal_partida:   Number(p.total_partida),
      cantidad:           p.cantidad,
      procesos:           procesosPorPartida[p.id_partida_pedido] ?? [],
    })),
  }
}

// ── Marcar pedido como entregado ──────────────────────────────────────────────

export const marcarComoEntregado = async (id_pedido, monto_cobrado) =>
  apiFetch(`/pedidos/${id_pedido}/entregar`, { method: 'POST', body: { monto_cobrado: Number(monto_cobrado) } })

// ── Entregar línea específica del pedido ──────────────────────────────────────

export const entregarPartidaPedido = async (id_partida_pedido) =>
  apiFetch(`/pedidos/${id_partida_pedido}/entregar-partida`, { method: 'POST', body: {} })

// ── Marcar anticipo como liquidado ────────────────────────────────────────────

export const marcarAnticipoLiquidado = async (id_pedido) =>
  apiFetch(`/pedidos/${id_pedido}/liquidar`, { method: 'POST', body: {} })

// ── Export a Excel ────────────────────────────────────────────────────────────

export const getPedidosParaExport = async (fechaDesde, fechaHasta) => {
  const params = new URLSearchParams()
  if (fechaDesde) params.set('fecha_inicio', fechaDesde)
  if (fechaHasta) params.set('fecha_fin',    fechaHasta)
  return apiFetch(`/pedidos/exportar?${params}`)
}

export const getPedidosCredito = async () => {
  const rows = await apiFetch('/pedidos/credito')
  return rows.map(row => {
    const { fecha, hora } = formatearFechaHora(row.fecha_creacion)
    return {
      id:             row.id_pedido,
      folio:          fmtFolio(row.folio),
      fecha,
      hora,
      fechaCreacionISO: row.fecha_creacion,
      clienteNombre:  row.cliente ?? 'Mostrador',
      total:          Number(row.total),
      anticipo:       Number(row.monto_anticipo ?? 0),
      saldo:          Number(row.total) - Number(row.monto_anticipo ?? 0),
      estatus:        row.estatus,
      tipo:           row.tipo ?? 'VIDRIO',
      tipo_pago:      'CREDITO',
    }
  })
}
