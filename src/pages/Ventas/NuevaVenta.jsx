import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { printTicket } from '../../utils/ticket'
import {
  isPrinterConnected,
  connectPrinter,
  disconnectPrinter,
  printThermal,
} from '../../utils/thermalPrinter'

// ── Buscador de productos ─────────────────────────────────────────────────
function BuscadorProducto({ productos, onAdd }) {
  const [query, setQuery] = useState('')

  const resultados = query.trim()
    ? productos.filter(p =>
        p.descripcion.toLowerCase().includes(query.toLowerCase()) ||
        (p.codigo ?? '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
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
              key={prod.codigo}
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
                <div style={{ width: 40, height: 40, background: 'var(--bg)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{prod.descripcion}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {prod.codigo} · {prod.tono || '—'} · ${Number(prod.precio).toFixed(2)}
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
        <h2>HERRAJES CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>ARTE EN VIDRIO</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Folio:</span><strong>{venta.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{venta.fecha}</span></div>
      <div className="ticket-row"><span>Hora:</span><span>{venta.hora}</span></div>
      <hr className="ticket-divider" />
      <table className="ticket-table">
        <thead>
          <tr>
            <th>Cant.</th>
            <th>Descripción</th>
            <th>Tono</th>
            <th className="right">P.U.</th>
            <th className="right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {venta.partidas.map((p, i) => (
            <tr key={i}>
              <td>{p.cantidad}</td>
              <td>{p.descripcion}</td>
              <td>{p.tono || '—'}</td>
              <td className="right">${Number(p.precioUnitario).toFixed(2)}</td>
              <td className="right">${Number(p.subtotal).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="ticket-divider" />
      <div className="ticket-total">
        <span>TOTAL</span>
        <span>${Number(venta.total).toFixed(2)}</span>
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
  const { productos, addVenta } = useApp()
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

  const agregarProducto = (prod) => {
    setPartidas(prev => {
      const existe = prev.find(p => p.codigoProducto === prod.codigo)
      if (existe) {
        return prev.map(p =>
          p.codigoProducto === prod.codigo
            ? { ...p, cantidad: p.cantidad + 1, subtotal: (p.cantidad + 1) * p.precioUnitario }
            : p
        )
      }
      return [...prev, {
        productoId:     prod.id,
        codigoProducto: prod.codigo,
        descripcion:    prod.descripcion,
        tono:           prod.tono || '',
        precioUnitario: Number(prod.precio),
        cantidad:       1,
        subtotal:       Number(prod.precio),
      }]
    })
  }

  const actualizarCantidad = (codigo, nueva) => {
    const n = nueva === '' ? '' : Math.max(1, parseInt(nueva) || 1)
    setPartidas(prev => prev.map(p =>
      p.codigoProducto === codigo
        ? { ...p, cantidad: n, subtotal: n === '' ? 0 : n * p.precioUnitario }
        : p
    ))
  }

  const quitarPartida = (codigo) => {
    setPartidas(prev => prev.filter(p => p.codigoProducto !== codigo))
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
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // ── Pantalla de ticket confirmado ────────────────────────────────────────
  if (ventaCreada) {
    return (
      <>
        <div className="page-header">
          <div>
            <div className="page-title">Venta registrada</div>
            <div className="page-subtitle">Folio {ventaCreada.folio} — {ventaCreada.fecha} {ventaCreada.hora}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>

            {/* ── Impresora Térmica ── */}
            <button
              className={`btn ${printerConnected ? 'btn-outline' : 'btn-outline'}`}
              onClick={handleConnectPrinter}
              disabled={printerBusy}
              title={printerConnected ? 'Haz clic para desconectar' : 'Conectar impresora de calor'}
              style={{ borderColor: printerConnected ? '#22c55e' : undefined, color: printerConnected ? '#16a34a' : undefined }}
            >
              {printerBusy ? '⏳' : printerConnected ? '🟢 Impresora conectada' : '🔌 Conectar impresora'}
            </button>

            {printerConnected && (
              <>
                <select
                  value={paperCols}
                  onChange={e => setPaperCols(Number(e.target.value))}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 13 }}
                  title="Ancho del papel"
                >
                  <option value={42}>Papel 80 mm</option>
                  <option value={32}>Papel 58 mm</option>
                </select>
                <button
                  className="btn btn-accent"
                  onClick={handlePrintThermal}
                  disabled={printerBusy}
                >
                  🖨️ Imprimir térmica
                </button>
              </>
            )}

            {/* ── Impresión normal ── */}
            <button className="btn btn-outline" onClick={() => printTicket(ventaCreada, '80mm')}>
              🖨️ Ticket 80 mm
            </button>
            <button className="btn btn-outline" onClick={() => printTicket(ventaCreada, 'carta')}>
              🖨️ Hoja carta
            </button>
            <button className="btn btn-primary" onClick={nuevaVenta}>
              + Nueva venta
            </button>
          </div>
        </div>
        <div className="page-body">
          {printerError && (
            <div className="alert alert-error">⚠️ {printerError}</div>
          )}
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
            {saving ? 'Guardando…' : `✓ Confirmar venta — $${total.toFixed(2)}`}
          </button>
        )}
      </div>

      <div className="page-body">
        {saveError && (
          <div className="alert alert-error">❌ {saveError}</div>
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
                    <div className="venta-item" key={p.codigoProducto}>
                      <div className="venta-item-desc">
                        <strong>{p.descripcion}</strong>
                        <small>{p.codigoProducto} · {p.tono || '—'}</small>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        ${p.precioUnitario.toFixed(2)} c/u
                      </div>
                      <div className="venta-qty-ctrl">
                        <button
                          className="stock-btn"
                          onClick={() => actualizarCantidad(p.codigoProducto, p.cantidad - 1)}
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
                                item.codigoProducto === p.codigoProducto
                                  ? { ...item, cantidad: '', subtotal: 0 }
                                  : item
                              ))
                            } else {
                              actualizarCantidad(p.codigoProducto, value)
                            }
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '') {
                              actualizarCantidad(p.codigoProducto, 1)
                            }
                          }}
                        />
                        <button
                          className="stock-btn"
                          onClick={() => actualizarCantidad(p.codigoProducto, p.cantidad + 1)}
                          disabled={p.cantidad === ''}
                        >+</button>
                      </div>
                      <div className="venta-subtotal">${p.subtotal.toFixed(2)}</div>
                      <button
                        className="btn-icon danger"
                        onClick={() => quitarPartida(p.codigoProducto)}
                        title="Quitar"
                      >✕</button>
                    </div>
                  ))}
                </div>
                <div className="venta-total-bar">
                  <span>Total de la venta</span>
                  <strong>${total.toFixed(2)}</strong>
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
                  {partidas.reduce((s, p) => s + p.cantidad, 0)}
                </span>
              </div>
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary)' }}>${total.toFixed(2)}</span>
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
              ${total.toFixed(2)}
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
