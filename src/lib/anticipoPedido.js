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


// Registra un abono: { id_pedido, id_cliente, id_metodo_pago, monto, fecha_hora, referencia, observaciones }
// Devuelve { id_anticipo }
export const crearAnticipoPedido = (data) =>
  apiFetch('/anticipo', { method: 'POST', body: data })

// Resumen del pedido: total, total_anticipos, saldo, num_anticipos, ultimo_anticipo
export const getAnticipoPedido = (id_pedido) =>
  apiFetch(`/anticipo-pedido/${id_pedido}`)
