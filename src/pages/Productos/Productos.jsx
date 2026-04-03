import { useState } from 'react'
import { useApp } from '../../context/AppContext'

// ── Formulario de producto ────────────────────────────────────────────────
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
    if (!form.codigoProveedor) e.codigoProveedor = 'Selecciona un proveedor'
    if (!form.descripcion.trim()) e.descripcion = 'La descripción es obligatoria'
    if (form.precio === '' || isNaN(form.precio) || Number(form.precio) <= 0)
      e.precio = 'Ingresa un precio válido mayor a 0'
    if (!form.espesor || isNaN(form.espesor) || Number(form.espesor) <= 0)
      e.espesor = 'Ingresa el espesor de vidrio (mm), mayor a 0'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave({ ...form, precio: Number(form.precio), espesor: Number(form.espesor) })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {producto ? 'Editar producto' : 'Agregar producto'}
          </h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label required">Código del producto</label>
              <input
                className={`form-input${errors.codigoProducto ? ' error' : ''}`}
                value={form.codigoProducto}
                onChange={set('codigoProducto')}
                placeholder="Ej. PRD-001 o el código que uses"
                autoFocus
              />
              {errors.codigoProducto && <div className="form-error">{errors.codigoProducto}</div>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Proveedor</label>
                <select
                  className={`form-select${errors.codigoProveedor ? ' error' : ''}`}
                  value={form.codigoProveedor}
                  onChange={set('codigoProveedor')}
                >
                  <option value="">— Seleccionar —</option>
                  {proveedores.map(p => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.codigo} — {p.nombre}
                    </option>
                  ))}
                </select>
                {errors.codigoProveedor && <div className="form-error">{errors.codigoProveedor}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Marca</label>
                <input
                  className="form-input"
                  value={form.marca}
                  onChange={set('marca')}
                  placeholder="Marca del producto"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">Descripción</label>
              <input
                className={`form-input${errors.descripcion ? ' error' : ''}`}
                value={form.descripcion}
                onChange={set('descripcion')}
                placeholder="Descripción del producto"
              />
              {errors.descripcion && <div className="form-error">{errors.descripcion}</div>}
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Tono</label>
                <input
                  className="form-input"
                  value={form.tono}
                  onChange={set('tono')}
                  placeholder="Ej. Natural, Café..."
                />
              </div>
              <div className="form-group">
                <label className="form-label required">Espesor (mm)</label>
                <input
                  className={`form-input${errors.espesor ? ' error' : ''}`}
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.espesor}
                  onChange={set('espesor')}
                  placeholder="Ej. 6"
                />
                {errors.espesor && <div className="form-error">{errors.espesor}</div>}
              </div>
              <div className="form-group">
                <label className="form-label required">Precio ($)</label>
                <input
                  className={`form-input${errors.precio ? ' error' : ''}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.precio}
                  onChange={set('precio')}
                  placeholder="0.00"
                />
                {errors.precio && <div className="form-error">{errors.precio}</div>}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">
              {producto ? 'Guardar cambios' : 'Agregar producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal de ajuste de existencias ────────────────────────────────────────
function AjusteModal({ producto, onClose, onAjuste }) {
  const [cantidad, setCantidad] = useState(1)
  const [tipo, setTipo] = useState('entrada')

  const handleSubmit = (e) => {
    e.preventDefault()
    const delta = tipo === 'entrada' ? Number(cantidad) : -Number(cantidad)
    onAjuste(producto.id, delta, tipo)
    onClose()
  }

  const nuevas = producto.existencias + (tipo === 'entrada' ? Number(cantidad) : -Number(cantidad))
  const valido  = nuevas >= 0 && Number(cantidad) > 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Ajustar existencias</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: 15 }}>
              <strong style={{ color: 'var(--text)' }}>{producto.descripcion}</strong>
              {' — '}{producto.codigo}
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
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={e => setCantidad(e.target.value)}
                />
              </div>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--bg)', borderRadius: 8, padding: '14px 20px',
            }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                  Actuales
                </div>
                <div style={{ fontSize: 26, fontWeight: 700 }}>{producto.existencias}</div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 22 }}>→</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                  Resultado
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: nuevas < 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {nuevas < 0 ? '—' : nuevas}
                </div>
              </div>
            </div>
            {nuevas < 0 && (
              <div className="alert alert-error" style={{ marginTop: 10, marginBottom: 0 }}>
                Las existencias no pueden quedar en negativo
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!valido}>
              Registrar movimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal de confirmación de eliminación ──────────────────────────────────
function DeleteModal({ producto, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ marginBottom: 8, fontSize: 17 }}>
            ¿Eliminar el producto <em>"{producto.descripcion}"</em>?
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
            Esta acción no se puede deshacer.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm}>Sí, eliminar</button>
        </div>
      </div>
    </div>
  )
}

// ── Fila de producto ──────────────────────────────────────────────────────
function ProductRow({ producto, proveedor, onEdit, onDelete, onAjuste }) {
  const low = producto.existencias < 5

  return (
    <tr className={low ? 'row-low-stock' : ''}>
      <td>
        <span className="badge badge-blue">{producto.codigo}</span>
      </td>
      <td>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{producto.descripcion}</div>
        {producto.marca && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{producto.marca}</div>
        )}
      </td>
      <td>{proveedor?.nombre ?? '—'}</td>
      <td>
        {producto.tono
          ? <span className="badge badge-orange">{producto.tono}</span>
          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </td>
      <td style={{ textAlign: 'center' }}>
        {producto.espesor ? `${producto.espesor} mm` : '—'}
      </td>
      <td style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
        ${Number(producto.precio).toFixed(2)}
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`stock-indicator ${low ? 'stock-low' : 'stock-ok'}`}>
            <span className="stock-dot" />
            <span style={{ fontSize: 15, fontWeight: 600 }}>{producto.existencias}</span>
          </span>
          {low && <span className="badge badge-red" style={{ fontSize: 11 }}>Bajo</span>}
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => onAjuste(producto)}
            title="Ajustar stock"
          >
            ± Stock
          </button>
          <button className="btn-icon" title="Editar" onClick={() => onEdit(producto)}>✏️</button>
          <button className="btn-icon danger" title="Eliminar" onClick={() => onDelete(producto)}>🗑️</button>
        </div>
      </td>
    </tr>
  )
}

// ── Página principal ──────────────────────────────────────────────────────
export default function Productos() {
  const { productos, proveedores, addProducto, updateProducto, deleteProducto, ajustarExistencias } = useApp()
  const [search, setSearch]               = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroTono, setFiltroTono]       = useState('')
  const [filtroEspesor, setFiltroEspesor] = useState('')
  const [modal, setModal]                 = useState(null)
  const [toast, setToast]                 = useState(null)

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

  const lowStockCount = productos.filter(p => p.existencias < 5).length

  const handleSave = async (form) => {
    if (modal.type === 'edit' && !modal.data.id) {
      showToast('Error: el producto no tiene ID. Recarga la página e intenta de nuevo.', 'error')
      return
    }
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
      const msg = error.toLowerCase().includes('foreign key') ||
                  error.toLowerCase().includes('restrict') ||
                  error.toLowerCase().includes('dependencias')
        ? 'No se puede eliminar: el producto tiene ventas registradas'
        : error
      showToast(msg, 'error')
    } else {
      showToast('Producto eliminado')
    }
    setModal(null)
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Inventario de productos</div>
          <div className="page-subtitle">
            {productos.length} producto{productos.length !== 1 ? 's' : ''} en catálogo
            {lowStockCount > 0 && (
              <span className="badge badge-red" style={{ marginLeft: 10 }}>
                {lowStockCount} con stock bajo
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
          + Agregar producto
        </button>
      </div>

      {/* Body */}
      <div className="page-body">
        {toast && <div className={`alert alert-${toast.type}`}>{toast.msg}</div>}

        {/* Búsqueda y filtros */}
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
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { setSearch(''); setFiltroProveedor(''); setFiltroTono(''); setFiltroEspesor('') }}
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Tabla */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3>{search || filtroProveedor || filtroTono || filtroEspesor ? 'Sin resultados' : 'Sin productos en catálogo'}</h3>
            <p>{search || filtroProveedor || filtroTono || filtroEspesor ? 'Ajusta los filtros' : 'Haz clic en "+ Agregar producto" para comenzar'}</p>
          </div>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 820 }}>
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
      </div>

      {/* Modales */}
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
