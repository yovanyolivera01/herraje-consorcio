import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { getPedidosEntregados, getDetallePedido, getPedidosParaExport } from '../../lib/pedidosApi'

// ── Helper: lunes de la semana actual ─────────────────────────────────────
function getLunesDeHoy() {
  const hoy = new Date()
  const dia = hoy.getDay() // 0=Dom
  const diff = dia === 0 ? -6 : 1 - dia
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() + diff)
  return lunes.toISOString().slice(0, 10)
}

function hoyStr() {
  return new Date().toISOString().slice(0, 10)
}

// ── Ticket de pedido entregado ────────────────────────────────────────────
function TicketVenta({ detalle }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>TEMPLADOS CONSORCIO</h2>
        <p style={{ fontWeight: 700 }}>COMPROBANTE DE VENTA</p>
      </div>
      <hr className="ticket-divider" />
      <div className="ticket-row"><span>Pedido:</span><strong>{detalle.folio}</strong></div>
      <div className="ticket-row"><span>Fecha:</span><span>{detalle.fecha}</span></div>
      <div className="ticket-row"><span>Entregado:</span><span>{detalle.fechaEntrega}</span></div>
      <div className="ticket-row"><span>Cliente:</span><span>{detalle.cliente?.nombre ?? 'Mostrador'}</span></div>
      <div className="ticket-row"><span>Nivel:</span><span>{detalle.nivel?.nombre ?? '—'}</span></div>
      <hr className="ticket-divider" />

      {detalle.partidas.map((p, i) => (
        <div key={p.id} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight:600, fontSize:12 }}>
            {i+1}. {p.clave_vidrio} — {p.largo_cm}×{p.ancho_cm} cm · {p.metros2.toFixed(4)} m²
          </div>
          {p.descripcion_vidrio && (
            <div style={{ fontSize:11, color:'var(--text-muted)', paddingLeft:14 }}>{p.descripcion_vidrio}</div>
          )}
          <div className="ticket-row" style={{ fontSize:11, color:'var(--text-muted)' }}>
            <span>${p.precio_m2_aplicado.toFixed(2)}/m²</span>
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
      {detalle.forma_pago === 'ANTICIPO' && (
        <>
          <div className="ticket-row" style={{ marginTop:6 }}>
            <span>Anticipo previo:</span>
            <span>${detalle.anticipo.toFixed(2)}</span>
          </div>
          {detalle.saldo_cobrado != null && (
            <div className="ticket-row">
              <span>Saldo cobrado:</span>
              <span style={{ fontWeight:700 }}>${detalle.saldo_cobrado.toFixed(2)}</span>
            </div>
          )}
        </>
      )}
      <hr className="ticket-divider" />
      <div style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', marginTop:8 }}>
        ¡Gracias por su compra!
      </div>
    </div>
  )
}

// ── Modal detalle de venta ────────────────────────────────────────────────
function DetalleVentaModal({ resumen, onClose }) {
  const [detalle, setDetalle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

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
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              Entregado: {resumen.fechaEntrega} · {resumen.clienteNombre}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading && (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>Cargando...</div>
          )}
          {error  && <div className="alert alert-error">❌ {error}</div>}
          {detalle && <TicketVenta detalle={detalle} />}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          {detalle && (
            <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Exportar a Excel ──────────────────────────────────────────────────────
//  sp_exportar_excel_ventas devuelve filas planas: una por partida.
//  Hoja 1: resumen por pedido (deduplicado).
//  Hoja 2: detalle de partidas (filas del SP directo).
async function exportarExcel(fechaDesde, fechaHasta) {
  const raw = await getPedidosParaExport(fechaDesde, fechaHasta)

  // Hoja 1: una fila por pedido (deduplicar por folio)
  const vistos = new Set()
  const resumen = []
  for (const row of raw) {
    if (!vistos.has(row['Folio'])) {
      vistos.add(row['Folio'])
      resumen.push({
        'Folio':          row['Folio'],
        'Fecha entrega':  row['Fecha entrega'],
        'Cliente':        row['Cliente'],
        'Forma de pago':  row['Forma de pago'],
        'Total':          Number(row['Total pedido']),
        'Anticipo':       Number(row['Anticipo']),
        'Cobrado entrega': Number(row['Cobrado entrega']),
        'Total cobrado':  Number(row['Total cobrado']),
        'Observaciones':  row['Observaciones'] ?? '',
      })
    }
  }

  // Hoja 2: partidas tal como las devuelve el SP
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen),  'Ventas')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partidas), 'Partidas')

  const nombre = `ventas_${fechaDesde || 'inicio'}_${fechaHasta || 'hoy'}.xlsx`
  XLSX.writeFile(wb, nombre)
}

