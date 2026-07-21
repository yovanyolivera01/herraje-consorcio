import { useState, useEffect, useCallback } from 'react'
import { fmt5, hoyMX, lunesMX } from '../../lib/utils'
import * as XLSX from 'xlsx'
import { getPedidosEntregados, getDetallePedido, getPedidosParaExport, getPedidosCancelados, getPedidosPendientes, marcarComoEntregado } from '../../lib/pedidosApi'
import { getPedidosPendientesMaquila } from '../../lib/maquilaApi'
import { getClientes } from '../../lib/cotizacionApi'
import { crearCFDI, getCFDIPdfUrl, getCFDIXmlUrl } from '../../lib/facturamaApi'
import { printTicketVidrio, printPedidoA4 } from '../../utils/ticket'

function parseMaqNotas(notas) {
  try {
    const parsed = notas ? JSON.parse(notas) : null
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch { return null }
}

// ── Ticket de pedido entregado ────────────────────────────────────────────
function TicketVenta({ detalle }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h2>
        <p style={{ fontWeight: 700 }}>COMPROBANTE DE VENTA</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Pedido:</span><strong>{detalle.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{detalle.fecha}</span></div>
      <div className="ticket-row"><span>Entregado:</span><span>{detalle.fechaEntrega}</span></div>
      <div className="ticket-row"><span>Cliente:</span><span>{detalle.cliente?.nombre ?? 'Mostrador'}</span></div>
      <hr className="ticket-divider" />

      {detalle.partidas.length === 0 && (detalle.extras ?? []).length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}>
          Sin partidas registradas
        </div>
      )}

      {detalle.partidas.map((p, i) => (
        <div key={p.id} style={{ marginBottom: 10 }}>
          <div className="ticket-row" style={{ fontWeight: 700, fontSize: 12 }}>
            <span>{p.cantidad} - {p.clave_vidrio}</span>
            <span>${fmt5(p.subtotal_partida)}</span>
          </div>
          <div className="ticket-row" style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 10 }}>
            <span>{p.largo_cm} × {p.ancho_cm} cm</span>
          </div>
          {p.procesos.map((pr, j) => (
            <div key={j} className="ticket-row" style={{ fontSize: 11, paddingLeft: 10 }}>
              <span>+ {pr.nombre}</span>
              <span>${fmt5(pr.subtotal)}</span>
            </div>
          ))}
        </div>
      ))}

      {(detalle.extras ?? []).length > 0 && (
        <>
          {detalle.partidas.length > 0 && <hr className="ticket-divider" />}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            {detalle.extras.some(e => e.tipo === 'MAQUILA') && detalle.extras.some(e => e.tipo === 'PRODUCTO')
              ? 'Maquila / Productos'
              : detalle.extras[0].tipo === 'MAQUILA' ? 'Maquila' : 'Productos'}
          </div>
          {detalle.extras.map((e, i) => {
            const maqNotas = parseMaqNotas(e.notas)
            return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
                <span>{e.cantidad} {e.unidad} — {e.descripcion}</span>
                <span>${fmt5(Number(e.subtotal))}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 14 }}>
                ${Number(e.precio_unitario).toFixed(2)}/u
                {!maqNotas && e.notas ? ` · ${e.notas}` : ''}
              </div>
              {(maqNotas?.procesos ?? []).map((pr, j) => (
                <div key={j} className="ticket-row" style={{ fontSize: 11, paddingLeft: 14 }}>
                  <span>+ {pr.nombre}</span>
                  <span>${fmt5(pr.subtotal)}</span>
                </div>
              ))}
            </div>
            )
          })}
        </>
      )}

      <hr className="ticket-divider" />
      <div className="ticket-total"><span>TOTAL</span><span>${fmt5(detalle.total)}</span></div>
      {detalle.forma_pago === 'ANTICIPO' && (
        <>
          <div className="ticket-row" style={{ marginTop: 6 }}>
            <span>Anticipo previo:</span>
            <span>${detalle.anticipo.toFixed(2)}</span>
          </div>
          {detalle.saldo_cobrado != null && (
            <div className="ticket-row">
              <span>Saldo cobrado:</span>
              <span style={{ fontWeight: 700 }}>${detalle.saldo_cobrado.toFixed(2)}</span>
            </div>
          )}
        </>
      )}
      <hr className="ticket-divider" />
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        ¡Gracias por su compra!
      </div>
    </div>
  )
}

