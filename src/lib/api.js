import { supabase } from './supabase'

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Formatea una fecha ISO (UTC) a formato local amigable
 * @param {string} isoString - Fecha en formato ISO (de Supabase)
 * @returns {{fecha: string, hora: string}}
 */
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
    fecha: fechaFormatter.format(d),
    hora: horaFormatter.format(d).slice(0, 5),
  }
}

// ── Mappers ───────────────────────────────────────────────────────────────

const mapProducto = (row) => ({
  id:               row.id,
  codigo:           row.codigo ?? '',
  codigoProveedor:  row.codigo_proveedor ?? '',
  proveedorNombre:  row.proveedor_nombre,
  marca:            row.marca || '',
  tono:             row.tono  || '',
  descripcion:      row.descripcion,
  espesor:          row.espesor_mm,
  precio:           Number(row.precio),
  existencias:      row.existencias,
  imagen:           row.imagen_url || '',
  stockBajo:        row.stock_bajo,
})

const mapVentaResumen = (row) => {
  const { fecha, hora } = formatearFechaHora(row.fecha_hora)
  return {
    id:          row.id,
    folio:       row.folio,
    fecha:       fecha,
    hora:        hora,
    fechaISO:    row.fecha_hora,
    total:       Number(row.total),
    numPartidas: Number(row.num_partidas),
    totalPiezas: Number(row.total_piezas),
  }
}

// ── Proveedores ───────────────────────────────────────────────────────────

