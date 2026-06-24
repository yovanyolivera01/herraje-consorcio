import { useState, useMemo, useEffect } from 'react'
import { fmt5 } from '../../lib/utils'
import { useCotizacion } from '../../context/CotizacionContext'
import { useApp } from '../../context/AppContext'
import { convertirCotizacionAPedido, getDetallePedido } from '../../lib/pedidosApi'
import { printCotizacionCarta, printTicketVidrio } from '../../utils/ticket'
import { exportCotizacionPDF } from '../../utils/pdf'

// ── Parser notacion vidrio ────────────────────────────────────────────────
function parseNotacion(texto) {
  if (!texto?.trim()) return { error: 'Ingresa una medida (ej. 3-22x45)' }
  const limpio = texto.trim().replace(/\s/g, '')
  const match  = limpio.match(/^(\d+)-(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)$/)
  if (!match) return { error: 'Formato invalido. Usa: {piezas}-{largo}x{ancho} — ej. 3-22x45' }
  const piezas = Number(match[1]); const largo = Number(match[2]); const ancho = Number(match[3])
  if (piezas <= 0) return { error: 'Piezas debe ser mayor a 0' }
  if (largo  <= 0) return { error: 'Largo debe ser mayor a 0' }
  if (ancho  <= 0) return { error: 'Ancho debe ser mayor a 0' }
  return { piezas, largo, ancho }
}

// ── Ticket en pantalla ────────────────────────────────────────────────────
function TicketCotizacion({ cot }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>TEMPLADOS CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>ARTE EN VIDRIO</p>
        <p style={{ fontWeight: 600 }}>Cotizacion</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Folio:</span><strong>{cot.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{new Date().toLocaleDateString('es-MX')}</span></div>
      <div className="ticket-row"><span>Cliente:</span><strong>{cot.clienteNombre}</strong></div>
      {cot.clienteTel && <div className="ticket-row"><span>Tel:</span><span>{cot.clienteTel}</span></div>}
      <hr className="ticket-divider" />

      {cot.partidas.filter(p => p.tipo === 'VIDRIO').length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px dashed #aaa', paddingBottom: 2, margin: '5px 0 3px' }}>Vidrio</div>
          {cot.partidas.filter(p => p.tipo === 'VIDRIO').map((p, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
                <span>{p.piezas} · {p.tipoClaveLabel} · {p.largo_cm}×{p.ancho_cm}</span>
                <span>${fmt5(p.subtotal_vidrio)}</span>
              </div>
              {p.procesos?.map((pr, j) => (
                <div key={j} className="ticket-row" style={{ fontSize: 11, paddingLeft: 10 }}>
                  <span>+ {pr.nombre}</span><span>${fmt5(pr.subtotal)}</span>
                </div>
              ))}
              {p.procesos?.length > 0 && (
                <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
                  <span>Subtotal partida</span><span>${fmt5(p.subtotal_partida)}</span>
                </div>
              )}
            </div>
          ))}
        </>
      )}
      {cot.partidas.filter(p => p.tipo === 'MAQUILA').length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px dashed #aaa', paddingBottom: 2, margin: '5px 0 3px' }}>Maquila</div>
          {cot.partidas.filter(p => p.tipo === 'MAQUILA').map((p, i) => (
            <div key={i} className="ticket-row" style={{ fontSize: 12, marginBottom: 4 }}>
              <span>{p.cantidad} {p.unidad} — {p.descripcion}</span>
              <span style={{ fontWeight: 700 }}>${fmt5(p.subtotal_partida)}</span>
            </div>
          ))}
        </>
      )}
      {cot.partidas.filter(p => p.tipo === 'HERRAJE' || p.tipo === 'PRODUCTO').length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px dashed #aaa', paddingBottom: 2, margin: '5px 0 3px' }}>Herraje</div>
          {cot.partidas.filter(p => p.tipo === 'HERRAJE' || p.tipo === 'PRODUCTO').map((p, i) => (
            <div key={i} className="ticket-row" style={{ fontSize: 12, marginBottom: 4 }}>
              <span>{p.cantidad} · {p.descripcion}</span>
              <span style={{ fontWeight: 700 }}>${fmt5(p.subtotal_partida)}</span>
            </div>
          ))}
        </>
      )}

      <hr className="ticket-divider" />
      <div className="ticket-total"><span>TOTAL</span><span>${fmt5(cot.total)}</span></div>
      <hr className="ticket-divider" />
      <div style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 6 }}>
        Cotizacion con vigencia de 15 dias.
      </div>
    </div>
  )
}

