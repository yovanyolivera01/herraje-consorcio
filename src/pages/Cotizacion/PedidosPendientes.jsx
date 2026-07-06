import { useState, useEffect, useCallback } from 'react'
import { fmt5 } from '../../lib/utils'
import { getPedidosPendientes, getDetallePedido, marcarComoEntregado, getPedidosCredito } from '../../lib/pedidosApi'
import { getPedidosPendientesMaquila, getDetallePedidoMaquila, entregarPartidaMaquila, marcarAnticipoLiquidado as marcarAnticipoMaquila } from '../../lib/maquilaApi'
import { printPedidoPendiente, printTicketVidrio } from '../../utils/ticket'

// ── Ticket de pedido ──────────────────────────────────────────────────────
function TicketPedido({ detalle, extras = [] }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h2>
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
            {i + 1}. {p.cantidad ?? 1} · {p.largo_cm}×{p.ancho_cm} cm · {p.clave_vidrio} · {p.metros2.toFixed(4)} m²
          </div>
          {p.descripcion_vidrio && (
            <div style={{ fontSize:11, color:'var(--text-muted)', paddingLeft:14 }}>{p.descripcion_vidrio}</div>
          )}
          <div className="ticket-row" style={{ fontSize:11, color:'var(--text-muted)' }}>
            <span>${p.precio_m2_aplicado.toFixed(2)}/m²</span>
            <span>${fmt5(p.subtotal_vidrio)}</span>
          </div>
          {p.procesos.map((pr, j) => (
            <div key={j} className="ticket-row" style={{ fontSize:11, paddingLeft:10 }}>
              <span>+ {pr.nombre}</span>
              <span>${fmt5(pr.subtotal)}</span>
            </div>
          ))}
          <div className="ticket-row" style={{ fontWeight:600, fontSize:12 }}>
            <span>Subtotal</span>
            <span>${fmt5(p.subtotal_partida)}</span>
          </div>
        </div>
      ))}

      {extras.map((e, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
            <span>{e.tipo === 'MAQUILA' ? '🔧 ' : ''}{e.descripcion}</span>
            <span>${fmt5(e.subtotal)}</span>
          </div>
          {e.tipo !== 'MAQUILA' && (
            <div style={{ fontSize:11, color:'var(--text-muted)', paddingLeft:10 }}>
              {e.cantidad} {e.unidad} × ${Number(e.precio_unitario).toFixed(2)}
            </div>
          )}
        </div>
      ))}

      <hr className="ticket-divider" />
      <div className="ticket-total"><span>TOTAL</span><span>${fmt5(detalle.total)}</span></div>
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
function TicketEntrega({ detalle, saldoCobrado, extras = [] }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h2>
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
            {i+1}. {p.cantidad ?? 1} · {p.largo_cm}×{p.ancho_cm} cm · {p.clave_vidrio}
          </div>
          {p.procesos.map((pr, j) => (
            <div key={j} style={{ fontSize:11, color:'var(--text-muted)', paddingLeft:12 }}>
              + {pr.nombre}: ${fmt5(pr.subtotal)}
            </div>
          ))}
          <div className="ticket-row" style={{ fontWeight:600, fontSize:12 }}>
            <span>Subtotal</span>
            <span>${fmt5(p.subtotal_partida)}</span>
          </div>
        </div>
      ))}

      {extras.map((e, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
            <span>{e.tipo === 'MAQUILA' ? '🔧 ' : ''}{e.descripcion}</span>
            <span>${fmt5(e.subtotal)}</span>
          </div>
          {e.tipo !== 'MAQUILA' && (
            <div style={{ fontSize:11, color:'var(--text-muted)', paddingLeft:10 }}>
              {e.cantidad} {e.unidad} × ${Number(e.precio_unitario).toFixed(2)}
            </div>
          )}
        </div>
      ))}

      <hr className="ticket-divider" />
      <div className="ticket-total"><span>TOTAL</span><span>${fmt5(detalle.total)}</span></div>
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
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState(null)
  const [saldoCobrado, setSaldoCobrado] = useState('')
  const saldoPendiente = detalle.saldo

  const montoNum = Number(saldoCobrado)
  const montoValido = !isNaN(montoNum) && montoNum === saldoPendiente

  const handleConfirm = async () => {
    if (!montoValido) return
    setSaving(true)
    setError(null)
    try {
      await marcarComoEntregado(detalle.id, montoNum)
      onEntregado(montoNum)
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
              ['Total pedido',    `$${fmt5(detalle.total)}`,           'var(--text)'],
              ['Anticipo pagado', `$${detalle.anticipo.toFixed(2)}`,   'var(--accent)'],
              ['Saldo pendiente', `$${saldoPendiente.toFixed(2)}`,     'var(--danger)'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ textAlign:'center', background:'var(--bg)', borderRadius:8, padding:'10px 6px' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
                <div style={{ fontWeight:700, fontSize:16, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Saldo editable */}
          <div className="form-group">
            <label className="form-label required">Saldo cobrado al cliente ($)</label>
            <input
              className={`form-input${!montoValido && saldoCobrado !== '' ? ' error' : ''}`}
              type="number"
              step="0.01"
              min="0.01"
              max={saldoPendiente}
              value={saldoCobrado}
              onChange={e => setSaldoCobrado(e.target.value)}
              placeholder={saldoPendiente.toFixed(2)}
              style={{ fontWeight:700, fontSize:16, color:'var(--danger)' }}
              autoFocus
            />
            {!montoValido && saldoCobrado !== '' && (
              <div className="form-error">
                El monto debe ser exactamente ${saldoPendiente.toFixed(2)}
              </div>
            )}
            <div className="form-hint">Escribe el saldo pendiente para confirmar el cobro.</div>
          </div>

          <div className="alert alert-warning" style={{ marginTop:8 }}>
            ⚠️ Esta accion no se puede revertir. El pedido pasara al historial de ventas.
          </div>
          {error && <div className="alert alert-error">❌ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={saving || !montoValido}>
            {saving ? 'Registrando...' : `✅ Confirmar — cobrar $${montoValido ? montoNum.toFixed(2) : '—'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: detalle del pedido pendiente ───────────────────────────────────
function DetallePedidoModal({ resumen, onClose, onEntregado }) {
  const [detalle,      setDetalle]      = useState(null)
  const [extras,       setExtras]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [showEntregar, setShowEntregar] = useState(false)
  useEffect(() => {
    getDetallePedido(resumen.id)
      .then(d => {
        setDetalle(d)
        setExtras(d.extras ?? [])
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
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
                    ['Total',           `$${fmt5(detalle.total)}`,    'var(--text)',    ''],
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
                              {p.cantidad ?? 1} · {p.largo_cm}×{p.ancho_cm} cm
                            </div>
                            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>
                              <span className="badge badge-blue" style={{ fontSize:11, marginRight:6 }}>{p.clave_vidrio}</span>
                              {p.descripcion_vidrio && <span>{p.descripcion_vidrio}</span>}
                            </div>
                          </div>

                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontWeight:700, fontSize:15, color:'var(--accent)' }}>
                              ${fmt5(p.subtotal_partida)}
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
                                <span>${fmt5(pr.subtotal)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {extras.length > 0 && (
                    <>
                      <div style={{ fontWeight:700, fontSize:13, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1, margin:'14px 0 8px' }}>
                        Extras
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {extras.map((e, i) => (
                          <div key={i} style={{ border:'1px solid var(--border)', borderRadius:8, padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div>
                              <span style={{ fontSize:13, fontWeight:600 }}>{e.descripcion}</span>
                              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{e.cantidad} {e.unidad} × ${Number(e.precio_unitario).toFixed(2)}</div>
                            </div>
                            <span style={{ fontWeight:700, color:'var(--accent)', fontSize:14 }}>${fmt5(e.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Total al final */}
                  <div style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    marginTop:12, paddingTop:12, borderTop:'2px solid var(--border)',
                    fontWeight:700, fontSize:16,
                  }}>
                    <span>Total</span>
                    <span style={{ color:'var(--accent)' }}>${fmt5(detalle.total)}</span>
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
          onEntregado={() => {
            setShowEntregar(false)
            onEntregado(detalle.folio)
            onClose()
          }}
        />
      )}
    </>
  )
}

// ── Modal: detalle pedido maquila ─────────────────────────────────────────
function DetalleMaquilaModal({ resumen, onClose, onActualizado }) {
  const [detalle,    setDetalle]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [entregando, setEntregando] = useState(null)
  const [liquidando, setLiquidando] = useState(false)

  const cargarDetalle = useCallback(async () => {
    try {
      setDetalle(await getDetallePedidoMaquila(resumen.id))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [resumen.id])

  useEffect(() => { cargarDetalle() }, [cargarDetalle])

  const handleEntregar = async (id_partida) => {
    setEntregando(id_partida); setError(null)
    try { await entregarPartidaMaquila(id_partida); await cargarDetalle(); onActualizado() }
    catch (e) { setError(e.message) }
    finally { setEntregando(null) }
  }

  const handleLiquidar = async () => {
    setLiquidando(true); setError(null)
    try { await marcarAnticipoMaquila(detalle.id); await cargarDetalle(); onActualizado() }
    catch (e) { setError(e.message) }
    finally { setLiquidando(false) }
  }

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-body" style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
          Cargando detalle...
        </div>
      </div>
    </div>
  )

  const totalEnt = detalle?.partidas?.filter(p => p.estatus_entrega === 'ENTREGADO').length ?? 0
  const totalPart = detalle?.partidas?.length ?? 0
  const puedeLiquidar = detalle && detalle.estatus !== 'ANTICIPO_LIQUIDADO' && detalle.anticipo > 0 && detalle.saldo > 0

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 660 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{detalle?.folio ?? resumen.folio}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              🔨 Maquila · {detalle?.fecha} · {detalle?.cliente?.nombre ?? 'Mostrador'}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding:'0 0 4px' }}>
          {error && <div className="alert alert-error" style={{ margin:'12px 20px 0' }}>❌ {error}</div>}

          {detalle && (
            <>
              <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg)' }}>
                {[
                  ['Total',           `$${fmt5(detalle.total)}`,    'var(--text)'],
                  ['Anticipo',         `$${detalle.anticipo.toFixed(2)}`, 'var(--accent)'],
                  ['Saldo pendiente',  `$${detalle.saldo.toFixed(2)}`,   'var(--danger)'],
                  ['Partidas',         `${totalEnt}/${totalPart}`,        'var(--text)'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ flex:1, textAlign:'center', padding:'10px 8px', borderRight:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{label}</div>
                    <div style={{ fontWeight:700, fontSize:15, color }}>{val}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:8 }}>
                {detalle.partidas.map((p, i) => {
                  const entregada = p.estatus_entrega === 'ENTREGADO'
                  return (
                    <div key={p.id} style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'white' }}>
                        <div style={{ width:26, height:26, borderRadius:6, background:'var(--accent)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
                          {i+1}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:14 }}>
                            {p.cantidad} · {p.largo_cm}×{p.ancho_cm} cm
                          </div>
                          {p.descripcion && <div style={{ fontSize:12, color:'var(--text-muted)' }}>{p.descripcion}</div>}
                        </div>
                        <span style={{
                          padding:'3px 9px', borderRadius:5, fontSize:11, fontWeight:700, flexShrink:0,
                          background: entregada ? '#dcfce7' : '#fef3c7',
                          color: entregada ? '#16a34a' : '#d97706',
                        }}>
                          {entregada ? 'Entregado' : 'Pendiente'}
                        </span>
                        <div style={{ fontWeight:700, fontSize:14, color:'var(--accent)', flexShrink:0 }}>
                          ${fmt5(p.subtotal_partida)}
                        </div>
                        {!entregada && (
                          <button className="btn btn-primary btn-sm"
                            onClick={() => handleEntregar(p.id)}
                            disabled={entregando === p.id}
                            style={{ flexShrink:0 }}>
                            {entregando === p.id ? '...' : '✓ Entregar'}
                          </button>
                        )}
                      </div>
                      {p.procesos?.length > 0 && (
                        <div style={{ background:'var(--bg)', borderTop:'1px solid var(--border)', padding:'6px 14px 6px 54px' }}>
                          {p.procesos.map((pr, j) => (
                            <div key={j} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-muted)', paddingBottom: j < p.procesos.length-1 ? 3 : 0 }}>
                              <span>+ {pr.nombre}</span>
                              <span>${fmt5(pr.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          {detalle && (
            <button className="btn btn-outline" onClick={() => printTicketVidrio({
              tipo:         'pedido',
              folio:        detalle.folio,
              fecha:        detalle.fecha,
              hora:         detalle.hora,
              clienteNombre: detalle.cliente?.nombre ?? 'Mostrador',
              nivelNombre:  '',
              formaPago:    detalle.tipo_pago,
              anticipo:     detalle.anticipo,
              saldo:        detalle.saldo,
              esEntregado:  false,
              partidas:     detalle.partidas.map(p => ({
                tipo:             'MAQUILA',
                piezas:           p.cantidad ?? 1,
                cantidad:         p.cantidad ?? 1,
                largo_cm:         p.largo_cm,
                ancho_cm:         p.ancho_cm,
                clave:            p.descripcion || null,
                descripcion:      p.descripcion,
                subtotal_partida: p.subtotal_partida,
                subtotal_vidrio:  null,
                procesos:         (p.procesos ?? []).map(pr => ({ nombre: pr.nombre, subtotal: pr.subtotal })),
              })),
            })}>🖨️ Imprimir</button>
          )}
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

// ── Página Pedidos Pendientes ─────────────────────────────────────────────
export default function PedidosPendientes() {
  const [pedidos,      setPedidos]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [toast,        setToast]        = useState(null)
  const [tab,           setTab]           = useState('pendientes')
  const [pedidosCredito, setPedidosCredito] = useState([])

  useEffect(() => {
    if (tab === 'credito') getPedidosCredito().then(setPedidosCredito)
  }, [tab])

  const pedidosFiltrados = tab === 'credito' ? pedidosCredito : pedidos.filter(p => p.tipo_pago !== 'CREDITO')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [vidrio, maquila] = await Promise.all([
        getPedidosPendientes(),
        getPedidosPendientesMaquila(),
      ])
      const todos = [
        ...vidrio.map(p   => ({ ...p, tipo: 'VIDRIO'   })),
        ...maquila.map(p  => ({ ...p, tipo: 'MAQUILA'  })),
      ].sort((a, b) => {
        const fa = a.fechaCreacionISO ?? a.fechaPedidoISO ?? ''
        const fb = b.fechaCreacionISO ?? b.fechaPedidoISO ?? ''
        return fb.localeCompare(fa)
      })
      setPedidos(todos)
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={`btn ${tab === 'pendientes' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('pendientes')}>
          📦 Pendientes
        </button>
        <button className={`btn ${tab === 'credito' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('credito')}>
          💳 Crédito
        </button>
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
              ${fmt5(totalSaldo)}
            </div>
          </div>
        </div>

        {pedidosFiltrados.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3>Sin pedidos pendientes</h3>
            <p>Todos los pedidos han sido entregados</p>
          </div>
        ) : (
          <>
            {/* ── Tabla (desktop ≥1024px) ── */}
            <div className="hist-desktop">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Tipo</th>
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
                    {pedidosFiltrados.map(p => (
                      <tr key={p.id ?? p.id_pedido} style={{ cursor:'pointer' }} onClick={() => setSeleccionado({ ...p, id: p.id ?? p.id_pedido })}>
                        <td><span className="badge badge-orange">{p.folio}</span></td>
                        <td>
                          <span className={`badge ${p.tipo === 'MAQUILA' ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize:11 }}>
                            {p.tipo === 'MAQUILA' ? '🔨 Maquila' : '◻ Vidrio'}
                          </span>
                        </td>
                        <td style={{ fontSize:13, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{p.fecha}</td>
                        <td style={{ fontWeight:600 }}>{p.clienteNombre}</td>
                        <td>
                          {p.nivelNombre
                            ? <span className="badge badge-gray">{p.nivelNombre}</span>
                            : <span style={{ color:'var(--text-muted)', fontSize:13 }}>—</span>
                          }
                        </td>
                        <td style={{ textAlign:'right', fontWeight:600 }}>${fmt5(p.total)}</td>
                        <td style={{ textAlign:'right', color:'var(--accent)', fontWeight:600 }}>${(p.anticipo ?? 0).toFixed(2)}</td>
                        <td style={{ textAlign:'right', color:'var(--danger)', fontWeight:700 }}>${(p.saldo ?? 0).toFixed(2)}</td>
                        <td>
                          <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Tarjetas (tablet / móvil <1024px) ── */}
            <div className="hist-mobile">
              {pedidosFiltrados.map(p => (
                <div key={p.id ?? p.id_pedido} className="hist-card" onClick={() => setSeleccionado({ ...p, id: p.id ?? p.id_pedido })}>
                  <div className="hist-card-header">
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span className="badge badge-orange">{p.folio}</span>
                      <span className={`badge ${p.tipo === 'MAQUILA' ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize:11 }}>
                        {p.tipo === 'MAQUILA' ? '🔨 Maquila' : '◻ Vidrio'}
                      </span>
                      {p.nivelNombre && <span className="badge badge-gray" style={{ fontSize:11 }}>{p.nivelNombre}</span>}
                    </div>
                    <span style={{ fontWeight:700, fontSize:17, color:'var(--danger)' }}>
                      ⚠️ ${(p.saldo ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="hist-card-body">
                    <div style={{ fontWeight:600, fontSize:15 }}>{p.clienteNombre}</div>
                    <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>
                      Total: <strong style={{ color:'var(--text)' }}>${fmt5(p.total)}</strong>
                      {p.anticipo > 0 && <span> · Anticipo: <strong style={{ color:'var(--accent)' }}>${(p.anticipo ?? 0).toFixed(2)}</strong></span>}
                    </div>
                  </div>
                  <div className="hist-card-footer">
                    <span style={{ fontSize:12, color:'var(--text-muted)' }}>{p.fecha}</span>
                    <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {seleccionado && seleccionado.tipo === 'MAQUILA' && (
        <DetalleMaquilaModal
          resumen={seleccionado}
          onClose={() => setSeleccionado(null)}
          onActualizado={() => cargar()}
        />
      )}
      {seleccionado && seleccionado.tipo !== 'MAQUILA' && (
        <DetallePedidoModal
          resumen={seleccionado}
          onClose={() => setSeleccionado(null)}
          onEntregado={(folio) => { setSeleccionado(null); setToast(folio); cargar() }}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#16a34a', color: 'white', padding: '14px 28px', borderRadius: 12,
          fontWeight: 600, fontSize: 15, zIndex: 9999,
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap',
        }}>
          ✅ Pedido {toast} entregado con éxito
        </div>
      )}
    </>
  )
}
