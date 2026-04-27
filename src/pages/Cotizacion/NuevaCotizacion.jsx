import { useState, useMemo } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'
import { crearPedidoDirecto, getDetallePedido } from '../../lib/pedidosApi'
import { printTicketVidrio } from '../../utils/ticket'

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
        <h2>TEMPLADOS CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>ARTE EN VIDRIO</p>
        <p style={{ fontWeight: 700 }}>Pedido vidrio</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Folio:</span><strong>{cotizacion.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{new Date().toLocaleDateString('es-MX')}</span></div>
      {cotizacion.clienteNombre && (
        <div className="ticket-row"><span>Cliente:</span><span>{cotizacion.clienteNombre}</span></div>
      )}
      <div className="ticket-row"><span>Nivel:</span><span>{cotizacion.nivelNombre}</span></div>
      <hr className="ticket-divider" />
      {cotizacion.partidas.map((p, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
            <span>{p.piezas} pza{p.piezas > 1 ? 's' : ''} — {p.tipoClaveLabel} · {p.largo_cm}×{p.ancho_cm}</span>
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

// ── Ticket de pedido (post-conversión) ───────────────────────────────────
function TicketPedidoRapido({ detalle }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>TEMPLADOS CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>ARTE EN VIDRIO</p>
        <p style={{ fontWeight: 700 }}>Pedido vidrio</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Pedido:</span><strong>{detalle.folio}</strong></div>
      {detalle.id_cotizacion && (
        <div className="ticket-row"><span>Cotizacion:</span><span>COT-{String(detalle.id_cotizacion).padStart(5,'0')}</span></div>
      )}
      <div className="ticket-row"><span>Fecha:</span><span>{detalle.fecha}</span></div>
      <div className="ticket-row"><span>Cliente:</span><span>{detalle.cliente?.nombre ?? 'Mostrador'}</span></div>
      <hr className="ticket-divider" />
      {detalle.partidas.map((p) => (
        <div key={p.id} style={{ marginBottom: 8 }}>
          <div className="ticket-row" style={{ fontWeight:600, fontSize:12 }}>
            <span>{p.cantidad} pza{p.cantidad !== 1 ? 's' : ''} — {p.clave_vidrio} · {p.largo_cm}×{p.ancho_cm}</span>
            <span>${p.subtotal_vidrio.toFixed(2)}</span>
          </div>
          {p.procesos.map((pr, j) => (
            <div key={j} className="ticket-row" style={{ fontSize:11, paddingLeft:10 }}>
              <span>+ {pr.nombre}</span>
              <span>${pr.subtotal.toFixed(2)}</span>
            </div>
          ))}
          <div className="ticket-row" style={{ fontWeight:600, fontSize:12 }}>
            <span>Subtotal</span>
            <span>${p.subtotal_partida.toFixed(2)}</span>
          </div>
        </div>
      ))}
      <hr className="ticket-divider" />
      <div className="ticket-total"><span>TOTAL</span><span>${detalle.total.toFixed(2)}</span></div>
      <div className="ticket-row" style={{ marginTop:6 }}>
        <span>Forma de pago:</span>
        <span>{detalle.forma_pago === 'LIQUIDADO' ? 'Liquidado' : 'Anticipo'}</span>
      </div>
      {detalle.forma_pago === 'ANTICIPO' && (
        <>
          <div className="ticket-row">
            <span>Anticipo:</span>
            <span style={{ fontWeight:600 }}>${detalle.anticipo.toFixed(2)}</span>
          </div>
          <div className="ticket-row">
            <span>Saldo pendiente:</span>
            <span style={{ fontWeight:700, color:'var(--danger)' }}>${detalle.saldo.toFixed(2)}</span>
          </div>
        </>
      )}
      <hr className="ticket-divider" />
      <div style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', marginTop:8 }}>
        {detalle.estado === 'ENTREGADO' ? '¡Gracias por su compra!' : 'Pedido pendiente de entrega.'}
      </div>
    </div>
  )
}

// ── Pagina Nueva Cotizacion ───────────────────────────────────────────────
export default function NuevaCotizacion() {
  const {
    tiposVidrio, nivelesPrecio, clientes, procesos,
    getPrecioVidrio, getPrecioProceso,
    iniciarCotizacion, agregarPartida, finalizarCotizacion, // usados solo por "Solo cotizar"
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

  // ── Conversion rápida a pedido (post-cotización) ─────────────────────────
  const [formaPago,       setFormaPago]       = useState('LIQUIDADO')
  const [anticipoStr,     setAnticipoStr]     = useState('')
  const [convertiendo,    setConvertiendo]    = useState(false)
  const [errorConversion, setErrorConversion] = useState(null)
  const [pedidoCreado,    setPedidoCreado]    = useState(null)

  // ── Modal "cotizar + convertir" directo ───────────────────────────────────
  const [showPedidoModal,     setShowPedidoModal]     = useState(false)
  const [modalFormaPago,      setModalFormaPago]      = useState('LIQUIDADO')
  const [modalAnticipoStr,    setModalAnticipoStr]    = useState('')
  const [modalError,          setModalError]          = useState(null)
  const [modalConvertiendo,   setModalConvertiendo]   = useState(false)

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

    const esHojaCompleta = false
    const largo = parsed.largo
    const ancho  = parsed.ancho

    const metros2_pieza   = (largo * ancho) / 10000
    const metros2_total   = parsed.piezas * metros2_pieza
    const subtotal_vidrio = metros2_total * precio_m2

    // Calcular procesos seleccionados
    let subtotal_procesos = 0
    const procesosCalc = procesosSeleccionados.map(sp => {
      const proc = procesosActivos.find(p => p.id_proceso === sp.id_proceso)
      if (!proc) return null
      const unidad = proc.unidad_cobro?.nombre ?? ''
      const unidadLow = unidad.toLowerCase()
      let cantidad
      if (unidadLow === 'm2' || unidadLow === 'm²' || unidadLow.includes('cuadrado')) {
        // Cobrar por metro cuadrado
        cantidad = metros2_total
      } else {
        // Cobrar por metro lineal: perímetro (largo + ancho) × 2, convertido de cm a metros, × piezas
        cantidad = ((largo + ancho) * 2 / 100) * parsed.piezas
      }
      // Precio por nivel+espesor primero; si no hay, usa el precio base del proceso
      const precioNivel = getPrecioProceso(proc.id_proceso, Number(nivelId), tipo?.espesor?.id_espesor ?? null)
      const precio_unitario = precioNivel !== null ? precioNivel : Number(proc.precio_unitario)
      const subtotal = cantidad * precio_unitario
      subtotal_procesos += subtotal
      return { id_proceso: proc.id_proceso, id_unidad_cobro: proc.id_unidad_cobro, nombre: proc.nombre, unidad, cantidad, precio_unitario, subtotal }
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
  }, [notacion, tipoVidrioId, nivelId, procesosSeleccionados, tiposVidrio, nivelesPrecio, procesosActivos, getPrecioVidrio, getPrecioProceso])

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
    const largo = parsed.largo
    const ancho  = parsed.ancho

    const nuevaPartida = {
      _key:              Date.now() + Math.random(),
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
      es_hoja_completa:  preview.esHojaCompleta,
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
  const quitarPartida = (idx) => {
    requestAnimationFrame(() => {
      setPartidas(prev => prev.filter((_, i) => i !== idx))
    })
  }

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
      observaciones:   null,
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
      id:            cot.id_cotizacion,
      folio:         cot.folio,
      clienteNombre: clienteSeleccionado?.nombre ?? null,
      nivelNombre:   nivelSeleccionado?.es_hoja_completa ? 'POR HOJA' : (nivelSeleccionado?.nombre ?? ''),
      observaciones: null,
      partidas:      partidas,
      total:         totalGeneral,
    })
  }

  const handleConvertirPedido = async () => {
    if (formaPago === 'ANTICIPO') {
      const n = parseFloat(anticipoStr)
      if (isNaN(n) || n <= 0)       { setErrorConversion('Ingresa un monto de anticipo valido'); return }
      if (n >= cotCreada.total)     { setErrorConversion('El anticipo debe ser menor al total'); return }
    }
    setConvertiendo(true)
    setErrorConversion(null)
    try {
      const monto    = formaPago === 'LIQUIDADO' ? cotCreada.total : parseFloat(anticipoStr)
      const idPedido = await convertirCotizacionAPedido(cotCreada.id, formaPago, monto)
      const detalle  = await getDetallePedido(idPedido)
      setPedidoCreado(detalle)
    } catch (err) {
      setErrorConversion(err.message || 'Error al convertir el pedido')
    } finally {
      setConvertiendo(false)
    }
  }

  // Crea el pedido directamente sin pasar por cotización
  const handleCotizarYConvertir = async () => {
    const antN = parseFloat(modalAnticipoStr) || 0
    if (!nivelId)         { setModalError('Selecciona un nivel de precio'); return }
    if (!partidas.length) { setModalError('Agrega al menos una partida'); return }
    if (modalFormaPago === 'ANTICIPO') {
      if (antN <= 0)            { setModalError('Ingresa un monto de anticipo valido'); return }
      if (antN >= totalGeneral) { setModalError('El anticipo debe ser menor al total'); return }
    }
    setModalConvertiendo(true)
    setModalError(null)
    try {
      const monto    = modalFormaPago === 'LIQUIDADO' ? totalGeneral : antN
      const idPedido = await crearPedidoDirecto({
        id_cliente:      clienteId ? Number(clienteId) : null,
        id_nivel_precio: Number(nivelId),
        partidas,
        tipo_pago:       modalFormaPago,
        monto_anticipo:  monto,
      })
      const detalle = await getDetallePedido(idPedido)
      setShowPedidoModal(false)
      setPedidoCreado(detalle)
      setCotCreada({ folio: null, clienteNombre: clienteSeleccionado?.nombre ?? null, partidas, total: totalGeneral })
    } catch (err) {
      setModalError(err.message || 'Error al crear el pedido')
    } finally {
      setModalConvertiendo(false)
    }
  }

  const nuevaCotizacion = () => {
    setCotCreada(null)
    setPedidoCreado(null)
    setFormaPago('LIQUIDADO')
    setAnticipoStr('')
    setErrorConversion(null)
    setPartidas([])
    setNivelId('')
    setClienteId('')
    setObservaciones('')
    setNotacion('')
    setProcesosSeleccionados([])
    setSaveError(null)
    setShowPedidoModal(false)
    setModalFormaPago('LIQUIDADO')
    setModalAnticipoStr('')
    setModalError(null)
    setModalConvertiendo(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // ── Pantalla de ticket ────────────────────────────────────────────────────
  if (cotCreada) {
    // Si ya se convirtió, mostrar ticket de pedido
    if (pedidoCreado) {
      return (
        <>
          <div className="page-header">
            <div>
              <div className="page-title">Pedido creado — {pedidoCreado.folio}</div>
              <div className="page-subtitle" style={{ color: pedidoCreado.estado === 'ENTREGADO' ? 'var(--success)' : 'var(--warning)' }}>
                {pedidoCreado.estado === 'ENTREGADO' ? 'Liquidado · Entregado al momento' : 'Pendiente de entrega'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => printTicketVidrio({
                tipo: 'pedido',
                folio: pedidoCreado.folio,
                foliosCot: pedidoCreado.id_cotizacion ? `COT-${String(pedidoCreado.id_cotizacion).padStart(5,'0')}` : null,
                fecha: pedidoCreado.fecha,
                hora: pedidoCreado.hora ?? '',
                clienteNombre: pedidoCreado.cliente?.nombre ?? 'Mostrador',
                nivelNombre: pedidoCreado.nivel?.es_hoja_completa ? 'POR HOJA' : (pedidoCreado.nivel?.nombre ?? ''),
                formaPago: pedidoCreado.forma_pago,
                anticipo: pedidoCreado.anticipo,
                saldo: pedidoCreado.saldo,
                saldo_cobrado: pedidoCreado.saldo_cobrado,
                esEntregado: pedidoCreado.estado === 'ENTREGADO',
                total: pedidoCreado.total,
                partidas: pedidoCreado.partidas.map(p => ({
                  piezas: p.cantidad, clave: p.clave_vidrio,
                  largo_cm: p.largo_cm, ancho_cm: p.ancho_cm,
                  subtotal_vidrio: p.subtotal_vidrio, procesos: p.procesos,
                  subtotal_partida: p.subtotal_partida,
                })),
              })}>🖨️ Imprimir</button>
              <button className="btn btn-primary" onClick={nuevaCotizacion}>+ Nueva cotizacion</button>
            </div>
          </div>
          <div className="page-body">
            <div className="alert alert-success">
              ✅ Pedido <strong>{pedidoCreado.folio}</strong> registrado correctamente.
            </div>
            <TicketPedidoRapido detalle={pedidoCreado} />
          </div>
        </>
      )
    }

    // Ticket de cotización + bloque de conversión rápida
    const antNum = parseFloat(anticipoStr) || 0
    return (
      <>
        <div className="page-header">
          <div>
            <div className="page-title">Cotizacion registrada</div>
            <div className="page-subtitle">Folio {cotCreada.folio}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => printTicketVidrio({
              tipo: 'cotizacion',
              folio: cotCreada.folio,
              fecha: new Date().toLocaleDateString('es-MX'),
              hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              clienteNombre: cotCreada.clienteNombre ?? 'Mostrador',
              nivelNombre: cotCreada.nivelNombre ?? '',
              esEntregado: false,
              total: cotCreada.partidas.reduce((s, p) => s + p.subtotal_partida, 0),
              partidas: cotCreada.partidas.map(p => ({
                piezas: p.piezas, clave: p.tipoClaveLabel,
                largo_cm: p.largo_cm, ancho_cm: p.ancho_cm,
                subtotal_vidrio: p.subtotal_vidrio, procesos: p.procesos ?? [],
                subtotal_partida: p.subtotal_partida,
              })),
            })}>🖨️ Imprimir</button>
            <button className="btn btn-primary" onClick={nuevaCotizacion}>+ Nueva cotizacion</button>
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
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline"
              onClick={handleFinalizar}
              disabled={saving || !nivelId}
            >
              {saving ? 'Guardando...' : `✓ Cotizar — $${totalGeneral.toFixed(2)}`}
            </button>
            <button
              className="btn btn-accent"
              onClick={() => { setShowPedidoModal(true); setModalError(null) }}
              disabled={saving || !nivelId}
            >
              📦 Convertir a pedido
            </button>
          </div>
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {nivelesPrecio.map(n => {
                      const activo = nivelId === String(n.id_nivel_precio)
                      return (
                        <button
                          key={n.id_nivel_precio}
                          type="button"
                          onClick={() => setNivelId(String(n.id_nivel_precio))}
                          style={{
                            padding: '7px 14px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
                            border: `2px solid ${activo ? 'var(--accent)' : 'var(--border)'}`,
                            background: activo ? 'var(--accent)' : 'white',
                            color: activo ? 'white' : 'var(--text)',
                            fontWeight: activo ? 700 : 400,
                            transition: 'all 0.15s',
                          }}
                        >
                          {n.es_hoja_completa ? 'POR HOJA' : n.nombre}
                        </button>
                      )
                    })}
                  </div>
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
                  inputMode="text"
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
                  <div className="procesos-chips">
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

                  {preview.procesosCalc.length > 0 && (
                    <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      {preview.procesosCalc.map((pc, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}>
                          <span>+ {pc.nombre} ({pc.cantidad.toFixed(2)} {pc.unidad} × ${pc.precio_unitario.toFixed(2)})</span>
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
                  <div key={p._key} className="cot-partida-item">
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
                              + {pr.nombre} ({pr.cantidad.toFixed(2)} {pr.unidad}): ${pr.subtotal.toFixed(2)}
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
                      onPointerDown={e => { e.preventDefault(); quitarPartida(i) }}
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
                  <span className="badge badge-blue">{nivelSeleccionado.es_hoja_completa ? 'POR HOJA' : nivelSeleccionado.nombre}</span>
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
                onClick={() => { setShowPedidoModal(true); setModalError(null) }}
                disabled={partidas.length === 0 || !nivelId || saving}
              >
                📦 Convertir a pedido
              </button>
              <button
                className="btn btn-outline"
                style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
                onClick={handleFinalizar}
                disabled={partidas.length === 0 || !nivelId || saving}
              >
                {saving ? 'Guardando...' : '✓ Solo cotizar'}
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

      {/* ── Modal: cotizar + convertir a pedido ── */}
      {showPedidoModal && (() => {
        const antN = parseFloat(modalAnticipoStr) || 0
        return (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPedidoModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <div className="modal-title">Convertir a pedido</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Total: ${totalGeneral.toFixed(2)}
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setShowPedidoModal(false)}>✕</button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label required">Forma de pago</label>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                    {[['LIQUIDADO', 'Liquidado', 'Pago completo · entrega inmediata'],
                      ['ANTICIPO',  'Anticipo',  'Pago parcial · queda pendiente']].map(([val, label, desc]) => (
                      <label
                        key={val}
                        style={{
                          flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 3,
                          padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                          border: `2px solid ${modalFormaPago === val ? 'var(--accent)' : 'var(--border)'}`,
                          background: modalFormaPago === val ? 'var(--accent-subtle, #ede9fe)' : 'white',
                        }}
                        onClick={() => { setModalFormaPago(val); setModalAnticipoStr(''); setModalError(null) }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="radio" name="modalFP" value={val} checked={modalFormaPago === val} onChange={() => {}} />
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 20 }}>{desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {modalFormaPago === 'ANTICIPO' && (
                  <div className="form-group">
                    <label className="form-label required">Monto del anticipo ($)</label>
                    <input
                      className="form-input"
                      type="number" min="0" step="0.01"
                      value={modalAnticipoStr}
                      onChange={e => { setModalAnticipoStr(e.target.value); setModalError(null) }}
                      placeholder="0.00"
                      autoFocus
                    />
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
                <button className="btn btn-outline" onClick={() => setShowPedidoModal(false)} disabled={modalConvertiendo}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleCotizarYConvertir} disabled={modalConvertiendo}>
                  {modalConvertiendo ? 'Creando pedido...' : '📦 Confirmar pedido'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
            className="btn btn-outline"
            style={{ justifyContent: 'center' }}
            onClick={handleFinalizar}
            disabled={saving || !nivelId}
          >
            {saving ? '...' : '✓ Cotizar'}
          </button>
          <button
            className="btn btn-accent"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => { setShowPedidoModal(true); setModalError(null) }}
            disabled={saving || !nivelId}
          >
            📦 Pedido
          </button>
        </div>
      )}
    </>
  )
}
