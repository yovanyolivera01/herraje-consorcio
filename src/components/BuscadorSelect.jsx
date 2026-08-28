// Select con buscador: input de texto + lista desplegable filtrable.
// Uso: <BuscadorSelect value={id} onChange={setId} options={[{ value, label }]} placeholder="-- Tipo --" />
import { useState } from 'react'

export default function BuscadorSelect({ value, onChange, options, placeholder = '-- Selecciona --', disabled = false }) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)

  const seleccionado = options.find(o => o.value === value)
  const q = query.trim().toLowerCase()
  const opciones = options.filter(o => (o.label ?? '').toLowerCase().includes(q))

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="form-input"
        type="text"
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        value={open ? query : (seleccionado?.label ?? '')}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="card" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          zIndex: 20, maxHeight: 240, overflowY: 'auto', padding: 4,
          boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
        }}>
          {opciones.length === 0 && (
            <div style={{ padding: '7px 10px', fontSize: 13, color: 'var(--text-muted)' }}>Sin resultados</div>
          )}
          {opciones.map(o => (
            <div
              key={o.value}
              onMouseDown={() => { onChange(o.value); setQuery(''); setOpen(false) }}
              style={{
                padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                fontWeight: value === o.value ? 700 : 400,
                background: value === o.value ? 'var(--accent-soft, rgba(37,99,235,0.08))' : 'transparent',
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
