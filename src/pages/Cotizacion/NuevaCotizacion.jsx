import { useState, useMemo } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'
import { crearPedidoDirecto, getDetallePedido } from '../../lib/pedidosApi'
import { printTicketVidrio } from '../../utils/ticket'
import MaquilaSection from './_MaquilaSection'

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

// ── Tab selector ─────────────────────────────────────────────────────────
function ModoTab({ modo, onChangeModo }) {
  return (
    <div style={{ display:'flex', gap:6, marginBottom:16 }}>
      {[['vidrio','◻ Vidrio'],['maquila','🔨 Maquila']].map(([m, label]) => (
        <button key={m} onClick={() => onChangeModo(m)}
          style={{
            padding:'6px 16px', borderRadius:8, fontSize:13, cursor:'pointer', fontWeight:600,
            border:`2px solid ${modo===m ? 'var(--accent)' : 'var(--border)'}`,
            background: modo===m ? 'var(--accent)' : 'white',
            color: modo===m ? 'white' : 'var(--text)',
            transition:'all 0.15s',
          }}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Pagina Nueva Cotizacion ───────────────────────────────────────────────
export default function NuevaCotizacion() {
  const [modo, setModo] = useState('vidrio')

  const {
    tiposVidrio, nivelesPrecio, clientes, procesos, barrenos, saques,
    getPrecioVidrio, getPrecioProceso, getPrecioProcesoEspecial,
    getPreciosClienteRegistrado,
    iniciarCotizacion, agregarPartida, finalizarCotizacion, // usados solo por "Solo cotizar"
  } = useCotizacion()

  // ── Estado global de la cotizacion ──────────────────────────────────────
  const [nivelId,      setNivelId]      = useState('')
  const [clienteId,    setClienteId]    = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [preciosCli,   setPreciosCli]   = useState([])
  const [cargandoCli,  setCargandoCli]  = useState(false)

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

  // ── Barrenos y saque ──────────────────────────────────────────────────────
  const [barrenosSeleccionados, setBarrenosSeleccionados] = useState([]) // [{id_proceso, cantidad}]
  const [saqueId,               setSaqueId]               = useState('')

  // ── Precio manual para piezas pequeñas ───────────────────────────────────
  const [precioManual, setPrecioManual] = useState('')

  // ── UI ──────────────────────────────────────────────────────────────────
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState(null)

  // ── Selects derivados ────────────────────────────────────────────────────
  const nivelSeleccionado   = nivelesPrecio.find(n => n.id_nivel_precio === Number(nivelId))
  const clienteSeleccionado = clientes.find(c => c.id_cliente === Number(clienteId))
  const tipoSeleccionado    = tiposVidrio.find(t => t.id_tipo_vidrio === Number(tipoVidrioId))
  const tiposActivos        = tiposVidrio.filter(t => t.activo)
  const procesosActivos     = procesos.filter(p => p.activo)
  // Cuando hay precios especiales del cliente, no se requiere nivel de precio
  const usarPreciosCli      = Boolean(clienteId && preciosCli.length > 0)

  // ── Preview en vivo ──────────────────────────────────────────────────────
  const preview = useMemo(() => {
    if (!notacion.trim() || !tipoVidrioId) return null
    // Si hay cliente seleccionado, esperar a que carguen sus precios antes de calcular
    if (clienteId && cargandoCli) return null
    if (!usarPreciosCli && !nivelId) return null
    const parsed = parseNotacion(notacion)
    if (parsed.error) return null

    const tipo = tiposVidrio.find(t => t.id_tipo_vidrio === Number(tipoVidrioId))
    if (!tipo) return null

    const fallbackNivel = clienteSeleccionado?.id_nivel_precio ?? null

    // Helpers de precio según modo (cliente registrado vs. nivel general)
    const getPrecioVid = (id_tv) => {
      if (usarPreciosCli) {
        const c = preciosCli.find(p => p.id_tipo_vidrio === id_tv && (p.id_proceso ?? null) === null)
        if (c) return Number(c.precio_m2)
        return fallbackNivel ? getPrecioVidrio(id_tv, fallbackNivel) : null
      }
      return getPrecioVidrio(id_tv, Number(nivelId))
    }
    const getPrecioProc = (id_p, id_esp) => {
      if (usarPreciosCli) {
        const c = preciosCli.find(p => (p.id_tipo_vidrio ?? null) === null && p.id_proceso === id_p)
        if (c) return Number(c.precio_m2)
        return fallbackNivel ? getPrecioProceso(id_p, fallbackNivel, id_esp) : null
      }
      return getPrecioProceso(id_p, Number(nivelId), id_esp)
    }
    const getPrecioEsp = (id_p) => {
      if (usarPreciosCli) {
        const c = preciosCli.find(p => (p.id_tipo_vidrio ?? null) === null && p.id_proceso === id_p)
        if (c) return Number(c.precio_m2)
        return fallbackNivel ? getPrecioProcesoEspecial(id_p, fallbackNivel) : null
      }
      return getPrecioProcesoEspecial(id_p, Number(nivelId))
    }

    const precio_m2 = getPrecioVid(tipo.id_tipo_vidrio)
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
        cantidad = metros2_total
      } else {
        cantidad = ((largo + ancho) * 2 / 100) * parsed.piezas
      }
      const precioNivel = getPrecioProc(proc.id_proceso, tipo?.espesor?.id_espesor ?? null)
      const precio_unitario = precioNivel !== null ? precioNivel : Number(proc.precio_unitario)
      const subtotal = cantidad * precio_unitario
      subtotal_procesos += subtotal
      return { id_proceso: proc.id_proceso, id_unidad_cobro: proc.id_unidad_cobro, nombre: proc.nombre, unidad, cantidad, precio_unitario, subtotal }
    }).filter(Boolean)

    // Barrenos seleccionados
    barrenosSeleccionados.forEach(bs => {
      const proc = barrenos.find(b => b.id_proceso === bs.id_proceso)
      if (!proc || bs.cantidad <= 0) return
      const precio_unitario = getPrecioEsp(proc.id_proceso) ?? 0
      const subtotal = bs.cantidad * precio_unitario
      subtotal_procesos += subtotal
      procesosCalc.push({
        id_proceso:      proc.id_proceso,
        id_unidad_cobro: proc.id_unidad_cobro,
        nombre:          proc.nombre,
        unidad:          proc.unidad_cobro?.nombre ?? 'PZA',
        cantidad:        bs.cantidad,
        precio_unitario,
        subtotal,
      })
    })

    // Saque seleccionado
    if (saqueId) {
      const proc = saques.find(s => s.id_proceso === Number(saqueId))
      if (proc) {
        const precio_unitario = getPrecioEsp(proc.id_proceso) ?? 0
        subtotal_procesos += precio_unitario
        procesosCalc.push({
          id_proceso:      proc.id_proceso,
          id_unidad_cobro: proc.id_unidad_cobro,
          nombre:          proc.nombre,
          unidad:          proc.unidad_cobro?.nombre ?? 'SERV',
          cantidad:        1,
          precio_unitario,
          subtotal:        precio_unitario,
        })
      }
    }

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
  }, [notacion, tipoVidrioId, nivelId, usarPreciosCli, preciosCli, cargandoCli, clienteId, procesosSeleccionados, barrenosSeleccionados, saqueId,
      tiposVidrio, procesosActivos, barrenos, saques,
      getPrecioVidrio, getPrecioProceso, getPrecioProcesoEspecial]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manejo de cambio de cliente ───────────────────────────────────────────
  const handleClienteChange = (e) => {
    const cid = e.target.value
    setClienteId(cid)
    setPreciosCli([])
    if (cid) {
      const cl = clientes.find(c => c.id_cliente === Number(cid))
      setNivelId(cl?.id_nivel_precio ? String(cl.id_nivel_precio) : '')
      setCargandoCli(true)
      getPreciosClienteRegistrado(Number(cid))
        .then(data => setPreciosCli(data ?? []))
        .catch(() => setPreciosCli([]))
        .finally(() => setCargandoCli(false))
    } else {
      setNivelId('')
    }
  }

  // ── Agregar partida a la lista ────────────────────────────────────────────
  const handleAgregarPartida = () => {
    const parsed = parseNotacion(notacion)
    if (parsed.error) { setNotError(parsed.error); return }
    if (!tipoVidrioId) { setNotError('Selecciona un tipo de vidrio'); return }
    if (!nivelId && !usarPreciosCli) { setNotError('Selecciona un nivel de precio'); return }
    if (!preview || preview.sinPrecio) {
      setNotError('No hay precio configurado para este tipo y nivel')
      return
    }

    const nivel = nivelesPrecio.find(n => n.id_nivel_precio === Number(nivelId))
    const largo = parsed.largo
    const ancho  = parsed.ancho

    const esPequena   = preview.metros2_total / parsed.piezas <= 0.12 ||
                        (preview.metros2_total / parsed.piezas < 0.45 && preview.procesosCalc.length > 0)
    const manualNum   = esPequena && precioManual !== '' ? parseFloat(precioManual) : NaN
    const subtotalFin = (!isNaN(manualNum) && manualNum > 0) ? manualNum : preview.subtotal_total

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
      subtotal_partida:  subtotalFin,
      es_hoja_completa:  preview.esHojaCompleta,
      procesos:          preview.procesosCalc,
      precio_manual:     (!isNaN(manualNum) && manualNum > 0) ? manualNum : null,
    }

    setPartidas(prev => [...prev, nuevaPartida])
    setNotacion('')
    setNotError('')
    setPrecioManual('')
    setProcesosSeleccionados([])
    setBarrenosSeleccionados([])
    setSaqueId('')
  }

  // ── Toggle proceso en la seleccion ───────────────────────────────────────
  const toggleProceso = (proc) => {
    setProcesosSeleccionados(prev => {
      const existe = prev.find(p => p.id_proceso === proc.id_proceso)
      if (existe) return prev.filter(p => p.id_proceso !== proc.id_proceso)
      return [...prev, { id_proceso: proc.id_proceso }]
    })
  }

  // ── Barrenos ──────────────────────────────────────────────────────────────
  const toggleBarreno = (id_proceso) => {
    setBarrenosSeleccionados(prev => {
      const existe = prev.find(b => b.id_proceso === id_proceso)
      if (existe) return prev.filter(b => b.id_proceso !== id_proceso)
      return [...prev, { id_proceso, cantidad: 1 }]
    })
  }
  const updateBarrenoCantidad = (id_proceso, cantidad) => {
    setBarrenosSeleccionados(prev =>
      prev.map(b => b.id_proceso === id_proceso ? { ...b, cantidad: Math.max(1, cantidad || 1) } : b)
    )
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
    if (!nivelId && !usarPreciosCli) { setSaveError('Selecciona un nivel de precio'); return }
    if (!partidas.length) { setSaveError('Agrega al menos una partida'); return }
    setSaving(true)
    setSaveError(null)

    const nivelParaGuardar = usarPreciosCli
      ? (clienteSeleccionado?.id_nivel_precio ?? null)
      : Number(nivelId)

    // 1. Crear cabecera
    const { data: cot, error: cotErr } = await iniciarCotizacion({
      id_nivel_precio: nivelParaGuardar,
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
      nivelNombre:   usarPreciosCli ? 'Precio especial' : (nivelSeleccionado?.es_hoja_completa ? 'POR HOJA' : (nivelSeleccionado?.nombre ?? '')),
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
    if (!nivelId && !usarPreciosCli) { setModalError('Selecciona un nivel de precio'); return }
    if (!partidas.length) { setModalError('Agrega al menos una partida'); return }
    if (modalFormaPago === 'ANTICIPO') {
      if (antN <= 0)            { setModalError('Ingresa un monto de anticipo valido'); return }
      if (antN >= totalGeneral) { setModalError('El anticipo debe ser menor al total'); return }
    }
    setModalConvertiendo(true)
    setModalError(null)
    const nivelParaGuardar = usarPreciosCli
      ? (clienteSeleccionado?.id_nivel_precio ?? null)
      : Number(nivelId)
    try {
      const monto    = modalFormaPago === 'LIQUIDADO' ? totalGeneral : antN
      const idPedido = await crearPedidoDirecto({
        id_cliente:      clienteId ? Number(clienteId) : null,
        id_nivel_precio: nivelParaGuardar,
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
    setPreciosCli([])
    setObservaciones('')
    setNotacion('')
    setProcesosSeleccionados([])
    setBarrenosSeleccionados([])
    setSaqueId('')
    setSaveError(null)
    setShowPedidoModal(false)
    setModalFormaPago('LIQUIDADO')
    setModalAnticipoStr('')
    setModalError(null)
    setModalConvertiendo(false)
    window.scrollTo(0, 0)
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

  // ── Modo maquila ──────────────────────────────────────────────────────────
  if (modo === 'maquila') {
    return (
      <>
        <div className="page-header">
          <div className="page-title">Nueva Cotizacion</div>
        </div>
        <div className="page-body">
          <ModoTab modo={modo} onChangeModo={setModo} />
          <MaquilaSection />
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
        <ModoTab modo={modo} onChangeModo={setModo} />
        {saveError && <div className="alert alert-error">❌ {saveError}</div>}

        <div className="venta-grid">

          {/* ── Columna izquierda ── */}
          <div>

            {/* Cabecera de la cotizacion */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 15 }}>Datos de la cotizacion</div>
              <div className="form-row">
                {!usarPreciosCli && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label required">Nivel de precio</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {nivelesPrecio.map(n => {
                        const activo  = nivelId === String(n.id_nivel_precio)
                        const precioM2 = tipoVidrioId
                          ? getPrecioVidrio(Number(tipoVidrioId), n.id_nivel_precio)
                          : null
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
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                            }}
                          >
                            <span>{n.es_hoja_completa ? 'POR HOJA' : n.nombre}</span>
                            {precioM2 !== null && (
                              <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>
                                ${precioM2.toFixed(2)}/m²
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {usarPreciosCli && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Nivel de precio</label>
                    <div style={{
                      padding: '8px 12px', borderRadius: 8, background: '#ede9fe',
                      border: '1.5px solid var(--accent)', fontSize: 13, color: 'var(--accent)', fontWeight: 600,
                    }}>
                      ✓ Precios especiales del cliente ({preciosCli.length} configurados)
                    </div>
                  </div>
                )}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Cliente (opcional)</label>
                  <select
                    className="form-select"
                    value={clienteId}
                    onChange={handleClienteChange}
                    disabled={cargandoCli}
                  >
                    <option value="">-- Mostrador --</option>
                    {clientes.filter(c => c.activo).map(c => (
                      <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>
                    ))}
                  </select>
                  {cargandoCli && <div className="form-hint">Cargando precios...</div>}
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
                  onChange={e => { setNotacion(e.target.value); setNotError(''); setPrecioManual('') }}
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
                  onChange={e => { setTipoVidrioId(e.target.value); setPrecioManual('') }}
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

              {/* Barrenos */}
              {barrenos.length > 0 && (
                <div className="form-group">
                  <label className="form-label">🔩 Barrenos</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {barrenos.map(b => {
                      const sel = barrenosSeleccionados.find(bs => bs.id_proceso === b.id_proceso)
                      return (
                        <div key={b.id_proceso} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                            border: `1.5px solid ${sel ? '#d97706' : 'var(--border)'}`,
                            background: sel ? '#fef3c7' : 'white',
                            fontSize: 14, transition: 'all 0.15s', minWidth: 110,
                          }}>
                            <input type="checkbox" checked={!!sel} onChange={() => toggleBarreno(b.id_proceso)} style={{ display: 'none' }} />
                            {sel ? '✅' : '⬜'} {b.nombre}
                          </label>
                          {sel && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cant.:</span>
                              <input
                                type="number" min="1" step="1"
                                className="form-input"
                                style={{ width: 70, padding: '4px 8px', fontSize: 14, margin: 0 }}
                                value={sel.cantidad}
                                onChange={e => updateBarrenoCantidad(b.id_proceso, parseInt(e.target.value))}
                              />
                              {(nivelId || usarPreciosCli) && (
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                  ${(usarPreciosCli
                                    ? (preciosCli.find(p => (p.id_tipo_vidrio ?? null) === null && p.id_proceso === b.id_proceso)?.precio_m2
                                       ?? getPrecioProcesoEspecial(b.id_proceso, clienteSeleccionado?.id_nivel_precio ?? 0) ?? 0)
                                    : (getPrecioProcesoEspecial(b.id_proceso, Number(nivelId)) ?? 0)
                                  ).toFixed(2)}/pza
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Saque */}
              {saques.length > 0 && (
                <div className="form-group">
                  <label className="form-label">✂️ Saque</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                      border: `1.5px solid ${!saqueId ? '#10b981' : 'var(--border)'}`,
                      background: !saqueId ? '#d1fae5' : 'white',
                      fontSize: 14, transition: 'all 0.15s',
                    }}>
                      <input type="radio" name="saqueOpt" value="" checked={!saqueId} onChange={() => setSaqueId('')} style={{ display: 'none' }} />
                      {!saqueId ? '✅' : '⬜'} Sin saque
                    </label>
                    {saques.map(s => {
                      const sel = saqueId === String(s.id_proceso)
                      return (
                        <label key={s.id_proceso} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                          border: `1.5px solid ${sel ? '#10b981' : 'var(--border)'}`,
                          background: sel ? '#d1fae5' : 'white',
                          fontSize: 14, transition: 'all 0.15s',
                        }}>
                          <input type="radio" name="saqueOpt" value={s.id_proceso} checked={sel} onChange={() => setSaqueId(String(s.id_proceso))} style={{ display: 'none' }} />
                          {sel ? '✅' : '⬜'} {s.nombre}
                          {(nivelId || usarPreciosCli) && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 2 }}>
                              (${(usarPreciosCli
                                ? (preciosCli.find(p => (p.id_tipo_vidrio ?? null) === null && p.id_proceso === s.id_proceso)?.precio_m2
                                   ?? getPrecioProcesoEspecial(s.id_proceso, clienteSeleccionado?.id_nivel_precio ?? 0) ?? 0)
                                : (getPrecioProcesoEspecial(s.id_proceso, Number(nivelId)) ?? 0)
                              ).toFixed(2)})
                            </span>
                          )}
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

                  {/* Edición manual para piezas pequeñas */}
                  {(preview.metros2_total / preview.piezas <= 0.12 ||
                    (preview.metros2_total / preview.piezas < 0.45 && preview.procesosCalc.length > 0)) && (
                    <div style={{
                      marginTop: 10, padding: '10px 12px', borderRadius: 8,
                      background: '#fffbeb', border: '1.5px solid #f59e0b',
                    }}>
                      <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 6 }}>
                        ⚠️ Pieza pequeña — precio calculado: <strong>${preview.subtotal_total.toFixed(2)}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: '#78350f', marginBottom: 8 }}>
                        Puedes ajustar el precio final a cobrar:
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#78350f' }}>$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-input"
                          style={{ maxWidth: 140, margin: 0 }}
                          placeholder={preview.subtotal_total.toFixed(2)}
                          value={precioManual}
                          onChange={e => setPrecioManual(e.target.value)}
                        />
                        {precioManual && (
                          <button
                            type="button"
                            style={{ fontSize: 12, color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => setPrecioManual('')}
                          >
                            Restablecer
                          </button>
                        )}
                      </div>
                      {precioManual && Number(precioManual) > 0 && (
                        <div style={{ fontSize: 12, color: '#15803d', marginTop: 6, fontWeight: 600 }}>
                          ✓ Se cobrará: ${Number(precioManual).toFixed(2)}
                        </div>
                      )}
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

              {!nivelId && !usarPreciosCli && notacion && (
                <div className="alert alert-warning">⚠️ Selecciona un nivel de precio para calcular</div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                onClick={handleAgregarPartida}
                disabled={!notacion || !tipoVidrioId || (!nivelId && !usarPreciosCli)}
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
