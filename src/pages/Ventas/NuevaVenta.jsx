import { useState, useEffect } from 'react'
import { fmt5 } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import { printTicket } from '../../utils/ticket'
import {
  isWebSerialSupported,
  isPrinterConnected,
  connectPrinter,
  disconnectPrinter,
  printThermal,
} from '../../utils/thermalPrinter'

// ── Buscador unificado (herraje + generales) ──────────────────────────────
function BuscadorProducto({ productos, productosGenerales, onAdd }) {
  const [query, setQuery] = useState('')

  // Normalizar ambos catálogos a un formato común
  const catalogo = [
    ...productos.map(p => ({
      key:              p.codigo,
      tipo:             'HERRAJE',
      id:               p.id,
      codigo:           p.codigo,
      descripcion:      p.descripcion,
      tono:             p.tono || '',
      precio:           Number(p.precio),
      existencias:      p.existencias,
      imagen:           p.imagen || '',
    })),
    ...(productosGenerales ?? []).map(pg => ({
      key:              `pg-${pg.id_producto_general}`,
      tipo:             'GENERAL',
      id:               pg.id_producto_general,
      codigo:           null,
      descripcion:      pg.nombre,
      tono:             '',
      precio:           Number(pg.precio ?? 0),
      existencias:      pg.existencias ?? 0,
      imagen:           '',
      unidad:           pg.unidad ?? '',
    })),
  ]

  const resultados = query.trim()
    ? catalogo.filter(p =>
        p.descripcion.toLowerCase().includes(query.toLowerCase()) ||
        (p.codigo ?? '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  const handleSelect = (prod) => {
    onAdd(prod)
    setQuery('')
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="search-input-wrap" style={{ maxWidth: '100%' }}>
        <span className="search-icon">🔍</span>
        <input
          className="search-input"
          placeholder="Buscar producto por código o descripción..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      {resultados.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'white', border: '1.5px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden',
          marginTop: 4,
        }}>
          {resultados.map(prod => (
            <button
              key={prod.key}
              type="button"
              onClick={() => handleSelect(prod)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              {prod.imagen ? (
                <img src={prod.imagen} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
              ) : (
                <div style={{ width: 40, height: 40, background: 'var(--bg)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {prod.tipo === 'GENERAL' ? '🧰' : '📦'}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{prod.descripcion}</span>
                  {prod.tipo === 'GENERAL' && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                      background: '#fef3c7', color: '#92400e', letterSpacing: '0.3px',
                    }}>GENERAL</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {prod.tipo === 'GENERAL'
                    ? `${prod.unidad || 'pza'} · $${prod.precio.toFixed(2)}`
                    : `${prod.codigo} · ${prod.tono || '—'} · $${prod.precio.toFixed(2)}`}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600 }}
                className={prod.existencias < 5 ? 'stock-low' : 'stock-ok'}>
                <div className="stock-indicator" style={{ gap: 4 }}>
                  <div className="stock-dot" />
                  {prod.existencias} pzas
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {query.trim() && resultados.length === 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'white', border: '1.5px solid var(--border)', borderRadius: 8,
          padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
          marginTop: 4,
        }}>
          No se encontraron productos
        </div>
      )}
    </div>
  )
}

// ── Vista previa del ticket ───────────────────────────────────────────────
function TicketPreview({ venta }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>TEMPLADOS CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>ARTE EN VIDRIO</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Folio:</span><strong>{venta.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{venta.fecha}</span></div>
      <div className="ticket-row"><span>Hora:</span><span>{venta.hora}</span></div>
      <hr className="ticket-divider" />
      {venta.partidas.map((p, i) => (
        <div key={i} style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>
          {p.cantidad} - {p.descripcion}{p.tono ? ` · ${p.tono}` : ''} x ${fmt5(p.precioUnitario)}
        </div>
      ))}
      <hr className="ticket-divider" />
      <div className="ticket-total">
        <span>TOTAL</span>
        <span>${fmt5(venta.total)}</span>
      </div>
      <hr className="ticket-divider" />
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        ¡Gracias por su compra!
      </div>
      <hr className="ticket-divider" />
      <div style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong>POLÍTICAS DE DEVOLUCIÓN</strong><br />
        No se devuelve el dinero.<br />
        Sí se realiza cambio de producto.
      </div>
    </div>
  )
}

// ── Página Nueva Venta ────────────────────────────────────────────────────
export default function NuevaVenta() {
  const { productos, productosGenerales, addVenta } = useApp()
  const [partidas, setPartidas] = useState([])
  const [ventaCreada, setVentaCreada] = useState(null)

  // Estado impresora térmica
  const [printerConnected, setPrinterConnected] = useState(() => isPrinterConnected())
  const [printerBusy,      setPrinterBusy]      = useState(false)
  const [printerError,     setPrinterError]     = useState(null)
  const [paperCols,        setPaperCols]        = useState(42) // 42 = 80mm, 32 = 58mm

  // Sincroniza estado al mostrar pantalla de ticket
  useEffect(() => {
    setPrinterConnected(isPrinterConnected())
  }, [ventaCreada])

  const handleConnectPrinter = async () => {
    setPrinterBusy(true)
    setPrinterError(null)
    try {
      if (printerConnected) {
        await disconnectPrinter()
        setPrinterConnected(false)
      } else {
        const ok = await connectPrinter({ baudRate: 9600 })
        if (ok) setPrinterConnected(true)
      }
    } catch (err) {
      setPrinterError(err.message)
    } finally {
      setPrinterBusy(false)
    }
  }

  const handlePrintThermal = async () => {
    setPrinterBusy(true)
    setPrinterError(null)
    try {
      await printThermal(ventaCreada, { cols: paperCols })
    } catch (err) {
      setPrinterError(err.message)
      setPrinterConnected(false)
    } finally {
      setPrinterBusy(false)
    }
  }

  const total = partidas.reduce((s, p) => s + p.subtotal, 0)

  const [stockError, setStockError] = useState(null)

  const agregarProducto = (prod) => {
    // Bloquear si no hay stock
    if (prod.existencias <= 0) {
      setStockError(`Sin stock: "${prod.descripcion}" no tiene unidades disponibles.`)
      setTimeout(() => setStockError(null), 3500)
      return
    }
    setStockError(null)
    setPartidas(prev => {
      const existe = prev.find(p => p.key === prod.key)
      if (existe) {
        const nuevaCantidad = (Number(existe.cantidad) || 0) + 1
        if (prod.existencias != null && nuevaCantidad > prod.existencias) {
          setStockError(`Stock insuficiente: solo hay ${prod.existencias} pza(s) de "${prod.descripcion}".`)
          setTimeout(() => setStockError(null), 3500)
          return prev
        }
        return prev.map(p =>
          p.key === prod.key
            ? { ...p, cantidad: nuevaCantidad, subtotal: nuevaCantidad * p.precioUnitario }
            : p
        )
      }
      return [...prev, {
        key:               prod.key,
        tipo:              prod.tipo,
        productoId:        prod.tipo === 'HERRAJE' ? prod.id : null,
        idProductoGeneral: prod.tipo === 'GENERAL' ? prod.id : null,
        codigoProducto:    prod.codigo ?? prod.key,
        descripcion:       prod.descripcion,
        tono:              prod.tono || '',
        precioUnitario:    Number(prod.precio),
        cantidad:          1,
        subtotal:          Number(prod.precio),
        stockDisponible:   prod.existencias,
      }]
    })
  }

  const actualizarCantidad = (key, nueva) => {
    setPartidas(prev => prev.map(p => {
      if (p.key !== key) return p
      if (nueva === '') return { ...p, cantidad: '', subtotal: 0 }
      let n = Math.max(1, parseInt(nueva) || 1)
      if (p.stockDisponible != null) n = Math.min(n, p.stockDisponible)
      return { ...p, cantidad: n, subtotal: n * p.precioUnitario }
    }))
  }

  const quitarPartida = (key) => {
    setPartidas(prev => prev.filter(p => p.key !== key))
  }

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const confirmarVenta = async () => {
    if (!partidas.length) return
    setSaving(true)
    setSaveError(null)
    const { data, error } = await addVenta(partidas)
    setSaving(false)
    if (error) { setSaveError(error); return }
    setVentaCreada(data)
    setPartidas([])
  }

  const nuevaVenta = () => {
    setVentaCreada(null)
    setPartidas([])
    window.scrollTo(0, 0)
  }

  // ── Pantalla de ticket confirmado ────────────────────────────────────────
  if (ventaCreada) {
    const webSerialDisponible = isWebSerialSupported()
    return (
      <>
        <div className="page-header">
          <div>
            <div className="page-title">Venta registrada</div>
            <div className="page-subtitle">Folio {ventaCreada.folio} — {ventaCreada.fecha} {ventaCreada.hora}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

            {/* Impresora térmica solo en escritorio con Web Serial */}
            {webSerialDisponible && (
              <>
                <button
                  className="btn btn-outline"
                  onClick={handleConnectPrinter}
                  disabled={printerBusy}
                  style={{ borderColor: printerConnected ? '#22c55e' : undefined, color: printerConnected ? '#16a34a' : undefined }}
                >
                  {printerBusy ? '⏳' : printerConnected ? '🟢 Conectada' : '🔌 Impresora'}
                </button>
                {printerConnected && (
                  <>
                    <select
                      value={paperCols}
                      onChange={e => setPaperCols(Number(e.target.value))}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 13 }}
                    >
                      <option value={42}>80 mm</option>
                      <option value={32}>58 mm</option>
                    </select>
                    <button className="btn btn-accent" onClick={handlePrintThermal} disabled={printerBusy}>
                      🖨️ Térmica
                    </button>
                  </>
                )}
              </>
            )}

            <button className="btn btn-outline" onClick={() => printTicket(ventaCreada, '80mm')}>
              🖨️ Imprimir
            </button>
            <button className="btn btn-primary" onClick={nuevaVenta}>
              + Nueva venta
            </button>
          </div>
        </div>
        <div className="page-body">
          {printerError && <div className="alert alert-error">⚠️ {printerError}</div>}
          <div className="alert alert-success">
            ✅ Venta registrada correctamente. Las existencias han sido actualizadas.
          </div>
          <TicketPreview venta={ventaCreada} />
        </div>
      </>
    )
  }

  // ── Formulario de nueva venta ─────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Nueva venta</div>
          <div className="page-subtitle">Agrega los productos y confirma la venta</div>
        </div>
        {partidas.length > 0 && (
          <button
            className="btn btn-accent"
            onClick={confirmarVenta}
            disabled={saving}
          >
            {saving ? 'Guardando…' : `✓ Confirmar venta — $${fmt5(total)}`}
          </button>
        )}
      </div>

      <div className="page-body">
        {saveError && (
          <div className="alert alert-error">❌ {saveError}</div>
        )}
        {stockError && (
          <div className="alert alert-error">⚠️ {stockError}</div>
        )}
        <div className="venta-grid">

          {/* Columna izquierda: búsqueda y partidas */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
                Agregar producto
              </div>
              <BuscadorProducto
                productos={productos}
                productosGenerales={productosGenerales}
                onAdd={agregarProducto}
              />
            </div>

            {partidas.length > 0 ? (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
                  Partidas ({partidas.length})
                </div>
                <div className="venta-items-list">
                  {partidas.map(p => (
                    <div className="venta-item" key={p.key}>
                      <div className="venta-item-desc">
                        <strong>{p.descripcion}</strong>
                        <small>
                          {p.tipo === 'GENERAL'
                            ? <span style={{ color: '#92400e', fontWeight: 600 }}>General</span>
                            : p.codigoProducto}
                          {p.tono ? ` · ${p.tono}` : ''}
                        </small>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        ${p.precioUnitario.toFixed(2)} c/u
                      </div>
                      <div className="venta-qty-ctrl">
                        <button
                          className="stock-btn"
                          onClick={() => actualizarCantidad(p.key, p.cantidad - 1)}
                          disabled={p.cantidad <= 1 || p.cantidad === ''}
                        >−</button>
                        <input
                          className="venta-qty-input"
                          type="number"
                          min="0"
                          value={p.cantidad}
                          onChange={(e) => {
                            const value = e.target.value
                            if (value === '') {
                              setPartidas(prev => prev.map(item =>
                                item.key === p.key
                                  ? { ...item, cantidad: '', subtotal: 0 }
                                  : item
                              ))
                            } else {
                              actualizarCantidad(p.key, value)
                            }
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '') {
                              actualizarCantidad(p.key, 1)
                            }
                          }}
                        />
                        <button
                          className="stock-btn"
                          onClick={() => actualizarCantidad(p.key, p.cantidad + 1)}
                          disabled={p.cantidad === '' || (p.stockDisponible != null && p.cantidad >= p.stockDisponible)}
                        >+</button>
                      </div>
                      <div className="venta-subtotal">${fmt5(p.subtotal)}</div>
                      <button
                        className="btn-icon danger"
                        onClick={() => quitarPartida(p.key)}
                        title="Quitar"
                      >✕</button>
                    </div>
                  ))}
                </div>
                <div className="venta-total-bar">
                  <span>Total de la venta</span>
                  <strong>${fmt5(total)}</strong>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🛒</div>
                <h3>Sin partidas</h3>
                <p>Busca y agrega los productos que el cliente va a llevar</p>
              </div>
            )}
          </div>

          {/* Columna derecha: resumen (oculta en móvil) */}
          <div className="venta-side-summary" style={{ position: 'sticky', top: 80 }}>
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Resumen</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Productos distintos</span>
                <span style={{ fontWeight: 600 }}>{partidas.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Total de piezas</span>
                <span style={{ fontWeight: 600 }}>
                  {partidas.reduce((s, p) => s + (Number(p.cantidad) || 0), 0)}
                </span>
              </div>
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary)' }}>${fmt5(total)}</span>
              </div>
              <button
                className="btn btn-accent"
                style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
                onClick={confirmarVenta}
                disabled={partidas.length === 0}
              >
                {saving ? 'Guardando…' : '✓ Confirmar venta'}
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

      {/* ── Barra inferior fija (solo móvil, cuando hay partidas) ─── */}
      {partidas.length > 0 && (
        <div className="venta-mobile-bar">
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total · {partidas.length} prod.
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', lineHeight: 1.1 }}>
              ${fmt5(total)}
            </div>
          </div>
          <button
            className="btn btn-accent"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={confirmarVenta}
            disabled={saving}
          >
            {saving ? 'Guardando…' : '✓ Confirmar venta'}
          </button>
        </div>
      )}
    </>
  )
}
