import { useState, useEffect, useCallback } from 'react'
import { fmt5 } from '../../lib/utils'
import { Pencil, Eye, ArrowRightCircle, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCotizacion } from '../../context/CotizacionContext'
import { convertirCotizacionAPedido, getDetallePedido } from '../../lib/pedidosApi'
import {
  connectPrinter, disconnectPrinter, isPrinterConnected, printThermalVidrio, isWebSerialSupported,
} from '../../utils/thermalPrinter'
import { printTicketVidrio, printPedidoA4 } from '../../utils/ticket'

// ── Modal confirmar borrar cotización ────────────────────────────────────
function ConfirmBorrarModal({ cotizacion, onConfirm, onClose, loading }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ color: '#dc2626' }}>Borrar cotización</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              ¿Borrar <span style={{ color: '#dc2626' }}>{cotizacion.folio}</span>?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Cliente: <strong>{cotizacion.clienteNombre}</strong><br />
              Total: <strong>${fmt5(cotizacion.total)}</strong><br />
              Esta acción es permanente y no se puede deshacer.
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancelar</button>
          <button
            className="btn"
            style={{ background: '#dc2626', color: '#fff' }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Borrando...' : 'Sí, borrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hook impresora térmica ────────────────────────────────────────────────
function useThermal() {
  const [connected, setConnected] = useState(() => isPrinterConnected())
  const [busy,      setBusy]      = useState(false)
  const [error,     setError]     = useState(null)

  const handleConnect = async () => {
    setBusy(true); setError(null)
    try {
      if (connected) { await disconnectPrinter(); setConnected(false) }
      else { const ok = await connectPrinter({ baudRate: 9600 }); if (ok) setConnected(true) }
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  const handlePrint = async (normalizado) => {
    setBusy(true); setError(null)
    try { await printThermalVidrio(normalizado, { cols: 42 }) }
    catch (err) { setError(err.message); setConnected(false) }
    finally { setBusy(false) }
  }

  return { connected, busy, error, handleConnect, handlePrint }
}

// ── Ticket de pedido (para imprimir) ─────────────────────────────────────
function TicketPedido({ detalle }) {
  const esEntregado = detalle.estado === 'ENTREGADO'
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h2>
        <p style={{ fontWeight: 700 }}>ARTE EN VIDRIO</p>
        <p>Pedido vidrio</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Pedido:</span><strong>{detalle.folio}</strong></div>
      <div className="ticket-row"><span>Cotizacion:</span><span>COT-{String(detalle.id_cotizacion).padStart(5,'0')}</span></div>
      <div className="ticket-row"><span>Fecha:</span><span>{detalle.fecha}</span></div>
      <div className="ticket-row"><span>Cliente:</span><span>{detalle.cliente?.nombre ?? 'Mostrador'}</span></div>
      <div className="ticket-row"><span>Nivel:</span><span>{detalle.nivel?.es_hoja_completa ? 'POR HOJA' : (detalle.nivel?.nombre ?? '—')}</span></div>
      {detalle.observaciones && (
        <div className="ticket-row" style={{ flexDirection:'column', gap:2 }}>
          <span style={{ fontSize:11 }}>Observaciones:</span>
          <span style={{ fontSize:12 }}>{detalle.observaciones}</span>
        </div>
      )}
      <hr className="ticket-divider" />

      {detalle.partidas.map((p) => (
        <div key={p.id} style={{ marginBottom: 10 }}>
          <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
            <span>{p.cantidad} pza{p.cantidad > 1 ? 's' : ''} — {p.clave_vidrio} · {p.largo_cm}×{p.ancho_cm}</span>
            <span>${fmt5(p.subtotal_vidrio)}</span>
          </div>
          {p.descripcion_vidrio && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 14 }}>{p.descripcion_vidrio}</div>
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
      <div className="ticket-total"><span>TOTAL</span><span>${fmt5(detalle.total)}</span></div>
      <div className="ticket-row" style={{ marginTop: 6 }}>
        <span>Forma de pago:</span>
        <span>{detalle.forma_pago === 'LIQUIDADO' ? 'Liquidado' : 'Anticipo'}</span>
      </div>
      {detalle.forma_pago === 'ANTICIPO' && (
        <>
          <div className="ticket-row">
            <span>Anticipo pagado:</span>
            <span style={{ fontWeight: 600 }}>${detalle.anticipo.toFixed(2)}</span>
          </div>
          {!esEntregado && (
            <div className="ticket-row">
              <span>Saldo pendiente:</span>
              <span style={{ fontWeight: 700, color: 'var(--danger)' }}>${detalle.saldo.toFixed(2)}</span>
            </div>
          )}
          {esEntregado && detalle.saldo_cobrado != null && (
            <div className="ticket-row">
              <span>Saldo cobrado:</span>
              <span style={{ fontWeight: 600 }}>${detalle.saldo_cobrado.toFixed(2)}</span>
            </div>
          )}
        </>
      )}
      <hr className="ticket-divider" />
      <div style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', marginTop:8 }}>
        {esEntregado ? '¡Gracias por su compra!' : 'Pedido pendiente de entrega.'}
      </div>
    </div>
  )
}

// ── Modal: confirmar conversión a pedido ──────────────────────────────────
function ConvertirPedidoModal({ cotizacion, onClose, onCreado }) {
  const [formaPago,  setFormaPago]  = useState('LIQUIDADO')
  const [anticipo,   setAnticipo]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)

  const anticopoNum = parseFloat(anticipo) || 0
  const saldo = formaPago === 'ANTICIPO' ? cotizacion.total - anticopoNum : 0

  const handleConfirm = async () => {
    if (formaPago === 'ANTICIPO') {
      const n = parseFloat(anticipo)
      if (isNaN(n) || n <= 0)           { setError('Ingresa un monto de anticipo valido'); return }
      if (n >= cotizacion.total)        { setError('El anticipo debe ser menor al total'); return }
    }
    setSaving(true)
    setError(null)
    try {
      const montoAnticipo = formaPago === 'LIQUIDADO' ? cotizacion.total : parseFloat(anticipo)
      const idPedido = await convertirCotizacionAPedido(cotizacion.id, formaPago, montoAnticipo)
      const detalle  = await getDetallePedido(idPedido)
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
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              <strong>{cotizacion.folio}</strong>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Total destacado */}
          <div style={{
            background: 'var(--accent)', borderRadius: 12, padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 20,
          }}>
            <span style={{ color: 'white', fontSize: 13, fontWeight: 600, opacity: 0.85 }}>Total a cobrar</span>
            <span style={{ color: 'white', fontSize: 32, fontWeight: 800, letterSpacing: '-1px' }}>
              ${fmt5(cotizacion.total)}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label required">Forma de pago</label>
            <div style={{ display:'flex', gap:16, marginTop:6 }}>
              {[['LIQUIDADO','Liquidado — pago total'],['ANTICIPO','Anticipo — pago parcial']].map(([val, label]) => (
                <label key={val} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14 }}>
                  <input
                    type="radio" name="formaPago" value={val}
                    checked={formaPago === val}
                    onChange={() => { setFormaPago(val); setError(null) }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {formaPago === 'ANTICIPO' && (
            <div className="form-group">
              <label className="form-label required">Monto del anticipo ($)</label>
              <input
                className="form-input"
                type="number" min="0" step="0.01"
                value={anticipo}
                onChange={e => { setAnticipo(e.target.value); setError(null) }}
                placeholder="0.00"
                autoFocus
              />
              {anticopoNum > 0 && anticopoNum < cotizacion.total && (
                <div className="form-hint">
                  Saldo pendiente: <strong>${saldo.toFixed(2)}</strong>
                </div>
              )}
            </div>
          )}

          {formaPago === 'LIQUIDADO' && (
            <div className="alert alert-success" style={{ marginTop: 8 }}>
              El pedido quedara como <strong>Listo / Entregado al momento</strong> y pasara directamente al historial de ventas.
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

// ── Modal: pedido creado (ticket) ─────────────────────────────────────────
function PedidoCreadoModal({ detalle, onClose }) {
  const { connected, busy, error: printerError, handleConnect, handlePrint } = useThermal()

  const normalizado = {
    tipo:          'pedido',
    folio:         detalle.folio,
    foliosCot:     `COT-${String(detalle.id_cotizacion).padStart(5, '0')}`,
    fecha:         detalle.fecha,
    hora:          detalle.hora ?? '',
    clienteNombre: detalle.cliente?.nombre ?? 'Mostrador',
    nivelNombre:   detalle.nivel?.es_hoja_completa ? 'POR HOJA' : (detalle.nivel?.nombre ?? ''),
    formaPago:     detalle.forma_pago,
    anticipo:      detalle.anticipo,
    saldo:         detalle.saldo,
    saldo_cobrado: detalle.saldo_cobrado,
    esEntregado:   detalle.estado === 'ENTREGADO',
    total:         detalle.total,
    partidas: [
      ...detalle.partidas.map(p => ({
        piezas:           p.cantidad,
        clave:            p.clave_vidrio,
        largo_cm:         p.largo_cm,
        ancho_cm:         p.ancho_cm,
        subtotal_vidrio:  p.subtotal_vidrio,
        procesos:         p.procesos,
        subtotal_partida: p.subtotal_partida,
      })),
      ...(detalle.extras ?? []).map(e => ({
        tipo:             e.tipo === 'HERRAJE' || e.tipo === 'PRODUCTO' ? e.tipo : 'MAQUILA',
        descripcion:      e.descripcion,
        cantidad:         e.cantidad,
        precio_unitario:  e.precio_unitario != null ? Number(e.precio_unitario) : null,
        subtotal_partida: Number(e.subtotal),
        procesos:         [],
      })),
    ],
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Pedido creado — {detalle.folio}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {detalle.estado === 'ENTREGADO' ? 'Liquidado · Entregado al momento' : 'Pendiente de entrega'}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-success">
            ✅ Pedido <strong>{detalle.folio}</strong> creado correctamente.
          </div>
          {printerError && <div className="alert alert-error">🖨️ {printerError}</div>}
          <TicketPedido detalle={detalle} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          <button className="btn btn-outline" onClick={() => printTicketVidrio(normalizado)}>🖨️ Ticket</button>
          <button className="btn btn-outline" onClick={() => printPedidoA4(normalizado)}>🖨️ Hoja</button>
          <button
            className="btn btn-outline"
            onClick={handleConnect}
            disabled={busy}
            title={connected ? 'Desconectar impresora' : 'Conectar impresora térmica'}
            style={{ display: isWebSerialSupported() ? undefined : 'none' }}
          >
            {connected ? '🔌 Desconectar' : '🔌 Conectar impresora'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handlePrint(normalizado)}
            disabled={!connected || busy}
            style={{ display: isWebSerialSupported() ? undefined : 'none' }}
          >
            {busy ? 'Imprimiendo...' : '🖨️ Imprimir térmica'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Ticket de cotización (modal detalle) ──────────────────────────────────
function TicketDetalleCot({ detalle }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h2>
        <p style={{ fontWeight: 700 }}>ARTE EN VIDRIO</p>
        <p>Pedido vidrio</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Folio:</span><strong>{detalle.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{detalle.fecha}</span></div>
      <div className="ticket-row"><span>Hora:</span><span>{detalle.hora}</span></div>
      <div className="ticket-row"><span>Cliente:</span><span>{detalle.cliente?.nombre ?? 'Mostrador'}</span></div>
      <div className="ticket-row"><span>Nivel:</span><span>{detalle.nivel?.es_hoja_completa ? 'POR HOJA' : (detalle.nivel?.nombre ?? '—')}</span></div>
      {detalle.observaciones && (
        <div className="ticket-row" style={{ flexDirection:'column', gap:2 }}>
          <span style={{ fontSize:11 }}>Observaciones:</span>
          <span style={{ fontSize:12 }}>{detalle.observaciones}</span>
        </div>
      )}
      <hr className="ticket-divider" />
      {detalle.partidas.length > 0 && (
        <>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px dashed #aaa', paddingBottom:2, margin:'5px 0 3px' }}>Vidrio</div>
          {detalle.partidas.map((p) => (
            <div key={p.id} style={{ marginBottom: 8 }}>
              <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
                <span>{p.piezas ?? 1} · {p.tipoVidrio?.clave ?? '?'} · {p.largo_cm}×{p.ancho_cm}</span>
                <span>${fmt5(p.subtotal_vidrio)}</span>
              </div>
              {p.procesos.map((pr, j) => (
                <div key={j} className="ticket-row" style={{ fontSize: 11, paddingLeft: 10 }}>
                  <span>+ {pr.nombre}</span>
                  <span>${fmt5(pr.subtotal)}</span>
                </div>
              ))}
              {p.procesos.length > 0 && (
                <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
                  <span>Subtotal partida</span>
                  <span>${fmt5(p.subtotal_partida)}</span>
                </div>
              )}
            </div>
          ))}
        </>
      )}
      {(detalle.extras ?? []).filter(e => e.tipo === 'MAQUILA').length > 0 && (
        <>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px dashed #aaa', paddingBottom:2, margin:'5px 0 3px' }}>Maquila</div>
          {(detalle.extras ?? []).filter(e => e.tipo === 'MAQUILA').map(e => (
            <div key={e.id} className="ticket-row" style={{ fontSize:12, marginBottom:4 }}>
              <span>{e.cantidad} {e.unidad} — {e.descripcion}</span>
              <span style={{ fontWeight:700 }}>${fmt5(e.subtotal)}</span>
            </div>
          ))}
        </>
      )}
      {(detalle.extras ?? []).filter(e => e.tipo === 'PRODUCTO').length > 0 && (
        <>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px dashed #aaa', paddingBottom:2, margin:'5px 0 3px' }}>Herraje</div>
          {(detalle.extras ?? []).filter(e => e.tipo === 'PRODUCTO').map(e => (
            <div key={e.id} className="ticket-row" style={{ fontSize:12, marginBottom:4 }}>
              <span>{e.cantidad} · {e.descripcion}</span>
              <span style={{ fontWeight:700 }}>${fmt5(e.subtotal)}</span>
            </div>
          ))}
        </>
      )}
      <hr className="ticket-divider" />
      <div className="ticket-total">
        <span>TOTAL</span>
        <span>${fmt5(detalle.total)}</span>
      </div>
      <hr className="ticket-divider" />
      <div style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', marginTop:8 }}>
        Esta cotizacion tiene una vigencia de 15 dias.
      </div>
    </div>
  )
}

// ── Modal detalle de cotización ───────────────────────────────────────────
function DetalleModal({ resumen, onClose, onConvertir, onEditar }) {
  const { getDetalleCotizacion } = useCotizacion()
  const [detalle, setDetalle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const { connected, busy, error: printerError, handleConnect, handlePrint } = useThermal()

  useEffect(() => {
    getDetalleCotizacion(resumen.id).then(({ data, error: err }) => {
      if (err) setError(err)
      else setDetalle(data)
      setLoading(false)
    })
  }, [resumen.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const normalizado = detalle ? {
    tipo:          'cotizacion',
    folio:         detalle.folio,
    fecha:         detalle.fecha,
    hora:          detalle.hora ?? '',
    clienteNombre: detalle.cliente?.nombre ?? 'Mostrador',
    nivelNombre:   detalle.nivel?.es_hoja_completa ? 'POR HOJA' : (detalle.nivel?.nombre ?? ''),
    esEntregado:   false,
    total:         detalle.total,
    partidas: [
      ...detalle.partidas.map(p => ({
        tipo:             'VIDRIO',
        piezas:           p.piezas ?? 1,
        clave:            p.tipoVidrio?.clave ?? '?',
        largo_cm:         p.largo_cm,
        ancho_cm:         p.ancho_cm,
        subtotal_vidrio:  p.subtotal_vidrio,
        procesos:         p.procesos,
        subtotal_partida: p.subtotal_partida,
      })),
      ...(detalle.extras ?? []).map(e => ({
        tipo:             e.tipo === 'MAQUILA' ? 'MAQUILA' : 'PRODUCTO',
        cantidad:         e.cantidad,
        unidad:           e.unidad,
        descripcion:      e.descripcion,
        precio_unitario:  e.precio_unitario,
        subtotal_partida: e.subtotal,
      })),
    ],
  } : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Detalle — {resumen.folio}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {resumen.fecha} · {resumen.hora}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
              Cargando detalle...
            </div>
          )}
          {error && <div className="alert alert-error">❌ {error}</div>}
          {printerError && <div className="alert alert-error">🖨️ {printerError}</div>}
          {detalle && <TicketDetalleCot detalle={detalle} />}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          {detalle && (
            <>
              <button className="btn btn-outline" onClick={() => printTicketVidrio(normalizado)}>🖨️ Ticket</button>
              <button className="btn btn-outline" onClick={() => printPedidoA4(normalizado)}>🖨️ Hoja</button>
              {isWebSerialSupported() && (
                <>
                  <button
                    className="btn btn-outline"
                    onClick={handleConnect}
                    disabled={busy}
                    title={connected ? 'Desconectar impresora' : 'Conectar impresora térmica'}
                  >
                    {connected ? '🔌 Desconectar' : '🔌 Conectar impresora'}
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => handlePrint(normalizado)}
                    disabled={!connected || busy}
                  >
                    {busy ? 'Imprimiendo...' : '🖨️ Imprimir térmica'}
                  </button>
                </>
              )}
              {resumen.estatus !== 'CANCELADA' && (
                <button
                  className="btn btn-outline"
                  onClick={() => onEditar(detalle)}
                >
                  ✏️ Editar
                </button>
              )}
            </>
          )}
          {resumen.estatus === 'FINALIZADA' && (
            <button
              className="btn btn-primary"
              onClick={() => onConvertir(resumen)}
              disabled={loading || !!error}
            >
              ✅ Aceptar y convertir en pedido
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Badges de estatus maquila ─────────────────────────────────────────────
const BADGE_MAQUILA = {
  BORRADOR:   { label: 'Borrador',   bg: '#e5e7eb', color: '#374151' },
  FINALIZADA: { label: 'Finalizada', bg: '#dbeafe', color: '#1d4ed8' },
  CONVERTIDA: { label: 'Convertida', bg: '#dcfce7', color: '#16a34a' },
}

// ── Modal detalle de cotizacion maquila ───────────────────────────────────
function DetalleMaquilaModal({ cotId, onClose, onReopenOk, onConvertidoOk }) {
  const { getDetalleCotizacionMaquila, reabrirCotizacion, convertirMaquilaAPedido } = useCotizacion()
  const [detalle,  setDetalle]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [paso,     setPaso]     = useState('detalle')
  const [tipoPago, setTipoPago] = useState('ANTICIPO')
  const [anticipo, setAnticipo] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [pedido,   setPedido]   = useState(null)

  useEffect(() => {
    getDetalleCotizacionMaquila(cotId).then(res => {
      if (res.error) { setError(res.error); setLoading(false); return }
      setDetalle(res.data); setLoading(false)
    })
  }, [cotId, getDetalleCotizacionMaquila])

  const handleReabrir = async () => {
    setSaving(true); setError(null)
    const res = await reabrirCotizacion(cotId)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onReopenOk()
  }

  const handleConvertir = async () => {
    const montAnt = tipoPago === 'LIQUIDADO' ? detalle.total : Number(anticipo)
    if (tipoPago === 'ANTICIPO' && (isNaN(montAnt) || montAnt < 0)) { setError('Ingresa un anticipo valido'); return }
    setSaving(true); setError(null)
    const res = await convertirMaquilaAPedido({ id_cotizacion: cotId, tipo_pago: tipoPago, monto_anticipo: montAnt })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setPedido(res.data); setPaso('ok')
  }

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal"><div className="modal-body" style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>Cargando...</div></div>
    </div>
  )

  if (paso === 'ok') return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onConvertidoOk()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Pedido creado</div>
          <button className="btn-icon" onClick={onConvertidoOk}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-success">✅ Pedido <strong>{pedido.folio}</strong> creado exitosamente.</div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onConvertidoOk}>Cerrar</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth:640 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{detalle?.folio ?? '—'}</div>
            {detalle && (
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                {detalle.fecha} · {detalle.cliente?.nombre ?? 'Mostrador'}
                {detalle.nivel && <span className="badge badge-gray" style={{ marginLeft:8, fontSize:11 }}>{detalle.nivel.nombre}</span>}
              </div>
            )}
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">❌ {error}</div>}
          {detalle && paso === 'detalle' && (
            <>
              <div style={{ background:'var(--bg)', borderRadius:8, padding:'10px 16px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, color:'var(--text-muted)' }}>Total cotizacion</span>
                <span style={{ fontWeight:700, fontSize:20 }}>${fmt5(detalle.total)}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {detalle.partidas.map((p, i) => (
                  <div key={p.id} style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'white' }}>
                      <div style={{ width:26, height:26, borderRadius:6, background:'var(--accent)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>{i + 1}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:14 }}>{p.cantidad} pza{p.cantidad !== 1 ? 's' : ''} · {p.largo_cm}×{p.ancho_cm} cm</div>
                        {p.descripcion && <div style={{ fontSize:12, color:'var(--text-muted)' }}>{p.descripcion}</div>}
                      </div>
                      <div style={{ fontWeight:700, fontSize:15, color:'var(--accent)', flexShrink:0 }}>${fmt5(p.subtotal_partida)}</div>
                    </div>
                    {p.procesos?.length > 0 && (
                      <div style={{ background:'var(--bg)', borderTop:'1px solid var(--border)', padding:'6px 14px 6px 54px' }}>
                        {p.procesos.map((pr, j) => (
                          <div key={j} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-muted)', paddingBottom: j < p.procesos.length - 1 ? 3 : 0 }}>
                            <span>+ {pr.nombre} {pr.cantidad_unidades !== 1 ? `× ${pr.cantidad_unidades}` : ''}</span>
                            <span>${fmt5(pr.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {paso === 'convertir' && detalle && (
            <>
              <div style={{ background:'var(--bg)', borderRadius:8, padding:'10px 14px', marginBottom:14 }}>
                <div style={{ fontSize:13, color:'var(--text-muted)' }}>Total cotizacion</div>
                <div style={{ fontWeight:700, fontSize:22 }}>${fmt5(detalle.total)}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de pago</label>
                <select className="form-input" value={tipoPago} onChange={e => setTipoPago(e.target.value)}>
                  <option value="ANTICIPO">Anticipo</option>
                  <option value="LIQUIDADO">Liquidado (pago total)</option>
                </select>
              </div>
              {tipoPago === 'ANTICIPO' && (
                <div className="form-group">
                  <label className="form-label">Monto de anticipo ($)</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={anticipo}
                    onChange={e => setAnticipo(e.target.value)} placeholder="0.00" />
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          {paso === 'detalle' ? (
            <>
              <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
              {detalle?.estatus === 'FINALIZADA' && (
                <>
                  <button className="btn btn-outline" onClick={handleReabrir} disabled={saving}>{saving ? '...' : '↩ Reabrir'}</button>
                  <button className="btn btn-primary" onClick={() => setPaso('convertir')}>📋 Convertir a pedido</button>
                </>
              )}
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => setPaso('detalle')} disabled={saving}>Volver</button>
              <button className="btn btn-primary" onClick={handleConvertir} disabled={saving}>{saving ? 'Creando pedido...' : 'Confirmar pedido'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pagina Historial de Cotizaciones ──────────────────────────────────────
export default function HistorialCotizaciones() {
  const { getCotizaciones, getDetalleCotizacion, getCotizacionesMaquila, borrarCotizacion } = useCotizacion()
  const navigate = useNavigate()

  // ── Pestaña activa ────────────────────────────────────────────────────────
  const [tab, setTab] = useState('vidrio')

  // ── Estado pestaña vidrio ────────────────────────────────────────────────
  const [cotizaciones,   setCotizaciones]   = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [fechaDesde,     setFechaDesde]     = useState('')
  const [fechaHasta,     setFechaHasta]     = useState('')
  const [filtroEstatus,  setFiltroEstatus]  = useState('todos')
  const [seleccionada,   setSeleccionada]   = useState(null)
  const [convertirCot,   setConvertirCot]   = useState(null)
  const [pedidoCreado,   setPedidoCreado]   = useState(null)
  const [editandoId,     setEditandoId]     = useState(null)
  const [borrandoId,     setBorrandoId]     = useState(null)
  const [confirmBorrar,  setConfirmBorrar]  = useState(null)

  // ── Estado pestaña maquila ───────────────────────────────────────────────
  const [busqueda,      setBusqueda]      = useState('')

  // ── Estado pestaña maquila ───────────────────────────────────────────────
  const [cotsMaq,       setCotsMaq]       = useState([])
  const [loadingMaq,    setLoadingMaq]    = useState(false)
  const [errorMaq,      setErrorMaq]      = useState(null)
  const [selIdMaq,      setSelIdMaq]      = useState(null)
  const [maqCargada,    setMaqCargada]    = useState(false)

  const cargar = async () => {
    setLoading(true)
    const { data, error: err } = await getCotizaciones()
    if (err) setError(err)
    else setCotizaciones(data ?? [])
    setLoading(false)
  }

  const cargarMaquila = useCallback(async () => {
    setLoadingMaq(true)
    const res = await getCotizacionesMaquila()
    setLoadingMaq(false)
    if (res.error) { setErrorMaq(res.error); return }
    setCotsMaq(res.data ?? [])
    setMaqCargada(true)
  }, [getCotizacionesMaquila])

  useEffect(() => {
    if (tab === 'maquila' && !maqCargada) cargarMaquila()
  }, [tab, maqCargada, cargarMaquila])

  const handleEditar = async (detalle) => {
    navigate('/cot/nueva', { state: { cotEdit: detalle } })
  }

  const handleEditarDesdeTabla = async (resumen) => {
    setEditandoId(resumen.id)
    const { data, error: err } = await getDetalleCotizacion(resumen.id)
    setEditandoId(null)
    if (err) return
    navigate('/cot/nueva', { state: { cotEdit: data } })
  }

  const handleBorrar = async () => {
    if (!confirmBorrar) return
    setBorrandoId(confirmBorrar.id)
    const { error: err } = await borrarCotizacion(confirmBorrar.id)
    setBorrandoId(null)
    if (err) { alert('Error al borrar: ' + err); setConfirmBorrar(null); return }
    setCotizaciones(prev => prev.filter(c => c.id !== confirmBorrar.id))
    setConfirmBorrar(null)
  }

  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const q = busqueda.trim().toLowerCase()

  const filtered = cotizaciones.filter(c => {
    if (filtroEstatus !== 'todos' && c.estatus !== filtroEstatus) return false
    if (fechaDesde || fechaHasta) {
      const f = new Date(c.fechaISO)
      if (fechaDesde && f < new Date(fechaDesde))              return false
      if (fechaHasta && f > new Date(fechaHasta + 'T23:59:59')) return false
    }
    if (q) {
      const hayMatch =
        c.folio?.toLowerCase().includes(q) ||
        c.clienteNombre?.toLowerCase().includes(q) ||
        c.nivelNombre?.toLowerCase().includes(q)
      if (!hayMatch) return false
    }
    return true
  })

  const filteredMaq = q
    ? cotsMaq.filter(c =>
        c.folio?.toLowerCase().includes(q) ||
        c.clienteNombre?.toLowerCase().includes(q) ||
        c.nivelNombre?.toLowerCase().includes(q)
      )
    : cotsMaq

  const totalPeriodo = filtered.reduce((s, c) => s + c.total, 0)

  const estatusBadge = (est) => {
    if (est === 'FINALIZADA')  return <span className="badge badge-green">Finalizada</span>
    if (est === 'CANCELADA')   return <span className="badge badge-red">Cancelada</span>
    if (est === 'CONVERTIDA')  return <span className="badge badge-blue">Convertida</span>
    return <span className="badge badge-orange">Borrador</span>
  }

  if (loading) return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)' }}>
      Cargando historial...
    </div>
  )

  if (error) return (
    <div className="page-body">
      <div className="alert alert-error">❌ {error}</div>
      <button className="btn btn-outline" onClick={cargar}>Reintentar</button>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Historial de Cotizaciones</div>
          <div className="page-subtitle">
            {tab === 'vidrio'
              ? `${cotizaciones.length} cotizacion${cotizaciones.length !== 1 ? 'es' : ''} de vidrio`
              : `${cotsMaq.length} cotizacion${cotsMaq.length !== 1 ? 'es' : ''} de maquila`}
          </div>
        </div>
        <button className="btn btn-outline" onClick={tab === 'vidrio' ? cargar : cargarMaquila}>
          ↻ Actualizar
        </button>
      </div>

      <div className="page-body">
        {/* Pestañas */}
        <div style={{ display:'flex', gap:6, marginBottom:20 }}>
          {[['vidrio','◻ Cotizaciones vidrio'],['maquila','🔨 Maquila']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:'7px 18px', borderRadius:8, fontSize:13, cursor:'pointer', fontWeight:600,
              border:`2px solid ${tab===t ? 'var(--accent)' : 'var(--border)'}`,
              background: tab===t ? 'var(--accent)' : 'white',
              color: tab===t ? 'white' : 'var(--text)',
              transition:'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {/* ── Pestaña Maquila ── */}
        {tab === 'maquila' && (
          <>
            {loadingMaq && <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>Cargando...</div>}
            {errorMaq && <div className="alert alert-error">❌ {errorMaq}</div>}
            {!loadingMaq && !errorMaq && filteredMaq.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🔨</div>
                <h3>{q ? 'Sin resultados' : 'Sin cotizaciones de maquila'}</h3>
                <p>{q ? 'Intenta con otro término de búsqueda' : 'Las cotizaciones convertidas a pedido no aparecen aqui'}</p>
              </div>
            )}
            {!loadingMaq && filteredMaq.length > 0 && (
              <>
                {/* ── Tabla (desktop) ── */}
                <div className="hist-desktop">
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Folio</th><th>Fecha</th><th>Cliente</th><th>Nivel</th>
                          <th style={{ textAlign:'right' }}>Total</th><th>Estatus</th><th style={{ width:70 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMaq.map(c => {
                          const badge = BADGE_MAQUILA[c.estatus] ?? { label: c.estatus, bg:'#e5e7eb', color:'#374151' }
                          return (
                            <tr key={c.id} style={{ cursor:'pointer' }} onClick={() => setSelIdMaq(c.id)}>
                              <td><span className="badge badge-orange">{c.folio}</span></td>
                              <td style={{ fontSize:14, color:'var(--text-muted)' }}>{c.fecha}</td>
                              <td style={{ fontWeight:600 }}>{c.clienteNombre}</td>
                              <td>{c.nivelNombre ? <span className="badge badge-gray">{c.nivelNombre}</span> : <span style={{ color:'var(--text-muted)' }}>—</span>}</td>
                              <td style={{ textAlign:'right', fontWeight:600 }}>{c.total > 0 ? `$${fmt5(c.total)}` : '—'}</td>
                              <td><span style={{ padding:'3px 9px', borderRadius:5, fontSize:11, fontWeight:700, background:badge.bg, color:badge.color }}>{badge.label}</span></td>
                              <td>
                                <button className="btn btn-outline btn-sm" style={{ display:'flex', alignItems:'center', padding:'4px 8px' }} onClick={e => { e.stopPropagation(); setSelIdMaq(c.id) }}>
                                  <Eye size={14} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Tarjetas (tablet / móvil) ── */}
                <div className="hist-mobile">
                  {filteredMaq.map(c => {
                    const badge = BADGE_MAQUILA[c.estatus] ?? { label: c.estatus, bg:'#e5e7eb', color:'#374151' }
                    return (
                      <div key={c.id} className="hist-card" onClick={() => setSelIdMaq(c.id)}>
                        <div className="hist-card-header">
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span className="badge badge-orange">{c.folio}</span>
                            <span style={{ padding:'3px 9px', borderRadius:5, fontSize:11, fontWeight:700, background:badge.bg, color:badge.color }}>{badge.label}</span>
                          </div>
                          <span style={{ fontWeight:700, fontSize:17, color:'var(--accent)' }}>
                            {c.total > 0 ? `$${fmt5(c.total)}` : <span style={{ color:'var(--text-muted)', fontSize:14 }}>Sin total</span>}
                          </span>
                        </div>
                        <div className="hist-card-body">
                          <div style={{ fontWeight:600, fontSize:15 }}>{c.clienteNombre}</div>
                          <div style={{ display:'flex', gap:8, marginTop:3, alignItems:'center' }}>
                            <span style={{ fontSize:13, color:'var(--text-muted)' }}>{c.fecha}</span>
                            {c.nivelNombre && <span className="badge badge-gray" style={{ fontSize:11 }}>{c.nivelNombre}</span>}
                          </div>
                        </div>
                        <div className="hist-card-footer" onClick={e => e.stopPropagation()}>
                          <div />
                          <button className="btn btn-outline btn-sm" onClick={() => setSelIdMaq(c.id)} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px' }}>
                            <Eye size={13} /> Ver
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            {selIdMaq && (
              <DetalleMaquilaModal
                cotId={selIdMaq}
                onClose={() => setSelIdMaq(null)}
                onReopenOk={() => { setSelIdMaq(null); setMaqCargada(false); cargarMaquila() }}
                onConvertidoOk={() => { setSelIdMaq(null); setMaqCargada(false); cargarMaquila() }}
              />
            )}
          </>
        )}

        {/* ── Pestaña Vidrio ── */}
        {tab === 'vidrio' && <>
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total cotizaciones</div>
            <div className="stat-value">{cotizaciones.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">En periodo</div>
            <div className="stat-value">{filtered.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monto en periodo</div>
            <div className="stat-value" style={{ fontSize:18 }}>${fmt5(totalPeriodo)}</div>
          </div>
        </div>

        {/* Buscador */}
        <div className="search-bar" style={{ marginBottom:12 }}>
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              type="text"
              placeholder="Buscar por folio, cliente o nivel..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          {busqueda && (
            <button className="btn btn-outline btn-sm" onClick={() => setBusqueda('')}>✕ Limpiar</button>
          )}
        </div>

        {/* Filtros */}
        <div className="filter-bar" style={{ marginBottom:20 }}>
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>Fecha:</span>
          <input type="date" className="filter-select" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>al</span>
          <input type="date" className="filter-select" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          <select className="filter-select" value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="FINALIZADA">Finalizada</option>
            <option value="CANCELADA">Cancelada</option>
            <option value="CONVERTIDA">Convertida</option>
          </select>
          {(fechaDesde || fechaHasta || filtroEstatus !== 'todos') && (
            <button className="btn btn-outline btn-sm" onClick={() => { setFechaDesde(''); setFechaHasta(''); setFiltroEstatus('todos') }}>
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Lista / tabla vidrio */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3>Sin cotizaciones</h3>
            <p>
              {fechaDesde || fechaHasta || filtroEstatus !== 'todos'
                ? 'Ajusta los filtros para ver resultados'
                : 'Las cotizaciones apareceran aqui una vez que guardes la primera'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Tabla (desktop) ── */}
            <div className="hist-desktop">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Nivel</th>
                      <th style={{ textAlign:'right' }}>Total</th>
                      <th>Estado</th>
                      <th style={{ width:160 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.id} style={{ cursor:'pointer', opacity: c.estatus === 'CANCELADA' ? 0.55 : 1 }} onClick={() => setSeleccionada(c)}>
                        <td><span className="badge badge-blue">{c.folio}</span></td>
                        <td style={{ fontSize:14 }}>{c.fecha} <span style={{ color:'var(--text-muted)', fontSize:13 }}>{c.hora}</span></td>
                        <td style={{ fontWeight:500 }}>{c.clienteNombre}</td>
                        <td><span className="badge badge-gray">{c.nivelNombre}</span></td>
                        <td style={{ textAlign:'right', fontWeight:700, color:'var(--accent)' }}>${fmt5(c.total)}</td>
                        <td>{estatusBadge(c.estatus)}</td>
                        <td onClick={e => e.stopPropagation()} style={{ display:'flex', gap:6 }}>
                          {c.estatus !== 'CANCELADA' && (
                            <button className="btn btn-outline btn-sm" title="Editar" onClick={() => handleEditarDesdeTabla(c)} disabled={editandoId === c.id} style={{ display:'flex', alignItems:'center', padding:'4px 8px' }}>
                              {editandoId === c.id ? '…' : <Pencil size={14} />}
                            </button>
                          )}
                          {c.estatus === 'FINALIZADA' && (
                            <button className="btn btn-primary btn-sm" title="Convertir a pedido" onClick={() => setConvertirCot(c)} style={{ display:'flex', alignItems:'center', padding:'4px 8px' }}>
                              <ArrowRightCircle size={14} />
                            </button>
                          )}
                          {c.estatus !== 'CONVERTIDA' && (
                            <button className="btn btn-outline btn-sm" title="Borrar" onClick={() => setConfirmBorrar(c)} style={{ display:'flex', alignItems:'center', padding:'4px 8px', color:'#dc2626', borderColor:'#dc2626' }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Tarjetas (tablet / móvil) ── */}
            <div className="hist-mobile">
              {filtered.map(c => (
                <div key={c.id} className="hist-card" style={{ opacity: c.estatus === 'CANCELADA' ? 0.55 : 1 }} onClick={() => setSeleccionada(c)}>
                  <div className="hist-card-header">
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span className="badge badge-blue">{c.folio}</span>
                      {estatusBadge(c.estatus)}
                    </div>
                    <span style={{ fontWeight:700, fontSize:17, color:'var(--accent)', flexShrink:0 }}>${fmt5(c.total)}</span>
                  </div>
                  <div className="hist-card-body">
                    <div style={{ fontWeight:600, fontSize:15 }}>{c.clienteNombre}</div>
                    <div style={{ display:'flex', gap:8, marginTop:3, alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ fontSize:13, color:'var(--text-muted)' }}>{c.fecha} {c.hora}</span>
                      {c.nivelNombre && <span className="badge badge-gray" style={{ fontSize:11 }}>{c.nivelNombre}</span>}
                    </div>
                  </div>
                  <div className="hist-card-footer" onClick={e => e.stopPropagation()}>
                    <div />
                    <div style={{ display:'flex', gap:6 }}>
                      {c.estatus !== 'CANCELADA' && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleEditarDesdeTabla(c)} disabled={editandoId === c.id} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px' }}>
                          {editandoId === c.id ? '…' : <><Pencil size={13} /> Editar</>}
                        </button>
                      )}
                      {c.estatus === 'FINALIZADA' && (
                        <button className="btn btn-primary btn-sm" onClick={() => setConvertirCot(c)} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px' }}>
                          <ArrowRightCircle size={13} /> Pedido
                        </button>
                      )}
                      <button className="btn btn-outline btn-sm" onClick={() => setSeleccionada(c)} style={{ padding:'5px 10px' }}>Ver</button>
                      {c.estatus !== 'CONVERTIDA' && (
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmBorrar(c)} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', color:'#dc2626', borderColor:'#dc2626' }}>
                          <Trash2 size={13} /> Borrar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        </>}
      </div>

      {/* Modals pestaña vidrio */}
      {seleccionada && !convertirCot && !pedidoCreado && (
        <DetalleModal
          resumen={seleccionada}
          onClose={() => setSeleccionada(null)}
          onConvertir={(cot) => { setConvertirCot(cot); setSeleccionada(null) }}
          onEditar={handleEditar}
        />
      )}

      {/* Modal conversión */}
      {convertirCot && !pedidoCreado && (
        <ConvertirPedidoModal
          cotizacion={convertirCot}
          onClose={() => setConvertirCot(null)}
          onCreado={(detallePedido) => {
            setConvertirCot(null)
            setPedidoCreado(detallePedido)
            cargar() // refresca la lista para mostrar CONVERTIDA
          }}
        />
      )}

      {/* Modal pedido creado */}
      {pedidoCreado && (
        <PedidoCreadoModal
          detalle={pedidoCreado}
          onClose={() => setPedidoCreado(null)}
        />
      )}
      {confirmBorrar && (
        <ConfirmBorrarModal
          cotizacion={confirmBorrar}
          onConfirm={handleBorrar}
          onClose={() => setConfirmBorrar(null)}
          loading={borrandoId === confirmBorrar.id}
        />
      )}
    </>
  )
}
