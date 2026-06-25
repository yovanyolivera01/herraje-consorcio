import { useState, useMemo } from 'react'
import { fmt5 } from '../../lib/utils'
import { useCotizacion } from '../../context/CotizacionContext'

// ── Ticket preview ────────────────────────────────────────────────────────
function TicketMaquila({ detalle, onConvertir, convirtiendo }) {
  return (
    <div style={{ maxWidth: 380, margin: '0 auto' }}>
      <div className="ticket-preview">
        <div className="ticket-header">
          <h2>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h2>
          <p style={{ fontWeight: 700 }}>COTIZACION MAQUILA</p>
        </div>
        <hr className="ticket-divider" />
        <div className="ticket-row"><span>Folio:</span><strong>{detalle.folio}</strong></div>
        <div className="ticket-row"><span>Fecha:</span><span>{detalle.fecha}</span></div>
        {detalle.cliente && (
          <div className="ticket-row"><span>Cliente:</span><span>{detalle.cliente.nombre}</span></div>
        )}
        {detalle.nivel && (
          <div className="ticket-row"><span>Nivel:</span><span>{detalle.nivel.nombre}</span></div>
        )}
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
              {i + 1}. {p.cantidad} pza{p.cantidad !== 1 ? 's' : ''} — {p.largo_cm}×{p.ancho_cm} cm
            </div>
            {p.descripcion && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 12 }}>{p.descripcion}</div>
            )}
            {p.procesos.map((pr, j) => (
              <div key={j} className="ticket-row" style={{ fontSize: 11, paddingLeft: 10 }}>
                <span>+ {pr.nombre}</span>
                <span>${fmt5(pr.subtotal)}</span>
              </div>
            ))}
            <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
              <span>Subtotal</span>
              <span>${fmt5(p.subtotal_partida)}</span>
            </div>
          </div>
        ))}
        <hr className="ticket-divider" />
        <div className="ticket-total">
          <span>TOTAL</span>
          <span>${fmt5(detalle.total)}</span>
        </div>
      </div>
      <button
        className="btn btn-primary"
        style={{ width: '100%', marginTop: 16 }}
        onClick={onConvertir}
        disabled={convirtiendo}
      >
        {convirtiendo ? 'Procesando...' : '📋 Convertir a pedido'}
      </button>
    </div>
  )
}

