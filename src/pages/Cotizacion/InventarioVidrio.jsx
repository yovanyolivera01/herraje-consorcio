import { useState, useEffect, useCallback } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

const BADGE_ALERTA = {
  OK:         { label: 'OK',          color: '#16a34a', bg: '#dcfce7' },
  STOCK_BAJO: { label: 'Stock bajo',  color: '#d97706', bg: '#fef3c7' },
  SIN_STOCK:  { label: 'Sin stock',   color: '#dc2626', bg: '#fee2e2' },
}

// ── Modal: registrar entrada de hojas ────────────────────────────────────
function EntradaModal({ tiposVidrio, onClose, onSaved }) {
  const { registrarInventarioVidrio } = useCotizacion()
  const [form, setForm] = useState({ id_tipo_vidrio: '', largo_cm: '', ancho_cm: '', cantidad_hojas: '' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.id_tipo_vidrio) { setError('Selecciona el tipo de vidrio'); return }
    if (!form.largo_cm || Number(form.largo_cm) <= 0) { setError('Ingresa el largo'); return }
    if (!form.ancho_cm || Number(form.ancho_cm) <= 0) { setError('Ingresa el ancho'); return }
    if (!form.cantidad_hojas || Number(form.cantidad_hojas) <= 0) { setError('Ingresa la cantidad de hojas'); return }
    setSaving(true); setError(null)
    const res = await registrarInventarioVidrio({
      id_tipo_vidrio: Number(form.id_tipo_vidrio),
      largo_cm:       Number(form.largo_cm),
      ancho_cm:       Number(form.ancho_cm),
      cantidad_hojas: Number(form.cantidad_hojas),
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onSaved(res.data)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title">Registrar entrada de vidrio</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Tipo de vidrio *</label>
            <select className="form-input" value={form.id_tipo_vidrio} onChange={e => set('id_tipo_vidrio', e.target.value)}>
              <option value="">Seleccionar...</option>
              {tiposVidrio.map(t => (
                <option key={t.id_tipo_vidrio} value={t.id_tipo_vidrio}>{t.clave} — {t.nombre}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Largo (cm) *</label>
              <input className="form-input" type="number" min="1" step="0.1" value={form.largo_cm} onChange={e => set('largo_cm', e.target.value)} placeholder="320" />
            </div>
            <div className="form-group">
              <label className="form-label">Ancho (cm) *</label>
              <input className="form-input" type="number" min="1" step="0.1" value={form.ancho_cm} onChange={e => set('ancho_cm', e.target.value)} placeholder="225" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Cantidad de hojas *</label>
            <input className="form-input" type="number" min="1" step="1" value={form.cantidad_hojas} onChange={e => set('cantidad_hojas', e.target.value)} placeholder="1" />
          </div>
          {error && <div className="alert alert-error">❌ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Registrando...' : 'Registrar entrada'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: ajuste manual ──────────────────────────────────────────────────
function AjusteModal({ lote, onClose, onSaved }) {
  const { ajustarInventario } = useCotizacion()
  const [m2, setM2]     = useState('')
  const [tipo, setTipo] = useState('entrada')
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const handleSave = async () => {
    if (!m2 || Number(m2) <= 0) { setError('Ingresa la cantidad en m²'); return }
    setSaving(true); setError(null)
    const ajuste = tipo === 'entrada' ? Number(m2) : -Number(m2)
    const res = await ajustarInventario(lote.id_inventario, ajuste, nota.trim() || null)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div className="modal-title">Ajuste de inventario</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
            <strong>{lote.tipo_vidrio}</strong> · {lote.medidas}<br />
            <span style={{ color: 'var(--text-muted)' }}>Disponible: <strong>{lote.m2_disponible.toFixed(3)} m²</strong></span>
          </div>
          <div className="form-group">
            <label className="form-label">Tipo de ajuste</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['entrada', '+ Entrada'], ['descuento', '- Descuento']].map(([v, l]) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                  <input type="radio" value={v} checked={tipo === v} onChange={() => setTipo(v)} />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Cantidad (m²) *</label>
            <input className="form-input" type="number" min="0.001" step="0.001" value={m2} onChange={e => setM2(e.target.value)} placeholder="0.000" />
          </div>
          <div className="form-group">
            <label className="form-label">Nota</label>
            <input className="form-input" value={nota} onChange={e => setNota(e.target.value)} placeholder="Motivo del ajuste..." />
          </div>
          {error && <div className="alert alert-error">❌ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Aplicando...' : 'Aplicar ajuste'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: movimientos de un lote ────────────────────────────────────────
function MovimientosModal({ lote, onClose }) {
  const { getMovimientosInventario } = useCotizacion()
  const [movs,    setMovs]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMovimientosInventario(lote.id_inventario).then(res => {
      setMovs(res.data ?? [])
      setLoading(false)
    })
  }, [lote.id_inventario, getMovimientosInventario])

  const TZ = 'America/Mexico_City'
  const fmt = (iso) => iso
    ? new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(new Date(iso))
    : '—'

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Movimientos — {lote.tipo_vidrio}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{lote.medidas}</div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Cargando...</div>
          ) : movs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Sin movimientos registrados</div>
          ) : (
            <div className="table-container" style={{ margin: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'right' }}>Cantidad m²</th>
                    <th style={{ textAlign: 'right' }}>Saldo m²</th>
                    <th>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {movs.map((m, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(m.fecha)}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: m.tipo_movimiento === 'ENTRADA' ? '#dcfce7' : m.tipo_movimiento === 'AJUSTE' ? '#fef3c7' : '#fee2e2',
                          color:      m.tipo_movimiento === 'ENTRADA' ? '#16a34a' : m.tipo_movimiento === 'AJUSTE' ? '#d97706' : '#dc2626',
                        }}>
                          {m.tipo_movimiento}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(m.m2_cantidad).toFixed(3)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{Number(m.m2_saldo_resultante).toFixed(3)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.nota ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────
export default function InventarioVidrio() {
  const { tiposVidrio, getInventarioVidrio } = useCotizacion()
  const [inventario, setInventario] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [modal,      setModal]      = useState(null) // null | {tipo:'entrada'} | {tipo:'ajuste',lote} | {tipo:'movs',lote}

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await getInventarioVidrio()
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setInventario(res.data)
  }, [getInventarioVidrio])

  useEffect(() => { cargar() }, [cargar])

  const sinStock  = inventario.filter(i => i.alerta_stock === 'SIN_STOCK').length
  const stockBajo = inventario.filter(i => i.alerta_stock === 'STOCK_BAJO').length

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>Cargando inventario...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Inventario de Vidrio</div>
          <div className="page-subtitle">{inventario.length} lote{inventario.length !== 1 ? 's' : ''} registrado{inventario.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={cargar}>↻ Actualizar</button>
          <button className="btn btn-primary" onClick={() => setModal({ tipo: 'entrada' })}>+ Entrada de vidrio</button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">❌ {error}</div>}

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total lotes</div>
            <div className="stat-value">{inventario.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Stock bajo</div>
            <div className="stat-value" style={{ color: stockBajo > 0 ? '#d97706' : 'var(--text)' }}>{stockBajo}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sin stock</div>
            <div className="stat-value" style={{ color: sinStock > 0 ? 'var(--danger)' : 'var(--text)' }}>{sinStock}</div>
          </div>
        </div>

        {inventario.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏭</div>
            <h3>Sin inventario registrado</h3>
            <p>Registra la primera entrada de hojas de vidrio</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>Tipo de vidrio</th>
                  <th>Medidas</th>
                  <th style={{ textAlign: 'right' }}>Hojas</th>
                  <th style={{ textAlign: 'right' }}>m² disponible</th>
                  <th style={{ textAlign: 'right' }}>% usado</th>
                  <th>Estado</th>
                  <th style={{ width: 130 }}></th>
                </tr>
              </thead>
              <tbody>
                {inventario.map(lote => {
                  const alerta = BADGE_ALERTA[lote.alerta_stock] ?? BADGE_ALERTA.OK
                  return (
                    <tr key={lote.id_inventario}>
                      <td data-label="Tipo" style={{ fontWeight: 600 }}>{lote.tipo_vidrio}</td>
                      <td data-label="Medidas" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{lote.medidas}</td>
                      <td data-label="Hojas" style={{ textAlign: 'right' }}>{lote.cantidad_hojas}</td>
                      <td data-label="m² disponible" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {lote.m2_disponible.toFixed(2)} m²
                      </td>
                      <td data-label="% usado" style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 13 }}>
                        {lote.pct_usado.toFixed(1)}%
                      </td>
                      <td data-label="Estado">
                        <span style={{
                          padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                          background: alerta.bg, color: alerta.color,
                        }}>
                          {alerta.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => setModal({ tipo: 'ajuste', lote })}>Ajuste</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setModal({ tipo: 'movs', lote })}>Movs.</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.tipo === 'entrada' && (
        <EntradaModal
          tiposVidrio={tiposVidrio}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar() }}
        />
      )}
      {modal?.tipo === 'ajuste' && (
        <AjusteModal
          lote={modal.lote}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar() }}
        />
      )}
      {modal?.tipo === 'movs' && (
        <MovimientosModal
          lote={modal.lote}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
