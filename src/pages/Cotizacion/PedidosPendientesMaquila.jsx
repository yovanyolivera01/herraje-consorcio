import { useState, useEffect, useCallback } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

const BADGE_ESTATUS_ENTREGA = {
  PENDIENTE:  { label: 'Pendiente',  bg: '#fef3c7', color: '#d97706' },
  ENTREGADO:  { label: 'Entregado',  bg: '#dcfce7', color: '#16a34a' },
}

// ── Modal: detalle de pedido maquila ──────────────────────────────────────
function DetallePedidoMaquilaModal({ pedidoResumen, onClose, onActualizado }) {
  const { getDetallePedidoMaquila, entregarPartidaMaquila, marcarAnticipoLiquidadoMaquila } = useCotizacion()
  const [detalle,   setDetalle]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [entregando, setEntregando] = useState(null) // id de partida en proceso
  const [liquidando, setLiquidando] = useState(false)

  const cargarDetalle = useCallback(async () => {
    const res = await getDetallePedidoMaquila(pedidoResumen.id)
    if (res.error) { setError(res.error); setLoading(false); return }
    setDetalle(res.data); setLoading(false)
  }, [pedidoResumen.id, getDetallePedidoMaquila])

  useEffect(() => { cargarDetalle() }, [cargarDetalle])

  const handleEntregar = async (id_partida) => {
    setEntregando(id_partida); setError(null)
    const res = await entregarPartidaMaquila(id_partida)
    setEntregando(null)
    if (res.error) { setError(res.error); return }
    await cargarDetalle()
    onActualizado()
  }

  const handleLiquidar = async () => {
    setLiquidando(true); setError(null)
    const res = await marcarAnticipoLiquidadoMaquila(detalle.id)
    setLiquidando(false)
    if (res.error) { setError(res.error); return }
    await cargarDetalle()
    onActualizado()
  }

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal"><div className="modal-body" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Cargando detalle...</div></div>
    </div>
  )

  const totalEntregadas = detalle?.partidas?.filter(p => p.estatus_entrega === 'ENTREGADO').length ?? 0
  const totalPartidas   = detalle?.partidas?.length ?? 0
  const puedeLiquidar   = detalle && detalle.estatus !== 'ANTICIPO_LIQUIDADO' && detalle.anticipo > 0 && detalle.saldo > 0

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 660 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{detalle?.folio ?? pedidoResumen.folio}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {detalle?.fecha} · {detalle?.cliente?.nombre ?? 'Mostrador'}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">❌ {error}</div>}

          {detalle && (
            <>
              {/* Barra de pago */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                {[
                  ['Total',           `$${detalle.total.toFixed(2)}`,    'var(--text)'],
                  ['Anticipo',         `$${detalle.anticipo.toFixed(2)}`, 'var(--accent)'],
                  ['Saldo pendiente',  `$${detalle.saldo.toFixed(2)}`,   'var(--danger)'],
                  ['Partidas',         `${totalEntregadas}/${totalPartidas}`, 'var(--text)'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ flex: 1, textAlign: 'center', padding: '10px 8px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: 15, color }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Partidas con botón de entrega individual */}
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                  Partidas
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detalle.partidas.map((p, i) => {
                    const badge = BADGE_ESTATUS_ENTREGA[p.estatus_entrega] ?? BADGE_ESTATUS_ENTREGA.PENDIENTE
                    return (
                      <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'white' }}>
                          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              {p.cantidad} pza{p.cantidad !== 1 ? 's' : ''} · {p.largo_cm}×{p.ancho_cm} cm
                            </div>
                            {p.descripcion && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.descripcion}</div>}
                          </div>
                          <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color, flexShrink: 0 }}>
                            {badge.label}
                          </span>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', flexShrink: 0 }}>
                            ${p.subtotal_partida.toFixed(2)}
                          </div>
                          {p.estatus_entrega !== 'ENTREGADO' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleEntregar(p.id)}
                              disabled={entregando === p.id}
                              style={{ flexShrink: 0 }}
                            >
                              {entregando === p.id ? '...' : '✓ Entregar'}
                            </button>
                          )}
                        </div>
                        {p.procesos?.length > 0 && (
                          <div style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '6px 14px 6px 54px' }}>
                            {p.procesos.map((pr, j) => (
                              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', paddingBottom: j < p.procesos.length - 1 ? 3 : 0 }}>
                                <span>+ {pr.nombre} {pr.cantidad_unidades !== 1 ? `× ${pr.cantidad_unidades}` : ''}</span>
                                <span>${pr.subtotal.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          {puedeLiquidar && (
            <button className="btn btn-outline" onClick={handleLiquidar} disabled={liquidando}>
              {liquidando ? '...' : '💳 Marcar anticipo liquidado'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────
export default function PedidosPendientesMaquila() {
  const { getPedidosPendientesMaquila } = useCotizacion()
  const [pedidos,      setPedidos]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await getPedidosPendientesMaquila()
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setPedidos(res.data)
  }, [getPedidosPendientesMaquila])

  useEffect(() => { cargar() }, [cargar])

  const totalSaldo = pedidos.reduce((s, p) => s + p.saldo, 0)

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>Cargando pedidos...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Pedidos Pendientes — Maquila</div>
          <div className="page-subtitle">{pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} en proceso</div>
        </div>
        <button className="btn btn-outline" onClick={cargar}>↻ Actualizar</button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">❌ {error}</div>}

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Pedidos activos</div>
            <div className="stat-value">{pedidos.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Saldo por cobrar</div>
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--danger)' }}>${totalSaldo.toFixed(2)}</div>
          </div>
        </div>

        {pedidos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔨</div>
            <h3>Sin pedidos pendientes de maquila</h3>
            <p>Todos los pedidos han sido completados</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Anticipo</th>
                  <th style={{ textAlign: 'right' }}>Saldo</th>
                  <th>Partidas</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSeleccionado(p)}>
                    <td data-label="Folio">
                      <span className="badge badge-orange">{p.folio}</span>
                    </td>
                    <td data-label="Fecha" style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{p.fecha}</td>
                    <td data-label="Cliente" style={{ fontWeight: 600 }}>{p.clienteNombre}</td>
                    <td data-label="Total" style={{ textAlign: 'right', fontWeight: 600 }}>${p.total.toFixed(2)}</td>
                    <td data-label="Anticipo" style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>${p.anticipo.toFixed(2)}</td>
                    <td data-label="Saldo" style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }}>${p.saldo.toFixed(2)}</td>
                    <td data-label="Partidas">
                      <span style={{ fontSize: 13 }}>
                        {p.partidasPendientes > 0
                          ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{p.partidasPendientes} pendiente{p.partidasPendientes !== 1 ? 's' : ''}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> / {p.numPartidas}</span>
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {seleccionado && (
        <DetallePedidoMaquilaModal
          pedidoResumen={seleccionado}
          onClose={() => setSeleccionado(null)}
          onActualizado={() => cargar()}
        />
      )}
    </>
  )
}
