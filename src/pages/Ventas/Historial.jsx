import { useState, useEffect } from 'react'
import { fmt5 } from '../../lib/utils'
import * as XLSX from 'xlsx'
import { useApp } from '../../context/AppContext'
import { printTicket } from '../../utils/ticket'

// ── Ticket preview ────────────────────────────────────────────────────────
function TicketPreview({ venta }) {
  return (
    <div className="ticket-preview">
      <div className="ticket-header">
        <h2>VIDRIO TEMPLADO Y ALUMINIO ROSALES</h2>
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

// ── Modal de detalle (carga su propio detalle) ────────────────────────────
function DetalleModal({ ventaResumen, onClose }) {
  const { getDetalleVenta } = useApp()
  const [venta, setVenta]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    getDetalleVenta(ventaResumen.id).then(({ data, error }) => {
      if (error) setError(error)
      else setVenta(data)
      setLoading(false)
    })
  }, [ventaResumen.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Detalle — {ventaResumen.folio}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {ventaResumen.fecha} · {ventaResumen.hora}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Cargando detalle…
            </div>
          )}
          {error && (
            <div className="alert alert-error">❌ {error}</div>
          )}
          {venta && <TicketPreview venta={venta} />}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          {venta && (
            <>
              <button
                className="btn btn-outline"
                onClick={() => printTicket(venta, '80mm')}
              >
                🖨️ Ticket 80 mm
              </button>
              <button
                className="btn btn-primary"
                onClick={() => printTicket(venta, 'carta')}
              >
                🖨️ Hoja carta
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página Historial ──────────────────────────────────────────────────────
export default function Historial() {
  const { ventas, refreshVentas } = useApp()
  const [fechaDesde, setFechaDesde]           = useState('')
  const [fechaHasta, setFechaHasta]           = useState('')
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null)
  const [refreshing, setRefreshing]           = useState(false)

  useEffect(() => {
    refreshVentas()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshVentas()
    setRefreshing(false)
  }

  const filtered = ventas.filter(v => {
    if (!fechaDesde && !fechaHasta) return true
    const fecha = new Date(v.fechaISO)
    if (fechaDesde && fecha < new Date(fechaDesde)) return false
    if (fechaHasta && fecha > new Date(fechaHasta + 'T23:59:59')) return false
    return true
  })

  const totalPeriodo = filtered.reduce((s, v) => s + v.total, 0)

  const exportarExcel = () => {
    const filas = filtered.map(v => ({
      Folio:      v.folio,
      Fecha:      v.fecha,
      Hora:       v.hora,
      Productos:  v.numPartidas,
      Piezas:     v.totalPiezas,
      Total:      Number(v.total),
    }))

    const totalesRow = {
      Folio: 'TOTAL', Fecha: '', Hora: '',
      Productos: filtered.reduce((s, v) => s + v.numPartidas, 0),
      Piezas:    filtered.reduce((s, v) => s + v.totalPiezas,  0),
      Total:     totalPeriodo,
    }

    const ws = XLSX.utils.json_to_sheet([...filas, totalesRow])

    // Ancho de columnas
    ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 14 }]

    // Formato moneda en columna Total (F)
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: 5 })]
      if (cell) cell.z = '"$"#,##0.00'
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas')

    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `ventas-${fecha}.xlsx`)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Historial de ventas</div>
          <div className="page-subtitle">
            {ventas.length} venta{ventas.length !== 1 ? 's' : ''} registrada{ventas.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? '⏳' : '🔄'} Actualizar
          </button>
          <button
            className="btn btn-outline"
            onClick={exportarExcel}
            disabled={filtered.length === 0}
          >
            📥 Exportar Excel
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total de ventas</div>
            <div className="stat-value">{ventas.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ventas en período</div>
            <div className="stat-value">{filtered.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monto en período</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              ${fmt5(totalPeriodo)}
            </div>
          </div>
        </div>

        {/* Filtro de fechas */}
        <div className="filter-bar" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Filtrar por fecha:</span>
          <input
            type="date"
            className="filter-select"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
          />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>al</span>
          <input
            type="date"
            className="filter-select"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
          />
          {(fechaDesde || fechaHasta) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { setFechaDesde(''); setFechaHasta('') }}
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3>{fechaDesde || fechaHasta ? 'Sin ventas en ese período' : 'Sin ventas registradas'}</h3>
            <p>
              {fechaDesde || fechaHasta
                ? 'Ajusta el rango de fechas'
                : 'Las ventas aparecerán aquí una vez que confirmes tu primera venta'}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Productos</th>
                  <th>Piezas</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ width: 80 }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(venta => (
                  <tr
                    key={venta.folio}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setVentaSeleccionada(venta)}
                  >
                    <td data-label="Folio">
                      <span className="badge badge-blue">{venta.folio}</span>
                    </td>
                    <td data-label="Fecha">{venta.fecha}</td>
                    <td data-label="Hora" style={{ color: 'var(--text-muted)' }}>{venta.hora}</td>
                    <td data-label="Productos">{venta.numPartidas}</td>
                    <td data-label="Piezas">{venta.totalPiezas}</td>
                    <td data-label="Total" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      ${fmt5(venta.total)}
                    </td>
                    <td data-label="">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={e => { e.stopPropagation(); setVentaSeleccionada(venta) }}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ventaSeleccionada && (
        <DetalleModal
          ventaResumen={ventaSeleccionada}
          onClose={() => setVentaSeleccionada(null)}
        />
      )}
    </>
  )
}
