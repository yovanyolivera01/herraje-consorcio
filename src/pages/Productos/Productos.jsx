import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: INVENTARIO SKU
// ─────────────────────────────────────────────────────────────────────────────

function ProductoModal({ producto, onClose, onSave, proveedores }) {
  const [form, setForm] = useState({
    codigoProducto:  producto?.codigo          ?? '',
    codigoProveedor: producto?.codigoProveedor ?? '',
    marca:           producto?.marca           ?? '',
    tono:            producto?.tono            ?? '',
    descripcion:     producto?.descripcion     ?? '',
    espesor:         producto?.espesor         ?? '',
    precio:          producto?.precio          ?? '',
  })
  const [errors, setErrors] = useState({})
  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.codigoProducto.trim()) e.codigoProducto = 'El código es obligatorio'
    if (!form.codigoProveedor)       e.codigoProveedor = 'Selecciona un proveedor'
    if (!form.marca?.trim())         e.marca = 'La marca es obligatoria'
    if (!form.tono?.trim())          e.tono = 'El tono es obligatorio'
    if (!form.descripcion?.trim())   e.descripcion = 'La descripción es obligatoria'
    if (form.precio === '' || isNaN(form.precio) || Number(form.precio) <= 0)
      e.precio = 'Ingresa un precio válido mayor a 0'
    if (!form.espesor || isNaN(form.espesor) || Number(form.espesor) <= 0)
      e.espesor = 'Ingresa el espesor (mm), mayor a 0'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave({ ...form, precio: Number(form.precio), espesor: Number(form.espesor) })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{producto ? 'Editar producto' : 'Agregar producto'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label required">Código del producto</label>
              <input className={`form-input${errors.codigoProducto ? ' error' : ''}`} value={form.codigoProducto} onChange={set('codigoProducto')} placeholder="Ej. PRD-001" autoFocus />
              {errors.codigoProducto && <div className="form-error">{errors.codigoProducto}</div>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Proveedor</label>
                <select className={`form-select${errors.codigoProveedor ? ' error' : ''}`} value={form.codigoProveedor} onChange={set('codigoProveedor')}>
                  <option value="">— Seleccionar —</option>
                  {proveedores.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.nombre}</option>)}
                </select>
                {errors.codigoProveedor && <div className="form-error">{errors.codigoProveedor}</div>}
              </div>
              <div className="form-group">
                <label className="form-label required">Marca</label>
                <input className={`form-input${errors.marca ? ' error' : ''}`} value={form.marca} onChange={set('marca')} placeholder="Marca del producto" />
                {errors.marca && <div className="form-error">{errors.marca}</div>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label required">Descripción</label>
              <textarea className={`form-input${errors.descripcion ? ' error' : ''}`} value={form.descripcion} onChange={set('descripcion')} placeholder="Descripción del producto" rows="3" />
              {errors.descripcion && <div className="form-error">{errors.descripcion}</div>}
            </div>
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label required">Tono</label>
                <input className={`form-input${errors.tono ? ' error' : ''}`} value={form.tono} onChange={set('tono')} placeholder="Ej. Natural, Café..." />
                {errors.tono && <div className="form-error">{errors.tono}</div>}
              </div>
              <div className="form-group">
                <label className="form-label required">Espesor (mm)</label>
                <input className={`form-input${errors.espesor ? ' error' : ''}`} type="number" min="0" step="0.1" value={form.espesor} onChange={e => setForm(f => ({ ...f, espesor: e.target.value === '' ? '' : Number(e.target.value) }))} placeholder="Ej. 6" />
                {errors.espesor && <div className="form-error">{errors.espesor}</div>}
              </div>
              <div className="form-group">
                <label className="form-label required">Precio ($)</label>
                <input className={`form-input${errors.precio ? ' error' : ''}`} type="number" min="0.01" step="0.01" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value === '' ? '' : Number(e.target.value) }))} placeholder="0.00" />
                {errors.precio && <div className="form-error">{errors.precio}</div>}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{producto ? 'Guardar cambios' : 'Agregar producto'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AjusteModal({ producto, onClose, onAjuste }) {
  const [cantidad, setCantidad] = useState(0)
  const [tipo, setTipo]         = useState('entrada')
  const [nota, setNota]         = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const delta = tipo === 'entrada' ? Number(cantidad) : -Number(cantidad)
    onAjuste(producto.id, delta, tipo, nota.trim() || null)
    onClose()
  }

  const nuevas = producto.existencias + (tipo === 'entrada' ? Number(cantidad) : -Number(cantidad))
  const valido  = nuevas >= 0 && Number(cantidad) > 0

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Ajustar existencias</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: 15 }}>
              <strong style={{ color: 'var(--text)' }}>{producto.descripcion}</strong>{' — '}{producto.codigo}
            </p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tipo de movimiento</label>
                <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value)}>
                  <option value="entrada">Entrada de mercancía</option>
                  <option value="ajuste">Ajuste de inventario</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cantidad</label>
                <input className="form-input" type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', borderRadius: 8, padding: '14px 20px' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Actuales</div>
                <div style={{ fontSize: 26, fontWeight: 700 }}>{producto.existencias}</div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 22 }}>→</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Resultado</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: nuevas < 0 ? 'var(--danger)' : 'var(--success)' }}>{nuevas < 0 ? '—' : nuevas}</div>
              </div>
            </div>
            {nuevas < 0 && <div className="alert alert-error" style={{ marginTop: 10, marginBottom: 0 }}>Las existencias no pueden quedar en negativo</div>}
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Nota <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
              <textarea className="form-input" rows={2} placeholder="Ej. Compra a proveedor, factura #123…" value={nota} onChange={e => setNota(e.target.value)} style={{ resize: 'vertical' }} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!valido}>Registrar movimiento</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteModal({ producto, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ marginBottom: 8, fontSize: 17 }}>¿Eliminar el producto <em>"{producto.descripcion}"</em>?</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Esta acción no se puede deshacer.</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm}>Sí, eliminar</button>
        </div>
      </div>
    </div>
  )
}

