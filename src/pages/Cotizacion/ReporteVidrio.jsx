import { useState, useEffect, useCallback } from 'react'
import { fmt5, hoyMX, lunesMX } from '../../lib/utils'
import { getPartidasVidrioEntregadas } from '../../lib/reportesApi'

export default function ReporteVidrio() {
  const [partidas,   setPartidas]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [fechaDesde, setFechaDesde] = useState(lunesMX)
  const [fechaHasta, setFechaHasta] = useState(hoyMX)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPartidasVidrioEntregadas(fechaDesde, fechaHasta)
      setPartidas(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta])

  useEffect(() => { cargar() }, [cargar])

  const totalPiezas = partidas.reduce((s, p) => s + p.cantidad, 0)
  const totalM2     = partidas.reduce((s, p) => s + p.metros2 * p.cantidad, 0)
  const totalMonto  = partidas.reduce((s, p) => s + p.total_partida, 0)

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Reporte Vidrio</div>
          <div className="page-subtitle">Piezas entregadas en el periodo</div>
        </div>
        <button className="btn btn-outline" onClick={cargar} disabled={loading}>↻ Actualizar</button>
      </div>

      <div className="page-body">
        {/* Filtros */}
        <div className="filter-bar" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Desde:</span>
          <input
            type="date" className="filter-select"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
          />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Hasta:</span>
          <input
            type="date" className="filter-select"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
          />
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { setFechaDesde(lunesMX()); setFechaHasta(hoyMX()) }}
          >
            Esta semana
          </button>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Piezas entregadas</div>
            <div className="stat-value">{totalPiezas}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total m²</div>
            <div className="stat-value">{totalM2.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monto total</div>
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>
              ${fmt5(totalMonto)}
            </div>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            Cargando reporte...
          </div>
        ) : error ? (
          <div className="alert alert-error">❌ {error}</div>
        ) : partidas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🪟</div>
            <h3>Sin piezas de vidrio en el periodo</h3>
            <p>Ajusta el rango de fechas para ver resultados</p>
          </div>
        ) : (
          <>
            {/* ── Tabla desktop ── */}
            <div className="hist-desktop">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Entregado</th>
                      <th>Cliente</th>
                      <th>Tipo Vidrio</th>
                      <th style={{ textAlign: 'center' }}>Medidas (cm)</th>
                      <th style={{ textAlign: 'center' }}>Pzas</th>
                      <th style={{ textAlign: 'right' }}>m²</th>
                      <th style={{ textAlign: 'right' }}>$/m²</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partidas.map(p => (
                      <tr key={p.id}>
                        <td><span className="badge badge-blue">{p.folio}</span></td>
                        <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>{p.fechaEntrega}</td>
                        <td style={{ fontWeight: 500 }}>{p.clienteNombre}</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{p.clave_vidrio}</span>
                          {p.nombre_vidrio && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.nombre_vidrio}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 13 }}>
                          {p.largo_cm}×{p.ancho_cm}
                        </td>
                        <td style={{ textAlign: 'center' }}>{p.cantidad}</td>
                        <td style={{ textAlign: 'right', fontSize: 13 }}>
                          {(p.metros2 * p.cantidad).toFixed(4)}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 13 }}>${p.precio_m2.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                          ${fmt5(p.total_partida)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
                  Total del periodo: ${fmt5(totalMonto)} · {totalPiezas} pzas · {totalM2.toFixed(2)} m²
                </div>
              </div>
            </div>

            {/* ── Tarjetas móvil ── */}
            <div className="hist-mobile">
              {partidas.map(p => (
                <div key={p.id} className="hist-card">
                  <div className="hist-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-blue">{p.folio}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.fechaEntrega}</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>
                      ${fmt5(p.total_partida)}
                    </span>
                  </div>
                  <div className="hist-card-body">
                    <div style={{ fontWeight: 600 }}>{p.clienteNombre}</div>
                    <div style={{ fontSize: 13, marginTop: 3 }}>
                      <strong>{p.clave_vidrio}</strong> · {p.largo_cm}×{p.ancho_cm} cm · {p.cantidad} pza{p.cantidad !== 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {(p.metros2 * p.cantidad).toFixed(4)} m² · ${p.precio_m2.toFixed(2)}/m²
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
                Total del periodo: ${fmt5(totalMonto)}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
