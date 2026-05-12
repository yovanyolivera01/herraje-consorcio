import { useState, useEffect, useCallback } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

const EMPTY = { nombre: '', descripcion: '', unidad: '', precio: '' }

function ProductoModal({ producto, onClose, onSaved }) {
  const { createProductoGeneral, updateProductoGeneral } = useCotizacion()
  const [form,   setForm]   = useState(producto ? {
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
      ? await updateProductoGeneral(producto.id_producto_general, payload)
      : await createProductoGeneral(payload)
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
            <label className="form-label">Descripcion</label>
            <input className="form-input" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripcion opcional" />
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

export default function ProductosGenerales() {
  const { getProductosGenerales } = useCotizacion()
  const [productos, setProductos] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [modal,     setModal]     = useState(null) // null | 'new' | producto

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await getProductosGenerales()
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setProductos(res.data)
  }, [getProductosGenerales])

  useEffect(() => { cargar() }, [cargar])

  const handleSaved = () => { setModal(null); cargar() }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>Cargando...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Productos Generales</div>
          <div className="page-subtitle">{productos.length} producto{productos.length !== 1 ? 's' : ''} registrado{productos.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')}>+ Nuevo producto</button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">❌ {error}</div>}

        {productos.length === 0 ? (
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
                  <th>Descripcion</th>
                  <th>Unidad</th>
                  <th style={{ textAlign: 'right' }}>Precio</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {productos.map(p => (
                  <tr key={p.id_producto_general}>
                    <td data-label="Nombre" style={{ fontWeight: 600 }}>{p.nombre}</td>
                    <td data-label="Descripcion" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
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
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => setModal(p)}>Editar</button>
                    </td>
                  </tr>
                ))}
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
    </>
  )
}
