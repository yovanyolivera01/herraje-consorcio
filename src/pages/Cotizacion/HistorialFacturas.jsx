import { useState, useEffect, useCallback } from 'react'
import { fmt5, hoyMX, lunesMX } from '../../lib/utils'
import { getFacturas, getCFDIPdfUrl, getCFDIXmlUrl } from '../../lib/facturamaApi'

const TZ = 'America/Mexico_City'
function fmtFecha(isoStr) {
  if (!isoStr) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: TZ,
  }).format(new Date(isoStr))
}

export default function HistorialFacturas() {
  const [facturas,   setFacturas]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [fechaDesde, setFechaDesde] = useState(lunesMX)
  const [fechaHasta, setFechaHasta] = useState(hoyMX)
  const [busqueda,   setBusqueda]   = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getFacturas(fechaDesde, fechaHasta)
      setFacturas(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta])

  useEffect(() => { cargar() }, [cargar])

  const q = busqueda.trim().toLowerCase()
  const filtradas = facturas.filter(f =>
    !q
    || f.uuid_cfdi?.toLowerCase().includes(q)
    || f.folio_pedido?.toLowerCase().includes(q)
    || f.rfc_receptor?.toLowerCase().includes(q)
    || f.nombre_receptor?.toLowerCase().includes(q)
    || f.cliente_nombre?.toLowerCase().includes(q)
  )

  const totalPeriodo = filtradas.reduce((s, f) => s + Number(f.total ?? 0), 0)

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Historial de Facturas</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="filter-select"
            placeholder="Buscar folio, RFC, cliente..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <button className="btn btn-outline" onClick={cargar} disabled={loading}>
            ↻ Actualizar
          </button>
        </div>
      </div>

      <div className="page-body">

        {/* Filtros de fecha */}
        <div className="filter-bar" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Desde:</span>
          <input type="date" className="filter-select" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Hasta:</span>
          <input type="date" className="filter-select" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          <button className="btn btn-outline btn-sm" onClick={() => { setFechaDesde(lunesMX()); setFechaHasta(hoyMX()) }}>
            Esta semana
          </button>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Facturas en periodo</div>
            <div className="stat-value">{filtradas.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total facturado</div>
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>
              ${fmt5(totalPeriodo)}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            Cargando facturas...
          </div>
        ) : error ? (
          <div className="alert alert-error">❌ {error}</div>
        ) : filtradas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧾</div>
            <h3>Sin facturas en el periodo</h3>
            <p>Las facturas generadas desde el detalle de venta aparecerán aquí</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hist-desktop">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Folio fiscal (UUID)</th>
                      <th>Serie / Folio</th>
                      <th>Fecha emisión</th>
                      <th>Receptor</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ width: 120, textAlign: 'center' }}>Archivos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map(f => (
                      <tr key={f.id_factura}>
                        <td>
                          {f.folio_pedido
                            ? <span className="badge badge-blue">{f.folio_pedido}</span>
                            : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                          {f.cliente_nombre && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                              {f.cliente_nombre}
                            </div>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {f.uuid_cfdi
                            ? <span title={f.uuid_cfdi}>{f.uuid_cfdi.slice(0,8)}…{f.uuid_cfdi.slice(-4)}</span>
                            : '—'}
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {f.serie || f.folio_cfdi ? `${f.serie ?? ''}-${f.folio_cfdi ?? ''}` : '—'}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {fmtFecha(f.fecha_emision)}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{f.nombre_receptor}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.rfc_receptor}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                          ${fmt5(Number(f.total ?? 0))}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            {f.uuid_cfdi && (
                              <>
                                <a
                                  href={getCFDIPdfUrl(f.uuid_cfdi)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-outline btn-sm"
                                  style={{ textDecoration: 'none', fontSize: 11 }}
                                  title="Descargar PDF"
                                >
                                  📄 PDF
                                </a>
                                <a
                                  href={getCFDIXmlUrl(f.uuid_cfdi)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-outline btn-sm"
                                  style={{ textDecoration: 'none', fontSize: 11 }}
                                  title="Descargar XML"
                                >
                                  📋 XML
                                </a>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
                  Total del periodo: ${fmt5(totalPeriodo)}
                </div>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="hist-mobile">
              {filtradas.map(f => (
                <div key={f.id_factura} className="hist-card">
                  <div className="hist-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {f.folio_pedido && <span className="badge badge-blue">{f.folio_pedido}</span>}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {f.uuid_cfdi ? `${f.uuid_cfdi.slice(0,8)}…` : '—'}
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>
                      ${fmt5(Number(f.total ?? 0))}
                    </span>
                  </div>
                  <div className="hist-card-body">
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{f.nombre_receptor}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      RFC: {f.rfc_receptor} · {f.cliente_nombre}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {fmtFecha(f.fecha_emision)}
                    </div>
                  </div>
                  {f.uuid_cfdi && (
                    <div className="hist-card-footer">
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a href={getCFDIPdfUrl(f.uuid_cfdi)} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                          📄 PDF
                        </a>
                        <a href={getCFDIXmlUrl(f.uuid_cfdi)} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                          📋 XML
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
