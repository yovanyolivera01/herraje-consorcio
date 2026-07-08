import { useState, useEffect, useCallback } from 'react'
import { fmt5, hoyMX, lunesMX } from '../../lib/utils'
import * as XLSX from 'xlsx'
import { getPedidosEntregados, getDetallePedido, getPedidosParaExport } from '../../lib/pedidosApi'

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
          {detalle.extras.map((e, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div className="ticket-row" style={{ fontWeight: 600, fontSize: 12 }}>
                <span>{e.cantidad} {e.unidad} — {e.descripcion}</span>
                <span>${fmt5(Number(e.subtotal))}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 14 }}>
                ${Number(e.precio_unitario).toFixed(2)}/u
                {e.notas ? ` · ${e.notas}` : ''}
              </div>
            </div>
          ))}
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
function DetalleVentaModal({ resumen, onClose }) {
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
        'Folio': row['Folio'],
        'Fecha entrega': row['Fecha entrega'],
        'Cliente': row['Cliente'],
        'Forma de pago': row['Forma de pago'],
        'Total': Number(row['Total pedido']),
        'Anticipo': Number(row['Anticipo']),
        'Cobrado entrega': Number(row['Cobrado entrega']),
        'Total recibido': Number(row['Total cobrado']),
        'Observaciones': row['Observaciones'] ?? '',
      })
    }
  }

  // Fila de totales al final de la hoja Ventas
  const sum = (col) => resumen.reduce((s, r) => s + (r[col] ?? 0), 0)
  resumen.push({
    'Folio': 'TOTAL',
    'Fecha entrega': '',
    'Cliente': '',
    'Forma de pago': '',
    'Total': sum('Total'),
    'Anticipo': sum('Anticipo'),
    'Cobrado entrega': sum('Cobrado entrega'),
    'Total recibido': sum('Total recibido'),
    'Observaciones': '',
  })

  // Hoja 2: partidas tal como las devuelve el SP
  const partidas = raw.map(row => ({
    'Folio': row['Folio'],
    'Cliente': row['Cliente'],
    'Tipo vidrio': row['Tipo vidrio'],
    'Largo (cm)': Number(row['Largo (cm)']),
    'Ancho (cm)': Number(row['Ancho (cm)']),
    'm²': Number(row['m2']),
    'Cantidad': Number(row['Cantidad']),
    'Precio m²': Number(row['Precio m2']),
    'Subtotal vidrio': Number(row['Subtotal vidrio']),
    'Subtotal procesos': Number(row['Subtotal procesos']),
    'Total partida': Number(row['Total partida']),
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Ventas')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partidas), 'Partidas')

  const nombre = `ventas_${fechaDesde || 'inicio'}_${fechaHasta || 'hoy'}.xlsx`
  XLSX.writeFile(wb, nombre)
}

// ── Página Historial de Ventas ────────────────────────────────────────────
export default function HistorialVentas() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fechaDesde, setFechaDesde] = useState(lunesMX)
  const [fechaHasta, setFechaHasta] = useState(hoyMX)
  const [seleccionado, setSeleccionado] = useState(null)
  const [exporting, setExporting] = useState(false)

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={cargar} disabled={loading}>↻ Actualizar</button>
          <button className="btn btn-primary" onClick={handleExportar} disabled={exporting || pedidos.length === 0}>
            {exporting ? 'Exportando...' : '⬇ Excel'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Filtros de fecha */}
        <div className="filter-bar" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Desde:</span>
          <input
            type="date" className="filter-select"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
          />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Hasta:</span>
          <input
            type="date" className="filter-select"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
          />
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { setFechaDesde(lunesMX()); setFechaHasta(hoyMX()) }}
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
            <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent)' }}>
              ${fmt5(totalAcumulado)}
            </div>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
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
          <>
            {/* ── Tabla (desktop) ── */}
            <div className="hist-desktop">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Entregado</th>
                      <th>Cliente</th>
                      <th>Pago</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ width: 100 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map(p => (
                      <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSeleccionado(p)}>
                        <td><span className="badge badge-blue">{p.folio}</span></td>
                        <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>{p.fechaEntrega}</td>
                        <td style={{ fontWeight: 500 }}>{p.clienteNombre}</td>
                        <td>{formaPagoBadge(p.forma_pago)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>${fmt5(p.total)}</td>
                        <td>
                          <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSeleccionado(p) }}>
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--border)', color: 'var(--accent)' }}>
                  Total del periodo: ${fmt5(totalAcumulado)}
                </div>
              </div>
            </div>

            {/* ── Tarjetas (tablet / móvil) ── */}
            <div className="hist-mobile">
              {pedidos.map(p => (
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
