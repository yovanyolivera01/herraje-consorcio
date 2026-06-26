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
function formatearFechaHora(isoString) {
  if (!isoString) return { fecha: '—', hora: '—' }
  const utc = /Z|[+-]\d{2}:?\d{2}$/.test(isoString) ? isoString : isoString + 'Z'
  const d = new Date(utc)
  return {
    fecha: new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(d),
    hora:  new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d).slice(0, 5),
  }
}

// ── Tonos ─────────────────────────────────────────────────────────────────────

export const getTonos = async () => apiFetch('/tonos')

export const createTono = async ({ nombre }) =>
  apiFetch('/tonos', { method: 'POST', body: { nombre } })

export const updateTono = async (id_tono, campos) =>
  apiFetch(`/tonos/${id_tono}`, { method: 'PUT', body: campos })

// ── Espesores ─────────────────────────────────────────────────────────────────

export const getEspesores = async () => apiFetch('/espesores')

export const createEspesor = async ({ valor_mm, etiqueta }) =>
  apiFetch('/espesores', { method: 'POST', body: { valor_mm: Number(valor_mm), etiqueta } })

export const updateEspesor = async (id_espesor, campos) =>
  apiFetch(`/espesores/${id_espesor}`, { method: 'PUT', body: campos })

// ── Tipos de vidrio ───────────────────────────────────────────────────────────

export const getTiposVidrio = async () => apiFetch('/tipos-vidrio')

export const createTipoVidrio = async ({ id_tono, id_espesor, clave, descripcion }) =>
  apiFetch('/tipos-vidrio', { method: 'POST', body: { id_tono, id_espesor, clave, descripcion } })

export const updateTipoVidrio = async (id_tipo_vidrio, campos) =>
  apiFetch(`/tipos-vidrio/${id_tipo_vidrio}`, { method: 'PUT', body: campos })

// ── Niveles de precio ─────────────────────────────────────────────────────────

export const getNivelesPrecio = async () => apiFetch('/niveles-precio')

// ── Precios de vidrio ─────────────────────────────────────────────────────────

export const getPreciosVidrio = async () => apiFetch('/precios-vidrio')

export const guardarPrecio = async ({ id_tipo_vidrio, id_nivel_precio, precio_m2 }) =>
  apiFetch('/precios-vidrio', { method: 'POST', body: { id_tipo_vidrio, id_nivel_precio, precio_m2: Number(precio_m2) } })

// ── Clientes ──────────────────────────────────────────────────────────────────

export const getClientes = async () => apiFetch('/clientes')

export const createCliente = async ({ nombre, telefono, correo, id_nivel_precio }) =>
  apiFetch('/clientes', { method: 'POST', body: { nombre, telefono: telefono || null, correo: correo || null, id_nivel_precio: id_nivel_precio || null } })

export const updateCliente = async (id_cliente, campos) =>
  apiFetch(`/clientes/${id_cliente}`, { method: 'PUT', body: campos })

// ── Procesos ──────────────────────────────────────────────────────────────────

export const getProcesos = async () => apiFetch('/procesos')

export const createProceso = async ({ nombre, id_unidad_cobro, precio_unitario = 0, tipo = 'PROCESO', diametro_mm = null }) =>
  apiFetch('/procesos', { method: 'POST', body: { nombre, id_unidad_cobro, precio_unitario: Number(precio_unitario), tipo, diametro_mm: diametro_mm ?? null } })

export const updateProceso = async (id_proceso, campos) =>
  apiFetch(`/procesos/${id_proceso}`, { method: 'PUT', body: campos })

// ── Precios de proceso por nivel ──────────────────────────────────────────────

export const getPreciosProceso = async () => apiFetch('/precios-proceso')

export const guardarPreciosProceso = async (id_proceso, precios) => {
  if (!precios.length) return []
  return apiFetch('/precios-proceso', { method: 'POST', body: { id_proceso, precios } })
}

// ── Precios especiales (Barrenos / Saque) ─────────────────────────────────────

export const getPreciosProcesoEspecial = async () => apiFetch('/precios-proceso-especial')

export const guardarPreciosProcesoEspecial = async (id_proceso, precios) => {
  if (!precios.length) return []
  return apiFetch('/precios-proceso-especial', { method: 'POST', body: { id_proceso, precios } })
}

// ── Unidades de cobro ─────────────────────────────────────────────────────────

export const getUnidadesCobro = async () => apiFetch('/unidades-cobro')

export const getTiposPago = async () => apiFetch('/tipos-pago')

// ── Cotizaciones ──────────────────────────────────────────────────────────────

