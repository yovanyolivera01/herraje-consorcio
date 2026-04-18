import { useState, useEffect } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'
import { convertirCotizacionAPedido, getDetallePedido } from '../../lib/pedidosApi'

// ── Ticket de pedido (para imprimir) ─────────────────────────────────────
function TicketPedido({ detalle }) {
  const esEntregado = detalle.estado === 'ENTREGADO'
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>HERRAJES CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>PEDIDO DE VIDRIO</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Pedido:</span><strong>{detalle.folio}</strong></div>
      <div className="ticket-row"><span>Cotizacion:</span><span>COT-{String(detalle.id_cotizacion).padStart(5,'0')}</span></div>
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
            <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 14 }}>{p.descripcion_vidrio}</div>
          )}
          <div className="ticket-row" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <span>${p.precio_m2_aplicado.toFixed(2)}/m²</span>
            <span>${p.subtotal_vidrio.toFixed(2)}</span>
          </div>
          {p.procesos.map((pr, j) => (
            <div key={j} className="ticket-row" style={{ fontSize: 11, paddingLeft: 10 }}>
              <span>+ {pr.nombre}</span>
              <span>${pr.subtotal.toFixed(2)}</span>
            </div>
          ))}
          <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
            <span>Subtotal</span>
            <span>${p.subtotal_partida.toFixed(2)}</span>
          </div>
        </div>
      ))}

      <hr className="ticket-divider" />
      <div className="ticket-total"><span>TOTAL</span><span>${detalle.total.toFixed(2)}</span></div>
      <div className="ticket-row" style={{ marginTop: 6 }}>
        <span>Forma de pago:</span>
        <span>{detalle.forma_pago === 'LIQUIDADO' ? 'Liquidado' : 'Anticipo'}</span>
      </div>
      {detalle.forma_pago === 'ANTICIPO' && (
        <>
          <div className="ticket-row">
            <span>Anticipo pagado:</span>
            <span style={{ fontWeight: 600 }}>${detalle.anticipo.toFixed(2)}</span>
          </div>
          {!esEntregado && (
            <div className="ticket-row">
              <span>Saldo pendiente:</span>
              <span style={{ fontWeight: 700, color: 'var(--danger)' }}>${detalle.saldo.toFixed(2)}</span>
            </div>
          )}
          {esEntregado && detalle.saldo_cobrado != null && (
            <div className="ticket-row">
              <span>Saldo cobrado:</span>
              <span style={{ fontWeight: 600 }}>${detalle.saldo_cobrado.toFixed(2)}</span>
            </div>
          )}
        </>
      )}
      <hr className="ticket-divider" />
      <div style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', marginTop:8 }}>
        {esEntregado ? '¡Gracias por su compra!' : 'Pedido pendiente de entrega.'}
      </div>
    </div>
  )
}

