import { useState, useMemo } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

// ── Parser de notacion {piezas}-{largo}x{ancho} ───────────────────────────
function parseNotacion(texto) {
  if (!texto || !texto.trim()) return { error: 'Ingresa una medida (ej. 3-22x45)' }
  const limpio = texto.trim().replace(/\s/g, '')
  // Formato: piezas-largo x ancho  (x puede ser 'x' o 'X')
  const match = limpio.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)$/)
  if (!match) return { error: 'Formato invalido. Usa: {piezas}-{largo}x{ancho} — ej. 3-22x45 o 2-30.5x45.2' }
  const piezas = Number(match[1])
  const largo  = Number(match[2])
  const ancho  = Number(match[3])
  if (piezas <= 0) return { error: 'La cantidad de piezas debe ser mayor a 0' }
  if (largo  <= 0) return { error: 'El largo debe ser mayor a 0' }
  if (ancho  <= 0) return { error: 'El ancho debe ser mayor a 0' }
  return { piezas, largo, ancho }
}

// ── Ticket de cotizacion ──────────────────────────────────────────────────
function TicketCotizacion({ cotizacion }) {
  const total = cotizacion.partidas.reduce((s, p) => s + p.subtotal_partida, 0)

  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>HERRAJES CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>COTIZACION DE VIDRIO</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Folio:</span><strong>{cotizacion.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{new Date().toLocaleDateString('es-MX')}</span></div>
      {cotizacion.clienteNombre && (
        <div className="ticket-row"><span>Cliente:</span><span>{cotizacion.clienteNombre}</span></div>
      )}
      <div className="ticket-row"><span>Nivel:</span><span>{cotizacion.nivelNombre}</span></div>
      {cotizacion.observaciones && (
        <div className="ticket-row" style={{ flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Observaciones:</span>
          <span style={{ fontSize: 12 }}>{cotizacion.observaciones}</span>
        </div>
      )}
      <hr className="ticket-divider" />
      {cotizacion.partidas.map((p, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 12 }}>
            {i + 1}. {p.tipoClaveLabel} — {p.piezas} pza{p.piezas > 1 ? 's' : ''} · {p.largo_cm}×{p.ancho_cm} cm
          </div>
          <div className="ticket-row" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <span>{p.metros2.toFixed(4)} m² × ${p.precio_m2_aplicado.toFixed(2)}/m²</span>
            <span>${p.subtotal_vidrio.toFixed(2)}</span>
          </div>
          {p.procesos && p.procesos.length > 0 && p.procesos.map((pr, j) => (
            <div key={j} className="ticket-row" style={{ fontSize: 11, paddingLeft: 10 }}>
              <span>+ {pr.nombre}</span>
              <span>${pr.subtotal.toFixed(2)}</span>
            </div>
          ))}
          <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
            <span>Subtotal partida</span>
            <span>${p.subtotal_partida.toFixed(2)}</span>
          </div>
        </div>
      ))}
      <hr className="ticket-divider" />
      <div className="ticket-total">
        <span>TOTAL</span>
        <span>${total.toFixed(2)}</span>
      </div>
      <hr className="ticket-divider" />
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        Esta cotizacion tiene una vigencia de 15 dias.
      </div>
    </div>
  )
}

