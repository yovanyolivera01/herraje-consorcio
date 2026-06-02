import { http } from './http'

export const getInventarioVidrio = async () => {
  const rows = await http.get('/api/inventario-vidrio')
  return rows.map(row => ({
    id_inventario:    row.id_inventario,
    id_tipo_vidrio:   row.id_tipo_vidrio,
    tipo_vidrio:      row.tipo_vidrio,
    medidas:          row.medidas,
    hojas_entrada:    Number(row.hojas_entrada    ?? 0),
    hojas_restante:   Number(row.hojas_restante   ?? 0),
    cantidad_hojas:   row.cantidad_hojas,
    m2_por_hoja:      Number(row.m2_por_hoja),
    m2_disponible:    Number(row.m2_disponible),
    m2_total_inicial: Number(row.m2_total_inicial),
    pct_usado:        Number(row.pct_usado),
    alerta_stock:     row.alerta_stock,
    es_preferido:     row.es_preferido ?? false,
  }))
}

export const setLotePreferido = (id_inventario) =>
  http.post(`/api/inventario-vidrio/${id_inventario}/preferido`)

export const registrarInventarioVidrio = ({ id_tipo_vidrio, largo_cm, ancho_cm, cantidad_hojas }) =>
  http.post('/api/inventario-vidrio', { id_tipo_vidrio, largo_cm, ancho_cm, cantidad_hojas })

export const ajustarInventario = (id_inventario, hojas_delta, nota) =>
  http.post(`/api/inventario-vidrio/${id_inventario}/ajustar`, { hojas_delta, nota })

export const getMovimientosInventario = (id_inventario) =>
  http.get(`/api/inventario-vidrio/${id_inventario}/movimientos`)
