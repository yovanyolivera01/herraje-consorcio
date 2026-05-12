import { useState, useMemo } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

// ── Parser (mismo que vidrio) ─────────────────────────────────────────────
function parseNotacion(texto) {
  if (!texto || !texto.trim()) return { error: 'Ingresa una medida (ej. 3-22x45)' }
  const limpio = texto.trim().replace(/\s/g, '')
  const match  = limpio.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)$/)
  if (!match) return { error: 'Formato invalido. Usa: {piezas}-{largo}x{ancho}' }
  const piezas = Number(match[1])
  const largo  = Number(match[2])
  const ancho  = Number(match[3])
  if (piezas <= 0) return { error: 'La cantidad de piezas debe ser mayor a 0' }
  if (largo  <= 0) return { error: 'El largo debe ser mayor a 0' }
  if (ancho  <= 0) return { error: 'El ancho debe ser mayor a 0' }
  return { piezas, largo, ancho }
}

// ── Ticket de cotización ──────────────────────────────────────────────────
function TicketMaquila({ cotizacion }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>TEMPLADOS CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>COTIZACION MAQUILA</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Folio:</span><strong>{cotizacion.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{new Date().toLocaleDateString('es-MX')}</span></div>
      {cotizacion.clienteNombre && <div className="ticket-row"><span>Cliente:</span><span>{cotizacion.clienteNombre}</span></div>}
      {cotizacion.nivelNombre   && <div className="ticket-row"><span>Nivel:</span><span>{cotizacion.nivelNombre}</span></div>}
      <hr className="ticket-divider" />
      {cotizacion.partidas.map((p, i) => (
        <div key={p._key ?? i} style={{ marginBottom: 8 }}>
          <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
            <span>{p.cantidad} pza{p.cantidad > 1 ? 's' : ''} — {p.largo_cm}×{p.ancho_cm} cm</span>
            <span>${p.subtotal.toFixed(2)}</span>
          </div>
          {p.descripcion && <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 12 }}>{p.descripcion}</div>}
          {p.procesos?.map((pr, j) => (
            <div key={j} className="ticket-row" style={{ fontSize: 11, paddingLeft: 10 }}>
              <span>+ {pr.nombre}</span>
            </div>
          ))}
        </div>
      ))}
      <hr className="ticket-divider" />
      <div className="ticket-total">
        <span>TOTAL</span>
        <span>${cotizacion.partidas.reduce((s, p) => s + p.subtotal, 0).toFixed(2)}</span>
      </div>
      <hr className="ticket-divider" />
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        Esta cotizacion tiene una vigencia de 15 dias.
      </div>
    </div>
  )
}

// ── Ticket de pedido (post-conversión) ───────────────────────────────────
function TicketPedidoMaquila({ pedido, total, clienteNombre, nivelNombre }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>TEMPLADOS CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>PEDIDO MAQUILA</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Pedido:</span><strong>{pedido.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{new Date().toLocaleDateString('es-MX')}</span></div>
      {clienteNombre && <div className="ticket-row"><span>Cliente:</span><span>{clienteNombre}</span></div>}
      <hr className="ticket-divider" />
      <div className="ticket-total"><span>TOTAL</span><span>${total.toFixed(2)}</span></div>
      <div className="ticket-row" style={{ marginTop: 6 }}>
        <span>Forma de pago:</span><span>{pedido.tipo_pago === 'CONTADO' ? 'Liquidado' : 'Anticipo'}</span>
      </div>
      {pedido.tipo_pago !== 'CONTADO' && (
        <>
          <div className="ticket-row">
            <span>Anticipo:</span><span style={{ fontWeight: 600 }}>${pedido.anticipo?.toFixed(2) ?? '0.00'}</span>
          </div>
          <div className="ticket-row">
            <span>Saldo pendiente:</span>
            <span style={{ fontWeight: 700, color: 'var(--danger)' }}>${pedido.saldo?.toFixed(2) ?? '0.00'}</span>
          </div>
        </>
      )}
      <hr className="ticket-divider" />
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        Pedido pendiente de entrega.
      </div>
    </div>
  )
}

