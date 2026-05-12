import { useState, useEffect, useCallback } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

const BADGE_ESTATUS = {
  BORRADOR:   { label: 'Borrador',   bg: '#e5e7eb', color: '#374151' },
  FINALIZADA: { label: 'Finalizada', bg: '#dbeafe', color: '#1d4ed8' },
  CONVERTIDA: { label: 'Convertida', bg: '#dcfce7', color: '#16a34a' },
}

// ── Modal: detalle de cotización ──────────────────────────────────────────
function DetalleModal({ cotId, onClose, onReopenOk, onConvertidoOk }) {
  const { getDetalleCotizacionMaquila, reabrirCotizacion, convertirMaquilaAPedido } = useCotizacion()
  const [detalle, setDetalle]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState(null)
  const [paso,    setPaso]      = useState('detalle') // 'detalle' | 'convertir' | 'ok'
  const [tipoPago,  setTipoPago]  = useState('ANTICIPO')
  const [anticipo,  setAnticipo]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [pedido,    setPedido]    = useState(null)

  useEffect(() => {
    getDetalleCotizacionMaquila(cotId).then(res => {
      if (res.error) { setError(res.error); setLoading(false); return }
      setDetalle(res.data); setLoading(false)
    })
  }, [cotId, getDetalleCotizacionMaquila])

  const handleReabrir = async () => {
    setSaving(true); setError(null)
    const res = await reabrirCotizacion(cotId)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onReopenOk()
  }

  const handleConvertir = async () => {
    const montAnt = tipoPago === 'CONTADO' ? detalle.total : Number(anticipo)
    if (tipoPago === 'ANTICIPO' && (isNaN(montAnt) || montAnt < 0)) { setError('Ingresa un anticipo válido'); return }
    setSaving(true); setError(null)
    const res = await convertirMaquilaAPedido({
      id_cotizacion: cotId,
      tipo_pago: tipoPago,
      monto_anticipo: montAnt,
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setPedido(res.data); setPaso('ok')
  }

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal"><div className="modal-body" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Cargando...</div></div>
    </div>
  )

  if (paso === 'ok') {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onConvertidoOk()}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">Pedido creado</div>
            <button className="btn-icon" onClick={onConvertidoOk}>✕</button>
          </div>
          <div className="modal-body">
            <div className="alert alert-success">
              ✅ Pedido <strong>{pedido.folio}</strong> creado exitosamente.
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={onConvertidoOk}>Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{detalle?.folio ?? '—'}</div>
            {detalle && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {detalle.fecha} · {detalle.cliente?.nombre ?? 'Mostrador'}
                {detalle.nivel && <span className="badge badge-gray" style={{ marginLeft: 8, fontSize: 11 }}>{detalle.nivel.nombre}</span>}
              </div>
            )}
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">❌ {error}</div>}

          {detalle && paso === 'detalle' && (
            <>
              {/* Total */}
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total cotización</span>
                <span style={{ fontWeight: 700, fontSize: 20 }}>${detalle.total.toFixed(2)}</span>
              </div>

              {/* Partidas */}
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
                        ${p.subtotal_partida.toFixed(2)}
                      </div>
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
                ))}
              </div>
            </>
          )}

          {paso === 'convertir' && detalle && (
            <>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total cotización</div>
                <div style={{ fontWeight: 700, fontSize: 22 }}>${detalle.total.toFixed(2)}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de pago</label>
                <select className="form-input" value={tipoPago} onChange={e => setTipoPago(e.target.value)}>
                  <option value="ANTICIPO">Anticipo</option>
                  <option value="CONTADO">Contado (pago total)</option>
                </select>
              </div>
              {tipoPago === 'ANTICIPO' && (
                <div className="form-group">
                  <label className="form-label">Monto de anticipo ($)</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={anticipo}
                    onChange={e => setAnticipo(e.target.value)} placeholder="0.00" />
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {paso === 'detalle' ? (
            <>
              <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
              {detalle?.estatus === 'FINALIZADA' && (
                <>
                  <button className="btn btn-outline" onClick={handleReabrir} disabled={saving}>
                    {saving ? '...' : '↩ Reabrir'}
                  </button>
                  <button className="btn btn-primary" onClick={() => setPaso('convertir')}>
                    📋 Convertir a pedido
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => setPaso('detalle')} disabled={saving}>Volver</button>
              <button className="btn btn-primary" onClick={handleConvertir} disabled={saving}>
                {saving ? 'Creando pedido...' : 'Confirmar pedido'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────
export default function HistorialMaquila() {
  const { getCotizacionesMaquila } = useCotizacion()
  const [cots,     setCots]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [selId,    setSelId]    = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await getCotizacionesMaquila()
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setCots(res.data)
  }, [getCotizacionesMaquila])

  useEffect(() => { cargar() }, [cargar])

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>Cargando historial...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Historial Maquila</div>
          <div className="page-subtitle">{cots.length} cotizacion{cots.length !== 1 ? 'es' : ''}</div>
        </div>
        <button className="btn btn-outline" onClick={cargar}>↻ Actualizar</button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">❌ {error}</div>}

        {cots.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔨</div>
            <h3>Sin cotizaciones de maquila</h3>
            <p>Las cotizaciones convertidas a pedido no aparecen aquí</p>
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
                  <th>Estatus</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {cots.map(c => {
                  const badge = BADGE_ESTATUS[c.estatus] ?? { label: c.estatus, bg: '#e5e7eb', color: '#374151' }
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelId(c.id)}>
                      <td data-label="Folio">
                        <span className="badge badge-blue">{c.folio}</span>
                      </td>
                      <td data-label="Fecha" style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c.fecha}</td>
                      <td data-label="Cliente" style={{ fontWeight: 600 }}>{c.clienteNombre}</td>
                      <td data-label="Nivel">
                        {c.nivelNombre
                          ? <span className="badge badge-gray">{c.nivelNombre}</span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                      </td>
                      <td data-label="Total" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {c.total > 0 ? `$${c.total.toFixed(2)}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td data-label="Estatus">
                        <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSelId(c.id) }}>Ver</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selId && (
        <DetalleModal
          cotId={selId}
          onClose={() => setSelId(null)}
          onReopenOk={() => { setSelId(null); cargar() }}
          onConvertidoOk={() => { setSelId(null); cargar() }}
        />
      )}
    </>
  )
}
