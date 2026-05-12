import { supabase } from './supabase'

// ── Catálogo de productos generales ──────────────────────────────────────────

export const getProductosGenerales = async () => {
  const { data, error } = await supabase
    .from('producto_general')
    .select('*')
    .order('nombre')
  if (error) throw error
  return data ?? []
}

export const createProductoGeneral = async ({ nombre, descripcion, unidad, precio }) => {
  const { data, error } = await supabase
    .from('producto_general')
    .insert({
      nombre,
      descripcion: descripcion || null,
      unidad:      unidad      || null,
      precio:      precio      ? Number(precio) : null,
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
