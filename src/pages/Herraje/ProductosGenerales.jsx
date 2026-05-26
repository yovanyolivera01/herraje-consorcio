import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'

const EMPTY = { nombre: '', descripcion: '', unidad: '', precio: '' }

// ── Modal crear / editar producto ────────────────────────────────────────────
function ProductoModal({ producto, onClose, onSaved }) {
  const { addProductoGeneral, editProductoGeneral } = useApp()
  const [form, setForm] = useState(producto ? {
    nombre:      producto.nombre      ?? '',
    descripcion: producto.descripcion ?? '',
    unidad:      producto.unidad      ?? '',
    precio:      producto.precio != null ? String(producto.precio) : '',
  } : EMPTY)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError(null)
    const payload = {
      nombre:      form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      unidad:      form.unidad.trim()      || null,
      precio:      form.precio !== '' ? Number(form.precio) : null,
    }
    const res = producto
      ? await editProductoGeneral(producto.id_producto_general, payload)
      : await addProductoGeneral(payload)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title">{producto ? 'Editar producto' : 'Nuevo producto'}</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input className="form-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej. Silicón transparente" />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input className="form-input" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción opcional" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <input className="form-input" value={form.unidad} onChange={e => set('unidad', e.target.value)} placeholder="pza, ml, kg..." />
            </div>
            <div className="form-group">
              <label className="form-label">Precio ($)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.precio} onChange={e => set('precio', e.target.value)} placeholder="0.00" />
            </div>
          </div>
          {error && <div className="alert alert-error">❌ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal ajuste de existencias ──────────────────────────────────────────────
function StockModal({ producto, onClose, onSaved }) {
  const { ajustarStockGeneral } = useApp()
  const [tipo,    setTipo]    = useState('ENTRADA')
  const [cantidad, setCantidad] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  const handleSave = async () => {
    const n = parseInt(cantidad)
    if (!n || n <= 0) { setError('Ingresa una cantidad válida'); return }
    setSaving(true); setError(null)
    const delta = tipo === 'ENTRADA' ? n : -n
    const res = await ajustarStockGeneral(producto.id_producto_general, delta)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <div className="modal-title">Ajustar existencias</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 14, color: 'var(--text-muted)', fontSize: 13 }}>
            <strong>{producto.nombre}</strong> · Stock actual: <strong>{producto.existencias ?? 0}</strong> {producto.unidad || 'pza'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-input" value={tipo} onChange={e => setTipo(e.target.value)}>
                <option value="ENTRADA">Entrada (sumar)</option>
                <option value="SALIDA">Salida (restar)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cantidad</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
          </div>
          {error && <div className="alert alert-error">❌ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            className={`btn ${tipo === 'ENTRADA' ? 'btn-primary' : 'btn-accent'}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando...' : tipo === 'ENTRADA' ? '+ Agregar' : '− Restar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function ProductosGenerales() {
  const { productosGenerales } = useApp()
  const [modal,      setModal]      = useState(null) // null | 'new' | producto
  const [stockModal, setStockModal] = useState(null) // null | producto

  const handleSaved = () => { setModal(null); setStockModal(null) }

  const totalProductos = productosGenerales?.length ?? 0

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Productos Generales</div>
          <div className="page-subtitle">{totalProductos} producto{totalProductos !== 1 ? 's' : ''} registrado{totalProductos !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')}>+ Nuevo producto</button>
      </div>

      <div className="page-body">
        {totalProductos === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3>Sin productos</h3>
            <p>Agrega el primer producto general</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Unidad</th>
                  <th style={{ textAlign: 'right' }}>Precio</th>
                  <th style={{ textAlign: 'right' }}>Existencias</th>
                  <th style={{ width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {productosGenerales.map(p => {
                  const stock = p.existencias ?? 0
                  return (
                    <tr key={p.id_producto_general}>
                      <td data-label="Nombre" style={{ fontWeight: 600 }}>{p.nombre}</td>
                      <td data-label="Descripción" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        {p.descripcion ?? <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                      <td data-label="Unidad">
                        {p.unidad
                          ? <span className="badge badge-gray">{p.unidad}</span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                      </td>
                      <td data-label="Precio" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {p.precio != null ? `$${Number(p.precio).toFixed(2)}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td data-label="Existencias" style={{ textAlign: 'right' }}>
                        <span style={{
                          fontWeight: 700,
                          color: stock === 0 ? '#dc2626' : stock < 5 ? '#d97706' : '#16a34a',
                        }}>
                          {stock}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setStockModal(p)}>
                          Stock
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => setModal(p)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ProductoModal
          producto={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {stockModal && (
        <StockModal
          producto={stockModal}
          onClose={() => setStockModal(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
