import { http } from './http'

// ── Empresas ──────────────────────────────────────────────────────────────

export const getEmpresas = () => http.get('/api/empresas')

export const createEmpresa = (data) => http.post('/api/empresas', data)

export const updateEmpresa = (id, data) => http.put(`/api/empresas/${id}`, data)

// ── Vincular cliente a empresa ────────────────────────────────────────────

export const vincularClienteEmpresa = (id_cliente, id_empresa) =>
  http.post(`/api/clientes/${id_cliente}/empresa`, { id_empresa })

export const getEmpresaDeCliente = (id_cliente) =>
  http.get(`/api/clientes/${id_cliente}/empresa`)

// ── Precios por empresa ───────────────────────────────────────────────────

export const getPreciosEmpresa = (id_empresa) =>
  http.get(`/api/empresas/${id_empresa}/precios`)

export const guardarPrecioEmpresa = ({ id_empresa, id_tipo_vidrio, id_proceso, precio_m2 }) =>
  http.post(`/api/empresas/${id_empresa}/precios`, {
    id_tipo_vidrio,
    id_proceso: id_proceso ?? null,
    precio_m2,
  })

// ── Precios por cliente registrado ────────────────────────────────────────

export const guardarPrecioClienteRegistrado = async ({ id_cliente, id_tipo_vidrio, id_proceso, precio_m2 }) => {
  // When id_tipo_vidrio is null (process-level price), SQL UNIQUE won't match NULLs so we do manual select+update/insert
  if (id_tipo_vidrio === null) {
    let sel = supabase.from('precio_cliente_registrado').select('*').eq('id_cliente', id_cliente).is('id_tipo_vidrio', null)
    sel = id_proceso != null ? sel.eq('id_proceso', id_proceso) : sel.is('id_proceso', null)
    const { data: existing } = await sel.maybeSingle()
    if (existing) {
      const { data, error } = await supabase
        .from('precio_cliente_registrado')
        .update({ precio_m2, activo: true, actualizado_en: new Date().toISOString() })
        .eq('id_cliente', id_cliente).is('id_tipo_vidrio', null).eq('id_proceso', id_proceso)
        .select().single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase
      .from('precio_cliente_registrado')
      .insert({ id_cliente, id_tipo_vidrio: null, id_proceso, precio_m2, activo: true, actualizado_en: new Date().toISOString() })
      .select().single()
    if (error) throw error
    return data
  }

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

export const guardarPrecioClienteRegistrado = ({ id_cliente, id_tipo_vidrio, id_proceso, precio_m2 }) =>
  http.post(`/api/clientes/${id_cliente}/precios`, {
    id_tipo_vidrio,
    id_proceso: id_proceso ?? null,
    precio_m2,
  })
