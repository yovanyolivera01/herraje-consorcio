import { useState, useMemo } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'
import { crearPedidoDirecto, getDetallePedido } from '../../lib/pedidosApi'

// ── Parser de notacion {piezas}-{largo}x{ancho} ───────────────────────────
function parseNotacion(texto) {
  if (!texto || !texto.trim()) return { error: 'Ingresa una medida (ej. 3-22x45)' }
  const limpio = texto.trim().replace(/\s/g, '')
  const match  = limpio.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)$/)
  if (!match) return { error: 'Formato invalido. Usa: {piezas}-{largo}x{ancho} — ej. 2-30x45' }
  const piezas = Number(match[1])
  const largo  = Number(match[2])
  const ancho  = Number(match[3])
  if (piezas <= 0) return { error: 'La cantidad de piezas debe ser mayor a 0' }
  if (largo  <= 0) return { error: 'El largo debe ser mayor a 0' }
  if (ancho  <= 0) return { error: 'El ancho debe ser mayor a 0' }
  return { piezas, largo, ancho }
}

// ── Ticket de venta directa ───────────────────────────────────────────────
function TicketVentaDirecta({ detalle }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>TEMPLADOS CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>
          {detalle.estado === 'ENTREGADO' ? 'COMPROBANTE DE VENTA' : 'PEDIDO DE VIDRIO'}
        </p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Folio:</span><strong>{detalle.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{detalle.fecha}</span></div>
      {detalle.cliente?.nombre && (
        <div className="ticket-row"><span>Cliente:</span><span>{detalle.cliente.nombre}</span></div>
      )}
      <div className="ticket-row"><span>Nivel:</span><span>{detalle.nivel?.nombre ?? '—'}</span></div>
      <hr className="ticket-divider" />

      {detalle.partidas.map((p, i) => (
        <div key={p.id} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 12 }}>
            {i + 1}. {p.clave_vidrio} — {p.largo_cm}×{p.ancho_cm} cm · {p.metros2.toFixed(4)} m²
          </div>
          <div className="ticket-row" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <span>${p.precio_m2_aplicado.toFixed(2)}/m²</span>
            <span>${p.subtotal_vidrio.toFixed(2)}</span>
          </div>
          {p.procesos.map((pr, j) => (
            <div key={j} className="ticket-row" style={{ fontSize: 11, paddingLeft: 10 }}>
              <span>+ {pr.nombre}</span>
              <span>${pr.subtotal.toFixed(2)}</span>
            </div>
          ))}
          <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
            <span>Subtotal</span>
            <span>${p.subtotal_partida.toFixed(2)}</span>
          </div>
        </div>
      ))}

      <hr className="ticket-divider" />
      <div className="ticket-total"><span>TOTAL</span><span>${detalle.total.toFixed(2)}</span></div>
      <div className="ticket-row" style={{ marginTop: 6 }}>
        <span>Forma de pago:</span>
        <span>{detalle.forma_pago === 'LIQUIDADO' ? 'Liquidado' : 'Anticipo'}</span>
      </div>
      {detalle.forma_pago === 'ANTICIPO' && (
        <>
          <div className="ticket-row">
            <span>Anticipo:</span>
            <span style={{ fontWeight: 600 }}>${detalle.anticipo.toFixed(2)}</span>
          </div>
          <div className="ticket-row">
            <span>Saldo pendiente:</span>
            <span style={{ fontWeight: 700, color: 'var(--danger)' }}>${detalle.saldo.toFixed(2)}</span>
          </div>
        </>
      )}
      <hr className="ticket-divider" />
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        {detalle.estado === 'ENTREGADO' ? '¡Gracias por su compra!' : 'Pedido pendiente de entrega.'}
      </div>
    </div>
  )
}

