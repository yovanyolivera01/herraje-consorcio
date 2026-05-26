import { useState, useEffect, useCallback } from 'react'
import { fmt5, hoyMX, lunesMX } from '../../lib/utils'
import { getExtrasHerrajeEntregadas, getVentasDirectasHerraje } from '../../lib/reportesApi'

function TablaExtras({ rows, badgeClass, totalLabel }) {
  const total = rows.reduce((s, e) => s + e.subtotal, 0)
  return (
    <>
      <div className="hist-desktop">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'right' }}>Cant.</th>
                <th style={{ textAlign: 'right' }}>Precio</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(e => (
                <tr key={e.id}>
                  <td><span className={`badge ${badgeClass}`}>{e.folio}</span></td>
                  <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>{e.fechaEntrega}</td>
                  <td style={{ fontWeight: 500 }}>{e.clienteNombre}</td>
                  <td>{e.descripcion}</td>
                  <td style={{ textAlign: 'right' }}>{e.cantidad} {e.unidad}</td>
                  <td style={{ textAlign: 'right' }}>${e.precio_unitario.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>${fmt5(e.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
            {totalLabel}: ${fmt5(total)}
          </div>
        </div>
      </div>

      <div className="hist-mobile">
        {rows.map(e => (
          <div key={e.id} className="hist-card">
            <div className="hist-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge ${badgeClass}`}>{e.folio}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.fechaEntrega}</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>${fmt5(e.subtotal)}</span>
            </div>
            <div className="hist-card-body">
              <div style={{ fontWeight: 600 }}>{e.clienteNombre}</div>
              <div style={{ fontSize: 13, marginTop: 3 }}>{e.descripcion}</div>
              {e.cantidad > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {e.cantidad} {e.unidad} × ${e.precio_unitario.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        ))}
        <div style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
          {totalLabel}: ${fmt5(total)}
        </div>
      </div>
    </>
  )
}

function SeccionDivisor({ label }) {
  return (
    <div style={{ margin: '28px 0 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

export default function HistorialHerraje() {
  const [ventasDirectas, setVentasDirectas] = useState([])
  const [extrasMixtas,   setExtrasMixtas]   = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [fechaDesde,     setFechaDesde]     = useState(lunesMX)
  const [fechaHasta,     setFechaHasta]     = useState(hoyMX)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dataVentas, dataExtras] = await Promise.all([
        getVentasDirectasHerraje(fechaDesde, fechaHasta),
        getExtrasHerrajeEntregadas(fechaDesde, fechaHasta),
      ])
      setVentasDirectas(dataVentas)
      setExtrasMixtas(dataExtras)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta])

  useEffect(() => { cargar() }, [cargar])

  const totalVentas = ventasDirectas.reduce((s, e) => s + e.subtotal, 0)
  const totalExtras = extrasMixtas.reduce((s, e) => s + e.subtotal, 0)
  const totalGeneral = totalVentas + totalExtras

  const sinDatos = ventasDirectas.length === 0 && extrasMixtas.length === 0

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Historial Herraje</div>
          <div className="page-subtitle">Ventas directas y herraje en cotizaciones mixtas</div>
        </div>
        <button className="btn btn-outline" onClick={cargar} disabled={loading}>↻ Actualizar</button>
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
            <div className="stat-label">Ventas directas</div>
            <div className="stat-value">{ventasDirectas.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Herraje en cotizaciones</div>
            <div className="stat-value">{extrasMixtas.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total acumulado</div>
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>
              ${fmt5(totalGeneral)}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            Cargando historial...
          </div>
        ) : error ? (
          <div className="alert alert-error">❌ {error}</div>
        ) : sinDatos ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧰</div>
            <h3>Sin ventas de herraje en el periodo</h3>
            <p>Ajusta el rango de fechas para ver resultados</p>
          </div>
        ) : (
          <>
            {ventasDirectas.length > 0 && (
              <>
                <SeccionDivisor label="🧰 Ventas directas" />
                <TablaExtras rows={ventasDirectas} badgeClass="badge-blue" totalLabel="Total ventas directas" />
              </>
            )}

            {extrasMixtas.length > 0 && (
              <>
                <SeccionDivisor label="📦 Herraje en cotizaciones mixtas" />
                <TablaExtras rows={extrasMixtas} badgeClass="badge-orange" totalLabel="Total cotizaciones mixtas" />
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