function ProductRow({ producto, proveedor, onEdit, onDelete, onAjuste }) {
  const low = producto.existencias < 5
  return (
    <tr className={low ? 'row-low-stock' : ''}>
      <td data-label="Código" style={{ whiteSpace: 'nowrap' }}><span className="badge badge-blue">{producto.codigo}</span></td>
      <td data-label="Descripción">
        <div style={{ fontWeight: 600, fontSize: 15 }}>{producto.descripcion}</div>
        {producto.marca && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{producto.marca}</div>}
      </td>
      <td data-label="Proveedor">{proveedor?.nombre ?? '—'}</td>
      <td data-label="Tono">{producto.tono ? <span className="badge badge-orange">{producto.tono}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
      <td data-label="Espesor" style={{ textAlign: 'center' }}>{producto.espesor ? `${producto.espesor} mm` : '—'}</td>
      <td data-label="Precio" style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)', whiteSpace: 'nowrap' }}>${Number(producto.precio).toFixed(2)}</td>
      <td data-label="Stock">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`stock-indicator ${low ? 'stock-low' : 'stock-ok'}`}>
            <span className="stock-dot" />
            <span style={{ fontSize: 15, fontWeight: 600 }}>{producto.existencias}</span>
          </span>
          {low && <span className="badge badge-red" style={{ fontSize: 11 }}>Bajo</span>}
        </div>
      </td>
      <td data-label="">
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-outline btn-sm" onClick={() => onAjuste(producto)} title="Ajustar stock">± Stock</button>
          <button className="btn-icon" title="Editar" onClick={() => onEdit(producto)}>✏️</button>
          <button className="btn-icon danger" title="Eliminar" onClick={() => onDelete(producto)}>🗑️</button>
        </div>
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: PRODUCTOS GENERALES
// ─────────────────────────────────────────────────────────────────────────────

function GeneralModal({ producto, proveedores, onClose, onSaved }) {
  const { addProductoGeneral, editProductoGeneral } = useApp()
  const [form, setForm] = useState({
    nombre:       producto?.nombre       ?? '',
    descripcion:  producto?.descripcion  ?? '',
    unidad:       producto?.unidad       ?? '',
    precio:       producto?.precio != null ? String(producto.precio) : '',
    proveedor_id: producto?.proveedor_id != null ? String(producto.proveedor_id) : '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError(null)
    const payload = {
      nombre:       form.nombre.trim(),
      descripcion:  form.descripcion.trim() || null,
      unidad:       form.unidad.trim()      || null,
      precio:       form.precio !== '' ? Number(form.precio) : null,
      proveedor_id: form.proveedor_id !== '' ? Number(form.proveedor_id) : null,
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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title">{producto ? 'Editar producto general' : 'Nuevo producto general'}</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input className="form-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej. Silicón transparente" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Proveedor</label>
            <select className="form-select" value={form.proveedor_id} onChange={e => set('proveedor_id', e.target.value)}>
              <option value="">— Sin proveedor —</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
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
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

function StockGeneralModal({ producto, onClose, onSaved }) {
  const { ajustarStockGeneral } = useApp()
  const [tipo,     setTipo]     = useState('ENTRADA')
  const [cantidad, setCantidad] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)

  const handleSave = async () => {
    const n = parseInt(cantidad)
    if (!n || n <= 0) { setError('Ingresa una cantidad válida'); return }
    setSaving(true); setError(null)
    const res = await ajustarStockGeneral(producto.id_producto_general, tipo === 'ENTRADA' ? n : -n)
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
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-input" value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="ENTRADA">Entrada (sumar)</option>
              <option value="SALIDA">Salida (restar)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Cantidad de piezas</label>
            <input
              className="form-input"
              type="number"
              min="1"
              step="1"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              placeholder="0"
              autoFocus
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Ingresa la cantidad de piezas a {tipo === 'ENTRADA' ? 'agregar' : 'descontar'}
            </div>
          </div>
          {error && <div className="alert alert-error">❌ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={`btn ${tipo === 'ENTRADA' ? 'btn-primary' : 'btn-accent'}`} onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : tipo === 'ENTRADA' ? '+ Agregar' : '− Restar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TabGenerales({ proveedores, triggerNuevo }) {
  const { productosGenerales } = useApp()
  const [search, setSearch]   = useState('')
  const [modal,  setModal]    = useState(null) // null | 'new' | producto
  const [stock,  setStock]    = useState(null) // null | producto

  // Abre el modal "nuevo" cuando el padre incrementa triggerNuevo
  const [lastTrigger, setLastTrigger] = useState(triggerNuevo)
  useEffect(() => {
    if (triggerNuevo !== lastTrigger) {
      setLastTrigger(triggerNuevo)
      setModal('new')
    }
  }, [triggerNuevo]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = search.trim()
    ? productosGenerales.filter(p =>
        p.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (p.descripcion ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : productosGenerales

  const handleSaved = () => { setModal(null); setStock(null) }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-input-wrap" style={{ maxWidth: 340 }}>
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Buscar por nombre o descripción..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧰</div>
          <h3>{search ? 'Sin resultados' : 'Sin productos generales'}</h3>
          <p>{search ? 'Ajusta la búsqueda' : 'Haz clic en "+ Nuevo producto" para comenzar'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table table-mobile-cards">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Proveedor</th>
                <th>Descripción</th>
                <th>Unidad</th>
                <th style={{ textAlign: 'right' }}>Precio</th>
                <th style={{ textAlign: 'right' }}>Existencias</th>
                <th style={{ width: 150 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const stock     = p.existencias ?? 0
                const sinStock  = stock === 0
                const bajo      = stock > 0 && stock < 5
                const proveedor = proveedores.find(pr => pr.id === p.proveedor_id)
                return (
                  <tr key={p.id_producto_general} className={sinStock || bajo ? 'row-low-stock' : ''}>
                    <td data-label="Nombre" style={{ fontWeight: 600 }}>{p.nombre}</td>
                    <td data-label="Proveedor" style={{ fontSize: 13 }}>
                      {proveedor ? proveedor.nombre : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td data-label="Descripción" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {p.descripcion ?? <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                    <td data-label="Unidad">
                      {p.unidad ? <span className="badge badge-gray">{p.unidad}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td data-label="Precio" style={{ textAlign: 'right', fontWeight: 600 }}>
                      {p.precio != null ? `$${Number(p.precio).toFixed(2)}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td data-label="Existencias" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <span style={{ fontWeight: 700, color: sinStock ? '#dc2626' : bajo ? '#d97706' : '#16a34a' }}>
                          {stock} pzas
                        </span>
                        {sinStock && <span className="badge badge-red" style={{ fontSize: 10 }}>Sin stock</span>}
                        {bajo     && <span className="badge badge-red" style={{ fontSize: 10 }}>Bajo</span>}
                      </div>
                    </td>
                    <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setStock(p)}>± Stock</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setModal(p)}>Editar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <GeneralModal
          producto={modal === 'new' ? null : modal}
          proveedores={proveedores}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {stock && (
        <StockGeneralModal
          producto={stock}
          onClose={() => setStock(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  PÁGINA PRINCIPAL (con pestañas)
// ─────────────────────────────────────────────────────────────────────────────

export default function Productos() {
  const { productos, productosGenerales, proveedores, addProducto, updateProducto, deleteProducto, ajustarExistencias } = useApp()
  const [tab, setTab] = useState('inventario')

  // ── estado pestaña Inventario ────────────────────────────────────────────
  const [search,          setSearch]          = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroTono,      setFiltroTono]      = useState('')
  const [filtroEspesor,   setFiltroEspesor]   = useState('')
  const [modal,           setModal]           = useState(null)
  const [toast,           setToast]           = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const tonos    = [...new Set(productos.map(p => p.tono).filter(Boolean))].sort()
  const espesores = [...new Set(productos.map(p => p.espesor).filter(Boolean))].sort((a, b) => a - b)

  const filtered = productos.filter(p => {
    const matchSearch = !search ||
      p.descripcion.toLowerCase().includes(search.toLowerCase()) ||
      (p.codigo ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.marca ?? '').toLowerCase().includes(search.toLowerCase())
    const matchProv = !filtroProveedor || p.codigoProveedor === filtroProveedor
    const matchTono = !filtroTono || p.tono === filtroTono
    const matchEsp  = !filtroEspesor || String(p.espesor) === filtroEspesor
    return matchSearch && matchProv && matchTono && matchEsp
  })

  const lowStockCount      = productos.filter(p => p.existencias < 5).length
  const lowStockGenerales  = (productosGenerales ?? []).filter(p => (p.existencias ?? 0) < 5).length
  const [triggerNuevoGeneral, setTriggerNuevoGeneral] = useState(0)

  const handleSave = async (form) => {
    const { error } = modal.type === 'create'
      ? await addProducto(form)
      : await updateProducto(modal.data.id, form)
    if (error) { showToast(error, 'error'); return }
    showToast(modal.type === 'create' ? 'Producto agregado ✅' : 'Producto actualizado ✅')
    setModal(null)
  }

  const handleDelete = async () => {
    const { error } = await deleteProducto(modal.data.codigo)
    if (error) {
      showToast(
        error.toLowerCase().includes('dependencias') ? 'No se puede eliminar: el producto tiene ventas registradas' : error,
        'error'
      )
    } else {
      showToast('Producto eliminado')
    }
    setModal(null)
  }

  // ── subtítulos dinámicos ─────────────────────────────────────────────────
  const totalGenerales = productosGenerales?.length ?? 0
  const subtitulo = tab === 'inventario'
    ? `${productos.length} producto${productos.length !== 1 ? 's' : ''} en catálogo`
    : `${totalGenerales} producto${totalGenerales !== 1 ? 's' : ''} generales`

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Inventario</div>
          <div className="page-subtitle">
            {subtitulo}
            {tab === 'inventario' && lowStockCount > 0 && (
              <span className="badge badge-red" style={{ marginLeft: 10 }}>{lowStockCount} con stock bajo</span>
            )}
            {tab === 'generales' && lowStockGenerales > 0 && (
              <span className="badge badge-red" style={{ marginLeft: 10 }}>{lowStockGenerales} con stock bajo</span>
            )}
          </div>
        </div>
        {tab === 'inventario' && (
          <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>+ Agregar producto</button>
        )}
        {tab === 'generales' && (
          <button className="btn btn-primary" onClick={() => setTriggerNuevoGeneral(n => n + 1)}>+ Nuevo producto</button>
        )}
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 20, paddingLeft: 24 }}>
        {[
          { key: 'inventario', label: 'Inventario Herraje',  alert: lowStockCount },
          { key: 'generales',  label: 'Inventario General', alert: lowStockGenerales },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: 14,
              marginBottom: -2,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.label}
              {t.alert > 0 && (
                <span style={{
                  background: '#dc2626', color: 'white',
                  borderRadius: 10, fontSize: 10, fontWeight: 700,
                  padding: '1px 6px', lineHeight: '16px',
                }}>
                  {t.alert}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="page-body" style={{ paddingTop: 0 }}>
        {toast && <div className={`alert alert-${toast.type}`}>{toast.msg}</div>}

        {/* ── Pestaña Inventario SKU ─────────────────────────────────────── */}
        {tab === 'inventario' && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="search-input-wrap" style={{ maxWidth: 340 }}>
                <span className="search-icon">🔍</span>
                <input
                  className="search-input"
                  placeholder="Buscar por código, descripción o marca..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select className="filter-select" value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)}>
                <option value="">Todos los proveedores</option>
                {proveedores.map(p => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
              </select>
              <select className="filter-select" value={filtroTono} onChange={e => setFiltroTono(e.target.value)}>
                <option value="">Todos los tonos</option>
                {tonos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="filter-select" value={filtroEspesor} onChange={e => setFiltroEspesor(e.target.value)}>
                <option value="">Todos los espesores</option>
                {espesores.map(e => <option key={e} value={String(e)}>{e} mm</option>)}
              </select>
              {(search || filtroProveedor || filtroTono || filtroEspesor) && (
                <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setFiltroProveedor(''); setFiltroTono(''); setFiltroEspesor('') }}>
                  Limpiar
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <h3>{search || filtroProveedor || filtroTono || filtroEspesor ? 'Sin resultados' : 'Sin productos en catálogo'}</h3>
                <p>{search || filtroProveedor || filtroTono || filtroEspesor ? 'Ajusta los filtros' : 'Haz clic en "+ Agregar producto" para comenzar'}</p>
              </div>
            ) : (
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="table table-mobile-cards table-inventario" style={{ minWidth: 820 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 120, whiteSpace: 'nowrap' }}>Código</th>
                      <th>Descripción</th>
                      <th style={{ width: 160 }}>Proveedor</th>
                      <th style={{ width: 100, whiteSpace: 'nowrap' }}>Tono</th>
                      <th style={{ width: 90, textAlign: 'center', whiteSpace: 'nowrap' }}>Espesor</th>
                      <th style={{ width: 100, whiteSpace: 'nowrap' }}>Precio</th>
                      <th style={{ width: 90, whiteSpace: 'nowrap' }}>Stock</th>
                      <th style={{ width: 150, whiteSpace: 'nowrap' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(prod => (
                      <ProductRow
                        key={prod.codigo}
                        producto={prod}
                        proveedor={proveedores.find(p => p.codigo === prod.codigoProveedor)}
                        onEdit={(p)   => setModal({ type: 'edit',   data: p })}
                        onDelete={(p) => setModal({ type: 'delete', data: p })}
                        onAjuste={(p) => setModal({ type: 'ajuste', data: p })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Pestaña Generales ──────────────────────────────────────────── */}
        {tab === 'generales' && <TabGenerales proveedores={proveedores} triggerNuevo={triggerNuevoGeneral} />}
      </div>

      {/* Modales del inventario SKU */}
      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <ProductoModal
          producto={modal.type === 'edit' ? modal.data : null}
          proveedores={proveedores}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {modal?.type === 'ajuste' && (
        <AjusteModal
          producto={modal.data}
          onClose={() => setModal(null)}
          onAjuste={async (productoId, delta, tipo) => {
            const { error } = await ajustarExistencias(productoId, delta, tipo)
            if (error) showToast(error, 'error')
            else showToast('Existencias actualizadas ✅')
          }}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal
          producto={modal.data}
          onCancel={() => setModal(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}
