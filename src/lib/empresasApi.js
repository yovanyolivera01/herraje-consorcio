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

export const getPreciosClienteRegistrado = (id_cliente) =>
  http.get(`/api/clientes/${id_cliente}/precios`)

export const guardarPrecioClienteRegistrado = ({ id_cliente, id_tipo_vidrio, id_proceso, precio_m2 }) =>
  http.post(`/api/clientes/${id_cliente}/precios`, {
    id_tipo_vidrio,
    id_proceso: id_proceso ?? null,
    precio_m2,
  })

// ── Documento de cotización para empresa ──────────────────────────────────

export const getDocumentoEmpresa = (id_cotizacion) =>
  http.get(`/api/cotizaciones/${id_cotizacion}/documento-empresa`)