// ── Modal detalle de venta ────────────────────────────────────────────────
function DetalleVentaModal({ resumen, onClose, onFacturar, onCobrar }) {
  const [detalle, setDetalle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getDetallePedido(resumen.id)
      .then(d => { setDetalle(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [resumen.id])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Venta — {resumen.folio}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Entregado: {resumen.fechaEntrega} · {resumen.clienteNombre}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Cargando...</div>
          )}
          {error && <div className="alert alert-error">❌ {error}</div>}
          {detalle && <TicketVenta detalle={detalle} />}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          {onCobrar && resumen.estatus === 'PENDIENTE' && (
            <button className="btn btn-primary" onClick={() => { onClose(); onCobrar(resumen) }}>
              💰 Cobrar
            </button>
          )}
          {onFacturar && !resumen.esCancelado && (
            <button className="btn btn-outline" style={{ borderColor: '#6366f1', color: '#6366f1' }} onClick={() => onFacturar(resumen)}>
              🧾 Facturar
            </button>
          )}
          {detalle && (() => {
            const normalizado = {
              tipo:          'pedido',
              folio:         detalle.folio,
              fecha:         detalle.fecha,
              hora:          detalle.hora ?? '',
              clienteNombre: detalle.cliente?.nombre ?? 'Mostrador',
              nivelNombre:   detalle.nivel?.nombre ?? '',
              formaPago:     detalle.forma_pago,
              metodoPago:    detalle.metodo_pago ?? null,
              anticipo:      detalle.anticipo,
              saldo:         detalle.saldo,
              saldo_cobrado: detalle.saldo_cobrado,
              esEntregado:   true,
              esReimpresion: true,
              esCancelado:   resumen.esCancelado ?? false,
              total:         detalle.total,
              partidas: [
                ...(detalle.partidas ?? []).map(p => ({
                  tipo:             'VIDRIO',
                  piezas:           p.cantidad ?? 1,
                  clave:            p.clave_vidrio,
                  largo_cm:         p.largo_cm,
                  ancho_cm:         p.ancho_cm,
                  subtotal_vidrio:  p.subtotal_vidrio,
                  subtotal_partida: p.subtotal_partida,
                  procesos:         p.procesos ?? [],
                })),
                ...(detalle.extras ?? []).map(e => ({
                  tipo:             e.tipo === 'PRODUCTO' ? 'HERRAJE' : e.tipo,
                  descripcion:      e.descripcion,
                  cantidad:         e.cantidad,
                  precio_unitario:  e.precio_unitario,
                  subtotal_partida: Number(e.subtotal),
                  procesos:         [],
                })),
              ],
            }
            return (
              <>
                <button className="btn btn-outline" onClick={() => printTicketVidrio(normalizado)}>🖨️ Ticket</button>
                <button className="btn btn-primary" onClick={() => printPedidoA4(normalizado)}>🖨️ Hoja A4</button>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ── Modal: generar CFDI via Facturama ────────────────────────────────────
const REGIMENES = [
  ['601','601 - General de Ley Personas Morales'],
  ['603','603 - Personas Morales con Fines no Lucrativos'],
  ['605','605 - Sueldos y Salarios'],
  ['606','606 - Arrendamiento'],
  ['608','608 - Demás ingresos'],
  ['612','612 - Personas Físicas con Actividades Empresariales'],
  ['616','616 - Sin obligaciones fiscales'],
  ['621','621 - Incorporación Fiscal'],
  ['626','626 - Régimen Simplificado de Confianza'],
]

const USOS_CFDI = [
  ['G01','G01 - Adquisición de mercancias'],
  ['G02','G02 - Devoluciones, descuentos o bonificaciones'],
  ['G03','G03 - Gastos en general'],
  ['I01','I01 - Construcciones'],
  ['I03','I03 - Equipo de transporte'],
  ['I04','I04 - Equipo de cómputo'],
  ['P01','P01 - Por definir'],
  ['S01','S01 - Sin efectos fiscales'],
]

const FORMAS_PAGO = [
  ['01','01 - Efectivo'],
  ['02','02 - Cheque nominativo'],
  ['03','03 - Transferencia electrónica'],
  ['04','04 - Tarjeta de crédito'],
  ['28','28 - Tarjeta de débito'],
  ['99','99 - Por definir'],
]

function FacturarModal({ resumen, onClose }) {
  const [rfc,        setRfc]        = useState('XAXX010101000')
  const [nombre,     setNombre]     = useState('PUBLICO EN GENERAL')
  const [cpFiscal,   setCpFiscal]   = useState('')
  const [regimen,    setRegimen]    = useState('616')
  const [usoCfdi,    setUsoCfdi]    = useState('S01')
  const [formaPago,  setFormaPago]  = useState('01')
  const [metodoPago, setMetodoPago] = useState('PUE')

  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [cfdi,      setCfdi]      = useState(null)
  const [clientes,  setClientes]  = useState([])
  const [clienteSel, setClienteSel] = useState('publico')

  useEffect(() => {
    getClientes().then(setClientes).catch(() => {})
  }, [])

  const handleSelectCliente = (val) => {
    setClienteSel(val)
    if (val === 'publico') {
      setRfc('XAXX010101000')
      setNombre('PUBLICO EN GENERAL')
      setCpFiscal('')
      setRegimen('616')
      setUsoCfdi('S01')
    } else if (val) {
      const c = clientes.find(x => x.id_cliente === Number(val))
      if (c) {
        setRfc(c.rfc ?? '')
        setNombre(c.razon_social || c.nombre || '')
        setCpFiscal(c.cp_fiscal ?? '')
        setRegimen(c.regimen_fiscal ?? '616')
        setUsoCfdi(c.uso_cfdi ?? 'S01')
      }
    }
  }

  const handleGenerar = async () => {
    if (!cpFiscal.trim() || cpFiscal.trim().length !== 5) {
      setError('El código postal fiscal debe tener 5 dígitos')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await crearCFDI(resumen, { rfc, nombre, cpFiscal, regimen, usoCfdi, formaPago, metodoPago })
      setCfdi(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const base = Math.round((resumen.total / 1.16) * 100) / 100
  const iva  = Math.round((resumen.total - base) * 100) / 100

  if (cfdi) {
    return (
      <div className="modal-overlay">
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">✅ CFDI generado</div>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Factura generada exitosamente</div>
              <div style={{ fontSize: 13 }}>Folio fiscal: <strong>{cfdi.Id ?? cfdi.id ?? '—'}</strong></div>
              {cfdi.Serie && <div style={{ fontSize: 13 }}>Serie/Folio: {cfdi.Serie}-{cfdi.Folio}</div>}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a
                href={getCFDIPdfUrl(cfdi.Id ?? cfdi.id)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
                style={{ textDecoration: 'none' }}
              >
                📄 Descargar PDF
              </a>
              <a
                href={getCFDIXmlUrl(cfdi.Id ?? cfdi.id)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
                style={{ textDecoration: 'none' }}
              >
                📋 Descargar XML
              </a>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Generar CFDI — {resumen.folio}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {resumen.clienteNombre} · ${fmt5(resumen.total)}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Cliente</label>
            <select className="form-select" value={clienteSel} onChange={e => handleSelectCliente(e.target.value)}>
              <option value="publico">👤 Público en general</option>
              {clientes.map(c => (
                <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label required">RFC receptor</label>
              <input className="form-input" value={rfc} onChange={e => setRfc(e.target.value.toUpperCase())} placeholder="XAXX010101000" />
            </div>
            <div className="form-group">
              <label className="form-label required">C.P. fiscal receptor</label>
              <input className="form-input" value={cpFiscal} onChange={e => setCpFiscal(e.target.value)} placeholder="00000" maxLength={5} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label required">Nombre / Razón social</label>
              <input className="form-input" value={nombre} onChange={e => setNombre(e.target.value.toUpperCase())} placeholder="NOMBRE COMPLETO O RAZÓN SOCIAL" />
            </div>
            <div className="form-group">
              <label className="form-label required">Régimen fiscal receptor</label>
              <select className="form-select" value={regimen} onChange={e => setRegimen(e.target.value)}>
                {REGIMENES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Uso CFDI</label>
              <select className="form-select" value={usoCfdi} onChange={e => setUsoCfdi(e.target.value)}>
                {USOS_CFDI.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Forma de pago</label>
              <select className="form-select" value={formaPago} onChange={e => setFormaPago(e.target.value)}>
                {FORMAS_PAGO.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Método de pago</label>
              <select className="form-select" value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                <option value="PUE">PUE - Pago en una sola exhibición</option>
                <option value="PPD">PPD - Pago en parcialidades o diferido</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[
                ['Subtotal (sin IVA)', `$${fmt5(base)}`],
                ['IVA 16%',           `$${fmt5(iva)}`],
                ['Total CFDI',        `$${fmt5(resumen.total)}`],
              ].map(([label, val]) => (
                <div key={label} style={{ textAlign: 'center', background: 'var(--bg)', borderRadius: 8, padding: '8px 4px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              * Los precios incluyen IVA 16%. El subtotal se calcula dividiendo el total entre 1.16.
            </div>
          </div>

          {error && <div className="alert alert-error" style={{ marginTop: 12 }}>❌ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleGenerar} disabled={loading}>
            {loading ? 'Generando...' : '🧾 Generar CFDI'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: cobrar saldo pendiente ─────────────────────────────────────────
function CobrarModal({ resumen, onClose, onSuccess }) {
  const [detalle,      setDetalle]      = useState(null)
  const [loadingDet,   setLoadingDet]   = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState(null)
  const [montoCobrado, setMontoCobrado] = useState('')

  useEffect(() => {
    getDetallePedido(resumen.id)
      .then(d => { setDetalle(d); setLoadingDet(false) })
      .catch(e => { setError(e.message); setLoadingDet(false) })
  }, [resumen.id])

  const saldo     = detalle ? detalle.saldo : 0
  const montoNum  = Number(montoCobrado)
  const montoValido = !isNaN(montoNum) && montoNum > 0 && montoNum === saldo

  const handleConfirm = async () => {
    if (!montoValido) return
    setSaving(true)
    setError(null)
    try {
      await marcarComoEntregado(detalle.id, montoNum)
      onSuccess()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Entregar y cobrar — {resumen.folio}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{resumen.clienteNombre}</div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loadingDet ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>Cargando...</div>
          ) : detalle ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  ['Total pedido',    `$${fmt5(detalle.total)}`,        'var(--text)'],
                  ['Anticipo pagado', `$${detalle.anticipo.toFixed(2)}`, 'var(--accent)'],
                  ['Saldo a cobrar',  `$${saldo.toFixed(2)}`,            'var(--danger)'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ textAlign: 'center', background: 'var(--bg)', borderRadius: 8, padding: '10px 6px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color }}>{val}</div>
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label required">Monto cobrado al cliente ($)</label>
                <input
                  className={`form-input${!montoValido && montoCobrado !== '' ? ' error' : ''}`}
                  type="number" step="0.01" min="0.01"
                  value={montoCobrado}
                  onChange={e => setMontoCobrado(e.target.value)}
                  placeholder={saldo.toFixed(2)}
                  style={{ fontWeight: 700, fontSize: 16, color: 'var(--danger)' }}
                  autoFocus
                />
                {!montoValido && montoCobrado !== '' && (
                  <div className="form-error">El monto debe ser exactamente ${saldo.toFixed(2)}</div>
                )}
                <div className="form-hint">Escribe el saldo a cobrar para confirmar la entrega.</div>
              </div>
              <div className="alert alert-warning" style={{ marginTop: 8 }}>
                ⚠️ Esta acción no se puede revertir. El pedido pasará al historial de ventas.
              </div>
            </>
          ) : null}
          {error && <div className="alert alert-error">❌ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={saving || !montoValido || loadingDet}>
            {saving ? 'Registrando...' : `✅ Confirmar — cobrar $${montoValido ? montoNum.toFixed(2) : '—'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Exportar a Excel ──────────────────────────────────────────────────────
async function exportarExcel(fechaDesde, fechaHasta) {
  const raw = await getPedidosParaExport(fechaDesde, fechaHasta)

  const vistos = new Set()
  const resumen = []
  for (const row of raw) {
    if (!vistos.has(row['Folio'])) {
      vistos.add(row['Folio'])
      resumen.push({
        'Folio':           row['Folio'],
        'Fecha entrega':   row['Fecha entrega'],
        'Cliente':         row['Cliente'],
        'Forma de pago':   row['Forma de pago'],
        'Total':           Number(row['Total pedido']),
        'Anticipo':        Number(row['Anticipo']),
        'Cobrado entrega': Number(row['Cobrado entrega']),
        'Total recibido':  Number(row['Total cobrado']),
        'Observaciones':   row['Observaciones'] ?? '',
      })
    }
  }

  const sum = (col) => resumen.reduce((s, r) => s + (r[col] ?? 0), 0)
  resumen.push({
    'Folio': 'TOTAL', 'Fecha entrega': '', 'Cliente': '', 'Forma de pago': '',
    'Total': sum('Total'), 'Anticipo': sum('Anticipo'),
    'Cobrado entrega': sum('Cobrado entrega'), 'Total recibido': sum('Total recibido'), 'Observaciones': '',
  })

  const partidas = raw.map(row => ({
    'Folio':             row['Folio'],
    'Cliente':           row['Cliente'],
    'Tipo vidrio':       row['Tipo vidrio'],
    'Largo (cm)':        Number(row['Largo (cm)']),
    'Ancho (cm)':        Number(row['Ancho (cm)']),
    'm²':                Number(row['m2']),
    'Cantidad':          Number(row['Cantidad']),
    'Precio m²':         Number(row['Precio m2']),
    'Subtotal vidrio':   Number(row['Subtotal vidrio']),
    'Subtotal procesos': Number(row['Subtotal procesos']),
    'Total partida':     Number(row['Total partida']),
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Ventas')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partidas), 'Partidas')
  XLSX.writeFile(wb, `ventas_${fechaDesde || 'inicio'}_${fechaHasta || 'hoy'}.xlsx`)
}

// ── Página Historial de Ventas ────────────────────────────────────────────
export default function HistorialVentas() {
  const [tab, setTab] = useState('entregados')

  // entregados
  const [pedidos,      setPedidos]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [fechaDesde,   setFechaDesde]   = useState(lunesMX)
  const [fechaHasta,   setFechaHasta]   = useState(hoyMX)
  const [seleccionado, setSeleccionado] = useState(null)
  const [cobrarPedido,   setCobrarPedido]   = useState(null)
  const [facturarPedido, setFacturarPedido] = useState(null)
  const [exporting,    setExporting]    = useState(false)
  const [busqueda,     setBusqueda]     = useState('')
  const [filtroPago,   setFiltroPago]   = useState(null)

  // cancelados
  const [cancelados,       setCancelados]       = useState([])
  const [loadingCan,       setLoadingCan]       = useState(false)
  const [errorCan,         setErrorCan]         = useState(null)
  const [busquedaCan,      setBusquedaCan]      = useState('')
  const [canceladosLoaded, setCanceladosLoaded] = useState(false)

  // por cobrar / anticipo
  const [busquedaPorCobrar, setBusquedaPorCobrar] = useState('')
  const [busquedaAnticipo,  setBusquedaAnticipo]  = useState('')

  // pendientes
  const [pendientes,      setPendientes]      = useState([])
  const [loadingPend,     setLoadingPend]     = useState(false)
  const [errorPend,       setErrorPend]       = useState(null)
  const [busquedaPend,    setBusquedaPend]    = useState('')
  const [pendientesLoaded, setPendientesLoaded] = useState(false)

  // ── filtered lists ────────────────────────────────────────────────────────

  const q = busqueda.trim().toLowerCase()
  const filteredFinal = pedidos
    .filter(v => !filtroPago || v.forma_pago === filtroPago)
    .filter(v => !q || v.folio?.toLowerCase().includes(q) || v.fecha.toLowerCase().includes(q) || v.clienteNombre?.toLowerCase().includes(q))

  const qCan = busquedaCan.trim().toLowerCase()
  const filteredCan = cancelados.filter(v =>
    !qCan || v.folio?.toLowerCase().includes(qCan) || v.clienteNombre?.toLowerCase().includes(qCan)
  )

  const qCob = busquedaPorCobrar.trim().toLowerCase()
  const filteredCob = [
    ...pendientes.filter(v => v.tipo_pago === 'POR COBRAR'),
    ...pedidos.filter(v => v.forma_pago === 'POR COBRAR'),
  ].filter(v => !qCob || v.folio?.toLowerCase().includes(qCob) || v.clienteNombre?.toLowerCase().includes(qCob))

  const qAntic = busquedaAnticipo.trim().toLowerCase()
  const filteredAntic = [
    ...pendientes.filter(v => v.tipo_pago === 'ANTICIPO'),
    ...pedidos.filter(v => v.forma_pago === 'ANTICIPO'),
  ].filter(v => !qAntic || v.folio?.toLowerCase().includes(qAntic) || v.clienteNombre?.toLowerCase().includes(qAntic))

  const qPend = busquedaPend.trim().toLowerCase()
  const filteredPend = pendientes
    .filter(v => v.tipo_pago === 'LIQUIDADO')
    .filter(v => !qPend || v.folio?.toLowerCase().includes(qPend) || v.clienteNombre?.toLowerCase().includes(qPend))

  // ── loaders ───────────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPedidosEntregados(fechaDesde, fechaHasta)
      data.sort((a, b) => new Date(b.fechaEntregaISO ?? b.fechaCreacionISO) - new Date(a.fechaEntregaISO ?? a.fechaCreacionISO))
      setPedidos(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta])

  const cargarCancelados = useCallback(async () => {
    setLoadingCan(true)
    setErrorCan(null)
    try {
      const data = await getPedidosCancelados(fechaDesde, fechaHasta)
      setCancelados(data)
      setCanceladosLoaded(true)
    } catch (err) {
      setErrorCan(err.message)
    } finally {
      setLoadingCan(false)
    }
  }, [fechaDesde, fechaHasta])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (tab === 'cancelados') cargarCancelados()
    else setCanceladosLoaded(false)
  }, [tab, cargarCancelados])

  const cargarPendientes = useCallback(async () => {
    setLoadingPend(true)
    setErrorPend(null)
    try {
      const [vidrio, maquila] = await Promise.all([getPedidosPendientes(), getPedidosPendientesMaquila()])
      const data = [...vidrio, ...maquila].sort((a, b) => {
        const fa = a.fechaCreacionISO ?? a.fechaPedidoISO ?? ''
        const fb = b.fechaCreacionISO ?? b.fechaPedidoISO ?? ''
        return new Date(fb) - new Date(fa)
      })
      setPendientes(data)
      setPendientesLoaded(true)
    } catch (err) {
      setErrorPend(err.message)
    } finally {
      setLoadingPend(false)
    }
  }, [])

  useEffect(() => { cargarPendientes() }, [cargarPendientes])

  // ── helpers ───────────────────────────────────────────────────────────────

  const totalAcumulado = filteredFinal.reduce((s, p) => s + p.total, 0)
  const totalCancelado = filteredCan.reduce((s, p) => s + p.total, 0)

  const handleExportar = async () => {
    setExporting(true)
    try {
      await exportarExcel(fechaDesde, fechaHasta)
    } catch (err) {
      alert('Error al exportar: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const formaPagoBadge = (fp) =>
    fp === 'LIQUIDADO'    ? <span className="badge badge-green">Liquidado</span>
    : fp === 'POR COBRAR' ? <span className="badge badge-blue">Por cobrar</span>
    : <span className="badge badge-orange">Anticipo</span>

  const tabStyle = (t) => ({
    padding: '6px 18px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    background:   tab === t ? 'var(--accent)' : 'transparent',
    color:        tab === t ? '#fff' : 'var(--text-muted)',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
  })

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Historial de Ventas</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button style={tabStyle('entregados')} onClick={() => setTab('entregados')}>Entregados</button>
            <button style={tabStyle('cancelados')} onClick={() => setTab('cancelados')}>Cancelados</button>
            <button style={tabStyle('Por cobrar')}  onClick={() => setTab('Por cobrar')}>Por cobrar</button>
            <button style={tabStyle('Anticipo')}    onClick={() => setTab('Anticipo')}>Anticipo</button>
            <button style={tabStyle('pendientes')}  onClick={() => setTab('pendientes')}>Pendientes</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'entregados' ? (
            <>
              <input type="text" className="filter-select" placeholder="Buscar folio, cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ minWidth: 200 }} />
              <button className="btn btn-outline" onClick={cargar} disabled={loading}>↻ Actualizar</button>
              <button className="btn btn-primary" onClick={handleExportar} disabled={exporting || pedidos.length === 0}>
                {exporting ? 'Exportando...' : '⬇ Excel'}
              </button>
            </>
          ) : tab === 'cancelados' ? (
            <>
              <input type="text" className="filter-select" placeholder="Buscar folio, cliente..." value={busquedaCan} onChange={e => setBusquedaCan(e.target.value)} style={{ minWidth: 200 }} />
              <button className="btn btn-outline" onClick={cargarCancelados} disabled={loadingCan}>↻ Actualizar</button>
            </>
          ) : tab === 'Por cobrar' ? (
            <>
              <input type="text" className="filter-select" placeholder="Buscar folio, cliente..." value={busquedaPorCobrar} onChange={e => setBusquedaPorCobrar(e.target.value)} style={{ minWidth: 200 }} />
              <button className="btn btn-outline" onClick={() => { cargar(); cargarPendientes() }} disabled={loading || loadingPend}>↻ Actualizar</button>
            </>
          ) : tab === 'Anticipo' ? (
            <>
              <input type="text" className="filter-select" placeholder="Buscar folio, cliente..." value={busquedaAnticipo} onChange={e => setBusquedaAnticipo(e.target.value)} style={{ minWidth: 200 }} />
              <button className="btn btn-outline" onClick={() => { cargar(); cargarPendientes() }} disabled={loading || loadingPend}>↻ Actualizar</button>
            </>
          ) : (
            <>
              <input type="text" className="filter-select" placeholder="Buscar folio, cliente..." value={busquedaPend} onChange={e => setBusquedaPend(e.target.value)} style={{ minWidth: 200 }} />
              <button className="btn btn-outline" onClick={cargarPendientes} disabled={loadingPend}>↻ Actualizar</button>
            </>
          )}
        </div>
      </div>

      <div className="page-body">

        {/* Filtros de fecha */}
        <div className="filter-bar" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Desde:</span>
          <input type="date" className="filter-select" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Hasta:</span>
          <input type="date" className="filter-select" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          <button className="btn btn-outline btn-sm" onClick={() => { setFechaDesde(lunesMX()); setFechaHasta(hoyMX()) }}>
            Esta semana
          </button>
          {tab === 'entregados' && (
            <>
              <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', margin: '0 4px' }} />
              {[{ val: null, label: 'Todos' }, { val: 'LIQUIDADO', label: 'Liquidado' }, { val: 'ANTICIPO', label: 'Anticipo' }].map(({ val, label }) => (
                <button key={label} className={filtroPago === val ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setFiltroPago(val)}>
                  {label}
                </button>
              ))}
            </>
          )}
        </div>

        {/* ── TAB: ENTREGADOS ── */}
        {tab === 'entregados' && (
          <>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Ventas en periodo</div>
                <div className="stat-value">{filteredFinal.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total acumulado</div>
                <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>${fmt5(totalAcumulado)}</div>
              </div>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Cargando ventas...</div>
            ) : error ? (
              <div className="alert alert-error">❌ {error}</div>
            ) : filteredFinal.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <h3>Sin ventas en el periodo</h3>
                <p>Ajusta el rango de fechas para ver resultados</p>
              </div>
            ) : (
              <>
                <div className="hist-desktop">
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Folio</th><th>Entregado</th><th>Cliente</th><th>Pago</th>
                          <th style={{ textAlign: 'right' }}>Total</th><th style={{ width: 100 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFinal.map(p => (
                          <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSeleccionado(p)}>
                            <td><span className="badge badge-blue">{p.folio}</span></td>
                            <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>{p.fechaEntrega}</td>
                            <td style={{ fontWeight: 500 }}>{p.clienteNombre}</td>
                            <td>{formaPagoBadge(p.forma_pago)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>${fmt5(p.total)}</td>
                            <td><button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver detalle</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
                      Total del periodo: ${fmt5(totalAcumulado)}
                    </div>
                  </div>
                </div>
                <div className="hist-mobile">
                  {filteredFinal.map(p => (
                    <div key={p.id} className="hist-card" onClick={() => setSeleccionado(p)}>
                      <div className="hist-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="badge badge-blue">{p.folio}</span>
                          {formaPagoBadge(p.forma_pago)}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>${fmt5(p.total)}</span>
                      </div>
                      <div className="hist-card-body">
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{p.clienteNombre}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Entregado: {p.fechaEntrega}</div>
                      </div>
                      <div className="hist-card-footer">
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.fecha}</span>
                        <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver detalle</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
                    Total del periodo: ${fmt5(totalAcumulado)}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── TAB: CANCELADOS ── */}
        {tab === 'cancelados' && (
          <>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Cancelados en periodo</div>
                <div className="stat-value">{filteredCan.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total cancelado</div>
                <div className="stat-value" style={{ fontSize: 18, color: '#dc2626' }}>${fmt5(totalCancelado)}</div>
              </div>
            </div>
            {loadingCan ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Cargando cancelados...</div>
            ) : errorCan ? (
              <div className="alert alert-error">❌ {errorCan}</div>
            ) : filteredCan.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <h3>Sin pedidos cancelados en el periodo</h3>
                <p>Ajusta el rango de fechas para ver resultados</p>
              </div>
            ) : (
              <>
                <div className="hist-desktop">
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Folio</th><th>Fecha creación</th><th>Cliente</th>
                          <th style={{ textAlign: 'right' }}>Total</th><th style={{ width: 100 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCan.map(p => (
                          <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSeleccionado(p)}>
                            <td><span className="badge" style={{ background:'#fef2f2', color:'#991b1b', border:'1px solid #fca5a5' }}>{p.folio}</span></td>
                            <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>{p.fecha}</td>
                            <td style={{ fontWeight: 500 }}>{p.clienteNombre}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>${fmt5(p.total)}</td>
                            <td><button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver detalle</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="hist-mobile">
                  {filteredCan.map(p => (
                    <div key={p.id} className="hist-card" onClick={() => setSeleccionado(p)}>
                      <div className="hist-card-header">
                        <span className="badge" style={{ background:'#fef2f2', color:'#991b1b', border:'1px solid #fca5a5' }}>{p.folio}</span>
                        <span style={{ fontWeight: 700, fontSize: 17, color: '#dc2626' }}>${fmt5(p.total)}</span>
                      </div>
                      <div className="hist-card-body">
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{p.clienteNombre}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Creado: {p.fecha}</div>
                      </div>
                      <div className="hist-card-footer">
                        <span className="badge" style={{ background:'#fef2f2', color:'#991b1b', border:'1px solid #fca5a5', fontSize:11 }}>CANCELADO</span>
                        <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver detalle</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── TAB: POR COBRAR ── */}
        {tab === 'Por cobrar' && (
          <>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Por cobrar</div>
                <div className="stat-value">{filteredCob.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total por cobrar</div>
                <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>
                  ${fmt5(filteredCob.reduce((s, p) => s + p.total, 0))}
                </div>
              </div>
            </div>
            {loading || loadingPend ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : filteredCob.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <h3>Sin pedidos por cobrar</h3>
              </div>
            ) : (
              <>
                <div className="hist-desktop">
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Folio</th><th>Estado</th><th>Cliente</th>
                          <th style={{ textAlign: 'right' }}>Total</th><th style={{ width: 100 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCob.map(p => (
                          <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSeleccionado(p)}>
                            <td><span className="badge badge-blue">{p.folio}</span></td>
                            <td>
                              {p.estatus === 'PENDIENTE'
                                ? <span className="badge badge-orange">Sin entregar</span>
                                : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.fechaEntrega}</span>}
                            </td>
                            <td style={{ fontWeight: 500 }}>{p.clienteNombre}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>${fmt5(p.total)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                {p.estatus === 'PENDIENTE' && (
                                  <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setCobrarPedido(p) }}>💰 Cobrar</button>
                                )}
                                <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
                      Total: ${fmt5(filteredCob.reduce((s, p) => s + p.total, 0))}
                    </div>
                  </div>
                </div>
                <div className="hist-mobile">
                  {filteredCob.map(p => (
                    <div key={p.id} className="hist-card" onClick={() => setSeleccionado(p)}>
                      <div className="hist-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="badge badge-blue">{p.folio}</span>
                          {p.estatus === 'PENDIENTE'
                            ? <span className="badge badge-orange">Pendiente</span>
                            : <span className="badge badge-blue">Entregado</span>}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>${fmt5(p.total)}</span>
                      </div>
                      <div className="hist-card-body">
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{p.clienteNombre}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                          {p.estatus === 'PENDIENTE' ? `Creado: ${p.fecha}` : `Entregado: ${p.fechaEntrega}`}
                        </div>
                      </div>
                      <div className="hist-card-footer">
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.fecha}</span>
                        <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver detalle</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── TAB: ANTICIPO ── */}
        {tab === 'Anticipo' && (
          <>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Con anticipo</div>
                <div className="stat-value">{filteredAntic.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total</div>
                <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>
                  ${fmt5(filteredAntic.reduce((s, p) => s + p.total, 0))}
                </div>
              </div>
            </div>
            {loading || loadingPend ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : filteredAntic.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💰</div>
                <h3>Sin pedidos con anticipo</h3>
              </div>
            ) : (
              <>
                <div className="hist-desktop">
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Folio</th><th>Estado</th><th>Cliente</th>
                          <th style={{ textAlign: 'right' }}>Anticipo</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ width: 100 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAntic.map(p => (
                          <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSeleccionado(p)}>
                            <td><span className="badge badge-blue">{p.folio}</span></td>
                            <td>
                              {p.estatus === 'PENDIENTE'
                                ? <span className="badge badge-orange">Sin entregar</span>
                                : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.fechaEntrega}</span>}
                            </td>
                            <td style={{ fontWeight: 500 }}>{p.clienteNombre}</td>
                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>${fmt5(p.anticipo)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>${fmt5(p.total)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                {p.estatus === 'PENDIENTE' && (
                                  <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setCobrarPedido(p) }}>💰 Cobrar</button>
                                )}
                                <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
                      Total: ${fmt5(filteredAntic.reduce((s, p) => s + p.total, 0))}
                    </div>
                  </div>
                </div>
                <div className="hist-mobile">
                  {filteredAntic.map(p => (
                    <div key={p.id} className="hist-card" onClick={() => setSeleccionado(p)}>
                      <div className="hist-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="badge badge-blue">{p.folio}</span>
                          {p.estatus === 'PENDIENTE'
                            ? <span className="badge badge-orange">Pendiente</span>
                            : <span className="badge badge-blue">Entregado</span>}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>${fmt5(p.total)}</span>
                      </div>
                      <div className="hist-card-body">
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{p.clienteNombre}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                          {p.estatus === 'PENDIENTE' ? `Creado: ${p.fecha}` : `Entregado: ${p.fechaEntrega}`}
                        </div>
                      </div>
                      <div className="hist-card-footer">
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Anticipo: ${fmt5(p.anticipo)}</span>
                        <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver detalle</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── TAB: PENDIENTES ── */}
        {tab === 'pendientes' && (
          <>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Pedidos pendientes</div>
                <div className="stat-value">{filteredPend.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total pendiente</div>
                <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>
                  ${fmt5(filteredPend.reduce((s, p) => s + p.total, 0))}
                </div>
              </div>
            </div>
            {loadingPend ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : errorPend ? (
              <div className="alert alert-error">❌ {errorPend}</div>
            ) : filteredPend.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <h3>Sin pedidos pendientes</h3>
              </div>
            ) : (
              <>
                <div className="hist-desktop">
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Folio</th><th>Fecha</th><th>Cliente</th><th>Pago</th>
                          <th style={{ textAlign: 'right' }}>Total</th><th style={{ width: 100 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPend.map(p => (
                          <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSeleccionado(p)}>
                            <td><span className="badge badge-blue">{p.folio}</span></td>
                            <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>{p.fecha}</td>
                            <td style={{ fontWeight: 500 }}>{p.clienteNombre}</td>
                            <td>{formaPagoBadge(p.tipo_pago)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>${fmt5(p.total)}</td>
                            <td><button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver detalle</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
                      Total: ${fmt5(filteredPend.reduce((s, p) => s + p.total, 0))}
                    </div>
                  </div>
                </div>
                <div className="hist-mobile">
                  {filteredPend.map(p => (
                    <div key={p.id} className="hist-card" onClick={() => setSeleccionado(p)}>
                      <div className="hist-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="badge badge-blue">{p.folio}</span>
                          {formaPagoBadge(p.tipo_pago)}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>${fmt5(p.total)}</span>
                      </div>
                      <div className="hist-card-body">
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{p.clienteNombre}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Creado: {p.fecha}</div>
                      </div>
                      <div className="hist-card-footer">
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.hora}</span>
                        <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>Ver detalle</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

      </div>

      {seleccionado && (
        <DetalleVentaModal
          resumen={seleccionado}
          onClose={() => setSeleccionado(null)}
          onFacturar={(r) => { setSeleccionado(null); setFacturarPedido(r) }}
          onCobrar={seleccionado.estatus === 'PENDIENTE' ? (r) => { setCobrarPedido(r) } : undefined}
        />
      )}

      {facturarPedido && (
        <FacturarModal
          resumen={facturarPedido}
          onClose={() => setFacturarPedido(null)}
        />
      )}

      {cobrarPedido && (
        <CobrarModal
          resumen={cobrarPedido}
          onClose={() => setCobrarPedido(null)}
          onSuccess={() => {
            setCobrarPedido(null)
            cargar()
            cargarPendientes()
          }}
        />
      )}
    </>
  )
}
