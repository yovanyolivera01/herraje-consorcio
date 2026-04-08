import { supabase } from './supabase'

// ── Helpers ───────────────────────────────────────────────────────────────

function formatearFechaHora(isoString) {
  const d = new Date(isoString)
  const fechaFormatter = new Intl.DateTimeFormat('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const horaFormatter = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  return {
    fecha: fechaFormatter.format(d),
    hora:  horaFormatter.format(d).slice(0, 5),
  }
}

// ── Tonos ─────────────────────────────────────────────────────────────────

export const getTonos = async () => {
  const { data, error } = await supabase
    .from('cot_tono')
    .select('*')
    .order('nombre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const createTono = async ({ nombre }) => {
  const { data, error } = await supabase
    .from('cot_tono')
    .insert({ nombre })
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateTono = async (id, campos) => {
  const { data, error } = await supabase
    .from('cot_tono')
    .update(campos)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Espesores ─────────────────────────────────────────────────────────────

export const getEspesores = async () => {
  const { data, error } = await supabase
    .from('cot_espesor')
    .select('*')
    .order('valor_mm', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const createEspesor = async ({ valor_mm, etiqueta }) => {
  const { data, error } = await supabase
    .from('cot_espesor')
    .insert({ valor_mm: Number(valor_mm), etiqueta })
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateEspesor = async (id, campos) => {
  const { data, error } = await supabase
    .from('cot_espesor')
    .update(campos)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Tipos de vidrio ───────────────────────────────────────────────────────

export const getTiposVidrio = async () => {
  const { data, error } = await supabase
    .from('cot_tipo_vidrio')
    .select('*, cot_tono(id, nombre), cot_espesor(id, valor_mm, etiqueta)')
    .order('clave', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const createTipoVidrio = async ({ id_tono, id_espesor, clave, descripcion, hoja_largo_cm, hoja_ancho_cm }) => {
  const { data, error } = await supabase
    .from('cot_tipo_vidrio')
    .insert({ id_tono, id_espesor, clave, descripcion, hoja_largo_cm: Number(hoja_largo_cm), hoja_ancho_cm: Number(hoja_ancho_cm) })
    .select('*, cot_tono(id, nombre), cot_espesor(id, valor_mm, etiqueta)')
    .single()
  if (error) throw error
  return data
}

export const updateTipoVidrio = async (id, campos) => {
  const { data, error } = await supabase
    .from('cot_tipo_vidrio')
    .update(campos)
    .eq('id', id)
    .select('*, cot_tono(id, nombre), cot_espesor(id, valor_mm, etiqueta)')
    .single()
  if (error) throw error
  return data
}

// ── Niveles de precio ─────────────────────────────────────────────────────

export const getNivelesPrecio = async () => {
  const { data, error } = await supabase
    .from('cot_nivel_precio')
    .select('*')
    .eq('activo', true)
    .order('id', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── Precios de vidrio ─────────────────────────────────────────────────────

export const getPreciosVidrio = async () => {
  const { data, error } = await supabase
    .from('cot_precio_vidrio')
    .select('*')
  if (error) throw error
  return data ?? []
}

export const guardarPrecio = async ({ id_tipo_vidrio, id_nivel_precio, precio_m2 }) => {
  const { data, error } = await supabase
    .from('cot_precio_vidrio')
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
    .from('cot_cliente')
    .select('*, cot_nivel_precio(id, nombre)')
    .order('nombre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const createCliente = async ({ nombre, telefono, correo, id_nivel_precio }) => {
  const { data, error } = await supabase
    .from('cot_cliente')
    .insert({ nombre, telefono: telefono || null, correo: correo || null, id_nivel_precio: id_nivel_precio || null })
    .select('*, cot_nivel_precio(id, nombre)')
    .single()
  if (error) throw error
  return data
}

export const updateCliente = async (id, campos) => {
  const { data, error } = await supabase
    .from('cot_cliente')
    .update(campos)
    .eq('id', id)
    .select('*, cot_nivel_precio(id, nombre)')
    .single()
  if (error) throw error
  return data
}

// ── Procesos ──────────────────────────────────────────────────────────────

export const getProcesos = async () => {
  const { data, error } = await supabase
    .from('cot_proceso')
    .select('*, cot_unidad_cobro(id, nombre, descripcion)')
    .order('nombre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const createProceso = async ({ nombre, id_unidad_cobro, precio_unitario }) => {
  const { data, error } = await supabase
    .from('cot_proceso')
    .insert({ nombre, id_unidad_cobro, precio_unitario: Number(precio_unitario) })
    .select('*, cot_unidad_cobro(id, nombre, descripcion)')
    .single()
  if (error) throw error
  return data
}

export const updateProceso = async (id, campos) => {
  const { data, error } = await supabase
    .from('cot_proceso')
    .update(campos)
    .eq('id', id)
    .select('*, cot_unidad_cobro(id, nombre, descripcion)')
    .single()
  if (error) throw error
  return data
}

// ── Unidades de cobro ─────────────────────────────────────────────────────

export const getUnidadesCobro = async () => {
  const { data, error } = await supabase
    .from('cot_unidad_cobro')
    .select('*')
    .order('id', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── Cotizaciones ──────────────────────────────────────────────────────────

export const iniciarCotizacion = async ({ id_nivel_precio, id_cliente = null, observaciones = null }) => {
  // Insert con folio temporal; lo actualizamos luego usando el id generado
  const { data: cot, error: cotErr } = await supabase
    .from('cot_cotizacion')
    .insert({
      folio:          'COT-00000', // temporal, se reemplaza abajo
      id_nivel_precio,
      id_cliente:     id_cliente || null,
      observaciones:  observaciones || null,
      fecha:          new Date().toISOString(),
    })
    .select()
    .single()
  if (cotErr) throw cotErr

  const folio = `COT-${String(cot.id).padStart(5, '0')}`
  const { data, error } = await supabase
    .from('cot_cotizacion')
    .update({ folio })
    .eq('id', cot.id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const agregarPartida = async (id_cotizacion, partida) => {
  // Insert partida
  const { data: p, error: pErr } = await supabase
    .from('cot_partida')
    .insert({
      id_cotizacion,
      id_tipo_vidrio:       partida.id_tipo_vidrio,
      piezas:               partida.piezas,
      largo_cm:             partida.largo_cm,
      ancho_cm:             partida.ancho_cm,
      metros2:              partida.metros2,
      precio_m2_aplicado:   partida.precio_m2_aplicado,
      subtotal_vidrio:      partida.subtotal_vidrio,
      subtotal_procesos:    partida.subtotal_procesos ?? 0,
      subtotal_partida:     partida.subtotal_partida,
    })
    .select()
    .single()
  if (pErr) throw pErr

  // Insert procesos por partida si los hay
  if (partida.procesos && partida.procesos.length > 0) {
    const rows = partida.procesos.map(proc => ({
      id_partida:      p.id,
      id_proceso:      proc.id_proceso,
      cantidad:        proc.cantidad,
      precio_unitario: proc.precio_unitario,
      subtotal:        proc.subtotal,
    }))
    const { error: prErr } = await supabase
      .from('cot_partida_proceso')
      .insert(rows)
    if (prErr) throw prErr
  }

  return p
}

export const finalizarCotizacion = async (id_cotizacion, total) => {
  const { data, error } = await supabase
    .from('cot_cotizacion')
    .update({ total: Number(total), estatus: 'FINALIZADA' })
    .eq('id', id_cotizacion)
    .select()
    .single()
  if (error) throw error
  return data
}

export const cancelarCotizacion = async (id_cotizacion) => {
  const { data, error } = await supabase
    .from('cot_cotizacion')
    .update({ estatus: 'CANCELADA' })
    .eq('id', id_cotizacion)
    .select()
    .single()
  if (error) throw error
  return data
}

export const getCotizaciones = async () => {
  const { data, error } = await supabase
    .from('cot_cotizacion')
    .select('*, cot_cliente(id, nombre), cot_nivel_precio(id, nombre)')
    .order('fecha', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => {
    const { fecha, hora } = formatearFechaHora(row.fecha)
    return {
      id:            row.id,
      folio:         row.folio,
      fecha:         fecha,
      hora:          hora,
      fechaISO:      row.fecha,
      clienteNombre: row.cot_cliente?.nombre ?? 'Mostrador',
      nivelNombre:   row.cot_nivel_precio?.nombre ?? '',
      total:         Number(row.total),
      estatus:       row.estatus,
      observaciones: row.observaciones,
    }
  })
}

export const getDetalleCotizacion = async (id) => {
  const [cotRes, partidasRes] = await Promise.all([
    supabase
      .from('cot_cotizacion')
      .select('*, cot_cliente(id, nombre, telefono), cot_nivel_precio(id, nombre, es_hoja_completa)')
      .eq('id', id)
      .single(),
    supabase
      .from('cot_partida')
      .select('*, cot_tipo_vidrio(id, clave, descripcion, hoja_largo_cm, hoja_ancho_cm), cot_partida_proceso(*, cot_proceso(id, nombre, cot_unidad_cobro(nombre)))')
      .eq('id_cotizacion', id)
      .order('id', { ascending: true }),
  ])
  if (cotRes.error) throw cotRes.error
  if (partidasRes.error) throw partidasRes.error

  const row = cotRes.data
  const { fecha, hora } = formatearFechaHora(row.fecha)
  return {
    id:            row.id,
    folio:         row.folio,
    fecha:         fecha,
    hora:          hora,
    fechaISO:      row.fecha,
    cliente:       row.cot_cliente,
    nivel:         row.cot_nivel_precio,
    total:         Number(row.total),
    estatus:       row.estatus,
    observaciones: row.observaciones,
    partidas:      (partidasRes.data ?? []).map(p => ({
      id:                 p.id,
      tipoVidrio:         p.cot_tipo_vidrio,
      piezas:             p.piezas,
      largo_cm:           Number(p.largo_cm),
      ancho_cm:           Number(p.ancho_cm),
      metros2:            Number(p.metros2),
      precio_m2_aplicado: Number(p.precio_m2_aplicado),
      subtotal_vidrio:    Number(p.subtotal_vidrio),
      subtotal_procesos:  Number(p.subtotal_procesos),
      subtotal_partida:   Number(p.subtotal_partida),
      procesos:           (p.cot_partida_proceso ?? []).map(pp => ({
        id:              pp.id,
        nombre:          pp.cot_proceso?.nombre ?? '',
        unidad:          pp.cot_proceso?.cot_unidad_cobro?.nombre ?? '',
        cantidad:        Number(pp.cantidad),
        precio_unitario: Number(pp.precio_unitario),
        subtotal:        Number(pp.subtotal),
      })),
    })),
  }
}