// ── Modal: convertir a pedido ─────────────────────────────────────────────
function ConvertirModal({ cotizacion, onClose, onConvertido }) {
  const { convertirMaquilaAPedido } = useCotizacion()
  const [tipoPago,  setTipoPago]  = useState('ANTICIPO')
  const [anticipo,  setAnticipo]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  const handleConfirm = async () => {
    const montAnt = tipoPago === 'CONTADO' ? cotizacion.total : Number(anticipo)
    if (tipoPago === 'ANTICIPO' && (isNaN(montAnt) || montAnt < 0)) {
      setError('Ingresa un monto de anticipo válido'); return
    }
    setSaving(true); setError(null)
    const res = await convertirMaquilaAPedido({
      id_cotizacion: cotizacion.id,
      tipo_pago:     tipoPago,
      monto_anticipo: montAnt,
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onConvertido(res.data)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title">Convertir a pedido — {cotizacion.folio}</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total cotización</div>
            <div style={{ fontWeight: 700, fontSize: 22 }}>${fmt5(cotizacion.total)}</div>
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
          {error && <div className="alert alert-error">❌ {error}</div>}
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

// ── Formulario de partida ─────────────────────────────────────────────────
function FormPartida({ procesos, onAgregar, agregando }) {
  const [form, setForm] = useState({ descripcion: '', largo_cm: '', ancho_cm: '', cantidad: '1' })
  const [procesosSelec, setProcesosSelec] = useState([]) // [{id_proceso, cantidad: ''}]
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleProceso = (id) => {
    setProcesosSelec(prev => {
      const existe = prev.find(p => p.id_proceso === id)
      if (existe) return prev.filter(p => p.id_proceso !== id)
      return [...prev, { id_proceso: id, cantidad: '' }]
    })
  }

  const setCantidadProceso = (id, val) => {
    setProcesosSelec(prev => prev.map(p => p.id_proceso === id ? { ...p, cantidad: val } : p))
  }

  const handleAgregar = async () => {
    if (!form.largo_cm || Number(form.largo_cm) <= 0) { setError('Ingresa el largo'); return }
    if (!form.ancho_cm || Number(form.ancho_cm) <= 0) { setError('Ingresa el ancho'); return }
    if (!form.cantidad  || Number(form.cantidad)  <= 0) { setError('Ingresa la cantidad'); return }
    setError(null)
    const procesosPayload = procesosSelec.map(p => ({
      id_proceso: p.id_proceso,
      ...(p.cantidad !== '' ? { cantidad: Number(p.cantidad) } : {}),
    }))
    const ok = await onAgregar({
      descripcion: form.descripcion.trim() || null,
      largo_cm:    Number(form.largo_cm),
      ancho_cm:    Number(form.ancho_cm),
      cantidad:    Number(form.cantidad),
      procesos:    procesosPayload,
    })
    if (ok) {
      setForm({ descripcion: '', largo_cm: '', ancho_cm: '', cantidad: '1' })
      setProcesosSelec([])
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'white' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
        Nueva partida
      </div>
      <div className="form-group">
        <label className="form-label">Descripcion (opcional)</label>
        <input className="form-input" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Ej. Marco izquierdo" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div className="form-group">
          <label className="form-label">Largo (cm) *</label>
          <input className="form-input" type="number" min="1" step="0.1" value={form.largo_cm} onChange={e => set('largo_cm', e.target.value)} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Ancho (cm) *</label>
          <input className="form-input" type="number" min="1" step="0.1" value={form.ancho_cm} onChange={e => set('ancho_cm', e.target.value)} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Cantidad *</label>
          <input className="form-input" type="number" min="1" step="1" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} placeholder="1" />
        </div>
      </div>

      {procesos.length > 0 && (
        <div className="form-group">
          <label className="form-label">Procesos</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {procesos.filter(p => p.activo).map(p => {
              const sel = procesosSelec.find(s => s.id_proceso === p.id_proceso)
              return (
                <div key={p.id_proceso} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '4px 10px', borderRadius: 6, fontSize: 13,
                    background: sel ? 'var(--accent)' : 'var(--bg)',
                    color: sel ? 'white' : 'var(--text)',
                    border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}>
                    <input type="checkbox" style={{ display: 'none' }} checked={!!sel} onChange={() => toggleProceso(p.id_proceso)} />
                    {p.nombre}
                  </label>
                  {sel && (
                    <input
                      type="number" min="1" step="1"
                      value={sel.cantidad}
                      onChange={e => setCantidadProceso(p.id_proceso, e.target.value)}
                      placeholder="cant"
                      style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <div className="form-hint">Deja cantidad vacía para que el sistema la calcule por m²</div>
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: 8 }}>❌ {error}</div>}
      <button className="btn btn-primary" onClick={handleAgregar} disabled={agregando} style={{ width: '100%' }}>
        {agregando ? 'Agregando...' : '+ Agregar partida'}
      </button>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────
export default function NuevaCotizacionMaquila() {
  const {
    nivelesPrecio, clientes, procesos,
    iniciarCotizacionMaquila, agregarPartidaMaquila, eliminarPartidaMaquila,
    finalizarCotizacionMaquila, getDetalleCotizacionMaquila,
  } = useCotizacion()

  // Estado de la cotización activa
  const [cotizacion, setCotizacion] = useState(null) // {id_cotizacion, folio}
  const [partidas,   setPartidas]   = useState([])   // subtotals locales para display
  const [detalle,    setDetalle]    = useState(null)  // post-finalización
  const [pedidoCreado, setPedidoCreado] = useState(null) // {id_pedido, folio}

  // Header form
  const [nivelId,       setNivelId]       = useState('')
  const [clienteId,     setClienteId]     = useState('')
  const [observaciones, setObservaciones] = useState('')

  // UI state
  const [iniciando,   setIniciando]   = useState(false)
  const [agregando,   setAgregando]   = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [eliminando,  setEliminando]  = useState(null)
  const [error,       setError]       = useState(null)
  const [modalConv,   setModalConv]   = useState(false)

  const totalParcial = partidas.reduce((s, p) => s + p.subtotal, 0)

  const handleIniciar = async () => {
    if (!nivelId) { setError('Selecciona el nivel de precio'); return }
    setIniciando(true); setError(null)
    const res = await iniciarCotizacionMaquila({
      id_nivel_precio: Number(nivelId),
      id_cliente:      clienteId ? Number(clienteId) : null,
      observaciones:   observaciones.trim() || null,
    })
    setIniciando(false)
    if (res.error) { setError(res.error); return }
    setCotizacion(res.data)
  }

  const handleAgregarPartida = async (datos) => {
    setAgregando(true); setError(null)
    const res = await agregarPartidaMaquila({ id_cotizacion: cotizacion.id_cotizacion, ...datos })
    setAgregando(false)
    if (res.error) { setError(res.error); return false }
    setPartidas(prev => [...prev, { id: res.data.id_partida, subtotal: res.data.subtotal, ...datos }])
    return true
  }

  const handleEliminar = async (id_partida) => {
    setEliminando(id_partida)
    const res = await eliminarPartidaMaquila(id_partida)
    setEliminando(null)
    if (res.error) { setError(res.error); return }
    setPartidas(prev => prev.filter(p => p.id !== id_partida))
  }

  const handleFinalizar = async () => {
    if (partidas.length === 0) { setError('Agrega al menos una partida'); return }
    setFinalizando(true); setError(null)
    const resF = await finalizarCotizacionMaquila(cotizacion.id_cotizacion)
    if (resF.error) { setFinalizando(false); setError(resF.error); return }
    const resD = await getDetalleCotizacionMaquila(cotizacion.id_cotizacion)
    setFinalizando(false)
    if (resD.error) { setError(resD.error); return }
    setDetalle(resD.data)
  }

  const handleReset = () => {
    setCotizacion(null); setPartidas([]); setDetalle(null); setPedidoCreado(null)
    setNivelId(''); setClienteId(''); setObservaciones(''); setError(null)
  }

  // ── Post-pedido ─────────────────────────────────────────────────────────
  if (pedidoCreado) {
    return (
      <>
        <div className="page-header">
          <div className="page-title">Pedido creado</div>
        </div>
        <div className="page-body">
          <div className="alert alert-success">
            ✅ Pedido <strong>{pedidoCreado.folio}</strong> creado exitosamente.
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleReset}>+ Nueva cotización</button>
          </div>
        </div>
      </>
    )
  }

  // ── Post-finalización: mostrar ticket ───────────────────────────────────
  if (detalle) {
    return (
      <>
        <div className="page-header">
          <div>
            <div className="page-title">Cotización finalizada</div>
            <div className="page-subtitle">{detalle.folio} · ${fmt5(detalle.total)}</div>
          </div>
          <button className="btn btn-outline" onClick={handleReset}>+ Nueva cotización</button>
        </div>
        <div className="page-body">
          <div className="alert alert-success">✅ Cotización finalizada. Total: <strong>${fmt5(detalle.total)}</strong></div>
          <TicketMaquila
            detalle={detalle}
            onConvertir={() => setModalConv(true)}
            convirtiendo={false}
          />
        </div>
        {modalConv && (
          <ConvertirModal
            cotizacion={detalle}
            onClose={() => setModalConv(false)}
            onConvertido={(data) => { setModalConv(false); setPedidoCreado(data) }}
          />
        )}
      </>
    )
  }

  // ── Captura de partidas ──────────────────────────────────────────────────
  if (cotizacion) {
    return (
      <>
        <div className="page-header">
          <div>
            <div className="page-title">Cotización maquila</div>
            <div className="page-subtitle">{cotizacion.folio} · {partidas.length} partida{partidas.length !== 1 ? 's' : ''}</div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleFinalizar}
            disabled={finalizando || partidas.length === 0}
          >
            {finalizando ? 'Finalizando...' : `✅ Finalizar — $${fmt5(totalParcial)}`}
          </button>
        </div>

        <div className="page-body">
          {error && <div className="alert alert-error">❌ {error}</div>}

          {/* Lista de partidas agregadas */}
          {partidas.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Partidas — {partidas.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {partidas.map((p, i) => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', background: 'white',
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 6, background: 'var(--accent)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {p.cantidad} pza{p.cantidad !== 1 ? 's' : ''} · {p.largo_cm}×{p.ancho_cm} cm
                      </div>
                      {p.descripcion && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.descripcion}</div>}
                      {p.procesos?.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {p.procesos.map(pr => {
                            const nombre = procesos.find(x => x.id_proceso === pr.id_proceso)?.nombre ?? `#${pr.id_proceso}`
                            return nombre
                          }).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)', flexShrink: 0 }}>
                      ${fmt5(p.subtotal)}
                    </div>
                    <button
                      className="btn-icon"
                      onClick={() => handleEliminar(p.id)}
                      disabled={eliminando === p.id}
                      style={{ color: 'var(--danger)', flexShrink: 0 }}
                    >
                      {eliminando === p.id ? '...' : '✕'}
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontWeight: 700, fontSize: 15 }}>
                Total parcial: <span style={{ marginLeft: 8, color: 'var(--accent)' }}>${fmt5(totalParcial)}</span>
              </div>
            </div>
          )}

          {/* Formulario nueva partida */}
          <FormPartida procesos={procesos} onAgregar={handleAgregarPartida} agregando={agregando} />
        </div>
      </>
    )
  }

  // ── Header inicial ────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div className="page-title">Nueva cotización maquila</div>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          {error && <div className="alert alert-error">❌ {error}</div>}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 20, background: 'white' }}>
            <div className="form-group">
              <label className="form-label">Nivel de precio *</label>
              <select className="form-input" value={nivelId} onChange={e => setNivelId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {nivelesPrecio.map(n => (
                  <option key={n.id_nivel_precio} value={n.id_nivel_precio}>{n.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cliente (opcional)</label>
              <select className="form-input" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                <option value="">Mostrador / sin cliente</option>
                {clientes.filter(c => c.activo !== false).map(c => (
                  <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <input className="form-input" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Notas adicionales..." />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleIniciar}
              disabled={iniciando}
            >
              {iniciando ? 'Iniciando...' : 'Iniciar cotización'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
