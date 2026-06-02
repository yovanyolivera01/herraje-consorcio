import { useState, useEffect, useCallback, useMemo } from 'react'
import { History } from 'lucide-react'
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
                <option key={t.id_tipo_vidrio} value={t.id_tipo_vidrio}>{t.clave}{t.descripcion ? ` — ${t.descripcion}` : ''}</option>
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

// ── Modal: ajuste manual por hojas completas ─────────────────────────────
function AjusteModal({ lote, onClose, onSaved }) {
  const { ajustarInventario } = useCotizacion()
  const [hojas, setHojas] = useState('')
  const [tipo,  setTipo]  = useState('descuento')
  const [nota,  setNota]  = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const n           = parseInt(hojas) || 0
  const delta       = tipo === 'entrada' ? n : -n
  const hojasResult = lote.cantidad_hojas + delta
  const m2Delta     = +(n * lote.m2_por_hoja).toFixed(4)
  const m2Result    = +(lote.m2_disponible + (tipo === 'entrada' ? m2Delta : -m2Delta)).toFixed(4)
  const valido      = n > 0 && hojasResult >= 0 && m2Result >= 0

  const handleSave = async () => {
    if (!valido) { setError('Ingresa una cantidad válida de hojas'); return }
    setSaving(true); setError(null)
    const res = await ajustarInventario(lote.id_inventario, delta, nota.trim() || null)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title">Ajuste de inventario</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* Info del lote */}
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            <strong>{lote.tipo_vidrio}</strong> · {lote.medidas}
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              {lote.m2_por_hoja.toFixed(4)} m²/hoja · {lote.cantidad_hojas} hojas actuales
            </div>
          </div>

          {/* Tipo */}
          <div className="form-group">
            <label className="form-label">Tipo de movimiento</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {[['descuento', '− Descontar hojas'], ['entrada', '+ Agregar hojas']].map(([v, l]) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, fontWeight: tipo === v ? 700 : 400 }}>
                  <input type="radio" value={v} checked={tipo === v} onChange={() => setTipo(v)} />
                  {l}
                </label>
              ))}
            </div>
          </div>

          {/* Cantidad hojas */}
          <div className="form-group">
            <label className="form-label">Hojas completas *</label>
            <input
              className="form-input"
              type="number"
              min="1"
              step="1"
              value={hojas}
              onChange={e => setHojas(e.target.value)}
              placeholder="0"
              autoFocus
            />
            {n > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                = {m2Delta.toFixed(4)} m² ({n} × {lote.m2_por_hoja.toFixed(4)})
              </div>
            )}
          </div>

          {/* Preview antes / después */}
          {n > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', background: 'var(--bg)', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Antes</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{lote.cantidad_hojas} <span style={{ fontSize: 12 }}>hojas</span></div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lote.m2_disponible.toFixed(4)} m²</div>
              </div>
              <div style={{ fontSize: 20, color: 'var(--text-muted)', textAlign: 'center' }}>→</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Después</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: hojasResult < 0 ? '#dc2626' : tipo === 'entrada' ? '#16a34a' : 'var(--text)' }}>
                  {hojasResult} <span style={{ fontSize: 12 }}>hojas</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m2Result.toFixed(4)} m²</div>
              </div>
            </div>
          )}
          {hojasResult < 0 && <div className="alert alert-error" style={{ marginBottom: 0 }}>No hay suficientes hojas para este descuento</div>}

          {/* Nota */}
          <div className="form-group">
            <label className="form-label">Nota <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
            <input className="form-input" value={nota} onChange={e => setNota(e.target.value)} placeholder="Motivo del ajuste..." />
          </div>

          {error && <div className="alert alert-error">❌ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !valido}>
            {saving ? 'Aplicando...' : tipo === 'entrada' ? `+ Agregar ${n || 0} hoja${n !== 1 ? 's' : ''}` : `− Descontar ${n || 0} hoja${n !== 1 ? 's' : ''}`}
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

