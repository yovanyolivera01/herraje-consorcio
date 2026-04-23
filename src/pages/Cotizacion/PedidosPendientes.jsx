import { useState, useEffect, useCallback } from 'react'
import { getPedidosPendientes, getDetallePedido, marcarComoEntregado } from '../../lib/pedidosApi'

// ── Ticket de pedido ──────────────────────────────────────────────────────
function TicketPedido({ detalle }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>HERRAJES CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>PEDIDO DE VIDRIO</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Pedido:</span><strong>{detalle.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{detalle.fecha}</span></div>
      <div className="ticket-row"><span>Cliente:</span><span>{detalle.cliente?.nombre ?? 'Mostrador'}</span></div>
      <div className="ticket-row"><span>Nivel:</span><span>{detalle.nivel?.nombre ?? '—'}</span></div>
      {detalle.observaciones && (
        <div className="ticket-row" style={{ flexDirection:'column', gap:2 }}>
          <span style={{ fontSize:11 }}>Observaciones:</span>
          <span style={{ fontSize:12 }}>{detalle.observaciones}</span>
        </div>
      )}
      <hr className="ticket-divider" />

      {detalle.partidas.map((p, i) => (
        <div key={p.id} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 12 }}>
            {i + 1}. {p.clave_vidrio} — {p.largo_cm}×{p.ancho_cm} cm · {p.metros2.toFixed(4)} m²
          </div>
          {p.descripcion_vidrio && (
            <div style={{ fontSize:11, color:'var(--text-muted)', paddingLeft:14 }}>{p.descripcion_vidrio}</div>
          )}
          <div className="ticket-row" style={{ fontSize:11, color:'var(--text-muted)' }}>
            <span>${p.precio_m2_aplicado.toFixed(2)}/m²</span>
            <span>${p.subtotal_vidrio.toFixed(2)}</span>
          </div>
          {p.procesos.map((pr, j) => (
            <div key={j} className="ticket-row" style={{ fontSize:11, paddingLeft:10 }}>
              <span>+ {pr.nombre}</span>
              <span>${pr.subtotal.toFixed(2)}</span>
            </div>
          ))}
          <div className="ticket-row" style={{ fontWeight:600, fontSize:12 }}>
            <span>Subtotal</span>
            <span>${p.subtotal_partida.toFixed(2)}</span>
          </div>
        </div>
      ))}

      <hr className="ticket-divider" />
      <div className="ticket-total"><span>TOTAL</span><span>${detalle.total.toFixed(2)}</span></div>
      <div className="ticket-row" style={{ marginTop:6 }}>
        <span>Anticipo pagado:</span>
        <span style={{ fontWeight:600 }}>${detalle.anticipo.toFixed(2)}</span>
      </div>
      <div className="ticket-row">
        <span>Saldo pendiente:</span>
        <span style={{ fontWeight:700, color:'var(--danger)' }}>${detalle.saldo.toFixed(2)}</span>
      </div>
      <hr className="ticket-divider" />
      <div style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', marginTop:8 }}>
        Pedido pendiente de entrega.
      </div>
    </div>
  )
}

// ── Ticket de entrega (post-entrega) ──────────────────────────────────────
function TicketEntrega({ detalle, saldoCobrado }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>HERRAJES CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>COMPROBANTE DE ENTREGA</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Pedido:</span><strong>{detalle.folio}</strong></div>
      <div className="ticket-row"><span>Fecha entrega:</span><span>{new Date().toLocaleDateString('es-MX')}</span></div>
      <div className="ticket-row"><span>Cliente:</span><span>{detalle.cliente?.nombre ?? 'Mostrador'}</span></div>
      <hr className="ticket-divider" />

      {detalle.partidas.map((p, i) => (
        <div key={p.id} style={{ marginBottom: 8 }}>
          <div style={{ fontWeight:600, fontSize:12 }}>
            {i+1}. {p.clave_vidrio} — {p.largo_cm}×{p.ancho_cm} cm · {p.metros2.toFixed(4)} m²
          </div>
          {p.procesos.map((pr, j) => (
            <div key={j} style={{ fontSize:11, color:'var(--text-muted)', paddingLeft:12 }}>
              + {pr.nombre}: ${pr.subtotal.toFixed(2)}
            </div>
          ))}
          <div className="ticket-row" style={{ fontWeight:600, fontSize:12 }}>
            <span>Subtotal</span>
            <span>${p.subtotal_partida.toFixed(2)}</span>
          </div>
        </div>
      ))}

      <hr className="ticket-divider" />
      <div className="ticket-total"><span>TOTAL</span><span>${detalle.total.toFixed(2)}</span></div>
      <div className="ticket-row" style={{ marginTop:6 }}>
        <span>Anticipo pagado:</span>
        <span>${detalle.anticipo.toFixed(2)}</span>
      </div>
      <div className="ticket-row">
        <span>Saldo cobrado hoy:</span>
        <span style={{ fontWeight:700 }}>${Number(saldoCobrado).toFixed(2)}</span>
      </div>
      <hr className="ticket-divider" />
      <div style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', marginTop:8 }}>
        ¡Gracias por su compra!
      </div>
    </div>
  )
}