// ── Modal: confirmar conversión a pedido ──────────────────────────────────
function ConvertirPedidoModal({ cotizacion, onClose, onCreado }) {
  const [formaPago,  setFormaPago]  = useState('LIQUIDADO')
  const [anticipo,   setAnticipo]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)

  const anticopoNum = parseFloat(anticipo) || 0
  const saldo = formaPago === 'ANTICIPO' ? cotizacion.total - anticopoNum : 0

  const handleConfirm = async () => {
    if (formaPago === 'ANTICIPO') {
      const n = parseFloat(anticipo)
      if (isNaN(n) || n <= 0)           { setError('Ingresa un monto de anticipo valido'); return }
      if (n >= cotizacion.total)        { setError('El anticipo debe ser menor al total'); return }
    }
    setSaving(true)
    setError(null)
    try {
      const montoAnticipo = formaPago === 'LIQUIDADO' ? cotizacion.total : parseFloat(anticipo)
      const idPedido = await convertirCotizacionAPedido(cotizacion.id, formaPago, montoAnticipo)
      const detalle  = await getDetallePedido(idPedido)
      onCreado(detalle)
    } catch (err) {
      setError(err.message || 'Error al crear el pedido')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Convertir a pedido</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {cotizacion.folio} · ${cotizacion.total.toFixed(2)}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label required">Forma de pago</label>
            <div style={{ display:'flex', gap:16, marginTop:6 }}>
              {[['LIQUIDADO','Liquidado — pago total'],['ANTICIPO','Anticipo — pago parcial']].map(([val, label]) => (
                <label key={val} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14 }}>
                  <input
                    type="radio" name="formaPago" value={val}
                    checked={formaPago === val}
                    onChange={() => { setFormaPago(val); setError(null) }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {formaPago === 'ANTICIPO' && (
            <div className="form-group">
              <label className="form-label required">Monto del anticipo ($)</label>
              <input
                className="form-input"
                type="number" min="0" step="0.01"
                value={anticipo}
                onChange={e => { setAnticipo(e.target.value); setError(null) }}
                placeholder="0.00"
                autoFocus
              />
              {anticopoNum > 0 && anticopoNum < cotizacion.total && (
                <div className="form-hint">
                  Saldo pendiente: <strong>${saldo.toFixed(2)}</strong>
                </div>
              )}
            </div>
          )}

          {formaPago === 'LIQUIDADO' && (
            <div className="alert alert-success" style={{ marginTop: 8 }}>
              El pedido quedara como <strong>Listo / Entregado al momento</strong> y pasara directamente al historial de ventas.
            </div>
          )}
          {formaPago === 'ANTICIPO' && (
            <div className="alert alert-warning" style={{ marginTop: 8 }}>
              El pedido quedara como <strong>Pendiente</strong> hasta que sea marcado como entregado.
            </div>
          )}

          {error && <div className="alert alert-error" style={{ marginTop: 8 }}>❌ {error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Creando pedido...' : 'Confirmar pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: pedido creado (ticket) ─────────────────────────────────────────
function PedidoCreadoModal({ detalle, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Pedido creado — {detalle.folio}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {detalle.estado === 'ENTREGADO' ? 'Liquidado · Entregado al momento' : 'Pendiente de entrega'}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-success">
            ✅ Pedido <strong>{detalle.folio}</strong> creado correctamente.
          </div>
          <TicketPedido detalle={detalle} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir</button>
        </div>
      </div>
    </div>
  )
}

// ── Ticket de cotización (modal detalle) ──────────────────────────────────
function TicketDetalleCot({ detalle }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>HERRAJES CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>COTIZACION DE VIDRIO</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Folio:</span><strong>{detalle.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{detalle.fecha}</span></div>
      <div className="ticket-row"><span>Hora:</span><span>{detalle.hora}</span></div>
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
            {i + 1}. {p.tipoVidrio?.clave ?? '?'} — {p.largo_cm}×{p.ancho_cm} cm · {p.metros2.toFixed(4)} m²
          </div>
          <div className="ticket-row" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <span>${p.precio_m2_aplicado.toFixed(2)}/m²</span>
            <span>${p.subtotal_vidrio.toFixed(2)}</span>
          </div>
          {p.procesos.map((pr, j) => (
            <div key={j} className="ticket-row" style={{ fontSize: 11, paddingLeft: 10 }}>
              <span>+ {pr.nombre}</span>
              <span>${pr.subtotal.toFixed(2)}</span>
            </div>
          ))}
          <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
            <span>Subtotal</span>
            <span>${p.subtotal_partida.toFixed(2)}</span>
          </div>
        </div>
      ))}
      <hr className="ticket-divider" />
      <div className="ticket-total">
        <span>TOTAL</span>
        <span>${Number(detalle.total).toFixed(2)}</span>
      </div>
      <hr className="ticket-divider" />
      <div style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', marginTop:8 }}>
        Esta cotizacion tiene una vigencia de 15 dias.
      </div>
    </div>
  )
}

// ── Modal detalle de cotización ───────────────────────────────────────────
function DetalleModal({ resumen, onClose, onConvertir }) {
  const { getDetalleCotizacion } = useCotizacion()
  const [detalle, setDetalle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    getDetalleCotizacion(resumen.id).then(({ data, error: err }) => {
      if (err) setError(err)
      else setDetalle(data)
      setLoading(false)
    })
  }, [resumen.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Detalle — {resumen.folio}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {resumen.fecha} · {resumen.hora}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
              Cargando detalle...
            </div>
          )}
          {error && <div className="alert alert-error">❌ {error}</div>}
          {detalle && <TicketDetalleCot detalle={detalle} />}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          {detalle && (
            <button className="btn btn-outline" onClick={() => window.print()}>
              🖨️ Imprimir
            </button>
          )}
          {resumen.estatus === 'FINALIZADA' && (
            <button
              className="btn btn-primary"
              onClick={() => onConvertir(resumen)}
              disabled={loading || !!error}
            >
              ✅ Aceptar y convertir en pedido
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pagina Historial de Cotizaciones ──────────────────────────────────────
export default function HistorialCotizaciones() {
  const { getCotizaciones } = useCotizacion()
  const [cotizaciones,   setCotizaciones]   = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [fechaDesde,     setFechaDesde]     = useState('')
  const [fechaHasta,     setFechaHasta]     = useState('')
  const [filtroEstatus,  setFiltroEstatus]  = useState('todos')
  const [seleccionada,   setSeleccionada]   = useState(null)
  const [convertirCot,   setConvertirCot]   = useState(null)
  const [pedidoCreado,   setPedidoCreado]   = useState(null)

  const cargar = async () => {
    setLoading(true)
    const { data, error: err } = await getCotizaciones()
    if (err) setError(err)
    else setCotizaciones(data ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = cotizaciones.filter(c => {
    if (filtroEstatus !== 'todos' && c.estatus !== filtroEstatus) return false
    if (fechaDesde || fechaHasta) {
      const f = new Date(c.fechaISO)
      if (fechaDesde && f < new Date(fechaDesde))              return false
      if (fechaHasta && f > new Date(fechaHasta + 'T23:59:59')) return false
    }
    return true
  })

  const totalPeriodo = filtered.reduce((s, c) => s + c.total, 0)

  const estatusBadge = (est) => {
    if (est === 'FINALIZADA')  return <span className="badge badge-green">Finalizada</span>
    if (est === 'CANCELADA')   return <span className="badge badge-red">Cancelada</span>
    if (est === 'CONVERTIDA')  return <span className="badge badge-blue">Convertida</span>
    return <span className="badge badge-orange">Borrador</span>
  }

  if (loading) return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)' }}>
      Cargando historial...
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
          <div className="page-title">Historial de Cotizaciones</div>
          <div className="page-subtitle">
            {cotizaciones.length} cotizacion{cotizaciones.length !== 1 ? 'es' : ''} registrada{cotizaciones.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn btn-outline" onClick={cargar}>↻ Actualizar</button>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total cotizaciones</div>
            <div className="stat-value">{cotizaciones.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">En periodo</div>
            <div className="stat-value">{filtered.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monto en periodo</div>
            <div className="stat-value" style={{ fontSize:18 }}>${totalPeriodo.toFixed(2)}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="filter-bar" style={{ marginBottom:20 }}>
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>Fecha:</span>
          <input type="date" className="filter-select" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>al</span>
          <input type="date" className="filter-select" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          <select className="filter-select" value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="FINALIZADA">Finalizada</option>
            <option value="CANCELADA">Cancelada</option>
            <option value="CONVERTIDA">Convertida</option>
          </select>
          {(fechaDesde || fechaHasta || filtroEstatus !== 'todos') && (
            <button className="btn btn-outline btn-sm" onClick={() => { setFechaDesde(''); setFechaHasta(''); setFiltroEstatus('todos') }}>
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Tabla */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3>Sin cotizaciones</h3>
            <p>
              {fechaDesde || fechaHasta || filtroEstatus !== 'todos'
                ? 'Ajusta los filtros para ver resultados'
                : 'Las cotizaciones apareceran aqui una vez que guardes la primera'}
            </p>
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
                  <th>Estado</th>
                  <th style={{ width:180 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ cursor:'pointer', opacity: c.estatus === 'CANCELADA' ? 0.55 : 1 }} onClick={() => setSeleccionada(c)}>
                    <td data-label="Folio"><span className="badge badge-blue">{c.folio}</span></td>
                    <td data-label="Fecha">{c.fecha} <span style={{ color:'var(--text-muted)', fontSize:13 }}>{c.hora}</span></td>
                    <td data-label="Cliente" style={{ fontWeight:500 }}>{c.clienteNombre}</td>
                    <td data-label="Nivel"><span className="badge badge-gray">{c.nivelNombre}</span></td>
                    <td data-label="Total" style={{ textAlign:'right', fontWeight:700, color:'var(--accent)' }}>
                      ${Number(c.total).toFixed(2)}
                    </td>
                    <td data-label="Estado">{estatusBadge(c.estatus)}</td>
                    <td data-label="" onClick={e => e.stopPropagation()} style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setSeleccionada(c)}>
                        Ver
                      </button>
                      {c.estatus === 'FINALIZADA' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setConvertirCot(c)}
                        >
                          → Pedido
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {seleccionada && !convertirCot && !pedidoCreado && (
        <DetalleModal
          resumen={seleccionada}
          onClose={() => setSeleccionada(null)}
          onConvertir={(cot) => { setConvertirCot(cot); setSeleccionada(null) }}
        />
      )}

      {/* Modal conversión */}
      {convertirCot && !pedidoCreado && (
        <ConvertirPedidoModal
          cotizacion={convertirCot}
          onClose={() => setConvertirCot(null)}
          onCreado={(detallePedido) => {
            setConvertirCot(null)
            setPedidoCreado(detallePedido)
            cargar() // refresca la lista para mostrar CONVERTIDA
          }}
        />
      )}

      {/* Modal pedido creado */}
      {pedidoCreado && (
        <PedidoCreadoModal
          detalle={pedidoCreado}
          onClose={() => setPedidoCreado(null)}
        />
      )}
    </>
  )
}
