import { supabase } from './supabase'

// ── Empresas ──────────────────────────────────────────────────────────────
export const getEmpresas = async () => {
  const { data, error } = await supabase
    .from('empresa')
    .select('*')
    .order('nombre')
  if (error) throw error
  return data ?? []
}

export const createEmpresa = async (data) => {
  const { data: row, error } = await supabase
    .from('empresa')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return row
}

export const updateEmpresa = async (id, data) => {
  const { data: row, error } = await supabase
    .from('empresa')
    .update(data)
    .eq('id_empresa', id)
    .select()
    .single()
  if (error) throw error
  return row
}

// ── Vincular cliente a empresa ────────────────────────────────────────────
export const vincularClienteEmpresa = async (id_cliente, id_empresa) => {
  const { error } = await supabase.rpc('sp_vincular_cliente_empresa', {
    p_id_cliente: id_cliente,
    p_id_empresa: id_empresa,
  })
  if (error) throw error
}

export const getEmpresaDeCliente = async (id_cliente) => {
  const { data, error } = await supabase
    .from('cliente_empresa')
    .select('id_empresa, empresa(id_empresa, nombre, razon_social, rfc, telefono, correo, direccion)')
    .eq('id_cliente', id_cliente)
    .eq('activo', true)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

// ── Precios por empresa ───────────────────────────────────────────────────
export const getPreciosEmpresa = async (id_empresa) => {
  const { data, error } = await supabase
    .from('precio_empresa')
    .select('*')
    .eq('id_empresa', id_empresa)
    .eq('activo', true)
  if (error) throw error
  return data ?? []
}

export const guardarPrecioEmpresa = async ({ id_empresa, id_tipo_vidrio, id_proceso, precio_m2 }) => {
  const { data, error } = await supabase
    .from('precio_empresa')
    .upsert(
      { id_empresa, id_tipo_vidrio, id_proceso: id_proceso ?? null, precio_m2, activo: true, actualizado_en: new Date().toISOString() },
      { onConflict: 'id_empresa,id_tipo_vidrio,id_proceso' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Precios por cliente registrado ────────────────────────────────────────
export const getPreciosClienteRegistrado = async (id_cliente) => {
  const { data, error } = await supabase
    .from('precio_cliente_registrado')
    .select('*')
    .eq('id_cliente', id_cliente)
    .eq('activo', true)
  if (error) throw error
  return data ?? []
}

export const guardarPrecioClienteRegistrado = async ({ id_cliente, id_tipo_vidrio, id_proceso, precio_m2 }) => {
  const { data, error } = await supabase
    .from('precio_cliente_registrado')
    .upsert(
      { id_cliente, id_tipo_vidrio, id_proceso: id_proceso ?? null, precio_m2, activo: true, actualizado_en: new Date().toISOString() },
      { onConflict: 'id_cliente,id_tipo_vidrio,id_proceso' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export const getDocumentoEmpresa = async (id_cotizacion_origen) => {
  const { data, error } = await supabase.rpc('sp_documento_empresa', {
    p_id_cotizacion_origen: id_cotizacion_origen,
  })
  if (error) throw error
  return data ?? []
}
