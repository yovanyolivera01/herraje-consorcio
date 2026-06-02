import { supabase } from './supabase'

// ── Consulta de inventario ────────────────────────────────────────────────────
// Usa la vista v_inventario_vidrio (incluye alerta_stock y pct_usado)

export const getInventarioVidrio = async () => {
  const { data, error } = await supabase
    .from('v_inventario_vidrio')
    .select('*')
    .order('tipo_vidrio')
  if (error) throw error
  return (data ?? []).map(row => ({
    id_inventario:    row.id_inventario,
    id_tipo_vidrio:   row.id_tipo_vidrio,
    tipo_vidrio:      row.tipo_vidrio,
    medidas:          row.medidas,
    hojas_entrada:    Number(row.hojas_entrada ?? 0),
    hojas_restante:   Number(row.hojas_restante ?? 0),
    cantidad_hojas:   row.cantidad_hojas,
    m2_por_hoja:      Number(row.m2_por_hoja),
    m2_disponible:    Number(row.m2_disponible),
    m2_total_inicial: Number(row.m2_total_inicial),
    pct_usado:        Number(row.pct_usado),
    alerta_stock:     row.alerta_stock,
    es_preferido:     row.es_preferido ?? false,
  }))
}

// ── Marcar un lote como preferido para descuento ─────────────────────────────
// Quita la preferencia a todos los lotes del mismo tipo y la asigna a este.

export const setLotePreferido = async (id_inventario) => {
  // Obtener el tipo_vidrio del lote directamente de la tabla
  const { data: lote, error: fetchErr } = await supabase
    .from('inventario_vidrio')
    .select('id_tipo_vidrio')
    .eq('id_inventario', id_inventario)
    .single()
  if (fetchErr) throw fetchErr
  if (!lote) throw new Error('Lote no encontrado')

  // Quitar preferido a todos los lotes del mismo tipo
  const { error: e1 } = await supabase
    .from('inventario_vidrio')
    .update({ es_preferido: false })
    .eq('id_tipo_vidrio', lote.id_tipo_vidrio)
  if (e1) throw e1

  // Marcar este lote como preferido
  const { error: e2 } = await supabase
    .from('inventario_vidrio')
    .update({ es_preferido: true })
    .eq('id_inventario', id_inventario)
  if (e2) throw e2
}

// ── Registrar entrada de hojas (SP US-04) ────────────────────────────────────

export const registrarInventarioVidrio = async ({ id_tipo_vidrio, largo_cm, ancho_cm, cantidad_hojas }) => {
  const { data, error } = await supabase.rpc('sp_registrar_inventario_vidrio', {
    p_id_tipo_vidrio: id_tipo_vidrio,
    p_largo_cm:       Number(largo_cm),
    p_ancho_cm:       Number(ancho_cm),
    p_cantidad_hojas: Number(cantidad_hojas),
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (row.p_id_inventario === 0) throw new Error(row.p_mensaje)
  return {
    id_inventario: row.p_id_inventario,
    m2_total:      Number(row.p_m2_total),
    mensaje:       row.p_mensaje,
  }
}

// ── Ajuste manual por hojas completas ────────────────────────────────────────
// hojas_delta: positivo = entrada, negativo = descuento

export const ajustarInventario = async (id_inventario, hojas_delta, nota) => {
  const { data: inv, error: invErr } = await supabase
    .from('inventario_vidrio')
    .select('cantidad_hojas, m2_disponible, m2_por_hoja, m2_total_inicial')
    .eq('id_inventario', id_inventario)
    .single()
  if (invErr) throw invErr

  const m2_hoja        = Number(inv.m2_por_hoja)
  const m2_ajuste      = ROUND4(hojas_delta * m2_hoja)
  const nuevas_hojas   = Number(inv.cantidad_hojas) + hojas_delta
  const nuevo_saldo_m2 = ROUND4(Number(inv.m2_disponible) + m2_ajuste)

  if (nuevas_hojas < 0) throw new Error('El ajuste resultaría en hojas negativas')
  if (nuevo_saldo_m2 < 0) throw new Error('El ajuste resultaría en m² negativo')

  // Actualizar hojas Y m² disponible
  const nuevo_total = hojas_delta > 0
    ? ROUND4(Number(inv.m2_total_inicial) + m2_ajuste)   // entrada: aumenta total
    : Number(inv.m2_total_inicial)                        // descuento: no cambia total

  const update = {
    cantidad_hojas: nuevas_hojas,
    m2_disponible:  nuevo_saldo_m2,
    ...(hojas_delta > 0 ? { m2_total_inicial: nuevo_total } : {}),
  }

  const { error: updErr } = await supabase
    .from('inventario_vidrio')
    .update(update)
    .eq('id_inventario', id_inventario)
  if (updErr) throw updErr

  // Actualizar hojas_entrada si la columna ya existe (silencioso si no)
  if (hojas_delta > 0) {
    supabase
      .from('inventario_vidrio')
      .select('hojas_entrada')
      .eq('id_inventario', id_inventario)
      .single()
      .then(({ data: d, error: e }) => {
        if (!e && d?.hojas_entrada != null) {
          supabase
            .from('inventario_vidrio')
            .update({ hojas_entrada: Number(d.hojas_entrada) + hojas_delta })
            .eq('id_inventario', id_inventario)
            .then()
        }
      })
      .catch(() => {})
  }

  const { error: movErr } = await supabase
    .from('movimiento_inventario_vidrio')
    .insert({
      id_inventario,
      tipo_movimiento:     hojas_delta > 0 ? 'ENTRADA' : 'AJUSTE',
      m2_cantidad:         Math.abs(m2_ajuste),
      m2_saldo_resultante: nuevo_saldo_m2,
      nota: nota ?? `${hojas_delta > 0 ? 'Entrada' : 'Descuento'}: ${Math.abs(hojas_delta)} hoja${Math.abs(hojas_delta) !== 1 ? 's' : ''}`,
    })
  if (movErr) throw movErr

  return { cantidad_hojas: nuevas_hojas, m2_disponible: nuevo_saldo_m2 }
}

function ROUND4(n) { return Math.round(n * 10000) / 10000 }

// ── Historial de movimientos de un lote ─────────────────────────────────────

export const getMovimientosInventario = async (id_inventario) => {
  const { data, error } = await supabase
    .from('movimiento_inventario_vidrio')
    .select('*')
    .eq('id_inventario', id_inventario)
    .order('fecha', { ascending: false })
  if (error) throw error
  return data ?? []
}