// ── Pagina Nueva Cotizacion ───────────────────────────────────────────────
export default function NuevaCotizacion() {
  const {
    tiposVidrio, nivelesPrecio, clientes, procesos,
    getPrecioVidrio,
    iniciarCotizacion, agregarPartida, finalizarCotizacion,
  } = useCotizacion()

  // ── Estado global de la cotizacion ──────────────────────────────────────
  const [nivelId,      setNivelId]      = useState('')
  const [clienteId,    setClienteId]    = useState('')
  const [observaciones, setObservaciones] = useState('')

  // ── Estado de la calculadora ─────────────────────────────────────────────
  const [notacion,     setNotacion]     = useState('')
  const [notError,     setNotError]     = useState('')
  const [tipoVidrioId, setTipoVidrioId] = useState('')
  const [procesosSeleccionados, setProcesosSeleccionados] = useState([]) // [{id_proceso, nombre, ...}]

  // ── Lista de partidas en memoria ─────────────────────────────────────────
  const [partidas, setPartidas]         = useState([]) // filas acumuladas antes de guardar

  // ── Resultado final ──────────────────────────────────────────────────────
  const [cotCreada,    setCotCreada]    = useState(null)

  // ── UI ──────────────────────────────────────────────────────────────────
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState(null)

  // ── Selects derivados ────────────────────────────────────────────────────
  const nivelSeleccionado   = nivelesPrecio.find(n => n.id_nivel_precio === Number(nivelId))
  const clienteSeleccionado = clientes.find(c => c.id_cliente === Number(clienteId))
  const tipoSeleccionado    = tiposVidrio.find(t => t.id_tipo_vidrio === Number(tipoVidrioId))
  const tiposActivos        = tiposVidrio.filter(t => t.activo)
  const procesosActivos     = procesos.filter(p => p.activo)

  // ── Preview en vivo ──────────────────────────────────────────────────────
  const preview = useMemo(() => {
    if (!notacion.trim() || !tipoVidrioId || !nivelId) return null
    const parsed = parseNotacion(notacion)
    if (parsed.error) return null

    const nivel = nivelesPrecio.find(n => n.id_nivel_precio === Number(nivelId))
    if (!nivel) return null

    const tipo = tiposVidrio.find(t => t.id_tipo_vidrio === Number(tipoVidrioId))
    if (!tipo) return null

    const precio_m2 = getPrecioVidrio(tipo.id_tipo_vidrio, Number(nivelId))
    if (precio_m2 === null) return { sinPrecio: true, tipo }

    // Dimensiones: si es hoja completa usar las del tipo
    const esHojaCompleta = nivel.es_hoja_completa
    const largo = esHojaCompleta ? Number(tipo.hoja_largo_cm) : parsed.largo
    const ancho  = esHojaCompleta ? Number(tipo.hoja_ancho_cm)  : parsed.ancho

    const metros2_pieza   = (largo * ancho) / 10000
    const metros2_total   = parsed.piezas * metros2_pieza
    const subtotal_vidrio = metros2_total * precio_m2

    // Calcular procesos seleccionados
    let subtotal_procesos = 0
    const procesosCalc = procesosSeleccionados.map(sp => {
      const proc = procesosActivos.find(p => p.id_proceso === sp.id_proceso)
      if (!proc) return null
      const unidad = proc.unidad_cobro?.nombre ?? ''
      let cantidad
      if (unidad === 'm2') {
        cantidad = metros2_total
      } else {
        // ml: perimetro = (largo + ancho) * 2 / 100 metros por pieza * piezas
        cantidad = ((largo + ancho) * 2 / 100) * parsed.piezas
      }
      const subtotal = cantidad * Number(proc.precio_unitario)
      subtotal_procesos += subtotal
      return { id_proceso: proc.id_proceso, id_unidad_cobro: proc.id_unidad_cobro, nombre: proc.nombre, unidad, cantidad, precio_unitario: Number(proc.precio_unitario), subtotal }
    }).filter(Boolean)

    return {
      piezas: parsed.piezas,
      largo,
      ancho,
      metros2_total,
      precio_m2,
      subtotal_vidrio,
      subtotal_procesos,
      subtotal_total: subtotal_vidrio + subtotal_procesos,
      esHojaCompleta,
      procesosCalc,
    }
  }, [notacion, tipoVidrioId, nivelId, procesosSeleccionados, tiposVidrio, nivelesPrecio, procesosActivos, getPrecioVidrio])

  // ── Manejo de cambio de cliente ───────────────────────────────────────────
  const handleClienteChange = (e) => {
    const cid = e.target.value
    setClienteId(cid)
    if (cid) {
      const cl = clientes.find(c => c.id_cliente === Number(cid))
      if (cl?.id_nivel_precio) setNivelId(String(cl.id_nivel_precio))
    }
  }

  // ── Agregar partida a la lista ────────────────────────────────────────────
  const handleAgregarPartida = () => {
    const parsed = parseNotacion(notacion)
    if (parsed.error) { setNotError(parsed.error); return }
    if (!tipoVidrioId) { setNotError('Selecciona un tipo de vidrio'); return }
    if (!nivelId)      { setNotError('Selecciona un nivel de precio'); return }
    if (!preview || preview.sinPrecio) {
      setNotError('No hay precio configurado para este tipo y nivel')
      return
    }

    const nivel = nivelesPrecio.find(n => n.id_nivel_precio === Number(nivelId))
    const largo = nivel.es_hoja_completa ? Number(tipoSeleccionado.hoja_largo_cm) : parsed.largo
    const ancho  = nivel.es_hoja_completa ? Number(tipoSeleccionado.hoja_ancho_cm)  : parsed.ancho

    const nuevaPartida = {
      id_tipo_vidrio:    Number(tipoVidrioId),
      tipoClaveLabel:    tipoSeleccionado.clave,
      piezas:            parsed.piezas,
      largo_cm:          largo,
      ancho_cm:          ancho,
      metros2:           preview.metros2_total,
      precio_m2_aplicado: preview.precio_m2,
      subtotal_vidrio:   preview.subtotal_vidrio,
      subtotal_procesos: preview.subtotal_procesos,
      subtotal_partida:  preview.subtotal_total,
      procesos:          preview.procesosCalc,
    }

    setPartidas(prev => [...prev, nuevaPartida])
    setNotacion('')
    setNotError('')
    setProcesosSeleccionados([])
  }

  // ── Toggle proceso en la seleccion ───────────────────────────────────────
  const toggleProceso = (proc) => {
    setProcesosSeleccionados(prev => {
      const existe = prev.find(p => p.id_proceso === proc.id_proceso)
      if (existe) return prev.filter(p => p.id_proceso !== proc.id_proceso)
      return [...prev, { id_proceso: proc.id_proceso }]
    })
  }

  // ── Quitar partida ────────────────────────────────────────────────────────
  const quitarPartida = (idx) => setPartidas(prev => prev.filter((_, i) => i !== idx))

  // ── Totales ───────────────────────────────────────────────────────────────
  const totalM2      = partidas.reduce((s, p) => s + p.metros2, 0)
  const totalGeneral = partidas.reduce((s, p) => s + p.subtotal_partida, 0)

  // ── Finalizar cotizacion ──────────────────────────────────────────────────
  const handleFinalizar = async () => {
    if (!nivelId)       { setSaveError('Selecciona un nivel de precio'); return }
    if (!partidas.length) { setSaveError('Agrega al menos una partida'); return }
    setSaving(true)
    setSaveError(null)

    // 1. Crear cabecera
    const { data: cot, error: cotErr } = await iniciarCotizacion({
      id_nivel_precio: Number(nivelId),
      id_cliente:      clienteId ? Number(clienteId) : null,
      observaciones:   observaciones.trim() || null,
    })
    if (cotErr) { setSaveError(cotErr); setSaving(false); return }

    // 2. Insertar partidas
    for (const p of partidas) {
      const { error: pErr } = await agregarPartida(cot.id_cotizacion, p)
      if (pErr) { setSaveError(pErr); setSaving(false); return }
    }

    // 3. Finalizar con total
    const { error: finErr } = await finalizarCotizacion(cot.id_cotizacion, totalGeneral)
    if (finErr) { setSaveError(finErr); setSaving(false); return }

    setSaving(false)
    setCotCreada({
      folio:         cot.folio,
      clienteNombre: clienteSeleccionado?.nombre ?? null,
      nivelNombre:   nivelSeleccionado?.nombre ?? '',
      observaciones: observaciones.trim() || null,
      partidas:      partidas,
      total:         totalGeneral,
    })
  }

  const nuevaCotizacion = () => {
    setCotCreada(null)
    setPartidas([])
    setNivelId('')
    setClienteId('')
    setObservaciones('')
    setNotacion('')
    setProcesosSeleccionados([])
    setSaveError(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // ── Pantalla de ticket ────────────────────────────────────────────────────
  if (cotCreada) {
    return (
      <>
        <div className="page-header">
          <div>
            <div className="page-title">Cotizacion registrada</div>
            <div className="page-subtitle">Folio {cotCreada.folio}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => window.print()}>
              🖨️ Imprimir
            </button>
            <button className="btn btn-primary" onClick={nuevaCotizacion}>
              + Nueva cotizacion
            </button>
          </div>
        </div>
        <div className="page-body">
          <div className="alert alert-success">
            ✅ Cotizacion guardada correctamente con folio {cotCreada.folio}.
          </div>
          <TicketCotizacion cotizacion={cotCreada} />
        </div>
      </>
    )
  }

  // ── Formulario de cotizacion ──────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Nueva Cotizacion</div>
          <div className="page-subtitle">Agrega partidas y finaliza la cotizacion</div>
        </div>
        {partidas.length > 0 && (
          <button
            className="btn btn-accent"
            onClick={handleFinalizar}
            disabled={saving || !nivelId}
          >
            {saving ? 'Guardando...' : `✓ Finalizar — $${totalGeneral.toFixed(2)}`}
          </button>
        )}
      </div>

      <div className="page-body">
        {saveError && <div className="alert alert-error">❌ {saveError}</div>}

        <div className="venta-grid">

          {/* ── Columna izquierda ── */}
          <div>

            {/* Cabecera de la cotizacion */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 15 }}>Datos de la cotizacion</div>
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label required">Nivel de precio</label>
                  <select
                    className="form-select"
                    value={nivelId}
                    onChange={e => setNivelId(e.target.value)}
                  >
                    <option value="">-- Seleccionar nivel --</option>
                    {nivelesPrecio.map(n => (
                      <option key={n.id_nivel_precio} value={n.id_nivel_precio}>{n.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Cliente (opcional)</label>
                  <select
                    className="form-select"
                    value={clienteId}
                    onChange={handleClienteChange}
                  >
                    <option value="">-- Mostrador --</option>
                    {clientes.filter(c => c.activo).map(c => (
                      <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                <label className="form-label">Observaciones</label>
                <input
                  className="form-input"
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Observaciones opcionales..."
                />
              </div>
            </div>

            {/* Calculadora */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>Calculadora</div>

              {/* Notacion */}
              <div className="form-group">
                <label className="form-label required">Medida</label>
                <input
                  className={`form-input cot-calc-input${notError ? ' error' : ''}`}
                  value={notacion}
                  onChange={e => { setNotacion(e.target.value); setNotError('') }}
                  placeholder="Ej. 3-22x45  o  1-30.5x60.2"
                  inputMode="decimal"
                  onKeyDown={e => e.key === 'Enter' && handleAgregarPartida()}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                {notError ? (
                  <div className="form-error">{notError}</div>
                ) : (
                  <div className="form-hint">Formato: {'{piezas}'}-{'{largo}'}x{'{ancho}'} en centimetros</div>
                )}
              </div>

              {/* Tipo de vidrio */}
              <div className="form-group">
                <label className="form-label required">Tipo de vidrio</label>
                <select
                  className="form-select"
                  value={tipoVidrioId}
                  onChange={e => setTipoVidrioId(e.target.value)}
                >
                  <option value="">-- Seleccionar tipo --</option>
                  {tiposActivos.map(t => (
                    <option key={t.id_tipo_vidrio} value={t.id_tipo_vidrio}>{t.clave}{t.descripcion ? ` — ${t.descripcion}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Procesos adicionales */}
              {procesosActivos.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Procesos adicionales</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {procesosActivos.map(proc => {
                      const sel = procesosSeleccionados.some(p => p.id_proceso === proc.id_proceso)
                      return (
                        <label
                          key={proc.id_proceso}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px', borderRadius: 20,
                            border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                            background: sel ? '#ede9fe' : 'white',
                            cursor: 'pointer', fontSize: 15,
                            transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => toggleProceso(proc)}
                            style={{ display: 'none' }}
                          />
                          {sel ? '✅' : '⬜'} {proc.nombre} ({proc.unidad_cobro?.nombre})
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Preview en vivo */}
              {preview && !preview.sinPrecio && (
                <div className="cot-preview-row">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Piezas</div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{preview.piezas}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Medida</div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{preview.largo}×{preview.ancho}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Total m²</div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{preview.metros2_total.toFixed(4)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Precio/m²</div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>${preview.precio_m2.toFixed(2)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Subtotal</div>
                      <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>${preview.subtotal_total.toFixed(2)}</div>
                    </div>
                  </div>
                  {preview.esHojaCompleta && (
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--warning)', fontWeight: 500 }}>
                      ⚠️ Nivel "Hoja completa": se usan las dimensiones de fabrica del tipo de vidrio ({preview.largo}×{preview.ancho} cm), no las medidas ingresadas.
                    </div>
                  )}
                  {preview.procesosCalc.length > 0 && (
                    <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      {preview.procesosCalc.map((pc, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}>
                          <span>+ {pc.nombre} ({pc.cantidad.toFixed(4)} {pc.unidad} × ${pc.precio_unitario.toFixed(2)})</span>
                          <span>${pc.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {preview?.sinPrecio && (
                <div className="alert alert-warning">
                  ⚠️ No hay precio configurado para <strong>{preview.tipo.clave}</strong> con el nivel seleccionado.
                  Ve a <strong>Precios</strong> para configurarlo.
                </div>
              )}

              {!nivelId && notacion && (
                <div className="alert alert-warning">⚠️ Selecciona un nivel de precio para calcular</div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                onClick={handleAgregarPartida}
                disabled={!notacion || !tipoVidrioId || !nivelId}
              >
                ➕ Agregar partida
              </button>
            </div>

            {/* Lista de partidas */}
            {partidas.length > 0 ? (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 15 }}>
                  Partidas ({partidas.length})
                </div>
                {partidas.map((p, i) => (
                  <div key={i} className="cot-partida-item">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>
                        {p.piezas} pza{p.piezas > 1 ? 's' : ''} · {p.largo_cm}×{p.ancho_cm} cm · {p.metros2.toFixed(4)} m²
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        <span className="badge badge-blue" style={{ fontSize: 12, marginRight: 6 }}>{p.tipoClaveLabel}</span>
                        ${p.precio_m2_aplicado.toFixed(2)}/m²
                      </div>
                      {p.procesos && p.procesos.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          {p.procesos.map((pr, j) => (
                            <div key={j} style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 10 }}>
                              + {pr.nombre}: ${pr.subtotal.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)', minWidth: 80, textAlign: 'right' }}>
                      ${p.subtotal_partida.toFixed(2)}
                    </div>
                    <button
                      className="btn-icon danger"
                      onClick={() => quitarPartida(i)}
                      title="Quitar"
                    >✕</button>
                  </div>
                ))}
                <div className="venta-total-bar" style={{ marginTop: 12 }}>
                  <span>Total de la cotizacion</span>
                  <strong>${totalGeneral.toFixed(2)}</strong>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h3>Sin partidas</h3>
                <p>Ingresa una medida y agrega piezas de vidrio</p>
              </div>
            )}
          </div>

          {/* ── Columna derecha: resumen sticky ── */}
          <div className="venta-side-summary" style={{ position: 'sticky', top: 80 }}>
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Resumen</div>

              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Nivel de precio</div>
              <div style={{ fontWeight: 600, marginBottom: 14 }}>
                {nivelSeleccionado ? (
                  <span className="badge badge-blue">{nivelSeleccionado.nombre}</span>
                ) : (
                  <span style={{ color: 'var(--danger)', fontSize: 13 }}>— Sin seleccionar —</span>
                )}
              </div>

              {clienteSeleccionado && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>Cliente</div>
                  <div style={{ fontWeight: 500, marginBottom: 14 }}>{clienteSeleccionado.nombre}</div>
                </>
              )}

              <div className="divider" />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Partidas</span>
                <span style={{ fontWeight: 600 }}>{partidas.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Total m²</span>
                <span style={{ fontWeight: 600 }}>{totalM2.toFixed(4)}</span>
              </div>

              <div className="divider" />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent)' }}>${totalGeneral.toFixed(2)}</span>
              </div>

              <button
                className="btn btn-accent"
                style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
                onClick={handleFinalizar}
                disabled={partidas.length === 0 || !nivelId || saving}
              >
                {saving ? 'Guardando...' : '✓ Finalizar cotizacion'}
              </button>
              <button
                className="btn btn-outline"
                style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
                onClick={() => setPartidas([])}
                disabled={partidas.length === 0}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Barra inferior movil ── */}
      {partidas.length > 0 && (
        <div className="venta-mobile-bar">
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total · {partidas.length} partida{partidas.length !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', lineHeight: 1.1 }}>
              ${totalGeneral.toFixed(2)}
            </div>
          </div>
          <button
            className="btn btn-accent"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleFinalizar}
            disabled={saving || !nivelId}
          >
            {saving ? 'Guardando...' : '✓ Finalizar'}
          </button>
        </div>
      )}
    </>
  )
}
