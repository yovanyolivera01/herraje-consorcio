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
    tipo_vidrio:      row.tipo_vidrio,
    medidas:          row.medidas,
    cantidad_hojas:   row.cantidad_hojas,
    m2_por_hoja:      Number(row.m2_por_hoja),
    m2_disponible:    Number(row.m2_disponible),
    m2_total_inicial: Number(row.m2_total_inicial),
    pct_usado:        Number(row.pct_usado),
    alerta_stock:     row.alerta_stock,   // 'OK' | 'STOCK_BAJO' | 'SIN_STOCK'
  }))
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

// ── Ajuste manual de inventario ──────────────────────────────────────────────
// m2_ajuste puede ser positivo (entrada) o negativo (descuento)

export const ajustarInventario = async (id_inventario, m2_ajuste, nota) => {
  const { data: inv, error: invErr } = await supabase
    .from('inventario_vidrio')
    .select('m2_disponible, m2_por_hoja')
    .eq('id_inventario', id_inventario)
    .single()
  if (invErr) throw invErr

  const nuevo_saldo = Number(inv.m2_disponible) + m2_ajuste
  if (nuevo_saldo < 0) throw new Error('El ajuste resultaría en saldo negativo')

  const { error: updErr } = await supabase
    .from('inventario_vidrio')
    .update({
      m2_disponible:  nuevo_saldo,
      cantidad_hojas: Math.floor(nuevo_saldo / Number(inv.m2_por_hoja)),
    })
    .eq('id_inventario', id_inventario)
  if (updErr) throw updErr

  const { error: movErr } = await supabase
    .from('movimiento_inventario_vidrio')
    .insert({
      id_inventario,
      tipo_movimiento:     'AJUSTE',
      m2_cantidad:         Math.abs(m2_ajuste),
      m2_saldo_resultante: nuevo_saldo,
      nota,
    })
  if (movErr) throw movErr

  return { m2_disponible: nuevo_saldo }
}

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