// ── Modal convertir a pedido ──────────────────────────────────────────────
function ConvertirModal({ cotizacion, onClose, onCreado }) {
  const [formaPago, setFormaPago] = useState('LIQUIDADO')
  const [anticipo,  setAnticipo]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)
  const { addVenta } = useApp()

  const anticipoNum = parseFloat(anticipo) || 0
  const saldo = formaPago === 'ANTICIPO' ? cotizacion.total - anticipoNum : 0

  const handleConfirm = async () => {
    if (formaPago === 'ANTICIPO') {
      const n = parseFloat(anticipo)
      if (isNaN(n) || n <= 0)        { setError('Ingresa un monto de anticipo valido'); return }
      if (n >= cotizacion.total)     { setError('El anticipo debe ser menor al total'); return }
    }
    setSaving(true); setError(null)
    try {
      const monto    = formaPago === 'LIQUIDADO' ? cotizacion.total : parseFloat(anticipo)
      const idPedido = await convertirCotizacionAPedido(cotizacion.id, formaPago, monto)

      // Registrar productos herraje como venta en historial de ventas
      if (formaPago === 'LIQUIDADO') {
        const prodExtras = (cotizacion.partidas ?? []).filter(p => p.tipo === 'PRODUCTO')
        if (prodExtras.length > 0) {
          const ventaPartidas = prodExtras.map(p => ({
            key:               `cot-prod-${p._key ?? p.id_producto_general}`,
            tipo:              'GENERAL',
            productoId:        null,
            idProductoGeneral: p.id_producto_general,
            codigoProducto:    p.descripcion,
            descripcion:       p.descripcion,
            tono:              '',
            precioUnitario:    Number(p.precio_unitario),
            cantidad:          Number(p.cantidad),
            subtotal:          Number(p.subtotal_partida),
            stockDisponible:   null,
          }))
          const ventaRes = await addVenta(ventaPartidas)
          if (ventaRes?.error) throw new Error('Pedido creado. Error al registrar venta herraje: ' + ventaRes.error)
        }
      }

      const detalle = await getDetallePedido(idPedido)
      onCreado(detalle)
    } catch (err) {
      setError(err.message || 'Error al crear el pedido')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Convertir a pedido</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {cotizacion.folio} · ${fmt5(cotizacion.total)}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label required">Forma de pago</label>
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              {[['LIQUIDADO','Liquidado — pago total'],['ANTICIPO','Anticipo — pago parcial']].map(([val, lbl]) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="radio" name="fp" value={val} checked={formaPago === val} onChange={() => { setFormaPago(val); setError(null) }} />
                  {lbl}
                </label>
              ))}
            </div>
          </div>
          {formaPago === 'ANTICIPO' && (
            <div className="form-group">
              <label className="form-label required">Monto del anticipo ($)</label>
              <input
                className="form-input" type="number" min="0" step="0.01"
                value={anticipo} onChange={e => { setAnticipo(e.target.value); setError(null) }}
                placeholder="0.00" autoFocus
              />
              {anticipoNum > 0 && anticipoNum < cotizacion.total && (
                <div className="form-hint">Saldo pendiente: <strong>${saldo.toFixed(2)}</strong></div>
              )}
            </div>
          )}
          {formaPago === 'LIQUIDADO' && (
            <div className="alert alert-success" style={{ marginTop: 8 }}>
              El pedido quedara como <strong>Entregado</strong> y pasara al historial de ventas.
            </div>
          )}
          {formaPago === 'ANTICIPO' && (
            <div className="alert alert-warning" style={{ marginTop: 8 }}>
              El pedido quedara como <strong>Pendiente</strong> hasta que sea marcado como entregado.
            </div>
          )}
          {error && <div className="alert alert-error" style={{ marginTop: 8 }}>❌ {error}</div>}
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

// ── Badge de tipo ─────────────────────────────────────────────────────────
const TIPO_META = {
  VIDRIO:   { label: 'Vidrio',   bg: '#dbeafe', color: '#1d4ed8' },
  MAQUILA:  { label: 'Maquila',  bg: '#fef3c7', color: '#b45309' },
  PRODUCTO: { label: 'Herraje',  bg: '#dcfce7', color: '#15803d' },
}

// ── Pagina principal ──────────────────────────────────────────────────────
export default function CotizacionRegistrado() {
  const {
    clientes, tiposVidrio, procesos,
    getPrecioVidrio, getPrecioProceso,
    getPreciosClienteRegistrado, getPreciosEmpresa, getEmpresaDeCliente,
    iniciarCotizacion, agregarPartida, agregarPartidaExtra, finalizarCotizacion,
    getProductosGenerales,
  } = useCotizacion()

  // ── Cliente ───────────────────────────────────────────────────────────────
  const [clienteId,   setClienteId]   = useState('')
  const [preciosCli,  setPreciosCli]  = useState([])
  const [preciosEmp,  setPreciosEmp]  = useState([])
  const [empresaCli,  setEmpresaCli]  = useState(null)
  const [cargandoPr,  setCargandoPr]  = useState(false)

  // ── Tipo de partida activa ────────────────────────────────────────────────
  const [tipoPartida, setTipoPartida] = useState('VIDRIO')

  // ── Vidrio form ───────────────────────────────────────────────────────────
  const [tipoVidrioId,          setTipoVidrioId]          = useState('')
  const [notacion,              setNotacion]              = useState('')
  const [notError,              setNotError]              = useState('')
  const [procesosSeleccionados, setProcesosSeleccionados] = useState([])

  // ── Maquila/Servicio form ─────────────────────────────────────────────────
  const [maqDesc,     setMaqDesc]     = useState('')
  const [maqCantidad, setMaqCantidad] = useState('')
  const [maqPrecio,   setMaqPrecio]   = useState('')
  const [maqUnidad,   setMaqUnidad]   = useState('pza')
  const [maqError,    setMaqError]    = useState('')

  // ── Producto form ─────────────────────────────────────────────────────────
  const [productos,    setProductos]    = useState([])
  const [prodId,       setProdId]       = useState('')
  const [prodCantidad, setProdCantidad] = useState('')
  const [prodPrecio,   setProdPrecio]   = useState('')
  const [prodError,    setProdError]    = useState('')

  // ── Partidas + guardado ───────────────────────────────────────────────────
  const [partidas,       setPartidas]       = useState([])
  const [cotCreada,      setCotCreada]      = useState(null)
  const [saving,         setSaving]         = useState(false)
  const [saveError,      setSaveError]      = useState(null)
  const [convertirModal, setConvertirModal] = useState(false)
  const [pedidoCreado,   setPedidoCreado]   = useState(null)
  const [generandoPDF,   setGenerandoPDF]   = useState(false)

  // ── Cargar productos generales ────────────────────────────────────────────
  useEffect(() => {
    getProductosGenerales().then(res => {
      if (!res.error) setProductos(res.data ?? [])
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cargar precios del cliente ────────────────────────────────────────────
  useEffect(() => {
    if (!clienteId) { setPreciosCli([]); setPreciosEmp([]); setEmpresaCli(null); return }
    setCargandoPr(true)
    Promise.all([
      getPreciosClienteRegistrado(Number(clienteId)),
      getEmpresaDeCliente(Number(clienteId)),
    ])
      .then(async ([precios, emp]) => {
        setPreciosCli(precios ?? [])
        setEmpresaCli(emp)
        if (emp?.id_empresa) {
          const ep = await getPreciosEmpresa(emp.id_empresa)
          setPreciosEmp(ep ?? [])
        } else {
          setPreciosEmp([])
        }
      })
      .catch(() => { setPreciosCli([]); setPreciosEmp([]); setEmpresaCli(null) })
      .finally(() => setCargandoPr(false))
  }, [clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-llenar precio al seleccionar producto
  useEffect(() => {
    if (!prodId) { setProdPrecio(''); return }
    const prod = productos.find(p => p.id_producto_general === Number(prodId))
    if (prod?.precio != null) setProdPrecio(String(prod.precio))
    else setProdPrecio('')
  }, [prodId, productos])

  const clienteSeleccionado = clientes.find(c => c.id_cliente === Number(clienteId)) ?? null
  const tiposActivos        = tiposVidrio.filter(t => t.activo)
  const tipoSeleccionado    = tiposActivos.find(t => t.id_tipo_vidrio === Number(tipoVidrioId)) ?? null
  const procesosActivos     = procesos.filter(p => p.activo)

  // ── Precio helpers ────────────────────────────────────────────────────────
  const getPrecioVidrioCliente = (id_tipo_vidrio) => {
    const custom = preciosCli.find(p => p.id_tipo_vidrio === id_tipo_vidrio && (p.id_proceso ?? null) === null)
    if (custom) return Number(custom.precio_m2)
    if (clienteSeleccionado?.id_nivel_precio)
      return getPrecioVidrio(id_tipo_vidrio, clienteSeleccionado.id_nivel_precio)
    return null
  }

  const getPrecioProcesoCliente = (id_tipo_vidrio, id_proceso) => {
    const custom = preciosCli.find(p => p.id_tipo_vidrio === id_tipo_vidrio && p.id_proceso === id_proceso)
    if (custom) return Number(custom.precio_m2)
    const generic = preciosCli.find(p => (p.id_tipo_vidrio ?? null) === null && p.id_proceso === id_proceso)
    if (generic) return Number(generic.precio_m2)
    if (clienteSeleccionado?.id_nivel_precio)
      return getPrecioProceso(id_proceso, clienteSeleccionado.id_nivel_precio, tipoSeleccionado?.espesor?.id_espesor ?? null)
    return null
  }

  const getPrecioVidrioEmpresa = (id_tipo_vidrio) => {
    const custom = preciosEmp.find(p => p.id_tipo_vidrio === id_tipo_vidrio && (p.id_proceso ?? null) === null)
    if (custom) return Number(custom.precio_m2)
    if (clienteSeleccionado?.id_nivel_precio)
      return getPrecioVidrio(id_tipo_vidrio, clienteSeleccionado.id_nivel_precio)
    return null
  }

  const getPrecioProcesoEmpresa = (id_tipo_vidrio, id_proceso, id_espesor) => {
    const custom = preciosEmp.find(p => p.id_tipo_vidrio === id_tipo_vidrio && p.id_proceso === id_proceso)
    if (custom) return Number(custom.precio_m2)
    if (clienteSeleccionado?.id_nivel_precio)
      return getPrecioProceso(id_proceso, clienteSeleccionado.id_nivel_precio, id_espesor ?? null)
    return null
  }

  // ── Preview vidrio ────────────────────────────────────────────────────────
  const preview = useMemo(() => {
    if (tipoPartida !== 'VIDRIO') return null
    if (!notacion.trim() || !tipoVidrioId || !clienteId) return null
    if (cargandoPr) return null
    const parsed = parseNotacion(notacion)
    if (parsed.error) return { error: parsed.error }
    const precio_m2 = getPrecioVidrioCliente(Number(tipoVidrioId))
    if (precio_m2 === null) return { sinPrecio: true }
    const { piezas, largo, ancho } = parsed
    const metros2_total   = piezas * (largo * ancho) / 10000
    const subtotal_vidrio = metros2_total * precio_m2
    let subtotal_procesos = 0
    const procesosCalc = procesosSeleccionados.map(sp => {
      const proc = procesosActivos.find(p => p.id_proceso === sp.id_proceso)
      if (!proc) return null
      const unidad    = proc.unidad_cobro?.nombre ?? ''
      const unidadLow = unidad.toLowerCase()
      const cantidad  = (unidadLow === 'm2' || unidadLow === 'm²' || unidadLow.includes('cuadrado'))
        ? metros2_total
        : ((largo + ancho) * 2 / 100) * piezas
      const precio_unitario = getPrecioProcesoCliente(Number(tipoVidrioId), proc.id_proceso) ?? Number(proc.precio_unitario)
      const subtotal = cantidad * precio_unitario
      subtotal_procesos += subtotal
      return { id_proceso: proc.id_proceso, id_unidad_cobro: proc.id_unidad_cobro, nombre: proc.nombre, unidad, cantidad, precio_unitario, subtotal }
    }).filter(Boolean)
    return { piezas, largo, ancho, metros2_total, precio_m2, subtotal_vidrio, subtotal_procesos, subtotal_total: subtotal_vidrio + subtotal_procesos, procesosCalc }
  }, [notacion, tipoVidrioId, clienteId, procesosSeleccionados, preciosCli, cargandoPr, tipoPartida]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Agregar partida VIDRIO ────────────────────────────────────────────────
  const handleAgregarVidrio = () => {
    const parsed = parseNotacion(notacion)
    if (parsed.error)                         { setNotError(parsed.error); return }
    if (!tipoVidrioId)                        { setNotError('Selecciona un tipo de vidrio'); return }
    if (!clienteId)                           { setNotError('Selecciona un cliente'); return }
    if (!preview || preview.sinPrecio)        { setNotError('Sin precio para este tipo de vidrio'); return }

    const id_espesor     = tipoSeleccionado?.espesor?.id_espesor ?? null
    const precio_m2_emp  = getPrecioVidrioEmpresa(Number(tipoVidrioId)) ?? preview.precio_m2
    const metros2        = preview.metros2_total
    let subtotal_proc_emp = 0
    const procesos_emp = preview.procesosCalc.map(pr => {
      const p_unit = getPrecioProcesoEmpresa(Number(tipoVidrioId), pr.id_proceso, id_espesor) ?? pr.precio_unitario
      const sub    = pr.cantidad * p_unit
      subtotal_proc_emp += sub
      return { ...pr, precio_unitario: p_unit, subtotal: sub }
    })
    const subtotal_vidrio_emp  = metros2 * precio_m2_emp
    const subtotal_partida_emp = subtotal_vidrio_emp + subtotal_proc_emp

    setPartidas(prev => [...prev, {
      _key:               Date.now() + Math.random(),
      tipo:               'VIDRIO',
      id_tipo_vidrio:     Number(tipoVidrioId),
      tipoClaveLabel:     tipoSeleccionado.clave,
      piezas:             parsed.piezas,
      largo_cm:           parsed.largo,
      ancho_cm:           parsed.ancho,
      metros2,
      precio_m2_aplicado: preview.precio_m2,
      subtotal_vidrio:    preview.subtotal_vidrio,
      subtotal_procesos:  preview.subtotal_procesos,
      subtotal_partida:   preview.subtotal_total,
      procesos:           preview.procesosCalc,
      es_hoja_completa:   false,
      precio_m2_emp,
      subtotal_vidrio_emp,
      subtotal_proc_emp,
      subtotal_partida_emp,
      procesos_emp,
    }])
    setNotacion(''); setNotError(''); setProcesosSeleccionados([])
  }

  // ── Agregar partida MAQUILA ───────────────────────────────────────────────
  const handleAgregarMaquila = () => {
    if (!maqDesc.trim())                            { setMaqError('Ingresa una descripcion'); return }
    const cant = parseFloat(maqCantidad)
    const prec = parseFloat(maqPrecio)
    if (!cant || cant <= 0)                         { setMaqError('Ingresa una cantidad valida'); return }
    if (isNaN(prec) || prec < 0)                    { setMaqError('Ingresa un precio valido'); return }
    setPartidas(prev => [...prev, {
      _key:            Date.now() + Math.random(),
      tipo:            'MAQUILA',
      descripcion:     maqDesc.trim(),
      cantidad:        cant,
      unidad:          maqUnidad,
      precio_unitario: prec,
      subtotal_partida: cant * prec,
    }])
    setMaqDesc(''); setMaqCantidad(''); setMaqPrecio(''); setMaqError('')
  }

  // ── Agregar partida PRODUCTO ──────────────────────────────────────────────
  const handleAgregarProducto = () => {
    const prod = productos.find(p => p.id_producto_general === Number(prodId))
    if (!prod)                                      { setProdError('Selecciona un producto'); return }
    const cant = parseFloat(prodCantidad)
    const prec = parseFloat(prodPrecio)
    if (!cant || cant <= 0)                         { setProdError('Ingresa una cantidad valida'); return }
    if (isNaN(prec) || prec < 0)                    { setProdError('Ingresa un precio valido'); return }
    setPartidas(prev => [...prev, {
      _key:                Date.now() + Math.random(),
      tipo:                'PRODUCTO',
      id_producto_general: prod.id_producto_general,
      descripcion:         prod.nombre,
      cantidad:            cant,
      unidad:              prod.unidad ?? 'pza',
      precio_unitario:     prec,
      subtotal_partida:    cant * prec,
    }])
    setProdId(''); setProdCantidad(''); setProdPrecio(''); setProdError('')
  }

  const toggleProceso = (proc) =>
    setProcesosSeleccionados(prev =>
      prev.find(p => p.id_proceso === proc.id_proceso)
        ? prev.filter(p => p.id_proceso !== proc.id_proceso)
        : [...prev, { id_proceso: proc.id_proceso }]
    )

  const quitarPartida = (idx) =>
    requestAnimationFrame(() => setPartidas(prev => prev.filter((_, i) => i !== idx)))

  const totalGeneral = partidas.reduce((s, p) => s + p.subtotal_partida, 0)

  // ── Guardar cotizacion ────────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!clienteId)       { setSaveError('Selecciona un cliente'); return }
    if (!partidas.length) { setSaveError('Agrega al menos una partida'); return }
    setSaving(true); setSaveError(null)
    try {
      const { data: cot, error: e1 } = await iniciarCotizacion({
        id_nivel_precio: clienteSeleccionado?.id_nivel_precio ?? null,
        id_cliente:      Number(clienteId),
      })
      if (e1) throw new Error(e1)

      for (const p of partidas) {
        if (p.tipo === 'VIDRIO') {
          const { error: e2 } = await agregarPartida(cot.id_cotizacion, p)
          if (e2) throw new Error(e2)
        } else {
          const { error: e2 } = await agregarPartidaExtra(cot.id_cotizacion, {
            tipo:                p.tipo,
            descripcion:         p.descripcion,
            unidad:              p.unidad,
            cantidad:            p.cantidad,
            precio_unitario:     p.precio_unitario,
            subtotal:            p.subtotal_partida,
            id_producto_general: p.id_producto_general ?? null,
          })
          if (e2) throw new Error(e2)
        }
      }

      const { data: final, error: e3 } = await finalizarCotizacion(cot.id_cotizacion, totalGeneral)
      if (e3) throw new Error(e3)
      setCotCreada({
        id:            cot.id_cotizacion,
        folio:         final?.folio ?? cot.folio,
        clienteNombre: clienteSeleccionado?.nombre ?? '',
        clienteTel:    clienteSeleccionado?.telefono ?? null,
        nivelNombre:   clienteSeleccionado?.nivel_precio?.nombre ?? '',
        empresa:       empresaCli?.empresa ?? null,
        partidas,
        total:         totalGeneral,
      })
    } catch (err) {
      setSaveError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  const nueva = () => {
    setCotCreada(null); setPedidoCreado(null); setPartidas([])
    setSaveError(null); setTipoPartida('VIDRIO')
    setNotacion(''); setNotError(''); setProcesosSeleccionados([]); setTipoVidrioId('')
    setMaqDesc(''); setMaqCantidad(''); setMaqPrecio(''); setMaqError('')
    setProdId(''); setProdCantidad(''); setProdPrecio(''); setProdError('')
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  const exportarPDF = async () => {
    if (!cotCreada) return
    const vidrioPartidas = cotCreada.partidas
      .filter(p => p.tipo === 'VIDRIO')
      .map(p => ({
        piezas:           p.piezas,
        clave:            p.tipoClaveLabel,
        largo_cm:         p.largo_cm,
        ancho_cm:         p.ancho_cm,
        subtotal_vidrio:  p.subtotal_vidrio_emp ?? p.subtotal_vidrio,
        procesos:         p.procesos_emp ?? p.procesos,
        subtotal_partida: p.subtotal_partida_emp ?? p.subtotal_partida,
      }))
    const extrasPartidas = cotCreada.partidas
      .filter(p => p.tipo !== 'VIDRIO')
      .map(p => ({
        piezas:           p.cantidad,
        clave:            p.tipo === 'MAQUILA' ? 'SRV' : 'PROD',
        largo_cm:         0,
        ancho_cm:         0,
        subtotal_vidrio:  p.subtotal_partida,
        procesos:         [],
        subtotal_partida: p.subtotal_partida,
        descripcion:      p.descripcion,
        unidad:           p.unidad,
        precio_unitario:  p.precio_unitario,
      }))
    const todasPartidas = [...vidrioPartidas, ...extrasPartidas]
    const totalEmp = todasPartidas.reduce((s, p) => s + p.subtotal_partida, 0)
    setGenerandoPDF(true)
    try {
      await exportCotizacionPDF({
        tipo:          'cotizacion',
        folio:         cotCreada.folio,
        fecha:         new Date().toLocaleDateString('es-MX'),
        hora:          new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        clienteNombre: cotCreada.clienteNombre,
        clienteTel:    cotCreada.clienteTel,
        nivelNombre:   cotCreada.nivelNombre,
        empresa:       cotCreada.empresa,
        total:         totalEmp,
        partidas:      todasPartidas,
      })
    } finally {
      setGenerandoPDF(false)
    }
  }

  const imprimirTicket = () => {
    if (!cotCreada) return
    printTicketVidrio({
      tipo:          'cotizacion',
      folio:         cotCreada.folio,
      fecha:         new Date().toLocaleDateString('es-MX'),
      hora:          new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      clienteNombre: cotCreada.clienteNombre,
      clienteTel:    cotCreada.clienteTel,
      nivelNombre:   cotCreada.nivelNombre,
      total:         cotCreada.total,
      partidas:      cotCreada.partidas.map(p => {
        if (p.tipo === 'VIDRIO') return {
          tipo: 'VIDRIO',
          piezas: p.piezas, clave: p.tipoClaveLabel,
          largo_cm: p.largo_cm, ancho_cm: p.ancho_cm,
          subtotal_vidrio: p.subtotal_vidrio, procesos: p.procesos,
          subtotal_partida: p.subtotal_partida,
        }
        return {
          tipo: p.tipo,
          cantidad: p.cantidad, unidad: p.unidad,
          descripcion: p.descripcion,
          precio_unitario: p.precio_unitario,
          subtotal_partida: p.subtotal_partida,
        }
      }),
    })
  }

  const imprimirCotizacion = () => {
    if (!cotCreada) return
    printCotizacionCarta({
      tipo:          'cotizacion',
      folio:         cotCreada.folio,
      fecha:         new Date().toLocaleDateString('es-MX'),
      hora:          new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      clienteNombre: cotCreada.clienteNombre,
      clienteTel:    cotCreada.clienteTel,
      nivelNombre:   cotCreada.nivelNombre,
      empresa:       cotCreada.empresa,
      total:         cotCreada.total,
      partidas:      cotCreada.partidas.map(p => {
        if (p.tipo === 'VIDRIO') return {
          piezas: p.piezas, clave: p.tipoClaveLabel,
          largo_cm: p.largo_cm, ancho_cm: p.ancho_cm,
          subtotal_vidrio: p.subtotal_vidrio, procesos: p.procesos,
          subtotal_partida: p.subtotal_partida,
        }
        return {
          piezas: p.cantidad, clave: p.descripcion ?? '',
          largo_cm: 0, ancho_cm: 0,
          subtotal_vidrio: p.subtotal_partida, procesos: [],
          subtotal_partida: p.subtotal_partida,
        }
      }),
    })
  }

  // ── Vista: pedido creado ──────────────────────────────────────────────────
  if (pedidoCreado) {
    return (
      <div className="page-body" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div className="alert alert-success">
          ✅ Pedido <strong>{pedidoCreado.folio}</strong> creado correctamente.
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={nueva}>Nueva cotizacion</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => window.location.href = '/cot/pedidos-pendientes'}>
            Ver pedidos pendientes
          </button>
        </div>
      </div>
    )
  }

  // ── Vista: cotizacion guardada ────────────────────────────────────────────
  if (cotCreada) {
    return (
      <>
        <div className="page-header">
          <div>
            <div className="page-title">Cotizacion guardada</div>
            <div className="page-subtitle">{cotCreada.folio} · {cotCreada.clienteNombre}</div>
          </div>
        </div>
        <div className="page-body" style={{ maxWidth: 520, margin: '0 auto' }}>
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            ✅ Cotizacion guardada. Ya aparece en el <strong>Historial de Cotizaciones</strong>.
          </div>
          <TicketCotizacion cot={cotCreada} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={nueva}>Nueva cotizacion</button>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={imprimirTicket}>🎫 Ticket</button>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={imprimirCotizacion}>🖨️ Imprimir</button>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={exportarPDF} disabled={generandoPDF}>
              {generandoPDF ? 'Generando...' : '📄 PDF'}
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setConvertirModal(true)}>
              ✅ Convertir a pedido
            </button>
          </div>
        </div>
        {convertirModal && (
          <ConvertirModal
            cotizacion={cotCreada}
            onClose={() => setConvertirModal(false)}
            onCreado={(det) => { setConvertirModal(false); setPedidoCreado(det) }}
          />
        )}
      </>
    )
  }

  // ── Formulario ────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Cotizacion — Cliente Registrado</div>
          <div className="page-subtitle">Vidrio · Maquila · Herraje</div>
        </div>
      </div>

      <div className="page-body">
        {saveError && <div className="alert alert-error">{saveError}</div>}

        {/* 1. Cliente */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>1. Cliente</div>
          <select
            className="form-select"
            value={clienteId}
            onChange={e => { setClienteId(e.target.value); setPartidas([]) }}
          >
            <option value="">-- Seleccionar cliente --</option>
            {clientes.filter(c => c.activo).map(c => (
              <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>
            ))}
          </select>
          {clienteSeleccionado && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {clienteSeleccionado.telefono && <span>📞 {clienteSeleccionado.telefono}</span>}
              {clienteSeleccionado.nivel_precio && (
                <span>Nivel base: <strong>{clienteSeleccionado.nivel_precio.nombre}</strong></span>
              )}
              {cargandoPr
                ? <span>Cargando precios...</span>
                : preciosCli.length > 0
                  ? <span style={{ color: 'var(--accent)' }}>✓ {preciosCli.length} precio(s) especial(es)</span>
                  : <span style={{ color: 'var(--danger)' }}>⚠ Sin precios especiales de vidrio</span>
              }
            </div>
          )}
        </div>

        {/* 2. Agregar partida */}
        {clienteId && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>2. Agregar partida</div>

            {/* Selector de tipo */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[['VIDRIO','🪟 Vidrio'],['MAQUILA','Maquila'],['PRODUCTO','🧰 Herraje']].map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipoPartida(t)}
                  style={{
                    padding: '6px 14px', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontWeight: 600,
                    border: `2px solid ${tipoPartida === t ? TIPO_META[t].color : 'var(--border)'}`,
                    background: tipoPartida === t ? TIPO_META[t].bg : 'white',
                    color: tipoPartida === t ? TIPO_META[t].color : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >{label}</button>
              ))}
            </div>

            {/* ── VIDRIO ── */}
            {tipoPartida === 'VIDRIO' && (
              <>
                <div className="form-group">
                  <label className="form-label">Tipo de vidrio</label>
                  <select className="form-select" value={tipoVidrioId} onChange={e => setTipoVidrioId(e.target.value)}>
                    <option value="">-- Seleccionar --</option>
                    {tiposActivos.map(t => {
                      const precio = getPrecioVidrioCliente(t.id_tipo_vidrio)
                      return (
                        <option key={t.id_tipo_vidrio} value={t.id_tipo_vidrio}>
                          {t.clave} — {t.tono?.nombre} / {t.espesor?.etiqueta}
                          {precio !== null ? ` · $${precio.toFixed(2)}/m²` : ' · (sin precio)'}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Medidas <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>piezas-largoxancho (cm)</span>
                  </label>
                  <input
                    className="form-input"
                    placeholder="Ej: 3-22x45"
                    value={notacion}
                    onChange={e => { setNotacion(e.target.value); setNotError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleAgregarVidrio()}
                    inputMode="decimal"
                  />
                  {notError && <div className="form-error">{notError}</div>}
                </div>
                {procesosActivos.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Procesos (opcional)</label>
                    <div className="procesos-chips">
                      {procesosActivos.map(proc => {
                        const sel    = procesosSeleccionados.some(s => s.id_proceso === proc.id_proceso)
                        const precio = tipoVidrioId ? getPrecioProcesoCliente(Number(tipoVidrioId), proc.id_proceso) : null
                        return (
                          <button
                            key={proc.id_proceso} type="button"
                            className={`chip${sel ? ' chip-active' : ''}`}
                            onClick={() => toggleProceso(proc)}
                          >
                            {proc.nombre}{precio !== null ? ` $${precio.toFixed(2)}` : ''}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {preview && !preview.error && !preview.sinPrecio && (
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                      <span>{preview.piezas} pza · {preview.metros2_total.toFixed(4)} m² · ${preview.precio_m2.toFixed(2)}/m²</span>
                      <strong>${fmt5(preview.subtotal_total)}</strong>
                    </div>
                    {preview.procesosCalc.map(pr => (
                      <div key={pr.id_proceso} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        + {pr.nombre}: ${fmt5(pr.subtotal)}
                      </div>
                    ))}
                  </div>
                )}
                {preview?.sinPrecio && (
                  <div className="alert alert-error" style={{ marginBottom: 8 }}>
                    Sin precio configurado para este tipo de vidrio.
                  </div>
                )}
                <button className="btn btn-primary" onClick={handleAgregarVidrio} style={{ width: '100%' }}>
                  + Agregar vidrio
                </button>
              </>
            )}

            {/* ── MAQUILA / SERVICIO ── */}
            {tipoPartida === 'MAQUILA' && (
              <>
                <div className="form-group">
                  <label className="form-label">Descripcion del servicio *</label>
                  <input
                    className="form-input"
                    placeholder="Ej: Biselado espejo, Perforacion, Instalacion..."
                    value={maqDesc}
                    onChange={e => { setMaqDesc(e.target.value); setMaqError('') }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Cantidad *</label>
                    <input
                      className="form-input"
                      type="number" min="0.01" step="0.01"
                      placeholder="1"
                      value={maqCantidad}
                      onChange={e => { setMaqCantidad(e.target.value); setMaqError('') }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unidad</label>
                    <select className="form-select" value={maqUnidad} onChange={e => setMaqUnidad(e.target.value)}>
                      {['pza','m²','ml','m','kg','hora','jgo','lote'].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Precio / {maqUnidad} *</label>
                    <input
                      className="form-input"
                      type="number" min="0" step="0.01"
                      placeholder="0.00"
                      value={maqPrecio}
                      onChange={e => { setMaqPrecio(e.target.value); setMaqError('') }}
                    />
                  </div>
                </div>
                {maqCantidad && maqPrecio && parseFloat(maqCantidad) > 0 && parseFloat(maqPrecio) >= 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 14px', marginBottom: 10, fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{parseFloat(maqCantidad)} {maqUnidad} × ${parseFloat(maqPrecio).toFixed(2)}</span>
                    <strong>${(parseFloat(maqCantidad) * parseFloat(maqPrecio)).toFixed(2)}</strong>
                  </div>
                )}
                {maqError && <div className="form-error" style={{ marginBottom: 8 }}>{maqError}</div>}
                <button className="btn btn-primary" onClick={handleAgregarMaquila} style={{ width: '100%' }}>
                  + Agregar servicio
                </button>
              </>
            )}

            {/* ── PRODUCTO ── */}
            {tipoPartida === 'PRODUCTO' && (
              <>
                {productos.length === 0 ? (
                  <div className="alert alert-warning">
                    No hay productos en el catalogo. Agrega productos en el modulo de Productos.
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Producto *</label>
                      <select
                        className="form-select"
                        value={prodId}
                        onChange={e => { setProdId(e.target.value); setProdError('') }}
                      >
                        <option value="">-- Seleccionar producto --</option>
                        {productos.map(p => (
                          <option key={p.id_producto_general} value={p.id_producto_general}>
                            {p.nombre}
                            {p.precio != null ? ` · $${Number(p.precio).toFixed(2)}` : ''}
                            {p.unidad ? ` / ${p.unidad}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Cantidad *</label>
                        <input
                          className="form-input"
                          type="number" min="0.01" step="0.01"
                          placeholder="1"
                          value={prodCantidad}
                          onChange={e => { setProdCantidad(e.target.value); setProdError('') }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Precio unitario *</label>
                        <input
                          className="form-input"
                          type="number" min="0" step="0.01"
                          placeholder="0.00"
                          value={prodPrecio}
                          onChange={e => { setProdPrecio(e.target.value); setProdError('') }}
                        />
                      </div>
                    </div>
                    {prodId && prodCantidad && prodPrecio && parseFloat(prodCantidad) > 0 && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 14px', marginBottom: 10, fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{parseFloat(prodCantidad)} × ${parseFloat(prodPrecio).toFixed(2)}</span>
                        <strong>${(parseFloat(prodCantidad) * parseFloat(prodPrecio)).toFixed(2)}</strong>
                      </div>
                    )}
                    {prodError && <div className="form-error" style={{ marginBottom: 8 }}>{prodError}</div>}
                    <button className="btn btn-primary" onClick={handleAgregarProducto} style={{ width: '100%' }}>
                      + Agregar producto
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* 3. Resumen de partidas */}
        {partidas.length > 0 && (
          <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Partidas ({partidas.length})</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>
                {partidas.filter(p => p.tipo === 'VIDRIO').length > 0 &&
                  `${partidas.filter(p => p.tipo === 'VIDRIO').reduce((s, p) => s + p.metros2, 0).toFixed(3)} m² vidrio`}
              </span>
            </div>
            <table className="table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tipo</th>
                  <th>Descripcion</th>
                  <th>Cant.</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {partidas.map((p, i) => {
                  const meta = TIPO_META[p.tipo]
                  return (
                    <tr key={p._key}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{i + 1}</td>
                      <td>
                        <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {p.tipo === 'VIDRIO'
                          ? <><span className="badge badge-blue" style={{ marginRight: 4 }}>{p.tipoClaveLabel}</span>{p.piezas}pz · {p.largo_cm}×{p.ancho_cm}</>
                          : p.descripcion
                        }
                        {p.tipo !== 'VIDRIO' && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>${p.precio_unitario.toFixed(2)} / {p.unidad}</div>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {p.tipo === 'VIDRIO' ? `${p.metros2.toFixed(3)} m²` : `${p.cantidad} ${p.unidad}`}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>${fmt5(p.subtotal_partida)}</td>
                      <td>
                        <button className="btn-icon" title="Quitar"
                          onPointerDown={e => { e.preventDefault(); quitarPartida(i) }}>🗑️</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>
              Total: ${fmt5(totalGeneral)}
            </div>
          </div>
        )}

        {partidas.length > 0 && (
          <button
            className="btn btn-primary"
            style={{ width: '100%', fontSize: 16, padding: '13px 0' }}
            onClick={handleGuardar}
            disabled={saving}
          >
            {saving ? 'Guardando...' : '💾 Guardar cotizacion'}
          </button>
        )}
      </div>
    </>
  )
}