// ── Indicador de batería ──────────────────────────────────────────────────
function BateriaStock({ pctDisponible, m2Total }) {
  const pct   = Math.max(0, Math.min(100, pctDisponible))
  const color = pct > 50 ? '#16a34a' : pct > 20 ? '#d97706' : '#dc2626'

  return (
    <div style={{ minWidth: 110 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
        <div style={{
          position: 'relative', width: 80, height: 20,
          border: `2px solid ${color}`, borderRadius: 4, flexShrink: 0,
          background: '#f3f4f6', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`, background: color, transition: 'width 0.5s', borderRadius: 2,
          }} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, color: pct > 40 ? 'white' : color, zIndex: 1,
          }}>
            {pct.toFixed(0)}%
          </div>
        </div>
        <div style={{ width: 4, height: 10, background: color, borderRadius: '0 2px 2px 0', flexShrink: 0 }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {m2Total.toFixed(2)} m² totales
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────
export default function InventarioVidrio() {
  const { tiposVidrio, getInventarioVidrio, setLotePreferido } = useCotizacion()
  const [inventario, setInventario] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [modal,      setModal]      = useState(null)

  // Por cada tipo_vidrio, el lote que se usará para descontar:
  // preferido si está marcado, o el de mayor m² si ninguno lo está.
  const loteActivoIds = useMemo(() => {
    const porTipo = {}
    for (const lote of inventario) {
      const prev = porTipo[lote.tipo_vidrio]
      const esM = !prev || lote.m2_disponible > prev.m2_disponible
      if (!prev) { porTipo[lote.tipo_vidrio] = lote; continue }
      // preferido explícito gana siempre
      if (lote.es_preferido && !prev.es_preferido) { porTipo[lote.tipo_vidrio] = lote; continue }
      if (!lote.es_preferido && prev.es_preferido) continue
      // empate en preferido: mayor m²
      if (esM) porTipo[lote.tipo_vidrio] = lote
    }
    return new Set(Object.values(porTipo).map(l => l.id_inventario))
  }, [inventario])

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await getInventarioVidrio()
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setInventario(res.data)
  }, [getInventarioVidrio])

  const handleSetPreferido = async (e, lote) => {
    e.stopPropagation()
    // Optimistic: mark this lot preferred, unmark siblings of the same type
    setInventario(prev => prev.map(l => ({
      ...l,
      es_preferido: l.tipo_vidrio === lote.tipo_vidrio
        ? l.id_inventario === lote.id_inventario
        : l.es_preferido,
    })))
    const res = await setLotePreferido(lote.id_inventario)
    if (res.error) { setError(res.error); cargar() }
  }

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
                  <th style={{ textAlign: 'right' }}>Hojas entrada</th>
                  <th style={{ textAlign: 'right' }}>Hojas restante</th>
                  <th style={{ textAlign: 'right' }}>m² disponible</th>
                  <th>Carga disponible</th>
                  <th>Estado</th>
                  <th style={{ width: 130 }}></th>
                </tr>
              </thead>
              <tbody>
                {inventario.map(lote => {
                  const alerta   = BADGE_ALERTA[lote.alerta_stock] ?? BADGE_ALERTA.OK
                  const esActivo = loteActivoIds.has(lote.id_inventario)
                  const colorHojas = lote.hojas_restante <= 0 ? '#dc2626'
                    : lote.hojas_restante < lote.hojas_entrada * 0.2 ? '#d97706'
                    : '#16a34a'
                  return (
                    <tr
                      key={lote.id_inventario}
                      style={{ background: esActivo ? '#f0fdf4' : undefined, cursor: 'pointer' }}
                      onClick={() => setModal({ tipo: 'ajuste', lote })}
                    >
                      <td data-label="Tipo" style={{ fontWeight: 600 }}>{lote.tipo_vidrio}</td>
                      <td data-label="Medidas" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{lote.medidas}</td>
                      <td data-label="Hojas entrada" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {lote.hojas_entrada}
                      </td>
                      <td data-label="Hojas restante" style={{ textAlign: 'right', fontWeight: 700, color: colorHojas }}>
                        {lote.hojas_restante.toFixed(2)}
                      </td>
                      <td data-label="m² disponible" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {lote.m2_disponible.toFixed(2)} m²
                      </td>
                      <td data-label="Carga disponible">
                        <BateriaStock
                          pctDisponible={100 - lote.pct_usado}
                          m2Total={lote.m2_total_inicial}
                        />
                      </td>
                      <td data-label="Estado">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          <span style={{
                            padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                            background: alerta.bg, color: alerta.color,
                          }}>
                            {alerta.label}
                          </span>
                          {esActivo && (
                            <span style={{
                              padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700,
                              background: '#dcfce7', color: '#15803d',
                              display: 'flex', alignItems: 'center', gap: 3,
                            }}>
                              ↓ Descuenta aquí
                            </span>
                          )}
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            title={lote.es_preferido ? 'Preferido — click para quitar' : 'Marcar como preferido para descuento'}
                            onClick={e => handleSetPreferido(e, lote)}
                            style={{
                              background: lote.es_preferido ? '#fef9c3' : 'white',
                              border: `1.5px solid ${lote.es_preferido ? '#ca8a04' : 'var(--border)'}`,
                              color: lote.es_preferido ? '#854d0e' : 'var(--text-muted)',
                              fontSize: 16, padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
                            }}
                          >
                            {lote.es_preferido ? '★' : '☆'}
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            title="Ver movimientos"
                            onClick={e => { e.stopPropagation(); setModal({ tipo: 'movs', lote }) }}
                            style={{ display: 'flex', alignItems: 'center', padding: '4px 8px' }}
                          >
                            <History size={15} />
                          </button>
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