// ── Sección principal ─────────────────────────────────────────────────────
export default function MaquilaSection() {
  const {
    nivelesPrecio, clientes, procesos,
    getPrecioProceso, getPrecioProcesoEspecial,
    iniciarCotizacionMaquila, agregarPartidaMaquila, eliminarPartidaMaquila,
    finalizarCotizacionMaquila, convertirMaquilaAPedido,
  } = useCotizacion()

  // ── Header ────────────────────────────────────────────────────────────
  const [nivelId,   setNivelId]   = useState('')
  const [clienteId, setClienteId] = useState('')

  // ── Cotizacion (lazy) ─────────────────────────────────────────────────
  const [cotizacion, setCotizacion] = useState(null) // {id_cotizacion, folio}
  const [partidas,   setPartidas]   = useState([])

  // ── Calculadora ───────────────────────────────────────────────────────
  const [notacion,    setNotacion]    = useState('')
  const [notError,    setNotError]    = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [procesosSelec, setProcesosSelec] = useState([]) // [{id_proceso, cantidad:''}]

  // ── Resultados ────────────────────────────────────────────────────────
  const [cotCreada,    setCotCreada]    = useState(null)  // post-finalizar
  const [pedidoCreado, setPedidoCreado] = useState(null)

  // ── Modal convertir ───────────────────────────────────────────────────
  const [showModal,     setShowModal]     = useState(false)
  const [modalTipoPago, setModalTipoPago] = useState('LIQUIDADO')
  const [modalAnticipo, setModalAnticipo] = useState('')
  const [modalError,    setModalError]    = useState(null)
  const [converting,    setConverting]    = useState(false)

  // ── UI ────────────────────────────────────────────────────────────────
  const [agregando,  setAgregando]  = useState(false)
  const [finalizando,setFinalizando]= useState(false)
  const [eliminando, setEliminando] = useState(null)
  const [saveError,  setSaveError]  = useState(null)

  // ── Derivados ─────────────────────────────────────────────────────────
  const nivelSel    = nivelesPrecio.find(n => n.id_nivel_precio === Number(nivelId))
  const clienteSel  = clientes.find(c => c.id_cliente === Number(clienteId))
  const activos     = procesos.filter(p => p.activo)
  const totalGeneral = partidas.reduce((s, p) => s + p.subtotal, 0)

  // Parse notation en vivo
  const parsed = useMemo(() => parseNotacion(notacion), [notacion])
  const metros2Preview = !parsed.error
    ? (parsed.piezas * parsed.largo * parsed.ancho) / 10000
    : null

  // Preview de procesos (cliente-side, igual que vidrio)
  const previewProcesos = useMemo(() => {
    if (!nivelId || metros2Preview === null) return []
    return procesosSelec.map(sel => {
      const proc = activos.find(p => p.id_proceso === sel.id_proceso)
      if (!proc) return null
      const unidad    = (proc.unidad_cobro?.nombre ?? '').toLowerCase()
      const esPorPza  = unidad.includes('pza') || unidad.includes('pieza')
      const esPorM2   = !esPorPza
      let cantidad, precio_unitario
      if (esPorPza) {
        cantidad        = sel.cantidad !== '' ? Number(sel.cantidad) : 1
        precio_unitario = getPrecioProcesoEspecial(proc.id_proceso, Number(nivelId)) ?? 0
      } else {
        cantidad        = metros2Preview
        precio_unitario = getPrecioProceso(proc.id_proceso, Number(nivelId), null) ?? 0
      }
      return {
        id_proceso: proc.id_proceso, nombre: proc.nombre,
        unidad: proc.unidad_cobro?.nombre ?? '', esPorM2,
        cantidad, precio_unitario, subtotal: cantidad * precio_unitario,
      }
    }).filter(Boolean)
  }, [nivelId, metros2Preview, procesosSelec, activos, getPrecioProceso, getPrecioProcesoEspecial])

  const subtotalPreview = previewProcesos.reduce((s, p) => s + p.subtotal, 0)

  // ── Toggle proceso ────────────────────────────────────────────────────
  const toggleProceso = (id) => {
    setProcesosSelec(prev => {
      const ex = prev.find(p => p.id_proceso === id)
      return ex ? prev.filter(p => p.id_proceso !== id) : [...prev, { id_proceso: id, cantidad: '' }]
    })
  }
  const setProcesoQty = (id, val) =>
    setProcesosSelec(prev => prev.map(p => p.id_proceso === id ? { ...p, cantidad: val } : p))

  // ── Ensure cotizacion (lazy) ──────────────────────────────────────────
  const ensureCotizacion = async () => {
    if (cotizacion) return { ok: true, id: cotizacion.id_cotizacion }
    if (!nivelId)  return { ok: false, error: 'Selecciona un nivel de precio' }
    const res = await iniciarCotizacionMaquila({
      id_nivel_precio: Number(nivelId),
      id_cliente: clienteId ? Number(clienteId) : null,
    })
    if (res.error) return { ok: false, error: res.error }
    setCotizacion(res.data)
    return { ok: true, id: res.data.id_cotizacion }
  }

  // ── Agregar partida ───────────────────────────────────────────────────
  const handleAgregarPartida = async () => {
    if (parsed.error) { setNotError(parsed.error); return }
    if (!nivelId)     { setNotError('Selecciona un nivel de precio'); return }
    setAgregando(true); setSaveError(null); setNotError('')

    const init = await ensureCotizacion()
    if (!init.ok) { setAgregando(false); setSaveError(init.error); return }

    const res = await agregarPartidaMaquila({
      id_cotizacion: init.id,
      descripcion: descripcion.trim() || null,
      largo_cm:  parsed.largo,
      ancho_cm:  parsed.ancho,
      cantidad:  parsed.piezas,
      procesos:  procesosSelec.map(ps => ({
        id_proceso: ps.id_proceso,
        ...(ps.cantidad !== '' ? { cantidad: Number(ps.cantidad) } : {}),
      })),
    })
    setAgregando(false)
    if (res.error) { setSaveError(res.error); return }

    setPartidas(prev => [...prev, {
      _key:       Date.now(),
      id:         res.data.id_partida,
      descripcion: descripcion.trim() || null,
      largo_cm:   parsed.largo,
      ancho_cm:   parsed.ancho,
      cantidad:   parsed.piezas,
      metros2:    metros2Preview,
      subtotal:   res.data.subtotal,
      procesos:   procesosSelec.map(ps => ({
        nombre: activos.find(p => p.id_proceso === ps.id_proceso)?.nombre ?? `#${ps.id_proceso}`,
      })),
    }])
    setNotacion(''); setDescripcion(''); setProcesosSelec([])
  }

  // ── Quitar partida ────────────────────────────────────────────────────
  const handleQuitarPartida = async (partida, idx) => {
    setEliminando(idx)
    const res = await eliminarPartidaMaquila(partida.id)
    setEliminando(null)
    if (res.error) { setSaveError(res.error); return }
    setPartidas(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Finalizar (solo cotizar) ──────────────────────────────────────────
  const handleFinalizar = async () => {
    if (!partidas.length) { setSaveError('Agrega al menos una partida'); return }
    setFinalizando(true); setSaveError(null)
    const resF = await finalizarCotizacionMaquila(cotizacion.id_cotizacion)
    if (resF.error) { setFinalizando(false); setSaveError(resF.error); return }
    setFinalizando(false)
    setCotCreada({
      folio:         cotizacion.folio,
      clienteNombre: clienteSel?.nombre ?? null,
      nivelNombre:   nivelSel?.nombre ?? '',
      partidas,
      total: totalGeneral,
    })
  }

  // ── Convertir a pedido ────────────────────────────────────────────────
  const handleConvertir = async () => {
    const antN = parseFloat(modalAnticipo) || 0
    if (modalTipoPago === 'ANTICIPO' && antN <= 0) { setModalError('Ingresa un monto de anticipo válido'); return }
    if (modalTipoPago === 'ANTICIPO' && antN >= totalGeneral) { setModalError('El anticipo debe ser menor al total'); return }
    setConverting(true); setModalError(null)

    const resF = await finalizarCotizacionMaquila(cotizacion.id_cotizacion)
    if (resF.error) { setConverting(false); setModalError(resF.error); return }

    const monto = modalTipoPago === 'LIQUIDADO' ? totalGeneral : antN
    const resC  = await convertirMaquilaAPedido({
      id_cotizacion:  cotizacion.id_cotizacion,
      tipo_pago:      modalTipoPago,
      monto_anticipo: monto,
    })
    setConverting(false)
    if (resC.error) { setModalError(resC.error); return }
    setShowModal(false)
    setPedidoCreado({ folio: resC.data.folio, tipo_pago: modalTipoPago, anticipo: antN, saldo: totalGeneral - antN })
    setCotCreada({ folio: cotizacion.folio, clienteNombre: clienteSel?.nombre ?? null, nivelNombre: nivelSel?.nombre ?? '', partidas, total: totalGeneral })
  }

  // ── Reset ─────────────────────────────────────────────────────────────
  const nuevaCotizacion = () => {
    setCotizacion(null); setPartidas([]); setCotCreada(null); setPedidoCreado(null)
    setNivelId(''); setClienteId(''); setNotacion(''); setDescripcion(''); setProcesosSelec([])
    setSaveError(null); setNotError(''); setModalAnticipo(''); setModalTipoPago('LIQUIDADO')
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Pantalla: pedido creado
  // ══════════════════════════════════════════════════════════════════════
  if (pedidoCreado && cotCreada) {
    return (
      <>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:16 }}>Pedido creado — {pedidoCreado.folio}</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>
              {pedidoCreado.tipo_pago === 'CONTADO' ? 'Liquidado' : 'Pendiente de entrega'}
            </div>
          </div>
          <button className="btn btn-primary" onClick={nuevaCotizacion}>+ Nueva cotizacion</button>
        </div>
        <div className="alert alert-success">
          ✅ Pedido <strong>{pedidoCreado.folio}</strong> registrado correctamente.
        </div>
        <TicketPedidoMaquila
          pedido={pedidoCreado}
          total={cotCreada.total}
          clienteNombre={cotCreada.clienteNombre}
          nivelNombre={cotCreada.nivelNombre}
        />
      </>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Pantalla: cotizacion registrada (solo cotizar)
  // ══════════════════════════════════════════════════════════════════════
  if (cotCreada) {
    return (
      <>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:16 }}>Cotizacion registrada</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>Folio {cotCreada.folio}</div>
          </div>
          <button className="btn btn-primary" onClick={nuevaCotizacion}>+ Nueva cotizacion</button>
        </div>
        <div className="alert alert-success">✅ Cotizacion guardada correctamente con folio {cotCreada.folio}.</div>
        <TicketMaquila cotizacion={cotCreada} />
      </>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Formulario principal (mismo layout que vidrio)
  // ══════════════════════════════════════════════════════════════════════
  return (
    <>
      {saveError && <div className="alert alert-error">❌ {saveError}</div>}

      <div className="venta-grid">

        {/* ── Columna izquierda ── */}
        <div>

          {/* Datos de la cotizacion */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight:600, marginBottom:12, fontSize:15 }}>Datos de la cotizacion</div>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label required">Nivel de precio</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
                  {nivelesPrecio.filter(n => !n.es_hoja_completa).map(n => {
                    const activo = nivelId === String(n.id_nivel_precio)
                    return (
                      <button key={n.id_nivel_precio} type="button"
                        onClick={() => setNivelId(String(n.id_nivel_precio))}
                        disabled={!!cotizacion}
                        style={{
                          padding:'7px 14px', borderRadius:8, fontSize:14, cursor: cotizacion ? 'not-allowed' : 'pointer',
                          border:`2px solid ${activo ? 'var(--accent)' : 'var(--border)'}`,
                          background: activo ? 'var(--accent)' : 'white',
                          color: activo ? 'white' : 'var(--text)',
                          fontWeight: activo ? 700 : 400,
                          transition:'all 0.15s',
                          opacity: cotizacion ? 0.6 : 1,
                        }}
                      >
                        {n.nombre}
                      </button>
                    )
                  })}
                </div>
                {cotizacion && (
                  <div className="form-hint">El nivel no se puede cambiar una vez iniciada la cotizacion</div>
                )}
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Cliente (opcional)</label>
                <select className="form-select" value={clienteId}
                  onChange={e => setClienteId(e.target.value)}
                  disabled={!!cotizacion}>
                  <option value="">-- Mostrador --</option>
                  {clientes.filter(c => c.activo !== false).map(c => (
                    <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Calculadora */}
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, marginBottom:14, fontSize:15 }}>Calculadora</div>

            {/* Notación */}
            <div className="form-group">
              <label className="form-label required">Medida</label>
              <input
                className={`form-input cot-calc-input${notError ? ' error' : ''}`}
                value={notacion}
                onChange={e => { setNotacion(e.target.value); setNotError('') }}
                placeholder="Ej. 3-22x45  o  1-30.5x60.2"
                inputMode="text"
                onKeyDown={e => e.key === 'Enter' && handleAgregarPartida()}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
              />
              {notError ? (
                <div className="form-error">{notError}</div>
              ) : (
                <div className="form-hint">Formato: {'{piezas}'}-{'{largo}'}x{'{ancho}'} en centimetros</div>
              )}
            </div>

            {/* Descripcion */}
            <div className="form-group">
              <label className="form-label">Descripcion (opcional)</label>
              <input className="form-input" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                placeholder="Ej. Marco izquierdo, puerta principal..." />
            </div>

            {/* Procesos (chips igual que vidrio) */}
            {activos.length > 0 && (
              <div className="form-group">
                <label className="form-label">Procesos</label>
                <div className="procesos-chips">
                  {activos.map(proc => {
                    const sel     = procesosSelec.find(p => p.id_proceso === proc.id_proceso)
                    const unidad  = (proc.unidad_cobro?.nombre ?? '').toLowerCase()
                    const esPorM2 = !(unidad.includes('pza') || unidad.includes('pieza'))
                    return (
                      <div key={proc.id_proceso} style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <label style={{
                          display:'flex', alignItems:'center', gap:6,
                          padding:'6px 12px', borderRadius:20,
                          border:`1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                          background: sel ? '#ede9fe' : 'white',
                          cursor:'pointer', fontSize:15, transition:'all 0.15s',
                        }}>
                          <input type="checkbox" checked={!!sel} onChange={() => toggleProceso(proc.id_proceso)} style={{ display:'none' }} />
                          {sel ? '✅' : '⬜'} {proc.nombre} ({proc.unidad_cobro?.nombre ?? ''})
                        </label>
                        {sel && !esPorM2 && (
                          <input type="number" min="1" step="1"
                            value={sel.cantidad}
                            onChange={e => setProcesoQty(proc.id_proceso, e.target.value)}
                            placeholder="cant"
                            className="form-input"
                            style={{ width:72, margin:0, padding:'5px 8px', fontSize:14 }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Preview en vivo */}
            {metros2Preview !== null && !parsed.error && (
              <div className="cot-preview-row">
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))', gap:10 }}>
                  {[
                    ['Piezas',    parsed.piezas,                   ''],
                    ['Medida',    `${parsed.largo}×${parsed.ancho}`, ''],
                    ['Total m²',  metros2Preview.toFixed(4),        ''],
                    ['Subtotal',  `$${subtotalPreview.toFixed(2)}`,  'var(--accent)'],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:2 }}>{label}</div>
                      <div style={{ fontWeight:700, fontSize:18, color: color || undefined }}>{val}</div>
                    </div>
                  ))}
                </div>

                {previewProcesos.length > 0 && (
                  <div style={{ marginTop:8, borderTop:'1px solid var(--border)', paddingTop:8 }}>
                    {previewProcesos.map((pc, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text-muted)' }}>
                        <span>
                          + {pc.nombre}
                          {pc.esPorM2
                            ? ` (${pc.cantidad.toFixed(4)} m² × $${pc.precio_unitario.toFixed(2)})`
                            : ` (${pc.cantidad} × $${pc.precio_unitario.toFixed(2)})`}
                        </span>
                        <span>${pc.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!nivelId && notacion && (
              <div className="alert alert-warning" style={{ marginTop:8 }}>⚠️ Selecciona un nivel de precio para calcular</div>
            )}

            <button
              className="btn btn-primary"
              style={{ width:'100%', justifyContent:'center', marginTop:12 }}
              onClick={handleAgregarPartida}
              disabled={agregando || !notacion || !nivelId}
            >
              {agregando ? 'Agregando...' : '➕ Agregar partida'}
            </button>
          </div>

          {/* Lista de partidas */}
          {partidas.length > 0 ? (
            <div>
              <div style={{ fontWeight:600, marginBottom:10, fontSize:15 }}>
                Partidas ({partidas.length})
              </div>
              {partidas.map((p, i) => (
                <div key={p._key} className="cot-partida-item">
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:15 }}>
                      {p.cantidad} pza{p.cantidad > 1 ? 's' : ''} · {p.largo_cm}×{p.ancho_cm} cm · {p.metros2.toFixed(4)} m²
                    </div>
                    {p.descripcion && (
                      <div style={{ fontSize:13, color:'var(--text-muted)' }}>{p.descripcion}</div>
                    )}
                    {p.procesos?.length > 0 && (
                      <div style={{ marginTop:3 }}>
                        {p.procesos.map((pr, j) => (
                          <span key={j} style={{ fontSize:12, color:'var(--text-muted)', marginRight:8 }}>
                            + {pr.nombre}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontWeight:700, fontSize:16, color:'var(--accent)', minWidth:80, textAlign:'right' }}>
                    ${p.subtotal.toFixed(2)}
                  </div>
                  <button
                    className="btn-icon danger"
                    onPointerDown={e => { e.preventDefault(); handleQuitarPartida(p, i) }}
                    disabled={eliminando === i}
                    title="Quitar"
                  >
                    {eliminando === i ? '...' : '✕'}
                  </button>
                </div>
              ))}
              <div className="venta-total-bar" style={{ marginTop:12 }}>
                <span>Total de la cotizacion</span>
                <strong>${totalGeneral.toFixed(2)}</strong>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔨</div>
              <h3>Sin partidas</h3>
              <p>Ingresa una medida y agrega piezas a procesar</p>
            </div>
          )}
        </div>

        {/* ── Columna derecha: resumen sticky ── */}
        <div className="venta-side-summary" style={{ position:'sticky', top:80 }}>
          <div className="card">
            <div style={{ fontWeight:600, fontSize:15, marginBottom:14 }}>Resumen</div>

            <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:6 }}>Nivel de precio</div>
            <div style={{ fontWeight:600, marginBottom:14 }}>
              {nivelSel
                ? <span className="badge badge-blue">{nivelSel.nombre}</span>
                : <span style={{ color:'var(--danger)', fontSize:13 }}>— Sin seleccionar —</span>}
            </div>

            {clienteSel && (
              <>
                <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:2 }}>Cliente</div>
                <div style={{ fontWeight:500, marginBottom:14 }}>{clienteSel.nombre}</div>
              </>
            )}

            <div className="divider" />

            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:14 }}>
              <span style={{ color:'var(--text-muted)' }}>Partidas</span>
              <span style={{ fontWeight:600 }}>{partidas.length}</span>
            </div>

            <div className="divider" />

            <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:700 }}>
              <span>Total</span>
              <span style={{ color:'var(--accent)' }}>${totalGeneral.toFixed(2)}</span>
            </div>

            <button
              className="btn btn-accent"
              style={{ width:'100%', marginTop:16, justifyContent:'center' }}
              onClick={() => { setShowModal(true); setModalError(null) }}
              disabled={partidas.length === 0 || !nivelId || finalizando}
            >
              📦 Convertir a pedido
            </button>
            <button
              className="btn btn-outline"
              style={{ width:'100%', marginTop:8, justifyContent:'center' }}
              onClick={handleFinalizar}
              disabled={partidas.length === 0 || !nivelId || finalizando}
            >
              {finalizando ? 'Guardando...' : '✓ Solo cotizar'}
            </button>
            <button
              className="btn btn-outline"
              style={{ width:'100%', marginTop:8, justifyContent:'center' }}
              onClick={() => setPartidas([])}
              disabled={partidas.length === 0}
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* ── Barra inferior móvil ── */}
      {partidas.length > 0 && (
        <div className="venta-mobile-bar">
          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase' }}>
              Total · {partidas.length} partida{partidas.length !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:'var(--accent)', lineHeight:1.1 }}>
              ${totalGeneral.toFixed(2)}
            </div>
          </div>
          <button className="btn btn-outline" style={{ justifyContent:'center' }}
            onClick={handleFinalizar} disabled={finalizando || !nivelId}>
            {finalizando ? '...' : '✓ Cotizar'}
          </button>
          <button className="btn btn-accent" style={{ flex:1, justifyContent:'center' }}
            onClick={() => { setShowModal(true); setModalError(null) }}
            disabled={!nivelId}>
            📦 Pedido
          </button>
        </div>
      )}

      {/* ── Modal: convertir a pedido ── */}
      {showModal && (() => {
        const antN = parseFloat(modalAnticipo) || 0
        return (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <div className="modal-title">Convertir a pedido — Maquila</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                    Total: ${totalGeneral.toFixed(2)}
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label required">Forma de pago</label>
                  <div style={{ display:'flex', gap:10, marginTop:6, flexWrap:'wrap' }}>
                    {[['LIQUIDADO','Liquidado','Pago completo'],['ANTICIPO','Anticipo','Pago parcial']].map(([val, label, desc]) => (
                      <label key={val} style={{
                        flex:1, minWidth:140, display:'flex', flexDirection:'column', gap:3,
                        padding:'10px 12px', borderRadius:8, cursor:'pointer',
                        border:`2px solid ${modalTipoPago === val ? 'var(--accent)' : 'var(--border)'}`,
                        background: modalTipoPago === val ? 'var(--accent-subtle, #ede9fe)' : 'white',
                      }} onClick={() => { setModalTipoPago(val); setModalAnticipo(''); setModalError(null) }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <input type="radio" name="maqFP" value={val} checked={modalTipoPago === val} onChange={() => {}} />
                          <span style={{ fontWeight:600, fontSize:14 }}>{label}</span>
                        </div>
                        <span style={{ fontSize:11, color:'var(--text-muted)', paddingLeft:20 }}>{desc}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {modalTipoPago === 'ANTICIPO' && (
                  <div className="form-group">
                    <label className="form-label required">Monto del anticipo ($)</label>
                    <input className="form-input" type="number" min="0" step="0.01"
                      value={modalAnticipo} onChange={e => { setModalAnticipo(e.target.value); setModalError(null) }}
                      placeholder="0.00" autoFocus />
                    {antN > 0 && antN < totalGeneral && (
                      <div className="form-hint">
                        Saldo pendiente: <strong>${(totalGeneral - antN).toFixed(2)}</strong>
                      </div>
                    )}
                  </div>
                )}
                {modalError && <div className="alert alert-error">❌ {modalError}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={converting}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleConvertir} disabled={converting}>
                  {converting ? 'Creando pedido...' : '📦 Confirmar pedido'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
