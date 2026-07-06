import { useState, useMemo, useEffect } from 'react'
import { fmt5, r5 } from '../../lib/utils'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCotizacion } from '../../context/CotizacionContext'
import { useApp } from '../../context/AppContext'
import { crearPedidoDirecto, getDetallePedido, convertirCotizacionAPedido, decrementarInventarioDesdePartidas } from '../../lib/pedidosApi'
import { getPartidasExtra } from '../../lib/cotizacionApi'
import { venderProductoGeneral } from '../../lib/productosGeneralesApi'
import { printTicketVidrio } from '../../utils/ticket'

const TIPO_META = {
  VIDRIO:   { label: 'Vidrio',   bg: '#dbeafe', color: '#1d4ed8' },
  MAQUILA:  { label: 'Maquila',  bg: '#fef3c7', color: '#b45309' },
  PRODUCTO: { label: 'Herraje',  bg: '#dcfce7', color: '#15803d' },
}

// Convierte una partida del historial (formato DB) al formato interno del formulario
function convertirPartidaDesdeDB(p) {
  const piezas = Math.round(p.metros2 / ((p.largo_cm * p.ancho_cm) / 10000)) || 1
  return {
    _key:               Date.now() + Math.random(),
    tipo:               'VIDRIO',
    id_tipo_vidrio:     p.tipoVidrio?.id_tipo_vidrio,
    tipoClaveLabel:     p.tipoVidrio?.clave ?? '?',
    piezas,
    largo_cm:           p.largo_cm,
    ancho_cm:           p.ancho_cm,
    metros2:            p.metros2,
    precio_m2_aplicado: p.precio_m2_aplicado,
    subtotal_vidrio:    p.subtotal_vidrio,
    subtotal_procesos:  p.subtotal_procesos,
    subtotal_partida:   p.subtotal_partida,
    es_hoja_completa:   p.es_hoja_completa ?? false,
    procesos: (p.procesos ?? []).map(pr => ({
      id_proceso:      pr.id_proceso,
      id_unidad_cobro: pr.id_unidad_cobro,
      nombre:          pr.nombre,
      unidad:          pr.unidad,
      cantidad:        pr.cantidad,
      precio_unitario: pr.precio_unitario,
      subtotal:        pr.subtotal,
    })),
    precio_manual: null,
  }
}

function convertirExtraDesdeDB(e) {
  return {
    _key:                Date.now() + Math.random(),
    tipo:                e.tipo,
    descripcion:         e.descripcion ?? '',
    unidad:              e.unidad ?? 'pza',
    cantidad:            Number(e.cantidad),
    precio_unitario:     Number(e.precio_unitario),
    subtotal_partida:    Number(e.subtotal),
    id_producto_general: e.id_producto_general ?? null,
  }
}

// ── Parser de notacion: "{piezas}-{largo}x{ancho}"  o  "{largo}x{ancho}" ──
function parseNotacion(texto) {
  if (!texto || !texto.trim()) return { error: 'Ingresa una medida (ej. 3-22x45)' }
  // Normalizar: quitar espacios, convertir × y , al separador estándar
  const limpio = texto.trim()
    .replace(/\s/g, '')
    .replace(/[×\*]/g, 'x')
    .replace(/,/g, '.')

  // Formato completo: piezas-largo x ancho
  let m = limpio.match(/^(\d+)-(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)$/)
  if (m) {
    const piezas = Number(m[1])
    const largo  = Number(m[2])
    const ancho  = Number(m[3])
    if (piezas <= 0) return { error: 'La cantidad de piezas debe ser mayor a 0' }
    if (largo  <= 0) return { error: 'El largo debe ser mayor a 0' }
    if (ancho  <= 0) return { error: 'El ancho debe ser mayor a 0' }
    return { piezas, largo, ancho }
  }

  // Formato corto: largo x ancho  (piezas = 1)
  m = limpio.match(/^(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)$/)
  if (m) {
    const largo = Number(m[1])
    const ancho = Number(m[2])
    if (largo <= 0) return { error: 'El largo debe ser mayor a 0' }
    if (ancho <= 0) return { error: 'El ancho debe ser mayor a 0' }
    return { piezas: 1, largo, ancho }
  }

  return { error: 'Formato invalido. Ej: 98x45  o  3-98x45' }
}

// ── Rounding helper: r5 per partida, per-piece for VIDRIO ────────────────
function calcTotal(partidas) {
  return partidas.reduce((s, p) => {
    if (!p.tipo || p.tipo === 'VIDRIO') {
      const pzas = Number(p.piezas ?? 1)
      const cuVid = r5(Number(p.subtotal_vidrio || p.subtotal_partida || 0) / pzas)
      const totProc = (p.procesos ?? []).reduce((ps, pr) => ps + r5(Number(pr.subtotal) / pzas) * pzas, 0)
      return s + cuVid * pzas + totProc
    }
    return s + r5(Number(p.subtotal_partida ?? 0))
  }, 0)
}

