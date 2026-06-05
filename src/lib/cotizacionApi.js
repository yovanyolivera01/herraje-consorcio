import { http } from './http'

// Wrapper para compatibilidad con componentes que esperan { data, error }
async function safe(fn) {
  try   { return { data: await fn(), error: null } }
  catch (e) { return { data: null, error: e.message ?? String(e) } }
}

// ── Helpers ───────────────────────────────────────────────────────────────

const TZ = 'America/Mexico_City'
function formatearFechaHora(isoString) {
  const utc = /Z|[+-]\d{2}:?\d{2}$/.test(isoString ?? '') ? isoString : (isoString ?? '') + 'Z'
  const d = new Date(utc)
  return {
    fecha: new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(d),
    hora:  new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d).slice(0, 5),
  }
}

// ── Tonos ─────────────────────────────────────────────────────────────────

export const getTonos = () => http.get('/api/tonos')

export const createTono = ({ nombre }) => http.post('/api/tonos', { nombre })

export const updateTono = (id_tono, campos) => http.put(`/api/tonos/${id_tono}`, campos)

// ── Espesores ─────────────────────────────────────────────────────────────

export const getEspesores = () => http.get('/api/espesores')

export const createEspesor = ({ valor_mm, etiqueta }) =>
  http.post('/api/espesores', { valor_mm: Number(valor_mm), etiqueta })

export const updateEspesor = (id_espesor, campos) =>
  http.put(`/api/espesores/${id_espesor}`, campos)

// ── Tipos de vidrio ───────────────────────────────────────────────────────

export const getTiposVidrio = () => http.get('/api/tipos-vidrio')

export const createTipoVidrio = ({ id_tono, id_espesor, clave, descripcion }) =>
  http.post('/api/tipos-vidrio', { id_tono, id_espesor, clave, descripcion })

export const updateTipoVidrio = (id_tipo_vidrio, campos) =>
  http.put(`/api/tipos-vidrio/${id_tipo_vidrio}`, campos)

// ── Niveles de precio ─────────────────────────────────────────────────────

export const getNivelesPrecio = () => http.get('/api/niveles-precio')

// ── Precios de vidrio ─────────────────────────────────────────────────────

export const getPreciosVidrio = () => http.get('/api/precios-vidrio')

export const guardarPrecio = ({ id_tipo_vidrio, id_nivel_precio, precio_m2 }) =>
  http.post('/api/precios-vidrio', { id_tipo_vidrio, id_nivel_precio, precio_m2: Number(precio_m2) })

// ── Clientes ──────────────────────────────────────────────────────────────

export const getClientes = () => http.get('/api/clientes')

export const createCliente = ({ nombre, telefono, correo, id_nivel_precio }) =>
  http.post('/api/clientes', { nombre, telefono: telefono || null, correo: correo || null, id_nivel_precio: id_nivel_precio || null })

export const updateCliente = (id_cliente, campos) =>
  http.put(`/api/clientes/${id_cliente}`, campos)

// ── Procesos ──────────────────────────────────────────────────────────────

export const getProcesos = () => http.get('/api/procesos')

export const createProceso = ({ nombre, id_unidad_cobro, precio_unitario = 0 }) =>
  http.post('/api/procesos', { nombre, id_unidad_cobro, precio_unitario: Number(precio_unitario) })

export const updateProceso = (id_proceso, campos) =>
  http.put(`/api/procesos/${id_proceso}`, campos)

// ── Precios de proceso ────────────────────────────────────────────────────

export const getPreciosProceso = () => http.get('/api/precios-proceso')

export const guardarPreciosProceso = async (id_proceso, precios) => {
  if (!precios.length) return []
  return http.post('/api/precios-proceso', { id_proceso, precios })
}

// ── Precios de proceso especial (sin espesor) ─────────────────────────────

export const getPreciosProcesoEspecial = () => http.get('/api/precios-proceso-especial')

export const guardarPreciosProcesoEspecial = async (id_proceso, precios) => {
  if (!precios.length) return []
  return http.post('/api/precios-proceso-especial', { id_proceso, precios })
}

// ── Unidades de cobro ─────────────────────────────────────────────────────

export const getUnidadesCobro = () => http.get('/api/unidades-cobro')

// ── Cotizaciones ──────────────────────────────────────────────────────────

export const iniciarCotizacion = ({ id_nivel_precio, id_cliente = null, observaciones = null }) =>
  safe(() => http.post('/api/cotizaciones', { id_nivel_precio, id_cliente, observaciones }))

export const agregarPartida = (id_cotizacion, partida) =>
  safe(() => http.post(`/api/cotizaciones/${id_cotizacion}/partidas`, partida))

export const actualizarCotizacion = (id_cotizacion, datos) =>
  safe(() => http.put(`/api/cotizaciones/${id_cotizacion}/actualizar`, datos))

export const finalizarCotizacion = (id_cotizacion, total) =>
  safe(() => http.put(`/api/cotizaciones/${id_cotizacion}`, { total: Number(total), estatus: 'FINALIZADA' }))

export const cancelarCotizacion = (id_cotizacion) =>
  safe(() => http.put(`/api/cotizaciones/${id_cotizacion}`, { estatus: 'CANCELADA' }))

export const getCotizaciones = async () => {
  const rows = await http.get('/api/cotizaciones')
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

// ── Partidas extra (maquila / productos generales) ────────────────────────

export const agregarPartidaExtra = (id_cotizacion, partida) =>
  safe(() => http.post(`/api/cotizaciones/${id_cotizacion}/extras`, partida))

export const getPartidasExtra = (id_cotizacion) =>
  http.get(`/api/cotizaciones/${id_cotizacion}/extras`)

export const deletePartidasExtra = (id_cotizacion) =>
  safe(() => http.del(`/api/cotizaciones/${id_cotizacion}/extras`))

// ── Detalle completo de cotización ────────────────────────────────────────

export const getDetalleCotizacion = async (id) => {
  const data = await http.get(`/api/cotizaciones/${id}`)
  const { fecha, hora } = formatearFechaHora(data.fecha)
  return {
    id:            data.id_cotizacion,
    folio:         data.folio,
    fecha,
    hora,
    fechaISO:      data.fecha,
    cliente:       data.cliente,
    nivel:         data.nivel,
    total:         Number(data.total),
    estatus:       data.estatus,
    observaciones: data.observaciones,
    partidas: (data.partidas ?? []).map(p => ({
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
    extras: (data.extras ?? []).map(e => ({
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
