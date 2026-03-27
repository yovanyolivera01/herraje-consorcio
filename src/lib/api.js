import { supabase } from './supabase'

// ── Mappers ───────────────────────────────────────────────────────────────

const mapProducto = (row) => ({
  id:               row.id,
  codigo:           row.codigo,
  codigoProveedor:  row.codigo_proveedor,
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
  const d = new Date(row.fecha_hora)
  return {
    id:          row.id,
    folio:       row.folio,
    fecha:       d.toLocaleDateString('es-MX'),
    hora:        d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
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
      proveedor_id: prov.id,
      marca:        formData.marca       || '',
      tono:         formData.tono        || '',
      descripcion:  formData.descripcion,
      espesor_mm:   Number(formData.espesor),
      precio:       Number(formData.precio),
      imagen_url:   formData.imagen      || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateProducto = async (codigo, formData) => {
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
      proveedor_id: prov.id,
      marca:        formData.marca       || '',
      tono:         formData.tono        || '',
      descripcion:  formData.descripcion,
      espesor_mm:   Number(formData.espesor),
      precio:       Number(formData.precio),
      imagen_url:   formData.imagen      || null,
    })
    .eq('codigo', codigo)
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

  // 2. Insert detalle_venta rows (triggers: descuenta stock + actualiza total)
  const detalles = partidas.map(p => ({
    venta_id:        venta.id,
    producto_id:     p.productoId,
    cantidad:        p.cantidad,
    precio_unitario: p.precioUnitario,
  }))
  const { error: detErr } = await supabase
    .from('detalle_venta')
    .insert(detalles)
  if (detErr) throw detErr

  // 3. Re-fetch venta para obtener el total calculado por trigger
  const { data: final, error: finalErr } = await supabase
    .from('ventas')
    .select('*')
    .eq('id', venta.id)
    .single()
  if (finalErr) throw finalErr

  const d = new Date(final.fecha_hora)
  return {
    id:       final.id,
    folio:    final.folio,
    fecha:    d.toLocaleDateString('es-MX'),
    hora:     d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    fechaISO: final.fecha_hora,
    total:    Number(final.total),
    // Conservar las partidas tal como las ingresó el usuario (para el ticket inmediato)
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
      .select('cantidad, precio_unitario, subtotal, productos(codigo, descripcion, tono)')
      .eq('venta_id', ventaId),
  ])

  if (ventaRes.error) throw ventaRes.error
  if (detallesRes.error) throw detallesRes.error

  const d = new Date(ventaRes.data.fecha_hora)
  return {
    id:       ventaRes.data.id,
    folio:    ventaRes.data.folio,
    fecha:    d.toLocaleDateString('es-MX'),
    hora:     d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    fechaISO: ventaRes.data.fecha_hora,
    total:    Number(ventaRes.data.total),
    partidas: (detallesRes.data ?? []).map(row => ({
      codigoProducto: row.productos?.codigo        ?? '',
      descripcion:    row.productos?.descripcion   ?? '',
      tono:           row.productos?.tono          ?? '',
      precioUnitario: Number(row.precio_unitario),
      cantidad:       row.cantidad,
      subtotal:       Number(row.subtotal),
    })),
  }
}