// ── Página Historial de Ventas ────────────────────────────────────────────
export default function HistorialVentas() {
  const [pedidos,      setPedidos]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [fechaDesde,   setFechaDesde]   = useState(getLunesDeHoy)
  const [fechaHasta,   setFechaHasta]   = useState(hoyStr)
  const [seleccionado, setSeleccionado] = useState(null)
  const [exporting,    setExporting]    = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPedidos(await getPedidosEntregados(fechaDesde, fechaHasta))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta])

  useEffect(() => { cargar() }, [cargar])

  const totalAcumulado = pedidos.reduce((s, p) => s + p.total, 0)

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
    fp === 'LIQUIDADO'
      ? <span className="badge badge-green">Liquidado</span>
      : <span className="badge badge-orange">Anticipo</span>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Historial de Ventas</div>
          <div className="page-subtitle">Pedidos entregados</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-outline" onClick={cargar} disabled={loading}>↻ Actualizar</button>
          <button className="btn btn-primary" onClick={handleExportar} disabled={exporting || pedidos.length === 0}>
            {exporting ? 'Exportando...' : '⬇ Excel'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Filtros de fecha */}
        <div className="filter-bar" style={{ marginBottom:20 }}>
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>Desde:</span>
          <input
            type="date" className="filter-select"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
          />
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>Hasta:</span>
          <input
            type="date" className="filter-select"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
          />
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { setFechaDesde(getLunesDeHoy()); setFechaHasta(hoyStr()) }}
          >
            Esta semana
          </button>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Ventas en periodo</div>
            <div className="stat-value">{pedidos.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total acumulado</div>
            <div className="stat-value" style={{ fontSize:18, color:'var(--accent)' }}>
              ${totalAcumulado.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
            Cargando ventas...
          </div>
        ) : error ? (
          <div className="alert alert-error">❌ {error}</div>
        ) : pedidos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3>Sin ventas en el periodo</h3>
            <p>Ajusta el rango de fechas para ver resultados</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Entregado</th>
                  <th>Cliente</th>
                  <th>Pago</th>
                  <th style={{ textAlign:'right' }}>Total</th>
                  <th style={{ width:90 }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map(p => (
                  <tr key={p.id} style={{ cursor:'pointer' }} onClick={() => setSeleccionado(p)}>
                    <td data-label="Folio">
                      <span className="badge badge-blue">{p.folio}</span>
                    </td>
                    <td data-label="Entregado">
                      {p.fechaEntrega}
                    </td>
                    <td data-label="Cliente" style={{ fontWeight:500 }}>{p.clienteNombre}</td>
                    <td data-label="Pago">{formaPagoBadge(p.forma_pago)}</td>
                    <td data-label="Total" style={{ textAlign:'right', fontWeight:700, color:'var(--accent)' }}>
                      ${p.total.toFixed(2)}
                    </td>
                    <td data-label="">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={e => { e.stopPropagation(); setSeleccionado(p) }}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding:'12px 16px', textAlign:'right', fontWeight:700, fontSize:15, borderTop:'1px solid var(--border)', color:'var(--accent)' }}>
              Total del periodo: ${totalAcumulado.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {seleccionado && (
        <DetalleVentaModal
          resumen={seleccionado}
          onClose={() => setSeleccionado(null)}
        />
      )}
    </>
  )
}
