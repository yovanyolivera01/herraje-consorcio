import { useEffect, useState } from 'react'
import { getPedidosPendientes } from '../../lib/pedidosApi'
import ModalAnticipoPedido from '../../components/modalAnticipoPedido'

const fmt = n => Number(n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

// Pedidos pendientes con saldo: desde aqui se registran los abonos (anticipos).
export default function Anticipos() {

  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  // null = modal cerrado; un pedido = modal abierto para ese pedido
  const [pedidoSel, setPedidoSel] = useState(null)

  const cargarPedidos = async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getPedidosPendientes()
      // solo los que todavia deben algo
      setPedidos(rows.filter(p => p.saldo > 0))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarPedidos() }, [])

  const q = busqueda.trim().toLowerCase()
  const filtrados = pedidos.filter(p =>
    String(p.folio ?? '').toLowerCase().includes(q) ||
    p.clienteNombre.toLowerCase().includes(q)
  )

  return (
    <div className="page-body">
      <div className="page-header">
        <div className="page-title">Anticipos de pedidos</div>
        <div>
          <input
            className="form-input"
            placeholder="Buscar folio o cliente…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
      ) : filtrados.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Sin pedidos con saldo pendiente.</p>
      ) : (
        <div className="table-container">
          <table className="table table-mobile-cards">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Abonado</th>
                <th>Saldo</th>
                <th>Estatus</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id}>
                  <td data-label="Folio">{p.folio}</td>
                  <td data-label="Fecha">{p.fecha}</td>
                  <td data-label="Cliente">{p.clienteNombre}</td>
                  <td data-label="Total">{fmt(p.total)}</td>
                  <td data-label="Abonado">{fmt(p.anticipo)}</td>
                  <td data-label="Saldo"><strong>{fmt(p.saldo)}</strong></td>
                  <td data-label="Estatus">{p.estatus}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setPedidoSel({ id_pedido: p.id, folio: p.folio })}
                    >
                      Abonar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pedidoSel && (
        <ModalAnticipoPedido
          pedido={pedidoSel}
          onClose={() => setPedidoSel(null)}
          onSaved={cargarPedidos}
        />
      )}
    </div>
  )
}
