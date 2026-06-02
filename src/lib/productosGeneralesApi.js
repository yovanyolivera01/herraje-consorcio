import { http } from './http'

export const getProductosGenerales = () => http.get('/api/productos-generales')

export const createProductoGeneral = ({ nombre, descripcion, unidad, precio }) =>
  http.post('/api/productos-generales', { nombre, descripcion, unidad, precio })

export const updateProductoGeneral = (id, campos) =>
  http.put(`/api/productos-generales/${id}`, campos)

export const ajustarExistenciasGeneral = (id, delta) =>
  http.post(`/api/productos-generales/${id}/ajustar`, { delta })

export const venderProductoGeneral = (id, cantidad) =>
  http.post(`/api/productos-generales/${id}/vender`, { cantidad })
