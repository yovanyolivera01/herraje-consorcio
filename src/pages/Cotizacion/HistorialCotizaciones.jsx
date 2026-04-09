import { useState, useEffect } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

// ── Ticket de cotizacion para modal de detalle ────────────────────────────
function TicketDetalle({ detalle }) {
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
        <div className="ticket-row" style={{ flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11 }}>Observaciones:</span>
          <span style={{ fontSize: 12 }}>{detalle.observaciones}</span>
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
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        Esta cotizacion tiene una vigencia de 15 dias.
      </div>
    </div>
  )
}

// ── Modal de detalle ──────────────────────────────────────────────────────
function DetalleModal({ resumen, onClose }) {
  const { getDetalleCotizacion } = useCotizacion()
  const [detalle, setDetalle]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    getDetalleCotizacion(resumen.id).then(({ data, error: err }) => {
      if (err) setError(err)
      else setDetalle(data)
      setLoading(false)
    })
  }, [resumen.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Detalle — {resumen.folio}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {resumen.fecha} · {resumen.hora}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Cargando detalle...
            </div>
          )}
          {error && <div className="alert alert-error">❌ {error}</div>}
          {detalle && <TicketDetalle detalle={detalle} />}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          {detalle && (
            <button className="btn btn-primary" onClick={() => window.print()}>
              🖨️ Imprimir
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pagina Historial ──────────────────────────────────────────────────────
export default function HistorialCotizaciones() {
  const { getCotizaciones } = useCotizacion()
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  const [fechaDesde,   setFechaDesde]   = useState('')
  const [fechaHasta,   setFechaHasta]   = useState('')
  const [filtroEstatus, setFiltroEstatus] = useState('todos')
  const [seleccionada, setSeleccionada]  = useState(null)

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
      if (fechaDesde && f < new Date(fechaDesde)) return false
      if (fechaHasta && f > new Date(fechaHasta + 'T23:59:59')) return false
    }
    return true
  })

  const totalPeriodo = filtered.reduce((s, c) => s + c.total, 0)

  const estatusBadge = (est) => {
    if (est === 'FINALIZADA')  return <span className="badge badge-green">Finalizada</span>
    if (est === 'CANCELADA')   return <span className="badge badge-red">Cancelada</span>
    return <span className="badge badge-orange">Borrador</span>
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
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
          <div className="page-subtitle">{cotizaciones.length} cotizacion{cotizaciones.length !== 1 ? 'es' : ''} registrada{cotizaciones.length !== 1 ? 's' : ''}</div>
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
            <div className="stat-value" style={{ fontSize: 18 }}>${totalPeriodo.toFixed(2)}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="filter-bar" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Fecha:</span>
          <input
            type="date"
            className="filter-select"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
          />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>al</span>
          <input
            type="date"
            className="filter-select"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
          />
          <select
            className="filter-select"
            value={filtroEstatus}
            onChange={e => setFiltroEstatus(e.target.value)}
          >
            <option value="todos">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="FINALIZADA">Finalizada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
          {(fechaDesde || fechaHasta || filtroEstatus !== 'todos') && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { setFechaDesde(''); setFechaHasta(''); setFiltroEstatus('todos') }}
            >
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
                : 'Las cotizaciones apareceren aqui una vez que guardes la primera'}
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
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Estado</th>
                  <th style={{ width: 90 }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSeleccionada(c)}
                  >
                    <td data-label="Folio">
                      <span className="badge badge-blue">{c.folio}</span>
                    </td>
                    <td data-label="Fecha">{c.fecha} <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.hora}</span></td>
                    <td data-label="Cliente" style={{ fontWeight: 500 }}>{c.clienteNombre}</td>
                    <td data-label="Nivel">
                      <span className="badge badge-gray">{c.nivelNombre}</span>
                    </td>
                    <td data-label="Total" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                      ${Number(c.total).toFixed(2)}
                    </td>
                    <td data-label="Estado">{estatusBadge(c.estatus)}</td>
                    <td data-label="">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={e => { e.stopPropagation(); setSeleccionada(c) }}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {seleccionada && (
        <DetalleModal
          resumen={seleccionada}
          onClose={() => setSeleccionada(null)}
        />
      )}
    </>
  )
}
