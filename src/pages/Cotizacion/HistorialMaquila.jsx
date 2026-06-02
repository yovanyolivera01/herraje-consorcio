import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { fmt5, hoyMX, lunesMX } from '../../lib/utils'
import { getPedidosEntregadosMaquila, getDetallePedidoMaquila } from '../../lib/maquilaApi'
import { getExtrasMaquilaEntregadas } from '../../lib/reportesApi'

// ── Modal detalle de pedido de maquila ────────────────────────────────────────
function DetallePedidoModal({ resumen, onClose }) {
  const [detalle, setDetalle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    getDetallePedidoMaquila(resumen.id)
      .then(d => { setDetalle(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [resumen.id])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Pedido — {resumen.folio}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Entregado: {resumen.fechaEntrega} · {resumen.clienteNombre}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Cargando...</div>}
          {error   && <div className="alert alert-error">❌ {error}</div>}
          {detalle && (
            <>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 20 }}>${fmt5(detalle.total)}</span>
              </div>

              {detalle.tipo_pago === 'ANTICIPO' && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '8px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Anticipo</div>
                    <div style={{ fontWeight: 600 }}>${detalle.anticipo.toFixed(2)}</div>
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '8px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saldo cobrado</div>
                    <div style={{ fontWeight: 600 }}>${fmt5(Math.max(detalle.total - detalle.anticipo, 0))}</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detalle.partidas.map((p, i) => (
                  <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'white' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {p.cantidad} pza{p.cantidad !== 1 ? 's' : ''} · {p.largo_cm}×{p.ancho_cm} cm
                        </div>
                        {p.descripcion && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.descripcion}</div>}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)', flexShrink: 0 }}>
                        ${fmt5(p.subtotal_partida)}
                      </div>
                    </div>
                    {p.procesos?.length > 0 && (
                      <div style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '6px 14px 6px 54px' }}>
                        {p.procesos.map((pr, j) => (
                          <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', paddingBottom: j < p.procesos.length - 1 ? 3 : 0 }}>
                            <span>+ {pr.nombre}{pr.cantidad_unidades !== 1 ? ` × ${pr.cantidad_unidades}` : ''}</span>
                            <span>${fmt5(pr.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          {detalle && (
            <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function HistorialMaquila() {
  const [pedidos,       setPedidos]       = useState([])
  const [extras,        setExtras]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [fechaDesde,    setFechaDesde]    = useState(lunesMX)
  const [fechaHasta,    setFechaHasta]    = useState(hoyMX)
  const [seleccionado,  setSeleccionado]  = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dataPedidos, dataExtras] = await Promise.all([
        getPedidosEntregadosMaquila(fechaDesde, fechaHasta),
        getExtrasMaquilaEntregadas(fechaDesde, fechaHasta),
      ])
      setPedidos(dataPedidos)
      setExtras(dataExtras)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta])

  useEffect(() => { cargar() }, [cargar])

  const totalAcumulado   = pedidos.reduce((s, p) => s + p.total, 0)
  const totalExtras      = extras.reduce((s, e) => s + e.subtotal, 0)

  const exportarExcel = () => {
    const filaPedidos = pedidos.map(p => ({
      Folio:     p.folio,
      Entregado: p.fechaEntrega,
      Cliente:   p.clienteNombre,
      Pago:      p.tipo_pago,
      Total:     Number(p.total),
    }))
    const filaExtras = extras.map(e => ({
      Folio:       e.folio,
      Entregado:   e.fechaEntrega,
      Cliente:     e.clienteNombre,
      Descripcion: e.descripcion,
      Cantidad:    e.cantidad,
      Unidad:      e.unidad,
      Precio:      Number(e.precio_unitario),
      Subtotal:    Number(e.subtotal),
    }))

    const wb = XLSX.utils.book_new()

    const wsPedidos = XLSX.utils.json_to_sheet([
      ...filaPedidos,
      { Folio: 'TOTAL', Entregado: '', Cliente: '', Pago: '', Total: totalAcumulado },
    ])
    wsPedidos['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos maquila')

    if (filaExtras.length > 0) {
      const wsExtras = XLSX.utils.json_to_sheet([
        ...filaExtras,
        { Folio: 'TOTAL', Entregado: '', Cliente: '', Descripcion: '', Cantidad: '', Unidad: '', Precio: '', Subtotal: totalExtras },
      ])
      wsExtras['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 28 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, wsExtras, 'Maquila mixta')
    }

    XLSX.writeFile(wb, `maquila-${hoyMX()}.xlsx`)
  }

  const formaPagoBadge = (fp) =>
    fp === 'CONTADO' || fp === 'LIQUIDADO'
      ? <span className="badge badge-green">Liquidado</span>
      : <span className="badge badge-orange">Anticipo</span>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Historial Maquila</div>
          <div className="page-subtitle">Pedidos entregados</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={cargar} disabled={loading}>↻ Actualizar</button>
          <button className="btn btn-outline" onClick={exportarExcel} disabled={loading || (pedidos.length === 0 && extras.length === 0)}>
            📥 Excel
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
        <div className="stats-row" style={{ flexWrap: 'nowrap' }}>
          <div className="stat-card">
            <div className="stat-label">Pedidos maquila</div>
            <div className="stat-value">{pedidos.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total pedidos</div>
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>
              ${fmt5(totalAcumulado)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Maquila mixta</div>
            <div className="stat-value">{extras.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total mixta</div>
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>
              ${fmt5(totalExtras)}
            </div>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            Cargando historial...
          </div>
        ) : error ? (
          <div className="alert alert-error">❌ {error}</div>
        ) : pedidos.length === 0 && extras.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔨</div>
            <h3>Sin pedidos de maquila en el periodo</h3>
            <p>Ajusta el rango de fechas para ver resultados</p>
          </div>
        ) : (
          <>
            {/* ── Tabla (desktop) ── */}
            <div className="hist-desktop">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Entregado</th>
                      <th>Cliente</th>
                      <th>Pago</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ width: 100 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map(p => (
                      <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSeleccionado(p)}>
                        <td><span className="badge badge-orange">{p.folio}</span></td>
                        <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>{p.fechaEntrega}</td>
                        <td style={{ fontWeight: 500 }}>{p.clienteNombre}</td>
                        <td>{formaPagoBadge(p.tipo_pago)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>${fmt5(p.total)}</td>
                        <td>
                          <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
                  Total del periodo: ${fmt5(totalAcumulado)}
                </div>
              </div>
            </div>

            {/* ── Tarjetas (tablet / móvil) ── */}
            <div className="hist-mobile">
              {pedidos.map(p => (
                <div key={p.id} className="hist-card" onClick={() => setSeleccionado(p)}>
                  <div className="hist-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-orange">{p.folio}</span>
                      {formaPagoBadge(p.tipo_pago)}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>${fmt5(p.total)}</span>
                  </div>
                  <div className="hist-card-body">
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{p.clienteNombre}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Entregado: {p.fechaEntrega}</div>
                  </div>
                  <div className="hist-card-footer">
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.fecha}</span>
                    <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver detalle</button>
                  </div>
                </div>
              ))}
              <div style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
                Total del periodo: ${fmt5(totalAcumulado)}
              </div>
            </div>

            {/* ── Maquila de cotizaciones mixtas ── */}
            {extras.length > 0 && (
              <>
                <div style={{ margin: '28px 0 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    🔧 Maquila en cotizaciones mixtas
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                {/* Tabla desktop extras */}
                <div className="hist-desktop">
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Folio pedido</th>
                          <th>Entregado</th>
                          <th>Cliente</th>
                          <th>Descripción</th>
                          <th style={{ textAlign: 'right' }}>Cant.</th>
                          <th style={{ textAlign: 'right' }}>Precio</th>
                          <th style={{ textAlign: 'right' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extras.map(e => (
                          <tr key={e.id}>
                            <td><span className="badge badge-orange">{e.folio}</span></td>
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
                      Total maquila mixta: ${fmt5(totalExtras)}
                    </div>
                  </div>
                </div>

                {/* Tarjetas móvil extras */}
                <div className="hist-mobile">
                  {extras.map(e => (
                    <div key={e.id} className="hist-card">
                      <div className="hist-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="badge badge-orange">{e.folio}</span>
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
                    Total maquila mixta: ${fmt5(totalExtras)}
                  </div>
                </div>
              </>
            )}

          </>
        )}
      </div>

      {seleccionado && (
        <DetallePedidoModal
          resumen={seleccionado}
          onClose={() => setSeleccionado(null)}
        />
      )}
    </>
  )
}