// ── Ticket de cotizacion ──────────────────────────────────────────────────
function TicketCotizacion({ cotizacion }) {
  const total = calcTotal(cotizacion.partidas)

  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>VIDRIO TEMPLADO ROSALES</h2>
        <p style={{ fontWeight: 700 }}>CONSTRUYENDO SUEÑOS</p>
        <p style={{ fontWeight: 700 }}>Cotizacion</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Folio:</span><strong>{cotizacion.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{new Date().toLocaleDateString('es-MX')}</span></div>
      {cotizacion.clienteNombre && (
        <div className="ticket-row"><span>Cliente:</span><span>{cotizacion.clienteNombre}</span></div>
      )}
      {cotizacion.nivelNombre && (
        <div className="ticket-row"><span>Nivel:</span><span>{cotizacion.nivelNombre}</span></div>
      )}
      <hr className="ticket-divider" />
      {cotizacion.partidas.filter(p => !p.tipo || p.tipo === 'VIDRIO').length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px dashed #aaa', paddingBottom: 2, margin: '5px 0 3px' }}>Vidrio</div>
          {cotizacion.partidas.filter(p => !p.tipo || p.tipo === 'VIDRIO').map((p, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
                <span>{p.piezas} · {p.largo_cm}×{p.ancho_cm} · {p.tipoClaveLabel}</span>
                <span>${fmt5(p.subtotal_vidrio)}</span>
              </div>
              {(p.procesos ?? []).map((pr, j) => (
                <div key={j} className="ticket-row" style={{ fontSize: 11, paddingLeft: 10 }}>
                  <span>+ {pr.nombre}</span><span>${fmt5(pr.subtotal)}</span>
                </div>
              ))}
              {(p.procesos?.length > 0) && (
                <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
                  <span>Subtotal partida</span><span>${fmt5(p.subtotal_partida)}</span>
                </div>
              )}
            </div>
          ))}
        </>
      )}
      {cotizacion.partidas.filter(p => p.tipo === 'MAQUILA').length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px dashed #aaa', paddingBottom: 2, margin: '5px 0 3px' }}>Maquila</div>
          {cotizacion.partidas.filter(p => p.tipo === 'MAQUILA').map((p, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
                <span>{p.piezas_maq} · {p.largo_cm}×{p.ancho_cm}cm{p.espesor_label ? ` · ${p.espesor_label}` : ''}</span>
                <span>${fmt5(p.subtotal_partida)}</span>
              </div>
              {p.descripcion && <div style={{ fontSize: 11, paddingLeft: 10, marginBottom: 2 }}>{p.descripcion}</div>}
              {(p.procesos_maq ?? []).map((pr, j) => (
                <div key={j} className="ticket-row" style={{ fontSize: 11, paddingLeft: 10 }}>
                  <span>+ {pr.nombre}</span><span>${fmt5(pr.subtotal)}</span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
      {cotizacion.partidas.filter(p => p.tipo === 'HERRAJE' || p.tipo === 'PRODUCTO').length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px dashed #aaa', paddingBottom: 2, margin: '5px 0 3px' }}>Herraje</div>
          {cotizacion.partidas.filter(p => p.tipo === 'HERRAJE' || p.tipo === 'PRODUCTO').map((p, i) => (
            <div key={i} className="ticket-row" style={{ fontSize: 12, marginBottom: 4 }}>
              <span>{p.cantidad} · {p.descripcion}</span>
              <span style={{ fontWeight: 700 }}>${fmt5(p.subtotal_partida)}</span>
            </div>
          ))}
        </>
      )}
      <hr className="ticket-divider" />
      <div className="ticket-total">
        <span>TOTAL</span>
        <span>${fmt5(total)}</span>
      </div>
      <hr className="ticket-divider" />
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        Esta cotizacion tiene una vigencia de 15 dias.
      </div>
    </div>
  )
}

// ── Ticket de pedido (post-conversión) ───────────────────────────────────
function TicketPedidoRapido({ detalle, extras = [] }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h2>
        <p style={{ fontWeight: 700 }}>ARTE EN VIDRIO</p>
        <p style={{ fontWeight: 700 }}>Pedido</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Pedido:</span><strong>{detalle.folio}</strong></div>
      {detalle.id_cotizacion && (
        <div className="ticket-row"><span>Cotizacion:</span><span>COT-{String(detalle.id_cotizacion).padStart(5,'0')}</span></div>
      )}
      <div className="ticket-row"><span>Fecha:</span><span>{detalle.fecha}</span></div>
      <div className="ticket-row"><span>Cliente:</span><span>{detalle.cliente?.nombre ?? 'Mostrador'}</span></div>
      <hr className="ticket-divider" />

      {/* Vidrio */}
      {detalle.partidas.length > 0 && (
        <>
          <div style={{ fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:4, color:'var(--text-muted)' }}>Vidrio</div>
          {detalle.partidas.map((p) => (
            <div key={p.id} style={{ marginBottom: 8 }}>
              <div className="ticket-row" style={{ fontWeight:600, fontSize:12 }}>
                <span>{p.cantidad} · {p.largo_cm}×{p.ancho_cm} · {p.clave_vidrio}</span>
                <span>${fmt5(p.subtotal_partida)}</span>
              </div>
              {p.procesos.map((pr, j) => (
                <div key={j} className="ticket-row" style={{ fontSize:11, paddingLeft:10 }}>
                  <span>+ {pr.nombre}</span>
                  <span>${fmt5(pr.subtotal)}</span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* Maquila */}
      {extras.some(e => e.tipo === 'MAQUILA') && (
        <>
          {detalle.partidas.length > 0 && <hr className="ticket-divider" />}
          <div style={{ fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:4, color:'var(--text-muted)' }}>Maquila</div>
          {extras.filter(e => e.tipo === 'MAQUILA').map((e, i) => {
            const dotIdx = (e.descripcion ?? '').indexOf(' · ')
            const dims   = dotIdx >= 0 ? e.descripcion.slice(0, dotIdx) : (e.descripcion ?? '')
            const procs  = dotIdx >= 0 ? e.descripcion.slice(dotIdx + 3).split(', ') : []
            return (
              <div key={i} style={{ marginBottom: 6 }}>
                <div className="ticket-row" style={{ fontWeight:600, fontSize:12 }}>
                  <span>{dims}</span>
                  <span>${fmt5(e.subtotal)}</span>
                </div>
                {procs.map((pr, j) => (
                  <div key={j} style={{ fontSize:11, paddingLeft:10 }}>+{pr}</div>
                ))}
              </div>
            )
          })}
        </>
      )}

      {/* Herraje */}
      {extras.some(e => e.tipo === 'PRODUCTO') && (
        <>
          <hr className="ticket-divider" />
          <div style={{ fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:1, marginBottom:4, color:'var(--text-muted)' }}>Herraje</div>
          {extras.filter(e => e.tipo === 'PRODUCTO').map((e, i) => (
            <div key={i} className="ticket-row" style={{ fontWeight:600, fontSize:12, marginBottom:4 }}>
              <span>{e.cantidad} · {e.descripcion}</span>
              <span>${fmt5(e.subtotal)}</span>
            </div>
          ))}
        </>
      )}

      <hr className="ticket-divider" />
      <div className="ticket-total"><span>TOTAL</span><span>${fmt5(detalle.total)}</span></div>
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
  const location = useLocation()
  const navigate  = useNavigate()
  const cotEdit  = location.state?.cotEdit ?? null

  const {
    tiposVidrio, espesores, nivelesPrecio, clientes, procesos, barrenos, saques, extras, tiposPago,
    getPrecioVidrio, getPrecioProceso, getPrecioProcesoEspecial,
    getPreciosClienteRegistrado,
    iniciarCotizacion, agregarPartida, agregarPartidaExtra, deletePartidasExtra,
    actualizarCotizacion, finalizarCotizacion,
  } = useCotizacion()

  const { productos: herrajeProds, productosGenerales } = useApp()

  // ── Estado global de la cotizacion ──────────────────────────────────────
  const [nivelId,      setNivelId]      = useState(cotEdit ? String(cotEdit.nivel?.id_nivel_precio ?? '') : '')
  const [clienteId,    setClienteId]    = useState(cotEdit ? String(cotEdit.cliente?.id_cliente ?? '') : '')
  const [observaciones, setObservaciones] = useState('')
  const [preciosCli,   setPreciosCli]   = useState([])
  const [cargandoCli,  setCargandoCli]  = useState(false)

  // ── Tipo de partida a agregar ─────────────────────────────────────────────
  const [tipoPartida, setTipoPartida] = useState('VIDRIO')

  // ── Estado de la calculadora vidrio ──────────────────────────────────────
  const [notacion,     setNotacion]     = useState('')
  const [notError,     setNotError]     = useState('')
  const [tipoVidrioId, setTipoVidrioId] = useState('')
  const [procesosSeleccionados, setProcesosSeleccionados] = useState([]) // [{id_proceso, nombre, ...}]

  // ── Estado calculadora Maquila ────────────────────────────────────────────
  const [maqNotacion,      setMaqNotacion]      = useState('')
  const [maqNotError,      setMaqNotError]      = useState('')
  const [maqDescripcion,   setMaqDescripcion]   = useState('')
  const [maqEspesorId,     setMaqEspesorId]     = useState('')
  const [maqProcesosSelec, setMaqProcesosSelec] = useState([]) // [{id_proceso, cantidad:''}]
  const [maqError,         setMaqError]         = useState('')

  // ── Estado buscador Herraje ───────────────────────────────────────────────
  const [herrajeQuery, setHerrajeQuery] = useState('')
  const [herrajeError, setHerrajeError] = useState('')

  // ── Lista de partidas en memoria ─────────────────────────────────────────
  const [partidas, setPartidas] = useState(
    cotEdit ? [
      ...cotEdit.partidas.map(convertirPartidaDesdeDB),
      ...(cotEdit.extras ?? []).map(convertirExtraDesdeDB),
    ] : []
  )

  // ── Resultado final ──────────────────────────────────────────────────────
  const [cotCreada,    setCotCreada]    = useState(null)

  // ── Conversion rápida a pedido (post-cotización) ─────────────────────────
  const [formaPago,       setFormaPago]       = useState('LIQUIDADO')
  const [anticipoStr,     setAnticipoStr]     = useState('')
  const [convertiendo,    setConvertiendo]    = useState(false)
  const [errorConversion, setErrorConversion] = useState(null)
  const [pedidoCreado,    setPedidoCreado]    = useState(null)
  const [pedidoExtras,    setPedidoExtras]    = useState([])

  // ── Modal "cotizar + convertir" directo ───────────────────────────────────
  const [showPedidoModal,     setShowPedidoModal]     = useState(false)
  const [modalFormaPago,      setModalFormaPago]      = useState('LIQUIDADO')
  const [modalAnticipoStr,    setModalAnticipoStr]    = useState('')
  const [modalError,          setModalError]          = useState(null)
  const [modalConvertiendo,   setModalConvertiendo]   = useState(false)

  // Cargar precios especiales si se pre-seleccionó un cliente al editar
  useEffect(() => {
    if (!cotEdit?.cliente?.id_cliente) return
    setCargandoCli(true)
    getPreciosClienteRegistrado(Number(cotEdit.cliente.id_cliente))
      .then(data => setPreciosCli(data ?? []))
      .catch(() => setPreciosCli([]))
      .finally(() => setCargandoCli(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Barrenos y saque ──────────────────────────────────────────────────────
  const [barrenosSeleccionados,  setBarrenosSeleccionados]  = useState([]) // [{id_proceso, cantidad}]
  const [saquesSeleccionados,    setSaquesSeleccionados]    = useState([]) // [{id_proceso, cantidad}]
  const [extrasSeleccionados,    setExtrasSeleccionados]    = useState([]) // [{id_proceso, cantidad}]

  // ── Precio manual para piezas pequeñas ───────────────────────────────────
  const [precioManual, setPrecioManual] = useState('')

  // ── UI ──────────────────────────────────────────────────────────────────
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState(null)
  const [datosCotOpen, setDatosCotOpen] = useState(true)

  // ── Draft: persistir en sessionStorage ───────────────────────────────────
  const DRAFT_KEY = 'cot_nueva_draft'

  useEffect(() => {
    if (cotEdit) return
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return
    try {
      const d = JSON.parse(raw)
      if (d.nivelId)               setNivelId(d.nivelId)
      if (d.clienteId)             setClienteId(d.clienteId)
      if (d.observaciones)         setObservaciones(d.observaciones)
      if (d.tipoPartida)           setTipoPartida(d.tipoPartida)
      if (d.notacion)              setNotacion(d.notacion)
      if (d.tipoVidrioId)          setTipoVidrioId(d.tipoVidrioId)
      if (d.procesosSeleccionados) setProcesosSeleccionados(d.procesosSeleccionados)
      if (d.barrenosSeleccionados) setBarrenosSeleccionados(d.barrenosSeleccionados)
      if (d.saquesSeleccionados)   setSaquesSeleccionados(d.saquesSeleccionados)
      if (d.extrasSeleccionados)   setExtrasSeleccionados(d.extrasSeleccionados)
      if (d.precioManual)          setPrecioManual(d.precioManual)
      if (d.maqNotacion)           setMaqNotacion(d.maqNotacion)
      if (d.maqDescripcion)        setMaqDescripcion(d.maqDescripcion)
      if (d.maqEspesorId)          setMaqEspesorId(d.maqEspesorId)
      if (d.maqProcesosSelec)      setMaqProcesosSelec(d.maqProcesosSelec)
      if (d.partidas?.length)      setPartidas(d.partidas)
      if (d.formaPago)             setFormaPago(d.formaPago)
      if (d.anticipoStr)           setAnticipoStr(d.anticipoStr)
      if (d.clienteId) {
        setCargandoCli(true)
        getPreciosClienteRegistrado(Number(d.clienteId))
          .then(data => setPreciosCli(data ?? []))
          .catch(() => setPreciosCli([]))
          .finally(() => setCargandoCli(false))
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cotEdit) return
    if (cotCreada) { sessionStorage.removeItem(DRAFT_KEY); return }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      nivelId, clienteId, observaciones, tipoPartida,
      notacion, tipoVidrioId, procesosSeleccionados,
      barrenosSeleccionados, saquesSeleccionados, extrasSeleccionados, precioManual,
      maqNotacion, maqDescripcion, maqEspesorId, maqProcesosSelec,
      partidas, formaPago, anticipoStr,
    }))
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    cotCreada, nivelId, clienteId, observaciones, tipoPartida,
    notacion, tipoVidrioId, procesosSeleccionados,
    barrenosSeleccionados, saquesSeleccionados, extrasSeleccionados, precioManual,
    maqNotacion, maqDescripcion, maqEspesorId, maqProcesosSelec,
    partidas, formaPago, anticipoStr,
  ])

  // ── Selects derivados ────────────────────────────────────────────────────
  const nivelSeleccionado   = nivelesPrecio.find(n => n.id_nivel_precio === Number(nivelId))
  const clienteSeleccionado = clientes.find(c => c.id_cliente === Number(clienteId))
  const tipoSeleccionado    = tiposVidrio.find(t => t.id_tipo_vidrio === Number(tipoVidrioId))
  const tiposActivos        = tiposVidrio.filter(t => t.activo)
  const procesosActivos     = procesos.filter(p => p.activo)
  // Cuando hay precios especiales del cliente, no se requiere nivel de precio
  const usarPreciosCli      = Boolean(clienteId && preciosCli.length > 0)
  // Nivel efectivo para calcular precios de procesos (maquila)
  const efectivoNivelId     = usarPreciosCli
    ? (clienteSeleccionado?.id_nivel_precio ?? null)
    : (nivelId ? Number(nivelId) : null)

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
      const sinPrecio = precioNivel === null && Number(proc.precio_unitario) === 0
      const subtotal = cantidad * precio_unitario
      subtotal_procesos += subtotal
      return { id_proceso: proc.id_proceso, id_unidad_cobro: proc.id_unidad_cobro, nombre: proc.nombre, unidad, cantidad, precio_unitario, subtotal, sinPrecio }
    }).filter(Boolean)

    // Barrenos seleccionados
    barrenosSeleccionados.forEach(bs => {
      const proc = barrenos.find(b => b.id_proceso === bs.id_proceso)
      if (!proc || bs.cantidad <= 0) return
      const precioBruto = getPrecioEsp(proc.id_proceso)
      const sinPrecio = precioBruto === null
      const precio_unitario = precioBruto ?? 0
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
        sinPrecio,
      })
    })

    // Saques seleccionados
    saquesSeleccionados.forEach(ss => {
      const proc = saques.find(s => s.id_proceso === ss.id_proceso)
      if (!proc || ss.cantidad <= 0) return
      const precioBruto = getPrecioEsp(proc.id_proceso)
      const sinPrecio = precioBruto === null
      const precio_unitario = precioBruto ?? 0
      const subtotal = ss.cantidad * precio_unitario
      subtotal_procesos += subtotal
      procesosCalc.push({
        id_proceso:      proc.id_proceso,
        id_unidad_cobro: proc.id_unidad_cobro,
        nombre:          proc.nombre,
        unidad:          proc.unidad_cobro?.nombre ?? 'SERV',
        cantidad:        ss.cantidad,
        precio_unitario,
        subtotal,
        sinPrecio,
      })
    })

    // Extras seleccionados
    extrasSeleccionados.forEach(es => {
      const proc = extras.find(x => x.id_proceso === es.id_proceso)
      if (!proc || es.cantidad <= 0) return
      const precioBruto = getPrecioEsp(proc.id_proceso)
      const sinPrecio = precioBruto === null
      const precio_unitario = precioBruto ?? 0
      const subtotal = es.cantidad * precio_unitario
      subtotal_procesos += subtotal
      procesosCalc.push({
        id_proceso:      proc.id_proceso,
        id_unidad_cobro: proc.id_unidad_cobro,
        nombre:          proc.nombre,
        unidad:          proc.unidad_cobro?.nombre ?? 'PZA',
        cantidad:        es.cantidad,
        precio_unitario,
        subtotal,
        sinPrecio,
      })
    })

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
  }, [notacion, tipoVidrioId, nivelId, usarPreciosCli, preciosCli, cargandoCli, clienteId, procesosSeleccionados, barrenosSeleccionados, saquesSeleccionados, extrasSeleccionados,
      tiposVidrio, procesosActivos, barrenos, saques, extras,
      getPrecioVidrio, getPrecioProceso, getPrecioProcesoEspecial]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manejo de cambio de cliente ───────────────────────────────────────────
  const handleClienteChange = (e) => {
    const cid = e.target.value
    setClienteId(cid)
    setPreciosCli([])
    if (cid) { setDatosCotOpen(false)
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
    setSaquesSeleccionados([])
    setExtrasSeleccionados([])
  }

  // ── Preview en vivo de Maquila ────────────────────────────────────────────
  const maqParsed   = useMemo(() => parseNotacion(maqNotacion), [maqNotacion])
  const maqMetros2  = maqParsed.error ? null : (maqParsed.piezas * maqParsed.largo * maqParsed.ancho) / 10000

  const maqPreviewProcesos = useMemo(() => {
    if (!efectivoNivelId || maqMetros2 === null) return []
    const espesorNum     = maqEspesorId ? Number(maqEspesorId) : null
    const perimetroML    = maqParsed.error ? 0 : maqParsed.piezas * 2 * (maqParsed.largo + maqParsed.ancho) / 100
    const especialesIds  = new Set([...saques.map(s => s.id_proceso), ...barrenos.map(b => b.id_proceso), ...extras.map(x => x.id_proceso)])
    return maqProcesosSelec.map(sel => {
      const proc = procesosActivos.find(p => p.id_proceso === sel.id_proceso)
      if (!proc) return null
      const unidad   = (proc.unidad_cobro?.nombre ?? '').toLowerCase()
      const esPorPza = unidad.includes('pza') || unidad.includes('pieza')
      const esPorML  = !esPorPza && (unidad.includes('ml') || unidad.includes('metro l'))
      const esEspecial = especialesIds.has(proc.id_proceso)
      let cantidad, precio_unitario
      if (esEspecial || esPorPza) {
        cantidad        = sel.cantidad !== '' ? Number(sel.cantidad) : 1
        precio_unitario = getPrecioProcesoEspecial(proc.id_proceso, efectivoNivelId) ?? 0
      } else if (esPorML) {
        cantidad        = perimetroML
        precio_unitario = (
          getPrecioProceso(proc.id_proceso, efectivoNivelId, espesorNum) ??
          getPrecioProceso(proc.id_proceso, efectivoNivelId, null) ??
          0
        )
      } else {
        cantidad        = maqMetros2
        precio_unitario = (
          getPrecioProceso(proc.id_proceso, efectivoNivelId, espesorNum) ??
          getPrecioProceso(proc.id_proceso, efectivoNivelId, null) ??
          0
        )
      }
      return {
        id_proceso: proc.id_proceso, nombre: proc.nombre,
        unidad: proc.unidad_cobro?.nombre ?? '', esPorM2: !esPorPza && !esPorML,
        cantidad, precio_unitario, subtotal: cantidad * precio_unitario,
      }
    }).filter(Boolean)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [efectivoNivelId, maqMetros2, maqParsed, maqEspesorId, maqProcesosSelec, procesosActivos, saques, barrenos, extras])

  const maqSubtotal = maqPreviewProcesos.reduce((s, p) => s + p.subtotal, 0)

  const toggleMaqProceso = (id) =>
    setMaqProcesosSelec(prev => {
      const ex = prev.find(p => p.id_proceso === id)
      return ex ? prev.filter(p => p.id_proceso !== id) : [...prev, { id_proceso: id, cantidad: '' }]
    })
  const setMaqProcesoQty = (id, val) =>
    setMaqProcesosSelec(prev => prev.map(p => p.id_proceso === id ? { ...p, cantidad: val } : p))

  // ── Agregar partida MAQUILA ───────────────────────────────────────────────
  const handleAgregarMaquila = () => {
    if (maqParsed.error)            { setMaqNotError(maqParsed.error); return }
    if (!efectivoNivelId)           { setMaqNotError('Selecciona un nivel de precio'); return }
    if (!maqProcesosSelec.length)   { setMaqNotError('Selecciona al menos un proceso'); return }
    const espesorSel = espesores.find(e => e.id_espesor === Number(maqEspesorId))
    setPartidas(prev => [...prev, {
      _key:            Date.now() + Math.random(),
      tipo:            'MAQUILA',
      descripcion:     maqDescripcion.trim() || null,
      largo_cm:        maqParsed.largo,
      ancho_cm:        maqParsed.ancho,
      piezas_maq:      maqParsed.piezas,
      metros2:         maqMetros2,
      espesor_label:   espesorSel?.etiqueta ?? (espesorSel ? `${espesorSel.valor_mm} mm` : ''),
      procesos_maq:    maqPreviewProcesos,
      cantidad:        maqParsed.piezas,
      unidad:          'pza',
      precio_unitario: maqParsed.piezas > 0 ? maqSubtotal / maqParsed.piezas : 0,
      subtotal_partida: maqSubtotal,
    }])
    setMaqNotacion(''); setMaqDescripcion(''); setMaqEspesorId(''); setMaqProcesosSelec([]); setMaqNotError(''); setMaqError('')
  }

  // ── Catálogo herraje unificado (HERRAJE + GENERAL) ────────────────────────
  const herrajeCatalogo = useMemo(() => [
    ...(herrajeProds ?? []).map(p => ({
      key: p.codigo, tipo: 'HERRAJE',
      id: p.id, codigo: p.codigo,
      descripcion: p.descripcion, tono: p.tono || '',
      precio: Number(p.precio), existencias: p.existencias,
      unidad: 'pza', imagen: p.imagen || '',
      id_producto_general: null,
    })),
    ...(productosGenerales ?? []).map(pg => ({
      key: `pg-${pg.id_producto_general}`, tipo: 'GENERAL',
      id: pg.id_producto_general, codigo: null,
      descripcion: pg.nombre, tono: '',
      precio: Number(pg.precio ?? 0), existencias: pg.existencias ?? 0,
      unidad: pg.unidad || 'pza', imagen: '',
      id_producto_general: pg.id_producto_general,
    })),
  ], [herrajeProds, productosGenerales])

  const herrajeResultados = herrajeQuery.trim()
    ? herrajeCatalogo.filter(p =>
        p.descripcion.toLowerCase().includes(herrajeQuery.toLowerCase()) ||
        (p.codigo ?? '').toLowerCase().includes(herrajeQuery.toLowerCase())
      ).slice(0, 8)
    : []

  // ── Agregar partida HERRAJE ───────────────────────────────────────────────
  const agregarHerrajeProducto = (prod) => {
    setHerrajeError('')
    setHerrajeQuery('')
    setPartidas(prev => {
      const existe = prev.find(p => p.key_herraje === prod.key)
      if (existe) {
        return prev.map(p =>
          p.key_herraje === prod.key
            ? { ...p, cantidad: p.cantidad + 1, subtotal_partida: (p.cantidad + 1) * p.precio_unitario }
            : p
        )
      }
      return [...prev, {
        _key:                Date.now() + Math.random(),
        key_herraje:         prod.key,
        tipo:                'PRODUCTO',
        id_producto_general: prod.id_producto_general,
        descripcion:         prod.descripcion,
        tono:                prod.tono,
        cantidad:            1,
        unidad:              prod.unidad,
        precio_unitario:     prod.precio,
        subtotal_partida:    prod.precio,
        stockDisponible:     prod.existencias,
      }]
    })
  }

  const actualizarCantidadHerrajePartida = (key_herraje, nueva) => {
    setPartidas(prev => prev.map(p => {
      if (p.key_herraje !== key_herraje) return p
      const n = Math.max(1, parseInt(nueva) || 1)
      return { ...p, cantidad: n, subtotal_partida: n * p.precio_unitario }
    }))
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

  const toggleSaque = (id_proceso) => {
    setSaquesSeleccionados(prev => {
      const existe = prev.find(s => s.id_proceso === id_proceso)
      if (existe) return prev.filter(s => s.id_proceso !== id_proceso)
      return [...prev, { id_proceso, cantidad: 1 }]
    })
  }
  const updateSaqueCantidad = (id_proceso, cantidad) => {
    setSaquesSeleccionados(prev =>
      prev.map(s => s.id_proceso === id_proceso ? { ...s, cantidad: Math.max(1, cantidad || 1) } : s)
    )
  }

  const toggleExtra = (id_proceso) => {
    setExtrasSeleccionados(prev => {
      const existe = prev.find(e => e.id_proceso === id_proceso)
      if (existe) return prev.filter(e => e.id_proceso !== id_proceso)
      return [...prev, { id_proceso, cantidad: 1 }]
    })
  }
  const updateExtraCantidad = (id_proceso, cantidad) => {
    setExtrasSeleccionados(prev =>
      prev.map(e => e.id_proceso === id_proceso ? { ...e, cantidad: Math.max(1, cantidad || 1) } : e)
    )
  }

  // ── Quitar partida ────────────────────────────────────────────────────────
  const quitarPartida = (idx) => {
    requestAnimationFrame(() => {
      setPartidas(prev => prev.filter((_, i) => i !== idx))
    })
  }

  // ── Totales ───────────────────────────────────────────────────────────────
  const totalM2      = partidas.filter(p => p.tipo === 'VIDRIO' || !p.tipo).reduce((s, p) => s + p.metros2, 0)
  const totalGeneral = calcTotal(partidas)
  const tieneExtras  = partidas.some(p => p.tipo && p.tipo !== 'VIDRIO')
  const tieneVidrio  = partidas.some(p => p.tipo === 'VIDRIO' || !p.tipo)
  const nivelValido  = !tieneVidrio || usarPreciosCli || !!nivelId

  // ── Helper: guardar partidas extra de una cotizacion ─────────────────────
  const decrementarStockProductos = (listaPartidas) => {
    const productos = listaPartidas.filter(p => p.tipo === 'PRODUCTO' && p.id_producto_general && p.cantidad > 0)
    for (const p of productos) {
      venderProductoGeneral(p.id_producto_general, p.cantidad)
        .catch(e => console.error('[inventario producto]', e.message))
    }
  }

  const guardarExtras = async (id_cotizacion) => {
    const extras = partidas.filter(p => p.tipo && p.tipo !== 'VIDRIO')
    for (const p of extras) {
      let descripcion = p.descripcion
      if (p.tipo === 'MAQUILA' && p.piezas_maq != null) {
        const dims  = `${p.piezas_maq} ${p.largo_cm}×${p.ancho_cm}cm${p.espesor_label ? ` ${p.espesor_label}` : ''}`
        const procs = (p.procesos_maq ?? []).map(pr => pr.nombre).join(', ')
        descripcion = p.descripcion ? `${p.descripcion} — ${dims} · ${procs}` : `${dims} · ${procs}`
      }
      const { error } = await agregarPartidaExtra(id_cotizacion, {
        tipo:                p.tipo,
        descripcion:         descripcion ?? '',
        unidad:              p.unidad,
        cantidad:            p.cantidad,
        precio_unitario:     p.precio_unitario,
        subtotal:            p.subtotal_partida,
        id_producto_general: p.id_producto_general ?? null,
      })
      if (error) throw new Error(error)
    }
  }

  // ── Finalizar / Guardar cotizacion ───────────────────────────────────────
  const handleFinalizar = async () => {
    if (!nivelValido) { setSaveError('Selecciona un nivel de precio'); return }
    if (!partidas.length) { setSaveError('Agrega al menos una partida'); return }
    setSaving(true)
    setSaveError(null)

    const nivelParaGuardar = usarPreciosCli
      ? (clienteSeleccionado?.id_nivel_precio ?? nivelesPrecio[0]?.id_nivel_precio ?? null)
      : Number(nivelId) || nivelesPrecio[0]?.id_nivel_precio || null

    const nivelNombreCalc = usarPreciosCli
      ? 'Precio especial'
      : (nivelSeleccionado?.es_hoja_completa ? 'POR HOJA' : (nivelSeleccionado?.nombre ?? ''))

    const vidrioPartidas = partidas.filter(p => p.tipo === 'VIDRIO' || !p.tipo)

    try {
      // ── Modo edición ────────────────────────────────────────────────────
      if (cotEdit) {
        const { error: updErr } = await actualizarCotizacion(cotEdit.id, {
          id_nivel_precio: nivelParaGuardar,
          id_cliente:      clienteId ? Number(clienteId) : null,
          partidas:        vidrioPartidas,
          total:           totalGeneral,
        })
        if (updErr) throw new Error(updErr)
        // Limpiar y reinsertar extras
        await deletePartidasExtra(cotEdit.id)
        await guardarExtras(cotEdit.id)
        setCotCreada({
          id:            cotEdit.id,
          folio:         cotEdit.folio,
          clienteNombre: clienteSeleccionado?.nombre ?? cotEdit.cliente?.nombre ?? null,
          nivelNombre:   nivelNombreCalc,
          partidas,
          total:         totalGeneral,
        })
        return
      }

      // ── Modo nuevo ──────────────────────────────────────────────────────
      const { data: cot, error: cotErr } = await iniciarCotizacion({
        id_nivel_precio: nivelParaGuardar,
        id_cliente:      clienteId ? Number(clienteId) : null,
        observaciones:   null,
      })
      if (cotErr) throw new Error(cotErr)

      for (const p of vidrioPartidas) {
        const { error: pErr } = await agregarPartida(cot.id_cotizacion, p)
        if (pErr) throw new Error(pErr)
      }
      await guardarExtras(cot.id_cotizacion)

      const { error: finErr } = await finalizarCotizacion(cot.id_cotizacion, totalGeneral)
      if (finErr) throw new Error(finErr)

      setCotCreada({
        id:            cot.id_cotizacion,
        folio:         cot.folio,
        clienteNombre: clienteSeleccionado?.nombre ?? null,
        nivelNombre:   nivelNombreCalc,
        partidas,
        total:         totalGeneral,
      })
    } catch (err) {
      setSaveError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
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
      decrementarStockProductos(partidas)
      const detalle  = await getDetallePedido(idPedido)
      setPedidoCreado(detalle)
      if (detalle.id_cotizacion) {
        const extras = await getPartidasExtra(detalle.id_cotizacion)
        setPedidoExtras(extras)
      }
    } catch (err) {
      setErrorConversion(err.message || 'Error al convertir el pedido')
    } finally {
      setConvertiendo(false)
    }
  }

  // Crea / actualiza la cotizacion y la convierte a pedido
  const handleCotizarYConvertir = async () => {
    const antN = parseFloat(modalAnticipoStr) || 0
    if (!nivelValido) { setModalError('Selecciona un nivel de precio'); return }
    if (!partidas.length) { setModalError('Agrega al menos una partida'); return }
    const vidrioPartidas = partidas.filter(p => p.tipo === 'VIDRIO' || !p.tipo)
    if (modalFormaPago === 'ANTICIPO') {
      if (antN <= 0)            { setModalError('Ingresa un monto de anticipo valido'); return }
      if (antN >= totalGeneral) { setModalError('El anticipo debe ser menor al total'); return }
    }
    setModalConvertiendo(true)
    setModalError(null)
    const nivelParaGuardar = usarPreciosCli
      ? (clienteSeleccionado?.id_nivel_precio ?? nivelesPrecio[0]?.id_nivel_precio ?? null)
      : Number(nivelId) || nivelesPrecio[0]?.id_nivel_precio || null
    try {
      const monto = modalFormaPago === 'LIQUIDADO' ? totalGeneral : antN

      if (cotEdit) {
        await actualizarCotizacion(cotEdit.id, {
          id_nivel_precio: nivelParaGuardar,
          id_cliente:      clienteId ? Number(clienteId) : null,
          partidas:        vidrioPartidas,
          total:           totalGeneral,
        })
        await deletePartidasExtra(cotEdit.id)
        await guardarExtras(cotEdit.id)
        const idPedido = await convertirCotizacionAPedido(cotEdit.id, modalFormaPago, monto)
        decrementarStockProductos(partidas)
        const detalle  = await getDetallePedido(idPedido)
        if (detalle.id_cotizacion) {
          const extras = await getPartidasExtra(detalle.id_cotizacion)
          setPedidoExtras(extras)
        }
        setShowPedidoModal(false)
        setPedidoCreado(detalle)
        setCotCreada({ folio: cotEdit.folio, clienteNombre: clienteSeleccionado?.nombre ?? null, partidas, total: totalGeneral })
      } else if (tieneExtras) {
        // Con extras: crear cotizacion completa y convertir
        const { data: cot, error: cotErr } = await iniciarCotizacion({
          id_nivel_precio: nivelParaGuardar,
          id_cliente:      clienteId ? Number(clienteId) : null,
          observaciones:   null,
        })
        if (cotErr) throw new Error(cotErr)
        for (const p of vidrioPartidas) {
          const { error: pErr } = await agregarPartida(cot.id_cotizacion, p)
          if (pErr) throw new Error(pErr)
        }
        await guardarExtras(cot.id_cotizacion)
        await finalizarCotizacion(cot.id_cotizacion, totalGeneral)
        const idPedido = await convertirCotizacionAPedido(cot.id_cotizacion, modalFormaPago, monto)
        decrementarStockProductos(partidas)
        const detalle  = await getDetallePedido(idPedido)
        if (detalle.id_cotizacion) {
          const extras = await getPartidasExtra(detalle.id_cotizacion)
          setPedidoExtras(extras)
        }
        setShowPedidoModal(false)
        setPedidoCreado(detalle)
        setCotCreada({ folio: cot.folio, clienteNombre: clienteSeleccionado?.nombre ?? null, partidas, total: totalGeneral })
      } else {
        // Solo vidrio, sin extras: flujo directo rápido
        const idPedido = await crearPedidoDirecto({
          id_cliente:      clienteId ? Number(clienteId) : null,
          id_nivel_precio: nivelParaGuardar,
          partidas:        vidrioPartidas,
          tipo_pago:       modalFormaPago,
          monto_anticipo:  monto,
        })
        const folioRef = `PED-${String(idPedido).padStart(5, '0')}`
        decrementarInventarioDesdePartidas(vidrioPartidas, folioRef).catch(e => console.error('[inventario]', e))
        const detalle = await getDetallePedido(idPedido)
        if (detalle.id_cotizacion) {
          const extras = await getPartidasExtra(detalle.id_cotizacion)
          setPedidoExtras(extras)
        }
        setShowPedidoModal(false)
        setPedidoCreado(detalle)
        setCotCreada({ folio: null, clienteNombre: clienteSeleccionado?.nombre ?? null, partidas, total: totalGeneral })
      }
    } catch (err) {
      setModalError(err.message || 'Error al crear el pedido')
    } finally {
      setModalConvertiendo(false)
    }
  }

  const nuevaCotizacion = () => {
    sessionStorage.removeItem(DRAFT_KEY)
    navigate('/cot/nueva', { replace: true, state: {} })
    setCotCreada(null)
    setPedidoCreado(null)
    setPedidoExtras([])
    setFormaPago('LIQUIDADO')
    setAnticipoStr('')
    setErrorConversion(null)
    setPartidas([])
    setNivelId('')
    setClienteId('')
    setPreciosCli([])
    setObservaciones('')
    setNotacion('')
    setTipoPartida('VIDRIO')
    setMaqNotacion(''); setMaqDescripcion(''); setMaqEspesorId(''); setMaqProcesosSelec([]); setMaqNotError(''); setMaqError('')
    setHerrajeQuery(''); setHerrajeError('')
    setProcesosSeleccionados([])
    setBarrenosSeleccionados([])
    setSaquesSeleccionados([])
    setExtrasSeleccionados([])
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
                partidas: [
                  ...pedidoCreado.partidas.map(p => ({
                    piezas: p.cantidad, clave: p.clave_vidrio,
                    largo_cm: p.largo_cm, ancho_cm: p.ancho_cm,
                    subtotal_vidrio: p.subtotal_vidrio, procesos: p.procesos,
                    subtotal_partida: p.subtotal_partida,
                  })),
                  ...pedidoExtras.map(e => ({
                    tipo: e.tipo === 'HERRAJE' || e.tipo === 'PRODUCTO' ? e.tipo : 'MAQUILA',
                    descripcion: e.descripcion,
                    cantidad: e.cantidad,
                    unidad: e.unidad,
                    precio_unitario: e.precio_unitario != null ? Number(e.precio_unitario) : null,
                    subtotal_partida: Number(e.subtotal),
                    procesos: [],
                  })),
                ],
              })}>🖨️ Imprimir</button>
              <button className="btn btn-primary" onClick={nuevaCotizacion}>+ Nueva cotizacion</button>
            </div>
          </div>
          <div className="page-body">
            <div className="alert alert-success">
              ✅ Pedido <strong>{pedidoCreado.folio}</strong> registrado correctamente.
            </div>
            <TicketPedidoRapido detalle={pedidoCreado} extras={pedidoExtras} />
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
              total: calcTotal(cotCreada.partidas),
              partidas: cotCreada.partidas.map(p => {
                if (!p.tipo || p.tipo === 'VIDRIO') return {
                  tipo: 'VIDRIO',
                  piezas: p.piezas, clave: p.tipoClaveLabel,
                  largo_cm: p.largo_cm, ancho_cm: p.ancho_cm,
                  subtotal_vidrio: p.subtotal_vidrio, procesos: p.procesos ?? [],
                  subtotal_partida: p.subtotal_partida,
                }
                if (p.tipo === 'MAQUILA' && p.piezas_maq != null) return {
                  tipo: 'MAQUILA',
                  piezas: p.piezas_maq, clave: p.espesor_label,
                  largo_cm: p.largo_cm, ancho_cm: p.ancho_cm,
                  descripcion: p.descripcion,
                  procesos: p.procesos_maq ?? [],
                  subtotal_partida: p.subtotal_partida,
                }
                return {
                  tipo: p.tipo ?? 'MAQUILA',
                  descripcion: p.descripcion,
                  subtotal_partida: p.subtotal_partida,
                }
              }),
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
          <div className="page-title">
            {cotEdit ? `Nueva cotizacion (base: ${cotEdit.folio})` : 'Nueva Cotizacion'}
          </div>
        </div>
        {partidas.length > 0 && (
          <div className="cot-header-actions">
            <button
              className="btn btn-outline"
              onClick={handleFinalizar}
              disabled={saving || !nivelValido}
            >
              {saving ? 'Guardando...' : cotEdit ? `✓ Guardar — $${fmt5(totalGeneral)}` : `✓ Cotizar — $${fmt5(totalGeneral)}`}
            </button>
            <button
              className="btn btn-accent"
              onClick={() => { setShowPedidoModal(true); setModalError(null) }}
              disabled={saving || !nivelValido}
            >
              📦 Pedido
            </button>
          </div>
        )}
      </div>

      <div className="page-body">
        {cotEdit && (
          <div className="alert alert-warning" style={{ marginBottom: 12 }}>
            ✏️ Editando como base <strong>{cotEdit.folio}</strong> — al guardar se creara una cotizacion nueva con las partidas modificadas.
          </div>
        )}
        {saveError && <div className="alert alert-error">❌ {saveError}</div>}

        <div className="venta-grid">

          {/* ── Columna izquierda ── */}
          <div className="cot-left-panel">

            {/* Cabecera de la cotizacion */}
            <div className="card" style={{ marginBottom: 8 }}>
              {/* Tipo de partida — siempre visible */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {[
                  { key: 'VIDRIO',   label: '🪟 Vidrio' },
                  { key: 'MAQUILA',  label: '🔧 Maquila' },
                  { key: 'PRODUCTO', label: '🧰 Herraje' },
                ].map(({ key, label }) => {
                  const meta   = TIPO_META[key]
                  const active = tipoPartida === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTipoPartida(key)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 13,
                        cursor: 'pointer', fontWeight: active ? 700 : 400,
                        border: `2px solid ${active ? meta.color : 'var(--border)'}`,
                        background: active ? meta.bg : 'white',
                        color: active ? meta.color : 'var(--text)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Nivel + cliente — colapsable */}
              <div
                data-testid="nivel-precio-toggle"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', paddingTop: 8, borderTop: '1px solid var(--border)', marginBottom: datosCotOpen ? 10 : 0 }}
                onClick={() => setDatosCotOpen(v => !v)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, fontSize: 13 }}>
                  {nivelSeleccionado
                    ? <span className="badge badge-blue">{nivelSeleccionado.es_hoja_completa ? 'POR HOJA' : nivelSeleccionado.nombre}</span>
                    : <span style={{ color: 'var(--text-muted)' }}>Nivel de precio</span>}
                  {clienteSeleccionado
                    ? <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {clienteSeleccionado.nombre}</span>
                    : <span style={{ color: 'var(--text-muted)' }}>· Mostrador</span>}
                </div>
                <span style={{ fontSize: 18, color: 'var(--text-muted)', display: 'inline-block', transition: 'transform 0.2s', transform: datosCotOpen ? 'none' : 'rotate(-90deg)' }}>▾</span>
              </div>
              {datosCotOpen && <div className="form-row">
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
                            onClick={() => { setNivelId(String(n.id_nivel_precio)); setDatosCotOpen(false) }}
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
              </div>}
            </div>

            {/* Calculadora */}
            <div className="card" style={{ marginBottom: 8 }}>
              {tipoPartida === 'VIDRIO' && (<>

              {/* Medida + Tipo de vidrio en fila */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label required">Medida</label>
                  <input
                    className={`form-input cot-calc-input${notError ? ' error' : ''}`}
                    value={notacion}
                    onChange={e => { setNotacion(e.target.value); setNotError(''); setPrecioManual('') }}
                    placeholder="98x45  o  3-98x45"
                    inputMode="text"
                    onKeyDown={e => e.key === 'Enter' && handleAgregarPartida()}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                  {notError
                    ? <div className="form-error">{notError}</div>
                    : <div className="form-hint">largo×ancho  o  pzas-largo×ancho</div>}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label required">Tipo de vidrio</label>
                  <select
                    className="form-select"
                    value={tipoVidrioId}
                    onChange={e => { setTipoVidrioId(e.target.value); setPrecioManual('') }}
                  >
                    <option value="">-- Tipo --</option>
                    {tiposActivos.map(t => (
                      <option key={t.id_tipo_vidrio} value={t.id_tipo_vidrio}>{t.clave}{t.descripcion ? ` — ${t.descripcion}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Procesos adicionales — dos columnas, lista multi-select */}
              {procesosActivos.length > 0 && (() => {
                const barrenoIds = new Set(barrenos.map(b => b.id_proceso))
                const saqueIds   = new Set(saques.map(s => s.id_proceso))
                const extraIds   = new Set(extras.map(x => x.id_proceso))
                const procRegs   = procesosActivos.filter(p =>
                  !barrenoIds.has(p.id_proceso) && !saqueIds.has(p.id_proceso) && !extraIds.has(p.id_proceso)
                )
                const procM2    = procRegs.filter(p => { const u = (p.unidad_cobro?.nombre ?? '').toLowerCase(); return u.includes('m2') || u.includes('m²') || u.includes('cuadrado') })
                const procML    = procRegs.filter(p => { const u = (p.unidad_cobro?.nombre ?? '').toLowerCase(); return u.includes('ml') || u.includes('lineal') })
                const procOtros = procRegs.filter(p => { const u = (p.unidad_cobro?.nombre ?? '').toLowerCase(); return !u.includes('m2') && !u.includes('m²') && !u.includes('cuadrado') && !u.includes('ml') && !u.includes('lineal') })

                const hasLeft  = procM2.length > 0 || procML.length > 0 || procOtros.length > 0
                const hasRight = barrenos.length > 0 || saques.length > 0 || extras.length > 0
                if (!hasLeft && !hasRight) return null

                const checkRow = (p, sel, onToggle, onQtyChange, qty) => (
                  <div
                    key={p.id_proceso}
                    onClick={onToggle}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      padding: '3px 8px',
                      background: sel ? '#eff6ff' : 'transparent',
                      cursor: 'pointer', userSelect: 'none', borderRadius: 4,
                    }}
                  >
                    <input type="checkbox" checked={sel} readOnly
                      style={{ cursor: 'pointer', flexShrink: 0, width: 6, height: 6 }}
                    />
                    <span style={{ fontSize: 17, fontWeight: sel ? 600 : 400 }}>{p.nombre}</span>
                    {onQtyChange && sel && (
                      <input
                        type="number" min="1" step="1"
                        className="form-input"
                        style={{ width: 46, padding: '1px 4px', fontSize: 11, margin: 0, height: 22, flexShrink: 0 }}
                        value={qty}
                        onClick={e => e.stopPropagation()}
                        onChange={e => onQtyChange(parseInt(e.target.value))}
                      />
                    )}
                  </div>
                )

                const groupLabel = label => (
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 10px 2px', marginTop: 4 }}>
                    {label}
                  </div>
                )

                return (
                  <div className="form-group">
                    <label className="form-label">Procesos</label>
                    <div style={{ display: 'grid', gridTemplateColumns: hasLeft && hasRight ? '1fr 1fr' : '1fr', gap: 8 }}>

                      {/* Columna izquierda: m², ml, otros */}
                      {hasLeft && (
                        <div style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '2px 2px', maxHeight: 200, overflowY: 'auto' }}>
                          {procM2.length > 0 && (<>
                            {groupLabel('m²')}
                            {procM2.map(p => checkRow(p,
                              procesosSeleccionados.some(s => s.id_proceso === p.id_proceso),
                              () => toggleProceso(p), null, null
                            ))}
                          </>)}
                          {procML.length > 0 && (<>
                            {groupLabel('ml')}
                            {procML.map(p => checkRow(p,
                              procesosSeleccionados.some(s => s.id_proceso === p.id_proceso),
                              () => toggleProceso(p), null, null
                            ))}
                          </>)}
                          {procOtros.length > 0 && (<>
                            {groupLabel('Otros')}
                            {procOtros.map(p => checkRow(p,
                              procesosSeleccionados.some(s => s.id_proceso === p.id_proceso),
                              () => toggleProceso(p), null, null
                            ))}
                          </>)}
                        </div>
                      )}

                      {/* Columna derecha: barrenos, saques, extras */}
                      {hasRight && (
                        <div style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '2px 2px', maxHeight: 200, overflowY: 'auto' }}>
                          {barrenos.length > 0 && (<>
                            {groupLabel('Barrenos')}
                            {barrenos.map(p => {
                              const sel = barrenosSeleccionados.find(s => s.id_proceso === p.id_proceso)
                              return checkRow(p, !!sel, () => toggleBarreno(p.id_proceso),
                                val => updateBarrenoCantidad(p.id_proceso, val), sel?.cantidad ?? 1)
                            })}
                          </>)}
                          {saques.length > 0 && (<>
                            {groupLabel('Saques')}
                            {saques.map(p => {
                              const sel = saquesSeleccionados.find(s => s.id_proceso === p.id_proceso)
                              return checkRow(p, !!sel, () => toggleSaque(p.id_proceso),
                                val => updateSaqueCantidad(p.id_proceso, val), sel?.cantidad ?? 1)
                            })}
                          </>)}
                          {extras.length > 0 && (<>
                            {groupLabel('Extras')}
                            {extras.map(p => {
                              const sel = extrasSeleccionados.find(s => s.id_proceso === p.id_proceso)
                              return checkRow(p, !!sel, () => toggleExtra(p.id_proceso),
                                val => updateExtraCantidad(p.id_proceso, val), sel?.cantidad ?? 1)
                            })}
                          </>)}
                        </div>
                      )}

                    </div>
                  </div>
                )
              })()}

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
                      <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>${fmt5(preview.subtotal_total)}</div>
                    </div>
                  </div>

                  {preview.procesosCalc.length > 0 && (
                    <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      {preview.procesosCalc.map((pc, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: pc.sinPrecio ? '#b45309' : 'var(--text-muted)' }}>
                          <span>{pc.sinPrecio ? '⚠️' : '+'} {pc.nombre} ({pc.cantidad.toFixed(2)} {pc.unidad} × ${pc.precio_unitario.toFixed(2)}){pc.sinPrecio ? ' — sin precio' : ''}</span>
                          <span>${fmt5(pc.subtotal)}</span>
                        </div>
                      ))}
                      {preview.procesosCalc.some(pc => pc.sinPrecio) && (
                        <div style={{ marginTop: 6, padding: '5px 8px', borderRadius: 6, background: '#fffbeb', border: '1px solid #f59e0b', fontSize: 12, color: '#92400e' }}>
                          ⚠️ Hay procesos sin precio configurado para este nivel. Se cotizarán en $0.00 — configúralos en Catálogos → Procesos.
                        </div>
                      )}
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
                        ⚠️ Pieza pequeña — precio calculado: <strong>${fmt5(preview.subtotal_total)}</strong>
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
                ➕ Agregar vidrio
              </button>
              </>)}

              {tipoPartida === 'MAQUILA' && (
                <div>
                  {maqNotError && <div className="alert alert-error" style={{ marginBottom: 8 }}>❌ {maqNotError}</div>}
                  {maqError    && <div className="alert alert-error" style={{ marginBottom: 8 }}>❌ {maqError}</div>}

                  {/* Medida + Espesor en fila */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label required">Medida</label>
                      <input
                        className={`form-input cot-calc-input${maqNotError ? ' error' : ''}`}
                        value={maqNotacion}
                        onChange={e => { setMaqNotacion(e.target.value); setMaqNotError('') }}
                        placeholder="98x45  o  3-98x45"
                        inputMode="text"
                        onKeyDown={e => e.key === 'Enter' && handleAgregarMaquila()}
                        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
                      />
                      <div className="form-hint">largo×ancho  o  pzas-largo×ancho</div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label required">Espesor</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                        {espesores.map(e => {
                          const activo = maqEspesorId === String(e.id_espesor)
                          return (
                            <button key={e.id_espesor} type="button"
                              onClick={() => setMaqEspesorId(String(e.id_espesor))}
                              style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: 12,
                                cursor: 'pointer', fontWeight: activo ? 700 : 400,
                                border: `2px solid ${activo ? '#b45309' : 'var(--border)'}`,
                                background: activo ? '#fef3c7' : 'white',
                                color: activo ? '#b45309' : 'var(--text)',
                                transition: 'all 0.15s',
                              }}
                            >{e.etiqueta ?? `${e.valor_mm}mm`}</button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Descripcion (opcional)</label>
                    <input className="form-input" value={maqDescripcion}
                      onChange={e => setMaqDescripcion(e.target.value)}
                      placeholder="Marco izquierdo, puerta principal..." />
                  </div>

                  {(() => {
                    const barrenoIds = new Set(barrenos.map(b => b.id_proceso))
                    const saqueIds   = new Set(saques.map(s => s.id_proceso))
                    const extraIds   = new Set(extras.map(x => x.id_proceso))
                    const procRegs   = procesosActivos.filter(p =>
                      !barrenoIds.has(p.id_proceso) && !saqueIds.has(p.id_proceso) && !extraIds.has(p.id_proceso)
                    )
                    const procM2    = procRegs.filter(p => { const u = (p.unidad_cobro?.nombre ?? '').toLowerCase(); return u.includes('m2') || u.includes('m²') || u.includes('cuadrado') })
                    const procML    = procRegs.filter(p => { const u = (p.unidad_cobro?.nombre ?? '').toLowerCase(); return u.includes('ml') || u.includes('lineal') })
                    const procOtros = procRegs.filter(p => { const u = (p.unidad_cobro?.nombre ?? '').toLowerCase(); return !u.includes('m2') && !u.includes('m²') && !u.includes('cuadrado') && !u.includes('ml') && !u.includes('lineal') })

                    const hasLeft  = procM2.length > 0 || procML.length > 0 || procOtros.length > 0
                    const hasRight = barrenos.length > 0 || saques.length > 0 || extras.length > 0
                    if (!hasLeft && !hasRight) return null

                    const checkRow = (p, sel, onToggle, onQtyChange, qty) => (
                      <div
                        key={p.id_proceso}
                        onClick={onToggle}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 10px',
                          background: sel ? '#eff6ff' : 'transparent',
                          cursor: 'pointer', userSelect: 'none', borderRadius: 5,
                        }}
                      >
                        <input type="checkbox" checked={sel} readOnly
                          style={{ cursor: 'pointer', flexShrink: 0, width: 14, height: 14 }}
                        />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: sel ? 600 : 400 }}>{p.nombre}</span>
                        {onQtyChange && sel && (
                          <input
                            type="number" min="1" step="1"
                            className="form-input"
                            style={{ width: 46, padding: '1px 4px', fontSize: 11, margin: 0, height: 22, flexShrink: 0 }}
                            value={qty}
                            onClick={e => e.stopPropagation()}
                            onChange={e => onQtyChange(e.target.value)}
                          />
                        )}
                      </div>
                    )

                    const groupLabel = label => (
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '3px 8px 1px', marginTop: 2 }}>
                        {label}
                      </div>
                    )

                    return (
                      <div className="form-group">
                        <label className="form-label required">Procesos</label>
                        <div style={{ display: 'grid', gridTemplateColumns: hasLeft && hasRight ? '1fr 1fr' : '1fr', gap: 8 }}>

                          {hasLeft && (
                            <div style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '2px 2px', maxHeight: 200, overflowY: 'auto' }}>
                              {procM2.length > 0 && (<>
                                {groupLabel('m²')}
                                {procM2.map(p => checkRow(p,
                                  maqProcesosSelec.some(s => s.id_proceso === p.id_proceso),
                                  () => toggleMaqProceso(p.id_proceso), null, null
                                ))}
                              </>)}
                              {procML.length > 0 && (<>
                                {groupLabel('ml')}
                                {procML.map(p => checkRow(p,
                                  maqProcesosSelec.some(s => s.id_proceso === p.id_proceso),
                                  () => toggleMaqProceso(p.id_proceso), null, null
                                ))}
                              </>)}
                              {procOtros.length > 0 && (<>
                                {groupLabel('Otros')}
                                {procOtros.map(p => checkRow(p,
                                  maqProcesosSelec.some(s => s.id_proceso === p.id_proceso),
                                  () => toggleMaqProceso(p.id_proceso), null, null
                                ))}
                              </>)}
                            </div>
                          )}

                          {hasRight && (
                            <div style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '2px 2px', maxHeight: 200, overflowY: 'auto' }}>
                              {barrenos.length > 0 && (<>
                                {groupLabel('Barrenos')}
                                {barrenos.map(p => {
                                  const sel = maqProcesosSelec.find(s => s.id_proceso === p.id_proceso)
                                  return checkRow(p, !!sel, () => toggleMaqProceso(p.id_proceso),
                                    val => setMaqProcesoQty(p.id_proceso, val), sel?.cantidad ?? '')
                                })}
                              </>)}
                              {saques.length > 0 && (<>
                                {groupLabel('Saques')}
                                {saques.map(p => checkRow(p,
                                  maqProcesosSelec.some(s => s.id_proceso === p.id_proceso),
                                  () => toggleMaqProceso(p.id_proceso), null, null
                                ))}
                              </>)}
                              {extras.length > 0 && (<>
                                {groupLabel('Extras')}
                                {extras.map(p => {
                                  const sel = maqProcesosSelec.find(s => s.id_proceso === p.id_proceso)
                                  return checkRow(p, !!sel, () => toggleMaqProceso(p.id_proceso),
                                    val => setMaqProcesoQty(p.id_proceso, val), sel?.cantidad ?? '')
                                })}
                              </>)}
                            </div>
                          )}

                        </div>
                      </div>
                    )
                  })()}

                  {maqMetros2 !== null && maqProcesosSelec.length > 0 && (
                    <div className="cot-preview-row" style={{ marginBottom: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
                        {[
                          ['Piezas',   maqParsed.piezas,                 ''],
                          ['Largo',    `${maqParsed.largo} cm`,          ''],
                          ['Ancho',    `${maqParsed.ancho} cm`,          ''],
                          ['Total m²', maqMetros2.toFixed(4),            ''],
                          ['Subtotal', `$${fmt5(maqSubtotal)}`,     'var(--accent)'],
                        ].map(([lbl, val, color]) => (
                          <div key={lbl} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{lbl}</div>
                            <div style={{ fontWeight: 700, fontSize: 17, color: color || undefined }}>{val}</div>
                          </div>
                        ))}
                      </div>
                      {maqPreviewProcesos.length > 0 && (
                        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                          {maqPreviewProcesos.map((pc, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}>
                              <span>
                                + {pc.nombre}
                                {pc.esPorM2
                                  ? ` (${pc.cantidad.toFixed(4)} m² × $${pc.precio_unitario.toFixed(2)})`
                                  : ` (${pc.cantidad} × $${pc.precio_unitario.toFixed(2)})`}
                              </span>
                              <span>${fmt5(pc.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!efectivoNivelId && maqNotacion && (
                    <div className="alert alert-warning" style={{ marginBottom: 8 }}>⚠️ Selecciona un nivel de precio para calcular</div>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                    onClick={handleAgregarMaquila}
                    disabled={!maqNotacion || !maqEspesorId || !maqProcesosSelec.length || !efectivoNivelId}
                  >
                    🔧 Agregar maquila
                  </button>
                </div>
              )}

              {tipoPartida === 'PRODUCTO' && (
                <div>
                  {herrajeError && <div className="alert alert-error" style={{ marginBottom: 8 }}>❌ {herrajeError}</div>}
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label className="form-label">Buscar producto</label>
                    <div className="search-input-wrap" style={{ maxWidth: '100%' }}>
                      <span className="search-icon">🔍</span>
                      <input
                        className="search-input"
                        placeholder="Codigo o descripcion..."
                        value={herrajeQuery}
                        onChange={e => { setHerrajeQuery(e.target.value); setHerrajeError('') }}
                        autoComplete="off"
                      />
                    </div>
                    {herrajeResultados.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                        background: 'white', border: '1.5px solid var(--border)',
                        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                        overflow: 'hidden', marginTop: 4,
                      }}>
                        {herrajeResultados.map(prod => (
                          <button key={prod.key} type="button"
                            onClick={() => agregarHerrajeProducto(prod)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 14px', background: 'none', border: 'none',
                              cursor: 'pointer', textAlign: 'left',
                              borderBottom: '1px solid var(--border)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <div style={{ width: 36, height: 36, background: 'var(--bg)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                              {prod.tipo === 'GENERAL' ? '🧰' : '📦'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{prod.descripcion}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {prod.tipo === 'GENERAL'
                                  ? `${prod.unidad} · $${prod.precio.toFixed(2)}`
                                  : `${prod.codigo} · $${prod.precio.toFixed(2)}`}
                              </div>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: prod.existencias < 5 ? 'var(--danger)' : 'var(--success)', flexShrink: 0 }}>
                              {prod.existencias} pzas
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {herrajeQuery.trim() && herrajeResultados.length === 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                        background: 'white', border: '1.5px solid var(--border)', borderRadius: 8,
                        padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 4,
                      }}>
                        No se encontraron productos
                      </div>
                    )}
                  </div>
                  <div className="form-hint" style={{ marginTop: -8 }}>Haz clic en un producto para agregarlo · puedes ajustar la cantidad en la lista</div>
                </div>
              )}
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
                      {(p.tipo === 'VIDRIO' || !p.tipo) ? (
                        <>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>
                            {p.piezas} · {p.largo_cm}×{p.ancho_cm} cm · {p.metros2.toFixed(4)} m²
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            <span className="badge badge-blue" style={{ fontSize: 12, marginRight: 6 }}>{p.tipoClaveLabel}</span>
                            ${p.precio_m2_aplicado.toFixed(2)}/m²
                          </div>
                          {p.procesos && p.procesos.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              {p.procesos.map((pr, j) => (
                                <div key={j} style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 10 }}>
                                  + {pr.nombre} ({pr.cantidad.toFixed(2)} {pr.unidad}): ${fmt5(pr.subtotal)}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : p.tipo === 'MAQUILA' ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: TIPO_META.MAQUILA.bg, color: TIPO_META.MAQUILA.color }}>
                              Maquila
                            </span>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>
                              {p.piezas_maq} · {p.largo_cm}×{p.ancho_cm} cm{p.espesor_label ? ` · ${p.espesor_label}` : ''}
                            </span>
                          </div>
                          {p.descripcion && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{p.descripcion}</div>}
                          {p.procesos_maq?.map((pr, j) => (
                            <div key={j} style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 8 }}>
                              + {pr.nombre}: ${fmt5(pr.subtotal)}
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: TIPO_META.PRODUCTO.bg, color: TIPO_META.PRODUCTO.color }}>
                              Herraje
                            </span>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{p.descripcion}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cant.:</span>
                            <input
                              type="number" min="1" step="1"
                              className="form-input"
                              style={{ width: 64, padding: '3px 6px', fontSize: 13, margin: 0 }}
                              value={p.cantidad}
                              onChange={e => actualizarCantidadHerrajePartida(p.key_herraje, e.target.value)}
                            />
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.unidad} × ${p.precio_unitario.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)', minWidth: 80, textAlign: 'right' }}>
                      ${fmt5(p.subtotal_partida)}
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
                  <strong>${fmt5(totalGeneral)}</strong>
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
                <span style={{ color: 'var(--accent)' }}>${fmt5(totalGeneral)}</span>
              </div>

              <button
                className="btn btn-accent"
                style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
                onClick={() => { setShowPedidoModal(true); setModalError(null) }}
                disabled={partidas.length === 0 || !nivelValido || saving}
              >
                📦 Convertir a pedido
              </button>
              <button
                className="btn btn-outline"
                style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
                onClick={handleFinalizar}
                disabled={partidas.length === 0 || !nivelValido || saving}
              >
                {saving ? 'Guardando...' : cotEdit ? '✓ Guardar cambios' : '✓ Solo cotizar'}
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
                <div className="modal-title">Convertir a pedido</div>
                <button className="btn-icon" onClick={() => setShowPedidoModal(false)}>✕</button>
              </div>

              <div className="modal-body">
                {/* Total destacado */}
                <div style={{
                  background: 'var(--accent)', borderRadius: 12, padding: '18px 24px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 20,
                }}>
                  <span style={{ color: 'white', fontSize: 14, fontWeight: 600, opacity: 0.85 }}>Total a cobrar</span>
                  <span style={{ color: 'white', fontSize: 32, fontWeight: 800, letterSpacing: '-1px' }}>
                    ${fmt5(totalGeneral)}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label required">Forma de pago</label>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                    {tiposPago
  //falta acabar               //    .filter(tp => tp.descripcion !== 'CREDITO' || clienteSeleccionado?.credito_activo)
                      .map(tp => (
                      <label
                        key={tp.id_tipo_pago}
                        style={{
                          flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 3,
                          padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                          border: `2px solid ${modalFormaPago === tp.descripcion ? 'var(--accent)' : 'var(--border)'}`,
                          background: modalFormaPago === tp.descripcion ? 'var(--accent-subtle, #ede9fe)' : 'white',
                        }}
                        onClick={() => { setModalFormaPago(tp.descripcion); setModalAnticipoStr(''); setModalError(null) }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="radio" name="modalFP" value={tp.descripcion} checked={modalFormaPago === tp.descripcion} onChange={() => {}} />
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{tp.descripcion.charAt(0) + tp.descripcion.slice(1).toLowerCase()}</span>
                        </div>
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
                      <div style={{
                        marginTop: 8, padding: '10px 14px', borderRadius: 8,
                        background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Saldo pendiente</span>
                        <strong style={{ fontSize: 18, color: 'var(--accent)' }}>${fmt5(totalGeneral - antN)}</strong>
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
              ${fmt5(totalGeneral)}
            </div>
          </div>
          <button
            className="btn btn-outline"
            style={{ justifyContent: 'center' }}
            onClick={handleFinalizar}
            disabled={saving || !nivelValido}
          >
            {saving ? '...' : '✓ Cotizar'}
          </button>
          <button
            className="btn btn-accent"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => { setShowPedidoModal(true); setModalError(null) }}
            disabled={saving || !nivelValido}
          >
            📦 Pedido
          </button>
        </div>
      )}
    </>
  )
}
