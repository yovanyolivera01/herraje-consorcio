const API = import.meta.env.VITE_API_URL || ''

async function apiFetch(path, options = {}) {
  const { method = 'GET', body } = options
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
  return data
}


export const getClientes = async () => apiFetch('/clientes')

export const getClienteEmpresa = async (id_cliente) => apiFetch(`/clientes/${id_cliente}/empresa`)

export const createCliente = async ({ nombre, telefono, correo, id_nivel_precio,rfc,razon_social,cp_fiscal,regimen_fiscal,uso_cfdi }) =>
  apiFetch('/clientes', { method: 'POST', body: { nombre, telefono: telefono || null, correo: correo || null, id_nivel_precio: id_nivel_precio || null, rfc: rfc|| null, razon_social: razon_social||null, cp_fiscal: cp_fiscal||null, regimen_fiscal: regimen_fiscal|| null, uso_cfdi:uso_cfdi||null } })

export const updateCliente = async (id_cliente, campos) =>
  apiFetch(`/clientes/${id_cliente}`, { method: 'PUT', body: campos })