export const getProveedores = async () => {
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .order('nombre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const createProveedor = async ({ nombre, telefono }) => {
  const { data, error } = await supabase
    .from('proveedores')
    .insert({ nombre, telefono })
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateProveedor = async (codigo, { nombre, telefono }) => {
  const { data, error } = await supabase
    .from('proveedores')
    .update({ nombre, telefono })
    .eq('codigo', codigo)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteProveedor = async (codigo) => {
  const { error } = await supabase
    .from('proveedores')
    .delete()
    .eq('codigo', codigo)
  if (error) throw error
}

// ── Productos ─────────────────────────────────────────────────────────────

export const getProductos = async () => {
  const { data, error } = await supabase
    .from('v_inventario')
    .select('*')
  if (error) throw error
  return (data ?? []).map(mapProducto)
}

export const createProducto = async (formData) => {
  // Validación de campos requeridos
  if (!formData.descripcion || !formData.descripcion.trim()) {
    throw new Error('La descripción es obligatoria')
  }
  if (!formData.marca || !formData.marca.trim()) {
    throw new Error('La marca es obligatoria')
  }
  
  // Resolve proveedor_id from codigoProveedor
  const { data: prov, error: provErr } = await supabase
    .from('proveedores')
    .select('id')
    .eq('codigo', formData.codigoProveedor)
    .single()
  if (provErr) throw new Error('Proveedor no encontrado')

  const { data, error } = await supabase
    .from('productos')
    .insert({
      ...(formData.codigoProducto ? { codigo: formData.codigoProducto } : {}),
      proveedor_id: prov.id,
      marca:        formData.marca       || '',
      tono:         formData.tono        || '',
      descripcion:  formData.descripcion,
      espesor_mm:   Number(formData.espesor),
      precio:       Number(formData.precio),
      imagen_url:   null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateProducto = async (productoId, formData) => {
  // Validación de campos requeridos
  if (!formData.descripcion || !formData.descripcion.trim()) {
    throw new Error('La descripción es obligatoria')
  }
  if (!formData.marca || !formData.marca.trim()) {
    throw new Error('La marca es obligatoria')
  }
  
  // Resolve proveedor_id if proveedor changed
  const { data: prov, error: provErr } = await supabase
    .from('proveedores')
    .select('id')
    .eq('codigo', formData.codigoProveedor)
    .single()
  if (provErr) throw new Error('Proveedor no encontrado')

  const { data, error } = await supabase
    .from('productos')
    .update({
      codigo:       formData.codigoProducto.trim(),
      proveedor_id: prov.id,
      marca:        formData.marca       || '',
      tono:         formData.tono        || '',
      descripcion:  formData.descripcion,
      espesor_mm:   Number(formData.espesor),
      precio:       Number(formData.precio),
      imagen_url:   null,
    })
    .eq('id', productoId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteProducto = async (codigo) => {
  const { error } = await supabase
    .from('productos')
    .delete()
    .eq('codigo', codigo)
  if (error) throw error
}

export const ajustarExistencias = async (productoId, delta, tipo, nota = null) => {
  // Read current existencias
  const { data: prod, error: fetchErr } = await supabase
    .from('productos')
    .select('existencias')
    .eq('id', productoId)
    .single()
  if (fetchErr) throw fetchErr

  const nuevas = prod.existencias + delta
  if (nuevas < 0) throw new Error('Las existencias no pueden quedar en negativo')

  // Update existencias
  const { error: updErr } = await supabase
    .from('productos')
    .update({ existencias: nuevas })
    .eq('id', productoId)
  if (updErr) throw updErr

  // Register movement
  const { error: movErr } = await supabase
    .from('movimientos_inventario')
    .insert({
      producto_id:             productoId,
      tipo,
      cantidad:                delta,
      existencias_resultantes: nuevas,
      nota,
    })
  if (movErr) throw movErr
}

// ── Ventas ────────────────────────────────────────────────────────────────

export const getVentas = async () => {
  const { data, error } = await supabase
    .from('v_historial_ventas')
    .select('*')
  if (error) throw error
  return (data ?? []).map(mapVentaResumen)
}

export const createVenta = async (partidas) => {
  // 1. Insert venta — folio generated by trigger
  const { data: venta, error: ventaErr } = await supabase
    .from('ventas')
    .insert({ fecha_hora: new Date().toISOString() })
    .select()
    .single()
  if (ventaErr) throw ventaErr

  // 2. Separar partidas por tipo
  const herrajeItems  = partidas.filter(p => p.tipo !== 'GENERAL')
  const generalItems  = partidas.filter(p => p.tipo === 'GENERAL')

  // 3. Insertar productos de herraje (trigger descuenta stock y actualiza total)
  if (herrajeItems.length > 0) {
    const detalles = herrajeItems.map(p => ({
      venta_id:        venta.id,
      producto_id:     p.productoId,
      cantidad:        p.cantidad,
      precio_unitario: p.precioUnitario,
    }))
    const { error: detErr } = await supabase.from('detalle_venta').insert(detalles)
    if (detErr) throw detErr
  }

  // 4. Insertar productos generales (stock y total se manejan manualmente)
  if (generalItems.length > 0) {
    const detallesGen = generalItems.map(p => ({
      venta_id:              venta.id,
      id_producto_general:   p.idProductoGeneral,
      producto_id:           null,
      cantidad:              p.cantidad,
      precio_unitario:       p.precioUnitario,
    }))
    const { error: detGenErr } = await supabase.from('detalle_venta').insert(detallesGen)
    if (detGenErr) throw detGenErr

    // Descontar stock de cada producto general
    for (const p of generalItems) {
      const { data: pg, error: pgErr } = await supabase
        .from('producto_general')
        .select('existencias')
        .eq('id_producto_general', p.idProductoGeneral)
        .single()
      if (!pgErr && pg) {
        await supabase
          .from('producto_general')
          .update({ existencias: Math.max(0, (pg.existencias ?? 0) - p.cantidad) })
          .eq('id_producto_general', p.idProductoGeneral)
      }
    }
  }

  // 5. Actualizar total manualmente (cubre el caso en que el trigger no incluya productos generales)
  const totalCalculado = partidas.reduce((s, p) => s + Number(p.subtotal), 0)
  await supabase.from('ventas').update({ total: totalCalculado }).eq('id', venta.id)

  // 6. Re-fetch venta final
  const { data: final, error: finalErr } = await supabase
    .from('ventas')
    .select('*')
    .eq('id', venta.id)
    .single()
  if (finalErr) throw finalErr

  const { fecha, hora } = formatearFechaHora(final.fecha_hora)
  return {
    id:       final.id,
    folio:    final.folio,
    fecha:    fecha,
    hora:     hora,
    fechaISO: final.fecha_hora,
    total:    Number(final.total),
    partidas: partidas.map(p => ({
      codigoProducto:  p.codigoProducto,
      descripcion:     p.descripcion,
      tono:            p.tono,
      precioUnitario:  p.precioUnitario,
      cantidad:        p.cantidad,
      subtotal:        p.subtotal,
    })),
  }
}

export const getDetalleVenta = async (ventaId) => {
  const [ventaRes, detallesRes] = await Promise.all([
    supabase
      .from('ventas')
      .select('id, folio, fecha_hora, total')
      .eq('id', ventaId)
      .single(),
    supabase
      .from('detalle_venta')
      .select('cantidad, precio_unitario, subtotal, productos(codigo, descripcion, tono), producto_general(nombre, unidad)')
      .eq('venta_id', ventaId),
  ])

  if (ventaRes.error) throw ventaRes.error
  if (detallesRes.error) throw detallesRes.error

  const { fecha, hora } = formatearFechaHora(ventaRes.data.fecha_hora)
  return {
    id:       ventaRes.data.id,
    folio:    ventaRes.data.folio,
    fecha:    fecha,
    hora:     hora,
    fechaISO: ventaRes.data.fecha_hora,
    total:    Number(ventaRes.data.total),
    partidas: (detallesRes.data ?? []).map(row => ({
      codigoProducto: row.productos?.codigo        ?? '',
      descripcion:    row.productos?.descripcion   ?? row.producto_general?.nombre ?? '',
      tono:           row.productos?.tono          ?? (row.producto_general?.unidad ? `(${row.producto_general.unidad})` : ''),
      precioUnitario: Number(row.precio_unitario),
      cantidad:       row.cantidad,
      subtotal:       Number(row.subtotal),
    })),
  }
}