// ── Pagina Venta Directa ──────────────────────────────────────────────────
export default function VentaDirecta() {
  const {
    tiposVidrio, nivelesPrecio, clientes, procesos,
    getPrecioVidrio, getPrecioProceso,
  } = useCotizacion()

  // ── Cabecera ──────────────────────────────────────────────────────────────
  const [nivelId,   setNivelId]   = useState('')
  const [clienteId, setClienteId] = useState('')

  // ── Calculadora ───────────────────────────────────────────────────────────
  const [notacion,     setNotacion]     = useState('')
  const [notError,     setNotError]     = useState('')
  const [tipoVidrioId, setTipoVidrioId] = useState('')
  const [procesosSeleccionados, setProcesosSeleccionados] = useState([])

  // ── Lista de partidas ─────────────────────────────────────────────────────
  const [partidas, setPartidas] = useState([])

  // ── Pago ──────────────────────────────────────────────────────────────────
  const [tipoPago,    setTipoPago]    = useState('LIQUIDADO')
  const [anticipoStr, setAnticipoStr] = useState('')

  // ── Estado de guardado ────────────────────────────────────────────────────
  const [cobrandо,    setCobrandо]    = useState(false)
  const [saveError,   setSaveError]   = useState(null)
  const [pedidoCreado, setPedidoCreado] = useState(null)

  // ── Selects derivados ─────────────────────────────────────────────────────
  const nivelSeleccionado = nivelesPrecio.find(n => n.id_nivel_precio === Number(nivelId))
  const tipoSeleccionado  = tiposVidrio.find(t => t.id_tipo_vidrio === Number(tipoVidrioId))
  const tiposActivos      = tiposVidrio.filter(t => t.activo)
  const procesosActivos   = procesos.filter(p => p.activo)

  // ── Totales ───────────────────────────────────────────────────────────────
  const totalGeneral = partidas.reduce((s, p) => s + p.subtotal_partida, 0)
  const antNum       = parseFloat(anticipoStr) || 0
  const saldoCalc    = tipoPago === 'ANTICIPO' ? totalGeneral - antNum : 0

  // ── Preview en vivo ───────────────────────────────────────────────────────
  const preview = useMemo(() => {
    if (!notacion.trim() || !tipoVidrioId || !nivelId) return null
    const parsed = parseNotacion(notacion)
    if (parsed.error) return null

    const nivel = nivelesPrecio.find(n => n.id_nivel_precio === Number(nivelId))
    const tipo  = tiposVidrio.find(t => t.id_tipo_vidrio === Number(tipoVidrioId))
    if (!nivel || !tipo) return null

    const precio_m2 = getPrecioVidrio(tipo.id_tipo_vidrio, Number(nivelId))
    if (precio_m2 === null) return { sinPrecio: true, tipo }

    const esHojaCompleta   = false
    const largo            = parsed.largo
    const ancho            = parsed.ancho
    const metros2_total    = parsed.piezas * (largo * ancho) / 10000
    const subtotal_vidrio  = metros2_total * precio_m2

    let subtotal_procesos = 0
    const procesosCalc = procesosSeleccionados.map(sp => {
      const proc = procesosActivos.find(p => p.id_proceso === sp.id_proceso)
      if (!proc) return null
      const unidad    = proc.unidad_cobro?.nombre ?? ''
      const unidadLow = unidad.toLowerCase()
      const cantidad  = (unidadLow === 'm2' || unidadLow === 'm²' || unidadLow.includes('cuadrado'))
        ? metros2_total
        : ((largo + ancho) * 2 / 100) * parsed.piezas
      const precioNivel    = getPrecioProceso(proc.id_proceso, Number(nivelId), tipo?.espesor?.id_espesor ?? null)
      const precio_unitario = precioNivel !== null ? precioNivel : Number(proc.precio_unitario)
      const subtotal       = cantidad * precio_unitario
      subtotal_procesos   += subtotal
      return { id_proceso: proc.id_proceso, id_unidad_cobro: proc.id_unidad_cobro, nombre: proc.nombre, unidad, cantidad, precio_unitario, subtotal }
    }).filter(Boolean)

    return { piezas: parsed.piezas, largo, ancho, metros2_total, precio_m2, subtotal_vidrio, subtotal_procesos, subtotal_total: subtotal_vidrio + subtotal_procesos, esHojaCompleta, procesosCalc }
  }, [notacion, tipoVidrioId, nivelId, procesosSeleccionados, tiposVidrio, nivelesPrecio, procesosActivos, getPrecioVidrio, getPrecioProceso])

  // ── Cambio de cliente → auto-selecciona nivel ─────────────────────────────
  const handleClienteChange = (e) => {
    const cid = e.target.value
    setClienteId(cid)
    if (cid) {
      const cl = clientes.find(c => c.id_cliente === Number(cid))
      if (cl?.id_nivel_precio) setNivelId(String(cl.id_nivel_precio))
    }
  }

  // ── Agregar partida ───────────────────────────────────────────────────────
  const handleAgregarPartida = () => {
    const parsed = parseNotacion(notacion)
    if (parsed.error)  { setNotError(parsed.error); return }
    if (!tipoVidrioId) { setNotError('Selecciona un tipo de vidrio'); return }
    if (!nivelId)      { setNotError('Selecciona un nivel de precio'); return }
    if (!preview || preview.sinPrecio) { setNotError('No hay precio configurado para este tipo y nivel'); return }

    const nivel = nivelesPrecio.find(n => n.id_nivel_precio === Number(nivelId))
    const largo = parsed.largo
    const ancho = parsed.ancho

    setPartidas(prev => [...prev, {
      id_tipo_vidrio:     Number(tipoVidrioId),
      tipoClaveLabel:     tipoSeleccionado.clave,
      piezas:             parsed.piezas,
      largo_cm:           largo,
      ancho_cm:           ancho,
      metros2:            preview.metros2_total,
      precio_m2_aplicado: preview.precio_m2,
      subtotal_vidrio:    preview.subtotal_vidrio,
      subtotal_procesos:  preview.subtotal_procesos,
      subtotal_partida:   preview.subtotal_total,
      es_hoja_completa:   preview.esHojaCompleta,
      procesos:           preview.procesosCalc,
    }])
    setNotacion('')
    setNotError('')
    setProcesosSeleccionados([])
  }

  const toggleProceso = (proc) => {
    setProcesosSeleccionados(prev => {
      const existe = prev.find(p => p.id_proceso === proc.id_proceso)
      return existe ? prev.filter(p => p.id_proceso !== proc.id_proceso) : [...prev, { id_proceso: proc.id_proceso }]
    })
  }

  const quitarPartida = (idx) => setPartidas(prev => prev.filter((_, i) => i !== idx))

  // ── Cobrar ────────────────────────────────────────────────────────────────
  const handleCobrar = async () => {
    if (!nivelId)          { setSaveError('Selecciona un nivel de precio'); return }
    if (!partidas.length)  { setSaveError('Agrega al menos una partida'); return }
    if (tipoPago === 'ANTICIPO') {
      if (isNaN(antNum) || antNum <= 0) { setSaveError('Ingresa un monto de anticipo valido'); return }
      if (antNum >= totalGeneral)       { setSaveError('El anticipo debe ser menor al total'); return }
    }
    setCobrandо(true)
    setSaveError(null)
    try {
      const idPedido = await crearPedidoDirecto({
        id_cliente:      clienteId ? Number(clienteId) : null,
        id_nivel_precio: Number(nivelId),
        partidas,
        tipo_pago:       tipoPago,
        monto_anticipo:  tipoPago === 'LIQUIDADO' ? totalGeneral : antNum,
      })
      const detalle = await getDetallePedido(idPedido)
      setPedidoCreado(detalle)
    } catch (err) {
      setSaveError(err.message || 'Error al registrar la venta')
    } finally {
      setCobrandо(false)
    }
  }

  const nueva = () => {
    setPedidoCreado(null)
    setPartidas([])
    setNivelId('')
    setClienteId('')
    setNotacion('')
    setTipoVidrioId('')
    setProcesosSeleccionados([])
    setTipoPago('LIQUIDADO')
    setAnticipoStr('')
    setSaveError(null)
    window.scrollTo(0, 0)
  }

  // ── Pantalla de ticket ────────────────────────────────────────────────────
  if (pedidoCreado) {
    return (
      <>
        <div className="page-header">
          <div>
            <div className="page-title">Venta registrada — {pedidoCreado.folio}</div>
            <div className="page-subtitle" style={{ color: pedidoCreado.estado === 'ENTREGADO' ? 'var(--success)' : 'var(--warning)' }}>
              {pedidoCreado.estado === 'ENTREGADO' ? 'Liquidado · Entregado al momento' : 'Pendiente de entrega'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => window.print()}>🖨️ Imprimir</button>
            <button className="btn btn-primary" onClick={nueva}>+ Nueva venta</button>
          </div>
        </div>
        <div className="page-body">
          <div className="alert alert-success">
            ✅ Pedido <strong>{pedidoCreado.folio}</strong> registrado correctamente.
          </div>
          <TicketVentaDirecta detalle={pedidoCreado} />
        </div>
      </>
    )
  }

  // ── Formulario principal ──────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Venta Directa</div>
          <div className="page-subtitle">Sin cotización previa</div>
        </div>
      </div>

      <div className="page-body">

        {/* ── Cabecera: cliente y nivel ── */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Cliente</label>
              <select className="form-input" value={clienteId} onChange={handleClienteChange}>
                <option value="">Mostrador</option>
                {clientes.map(c => (
                  <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label required">Nivel de precio</label>
              <select
                className="form-input"
                value={nivelId}
                onChange={e => setNivelId(e.target.value)}
              >
                <option value="">— Selecciona —</option>
                {nivelesPrecio.map(n => (
                  <option key={n.id_nivel_precio} value={n.id_nivel_precio}>{n.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Calculadora ── */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--text-muted)' }}>
            Agregar pieza
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label required">Tipo de vidrio</label>
              <select
                className="form-input"
                value={tipoVidrioId}
                onChange={e => { setTipoVidrioId(e.target.value); setNotError('') }}
              >
                <option value="">— Selecciona —</option>
                {tiposActivos.map(t => (
                  <option key={t.id_tipo_vidrio} value={t.id_tipo_vidrio}>{t.clave}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label required">Medida (piezas-largoxancho)</label>
              <input
                className="form-input"
                type="text"
                placeholder="ej. 2-60x90"
                value={notacion}
                onChange={e => { setNotacion(e.target.value); setNotError('') }}
                onKeyDown={e => e.key === 'Enter' && handleAgregarPartida()}
              />
            </div>
          </div>

          {/* Procesos */}
          {procesosActivos.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                Procesos adicionales:
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {procesosActivos.map(proc => {
                  const sel = procesosSeleccionados.some(p => p.id_proceso === proc.id_proceso)
                  return (
                    <button
                      key={proc.id_proceso}
                      type="button"
                      className={`btn btn-sm ${sel ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => toggleProceso(proc)}
                    >
                      {proc.nombre}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Preview */}
          {preview && !preview.sinPrecio && (
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>{preview.piezas} pza{preview.piezas > 1 ? 's' : ''} · {preview.metros2_total.toFixed(4)} m²</span>
              <span style={{ color: 'var(--text-muted)' }}>${preview.precio_m2.toFixed(2)}/m²</span>
              {preview.subtotal_procesos > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>proc. ${preview.subtotal_procesos.toFixed(2)}</span>
              )}
              <span style={{ fontWeight: 700, color: 'var(--accent)', marginLeft: 'auto' }}>
                ${preview.subtotal_total.toFixed(2)}
              </span>
            </div>
          )}
          {preview?.sinPrecio && (
            <div className="alert alert-warning" style={{ marginBottom: 12, padding: '8px 12px' }}>
              ⚠️ Sin precio configurado para {preview.tipo.clave} en este nivel.
            </div>
          )}

          {notError && <div className="alert alert-error" style={{ marginBottom: 10, padding: '8px 12px' }}>❌ {notError}</div>}

          <button
            className="btn btn-outline"
            style={{ width: '100%' }}
            onClick={handleAgregarPartida}
            disabled={!nivelId || !tipoVidrioId || !notacion.trim()}
          >
            + Agregar pieza
          </button>
        </div>

        {/* ── Lista de partidas ── */}
        {partidas.length > 0 && (
          <div className="table-container" style={{ marginBottom: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Vidrio</th>
                  <th>Medida</th>
                  <th>m²</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {partidas.map((p, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{p.tipoClaveLabel}</td>
                    <td style={{ fontSize: 13 }}>
                      {p.piezas} pza{p.piezas > 1 ? 's' : ''} · {p.largo_cm}×{p.ancho_cm} cm
                    </td>
                    <td style={{ fontSize: 13 }}>{p.metros2.toFixed(4)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                      ${p.subtotal_partida.toFixed(2)}
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => quitarPartida(i)} title="Quitar">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
              Total: ${totalGeneral.toFixed(2)}
            </div>
          </div>
        )}

        {/* ── Sección de cobro ── */}
        {partidas.length > 0 && (
          <div className="card" style={{ border: '2px solid var(--accent)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--accent)' }}>
              Cobro
            </div>

            {/* Selector de tipo de pago */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              {[
                ['LIQUIDADO', 'Liquidado', 'Pago completo al momento'],
                ['ANTICIPO',  'Anticipo',  'Pago parcial — queda pendiente'],
              ].map(([val, label, desc]) => (
                <label
                  key={val}
                  style={{
                    flex: 1, minWidth: 160,
                    display: 'flex', flexDirection: 'column', gap: 4,
                    cursor: 'pointer', padding: '12px 14px',
                    borderRadius: 10, border: `2px solid ${tipoPago === val ? 'var(--accent)' : 'var(--border)'}`,
                    background: tipoPago === val ? 'var(--accent-subtle, rgba(99,102,241,0.06))' : 'var(--bg)',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="radio" name="tipoPago" value={val}
                      checked={tipoPago === val}
                      onChange={() => { setTipoPago(val); setAnticipoStr(''); setSaveError(null) }}
                    />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 22 }}>{desc}</span>
                </label>
              ))}
            </div>

            {tipoPago === 'ANTICIPO' && (
              <div className="form-group">
                <label className="form-label required">Monto del anticipo ($)</label>
                <input
                  className="form-input"
                  type="number" min="0" step="0.01"
                  placeholder="0.00"
                  value={anticipoStr}
                  onChange={e => { setAnticipoStr(e.target.value); setSaveError(null) }}
                  style={{ maxWidth: 220 }}
                />
                {antNum > 0 && antNum < totalGeneral && (
                  <div className="form-hint">
                    Saldo pendiente: <strong>${saldoCalc.toFixed(2)}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Resumen de pago */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
                <div className="stat-label">Total venta</div>
                <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>${totalGeneral.toFixed(2)}</div>
              </div>
              {tipoPago === 'ANTICIPO' && antNum > 0 && antNum < totalGeneral && (
                <>
                  <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
                    <div className="stat-label">Anticipo</div>
                    <div className="stat-value" style={{ fontSize: 18 }}>${antNum.toFixed(2)}</div>
                  </div>
                  <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
                    <div className="stat-label">Saldo pendiente</div>
                    <div className="stat-value" style={{ fontSize: 18, color: 'var(--danger)' }}>${saldoCalc.toFixed(2)}</div>
                  </div>
                </>
              )}
            </div>

            {saveError && <div className="alert alert-error" style={{ marginBottom: 12 }}>❌ {saveError}</div>}

            <button
              className="btn btn-primary"
              style={{ width: '100%', fontSize: 15, padding: '12px 0' }}
              onClick={handleCobrar}
              disabled={cobrandо}
            >
              {cobrandо ? 'Registrando...' : tipoPago === 'LIQUIDADO' ? `💰 Cobrar $${totalGeneral.toFixed(2)}` : `💰 Cobrar anticipo $${antNum > 0 ? antNum.toFixed(2) : '0.00'}`}
            </button>
          </div>
        )}

      </div>
    </>
  )
}
