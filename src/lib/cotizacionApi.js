import { supabase } from './supabase'

// ── Helpers ───────────────────────────────────────────────────────────────

const TZ = 'America/Mexico_City'
function formatearFechaHora(isoString) {
  const d = new Date(isoString)
  const fechaFormatter = new Intl.DateTimeFormat('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ,
  })
  const horaFormatter = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
  })
  return {
    fecha: fechaFormatter.format(d),
    hora:  horaFormatter.format(d).slice(0, 5),
  }
}

// ── Tonos ─────────────────────────────────────────────────────────────────

export const getTonos = async () => {
  const { data, error } = await supabase
    .from('tono')
    .select('*')
    .order('nombre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const createTono = async ({ nombre }) => {
  const { data, error } = await supabase
    .from('tono')
    .insert({ nombre })
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateTono = async (id_tono, campos) => {
  const { data, error } = await supabase
    .from('tono')
    .update(campos)
    .eq('id_tono', id_tono)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Espesores ─────────────────────────────────────────────────────────────

export const getEspesores = async () => {
  const { data, error } = await supabase
    .from('espesor')
    .select('*')
    .order('valor_mm', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const createEspesor = async ({ valor_mm, etiqueta }) => {
  const { data, error } = await supabase
    .from('espesor')
    .insert({ valor_mm: Number(valor_mm), etiqueta })
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateEspesor = async (id_espesor, campos) => {
  const { data, error } = await supabase
    .from('espesor')
    .update(campos)
    .eq('id_espesor', id_espesor)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Tipos de vidrio ───────────────────────────────────────────────────────

export const getTiposVidrio = async () => {
  const { data, error } = await supabase
    .from('tipo_vidrio')
    .select('*, tono(id_tono, nombre), espesor(id_espesor, valor_mm, etiqueta)')
    .order('clave', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const createTipoVidrio = async ({ id_tono, id_espesor, clave, descripcion }) => {
  const { data, error } = await supabase
    .from('tipo_vidrio')
    .insert({ id_tono, id_espesor, clave, descripcion })
    .select('*, tono(id_tono, nombre), espesor(id_espesor, valor_mm, etiqueta)')
    .single()
  if (error) throw error
  return data
}

export const updateTipoVidrio = async (id_tipo_vidrio, campos) => {
  const { data, error } = await supabase
    .from('tipo_vidrio')
    .update(campos)
    .eq('id_tipo_vidrio', id_tipo_vidrio)
    .select('*, tono(id_tono, nombre), espesor(id_espesor, valor_mm, etiqueta)')
    .single()
  if (error) throw error
  return data
}

// ── Niveles de precio ─────────────────────────────────────────────────────

export const getNivelesPrecio = async () => {
  const { data, error } = await supabase
    .from('nivel_precio')
    .select('*')
    .eq('activo', true)
    .order('id_nivel_precio', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── Precios de vidrio ─────────────────────────────────────────────────────

export const getPreciosVidrio = async () => {
  const { data, error } = await supabase
    .from('precio_vidrio')
    .select('*')
  if (error) throw error
  return data ?? []
}

export const guardarPrecio = async ({ id_tipo_vidrio, id_nivel_precio, precio_m2 }) => {
  const { data, error } = await supabase
    .from('precio_vidrio')
    .upsert(
      { id_tipo_vidrio, id_nivel_precio, precio_m2: Number(precio_m2) },
      { onConflict: 'id_tipo_vidrio,id_nivel_precio' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Clientes ──────────────────────────────────────────────────────────────

export const getClientes = async () => {
  const { data, error } = await supabase
    .from('cliente')
    .select('*, nivel_precio(id_nivel_precio, nombre)')
    .order('nombre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const createCliente = async ({ nombre, telefono, correo, id_nivel_precio }) => {
  const { data, error } = await supabase
    .from('cliente')
    .insert({ nombre, telefono: telefono || null, correo: correo || null, id_nivel_precio: id_nivel_precio || null })
    .select('*, nivel_precio(id_nivel_precio, nombre)')
    .single()
  if (error) throw error
  return data
}

export const updateCliente = async (id_cliente, campos) => {
  const { data, error } = await supabase
    .from('cliente')
    .update(campos)
    .eq('id_cliente', id_cliente)
    .select('*, nivel_precio(id_nivel_precio, nombre)')
    .single()
  if (error) throw error
  return data
}

// ── Procesos ──────────────────────────────────────────────────────────────

export const getProcesos = async () => {
  const { data, error } = await supabase
    .from('proceso')
    .select('*, unidad_cobro(id_unidad_cobro, nombre, descripcion)')
    .order('nombre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const createProceso = async ({ nombre, id_unidad_cobro, precio_unitario = 0 }) => {
  const { data, error } = await supabase
    .from('proceso')
    .insert({ nombre, id_unidad_cobro, precio_unitario: Number(precio_unitario) })
    .select('*, unidad_cobro(id_unidad_cobro, nombre, descripcion)')
    .single()
  if (error) throw error
  return data
}

export const updateProceso = async (id_proceso, campos) => {
  const { data, error } = await supabase
    .from('proceso')
    .update(campos)
    .eq('id_proceso', id_proceso)
    .select('*, unidad_cobro(id_unidad_cobro, nombre, descripcion)')
    .single()
  if (error) throw error
  return data
}

// ── Precios de proceso por nivel ─────────────────────────────────────────

export const getPreciosProceso = async () => {
  const { data, error } = await supabase
    .from('precio_proceso')
    .select('*')
  if (error) throw error
  return data ?? []
}

export const guardarPreciosProceso = async (id_proceso, precios) => {
  if (!precios.length) return []
  const rows = precios.map(p => ({
    id_proceso,
    id_nivel_precio: p.id_nivel_precio,
    id_espesor:      p.id_espesor,
    precio_unitario: Number(p.precio_unitario),
  }))
  const { data, error } = await supabase
    .from('precio_proceso')
    .upsert(rows, { onConflict: 'id_proceso,id_nivel_precio,id_espesor' })
    .select()
  if (error) throw error
  return data ?? []
}

// ── Unidades de cobro ─────────────────────────────────────────────────────

export const getUnidadesCobro = async () => {
  const { data, error } = await supabase
    .from('unidad_cobro')
    .select('*')
    .order('id_unidad_cobro', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── Cotizaciones ──────────────────────────────────────────────────────────

export const iniciarCotizacion = async ({ id_nivel_precio, id_cliente = null, observaciones = null }) => {
  // Insertar con folio temporal
  const { data: cot, error: cotErr } = await supabase
    .from('cotizacion')
    .insert({
      folio:          'COT-00000',
      id_nivel_precio,
      id_cliente:     id_cliente || null,
      observaciones:  observaciones || null,
      fecha:          new Date().toISOString(),
    })
    .select()
    .single()
  if (cotErr) throw cotErr

  // Actualizar folio usando el id generado
  const folio = `COT-${String(cot.id_cotizacion).padStart(5, '0')}`
  const { data, error } = await supabase
    .from('cotizacion')
    .update({ folio })
    .eq('id_cotizacion', cot.id_cotizacion)
    .select()
    .single()
  if (error) throw error
  return data
}

export const agregarPartida = async (id_cotizacion, partida) => {
  // metros2 ya incluye el número de piezas: piezas × (largo × ancho / 10000)
  const { data: p, error: pErr } = await supabase
    .from('partida_cotizacion')
    .insert({
      id_cotizacion,
      id_tipo_vidrio:     partida.id_tipo_vidrio,
      largo_cm:           partida.largo_cm,
      ancho_cm:           partida.ancho_cm,
      metros2:            partida.metros2,           // total incluyendo piezas
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
  const { data, error } = await supabase
    .from('cotizacion')
    .select('*, cliente(id_cliente, nombre), nivel_precio(id_nivel_precio, nombre, es_hoja_completa)')
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
      nivelNombre:   row.nivel_precio?.es_hoja_completa ? 'POR HOJA' : (row.nivel_precio?.nombre ?? ''),
      total:         Number(row.total),
      estatus:       row.estatus,
      observaciones: row.observaciones,
    }
  })
}

export const getDetalleCotizacion = async (id) => {
  const [cotRes, partidasRes] = await Promise.all([
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
  ])
  if (cotRes.error) throw cotRes.error
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
    total:         Number(row.total),
    estatus:       row.estatus,
    observaciones: row.observaciones,
    partidas: (partidasRes.data ?? []).map(p => ({
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
        nombre:          pp.proceso?.nombre ?? '',
        unidad:          pp.proceso?.unidad_cobro?.nombre ?? '',
        cantidad:        Number(pp.cantidad),
        precio_unitario: Number(pp.precio_unitario),
        subtotal:        Number(pp.subtotal),
      })),
    })),
  }
}
