import { supabase } from './supabase'

// ── Catálogo de productos generales ──────────────────────────────────────────

export const getProductosGenerales = async () => {
  const { data, error } = await supabase
    .from('producto_general')
    .select('*, proveedores(id, nombre)')
    .order('nombre')
  if (error) throw error
  return (data ?? []).map(row => ({
    ...row,
    proveedor_nombre: row.proveedores?.nombre ?? null,
  }))
}

export const createProductoGeneral = async ({ nombre, descripcion, unidad, precio }) => {
  const { data, error } = await supabase
    .from('producto_general')
    .insert({
      nombre,
      descripcion: descripcion || null,
      unidad:      unidad      || null,
      precio:      precio      ? Number(precio) : null,
      existencias: 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateProductoGeneral = async (id, campos) => {
  const { data, error } = await supabase
    .from('producto_general')
    .update(campos)
    .eq('id_producto_general', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Ajuste de existencias ─────────────────────────────────────────────────────
// delta > 0 = entrada, delta < 0 = salida

export const ajustarExistenciasGeneral = async (id, delta) => {
  const { data: prod, error: fetchErr } = await supabase
    .from('producto_general')
    .select('existencias')
    .eq('id_producto_general', id)
    .single()
  if (fetchErr) throw fetchErr

  const nuevas = (prod.existencias ?? 0) + delta
  if (nuevas < 0) throw new Error('Las existencias no pueden quedar en negativo')

  const { error } = await supabase
    .from('producto_general')
    .update({ existencias: nuevas })
    .eq('id_producto_general', id)
  if (error) throw error
  return nuevas
}

// ── Descontar existencias por venta (no lanza si queda en negativo) ───────────
export const venderProductoGeneral = async (id_producto_general, cantidad) => {
  const { data: prod } = await supabase
    .from('producto_general')
    .select('existencias')
    .eq('id_producto_general', id_producto_general)
    .single()
  if (!prod) return
  const nuevas = Math.max(0, (prod.existencias ?? 0) - cantidad)
  await supabase
    .from('producto_general')
    .update({ existencias: nuevas })
    .eq('id_producto_general', id_producto_general)
}