// ── Modal: marcar como entregado ─────────────────────────────────────────
function MarcarEntregadoModal({ detalle, onClose, onEntregado }) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)
  const saldoPendiente = detalle.saldo

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)
    try {
      await marcarComoEntregado(detalle.id, saldoPendiente)
      onEntregado(saldoPendiente)
    } catch (err) {
      setError(err.message || 'Error al registrar la entrega')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Registrar entrega</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize:14, marginBottom:14 }}>
            ¿Confirmar entrega del pedido <strong>{detalle.folio}</strong>?
          </div>

          {/* Resumen de cobro */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
            {[
              ['Total pedido',   `$${detalle.total.toFixed(2)}`,      'var(--text)'],
              ['Anticipo pagado', `$${detalle.anticipo.toFixed(2)}`,  'var(--accent)'],
              ['Saldo a cobrar',  `$${saldoPendiente.toFixed(2)}`,    'var(--danger)'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ textAlign:'center', background:'var(--bg)', borderRadius:8, padding:'10px 6px' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
                <div style={{ fontWeight:700, fontSize:16, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Saldo protegido — solo lectura */}
          <div className="form-group">
            <label className="form-label">Saldo cobrado al cliente ($)</label>
            <input
              className="form-input"
              type="text"
              value={`$${saldoPendiente.toFixed(2)}`}
              readOnly
              style={{ background:'var(--bg)', cursor:'default', fontWeight:700, fontSize:16, color:'var(--danger)' }}
            />
            <div className="form-hint">
              Este monto corresponde exactamente al saldo pendiente registrado y no puede modificarse.
            </div>
          </div>

          <div className="alert alert-warning" style={{ marginTop:8 }}>
            ⚠️ Esta accion no se puede revertir. El pedido pasara al historial de ventas.
          </div>
          {error && <div className="alert alert-error">❌ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Registrando...' : `✅ Confirmar — cobrar $${saldoPendiente.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: detalle del pedido pendiente ───────────────────────────────────
function DetallePedidoModal({ resumen, onClose, onEntregado }) {
  const [detalle,      setDetalle]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [showEntregar, setShowEntregar] = useState(false)
  const [entregado,    setEntregado]    = useState(null) // { saldoCobrado }

  useEffect(() => {
    getDetallePedido(resumen.id).then(d => { setDetalle(d); setLoading(false) }).catch(e => { setError(e.message); setLoading(false) })
  }, [resumen.id])

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-body" style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
          Cargando detalle...
        </div>
      </div>
    </div>
  )

  // Post-entrega: mostrar ticket de entrega
  if (entregado) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <div className="modal-title">Entrega registrada — {detalle.folio}</div>
            </div>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div className="alert alert-success">✅ Pedido entregado y registrado correctamente.</div>
            <TicketEntrega detalle={detalle} saldoCobrado={entregado.saldoCobrado} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
            <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !showEntregar && onClose()}>
        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <div className="modal-title">Pedido pendiente — {resumen.folio}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                {resumen.fecha} · {resumen.clienteNombre}
              </div>
            </div>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            {error  && <div className="alert alert-error">❌ {error}</div>}
            {detalle && (
              <>
                {/* Resumen de pago */}
                <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
                  {[
                    ['Total', `$${detalle.total.toFixed(2)}`, 'var(--text)'],
                    ['Anticipo', `$${detalle.anticipo.toFixed(2)}`, 'var(--accent)'],
                    ['Saldo pendiente', `$${detalle.saldo.toFixed(2)}`, 'var(--danger)'],
                  ].map(([label, val, color]) => (
                    <div key={label} className="stat-card" style={{ flex:1, minWidth:120 }}>
                      <div className="stat-label">{label}</div>
                      <div className="stat-value" style={{ fontSize:18, color }}>{val}</div>
                    </div>
                  ))}
                </div>
                <TicketPedido detalle={detalle} />
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
            {detalle && (
              <>
                <button className="btn btn-outline" onClick={() => window.print()}>🖨️ Imprimir</button>
                <button className="btn btn-primary" onClick={() => setShowEntregar(true)}>
                  📦 Marcar como entregado
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showEntregar && detalle && (
        <MarcarEntregadoModal
          detalle={detalle}
          onClose={() => setShowEntregar(false)}
          onEntregado={(saldoCobrado) => {
            setShowEntregar(false)
            setEntregado({ saldoCobrado })
            onEntregado() // avisa a la página padre para refrescar
          }}
        />
      )}
    </>
  )
}

// ── Página Pedidos Pendientes ─────────────────────────────────────────────
export default function PedidosPendientes() {
  const [pedidos,      setPedidos]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      setPedidos(await getPedidosPendientes())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const totalSaldo = pedidos.reduce((s, p) => s + p.saldo, 0)

  if (loading) return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)' }}>
      Cargando pedidos...
    </div>
  )

  if (error) return (
    <div className="page-body">
      <div className="alert alert-error">❌ {error}</div>
      <button className="btn btn-outline" onClick={cargar}>Reintentar</button>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Pedidos Pendientes</div>
          <div className="page-subtitle">
            {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} en espera de entrega
          </div>
        </div>
        <button className="btn btn-outline" onClick={cargar}>↻ Actualizar</button>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Pedidos pendientes</div>
            <div className="stat-value">{pedidos.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total saldo por cobrar</div>
            <div className="stat-value" style={{ fontSize:18, color:'var(--danger)' }}>
              ${totalSaldo.toFixed(2)}
            </div>
          </div>
        </div>

        {pedidos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3>Sin pedidos pendientes</h3>
            <p>Todos los pedidos han sido entregados</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:14 }}>
            {pedidos.map(p => (
              <div
                key={p.id}
                className="card"
                style={{ cursor:'pointer', transition:'box-shadow 0.15s' }}
                onClick={() => setSeleccionado(p)}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
              >
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <span className="badge badge-orange" style={{ fontSize:13 }}>{p.folio}</span>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{p.fecha}</span>
                </div>

                <div style={{ fontWeight:600, fontSize:15, marginBottom:12 }}>
                  {p.clienteNombre}
                </div>
                {p.nivelNombre && (
                  <div style={{ marginBottom:10 }}>
                    <span className="badge badge-gray">{p.nivelNombre}</span>
                  </div>
                )}

                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
                  {[
                    ['Total',    `$${p.total.toFixed(2)}`,    'var(--text)'],
                    ['Anticipo', `$${p.anticipo.toFixed(2)}`, 'var(--accent)'],
                    ['Saldo',    `$${p.saldo.toFixed(2)}`,    'var(--danger)'],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ textAlign:'center', background:'var(--bg)', borderRadius:8, padding:'8px 4px' }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>{label}</div>
                      <div style={{ fontWeight:700, fontSize:14, color }}>{val}</div>
                    </div>
                  ))}
                </div>

                <button
                  className="btn btn-outline btn-sm"
                  style={{ width:'100%', marginTop:12, justifyContent:'center' }}
                  onClick={e => { e.stopPropagation(); setSeleccionado(p) }}
                >
                  Ver detalle
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {seleccionado && (
        <DetallePedidoModal
          resumen={seleccionado}
          onClose={() => setSeleccionado(null)}
          onEntregado={() => cargar()} // refresca lista; pedido desaparece de pendientes
        />
      )}
    </>
  )
}
