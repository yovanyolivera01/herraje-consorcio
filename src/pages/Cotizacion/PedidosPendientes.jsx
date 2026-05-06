import { useState, useEffect, useCallback } from 'react'
import { getPedidosPendientes, getDetallePedido, marcarComoEntregado } from '../../lib/pedidosApi'
import { printPedidoPendiente, printTicketVidrio } from '../../utils/ticket'

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
            <button className="btn btn-primary" onClick={() => printTicketVidrio({
              tipo: 'pedido',
              folio: detalle.folio,
              foliosCot: detalle.id_cotizacion ? `COT-${String(detalle.id_cotizacion).padStart(5,'0')}` : null,
              fecha: detalle.fecha,
              hora: detalle.hora ?? '',
              clienteNombre: detalle.cliente?.nombre ?? 'Mostrador',
              nivelNombre: detalle.nivel?.nombre ?? '',
              formaPago: detalle.forma_pago ?? 'ANTICIPO',
              anticipo: detalle.anticipo ?? 0,
              saldo: 0,
              saldo_cobrado: entregado.saldoCobrado,
              esEntregado: true,
              total: detalle.total,
              partidas: detalle.partidas.map(p => ({
                piezas: p.cantidad ?? 1, clave: p.clave_vidrio,
                largo_cm: p.largo_cm, ancho_cm: p.ancho_cm,
                subtotal_vidrio: p.subtotal_vidrio, procesos: p.procesos,
                subtotal_partida: p.subtotal_partida,
              })),
            })}>🖨️ Imprimir</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !showEntregar && onClose()}>
        <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
          <div className="modal-header">
            <div>
              <div className="modal-title">{resumen.folio}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                {resumen.fecha} · <strong>{resumen.clienteNombre}</strong>
                {resumen.nivelNombre && <span className="badge badge-gray" style={{ marginLeft:8, fontSize:11 }}>{resumen.nivelNombre}</span>}
              </div>
            </div>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body" style={{ padding: '0 0 4px' }}>
            {error && <div className="alert alert-error" style={{ margin:'12px 20px 0' }}>❌ {error}</div>}

            {detalle && (
              <>
                {/* Barra de pago compacta */}
                <div style={{
                  display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
                  background: 'var(--bg)',
                }}>
                  {[
                    ['Total',           `$${detalle.total.toFixed(2)}`,    'var(--text)',    ''],
                    ['Anticipo pagado',  `$${detalle.anticipo.toFixed(2)}`, 'var(--accent)', ''],
                    ['Saldo pendiente',  `$${detalle.saldo.toFixed(2)}`,    'var(--danger)', '⚠️ '],
                  ].map(([label, val, color, icon]) => (
                    <div key={label} style={{ flex:1, textAlign:'center', padding:'10px 8px', borderRight:'1px solid var(--border)' }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{label}</div>
                      <div style={{ fontWeight:700, fontSize:16, color }}>{icon}{val}</div>
                    </div>
                  ))}
                </div>

                {/* Partidas */}
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
                    Partidas — {detalle.partidas.length} {detalle.partidas.length === 1 ? 'pieza' : 'registros'}
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {detalle.partidas.map((p, i) => (
                      <div key={p.id} style={{
                        border: '1px solid var(--border)', borderRadius: 10,
                        overflow: 'hidden',
                      }}>
                        {/* Fila principal */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', background: 'white',
                        }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: 'var(--accent)', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, flexShrink: 0,
                          }}>
                            {i + 1}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight:700, fontSize:15 }}>
                              {p.cantidad ?? 1} pza{(p.cantidad ?? 1) > 1 ? 's' : ''} · {p.largo_cm} × {p.ancho_cm} cm
                            </div>
                            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>
                              <span className="badge badge-blue" style={{ fontSize:11, marginRight:6 }}>{p.clave_vidrio}</span>
                              {p.descripcion_vidrio && <span>{p.descripcion_vidrio}</span>}
                            </div>
                          </div>

                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontWeight:700, fontSize:15, color:'var(--accent)' }}>
                              ${p.subtotal_partida.toFixed(2)}
                            </div>
                            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                              {p.metros2.toFixed(4)} m²
                            </div>
                          </div>
                        </div>

                        {/* Procesos si los hay */}
                        {p.procesos && p.procesos.length > 0 && (
                          <div style={{ background:'var(--bg)', borderTop:'1px solid var(--border)', padding:'6px 14px 6px 54px' }}>
                            {p.procesos.map((pr, j) => (
                              <div key={j} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-muted)', paddingBottom: j < p.procesos.length - 1 ? 3 : 0 }}>
                                <span>+ {pr.nombre} {pr.cantidad !== 1 ? `× ${pr.cantidad}` : ''}</span>
                                <span>${pr.subtotal.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Total al final */}
                  <div style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    marginTop:12, paddingTop:12, borderTop:'2px solid var(--border)',
                    fontWeight:700, fontSize:16,
                  }}>
                    <span>Total</span>
                    <span style={{ color:'var(--accent)' }}>${detalle.total.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
            {detalle && (
              <>
                <button className="btn btn-outline" onClick={() => printPedidoPendiente(detalle)}>🖨️ Imprimir</button>
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
            onEntregado()
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
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Nivel</th>
                  <th style={{ textAlign:'right' }}>Total</th>
                  <th style={{ textAlign:'right' }}>Anticipo</th>
                  <th style={{ textAlign:'right' }}>Saldo</th>
                  <th style={{ width:80 }}></th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map(p => (
                  <tr
                    key={p.id}
                    style={{ cursor:'pointer' }}
                    onClick={() => setSeleccionado(p)}
                  >
                    <td data-label="Folio">
                      <span className="badge badge-orange">{p.folio}</span>
                    </td>
                    <td data-label="Fecha" style={{ fontSize:13, color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                      {p.fecha}
                    </td>
                    <td data-label="Cliente" style={{ fontWeight:600 }}>
                      {p.clienteNombre}
                    </td>
                    <td data-label="Nivel">
                      {p.nivelNombre
                        ? <span className="badge badge-gray">{p.nivelNombre}</span>
                        : <span style={{ color:'var(--text-muted)', fontSize:13 }}>—</span>
                      }
                    </td>
                    <td data-label="Total" style={{ textAlign:'right', fontWeight:600 }}>
                      ${p.total.toFixed(2)}
                    </td>
                    <td data-label="Anticipo" style={{ textAlign:'right', color:'var(--accent)', fontWeight:600 }}>
                      ${p.anticipo.toFixed(2)}
                    </td>
                    <td data-label="Saldo" style={{ textAlign:'right', color:'var(--danger)', fontWeight:700 }}>
                      ${p.saldo.toFixed(2)}
                    </td>
                    <td data-label="">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={e => { e.stopPropagation(); setSeleccionado(p) }}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
