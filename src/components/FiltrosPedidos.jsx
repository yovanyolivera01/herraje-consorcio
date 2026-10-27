// Barra de filtros: rango de fechas (Desde/Hasta) y listas desplegables de selección única.
// resumen = [{ label, valor, color? }] se muestra en línea tras los filtros; children (botones de acción) va al final.
// grupos = [{ opciones: [{ val, label }], valor, onChange }]; val null = "todos".
export default function FiltrosPedidos({ desde, hasta, onDesde, onHasta, grupos = [], resumen = [], busqueda, onBusqueda, children }) {
  return (
    <div className="filter-bar" style={{ marginBottom: 20 }}>
      {onBusqueda && (
        <input
          type="text" className="filter-select" placeholder="Buscar cliente o pedido (folio)..."
          value={busqueda} onChange={e => onBusqueda(e.target.value)} style={{ minWidth: 240 }}
        />
      )}
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Desde:</span>
      <input type="date" className="filter-select" value={desde} onChange={e => onDesde(e.target.value)} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Hasta:</span>
      <input type="date" className="filter-select" value={hasta} onChange={e => onHasta(e.target.value)} />

      {grupos.map((g, i) => (
        <span key={i} style={{ display: 'contents' }}>
          <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', margin: '0 4px' }} />
          <select
            className="filter-select"
            value={g.valor ?? ''}
            onChange={e => g.onChange(e.target.value || null)}
          >
            {g.opciones.map(({ val, label }) => (
              <option key={label} value={val ?? ''}>{label}</option>
            ))}
          </select>
        </span>
      ))}

      {resumen.map(({ label, valor, color }) => (
        <span key={label} style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
          {label}: <strong style={{ fontSize: 15, color: color || 'var(--text)' }}>{valor}</strong>
        </span>
      ))}

      {children}
    </div>
  )
}
