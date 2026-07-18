import React, { useState } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

// ── Celda de precio editable ──────────────────────────────────────────────
function PrecioCell({ idTipoVidrio, idNivel, precioActual, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(precioActual != null ? String(precioActual) : '')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const inputRef = React.useRef(null)

  const abrir = () => {
    setValue(precioActual != null ? String(precioActual) : '')
    setEditing(true)
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const cancelar = () => {
    setValue(precioActual != null ? String(precioActual) : '')
    setEditing(false)
    setError(null)
  }

  const guardar = async () => {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) { setError('Valor invalido'); return }
    setError(null)
    setSaving(true)
    const { error: saveErr } = await onSave(idTipoVidrio, idNivel, num)
    setSaving(false)
    if (saveErr) { setError(saveErr); return }
    setEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter')  guardar()
    if (e.key === 'Escape') cancelar()
  }

  if (editing) {
    return (
      <td style={{ padding: '6px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            ref={inputRef}
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: 80, border: '1.5px solid var(--accent)', borderRadius: 5,
              padding: '4px 6px', fontSize: 14, fontFamily: 'inherit',
            }}
          />
          <button
            onClick={guardar}
            disabled={saving}
            style={{
              padding: '4px 8px', background: 'var(--accent)', color: 'white',
              border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 700,
            }}
          >{saving ? '...' : '✓'}</button>
          <button
            onClick={cancelar}
            style={{
              padding: '4px 8px', background: 'var(--bg)', color: 'var(--text-muted)',
              border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', fontSize: 13,
            }}
          >✕</button>
        </div>
        {error && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>{error}</div>}
      </td>
    )
  }

  return (
    <td
      style={{
        padding: '8px 10px', cursor: 'pointer', textAlign: 'right', fontSize: 15,
        background: saving ? 'var(--accent-subtle, #eff6ff)' : 'var(--card)',
        color: precioActual != null ? 'var(--text)' : 'var(--text-muted)',
        userSelect: 'none',
      }}
      onClick={abrir}
      onTouchEnd={e => { e.preventDefault(); abrir() }}
      title="Toca para editar"
    >
      {saving ? '...' : precioActual != null ? `$${Number(precioActual).toFixed(2)}` : (
        <span style={{ fontSize: 12 }}>— agregar</span>
      )}
    </td>
  )
}

// ── Pagina Precios ────────────────────────────────────────────────────────
export default function Precios() {
  const { tiposVidrio, nivelesPrecio: nivelesRaw, precios, guardarPrecio } = useCotizacion()
  const nivelesPrecio = [...(nivelesRaw ?? [])].sort((a, b) => (a.es_hoja_completa ? 1 : 0) - (b.es_hoja_completa ? 1 : 0))
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSave = async (idTipoVidrio, idNivel, precio_m2) => {
    const { error } = await guardarPrecio({ id_tipo_vidrio: idTipoVidrio, id_nivel_precio: idNivel, precio_m2 })
    if (error) { showToast(error, 'error'); return { error } }
    showToast('Precio guardado ✅')
    return {}
  }

  const getPrecio = (idTipo, idNivel) => {
    const found = precios.find(p => p.id_tipo_vidrio === idTipo && p.id_nivel_precio === idNivel)
    return found ? Number(found.precio_m2) : null
  }

  const tipos = tiposVidrio
    .filter(t => !soloActivos || t.activo)
    .filter(t =>
      t.clave.toLowerCase().includes(search.toLowerCase()) ||
      (t.descripcion || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.tono?.nombre || '').toLowerCase().includes(search.toLowerCase())
    )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Precios de Vidrio</div>
          <div className="page-subtitle">Haz clic en una celda para editar el precio por m²</div>
        </div>
      </div>

      <div className="page-body">
        {toast && <div className={`alert alert-${toast.type}`}>{toast.msg}</div>}

        <div className="search-bar" style={{ marginBottom: 16 }}>
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Buscar tipo de vidrio..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={e => setSoloActivos(e.target.checked)}
            />
            Solo activos
          </label>
        </div>

        {tipos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💲</div>
            <h3>Sin tipos de vidrio</h3>
            <p>Primero registra tipos de vidrio en el catalogo</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="table" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 140 }}>Tipo de Vidrio</th>
                    <th style={{ minWidth: 120, fontStyle: 'italic', color: 'var(--text-muted)' }}>Tono / Espesor</th>
                    {nivelesPrecio.map(n => (
                      <th key={n.id_nivel_precio} style={{ textAlign: 'right', minWidth: 110 }}>
                        {n.es_hoja_completa ? 'POR HOJA' : n.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tipos.map(tipo => (
                    <tr key={tipo.id_tipo_vidrio}>
                      <td style={{ fontWeight: 600 }}>
                        <span className="badge badge-blue">{tipo.clave}</span>
                      </td>
                      <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        {tipo.tono?.nombre} / {tipo.espesor?.etiqueta}
                      </td>
                      {nivelesPrecio.map(n => (
                        <PrecioCell
                          key={n.id_nivel_precio}
                          idTipoVidrio={tipo.id_tipo_vidrio}
                          idNivel={n.id_nivel_precio}
                          precioActual={getPrecio(tipo.id_tipo_vidrio, n.id_nivel_precio)}
                          onSave={handleSave}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
              💡 Haz clic en cualquier celda para editar el precio por m². Presiona Enter o haz clic fuera para guardar.
            </div>
          </div>
        )}
      </div>
    </>
  )
}
