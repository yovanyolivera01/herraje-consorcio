import { http } from './http'

// ── Helpers ───────────────────────────────────────────────────────────────

const TZ = 'America/Mexico_City'
function formatearFechaHora(isoString) {
  const utc = /Z|[+-]\d{2}:?\d{2}$/.test(isoString ?? '') ? isoString : (isoString ?? '') + 'Z'
  const d = new Date(utc)
  const fechaFormatter = new Intl.DateTimeFormat('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ,
  })
  const horaFormatter = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
  })
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
  http.post('/api/cotizaciones', { id_nivel_precio, id_cliente, observaciones })

export const agregarPartida = (id_cotizacion, partida) =>
  http.post(`/api/cotizaciones/${id_cotizacion}/partidas`, partida)

export const agregarPartida = async (id_cotizacion, partida) => {
  // metros2 ya incluye el número de piezas: piezas × (largo × ancho / 10000)
  const { data: p, error: pErr } = await supabase
    .from('partida_cotizacion')
    .insert({
      id_cotizacion,
      id_tipo_vidrio:     partida.id_tipo_vidrio,
      largo_cm:           partida.largo_cm,
      ancho_cm:           partida.ancho_cm,
      metros2:            partida.metros2,
      precio_m2_aplicado: partida.precio_m2_aplicado,
      subtotal_vidrio:    partida.subtotal_vidrio,
      subtotal_procesos:  partida.subtotal_procesos ?? 0,
      subtotal_partida:   partida.subtotal_partida,
      es_hoja_completa:   partida.es_hoja_completa ?? false,
    })
    .select()
    .single()
  if (pErr) throw pErr

  // Insertar procesos si los hay
  if (partida.procesos && partida.procesos.length > 0) {
    const rows = partida.procesos.map(proc => ({
      id_partida:      p.id_partida,
      id_proceso:      proc.id_proceso,
      id_unidad_cobro: proc.id_unidad_cobro,
      cantidad:        proc.cantidad,
      precio_unitario: proc.precio_unitario,
      subtotal:        proc.subtotal,
    }))
    const { error: prErr } = await supabase
      .from('partida_proceso')
      .insert(rows)
    if (prErr) throw prErr
  }

  return p
}

export const actualizarCotizacion = async (id_cotizacion, { id_nivel_precio, id_cliente, partidas, total }) => {
  // 1. Borrar procesos de las partidas existentes
  const { data: existentes } = await supabase
    .from('partida_cotizacion')
    .select('id_partida')
    .eq('id_cotizacion', id_cotizacion)
  if (existentes?.length) {
    const ids = existentes.map(p => p.id_partida)
    const { error: delProcErr } = await supabase
      .from('partida_proceso')
      .delete()
      .in('id_partida', ids)
    if (delProcErr) throw delProcErr
  }

  // 2. Borrar partidas existentes
  const { error: delErr } = await supabase
    .from('partida_cotizacion')
    .delete()
    .eq('id_cotizacion', id_cotizacion)
  if (delErr) throw delErr

  // 3. Actualizar cabecera + total
  const { error: headErr } = await supabase
    .from('cotizacion')
    .update({ id_nivel_precio, id_cliente: id_cliente || null, total: Number(total), estatus: 'FINALIZADA' })
    .eq('id_cotizacion', id_cotizacion)
  if (headErr) throw headErr

  // 4. Re-insertar partidas con sus procesos
  for (const partida of partidas) {
    await agregarPartida(id_cotizacion, partida)
  }
}

export const finalizarCotizacion = async (id_cotizacion, total) => {
  const { data, error } = await supabase
    .from('cotizacion')
    .update({ total: Number(total), estatus: 'FINALIZADA' })
    .eq('id_cotizacion', id_cotizacion)
    .select()
    .single()
  if (error) throw error
  return data
}

export const cancelarCotizacion = async (id_cotizacion) => {
  const { data, error } = await supabase
    .from('cotizacion')
    .update({ estatus: 'CANCELADA' })
    .eq('id_cotizacion', id_cotizacion)
    .select()
    .single()
  if (error) throw error
  return data
}

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

export const agregarPartidaExtra = async (id_cotizacion, partida) => {
  const { data, error } = await supabase
    .from('partida_cotizacion_extra')
    .insert({
      id_cotizacion,
      tipo:                partida.tipo,
      descripcion:         partida.descripcion,
      unidad:              partida.unidad ?? 'pza',
      cantidad:            Number(partida.cantidad),
      precio_unitario:     Number(partida.precio_unitario),
      subtotal:            Number(partida.subtotal),
      id_producto_general: partida.id_producto_general ?? null,
      notas:               partida.notas ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export const getPartidasExtra = async (id_cotizacion) => {
  const { data, error } = await supabase
    .from('partida_cotizacion_extra')
    .select('*')
    .eq('id_cotizacion', id_cotizacion)
    .order('id_partida_extra')
  if (error) throw error
  return data ?? []
}

export const deletePartidasExtra = async (id_cotizacion) => {
  const { error } = await supabase
    .from('partida_cotizacion_extra')
    .delete()
    .eq('id_cotizacion', id_cotizacion)
  if (error) throw error
}

export const getDetalleCotizacion = async (id) => {
  const [cotRes, partidasRes, extrasRes] = await Promise.all([
    supabase
      .from('cotizacion')
      .select('*, cliente(id_cliente, nombre, telefono), nivel_precio(id_nivel_precio, nombre, es_hoja_completa)')
      .eq('id_cotizacion', id)
      .single(),
    supabase
      .from('partida_cotizacion')
      .select('*, tipo_vidrio(id_tipo_vidrio, clave, descripcion), partida_proceso(*, proceso(id_proceso, nombre, unidad_cobro(nombre)))')
      .eq('id_cotizacion', id)
      .order('id_partida', { ascending: true }),
    supabase
      .from('partida_cotizacion_extra')
      .select('*')
      .eq('id_cotizacion', id)
      .order('id_partida_extra', { ascending: true }),
  ])
  if (cotRes.error) throw cotRes.error
  if (partidasRes.error) throw partidasRes.error
  if (extrasRes.error) throw extrasRes.error

  const row = cotRes.data
  const { fecha, hora } = formatearFechaHora(row.fecha)
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
    extras: (extrasRes.data ?? []).map(e => ({
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