export const iniciarCotizacion = async ({ id_nivel_precio, id_cliente = null, observaciones = null }) =>
  apiFetch('/cotizaciones', { method: 'POST', body: { id_nivel_precio, id_cliente: id_cliente || null, observaciones: observaciones || null } })

export const agregarPartida = async (id_cotizacion, partida) =>
  apiFetch(`/cotizaciones/${id_cotizacion}/partidas`, { method: 'POST', body: partida })

export const actualizarCotizacion = async (id_cotizacion, { id_nivel_precio, id_cliente, partidas, total }) =>
  apiFetch(`/cotizaciones/${id_cotizacion}/actualizar`, { method: 'PUT', body: { id_nivel_precio, id_cliente, partidas, total } })

export const finalizarCotizacion = async (id_cotizacion, total) =>
  apiFetch(`/cotizaciones/${id_cotizacion}`, { method: 'PUT', body: { total: Number(total), estatus: 'FINALIZADA' } })

export const cancelarCotizacion = async (id_cotizacion) =>
  apiFetch(`/cotizaciones/${id_cotizacion}`, { method: 'PUT', body: { estatus: 'CANCELADA' } })

export const getCotizaciones = async () => {
  const rows = await apiFetch('/cotizaciones')
  return rows.map(row => {
    const { fecha, hora } = formatearFechaHora(row.fecha)
    return {
      id:            row.id_cotizacion,
      folio:         row.folio,
      fecha,
      hora,
      fechaISO:      row.fecha,
      clienteNombre: row.cliente?.nombre ?? 'Mostrador',
      nivelNombre:   row.nivel_precio?.es_hoja_completa ? 'POR HOJA' : (row.nivel_precio?.nombre ?? ''),
      total:         Number(row.total),
      estatus:       row.estatus,
      observaciones: row.observaciones,
    }
  })
}

// ── Partidas extra (maquila / productos generales) ────────────────────────────

export const agregarPartidaExtra = async (id_cotizacion, partida) =>
  apiFetch(`/cotizaciones/${id_cotizacion}/extras`, { method: 'POST', body: partida })

export const getPartidasExtra = async (id_cotizacion) =>
  apiFetch(`/cotizaciones/${id_cotizacion}/extras`)

export const deletePartidasExtra = async (id_cotizacion) =>
  apiFetch(`/cotizaciones/${id_cotizacion}/extras`, { method: 'DELETE' })

export const getDetalleCotizacion = async (id) => {
  const row = await apiFetch(`/cotizaciones/${id}`)
  const { fecha, hora } = formatearFechaHora(row.fecha)
  return {
    id:            row.id_cotizacion,
    folio:         row.folio,
    fecha,
    hora,
    fechaISO:      row.fecha,
    cliente:       row.cliente,
    nivel:         row.nivel,
    total:         Number(row.total),
    estatus:       row.estatus,
    observaciones: row.observaciones,
    partidas: (row.partidas ?? []).map(p => ({
      id:                 p.id_partida,
      tipoVidrio:         p.tipo_vidrio,
      piezas:             Number(p.piezas ?? 1),
      largo_cm:           Number(p.largo_cm),
      ancho_cm:           Number(p.ancho_cm),
      metros2:            Number(p.metros2),
      precio_m2_aplicado: Number(p.precio_m2_aplicado),
      subtotal_vidrio:    Number(p.subtotal_vidrio),
      subtotal_procesos:  Number(p.subtotal_procesos),
      subtotal_partida:   Number(p.subtotal_partida),
      es_hoja_completa:   p.es_hoja_completa,
      procesos: (p.partida_proceso ?? []).map(pp => ({
        id:              pp.id_partida_proceso,
        id_proceso:      pp.id_proceso,
        id_unidad_cobro: pp.id_unidad_cobro,
        nombre:          pp.proceso?.nombre ?? '',
        unidad:          pp.proceso?.unidad_cobro?.nombre ?? '',
        cantidad:        Number(pp.cantidad),
        precio_unitario: Number(pp.precio_unitario),
        subtotal:        Number(pp.subtotal),
      })),
    })),
    extras: (row.extras ?? []).map(e => ({
      id:                  e.id_partida_extra,
      tipo:                e.tipo,
      descripcion:         e.descripcion ?? '',
      unidad:              e.unidad ?? 'pza',
      cantidad:            Number(e.cantidad),
      precio_unitario:     Number(e.precio_unitario),
      subtotal:            Number(e.subtotal),
      id_producto_general: e.id_producto_general,
    })),
  }
}
