import { useState } from 'react'
import { useApp } from '../../context/AppContext'

// ── Modal de formulario ───────────────────────────────────────────────────
function ProveedorModal({ proveedor, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: proveedor?.nombre ?? '',
    telefono: proveedor?.telefono ?? '',
  })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio'
    if (!form.telefono.trim()) e.telefono = 'El teléfono es obligatorio'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave(form)
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {proveedor && (
              <div className="form-group">
                <label className="form-label">Código</label>
                <input className="form-input" value={proveedor.codigo} disabled />
                <div className="form-hint">El código no es editable</div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label required">Nombre</label>
              <input
                className={`form-input${errors.nombre ? ' error' : ''}`}
                value={form.nombre}
                onChange={set('nombre')}
                placeholder="Nombre del proveedor"
                autoFocus
              />
              {errors.nombre && <div className="form-error">{errors.nombre}</div>}
            </div>
            <div className="form-group">
              <label className="form-label required">Teléfono</label>
              <input
                className={`form-input${errors.telefono ? ' error' : ''}`}
                value={form.telefono}
                onChange={set('telefono')}
                placeholder="Ej. 55 1234-5678"
              />
              {errors.telefono && <div className="form-error">{errors.telefono}</div>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {proveedor ? 'Guardar cambios' : 'Registrar proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal de confirmación de eliminación ──────────────────────────────────
function DeleteModal({ nombre, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ marginBottom: 8, fontSize: 16 }}>
            ¿Eliminar al proveedor <em>"{nombre}"</em>?
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
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

// ── Página principal ──────────────────────────────────────────────────────
export default function Proveedores() {
  const { proveedores, addProveedor, updateProveedor, deleteProveedor, productos } = useApp()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | {type:'create'|'edit'|'delete', data?}
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const tieneProd = (codigo) => productos.some(p => p.codigoProveedor === codigo)

  const filtered = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async (form) => {
    const { error } = modal.type === 'create'
      ? await addProveedor(form)
      : await updateProveedor(modal.data.codigo, form)
    if (error) { showToast(error, 'error'); return }
    showToast(modal.type === 'create' ? 'Proveedor registrado correctamente ✅' : 'Proveedor actualizado correctamente ✅')
    setModal(null)
  }

  const handleDelete = async () => {
    const { error } = await deleteProveedor(modal.data.codigo)
    if (error) {
      showToast(error, 'error')
    } else {
      showToast('Proveedor eliminado')
    }
    setModal(null)
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Proveedores</div>
          <div className="page-subtitle">
            {proveedores.length} proveedor{proveedores.length !== 1 ? 'es' : ''} registrado{proveedores.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
          + Nuevo proveedor
        </button>
      </div>

      {/* Body */}
      <div className="page-body">
        {toast && (
          <div className={`alert alert-${toast.type}`}>{toast.msg}</div>
        )}

        <div className="search-bar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Buscar por nombre o código..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <button className="btn btn-outline btn-sm" onClick={() => setSearch('')}>
              Limpiar
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏭</div>
            <h3>{search ? 'Sin resultados' : 'Sin proveedores registrados'}</h3>
            <p>
              {search
                ? 'Intenta con otro término de búsqueda'
                : 'Haz clic en "+ Nuevo proveedor" para comenzar'}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Productos</th>
                  <th style={{ width: 90 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(prov => {
                  const cantProd = productos.filter(p => p.codigoProveedor === prov.codigo).length
                  const bloqueado = cantProd > 0
                  return (
                    <tr key={prov.codigo}>
                      <td>
                        <span className="badge badge-blue">{prov.codigo}</span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{prov.nombre}</td>
                      <td>{prov.telefono}</td>
                      <td>
                        <span className={`badge ${cantProd > 0 ? 'badge-orange' : 'badge-gray'}`}>
                          {cantProd} producto{cantProd !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button
                            className="btn-icon"
                            title="Editar"
                            onClick={() => setModal({ type: 'edit', data: prov })}
                          >
                            ✏️
                          </button>
                          <button
                            className={`btn-icon${!bloqueado ? ' danger' : ''}`}
                            title={bloqueado ? 'Tiene productos activos, no se puede eliminar' : 'Eliminar'}
                            style={{ opacity: bloqueado ? 0.3 : 1, cursor: bloqueado ? 'not-allowed' : 'pointer' }}
                            onClick={() => !bloqueado && setModal({ type: 'delete', data: prov })}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <ProveedorModal
          proveedor={modal.type === 'edit' ? modal.data : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {modal?.type === 'delete' && (
        <DeleteModal
          nombre={modal.data.nombre}
          onCancel={() => setModal(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}
